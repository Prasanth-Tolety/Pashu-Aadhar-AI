import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  GetCommand,
  UpdateCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { createLogger, buildResponse, buildErrorResponse } from '../shared/utils';

const logger = createLogger('enrollment-sessions');
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

const ddbClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' })
);

const ENROLLMENT_REQUESTS_TABLE = 'enrollment_requests';
const ENROLLMENT_SESSIONS_TABLE = 'enrollment_sessions';
const OWNERS_TABLE = 'owners';
const USER_ROLE_MAPPING_TABLE = 'user_role_mapping';

function generateId(prefix: string): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}

function extractClaims(event: APIGatewayProxyEvent) {
  const claims = event.requestContext?.authorizer?.claims;
  if (!claims) return null;
  const userId = claims.sub as string;
  const ownerId = (claims['custom:owner_id'] as string) || `OWN-${userId.substring(0, 8)}`;
  return {
    userId,
    ownerId,
    role: (claims['custom:role'] as string) || 'farmer',
    name: (claims.name as string) || '',
    phone: (claims.phone_number as string) || '',
  };
}

/**
 * Assign an agent using round-robin strategy.
 * Scans user_role_mapping for enrollment_agent roles, picks the one with fewest active assignments.
 */
async function assignAgent(): Promise<{ agentId: string; agentOwnerId: string; agentName: string } | null> {
  try {
    // Find all enrollment agents
    const agentMappings = await ddbClient.send(new ScanCommand({
      TableName: USER_ROLE_MAPPING_TABLE,
      FilterExpression: '#r = :role',
      ExpressionAttributeNames: { '#r': 'role' },
      ExpressionAttributeValues: { ':role': 'enrollment_agent' },
    }));

    const agents = agentMappings.Items || [];
    if (agents.length === 0) return null;

    // Count active assignments per agent
    const agentLoads: Array<{ userId: string; ownerId: string; name: string; load: number }> = [];

    for (const agent of agents) {
      const activeCount = await ddbClient.send(new QueryCommand({
        TableName: ENROLLMENT_REQUESTS_TABLE,
        IndexName: 'agent-index',
        KeyConditionExpression: 'assigned_agent_id = :aid',
        FilterExpression: '#s IN (:s1, :s2)',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':aid': agent.user_id,
          ':s1': 'assigned',
          ':s2': 'in_progress',
        },
        Select: 'COUNT',
      }));

      // Fetch agent name from owners table
      let agentName = agent.user_id;
      try {
        const ownerRes = await ddbClient.send(new GetCommand({
          TableName: OWNERS_TABLE,
          Key: { owner_id: agent.owner_id || `OWN-${agent.user_id.substring(0, 8)}` },
        }));
        if (ownerRes.Item?.name) agentName = ownerRes.Item.name;
      } catch { /* use fallback name */ }

      agentLoads.push({
        userId: agent.user_id,
        ownerId: agent.owner_id || `OWN-${agent.user_id.substring(0, 8)}`,
        name: agentName,
        load: activeCount.Count || 0,
      });
    }

    // Pick agent with lowest load (round-robin via load balancing)
    agentLoads.sort((a, b) => a.load - b.load);
    const selected = agentLoads[0];
    return { agentId: selected.userId, agentOwnerId: selected.ownerId, agentName: selected.name };
  } catch (err) {
    logger.error('Agent assignment failed', err);
    return null;
  }
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  logger.info('Enrollment session request', {
    method: event.httpMethod,
    path: event.path,
    resource: event.resource,
  });

  if (event.httpMethod === 'OPTIONS') {
    return buildResponse(200, {}, ALLOWED_ORIGIN);
  }

  const claims = extractClaims(event);
  if (!claims) {
    return buildErrorResponse(401, 'UNAUTHORIZED', 'No auth claims found', ALLOWED_ORIGIN);
  }

  const { userId, ownerId, role, name, phone } = claims;
  const path = event.path;

  try {
    // ═══════════════════════════════════════════════════════════════════
    // ENROLLMENT REQUESTS (farmer creates, agent views)
    // ═══════════════════════════════════════════════════════════════════

    // ─── POST /enrollment-requests → farmer creates enrollment request ───
    if (event.httpMethod === 'POST' && /\/enrollment-requests\/?$/.test(path)) {
      if (role !== 'farmer' && role !== 'admin') {
        return buildErrorResponse(403, 'FORBIDDEN', 'Only farmers can request enrollment', ALLOWED_ORIGIN);
      }

      if (!event.body) {
        return buildErrorResponse(400, 'MISSING_BODY', 'Request body required', ALLOWED_ORIGIN);
      }

      const body = JSON.parse(event.body) as {
        address?: { village?: string; district?: string; state?: string; pincode?: string; landmark?: string };
        animal_count?: number;
        preferred_date?: string;
      };

      if (!body.address?.village || !body.address?.district || !body.address?.state) {
        return buildErrorResponse(400, 'MISSING_ADDRESS', 'Address (village, district, state) is required', ALLOWED_ORIGIN);
      }

      const requestId = generateId('ENR');
      const now = new Date().toISOString();

      // Auto-assign an agent
      const agent = await assignAgent();

      const item: Record<string, unknown> = {
        request_id: requestId,
        farmer_id: ownerId,
        farmer_name: name,
        farmer_phone: phone,
        address: body.address,
        animal_count: body.animal_count || 1,
        preferred_date: body.preferred_date || null,
        status: agent ? 'assigned' : 'pending',
        created_at: now,
        updated_at: now,
      };

      // Only set agent fields if an agent was assigned (GSI keys can't be NULL)
      if (agent) {
        item.assigned_agent_id = agent.agentId;
        item.assigned_agent_name = agent.agentName;
      }

      await ddbClient.send(new PutCommand({
        TableName: ENROLLMENT_REQUESTS_TABLE,
        Item: item,
      }));

      logger.info('Enrollment request created', { request_id: requestId, agent: agent?.agentId });
      return buildResponse(201, {
        request: item,
        message: agent
          ? `Enrollment request created. Agent ${agent.agentName} has been assigned.`
          : 'Enrollment request created. An agent will be assigned soon.',
      }, ALLOWED_ORIGIN);
    }

    // ─── GET /enrollment-requests → list enrollment requests ───
    if (event.httpMethod === 'GET' && /\/enrollment-requests\/?$/.test(path)) {
      let items: Record<string, unknown>[] = [];

      if (role === 'farmer') {
        // Farmer sees their own requests
        const result = await ddbClient.send(new QueryCommand({
          TableName: ENROLLMENT_REQUESTS_TABLE,
          IndexName: 'farmer-index',
          KeyConditionExpression: 'farmer_id = :fid',
          ExpressionAttributeValues: { ':fid': ownerId },
          ScanIndexForward: false,
        }));
        items = (result.Items || []) as Record<string, unknown>[];
      } else if (role === 'enrollment_agent') {
        // Agent sees requests assigned to them + unassigned pending requests
        const assignedResult = await ddbClient.send(new QueryCommand({
          TableName: ENROLLMENT_REQUESTS_TABLE,
          IndexName: 'agent-index',
          KeyConditionExpression: 'assigned_agent_id = :aid',
          ExpressionAttributeValues: { ':aid': userId },
          ScanIndexForward: false,
        }));
        const assigned = (assignedResult.Items || []) as Record<string, unknown>[];

        // Also fetch pending unassigned requests (agent can accept these)
        const pendingResult = await ddbClient.send(new ScanCommand({
          TableName: ENROLLMENT_REQUESTS_TABLE,
          FilterExpression: '#s = :pending AND attribute_not_exists(assigned_agent_id)',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: { ':pending': 'pending' },
        }));
        const pending = (pendingResult.Items || []) as Record<string, unknown>[];

        items = [...assigned, ...pending];
        // Sort by created_at descending
        items.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
      } else if (role === 'admin' || role === 'government') {
        // Admin/gov sees all
        const result = await ddbClient.send(new ScanCommand({
          TableName: ENROLLMENT_REQUESTS_TABLE,
        }));
        items = (result.Items || []) as Record<string, unknown>[];
      }

      return buildResponse(200, { requests: items }, ALLOWED_ORIGIN);
    }

    // ─── GET /enrollment-requests/{id} → get single request ───
    if (event.httpMethod === 'GET' && event.pathParameters?.id && /\/enrollment-requests\//.test(path) && !path.includes('/sessions')) {
      const requestId = event.pathParameters.id;
      const result = await ddbClient.send(new GetCommand({
        TableName: ENROLLMENT_REQUESTS_TABLE,
        Key: { request_id: requestId },
      }));

      if (!result.Item) {
        return buildErrorResponse(404, 'NOT_FOUND', 'Enrollment request not found', ALLOWED_ORIGIN);
      }

      return buildResponse(200, { request: result.Item }, ALLOWED_ORIGIN);
    }

    // ─── POST /enrollment-requests/{id}/accept → agent accepts & schedules a visit ───
    if (event.httpMethod === 'POST' && event.pathParameters?.id && path.includes('/accept')) {
      if (role !== 'enrollment_agent' && role !== 'admin') {
        return buildErrorResponse(403, 'FORBIDDEN', 'Only agents can accept requests', ALLOWED_ORIGIN);
      }

      const requestId = event.pathParameters.id;
      const body = event.body ? JSON.parse(event.body) as { scheduled_date?: string; notes?: string } : {};

      // Verify the request exists
      const reqResult = await ddbClient.send(new GetCommand({
        TableName: ENROLLMENT_REQUESTS_TABLE,
        Key: { request_id: requestId },
      }));

      if (!reqResult.Item) {
        return buildErrorResponse(404, 'NOT_FOUND', 'Enrollment request not found', ALLOWED_ORIGIN);
      }

      // Check the request is still pending or already assigned to this agent
      const currentStatus = reqResult.Item.status as string;
      const currentAgent = reqResult.Item.assigned_agent_id as string | undefined;
      if (currentStatus !== 'pending' && currentAgent !== userId) {
        return buildErrorResponse(409, 'CONFLICT', 'This request is already assigned to another agent', ALLOWED_ORIGIN);
      }

      const now = new Date().toISOString();

      await ddbClient.send(new UpdateCommand({
        TableName: ENROLLMENT_REQUESTS_TABLE,
        Key: { request_id: requestId },
        UpdateExpression: 'SET #s = :s, assigned_agent_id = :aid, assigned_agent_name = :aname, scheduled_date = :sd, agent_notes = :notes, updated_at = :u',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':s': 'assigned',
          ':aid': userId,
          ':aname': name,
          ':sd': body.scheduled_date || null,
          ':notes': body.notes || null,
          ':u': now,
        },
      }));

      logger.info('Agent accepted enrollment request', { request_id: requestId, agent: userId, scheduled: body.scheduled_date });
      return buildResponse(200, {
        message: 'Request accepted. Visit scheduled.',
        request_id: requestId,
        scheduled_date: body.scheduled_date || null,
      }, ALLOWED_ORIGIN);
    }

    // ═══════════════════════════════════════════════════════════════════
    // ENROLLMENT SESSIONS (agent creates and manages during field visit)
    // ═══════════════════════════════════════════════════════════════════

    // ─── POST /enrollment-sessions → agent starts a session ───
    if (event.httpMethod === 'POST' && /\/enrollment-sessions\/?$/.test(path)) {
      if (role !== 'enrollment_agent' && role !== 'admin') {
        return buildErrorResponse(403, 'FORBIDDEN', 'Only enrollment agents can start sessions', ALLOWED_ORIGIN);
      }

      if (!event.body) {
        return buildErrorResponse(400, 'MISSING_BODY', 'Request body required', ALLOWED_ORIGIN);
      }

      const body = JSON.parse(event.body) as {
        request_id: string;
        metadata?: {
          device_info?: Record<string, unknown>;
          location_trail?: Array<Record<string, unknown>>;
        };
      };

      if (!body.request_id) {
        return buildErrorResponse(400, 'MISSING_FIELD', 'request_id is required', ALLOWED_ORIGIN);
      }

      // Verify the enrollment request exists and is assigned to this agent
      const reqResult = await ddbClient.send(new GetCommand({
        TableName: ENROLLMENT_REQUESTS_TABLE,
        Key: { request_id: body.request_id },
      }));

      if (!reqResult.Item) {
        return buildErrorResponse(404, 'NOT_FOUND', 'Enrollment request not found', ALLOWED_ORIGIN);
      }

      if (reqResult.Item.assigned_agent_id !== userId && role !== 'admin') {
        return buildErrorResponse(403, 'FORBIDDEN', 'This request is not assigned to you', ALLOWED_ORIGIN);
      }

      const sessionId = generateId('SES');
      const now = new Date().toISOString();

      const session: Record<string, unknown> = {
        session_id: sessionId,
        request_id: body.request_id,
        agent_id: userId,
        agent_name: name,
        farmer_id: reqResult.Item.farmer_id,
        status: 'active',
        current_step: 'cow_detection',
        steps_completed: [],
        metadata: {
          device_info: body.metadata?.device_info || {},
          location_trail: body.metadata?.location_trail || [],
          video_key: null,
          audio_key: null,
        },
        started_at: now,
        created_at: now,
        updated_at: now,
      };

      await ddbClient.send(new PutCommand({
        TableName: ENROLLMENT_SESSIONS_TABLE,
        Item: session,
      }));

      // Update enrollment request status to in_progress
      await ddbClient.send(new UpdateCommand({
        TableName: ENROLLMENT_REQUESTS_TABLE,
        Key: { request_id: body.request_id },
        UpdateExpression: 'SET #s = :s, session_id = :sid, updated_at = :u',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':s': 'in_progress',
          ':sid': sessionId,
          ':u': now,
        },
      }));

      logger.info('Enrollment session started', { session_id: sessionId, request_id: body.request_id });
      return buildResponse(201, { session }, ALLOWED_ORIGIN);
    }

    // ─── GET /enrollment-sessions → agent's active sessions ───
    if (event.httpMethod === 'GET' && /\/enrollment-sessions\/?$/.test(path)) {
      const result = await ddbClient.send(new QueryCommand({
        TableName: ENROLLMENT_SESSIONS_TABLE,
        IndexName: 'agent-index',
        KeyConditionExpression: 'agent_id = :aid',
        ExpressionAttributeValues: { ':aid': userId },
        ScanIndexForward: false,
      }));

      return buildResponse(200, { sessions: result.Items || [] }, ALLOWED_ORIGIN);
    }

    // ─── GET /enrollment-sessions/{id} → get single session ───
    if (event.httpMethod === 'GET' && event.pathParameters?.id && /\/enrollment-sessions\//.test(path)) {
      const sessionId = event.pathParameters.id;
      const result = await ddbClient.send(new GetCommand({
        TableName: ENROLLMENT_SESSIONS_TABLE,
        Key: { session_id: sessionId },
      }));

      if (!result.Item) {
        return buildErrorResponse(404, 'NOT_FOUND', 'Enrollment session not found', ALLOWED_ORIGIN);
      }

      return buildResponse(200, { session: result.Item }, ALLOWED_ORIGIN);
    }

    // ─── POST /enrollment-sessions/{id}/step → agent completes a step ───
    if (event.httpMethod === 'POST' && event.pathParameters?.id && path.includes('/step')) {
      const sessionId = event.pathParameters.id;

      if (!event.body) {
        return buildErrorResponse(400, 'MISSING_BODY', 'Request body required', ALLOWED_ORIGIN);
      }

      const body = JSON.parse(event.body) as {
        step: string;
        image_key?: string;
        location?: { latitude: number; longitude: number; accuracy: number };
      };

      // Get the session
      const sessionResult = await ddbClient.send(new GetCommand({
        TableName: ENROLLMENT_SESSIONS_TABLE,
        Key: { session_id: sessionId },
      }));

      if (!sessionResult.Item) {
        return buildErrorResponse(404, 'NOT_FOUND', 'Session not found', ALLOWED_ORIGIN);
      }

      const session = sessionResult.Item;
      if (session.agent_id !== userId && role !== 'admin') {
        return buildErrorResponse(403, 'FORBIDDEN', 'Not your session', ALLOWED_ORIGIN);
      }

      const now = new Date().toISOString();
      const stepsCompleted = [...(session.steps_completed || [])];
      if (!stepsCompleted.includes(body.step)) {
        stepsCompleted.push(body.step);
      }

      // Determine image key field name
      const keyFieldMap: Record<string, string> = {
        cow_detection: 'cow_image_key',
        muzzle_detection: 'muzzle_image_key',
        body_texture: 'body_texture_key',
        agent_selfie: 'agent_selfie_key',
      };

      const stepOrder = ['cow_detection', 'muzzle_detection', 'body_texture', 'agent_selfie'];
      const currentIdx = stepOrder.indexOf(body.step);
      const nextStep = currentIdx < stepOrder.length - 1 ? stepOrder[currentIdx + 1] : null;

      // Build update expression
      let updateExpr = 'SET steps_completed = :sc, updated_at = :u';
      const exprValues: Record<string, unknown> = {
        ':sc': stepsCompleted,
        ':u': now,
      };

      if (body.image_key && keyFieldMap[body.step]) {
        updateExpr += `, ${keyFieldMap[body.step]} = :ik`;
        exprValues[':ik'] = body.image_key;
      }

      if (nextStep) {
        updateExpr += ', current_step = :ns';
        exprValues[':ns'] = nextStep;
      }

      // Append location to trail if provided
      if (body.location) {
        // We need to use list_append for the location trail
        updateExpr += ', metadata.location_trail = list_append(if_not_exists(metadata.location_trail, :emptyList), :loc)';
        exprValues[':loc'] = [{ ...body.location, timestamp: now }];
        exprValues[':emptyList'] = [];
      }

      await ddbClient.send(new UpdateCommand({
        TableName: ENROLLMENT_SESSIONS_TABLE,
        Key: { session_id: sessionId },
        UpdateExpression: updateExpr,
        ExpressionAttributeValues: exprValues,
      }));

      logger.info('Step completed', { session_id: sessionId, step: body.step });
      return buildResponse(200, {
        session_id: sessionId,
        step_completed: body.step,
        next_step: nextStep,
        steps_completed: stepsCompleted,
      }, ALLOWED_ORIGIN);
    }

    // ─── POST /enrollment-sessions/{id}/complete → finalize session ───
    if (event.httpMethod === 'POST' && event.pathParameters?.id && path.includes('/complete')) {
      const sessionId = event.pathParameters.id;

      const sessionResult = await ddbClient.send(new GetCommand({
        TableName: ENROLLMENT_SESSIONS_TABLE,
        Key: { session_id: sessionId },
      }));

      if (!sessionResult.Item) {
        return buildErrorResponse(404, 'NOT_FOUND', 'Session not found', ALLOWED_ORIGIN);
      }

      const session = sessionResult.Item;
      const now = new Date().toISOString();

      // Update session as completed
      await ddbClient.send(new UpdateCommand({
        TableName: ENROLLMENT_SESSIONS_TABLE,
        Key: { session_id: sessionId },
        UpdateExpression: 'SET #s = :s, completed_at = :c, updated_at = :u',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':s': 'completed',
          ':c': now,
          ':u': now,
        },
      }));

      // Update enrollment request as completed
      if (session.request_id) {
        await ddbClient.send(new UpdateCommand({
          TableName: ENROLLMENT_REQUESTS_TABLE,
          Key: { request_id: session.request_id as string },
          UpdateExpression: 'SET #s = :s, completed_at = :c, updated_at = :u',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: {
            ':s': 'completed',
            ':c': now,
            ':u': now,
          },
        }));
      }

      logger.info('Enrollment session completed', { session_id: sessionId });
      return buildResponse(200, {
        session_id: sessionId,
        status: 'completed',
        message: 'Enrollment session completed successfully',
      }, ALLOWED_ORIGIN);
    }

    // ─── POST /enrollment-sessions/{id}/metadata → update session metadata ───
    if (event.httpMethod === 'POST' && event.pathParameters?.id && path.includes('/metadata')) {
      const sessionId = event.pathParameters.id;

      if (!event.body) {
        return buildErrorResponse(400, 'MISSING_BODY', 'Body required', ALLOWED_ORIGIN);
      }

      const body = JSON.parse(event.body) as {
        location_trail?: Array<Record<string, unknown>>;
        video_key?: string;
        audio_key?: string;
      };

      const now = new Date().toISOString();
      let updateExpr = 'SET updated_at = :u';
      const exprValues: Record<string, unknown> = { ':u': now };

      if (body.location_trail && body.location_trail.length > 0) {
        updateExpr += ', metadata.location_trail = list_append(if_not_exists(metadata.location_trail, :emptyList), :locs)';
        exprValues[':locs'] = body.location_trail;
        exprValues[':emptyList'] = [];
      }

      if (body.video_key) {
        updateExpr += ', metadata.video_key = :vk';
        exprValues[':vk'] = body.video_key;
      }

      if (body.audio_key) {
        updateExpr += ', metadata.audio_key = :ak';
        exprValues[':ak'] = body.audio_key;
      }

      await ddbClient.send(new UpdateCommand({
        TableName: ENROLLMENT_SESSIONS_TABLE,
        Key: { session_id: sessionId },
        UpdateExpression: updateExpr,
        ExpressionAttributeValues: exprValues,
      }));

      return buildResponse(200, { session_id: sessionId, message: 'Metadata updated' }, ALLOWED_ORIGIN);
    }

    return buildErrorResponse(400, 'BAD_REQUEST', 'Unsupported operation', ALLOWED_ORIGIN);
  } catch (err) {
    logger.error('Enrollment session error', err);
    const message = err instanceof Error ? err.message : 'Internal error';
    return buildErrorResponse(500, 'INTERNAL_ERROR', message, ALLOWED_ORIGIN);
  }
}
