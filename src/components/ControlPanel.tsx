import React from 'react';
import { Currency } from '../types';
import { currencySymbol, formatMoney, convertInrToDisplay, convertInput } from '../lib/currency';
import { Settings, Sliders, Shield, DollarSign, RefreshCw, Zap } from 'lucide-react';

interface ControlPanelProps {
  currency: Currency;
  p: number;
  onPChange: (val: number) => void;
  warehouseCapacity: number;
  onCapacityChange: (val: number) => void;
  radiusMaxKm: number | null;
  onRadiusChange: (val: number | null) => void;
  deliveryCostInr: number;
  onDeliveryCostInrChange: (val: number) => void;
  fixedLeaseInr: number;
  onFixedLeaseInrChange: (val: number) => void;
  priorityPreset: 'cost' | 'speed' | 'sustainability';
  onPriorityPresetChange: (val: 'cost' | 'speed' | 'sustainability') => void;
  autoSize: boolean;
  onAutoSizeChange: (val: boolean) => void;
  pMax: number | null;
  onPMaxChange: (val: number | null) => void;
  onSolve: () => void;
  isSolving: boolean;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  currency,
  p,
  onPChange,
  warehouseCapacity,
  onCapacityChange,
  radiusMaxKm,
  onRadiusChange,
  deliveryCostInr,
  onDeliveryCostInrChange,
  fixedLeaseInr,
  onFixedLeaseInrChange,
  priorityPreset,
  onPriorityPresetChange,
  autoSize,
  onAutoSizeChange,
  pMax,
  onPMaxChange,
  onSolve,
  isSolving,
}) => {
  const sym = currencySymbol(currency);
  const displayDeliveryCost = convertInrToDisplay(deliveryCostInr, currency);
  const displayFixedLease = convertInrToDisplay(fixedLeaseInr, currency);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* 1. Strategic Facility Parameters */}
      <div className="rounded-xl border border-gp-border bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 border-b border-gp-border pb-3">
          <Sliders className="h-4 w-4 text-gp-primary-500" />
          <h3 className="text-sm font-bold text-gp-text-primary">1. Strategic Facility Parameters</h3>
        </div>

        <div className="mt-4 space-y-4 text-xs">
          {/* Mode Switch (Manual vs Auto-size) */}
          <div className="flex items-center justify-between rounded-lg border border-gp-border bg-slate-50 p-2.5">
            <div>
              <div className="font-semibold text-gp-text-primary">Auto-Size Warehouse Network</div>
              <div className="text-[11px] text-gp-text-tertiary">
                Let solver choose optimal <span className="font-mono">p</span> to minimize transit + leases
              </div>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={autoSize}
                onChange={(e) => onAutoSizeChange(e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-5 w-9 rounded-full bg-slate-300 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-gp-primary-500 peer-checked:after:translate-x-full peer-focus:outline-none" />
            </label>
          </div>

          {/* Warehouse Count p */}
          {!autoSize ? (
            <div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-gp-text-primary">Warehouse Facilities (p)</span>
                <span className="rounded bg-blue-50 px-2 py-0.5 font-bold text-gp-primary-700">{p} sites</span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={p}
                onChange={(e) => onPChange(parseInt(e.target.value, 10))}
                className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-gp-primary-500"
              />
              <div className="mt-1 flex justify-between text-[10px] text-gp-text-tertiary">
                <span>1 Hub</span>
                <span>2</span>
                <span>3</span>
                <span>4</span>
                <span>5 Hubs</span>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-gp-text-primary">Maximum Considered Facilities (p_max)</span>
                <span className="rounded bg-blue-50 px-2 py-0.5 font-bold text-gp-primary-700">
                  {pMax ?? 6} sites
                </span>
              </div>
              <input
                type="range"
                min={2}
                max={8}
                step={1}
                value={pMax ?? 6}
                onChange={(e) => onPMaxChange(parseInt(e.target.value, 10))}
                className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-gp-primary-500"
              />
            </div>
          )}

          {/* Warehouse Capacity */}
          <div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-gp-text-primary">Site Throughput Capacity</span>
              <span className="font-bold text-gp-text-primary">{warehouseCapacity.toLocaleString()} orders/day</span>
            </div>
            <input
              type="range"
              min={2000}
              max={10000}
              step={500}
              value={warehouseCapacity}
              onChange={(e) => onCapacityChange(parseInt(e.target.value, 10))}
              className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-gp-primary-500"
            />
          </div>

          {/* Service Radius */}
          <div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-gp-text-primary">Max Service Radius (R_max)</span>
              <span className="font-bold text-gp-text-primary">{radiusMaxKm ? `${radiusMaxKm} km` : 'No Limit'}</span>
            </div>
            <input
              type="range"
              min={10}
              max={50}
              step={5}
              value={radiusMaxKm ?? 25}
              onChange={(e) => onRadiusChange(parseInt(e.target.value, 10))}
              className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-gp-primary-500"
            />
          </div>
        </div>
      </div>

      {/* 2. Optimization Priority Presets */}
      <div className="rounded-xl border border-gp-border bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 border-b border-gp-border pb-3">
          <Settings className="h-4 w-4 text-gp-primary-500" />
          <h3 className="text-sm font-bold text-gp-text-primary">2. Optimization Priority Presets</h3>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2.5 text-xs">
          <button
            type="button"
            onClick={() => onPriorityPresetChange('cost')}
            className={`flex items-start gap-3 rounded-lg border p-3 text-left transition ${
              priorityPreset === 'cost'
                ? 'border-blue-400 bg-blue-50/60 ring-1 ring-blue-400'
                : 'border-gp-border hover:bg-slate-50'
            }`}
          >
            <div className="mt-0.5 rounded-full bg-blue-100 p-1 text-gp-primary-600">
              <DollarSign className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="font-bold text-gp-text-primary">Cost Focus (Balanced)</div>
              <div className="text-[11px] text-gp-text-secondary">
                Standard {sym}/km transit rate + facility lease trade-off
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onPriorityPresetChange('speed')}
            className={`flex items-start gap-3 rounded-lg border p-3 text-left transition ${
              priorityPreset === 'speed'
                ? 'border-blue-400 bg-blue-50/60 ring-1 ring-blue-400'
                : 'border-gp-border hover:bg-slate-50'
            }`}
          >
            <div className="mt-0.5 rounded-full bg-amber-100 p-1 text-amber-600">
              <Zap className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="font-bold text-gp-text-primary">Speed / Quick Commerce</div>
              <div className="text-[11px] text-gp-text-secondary">
                Tighter 20 km service radius for fast last-mile fulfillment
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onPriorityPresetChange('sustainability')}
            className={`flex items-start gap-3 rounded-lg border p-3 text-left transition ${
              priorityPreset === 'sustainability'
                ? 'border-blue-400 bg-blue-50/60 ring-1 ring-blue-400'
                : 'border-gp-border hover:bg-slate-50'
            }`}
          >
            <div className="mt-0.5 rounded-full bg-emerald-100 p-1 text-emerald-600">
              <Shield className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="font-bold text-gp-text-primary">Green Network (Emissions)</div>
              <div className="text-[11px] text-gp-text-secondary">
                +15% distance penalty to suppress cross-town vehicle transit
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* 3. Delivery Cost Assumptions (Live Dynamic Currency) */}
      <div className="rounded-xl border border-gp-border bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 border-b border-gp-border pb-3">
          <DollarSign className="h-4 w-4 text-gp-primary-500" />
          <h3 className="text-sm font-bold text-gp-text-primary">3. Delivery Cost Assumptions</h3>
        </div>

        <div className="mt-4 space-y-4 text-xs">
          <div>
            <label className="block font-medium text-gp-text-primary">
              Delivery Cost per km ({sym}/km)
            </label>
            <div className="mt-1 flex items-center rounded-lg border border-gp-border bg-white px-3 py-1.5 focus-within:border-gp-primary-500 focus-within:ring-1 focus-within:ring-gp-primary-500">
              <span className="font-bold text-gp-text-tertiary mr-1.5">{sym}</span>
              <input
                type="number"
                step={currency === 'INR' ? 1 : 0.01}
                min={0.1}
                value={Number(displayDeliveryCost.toFixed(currency === 'INR' ? 0 : 2))}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) {
                    onDeliveryCostInrChange(convertInput(val, currency));
                  }
                }}
                className="w-full font-semibold text-gp-text-primary outline-none"
              />
              <span className="text-[11px] text-gp-text-tertiary">/km</span>
            </div>
            <div className="mt-1 text-[11px] text-gp-text-tertiary">
              Canonical: {formatMoney(deliveryCostInr, 'INR')}/km
            </div>
          </div>

          <div>
            <label className="block font-medium text-gp-text-primary">
              Fixed Warehouse Lease ({sym}/site/day)
            </label>
            <div className="mt-1 flex items-center rounded-lg border border-gp-border bg-white px-3 py-1.5 focus-within:border-gp-primary-500 focus-within:ring-1 focus-within:ring-gp-primary-500">
              <span className="font-bold text-gp-text-tertiary mr-1.5">{sym}</span>
              <input
                type="number"
                step={currency === 'INR' ? 500 : 5}
                min={1}
                value={Number(displayFixedLease.toFixed(currency === 'INR' ? 0 : 2))}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) {
                    onFixedLeaseInrChange(convertInput(val, currency));
                  }
                }}
                className="w-full font-semibold text-gp-text-primary outline-none"
              />
              <span className="text-[11px] text-gp-text-tertiary">/site/day</span>
            </div>
            <div className="mt-1 text-[11px] text-gp-text-tertiary">
              Canonical: {formatMoney(fixedLeaseInr, 'INR')}/site/day
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              disabled={isSolving}
              onClick={onSolve}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gp-primary-500 py-2.5 font-bold text-white shadow-sm transition hover:bg-gp-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gp-primary-500 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${isSolving ? 'animate-spin' : ''}`} />
              <span>{isSolving ? 'Optimizing Network...' : 'Solve Network Topology'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
