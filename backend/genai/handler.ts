/**
 * GenAI Assistant Lambda — AI Vet Assistant, Farmer Copilot Chat, Disease Outbreak Detection
 *
 * Endpoints:
 *   POST /ai-assistant            → single-turn vet assistant (question + optional animal_id)
 *   POST /ai-chat                 → multi-turn copilot chat (message history)
 *   GET  /ai-assistant/outbreaks  → list recent outbreak alerts
 *   POST /ai-assistant/outbreaks/scan → manually trigger outbreak scan (admin / gov)
 *
 * Integrations:
 *   - Amazon Bedrock (Claude 3 Haiku) for LLM responses
 *   - DynamoDB for animal metadata, health records, chat history, outbreak alerts
 *   - OpenSearch (optional) for RAG knowledge retrieval
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';

// ─── AWS Clients ───────────────────────────────────────────────────
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || 'amazon.nova-lite-v1:0';
const BEDROCK_REGION = process.env.BEDROCK_REGION || process.env.AWS_REGION || 'us-east-1';

// ─── Helpers ────────────────────────────────────────────────────────

function cors(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

function getUserId(event: APIGatewayProxyEvent): string {
  return (
    event.requestContext?.authorizer?.claims?.sub ||
    event.requestContext?.authorizer?.claims?.['cognito:username'] ||
    'anonymous'
  );
}

function getUserRole(event: APIGatewayProxyEvent): string {
  return (
    event.requestContext?.authorizer?.claims?.['custom:role'] ||
    'farmer'
  );
}

// ─── Bedrock Invoke ─────────────────────────────────────────────────

async function invokeBedrock(prompt: string, maxTokens = 1024): Promise<string> {
  // Dynamic import to avoid bundling issues when Bedrock SDK isn't present locally
  const { BedrockRuntimeClient, InvokeModelCommand } = await import(
    '@aws-sdk/client-bedrock-runtime'
  );

  const client = new BedrockRuntimeClient({ region: BEDROCK_REGION });

  const isNova = BEDROCK_MODEL_ID.startsWith('amazon.nova');
  const isClaude = BEDROCK_MODEL_ID.startsWith('anthropic.claude');

  let payload: Record<string, unknown>;
  if (isNova) {
    // Amazon Nova format
    payload = {
      schemaVersion: 'messages-v1',
      messages: [{ role: 'user', content: [{ text: prompt }] }],
      inferenceConfig: { max_new_tokens: maxTokens },
    };
  } else if (isClaude) {
    // Anthropic Claude format
    payload = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    };
  } else {
    // Generic fallback (Titan-style)
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

  // Parse response based on model family
  if (isNova) {
    return decoded?.output?.message?.content?.[0]?.text || 'No response generated.';
  } else if (isClaude) {
    return decoded?.content?.[0]?.text || 'No response generated.';
  } else {
    return decoded?.results?.[0]?.outputText || decoded?.outputText || 'No response generated.';
  }
}

// ─── Knowledge Context (embedded veterinary knowledge) ──────────────
// This is a built-in knowledge base so the system works out of the box
// without requiring a separate S3 knowledge bucket or OpenSearch index.
// For production RAG, replace with OpenSearch vector search.

const VET_KNOWLEDGE = `
=== COMMON LIVESTOCK DISEASES ===

1. FOOT AND MOUTH DISEASE (FMD)
Symptoms: Fever (104-106°F), excessive salivation, blisters on mouth/tongue/hooves, lameness, reduced milk yield, reluctance to eat.
Cause: Aphthovirus (picornavirus family). Highly contagious.
Treatment: No specific cure. Supportive care — antiseptic mouth wash (1% potassium permanganate), wound dressing on hooves, soft feed, rest. Antibiotics for secondary infections.
Prevention: Biannual FMD vaccination. Quarantine infected animals.
Urgency: HIGH — report immediately. Notifiable disease.

2. LUMPY SKIN DISEASE (LSD)
Symptoms: Fever, firm round skin nodules (2-5 cm), enlarged lymph nodes, nasal/eye discharge, reduced milk, weight loss.
Cause: Capripoxvirus, spread by insects (mosquitoes, flies, ticks).
Treatment: Supportive — wound care, antibiotics for secondary infection, anti-inflammatory drugs.
Prevention: Goatpox vaccine (heterologous) or LSD-specific vaccine.
Urgency: HIGH — quarantine immediately.

3. MASTITIS
Symptoms: Swollen/hot/painful udder, abnormal milk (clots, watery, blood-tinged), fever, reduced appetite.
Cause: Bacterial (Staphylococcus aureus, Streptococcus, E. coli). Usually from poor milking hygiene.
Treatment: Intramammary antibiotics, systemic antibiotics if severe, anti-inflammatory drugs, frequent milking.
Prevention: Clean milking routine, teat dipping, dry cow therapy, regular CMT testing.
Urgency: MEDIUM-HIGH — treat within 24 hours.

4. BRUCELLOSIS
Symptoms: Abortion (last trimester), retained placenta, infertility, swollen joints, orchitis in males.
Cause: Brucella abortus (cattle), B. melitensis (goats/sheep). Zoonotic!
Treatment: No effective treatment in animals. Test and slaughter policy.
Prevention: S19 / RB51 vaccination of calves. Test-and-segregate.
Urgency: HIGH — notifiable, zoonotic risk.

5. HAEMORRHAGIC SEPTICAEMIA (HS)
Symptoms: Sudden high fever, swelling of throat/brisket, difficulty breathing, drooling, death within 12-24 hours.
Cause: Pasteurella multocida. Often after monsoon/stress.
Treatment: High-dose antibiotics (oxytetracycline) if caught early. Usually fatal if delayed.
Prevention: HS vaccine before monsoon season.
Urgency: CRITICAL — immediate veterinary intervention.

6. BLACK QUARTER (BQ)
Symptoms: Sudden lameness, swollen and crepitant (gas-filled) muscles, fever, depression, death within 24-48 hours.
Cause: Clostridium chauvoei. Soil-borne spores.
Treatment: High-dose penicillin if caught very early. Often fatal.
Prevention: BQ vaccine (annual, pre-monsoon).
Urgency: CRITICAL — emergency.

7. MILK FEVER (Hypocalcaemia)
Symptoms: Occurs shortly after calving. Staggering, muscle tremors, inability to stand, cold ears, S-shaped neck bend, coma.
Cause: Sudden drop in blood calcium at onset of lactation.
Treatment: Slow IV calcium borogluconate (20-25%). Response usually within 30 minutes.
Prevention: Anionic salts in pre-calving diet, avoid over-conditioning.
Urgency: HIGH — treat within hours.

8. BLOAT (Ruminal Tympany)
Symptoms: Distended left flank, difficulty breathing, restlessness, drooling, death if untreated.
Cause: Frothy (legume pasture) or free gas (obstruction).
Treatment: Trocar/cannula for emergency gas release, anti-bloat agents (poloxalene), stomach tube.
Prevention: Gradual introduction to lush pasture, anti-bloat blocks.
Urgency: CRITICAL if severe — can die within hours.

9. THEILERIOSIS (Tropical Theileriosis)
Symptoms: High fever, enlarged lymph nodes, anaemia, jaundice, labored breathing.
Cause: Theileria annulata, transmitted by Hyalomma ticks.
Treatment: Buparvaquone injection. Supportive (fluids, blood transfusion if severe).
Prevention: Tick control (acaricides), Theileria vaccine where available.
Urgency: HIGH — mortality 40-90% if untreated.

10. WORM INFESTATION (Helminthiasis)
Symptoms: Poor coat, pot belly (especially young), diarrhea, weight loss, anaemia, bottle jaw.
Cause: Roundworms, tapeworms, flukes.
Treatment: Broad-spectrum dewormer (albendazole, ivermectin, fenbendazole). Fluke-specific: triclabendazole.
Prevention: Strategic deworming (pre-monsoon, post-monsoon), rotational grazing.
Urgency: LOW-MEDIUM — schedule treatment.

=== VACCINATION SCHEDULE (India — General) ===
- FMD: Every 6 months (national program)
- HS: Once yearly (pre-monsoon, May-June)
- BQ: Once yearly (pre-monsoon)
- Brucellosis: Calves at 4-8 months (S19), once
- Anthrax: Annually in endemic areas
- Theileriosis: Where available
- Deworming: Every 3-4 months

=== GENERAL SYMPTOM REFERENCE ===
- Not eating + drooling → FMD, HS, Bloat, dental issues
- Skin lumps/nodules → LSD, insect bites, ringworm, warts
- Sudden death → HS, BQ, Anthrax, bloat, snakebite
- Abortion → Brucellosis, Leptospirosis, Trichomoniasis
- Lameness → FMD, BQ, foot rot, injury
- Diarrhea → parasites, Johne's disease, salmonella, diet change
- Swollen udder → Mastitis
- Can't stand after calving → Milk fever
- Fever + tick presence → Theileriosis, Babesiosis, Anaplasmosis
`;

// ─── Fetch Animal Context from DynamoDB ─────────────────────────────

async function getAnimalContext(animalId: string): Promise<string> {
  try {
    const animalRes = await ddb.send(
      new GetCommand({ TableName: 'animals', Key: { livestock_id: animalId } })
    );
    const animal = animalRes.Item;
    if (!animal) return `Animal ${animalId}: not found in database.`;

    // Fetch recent health records
    let healthText = '';
    try {
      const healthRes = await ddb.send(
        new QueryCommand({
          TableName: 'health_records',
          KeyConditionExpression: 'livestock_id = :id',
          ExpressionAttributeValues: { ':id': animalId },
          ScanIndexForward: false,
          Limit: 5,
        })
      );
      if (healthRes.Items?.length) {
        healthText = healthRes.Items.map(
          (r) => `- ${r.record_type} on ${r.record_date}${r.vaccine_type ? ` (${r.vaccine_type})` : ''}${r.notes ? `: ${r.notes}` : ''}`
        ).join('\n');
      }
    } catch { /* health table optional */ }

    return `
Animal ID: ${animal.livestock_id}
Species: ${animal.species || 'unknown'}
Breed: ${animal.breed || 'unknown'}
Gender: ${animal.gender || 'unknown'}
Age: ${animal.age_months ? `${Math.floor(animal.age_months / 12)} years ${animal.age_months % 12} months` : 'unknown'}
Color/Pattern: ${animal.color_pattern || 'unknown'}
Location: ${[animal.village, animal.district, animal.state].filter(Boolean).join(', ') || 'unknown'}
Status: ${animal.status || 'active'}
Enrolled: ${animal.enrolled_at || 'unknown'}
${healthText ? `\nRecent Health Records:\n${healthText}` : '\nNo recent health records.'}
`.trim();
  } catch {
    return `Animal ${animalId}: unable to fetch data.`;
  }
}

// ─── AI Vet Assistant ───────────────────────────────────────────────

async function handleAssistant(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const question = body.question?.trim();
  if (!question) {
    return cors(400, { error: 'Missing required field: question' });
  }

  const animalId = body.animal_id?.trim();
  let animalContext = 'No specific animal selected.';
  if (animalId) {
    animalContext = await getAnimalContext(animalId);
  }

  const prompt = `You are an expert veterinary assistant for rural livestock farmers in India.
You provide practical, actionable advice in simple language.
Use the provided knowledge context to give accurate answers. If unsure, say so and recommend visiting a qualified veterinarian.

=== VETERINARY KNOWLEDGE BASE ===
${VET_KNOWLEDGE}

=== ANIMAL DETAILS ===
${animalContext}

=== FARMER'S QUESTION ===
${question}

Respond in the following structured format:

**Possible Condition:** [most likely condition based on symptoms]

**Reasoning:** [brief explanation of why you think this]

**Recommended Actions:**
1. [immediate action]
2. [follow-up action]
3. [preventive measure]

**Urgency Level:** [CRITICAL / HIGH / MEDIUM / LOW]

**⚠️ Disclaimer:** This is AI-generated advice. Always consult a qualified veterinarian for accurate diagnosis and treatment.`;

  try {
    const response = await invokeBedrock(prompt, 800);

    // Store the interaction for analytics
    const interactionId = `ai_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    try {
      await ddb.send(
        new PutCommand({
          TableName: 'ai_interactions',
          Item: {
            interaction_id: interactionId,
            user_id: getUserId(event),
            animal_id: animalId || null,
            question,
            response,
            interaction_type: 'vet_assistant',
            created_at: new Date().toISOString(),
          },
        })
      );
    } catch { /* logging is best-effort */ }

    return cors(200, {
      response,
      interaction_id: interactionId,
      animal_id: animalId || null,
    });
  } catch (err: unknown) {
    console.error('Bedrock invocation failed:', err);
    return cors(500, {
      error: 'AI service unavailable',
      message: 'The AI assistant is temporarily unavailable. Please try again later.',
    });
  }
}

// ─── Copilot Chat (Multi-turn) ─────────────────────────────────────

async function handleChat(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const userId = getUserId(event);
  const body = JSON.parse(event.body || '{}');
  const messages: Array<{ role: string; content: string }> = body.messages || [];
  const animalId = body.animal_id?.trim();

  if (!messages.length) {
    return cors(400, { error: 'Missing required field: messages' });
  }

  const lastMessage = messages[messages.length - 1]?.content || '';

  // Build conversation history into a single prompt (Claude Messages API via Bedrock)
  let animalContext = '';
  if (animalId) {
    animalContext = await getAnimalContext(animalId);
  }

  const conversationHistory = messages
    .map((m) => `${m.role === 'user' ? 'Farmer' : 'Assistant'}: ${m.content}`)
    .join('\n\n');

  const prompt = `You are Pashu Aadhaar AI Copilot — a friendly, knowledgeable veterinary and livestock management assistant for Indian farmers.
You help with: animal health queries, vaccination schedules, milk yield improvement, insurance guidance, loan information, and general livestock management.
Keep responses concise, practical, and in simple language. Use bullet points when helpful.
If asked in Hindi or another Indian language, respond in the same language.

=== VETERINARY KNOWLEDGE ===
${VET_KNOWLEDGE}

${animalContext ? `=== CURRENT ANIMAL ===\n${animalContext}\n` : ''}
=== CONVERSATION ===
${conversationHistory}

Respond as the Assistant. Be helpful, empathetic, and practical.`;

  try {
    const response = await invokeBedrock(prompt, 600);

    // Store chat interaction
    const chatId = body.chat_id || `chat_${userId}_${Date.now()}`;
    try {
      await ddb.send(
        new PutCommand({
          TableName: 'ai_interactions',
          Item: {
            interaction_id: `${chatId}_${Date.now()}`,
            user_id: userId,
            chat_id: chatId,
            animal_id: animalId || null,
            question: lastMessage,
            response,
            messages_count: messages.length,
            interaction_type: 'copilot_chat',
            created_at: new Date().toISOString(),
          },
        })
      );
    } catch { /* best-effort */ }

    return cors(200, {
      response,
      chat_id: chatId,
    });
  } catch (err: unknown) {
    console.error('Chat Bedrock invocation failed:', err);
    return cors(500, {
      error: 'AI service unavailable',
      message: 'Chat service is temporarily unavailable.',
    });
  }
}

// ─── Disease Outbreak Detection ─────────────────────────────────────

interface SymptomCluster {
  district: string;
  state: string;
  symptom_keyword: string;
  count: number;
  animal_ids: string[];
}

async function scanForOutbreaks(): Promise<Array<{
  alert_id: string;
  district: string;
  state: string;
  symptom: string;
  count: number;
  analysis: string;
  risk_level: string;
  created_at: string;
}>> {
  const alerts: Array<{
    alert_id: string;
    district: string;
    state: string;
    symptom: string;
    count: number;
    analysis: string;
    risk_level: string;
    created_at: string;
  }> = [];

  // Scan recent health records for clusters (last 48 hours)
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

    if (!healthScan.Items?.length) return alerts;

    // Aggregate by district + record_type
    const clusters = new Map<string, SymptomCluster>();

    for (const record of healthScan.Items) {
      // Fetch animal location for clustering
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

    // Threshold: 3+ similar records in same district within 48h
    const OUTBREAK_THRESHOLD = 3;

    for (const cluster of clusters.values()) {
      if (cluster.count >= OUTBREAK_THRESHOLD && cluster.district !== 'unknown') {
        // Ask LLM to analyze the cluster
        const analysisPrompt = `You are a veterinary epidemiologist analyzing a potential disease outbreak.

Data:
- Location: ${cluster.district}, ${cluster.state}
- Symptom/Record type: ${cluster.symptom_keyword}
- Number of cases: ${cluster.count} in the last 48 hours
- Affected animals: ${cluster.animal_ids.length}

Based on this cluster, provide a brief (3-4 sentence) analysis:
1. Whether this suggests a disease outbreak
2. Most likely disease
3. Recommended district-level action
4. Risk level (CRITICAL / HIGH / MEDIUM / LOW)

Format as a short paragraph.`;

        let analysis = '';
        let riskLevel = 'medium';
        try {
          analysis = await invokeBedrock(analysisPrompt, 300);
          // Extract risk level from response
          if (analysis.toLowerCase().includes('critical')) riskLevel = 'critical';
          else if (analysis.toLowerCase().includes('high')) riskLevel = 'high';
          else if (analysis.toLowerCase().includes('low')) riskLevel = 'low';
        } catch {
          analysis = `${cluster.count} cases of ${cluster.symptom_keyword} detected in ${cluster.district} within 48 hours. Manual review recommended.`;
        }

        const alertId = `outbreak_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const alert = {
          alert_id: alertId,
          district: cluster.district,
          state: cluster.state,
          symptom: cluster.symptom_keyword,
          count: cluster.count,
          animal_ids: cluster.animal_ids,
          analysis,
          risk_level: riskLevel,
          created_at: new Date().toISOString(),
        };

        // Store in DynamoDB
        try {
          await ddb.send(
            new PutCommand({
              TableName: 'outbreak_alerts',
              Item: alert,
            })
          );
        } catch { /* best-effort */ }

        alerts.push(alert);
      }
    }
  } catch (err) {
    console.error('Outbreak scan error:', err);
  }

  return alerts;
}

async function handleOutbreakScan(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const role = getUserRole(event);
  if (!['government', 'admin'].includes(role)) {
    return cors(403, { error: 'Access denied. Government or admin role required.' });
  }

  const alerts = await scanForOutbreaks();
  return cors(200, { alerts, scanned_at: new Date().toISOString() });
}

async function handleListOutbreaks(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // Get query params for filtering
    const state = event.queryStringParameters?.state;
    const limit = parseInt(event.queryStringParameters?.limit || '20', 10);

    let result;
    if (state) {
      result = await ddb.send(
        new QueryCommand({
          TableName: 'outbreak_alerts',
          IndexName: 'state-index',
          KeyConditionExpression: '#s = :state',
          ExpressionAttributeNames: { '#s': 'state' },
          ExpressionAttributeValues: { ':state': state },
          ScanIndexForward: false,
          Limit: limit,
        })
      );
    } else {
      result = await ddb.send(
        new ScanCommand({
          TableName: 'outbreak_alerts',
          Limit: limit,
        })
      );
    }

    return cors(200, { alerts: result.Items || [] });
  } catch {
    return cors(200, { alerts: [] });
  }
}

// ─── Router ─────────────────────────────────────────────────────────

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('GenAI handler:', event.httpMethod, event.path);

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return cors(200, {});
  }

  const path = event.resource || event.path || '';
  const method = event.httpMethod;

  try {
    // POST /ai-assistant
    if (path === '/ai-assistant' && method === 'POST') {
      return handleAssistant(event);
    }

    // POST /ai-chat
    if (path === '/ai-chat' && method === 'POST') {
      return handleChat(event);
    }

    // GET /ai-assistant/outbreaks
    if (path === '/ai-assistant/outbreaks' && method === 'GET') {
      return handleListOutbreaks(event);
    }

    // POST /ai-assistant/outbreaks/scan
    if (path === '/ai-assistant/outbreaks/scan' && method === 'POST') {
      return handleOutbreakScan(event);
    }

    return cors(404, { error: 'Not found' });
  } catch (err: unknown) {
    console.error('GenAI handler error:', err);
    return cors(500, { error: 'Internal server error' });
  }
}
