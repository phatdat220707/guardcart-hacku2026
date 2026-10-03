import os
import sys
from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from agent_module import GuardCartAgent, PolicyEngineInput

app = FastAPI(title="GuardCart AI Agent Service")

# 启用 CORS 允许前端跨域
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

catalog_file = os.path.join(BASE_DIR, "catalog.json")
agent = GuardCartAgent(catalog_file)

def evaluate_policy_locally(p_input: PolicyEngineInput) -> dict:
    try:
        from engine import evaluate_policy
        return evaluate_policy(p_input.model_dump())
    except Exception:
        pass

    m = p_input.mandate
    p = p_input.product
    now = datetime.now(timezone.utc)
    
    if m.expiry:
        try:
            exp_dt = datetime.fromisoformat(m.expiry.replace("Z", "+00:00"))
            if now > exp_dt:
                return {"decision": "BLOCK", "reason": "Mandate expired"}
        except Exception:
            pass

    if m.trusted_merchants_only and not p.trusted:
        return {"decision": "BLOCK", "reason": "Merchant untrusted"}

    total_charged = p.price + p.shipping
    if total_charged > m.max_spend:
        return {"decision": "BLOCK", "reason": f"Total charge HK${total_charged} exceeds limit HK${m.max_spend}"}

    if total_charged > m.approval_threshold:
        return {"decision": "ASK", "reason": f"Total charge HK${total_charged} exceeds approval threshold HK${m.approval_threshold}"}

    return {"decision": "APPROVE", "reason": "Compliant with all mandate rules"}

class PromptRequest(BaseModel):
    prompt: str

@app.post("/api/agent/recommend")
def recommend(req: PromptRequest):
    agent_res = agent.process(req.prompt)
    resp = agent_res.model_dump()
    if agent_res.policy_input:
        resp["policy_evaluation"] = evaluate_policy_locally(agent_res.policy_input)
    else:
        resp["policy_evaluation"] = {"decision": "BLOCK", "reason": "No valid product candidate"}
    return resp

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
