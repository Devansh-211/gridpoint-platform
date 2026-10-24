import React from 'react';

interface HeadroomBarProps {
  totalCapacity: number;
  totalDemand: number;
  headroomOrders: number;
  headroomPct: number;
}

export const HeadroomBar: React.FC<HeadroomBarProps> = ({
  totalCapacity,
  totalDemand,
  headroomOrders,
  headroomPct,
}) => {
  const utilizationPct = totalCapacity > 0 ? (totalDemand / totalCapacity) * 100 : 0;
  const isOverCapacity = utilizationPct > 100;

  // Color states:
  // emerald < 80%, amber 80-95%, red > 95%, distinct "Infeasible: demand exceeds capacity" > 100%
  let barColorClass = 'bg-emerald-500';
  let badgeColorClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  let statusText = `Net Capacity Headroom: ${Math.round(headroomOrders).toLocaleString()} orders/day (${headroomPct.toFixed(1)}% buffer)`;

  if (isOverCapacity) {
    barColorClass = 'bg-red-600 bg-stripes';
    badgeColorClass = 'bg-red-50 text-red-800 border-red-300 font-bold';
    statusText = `Infeasible: demand exceeds capacity (${Math.round(Math.abs(headroomOrders)).toLocaleString()} orders deficit)`;
  } else if (utilizationPct > 95) {
    barColorClass = 'bg-red-500';
    badgeColorClass = 'bg-red-50 text-red-800 border-red-200';
  } else if (utilizationPct >= 80) {
    barColorClass = 'bg-amber-500';
    badgeColorClass = 'bg-amber-50 text-amber-800 border-amber-200';
  }

  const clampedWidth = Math.min(100, Math.max(0, utilizationPct));

  return (
    <div className="rounded-xl border border-gp-border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gp-text-tertiary">
              Capacity Utilization & System Throughput
            </span>
            <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${badgeColorClass}`}>
              {statusText}
            </span>
          </div>
          <div className="mt-1 text-sm font-semibold text-gp-text-primary">
            Total Demand: <span className="font-bold">{Math.round(totalDemand).toLocaleString()}</span> orders/day vs{' '}
            Total Throughput Capacity: <span className="font-bold">{Math.round(totalCapacity).toLocaleString()}</span> orders/day
          </div>
        </div>

        <div className="text-right text-xs font-bold tabular-nums text-gp-text-primary">
          {utilizationPct.toFixed(1)}% Allocated
        </div>
      </div>

      {/* Progress Bar Container */}
      <div className="mt-3 relative h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          role="progressbar"
          aria-valuenow={Math.round(utilizationPct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="System capacity utilization"
          style={{ width: `${clampedWidth}%` }}
          className={`h-full rounded-full transition-all duration-500 ease-out ${barColorClass}`}
        />
      </div>

      {/* Reference markers */}
      <div className="mt-1.5 flex justify-between text-[10px] text-gp-text-tertiary">
        <span>0%</span>
        <span>80% (Safe Target)</span>
        <span>95% (Critical Warning)</span>
        <span>100% (Ceiling)</span>
      </div>
    </div>
  );
};
