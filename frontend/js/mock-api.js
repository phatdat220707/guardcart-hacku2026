/* ============================================================
   GuardCart — Mock API layer
   Steven's independence rule: the UI only talks to these mock
   functions. Integration later = swap each function body with
   a real fetch() call (e.g. mockDecision -> POST /api/decision).
   ============================================================ */

(function (global) {
  "use strict";

  var DATA = global.GUARDCART_DEMO_DATA;

  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  /* ---------------- Raw mocks ---------------- */

  function mockMandate() {
    return Object.assign({}, DATA.mandate_template);
  }

  function mockProducts() {
    return DATA.products.map(function (p) { return Object.assign({}, p); });
  }

  function mockPaymentOptions() {
    return DATA.payment_options.map(function (p) { return Object.assign({}, p); });
  }

  /* ---------------- Agent pipeline (mock of Zheng's agent) ---------------- */

  var AGENT_STEPS = [
    { icon: "fa-brain",            text: "Understanding your request" },
    { icon: "fa-magnifying-glass", text: "Searching trusted merchants" },
    { icon: "fa-scale-balanced",   text: "Comparing products" },
    { icon: "fa-credit-card",      text: "Optimizing payment & rewards" },
    { icon: "fa-shield-halved",    text: "Checking your authorization" }
  ];

  function mockAgentSteps() {
    return AGENT_STEPS.map(function (s) { return Object.assign({}, s); });
  }

  /** Rank products by effective cost with the chosen payment option. */
  function rankProducts(products, mandate) {
    var bestPay = DATA.payment_options[0]; // Card A, baseline
    return products
      .filter(function (p) { return p.category === mandate.category; })
      .map(function (p) {
        return {
          product: p,
          final_total: p.price + p.shipping + bestPay.fee,
          effective_cost: p.price + p.shipping + bestPay.fee - bestPay.reward_value
        };
      })
      .sort(function (a, b) { return a.effective_cost - b.effective_cost; });
  }

  /**
   * mockRunAgent(scenarioKey, mandate)
   * Returns the full pipeline result the UI needs:
   * candidates (top 3), chosen product + reason, best payment, decision, audit.
   */
  function mockRunAgent(scenarioKey, mandate) {
    return delay(150).then(function () {
      var scenario = DATA.scenarios[scenarioKey];
      var products = mockProducts();
      var ranked = rankProducts(products, mandate);

      /* The chosen product is fixed per scenario so the demo numbers are stable.
         Alternatives = the two best-ranked trusted products that are not chosen. */
      var chosen = products.find(function (p) { return p.id === scenario.product_id; });
      var alternatives = ranked
        .filter(function (r) { return r.product.id !== chosen.id && r.product.trusted; })
        .slice(0, 2)
        .map(function (r) { return r.product; });

      var payments = mockPaymentOptions();
      var bestPayment = global.PolicyEngine.optimizePayment(chosen, payments);

      /* Preferred path: Dat's frozen engine via policy/server.py.
         Offline fallback: local mirror (policy-engine.js), flagged in audit. */
      return decide(mandate, chosen, bestPayment).then(function (outcome) {
        var decision = outcome.decision;
        var audit = decision.audit.concat([{
          timestamp: decision.audit.length ? decision.audit[decision.audit.length - 1].timestamp : "",
          event: outcome.live ? "Decision by Dat's frozen policy engine"
                              : "Decision by local policy mirror (engine offline)",
          rule: "integration",
          result: outcome.live ? "live" : "fallback"
        }]);
        return buildPipelineResult(scenarioKey, mandate, products, ranked, chosen, alternatives, payments, bestPayment, decision, audit);
      });
    });
  }

  function decide(mandate, product, payment) {
    if (!global.ApiClient) {
      return Promise.resolve({ live: false, decision: global.PolicyEngine.evaluate(mandate, product, payment) });
    }
    return global.ApiClient.evaluatePolicy(mandate, product, payment).then(function (remote) {
      if (!remote || !remote.status) throw new Error("bad policy response");
      /* Keep the UI's check breakdown from the local mirror — the frozen
         Decision schema has no per-rule list, so we render ours. */
      var local = global.PolicyEngine.evaluate(mandate, product, payment);
      return {
        live: true,
        decision: {
          status: remote.status,
          product_id: remote.product_id || product.id,
          final_total: typeof remote.final_total === "number" ? remote.final_total : local.final_total,
          reason: remote.reason && remote.reason.length ? remote.reason : local.reason,
          checks: local.checks,
          audit: (remote.audit && remote.audit.length ? remote.audit : local.audit),
          effective_cost: local.effective_cost,
          chosen_payment: payment
        }
      };
    }, function () {
      return { live: false, decision: global.PolicyEngine.evaluate(mandate, product, payment) };
    });
  }

  function buildPipelineResult(scenarioKey, mandate, products, ranked, chosen, alternatives, payments, bestPayment, decision, audit) {
    return {
      scenario: scenarioKey,
      mandate: mandate,
      candidates: [chosen].concat(alternatives).map(function (p) {
        var pay = global.PolicyEngine.optimizePayment(p, payments);
        return {
          product: p,
          payment: pay,
          final_total: p.price + p.shipping + pay.fee,
          effective_cost: p.price + p.shipping + pay.fee - pay.reward_value,
          chosen: p.id === chosen.id
        };
      }),
      chosenReason: buildChosenReason(scenarioKey, chosen, bestPayment),
      paymentOptions: payments,
      bestPayment: bestPayment,
      decision: decision,
      audit: audit
    };
  }

  function buildChosenReason(scenarioKey, product, payment) {
    var total = product.price + product.shipping + payment.fee;
    var eff = total - payment.reward_value;
    if (scenarioKey === "success") {
      return "Best effective cost among trusted merchants: HK$" + total +
        " total − HK$" + payment.reward_value + " " + payment.name +
        " rewards = HK$" + eff + ". Inside every mandate limit, so no approval needed.";
    }
    if (scenarioKey === "approval") {
      return "Best value pick at HK$" + total + " (effective HK$" + eff +
        "), but it sits above your HK$750 auto-approval threshold — so GuardCart asks you first instead of spending silently.";
    }
    return "Lowest effective price for a waterproof trail shoe (HK$" + eff +
      " with " + payment.name + "), but the HK$90 overseas shipping pushes the total to HK$" + total +
      " — above your HK$800 hard limit. The policy engine stops it even though the AI liked it.";
  }

  /* ---------------- Public mock API (swap these for fetch() later) ---------------- */

  global.MockAPI = {
    mockMandate: mockMandate,
    mockProducts: mockProducts,
    mockPaymentOptions: mockPaymentOptions,
    mockAgentSteps: mockAgentSteps,
    mockRunAgent: mockRunAgent
    /* Integration targets:
       POST /api/mandate     -> Zheng's intent parser
       GET  /api/products    -> Zheng's catalogue
       POST /api/evaluate    -> Dat's policy engine
       GET  /api/audit       -> Dat's audit log                                        */
  };
})(window);
