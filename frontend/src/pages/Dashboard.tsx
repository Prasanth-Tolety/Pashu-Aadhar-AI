import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import '../styles/Dashboard.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

interface Animal {
  livestock_id: string;
  species?: string;
  breed?: string;
  gender?: string;
  age_months?: number;
  color_pattern?: string;
  village?: string;
  district?: string;
  state?: string;
  owner_id?: string;
  enrolled_at?: string;
  image_key?: string;
}

export default function Dashboard() {
  const { user, idToken, logout } = useAuth();
  const navigate = useNavigate();
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchId, setSearchId] = useState('');
  const [searchResult, setSearchResult] = useState<Animal | null>(null);
  const [searchError, setSearchError] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);

  const isFarmer = user?.role === 'farmer';
  const isVet = user?.role === 'veterinarian';

  useEffect(() => {
    if (isFarmer && user?.ownerId) {
      fetchMyAnimals();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchMyAnimals = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/animals`, {
        params: { owner_id: user?.ownerId },
        headers: { Authorization: idToken || '' },
      });
      setAnimals(response.data.animals || []);
    } catch (err) {
      setError('Failed to load your animals');
      console.error(err);
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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      farmer: '#4caf50',
      veterinarian: '#2196f3',
      insurer: '#ff9800',
      government: '#9c27b0',
      admin: '#f44336',
    };
    return colors[role] || '#666';
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <h1>🐄 पशु आधार</h1>
        </div>
        <div className="header-right">
          <div className="user-info">
            <span className="user-name">{user?.name || 'User'}</span>
            <span
              className="role-badge"
              style={{ backgroundColor: getRoleBadgeColor(user?.role || '') }}
            >
              {user?.role?.toUpperCase()}
            </span>
          </div>
          <button onClick={handleLogout} className="logout-btn">Sign Out</button>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Quick Actions */}
        <section className="quick-actions">
          <Link to="/enroll" className="action-card enroll-action">
            <span className="action-icon">📸</span>
            <span className="action-label">Enroll New Animal</span>
          </Link>
          {isFarmer && (
            <button onClick={fetchMyAnimals} className="action-card refresh-action">
              <span className="action-icon">🔄</span>
              <span className="action-label">Refresh My Animals</span>
            </button>
          )}
        </section>

        {/* Search Section (available for all roles but primary for vets) */}
        <section className="search-section">
          <h2>{isVet ? '🔍 Search Animal by ID' : '🔍 Look Up Animal'}</h2>
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
                <div className="detail-item">
                  <span className="detail-label">Village</span>
                  <span className="detail-value">{searchResult.village || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">District</span>
                  <span className="detail-value">{searchResult.district || 'N/A'}</span>
                </div>
              </div>
              <Link to={`/animals/${searchResult.livestock_id}`} className="view-details-btn">
                View Full Details →
              </Link>
            </div>
          )}
        </section>

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
                  <Link
                    key={animal.livestock_id}
                    to={`/animals/${animal.livestock_id}`}
                    className="animal-card"
                  >
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
