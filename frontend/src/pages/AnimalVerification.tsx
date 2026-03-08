/**
 * AnimalVerification — Upload a photo to verify if an animal exists in the system.
 * Accessible to all logged-in users regardless of role.
 * If a match is found, displays the animal details and its embedding.
 */
import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUploadUrl, verifyAnimal } from '../services/api';
import { uploadToS3 } from '../services/s3';
import { VerifyResponse } from '../types';
import LanguageSelector from '../components/LanguageSelector';
import '../styles/AnimalVerification.css';

type VerifyStep = 'upload' | 'processing' | 'result';

export default function AnimalVerification() {
  const { user, idToken } = useAuth();

  const [step, setStep] = useState<VerifyStep>('upload');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [showEmbedding, setShowEmbedding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPG, PNG, etc.)');
      return;
    }

    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError('');
    setResult(null);
    setStep('upload');
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      setError('Please drop an image file');
      return;
    }
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError('');
    setResult(null);
    setStep('upload');
  };

  const handleVerify = async () => {
    if (!imageFile) {
      setError('Please select an image first');
      return;
    }

    try {
      setStep('processing');
      setError('');
      setResult(null);

      // Step 1: Get upload URL
      setProgress('Getting upload URL...');
      const { uploadUrl, imageKey } = await getUploadUrl(imageFile.name, imageFile.type);

      // Step 2: Upload to S3
      setProgress('Uploading image...');
      await uploadToS3(uploadUrl, imageFile);

      // Step 3: Call verify API
      setProgress('Analyzing image & searching database...');
      const verifyResult = await verifyAnimal(imageKey, idToken || null);

      setResult(verifyResult);
      setStep('result');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      setError(msg);
      setStep('upload');
    }
  };

  const handleReset = () => {
    setStep('upload');
    setImageFile(null);
    setPreviewUrl(null);
    setError('');
    setResult(null);
    setShowEmbedding(false);
    setProgress('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="page verify-page">
      <header className="verify-header">
        <div className="header-left">
          <Link to="/dashboard" className="back-link">← Back</Link>
          <h1>🔍 Animal Verification</h1>
        </div>
        <div className="header-right">
          <LanguageSelector />
          {user && <span className="user-badge">{user.name || user.phoneNumber}</span>}
        </div>
      </header>

      <main className="verify-content">
        <div className="verify-card">
          <div className="verify-description">
            <p>Upload a photo of a cow's muzzle to check if it's already registered in the system.
            If a match is found, you'll see the animal's details and its biometric embedding.</p>
          </div>

          {/* Upload Section */}
          {step === 'upload' && (
            <div className="upload-section">
              <div
                className={`drop-zone ${previewUrl ? 'has-image' : ''}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                {previewUrl ? (
                  <div className="preview-container">
                    <img src={previewUrl} alt="Selected" className="preview-image" />
                    <div className="preview-overlay">
                      <span>Click or drag to change</span>
                    </div>
                  </div>
                ) : (
                  <div className="drop-zone-content">
                    <span className="drop-icon">📷</span>
                    <span className="drop-text">Click or drag a muzzle photo here</span>
                    <span className="drop-hint">JPG, PNG — clear muzzle photo works best</span>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />

              {error && <div className="verify-error">⚠️ {error}</div>}

              <button
                className="verify-btn"
                onClick={handleVerify}
                disabled={!imageFile}
              >
                🔍 Verify Animal
              </button>
            </div>
          )}

          {/* Processing Section */}
          {step === 'processing' && (
            <div className="processing-section">
              {previewUrl && (
                <img src={previewUrl} alt="Uploaded" className="processing-image" />
              )}
              <div className="processing-spinner" />
              <p className="processing-text">{progress}</p>
            </div>
          )}

          {/* Result Section */}
          {step === 'result' && result && (
            <div className="result-section">
              {/* Match Found */}
              {result.status === 'FOUND' && (
                <div className="result-found">
                  <div className="result-badge found">✅ Animal Found</div>
                  <div className="result-similarity">
                    <span className="sim-label">Match Confidence</span>
                    <span className="sim-value">{(result.similarity * 100).toFixed(1)}%</span>
                  </div>

                  <div className="result-photos">
                    {previewUrl && (
                      <div className="result-photo-box">
                        <span className="photo-label">Uploaded Photo</span>
                        <img src={previewUrl} alt="Uploaded" />
                      </div>
                    )}
                    {result.animal?.photo_url && (
                      <div className="result-photo-box">
                        <span className="photo-label">Enrolled Photo</span>
                        <img src={result.animal.photo_url} alt="Enrolled" />
                      </div>
                    )}
                    {result.animal?.muzzle_url && (
                      <div className="result-photo-box">
                        <span className="photo-label">Muzzle ROI</span>
                        <img src={result.animal.muzzle_url} alt="Muzzle" />
                      </div>
                    )}
                  </div>

                  {result.animal && (
                    <div className="result-details">
                      <h3>Animal Details</h3>
                      <div className="details-grid">
                        <div className="detail-item">
                          <span className="detail-label">Livestock ID</span>
                          <span className="detail-value id-value">{result.livestock_id}</span>
                        </div>
                        {result.animal.species && (
                          <div className="detail-item">
                            <span className="detail-label">Species</span>
                            <span className="detail-value">{result.animal.species}</span>
                          </div>
                        )}
                        {result.animal.breed && (
                          <div className="detail-item">
                            <span className="detail-label">Breed</span>
                            <span className="detail-value">{result.animal.breed}</span>
                          </div>
                        )}
                        {result.animal.gender && (
                          <div className="detail-item">
                            <span className="detail-label">Gender</span>
                            <span className="detail-value">{result.animal.gender}</span>
                          </div>
                        )}
                        {result.animal.age_months && (
                          <div className="detail-item">
                            <span className="detail-label">Age</span>
                            <span className="detail-value">{Math.floor(result.animal.age_months / 12)}y {result.animal.age_months % 12}m</span>
                          </div>
                        )}
                        {result.animal.owner_name && (
                          <div className="detail-item">
                            <span className="detail-label">Owner</span>
                            <span className="detail-value">{result.animal.owner_name}</span>
                          </div>
                        )}
                        {result.animal.village && (
                          <div className="detail-item">
                            <span className="detail-label">Village</span>
                            <span className="detail-value">{result.animal.village}</span>
                          </div>
                        )}
                        {result.animal.state && (
                          <div className="detail-item">
                            <span className="detail-label">State</span>
                            <span className="detail-value">{result.animal.state}</span>
                          </div>
                        )}
                        {result.animal.status && (
                          <div className="detail-item">
                            <span className="detail-label">Status</span>
                            <span className="detail-value">{result.animal.status}</span>
                          </div>
                        )}
                        {result.enrolled_at && (
                          <div className="detail-item">
                            <span className="detail-label">Enrolled</span>
                            <span className="detail-value">{new Date(result.enrolled_at).toLocaleDateString('en-IN')}</span>
                          </div>
                        )}
                      </div>

                      <Link to={`/animals/${result.livestock_id}`} className="view-full-btn">
                        📋 View Full Animal Record
                      </Link>
                    </div>
                  )}

                  {/* Embedding Section */}
                  {result.embedding && (
                    <div className="embedding-section">
                      <button
                        className="embedding-toggle"
                        onClick={() => setShowEmbedding(!showEmbedding)}
                      >
                        🧬 {showEmbedding ? 'Hide' : 'Show'} Embedding Vector ({result.embedding.length}D)
                      </button>
                      {showEmbedding && (
                        <div className="embedding-data">
                          <div className="embedding-stats">
                            <span>Dimensions: {result.embedding.length}</span>
                            <span>Min: {Math.min(...result.embedding).toFixed(4)}</span>
                            <span>Max: {Math.max(...result.embedding).toFixed(4)}</span>
                            <span>Mean: {(result.embedding.reduce((a, b) => a + b, 0) / result.embedding.length).toFixed(4)}</span>
                          </div>
                          <pre className="embedding-vector">
                            [{result.embedding.map((v, i) => `${v.toFixed(6)}${i < result.embedding!.length - 1 ? ', ' : ''}`).join('')}]
                          </pre>
                          <button
                            className="copy-btn"
                            onClick={() => {
                              navigator.clipboard.writeText(JSON.stringify(result.embedding));
                            }}
                          >
                            📋 Copy Embedding
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* No Match */}
              {result.status === 'NOT_FOUND' && (
                <div className="result-not-found">
                  <div className="result-badge not-found">❌ Not Found</div>
                  <p>No matching animal was found in the system.</p>
                  {result.similarity > 0 && (
                    <p className="closest-sim">Closest match similarity: {(result.similarity * 100).toFixed(1)}% (below threshold)</p>
                  )}
                  {previewUrl && (
                    <img src={previewUrl} alt="Uploaded" className="nf-preview" />
                  )}
                </div>
              )}

              <button className="verify-again-btn" onClick={handleReset}>
                🔄 Verify Another Animal
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
