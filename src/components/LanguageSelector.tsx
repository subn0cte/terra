import React, { useState, useRef, useEffect } from 'react';
import { COMMON_LANGUAGES } from '../data/countries';
import { Check, X, Search } from 'lucide-react';

interface LanguageSelectorProps {
  onGuessLanguage: (language: string) => void;
  disabled?: boolean;
  solvedLanguage?: string | null;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  onGuessLanguage,
  disabled = false,
  solvedLanguage,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = COMMON_LANGUAGES.filter((lang) =>
    lang.toLowerCase().includes(query.toLowerCase().trim())
  ).slice(0, 8);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (lang: string) => {
    if (!lang || disabled) return;
    onGuessLanguage(lang.toLowerCase().trim());
    setQuery('');
    setIsOpen(false);
  };

  if (solvedLanguage) {
    return (
      <div className="flex items-center justify-between p-3 bg-emerald-950/20 border border-emerald-900/40 rounded text-emerald-400 font-mono text-xs">
        <div className="flex items-center gap-2">
          <Check size={14} className="text-emerald-400" />
          <span>language: {solvedLanguage}</span>
        </div>
        <span className="text-emerald-500 font-semibold">+1000</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            disabled={disabled}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim()) {
                e.preventDefault();
                handleSubmit(query);
              }
            }}
            placeholder="type official language..."
            className="w-full pl-9 pr-3 py-2 bg-[#090a0c] border border-zinc-800 rounded text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 lowercase disabled:opacity-50"
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                setIsOpen(false);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              <X size={12} />
            </button>
          )}
        </div>
        <button
          onClick={() => handleSubmit(query)}
          disabled={!query.trim() || disabled}
          className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-xs font-mono text-zinc-200 rounded transition-colors whitespace-nowrap lowercase"
        >
          submit
        </button>
      </div>

      {/* Autocomplete dropdown */}
      {isOpen && query.trim() && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#121316] border border-zinc-800 rounded shadow-xl z-30 max-h-48 overflow-y-auto">
          {filtered.map((lang) => (
            <button
              key={lang}
              onClick={() => handleSubmit(lang)}
              className="w-full text-left px-3 py-2 text-xs font-mono text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors lowercase border-b border-zinc-800/40 last:border-0"
            >
              {lang}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
