import './UploadProgress.css';

interface UploadProgressProps {
  progress: number;
  status: 'uploading' | 'enrolling';
}

export default function UploadProgress({ progress, status }: UploadProgressProps) {
  return (
    <div className="upload-progress">
      <div className="progress-icon">
        {status === 'uploading' ? '⬆️' : '🔍'}
      </div>
      <p className="progress-label">
        {status === 'uploading'
          ? `Uploading image... ${progress}%`
          : 'Analyzing animal biometrics...'}
      </p>
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
