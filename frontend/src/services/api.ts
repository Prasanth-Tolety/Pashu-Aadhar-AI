import axios from 'axios';
import {
  UploadUrlResponse,
  EnrollmentRequest,
  EnrollmentResponse,
  VerifyResponse,
  Animal,
  AccessRequest,
  AnimalFormData,
  FarmerEnrollmentRequest,
  EnrollmentSession,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

function authHeaders(token: string | null) {
  return token ? { Authorization: token } : {};
}

// ─── Public ──────────────────────────────────────────────────────────
export async function getUploadUrl(fileName: string, contentType: string): Promise<UploadUrlResponse> {
  const response = await apiClient.get<UploadUrlResponse>('/upload-url', {
    params: { fileName, contentType },
  });
  return response.data;
}

export async function enroll(request: EnrollmentRequest, token?: string | null): Promise<EnrollmentResponse> {
  const response = await apiClient.post<EnrollmentResponse>('/enroll', request, {
    headers: authHeaders(token ?? null),
  });
  return response.data;
}

export async function verifyAnimal(imageKey: string, token?: string | null): Promise<VerifyResponse> {
  const response = await apiClient.post<VerifyResponse>('/verify', { imageKey }, {
    headers: authHeaders(token ?? null),
  });
  return response.data;
}

// ─── Animals ─────────────────────────────────────────────────────────
export async function getAnimalsByOwner(ownerId: string, token: string): Promise<Animal[]> {
  const res = await apiClient.get('/animals', {
    params: { owner_id: ownerId },
    headers: authHeaders(token),
  });
  return res.data.animals || [];
}

export async function getAnimal(livestockId: string, token: string): Promise<{ animal: Animal; insurance: unknown }> {
  const res = await apiClient.get(`/animals/${livestockId}`, {
    headers: authHeaders(token),
  });
  return res.data;
}

export async function updateAnimal(livestockId: string, data: Partial<AnimalFormData>, token: string): Promise<void> {
  await apiClient.post(`/animals/${livestockId}`, data, {
    headers: authHeaders(token),
  });
}

// ─── Profile ─────────────────────────────────────────────────────────
export async function getProfile(token: string) {
  const res = await apiClient.get('/me', { headers: authHeaders(token) });
  return res.data.profile;
}

export async function updateProfile(data: Record<string, unknown>, token: string) {
  const res = await apiClient.post('/me', data, { headers: authHeaders(token) });
  return res.data;
}

// ─── Access Requests ─────────────────────────────────────────────────
export async function requestAccess(
  livestockId: string,
  reason: string,
  token: string
): Promise<AccessRequest> {
  const res = await apiClient.post(
    '/access-requests',
    { livestock_id: livestockId, reason },
    { headers: authHeaders(token) }
  );
  return res.data.request;
}

export async function getMyAccessRequests(token: string): Promise<AccessRequest[]> {
  const res = await apiClient.get('/access-requests', { headers: authHeaders(token) });
  return res.data.requests || [];
}

export async function getIncomingAccessRequests(token: string): Promise<AccessRequest[]> {
  const res = await apiClient.get('/access-requests/incoming', { headers: authHeaders(token) });
  return res.data.requests || [];
}

export async function resolveAccessRequest(
  requestId: string,
  action: 'approve' | 'deny',
  token: string
): Promise<void> {
  await apiClient.post(`/access-requests/${requestId}/resolve`, { action }, {
    headers: authHeaders(token),
  });
}

export async function getAccessibleAnimals(token: string): Promise<Animal[]> {
  const res = await apiClient.get('/access-requests/animals', { headers: authHeaders(token) });
  return res.data.animals || [];
}

// ─── Insurance ───────────────────────────────────────────────────────
export async function getInsurancePolicies(livestockId: string, token: string) {
  const res = await apiClient.get(`/animals/${livestockId}/insurance`, {
    headers: authHeaders(token),
  });
  return res.data.policies || [];
}

export async function addInsurancePolicy(
  livestockId: string,
  data: Record<string, unknown>,
  token: string
) {
  const res = await apiClient.post(`/animals/${livestockId}/insurance`, data, {
    headers: authHeaders(token),
  });
  return res.data;
}

// ─── Loans ───────────────────────────────────────────────────────────
export async function getLoanRecords(livestockId: string, token: string) {
  const res = await apiClient.get(`/animals/${livestockId}/loans`, {
    headers: authHeaders(token),
  });
  return res.data.loans || [];
}

export async function addLoanRecord(
  livestockId: string,
  data: Record<string, unknown>,
  token: string
) {
  const res = await apiClient.post(`/animals/${livestockId}/loans`, data, {
    headers: authHeaders(token),
  });
  return res.data;
}

// ─── Enrollment Requests (Farmer → Agent) ────────────────────────────
export async function createEnrollmentRequest(
  data: {
    address: { village: string; district: string; state: string; pincode?: string; landmark?: string };
    animal_count?: number;
    preferred_date?: string;
  },
  token: string
): Promise<{ request: FarmerEnrollmentRequest; message: string }> {
  const res = await apiClient.post('/enrollment-requests', data, {
    headers: authHeaders(token),
  });
  return res.data;
}

export async function getEnrollmentRequests(token: string): Promise<FarmerEnrollmentRequest[]> {
  const res = await apiClient.get('/enrollment-requests', {
    headers: authHeaders(token),
  });
  return res.data.requests || [];
}

export async function getEnrollmentRequest(requestId: string, token: string): Promise<FarmerEnrollmentRequest> {
  const res = await apiClient.get(`/enrollment-requests/${requestId}`, {
    headers: authHeaders(token),
  });
  return res.data.request;
}

export async function acceptEnrollmentRequest(
  requestId: string,
  data: { scheduled_date?: string; notes?: string },
  token: string
): Promise<{ message: string; request_id: string; scheduled_date: string | null }> {
  const res = await apiClient.post(`/enrollment-requests/${requestId}/accept`, data, {
    headers: authHeaders(token),
  });
  return res.data;
}

// ─── Enrollment Sessions (Agent-driven) ──────────────────────────────
export async function startEnrollmentSession(
  data: {
    request_id: string;
    metadata?: {
      device_info?: Record<string, unknown>;
      location_trail?: Array<Record<string, unknown>>;
    };
  },
  token: string
): Promise<{ session: EnrollmentSession }> {
  const res = await apiClient.post('/enrollment-sessions', data, {
    headers: authHeaders(token),
  });
  return res.data;
}

export async function getEnrollmentSessions(token: string): Promise<EnrollmentSession[]> {
  const res = await apiClient.get('/enrollment-sessions', {
    headers: authHeaders(token),
  });
  return res.data.sessions || [];
}

export async function getEnrollmentSession(sessionId: string, token: string): Promise<EnrollmentSession> {
  const res = await apiClient.get(`/enrollment-sessions/${sessionId}`, {
    headers: authHeaders(token),
  });
  return res.data.session;
}

export async function completeSessionStep(
  sessionId: string,
  data: {
    step: string;
    image_key?: string;
    location?: { latitude: number; longitude: number; accuracy: number };
  },
  token: string
) {
  const res = await apiClient.post(`/enrollment-sessions/${sessionId}/step`, data, {
    headers: authHeaders(token),
  });
  return res.data;
}

export async function completeEnrollmentSession(sessionId: string, token: string) {
  const res = await apiClient.post(`/enrollment-sessions/${sessionId}/complete`, {}, {
    headers: authHeaders(token),
  });
  return res.data;
}

export async function updateSessionMetadata(
  sessionId: string,
  data: {
    location_trail?: Array<Record<string, unknown>>;
    video_key?: string;
    audio_key?: string;
  },
  token: string
) {
  const res = await apiClient.post(`/enrollment-sessions/${sessionId}/metadata`, data, {
    headers: authHeaders(token),
  });
  return res.data;
}

// ─── Analytics (Government / Admin) ──────────────────────────────────
export async function getAnalyticsSummary(token: string) {
  const res = await apiClient.get('/analytics/summary', { headers: authHeaders(token) });
  return res.data;
}

export async function getAnalyticsStates(token: string) {
  const res = await apiClient.get('/analytics/states', { headers: authHeaders(token) });
  return res.data;
}

export async function getAnalyticsTrends(token: string) {
  const res = await apiClient.get('/analytics/trends', { headers: authHeaders(token) });
  return res.data;
}

export async function getAnalyticsBreeds(token: string) {
  const res = await apiClient.get('/analytics/breeds', { headers: authHeaders(token) });
  return res.data;
}

export async function getAnalyticsFraud(token: string) {
  const res = await apiClient.get('/analytics/fraud', { headers: authHeaders(token) });
  return res.data;
}

export async function getAnalyticsAgents(token: string) {
  const res = await apiClient.get('/analytics/agents', { headers: authHeaders(token) });
  return res.data;
}
