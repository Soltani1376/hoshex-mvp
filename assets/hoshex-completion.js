(function () {
  "use strict";

  var STORAGE_KEY = "hx_business_journey_v1";
  var renderQueued = false;

  function esc(value) {
    if (window.hxEscape) return window.hxEscape(value);
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function parseJson(value) {
    if (!value || typeof value !== "string") return null;
    try { return JSON.parse(value); } catch (error) { return null; }
  }

  function readJourney() {
    if (window.hxJourneyRead) return window.hxJourneyRead();
    try {
      var value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
      return value && Array.isArray(value.cycles) ? value : null;
    } catch (error) { return null; }
  }

  function currentCycle(journey) {
    if (!journey || !journey.cycles || !journey.cycles.length) return null;
    return journey.cycles.find(function (cycle) { return cycle.id === journey.currentCycleId; }) || journey.cycles[journey.cycles.length - 1];
  }

  function installRequestBridge() {
    if (!window.fetch || window.fetch.__hxCompletionWrapped) return;
    var nativeFetch = window.fetch.bind(window);

    async function wrappedFetch(input, init) {
      var url = typeof input === "string" ? input : input && input.url || "";
      var method = String(init && init.method || input && input.method || "GET").toUpperCase();
      var isDiagnosis = /\/api\/chat(?:\?|$)/.test(url) && method === "POST";

      if (isDiagnosis && init && typeof init.body === "string") {
        var request = parseJson(init.body);
        if (request) window.hxLastDiagnosisRequest = request;
      }

      var response = await nativeFetch(input, init);
      if (isDiagnosis) {
        try {
          var data = await response.clone().json();
          if (data && data.diagnosis) window.hxLastDiagnosisData = data.diagnosis;
          window.hxLastDiagnosisMeta = data && data.meta || {};
        } catch (error) {
          window.hxLastDiagnosisMeta = {};
        }
      }
      return response;
    }

    wrappedFetch.__hxCompletionWrapped = true;
    window.fetch = wrappedFetch;
  }

  function channelLabel(value) {
    return {
      instagram: "فروش اینستاگرامی",
      website: "فروش از سایت",
      store: "فروش حضوری",
      multi_channel: "فروش چندکاناله"
    }[value] || "مسیر فروش ثبت‌شده";
  }

  function focusLabel(value) {
    return {
      content: "محتوا",
      ads: "جذب و تبلیغات",
      sales: "فروش",
      product: "محصول / خدمت"
    }[value] || "اولویت فعلی";
  }

  function diagnosisLabel(key) {
    return {
      acquisition: "ورودی مشتری",
      offer: "پیشنهاد فروش",
      sales_process: "فرآیند فروش",
      focus: "تمرکز اجرایی"
    }[key] || "مسئله اصلی";
  }

  function deriveEvidence(answers, diagnosisKey) {
    answers = answers || {};
    var text = String(answers.last_growth_action || "").trim();
    var evidence = [];

    if (/بازدید.{0,25}(فروش|خرید).{0,15}(کم|ندار|نشد|نمی)/i.test(text)) evidence.push("بازدید یا توجه داری اما همان توجه به خرید متناسب تبدیل نشده");
    if (/(دایرکت|مشتری|نفر).{0,40}(قیمت|سؤال|پرس).{0,40}(نمی.?خر|نخرید|مردد|منصرف)/i.test(text)) evidence.push("مشتری تا سؤال و قیمت جلو می‌آید اما قبل از خرید متوقف می‌شود");
    if (/(تبلیغ|ریلز|محتوا).{0,35}(پیام|سرنخ|مشتری).{0,15}(نگرف|نیا|نداد)/i.test(text)) evidence.push("اقدام جذب قبلی ورودی یا سرنخ کافی نساخته");
    if (/(هم.?زمان|چند.{0,20}(کار|کانال|محصول|کمپین))/i.test(text)) evidence.push("چند مسیر هم‌زمان باز است و تمرکز اجرایی پخش شده");
    if (/پیشنهاد.{0,18}(واضح|مشخص).{0,12}(نیست|ندار|نبود)/i.test(text)) evidence.push("پیشنهاد فروش هنوز برای مخاطب به‌اندازه کافی روشن نیست");

    if (diagnosisKey === "acquisition" && answers.main_problem === "no_leads") evidence.push("خودت هم کمبود مشتری یا سرنخ را مهم‌ترین مانع فعلی گزارش کردی");
    if (diagnosisKey === "offer" && answers.main_problem === "low_conversion") evidence.push("گفتی توجه یا بازدید هست اما فروش پایین‌تر از انتظار است");
    if (diagnosisKey === "sales_process" && answers.main_problem === "sales_process") evidence.push("گفتی مشتری وارد مسیر می‌شود ولی تصمیم خرید کامل نمی‌شود");
    if (diagnosisKey === "focus" && answers.main_problem === "no_focus") evidence.push("گفتی هنوز اولویت اجرایی واحد و روشنی نداری");

    if (answers.sales_trend === "new" && diagnosisKey === "acquisition") evidence.push("کسب‌وکار هنوز در مرحله ساخت ورودی اولیه است");
    if (answers.current_focus === "ads" && diagnosisKey === "acquisition") evidence.push("بخش زیادی از تمرکز فعلی روی جذب است و باید نتیجه همان مسیر اندازه‌گیری شود");
    if (answers.current_focus === "sales" && diagnosisKey === "sales_process") evidence.push("تمرکز فعلی روی فروش است؛ پس اصطکاک نزدیک تصمیم خرید داده مهم‌تری می‌دهد");
    if (answers.sales_channel === "instagram" && diagnosisKey === "offer") evidence.push("در اینستاگرام، وضوح پیشنهاد و CTA مستقیماً روی تبدیل اثر می‌گذارد");
    if (answers.sales_channel === "website" && diagnosisKey === "offer") evidence.push("در سایت، مخاطب باید خیلی سریع ارزش و قدم بعدی خرید را بفهمد");

    return evidence.filter(function (item, index, list) { return list.indexOf(item) === index; }).slice(0, 3);
  }

  function progressHtml(cycle) {
    var executed = Boolean(cycle && (cycle.status === "done" || cycle.execution && cycle.execution.executedAt));
    var waitingResult = Boolean(cycle && cycle.status === "done");
    var steps = [
      { label: "تشخیص", state: "done" },
      { label: "اجرا", state: executed ? "done" : "current" },
      { label: "نتیجه", state: waitingResult ? "current" : "future" },
      { label: "قدم بعدی", state: "future" }
    ];
    return '<div class="hx-path-progress" aria-label="وضعیت مسیر هوشکس">' + steps.map(function (step, index) {
      return '<div class="hx-path-step is-' + step.state + '"><span>' + (step.state === "done" ? "✓" : String(index + 1)) + '</span><small>' + esc(step.label) + '</small></div>';
    }).join('<i aria-hidden="true"></i>') + '</div>';
  }

  function primaryAction(cycle) {
    if (!cycle) return { label: "شروع تشخیص ←", action: "new-diagnosis" };
    if (cycle.status === "done") return { label: "ثبت نتیجه و ادامه مسیر ←", action: "feedback" };
    if (cycle.execution && cycle.execution.artifact) return { label: "ادامه اجرا ←", action: "execution" };
    return { label: "این کار رو برام آماده کن ←", action: "prepare" };
  }

  function renderActiveHome() {
    var landing = document.getElementById("screen-landing");
    if (!landing) return;
    var journey = readJourney();
    var cycle = currentCycle(journey);
    var existing = landing.querySelector("[data-hx-active-home]");

    if (!journey || !cycle) {
      landing.classList.remove("hx-has-active-home");
      if (existing) existing.remove();
      return;
    }

    landing.classList.add("hx-has-active-home");
    if (!existing) {
      existing = document.createElement("div");
      existing.setAttribute("data-hx-active-home", "true");
      existing.className = "hx-active-home";
      var hero = landing.querySelector(".hx-hero");
      if (hero) hero.insertAdjacentElement("beforebegin", existing);
      else landing.prepend(existing);
    }

    var business = journey.profile && journey.profile.businessName || "کسب‌وکارت";
    var offer = journey.profile && journey.profile.offer || "محصول یا خدمت اصلی";
    var answers = journey.answers || {};
    var action = primaryAction(cycle);
    var status = cycle.status === "done" ? "منتظر نتیجه" : cycle.execution && cycle.execution.executedAt ? "اجرا ثبت شده" : cycle.execution ? "خروجی آماده" : "در حال اجرا";
    var checkin = cycle.execution && cycle.execution.checkInAt ? formatDate(cycle.execution.checkInAt) : "بعد از اجرا";

    existing.innerHTML = [
      '<div class="hx-active-home-head">',
        '<div><p class="hx-active-kicker">مسیر هوشکس · قدم ' + esc(journey.cycles.length) + '</p><h1>ادامه بدیم، ' + esc(business) + '؟</h1><p>این ورود ادامه دفعه قبله؛ لازم نیست از صفر شروع کنی.</p></div>',
        '<button class="hx-active-new" type="button" data-completion-action="new-diagnosis">تشخیص جدید</button>',
      '</div>',
      '<div class="hx-business-snapshot">',
        '<div class="hx-snapshot-name"><span>BUSINESS SNAPSHOT</span><strong>' + esc(business) + '</strong><small>' + esc(offer) + '</small></div>',
        '<div><span>کانال</span><strong>' + esc(channelLabel(answers.sales_channel)) + '</strong></div>',
        '<div><span>تمرکز فعلی</span><strong>' + esc(diagnosisLabel(cycle.diagnosisKey)) + '</strong></div>',
        '<div><span>وضعیت</span><strong>' + esc(status) + '</strong></div>',
      '</div>',
      progressHtml(cycle),
      '<article class="hx-active-task">',
        '<div class="hx-active-task-main"><span>PRIORITY 01</span><h2>' + esc(cycle.priority && cycle.priority.title || "اولویت فعلی") + '</h2><p class="hx-active-action-label">کاری که الان باید جلو ببری</p><h3>' + esc(cycle.action && cycle.action.title || "کار فعلی") + '</h3></div>',
        '<div class="hx-active-task-meta"><div><span>معیار نتیجه</span><strong>' + esc(cycle.metric && cycle.metric.metric || "نتیجه قابل‌اندازه‌گیری") + '</strong></div><div><span>بررسی بعدی</span><strong>' + esc(checkin) + '</strong></div></div>',
        '<div class="hx-active-actions"><button class="hx-primary" type="button" data-completion-action="' + esc(action.action) + '">' + esc(action.label) + '</button><button class="hx-secondary" type="button" data-completion-action="journey">مسیر کامل من</button></div>',
      '</article>'
    ].join("");
  }

  function formatDate(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return "بعد از اجرا";
    try { return new Intl.DateTimeFormat("fa-IR-u-ca-gregory", { day: "numeric", month: "long" }).format(date); }
    catch (error) { return date.toISOString().slice(0, 10); }
  }

  function enhanceJourney() {
    var target = document.getElementById("journey-content");
    if (!target || !target.children.length) return;
    var journey = readJourney();
    var cycle = currentCycle(journey);
    if (!journey || !cycle) return;

    var old = target.querySelector("[data-hx-journey-snapshot]");
    if (!old) {
      old = document.createElement("div");
      old.setAttribute("data-hx-journey-snapshot", "true");
      old.className = "hx-journey-snapshot-wrap";
      var layout = target.querySelector(".hx-journey-layout");
      if (layout) layout.insertAdjacentElement("beforebegin", old);
    }
    if (!old) return;

    var business = journey.profile && journey.profile.businessName || "کسب‌وکارت";
    var answers = journey.answers || {};
    old.innerHTML = [
      '<div class="hx-business-snapshot hx-business-snapshot-compact">',
        '<div class="hx-snapshot-name"><span>BUSINESS SNAPSHOT</span><strong>' + esc(business) + '</strong><small>' + esc(journey.profile && journey.profile.offer || "") + '</small></div>',
        '<div><span>کانال</span><strong>' + esc(channelLabel(answers.sales_channel)) + '</strong></div>',
        '<div><span>تمرکز</span><strong>' + esc(focusLabel(answers.current_focus)) + '</strong></div>',
      '</div>',
      progressHtml(cycle)
    ].join("");
  }

  function handleAction(action) {
    if (action === "new-diagnosis") {
      if (window.hxStartFlow) window.hxStartFlow();
      else {
        var start = document.querySelector('[data-action="start"]');
        if (start) start.click();
      }
    }
    if (action === "journey" && window.hxJourneyOpen) window.hxJourneyOpen();
    if (action === "feedback" && window.hxJourneyOpenFeedback) window.hxJourneyOpenFeedback();
    if (action === "execution" && window.hxExecutionOpen) window.hxExecutionOpen();
    if (action === "prepare" && window.hxExecutionPrepare) window.hxExecutionPrepare();
  }

  function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    window.setTimeout(function () {
      renderQueued = false;
      renderActiveHome();
      enhanceJourney();
    }, 30);
  }

  function init() {
    installRequestBridge();
    document.addEventListener("click", function (event) {
      var target = event.target.closest && event.target.closest("[data-completion-action]");
      if (!target) return;
      handleAction(target.getAttribute("data-completion-action"));
    }, true);
    renderActiveHome();
    enhanceJourney();
    if (window.MutationObserver) new MutationObserver(queueRender).observe(document.body, { childList: true, subtree: true });
    window.addEventListener("storage", queueRender);
  }

  window.hxCompletionEvidence = deriveEvidence;
  window.hxCompletionRefresh = queueRender;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
