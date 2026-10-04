# GuardCart — Agent & API Service

## Overview
The Agent module provides the intent parsing, product discovery, and cost-optimization layer in GuardCart.

In the current MVP implementation:
- **Intent Parsing**: Deterministic rule-based prompt extraction for budget ceilings, approval thresholds, and categories.
- **Product Filtering & Ranking**: Evaluates candidates against trusted merchants and calculates the **Effective Cost**:
  $$\text{Effective Cost} = \text{Sticker Price} + \text{Shipping} + \text{Payment Fee} - \text{Card Reward}$$
- **Zero Payment Authority**: The Agent only produces a candidate recommendation and payment option ranking. It possesses zero execution privilege.
- **Policy Engine Handoff**: The structured output is passed directly to `policy/policy_engine.py` for immutable deterministic evaluation.

## Running the API Server
```bash
python agent/server.py
