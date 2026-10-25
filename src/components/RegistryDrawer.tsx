import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { SiteScoreItem, Currency } from '../types';
import { formatMoney } from '../lib/currency';
import { OFFICIAL_PORTALS } from '../config/portals';
import { Z_CLASSES } from '../config/zIndexTokens';
import {
  X,
  Building2,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  Layers,
  Trash2,
} from 'lucide-react';

interface RegistryDrawerProps {
  site: SiteScoreItem | null;
  isOpen: boolean;
  onClose: () => void;
  currency: Currency;
  isDemoMode?: boolean;
}

interface LocalRegistryEntries {
  surveyNumber?: string;
  recordedOwner?: string;
  encumbranceStatus?: string;
  talukHobliVillage?: string;
}

export const RegistryDrawer: React.FC<RegistryDrawerProps> = ({
  site,
  isOpen,
  onClose,
  currency,
  isDemoMode = true,
}) => {
  // If not demo mode (e.g. custom CSV uploaded), drawer must be completely hidden
  if (!isDemoMode || !site) {
    return null;
  }

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [localEntries, setLocalEntries] = useState<LocalRegistryEntries>({});

  // Load local user notes keyed by plotId
  useEffect(() => {
    if (site?.plot_id) {
      const stored = localStorage.getItem(`gridpoint_registry_${site.plot_id}`);
      if (stored) {
        try {
          setLocalEntries(JSON.parse(stored));
        } catch {
          setLocalEntries({});
        }
      } else {
        setLocalEntries({});
      }
    }
  }, [site?.plot_id]);

  const handleSaveEntry = (key: keyof LocalRegistryEntries, val: string) => {
    const updated = { ...localEntries, [key]: val };
    setLocalEntries(updated);
    if (site?.plot_id) {
      localStorage.setItem(`gridpoint_registry_${site.plot_id}`, JSON.stringify(updated));
    }
  };

  const handleClearEntries = () => {
    setLocalEntries({});
    if (site?.plot_id) {
      localStorage.removeItem(`gridpoint_registry_${site.plot_id}`);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const coordsString = `${site.lat.toFixed(4)}, ${site.lng.toFixed(4)}`;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={`fixed inset-0 ${Z_CLASSES.drawers} bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in`} />
        <Dialog.Content className={`fixed inset-y-0 right-0 ${Z_CLASSES.drawers} flex w-full max-w-lg flex-col bg-white shadow-2xl transition-transform animate-in slide-in-from-right duration-300`}>
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-200 p-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">
                  Demo template
                </span>
                <span className="font-mono text-xs text-slate-500">{site.plot_id}</span>
              </div>
              <Dialog.Title className="mt-1 text-lg font-bold text-slate-900">
                {site.locality}
              </Dialog.Title>
              <Dialog.Description className="text-xs text-slate-500">
                Land Registry & Cadastral Verification Inspector
              </Dialog.Description>
            </div>

            <Dialog.Close asChild>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close land registry drawer"
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Banner disclosure */}
          <div className="border-b border-amber-200 bg-amber-50/70 p-4">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="h-5 w-5 shrink-0 text-amber-700 mt-0.5" />
              <div className="text-xs leading-relaxed text-amber-900">
                <span className="font-bold">Template layout for demonstration.</span> No ownership or registry data is included. Verify everything on the official government portals.
              </div>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 space-y-6 overflow-y-auto p-5 text-xs">
            {/* Section 1: Real & Derived Technical Data */}
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-900 flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-blue-600" />
                <span>Geographic & Facility Parameters</span>
              </h3>

              <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                <div>
                  <div className="text-[11px] text-slate-500">Plot Identifier</div>
                  <div className="font-mono font-medium text-slate-900">{site.plot_id}</div>
                </div>

                <div>
                  <div className="text-[11px] text-slate-500">Coordinates</div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-slate-900">{coordsString}</span>
                    <button
                      onClick={() => handleCopy(coordsString, 'coords')}
                      className="text-slate-400 hover:text-slate-700"
                      title="Copy coordinates"
                    >
                      {copiedField === 'coords' ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-slate-500">
                    Plot Area <span className="text-[9px] text-slate-400 font-normal">[Assumed]</span>
                  </div>
                  <div className="font-medium tabular-nums text-slate-900">
                    {site.area_sq_ft.toLocaleString()} sq ft
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-slate-500">Zoning Category</div>
                  <div className="font-medium text-slate-900">{site.zoning_type}</div>
                </div>

                <div>
                  <div className="text-[11px] text-slate-500">
                    Throughput Capacity <span className="text-[9px] text-slate-400 font-normal">[Assumed]</span>
                  </div>
                  <div className="font-medium tabular-nums text-slate-900">
                    {site.capacity_orders_per_day.toLocaleString()} orders/day
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-slate-500">
                    Effective Daily Lease <span className="text-[9px] text-slate-400 font-normal">[Assumed]</span>
                  </div>
                  <div className="font-bold tabular-nums text-slate-900">
                    {formatMoney(site.effective_daily_lease_inr, currency)}/day
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-slate-500">Optimization Status</div>
                  <div className="font-bold text-slate-900">{site.status}</div>
                </div>

                <div>
                  <div className="text-[11px] text-slate-500">Solver Regret</div>
                  <div className="font-bold tabular-nums text-slate-900">
                    {site.regret_inr === 0 ? `${formatMoney(0, currency)}/day` : `+${formatMoney(site.regret_inr, currency)}/day`}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3 text-slate-700 leading-relaxed text-[11px]">
                <span className="font-semibold text-slate-900">Solver Evaluation: </span>
                {site.reason}
              </div>
            </div>

            {/* Section 2: Template-Only Title & Cadastral Fields (Empty with local note storage) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-slate-600" />
                  <span>Cadastral & Title Records (Demo Template)</span>
                </h3>

                {(localEntries.surveyNumber || localEntries.recordedOwner || localEntries.encumbranceStatus) && (
                  <button
                    onClick={handleClearEntries}
                    className="inline-flex items-center gap-1 text-[11px] text-rose-600 hover:text-rose-700"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Clear entries</span>
                  </button>
                )}
              </div>

              <p className="text-[11px] text-slate-500">
                Official registry fields are intentionally blank. You may enter and save verified record data locally in your browser session.
              </p>

              <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600">
                    Survey Number / Hissa
                  </label>
                  <input
                    type="text"
                    value={localEntries.surveyNumber || ''}
                    onChange={(e) => handleSaveEntry('surveyNumber', e.target.value)}
                    placeholder="Not available, enter from the official record"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600">
                    Recorded Owner / Lessor
                  </label>
                  <input
                    type="text"
                    value={localEntries.recordedOwner || ''}
                    onChange={(e) => handleSaveEntry('recordedOwner', e.target.value)}
                    placeholder="Not available, enter from the official record"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600">
                    Registry / Encumbrance Status
                  </label>
                  <input
                    type="text"
                    value={localEntries.encumbranceStatus || ''}
                    onChange={(e) => handleSaveEntry('encumbranceStatus', e.target.value)}
                    placeholder="Not available, enter from the official record"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600">
                    Taluk / Hobli / Village
                  </label>
                  <input
                    type="text"
                    value={localEntries.talukHobliVillage || ''}
                    onChange={(e) => handleSaveEntry('talukHobliVillage', e.target.value)}
                    placeholder="Not available, enter from the official record"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Official Portals Link-Out */}
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-900">Official Government Portals</h3>
              <div className="space-y-2.5">
                {OFFICIAL_PORTALS.map((portal) => (
                  <div
                    key={portal.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-slate-900">{portal.name}</div>
                        <div className="text-[11px] text-slate-500">{portal.authority}</div>
                      </div>
                      <a
                        href={portal.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white shadow-xs hover:bg-blue-700"
                      >
                        <span>Open Portal</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>

                    <p className="text-[11px] text-slate-600">{portal.description}</p>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {portal.fieldsToLookup.map((f, i) => (
                        <span
                          key={i}
                          className="rounded bg-white border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer legal disclaimer */}
          <div className="border-t border-slate-200 bg-slate-50 p-4 text-[11px] text-slate-500 leading-normal">
            Title and ownership must be verified with the official registry and a licensed advocate.
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
