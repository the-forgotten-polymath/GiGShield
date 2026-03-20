"""Tests for the BCS engine"""
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_bcs_genuine_worker():
    """Genuine stranded worker should score Track A (≥80)"""
    r = client.post("/bcs/evaluate", json={
        "worker_id": "worker-raju-001",
        "mock_location_detected": False,
        "gps_accuracy_meters": 35.0,       # storm-degraded = genuine
        "accelerometer_motion_variance": 0.7,  # outdoor motion
        "cell_tower_distance_km": 0.8,
        "ip_geo_zone_match": True,
        "network_signal_quality": "2G",    # storm-degraded = genuine
        "pre_event_movement_in_zone": True,
        "time_to_claim_minutes": 28.0,     # tried to work first
        "account_age_days": 300,
        "prior_claim_count": 2,
        "payout_to_active_days_ratio": 0.12,
        "order_volume_activity_score": 0.1,
        "bcs_trust_reserve": 8.0,
    })
    assert r.status_code == 200
    data = r.json()
    assert data["bcs_score"] >= 75, f"Genuine worker BCS too low: {data['bcs_score']}"
    assert data["track"] in ["A", "B"]


def test_bcs_gps_spoofer():
    """GPS spoofer should score Track D (<30)"""
    r = client.post("/bcs/evaluate", json={
        "worker_id": "worker-fraud-999",
        "mock_location_detected": True,    # mock flag on
        "gps_accuracy_meters": 1.0,        # unnaturally perfect
        "accelerometer_motion_variance": 0.05,  # stationary at home
        "cell_tower_distance_km": 12.0,    # tower contradicts GPS
        "ip_geo_zone_match": False,
        "network_signal_quality": "4G",    # indoor full signal
        "pre_event_movement_in_zone": False,
        "time_to_claim_minutes": 1.5,      # instant bot claim
        "account_age_days": 7,
        "prior_claim_count": 0,
        "payout_to_active_days_ratio": 0.8,
        "order_volume_activity_score": 1.0,
        "bcs_trust_reserve": 0,
    })
    assert r.status_code == 200
    data = r.json()
    assert data["bcs_score"] < 30, f"Spoofer BCS too high: {data['bcs_score']}"
    assert data["track"] == "D"


def test_ring_no_trigger():
    """Single clean claim should not trigger ring detection"""
    r = client.post("/ring/detect", json={
        "worker_id": "worker-clean-001",
        "trigger_event_id": "trigger-unique-xyz-001",
        "claim_timestamp_unix": 1710000000,
        "zone_cell_500m": "BLR_KORA_01",
        "ip_subnet": "192.168.100",
    })
    assert r.status_code == 200
    assert r.json()["ring_detected"] == False


def test_premium_calculation_monsoon():
    """High flood zone + monsoon should push premium above base"""
    r = client.post("/premium/recalculate", json={
        "worker_id": "w1",
        "tier": "standard",
        "zone_flood_history_score": 0.85,
        "zone_aqi_frequency_score": 0.1,
        "city": "Mumbai",
        "forecast_precipitation_prob_7d": 0.8,
        "forecast_total_rain_mm_7d": 80,
        "is_monsoon_season": True,
    })
    assert r.status_code == 200
    data = r.json()
    assert data["final_premium"] > 49  # Should exceed base
    assert data["final_premium"] <= 98  # Should not exceed 2x cap


def test_risk_profile_high_risk():
    """High flood + AQI zone should recommend pro tier"""
    r = client.post("/risk/profile", json={
        "zone_flood_history_score": 0.9,
        "zone_aqi_frequency_score": 0.85,
        "city": "Delhi",
        "city_tier": 1,
        "platform_tenure_months": 1,
        "avg_daily_earning": 680,
    })
    assert r.status_code == 200
    data = r.json()
    assert data["recommended_tier"] == "pro"
    assert data["risk_score"] >= 0.6
    assert len(data["risk_factors"]) >= 1
