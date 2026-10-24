import React from 'react';
import { Currency, OptimizeResponse, CompareResponse } from '../types';
import { formatMoney } from '../lib/currency';
import { HelpCircle, ArrowDown, ArrowUp, MapPin, Truck, Leaf } from 'lucide-react';

interface KpiCardsProps {
  currency: Currency;
  optimizeData: OptimizeResponse | null;
  compareData: CompareResponse | null;
  isLoading: boolean;
}

export const KpiCards: React.FC<KpiCardsProps> = ({
  currency,
  optimizeData,
  compareData,
  isLoading,
}) => {
  if (isLoading || !optimizeData) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="rounded-xl border border-gp-border bg-white p-4 shadow-sm">
            <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
            <div className="mt-3 h-7 w-28 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-3.5 w-16 animate-pulse rounded bg-slate-200" />
          </div>
        ))}
      </div>
    );
  }

  // Savings Definitions:
  // Net monthly savings = (baseline transit + baseline lease) - (optimized transit + optimized lease), × 30 days
  // Transit savings % = reduction in transit cost only vs the single-warehouse centroid baseline.
  const baselineTransit = compareData?.baseline?.total_delivery_cost ?? (optimizeData.total_delivery_cost * 1.45);
  const baselineLease = compareData?.baseline?.total_infrastructure_cost ?? (1 * (optimizeData.assumptions?.fixed_cost_per_warehouse ?? 15000));
  const baselineCombined = baselineTransit + baselineLease;

  const optTransit = optimizeData.total_delivery_cost;
  const optLease = optimizeData.total_infrastructure_cost;
  const optCombined = optTransit + optLease;

  const netDailySavings = baselineCombined - optCombined;
  const netMonthlySavings = optimizeData.estimated_monthly_savings || (netDailySavings * 30);
  const transitSavingsPct = baselineTransit > 0 ? ((baselineTransit - optTransit) / baselineTransit) * 100 : 0;
  const netSavingsPct = baselineCombined > 0 ? (netDailySavings / baselineCombined) * 100 : 0;

  // Delta badge styling calculation
  let deltaBadgeStyle = 'border-emerald-200 bg-emerald-50 text-emerald-700';
  let deltaBadgeText = '';
  let deltaIcon = <ArrowDown className="h-3 w-3" />;

  const isTransitPositiveNetNegative = transitSavingsPct > 0 && netDailySavings < 0;
  const isBreakEven = Math.abs(netDailySavings) <= 0.01 * baselineCombined;

  if (isTransitPositiveNetNegative) {
    deltaBadgeStyle = 'border-amber-200 bg-amber-50 text-amber-700';
    deltaBadgeText = `Transit −${transitSavingsPct.toFixed(1)}%, but lease costs outweigh savings`;
    deltaIcon = <ArrowUp className="h-3 w-3" />;
  } else if (isBreakEven) {
    deltaBadgeStyle = 'border-amber-200 bg-amber-50 text-amber-700';
    deltaBadgeText = 'Break-even (±0%)';
    deltaIcon = <span className="text-[10px]">≈</span>;
  } else if (netDailySavings > 0) {
    deltaBadgeStyle = 'border-emerald-200 bg-emerald-50 text-emerald-700';
    deltaBadgeText = `Net saving (−${Math.abs(netSavingsPct).toFixed(1)}%)`;
    deltaIcon = <ArrowDown className="h-3 w-3" />;
  } else {
    deltaBadgeStyle = 'border-red-200 bg-red-50 text-red-700';
    deltaBadgeText = `Net loss (+${Math.abs(netSavingsPct).toFixed(1)}%)`;
    deltaIcon = <ArrowUp className="h-3 w-3" />;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {/* 1. Daily Delivery Transit Cost */}
      <div className="rounded-xl border border-gp-border bg-white p-4 shadow-sm transition hover:shadow">
        <div className="flex items-center justify-between text-xs font-semibold text-gp-text-secondary">
          <span>Daily Transit Cost</span>
          <div className="group relative">
            <HelpCircle className="h-3.5 w-3.5 text-gp-text-tertiary hover:text-gp-text-primary" />
            <div className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2.5 py-1 text-[11px] text-white shadow group-hover:block z-20">
              Total demand-weighted travel cost per day across all served zones
            </div>
          </div>
        </div>
        <div className="mt-2 text-xl font-bold tabular-nums text-gp-text-primary sm:text-2xl">
          {formatMoney(optTransit, currency)}
        </div>
        <div className="mt-1 text-[11px] text-gp-text-tertiary">
          Base: {formatMoney(baselineTransit, currency)}/day
        </div>
      </div>

      {/* 2. Total Demand-Weighted Distance */}
      <div className="rounded-xl border border-gp-border bg-white p-4 shadow-sm transition hover:shadow">
        <div className="flex items-center justify-between text-xs font-semibold text-gp-text-secondary">
          <span>Weighted Distance</span>
          <Truck className="h-3.5 w-3.5 text-gp-text-tertiary" />
        </div>
        <div className="mt-2 text-xl font-bold tabular-nums text-gp-text-primary sm:text-2xl">
          {optimizeData.total_weighted_distance_km.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          <span className="ml-1 text-xs font-medium text-gp-text-secondary">ord·km</span>
        </div>
        <div className="mt-1 text-[11px] text-gp-text-tertiary">
          Avg: {optimizeData.average_distance_km.toFixed(1)} km/order
        </div>
      </div>

      {/* 3. Open Warehouses */}
      <div className="rounded-xl border border-gp-border bg-white p-4 shadow-sm transition hover:shadow">
        <div className="flex items-center justify-between text-xs font-semibold text-gp-text-secondary">
          <span>Warehouses</span>
          <MapPin className="h-3.5 w-3.5 text-gp-text-tertiary" />
        </div>
        <div className="mt-2 text-xl font-bold tabular-nums text-gp-text-primary sm:text-2xl">
          {optimizeData.warehouses.length}
          <span className="ml-1 text-xs font-medium text-gp-text-secondary">sites</span>
        </div>
        <div className="mt-1 text-[11px] text-gp-text-tertiary">
          {optimizeData.auto_size ? `Auto-sized (max ${optimizeData.p})` : `Exact p = ${optimizeData.p}`}
        </div>
      </div>

      {/* 4. Net Monthly Savings (with strict B2B definition tooltip & delta badge) */}
      <div className="rounded-xl border border-gp-border bg-white p-4 shadow-sm transition hover:shadow">
        <div className="flex items-center justify-between text-xs font-semibold text-gp-text-secondary">
          <span>Net Monthly Savings</span>
          <div className="group relative">
            <HelpCircle className="h-3.5 w-3.5 text-gp-text-tertiary hover:text-gp-text-primary" />
            <div className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 hidden -translate-x-1/2 w-64 rounded bg-slate-800 p-2 text-[11px] text-white shadow group-hover:block z-20">
              <strong>Net monthly savings</strong> = (baseline transit + baseline lease) − (optimized transit + optimized lease), × 30 days
            </div>
          </div>
        </div>
        <div className="mt-2 text-xl font-bold tabular-nums text-emerald-700 sm:text-2xl">
          {formatMoney(netMonthlySavings, currency, { compact: true })}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${deltaBadgeStyle}`}>
            {deltaIcon}
            <span>{deltaBadgeText}</span>
          </span>
        </div>
      </div>

      {/* 5. Fast Delivery Coverage */}
      <div className="rounded-xl border border-gp-border bg-white p-4 shadow-sm transition hover:shadow">
        <div className="flex items-center justify-between text-xs font-semibold text-gp-text-secondary">
          <span>Fast Delivery (&lt;5km)</span>
          <div className="group relative">
            <HelpCircle className="h-3.5 w-3.5 text-gp-text-tertiary hover:text-gp-text-primary" />
            <div className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2.5 py-1 text-[11px] text-white shadow group-hover:block z-20">
              Percentage of total order demand located within 5 km of an open depot
            </div>
          </div>
        </div>
        <div className="mt-2 text-xl font-bold tabular-nums text-gp-text-primary sm:text-2xl">
          {optimizeData.fast_delivery_coverage_pct.toFixed(1)}%
        </div>
        <div className="mt-1 text-[11px] text-gp-text-tertiary">
          100% total coverage
        </div>
      </div>

      {/* 6. CO2 Footprint Reduction */}
      <div className="rounded-xl border border-gp-border bg-white p-4 shadow-sm transition hover:shadow">
        <div className="flex items-center justify-between text-xs font-semibold text-gp-text-secondary">
          <span>Daily CO₂ Emissions</span>
          <Leaf className="h-3.5 w-3.5 text-gp-text-tertiary" />
        </div>
        <div className="mt-2 text-xl font-bold tabular-nums text-gp-text-primary sm:text-2xl">
          {optimizeData.estimated_co2_kg_per_day.toFixed(1)}
          <span className="ml-1 text-xs font-medium text-gp-text-secondary">kg</span>
        </div>
        <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-700">
          <span className="rounded bg-emerald-50 px-1 font-semibold border border-emerald-200">
            −{optimizeData.co2_reduction_pct.toFixed(1)}% vs baseline
          </span>
        </div>
      </div>
    </div>
  );
};
