/**
 * Enrollment — route to appropriate enrollment flow based on role:
 * - farmer → FarmerEnrollment (request form + status tracking)
 * - enrollment_agent / admin → AgentEnrollment (step-by-step guided capture)
 * - others → not allowed
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { preloadModels } from '../hooks/useModelPreloader';
import FarmerEnrollment from './FarmerEnrollment';
import AgentEnrollment from './AgentEnrollment';
import '../styles/Enrollment.css';

export default function Enrollment() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const role = user?.role;

  // Preload AI models for agent workflow
  useEffect(() => {
    if (role === 'enrollment_agent' || role === 'admin') {
      preloadModels();
    }
  }, [role]);

  // Farmer → enrollment request form
  if (role === 'farmer') {
    return <FarmerEnrollment />;
  }

  // Enrollment agent or admin → step-by-step capture workflow
  if (role === 'enrollment_agent' || role === 'admin') {
    return <AgentEnrollment />;
  }

  // Other roles → redirect to dashboard
  return (
    <div className="page enrollment-page">
      <div className="container">
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <h2>🚫 Enrollment Not Available</h2>
          <p>Animal enrollment is handled by designated Enrollment Agents.</p>
          <p>If you&apos;re a farmer, you can request an enrollment visit from the dashboard.</p>
          <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
            🏠 Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
