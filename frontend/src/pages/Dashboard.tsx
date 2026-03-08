import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import LanguageSelector from '../components/LanguageSelector';
import {
  getAnimalsByOwner,
  getAccessibleAnimals,
  getIncomingAccessRequests,
  getMyAccessRequests,
  resolveAccessRequest,
  requestAccess,
} from '../services/api';
import { Animal, AccessRequest, ROLE_CONFIG, UserRole } from '../types';
import axios from 'axios';
import '../styles/Dashboard.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export default function Dashboard() {
  const { user, idToken, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [accessibleAnimals, setAccessibleAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchId, setSearchId] = useState('');
  const [searchResult, setSearchResult] = useState<Animal | null>(null);
  const [searchError, setSearchError] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);

  // Access requests
  const [incomingRequests, setIncomingRequests] = useState<AccessRequest[]>([]);
  const [myRequests, setMyRequests] = useState<AccessRequest[]>([]);
  const [accessRequestId, setAccessRequestId] = useState('');
  const [accessReason, setAccessReason] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestMsg, setRequestMsg] = useState('');

  // Dashboard tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'requests' | 'search'>('overview');

  const role = user?.role as UserRole;
  const roleConfig = role ? ROLE_CONFIG[role] : null;
  const isFarmer = role === 'farmer';
  const isAgent = role === 'enrollment_agent';
  const isVetOrInsurer = role === 'veterinarian' || role === 'insurer';
  const isGovOrAdmin = role === 'government' || role === 'admin';
  const rolePrefix = roleConfig?.prefix || 'USR';
  const displayId = user?.ownerId
    ? `${rolePrefix}-${user.ownerId.slice(-7).toUpperCase()}`
    : `${rolePrefix}-${user?.userId.slice(-7).toUpperCase()}`;

  useEffect(() => {
    loadDashboardData();
  }, [user, idToken]);

  const loadDashboardData = async () => {
    if (!idToken) return;
    try {
      setLoading(true);
      // Farmer: load own animals + incoming access requests
      if (isFarmer && user?.ownerId) {
        const [animalList, incoming] = await Promise.all([
          getAnimalsByOwner(user.ownerId, idToken),
          getIncomingAccessRequests(idToken).catch(() => []),
        ]);
        setAnimals(animalList);
        setIncomingRequests(incoming);
      }
      // Vet/Insurer: load accessible animals + my requests
      else if (isVetOrInsurer) {
        const [accessible, requests] = await Promise.all([
          getAccessibleAnimals(idToken).catch(() => []),
          getMyAccessRequests(idToken).catch(() => []),
        ]);
        setAccessibleAnimals(accessible);
        setMyRequests(requests);
      }
      // Gov/Admin: no pre-load, can search any
    } catch {
      setError(t.failedToLoadDashboard);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchId.trim()) return;

    setSearchLoading(true);
    setSearchError('');
    setSearchResult(null);

    try {
      const response = await axios.get(`${API_BASE_URL}/animals/${searchId.trim()}`, {
        headers: { Authorization: idToken || '' },
      });
      setSearchResult(response.data.animal);
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setSearchError(t.animalNotFound);
      } else {
        setSearchError(t.searchFailed);
      }
    } finally {
      setSearchLoading(false);
    }
  };

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessRequestId.trim()) return;
    setRequestLoading(true);
    setRequestMsg('');
    try {
      await requestAccess(accessRequestId.trim(), accessReason, idToken!);
      setRequestMsg('✅ Access request sent to the owner!');
      setAccessRequestId('');
      setAccessReason('');
      // Refresh
      const requests = await getMyAccessRequests(idToken!).catch(() => []);
      setMyRequests(requests);
    } catch {
      setRequestMsg('❌ Failed to send request. Check the Livestock ID.');
    } finally {
      setRequestLoading(false);
    }
  };

  const handleResolve = async (reqId: string, action: 'approve' | 'deny') => {
    try {
      await resolveAccessRequest(reqId, action, idToken!);
      setIncomingRequests((prev) => prev.filter((r) => r.request_id !== reqId));
    } catch {
      alert('Failed to resolve request');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const pendingCount = incomingRequests.filter(r => r.status === 'pending').length;

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <Link to="/" className="header-home-btn" title={t.home}>🏠</Link>
          <Link to="/dashboard" className="header-brand">🐄 {t.appNameHindi}</Link>
        </div>
        <div className="header-right">
          <LanguageSelector compact />
          <div className="user-info">
            <span className="user-name">{user?.name || 'User'}</span>
            <span className="user-display-id">{displayId}</span>
            <span className="role-badge" style={{ backgroundColor: roleConfig?.color }}>
              {roleConfig?.icon} {role?.toUpperCase()}
            </span>
          </div>
          <Link to="/profile" className="profile-link">👤 {t.profile}</Link>
          <button onClick={handleLogout} className="logout-btn">{t.signOut}</button>
        </div>
      </header>

      {/* Dashboard Tabs */}
      <div className="dashboard-tabs">
        <button className={`dash-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          📊 {t.overview}
        </button>
        <button className={`dash-tab ${activeTab === 'requests' ? 'active' : ''}`} onClick={() => setActiveTab('requests')}>
          📩 {t.requests}
          {pendingCount > 0 && <span className="tab-badge">{pendingCount}</span>}
        </button>
        <button className={`dash-tab ${activeTab === 'search' ? 'active' : ''}`} onClick={() => setActiveTab('search')}>
          🔍 {t.search}
        </button>
      </div>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* ─── Overview Tab ─── */}
        {activeTab === 'overview' && (
          <div className="tab-panel fade-in">
            {/* Role-Specific Summary Stats */}
            <section className="dash-summary-stats">
              <div className="summary-header">
                <h2>📊 {t.overview}</h2>
                <button onClick={loadDashboardData} className="refresh-btn-inline" title={t.refresh}>🔄 {t.refresh}</button>
              </div>
              <div className="summary-cards">
                {isFarmer && (
                  <>
                    <div className="summary-card">
                      <span className="summary-icon">🐮</span>
                      <div><span className="summary-value">{animals.length}</span><span className="summary-label">My Cattle</span></div>
                    </div>
                    <div className="summary-card">
                      <span className="summary-icon">📩</span>
                      <div><span className="summary-value">{pendingCount}</span><span className="summary-label">Pending Requests</span></div>
                    </div>
                    <div className="summary-card">
                      <span className="summary-icon">✅</span>
                      <div><span className="summary-value">{incomingRequests.filter(r => r.status === 'approved').length}</span><span className="summary-label">Approved Access</span></div>
                    </div>
                  </>
                )}
                {isVetOrInsurer && (
                  <>
                    <div className="summary-card">
                      <span className="summary-icon">🐮</span>
                      <div><span className="summary-value">{accessibleAnimals.length}</span><span className="summary-label">Accessible Animals</span></div>
                    </div>
                    <div className="summary-card">
                      <span className="summary-icon">📋</span>
                      <div><span className="summary-value">{myRequests.length}</span><span className="summary-label">My Requests</span></div>
                    </div>
                    <div className="summary-card">
                      <span className="summary-icon">✅</span>
                      <div><span className="summary-value">{myRequests.filter(r => r.status === 'approved').length}</span><span className="summary-label">Approved</span></div>
                    </div>
                  </>
                )}
                {isAgent && (
                  <>
                    <div className="summary-card">
                      <span className="summary-icon">📋</span>
                      <div><span className="summary-value">—</span><span className="summary-label">Enrollment Sessions</span></div>
                    </div>
                    <div className="summary-card">
                      <span className="summary-icon">✅</span>
                      <div><span className="summary-value">—</span><span className="summary-label">Completed</span></div>
                    </div>
                  </>
                )}
                {isGovOrAdmin && (
                  <>
                    <div className="summary-card">
                      <span className="summary-icon">🐄</span>
                      <div><span className="summary-value">—</span><span className="summary-label">Total Animals</span></div>
                    </div>
                    <div className="summary-card">
                      <span className="summary-icon">🧑‍🌾</span>
                      <div><span className="summary-value">—</span><span className="summary-label">Total Farmers</span></div>
                    </div>
                    <div className="summary-card">
                      <span className="summary-icon">🗺️</span>
                      <div>
                        <Link to="/gov-dashboard" className="summary-link">View Analytics →</Link>
                        <span className="summary-label">Full Dashboard</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* Quick Actions */}
            <section className="quick-actions">
              {isFarmer && (
                <Link to="/enroll" className="action-card enroll-action">
                  <span className="action-icon">📸</span>
                  <span className="action-label">{t.enrollNewAnimal}</span>
                </Link>
              )}
              {isAgent && (
                <Link to="/enroll" className="action-card enroll-action">
                  <span className="action-icon">📋</span>
                  <span className="action-label">Enrollment Assignments</span>
                </Link>
              )}
              <Link to="/profile" className="action-card profile-action">
                <span className="action-icon">👤</span>
                <span className="action-label">{t.myProfile}</span>
              </Link>
              {isGovOrAdmin && (
                <Link to="/gov-dashboard" className="action-card enroll-action" style={{ background: 'linear-gradient(135deg, #1a237e, #283593)' }}>
                  <span className="action-icon">🗺️</span>
                  <span className="action-label">Analytics Dashboard</span>
                </Link>
              )}
            </section>

            {/* Farmer's Animals */}
            {isFarmer && (
              <section className="animals-section">
                <div className="section-title-row">
                  <h2>🐮 {t.myAnimals}</h2>
                  <button onClick={loadDashboardData} className="refresh-btn-inline small" title={t.refresh}>🔄</button>
                </div>
                {loading ? (
                  <div className="loading-state"><div className="loading-spinner" /><p>{t.loadingAnimals}</p></div>
                ) : error ? (
                  <div className="error-state">{error}</div>
                ) : animals.length === 0 ? (
                  <div className="empty-state"><p>{t.noAnimalsYet}</p><Link to="/enroll" className="enroll-link">{t.enrollFirst}</Link></div>
                ) : (
                  <div className="animals-grid">
                    {animals.map((animal) => (
                      <Link key={animal.livestock_id} to={`/animals/${animal.livestock_id}`} className="animal-card">
                        {animal.photo_url && (
                          <div className="animal-card-photo">
                            <img src={animal.photo_url} alt={animal.species || 'Animal'} />
                          </div>
                        )}
                        <div className="animal-card-header">
                          <span className="animal-id">{animal.livestock_id}</span>
                          <span className="animal-species">{animal.species || '🐄'}</span>
                        </div>
                        <div className="animal-card-body">
                          <p><strong>{t.breed}:</strong> {animal.breed || t.unknown}</p>
                          <p><strong>{t.gender}:</strong> {animal.gender || t.unknown}</p>
                          {animal.age_months && (
                            <p><strong>{t.age}:</strong> {Math.floor(animal.age_months / 12)}y {animal.age_months % 12}m</p>
                          )}
                          <p><strong>{t.location}:</strong> {animal.village || t.unknown}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Vet/Insurer: Accessible Animals */}
            {isVetOrInsurer && accessibleAnimals.length > 0 && (
              <section className="accessible-animals">
                <div className="section-title-row">
                  <h3>🐮 {t.animalsICanAccess}</h3>
                  <button onClick={loadDashboardData} className="refresh-btn-inline small" title={t.refresh}>🔄</button>
                </div>
                <div className="animals-grid">
                  {accessibleAnimals.map((animal) => (
                    <Link key={animal.livestock_id} to={`/animals/${animal.livestock_id}`} className="animal-card">
                      <div className="animal-card-header">
                        <span className="animal-id">{animal.livestock_id}</span>
                        <span className="animal-species">{animal.species || '🐄'}</span>
                      </div>
                      <div className="animal-card-body">
                        <p><strong>{t.breed}:</strong> {animal.breed || t.unknown}</p>
                        <p><strong>{t.owner}:</strong> {animal.owner_id || t.unknown}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ─── Requests Tab ─── */}
        {activeTab === 'requests' && (
          <div className="tab-panel fade-in">
            {/* Vet/Insurer: Request Access Form */}
            {isVetOrInsurer && (
              <section className="access-request-section">
                <h2>🔐 {t.requestAnimalAccess}</h2>
                <p className="section-note">{t.requestAccessDesc}</p>
                <form onSubmit={handleRequestAccess} className="access-request-form">
                  <input type="text" value={accessRequestId} onChange={(e) => setAccessRequestId(e.target.value)} placeholder={t.livestockId} className="search-input" required />
                  <input type="text" value={accessReason} onChange={(e) => setAccessReason(e.target.value)} placeholder={t.reasonForAccess} className="search-input" />
                  <button type="submit" className="search-btn" disabled={requestLoading}>{requestLoading ? t.sendingRequest : t.requestAccess}</button>
                </form>
                {requestMsg && <div className="request-message">{requestMsg}</div>}

                {myRequests.length > 0 && (
                  <div className="requests-list">
                    <h3>{t.myRequests}</h3>
                    {myRequests.map((req) => (
                      <div key={req.request_id} className={`request-card status-${req.status}`}>
                        <div className="request-info">
                          <span className="request-livestock">{req.livestock_id}</span>
                          <span className={`request-status badge-${req.status}`}>{req.status.toUpperCase()}</span>
                        </div>
                        {req.reason && <p className="request-reason">{req.reason}</p>}
                        <span className="request-date">{new Date(req.created_at).toLocaleDateString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Farmer: Incoming Access Requests */}
            {isFarmer && (
              <section className="incoming-requests-section">
                <h2>📩 {t.incomingAccessRequests} {pendingCount > 0 && <span className="header-badge">{pendingCount} {t.pending}</span>}</h2>
                {incomingRequests.length === 0 ? (
                  <div className="empty-state"><p>{t.noAccessRequests}</p></div>
                ) : (
                  <div className="requests-list">
                    {incomingRequests.map((req) => (
                      <div key={req.request_id} className={`request-card incoming status-${req.status}`}>
                        <div className="request-info">
                          <span className="request-requester">{req.requester_name || 'Unknown'} ({req.requester_role})</span>
                          <span className="request-livestock">for {req.livestock_id}</span>
                          <span className={`request-status badge-${req.status}`}>{req.status.toUpperCase()}</span>
                        </div>
                        {req.reason && <p className="request-reason">"{req.reason}"</p>}
                        {req.status === 'pending' && (
                          <div className="request-actions">
                            <button className="approve-btn" onClick={() => handleResolve(req.request_id, 'approve')}>✅ {t.approve}</button>
                            <button className="deny-btn" onClick={() => handleResolve(req.request_id, 'deny')}>❌ {t.deny}</button>
                          </div>
                        )}
                        <span className="request-date">{new Date(req.created_at).toLocaleDateString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Gov/Admin: no requests section */}
            {isGovOrAdmin && (
              <div className="empty-state"><p>{t.useSearchTab}</p></div>
            )}
          </div>
        )}

        {/* ─── Search Tab ─── */}
        {activeTab === 'search' && (
          <div className="tab-panel fade-in">
            <section className="search-section">
              <h2>🔍 {isGovOrAdmin ? t.searchAnyAnimal : t.lookUpAnimal}</h2>
              <form onSubmit={handleSearch} className="search-form">
                <input type="text" value={searchId} onChange={(e) => setSearchId(e.target.value)} placeholder={t.enterLivestockId} className="search-input" />
                <button type="submit" className="search-btn" disabled={searchLoading}>{searchLoading ? t.searching : t.search}</button>
              </form>

              {searchError && <div className="search-error">{searchError}</div>}

              {searchResult && (
                <div className="search-result-card">
                  <h3>✅ {t.animalFound}</h3>
                  <div className="animal-details-grid">
                    <div className="detail-item"><span className="detail-label">{t.livestockId}</span><span className="detail-value id-value">{searchResult.livestock_id}</span></div>
                    <div className="detail-item"><span className="detail-label">{t.species}</span><span className="detail-value">{searchResult.species || 'N/A'}</span></div>
                    <div className="detail-item"><span className="detail-label">{t.breed}</span><span className="detail-value">{searchResult.breed || 'N/A'}</span></div>
                    <div className="detail-item"><span className="detail-label">{t.gender}</span><span className="detail-value">{searchResult.gender || 'N/A'}</span></div>
                  </div>
                  <Link to={`/animals/${searchResult.livestock_id}`} className="view-details-btn">{t.viewFullDetails}</Link>
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
