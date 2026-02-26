import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import EnrollmentResult from '../components/EnrollmentResult';
import { EnrollmentResponse } from '../types';
import '../styles/Result.css';

interface ResultLocationState {
  result: EnrollmentResponse;
}

export default function Result() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as ResultLocationState | null;

  if (!state?.result) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="page result-page">
      <div className="container">
        <div className="card">
          <EnrollmentResult
            result={state.result}
            onEnrollAnother={() => navigate('/enroll')}
          />
        </div>
      </div>
    </div>
  );
}
