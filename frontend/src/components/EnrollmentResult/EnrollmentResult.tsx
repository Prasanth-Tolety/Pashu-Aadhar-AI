import { EnrollmentResponse } from '../../types';
import './EnrollmentResult.css';

interface EnrollmentResultProps {
  result: EnrollmentResponse;
  onEnrollAnother: () => void;
}

export default function EnrollmentResult({ result, onEnrollAnother }: EnrollmentResultProps) {
  const isNew = result.status === 'NEW';
  const similarityPercent = Math.round(result.similarity * 100);

  return (
    <div className="enrollment-result">
      <div className={`result-icon ${isNew ? 'result-icon--new' : 'result-icon--existing'}`}>
        {isNew ? '🆕' : '✅'}
      </div>

      <h2 className="result-title">
        {isNew ? 'New Animal Enrolled!' : 'Animal Already Registered'}
      </h2>

      <div className={`result-badge ${isNew ? 'result-badge--new' : 'result-badge--existing'}`}>
        {result.status}
      </div>

      <div className="result-details">
        <div className="result-row">
          <span className="result-label">Livestock ID</span>
          <span className="result-value result-id">{result.livestock_id}</span>
        </div>
        <div className="result-row">
          <span className="result-label">Match Similarity</span>
          <div className="result-similarity">
            <div className="similarity-bar-container">
              <div
                className="similarity-bar"
                style={{ width: `${similarityPercent}%` }}
              />
            </div>
            <span className="result-value">{similarityPercent}%</span>
          </div>
        </div>
        {result.message && (
          <div className="result-row">
            <span className="result-label">Note</span>
            <span className="result-value">{result.message}</span>
          </div>
        )}
      </div>

      <button className="btn btn-primary btn-full" onClick={onEnrollAnother}>
        Enroll Another Animal
      </button>
    </div>
  );
}
