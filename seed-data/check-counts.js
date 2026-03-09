// check-counts.js — CommonJS version for quick DynamoDB count check
const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
const client = new DynamoDBClient({ region: 'us-east-1' });

const TABLES = [
  'animals', 'owners', 'embeddings', 'enrollment_sessions',
  'enrollment_requests', 'fraud_scores', 'health_records',
  'milk_yields', 'insurance_policies', 'loan_collateral',
  'access_requests', 'enrollment_agents', 'user_role_mapping',
];

async function main() {
  const results = await Promise.all(
    TABLES.map(async (t) => {
      try {
        const r = await client.send(new ScanCommand({ TableName: t, Select: 'COUNT' }));
        return { table: t, count: r.Count };
      } catch (e) {
        return { table: t, count: 'ERR: ' + e.message.slice(0, 60) };
      }
    })
  );
  console.log('=== DynamoDB Table Counts ===');
  for (const r of results) {
    console.log('  ' + r.table.padEnd(25) + ' ' + r.count);
  }
  console.log('============================');
}

main();
