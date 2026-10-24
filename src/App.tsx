import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppShell } from './components/shell/AppShell';
import { AppRoute } from './components/shell/Sidebar';
import { useOptimizationPipeline } from './hooks/useOptimizationPipeline';
import { DemandMapView } from './components/views/DemandMapView';
import { NetworkConfigView } from './components/views/NetworkConfigView';
import { OverviewView } from './components/views/OverviewView';
import { OptimizationSolversView } from './components/views/OptimizationSolversView';
import { ScenarioLabView } from './components/views/ScenarioLabView';
import { TacticalFleetView } from './components/views/TacticalFleetView';
import { RegistryDrawer } from './components/RegistryDrawer';
import { LogisticsAssistant } from './components/LogisticsAssistant';
import { RoutingStatusBadge } from './components/RoutingStatusBadge';
import { ErrorBoundary } from './components/ErrorBoundary';
import { EditableZone } from './lib/networkState';
import { PhotonPlaceResult } from './services/photonService';

function getRouteFromHash(): AppRoute {
  if (typeof window === 'undefined') return 'overview';
  const hash = window.location.hash.toLowerCase().replace(/^#\/?/, '');
  switch (hash) {
    case 'map':
      return 'map';
    case 'config':
    case 'network':
      return 'config';
    case 'solvers':
    case 'optimization':
      return 'solvers';
    case 'scenarios':
    case 'scenario':
      return 'scenarios';
    case 'fleet':
      return 'fleet';
    case 'overview':
    default:
      return 'overview';
  }
}

export const App: React.FC = () => {
  // 1. Centralized Optimization Pipeline Hook
  const pipeline = useOptimizationPipeline();

  // 2. Hash Routing State
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() => getRouteFromHash());

  useEffect(() => {
    const handleHashChange = () => {
      const newRoute = getRouteFromHash();
      setCurrentRoute(newRoute);
      // Trigger a resize event so Leaflet maps and Recharts recalculate layout properly
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 50);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleRouteChange = useCallback((newRoute: AppRoute) => {
    window.location.hash = `#/${newRoute}`;
    setCurrentRoute(newRoute);
  }, []);

  // 3. Selection & Modal State
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [isRegistryOpen, setIsRegistryOpen] = useState<boolean>(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState<boolean>(false);
  const [externalMapPlace, setExternalMapPlace] = useState<PhotonPlaceResult | null>(null);

  // Hidden file input for CSV ingestion
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 4. Deep-Linking Check on Mount (?site=PLOT-xxx)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const siteParam = urlParams.get('site');
    if (siteParam) {
      setSelectedSiteId(siteParam);
      setIsRegistryOpen(true);
    }
  }, []);

  // 5. Global Keyboard Shortcuts (Undo/Redo & Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;

      if (e.key === 'Escape') {
        if (isRegistryOpen) setIsRegistryOpen(false);
        if (isAssistantOpen) setIsAssistantOpen(false);
        if (externalMapPlace) setExternalMapPlace(null);
        return;
      }

      if (isInput) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          // Redo
          if (pipeline.canRedo) {
            e.preventDefault();
            pipeline.handleRedo();
          }
        } else {
          // Undo
          if (pipeline.canUndo) {
            e.preventDefault();
            pipeline.handleUndo();
          }
        }
      } else if (modifier && e.key.toLowerCase() === 'y') {
        // Redo on Windows
        if (pipeline.canRedo) {
          e.preventDefault();
          pipeline.handleRedo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pipeline, isRegistryOpen, isAssistantOpen, externalMapPlace]);

  // 6. CSV File Ingestion Handler
  const handleCsvUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.trim().split(/\r?\n/);
        if (lines.length < 2) throw new Error('CSV must contain a header and rows.');

        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
        const idIdx = headers.indexOf('neighborhood_id');
        const nameIdx = headers.indexOf('name');
        const latIdx = headers.indexOf('latitude');
        const lonIdx = headers.indexOf('longitude');
        const demIdx = headers.indexOf('daily_orders');

        if (idIdx === -1 || nameIdx === -1 || latIdx === -1 || lonIdx === -1 || demIdx === -1) {
          throw new Error('CSV must include: neighborhood_id, name, latitude, longitude, daily_orders');
        }

        const newZones: EditableZone[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map((c) => c.trim());
          if (cols.length < 5) continue;
          const id = cols[idIdx];
          const name = cols[nameIdx];
          const lat = parseFloat(cols[latIdx]);
          const lng = parseFloat(cols[lonIdx]);
          const orders = parseFloat(cols[demIdx]);

          if (id && name && !isNaN(lat) && !isNaN(lng) && !isNaN(orders)) {
            newZones.push({
              id,
              name,
              lat,
              lng,
              baseOrders: orders,
              multiplier: 1.0,
              source: 'csv',
            });
          }
        }

        if (newZones.length > 0) {
          // Replace zones and solve
          pipeline.zones.forEach((z) => pipeline.handleDeleteZone(z.id));
          newZones.forEach((z) => pipeline.handleAddZone(z));
          alert(`Successfully loaded ${newZones.length} delivery zones from CSV!`);
        }
      } catch (err: any) {
        alert(`Error parsing CSV: ${err.message || 'Unknown format'}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Find inspected candidate site for registry drawer
  const activeCandidateSite =
    pipeline.rankingData?.site_scores?.find((s) => s.plot_id === selectedSiteId) ||
    pipeline.hubs.find((h) => h.id === selectedSiteId)
      ? {
          plot_id: selectedSiteId!,
          locality: pipeline.hubs.find((h) => h.id === selectedSiteId)?.name || selectedSiteId!,
          lat: pipeline.hubs.find((h) => h.id === selectedSiteId)?.lat || 12.9716,
          lng: pipeline.hubs.find((h) => h.id === selectedSiteId)?.lng || 77.5946,
          area_sq_ft: 40000,
          zoning_type: 'Industrial M-2 (Assumed)',
          capacity_orders_per_day: pipeline.warehouseCapacity,
          daily_lease_inr: pipeline.fixedLeaseInr,
          gravity_score: 90,
          avg_distance_top_20pct_km: 4.5,
          effective_daily_lease_inr: pipeline.fixedLeaseInr,
          regret_inr: 0,
          regret_estimated: false,
          status: 'SELECTED' as const,
          reason: 'Active distribution depot candidate in verified network',
        }
      : null;

  return (
    <AppShell
      currentRoute={currentRoute}
      onRouteChange={handleRouteChange}
      currency={pipeline.currency}
      onCurrencyChange={pipeline.handleCurrencyChange}
      datasetName="Bengaluru Core Network"
      zoneCount={pipeline.zones.length}
      candidateCount={pipeline.hubs.length}
      onSelectBengaluruDemo={pipeline.handleResetDemoData}
      onTriggerCsvUpload={() => fileInputRef.current?.click()}
      solverOnline={pipeline.solverOnline}
      solveMs={pipeline.solveMs}
      onRetrySolverHealth={pipeline.checkHealth}
      onApplyPreset={pipeline.handleApplyPreset}
      onRunOptimizer={pipeline.runManualSolve}
      isSolving={pipeline.isSolving}
      events={pipeline.telemetryEvents}
      onResetDemoData={pipeline.handleResetDemoData}
      onOpenAssistant={() => setIsAssistantOpen(true)}
    >
      {/* Hidden file input for CSV Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleCsvUploadChange}
      />

      {/* Route Views Switcher */}
      {currentRoute === 'overview' && (
        <ErrorBoundary title="Executive Overview View">
          <OverviewView
            currency={pipeline.currency}
            optimizeData={pipeline.optimizeData}
            compareData={pipeline.compareData}
            isLoading={pipeline.isLoading}
            solveMs={pipeline.solveMs}
            topologyDiff={pipeline.topologyDiff}
            onClearTopologyDiff={pipeline.clearTopologyDiff}
            onRunOptimizer={pipeline.runManualSolve}
            isSolving={pipeline.isSolving}
            isStale={pipeline.isStale}
            autoReoptimize={pipeline.autoReoptimize}
            onToggleAutoReoptimize={() => pipeline.setAutoReoptimize(!pipeline.autoReoptimize)}
            onResetDemoData={pipeline.handleResetDemoData}
            errorNotice={pipeline.errorNotice}
          />
        </ErrorBoundary>
      )}

      {currentRoute === 'map' && (
        <ErrorBoundary title="Demand Map View">
          <DemandMapView
            currency={pipeline.currency}
            zones={pipeline.zones}
            hubs={pipeline.hubs}
            optimizeData={pipeline.optimizeData}
            candidates={pipeline.rankingData?.site_scores}
            matrixResult={pipeline.matrixResult}
            selectedZoneId={selectedZoneId}
            onSelectZone={(zId) => setSelectedZoneId(zId)}
            onUpdateZoneDemand={pipeline.handleUpdateZoneDemand}
            onDeleteZone={pipeline.handleDeleteZone}
            onAddZone={pipeline.handleAddZone}
            onAddHub={pipeline.handleAddHub}
            canUndo={pipeline.canUndo}
            canRedo={pipeline.canRedo}
            onUndo={pipeline.handleUndo}
            onRedo={pipeline.handleRedo}
            autoReoptimize={pipeline.autoReoptimize}
            onToggleAutoReoptimize={() => pipeline.setAutoReoptimize(!pipeline.autoReoptimize)}
            pinnedAssignments={pipeline.pinnedAssignments}
            onPinAssignment={pipeline.handlePinAssignment}
            onUnpinAssignment={pipeline.handleUnpinAssignment}
            selectedPlotId={selectedSiteId}
            onSelectSite={(plotId) => {
              setSelectedSiteId(plotId);
              setIsRegistryOpen(true);
            }}
            routingStatusBadge={
              pipeline.matrixResult ? (
                <RoutingStatusBadge matrixResult={pipeline.matrixResult} />
              ) : null
            }
            onMapClickAddLocation={(place) => setExternalMapPlace(place)}
            externalPlace={externalMapPlace}
            onClearExternalPlace={() => setExternalMapPlace(null)}
            radiusMaxKm={pipeline.radiusMaxKm}
            deliveryCostInr={pipeline.deliveryCostInr}
          />
        </ErrorBoundary>
      )}

      {currentRoute === 'config' && (
        <ErrorBoundary title="Network Configuration View">
          <NetworkConfigView
            currency={pipeline.currency}
            zones={pipeline.zones}
            hubs={pipeline.hubs}
            p={pipeline.p}
            onPChange={pipeline.setP}
            warehouseCapacity={pipeline.warehouseCapacity}
            onCapacityChange={pipeline.setWarehouseCapacity}
            radiusMaxKm={pipeline.radiusMaxKm}
            onRadiusChange={pipeline.setRadiusMaxKm}
            deliveryCostInr={pipeline.deliveryCostInr}
            onDeliveryCostInrChange={pipeline.setDeliveryCostInr}
            fixedLeaseInr={pipeline.fixedLeaseInr}
            onFixedLeaseInrChange={pipeline.setFixedLeaseInr}
            priorityPreset={pipeline.priorityPreset}
            onPriorityPresetChange={pipeline.setPriorityPreset}
            autoSize={pipeline.autoSize}
            onAutoSizeChange={pipeline.setAutoSize}
            distanceMode={pipeline.distanceMode}
            onDistanceModeChange={pipeline.setDistanceMode}
            optimizeData={pipeline.optimizeData}
            onResetDefaults={pipeline.handleResetDemoData}
            onSavePreset={(presetName: string) => {
              const saved = JSON.parse(localStorage.getItem('gridpoint_saved_presets') || '[]');
              saved.push({
                name: presetName,
                p: pipeline.p,
                warehouseCapacity: pipeline.warehouseCapacity,
                deliveryCostInr: pipeline.deliveryCostInr,
                fixedLeaseInr: pipeline.fixedLeaseInr,
                radiusMaxKm: pipeline.radiusMaxKm,
              });
              localStorage.setItem('gridpoint_saved_presets', JSON.stringify(saved));
              alert(`Preset "${presetName}" saved!`);
            }}
            onRunSolver={pipeline.runManualSolve}
            isSolving={pipeline.isSolving}
            selectedPlotId={selectedSiteId}
            onSelectSite={(plotId) => {
              setSelectedSiteId(plotId);
              setIsRegistryOpen(true);
            }}
            candidates={pipeline.rankingData?.site_scores}
          />
        </ErrorBoundary>
      )}

      {currentRoute === 'solvers' && (
        <ErrorBoundary title="Optimization & Solvers View">
          <OptimizationSolversView
            currency={pipeline.currency}
            optimizeData={pipeline.optimizeData}
            compareData={pipeline.compareData}
            rankingData={pipeline.rankingData}
            tradeoffPoints={pipeline.tradeoffPoints}
            solverOutput={pipeline.solverOutput}
            cbcVerified={pipeline.cbcVerified}
            cbcWarning={pipeline.cbcWarning}
            solveMs={pipeline.solveMs}
            topologyDiff={pipeline.topologyDiff}
            onClearTopologyDiff={pipeline.clearTopologyDiff}
            onRunOptimizer={pipeline.runManualSolve}
            isSolving={pipeline.isSolving}
            autoSize={pipeline.autoSize}
            selectedPlotId={selectedSiteId}
            onSelectSite={(plotId) => {
              setSelectedSiteId(plotId);
              setIsRegistryOpen(true);
            }}
          />
        </ErrorBoundary>
      )}

      {currentRoute === 'scenarios' && (
        <ErrorBoundary title="Scenario Lab View">
          <ScenarioLabView
            currency={pipeline.currency}
            zones={pipeline.zones}
            hubs={pipeline.hubs}
            p={pipeline.p}
            deliveryCostInr={pipeline.deliveryCostInr}
            warehouseCapacity={pipeline.warehouseCapacity}
            fixedLeaseInr={pipeline.fixedLeaseInr}
            radiusMaxKm={pipeline.radiusMaxKm}
            matrixResult={pipeline.matrixResult}
            baselineOutput={pipeline.solverOutput}
            baselineOptimizeData={pipeline.optimizeData}
            onApplyScenarioAsBaseline={(updatedZones, updatedCost) => {
              updatedZones.forEach((uz) => {
                pipeline.handleUpdateZoneDemand(uz.id, uz.baseOrders, uz.multiplier);
              });
              pipeline.setDeliveryCostInr(updatedCost);
              pipeline.runManualSolve();
            }}
          />
        </ErrorBoundary>
      )}

      {currentRoute === 'fleet' && (
        <ErrorBoundary title="Tactical Fleet View">
          <TacticalFleetView
            currency={pipeline.currency}
            optimizeData={pipeline.optimizeData}
          />
        </ErrorBoundary>
      )}

      {/* Demo Land Registry Template Drawer */}
      <RegistryDrawer
        site={activeCandidateSite}
        isOpen={isRegistryOpen}
        onClose={() => {
          setIsRegistryOpen(false);
          setSelectedSiteId(null);
        }}
        currency={pipeline.currency}
        isDemoMode={true}
      />

      {/* Logistics Copilot Assistant Modal */}
      {isAssistantOpen && (
        <LogisticsAssistant
          isOpen={isAssistantOpen}
          onClose={() => setIsAssistantOpen(false)}
          currency={pipeline.currency}
          pageContext={{
            screen: currentRoute,
            currency: pipeline.currency,
            p: pipeline.p,
            auto_size: pipeline.autoSize,
            total_demand: pipeline.totalDemand,
            total_capacity: pipeline.totalCapacity,
            capacity_headroom: pipeline.capacityHeadroom,
            capacity_headroom_pct: pipeline.capacityHeadroomPct,
            combined_total_cost_inr: pipeline.optimizeData?.combined_total_cost ?? 0,
            transit_cost_inr: pipeline.optimizeData?.total_delivery_cost ?? 0,
            lease_cost_inr: pipeline.optimizeData?.total_infrastructure_cost ?? 0,
            active_warehouses: pipeline.optimizeData?.warehouses.map((w) => w.name) ?? [],
            total_zones: pipeline.zones.length,
            solve_ms: pipeline.solveMs,
            solver_status: pipeline.optimizeData?.status ?? 'Optimal',
          }}
          onApplyParams={(params) => {
            if (params.p) pipeline.setP(params.p);
            if (params.warehouseCapacity) pipeline.setWarehouseCapacity(params.warehouseCapacity);
            if (params.deliveryCostInr) pipeline.setDeliveryCostInr(params.deliveryCostInr);
            if (params.fixedLeaseInr) pipeline.setFixedLeaseInr(params.fixedLeaseInr);
            if (params.priorityPreset) pipeline.setPriorityPreset(params.priorityPreset);
            pipeline.runManualSolve();
          }}
        />
      )}
    </AppShell>
  );
};

export default App;
