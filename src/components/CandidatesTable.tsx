import React, { useState, useMemo } from 'react';
import { SiteScoreItem, Currency } from '../types';
import { formatMoney } from '../lib/currency';
import {
  ArrowUpDown,
  Filter,
  ChevronRight,
  ShieldCheck,
  Building2,
} from 'lucide-react';

interface CandidatesTableProps {
  candidates: SiteScoreItem[];
  currency: Currency;
  onSelectSite?: (plotId: string) => void;
  selectedPlotId?: string | null;
}

type SortField =
  | 'plot_id'
  | 'locality'
  | 'gravity_score'
  | 'avg_distance_top_20pct_km'
  | 'effective_daily_lease_inr'
  | 'regret_inr'
  | 'status';

export const CandidatesTable: React.FC<CandidatesTableProps> = ({
  candidates,
  currency,
  onSelectSite,
  selectedPlotId,
}) => {
  const [sortField, setSortField] = useState<SortField>('regret_inr');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [zoningFilter, setZoningFilter] = useState<string>('ALL');

  const uniqueZonings = useMemo(() => {
    const set = new Set<string>();
    candidates.forEach((c) => {
      if (c.zoning_type) set.add(c.zoning_type);
    });
    return Array.from(set);
  }, [candidates]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === 'status' || field === 'locality' || field === 'plot_id');
    }
  };

  const filteredAndSorted = useMemo(() => {
    let list = [...candidates];

    if (statusFilter !== 'ALL') {
      list = list.filter((c) => c.status === statusFilter);
    }

    if (zoningFilter !== 'ALL') {
      list = list.filter((c) => c.zoning_type === zoningFilter);
    }

    list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'status') {
        const priority: Record<string, number> = { SELECTED: 1, RUNNER_UP: 2, REJECTED: 3 };
        valA = priority[a.status] || 9;
        valB = priority[b.status] || 9;
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    return list;
  }, [candidates, statusFilter, zoningFilter, sortField, sortAsc]);

  return (
    <div className="space-y-4">
      {/* Filters & Count bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs">
            <Filter className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-slate-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent font-medium text-slate-800 outline-hidden"
              aria-label="Filter candidates by status"
            >
              <option value="ALL">All ({candidates.length})</option>
              <option value="SELECTED">Selected</option>
              <option value="RUNNER_UP">Runner-up</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {/* Zoning Filter */}
          {uniqueZonings.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs">
              <Building2 className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-slate-500">Zoning:</span>
              <select
                value={zoningFilter}
                onChange={(e) => setZoningFilter(e.target.value)}
                className="bg-transparent font-medium text-slate-800 outline-hidden"
                aria-label="Filter candidates by zoning classification"
              >
                <option value="ALL">All Zonings</option>
                {uniqueZonings.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="text-xs text-slate-500">
          Showing <span className="font-semibold text-slate-800">{filteredAndSorted.length}</span> candidate sites
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-left text-xs" role="table">
          <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-600">
            <tr>
              <th
                scope="col"
                className="px-3 py-3 cursor-pointer select-none"
                onClick={() => handleSort('plot_id')}
                aria-sort={sortField === 'plot_id' ? (sortAsc ? 'ascending' : 'descending') : 'none'}
              >
                <div className="flex items-center gap-1">
                  <span>Site ID</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </div>
              </th>
              <th
                scope="col"
                className="px-3 py-3 cursor-pointer select-none"
                onClick={() => handleSort('locality')}
                aria-sort={sortField === 'locality' ? (sortAsc ? 'ascending' : 'descending') : 'none'}
              >
                <div className="flex items-center gap-1">
                  <span>Locality</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </div>
              </th>
              <th
                scope="col"
                className="px-3 py-3 cursor-pointer select-none text-right"
                onClick={() => handleSort('gravity_score')}
                aria-sort={sortField === 'gravity_score' ? (sortAsc ? 'ascending' : 'descending') : 'none'}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Gravity Score</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </div>
              </th>
              <th
                scope="col"
                className="px-3 py-3 cursor-pointer select-none text-right"
                onClick={() => handleSort('avg_distance_top_20pct_km')}
                aria-sort={sortField === 'avg_distance_top_20pct_km' ? (sortAsc ? 'ascending' : 'descending') : 'none'}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Dist to High-Demand</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </div>
              </th>
              <th
                scope="col"
                className="px-3 py-3 cursor-pointer select-none text-right"
                onClick={() => handleSort('effective_daily_lease_inr')}
                aria-sort={sortField === 'effective_daily_lease_inr' ? (sortAsc ? 'ascending' : 'descending') : 'none'}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Effective Lease</span>
                  <span className="rounded bg-slate-200/70 px-1 text-[9px] text-slate-600 font-normal">Assumed</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </div>
              </th>
              <th
                scope="col"
                className="px-3 py-3 cursor-pointer select-none text-right"
                onClick={() => handleSort('regret_inr')}
                aria-sort={sortField === 'regret_inr' ? (sortAsc ? 'ascending' : 'descending') : 'none'}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Regret</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </div>
              </th>
              <th
                scope="col"
                className="px-3 py-3 cursor-pointer select-none"
                onClick={() => handleSort('status')}
                aria-sort={sortField === 'status' ? (sortAsc ? 'ascending' : 'descending') : 'none'}
              >
                <div className="flex items-center gap-1">
                  <span>Status</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </div>
              </th>
              <th scope="col" className="px-3 py-3">
                Reason & Evaluation
              </th>
              <th scope="col" className="w-10 px-2 py-3 text-center">
                <span className="sr-only">Inspect</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-800">
            {filteredAndSorted.map((c) => {
              const isSelectedRow = selectedPlotId === c.plot_id;
              let statusBadge = (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                  REJECTED
                </span>
              );
              if (c.status === 'SELECTED') {
                statusBadge = (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                    <ShieldCheck className="h-3 w-3 text-emerald-600" />
                    SELECTED
                  </span>
                );
              } else if (c.status === 'RUNNER_UP') {
                statusBadge = (
                  <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                    RUNNER-UP
                  </span>
                );
              }

              return (
                <tr
                  key={c.plot_id}
                  onClick={() => onSelectSite?.(c.plot_id)}
                  className={`cursor-pointer transition-colors hover:bg-slate-50/80 ${
                    isSelectedRow ? 'bg-blue-50/60 font-medium' : ''
                  }`}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectSite?.(c.plot_id);
                    }
                  }}
                  aria-label={`Inspect candidate plot ${c.plot_id} in ${c.locality}`}
                >
                  <td className="px-3 py-3 font-mono text-[11px] text-slate-700">{c.plot_id}</td>
                  <td className="px-3 py-3 font-medium text-slate-900">
                    <div>{c.locality}</div>
                    <div className="text-[10px] font-normal text-slate-500">{c.zoning_type}</div>
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-700">
                    {c.gravity_score.toFixed(1)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-700">
                    {c.avg_distance_top_20pct_km.toFixed(1)} km
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-900">
                    {formatMoney(c.effective_daily_lease_inr, currency)}
                    <span className="text-[10px] font-normal text-slate-500">/day</span>
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">
                    {c.regret_inr === 0 ? (
                      <span className="font-semibold text-emerald-700">₹0/day</span>
                    ) : (
                      <span className="font-semibold text-slate-800">
                        {c.regret_estimated ? '≈ ' : '+'}
                        {formatMoney(c.regret_inr, currency)}/day
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">{statusBadge}</td>
                  <td className="max-w-xs px-3 py-3 text-slate-600 line-clamp-2 text-[11px]">
                    {c.reason}
                  </td>
                  <td className="px-2 py-3 text-center text-slate-400">
                    <ChevronRight className="h-4 w-4" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
