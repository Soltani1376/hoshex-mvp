(function () {
  "use strict";

  var STORAGE_KEY = "hx_business_journey_v1";
  var MAX_CYCLES = 20;
  var selectedOutcome = "";

  function esc(value) {
    if (window.hxEscape) return window.hxEscape(value);
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function now() { return new Date().toISOString(); }
  function id(prefix) { return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7); }

  function readJourney() {
    try {
      var value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
      if (!value || typeof value !== "object" || !Array.isArray(value.cycles)) return null;
      return value;
    } catch (error) { return null; }
  }

  function writeJourney(journey) {
    if (!journey) return;
    journey.updatedAt = now();
    journey.cycles = (journey.cycles || []).slice(-MAX_CYCLES);
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(journey)); } catch (error) {}
    renderResumeCard();
  }

  function currentCycle(journey) {
    if (!journey || !Array.isArray(journey.cycles) || !journey.cycles.length) return null;
    var match = journey.cycles.find(function (cycle) { return cycle.id === journey.currentCycleId; });
    return match || journey.cycles[journey.cycles.length - 1];
  }

  function diagnosisKey(payload) {
    var metaKey = payload && payload.meta && payload.meta.rules_hypothesis;
    if (["acquisition", "offer", "sales_process", "focus"].indexOf(metaKey) >= 0) return metaKey;
    var title = String(payload && payload.diagnosis && payload.diagnosis.main_problem && payload.diagnosis.main_problem.title || "");
    if (/ورودی|مشتری کم|سرنخ/.test(title)) return "acquisition";
    if (/فرآیند|تبدیل مشتری|خرید نمی/.test(title)) return "sales_process";
    if (/تمرکز|اولویت اجرایی/.test(title)) return "focus";
    return "offer";
  }

  function planFromDiagnosis(diagnosis) {
    var d = diagnosis || {};
    var priority = Array.isArray(d.priorities) && d.priorities[0] ? d.priorities[0] : {};
    var action = d.today_action || {};
    var metric = d.success_metric || {};
    return {
      summary: String(d.business_summary || ""),
      priority: { title: String(priority.title || d.main_problem && d.main_problem.title || "اولویت فعلی"), description: String(priority.description || d.main_problem && d.main_problem.reason || "") },
      action: { title: String(action.title || "کار امروز"), steps: Array.isArray(action.steps) ? action.steps.slice(0, 5) : [], time_required: String(action.time_required || "کمتر از یک روز") },
      metric: { metric: String(metric.metric || "نتیجه قابل اندازه‌گیری"), period: String(metric.period || "تا ۷ روز آینده") },
      avoid_now: String(d.avoid_now || ""),
      check_in_question: String(d.next_step || "بعد از اجرا نتیجه را ثبت کن.")
    };
  }

  function saveDiagnosis(payload) {
    if (!payload || !payload.diagnosis || payload.source === "demo") return null;
    var journey = readJourney() || { version: 1, createdAt: now(), updatedAt: now(), profile: {}, answers: {}, cycles: [] };
    var sessionId = String(payload.sessionId || "");
    var duplicate = journey.cycles.some(function (cycle) { return sessionId && cycle.sessionId === sessionId && cycle.kind === "diagnosis"; });
    if (duplicate) return journey;
    var plan = planFromDiagnosis(payload.diagnosis);
    var cycle = {
      id: id("hx-cycle"), kind: "diagnosis", sessionId: sessionId, createdAt: now(), updatedAt: now(),
      source: payload.source || "api", diagnosisKey: diagnosisKey(payload), status: "active",
      summary: plan.summary, priority: plan.priority, action: plan.action, metric: plan.metric,
      avoid_now: plan.avoid_now, check_in_question: plan.check_in_question
    };
    journey.profile = payload.profile || journey.profile || {};
    journey.answers = payload.answers || journey.answers || {};
    journey.cycles.push(cycle);
    journey.currentCycleId = cycle.id;
    writeJourney(journey);
    if (window.hxTrack) window.hxTrack("journey_started", { cycle: journey.cycles.length, diagnosis_key: cycle.diagnosisKey });
    return journey;
  }

  function markDone() {
    var journey = readJourney();
    var cycle = currentCycle(journey);
    if (!cycle) return;
    cycle.status = "done";
    cycle.completedAt = cycle.completedAt || now();
    cycle.updatedAt = now();
    writeJourney(journey);
    if (window.hxTrack) window.hxTrack("journey_action_completed", { cycle: journey.cycles.length, diagnosis_key: cycle.diagnosisKey });
  }

  function statusLabel(cycle) {
    if (!cycle) return "بدون مسیر فعال";
    if (cycle.status === "done") return "منتظر ثبت نتیجه";
    if (cycle.status === "reviewed") return "بازخورد ثبت شده";
    return "در حال اجرا";
  }

  function installScreens() {
    var main = document.querySelector("main");
    if (!main) return;
    if (!document.getElementById("screen-journey")) {
      var journeySection = document.createElement("section");
      journeySection.className = "hx-screen";
      journeySection.id = "screen-journey";
      journeySection.hidden = true;
      journeySection.setAttribute("aria-labelledby", "journey-title");
      journeySection.innerHTML = '<div class="hx-panel hx-panel-wide"><div id="journey-content"></div></div>';
      main.appendChild(journeySection);
    }
    if (!document.getElementById("screen-feedback")) {
      var feedbackSection = document.createElement("section");
      feedbackSection.className = "hx-screen";
      feedbackSection.id = "screen-feedback";
      feedbackSection.hidden = true;
      feedbackSection.setAttribute("aria-labelledby", "feedback-title");
      feedbackSection.innerHTML = '<div class="hx-panel"><div id="feedback-content"></div></div>';
      main.appendChild(feedbackSection);
    }
  }

  function showOnly(name) {
    document.querySelectorAll(".hx-screen").forEach(function (screen) { screen.hidden = screen.id !== "screen-" + name; });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderResumeCard() {
    var landing = document.getElementById("screen-landing");
    var hero = landing && landing.querySelector(".hx-hero");
    if (!landing || !hero) return;
    var old = landing.querySelector("[data-hx-resume]");
    var journey = readJourney();
    var cycle = currentCycle(journey);
    if (!journey || !cycle) { if (old) old.remove(); return; }
    if (!old) {
      old = document.createElement("div");
      old.setAttribute("data-hx-resume", "true");
      old.className = "hx-resume-card";
      hero.insertAdjacentElement("afterend", old);
    }
    var business = journey.profile && journey.profile.businessName ? journey.profile.businessName : "کسب‌وکارت";
    var chipClass = cycle.status === "done" ? "is-waiting" : "is-live";
    old.innerHTML = [
      '<div>',
        '<p class="hx-resume-kicker">مسیر فعال · ' + esc(business) + '</p>',
        '<h2 class="hx-resume-title">' + esc(cycle.priority && cycle.priority.title || "اولویت فعلی") + '</h2>',
        '<p class="hx-resume-copy">آخرین کار: ' + esc(cycle.action && cycle.action.title || "") + '</p>',
        '<div class="hx-resume-meta"><span class="hx-journey-chip ' + chipClass + '">' + esc(statusLabel(cycle)) + '</span><span class="hx-journey-chip">قدم ' + esc(journey.cycles.length) + '</span></div>',
      '</div>',
      '<div class="hx-resume-actions"><button class="hx-primary" type="button" data-journey-action="open">ادامه مسیر ←</button><button class="hx-secondary" type="button" data-journey-action="new-diagnosis">تشخیص جدید</button></div>'
    ].join("");
  }

  function renderHistory(journey) {
    var items = (journey.cycles || []).slice(-6);
    return items.map(function (cycle, index) {
      var number = journey.cycles.length - items.length + index + 1;
      var current = cycle.id === journey.currentCycleId;
      var meta = cycle.feedback && cycle.feedback.outcome === "improved" ? "نتیجه مثبت" : cycle.feedback && cycle.feedback.outcome === "no_result" ? "نیاز به اصلاح" : cycle.feedback && cycle.feedback.outcome === "not_done" ? "کوچک‌تر شد" : statusLabel(cycle);
      return '<div class="hx-history-item' + (current ? ' is-current' : '') + '"><span class="hx-history-index">' + esc(number) + '</span><div><p class="hx-history-title">' + esc(cycle.priority && cycle.priority.title || cycle.action && cycle.action.title || "قدم هوشکس") + '</p><p class="hx-history-meta">' + esc(meta) + '</p></div></div>';
    }).join("");
  }

  function renderJourney() {
    var journey = readJourney();
    var cycle = currentCycle(journey);
    var target = document.getElementById("journey-content");
    if (!target) return false;
    if (!journey || !cycle) {
      target.innerHTML = '<div class="hx-journey-head"><div><p class="hx-journey-kicker">مسیر هوشکس</p><h2 id="journey-title">هنوز مسیر فعالی نداری.</h2><p class="hx-journey-sub">یک تشخیص کوتاه انجام بده تا اولین Priority و Today Action ذخیره شود.</p></div></div><button class="hx-primary" data-journey-action="new-diagnosis">شروع تشخیص ←</button>';
      return false;
    }
    var business = journey.profile && journey.profile.businessName ? journey.profile.businessName : "کسب‌وکارت";
    var steps = (cycle.action && cycle.action.steps || []).map(function (step) { return '<li>' + esc(step) + '</li>'; }).join("");
    target.innerHTML = [
      '<div class="hx-journey-head"><div><p class="hx-journey-kicker">مسیر فعال · ' + esc(business) + '</p><h2 id="journey-title">از همان‌جایی ادامه بده که ماندیم.</h2><p class="hx-journey-sub">هوشکس نتیجه هر اقدام را می‌گیرد و قدم بعدی را بر اساس همان داده می‌سازد.</p></div><span class="hx-journey-chip ' + (cycle.status === "done" ? "is-waiting" : "is-live") + '">' + esc(statusLabel(cycle)) + '</span></div>',
      '<div class="hx-journey-layout">',
        '<article class="hx-current-plan"><span class="hx-plan-index">P' + esc(journey.cycles.length) + '</span><p class="hx-plan-label">PRIORITY فعلی</p><h3 class="hx-plan-priority">' + esc(cycle.priority && cycle.priority.title || "اولویت فعلی") + '</h3><p class="hx-plan-label">کار این مرحله</p><p class="hx-plan-action">' + esc(cycle.action && cycle.action.title || "") + '</p><ol class="hx-plan-steps">' + steps + '</ol><div class="hx-plan-metric"><strong>معیار نتیجه:</strong> ' + esc(cycle.metric && cycle.metric.metric || "") + '<br>' + esc(cycle.metric && cycle.metric.period || "") + '</div><div class="hx-plan-actions">' + (cycle.status !== "done" ? '<button class="hx-primary" data-journey-action="done">انجامش دادم ✓</button>' : '<button class="hx-primary" data-journey-action="feedback">ثبت نتیجه و گرفتن بازخورد ←</button>') + '<button class="hx-secondary" data-journey-action="feedback">نتیجه را الان ثبت کن</button></div></article>',
        '<aside class="hx-journey-side-card"><h3>وضعیت مسیر</h3><div class="hx-status-line"><span>قدم فعلی</span><strong>' + esc(journey.cycles.length) + '</strong></div><div class="hx-status-line"><span>وضعیت</span><strong>' + esc(statusLabel(cycle)) + '</strong></div><div class="hx-status-line"><span>زمان اجرا</span><strong>' + esc(cycle.action && cycle.action.time_required || "کمتر از یک روز") + '</strong></div>' + (cycle.avoid_now ? '<div class="hx-status-line"><span>فعلاً انجام نده</span><strong>' + esc(cycle.avoid_now) + '</strong></div>' : '') + '</aside>',
        '<aside class="hx-journey-side-card"><h3>مسیر تا اینجا</h3><div class="hx-history">' + renderHistory(journey) + '</div></aside>',
      '</div>',
      '<div class="hx-result-footer"><button class="hx-back" data-journey-action="home">بازگشت به خانه</button><button class="hx-tool" data-journey-action="new-diagnosis">شروع تشخیص جدید</button></div>'
    ].join("");
    return true;
  }

  function openJourney() {
    renderJourney();
    showOnly("journey");
    if (window.hxTrack) window.hxTrack("journey_opened", { cycles: (readJourney() || { cycles: [] }).cycles.length });
  }

  function renderFeedback() {
    var journey = readJourney();
    var cycle = currentCycle(journey);
    var target = document.getElementById("feedback-content");
    selectedOutcome = cycle && cycle.status === "done" ? "" : selectedOutcome;
    if (!target || !journey || !cycle) return false;
    target.innerHTML = [
      '<div class="hx-panel-head"><div><p class="hx-kicker">بازخورد مرحله ' + esc(journey.cycles.length) + '</p><h2 id="feedback-title">نتیجه کار قبلی چی شد؟</h2><p class="hx-panel-subtitle">جواب تو داده مرحله بعد هوشکس است؛ قرار نیست همه‌چیز را از اول بررسی کنیم.</p></div><span class="hx-step-count">Follow-up</span></div>',
      '<div class="hx-feedback-intro"><strong>' + esc(cycle.action && cycle.action.title || "کار قبلی") + '</strong><p>معیار: ' + esc(cycle.metric && cycle.metric.metric || "") + ' · ' + esc(cycle.metric && cycle.metric.period || "") + '</p></div>',
      '<div class="hx-feedback-options" role="radiogroup">',
        '<button type="button" class="hx-feedback-option" data-feedback-outcome="improved"><strong>انجام دادم و بهتر شد</strong><small>یک نشانه مثبت در پیام، کلیک، فروش یا معیار تعیین‌شده دیدم.</small></button>',
        '<button type="button" class="hx-feedback-option" data-feedback-outcome="no_result"><strong>انجام دادم ولی نتیجه نگرفتم</strong><small>کار اجرا شد اما عدد یا رفتار مشتری تغییر محسوسی نکرد.</small></button>',
        '<button type="button" class="hx-feedback-option" data-feedback-outcome="not_done"><strong>هنوز انجامش ندادم</strong><small>کار بزرگ، مبهم یا سخت بود؛ هوشکس نسخه کوچک‌تری می‌دهد.</small></button>',
      '</div>',
      '<div class="hx-field"><label for="feedback-note">چه اتفاقی افتاد؟ <span>(اختیاری ولی مفید)</span></label><textarea class="hx-textarea" id="feedback-note" maxlength="600" placeholder="مثلاً ۳ نفر دایرکت دادند ولی هنوز خریدی نداشتم…"></textarea><p class="hx-hint">یک مشاهده واقعی از نتیجه بنویس؛ حتی یک جمله.</p></div>',
      '<p class="hx-error" id="feedback-error" role="alert"></p>',
      '<div class="hx-feedback-actions"><button class="hx-back" type="button" data-journey-action="open">بازگشت</button><button class="hx-primary" type="button" data-journey-action="submit-feedback">تحلیل نتیجه و قدم بعدی ←</button></div>'
    ].join("");
    return true;
  }

  function openFeedback() {
    if (!renderFeedback()) return;
    showOnly("feedback");
    if (window.hxTrack) window.hxTrack("journey_feedback_opened");
  }

  function setFeedbackError(message) {
    var error = document.getElementById("feedback-error");
    if (error) error.textContent = message || "";
  }

  function localFollowup(cycle, outcome, note) {
    var improved = outcome === "improved";
    var noResult = outcome === "no_result";
    return {
      feedback_summary: note ? (improved ? "نتیجه مثبت ثبت شد. " : noResult ? "اجرا شد اما نتیجه کافی نبود. " : "کار قبلی هنوز اجرا نشده. ") + note : (improved ? "نتیجه مثبت ثبت شد." : noResult ? "اجرا شد اما نتیجه کافی نبود." : "کار قبلی هنوز اجرا نشده."),
      decision: improved ? "advance" : noResult ? "adjust" : "retry_smaller",
      priority: { title: improved ? "همین مسیر را یک مرحله تثبیت کن" : noResult ? "همان فرضیه را با یک اصلاح کوچک تست کن" : "کار را به کوچک‌ترین نسخه تبدیل کن", reason: improved ? "داده جدید می‌گوید مسیر فعلی ارزش ادامه دادن دارد." : noResult ? "قبل از عوض‌کردن مشکل، یک تغییر کنترل‌شده لازم است." : "هنوز داده‌ای برای تغییر تشخیص نداریم؛ اول اجرای ساده‌تر را انجام بده." },
      next_action: { title: improved ? (cycle.action.title + " را یک بار دیگر با همان ساختار تکرار کن") : noResult ? ("یک نسخه اصلاح‌شده از «" + cycle.action.title + "» اجرا کن") : ((cycle.action.steps && cycle.action.steps[0]) || cycle.action.title), steps: improved ? ["بخش اصلی اقدام قبلی را ثابت نگه دار.", "فقط یک جز کوچک را تغییر بده.", "نتیجه را با اجرای قبلی مقایسه کن."] : noResult ? ["فقط یک متغیر را عوض کن.", "همان معیار نتیجه را نگه دار.", "بعد از اجرا دوباره عدد را ثبت کن."] : [((cycle.action.steps && cycle.action.steps[0]) || "نسخه کوچک کار را انجام بده.")], time_required: outcome === "not_done" ? "۲۰ تا ۳۰ دقیقه" : "۴۵ تا ۹۰ دقیقه" },
      success_metric: cycle.metric,
      avoid_now: "فعلاً چند تغییر را هم‌زمان انجام نده.",
      check_in_question: "بعد از این اجرا چه تغییری در معیار اصلی دیدی؟"
    };
  }

  function applyFollowup(journey, previous, followup, source, outcome, note) {
    previous.status = "reviewed";
    previous.feedback = { outcome: outcome, note: note || "", at: now(), summary: followup.feedback_summary, decision: followup.decision };
    previous.updatedAt = now();
    var cycle = {
      id: id("hx-cycle"), kind: "followup", createdAt: now(), updatedAt: now(), source: source || "api",
      diagnosisKey: previous.diagnosisKey, status: "active", summary: followup.feedback_summary,
      priority: { title: followup.priority.title, description: followup.priority.reason },
      action: { title: followup.next_action.title, steps: followup.next_action.steps || [], time_required: followup.next_action.time_required || "کمتر از یک روز" },
      metric: followup.success_metric || previous.metric, avoid_now: followup.avoid_now || "", check_in_question: followup.check_in_question || "نتیجه قدم بعدی چی شد؟",
      fromOutcome: outcome, decision: followup.decision
    };
    journey.cycles.push(cycle);
    journey.currentCycleId = cycle.id;
    writeJourney(journey);
    if (window.hxTrack) window.hxTrack("journey_followup_created", { cycle: journey.cycles.length, decision: followup.decision, source: source || "api" });
    renderJourney();
    showOnly("journey");
    if (window.hxShowToast) window.hxShowToast("قدم بعدی آماده شد");
  }

  async function submitFeedback() {
    var journey = readJourney();
    var cycle = currentCycle(journey);
    if (!journey || !cycle) return;
    if (!selectedOutcome) { setFeedbackError("یکی از سه وضعیت نتیجه را انتخاب کن."); return; }
    var note = String(document.getElementById("feedback-note") && document.getElementById("feedback-note").value || "").trim();
    setFeedbackError("");
    var button = document.querySelector('[data-journey-action="submit-feedback"]');
    if (button) { button.disabled = true; button.textContent = "دارم نتیجه را تحلیل می‌کنم…"; }
    var payload = {
      sessionId: id("hx-followup"), cycleNumber: journey.cycles.length,
      profile: journey.profile || {}, diagnosisKey: cycle.diagnosisKey,
      currentPlan: { summary: cycle.summary || "", priority: cycle.priority, action: cycle.action, metric: cycle.metric },
      feedback: { outcome: selectedOutcome, note: note }
    };
    if (window.hxTrack) window.hxTrack("journey_feedback_submit", { outcome: selectedOutcome, cycle: journey.cycles.length });
    try {
      var controller = new AbortController();
      var timer = window.setTimeout(function () { controller.abort(); }, 22000);
      var response = await fetch("/api/followup", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload), signal: controller.signal });
      window.clearTimeout(timer);
      var data = await response.json();
      if (!response.ok || !data.followup) throw new Error(data.error || "followup_failed");
      applyFollowup(journey, cycle, data.followup, data.source || "api", selectedOutcome, note);
    } catch (error) {
      var fallback = localFollowup(cycle, selectedOutcome, note);
      applyFollowup(journey, cycle, fallback, "local-fallback", selectedOutcome, note);
      if (window.hxShowToast) window.hxShowToast("اتصال تحلیل قطع شد؛ قدم بعدی اولیه آماده است.");
    }
  }

  function startNewDiagnosis() {
    document.getElementById("screen-journey") && (document.getElementById("screen-journey").hidden = true);
    document.getElementById("screen-feedback") && (document.getElementById("screen-feedback").hidden = true);
    if (window.hxStartFlow) window.hxStartFlow();
    else {
      var start = document.querySelector('[data-action="start"]');
      if (start) start.click();
    }
  }

  function injectResultJourneyButton() {
    if (window.hxCurrentResultKind !== "diagnosis") return;
    var footer = document.querySelector("#result-content .hx-result-tools");
    if (!footer || footer.querySelector('[data-journey-action="open"]')) return;
    var button = document.createElement("button");
    button.className = "hx-tool";
    button.type = "button";
    button.setAttribute("data-journey-action", "open");
    button.textContent = "مسیر من";
    footer.appendChild(button);
  }

  function bindDelegation() {
    document.addEventListener("click", function (event) {
      var option = event.target.closest && event.target.closest("[data-feedback-outcome]");
      if (option) {
        selectedOutcome = option.getAttribute("data-feedback-outcome") || "";
        document.querySelectorAll("[data-feedback-outcome]").forEach(function (item) { item.classList.toggle("is-selected", item === option); });
        setFeedbackError("");
        return;
      }
      var resultAction = event.target.closest && event.target.closest('[data-result-action="done"]');
      if (resultAction && window.hxCurrentResultKind === "diagnosis") {
        markDone();
        window.setTimeout(injectResultJourneyButton, 20);
      }
      var actionTarget = event.target.closest && event.target.closest("[data-journey-action]");
      if (!actionTarget) {
        var brand = event.target.closest && event.target.closest('[data-action="brand-home"]');
        if (brand) {
          var journeyScreen = document.getElementById("screen-journey");
          var feedbackScreen = document.getElementById("screen-feedback");
          if (journeyScreen) journeyScreen.hidden = true;
          if (feedbackScreen) feedbackScreen.hidden = true;
        }
        return;
      }
      var action = actionTarget.getAttribute("data-journey-action");
      if (action === "open") openJourney();
      if (action === "home") showOnly("landing");
      if (action === "new-diagnosis") startNewDiagnosis();
      if (action === "done") { markDone(); renderJourney(); if (window.hxShowToast) window.hxShowToast("انجام کار ثبت شد؛ وقتی نتیجه مشخص شد بازخورد بده."); }
      if (action === "feedback") openFeedback();
      if (action === "submit-feedback") submitFeedback();
    }, true);
  }

  function init() {
    installScreens();
    bindDelegation();
    renderResumeCard();
    var resultContent = document.getElementById("result-content");
    if (resultContent && window.MutationObserver) {
      new MutationObserver(function () { window.setTimeout(injectResultJourneyButton, 10); }).observe(resultContent, { childList: true, subtree: true });
    }
    if (window.hxPendingJourneyDiagnosis) {
      saveDiagnosis(window.hxPendingJourneyDiagnosis);
      window.hxPendingJourneyDiagnosis = null;
    }
    if (window.hxPendingJourneyDone) {
      markDone();
      window.hxPendingJourneyDone = false;
    }
  }

  window.hxJourneySaveDiagnosis = saveDiagnosis;
  window.hxJourneyMarkDone = markDone;
  window.hxJourneyOpen = openJourney;
  window.hxJourneyOpenFeedback = openFeedback;
  window.hxJourneyRead = readJourney;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
