import { useVoice } from '../context/VoiceContext';
import '../styles/Voice.css';

interface SpeakButtonProps {
  /** The text to speak when clicked */
  text: string;
  /** Optional className for extra styling */
  className?: string;
  /** Size: small for inline, normal for blocks */
  size?: 'small' | 'normal';
}

/**
 * Inline speaker icon button.
 * Shown only when voiceEnabled is true (controlled via VoiceContext toggle).
 * Clicking reads the given text aloud using Web Speech API.
 */
export default function SpeakButton({ text, className = '', size = 'small' }: SpeakButtonProps) {
  const { voiceEnabled, speak, stop, isSpeaking, currentText } = useVoice();

  if (!voiceEnabled) return null;

  const isActive = isSpeaking && currentText === text;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isActive) {
      stop();
    } else {
      speak(text);
    }
  };

  return (
    <button
      className={`speak-btn ${size} ${isActive ? 'active' : ''} ${className}`}
      onClick={handleClick}
      title={isActive ? 'Stop reading' : 'Read aloud'}
      aria-label={isActive ? 'Stop reading' : 'Read aloud'}
      type="button"
    >
      {isActive ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="6" y="4" width="4" height="16" rx="1" />
          <rect x="14" y="4" width="4" height="16" rx="1" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
      )}
    </button>
  );
}
