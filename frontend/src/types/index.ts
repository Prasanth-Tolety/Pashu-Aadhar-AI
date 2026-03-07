// ─── Roles ───────────────────────────────────────────────────────────
export type UserRole = 'farmer' | 'enrollment_agent' | 'veterinarian' | 'insurer' | 'government' | 'admin';

export const ROLE_CONFIG: Record<UserRole, {
  label: string;
  prefix: string;
  color: string;
  gradient: string;
  icon: string;
  description: string;
}> = {
  farmer: {
    label: 'Farmer / Owner',
    prefix: 'FRM',
    color: '#2e7d32',
    gradient: 'linear-gradient(135deg, #43a047 0%, #2e7d32 100%)',
    icon: '🧑‍🌾',
    description: 'Livestock owner — request enrollment & manage your animals',
  },
  enrollment_agent: {
    label: 'Enrollment Agent',
    prefix: 'AGT',
    color: '#0277bd',
    gradient: 'linear-gradient(135deg, #29b6f6 0%, #0277bd 100%)',
    icon: '📋',
    description: 'Field agent — conduct on-site animal enrollment sessions',
  },
  veterinarian: {
    label: 'Veterinarian',
    prefix: 'VET',
    color: '#1565c0',
    gradient: 'linear-gradient(135deg, #42a5f5 0%, #1565c0 100%)',
    icon: '🩺',
    description: 'Veterinary doctor — access animal health records',
  },
  insurer: {
    label: 'Insurance Agent',
    prefix: 'INS',
    color: '#e65100',
    gradient: 'linear-gradient(135deg, #ff9800 0%, #e65100 100%)',
    icon: '🛡️',
    description: 'Insurance provider — view insured livestock data',
  },
  government: {
    label: 'Government Official',
    prefix: 'GOV',
    color: '#6a1b9a',
    gradient: 'linear-gradient(135deg, #ab47bc 0%, #6a1b9a 100%)',
    icon: '🏛️',
    description: 'Government body — oversight & regulatory access',
  },
  admin: {
    label: 'Administrator',
    prefix: 'ADM',
    color: '#c62828',
    gradient: 'linear-gradient(135deg, #ef5350 0%, #c62828 100%)',
    icon: '⚙️',
    description: 'System administrator — full platform access',
  },
};

export const ALL_ROLES: UserRole[] = ['farmer', 'enrollment_agent', 'veterinarian', 'insurer', 'government', 'admin'];

// ─── API ─────────────────────────────────────────────────────────────
export interface UploadUrlResponse {
  uploadUrl: string;
  imageKey: string;
}

export interface EnrollmentRequest {
  imageKey: string;
  owner_id?: string;
  latitude?: number;
  longitude?: number;
}

export interface EnrollmentResponse {
  status: 'NEW' | 'EXISTING';
  livestock_id: string;
  similarity: number;
  message?: string;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

export type EnrollmentStatus = 'idle' | 'uploading' | 'enrolling' | 'success' | 'error';

export interface EnrollmentState {
  status: EnrollmentStatus;
  imageFile: File | null;
  imagePreviewUrl: string | null;
  uploadProgress: number;
  result: EnrollmentResponse | null;
  error: string | null;
}

// ─── Animal ──────────────────────────────────────────────────────────
export interface Animal {
  livestock_id: string;
  embedding_id?: string;
  embedding_version?: string;
  enrollment_confidence_score?: number;
  biometric_type?: string;
  species?: string;
  breed?: string;
  gender?: string;
  age_months?: number;
  color_pattern?: string;
  horn_type?: string;
  identifiable_marks?: string;
  village?: string;
  district?: string;
  state?: string;
  region_code?: string;
  owner_id?: string;
  owner_name?: string;
  registered_by_user_id?: string;
  enrolled_at?: string;
  enrollment_timestamp?: string;
  image_key?: string;
  photo_key?: string;       // cow profile photo (full frame / cow crop)
  muzzle_key?: string;      // muzzle ROI (for embeddings, not editable)
  photo_url?: string;       // presigned URL for photo_key (from backend)
  muzzle_url?: string;      // presigned URL for muzzle_key (from backend)
  enrollment_latitude?: number;
  enrollment_longitude?: number;
  latitude?: number;
  longitude?: number;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

// ─── Access Request ──────────────────────────────────────────────────
export type AccessRequestStatus = 'pending' | 'approved' | 'denied';

export interface AccessRequest {
  request_id: string;
  livestock_id: string;
  requester_id: string;
  requester_role: string;
  requester_name?: string;
  owner_id: string;
  status: AccessRequestStatus;
  reason?: string;
  created_at: string;
  resolved_at?: string;
}

// ─── Profile ─────────────────────────────────────────────────────────
export interface OwnerProfile {
  owner_id: string;
  name: string;
  phone_number?: string;
  aadhaar_last4?: string;
  village?: string;
  district?: string;
  state?: string;
  pincode?: string;
  created_at?: string;
}

export interface UserProfile {
  user_id: string;
  phone_number: string;
  name: string;
  role: string;
  owner_id: string | null;
  aadhaar_last4?: string;
  owner?: OwnerProfile;
  role_mappings?: Array<{ role: string; user_id: string }>;
}

// ─── Animal Form (post-enrollment) ──────────────────────────────────
export interface AnimalFormData {
  species: string;
  breed: string;
  gender: string;
  age_months: number;
  color_pattern: string;
  horn_type: string;
  identifiable_marks: string;
  village: string;
  district: string;
  state: string;
}

// ─── Enrollment Request (farmer → agent assignment) ─────────────────
export type EnrollmentRequestStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';

export interface FarmerEnrollmentRequest {
  request_id: string;
  farmer_id: string;
  farmer_name?: string;
  farmer_phone?: string;
  address: {
    village: string;
    district: string;
    state: string;
    pincode?: string;
    landmark?: string;
  };
  animal_count?: number;
  preferred_date?: string;
  status: EnrollmentRequestStatus;
  assigned_agent_id?: string;
  assigned_agent_name?: string;
  scheduled_date?: string;
  agent_notes?: string;
  session_id?: string;
  created_at: string;
  updated_at?: string;
  completed_at?: string;
}

// ─── Enrollment Session (agent-driven capture) ──────────────────────
export type SessionStep = 'cow_detection' | 'muzzle_detection' | 'body_texture' | 'agent_selfie';
export type SessionStatus = 'active' | 'completed' | 'abandoned';

export interface EnrollmentSessionMetadata {
  device_info: {
    user_agent: string;
    screen_width: number;
    screen_height: number;
    platform: string;
    battery_level?: number;
    battery_charging?: boolean;
  };
  ip_address?: string;
  location_trail: Array<{
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: string;
  }>;
  // Placeholders for future recording features
  video_key?: string | null;
  audio_key?: string | null;
}

export interface EnrollmentSession {
  session_id: string;
  request_id: string;
  agent_id: string;
  agent_name?: string;
  farmer_id: string;
  status: SessionStatus;
  current_step: SessionStep;
  steps_completed: SessionStep[];
  // S3 keys for captured images
  cow_image_key?: string;
  muzzle_image_key?: string;
  body_texture_key?: string;
  agent_selfie_key?: string;
  // Metadata for fraud detection
  metadata: EnrollmentSessionMetadata;
  started_at: string;
  completed_at?: string;
}
