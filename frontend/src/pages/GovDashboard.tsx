/**
 * GovDashboard — Rich analytics dashboard for Government / Admin roles.
 *
 * Visualizations:
 *   1. Summary KPI cards with animated counters
 *   2. Interactive India SVG map — state-wise cattle population (hover + click)
 *   3. Enrollment trends — area chart (daily) + bar chart (monthly)
 *   4. Breed distribution — pie chart + horizontal bar
 *   5. Gender distribution — donut chart
 *   6. Fraud risk overview — gauge + bar chart by risk level
 *   7. Agent performance leaderboard — table + bar chart
 *   8. State-wise top-10 bar chart
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getAnalyticsSummary,
  getAnalyticsStates,
  getAnalyticsTrends,
  getAnalyticsBreeds,
  getAnalyticsFraud,
  getAnalyticsAgents,
} from '../services/api';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line,
} from 'recharts';
import IndiaMap from '../components/IndiaMap';
import '../styles/GovDashboard.css';

// ─── Types ──────────────────────────────────────────────────────────
interface SummaryData {
  total_animals: number;
  total_farmers: number;
  total_sessions: number;
  completed_sessions: number;
  active_sessions: number;
  unique_agents: number;
  enrollments_last_30_days: number;
  enrollments_last_7_days: number;
  gender_distribution: Record<string, number>;
  species_distribution: Record<string, number>;
}

interface StateData {
  state: string;
  total: number;
  species: Record<string, number>;
  breeds: Record<string, number>;
  gender: Record<string, number>;
  recent_30d: number;
}

interface TrendData {
  daily: Array<{ date: string; count: number }>;
  monthly: Array<{ month: string; count: number }>;
  cumulative: Array<{ date: string; total: number }>;
}

interface BreedData {
  breed: string;
  count: number;
  states: Record<string, number>;
  gender: Record<string, number>;
}

interface FraudData {
  total_scored: number;
  risk_distribution: { low: number; medium: number; high: number; critical: number };
  avg_fraud_score: number;
  flagged_enrollments: Array<{
    livestock_id: string;
    agent_id: string;
    fraud_risk_score: number;
    risk_level: string;
    flags: string[];
    created_at: string;
  }>;
  top_flags: Array<{ flag: string; count: number }>;
}

interface AgentData {
  agent_id: string;
  agent_name: string;
  total_sessions: number;
  completed: number;
  abandoned: number;
  completion_rate: number;
  avg_duration_minutes: number;
}

const COLORS = ['#FF6B35', '#004E89', '#2E7D32', '#D32F2F', '#6A1B9A', '#E65100', '#0277BD', '#C2185B', '#00695C', '#F57F17'];
const RISK_COLORS = { low: '#4caf50', medium: '#ff9800', high: '#f44336', critical: '#9c27b0' };

// ─── Animated Counter Hook ──────────────────────────────────────────
function useCounter(target: number, duration = 1500) {
  const [val, setVal] = useState(0);
  const ref = useRef(0);
  useEffect(() => {
    if (!target) { setVal(0); return; }
    ref.current = 0;
    const step = target / (duration / 16);
    const id = setInterval(() => {
      ref.current = Math.min(ref.current + step, target);
      setVal(Math.floor(ref.current));
      if (ref.current >= target) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [target, duration]);
  return val;
}

export default function GovDashboard() {
  const { idToken, user } = useAuth();

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [states, setStates] = useState<StateData[]>([]);
  const [trends, setTrends] = useState<TrendData | null>(null);
  const [breeds, setBreeds] = useState<BreedData[]>([]);
  const [fraud, setFraud] = useState<FraudData | null>(null);
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedState, setSelectedState] = useState<StateData | null>(null);
  const [activeVizTab, setActiveVizTab] = useState<'map' | 'trends' | 'breeds' | 'fraud' | 'agents' | 'logs'>('map');

  const loadAll = useCallback(async () => {
    if (!idToken) return;
    setLoading(true);
    setError('');
    try {
      const [summaryRes, statesRes, trendsRes, breedsRes, fraudRes, agentsRes] = await Promise.all([
        getAnalyticsSummary(idToken),
        getAnalyticsStates(idToken),
        getAnalyticsTrends(idToken),
        getAnalyticsBreeds(idToken),
        getAnalyticsFraud(idToken).catch(() => null),
        getAnalyticsAgents(idToken),
      ]);
      setSummary(summaryRes);
      setStates(statesRes.states || []);
      setTrends(trendsRes);
      setBreeds(breedsRes.breeds || []);
      if (fraudRes) setFraud(fraudRes);
      setAgents(agentsRes.agents || []);
    } catch (err) {
      console.error('Analytics load error', err);
      setError('Failed to load analytics data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [idToken]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Animated counters
  const totalAnimals = useCounter(summary?.total_animals || 0);
  const totalFarmers = useCounter(summary?.total_farmers || 0);
  const totalAgents = useCounter(summary?.unique_agents || 0);
  const recent30 = useCounter(summary?.enrollments_last_30_days || 0);
  const recent7 = useCounter(summary?.enrollments_last_7_days || 0);
  const completedSessions = useCounter(summary?.completed_sessions || 0);

  // State map color scale
  const maxStateCount = Math.max(...states.map(s => s.total), 1);
  const stateColorMap: Record<string, string> = {};
  states.forEach(s => {
    const intensity = Math.min(s.total / maxStateCount, 1);
    const r = Math.round(255 - intensity * 200);
    const g = Math.round(255 - intensity * 120);
    const b = Math.round(255 - intensity * 30);
    stateColorMap[s.state] = `rgb(${r},${g},${b})`;
  });

  // Gender pie data
  const genderPie = summary ? Object.entries(summary.gender_distribution).map(([name, value]) => ({ name, value })) : [];

  // Top 10 states
  const top10States = states.filter(s => s.total > 0).slice(0, 10);

  // Breed pie data (top 8)
  const breedPie = breeds.slice(0, 8).map(b => ({ name: b.breed, value: b.count }));

  // Fraud risk pie
  const fraudPie = fraud ? [
    { name: 'Low', value: fraud.risk_distribution.low, color: RISK_COLORS.low },
    { name: 'Medium', value: fraud.risk_distribution.medium, color: RISK_COLORS.medium },
    { name: 'High', value: fraud.risk_distribution.high, color: RISK_COLORS.high },
    { name: 'Critical', value: fraud.risk_distribution.critical, color: RISK_COLORS.critical },
  ].filter(d => d.value > 0) : [];

  if (loading) {
    return (
      <div className="gov-dash">
        <div className="gov-dash-loading">
          <div className="loading-spinner large" />
          <p>Loading analytics data from all tables...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="gov-dash">
      {/* Header with Indian govt branding */}
      <header className="gov-header">
        <div className="gov-header-left">
          <Link to="/dashboard" className="gov-back">← Dashboard</Link>
          <div className="gov-brand">
            <img src="/ashoka-emblem.svg" alt="Ashoka Emblem" className="ashoka-emblem" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <div>
              <h1>पशु आधार — Analytics</h1>
              <p className="gov-subtitle">National Livestock Identity Platform • भारत सरकार</p>
            </div>
          </div>
        </div>
        <div className="gov-header-right">
          <div className="tricolor-bar">
            <span className="tri-saffron" />
            <span className="tri-white" />
            <span className="tri-green" />
          </div>
        </div>
      </header>

      {error && <div className="gov-error">{error}</div>}

      {/* KPI Cards */}
      <div className="kpi-section-header">
        <h2 className="kpi-section-title">📊 Key Performance Indicators</h2>
        <button onClick={loadAll} className="gov-refresh-btn" title="Refresh">🔄 Refresh</button>
      </div>
      <section className="kpi-grid">
        <div className="kpi-card kpi-animals">
          <span className="kpi-icon">🐄</span>
          <div className="kpi-content">
            <span className="kpi-value">{totalAnimals.toLocaleString('en-IN')}</span>
            <span className="kpi-label">Total Animals Enrolled</span>
          </div>
        </div>
        <div className="kpi-card kpi-farmers">
          <span className="kpi-icon">🧑‍🌾</span>
          <div className="kpi-content">
            <span className="kpi-value">{totalFarmers.toLocaleString('en-IN')}</span>
            <span className="kpi-label">Registered Farmers</span>
          </div>
        </div>
        <div className="kpi-card kpi-agents">
          <span className="kpi-icon">📋</span>
          <div className="kpi-content">
            <span className="kpi-value">{totalAgents}</span>
            <span className="kpi-label">Active Agents</span>
          </div>
        </div>
        <div className="kpi-card kpi-sessions">
          <span className="kpi-icon">✅</span>
          <div className="kpi-content">
            <span className="kpi-value">{completedSessions.toLocaleString('en-IN')}</span>
            <span className="kpi-label">Sessions Completed</span>
          </div>
        </div>
        <div className="kpi-card kpi-recent">
          <span className="kpi-icon">📈</span>
          <div className="kpi-content">
            <span className="kpi-value">{recent30.toLocaleString('en-IN')}</span>
            <span className="kpi-label">Last 30 Days</span>
          </div>
        </div>
        <div className="kpi-card kpi-week">
          <span className="kpi-icon">⚡</span>
          <div className="kpi-content">
            <span className="kpi-value">{recent7.toLocaleString('en-IN')}</span>
            <span className="kpi-label">This Week</span>
          </div>
        </div>
      </section>

      {/* Visualization Tabs */}
      <div className="viz-tabs">
        {[
          { id: 'map' as const, label: '🗺️ India Map', },
          { id: 'trends' as const, label: '📈 Trends' },
          { id: 'breeds' as const, label: '🐮 Breeds' },
          { id: 'fraud' as const, label: '🛡️ Fraud' },
          { id: 'agents' as const, label: '👥 Agents' },
          ...(user?.role === 'admin' ? [{ id: 'logs' as const, label: '📋 Logs' }] : []),
        ].map(tab => (
          <button
            key={tab.id}
            className={`viz-tab ${activeVizTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveVizTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── MAP TAB ─── */}
      {activeVizTab === 'map' && (
        <div className="viz-panel fade-in">
          <div className="map-section">
            <div className="map-container">
              <h2>🗺️ State-wise Cattle Population</h2>
              <p className="map-hint">Hover over states to see details. Click to view breakdown.</p>
              <IndiaMap
                stateData={states}
                maxCount={maxStateCount}
                onStateClick={(stateName: string) => {
                  const st = states.find(s => s.state === stateName);
                  setSelectedState(st || null);
                }}
              />
              {/* Legend */}
              <div className="map-legend">
                <span className="legend-label">Low</span>
                <div className="legend-gradient" />
                <span className="legend-label">High</span>
              </div>
            </div>

            <div className="map-sidebar">
              {selectedState ? (
                <div className="state-detail-card">
                  <h3>{selectedState.state}</h3>
                  <div className="state-stat-row">
                    <span className="state-stat-val">{selectedState.total}</span>
                    <span className="state-stat-label">Total Animals</span>
                  </div>
                  <div className="state-stat-row">
                    <span className="state-stat-val">{selectedState.recent_30d}</span>
                    <span className="state-stat-label">Last 30 Days</span>
                  </div>
                  <h4>Species</h4>
                  {Object.entries(selectedState.species).map(([sp, c]) => (
                    <div key={sp} className="mini-bar-row">
                      <span>{sp}</span>
                      <div className="mini-bar"><div className="mini-bar-fill" style={{ width: `${(c / selectedState.total) * 100}%` }} /></div>
                      <span>{c}</span>
                    </div>
                  ))}
                  <h4>Top Breeds</h4>
                  {Object.entries(selectedState.breeds).sort(([,a],[,b]) => b-a).slice(0,5).map(([br, c]) => (
                    <div key={br} className="mini-bar-row">
                      <span>{br}</span>
                      <div className="mini-bar"><div className="mini-bar-fill breed-bar" style={{ width: `${(c / selectedState.total) * 100}%` }} /></div>
                      <span>{c}</span>
                    </div>
                  ))}
                  <button className="state-close-btn" onClick={() => setSelectedState(null)}>✕ Close</button>
                </div>
              ) : (
                <div className="state-detail-card">
                  <h3>Top 10 States</h3>
                  <div className="top-states-chart">
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={top10States} layout="vertical" margin={{ left: 10, right: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="state" width={110} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(val: any) => Number(val).toLocaleString('en-IN')} />
                        <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                          {top10States.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── TRENDS TAB ─── */}
      {activeVizTab === 'trends' && trends && (
        <div className="viz-panel fade-in">
          <div className="chart-grid-2">
            {/* Daily enrollment trend */}
            <div className="chart-card">
              <h3>📊 Daily Enrollments (Last 90 Days)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={trends.daily}>
                  <defs>
                    <linearGradient id="enrollGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF6B35" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#FF6B35" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} interval={6} />
                  <YAxis />
                  <Tooltip labelFormatter={(d: any) => new Date(String(d)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />
                  <Area type="monotone" dataKey="count" stroke="#FF6B35" fill="url(#enrollGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Cumulative growth */}
            <div className="chart-card">
              <h3>📈 Cumulative Growth</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trends.cumulative}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} interval={6} />
                  <YAxis />
                  <Tooltip labelFormatter={(d: any) => new Date(String(d)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} />
                  <Line type="monotone" dataKey="total" stroke="#004E89" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Monthly histogram */}
            <div className="chart-card full-width">
              <h3>📅 Monthly Enrollment Volume</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={trends.monthly}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {trends.monthly.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gender + Species Distribution */}
          <div className="chart-grid-2" style={{ marginTop: '1.5rem' }}>
            <div className="chart-card">
              <h3>⚤ Gender Distribution</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={genderPie} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}>
                    {genderPie.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <h3>🐮 Species Distribution</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={summary ? Object.entries(summary.species_distribution).map(([name, value]) => ({ name, value })) : []}
                    cx="50%" cy="50%" outerRadius={100} dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  >
                    {(summary ? Object.keys(summary.species_distribution) : []).map((_, i) => (
                      <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ─── BREEDS TAB ─── */}
      {activeVizTab === 'breeds' && (
        <div className="viz-panel fade-in">
          <div className="chart-grid-2">
            <div className="chart-card">
              <h3>🐄 Breed Distribution (Top 8)</h3>
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie data={breedPie} cx="50%" cy="50%" outerRadius={110} paddingAngle={2} dataKey="value" label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}>
                    {breedPie.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <h3>📊 Breed Population (All)</h3>
              <ResponsiveContainer width="100%" height={Math.max(320, breeds.length * 30)}>
                <BarChart data={breeds.slice(0, 15)} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="breed" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {breeds.slice(0, 15).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Breed table */}
          <div className="chart-card full-width" style={{ marginTop: '1.5rem' }}>
            <h3>🗃️ Complete Breed Registry</h3>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Breed</th>
                    <th>Count</th>
                    <th>Top States</th>
                  </tr>
                </thead>
                <tbody>
                  {breeds.map((b, i) => (
                    <tr key={b.breed}>
                      <td>{i + 1}</td>
                      <td><strong>{b.breed}</strong></td>
                      <td>{b.count.toLocaleString('en-IN')}</td>
                      <td>{Object.entries(b.states).sort(([,a],[,b]) => b - a).slice(0, 3).map(([s, c]) => `${s} (${c})`).join(', ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── FRAUD TAB ─── */}
      {activeVizTab === 'fraud' && (
        <div className="viz-panel fade-in">
          {fraud ? (
            <>
              <div className="fraud-kpis">
                <div className="fraud-kpi">
                  <span className="fraud-kpi-val">{fraud.total_scored}</span>
                  <span className="fraud-kpi-label">Total Scored</span>
                </div>
                <div className="fraud-kpi">
                  <span className="fraud-kpi-val">{fraud.avg_fraud_score}</span>
                  <span className="fraud-kpi-label">Avg Score</span>
                </div>
                <div className="fraud-kpi critical">
                  <span className="fraud-kpi-val">{fraud.risk_distribution.critical + fraud.risk_distribution.high}</span>
                  <span className="fraud-kpi-label">Flagged (High+Critical)</span>
                </div>
              </div>

              <div className="chart-grid-2">
                <div className="chart-card">
                  <h3>🛡️ Risk Distribution</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={fraudPie} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                        {fraudPie.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="chart-card">
                  <h3>🚩 Top Fraud Flags</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={fraud.top_flags.slice(0, 6)} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="flag" width={180} tick={{ fontSize: 9 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#f44336" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Flagged enrollments table */}
              {fraud.flagged_enrollments.length > 0 && (
                <div className="chart-card full-width" style={{ marginTop: '1.5rem' }}>
                  <h3>⚠️ Flagged Enrollments ({fraud.flagged_enrollments.length})</h3>
                  <div className="data-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Livestock ID</th>
                          <th>Agent</th>
                          <th>Score</th>
                          <th>Risk</th>
                          <th>Flags</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fraud.flagged_enrollments.slice(0, 20).map((f, i) => (
                          <tr key={i} className={`risk-row risk-${f.risk_level}`}>
                            <td><code>{f.livestock_id}</code></td>
                            <td>{f.agent_id?.slice(-8) || '—'}</td>
                            <td><strong>{f.fraud_risk_score}</strong></td>
                            <td><span className={`risk-badge risk-${f.risk_level}`}>{f.risk_level.toUpperCase()}</span></td>
                            <td className="flags-cell">{f.flags.slice(0, 2).join('; ')}{f.flags.length > 2 ? ` +${f.flags.length - 2}` : ''}</td>
                            <td>{f.created_at ? new Date(f.created_at).toLocaleDateString('en-IN') : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">No fraud data available yet. Fraud scores are computed during enrollment.</div>
          )}
        </div>
      )}

      {/* ─── AGENTS TAB ─── */}
      {activeVizTab === 'agents' && (
        <div className="viz-panel fade-in">
          <div className="chart-grid-2">
            <div className="chart-card">
              <h3>👥 Agent Performance (Top 10)</h3>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={agents.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="agent_name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="completed" name="Completed" fill="#4caf50" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="abandoned" name="Abandoned" fill="#f44336" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <h3>⏱️ Avg Session Duration (minutes)</h3>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={agents.filter(a => a.avg_duration_minutes > 0).slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="agent_name" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="avg_duration_minutes" fill="#0277BD" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Agent leaderboard table */}
          <div className="chart-card full-width" style={{ marginTop: '1.5rem' }}>
            <h3>🏆 Agent Leaderboard</h3>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Agent</th>
                    <th>Total</th>
                    <th>Completed</th>
                    <th>Rate</th>
                    <th>Avg Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((a, i) => (
                    <tr key={a.agent_id}>
                      <td>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</td>
                      <td><strong>{a.agent_name}</strong></td>
                      <td>{a.total_sessions}</td>
                      <td>{a.completed}</td>
                      <td>
                        <span className={`rate-badge ${a.completion_rate >= 80 ? 'good' : a.completion_rate >= 50 ? 'mid' : 'low'}`}>
                          {a.completion_rate}%
                        </span>
                      </td>
                      <td>{a.avg_duration_minutes ? `${a.avg_duration_minutes} min` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── LOGS TAB (Admin only) ─── */}
      {activeVizTab === 'logs' && user?.role === 'admin' && (
        <div className="viz-panel fade-in">
          <h2>📋 CloudWatch Logs</h2>
          <p style={{ color: '#78909c', marginBottom: '1.2rem' }}>Direct links to Lambda log groups in AWS CloudWatch (us-east-1).</p>
          <div className="logs-grid">
            {[
              { name: 'Enroll',              fn: 'pashu-aadhaar-enroll-prod' },
              { name: 'Animals',             fn: 'pashu-aadhaar-animals-prod' },
              { name: 'Analytics',           fn: 'pashu-aadhaar-analytics-prod' },
              { name: 'Profile',             fn: 'pashu-aadhaar-profile-prod' },
              { name: 'Post-Confirmation',   fn: 'pashu-aadhaar-post-confirmation-prod' },
              { name: 'Access Requests',     fn: 'pashu-aadhaar-access-requests-prod' },
              { name: 'Enrollment Sessions', fn: 'pashu-aadhaar-enrollment-sessions-prod' },
              { name: 'Get Upload URL',      fn: 'pashu-aadhaar-get-upload-url-prod' },
            ].map(svc => {
              const logGroup = encodeURIComponent(encodeURIComponent(`/aws/lambda/${svc.fn}`));
              const url = `https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/${logGroup}`;
              return (
                <a key={svc.fn} href={url} target="_blank" rel="noopener noreferrer" className="log-link-card">
                  <span className="log-icon">📄</span>
                  <div>
                    <span className="log-name">{svc.name}</span>
                    <span className="log-fn">/aws/lambda/{svc.fn}</span>
                  </div>
                  <span className="log-arrow">↗</span>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer with govt branding */}
      <footer className="gov-footer">
        <div className="tricolor-bar large">
          <span className="tri-saffron" />
          <span className="tri-white" />
          <span className="tri-green" />
        </div>
        <p>पशु आधार — राष्ट्रीय पशुधन पहचान मंच • Government of India Initiative</p>
        <p className="gov-footer-sub">Ministry of Fisheries, Animal Husbandry & Dairying • Digital India 🇮🇳</p>
      </footer>
    </div>
  );
}
