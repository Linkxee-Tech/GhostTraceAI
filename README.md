# GhostTrace AI 🔍

**Autonomous real-time fraud detection and response agent**
Built for the Google Cloud Rapid Agent 2026
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20+-brightgreen)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org)


## What is GhostTrace AI?

GhostTrace AI is a true autonomous AI agent that:

1. **Monitors** live financial transactions via MongoDB Change Streams
2. **Reasons** about fraud risk using Gemini 3 with a structured prompt
3. **Scores** each transaction using velocity, geo-anomaly, device trust, and behavioral drift signals
4. **Acts** autonomously in the app data model — blocking, flagging, freezing, or escalating are recorded and surfaced in the dashboard, with optional external enforcement integration
5. **Explains** every decision in plain English for analyst review
6. **Notifies** admins via Slack and email for critical threats

---

## MongoDB Partner Track

GhostTrace AI is built specifically for the MongoDB partner track, with deep Atlas integration across the entire fraud lifecycle:

- Real-time ingestion through **MongoDB Atlas Change Streams**
- Transaction and alert storage in **Atlas clusters**
- Fraud context enrichment using **Atlas Vector Search**
- Auditability with immutable **audit_logs** stored in MongoDB
- Secure production-ready pattern for **Atlas + AI** in a cloud-native agent

This project showcases how MongoDB Atlas can power an autonomous fraud agent while delivering the event-driven, highly available data foundation expected by the partner track.

---

## Tech Stack

| Layer          | Technology                                           |
|----------------|------------------------------------------------------|
| AI Engine      | Gemini 3 via Google AI Studio API                    |
| Agent Protocol | Google Cloud Agent Builder + MCP                     |
| Database       | MongoDB Atlas (Change Streams + Atlas Vector Search) |
| Backend        | Node.js 20 + Express 4 + Socket.io                   |
| Frontend       | Next.js 14 + Tailwind CSS + Recharts                 |
| Infrastructure | Google Cloud Run + GCR                               |
| CI/CD          | GitHub Actions                                       |

---

## Google Cloud Agent Builder

GhostTrace AI includes an explicit Agent Builder manifest at `infra/agent-builder.yaml`.
This sample GCAB configuration is tuned for the hackathon and demonstrates how to wire:

- `GOOGLE_CLOUD_PROJECT`
- `GOOGLE_CLOUD_REGION`
- `AGENT_BUILDER_AGENT_ID`
- `GEMINI_MODEL=gemini-3.0-pro`
- MongoDB Atlas connection metadata
- MCP tool auth for integrated fraud tooling

Update `infra/agent-builder.yaml` with your project values and deploy through Google Cloud Agent Builder to connect the GhostTrace backend runtime with the agent orchestration layer.

### Deploy with Agent Builder

```bash
gcloud alpha agentbuilder deploy --config=infra/agent-builder.yaml --project=your-gcp-project-id --region=us-central1 --quiet
```

If your manifest contains placeholder variables, replace them before deployment or use environment substitution.

Example secrets setup for GCAB deployment:

```bash
echo -n "your-google-api-key" | gcloud secrets create google-api-key --data-file=-
echo -n "your-mongodb-uri" | gcloud secrets create mongodb-uri --data-file=-
echo -n "your-jwt-secret" | gcloud secrets create jwt-secret --data-file=-
echo -n "your-mcp-secret" | gcloud secrets create mcp-auth-secret --data-file=-
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    GHOSTTRACE AI                        │
│                                                         │
│  MongoDB Atlas                                          │
│  ┌──────────────┐    Atlas Change Stream                │
│  │ transactions │ ──────────────────► Fraud Agent       │
│  │ fraud_alerts │                     │                 │
│  │ audit_logs   │◄────────────────────┤                 │
│  └──────────────┘    Write results    │                 │
│                                       ▼                 │
│                              ┌──────────────────┐       │
│                              │  Risk Scorer     │       │
│                              │  (velocity, geo, │       │
│                              │   device, drift) │       │
│                              └────────┬─────────┘       │
│                                       │                 │
│                                       ▼                 │
│                              ┌──────────────────┐       │
│                              │  Gemini 3         │      │
│                              │  (via MCP tools + Atlas data) │
│                              └────────┬─────────┘       │
│                                       │                 │
│                              ┌────────▼─────────┐       │
│                              │ Action Executor  │       │
│                              │ block/flag/clear │       │
│                              └────────┬─────────┘       │
│                                       │                 │
│                              WebSocket│Broadcast        │
│                                       ▼                 │
│                           ┌───────────────────────┐     │
│                           │   Next.js Dashboard   │     │
│                           │   Real-time updates   │     │
│                           └───────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites
- Node.js 20+
- MongoDB Atlas cluster (free tier works)
- Google AI Studio API key (for Gemini)

### 1. Clone and install

```bash
git clone https://github.com/Linkxee-Tech/ghosttrace-ai.git
cd ghosttrace-ai
npm install
```

### 2. Configure environment

```bash
# Backend
cp backend/.env.example backend/.env
# Fill in: MONGODB_URI, GOOGLE_API_KEY, JWT_SECRET, MCP_AUTH_SECRET

# Frontend
cp frontend/.env.local.example frontend/.env.local
# NEXT_PUBLIC_API_URL=http://localhost:3001
# NEXT_PUBLIC_WS_URL=http://localhost:3001
# Optional: set EXTERNAL_ENFORCEMENT_URL and EXTERNAL_ENFORCEMENT_SECRET if you want live action enforcement via webhook
```

### Environment Parity (Local vs Production)

To avoid "works on Vercel but fails locally" auth issues, keep these aligned:

- Frontend local: `NEXT_PUBLIC_API_URL=http://localhost:3001`
- Frontend Vercel: `NEXT_PUBLIC_API_URL=https://<your-backend-domain>`
- Backend local: `CORS_ORIGINS=http://localhost:3000`
- Backend production: `CORS_ORIGINS=https://ghosttraceai.vercel.app`
- Optional preview domains: `ALLOW_VERCEL_PREVIEW_ORIGINS=true`
- Keep `BYPASS_AUTH=false` outside local-only debugging.

### 3. Start both services

```bash
# Both in one command
npm run dev

# Or separately:
npm run dev:backend   # http://localhost:3001
npm run dev:frontend  # http://localhost:3000
```

### 4. Seed demo data (optional)

```bash
npm run seed
```

### 4.a Run the Transaction Generator (simulated traffic)

This script inserts synthetic transactions into the `transactions` collection to drive the GhostTrace pipeline.

```bash
# From repository root
npm run txgen

# Optional args:
# --rate=1500       # average ms between transactions (default 2000)
# --fraudRate=0.12  # fraction of generated txns that include a fraud pattern
```

### 5. Run the fraud simulator

```bash
npm run simulate
# Streams 1 tx/sec with 15% fraud rate to the backend
# Options: --rate=2 --fraud-rate=0.3 --url=http://localhost:3001
```

---

## API Reference

All endpoints require `Authorization: Bearer <token>` or `X-API-Key: <key>`.

Get a token:
```bash
curl -X POST http://localhost:3001/api/v1/auth/token \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "your-api-key"}'
```

### Transactions

| Method | Endpoint                        | Description                        |
|--------|---------------------------------|------------------------------------|
| GET    | `/api/v1/transactions`          | List with pagination + filters     |
| GET    | `/api/v1/transactions/:txnId`   | Get single transaction             |
| POST   | `/api/v1/transactions`          | Submit a new transaction           |

### Alerts

| Method | Endpoint                              | Description              |
|--------|---------------------------------------|--------------------------|
| GET    | `/api/v1/alerts`                      | List fraud alerts        |
| GET    | `/api/v1/alerts/:alertId`             | Get single alert         |
| PATCH  | `/api/v1/alerts/:alertId/acknowledge` | Acknowledge an alert     |
| PATCH  | `/api/v1/alerts/:alertId/resolve`     | Resolve (confirm/FP)     |

### Agent

| Method | Endpoint                            | Description                  |
|--------|-------------------------------------|------------------------------|
| GET    | `/api/v1/agent/actions`             | List agent actions           |
| GET    | `/api/v1/agent/explanations/:txnId` | Get Gemini explanation       |
| POST   | `/api/v1/agent/reprocess/:txnId`    | Manually reprocess a txn     |
| GET    | `/api/v1/agent/reviews`             | List analyst reviews         |
| PATCH  | `/api/v1/agent/reviews/:reviewId`   | Submit analyst decision      |

### System

| Method | Endpoint           | Description                    |
|--------|--------------------|--------------------------------|
| GET    | `/api/v1/health`   | Health check (public)          |
| GET    | `/api/v1/stats`    | Dashboard statistics           |
| GET    | `/api/v1/audit`    | Audit log (immutable trail)    |

### WebSocket Events

Connect to `ws://localhost:3001` with Socket.io.

| Event                | Direction       | Payload                                      |
|----------------------|-----------------|----------------------------------------------|
| `transaction:update` | Server → Client | `{ txnId, status, fraudScore, action, ... }` |
| `agent:reasoning`    | Server → Client | `{ txnId, stage, message, fraudScore }`      |
| `agent:error`        | Server → Client | `{ txnId, error }`                           |
| `subscribe:account`  | Client → Server | `accountId` string                           |

---

## Running Tests

```bash
# All tests
npm run test --workspace=backend

# Unit tests only
npm run test:unit --workspace=backend

# Simulation (fraud scenarios)
npm run test:simulation --workspace=backend

# Integration (API routes)
npm run test:integration --workspace=backend
```

---

## Deployment

### Docker Compose (local)

```bash
cp .env.example .env  # Fill in secrets
docker-compose up --build
```

### Google Cloud Run

1. Set up GCP project and enable APIs:
```bash
gcloud services enable run.googleapis.com containerregistry.googleapis.com secretmanager.googleapis.com
```

2. Create secrets:
```bash
echo -n "mongodb+srv://..." | gcloud secrets create mongodb-uri --data-file=-
echo -n "AIza..."           | gcloud secrets create google-api-key --data-file=-
echo -n "your-jwt-secret"   | gcloud secrets create jwt-secret --data-file=-
echo -n "your-mcp-secret"   | gcloud secrets create mcp-auth-secret --data-file=-
```

3. Push to GitHub → CI/CD deploys automatically on merge to `main`

---

## MCP Integration

GhostTrace uses the Model Context Protocol to give the Gemini agent direct access to MongoDB, including embedding-driven similarity search for transaction history:

```
Gemini Agent
    │
    ├── get_transaction(txnId)           → Fetch full transaction doc
    ├── get_account_history(accountId)   → 30-day behavioral baseline
    ├── get_velocity_data(accountId)     → Real-time velocity counts
    ├── get_fraud_alerts(accountId)      → Open alerts for context
    ├── get_audit_trail(txnId)           → Full decision history
    ├── get_similar_fraud_patterns(...)  → Historical fraud matches via transaction embeddings / Atlas vector search
    └── write_agent_finding(txnId, ...)  → Record reasoning step
```

---

## Project Structure

```
ghosttrace-ai/
├── backend/
│   ├── src/
│   │   ├── agent/          # Plan → Reason → Act loop
│   │   ├── api/            # Express routes + middleware
│   │   ├── db/             # MongoDB schemas + change streams
│   │   ├── mcp/            # MCP server + tool definitions
│   │   ├── services/       # Gemini, notifications, WebSocket, stats
│   │   ├── utils/          # Logger
│   │   ├── app.js          # Express factory
│   │   └── index.js        # Entry point + graceful shutdown
│   └── tests/
│       ├── unit/           # Risk scorer, auth, config
│       ├── integration/    # API route tests (supertest)
│       └── simulation/     # Fraud scenario tests
├── frontend/
│   └── src/
│       ├── components/     # Dashboard, Charts, Alerts, Agent
│       ├── hooks/          # useWebSocket, useDemoData
│       ├── lib/            # API client, Zustand store, types
│       └── pages/          # Overview, Transactions, Alerts, Agent, Analytics
├── scripts/
│   ├── seed-transactions.js
│   └── fraud-simulator.js
├── infra/
│   ├── docker/
│   └── cloudrun-service.yaml
└── .github/workflows/deploy.yml
```

---

## License

MIT — see [LICENSE](LICENSE)
