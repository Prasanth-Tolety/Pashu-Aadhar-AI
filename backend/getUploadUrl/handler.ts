import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createLogger, buildResponse, buildErrorResponse, validateFileName, validateContentType } from '../shared/utils';

const logger = createLogger('getUploadUrl');

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

const BUCKET_NAME = process.env.S3_BUCKET_NAME!;
const PRESIGNED_URL_EXPIRY_SECONDS = 300; // 5 minutes
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  logger.info('Received get-upload-url request', {
    queryParams: event.queryStringParameters,
    requestId: event.requestContext.requestId,
  });

  if (event.httpMethod === 'OPTIONS') {
    return buildResponse(200, {}, ALLOWED_ORIGIN);
  }

  const fileName = event.queryStringParameters?.fileName;
  const contentType = event.queryStringParameters?.contentType;

  if (!validateFileName(fileName)) {
    logger.warn('Invalid fileName', { fileName });
    return buildErrorResponse(400, 'INVALID_INPUT', 'Invalid or missing fileName parameter', ALLOWED_ORIGIN);
  }

  if (!validateContentType(contentType)) {
    logger.warn('Invalid contentType', { contentType });
    return buildErrorResponse(
      400,
      'INVALID_CONTENT_TYPE',
      'Invalid content type. Only JPEG, PNG, WebP, and HEIC images are allowed.',
      ALLOWED_ORIGIN
    );
  }

  if (!BUCKET_NAME) {
    logger.error('S3_BUCKET_NAME environment variable is not configured');
    return buildErrorResponse(500, 'CONFIGURATION_ERROR', 'Server configuration error', ALLOWED_ORIGIN);
  }

  try {
    const imageKey = `uploads/${Date.now()}-${fileName.replace(/\s+/g, '_')}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: imageKey,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: PRESIGNED_URL_EXPIRY_SECONDS,
    });

    logger.info('Generated presigned URL', { imageKey });

    return buildResponse(200, { uploadUrl, imageKey }, ALLOWED_ORIGIN);
  } catch (err) {
    logger.error('Failed to generate presigned URL', err);
    return buildErrorResponse(500, 'INTERNAL_ERROR', 'Failed to generate upload URL', ALLOWED_ORIGIN);
  }
}
