# GuardCart — Dat Module

Standalone deterministic **Policy Engine + Demo Payment Optimizer + Audit Logger** for the HacKU 2026 GuardCart prototype.

## Core principle

> The AI decides what is useful. The policy engine decides what is allowed.

This module intentionally keeps authorization logic outside the LLM.

## What this module implements

- `APPROVE`, `ASK`, `BLOCK` decisions
- Expiry enforcement
- Product-category enforcement
- Trusted-merchant enforcement
- Maximum-spend enforcement
- Loyalty-point limit enforcement
- Human approval threshold
- Demo payment-option ranking
- Deterministic audit events for every policy check
- Standalone CLI / Python-function integration
- Automated 7-case policy test suite

## Shared input schemas

### Mandate

```json
{
  "category": "running_shoes",
  "max_spend": 800,
  "approval_threshold": 750,
  "max_points": 2000,
  "trusted_merchants_only": true,
  "expiry": "2099-12-31T23:59:59+00:00"
}
```

### Product

```json
{
  "id": "P01",
  "name": "Running Shoe A",
  "merchant": "Merchant A",
  "trusted": true,
  "price": 699,
  "shipping": 30,
  "category": "running_shoes",
  "availability": true
}
```

### PaymentOption

```json
{
  "name": "Card A (DEMO)",
  "reward_value": 20,
  "fee": 0
}
```

> **Important:** fees/reward values in this repository are clearly labelled **DEMO DATA**. Do not present them as real financial rates unless separately verified and timestamped.

## Decision order

The engine evaluates in this order:

1. Product availability
2. Mandate expiry
3. Product category
4. Merchant trust
5. Checkout total vs. maximum spend
6. Loyalty-points usage
7. Human approval threshold
8. Otherwise approve

### Rules

- expired mandate → `BLOCK`
- wrong product category → `BLOCK`
- untrusted merchant, when trusted-only is required → `BLOCK`
- `final_total > max_spend` → `BLOCK`
- `points_used > max_points` → `BLOCK`
- `approval_threshold < final_total <= max_spend` → `ASK`
- otherwise → `APPROVE`

The spending limit uses the **amount charged at checkout**:

```text
charged_total = product price + shipping + payment fee
```

The payment optimizer ranks demo payment methods using:

```text
effective_cost = charged_total - reward_value
```

Reward value affects ranking but does **not** reduce the amount used for the hard spending cap.

## Run automated tests

From this folder:

```bash
python test_policy_engine.py
```

Expected final line:

```text
7/7 policy tests passed
```

## Run a complete sample transaction

Success case:

```bash
python policy_engine.py --input sample_success.json
```

Human-approval case:

```bash
python policy_engine.py --input sample_ask.json
```

Blocked case:

```bash
python policy_engine.py --input sample_block.json
```

Write output to a file:

```bash
python policy_engine.py --input sample_success.json --output result.json
```

## Integration API for teammates

The easiest integration point is the Python function:

```python
from policy_engine import evaluate_transaction

result = evaluate_transaction(payload)
```

Expected payload:

```json
{
  "mandate": {"...": "..."},
  "product": {"...": "..."},
  "payment_options": [
    {"name": "Card A (DEMO)", "reward_value": 12, "fee": 0},
    {"name": "Card B (DEMO)", "reward_value": 20, "fee": 0},
    {"name": "FPS (DEMO)", "reward_value": 0, "fee": 0}
  ],
  "points_used": 0
}
```

High-level output:

```json
{
  "decision": {
    "status": "APPROVE",
    "product_id": "P01",
    "final_total": 729.0,
    "reason": []
  },
  "selected_payment": {},
  "payment_ranking": [],
  "audit_events": []
}
```

## Frontend integration note for Steven

The UI should rely only on these fields:

- `decision.status`
- `decision.final_total`
- `decision.reason`
- `selected_payment`
- `payment_ranking`
- `audit_events`

Recommended status presentation:

- `APPROVE` → green / transaction allowed
- `ASK` → amber / human approval required
- `BLOCK` → red / transaction stopped

The frontend can continue using mock JSON until integration. Replace the mock decision call with this module's JSON result without changing the UI schema.

## Agent integration note for Zheng

Zheng's agent should output:

- a structured `Mandate`
- a selected or ranked `Product`
- candidate `PaymentOption` objects if applicable

Do **not** let the LLM authorize a transaction. Pass its structured output into this deterministic engine.

Recommended responsibility boundary:

```text
LLM / agent:
understand intent → discover → compare → recommend

Policy engine:
validate authority → APPROVE / ASK / BLOCK → audit
```

## What is deliberately NOT implemented

- Real bank/payment processing
- Real card or FPS API integration
- Full DID / Verifiable Credential infrastructure
- Blockchain
- Browser automation
- Real HKT / Clubpoints integration

These are outside the frozen MVP scope.
