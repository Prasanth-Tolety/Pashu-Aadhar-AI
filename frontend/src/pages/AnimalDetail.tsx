import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { ROLE_CONFIG, UserRole } from '../types';
import { getUploadUrl, updateAnimal as apiUpdateAnimal, getAiHealthReport, getFraudReasons } from '../services/api';
import { uploadToS3 } from '../services/s3';
import axios from 'axios';
import QRCodeCard from '../components/QRCodeCard';
import SpeakButton from '../components/SpeakButton';
import VoiceToggle from '../components/VoiceToggle';
import { Link as RouterLink } from 'react-router-dom';
import '../styles/AnimalDetail.css';
import '../styles/QRCode.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

interface Animal {
  livestock_id: string;
  species?: string;
  breed?: string;
  gender?: string;
  age_months?: number;
  color_pattern?: string;
  horn_type?: string;
  identifiable_marks?: string;
  village?: string;
  district?: string;
  state?: string;
  owner_id?: string;
  enrolled_at?: string;
  image_key?: string;
  photo_key?: string;
  muzzle_key?: string;
  photo_url?: string;
  muzzle_url?: string;
  latitude?: number;
  longitude?: number;
  status?: string;
  // Fraud score (from backend)
  fraud_risk_score?: number;
  risk_level?: string;
  fraud_flags?: string[];
}

interface HealthRecord {
  record_id: string;
  record_type: string;
  vaccine_type?: string;
  administered_by?: string;
  record_date: string;
  next_due_date?: string;
  notes?: string;
}

interface MilkYield {
  yield_id: string;
  yield_date: string;
  morning_yield: number;
  evening_yield: number;
  total_yield: number;
}

interface InsurancePolicy {
  policy_id: string;
  provider: string;
  policy_number?: string;
  coverage_amount: number;
  premium: number;
  start_date: string;
  end_date?: string;
  status: string;
  notes?: string;
  created_at: string;
}

interface LoanRecord {
  loan_id: string;
  lender: string;
  loan_amount: number;
  interest_rate: number;
  tenure_months: number;
  disbursement_date: string;
  repayment_status: string;
  notes?: string;
  created_at: string;
}

type TabType = 'details' | 'health' | 'milk' | 'insurance' | 'loans';

// Role-based permissions config
const ROLE_PERMISSIONS: Record<UserRole, {
  canViewDetails: boolean;
  canViewHealth: boolean;
  canViewMilk: boolean;
  canViewInsurance: boolean;
  canViewLoans: boolean;
  canEditDetails: boolean;
  canAddHealth: boolean;
  canAddMilk: boolean;
  canAddInsurance: boolean;
  canAddLoan: boolean;
  canViewLocation: boolean;
  canViewOwner: boolean;
}> = {
  farmer: {
    canViewDetails: true, canViewHealth: true, canViewMilk: true,
    canViewInsurance: true, canViewLoans: true,
    canEditDetails: true, canAddHealth: true, canAddMilk: true,
    canAddInsurance: true, canAddLoan: true,
    canViewLocation: true, canViewOwner: true,
  },
  veterinarian: {
    canViewDetails: true, canViewHealth: true, canViewMilk: false,
    canViewInsurance: false, canViewLoans: false,
    canEditDetails: false, canAddHealth: true, canAddMilk: false,
    canAddInsurance: false, canAddLoan: false,
    canViewLocation: false, canViewOwner: false,
  },
  insurer: {
    canViewDetails: true, canViewHealth: true, canViewMilk: false,
    canViewInsurance: true, canViewLoans: false,
    canEditDetails: false, canAddHealth: false, canAddMilk: false,
    canAddInsurance: true, canAddLoan: false,
    canViewLocation: false, canViewOwner: false,
  },
  government: {
    canViewDetails: true, canViewHealth: true, canViewMilk: true,
    canViewInsurance: true, canViewLoans: true,
    canEditDetails: false, canAddHealth: false, canAddMilk: false,
    canAddInsurance: false, canAddLoan: false,
    canViewLocation: true, canViewOwner: true,
  },
  admin: {
    canViewDetails: true, canViewHealth: true, canViewMilk: true,
    canViewInsurance: true, canViewLoans: true,
    canEditDetails: true, canAddHealth: true, canAddMilk: true,
    canAddInsurance: true, canAddLoan: true,
    canViewLocation: true, canViewOwner: true,
  },
  enrollment_agent: {
    canViewDetails: true, canViewHealth: false, canViewMilk: false,
    canViewInsurance: false, canViewLoans: false,
    canEditDetails: false, canAddHealth: false, canAddMilk: false,
    canAddInsurance: false, canAddLoan: false,
    canViewLocation: true, canViewOwner: false,
  },
};

export default function AnimalDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, idToken } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const role = (user?.role || 'farmer') as UserRole;
  const perms = ROLE_PERMISSIONS[role];
  const roleConfig = ROLE_CONFIG[role];
  const isGovOrAdmin = role === 'government' || role === 'admin';

  const [animal, setAnimal] = useState<Animal | null>(null);
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [milkYields, setMilkYields] = useState<MilkYield[]>([]);
  const [insurancePolicies, setInsurancePolicies] = useState<InsurancePolicy[]>([]);
  const [loanRecords, setLoanRecords] = useState<LoanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('details');

  // Editing state for farmer/admin
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Animal>>({});

  // Health record form
  const [showHealthForm, setShowHealthForm] = useState(false);
  const [healthForm, setHealthForm] = useState({
    record_type: 'vaccination',
    vaccine_type: '',
    notes: '',
    record_date: new Date().toISOString().split('T')[0],
  });

  // Milk yield form
  const [showMilkForm, setShowMilkForm] = useState(false);
  const [milkForm, setMilkForm] = useState({
    morning_yield: '',
    evening_yield: '',
    yield_date: new Date().toISOString().split('T')[0],
  });

  // Insurance form
  const [showInsuranceForm, setShowInsuranceForm] = useState(false);
  const [insuranceForm, setInsuranceForm] = useState({
    provider: '',
    policy_number: '',
    coverage_amount: '',
    premium: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    notes: '',
  });

  // Loan form
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [loanForm, setLoanForm] = useState({
    lender: '',
    loan_amount: '',
    interest_rate: '',
    tenure_months: '',
    disbursement_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Photo upload
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  // AI Health Report
  const [healthReport, setHealthReport] = useState('');
  const [healthReportLoading, setHealthReportLoading] = useState(false);
  const [showHealthReport, setShowHealthReport] = useState(false);

  // Fraud Score Reasons
  const [fraudReasons, setFraudReasons] = useState<string[]>([]);
  const [fraudSubScores, setFraudSubScores] = useState<Record<string, number> | null>(null);
  const [showFraudReasons, setShowFraudReasons] = useState(false);
  const [fraudReasonsLoading, setFraudReasonsLoading] = useState(false);

  const headers = { Authorization: idToken || '' };

  useEffect(() => {
    if (id) fetchAnimalData();
  }, [id]);

  const fetchAnimalData = async () => {
    try {
      setLoading(true);
      const [animalRes, healthRes, milkRes, insuranceRes, loansRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/animals/${id}`, { headers }),
        axios.get(`${API_BASE_URL}/animals/${id}/health`, { headers }).catch(() => ({ data: { records: [] } })),
        axios.get(`${API_BASE_URL}/animals/${id}/milk`, { headers }).catch(() => ({ data: { yields: [] } })),
        axios.get(`${API_BASE_URL}/animals/${id}/insurance`, { headers }).catch(() => ({ data: { policies: [] } })),
        axios.get(`${API_BASE_URL}/animals/${id}/loans`, { headers }).catch(() => ({ data: { loans: [] } })),
      ]);

      setAnimal(animalRes.data.animal);
      setEditForm(animalRes.data.animal || {});
      setHealthRecords(healthRes.data.records || []);
      setMilkYields(milkRes.data.yields || []);
      setInsurancePolicies(insuranceRes.data.policies || []);
      setLoanRecords(loansRes.data.loans || []);
    } catch {
      setError(t.failedToLoadAnimal);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDetails = async () => {
    try {
      await axios.post(`${API_BASE_URL}/animals/${id}`, editForm, { headers });
      setAnimal({ ...animal!, ...editForm });
      setEditing(false);
    } catch {
      alert(t.failedToUpdateAnimal);
    }
  };

  const handleAddHealthRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE_URL}/animals/${id}/health`, healthForm, { headers });
      setShowHealthForm(false);
      setHealthForm({ record_type: 'vaccination', vaccine_type: '', notes: '', record_date: new Date().toISOString().split('T')[0] });
      const res = await axios.get(`${API_BASE_URL}/animals/${id}/health`, { headers });
      setHealthRecords(res.data.records || []);
    } catch {
      alert(t.failedToAddHealth);
    }
  };

  const handleAddMilkYield = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE_URL}/animals/${id}/milk`, milkForm, { headers });
      setShowMilkForm(false);
      setMilkForm({ morning_yield: '', evening_yield: '', yield_date: new Date().toISOString().split('T')[0] });
      const res = await axios.get(`${API_BASE_URL}/animals/${id}/milk`, { headers });
      setMilkYields(res.data.yields || []);
    } catch {
      alert(t.failedToAddMilk);
    }
  };

  const handleAddInsurance = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE_URL}/animals/${id}/insurance`, insuranceForm, { headers });
      setShowInsuranceForm(false);
      setInsuranceForm({ provider: '', policy_number: '', coverage_amount: '', premium: '', start_date: new Date().toISOString().split('T')[0], end_date: '', notes: '' });
      const res = await axios.get(`${API_BASE_URL}/animals/${id}/insurance`, { headers });
      setInsurancePolicies(res.data.policies || []);
    } catch {
      alert(t.failedToAddInsurance);
    }
  };

  const handleAddLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE_URL}/animals/${id}/loans`, loanForm, { headers });
      setShowLoanForm(false);
      setLoanForm({ lender: '', loan_amount: '', interest_rate: '', tenure_months: '', disbursement_date: new Date().toISOString().split('T')[0], notes: '' });
      const res = await axios.get(`${API_BASE_URL}/animals/${id}/loans`, { headers });
      setLoanRecords(res.data.loans || []);
    } catch {
      alert(t.failedToAddLoan);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !idToken) return;
    setPhotoUploading(true);
    try {
      const { uploadUrl, imageKey } = await getUploadUrl(file.name, file.type);
      await uploadToS3(uploadUrl, file, () => {});
      await apiUpdateAnimal(id!, { photo_key: imageKey } as never, idToken);
      // Refresh animal data to get new presigned URL
      await fetchAnimalData();
    } catch {
      alert('Failed to update photo');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!id || !idToken) return;
    setHealthReportLoading(true);
    setShowHealthReport(true);
    setHealthReport('');
    try {
      const res = await getAiHealthReport(id, idToken);
      setHealthReport(res.report);
    } catch {
      setHealthReport('Failed to generate health report. Please try again.');
    } finally {
      setHealthReportLoading(false);
    }
  };

  const handleShowFraudReasons = async () => {
    if (!id || !idToken) return;
    setFraudReasonsLoading(true);
    setShowFraudReasons(true);
    try {
      const res = await getFraudReasons(id, idToken);
      setFraudReasons(res.reasons);
      setFraudSubScores(res.sub_scores);
    } catch {
      setFraudReasons(['Unable to fetch fraud analysis details']);
    } finally {
      setFraudReasonsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="detail-container">
        <div className="loading-state">
          <div className="loading-spinner" />
          <p>{t.loadingAnimalData}</p>
        </div>
      </div>
    );
  }

  if (error || !animal) {
    return (
      <div className="detail-container">
        <div className="error-state">
          <p>{error || t.animalNotFoundError}</p>
          <button onClick={() => navigate('/dashboard')} className="back-btn">{t.backToDashboard}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="detail-container">
      {/* Header */}
      <header className="detail-header">
        <Link to="/dashboard" className="back-link">{t.backToDashboard}</Link>
        <h1>{t.animalProfile} <SpeakButton text={t.animalProfile} /></h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <VoiceToggle />
          <span className="role-chip" style={{ background: roleConfig.color + '22', color: roleConfig.color }}>
            {roleConfig.icon} {roleConfig.label}
          </span>
        </div>
      </header>

      {/* Animal ID Banner */}
      <div className="id-banner" style={{ background: roleConfig.gradient }}>
        <span className="id-label">{t.livestockId}</span>
        <span className="id-value-large">{animal.livestock_id}</span>
        {animal.status && (
          <span className={`animal-status status-${animal.status}`}>{animal.status}</span>
        )}
      </div>

      {/* Fraud Risk Score — visible to gov/admin/insurer only */}
      {isGovOrAdmin && animal.fraud_risk_score !== undefined && (
        <div className={`fraud-score-banner risk-${animal.risk_level || 'low'}`}>
          <div className="fraud-score-left">
            <span className="fraud-score-icon">
              {animal.risk_level === 'critical' ? '🚨' : animal.risk_level === 'high' ? '⚠️' : animal.risk_level === 'medium' ? '🔶' : '✅'}
            </span>
            <div>
              <span className="fraud-score-label">Fraud Risk Score</span>
              <span className="fraud-score-value">{animal.fraud_risk_score.toFixed(1)} / 100</span>
            </div>
          </div>
          <div className="fraud-score-right-actions">
            <button className="fraud-reasons-btn" onClick={handleShowFraudReasons} disabled={fraudReasonsLoading}>
              {fraudReasonsLoading ? '⏳' : '🔍'} Why this score?
            </button>
            <span className={`fraud-risk-badge badge-${animal.risk_level || 'low'}`}>
              {(animal.risk_level || 'low').toUpperCase()}
            </span>
          </div>
        </div>
      )}

      {/* Fraud Reasons Modal */}
      {showFraudReasons && (
        <div className="modal-overlay" onClick={() => setShowFraudReasons(false)}>
          <div className="modal-content fraud-reasons-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🔍 Fraud Score Analysis</h3>
              <button className="modal-close" onClick={() => setShowFraudReasons(false)}>✕</button>
            </div>
            {fraudReasonsLoading ? (
              <div className="modal-loading"><div className="loading-spinner" /> Loading analysis...</div>
            ) : (
              <div className="modal-body">
                <div className="fraud-score-summary">
                  <span className={`fraud-risk-badge badge-${animal.risk_level || 'low'}`}>
                    {(animal.risk_level || 'low').toUpperCase()}
                  </span>
                  <span className="fraud-score-big">{animal.fraud_risk_score?.toFixed(1)} / 100</span>
                </div>
                {fraudSubScores && (
                  <div className="fraud-sub-scores">
                    <h4>Sub-Score Breakdown</h4>
                    <div className="sub-score-grid">
                      <div className="sub-score-item">
                        <span className="sub-score-label">🧑‍💼 Agent Behavior</span>
                        <div className="sub-score-bar"><div className="sub-score-fill" style={{ width: `${fraudSubScores.agent_behavior || 0}%` }} /></div>
                        <span className="sub-score-value">{fraudSubScores.agent_behavior || 0}</span>
                      </div>
                      <div className="sub-score-item">
                        <span className="sub-score-label">📱 Device Trust</span>
                        <div className="sub-score-bar"><div className="sub-score-fill" style={{ width: `${fraudSubScores.device_trust || 0}%` }} /></div>
                        <span className="sub-score-value">{fraudSubScores.device_trust || 0}</span>
                      </div>
                      <div className="sub-score-item">
                        <span className="sub-score-label">📍 Location</span>
                        <div className="sub-score-bar"><div className="sub-score-fill" style={{ width: `${fraudSubScores.location_consistency || 0}%` }} /></div>
                        <span className="sub-score-value">{fraudSubScores.location_consistency || 0}</span>
                      </div>
                      <div className="sub-score-item">
                        <span className="sub-score-label">📷 Image Quality</span>
                        <div className="sub-score-bar"><div className="sub-score-fill" style={{ width: `${fraudSubScores.image_quality || 0}%` }} /></div>
                        <span className="sub-score-value">{fraudSubScores.image_quality || 0}</span>
                      </div>
                      <div className="sub-score-item">
                        <span className="sub-score-label">🔄 Duplicate Check</span>
                        <div className="sub-score-bar"><div className="sub-score-fill" style={{ width: `${fraudSubScores.duplicate_embedding || 0}%` }} /></div>
                        <span className="sub-score-value">{fraudSubScores.duplicate_embedding || 0}</span>
                      </div>
                    </div>
                  </div>
                )}
                <div className="fraud-reasons-list">
                  <h4>🚩 Reasons</h4>
                  <ul>
                    {fraudReasons.map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        {perms.canViewDetails && (
          <button className={`tab ${activeTab === 'details' ? 'active' : ''}`} onClick={() => setActiveTab('details')}>
            📋 {t.details}
          </button>
        )}
        {perms.canViewHealth && (
          <button className={`tab ${activeTab === 'health' ? 'active' : ''}`} onClick={() => setActiveTab('health')}>
            💉 {t.health} ({healthRecords.length})
          </button>
        )}
        {perms.canViewMilk && (
          <button className={`tab ${activeTab === 'milk' ? 'active' : ''}`} onClick={() => setActiveTab('milk')}>
            🥛 {t.milk} ({milkYields.length})
          </button>
        )}
        {perms.canViewInsurance && (
          <button className={`tab ${activeTab === 'insurance' ? 'active' : ''}`} onClick={() => setActiveTab('insurance')}>
            🛡️ {t.insurance} ({insurancePolicies.length})
          </button>
        )}
        {perms.canViewLoans && (
          <button className={`tab ${activeTab === 'loans' ? 'active' : ''}`} onClick={() => setActiveTab('loans')}>
            💰 {t.loans} ({loanRecords.length})
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'details' && perms.canViewDetails && (
          <div className="details-tab">
            {/* Profile photo & muzzle ROI */}
            <div className="animal-images-section">
              <div className="animal-photo-box">
                {animal.photo_url ? (
                  <img src={animal.photo_url} alt="Animal profile" className="animal-profile-img" />
                ) : (
                  <div className="animal-photo-placeholder">🐄<span>No photo</span></div>
                )}
                {perms.canEditDetails && (
                  <label className="photo-change-btn">
                    📷 {photoUploading ? 'Uploading...' : 'Change Photo'}
                    <input
                      type="file"
                      accept="image/*"
                      ref={photoInputRef}
                      onChange={handlePhotoChange}
                      style={{ display: 'none' }}
                      disabled={photoUploading}
                    />
                  </label>
                )}
              </div>
              {animal.muzzle_url && (
                <div className="animal-muzzle-box">
                  <img src={animal.muzzle_url} alt="Muzzle ROI" className="animal-muzzle-img" />
                  <span className="muzzle-readonly-badge">👃 Muzzle ROI (read-only)</span>
                </div>
              )}
            </div>

            {/* QR Code for tag / sharing */}
            <QRCodeCard
              livestockId={animal.livestock_id}
              animalName={[animal.species, animal.breed].filter(Boolean).join(' — ')}
              ownerName={animal.owner_id}
            />

            {/* AI Vet Assistant Quick Link */}
            <RouterLink
              to={`/ai-assistant?animal_id=${animal.livestock_id}`}
              className="ai-assistant-link-card"
            >
              <span className="ai-link-icon">🤖</span>
              <div>
                <strong>AI Vet Assistant</strong>
                <span>Ask AI about this animal’s health, symptoms, or vaccines</span>
              </div>
              <span className="ai-link-arrow">→</span>
            </RouterLink>
            {/* AI Health Report Generator */}
            <div className="health-report-section">
              <button
                className="health-report-btn"
                onClick={handleGenerateReport}
                disabled={healthReportLoading}
              >
                {healthReportLoading ? (
                  <><span className="loading-spinner-sm" /> Generating Report...</>
                ) : (
                  <>📋 Generate AI Health Report</>
                )}
              </button>
            </div>

            {/* Health Report Modal */}
            {showHealthReport && (
              <div className="modal-overlay" onClick={() => setShowHealthReport(false)}>
                <div className="modal-content health-report-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3>📋 AI Health Report</h3>
                    <button className="modal-close" onClick={() => setShowHealthReport(false)}>✕</button>
                  </div>
                  {healthReportLoading ? (
                    <div className="modal-loading">
                      <div className="loading-spinner" />
                      <p>Analyzing animal data and generating report...</p>
                    </div>
                  ) : (
                    <div className="modal-body health-report-body">
                      <div className="report-meta">
                        <span>🐄 {animal.livestock_id}</span>
                        <span>📅 {new Date().toLocaleDateString('en-IN')}</span>
                      </div>
                      <div className="report-content">
                        {healthReport.split('\n').map((line, i) => {
                          if (line.startsWith('**') && line.includes('**')) {
                            const content = line.replace(/\*\*/g, '');
                            return <h4 key={i} className="report-heading">{content}</h4>;
                          }
                          if (line.startsWith('•') || line.startsWith('- ') || line.startsWith('* ')) {
                            return <p key={i} className="report-bullet">• {line.replace(/^[•\-*]\s*/, '')}</p>;
                          }
                          if (line.match(/^\d+\./)) {
                            return <p key={i} className="report-step">{line}</p>;
                          }
                          return line.trim() ? <p key={i}>{line}</p> : <br key={i} />;
                        })}
                      </div>
                      <div className="report-footer">
                        <SpeakButton text={healthReport} size="normal" />
                        <span className="report-disclaimer">⚠️ AI-generated report — consult a veterinarian for clinical decisions</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {perms.canEditDetails && !editing && (
              <button className="edit-details-btn" onClick={() => setEditing(true)}>✏️ {t.editDetails}</button>
            )}
            {editing ? (
              <div className="edit-details-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>{t.speciesLabel}</label>
                    <select value={editForm.species || ''} onChange={(e) => setEditForm({ ...editForm, species: e.target.value })}>
                      <option value="cattle">{t.cattle}</option>
                      <option value="buffalo">{t.buffalo}</option>
                      <option value="goat">{t.goat}</option>
                      <option value="sheep">{t.sheep}</option>
                      <option value="other">{t.other}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t.breedLabel}</label>
                    <input value={editForm.breed || ''} onChange={(e) => setEditForm({ ...editForm, breed: e.target.value })} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>{t.genderLabel}</label>
                    <select value={editForm.gender || ''} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}>
                      <option value="">{t.selectGender}</option>
                      <option value="male">{t.male}</option>
                      <option value="female">{t.female}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t.ageMonths}</label>
                    <input type="number" value={editForm.age_months || ''} onChange={(e) => setEditForm({ ...editForm, age_months: parseInt(e.target.value) || 0 })} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>{t.colorPattern}</label>
                    <input value={editForm.color_pattern || ''} onChange={(e) => setEditForm({ ...editForm, color_pattern: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>{t.hornType}</label>
                    <input value={editForm.horn_type || ''} onChange={(e) => setEditForm({ ...editForm, horn_type: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label>{t.identifiableMarks}</label>
                  <textarea value={editForm.identifiable_marks || ''} onChange={(e) => setEditForm({ ...editForm, identifiable_marks: e.target.value })} rows={2} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>{t.village}</label>
                    <input value={editForm.village || ''} onChange={(e) => setEditForm({ ...editForm, village: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>{t.district}</label>
                    <input value={editForm.district || ''} onChange={(e) => setEditForm({ ...editForm, district: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>{t.state}</label>
                    <input value={editForm.state || ''} onChange={(e) => setEditForm({ ...editForm, state: e.target.value })} />
                  </div>
                </div>
                <div className="edit-actions">
                  <button className="submit-btn" onClick={handleSaveDetails}>💾 {t.save}</button>
                  <button className="cancel-btn" onClick={() => { setEditing(false); setEditForm(animal); }}>{t.cancel}</button>
                </div>
              </div>
            ) : (
              <div className="info-grid">
                <InfoItem label={t.speciesLabel} value={animal.species} />
                <InfoItem label={t.breedLabel} value={animal.breed} />
                <InfoItem label={t.genderLabel} value={animal.gender} />
                <InfoItem label={t.age} value={animal.age_months ? `${Math.floor(animal.age_months / 12)} years ${animal.age_months % 12} months` : undefined} />
                <InfoItem label={t.colorPattern} value={animal.color_pattern} />
                <InfoItem label={t.hornType} value={animal.horn_type} />
                <InfoItem label={t.identifiableMarks} value={animal.identifiable_marks} />
                <InfoItem label={t.village} value={animal.village} />
                <InfoItem label={t.district} value={animal.district} />
                <InfoItem label={t.state} value={animal.state} />
                {perms.canViewOwner && <InfoItem label={t.ownerId} value={animal.owner_id} />}
                <InfoItem label={t.enrolled} value={animal.enrolled_at ? new Date(animal.enrolled_at).toLocaleDateString('en-IN') : undefined} />
                {perms.canViewLocation && animal.latitude && (
                  <InfoItem label={t.gpsLocation} value={`${animal.latitude.toFixed(4)}, ${animal.longitude?.toFixed(4)}`} />
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'health' && perms.canViewHealth && (
          <div className="health-tab">
            {perms.canAddHealth && (
              <button
                onClick={() => setShowHealthForm(!showHealthForm)}
                className="add-record-btn"
              >
                {showHealthForm ? t.cancel : `+ ${t.addHealthRecord}`}
              </button>
            )}

            {showHealthForm && (
              <form onSubmit={handleAddHealthRecord} className="record-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>{t.type}</label>
                    <select
                      value={healthForm.record_type}
                      onChange={(e) => setHealthForm({ ...healthForm, record_type: e.target.value })}
                    >
                      <option value="vaccination">{t.vaccination}</option>
                      <option value="checkup">{t.checkup}</option>
                      <option value="treatment">{t.treatment}</option>
                      <option value="deworming">{t.deworming}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t.date}</label>
                    <input
                      type="date"
                      value={healthForm.record_date}
                      onChange={(e) => setHealthForm({ ...healthForm, record_date: e.target.value })}
                    />
                  </div>
                </div>
                {healthForm.record_type === 'vaccination' && (
                  <div className="form-group">
                    <label>{t.vaccine}</label>
                    <input
                      type="text"
                      value={healthForm.vaccine_type}
                      onChange={(e) => setHealthForm({ ...healthForm, vaccine_type: e.target.value })}
                      placeholder="e.g., FMD, HS-BQ"
                    />
                  </div>
                )}
                <div className="form-group">
                  <label>{t.notes}</label>
                  <textarea
                    value={healthForm.notes}
                    onChange={(e) => setHealthForm({ ...healthForm, notes: e.target.value })}
                    placeholder="Additional notes..."
                    rows={3}
                  />
                </div>
                <button type="submit" className="submit-btn">{t.saveRecord}</button>
              </form>
            )}

            {healthRecords.length === 0 ? (
              <div className="empty-records">{t.noHealthRecords}</div>
            ) : (
              <div className="records-list">
                {healthRecords.map((record) => (
                  <div key={record.record_id} className="record-card">
                    <div className="record-header">
                      <span className={`record-type type-${record.record_type}`}>
                        {record.record_type.toUpperCase()}
                      </span>
                      <span className="record-date">{record.record_date}</span>
                    </div>
                    {record.vaccine_type && (
                      <p className="record-detail"><strong>{t.vaccine}:</strong> {record.vaccine_type}</p>
                    )}
                    {record.administered_by && (
                      <p className="record-detail"><strong>{t.by}:</strong> {record.administered_by}</p>
                    )}
                    {record.notes && (
                      <p className="record-detail">{record.notes}</p>
                    )}
                    {record.next_due_date && (
                      <p className="record-due">{t.nextDue}: {record.next_due_date}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'milk' && perms.canViewMilk && (
          <div className="milk-tab tab-panel-anim">
            {perms.canAddMilk && (
              <button
                onClick={() => setShowMilkForm(!showMilkForm)}
                className="add-record-btn"
              >
                {showMilkForm ? t.cancel : `+ ${t.addMilkRecord}`}
              </button>
            )}

            {showMilkForm && (
              <form onSubmit={handleAddMilkYield} className="record-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>{t.date}</label>
                    <input
                      type="date"
                      value={milkForm.yield_date}
                      onChange={(e) => setMilkForm({ ...milkForm, yield_date: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>{t.morningYield}</label>
                    <input
                      type="number"
                      step="0.1"
                      value={milkForm.morning_yield}
                      onChange={(e) => setMilkForm({ ...milkForm, morning_yield: e.target.value })}
                      placeholder="0.0"
                    />
                  </div>
                  <div className="form-group">
                    <label>{t.eveningYield}</label>
                    <input
                      type="number"
                      step="0.1"
                      value={milkForm.evening_yield}
                      onChange={(e) => setMilkForm({ ...milkForm, evening_yield: e.target.value })}
                      placeholder="0.0"
                    />
                  </div>
                </div>
                <button type="submit" className="submit-btn">{t.saveYield}</button>
              </form>
            )}

            {milkYields.length === 0 ? (
              <div className="empty-records">{t.noMilkRecords}</div>
            ) : (
              <div className="milk-table-wrapper">
                <table className="milk-table">
                  <thead>
                    <tr>
                      <th>{t.date}</th>
                      <th>{t.morningL}</th>
                      <th>{t.eveningL}</th>
                      <th>{t.totalL}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {milkYields.map((y) => (
                      <tr key={y.yield_id}>
                        <td>{y.yield_date}</td>
                        <td>{y.morning_yield?.toFixed(1)}</td>
                        <td>{y.evening_yield?.toFixed(1)}</td>
                        <td className="total-yield">{y.total_yield?.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Insurance Tab */}
        {activeTab === 'insurance' && perms.canViewInsurance && (
          <div className="insurance-tab tab-panel-anim">
            {perms.canAddInsurance && (
              <button onClick={() => setShowInsuranceForm(!showInsuranceForm)} className="add-record-btn">
                {showInsuranceForm ? t.cancel : `+ ${t.addInsurance}`}
              </button>
            )}

            {showInsuranceForm && (
              <form onSubmit={handleAddInsurance} className="record-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>{t.provider}</label>
                    <input type="text" value={insuranceForm.provider} onChange={(e) => setInsuranceForm({ ...insuranceForm, provider: e.target.value })} placeholder="e.g., IFFCO Tokio" required />
                  </div>
                  <div className="form-group">
                    <label>{t.policyNumber}</label>
                    <input type="text" value={insuranceForm.policy_number} onChange={(e) => setInsuranceForm({ ...insuranceForm, policy_number: e.target.value })} placeholder="POL-XXXX" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>{t.coverageAmount} (₹)</label>
                    <input type="number" value={insuranceForm.coverage_amount} onChange={(e) => setInsuranceForm({ ...insuranceForm, coverage_amount: e.target.value })} placeholder="50000" required />
                  </div>
                  <div className="form-group">
                    <label>{t.premium} (₹)</label>
                    <input type="number" value={insuranceForm.premium} onChange={(e) => setInsuranceForm({ ...insuranceForm, premium: e.target.value })} placeholder="1200" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>{t.startDate}</label>
                    <input type="date" value={insuranceForm.start_date} onChange={(e) => setInsuranceForm({ ...insuranceForm, start_date: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>{t.endDate}</label>
                    <input type="date" value={insuranceForm.end_date} onChange={(e) => setInsuranceForm({ ...insuranceForm, end_date: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label>{t.notes}</label>
                  <textarea value={insuranceForm.notes} onChange={(e) => setInsuranceForm({ ...insuranceForm, notes: e.target.value })} placeholder="Additional notes..." rows={2} />
                </div>
                <button type="submit" className="submit-btn">{t.savePolicy}</button>
              </form>
            )}

            {insurancePolicies.length === 0 ? (
              <div className="empty-records">
                <p>🛡️ {t.noInsurancePolicies}</p>
                <p className="empty-hint">{t.addInsuranceHint}</p>
              </div>
            ) : (
              <div className="records-list">
                {insurancePolicies.map((pol) => (
                  <div key={pol.policy_id} className="record-card insurance-card">
                    <div className="record-header">
                      <span className="record-type type-insurance">{pol.status?.toUpperCase() || 'ACTIVE'}</span>
                      <span className="record-date">{pol.start_date}{pol.end_date ? ` → ${pol.end_date}` : ''}</span>
                    </div>
                    <div className="insurance-details">
                      <p className="record-detail"><strong>{t.provider}:</strong> {pol.provider}</p>
                      {pol.policy_number && <p className="record-detail"><strong>{t.policyHash}:</strong> {pol.policy_number}</p>}
                      <p className="record-detail"><strong>{t.coverage}:</strong> ₹{pol.coverage_amount?.toLocaleString('en-IN')}</p>
                      {pol.premium > 0 && <p className="record-detail"><strong>{t.premium}:</strong> ₹{pol.premium?.toLocaleString('en-IN')}/year</p>}
                    </div>
                    {pol.notes && <p className="record-detail note-text">{pol.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Loans Tab */}
        {activeTab === 'loans' && perms.canViewLoans && (
          <div className="loans-tab tab-panel-anim">
            {perms.canAddLoan && (
              <button onClick={() => setShowLoanForm(!showLoanForm)} className="add-record-btn">
                {showLoanForm ? t.cancel : `+ ${t.addLoan}`}
              </button>
            )}

            {showLoanForm && (
              <form onSubmit={handleAddLoan} className="record-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>{t.lenderBank}</label>
                    <input type="text" value={loanForm.lender} onChange={(e) => setLoanForm({ ...loanForm, lender: e.target.value })} placeholder="e.g., SBI, NABARD" required />
                  </div>
                  <div className="form-group">
                    <label>{t.loanAmount} (₹)</label>
                    <input type="number" value={loanForm.loan_amount} onChange={(e) => setLoanForm({ ...loanForm, loan_amount: e.target.value })} placeholder="100000" required />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>{t.interestRate}</label>
                    <input type="number" step="0.1" value={loanForm.interest_rate} onChange={(e) => setLoanForm({ ...loanForm, interest_rate: e.target.value })} placeholder="7.5" />
                  </div>
                  <div className="form-group">
                    <label>{t.tenureMonths}</label>
                    <input type="number" value={loanForm.tenure_months} onChange={(e) => setLoanForm({ ...loanForm, tenure_months: e.target.value })} placeholder="12" />
                  </div>
                </div>
                <div className="form-group">
                  <label>{t.disbursementDate}</label>
                  <input type="date" value={loanForm.disbursement_date} onChange={(e) => setLoanForm({ ...loanForm, disbursement_date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>{t.notes}</label>
                  <textarea value={loanForm.notes} onChange={(e) => setLoanForm({ ...loanForm, notes: e.target.value })} placeholder="Additional notes..." rows={2} />
                </div>
                <button type="submit" className="submit-btn">{t.saveLoan}</button>
              </form>
            )}

            {loanRecords.length === 0 ? (
              <div className="empty-records">
                <p>💰 {t.noLoanRecords}</p>
                <p className="empty-hint">{t.addLoanHint}</p>
              </div>
            ) : (
              <div className="records-list">
                {loanRecords.map((loan) => (
                  <div key={loan.loan_id} className="record-card loan-card">
                    <div className="record-header">
                      <span className={`record-type type-loan-${loan.repayment_status}`}>{loan.repayment_status?.toUpperCase() || 'ACTIVE'}</span>
                      <span className="record-date">{loan.disbursement_date}</span>
                    </div>
                    <div className="loan-details">
                      <p className="record-detail"><strong>{t.lender}:</strong> {loan.lender}</p>
                      <p className="record-detail"><strong>{t.amount}:</strong> ₹{loan.loan_amount?.toLocaleString('en-IN')}</p>
                      {loan.interest_rate > 0 && <p className="record-detail"><strong>{t.interest}:</strong> {loan.interest_rate}% p.a.</p>}
                      {loan.tenure_months > 0 && <p className="record-detail"><strong>{t.tenure}:</strong> {loan.tenure_months} months</p>}
                    </div>
                    {loan.notes && <p className="record-detail note-text">{loan.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value?: string }) {
  return (
    <div className="info-item">
      <span className="info-label">{label}</span>
      <span className="info-value">{value || 'N/A'} <SpeakButton text={`${label}: ${value || 'Not available'}`} /></span>
    </div>
  );
}
