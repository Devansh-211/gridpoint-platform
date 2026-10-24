import React, { useState, useMemo, useEffect } from 'react';
import { PageHeader } from '../shell/PageHeader';
import { NetworkMap } from '../NetworkMap';
import { ZoneDemandTable } from '../ZoneDemandTable';
import { PhotonSearch } from '../PhotonSearch';
import { PhotonPlaceResult } from '../../services/photonService';
import { EditableZone, EditableHub, getEffectiveOrders } from '../../lib/networkState';
import { OptimizeResponse, Currency, SiteScoreItem } from '../../types';
import { OsrmMatrixResult, haversineKm } from '../../services/osrmMatrixService';
import { calculateHourlyOrders, PEAK_HOUR_LABEL } from '../../lib/demandProfile';
import { formatMoney } from '../../lib/currency';
import {
  MapPin,
  TrendingUp,
  Activity,
  Undo2,
  Redo2,
  RefreshCw,
  Pin,
  X,
  Crosshair,
  Trash2,
} from 'lucide-react';

interface DemandMapViewProps {
  currency: Currency;
  zones: EditableZone[];
  hubs: EditableHub[];
  optimizeData: OptimizeResponse | null;
  candidates?: SiteScoreItem[];
  matrixResult: OsrmMatrixResult | null;
  selectedZoneId: string | null;
  onSelectZone: (zoneId: string) => void;
  onUpdateZoneDemand: (zoneId: string, baseOrders: number, multiplier?: number) => void;
  onDeleteZone: (zoneId: string) => void;
  onAddZone: (zone: EditableZone) => void;
  onAddHub: (hub: EditableHub) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  autoReoptimize: boolean;
  onToggleAutoReoptimize: () => void;
  pinnedAssignments: Record<string, string>;
  onPinAssignment: (zoneId: string, hubId: string) => void;
  onUnpinAssignment: (zoneId: string) => void;
  onSelectSite: (plotId: string) => void;
  selectedPlotId: string | null;
  routingStatusBadge?: React.ReactNode;
  onMapClickAddLocation?: (place: PhotonPlaceResult) => void;
  externalPlace?: PhotonPlaceResult | null;
  onClearExternalPlace?: () => void;
  radiusMaxKm?: number | null;
  deliveryCostInr?: number;
}

export const DemandMapView: React.FC<DemandMapViewProps> = ({
  currency,
  zones,
  hubs,
  optimizeData,
  candidates,
  matrixResult,
  selectedZoneId,
  onSelectZone,
  onUpdateZoneDemand,
  onDeleteZone,
  onAddZone,
  onAddHub,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  autoReoptimize,
  onToggleAutoReoptimize,
  pinnedAssignments,
  onPinAssignment,
  onUnpinAssignment,
  onSelectSite,
  selectedPlotId,
  routingStatusBadge,
  onMapClickAddLocation,
  externalPlace,
  onClearExternalPlace,
  radiusMaxKm = 25,
  deliveryCostInr = 125,
}) => {
  // Layer Toggles
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showCentroids, setShowCentroids] = useState(true);
  const [showVoronoi, setShowVoronoi] = useState(true);
  const [showCandidates, setShowCandidates] = useState(true);

  // Map state
  const [mapCenter] = useState({ lat: 12.9716, lng: 77.5946 });
  const [mapZoom] = useState(11);
  const [isClickToAddActive, setIsClickToAddActive] = useState(false);
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [targetPinHubId, setTargetPinHubId] = useState<string>('');

  // Listen for Escape key to exit map click mode
  useEffect(() => {
    if (!isClickToAddActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsClickToAddActive(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isClickToAddActive]);

  // Active zone
  const activeZone = useMemo(() => {
    if (!selectedZoneId) return zones[0] || null;
    return zones.find((z) => z.id === selectedZoneId) || zones[0] || null;
  }, [zones, selectedZoneId]);

  // Zone Assignment details
  const activeAssignment = useMemo(() => {
    if (!optimizeData || !activeZone) return null;
    return optimizeData.assignments.find((a) => a.neighborhood_id === activeZone.id) || null;
  }, [optimizeData, activeZone]);

  // Total Demand & Trends
  const totalDemand = useMemo(() => {
    return zones.reduce((sum, z) => sum + getEffectiveOrders(z), 0);
  }, [zones]);

  const baselineOrders = useMemo(() => {
    return zones.reduce((sum, z) => sum + (z.baseOrders || 0), 0);
  }, [zones]);

  const baselineSurgePct = useMemo(() => {
    if (baselineOrders === 0) return 0;
    return Math.round(((totalDemand - baselineOrders) / baselineOrders) * 1000) / 10;
  }, [totalDemand, baselineOrders]);

  const peakZone = useMemo(() => {
    if (zones.length === 0) return null;
    return zones.reduce((max, z) =>
      getEffectiveOrders(z) > getEffectiveOrders(max) ? z : max,
      zones[0]
    );
  }, [zones]);

  const peakOrders = peakZone ? getEffectiveOrders(peakZone) : 0;
  const peakLoadChip = useMemo(() => {
    if (peakOrders > 350) return { label: 'High Load', cls: 'bg-rose-50 text-rose-700 border-rose-100' };
    if (peakOrders >= 200) return { label: 'Medium Load', cls: 'bg-blue-50 text-blue-700 border-blue-100' };
    return { label: 'Nominal Load', cls: 'bg-slate-100 text-slate-700 border-slate-200' };
  }, [peakOrders]);

  const averageRadiusKm = useMemo(() => {
    if (optimizeData && optimizeData.average_distance_km > 0) {
      return Number(optimizeData.average_distance_km.toFixed(1));
    }
    return 4.8;
  }, [optimizeData]);

  // Gravitational Pull score (Demand-weighted inverse-distance relative to all zones)
  const gravityMetric = useMemo(() => {
    if (!activeZone || zones.length <= 1) return { score: 0.5, label: 'Medium' };
    let raw = 0;
    for (const z of zones) {
      if (z.id === activeZone.id) continue;
      const d = haversineKm(activeZone.lat, activeZone.lng, z.lat, z.lng);
      raw += getEffectiveOrders(z) / Math.max(0.5, d);
    }

    const allScores = zones.map((zi) => {
      let s = 0;
      for (const zj of zones) {
        if (zi.id === zj.id) continue;
        const d = haversineKm(zi.lat, zi.lng, zj.lat, zj.lng);
        s += getEffectiveOrders(zj) / Math.max(0.5, d);
      }
      return s;
    });

    const minS = Math.min(...allScores);
    const maxS = Math.max(...allScores);
    const norm = maxS > minS ? (raw - minS) / (maxS - minS) : 0.5;
    const rounded = Number(norm.toFixed(2));
    const label = rounded >= 0.7 ? 'High' : rounded >= 0.35 ? 'Medium' : 'Low';
    return { score: rounded, label };
  }, [activeZone, zones]);

  // Intraday profile for active zone
  const hourlyData = useMemo(() => {
    if (!activeZone) return [];
    return calculateHourlyOrders(getEffectiveOrders(activeZone));
  }, [activeZone]);

  // Active Layer Count
  const activeLayersCount = [showHeatmap, showCentroids, showVoronoi, showCandidates].filter(Boolean).length;

  // Real Reassignment impact
  const reassignmentImpact = useMemo(() => {
    if (!activeZone || !targetPinHubId) return null;
    const targetHub = hubs.find((h) => h.id === targetPinHubId);
    if (!targetHub) return null;
    const orders = getEffectiveOrders(activeZone);

    const curDist = activeAssignment?.distance_km ?? 5.0;
    const curCostInr = orders * curDist * (deliveryCostInr / 100);

    const newDist =
      matrixResult?.distancesKm[targetHub.id]?.[activeZone.id] ??
      haversineKm(targetHub.lat, targetHub.lng, activeZone.lat, activeZone.lng) * 1.34;
    const newCostInr = orders * newDist * (deliveryCostInr / 100);
    const costDeltaInr = Math.round(newCostInr - curCostInr);

    const curHubAssignedDemand =
      optimizeData?.warehouses.find((w) => w.warehouse_id === targetPinHubId)?.assigned_demand ?? 0;
    const newDemand = curHubAssignedDemand + orders;
    const utilBefore = Math.round((curHubAssignedDemand / targetHub.capacity) * 100);
    const utilAfter = Math.round((newDemand / targetHub.capacity) * 100);
    const feasible = newDemand <= targetHub.capacity;

    return {
      costDeltaInr,
      utilBefore,
      utilAfter,
      feasible,
      newDist,
    };
  }, [activeZone, targetPinHubId, hubs, activeAssignment, matrixResult, deliveryCostInr, optimizeData]);

  return (
    <div className="space-y-6">
      {/* 1. Page Header Row */}
      <PageHeader
        breadcrumbs={[
          { label: 'Core Workspace', href: '#/overview' },
          { label: 'Demand Map & Spatial Catchments' },
        ]}
        title="Demand Map & Catchment Topology"
        description="Real-world OSRM routing mesh, live demand centroid heatmaps, and Voronoi facility catchment partitions across the metropolitan cluster."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-1 transition ${
                canUndo ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50' : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
              }`}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Undo</span>
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-1 transition ${
                canRedo ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50' : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
              }`}
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Redo</span>
            </button>
            <button
              type="button"
              onClick={onToggleAutoReoptimize}
              className={`px-3 py-2 rounded-lg text-xs font-bold border transition flex items-center gap-1.5 ${
                autoReoptimize
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${autoReoptimize ? 'text-emerald-600' : 'text-amber-600'}`} />
              <span className="whitespace-nowrap">{autoReoptimize ? 'Auto-Solve ON' : 'Auto-Solve OFF'}</span>
            </button>
          </div>
        }
      />

      {isClickToAddActive && (
        <div className="mx-4 sm:mx-6 lg:mx-8 flex items-center justify-between rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs font-semibold text-blue-900 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <Crosshair className="h-4 w-4 text-blue-600 animate-pulse" />
            <span>Click on the map to drop a new demand node (or press Esc to cancel)</span>
          </div>
          <button
            type="button"
            onClick={() => setIsClickToAddActive(false)}
            className="text-xs font-bold text-blue-700 hover:text-blue-900 underline"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="px-4 sm:px-6 lg:px-8 space-y-6">
        {/* 2. Top KPI Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Order Volume */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>Total Order Volume</span>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                {totalDemand.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500 font-medium">ord/day</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold">
              {baselineSurgePct !== 0 ? (
                <>
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      baselineSurgePct > 0 ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                  />
                  <span className={baselineSurgePct > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                    {baselineSurgePct > 0 ? `+${baselineSurgePct}%` : `${baselineSurgePct}%`} baseline change
                  </span>
                </>
              ) : (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-slate-500 font-medium">At nominal baseline</span>
                </>
              )}
            </div>
          </div>

          {/* Card 2: Peak Demand Zone */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>Peak Demand Zone</span>
              <Activity className="h-4 w-4 text-blue-600" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl font-bold tracking-tight text-slate-900 truncate">
                {peakZone?.name || '—'}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 tabular-nums whitespace-nowrap">
                {peakZone ? `${peakOrders.toLocaleString()} ord/day` : '0 ord/day'}
              </span>
              <span className={`rounded-md px-2 py-0.5 text-[10.5px] font-bold border ${peakLoadChip.cls}`}>
                {peakLoadChip.label}
              </span>
            </div>
          </div>

          {/* Card 3: Average Hub Radius */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>Average Hub Radius</span>
              <MapPin className="h-4 w-4 text-blue-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                {averageRadiusKm.toFixed(1)}
              </span>
              <span className="text-xs text-slate-500 font-medium">km road SLA</span>
            </div>
            <div className="mt-2 text-[11px] font-semibold text-slate-500 whitespace-nowrap">
              Target SLA ring: {radiusMaxKm ? `≤ ${radiusMaxKm} km` : 'Unbounded'}
            </div>
          </div>

          {/* Card 4: Active Layer Overlays */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>Active Layer Overlays</span>
              <span className="text-blue-600 font-bold whitespace-nowrap">{activeLayersCount} of 4 Active</span>
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs font-medium text-slate-700">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showHeatmap}
                  onChange={(e) => setShowHeatmap(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Heatmap</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCentroids}
                  onChange={(e) => setShowCentroids(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Centroids</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showVoronoi}
                  onChange={(e) => setShowVoronoi(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Voronoi</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCandidates}
                  onChange={(e) => setShowCandidates(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Candidates</span>
              </label>
            </div>
          </div>
        </div>

        {/* 3. Search & Location Injection Bar (Photon) */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <PhotonSearch
            onAddZone={onAddZone}
            onAddHub={onAddHub}
            existingZones={zones}
            existingHubs={hubs}
            currency={currency}
            defaultWarehouseCapacity={4000}
            defaultFixedLeaseInr={15000}
            externalPlace={externalPlace || null}
            onClearExternalPlace={onClearExternalPlace || (() => {})}
          />
        </div>

        {/* 4. Center Grid: Interactive Map + Zone Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left: Map Container (2 Columns) */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs relative">
            {/* Top Toolbar Overlay on Map */}
            <div className="absolute top-3 left-3 z-20 flex items-center gap-2 rounded-lg bg-white/90 backdrop-blur-xs px-3 py-1.5 border border-slate-200 text-[11px] font-mono text-slate-700 shadow-xs">
              <span className="font-semibold text-blue-700 whitespace-nowrap">
                {mapCenter.lat.toFixed(4)}° N, {mapCenter.lng.toFixed(4)}° E
              </span>
              <span className="text-slate-300">|</span>
              <span className="whitespace-nowrap">ZOOM {mapZoom}</span>
            </div>

            {/* Top Right Map-Click Toggle */}
            <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsClickToAddActive((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border shadow-xs transition-colors whitespace-nowrap ${
                  isClickToAddActive
                    ? 'bg-blue-600 text-white border-blue-700 ring-2 ring-blue-300'
                    : 'bg-white/95 text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
                title="Click anywhere on the map to add a new delivery zone or candidate warehouse"
              >
                <Crosshair className="h-3.5 w-3.5" />
                <span>{isClickToAddActive ? 'Map Click Mode: ON' : 'Map-Click Add'}</span>
              </button>
            </div>

            <div className="h-[520px] w-full">
              <NetworkMap
                optimizeData={optimizeData}
                candidates={candidates || []}
                selectedPlotId={selectedPlotId}
                onSelectSite={onSelectSite}
                onSelectZone={onSelectZone}
                onMapClickAddLocation={isClickToAddActive ? onMapClickAddLocation : undefined}
                currency={currency}
                routingStatusBadge={routingStatusBadge}
              />
            </div>

            {/* Bottom Legend Overlay */}
            <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-2.5 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-blue-700" />
                  <span>High Demand (&gt;350)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-blue-400" />
                  <span>Medium Demand (200-350)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-slate-300" />
                  <span>Moderate (&lt;200)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 border-t-2 border-dashed border-blue-500" />
                  <span>Voronoi Partition</span>
                </div>
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                {matrixResult?.status === 'all_road'
                  ? 'Distances: OSRM road network'
                  : matrixResult?.status === 'mixed'
                  ? 'Distances: OSRM road + fallback'
                  : 'Distances: Haversine estimated'}
              </div>
            </div>
          </div>

          {/* Right: Zone Inspector Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            {/* Inspector Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-600" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Zone Inspector
                </span>
              </div>
              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-mono font-bold text-blue-700 border border-blue-100 whitespace-nowrap">
                {activeZone ? activeZone.id : '—'}
              </span>
            </div>

            {/* Zone Identity */}
            <div>
              <h2 className="text-base font-bold text-slate-900 truncate">
                {activeZone ? activeZone.name : 'No Zone Selected'}
              </h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {activeZone
                  ? `Demand zone at ${activeZone.lat.toFixed(4)}° N, ${activeZone.lng.toFixed(4)}° E with ${getEffectiveOrders(activeZone).toLocaleString()} daily orders.${activeAssignment?.warehouse_name ? ` Served by strategic depot ${activeAssignment.warehouse_name}.` : ' Standby status.'}`
                  : 'Select a delivery zone from the table or map to inspect catchment metrics.'}
              </p>
            </div>

            {/* Metrics Breakdown Grid */}
            <div className="space-y-2.5 text-xs border-y border-slate-100 py-3">
              {/* Daily Demand with inline adjustment */}
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Daily Demand:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (!activeZone) return;
                      const cur = getEffectiveOrders(activeZone);
                      onUpdateZoneDemand(activeZone.id, Math.max(0, cur - 50));
                    }}
                    className="h-6 w-6 rounded bg-slate-100 font-bold text-slate-600 hover:bg-slate-200 flex items-center justify-center"
                    aria-label="Decrease orders by 50"
                  >
                    -
                  </button>
                  <span className="font-bold text-slate-900 tabular-nums">
                    {activeZone ? `${getEffectiveOrders(activeZone).toLocaleString()} ord/day` : '0 ord/day'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!activeZone) return;
                      const cur = getEffectiveOrders(activeZone);
                      onUpdateZoneDemand(activeZone.id, cur + 50);
                    }}
                    className="h-6 w-6 rounded bg-slate-100 font-bold text-slate-600 hover:bg-slate-200 flex items-center justify-center"
                    aria-label="Increase orders by 50"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Assigned Hub */}
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Assigned Hub:</span>
                <span className="font-semibold text-blue-600 truncate max-w-[160px]">
                  {activeAssignment?.warehouse_name || 'Unassigned'}
                </span>
              </div>

              {/* Haversine Distance */}
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Haversine Distance:</span>
                <span className="font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                  {activeAssignment ? `${activeAssignment.distance_km.toFixed(1)} km` : '—'}
                </span>
              </div>

              {/* Road Detour Factor */}
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Road Detour Factor:</span>
                <span className="font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                  {activeAssignment ? `1.34x (${(activeAssignment.distance_km * 1.34).toFixed(1)} km road)` : '—'}
                </span>
              </div>

              {/* Gravitational Pull */}
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Gravitational Pull:</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10.5px] font-bold ${
                    gravityMetric.label === 'High'
                      ? 'bg-rose-50 text-rose-700'
                      : gravityMetric.label === 'Medium'
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {gravityMetric.label} ({gravityMetric.score.toFixed(2)})
                </span>
              </div>
            </div>

            {/* Modelled Intraday Profile (Assumption) */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-600">INTRADAY PROFILE</span>
                <span className="text-slate-400 font-medium whitespace-nowrap">Modelled profile (assumption) • Peak @ {PEAK_HOUR_LABEL}</span>
              </div>
              <div className="h-16 flex items-end gap-1 pt-2">
                {hourlyData.map((b, i) => (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center group relative"
                  >
                    <div
                      style={{ height: `${Math.max(12, (b.orders / (hourlyData.reduce((m, x) => Math.max(m, x.orders), 1))) * 52)}px` }}
                      className={`w-full rounded-xs transition ${
                        b.isPeak ? 'bg-blue-600' : 'bg-slate-200 group-hover:bg-blue-400'
                      }`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[9.5px] font-mono text-slate-400">
                <span>08:00</span>
                <span>14:00</span>
                <span className="text-blue-600 font-bold">20:00</span>
                <span>23:00</span>
              </div>
            </div>

            {/* Action Buttons: Reassign Hub & Delete Zone */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={() => setIsReassignModalOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 active:scale-[0.98] transition shadow-xs"
              >
                <Pin className="h-3.5 w-3.5" />
                <span>Reassign Zone Hub</span>
              </button>

              {activeZone && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Delete delivery zone "${activeZone.name}"?`)) {
                      onDeleteZone(activeZone.id);
                    }
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50/60 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete Zone</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 5. Zone Demand Breakdown Table */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <ZoneDemandTable
            zones={zones}
            assignments={optimizeData?.assignments as any}
            onUpdateZoneDemand={onUpdateZoneDemand}
            onSelectZone={onSelectZone}
            onDeleteZone={onDeleteZone}
            selectedZoneId={selectedZoneId}
            currency={currency}
            radiusMaxKm={radiusMaxKm}
            pinnedAssignments={pinnedAssignments}
          />
        </div>
      </div>

      {/* Reassign Zone Hub Modal */}
      {isReassignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Reassign Hub Assignment</h3>
                <p className="text-xs text-slate-500">Zone: {activeZone?.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsReassignModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close Dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Target Distribution Depot:</label>
                <select
                  value={targetPinHubId}
                  onChange={(e) => setTargetPinHubId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-600"
                >
                  <option value="">-- Choose Candidate Hub --</option>
                  {hubs.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} (Cap: {h.capacity.toLocaleString()} ord/day)
                    </option>
                  ))}
                </select>
              </div>

              {/* Live Cost & Utilization Delta Calculation */}
              {reassignmentImpact && (
                <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 space-y-1.5">
                  <div className="font-bold text-blue-900">Estimated Reassignment Impact:</div>
                  <div className="flex justify-between text-slate-700">
                    <span>Transit Cost Delta:</span>
                    <span className={`font-semibold ${reassignmentImpact.costDeltaInr <= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {reassignmentImpact.costDeltaInr >= 0 ? '+' : ''}{formatMoney(reassignmentImpact.costDeltaInr, currency)}/day
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>Target Hub Utilization:</span>
                    <span className="font-semibold text-slate-900">
                      {reassignmentImpact.utilBefore}% → {reassignmentImpact.utilAfter}% ({reassignmentImpact.feasible ? 'Feasible' : 'Capacity Exceeded'})
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              {activeZone && pinnedAssignments[activeZone.id] && (
                <button
                  type="button"
                  onClick={() => {
                    onUnpinAssignment(activeZone.id);
                    setIsReassignModalOpen(false);
                  }}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
                >
                  Clear Pin
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsReassignModalOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!targetPinHubId || !activeZone}
                onClick={() => {
                  if (activeZone && targetPinHubId) {
                    onPinAssignment(activeZone.id, targetPinHubId);
                    setIsReassignModalOpen(false);
                  }
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Apply Pin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
