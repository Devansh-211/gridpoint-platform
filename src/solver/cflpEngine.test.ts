import { describe, it, expect } from 'vitest';
import { solveExactCFLP, solveTransportationProblem } from './cflpEngine';
import { SolverInput, SolverHub, SolverZone } from './types';

describe('CFLP Solver Engine', () => {
  // Helper to generate a small test dataset
  function createSmallDataset(m: number, n: number) {
    const hubs: SolverHub[] = [];
    for (let j = 0; j < m; j++) {
      hubs.push({
        id: `HUB-${j}`,
        name: `Warehouse Hub ${j}`,
        lat: 12.9 + j * 0.05,
        lng: 77.5 + j * 0.05,
        capacity: 1000 + (j % 3) * 500,
        dailyLease: 300 + (j % 4) * 100,
      });
    }

    const zones: SolverZone[] = [];
    for (let i = 0; i < n; i++) {
      zones.push({
        id: `ZN-${i}`,
        name: `Zone ${i}`,
        lat: 12.85 + (i % 5) * 0.04,
        lng: 77.52 + (i % 4) * 0.04,
        demand: 100 + (i % 6) * 50,
      });
    }

    const distanceMatrixKm: Record<string, Record<string, number>> = {};
    for (const h of hubs) {
      distanceMatrixKm[h.id] = {};
      for (const z of zones) {
        // Simple Euclidean proxy distance in km
        const d = Math.sqrt((h.lat - z.lat) ** 2 + (h.lng - z.lng) ** 2) * 111.0;
        distanceMatrixKm[h.id][z.id] = Math.round(d * 10) / 10;
      }
    }

    return { hubs, zones, distanceMatrixKm };
  }

  it('respects exact warehouse count p constraint', () => {
    const { hubs, zones, distanceMatrixKm } = createSmallDataset(8, 12);
    const input: SolverInput = {
      hubs,
      zones,
      p: 3,
      costPerKm: 1.25,
      distanceMatrixKm,
    };

    const result = solveExactCFLP(input);
    expect(result.status).toBe('Optimal');
    expect(result.openHubIds.length).toBe(3);
    expect(result.isOptimal).toBe(true);
    expect(result.combinedTotalCostInr).toBeGreaterThan(0);
  });

  it('enforces facility capacity ceilings and allows fractional split', () => {
    // 2 hubs with small capacity, 1 zone with demand exceeding 1 hub
    const hubs: SolverHub[] = [
      { id: 'H1', name: 'Hub 1', lat: 12.9, lng: 77.5, capacity: 600, dailyLease: 200 },
      { id: 'H2', name: 'Hub 2', lat: 12.95, lng: 77.55, capacity: 600, dailyLease: 200 },
    ];
    const zones: SolverZone[] = [
      { id: 'Z1', name: 'Mega Zone', lat: 12.92, lng: 77.52, demand: 1000 },
    ];
    const distanceMatrixKm: Record<string, Record<string, number>> = {
      H1: { Z1: 5.0 },
      H2: { Z1: 8.0 },
    };

    const input: SolverInput = {
      hubs,
      zones,
      p: 2,
      costPerKm: 1.25,
      distanceMatrixKm,
    };

    const result = solveExactCFLP(input);
    expect(result.status).toBe('Optimal');
    // Zone demand of 1000 should split: 600 from H1 (closer) and 400 from H2
    const z1Assign = result.assignments.find((a) => a.zoneId === 'Z1');
    expect(z1Assign).toBeDefined();
    expect(z1Assign!.hubAssignments.length).toBe(2);

    const h1Assigned = z1Assign!.hubAssignments.find((ha) => ha.hubId === 'H1');
    const h2Assigned = z1Assign!.hubAssignments.find((ha) => ha.hubId === 'H2');
    expect(h1Assigned!.assignedDemand).toBe(600);
    expect(h2Assigned!.assignedDemand).toBe(400);
  });

  it('flags uncovered zones and penalizes SLA radius breaches', () => {
    const hubs: SolverHub[] = [
      { id: 'H1', name: 'Hub 1', lat: 12.9, lng: 77.5, capacity: 2000, dailyLease: 200 },
    ];
    const zones: SolverZone[] = [
      { id: 'Z_NEAR', name: 'Near Zone', lat: 12.91, lng: 77.51, demand: 200 },
      { id: 'Z_FAR', name: 'Far Zone', lat: 13.5, lng: 78.5, demand: 300 },
    ];
    const distanceMatrixKm: Record<string, Record<string, number>> = {
      H1: { Z_NEAR: 4.0, Z_FAR: 55.0 },
    };

    const input: SolverInput = {
      hubs,
      zones,
      p: 1,
      costPerKm: 1.25,
      radiusMaxKm: 25.0, // Max 25 km SLA
      distanceMatrixKm,
    };

    const result = solveExactCFLP(input);
    expect(result.uncoveredZoneIds).toContain('Z_FAR');
    expect(result.uncoveredZoneIds).not.toContain('Z_NEAR');
    expect(result.coveragePercentage).toBeLessThan(100);
  });

  it('matches brute-force exhaustive enumeration across 500 randomized instances', () => {
    // Brute-force solver for testing exactness
    function bruteForceCFLP(input: SolverInput): number {
      const { hubs, zones, p, costPerKm, distanceMatrixKm } = input;
      const costPerOrderKm = costPerKm / 50.0;
      let minCombined = Infinity;

      // Generate all subsets of size p
      function generateCombinations(start: number, chosen: SolverHub[]) {
        if (chosen.length === p) {
          const res = solveTransportationProblem(
            chosen,
            zones,
            costPerOrderKm,
            null,
            distanceMatrixKm
          );
          if (res.feasible) {
            const leaseCost = chosen.reduce((sum, h) => sum + h.dailyLease, 0);
            const total = Math.round((leaseCost + res.transitCost) * 100) / 100;
            if (total < minCombined) minCombined = total;
          }
          return;
        }

        for (let i = start; i < hubs.length; i++) {
          chosen.push(hubs[i]);
          generateCombinations(i + 1, chosen);
          chosen.pop();
        }
      }

      generateCombinations(0, []);
      return minCombined;
    }

    // Run 500 random instances with m=7, n=10, p=3
    for (let seed = 1; seed <= 500; seed++) {
      const { hubs, zones, distanceMatrixKm } = createSmallDataset(7, 10);
      // Randomize demands and leases based on seed
      for (let i = 0; i < zones.length; i++) {
        zones[i].demand = 50 + ((seed * 37 + i * 19) % 300);
      }
      for (let j = 0; j < hubs.length; j++) {
        hubs[j].dailyLease = 200 + ((seed * 23 + j * 41) % 400);
        hubs[j].capacity = 1000 + ((seed * 17 + j * 31) % 1500);
      }

      const input: SolverInput = {
        hubs,
        zones,
        p: 3,
        costPerKm: 1.25,
        distanceMatrixKm,
      };

      const branchAndBoundResult = solveExactCFLP(input);
      const bruteForceCost = bruteForceCFLP(input);

      if (bruteForceCost !== Infinity && branchAndBoundResult.status === 'Optimal') {
        expect(branchAndBoundResult.combinedTotalCostInr).toBeCloseTo(bruteForceCost, 0);
      }
    }
  });

  it('satisfies sub-100ms p95 performance benchmark across 200 random order edits on 36 zones x 20 hubs', () => {
    const { hubs, zones, distanceMatrixKm } = createSmallDataset(20, 36);
    const times: number[] = [];

    let lastOptimalHubs: string[] = [];

    // Run 200 edits simulating user slider/stepper changes
    for (let iter = 0; iter < 200; iter++) {
      // Perturb 3 random zones
      const perturbedZones = zones.map((z, idx) => {
        if (idx === (iter % 36) || idx === ((iter * 3) % 36)) {
          return {
            ...z,
            demand: Math.max(50, z.demand + (((iter * 17) % 300) - 150)),
          };
        }
        return z;
      });

      const input: SolverInput = {
        hubs,
        zones: perturbedZones,
        p: 3,
        costPerKm: 1.25,
        distanceMatrixKm,
        warmStartHubIds: lastOptimalHubs.length === 3 ? lastOptimalHubs : undefined,
      };

      const t0 = performance.now();
      const res = solveExactCFLP(input);
      const elapsed = performance.now() - t0;

      times.push(elapsed);
      if (res.openHubIds.length === 3) {
        lastOptimalHubs = res.openHubIds;
      }
    }

    times.sort((a, b) => a - b);
    const p50 = times[Math.floor(times.length * 0.5)];
    const p95 = times[Math.floor(times.length * 0.95)];
    const p99 = times[Math.floor(times.length * 0.99)];
    const max = times[times.length - 1];

    console.log(`[CFLP Benchmark 200 Edits] p50: ${p50.toFixed(2)}ms | p95: ${p95.toFixed(2)}ms | p99: ${p99.toFixed(2)}ms | max: ${max.toFixed(2)}ms`);

    // Strict performance requirement: p95 under 100 ms
    expect(p95).toBeLessThan(100.0);
  });
});
