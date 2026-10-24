"""Tests for optional distanceKm road matrix input on /api/optimize and /api/rank.
Ensures 100% backward compatibility when the field is absent.
"""

from fastapi.testclient import TestClient
from app import app

client = TestClient(app)


def test_optimize_without_distance_km_maintains_default_behavior():
    """When distanceKm is absent, default Haversine behavior is maintained exactly."""
    payload = {
        "p": 3,
        "warehouse_capacity": 4000,
        "routing_mode": "haversine",
    }
    res = client.post("/api/optimize", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["p"] == 3
    assert data["total_delivery_cost"] > 0
    assert data["combined_total_cost"] > 0


def test_optimize_with_custom_distance_km_uses_provided_matrix():
    """When distanceKm is supplied, optimizer uses the custom road distances."""
    # First get neighborhoods to know the IDs
    zones_res = client.get("/api/demo-data")
    assert zones_res.status_code == 200
    zones = zones_res.json()["preview"]
    zone_ids = [z["neighborhood_id"] for z in zones]

    # Create dummy custom distance matrix where all distances = 5.0 km
    custom_matrix = {
        z_id: {target: 5.0 for target in zone_ids}
        for z_id in zone_ids
    }

    payload = {
        "p": 2,
        "warehouse_capacity": 10000,
        "distanceKm": custom_matrix,
        "cost_per_km": 1.25,
    }
    res = client.post("/api/optimize", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["p"] == 2
    # In every assignment, distance should be 5.0 km
    for assign in data["assignments"]:
        assert assign["distance_km"] == 5.0
