# GuardCart — AI Agent & Integration Module

## Overview
Autonomous product intelligence module for GuardCart. Handles mandate parsing, value-based ranking, and prompt injection defense. Integrates directly with Policy Engine to output recommendation and final authorization decision.

## Path Robustness
All scripts automatically resolve paths relative to `__file__`. You can run them from any directory.

## Quickstart

### 1. Install Dependencies
- Linux/macOS: `pip install -r agent/requirements.txt`
- Windows: `pip install -r agent\requirements.txt`

### 2. Standalone Verification
- Linux/macOS: `python3 agent/run_test.py`
- Windows: `python agent\run_test.py`

### 3. Launch Dynamic API Server
- Linux/macOS: `python3 agent/server.py`
- Windows: `python agent\server.py`
- Swagger UI: `http://127.0.0.1:8001/docs`
- CORS: Enabled (`*`) for local React/Vite development.

## Static Demo Fixtures (Aligned with Policy Engine)
Located in `agent/demo-fixtures.json`:
- `approve_729`: Total charge HK$729 -> APPROVE
- `ask_770`: Total charge HK$770 -> ASK
- `block_820`: Total charge HK$820 -> BLOCK
