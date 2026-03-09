/**
 * ChatbotWidget — Floating AI Copilot chatbot at bottom-right corner.
 * Expandable / minimizable with smooth animation.
 * Supports voice-to-voice: microphone input → AI response → auto-speak.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useVoice } from '../context/VoiceContext';
import { sendAiChat } from '../services/api';
import SpeakButton from './SpeakButton';
import '../styles/ChatbotWidget.css';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// ─── Speech Recognition types (Web Speech API) ───────────────────
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
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

export default function ChatbotWidget() {
  const { user, idToken } = useAuth();
  const { t } = useLanguage();
  const { speak, voiceEnabled } = useVoice();

  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatId, setChatId] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [unread, setUnread] = useState(0);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check browser Speech Recognition support
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const hasSpeechRecognition = !!SpeechRecognition;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  // Focus input when widget opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
      setUnread(0);
    }
  }, [open]);

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || !idToken) return;
    const userMsg: ChatMessage = { role: 'user', content: msg, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setInterimText('');
    setLoading(true);

    try {
      const allMessages = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
      const res = await sendAiChat(allMessages, chatId || undefined, undefined, idToken);
      setChatId(res.chat_id);
      const assistantMsg: ChatMessage = { role: 'assistant', content: res.response, timestamp: new Date() };
      setMessages((prev) => [...prev, assistantMsg]);

      // Auto-speak the response if voice is enabled
      if (voiceEnabled) {
        speak(res.response);
      }

      // Increment unread if widget is closed
      if (!open) setUnread((u) => u + 1);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Service unavailable. Please try again.', timestamp: new Date() },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, messages, chatId, idToken, voiceEnabled, speak, open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ─── Speech Recognition (Voice Input) ─────────────────────────
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
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      if (finalTranscript) {
        setInput((prev) => prev + finalTranscript);
        setInterimText('');
      } else {
        setInterimText(interimTranscript);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimText('');
      // Auto-send if we got text
      setTimeout(() => {
        const inputEl = inputRef.current;
        if (inputEl && inputEl.value.trim()) {
          handleSend(inputEl.value);
        }
      }, 200);
    };

    recognition.onerror = () => {
      setIsListening(false);
      setInterimText('');
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [SpeechRecognition, handleSend]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const clearChat = () => {
    setMessages([]);
    setChatId('');
  };

  if (!user) return null;

  return (
    <>
      {/* Floating Bubble */}
      {!open && (
        <button className="chatbot-fab" onClick={() => setOpen(true)} title="AI Copilot">
          <span className="chatbot-fab-icon">🤖</span>
          {unread > 0 && <span className="chatbot-fab-badge">{unread}</span>}
        </button>
      )}

      {/* Chat Window */}
      {open && (
        <div className={`chatbot-window ${expanded ? 'chatbot-expanded' : ''}`}>
          {/* Header */}
          <div className="chatbot-header">
            <div className="chatbot-header-left">
              <span className="chatbot-header-icon">🤖</span>
              <div>
                <span className="chatbot-header-title">AI Copilot</span>
                <span className="chatbot-header-status">{loading ? 'Thinking...' : 'Online'}</span>
              </div>
            </div>
            <div className="chatbot-header-actions">
              <button
                className="chatbot-header-btn"
                onClick={() => setExpanded(!expanded)}
                title={expanded ? 'Minimize' : 'Expand'}
              >
                {expanded ? '⊖' : '⊕'}
              </button>
              <button className="chatbot-header-btn" onClick={() => setOpen(false)} title="Close">
                ✕
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="chatbot-messages">
            {messages.length === 0 && (
              <div className="chatbot-welcome">
                <div className="chatbot-welcome-icon">🐄</div>
                <p className="chatbot-welcome-title">{t.aiChatWelcome || "Hello! I'm your AI Copilot"}</p>
                <p className="chatbot-welcome-desc">Ask about animal health, vaccines, insurance, loans...</p>
                {hasSpeechRecognition && (
                  <p className="chatbot-welcome-voice">🎙️ Tap the mic to talk!</p>
                )}
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`chatbot-bubble ${msg.role}`}>
                <div className="chatbot-bubble-content">
                  {msg.content.split('\n').map((line, j) =>
                    line.trim() ? <p key={j}>{line}</p> : <br key={j} />
                  )}
                  {msg.role === 'assistant' && <SpeakButton text={msg.content} />}
                </div>
                <span className="chatbot-bubble-time">
                  {msg.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
            {loading && (
              <div className="chatbot-bubble assistant">
                <div className="chatbot-bubble-content">
                  <div className="chatbot-typing"><span /><span /><span /></div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Interim speech text indicator */}
          {interimText && (
            <div className="chatbot-interim">
              <span className="chatbot-interim-dot" /> {interimText}
            </div>
          )}

          {/* Input Bar */}
          <div className="chatbot-input-bar">
            <button onClick={clearChat} className="chatbot-action-btn" title="Clear chat">🗑️</button>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? 'Listening...' : (t.aiTypeMessage || 'Type your message...')}
              className="chatbot-input"
              disabled={loading || isListening}
            />
            {hasSpeechRecognition && (
              <button
                onClick={isListening ? stopListening : startListening}
                className={`chatbot-mic-btn ${isListening ? 'listening' : ''}`}
                title={isListening ? 'Stop listening' : 'Speak'}
                disabled={loading}
              >
                {isListening ? '⏹️' : '🎙️'}
              </button>
            )}
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              className="chatbot-send-btn"
            >
              {loading ? '⏳' : '➤'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
