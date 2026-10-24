import React, { useState, useMemo, useCallback } from 'react';
import { PageHeader } from '../shell/PageHeader';
import {
  Currency,
  OptimizeResponse,
} from '../../types';
import { EditableZone, EditableHub, getEffectiveOrders } from '../../lib/networkState';
import { formatMoney } from '../../lib/currency';
import { cflpSolver } from '../../solver/cflpClient';
import { SolverOutput, SolverZone, SolverHub } from '../../solver/types';
import { OsrmMatrixResult } from '../../services/osrmMatrixService';
import {
  FlaskConical,
  TrendingUp,
  Fuel,
  RotateCcw,
  Save,
  ShieldAlert,
} from 'lucide-react';

interface ScenarioLabViewProps {
  currency: Currency;
  zones: EditableZone[];
  hubs: EditableHub[];
  p: number;
  deliveryCostInr: number;
  warehouseCapacity: number;
  fixedLeaseInr: number;
  radiusMaxKm: number | null;
  matrixResult: OsrmMatrixResult | null;
  baselineOutput: SolverOutput | null;
  baselineOptimizeData: OptimizeResponse | null;
  onApplyScenarioAsBaseline: (
    updatedZones: EditableZone[],
    updatedCostPerKm: number
  ) => void;
}

export const ScenarioLabView: React.FC<ScenarioLabViewProps> = ({
  currency,
  zones,
  hubs,
  p,
  deliveryCostInr,
  warehouseCapacity,
  fixedLeaseInr,
  radiusMaxKm,
  matrixResult,
  baselineOutput,
  baselineOptimizeData,
  onApplyScenarioAsBaseline,
}) => {
  // Scenario stress testing controls
  const [demandSurgePct, setDemandSurgePct] = useState<number>(20); // 0 to 100%
  const [fuelShockPct, setFuelShockPct] = useState<number>(25); // 0 to 100%
  const [outageHubIds, setOutageHubIds] = useState<string[]>([]);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [scenarioOutput, setScenarioOutput] = useState<SolverOutput | null>(null);

  // Toggle outage for a hub
  const toggleHubOutage = (hubId: string) => {
    setOutageHubIds((prev) =>
      prev.includes(hubId) ? prev.filter((id) => id !== hubId) : [...prev, hubId]
    );
  };

  // Build distance matrix
  const buildDistanceMatrix = useCallback(
    (targetHubs: SolverHub[], targetZones: SolverZone[]) => {
      const distMatrix: Record<string, Record<string, number>> = {};
      for (const h of targetHubs) {
        distMatrix[h.id] = {};
        for (const z of targetZones) {
          if (
            matrixResult &&
            matrixResult.distancesKm[h.id] &&
            matrixResult.distancesKm[h.id][z.id] !== undefined
          ) {
            distMatrix[h.id][z.id] = matrixResult.distancesKm[h.id][z.id];
          } else {
            // Haversine fallback with 1.34 road detour
            const dLat = ((z.lat - h.lat) * Math.PI) / 180;
            const dLng = ((z.lng - h.lng) * Math.PI) / 180;
            const a =
              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos((h.lat * Math.PI) / 180) *
                Math.cos((z.lat * Math.PI) / 180) *
                Math.sin(dLng / 2) *
                Math.sin(dLng / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const straightKm = 6371 * c;
            distMatrix[h.id][z.id] = straightKm * 1.34;
          }
        }
      }
      return distMatrix;
    },
    [matrixResult]
  );

  // Run Scenario Simulation
  const handleRunSimulation = useCallback(async () => {
    setIsSimulating(true);
    try {
      // 1. Copy and apply demand surge
      const surgeFactor = 1 + demandSurgePct / 100;
      const scenarioZones: SolverZone[] = zones.map((z) => ({
        id: z.id,
        name: z.name,
        lat: z.lat,
        lng: z.lng,
        demand: Math.round(getEffectiveOrders(z) * surgeFactor),
      }));

      // 2. Filter available hubs by outage
      const availableHubs = hubs.filter((h) => !outageHubIds.includes(h.id));
      const scenarioHubs: SolverHub[] = availableHubs.map((h) => ({
        id: h.id,
        name: h.name,
        lat: h.lat,
        lng: h.lng,
        capacity: h.capacity || warehouseCapacity,
        dailyLease: h.dailyLease || fixedLeaseInr,
      }));

      // Effective p cannot exceed available hubs
      const effectiveP = Math.min(p, scenarioHubs.length);

      // 3. Shocked fuel cost
      const shockedCostPerKm = deliveryCostInr * (1 + fuelShockPct / 100);

      const distMatrix = buildDistanceMatrix(scenarioHubs, scenarioZones);

      const output = await cflpSolver.solve({
        zones: scenarioZones,
        hubs: scenarioHubs,
        p: Math.max(1, effectiveP),
        costPerKm: shockedCostPerKm,
        radiusMaxKm: radiusMaxKm,
        distanceMatrixKm: distMatrix,
        timeBudgetMs: 500,
      });

      setScenarioOutput(output);
    } catch (err) {
      console.error('Scenario simulation failed:', err);
    } finally {
      setIsSimulating(false);
    }
  }, [
    demandSurgePct,
    fuelShockPct,
    outageHubIds,
    zones,
    hubs,
    p,
    warehouseCapacity,
    fixedLeaseInr,
    deliveryCostInr,
    radiusMaxKm,
    buildDistanceMatrix,
  ]);

  // Compute Reassigned Zones
  const reassignedZones = useMemo(() => {
    if (!baselineOutput || !scenarioOutput) return [];
    const baselineMap = new Map<string, string>();
    for (const a of baselineOutput.assignments) {
      const topHub = a.hubAssignments[0]?.hubName || 'Unassigned';
      baselineMap.set(a.zoneId, topHub);
    }

    const reassignments: {
      zoneName: string;
      baselineHub: string;
      scenarioHub: string;
      deltaKm: number;
    }[] = [];

    for (const a of scenarioOutput.assignments) {
      const baselineHub = baselineMap.get(a.zoneId) || 'Unassigned';
      const scenarioHub = a.hubAssignments[0]?.hubName || 'Unassigned';
      if (baselineHub !== scenarioHub) {
        const scenarioDist = a.hubAssignments[0]?.distanceKm || 0;
        reassignments.push({
          zoneName: a.zoneName,
          baselineHub,
          scenarioHub,
          deltaKm: scenarioDist,
        });
      }
    }

    return reassignments;
  }, [baselineOutput, scenarioOutput]);

  // Reset controls
  const handleResetScenario = () => {
    setDemandSurgePct(0);
    setFuelShockPct(0);
    setOutageHubIds([]);
    setScenarioOutput(null);
  };

  // Apply scenario to real pipeline
  const handleApply = () => {
    const surgeFactor = 1 + demandSurgePct / 100;
    const shockedCostPerKm = deliveryCostInr * (1 + fuelShockPct / 100);
    const updatedZones: EditableZone[] = zones.map((z) => ({
      ...z,
      baseOrders: Math.round(z.baseOrders * surgeFactor),
    }));
    onApplyScenarioAsBaseline(updatedZones, shockedCostPerKm);
    alert('Scenario parameters successfully applied to the live network!');
  };

  const baselineCost = baselineOutput?.combinedTotalCostInr ?? baselineOptimizeData?.combined_total_cost ?? 125000;
  const scenarioCost = scenarioOutput?.combinedTotalCostInr ?? null;
  const costDelta = scenarioCost !== null ? scenarioCost - baselineCost : null;
  const costPctChange = scenarioCost !== null && baselineCost > 0 ? (costDelta! / baselineCost) * 100 : null;

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <PageHeader
        breadcrumbs={[
          { label: 'GridPoint', href: '#/overview' },
          { label: 'Scenario Lab' },
        ]}
        title="Scenario Lab & Resilience Stress-Testing"
        description="Non-destructive sandbox to evaluate network robustness against demand surges, diesel fuel price spikes, and catastrophic distribution hub outages."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleResetScenario}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
              <span>Reset Sandbox</span>
            </button>
            <button
              type="button"
              disabled={isSimulating}
              onClick={handleRunSimulation}
              className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-purple-700 transition disabled:opacity-50"
            >
              <FlaskConical className="h-3.5 w-3.5" />
              <span>{isSimulating ? 'Simulating...' : 'Simulate Stress Test'}</span>
            </button>
          </div>
        }
      />

      {/* 2. Sandbox Parameters Panel */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-purple-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Stress-Testing Parameter Shocks
            </h3>
          </div>
          <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-bold text-purple-700 border border-purple-200">
            Sandbox Isolation: Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Shock 1: Demand Surge */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                <span>Demand Surge</span>
              </span>
              <span className="text-xs font-mono font-bold text-emerald-700">
                +{demandSurgePct}%
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Simulates seasonal promotional spikes across all delivery clusters.
            </p>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={demandSurgePct}
              onChange={(e) => setDemandSurgePct(Number(e.target.value))}
              className="w-full accent-emerald-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>0% (Baseline)</span>
              <span>+50%</span>
              <span>+100% (2x Surge)</span>
            </div>
          </div>

          {/* Shock 2: Fuel Price Inflation */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Fuel className="h-4 w-4 text-amber-600" />
                <span>Transit & Fuel Shock</span>
              </span>
              <span className="text-xs font-mono font-bold text-amber-700">
                +{fuelShockPct}%
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Simulates diesel fuel price hikes or driver incentive cost inflation.
            </p>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={fuelShockPct}
              onChange={(e) => setFuelShockPct(Number(e.target.value))}
              className="w-full accent-amber-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>0% (₹{deliveryCostInr}/km)</span>
              <span>+50%</span>
              <span>+100%</span>
            </div>
          </div>

          {/* Shock 3: Distribution Hub Outage */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <ShieldAlert className="h-4 w-4 text-red-600" />
                <span>Simulate Hub Outage</span>
              </span>
              <span className="text-xs font-mono font-bold text-red-700">
                {outageHubIds.length} Disabled
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Click candidate hubs below to toggle emergency shutdown.
            </p>
            <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
              {hubs.map((h) => {
                const isOutage = outageHubIds.includes(h.id);
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => toggleHubOutage(h.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1 rounded-md text-[11px] font-medium border transition ${
                      isOutage
                        ? 'bg-red-50 text-red-700 border-red-300 font-bold'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>{h.name}</span>
                    <span>{isOutage ? 'OFFLINE' : 'ONLINE'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Scenario Results Comparison vs Baseline */}
      {scenarioOutput ? (
        <div className="space-y-6 animate-in fade-in-50">
          {/* Comparison KPI Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* KPI 1: Cost Impact */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Scenario Operating Cost
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-slate-900">
                  {formatMoney(scenarioCost!, currency)}
                </span>
                <span className="text-xs text-slate-400">/day</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span
                  className={`font-bold ${
                    costDelta! > 0 ? 'text-red-600' : 'text-emerald-600'
                  }`}
                >
                  {costDelta! > 0 ? `+${formatMoney(costDelta!, currency)}` : formatMoney(costDelta!, currency)} ({costPctChange! > 0 ? `+${costPctChange!.toFixed(1)}%` : `${costPctChange!.toFixed(1)}%`})
                </span>
                <span className="text-slate-400">vs baseline</span>
              </div>
            </div>

            {/* KPI 2: Average Distance */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Avg Delivery Radius
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-slate-900">
                  {scenarioOutput.averageDistanceKm.toFixed(1)} km
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Baseline: {(baselineOutput?.averageDistanceKm ?? 4.8).toFixed(1)} km
              </p>
            </div>

            {/* KPI 3: Reassigned Zones Count */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Reassigned Zones
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-purple-700">
                  {reassignedZones.length}
                </span>
                <span className="text-xs text-slate-400">of {zones.length}</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Clusters shifted to alternative hubs
              </p>
            </div>

            {/* KPI 4: Unserved Demand / Breaches */}
            {(() => {
              const unservedDemand = scenarioOutput.assignments
                .filter((a) => !a.isCovered || a.hubAssignments.length === 0)
                .reduce((sum, a) => sum + a.demand, 0);
              return (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    SLA & Capacity Breaches
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`text-2xl font-bold font-mono ${
                        unservedDemand > 0 ? 'text-red-600' : 'text-emerald-700'
                      }`}
                    >
                      {unservedDemand.toLocaleString()}
                    </span>
                    <span className="text-xs text-slate-400">ord/day</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {unservedDemand > 0
                      ? 'Capacity shortfall under surge'
                      : '100% Demand Served'}
                  </p>
                </div>
              );
            })()}
          </div>

          {/* Reassigned Zones Table & Impact Summary */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Topology Realignment & Zone Routing Shifts
                </h3>
                <p className="text-xs text-slate-500">
                  Showing all delivery clusters that had to be rerouted under the simulated stress condition.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleApply}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>Apply as New Baseline</span>
                </button>
              </div>
            </div>

            {reassignedZones.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No zones required reassignment under these parameters. The baseline topology is resilient!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Delivery Zone</th>
                      <th className="py-2.5 px-3">Baseline Depot</th>
                      <th className="py-2.5 px-3">Emergency Shift Depot</th>
                      <th className="py-2.5 px-3 text-right">Transit Distance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reassignedZones.map((rz, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {rz.zoneName}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {rz.baselineHub}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-purple-700">
                          {rz.scenarioHub}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                          {rz.deltaKm.toFixed(1)} km
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-12 text-center space-y-3">
          <FlaskConical className="h-8 w-8 text-slate-400 mx-auto" />
          <h4 className="text-sm font-bold text-slate-700">No Stress-Test Active</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Adjust the demand surge %, fuel price shock %, or disable candidate distribution depots above, then click <strong>"Simulate Stress Test"</strong> to inspect network resilience.
          </p>
        </div>
      )}
    </div>
  );
};
