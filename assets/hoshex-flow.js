(function () {
  "use strict";

  var QUESTIONS = [
    {
      id: "sales_channel",
      title: "کانال اصلی فروشت کدام است؟",
      subtitle: "جایی را انتخاب کن که بیشتر مشتری فعلی‌ات از آن می‌آید.",
      options: [
        { value: "instagram", label: "اینستاگرام", hint: "پیج و دایرکت" },
        { value: "website", label: "سایت", hint: "فروش یا دریافت سفارش آنلاین" },
        { value: "store", label: "مغازه", hint: "فروش حضوری" },
        { value: "multi_channel", label: "چند کانال", hint: "ترکیبی از چند مسیر" }
      ]
    },
    {
      id: "main_problem",
      title: "بزرگ‌ترین مشکل فعلی‌ات چیست؟",
      subtitle: "همان چیزی را انتخاب کن که بیشتر از همه ذهنت را درگیر کرده.",
      options: [
        { value: "low_conversion", label: "بازدید دارم ولی فروش کم است", hint: "مخاطب می‌بیند، اما نمی‌خرد" },
        { value: "no_leads", label: "مشتری کافی ندارم", hint: "ورودی یا سرنخ کم است" },
        { value: "sales_process", label: "مشتری می‌آید ولی خرید نمی‌کند", hint: "تردید در لحظه تصمیم" },
        { value: "no_focus", label: "نمی‌دانم روی چه کاری تمرکز کنم", hint: "کارها زیاد و اولویت مبهم است" }
      ]
    },
    {
      id: "sales_trend",
      title: "فروش اخیرت چه تغییری کرده؟",
      subtitle: "یک بازه تقریبی دو تا چهار هفته‌ای را در نظر بگیر.",
      options: [
        { value: "decreased", label: "کمتر شده" },
        { value: "stable", label: "تقریباً ثابت مانده" },
        { value: "growing", label: "رشد کرده" },
        { value: "new", label: "تازه شروع کردم" }
      ]
    },
    {
      id: "current_focus",
      title: "الان بیشتر روی چه کاری تمرکز داری؟",
      subtitle: "کاری را بگو که این روزها بیشترین وقتت را می‌گیرد.",
      options: [
        { value: "content", label: "تولید محتوا" },
        { value: "ads", label: "تبلیغات" },
        { value: "sales", label: "فروش" },
        { value: "product", label: "بهبود محصول یا خدمت" }
      ]
    },
    {
      id: "last_growth_action",
      title: "آخرین کاری که برای رشد انجام دادی چه بود؟",
      subtitle: "حتی اگر نتیجه نگرفته، کوتاه و واقعی بنویس.",
      type: "textarea",
      placeholder: "مثلاً یک ریلز گذاشتم، تخفیف دادم یا تبلیغ اجرا کردم…"
    }
  ];

  var state = {
    profile: { businessName: "", offer: "" },
    answers: {},
    questionIndex: 0,
    sessionId: "hx-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8)
  };

  var screenNames = ["landing", "profile", "questions", "loading", "result"];
  var faDigits = "۰۱۲۳۴۵۶۷۸۹";

  function faNumber(number) {
    return String(number).replace(/[0-9]/g, function (digit) { return faDigits[digit]; });
  }

  function escapeHtml(value) {
    return window.hxEscape ? window.hxEscape(value) : String(value == null ? "" : value);
  }

  function showScreen(name) {
    screenNames.forEach(function (screenName) {
      var screen = document.getElementById("screen-" + screenName);
      if (screen) screen.hidden = screenName !== name;
    });
    state.screen = name;
    window.scrollTo({ top: 0, behavior: "smooth" });
    var focusTarget = document.querySelector("#screen-" + name + " h1, #screen-" + name + " h2");
    if (focusTarget) {
      window.setTimeout(function () { focusTarget.setAttribute("tabindex", "-1"); focusTarget.focus({ preventScroll: true }); }, 40);
    }
  }

  function resetForms() {
    var profileForm = document.getElementById("profile-form");
    var questionForm = document.getElementById("question-form");
    if (profileForm) profileForm.reset();
    if (questionForm) questionForm.reset();
    var profileError = document.getElementById("profile-error");
    var questionError = document.getElementById("question-error");
    if (profileError) profileError.textContent = "";
    if (questionError) questionError.textContent = "";
  }

  function resetFlow() {
    state.profile = { businessName: "", offer: "" };
    state.answers = {};
    state.questionIndex = 0;
    state.sessionId = "hx-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
    resetForms();
    showScreen("landing");
    if (window.hxTrack) window.hxTrack("diagnosis_restart");
  }

  function startFlow() {
    state.profile = { businessName: "", offer: "" };
    state.answers = {};
    state.questionIndex = 0;
    resetForms();
    showScreen("profile");
    if (window.hxTrack) window.hxTrack("diagnosis_start", { version: "v2" });
    var offer = document.getElementById("offer");
    if (offer) window.setTimeout(function () { offer.focus(); }, 80);
  }

  function setError(id, message) {
    var element = document.getElementById(id);
    if (element) element.textContent = message || "";
  }

  function renderQuestion() {
    var question = QUESTIONS[state.questionIndex];
    var count = document.getElementById("question-count");
    var progress = document.getElementById("question-progress");
    var content = document.getElementById("question-content");
    var next = document.getElementById("question-next");
    if (!question || !content) return;

    if (count) count.textContent = "سؤال " + faNumber(state.questionIndex + 1) + " از " + faNumber(QUESTIONS.length);
    if (progress) progress.style.width = ((state.questionIndex + 1) / QUESTIONS.length * 100) + "%";
    if (next) next.innerHTML = state.questionIndex === QUESTIONS.length - 1 ? "دریافت تشخیص <span aria-hidden=\"true\">←</span>" : "ادامه <span aria-hidden=\"true\">←</span>";
    setError("question-error", "");

    var saved = state.answers[question.id] || "";
    var html = "<div class=\"hx-field\"><label>" + escapeHtml(question.title) + "</label><p class=\"hx-hint\">" + escapeHtml(question.subtitle) + "</p>";
    if (question.type === "textarea") {
      html += "<textarea class=\"hx-textarea\" id=\"question-text\" maxlength=\"600\" placeholder=\"" + escapeHtml(question.placeholder) + "\" required>" + escapeHtml(saved) + "</textarea>";
    } else {
      html += '<div class="hx-options" role="radiogroup" aria-label="' + escapeHtml(question.title) + '">';
      question.options.forEach(function (option) {
        var selected = saved === option.value;
        html += '<button type="button" class="hx-option' + (selected ? ' is-selected' : '') + '" role="radio" aria-checked="' + selected + '" data-option-value="' + escapeHtml(option.value) + '"><span>' + escapeHtml(option.label) + '</span>' + (option.hint ? '<small>' + escapeHtml(option.hint) + '</small>' : '') + '</button>';
      });
      html += "</div>";
    }
    html += "</div>";
    content.innerHTML = html;

    content.querySelectorAll("[data-option-value]").forEach(function (button) {
      button.addEventListener("click", function () {
        content.querySelectorAll("[data-option-value]").forEach(function (item) { item.classList.remove("is-selected"); item.setAttribute("aria-checked", "false"); });
        button.classList.add("is-selected");
        button.setAttribute("aria-checked", "true");
        state.answers[question.id] = button.getAttribute("data-option-value");
        setError("question-error", "");
        if (window.hxTrack) window.hxTrack("question_answered", { question: question.id, index: state.questionIndex + 1 });
      });
    });
    var textarea = content.querySelector("#question-text");
    if (textarea) textarea.addEventListener("input", function () { state.answers[question.id] = textarea.value; setError("question-error", ""); });
    var focus = content.querySelector(".is-selected, #question-text, [data-option-value]");
    if (focus) window.setTimeout(function () { focus.focus(); }, 45);
    if (window.hxTrack) window.hxTrack("question_view", { question: question.id, index: state.questionIndex + 1 });
  }

  function validateQuestion(question) {
    var value = state.answers[question.id];
    if (!value || !String(value).trim()) {
      setError("question-error", "یک گزینه را انتخاب کن تا ادامه بدهیم.");
      return false;
    }
    if (question.type === "textarea" && String(value).trim().length < 3) {
      setError("question-error", "یک جمله کوتاه بنویس؛ حتی چند کلمه کافی است.");
      return false;
    }
    return true;
  }

  function localFallback() {
    var problem = state.answers.main_problem;
    var channel = state.answers.sales_channel;
    var offer = state.profile.offer || "کسب‌وکارت";
    if (problem === "no_leads") {
      return { business_summary: offer + " فعلاً ورودی کافی برای رشد پایدار ندارد.", main_problem: { title: "ورودی مشتری کم است", reason: "تا وقتی تعداد آدم‌های مناسب که پیشنهادت را می‌بینند بالا نرود، بهینه‌سازی خرید نتیجه محدودی دارد.", severity: "high" }, priorities: [{ rank: 1, title: "یک مسیر جذب مشخص بساز", description: "یک مخاطب و یک پیشنهاد ورودی را انتخاب کن و همان را در کانال اصلی تکرار کن." }], today_action: { title: "یک محتوای جذب مشتری با دعوت به پیام بساز", steps: ["یک مشکل مشخص مخاطب را انتخاب کن.", "یک راه‌حل کوتاه و مرتبط با " + offer + " ارائه بده.", "در پایان فقط یک CTA برای پیام یا ثبت سفارش بگذار."], time_required: "۶۰ تا ۹۰ دقیقه" }, success_metric: { metric: "حداقل ۱۰ پیام یا سرنخ مرتبط", period: "تا ۷ روز آینده" }, avoid_now: "فعلاً تبلیغ پولی را بدون یک پیشنهاد و CTA مشخص شروع نکن.", next_step: "محتوای جذب را با همان پیام، سه بار در هفته تکرار و مقایسه کن." };
    }
    if (problem === "sales_process") {
      return { business_summary: "مشتری به " + offer + " نزدیک می‌شود، اما در لحظه تصمیم مکث می‌کند.", main_problem: { title: "فرآیند تبدیل مشتری ناقص است", reason: "احتمالاً بخشی از تردیدهای مشتری مثل اعتماد، قیمت یا قدم بعدی قبل از خرید پاسخ داده نمی‌شود.", severity: "high" }, priorities: [{ rank: 1, title: "تردیدهای خرید را همان‌جا جواب بده", description: "ارزش، دلیل اعتماد و روش سفارش را در یک مسیر کوتاه و واضح کنار هم بگذار." }], today_action: { title: "پاسخ آماده برای سه اعتراض پرتکرار بنویس", steps: ["سه سؤال یا اعتراضی که مشتری‌ها تکرار می‌کنند جمع کن.", "برای هرکدام یک پاسخ کوتاه با مدرک یا مثال بنویس.", "پاسخ‌ها را در دایرکت، صفحه محصول یا ویترین قرار بده."], time_required: "۴۵ تا ۶۰ دقیقه" }, success_metric: { metric: "افزایش پاسخ‌های ادامه‌دار و درخواست قیمت یا سفارش", period: "تا ۷ روز آینده" }, avoid_now: "فعلاً تخفیف جدید نده؛ اول دلیل نخریدن را روشن کن.", next_step: "پاسخ‌های مؤثر را به متن ثابت فروش و محتوای بعدی تبدیل کن." };
    }
    if (problem === "no_focus") {
      return { business_summary: "برای " + offer + " چند مسیر هم‌زمان باز است و انرژی روی یک نتیجه متمرکز نمی‌شود.", main_problem: { title: "اولویت اجرایی روشن نیست", reason: "پخش شدن زمان بین محتوا، تبلیغ و کارهای جانبی باعث می‌شود هیچ اقدام واحدی فرصت نتیجه دادن پیدا نکند.", severity: "medium" }, priorities: [{ rank: 1, title: "یک نتیجه را برای این هفته انتخاب کن", description: "فقط یک عدد قابل اندازه‌گیری را هدف بگیر و بقیه کارها را موقتاً کنار بگذار." }], today_action: { title: "برنامه هفت‌روزه یک‌هدفه بنویس", steps: ["یک هدف عددی برای هفت روز آینده تعیین کن.", "فقط یک کانال و یک پیشنهاد را انتخاب کن.", "سه کار روزانه مرتبط با همان هدف را در تقویم بگذار."], time_required: "۳۰ تا ۴۵ دقیقه" }, success_metric: { metric: "انجام حداقل ۵ اقدام مستقیم روی همان هدف", period: "تا ۷ روز آینده" }, avoid_now: "فعلاً ابزار، دوره یا کمپین تازه اضافه نکن.", next_step: "در پایان هفته عدد هدف را بررسی کن و فقط یک اصلاح انجام بده." };
    }
    return { business_summary: "در " + (channel === "instagram" ? "اینستاگرام" : channel === "website" ? "سایت" : "مسیر فروش") + "، بازدید به اندازه کافی به اقدام خرید تبدیل نمی‌شود.", main_problem: { title: "پیشنهاد فروش به اندازه کافی واضح نیست", reason: "وقتی مخاطب دقیقاً نداند چه چیزی، برای چه کسی و با چه قدمی باید بخرد، توجه به فروش تبدیل نمی‌شود.", severity: "high" }, priorities: [{ rank: 1, title: "پیشنهاد فروش را در یک جمله شفاف کن", description: "یک محصول، یک مخاطب و یک دلیل خرید را کنار یک CTA واحد قرار بده." }], today_action: { title: "یک پیشنهاد فروش یک‌جمله‌ای و سه استوری بساز", steps: ["یک محصول یا خدمت اصلی را انتخاب کن.", "نتیجه‌ای که برای مخاطب می‌سازد را در یک جمله بنویس.", "سه استوری منتشر کن: مشکل، پیشنهاد، دعوت به اقدام."], time_required: "۶۰ دقیقه" }, success_metric: { metric: "حداقل ۵ پاسخ، کلیک یا درخواست خرید مرتبط", period: "تا ۴۸ ساعت آینده" }, avoid_now: "فعلاً محصول جدید یا کانال تازه اضافه نکن.", next_step: "اگر پاسخ گرفتی، همین پیشنهاد را به صفحه فروش و ریلز تبدیل کن." };
  }

  async function submitDiagnosis() {
    showScreen("loading");
    if (window.hxTrack) window.hxTrack("diagnosis_submit", { question_count: QUESTIONS.length });
    var payload = { sessionId: state.sessionId, profile: state.profile, answers: state.answers };
    try {
      var controller = new AbortController();
      var timer = window.setTimeout(function () { controller.abort(); }, 22000);
      var response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload), signal: controller.signal });
      window.clearTimeout(timer);
      var data = await response.json();
      if (!response.ok || !data.diagnosis) throw new Error(data.error || "diagnosis_failed");
      window.hxRenderResult(data.diagnosis, { source: data.source || "api" });
      showScreen("result");
      if (window.hxTrack) window.hxTrack("diagnosis_success", { source: data.source || "api" });
    } catch (error) {
      // A deterministic local diagnosis keeps the MVP usable during an API outage.
      window.hxRenderResult(localFallback(), { source: "local-fallback" });
      showScreen("result");
      if (window.hxTrack) window.hxTrack("diagnosis_fallback", { reason: error && error.name === "AbortError" ? "timeout" : "request_error" });
      if (window.hxShowToast) window.hxShowToast("اتصال تحلیل قطع شد؛ نتیجه اولیه آماده است.");
    }
  }

  function showDemo() {
    window.hxRenderResult(window.hxSampleDiagnosis, { source: "demo" });
    showScreen("result");
    if (window.hxTrack) window.hxTrack("demo_view");
  }

  function bindEvents() {
    document.querySelectorAll("[data-action]").forEach(function (element) {
      element.addEventListener("click", function (event) {
        var action = element.getAttribute("data-action");
        if (action === "brand-home") { event.preventDefault(); resetFlow(); }
        if (action === "start") startFlow();
        if (action === "show-demo") showDemo();
        if (action === "back-home") showScreen("landing");
        if (action === "question-back") {
          if (state.questionIndex > 0) { state.questionIndex -= 1; renderQuestion(); }
          else showScreen("profile");
        }
      });
    });

    var profileForm = document.getElementById("profile-form");
    if (profileForm) profileForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var offer = document.getElementById("offer");
      var businessName = document.getElementById("business-name");
      var offerValue = offer ? offer.value.trim() : "";
      if (offerValue.length < 2) { setError("profile-error", "محصول یا خدمتت را کوتاه بنویس تا تشخیص دقیق‌تر شود."); if (offer) offer.focus(); return; }
      state.profile = { businessName: businessName ? businessName.value.trim() : "", offer: offerValue };
      state.questionIndex = 0;
      showScreen("questions");
      renderQuestion();
      if (window.hxTrack) window.hxTrack("profile_submitted");
    });

    var questionForm = document.getElementById("question-form");
    if (questionForm) questionForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var question = QUESTIONS[state.questionIndex];
      if (!validateQuestion(question)) return;
      if (state.questionIndex < QUESTIONS.length - 1) { state.questionIndex += 1; renderQuestion(); }
      else submitDiagnosis();
    });
  }

  window.hxResetFlow = resetFlow;
  window.hxQuestions = QUESTIONS;
  document.addEventListener("DOMContentLoaded", function () {
    bindEvents();
    showScreen("landing");
    if (window.hxTrack) window.hxTrack("flow_ready", { version: "v2" });
  });
})();
