import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import LanguageSelector from '../components/LanguageSelector';
import { ROLE_CONFIG, UserRole } from '../types';
import '../styles/Auth.css';

export default function Login() {
  const navigate = useNavigate();
  const { login, completeNewPassword, needsNewPassword, loading: authLoading } = useAuth();
  const { t } = useLanguage();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const formatPhoneNumber = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '');
    if (!cleaned.startsWith('91')) {
      return `+91${cleaned}`;
    }
    return `+${cleaned}`;
  };

  /** Convert raw Cognito/AWS error messages into user-friendly translated text */
  const friendlyError = (err: unknown): string => {
    const raw = err instanceof Error ? err.message : String(err);
    const lc = raw.toLowerCase();

    if (lc.includes('incorrect username or password') || lc.includes('not authorized')) return t.incorrectCredentials || raw;
    if (lc.includes('user does not exist') || lc.includes('user not found')) return t.incorrectCredentials || raw;
    if (lc.includes('password') && (lc.includes('policy') || lc.includes('invalid'))) return t.invalidPasswordFormat || raw;
    if (lc.includes('codemismatch')) return t.codeMismatch || raw;
    if (lc.includes('expired')) return t.expiredCode || raw;
    if (lc.includes('limit exceeded') || lc.includes('too many')) return t.unknownError || raw;
    return raw;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(formatPhoneNumber(phoneNumber), password);
    } catch (err: unknown) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError(t.passwordsDoNotMatch);
      return;
    }

    if (newPassword.length < 8) {
      setError(t.passwordMinChars);
      return;
    }

    setLoading(true);
    try {
      await completeNewPassword(newPassword);
      navigate('/dashboard');
    } catch (err: unknown) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="loading-spinner" />
          <p style={{ textAlign: 'center', marginTop: '1rem' }}>{t.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <Link to="/" className="auth-home-link">🏠 {t.home}</Link>
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-lang-row">
            <LanguageSelector compact />
          </div>
          <h1>🐄 {t.appNameHindi}</h1>
          <h2>{t.appName}</h2>
          <p className="auth-subtitle">{t.appSubtitle}</p>
        </div>

        {/* Role legend pills */}
        <div className="role-pills">
          {(Object.keys(ROLE_CONFIG) as UserRole[]).map((role) => (
            <span
              key={role}
              className="role-pill"
              style={{ background: ROLE_CONFIG[role].color }}
            >
              {ROLE_CONFIG[role].icon} {ROLE_CONFIG[role].prefix}
            </span>
          ))}
        </div>

        {error && <div className="auth-error">{error}</div>}

        {needsNewPassword ? (
          <form onSubmit={handleNewPassword} className="auth-form">
            <p className="password-change-notice">
              {t.passwordChangeNotice}
            </p>
            <div className="form-group">
              <label htmlFor="newPassword">{t.newPassword}</label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t.newPassword}
                required
                minLength={8}
              />
            </div>
            <div className="form-group">
              <label htmlFor="confirmPassword">{t.confirmPassword}</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t.confirmPassword}
                required
                minLength={8}
              />
            </div>
            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? t.settingPassword : t.setNewPassword}
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="auth-form">
            <div className="form-group">
              <label htmlFor="phone">{t.phoneNumber}</label>
              <div className="phone-input-wrapper">
                <span className="country-code">+91</span>
                <input
                  id="phone"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="9876543210"
                  required
                  pattern="[0-9]{10}"
                  maxLength={10}
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="password">{t.password}</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.password}
                  required
                  style={{ paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={{
                    position: 'absolute',
                    right: '0.5rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    color: '#888'
                  }}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? t.signingIn : t.signIn}
            </button>
          </form>
        )}

        <div className="auth-footer">
          {t.dontHaveAccount}{' '}
          <Link to="/signup" className="auth-footer-link">{t.createAccount}</Link>
        </div>
      </div>
    </div>
  );
}
