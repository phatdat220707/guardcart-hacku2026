# GuardCart — Frontend Client Prototype

## Overview
Editorial Calm client interface built with React 18 and Zustand. Provides an interactive shopping mandate configuration, product comparison matrix, live policy engine authorization layer, and immutable audit logs.

## Demo Architectures

### 1. Local Live Integration (Recommended for Pitch Demo)
- Runs locally alongside the FastAPI backend (`http://127.0.0.1:8001`).
- Calls `POST /api/agent/recommend` to trigger real-time LLM agent ranking and dynamic `policy_engine.py` rule evaluation.

### 2. Netlify Hosted Deployment (Public QR Backup)
- Hosted at `https://statuesque-squirrel-5ac82e.netlify.app`
- Standalone client bundle containing deterministic fixtures for audience/judge mobile scanning.
- Accurately demonstrates the 3 policy branches:
  - **HK$729**: APPROVE
  - **HK$770**: ASK
  - **HK$820**: BLOCK (Circuit-breaker stops before approval evaluation)

## Run Locally
```bash
# Serve the single-page prototype locally
npx serve frontend -p 3000
