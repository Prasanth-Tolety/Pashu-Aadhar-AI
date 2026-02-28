import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { SageMakerRuntimeClient, InvokeEndpointCommand } from '@aws-sdk/client-sagemaker-runtime';
import { Client as OpenSearchClient } from '@opensearch-project/opensearch';
import {
  createLogger,
  buildResponse,
  buildErrorResponse,
  validateImageKey,
  generateLivestockId,
} from '../shared/utils';

const logger = createLogger('enroll');

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const sagemakerClient = new SageMakerRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

const BUCKET_NAME = process.env.S3_BUCKET_NAME!;
const SAGEMAKER_ENDPOINT = process.env.SAGEMAKER_ENDPOINT_NAME!;
const OPENSEARCH_ENDPOINT = process.env.OPENSEARCH_ENDPOINT!;
const OPENSEARCH_INDEX = process.env.OPENSEARCH_INDEX || 'livestock-embeddings';
const SIMILARITY_THRESHOLD = parseFloat(process.env.SIMILARITY_THRESHOLD || '0.85');
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

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
    node: OPENSEARCH_ENDPOINT,
  });
}

async function getImageFromS3(imageKey: string): Promise<Buffer> {
  const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: imageKey });
  const response = await s3Client.send(command);
  if (!response.Body) {
    throw new Error('Empty response body from S3');
  }
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
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
  const parsed = JSON.parse(responseText) as { embedding: number[] };
  if (!Array.isArray(parsed.embedding)) {
    throw new Error('Invalid embedding response from SageMaker');
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

  let body: { imageKey?: unknown };
  try {
    body = JSON.parse(event.body) as { imageKey?: unknown };
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
    const message = err instanceof Error ? err.message : 'Enrollment failed';
    return buildErrorResponse(500, 'ENROLLMENT_ERROR', message, ALLOWED_ORIGIN);
  }
}
