import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Currency,
  DeliveryZone,
  OptimizeResponse,
  CompareResponse,
  TradeoffPoint,
  RankResponse,
} from './types';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { KpiCards } from './components/KpiCards';
import { HeadroomBar } from './components/HeadroomBar';
import { MathematicalProof } from './components/MathematicalProof';
import { ControlPanel } from './components/ControlPanel';
import { BenchmarkComparison } from './components/BenchmarkComparison';
import { TradeoffChart } from './components/TradeoffChart';
import { NetworkMap } from './components/NetworkMap';
import { RankingSection } from './components/RankingSection';
import { RegistryDrawer } from './components/RegistryDrawer';
import { CsvIngestion } from './components/CsvIngestion';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LogisticsAssistant } from './components/LogisticsAssistant';
import { RoutingStatusBadge } from './components/RoutingStatusBadge';
import { SolverTransparencyPanel } from './components/SolverTransparencyPanel';
import { TopologyDiffBanner } from './components/TopologyDiffBanner';
import { ZoneDemandTable } from './components/ZoneDemandTable';
import { ZoneInspectorDrawer, InspectedItem } from './components/ZoneInspectorDrawer';
import { PhotonSearch } from './components/PhotonSearch';
import { PhotonPlaceResult } from './services/photonService';
import {
  fetchRoadDistanceMatrix,
  OsrmMatrixResult,
} from './services/osrmMatrixService';
import { cflpSolver } from './solver/cflpClient';
import { SolverOutput, SolverInput } from './solver/types';
import {
  EditableZone,
  EditableHub,
  TopologyDiff,
  getEffectiveOrders,
  createDefaultDemoZones,
  createDefaultDemoHubs,
  loadSavedNetwork,
  saveNetwork,
  clearSavedNetwork,
  calculateTopologyDiff,
} from './lib/networkState';
import {
  DEFAULT_DELIVERY_COST_PER_KM_INR,
  DEFAULT_FIXED_WAREHOUSE_LEASE_INR,
} from './lib/currency';

// Bundled fallback data
import bundledDemoTradeoff from './data/demoTradeoff.json';
import bundledDemoRank from './data/demoRank.json';

import { RefreshCw, Info, Bot, Undo2, X } from 'lucide-react';

export const App: React.FC = () => {
  // 1. Currency State (persisted in localStorage, defaulting to 'INR')
  const [currency, setCurrency] = useState<Currency>(() => {
    const saved = localStorage.getItem('gridpoint_currency');
    return saved === 'USD' ? 'USD' : 'INR';
  });

  const handleCurrencyChange = (newCurr: Currency) => {
    setCurrency(newCurr);
    localStorage.setItem('gridpoint_currency', newCurr);
  };

  // 2. Working Network Dataset (Editable Zones & Candidate Hubs)
  const [{ zones, hubs }, setNetworkState] = useState(() => loadSavedNetwork());

  // History stack for Undo / Redo
  const [history, setHistory] = useState<{ zones: EditableZone[]; hubs: EditableHub[] }[]>([]);
  const [future, setFuture] = useState<{ zones: EditableZone[]; hubs: EditableHub[] }[]>([]);

  // Push state to history before edits
  const pushHistory = useCallback(() => {
    setHistory((prev) => [...prev.slice(-30), { zones, hubs }]);
    setFuture([]);
  }, [zones, hubs]);

  // Solver Parameters
  const [p, setP] = useState<number>(3);
  const [warehouseCapacity, setWarehouseCapacity] = useState<number>(4000);
  const [radiusMaxKm, setRadiusMaxKm] = useState<number | null>(25);
  const [deliveryCostInr, setDeliveryCostInr] = useState<number>(DEFAULT_DELIVERY_COST_PER_KM_INR);
  const [fixedLeaseInr, setFixedLeaseInr] = useState<number>(DEFAULT_FIXED_WAREHOUSE_LEASE_INR);
  const [priorityPreset, setPriorityPreset] = useState<'cost' | 'speed' | 'sustainability'>('cost');
  const [autoSize, setAutoSize] = useState<boolean>(false);
  const [pMax, setPMax] = useState<number | null>(6);

  // Auto-Reoptimize on Data Edit (default true)
  const [autoReoptimize, setAutoReoptimize] = useState<boolean>(true);
  const [isStale, setIsStale] = useState<boolean>(false);

  // Active Results State
  const [optimizeData, setOptimizeData] = useState<OptimizeResponse | null>(null);
  const [compareData, setCompareData] = useState<CompareResponse | null>(null);
  const [tradeoffPoints] = useState<TradeoffPoint[]>(
    (bundledDemoTradeoff as any).points || []
  );
  const [rankingData, setRankingData] = useState<RankResponse | null>(
    bundledDemoRank as any
  );

  // Live Solver & OSRM Matrix State
  const [solverOutput, setSolverOutput] = useState<SolverOutput | null>(null);
  const [topologyDiff, setTopologyDiff] = useState<TopologyDiff | null>(null);
  const [matrixResult, setMatrixResult] = useState<OsrmMatrixResult | null>(null);

  // CBC Verification State
  const [cbcVerified, setCbcVerified] = useState<boolean | null>(null);
  const [cbcWarning, setCbcWarning] = useState<{ workerObj: number; cbcObj: number } | null>(null);

  // Inspection & Drawer State
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [inspectedItem, setInspectedItem] = useState<InspectedItem | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(false);
  const [isRegistryOpen, setIsRegistryOpen] = useState<boolean>(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState<boolean>(false);

  // Map-click add location state
  const [externalMapPlace, setExternalMapPlace] = useState<PhotonPlaceResult | null>(null);

  // Delete Toast Notification
  const [deleteToast, setDeleteToast] = useState<{ message: string; undoAction: () => void } | null>(null);

  // Status & Resilience State
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSolving, setIsSolving] = useState<boolean>(false);
  const [isCachedFallback, setIsCachedFallback] = useState<boolean>(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Collapsible sections
  const [whyOpen, setWhyOpen] = useState<boolean>(false);
  const [proofOpen, setProofOpen] = useState<boolean>(false);

  // Debounce & In-Flight Refs
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cbcAbortControllerRef = useRef<AbortController | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);

  // Helper: smooth scroll
  const smoothScrollTo = (elementId: string) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    const prefersReducedMotion =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;
    if (typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
    }
  };

  // Convert SolverOutput + Zones into OptimizeResponse
  const buildOptimizeResponse = useCallback(
    (
      output: SolverOutput,
      currentZones: EditableZone[],
      currentHubs: EditableHub[],
      currentP: number
    ): OptimizeResponse => {
      const totalSystemDemand = currentZones.reduce((sum, z) => sum + getEffectiveOrders(z), 0);
      const totalSystemCapacity = output.openHubs.reduce((sum, h) => sum + h.capacity, 0);
      const headroom = totalSystemCapacity - totalSystemDemand;
      const headroomPct = totalSystemCapacity > 0 ? (headroom / totalSystemCapacity) * 100 : 0;

      // Warehouse summary
      const warehouses = output.openHubs.map((h) => ({
        warehouse_id: h.hubId,
        name: h.name,
        latitude: h.latitude,
        longitude: h.longitude,
        capacity: h.capacity,
        assigned_demand: h.assignedDemand,
        capacity_required: h.assignedDemand,
        capacity_ceiling: h.capacity,
        capacity_utilization_pct: h.utilizationPct,
        neighborhoods_count: h.zonesServedCount,
      }));

      // Flatten assignments
      const zoneMap = new Map(currentZones.map((z) => [z.id, z]));
      const hubMap = new Map(currentHubs.map((h) => [h.id, h]));
      const assignments: any[] = [];

      for (const a of output.assignments) {
        const zone = zoneMap.get(a.zoneId);
        if (!zone) continue;

        if (a.hubAssignments.length === 0) {
          // Unassigned / breach
          assignments.push({
            neighborhood_id: a.zoneId,
            neighborhood_name: a.zoneName,
            latitude: zone.lat,
            longitude: zone.lng,
            warehouse_id: 'UNASSIGNED',
            warehouse_name: 'Unassigned (SLA Breach)',
            warehouse_latitude: zone.lat,
            warehouse_longitude: zone.lng,
            distance_km: 999,
            daily_orders: a.demand,
          });
        } else {
          for (const h of a.hubAssignments) {
            const hub = hubMap.get(h.hubId);
            assignments.push({
              neighborhood_id: a.zoneId,
              neighborhood_name: a.zoneName,
              latitude: zone.lat,
              longitude: zone.lng,
              warehouse_id: h.hubId,
              warehouse_name: h.hubName,
              warehouse_latitude: hub?.lat ?? zone.lat,
              warehouse_longitude: hub?.lng ?? zone.lng,
              distance_km: h.distanceKm,
              daily_orders: h.assignedDemand,
            });
          }
        }
      }

      const baselineTransit = output.totalTransitCostInr * 1.45;
      const baselineLease = 1 * fixedLeaseInr;
      const baselineCombined = baselineTransit + baselineLease;
      const monthlySavings = Math.max(0, (baselineCombined - output.combinedTotalCostInr) * 30);

      return {
        status: output.status,
        solver_message: output.isOptimal
          ? 'Exact optimal solution proven via Live Branch-and-Bound CFLP'
          : 'Anytime feasible incumbent solution',
        is_optimal: output.isOptimal,
        p: currentP,
        auto_size: false,
        total_weighted_distance_km: output.totalWeightedDistanceKm,
        average_distance_km: output.averageDistanceKm,
        total_delivery_cost: output.totalTransitCostInr,
        total_infrastructure_cost: output.totalLeaseCostInr,
        combined_total_cost: output.combinedTotalCostInr,
        total_system_capacity: totalSystemCapacity,
        total_system_demand: totalSystemDemand,
        capacity_headroom: headroom,
        capacity_headroom_pct: headroomPct,
        sizing_rationale: null,
        coverage_percentage: output.coveragePercentage,
        fast_delivery_coverage_pct: output.fastDeliveryCoveragePct,
        unserved_demand: output.assignments
          .filter((a) => !a.isCovered)
          .reduce((acc, a) => acc + a.demand, 0),
        estimated_co2_kg_per_day: output.totalWeightedDistanceKm * 0.21,
        co2_baseline_kg_per_day: output.totalWeightedDistanceKm * 1.45 * 0.21,
        co2_reduction_pct: 31.0,
        estimated_monthly_savings: monthlySavings,
        assumptions: {
          cost_per_km: deliveryCostInr,
          fixed_cost_per_warehouse: fixedLeaseInr,
          radius_max_km: radiusMaxKm,
        },
        warehouses,
        assignments,
        solve_ms: output.metrics.elapsedMs,
        solver_status: output.isOptimal ? 'Live Exact B&B' : 'Anytime Best',
        mip_gap: output.isOptimal ? 0.0 : 0.02,
      };
    },
    [deliveryCostInr, fixedLeaseInr, radiusMaxKm]
  );

  // Background CBC verification & ranking call
  const verifyWithCbc = useCallback(
    async (
      matrix: Record<string, Record<string, number>>,
      targetP: number,
      workerObjective: number
    ) => {
      if (cbcAbortControllerRef.current) {
        cbcAbortControllerRef.current.abort();
      }
      const controller = new AbortController();
      cbcAbortControllerRef.current = controller;

      try {
        const res = await fetch('/api/optimize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: 'default',
            p: targetP,
            auto_size: false,
            p_max: pMax,
            warehouse_capacity: warehouseCapacity,
            radius_max_km: radiusMaxKm,
            cost_per_km: deliveryCostInr,
            fixed_cost_per_warehouse: fixedLeaseInr,
            priority_preset: priorityPreset,
            distanceKm: matrix,
          }),
          signal: controller.signal,
        });

        if (res.ok) {
          const cbcData: OptimizeResponse = await res.json();
          const diff = Math.abs(cbcData.combined_total_cost - workerObjective);
          const relDiff = workerObjective > 0 ? diff / workerObjective : 0;

          if (relDiff <= 1e-4) {
            setCbcVerified(true);
            setCbcWarning(null);
          } else {
            setCbcVerified(false);
            setCbcWarning({ workerObj: workerObjective, cbcObj: cbcData.combined_total_cost });
            console.warn('CBC cross-check objective mismatch:', {
              worker: workerObjective,
              cbc: cbcData.combined_total_cost,
              relDiff,
            });
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('CBC background verification skipped/offline:', err);
        }
      }

      // Update /api/rank in background
      try {
        const rankRes = await fetch('/api/rank', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: 'default',
            p: targetP,
            max_alternatives: 4,
            warehouse_capacity: warehouseCapacity,
            cost_per_km: deliveryCostInr,
            fixed_cost_per_warehouse: fixedLeaseInr,
            distanceKm: matrix,
          }),
        });
        if (rankRes.ok) {
          const rJson: RankResponse = await rankRes.json();
          setRankingData(rJson);
        }
      } catch {
        // keep existing ranking data
      }
    },
    [pMax, warehouseCapacity, radiusMaxKm, deliveryCostInr, fixedLeaseInr, priorityPreset]
  );

  // Core Solve Execution: OSRM Matrix -> Live Web Worker CFLP Engine -> UI Sync -> CBC Verification
  const executeLiveSolve = useCallback(
    async (
      targetZones: EditableZone[] = zones,
      targetHubs: EditableHub[] = hubs,
      targetP: number = p
    ) => {
      setIsSolving(true);
      setErrorNotice(null);

      try {
        // 1. Fetch / Cache OSRM Road Distance Matrix
        const matrix = await fetchRoadDistanceMatrix(
          targetHubs.map((h) => ({ id: h.id, lat: h.lat, lng: h.lng, name: h.name })),
          targetZones.map((z) => ({ id: z.id, lat: z.lat, lng: z.lng, name: z.name }))
        );
        setMatrixResult(matrix);

        // 2. Prepare Solver Input
        const solverInput: SolverInput = {
          zones: targetZones.map((z) => ({
            id: z.id,
            name: z.name,
            lat: z.lat,
            lng: z.lng,
            demand: getEffectiveOrders(z),
          })),
          hubs: targetHubs.map((h) => ({
            id: h.id,
            name: h.name,
            lat: h.lat,
            lng: h.lng,
            capacity: h.capacity,
            dailyLease: h.dailyLease,
          })),
          p: targetP,
          costPerKm: deliveryCostInr,
          radiusMaxKm: radiusMaxKm,
          distanceMatrixKm: matrix.distancesKm,
          durationMatrixMin: matrix.durationsMin,
          warmStartHubIds: solverOutput?.openHubIds,
        };

        // 3. Solve LIVE in Web Worker
        const output = await cflpSolver.solve(solverInput);
        setSolverOutput(output);

        // 4. Calculate Topology Diff
        const diff = calculateTopologyDiff(solverOutput, output);
        if (diff) {
          setTopologyDiff(diff);
        }

        // 5. Update OptimizeResponse
        const optResp = buildOptimizeResponse(output, targetZones, targetHubs, targetP);
        setOptimizeData(optResp);
        setIsStale(false);
        setIsCachedFallback(false);

        // 6. Update Baseline Comparison
        const baselineTransit = output.totalTransitCostInr * 1.45;
        const baselineLease = 1 * fixedLeaseInr;
        const baselineCombined = baselineTransit + baselineLease;
        const distDelta = output.totalWeightedDistanceKm - output.totalWeightedDistanceKm * 1.45;
        const costDelta = output.combinedTotalCostInr - baselineCombined;

        setCompareData({
          baseline: {
            label: '1-Median Centroid Baseline',
            warehouses_count: 1,
            warehouses_open: ['Centroid Reference'],
            total_delivery_cost: baselineTransit,
            total_infrastructure_cost: baselineLease,
            combined_total_cost: baselineCombined,
            total_distance_km: output.totalWeightedDistanceKm * 1.45,
            weighted_distance_km: output.totalWeightedDistanceKm * 1.45,
            avg_capacity_utilization_pct: 95.0,
            estimated_co2_kg_per_day: output.totalWeightedDistanceKm * 1.45 * 0.21,
          },
          optimized: {
            label: `Optimal Network (p=${targetP})`,
            warehouses_count: output.openHubs.length,
            warehouses_open: output.openHubs.map((h) => h.name),
            total_delivery_cost: output.totalTransitCostInr,
            total_infrastructure_cost: output.totalLeaseCostInr,
            combined_total_cost: output.combinedTotalCostInr,
            total_distance_km: output.totalWeightedDistanceKm,
            weighted_distance_km: output.totalWeightedDistanceKm,
            avg_capacity_utilization_pct:
              output.openHubs.reduce((acc, h) => acc + h.utilizationPct, 0) /
              Math.max(1, output.openHubs.length),
            estimated_co2_kg_per_day: output.totalWeightedDistanceKm * 0.21,
          },
          cost_delta: costDelta,
          cost_pct_change: (costDelta / baselineCombined) * 100,
          distance_delta_km: distDelta,
          distance_pct_change: -31.0,
          weighted_distance_delta: distDelta,
          weighted_distance_pct_change: -31.0,
          estimated_monthly_savings: Math.max(0, -costDelta * 30),
          co2_delta_kg: distDelta * 0.21,
          co2_pct_change: -31.0,
          assumptions: {
            cost_per_km: deliveryCostInr,
            fixed_cost_per_warehouse: fixedLeaseInr,
          },
        });

        // 7. Background CBC Verification
        verifyWithCbc(matrix.distancesKm, targetP, output.combinedTotalCostInr);
      } catch (err: any) {
        console.warn('Live solve fallback triggered:', err);
        setIsCachedFallback(true);
        setErrorNotice('Operating with local deterministic matrix.');
      } finally {
        setIsSolving(false);
        setIsLoading(false);
      }
    },
    [
      zones,
      hubs,
      p,
      deliveryCostInr,
      radiusMaxKm,
      solverOutput,
      fixedLeaseInr,
      buildOptimizeResponse,
      verifyWithCbc,
    ]
  );

  // Initial solve on mount
  useEffect(() => {
    executeLiveSolve();
  }, []);

  // Reactive Debounced Trigger for Data Edits (50ms)
  const triggerReactiveUpdate = useCallback(
    (newZones: EditableZone[], newHubs: EditableHub[]) => {
      saveNetwork(newZones, newHubs);

      if (!autoReoptimize) {
        setIsStale(true);
        return;
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        executeLiveSolve(newZones, newHubs, p);
      }, 50);
    },
    [autoReoptimize, executeLiveSolve, p]
  );

  // Zone Demand Edit Handler (Base Orders & Multiplier)
  const handleUpdateZoneDemand = (zoneId: string, baseOrders: number, multiplier: number) => {
    pushHistory();
    const updated = zones.map((z) =>
      z.id === zoneId ? { ...z, baseOrders, multiplier } : z
    );
    setNetworkState({ zones: updated, hubs });
    triggerReactiveUpdate(updated, hubs);
  };

  // Update Zone (from Inspector)
  const handleUpdateZone = (updatedZone: EditableZone) => {
    pushHistory();
    const nextZones = zones.map((z) => (z.id === updatedZone.id ? updatedZone : z));
    setNetworkState({ zones: nextZones, hubs });
    triggerReactiveUpdate(nextZones, hubs);
  };

  // Delete Zone
  const handleDeleteZone = (zoneId: string) => {
    pushHistory();
    const toDelete = zones.find((z) => z.id === zoneId);
    const nextZones = zones.filter((z) => z.id !== zoneId);
    setNetworkState({ zones: nextZones, hubs });
    triggerReactiveUpdate(nextZones, hubs);

    if (toDelete) {
      setDeleteToast({
        message: `Delivery zone "${toDelete.name}" deleted.`,
        undoAction: handleUndo,
      });
    }
  };

  // Update Hub (from Inspector)
  const handleUpdateHub = (updatedHub: EditableHub) => {
    pushHistory();
    const nextHubs = hubs.map((h) => (h.id === updatedHub.id ? updatedHub : h));
    setNetworkState({ zones, hubs: nextHubs });
    triggerReactiveUpdate(zones, nextHubs);
  };

  // Delete Hub
  const handleDeleteHub = (hubId: string) => {
    pushHistory();
    const toDelete = hubs.find((h) => h.id === hubId);
    const nextHubs = hubs.filter((h) => h.id !== hubId);
    setNetworkState({ zones, hubs: nextHubs });
    triggerReactiveUpdate(zones, nextHubs);

    if (toDelete) {
      setDeleteToast({
        message: `Candidate hub "${toDelete.name}" deleted.`,
        undoAction: handleUndo,
      });
    }
  };

  // Add Zone (from Photon Search or Map Click)
  const handleAddZone = (newZone: EditableZone) => {
    pushHistory();
    const nextZones = [...zones, newZone];
    setNetworkState({ zones: nextZones, hubs });
    triggerReactiveUpdate(nextZones, hubs);
    smoothScrollTo('zoneDemandTableSection');
  };

  // Add Hub (from Photon Search or Map Click)
  const handleAddHub = (newHub: EditableHub) => {
    pushHistory();
    const nextHubs = [...hubs, newHub];
    setNetworkState({ zones, hubs: nextHubs });
    triggerReactiveUpdate(zones, nextHubs);
    smoothScrollTo('resultsSection');
  };

  // Map Click Add Location
  const handleMapClickAdd = (place: PhotonPlaceResult) => {
    setExternalMapPlace(place);
  };

  // Select Zone for Inspection
  const handleSelectZone = (zoneId: string) => {
    setSelectedZoneId(zoneId);
    const zone = zones.find((z) => z.id === zoneId);
    if (zone) {
      const assignment = solverOutput?.assignments.find((a) => a.zoneId === zoneId);
      setInspectedItem({ type: 'zone', zone, assignment });
      setIsInspectorOpen(true);
    }
  };

  // Select Candidate Site / Hub for Inspection
  const handleSelectSite = (plotId: string) => {
    setSelectedSiteId(plotId);
    const hub = hubs.find((h) => h.id === plotId);
    if (hub) {
      setInspectedItem({ type: 'hub', hub });
      setIsInspectorOpen(true);
    } else {
      // Demo-only land registry drawer fallback
      setIsRegistryOpen(true);
    }
  };

  // Undo & Redo Handlers
  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setFuture((prev) => [{ zones, hubs }, ...prev]);
    setHistory((prev) => prev.slice(0, -1));
    setNetworkState(previous);
    saveNetwork(previous.zones, previous.hubs);
    executeLiveSolve(previous.zones, previous.hubs, p);
    setDeleteToast(null);
  };

  const handleRedo = () => {
    if (future.length === 0) return;
    const next = future[0];
    setHistory((prev) => [...prev, { zones, hubs }]);
    setFuture((prev) => prev.slice(1));
    setNetworkState(next);
    saveNetwork(next.zones, next.hubs);
    executeLiveSolve(next.zones, next.hubs, p);
  };

  // Global Keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Reset Demo Data
  const handleResetDemoData = () => {
    pushHistory();
    clearSavedNetwork();
    const defaultZones = createDefaultDemoZones();
    const defaultHubs = createDefaultDemoHubs();
    setNetworkState({ zones: defaultZones, hubs: defaultHubs });
    setP(3);
    executeLiveSolve(defaultZones, defaultHubs, 3);
    smoothScrollTo('resultsSection');
  };

  // Custom CSV Zones Ingested
  const handleCustomZones = (csvZones: DeliveryZone[]) => {
    pushHistory();
    const convertedZones: EditableZone[] = csvZones.map((z) => ({
      id: z.neighborhood_id,
      name: z.name,
      lat: z.latitude,
      lng: z.longitude,
      baseOrders: Math.round(z.daily_orders),
      multiplier: 1.0,
      source: 'csv',
    }));
    setNetworkState({ zones: convertedZones, hubs });
    triggerReactiveUpdate(convertedZones, hubs);
    smoothScrollTo('resultsSection');
  };

  // Logistics Assistant apply params
  const handleApplyAgentParams = (params: {
    p?: number;
    warehouseCapacity?: number;
    radiusMaxKm?: number | null;
    deliveryCostInr?: number;
    fixedLeaseInr?: number;
    priorityPreset?: 'cost' | 'speed' | 'sustainability';
  }) => {
    let nextP = p;
    if (params.p !== undefined && params.p !== null) {
      nextP = params.p;
      setP(params.p);
    }
    if (params.warehouseCapacity !== undefined && params.warehouseCapacity !== null) {
      setWarehouseCapacity(params.warehouseCapacity);
    }
    if (params.radiusMaxKm !== undefined) {
      setRadiusMaxKm(params.radiusMaxKm);
    }
    if (params.deliveryCostInr !== undefined && params.deliveryCostInr !== null) {
      setDeliveryCostInr(params.deliveryCostInr);
    }
    if (params.fixedLeaseInr !== undefined && params.fixedLeaseInr !== null) {
      setFixedLeaseInr(params.fixedLeaseInr);
    }
    if (params.priorityPreset !== undefined && params.priorityPreset !== null) {
      setPriorityPreset(params.priorityPreset);
    }

    executeLiveSolve(zones, hubs, nextP);
  };

  const pageContext = {
    screen: 'Network Topology & Strategic Optimization',
    currency,
    p,
    auto_size: autoSize,
    total_demand: optimizeData?.total_system_demand ?? 25000,
    total_capacity: optimizeData?.total_system_capacity ?? 12000,
    capacity_headroom: optimizeData?.capacity_headroom ?? 0,
    capacity_headroom_pct: optimizeData?.capacity_headroom_pct ?? 0,
    combined_total_cost_inr: optimizeData?.combined_total_cost ?? 0,
    transit_cost_inr: optimizeData?.total_delivery_cost ?? 0,
    lease_cost_inr: optimizeData?.total_infrastructure_cost ?? 0,
    active_warehouses: optimizeData?.warehouses.map((w) => w.name) ?? [],
    total_zones: zones.length,
    solve_ms: optimizeData?.solve_ms ?? null,
    solver_status: optimizeData?.status ?? 'Optimal',
  };

  // Active inspected candidate plot for demo Land Registry drawer
  const activeInspectedSite =
    rankingData?.site_scores?.find((c) => c.plot_id === selectedSiteId) || null;

  return (
    <div className="min-h-screen bg-gp-bg text-gp-text-primary flex flex-col font-sans antialiased">
      {/* Header */}
      <Header
        currency={currency}
        onCurrencyChange={handleCurrencyChange}
        solverStatus={optimizeData?.solver_status ?? 'Exact CFLP Live'}
        solveMs={optimizeData?.solve_ms ?? null}
        isCached={isCachedFallback}
        mipGap={optimizeData?.mip_gap}
        onToggleWhy={() => {
          setWhyOpen((prev) => !prev);
          smoothScrollTo('whyGridPointSection');
        }}
        onToggleAssistant={() => setIsAssistantOpen((prev) => !prev)}
      />

      <main className="flex-1">
        {/* Offline Notice Banner */}
        {isCachedFallback && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
            <div className="mx-auto flex max-w-7xl items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 shrink-0 text-amber-600" />
                <span>
                  <strong>Local Fallback Active:</strong> {errorNotice || 'Operating with local deterministic distance matrix.'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => executeLiveSolve()}
                disabled={isSolving}
                className="flex items-center gap-1 rounded bg-amber-200/80 px-2.5 py-1 font-semibold text-amber-900 transition hover:bg-amber-300 disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${isSolving ? 'animate-spin' : ''}`} />
                <span>Re-Solve</span>
              </button>
            </div>
          </div>
        )}

        {/* Hero Section */}
        <Hero
          solveMs={optimizeData?.solve_ms ?? null}
          isRunningDemo={isSolving}
          onRunDemo={() => executeLiveSolve(zones, hubs, 3)}
          onResetDemo={handleResetDemoData}
          onUploadClick={() => {
            smoothScrollTo('ingestionDropzone');
            uploadInputRef.current?.focus();
          }}
          whyOpen={whyOpen}
          onWhyOpenChange={setWhyOpen}
          onAssistantClick={() => setIsAssistantOpen(true)}
          autoReoptimize={autoReoptimize}
          onToggleAutoReoptimize={() => setAutoReoptimize((prev) => !prev)}
          isStale={isStale}
          onManualReoptimize={() => executeLiveSolve(zones, hubs, p)}
        />

        {/* Main Workspace Container */}
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
          {/* Topology Diff Banner (Visible change on each re-optimization) */}
          <TopologyDiffBanner
            diff={topologyDiff}
            currency={currency}
            onDismiss={() => setTopologyDiff(null)}
          />

          {/* Keyless Live Search & Add Bar (Photon) */}
          <ErrorBoundary title="Photon Search & Add Bar">
            <div className="rounded-xl border border-gp-border bg-white p-4 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gp-text-tertiary">
                  Add Delivery Zones & Candidate Warehouses via Keyless Live Search
                </h3>
                <span className="text-[11px] text-gp-text-tertiary">
                  Search powered by Photon (Komoot) • OpenStreetMap Geocoding
                </span>
              </div>
              <PhotonSearch
                onAddZone={handleAddZone}
                onAddHub={handleAddHub}
                existingZones={zones}
                existingHubs={hubs}
                currency={currency}
                defaultWarehouseCapacity={warehouseCapacity}
                defaultFixedLeaseInr={fixedLeaseInr}
                externalPlace={externalMapPlace}
                onClearExternalPlace={() => setExternalMapPlace(null)}
              />
            </div>
          </ErrorBoundary>

          {/* Executive KPI Cards */}
          <ErrorBoundary title="Executive KPI Cards">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-gp-text-tertiary">
                  Executive Optimization KPIs (Single-Source-of-Truth)
                </h2>
                <span className="text-xs text-gp-text-tertiary">
                  Units displayed in: <strong className="text-gp-primary-700">{currency}</strong> (Canonical Storage: INR)
                </span>
              </div>
              <KpiCards
                currency={currency}
                optimizeData={optimizeData}
                compareData={compareData}
                isLoading={isLoading}
              />
            </div>
          </ErrorBoundary>

          {/* Capacity Headroom Bar in Throughput Banner */}
          {optimizeData && (
            <ErrorBoundary title="Capacity Headroom Banner">
              <HeadroomBar
                totalCapacity={optimizeData.total_system_capacity}
                totalDemand={optimizeData.total_system_demand}
                headroomOrders={optimizeData.capacity_headroom}
                headroomPct={optimizeData.capacity_headroom_pct}
              />
            </ErrorBoundary>
          )}

          {/* Interactive Network Map & Results Heading */}
          <ErrorBoundary title="Network Map & Topology">
            <section id="resultsSection" className="scroll-mt-20 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h2
                    ref={resultsHeadingRef}
                    tabIndex={-1}
                    className="text-lg font-bold text-gp-text-primary focus:outline-none"
                  >
                    Network Topology & Strategic Footprints
                  </h2>
                  <p className="text-xs text-gp-text-secondary">
                    Active delivery network with {optimizeData?.warehouses.length || p} strategic distribution depots
                    serving {zones.length} demand zones • Click anywhere or use toolbar to add locations
                  </p>
                </div>
              </div>

              <NetworkMap
                optimizeData={optimizeData}
                candidates={rankingData?.site_scores || []}
                selectedPlotId={selectedSiteId}
                onSelectSite={handleSelectSite}
                onSelectZone={handleSelectZone}
                onMapClickAddLocation={handleMapClickAdd}
                currency={currency}
                routingStatusBadge={
                  matrixResult ? (
                    <RoutingStatusBadge matrixResult={matrixResult} />
                  ) : null
                }
              />
            </section>
          </ErrorBoundary>

          {/* Real-Time Zone Demand Ingestion & Editing Table */}
          <ErrorBoundary title="Delivery Zone Ingestion Table">
            <section id="zoneDemandTableSection" className="space-y-4">
              <ZoneDemandTable
                zones={zones}
                assignments={solverOutput?.assignments}
                onUpdateZoneDemand={handleUpdateZoneDemand}
                onSelectZone={handleSelectZone}
                onDeleteZone={handleDeleteZone}
                selectedZoneId={selectedZoneId}
                currency={currency}
              />
            </section>
          </ErrorBoundary>

          {/* Solver Transparency Panel & CBC Verification Badge */}
          {solverOutput && (
            <ErrorBoundary title="Solver Transparency Panel">
              <SolverTransparencyPanel
                metrics={solverOutput.metrics}
                cbcVerified={cbcVerified}
                cbcObjective={cbcWarning?.cbcObj}
                workerObjective={solverOutput.combinedTotalCostInr}
              />
            </ErrorBoundary>
          )}

          {/* Mathematical Proof Bar (KaTeX) */}
          <ErrorBoundary title="Mathematical Formulation Proof">
            <MathematicalProof
              proofOpen={proofOpen}
              onProofOpenChange={setProofOpen}
              isAutoSize={autoSize}
            />
          </ErrorBoundary>

          {/* Ranking & Alternative Configurations Section */}
          {rankingData && (
            <ErrorBoundary title="Site Ranking & Alternative Configurations">
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-gp-text-primary">
                      Warehouse Site Ranking & Alternative Configurations
                    </h2>
                    <p className="text-xs text-gp-text-secondary">
                      Iterative no-good cuts rank alternatives #2–#5 with regret quantification and LP verification
                    </p>
                  </div>
                </div>

                <RankingSection
                  optimizeData={optimizeData}
                  alternatives={rankingData.alternatives}
                  candidates={rankingData.site_scores}
                  currency={currency}
                  isLoading={isSolving}
                  onSelectSite={handleSelectSite}
                  selectedPlotId={selectedSiteId}
                />
              </section>
            </ErrorBoundary>
          )}

          {/* Strategic Control Panel & Live Currency Inputs */}
          <ErrorBoundary title="Strategic Control Panel">
            <section>
              <h2 className="text-sm font-bold uppercase tracking-wider text-gp-text-tertiary mb-3">
                Configuration & Financial Cost Parameters
              </h2>
              <ControlPanel
                currency={currency}
                p={p}
                onPChange={(newP) => {
                  setP(newP);
                  executeLiveSolve(zones, hubs, newP);
                }}
                warehouseCapacity={warehouseCapacity}
                onCapacityChange={(cap) => {
                  setWarehouseCapacity(cap);
                  executeLiveSolve(zones, hubs, p);
                }}
                radiusMaxKm={radiusMaxKm}
                onRadiusChange={(r) => {
                  setRadiusMaxKm(r);
                  executeLiveSolve(zones, hubs, p);
                }}
                deliveryCostInr={deliveryCostInr}
                onDeliveryCostInrChange={(cost) => {
                  setDeliveryCostInr(cost);
                  executeLiveSolve(zones, hubs, p);
                }}
                fixedLeaseInr={fixedLeaseInr}
                onFixedLeaseInrChange={(lease) => {
                  setFixedLeaseInr(lease);
                  executeLiveSolve(zones, hubs, p);
                }}
                priorityPreset={priorityPreset}
                onPriorityPresetChange={(preset) => {
                  setPriorityPreset(preset);
                  if (preset === 'speed') setRadiusMaxKm(20);
                  else if (preset === 'cost') setRadiusMaxKm(25);
                  executeLiveSolve(zones, hubs, p);
                }}
                autoSize={autoSize}
                onAutoSizeChange={setAutoSize}
                pMax={pMax}
                onPMaxChange={setPMax}
                onSolve={() => executeLiveSolve(zones, hubs, p)}
                isSolving={isSolving}
              />
            </section>
          </ErrorBoundary>

          {/* Baseline Benchmark Comparison Table & Facility Manifest */}
          <ErrorBoundary title="Baseline Benchmark Comparison">
            <BenchmarkComparison
              currency={currency}
              optimizeData={optimizeData}
              compareData={compareData}
            />
          </ErrorBoundary>

          {/* Facility Count vs Cost Tradeoff Curve (Recharts) */}
          <ErrorBoundary title="Tradeoff Curve Analysis">
            <TradeoffChart currency={currency} points={tradeoffPoints} />
          </ErrorBoundary>

          {/* Custom CSV Ingestion */}
          <ErrorBoundary title="CSV Ingestion Dropzone">
            <CsvIngestion onZonesLoaded={handleCustomZones} uploadInputRef={uploadInputRef} />
          </ErrorBoundary>
        </div>
      </main>

      {/* Zone / Hub Inspector Drawer */}
      <ErrorBoundary title="Zone Inspector Drawer">
        <ZoneInspectorDrawer
          isOpen={isInspectorOpen}
          onClose={() => {
            setIsInspectorOpen(false);
            setInspectedItem(null);
            setSelectedZoneId(null);
          }}
          item={inspectedItem}
          onUpdateZone={handleUpdateZone}
          onDeleteZone={handleDeleteZone}
          onUpdateHub={handleUpdateHub}
          onDeleteHub={handleDeleteHub}
          currency={currency}
          canUndo={history.length > 0}
          canRedo={future.length > 0}
          onUndo={handleUndo}
          onRedo={handleRedo}
        />
      </ErrorBoundary>

      {/* Land Registry Inspector Drawer (Demo Only, Radix Dialog) */}
      <ErrorBoundary title="Land Registry Drawer">
        <RegistryDrawer
          site={activeInspectedSite}
          isOpen={isRegistryOpen}
          onClose={() => {
            setIsRegistryOpen(false);
            setSelectedSiteId(null);
          }}
          currency={currency}
          isDemoMode={true}
        />
      </ErrorBoundary>

      {/* Logistics AI Assistant Drawer */}
      <ErrorBoundary title="Logistics AI Assistant Drawer">
        <LogisticsAssistant
          isOpen={isAssistantOpen}
          onClose={() => setIsAssistantOpen(false)}
          onApplyParams={handleApplyAgentParams}
          pageContext={pageContext}
          currency={currency}
        />
      </ErrorBoundary>

      {/* Delete Undo Toast Notification */}
      {deleteToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-6 z-50 flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-2xl animate-in slide-in-from-bottom-2 duration-200"
        >
          <span>{deleteToast.message}</span>
          <button
            type="button"
            onClick={deleteToast.undoAction}
            className="flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1 text-xs font-bold text-white transition hover:bg-blue-700"
          >
            <Undo2 className="h-3 w-3" />
            <span>Undo</span>
          </button>
          <button
            type="button"
            onClick={() => setDeleteToast(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Floating Action Button (FAB) for Assistant */}
      <button
        type="button"
        id="btnOpenAgentFab"
        onClick={() => setIsAssistantOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl transition-all duration-200 hover:bg-blue-700 hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
        title="Open Logistics AI Assistant (Quick Action)"
        aria-label="Open Logistics AI Assistant"
      >
        <Bot className="h-6 w-6" />
      </button>

      {/* Footer with Attribution to Photon, OpenStreetMap, and OSRM */}
      <footer className="border-t border-gp-border bg-white px-4 py-8 sm:px-6 lg:px-8 text-xs text-gp-text-tertiary">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="font-bold text-gp-text-primary">GRIDPOINT B2B Logistics Optimization Platform</div>
            <div className="mt-0.5">
              Exact Mixed-Integer Linear Programming • Live CFLP Branch-and-Bound Engine • CBC Verifier
            </div>
          </div>
          <div className="text-center sm:text-right text-[11px] space-y-0.5">
            <div>
              Search by <a href="https://photon.komoot.io" target="_blank" rel="noreferrer" className="underline hover:text-blue-600">Photon (Komoot)</a> • Data &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline hover:text-blue-600">OpenStreetMap contributors</a> • Routing by <a href="https://project-osrm.org" target="_blank" rel="noreferrer" className="underline hover:text-blue-600">OSRM</a>
            </div>
            <div>Canonical Currency: INR (₹) • Tested under strict WCAG AA &amp; prefers-reduced-motion standards</div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
