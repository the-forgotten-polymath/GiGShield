# 🛡️ GigShield: AI-Powered Parametric Income Insurance 🚀
**Protecting India’s Gig Economy Workers from Hyperlocal Disruptions.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React PWA](https://img.shields.io/badge/React_PWA-20232A?style=flat&logo=react)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white)](https://nodejs.org/)

GigShield is a 100% automated, AI-driven parametric insurance platform specifically designed for India's 15M+ gig workers. Using hyperlocal weather (OpenWeatherMap) and air quality (AQI) data, GigShield provides instant payouts during extreme disruptions without any paperwork or manual claims.

---

## 🌩️ The Problem
Gig workers lose ~15-20% of their annual income due to disruptions they cannot control:
- **Monsoon Rain**: Delivery and ride-hailing become impossible/unsafe.
- **Extreme Heat**: Severe health risks during peak afternoon hours.
- **Hazardous AQI**: GRAP Stage 4 restrictions in cities like Delhi.

Traditional insurance is too slow, too rigid, and lacks the behavioral verification required for industrial-scale parametric payouts.

## 🛡️ The GigShield Solution

### 1. ⚡ Parametric "Invisible" Claims
No claims to file. Once a disruption threshold is crossed in a worker's zone, payouts (via Track A/B/C/D) are triggered automatically to their registered UPI ID.

### 2. 📱 Hindi-First Offline PWA
A lightweight React PWA designed for the "Raju" persona—simple, mobile-optimized, and available in Hindi/English with full offline support.

### 3. 🛡️ AI Fraud Shield (State-of-the-Art)
- **BCS SCORE**: 12-signal credibility engine (GPS drift, Altitude, IP-Geo) to prove "out-in-storm" status.
- **ISOLATION FOREST**: Unsupervised anomaly detection to block signal spoofing.
- **GRAPHSAGE GNN**: Graph Neural Network analysis to identify coordinated fraud rings.

---

## 🏗️ Technical Architecture

- **Frontend**: React + Vite + Tailwind + Zustand (PWA)
- **Backend API**: Node.js + Express + PostgreSQL + Redis + BullMQ
- **AI Microservice**: Python + FastAPI + Scikit-learn + NetworkX
- **Integrations**: Razorpay (UPI), Twilio (Webhooks), FCM (Push)

For a deep dive into the system design, see [SYSTEM_ARCHITECTURE.md](./docs/SYSTEM_ARCHITECTURE.md).

---

## 📂 Repository Structure

```
/frontend    - Mobile React PWA
/backend     - Node.js API & Event Aggregator
/ml-service  - Python AI Inference Engine
/infra       - Docker & Env configurations
/docs        - In-depth Technical Specs & Whitepapers
```

---

## 🛠️ Getting Started

### Prerequisites
- Docker & Docker Compose
- Node.js 18+
- Python 3.9+

### Quick Start (Docker)
1. Clone the repository and navigate to the project root.
2. Copy the environment template:
   ```bash
   cp infra/.env.example infra/.env
   ```
3. Boot the entire stack:
   ```bash
   docker-compose -f infra/docker-compose.yml up --build
   ```
4. Access the platforms:
   - **Frontend**: `http://localhost:5173`
   - **Backend API**: `http://localhost:3001`
   - **ML Docs**: `http://localhost:8000/docs`

---

## 📜 Documentation Suite
Explore our detailed documentation for more context:
- 🗺️ **[System Architecture](./docs/SYSTEM_ARCHITECTURE.md)**
- 📝 **[API Specification](./docs/API_SPECIFICATION.md)**
- 🛡️ **[Fraud Defense Whitepaper](./docs/FRAUD_DEFENSE_WHITEPAPER.md)**
- 📖 **[User & Admin Guide](./docs/USER_GUIDE.md)**
- 🏆 **[MVP Master Specification](./docs/GIGSHIELD_MVP_SPEC.md)**

---

## ⚖️ License
Distributed under the MIT License. See `LICENSE` for more information.

*Built for the GuideWire Advanced Agentic Coding Challenge.* 🛡️🚀
