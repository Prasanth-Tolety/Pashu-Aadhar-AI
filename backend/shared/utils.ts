import { APIGatewayProxyResult } from 'aws-lambda';

export interface Logger {
  info: (message: string, data?: unknown) => void;
  error: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
}

export function createLogger(context: string): Logger {
  return {
    info: (message: string, data?: unknown) => {
      console.log(JSON.stringify({ level: 'INFO', context, message, data, timestamp: new Date().toISOString() }));
    },
    error: (message: string, data?: unknown) => {
      console.error(JSON.stringify({ level: 'ERROR', context, message, data, timestamp: new Date().toISOString() }));
    },
    warn: (message: string, data?: unknown) => {
      console.warn(JSON.stringify({ level: 'WARN', context, message, data, timestamp: new Date().toISOString() }));
    },
  };
}

export function buildResponse(
  statusCode: number,
  body: unknown,
  allowedOrigin = '*'
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

export function buildErrorResponse(
  statusCode: number,
  error: string,
  message: string,
  allowedOrigin = '*'
): APIGatewayProxyResult {
  return buildResponse(statusCode, { error, message, statusCode }, allowedOrigin);
}

export function validateImageKey(imageKey: unknown): imageKey is string {
  if (typeof imageKey !== 'string' || imageKey.trim().length === 0) {
    return false;
  }
  // Allow only alphanumeric, dashes, underscores, dots, and forward slashes
  const safeKeyPattern = /^[\w\-./]+$/;
  return safeKeyPattern.test(imageKey) && imageKey.length <= 1024;
}

export function validateFileName(fileName: unknown): fileName is string {
  if (typeof fileName !== 'string' || fileName.trim().length === 0) {
    return false;
  }
  const safeNamePattern = /^[\w\-. ]+\.(jpg|jpeg|png|webp|heic|webm|mp4)$/i;
  return safeNamePattern.test(fileName) && fileName.length <= 255;
}

export function validateContentType(contentType: unknown): contentType is string {
  const allowed = [
    'image/jpeg', 'image/png', 'image/webp', 'image/heic',
    'video/webm', 'video/mp4',
  ];
  return typeof contentType === 'string' && allowed.includes(contentType);
}

export function generateLivestockId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `PA-${timestamp}-${random}`;
}
