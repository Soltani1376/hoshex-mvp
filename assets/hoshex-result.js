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
        title: text(action.title, "یک اقدام روشن برای امروز انجام بده"),
        steps: Array.isArray(action.steps) && action.steps.length ? action.steps.slice(0, 5).map(function (item) { return text(item, ""); }).filter(Boolean) : ["یک اقدام کوچک و قابل اندازه‌گیری را اجرا کن."],
        time_required: text(action.time_required, "کمتر از یک روز")
      },
      metric: {
        metric: text(metric.metric, "نتیجه قابل اندازه‌گیری از اقدام امروز"),
        period: text(metric.period, "تا ۷ روز آینده")
      },
      avoid_now: text(source.avoid_now, "فعلاً چند مسیر جدید را هم‌زمان شروع نکن."),
      next_step: text(source.next_step, "بعد از اندازه‌گیری نتیجه، قدم بعدی را انتخاب کن."),
      evidence: Array.isArray(source.evidence) ? source.evidence.slice(0, 3).map(function (item) { return text(item, ""); }).filter(Boolean) : []
    };
  }

  function diagnosisKey(d) {
    var meta = window.hxLastDiagnosisMeta || {};
    if (["acquisition", "offer", "sales_process", "focus"].indexOf(meta.rules_hypothesis) >= 0) return meta.rules_hypothesis;
    var title = d.main_problem.title || "";
    if (/ورودی|مشتری کم|سرنخ/.test(title)) return "acquisition";
    if (/فرآیند|تبدیل مشتری|خرید نمی/.test(title)) return "sales_process";
    if (/تمرکز|اولویت اجرایی/.test(title)) return "focus";
    return "offer";
  }

  function confidenceLabel(context) {
    if (context && context.source === "demo") return "اطمینان بالا";
    var value = String(window.hxLastDiagnosisMeta && window.hxLastDiagnosisMeta.confidence || "medium");
    if (value === "high") return "اطمینان بالا";
    if (value === "low") return "نیاز به داده بیشتر";
    return "اطمینان متوسط";
  }

  function evidenceFor(d, context) {
    if (d.evidence.length) return d.evidence;
    if (context && context.source === "demo") return [
      "بازدید وجود دارد اما خرید متناسب با آن شکل نمی‌گیرد",
      "مخاطب پیشنهاد، دلیل اعتماد و CTA را یک‌جا و واضح نمی‌بیند"
    ];
    var request = window.hxLastDiagnosisRequest || {};
    if (window.hxCompletionEvidence) return window.hxCompletionEvidence(request.answers || {}, diagnosisKey(d));
    return [];
  }

  function showToast(message) {
    var toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(function () { toast.classList.remove("is-visible"); }, 2600);
  }

  function buildCopyText(d, evidence) {
    var lines = [
      "تشخیص هوشکس",
      "مشکل اصلی: " + d.main_problem.title,
      "اولویت ۰۱: " + d.priority.title,
      "کار الان: " + d.action.title,
      d.action.steps.map(function (step, index) { return (index + 1) + ") " + step; }).join("\n"),
      "معیار نتیجه: " + d.metric.metric + " — " + d.metric.period
    ];
    if (evidence.length) lines.splice(2, 0, "نشانه‌ها: " + evidence.join(" | "));
    lines.push("فعلاً انجام نده: " + d.avoid_now);
    return lines.join("\n");
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

  function renderDiagnosis(input, context) {
    var d = normalizeDiagnosis(input);
    var target = document.getElementById("result-content");
    if (!target) return;
    var evidence = evidenceFor(d, context);
    var steps = d.action.steps.map(function (step) { return "<li>" + escapeHtml(step) + "</li>"; }).join("");
    var evidenceHtml = evidence.map(function (item) { return "<li>" + escapeHtml(item) + "</li>"; }).join("");
    var isDemo = context && context.source === "demo";

    target.innerHTML = [
      '<div class="hx-decision-shell">',
        '<div class="hx-decision-head">',
          '<div><p class="hx-kicker">نتیجه بررسی هوشکس</p><h2 id="result-title">یک مسئله. یک اولویت. یک حرکت بعدی.</h2><p>' + escapeHtml(d.business_summary) + '</p></div>',
          '<span class="hx-confidence">' + escapeHtml(confidenceLabel(context)) + '</span>',
        '</div>',
        '<article class="hx-decision-card hx-decision-diagnosis">',
          '<span>تشخیص</span><h3>' + escapeHtml(d.main_problem.title) + '</h3><p>' + escapeHtml(d.main_problem.reason) + '</p>',
          (evidence.length ? '<button class="hx-evidence-toggle" type="button" data-result-action="toggle-evidence" aria-expanded="false">چرا این تشخیص؟</button><div class="hx-evidence" data-evidence-panel><p>چیزهایی که از پاسخ‌هات وزن بیشتری گرفتند:</p><ul>' + evidenceHtml + '</ul></div>' : ''),
        '</article>',
        '<article class="hx-decision-card hx-decision-priority">',
          '<span>PRIORITY 01</span><h3>' + escapeHtml(d.priority.title) + '</h3><p>' + escapeHtml(d.priority.description) + '</p>',
        '</article>',
        '<article class="hx-decision-card hx-decision-action">',
          '<span>اقدام بعدی</span><h3>' + escapeHtml(d.action.title) + '</h3><ul class="hx-steps">' + steps + '</ul><span class="hx-time">زمان اجرا: ' + escapeHtml(d.action.time_required) + '</span>',
        '</article>',
        '<div class="hx-decision-secondary">',
          '<div class="hx-decision-mini"><span>معیار نتیجه</span><strong>' + escapeHtml(d.metric.metric) + ' · ' + escapeHtml(d.metric.period) + '</strong></div>',
          '<div class="hx-decision-mini"><span>فعلاً انجام نده</span><strong>' + escapeHtml(d.avoid_now) + '</strong></div>',
        '</div>',
        '<div class="hx-decision-cta">',
          (isDemo ? '<button class="hx-primary" type="button" data-result-action="restart">تشخیص کسب‌وکار خودم ←</button>' : '<button class="hx-primary" type="button" data-execution-action="prepare">این کار رو برام آماده کن ←</button>'),
          '<div class="hx-result-tools"><button class="hx-tool" type="button" data-result-action="copy">کپی تشخیص</button></div>',
        '</div>',
      '</div>'
    ].join("");

    target.querySelectorAll("[data-result-action]").forEach(function (button) {
      button.addEventListener("click", function () {
        var action = button.getAttribute("data-result-action");
        if (action === "toggle-evidence") {
          var panel = target.querySelector("[data-evidence-panel]");
          var open = panel && !panel.classList.contains("is-open");
          if (panel) panel.classList.toggle("is-open", open);
          button.setAttribute("aria-expanded", open ? "true" : "false");
          if (window.hxTrack) window.hxTrack("diagnosis_evidence_toggled", { open: Boolean(open), evidence_count: evidence.length });
        }
        if (action === "copy") {
          copyText(buildCopyText(d, evidence)).then(function () { showToast("تشخیص کپی شد"); }).catch(function () { showToast("کپی انجام نشد"); });
          if (window.hxTrack) window.hxTrack("diagnosis_copied", { completion: "v1" });
        }
        if (action === "restart" && window.hxResetFlow) window.hxResetFlow();
      });
    });

    if (window.hxTrack) window.hxTrack("diagnosis_rendered", { source: context && context.source || "api", completion: "v1", evidence_count: evidence.length });
  }

  window.hxEscape = escapeHtml;
  window.hxRenderResult = renderDiagnosis;
  window.hxShowToast = showToast;
  window.hxSampleDiagnosis = {
    business_summary: "پاپیون استور بازدید دارد، اما مسیر تصمیم‌گیری برای خرید هنوز کوتاه و واضح نیست.",
    main_problem: { title: "پیشنهاد فروش به اندازه کافی واضح نیست", reason: "توجه وجود دارد، اما مخاطب هنوز ارزش پیشنهادی و قدم بعدی خرید را سریع نمی‌فهمد.", severity: "high" },
    evidence: ["بازدید وجود دارد اما خرید متناسب با آن شکل نمی‌گیرد", "پیشنهاد و CTA در لحظه تصمیم به اندازه کافی واضح نیست"],
    priorities: [{ rank: 1, title: "پیشنهاد فروش را شفاف کن", description: "یک محصول مشخص را با نتیجه، دلیل اعتماد و CTA واحد ارائه بده." }],
    today_action: { title: "یک پیشنهاد فروش مشخص برای محصول پرفروش بساز", steps: ["یک محصول و یک مخاطب مشخص انتخاب کن.", "نتیجه اصلی و یک دلیل اعتماد واقعی را بنویس.", "در سه استوری پشت‌سرهم منتشر کن و فقط یک CTA بگذار."], time_required: "۶۰ تا ۹۰ دقیقه" },
    success_metric: { metric: "حداقل ۵ پاسخ یا کلیک مرتبط با همان پیشنهاد", period: "تا ۴۸ ساعت آینده" },
    avoid_now: "فعلاً محصول جدید، تبلیغ جدید یا قالب محتوایی تازه شروع نکن.",
    next_step: "بعد از اندازه‌گیری نتیجه، قدم بعدی را بر اساس همان داده انتخاب کن."
  };
})();
