import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import LanguageSelector from '../components/LanguageSelector';
import { resendConfirmationCode } from '../services/auth';
import { ALL_ROLES, ROLE_CONFIG, UserRole } from '../types';
import '../styles/Auth.css';

type Step = 'role' | 'form' | 'verify';

export default function Signup() {
  const navigate = useNavigate();
  const { signup, confirmSignUp, login } = useAuth();
  const { t } = useLanguage();

  const [step, setStep] = useState<Step>('role');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [aadhaarLast4, setAadhaarLast4] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const roleConfig = selectedRole ? ROLE_CONFIG[selectedRole] : null;

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.startsWith('91') ? `+${cleaned}` : `+91${cleaned}`;
  };

  /** Convert raw Cognito/AWS error messages into user-friendly translated text */
  const friendlyError = (err: unknown): string => {
    const raw = err instanceof Error ? err.message : String(err);
    const lc = raw.toLowerCase();

    if (lc.includes('password') && (lc.includes('policy') || lc.includes('invalid'))) return t.invalidPasswordFormat;
    if (lc.includes('schema') || lc.includes('attribute')) return t.signupFailed;
    if (lc.includes('codemismatch') || lc.includes('code mismatch')) return t.codeMismatch;
    if (lc.includes('expiredcode') || lc.includes('expired')) return t.expiredCode;
    if (lc.includes('invalid phone') || lc.includes('invalid parameter')) return t.invalidPhoneFormat;
    if (lc.includes('sms') || lc.includes('delivery')) return t.smsDeliveryError;
    if (lc.includes('limit exceeded') || lc.includes('too many')) return t.unknownError;
    // Return the raw message for anything else — it's usually specific enough
    return raw;
  };

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setStep('form');
    setError('');
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');

    if (password !== confirmPassword) {
      setError(t.passwordsDoNotMatch);
      return;
    }
    if (password.length < 8) {
      setError(t.passwordMinChars);
      return;
    }
    if (aadhaarLast4 && aadhaarLast4.length !== 4) {
      setError(t.aadhaarExact4);
      return;
    }

    setLoading(true);
    try {
      const fullPhone = formatPhone(phoneNumber);
      await signup(fullPhone, password, name, selectedRole!, aadhaarLast4 || undefined);
      setStep('verify');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      // If username already exists but UNCONFIRMED, resend code and go to verify step
      if (msg.includes('already exists') || msg.includes('UsernameExistsException')) {
        try {
          const fullPhone = formatPhone(phoneNumber);
          await resendConfirmationCode(fullPhone);
          setInfo(t.accountExistsUnverified);
          setStep('verify');
        } catch {
          setError(t.accountExistsSignIn);
        }
      } else {
        setError(friendlyError(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const fullPhone = formatPhone(phoneNumber);
      await confirmSignUp(fullPhone, verificationCode);
      // Auto-login after verification
      await login(fullPhone, password);
      navigate('/dashboard');
    } catch (err: unknown) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResending(true);
    setError('');
    setInfo('');
    try {
      const fullPhone = formatPhone(phoneNumber);
      await resendConfirmationCode(fullPhone);
      setInfo(t.resendCodeSuccess);
    } catch (err: unknown) {
      setError(friendlyError(err));
    } finally {
      setResending(false);
    }
  };

  const bgGradient = roleConfig
    ? `linear-gradient(160deg, ${roleConfig.color}10 0%, #f0f4ff 40%, ${roleConfig.color}15 100%)`
    : 'linear-gradient(160deg, #f0f4ff 0%, #e8eaf6 30%, #f3e5f5 70%, #fce4ec 100%)';

  return (
    <div className="auth-container" style={{ background: bgGradient }}>
      <Link to="/" className="auth-home-link">🏠 {t.home}</Link>
      <div className="auth-card">
        {/* Header */}
        <div className="auth-header">
          <div className="auth-lang-row">
            <LanguageSelector compact />
          </div>
          <h1>🐄 {t.appNameHindi}</h1>
          <h2>{t.appName}</h2>
          {step === 'role' && (
            <p className="auth-subtitle">{t.chooseRole}</p>
          )}
          {step === 'form' && roleConfig && (
            <div className="selected-role-badge" style={{ background: roleConfig.color }}>
              <span>{roleConfig.icon}</span> {roleConfig.label}
            </div>
          )}
          {step === 'verify' && (
            <p className="auth-subtitle">{t.enterVerificationCode}</p>
          )}
        </div>

        {error && <div className="auth-error">{error}</div>}
        {info && <div className="auth-info">{info}</div>}

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
              <label htmlFor="name">{t.fullName} *</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.fullName}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="phone">{t.phoneNumber} *</label>
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
              <label htmlFor="aadhaar">{t.aadhaarLast4}</label>
              <input
                id="aadhaar"
                type="text"
                value={aadhaarLast4}
                onChange={(e) => setAadhaarLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="XXXX"
                maxLength={4}
                inputMode="numeric"
              />
              <span className="form-hint">{t.aadhaarHint}</span>
            </div>

            <div className="form-group">
              <label htmlFor="password">{t.password} *</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.passwordMinChars}
                  required
                  minLength={8}
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

            <div className="form-group">
              <label htmlFor="confirmPassword">{t.confirmPassword} *</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t.confirmPassword}
                  required
                  minLength={8}
                  style={{ paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
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
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="auth-btn"
              style={{ background: roleConfig?.gradient }}
              disabled={loading}
            >
              {loading ? t.creatingAccount : t.createAccount}
            </button>

            <button
              type="button"
              className="auth-link-btn"
              onClick={() => { setStep('role'); setError(''); }}
            >
              {t.changeRole}
            </button>
          </form>
        )}

        {/* Step 3: Verification */}
        {step === 'verify' && (
          <form onSubmit={handleVerify} className="auth-form">
            <div className="form-group">
              <label htmlFor="code">{t.verificationCode}</label>
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
              {loading ? t.verifying : t.verifyAndContinue}
            </button>
            <button
              type="button"
              className="auth-link-btn"
              onClick={handleResendCode}
              disabled={resending}
            >
              {resending ? t.sending : t.resendCode}
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="auth-footer">
          {t.alreadyHaveAccount}{' '}
          <Link to="/login" className="auth-footer-link">{t.signIn}</Link>
        </div>
      </div>
    </div>
  );
}
