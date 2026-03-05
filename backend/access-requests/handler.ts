import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  GetCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { createLogger, buildResponse, buildErrorResponse } from '../shared/utils';

const logger = createLogger('access-requests');
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

const ddbClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' })
);

const ACCESS_REQUESTS_TABLE = 'access_requests';
const ANIMALS_TABLE = 'animals';

function generateRequestId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `AR-${ts}-${rand}`;
}

function extractClaims(event: APIGatewayProxyEvent) {
  const claims = event.requestContext?.authorizer?.claims;
  if (!claims) return null;
  return {
    userId: claims.sub as string,
    role: (claims['custom:role'] as string) || 'farmer',
    name: claims.name as string,
  };
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  logger.info('Access request', { method: event.httpMethod, path: event.path, resource: event.resource });

  if (event.httpMethod === 'OPTIONS') {
    return buildResponse(200, {}, ALLOWED_ORIGIN);
  }

  const claimsData = extractClaims(event);
  if (!claimsData) {
    return buildErrorResponse(401, 'UNAUTHORIZED', 'No auth claims found', ALLOWED_ORIGIN);
  }

  const { userId, role, name } = claimsData;
  const path = event.path;

  try {
    // ─── POST /access-requests → create a new access request ───
    if (event.httpMethod === 'POST' && (path === '/access-requests' || path.endsWith('/access-requests'))) {
      if (!event.body) {
        return buildErrorResponse(400, 'MISSING_BODY', 'Request body is required', ALLOWED_ORIGIN);
      }

      const body = JSON.parse(event.body) as { livestock_id?: string; reason?: string };
      if (!body.livestock_id) {
        return buildErrorResponse(400, 'MISSING_FIELD', 'livestock_id is required', ALLOWED_ORIGIN);
      }

      // Look up the animal to get owner_id
      const animalResult = await ddbClient.send(new GetCommand({
        TableName: ANIMALS_TABLE,
        Key: { livestock_id: body.livestock_id },
      }));
      if (!animalResult.Item) {
        return buildErrorResponse(404, 'NOT_FOUND', 'Animal not found', ALLOWED_ORIGIN);
      }

      const ownerId = animalResult.Item.owner_id;
      if (!ownerId) {
        return buildErrorResponse(400, 'NO_OWNER', 'Animal has no registered owner', ALLOWED_ORIGIN);
      }

      const requestId = generateRequestId();
      const now = new Date().toISOString();

      await ddbClient.send(new PutCommand({
        TableName: ACCESS_REQUESTS_TABLE,
        Item: {
          request_id: requestId,
          livestock_id: body.livestock_id,
          requester_id: userId,
          requester_role: role,
          requester_name: name,
          owner_id: ownerId,
          reason: body.reason || '',
          status: 'pending',
          created_at: now,
          updated_at: now,
        },
      }));

      logger.info('Access request created', { request_id: requestId });
      return buildResponse(201, { request_id: requestId, status: 'pending' }, ALLOWED_ORIGIN);
    }

    // ─── GET /access-requests/incoming → requests TO the current user (owner) ───
    if (event.httpMethod === 'GET' && path.includes('/incoming')) {
      const result = await ddbClient.send(new QueryCommand({
        TableName: ACCESS_REQUESTS_TABLE,
        IndexName: 'owner-index',
        KeyConditionExpression: 'owner_id = :oid',
        ExpressionAttributeValues: { ':oid': userId },
        ScanIndexForward: false,
      }));

      return buildResponse(200, { requests: result.Items || [] }, ALLOWED_ORIGIN);
    }

    // ─── GET /access-requests/animals → animals accessible via approved requests ───
    if (event.httpMethod === 'GET' && path.includes('/animals')) {
      const result = await ddbClient.send(new QueryCommand({
        TableName: ACCESS_REQUESTS_TABLE,
        IndexName: 'requester-index',
        KeyConditionExpression: 'requester_id = :rid',
        ExpressionAttributeValues: { ':rid': userId },
        ScanIndexForward: false,
      }));

      const approved = (result.Items || []).filter((i) => i.status === 'approved');
      const animalIds = approved.map((i) => i.livestock_id);

      // Fetch each animal's details
      const animals = [];
      for (const lid of animalIds) {
        try {
          const animalRes = await ddbClient.send(new GetCommand({
            TableName: ANIMALS_TABLE,
            Key: { livestock_id: lid },
          }));
          if (animalRes.Item) animals.push(animalRes.Item);
        } catch {
          // Skip unavailable
        }
      }

      return buildResponse(200, { animals }, ALLOWED_ORIGIN);
    }

    // ─── GET /access-requests → my outgoing requests ───
    if (event.httpMethod === 'GET') {
      const result = await ddbClient.send(new QueryCommand({
        TableName: ACCESS_REQUESTS_TABLE,
        IndexName: 'requester-index',
        KeyConditionExpression: 'requester_id = :rid',
        ExpressionAttributeValues: { ':rid': userId },
        ScanIndexForward: false,
      }));

      return buildResponse(200, { requests: result.Items || [] }, ALLOWED_ORIGIN);
    }

    // ─── POST /access-requests/{id}/resolve → approve or deny ───
    if (event.httpMethod === 'POST' && event.pathParameters?.id) {
      const requestId = event.pathParameters.id;
      if (!event.body) {
        return buildErrorResponse(400, 'MISSING_BODY', 'Request body is required', ALLOWED_ORIGIN);
      }

      const body = JSON.parse(event.body) as { action?: string };
      if (!body.action || !['approve', 'deny'].includes(body.action)) {
        return buildErrorResponse(400, 'INVALID_ACTION', 'action must be "approve" or "deny"', ALLOWED_ORIGIN);
      }

      // Verify the current user owns this request
      const existing = await ddbClient.send(new GetCommand({
        TableName: ACCESS_REQUESTS_TABLE,
        Key: { request_id: requestId },
      }));
      if (!existing.Item) {
        return buildErrorResponse(404, 'NOT_FOUND', 'Access request not found', ALLOWED_ORIGIN);
      }
      if (existing.Item.owner_id !== userId) {
        return buildErrorResponse(403, 'FORBIDDEN', 'Only the animal owner can resolve this request', ALLOWED_ORIGIN);
      }

      const newStatus = body.action === 'approve' ? 'approved' : 'denied';
      await ddbClient.send(new UpdateCommand({
        TableName: ACCESS_REQUESTS_TABLE,
        Key: { request_id: requestId },
        UpdateExpression: 'SET #s = :s, updated_at = :u',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':s': newStatus,
          ':u': new Date().toISOString(),
        },
      }));

      logger.info('Access request resolved', { request_id: requestId, status: newStatus });
      return buildResponse(200, { request_id: requestId, status: newStatus }, ALLOWED_ORIGIN);
    }

    return buildErrorResponse(400, 'BAD_REQUEST', 'Unsupported operation', ALLOWED_ORIGIN);
  } catch (err) {
    logger.error('Access request error', err);
    const message = err instanceof Error ? err.message : 'Internal error';
    return buildErrorResponse(500, 'INTERNAL_ERROR', message, ALLOWED_ORIGIN);
  }
}
