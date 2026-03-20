"""
Onboarding Risk Profiler
XGBoost-based tier recommendation for new workers at onboarding.
Returns risk_score + recommended tier + 3 plain-language risk factors.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class RiskProfileRequest(BaseModel):
    zone_flood_history_score: float = 0.5
    zone_aqi_frequency_score: float = 0.3
    city: str = "Bangalore"
    city_tier: int = 1  # 1=metro, 2=tier-2, 3=tier-3
    platform_tenure_months: int = 0
    avg_daily_earning: float = 720.0
    platform: str = "swiggy"


class RiskProfileResponse(BaseModel):
    risk_score: float  # 0–1
    recommended_tier: str
    risk_factors: list[str]
    tier_justification: str


@router.post("/profile", response_model=RiskProfileResponse)
async def profile_risk(req: RiskProfileRequest) -> RiskProfileResponse:
    """
    Simple rule-based risk profiling for Phase 1.
    Phase 2 replaces with a trained XGBoost classifier on live data.
    """
    risk_score = 0.0
    risk_factors: list[str] = []

    # Flood zone weight
    if req.zone_flood_history_score > 0.6:
        risk_score += 0.35
        risk_factors.append(f"Aapke zone mein baarish ka history zyada hai ({_pct(req.zone_flood_history_score)} risk)")
    elif req.zone_flood_history_score > 0.3:
        risk_score += 0.15

    # AQI weight (Delhi-type cities)
    if req.zone_aqi_frequency_score > 0.6:
        risk_score += 0.25
        risk_factors.append(f"Yeh zone air quality alerts ke liye high risk hai ({_pct(req.zone_aqi_frequency_score)} frequency)")

    # Metro city = more disruption events
    if req.city_tier == 1:
        risk_score += 0.10

    # New worker = lower data, slight risk premium
    if req.platform_tenure_months < 3:
        risk_score += 0.10
        risk_factors.append("Aap abhi nayi delivery shuru kar rahe hain — pehle hafte mein coverage zaroori hai")

    # Low earning = higher relative impact
    if req.avg_daily_earning < 600:
        risk_score += 0.05
        risk_factors.append("Aapki daily earning pe weather ka impact zyada hai")

    risk_score = min(1.0, round(risk_score, 3))

    # Tier recommendation
    if risk_score >= 0.6:
        tier = "pro"
        justification = "Kavach Pro recommended — aapka zone high risk hai, zyada protection important hai."
    elif risk_score >= 0.3:
        tier = "standard"
        justification = "Kavach Standard recommended — balanced coverage for your zone and earning level."
    else:
        tier = "lite"
        justification = "Kavach Lite is a great start — your zone is relatively low risk."

    # Ensure at least 1 risk factor
    if not risk_factors:
        risk_factors.append("Coverage har gig worker ke liye valuable hai — weather kabhi bhi badal sakta hai")

    return RiskProfileResponse(
        risk_score=risk_score,
        recommended_tier=tier,
        risk_factors=risk_factors[:3],
        tier_justification=justification,
    )


def _pct(score: float) -> str:
    return f"{int(score * 100)}%"
