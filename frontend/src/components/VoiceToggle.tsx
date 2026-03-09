import { useVoice } from '../context/VoiceContext';
import '../styles/Voice.css';

/**
 * Toggle button to show/hide all SpeakButton icons across the page.
 * Place in the top-right of any page header.
 */
export default function VoiceToggle() {
  const { voiceEnabled, toggleVoice, isSpeaking, stop } = useVoice();

  const handleClick = () => {
    if (isSpeaking) stop();
    toggleVoice();
  };

  return (
    <button
      className={`voice-toggle-btn ${voiceEnabled ? 'active' : ''}`}
      onClick={handleClick}
      title={voiceEnabled ? 'Hide voice buttons' : 'Show voice buttons'}
      aria-label={voiceEnabled ? 'Disable text-to-speech' : 'Enable text-to-speech'}
      type="button"
    >
      {voiceEnabled ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      )}
      <span className="voice-toggle-label">{voiceEnabled ? 'Voice On' : 'Voice Off'}</span>
    </button>
  );
}
