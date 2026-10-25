import { describe, it, expect } from 'vitest';
import { solveExactCFLP } from '../solver/cflpEngine';
import { SolverInput, SolverZone, SolverHub } from '../solver/types';

describe('Auto-Size CFLP Solver dynamic warehouse count on order factor changes', () => {
  const baseZones: SolverZone[] = [
    { id: 'Z1', name: 'Zone 1', lat: 12.9716, lng: 77.5946, demand: 800 },
    { id: 'Z2', name: 'Zone 2', lat: 12.9816, lng: 77.6046, demand: 900 },
    { id: 'Z3', name: 'Zone 3', lat: 12.9916, lng: 77.6146, demand: 1100 },
    { id: 'Z4', name: 'Zone 4', lat: 12.9616, lng: 77.5846, demand: 1200 },
    { id: 'Z5', name: 'Zone 5', lat: 12.9516, lng: 77.5746, demand: 1000 },
  ];

  // 4 candidate hubs with 2,000 capacity each and fixed daily leases
  const candidateHubs: SolverHub[] = [
    { id: 'H1', name: 'North Hub', lat: 12.99, lng: 77.61, capacity: 2000, dailyLease: 15000 },
    { id: 'H2', name: 'Central Hub', lat: 12.97, lng: 77.59, capacity: 2000, dailyLease: 15000 },
    { id: 'H3', name: 'South Hub', lat: 12.95, lng: 77.57, capacity: 2000, dailyLease: 15000 },
    { id: 'H4', name: 'East Hub', lat: 12.96, lng: 77.63, capacity: 2000, dailyLease: 15000 },
  ];

  const distanceMatrixKm: Record<string, Record<string, number>> = {
    H1: { Z1: 3.5, Z2: 2.0, Z3: 1.0, Z4: 5.0, Z5: 6.0 },
    H2: { Z1: 1.0, Z2: 2.5, Z3: 3.0, Z4: 2.0, Z5: 3.0 },
    H3: { Z1: 4.0, Z2: 5.0, Z3: 6.0, Z4: 2.0, Z5: 1.0 },
    H4: { Z1: 3.0, Z2: 3.5, Z3: 4.0, Z4: 4.5, Z5: 5.5 },
  };

  it('selects 3 warehouses for baseline demand (5,000 orders > 2x2000)', () => {
    // Total demand = 5,000. Each hub has capacity 2,000.
    // 2 hubs = 4,000 capacity (insufficient). kMin must be at least 3.
    const input: SolverInput = {
      zones: baseZones,
      hubs: candidateHubs,
      p: 1, // Will be overridden by autoSize sweep
      autoSize: true,
      pMax: 4,
      costPerKm: 28,
      radiusMaxKm: 25,
      distanceMatrixKm,
      timeBudgetMs: 500,
    };

    const result = solveExactCFLP(input);
    expect(result.status).toBe('Optimal');
    expect(result.autoSize).toBe(true);
    expect(result.openHubs.length).toBe(3);
    expect(result.sizingRationale).toContain('Auto-sized to 3 warehouses');
    expect(result.coveragePercentage).toBe(100);
  });

  it('dynamically increases warehouse count to 4 when order factor surges to 1.5x (7,500 orders)', () => {
    // Order factor = 1.5x -> Total demand = 5,000 * 1.5 = 7,500.
    // 3 hubs = 6,000 capacity (insufficient).
    // Must dynamically auto-size to 4 warehouses!
    const scaledZones = baseZones.map((z) => ({
      ...z,
      demand: Math.round(z.demand * 1.5),
    }));

    const input: SolverInput = {
      zones: scaledZones,
      hubs: candidateHubs,
      p: 1,
      autoSize: true,
      pMax: 4,
      costPerKm: 28,
      radiusMaxKm: 25,
      distanceMatrixKm,
      timeBudgetMs: 500,
    };

    const result = solveExactCFLP(input);
    expect(result.status).toBe('Optimal');
    expect(result.autoSize).toBe(true);
    expect(result.openHubs.length).toBe(4);
    expect(result.sizingRationale).toContain('Auto-sized to 4 warehouses');
  });

  it('dynamically scales down warehouse count to 1 or 2 when order factor drops to 0.3x (1,500 orders)', () => {
    // Order factor = 0.3x -> Total demand = 1,500.
    // 1 hub has 2,000 capacity (sufficient for all 1,500 orders).
    // Extra hubs cost 15,000 INR/day in lease without saving transit cost.
    // Optimizer must choose 1 warehouse!
    const lowDemandZones = baseZones.map((z) => ({
      ...z,
      demand: Math.round(z.demand * 0.3),
    }));

    const input: SolverInput = {
      zones: lowDemandZones,
      hubs: candidateHubs,
      p: 4,
      autoSize: true,
      pMax: 4,
      costPerKm: 28,
      radiusMaxKm: 25,
      distanceMatrixKm,
      timeBudgetMs: 500,
    };

    const result = solveExactCFLP(input);
    expect(result.status).toBe('Optimal');
    expect(result.autoSize).toBe(true);
    expect(result.openHubs.length).toBe(1);
    expect(result.sizingRationale).toContain('Auto-sized to 1 warehouses');
  });
});
