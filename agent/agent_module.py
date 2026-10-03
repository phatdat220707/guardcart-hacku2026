import re
import json
from typing import List, Optional, Tuple
from pydantic import BaseModel

class Mandate(BaseModel):
    category: str
    max_spend: float
    approval_threshold: float
    max_points: int = 2000
    trusted_merchants_only: bool = True
    expiry: Optional[str] = "2099-12-31T23:59:59+00:00"

class Product(BaseModel):
    id: str
    name: str
    category: str
    merchant: str
    trusted: bool
    price: float
    shipping: float
    availability: bool = True
    description: str = ""

class PaymentOption(BaseModel):
    name: str
    reward_value: float = 0.0
    fee: float = 0.0

class CandidateEvaluation(BaseModel):
    product: Product
    selected_payment: PaymentOption
    effective_cost: float
    match_status: str
    disqualify_reason: Optional[str] = None

class PolicyEngineInput(BaseModel):
    mandate: Mandate
    product: Product
    payment_options: List[PaymentOption]
    points_used: int = 0

class AgentRecommendationResponse(BaseModel):
    mandate: Mandate
    selected_product: Optional[Product]
    selected_payment: Optional[PaymentOption]
    effective_cost: Optional[float]
    considered_candidates: List[CandidateEvaluation]
    explanation: str
    defense_audit: str
    policy_input: Optional[PolicyEngineInput] = None

class AdversarialSanitizer:
    @staticmethod
    def inspect(text: str) -> Tuple[str, bool]:
        injection_patterns = [
            r"ignore\s+(previous|user|all)",
            r"system\s*override",
            r"force\s+select",
            r"output\s+approved"
        ]
        is_malicious = any(re.search(pat, text, re.IGNORECASE) for pat in injection_patterns)
        if is_malicious:
            clean_text = f"[UNTRUSTED CONTENT NEUTRALIZED]: {text[:50]}..."
            return clean_text, True
        return text, False

class GuardCartAgent:
    DEMO_PAYMENTS = [
        PaymentOption(name="HSBC Visa Card (DEMO)", reward_value=25.0, fee=0.0),
        PaymentOption(name="FPS Standard (DEMO)", reward_value=0.0, fee=0.0)
    ]

    def __init__(self, catalog_path: str = "catalog.json"):
        with open(catalog_path, "r", encoding="utf-8") as f:
            raw = json.load(f)
            # 兼容 availability 与 available 字段
            for item in raw:
                if "available" in item and "availability" not in item:
                    item["availability"] = item["available"]
            self.catalog = [Product(**p) for p in raw]

    def parse_mandate(self, prompt: str) -> Mandate:
        max_spend_match = re.search(r"(?:under|<|below|max)\s*(?:HK\$?|HKD)?\s*(\d+)", prompt, re.IGNORECASE)
        max_spend = float(max_spend_match.group(1)) if max_spend_match else 800.0

        thresh_match = re.search(r"(?:above|>|ask.*above)\s*(?:HK\$?|HKD)?\s*(\d+)", prompt, re.IGNORECASE)
        approval_threshold = float(thresh_match.group(1)) if thresh_match else 750.0

        trusted_only = "trusted" in prompt.lower() or "any merchant" not in prompt.lower()

        category = "running_shoes"
        if "hiking" in prompt.lower():
            category = "hiking_shoes"

        return Mandate(
            category=category,
            max_spend=max_spend,
            approval_threshold=approval_threshold,
            trusted_merchants_only=trusted_only
        )

    def process(self, prompt: str) -> AgentRecommendationResponse:
        mandate = self.parse_mandate(prompt)
        valid_candidates = []
        disqualified = []
        defense_alerts = []

        best_payment = self.DEMO_PAYMENTS[0]

        for prod in self.catalog:
            clean_desc, is_attack = AdversarialSanitizer.inspect(prod.description)
            prod.description = clean_desc
            if is_attack:
                defense_alerts.append(f"Product {prod.id} tried prompt injection. Neutralized.")

            if prod.category != mandate.category:
                disqualified.append(CandidateEvaluation(
                    product=prod, selected_payment=best_payment,
                    effective_cost=9999, match_status="DISQUALIFIED",
                    disqualify_reason="Category mismatch"
                ))
                continue

            if not prod.availability:
                disqualified.append(CandidateEvaluation(
                    product=prod, selected_payment=best_payment,
                    effective_cost=9999, match_status="DISQUALIFIED",
                    disqualify_reason="Out of stock"
                ))
                continue

            if mandate.trusted_merchants_only and not prod.trusted:
                disqualified.append(CandidateEvaluation(
                    product=prod, selected_payment=best_payment,
                    effective_cost=9999, match_status="DISQUALIFIED",
                    disqualify_reason="Untrusted merchant"
                ))
                continue

            eff_cost = prod.price + prod.shipping + best_payment.fee - best_payment.reward_value
            valid_candidates.append(CandidateEvaluation(
                product=prod, selected_payment=best_payment,
                effective_cost=eff_cost, match_status="MATCHED"
            ))

        valid_candidates.sort(key=lambda x: x.effective_cost)
        top_candidate = valid_candidates[0] if valid_candidates else None
        
        explanation = (
            f"Selected '{top_candidate.product.name}' (HK${top_candidate.product.price}) with "
            f"HK${top_candidate.product.shipping} shipping. Applying {best_payment.name} "
            f"saved HK${best_payment.reward_value}, giving lowest effective cost HK${top_candidate.effective_cost}."
        ) if top_candidate else "No eligible product found."

        policy_input = None
        if top_candidate:
            policy_input = PolicyEngineInput(
                mandate=mandate,
                product=top_candidate.product,
                payment_options=self.DEMO_PAYMENTS,
                points_used=0
            )

        return AgentRecommendationResponse(
            mandate=mandate,
            selected_product=top_candidate.product if top_candidate else None,
            selected_payment=best_payment if top_candidate else None,
            effective_cost=top_candidate.effective_cost if top_candidate else None,
            considered_candidates=valid_candidates[:3] + disqualified[:2],
            explanation=explanation,
            defense_audit=" | ".join(defense_alerts) if defense_alerts else "No threats detected.",
            policy_input=policy_input
        )
