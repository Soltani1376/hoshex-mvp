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
    if (window.hxCompletionRefresh) window.hxCompletionRefresh();
  }

  function addDays(days) {
    var date = new Date();
    date.setDate(date.getDate() + Math.max(1, Math.min(7, Number(days) || 2)));
    return date.toISOString();
  }

  function formatDate(value) {
    if (!value) return "بعد از اجرا";
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return "بعد از اجرا";
    try { return new Intl.DateTimeFormat("fa-IR-u-ca-gregory", { day: "numeric", month: "long" }).format(date); }
    catch (error) { return date.toISOString().slice(0, 10); }
  }

  function checkinLabel(execution) {
    if (!execution) return "";
    if (execution.checkInAt) return formatDate(execution.checkInAt);
    return Math.max(1, Math.min(7, Number(execution.check_in_days) || 2)) + " روز بعد از اجرا";
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

  function contextSchema(key, journey, cycle) {
    var offer = journey && journey.profile && journey.profile.offer || "";
    if (key === "acquisition") return {
      badge: "برای ساخت متن جذب",
      title: "دو جزئیات بده تا متن واقعاً برای مخاطب تو ساخته بشه.",
      subtitle: "این‌ها فقط برای همین خروجی استفاده می‌شوند؛ قرار نیست فرم تازه‌ای شروع کنیم.",
      fields: [
        { key: "pain", type: "textarea", label: "مخاطبی که می‌خواهی جذب کنی الان دقیقاً چه مشکلی دارد؟", placeholder: "مثلاً دنبال هدیه خاصه ولی بین گزینه‌ها گیج می‌شه", hint: "یک مشکل واقعی و مشخص کافی است.", required: true },
        { key: "cta", type: "select", label: "قدم بعدی مخاطب کجا باشد؟", required: true, options: [["dm", "دایرکت"], ["website", "لینک سایت"], ["whatsapp", "واتساپ"]] }
      ]
    };
    if (key === "sales_process") return {
      badge: "برای ساخت پاسخ فروش",
      title: "تردید واقعی مشتری رو بده؛ نه حدس ما رو.",
      subtitle: "با همین دو داده، پاسخ آماده‌ای می‌سازیم که بتوانی در گفت‌وگوی بعدی استفاده کنی.",
      fields: [
        { key: "objection", type: "textarea", label: "پرتکرارترین سؤال یا تردید مشتری چیست؟", placeholder: "مثلاً می‌گه گرونه / مطمئن نیست کیفیتش خوب باشه", required: true },
        { key: "proof", type: "input", label: "چه دلیل اعتماد واقعی داری؟", placeholder: "مثلاً ضمانت، نمونه مشتری، تجربه، امکان مرجوعی", hint: "اگر مدرک خاصی نداری، «ندارم» بنویس.", required: true }
      ]
    };
    if (key === "focus") return {
      badge: "برای ساخت برنامه یک‌تمرکزی",
      title: "هدف این چرخه رو ببندیم تا برنامه واقعاً قابل اجرا باشه.",
      subtitle: "فقط نتیجه‌ای که می‌خواهی و زمانی که امروز داری لازم است.",
      fields: [
        { key: "outcome", type: "input", label: "تا پایان این چرخه چه نتیجه مشخصی می‌خواهی؟", placeholder: cycle && cycle.metric && cycle.metric.metric || "مثلاً ۵ سفارش یا ۱۰ دایرکت مرتبط", required: true },
        { key: "available_time", type: "select", label: "امروز چقدر زمان واقعی داری؟", required: true, options: [["30", "حدود ۳۰ دقیقه"], ["60", "حدود ۱ ساعت"], ["120", "حدود ۲ ساعت"]] }
      ]
    };
    return {
      badge: "برای ساخت پیشنهاد فروش",
      title: "سه جزئیات کوتاه؛ بعد خروجی مستقیم آماده اجراست.",
      subtitle: "هرچه این سه مورد واقعی‌تر باشند، متن کمتر شبیه خروجی عمومی AI می‌شود.",
      fields: [
        { key: "subject", type: "input", label: "این پیشنهاد دقیقاً برای کدام محصول یا خدمت است؟", placeholder: "مثلاً کیف چرمی مدل X", value: offer, required: true },
        { key: "audience", type: "input", label: "مخاطب اصلی این پیشنهاد کیست و چه نتیجه‌ای می‌خواهد؟", placeholder: "مثلاً خانم‌های شاغل که کیف سبک و رسمی می‌خواهند", required: true },
        { key: "cta", type: "select", label: "CTA نهایی کجا باشد؟", required: true, options: [["dm", "دایرکت"], ["website", "لینک سایت"], ["whatsapp", "واتساپ"]] }
      ]
    };
  }

  function fieldHtml(field, saved) {
    var value = saved && saved[field.key] != null ? String(saved[field.key]) : String(field.value || "");
    var required = field.required ? " required" : "";
    if (field.type === "select") {
      return '<div class="hx-context-field"><label for="hx-context-' + esc(field.key) + '">' + esc(field.label) + '</label><select class="hx-context-select" id="hx-context-' + esc(field.key) + '" data-context-key="' + esc(field.key) + '"' + required + '><option value="">انتخاب کن</option>' + (field.options || []).map(function (option) { return '<option value="' + esc(option[0]) + '"' + (value === option[0] ? ' selected' : '') + '>' + esc(option[1]) + '</option>'; }).join("") + '</select>' + (field.hint ? '<small>' + esc(field.hint) + '</small>' : '') + '</div>';
    }
    if (field.type === "textarea") {
      return '<div class="hx-context-field"><label for="hx-context-' + esc(field.key) + '">' + esc(field.label) + '</label><textarea class="hx-context-textarea" id="hx-context-' + esc(field.key) + '" data-context-key="' + esc(field.key) + '" maxlength="360" placeholder="' + esc(field.placeholder || "") + '"' + required + '>' + esc(value) + '</textarea>' + (field.hint ? '<small>' + esc(field.hint) + '</small>' : '') + '</div>';
    }
    return '<div class="hx-context-field"><label for="hx-context-' + esc(field.key) + '">' + esc(field.label) + '</label><input class="hx-context-input" id="hx-context-' + esc(field.key) + '" data-context-key="' + esc(field.key) + '" maxlength="220" value="' + esc(value) + '" placeholder="' + esc(field.placeholder || "") + '"' + required + '>' + (field.hint ? '<small>' + esc(field.hint) + '</small>' : '') + '</div>';
  }

  function renderContext(journey, cycle) {
    var target = document.getElementById("execution-content");
    if (!target || !cycle) return false;
    var schema = contextSchema(cycle.diagnosisKey, journey, cycle);
    var saved = cycle.executionContext || {};
    target.innerHTML = [
      '<div class="hx-execution-context-step">',
        '<span class="hx-context-badge">' + esc(schema.badge) + '</span>',
        '<h2 id="execution-title">' + esc(schema.title) + '</h2>',
        '<p>' + esc(schema.subtitle) + '</p>',
        '<form class="hx-execution-context-form" id="execution-context-form">',
          schema.fields.map(function (field) { return fieldHtml(field, saved); }).join(""),
          '<p class="hx-context-error" id="execution-context-error" role="alert"></p>',
          '<div class="hx-context-actions"><button class="hx-primary" type="submit">ساخت خروجی آماده ←</button><button class="hx-back" type="button" data-execution-action="journey">بازگشت به مسیر</button></div>',
        '</form>',
      '</div>'
    ].join("");
    if (window.hxTrack) window.hxTrack("execution_context_viewed", { diagnosis_key: cycle.diagnosisKey, field_count: schema.fields.length });
    return true;
  }

  function collectContext() {
    var form = document.getElementById("execution-context-form");
    if (!form) return null;
    var values = {};
    var invalid = null;
    form.querySelectorAll("[data-context-key]").forEach(function (field) {
      var value = String(field.value || "").trim();
      values[field.getAttribute("data-context-key")] = value;
      if (!invalid && field.required && value.length < 2) invalid = field;
    });
    if (invalid) {
      var error = document.getElementById("execution-context-error");
      if (error) error.textContent = "این جزئیات برای شخصی‌سازی خروجی لازم است.";
      invalid.focus();
      return null;
    }
    return values;
  }

  function renderLoading(cycle) {
    var target = document.getElementById("execution-content");
    if (!target) return;
    target.innerHTML = [
      '<div class="hx-execution-loading">',
        '<div class="hx-execution-pulse" aria-hidden="true"><span></span></div>',
        '<p class="hx-kicker">Execution Assistant</p>',
        '<h2 id="execution-title">دارم نسخه اجرایی رو می‌سازم.</h2>',
        '<p>بر اساس همین اقدام: <strong>' + esc(cycle && cycle.action && cycle.action.title || "کار فعلی") + '</strong></p>',
        '<small>فقط یک خروجی نهایی؛ بر اساس جزئیاتی که همین الان دادی.</small>',
      '</div>'
    ].join("");
  }

  function renderExecution(journey, cycle) {
    var target = document.getElementById("execution-content");
    if (!target || !cycle || !cycle.execution) return false;
    var execution = cycle.execution;
    var executed = Boolean(execution.executedAt);
    target.innerHTML = [
      '<div class="hx-execution-head">',
        '<div><p class="hx-kicker">Execution Assistant · قدم ' + esc(journey.cycles.length) + '</p><h2 id="execution-title">' + esc(execution.execution_title || "خروجی آماده") + '</h2><p>این خروجی از اطلاعات همین کسب‌وکار و Context همین اقدام ساخته شده.</p></div>',
        '<span class="hx-execution-ready">' + (executed ? 'اجرا ثبت شد' : 'آماده اجرا') + '</span>',
      '</div>',
      '<div class="hx-execution-context"><span>کار فعلی</span><strong>' + esc(cycle.action && cycle.action.title || "") + '</strong></div>',
      '<article class="hx-artifact-card">',
        '<div class="hx-artifact-top"><span>خروجی آماده کپی</span><small>' + esc(execution.source === "avalai" ? "شخصی‌سازی هوشمند" : "نسخه اجرایی") + '</small></div>',
        '<pre class="hx-artifact-text" id="execution-artifact">' + esc(execution.artifact || "") + '</pre>',
        '<div class="hx-artifact-hint"><strong>نحوه استفاده:</strong> ' + esc(execution.usage_hint || "همین نسخه را اجرا کن.") + '</div>',
      '</article>',
      '<div class="hx-checkin-card"><div><span>زمان بررسی نتیجه</span><strong>' + esc(checkinLabel(execution)) + '</strong></div><p>' + (executed ? 'تا این تاریخ' : 'بعد از اجرا') + ' به معیار «' + esc(cycle.metric && cycle.metric.metric || "نتیجه") + '» نگاه کن و برگرد نتیجه را ثبت کن.</p></div>',
      '<div class="hx-execution-actions">',
        '<button class="hx-primary" type="button" data-execution-action="copy">کپی خروجی</button>',
        '<button class="hx-secondary" type="button" data-execution-action="executed"' + (executed ? ' disabled' : '') + '>' + (executed ? 'اجرا ثبت شد ✓' : 'اجراش کردم ✓') + '</button>',
        '<button class="hx-back" type="button" data-execution-action="journey">بازگشت به مسیر</button>',
      '</div>'
    ].join("");
    return true;
  }

  function saveExecution(journey, cycle, result, source, context) {
    var days = Math.max(1, Math.min(7, Number(result.check_in_days) || 2));
    cycle.executionContext = context || cycle.executionContext || {};
    cycle.execution = {
      execution_title: String(result.execution_title || "خروجی آماده"),
      execution_type: String(result.execution_type || "offer_copy"),
      artifact: String(result.artifact || ""),
      usage_hint: String(result.usage_hint || ""),
      check_in_days: days,
      checkInAt: "",
      createdAt: now(),
      source: source || "api",
      context: cycle.executionContext
    };
    cycle.updatedAt = now();
    writeJourney(journey);
    if (window.hxTrack) window.hxTrack("execution_generated", { diagnosis_key: cycle.diagnosisKey, execution_type: cycle.execution.execution_type, source: cycle.execution.source, check_in_days: days, context_fields: Object.keys(cycle.executionContext).length });
    return cycle.execution;
  }

  function ctaLine(value) {
    if (value === "website") return "برای دیدن جزئیات، روی لینک سایت بزن.";
    if (value === "whatsapp") return "برای ادامه، همین الان در واتساپ پیام بده.";
    return "برای ادامه، یک پیام دایرکت بفرست.";
  }

  function localExecution(cycle, journey, context) {
    var key = cycle && cycle.diagnosisKey || "offer";
    var business = journey && journey.profile && journey.profile.businessName || "کسب‌وکار";
    var offer = journey && journey.profile && journey.profile.offer || "محصول یا خدمت اصلی";
    context = context || {};

    if (key === "acquisition") return {
      execution_title: "متن جذب آماده انتشار",
      execution_type: "content_cta",
      artifact: "هوک:\nاگر «" + (context.pain || "این مشکل") + "» برات آشناست، قبل از انتخاب راه‌حل این نکته رو ببین.\n\nمتن:\nدر " + business + " برای «" + offer + "» روی همین مسئله تمرکز کردیم: " + (context.pain || "درد مشخص مخاطب") + ". هدف اینه که قبل از معرفی محصول، دقیقاً همون چیزی رو بگیم که مخاطب الان باهاش درگیره.\n\nCTA:\n" + ctaLine(context.cta),
      usage_hint: "همین نسخه را با یک تصویر یا ویدیوی ساده منتشر کن و CTA را تغییر نده.",
      check_in_days: 3
    };

    if (key === "sales_process") return {
      execution_title: "پاسخ آماده برای تردید خرید",
      execution_type: "sales_reply",
      artifact: "کاملاً قابل درکه که قبل از تصمیم درباره «" + (context.objection || "این موضوع") + "» مطمئن بشی.\n\nچیزی که می‌تونم شفاف بگم اینه: " + (context.proof || "اطلاعات واقعی محصول را دقیق می‌گیم") + ".\n\nاگر بخوای، بر اساس نیاز خودت می‌گم «" + offer + "» واقعاً انتخاب مناسبی هست یا نه.\n\nاگر موافقی، بگو مهم‌ترین چیزی که هنوز باید بدونی چیه؟",
      usage_hint: "این پاسخ را در اولین گفت‌وگوی واقعی مرتبط استفاده کن.",
      check_in_days: 2
    };

    if (key === "focus") return {
      execution_title: "برنامه اجرایی یک‌تمرکزی",
      execution_type: "focus_plan",
      artifact: "نتیجه این چرخه:\n" + (context.outcome || cycle.metric && cycle.metric.metric || "یک نتیجه مشخص") + "\n\nزمان واقعی امروز:\n" + (context.available_time || "60") + " دقیقه\n\nکار اصلی:\n" + (cycle.action && cycle.action.title || "کار فعلی") + "\n\nفعلاً متوقف کن:\nهر کاری که مستقیم به همین نتیجه کمک نمی‌کند.\n\nتعریف انجام‌شدن:\nاقدام انجام شده و عدد نتیجه ثبت شده باشد.",
      usage_hint: "تا ثبت نتیجه، کار جدیدی به این چرخه اضافه نکن.",
      check_in_days: 1
    };

    var subject = context.subject || offer;
    return {
      execution_title: "پیشنهاد فروش آماده اجرا",
      execution_type: "offer_copy",
      artifact: "پیشنهاد اصلی:\n«" + subject + "» برای " + (context.audience || "مخاطب اصلی این پیشنهاد") + " ساخته شده؛ با یک انتخاب روشن و قدم بعدی مشخص.\n\nاستوری ۱:\nاگر نتیجه‌ای که می‌خوای مشخصه ولی بین گزینه‌ها گیر کردی، اول باید انتخاب مناسب نیاز خودت رو پیدا کنی.\n\nاستوری ۲:\nدر " + business + "، «" + subject + "» را برای همین نیاز ارائه می‌کنیم.\n\nاستوری ۳ / CTA:\n" + ctaLine(context.cta),
      usage_hint: "این سه بخش را پشت‌سرهم منتشر کن و CTA را ثابت نگه دار.",
      check_in_days: 2
    };
  }

  async function generateExecution(context) {
    if (preparing) return;
    var journey = readJourney();
    var cycle = currentCycle(journey);
    if (!journey || !cycle) return;

    preparing = true;
    cycle.executionContext = context || {};
    writeJourney(journey);
    renderLoading(cycle);
    showOnly("execution");
    if (window.hxTrack) window.hxTrack("execution_context_submitted", { diagnosis_key: cycle.diagnosisKey, context_fields: Object.keys(context || {}).length });
    if (window.hxTrack) window.hxTrack("execution_requested", { diagnosis_key: cycle.diagnosisKey, cycle: journey.cycles.length });

    var payload = {
      sessionId: id("hx-execution"),
      cycleNumber: journey.cycles.length,
      profile: journey.profile || {},
      answers: journey.answers || {},
      diagnosisKey: cycle.diagnosisKey,
      executionContext: context || {},
      currentPlan: { summary: cycle.summary || "", priority: cycle.priority || {}, action: cycle.action || {}, metric: cycle.metric || {} }
    };

    try {
      var controller = new AbortController();
      var timer = window.setTimeout(function () { controller.abort(); }, 23000);
      var response = await fetch("/api/execute", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload), signal: controller.signal });
      window.clearTimeout(timer);
      var data = await response.json();
      if (!response.ok || !data.execution) throw new Error(data.error || "execution_failed");
      saveExecution(journey, cycle, data.execution, data.source || "api", context);
    } catch (error) {
      saveExecution(journey, cycle, localExecution(cycle, journey, context), "local-fallback", context);
      if (window.hxShowToast) window.hxShowToast("اتصال هوشمند قطع شد؛ نسخه اجرایی شخصی‌سازی‌شده اولیه آماده است.");
    } finally {
      preparing = false;
    }

    journey = readJourney();
    cycle = currentCycle(journey);
    renderExecution(journey, cycle);
    injectJourney();
  }

  function openContext() {
    var journey = readJourney();
    var cycle = currentCycle(journey);
    if (!journey || !cycle) {
      if (window.hxShowToast) window.hxShowToast("اول یک مسیر فعال بساز.");
      return;
    }
    if (cycle.execution && cycle.execution.artifact) return openExisting();
    renderContext(journey, cycle);
    showOnly("execution");
  }

  function openExisting() {
    var journey = readJourney();
    var cycle = currentCycle(journey);
    if (!journey || !cycle || !cycle.execution) return openContext();
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
    }).catch(function () { if (window.hxShowToast) window.hxShowToast("کپی انجام نشد"); });
  }

  function markExecuted() {
    var journey = readJourney();
    var cycle = currentCycle(journey);
    if (!journey || !cycle || !cycle.execution || cycle.execution.executedAt) return;
    cycle.execution.executedAt = now();
    cycle.execution.checkInAt = addDays(cycle.execution.check_in_days);
    writeJourney(journey);
    if (window.hxJourneyMarkDone) window.hxJourneyMarkDone();
    journey = readJourney();
    cycle = currentCycle(journey);
    if (window.hxTrack) window.hxTrack("execution_completed", { diagnosis_key: cycle.diagnosisKey, execution_type: cycle.execution.execution_type, check_in_at: cycle.execution.checkInAt });
    renderExecution(journey, cycle);
    injectJourney();
    if (window.hxCompletionRefresh) window.hxCompletionRefresh();
    if (window.hxShowToast) window.hxShowToast("اجرا ثبت شد؛ حالا هوشکس منتظر نتیجه همین اقدام می‌ماند.");
  }

  function journeyCheckinHtml(cycle) {
    if (!cycle || !cycle.execution) return "";
    return '<div class="hx-inline-execution-status"><span>خروجی آماده</span><strong>' + esc(cycle.execution.execution_title || "Execution") + '</strong><small>بررسی نتیجه: ' + esc(checkinLabel(cycle.execution)) + '</small></div>';
  }

  function injectJourney() {
    var journey = readJourney();
    var cycle = currentCycle(journey);
    var plan = document.querySelector("#screen-journey .hx-current-plan");
    if (!plan || !cycle) return;
    var signature = [cycle.id, cycle.status, Boolean(cycle.execution), cycle.execution && cycle.execution.executedAt, cycle.execution && cycle.execution.checkInAt].join("|");
    if (plan.getAttribute("data-hx-execution-signature") === signature) return;
    plan.setAttribute("data-hx-execution-signature", signature);

    var actions = plan.querySelector(".hx-plan-actions");
    if (actions) {
      var button = actions.querySelector("[data-execution-action]");
      var desiredAction = cycle.execution ? "open" : "prepare";
      var desiredText = cycle.execution ? "خروجی آماده رو ببین" : "این کار رو برام آماده کن ←";
      if (!button) {
        button = document.createElement("button");
        button.type = "button";
        actions.insertBefore(button, actions.firstChild);
      }
      button.className = cycle.execution ? "hx-tool hx-execute-cta" : "hx-secondary hx-execute-cta";
      button.setAttribute("data-execution-action", desiredAction);
      if (button.textContent !== desiredText) button.textContent = desiredText;
    }

    var existing = plan.querySelector("[data-hx-execution-status]");
    if (cycle.execution) {
      if (!existing) {
        existing = document.createElement("div");
        existing.setAttribute("data-hx-execution-status", "true");
        var metric = plan.querySelector(".hx-plan-metric");
        if (metric) metric.insertAdjacentElement("afterend", existing);
      }
      var statusHtml = journeyCheckinHtml(cycle);
      if (existing && existing.innerHTML !== statusHtml) existing.innerHTML = statusHtml;
    } else if (existing) existing.remove();
  }

  function injectResult() {
    if (window.hxCurrentResultKind !== "diagnosis") return;
    var journey = readJourney();
    var cycle = currentCycle(journey);
    var card = document.querySelector("#result-content .hx-decision-action, #result-content .hx-result-card.hx-action");
    if (!card || !cycle || document.querySelector("#result-content [data-execution-action]")) return;
    var button = document.createElement("button");
    button.type = "button";
    button.className = "hx-secondary hx-result-execute";
    button.setAttribute("data-execution-action", cycle.execution ? "open" : "prepare");
    button.textContent = cycle.execution ? "خروجی آماده رو ببین" : "این کار رو برام آماده کن ←";
    card.appendChild(button);
  }

  function bind() {
    document.addEventListener("submit", function (event) {
      if (!event.target || event.target.id !== "execution-context-form") return;
      event.preventDefault();
      var context = collectContext();
      if (context) generateExecution(context);
    }, true);

    document.addEventListener("click", function (event) {
      var target = event.target.closest && event.target.closest("[data-execution-action]");
      if (!target) return;
      var action = target.getAttribute("data-execution-action");
      if (action === "prepare") openContext();
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
    injectJourney();
    injectResult();
    if (window.MutationObserver) {
      var queued = false;
      new MutationObserver(function () {
        if (queued) return;
        queued = true;
        window.setTimeout(function () { queued = false; injectJourney(); injectResult(); }, 25);
      }).observe(document.body, { childList: true, subtree: true });
    }
  }

  window.hxExecutionPrepare = openContext;
  window.hxExecutionOpen = openExisting;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
