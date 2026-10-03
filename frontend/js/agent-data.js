/* ============================================================
   GuardCart — Teammate data layer (Zheng's agent + Dat's policy)

   Data sources, in priority order:
     1. LIVE  : POST http://127.0.0.1:8001/api/agent/recommend
                (agent/server.py, FastAPI — returns the merged object
                 including policy_evaluation from Dat's real engine)
     2. STATIC: agent/agent-output.json + agent/demo-fixtures.json
                served by a static web server rooted at the PROJECT ROOT
                (open http://localhost:8899/frontend/index.html).
                agent-output.json is the agent-stage artifact and has NO
                policy_evaluation, so for STATIC runs the frozen rules are
                evaluated client-side by the local mirror (policy-engine.js).
     3. MOCK  : the original embedded demo data (demo-data.js) — used only
                when the static JSON cannot be fetched, so the page never
                whitescreens.

   Everything in this file is READ-ONLY with respect to agent/ and policy/.
   It normalises the teammates' JSON into the pipeline-result shape that
   js/app.js renderers already understand.
   ============================================================ */

(function (global) {
  "use strict";

  var LIVE_URL = "http://127.0.0.1:8001/api/agent/recommend";
  var LIVE_PROMPT = "Buy me running shoes under HK$800. Trusted merchants only. Ask me before paying above HK$750.";

  /* Static files may be reached via either layout:
     - server rooted at repo root, page at /frontend/index.html -> "../agent/x"
     - server rooted with frontend mapped under / (dev)          -> "agent/x"   */
  var AGENT_OUTPUT_CANDIDATES = ["../agent/agent-output.json", "agent/agent-output.json"];
  var FIXTURES_CANDIDATES = ["../agent/demo-fixtures.json", "agent/demo-fixtures.json"];

  var FIXTURE_KEY_BY_SCENARIO = {
    success: "approve_729",
    approval: "ask_770",
    blocked: "block_820"
  };

  var cache = { probed: false, source: null, output: null, fixtures: null };

  function nowTime() {
    var d = new Date();
    function pad(n) { return String(n).padStart(2, "0"); }
    return pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  }

  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  /* ------------------------------ fetching ------------------------------ */

  function fetchFirst(candidates) {
    /* Try each candidate path in order; first good JSON wins. */
    var attempt = Promise.reject(new Error("no candidates"));
    candidates.forEach(function (url) {
      attempt = attempt.catch(function () {
        return fetch(url, { cache: "no-store" }).then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status + " for " + url);
          return res.json();
        });
      });
    });
    return attempt;
  }

  function probeSource() {
    if (cache.probed) {
      return Promise.resolve(cache.source);
    }
    cache.probed = true;
    return Promise.all([
      fetchFirst(AGENT_OUTPUT_CANDIDATES).catch(function () { return null; }),
      fetchFirst(FIXTURES_CANDIDATES).catch(function () { return null; })
    ]).then(function (pair) {
      cache.output = pair[0];
      cache.fixtures = pair[1];
      cache.source = cache.output ? "static" : "mock";
      return cache.source;
    });
  }

  /* ------------------------- live: Zheng FastAPI ------------------------- */

  function runLive() {
    return fetch(LIVE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: LIVE_PROMPT })
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }).then(function (resp) {
      if (!resp || !resp.policy_evaluation || !resp.policy_evaluation.decision) {
        throw new Error("response is missing policy_evaluation.decision");
      }
      return { result: normaliseLive(resp), source: "live" };
    });
  }

  /* ------------- static: agent-output.json + local policy mirror ------------- */

  function runStaticAgent(formMandate) {
    return probeSource().then(function (source) {
      if (source !== "static" || !cache.output) {
        return global.MockAPI.mockRunAgent("success", formMandate).then(function (result) {
          return { result: result, source: "mock" };
        });
      }
      var out = cache.output;
      var mandate = formMandate || out.mandate;
      var payments = (out.policy_input && out.policy_input.payment_options) || [out.selected_payment];
      var best = global.PolicyEngine.optimizePayment(out.selected_product, payments);
      var decision = global.PolicyEngine.evaluate(mandate, out.selected_product, best);
      var audit = decision.audit.slice();
      if (out.defense_audit) {
        audit.push({ timestamp: nowTime(), event: "Prompt injection defense", rule: "agent.defense", result: out.defense_audit });
      }
      audit.push({ timestamp: nowTime(), event: "Static agent output + local policy mirror", rule: "integration", result: "static" });
      return {
        result: buildResult({
          scenario: "static-agent",
          mandate: mandate,
          product: out.selected_product,
          payments: payments,
          bestPayment: best,
          decision: decision,
          audit: audit,
          chosenReason: out.explanation || ("Selected " + out.selected_product.name + "."),
          candidates: buildCandidates(out.considered_candidates || [], out.selected_product)
        }),
        source: "static"
      };
    });
  }

  /* ------------- static: demo-fixtures.json (3 fixed scenarios) ------------- */

  function runFixture(scenarioKey, formMandate) {
    return probeSource().then(function (source) {
      var fixtureKey = FIXTURE_KEY_BY_SCENARIO[scenarioKey];
      if (source !== "static" || !cache.fixtures || !cache.fixtures[fixtureKey]) {
        return global.MockAPI.mockRunAgent(scenarioKey, formMandate || global.MockAPI.mockMandate()).then(function (result) {
          return { result: result, source: "mock" };
        });
      }
      var fx = cache.fixtures[fixtureKey];
      var best = global.PolicyEngine.optimizePayment(fx.product, fx.payment_options);
      var decision = global.PolicyEngine.evaluate(fx.mandate, fx.product, best);
      var audit = decision.audit.slice();
      audit.push({
        timestamp: nowTime(),
        event: "Static fixture " + fixtureKey + " + local policy mirror",
        rule: "integration",
        result: "static"
      });
      return {
        result: buildResult({
          scenario: scenarioKey,
          mandate: fx.mandate,
          product: fx.product,
          payments: fx.payment_options,
          bestPayment: best,
          decision: decision,
          audit: audit,
          chosenReason: fixtureReason(fixtureKey, fx.product, best, decision.final_total),
          candidates: [{
            product: fx.product,
            payment: best,
            final_total: decision.final_total,
            effective_cost: decision.effective_cost,
            chosen: true,
            disqualified: false,
            disqualify_reason: null
          }]
        }),
        source: "static"
      };
    });
  }

  function fixtureReason(key, product, payment, total) {
    var eff = total - payment.reward_value;
    if (key === "approve_729") {
      return product.name + " totals HK$" + total + " with " + payment.name +
        "; HK$" + payment.reward_value + " rewards bring the effective cost to HK$" + eff +
        ". Inside every mandate limit, so no approval is needed.";
    }
    if (key === "ask_770") {
      return product.name + " at HK$" + total + " (effective HK$" + eff +
        ") is over the HK$750 auto-approval threshold but inside the HK$800 cap — GuardCart asks you first instead of spending silently.";
    }
    return product.name + " totals HK$" + total + ", over the HK$800 hard limit. " +
      "The policy engine blocks it even though the merchant is trusted — best payment option identified, but the transaction is not executed.";
  }

  /* ------------------------------ normalisers ------------------------------ */

  function buildCandidates(considered, selectedProduct) {
    return considered.map(function (c) {
      var product = c.product;
      var payment = c.selected_payment || { name: "—", fee: 0, reward_value: 0 };
      var disqualified = c.match_status && c.match_status !== "MATCHED";
      var rawTotal = product.price + product.shipping + (payment.fee || 0);
      return {
        product: product,
        payment: payment,
        final_total: rawTotal,
        effective_cost: disqualified ? null : c.effective_cost,
        chosen: selectedProduct && product.id === selectedProduct.id,
        disqualified: !!disqualified,
        disqualify_reason: c.disqualify_reason || null
      };
    });
  }

  function buildResult(spec) {
    spec.decision.audit = spec.audit;
    return {
      scenario: spec.scenario,
      source: "static",
      mandate: spec.mandate,
      candidates: spec.candidates,
      chosenReason: spec.chosenReason,
      paymentOptions: spec.payments,
      bestPayment: spec.bestPayment,
      decision: spec.decision,
      audit: spec.audit
    };
  }

  /**
   * Normalise the LIVE response from agent/server.py:
   *   agent fields + policy_evaluation {decision, selected_payment,
   *   payment_ranking, audit_events[]} from Dat's real engine.
   */
  function normaliseLive(resp) {
    var pe = resp.policy_evaluation;
    var status = pe.decision.status;
    var payments = (pe.payment_ranking && pe.payment_ranking.length)
      ? pe.payment_ranking
      : (resp.policy_input && resp.policy_input.payment_options) || [];
    var bestPayment = pe.selected_payment ||
      (payments.length ? payments[0] : (resp.selected_payment || { name: "—", fee: 0, reward_value: 0 }));
    var finalTotal = typeof pe.decision.final_total === "number" ? pe.decision.final_total
      : (bestPayment.charged_total != null ? bestPayment.charged_total
        : resp.selected_product.price + resp.selected_product.shipping + (bestPayment.fee || 0));
    var effectiveCost = bestPayment.effective_cost != null ? bestPayment.effective_cost
      : finalTotal - (bestPayment.reward_value || 0);

    var audit = (pe.audit_events || []).map(function (e) {
      var result = e.result;
      /* Make the ASK row visibly an ask rather than a hard fail. */
      if (status === "ASK" && result === "FAIL" && /approval/i.test(e.rule || e.event || "")) {
        result = "ASK — human approval required";
      }
      return {
        timestamp: e.timestamp || "",
        event: e.event || "",
        rule: e.rule || "",
        result: result || ""
      };
    });
    if (resp.defense_audit) {
      audit.push({ timestamp: nowTime(), event: "Prompt injection defense", rule: "agent.defense", result: resp.defense_audit });
    }
    audit.push({ timestamp: nowTime(), event: "Decision by Dat's policy engine via Live API", rule: "integration", result: "live" });

    var decision = {
      status: status,
      product_id: pe.decision.product_id || resp.selected_product.id,
      final_total: finalTotal,
      reason: pe.decision.reason || [],
      checks: checksFromAudit(pe.audit_events || [], status),
      audit: audit,
      effective_cost: effectiveCost,
      chosen_payment: bestPayment
    };

    return {
      scenario: "live",
      source: "live",
      mandate: resp.mandate,
      candidates: buildCandidates(resp.considered_candidates || [], resp.selected_product),
      chosenReason: resp.explanation || ("Selected " + resp.selected_product.name + "."),
      paymentOptions: payments,
      bestPayment: bestPayment,
      decision: decision,
      audit: audit
    };
  }

  /**
   * The frozen Decision schema has no per-rule list. For LIVE runs we derive
   * the policy-screen checklist directly from the engine's audit_events.
   */
  function checksFromAudit(events, status) {
    return events.map(function (e) {
      var isApprovalRow = /approval/i.test(e.rule || e.event || "");
      var passed = e.result === "PASS";
      var level = "pass";
      if (!passed) {
        if (isApprovalRow && status === "ASK") level = "ask";
        else level = "fail";
      }
      return {
        key: e.rule || e.event,
        label: e.event || e.rule,
        passed: passed,
        detail: e.rule + (e.result ? " · " + e.result : ""),
        level: level
      };
    });
  }

  global.AgentData = {
    LIVE_URL: LIVE_URL,
    LIVE_PROMPT: LIVE_PROMPT,
    probeSource: probeSource,
    runLive: function () { return delay(1).then(runLive); },
    runStaticAgent: runStaticAgent,
    runFixture: runFixture
  };
})(window);
