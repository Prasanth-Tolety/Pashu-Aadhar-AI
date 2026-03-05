import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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

  const role = user?.role as UserRole;
  const roleConfig = role ? ROLE_CONFIG[role] : null;
  const isFarmer = role === 'farmer';
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
      setError('Failed to load dashboard data');
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
        setSearchError('Animal not found. Check the Livestock ID.');
      } else {
        setSearchError('Search failed. Please try again.');
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

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <Link to="/" className="header-brand">🐄 पशु आधार</Link>
        </div>
        <div className="header-right">
          <div className="user-info">
            <span className="user-name">{user?.name || 'User'}</span>
            <span className="user-display-id">{displayId}</span>
            <span className="role-badge" style={{ backgroundColor: roleConfig?.color }}>
              {roleConfig?.icon} {role?.toUpperCase()}
            </span>
          </div>
          <Link to="/profile" className="profile-link">👤 Profile</Link>
          <button onClick={handleLogout} className="logout-btn">Sign Out</button>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Quick Actions */}
        <section className="quick-actions">
          {isFarmer && (
            <Link to="/enroll" className="action-card enroll-action">
              <span className="action-icon">📸</span>
              <span className="action-label">Enroll New Animal</span>
            </Link>
          )}
          <Link to="/profile" className="action-card profile-action">
            <span className="action-icon">👤</span>
            <span className="action-label">My Profile</span>
          </Link>
          {isFarmer && (
            <button onClick={loadDashboardData} className="action-card refresh-action">
              <span className="action-icon">🔄</span>
              <span className="action-label">Refresh</span>
            </button>
          )}
        </section>

        {/* Search (visible to all) */}
        <section className="search-section">
          <h2>🔍 {isGovOrAdmin ? 'Search Any Animal' : 'Look Up Animal'}</h2>
          <form onSubmit={handleSearch} className="search-form">
            <input
              type="text"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              placeholder="Enter Livestock ID (e.g., PA-MMCEI8EW-2DEKAM)"
              className="search-input"
            />
            <button type="submit" className="search-btn" disabled={searchLoading}>
              {searchLoading ? 'Searching...' : 'Search'}
            </button>
          </form>

          {searchError && <div className="search-error">{searchError}</div>}

          {searchResult && (
            <div className="search-result-card">
              <h3>✅ Animal Found</h3>
              <div className="animal-details-grid">
                <div className="detail-item">
                  <span className="detail-label">Livestock ID</span>
                  <span className="detail-value id-value">{searchResult.livestock_id}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Species</span>
                  <span className="detail-value">{searchResult.species || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Breed</span>
                  <span className="detail-value">{searchResult.breed || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Gender</span>
                  <span className="detail-value">{searchResult.gender || 'N/A'}</span>
                </div>
              </div>
              <Link to={`/animals/${searchResult.livestock_id}`} className="view-details-btn">
                View Full Details →
              </Link>
            </div>
          )}
        </section>

        {/* Vet/Insurer: Access Request Form */}
        {isVetOrInsurer && (
          <section className="access-request-section">
            <h2>🔐 Request Animal Access</h2>
            <p className="section-note">Request access from an animal owner to view their livestock data</p>
            <form onSubmit={handleRequestAccess} className="access-request-form">
              <input
                type="text"
                value={accessRequestId}
                onChange={(e) => setAccessRequestId(e.target.value)}
                placeholder="Livestock ID"
                className="search-input"
                required
              />
              <input
                type="text"
                value={accessReason}
                onChange={(e) => setAccessReason(e.target.value)}
                placeholder="Reason for access (e.g., health checkup)"
                className="search-input"
              />
              <button type="submit" className="search-btn" disabled={requestLoading}>
                {requestLoading ? 'Sending...' : 'Request Access'}
              </button>
            </form>
            {requestMsg && <div className="request-message">{requestMsg}</div>}

            {/* My Requests */}
            {myRequests.length > 0 && (
              <div className="requests-list">
                <h3>My Requests</h3>
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

            {/* Accessible Animals */}
            {accessibleAnimals.length > 0 && (
              <div className="accessible-animals">
                <h3>🐮 Animals I Can Access</h3>
                <div className="animals-grid">
                  {accessibleAnimals.map((animal) => (
                    <Link key={animal.livestock_id} to={`/animals/${animal.livestock_id}`} className="animal-card">
                      <div className="animal-card-header">
                        <span className="animal-id">{animal.livestock_id}</span>
                        <span className="animal-species">{animal.species || '🐄'}</span>
                      </div>
                      <div className="animal-card-body">
                        <p><strong>Breed:</strong> {animal.breed || 'Unknown'}</p>
                        <p><strong>Owner:</strong> {animal.owner_id || 'Unknown'}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Farmer: Incoming Access Requests */}
        {isFarmer && incomingRequests.length > 0 && (
          <section className="incoming-requests-section">
            <h2>📩 Access Requests ({incomingRequests.length})</h2>
            <div className="requests-list">
              {incomingRequests.map((req) => (
                <div key={req.request_id} className="request-card incoming">
                  <div className="request-info">
                    <span className="request-requester">
                      {req.requester_name || 'Unknown'} ({req.requester_role})
                    </span>
                    <span className="request-livestock">for {req.livestock_id}</span>
                  </div>
                  {req.reason && <p className="request-reason">"{req.reason}"</p>}
                  <div className="request-actions">
                    <button
                      className="approve-btn"
                      onClick={() => handleResolve(req.request_id, 'approve')}
                    >
                      ✅ Approve
                    </button>
                    <button
                      className="deny-btn"
                      onClick={() => handleResolve(req.request_id, 'deny')}
                    >
                      ❌ Deny
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Farmer's Animals List */}
        {isFarmer && (
          <section className="animals-section">
            <h2>🐮 My Animals</h2>
            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner" />
                <p>Loading your animals...</p>
              </div>
            ) : error ? (
              <div className="error-state">{error}</div>
            ) : animals.length === 0 ? (
              <div className="empty-state">
                <p>No animals enrolled yet.</p>
                <Link to="/enroll" className="enroll-link">Enroll your first animal →</Link>
              </div>
            ) : (
              <div className="animals-grid">
                {animals.map((animal) => (
                  <Link key={animal.livestock_id} to={`/animals/${animal.livestock_id}`} className="animal-card">
                    <div className="animal-card-header">
                      <span className="animal-id">{animal.livestock_id}</span>
                      <span className="animal-species">{animal.species || '🐄'}</span>
                    </div>
                    <div className="animal-card-body">
                      <p><strong>Breed:</strong> {animal.breed || 'Unknown'}</p>
                      <p><strong>Gender:</strong> {animal.gender || 'Unknown'}</p>
                      {animal.age_months && (
                        <p><strong>Age:</strong> {Math.floor(animal.age_months / 12)}y {animal.age_months % 12}m</p>
                      )}
                      <p><strong>Location:</strong> {animal.village || 'Unknown'}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
