import { PostConfirmationTriggerEvent, Context, Callback } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { CognitoIdentityProviderClient, AdminUpdateUserAttributesCommand } from '@aws-sdk/client-cognito-identity-provider';

const REGION = process.env.AWS_REGION || 'us-east-1';
const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });

const OWNERS_TABLE = 'owners';
const USER_ROLE_MAPPING_TABLE = 'user_role_mapping';

/**
 * Cognito Post-Confirmation trigger.
 * Fires after a user successfully verifies their phone number (OTP).
 * Creates an owner record in DynamoDB, a role mapping, and writes the owner_id back to Cognito.
 */
export async function handler(
  event: PostConfirmationTriggerEvent,
  _context: Context,
  callback: Callback
): Promise<PostConfirmationTriggerEvent> {
  console.log('PostConfirmation trigger fired', JSON.stringify(event, null, 2));

  try {
    const userId = event.request.userAttributes.sub;
    const phoneNumber = event.request.userAttributes.phone_number || '';
    const name = event.request.userAttributes.name || '';
    const role = event.request.userAttributes['custom:role'] || 'farmer';
    const aadhaarLast4 = event.request.userAttributes['custom:aadhaar_last4'] || '';

    // Generate owner_id from the sub (first 8 chars)
    const ownerId = `OWN-${userId.substring(0, 8)}`;

    // Check if owner record already exists (idempotency)
    const existing = await ddbClient.send(new GetCommand({
      TableName: OWNERS_TABLE,
      Key: { owner_id: ownerId },
    }));

    if (!existing.Item) {
      // Create owner record in DynamoDB
      const ownerItem: Record<string, unknown> = {
        owner_id: ownerId,
        user_id: userId,
        phone_number: phoneNumber,
        name: name,
        role: role,
        created_at: new Date().toISOString(),
      };

      if (aadhaarLast4) {
        ownerItem.aadhaar_last4 = aadhaarLast4;
      }

      await ddbClient.send(new PutCommand({
        TableName: OWNERS_TABLE,
        Item: ownerItem,
      }));
      console.log('Owner record created in DynamoDB', { owner_id: ownerId });
    } else {
      console.log('Owner record already exists', { owner_id: ownerId });
    }

    // Create user_role_mapping entry
    const mappingId = `MAP-${userId.substring(0, 8)}`;
    try {
      await ddbClient.send(new PutCommand({
        TableName: USER_ROLE_MAPPING_TABLE,
        Item: {
          mapping_id: mappingId,
          user_id: userId,
          role: role,
          owner_id: ownerId,
          created_at: new Date().toISOString(),
        },
        ConditionExpression: 'attribute_not_exists(mapping_id)',
      }));
      console.log('User role mapping created', { mapping_id: mappingId });
    } catch (mapErr: unknown) {
      // ConditionalCheckFailedException means it already exists — that's fine
      const errName = (mapErr as { name?: string })?.name;
      if (errName !== 'ConditionalCheckFailedException') {
        console.warn('Failed to create user role mapping (non-fatal)', mapErr);
      }
    }

    // Write the owner_id back to Cognito custom attribute
    try {
      await cognitoClient.send(new AdminUpdateUserAttributesCommand({
        UserPoolId: event.userPoolId,
        Username: event.userName,
        UserAttributes: [
          { Name: 'custom:owner_id', Value: ownerId },
        ],
      }));
      console.log('Cognito custom:owner_id updated', { owner_id: ownerId });
    } catch (cognitoErr) {
      console.warn('Failed to update Cognito owner_id (non-fatal)', cognitoErr);
    }

    callback(null, event);
    return event;
  } catch (err) {
    console.error('PostConfirmation trigger error', err);
    // Don't block the signup — just log the error
    callback(null, event);
    return event;
  }
}
