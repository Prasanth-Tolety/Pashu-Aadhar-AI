/**
 * QRCodeCard — Generates and displays a QR code for an animal's livestock ID.
 * Can be downloaded as a printable tag image (PNG) or shared.
 */
import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QRCodeCardProps {
  livestockId: string;
  animalName?: string; // e.g. "Gir Cow" or species
  ownerName?: string;
}

export default function QRCodeCard({ livestockId, animalName, ownerName }: QRCodeCardProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const printCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    generateQR();
  }, [livestockId]);

  const generateQR = async () => {
    try {
      // Build the URL that the QR code resolves to
      const baseUrl = window.location.origin;
      const animalUrl = `${baseUrl}/animals/${livestockId}`;
      const dataUrl = await QRCode.toDataURL(animalUrl, {
        width: 256,
        margin: 2,
        color: { dark: '#1a237e', light: '#ffffff' },
        errorCorrectionLevel: 'H',
      });
      setQrDataUrl(dataUrl);
    } catch (err) {
      console.error('QR generation failed', err);
    }
  };

  const downloadTag = async () => {
    const canvas = printCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 400;
    const H = 520;
    canvas.width = W;
    canvas.height = H;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // Border
    ctx.strokeStyle = '#1a237e';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, W - 12, H - 12);

    // Header
    ctx.fillStyle = '#1a237e';
    ctx.fillRect(6, 6, W - 12, 48);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('पशु आधार — Pashu Aadhaar', W / 2, 36);

    // QR Code
    const qrImg = new Image();
    qrImg.onload = () => {
      ctx.drawImage(qrImg, (W - 280) / 2, 70, 280, 280);

      // Livestock ID
      ctx.fillStyle = '#1a237e';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(livestockId, W / 2, 375);

      // Animal info
      if (animalName) {
        ctx.fillStyle = '#333333';
        ctx.font = '14px sans-serif';
        ctx.fillText(animalName, W / 2, 400);
      }
      if (ownerName) {
        ctx.fillStyle = '#666666';
        ctx.font = '12px sans-serif';
        ctx.fillText(`Owner: ${ownerName}`, W / 2, 420);
      }

      // Footer
      ctx.fillStyle = '#999999';
      ctx.font = '10px sans-serif';
      ctx.fillText('Scan to verify identity • National Livestock Platform', W / 2, H - 20);

      // Tricolor bar
      const barY = H - 42;
      const barH = 4;
      ctx.fillStyle = '#FF9933';
      ctx.fillRect(6, barY, (W - 12) / 3, barH);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(6 + (W - 12) / 3, barY, (W - 12) / 3, barH);
      ctx.fillStyle = '#138808';
      ctx.fillRect(6 + 2 * (W - 12) / 3, barY, (W - 12) / 3, barH);

      // Download
      const link = document.createElement('a');
      link.download = `pashu-aadhaar-tag-${livestockId}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    qrImg.src = qrDataUrl;
  };

  const copyId = () => {
    navigator.clipboard.writeText(livestockId);
  };

  const shareId = async () => {
    const shareUrl = `${window.location.origin}/animals/${livestockId}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Pashu Aadhaar — ${livestockId}`,
          text: `Animal ID: ${livestockId}`,
          url: shareUrl,
        });
      } catch {
        // User cancelled
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
    }
  };

  if (!qrDataUrl) return null;

  return (
    <>
      <div className="qr-card">
        <div className="qr-card-header">
          <span>📱 QR Code Tag</span>
          <button className="qr-expand-btn" onClick={() => setShowModal(true)} title="Expand">⛶</button>
        </div>
        <div className="qr-preview" onClick={() => setShowModal(true)}>
          <img src={qrDataUrl} alt={`QR: ${livestockId}`} className="qr-image-small" />
        </div>
        <div className="qr-actions">
          <button className="qr-action-btn" onClick={downloadTag} title="Download printable tag">🏷️ Download Tag</button>
          <button className="qr-action-btn" onClick={shareId} title="Share animal ID">📤 Share</button>
          <button className="qr-action-btn" onClick={copyId} title="Copy ID">📋 Copy ID</button>
        </div>
      </div>

      {/* Full-screen QR Modal */}
      {showModal && (
        <div className="qr-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
            <button className="qr-modal-close" onClick={() => setShowModal(false)}>✕</button>
            <div className="qr-modal-header">पशु आधार — Animal QR Tag</div>
            <img src={qrDataUrl} alt={`QR: ${livestockId}`} className="qr-image-large" />
            <div className="qr-modal-id">{livestockId}</div>
            {animalName && <div className="qr-modal-info">{animalName}</div>}
            <p className="qr-modal-hint">Scan this QR code to view animal details</p>
            <div className="qr-modal-actions">
              <button className="qr-modal-btn primary" onClick={downloadTag}>🏷️ Download Printable Tag</button>
              <button className="qr-modal-btn" onClick={shareId}>📤 Share</button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden canvas for tag generation */}
      <canvas ref={printCanvasRef} style={{ display: 'none' }} />
    </>
  );
}
