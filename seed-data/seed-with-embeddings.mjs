/**
 * seed-with-embeddings.mjs — Seed script that generates REAL embeddings
 * by calling the same SageMaker endpoint used during live enrollment.
 *
 * Flow:
 *   1. Discover face/muzzle image pairs from images/FaceSplit/train + MuzzleSplit/train
 *   2. Upload images to S3
 *   3. Call SageMaker endpoint to generate embeddings for each muzzle image
 *   4. Store embeddings in DynamoDB `embeddings` table (with real vectors)
 *   5. Populate all other tables (animals, owners, sessions, fraud_scores, etc.)
 *
 * Usage:
 *   node seed-with-embeddings.mjs                # Full seed
 *   ANIMAL_COUNT=10 node seed-with-embeddings.mjs # Limit
 *   DRY_RUN=true node seed-with-embeddings.mjs   # No writes
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { SageMakerRuntimeClient, InvokeEndpointCommand } from '@aws-sdk/client-sagemaker-runtime';
import { Client as OpenSearchClient } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import {
  REGIONS, BREEDS, FARMER_NAMES, AGENT_NAMES, VET_NAMES,
  VACCINE_TYPES, HEALTH_RECORD_TYPES, DISEASES,
  INSURANCE_PROVIDERS, COVERAGE_RANGES, BANKS,
  pick, randInt, randFloat, randDate, jitterCoords,
  randAadhaar, randPhone, randPincode, generateId,
} from './data-schema.mjs';

// ─── Config ──────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REGION = process.env.AWS_REGION || 'us-east-1';
const S3_BUCKET = process.env.S3_BUCKET || 'pashu-aadhaar-images-prod';
const SAGEMAKER_ENDPOINT = process.env.SAGEMAKER_ENDPOINT || 'pashu-clip-endpoint3';
const DRY_RUN = process.env.DRY_RUN === 'true';
const MAX_ANIMALS = parseInt(process.env.ANIMAL_COUNT || '0', 10) || Infinity;
const S3_CONCURRENCY = 15;
const SAGEMAKER_CONCURRENCY = 3; // conservative to avoid throttling
const BATCH_SIZE = 25;

const IMAGES_ROOT = path.resolve(__dirname, '..', 'images');
const FACE_DIR = path.join(IMAGES_ROOT, 'FaceSplit', 'train');
const MUZZLE_DIR = path.join(IMAGES_ROOT, 'MuzzleSplit', 'train');

const OPENSEARCH_ENDPOINT = process.env.OPENSEARCH_ENDPOINT || 'https://search-pashu-aadhaar-embeddings-64euxsz5rgt7v4dqfzouigrvhi.us-east-1.es.amazonaws.com';
const OPENSEARCH_INDEX = process.env.OPENSEARCH_INDEX || 'livestock-embeddings';
const OPENSEARCH_CONCURRENCY = 5;

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
  { marshallOptions: { removeUndefinedValues: true } }
);
const s3 = new S3Client({ region: REGION });
const sagemakerClient = new SageMakerRuntimeClient({ region: REGION });

function getOpenSearchClient() {
  return new OpenSearchClient({
    ...AwsSigv4Signer({
      region: REGION,
      getCredentials: () => defaultProvider()(),
    }),
    node: OPENSEARCH_ENDPOINT,
    requestTimeout: 30000,
  });
}

// ─── Accumulators ────────────────────────────────────────────────────

const ITEMS = {
  owners: [],
  user_role_mapping: [],
  enrollment_agents: [],
  animals: [],
  embeddings: [],
  enrollment_requests: [],
  enrollment_sessions: [],
  fraud_scores: [],
  health_records: [],
  milk_yields: [],
  insurance_policies: [],
  loan_collateral: [],
  access_requests: [],
};

const S3_UPLOADS = [];

// ─── Helpers ─────────────────────────────────────────────────────────

function generateLivestockId() {
  const ts = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `PA-${ts}-${r}`;
}

function isoDate(d) { return d instanceof Date ? d.toISOString() : new Date(d).toISOString(); }
function dayStr(d) { return isoDate(d).slice(0, 10); }

const now = new Date();
const ago90 = new Date(now.getTime() - 90 * 86400000);
const ago180 = new Date(now.getTime() - 180 * 86400000);
const ago365 = new Date(now.getTime() - 365 * 86400000);

// ─── SageMaker embedding generation ─────────────────────────────────

async function getEmbeddingFromSageMaker(imageBuffer) {
  const command = new InvokeEndpointCommand({
    EndpointName: SAGEMAKER_ENDPOINT,
    ContentType: 'application/octet-stream',
    Accept: 'application/json',
    Body: imageBuffer,
  });
  const response = await sagemakerClient.send(command);
  if (!response.Body) throw new Error('Empty response from SageMaker');
  const responseText = Buffer.from(response.Body).toString('utf-8');
  const raw = JSON.parse(responseText);

  let parsed;
  if (Array.isArray(raw) && typeof raw[0] === 'string') {
    parsed = JSON.parse(raw[0]);
  } else {
    parsed = raw;
  }

  if (!Array.isArray(parsed.embedding) || parsed.embedding.length === 0) {
    throw new Error('Invalid embedding from SageMaker');
  }
  return parsed.embedding;
}

// ─── Image pair discovery ────────────────────────────────────────────

function discoverImagePairs() {
  const faceFolders = fs.readdirSync(FACE_DIR).filter(f =>
    fs.statSync(path.join(FACE_DIR, f)).isDirectory()
  );
  const muzzleFolders = new Set(
    fs.readdirSync(MUZZLE_DIR).filter(f =>
      fs.statSync(path.join(MUZZLE_DIR, f)).isDirectory()
    )
  );

  const pairs = [];
  for (const folder of faceFolders) {
    if (!muzzleFolders.has(folder)) continue;
    const faceFiles = fs.readdirSync(path.join(FACE_DIR, folder)).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
    const muzzleFiles = fs.readdirSync(path.join(MUZZLE_DIR, folder)).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
    if (faceFiles.length > 0 && muzzleFiles.length > 0) {
      pairs.push({
        folder,
        faceFile: faceFiles[0],       // exactly 1 face
        muzzleFile: muzzleFiles[0],    // exactly 1 muzzle
        facePath: path.join(FACE_DIR, folder, faceFiles[0]),
        muzzlePath: path.join(MUZZLE_DIR, folder, muzzleFiles[0]),
      });
    }
  }
  pairs.sort(() => Math.random() - 0.5);
  return pairs.slice(0, Math.min(MAX_ANIMALS, pairs.length));
}

// ─── Generate agents ─────────────────────────────────────────────────

function generateAgents() {
  const agents = [];
  for (let i = 0; i < AGENT_NAMES.length; i++) {
    const region = REGIONS[i % REGIONS.length];
    const district = pick(region.districts);
    const agentId = `AGT-SEED-${String(i).padStart(3, '0')}`;
    const userId = `agent-user-${i}`;
    const ownerId = `OWN-AGENT-${String(i).padStart(3, '0')}`;
    const phone = randPhone();
    const createdAt = isoDate(randDate(ago365, ago90));

    agents.push({ agentId, name: AGENT_NAMES[i], region, district, ownerId, userId, phone, createdAt });

    ITEMS.enrollment_agents.push({
      agent_id: agentId, name: AGENT_NAMES[i], phone, email: `${AGENT_NAMES[i].toLowerCase().replace(/\s+/g, '.')}@pashu.gov.in`,
      state: region.state, district: district.name, status: 'active', total_enrollments: 0, created_at: createdAt,
    });
    ITEMS.owners.push({
      owner_id: ownerId, user_id: userId, phone_number: phone, name: AGENT_NAMES[i],
      role: 'enrollment_agent', aadhaar_last4: randAadhaar(), village: pick(district.villages),
      district: district.name, state: region.state, pincode: randPincode(region.code),
      created_at: createdAt, updated_at: createdAt,
    });
    ITEMS.user_role_mapping.push({
      mapping_id: `MAP-AGENT-${String(i).padStart(3, '0')}`, user_id: userId,
      role: 'enrollment_agent', owner_id: ownerId, created_at: createdAt,
    });
  }
  return agents;
}

// ─── Generate farmers ────────────────────────────────────────────────

function generateFarmers(count) {
  const farmers = [];
  for (let i = 0; i < count; i++) {
    const region = REGIONS[i % REGIONS.length];
    const district = pick(region.districts);
    const village = pick(district.villages);
    const ownerId = `OWN-SEED-${String(i).padStart(4, '0')}`;
    const userId = `farmer-user-${i}`;
    const phone = randPhone();
    const name = FARMER_NAMES[i % FARMER_NAMES.length];
    const createdAt = isoDate(randDate(ago365, ago90));

    farmers.push({ ownerId, userId, name, phone, region, district, village, createdAt });

    ITEMS.owners.push({
      owner_id: ownerId, user_id: userId, phone_number: phone, name, role: 'farmer',
      aadhaar_last4: randAadhaar(), village, district: district.name, state: region.state,
      pincode: randPincode(region.code), created_at: createdAt, updated_at: createdAt,
    });
    ITEMS.user_role_mapping.push({
      mapping_id: `MAP-FRM-${String(i).padStart(4, '0')}`, user_id: userId,
      role: 'farmer', owner_id: ownerId, created_at: createdAt,
    });
  }

  // Vet owner records
  for (let i = 0; i < VET_NAMES.length; i++) {
    const region = pick(REGIONS);
    const district = pick(region.districts);
    const ownerId = `OWN-VET-${String(i).padStart(3, '0')}`;
    const createdAt = isoDate(randDate(ago365, ago180));
    ITEMS.owners.push({
      owner_id: ownerId, user_id: `vet-user-${i}`, phone_number: randPhone(),
      name: VET_NAMES[i], role: 'veterinarian', aadhaar_last4: randAadhaar(),
      village: pick(district.villages), district: district.name, state: region.state,
      pincode: randPincode(region.code), created_at: createdAt, updated_at: createdAt,
    });
    ITEMS.user_role_mapping.push({
      mapping_id: `MAP-VETERINARIAN-${String(i).padStart(3, '0')}`,
      user_id: `vet-user-${i}`, role: 'veterinarian', owner_id: ownerId, created_at: createdAt,
    });
  }

  // Insurer owner records
  for (let i = 0; i < 4; i++) {
    const region = pick(REGIONS);
    const district = pick(region.districts);
    const ownerId = `OWN-INS-${String(i).padStart(3, '0')}`;
    const createdAt = isoDate(randDate(ago365, ago180));
    ITEMS.owners.push({
      owner_id: ownerId, user_id: `insurer-user-${i}`, phone_number: randPhone(),
      name: `${pick(INSURANCE_PROVIDERS).name} Rep`, role: 'insurer', aadhaar_last4: randAadhaar(),
      village: pick(district.villages), district: district.name, state: region.state,
      pincode: randPincode(region.code), created_at: createdAt, updated_at: createdAt,
    });
    ITEMS.user_role_mapping.push({
      mapping_id: `MAP-INSURER-${String(i).padStart(3, '0')}`,
      user_id: `insurer-user-${i}`, role: 'insurer', owner_id: ownerId, created_at: createdAt,
    });
  }

  return farmers;
}

// ─── Generate animal data (WITHOUT embedding — added later) ──────────

function generateAnimalData(pair, farmer, agent) {
  const breed = pick(BREEDS);
  const region = farmer.region;
  const district = farmer.district;
  const village = farmer.village;
  const coords = jitterCoords(district.lat, district.lng);
  const gender = Math.random() < 0.65 ? 'Female' : 'Male';
  const ageMonths = randInt(12, 120);
  const species = breed.type === 'buffalo' ? 'Buffalo' : 'Cattle';
  const enrolledAt = randDate(ago90, now);
  const enrolledIso = isoDate(enrolledAt);
  const livestockId = generateLivestockId();
  const embeddingId = `EMB-${livestockId}`;
  const sessionId = `SES-${generateId('S')}`;
  const requestId = `ENR-${generateId('R')}`;
  const faceKey = `enrollments/${pair.folder}/face_${pair.faceFile}`;
  const muzzleKey = `enrollments/${pair.folder}/muzzle_${pair.muzzleFile}`;

  S3_UPLOADS.push(
    { key: faceKey, localPath: pair.facePath, contentType: 'image/jpeg' },
    { key: muzzleKey, localPath: pair.muzzlePath, contentType: 'image/jpeg' },
  );

  const faceConf = randFloat(0.82, 0.99);
  const muzzleConf = randFloat(0.80, 0.98);
  const overallConf = randFloat(Math.min(faceConf, muzzleConf) - 0.02, Math.max(faceConf, muzzleConf));

  // animals table
  ITEMS.animals.push({
    livestock_id: livestockId, image_key: faceKey, muzzle_key: muzzleKey,
    photo_key: faceKey, cow_image_key: faceKey, body_texture_key: muzzleKey,
    embedding_id: embeddingId, embedding_version: 'clip-vit-b32-v1',
    enrollment_confidence_score: overallConf, biometric_type: 'face+muzzle',
    species, breed: breed.name, gender, age_months: ageMonths,
    color_pattern: breed.color, horn_type: breed.horns,
    identifiable_marks: pick(['White patch on forehead', 'Dark spot near left eye', 'Scar on right ear', 'None', 'Notch in left ear', 'Branded mark on rump', 'White socks on front legs']),
    village, district: district.name, state: region.state, region_code: region.code,
    owner_id: farmer.ownerId, owner_name: farmer.name,
    registered_by_user_id: agent.userId,
    enrolled_at: enrolledIso, enrollment_timestamp: enrolledIso,
    latitude: coords.lat, longitude: coords.lng,
    enrollment_latitude: coords.lat, enrollment_longitude: coords.lng,
    enrollment_session_id: sessionId,
    confidence_scores: { face: faceConf, muzzle: muzzleConf, overall: overallConf },
    status: 'active', created_at: enrolledIso, updated_at: enrolledIso,
  });

  // embeddings table — placeholder; real embedding vector added in step 3
  ITEMS.embeddings.push({
    embedding_id: embeddingId, livestock_id: livestockId,
    model_version: 'clip-vit-b32-v1', created_at: enrolledIso,
    _muzzlePath: pair.muzzlePath, // internal: used for SageMaker call
  });

  // enrollment_requests
  const reqCreated = new Date(enrolledAt.getTime() - randInt(1, 7) * 86400000);
  ITEMS.enrollment_requests.push({
    request_id: requestId, farmer_id: farmer.ownerId, farmer_name: farmer.name,
    farmer_phone: farmer.phone,
    address: { village, district: district.name, state: region.state, pincode: randPincode(region.code), landmark: pick(['Near temple', 'Behind school', 'Next to panchayat', 'Main road', 'Near well']) },
    animal_count: 1, preferred_date: dayStr(enrolledAt), status: 'completed',
    assigned_agent_id: agent.agentId, assigned_agent_name: agent.name,
    scheduled_date: dayStr(enrolledAt),
    agent_notes: pick(['Smooth enrollment', 'Animal was cooperative', 'Done during morning hours', 'Farmer very helpful', 'Good lighting conditions', '']),
    session_id: sessionId, created_at: isoDate(reqCreated), updated_at: enrolledIso, completed_at: enrolledIso,
  });

  // enrollment_sessions
  const sessionStart = new Date(enrolledAt.getTime() - randInt(10, 60) * 60000);
  ITEMS.enrollment_sessions.push({
    session_id: sessionId, request_id: requestId, agent_id: agent.agentId, agent_name: agent.name,
    farmer_id: farmer.ownerId, status: 'completed', current_step: 'completed',
    steps_completed: ['face_capture', 'muzzle_capture', 'details_entry', 'review', 'submit'],
    cow_image_key: faceKey, muzzle_image_key: muzzleKey, body_texture_key: muzzleKey,
    agent_selfie_key: `enrollments/${pair.folder}/agent_selfie.jpg`,
    metadata: {
      device_info: pick(['Samsung Galaxy A52 / Android 12', 'Xiaomi Redmi Note 11 / Android 13', 'Realme 9 Pro / Android 12', 'Samsung Galaxy M31 / Android 11', 'OnePlus Nord CE 2 / Android 12']),
      location_trail: [
        { lat: coords.lat, lng: coords.lng, ts: isoDate(sessionStart) },
        { lat: coords.lat + 0.0001, lng: coords.lng + 0.0001, ts: enrolledIso },
      ],
    },
    started_at: isoDate(sessionStart), completed_at: enrolledIso,
    created_at: isoDate(sessionStart), updated_at: enrolledIso,
  });

  // fraud_scores
  const fraudScore = randFloat(0.05, 0.55);
  const riskLevel = fraudScore < 0.15 ? 'low' : fraudScore < 0.30 ? 'medium' : fraudScore < 0.45 ? 'high' : 'critical';
  const flags = [];
  if (fraudScore > 0.2) flags.push('enrollment_speed_anomaly');
  if (fraudScore > 0.3) flags.push('location_mismatch');
  if (fraudScore > 0.4) flags.push('duplicate_biometric_suspect');
  ITEMS.fraud_scores.push({
    livestock_id: livestockId, session_id: sessionId, agent_id: agent.agentId, farmer_id: farmer.ownerId,
    fraud_risk_score: fraudScore, risk_level: riskLevel, flags,
    sub_scores: { biometric_consistency: randFloat(0.85, 1.0), location_consistency: randFloat(0.70, 1.0), enrollment_speed: randFloat(0.60, 1.0), agent_pattern: randFloat(0.80, 1.0) },
    metadata: { model_version: 'fraud-v2.1', processing_time_ms: randInt(50, 300) },
    confidence_scores: { face: faceConf, muzzle: muzzleConf },
    created_at: enrolledIso,
  });

  // health_records (1-3)
  const numHealth = randInt(1, 3);
  for (let h = 0; h < numHealth; h++) {
    const recType = pick(HEALTH_RECORD_TYPES);
    const recDate = randDate(ago180, now);
    const rec = { record_id: `HR-${livestockId}-${h}`, livestock_id: livestockId, record_type: recType, record_date: dayStr(recDate), notes: '', created_at: isoDate(recDate) };
    if (recType === 'vaccination') { const vac = pick(VACCINE_TYPES); rec.vaccine_type = vac.name; rec.batch_number = `BTH-${randInt(10000, 99999)}`; rec.administered_by = pick(VET_NAMES); rec.next_due_date = dayStr(new Date(recDate.getTime() + 180 * 86400000)); }
    else if (recType === 'treatment') { rec.notes = `Treatment for ${pick(DISEASES)}`; rec.administered_by = pick(VET_NAMES); }
    else if (recType === 'deworming') { rec.notes = pick(['Albendazole 10ml', 'Fenbendazole 7.5ml', 'Ivermectin injection']); rec.administered_by = pick(VET_NAMES); rec.next_due_date = dayStr(new Date(recDate.getTime() + 90 * 86400000)); }
    else { rec.notes = pick(['Routine checkup - healthy', 'Mild lameness observed', 'Good body condition score']); rec.administered_by = pick(VET_NAMES); }
    ITEMS.health_records.push(rec);
  }

  // milk_yields (females of dairy/buffalo/dual)
  if (gender === 'Female' && (breed.type === 'dairy' || breed.type === 'buffalo' || breed.type === 'dual')) {
    const daysOfMilk = randInt(7, 15);
    for (let d = 0; d < daysOfMilk; d++) {
      const yieldDate = new Date(now.getTime() - d * 86400000);
      const morningYield = randFloat(breed.avgMilk * 0.4, breed.avgMilk * 0.7);
      const eveningYield = randFloat(breed.avgMilk * 0.3, breed.avgMilk * 0.6);
      ITEMS.milk_yields.push({
        yield_id: `MY-${livestockId}-${d}`, livestock_id: livestockId, yield_date: dayStr(yieldDate),
        morning_yield: morningYield, evening_yield: eveningYield,
        total_yield: parseFloat((morningYield + eveningYield).toFixed(2)),
        recorded_by: farmer.name, created_at: isoDate(yieldDate),
      });
    }
  }

  // insurance_policies (40%)
  if (Math.random() < 0.40) {
    const provider = pick(INSURANCE_PROVIDERS);
    const coverage = COVERAGE_RANGES[breed.type] || COVERAGE_RANGES.dual;
    const coverageAmt = randInt(coverage.min, coverage.max);
    const startDate = randDate(ago365, ago90);
    ITEMS.insurance_policies.push({
      policy_id: `INS-${livestockId}`, livestock_id: livestockId, provider: provider.name,
      policy_number: `POL-${randInt(100000, 999999)}`, coverage_amount: coverageAmt,
      premium: Math.round(coverageAmt * randFloat(0.03, 0.06)),
      start_date: dayStr(startDate), end_date: dayStr(new Date(startDate.getTime() + 365 * 86400000)),
      status: pick(['active', 'active', 'active', 'expired', 'claimed']),
      notes: pick(['Under PMFBY', 'State subsidy applied', 'Full premium paid', '']),
      created_at: isoDate(startDate),
    });
  }

  // loan_collateral (20%)
  if (Math.random() < 0.20) {
    const lender = pick(BANKS);
    const loanAmt = randInt(15000, 100000);
    const disbDate = randDate(ago365, ago90);
    ITEMS.loan_collateral.push({
      loan_id: `LN-${livestockId}`, livestock_id: livestockId, lender, loan_amount: loanAmt,
      interest_rate: randFloat(4.0, 12.0), tenure_months: pick([12, 18, 24, 36]),
      disbursement_date: dayStr(disbDate), repayment_status: pick(['active', 'active', 'repaid', 'overdue']),
      notes: pick(['KCC Loan', 'Animal husbandry loan', 'Dairy development', '']),
      created_at: isoDate(disbDate),
    });
  }

  return { livestockId, ownerId: farmer.ownerId, enrolledIso };
}

// ─── Access requests ─────────────────────────────────────────────────

function generateAccessRequests(animalRecords) {
  const numRequests = Math.min(Math.ceil(animalRecords.length * 0.03), 15);
  const requesters = [
    ...VET_NAMES.map((n, i) => ({ id: `OWN-VET-${String(i).padStart(3, '0')}`, role: 'veterinarian', name: n })),
    ...Array.from({ length: 4 }, (_, i) => ({ id: `OWN-INS-${String(i).padStart(3, '0')}`, role: 'insurer', name: `Insurer Rep ${i + 1}` })),
  ];
  for (let i = 0; i < numRequests; i++) {
    const animal = pick(animalRecords);
    const requester = pick(requesters);
    const created = randDate(ago90, now);
    ITEMS.access_requests.push({
      request_id: `AR-${generateId('A')}`, livestock_id: animal.livestockId,
      requester_id: requester.id, requester_role: requester.role, requester_name: requester.name,
      owner_id: animal.ownerId, status: pick(['pending', 'approved', 'approved', 'denied']),
      reason: pick(['Vaccination record check', 'Insurance claim verification', 'Loan collateral inspection', 'Health assessment', 'Breeding program evaluation', 'Disease surveillance']),
      created_at: isoDate(created),
      resolved_at: Math.random() < 0.7 ? isoDate(new Date(created.getTime() + randInt(1, 48) * 3600000)) : undefined,
    });
  }
}

// ─── Batch writers ───────────────────────────────────────────────────

async function batchWriteTable(tableName, items) {
  if (DRY_RUN || items.length === 0) return;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const requests = batch.map(item => ({ PutRequest: { Item: item } }));
    let unprocessed = { [tableName]: requests };
    let retries = 0;
    while (unprocessed[tableName] && unprocessed[tableName].length > 0 && retries < 5) {
      try {
        const result = await ddb.send(new BatchWriteCommand({ RequestItems: unprocessed }));
        const leftover = result.UnprocessedItems || {};
        if (leftover[tableName] && leftover[tableName].length > 0) {
          unprocessed = leftover; retries++;
          await new Promise(r => setTimeout(r, 100 * Math.pow(2, retries)));
        } else break;
      } catch (err) {
        if (err.name === 'ProvisionedThroughputExceededException' || err.name === 'ThrottlingException') {
          retries++; await new Promise(r => setTimeout(r, 500 * Math.pow(2, retries)));
        } else throw err;
      }
    }
  }
}

async function uploadS3WithConcurrency(uploads, concurrency) {
  if (DRY_RUN || uploads.length === 0) return 0;
  let completed = 0, idx = 0;
  async function worker() {
    while (idx < uploads.length) {
      const current = idx++;
      const { key, localPath, contentType } = uploads[current];
      const body = fs.readFileSync(localPath);
      await s3.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: body, ContentType: contentType }));
      completed++;
      if (completed % 50 === 0) process.stdout.write(`\r    S3: ${completed}/${uploads.length}`);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, uploads.length) }, () => worker());
  await Promise.all(workers);
  if (uploads.length >= 50) process.stdout.write('\n');
  return completed;
}

// ─── SageMaker embedding generation with concurrency ─────────────────

async function generateEmbeddings(embeddingItems, concurrency) {
  if (DRY_RUN) {
    console.log('   (dry run — skipping SageMaker calls)');
    return 0;
  }

  let completed = 0, failed = 0, idx = 0;

  async function worker() {
    while (idx < embeddingItems.length) {
      const current = idx++;
      const item = embeddingItems[current];
      const muzzlePath = item._muzzlePath;
      delete item._muzzlePath; // remove internal field before writing to DDB

      try {
        const imageBuffer = fs.readFileSync(muzzlePath);
        const embedding = await getEmbeddingFromSageMaker(imageBuffer);
        item.embedding = embedding;
        item.embedding_dimensions = embedding.length;
        completed++;
      } catch (err) {
        // On failure, generate a zero-vector fallback and flag it
        item.embedding = null;
        item.embedding_error = err.message || 'Unknown error';
        failed++;
      }

      if ((completed + failed) % 10 === 0) {
        process.stdout.write(`\r    Embeddings: ${completed} OK, ${failed} failed / ${embeddingItems.length}`);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, embeddingItems.length) }, () => worker());
  await Promise.all(workers);
  process.stdout.write('\n');
  return completed;
}

// ─── OpenSearch indexing with concurrency ─────────────────────────────

async function indexEmbeddingsInOpenSearch(embeddingItems, animalItems, concurrency) {
  if (DRY_RUN) {
    console.log('   (dry run — skipping OpenSearch indexing)');
    return 0;
  }

  const osClient = getOpenSearchClient();

  // Build a map from embedding_id to livestock_id and muzzle_key
  const animalByLivestockId = {};
  for (const a of animalItems) {
    animalByLivestockId[a.livestock_id] = a;
  }

  // Filter to items that have real embeddings
  const validItems = embeddingItems.filter(e => e.embedding && Array.isArray(e.embedding) && e.embedding.length > 0);

  let completed = 0, failed = 0, idx = 0;

  async function worker() {
    while (idx < validItems.length) {
      const current = idx++;
      const item = validItems[current];
      const animal = animalByLivestockId[item.livestock_id];
      const imageKey = animal ? animal.muzzle_key : '';

      try {
        await osClient.index({
          index: OPENSEARCH_INDEX,
          id: item.livestock_id,
          body: {
            livestock_id: item.livestock_id,
            embedding: item.embedding,
            image_key: imageKey,
            enrolled_at: item.created_at,
          },
        });
        completed++;
      } catch (err) {
        failed++;
        if (failed <= 3) console.log(`\n    ⚠️  OpenSearch error: ${err.message}`);
      }

      if ((completed + failed) % 20 === 0) {
        process.stdout.write(`\r    OpenSearch: ${completed} indexed, ${failed} failed / ${validItems.length}`);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, validItems.length) }, () => worker());
  await Promise.all(workers);
  process.stdout.write('\n');
  return completed;
}

// ══════════════════════════════════════════════════════════════════════
// ─── MAIN ────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   Pashu Aadhaar AI — Seed with REAL Embeddings          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  SageMaker endpoint: ${SAGEMAKER_ENDPOINT}`);
  console.log(`  S3 bucket: ${S3_BUCKET}`);
  console.log();

  if (DRY_RUN) console.log('🏃 DRY RUN — no writes\n');

  // 0. Clear old OpenSearch index data
  if (!DRY_RUN) {
    console.log('🗑️  Clearing existing OpenSearch index...');
    try {
      const osClient = getOpenSearchClient();
      await osClient.deleteByQuery({
        index: OPENSEARCH_INDEX,
        body: { query: { match_all: {} } },
        refresh: true,
      });
      console.log('   ✅ OpenSearch index cleared\n');
    } catch (err) {
      if (err.statusCode === 404 || err.message?.includes('index_not_found')) {
        console.log('   ℹ️  Index does not exist yet, will be created on first insert\n');
      } else {
        console.log(`   ⚠️  Could not clear OpenSearch: ${err.message} — continuing anyway\n`);
      }
    }
  }

  // 1. Discover pairs
  console.log('📂 Discovering image pairs...');
  const pairs = discoverImagePairs();
  console.log(`   Found ${pairs.length} face/muzzle pairs\n`);
  if (pairs.length === 0) { console.error('❌ No pairs found.'); process.exit(1); }

  // 2. Generate agents & farmers
  console.log('👤 Generating agents...');
  const agents = generateAgents();
  console.log(`   ${agents.length} agents\n`);

  const numFarmers = Math.max(10, Math.ceil(pairs.length / randInt(2, 5)));
  console.log(`👩‍🌾 Generating ${numFarmers} farmers...\n`);
  const farmers = generateFarmers(numFarmers);

  // 3. Generate all animal data in memory
  console.log('🐄 Generating animal data...');
  const animalRecords = [];
  const agentEnrollCounts = {};
  for (let i = 0; i < pairs.length; i++) {
    const farmer = farmers[i % farmers.length];
    const agent = agents[i % agents.length];
    const rec = generateAnimalData(pairs[i], farmer, agent);
    animalRecords.push(rec);
    agentEnrollCounts[agent.agentId] = (agentEnrollCounts[agent.agentId] || 0) + 1;
    if ((i + 1) % 50 === 0) process.stdout.write(`\r   Generated ${i + 1}/${pairs.length}`);
  }
  if (pairs.length >= 50) process.stdout.write('\n');
  console.log(`   ${animalRecords.length} animals generated\n`);

  for (const a of ITEMS.enrollment_agents) { a.total_enrollments = agentEnrollCounts[a.agent_id] || 0; }
  generateAccessRequests(animalRecords);

  // 4. Summary
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   Generation Summary                                    ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  for (const t of Object.keys(ITEMS)) {
    console.log(`║   ${t.padEnd(25)} ${String(ITEMS[t].length).padStart(6)} items ║`);
  }
  console.log(`║   ${'S3 uploads'.padEnd(25)} ${String(S3_UPLOADS.length).padStart(6)} files ║`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  if (DRY_RUN) { console.log('✅ Dry run complete.\n'); return; }

  // 5. Upload images to S3
  console.log('📤 Uploading images to S3...');
  const startS3 = Date.now();
  const s3Count = await uploadS3WithConcurrency(S3_UPLOADS, S3_CONCURRENCY);
  console.log(`   ✅ ${s3Count} images uploaded in ${((Date.now() - startS3) / 1000).toFixed(1)}s\n`);

  // 6. Generate REAL embeddings via SageMaker
  console.log('🧠 Generating embeddings via SageMaker endpoint...');
  console.log(`   (${ITEMS.embeddings.length} muzzle images × SageMaker, concurrency=${SAGEMAKER_CONCURRENCY})`);
  const startEmb = Date.now();
  const embCount = await generateEmbeddings(ITEMS.embeddings, SAGEMAKER_CONCURRENCY);
  const embTime = ((Date.now() - startEmb) / 1000).toFixed(1);
  console.log(`   ✅ ${embCount} real embeddings generated in ${embTime}s\n`);

  // 6b. Index embeddings into OpenSearch (for similarity search)
  console.log('🔍 Indexing embeddings into OpenSearch...');
  console.log(`   (${ITEMS.embeddings.filter(e => e.embedding).length} valid embeddings, concurrency=${OPENSEARCH_CONCURRENCY})`);
  const startOs = Date.now();
  const osCount = await indexEmbeddingsInOpenSearch(ITEMS.embeddings, ITEMS.animals, OPENSEARCH_CONCURRENCY);
  const osTime = ((Date.now() - startOs) / 1000).toFixed(1);
  console.log(`   ✅ ${osCount} embeddings indexed in OpenSearch in ${osTime}s\n`);

  // Clean internal fields from embedding items
  for (const e of ITEMS.embeddings) {
    delete e._muzzlePath;
    // If embedding generation failed, remove the null embedding to avoid DDB errors
    if (e.embedding === null) delete e.embedding;
  }

  // 7. Batch write all tables
  console.log('📝 Writing to DynamoDB...');
  const startDdb = Date.now();
  let totalWritten = 0;
  for (const tableName of Object.keys(ITEMS)) {
    const items = ITEMS[tableName];
    if (items.length === 0) continue;
    process.stdout.write(`   ${tableName}... `);
    try {
      await batchWriteTable(tableName, items);
      console.log(`✅ ${items.length}`);
      totalWritten += items.length;
    } catch (err) {
      console.log(`❌ ${err.message}`);
    }
  }
  console.log(`\n   ✅ ${totalWritten} items in ${((Date.now() - startDdb) / 1000).toFixed(1)}s`);

  const totalTime = ((Date.now() - startS3) / 1000).toFixed(1);
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   ✅ Seeding Complete with Real Embeddings!              ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║   S3 uploads         : ${String(s3Count).padStart(6)}                       ║`);
  console.log(`║   Real embeddings    : ${String(embCount).padStart(6)}                       ║`);
  console.log(`║   OpenSearch indexed : ${String(osCount).padStart(6)}                       ║`);
  console.log(`║   DynamoDB items     : ${String(totalWritten).padStart(6)}                       ║`);
  console.log(`║   Total time         : ${(totalTime + 's').padStart(6)}                       ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');
}

main().catch(err => { console.error('\n❌ Seed failed:', err); process.exit(1); });
