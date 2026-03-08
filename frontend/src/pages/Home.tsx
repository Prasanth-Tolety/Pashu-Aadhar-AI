import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import LanguageSelector from '../components/LanguageSelector';
import { ROLE_CONFIG, UserRole } from '../types';
import '../styles/Home.css';

function useCountUp(target: number, duration = 2000, start = false) {
  const [value, setValue] = useState(0);
  const ref = useRef(0);
  useEffect(() => {
    if (!start) return;
    const step = target / (duration / 16);
    const id = setInterval(() => {
      ref.current = Math.min(ref.current + step, target);
      setValue(Math.floor(ref.current));
      if (ref.current >= target) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [target, duration, start]);
  return value;
}

export default function Home() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [statsVisible, setStatsVisible] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true); },
      { threshold: 0.3 }
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  const animalsEnrolled = useCountUp(12480, 2200, statsVisible);
  const farmersRegistered = useCountUp(3650, 2000, statsVisible);
  const statesCovered = useCountUp(18, 1500, statsVisible);
  const accuracy = useCountUp(97, 1800, statsVisible);

  // ─── Rolling News Cards ───────────────────────────────────────────
  const NEWS_CARDS = [
    { icon: '🛡️', tag: 'Insurance Fraud', title: 'Duplicate cattle claims cost ₹350 Cr annually', desc: 'Without biometric identity, the same animal is insured multiple times across states. Pashu Aadhaar prevents this with unique muzzle-print matching.' },
    { icon: '📋', tag: 'Missing Records', title: 'Over 60% of cattle lack any health records', desc: 'Vaccination, deworming, and disease history are undocumented for most livestock, creating public health risks.' },
    { icon: '🔍', tag: 'Missing Cattle', title: '5 lakh+ cattle reported missing every year', desc: 'Without a national ID system, stolen or lost cattle are nearly impossible to trace or return to rightful owners.' },
    { icon: '🏥', tag: 'Health Crisis', title: 'Lumpy Skin Disease: No tracking infra', desc: 'The 2022 LSD outbreak killed 1.8 lakh cattle. Lack of digital tracking delayed response across state borders.' },
    { icon: '💰', tag: 'Loan Fraud', title: 'Same animal used as collateral for multiple loans', desc: "Banks lose crores when duplicate animals are pledged. Pashu Aadhaar's unique ID prevents collateral fraud." },
    { icon: '📊', tag: 'Census Gap', title: 'Livestock census is outdated by 5+ years', desc: 'Government planning depends on stale data. Real-time digital enrollment provides live population statistics.' },
  ];

  const [newsIdx, setNewsIdx] = useState(0);
  const newsTimerRef = useRef<ReturnType<typeof setInterval>>();

  const nextNews = useCallback(() => {
    setNewsIdx(prev => (prev + 1) % NEWS_CARDS.length);
  }, [NEWS_CARDS.length]);

  useEffect(() => {
    newsTimerRef.current = setInterval(nextNews, 4000);
    return () => clearInterval(newsTimerRef.current);
  }, [nextNews]);

  return (
    <div className="landing">
      {/* Indian Government Tricolor Top Bar */}
      <div className="india-tricolor-top">
        <span className="tri-band saffron" />
        <span className="tri-band white" />
        <span className="tri-band green" />
      </div>

      {/* Government Badge */}
      <div className="govt-badge-bar">
        <div className="govt-badge-inner">
          <img src="/ashoka-emblem.svg" alt="Ashoka Emblem" className="ashoka-small" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <span className="govt-badge-text">भारत सरकार • Government of India</span>
          <span className="govt-badge-ministry">Ministry of Fisheries, Animal Husbandry & Dairying</span>
        </div>
      </div>

      {/* Navbar */}
      <nav className="landing-nav">
        <div className="nav-brand">
          <span className="nav-logo">🐄</span>
          <span className="nav-title">{t.appNameHindi}</span>
        </div>
        <div className="nav-actions">
          <LanguageSelector />
          {user ? (
            <Link to="/dashboard" className="nav-btn nav-btn-primary">
              {t.dashboard} →
            </Link>
          ) : (
            <>
              <Link to="/login" className="nav-btn nav-btn-outline">{t.signIn}</Link>
              <Link to="/signup" className="nav-btn nav-btn-primary">{t.getStarted}</Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="hero-content">
          <span className="hero-badge">{t.heroBadge}</span>
          <h1 className="hero-title">
            <span className="hero-title-hindi">{t.appNameHindi}</span>
            <span className="hero-title-en">{t.heroTagline}</span>
          </h1>
          <p className="hero-subtitle">
            {t.heroSubtitle}
          </p>
          <div className="hero-buttons">
            {user ? (
              <Link to="/dashboard" className="hero-btn hero-btn-primary">
                {t.goToDashboard} →
              </Link>
            ) : (
              <>
                <Link to="/signup" className="hero-btn hero-btn-primary">
                  {t.createFreeAccount}
                </Link>
                <Link to="/login" className="hero-btn hero-btn-secondary">
                  {t.signIn}
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
            <div className="hero-demo-card card-1"><span>📷</span><p>Capture Muzzle</p></div>
            <div className="hero-demo-card card-2"><span>🧬</span><p>AI Embedding</p></div>
            <div className="hero-demo-card card-3"><span>✅</span><p>Identity Verified</p></div>
          </div>
        </div>
      </section>

      {/* Live Stats Counter */}
      <section className="live-stats-section" ref={statsRef}>
        <div className="live-stats-grid">
          <div className="live-stat-card">
            <span className="live-stat-icon">🐮</span>
            <span className="live-stat-number">{animalsEnrolled.toLocaleString()}+</span>
            <span className="live-stat-label">{t.animalsEnrolled}</span>
          </div>
          <div className="live-stat-card">
            <span className="live-stat-icon">🧑‍🌾</span>
            <span className="live-stat-number">{farmersRegistered.toLocaleString()}+</span>
            <span className="live-stat-label">{t.farmersRegistered}</span>
          </div>
          <div className="live-stat-card">
            <span className="live-stat-icon">📍</span>
            <span className="live-stat-number">{statesCovered}+</span>
            <span className="live-stat-label">{t.statesCovered}</span>
          </div>
          <div className="live-stat-card">
            <span className="live-stat-icon">🎯</span>
            <span className="live-stat-number">{accuracy}%</span>
            <span className="live-stat-label">{t.matchAccuracy}</span>
          </div>
        </div>
      </section>

      {/* Rolling News Cards — Domain Problems */}
      <section className="news-carousel-section">
        <h2 className="section-title">🚨 Why India Needs Pashu Aadhaar</h2>
        <p className="section-desc">Real problems in livestock management that digital identity solves</p>
        <div className="news-carousel">
          {NEWS_CARDS.map((card, i) => {
            const offset = (i - newsIdx + NEWS_CARDS.length) % NEWS_CARDS.length;
            const isActive = offset === 0;
            const isNext = offset === 1 || offset === NEWS_CARDS.length - 1;
            return (
              <div
                key={i}
                className={`news-card ${isActive ? 'news-active' : ''} ${isNext ? 'news-near' : ''}`}
                style={{
                  transform: `translateX(${(offset > NEWS_CARDS.length / 2 ? offset - NEWS_CARDS.length : offset) * 110}%) scale(${isActive ? 1 : isNext ? 0.88 : 0.76})`,
                  opacity: isActive ? 1 : isNext ? 0.5 : 0.18,
                  zIndex: isActive ? 10 : isNext ? 5 : 1,
                }}
                onClick={() => { clearInterval(newsTimerRef.current); setNewsIdx(i); newsTimerRef.current = setInterval(nextNews, 4000); }}
              >
                <span className="news-icon">{card.icon}</span>
                <span className="news-tag">{card.tag}</span>
                <h3 className="news-title">{card.title}</h3>
                {isActive && <p className="news-desc">{card.desc}</p>}
              </div>
            );
          })}
        </div>
        <div className="news-dots">
          {NEWS_CARDS.map((_, i) => (
            <button
              key={i}
              className={`news-dot ${i === newsIdx ? 'active' : ''}`}
              onClick={() => { clearInterval(newsTimerRef.current); setNewsIdx(i); newsTimerRef.current = setInterval(nextNews, 4000); }}
              aria-label={`News ${i + 1}`}
            />
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="features-section">
        <h2 className="section-title">{t.howItWorks}</h2>
        <p className="section-desc">{t.howItWorksDesc}</p>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-number">1</div>
            <span className="feature-icon">📸</span>
            <h3>{t.stepCapture}</h3>
            <p>{t.stepCaptureDesc}</p>
          </div>
          <div className="feature-card">
            <div className="feature-number">2</div>
            <span className="feature-icon">🤖</span>
            <h3>{t.stepAnalyze}</h3>
            <p>{t.stepAnalyzeDesc}</p>
          </div>
          <div className="feature-card">
            <div className="feature-number">3</div>
            <span className="feature-icon">🆔</span>
            <h3>{t.stepIdentify}</h3>
            <p>{t.stepIdentifyDesc}</p>
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="roles-section">
        <h2 className="section-title">{t.builtForStakeholders}</h2>
        <p className="section-desc">{t.stakeholderDesc}</p>
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
        <h2 className="section-title">{t.poweredBy}</h2>
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
        <h2>{t.readyToDigitize}</h2>
        <p>{t.readyToDigitizeDesc}</p>
        <div className="cta-buttons">
          <Link to="/signup" className="hero-btn hero-btn-primary">{t.createAccount}</Link>
          <Link to="/enroll" className="hero-btn hero-btn-secondary">{t.tryQuickEnrollment}</Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-tricolor">
          <span className="tri-band saffron" />
          <span className="tri-band white" />
          <span className="tri-band green" />
        </div>
        <div className="footer-govt">
          <img src="/ashoka-emblem.svg" alt="Ashoka Emblem" className="footer-emblem" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <div>
            <p className="footer-hindi">पशु आधार — राष्ट्रीय पशुधन पहचान मंच</p>
            <p>{t.footer}</p>
            <p className="footer-digital-india">Digital India 🇮🇳 Initiative</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
