/**
 * Network State Management & Data Helpers
 * Handles EditableZone, EditableHub, TopologyDiff computation, versioned localStorage persistence,
 * and initial demo network instantiation.
 */

import { SolverOutput } from '../solver/types';
import bundledDemoZones from '../data/demoZones.json';
import { CANDIDATE_PLOTS } from '../data/candidatePlots';
import { haversineDistanceKm } from './geoBounds';

export interface EditableZone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  baseOrders: number;
  multiplier: number; // 1, 1.5, 2, etc. (never compounds)
  source: 'demo' | 'csv' | 'search' | 'map';
  isOutlier?: boolean;
}

export interface EditableHub {
  id: string;
  name: string;
  lat: number;
  lng: number;
  capacity: number; // orders/day
  dailyLease: number; // INR/day
  source: 'demo' | 'search' | 'map';
}

export interface TopologyDiff {
  openedHubs: string[];
  closedHubs: string[];
  reassignedZoneCount: number;
  spilloverZoneCount: number;
  costDeltaInr: number;
  costDeltaPct: number;
  previousTotalCostInr: number;
  currentTotalCostInr: number;
  utilizationDeltaPct: number;
  previousUtilizationPct: number;
  currentUtilizationPct: number;
}

export const STORAGE_KEY_V2 = 'gridpoint_network_v2';

/**
 * Returns effective orders for a zone = round(baseOrders * multiplier)
 */
export function getEffectiveOrders(zone: EditableZone): number {
  const mult = typeof zone.multiplier === 'number' && zone.multiplier > 0 ? zone.multiplier : 1.0;
  return Math.max(0, Math.round(zone.baseOrders * mult));
}

/**
 * Creates canonical demo zones (36 Bengaluru neighborhoods)
 */
export function createDefaultDemoZones(): EditableZone[] {
  const preview = (bundledDemoZones as any).preview || [];
  return preview.map((z: any) => ({
    id: z.neighborhood_id,
    name: z.name,
    lat: z.latitude,
    lng: z.longitude,
    baseOrders: Math.round(z.daily_orders),
    multiplier: 1.0,
    source: 'demo' as const,
  }));
}

/**
 * Creates canonical demo candidate hubs (20 logistics corridors)
 */
export function createDefaultDemoHubs(): EditableHub[] {
  return CANDIDATE_PLOTS.map((plot) => ({
    id: plot.plotId,
    name: plot.locality,
    lat: plot.lat,
    lng: plot.lng,
    capacity: plot.capacityOrdersPerDay,
    dailyLease: plot.dailyLeaseInr,
    source: 'demo' as const,
  }));
}

/**
 * Loads network from localStorage or falls back to demo network
 */
export function loadSavedNetwork(): { zones: EditableZone[]; hubs: EditableHub[] } {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { zones: createDefaultDemoZones(), hubs: createDefaultDemoHubs() };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY_V2);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.version === 2 && Array.isArray(parsed.zones) && Array.isArray(parsed.hubs)) {
        return {
          zones: parsed.zones,
          hubs: parsed.hubs,
        };
      }
    }
  } catch (err) {
    console.warn('Failed to load saved network, resetting to demo defaults:', err);
  }

  return { zones: createDefaultDemoZones(), hubs: createDefaultDemoHubs() };
}

/**
 * Persists working network dataset to versioned localStorage
 */
export function saveNetwork(zones: EditableZone[], hubs: EditableHub[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const payload = {
      version: 2,
      timestamp: Date.now(),
      zones,
      hubs,
    };
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(payload));
  } catch (err) {
    console.warn('Failed to save network to localStorage:', err);
  }
}

/**
 * Clears saved network from localStorage
 */
export function clearSavedNetwork(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  localStorage.removeItem(STORAGE_KEY_V2);
}

/**
 * Determines whether coordinates fall within the Bengaluru demo region (~70 km radius).
 */
export function isDemoRegion(lat: number, lng: number): boolean {
  const d = haversineDistanceKm(lat, lng, 12.9716, 77.5946);
  return d <= 70;
}

/**
 * Generates next unique Zone ID.
 * Uses ZN-BLR-### for demo-region points; otherwise ZN-###.
 */
export function getNextZoneId(
  zones: EditableZone[],
  location?: { lat: number; lng: number } | null
): string {
  let maxNum = 0;
  const existingIds = new Set(zones.map((z) => z.id));
  for (const z of zones) {
    const match = z.id.match(/\d+$/);
    if (match) {
      const num = parseInt(match[0], 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  }

  let nextNum = maxNum + 1;
  const inDemo = location ? isDemoRegion(location.lat, location.lng) : true;
  const prefix = inDemo ? 'ZN-BLR-' : 'ZN-';

  while (
    existingIds.has(`${prefix}${nextNum}`) ||
    existingIds.has(`${prefix}${String(nextNum).padStart(3, '0')}`)
  ) {
    nextNum++;
  }

  return inDemo ? `${prefix}${nextNum}` : `${prefix}${String(nextNum).padStart(3, '0')}`;
}

/**
 * Generates next unique Hub ID.
 * Uses HUB-BLR-### for demo-region points; otherwise HUB-###.
 */
export function getNextHubId(
  hubs: EditableHub[],
  location?: { lat: number; lng: number } | null
): string {
  let maxNum = 0;
  const existingIds = new Set(hubs.map((h) => h.id));
  for (const h of hubs) {
    const match = h.id.match(/\d+$/);
    if (match) {
      const num = parseInt(match[0], 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  }

  let nextNum = maxNum + 1;
  const inDemo = location ? isDemoRegion(location.lat, location.lng) : true;
  const prefix = inDemo ? 'HUB-BLR-' : 'HUB-';

  while (
    existingIds.has(`${prefix}${nextNum}`) ||
    existingIds.has(`${prefix}${String(nextNum).padStart(3, '0')}`)
  ) {
    nextNum++;
  }

  return inDemo ? `${prefix}${nextNum}` : `${prefix}${String(nextNum).padStart(3, '0')}`;
}

/**
 * Calculates topology diff between previous and current solver outputs
 */
export function calculateTopologyDiff(
  prev: SolverOutput | null,
  curr: SolverOutput | null
): TopologyDiff | null {
  if (!prev || !curr) return null;

  const prevHubs = new Set(prev.openHubIds);
  const currHubs = new Set(curr.openHubIds);

  const openedHubs = curr.openHubs
    .filter((h) => !prevHubs.has(h.hubId))
    .map((h) => h.name);

  const closedHubs = prev.openHubs
    .filter((h) => !currHubs.has(h.hubId))
    .map((h) => h.name);

  // Map zoneId -> primary hub ID for previous solve
  const prevPrimaryHubMap = new Map<string, string>();
  for (const a of prev.assignments) {
    if (a.hubAssignments.length > 0) {
      // Find hub with max fraction
      let maxFrac = -1;
      let topHub = '';
      for (const h of a.hubAssignments) {
        if (h.fraction > maxFrac) {
          maxFrac = h.fraction;
          topHub = h.hubId;
        }
      }
      if (topHub) prevPrimaryHubMap.set(a.zoneId, topHub);
    }
  }

  let reassignedZoneCount = 0;
  let spilloverZoneCount = 0;

  for (const a of curr.assignments) {
    if (a.hubAssignments.length > 1) {
      spilloverZoneCount++;
    }
    if (a.hubAssignments.length > 0) {
      let maxFrac = -1;
      let topHub = '';
      for (const h of a.hubAssignments) {
        if (h.fraction > maxFrac) {
          maxFrac = h.fraction;
          topHub = h.hubId;
        }
      }
      const prevHub = prevPrimaryHubMap.get(a.zoneId);
      if (prevHub && prevHub !== topHub) {
        reassignedZoneCount++;
      }
    }
  }

  const costDeltaInr = curr.combinedTotalCostInr - prev.combinedTotalCostInr;
  const costDeltaPct =
    prev.combinedTotalCostInr > 0 ? (costDeltaInr / prev.combinedTotalCostInr) * 100 : 0;

  // System utilization
  const prevCapacity = prev.openHubs.reduce((acc, h) => acc + h.capacity, 0);
  const prevDemand = prev.openHubs.reduce((acc, h) => acc + h.assignedDemand, 0);
  const prevUtil = prevCapacity > 0 ? (prevDemand / prevCapacity) * 100 : 0;

  const currCapacity = curr.openHubs.reduce((acc, h) => acc + h.capacity, 0);
  const currDemand = curr.openHubs.reduce((acc, h) => acc + h.assignedDemand, 0);
  const currUtil = currCapacity > 0 ? (currDemand / currCapacity) * 100 : 0;

  const utilizationDeltaPct = currUtil - prevUtil;

  return {
    openedHubs,
    closedHubs,
    reassignedZoneCount,
    spilloverZoneCount,
    costDeltaInr,
    costDeltaPct,
    previousTotalCostInr: prev.combinedTotalCostInr,
    currentTotalCostInr: curr.combinedTotalCostInr,
    utilizationDeltaPct,
    previousUtilizationPct: prevUtil,
    currentUtilizationPct: currUtil,
  };
}
