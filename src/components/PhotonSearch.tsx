import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  searchPhotonPlaces,
  PhotonPlaceResult,
} from '../services/photonService';
import {
  EditableZone,
  EditableHub,
  getNextZoneId,
  getNextHubId,
} from '../lib/networkState';
import { Currency } from '../types';
import { formatMoney, convertCurrency } from '../lib/currency';
import { Z_CLASSES } from '../config/zIndexTokens';
import {
  Search,
  MapPin,
  Building2,
  Plus,
  Loader2,
  X,
} from 'lucide-react';

interface PhotonSearchProps {
  onAddZone: (zone: EditableZone) => void;
  onAddHub: (hub: EditableHub) => void;
  existingZones: EditableZone[];
  existingHubs: EditableHub[];
  currency: Currency;
  defaultWarehouseCapacity?: number;
  defaultFixedLeaseInr?: number;
  // External trigger (e.g. from map click)
  externalPlace?: PhotonPlaceResult | null;
  onClearExternalPlace?: () => void;
}

export const PhotonSearch: React.FC<PhotonSearchProps> = ({
  onAddZone,
  onAddHub,
  existingZones,
  existingHubs,
  currency,
  defaultWarehouseCapacity = 4000,
  defaultFixedLeaseInr = 15000,
  externalPlace = null,
  onClearExternalPlace,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PhotonPlaceResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Selected place for "Add to Network" form
  const [selectedPlace, setSelectedPlace] = useState<PhotonPlaceResult | null>(null);

  // Form State
  const [nodeType, setNodeType] = useState<'zone' | 'hub'>('zone');
  const [label, setLabel] = useState('');
  const [zoneOrders, setZoneOrders] = useState(350);
  const [hubCapacity, setHubCapacity] = useState(defaultWarehouseCapacity);
  const [hubLeaseInr, setHubLeaseInr] = useState(defaultFixedLeaseInr);

  const abortControllerRef = useRef<AbortController | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Focus trap, body scroll lock and Escape key dismiss
  useEffect(() => {
    if (selectedPlace) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const timer = setTimeout(() => {
        if (modalRef.current) {
          const focusable = modalRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length > 0) {
            focusable[0].focus();
          }
        }
      }, 50);

      const handleModalKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          handleCloseForm();
          return;
        }

        if (e.key === 'Tab' && modalRef.current) {
          const focusables = Array.from(
            modalRef.current.querySelectorAll<HTMLElement>(
              'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
          ).filter((el) => el.offsetParent !== null || el.getAttribute('type') !== 'hidden');

          if (focusables.length === 0) return;

          const first = focusables[0];
          const last = focusables[focusables.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === first || !modalRef.current.contains(document.activeElement)) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (document.activeElement === last || !modalRef.current.contains(document.activeElement)) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      };

      document.addEventListener('keydown', handleModalKeyDown);

      return () => {
        clearTimeout(timer);
        document.removeEventListener('keydown', handleModalKeyDown);
        document.body.style.overflow = originalOverflow;
        if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
          previousFocusRef.current.focus();
        }
      };
    }
  }, [selectedPlace]);

  // When external place (e.g. from map click) arrives, open form directly
  useEffect(() => {
    if (externalPlace) {
      setSelectedPlace(externalPlace);
      setLabel(externalPlace.name || externalPlace.label);
      setNodeType('zone');
      setZoneOrders(350);
    }
  }, [externalPlace]);

  // Debounced Photon Search (250 ms)
  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      setIsLoading(false);
      setIsDropdownOpen(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const places = await searchPhotonPlaces(query, controller.signal);
        setResults(places);
        setIsDropdownOpen(true);
        setHighlightedIndex(-1);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Photon search failed:', err);
        }
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Keyboard navigation for combobox
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen || results.length === 0) {
      if (e.key === 'ArrowDown' && results.length > 0) {
        setIsDropdownOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < results.length) {
        handleSelectPlace(results[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  const handleSelectPlace = (place: PhotonPlaceResult) => {
    setSelectedPlace(place);
    setLabel(place.name || place.label);
    setIsDropdownOpen(false);
    setQuery('');
  };

  const handleCloseForm = () => {
    setSelectedPlace(null);
    if (onClearExternalPlace) onClearExternalPlace();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlace) return;

    if (nodeType === 'zone') {
      const newZone: EditableZone = {
        id: getNextZoneId(existingZones),
        name: label.trim() || selectedPlace.name || 'New Demand Zone',
        lat: selectedPlace.lat,
        lng: selectedPlace.lng,
        baseOrders: Math.max(10, Math.min(5000, zoneOrders)),
        multiplier: 1.0,
        source: externalPlace ? 'map' : 'search',
      };
      onAddZone(newZone);
    } else {
      const newHub: EditableHub = {
        id: getNextHubId(existingHubs),
        name: label.trim() || selectedPlace.name || 'New Candidate Hub',
        lat: selectedPlace.lat,
        lng: selectedPlace.lng,
        capacity: Math.max(100, hubCapacity),
        dailyLease: Math.max(0, hubLeaseInr),
        source: externalPlace ? 'map' : 'search',
      };
      onAddHub(newHub);
    }

    handleCloseForm();
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full">
      {/* Prominent Search Bar */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
          <Search className="h-4 w-4" />
        </div>
        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setIsDropdownOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="➕ Search & Add Delivery Zone / Candidate Hub (e.g. Koramangala, Peenya, Whitefield)..."
          aria-label="Search places to add to network"
          aria-expanded={isDropdownOpen}
          aria-autocomplete="list"
          role="combobox"
          className="h-11 w-full rounded-xl border border-gp-border bg-white pl-10 pr-10 text-xs font-medium text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          ) : query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setResults([]);
                setIsDropdownOpen(false);
              }}
              aria-label="Clear search input"
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Autocomplete Dropdown */}
      {isDropdownOpen && (
        <div
          ref={dropdownRef}
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-64 overflow-y-auto rounded-xl border border-gp-border bg-white py-1 shadow-lg"
        >
          {results.length === 0 ? (
            <div className="p-3 text-center text-xs text-slate-500">
              No matching locations found in Bengaluru area.
            </div>
          ) : (
            results.map((place, idx) => {
              const isHighlighted = idx === highlightedIndex;
              return (
                <div
                  key={`${place.lat}-${place.lng}-${idx}`}
                  role="option"
                  aria-selected={isHighlighted}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onClick={() => handleSelectPlace(place)}
                  className={`flex cursor-pointer items-start justify-between px-3.5 py-2 text-xs transition-colors ${
                    isHighlighted ? 'bg-blue-50 text-blue-900' : 'text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-900">{place.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {[place.suburbOrDistrict, place.state].filter(Boolean).join(', ')}
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400 shrink-0 ml-2">
                    {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Add to Network Modal / Form */}
      {selectedPlace && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-modal-title"
            className={`fixed inset-0 ${Z_CLASSES.dialogs} flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs`}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                handleCloseForm();
              }
            }}
          >
            <div className="w-full max-w-lg rounded-2xl border border-gp-border bg-white p-6 shadow-2xl space-y-5 animate-in fade-in duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gp-border pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                  <Plus className="h-4 w-4" />
                </div>
                <div>
                  <h3 id="add-modal-title" className="text-sm font-bold text-slate-900">
                    Add Location to Network
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Pins coordinates, fetches real OSRM road matrix row/col, and re-optimizes
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseForm}
                aria-label="Close dialog"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Node Type Selector */}
              <div className="space-y-1.5">
                <span className="block font-bold text-slate-700">Network Node Type</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNodeType('zone')}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 font-bold transition ${
                      nodeType === 'zone'
                        ? 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-100'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <MapPin className="h-4 w-4" />
                    <span>📦 Delivery Zone</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNodeType('hub')}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 font-bold transition ${
                      nodeType === 'hub'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-100'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Building2 className="h-4 w-4" />
                    <span>🏭 Candidate Hub</span>
                  </button>
                </div>
              </div>

              {/* Name & Coordinates */}
              <div className="space-y-1.5">
                <label htmlFor="add-name-input" className="block font-bold text-slate-700">
                  Location Display Label
                </label>
                <input
                  id="add-name-input"
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-medium text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    Auto ID:{' '}
                    <strong className="font-mono text-blue-700">
                      {nodeType === 'zone'
                        ? getNextZoneId(existingZones)
                        : getNextHubId(existingHubs)}
                    </strong>
                  </span>
                  <span className="font-mono">
                    {selectedPlace.lat.toFixed(5)}, {selectedPlace.lng.toFixed(5)}
                  </span>
                </div>
              </div>

              {/* Zone Form: Daily Orders Slider & Input */}
              {nodeType === 'zone' ? (
                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <div className="flex items-center justify-between font-bold text-slate-700">
                    <span>Daily Delivery Orders</span>
                    <span className="text-blue-700">{zoneOrders.toLocaleString()} orders/day</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="5000"
                    step="10"
                    value={zoneOrders}
                    onChange={(e) => setZoneOrders(parseInt(e.target.value, 10))}
                    className="w-full cursor-pointer accent-blue-600"
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>10 min</span>
                    <span>2,500</span>
                    <span>5,000 max</span>
                  </div>
                </div>
              ) : (
                /* Hub Form: Capacity and Lease */
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between font-bold text-slate-700">
                      <span>Throughput Capacity</span>
                      <span className="text-emerald-700">{hubCapacity.toLocaleString()} orders/day</span>
                    </div>
                    <input
                      type="range"
                      min="500"
                      max="20000"
                      step="500"
                      value={hubCapacity}
                      onChange={(e) => setHubCapacity(parseInt(e.target.value, 10))}
                      className="w-full cursor-pointer accent-emerald-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="hub-lease-input" className="block font-bold text-slate-700">
                      Fixed Daily Lease ({currency})
                    </label>
                    <input
                      id="hub-lease-input"
                      type="number"
                      min="0"
                      step="500"
                      value={
                        currency === 'INR'
                          ? hubLeaseInr
                          : Math.round(convertCurrency(hubLeaseInr, 'INR', currency))
                      }
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        const inr = currency === 'INR' ? val : Math.round(convertCurrency(val, currency, 'INR'));
                        setHubLeaseInr(inr);
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-900"
                    />
                    <span className="text-[10px] text-slate-500">
                      Stored canonically: {formatMoney(hubLeaseInr, 'INR')}/day
                    </span>
                  </div>
                </div>
              )}

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gp-border">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 font-bold text-white shadow-sm hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add to Network & Re-Optimize</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
