"""
Behavioral Credibility Score (BCS) Engine
12-signal rule-weighted system for Phase 1.
No platform API dependency — all signals computable from device + network + account data.
"""
from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Optional
import math
from models.anomaly_detector import detector

router = APIRouter()


class BCSRequest(BaseModel):
    worker_id: str
    zone_lat: Optional[float] = None
    zone_lng: Optional[float] = None
    avg_daily_earning: Optional[float] = 720
    platform_tenure_months: Optional[int] = 0
    bcs_trust_reserve: Optional[float] = 0

    # Device signals (sent from PWA)
    mock_location_detected: Optional[bool] = False
    gps_accuracy_meters: Optional[float] = 20.0
    gps_altitude_delta_meters: Optional[float] = 5.0  # vs SRTM terrain
    accelerometer_motion_variance: Optional[float] = 0.5  # 0=stationary, 1=active motion
    barometric_pressure_hpa: Optional[float] = 1013.0

    # Network signals
    cell_tower_distance_km: Optional[float] = 1.0  # tower vs GPS claim distance
    network_signal_quality: Optional[str] = "4G"  # "2G", "3G", "4G"
    ip_geo_zone_match: Optional[bool] = True

    # Behavioral signals
    pre_event_movement_in_zone: Optional[bool] = True
    time_to_claim_minutes: Optional[float] = 25.0
    account_age_days: Optional[int] = 90
    prior_claim_count: Optional[int] = 0
    payout_to_active_days_ratio: Optional[float] = 0.1

    # Platform proxy signal
    order_volume_activity_score: Optional[float] = 0.0  # 0=active in zone, 1=inactive


class BCSResponse(BaseModel):
    bcs_score: float
    track: str
    signals: dict
    anomaly_score: float
    storm_exception_applicable: bool = False


SIGNAL_WEIGHTS = {
    "mock_location": 25,
    "gps_accuracy": 10,
    "gps_altitude": 8,
    "accelerometer": 7,
    "cell_tower": 15,
    "ip_geo": 8,
    "network_quality": 5,
    "pre_event_movement": 10,
    "time_to_claim": 10,
    "account_maturity": 8,
    "payout_ratio": 8,
    "order_volume": 12,
}

TOTAL_WEIGHT = sum(SIGNAL_WEIGHTS.values())


def score_signal(name: str, req: BCSRequest) -> tuple[float, float]:
    """Returns (raw_score 0–1, weight) for each signal. 1 = genuine worker."""
    if name == "mock_location":
        return (0.0 if req.mock_location_detected else 1.0, SIGNAL_WEIGHTS[name])

    if name == "gps_accuracy":
        # Perfect GPS in a storm is suspicious
        acc = req.gps_accuracy_meters or 20
        if acc < 3:
            return (0.1, SIGNAL_WEIGHTS[name])  # Unnaturally perfect
        elif acc < 15:
            return (0.5, SIGNAL_WEIGHTS[name])
        else:
            return (1.0, SIGNAL_WEIGHTS[name])  # Storm-degraded = genuine

    if name == "gps_altitude":
        delta = abs(req.gps_altitude_delta_meters or 5)
        return (min(1.0, max(0.0, 1 - (delta - 15) / 85)), SIGNAL_WEIGHTS[name])

    if name == "accelerometer":
        # High variance = outdoor motion = genuine
        v = req.accelerometer_motion_variance or 0.5
        return (min(1.0, v * 2), SIGNAL_WEIGHTS[name])

    if name == "cell_tower":
        dist = req.cell_tower_distance_km or 1.0
        if dist > 10:
            return (0.0, SIGNAL_WEIGHTS[name])  # Tower contradicts GPS
        elif dist > 3:
            return (0.4, SIGNAL_WEIGHTS[name])
        else:
            return (1.0, SIGNAL_WEIGHTS[name])

    if name == "ip_geo":
        return (1.0 if req.ip_geo_zone_match else 0.0, SIGNAL_WEIGHTS[name])

    if name == "network_quality":
        # 2G/Edge during storm is expected for genuine worker
        quality_map = {"2G": 1.0, "3G": 0.8, "4G": 0.5, "5G": 0.3}
        return (quality_map.get(req.network_signal_quality or "4G", 0.5), SIGNAL_WEIGHTS[name])

    if name == "pre_event_movement":
        return (1.0 if req.pre_event_movement_in_zone else 0.2, SIGNAL_WEIGHTS[name])

    if name == "time_to_claim":
        minutes = req.time_to_claim_minutes or 25
        if minutes < 5:
            return (0.0, SIGNAL_WEIGHTS[name])  # Instant = fraud bot
        elif minutes < 15:
            return (0.4, SIGNAL_WEIGHTS[name])
        elif minutes <= 60:
            return (1.0, SIGNAL_WEIGHTS[name])  # Normal range
        else:
            return (0.7, SIGNAL_WEIGHTS[name])

    if name == "account_maturity":
        days = req.account_age_days or 0
        prior = req.prior_claim_count or 0
        maturity = min(1.0, days / 90) * 0.5 + min(1.0, prior / 3) * 0.5
        return (maturity, SIGNAL_WEIGHTS[name])

    if name == "payout_ratio":
        ratio = req.payout_to_active_days_ratio or 0
        if ratio > 0.5:
            return (0.0, SIGNAL_WEIGHTS[name])
        elif ratio > 0.25:
            return (0.4, SIGNAL_WEIGHTS[name])
        else:
            return (1.0, SIGNAL_WEIGHTS[name])

    if name == "order_volume":
        # Low activity in zone = consistent with disruption
        activity = req.order_volume_activity_score or 0
        # If zone-wide activity is high, claiming disruption is contradictory
        return (1.0 - activity, SIGNAL_WEIGHTS[name])

    return (0.5, 1.0)


@router.post("/evaluate", response_model=BCSResponse)
async def evaluate_bcs(req: BCSRequest) -> BCSResponse:
    signal_scores: dict[str, float] = {}
    weighted_sum = 0.0
    total_weight = 0.0

    for signal_name in SIGNAL_WEIGHTS:
        raw_score, weight = score_signal(signal_name, req)
        signal_scores[signal_name] = round(raw_score, 3)
        weighted_sum += raw_score * weight
        total_weight += weight

    base_bcs = (weighted_sum / total_weight) * 100

    # Phase 3: Isolation Forest Anomaly Detection
    # 0=False, acc, alt, mot, baro, cell, net(4G=1/2G=0), ip, pre, claim_min, age, ratio
    signals_list = [
        1.0 if req.mock_location_detected else 0.0,
        req.gps_accuracy_meters or 20.0,
        req.gps_altitude_delta_meters or 5.0,
        req.accelerometer_motion_variance or 0.5,
        req.barometric_pressure_hpa or 1013.0,
        req.cell_tower_distance_km or 1.0,
        1.0 if req.network_signal_quality == "4G" else 0.0,
        1.0 if req.ip_geo_zone_match else 0.0,
        1.0 if req.pre_event_movement_in_zone else 0.0,
        req.time_to_claim_minutes or 25.0,
        req.account_age_days or 90.0,
        req.payout_to_active_days_ratio or 0.1
    ]
    anomaly_score = detector.get_score(signals_list)
    
    # If anomaly_score is very negative, penalize the BCS score
    anomaly_penalty = 0
    if anomaly_score < -0.05:
        anomaly_penalty = 20  # Significant signal outlier
    elif anomaly_score < 0:
        anomaly_penalty = 10  # Mild outlier

    # Trust reserve bonus (long-tenure clean history)
    trust_bonus = min(req.bcs_trust_reserve or 0, 10)
    
    bcs_score = max(0.0, min(100.0, round(base_bcs + trust_bonus - anomaly_penalty, 1)))

    # Determine track
    if bcs_score >= 80:
        track = "A"
    elif bcs_score >= 50:
        track = "B"
    elif bcs_score >= 30:
        track = "C"
    else:
        track = "D"

    return BCSResponse(
        bcs_score=bcs_score, 
        track=track, 
        signals=signal_scores, 
        anomaly_score=round(float(anomaly_score), 4)
    )
