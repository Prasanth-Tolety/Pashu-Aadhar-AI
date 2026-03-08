import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
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
 * POST /me → updates owner profile in DynamoDB
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

    // ─── POST /me → update profile ───────────────────────
    if (event.httpMethod === 'POST') {
      if (!event.body) {
        return buildErrorResponse(400, 'MISSING_BODY', 'Request body is required', ALLOWED_ORIGIN);
      }

      const updates = JSON.parse(event.body) as Record<string, unknown>;

      // Determine the owner_id — use Cognito claim or derive from userId
      const effectiveOwnerId = ownerId || `OWN-${userId.substring(0, 8)}`;

      // Check if owner record exists
      const existingOwner = await ddbClient.send(new GetCommand({
        TableName: OWNERS_TABLE,
        Key: { owner_id: effectiveOwnerId },
      }));

      // Allowlisted fields that can be updated
      const allowed = ['name', 'aadhaar_last4', 'village', 'district', 'state', 'pincode'];

      if (!existingOwner.Item) {
        // Create new owner record if it doesn't exist
        const ownerItem: Record<string, unknown> = {
          owner_id: effectiveOwnerId,
          user_id: userId,
          phone_number: phoneNumber,
          name: name || '',
          role: role || 'farmer',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        for (const key of allowed) {
          if (updates[key] !== undefined) {
            ownerItem[key] = updates[key];
          }
        }
        await ddbClient.send(new PutCommand({
          TableName: OWNERS_TABLE,
          Item: ownerItem,
        }));
        logger.info('Owner record created via profile update', { owner_id: effectiveOwnerId });
        return buildResponse(200, { message: 'Profile created', owner: ownerItem }, ALLOWED_ORIGIN);
      }

      // Build update expression dynamically to only update provided fields
      const expressionParts: string[] = ['#updated_at = :updated_at'];
      const exprNames: Record<string, string> = { '#updated_at': 'updated_at' };
      const exprValues: Record<string, unknown> = { ':updated_at': new Date().toISOString() };

      for (const key of allowed) {
        if (updates[key] !== undefined) {
          const placeholder = `#${key}`;
          const valuePlaceholder = `:${key}`;
          expressionParts.push(`${placeholder} = ${valuePlaceholder}`);
          exprNames[placeholder] = key;
          exprValues[valuePlaceholder] = updates[key];
        }
      }

      await ddbClient.send(new UpdateCommand({
        TableName: OWNERS_TABLE,
        Key: { owner_id: effectiveOwnerId },
        UpdateExpression: `SET ${expressionParts.join(', ')}`,
        ExpressionAttributeNames: exprNames,
        ExpressionAttributeValues: exprValues,
        ReturnValues: 'ALL_NEW',
      }));

      logger.info('Profile updated', { owner_id: effectiveOwnerId });
      return buildResponse(200, { message: 'Profile updated', owner_id: effectiveOwnerId }, ALLOWED_ORIGIN);
    }

    // ─── GET /me → fetch profile ─────────────────────────
    // Build profile from Cognito claims
    const effectiveOwnerId = ownerId || `OWN-${userId.substring(0, 8)}`;
    const profile: Record<string, unknown> = {
      user_id: userId,
      phone_number: phoneNumber,
      name,
      role: role || 'farmer',
      owner_id: effectiveOwnerId,
    };

    // Fetch owner details from DynamoDB
    try {
      const ownerResult = await ddbClient.send(new GetCommand({
        TableName: OWNERS_TABLE,
        Key: { owner_id: effectiveOwnerId },
      }));
      if (ownerResult.Item) {
        profile.owner = ownerResult.Item;
        profile.created_at = ownerResult.Item.created_at;
        // Use DynamoDB name/role if present (more up-to-date)
        if (ownerResult.Item.name) profile.name = ownerResult.Item.name;
        if (ownerResult.Item.aadhaar_last4) profile.aadhaar_last4 = ownerResult.Item.aadhaar_last4;
      }
    } catch (err) {
      logger.warn('Failed to fetch owner record', err);
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
