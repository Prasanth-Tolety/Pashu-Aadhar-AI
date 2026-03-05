import axios from 'axios';
import {
  UploadUrlResponse,
  EnrollmentRequest,
  EnrollmentResponse,
  Animal,
  AccessRequest,
  AnimalFormData,
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
  await apiClient.post(`/access-requests/${requestId}/${action}`, {}, {
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
