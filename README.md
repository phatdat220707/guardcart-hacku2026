\# GuardCart



\*\*A policy-controlled shopping agent for HacKU 2026\*\*



> Give AI a mandate, not your wallet.



GuardCart demonstrates how an AI shopping agent can search and rank products while a separate deterministic Policy Engine controls what the agent is allowed to do. The Agent proposes a candidate purchase; the Policy Engine returns `APPROVE`, `ASK`, or `BLOCK` based on limits defined by the user.



\## Public Demo



\- Interactive demo: https://statuesque-squirrel-5ac82e.netlify.app

\- Source repository: https://github.com/phatdat220707/guardcart-hacku2026



The public site uses deterministic scenarios and simulated products, merchants, rewards, and payment data. It does not execute real purchases or charges.



\## Why GuardCart



Shopping agents can recommend products, but recommendations should not automatically receive payment authority.



GuardCart separates product reasoning from authorization:



```text

User request

&#x20;   |

&#x20;   v

Agent

Deterministic intent parsing, product filtering and cost ranking

&#x20;   |

&#x20;   v

Candidate transaction

&#x20;   |

&#x20;   v

Policy Engine

Availability, expiry, category, merchant, spending and approval checks

&#x20;   |

&#x20;   v

APPROVE | ASK | BLOCK

&#x20;   |

&#x20;   v

Explanation and audit events

```



The Agent cannot modify or bypass the mandate constraints during policy evaluation.



\## Three Demo Scenarios



All scenarios use:



\- Maximum spending limit: HK$800

\- Human approval threshold: HK$750

\- Trusted merchants only

\- Running-shoes category

\- Maximum loyalty points usage: 2,000



| Final charged total | Expected decision | Explanation |

|---:|---|---|

| HK$729 | `APPROVE` | Within the approval threshold and spending limit |

| HK$770 | `ASK` | Above HK$750 but within the HK$800 limit |

| HK$820 | `BLOCK` | Above the HK$800 maximum spending limit |



Rewards affect payment ranking only. They do not reduce the charged total used for the spending-limit check.



\## Implemented in the MVP



\### Agent module



\- Deterministic natural-language prompt parsing

\- Catalogue filtering and trusted-merchant checks

\- Product and payment-option ranking

\- Effective-cost calculation

\- Prompt-injection detection for untrusted product descriptions

\- Structured Policy Engine handoff

\- FastAPI endpoint at `POST /api/agent/recommend`



The current MVP does not call an external LLM API.



\### Policy Engine



The Policy Engine checks:



\- Product availability

\- Mandate expiry

\- Product category

\- Merchant trust

\- Final charged total

\- Maximum spending limit

\- Loyalty-points usage

\- Human approval threshold



It produces:



\- Decision status

\- Final charged total

\- Human-readable reasons

\- Selected payment candidate

\- Payment ranking

\- Rule-level audit events



\### Frontend



\- Mandate input and validation

\- Product comparison

\- Policy-check explanation

\- `APPROVE`, `ASK`, and `BLOCK` screens

\- Audit timeline

\- Public deterministic scenarios

\- Optional local Live API integration



\## Repository Structure



```text

guardcart-hacku2026/

├── agent/       Agent, catalogue, fixtures and FastAPI service

├── frontend/    HTML, CSS and JavaScript demonstration interface

├── policy/      Deterministic Policy Engine and tests

├── mandate.json Shared example mandate

├── README.md

└── .gitignore

```



\## Run Locally on Windows



\### 1. Create the Agent environment



From the repository root:



```powershell

py -m venv agent\\.venv

.\\agent\\.venv\\Scripts\\python.exe -m pip install -r agent\\requirements.txt

```



\### 2. Run the Policy Engine tests



```powershell

.\\agent\\.venv\\Scripts\\python.exe policy\\test\_policy\_engine.py

```



Expected result:



```text

7/7 policy tests passed

```



\### 3. Run the Agent smoke test



```powershell

.\\agent\\.venv\\Scripts\\python.exe agent\\run\_test.py

```



\### 4. Start the Agent and Policy API



```powershell

.\\agent\\.venv\\Scripts\\python.exe agent\\server.py

```



The API will run at:



```text

http://127.0.0.1:8001

```



Interactive API documentation:



```text

http://127.0.0.1:8001/docs

```



\### 5. Serve the frontend



Open another PowerShell window at the repository root:



```powershell

.\\agent\\.venv\\Scripts\\python.exe -m http.server 8899

```



Then open:



```text

http://localhost:8899/frontend/index.html

```



The three deterministic scenarios work without the Live API. The local Live API test requires `agent/server.py` to be running.



\## Testing Evidence



\- Policy Engine unit scenarios: `7/7` passed

\- HK$729 fixture: `APPROVE`

\- HK$770 fixture: `ASK`

\- HK$820 fixture: `BLOCK`

\- Agent-to-Policy Engine API smoke test: passed

\- Prompt-injection defense scenario: detected and neutralized



\## Implemented Versus Simulated



Implemented:



\- Agent parsing, filtering, and ranking

\- Policy evaluation

\- Three authorization outcomes

\- Payment-option comparison

\- Explanations and audit events

\- Local end-to-end API integration



Simulated:



\- Products and merchants

\- Prices, shipping, fees, and rewards

\- Payment rails and transaction execution

\- Bank, card, and loyalty-program integration



GuardCart does not store real card information and does not make real charges.



\## Limitations and Next Steps



The MVP does not currently include:



\- Real merchant or inventory APIs

\- Real payment execution

\- Tokenized card storage or 3DS

\- Cryptographic mandate signing

\- Manual mandate revocation

\- Production identity and access control

\- External LLM integration

\- Large-scale security or real-user evaluation



These are future integration and validation steps, not implemented features of the current demo.



\## Technology and Open-Source Credits



\- Python standard library for the Policy Engine

\- \[FastAPI](https://fastapi.tiangolo.com/) — MIT License

\- \[Pydantic](https://docs.pydantic.dev/) — MIT License

\- \[Uvicorn](https://www.uvicorn.org/) — BSD 3-Clause License

\- HTML, CSS, and JavaScript frontend

\- \[Inter](https://fonts.google.com/specimen/Inter) — SIL Open Font License

\- \[Font Awesome Free](https://fontawesome.com/) — icons, fonts, and code under their respective free licenses

\- \[Netlify](https://www.netlify.com/) for public demo hosting



Payment rewards and fees are demo data unless separately verified and timestamped.



\## Team



\- \*\*Steven Lan\*\* — Frontend and public demo

\- \*\*Zheng\*\* — Agent and API integration

\- \*\*Dat\*\* — Policy Engine, repository integration and final QA

\- \*\*Douglas\*\* — Pitch deck, presentation script and judge Q\&A

