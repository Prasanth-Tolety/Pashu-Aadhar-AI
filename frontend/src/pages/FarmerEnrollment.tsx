import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { createEnrollmentRequest, getEnrollmentRequests } from '../services/api';
import { FarmerEnrollmentRequest } from '../types';
import '../styles/Enrollment.css';

const STATUS_BADGES: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'Pending', color: '#ff9800', icon: '⏳' },
  assigned: { label: 'Agent Assigned', color: '#2196f3', icon: '📋' },
  in_progress: { label: 'In Progress', color: '#9c27b0', icon: '🔄' },
  completed: { label: 'Completed', color: '#4caf50', icon: '✅' },
  cancelled: { label: 'Cancelled', color: '#f44336', icon: '❌' },
};

export default function FarmerEnrollmentRequest_Page() {
  const { idToken } = useAuth();
  const { t } = useLanguage();
  const [requests, setRequests] = useState<FarmerEnrollmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    village: '',
    district: '',
    state: '',
    pincode: '',
    landmark: '',
    animal_count: 1,
    preferred_date: '',
  });

  useEffect(() => {
    loadRequests();
  }, [idToken]);

  const loadRequests = async () => {
    if (!idToken) return;
    try {
      setLoading(true);
      const reqs = await getEnrollmentRequests(idToken);
      setRequests(reqs);
    } catch {
      setError('Failed to load enrollment requests');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idToken) return;

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const result = await createEnrollmentRequest({
        address: {
          village: form.village,
          district: form.district,
          state: form.state,
          pincode: form.pincode || undefined,
          landmark: form.landmark || undefined,
        },
        animal_count: form.animal_count,
        preferred_date: form.preferred_date || undefined,
      }, idToken);

      setSuccess(result.message);
      setShowForm(false);
      setForm({ village: '', district: '', state: '', pincode: '', landmark: '', animal_count: 1, preferred_date: '' });
      await loadRequests();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page enrollment-page">
      <div className="container">
        <div className="page-header">
          <h1>🐄 {t.animalEnrollment || 'Animal Enrollment'}</h1>
          <p>Request an enrollment agent to visit your farm and register your animals</p>
        </div>

        {success && <div className="enrollment-success-msg">✅ {success}</div>}
        {error && <div className="enrollment-error"><span>⚠️</span><p>{error}</p></div>}

        {!showForm ? (
          <button className="btn btn-primary btn-full" onClick={() => setShowForm(true)}>
            ➕ Request New Enrollment
          </button>
        ) : (
          <div className="card enrollment-request-form">
            <h3>📍 Enrollment Request</h3>
            <p className="form-subtitle">An enrollment agent will be assigned to visit your location.</p>
            <form onSubmit={handleSubmit}>
              <div className="form-row-2">
                <div className="form-group">
                  <label>Village / Town *</label>
                  <input
                    type="text"
                    value={form.village}
                    onChange={(e) => setForm({ ...form, village: e.target.value })}
                    placeholder="Enter village name"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>District *</label>
                  <input
                    type="text"
                    value={form.district}
                    onChange={(e) => setForm({ ...form, district: e.target.value })}
                    placeholder="Enter district"
                    required
                  />
                </div>
              </div>
              <div className="form-row-3">
                <div className="form-group">
                  <label>State *</label>
                  <input
                    type="text"
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                    placeholder="Enter state"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Pincode</label>
                  <input
                    type="text"
                    value={form.pincode}
                    onChange={(e) => setForm({ ...form, pincode: e.target.value })}
                    placeholder="e.g., 500001"
                    maxLength={6}
                  />
                </div>
                <div className="form-group">
                  <label>Animals to Enroll</label>
                  <input
                    type="number"
                    value={form.animal_count}
                    onChange={(e) => setForm({ ...form, animal_count: parseInt(e.target.value) || 1 })}
                    min={1}
                    max={50}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Landmark / Directions</label>
                <textarea
                  value={form.landmark}
                  onChange={(e) => setForm({ ...form, landmark: e.target.value })}
                  placeholder="Describe how to reach your farm (near temple, after bridge, etc.)"
                  rows={2}
                />
              </div>
              <div className="form-group">
                <label>Preferred Date</label>
                <input
                  type="date"
                  value={form.preferred_date}
                  onChange={(e) => setForm({ ...form, preferred_date: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
                  {submitting ? '⏳ Submitting...' : '🚀 Submit Enrollment Request'}
                </button>
                <button type="button" className="btn btn-outline" style={{ marginTop: '0.5rem', width: '100%' }} onClick={() => setShowForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Existing Requests */}
        <div className="enrollment-requests-list" style={{ marginTop: '1.5rem' }}>
          <h3>📋 Your Enrollment Requests</h3>
          {loading ? (
            <p className="loading-text">Loading requests...</p>
          ) : requests.length === 0 ? (
            <div className="empty-state">
              <p>No enrollment requests yet. Submit one above!</p>
            </div>
          ) : (
            <div className="request-cards">
              {requests.map((req) => {
                const badge = STATUS_BADGES[req.status] || STATUS_BADGES.pending;
                return (
                  <div className="card request-card" key={req.request_id}>
                    <div className="request-card-header">
                      <span className="request-id">{req.request_id}</span>
                      <span className="request-status-badge" style={{ background: badge.color }}>
                        {badge.icon} {badge.label}
                      </span>
                    </div>
                    <div className="request-card-body">
                      <p>📍 {req.address?.village}, {req.address?.district}, {req.address?.state}</p>
                      <p>🐄 {req.animal_count || 1} animal(s)</p>
                      {req.assigned_agent_name && (
                        <p>👤 Agent: <strong>{req.assigned_agent_name}</strong></p>
                      )}
                      {req.preferred_date && <p>📅 Preferred: {req.preferred_date}</p>}
                      <p className="request-date">Created: {new Date(req.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
