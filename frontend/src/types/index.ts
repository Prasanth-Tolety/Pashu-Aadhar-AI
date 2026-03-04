export interface UploadUrlResponse {
  uploadUrl: string;
  imageKey: string;
}

export interface EnrollmentRequest {
  imageKey: string;
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

export type EnrollmentStatus =
  | 'idle'
  | 'uploading'
  | 'enrolling'
  | 'quality'
  | 'detection'
  | 'cropping'
  | 'embedding'
  | 'matching'
  | 'storing'
  | 'success'
  | 'error';

export interface EnrollmentState {
  status: EnrollmentStatus;
  imageFile: File | null;
  imagePreviewUrl: string | null;
  uploadProgress: number;
  pipelineMessage: string | null;
  result: EnrollmentResponse | null;
  error: string | null;
}
