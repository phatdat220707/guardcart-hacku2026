/* ============================================================
   GuardCart — API client (live backends)
   Currently: Dat's frozen policy engine via policy/server.py.
   Used by mock-api.js as the preferred path; the local mirror
   in policy-engine.js remains the offline fallback.
   ============================================================ */

(function (global) {
  "use strict";

  var POLICY_URL = "http://127.0.0.1:8001";
  var TIMEOUT_MS = 2500;

  function postJSON(url, body) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal
    }).then(function (res) {
      clearTimeout(timer);
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }, function (err) {
      clearTimeout(timer);
      throw err;
    });
  }

  /** POST /evaluate -> Decision + audit (shared/schemas.md fields). */
  function evaluatePolicy(mandate, product, paymentOption) {
    return postJSON(POLICY_URL + "/evaluate", {
      mandate: mandate,
      product: product,
      payment_option: paymentOption
    });
  }

  global.ApiClient = { evaluatePolicy: evaluatePolicy };
})(window);
