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
import {
  DEFAULT_DELIVERY_COST_PER_KM_INR,
  DEFAULT_FIXED_WAREHOUSE_LEASE_INR,
} from './lib/currency';

// Bundled precomputed demo fallback results
import bundledDemoResult from './data/demoResult.json';
import bundledDemoCompare from './data/demoCompare.json';
import bundledDemoZones from './data/demoZones.json';
import bundledDemoTradeoff from './data/demoTradeoff.json';
import bundledDemoRank from './data/demoRank.json';

import { RefreshCw, Info, Bot } from 'lucide-react';

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

  // 2. Demo Mode & Network State
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);
  const [zones, setZones] = useState<DeliveryZone[]>(
    (bundledDemoZones as any).preview || []
  );
  const [p, setP] = useState<number>(3);
  const [warehouseCapacity, setWarehouseCapacity] = useState<number>(4000);
  const [radiusMaxKm, setRadiusMaxKm] = useState<number | null>(25);
  const [deliveryCostInr, setDeliveryCostInr] = useState<number>(DEFAULT_DELIVERY_COST_PER_KM_INR);
  const [fixedLeaseInr, setFixedLeaseInr] = useState<number>(DEFAULT_FIXED_WAREHOUSE_LEASE_INR);
  const [priorityPreset, setPriorityPreset] = useState<'cost' | 'speed' | 'sustainability'>('cost');
  const [autoSize, setAutoSize] = useState<boolean>(false);
  const [pMax, setPMax] = useState<number | null>(6);

  // Active Results State
  const [optimizeData, setOptimizeData] = useState<OptimizeResponse | null>(null);
  const [compareData, setCompareData] = useState<CompareResponse | null>(null);
  const [tradeoffPoints, setTradeoffPoints] = useState<TradeoffPoint[]>(
    (bundledDemoTradeoff as any).points || []
  );
  const [rankingData, setRankingData] = useState<RankResponse | null>(
    bundledDemoRank as any
  );

  // Site Inspection State & URL Deep-Linking
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [isRegistryOpen, setIsRegistryOpen] = useState<boolean>(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState<boolean>(false);

  // Status & Resilience State
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSolving, setIsSolving] = useState<boolean>(false);
  const [isCachedFallback, setIsCachedFallback] = useState<boolean>(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Collapsible sections
  const [whyOpen, setWhyOpen] = useState<boolean>(false);
  const [proofOpen, setProofOpen] = useState<boolean>(false);

  // Refs for aborting stale requests & focusing elements
  const abortControllerRef = useRef<AbortController | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);

  // Helper: smooth scroll respecting prefers-reduced-motion
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

  // URL Deep-Linking check on initial mount (?site=BLR-PL-01)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const siteParam = params.get('site');
    if (siteParam) {
      setSelectedSiteId(siteParam);
      setIsRegistryOpen(true);
    }
  }, []);

  const handleSelectSite = (plotId: string) => {
    setSelectedSiteId(plotId);
    setIsRegistryOpen(true);
    // Update URL query string without reloading page
    const url = new URL(window.location.href);
    url.searchParams.set('site', plotId);
    window.history.pushState({}, '', url.toString());
  };

  const handleCloseRegistry = () => {
    setIsRegistryOpen(false);
    // Remove query string from URL
    const url = new URL(window.location.href);
    url.searchParams.delete('site');
    window.history.pushState({}, '', url.toString());
  };

  // Perform Network Solve
  const executeSolve = useCallback(
    async (overrideParams?: Partial<{ p: number; zones: DeliveryZone[]; isCustom?: boolean }>) => {
      // Abort any in-flight solve
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsSolving(true);
      setErrorNotice(null);

      const targetP = overrideParams?.p ?? p;
      const targetCost = deliveryCostInr;
      const targetLease = fixedLeaseInr;
      const customFlag = overrideParams?.isCustom !== undefined ? overrideParams.isCustom : !isDemoMode;

      // 4-second timeout to fall back gracefully if backend is slow/unreachable
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 4500);

      try {
        const res = await fetch('/api/optimize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: 'default',
            p: targetP,
            auto_size: autoSize,
            p_max: pMax,
            warehouse_capacity: warehouseCapacity,
            radius_max_km: radiusMaxKm,
            cost_per_km: targetCost,
            fixed_cost_per_warehouse: targetLease,
            priority_preset: priorityPreset,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          throw new Error(`Solver API returned ${res.status}: ${res.statusText}`);
        }

        const data: OptimizeResponse = await res.json();
        setOptimizeData(data);
        setIsCachedFallback(false);

        // Fetch Baseline Comparison
        try {
          const compRes = await fetch('/api/compare?session_id=default');
          if (compRes.ok) {
            const compJson: CompareResponse = await compRes.json();
            setCompareData(compJson);
          }
        } catch {
          setCompareData(bundledDemoCompare as any);
        }

        // Fetch Tradeoff
        try {
          const trRes = await fetch(`/api/tradeoff?session_id=default&fixed_cost=${targetLease}&cost_per_km=${targetCost}`);
          if (trRes.ok) {
            const trJson = await trRes.json();
            if (trJson.points) setTradeoffPoints(trJson.points);
          }
        } catch {
          // fallback Tradeoff
        }

        // Fetch /api/rank if in demo mode
        if (!customFlag) {
          try {
            const rankRes = await fetch('/api/rank', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                session_id: 'default',
                p: targetP,
                max_alternatives: 4,
                warehouse_capacity: warehouseCapacity,
                cost_per_km: targetCost,
                fixed_cost_per_warehouse: targetLease,
              }),
            });
            if (rankRes.ok) {
              const rJson: RankResponse = await rankRes.json();
              setRankingData(rJson);
            }
          } catch {
            setRankingData(bundledDemoRank as any);
          }
        } else {
          setRankingData(null);
        }
      } catch (err: any) {
        // Fallback to bundled precomputed result
        console.warn('Backend unavailable or timed out; falling back to bundled demo data', err);
        setIsCachedFallback(true);
        setOptimizeData(bundledDemoResult as any);
        setCompareData(bundledDemoCompare as any);
        setTradeoffPoints((bundledDemoTradeoff as any).points || []);
        if (!customFlag) {
          setRankingData(bundledDemoRank as any);
        }

        if (err.name !== 'AbortError') {
          setErrorNotice('Backend unreachable. Showing cached demo result.');
        } else {
          setErrorNotice('Backend took >4s to respond. Showing cached demo result.');
        }
      } finally {
        clearTimeout(timeoutId);
        setIsSolving(false);
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [p, autoSize, pMax, warehouseCapacity, radiusMaxKm, deliveryCostInr, fixedLeaseInr, priorityPreset, isDemoMode]
  );

  // On mount, preload 36-zone Bengaluru dataset and automatically run baseline vs p=3
  useEffect(() => {
    executeSolve({ p: 3, isCustom: false });
  }, []);

  // Primary CTA: Run Bengaluru Demo (36 Zones)
  const handleRunDemo = async () => {
    if (isSolving) return;
    setIsDemoMode(true);
    setZones((bundledDemoZones as any).preview || []);
    setP(3);
    setAutoSize(false);
    await executeSolve({ p: 3, isCustom: false });

    // Smooth-scroll to results and focus heading
    smoothScrollTo('resultsSection');
    resultsHeadingRef.current?.focus();
  };

  // Secondary CTA: Upload Custom Zones CSV
  const handleUploadClick = () => {
    smoothScrollTo('ingestionDropzone');
    uploadInputRef.current?.focus();
  };

  // When custom zones are ingested
  const handleCustomZones = async (newZones: DeliveryZone[]) => {
    setIsDemoMode(false);
    setZones(newZones);
    try {
      await fetch('/api/neighborhoods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          neighborhoods: newZones.map((z) => ({
            neighborhood_id: z.neighborhood_id,
            name: z.name,
            latitude: z.latitude,
            longitude: z.longitude,
            daily_orders: z.daily_orders,
          })),
        }),
      });
    } catch {
      // offline mode
    }
    await executeSolve({ zones: newZones, isCustom: true });
    smoothScrollTo('resultsSection');
  };

  const handleToggleWhy = () => {
    setWhyOpen((prev) => !prev);
    smoothScrollTo('whyGridPointSection');
  };

  const handlePriorityPresetChange = (newPreset: 'cost' | 'speed' | 'sustainability') => {
    setPriorityPreset(newPreset);
    if (newPreset === 'speed') {
      setRadiusMaxKm(20);
    } else if (newPreset === 'cost') {
      setRadiusMaxKm(25);
    }
  };

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

    executeSolve({
      p: nextP,
      isCustom: !isDemoMode,
    });
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

  // Active inspected site object
  const activeInspectedSite =
    rankingData?.site_scores?.find((c) => c.plot_id === selectedSiteId) || null;

  return (
    <div className="min-h-screen bg-gp-bg text-gp-text-primary flex flex-col font-sans antialiased">
      {/* Header with Currency Toggle & Solver Latency Badge */}
      <Header
        currency={currency}
        onCurrencyChange={handleCurrencyChange}
        solverStatus={optimizeData?.status ?? 'CBC Active'}
        solveMs={optimizeData?.solve_ms ?? null}
        isCached={isCachedFallback}
        mipGap={optimizeData?.mip_gap}
        onToggleWhy={handleToggleWhy}
        onToggleAssistant={() => setIsAssistantOpen((prev) => !prev)}
      />

      <main className="flex-1">
        {/* Cached Demo Notice Banner (if fallback active) */}
        {isCachedFallback && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
            <div className="mx-auto flex max-w-7xl items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 shrink-0 text-amber-600" />
                <span>
                  <strong>Showing cached demo result:</strong> {errorNotice || 'Operating in resilient offline preview mode.'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => executeSolve()}
                disabled={isSolving}
                className="flex items-center gap-1 rounded bg-amber-200/80 px-2.5 py-1 font-semibold text-amber-900 transition hover:bg-amber-300 disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${isSolving ? 'animate-spin' : ''}`} />
                <span>Retry Connection</span>
              </button>
            </div>
          </div>
        )}

        {/* Hero Section */}
        <Hero
          solveMs={optimizeData?.solve_ms ?? null}
          isRunningDemo={isSolving}
          onRunDemo={handleRunDemo}
          onUploadClick={handleUploadClick}
          whyOpen={whyOpen}
          onWhyOpenChange={setWhyOpen}
          onAssistantClick={() => setIsAssistantOpen(true)}
        />

        {/* Main Workspace Container */}
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
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
                    Network Topology & Candidate Footprints
                  </h2>
                  <p className="text-xs text-gp-text-secondary">
                    Active delivery network with {optimizeData?.warehouses.length || 3} strategic distribution depots
                    serving {zones.length || 36} demand zones • Click any candidate site to inspect Land Registry Template
                  </p>
                </div>
              </div>

              <NetworkMap
                optimizeData={optimizeData}
                candidates={rankingData?.site_scores || []}
                selectedPlotId={selectedSiteId}
                onSelectSite={handleSelectSite}
                currency={currency}
              />
            </section>
          </ErrorBoundary>

          {/* Mathematical Proof Bar (KaTeX) */}
          <ErrorBoundary title="Mathematical Formulation Proof">
            <MathematicalProof
              proofOpen={proofOpen}
              onProofOpenChange={setProofOpen}
              isAutoSize={autoSize}
            />
          </ErrorBoundary>

          {/* Ranking & Alternative Configurations Section */}
          {isDemoMode && rankingData && (
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
                onPChange={setP}
                warehouseCapacity={warehouseCapacity}
                onCapacityChange={setWarehouseCapacity}
                radiusMaxKm={radiusMaxKm}
                onRadiusChange={setRadiusMaxKm}
                deliveryCostInr={deliveryCostInr}
                onDeliveryCostInrChange={setDeliveryCostInr}
                fixedLeaseInr={fixedLeaseInr}
                onFixedLeaseInrChange={setFixedLeaseInr}
                priorityPreset={priorityPreset}
                onPriorityPresetChange={handlePriorityPresetChange}
                autoSize={autoSize}
                onAutoSizeChange={setAutoSize}
                pMax={pMax}
                onPMaxChange={setPMax}
                onSolve={() => executeSolve()}
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

      {/* Land Registry Inspector Drawer (Demo Only, Radix Dialog) */}
      <ErrorBoundary title="Land Registry Drawer">
        <RegistryDrawer
          site={activeInspectedSite}
          isOpen={isRegistryOpen}
          onClose={handleCloseRegistry}
          currency={currency}
          isDemoMode={isDemoMode}
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

      {/* Footer with AI Usage Disclosure & Honesty Notice */}
      <footer className="border-t border-gp-border bg-white px-4 py-8 sm:px-6 lg:px-8 text-xs text-gp-text-tertiary">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="font-bold text-gp-text-primary">GRIDPOINT B2B Logistics Optimization Platform</div>
            <div className="mt-0.5">
              Exact Mixed-Integer Linear Programming • PuLP + CBC • OR-Tools CVRP Tour Planning
            </div>
          </div>
          <div className="text-right text-[11px]">
            <div>Canonical Currency: INR (₹) • FX Constant: 85 INR/USD</div>
            <div className="mt-0.5">Tested under strict WCAG AA & prefers-reduced-motion standards</div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
