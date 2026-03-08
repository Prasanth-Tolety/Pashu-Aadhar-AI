/**
 * randomize-states.mjs — Update existing animals in DynamoDB with
 * random (weighted) Indian states. Does NOT delete or recreate data.
 *
 * Usage:
 *   node randomize-states.mjs
 *   DRY_RUN=true node randomize-states.mjs
 */

import { DynamoDBClient, ScanCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

const REGION = process.env.AWS_REGION || 'us-east-1';
const DRY_RUN = process.env.DRY_RUN === 'true';
const client = new DynamoDBClient({ region: REGION });

// Weighted state distribution — higher weights = more animals
// Reflects real-life cattle concentration across Indian states
const STATE_WEIGHTS = [
  { state: 'Rajasthan',       weight: 18 },
  { state: 'Uttar Pradesh',   weight: 16 },
  { state: 'Madhya Pradesh',  weight: 14 },
  { state: 'Gujarat',         weight: 10 },
  { state: 'Maharashtra',     weight: 10 },
  { state: 'Bihar',           weight: 8 },
  { state: 'Karnataka',       weight: 7 },
  { state: 'Andhra Pradesh',  weight: 6 },
  { state: 'Tamil Nadu',      weight: 6 },
  { state: 'Haryana',         weight: 6 },
  { state: 'Punjab',          weight: 5 },
  { state: 'West Bengal',     weight: 5 },
  { state: 'Telangana',       weight: 5 },
  { state: 'Odisha',          weight: 4 },
  { state: 'Jharkhand',       weight: 4 },
  { state: 'Chhattisgarh',    weight: 3 },
  { state: 'Uttarakhand',     weight: 3 },
  { state: 'Kerala',          weight: 2 },
  { state: 'Himachal Pradesh', weight: 2 },
  { state: 'Assam',           weight: 2 },
  { state: 'Jammu and Kashmir', weight: 1 },
  { state: 'Goa',             weight: 1 },
  { state: 'Sikkim',          weight: 1 },
  { state: 'Meghalaya',       weight: 1 },
  { state: 'Tripura',         weight: 1 },
  { state: 'Arunachal Pradesh', weight: 1 },
  { state: 'Nagaland',        weight: 1 },
  { state: 'Manipur',         weight: 1 },
  { state: 'Mizoram',         weight: 1 },
];

// Build cumulative distribution
const totalWeight = STATE_WEIGHTS.reduce((sum, sw) => sum + sw.weight, 0);
const cdf = [];
let cumulative = 0;
for (const sw of STATE_WEIGHTS) {
  cumulative += sw.weight;
  cdf.push({ state: sw.state, threshold: cumulative / totalWeight });
}

function pickRandomState() {
  const r = Math.random();
  for (const entry of cdf) {
    if (r <= entry.threshold) return entry.state;
  }
  return cdf[cdf.length - 1].state;
}

async function scanAllAnimals() {
  const items = [];
  let lastKey = undefined;
  while (true) {
    const result = await client.send(new ScanCommand({
      TableName: 'animals',
      ProjectionExpression: 'livestock_id',
      ExclusiveStartKey: lastKey,
    }));
    if (result.Items) items.push(...result.Items);
    if (!result.LastEvaluatedKey) break;
    lastKey = result.LastEvaluatedKey;
  }
  return items;
}

async function main() {
  console.log('🗺️  Randomizing states for all animals in DynamoDB...');
  if (DRY_RUN) console.log('   (DRY RUN — no writes)\n');

  // Print distribution preview
  console.log('📊 State weight distribution:');
  for (const sw of STATE_WEIGHTS.slice(0, 10)) {
    const pct = ((sw.weight / totalWeight) * 100).toFixed(1);
    console.log(`   ${sw.state.padEnd(22)} ${pct}%`);
  }
  console.log(`   ... and ${STATE_WEIGHTS.length - 10} more states\n`);

  // Scan all animals
  const animals = await scanAllAnimals();
  console.log(`📦 Found ${animals.length} animals to update\n`);

  if (DRY_RUN) {
    // Just show what states would be assigned
    const sample = {};
    for (let i = 0; i < animals.length; i++) {
      const s = pickRandomState();
      sample[s] = (sample[s] || 0) + 1;
    }
    console.log('Sample distribution:');
    Object.entries(sample).sort(([,a],[,b]) => b - a).forEach(([s, c]) => {
      console.log(`   ${s.padEnd(22)} ${c}`);
    });
    console.log('\n✅ Dry run complete.');
    return;
  }

  // Update each animal
  let updated = 0;
  let failed = 0;
  for (const item of animals) {
    const livestockId = item.livestock_id?.S;
    if (!livestockId) continue;

    const newState = pickRandomState();
    try {
      await client.send(new UpdateItemCommand({
        TableName: 'animals',
        Key: { livestock_id: { S: livestockId } },
        UpdateExpression: 'SET #s = :s',
        ExpressionAttributeNames: { '#s': 'state' },
        ExpressionAttributeValues: { ':s': { S: newState } },
      }));
      updated++;
      if (updated % 50 === 0) process.stdout.write(`\r   Updated ${updated}/${animals.length}`);
    } catch (err) {
      failed++;
      if (failed <= 3) console.error(`\n   ❌ Failed: ${livestockId}: ${err.message}`);
    }
  }
  if (animals.length >= 50) process.stdout.write('\n');

  console.log(`\n✅ Done! Updated ${updated} animals, ${failed} failures.`);

  // Show resulting distribution
  const resultAnimals = await scanAllAnimals2();
  const dist = {};
  resultAnimals.forEach(a => {
    const s = a.state?.S || 'Unknown';
    dist[s] = (dist[s] || 0) + 1;
  });
  console.log('\n📊 Resulting distribution:');
  Object.entries(dist).sort(([,a],[,b]) => b - a).forEach(([s, c]) => {
    console.log(`   ${s.padEnd(25)} ${c}`);
  });
}

async function scanAllAnimals2() {
  const items = [];
  let lastKey = undefined;
  while (true) {
    const result = await client.send(new ScanCommand({
      TableName: 'animals',
      ProjectionExpression: 'livestock_id, #s',
      ExpressionAttributeNames: { '#s': 'state' },
      ExclusiveStartKey: lastKey,
    }));
    if (result.Items) items.push(...result.Items);
    if (!result.LastEvaluatedKey) break;
    lastKey = result.LastEvaluatedKey;
  }
  return items;
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
