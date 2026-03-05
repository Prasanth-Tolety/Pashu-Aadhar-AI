import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { createLogger, buildResponse, buildErrorResponse } from '../shared/utils';

const logger = createLogger('profile');
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

const ddbClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' })
);

const OWNERS_TABLE = 'owners';
const USER_ROLE_MAPPING_TABLE = 'user_role_mapping';

/**
 * GET /me  → returns user profile from Cognito claims + DynamoDB owner record
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  logger.info('Profile request', { method: event.httpMethod, path: event.path });

  if (event.httpMethod === 'OPTIONS') {
    return buildResponse(200, {}, ALLOWED_ORIGIN);
  }

  try {
    // Extract claims from Cognito authorizer
    const claims = event.requestContext?.authorizer?.claims;
    if (!claims) {
      return buildErrorResponse(401, 'UNAUTHORIZED', 'No auth claims found', ALLOWED_ORIGIN);
    }

    const userId = claims.sub as string;
    const phoneNumber = claims.phone_number as string;
    const name = claims.name as string;
    const role = claims['custom:role'] as string;
    const ownerId = claims['custom:owner_id'] as string;

    // Build profile from Cognito claims
    const profile: Record<string, unknown> = {
      user_id: userId,
      phone_number: phoneNumber,
      name,
      role: role || 'farmer',
      owner_id: ownerId || null,
    };

    // If owner_id exists, fetch owner details from DynamoDB
    if (ownerId) {
      try {
        const ownerResult = await ddbClient.send(new GetCommand({
          TableName: OWNERS_TABLE,
          Key: { owner_id: ownerId },
        }));
        if (ownerResult.Item) {
          profile.owner = ownerResult.Item;
        }
      } catch (err) {
        logger.warn('Failed to fetch owner record', err);
      }
    }

    // If user has a role mapping, fetch it
    try {
      const roleResult = await ddbClient.send(new QueryCommand({
        TableName: USER_ROLE_MAPPING_TABLE,
        IndexName: 'user-role-index',
        KeyConditionExpression: 'user_id = :uid',
        ExpressionAttributeValues: { ':uid': userId },
      }));
      if (roleResult.Items && roleResult.Items.length > 0) {
        profile.role_mappings = roleResult.Items;
      }
    } catch (err) {
      logger.warn('Failed to fetch role mappings', err);
    }

    return buildResponse(200, { profile }, ALLOWED_ORIGIN);
  } catch (err) {
    logger.error('Profile API error', err);
    const message = err instanceof Error ? err.message : 'Internal error';
    return buildErrorResponse(500, 'INTERNAL_ERROR', message, ALLOWED_ORIGIN);
  }
}
