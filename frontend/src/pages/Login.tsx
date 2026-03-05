import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_CONFIG, UserRole } from '../types';
import '../styles/Auth.css';

export default function Login() {
  const navigate = useNavigate();
  const { login, completeNewPassword, needsNewPassword, loading: authLoading } = useAuth();

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(formatPhoneNumber(phoneNumber), password);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await completeNewPassword(newPassword);
      navigate('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to set new password';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="loading-spinner" />
          <p style={{ textAlign: 'center', marginTop: '1rem' }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <Link to="/" className="auth-home-link">🏠 Home</Link>
      <div className="auth-card">
        <div className="auth-header">
          <h1>🐄 पशु आधार</h1>
          <h2>Pashu Aadhaar AI</h2>
          <p className="auth-subtitle">Livestock Identification System</p>
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
              ⚠️ Please set a new password for your account
            </p>
            <div className="form-group">
              <label htmlFor="newPassword">New Password</label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                required
                minLength={8}
              />
            </div>
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                minLength={8}
              />
            </div>
            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? 'Setting password...' : 'Set New Password'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="auth-form">
            <div className="form-group">
              <label htmlFor="phone">Phone Number</label>
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
              <label htmlFor="password">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
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
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}

        <div className="auth-footer">
          Don't have an account?{' '}
          <Link to="/signup" className="auth-footer-link">Create Account</Link>
        </div>
      </div>
    </div>
  );
}
