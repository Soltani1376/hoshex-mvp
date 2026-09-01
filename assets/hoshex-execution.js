(function () {
  "use strict";

  var STORAGE_KEY = "hx_business_journey_v1";
  var preparing = false;

  function esc(value) {
    if (window.hxEscape) return window.hxEscape(value);
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function now() { return new Date().toISOString(); }
  function id(prefix) { return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7); }

  function readJourney() {
    if (window.hxJourneyRead) return window.hxJourneyRead();
    try {
      var value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
      return value && Array.isArray(value.cycles) ? value : null;
    } catch (error) { return null; }
  }

  function currentCycle(journey) {
    if (!journey || !Array.isArray(journey.cycles) || !journey.cycles.length) return null;
    return journey.cycles.find(function (cycle) { return cycle.id === journey.currentCycleId; }) || journey.cycles[journey.cycles.length - 1];
  }

  function writeJourney(journey) {
    if (!journey) return;
    journey.updatedAt = now();
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(journey)); } catch (error) {}
  }

  function addDays(days) {
    var date = new Date();
    date.setDate(date.getDate() + Math.max(1, Math.min(7, Number(days) || 2)));
    return date.toISOString();
  }

  function formatDate(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return "به‌زودی";
    try {
      return new Intl.DateTimeFormat("fa-IR-u-ca-gregory", { day: "numeric", month: "long" }).format(date);
    } catch (error) {
      return date.toISOString().slice(0, 10);
    }
  }

  function copyText(value) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(value);
    return new Promise(function (resolve, reject) {
      var area = document.createElement("textarea");
      area.value = value;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try { document.execCommand("copy"); resolve(); } catch (error) { reject(error); }
      area.remove();
    });
  }

  function installScreen() {
    var main = document.querySelector("main");
    if (!main || document.getElementById("screen-execution")) return;
    var section = document.createElement("section");
    section.className = "hx-screen";
    section.id = "screen-execution";
    section.hidden = true;
    section.setAttribute("aria-labelledby", "execution-title");
    section.innerHTML = '<div class="hx-panel hx-execution-panel"><div id="execution-content"></div></div>';
    main.appendChild(section);
  }

  function showOnly(name) {
    document.querySelectorAll(".hx-screen").forEach(function (screen) { screen.hidden = screen.id !== "screen-" + name; });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderLoading(cycle) {
    var target = document.getElementById("execution-content");
    if (!target) return;
    target.innerHTML = [
      '<div class="hx-execution-loading">',
        '<div class="hx-execution-pulse" aria-hidden="true"><span></span></div>',
        '<p class="hx-kicker">Execution Assistant</p>',
        '<h2 id="execution-title">دارم کار رو برات آماده می‌کنم.</h2>',
        '<p>بر اساس همین اقدام: <strong>' + esc(cycle && cycle.action && cycle.action.title || "کار فعلی") + '</strong></p>',
        '<small>فقط یک خروجی آماده‌ی اجرا؛ بدون لیست اضافه.</small>',
      '</div>'
    ].join("");
  }

  function renderExecution(journey, cycle) {
    var target = document.getElementById("execution-content");
    if (!target || !cycle || !cycle.execution) return false;
    var execution = cycle.execution;
    target.innerHTML = [
      '<div class="hx-execution-head">',
        '<div><p class="hx-kicker">Execution Assistant · قدم ' + esc(journey.cycles.length) + '</p><h2 id="execution-title">' + esc(execution.execution_title || "خروجی آماده") + '</h2><p>هوشکس این بخش از کار را آماده کرده؛ تو فقط اجرا و نتیجه را ثبت کن.</p></div>',
        '<span class="hx-execution-ready">آماده اجرا</span>',
      '</div>',
      '<div class="hx-execution-context"><span>کار فعلی</span><strong>' + esc(cycle.action && cycle.action.title || "") + '</strong></div>',
      '<article class="hx-artifact-card">',
        '<div class="hx-artifact-top"><span>خروجی آماده کپی</span><small>' + esc(execution.source === "avalai" ? "شخصی‌سازی هوشمند" : "نسخه اجرایی") + '</small></div>',
        '<pre class="hx-artifact-text" id="execution-artifact">' + esc(execution.artifact || "") + '</pre>',
        '<div class="hx-artifact-hint"><strong>نحوه استفاده:</strong> ' + esc(execution.usage_hint || "همین نسخه را اجرا کن.") + '</div>',
      '</article>',
      '<div class="hx-checkin-card"><div><span>زمان بررسی نتیجه</span><strong>' + esc(formatDate(execution.checkInAt)) + '</strong></div><p>بعد از اجرا، تا این تاریخ به معیار «' + esc(cycle.metric && cycle.metric.metric || "نتیجه") + '» نگاه کن و برگرد نتیجه را ثبت کن.</p></div>',
      '<div class="hx-execution-actions">',
        '<button class="hx-primary" type="button" data-execution-action="copy">کپی خروجی</button>',
        '<button class="hx-secondary" type="button" data-execution-action="executed">اجراش کردم ✓</button>',
        '<button class="hx-back" type="button" data-execution-action="journey">بازگشت به مسیر</button>',
      '</div>'
    ].join("");
    return true;
  }

  function saveExecution(journey, cycle, result, source) {
    var days = Math.max(1, Math.min(7, Number(result.check_in_days) || 2));
    cycle.execution = {
      execution_title: String(result.execution_title || "خروجی آماده"),
      execution_type: String(result.execution_type || "offer_copy"),
      artifact: String(result.artifact || ""),
      usage_hint: String(result.usage_hint || ""),
      check_in_days: days,
      checkInAt: addDays(days),
      createdAt: now(),
      source: source || "api"
    };
    cycle.updatedAt = now();
    writeJourney(journey);
    if (window.hxTrack) window.hxTrack("execution_generated", { diagnosis_key: cycle.diagnosisKey, execution_type: cycle.execution.execution_type, source: cycle.execution.source, check_in_days: days });
    return cycle.execution;
  }

  function localExecution(cycle, journey) {
    var key = cycle && cycle.diagnosisKey || "offer";
    var business = journey && journey.profile && journey.profile.businessName || "کسب‌وکار";
    var offer = journey && journey.profile && journey.profile.offer || "محصول یا خدمت اصلی";
    if (key === "acquisition") return { execution_title: "متن جذب آماده انتشار", execution_type: "content_cta", artifact: "هوک:\nاگر این روزها برای «" + offer + "» مخاطب درست پیدا نمی‌کنی، اول درد اصلی را واضح‌تر بگو.\n\nمتن:\nدر " + business + " می‌خواهیم دقیق بفهمیم کجای مسیر برای تو سخت شده. اگر همین مسئله را داری، یک کلمه بفرست تا دقیق‌تر راهنمایی‌ات کنیم.\n\nCTA:\nکلمه «راهنما» را دایرکت کن.", usage_hint: "همین متن را با یک تصویر یا ویدیوی ساده منتشر کن و CTA را تغییر نده.", check_in_days: 3 };
    if (key === "sales_process") return { execution_title: "پاسخ آماده برای تردید خرید", execution_type: "sales_reply", artifact: "کاملاً حق داری قبل از تصمیم مطمئن شوی. درباره «" + offer + "» مهم‌ترین نکته این است که ببینیم واقعاً برای نیاز تو مناسب است یا نه.\n\nاگر بگویی اصلی‌ترین تردیدت چیست، دقیق و کوتاه جواب می‌دهم؛ اگر مناسب تو نباشد هم صادقانه می‌گویم.\n\nهمان سؤالی که جلوی خریدت را گرفته بفرست.", usage_hint: "این پاسخ را در اولین گفت‌وگوی واقعی با مشتری مردد استفاده کن.", check_in_days: 2 };
    if (key === "focus") return { execution_title: "برنامه اجرایی یک‌تمرکزی", execution_type: "focus_plan", artifact: "هدف این چرخه:\n" + (cycle.priority && cycle.priority.title || "یک اولویت را جلو ببر") + "\n\nامروز:\n" + (cycle.action && cycle.action.title || "کار فعلی") + "\n\nفعلاً متوقف کن:\nهر کاری که مستقیم به همین هدف کمک نمی‌کند.\n\nتعریف انجام‌شدن:\nوقتی معیار تعیین‌شده را اندازه گرفتی، قبل از شروع کار بعدی نتیجه را ثبت کن.", usage_hint: "تا ثبت نتیجه، کار جدیدی به این چرخه اضافه نکن.", check_in_days: 1 };
    return { execution_title: "پیشنهاد فروش آماده اجرا", execution_type: "offer_copy", artifact: "پیشنهاد اصلی:\n«" + offer + "» برای کسی است که می‌خواهد با یک مسیر روشن‌تر به نتیجه برسد، بدون سردرگمی بین چند انتخاب.\n\nاستوری ۱:\nاگر بین چند راه مختلف می‌چرخی، احتمالاً مشکل کمبود گزینه نیست؛ پیشنهاد واضح کم داری.\n\nاستوری ۲:\nدر " + business + "، «" + offer + "» را با یک نتیجه مشخص و قدم بعدی روشن ارائه می‌کنیم.\n\nاستوری ۳ / CTA:\nبرای شروع، کلمه «شروع» را دایرکت کن.", usage_hint: "این سه بخش را پشت‌سرهم منتشر کن و فقط همین CTA را نگه دار.", check_in_days: 2 };
  }

  async function prepareExecution() {
    if (preparing) return;
    var journey = readJourney();
    var cycle = currentCycle(journey);
    if (!journey || !cycle) {
      if (window.hxShowToast) window.hxShowToast("اول یک مسیر فعال بساز.");
      return;
    }
    if (cycle.execution && cycle.execution.artifact) {
      renderExecution(journey, cycle);
      showOnly("execution");
      return;
    }

    preparing = true;
    renderLoading(cycle);
    showOnly("execution");
    if (window.hxTrack) window.hxTrack("execution_requested", { diagnosis_key: cycle.diagnosisKey, cycle: journey.cycles.length });

    var payload = {
      sessionId: id("hx-execution"),
      cycleNumber: journey.cycles.length,
      profile: journey.profile || {},
      answers: journey.answers || {},
      diagnosisKey: cycle.diagnosisKey,
      currentPlan: { summary: cycle.summary || "", priority: cycle.priority || {}, action: cycle.action || {}, metric: cycle.metric || {} }
    };

    try {
      var controller = new AbortController();
      var timer = window.setTimeout(function () { controller.abort(); }, 23000);
      var response = await fetch("/api/execute", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload), signal: controller.signal });
      window.clearTimeout(timer);
      var data = await response.json();
      if (!response.ok || !data.execution) throw new Error(data.error || "execution_failed");
      saveExecution(journey, cycle, data.execution, data.source || "api");
    } catch (error) {
      saveExecution(journey, cycle, localExecution(cycle, journey), "local-fallback");
      if (window.hxShowToast) window.hxShowToast("اتصال هوشمند قطع شد؛ نسخه اجرایی اولیه آماده است.");
    } finally {
      preparing = false;
    }

    renderExecution(journey, cycle);
    injectEverywhere();
  }

  function openExisting() {
    var journey = readJourney();
    var cycle = currentCycle(journey);
    if (!journey || !cycle || !cycle.execution) return prepareExecution();
    renderExecution(journey, cycle);
    showOnly("execution");
    if (window.hxTrack) window.hxTrack("execution_opened", { diagnosis_key: cycle.diagnosisKey, execution_type: cycle.execution.execution_type });
  }

  function markCopied() {
    var journey = readJourney();
    var cycle = currentCycle(journey);
    if (!journey || !cycle || !cycle.execution) return;
    copyText(cycle.execution.artifact).then(function () {
      cycle.execution.copiedAt = now();
      writeJourney(journey);
      if (window.hxTrack) window.hxTrack("execution_copied", { diagnosis_key: cycle.diagnosisKey, execution_type: cycle.execution.execution_type });
      if (window.hxShowToast) window.hxShowToast("خروجی کپی شد");
    }).catch(function () {
      if (window.hxShowToast) window.hxShowToast("کپی انجام نشد");
    });
  }

  function markExecuted() {
    var journey = readJourney();
    var cycle = currentCycle(journey);
    if (!journey || !cycle || !cycle.execution) return;
    cycle.execution.executedAt = cycle.execution.executedAt || now();
    writeJourney(journey);
    if (window.hxJourneyMarkDone) window.hxJourneyMarkDone();
    if (window.hxTrack) window.hxTrack("execution_completed", { diagnosis_key: cycle.diagnosisKey, execution_type: cycle.execution.execution_type, check_in_at: cycle.execution.checkInAt });
    renderExecution(readJourney(), currentCycle(readJourney()));
    if (window.hxShowToast) window.hxShowToast("اجرا ثبت شد؛ موعد بررسی نتیجه ذخیره شد.");
  }

  function journeyCheckinHtml(cycle) {
    if (!cycle || !cycle.execution) return "";
    return '<div class="hx-inline-execution-status"><span>خروجی آماده</span><strong>' + esc(cycle.execution.execution_title || "Execution") + '</strong><small>بررسی نتیجه: ' + esc(formatDate(cycle.execution.checkInAt)) + '</small></div>';
  }

  function injectJourney() {
    var journey = readJourney();
    var cycle = currentCycle(journey);
    var plan = document.querySelector("#screen-journey .hx-current-plan");
    if (!plan || !cycle) return;

    var actions = plan.querySelector(".hx-plan-actions");
    if (actions && !actions.querySelector("[data-execution-action]")) {
      var button = document.createElement("button");
      button.className = cycle.execution ? "hx-tool hx-execute-cta" : "hx-secondary hx-execute-cta";
      button.type = "button";
      button.setAttribute("data-execution-action", cycle.execution ? "open" : "prepare");
      button.textContent = cycle.execution ? "خروجی آماده رو ببین" : "این کار رو برام آماده کن ←";
      actions.insertBefore(button, actions.firstChild);
    }

    var existing = plan.querySelector("[data-hx-execution-status]");
    if (cycle.execution && !existing) {
      var status = document.createElement("div");
      status.setAttribute("data-hx-execution-status", "true");
      status.innerHTML = journeyCheckinHtml(cycle);
      var metric = plan.querySelector(".hx-plan-metric");
      if (metric) metric.insertAdjacentElement("afterend", status);
    }
  }

  function injectResult() {
    if (window.hxCurrentResultKind !== "diagnosis") return;
    var journey = readJourney();
    var cycle = currentCycle(journey);
    var card = document.querySelector("#result-content .hx-result-card.hx-action");
    if (!card || !cycle || card.querySelector("[data-execution-action]")) return;
    var button = document.createElement("button");
    button.type = "button";
    button.className = "hx-secondary hx-result-execute";
    button.setAttribute("data-execution-action", cycle.execution ? "open" : "prepare");
    button.textContent = cycle.execution ? "خروجی آماده رو ببین" : "این کار رو برام آماده کن ←";
    card.appendChild(button);
  }

  function injectEverywhere() {
    injectJourney();
    injectResult();
  }

  function bind() {
    document.addEventListener("click", function (event) {
      var target = event.target.closest && event.target.closest("[data-execution-action]");
      if (!target) return;
      var action = target.getAttribute("data-execution-action");
      if (action === "prepare") prepareExecution();
      if (action === "open") openExisting();
      if (action === "copy") markCopied();
      if (action === "executed") markExecuted();
      if (action === "journey") {
        if (window.hxJourneyOpen) window.hxJourneyOpen();
        window.setTimeout(injectJourney, 30);
      }
    }, true);
  }

  function init() {
    installScreen();
    bind();
    injectEverywhere();
    if (window.MutationObserver) {
      new MutationObserver(function () { window.setTimeout(injectEverywhere, 20); }).observe(document.body, { childList: true, subtree: true });
    }
  }

  window.hxExecutionPrepare = prepareExecution;
  window.hxExecutionOpen = openExisting;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
