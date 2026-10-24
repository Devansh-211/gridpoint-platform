import React, { useState, useEffect } from 'react';
import { EditableZone, EditableHub, getEffectiveOrders } from '../lib/networkState';
import { ZoneAssignmentResult } from '../solver/types';
import { Currency } from '../types';
import { formatMoney, convertCurrency } from '../lib/currency';
import { OrderQuantityEditor } from './OrderQuantityEditor';
import { X, Trash2, Undo2, Redo2, MapPin, Building2, Navigation, Clock, AlertTriangle } from 'lucide-react';

export type InspectedItem =
  | { type: 'zone'; zone: EditableZone; assignment?: ZoneAssignmentResult }
  | { type: 'hub'; hub: EditableHub; candScore?: any };

interface ZoneInspectorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  item: InspectedItem | null;
  onUpdateZone: (updated: EditableZone) => void;
  onDeleteZone: (zoneId: string) => void;
  onUpdateHub: (updated: EditableHub) => void;
  onDeleteHub: (hubId: string) => void;
  currency: Currency;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

export const ZoneInspectorDrawer: React.FC<ZoneInspectorDrawerProps> = ({
  isOpen,
  onClose,
  item,
  onUpdateZone,
  onDeleteZone,
  onUpdateHub,
  onDeleteHub,
  currency,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
}) => {
  // Local state for editing name, capacity, lease
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState(4000);
  const [leaseInr, setLeaseInr] = useState(15000);

  useEffect(() => {
    if (!item) return;
    if (item.type === 'zone') {
      setName(item.zone.name);
    } else {
      setName(item.hub.name);
      setCapacity(item.hub.capacity);
      setLeaseInr(item.hub.dailyLease);
    }
  }, [item]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey && onRedo && canRedo) {
          e.preventDefault();
          onRedo();
        } else if (!e.shiftKey && onUndo && canUndo) {
          e.preventDefault();
          onUndo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onUndo, onRedo, canUndo, canRedo]);

  if (!isOpen || !item) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="inspector-title"
      className="fixed inset-y-0 right-0 z-50 flex max-w-full pl-10"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between z-10 border-l border-gp-border">
        {/* Header */}
        <div className="p-5 border-b border-gp-border bg-slate-50/70">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-white ${
                  item.type === 'zone' ? 'bg-blue-600' : 'bg-emerald-600'
                }`}
              >
                {item.type === 'zone' ? (
                  <MapPin className="h-4 w-4" />
                ) : (
                  <Building2 className="h-4 w-4" />
                )}
              </div>
              <div>
                <span className="font-mono text-xs font-semibold uppercase text-slate-400">
                  {item.type === 'zone' ? item.zone.id : item.hub.id}
                </span>
                <h3 id="inspector-title" className="text-sm font-bold text-slate-900">
                  {item.type === 'zone' ? 'Delivery Zone Inspector' : 'Candidate Hub Inspector'}
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close inspector"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* 1. Name & Type */}
          <div className="space-y-1.5">
            <label htmlFor="inspector-name-input" className="block text-xs font-bold text-slate-700">
              Location Name
            </label>
            <input
              id="inspector-name-input"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (item.type === 'zone') {
                  onUpdateZone({ ...item.zone, name: e.target.value });
                } else {
                  onUpdateHub({ ...item.hub, name: e.target.value });
                }
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
              <span>Source: <strong className="uppercase">{item.type === 'zone' ? item.zone.source : item.hub.source}</strong></span>
              <span className="font-mono">
                {item.type === 'zone'
                  ? `${item.zone.lat.toFixed(5)}, ${item.zone.lng.toFixed(5)}`
                  : `${item.hub.lat.toFixed(5)}, ${item.hub.lng.toFixed(5)}`}
              </span>
            </div>
          </div>

          {/* 2. Zone Specific: Order Quantity Editor & Assignments */}
          {item.type === 'zone' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Daily Demand Volume</span>
                  <span className="text-xs font-bold text-blue-700">
                    {getEffectiveOrders(item.zone).toLocaleString()} orders/day
                  </span>
                </div>
                <OrderQuantityEditor
                  baseOrders={item.zone.baseOrders}
                  multiplier={item.zone.multiplier}
                  onChange={(newBase: number, newMult: number) => {
                    onUpdateZone({ ...item.zone, baseOrders: newBase, multiplier: newMult });
                  }}
                />
              </div>

              {/* Assignment Details */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <span className="text-xs font-bold text-slate-700">Live Optimization Assignment</span>
                {item.assignment ? (
                  item.assignment.isCovered ? (
                    <div className="space-y-2 text-xs">
                      {item.assignment.hubAssignments.map((h, i) => (
                        <div key={i} className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                          <div>
                            <div className="font-bold text-slate-900">{h.hubName}</div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                              <span className="flex items-center gap-1">
                                <Navigation className="h-3 w-3 text-blue-600" />
                                {h.distanceKm.toFixed(1)} km
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-slate-400" />
                                {Math.round(h.durationMin)} min
                              </span>
                            </div>
                          </div>
                          <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">
                            {Math.round(h.fraction * 100)}% ({h.assignedDemand} orders)
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-800 border border-rose-200">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                      <span><strong>SLA Breach:</strong> No opened hub can serve this zone within the maximum radius.</span>
                    </div>
                  )
                ) : (
                  <p className="text-xs text-slate-400 italic">No solve data available yet.</p>
                )}
              </div>
            </div>
          )}

          {/* 3. Hub Specific: Capacity & Daily Lease */}
          {item.type === 'hub' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="inspector-capacity-input" className="block text-xs font-bold text-slate-700">
                  Throughput Capacity (orders/day)
                </label>
                <input
                  id="inspector-capacity-input"
                  type="number"
                  min="100"
                  max="100000"
                  step="500"
                  value={capacity}
                  onChange={(e) => {
                    const val = Math.max(100, parseInt(e.target.value, 10) || 100);
                    setCapacity(val);
                    onUpdateHub({ ...item.hub, capacity: val });
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="inspector-lease-input" className="block text-xs font-bold text-slate-700">
                  Fixed Daily Lease ({currency})
                </label>
                <div className="relative">
                  <input
                    id="inspector-lease-input"
                    type="number"
                    min="0"
                    step="500"
                    value={
                      currency === 'INR'
                        ? leaseInr
                        : Math.round(convertCurrency(leaseInr, 'INR', currency))
                    }
                    onChange={(e) => {
                      const userVal = parseFloat(e.target.value) || 0;
                      const canonicalInr =
                        currency === 'INR'
                          ? userVal
                          : Math.round(convertCurrency(userVal, currency, 'INR'));
                      setLeaseInr(canonicalInr);
                      onUpdateHub({ ...item.hub, dailyLease: canonicalInr });
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">
                    {formatMoney(leaseInr, currency)}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500">
                  Canonical value stored in INR: ₹{leaseInr.toLocaleString()}/day
                </span>
              </div>
            </div>
          )}

          {/* Delete Action */}
          <div className="pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                if (item.type === 'zone') {
                  onDeleteZone(item.zone.id);
                } else {
                  onDeleteHub(item.hub.id);
                }
                onClose();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100 hover:border-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete {item.type === 'zone' ? 'Delivery Zone' : 'Candidate Hub'}</span>
            </button>
          </div>
        </div>

        {/* Footer with Undo/Redo */}
        <div className="p-4 border-t border-gp-border bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span>Undo</span>
            </button>

            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Shift+Z)"
              className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Redo2 className="h-3.5 w-3.5" />
              <span>Redo</span>
            </button>
          </div>

          <span className="text-[11px] text-slate-400">
            Esc to close
          </span>
        </div>
      </div>
    </div>
  );
};
