import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import ImageUpload from '../components/ImageUpload';
import CameraCapture from '../components/CameraCapture';
import UploadProgress from '../components/UploadProgress';
import { getUploadUrl, enroll, updateAnimal } from '../services/api';
import { uploadToS3 } from '../services/s3';
import { EnrollmentState, AnimalFormData } from '../types';
import '../styles/Enrollment.css';

export default function Enrollment() {
  const navigate = useNavigate();
  const { user, idToken } = useAuth();
  const { t } = useLanguage();
  const [showCamera, setShowCamera] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState('');
  const [showAnimalForm, setShowAnimalForm] = useState(false);
  const [enrolledId, setEnrolledId] = useState('');
  const [savingForm, setSavingForm] = useState(false);

  const isFarmer = user?.role === 'farmer';

  const [animalForm, setAnimalForm] = useState<AnimalFormData>({
    species: 'cattle',
    breed: '',
    gender: '',
    age_months: 0,
    color_pattern: '',
    horn_type: '',
    identifiable_marks: '',
    village: '',
    district: '',
    state: '',
  });

  const [state, setState] = useState<EnrollmentState>({
    status: 'idle',
    imageFile: null,
    imagePreviewUrl: null,
    uploadProgress: 0,
    result: null,
    error: null,
  });

  // Request location on mount (for farmers)
  useEffect(() => {
    if (isFarmer && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          setLocationError('Location access denied. GPS data won\'t be saved.');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, [isFarmer]);

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

    setState((prev) => ({ ...prev, status: 'uploading', uploadProgress: 0, error: null }));

    try {
      const { uploadUrl, imageKey } = await getUploadUrl(
        state.imageFile.name,
        state.imageFile.type
      );

      await uploadToS3(uploadUrl, state.imageFile, (progress) => {
        setState((prev) => ({ ...prev, uploadProgress: progress }));
      });

      setState((prev) => ({ ...prev, status: 'enrolling' }));

      const enrollData = {
        imageKey,
        owner_id: isFarmer ? user?.ownerId || undefined : undefined,
        latitude: location?.lat,
        longitude: location?.lng,
      };

      const result = await enroll(enrollData, idToken);

      setState((prev) => ({ ...prev, status: 'success', result }));

      // For farmers enrolling NEW animals, show the animal form
      if (isFarmer && result.status === 'NEW') {
        setEnrolledId(result.livestock_id);
        setShowAnimalForm(true);
      } else {
        navigate('/result', { state: { result } });
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t.enrollmentFailed;
      setState((prev) => ({ ...prev, status: 'error', error: message }));
    }
  };

  const handleSaveAnimalForm = async () => {
    if (!enrolledId || !idToken) return;
    setSavingForm(true);
    try {
      await updateAnimal(enrolledId, animalForm, idToken);
      navigate('/result', { state: { result: state.result } });
    } catch {
      alert(t.failedToSaveAnimal);
      navigate('/result', { state: { result: state.result } });
    } finally {
      setSavingForm(false);
    }
  };

  const isProcessing = state.status === 'uploading' || state.status === 'enrolling';

  // ─── Post-enrollment animal form ────────────────────────────
  if (showAnimalForm) {
    return (
      <div className="page enrollment-page">
        <div className="container">
          <div className="page-header">
            <h1>{t.animalDetails}</h1>
            <p>{t.fillDetails} <strong>{enrolledId}</strong></p>
          </div>
          <div className="card animal-detail-form">
            <div className="form-row-2">
              <div className="form-group">
                <label>{t.speciesLabel} *</label>
                <select
                  value={animalForm.species}
                  onChange={(e) => setAnimalForm({ ...animalForm, species: e.target.value })}
                >
                  <option value="cattle">{t.cattle}</option>
                  <option value="buffalo">{t.buffalo}</option>
                  <option value="goat">{t.goat}</option>
                  <option value="sheep">{t.sheep}</option>
                  <option value="other">{t.other}</option>
                </select>
              </div>
              <div className="form-group">
                <label>{t.breedLabel} *</label>
                <input
                  type="text"
                  value={animalForm.breed}
                  onChange={(e) => setAnimalForm({ ...animalForm, breed: e.target.value })}
                  placeholder="e.g., Gir, Sahiwal, HF"
                  required
                />
              </div>
            </div>
            <div className="form-row-2">
              <div className="form-group">
                <label>{t.genderLabel} *</label>
                <select
                  value={animalForm.gender}
                  onChange={(e) => setAnimalForm({ ...animalForm, gender: e.target.value })}
                >
                  <option value="">{t.selectGender}</option>
                  <option value="male">{t.male}</option>
                  <option value="female">{t.female}</option>
                </select>
              </div>
              <div className="form-group">
                <label>{t.ageMonths} *</label>
                <input
                  type="number"
                  value={animalForm.age_months || ''}
                  onChange={(e) => setAnimalForm({ ...animalForm, age_months: parseInt(e.target.value) || 0 })}
                  placeholder="e.g., 24"
                  min={0}
                  required
                />
              </div>
            </div>
            <div className="form-row-2">
              <div className="form-group">
                <label>{t.colorPattern}</label>
                <input
                  type="text"
                  value={animalForm.color_pattern}
                  onChange={(e) => setAnimalForm({ ...animalForm, color_pattern: e.target.value })}
                  placeholder="e.g., Brown & White"
                />
              </div>
              <div className="form-group">
                <label>{t.hornType}</label>
                <input
                  type="text"
                  value={animalForm.horn_type}
                  onChange={(e) => setAnimalForm({ ...animalForm, horn_type: e.target.value })}
                  placeholder="e.g., Curved, Straight"
                />
              </div>
            </div>
            <div className="form-group">
              <label>{t.identifiableMarks}</label>
              <textarea
                value={animalForm.identifiable_marks}
                onChange={(e) => setAnimalForm({ ...animalForm, identifiable_marks: e.target.value })}
                placeholder="Any unique marks, scars, or patterns"
                rows={2}
              />
            </div>
            <div className="form-row-3">
              <div className="form-group">
                <label>{t.village} *</label>
                <input
                  type="text"
                  value={animalForm.village}
                  onChange={(e) => setAnimalForm({ ...animalForm, village: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t.district} *</label>
                <input
                  type="text"
                  value={animalForm.district}
                  onChange={(e) => setAnimalForm({ ...animalForm, district: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t.state} *</label>
                <input
                  type="text"
                  value={animalForm.state}
                  onChange={(e) => setAnimalForm({ ...animalForm, state: e.target.value })}
                  required
                />
              </div>
            </div>

            {location && (
              <div className="location-badge">
                📍 GPS: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
              </div>
            )}

            <div className="form-actions">
              <button
                className="btn btn-primary btn-full"
                onClick={handleSaveAnimalForm}
                disabled={savingForm || !animalForm.breed || !animalForm.gender}
              >
                {savingForm ? t.saving : `💾 ${t.saveAnimalDetails}`}
              </button>
              <button
                className="btn btn-outline"
                style={{ marginTop: '0.5rem', width: '100%' }}
                onClick={() => navigate('/result', { state: { result: state.result } })}
              >
                {t.skipForNow} →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page enrollment-page">
      <div className="container">
        <div className="page-header">
          <h1>{t.animalEnrollment}</h1>
          <p>{t.captureOrUploadDesc}</p>
          {!isFarmer && (
            <div className="enrollment-notice">
              ⚠️ {t.enrollNotice}
            </div>
          )}
        </div>

        {/* Location status */}
        {isFarmer && (
          <div className="location-status">
            {location ? (
              <span className="location-ok">📍 {t.gpsActive} — {location.lat.toFixed(4)}, {location.lng.toFixed(4)}</span>
            ) : locationError ? (
              <span className="location-warn">⚠️ {locationError}</span>
            ) : (
              <span className="location-loading">📍 {t.gettingLocation}</span>
            )}
          </div>
        )}

        <div className="card">
          {isProcessing ? (
            <UploadProgress
              progress={state.uploadProgress}
              status={state.status as 'uploading' | 'enrolling'}
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
                  🚀 {t.enrollAnimal}
                </button>
              )}
            </>
          )}
        </div>

        <div className="enrollment-tips card">
          <h4>📋 {t.photoTips}</h4>
          <ul>
            <li>{t.photoTip1}</li>
            <li>{t.photoTip2}</li>
            <li>{t.photoTip3}</li>
            <li>{t.photoTip4}</li>
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
