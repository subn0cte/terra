import React, { useState } from 'react';
import { Country } from '../data/countries';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface CountryOutlineProps {
  country: Country;
  revealed?: boolean;
}

export const CountryOutline: React.FC<CountryOutlineProps> = ({
  country,
  revealed = false,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [invert, setInvert] = useState<boolean>(false);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 2.0));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.75));
  const handleResetZoom = () => setZoom(1);

  return (
    <div className="relative w-full aspect-square max-w-[340px] sm:max-w-[400px] mx-auto bg-[#090a0c] border border-zinc-800 rounded-none sm:rounded-md flex items-center justify-center p-6 overflow-hidden select-none group">
      {/* Background coordinate grid lines - subtle cartographic feel */}
      <div 
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Crosshairs in corners */}
      <div className="absolute top-2 left-2 text-[10px] font-mono text-zinc-700 pointer-events-none select-none">
        +
      </div>
      <div className="absolute top-2 right-2 text-[10px] font-mono text-zinc-700 pointer-events-none select-none">
        +
      </div>
      <div className="absolute bottom-2 left-2 text-[10px] font-mono text-zinc-700 pointer-events-none select-none">
        +
      </div>
      <div className="absolute bottom-2 right-2 text-[10px] font-mono text-zinc-700 pointer-events-none select-none">
        +
      </div>

      {/* SVG Outline */}
      <div 
        className="w-full h-full flex items-center justify-center transition-transform duration-200 ease-out"
        style={{ transform: `scale(${zoom})` }}
      >
        <svg
          viewBox={country.viewBox}
          className="w-full h-full max-h-[300px] transition-all duration-300 filter drop-shadow-[0_0_12px_rgba(255,255,255,0.08)]"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={revealed ? country.name : 'mystery country silhouette'}
        >
          {/* Subtle glow / border path */}
          <path
            d={country.path}
            fill={invert ? 'none' : '#f4f4f5'}
            stroke={invert ? '#f4f4f5' : '#27272a'}
            strokeWidth={invert ? '3' : '1.5'}
            strokeLinejoin="round"
            strokeLinecap="round"
            className="transition-colors duration-300"
          />
        </svg>
      </div>

      {/* Micro controls at bottom right */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-[#121316]/90 border border-zinc-800/80 rounded px-1.5 py-1 text-zinc-400 opacity-70 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setInvert(!invert)}
          title="toggle stroke / fill"
          className="px-1.5 py-0.5 text-[10px] font-mono hover:text-white transition-colors"
        >
          {invert ? 'fill' : 'line'}
        </button>
        <span className="text-zinc-700">·</span>
        <button
          onClick={handleZoomOut}
          disabled={zoom <= 0.75}
          title="zoom out"
          className="p-1 hover:text-white disabled:opacity-30 transition-colors"
          aria-label="zoom out"
        >
          <ZoomOut size={13} />
        </button>
        <button
          onClick={handleResetZoom}
          title="reset zoom"
          className="p-1 hover:text-white transition-colors"
          aria-label="reset zoom"
        >
          <RotateCcw size={12} />
        </button>
        <button
          onClick={handleZoomIn}
          disabled={zoom >= 2.0}
          title="zoom in"
          className="p-1 hover:text-white disabled:opacity-30 transition-colors"
          aria-label="zoom in"
        >
          <ZoomIn size={13} />
        </button>
      </div>

      {/* Country label if revealed */}
      {revealed && (
        <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/80 px-2.5 py-1 border border-zinc-800 rounded">
          <span className="text-base">{country.flagEmoji}</span>
          <span className="text-xs font-mono font-medium text-white lowercase">
            {country.name}
          </span>
        </div>
      )}
    </div>
  );
};
