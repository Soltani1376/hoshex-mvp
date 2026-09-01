(function () {
  "use strict";

  var STORAGE_KEY = "hx_events_v2";
  var MAX_EVENTS = 250;

  function appendStylesheet(href, key) {
    if (document.querySelector('link[data-hx-style="' + key + '"]')) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.setAttribute("data-hx-style", key);
    document.head.appendChild(link);
  }

  function appendScript(src, key) {
    if (document.querySelector('script[data-hx-script="' + key + '"]')) return;
    var script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.setAttribute("data-hx-script", key);
    document.head.appendChild(script);
  }

  function installVisualTheme() {
    if (!document.querySelector('link[data-hx-font-preconnect="googleapis"]')) {
      var googleApis = document.createElement("link");
      googleApis.rel = "preconnect";
      googleApis.href = "https://fonts.googleapis.com";
      googleApis.setAttribute("data-hx-font-preconnect", "googleapis");
      document.head.appendChild(googleApis);
    }

    if (!document.querySelector('link[data-hx-font-preconnect="gstatic"]')) {
      var googleStatic = document.createElement("link");
      googleStatic.rel = "preconnect";
      googleStatic.href = "https://fonts.gstatic.com";
      googleStatic.crossOrigin = "anonymous";
      googleStatic.setAttribute("data-hx-font-preconnect", "gstatic");
      document.head.appendChild(googleStatic);
    }

    appendStylesheet("/assets/hoshex-neon-theme.css", "v2-neon");
    appendStylesheet("/assets/hoshex-hero-v3.css", "v2-hero-diagnostic");
    appendStylesheet("/assets/hoshex-journey.css", "v2-persistent-journey");
    appendStylesheet("/assets/hoshex-polish-v4.css", "v2-proportion-minimal-motion");
    appendStylesheet("/assets/hoshex-execution.css", "v2-execution-assistant");
    appendStylesheet("/assets/hoshex-completion.css", "v2-completion-pass");
    appendStylesheet("/assets/hoshex-app-shell-v5.css", "v2-app-shell-v5");
    appendStylesheet("/assets/hoshex-app-shell-v5-mobile.css", "v2-app-shell-v5-mobile");
    appendStylesheet("/assets/hoshex-cloud.css", "v2-cloud");
  }

  function installBrandAssets() {
    var logoPath = "/assets/hoshex-logo-icon.png";
    var mark = document.querySelector(".hx-brand-mark");
    if (mark) {
      mark.textContent = "";
      mark.style.background = "transparent";
      mark.style.boxShadow = "none";
      mark.style.overflow = "hidden";
      var image = document.createElement("img");
      image.src = logoPath;
      image.alt = "";
      image.width = 30;
      image.height = 30;
      image.style.width = "100%";
      image.style.height = "100%";
      image.style.display = "block";
      image.style.objectFit = "contain";
      mark.appendChild(image);
    }

    if (!document.querySelector('link[data-hx-favicon]')) {
      var favicon = document.createElement("link");
      favicon.rel = "icon";
      favicon.type = "image/png";
      favicon.href = logoPath;
      favicon.setAttribute("data-hx-favicon", "true");
      document.head.appendChild(favicon);
    }
  }

  function installDiagnosticHero() {
    var hero = document.querySelector("#screen-landing .hx-hero");
    if (!hero || hero.getAttribute("data-hx-hero") === "diagnostic-v3") return;

    hero.setAttribute("data-hx-hero", "diagnostic-v3");
    hero.innerHTML = [
      '<div class="hx-hero-copy">',
        '<div class="hx-ai-badge"><span class="hx-ai-badge-dot" aria-hidden="true"></span><span>HOSHEX AI · موتور تشخیص کسب‌وکار</span></div>',
        '<p class="hx-eyebrow">از نشانه‌ها به یک تصمیم روشن</p>',
        '<h1 id="hero-title">مشکل اصلی کسب‌وکارت رو <span class="hx-hero-line-emphasis">حدس نزن.</span><br><span class="hx-gradient-text">هوشکس پیداش می‌کنه.</span></h1>',
        '<p class="hx-lead">۵ سؤال کوتاه، چند سیگنال واقعی و یک خروجی مشخص: مشکل اصلی، اولویت شماره ۱ و کاری که امروز باید انجام بدهی.</p>',
        '<div class="hx-value-row" aria-label="مزیت‌های بررسی هوشکس">',
          '<span class="hx-value-chip">۵ سؤال تشخیصی</span>',
          '<span class="hx-value-chip">کمتر از ۲ دقیقه</span>',
          '<span class="hx-value-chip">فقط یک اولویت</span>',
        '</div>',
        '<div class="hx-hero-actions">',
          '<button class="hx-primary" type="button" data-action="start">شروع تشخیص رایگان <span class="hx-cta-arrow" aria-hidden="true">←</span></button>',
          '<button class="hx-secondary" type="button" data-action="show-demo">نمونه تشخیص را ببین</button>',
        '</div>',
        '<p class="hx-microcopy">بدون چت طولانی، بدون توصیه‌های کلی، بدون لیست ۲۰تایی کار.</p>',
      '</div>',
      '<div class="hx-hero-visual hx-diagnostic-stage" aria-hidden="true">',
        '<div class="hx-stage-grid"></div>',
        '<div class="hx-stage-axis-x"></div>',
        '<div class="hx-stage-axis-y"></div>',
        '<div class="hx-visual-halo"></div>',
        '<div class="hx-stage-core">',
          '<div class="hx-stage-radar"></div>',
          '<div class="hx-stage-sweep"></div>',
          '<div class="hx-agent"><div class="hx-orb"></div><div class="hx-scan"></div></div>',
        '</div>',
        '<div class="hx-signal-node hx-node-acquisition"><strong>ورودی مشتری</strong><span>سیگنال فعال</span></div>',
        '<div class="hx-signal-node hx-node-offer"><strong>پیشنهاد فروش</strong><span>در حال سنجش</span></div>',
        '<div class="hx-signal-node hx-node-sales"><strong>فرآیند فروش</strong><span>الگوی تبدیل</span></div>',
        '<div class="hx-signal-node hx-node-focus"><strong>تمرکز اجرایی</strong><span>اولویت‌سنجی</span></div>',
        '<div class="hx-engine-card">',
          '<div class="hx-engine-head"><span>DIAGNOSIS ENGINE</span><span class="hx-engine-status">LIVE</span></div>',
          '<div class="hx-engine-row"><span>سیگنال‌ها</span><b>۵ / ۵</b></div>',
          '<div class="hx-engine-row"><span>فرضیه اصلی</span><b>در حال رتبه‌بندی</b></div>',
          '<div class="hx-engine-meter"><span></span></div>',
        '</div>',
        '<div class="hx-preview">',
          '<p class="hx-preview-label"><span>نمونه خروجی</span><span class="hx-preview-confidence">اطمینان بالا</span></p>',
          '<span class="hx-diagnosis-tag">مشکل اصلی</span>',
          '<p class="hx-preview-title">بازدید هست، اما پیشنهاد خرید هنوز واضح نیست.</p>',
          '<div class="hx-preview-action"><span>۱</span> Priority 01: پیشنهاد فروش را بازنویسی کن</div>',
        '</div>',
      '</div>'
    ].join("");

    var notes = document.querySelector("#screen-landing .hx-section-note");
    if (notes) {
      notes.innerHTML = [
        '<div class="hx-note"><span class="hx-note-step">01</span><strong>نشانه‌ها را می‌گیرد</strong>فقط اطلاعاتی که برای تصمیم لازم است.</div>',
        '<div class="hx-note"><span class="hx-note-step">02</span><strong>مشکل را رتبه‌بندی می‌کند</strong>یک مانع اصلی، نه چند توصیه هم‌زمان.</div>',
        '<div class="hx-note"><span class="hx-note-step">03</span><strong>کار امروز را می‌دهد</strong>یک اقدام مشخص که همان روز قابل اجراست.</div>'
      ].join("");
    }

    var livePill = document.querySelector(".hx-live-pill");
    if (livePill) livePill.lastChild.textContent = " تشخیص هوشمند · رایگان";
  }

  function clean(value, depth) {
    depth = depth || 0;
    if (depth > 2) return undefined;
    if (typeof value === "string") return value.slice(0, 240);
    if (typeof value === "number" || typeof value === "boolean") return value;
    if (!value || typeof value !== "object") return undefined;
    var output = Array.isArray(value) ? [] : {};
    Object.keys(value).slice(0, 20).forEach(function (key) {
      var item = clean(value[key], depth + 1);
      if (item !== undefined) output[key.slice(0, 60)] = item;
    });
    return output;
  }

  function readEvents() {
    try {
      var value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch (error) {
      return [];
    }
  }

  function hxTrack(eventName, properties) {
    if (!eventName) return;
    var payload = {
      event: String(eventName).slice(0, 80),
      properties: clean(properties || {}) || {},
      timestamp: new Date().toISOString(),
      path: window.location.pathname
    };

    try {
      var events = readEvents();
      events.push(payload);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
    } catch (error) {
      // Private browsing and blocked storage should never interrupt the product flow.
    }

    window.dispatchEvent(new CustomEvent("hx:analytics", { detail: payload }));

    if (window.HX_ANALYTICS_ENDPOINT && navigator.sendBeacon) {
      try {
        navigator.sendBeacon(window.HX_ANALYTICS_ENDPOINT, JSON.stringify(payload));
      } catch (error) {
        // Analytics must remain best-effort.
      }
    }
  }

  window.hxTrack = hxTrack;
  window.hxGetEvents = readEvents;
  installVisualTheme();
  installBrandAssets();
  installDiagnosticHero();
  appendScript("/assets/hoshex-completion.js", "v2-completion-pass");
  appendScript("/assets/hoshex-journey.js", "v2-persistent-journey");
  appendScript("/assets/hoshex-journey-hook.js", "v2-persistent-journey-hook");
  appendScript("/assets/hoshex-execution.js", "v2-execution-assistant");
  appendScript("/assets/hoshex-app-shell-v5.js", "v2-app-shell-v5");
  appendScript("/assets/hoshex-cloud.js", "v2-cloud");
  hxTrack("page_view", { version: "v2", hero: "diagnostic-v3", journey: "persistent-v1", execution: "assistant-v2-context", completion: "v1", shell: "compact-app-v5", calendar: "persian", cloud: "v1" });
})();
