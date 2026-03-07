import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { SageMakerRuntimeClient, InvokeEndpointCommand } from '@aws-sdk/client-sagemaker-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { Client as OpenSearchClient } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import {
  createLogger,
  buildResponse,
  buildErrorResponse,
  validateImageKey,
  generateLivestockId,
} from '../shared/utils';
import { computeFraudRiskScore, type FraudInput } from '../shared/fraudScoring';
import {
  DEFAULT_SIMILARITY_THRESHOLD,
  OPENSEARCH_REQUEST_TIMEOUT_MS,
} from '../shared/constants';

const logger = createLogger('enroll');

const REGION = process.env.AWS_REGION || 'us-east-1';
const s3Client = new S3Client({ region: REGION });
const sagemakerClient = new SageMakerRuntimeClient({ region: REGION });
const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

const BUCKET_NAME = process.env.S3_BUCKET_NAME!;
const SAGEMAKER_ENDPOINT = process.env.SAGEMAKER_ENDPOINT_NAME!;
const OPENSEARCH_INDEX = process.env.OPENSEARCH_INDEX || 'livestock-embeddings';
const SIMILARITY_THRESHOLD = parseFloat(process.env.SIMILARITY_THRESHOLD || String(DEFAULT_SIMILARITY_THRESHOLD));
const ANIMALS_TABLE = 'animals';
const EMBEDDINGS_TABLE = 'embeddings';
const FRAUD_SCORES_TABLE = 'fraud_scores';
const ENROLLMENT_SESSIONS_TABLE = 'enrollment_sessions';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

// Ensure the OpenSearch endpoint has the https:// protocol prefix
const rawOsEndpoint = process.env.OPENSEARCH_ENDPOINT!;
const OPENSEARCH_ENDPOINT = rawOsEndpoint.startsWith('https://') ? rawOsEndpoint : `https://${rawOsEndpoint}`;

interface OpenSearchHit {
  _id: string;
  _score: number;
  _source: {
    livestock_id: string;
    embedding: number[];
    enrolled_at: string;
  };
}

interface OpenSearchResponse {
  hits: {
    total: { value: number };
    hits: OpenSearchHit[];
  };
}

function getOpenSearchClient(): OpenSearchClient {
  return new OpenSearchClient({
    ...AwsSigv4Signer({
      region: REGION,
      getCredentials: () => {
        const credentialsProvider = defaultProvider();
        return credentialsProvider();
      },
    }),
    node: OPENSEARCH_ENDPOINT,
    requestTimeout: OPENSEARCH_REQUEST_TIMEOUT_MS,
  });
}

async function getImageFromS3(imageKey: string): Promise<Buffer> {
  const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: imageKey });
  const response = await s3Client.send(command);
  if (!response.Body) {
    throw new Error('Empty response body from S3');
  }
  const byteArray = await response.Body.transformToByteArray();
  return Buffer.from(byteArray);
}

async function getEmbeddingFromSageMaker(imageBuffer: Buffer): Promise<number[]> {
  const command = new InvokeEndpointCommand({
    EndpointName: SAGEMAKER_ENDPOINT,
    ContentType: 'application/octet-stream',
    Accept: 'application/json',
    Body: imageBuffer,
  });
  const response = await sagemakerClient.send(command);
  if (!response.Body) {
    throw new Error('Empty response from SageMaker endpoint');
  }
  const responseText = Buffer.from(response.Body).toString('utf-8');
  let parsed: { embedding: number[] };

  // HuggingFace container may return [json_string, content_type] or plain JSON
  const raw = JSON.parse(responseText);
  if (Array.isArray(raw) && typeof raw[0] === 'string') {
    parsed = JSON.parse(raw[0]) as { embedding: number[] };
  } else {
    parsed = raw as { embedding: number[] };
  }

  if (!Array.isArray(parsed.embedding) || parsed.embedding.length === 0) {
    throw new Error('Invalid embedding response from SageMaker');
  }
  if (!parsed.embedding.every((v) => typeof v === 'number' && isFinite(v))) {
    throw new Error('Embedding contains non-numeric or non-finite values');
  }
  return parsed.embedding;
}

async function searchSimilarEmbeddings(embedding: number[]): Promise<OpenSearchResponse> {
  const client = getOpenSearchClient();
  const response = await client.search({
    index: OPENSEARCH_INDEX,
    body: {
      size: 1,
      query: {
        knn: {
          embedding: {
            vector: embedding,
            k: 1,
          },
        },
      },
    },
  });
  return response.body as OpenSearchResponse;
}

/**
 * Weighted embedding search: combine similarity scores from multiple embeddings.
 * Weights: muzzle 80%, cow_body 10%, body_texture 10% (configurable).
 */
async function searchWeightedSimilarity(
  muzzleEmbedding: number[],
  cowEmbedding: number[] | null,
  bodyTextureEmbedding: number[] | null,
): Promise<{ bestMatch: OpenSearchHit | null; weightedScore: number }> {
  const MUZZLE_WEIGHT = 0.80;
  const COW_WEIGHT = 0.10;
  const TEXTURE_WEIGHT = 0.10;

  // Primary search on muzzle (always available)
  const muzzleResult = await searchSimilarEmbeddings(muzzleEmbedding);
  const muzzleHit = muzzleResult.hits.hits[0] || null;
  if (!muzzleHit) return { bestMatch: null, weightedScore: 0 };

  let weightedScore = muzzleHit._score * MUZZLE_WEIGHT;
  let totalWeight = MUZZLE_WEIGHT;

  // If cow embedding available, search for the same livestock_id in cow index
  if (cowEmbedding) {
    try {
      const cowResult = await searchSimilarEmbeddings(cowEmbedding);
      const cowHit = cowResult.hits.hits[0];
      if (cowHit && cowHit._source.livestock_id === muzzleHit._source.livestock_id) {
        weightedScore += cowHit._score * COW_WEIGHT;
      }
      totalWeight += COW_WEIGHT;
    } catch (err) {
      logger.warn('Cow embedding search failed, using muzzle only', err);
    }
  }

  // If body texture embedding available
  if (bodyTextureEmbedding) {
    try {
      const textureResult = await searchSimilarEmbeddings(bodyTextureEmbedding);
      const textureHit = textureResult.hits.hits[0];
      if (textureHit && textureHit._source.livestock_id === muzzleHit._source.livestock_id) {
        weightedScore += textureHit._score * TEXTURE_WEIGHT;
      }
      totalWeight += TEXTURE_WEIGHT;
    } catch (err) {
      logger.warn('Body texture embedding search failed, using muzzle only', err);
    }
  }

  // Normalize by actual weight used
  if (totalWeight > 0 && totalWeight < 1) {
    weightedScore = weightedScore / totalWeight;
  }

  return { bestMatch: muzzleHit, weightedScore };
}

async function storeNewEmbedding(livestockId: string, embedding: number[], imageKey: string): Promise<void> {
  const client = getOpenSearchClient();
  await client.index({
    index: OPENSEARCH_INDEX,
    id: livestockId,
    body: {
      livestock_id: livestockId,
      embedding,
      image_key: imageKey,
      enrolled_at: new Date().toISOString(),
    },
  });
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  logger.info('Received enrollment request', {
    requestId: event.requestContext.requestId,
  });

  if (event.httpMethod === 'OPTIONS') {
    return buildResponse(200, {}, ALLOWED_ORIGIN);
  }

  if (!event.body) {
    return buildErrorResponse(400, 'MISSING_BODY', 'Request body is required', ALLOWED_ORIGIN);
  }

  let body: {
    imageKey?: unknown;
    owner_id?: string;
    latitude?: number;
    longitude?: number;
    photo_key?: string;
    region_code?: string;
    cow_image_key?: string;
    body_texture_key?: string;
    session_id?: string;
    // Metadata for fraud scoring
    agent_id?: string;
    farmer_id?: string;
    ip_address?: string;
    device_fingerprint?: string;
    user_agent?: string;
    screen_resolution?: string;
    platform?: string;
    network_type?: string;
    gps_accuracy?: number;
    // Confidence scores from frontend detection
    confidence_scores?: {
      cow_detection?: number;
      muzzle_detection?: number;
      body_texture?: number;
    };
  };
  try {
    body = JSON.parse(event.body) as typeof body;
  } catch {
    return buildErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body', ALLOWED_ORIGIN);
  }

  if (!validateImageKey(body.imageKey)) {
    return buildErrorResponse(400, 'INVALID_IMAGE_KEY', 'Invalid or missing imageKey', ALLOWED_ORIGIN);
  }

  const imageKey = body.imageKey;

  if (!BUCKET_NAME || !SAGEMAKER_ENDPOINT || !OPENSEARCH_ENDPOINT) {
    logger.error('Missing required environment variables', {
      hasBucket: !!BUCKET_NAME,
      hasSagemaker: !!SAGEMAKER_ENDPOINT,
      hasOpenSearch: !!OPENSEARCH_ENDPOINT,
    });
    return buildErrorResponse(500, 'CONFIGURATION_ERROR', 'Server configuration error', ALLOWED_ORIGIN);
  }

  try {
    logger.info('Retrieving image from S3', { imageKey });
    const imageBuffer = await getImageFromS3(imageKey);

    logger.info('Generating muzzle embedding from SageMaker', { imageKey });
    const muzzleEmbedding = await getEmbeddingFromSageMaker(imageBuffer);

    // Generate additional embeddings if provided (for weighted search)
    let cowEmbedding: number[] | null = null;
    let bodyTextureEmbedding: number[] | null = null;

    if (body.cow_image_key) {
      try {
        logger.info('Generating cow body embedding', { cow_image_key: body.cow_image_key });
        const cowBuffer = await getImageFromS3(body.cow_image_key);
        cowEmbedding = await getEmbeddingFromSageMaker(cowBuffer);
      } catch (err) {
        logger.warn('Failed to generate cow embedding (non-fatal)', err);
      }
    }

    if (body.body_texture_key) {
      try {
        logger.info('Generating body texture embedding', { body_texture_key: body.body_texture_key });
        const textureBuffer = await getImageFromS3(body.body_texture_key);
        bodyTextureEmbedding = await getEmbeddingFromSageMaker(textureBuffer);
      } catch (err) {
        logger.warn('Failed to generate body texture embedding (non-fatal)', err);
      }
    }

    logger.info('Searching for similar embeddings (weighted)', {
      imageKey,
      hasCowEmbedding: !!cowEmbedding,
      hasTextureEmbedding: !!bodyTextureEmbedding,
    });

    // Use weighted similarity when extra embeddings are available
    const useWeighted = cowEmbedding || bodyTextureEmbedding;
    let topHit: OpenSearchHit | null = null;
    let similarity = 0;

    if (useWeighted) {
      const weighted = await searchWeightedSimilarity(muzzleEmbedding, cowEmbedding, bodyTextureEmbedding);
      topHit = weighted.bestMatch;
      similarity = weighted.weightedScore;
      logger.info('Weighted similarity result', { similarity, hasMatch: !!topHit });
    } else {
      const searchResult = await searchSimilarEmbeddings(muzzleEmbedding);
      topHit = searchResult.hits.hits[0] || null;
      similarity = topHit ? topHit._score : 0;
    }

    if (topHit && similarity >= SIMILARITY_THRESHOLD) {
      logger.info('Existing animal found', {
        livestock_id: topHit._source.livestock_id,
        similarity,
      });
      return buildResponse(
        200,
        {
          status: 'EXISTING',
          livestock_id: topHit._source.livestock_id,
          similarity,
          message: 'Animal already registered in the system',
        },
        ALLOWED_ORIGIN
      );
    }

    const newLivestockId = generateLivestockId();
    const embeddingId = `EMB-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const modelVersion = 'clip-vit-base-v1';
    logger.info('Enrolling new animal', { livestock_id: newLivestockId, embedding_id: embeddingId });

    await storeNewEmbedding(newLivestockId, muzzleEmbedding, imageKey);

    // Store additional embeddings for cow body and body texture (if available)
    if (cowEmbedding && body.cow_image_key) {
      try {
        const cowClient = getOpenSearchClient();
        await cowClient.index({
          index: OPENSEARCH_INDEX,
          id: `${newLivestockId}-cow`,
          body: {
            livestock_id: newLivestockId,
            embedding: cowEmbedding,
            image_key: body.cow_image_key,
            embedding_type: 'cow_body',
            enrolled_at: new Date().toISOString(),
          },
        });
        logger.info('Cow body embedding stored', { livestock_id: newLivestockId });
      } catch (err) {
        logger.warn('Failed to store cow embedding (non-fatal)', err);
      }
    }

    if (bodyTextureEmbedding && body.body_texture_key) {
      try {
        const textureClient = getOpenSearchClient();
        await textureClient.index({
          index: OPENSEARCH_INDEX,
          id: `${newLivestockId}-texture`,
          body: {
            livestock_id: newLivestockId,
            embedding: bodyTextureEmbedding,
            image_key: body.body_texture_key,
            embedding_type: 'body_texture',
            enrolled_at: new Date().toISOString(),
          },
        });
        logger.info('Body texture embedding stored', { livestock_id: newLivestockId });
      } catch (err) {
        logger.warn('Failed to store body texture embedding (non-fatal)', err);
      }
    }

    // ── Store embedding reference in DynamoDB embeddings table (per schema §3.2) ──
    try {
      await ddbClient.send(new PutCommand({
        TableName: EMBEDDINGS_TABLE,
        Item: {
          embedding_id: embeddingId,
          livestock_id: newLivestockId,
          model_version: modelVersion,
          created_at: new Date().toISOString(),
        },
      }));
      logger.info('Embedding record saved to DynamoDB', { embedding_id: embeddingId });
    } catch (embErr) {
      logger.warn('Failed to save embedding to DynamoDB (non-fatal)', embErr);
    }

    // ── Save animal to DynamoDB (per schema §3.1) ──
    const enrolledAt = new Date().toISOString();
    const animalItem: Record<string, unknown> = {
      livestock_id: newLivestockId,
      image_key: imageKey,
      muzzle_key: imageKey,        // muzzle ROI used for embedding
      embedding_id: embeddingId,
      embedding_version: modelVersion,
      enrollment_confidence_score: similarity || 0,
      biometric_type: 'muzzle_print',
      enrolled_at: enrolledAt,
      enrollment_timestamp: enrolledAt,
      species: 'cattle',
      status: 'active',
      created_at: enrolledAt,
      updated_at: enrolledAt,
    };
    // Attach optional fields from request body
    if (body.owner_id) {
      animalItem.owner_id = body.owner_id;
      animalItem.registered_by_user_id = body.owner_id;
    }
    if (typeof body.latitude === 'number') {
      animalItem.latitude = body.latitude;
      animalItem.enrollment_latitude = body.latitude;
    }
    if (typeof body.longitude === 'number') {
      animalItem.longitude = body.longitude;
      animalItem.enrollment_longitude = body.longitude;
    }
    if (body.photo_key) animalItem.photo_key = body.photo_key;
    if (body.region_code) animalItem.region_code = body.region_code;
    if (body.cow_image_key) animalItem.cow_image_key = body.cow_image_key;
    if (body.body_texture_key) animalItem.body_texture_key = body.body_texture_key;
    if (body.session_id) animalItem.enrollment_session_id = body.session_id;

    // Store confidence scores observed during enrollment
    if (body.confidence_scores) {
      animalItem.confidence_scores = body.confidence_scores;
    }

    try {
      await ddbClient.send(new PutCommand({
        TableName: ANIMALS_TABLE,
        Item: animalItem,
      }));
      logger.info('Animal record saved to DynamoDB', { livestock_id: newLivestockId });
    } catch (ddbErr) {
      // Non-fatal: OpenSearch enrollment succeeded, DynamoDB is supplementary
      logger.warn('Failed to save animal to DynamoDB (non-fatal)', ddbErr);
    }

    // ── Compute fraud risk score (async, non-fatal) ──
    try {
      // Gather agent stats for fraud scoring
      let agentEnrollmentsLastHour = 0;
      let deviceEnrollmentsToday = 0;
      let deviceUsedByOtherAgents = false;

      const agentId = body.agent_id || body.owner_id || 'unknown';
      const deviceFp = body.device_fingerprint || '';

      if (body.session_id && agentId !== 'unknown') {
        // Count agent enrollments in last hour
        try {
          const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
          const agentSessions = await ddbClient.send(new QueryCommand({
            TableName: ENROLLMENT_SESSIONS_TABLE,
            IndexName: 'agent-index',
            KeyConditionExpression: 'agent_id = :aid',
            FilterExpression: 'started_at > :h AND #s = :completed',
            ExpressionAttributeNames: { '#s': 'status' },
            ExpressionAttributeValues: {
              ':aid': agentId,
              ':h': hourAgo,
              ':completed': 'completed',
            },
            Select: 'COUNT',
          }));
          agentEnrollmentsLastHour = agentSessions.Count || 0;
        } catch { /* non-fatal */ }

        // Check device fingerprint reuse
        if (deviceFp) {
          try {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const deviceSessions = await ddbClient.send(new ScanCommand({
              TableName: ENROLLMENT_SESSIONS_TABLE,
              FilterExpression: 'contains(metadata.device_info.fingerprint, :fp) AND started_at > :today',
              ExpressionAttributeValues: {
                ':fp': deviceFp,
                ':today': todayStart.toISOString(),
              },
            }));
            deviceEnrollmentsToday = deviceSessions.Count || 0;
            // Check if different agents used this device
            const agentIds = new Set((deviceSessions.Items || []).map(i => i.agent_id));
            deviceUsedByOtherAgents = agentIds.size > 1;
          } catch { /* non-fatal */ }
        }
      }

      const fraudInput: FraudInput = {
        session_id: body.session_id || `NOSESS-${newLivestockId}`,
        agent_id: agentId,
        farmer_id: body.farmer_id || body.owner_id || 'unknown',
        embedding_similarity: similarity || 0,
        confidence_scores: body.confidence_scores || {},
        metadata: {
          ip_address: body.ip_address || event.requestContext?.identity?.sourceIp,
          device_fingerprint: deviceFp,
          user_agent: body.user_agent || event.headers?.['User-Agent'],
          screen_resolution: body.screen_resolution,
          platform: body.platform,
          gps_latitude: body.latitude,
          gps_longitude: body.longitude,
          gps_accuracy: body.gps_accuracy,
          network_type: body.network_type,
          timestamp: enrolledAt,
        },
        agent_enrollments_last_hour: agentEnrollmentsLastHour,
        device_enrollments_today: deviceEnrollmentsToday,
        device_used_by_other_agents: deviceUsedByOtherAgents,
      };

      const fraudScore = computeFraudRiskScore(fraudInput);

      // Store fraud score in dedicated table
      await ddbClient.send(new PutCommand({
        TableName: FRAUD_SCORES_TABLE,
        Item: {
          livestock_id: newLivestockId,
          session_id: body.session_id || null,
          agent_id: agentId,
          farmer_id: body.farmer_id || body.owner_id || null,
          ...fraudScore,
          metadata: fraudInput.metadata,
          confidence_scores: body.confidence_scores || null,
          created_at: enrolledAt,
        },
      }));
      logger.info('Fraud score computed and stored', {
        livestock_id: newLivestockId,
        fraud_risk_score: fraudScore.fraud_risk_score,
        risk_level: fraudScore.risk_level,
        flags_count: fraudScore.flags.length,
      });
    } catch (fraudErr) {
      logger.warn('Failed to compute/store fraud score (non-fatal)', fraudErr);
    }

    return buildResponse(
      201,
      {
        status: 'NEW',
        livestock_id: newLivestockId,
        similarity: similarity || 0,
        message: 'Animal successfully enrolled',
      },
      ALLOWED_ORIGIN
    );
  } catch (err) {
    logger.error('Enrollment failed', err);
    if (err instanceof Error && (err.message.includes('ECONNREFUSED') || err.message.includes('ETIMEDOUT') || err.name === 'ConnectionError' || err.name === 'TimeoutError')) {
      return buildErrorResponse(503, 'OPENSEARCH_UNAVAILABLE', 'Search service is temporarily unavailable', ALLOWED_ORIGIN);
    }
    const message = err instanceof Error ? err.message : 'Enrollment failed';
    return buildErrorResponse(500, 'ENROLLMENT_ERROR', message, ALLOWED_ORIGIN);
  }
}
