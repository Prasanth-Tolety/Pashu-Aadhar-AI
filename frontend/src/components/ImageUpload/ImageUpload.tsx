import { useRef, useState } from 'react';
import './ImageUpload.css';

interface ImageUploadProps {
  onFileSelect: (file: File) => void;
  onCameraOpen: () => void;
  previewUrl: string | null;
  disabled?: boolean;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export default function ImageUpload({
  onFileSelect,
  onCameraOpen,
  previewUrl,
  disabled = false,
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const validateFile = (file: File): boolean => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setValidationError('Invalid file type. Please upload a JPEG, PNG, or WebP image.');
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      setValidationError('File too large. Maximum size is 10 MB.');
      return false;
    }
    setValidationError(null);
    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validateFile(file)) {
      onFileSelect(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file && validateFile(file)) {
      onFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  return (
    <div className="image-upload">
      {previewUrl ? (
        <div className="image-preview">
          <img src={previewUrl} alt="Selected animal" className="preview-img" />
          <button
            className="btn btn-outline change-photo-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            Change Photo
          </button>
        </div>
      ) : (
        <div
          className={`upload-zone ${dragActive ? 'drag-active' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="upload-icon">🐄</div>
          <p className="upload-title">Upload Animal Photo</p>
          <p className="upload-hint">JPEG, PNG or WebP · Max 10 MB</p>
          <div className="upload-actions">
            <button
              className="btn btn-primary"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
            >
              📁 Browse File
            </button>
            <button
              className="btn btn-secondary"
              onClick={onCameraOpen}
              disabled={disabled}
            >
              📷 Take Photo
            </button>
          </div>
          <p className="upload-drag-hint">or drag and drop here</p>
        </div>
      )}

      {validationError && <p className="error-message">{validationError}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        onChange={handleFileChange}
        className="file-input-hidden"
        aria-label="Upload image"
      />
    </div>
  );
}
