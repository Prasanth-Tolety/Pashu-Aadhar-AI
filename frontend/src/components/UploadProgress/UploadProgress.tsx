import { EnrollmentStatus } from '../../types';
import './UploadProgress.css';

interface UploadProgressProps {
  progress: number;
  status: EnrollmentStatus;
  pipelineMessage?: string | null;
}

const STEP_LABELS: Partial<Record<EnrollmentStatus, { icon: string; label: string }>> = {
  uploading: { icon: '⬆️', label: 'Uploading image…' },
  enrolling: { icon: '🔍', label: 'Analyzing animal biometrics…' },
  quality: { icon: '🔎', label: 'Checking image quality…' },
  detection: { icon: '🐄', label: 'Detecting muzzle region…' },
  cropping: { icon: '✂️', label: 'Cropping muzzle region…' },
  embedding: { icon: '🧬', label: 'Generating biometric embedding…' },
  matching: { icon: '🔍', label: 'Searching for duplicates…' },
  storing: { icon: '💾', label: 'Enrolling new animal…' },
};

export default function UploadProgress({ progress, status, pipelineMessage }: UploadProgressProps) {
  const stepInfo = STEP_LABELS[status] ?? { icon: '🔄', label: 'Processing…' };
  const label = pipelineMessage ?? (status === 'uploading' ? `${stepInfo.label} ${progress}%` : stepInfo.label);

  return (
    <div className="upload-progress">
      <div className="progress-icon">
        {stepInfo.icon}
      </div>
      <p className="progress-label">{label}</p>
      {status === 'uploading' ? (
        <div className="progress-bar-container" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="progress-bar" style={{ width: `${progress}%` }} />
        </div>
      ) : (
        <div className="progress-spinner">
          <div className="spinner" />
        </div>
      )}
    </div>
  );
}
