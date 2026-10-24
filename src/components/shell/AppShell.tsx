import React, { useState } from 'react';
import { Sidebar, AppRoute } from './Sidebar';
import { Header, TelemetryEvent } from './Header';
import { Currency } from '../../types';

interface AppShellProps {
  currentRoute: AppRoute;
  onRouteChange: (route: AppRoute) => void;
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
  onOpenAssistant: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentRoute,
  onRouteChange,
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
  onOpenAssistant,
  children,
}) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:pl-64">
      {/* 256px Sidebar */}
      <Sidebar
        currentRoute={currentRoute}
        onRouteChange={onRouteChange}
        solverOnline={solverOnline}
        solveMs={solveMs}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Workspace Frame */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Sticky Header */}
        <Header
          currency={currency}
          onCurrencyChange={onCurrencyChange}
          datasetName={datasetName}
          zoneCount={zoneCount}
          candidateCount={candidateCount}
          onSelectBengaluruDemo={onSelectBengaluruDemo}
          onTriggerCsvUpload={onTriggerCsvUpload}
          solverOnline={solverOnline}
          solveMs={solveMs}
          onRetrySolverHealth={onRetrySolverHealth}
          onApplyPreset={onApplyPreset}
          onRunOptimizer={onRunOptimizer}
          isSolving={isSolving}
          events={events}
          onResetDemoData={onResetDemoData}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onOpenAssistant={onOpenAssistant}
        />

        {/* Scrollable Main Region (Never cut off mid-page, no bottom background gap) */}
        <main className="flex-1 pb-16">
          {children}
        </main>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Workspace Settings</h3>
            <div className="text-xs text-slate-600 space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span>Default Canonical Currency</span>
                <span className="font-semibold text-slate-900">{currency}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span>Solver Timeout Watchdog</span>
                <span className="font-semibold text-slate-900">5.0 seconds</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span>Live Solver Mode</span>
                <span className="font-semibold text-slate-900">Exact CFLP Web Worker + CBC Verifier</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span>Distance Routing</span>
                <span className="font-semibold text-slate-900">OSRM Road Network Matrix</span>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
