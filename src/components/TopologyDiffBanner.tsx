import React from 'react';
import { TopologyDiff } from '../lib/networkState';
import { Currency } from '../types';
import { formatMoney } from '../lib/currency';
import { GitCompare, TrendingUp, TrendingDown, ArrowRight, X, Layers } from 'lucide-react';

interface TopologyDiffBannerProps {
  diff: TopologyDiff | null;
  currency: Currency;
  onDismiss?: () => void;
}

export const TopologyDiffBanner: React.FC<TopologyDiffBannerProps> = ({
  diff,
  currency,
  onDismiss,
}) => {
  if (!diff) return null;

  const hasStructuralChange =
    diff.openedHubs.length > 0 ||
    diff.closedHubs.length > 0 ||
    diff.reassignedZoneCount > 0 ||
    diff.spilloverZoneCount > 0 ||
    Math.abs(diff.costDeltaInr) > 1;

  if (!hasStructuralChange) return null;

  const isCostIncrease = diff.costDeltaInr > 0;
  const isCostNeutral = Math.abs(diff.costDeltaInr) < 1;

  return (
    <div
      role="region"
      aria-label="Topology Change Summary"
      className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-slate-50/90 p-4 shadow-sm transition-all"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
            <GitCompare className="h-5 w-5" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-slate-900">
                Network Topology Recomputed
              </span>
              {/* Cost Delta Badge */}
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  isCostNeutral
                    ? 'bg-slate-100 text-slate-700'
                    : isCostIncrease
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                }`}
              >
                {!isCostNeutral && (
                  isCostIncrease ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" />
                  )
                )}
                <span>
                  {isCostIncrease ? '+' : isCostNeutral ? '' : '-'}
                  {formatMoney(Math.abs(diff.costDeltaInr), currency)}/day (
                  {diff.costDeltaPct > 0 ? '+' : ''}
                  {diff.costDeltaPct.toFixed(1)}%)
                </span>
              </span>

              {/* Spillover split badge */}
              {diff.spilloverZoneCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-900 border border-purple-200">
                  <Layers className="h-3 w-3" />
                  <span>{diff.spilloverZoneCount} spillover split flow{diff.spilloverZoneCount > 1 ? 's' : ''}</span>
                </span>
              )}
            </div>

            {/* Hub Changes */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700 pt-0.5">
              {diff.openedHubs.length > 0 && (
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-emerald-700">Opened:</span>
                  <span className="rounded bg-emerald-100/80 px-1.5 py-0.5 font-medium text-emerald-900">
                    {diff.openedHubs.join(', ')}
                  </span>
                </div>
              )}

              {diff.closedHubs.length > 0 && (
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-rose-700">Closed:</span>
                  <span className="rounded bg-rose-100/80 px-1.5 py-0.5 font-medium text-rose-900 line-through">
                    {diff.closedHubs.join(', ')}
                  </span>
                </div>
              )}

              {diff.reassignedZoneCount > 0 && (
                <span className="text-slate-600">
                  • <strong>{diff.reassignedZoneCount}</strong> zone{diff.reassignedZoneCount > 1 ? 's' : ''} reassigned
                </span>
              )}

              {/* Utilization shift */}
              <span className="text-slate-600">
                • Utilization: {diff.previousUtilizationPct.toFixed(1)}% <ArrowRight className="inline h-3 w-3" />{' '}
                <strong className="text-slate-900">{diff.currentUtilizationPct.toFixed(1)}%</strong>
              </span>
            </div>
          </div>
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss topology diff"
            className="self-start rounded p-1 text-slate-400 hover:bg-slate-200/50 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};
