import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useVoice } from '../context/VoiceContext';
import { ROLE_CONFIG } from '../types';
import { askAiAssistant, sendAiChat } from '../services/api';
import SpeakButton from '../components/SpeakButton';
import VoiceToggle from '../components/VoiceToggle';
import '../styles/AiAssistant.css';

// ─── Speech Recognition types ────────────────────────────────────
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

type Mode = 'assistant' | 'chat';

export default function AiAssistant() {
  const { user, idToken } = useAuth();
  const { t } = useLanguage();
  const { speak, voiceEnabled } = useVoice();
  const [searchParams] = useSearchParams();
  const role = (user?.role || 'farmer') as keyof typeof ROLE_CONFIG;
  const roleConfig = ROLE_CONFIG[role];

  const [mode, setMode] = useState<Mode>('assistant');

  // --- Vet Assistant ---
  const [question, setQuestion] = useState('');
  const [animalId, setAnimalId] = useState(searchParams.get('animal_id') || '');
  const [assistantResponse, setAssistantResponse] = useState('');
  const [assistantLoading, setAssistantLoading] = useState(false);

  // --- Chat ---
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatId, setChatId] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- Voice Input (Speech Recognition) ---
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const hasSpeechRecognition = !!SpeechRecognition;

  // Quick suggestion prompts
  const quickPrompts = [
    { emoji: '🤒', label: t.aiQuickFever || 'My cow has fever and not eating', value: 'My cow has high fever and is not eating since yesterday' },
    { emoji: '🦶', label: t.aiQuickLameness || 'Animal is limping', value: 'My animal is limping and has blisters on its hooves' },
    { emoji: '🥛', label: t.aiQuickMilk || 'Milk yield dropped suddenly', value: 'My buffalo milk yield has dropped suddenly from 8 liters to 3 liters' },
    { emoji: '💊', label: t.aiQuickVaccine || 'What vaccines are due?', value: 'What vaccines should I give my 1-year-old calf this season?' },
    { emoji: '🔴', label: t.aiQuickSkin || 'Skin lumps appeared', value: 'My cow has developed round skin lumps all over the body' },
    { emoji: '🍼', label: t.aiQuickCalving || 'Cow cannot stand after calving', value: 'My cow just calved yesterday and now cannot stand up, ears are cold' },
  ];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleAskAssistant = async () => {
    if (!question.trim() || !idToken) return;
    setAssistantLoading(true);
    setAssistantResponse('');
    try {
      const res = await askAiAssistant(question, animalId || undefined, idToken);
      setAssistantResponse(res.response);
      // Auto-speak the response if voice is enabled
      if (voiceEnabled) speak(res.response);
    } catch {
      setAssistantResponse(t.aiServiceUnavailable || 'AI service is temporarily unavailable. Please try again.');
    } finally {
      setAssistantLoading(false);
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || !idToken) return;
    const userMsg: ChatMessage = { role: 'user', content: chatInput.trim(), timestamp: new Date() };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const allMessages = [...chatMessages, userMsg].map((m) => ({ role: m.role, content: m.content }));
      const res = await sendAiChat(allMessages, chatId || undefined, animalId || undefined, idToken);
      setChatId(res.chat_id);
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: res.response, timestamp: new Date() },
      ]);
      // Auto-speak
      if (voiceEnabled) speak(res.response);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: t.aiServiceUnavailable || 'Service unavailable. Please try again.', timestamp: new Date() },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleQuickPrompt = (value: string) => {
    if (mode === 'assistant') {
      setQuestion(value);
    } else {
      setChatInput(value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (mode === 'assistant') handleAskAssistant();
      else handleSendChat();
    }
  };

  const clearChat = () => {
    setChatMessages([]);
    setChatId('');
  };

  // ─── Voice Input Handlers ──────────────────────────────────────
  const startListening = useCallback(() => {
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';

    recognition.onstart = () => {
      setIsListening(true);
      setInterimText('');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        if (mode === 'assistant') {
          setQuestion((prev) => prev + finalTranscript);
        } else {
          setChatInput((prev) => prev + finalTranscript);
        }
        setInterimText('');
      } else {
        setInterimText(interimTranscript);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimText('');
    };

    recognition.onerror = () => {
      setIsListening(false);
      setInterimText('');
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [SpeechRecognition, mode]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return (
    <div className="ai-container">
      {/* Header */}
      <header className="ai-header">
        <div className="ai-header-left">
          <Link to="/dashboard" className="ai-back-link">← {t.backToDashboard}</Link>
          <h1>🤖 {t.aiAssistantTitle || 'AI Vet Assistant'} <SpeakButton text={t.aiAssistantTitle || 'AI Vet Assistant'} /></h1>
        </div>
        <div className="ai-header-right">
          <VoiceToggle />
          <span className="role-chip" style={{ background: roleConfig.color + '22', color: roleConfig.color }}>
            {roleConfig.icon} {roleConfig.label}
          </span>
        </div>
      </header>

      {/* Powered by banner */}
      <div className="ai-powered-banner">
        <span>⚡ {t.aiPoweredBy || 'Powered by Amazon Bedrock (Claude AI)'} <SpeakButton text={t.aiPoweredBy || 'Powered by Amazon Bedrock (Claude AI)'} /></span>
        <span className="ai-disclaimer">{t.aiDisclaimer || 'AI-generated advice — always consult a qualified veterinarian'} <SpeakButton text={t.aiDisclaimer || 'AI-generated advice — always consult a qualified veterinarian'} /></span>
      </div>

      {/* Mode Tabs */}
      <div className="ai-mode-tabs">
        <button
          className={`ai-mode-tab ${mode === 'assistant' ? 'active' : ''}`}
          onClick={() => setMode('assistant')}
        >
          🩺 {t.aiVetAssistant || 'Vet Assistant'}
        </button>
        <button
          className={`ai-mode-tab ${mode === 'chat' ? 'active' : ''}`}
          onClick={() => setMode('chat')}
        >
          💬 {t.aiFarmerCopilot || 'Farmer Copilot'}
        </button>
      </div>

      {/* Animal ID (shared) */}
      <div className="ai-animal-id-bar">
        <label>🐄 {t.aiAnimalIdOptional || 'Animal ID (optional)'}:</label>
        <input
          type="text"
          value={animalId}
          onChange={(e) => setAnimalId(e.target.value)}
          placeholder="e.g., PA-M1234-ABCD"
          className="ai-animal-input"
        />
      </div>

      {/* Quick Prompts */}
      <div className="ai-quick-prompts">
        <span className="ai-quick-label">💡 {t.aiQuickQuestions || 'Quick questions'}:</span>
        <div className="ai-quick-grid">
          {quickPrompts.map((p, i) => (
            <button key={i} className="ai-quick-btn" onClick={() => handleQuickPrompt(p.value)}>
              {p.emoji} {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── VET ASSISTANT MODE ─── */}
      {mode === 'assistant' && (
        <div className="ai-assistant-panel">
          <div className="ai-input-group">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? 'Listening...' : (t.aiDescribeSymptoms || 'Describe the symptoms or ask a question about your animal...')}
              rows={4}
              className="ai-textarea"
              disabled={assistantLoading || isListening}
            />
            {interimText && mode === 'assistant' && (
              <div className="ai-interim-text"><span className="ai-rec-dot" /> {interimText}</div>
            )}
            <div className="ai-input-actions">
              {hasSpeechRecognition && (
                <button
                  onClick={isListening ? stopListening : startListening}
                  className={`ai-mic-btn ${isListening ? 'listening' : ''}`}
                  title={isListening ? 'Stop listening' : 'Speak your question'}
                  disabled={assistantLoading}
                  type="button"
                >
                  {isListening ? '⏹️ Stop' : '🎙️ Speak'}
                </button>
              )}
              <button
                onClick={handleAskAssistant}
                disabled={!question.trim() || assistantLoading}
                className="ai-submit-btn"
              >
              {assistantLoading ? (
                <><span className="ai-spinner" /> {t.aiAnalyzing || 'Analyzing...'}</>
              ) : (
                <>🔍 {t.aiAskVet || 'Ask AI Vet'}</>
              )}
            </button>
            </div>
          </div>

          {assistantResponse && (
            <div className="ai-response-card">
              <div className="ai-response-header">
                <span>🩺 {t.aiVetResponse || 'AI Vet Response'} <SpeakButton text={assistantResponse} size="normal" /></span>
              </div>
              <div className="ai-response-body">
                {assistantResponse.split('\n').map((line, i) => {
                  if (line.startsWith('**') && line.endsWith('**')) {
                    return <h4 key={i} className="ai-resp-heading">{line.replace(/\*\*/g, '')} <SpeakButton text={line.replace(/\*\*/g, '')} /></h4>;
                  }
                  if (line.startsWith('**')) {
                    const parts = line.split('**');
                    return (
                      <p key={i} className="ai-resp-line">
                        <strong>{parts[1]}</strong>{parts[2] || ''} <SpeakButton text={(parts[1] || '') + (parts[2] || '')} />
                      </p>
                    );
                  }
                  if (line.match(/^\d+\./)) {
                    return <p key={i} className="ai-resp-step">{line} <SpeakButton text={line} /></p>;
                  }
                  if (line.startsWith('- ')) {
                    return <p key={i} className="ai-resp-bullet">• {line.substring(2)} <SpeakButton text={line.substring(2)} /></p>;
                  }
                  if (line.includes('⚠️') || line.includes('Disclaimer')) {
                    return <p key={i} className="ai-resp-disclaimer">{line} <SpeakButton text={line} /></p>;
                  }
                  return line.trim() ? <p key={i}>{line} <SpeakButton text={line} /></p> : <br key={i} />;
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── CHAT MODE ─── */}
      {mode === 'chat' && (
        <div className="ai-chat-panel">
          <div className="ai-chat-messages">
            {chatMessages.length === 0 && (
              <div className="ai-chat-empty">
                <div className="ai-chat-empty-icon">🤖</div>
                <h3>{t.aiChatWelcome || 'Hello! I\'m your Pashu Aadhaar AI Copilot'} <SpeakButton text={t.aiChatWelcome || 'Hello! I am your Pashu Aadhaar AI Copilot'} /></h3>
                <p>{t.aiChatWelcomeDesc || 'Ask me anything about livestock health, vaccination schedules, milk management, insurance, or loans.'} <SpeakButton text={t.aiChatWelcomeDesc || 'Ask me anything about livestock health, vaccination schedules, milk management, insurance, or loans.'} /></p>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`ai-chat-bubble ${msg.role}`}>
                <div className="ai-chat-avatar">
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>
                <div className="ai-chat-content">
                  {msg.content.split('\n').map((line, j) =>
                    line.trim() ? <p key={j}>{line} <SpeakButton text={line} /></p> : <br key={j} />
                  )}
                  <span className="ai-chat-time">
                    {msg.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="ai-chat-bubble assistant">
                <div className="ai-chat-avatar">🤖</div>
                <div className="ai-chat-content">
                  <div className="ai-typing-indicator">
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="ai-chat-input-bar">
            <button onClick={clearChat} className="ai-chat-clear" title={t.aiClearChat || 'Clear chat'}>
              🗑️
            </button>
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t.aiTypeMessage || 'Type your message...'}
              className="ai-chat-input"
              disabled={chatLoading}
            />
            <button
              onClick={handleSendChat}
              disabled={!chatInput.trim() || chatLoading}
              className="ai-chat-send"
            >
              {chatLoading ? '⏳' : '📩'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
