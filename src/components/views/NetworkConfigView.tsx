import React, { useState, useMemo } from 'react';
import { PageHeader } from '../shell/PageHeader';
import { MathematicalProof } from '../MathematicalProof';
import { EditableZone, EditableHub, getEffectiveOrders } from '../../lib/networkState';
import { OptimizeResponse, Currency, WarehouseSummary } from '../../types';
import { formatMoney, convertInput, convertInrToDisplay, currencySymbol } from '../../lib/currency';
import { DistanceMode, PriorityPreset } from '../../hooks/useOptimizationPipeline';
import { calculateHourlyOrders } from '../../lib/demandProfile';
import {
  RotateCcw,
  BookmarkPlus,
  Play,
  Sliders,
  Sparkles,
} from 'lucide-react';

interface NetworkConfigViewProps {
  currency: Currency;
  zones: EditableZone[];
  hubs: EditableHub[];
  p: number;
  onPChange: (newP: number) => void;
  warehouseCapacity: number;
  onCapacityChange: (cap: number) => void;
  radiusMaxKm: number | null;
  onRadiusChange: (r: number | null) => void;
  deliveryCostInr: number;
  onDeliveryCostInrChange: (cost: number) => void;
  fixedLeaseInr: number;
  onFixedLeaseInrChange: (lease: number) => void;
  priorityPreset: PriorityPreset;
  onPriorityPresetChange: (preset: PriorityPreset) => void;
  autoSize: boolean;
  onAutoSizeChange: (val: boolean) => void;
  distanceMode: DistanceMode;
  onDistanceModeChange: (mode: DistanceMode) => void;
  onRunSolver: () => void;
  isSolving: boolean;
  optimizeData: OptimizeResponse | null;
  onResetDefaults: () => void;
  onSavePreset?: (presetName: string) => void;
  selectedPlotId?: string | null;
  onSelectSite?: (plotId: string) => void;
  candidates?: import('../../types').SiteScoreItem[];
}

export const NetworkConfigView: React.FC<NetworkConfigViewProps> = ({
  currency,
  zones,
  hubs,
  p,
  onPChange,
  warehouseCapacity,
  onCapacityChange,
  radiusMaxKm,
  onRadiusChange,
  deliveryCostInr,
  onDeliveryCostInrChange,
  fixedLeaseInr,
  onFixedLeaseInrChange,
  priorityPreset,
  onPriorityPresetChange,
  autoSize,
  onAutoSizeChange,
  distanceMode,
  onDistanceModeChange,
  onRunSolver,
  isSolving,
  optimizeData,
  onResetDefaults,
  onSavePreset,
  selectedPlotId: _selectedPlotId,
  onSelectSite,
  candidates,
}) => {
  const [proofOpen, setProofOpen] = useState(false);
  const [savePresetName, setSavePresetName] = useState('');
  const [isSavePresetModalOpen, setIsSavePresetModalOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Synchronous calculations
  const totalDemand = useMemo(() => {
    return zones.reduce((sum, z) => sum + getEffectiveOrders(z), 0);
  }, [zones]);

  const activeHubsCount = optimizeData?.warehouses.length || p;
  const totalCapacity = activeHubsCount * warehouseCapacity;
  const isFeasible = totalCapacity >= totalDemand;
  const headroomOrders = Math.max(0, totalCapacity - totalDemand);
  const headroomPct = totalCapacity > 0 ? Math.round((headroomOrders / totalCapacity) * 100) : 0;
  const allocatedPct = totalCapacity > 0 ? Math.min(100, Math.round((totalDemand / totalCapacity) * 100)) : 100;

  // Hourly curve for Bengaluru profile
  const hourlyData = useMemo(() => {
    return calculateHourlyOrders(totalDemand);
  }, [totalDemand]);

  const maxHourlyOrders = useMemo(() => {
    return Math.max(1, ...hourlyData.map((b) => b.orders));
  }, [hourlyData]);

  const maxCandidateNodes = Math.max(1, hubs.length);
  const sym = currencySymbol(currency);

  const handleSavePreset = () => {
    if (!savePresetName.trim()) return;
    if (onSavePreset) {
      onSavePreset(savePresetName.trim());
    } else {
      const customPresets = JSON.parse(localStorage.getItem('gridpoint_user_presets') || '[]');
      customPresets.push({
        name: savePresetName.trim(),
        p,
        warehouseCapacity,
        radiusMaxKm,
        deliveryCostInr,
        fixedLeaseInr,
        priorityPreset,
        savedAt: new Date().toISOString(),
      });
      localStorage.setItem('gridpoint_user_presets', JSON.stringify(customPresets));
    }
    setSavePresetName('');
    setIsSavePresetModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* 1. Page Header Row Adhering to Screenshot 2 */}
      <PageHeader
        breadcrumbs={[
          { label: 'Solvers', href: '#/solvers' },
          { label: 'CFLP Matrix v4.2' },
          { label: 'MIP-BC-09' },
        ]}
        title="Network Configuration & Constraints"
        description="Configure Capacitated Facility Location (CFLP) constraints, priority weights, and cost models."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsResetConfirmOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-xs"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
              <span>Reset to Defaults</span>
            </button>
            <button
              type="button"
              onClick={() => setIsSavePresetModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-xs"
            >
              <BookmarkPlus className="h-3.5 w-3.5 text-slate-500" />
              <span>Save Preset</span>
            </button>
            <button
              type="button"
              onClick={onRunSolver}
              disabled={isSolving}
              className="flex items-center gap-2 rounded-lg bg-[#0F172A] px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition shadow-sm disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5 fill-current text-white" />
              <span>{isSolving ? 'Solving...' : 'Run Branch-and-Cut Solver'}</span>
            </button>
          </div>
        }
      />

      <div className="px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* LEFT 2 COLUMNS: Constraints & Models */}
          <div className="lg:col-span-2 space-y-6">
            {/* Card 1: Optimization Sizing Mode */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Optimization Sizing Mode</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Determine how the MIP solver bounds facility activation nodes
                  </p>
                </div>
                <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-mono font-bold text-blue-700 border border-blue-100">
                  p ∈ &#123;1..{maxCandidateNodes}&#125;
                </span>
              </div>

              {/* Segmented Mode Toggle */}
              <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => onAutoSizeChange(false)}
                  className={`rounded-lg py-2 text-xs font-bold transition flex items-center justify-center gap-2 ${
                    !autoSize ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sliders className="h-3.5 w-3.5" />
                  <span>Exact Count (p)</span>
                </button>
                <button
                  type="button"
                  onClick={() => onAutoSizeChange(true)}
                  className={`rounded-lg py-2 text-xs font-bold transition flex items-center justify-center gap-2 ${
                    autoSize ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Auto-Size (Min Total Cost)</span>
                </button>
              </div>

              {/* Stepper & Slider */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Active Warehouse Constraint (p)
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Target fulfillment centers deployed across the metropolitan cluster
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={autoSize || p <= 1}
                      onClick={() => onPChange(Math.max(1, p - 1))}
                      className="h-7 w-7 rounded-lg border border-slate-200 bg-slate-50 font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                    >
                      -
                    </button>
                    <span className="w-8 text-center text-sm font-bold text-slate-900 tabular-nums">
                      {p}
                    </span>
                    <button
                      type="button"
                      disabled={autoSize || p >= maxCandidateNodes}
                      onClick={() => onPChange(Math.min(maxCandidateNodes, p + 1))}
                      className="h-7 w-7 rounded-lg border border-slate-200 bg-slate-50 font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                </div>

                <input
                  type="range"
                  min={1}
                  max={maxCandidateNodes}
                  value={p}
                  disabled={autoSize}
                  onChange={(e) => onPChange(parseInt(e.target.value, 10))}
                  className="w-full accent-blue-600"
                />

                <div className="flex justify-between text-[11px] font-medium text-slate-400">
                  <span>1 Node (Min)</span>
                  <span className="text-blue-600 font-bold">{p} Active Selected</span>
                  <span>{maxCandidateNodes} Candidate Nodes</span>
                </div>
              </div>
            </div>

            {/* Card 2: Facility & Corridor Constraints */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Facility &amp; Corridor Constraints</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Physical throughput boundaries, lease rates, and per-km transit costs
                  </p>
                </div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  4 Bounds Defined
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                {/* 1. Capacity Q_j */}
                <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-slate-600">
                    <span>PER-WAREHOUSE CAPACITY</span>
                    <span className="font-mono text-slate-400">Q_j</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <input
                      type="number"
                      step={500}
                      min={1000}
                      value={warehouseCapacity}
                      onChange={(e) => onCapacityChange(parseInt(e.target.value, 10) || 1000)}
                      className="w-28 text-lg font-bold text-slate-900 border-b border-slate-300 focus:border-blue-600 focus:outline-none"
                    />
                    <span className="text-xs text-slate-500 font-medium">orders/day</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Peak throughput cap per cross-dock facility</p>
                </div>

                {/* 2. Max Service Radius R_max */}
                <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-slate-600">
                    <span>MAX SERVICE RADIUS</span>
                    <span className="font-mono text-slate-400">R_max</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <input
                      type="number"
                      step={5}
                      min={5}
                      max={100}
                      value={radiusMaxKm ?? ''}
                      onChange={(e) => onRadiusChange(e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-24 text-lg font-bold text-slate-900 border-b border-slate-300 focus:border-blue-600 focus:outline-none"
                    />
                    <span className="text-xs text-slate-500 font-medium">km SLA</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Enforces zero customer drops outside SLA ring</p>
                </div>

                {/* 3. Fixed Lease Cost f_j */}
                <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-slate-600">
                    <span>FIXED LEASE COST</span>
                    <span className="font-mono text-slate-400">f_j</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold text-slate-900">{sym}</span>
                    <input
                      type="number"
                      step={1000}
                      min={0}
                      value={Math.round(convertInrToDisplay(fixedLeaseInr, currency))}
                      onChange={(e) => onFixedLeaseInrChange(convertInput(parseFloat(e.target.value) || 0, currency))}
                      className="w-28 text-lg font-bold text-slate-900 border-b border-slate-300 focus:border-blue-600 focus:outline-none"
                    />
                    <span className="text-xs text-slate-500 font-medium">/ day / site</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Depreciation, utility overhead, and bay leasing</p>
                </div>

                {/* 4. Transit Cost Rate c_ij */}
                <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-slate-600">
                    <span>TRANSIT COST RATE</span>
                    <span className="font-mono text-slate-400">c_ij</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold text-slate-900">{sym}</span>
                    <input
                      type="number"
                      step={1}
                      min={0}
                      value={Number(convertInrToDisplay(deliveryCostInr, currency).toFixed(2))}
                      onChange={(e) => onDeliveryCostInrChange(convertInput(parseFloat(e.target.value) || 0, currency))}
                      className="w-24 text-lg font-bold text-slate-900 border-b border-slate-300 focus:border-blue-600 focus:outline-none"
                    />
                    <span className="text-xs text-slate-500 font-medium">/ km</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Last-mile dispatch diesel, EV blend & driver cost</p>
                </div>
              </div>
            </div>

            {/* Card 3: Priority Objective Function */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Priority Objective Function</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select multi-criteria weighting vector for the optimizer
                  </p>
                </div>
                <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                  1 Active
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Cost Focus */}
                <div
                  onClick={() => onPriorityPresetChange('cost')}
                  className={`rounded-xl p-4 border-2 cursor-pointer transition space-y-2 ${
                    priorityPreset === 'cost'
                      ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xs text-slate-900">💰 Cost Focus</span>
                    <span
                      className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded ${
                        priorityPreset === 'cost'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {priorityPreset === 'cost' ? 'SELECTED' : 'STANDBY'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Minimize fixed facility leases and per-km dispatch spend across all corridors.
                  </p>
                  <div className="text-[10px] font-mono font-semibold text-slate-500 pt-1">
                    f_j={formatMoney(fixedLeaseInr, currency)}/day • c_ij={formatMoney(deliveryCostInr, currency)}/km
                  </div>
                </div>

                {/* Speed & Proximity */}
                <div
                  onClick={() => onPriorityPresetChange('speed')}
                  className={`rounded-xl p-4 border-2 cursor-pointer transition space-y-2 ${
                    priorityPreset === 'speed'
                      ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xs text-slate-900">⚡ Speed &amp; Proximity</span>
                    <span
                      className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded ${
                        priorityPreset === 'speed'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {priorityPreset === 'speed' ? 'SELECTED' : 'STANDBY'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Strict SLA fulfillment with sub-45 min delivery guarantees across dense urban corridors.
                  </p>
                  <div className="text-[10px] font-mono font-semibold text-slate-500 pt-1">
                    R_max ≤ {radiusMaxKm ?? 20} km SLA
                  </div>
                </div>

                {/* CO2 Abatement */}
                <div
                  onClick={() => onPriorityPresetChange('sustainability')}
                  className={`rounded-xl p-4 border-2 cursor-pointer transition space-y-2 ${
                    priorityPreset === 'sustainability'
                      ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xs text-slate-900">🌱 CO2 Abatement</span>
                    <span
                      className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded ${
                        priorityPreset === 'sustainability'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {priorityPreset === 'sustainability' ? 'SELECTED' : 'STANDBY'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Internalizes carbon price penalties at {currency === 'USD' ? '$0.21' : '₹17.5'}/kg CO2 with EV-preference routes.
                  </p>
                  <div className="text-[10px] font-mono font-semibold text-slate-500 pt-1">
                    Carbon Penalized Objective
                  </div>
                </div>
              </div>
            </div>

            {/* Card 4: Distance Metric & Detour Matrix */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Distance Metric &amp; Detour Matrix</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select geometric distance approximation models for transit calculation
                  </p>
                </div>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  Bengaluru Mesh
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 1. OSRM Road Network */}
                <label
                  className={`rounded-xl p-4 border-2 cursor-pointer transition space-y-2 block ${
                    distanceMode === 'osrm'
                      ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="distanceMode"
                        value="osrm"
                        checked={distanceMode === 'osrm'}
                        onChange={() => onDistanceModeChange('osrm')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-bold text-xs text-slate-900">OSRM Road Network</span>
                    </div>
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9.5px] font-bold text-blue-700">
                      Live Mesh
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed pl-5">
                    Real turn-by-turn road distance matrix from OpenStreetMap topology.
                  </p>
                </label>

                {/* 2. Road Detour Proxy */}
                <label
                  className={`rounded-xl p-4 border-2 cursor-pointer transition space-y-2 block ${
                    distanceMode === 'road_detour'
                      ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="distanceMode"
                        value="road_detour"
                        checked={distanceMode === 'road_detour'}
                        onChange={() => onDistanceModeChange('road_detour')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-bold text-xs text-slate-900">Road Detour Proxy</span>
                    </div>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-bold text-slate-600">
                      1.35x Empirical
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed pl-5">
                    Scales Euclidean coordinates using historical OSRM urban congestion routing coefficients.
                  </p>
                </label>

                {/* 3. Straight-line Haversine */}
                <label
                  className={`rounded-xl p-4 border-2 cursor-pointer transition space-y-2 block ${
                    distanceMode === 'haversine'
                      ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="distanceMode"
                        value="haversine"
                        checked={distanceMode === 'haversine'}
                        onChange={() => onDistanceModeChange('haversine')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-bold text-xs text-slate-900">Straight-line Haversine</span>
                    </div>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-bold text-slate-600">
                      1.00x Direct
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed pl-5">
                    Pure geodesic great-circle arc. Ideal for quick lower-bound relaxation iterations.
                  </p>
                </label>
              </div>
            </div>

            {/* Card 5: CFLP Integer Program Formulation (MIP) in KaTeX */}
            <MathematicalProof
              proofOpen={proofOpen}
              onProofOpenChange={setProofOpen}
              isAutoSize={autoSize}
            />
          </div>

          {/* RIGHT 1 COLUMN: Capacity Headroom & Candidate Topology Matrix */}
          <div className="space-y-6">
            {/* Card 1: System Capacity vs. Demand */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">System Capacity vs. Demand</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Aggregated throughput at p = {activeHubsCount} warehouses
                  </p>
                </div>
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-bold border flex items-center gap-1 ${
                    isFeasible
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${isFeasible ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  <span>{isFeasible ? 'Feasible' : 'Infeasible'}</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                  <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                    Daily Active Capacity
                  </div>
                  <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
                    {totalCapacity.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Orders / 24h Window</div>
                </div>

                <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                  <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                    Forecasted Metro Demand
                  </div>
                  <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
                    {totalDemand.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{zones.length} Delivery Zones</div>
                </div>
              </div>

              {/* Headroom Progress Bar */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-600">Allocated Demand ({allocatedPct}%)</span>
                  <span className="text-emerald-600">Buffer ({headroomPct}%)</span>
                </div>
                <div className="h-3 w-full rounded-full bg-emerald-100 overflow-hidden flex">
                  <div
                    style={{ width: `${allocatedPct}%` }}
                    className="h-full bg-blue-600 transition-all duration-300"
                  />
                  <div
                    style={{ width: `${headroomPct}%` }}
                    className="h-full bg-emerald-500 transition-all duration-300"
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Demand: {totalDemand.toLocaleString()}</span>
                  <span>Headroom: +{headroomOrders.toLocaleString()}</span>
                </div>
              </div>

              {/* Peak Hour Demand Profile Chart */}
              <div className="space-y-1.5 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">Peak Hour Demand Profile (08:00–20:00)</span>
                  <span className="text-[11px] font-semibold text-blue-600">
                    Max: {maxHourlyOrders.toLocaleString()} orders/hr
                  </span>
                </div>
                <div className="h-20 flex items-end gap-1.5 pt-2">
                  {hourlyData.slice(0, 13).map((b, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center">
                      <div
                        style={{ height: `${Math.max(14, (b.orders / maxHourlyOrders) * 60)}px` }}
                        className={`w-full rounded-xs transition ${
                          b.isPeak ? 'bg-blue-600' : 'bg-slate-200'
                        }`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Card 2: Candidate Hub Topology List */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Candidate Hub Topology</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Real-time candidate assignment matrix &amp; facility status
                  </p>
                </div>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {hubs.length} Evaluated
                </span>
              </div>

              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto space-y-1">
                {hubs.map((hub) => {
                  const isOpen = optimizeData?.warehouses.some((w: WarehouseSummary) => w.warehouse_id === hub.id);
                  const assignedWh = optimizeData?.warehouses.find((w: WarehouseSummary) => w.warehouse_id === hub.id);
                  const utilPct = assignedWh ? assignedWh.capacity_utilization_pct : 0;
                  const candScore = candidates?.find((c) => c.plot_id === hub.id);

                  return (
                    <div
                      key={hub.id}
                      className="py-3 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg transition"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${isOpen ? 'bg-blue-600' : 'bg-slate-300'}`} />
                          <span className="font-semibold text-xs text-slate-900 truncate">
                            {hub.name}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap gap-x-2">
                          <span>Cap: {hub.capacity.toLocaleString()}</span>
                          <span>•</span>
                          <span>{formatMoney(hub.dailyLease, currency)}/day</span>
                          {assignedWh && (
                            <>
                              <span>•</span>
                              <span className="text-blue-700 font-medium">
                                {assignedWh.neighborhoods_count} zones served ({assignedWh.assigned_demand.toLocaleString()} ord)
                              </span>
                            </>
                          )}
                          {candScore?.regret_inr !== undefined && (
                            <>
                              <span>•</span>
                              <span className="text-slate-600 font-mono">
                                Regret: {formatMoney(candScore.regret_inr, currency)}
                              </span>
                            </>
                          )}
                        </div>
                        {isOpen && (
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="h-1.5 w-24 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                style={{ width: `${utilPct}%` }}
                                className="h-full bg-blue-600 rounded-full"
                              />
                            </div>
                            <span className="text-[10px] font-mono text-slate-500">
                              {utilPct}% Util
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            isOpen ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {isOpen ? 'Open Hub' : 'Candidate'}
                        </span>
                        {onSelectSite && (
                          <button
                            type="button"
                            onClick={() => onSelectSite(hub.id)}
                            className="text-xs text-blue-600 hover:underline font-semibold"
                          >
                            Inspect
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Preset Dialog */}
      {isSavePresetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Save Parameter Preset</h3>
            <p className="text-xs text-slate-500">Save current constraints and weights to localStorage.</p>
            <input
              type="text"
              placeholder="e.g., Festival Surge 2026"
              value={savePresetName}
              onChange={(e) => setSavePresetName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsSavePresetModalOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!savePresetName.trim()}
                onClick={handleSavePreset}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Defaults Confirmation Dialog */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Reset to Defaults?</h3>
            <p className="text-xs text-slate-600">
              This will restore warehouse count (p=3), capacity (4,000 ord/day), radius SLA (25 km), and standard lease/transit rates.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetDefaults();
                  setIsResetConfirmOpen(false);
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
