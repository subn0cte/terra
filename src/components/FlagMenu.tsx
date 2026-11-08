import React, { useState, useMemo } from 'react';
import { COUNTRIES, Country } from '../data/countries';
import { Search, X } from 'lucide-react';

interface FlagMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFlag: (country: Country) => void;
  disabled?: boolean;
}

export const FlagMenu: React.FC<FlagMenuProps> = ({
  isOpen,
  onClose,
  onSelectFlag,
  disabled = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Sorted list of countries
  const sortedCountries = useMemo(() => {
    return [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const filteredCountries = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return sortedCountries;
    return sortedCountries.filter((c) => c.name.toLowerCase().includes(q));
  }, [searchTerm, sortedCountries]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div 
        className="w-full max-w-lg bg-[#111215] border border-zinc-800 rounded-none sm:rounded-lg shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider block">select flag</span>
            <span className="text-sm font-medium text-zinc-200">find flag by country name</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 rounded-md transition-colors"
            aria-label="close flag menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-zinc-800/80 bg-zinc-900/30">
          <div className="relative flex items-center">
            <Search size={16} className="absolute left-3 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="type country name (e.g. france, japan, brazil)..."
              className="w-full pl-9 pr-4 py-2.5 bg-[#090a0c] border border-zinc-800 rounded-md text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 font-mono"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 text-xs text-zinc-500 hover:text-zinc-300"
              >
                clear
              </button>
            )}
          </div>
        </div>

        {/* Countries List */}
        <div className="overflow-y-auto p-3 divide-y divide-zinc-900 flex-1">
          {filteredCountries.length === 0 ? (
            <div className="py-12 text-center text-sm font-mono text-zinc-500">
              no countries matched &ldquo;{searchTerm}&rdquo;
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {filteredCountries.map((c) => (
                <button
                  key={c.id}
                  disabled={disabled}
                  onClick={() => {
                    onSelectFlag(c);
                    onClose();
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 text-left rounded-md hover:bg-zinc-800/70 border border-transparent hover:border-zinc-700/50 transition-all text-zinc-300 hover:text-white group"
                >
                  <span className="text-2xl leading-none select-none shrink-0 drop-shadow-sm">
                    {c.flagEmoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-mono lowercase block truncate group-hover:text-white">
                      {c.name}
                    </span>
                    <span className="text-[11px] font-mono text-zinc-500 block truncate lowercase">
                      {c.continent}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-800/80 bg-zinc-900/20 text-xs font-mono text-zinc-500 flex items-center justify-between">
          <span>{filteredCountries.length} countries</span>
          <span>esc or click outside to dismiss</span>
        </div>
      </div>
    </div>
  );
};
