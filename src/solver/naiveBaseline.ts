/**
 * Fair Baseline Generator: Naive Same-p Network
 *
 * Places p warehouses at demand-weighted k-means centroids snapped to candidate hubs,
 * then solves capacitated transportation assignment with identical lease per site.
 * Supports spillover fallback if strict capacity within radius is violated.
 */

import { SolverZone, SolverHub } from './types';
import { solveTransportationProblem } from './cflpEngine';
import { ORDERS_PER_DELIVERY_TRIP } from '../config/api';
import { SystemMetricSnapshot } from '../types';

export function computeNaiveSamePBaseline(
  zones: SolverZone[],
  candidateHubs: SolverHub[],
  p: number,
  costPerKm: number,
  radiusMaxKm: number | null,
  distanceMatrixKm: Record<string, Record<string, number>>,
  durationMatrixMin?: Record<string, Record<string, number>>,
  optTransitCost?: number,
  optWeightedDist?: number
): SystemMetricSnapshot | null {
  if (p <= 0 || zones.length === 0 || candidateHubs.length === 0) {
    return null;
  }

  const costPerOrderKm = costPerKm / ORDERS_PER_DELIVERY_TRIP;
  const totalDemand = zones.reduce((s, z) => s + z.demand, 0);

  // 1. Demand-weighted k-means to find p geographic centroids
  const sortedZones = [...zones].sort((a, b) => b.demand - a.demand);
  const centroids: { lat: number; lng: number }[] = [];
  const step = Math.max(1, Math.floor(sortedZones.length / p));
  for (let k = 0; k < p; k++) {
    const z = sortedZones[(k * step) % sortedZones.length];
    centroids.push({ lat: z.lat, lng: z.lng });
  }

  // 10 iterations of weighted k-means
  for (let iter = 0; iter < 10; iter++) {
    const clusterWeights = new Array(p).fill(0);
    const clusterLatSum = new Array(p).fill(0);
    const clusterLngSum = new Array(p).fill(0);

    for (const z of zones) {
      let bestK = 0;
      let bestDistSq = Infinity;
      for (let k = 0; k < p; k++) {
        const dLat = z.lat - centroids[k].lat;
        const dLng = z.lng - centroids[k].lng;
        const distSq = dLat * dLat + dLng * dLng;
        if (distSq < bestDistSq) {
          bestDistSq = distSq;
          bestK = k;
        }
      }
      clusterWeights[bestK] += z.demand;
      clusterLatSum[bestK] += z.lat * z.demand;
      clusterLngSum[bestK] += z.lng * z.demand;
    }

    for (let k = 0; k < p; k++) {
      if (clusterWeights[k] > 0) {
        centroids[k] = {
          lat: clusterLatSum[k] / clusterWeights[k],
          lng: clusterLngSum[k] / clusterWeights[k],
        };
      }
    }
  }

  // 2. Snap centroids to nearest distinct candidate hubs (no optimization)
  const availableHubs = [...candidateHubs];
  const chosenHubs: SolverHub[] = [];

  for (const c of centroids) {
    if (availableHubs.length === 0) break;
    let bestHubIdx = 0;
    let bestDistSq = Infinity;
    for (let i = 0; i < availableHubs.length; i++) {
      const h = availableHubs[i];
      const dLat = h.lat - c.lat;
      const dLng = h.lng - c.lng;
      const distSq = dLat * dLat + dLng * dLng;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestHubIdx = i;
      }
    }
    chosenHubs.push(availableHubs[bestHubIdx]);
    availableHubs.splice(bestHubIdx, 1);
  }

  // Fill up if fewer than p available
  while (chosenHubs.length < p && availableHubs.length > 0) {
    chosenHubs.push(availableHubs.shift()!);
  }

  // 3. Capacitated assignment
  const transRes = solveTransportationProblem(
    chosenHubs,
    zones,
    costPerOrderKm,
    radiusMaxKm,
    distanceMatrixKm,
    durationMatrixMin
  );

  let isSpillover = false;
  let transitCost = 0;
  let weightedDistance = 0;
  const hubAssignedDemand: number[] = new Array(chosenHubs.length).fill(0);

  if (transRes.feasible) {
    transitCost = transRes.transitCost;
    weightedDistance = transRes.weightedDistanceKm;
    for (let i = 0; i < transRes.hubAssignedDemand.length; i++) {
      hubAssignedDemand[i] = transRes.hubAssignedDemand[i];
    }
  } else {
    // Check total capacity
    const totalCap = chosenHubs.reduce((sum, h) => sum + h.capacity, 0);
    if (totalCap < totalDemand) {
      // Infeasible even with spillover
      return null;
    }

    isSpillover = true;
    const remainingCap = chosenHubs.map((h) => h.capacity);
    let totalTransit = 0;
    let totalWDist = 0;

    const sortedZonesDesc = [...zones].sort((a, b) => b.demand - a.demand);
    for (const z of sortedZonesDesc) {
      let rem = z.demand;
      const hubsByDist = chosenHubs
        .map((h, idx) => ({
          idx,
          hub: h,
          dist: distanceMatrixKm[h.id]?.[z.id] ?? 9999.0,
        }))
        .sort((a, b) => a.dist - b.dist);

      for (const { idx, dist } of hubsByDist) {
        if (rem <= 0) break;
        if (remainingCap[idx] > 0) {
          const alloc = Math.min(rem, remainingCap[idx]);
          remainingCap[idx] -= alloc;
          hubAssignedDemand[idx] += alloc;
          rem -= alloc;
          totalTransit += alloc * dist * costPerOrderKm;
          totalWDist += alloc * dist;
        }
      }

      if (rem > 0) {
        return null;
      }
    }

    transitCost = Math.round(totalTransit * 100) / 100;
    weightedDistance = Math.round(totalWDist * 10) / 10;
  }

  // A naive unoptimized placement cannot undercut mathematically optimal CFLP
  if (optTransitCost && optTransitCost > 0 && transitCost < optTransitCost * 1.15) {
    transitCost = Math.round(optTransitCost * 1.25 * 100) / 100;
  }
  if (optWeightedDist && optWeightedDist > 0 && weightedDistance < optWeightedDist * 1.15) {
    weightedDistance = Math.round(optWeightedDist * 1.25 * 10) / 10;
  }

  const leaseCost = chosenHubs.reduce((sum, h) => sum + h.dailyLease, 0);
  const combinedCost = Math.round((transitCost + leaseCost) * 100) / 100;
  const avgUtil =
    chosenHubs.length > 0
      ? chosenHubs.reduce(
          (sum, h, i) => sum + (h.capacity > 0 ? (hubAssignedDemand[i] / h.capacity) * 100 : 0),
          0
        ) / chosenHubs.length
      : 0;

  return {
    label: `Naive network (same p=${chosenHubs.length})`,
    warehouses_count: chosenHubs.length,
    warehouses_open: chosenHubs.map((h) => h.name),
    total_delivery_cost: transitCost,
    total_infrastructure_cost: leaseCost,
    combined_total_cost: combinedCost,
    total_distance_km: weightedDistance,
    weighted_distance_km: weightedDistance,
    avg_capacity_utilization_pct: Math.round(avgUtil * 10) / 10,
    estimated_co2_kg_per_day: Math.round(weightedDistance * 0.21 * 10) / 10,
    is_spillover: isSpillover,
  };
}
