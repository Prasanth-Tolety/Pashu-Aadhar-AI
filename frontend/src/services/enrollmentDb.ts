/**
 * IndexedDB-backed enrollment store — replaces DynamoDB / OpenSearch for
 * fully-offline duplicate detection and enrollment persistence.
 *
 * Database : PashuAadhaarDB
 * Store    : enrollments
 * Record   : { livestock_id, embedding, enrolled_at, imageKey }
 */

import { Embedding, cosineSimilarity } from './embeddingService';

export interface EnrollmentRecord {
  livestock_id: string;
  embedding: Embedding;
  enrolled_at: string;
  imageKey: string;
}

export interface MatchResult {
  found: boolean;
  livestock_id: string | null;
  similarity: number;
}

const DB_NAME = 'PashuAadhaarDB';
const DB_VERSION = 1;
const STORE_NAME = 'enrollments';

/** Default cosine-similarity threshold (mirrors backend/shared/constants.ts) */
const SIMILARITY_THRESHOLD = 0.85;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'livestock_id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieve all enrollment records from IndexedDB.
 */
export async function getAllRecords(): Promise<EnrollmentRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as EnrollmentRecord[]);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Search for the most-similar existing enrollment.
 * Returns the best match (if above the threshold) or a miss.
 */
export async function findDuplicate(embedding: Embedding): Promise<MatchResult> {
  const records = await getAllRecords();

  let bestId: string | null = null;
  let bestSim = 0;

  for (const rec of records) {
    const sim = cosineSimilarity(embedding, rec.embedding);
    if (sim > bestSim) {
      bestSim = sim;
      bestId = rec.livestock_id;
    }
  }

  if (bestId && bestSim >= SIMILARITY_THRESHOLD) {
    return { found: true, livestock_id: bestId, similarity: bestSim };
  }
  return { found: false, livestock_id: null, similarity: bestSim };
}

/**
 * Store a new enrollment record in IndexedDB.
 */
export async function storeEnrollment(record: EnrollmentRecord): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
