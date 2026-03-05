import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { SageMakerRuntimeClient, InvokeEndpointCommand } from '@aws-sdk/client-sagemaker-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
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

  let body: { imageKey?: unknown; owner_id?: string; latitude?: number; longitude?: number };
  try {
    body = JSON.parse(event.body) as { imageKey?: unknown; owner_id?: string; latitude?: number; longitude?: number };
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

    logger.info('Generating embedding from SageMaker', { imageKey });
    const embedding = await getEmbeddingFromSageMaker(imageBuffer);

    logger.info('Searching for similar embeddings in OpenSearch', { imageKey });
    const searchResult = await searchSimilarEmbeddings(embedding);

    const topHit = searchResult.hits.hits[0];
    const similarity = topHit ? topHit._score : 0;

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
    logger.info('Enrolling new animal', { livestock_id: newLivestockId });

    await storeNewEmbedding(newLivestockId, embedding, imageKey);

    // Also save to DynamoDB animals table
    const enrolledAt = new Date().toISOString();
    const animalItem: Record<string, unknown> = {
      livestock_id: newLivestockId,
      image_key: imageKey,
      enrolled_at: enrolledAt,
      species: 'cattle',
      status: 'active',
    };
    // Attach optional fields from request body
    if (body.owner_id) animalItem.owner_id = body.owner_id;
    if (typeof body.latitude === 'number') animalItem.latitude = body.latitude;
    if (typeof body.longitude === 'number') animalItem.longitude = body.longitude;

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
