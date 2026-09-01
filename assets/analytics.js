(function () {
  "use strict";

  var STORAGE_KEY = "hx_events_v2";
  var MAX_EVENTS = 250;

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
  hxTrack("page_view", { version: "v2" });
})();
