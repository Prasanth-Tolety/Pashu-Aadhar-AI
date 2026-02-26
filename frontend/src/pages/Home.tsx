import { Link } from 'react-router-dom';
import '../styles/Home.css';

export default function Home() {
  return (
    <div className="page home-page">
      <div className="container">
        <div className="home-hero">
          <div className="home-logo">🐄</div>
          <h1 className="home-title">Pashu-Aadhaar</h1>
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

        <Link to="/enroll" className="btn btn-primary btn-full home-enroll-btn">
          Start Enrollment
        </Link>

        <p className="home-note">
          For farmers, veterinarians, and field operators
        </p>
      </div>
    </div>
  );
}
