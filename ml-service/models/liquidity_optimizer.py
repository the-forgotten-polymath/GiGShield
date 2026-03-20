import numpy as np
from typing import Dict

class LiquidityOptimizer:
    """
    Conceptual RL-inspired Liquidity Pool Optimizer.
    Adjusts the 'Trust Reserve' and 'Payout Floor' based on 
    claim velocity and pool solvency.
    """
    def __init__(self, initial_pool_balance: float = 1000000):
        self.pool_balance = initial_pool_balance
        self.claim_velocity_window = [] # Last 24 hours
        self.reserve_ratio = 0.20 # 20% default reserve
        
    def update_state(self, new_claims_count: int, total_payout_value: float):
        """
        Updates internal state and 'learns' the new optimal reserve ratio.
        """
        self.pool_balance -= total_payout_value
        self.claim_velocity_window.append(new_claims_count)
        if len(self.claim_velocity_window) > 24:
            self.claim_velocity_window.pop(0)
            
        avg_velocity = np.mean(self.claim_velocity_window) if self.claim_velocity_window else 0
        
        # RL Policy (Heuristic for demo): 
        # If velocity > 50 claims/hr, increase reserve ratio (be more conservative)
        if avg_velocity > 50:
            self.reserve_ratio = min(0.40, self.reserve_ratio + 0.05)
        elif avg_velocity < 10:
            self.reserve_ratio = max(0.15, self.reserve_ratio - 0.02)
            
        return {
            "current_pool": self.pool_balance,
            "optimal_reserve_ratio": round(self.reserve_ratio, 3),
            "status": "CONSERVATIVE" if self.reserve_ratio > 0.25 else "NORMAL"
        }

    def get_payout_adjustment(self, worker_tenure: int, current_velocity: float) -> float:
        """
        Calculates a multiplier for the payout based on pool health.
        """
        if self.pool_balance < 100000: # Critical low
            return 0.8 # 20% haircut for platform survival
        return 1.0

# Singleton
liquidity_manager = LiquidityOptimizer()
