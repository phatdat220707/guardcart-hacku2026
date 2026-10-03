import os
import sys
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

CURRENT_DIR = Path(__file__).resolve().parent
REPO_ROOT = CURRENT_DIR.parent
POLICY_DIR = REPO_ROOT / "policy"

if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

if str(POLICY_DIR) not in sys.path:
    sys.path.insert(0, str(POLICY_DIR))

from agent_module import GuardCartAgent

# 导入 Dat 真实的策略引擎
try:
    from policy_engine import evaluate_transaction
except ImportError:
    import importlib.util
    policy_spec = importlib.util.spec_from_file_location("policy_engine", POLICY_DIR / "policy_engine.py")
    pe_mod = importlib.util.module_from_spec(policy_spec)
    policy_spec.loader.exec_module(pe_mod)
    evaluate_transaction = pe_mod.evaluate_transaction

app = FastAPI(title="GuardCart AI Agent & Policy Integration Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

catalog_path = CURRENT_DIR / "catalog.json"
agent = GuardCartAgent(str(catalog_path))

class PromptRequest(BaseModel):
    prompt: str

@app.post("/api/agent/recommend")
def recommend(req: PromptRequest):
    agent_res = agent.process(req.prompt)
    resp = agent_res.model_dump()

    if agent_res.policy_input:
        # 调用 Dat 的真实策略引擎函数
        policy_payload = agent_res.policy_input.model_dump()
        evaluation = evaluate_transaction(policy_payload)
        resp["policy_evaluation"] = evaluation
    else:
        resp["policy_evaluation"] = {
            "decision": {
                "status": "BLOCK",
                "final_total": 0.0,
                "reason": "No valid products found matching criteria"
            },
            "selected_payment": None,
            "payment_ranking": [],
            "audit_events": []
        }
    return resp

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
