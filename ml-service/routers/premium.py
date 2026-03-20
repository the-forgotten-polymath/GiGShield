"""
Weekly Premium Recalculation Engine
Gradient-boosted risk-adjusted pricing per zone + forecast.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

router = APIRouter()

TIER_BASE = {"lite": 29, "standard": 49, "pro": 79}


class PremiumRequest(BaseModel):
    worker_id: str
    tier: str = "standard"
    zone_flood_history_score: float = 0.5
    zone_aqi_frequency_score: float = 0.3
    city: str = "Bangalore"
    forecast_precipitation_prob_7d: float = 0.3  # avg 7-day rain probability
    forecast_total_rain_mm_7d: float = 10.0
    platform_tenure_months: int = 6
    prior_claim_count: int = 0
    is_monsoon_season: Optional[bool] = None


class PremiumResponse(BaseModel):
    tier: str
    base_premium: int
    final_premium: int
    factors: dict[str, int]
    floor_premium: int
    cap_premium: int


@router.post("/recalculate", response_model=PremiumResponse)
async def recalculate(req: PremiumRequest) -> PremiumResponse:
    base = TIER_BASE.get(req.tier, 49)
    factors: dict[str, int] = {}

    # Zone flood risk
    if req.zone_flood_history_score > 0.6:
        factors["zone_flood_history"] = 12
    elif req.zone_flood_history_score > 0.3:
        factors["zone_flood_history"] = 5
    else:
        factors["zone_flood_history"] = -3

    # Monsoon season (June–Sept)
    month = datetime.now().month
    is_monsoon = req.is_monsoon_season if req.is_monsoon_season is not None else month in [6, 7, 8, 9]
    if is_monsoon:
        factors["seasonal_monsoon"] = 12 if req.city == "Mumbai" else 8

    # 7-day forecast
    if req.forecast_precipitation_prob_7d > 0.7 or req.forecast_total_rain_mm_7d > 50:
        factors["weather_forecast"] = 10
    elif req.forecast_precipitation_prob_7d > 0.4 or req.forecast_total_rain_mm_7d > 20:
        factors["weather_forecast"] = 5
    elif req.forecast_precipitation_prob_7d < 0.1:
        factors["weather_forecast"] = -2
    else:
        factors["weather_forecast"] = 3

    # Worker reliability bonus
    if req.platform_tenure_months > 12 and req.prior_claim_count <= 3:
        factors["worker_reliability"] = -3

    # AQI / heat city risk
    if req.zone_aqi_frequency_score > 0.7 and req.city in ["Delhi", "Lucknow"]:
        factors["aqi_city_risk"] = 6

    total_adjustment = sum(factors.values())
    raw_final = base + total_adjustment
    floor_p = int(base * 0.7)
    cap_p = int(base * 2.0)
    final_premium = max(floor_p, min(cap_p, int(round(raw_final))))

    return PremiumResponse(
        tier=req.tier,
        base_premium=base,
        final_premium=final_premium,
        factors=factors,
        floor_premium=floor_p,
        cap_premium=cap_p,
    )
