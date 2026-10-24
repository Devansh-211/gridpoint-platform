import React, { useState } from 'react';
import { PageHeader } from '../shell/PageHeader';
import { SolverTransparencyPanel } from '../SolverTransparencyPanel';
import { MathematicalProof } from '../MathematicalProof';
import { RankingSection } from '../RankingSection';
import { BenchmarkComparison } from '../BenchmarkComparison';
import { TradeoffChart } from '../TradeoffChart';
import { TopologyDiffBanner } from '../TopologyDiffBanner';
import {
  Currency,
  OptimizeResponse,
  CompareResponse,
  RankResponse,
  TradeoffPoint,
} from '../../types';
import { SolverOutput } from '../../solver/types';
import { TopologyDiff } from '../../lib/networkState';
import {
  Sliders,
  Play,
} from 'lucide-react';

interface OptimizationSolversViewProps {
  currency: Currency;
  optimizeData: OptimizeResponse | null;
  compareData: CompareResponse | null;
  rankingData: RankResponse | null;
  tradeoffPoints: TradeoffPoint[];
  solverOutput: SolverOutput | null;
  cbcVerified: boolean | null;
  cbcWarning: { workerObj: number; cbcObj: number } | null;
  solveMs: number | null;
  topologyDiff: TopologyDiff | null;
  onClearTopologyDiff: () => void;
  onRunOptimizer: () => void;
  isSolving: boolean;
  autoSize: boolean;
  selectedPlotId: string | null;
  onSelectSite: (plotId: string) => void;
}

export const OptimizationSolversView: React.FC<OptimizationSolversViewProps> = ({
  currency,
  optimizeData,
  compareData,
  rankingData,
  tradeoffPoints,
  solverOutput,
  cbcVerified,
  cbcWarning,
  solveMs,
  topologyDiff,
  onClearTopologyDiff,
  onRunOptimizer,
  isSolving,
  autoSize,
  selectedPlotId,
  onSelectSite,
}) => {
  const [proofOpen, setProofOpen] = useState(false);

  const navigateTo = (hash: string) => {
    window.location.hash = hash;
  };

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <PageHeader
        breadcrumbs={[
          { label: 'GridPoint', href: '#/overview' },
          { label: 'Optimization & Solvers' },
        ]}
        title="Optimization & Solvers Engine"
        description="Live Branch-and-Cut integer programming telemetry, CBC algebraic verification, alternative top-k configurations, and mathematical formulations."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigateTo('#/config')}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition"
            >
              <Sliders className="h-3.5 w-3.5 text-slate-600" />
              <span>Configure Constraints</span>
            </button>
            <button
              type="button"
              disabled={isSolving}
              onClick={onRunOptimizer}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              <span>{isSolving ? 'Solving...' : 'Re-Run Solver'}</span>
            </button>
          </div>
        }
      />

      {/* 2. Topology Diff Banner */}
      {topologyDiff && (
        <TopologyDiffBanner
          diff={topologyDiff}
          currency={currency}
          onDismiss={onClearTopologyDiff}
        />
      )}

      {/* 3. Live Solver Transparency & Verification Telemetry */}
      {solverOutput && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Solver Execution Telemetry & Verification
            </h2>
          </div>
          <SolverTransparencyPanel
            metrics={solverOutput.metrics}
            cbcVerified={cbcVerified}
            cbcSolveMs={solveMs}
            cbcObjective={cbcWarning?.cbcObj ?? solverOutput.combinedTotalCostInr}
            workerObjective={solverOutput.combinedTotalCostInr}
          />
        </div>
      )}

      {/* 4. Mathematical Formulation Proof (KaTeX) */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <MathematicalProof
          proofOpen={proofOpen}
          onProofOpenChange={setProofOpen}
          isAutoSize={autoSize}
        />
      </div>

      {/* 5. Alternatives Leaderboard & All Candidates Table */}
      {rankingData && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Site Ranking & Alternative Topologies
            </h2>
          </div>
          <RankingSection
            optimizeData={optimizeData}
            alternatives={rankingData.alternatives || []}
            candidates={rankingData.site_scores || []}
            currency={currency}
            isLoading={isSolving}
            onSelectSite={onSelectSite}
            selectedPlotId={selectedPlotId}
          />
        </div>
      )}

      {/* 6. Dual Grid: Benchmark Comparison vs Single-Hub & Tradeoff Curve */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left: Centroid Baseline Benchmark */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <BenchmarkComparison
            currency={currency}
            optimizeData={optimizeData}
            compareData={compareData}
          />
        </div>

        {/* Right: Facility Count Trade-Off Curve */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <TradeoffChart
            currency={currency}
            points={tradeoffPoints}
          />
        </div>
      </div>
    </div>
  );
};
