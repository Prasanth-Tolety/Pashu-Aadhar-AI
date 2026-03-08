/**
 * clear-tables.mjs — Removes all seed data from DynamoDB tables.
 *
 * Only removes items with seed-identifiable keys (OWN-SEED-, PA-, etc.).
 * Usage: npm run clear
 *
 * ⚠️ WARNING: This deletes data. Use with caution.
 *   Set CLEAR_ALL=true to wipe ALL items (not just seeded ones).
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

const REGION = process.env.AWS_REGION || 'us-east-1';
const CLEAR_ALL = process.env.CLEAR_ALL === 'true';

const ddbClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
  { marshallOptions: { removeUndefinedValues: true } }
);

const TABLE_CONFIGS = [
  { name: 'animals', pk: 'livestock_id' },
  { name: 'owners', pk: 'owner_id' },
  { name: 'user_role_mapping', pk: 'mapping_id' },
  { name: 'embeddings', pk: 'embedding_id' },
  { name: 'health_records', pk: 'record_id' },
  { name: 'milk_yields', pk: 'yield_id' },
  { name: 'insurance_policies', pk: 'policy_id' },
  { name: 'loan_collateral', pk: 'loan_id' },
  { name: 'enrollment_requests', pk: 'request_id' },
  { name: 'enrollment_sessions', pk: 'session_id' },
  { name: 'enrollment_agents', pk: 'agent_id' },
  { name: 'fraud_scores', pk: 'livestock_id' },
  { name: 'access_requests', pk: 'request_id' },
];

async function clearTable(tableName, pk) {
  console.log(`  Scanning ${tableName}...`);
  let lastKey;
  let deleted = 0;

  do {
    const result = await ddbClient.send(new ScanCommand({
      TableName: tableName,
      ProjectionExpression: pk,
      ExclusiveStartKey: lastKey,
    }));

    const items = result.Items || [];
    lastKey = result.LastEvaluatedKey;

    // Filter to only seed items if not CLEAR_ALL
    const toDelete = CLEAR_ALL
      ? items
      : items.filter(item => {
          const key = item[pk];
          return (
            typeof key === 'string' &&
            (key.startsWith('PA-') || key.startsWith('OWN-SEED-') || key.startsWith('OWN-AGENT-') ||
             key.startsWith('OWN-VET-') || key.startsWith('OWN-INS-') ||
             key.startsWith('MAP-AGENT-') || key.startsWith('MAP-FRM-') ||
             key.startsWith('MAP-VETERINARIAN-') || key.startsWith('MAP-INSURER-') ||
             key.startsWith('EMB-') || key.startsWith('HR-') || key.startsWith('MY-') ||
             key.startsWith('INS-') || key.startsWith('LN-') || key.startsWith('ENR-') ||
             key.startsWith('SES-') || key.startsWith('AR-') ||
             key.startsWith('seed-'))
          );
        });

    // Batch delete (max 25)
    for (let i = 0; i < toDelete.length; i += 25) {
      const batch = toDelete.slice(i, i + 25).map(item => ({
        DeleteRequest: { Key: { [pk]: item[pk] } },
      }));

      if (batch.length > 0) {
        await ddbClient.send(new BatchWriteCommand({
          RequestItems: { [tableName]: batch },
        }));
        deleted += batch.length;
      }
    }
  } while (lastKey);

  console.log(`    Deleted ${deleted} items from ${tableName}`);
  return deleted;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   Pashu Aadhaar AI — Clear Seed Data                    ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log();

  if (CLEAR_ALL) {
    console.log('⚠️  CLEAR_ALL mode — will delete ALL items from all tables!\n');
  } else {
    console.log('🧹 Removing seed-generated items only...\n');
  }

  let totalDeleted = 0;

  for (const { name, pk } of TABLE_CONFIGS) {
    try {
      const count = await clearTable(name, pk);
      totalDeleted += count;
    } catch (err) {
      console.log(`    ⚠️ Skipping ${name}: ${err.message}`);
    }
  }

  console.log(`\n✅ Done. Total items deleted: ${totalDeleted}`);
}

main().catch(err => {
  console.error('\n❌ Clear failed:', err);
  process.exit(1);
});
