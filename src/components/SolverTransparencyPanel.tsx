import React, { useState } from 'react';
import { ChevronDown, Cpu, CheckCircle2, AlertTriangle, Layers, Zap } from 'lucide-react';
import { SolverMetrics } from '../solver/types';

interface SolverTransparencyPanelProps {
  metrics: SolverMetrics | null;
  cbcVerified: boolean | null; // true = exact match, false = mismatch, null = verifying/unknown
  cbcSolveMs?: number | null;
  cbcObjective?: number | null;
  workerObjective?: number | null;
  isSingleSourcing?: boolean;
}

export const SolverTransparencyPanel: React.FC<SolverTransparencyPanelProps> = ({
  metrics,
  cbcVerified,
  cbcSolveMs,
  cbcObjective,
  workerObjective,
  isSingleSourcing = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!metrics) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden transition-all">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between p-3.5 bg-slate-50/70 hover:bg-slate-100/60 transition text-left"
        aria-expanded={isOpen}
      >
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <Cpu className="h-4 w-4 text-blue-600" />
            <span>Live Exact CFLP Engine</span>
          </span>

          {/* Verification Badge */}
          {cbcVerified === true && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200"
              title={`Matches backend CBC MILP within 1e-6 relative tolerance. Worker: ₹${workerObjective?.toLocaleString()} / CBC: ₹${cbcObjective?.toLocaleString()}`}
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>✓ Verified exact (matches CBC)</span>
            </span>
          )}

          {cbcVerified === false && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-300"
              title={`Discrepancy detected: Worker ₹${workerObjective?.toLocaleString()} vs CBC ₹${cbcObjective?.toLocaleString()}`}
            >
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              <span>Objective Divergence</span>
            </span>
          )}

          {cbcVerified === null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-medium text-slate-600">
              <Zap className="h-3 w-3 text-blue-500 animate-pulse" />
              <span>Verifying with CBC...</span>
            </span>
          )}

          <span className="text-[11px] font-medium text-slate-500">
            Solve: <strong className="text-slate-900">{metrics.elapsedMs} ms</strong>
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-blue-600">
          <span>{isOpen ? 'Hide Engine Telemetry' : 'Show Engine Telemetry'}</span>
          <ChevronDown
            className={`h-4 w-4 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="p-4 border-t border-slate-100 bg-white space-y-3 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-2.5">
              <div className="text-[10.5px] font-medium text-slate-500 uppercase tracking-wider">
                Sets Evaluated
              </div>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {metrics.setsEvaluated.toLocaleString()} / {metrics.totalCombinations.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Facility combinations C(M, p)
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-2.5">
              <div className="text-[10.5px] font-medium text-slate-500 uppercase tracking-wider">
                B&B Nodes Explored
              </div>
              <div className="text-base font-bold text-blue-700 mt-0.5">
                {metrics.nodesExplored.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Decision tree depth-first states
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-2.5">
              <div className="text-[10.5px] font-medium text-slate-500 uppercase tracking-wider">
                Subtrees Pruned
              </div>
              <div className="text-base font-bold text-emerald-700 mt-0.5">
                {metrics.nodesPruned.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Capacity & lower bound bounds
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-2.5">
              <div className="text-[10.5px] font-medium text-slate-500 uppercase tracking-wider">
                Incumbent Updates
              </div>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {metrics.incumbentUpdates}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Optimal bounds tightened
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3 text-slate-700 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-blue-900">
              <Layers className="h-3.5 w-3.5" />
              <span>Algorithmic Solver Specification</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-600">
              Branch-and-Bound over facility combinations with exact Min-Cost Flow (Transportation Simplex / Successive Shortest Path) at leaves.
              {isSingleSourcing ? ' Single-sourcing active: binary assignment enforced via CBC MILP.' : ' Split-delivery mode active: fractional overflow allocated automatically when depots reach capacity ceiling.'}
              {cbcSolveMs ? ` Backend CBC benchmark: ${cbcSolveMs} ms.` : ''}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
