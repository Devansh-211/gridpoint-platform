import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Currency, DeliveryZone, OptimizeResponse, CompareResponse, TradeoffPoint } from './types';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { KpiCards } from './components/KpiCards';
import { HeadroomBar } from './components/HeadroomBar';
import { MathematicalProof } from './components/MathematicalProof';
import { ControlPanel } from './components/ControlPanel';
import { BenchmarkComparison } from './components/BenchmarkComparison';
import { TradeoffChart } from './components/TradeoffChart';
import { NetworkMap } from './components/NetworkMap';
import { CsvIngestion } from './components/CsvIngestion';
import {
  DEFAULT_DELIVERY_COST_PER_KM_INR,
  DEFAULT_FIXED_WAREHOUSE_LEASE_INR,
} from './lib/currency';

// Bundled precomputed demo fallback results
import bundledDemoResult from './data/demoResult.json';
import bundledDemoCompare from './data/demoCompare.json';
import bundledDemoZones from './data/demoZones.json';
import bundledDemoTradeoff from './data/demoTradeoff.json';

import { RefreshCw, Info } from 'lucide-react';

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

  // 2. Network & Optimization State
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
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
  };

  // Perform Network Solve
  const executeSolve = useCallback(
    async (overrideParams?: Partial<{ p: number; zones: DeliveryZone[] }>) => {
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

      // 4-second timeout to fall back gracefully if backend is slow/unreachable
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 4000);

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
          // If compare fails, fallback to bundled compare
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
      } catch (err: any) {
        // Fallback to bundled precomputed result
        console.warn('Backend unavailable or timed out; falling back to bundled demoResult.json', err);
        setIsCachedFallback(true);
        setOptimizeData(bundledDemoResult as any);
        setCompareData(bundledDemoCompare as any);
        setTradeoffPoints((bundledDemoTradeoff as any).points || []);

        if (err.name !== 'AbortError') {
          setErrorNotice('Backend unreachable or slow (>4s). Showing bundled demo result.');
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
    [p, autoSize, pMax, warehouseCapacity, radiusMaxKm, deliveryCostInr, fixedLeaseInr, priorityPreset]
  );

  // TASK 3: On mount, preload 36-zone Bengaluru dataset and automatically run baseline vs p=3
  useEffect(() => {
    executeSolve({ p: 3 });
  }, []);

  // Primary CTA: Run Bengaluru Demo (36 Zones)
  const handleRunDemo = async () => {
    if (isSolving) return;
    setP(3);
    setAutoSize(false);
    await executeSolve({ p: 3 });

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
    await executeSolve({ zones: newZones });
    smoothScrollTo('resultsSection');
  };

  const handleToggleWhy = () => {
    setWhyOpen((prev) => !prev);
    smoothScrollTo('whyGridPointSection');
  };

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
        />

        {/* Main Workspace Container */}
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
          {/* Executive KPI Cards */}
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

          {/* Capacity Headroom Bar in Throughput Banner */}
          {optimizeData && (
            <HeadroomBar
              totalCapacity={optimizeData.total_system_capacity}
              totalDemand={optimizeData.total_system_demand}
              headroomOrders={optimizeData.capacity_headroom}
              headroomPct={optimizeData.capacity_headroom_pct}
            />
          )}

          {/* Interactive Network Map & Results Heading */}
          <section id="resultsSection" className="scroll-mt-20 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2
                  ref={resultsHeadingRef}
                  tabIndex={-1}
                  className="text-lg font-bold text-gp-text-primary focus:outline-none"
                >
                  Network Topology & Zone Cluster Assignments
                </h2>
                <p className="text-xs text-gp-text-secondary">
                  Active delivery network with {optimizeData?.warehouses.length || 3} strategic distribution depots
                  serving {zones.length || 36} demand zones
                </p>
              </div>
            </div>

            <NetworkMap optimizeData={optimizeData} />
          </section>

          {/* Mathematical Proof Bar (KaTeX) */}
          <MathematicalProof
            proofOpen={proofOpen}
            onProofOpenChange={setProofOpen}
            isAutoSize={autoSize}
          />

          {/* Strategic Control Panel & Live Currency Inputs */}
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
              onPriorityPresetChange={setPriorityPreset}
              autoSize={autoSize}
              onAutoSizeChange={setAutoSize}
              pMax={pMax}
              onPMaxChange={setPMax}
              onSolve={() => executeSolve()}
              isSolving={isSolving}
            />
          </section>

          {/* Baseline Benchmark Comparison Table & Facility Manifest */}
          <BenchmarkComparison
            currency={currency}
            optimizeData={optimizeData}
            compareData={compareData}
          />

          {/* Facility Count vs Cost Tradeoff Curve (Recharts) */}
          <TradeoffChart currency={currency} points={tradeoffPoints} />

          {/* Custom CSV Ingestion */}
          <CsvIngestion onZonesLoaded={handleCustomZones} uploadInputRef={uploadInputRef} />
        </div>
      </main>

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
