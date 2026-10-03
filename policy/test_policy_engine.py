from datetime import datetime, timedelta, timezone

from policy_engine import (
    STATUS_APPROVE,
    STATUS_ASK,
    STATUS_BLOCK,
    evaluate_policy,
)


NOW = datetime(2026, 10, 3, 10, 0, tzinfo=timezone.utc)


def mandate(**overrides):
    base = {
        "category": "running_shoes",
        "max_spend": 800,
        "approval_threshold": 750,
        "max_points": 2000,
        "trusted_merchants_only": True,
        "expiry": (NOW + timedelta(days=1)).isoformat(),
    }
    base.update(overrides)
    return base


def product(**overrides):
    base = {
        "id": "P01",
        "name": "Running Shoe",
        "merchant": "Trusted Merchant",
        "trusted": True,
        "price": 699,
        "shipping": 30,
        "category": "running_shoes",
        "availability": True,
    }
    base.update(overrides)
    return base


def payment(**overrides):
    base = {"name": "Card A (DEMO)", "reward_value": 20, "fee": 0}
    base.update(overrides)
    return base


def run_test(name, expected, *, m=None, p=None, pay=None, points_used=0):
    decision, _ = evaluate_policy(
        m or mandate(),
        p or product(),
        pay or payment(),
        points_used=points_used,
        now=NOW,
    )
    passed = decision.status == expected
    marker = "PASS" if passed else "FAIL"
    print(f"[{marker}] {name}: expected={expected}, got={decision.status}")
    if not passed:
        print("       Reasons:", decision.reason)
    return passed


def main():
    tests = [
        run_test("1. HK$729 trusted merchant", STATUS_APPROVE),
        run_test(
            "2. HK$770 -> human approval",
            STATUS_ASK,
            p=product(price=740, shipping=30),
        ),
        run_test(
            "3. HK$820 -> over budget",
            STATUS_BLOCK,
            p=product(price=730, shipping=90),
        ),
        run_test(
            "4. Untrusted merchant",
            STATUS_BLOCK,
            p=product(merchant="Unknown Seller", trusted=False),
        ),
        run_test(
            "5. Expired mandate",
            STATUS_BLOCK,
            m=mandate(expiry=(NOW - timedelta(minutes=1)).isoformat()),
        ),
        run_test(
            "6. Loyalty points limit exceeded",
            STATUS_BLOCK,
            points_used=2500,
        ),
        run_test(
            "7. Wrong product category",
            STATUS_BLOCK,
            p=product(category="headphones"),
        ),
    ]

    passed = sum(tests)
    total = len(tests)
    print(f"\n{passed}/{total} policy tests passed")
    if passed != total:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
