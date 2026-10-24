import React, { useState } from 'react';
import { PageHeader } from '../shell/PageHeader';
import { Hero } from '../Hero';
import { KpiCards } from '../KpiCards';
import { HeadroomBar } from '../HeadroomBar';
import { TopologyDiffBanner } from '../TopologyDiffBanner';
import {
  Currency,
  OptimizeResponse,
  CompareResponse,
} from '../../types';
import { TopologyDiff } from '../../lib/networkState';
import {
  Map,
  Sliders,
  Play,
  Building2,
  Truck,
  ArrowRight,
} from 'lucide-react';

interface OverviewViewProps {
  currency: Currency;
  optimizeData: OptimizeResponse | null;
  compareData: CompareResponse | null;
  isLoading: boolean;
  solveMs: number | null;
  topologyDiff: TopologyDiff | null;
  onClearTopologyDiff: () => void;
  onRunOptimizer: () => void;
  isSolving: boolean;
  isStale: boolean;
  autoReoptimize: boolean;
  onToggleAutoReoptimize: () => void;
  onResetDemoData: () => void;
  errorNotice: string | null;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  currency,
  optimizeData,
  compareData,
  isLoading,
  solveMs,
  topologyDiff,
  onClearTopologyDiff,
  onRunOptimizer,
  isSolving,
  isStale,
  autoReoptimize,
  onToggleAutoReoptimize,
  onResetDemoData,
  errorNotice,
}) => {
  const [whyOpen, setWhyOpen] = useState(false);

  const navigateTo = (hash: string) => {
    window.location.hash = hash;
  };

  return (
    <div className="space-y-6">
      {/* 1. Page Header Row */}
      <PageHeader
        breadcrumbs={[
          { label: 'GridPoint', href: '#/overview' },
          { label: 'Overview' },
        ]}
        title="Executive Network Overview"
        description="High-level topological overview, verified financial savings, and capacity throughput analytics for the distribution network."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigateTo('#/map')}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition"
            >
              <Map className="h-3.5 w-3.5 text-blue-600" />
              <span>Demand Map</span>
            </button>
            <button
              type="button"
              onClick={() => navigateTo('#/config')}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition"
            >
              <Sliders className="h-3.5 w-3.5 text-slate-600" />
              <span>Configure Network</span>
            </button>
            <button
              type="button"
              disabled={isSolving}
              onClick={onRunOptimizer}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              <span>{isSolving ? 'Solving...' : 'Run Optimizer'}</span>
            </button>
          </div>
        }
      />

      {/* 2. Error / Notice Banners */}
      {errorNotice && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-800">
          <strong>Notice:</strong> {errorNotice}
        </div>
      )}

      {/* 3. Topology Diff Banner */}
      {topologyDiff && (
        <TopologyDiffBanner
          diff={topologyDiff}
          currency={currency}
          onDismiss={onClearTopologyDiff}
        />
      )}

      {/* 4. Hero Section with USP and Comparison */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <Hero
          solveMs={solveMs}
          isRunningDemo={isSolving}
          onRunDemo={onRunOptimizer}
          onUploadClick={() => navigateTo('#/map')}
          whyOpen={whyOpen}
          onWhyOpenChange={setWhyOpen}
          onResetDemo={onResetDemoData}
          autoReoptimize={autoReoptimize}
          onToggleAutoReoptimize={onToggleAutoReoptimize}
          isStale={isStale}
          onManualReoptimize={onRunOptimizer}
        />
      </div>

      {/* 5. Executive Single-Source-of-Truth KPI Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Executive Optimization KPIs
          </h2>
          <span className="text-[11px] font-medium text-slate-500">
            Currency: <strong className="text-blue-600">{currency}</strong> • Canonical Storage: INR
          </span>
        </div>
        <KpiCards
          currency={currency}
          optimizeData={optimizeData}
          compareData={compareData}
          isLoading={isLoading}
        />
      </div>

      {/* 6. Capacity Headroom Throughput Banner */}
      {optimizeData && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              System Capacity vs. Active Demand
            </h2>
          </div>
          <HeadroomBar
            totalCapacity={optimizeData.total_system_capacity}
            totalDemand={optimizeData.total_system_demand}
            headroomOrders={optimizeData.capacity_headroom}
            headroomPct={optimizeData.capacity_headroom_pct}
          />
        </div>
      )}

      {/* 7. Strategic Depots Topology Cards */}
      {optimizeData && optimizeData.warehouses.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Active Strategic Distribution Hubs ({optimizeData.warehouses.length} Selected)
              </h3>
              <p className="text-xs text-slate-500">
                Hub locations chosen by the exact branch-and-cut solver to minimize combined transit and lease expenditure.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigateTo('#/solvers')}
              className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700"
            >
              <span>View Solver Proofs</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {optimizeData.warehouses.map((w) => {
              const utilPct = Math.round(w.capacity_utilization_pct || (w.assigned_demand / (w.capacity || 1)) * 100);
              const isOverloaded = utilPct > 95;
              return (
                <div
                  key={w.warehouse_id}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3 hover:border-blue-300 transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-4 w-4 text-blue-600" />
                        <h4 className="text-xs font-bold text-slate-900">{w.name}</h4>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 mt-0.5 block">
                        {w.warehouse_id}
                      </span>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isOverloaded
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {utilPct}% Utilized
                    </span>
                  </div>

                  {/* Utilization Bar */}
                  <div className="space-y-1">
                    <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div
                        style={{ width: `${Math.min(100, utilPct)}%` }}
                        className={`h-full rounded-full ${
                          isOverloaded ? 'bg-amber-500' : 'bg-blue-600'
                        }`}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Demand: {w.assigned_demand.toLocaleString()} ord/day</span>
                      <span>Cap: {w.capacity.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-600">
                    <span className="flex items-center gap-1">
                      <Truck className="h-3.5 w-3.5 text-slate-400" />
                      <span>{w.neighborhoods_count} Zones Served</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => navigateTo('#/map')}
                      className="text-xs font-semibold text-blue-600 hover:underline"
                    >
                      Inspect on Map
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
