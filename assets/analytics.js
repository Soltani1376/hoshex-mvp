(function () {
  "use strict";

  var STORAGE_KEY = "hx_events_v2";
  var MAX_EVENTS = 250;

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

    if (!document.querySelector('link[data-hx-theme="v2-neon"]')) {
      var theme = document.createElement("link");
      theme.rel = "stylesheet";
      theme.href = "/assets/hoshex-neon-theme.css";
      theme.setAttribute("data-hx-theme", "v2-neon");
      document.head.appendChild(theme);
    }
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

    // A server endpoint is intentionally optional until a persistent analytics store is added.
    // Set window.HX_ANALYTICS_ENDPOINT to enable it without changing the flow code.
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
  hxTrack("page_view", { version: "v2" });
})();
