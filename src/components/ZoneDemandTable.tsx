import React, { useState, useMemo, useEffect } from 'react';
import { EditableZone, EditableHub, getEffectiveOrders } from '../lib/networkState';
import { ZoneAssignmentResult, AssignmentFraction } from '../solver/types';
import { Currency, AssignmentItem } from '../types';
import { OrderQuantityEditor } from './OrderQuantityEditor';
import {
  Search,
  Trash2,
  Sliders,
  AlertTriangle,
  Clock,
  Navigation,
  Download,
  Pin,
  CheckCircle2,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export type ZoneSortField = 'name' | 'orders' | 'distance' | 'eta' | 'status' | null;

interface ZoneDemandTableProps {
  zones: EditableZone[];
  assignments?: (ZoneAssignmentResult | AssignmentItem)[];
  hubs?: EditableHub[];
  onUpdateZoneDemand: (zoneId: string, baseOrders: number, multiplier: number) => void;
  onSelectZone: (zoneId: string) => void;
  onDeleteZone: (zoneId: string) => void;
  selectedZoneId?: string | null;
  currency?: Currency;
  radiusMaxKm?: number | null;
  pinnedAssignments?: Record<string, string>;
}

export const ZoneDemandTable: React.FC<ZoneDemandTableProps> = ({
  zones,
  assignments = [],
  hubs = [],
  onUpdateZoneDemand,
  onSelectZone,
  onDeleteZone,
  selectedZoneId = null,
  currency = 'INR',
  radiusMaxKm = 25,
  pinnedAssignments = {},
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortField, setSortField] = useState<ZoneSortField>(null);
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Debounce search term by 150ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Map zoneId -> assignment result, supporting both ZoneAssignmentResult and AssignmentItem
  const assignmentMap = useMemo(() => {
    const map = new Map<string, ZoneAssignmentResult>();
    if (!assignments || !Array.isArray(assignments)) return map;

    for (const raw of assignments) {
      if (!raw) continue;
      // Format 1: Native ZoneAssignmentResult
      if ('zoneId' in raw && Array.isArray((raw as ZoneAssignmentResult).hubAssignments)) {
        const item = raw as ZoneAssignmentResult;
        map.set(item.zoneId, item);
      } else {
        // Format 2: OptimizeResponse AssignmentItem
        const item = raw as AssignmentItem;
        const zId = item.neighborhood_id || (item as any).zoneId;
        if (!zId) continue;

        const isUncovered =
          !item.warehouse_id ||
          item.warehouse_id === 'UNASSIGNED' ||
          item.warehouse_name?.toLowerCase().includes('unassigned') ||
          item.distance_km >= 900;

        const hubAssignment: AssignmentFraction = {
          hubId: item.warehouse_id || '',
          hubName: item.warehouse_name || 'Unassigned',
          fraction: 1.0,
          assignedDemand: item.daily_orders || 0,
          distanceKm: item.distance_km || 0,
          durationMin: Math.max(1, Math.round(((item.distance_km || 0) / 28.0) * 60)),
        };

        const existing = map.get(zId);
        if (existing) {
          if (!isUncovered) {
            existing.hubAssignments.push(hubAssignment);
            existing.isCovered = true;
          }
        } else {
          map.set(zId, {
            zoneId: zId,
            zoneName: item.neighborhood_name || (item as any).zoneName || zId,
            demand: item.daily_orders || 0,
            isCovered: !isUncovered,
            hubAssignments: isUncovered ? [] : [hubAssignment],
          });
        }
      }
    }

    // Overlay pinned assignments if hubs lookup is available
    if (hubs && hubs.length > 0 && pinnedAssignments) {
      const hubLookup = new Map(hubs.map((h) => [h.id, h]));
      for (const [zId, hubId] of Object.entries(pinnedAssignments)) {
        const hub = hubLookup.get(hubId);
        if (hub) {
          map.set(zId, {
            zoneId: zId,
            zoneName: zId,
            demand: 0,
            isCovered: true,
            hubAssignments: [
              {
                hubId: hub.id,
                hubName: hub.name,
                fraction: 1.0,
                assignedDemand: 0,
                distanceKm: 0,
                durationMin: 0,
              },
            ],
          });
        }
      }
    }

    return map;
  }, [assignments, hubs, pinnedAssignments]);

  // Aggregate statistics
  const totalOrders = useMemo(() => {
    return zones.reduce((sum, z) => sum + getEffectiveOrders(z), 0);
  }, [zones]);

  const uncoveredCount = useMemo(() => {
    return Array.from(assignmentMap.values()).filter((a) => !a.isCovered).length;
  }, [assignmentMap]);

  // Helper to compute zone status
  const getZoneStatus = (z: EditableZone) => {
    const assignment = assignmentMap.get(z.id);
    if (!assignment || !assignment.isCovered || assignment.hubAssignments.length === 0) {
      return { code: 2, label: 'SLA Breach', level: 'breach' as const };
    }
    const maxDist = Math.max(...assignment.hubAssignments.map((h) => h.distanceKm));
    const maxDur = Math.max(...assignment.hubAssignments.map((h) => h.durationMin));
    const rLimit = radiusMaxKm ?? 25;
    if (maxDist > rLimit * 0.75 || maxDur > 25) {
      return { code: 1, label: 'Transit Warning', level: 'warning' as const };
    }
    return { code: 0, label: 'Optimal Coverage', level: 'optimal' as const };
  };

  // Filtered & Sorted zones
  const processedZones = useMemo(() => {
    let result = zones;
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (z) => z.name.toLowerCase().includes(q) || z.id.toLowerCase().includes(q)
      );
    }

    if (!sortField) return result;

    return [...result].sort((a, b) => {
      if (sortField === 'name') {
        const comp = a.name.localeCompare(b.name);
        return sortAsc ? comp : -comp;
      }
      if (sortField === 'orders') {
        const ordA = getEffectiveOrders(a);
        const ordB = getEffectiveOrders(b);
        return sortAsc ? ordA - ordB : ordB - ordA;
      }
      if (sortField === 'distance') {
        const distA = assignmentMap.get(a.id)?.hubAssignments[0]?.distanceKm ?? 999;
        const distB = assignmentMap.get(b.id)?.hubAssignments[0]?.distanceKm ?? 999;
        return sortAsc ? distA - distB : distB - distA;
      }
      if (sortField === 'eta') {
        const etaA = assignmentMap.get(a.id)?.hubAssignments[0]?.durationMin ?? 999;
        const etaB = assignmentMap.get(b.id)?.hubAssignments[0]?.durationMin ?? 999;
        return sortAsc ? etaA - etaB : etaB - etaA;
      }
      if (sortField === 'status') {
        const statA = getZoneStatus(a).code;
        const statB = getZoneStatus(b).code;
        return sortAsc ? statA - statB : statB - statA;
      }
      return 0;
    });
  }, [zones, debouncedSearch, sortField, sortAsc, assignmentMap, radiusMaxKm]);

  // Pagination calculation
  const totalItems = processedZones.length;
  const totalPages = pageSize > 0 ? Math.ceil(totalItems / pageSize) || 1 : 1;
  const paginatedZones = useMemo(() => {
    if (pageSize <= 0) return processedZones;
    const startIndex = (currentPage - 1) * pageSize;
    return processedZones.slice(startIndex, startIndex + pageSize);
  }, [processedZones, currentPage, pageSize]);

  const handleSort = (field: ZoneSortField) => {
    if (sortField === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // CSV Export
  const handleExportCsv = () => {
    const headers = [
      'Zone ID',
      'Zone Name',
      'Latitude',
      'Longitude',
      'Base Daily Orders',
      'Surge Multiplier',
      'Effective Daily Orders',
      'Assigned Depot ID',
      'Assigned Depot Name',
      'Road Distance (km)',
      'Free-flow ETA (min)',
      'Coverage Status',
      'Currency',
    ];

    const rows = processedZones.map((z) => {
      const assignment = assignmentMap.get(z.id);
      const h0 = assignment?.hubAssignments[0];
      const status = getZoneStatus(z);
      return [
        `"${z.id}"`,
        `"${z.name}"`,
        z.lat.toFixed(6),
        z.lng.toFixed(6),
        z.baseOrders,
        z.multiplier,
        getEffectiveOrders(z),
        h0 ? `"${h0.hubId}"` : '"UNASSIGNED"',
        h0 ? `"${h0.hubName}"` : '"Unassigned"',
        h0 ? h0.distanceKm.toFixed(2) : '0',
        h0 ? h0.durationMin.toFixed(1) : '0',
        `"${status.label}"`,
        `"${currency}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `gridpoint_zone_demand_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="rounded-xl border border-gp-border bg-white shadow-xs overflow-hidden">
      {/* Table Header & Controls */}
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between border-b border-gp-border">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-gp-text-primary">
              Delivery Zone Ingestion &amp; Real-Time Demand Breakdown
            </h3>
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
              {zones.length} Zones
            </span>
            {uncoveredCount > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-800">
                <AlertTriangle className="h-3 w-3" />
                <span>{uncoveredCount} Uncovered</span>
              </span>
            )}
          </div>
          <p className="text-xs text-gp-text-secondary mt-0.5">
            Real road distance (OSRM), free-flow driving ETA, and live-editable order volumes with surge multipliers
          </p>
        </div>

        {/* Search Bar, Export Button & Total Orders Summary */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter zones by name or ID..."
              aria-label="Filter delivery zones"
              className="h-8 w-44 sm:w-56 rounded-lg border border-gp-border pl-8 pr-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
            title="Export filtered zones as CSV"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          <div className="hidden lg:flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
            <span>Total Demand:</span>
            <strong className="text-blue-700">{totalOrders.toLocaleString()}</strong>
            <span className="text-slate-500 font-normal">orders/day</span>
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="sticky top-0 z-10 border-b border-gp-border bg-slate-50 font-semibold text-slate-600">
            <tr>
              <th scope="col" className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => handleSort('name')}
                  className="flex items-center gap-1 hover:text-slate-900 focus:outline-none"
                  aria-sort={sortField === 'name' ? (sortAsc ? 'ascending' : 'descending') : 'none'}
                >
                  <span>Zone &amp; ID</span>
                  <ArrowUpDown className="h-3 w-3 text-slate-400" />
                </button>
              </th>
              <th scope="col" className="px-3 py-3">Coordinates</th>
              <th scope="col" className="px-4 py-3 min-w-[280px]">
                <button
                  type="button"
                  onClick={() => handleSort('orders')}
                  className="flex items-center gap-1 hover:text-slate-900 focus:outline-none"
                  aria-sort={sortField === 'orders' ? (sortAsc ? 'ascending' : 'descending') : 'none'}
                >
                  <span>Daily Orders &amp; Multiplier</span>
                  <ArrowUpDown className="h-3 w-3 text-slate-400" />
                </button>
              </th>
              <th scope="col" className="px-3 py-3">Assigned Depot</th>
              <th scope="col" className="px-3 py-3">
                <button
                  type="button"
                  onClick={() => handleSort('distance')}
                  className="flex items-center gap-1 hover:text-slate-900 focus:outline-none"
                  aria-sort={sortField === 'distance' ? (sortAsc ? 'ascending' : 'descending') : 'none'}
                >
                  <span>Road Distance &amp; ETA</span>
                  <ArrowUpDown className="h-3 w-3 text-slate-400" />
                </button>
              </th>
              <th scope="col" className="px-3 py-3">
                <button
                  type="button"
                  onClick={() => handleSort('status')}
                  className="flex items-center gap-1 hover:text-slate-900 focus:outline-none"
                  aria-sort={sortField === 'status' ? (sortAsc ? 'ascending' : 'descending') : 'none'}
                >
                  <span>Coverage Status</span>
                  <ArrowUpDown className="h-3 w-3 text-slate-400" />
                </button>
              </th>
              <th scope="col" className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedZones.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  No delivery zones match "{debouncedSearch || searchTerm}".
                </td>
              </tr>
            ) : (
              paginatedZones.map((z) => {
                const assignment = assignmentMap.get(z.id);
                const isSelected = selectedZoneId === z.id;
                const isUncovered = assignment && !assignment.isCovered;
                const isSplit = assignment && assignment.hubAssignments.length > 1;
                const isPinned = Boolean(pinnedAssignments[z.id]);
                const status = getZoneStatus(z);

                // Compute weighted distance and duration if assigned
                let totalDist = 0;
                let totalDur = 0;
                if (assignment && assignment.hubAssignments.length > 0) {
                  for (const h of assignment.hubAssignments) {
                    totalDist += h.distanceKm * h.fraction;
                    totalDur += h.durationMin * h.fraction;
                  }
                }

                return (
                  <tr
                    key={z.id}
                    onClick={() => onSelectZone(z.id)}
                    className={`transition-colors cursor-pointer hover:bg-slate-50/80 ${
                      isSelected ? 'bg-blue-50/60' : ''
                    }`}
                  >
                    {/* Zone ID & Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectZone(z.id);
                          }}
                          className="font-bold text-slate-900 hover:text-blue-600 hover:underline text-left truncate max-w-[150px]"
                          title="Inspect zone details"
                        >
                          {z.name}
                        </button>
                        <span className="font-mono text-[10px] text-slate-400 whitespace-nowrap">
                          {z.id}
                        </span>
                        {isPinned && (
                          <span title="Pinned to Depot">
                            <Pin className="h-3 w-3 text-blue-600 shrink-0" />
                          </span>
                        )}
                        {/* Source Tag */}
                        {z.source !== 'demo' && (
                          <span className="rounded bg-indigo-50 px-1.5 py-0.2 text-[9px] font-semibold text-indigo-700 uppercase whitespace-nowrap">
                            {z.source}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Coordinates */}
                    <td className="px-3 py-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {z.lat.toFixed(4)}, {z.lng.toFixed(4)}
                    </td>

                    {/* OrderQuantityEditor */}
                    <td
                      className="px-4 py-2.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <OrderQuantityEditor
                        baseOrders={z.baseOrders}
                        multiplier={z.multiplier}
                        onChange={(newBase: number, newMult: number) => {
                          onUpdateZoneDemand(z.id, newBase, newMult);
                        }}
                      />
                    </td>

                    {/* Assigned Depot */}
                    <td className="px-3 py-3">
                      {isUncovered ? (
                        <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-800 whitespace-nowrap">
                          <AlertTriangle className="h-3 w-3" />
                          <span>Unassigned</span>
                        </span>
                      ) : assignment && assignment.hubAssignments.length > 0 ? (
                        <div className="space-y-0.5">
                          {assignment.hubAssignments.map((h, idx) => (
                            <div key={idx} className="flex items-center gap-1.5">
                              <span className="font-medium text-slate-900 truncate max-w-[140px]">
                                {h.hubName}
                              </span>
                              {isSplit && (
                                <span className="rounded bg-purple-100 px-1.5 py-0.2 text-[10px] font-bold text-purple-800 whitespace-nowrap">
                                  {Math.round(h.fraction * 100)}%
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Pending solve...</span>
                      )}
                    </td>

                    {/* Road Distance & ETA */}
                    <td className="px-3 py-3 text-[11px] whitespace-nowrap">
                      {assignment && assignment.hubAssignments.length > 0 && !isUncovered ? (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1 font-semibold text-slate-800">
                            <Navigation className="h-3 w-3 text-blue-600 shrink-0" />
                            <span>{totalDist.toFixed(1)} km</span>
                          </div>
                          <div className="flex items-center gap-1 text-slate-500">
                            <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                            <span>{Math.round(totalDur)} min (free-flow)</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Status Chip (Never Blank) */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      {status.level === 'optimal' ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Optimal Coverage</span>
                        </span>
                      ) : status.level === 'warning' ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200">
                          <Clock className="h-3 w-3" />
                          <span>Transit Warning</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 border border-rose-200">
                          <AlertTriangle className="h-3 w-3" />
                          <span>SLA Breach</span>
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onSelectZone(z.id)}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                          title="Inspect Zone"
                          aria-label={`Inspect ${z.name}`}
                        >
                          <Sliders className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteZone(z.id)}
                          className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          title="Delete Zone"
                          aria-label={`Delete ${z.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination & Footer Meta Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-t border-gp-border bg-slate-50/70 text-xs text-slate-500 gap-3">
        <div className="flex items-center gap-3">
          <span>Show:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 font-medium"
          >
            <option value={10}>10 rows</option>
            <option value={25}>25 rows</option>
            <option value={50}>50 rows</option>
            <option value={0}>All ({totalItems})</option>
          </select>
          <span>
            Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({totalItems} zones)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {pageSize > 0 && totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                aria-label="Previous Page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                aria-label="Next Page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
          <span className="text-[11px] text-slate-400 pl-2">
            Distances: OSRM road network matrix with empirical Haversine detour fallbacks.
          </span>
        </div>
      </div>
    </div>
  );
};
