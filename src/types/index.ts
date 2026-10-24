export type Currency = 'INR' | 'USD';

export interface DeliveryZone {
  neighborhood_id: string;
  name: string;
  latitude: number;
  longitude: number;
  daily_orders: number;
  capacity?: number | null;
}

export interface WarehouseSummary {
  warehouse_id: string;
  name: string;
  latitude: number;
  longitude: number;
  capacity: number;
  assigned_demand: number;
  capacity_required: number;
  capacity_ceiling: number;
  capacity_utilization_pct: number;
  neighborhoods_count: number;
}

export interface AssignmentItem {
  neighborhood_id: string;
  neighborhood_name: string;
  latitude: number;
  longitude: number;
  warehouse_id: string;
  warehouse_name: string;
  warehouse_latitude: number;
  warehouse_longitude: number;
  distance_km: number;
  daily_orders: number;
}

export interface OptimizeResponse {
  status: string;
  solver_message: string;
  is_optimal: boolean;
  p: number;
  auto_size: boolean;
  total_weighted_distance_km: number;
  average_distance_km: number;
  total_delivery_cost: number; // Stored in INR
  total_infrastructure_cost: number; // Stored in INR
  combined_total_cost: number; // Stored in INR
  total_system_capacity: number;
  total_system_demand: number;
  capacity_headroom: number;
  capacity_headroom_pct: number;
  sizing_rationale?: string | null;
  coverage_percentage: number;
  fast_delivery_coverage_pct: number;
  unserved_demand: number;
  estimated_co2_kg_per_day: number;
  co2_baseline_kg_per_day: number;
  co2_reduction_pct: number;
  estimated_monthly_savings: number; // Stored in INR
  assumptions: Record<string, any>;
  warehouses: WarehouseSummary[];
  assignments: AssignmentItem[];
  cvrp_summary?: any;
  solve_ms?: number | null;
  solver_status?: string | null;
  mip_gap?: number | null;
}

export interface SystemMetricSnapshot {
  label: string;
  warehouses_count: number;
  warehouses_open: string[];
  total_delivery_cost: number;
  total_infrastructure_cost: number;
  combined_total_cost: number;
  total_distance_km: number;
  weighted_distance_km: number;
  avg_capacity_utilization_pct: number;
  estimated_co2_kg_per_day: number;
}

export interface CompareResponse {
  baseline: SystemMetricSnapshot;
  optimized: SystemMetricSnapshot;
  cost_delta: number;
  cost_pct_change: number;
  distance_delta_km: number;
  distance_pct_change: number;
  weighted_distance_delta: number;
  weighted_distance_pct_change: number;
  estimated_monthly_savings: number;
  co2_delta_kg: number;
  co2_pct_change: number;
  assumptions: Record<string, any>;
}

export interface TradeoffPoint {
  p: number;
  delivery_cost: number;
  infrastructure_cost: number;
  combined_cost: number;
  weighted_distance_km: number;
  is_feasible: boolean;
  warehouses_open: string[];
}

export interface AlternativeConfig {
  rank: number;
  open_warehouses: string[];
  warehouse_names: string[];
  combined_total_cost: number;
  delivery_transit_cost: number;
  infrastructure_lease_cost: number;
  delta_vs_optimal_inr: number;
  delta_pct: number;
  per_site_utilization: Record<string, number>;
  sites_changed: number;
  sites_added: string[];
  sites_removed: string[];
  solver_status: string;
  mip_gap?: number | null;
}

export interface SiteScoreItem {
  plot_id: string;
  locality: string;
  lat: number;
  lng: number;
  area_sq_ft: number;
  zoning_type: string;
  capacity_orders_per_day: number;
  daily_lease_inr: number;
  gravity_score: number;
  avg_distance_top_20pct_km: number;
  effective_daily_lease_inr: number;
  regret_inr: number;
  regret_estimated: boolean;
  status: 'SELECTED' | 'RUNNER_UP' | 'REJECTED';
  reason: string;
}

export interface VerificationSummary {
  checked: number;
  matched: boolean;
  brute_force_ms: number;
  milp_optimum_cost: number;
  brute_force_optimum_cost: number;
}

export interface RankResponse {
  session_id: string;
  p: number;
  optimal: OptimizeResponse;
  alternatives: AlternativeConfig[];
  site_scores: SiteScoreItem[];
  verification?: VerificationSummary | null;
  solve_ms: number;
}

