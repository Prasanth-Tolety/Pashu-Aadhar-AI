import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createLogger, buildResponse, buildErrorResponse } from '../shared/utils';

const logger = createLogger('animals');
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

const REGION = process.env.AWS_REGION || 'us-east-1';
const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const s3Client = new S3Client({ region: REGION });
const BUCKET_NAME = process.env.S3_BUCKET_NAME || '';

const ANIMALS_TABLE = 'animals';
const HEALTH_RECORDS_TABLE = 'health_records';
const MILK_YIELDS_TABLE = 'milk_yields';
const INSURANCE_TABLE = 'insurance_policies';
const LOANS_TABLE = 'loan_collateral';

/**
 * GET  /animals?owner_id=XXX        → list animals for an owner (farmer dashboard)
 * GET  /animals/{id}                → get single animal detail (vet lookup by livestock_id)
 * GET  /animals/{id}/health         → get health records for an animal
 * GET  /animals/{id}/milk           → get milk yields for an animal
 * POST /animals/{id}                → update animal metadata
 * POST /animals/{id}/health         → add health record (vet)
 * POST /animals/{id}/milk           → add milk yield (farmer)
 * GET  /animals/{id}/insurance      → get insurance policies
 * POST /animals/{id}/insurance      → add insurance policy
 * GET  /animals/{id}/loans          → get loan records
 * POST /animals/{id}/loans          → add loan record
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  logger.info('Animals API request', {
    method: event.httpMethod,
    path: event.path,
    pathParams: event.pathParameters,
    queryParams: event.queryStringParameters,
  });

  if (event.httpMethod === 'OPTIONS') {
    return buildResponse(200, {}, ALLOWED_ORIGIN);
  }

  try {
    const path = event.path;
    const method = event.httpMethod;

    // GET /animals?owner_id=XXX
    if (method === 'GET' && path === '/animals') {
      return await listAnimalsByOwner(event);
    }

    // GET /animals/{id}
    const singleAnimalMatch = path.match(/^\/animals\/([^/]+)$/);
    if (singleAnimalMatch && method === 'GET') {
      return await getAnimal(singleAnimalMatch[1]);
    }

    // POST /animals/{id} → update
    if (singleAnimalMatch && method === 'POST') {
      return await updateAnimal(singleAnimalMatch[1], event);
    }

    // GET /animals/{id}/health
    const healthMatch = path.match(/^\/animals\/([^/]+)\/health$/);
    if (healthMatch && method === 'GET') {
      return await getHealthRecords(healthMatch[1]);
    }

    // POST /animals/{id}/health → add health record
    if (healthMatch && method === 'POST') {
      return await addHealthRecord(healthMatch[1], event);
    }

    // GET /animals/{id}/milk
    const milkMatch = path.match(/^\/animals\/([^/]+)\/milk$/);
    if (milkMatch && method === 'GET') {
      return await getMilkYields(milkMatch[1]);
    }

    // POST /animals/{id}/milk → add milk yield
    if (milkMatch && method === 'POST') {
      return await addMilkYield(milkMatch[1], event);
    }

    // GET /animals/{id}/insurance
    const insuranceMatch = path.match(/^\/animals\/([^/]+)\/insurance$/);
    if (insuranceMatch && method === 'GET') {
      return await getInsurancePolicies(insuranceMatch[1]);
    }

    // POST /animals/{id}/insurance → add insurance policy
    if (insuranceMatch && method === 'POST') {
      return await addInsurancePolicy(insuranceMatch[1], event);
    }

    // GET /animals/{id}/loans
    const loansMatch = path.match(/^\/animals\/([^/]+)\/loans$/);
    if (loansMatch && method === 'GET') {
      return await getLoanRecords(loansMatch[1]);
    }

    // POST /animals/{id}/loans → add loan record
    if (loansMatch && method === 'POST') {
      return await addLoanRecord(loansMatch[1], event);
    }

    return buildErrorResponse(404, 'NOT_FOUND', 'Route not found', ALLOWED_ORIGIN);
  } catch (err) {
    logger.error('Animals API error', err);
    const message = err instanceof Error ? err.message : 'Internal error';
    return buildErrorResponse(500, 'INTERNAL_ERROR', message, ALLOWED_ORIGIN);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

/** Generate a presigned GET URL for an S3 key (1-hour expiry). */
async function getPresignedReadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
  return getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

/** Enrich an animal record with presigned URLs for photo_key and muzzle_key. */
async function enrichAnimalWithUrls(animal: Record<string, unknown>): Promise<Record<string, unknown>> {
  try {
    if (animal.photo_key && typeof animal.photo_key === 'string' && BUCKET_NAME) {
      animal.photo_url = await getPresignedReadUrl(animal.photo_key as string);
    }
    if (animal.muzzle_key && typeof animal.muzzle_key === 'string' && BUCKET_NAME) {
      animal.muzzle_url = await getPresignedReadUrl(animal.muzzle_key as string);
    }
  } catch (err) {
    logger.warn('Failed to generate presigned URLs for animal', err);
  }
  return animal;
}

// ─── Handlers ────────────────────────────────────────────────────────

async function listAnimalsByOwner(event: APIGatewayProxyEvent) {
  const ownerId = event.queryStringParameters?.owner_id;
  if (!ownerId) {
    return buildErrorResponse(400, 'MISSING_PARAM', 'owner_id query param is required', ALLOWED_ORIGIN);
  }

  const result = await ddbClient.send(new QueryCommand({
    TableName: ANIMALS_TABLE,
    IndexName: 'owner-index',
    KeyConditionExpression: 'owner_id = :oid',
    ExpressionAttributeValues: { ':oid': ownerId },
  }));

  // Enrich each animal with presigned photo URLs
  const animals = result.Items || [];
  const enriched = await Promise.all(animals.map((a) => enrichAnimalWithUrls(a as Record<string, unknown>)));

  return buildResponse(200, { animals: enriched }, ALLOWED_ORIGIN);
}

async function getAnimal(livestockId: string) {
  const result = await ddbClient.send(new GetCommand({
    TableName: ANIMALS_TABLE,
    Key: { livestock_id: livestockId },
  }));

  if (!result.Item) {
    return buildErrorResponse(404, 'NOT_FOUND', `Animal ${livestockId} not found`, ALLOWED_ORIGIN);
  }

  // Enrich with presigned photo URLs
  const animal = await enrichAnimalWithUrls(result.Item as Record<string, unknown>);

  // Also get insurance summary
  let insurance = null;
  try {
    const insResult = await ddbClient.send(new QueryCommand({
      TableName: INSURANCE_TABLE,
      IndexName: 'livestock-policy-index',
      KeyConditionExpression: 'livestock_id = :lid',
      ExpressionAttributeValues: { ':lid': livestockId },
      Limit: 1,
      ScanIndexForward: false,
    }));
    insurance = insResult.Items?.[0] || null;
  } catch {
    // Insurance index may not exist yet — ignore
  }

  return buildResponse(200, { animal, insurance }, ALLOWED_ORIGIN);
}

async function updateAnimal(livestockId: string, event: APIGatewayProxyEvent) {
  if (!event.body) {
    return buildErrorResponse(400, 'MISSING_BODY', 'Request body required', ALLOWED_ORIGIN);
  }

  const body = JSON.parse(event.body);
  const allowedFields = [
    'species', 'breed', 'gender', 'age_months', 'color_pattern',
    'horn_type', 'identifiable_marks', 'village', 'district', 'state',
    'photo_key',  // cow profile photo (editable), muzzle_key is NOT editable
  ];

  const updates: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates.push(`#${field} = :${field}`);
      names[`#${field}`] = field;
      values[`:${field}`] = body[field];
    }
  }

  if (updates.length === 0) {
    return buildErrorResponse(400, 'NO_UPDATES', 'No valid fields to update', ALLOWED_ORIGIN);
  }

  updates.push('#updated_at = :updated_at');
  names['#updated_at'] = 'updated_at';
  values[':updated_at'] = new Date().toISOString();

  await ddbClient.send(new UpdateCommand({
    TableName: ANIMALS_TABLE,
    Key: { livestock_id: livestockId },
    UpdateExpression: `SET ${updates.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  }));

  return buildResponse(200, { message: 'Animal updated', livestock_id: livestockId }, ALLOWED_ORIGIN);
}

async function getHealthRecords(livestockId: string) {
  const result = await ddbClient.send(new QueryCommand({
    TableName: HEALTH_RECORDS_TABLE,
    IndexName: 'livestock-health-index',
    KeyConditionExpression: 'livestock_id = :lid',
    ExpressionAttributeValues: { ':lid': livestockId },
    ScanIndexForward: false,
  }));

  return buildResponse(200, { records: result.Items || [] }, ALLOWED_ORIGIN);
}

async function addHealthRecord(livestockId: string, event: APIGatewayProxyEvent) {
  if (!event.body) {
    return buildErrorResponse(400, 'MISSING_BODY', 'Request body required', ALLOWED_ORIGIN);
  }

  const body = JSON.parse(event.body);
  const recordId = `HR-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  await ddbClient.send(new PutCommand({
    TableName: HEALTH_RECORDS_TABLE,
    Item: {
      record_id: recordId,
      livestock_id: livestockId,
      record_type: body.record_type || 'checkup',
      vaccine_type: body.vaccine_type || null,
      batch_number: body.batch_number || null,
      administered_by: body.administered_by || null,
      record_date: body.record_date || new Date().toISOString().split('T')[0],
      next_due_date: body.next_due_date || null,
      notes: body.notes || null,
      created_at: new Date().toISOString(),
    },
  }));

  return buildResponse(201, { message: 'Health record added', record_id: recordId }, ALLOWED_ORIGIN);
}

async function getMilkYields(livestockId: string) {
  const result = await ddbClient.send(new QueryCommand({
    TableName: MILK_YIELDS_TABLE,
    IndexName: 'livestock-milk-index',
    KeyConditionExpression: 'livestock_id = :lid',
    ExpressionAttributeValues: { ':lid': livestockId },
    ScanIndexForward: false,
    Limit: 30,
  }));

  return buildResponse(200, { yields: result.Items || [] }, ALLOWED_ORIGIN);
}

async function addMilkYield(livestockId: string, event: APIGatewayProxyEvent) {
  if (!event.body) {
    return buildErrorResponse(400, 'MISSING_BODY', 'Request body required', ALLOWED_ORIGIN);
  }

  const body = JSON.parse(event.body);
  const yieldId = `MY-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  const morning = parseFloat(body.morning_yield) || 0;
  const evening = parseFloat(body.evening_yield) || 0;

  await ddbClient.send(new PutCommand({
    TableName: MILK_YIELDS_TABLE,
    Item: {
      yield_id: yieldId,
      livestock_id: livestockId,
      yield_date: body.yield_date || new Date().toISOString().split('T')[0],
      morning_yield: morning,
      evening_yield: evening,
      total_yield: morning + evening,
      recorded_by: body.recorded_by || null,
      created_at: new Date().toISOString(),
    },
  }));

  return buildResponse(201, { message: 'Milk yield recorded', yield_id: yieldId }, ALLOWED_ORIGIN);
}

// ─── Insurance ───────────────────────────────────────────────────────

async function getInsurancePolicies(livestockId: string) {
  const result = await ddbClient.send(new QueryCommand({
    TableName: INSURANCE_TABLE,
    IndexName: 'livestock-policy-index',
    KeyConditionExpression: 'livestock_id = :lid',
    ExpressionAttributeValues: { ':lid': livestockId },
    ScanIndexForward: false,
  }));

  return buildResponse(200, { policies: result.Items || [] }, ALLOWED_ORIGIN);
}

async function addInsurancePolicy(livestockId: string, event: APIGatewayProxyEvent) {
  if (!event.body) {
    return buildErrorResponse(400, 'MISSING_BODY', 'Request body required', ALLOWED_ORIGIN);
  }

  const body = JSON.parse(event.body);
  const policyId = `INS-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  await ddbClient.send(new PutCommand({
    TableName: INSURANCE_TABLE,
    Item: {
      policy_id: policyId,
      livestock_id: livestockId,
      provider: body.provider || 'Unknown',
      policy_number: body.policy_number || null,
      coverage_amount: parseFloat(body.coverage_amount) || 0,
      premium: parseFloat(body.premium) || 0,
      start_date: body.start_date || new Date().toISOString().split('T')[0],
      end_date: body.end_date || null,
      status: body.status || 'active',
      notes: body.notes || null,
      created_at: new Date().toISOString(),
    },
  }));

  return buildResponse(201, { message: 'Insurance policy added', policy_id: policyId }, ALLOWED_ORIGIN);
}

// ─── Loans ───────────────────────────────────────────────────────────

async function getLoanRecords(livestockId: string) {
  const result = await ddbClient.send(new QueryCommand({
    TableName: LOANS_TABLE,
    IndexName: 'livestock-loan-index',
    KeyConditionExpression: 'livestock_id = :lid',
    ExpressionAttributeValues: { ':lid': livestockId },
    ScanIndexForward: false,
  }));

  return buildResponse(200, { loans: result.Items || [] }, ALLOWED_ORIGIN);
}

async function addLoanRecord(livestockId: string, event: APIGatewayProxyEvent) {
  if (!event.body) {
    return buildErrorResponse(400, 'MISSING_BODY', 'Request body required', ALLOWED_ORIGIN);
  }

  const body = JSON.parse(event.body);
  const loanId = `LN-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  await ddbClient.send(new PutCommand({
    TableName: LOANS_TABLE,
    Item: {
      loan_id: loanId,
      livestock_id: livestockId,
      lender: body.lender || 'Unknown',
      loan_amount: parseFloat(body.loan_amount) || 0,
      interest_rate: parseFloat(body.interest_rate) || 0,
      tenure_months: parseInt(body.tenure_months) || 12,
      disbursement_date: body.disbursement_date || new Date().toISOString().split('T')[0],
      repayment_status: body.repayment_status || 'active',
      notes: body.notes || null,
      created_at: new Date().toISOString(),
    },
  }));

  return buildResponse(201, { message: 'Loan record added', loan_id: loanId }, ALLOWED_ORIGIN);
}
