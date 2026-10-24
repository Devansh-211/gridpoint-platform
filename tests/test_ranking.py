"""Unit and integration tests for candidate evaluation, ranking, and verification."""

import pytest
import math
from core.models import Neighborhood, WarehouseCandidate
from routing.distance import get_matrix
from optimization.ranking import compute_ranking, solve_transportation_lp
from optimization.cflp import get_milp_solver


@pytest.fixture
def small_network():
    """Small fixture of 6 neighborhoods and 4 candidates for fast testing."""
    neighborhoods = [
        Neighborhood("N1", "Koramangala", 12.9352, 77.6245, 400.0),
        Neighborhood("N2", "Indiranagar", 12.9784, 77.6408, 350.0),
        Neighborhood("N3", "Whitefield", 12.9698, 77.7500, 500.0),
        Neighborhood("N4", "HSR Layout", 12.9121, 77.6446, 450.0),
        Neighborhood("N5", "Electronic City", 12.8452, 77.6602, 380.0),
        Neighborhood("N6", "BTM Layout", 12.9166, 77.6101, 320.0),
    ]
    candidates = [
        WarehouseCandidate("C1", "Koramangala Hub", 12.9352, 77.6245, 2500.0, plot_id="BLR-PL-01", locality="Koramangala", area_sq_ft=45000, lease_inr_per_sq_ft_month=10.0),
        WarehouseCandidate("C2", "Indiranagar Yard", 12.9784, 77.6408, 2500.0, plot_id="BLR-PL-02", locality="Indiranagar", area_sq_ft=40000, lease_inr_per_sq_ft_month=12.0),
        WarehouseCandidate("C3", "Whitefield Logistics", 12.9698, 77.7500, 3000.0, plot_id="BLR-PL-03", locality="Whitefield", area_sq_ft=55000, lease_inr_per_sq_ft_month=9.5),
        WarehouseCandidate("C4", "HSR Facility", 12.9121, 77.6446, 2500.0, plot_id="BLR-PL-04", locality="HSR Layout", area_sq_ft=48000, lease_inr_per_sq_ft_month=9.0),
    ]
    for c in candidates:
        setattr(c, "daily_lease_inr", (c.area_sq_ft * c.lease_inr_per_sq_ft_month) / 30.0)
    matrix = get_matrix(neighborhoods, mode="haversine")
    return neighborhoods, candidates, matrix


def test_no_good_cuts_unique_and_non_decreasing(small_network):
    """Test that alternatives generated via no-good cuts never repeat site sets and objectives are non-decreasing."""
    neighborhoods, candidates, matrix = small_network
    p = 2
    alternatives, site_scores, verification = compute_ranking(
        neighborhoods=neighborhoods,
        candidates=candidates,
        p=p,
        matrix=matrix,
        cost_per_km=35.0,
        user_lease_inr=15000.0,
        verify=False,
    )

    seen_sets = set()
    prev_cost = 0.0

    for alt in alternatives:
        site_tuple = tuple(sorted(alt.open_warehouses))
        assert site_tuple not in seen_sets, f"Duplicate site set found: {site_tuple}"
        seen_sets.add(site_tuple)
        assert alt.combined_total_cost >= prev_cost, "Alternative objective should be non-decreasing"
        prev_cost = alt.combined_total_cost
        assert alt.delta_vs_optimal_inr >= 0.0
        assert alt.delta_pct >= 0.0


def test_regret_non_negative_and_selected_sites(small_network):
    """Test that regret is always >= 0, and selected sites have regret == 0."""
    neighborhoods, candidates, matrix = small_network
    p = 2
    alternatives, site_scores, _ = compute_ranking(
        neighborhoods=neighborhoods,
        candidates=candidates,
        p=p,
        matrix=matrix,
        cost_per_km=35.0,
        user_lease_inr=15000.0,
        verify=False,
    )

    selected_count = 0
    for score in site_scores:
        assert score.regret_inr >= 0.0, f"Regret should be non-negative, got {score.regret_inr}"
        assert 0.0 <= score.gravity_score <= 100.0
        assert score.avg_distance_top_20pct_km >= 0.0
        if score.status == "SELECTED":
            selected_count += 1
            assert score.regret_inr == 0.0

    assert selected_count == p


def test_verification_matches_milp_optimum(small_network):
    """Test that brute force combination enumeration matches the MILP optimum when verify=True."""
    neighborhoods, candidates, matrix = small_network
    p = 2
    alternatives, site_scores, verification = compute_ranking(
        neighborhoods=neighborhoods,
        candidates=candidates,
        p=p,
        matrix=matrix,
        cost_per_km=35.0,
        user_lease_inr=15000.0,
        verify=True,
    )

    assert verification is not None
    assert verification.checked == math.comb(len(candidates), p)
    assert verification.matched is True, f"Brute force {verification.brute_force_optimum_cost} did not match MILP {verification.milp_optimum_cost}"
    assert abs(verification.brute_force_optimum_cost - verification.milp_optimum_cost) <= 1.0
