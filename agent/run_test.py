from agent_module import GuardCartAgent

def main():
    agent = GuardCartAgent("catalog.json")
    prompt = "Buy me running shoes under HK$800. Trusted merchants only. Ask me before paying above HK$750."
    result = agent.process(prompt)

    print("\n" + "="*50)
    print("【GuardCart Agent 测试执行结果】")
    print("="*50)
    print(f"1. 授权(Mandate): 类目={result.mandate.category} | 预算=HK${result.mandate.max_spend} | 审批线=HK${result.mandate.approval_threshold}")
    print(f"2. 推荐选品: {result.selected_product.name} (商家: {result.selected_product.merchant})")
    print(f"3. 综合到手价: HK${result.effective_cost}")
    print(f"4. 推荐理由: {result.explanation}")
    print(f"5. 防注入审计: {result.defense_audit}")
    print("="*50 + "\n")

    with open("agent-output.json", "w", encoding="utf-8") as f:
        f.write(result.model_dump_json(indent=2))
    print("✔ 已成功生成 agent-output.json！")

if __name__ == "__main__":
    main()
