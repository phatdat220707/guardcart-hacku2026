# GuardCart — Frontend

Trust-constrained AI shopping agent demo UI. HacKU 2026 FinTech Track (HKT).

> The AI decides what is useful. The policy engine decides what is allowed.

## Run

No build step, no dependencies to install.

- Easiest: double-click `index.html`, or
- Serve locally (recommended, avoids any browser quirks):

```bash
cd frontend
python -m http.server 8080
# open http://localhost:8080
```

Requires internet access for the Font Awesome / font CDNs.

## Demo paths (bottom bar)

| Button | Flow | Expected |
|---|---|---|
| Success · HK$739 | P01 Velocity Runner Pro, all rules pass | APPROVE |
| Approval · HK$780 | P02 StreetGlide X, above auto-approval threshold | ASK → user can Approve / Decline |
| Blocked · HK$830 | P03 TrailMaster GTX, over HK$800 max spend | BLOCK — "Best payment option identified, but transaction was not executed" |
| Reset | Back to the mandate screen | — |

You can also type a request and press **Start Agent** — it runs the success scenario with the mandate values from the form (validated first).

## Architecture

```
frontend/
  index.html          7 screens: mandate / progress / comparison / policy / decision / audit + demo bar
  css/styles.css      Editorial Calm theme (light default + data-theme="dark", toggle in topbar)
  js/demo-data.js     mirror of ../shared/demo-data.json (JS so file:// works without CORS issues)
  js/policy-engine.js deterministic rules — local mirror of Dat's frozen engine (offline fallback)
  js/api-client.js    fetch client for the live policy adapter (127.0.0.1:8001, 2.5s timeout)
  js/mock-api.js      ALL data access: mockMandate / mockProducts / mockRunAgent ...
  js/app.js           screen router + demo orchestration + renderers
```

## Policy engine integration (live, no schema changes)

Dat's frozen policy module is served over HTTP by `../policy/server.py` (Python standard library only, no pip install):

```bash
python policy/server.py
# GET  http://127.0.0.1:8001/health
# POST http://127.0.0.1:8001/evaluate   body: {mandate, product, payment_option}
```

Drop Dat's frozen engine file into `policy/` — the adapter auto-discovers it (looks for an `evaluate`-style function or a `PolicyEngine` class) and maps its result onto the shared Decision schema (`status / product_id / final_total / reason / audit`). No shared fields were added or renamed.

How the UI consumes it (`js/mock-api.js` → `decide()`):

- **Live**: status / final_total / reason / audit come from Dat's engine. The per-rule check list is rendered from the local mirror, because the frozen Decision schema has no per-rule field.
- **Fallback**: if the server is offline or errors, the UI switches to the local mirror so the demo never breaks. An audit event marks the source either way ("Decision by Dat's frozen policy engine" vs "… local policy mirror (engine offline)").

Still mocked — to swap later, edit **only** `js/mock-api.js`:

| Mock function | Real endpoint | Owner |
|---|---|---|
| `mockMandate()` | POST /api/mandate (natural language → Mandate) | Zheng |
| `mockProducts()` | GET /api/products | Zheng |
| `mockRunAgent()` internals | ranking + explanation | Zheng |

All payloads follow `../shared/schemas.md` — do not change field names.

## What is real vs simulated

- Real: screen flow, mandate validation, deterministic policy rule evaluation, effective-cost math, audit timeline.
- Simulated (clearly labelled "Demo payment data"): merchants, products, payment rails, rewards, the transaction itself.
