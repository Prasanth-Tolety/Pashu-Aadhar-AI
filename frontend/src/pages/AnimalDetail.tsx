import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_CONFIG, UserRole } from '../types';
import axios from 'axios';
import '../styles/AnimalDetail.css';

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
  latitude?: number;
  longitude?: number;
  status?: string;
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

// Role-based permissions config
const ROLE_PERMISSIONS: Record<UserRole, {
  canViewDetails: boolean;
  canViewHealth: boolean;
  canViewMilk: boolean;
  canEditDetails: boolean;
  canAddHealth: boolean;
  canAddMilk: boolean;
  canViewLocation: boolean;
  canViewOwner: boolean;
}> = {
  farmer: {
    canViewDetails: true, canViewHealth: true, canViewMilk: true,
    canEditDetails: true, canAddHealth: true, canAddMilk: true,
    canViewLocation: true, canViewOwner: true,
  },
  veterinarian: {
    canViewDetails: true, canViewHealth: true, canViewMilk: false,
    canEditDetails: false, canAddHealth: true, canAddMilk: false,
    canViewLocation: false, canViewOwner: false,
  },
  insurer: {
    canViewDetails: true, canViewHealth: true, canViewMilk: false,
    canEditDetails: false, canAddHealth: false, canAddMilk: false,
    canViewLocation: false, canViewOwner: false,
  },
  government: {
    canViewDetails: true, canViewHealth: true, canViewMilk: true,
    canEditDetails: false, canAddHealth: false, canAddMilk: false,
    canViewLocation: true, canViewOwner: true,
  },
  admin: {
    canViewDetails: true, canViewHealth: true, canViewMilk: true,
    canEditDetails: true, canAddHealth: true, canAddMilk: true,
    canViewLocation: true, canViewOwner: true,
  },
};

export default function AnimalDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, idToken } = useAuth();
  const navigate = useNavigate();

  const role = (user?.role || 'farmer') as UserRole;
  const perms = ROLE_PERMISSIONS[role];
  const roleConfig = ROLE_CONFIG[role];

  const [animal, setAnimal] = useState<Animal | null>(null);
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [milkYields, setMilkYields] = useState<MilkYield[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'health' | 'milk'>('details');

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

  const headers = { Authorization: idToken || '' };

  useEffect(() => {
    if (id) fetchAnimalData();
  }, [id]);

  const fetchAnimalData = async () => {
    try {
      setLoading(true);
      const [animalRes, healthRes, milkRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/animals/${id}`, { headers }),
        axios.get(`${API_BASE_URL}/animals/${id}/health`, { headers }).catch(() => ({ data: { records: [] } })),
        axios.get(`${API_BASE_URL}/animals/${id}/milk`, { headers }).catch(() => ({ data: { yields: [] } })),
      ]);

      setAnimal(animalRes.data.animal);
      setEditForm(animalRes.data.animal || {});
      setHealthRecords(healthRes.data.records || []);
      setMilkYields(milkRes.data.yields || []);
    } catch {
      setError('Failed to load animal data');
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
      alert('Failed to update animal details');
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
      alert('Failed to add health record');
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
      alert('Failed to add milk yield');
    }
  };

  if (loading) {
    return (
      <div className="detail-container">
        <div className="loading-state">
          <div className="loading-spinner" />
          <p>Loading animal data...</p>
        </div>
      </div>
    );
  }

  if (error || !animal) {
    return (
      <div className="detail-container">
        <div className="error-state">
          <p>{error || 'Animal not found'}</p>
          <button onClick={() => navigate('/dashboard')} className="back-btn">← Back to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="detail-container">
      {/* Header */}
      <header className="detail-header">
        <Link to="/dashboard" className="back-link">← Dashboard</Link>
        <h1>Animal Profile</h1>
        <span className="role-chip" style={{ background: roleConfig.color + '22', color: roleConfig.color }}>
          {roleConfig.icon} {roleConfig.label}
        </span>
      </header>

      {/* Animal ID Banner */}
      <div className="id-banner" style={{ background: roleConfig.gradient }}>
        <span className="id-label">Livestock ID</span>
        <span className="id-value-large">{animal.livestock_id}</span>
        {animal.status && (
          <span className={`animal-status status-${animal.status}`}>{animal.status}</span>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs">
        {perms.canViewDetails && (
          <button
            className={`tab ${activeTab === 'details' ? 'active' : ''}`}
            onClick={() => setActiveTab('details')}
          >
            📋 Details
          </button>
        )}
        {perms.canViewHealth && (
          <button
            className={`tab ${activeTab === 'health' ? 'active' : ''}`}
            onClick={() => setActiveTab('health')}
          >
            💉 Health ({healthRecords.length})
          </button>
        )}
        {perms.canViewMilk && (
          <button
            className={`tab ${activeTab === 'milk' ? 'active' : ''}`}
            onClick={() => setActiveTab('milk')}
          >
            🥛 Milk ({milkYields.length})
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'details' && perms.canViewDetails && (
          <div className="details-tab">
            {perms.canEditDetails && !editing && (
              <button className="edit-details-btn" onClick={() => setEditing(true)}>✏️ Edit Details</button>
            )}
            {editing ? (
              <div className="edit-details-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Species</label>
                    <select value={editForm.species || ''} onChange={(e) => setEditForm({ ...editForm, species: e.target.value })}>
                      <option value="cattle">Cattle</option>
                      <option value="buffalo">Buffalo</option>
                      <option value="goat">Goat</option>
                      <option value="sheep">Sheep</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Breed</label>
                    <input value={editForm.breed || ''} onChange={(e) => setEditForm({ ...editForm, breed: e.target.value })} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Gender</label>
                    <select value={editForm.gender || ''} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}>
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Age (months)</label>
                    <input type="number" value={editForm.age_months || ''} onChange={(e) => setEditForm({ ...editForm, age_months: parseInt(e.target.value) || 0 })} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Color/Pattern</label>
                    <input value={editForm.color_pattern || ''} onChange={(e) => setEditForm({ ...editForm, color_pattern: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Horn Type</label>
                    <input value={editForm.horn_type || ''} onChange={(e) => setEditForm({ ...editForm, horn_type: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Identifiable Marks</label>
                  <textarea value={editForm.identifiable_marks || ''} onChange={(e) => setEditForm({ ...editForm, identifiable_marks: e.target.value })} rows={2} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Village</label>
                    <input value={editForm.village || ''} onChange={(e) => setEditForm({ ...editForm, village: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>District</label>
                    <input value={editForm.district || ''} onChange={(e) => setEditForm({ ...editForm, district: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>State</label>
                    <input value={editForm.state || ''} onChange={(e) => setEditForm({ ...editForm, state: e.target.value })} />
                  </div>
                </div>
                <div className="edit-actions">
                  <button className="submit-btn" onClick={handleSaveDetails}>💾 Save</button>
                  <button className="cancel-btn" onClick={() => { setEditing(false); setEditForm(animal); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="info-grid">
                <InfoItem label="Species" value={animal.species} />
                <InfoItem label="Breed" value={animal.breed} />
                <InfoItem label="Gender" value={animal.gender} />
                <InfoItem label="Age" value={animal.age_months ? `${Math.floor(animal.age_months / 12)} years ${animal.age_months % 12} months` : undefined} />
                <InfoItem label="Color/Pattern" value={animal.color_pattern} />
                <InfoItem label="Horn Type" value={animal.horn_type} />
                <InfoItem label="Identifiable Marks" value={animal.identifiable_marks} />
                <InfoItem label="Village" value={animal.village} />
                <InfoItem label="District" value={animal.district} />
                <InfoItem label="State" value={animal.state} />
                {perms.canViewOwner && <InfoItem label="Owner ID" value={animal.owner_id} />}
                <InfoItem label="Enrolled" value={animal.enrolled_at ? new Date(animal.enrolled_at).toLocaleDateString('en-IN') : undefined} />
                {perms.canViewLocation && animal.latitude && (
                  <InfoItem label="GPS Location" value={`${animal.latitude.toFixed(4)}, ${animal.longitude?.toFixed(4)}`} />
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
                {showHealthForm ? 'Cancel' : '+ Add Health Record'}
              </button>
            )}

            {showHealthForm && (
              <form onSubmit={handleAddHealthRecord} className="record-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Type</label>
                    <select
                      value={healthForm.record_type}
                      onChange={(e) => setHealthForm({ ...healthForm, record_type: e.target.value })}
                    >
                      <option value="vaccination">Vaccination</option>
                      <option value="checkup">Checkup</option>
                      <option value="treatment">Treatment</option>
                      <option value="deworming">Deworming</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Date</label>
                    <input
                      type="date"
                      value={healthForm.record_date}
                      onChange={(e) => setHealthForm({ ...healthForm, record_date: e.target.value })}
                    />
                  </div>
                </div>
                {healthForm.record_type === 'vaccination' && (
                  <div className="form-group">
                    <label>Vaccine</label>
                    <input
                      type="text"
                      value={healthForm.vaccine_type}
                      onChange={(e) => setHealthForm({ ...healthForm, vaccine_type: e.target.value })}
                      placeholder="e.g., FMD, HS-BQ"
                    />
                  </div>
                )}
                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    value={healthForm.notes}
                    onChange={(e) => setHealthForm({ ...healthForm, notes: e.target.value })}
                    placeholder="Additional notes..."
                    rows={3}
                  />
                </div>
                <button type="submit" className="submit-btn">Save Record</button>
              </form>
            )}

            {healthRecords.length === 0 ? (
              <div className="empty-records">No health records yet</div>
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
                      <p className="record-detail"><strong>Vaccine:</strong> {record.vaccine_type}</p>
                    )}
                    {record.administered_by && (
                      <p className="record-detail"><strong>By:</strong> {record.administered_by}</p>
                    )}
                    {record.notes && (
                      <p className="record-detail">{record.notes}</p>
                    )}
                    {record.next_due_date && (
                      <p className="record-due">Next due: {record.next_due_date}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'milk' && perms.canViewMilk && (
          <div className="milk-tab">
            {perms.canAddMilk && (
              <button
                onClick={() => setShowMilkForm(!showMilkForm)}
                className="add-record-btn"
              >
                {showMilkForm ? 'Cancel' : '+ Add Milk Yield'}
              </button>
            )}

            {showMilkForm && (
              <form onSubmit={handleAddMilkYield} className="record-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Date</label>
                    <input
                      type="date"
                      value={milkForm.yield_date}
                      onChange={(e) => setMilkForm({ ...milkForm, yield_date: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Morning (litres)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={milkForm.morning_yield}
                      onChange={(e) => setMilkForm({ ...milkForm, morning_yield: e.target.value })}
                      placeholder="0.0"
                    />
                  </div>
                  <div className="form-group">
                    <label>Evening (litres)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={milkForm.evening_yield}
                      onChange={(e) => setMilkForm({ ...milkForm, evening_yield: e.target.value })}
                      placeholder="0.0"
                    />
                  </div>
                </div>
                <button type="submit" className="submit-btn">Save Yield</button>
              </form>
            )}

            {milkYields.length === 0 ? (
              <div className="empty-records">No milk yield records yet</div>
            ) : (
              <div className="milk-table-wrapper">
                <table className="milk-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Morning (L)</th>
                      <th>Evening (L)</th>
                      <th>Total (L)</th>
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
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value?: string }) {
  return (
    <div className="info-item">
      <span className="info-label">{label}</span>
      <span className="info-value">{value || 'N/A'}</span>
    </div>
  );
}
