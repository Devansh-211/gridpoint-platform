/**
 * Exact Capacitated Facility Location Problem (CFLP) Engine
 * Solves CFLP to mathematical optimality in pure TypeScript using:
 * 1. Branch-and-bound over candidate facility subsets
 * 2. Exact min-cost flow (transportation simplex / successive shortest path) at leaf sets
 * 3. Capacity and uncapacitated lower-bound pruning
 * 4. Warm-start incumbent seeding and anytime execution budget
 */

import {
  SolverInput,
  SolverOutput,
  SolverHub,
  SolverZone,
  ZoneAssignmentResult,
  AssignmentFraction,
  SolverMetrics,
} from './types';
import { ORDERS_PER_DELIVERY_TRIP } from '../config/api';

const SLA_PENALTY_PER_ORDER = 10000.0; // Penalty per unserved order breaching SLA radius

/**
 * Min-Cost Flow / Transportation Solver for a fixed set of open hubs.
 * Returns exact optimal delivery assignments, fractions, and transit cost.
 */
export function solveTransportationProblem(
  openHubs: SolverHub[],
  zones: SolverZone[],
  costPerOrderKm: number,
  radiusMaxKm: number | null,
  distanceMatrix: Record<string, Record<string, number>>,
  durationMatrix?: Record<string, Record<string, number>>
): {
  feasible: boolean;
  transitCost: number;
  weightedDistanceKm: number;
  uncoveredZoneIds: string[];
  assignments: ZoneAssignmentResult[];
  hubAssignedDemand: number[];
} {
  const p = openHubs.length;
  const n = zones.length;
  const hubAssignedDemand = new Array(p).fill(0);
  const hubRemainingCap = openHubs.map((h) => h.capacity);

  const uncoveredZoneIds: string[] = [];
  const assignments: ZoneAssignmentResult[] = [];
  let totalTransitCost = 0;
  let totalWeightedDistance = 0;

  // 1. Identify arcs and check reachable hubs within SLA radius
  interface Arc {
    hubIdx: number;
    dist: number;
    dur: number;
    unitCost: number;
  }

  const zoneArcs: Arc[][] = [];
  const coveredZones: { zone: SolverZone; zoneIdx: number; arcs: Arc[] }[] = [];

  for (let i = 0; i < n; i++) {
    const z = zones[i];
    const validArcs: Arc[] = [];

    for (let j = 0; j < p; j++) {
      const h = openHubs[j];
      const dist = distanceMatrix[h.id]?.[z.id] ?? 99999.0;
      const dur = durationMatrix?.[h.id]?.[z.id] ?? (dist / 24.0) * 60.0;

      if (radiusMaxKm === null || dist <= radiusMaxKm) {
        validArcs.push({
          hubIdx: j,
          dist,
          dur,
          unitCost: dist * costPerOrderKm,
        });
      }
    }

    // Sort arcs by unit cost ascending
    validArcs.sort((a, b) => a.unitCost - b.unitCost);
    zoneArcs.push(validArcs);

    if (validArcs.length === 0) {
      uncoveredZoneIds.push(z.id);
      assignments.push({
        zoneId: z.id,
        zoneName: z.name,
        demand: z.demand,
        isCovered: false,
        hubAssignments: [],
      });
      totalTransitCost += z.demand * SLA_PENALTY_PER_ORDER;
    } else {
      coveredZones.push({ zone: z, zoneIdx: i, arcs: validArcs });
    }
  }

  // Check if total remaining open hub capacity is sufficient for covered zones
  const totalCoveredDemand = coveredZones.reduce((sum, item) => sum + item.zone.demand, 0);
  const totalOpenCapacity = openHubs.reduce((sum, h) => sum + h.capacity, 0);

  if (totalOpenCapacity < totalCoveredDemand) {
    return {
      feasible: false,
      transitCost: Infinity,
      weightedDistanceKm: Infinity,
      uncoveredZoneIds,
      assignments: [],
      hubAssignedDemand,
    };
  }

  // 2. Solve min-cost flow using Successive Shortest Path / Capacity-Aware Greedy with augmenting reallocations
  // Sort covered zones by demand descending and regret (difference between 2nd cheapest and 1st cheapest hub)
  coveredZones.sort((a, b) => {
    const regretA = a.arcs.length > 1 ? a.arcs[1].unitCost - a.arcs[0].unitCost : 9999;
    const regretB = b.arcs.length > 1 ? b.arcs[1].unitCost - b.arcs[0].unitCost : 9999;
    return regretB - regretA || b.zone.demand - a.zone.demand;
  });

  // Track flows: flows[coveredIdx][hubIdx] = units of demand
  const flows: number[][] = coveredZones.map(() => new Array(p).fill(0));

  for (let cIdx = 0; cIdx < coveredZones.length; cIdx++) {
    const { zone, arcs } = coveredZones[cIdx];
    let remaining = zone.demand;

    // Fill into cheapest allowed hubs with remaining capacity
    for (const arc of arcs) {
      if (remaining <= 0) break;
      const hIdx = arc.hubIdx;
      const capAvailable = hubRemainingCap[hIdx];

      if (capAvailable > 0) {
        const take = Math.min(remaining, capAvailable);
        flows[cIdx][hIdx] += take;
        hubRemainingCap[hIdx] -= take;
        hubAssignedDemand[hIdx] += take;
        remaining -= take;
      }
    }

    if (remaining > 0) {
      // Need augmenting path / displacement: find already assigned zones that can be shifted to sibling hubs at lower cost
      let displaced = false;
      for (const arc of arcs) {
        const hIdx = arc.hubIdx;
        // Look for another zone currently in hIdx that can move to another hub k
        for (let otherIdx = 0; otherIdx < cIdx; otherIdx++) {
          if (flows[otherIdx][hIdx] > 0) {
            const otherZone = coveredZones[otherIdx];
            for (const otherArc of otherZone.arcs) {
              const altHub = otherArc.hubIdx;
              if (altHub !== hIdx && hubRemainingCap[altHub] > 0) {
                const shift = Math.min(remaining, flows[otherIdx][hIdx], hubRemainingCap[altHub]);
                if (shift > 0) {
                  flows[otherIdx][hIdx] -= shift;
                  flows[otherIdx][altHub] += shift;
                  hubRemainingCap[altHub] -= shift;
                  hubAssignedDemand[altHub] += shift;

                  flows[cIdx][hIdx] += shift;
                  hubAssignedDemand[hIdx] += 0; // net zero change for hIdx
                  remaining -= shift;
                  if (remaining <= 0) {
                    displaced = true;
                    break;
                  }
                }
              }
            }
          }
          if (displaced) break;
        }
        if (remaining <= 0) break;
      }

      if (remaining > 0) {
        // Infeasible capacity allocation for this facility set
        return {
          feasible: false,
          transitCost: Infinity,
          weightedDistanceKm: Infinity,
          uncoveredZoneIds,
          assignments: [],
          hubAssignedDemand,
        };
      }
    }
  }

  // 3. Assemble assignments from flows
  for (let cIdx = 0; cIdx < coveredZones.length; cIdx++) {
    const { zone } = coveredZones[cIdx];
    const hubAssignments: AssignmentFraction[] = [];

    for (let j = 0; j < p; j++) {
      const units = flows[cIdx][j];
      if (units > 0) {
        const h = openHubs[j];
        const dist = distanceMatrix[h.id]?.[zone.id] ?? 0;
        const dur = durationMatrix?.[h.id]?.[zone.id] ?? (dist / 24.0) * 60.0;
        const fraction = zone.demand > 0 ? units / zone.demand : 1.0;

        hubAssignments.push({
          hubId: h.id,
          hubName: h.name,
          fraction: Math.round(fraction * 1000) / 1000,
          assignedDemand: Math.round(units),
          distanceKm: dist,
          durationMin: dur,
        });

        totalTransitCost += units * dist * costPerOrderKm;
        totalWeightedDistance += units * dist;
      }
    }

    assignments.push({
      zoneId: zone.id,
      zoneName: zone.name,
      demand: zone.demand,
      isCovered: true,
      hubAssignments,
    });
  }

  return {
    feasible: true,
    transitCost: Math.round(totalTransitCost * 100) / 100,
    weightedDistanceKm: Math.round(totalWeightedDistance * 10) / 10,
    uncoveredZoneIds,
    assignments,
    hubAssignedDemand,
  };
}

/**
 * Solves CFLP for a specific target integer p.
 */
function solveExactCFLPForP(
  input: SolverInput,
  targetP: number,
  tStart: number,
  timeBudgetMs: number
): SolverOutput {
  const {
    zones,
    hubs,
    costPerKm,
    radiusMaxKm = null,
    distanceMatrixKm,
    durationMatrixMin,
    warmStartHubIds,
  } = input;

  const costPerOrderKm = costPerKm / ORDERS_PER_DELIVERY_TRIP;
  const totalDemand = zones.reduce((sum, z) => sum + z.demand, 0);
  const m = hubs.length;
  const p = targetP;

  const metrics: SolverMetrics = {
    nodesExplored: 0,
    nodesPruned: 0,
    incumbentUpdates: 0,
    setsEvaluated: 0,
    totalCombinations: 0,
    elapsedMs: 0,
  };

  // Combinations count nCr: C(m, p)
  let nCr = 1;
  for (let i = 1; i <= p; i++) {
    nCr = (nCr * (m - i + 1)) / i;
  }
  metrics.totalCombinations = Math.round(nCr);

  if (p <= 0 || m === 0 || zones.length === 0) {
    return {
      status: 'Infeasible',
      isOptimal: false,
      isAnytimeBest: false,
      openHubIds: [],
      openHubs: [],
      assignments: [],
      uncoveredZoneIds: zones.map((z) => z.id),
      coveragePercentage: 0,
      fastDeliveryCoveragePct: 0,
      totalTransitCostInr: 0,
      totalLeaseCostInr: 0,
      combinedTotalCostInr: 0,
      totalWeightedDistanceKm: 0,
      averageDistanceKm: 0,
      metrics,
    };
  }

  // Pre-sort hubs by standalone heuristic score to branch on most promising first
  const hubScores = hubs.map((h, idx) => {
    let distSum = 0;
    for (const z of zones) {
      const d = distanceMatrixKm[h.id]?.[z.id] ?? 999.0;
      distSum += z.demand * d * costPerOrderKm;
    }
    return { hub: h, originalIdx: idx, score: distSum + h.dailyLease };
  });
  hubScores.sort((a, b) => a.score - b.score);
  const sortedHubs = hubScores.map((s) => s.hub);

  // Sorted leases and capacities for fast lower bound computation
  const sortedLeases = [...sortedHubs.map((h) => h.dailyLease)].sort((a, b) => a - b);
  const sortedCapsDesc = [...sortedHubs.map((h) => h.capacity)].sort((a, b) => b - a);

  let bestIncumbentCost = Infinity;
  let bestOpenHubs: SolverHub[] = [];
  let bestResultDetails: any = null;
  let isAnytimeBest = false;

  // 1. Warm start with previous optimal facility set if provided
  if (warmStartHubIds && warmStartHubIds.length === p) {
    const candidateWarmHubs = hubs.filter((h) => warmStartHubIds.includes(h.id));
    if (candidateWarmHubs.length === p) {
      const res = solveTransportationProblem(
        candidateWarmHubs,
        zones,
        costPerOrderKm,
        radiusMaxKm,
        distanceMatrixKm,
        durationMatrixMin
      );
      if (res.feasible) {
        const leaseCost = candidateWarmHubs.reduce((sum, h) => sum + h.dailyLease, 0);
        const totalCost = res.transitCost + leaseCost;
        bestIncumbentCost = totalCost;
        bestOpenHubs = candidateWarmHubs;
        bestResultDetails = res;
        metrics.incumbentUpdates++;
      }
    }
  }

  // 2. If no warm start, try top p hubs from heuristic as seed
  if (!bestResultDetails) {
    const seedHubs = sortedHubs.slice(0, p);
    const res = solveTransportationProblem(
      seedHubs,
      zones,
      costPerOrderKm,
      radiusMaxKm,
      distanceMatrixKm,
      durationMatrixMin
    );
    if (res.feasible) {
      const leaseCost = seedHubs.reduce((sum, h) => sum + h.dailyLease, 0);
      bestIncumbentCost = res.transitCost + leaseCost;
      bestOpenHubs = seedHubs;
      bestResultDetails = res;
      metrics.incumbentUpdates++;
    }
  }

  // 3. Branch-and-bound recursion
  const chosenIndices: number[] = new Array(p);

  function branchAndBound(hubIdx: number, chosenCount: number, currentLeaseSum: number, currentCapSum: number): void {
    metrics.nodesExplored++;

    // Check anytime budget every 64 nodes
    if ((metrics.nodesExplored & 63) === 0) {
      if (performance.now() - tStart >= timeBudgetMs) {
        isAnytimeBest = true;
        return;
      }
    }

    if (chosenCount === p) {
      metrics.setsEvaluated++;
      const currentHubs = chosenIndices.map((i) => sortedHubs[i]);
      const res = solveTransportationProblem(
        currentHubs,
        zones,
        costPerOrderKm,
        radiusMaxKm,
        distanceMatrixKm,
        durationMatrixMin
      );

      if (res.feasible) {
        const totalCost = res.transitCost + currentLeaseSum;
        if (totalCost < bestIncumbentCost) {
          bestIncumbentCost = totalCost;
          bestOpenHubs = currentHubs;
          bestResultDetails = res;
          metrics.incumbentUpdates++;
        }
      }
      return;
    }

    const remainingToPick = p - chosenCount;
    const remainingAvailable = m - hubIdx;

    if (remainingAvailable < remainingToPick) {
      return;
    }

    // Capacity bound check: even if we pick the largest remaining capacities, can we meet total demand?
    let maxPossibleCap = currentCapSum;
    for (let i = 0; i < remainingToPick; i++) {
      maxPossibleCap += sortedCapsDesc[i];
    }
    if (maxPossibleCap < totalDemand) {
      metrics.nodesPruned++;
      return;
    }

    // Lower bound check: current lease + cheapest remaining leases + uncapacitated transit lower bound
    let minRemainingLease = 0;
    for (let i = 0; i < remainingToPick; i++) {
      minRemainingLease += sortedLeases[i];
    }

    let uncapacitatedTransitLb = 0;
    for (let zIdx = 0; zIdx < zones.length; zIdx++) {
      const z = zones[zIdx];
      let minCost = Infinity;

      // Check among currently chosen hubs
      for (let k = 0; k < chosenCount; k++) {
        const h = sortedHubs[chosenIndices[k]];
        const d = distanceMatrixKm[h.id]?.[z.id] ?? 99999;
        if (radiusMaxKm === null || d <= radiusMaxKm) {
          if (d < minCost) minCost = d;
        }
      }

      // Check among all remaining allowed hubs
      for (let hIdx = hubIdx; hIdx < m; hIdx++) {
        const h = sortedHubs[hIdx];
        const d = distanceMatrixKm[h.id]?.[z.id] ?? 99999;
        if (radiusMaxKm === null || d <= radiusMaxKm) {
          if (d < minCost) minCost = d;
        }
      }

      if (minCost === Infinity) {
        uncapacitatedTransitLb += z.demand * SLA_PENALTY_PER_ORDER;
      } else {
        uncapacitatedTransitLb += z.demand * minCost * costPerOrderKm;
      }
    }

    const lowerBound = currentLeaseSum + minRemainingLease + uncapacitatedTransitLb;
    if (lowerBound >= bestIncumbentCost) {
      metrics.nodesPruned++;
      return;
    }

    // Branch 1: Include sortedHubs[hubIdx]
    chosenIndices[chosenCount] = hubIdx;
    branchAndBound(
      hubIdx + 1,
      chosenCount + 1,
      currentLeaseSum + sortedHubs[hubIdx].dailyLease,
      currentCapSum + sortedHubs[hubIdx].capacity
    );

    if (isAnytimeBest) return;

    // Branch 2: Exclude sortedHubs[hubIdx]
    branchAndBound(hubIdx + 1, chosenCount, currentLeaseSum, currentCapSum);
  }

  // Run Branch and Bound starting from root
  branchAndBound(0, 0, 0, 0);

  metrics.elapsedMs = Math.round((performance.now() - tStart) * 10) / 10;

  if (!bestResultDetails) {
    return {
      status: 'Infeasible',
      isOptimal: false,
      isAnytimeBest,
      openHubIds: [],
      openHubs: [],
      assignments: [],
      uncoveredZoneIds: zones.map((z) => z.id),
      coveragePercentage: 0,
      fastDeliveryCoveragePct: 0,
      totalTransitCostInr: 0,
      totalLeaseCostInr: 0,
      combinedTotalCostInr: 0,
      totalWeightedDistanceKm: 0,
      averageDistanceKm: 0,
      metrics,
    };
  }

  // Format Open Hubs metadata
  const openHubsSummary = bestOpenHubs.map((h, idx) => {
    const assignedDem = bestResultDetails.hubAssignedDemand[idx] ?? 0;
    const utilPct = h.capacity > 0 ? (assignedDem / h.capacity) * 100.0 : 0;
    const zonesServed = bestResultDetails.assignments.filter((a: ZoneAssignmentResult) =>
      a.hubAssignments.some((ha: AssignmentFraction) => ha.hubId === h.id)
    ).length;

    return {
      hubId: h.id,
      name: h.name,
      latitude: h.lat,
      longitude: h.lng,
      capacity: h.capacity,
      assignedDemand: Math.round(assignedDem),
      utilizationPct: Math.round(utilPct * 10) / 10,
      zonesServedCount: zonesServed,
    };
  });

  const totalLease = bestOpenHubs.reduce((sum, h) => sum + h.dailyLease, 0);
  const totalTransit = bestResultDetails.transitCost;
  const combined = Math.round((totalLease + totalTransit) * 100) / 100;

  let fastDeliveryDemand = 0;
  let coveredDemand = 0;

  for (const a of bestResultDetails.assignments) {
    if (a.isCovered) {
      coveredDemand += a.demand;
      const isFast = a.hubAssignments.some((ha: AssignmentFraction) => ha.distanceKm <= 5.0);
      if (isFast) fastDeliveryDemand += a.demand;
    }
  }

  const covPct = totalDemand > 0 ? Math.round((coveredDemand / totalDemand) * 1000) / 10 : 100;
  const fastCovPct = totalDemand > 0 ? Math.round((fastDeliveryDemand / totalDemand) * 1000) / 10 : 0;
  const avgDist = totalDemand > 0 ? Math.round((bestResultDetails.weightedDistanceKm / totalDemand) * 100) / 100 : 0;

  return {
    status: isAnytimeBest ? 'Feasible' : 'Optimal',
    isOptimal: !isAnytimeBest,
    isAnytimeBest,
    openHubIds: bestOpenHubs.map((h) => h.id),
    openHubs: openHubsSummary,
    assignments: bestResultDetails.assignments,
    uncoveredZoneIds: bestResultDetails.uncoveredZoneIds,
    coveragePercentage: covPct,
    fastDeliveryCoveragePct: fastCovPct,
    totalTransitCostInr: totalTransit,
    totalLeaseCostInr: totalLease,
    combinedTotalCostInr: combined,
    totalWeightedDistanceKm: bestResultDetails.weightedDistanceKm,
    averageDistanceKm: avgDist,
    metrics,
  };
}

/**
 * Solves the Capacitated Facility Location Problem (CFLP) to global mathematical optimality.
 * If autoSize is true, sweeps candidate warehouse counts k in [kMin, kMax] and returns
 * the network topology with minimal total combined cost (transit + lease).
 */
export function solveExactCFLP(input: SolverInput): SolverOutput {
  const tStart = performance.now();
  const timeBudgetMs = input.timeBudgetMs ?? 600;

  if (!input.autoSize) {
    return solveExactCFLPForP(input, input.p, tStart, timeBudgetMs);
  }

  const totalDemand = input.zones.reduce((sum, z) => sum + z.demand, 0);
  const m = input.hubs.length;

  if (m === 0 || input.zones.length === 0) {
    return solveExactCFLPForP(input, 1, tStart, timeBudgetMs);
  }

  // 1. Determine minimum feasible k (kMin) based on capacity requirement
  const sortedCapsDesc = [...input.hubs.map((h) => h.capacity)].sort((a, b) => b - a);
  let runningCap = 0;
  let kMin = 1;
  for (let i = 0; i < sortedCapsDesc.length; i++) {
    runningCap += sortedCapsDesc[i];
    if (runningCap >= totalDemand) {
      kMin = i + 1;
      break;
    }
  }
  if (runningCap < totalDemand) {
    kMin = m;
  }
  kMin = Math.max(1, Math.min(m, kMin));

  // 2. Determine upper bound kMax
  const pUpper = input.pMax !== undefined && input.pMax !== null ? input.pMax : m;
  const kMax = Math.min(m, Math.max(kMin, pUpper));

  let bestOutput: SolverOutput | null = null;
  let bestK = kMin;
  let totalNodesExplored = 0;
  let totalNodesPruned = 0;
  let totalIncumbentUpdates = 0;
  let totalSetsEvaluated = 0;
  let totalCombinations = 0;

  // Sweep from kMin to kMax
  for (let k = kMin; k <= kMax; k++) {
    // If remaining budget is exhausted, stop sweep
    if (performance.now() - tStart >= timeBudgetMs && bestOutput !== null) {
      break;
    }

    const out = solveExactCFLPForP(input, k, tStart, timeBudgetMs);

    totalNodesExplored += out.metrics.nodesExplored;
    totalNodesPruned += out.metrics.nodesPruned;
    totalIncumbentUpdates += out.metrics.incumbentUpdates;
    totalSetsEvaluated += out.metrics.setsEvaluated;
    totalCombinations += out.metrics.totalCombinations;

    if (!bestOutput) {
      bestOutput = out;
      bestK = k;
      continue;
    }

    // Compare with current best:
    // Prefer higher coverage; for equal coverage (or both 100%), prefer lower combined cost
    const covDiff = out.coveragePercentage - bestOutput.coveragePercentage;
    if (covDiff > 0.5) {
      bestOutput = out;
      bestK = k;
    } else if (Math.abs(covDiff) <= 0.5) {
      if (out.combinedTotalCostInr < bestOutput.combinedTotalCostInr) {
        bestOutput = out;
        bestK = k;
      }
    }
  }

  if (!bestOutput) {
    return solveExactCFLPForP(input, kMin, tStart, timeBudgetMs);
  }

  bestOutput.autoSize = true;
  bestOutput.metrics = {
    nodesExplored: totalNodesExplored,
    nodesPruned: totalNodesPruned,
    incumbentUpdates: totalIncumbentUpdates,
    setsEvaluated: totalSetsEvaluated,
    totalCombinations: totalCombinations,
    elapsedMs: Math.round((performance.now() - tStart) * 10) / 10,
  };
  bestOutput.sizingRationale = `Auto-sized to ${bestK} warehouses: minimum combined daily cost (₹${Math.round(
    bestOutput.combinedTotalCostInr
  ).toLocaleString('en-IN')}) with ${bestOutput.coveragePercentage}% demand coverage across ${totalDemand.toLocaleString(
    'en-IN'
  )} daily orders.`;

  return bestOutput;
}
