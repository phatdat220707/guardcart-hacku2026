from pathlib import Path
import sys

CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

from agent_module import GuardCartAgent

if __name__ == "__main__":
    catalog_path = CURRENT_DIR / "catalog.json"
    agent = GuardCartAgent(str(catalog_path))
    prompt = "Buy me running shoes under HK$800. Trusted merchants only. Ask me before paying above HK$750."
    res = agent.process(prompt)
    
    print("=" * 45)
    print("【GuardCart Agent 测试执行结果】")
    print("=" * 45)
    print(f"1. 授权(Mandate): 类目={res.mandate.category} | 预算=HK${res.mandate.max_spend} | 审批线={res.mandate.approval_threshold} | 过期={res.mandate.expiry}")
    print(f"2. 推荐选品: {res.selected_product.name} (商家: {res.selected_product.merchant})")
    print(f"3. 综合到手价: HK${res.effective_cost}")
    print(f"4. 推荐理由: {res.explanation}")
    print(f"5. 防注入审计: {res.defense_audit}")
    print("=" * 45)

    out_file = CURRENT_DIR / "agent-output.json"
    with open(out_file, "w", encoding="utf-8") as f:
        f.write(res.model_dump_json(indent=2))
    print(f"✔ 成功更新 {out_file} (包含 2099 过期时间)!")
