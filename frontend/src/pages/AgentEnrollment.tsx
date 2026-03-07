import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
// useLanguage reserved for i18n translations
import {
  getEnrollmentRequests,
  acceptEnrollmentRequest,
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
import AgentLiveCapture, { type CaptureResult } from '../components/AgentLiveCapture';
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
  const [showLiveCapture, setShowLiveCapture] = useState(false);
  const [completedImages, setCompletedImages] = useState<Record<string, string>>({});
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [enrollResult, setEnrollResult] = useState<{ livestock_id: string; status: string } | null>(null);

  // ─── Accept / schedule state ────────────────────────────────────
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [scheduledDate, setScheduledDate] = useState('');
  const [agentNotes, setAgentNotes] = useState('');
  const [acceptLoading, setAcceptLoading] = useState(false);

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
      // Load all requests (assigned + pending available)
      getEnrollmentRequests(idToken)
        .then((reqs) => {
          setAssignments(reqs);
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

  // ─── Accept a pending request ───────────────────────────────────
  const handleAcceptRequest = useCallback(async (requestId: string) => {
    if (!idToken) return;
    setAcceptLoading(true);
    setError('');

    try {
      await acceptEnrollmentRequest(requestId, {
        scheduled_date: scheduledDate || undefined,
        notes: agentNotes || undefined,
      }, idToken);

      // Reload the list
      const reqs = await getEnrollmentRequests(idToken);
      setAssignments(reqs);
      setAcceptingId(null);
      setScheduledDate('');
      setAgentNotes('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to accept request');
    } finally {
      setAcceptLoading(false);
    }
  }, [idToken, scheduledDate, agentNotes]);

  // ─── Handle confirmed submission from AgentLiveCapture preview ────
  // Images are held in memory until the agent confirms in the preview screen.
  // Only then do we upload to S3 — optimal storage, nothing stored if discarded.
  const handleLiveSubmit = useCallback(async (results: CaptureResult[], videoFile: File | null) => {
    if (!idToken || !activeSession) return;

    setShowLiveCapture(false);
    setStepUploading(true);
    setError('');

    try {
      const uploadedImages: Record<string, string> = {};

      // Upload each captured image to S3
      for (const result of results) {
        try {
          const { uploadUrl, imageKey } = await getUploadUrl(result.file.name, result.file.type);
          await uploadToS3(uploadUrl, result.file, () => { /* progress */ });

          // Get current location
          let location: { latitude: number; longitude: number; accuracy: number } | undefined;
          if (locationTrailRef.current.length > 0) {
            const last = locationTrailRef.current[locationTrailRef.current.length - 1];
            location = { latitude: last.latitude, longitude: last.longitude, accuracy: last.accuracy };
          }

          // Complete the step in backend
          await completeSessionStep(activeSession.session_id, {
            step: result.step,
            image_key: imageKey,
            location,
          }, idToken);

          uploadedImages[result.step] = imageKey;
          console.log(`[AgentEnrollment] Uploaded ${result.step}:`, imageKey);
        } catch (err) {
          console.error(`[AgentEnrollment] Failed to upload ${result.step}:`, err);
        }
      }

      // Upload video recording if available
      if (videoFile) {
        try {
          console.log('[AgentEnrollment] Uploading recording:', videoFile.name, `${(videoFile.size / 1024 / 1024).toFixed(1)}MB`);
          const { uploadUrl, imageKey } = await getUploadUrl(videoFile.name, videoFile.type);
          await uploadToS3(uploadUrl, videoFile, () => { /* progress */ });
          await updateSessionMetadata(activeSession.session_id, { video_key: imageKey }, idToken);
          console.log('[AgentEnrollment] Recording uploaded, key:', imageKey);
        } catch (err) {
          console.error('[AgentEnrollment] Failed to upload recording:', err);
          // Non-fatal
        }
      }

      setCompletedImages(uploadedImages);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload images');
    } finally {
      setStepUploading(false);
    }
  }, [idToken, activeSession]);

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

  // ─── RENDER: Live capture overlay (continuous camera) ───────────
  if (showLiveCapture && activeSession) {
    return (
      <AgentLiveCapture
        onSubmit={handleLiveSubmit}
        onClose={() => setShowLiveCapture(false)}
      />
    );
  }

  // ─── RENDER: Active session — step overview + launch capture ────
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

          {/* Step progress overview */}
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
                  {isDone && completedImages[step.id] && (
                    <p className="step-uploaded-key">📁 Captured</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Launch live capture button */}
          {!allRequiredDone && (
            <button
              className="btn btn-primary btn-full session-complete-btn"
              onClick={() => setShowLiveCapture(true)}
              disabled={stepUploading}
              style={{ marginTop: '1rem' }}
            >
              {stepUploading ? '⏳ Uploading...' : '� Start Live Capture'}
            </button>
          )}

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
              <span className={`feature-dot ${enrollmentConfig.features.device_metadata.enabled ? 'active' : ''}`}>
                📱 Device: {enrollmentConfig.features.device_metadata.enabled ? 'Captured' : 'Off'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── RENDER: Assignment list (no active session) ────────────────
  const pendingRequests = assignments.filter((r) => r.status === 'pending');
  const assignedRequests = assignments.filter((r) => r.status === 'assigned' || r.status === 'in_progress');
  const completedRequests = assignments.filter((r) => r.status === 'completed');

  return (
    <div className="page enrollment-page">
      <div className="container">
        <div className="page-header">
          <h2>📋 Enrollment Assignments</h2>
          <p>Manage enrollment requests and conduct on-site animal registration.</p>
        </div>

        {error && <div className="enrollment-error"><span>⚠️</span><p>{error}</p></div>}

        {loading ? (
          <p className="loading-text">Loading assignments...</p>
        ) : assignments.length === 0 ? (
          <div className="empty-state card">
            <p>🔍 No enrollment requests available. Check back later!</p>
          </div>
        ) : (
          <>
            {/* ── Pending / Available Requests ── */}
            {pendingRequests.length > 0 && (
              <div className="request-section">
                <h3>🆕 Available Requests ({pendingRequests.length})</h3>
                <p className="section-subtitle">These requests are waiting for an agent. Accept to schedule a visit.</p>
                <div className="request-cards">
                  {pendingRequests.map((req) => (
                    <div className="card request-card" key={req.request_id}>
                      <div className="request-card-header">
                        <span className="request-id">{req.request_id}</span>
                        <span className="request-status-badge" style={{ background: '#ff9800' }}>
                          ⏳ Pending
                        </span>
                      </div>
                      <div className="request-card-body">
                        <p>👤 Farmer: <strong>{req.farmer_name || req.farmer_id}</strong></p>
                        <p>📞 Phone: <strong>{req.farmer_phone || '—'}</strong></p>
                        <p>📍 {req.address?.village}, {req.address?.district}, {req.address?.state}
                          {req.address?.pincode ? ` — ${req.address.pincode}` : ''}
                        </p>
                        {req.address?.landmark && <p>🗺️ Landmark: {req.address.landmark}</p>}
                        <p>🐄 {req.animal_count || 1} animal(s)</p>
                        {req.preferred_date && <p>📅 Preferred: {req.preferred_date}</p>}
                        <p className="request-date">Requested: {new Date(req.created_at).toLocaleDateString('en-IN')}</p>
                      </div>

                      {acceptingId === req.request_id ? (
                        <div className="accept-form">
                          <div className="form-group">
                            <label>📅 Schedule Visit Date</label>
                            <input
                              type="date"
                              value={scheduledDate}
                              onChange={(e) => setScheduledDate(e.target.value)}
                              min={new Date().toISOString().split('T')[0]}
                            />
                          </div>
                          <div className="form-group">
                            <label>📝 Notes (optional)</label>
                            <input
                              type="text"
                              value={agentNotes}
                              onChange={(e) => setAgentNotes(e.target.value)}
                              placeholder="e.g., Will arrive by 10 AM"
                            />
                          </div>
                          <div className="accept-form-actions">
                            <button
                              className="btn btn-primary"
                              onClick={() => handleAcceptRequest(req.request_id)}
                              disabled={acceptLoading}
                            >
                              {acceptLoading ? '⏳ Accepting...' : '✅ Confirm & Accept'}
                            </button>
                            <button
                              className="btn btn-outline"
                              onClick={() => { setAcceptingId(null); setScheduledDate(''); setAgentNotes(''); }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="btn btn-primary btn-full"
                          onClick={() => setAcceptingId(req.request_id)}
                        >
                          📋 Accept & Schedule Visit
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Assigned / My Requests ── */}
            {assignedRequests.length > 0 && (
              <div className="request-section" style={{ marginTop: '1.5rem' }}>
                <h3>📌 My Assignments ({assignedRequests.length})</h3>
                <p className="section-subtitle">Requests assigned to you. Start the enrollment session on-site.</p>
                <div className="request-cards">
                  {assignedRequests.map((req) => (
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
                        <p>📞 Phone: <a href={`tel:${req.farmer_phone}`}><strong>{req.farmer_phone || '—'}</strong></a></p>
                        <p>📍 {req.address?.village}, {req.address?.district}, {req.address?.state}
                          {req.address?.pincode ? ` — ${req.address.pincode}` : ''}
                        </p>
                        {req.address?.landmark && <p>�️ Landmark: {req.address.landmark}</p>}
                        <p>�🐄 {req.animal_count || 1} animal(s)</p>
                        {req.scheduled_date && <p>📅 Scheduled: <strong>{req.scheduled_date}</strong></p>}
                        {req.preferred_date && !req.scheduled_date && <p>📅 Preferred: {req.preferred_date}</p>}
                        <p className="request-date">Requested: {new Date(req.created_at).toLocaleDateString('en-IN')}</p>
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
                        {req.session_id ? '▶️ Resume Enrollment Session' : '🚀 Start Enrollment Session'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Completed ── */}
            {completedRequests.length > 0 && (
              <div className="request-section" style={{ marginTop: '1.5rem' }}>
                <h3>✅ Completed ({completedRequests.length})</h3>
                <div className="request-cards">
                  {completedRequests.map((req) => (
                    <div className="card request-card" key={req.request_id} style={{ opacity: 0.7 }}>
                      <div className="request-card-header">
                        <span className="request-id">{req.request_id}</span>
                        <span className="request-status-badge" style={{ background: '#4caf50' }}>
                          ✅ Completed
                        </span>
                      </div>
                      <div className="request-card-body">
                        <p>👤 {req.farmer_name || req.farmer_id}</p>
                        <p>📍 {req.address?.village}, {req.address?.district}</p>
                        <p className="request-date">Completed: {new Date(req.updated_at || req.created_at).toLocaleDateString('en-IN')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
