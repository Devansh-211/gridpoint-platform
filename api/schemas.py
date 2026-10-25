import math
from typing import List, Dict, Optional, Any, Union
from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator


# 1. Neighborhood models
class NeighborhoodItem(BaseModel):
    neighborhood_id: str
    name: str
    latitude: float
    longitude: float
    daily_orders: float
    capacity: Optional[float] = None


class NeighborhoodListRequest(BaseModel):
    neighborhoods: List[NeighborhoodItem]


class UploadResponse(BaseModel):
    session_id: str
    neighborhood_count: int
    total_demand: float
    preview: List[NeighborhoodItem]
    is_synthetic_ai: Optional[bool] = False
    dataset_type: Optional[str] = "demo"
    badge_text: Optional[str] = None
    scope: Optional[str] = None
    seed: Optional[int] = None
    data_source: Optional[str] = None
    source_label: Optional[str] = None


class ZoneInput(BaseModel):
    """Stateless input representation of a delivery zone or customer cluster."""
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    id: str
    name: Optional[str] = None
    lat: float = Field(default=0.0, alias="latitude")
    lng: float = Field(default=0.0, alias="longitude")
    orders: float = Field(default=0.0, alias="daily_orders")
    capacity: Optional[float] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_zone_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            d = dict(data)
            if "lat" in d and "latitude" not in d:
                d["latitude"] = d["lat"]
            elif "latitude" in d and "lat" not in d:
                d["lat"] = d["latitude"]
            if "lng" in d and "longitude" not in d:
                d["longitude"] = d["lng"]
            elif "longitude" in d and "lng" not in d:
                d["lng"] = d["longitude"]
            if "demand" in d and "daily_orders" not in d and "orders" not in d:
                d["daily_orders"] = d["demand"]
                d["orders"] = d["demand"]
            elif "orders" in d and "daily_orders" not in d:
                d["daily_orders"] = d["orders"]
            elif "daily_orders" in d and "orders" not in d:
                d["orders"] = d["daily_orders"]
            if not d.get("name"):
                d["name"] = d.get("id", "Zone")
            return d
        return data


class CandidateInput(BaseModel):
    """Stateless input representation of a candidate warehouse or distribution site."""
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    id: str
    name: Optional[str] = None
    lat: float = Field(default=0.0, alias="latitude")
    lng: float = Field(default=0.0, alias="longitude")
    capacity: Optional[float] = None
    lease: Optional[float] = Field(default=None, alias="daily_lease")
    area_sq_ft: Optional[float] = None
    lease_inr_per_sq_ft_month: Optional[float] = None
    zoning_type: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_candidate_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            d = dict(data)
            if "lat" in d and "latitude" not in d:
                d["latitude"] = d["lat"]
            elif "latitude" in d and "lat" not in d:
                d["lat"] = d["latitude"]
            if "lng" in d and "longitude" not in d:
                d["longitude"] = d["lng"]
            elif "longitude" in d and "lng" not in d:
                d["lng"] = d["longitude"]
            for k in ("daily_lease", "daily_lease_inr", "fixed_cost", "dailyLease"):
                if k in d and "lease" not in d:
                    d["lease"] = d[k]
                    d["daily_lease"] = d[k]
            if not d.get("name"):
                d["name"] = d.get("id", "Candidate")
            return d
        return data


# 2. Optimization models
class OptimizeRequest(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    session_id: Optional[str] = "default"
    dataset: Optional[str] = "demo"
    zones: Optional[List[ZoneInput]] = Field(default=None, description="Optional custom delivery zones (stateless payload)")
    candidates: Optional[List[CandidateInput]] = Field(default=None, description="Optional custom candidate warehouse locations (stateless payload)")
    p: int = Field(default=3, ge=1, description="Exact number of warehouses to open (in Manual mode)")
    auto_size: bool = Field(default=False, description="Whether to auto-size warehouse count to minimize total cost (Auto mode)")
    p_max: Optional[int] = Field(default=None, ge=1, description="Maximum warehouse count to consider in auto-size mode")
    warehouse_capacity: float = Field(default=4000.0, gt=0, description="Daily throughput capacity ceiling per site")
    radius_max_km: Optional[float] = Field(default=None, gt=0, description="Max service radius in kilometers")
    cost_per_km: float = Field(default=1.25, gt=0, description="Cost per kilometer of delivery travel (INR/order-km)")
    fixed_cost_per_warehouse: float = Field(default=300.0, ge=0, description="Daily facility lease cost per warehouse (INR/day)")
    routing_mode: str = Field(default="haversine", description="'haversine' or 'road_detour'")
    priority_preset: Optional[str] = Field(default="cost", description="'cost', 'speed', or 'sustainability'")
    assignment_mode: Optional[str] = Field(default="single", description="'single' (binary single-depot assignment) or 'split' (fractional continuous flow)")
    include_cvrp: bool = Field(default=False, description="Whether to refine straight-line to CVRP vehicle routes")
    vehicle_capacity: int = Field(default=250, gt=0, description="Vehicle order payload capacity")
    vehicle_fixed_cost: float = Field(default=150.0, ge=0, description="Fixed cost penalty per vehicle dispatched")
    time_window_start: Optional[str] = Field(default=None, description="Start of delivery time window HH:MM")
    time_window_end: Optional[str] = Field(default=None, description="End of delivery time window HH:MM")
    time_budget_s: Optional[float] = Field(default=25.0, gt=0, description="Overall solve time budget in seconds")
    best_effort: Optional[bool] = Field(default=False, description="If true, returns best effort partial solution on infeasibility")
    distanceKm: Optional[Any] = Field(
        default=None,
        description="Optional custom road/driving distance matrix in km: {hub_id: {zone_id: dist_km}}"
    )

    @field_validator("distanceKm", mode="before")
    @classmethod
    def validate_distance_km(cls, v: Any) -> Optional[Dict[str, Dict[str, float]]]:
        """Validates distance matrix or treats null/empty as not provided."""
        if v is None:
            return None
        if isinstance(v, (list, tuple)):
            if len(v) == 0:
                return None
            raise ValueError("distanceKm list format must be a dict of dicts: {hub_id: {zone_id: dist_km}}")
        if isinstance(v, dict):
            if len(v) == 0:
                return None
            cleaned: Dict[str, Dict[str, float]] = {}
            for src_k, row in v.items():
                if not isinstance(row, dict):
                    raise ValueError(f"Invalid row format at distanceKm['{src_k}']: expected dictionary")
                cleaned_row: Dict[str, float] = {}
                for dst_k, val in row.items():
                    try:
                        f_val = float(val)
                    except (TypeError, ValueError):
                        raise ValueError(f"Invalid non-numeric value at distanceKm['{src_k}']['{dst_k}']: {val}")
                    if not math.isfinite(f_val):
                        raise ValueError(f"Non-finite (NaN or Inf) value at distanceKm['{src_k}']['{dst_k}']: {val}")
                    if f_val < 0.0:
                        raise ValueError(f"Negative distance value at distanceKm['{src_k}']['{dst_k}']: {f_val}")
                    cleaned_row[str(dst_k)] = f_val
                cleaned[str(src_k)] = cleaned_row
            return cleaned
        raise ValueError(f"Invalid distanceKm format: expected dict of dicts or None, got {type(v).__name__}")


class WarehouseSummary(BaseModel):
    warehouse_id: str
    name: str
    latitude: float
    longitude: float
    capacity: float  # Capacity ceiling (orders/day)
    assigned_demand: float  # Capacity required (orders/day)
    capacity_required: Optional[float] = None  # Explicit alias for assigned_demand
    capacity_ceiling: Optional[float] = None  # Explicit alias for capacity
    capacity_utilization_pct: float
    neighborhoods_count: int


class AssignmentItem(BaseModel):
    neighborhood_id: str
    neighborhood_name: str
    latitude: float
    longitude: float
    warehouse_id: str
    warehouse_name: str
    warehouse_latitude: float
    warehouse_longitude: float
    distance_km: float
    daily_orders: float


class OptimizeResponse(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    status: str
    solver_message: str
    is_optimal: bool = False
    p: int
    auto_size: bool = False
    total_weighted_distance_km: float = 0.0
    average_distance_km: float = 0.0
    total_delivery_cost: float = 0.0
    total_infrastructure_cost: float = 0.0
    combined_total_cost: float = 0.0
    total_system_capacity: float = 0.0
    total_system_demand: float = 0.0
    capacity_headroom: float = 0.0
    capacity_headroom_pct: float = 0.0
    sizing_rationale: Optional[str] = None
    coverage_percentage: float = 100.0
    fast_delivery_coverage_pct: float = 0.0
    unserved_demand: float = 0.0
    estimated_co2_kg_per_day: float = 0.0
    co2_baseline_kg_per_day: float = 0.0
    co2_reduction_pct: float = 0.0
    estimated_monthly_savings: float = 0.0
    assumptions: Dict[str, Any] = Field(default_factory=dict)
    warehouses: List[WarehouseSummary] = Field(default_factory=list)
    assignments: List[AssignmentItem] = Field(default_factory=list)
    cvrp_summary: Optional[Dict[str, Any]] = None
    solve_ms: Optional[float] = None
    solver_status: Optional[str] = None
    mip_gap: Optional[float] = None
    # Structured outcome extensions
    shortfall_orders: Optional[float] = None
    min_feasible_p: Optional[int] = None
    reason: Optional[str] = None



# 3. Baseline & Comparison models
class SystemMetricSnapshot(BaseModel):
    label: str
    warehouses_count: int
    warehouses_open: List[str]
    total_delivery_cost: float
    total_infrastructure_cost: float
    combined_total_cost: float
    total_distance_km: float
    weighted_distance_km: float
    avg_capacity_utilization_pct: float
    estimated_co2_kg_per_day: float = 0.0


class CompareResponse(BaseModel):
    baseline: SystemMetricSnapshot
    optimized: SystemMetricSnapshot
    cost_delta: float
    cost_pct_change: float
    distance_delta_km: float
    distance_pct_change: float
    weighted_distance_delta: float
    weighted_distance_pct_change: float
    estimated_monthly_savings: float = 0.0
    co2_delta_kg: float = 0.0
    co2_pct_change: float = 0.0
    assumptions: Dict[str, Any]


# 4. Trade-off Curve models
class TradeoffPoint(BaseModel):
    p: int
    delivery_cost: float
    infrastructure_cost: float
    combined_cost: float
    weighted_distance_km: float
    is_feasible: bool
    warehouses_open: List[str]


class TradeoffResponse(BaseModel):
    points: List[TradeoffPoint]
    fixed_cost_per_warehouse: float
    cost_per_km: float


# 5. Scenario models
class ScenarioRequest(BaseModel):
    session_id: Optional[str] = "default"
    demand_multiplier: float = Field(default=1.2, gt=0, le=5.0)
    warehouse_failure_id: Optional[str] = None
    p: int = Field(default=3, ge=1, le=10)
    warehouse_capacity: float = Field(default=4000.0, gt=0)
    cost_per_km: float = Field(default=1.25, gt=0)
    fixed_cost_per_warehouse: float = Field(default=300.0, ge=0)


class ScenarioResponse(BaseModel):
    scenario_name: str
    demand_multiplier: float
    failed_warehouse_id: Optional[str]
    failed_warehouse_name: Optional[str] = None
    locations_changed: bool
    original_warehouses: List[str]
    scenario_warehouses: List[str]
    original_warehouse_names: List[str] = []
    scenario_warehouse_names: List[str] = []
    original_cost: float
    scenario_cost: float
    cost_pct_change: float
    original_weighted_distance: float
    scenario_weighted_distance: float
    weighted_distance_pct_change: float
    diagnostics: List[str] = []


# 6. Explainability models ("Why here?")
class DemandDriver(BaseModel):
    neighborhood_id: str
    name: str
    daily_orders: float
    distance_km: float
    weighted_ord_km: float


class NextBestCandidate(BaseModel):
    candidate_id: str
    name: str
    score_gap_weighted_km: float
    reason_rejected: str


class ExplainResponse(BaseModel):
    warehouse_id: str
    name: str
    latitude: float
    longitude: float
    demand_served: float
    demand_pct_of_total: float
    capacity: float
    capacity_utilization_pct: float
    neighborhoods_served_count: int
    weighted_distance_contribution: float
    avg_distance_km: float
    cost_contribution: float
    burden_eliminated_km: float = 0.0
    key_demand_drivers: List[DemandDriver] = []
    next_best_rejected: Optional[NextBestCandidate] = None


# 7. Conversational Agent models
class AgentMessage(BaseModel):
    role: str = Field(description="'user' or 'assistant'")
    content: str


class ExtractedParams(BaseModel):
    warehouse_count: Optional[int] = Field(default=None, description="Number of warehouses p (1-5)")
    warehouse_capacity: Optional[float] = Field(default=None, description="Throughput capacity (orders/day)")
    max_service_radius_km: Optional[float] = Field(default=None, description="Geographic service radius in km")
    cost_per_km: Optional[float] = Field(default=1.25, description="Cost per km in dollars")
    fixed_cost_per_warehouse: Optional[float] = Field(default=300.0, description="Daily facility lease cost")
    priority_preset: Optional[str] = Field(default="cost", description="'cost', 'speed', or 'sustainability'")
    include_cvrp: Optional[bool] = Field(default=False, description="Enable tactical vehicle tour optimization")
    vehicle_capacity: Optional[int] = Field(default=250, description="Payload capacity per vehicle")
    vehicle_fixed_cost: Optional[float] = Field(default=150.0, description="Fixed cost per vehicle")


class AgentExtractRequest(BaseModel):
    message: str
    history: List[AgentMessage] = []
    known_params: Optional[Dict[str, Any]] = None


class AgentExtractResponse(BaseModel):
    status: str = Field(description="'clarify', 'confirm', or 'error'")
    reply: str
    extracted_params: ExtractedParams
    missing_required: List[str] = []
    ready_to_optimize: bool = False
    defaults_applied: Optional[List[str]] = []
    warnings: Optional[List[str]] = []
    suggested_prompts: Optional[List[str]] = []
    confirmation_card: Optional[Dict[str, Any]] = None


# 8. Synthetic Data Generation models (Phase 3: Real-Geodata Sampler)
class SyntheticDataRequest(BaseModel):
    prompt: Optional[str] = Field(default=None, description="Plain-language generation request parsed by LLM into parameters")
    zone_count: Optional[int] = Field(default=50, description="Requested number of delivery zones (10-150)")
    scope: Optional[str] = Field(default=None, description="'state' or 'single_city'")
    region_filter: Optional[Dict[str, Any]] = Field(default=None, description="Country/state/city filter")
    pattern: Optional[str] = Field(default="clustered", description="'clustered' distribution")
    pattern_hint: Optional[str] = Field(default=None)
    region_name: Optional[str] = Field(default="Bengaluru Metro", description="City/region naming flavor")
    city_hint: Optional[str] = Field(default=None)
    session_id: Optional[str] = Field(default="default")
    seed: Optional[int] = Field(default=None, description="Deterministic reproducibility seed")


# 9. Grounded Explain Mode models (Phase 4)
class AgentExplainRequest(BaseModel):
    page: str = Field(description="Active page identifier e.g. 'viewResults', 'viewScenarios', 'viewDisruption', 'viewFleet', 'viewAnalytics'")
    message: str = Field(description="User question about the current screen")
    page_context: Dict[str, Any] = Field(description="Real computed metrics, tables, and parameters currently on this screen")
    history: Optional[List[AgentMessage]] = Field(default=[])


class AgentExplainResponse(BaseModel):
    reply: str
    page: str
    grounded: bool = True
    grounded_facts: List[str] = []
    suggested_followups: List[str] = []


# 10. Candidate Evaluation & Ranking models
class AlternativeConfig(BaseModel):
    rank: int
    open_warehouses: List[str]
    warehouse_names: List[str]
    combined_total_cost: float
    delivery_transit_cost: float
    infrastructure_lease_cost: float
    delta_vs_optimal_inr: float
    delta_pct: float
    per_site_utilization: Dict[str, float]
    sites_changed: int
    sites_added: List[str]
    sites_removed: List[str]
    solver_status: str
    mip_gap: Optional[float] = None


class SiteScoreItem(BaseModel):
    plot_id: str
    locality: str
    lat: float
    lng: float
    area_sq_ft: float
    zoning_type: str
    capacity_orders_per_day: float
    daily_lease_inr: float
    gravity_score: float
    avg_distance_top_20pct_km: float
    effective_daily_lease_inr: float
    regret_inr: float
    regret_estimated: bool = False
    status: str = Field(description="'SELECTED', 'RUNNER_UP', or 'REJECTED'")
    reason: str


class VerificationSummary(BaseModel):
    checked: int
    matched: bool
    brute_force_ms: float
    milp_optimum_cost: float
    brute_force_optimum_cost: float


class RankRequest(OptimizeRequest):
    max_alternatives: int = Field(default=4, ge=0, le=10, description="Max alternative configurations to generate (0-10)")
    verify: bool = Field(default=False, description="Enumerate combinations and run transportation LP verification when C(M, p) <= 5000")


class RankResponse(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    session_id: str
    p: int
    optimal: Optional[OptimizeResponse] = None
    alternatives: List[AlternativeConfig] = Field(default_factory=list)
    site_scores: List[SiteScoreItem] = Field(default_factory=list)
    verification: Optional[VerificationSummary] = None
    solve_ms: float = 0.0
    status: Optional[str] = "Optimal"
    partial: Optional[bool] = False
    shortfall_orders: Optional[float] = None
    min_feasible_p: Optional[int] = None
    reason: Optional[str] = None



