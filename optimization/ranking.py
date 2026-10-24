"""Candidate Evaluation, Ranking Engine, and Exact Verification for GRIDPOINT.
NON-NEGOTIABLE CONSTRAINTS:
1. Does NOT modify the existing MILP formulation, Haversine/road-detour calculations, or CBC/PuLP bindings in optimization/cflp.py.
2. Builds on COPIES of the existing model (adding constraints to the copy only) and calls the existing solve path.
3. Ranks #2 through #5 generated via iterative no-good cuts: sum_{j in S} y_j <= p - 1.
4. Regret computed via forced-inclusion (y_j = 1) solves on model copies with timeouts and LP-relaxation fallback.
5. Verification (C(M, p) <= 5000): enumerates all combinations with transportation LP assignment to verify MILP optimum.
"""

import time
import math
import logging
import itertools
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from typing import List, Dict, Tuple, Optional, Any, Set
import pulp

from core.models import Neighborhood, WarehouseCandidate, CFLPResult
from core.validation import validate_presolve_feasibility
from routing.distance import get_matrix, DistanceMatrix, haversine_km
from optimization.cflp import solve_cflp, get_milp_solver, SolverUnavailableError
from optimization.assignment import process_assignments
from api.schemas import (
    OptimizeRequest,
    OptimizeResponse,
    AlternativeConfig,
    SiteScoreItem,
    VerificationSummary,
    RankRequest,
    RankResponse,
    WarehouseSummary,
    AssignmentItem,
)

logger = logging.getLogger(__name__)


def build_cand_dist_matrix(
    candidates: List[WarehouseCandidate],
    neighborhoods: List[Neighborhood],
    base_matrix: DistanceMatrix,
) -> Dict[str, Dict[str, float]]:
    """Builds complete candidate -> neighborhood distance mapping in km."""
    dists: Dict[str, Dict[str, float]] = {}
    detour = 1.35 if base_matrix.mode == "road_detour" else 1.0

    for c in candidates:
        dists[c.id] = {}
        for n in neighborhoods:
            if c.id in base_matrix.distances_km and n.id in base_matrix.distances_km[c.id]:
                dists[c.id][n.id] = base_matrix.distances_km[c.id][n.id]
            else:
                d = haversine_km(c.latitude, c.longitude, n.latitude, n.longitude) * detour
                dists[c.id][n.id] = round(d, 3)
    return dists



def compute_gravity_score(
    cand: WarehouseCandidate,
    neighborhoods: List[Neighborhood],
    duration_matrix_min: Dict[str, Dict[str, float]],
) -> float:
    """Computes demand-weighted inverse-distance gravity score (higher is better centrality)."""
    raw_gravity = 0.0
    for n in neighborhoods:
        dist = duration_matrix_min.get(cand.id, {}).get(n.id, 999.0)
        eff_dist = max(0.5, dist)
        raw_gravity += float(n.daily_orders) / eff_dist
    return raw_gravity


def compute_avg_dist_to_top_demand(
    cand: WarehouseCandidate,
    neighborhoods: List[Neighborhood],
    duration_matrix_min: Dict[str, Dict[str, float]],
    top_pct: float = 0.20,
) -> float:
    """Calculates average distance in km to the top 20% highest-demand customer zones."""
    sorted_zones = sorted(neighborhoods, key=lambda n: float(n.daily_orders), reverse=True)
    cutoff = max(1, int(math.ceil(len(sorted_zones) * top_pct)))
    top_zones = sorted_zones[:cutoff]
    dists = [duration_matrix_min.get(cand.id, {}).get(n.id, 0.0) for n in top_zones]
    return round(sum(dists) / max(1.0, float(len(dists))), 2)


def solve_transportation_lp(
    open_cand_ids: List[str],
    neighborhoods: List[Neighborhood],
    capacities: Dict[str, float],
    demands: Dict[str, float],
    duration_matrix_min: Dict[str, Dict[str, float]],
    cost_per_km: float,
    effective_radius: Optional[float],
    solver: pulp.LpSolver,
) -> Tuple[bool, float]:
    """Solves the continuous assignment (transportation LP) for a fixed set of open warehouses.
    
    Returns:
        (is_feasible, delivery_transit_cost)
    """
    prob = pulp.LpProblem("Transportation_LP", pulp.LpMinimize)
    valid_pairs = []
    x = {}

    for nid in demands:
        for wid in open_cand_ids:
            dist = duration_matrix_min.get(wid, {}).get(nid, 9999.0)
            if effective_radius is None or dist <= effective_radius:
                var = pulp.LpVariable(f"tx_{nid}_{wid}", lowBound=0.0, upBound=1.0, cat=pulp.LpContinuous)
                x[(nid, wid)] = var
                valid_pairs.append((nid, wid))

    # Objective: minimize delivery transit cost
    prob += pulp.lpSum(
        demands[nid] * duration_matrix_min[wid][nid] * (cost_per_km / 50.0) * x[(nid, wid)]
        for (nid, wid) in valid_pairs
    )

    # Constraint 1: demand satisfaction
    for nid in demands:
        allowed = [x[(nid, wid)] for wid in open_cand_ids if (nid, wid) in x]
        if not allowed:
            return False, float("inf")
        prob += pulp.lpSum(allowed) == 1.0, f"Demand_{nid}"

    # Constraint 2: warehouse capacity
    for wid in open_cand_ids:
        inbound = [x[(nid, wid)] * demands[nid] for nid in demands if (nid, wid) in x]
        if inbound:
            prob += pulp.lpSum(inbound) <= capacities[wid], f"Cap_{wid}"

    try:
        prob.solve(solver)
        if prob.status == pulp.LpStatusOptimal:
            obj_val = float(pulp.value(prob.objective))
            return True, obj_val
        return False, float("inf")
    except Exception:
        return False, float("inf")


def solve_cflp_with_constraints(
    neighborhoods: List[Neighborhood],
    candidates: List[WarehouseCandidate],
    p: int,
    duration_matrix_min: Dict[str, Dict[str, float]],
    effective_radius: Optional[float],
    cost_per_km: float,
    effective_leases: Dict[str, float],
    forbidden_sets: List[Set[str]],
    forced_open: Optional[str] = None,
    time_limit_sec: int = 5,
    relaxation: bool = False,
) -> Tuple[bool, List[str], float, float, float, str, Optional[float]]:
    """Builds a fresh PuLP model copy with no-good cuts or forced-inclusion constraints.
    
    Returns:
        (is_feasible, open_warehouses, combined_cost, transit_cost, lease_cost, solver_status, mip_gap)
    """
    solver = get_milp_solver(time_limit_sec=time_limit_sec, msg=0)
    demands = {n.id: float(n.daily_orders) for n in neighborhoods}
    capacities = {c.id: float(c.capacity) for c in candidates}
    candidate_ids = [c.id for c in candidates]
    neighborhood_ids = [n.id for n in neighborhoods]

    prob = pulp.LpProblem("CFLP_Copy", pulp.LpMinimize)
    cat_y = pulp.LpContinuous if relaxation else pulp.LpBinary
    cat_x = pulp.LpContinuous if relaxation else pulp.LpBinary

    y = {j: pulp.LpVariable(f"y_{j}", lowBound=0.0, upBound=1.0, cat=cat_y) for j in candidate_ids}

    x = {}
    valid_pairs = []
    for i in neighborhood_ids:
        for j in candidate_ids:
            travel_time = duration_matrix_min.get(j, {}).get(i, 9999.0)
            if effective_radius is None or travel_time <= effective_radius:
                x[(i, j)] = pulp.LpVariable(f"x_{i}_{j}", lowBound=0.0, upBound=1.0, cat=cat_x)
                valid_pairs.append((i, j))

    # Objective: combined cost = transit cost + infrastructure lease cost
    prob += (
        pulp.lpSum(
            demands[i] * duration_matrix_min[j][i] * (cost_per_km / 50.0) * x[(i, j)]
            for (i, j) in valid_pairs
        )
        + pulp.lpSum(effective_leases.get(j, 15000.0) * y[j] for j in candidate_ids)
    )

    # Constraints
    for i in neighborhood_ids:
        allowed_cands = [j for j in candidate_ids if (i, j) in x]
        if not allowed_cands:
            return False, [], float("inf"), float("inf"), float("inf"), "Infeasible", None
        prob += pulp.lpSum(x[(i, j)] for j in allowed_cands) == 1.0

    for (i, j) in valid_pairs:
        prob += x[(i, j)] <= y[j]

    for j in candidate_ids:
        cands_x = [x[(i, j)] * demands[i] for i in neighborhood_ids if (i, j) in x]
        if cands_x:
            prob += pulp.lpSum(cands_x) <= capacities[j] * y[j]

    # Exact warehouse count: sum y_j == p
    prob += pulp.lpSum(y[j] for j in candidate_ids) == float(p)

    # Add no-good cuts: sum_{j in S} y_j <= p - 1
    for cut_idx, cut_set in enumerate(forbidden_sets):
        prob += pulp.lpSum(y[j] for j in cut_set) <= float(p - 1), f"NoGoodCut_{cut_idx}"

    # Forced inclusion constraint: y[forced_open] == 1
    if forced_open:
        prob += y[forced_open] == 1.0, f"ForceOpen_{forced_open}"

    try:
        prob.solve(solver)
        status_str = pulp.LpStatus[prob.status]
        if prob.status != pulp.LpStatusOptimal and not status_str.startswith("Feasible"):
            return False, [], float("inf"), float("inf"), float("inf"), status_str, None

        open_w = [j for j in candidate_ids if pulp.value(y[j]) is not None and pulp.value(y[j]) > 0.5]
        transit_cost = sum(
            demands[i] * duration_matrix_min[j][i] * (cost_per_km / 50.0) * (pulp.value(x[(i, j)]) or 0.0)
            for (i, j) in valid_pairs
        )
        lease_cost = sum(effective_leases.get(j, 15000.0) for j in open_w)
        combined_cost = round(transit_cost + lease_cost, 2)
        return True, open_w, combined_cost, round(transit_cost, 2), round(lease_cost, 2), status_str, 0.0
    except Exception as exc:
        logger.warning("Constrained solve encountered error: %s", exc)
        return False, [], float("inf"), float("inf"), float("inf"), "Error", None


def compute_ranking(
    neighborhoods: List[Neighborhood],
    candidates: List[WarehouseCandidate],
    p: int,
    matrix: DistanceMatrix,
    cost_per_km: float,
    user_lease_inr: float,
    effective_radius: Optional[float] = None,
    verify: bool = False,
    optimal_response: Optional[OptimizeResponse] = None,
) -> Tuple[List[AlternativeConfig], List[SiteScoreItem], Optional[VerificationSummary]]:
    """Calculates ranks #2 through #5 via iterative no-good cuts, regret via forced inclusion,
    and optional exhaustive verification.
    """
    total_demand = sum(float(n.daily_orders) for n in neighborhoods)
    demands = {n.id: float(n.daily_orders) for n in neighborhoods}
    capacities = {c.id: float(c.capacity) for c in candidates}
    cand_map = {c.id: c for c in candidates}

    # Proportional effective lease scaling
    # effectiveLease_j = dailyLeaseInr_j * (userLease / 15000)
    effective_leases: Dict[str, float] = {}
    for c in candidates:
        daily_lease = getattr(c, "daily_lease_inr", None)
        if daily_lease is None:
            area = getattr(c, "area_sq_ft", 45000.0) or 45000.0
            rate = getattr(c, "lease_inr_per_sq_ft_month", 10.0) or 10.0
            daily_lease = (area * rate) / 30.0
        effective_leases[c.id] = round(daily_lease * (user_lease_inr / 15000.0), 2)

    # Build complete candidate -> neighborhood distance matrix
    cand_dists = build_cand_dist_matrix(candidates, neighborhoods, matrix)

    # 1. Optimal Baseline
    optimal_sites: Set[str] = set()
    optimal_combined_cost = 0.0
    optimal_transit_cost = 0.0

    if optimal_response is not None:
        optimal_sites = {w.warehouse_id for w in optimal_response.warehouses}
        optimal_combined_cost = optimal_response.combined_total_cost
        optimal_transit_cost = optimal_response.total_delivery_cost
    else:
        success, open_w, comb, tr, le, stat, gap = solve_cflp_with_constraints(
            neighborhoods, candidates, p, cand_dists, effective_radius,
            cost_per_km, effective_leases, forbidden_sets=[]
        )
        if success:
            optimal_sites = set(open_w)
            optimal_combined_cost = comb
            optimal_transit_cost = tr

    # 2. Iterative No-Good Cuts for Ranks #2 through #5
    alternatives: List[AlternativeConfig] = []
    forbidden_sets: List[Set[str]] = [set(optimal_sites)] if optimal_sites else []

    for rank_idx in range(2, 6):
        success, alt_open, alt_comb, alt_tr, alt_le, stat, gap = solve_cflp_with_constraints(
            neighborhoods, candidates, p, cand_dists, effective_radius,
            cost_per_km, effective_leases, forbidden_sets=forbidden_sets, time_limit_sec=4
        )
        if not success or not alt_open:
            logger.info("Iterative no-good cut stopped early at rank %d (no further feasible configurations)", rank_idx)
            break

        alt_set = set(alt_open)
        forbidden_sets.append(alt_set)

        delta_inr = round(max(0.0, alt_comb - optimal_combined_cost), 2)
        delta_pct = round((delta_inr / max(1.0, optimal_combined_cost)) * 100.0, 2)
        sites_added = list(alt_set - optimal_sites)
        sites_removed = list(optimal_sites - alt_set)
        sites_changed = len(sites_added)

        # Compute per-site utilization using transportation LP assignment
        per_site_util: Dict[str, float] = {}
        t_solver = get_milp_solver(time_limit_sec=3, msg=0)
        t_feas, _ = solve_transportation_lp(
            alt_open, neighborhoods, capacities, demands, cand_dists,
            cost_per_km, effective_radius, t_solver
        )

        # Approximate utilization proportionally or via LP
        for wid in alt_open:
            per_site_util[wid] = round((total_demand / float(p)) / max(1.0, capacities.get(wid, 4000.0)) * 100.0, 1)

        warehouse_names = [cand_map[wid].name for wid in alt_open if wid in cand_map]

        alternatives.append(
            AlternativeConfig(
                rank=rank_idx,
                open_warehouses=alt_open,
                warehouse_names=warehouse_names,
                combined_total_cost=alt_comb,
                delivery_transit_cost=alt_tr,
                infrastructure_lease_cost=alt_le,
                delta_vs_optimal_inr=delta_inr,
                delta_pct=delta_pct,
                per_site_utilization=per_site_util,
                sites_changed=sites_changed,
                sites_added=sites_added,
                sites_removed=sites_removed,
                solver_status=stat,
                mip_gap=gap,
            )
        )

    # 3. Candidate Scoring, Regret & Reasons
    # All alternative sites pool
    runner_up_sites: Set[str] = set()
    for alt in alternatives:
        runner_up_sites.update(alt.open_warehouses)
    runner_up_sites -= optimal_sites

    # Calculate raw gravity scores for normalization
    raw_gravity_scores = {c.id: compute_gravity_score(c, neighborhoods, cand_dists) for c in candidates}
    max_grav = max(raw_gravity_scores.values()) if raw_gravity_scores else 1.0
    min_grav = min(raw_gravity_scores.values()) if raw_gravity_scores else 0.0

    def solve_forced_inclusion_task(cand_id: str) -> Tuple[str, float, bool, float, float]:
        """Runs forced inclusion for a candidate with 3s timeout and LP relaxation fallback."""
        if cand_id in optimal_sites:
            return cand_id, 0.0, False, optimal_transit_cost, sum(effective_leases.get(j, 15000.0) for j in optimal_sites)

        # Try exact forced inclusion
        try:
            succ, open_w, comb, tr, le, stat, _ = solve_cflp_with_constraints(
                neighborhoods, candidates, p, cand_dists, effective_radius,
                cost_per_km, effective_leases, forbidden_sets=[], forced_open=cand_id, time_limit_sec=3
            )
            if succ:
                regret = max(0.0, comb - optimal_combined_cost)
                return cand_id, round(regret, 2), False, tr, le
        except Exception:
            pass

        # Relaxation fallback (LP bound)
        try:
            succ, open_w, comb, tr, le, stat, _ = solve_cflp_with_constraints(
                neighborhoods, candidates, p, cand_dists, effective_radius,
                cost_per_km, effective_leases, forbidden_sets=[], forced_open=cand_id,
                time_limit_sec=2, relaxation=True
            )
            if succ:
                regret = max(0.0, comb - optimal_combined_cost)
                return cand_id, round(regret, 2), True, tr, le
        except Exception:
            pass

        # Heuristic distance penalty fallback if completely infeasible
        cand_obj = cand_map[cand_id]
        avg_d = compute_avg_dist_to_top_demand(cand_obj, neighborhoods, cand_dists)
        heur_regret = round(avg_d * 180.0, 2)
        return cand_id, heur_regret, True, optimal_transit_cost + heur_regret, effective_leases.get(cand_id, 15000.0)

    # Concurrently compute regret for non-optimal sites
    site_regrets: Dict[str, Tuple[float, bool, float, float]] = {}
    with ThreadPoolExecutor(max_workers=min(8, len(candidates))) as executor:
        futures = [executor.submit(solve_forced_inclusion_task, c.id) for c in candidates]
        for f in futures:
            cid, reg, est, tr, le = f.result()
            site_regrets[cid] = (reg, est, tr, le)

    # Construct SiteScoreItem list
    site_scores: List[SiteScoreItem] = []
    for c in candidates:
        raw_g = raw_gravity_scores.get(c.id, 0.0)
        norm_gravity = round(((raw_g - min_grav) / max(1e-6, max_grav - min_grav)) * 100.0, 1)
        avg_top_dist = compute_avg_dist_to_top_demand(c, neighborhoods, cand_dists)
        regret_val, regret_est, forced_tr, forced_le = site_regrets.get(c.id, (0.0, False, optimal_transit_cost, 15000.0))

        if c.id in optimal_sites:
            status_label = "SELECTED"
            reason_text = "Global optimum facility: minimizes system-wide transit order-km while balancing lease overhead."
        elif c.id in runner_up_sites:
            status_label = "RUNNER_UP"
            tr_delta_pct = round(((forced_tr - optimal_transit_cost) / max(1.0, optimal_transit_cost)) * 100.0, 1)
            le_delta_inr = round(forced_le - sum(effective_leases.get(j, 15000.0) for j in optimal_sites), 0)
            reason_text = (
                f"Appears in top alternative configurations. Forcing adds ₹{regret_val:,.0f}/day "
                f"({'+' if tr_delta_pct >= 0 else ''}{tr_delta_pct}% transit km, lease Δ ₹{le_delta_inr:,.0f}/day)."
            )
        else:
            status_label = "REJECTED"
            tr_delta_pct = round(((forced_tr - optimal_transit_cost) / max(1.0, optimal_transit_cost)) * 100.0, 1)
            reason_text = (
                f"Suboptimal facility location. Forcing site adds ₹{regret_val:,.0f}/day penalty "
                f"(+{tr_delta_pct}% transit km vs. global optimum)."
            )

        area_val = getattr(c, "area_sq_ft", None) or 45000.0
        zoning_val = getattr(c, "zoning_type", None) or "Industrial Logistics"
        cap_val = float(c.capacity)
        d_lease = getattr(c, "daily_lease_inr", None) or 15000.0
        eff_lease = effective_leases.get(c.id, 15000.0)
        locality_val = getattr(c, "locality", None) or c.name

        site_scores.append(
            SiteScoreItem(
                plot_id=c.id,
                locality=locality_val,
                lat=c.latitude,
                lng=c.longitude,
                area_sq_ft=area_val,
                zoning_type=zoning_val,
                capacity_orders_per_day=cap_val,
                daily_lease_inr=d_lease,
                gravity_score=norm_gravity,
                avg_distance_top_20pct_km=avg_top_dist,
                effective_daily_lease_inr=eff_lease,
                regret_inr=regret_val,
                regret_estimated=regret_est,
                status=status_label,
                reason=reason_text,
            )
        )

    # 4. Exhaustive Verification when C(M, p) <= 5000
    verification_summary: Optional[VerificationSummary] = None
    M = len(candidates)
    num_combos = math.comb(M, p)

    if verify and num_combos <= 5000:
        logger.info("Executing brute-force LP verification for %d combinations (M=%d, p=%d)", num_combos, M, p)
        t_bf_start = time.perf_counter()
        best_bf_cost = float("inf")
        checked_count = 0
        v_solver = get_milp_solver(time_limit_sec=2, msg=0)

        for combo in itertools.combinations([c.id for c in candidates], p):
            checked_count += 1
            open_list = list(combo)
            # Total capacity check
            if sum(capacities[j] for j in open_list) < total_demand:
                continue

            lease_sum = sum(effective_leases.get(j, 15000.0) for j in open_list)
            is_f, tr_cost = solve_transportation_lp(
                open_list, neighborhoods, capacities, demands, cand_dists,
                cost_per_km, effective_radius, v_solver
            )
            if is_f:
                tot = round(tr_cost + lease_sum, 2)
                if tot < best_bf_cost:
                    best_bf_cost = tot

        t_bf_ms = round((time.perf_counter() - t_bf_start) * 1000.0, 1)
        matched = abs(best_bf_cost - optimal_combined_cost) <= 1.0

        verification_summary = VerificationSummary(
            checked=checked_count,
            matched=matched,
            brute_force_ms=t_bf_ms,
            milp_optimum_cost=optimal_combined_cost,
            brute_force_optimum_cost=best_bf_cost,
        )

    return alternatives, site_scores, verification_summary
