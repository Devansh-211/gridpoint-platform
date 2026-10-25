import React from 'react';
import { Navigation2, AlertCircle, Compass } from 'lucide-react';
import { OsrmMatrixResult } from '../services/osrmMatrixService';

interface RoutingStatusBadgeProps {
  matrixResult: OsrmMatrixResult | null;
}

export const RoutingStatusBadge: React.FC<RoutingStatusBadgeProps> = ({ matrixResult }) => {
  if (!matrixResult) {
    return (
      <div
        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-xs"
        title="Routing status initializing..."
      >
        <Compass className="h-3.5 w-3.5 animate-spin text-slate-400 shrink-0" />
        <span className="hidden sm:inline">Routing Initializing...</span>
        <span className="inline sm:hidden">Routing...</span>
      </div>
    );
  }

  const tooltipText = `ETAs are free-flow driving times. Avg road/straight ratio ${matrixResult.avgDetourRatio.toFixed(2)}x. (${matrixResult.osrmCount} road pairs, ${matrixResult.estimatedCount} estimated).`;

  if (matrixResult.status === 'all_road') {
    return (
      <div
        className="group relative inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/80 px-2.5 py-1 text-[11px] font-semibold text-blue-800 shadow-xs cursor-help transition-all hover:bg-blue-100"
        title={tooltipText}
        id="badgeRoutingStatus"
      >
        <Navigation2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
        <span className="hidden sm:inline">OSRM Live Street Network (Actual Driving km & ETA)</span>
        <span className="inline sm:hidden">OSRM Live</span>
      </div>
    );
  }

  if (matrixResult.status === 'mixed') {
    return (
      <div
        className="group relative inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/80 px-2.5 py-1 text-[11px] font-semibold text-amber-800 shadow-xs cursor-help transition-all hover:bg-amber-100"
        title={tooltipText}
        id="badgeRoutingStatus"
      >
        <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
        <span className="hidden sm:inline">Mixed: OSRM + {matrixResult.estimatedCount} estimated</span>
        <span className="inline sm:hidden">Mixed ({matrixResult.estimatedCount})</span>
      </div>
    );
  }

  return (
    <div
      className="group relative inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100/90 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-xs cursor-help transition-all hover:bg-slate-200"
      title={tooltipText}
      id="badgeRoutingStatus"
    >
      <Compass className="h-3.5 w-3.5 text-slate-500 shrink-0" />
      <span className="hidden sm:inline">Haversine Geodesic (offline fallback)</span>
      <span className="inline sm:hidden">Haversine</span>
    </div>
  );
};
