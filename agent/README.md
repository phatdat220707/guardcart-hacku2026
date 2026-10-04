# GuardCart — Agent & API Service

## Overview
The Agent module provides the intent parsing, candidate discovery, and cost-optimization layer in GuardCart.

In the current MVP implementation:
- **Intent Parsing**: Deterministic rule-based prompt extraction for budget ceilings, approval thresholds, and item categories.
- **Product Filtering & Ranking**: Evaluates candidates against trusted merchants and calculates the Effective Cost:
  Effective Cost = Sticker Price + Shipping + Payment Fee - Card Reward
- **Zero Payment Execution Authority**: The Agent only produces candidate recommendations and ranked payment options. It possesses zero execution privilege.
- **Policy Engine Enforcement**: The structured output is evaluated by `policy/policy_engine.py` against constraints the agent cannot modify or bypass during evaluation.

## Environment & Setup

### Linux / macOS / WSL
```bash
python3 -m venv agent/.venv
agent/.venv/bin/python -m pip install -r agent/requirements.txt
agent/.venv/bin/python agent/run_test.py
agent/.venv/bin/python agent/server.py
```

### Windows (PowerShell)
```powershell
py -m venv agent/.venv
& "agent/.venv/Scripts/python.exe" -m pip install -r agent/requirements.txt
& "agent/.venv/Scripts/python.exe" agent/run_test.py
& "agent/.venv/Scripts/python.exe" agent/server.py
```

## Running the API Server

From the repository root:
```bash
python agent/server.py
```
Default URL: `http://127.0.0.1:8001`
Swagger UI: `http://127.0.0.1:8001/docs`

## API Endpoints
- `POST /api/agent/recommend`: Evaluates natural language spending prompts and returns optimal product, payment ranking, and full `policy_evaluation` audit logs.

## Smoke Testing & Verification

Run the test suite from the repository root:
```bash
python agent/run_test.py
```

Or trigger a test request via curl:
```bash
curl -X POST http://127.0.0.1:8001/api/agent/recommend -H 'Content-Type: application/json' -d '{"prompt":"Buy me running shoes under HKD 800. Ask me before spending above HKD 750."}'
```
