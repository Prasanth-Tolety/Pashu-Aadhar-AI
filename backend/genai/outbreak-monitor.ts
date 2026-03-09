/**
 * Outbreak Monitor — EventBridge scheduled Lambda
 *
 * Runs every 10 minutes, scans DynamoDB health_records for symptom clusters
 * in the same district within the last 48 hours, and generates alerts using
 * Amazon Bedrock. Stores results in outbreak_alerts DynamoDB table.
 *
 * This is a standalone handler for the EventBridge schedule rule.
 * The same outbreak logic also exists in the main genai handler for on-demand scans.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || 'amazon.nova-lite-v1:0';
const BEDROCK_REGION = process.env.BEDROCK_REGION || process.env.AWS_REGION || 'us-east-1';

async function invokeBedrock(prompt: string, maxTokens = 300): Promise<string> {
  const { BedrockRuntimeClient, InvokeModelCommand } = await import(
    '@aws-sdk/client-bedrock-runtime'
  );
  const client = new BedrockRuntimeClient({ region: BEDROCK_REGION });

  const isNova = BEDROCK_MODEL_ID.startsWith('amazon.nova');
  const isClaude = BEDROCK_MODEL_ID.startsWith('anthropic.claude');

  let payload: Record<string, unknown>;
  if (isNova) {
    payload = {
      schemaVersion: 'messages-v1',
      messages: [{ role: 'user', content: [{ text: prompt }] }],
      inferenceConfig: { max_new_tokens: maxTokens },
    };
  } else if (isClaude) {
    payload = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    };
  } else {
    payload = {
      inputText: prompt,
      textGenerationConfig: { maxTokenCount: maxTokens, temperature: 0.7 },
    };
  }

  const command = new InvokeModelCommand({
    modelId: BEDROCK_MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload),
  });
  const response = await client.send(command);
  const decoded = JSON.parse(new TextDecoder().decode(response.body));

  if (isNova) {
    return decoded?.output?.message?.content?.[0]?.text || '';
  } else if (isClaude) {
    return decoded?.content?.[0]?.text || '';
  } else {
    return decoded?.results?.[0]?.outputText || decoded?.outputText || '';
  }
}

interface SymptomCluster {
  district: string;
  state: string;
  symptom_keyword: string;
  count: number;
  animal_ids: string[];
}

export async function handler(): Promise<void> {
  console.log('Outbreak monitor triggered at', new Date().toISOString());

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  try {
    const healthScan = await ddb.send(
      new ScanCommand({
        TableName: 'health_records',
        FilterExpression: 'record_date >= :cutoff',
        ExpressionAttributeValues: { ':cutoff': cutoff },
        Limit: 500,
      })
    );

    if (!healthScan.Items?.length) {
      console.log('No recent health records. Exiting.');
      return;
    }

    // Cluster by district + symptom
    const clusters = new Map<string, SymptomCluster>();

    for (const record of healthScan.Items) {
      let district = 'unknown';
      let state = 'unknown';
      try {
        const animalRes = await ddb.send(
          new GetCommand({ TableName: 'animals', Key: { livestock_id: record.livestock_id } })
        );
        district = animalRes.Item?.district || 'unknown';
        state = animalRes.Item?.state || 'unknown';
      } catch { /* skip */ }

      const key = `${district}|${state}|${record.record_type}`;
      const existing = clusters.get(key);
      if (existing) {
        existing.count++;
        existing.animal_ids.push(record.livestock_id);
      } else {
        clusters.set(key, {
          district,
          state,
          symptom_keyword: record.record_type,
          count: 1,
          animal_ids: [record.livestock_id],
        });
      }
    }

    const OUTBREAK_THRESHOLD = 3;
    let alertCount = 0;

    for (const cluster of clusters.values()) {
      if (cluster.count >= OUTBREAK_THRESHOLD && cluster.district !== 'unknown') {
        const analysisPrompt = `You are a veterinary epidemiologist. Analyze this data briefly (3-4 sentences):
Location: ${cluster.district}, ${cluster.state}
Symptom type: ${cluster.symptom_keyword}
Cases: ${cluster.count} in 48 hours
Provide: likely disease, risk level (CRITICAL/HIGH/MEDIUM/LOW), recommended action.`;

        let analysis = `${cluster.count} cases of ${cluster.symptom_keyword} in ${cluster.district}. Manual review recommended.`;
        let riskLevel = 'medium';

        try {
          analysis = await invokeBedrock(analysisPrompt);
          if (analysis.toLowerCase().includes('critical')) riskLevel = 'critical';
          else if (analysis.toLowerCase().includes('high')) riskLevel = 'high';
          else if (analysis.toLowerCase().includes('low')) riskLevel = 'low';
        } catch (err) {
          console.error('Bedrock analysis failed for cluster:', cluster, err);
        }

        const alertId = `outbreak_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await ddb.send(
          new PutCommand({
            TableName: 'outbreak_alerts',
            Item: {
              alert_id: alertId,
              district: cluster.district,
              state: cluster.state,
              symptom: cluster.symptom_keyword,
              count: cluster.count,
              animal_ids: cluster.animal_ids,
              analysis,
              risk_level: riskLevel,
              created_at: new Date().toISOString(),
              source: 'scheduled_scan',
            },
          })
        );
        alertCount++;
      }
    }

    console.log(`Outbreak scan complete. ${alertCount} alerts generated from ${clusters.size} clusters.`);
  } catch (err) {
    console.error('Outbreak monitor error:', err);
    throw err;
  }
}
