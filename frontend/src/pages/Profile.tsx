import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getProfile, updateProfile, getAnimalsByOwner } from '../services/api';
import { ROLE_CONFIG, UserRole } from '../types';
import '../styles/Profile.css';

interface ProfileData {
  user_id: string;
  phone_number: string;
  name: string;
  role: string;
  owner_id: string | null;
  aadhaar_last4?: string;
  created_at?: string;
  owner?: {
    owner_id: string;
    name: string;
    phone_number?: string;
    village?: string;
    district?: string;
    state?: string;
    pincode?: string;
  };
}

export default function Profile() {
  const { user, idToken } = useAuth();
  const { t } = useLanguage();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [animalCount, setAnimalCount] = useState(0);

  const [form, setForm] = useState({
    name: '',
    village: '',
    district: '',
    state: '',
    pincode: '',
    aadhaar_last4: '',
  });

  const role = (user?.role || 'farmer') as UserRole;
  const roleConfig = user ? ROLE_CONFIG[role] : null;
  const rolePrefix = roleConfig?.prefix || 'USR';
  const displayId = user?.ownerId
    ? `${rolePrefix}-${user.ownerId.slice(-7).toUpperCase()}`
    : `${rolePrefix}-${user?.userId.slice(-7).toUpperCase()}`;

  useEffect(() => {
    if (idToken) {
      fetchProfile();
      if (role === 'farmer' && user?.ownerId) {
        getAnimalsByOwner(user.ownerId, idToken).then(a => setAnimalCount(a.length)).catch(() => {});
      }
    }
  }, [idToken]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const data = await getProfile(idToken!);
      setProfile(data);
      setForm({
        name: data.name || '',
        village: data.owner?.village || '',
        district: data.owner?.district || '',
        state: data.owner?.state || '',
        pincode: data.owner?.pincode || '',
        aadhaar_last4: data.aadhaar_last4 || '',
      });
    } catch {
      setMessage(t.failedToLoadProfile);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      await updateProfile(form, idToken!);
      setMessage(t.profileUpdated);
      setEditing(false);
      await fetchProfile();
    } catch {
      setMessage(t.failedToUpdateProfile);
    } finally {
      setSaving(false);
    }
  };

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' })
    : 'N/A';

  if (loading) {
    return (
      <div className="profile-container">
        <div className="loading-spinner" />
        <p style={{ textAlign: 'center' }}>{t.loadingProfile}</p>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <header className="profile-header">
        <Link to="/dashboard" className="back-link">{t.backToDashboard}</Link>
        <h1>{t.myProfile}</h1>
      </header>

      <div className="profile-body">
        {/* ID Card */}
        <div className="id-card" style={{ background: roleConfig?.gradient }}>
          <div className="id-card-top">
            <span className="id-card-icon">{roleConfig?.icon}</span>
            <div>
              <h2 className="id-card-name">{profile?.name || user?.name || 'User'}</h2>
              <span className="id-card-role">{roleConfig?.label}</span>
            </div>
          </div>
          <div className="id-card-bottom">
            <div className="id-card-field">
              <span className="id-card-label">{t.userId}</span>
              <span className="id-card-value">{displayId}</span>
            </div>
            <div className="id-card-field">
              <span className="id-card-label">{t.phone}</span>
              <span className="id-card-value">{profile?.phone_number || user?.phoneNumber}</span>
            </div>
            {form.aadhaar_last4 && (
              <div className="id-card-field">
                <span className="id-card-label">{t.aadhaar}</span>
                <span className="id-card-value">XXXX-XXXX-{form.aadhaar_last4}</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats Summary */}
        <div className="profile-stats">
          <div className="stat-card">
            <span className="stat-icon">📅</span>
            <div><span className="stat-value">{memberSince}</span><span className="stat-label">{t.memberSince}</span></div>
          </div>
          {role === 'farmer' && (
            <div className="stat-card">
              <span className="stat-icon">🐮</span>
              <div><span className="stat-value">{animalCount}</span><span className="stat-label">{t.animalsEnrolled}</span></div>
            </div>
          )}
          <div className="stat-card">
            <span className="stat-icon">✅</span>
            <div><span className="stat-value">{t.active}</span><span className="stat-label">{t.accountStatus}</span></div>
          </div>
        </div>

        {message && (
          <div className={`profile-message ${message.includes('success') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}

        {/* Profile Details */}
        <div className="profile-section">
          <div className="profile-section-header">
            <h3>{t.personalDetails}</h3>
            {!editing && (
              <button className="edit-btn" onClick={() => setEditing(true)}>
                ✏️ {t.edit}
              </button>
            )}
          </div>

          {editing ? (
            <div className="profile-form">
              <div className="form-group">
                <label>{t.fullName}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>{t.aadhaarLast4}</label>
                <input
                  type="text"
                  value={form.aadhaar_last4}
                  onChange={(e) => setForm({ ...form, aadhaar_last4: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  maxLength={4}
                  placeholder="XXXX"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{t.village}</label>
                  <input
                    type="text"
                    value={form.village}
                    onChange={(e) => setForm({ ...form, village: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>{t.district}</label>
                  <input
                    type="text"
                    value={form.district}
                    onChange={(e) => setForm({ ...form, district: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{t.state}</label>
                  <input
                    type="text"
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>{t.pincode}</label>
                  <input
                    type="text"
                    value={form.pincode}
                    onChange={(e) => setForm({ ...form, pincode: e.target.value })}
                    maxLength={6}
                  />
                </div>
              </div>
              <div className="profile-form-actions">
                <button className="save-btn" onClick={handleSave} disabled={saving}>
                  {saving ? t.saving : t.saveChanges}
                </button>
                <button className="cancel-btn" onClick={() => setEditing(false)}>{t.cancel}</button>
              </div>
            </div>
          ) : (
            <div className="profile-info-grid">
              <InfoRow label={t.fullName} value={profile?.name} />
              <InfoRow label={t.phone} value={profile?.phone_number} />
              <InfoRow label={t.aadhaar} value={form.aadhaar_last4 ? `XXXX-XXXX-${form.aadhaar_last4}` : undefined} />
              <InfoRow label={t.village} value={profile?.owner?.village} />
              <InfoRow label={t.district} value={profile?.owner?.district} />
              <InfoRow label={t.state} value={profile?.owner?.state} />
              <InfoRow label={t.pincode} value={profile?.owner?.pincode} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="info-row">
      <span className="info-row-label">{label}</span>
      <span className="info-row-value">{value || '—'}</span>
    </div>
  );
}
