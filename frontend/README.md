# GuardCart — Frontend

Judge-facing demo UI for GuardCart, a trust-constrained AI shopping agent built for the HacKU 2026 FinTech Track.

> The agent recommends what is useful. The deterministic policy engine decides what is allowed.

## Public demo

The deployed Netlify site is a standalone static backup. It uses committed fixtures and a browser-side mirror of the frozen policy rules, so judges can explore the three deterministic scenarios without running a backend.

- Public site: https://statuesque-squirrel-5ac82e.netlify.app
- Payment, merchant, product, reward, and transaction data are simulated demo data.
- No real purchase or payment is executed.

## Run the static demo locally

Serve the repository root so the frontend can load the committed Agent fixtures:

```bash
# Run from the repository root
python -m http.server 8899
```

Then open:

```text
http://localhost:8899/frontend/index.html
```

No frontend build step or package installation is required. Internet access is used only for the font and icon CDNs.

## Three presentation scenarios

| Button | Calculation | Expected decision |
|---|---|---|
| Success · HK$729 | HK$699 price + HK$30 shipping | APPROVE |
| Approval · HK$770 | HK$760 price + HK$10 shipping | ASK — the user must approve or decline |
| Blocked · HK$820 | HK$800 price + HK$20 shipping | BLOCK — exceeds the HK$800 maximum spend |

Payment rewards affect the displayed effective cost, but they never reduce the final charged total used for spending-limit enforcement.

## Live Agent/API integration

For a local end-to-end demonstration, start Zheng's FastAPI server from the repository root by following `../agent/README.md`. The frontend's **Live API Test (local only)** button sends:

```text
POST http://127.0.0.1:8001/api/agent/recommend
```

The response contains the Agent recommendation and the full result from Dat's real Policy Engine under `policy_evaluation`.

The public Netlify page cannot start a backend on a judge's computer. Its normal scenario buttons therefore use committed static fixtures. If the local API is unavailable, the UI remains usable as a clearly labelled static demo.

## Architecture

```text
frontend/
  index.html              UI screens and scenario controls
  css/styles.css          Responsive light/dark visual theme
  js/agent-data.js        Live API and static-fixture data adapter
  js/app.js               Screen routing, orchestration, and rendering
  js/policy-engine.js     Browser-side deterministic policy mirror
  js/demo-data.js         Offline fallback demo catalogue
  js/mock-api.js          Offline fallback orchestration
  agent/                  Deployment copies of committed Agent fixtures
```

The source-of-truth backend modules remain in the repository's root-level `agent/` and `policy/` directories. The files in `frontend/agent/` allow the static Netlify deployment to load the same presentation fixtures.

## What is real vs simulated

- Implemented: mandate validation, deterministic policy evaluation, Agent catalogue filtering and ranking, effective-cost calculation, APPROVE/ASK/BLOCK decisions, and audit output.
- Simulated: catalogue merchants and products, payment rails, fees, rewards, and transaction execution.
- The current MVP uses deterministic prompt parsing and ranking; it does not call an external LLM API.
