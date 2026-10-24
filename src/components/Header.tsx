import React from 'react';
import { Currency } from '../types';
import { Activity, HelpCircle } from 'lucide-react';

interface HeaderProps {
  currency: Currency;
  onCurrencyChange: (c: Currency) => void;
  solverStatus: string;
  solveMs: number | null;
  isCached: boolean;
  mipGap?: number | null;
  onToggleWhy: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currency,
  onCurrencyChange,
  solverStatus,
  solveMs,
  isCached,
  mipGap,
  onToggleWhy,
}) => {
  const inrRef = React.useRef<HTMLButtonElement>(null);
  const usdRef = React.useRef<HTMLButtonElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      onCurrencyChange('USD');
      usdRef.current?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      onCurrencyChange('INR');
      inrRef.current?.focus();
    }
  };

  const latencyDisplay = solveMs !== null ? `${Math.round(solveMs)} ms` : '—';
  const solverBadgeText = `Solver: ${solverStatus} • ${latencyDisplay}${isCached ? ' (cached)' : ''}`;
  const solverTooltip = `Status: ${solverStatus} | Latency: ${latencyDisplay} | MIP Gap: ${
    mipGap !== null && mipGap !== undefined ? `${(mipGap * 100).toFixed(2)}%` : '0.00% (proven optimal)'
  }`;

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-gp-border bg-white/95 px-4 backdrop-blur sm:px-6">
      {/* Left: Brand & Breadcrumb */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gp-primary-500 text-white shadow-sm">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-tight text-gp-text-primary">GRIDPOINT</span>
              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-gp-primary-600">
                v2.0
              </span>
            </div>
            <div className="text-[11px] text-gp-text-tertiary">B2B Network Optimizer</div>
          </div>
        </div>

        <div className="hidden h-5 w-px bg-gp-border md:block" />

        <div className="hidden items-center text-xs text-gp-text-secondary md:flex">
          <span className="font-medium text-gp-text-primary">Bengaluru Logistics Network (36 Zones)</span>
        </div>
      </div>

      {/* Right: Why GridPoint trigger + Solver Badge + Currency Toggle */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Why GridPoint pill */}
        <button
          onClick={onToggleWhy}
          className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/70 px-3 py-1 text-xs font-semibold text-gp-primary-700 transition hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          title="Open why GridPoint comparison"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          <span>Why GridPoint?</span>
        </button>

        {/* Solver status & latency badge */}
        <div
          className="group relative flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50/80 px-2.5 py-1 text-xs font-medium text-emerald-800"
          title={solverTooltip}
        >
          <Activity className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
          <span className="font-semibold">{solverBadgeText}</span>
        </div>

        {/* Segmented Pill Currency Toggle: immediately right of solver status badge */}
        <div
          role="radiogroup"
          aria-label="Currency display selector"
          onKeyDown={handleKeyDown}
          className="inline-flex rounded-lg border border-gp-border bg-gp-sunken p-0.5 text-xs font-medium"
        >
          <button
            ref={inrRef}
            type="button"
            role="radio"
            aria-checked={currency === 'INR'}
            tabIndex={currency === 'INR' ? 0 : -1}
            onClick={() => onCurrencyChange('INR')}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              currency === 'INR'
                ? 'bg-white font-bold text-gp-primary-700 shadow-sm'
                : 'text-gp-text-secondary hover:text-gp-text-primary'
            }`}
          >
            <span>₹</span>
            <span>INR</span>
          </button>
          <button
            ref={usdRef}
            type="button"
            role="radio"
            aria-checked={currency === 'USD'}
            tabIndex={currency === 'USD' ? 0 : -1}
            onClick={() => onCurrencyChange('USD')}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              currency === 'USD'
                ? 'bg-white font-bold text-gp-primary-700 shadow-sm'
                : 'text-gp-text-secondary hover:text-gp-text-primary'
            }`}
          >
            <span>$</span>
            <span>USD</span>
          </button>
        </div>
      </div>
    </header>
  );
};
