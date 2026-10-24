import React, { useState, useMemo } from 'react';
import { EditableZone, getEffectiveOrders } from '../lib/networkState';
import { ZoneAssignmentResult } from '../solver/types';
import { Currency } from '../types';
import { OrderQuantityEditor } from './OrderQuantityEditor';
import { Search, Trash2, Sliders, AlertTriangle, Clock, Navigation } from 'lucide-react';

interface ZoneDemandTableProps {
  zones: EditableZone[];
  assignments?: ZoneAssignmentResult[];
  onUpdateZoneDemand: (zoneId: string, baseOrders: number, multiplier: number) => void;
  onSelectZone: (zoneId: string) => void;
  onDeleteZone: (zoneId: string) => void;
  selectedZoneId?: string | null;
  currency?: Currency;
}

export const ZoneDemandTable: React.FC<ZoneDemandTableProps> = ({
  zones,
  assignments = [],
  onUpdateZoneDemand,
  onSelectZone,
  onDeleteZone,
  selectedZoneId = null,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Map zoneId -> assignment result
  const assignmentMap = useMemo(() => {
    const map = new Map<string, ZoneAssignmentResult>();
    for (const a of assignments) {
      map.set(a.zoneId, a);
    }
    return map;
  }, [assignments]);

  // Filtered zones
  const filteredZones = useMemo(() => {
    if (!searchTerm.trim()) return zones;
    const q = searchTerm.toLowerCase();
    return zones.filter(
      (z) => z.name.toLowerCase().includes(q) || z.id.toLowerCase().includes(q)
    );
  }, [zones, searchTerm]);

  // Aggregate statistics
  const totalOrders = useMemo(() => {
    return zones.reduce((sum, z) => sum + getEffectiveOrders(z), 0);
  }, [zones]);

  const uncoveredCount = useMemo(() => {
    return assignments.filter((a) => !a.isCovered).length;
  }, [assignments]);

  return (
    <div className="rounded-xl border border-gp-border bg-white shadow-sm overflow-hidden">
      {/* Table Header & Controls */}
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between border-b border-gp-border">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-gp-text-primary">
              Delivery Zone Ingestion & Real-Time Demand Breakdown
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

        {/* Search Bar & Total Orders Summary */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter zones by name or ID..."
              aria-label="Filter delivery zones"
              className="h-8 w-48 sm:w-64 rounded-lg border border-gp-border pl-8 pr-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

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
              <th scope="col" className="px-4 py-3">Zone & ID</th>
              <th scope="col" className="px-3 py-3">Coordinates</th>
              <th scope="col" className="px-4 py-3 min-w-[280px]">Daily Orders & Surge Multiplier</th>
              <th scope="col" className="px-3 py-3">Assigned Depot</th>
              <th scope="col" className="px-3 py-3">Road Distance & ETA</th>
              <th scope="col" className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredZones.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">
                  No delivery zones match "{searchTerm}".
                </td>
              </tr>
            ) : (
              filteredZones.map((z) => {
                const assignment = assignmentMap.get(z.id);
                const isSelected = selectedZoneId === z.id;
                const isUncovered = assignment && !assignment.isCovered;
                const isSplit = assignment && assignment.hubAssignments.length > 1;

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
                    className={`transition-colors hover:bg-slate-50/80 ${
                      isSelected ? 'bg-blue-50/60' : ''
                    }`}
                  >
                    {/* Zone ID & Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectZone(z.id)}
                          className="font-bold text-slate-900 hover:text-blue-600 hover:underline text-left"
                          title="Inspect zone details"
                        >
                          {z.name}
                        </button>
                        <span className="font-mono text-[10px] text-slate-400">
                          {z.id}
                        </span>
                        {/* Source Tag */}
                        {z.source !== 'demo' && (
                          <span className="rounded bg-indigo-50 px-1.5 py-0.2 text-[9px] font-semibold text-indigo-700 uppercase">
                            {z.source}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Coordinates */}
                    <td className="px-3 py-3 font-mono text-[11px] text-slate-500">
                      {z.lat.toFixed(4)}, {z.lng.toFixed(4)}
                    </td>

                    {/* OrderQuantityEditor (Single shared component) */}
                    <td className="px-4 py-2.5">
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
                        <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-800">
                          <AlertTriangle className="h-3 w-3" />
                          <span>SLA Breach / Uncovered</span>
                        </span>
                      ) : assignment && assignment.hubAssignments.length > 0 ? (
                        <div className="space-y-0.5">
                          {assignment.hubAssignments.map((h, idx) => (
                            <div key={idx} className="flex items-center gap-1.5">
                              <span className="font-medium text-slate-900">
                                {h.hubName}
                              </span>
                              {isSplit && (
                                <span className="rounded bg-purple-100 px-1.5 py-0.2 text-[10px] font-bold text-purple-800">
                                  {Math.round(h.fraction * 100)}% ({h.assignedDemand} orders)
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
                    <td className="px-3 py-3 text-[11px]">
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

                    {/* Actions */}
                    <td className="px-3 py-3 text-right">
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
    </div>
  );
};
