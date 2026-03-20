# GigShield API Specification 📝

This document covers the core endpoints for the GigShield Backend (Port 3001) and ML Service (Port 8000).

## 🏢 Backend Service (Node.js/Express)

### 🔐 Authentication
`POST /auth/otp-verify`
- **Body**: `{ "firebase_token": "token_str" }`
- **Output**: `{ "token": "jwt_str", "worker_id": "uuid" }`
- **Description**: Verifies the Firebase token and issues a session JWT. Upserts the worker record.

### 🚲 Worker Operations
`GET /workers/:id/coverage`
- **Output**: `{ "active": bool, "tier": "A/B/C", "zone": "Zone Name" }`
- **Description**: Returns the active policy and coverage status.

`GET /workers/:id/payouts`
- **Output**: `[{ "id": "uuid", "amount": 250, "status": "processed", "trigger": "Heavy Rain" }]`
- **Description**: Historical payout list with UTR codes.

`GET /workers/:id/premium`
- **Output**: `{ "base": 50, "final": 65, "factors": { "high_risk_zone": 10, "forecast_adjustment": 5 } }`
- **Description**: Breakdown of current week's premium.

### 🛡️ Admin & Webhooks
`GET /admin/dashboard`
- **Output**: `{ "loss_ratio": 0.42, "active_rings": 3, "liquidity_pool": 950000 }`
- **Description**: Management analytics for platform solvency.

`POST /whatsapp/webhook`
- **Body**: Twilio-standard WhatsApp payload
- **Description**: Processes STATUS, HELP, PAYOUT commands.


## 🤖 ML Service (Python FastAPI)

### 📊 BCS Engine
`POST /bcs/evaluate`
- **Body**: 12 signal device/network payload (GPS, altitude, motion, etc.)
- **Output**: `{ "bcs_score": 85.0, "track": "A", "anomaly_score": 0.08 }`
- **Description**: Computes the behavioral credibility score and assigns a claim track.

### 🕸️ Ring Detector
`POST /ring/detect`
- **Body**: `{ "worker_id": "...", "trigger_event_id": "...", "zone_cell_500m": "..." }`
- **Output**: `{ "ring_detected": bool, "confidence": 0.95, "gnn_ring_prob": 0.92 }`
- **Description**: Runs 5-signal rules + GNN check for coordinated clusters.

### 💰 Dynamic Pricing
`POST /premium/recalculate`
- **Body**: `{ "zone_id": "...", "forecast": "RAINY" }`
- **Description**: Adjusts pricing for upcoming week risk.

### 🏦 Liquidity AI
`GET /liquidity/optimize`
- **Params**: `claims_count`, `payout_value`
- **Output**: `{ "optimal_reserve_ratio": 0.25, "status": "CONSERVATIVE" }`
- **Description**: Active RL optimizer for risk management.
