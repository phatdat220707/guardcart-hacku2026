/* ============================================================
   GuardCart — Deterministic policy engine (frontend mirror)
   Mirrors Dat's backend engine rule-for-rule so the demo works
   standalone. Later this file is replaced by POST /evaluate.

   Rule order (frozen in shared/schemas.md):
     1. Mandate expired            -> BLOCK
     2. Merchant not permitted     -> BLOCK
     3. Category outside mandate   -> BLOCK
     4. final_total > max_spend    -> BLOCK
     5. points_used > max_points   -> BLOCK
     6. final_total > approval_threshold -> ASK
     7. Otherwise                  -> APPROVE
   ============================================================ */

(function (global) {
  "use strict";

  function nowTime() {
    var d = new Date();
    function pad(n) { return String(n).padStart(2, "0"); }
    return pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  }

  /**
   * evaluate(mandate, product, paymentOption)
   * @returns {{status:string, product_id:string, final_total:number, reason:string[],
   *            checks:Array, audit:Array, effective_cost:number, chosen_payment:object}}
   */
  function evaluate(mandate, product, paymentOption) {
    var audit = [];
    var checks = [];
    var reason = [];
    var fee = paymentOption.fee || 0;
    var pointsUsed = paymentOption.points_used || 0;
    var finalTotal = product.price + product.shipping + fee;
    var effectiveCost = finalTotal - (paymentOption.reward_value || 0);

    function log(event, rule, result) {
      audit.push({ timestamp: nowTime(), event: event, rule: rule, result: result });
    }
    function check(key, label, passed, detail, level) {
      checks.push({ key: key, label: label, passed: passed, detail: detail, level: level || (passed ? "pass" : "fail") });
    }

    log("Mandate received", "mandate.verify", "Mandate loaded for category '" + mandate.category + "'");

    /* 1. Expiry */
    var expired = new Date(mandate.expiry).getTime() < Date.now();
    check("expiry", "Mandate not expired", !expired,
      "expires " + mandate.expiry);
    log("Mandate expiry checked", "mandate.expiry", expired ? "EXPIRED" : "valid");
    if (expired) {
      reason.push("Mandate expired at " + mandate.expiry);
      log("TRANSACTION BLOCKED", "decision", "BLOCK");
      return buildResult("BLOCK");
    }

    /* 2. Merchant trust */
    var merchantOk = !(mandate.trusted_merchants_only && !product.trusted);
    check("merchant", "Trusted merchant", merchantOk,
      product.merchant + (product.trusted ? " · verified" : " · NOT verified"));
    log("Merchant verification", "merchant.trusted",
      product.trusted ? product.merchant + " confirmed trusted" : product.merchant + " is not trusted");
    if (!merchantOk) {
      reason.push("Merchant '" + product.merchant + "' is not on the trusted list");
      log("TRANSACTION BLOCKED", "decision", "BLOCK");
      return buildResult("BLOCK");
    }

    /* 3. Category */
    var categoryOk = product.category === mandate.category;
    check("category", "Category inside mandate", categoryOk,
      product.category + " vs mandate " + mandate.category);
    log("Product category checked", "category.match", categoryOk ? "match" : "outside mandate");
    if (!categoryOk) {
      reason.push("Product category '" + product.category + "' is outside the mandate");
      log("TRANSACTION BLOCKED", "decision", "BLOCK");
      return buildResult("BLOCK");
    }

    /* 4. Budget */
    var budgetOk = finalTotal <= mandate.max_spend;
    check("budget", "Within maximum spend", budgetOk,
      "HK$" + finalTotal + " / limit HK$" + mandate.max_spend,
      budgetOk ? "pass" : "fail");
    log("Final cost calculated: HK$" + finalTotal, "cost.total",
      "price " + product.price + " + shipping " + product.shipping + " + fee " + fee);
    if (!budgetOk) {
      reason.push("Final total HK$" + finalTotal + " exceeds maximum spend HK$" + mandate.max_spend);
      log("Rule failed: budget", "budget.max_spend", "HK$" + finalTotal + " > HK$" + mandate.max_spend);
      log("TRANSACTION BLOCKED", "decision", "BLOCK");
      return buildResult("BLOCK");
    }

    /* 5. Loyalty points */
    var pointsOk = pointsUsed <= mandate.max_points;
    check("points", "Loyalty points within allowance", pointsOk,
      pointsUsed + " pts used / " + mandate.max_points + " pts allowed");
    log("Loyalty usage checked", "points.max", pointsOk ? "within allowance" : "exceeds allowance");
    if (!pointsOk) {
      reason.push("Points usage " + pointsUsed + " exceeds allowance " + mandate.max_points);
      log("TRANSACTION BLOCKED", "decision", "BLOCK");
      return buildResult("BLOCK");
    }

    /* 6. Approval threshold */
    if (finalTotal > mandate.approval_threshold) {
      check("approval", "Auto-approval threshold", false,
        "HK$" + finalTotal + " > threshold HK$" + mandate.approval_threshold + " → human approval required", "ask");
      reason.push("HK$" + finalTotal + " is above the auto-approval threshold of HK$" + mandate.approval_threshold);
      log("Threshold exceeded", "approval.threshold", "forwarding to user for approval");
      log("WAITING FOR USER APPROVAL", "decision", "ASK");
      return buildResult("ASK");
    }
    check("approval", "Below auto-approval threshold", true,
      "HK$" + finalTotal + " ≤ threshold HK$" + mandate.approval_threshold);

    /* 7. Approve */
    reason.push("All " + checks.length + " policy rules satisfied");
    log("All policy rules satisfied", "decision", "APPROVE");
    log("TRANSACTION APPROVED", "payment.simulated", "Demo payment data — no real charge");
    return buildResult("APPROVE");

    function buildResult(status) {
      return {
        status: status,
        product_id: product.id,
        final_total: finalTotal,
        reason: reason,
        checks: checks,
        audit: audit,
        effective_cost: effectiveCost,
        chosen_payment: paymentOption
      };
    }
  }

  /** Pick the payment option with the lowest effective cost. */
  function optimizePayment(product, paymentOptions) {
    var best = null;
    var bestCost = Infinity;
    paymentOptions.forEach(function (p) {
      var cost = product.price + product.shipping + (p.fee || 0) - (p.reward_value || 0);
      if (cost < bestCost) { bestCost = cost; best = p; }
    });
    return best;
  }

  global.PolicyEngine = { evaluate: evaluate, optimizePayment: optimizePayment };
})(window);
