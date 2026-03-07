import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
// useLanguage reserved for i18n translations
import {
  getEnrollmentRequests,
  startEnrollmentSession,
  getEnrollmentSession,
  completeSessionStep,
  completeEnrollmentSession,
  updateSessionMetadata,
  getUploadUrl,
  enroll,
} from '../services/api';
import { uploadToS3 } from '../services/s3';
import { preloadModels } from '../hooks/useModelPreloader';
import CameraCapture from '../components/CameraCapture';
import AgentStepCapture from '../components/AgentStepCapture';
import enrollmentConfig from '../config/enrollmentConfig.json';
import {
  FarmerEnrollmentRequest,
  EnrollmentSession,
  SessionStep,
} from '../types';
import '../styles/Enrollment.css';

// ─── Device metadata collector ───────────────────────────────────────
function collectDeviceMetadata() {
  const info: Record<string, unknown> = {
    user_agent: navigator.userAgent,
    screen_width: screen.width,
    screen_height: screen.height,
    platform: navigator.platform,
    language: navigator.language,
    online: navigator.onLine,
    timestamp: new Date().toISOString(),
  };

  // Battery info (if available)
  if ('getBattery' in navigator) {
    (navigator as unknown as { getBattery: () => Promise<{ level: number; charging: boolean }> })
      .getBattery()
      .then((battery) => {
        info.battery_level = battery.level;
        info.battery_charging = battery.charging;
      })
      .catch(() => { /* ignore */ });
  }

  return info;
}

const STEP_CONFIG = enrollmentConfig.enrollment_session.steps;

export default function AgentEnrollment() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();
  const { idToken } = useAuth();

  // ─── State ──────────────────────────────────────────────────────
  const [assignments, setAssignments] = useState<FarmerEnrollmentRequest[]>([]);
  const [activeSession, setActiveSession] = useState<EnrollmentSession | null>(null);
  const [currentStep, setCurrentStep] = useState<SessionStep>('cow_detection');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stepUploading, setStepUploading] = useState(false);
  const [showCapture, setShowCapture] = useState(false);
  const [captureMode, setCaptureMode] = useState<'cow' | 'muzzle' | 'texture' | 'selfie'>('cow');
  const [completedImages, setCompletedImages] = useState<Record<string, string>>({});
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [enrollResult, setEnrollResult] = useState<{ livestock_id: string; status: string } | null>(null);

  // ─── Location tracking ──────────────────────────────────────────
  const locationTrailRef = useRef<Array<{ latitude: number; longitude: number; accuracy: number; timestamp: string }>>([]);
  const locationWatchRef = useRef<number | null>(null);

  // Preload models
  useEffect(() => {
    preloadModels();
  }, []);

  // Start continuous location tracking when session is active
  useEffect(() => {
    if (!activeSession || !enrollmentConfig.features.location_tracking.enabled) return;

    if (navigator.geolocation) {
      locationWatchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          locationTrailRef.current.push({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: new Date().toISOString(),
          });
        },
        () => { /* location error, non-fatal */ },
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
    }

    return () => {
      if (locationWatchRef.current !== null) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
      }
    };
  }, [activeSession]);

  // Load assigned requests or resume session
  useEffect(() => {
    if (!idToken) return;

    if (sessionId) {
      // Resume existing session
      getEnrollmentSession(sessionId, idToken)
        .then((session) => {
          setActiveSession(session);
          setCurrentStep(session.current_step as SessionStep);
          const images: Record<string, string> = {};
          if (session.cow_image_key) images.cow_detection = session.cow_image_key;
          if (session.muzzle_image_key) images.muzzle_detection = session.muzzle_image_key;
          if (session.body_texture_key) images.body_texture = session.body_texture_key;
          if (session.agent_selfie_key) images.agent_selfie = session.agent_selfie_key;
          setCompletedImages(images);
          setLoading(false);
        })
        .catch(() => {
          setError('Failed to load session');
          setLoading(false);
        });
    } else {
      // Load assigned requests
      getEnrollmentRequests(idToken)
        .then((reqs) => {
          setAssignments(reqs.filter((r) => r.status === 'assigned' || r.status === 'in_progress'));
          setLoading(false);
        })
        .catch(() => {
          setError('Failed to load assignments');
          setLoading(false);
        });
    }
  }, [idToken, sessionId]);

  // ─── Start a new session ────────────────────────────────────────
  const handleStartSession = useCallback(async (requestId: string) => {
    if (!idToken) return;
    setLoading(true);
    setError('');

    try {
      const deviceInfo = collectDeviceMetadata();
      const result = await startEnrollmentSession({
        request_id: requestId,
        metadata: { device_info: deviceInfo },
      }, idToken);

      setActiveSession(result.session);
      setCurrentStep('cow_detection');
      navigate(`/agent-enrollment/${result.session.session_id}`, { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
    } finally {
      setLoading(false);
    }
  }, [idToken, navigate]);

  // ─── Handle step capture (cow/muzzle from CameraCapture, texture/selfie direct) ─
  const handleStepCapture = useCallback(async (file: File, step: SessionStep) => {
    if (!idToken || !activeSession) return;

    setStepUploading(true);
    setError('');

    try {
      // Upload to S3
      const { uploadUrl, imageKey } = await getUploadUrl(file.name, file.type);
      await uploadToS3(uploadUrl, file, () => { /* progress */ });

      // Get current location
      let location: { latitude: number; longitude: number; accuracy: number } | undefined;
      if (locationTrailRef.current.length > 0) {
        const last = locationTrailRef.current[locationTrailRef.current.length - 1];
        location = { latitude: last.latitude, longitude: last.longitude, accuracy: last.accuracy };
      }

      // Complete the step in backend
      const result = await completeSessionStep(activeSession.session_id, {
        step,
        image_key: imageKey,
        location,
      }, idToken);

      // Update local state
      setCompletedImages((prev) => ({ ...prev, [step]: imageKey }));

      if (result.next_step) {
        setCurrentStep(result.next_step as SessionStep);
      }

      setShowCapture(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setStepUploading(false);
    }
  }, [idToken, activeSession]);

  // Handle CameraCapture output (gives muzzle + cow files)
  const handleCameraCapture = useCallback((muzzleFile: File, cowFile: File) => {
    setShowCapture(false);
    if (captureMode === 'cow') {
      handleStepCapture(cowFile, 'cow_detection');
    } else if (captureMode === 'muzzle') {
      handleStepCapture(muzzleFile, 'muzzle_detection');
    }
  }, [captureMode, handleStepCapture]);

  // Handle simple photo capture (body texture / selfie)
  const handleSimpleCapture = useCallback((file: File) => {
    setShowCapture(false);
    if (captureMode === 'texture') {
      handleStepCapture(file, 'body_texture');
    } else if (captureMode === 'selfie') {
      handleStepCapture(file, 'agent_selfie');
    }
  }, [captureMode, handleStepCapture]);

  // ─── Complete the session + run enrollment ──────────────────────
  const handleCompleteSession = useCallback(async () => {
    if (!idToken || !activeSession) return;

    setLoading(true);
    setError('');

    try {
      // Send remaining location data
      if (locationTrailRef.current.length > 0) {
        await updateSessionMetadata(activeSession.session_id, {
          location_trail: locationTrailRef.current,
        }, idToken);
      }

      // Run enrollment with muzzle image (primary) + cow image for weighted embeddings
      if (completedImages.muzzle_detection) {
        const enrollData: Record<string, unknown> = {
          imageKey: completedImages.muzzle_detection,
          owner_id: activeSession.farmer_id,
          session_id: activeSession.session_id,
        };

        // Add cow image key for weighted embedding
        if (completedImages.cow_detection) {
          enrollData.photo_key = completedImages.cow_detection;
          enrollData.cow_image_key = completedImages.cow_detection;
        }

        // Add body texture key
        if (completedImages.body_texture) {
          enrollData.body_texture_key = completedImages.body_texture;
        }

        // Get location
        if (locationTrailRef.current.length > 0) {
          const first = locationTrailRef.current[0];
          enrollData.latitude = first.latitude;
          enrollData.longitude = first.longitude;
        }

        const result = await enroll(enrollData as never, idToken);
        setEnrollResult(result);
      }

      // Complete the session
      await completeEnrollmentSession(activeSession.session_id, idToken);

      // Stop location tracking
      if (locationWatchRef.current !== null) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
      }

      setSessionCompleted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to complete session');
    } finally {
      setLoading(false);
    }
  }, [idToken, activeSession, completedImages]);

  // ─── Open capture for a specific step ───────────────────────────
  const openStepCapture = (step: SessionStep) => {
    switch (step) {
      case 'cow_detection':
        setCaptureMode('cow');
        setShowCapture(true);
        break;
      case 'muzzle_detection':
        setCaptureMode('muzzle');
        setShowCapture(true);
        break;
      case 'body_texture':
        setCaptureMode('texture');
        setShowCapture(true);
        break;
      case 'agent_selfie':
        setCaptureMode('selfie');
        setShowCapture(true);
        break;
    }
  };

  // Check if all required steps are done
  const requiredSteps = STEP_CONFIG.filter((s) => s.required).map((s) => s.id);
  const allRequiredDone = requiredSteps.every((s) => completedImages[s]);

  // ─── RENDER: Session completed ──────────────────────────────────
  if (sessionCompleted) {
    return (
      <div className="page enrollment-page">
        <div className="container">
          <div className="session-completed-card card">
            <div className="session-complete-icon">✅</div>
            <h2>Enrollment Session Complete</h2>
            {enrollResult && (
              <div className="enroll-result-badge">
                <p>Status: <strong>{enrollResult.status}</strong></p>
                <p>Livestock ID: <strong>{enrollResult.livestock_id}</strong></p>
              </div>
            )}
            <p>All images have been captured and uploaded. The animal has been enrolled.</p>
            <div className="session-completed-steps">
              {STEP_CONFIG.map((step) => (
                <div key={step.id} className={`completed-step ${completedImages[step.id] ? 'done' : 'skipped'}`}>
                  <span>{step.icon}</span>
                  <span>{step.label}</span>
                  <span>{completedImages[step.id] ? '✅' : '⏭️'}</span>
                </div>
              ))}
            </div>
            <button className="btn btn-primary btn-full" onClick={() => navigate('/dashboard')}>
              🏠 Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── RENDER: Active session — step-by-step capture ──────────────
  if (activeSession) {
    return (
      <div className="page enrollment-page">
        <div className="container">
          <div className="session-header">
            <h2>📋 Enrollment Session</h2>
            <p className="session-id-badge">Session: {activeSession.session_id}</p>
            <p>Farmer: <strong>{activeSession.farmer_id}</strong></p>
          </div>

          {error && <div className="enrollment-error"><span>⚠️</span><p>{error}</p></div>}

          {/* Step progress */}
          <div className="session-steps">
            {STEP_CONFIG.map((step, idx) => {
              const isDone = !!completedImages[step.id];
              const isCurrent = step.id === currentStep;

              return (
                <div
                  key={step.id}
                  className={`session-step-card card ${isDone ? 'step-done' : isCurrent ? 'step-current' : 'step-locked'}`}
                >
                  <div className="step-header">
                    <span className="step-number">{idx + 1}</span>
                    <span className="step-icon">{step.icon}</span>
                    <span className="step-label">{step.label}</span>
                    {isDone && <span className="step-check">✅</span>}
                    {!step.required && <span className="step-optional">(optional)</span>}
                  </div>
                  <p className="step-desc">{step.description}</p>

                  {isCurrent && !isDone && (
                    <button
                      className="btn btn-primary step-capture-btn"
                      onClick={() => openStepCapture(step.id as SessionStep)}
                      disabled={stepUploading}
                    >
                      {stepUploading ? '⏳ Uploading...' : `📸 Capture ${step.label}`}
                    </button>
                  )}

                  {isCurrent && !isDone && !step.required && (
                    <button
                      className="btn btn-outline step-skip-btn"
                      onClick={() => {
                        // Skip optional step
                        const stepOrder = STEP_CONFIG.map((s) => s.id);
                        const nextIdx = stepOrder.indexOf(step.id) + 1;
                        if (nextIdx < stepOrder.length) {
                          setCurrentStep(stepOrder[nextIdx] as SessionStep);
                        }
                      }}
                      disabled={stepUploading}
                    >
                      Skip →
                    </button>
                  )}

                  {isDone && completedImages[step.id] && (
                    <p className="step-uploaded-key">📁 {completedImages[step.id]}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Complete session button */}
          {allRequiredDone && (
            <button
              className="btn btn-primary btn-full session-complete-btn"
              onClick={handleCompleteSession}
              disabled={loading}
              style={{ marginTop: '1.5rem' }}
            >
              {loading ? '⏳ Completing...' : '✅ Complete Enrollment & Generate ID'}
            </button>
          )}

          {/* Feature status indicators */}
          <div className="session-features card" style={{ marginTop: '1rem' }}>
            <h4>📊 Session Monitoring</h4>
            <div className="feature-indicators">
              <span className={`feature-dot ${enrollmentConfig.features.location_tracking.enabled ? 'active' : ''}`}>
                📍 Location: {enrollmentConfig.features.location_tracking.enabled ? 'Tracking' : 'Off'}
                {locationTrailRef.current.length > 0 && ` (${locationTrailRef.current.length} points)`}
              </span>
              <span className={`feature-dot ${enrollmentConfig.features.video_recording.enabled ? 'active' : ''}`}>
                📹 Video: {enrollmentConfig.features.video_recording.enabled ? 'Recording' : 'Placeholder'}
              </span>
              <span className={`feature-dot ${enrollmentConfig.features.microphone_recording.enabled ? 'active' : ''}`}>
                🎙️ Audio: {enrollmentConfig.features.microphone_recording.enabled ? 'Recording' : 'Placeholder'}
              </span>
              <span className={`feature-dot ${enrollmentConfig.features.device_metadata.enabled ? 'active' : ''}`}>
                📱 Device: {enrollmentConfig.features.device_metadata.enabled ? 'Captured' : 'Off'}
              </span>
            </div>
          </div>
        </div>

        {/* Camera overlays for AI-assisted steps */}
        {showCapture && (captureMode === 'cow' || captureMode === 'muzzle') && (
          <CameraCapture
            onCapture={handleCameraCapture}
            onClose={() => setShowCapture(false)}
          />
        )}

        {/* Simple capture for texture / selfie */}
        {showCapture && (captureMode === 'texture' || captureMode === 'selfie') && (
          <AgentStepCapture
            mode={captureMode}
            onCapture={handleSimpleCapture}
            onClose={() => setShowCapture(false)}
          />
        )}
      </div>
    );
  }

  // ─── RENDER: Assignment list (no active session) ────────────────
  return (
    <div className="page enrollment-page">
      <div className="container">
        <div className="page-header">
          <h2>📋 Assigned Enrollments</h2>
          <p>Select an enrollment request to begin the on-site capture session.</p>
        </div>

        {error && <div className="enrollment-error"><span>⚠️</span><p>{error}</p></div>}

        {loading ? (
          <p className="loading-text">Loading assignments...</p>
        ) : assignments.length === 0 ? (
          <div className="empty-state card">
            <p>🔍 No assignments yet. Check back later!</p>
          </div>
        ) : (
          <div className="request-cards">
            {assignments.map((req) => (
              <div className="card request-card" key={req.request_id}>
                <div className="request-card-header">
                  <span className="request-id">{req.request_id}</span>
                  <span className="request-status-badge" style={{
                    background: req.status === 'in_progress' ? '#9c27b0' : '#2196f3'
                  }}>
                    {req.status === 'in_progress' ? '🔄 In Progress' : '📋 Assigned'}
                  </span>
                </div>
                <div className="request-card-body">
                  <p>👤 Farmer: <strong>{req.farmer_name || req.farmer_id}</strong></p>
                  <p>📍 {req.address?.village}, {req.address?.district}, {req.address?.state}</p>
                  <p>🐄 {req.animal_count || 1} animal(s)</p>
                  {req.preferred_date && <p>📅 Preferred: {req.preferred_date}</p>}
                </div>
                <button
                  className="btn btn-primary btn-full"
                  onClick={() => {
                    if (req.session_id) {
                      navigate(`/agent-enrollment/${req.session_id}`);
                    } else {
                      handleStartSession(req.request_id);
                    }
                  }}
                  disabled={loading}
                >
                  {req.session_id ? '▶️ Resume Session' : '🚀 Start Enrollment Session'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
