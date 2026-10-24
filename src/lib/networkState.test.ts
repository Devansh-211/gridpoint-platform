import { describe, it, expect, beforeEach } from 'vitest';
import {
  getEffectiveOrders,
  createDefaultDemoZones,
  createDefaultDemoHubs,
  getNextZoneId,
  getNextHubId,
  calculateTopologyDiff,
  saveNetwork,
  loadSavedNetwork,
  clearSavedNetwork,
  EditableZone,
} from './networkState';
import { SolverOutput } from '../solver/types';

describe('networkState helpers', () => {
  beforeEach(() => {
    clearSavedNetwork();
  });

  it('calculates effective orders as baseOrders * multiplier rounded, non-compounding', () => {
    const zone: EditableZone = {
      id: 'ZN-1',
      name: 'Test Zone',
      lat: 12.9,
      lng: 77.6,
      baseOrders: 420,
      multiplier: 1.5,
      source: 'demo',
    };
    expect(getEffectiveOrders(zone)).toBe(630);

    // 2x multiplier
    expect(getEffectiveOrders({ ...zone, multiplier: 2 })).toBe(840);

    // 1x multiplier
    expect(getEffectiveOrders({ ...zone, multiplier: 1 })).toBe(420);
  });

  it('creates default demo zones and hubs with correct count and properties', () => {
    const zones = createDefaultDemoZones();
    expect(zones.length).toBe(36);
    expect(zones[0].id).toBe('BLR_01');
    expect(zones[0].name).toBe('Koramangala');
    expect(zones[0].baseOrders).toBe(420);

    const hubs = createDefaultDemoHubs();
    expect(hubs.length).toBe(20);
    expect(hubs[0].id).toBe('BLR-PL-01');
    expect(hubs[0].capacity).toBeGreaterThan(0);
    expect(hubs[0].dailyLease).toBeGreaterThan(0);
  });

  it('generates sequential next unique zone and hub IDs', () => {
    const zones: EditableZone[] = [
      { id: 'BLR_01', name: 'Z1', lat: 1, lng: 1, baseOrders: 10, multiplier: 1, source: 'demo' },
      { id: 'ZN-BLR-36', name: 'Z36', lat: 1, lng: 1, baseOrders: 10, multiplier: 1, source: 'demo' },
    ];
    expect(getNextZoneId(zones)).toBe('ZN-BLR-37');

    const hubs = [
      { id: 'HUB-BLR-1', name: 'H1', lat: 1, lng: 1, capacity: 100, dailyLease: 100, source: 'demo' as const },
      { id: 'HUB-BLR-20', name: 'H20', lat: 1, lng: 1, capacity: 100, dailyLease: 100, source: 'demo' as const },
    ];
    expect(getNextHubId(hubs)).toBe('HUB-BLR-21');
  });

  it('calculates comprehensive topology diff between two solver states', () => {
    const prev: SolverOutput = {
      status: 'Optimal',
      isOptimal: true,
      isAnytimeBest: false,
      openHubIds: ['H1', 'H2'],
      openHubs: [
        { hubId: 'H1', name: 'Hub 1', latitude: 12.9, longitude: 77.6, capacity: 500, assignedDemand: 400, utilizationPct: 80, zonesServedCount: 1 },
        { hubId: 'H2', name: 'Hub 2', latitude: 12.8, longitude: 77.5, capacity: 500, assignedDemand: 300, utilizationPct: 60, zonesServedCount: 1 },
      ],
      assignments: [
        {
          zoneId: 'Z1',
          zoneName: 'Zone 1',
          demand: 400,
          isCovered: true,
          hubAssignments: [{ hubId: 'H1', hubName: 'Hub 1', fraction: 1, assignedDemand: 400, distanceKm: 5, durationMin: 12 }],
        },
        {
          zoneId: 'Z2',
          zoneName: 'Zone 2',
          demand: 300,
          isCovered: true,
          hubAssignments: [{ hubId: 'H2', hubName: 'Hub 2', fraction: 1, assignedDemand: 300, distanceKm: 6, durationMin: 15 }],
        },
      ],
      uncoveredZoneIds: [],
      coveragePercentage: 100,
      fastDeliveryCoveragePct: 100,
      totalTransitCostInr: 1000,
      totalLeaseCostInr: 2000,
      combinedTotalCostInr: 3000,
      totalWeightedDistanceKm: 3800,
      averageDistanceKm: 5.4,
      metrics: { nodesExplored: 5, nodesPruned: 1, incumbentUpdates: 2, setsEvaluated: 3, totalCombinations: 3, elapsedMs: 1 },
    };

    const curr: SolverOutput = {
      ...prev,
      openHubIds: ['H1', 'H3'],
      openHubs: [
        { hubId: 'H1', name: 'Hub 1', latitude: 12.9, longitude: 77.6, capacity: 500, assignedDemand: 500, utilizationPct: 100, zonesServedCount: 2 },
        { hubId: 'H3', name: 'Hub 3', latitude: 13.0, longitude: 77.7, capacity: 600, assignedDemand: 200, utilizationPct: 33.3, zonesServedCount: 1 },
      ],
      assignments: [
        {
          zoneId: 'Z1',
          zoneName: 'Zone 1',
          demand: 400,
          isCovered: true,
          hubAssignments: [{ hubId: 'H1', hubName: 'Hub 1', fraction: 1, assignedDemand: 400, distanceKm: 5, durationMin: 12 }],
        },
        {
          zoneId: 'Z2',
          zoneName: 'Zone 2',
          demand: 300,
          isCovered: true,
          // Split across H1 and H3
          hubAssignments: [
            { hubId: 'H1', hubName: 'Hub 1', fraction: 0.333, assignedDemand: 100, distanceKm: 8, durationMin: 20 },
            { hubId: 'H3', hubName: 'Hub 3', fraction: 0.667, assignedDemand: 200, distanceKm: 4, durationMin: 10 },
          ],
        },
      ],
      combinedTotalCostInr: 3500,
    };

    const diff = calculateTopologyDiff(prev, curr);
    expect(diff).not.toBeNull();
    expect(diff!.openedHubs).toEqual(['Hub 3']);
    expect(diff!.closedHubs).toEqual(['Hub 2']);
    expect(diff!.spilloverZoneCount).toBe(1);
    expect(diff!.costDeltaInr).toBe(500);
    expect(diff!.costDeltaPct).toBeCloseTo(16.67, 1);
  });

  it('persists and loads network dataset in localStorage', () => {
    const zones = createDefaultDemoZones();
    const hubs = createDefaultDemoHubs();
    saveNetwork(zones, hubs);

    const loaded = loadSavedNetwork();
    expect(loaded.zones.length).toBe(36);
    expect(loaded.hubs.length).toBe(20);
  });
});
