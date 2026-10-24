import React from 'react';
import {
  LayoutDashboard,
  Map,
  Sliders,
  Cpu,
  FlaskConical,
  Truck,
  Settings,
  X,
} from 'lucide-react';

export type AppRoute = 'overview' | 'map' | 'config' | 'solvers' | 'scenarios' | 'fleet';

interface SidebarProps {
  currentRoute: AppRoute;
  onRouteChange: (route: AppRoute) => void;
  solverOnline: boolean;
  solveMs: number | null;
  onOpenSettings: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  id: AppRoute;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hash: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, hash: '#/overview' },
  { id: 'map', label: 'Demand Map', icon: Map, hash: '#/map' },
  { id: 'config', label: 'Network Configuration', icon: Sliders, hash: '#/config' },
  { id: 'solvers', label: 'Optimization & Solvers', icon: Cpu, hash: '#/solvers' },
  { id: 'scenarios', label: 'Scenario Lab', icon: FlaskConical, hash: '#/scenarios' },
  { id: 'fleet', label: 'Tactical Fleet', icon: Truck, hash: '#/fleet' },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentRoute,
  onRouteChange,
  solverOnline,
  solveMs,
  onOpenSettings,
  isMobileOpen,
  onCloseMobile,
}) => {
  const handleNavClick = (id: AppRoute, hash: string, e: React.MouseEvent) => {
    e.preventDefault();
    window.location.hash = hash;
    onRouteChange(id);
    onCloseMobile();
  };

  const navContent = (
    <div className="flex h-full flex-col justify-between bg-[#F8FAFC] border-r border-[#E2E8F0]">
      {/* Brand & Workspace Section */}
      <div className="flex flex-col">
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-[#E2E8F0]">
          <a
            href="#/overview"
            onClick={(e) => handleNavClick('overview', '#/overview', e)}
            className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0F172A] text-white shadow-sm">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="6" cy="6" r="2.5" />
                <circle cx="18" cy="6" r="2.5" />
                <circle cx="12" cy="18" r="2.5" />
                <path d="M7.8 7.8L16.2 16.2M16.2 7.8L7.8 16.2" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-bold tracking-tight text-[#0F172A]">GRIDPOINT</span>
              <span className="text-[9.5px] font-semibold uppercase tracking-wider text-[#64748B]">
                LOGISTICS INTELLIGENCE
              </span>
            </div>
          </a>

          {/* Mobile close button */}
          <button
            type="button"
            onClick={onCloseMobile}
            className="md:hidden p-1.5 text-slate-500 hover:text-slate-800 rounded-md"
            aria-label="Close Sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
            Core Workspace
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = currentRoute === item.id;
            return (
              <a
                key={item.id}
                href={item.hash}
                onClick={(e) => handleNavClick(item.id, item.hash, e)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all ${
                  isActive
                    ? 'bg-[#0F172A] text-white shadow-sm'
                    : 'text-[#475569] hover:bg-[#EDF2F7] hover:text-[#0F172A]'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-[#64748B]'}`} />
                <span className="truncate">{item.label}</span>
              </a>
            );
          })}
        </div>
      </div>

      {/* Sidebar Footer: Settings & Engine Status */}
      <div className="p-3 border-t border-[#E2E8F0] space-y-2">
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex w-full items-center gap-3 px-3 py-2 text-[12.5px] font-medium text-[#475569] rounded-lg hover:bg-[#EDF2F7] transition"
        >
          <Settings className="h-4 w-4 text-[#64748B]" />
          <span>Settings</span>
        </button>

        {/* Real Live Solver Status (No fake uptime numbers) */}
        <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 border border-[#E2E8F0] text-[11px] font-medium shadow-xs">
          <div className="flex items-center gap-2 truncate">
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${
                solverOnline ? 'bg-emerald-500 ring-2 ring-emerald-100' : 'bg-amber-500 ring-2 ring-amber-100'
              }`}
            />
            <span className="truncate text-[#334155]">
              {solverOnline ? 'Cloud Engine v4.2' : 'Solver Offline'}
            </span>
          </div>
          <span className="shrink-0 text-[10.5px] font-bold text-[#64748B] tabular-nums">
            {solveMs !== null ? `${solveMs}ms` : 'CBC Online'}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed 256px Sidebar */}
      <aside className="hidden md:flex fixed top-0 left-0 bottom-0 z-30 w-64 flex-col">
        {navContent}
      </aside>

      {/* Mobile Drawer (with backdrop) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative flex w-64 max-w-xs flex-1 flex-col shadow-2xl">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
};
