import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { ROLE_CONFIG, UserRole } from '../types';
import { getOutbreakAlerts, triggerOutbreakScan } from '../services/api';
import SpeakButton from '../components/SpeakButton';
import VoiceToggle from '../components/VoiceToggle';
import '../styles/OutbreakAlerts.css';

interface OutbreakAlert {
  alert_id: string;
  district: string;
  state: string;
  symptom: string;
  count: number;
  analysis: string;
  risk_level: string;
  created_at: string;
  source?: string;
}

export default function OutbreakAlerts() {
  const { user, idToken } = useAuth();
  const { t } = useLanguage();
  const role = (user?.role || 'farmer') as UserRole;
  const roleConfig = ROLE_CONFIG[role];
  const isGovOrAdmin = role === 'government' || role === 'admin';

  const [alerts, setAlerts] = useState<OutbreakAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [stateFilter, setStateFilter] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadAlerts();
  }, [stateFilter]);

  const loadAlerts = async () => {
    if (!idToken) return;
    setLoading(true);
    setError('');
    try {
      const res = await getOutbreakAlerts(stateFilter || undefined, idToken);
      setAlerts(res.alerts || []);
    } catch {
      setError(t.aiOutbreakLoadError || 'Failed to load outbreak alerts');
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async () => {
    if (!idToken) return;
    setScanning(true);
    try {
      const res = await triggerOutbreakScan(idToken);
      if (res.alerts?.length) {
        setAlerts((prev) => [...res.alerts, ...prev]);
      }
    } catch {
      setError(t.aiOutbreakScanError || 'Failed to trigger outbreak scan');
    } finally {
      setScanning(false);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return '#dc2626';
      case 'high': return '#ea580c';
      case 'medium': return '#d97706';
      case 'low': return '#16a34a';
      default: return '#6b7280';
    }
  };

  const getRiskEmoji = (level: string) => {
    switch (level) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '🔶';
      case 'low': return '✅';
      default: return '❓';
    }
  };

  // Extract unique states from alerts for filtering
  const states = [...new Set(alerts.map((a) => a.state).filter(Boolean))].sort();

  return (
    <div className="outbreak-container">
      {/* Header */}
      <header className="outbreak-header">
        <div className="outbreak-header-left">
          <Link to="/dashboard" className="outbreak-back-link">← {t.backToDashboard}</Link>
          <h1>🦠 {t.aiOutbreakTitle || 'Disease Outbreak Monitor'} <SpeakButton text={t.aiOutbreakTitle || 'Disease Outbreak Monitor'} /></h1>
        </div>
        <div className="outbreak-header-right">
          <VoiceToggle />
          <span className="role-chip" style={{ background: roleConfig.color + '22', color: roleConfig.color }}>
            {roleConfig.icon} {roleConfig.label}
          </span>
        </div>
      </header>

      {/* Info Banner */}
      <div className="outbreak-info-banner">
        <span>🔬 {t.aiOutbreakDesc || 'AI-powered disease surveillance — monitors health records for unusual clusters and generates early warning alerts'} <SpeakButton text={t.aiOutbreakDesc || 'AI-powered disease surveillance — monitors health records for unusual clusters and generates early warning alerts'} /></span>
      </div>

      {/* Controls */}
      <div className="outbreak-controls">
        <div className="outbreak-filter">
          <label>📍 {t.aiFilterState || 'Filter by State'}:</label>
          <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
            <option value="">{t.aiAllStates || 'All States'}</option>
            {states.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="outbreak-actions">
          <button onClick={loadAlerts} className="outbreak-refresh-btn" disabled={loading}>
            🔄 {t.refresh}
          </button>
          {isGovOrAdmin && (
            <button onClick={handleScan} className="outbreak-scan-btn" disabled={scanning}>
              {scanning ? (
                <><span className="ai-spinner" /> {t.aiScanning || 'Scanning...'}</>
              ) : (
                <>🔍 {t.aiTriggerScan || 'Run Outbreak Scan'}</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {!loading && alerts.length > 0 && (
        <div className="outbreak-summary">
          {['critical', 'high', 'medium', 'low'].map((level) => {
            const count = alerts.filter((a) => a.risk_level === level).length;
            return (
              <div key={level} className={`outbreak-summary-card risk-${level}`}>
                <span className="outbreak-summary-emoji">{getRiskEmoji(level)}</span>
                <span className="outbreak-summary-count">{count}</span>
                <span className="outbreak-summary-label">{level.toUpperCase()}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Error */}
      {error && <div className="outbreak-error">{error}</div>}

      {/* Loading */}
      {loading ? (
        <div className="outbreak-loading">
          <div className="loading-spinner" />
          <p>{t.loading}</p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="outbreak-empty">
          <div className="outbreak-empty-icon">✅</div>
          <h3>{t.aiNoOutbreaks || 'No Outbreak Alerts'} <SpeakButton text={t.aiNoOutbreaks || 'No Outbreak Alerts'} /></h3>
          <p>{t.aiNoOutbreaksDesc || 'No disease clusters have been detected. The system continuously monitors health records.'} <SpeakButton text={t.aiNoOutbreaksDesc || 'No disease clusters have been detected. The system continuously monitors health records.'} /></p>
        </div>
      ) : (
        <div className="outbreak-list">
          {alerts
            .sort((a, b) => {
              const riskOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
              return (riskOrder[a.risk_level] ?? 4) - (riskOrder[b.risk_level] ?? 4);
            })
            .map((alert) => (
              <div key={alert.alert_id} className={`outbreak-card risk-${alert.risk_level}`}>
                <div className="outbreak-card-header">
                  <div className="outbreak-card-risk" style={{ color: getRiskColor(alert.risk_level) }}>
                    {getRiskEmoji(alert.risk_level)} {alert.risk_level.toUpperCase()}
                  </div>
                  <span className="outbreak-card-date">
                    {new Date(alert.created_at).toLocaleString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>

                <div className="outbreak-card-location">
                  <span>📍 {alert.district}, {alert.state}</span>
                  <span className="outbreak-card-count">
                    {alert.count} {t.aiCasesIn48h || 'cases in 48h'}
                  </span>
                </div>

                <div className="outbreak-card-symptom">
                  <span className="outbreak-symptom-badge">{alert.symptom}</span>
                </div>

                <div className="outbreak-card-analysis">
                  {alert.analysis.split('\n').map((line, i) =>
                    line.trim() ? <p key={i}>{line} <SpeakButton text={line} /></p> : null
                  )}
                </div>

                {alert.source && (
                  <div className="outbreak-card-source">
                    Source: {alert.source === 'scheduled_scan' ? '⏰ Automated Scan' : '🔍 Manual Scan'}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
