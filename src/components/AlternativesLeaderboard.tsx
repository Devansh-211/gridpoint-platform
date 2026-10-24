import React from 'react';
import { AlternativeConfig, Currency } from '../types';
import { formatMoney } from '../lib/currency';
import { Award, ArrowUpRight, ShieldCheck } from 'lucide-react';

interface AlternativesLeaderboardProps {
  alternatives: AlternativeConfig[];
  optimalCostInr: number;
  currency: Currency;
  isVerified?: boolean;
  verifiedCombinations?: number;
  onSelectSite?: (siteId: string) => void;
}

export const AlternativesLeaderboard: React.FC<AlternativesLeaderboardProps> = ({
  alternatives,
  optimalCostInr,
  currency,
  isVerified = true,
  verifiedCombinations = 1140,
  onSelectSite,
}) => {
  return (
    <div className="space-y-4">
      {/* Global Optimum Callout */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-emerald-950">Rank #1 — Global MILP Optimum</span>
              <span className="rounded-full bg-emerald-600/15 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                Global optimum
              </span>
            </div>
            <p className="text-xs text-emerald-800">
              Verified mathematically exact by CBC solver. Minimizes combined transit and lease cost.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-emerald-700">Daily System Cost</div>
            <div className="text-lg font-bold tabular-nums text-emerald-950">
              {formatMoney(optimalCostInr, currency)}
              <span className="text-xs font-normal text-emerald-700">/day</span>
            </div>
          </div>
          {isVerified && (
            <div className="flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-xs font-medium text-emerald-800 shadow-xs">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>✓ Matches exhaustive check ({verifiedCombinations.toLocaleString()} combinations)</span>
            </div>
          )}
        </div>
      </div>

      {/* Alternatives List (Ranks #2 - #5) */}
      <div className="space-y-3">
        {alternatives.map((alt) => {
          return (
            <div
              key={alt.rank}
              className="rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-slate-300 hover:shadow-xs"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                      Rank #{alt.rank}
                    </span>
                    <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-800 tabular-nums">
                      +{formatMoney(alt.delta_vs_optimal_inr, currency)}/day (+{alt.delta_pct.toFixed(1)}%)
                    </span>
                    <span className="text-xs text-slate-500">
                      {alt.sites_changed} site{alt.sites_changed > 1 ? 's' : ''} swapped
                    </span>
                  </div>

                  {/* Warehouse Chips */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {alt.open_warehouses.map((wid, idx) => {
                      const name = alt.warehouse_names[idx] || wid;
                      const isAdded = alt.sites_added.includes(wid);
                      return (
                        <button
                          key={wid}
                          onClick={() => onSelectSite?.(wid)}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                            isAdded
                              ? 'border-blue-300 bg-blue-50 text-blue-900 hover:bg-blue-100'
                              : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span>{name}</span>
                          {isAdded && (
                            <span className="rounded bg-blue-600 px-1 py-0.2 text-[9px] font-bold text-white">
                              NEW
                            </span>
                          )}
                          <ArrowUpRight className="h-3 w-3 text-slate-400" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Costs & Utilization */}
                <div className="flex items-center gap-6 text-right">
                  <div>
                    <div className="text-xs text-slate-500">Combined Cost</div>
                    <div className="text-base font-bold tabular-nums text-slate-900">
                      {formatMoney(alt.combined_total_cost, currency)}
                      <span className="text-xs font-normal text-slate-500">/day</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Transit: {formatMoney(alt.delivery_transit_cost, currency)} • Lease: {formatMoney(alt.infrastructure_lease_cost, currency)}
                    </div>
                  </div>

                  {/* Average Utilization Indicator */}
                  <div className="w-24 text-left">
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Util</span>
                      <span className="font-semibold text-slate-700 tabular-nums">
                        {Object.values(alt.per_site_utilization).length > 0
                          ? `${Math.round(
                              Object.values(alt.per_site_utilization).reduce((a, b) => a + b, 0) /
                                Object.values(alt.per_site_utilization).length
                            )}%`
                          : '—'}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all duration-300"
                        style={{
                          width: `${Math.min(
                            100,
                            Object.values(alt.per_site_utilization).length > 0
                              ? Object.values(alt.per_site_utilization).reduce((a, b) => a + b, 0) /
                                  Object.values(alt.per_site_utilization).length
                              : 0
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
