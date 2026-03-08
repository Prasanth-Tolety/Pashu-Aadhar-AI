/**
 * seed.mjs — Optimized Pashu Aadhaar AI seed script.
 *
 * Fills ALL 13 DynamoDB tables with realistic Indian-context data
 * using cow face/muzzle images from the local images/ folder.
 *
 * Optimizations:
 *   • Pre-generates ALL items in memory before writing
 *   • Uses DynamoDB BatchWriteItem (25 items per batch)
 *   • Parallel S3 uploads with concurrency limiter
 *
 * Usage:
 *   npm run seed                     # Full 300 animals
 *   ANIMAL_COUNT=10 npm run seed     # Limit to 10
 *   DRY_RUN=true npm run seed        # Dry run, no writes
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import {
  REGIONS, BREEDS, FARMER_NAMES, AGENT_NAMES, VET_NAMES,
  VACCINE_TYPES, HEALTH_RECORD_TYPES, DISEASES,
  INSURANCE_PROVIDERS, COVERAGE_RANGES, BANKS,
  pick, pickN, randInt, randFloat, randDate, jitterCoords,
  randAadhaar, randPhone, randPincode, generateId,
} from './data-schema.mjs';

// ─── Config ──────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REGION = process.env.AWS_REGION || 'us-east-1';
const S3_BUCKET = process.env.S3_BUCKET || 'pashu-aadhaar-images-prod';
const DRY_RUN = process.env.DRY_RUN === 'true';
const MAX_ANIMALS = parseInt(process.env.ANIMAL_COUNT || '0', 10) || Infinity;
const S3_CONCURRENCY = 15;
const BATCH_SIZE = 25; // DynamoDB BatchWriteItem limit

const IMAGES_ROOT = path.resolve(__dirname, '..', 'images');
const FACE_DIR = path.join(IMAGES_ROOT, 'FaceSplit', 'train');
const MUZZLE_DIR = path.join(IMAGES_ROOT, 'MuzzleSplit', 'train');

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
  { marshallOptions: { removeUndefinedValues: true } }
);
const s3 = new S3Client({ region: REGION });

// ─── Item accumulators (table → items[]) ─────────────────────────────

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

// S3 uploads queue: { key, localPath, contentType }
const S3_UPLOADS = [];

// ─── Helpers ─────────────────────────────────────────────────────────

function generateLivestockId() {
  const ts = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `PA-${ts}-${r}`;
}

function isoDate(d) {
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

function dayStr(d) {
  return isoDate(d).slice(0, 10);
}

const now = new Date();
const ago90 = new Date(now.getTime() - 90 * 86400000);
const ago180 = new Date(now.getTime() - 180 * 86400000);
const ago365 = new Date(now.getTime() - 365 * 86400000);

// ─── Discover image pairs ────────────────────────────────────────────

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

    const faceFiles = fs.readdirSync(path.join(FACE_DIR, folder))
      .filter(f => /\.(jpg|jpeg|png)$/i.test(f));
    const muzzleFiles = fs.readdirSync(path.join(MUZZLE_DIR, folder))
      .filter(f => /\.(jpg|jpeg|png)$/i.test(f));

    if (faceFiles.length > 0 && muzzleFiles.length > 0) {
      pairs.push({
        folder,
        faceFile: faceFiles[0],
        muzzleFile: muzzleFiles[0],
        facePath: path.join(FACE_DIR, folder, faceFiles[0]),
        muzzlePath: path.join(MUZZLE_DIR, folder, muzzleFiles[0]),
      });
    }
  }

  // Shuffle for varied state distribution
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
      agent_id: agentId,
      name: AGENT_NAMES[i],
      phone: phone,
      email: `${AGENT_NAMES[i].toLowerCase().replace(/\s+/g, '.')}@pashu.gov.in`,
      state: region.state,
      district: district.name,
      status: 'active',
      total_enrollments: 0,
      created_at: createdAt,
    });

    ITEMS.owners.push({
      owner_id: ownerId,
      user_id: userId,
      phone_number: phone,
      name: AGENT_NAMES[i],
      role: 'enrollment_agent',
      aadhaar_last4: randAadhaar(),
      village: pick(district.villages),
      district: district.name,
      state: region.state,
      pincode: randPincode(region.code),
      created_at: createdAt,
      updated_at: createdAt,
    });

    ITEMS.user_role_mapping.push({
      mapping_id: `MAP-AGENT-${String(i).padStart(3, '0')}`,
      user_id: userId,
      role: 'enrollment_agent',
      owner_id: ownerId,
      created_at: createdAt,
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
      owner_id: ownerId,
      user_id: userId,
      phone_number: phone,
      name,
      role: 'farmer',
      aadhaar_last4: randAadhaar(),
      village,
      district: district.name,
      state: region.state,
      pincode: randPincode(region.code),
      created_at: createdAt,
      updated_at: createdAt,
    });

    ITEMS.user_role_mapping.push({
      mapping_id: `MAP-FRM-${String(i).padStart(4, '0')}`,
      user_id: userId,
      role: 'farmer',
      owner_id: ownerId,
      created_at: createdAt,
    });
  }

  // Vet & insurer owner records
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

// ─── Generate data for one animal ────────────────────────────────────

function generateAnimalData(pair, farmer, agent) {
  const breed = pick(BREEDS);
  const region = farmer.region;
  const district = farmer.district;
  const village = farmer.village;
  const coords = jitterCoords(district.lat, district.lng);

  const gender = Math.random() < 0.65 ? 'Female' : 'Male';
  const ageMonths = randInt(12, 120);
  const species = breed.type === 'buffalo' ? 'Buffalo' : 'Cattle';

  // Spread enrollment dates across last 90 days for trend charts
  const enrolledAt = randDate(ago90, now);
  const enrolledIso = isoDate(enrolledAt);

  const livestockId = generateLivestockId();
  const embeddingId = `EMB-${livestockId}`;
  const sessionId = `SES-${generateId('S')}`;
  const requestId = `ENR-${generateId('R')}`;

  // S3 keys
  const faceKey = `enrollments/${pair.folder}/face_${pair.faceFile}`;
  const muzzleKey = `enrollments/${pair.folder}/muzzle_${pair.muzzleFile}`;

  // Queue S3 uploads
  S3_UPLOADS.push(
    { key: faceKey, localPath: pair.facePath, contentType: 'image/jpeg' },
    { key: muzzleKey, localPath: pair.muzzlePath, contentType: 'image/jpeg' },
  );

  // Confidence scores
  const faceConf = randFloat(0.82, 0.99);
  const muzzleConf = randFloat(0.80, 0.98);
  const overallConf = randFloat(
    Math.min(faceConf, muzzleConf) - 0.02,
    Math.max(faceConf, muzzleConf),
  );

  // ── animals table ──
  ITEMS.animals.push({
    livestock_id: livestockId,
    image_key: faceKey,
    muzzle_key: muzzleKey,
    photo_key: faceKey,
    cow_image_key: faceKey,
    body_texture_key: muzzleKey,
    embedding_id: embeddingId,
    embedding_version: 'clip-vit-b32-v1',
    enrollment_confidence_score: overallConf,
    biometric_type: 'face+muzzle',
    species,
    breed: breed.name,
    gender,
    age_months: ageMonths,
    color_pattern: breed.color,
    horn_type: breed.horns,
    identifiable_marks: pick([
      'White patch on forehead', 'Dark spot near left eye',
      'Scar on right ear', 'None', 'Notch in left ear',
      'Branded mark on rump', 'White socks on front legs',
    ]),
    village,
    district: district.name,
    state: region.state,
    region_code: region.code,
    owner_id: farmer.ownerId,
    owner_name: farmer.name,
    registered_by_user_id: agent.userId,
    enrolled_at: enrolledIso,
    enrollment_timestamp: enrolledIso,
    latitude: coords.lat,
    longitude: coords.lng,
    enrollment_latitude: coords.lat,
    enrollment_longitude: coords.lng,
    enrollment_session_id: sessionId,
    confidence_scores: { face: faceConf, muzzle: muzzleConf, overall: overallConf },
    status: 'active',
    created_at: enrolledIso,
    updated_at: enrolledIso,
  });

  // ── embeddings table ──
  ITEMS.embeddings.push({
    embedding_id: embeddingId,
    livestock_id: livestockId,
    model_version: 'clip-vit-b32-v1',
    created_at: enrolledIso,
  });

  // ── enrollment_requests table ──
  const reqCreated = new Date(enrolledAt.getTime() - randInt(1, 7) * 86400000);
  ITEMS.enrollment_requests.push({
    request_id: requestId,
    farmer_id: farmer.ownerId,
    farmer_name: farmer.name,
    farmer_phone: farmer.phone,
    address: {
      village,
      district: district.name,
      state: region.state,
      pincode: randPincode(region.code),
      landmark: pick(['Near temple', 'Behind school', 'Next to panchayat', 'Main road', 'Near well']),
    },
    animal_count: 1,
    preferred_date: dayStr(enrolledAt),
    status: 'completed',
    assigned_agent_id: agent.agentId,
    assigned_agent_name: agent.name,
    scheduled_date: dayStr(enrolledAt),
    agent_notes: pick([
      'Smooth enrollment', 'Animal was cooperative',
      'Done during morning hours', 'Farmer very helpful',
      'Good lighting conditions', '',
    ]),
    session_id: sessionId,
    created_at: isoDate(reqCreated),
    updated_at: enrolledIso,
    completed_at: enrolledIso,
  });

  // ── enrollment_sessions table ──
  const sessionStart = new Date(enrolledAt.getTime() - randInt(10, 60) * 60000);
  ITEMS.enrollment_sessions.push({
    session_id: sessionId,
    request_id: requestId,
    agent_id: agent.agentId,
    agent_name: agent.name,
    farmer_id: farmer.ownerId,
    status: 'completed',
    current_step: 'completed',
    steps_completed: ['face_capture', 'muzzle_capture', 'details_entry', 'review', 'submit'],
    cow_image_key: faceKey,
    muzzle_image_key: muzzleKey,
    body_texture_key: muzzleKey,
    agent_selfie_key: `enrollments/${pair.folder}/agent_selfie.jpg`,
    metadata: {
      device_info: pick([
        'Samsung Galaxy A52 / Android 12',
        'Xiaomi Redmi Note 11 / Android 13',
        'Realme 9 Pro / Android 12',
        'Samsung Galaxy M31 / Android 11',
        'OnePlus Nord CE 2 / Android 12',
      ]),
      location_trail: [
        { lat: coords.lat, lng: coords.lng, ts: isoDate(sessionStart) },
        { lat: coords.lat + 0.0001, lng: coords.lng + 0.0001, ts: enrolledIso },
      ],
    },
    started_at: isoDate(sessionStart),
    completed_at: enrolledIso,
    created_at: isoDate(sessionStart),
    updated_at: enrolledIso,
  });

  // ── fraud_scores table ──
  const fraudScore = randFloat(0.05, 0.55);
  const riskLevel = fraudScore < 0.15 ? 'low' : fraudScore < 0.30 ? 'medium' : fraudScore < 0.45 ? 'high' : 'critical';
  const flags = [];
  if (fraudScore > 0.2) flags.push('enrollment_speed_anomaly');
  if (fraudScore > 0.3) flags.push('location_mismatch');
  if (fraudScore > 0.4) flags.push('duplicate_biometric_suspect');

  ITEMS.fraud_scores.push({
    livestock_id: livestockId,
    session_id: sessionId,
    agent_id: agent.agentId,
    farmer_id: farmer.ownerId,
    fraud_risk_score: fraudScore,
    risk_level: riskLevel,
    flags,
    sub_scores: {
      biometric_consistency: randFloat(0.85, 1.0),
      location_consistency: randFloat(0.70, 1.0),
      enrollment_speed: randFloat(0.60, 1.0),
      agent_pattern: randFloat(0.80, 1.0),
    },
    metadata: {
      model_version: 'fraud-v2.1',
      processing_time_ms: randInt(50, 300),
    },
    confidence_scores: { face: faceConf, muzzle: muzzleConf },
    created_at: enrolledIso,
  });

  // ── health_records — 1-3 per animal ──
  const numHealth = randInt(1, 3);
  for (let h = 0; h < numHealth; h++) {
    const recType = pick(HEALTH_RECORD_TYPES);
    const recDate = randDate(ago180, now);
    const rec = {
      record_id: `HR-${livestockId}-${h}`,
      livestock_id: livestockId,
      record_type: recType,
      record_date: dayStr(recDate),
      notes: '',
      created_at: isoDate(recDate),
    };
    if (recType === 'vaccination') {
      const vac = pick(VACCINE_TYPES);
      rec.vaccine_type = vac.name;
      rec.batch_number = `BTH-${randInt(10000, 99999)}`;
      rec.administered_by = pick(VET_NAMES);
      rec.next_due_date = dayStr(new Date(recDate.getTime() + 180 * 86400000));
    } else if (recType === 'treatment') {
      rec.notes = `Treatment for ${pick(DISEASES)}`;
      rec.administered_by = pick(VET_NAMES);
    } else if (recType === 'deworming') {
      rec.notes = pick(['Albendazole 10ml', 'Fenbendazole 7.5ml', 'Ivermectin injection']);
      rec.administered_by = pick(VET_NAMES);
      rec.next_due_date = dayStr(new Date(recDate.getTime() + 90 * 86400000));
    } else {
      rec.notes = pick(['Routine checkup - healthy', 'Mild lameness observed', 'Good body condition score']);
      rec.administered_by = pick(VET_NAMES);
    }
    ITEMS.health_records.push(rec);
  }

  // ── milk_yields — last 15 days for dairy/buffalo females ──
  if (gender === 'Female' && (breed.type === 'dairy' || breed.type === 'buffalo' || breed.type === 'dual')) {
    const daysOfMilk = randInt(7, 15);
    for (let d = 0; d < daysOfMilk; d++) {
      const yieldDate = new Date(now.getTime() - d * 86400000);
      const morningYield = randFloat(breed.avgMilk * 0.4, breed.avgMilk * 0.7);
      const eveningYield = randFloat(breed.avgMilk * 0.3, breed.avgMilk * 0.6);
      ITEMS.milk_yields.push({
        yield_id: `MY-${livestockId}-${d}`,
        livestock_id: livestockId,
        yield_date: dayStr(yieldDate),
        morning_yield: morningYield,
        evening_yield: eveningYield,
        total_yield: parseFloat((morningYield + eveningYield).toFixed(2)),
        recorded_by: farmer.name,
        created_at: isoDate(yieldDate),
      });
    }
  }

  // ── insurance_policies — 40% chance ──
  if (Math.random() < 0.40) {
    const provider = pick(INSURANCE_PROVIDERS);
    const coverage = COVERAGE_RANGES[breed.type] || COVERAGE_RANGES.dual;
    const coverageAmt = randInt(coverage.min, coverage.max);
    const startDate = randDate(ago365, ago90);
    ITEMS.insurance_policies.push({
      policy_id: `INS-${livestockId}`,
      livestock_id: livestockId,
      provider: provider.name,
      policy_number: `POL-${randInt(100000, 999999)}`,
      coverage_amount: coverageAmt,
      premium: Math.round(coverageAmt * randFloat(0.03, 0.06)),
      start_date: dayStr(startDate),
      end_date: dayStr(new Date(startDate.getTime() + 365 * 86400000)),
      status: pick(['active', 'active', 'active', 'expired', 'claimed']),
      notes: pick(['Under PMFBY', 'State subsidy applied', 'Full premium paid', '']),
      created_at: isoDate(startDate),
    });
  }

  // ── loan_collateral — 20% chance ──
  if (Math.random() < 0.20) {
    const lender = pick(BANKS);
    const loanAmt = randInt(15000, 100000);
    const disbDate = randDate(ago365, ago90);
    ITEMS.loan_collateral.push({
      loan_id: `LN-${livestockId}`,
      livestock_id: livestockId,
      lender,
      loan_amount: loanAmt,
      interest_rate: randFloat(4.0, 12.0),
      tenure_months: pick([12, 18, 24, 36]),
      disbursement_date: dayStr(disbDate),
      repayment_status: pick(['active', 'active', 'repaid', 'overdue']),
      notes: pick(['KCC Loan', 'Animal husbandry loan', 'Dairy development', '']),
      created_at: isoDate(disbDate),
    });
  }

  return { livestockId, ownerId: farmer.ownerId, enrolledIso };
}

// ─── Generate access requests ────────────────────────────────────────

function generateAccessRequests(animalRecords) {
  const numRequests = Math.min(Math.ceil(animalRecords.length * 0.03), 15);
  const requesters = [
    ...VET_NAMES.map((n, i) => ({ id: `OWN-VET-${String(i).padStart(3, '0')}`, role: 'veterinarian', name: n })),
    ...Array.from({ length: 4 }, (_, i) => ({
      id: `OWN-INS-${String(i).padStart(3, '0')}`, role: 'insurer', name: `Insurer Rep ${i + 1}`,
    })),
  ];

  for (let i = 0; i < numRequests; i++) {
    const animal = pick(animalRecords);
    const requester = pick(requesters);
    const created = randDate(ago90, now);
    ITEMS.access_requests.push({
      request_id: `AR-${generateId('A')}`,
      livestock_id: animal.livestockId,
      requester_id: requester.id,
      requester_role: requester.role,
      requester_name: requester.name,
      owner_id: animal.ownerId,
      status: pick(['pending', 'approved', 'approved', 'denied']),
      reason: pick([
        'Vaccination record check', 'Insurance claim verification',
        'Loan collateral inspection', 'Health assessment',
        'Breeding program evaluation', 'Disease surveillance',
      ]),
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
          unprocessed = leftover;
          retries++;
          await new Promise(r => setTimeout(r, 100 * Math.pow(2, retries)));
        } else {
          break;
        }
      } catch (err) {
        if (err.name === 'ProvisionedThroughputExceededException' || err.name === 'ThrottlingException') {
          retries++;
          await new Promise(r => setTimeout(r, 500 * Math.pow(2, retries)));
        } else {
          throw err;
        }
      }
    }
  }
}

async function uploadS3WithConcurrency(uploads, concurrency) {
  if (DRY_RUN || uploads.length === 0) return 0;

  let completed = 0;
  let idx = 0;

  async function worker() {
    while (idx < uploads.length) {
      const current = idx++;
      const { key, localPath, contentType } = uploads[current];
      const body = fs.readFileSync(localPath);
      await s3.send(new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
      }));
      completed++;
      if (completed % 50 === 0) {
        process.stdout.write(`\r    S3: ${completed}/${uploads.length}`);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, uploads.length) }, () => worker());
  await Promise.all(workers);
  if (uploads.length >= 50) process.stdout.write('\n');
  return completed;
}

// ══════════════════════════════════════════════════════════════════════
// ─── MAIN ────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   Pashu Aadhaar AI — Seed Data (Optimized Batch)        ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log();

  if (DRY_RUN) console.log('🏃 DRY RUN — no writes will be performed\n');

  // 1. Discover image pairs
  console.log('📂 Discovering image pairs...');
  const pairs = discoverImagePairs();
  console.log(`   Found ${pairs.length} face/muzzle pairs\n`);

  if (pairs.length === 0) {
    console.error('❌ No image pairs found. Check images/ directory.');
    process.exit(1);
  }

  // 2. Generate agents
  console.log('👤 Generating enrollment agents...');
  const agents = generateAgents();
  console.log(`   ${agents.length} agents\n`);

  // 3. Generate farmers (~1 farmer per 2-5 animals)
  const numFarmers = Math.max(10, Math.ceil(pairs.length / randInt(2, 5)));
  console.log(`👩‍🌾 Generating ${numFarmers} farmers...\n`);
  const farmers = generateFarmers(numFarmers);

  // 4. Generate all animal data in memory
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

  // Update agent enrollment counts
  for (const a of ITEMS.enrollment_agents) {
    a.total_enrollments = agentEnrollCounts[a.agent_id] || 0;
  }

  // 5. Generate access requests
  generateAccessRequests(animalRecords);

  // 6. Summary
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   Generation Summary                                    ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  for (const t of Object.keys(ITEMS)) {
    console.log(`║   ${t.padEnd(25)} ${String(ITEMS[t].length).padStart(6)} items ║`);
  }
  console.log(`║   ${'S3 uploads'.padEnd(25)} ${String(S3_UPLOADS.length).padStart(6)} files ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log();

  if (DRY_RUN) {
    console.log('✅ Dry run complete. No data written.\n');
    return;
  }

  // 7. Upload to S3
  console.log('📤 Uploading images to S3...');
  const startS3 = Date.now();
  const s3Count = await uploadS3WithConcurrency(S3_UPLOADS, S3_CONCURRENCY);
  const s3Time = ((Date.now() - startS3) / 1000).toFixed(1);
  console.log(`   ✅ ${s3Count} images uploaded in ${s3Time}s\n`);

  // 8. Batch write all tables
  console.log('📝 Writing to DynamoDB (batch mode)...');
  const startDdb = Date.now();
  let totalWritten = 0;

  for (const tableName of Object.keys(ITEMS)) {
    const items = ITEMS[tableName];
    if (items.length === 0) continue;
    process.stdout.write(`   ${tableName}... `);
    try {
      await batchWriteTable(tableName, items);
      console.log(`✅ ${items.length} items`);
      totalWritten += items.length;
    } catch (err) {
      console.log(`❌ ${err.message}`);
    }
  }

  const ddbTime = ((Date.now() - startDdb) / 1000).toFixed(1);
  console.log(`\n   ✅ ${totalWritten} DynamoDB items written in ${ddbTime}s`);

  // 9. Final summary
  const totalTime = ((Date.now() - startS3) / 1000).toFixed(1);
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   ✅ Seeding Complete!                                   ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║   Total S3 uploads    : ${String(s3Count).padStart(6)}                       ║`);
  console.log(`║   Total DynamoDB items : ${String(totalWritten).padStart(6)}                       ║`);
  console.log(`║   Total time           : ${String(totalTime + 's').padStart(6)}                       ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');
}

main().catch(err => {
  console.error('\n❌ Seed failed:', err);
  process.exit(1);
});
