/**
 * fraudScoring — Computes fraud risk scores for enrollment sessions.
 *
 * Sub-scores:
 *   1. agent_behavior_score   — rate limiting, enrollment patterns
 *   2. device_trust_score     — device fingerprint reuse across accounts
 *   3. location_consistency_score — GPS vs registered address, cross-state
 *   4. image_quality_score    — detection confidence scores
 *   5. duplicate_embedding_score — similarity to existing enrollments
 *
 * Combined into a single fraud_risk_score (0–100, higher = more suspicious).
 * Stored in DynamoDB, visible only to admins.
 */

import fraudConfig from './fraud_config.json';

// ─── Types ───────────────────────────────────────────────────────────
export interface FraudMetadata {
  ip_address?: string;
  device_fingerprint?: string;
  user_agent?: string;
  screen_resolution?: string;
  platform?: string;
  gps_latitude?: number;
  gps_longitude?: number;
  gps_accuracy?: number;
  network_type?: string;
  timestamp: string;
}

export interface FraudInput {
  session_id: string;
  agent_id: string;
  farmer_id: string;
  /** Similarity score from weighted embedding search (0–1) */
  embedding_similarity: number;
  /** Confidence scores from detection steps */
  confidence_scores: {
    cow_detection?: number;
    muzzle_detection?: number;
    body_texture?: number;
  };
  /** Metadata collected during enrollment */
  metadata: FraudMetadata;
  /** Agent's enrollment count in the last hour */
  agent_enrollments_last_hour: number;
  /** Device's enrollment count today */
  device_enrollments_today: number;
  /** Whether the same device was used by a different agent */
  device_used_by_other_agents: boolean;
  /** Registered state of the farmer */
  farmer_registered_state?: string;
  /** GPS state derived from coordinates */
  gps_state?: string;
}

export interface FraudScoreResult {
  fraud_risk_score: number;
  agent_behavior_score: number;
  device_trust_score: number;
  location_consistency_score: number;
  image_quality_score: number;
  duplicate_embedding_score: number;
  flags: string[];
  risk_level: 'low' | 'medium' | 'high' | 'critical';
}

// ─── Config ──────────────────────────────────────────────────────────
const SCORING_WEIGHTS = fraudConfig.scoring_weights;
const THRESHOLDS = fraudConfig.fraud_thresholds;

// ─── Sub-Score Computers ─────────────────────────────────────────────

/**
 * Agent behavior: checks enrollment rate.
 * Returns 0–100 (0 = normal, 100 = very suspicious).
 */
function computeAgentBehaviorScore(input: FraudInput): { score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 0;

  // High enrollment rate
  if (input.agent_enrollments_last_hour > THRESHOLDS.max_enrollments_per_agent_per_hour) {
    score += 60;
    flags.push(`Agent enrolled ${input.agent_enrollments_last_hour} animals in last hour (limit: ${THRESHOLDS.max_enrollments_per_agent_per_hour})`);
  } else if (input.agent_enrollments_last_hour > THRESHOLDS.max_enrollments_per_agent_per_hour * 0.7) {
    score += 30;
    flags.push(`Agent approaching hourly enrollment limit`);
  }

  return { score: Math.min(100, score), flags };
}

/**
 * Device trust: checks device fingerprint reuse.
 * Returns 0–100.
 */
function computeDeviceTrustScore(input: FraudInput): { score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 0;

  // Same device used by different agents
  if (input.device_used_by_other_agents) {
    score += 50;
    flags.push('Device fingerprint used by multiple agents');
  }

  // Too many enrollments from same device in one day
  if (input.device_enrollments_today > THRESHOLDS.max_enrollments_per_device_per_day) {
    score += 50;
    flags.push(`${input.device_enrollments_today} enrollments from same device today (limit: ${THRESHOLDS.max_enrollments_per_device_per_day})`);
  } else if (input.device_enrollments_today > THRESHOLDS.max_enrollments_per_device_per_day * 0.7) {
    score += 25;
    flags.push('Device approaching daily enrollment limit');
  }

  // Missing device fingerprint
  if (!input.metadata.device_fingerprint) {
    score += 15;
    flags.push('No device fingerprint captured');
  }

  return { score: Math.min(100, score), flags };
}

/**
 * Location consistency: GPS vs registered address, cross-state.
 * Returns 0–100.
 */
function computeLocationConsistencyScore(input: FraudInput): { score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 0;

  // No GPS data
  if (!input.metadata.gps_latitude || !input.metadata.gps_longitude) {
    score += 40;
    flags.push('No GPS coordinates captured during enrollment');
    return { score, flags };
  }

  // Cross-state enrollment
  if (THRESHOLDS.cross_state_flag && input.farmer_registered_state && input.gps_state) {
    if (input.farmer_registered_state.toLowerCase() !== input.gps_state.toLowerCase()) {
      score += 70;
      flags.push(`Cross-state enrollment: farmer registered in ${input.farmer_registered_state}, GPS in ${input.gps_state}`);
    }
  }

  // Low GPS accuracy
  if (input.metadata.gps_accuracy && input.metadata.gps_accuracy > 500) {
    score += 20;
    flags.push(`Low GPS accuracy: ${Math.round(input.metadata.gps_accuracy)}m`);
  }

  return { score: Math.min(100, score), flags };
}

/**
 * Image quality: based on detection confidence scores.
 * Low confidence = potentially fraudulent (fake images, photos of photos, etc.)
 * Returns 0–100.
 */
function computeImageQualityScore(input: FraudInput): { score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 0;

  const { cow_detection, muzzle_detection } = input.confidence_scores;

  // Muzzle confidence (most important)
  if (muzzle_detection === undefined || muzzle_detection === null) {
    score += 50;
    flags.push('No muzzle detection confidence recorded');
  } else if (muzzle_detection < 0.4) {
    score += 40;
    flags.push(`Low muzzle detection confidence: ${(muzzle_detection * 100).toFixed(0)}%`);
  } else if (muzzle_detection < 0.6) {
    score += 15;
    flags.push(`Moderate muzzle detection confidence: ${(muzzle_detection * 100).toFixed(0)}%`);
  }

  // Cow detection
  if (cow_detection === undefined || cow_detection === null) {
    score += 20;
    flags.push('No cow detection confidence recorded');
  } else if (cow_detection < 0.4) {
    score += 20;
    flags.push(`Low cow detection confidence: ${(cow_detection * 100).toFixed(0)}%`);
  }

  return { score: Math.min(100, score), flags };
}

/**
 * Duplicate embedding: how similar is this animal to existing ones.
 * High similarity to an existing animal = possibly re-enrolling the same one.
 * Returns 0–100.
 */
function computeDuplicateEmbeddingScore(input: FraudInput): { score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 0;

  if (input.embedding_similarity >= THRESHOLDS.duplicate_embedding_min) {
    score += 80;
    flags.push(`High embedding similarity: ${(input.embedding_similarity * 100).toFixed(1)}% (possible duplicate)`);
  } else if (input.embedding_similarity >= THRESHOLDS.duplicate_embedding_min * 0.85) {
    score += 40;
    flags.push(`Moderate embedding similarity: ${(input.embedding_similarity * 100).toFixed(1)}%`);
  }

  return { score: Math.min(100, score), flags };
}

// ─── Main Score Computation ──────────────────────────────────────────

export function computeFraudRiskScore(input: FraudInput): FraudScoreResult {
  const agent = computeAgentBehaviorScore(input);
  const device = computeDeviceTrustScore(input);
  const location = computeLocationConsistencyScore(input);
  const imageQuality = computeImageQualityScore(input);
  const duplicate = computeDuplicateEmbeddingScore(input);

  const allFlags = [
    ...agent.flags,
    ...device.flags,
    ...location.flags,
    ...imageQuality.flags,
    ...duplicate.flags,
  ];

  // Weighted combination (each sub-score is 0–100, final is also 0–100)
  const fraudRiskScore = Math.round(
    agent.score * SCORING_WEIGHTS.agent_behavior_score +
    device.score * SCORING_WEIGHTS.device_trust_score +
    location.score * SCORING_WEIGHTS.location_consistency_score +
    imageQuality.score * SCORING_WEIGHTS.image_quality_score +
    duplicate.score * SCORING_WEIGHTS.duplicate_embedding_score
  );

  // Risk level
  let riskLevel: 'low' | 'medium' | 'high' | 'critical';
  if (fraudRiskScore < 20) riskLevel = 'low';
  else if (fraudRiskScore < 45) riskLevel = 'medium';
  else if (fraudRiskScore < 70) riskLevel = 'high';
  else riskLevel = 'critical';

  return {
    fraud_risk_score: Math.min(100, fraudRiskScore),
    agent_behavior_score: agent.score,
    device_trust_score: device.score,
    location_consistency_score: location.score,
    image_quality_score: imageQuality.score,
    duplicate_embedding_score: duplicate.score,
    flags: allFlags,
    risk_level: riskLevel,
  };
}
