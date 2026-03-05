import { useLanguage } from '../../context/LanguageContext';
import './UploadProgress.css';

interface UploadProgressProps {
  progress: number;
  status: 'uploading' | 'enrolling';
}

export default function UploadProgress({ progress, status }: UploadProgressProps) {
  const { t } = useLanguage();
  return (
    <div className="upload-progress">
      <div className="progress-icon">
        {status === 'uploading' ? '⬆️' : '🔍'}
      </div>
      <p className="progress-label">
        {status === 'uploading'
          ? `${t.uploadingImage}... ${progress}%`
          : t.analyzingBiometrics}
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
