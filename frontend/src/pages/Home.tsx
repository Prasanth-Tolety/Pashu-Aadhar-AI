import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Home.css';

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="page home-page">
      <div className="container">
        <div className="home-hero">
          <div className="home-logo">🐄</div>
          <h1 className="home-title">पशु आधार</h1>
          <h2 className="home-title-en">Pashu-Aadhaar AI</h2>
          <p className="home-subtitle">Digital Identity for Livestock</p>
          <p className="home-description">
            Secure biometric enrollment for cattle and livestock using AI-powered
            muzzle pattern recognition.
          </p>
        </div>

        <div className="home-features">
          <div className="feature-card">
            <span className="feature-icon">📷</span>
            <h3>Camera Capture</h3>
            <p>Take a photo directly with your device camera</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">📁</span>
            <h3>File Upload</h3>
            <p>Upload an existing image from your device</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">🔍</span>
            <h3>AI Matching</h3>
            <p>Instant biometric matching and enrollment</p>
          </div>
        </div>

        <div className="home-actions">
          {user ? (
            <Link to="/dashboard" className="btn btn-primary btn-full home-enroll-btn">
              Go to Dashboard
            </Link>
          ) : (
            <Link to="/login" className="btn btn-primary btn-full home-enroll-btn">
              Sign In
            </Link>
          )}
          <Link to="/enroll" className="btn btn-secondary btn-full home-enroll-btn" style={{ marginTop: '0.75rem' }}>
            Quick Enrollment (No Login)
          </Link>
        </div>

        <p className="home-note">
          For farmers, veterinarians, and field operators 🇮🇳
        </p>
      </div>
    </div>
  );
}
