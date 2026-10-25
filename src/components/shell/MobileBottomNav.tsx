import React from 'react';
import {
  LayoutDashboard,
  Map,
  Sliders,
  Cpu,
  FlaskConical,
  Menu,
} from 'lucide-react';
import { AppRoute } from './Sidebar';

interface MobileBottomNavProps {
  currentRoute: AppRoute;
  onRouteChange: (route: AppRoute) => void;
  onOpenMobileSidebar: () => void;
}

interface BottomNavItem {
  id: AppRoute;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const BOTTOM_ITEMS: BottomNavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'map', label: 'Map', icon: Map },
  { id: 'config', label: 'Network', icon: Sliders },
  { id: 'solvers', label: 'Solvers', icon: Cpu },
  { id: 'scenarios', label: 'Scenarios', icon: FlaskConical },
];

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentRoute,
  onRouteChange,
  onOpenMobileSidebar,
}) => {
  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-1 py-1 flex items-center justify-around shadow-lg select-none"
    >
      {BOTTOM_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = currentRoute === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onRouteChange(item.id)}
            className={`flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-xl transition-all duration-150 active:scale-95 min-h-[48px] ${
              isActive
                ? 'text-blue-600 font-bold bg-blue-50/70'
                : 'text-slate-500 font-medium hover:text-slate-800'
            }`}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon className={`h-4.5 w-4.5 transition-transform ${isActive ? 'scale-110' : ''}`} />
            <span className="text-[10px] mt-1 tracking-tight leading-none whitespace-nowrap">
              {item.label}
            </span>
          </button>
        );
      })}

      {/* More / Menu Drawer Trigger */}
      <button
        type="button"
        onClick={onOpenMobileSidebar}
        className="flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-xl text-slate-500 font-medium hover:text-slate-800 active:scale-95 transition-all min-h-[48px]"
        aria-label="Open More Menu"
      >
        <Menu className="h-4.5 w-4.5" />
        <span className="text-[10px] mt-1 tracking-tight leading-none whitespace-nowrap">
          More
        </span>
      </button>
    </nav>
  );
};
