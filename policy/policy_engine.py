from __future__ import annotations

import argparse
import json
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


STATUS_APPROVE = "APPROVE"
STATUS_ASK = "ASK"
STATUS_BLOCK = "BLOCK"


@dataclass
class AuditEvent:
    timestamp: str
    event: str
    rule: str
    result: str


@dataclass
class Decision:
    status: str
    product_id: str
    final_total: float
    reason: List[str]


class ValidationError(ValueError):
    pass


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_iso(value: str) -> datetime:
    """Parse ISO-8601 strings with either explicit offset or trailing Z."""
    if not isinstance(value, str) or not value.strip():
        raise ValidationError("Mandate expiry must be a non-empty ISO timestamp string.")
    value = value.strip()
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(value)
    except ValueError as exc:
        raise ValidationError(f"Invalid ISO timestamp: {value}") from exc
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _require_keys(obj: Dict[str, Any], keys: List[str], label: str) -> None:
    missing = [k for k in keys if k not in obj]
    if missing:
        raise ValidationError(f"{label} missing required field(s): {', '.join(missing)}")


def validate_mandate(mandate: Dict[str, Any]) -> None:
    _require_keys(
        mandate,
        [
            "category",
            "max_spend",
            "approval_threshold",
            "max_points",
            "trusted_merchants_only",
            "expiry",
        ],
        "Mandate",
    )
    if float(mandate["max_spend"]) < 0:
        raise ValidationError("max_spend cannot be negative.")
    if float(mandate["approval_threshold"]) < 0:
        raise ValidationError("approval_threshold cannot be negative.")
    if float(mandate["approval_threshold"]) > float(mandate["max_spend"]):
        raise ValidationError("approval_threshold cannot exceed max_spend.")
    if int(mandate["max_points"]) < 0:
        raise ValidationError("max_points cannot be negative.")
    _parse_iso(mandate["expiry"])


def validate_product(product: Dict[str, Any]) -> None:
    _require_keys(
        product,
        ["id", "name", "merchant", "trusted", "price", "shipping", "category", "availability"],
        "Product",
    )
    if float(product["price"]) < 0 or float(product["shipping"]) < 0:
        raise ValidationError("Product price and shipping cannot be negative.")


def validate_payment(payment: Dict[str, Any]) -> None:
    _require_keys(payment, ["name", "reward_value", "fee"], "PaymentOption")
    if float(payment["reward_value"]) < 0 or float(payment["fee"]) < 0:
        raise ValidationError("Payment reward_value and fee cannot be negative.")


def payment_metrics(product: Dict[str, Any], payment: Dict[str, Any]) -> Dict[str, float]:
    """
    DEMO calculation only.

    charged_total is the amount charged at checkout and is what spending-limit rules evaluate.
    effective_cost subtracts the demo reward value for ranking/comparison purposes.
    """
    charged_total = round(float(product["price"]) + float(product["shipping"]) + float(payment["fee"]), 2)
    effective_cost = round(charged_total - float(payment["reward_value"]), 2)
    return {"charged_total": charged_total, "effective_cost": effective_cost}


def optimize_payment(product: Dict[str, Any], payment_options: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Rank DEMO payment options by effective cost. Lower is better."""
    if not payment_options:
        raise ValidationError("At least one PaymentOption is required.")

    ranked = []
    for option in payment_options:
        validate_payment(option)
        metrics = payment_metrics(product, option)
        ranked.append({**option, **metrics})

    ranked.sort(key=lambda p: (p["effective_cost"], p["charged_total"], p["name"]))
    return {"selected": ranked[0], "ranked": ranked}


def evaluate_policy(
    mandate: Dict[str, Any],
    product: Dict[str, Any],
    payment: Dict[str, Any],
    *,
    points_used: int = 0,
    now: Optional[datetime] = None,
) -> Tuple[Decision, List[AuditEvent]]:
    """Deterministically evaluate whether the purchase is APPROVE, ASK, or BLOCK."""
    validate_mandate(mandate)
    validate_product(product)
    validate_payment(payment)

    if points_used < 0:
        raise ValidationError("points_used cannot be negative.")

    current_time = now or datetime.now(timezone.utc)
    if current_time.tzinfo is None:
        current_time = current_time.replace(tzinfo=timezone.utc)
    current_time = current_time.astimezone(timezone.utc)

    audits: List[AuditEvent] = []
    reasons: List[str] = []

    def log(event: str, rule: str, result: str) -> None:
        audits.append(AuditEvent(timestamp=_now_iso(), event=event, rule=rule, result=result))

    # Availability is a practical precondition, not a user authority rule.
    if not bool(product["availability"]):
        msg = "Product is unavailable."
        log("Availability checked", "product.availability == true", "FAIL")
        return Decision(STATUS_BLOCK, str(product["id"]), 0.0, [msg]), audits
    log("Availability checked", "product.availability == true", "PASS")

    expiry = _parse_iso(mandate["expiry"])
    if current_time > expiry:
        msg = f"Mandate expired at {expiry.isoformat()}."
        log("Mandate expiry checked", "current_time <= mandate.expiry", "FAIL")
        return Decision(STATUS_BLOCK, str(product["id"]), 0.0, [msg]), audits
    log("Mandate expiry checked", "current_time <= mandate.expiry", "PASS")

    if str(product["category"]) != str(mandate["category"]):
        msg = f"Product category '{product['category']}' is outside authorized category '{mandate['category']}'."
        log("Product category checked", "product.category == mandate.category", "FAIL")
        return Decision(STATUS_BLOCK, str(product["id"]), 0.0, [msg]), audits
    log("Product category checked", "product.category == mandate.category", "PASS")

    if bool(mandate["trusted_merchants_only"]) and not bool(product["trusted"]):
        msg = f"Merchant '{product['merchant']}' is not trusted under this mandate."
        log("Merchant trust checked", "trusted merchant required", "FAIL")
        return Decision(STATUS_BLOCK, str(product["id"]), 0.0, [msg]), audits
    log("Merchant trust checked", "trusted merchant required", "PASS")

    metrics = payment_metrics(product, payment)
    final_total = metrics["charged_total"]
    log(
        "Final checkout amount calculated",
        "price + shipping + payment fee",
        f"HK${final_total:.2f}",
    )

    if final_total > float(mandate["max_spend"]):
        msg = (
            f"Final amount HK${final_total:.2f} exceeds authorized spending limit "
            f"HK${float(mandate['max_spend']):.2f}."
        )
        log("Maximum spend checked", "final_total <= mandate.max_spend", "FAIL")
        return Decision(STATUS_BLOCK, str(product["id"]), final_total, [msg]), audits
    log("Maximum spend checked", "final_total <= mandate.max_spend", "PASS")

    if int(points_used) > int(mandate["max_points"]):
        msg = f"Points usage {points_used} exceeds authorized limit {int(mandate['max_points'])}."
        log("Loyalty-points limit checked", "points_used <= mandate.max_points", "FAIL")
        return Decision(STATUS_BLOCK, str(product["id"]), final_total, [msg]), audits
    log("Loyalty-points limit checked", "points_used <= mandate.max_points", "PASS")

    if final_total > float(mandate["approval_threshold"]):
        msg = (
            f"Final amount HK${final_total:.2f} is within the maximum budget but exceeds "
            f"the automatic approval threshold of HK${float(mandate['approval_threshold']):.2f}."
        )
        log("Human approval threshold checked", "final_total <= approval_threshold", "FAIL -> ASK")
        return Decision(STATUS_ASK, str(product["id"]), final_total, [msg]), audits

    log("Human approval threshold checked", "final_total <= approval_threshold", "PASS")
    reasons.extend(
        [
            f"Final amount HK${final_total:.2f} is within the authorized spending limit.",
            "Merchant satisfies the trust rule.",
            "Product category matches the mandate.",
            "Loyalty-points usage is within the authorized limit.",
            "No human approval is required for this amount.",
        ]
    )
    return Decision(STATUS_APPROVE, str(product["id"]), final_total, reasons), audits


def evaluate_transaction(payload: Dict[str, Any], *, now: Optional[datetime] = None) -> Dict[str, Any]:
    """
    High-level integration function.

    Expected payload:
    {
      "mandate": {...},
      "product": {...},
      "payment_options": [{...}, ...],
      "points_used": 0
    }
    """
    _require_keys(payload, ["mandate", "product", "payment_options"], "Transaction payload")
    validate_product(payload["product"])
    payment_result = optimize_payment(payload["product"], payload["payment_options"])
    selected = payment_result["selected"]

    decision, audits = evaluate_policy(
        payload["mandate"],
        payload["product"],
        selected,
        points_used=int(payload.get("points_used", 0)),
        now=now,
    )

    return {
        "decision": asdict(decision),
        "selected_payment": selected,
        "payment_ranking": payment_result["ranked"],
        "audit_events": [asdict(a) for a in audits],
        "data_notice": "Payment fees/rewards in this module are demo data unless separately verified and timestamped.",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="GuardCart deterministic policy engine")
    parser.add_argument("--input", required=True, help="Path to transaction JSON payload")
    parser.add_argument("--output", help="Optional output JSON file")
    args = parser.parse_args()

    payload = json.loads(Path(args.input).read_text(encoding="utf-8"))
    result = evaluate_transaction(payload)
    output = json.dumps(result, indent=2, ensure_ascii=False)

    if args.output:
        Path(args.output).write_text(output + "\n", encoding="utf-8")
    else:
        print(output)


if __name__ == "__main__":
    main()
