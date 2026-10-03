from fastapi import FastAPI
from pydantic import BaseModel
from agent_module import GuardCartAgent

app = FastAPI(title="GuardCart AI Agent Service")
agent = GuardCartAgent("catalog.json")

class PromptRequest(BaseModel):
    prompt: str

@app.post("/api/agent/recommend")
def recommend(req: PromptRequest):
    return agent.process(req.prompt)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
