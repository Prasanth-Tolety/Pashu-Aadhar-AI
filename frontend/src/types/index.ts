// ─── Roles ───────────────────────────────────────────────────────────
export type UserRole = 'farmer' | 'veterinarian' | 'insurer' | 'government' | 'admin';

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
    description: 'Livestock owner — enroll, manage & track your animals',
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

export const ALL_ROLES: UserRole[] = ['farmer', 'veterinarian', 'insurer', 'government', 'admin'];

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
  owner_id?: string;
  owner_name?: string;
  enrolled_at?: string;
  image_key?: string;
  photo_key?: string;       // cow profile photo (full frame / cow crop)
  muzzle_key?: string;      // muzzle ROI (for embeddings, not editable)
  photo_url?: string;       // presigned URL for photo_key (from backend)
  muzzle_url?: string;      // presigned URL for muzzle_key (from backend)
  latitude?: number;
  longitude?: number;
  status?: string;
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
