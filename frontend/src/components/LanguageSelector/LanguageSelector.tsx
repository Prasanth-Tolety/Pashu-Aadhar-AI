import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import './LanguageSelector.css';

interface Props {
  compact?: boolean;
}

export default function LanguageSelector({ compact = false }: Props) {
  const { language, setLanguage, languages, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = languages.find((l) => l.code === language)!;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className={`lang-selector ${compact ? 'lang-compact' : ''}`} ref={ref}>
      <button
        className="lang-trigger"
        onClick={() => setOpen(!open)}
        title={t.selectLanguage}
        aria-label={t.selectLanguage}
      >
        <span className="lang-icon">🌐</span>
        <span className="lang-current">{current.label}</span>
        <span className="lang-arrow">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="lang-dropdown">
          {languages.map((lang) => (
            <button
              key={lang.code}
              className={`lang-option ${lang.code === language ? 'lang-active' : ''}`}
              onClick={() => {
                setLanguage(lang.code);
                setOpen(false);
              }}
            >
              <span className="lang-option-label">{lang.label}</span>
              <span className="lang-option-en">{lang.labelEn}</span>
              {lang.code === language && <span className="lang-check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
