import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ImageUpload from '../components/ImageUpload';
import CameraCapture from '../components/CameraCapture';
import UploadProgress from '../components/UploadProgress';
import { runOfflineEnrollment, ImageQualityError } from '../services/offlineEnrollment';
import { EnrollmentState, EnrollmentStatus } from '../types';
import '../styles/Enrollment.css';

export default function Enrollment() {
  const navigate = useNavigate();
  const [showCamera, setShowCamera] = useState(false);
  const [state, setState] = useState<EnrollmentState>({
    status: 'idle',
    imageFile: null,
    imagePreviewUrl: null,
    uploadProgress: 0,
    pipelineMessage: null,
    result: null,
    error: null,
  });

  useEffect(() => {
    return () => {
      if (state.imagePreviewUrl) {
        URL.revokeObjectURL(state.imagePreviewUrl);
      }
    };
  }, [state.imagePreviewUrl]);

  const handleFileSelect = useCallback((file: File) => {
    setState((prev) => {
      if (prev.imagePreviewUrl) {
        URL.revokeObjectURL(prev.imagePreviewUrl);
      }
      return {
        ...prev,
        imageFile: file,
        imagePreviewUrl: URL.createObjectURL(file),
        status: 'idle',
        error: null,
        result: null,
        pipelineMessage: null,
      };
    });
  }, []);

  const handleCapture = useCallback(
    (file: File) => {
      setShowCamera(false);
      handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleSubmit = async () => {
    if (!state.imageFile) return;

    setState((prev) => ({ ...prev, status: 'quality', uploadProgress: 0, error: null, pipelineMessage: null }));

    try {
      const pipelineResult = await runOfflineEnrollment(state.imageFile, (progress) => {
        setState((prev) => ({
          ...prev,
          status: progress.step as EnrollmentStatus,
          pipelineMessage: progress.message,
        }));
      });

      setState((prev) => ({ ...prev, status: 'success', result: pipelineResult.enrollment }));
      navigate('/result', { state: { result: pipelineResult.enrollment } });
    } catch (err: unknown) {
      let message: string;
      if (err instanceof ImageQualityError) {
        message = `Image quality issues: ${err.quality.issues.join('; ')}`;
      } else {
        message = err instanceof Error ? err.message : 'Enrollment failed. Please try again.';
      }
      setState((prev) => ({ ...prev, status: 'error', error: message, pipelineMessage: null }));
    }
  };

  const pipelineSteps: EnrollmentStatus[] = [
    'quality', 'detection', 'cropping', 'embedding', 'matching', 'storing',
  ];
  const isProcessing =
    state.status === 'uploading' ||
    state.status === 'enrolling' ||
    pipelineSteps.includes(state.status);

  return (
    <div className="page enrollment-page">
      <div className="container">
        <div className="page-header">
          <h1>Animal Enrollment</h1>
          <p>Capture or upload a clear photo of the animal&apos;s muzzle</p>
        </div>

        <div className="card">
          {isProcessing ? (
            <UploadProgress
              progress={state.uploadProgress}
              status={state.status}
              pipelineMessage={state.pipelineMessage}
            />
          ) : (
            <>
              <ImageUpload
                onFileSelect={handleFileSelect}
                onCameraOpen={() => setShowCamera(true)}
                previewUrl={state.imagePreviewUrl}
                disabled={isProcessing}
              />

              {state.error && (
                <div className="enrollment-error">
                  <span>⚠️</span>
                  <p>{state.error}</p>
                </div>
              )}

              {state.imageFile && (
                <button
                  className="btn btn-primary btn-full enroll-submit-btn"
                  onClick={handleSubmit}
                  disabled={isProcessing}
                >
                  🚀 Enroll Animal
                </button>
              )}
            </>
          )}
        </div>

        <div className="enrollment-tips card">
          <h4>📋 Photo Tips</h4>
          <ul>
            <li>Focus on the animal&apos;s muzzle/nose area</li>
            <li>Ensure good lighting — avoid harsh shadows</li>
            <li>Keep the camera steady for a sharp image</li>
            <li>Use minimum 640×480 pixel resolution</li>
          </ul>
        </div>
      </div>

      {showCamera && (
        <CameraCapture
          onCapture={handleCapture}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}
