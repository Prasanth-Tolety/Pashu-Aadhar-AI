import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

interface VoiceContextType {
  /** Whether the speaker icons are visible */
  voiceEnabled: boolean;
  /** Toggle speaker icon visibility */
  toggleVoice: () => void;
  /** Speak given text aloud; stops any previous utterance first */
  speak: (text: string) => void;
  /** Stop current speech */
  stop: () => void;
  /** Whether something is currently being spoken */
  isSpeaking: boolean;
  /** The text currently being spoken (for highlight matching) */
  currentText: string;
}

const VoiceContext = createContext<VoiceContextType>({
  voiceEnabled: false,
  toggleVoice: () => {},
  speak: () => {},
  stop: () => {},
  isSpeaking: false,
  currentText: '',
});

export function VoiceProvider({ children }: { children: ReactNode }) {
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const toggleVoice = useCallback(() => {
    setVoiceEnabled((prev) => {
      if (prev) {
        // Turning off — stop any current speech
        window.speechSynthesis?.cancel();
        setIsSpeaking(false);
        setCurrentText('');
      }
      return !prev;
    });
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    setCurrentText('');
  }, []);

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return;

    // Cancel any previous speech
    window.speechSynthesis.cancel();

    // Clean text — strip markdown/emoji
    const clean = text
      .replace(/\*\*/g, '')
      .replace(/#{1,6}\s?/g, '')
      .replace(/[🐄🤖🩺💬⚡⚠️🚨🔶✅❓💡🤒🦶🥛💊🔴🍼📍🦠🔬📋🔐📩👤🗑️📷📄↗←→]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!clean) return;

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = 'en-IN';
    utterance.rate = 0.95;
    utterance.pitch = 1;

    // Try to pick a good voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) => v.lang.startsWith('en') && (v.name.includes('India') || v.name.includes('Google'))
    ) || voices.find((v) => v.lang.startsWith('en'));
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setCurrentText(text);
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      setCurrentText('');
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setCurrentText('');
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, []);

  return (
    <VoiceContext.Provider value={{ voiceEnabled, toggleVoice, speak, stop, isSpeaking, currentText }}>
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoice() {
  return useContext(VoiceContext);
}
