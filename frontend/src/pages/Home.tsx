import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_CONFIG, UserRole } from '../types';
import '../styles/Home.css';

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="landing">
      {/* Navbar */}
      <nav className="landing-nav">
        <div className="nav-brand">
          <span className="nav-logo">🐄</span>
          <span className="nav-title">पशु आधार</span>
        </div>
        <div className="nav-actions">
          {user ? (
            <Link to="/dashboard" className="nav-btn nav-btn-primary">
              Dashboard →
            </Link>
          ) : (
            <>
              <Link to="/login" className="nav-btn nav-btn-outline">Sign In</Link>
              <Link to="/signup" className="nav-btn nav-btn-primary">Get Started</Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="hero-content">
          <span className="hero-badge">🇮🇳 Digital India Initiative</span>
          <h1 className="hero-title">
            <span className="hero-title-hindi">पशु आधार</span>
            <span className="hero-title-en">Pashu-Aadhaar AI</span>
          </h1>
          <p className="hero-subtitle">
            India's first AI-powered biometric identity system for livestock.
            Secure muzzle-pattern recognition to uniquely identify every animal.
          </p>
          <div className="hero-buttons">
            {user ? (
              <Link to="/dashboard" className="hero-btn hero-btn-primary">
                Go to Dashboard →
              </Link>
            ) : (
              <>
                <Link to="/signup" className="hero-btn hero-btn-primary">
                  Create Free Account
                </Link>
                <Link to="/login" className="hero-btn hero-btn-secondary">
                  Sign In
                </Link>
              </>
            )}
          </div>
          <div className="hero-stats">
            <div className="stat">
              <span className="stat-value">512-dim</span>
              <span className="stat-label">CLIP Embeddings</span>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <span className="stat-value">YOLOv8</span>
              <span className="stat-label">Object Detection</span>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <span className="stat-value">k-NN</span>
              <span className="stat-label">Vector Matching</span>
            </div>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-card-stack">
            <div className="hero-demo-card card-1">
              <span>📷</span>
              <p>Capture Muzzle</p>
            </div>
            <div className="hero-demo-card card-2">
              <span>🧬</span>
              <p>AI Embedding</p>
            </div>
            <div className="hero-demo-card card-3">
              <span>✅</span>
              <p>Identity Verified</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features-section">
        <h2 className="section-title">How It Works</h2>
        <p className="section-desc">Three simple steps to digitally identify any livestock</p>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-number">1</div>
            <span className="feature-icon">�</span>
            <h3>Capture</h3>
            <p>Take a clear photo of the animal's muzzle using your phone camera</p>
          </div>
          <div className="feature-card">
            <div className="feature-number">2</div>
            <span className="feature-icon">🤖</span>
            <h3>Analyze</h3>
            <p>AI detects the animal, extracts unique biometric patterns via CLIP embeddings</p>
          </div>
          <div className="feature-card">
            <div className="feature-number">3</div>
            <span className="feature-icon">🆔</span>
            <h3>Identify</h3>
            <p>Instant matching against the database — enroll new or verify existing animals</p>
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="roles-section">
        <h2 className="section-title">Built for Every Stakeholder</h2>
        <p className="section-desc">Role-based access for the entire livestock ecosystem</p>
        <div className="roles-grid">
          {(Object.keys(ROLE_CONFIG) as UserRole[]).map((role) => {
            const config = ROLE_CONFIG[role];
            return (
              <div key={role} className="role-feature-card" style={{ borderTopColor: config.color }}>
                <span className="role-feature-icon">{config.icon}</span>
                <h3 style={{ color: config.color }}>{config.label}</h3>
                <p>{config.description}</p>
                <span className="role-id-example" style={{ background: config.color }}>
                  {config.prefix}-XXXXXXX
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Tech Stack */}
      <section className="tech-section">
        <h2 className="section-title">Powered by</h2>
        <div className="tech-pills">
          <span className="tech-pill">AWS SageMaker</span>
          <span className="tech-pill">CLIP ViT-B/32</span>
          <span className="tech-pill">YOLOv8n</span>
          <span className="tech-pill">OpenSearch k-NN</span>
          <span className="tech-pill">AWS Lambda</span>
          <span className="tech-pill">DynamoDB</span>
          <span className="tech-pill">Cognito</span>
          <span className="tech-pill">React + Vite</span>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <h2>Ready to digitize your livestock?</h2>
        <p>Join the Pashu Aadhaar network today — free for farmers.</p>
        <div className="cta-buttons">
          <Link to="/signup" className="hero-btn hero-btn-primary">Create Account</Link>
          <Link to="/enroll" className="hero-btn hero-btn-secondary">Try Quick Enrollment</Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <p>🐄 पशु आधार — Pashu Aadhaar AI © 2026 &middot; Built for rural India 🇮🇳</p>
      </footer>
    </div>
  );
}
