/**
 * CFLP Solver Types & Data Contracts
 */

export interface SolverZone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  demand: number; // Effective daily orders
}

export interface SolverHub {
  id: string;
  name: string;
  lat: number;
  lng: number;
  capacity: number; // Capacity ceiling in orders/day
  dailyLease: number; // Daily lease cost in INR
}

export interface SolverInput {
  zones: SolverZone[];
  hubs: SolverHub[];
  p: number; // Exactly p warehouses to open (or starting seed if autoSize is true)
  autoSize?: boolean; // If true, sweep k in [kMin, kMax] to minimize combined cost
  pMax?: number | null; // Upper bound for auto-sizing sweep
  costPerKm: number; // INR per vehicle-km
  radiusMaxKm?: number | null; // Optional SLA radius
  distanceMatrixKm: Record<string, Record<string, number>>; // [hubId][zoneId]
  durationMatrixMin?: Record<string, Record<string, number>>; // [hubId][zoneId]
  warmStartHubIds?: string[]; // Previous optimal facility set
  timeBudgetMs?: number; // Anytime budget, default 400ms
}

export interface AssignmentFraction {
  hubId: string;
  hubName: string;
  fraction: number; // 0.0 to 1.0 (sums to 1.0 per zone if covered)
  assignedDemand: number;
  distanceKm: number;
  durationMin: number;
}

export interface ZoneAssignmentResult {
  zoneId: string;
  zoneName: string;
  demand: number;
  isCovered: boolean;
  hubAssignments: AssignmentFraction[];
}

export interface SolverMetrics {
  nodesExplored: number;
  nodesPruned: number;
  incumbentUpdates: number;
  setsEvaluated: number;
  totalCombinations: number;
  elapsedMs: number;
}

export interface SolverOutput {
  status: 'Optimal' | 'Feasible' | 'Infeasible';
  isOptimal: boolean;
  isAnytimeBest: boolean; // True if budget exceeded before full branch-and-bound proof
  autoSize?: boolean;
  sizingRationale?: string;
  openHubIds: string[];
  openHubs: {
    hubId: string;
    name: string;
    latitude: number;
    longitude: number;
    capacity: number;
    assignedDemand: number;
    utilizationPct: number;
    zonesServedCount: number;
  }[];
  assignments: ZoneAssignmentResult[];
  uncoveredZoneIds: string[];
  coveragePercentage: number;
  fastDeliveryCoveragePct: number; // Zones within 5 km
  totalTransitCostInr: number;
  totalLeaseCostInr: number;
  combinedTotalCostInr: number;
  totalWeightedDistanceKm: number;
  averageDistanceKm: number;
  metrics: SolverMetrics;
}

export interface WorkerSolveRequest {
  id: number;
  input: SolverInput;
}

export interface WorkerSolveResponse {
  id: number;
  output: SolverOutput;
  error?: string;
}
