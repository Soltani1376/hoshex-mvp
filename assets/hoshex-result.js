(function () {
  "use strict";

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function text(value, fallback) {
    if (value == null || String(value).trim() === "") return fallback || "";
    return String(value).trim();
  }

  function normalizeDiagnosis(input) {
    var source = input && typeof input === "object" ? input : {};
    var problem = source.main_problem && typeof source.main_problem === "object" ? source.main_problem : {};
    var action = source.today_action && typeof source.today_action === "object" ? source.today_action : {};
    var metric = source.success_metric && typeof source.success_metric === "object" ? source.success_metric : {};
    var priorities = Array.isArray(source.priorities) ? source.priorities : [];
    var firstPriority = priorities[0] && typeof priorities[0] === "object" ? priorities[0] : {};

    return {
      business_summary: text(source.business_summary, "یک الگوی اصلی در مسیر رشد کسب‌وکارت دیده می‌شود."),
      main_problem: {
        title: text(problem.title, "مشکل اصلی هنوز دقیق مشخص نشده است"),
        reason: text(problem.reason, "برای تصمیم بهتر باید یک اقدام کوچک را اندازه‌گیری کنیم."),
        severity: text(problem.severity, "medium").toLowerCase()
      },
      priority: {
        title: text(firstPriority.title, text(problem.title, "تمرکز روی مهم‌ترین مانع")),
        description: text(firstPriority.description, text(problem.reason, "یک مسیر مشخص را تا رسیدن به نتیجه دنبال کن."))
      },
      action: {
        title: text(action.title, "یک پیشنهاد روشن برای امروز بنویس"),
        steps: Array.isArray(action.steps) && action.steps.length ? action.steps.slice(0, 5).map(function (item) { return text(item, ""); }).filter(Boolean) : ["یک اقدام کوچک و قابل اندازه‌گیری را اجرا کن."],
        time_required: text(action.time_required, "کمتر از یک روز")
      },
      metric: {
        metric: text(metric.metric, "تعداد پاسخ یا خرید از اقدام امروز"),
        period: text(metric.period, "تا ۷ روز آینده")
      },
      avoid_now: text(source.avoid_now, "فعلاً چند کار جدید را هم‌زمان شروع نکن."),
      next_step: text(source.next_step, "بعد از اندازه‌گیری نتیجه، قدم بعدی را انتخاب کن.")
    };
  }

  function severityLabel(value) {
    if (value === "high" || value === "زیاد" || value === "بالا") return "اولویت بالا";
    if (value === "low" || value === "کم") return "اولویت پایین";
    return "اولویت متوسط";
  }

  function showToast(message) {
    var toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(function () { toast.classList.remove("is-visible"); }, 2600);
  }

  function buildCopyText(d) {
    return [
      "تشخیص هوشکس",
      "\nمشکل اصلی: " + d.main_problem.title,
      "چرا مهم است: " + d.main_problem.reason,
      "اولویت ۰۱: " + d.priority.title,
      "کار امروز: " + d.action.title,
      d.action.steps.map(function (step, index) { return (index + 1) + ") " + step; }).join("\n"),
      "زمان اجرا: " + d.action.time_required,
      "معیار نتیجه: " + d.metric.metric + " — " + d.metric.period,
      "فعلاً انجام نده: " + d.avoid_now,
      "قدم بعدی: " + d.next_step
    ].join("\n");
  }

  function copyText(value) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(value);
    }
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

  function renderDiagnosis(input, context) {
    var d = normalizeDiagnosis(input);
    var target = document.getElementById("result-content");
    if (!target) return;
    var steps = d.action.steps.map(function (step) { return "<li>" + escapeHtml(step) + "</li>"; }).join("");
    target.innerHTML = [
      "<div class=\"hx-result-top\">",
        "<div><p class=\"hx-kicker\">نتیجه بررسی هوشکس</p><h2 id=\"result-title\">حالا می‌دونی از کجا شروع کنی.</h2><p class=\"hx-result-summary\">" + escapeHtml(d.business_summary) + "</p></div>",
        "<span class=\"hx-severity\">" + escapeHtml(severityLabel(d.main_problem.severity)) + "</span>",
      "</div>",
      "<div class=\"hx-result-grid\">",
        "<article class=\"hx-result-card\"><h3><span class=\"hx-card-index\">۱</span>مشکل اصلی</h3><p><strong>" + escapeHtml(d.main_problem.title) + "</strong><br>" + escapeHtml(d.main_problem.reason) + "</p></article>",
        "<article class=\"hx-result-card hx-priority\"><h3><span class=\"hx-card-index\">۲</span>اولویت ۰۱</h3><p class=\"hx-priority-title\">" + escapeHtml(d.priority.title) + "</p><p>" + escapeHtml(d.priority.description) + "</p></article>",
        "<article class=\"hx-result-card hx-action\"><h3><span class=\"hx-card-index\">۳</span>کار امروز</h3><p><strong>" + escapeHtml(d.action.title) + "</strong></p><ul class=\"hx-steps\">" + steps + "</ul><span class=\"hx-time\">زمان اجرا: " + escapeHtml(d.action.time_required) + "</span></article>",
        "<article class=\"hx-result-card\"><h3><span class=\"hx-card-index\">۴</span>معیار نتیجه</h3><p>" + escapeHtml(d.metric.metric) + "<br><strong>" + escapeHtml(d.metric.period) + "</strong></p></article>",
        "<article class=\"hx-result-card avoid\"><h3><span class=\"hx-card-index\">۵</span>فعلاً انجام نده</h3><p>" + escapeHtml(d.avoid_now) + "</p></article>",
        "<article class=\"hx-result-card next\"><h3><span class=\"hx-card-index\">۶</span>قدم بعدی</h3><p>" + escapeHtml(d.next_step) + "</p></article>",
      "</div>",
      "<div class=\"hx-result-footer\"><button class=\"hx-primary hx-done\" type=\"button\" data-result-action=\"done\">انجام دادم ✓</button><div class=\"hx-result-tools\"><button class=\"hx-tool\" type=\"button\" data-result-action=\"copy\">کپی نتیجه</button><button class=\"hx-tool\" type=\"button\" data-result-action=\"restart\">بررسی دوباره</button></div></div>",
      "<div class=\"hx-complete\" data-complete-message>ثبت شد. بعد از " + escapeHtml(d.metric.period) + " عدد نتیجه را بررسی کن؛ سپس قدم بعدی را انتخاب می‌کنیم.</div>"
    ].join("");

    target.querySelectorAll("[data-result-action]").forEach(function (button) {
      button.addEventListener("click", function () {
        var action = button.getAttribute("data-result-action");
        if (action === "done") {
          button.classList.add("is-done");
          button.textContent = "انجام شد ✓";
          var message = target.querySelector("[data-complete-message]");
          if (message) message.classList.add("is-visible");
          if (window.hxTrack) window.hxTrack("today_action_completed", { source: context && context.source || "diagnosis" });
          showToast("کار امروز ثبت شد");
        } else if (action === "copy") {
          copyText(buildCopyText(d)).then(function () { showToast("نتیجه کپی شد"); }).catch(function () { showToast("کپی نتیجه انجام نشد"); });
          if (window.hxTrack) window.hxTrack("diagnosis_copied");
        } else if (action === "restart") {
          if (window.hxResetFlow) window.hxResetFlow();
        }
      });
    });
    if (window.hxTrack) window.hxTrack("diagnosis_rendered", { source: context && context.source || "api" });
  }

  window.hxEscape = escapeHtml;
  window.hxRenderResult = renderDiagnosis;
  window.hxShowToast = showToast;
  window.hxSampleDiagnosis = {
    business_summary: "پاپیون استور بازدید دارد، اما مسیر تصمیم‌گیری برای خرید کوتاه و واضح نیست.",
    main_problem: { title: "تبدیل بازدید به خرید پایین است", reason: "مخاطب وارد صفحه می‌شود ولی پیشنهاد مشخص، دلیل اعتماد و دعوت به اقدام را یک‌جا نمی‌بیند.", severity: "high" },
    priorities: [{ rank: 1, title: "پیشنهاد فروش را شفاف کن", description: "یک محصول مشخص را با مزیت، قیمت یا شرایط روشن و CTA واحد ارائه بده." }],
    today_action: { title: "یک پیشنهاد فروش مشخص برای محصول پرفروش بساز", steps: ["یک محصول و یک مخاطب مشخص انتخاب کن.", "سه مزیت واقعی و دلیل اعتماد را بنویس.", "در سه استوری پشت‌سرهم منتشر کن و فقط یک CTA بگذار."], time_required: "۶۰ تا ۹۰ دقیقه" },
    success_metric: { metric: "حداقل ۵ پاسخ یا کلیک مرتبط با همان پیشنهاد", period: "تا ۴۸ ساعت آینده" },
    avoid_now: "فعلاً محصول جدید، تبلیغ جدید یا قالب محتوایی تازه شروع نکن.",
    next_step: "اگر پاسخ گرفتی، همین پیشنهاد را برای یک ریلز کوتاه تبدیل کن."
  };
})();
