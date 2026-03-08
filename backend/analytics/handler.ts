/**
 * Analytics Lambda — Government / Admin dashboard data.
 *
 * GET /analytics/summary   → overall platform stats
 * GET /analytics/states     → state-wise cattle population + enrollment counts
 * GET /analytics/trends     → enrollment trends over time (daily/monthly)
 * GET /analytics/breeds     → breed distribution
 * GET /analytics/fraud      → fraud score summary (admin only)
 * GET /analytics/agents     → agent performance leaderboard
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { createLogger, buildResponse, buildErrorResponse } from '../shared/utils';

const logger = createLogger('analytics');
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const REGION = process.env.AWS_REGION || 'us-east-1';
const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

const ANIMALS_TABLE = 'animals';
const OWNERS_TABLE = 'owners';
const ENROLLMENT_SESSIONS_TABLE = 'enrollment_sessions';
const FRAUD_SCORES_TABLE = 'fraud_scores';
const ENROLLMENT_REQUESTS_TABLE = 'enrollment_requests';

// Indian states for complete map data
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  logger.info('Analytics request', { method: event.httpMethod, path: event.path });

  if (event.httpMethod === 'OPTIONS') {
    return buildResponse(200, {}, ALLOWED_ORIGIN);
  }

  // Validate role — only government + admin
  const claims = event.requestContext?.authorizer?.claims;
  const role = claims?.['custom:role'];
  if (!role || !['government', 'admin'].includes(role)) {
    return buildErrorResponse(403, 'FORBIDDEN', 'Only government/admin roles can access analytics', ALLOWED_ORIGIN);
  }

  try {
    const path = event.path;

    if (path.endsWith('/analytics/summary')) {
      return await getSummary();
    }
    if (path.endsWith('/analytics/states')) {
      return await getStateWiseData();
    }
    if (path.endsWith('/analytics/trends')) {
      return await getEnrollmentTrends();
    }
    if (path.endsWith('/analytics/breeds')) {
      return await getBreedDistribution();
    }
    if (path.endsWith('/analytics/fraud')) {
      return await getFraudSummary();
    }
    if (path.endsWith('/analytics/agents')) {
      return await getAgentPerformance();
    }

    return buildErrorResponse(404, 'NOT_FOUND', 'Route not found', ALLOWED_ORIGIN);
  } catch (err) {
    logger.error('Analytics error', err);
    return buildErrorResponse(500, 'INTERNAL_ERROR', 'Analytics query failed', ALLOWED_ORIGIN);
  }
}

// ─── Scan helper (handles pagination) ────────────────────────────────
async function fullScan(tableName: string, projection?: string): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const cmd: Record<string, unknown> = { TableName: tableName, ExclusiveStartKey: lastKey };
    if (projection) cmd.ProjectionExpression = projection;
    const res = await ddbClient.send(new ScanCommand(cmd as never));
    items.push(...(res.Items as Record<string, unknown>[] || []));
    lastKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  return items;
}

// ─── 1. Overall Summary ─────────────────────────────────────────────
async function getSummary() {
  // Scan animals with 'state' as reserved word, sessions with 'status' as reserved word
  const [animalsFull, owners, sessionsFull] = await Promise.all([
    scanWithReserved(ANIMALS_TABLE, 'livestock_id, #s, species, enrolled_at, breed, gender', { '#s': 'state' }),
    fullScan(OWNERS_TABLE, 'owner_id, created_at'),
    scanWithReserved(ENROLLMENT_SESSIONS_TABLE, 'session_id, #s, started_at, agent_id', { '#s': 'status' }),
  ]);

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const recentEnrollments = animalsFull.filter(a => a.enrolled_at && (a.enrolled_at as string) > thirtyDaysAgo).length;
  const weeklyEnrollments = animalsFull.filter(a => a.enrolled_at && (a.enrolled_at as string) > sevenDaysAgo).length;
  const completedSessions = sessionsFull.filter(s => s.status === 'completed').length;
  const activeSessions = sessionsFull.filter(s => s.status === 'active').length;

  // Gender distribution
  const genderDist: Record<string, number> = {};
  animalsFull.forEach(a => {
    const g = (a.gender as string) || 'Unknown';
    genderDist[g] = (genderDist[g] || 0) + 1;
  });

  // Species distribution
  const speciesDist: Record<string, number> = {};
  animalsFull.forEach(a => {
    const s = (a.species as string) || 'Unknown';
    speciesDist[s] = (speciesDist[s] || 0) + 1;
  });

  // Unique agents
  const uniqueAgents = new Set(sessionsFull.map(s => s.agent_id).filter(Boolean)).size;

  return buildResponse(200, {
    total_animals: animalsFull.length,
    total_farmers: owners.length,
    total_sessions: sessionsFull.length,
    completed_sessions: completedSessions,
    active_sessions: activeSessions,
    unique_agents: uniqueAgents,
    enrollments_last_30_days: recentEnrollments,
    enrollments_last_7_days: weeklyEnrollments,
    gender_distribution: genderDist,
    species_distribution: speciesDist,
  }, ALLOWED_ORIGIN);
}

// ─── 2. State-wise Data ─────────────────────────────────────────────
async function getStateWiseData() {
  const animals = await scanWithReserved(ANIMALS_TABLE, 'livestock_id, #s, species, breed, enrolled_at, gender', { '#s': 'state' });

  const stateMap: Record<string, {
    total: number;
    species: Record<string, number>;
    breeds: Record<string, number>;
    gender: Record<string, number>;
    recent_30d: number;
  }> = {};

  // Initialize all Indian states
  INDIAN_STATES.forEach(s => {
    stateMap[s] = { total: 0, species: {}, breeds: {}, gender: {}, recent_30d: 0 };
  });

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  animals.forEach(a => {
    const state = normalizeState((a.state as string) || '');
    if (!state) return;

    if (!stateMap[state]) {
      stateMap[state] = { total: 0, species: {}, breeds: {}, gender: {}, recent_30d: 0 };
    }

    stateMap[state].total += 1;

    const sp = (a.species as string) || 'Unknown';
    stateMap[state].species[sp] = (stateMap[state].species[sp] || 0) + 1;

    const br = (a.breed as string) || 'Unknown';
    stateMap[state].breeds[br] = (stateMap[state].breeds[br] || 0) + 1;

    const g = (a.gender as string) || 'Unknown';
    stateMap[state].gender[g] = (stateMap[state].gender[g] || 0) + 1;

    if (a.enrolled_at && (a.enrolled_at as string) > thirtyDaysAgo) {
      stateMap[state].recent_30d += 1;
    }
  });

  const stateList = Object.entries(stateMap).map(([name, data]) => ({
    state: name,
    ...data,
  })).sort((a, b) => b.total - a.total);

  return buildResponse(200, { states: stateList }, ALLOWED_ORIGIN);
}

// ─── 3. Enrollment Trends ───────────────────────────────────────────
async function getEnrollmentTrends() {
  const animals = await scanWithReserved(ANIMALS_TABLE, 'livestock_id, enrolled_at, #s', { '#s': 'state' });

  // Daily counts for last 90 days
  const dailyCounts: Record<string, number> = {};
  const monthlyCounts: Record<string, number> = {};

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  animals.forEach(a => {
    if (!a.enrolled_at) return;
    const d = new Date(a.enrolled_at as string);
    if (d < ninetyDaysAgo) return;

    const dayKey = d.toISOString().slice(0, 10); // YYYY-MM-DD
    dailyCounts[dayKey] = (dailyCounts[dayKey] || 0) + 1;

    const monthKey = d.toISOString().slice(0, 7); // YYYY-MM
    monthlyCounts[monthKey] = (monthlyCounts[monthKey] || 0) + 1;
  });

  // Fill in missing days
  const daily: Array<{ date: string; count: number }> = [];
  const today = new Date();
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    daily.push({ date: key, count: dailyCounts[key] || 0 });
  }

  // All months
  const monthly: Array<{ month: string; count: number }> = Object.entries(monthlyCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }));

  // Cumulative enrollments over time
  let cumulative = 0;
  const cumulativeData = daily.map(d => {
    cumulative += d.count;
    return { date: d.date, total: cumulative };
  });

  return buildResponse(200, { daily, monthly, cumulative: cumulativeData }, ALLOWED_ORIGIN);
}

// ─── 4. Breed Distribution ──────────────────────────────────────────
async function getBreedDistribution() {
  const animals = await scanWithReserved(ANIMALS_TABLE, 'livestock_id, breed, species, gender, #s', { '#s': 'state' });

  const breedCounts: Record<string, number> = {};
  const breedByState: Record<string, Record<string, number>> = {};
  const breedByGender: Record<string, Record<string, number>> = {};

  animals.forEach(a => {
    const breed = (a.breed as string) || 'Unknown';
    const state = normalizeState((a.state as string) || '') || 'Unknown';
    const gender = (a.gender as string) || 'Unknown';

    breedCounts[breed] = (breedCounts[breed] || 0) + 1;

    if (!breedByState[breed]) breedByState[breed] = {};
    breedByState[breed][state] = (breedByState[breed][state] || 0) + 1;

    if (!breedByGender[breed]) breedByGender[breed] = {};
    breedByGender[breed][gender] = (breedByGender[breed][gender] || 0) + 1;
  });

  const breeds = Object.entries(breedCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([breed, count]) => ({
      breed,
      count,
      states: breedByState[breed] || {},
      gender: breedByGender[breed] || {},
    }));

  return buildResponse(200, { breeds }, ALLOWED_ORIGIN);
}

// ─── 5. Fraud Summary ───────────────────────────────────────────────
async function getFraudSummary() {
  let fraudItems: Record<string, unknown>[] = [];
  try {
    fraudItems = await fullScan(FRAUD_SCORES_TABLE);
  } catch {
    // Table may not exist yet — return empty
    return buildResponse(200, {
      total_scored: 0,
      risk_distribution: { low: 0, medium: 0, high: 0, critical: 0 },
      avg_fraud_score: 0,
      flagged_enrollments: [],
      top_flags: [],
    }, ALLOWED_ORIGIN);
  }

  const riskDist = { low: 0, medium: 0, high: 0, critical: 0 };
  let totalScore = 0;
  const flagCounts: Record<string, number> = {};
  const flagged: Record<string, unknown>[] = [];

  fraudItems.forEach(item => {
    const level = (item.risk_level as string) || 'low';
    if (level in riskDist) riskDist[level as keyof typeof riskDist] += 1;

    const score = (item.fraud_risk_score as number) || 0;
    totalScore += score;

    // Collect flags
    const flags = (item.flags as string[]) || [];
    flags.forEach(f => { flagCounts[f] = (flagCounts[f] || 0) + 1; });

    // High/critical flagged items
    if (level === 'high' || level === 'critical') {
      flagged.push({
        livestock_id: item.livestock_id,
        agent_id: item.agent_id,
        fraud_risk_score: score,
        risk_level: level,
        flags,
        created_at: item.created_at,
      });
    }
  });

  const topFlags = Object.entries(flagCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([flag, count]) => ({ flag, count }));

  return buildResponse(200, {
    total_scored: fraudItems.length,
    risk_distribution: riskDist,
    avg_fraud_score: fraudItems.length ? Math.round(totalScore / fraudItems.length) : 0,
    flagged_enrollments: flagged.sort((a, b) => ((b.fraud_risk_score as number) || 0) - ((a.fraud_risk_score as number) || 0)).slice(0, 50),
    top_flags: topFlags,
  }, ALLOWED_ORIGIN);
}

// ─── 6. Agent Performance ───────────────────────────────────────────
async function getAgentPerformance() {
  const sessions = await scanWithReserved(ENROLLMENT_SESSIONS_TABLE, 'session_id, agent_id, agent_name, #s, started_at, completed_at', { '#s': 'status' });

  const agentMap: Record<string, {
    agent_id: string;
    agent_name: string;
    total_sessions: number;
    completed: number;
    abandoned: number;
    avg_duration_minutes: number;
    durations: number[];
  }> = {};

  sessions.forEach(s => {
    const id = (s.agent_id as string) || 'unknown';
    if (!agentMap[id]) {
      agentMap[id] = {
        agent_id: id,
        agent_name: (s.agent_name as string) || id,
        total_sessions: 0,
        completed: 0,
        abandoned: 0,
        avg_duration_minutes: 0,
        durations: [],
      };
    }

    agentMap[id].total_sessions += 1;
    if (s.status === 'completed') {
      agentMap[id].completed += 1;
      if (s.started_at && s.completed_at) {
        const duration = (new Date(s.completed_at as string).getTime() - new Date(s.started_at as string).getTime()) / 60000;
        if (duration > 0 && duration < 480) agentMap[id].durations.push(duration);
      }
    }
    if (s.status === 'abandoned') agentMap[id].abandoned += 1;
  });

  const agents = Object.values(agentMap).map(a => {
    const avg = a.durations.length ? Math.round(a.durations.reduce((sum, d) => sum + d, 0) / a.durations.length) : 0;
    return {
      agent_id: a.agent_id,
      agent_name: a.agent_name,
      total_sessions: a.total_sessions,
      completed: a.completed,
      abandoned: a.abandoned,
      completion_rate: a.total_sessions ? Math.round((a.completed / a.total_sessions) * 100) : 0,
      avg_duration_minutes: avg,
    };
  }).sort((a, b) => b.completed - a.completed);

  return buildResponse(200, { agents }, ALLOWED_ORIGIN);
}

// ─── Helpers ─────────────────────────────────────────────────────────

async function scanWithReserved(
  tableName: string,
  projection: string,
  expressionNames: Record<string, string>
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const res = await ddbClient.send(new ScanCommand({
      TableName: tableName,
      ProjectionExpression: projection,
      ExpressionAttributeNames: expressionNames,
      ExclusiveStartKey: lastKey,
    }));
    items.push(...(res.Items as Record<string, unknown>[] || []));
    lastKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  return items;
}

function normalizeState(raw: string): string {
  if (!raw) return '';
  const lower = raw.trim().toLowerCase();

  // Common abbreviations / alternate spellings
  const mapping: Record<string, string> = {
    'ap': 'Andhra Pradesh', 'andhra pradesh': 'Andhra Pradesh',
    'ar': 'Arunachal Pradesh', 'arunachal pradesh': 'Arunachal Pradesh',
    'as': 'Assam', 'assam': 'Assam',
    'br': 'Bihar', 'bihar': 'Bihar',
    'cg': 'Chhattisgarh', 'chhattisgarh': 'Chhattisgarh', 'chattisgarh': 'Chhattisgarh',
    'ga': 'Goa', 'goa': 'Goa',
    'gj': 'Gujarat', 'gujarat': 'Gujarat',
    'hr': 'Haryana', 'haryana': 'Haryana',
    'hp': 'Himachal Pradesh', 'himachal pradesh': 'Himachal Pradesh',
    'jh': 'Jharkhand', 'jharkhand': 'Jharkhand',
    'ka': 'Karnataka', 'karnataka': 'Karnataka',
    'kl': 'Kerala', 'kerala': 'Kerala',
    'mp': 'Madhya Pradesh', 'madhya pradesh': 'Madhya Pradesh',
    'mh': 'Maharashtra', 'maharashtra': 'Maharashtra',
    'mn': 'Manipur', 'manipur': 'Manipur',
    'ml': 'Meghalaya', 'meghalaya': 'Meghalaya',
    'mz': 'Mizoram', 'mizoram': 'Mizoram',
    'nl': 'Nagaland', 'nagaland': 'Nagaland',
    'od': 'Odisha', 'odisha': 'Odisha', 'orissa': 'Odisha',
    'pb': 'Punjab', 'punjab': 'Punjab',
    'rj': 'Rajasthan', 'rajasthan': 'Rajasthan',
    'sk': 'Sikkim', 'sikkim': 'Sikkim',
    'tn': 'Tamil Nadu', 'tamil nadu': 'Tamil Nadu', 'tamilnadu': 'Tamil Nadu',
    'ts': 'Telangana', 'telangana': 'Telangana',
    'tr': 'Tripura', 'tripura': 'Tripura',
    'up': 'Uttar Pradesh', 'uttar pradesh': 'Uttar Pradesh',
    'uk': 'Uttarakhand', 'uttarakhand': 'Uttarakhand',
    'wb': 'West Bengal', 'west bengal': 'West Bengal',
    'dl': 'Delhi', 'delhi': 'Delhi', 'new delhi': 'Delhi',
    'jk': 'Jammu and Kashmir', 'jammu and kashmir': 'Jammu and Kashmir', 'j&k': 'Jammu and Kashmir',
    'la': 'Ladakh', 'ladakh': 'Ladakh',
    'ch': 'Chandigarh', 'chandigarh': 'Chandigarh',
    'py': 'Puducherry', 'puducherry': 'Puducherry', 'pondicherry': 'Puducherry',
  };

  return mapping[lower] || raw.trim();
}
