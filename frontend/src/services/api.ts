import axios from 'axios';
import { UploadUrlResponse, EnrollmentRequest, EnrollmentResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function getUploadUrl(fileName: string, contentType: string): Promise<UploadUrlResponse> {
  const response = await apiClient.get<UploadUrlResponse>('/api/get-upload-url', {
    params: { fileName, contentType },
  });
  return response.data;
}

export async function enroll(request: EnrollmentRequest): Promise<EnrollmentResponse> {
  const response = await apiClient.post<EnrollmentResponse>('/api/enroll', request);
  return response.data;
}
