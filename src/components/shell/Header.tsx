import React, { useState, useRef, useEffect } from 'react';
import { Currency } from '../../types';
import { Z_CLASSES } from '../../config/zIndexTokens';
import {
  Menu,
  Database,
  Layers,
  Play,
  Bell,
  User,
  RefreshCw,
  Upload,
  Info,
  Sparkles,
} from 'lucide-react';

export interface TelemetryEvent {
  id: string;
  type: 'solve' | 'verify' | 'stale' | 'error' | 'osrm';
  title: string;
  detail: string;
  timestamp: string;
}

interface HeaderProps {
  currency: Currency;
  onCurrencyChange: (c: Currency) => void;
  datasetName: string;
  zoneCount: number;
  candidateCount: number;
  onSelectBengaluruDemo: () => void;
  onTriggerCsvUpload: () => void;
  solverOnline: boolean;
  solveMs: number | null;
  onRetrySolverHealth: () => void;
  onApplyPreset: (presetKey: string) => void;
  onRunOptimizer: () => void;
  isSolving: boolean;
  events: TelemetryEvent[];
  onResetDemoData: () => void;
  onOpenMobileSidebar: () => void;
  onOpenAssistant: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currency,
  onCurrencyChange,
  datasetName,
  zoneCount,
  candidateCount,
  onSelectBengaluruDemo,
  onTriggerCsvUpload,
  solverOnline,
  solveMs,
  onRetrySolverHealth,
  onApplyPreset,
  onRunOptimizer,
  isSolving,
  events,
  onResetDemoData,
  onOpenMobileSidebar,
  onOpenAssistant,
}) => {
  // Dropdown states
  const [isDatasetOpen, setIsDatasetOpen] = useState(false);
  const [isPresetOpen, setIsPresetOpen] = useState(false);
  const [isEventsOpen, setIsEventsOpen] = useState(false);
  const [isAvatarOpen, setIsAvatarOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  // Close menus on outside click
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsDatasetOpen(false);
        setIsPresetOpen(false);
        setIsEventsOpen(false);
        setIsAvatarOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Built-in Presets
  const PRESETS = [
    { key: 'cost', title: 'Cost Focus (Lean)', desc: '2-3 consolidated hubs, 6,000 cap, min fixed leases' },
    { key: 'speed', title: 'Quick-Commerce Express', desc: '4-5 micro-hubs, 3,500 cap, <12 km SLA' },
    { key: 'sustainability', title: 'Low-CO2 Green Corridors', desc: 'EV-preference routes with internalized carbon penalty' },
    { key: 'surge', title: 'Festival Surge Capacity', desc: 'Higher throughput caps with high-density fulfillment' },
  ];

  return (
    <header
      ref={containerRef}
      className={`sticky top-0 ${Z_CLASSES.stickyHeader} flex h-16 w-full items-center justify-between border-b border-[#E2E8F0] bg-white px-4 sm:px-6 shadow-xs`}
    >
      {/* Left: Mobile Menu Toggle & Chips */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="md:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
          aria-label="Open Navigation Menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Dataset Chip with Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setIsDatasetOpen((prev) => !prev);
              setIsPresetOpen(false);
              setIsEventsOpen(false);
              setIsAvatarOpen(false);
            }}
            className="flex items-center gap-2 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] px-3 py-1.5 text-xs font-semibold text-[#1E40AF] hover:bg-[#DBEAFE] transition whitespace-nowrap min-w-0"
          >
            <Database className="h-3.5 w-3.5 text-[#2563EB] shrink-0" />
            <span className="truncate max-w-[140px] sm:max-w-[200px]">{datasetName}</span>
            <span className="text-[11px] text-[#3B82F6] font-normal shrink-0">
              • {zoneCount} Zones / {candidateCount} Hubs
            </span>
          </button>

          {isDatasetOpen && (
            <div className="absolute left-0 mt-1.5 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-50 animate-in fade-in-50 zoom-in-95">
              <div className="px-2 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                Active Dataset Source
              </div>
              <button
                type="button"
                onClick={() => {
                  onSelectBengaluruDemo();
                  setIsDatasetOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <div className="h-2 w-2 rounded-full bg-blue-600" />
                <div>
                  <div className="font-semibold text-slate-900">Bengaluru Metro Demo</div>
                  <div className="text-[11px] text-slate-500">36 delivery zones • 6 candidates</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  onTriggerCsvUpload();
                  setIsDatasetOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Upload className="h-3.5 w-3.5 text-blue-600" />
                <div>
                  <div className="font-semibold text-slate-900">Upload Custom CSV...</div>
                  <div className="text-[11px] text-slate-500">Demand centroids with coordinates</div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Solver Telemetry Chip */}
        <div className="hidden sm:flex items-center gap-2 rounded-lg bg-[#F1F5F9] border border-[#CBD5E1] px-3 py-1.5 text-xs font-semibold text-[#334155] whitespace-nowrap">
          <span
            className={`h-2 w-2 rounded-full shrink-0 ${
              solverOnline ? 'bg-emerald-500 ring-2 ring-emerald-100' : 'bg-rose-500'
            }`}
          />
          <span className="truncate">
            Solver: {solverOnline ? 'CBC Online' : 'Offline'}
          </span>
          {solveMs !== null && (
            <span className="text-[11px] font-mono text-slate-500 shrink-0">
              • {solveMs}ms
            </span>
          )}
          {!solverOnline && (
            <button
              type="button"
              onClick={onRetrySolverHealth}
              className="ml-1 text-[11px] text-blue-600 hover:underline font-bold"
            >
              Retry
            </button>
          )}
        </div>
      </div>

      {/* Right: Currency Toggle, Load Preset, Run Optimizer, Bell, Avatar */}
      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
        {/* Logistics Assistant Trigger */}
        <button
          type="button"
          onClick={onOpenAssistant}
          className="hidden lg:flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition whitespace-nowrap"
        >
          <Sparkles className="h-3.5 w-3.5 text-blue-600" />
          <span>Assistant</span>
        </button>

        {/* Currency Pill Toggle (₹ INR | $ USD) */}
        <div
          role="radiogroup"
          aria-label="Currency Selection"
          className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5"
        >
          <button
            type="button"
            role="radio"
            aria-checked={currency === 'INR'}
            onClick={() => onCurrencyChange('INR')}
            className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${
              currency === 'INR'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ₹ INR
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={currency === 'USD'}
            onClick={() => onCurrencyChange('USD')}
            className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${
              currency === 'USD'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            $ USD
          </button>
        </div>

        {/* Load Preset Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setIsPresetOpen((prev) => !prev);
              setIsDatasetOpen(false);
              setIsEventsOpen(false);
              setIsAvatarOpen(false);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-xs whitespace-nowrap"
          >
            <Layers className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden sm:inline">Load Preset</span>
          </button>

          {isPresetOpen && (
            <div className="absolute right-0 mt-1.5 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-50 animate-in fade-in-50 zoom-in-95">
              <div className="px-2 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                Operational Presets
              </div>
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    onApplyPreset(p.key);
                    setIsPresetOpen(false);
                  }}
                  className="flex w-full flex-col rounded-lg px-2.5 py-2 text-left text-xs hover:bg-blue-50 transition"
                >
                  <span className="font-semibold text-slate-900">{p.title}</span>
                  <span className="text-[11px] text-slate-500 mt-0.5">{p.desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Run Optimizer Primary Button */}
        <button
          type="button"
          onClick={onRunOptimizer}
          disabled={isSolving}
          className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-bold text-white transition shadow-sm whitespace-nowrap ${
            isSolving
              ? 'bg-blue-400 cursor-not-allowed'
              : 'bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.98]'
          }`}
        >
          {isSolving ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>Solving...</span>
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Run Optimizer</span>
            </>
          )}
        </button>

        {/* Notification Bell (Real Operational Event Log) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setIsEventsOpen((prev) => !prev);
              setIsDatasetOpen(false);
              setIsPresetOpen(false);
              setIsAvatarOpen(false);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
            aria-label="Operational Notifications"
          >
            <Bell className="h-4 w-4" />
          </button>

          {isEventsOpen && (
            <div className="absolute right-0 mt-1.5 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-xl z-50 animate-in fade-in-50 zoom-in-95">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-900">System Activity & Events</span>
                <span className="text-[10px] font-semibold text-blue-600">{events.length} logged</span>
              </div>
              <div className="mt-2 max-h-64 overflow-y-auto space-y-2">
                {events.length === 0 ? (
                  <div className="py-4 text-center text-xs text-slate-400">
                    No events recorded yet in this session.
                  </div>
                ) : (
                  events.map((evt) => (
                    <div key={evt.id} className="rounded-lg bg-slate-50 p-2 text-xs border border-slate-100">
                      <div className="flex items-center justify-between font-semibold text-slate-800">
                        <span>{evt.title}</span>
                        <span className="text-[10px] text-slate-400 font-normal">{evt.timestamp}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{evt.detail}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Avatar Menu (Reset Demo Data, Privacy, About) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setIsAvatarOpen((prev) => !prev);
              setIsDatasetOpen(false);
              setIsPresetOpen(false);
              setIsEventsOpen(false);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0F172A] text-white hover:ring-2 hover:ring-slate-300 transition"
            aria-label="User Workspace Menu"
          >
            <User className="h-4 w-4" />
          </button>

          {isAvatarOpen && (
            <div className="absolute right-0 mt-1.5 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl z-50 animate-in fade-in-50 zoom-in-95">
              <div className="px-3 py-2 border-b border-slate-100">
                <div className="text-xs font-bold text-slate-900">Operations Console</div>
                <div className="text-[11px] text-slate-500">Workspace Session Active</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onResetDemoData();
                  setIsAvatarOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-red-50 hover:text-red-700 transition"
              >
                <RefreshCw className="h-3.5 w-3.5 text-red-500" />
                <span>Reset Demo Data</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPrivacyOpen(true);
                  setIsAvatarOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Info className="h-3.5 w-3.5 text-slate-500" />
                <span>Data Sources & Privacy</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAboutOpen(true);
                  setIsAvatarOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Sparkles className="h-3.5 w-3.5 text-slate-500" />
                <span>About GridPoint</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Privacy Dialog */}
      {isPrivacyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Data Sources & Privacy</h3>
            <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <p>• <strong>Geocoding:</strong> Powered by Photon (Komoot) using OpenStreetMap data.</p>
              <p>• <strong>Distance Routing:</strong> OSRM (Project OSRM) open road-network routing matrix.</p>
              <p>• <strong>Optimization:</strong> COIN-OR CBC Mixed-Integer Linear Programming Solver via PuLP and exact in-browser Web Worker.</p>
              <p>• <strong>Privacy:</strong> No proprietary customer coordinates or commercial tokens are persisted externally.</p>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsPrivacyOpen(false)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* About Dialog */}
      {isAboutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">About GridPoint</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              GridPoint is a B2B logistics network intelligence platform combining exact Capacitated Facility Location Problem (CFLP) mathematical optimization with real-world road networks and live interactive GIS visualization.
            </p>
            <div className="text-[11px] text-slate-400">Version 2.0.0 • Clean TypeScript Architecture</div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsAboutOpen(false)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
