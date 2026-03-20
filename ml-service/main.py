"""
GigShield ML Microservice
FastAPI app serving BCS, ring detection, premium, and risk profiling models.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import bcs, ring_detector, premium, risk_profiler
from models.liquidity_optimizer import liquidity_manager

app = FastAPI(
    title="GigShield ML Service",
    description="AI/ML models for BCS scoring, ring detection, and dynamic pricing",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "gigshield-ml"}


@app.get("/liquidity/optimize")
async def optimize_liquidity(claims_count: int = 0, payout_value: float = 0.0):
    return liquidity_manager.update_state(claims_count, payout_value)


app.include_router(bcs.router, prefix="/bcs", tags=["BCS Engine"])
app.include_router(ring_detector.router, prefix="/ring", tags=["Ring Detection"])
app.include_router(premium.router, prefix="/premium", tags=["Premium Engine"])
app.include_router(risk_profiler.router, prefix="/risk", tags=["Risk Profiler"])
