import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ALL_ROLES, ROLE_CONFIG, UserRole } from '../types';
import '../styles/Auth.css';

type Step = 'role' | 'form' | 'verify';

export default function Signup() {
  const navigate = useNavigate();
  const { signup, confirmSignUp, login } = useAuth();

  const [step, setStep] = useState<Step>('role');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [aadhaarLast4, setAadhaarLast4] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const roleConfig = selectedRole ? ROLE_CONFIG[selectedRole] : null;

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.startsWith('91') ? `+${cleaned}` : `+91${cleaned}`;
  };

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setStep('form');
    setError('');
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (aadhaarLast4 && aadhaarLast4.length !== 4) {
      setError('Please enter exactly last 4 digits of Aadhaar');
      return;
    }

    setLoading(true);
    try {
      const fullPhone = formatPhone(phoneNumber);
      await signup(fullPhone, password, name, selectedRole!, aadhaarLast4 || undefined);
      setStep('verify');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Signup failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const fullPhone = formatPhone(phoneNumber);
      await confirmSignUp(fullPhone, verificationCode);
      // Auto-login after verification
      await login(fullPhone, password);
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const bgGradient = roleConfig
    ? roleConfig.gradient
    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

  return (
    <div className="auth-container" style={{ background: bgGradient }}>
      <div className="auth-card">
        {/* Header */}
        <div className="auth-header">
          <h1>🐄 पशु आधार</h1>
          <h2>Pashu Aadhaar AI</h2>
          {step === 'role' && (
            <p className="auth-subtitle">Choose your role to get started</p>
          )}
          {step === 'form' && roleConfig && (
            <div className="selected-role-badge" style={{ background: roleConfig.color }}>
              <span>{roleConfig.icon}</span> {roleConfig.label}
            </div>
          )}
          {step === 'verify' && (
            <p className="auth-subtitle">Enter the verification code sent to your phone</p>
          )}
        </div>

        {error && <div className="auth-error">{error}</div>}

        {/* Step 1: Role Selection */}
        {step === 'role' && (
          <div className="role-selection">
            {ALL_ROLES.map((role) => {
              const config = ROLE_CONFIG[role];
              return (
                <button
                  key={role}
                  className="role-card"
                  onClick={() => handleRoleSelect(role)}
                  style={{ borderColor: config.color }}
                >
                  <span className="role-card-icon">{config.icon}</span>
                  <div className="role-card-content">
                    <span className="role-card-label">{config.label}</span>
                    <span className="role-card-desc">{config.description}</span>
                  </div>
                  <span className="role-card-arrow" style={{ color: config.color }}>→</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Step 2: Signup Form */}
        {step === 'form' && (
          <form onSubmit={handleSignup} className="auth-form">
            <div className="form-group">
              <label htmlFor="name">Full Name *</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="phone">Phone Number *</label>
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
              <label htmlFor="aadhaar">Aadhaar (last 4 digits)</label>
              <input
                id="aadhaar"
                type="text"
                value={aadhaarLast4}
                onChange={(e) => setAadhaarLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="XXXX"
                maxLength={4}
                inputMode="numeric"
              />
              <span className="form-hint">For identity verification purposes</span>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password *</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                required
                minLength={8}
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password *</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                required
                minLength={8}
              />
            </div>

            <button
              type="submit"
              className="auth-btn"
              style={{ background: roleConfig?.gradient }}
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>

            <button
              type="button"
              className="auth-link-btn"
              onClick={() => { setStep('role'); setError(''); }}
            >
              ← Change Role
            </button>
          </form>
        )}

        {/* Step 3: Verification */}
        {step === 'verify' && (
          <form onSubmit={handleVerify} className="auth-form">
            <div className="form-group">
              <label htmlFor="code">Verification Code</label>
              <input
                id="code"
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="Enter 6-digit code"
                required
                maxLength={6}
                inputMode="numeric"
                className="verification-input"
              />
            </div>
            <button
              type="submit"
              className="auth-btn"
              style={{ background: roleConfig?.gradient }}
              disabled={loading}
            >
              {loading ? 'Verifying...' : 'Verify & Continue'}
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="auth-footer">
          Already have an account?{' '}
          <Link to="/login" className="auth-footer-link">Sign In</Link>
        </div>
      </div>
    </div>
  );
}
