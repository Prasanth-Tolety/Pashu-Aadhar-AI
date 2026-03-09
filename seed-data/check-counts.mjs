// check-counts.mjs — Quick DynamoDB table count checker
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({ region: 'us-east-1' });

const TABLES = [
  'animals', 'owners', 'embeddings', 'enrollment_sessions',
  'enrollment_requests', 'fraud_scores', 'health_records',
  'milk_yields', 'insurance_policies', 'loan_collateral',
  'access_requests', 'enrollment_agents', 'user_role_mapping',
];

async function countTable(tableName) {
  try {
    const res = await client.send(new ScanCommand({ TableName: tableName, Select: 'COUNT' }));
    return res.Count;
  } catch (e) {
    return `ERR: ${e.message}`;
  }
}

async function main() {
  console.log('=== DynamoDB Table Counts ===');
  for (const t of TABLES) {
    const c = await countTable(t);
    console.log(`  ${t.padEnd(25)} ${c}`);
  }
  console.log('============================');
}

main();
