/* ============================================================
   GuardCart — App controller (Editorial Calm)
   Screen router + demo flow orchestration + all renderers.
   Talks ONLY to window.MockAPI — integration later means
   editing mock-api.js only.
   ============================================================ */

(function (global) {
  "use strict";

  var SCREENS = ["mandate", "progress", "comparison", "policy", "decision", "audit"];

  var AppState = {
    mandate: null,
    scenario: null,
    result: null,
    userDecision: null
  };

  /* ------------------------------ helpers ------------------------------ */

  function $(id) { return document.getElementById(id); }

  function esc(str) {
    return String(str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function hkd(n) { return "HK$" + n; }

  function nowTime() {
    var d = new Date();
    function pad(n) { return String(n).padStart(2, "0"); }
    return pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  /* ------------------------- data source indicator ------------------------- */

  function setDataSourceTag(source) {
    var el = $("data-source-tag");
    if (!el) return;
    if (source === "live") {
      el.className = "tag tag-live";
      el.textContent = "DATA / LIVE";
    } else if (source === "mock") {
      el.className = "tag tag-muted";
      el.textContent = "DATA / MOCK";
    } else {
      el.className = "tag";
      el.textContent = "DATA / STATIC";
    }
  }

  /* ------------------------------ mascot ------------------------------ */

  var MASCOT = {
    idle:    { closed: false, arm: [62, 60],     tip: [62, 60],     eye: '<circle cx="45" cy="45" r="6" fill="var(--ink)"/>' },
    approve: { closed: false, arm: [72, 36],     tip: [72, 36],     eye: '<ellipse cx="45" cy="45" rx="6" ry="3" fill="var(--ink)"/>' },
    ask:     { closed: false, arm: [64.5, 47.3], tip: [64.5, 47.3], eye: '<circle cx="47.1" cy="47.1" r="6" fill="var(--ink)"/>' },
    block:   { closed: true,  arm: [62, 60],     tip: [62, 60],     eye: '<circle cx="45" cy="45" r="6" fill="var(--ink)"/>' }
  };

  function mascotSVG(pose, size) {
    var p = MASCOT[pose] || MASCOT.idle;
    var ring = p.closed
      ? '<circle cx="60" cy="60" r="36" fill="none" stroke="var(--ink)" stroke-width="16"/>'
      : '<path d="M 96 60 A 36 36 0 1 1 78 28.8" fill="none" stroke="var(--ink)" stroke-width="16" stroke-linecap="round"/>';
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 120 120" aria-hidden="true">' +
      ring +
      '<line x1="96" y1="60" x2="' + p.arm[0] + '" y2="' + p.arm[1] + '" stroke="var(--ink)" stroke-width="16" stroke-linecap="round"/>' +
      '<circle cx="' + p.tip[0] + '" cy="' + p.tip[1] + '" r="5" fill="var(--brand)"/>' +
      p.eye +
      "</svg>";
  }

  /* ------------------------------ theme ------------------------------ */

  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem("gc-theme"); } catch (e) { saved = null; }
    if (saved === "dark") document.documentElement.setAttribute("data-theme", "dark");
    updateThemeButton();
  }

  function toggleTheme() {
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    if (dark) document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", "dark");
    try { localStorage.setItem("gc-theme", dark ? "light" : "dark"); } catch (e) {}
    updateThemeButton();
  }

  function updateThemeButton() {
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    $("theme-toggle").textContent = dark ? "Light mode" : "Dark mode";
  }

  /* ------------------------------ router ------------------------------ */

  function goTo(screen) {
    SCREENS.forEach(function (s) {
      var el = $("screen-" + s);
      if (el) el.classList.toggle("active", s === screen);
    });

    var items = document.querySelectorAll("#gc-steps li");
    var activeIndex = SCREENS.indexOf(screen);
    items.forEach(function (li) {
      var idx = SCREENS.indexOf(li.getAttribute("data-step"));
      li.classList.toggle("current", idx === activeIndex);
      li.classList.toggle("done", idx > -1 && idx < activeIndex);
    });

    if (screen === "policy") renderPolicy();
    if (screen === "decision") renderDecision();
    if (screen === "audit") renderAudit();

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ------------------------------ mandate form ------------------------------ */

  function readMandateFromForm() {
    var errorBox = $("mandate-form-error");
    errorBox.style.display = "none";

    var request = $("mandate-request").value.trim();
    var maxSpend = Number($("mandate-max-spend").value);
    var threshold = Number($("mandate-approval-threshold").value);
    var maxPoints = Number($("mandate-max-points").value);
    var expiryLocal = $("mandate-expiry").value;
    var trustedOnly = $("mandate-trusted-only").checked;

    var errors = [];
    if (!request) errors.push("Please tell GuardCart what to buy.");
    if (!maxSpend || maxSpend <= 0) errors.push("Maximum spend must be a positive number.");
    if (threshold < 0) errors.push("Approval threshold cannot be negative.");
    if (threshold > maxSpend) errors.push("Approval threshold should not be higher than maximum spend.");
    if (maxPoints < 0) errors.push("Maximum points cannot be negative.");
    if (!expiryLocal) errors.push("Please set a mandate expiry.");
    else if (new Date(expiryLocal).getTime() < Date.now()) errors.push("Mandate expiry is in the past. Pick a future time.");

    if (errors.length) {
      errorBox.innerHTML = '<i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>' +
        '<span><strong>Cannot start agent.</strong><ul class="mb-0"><li>' +
        errors.map(esc).join("</li><li>") + "</li></ul></span>";
      errorBox.style.display = "flex";
      return null;
    }

    return {
      request: request,
      category: "running_shoes",
      max_spend: maxSpend,
      approval_threshold: threshold,
      max_points: maxPoints,
      trusted_merchants_only: trustedOnly,
      expiry: new Date(expiryLocal).toISOString()
    };
  }

  /* ------------------------------ demo flow ------------------------------ */

  function runDemo(scenarioKey) {
    runPipeline(function () {
      return global.AgentData.runFixture(scenarioKey, null);
    });
  }

  function startFromForm() {
    var mandate = readMandateFromForm();
    if (!mandate) return;
    runPipeline(function () {
      return global.AgentData.runStaticAgent(mandate);
    });
  }

  /** "Live API Test (local only)" button — real POST to agent/server.py. */
  function runLiveApi(btn) {
    var statusEl = $("live-status");
    statusEl.className = "live-status";
    statusEl.textContent = "Requesting " + global.AgentData.LIVE_URL + " …";
    btn.disabled = true;
    var originalLabel = btn.innerHTML;
    btn.innerHTML = '<span class="dot dot-live dot-pulse"></span>Requesting Live API…';

    runPipeline(
      function () { return global.AgentData.runLive(); },
      function (err) {
        btn.disabled = false;
        btn.innerHTML = originalLabel;
        statusEl.className = "live-status is-error";
        statusEl.textContent = "Live API connection failed (" + ((err && err.message) || err) +
          "). Start agent/server.py from the project root on port 8001, then try again.";
      },
      function () {
        btn.disabled = false;
        btn.innerHTML = originalLabel;
        statusEl.className = "live-status is-ok";
        statusEl.textContent = "Live response rendered from " + global.AgentData.LIVE_URL;
      }
    );
  }

  /**
   * Generic pipeline: progress animation runs in parallel with the data job
   * (live fetch can take longer than the animation). The job resolves to
   * { result, source } where source is live | static | mock.
   */
  function runPipeline(jobFactory, onError, onSuccess) {
    AppState.mandate = null;
    AppState.scenario = null;
    AppState.result = null;
    AppState.userDecision = null;

    goTo("progress");
    var jobP = jobFactory();
    Promise.all([animateAgentSteps(), jobP]).then(function (pair) {
      var out = pair[1];
      AppState.result = out.result;
      setDataSourceTag(out.source);
      renderComparison();
      goTo("comparison");
      if (onSuccess) onSuccess(out.source);
    }).catch(function (err) {
      goTo("mandate");
      if (onError) onError(err);
    });
  }

  function animateAgentSteps() {
    var steps = global.MockAPI.mockAgentSteps();
    $("agent-steps").innerHTML = steps.map(function (s, i) {
      return '<li id="agent-step-' + i + '">' +
        '<span class="ic"><i class="fa-solid ' + s.icon + '" aria-hidden="true"></i></span>' +
        "<span>" + esc(s.text) + "</span>" +
        '<span class="state"></span>' +
        "</li>";
    }).join("");

    var chain = Promise.resolve();
    steps.forEach(function (_, i) {
      chain = chain.then(function () {
        var li = $("agent-step-" + i);
        li.classList.add("running");
        li.querySelector(".state").innerHTML = '<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>';
        return sleep(700);
      }).then(function () {
        var li = $("agent-step-" + i);
        li.classList.remove("running");
        li.classList.add("finished");
        li.querySelector(".state").innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i>';
      });
    });
    return chain.then(function () { return sleep(350); });
  }

  /* ------------------------------ render: comparison ------------------------------ */

  function renderComparison() {
    var r = AppState.result;
    if (!r) return;

    $("comparison-cards").innerHTML = r.candidates.map(function (c) {
      var p = c.product;
      var trust;
      if (c.disqualified && /category/i.test(c.disqualify_reason || "")) {
        trust = '<span class="tag tag-warning">Outside mandate</span>';
      } else if (p.trusted) {
        trust = '<span class="tag tag-success">Trusted</span>';
      } else {
        trust = '<span class="tag tag-error">Not trusted</span>';
      }
      var rows;
      if (c.disqualified) {
        /* Agent disqualified this candidate before ranking (untrusted merchant
           or category mismatch) — never show the sentinel effective cost. */
        rows = priceRow("Price", hkd(p.price)) +
          priceRow("Shipping", hkd(p.shipping)) +
          '<div class="price-total price-total-na"><span>' + esc(c.disqualify_reason || "Disqualified") +
          '</span><span class="num">—</span></div>';
      } else {
        rows = priceRow("Price", hkd(p.price)) +
          priceRow("Shipping", hkd(p.shipping)) +
          priceRow("Payment fee (" + esc(c.payment.name) + ")", hkd(c.payment.fee)) +
          priceRow("Rewards earned", "−" + hkd(c.payment.reward_value)) +
          '<div class="price-total"><span>Effective cost</span><span class="num">' + hkd(c.effective_cost) + "</span></div>";
      }
      return '<div class="card product-card' + (c.chosen ? " recommended" : "") + (c.disqualified ? " disqualified" : "") + '">' +
        '<div class="p-head"><h3>' + esc(p.name) + "</h3>" +
        (c.chosen ? '<span class="tag tag-accent">Recommended</span>' : '<span class="p-id">' + esc(p.id) + "</span>") + "</div>" +
        '<p class="p-desc">' + esc(p.description) + "</p>" +
        '<div class="p-merchant"><span>' + esc(p.merchant) + "</span>" + trust + "</div>" +
        '<div class="price-rows">' + rows + "</div>" +
        (c.chosen ? '<div class="reco-reason">' + esc(r.chosenReason) + "</div>" : "") +
        "</div>";
    }).join("");

    function priceRow(k, v) {
      return '<div class="price-row"><span>' + k + "</span><strong>" + v + "</strong></div>";
    }
  }

  /* ------------------------------ render: policy ------------------------------ */

  function renderPolicy() {
    var r = AppState.result;
    if (!r) return;
    var m = r.mandate;
    var chosen = r.candidates.find(function (c) { return c.chosen; });

    $("policy-zones").innerHTML =
      zone("AI recommends", "<strong>" + esc(chosen.product.name) + "</strong> at " + hkd(chosen.final_total) +
        " via " + esc(r.bestPayment.name) + ", effective " + hkd(chosen.effective_cost) + ".") +
      zone("You authorized", "Max <strong>" + hkd(m.max_spend) + "</strong>, auto-approve up to <strong>" + hkd(m.approval_threshold) +
        "</strong>, " + (m.trusted_merchants_only ? "trusted merchants only" : "any merchant") + ", at most " + m.max_points + " points.") +
      zone("The system allows", "Decided by <strong>deterministic rules</strong>, never by the language model. It cannot be talked into spending more.");

    $("policy-checks").innerHTML = r.decision.checks.map(function (c) {
      var cls = c.level === "ask" ? "ask" : (c.passed ? "pass" : "fail");
      var icon = c.level === "ask" ? "fa-question" : (c.passed ? "fa-check" : "fa-xmark");
      var word = c.level === "ask" ? "Ask" : (c.passed ? "Pass" : "Fail");
      return '<li class="check-item ' + cls + '">' +
        '<span class="ci"><i class="fa-solid ' + icon + '" aria-hidden="true"></i></span>' +
        "<span><span class=\"cn\">" + esc(c.label) + "</span><br />" +
        '<span class="cd">' + esc(c.detail) + "</span></span>" +
        '<span class="cr">' + word + "</span>" +
        "</li>";
    }).join("");

    function zone(title, body) {
      return '<div class="card zone"><h3>' + title + "</h3><p>" + body + "</p></div>";
    }
  }

  /* ------------------------------ render: decision ------------------------------ */

  function renderDecision() {
    var r = AppState.result;
    if (!r) return;
    var d = r.decision;
    var chosen = r.candidates.find(function (c) { return c.chosen; });
    var p = chosen.product;
    var status = AppState.userDecision || d.status;

    var cfg;
    if (status === "APPROVE") {
      cfg = { pose: "approve", cls: "decision-approve", tag: '<span class="tag tag-success">Approved</span>',
        title: "Transaction approved",
        sub: "Inside every limit of your mandate, so it was executed automatically.",
        note: "Paid with " + esc(r.bestPayment.name) + " and earned " + hkd(r.bestPayment.reward_value) + " in rewards. Demo payment — no real charge." };
    } else if (status === "APPROVED_BY_USER") {
      cfg = { pose: "approve", cls: "decision-approve", tag: '<span class="tag tag-success">Approved by you</span>',
        title: "Approved by you",
        sub: "The agent waited for your explicit consent before spending anything.",
        note: "Paid with " + esc(r.bestPayment.name) + " after your approval. Demo payment — no real charge." };
    } else if (status === "REJECTED_BY_USER") {
      cfg = { pose: "block", cls: "decision-block", tag: '<span class="tag">Declined by you</span>',
        title: "Purchase declined",
        sub: "No money moved. Your mandate stays active for the next request.",
        note: "Your authority outranks the AI — always." };
    } else if (status === "ASK") {
      cfg = { pose: "ask", cls: "decision-ask", tag: '<span class="tag tag-warning">Needs approval</span>',
        title: "Your approval needed",
        sub: "Inside your budget but above your auto-approval threshold of " + hkd(r.mandate.approval_threshold) + ".",
        note: "Nothing was charged. The agent cannot spend past this point without you.",
        actions: true };
    } else {
      cfg = { pose: "block", cls: "decision-block", tag: '<span class="tag tag-error">Blocked</span>',
        title: "Transaction blocked",
        sub: d.reason.map(esc).join(" "),
        note: "Best payment option identified, but transaction was not executed." };
    }

    $("decision-banner").innerHTML =
      '<div class="decision ' + cfg.cls + '">' +
        '<span class="mascot">' + mascotSVG(cfg.pose, 48) + "</span>" +
        '<div class="d-main">' +
          cfg.tag +
          '<h2 class="d-title">' + cfg.title + "</h2>" +
          '<p class="d-sub">' + cfg.sub + "</p>" +
          (cfg.actions ?
            '<div class="decision-actions">' +
              '<button class="btn btn-primary" type="button" onclick="GuardCartApp.userApprove()">Approve ' + hkd(d.final_total) + "</button>" +
              '<button class="btn btn-ghost" type="button" onclick="GuardCartApp.userReject()">Decline</button>' +
            "</div>" : "") +
          '<div class="d-note">' + cfg.note + "</div>" +
        "</div>" +
        '<div class="d-num"><div class="big">' + hkd(d.final_total) + '</div><div class="cap">final total</div></div>' +
      "</div>";

    $("decision-stats").innerHTML =
      stat(hkd(d.final_total), "Final total") +
      stat(hkd(r.mandate.max_spend), "Maximum spend") +
      stat(hkd(r.mandate.approval_threshold), "Auto-approve up to") +
      stat(hkd(chosen.effective_cost), "Effective cost");

    $("decision-payments").innerHTML = r.paymentOptions.map(function (pay) {
      var cost = p.price + p.shipping + pay.fee - pay.reward_value;
      var best = pay.name === r.bestPayment.name;
      return '<div class="pay-row' + (best ? " best" : "") + '">' +
        '<span><span class="pn">' + esc(pay.name) + "</span><br />" +
        '<span class="pm">fee ' + hkd(pay.fee) + ", rewards " + hkd(pay.reward_value) + (best ? ", best option" : "") + "</span></span>" +
        '<span class="pc">' + hkd(cost) + "</span>" +
        "</div>";
    }).join("");

    function stat(v, k) {
      return '<div class="stat"><div class="v">' + v + '</div><div class="k">' + k + "</div></div>";
    }
  }

  /* ------------------------------ user consent ------------------------------ */

  function userApprove() {
    AppState.userDecision = "APPROVED_BY_USER";
    AppState.result.audit.push(
      { timestamp: nowTime(), event: "User approved via app", rule: "approval.consent", result: "consent granted" },
      { timestamp: nowTime(), event: "TRANSACTION APPROVED", rule: "payment.simulated", result: "Demo payment data — no real charge" }
    );
    renderDecision();
  }

  function userReject() {
    AppState.userDecision = "REJECTED_BY_USER";
    AppState.result.audit.push(
      { timestamp: nowTime(), event: "User declined purchase", rule: "approval.consent", result: "consent refused — no charge" }
    );
    renderDecision();
  }

  /* ------------------------------ render: audit ------------------------------ */

  function renderAudit() {
    var r = AppState.result;
    var timeline = $("audit-timeline");
    var empty = $("audit-empty");

    if (!r || !r.audit.length) {
      timeline.innerHTML = "";
      empty.style.display = "block";
      return;
    }
    empty.style.display = "none";

    timeline.innerHTML = r.audit.map(function (e) {
      var cls = "";
      if (/BLOCK|fail|EXPIRED|not trusted|exceeds/i.test(e.result)) cls = "no";
      else if (/ASK|WAITING|threshold|consent/i.test(e.result)) cls = "maybe";
      else if (/APPROV|valid|match|confirmed|satisfied|within|granted|PASS/i.test(e.result)) cls = "ok";
      return '<div class="tl-item ' + cls + '">' +
        '<div class="tl-time">' + esc(e.timestamp) + ", " + esc(e.rule) + "</div>" +
        '<div class="tl-event">' + esc(e.event) + "</div>" +
        '<div class="tl-result">' + esc(e.result) + "</div>" +
        "</div>";
    }).join("");
  }

  /* ------------------------------ reset & init ------------------------------ */

  function resetDemo() {
    AppState.mandate = null;
    AppState.scenario = null;
    AppState.result = null;
    AppState.userDecision = null;
    var liveStatus = $("live-status");
    if (liveStatus) { liveStatus.textContent = ""; liveStatus.className = "live-status"; }
    if (global.AgentData) {
      global.AgentData.probeSource().then(function (source) {
        setDataSourceTag(source === "static" ? "static" : "mock");
      }).catch(function () { setDataSourceTag("mock"); });
    } else {
      setDataSourceTag("mock");
    }
    goTo("mandate");
  }

  function init() {
    $("brand-mascot").innerHTML = mascotSVG("idle", 28);
    $("topbar-avatar").innerHTML = mascotSVG("idle", 26);
    $("audit-empty-mascot").innerHTML = mascotSVG("idle", 96);
    $("theme-toggle").addEventListener("click", toggleTheme);
    if (!global.matchMedia || !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.body.classList.add("motion-ok");
    }
    initTheme();

    /* Probe whether the teammate static JSON is reachable and set the
       DATA / STATIC vs DATA / MOCK tag accordingly (tag flips to LIVE on
       a successful Live API call). */
    if (global.AgentData) {
      global.AgentData.probeSource().then(function (source) {
        setDataSourceTag(source === "static" ? "static" : "mock");
      }).catch(function () { setDataSourceTag("mock"); });
    } else {
      setDataSourceTag("mock");
    }
  }

  init();

  global.GuardCartApp = {
    goTo: goTo,
    runDemo: runDemo,
    startFromForm: startFromForm,
    runLiveApi: runLiveApi,
    resetDemo: resetDemo,
    userApprove: userApprove,
    userReject: userReject
  };
})(window);
