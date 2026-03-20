import asyncio
import httpx
import random
import time
from typing import List, Dict

BASE_URL = "http://localhost:8000"

async def simulate_event():
    async with httpx.AsyncClient(timeout=30) as client:
        print("🚀 Starting 100-Worker Disruption Simulation...")
        
        # 1. Generate 100 Workers
        genuine_workers = []
        for i in range(40):
            genuine_workers.append({
                "id": f"gen_{i}",
                "type": "GENUINE",
                "signals": {
                    "mock_location_detected": False,
                    "gps_accuracy_meters": random.uniform(10, 25),
                    "gps_altitude_delta_meters": random.uniform(-2, 8),
                    "accelerometer_motion_variance": random.uniform(0.4, 0.9),
                    "time_to_claim_minutes": random.uniform(15, 60),
                    "zone_cell": f"cell_gen_{i}" # Spread out
                },
                "timestamp_offset": random.randint(0, 3600) # Spread over 1 hour
            })
            
        ring_workers = []
        for ring_id in range(3):
            for i in range(20):
                ring_workers.append({
                    "id": f"ring_{ring_id}_{i}",
                    "type": f"RING_{ring_id}",
                    "signals": {
                        "mock_location_detected": False,
                        "gps_accuracy_meters": random.uniform(1, 4), # Suspiciously perfect
                        "gps_altitude_delta_meters": 5.0, # Homogeneous
                        "accelerometer_motion_variance": 0.1, # Stationary
                        "time_to_claim_minutes": 2.0, # Faster than humans
                        "zone_cell": f"cell_ring_{ring_id}", # Co-located
                        "referral_code": f"REF_RING_{ring_id}", # Shared referral
                        "ip_subnet": f"192.168.1.{ring_id}" # Shared IP range
                    },
                    "timestamp_offset": random.randint(0, 300) # Tight clustering
                })
        
        all_test_workers = genuine_workers + ring_workers
        random.shuffle(all_test_workers)
        
        results = {"GENUINE": {"approved": 0, "blocked": 0}, "RING": {"approved": 0, "blocked": 0}}
        
        print(f"📊 Processing {len(all_test_workers)} claims...")
        
        for worker in all_test_workers:
            # Timestamp calculation
            now = int(time.time())
            worker_ts = now - worker.get("timestamp_offset", 0)

            # Step A: BCS Call
            bcs_res = await client.post(f"{BASE_URL}/bcs/evaluate", json={
                "worker_id": worker["id"],
                **worker["signals"]
            })
            bcs_data = bcs_res.json()
            
            # Step B: Ring Detection Call
            ring_res = await client.post(f"{BASE_URL}/ring/detect", json={
                "worker_id": worker["id"],
                "trigger_event_id": "test_event_99",
                "claim_timestamp_unix": worker_ts,
                "zone_cell_500m": worker["signals"].get("zone_cell", "cell_gen"),
                "referral_code": worker["signals"].get("referral_code"),
                "ip_subnet": worker["signals"].get("ip_subnet")
            })
            ring_data = ring_res.json()
            
            # Final Decision Logic (simulating backend)
            is_blocked = bcs_data["track"] == "D" or ring_data["ring_detected"]
            
            w_type = "RING" if "ring" in worker["id"] else "GENUINE"
            if is_blocked:
                results[w_type]["blocked"] += 1
            else:
                results[w_type]["approved"] += 1

        print("\n✅ Simulation Complete. Results:")
        print(f"--- Genuine Workers (Total 40) ---")
        print(f"    Approved: {results['GENUINE']['approved']} (Expected ~40)")
        print(f"    Blocked:  {results['GENUINE']['blocked']} (Expected ~0)")
        
        print(f"--- Fraud Ring Workers (Total 60) ---")
        print(f"    Approved: {results['RING']['approved']} (Expected <5)")
        print(f"    Blocked:  {results['RING']['blocked']} (Expected >55)")

if __name__ == "__main__":
    asyncio.run(simulate_event())
