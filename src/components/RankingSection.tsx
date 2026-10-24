import React, { useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { AlternativeConfig, SiteScoreItem, OptimizeResponse, Currency } from '../types';
import { formatMoney } from '../lib/currency';
import { AlternativesLeaderboard } from './AlternativesLeaderboard';
import { CandidatesTable } from './CandidatesTable';
import { Download, Layers, Award, ListFilter } from 'lucide-react';

interface RankingSectionProps {
  optimizeData: OptimizeResponse | null;
  alternatives: AlternativeConfig[];
  candidates: SiteScoreItem[];
  currency: Currency;
  isLoading?: boolean;
  onSelectSite?: (plotId: string) => void;
  selectedPlotId?: string | null;
}

export const RankingSection: React.FC<RankingSectionProps> = ({
  optimizeData,
  alternatives = [],
  candidates = [],
  currency,
  isLoading = false,
  onSelectSite,
  selectedPlotId,
}) => {
  const [activeTab, setActiveTab] = useState<string>('optimal');

  // Export CSV of leaderboard + all candidate scores
  const handleExportCsv = () => {
    if (!candidates || candidates.length === 0) return;
    const headers = [
      'Site ID',
      'Locality',
      'Latitude',
      'Longitude',
      'Area (sq ft) [Assumed]',
      'Zoning Classification',
      'Capacity (orders/day) [Assumed]',
      'Daily Lease (INR) [Assumed]',
      'Gravity Score (0-100)',
      'Avg Distance to Top 20% Demand (km)',
      'Regret (INR/day)',
      'Status',
      'Evaluation Reason'
    ];

    const rows = candidates.map((c) => [
      `"${c.plot_id}"`,
      `"${c.locality}"`,
      c.lat,
      c.lng,
      c.area_sq_ft,
      `"${c.zoning_type}"`,
      c.capacity_orders_per_day,
      c.effective_daily_lease_inr,
      c.gravity_score,
      c.avg_distance_top_20pct_km,
      c.regret_inr,
      `"${c.status}"`,
      `"${c.reason.replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `gridpoint_candidate_evaluation_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Network Optimization & Candidate Evaluation
          </h2>
          <p className="text-xs text-slate-500">
            Explore the mathematically optimal network, review top ranked alternative configurations, or inspect all candidate sites.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 hover:text-slate-900"
        >
          <Download className="h-3.5 w-3.5 text-slate-500" />
          <span>Export Candidates CSV</span>
        </button>
      </div>

      <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <Tabs.List className="flex items-center gap-2 border-b border-slate-100 pb-2" aria-label="Ranking navigation tabs">
          <Tabs.Trigger
            value="optimal"
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
              activeTab === 'optimal'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Award className="h-4 w-4" />
            <span>Optimal Network (Rank #1)</span>
          </Tabs.Trigger>

          <Tabs.Trigger
            value="alternatives"
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
              activeTab === 'alternatives'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Alternatives Leaderboard (Ranks #2–#5)</span>
            {alternatives && alternatives.length > 0 && (
              <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                activeTab === 'alternatives' ? 'bg-blue-800 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {alternatives.length}
              </span>
            )}
          </Tabs.Trigger>

          <Tabs.Trigger
            value="all"
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
              activeTab === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <ListFilter className="h-4 w-4" />
            <span>All Candidates & Regret Scores</span>
            {candidates && candidates.length > 0 && (
              <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                activeTab === 'all' ? 'bg-blue-800 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {candidates.length}
              </span>
            )}
          </Tabs.Trigger>
        </Tabs.List>

        {/* Tab 1: Optimal Network */}
        <Tabs.Content value="optimal" className="space-y-4 outline-none">
          {optimizeData && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-slate-600">
                    Active Facilities:{' '}
                    <span className="font-semibold text-slate-900">
                      {optimizeData.warehouses.map((w) => w.name).join(', ')}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    Combined Cost: <span className="font-bold text-slate-900">{formatMoney(optimizeData.combined_total_cost, currency)}/day</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Tabs.Content>

        {/* Tab 2: Alternatives Leaderboard */}
        <Tabs.Content value="alternatives" className="space-y-4 outline-none">
          {isLoading && alternatives.length === 0 ? (
            <div className="space-y-3 py-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 w-full animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : (
            <AlternativesLeaderboard
              alternatives={alternatives}
              optimalCostInr={optimizeData?.combined_total_cost || 0}
              currency={currency}
              onSelectSite={onSelectSite}
            />
          )}
        </Tabs.Content>

        {/* Tab 3: All Candidates */}
        <Tabs.Content value="all" className="space-y-4 outline-none">
          {isLoading && candidates.length === 0 ? (
            <div className="space-y-2 py-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 w-full animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : (
            <CandidatesTable
              candidates={candidates}
              currency={currency}
              onSelectSite={onSelectSite}
              selectedPlotId={selectedPlotId}
            />
          )}
        </Tabs.Content>
      </Tabs.Root>
    </section>
  );
};
