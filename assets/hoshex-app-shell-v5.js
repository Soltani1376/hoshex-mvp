(function () {
  "use strict";

  var STORAGE_KEY = "hx_business_journey_v1";
  var renderQueued = false;

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

  function faNumber(value) {
    try { return new Intl.NumberFormat("fa-IR").format(Number(value)); }
    catch (error) { return String(value); }
  }

  function formatJalali(value, includeYear) {
    var date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    var options = { day: "numeric", month: "long" };
    if (includeYear) options.year = "numeric";
    try {
      return new Intl.DateTimeFormat("fa-IR-u-ca-persian", options).format(date);
    } catch (error) {
      try { return new Intl.DateTimeFormat("fa-IR", options).format(date); }
      catch (fallbackError) { return date.toISOString().slice(0, 10); }
    }
  }

  function icon(name) {
    var paths = {
      home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-6h5v6"/>',
      route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h3a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3h-1"/>',
      scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3"/><path d="M16 4h3a1 1 0 0 1 1 1v3"/><path d="M20 16v3a1 1 0 0 1-1 1h-3"/><path d="M8 20H5a1 1 0 0 1-1-1v-3"/><circle cx="12" cy="12" r="3"/>'
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] || paths.home) + '</svg>';
  }

  function installDock() {
    if (document.querySelector("[data-hx-app-dock]")) return;
    var dock = document.createElement("nav");
    dock.className = "hx-app-dock";
    dock.setAttribute("data-hx-app-dock", "true");
    dock.setAttribute("aria-label", "ناوبری هوشکس");
    dock.innerHTML = [
      '<button class="hx-app-nav-item" type="button" data-app-nav="home">' + icon("home") + '<span>خانه</span></button>',
      '<button class="hx-app-nav-item" type="button" data-app-nav="journey">' + icon("route") + '<span>مسیر من</span></button>',
      '<button class="hx-app-nav-item" type="button" data-app-nav="diagnosis">' + icon("scan") + '<span>تشخیص</span></button>'
    ].join("");
    document.body.appendChild(dock);
  }

  function visibleScreen() {
    var screens = Array.prototype.slice.call(document.querySelectorAll(".hx-screen"));
    return screens.find(function (screen) { return !screen.hidden; }) || null;
  }

  function updateDockState() {
    var screen = visibleScreen();
    var id = screen ? screen.id : "screen-landing";
    var active = id === "screen-landing" ? "home" : (id === "screen-journey" || id === "screen-feedback" || id === "screen-execution") ? "journey" : "diagnosis";
    document.querySelectorAll("[data-app-nav]").forEach(function (button) {
      var isActive = button.getAttribute("data-app-nav") === active;
      button.classList.toggle("is-active", isActive);
      if (isActive) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
  }

  function goHome() {
    var brand = document.querySelector('[data-action="brand-home"]');
    if (brand) brand.click();
    else {
      document.querySelectorAll(".hx-screen").forEach(function (screen) { screen.hidden = screen.id !== "screen-landing"; });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function goJourney() {
    if (window.hxJourneyOpen) window.hxJourneyOpen();
    else goHome();
  }

  function goDiagnosis() {
    if (window.hxStartFlow) window.hxStartFlow();
    else {
      var start = document.querySelector('[data-action="start"]');
      if (start) start.click();
    }
  }

  function patchTopbarDate() {
    var pill = document.querySelector(".hx-live-pill");
    if (!pill) return;
    var dateText = formatJalali(new Date(), true);
    var dateNode = pill.querySelector("[data-hx-jalali-today]");
    if (!dateNode) {
      pill.childNodes.forEach(function (node) {
        if (node.nodeType === 3) node.textContent = "";
      });
      dateNode = document.createElement("span");
      dateNode.setAttribute("data-hx-jalali-today", "true");
      pill.appendChild(dateNode);
    }
    if (dateNode.textContent !== dateText) dateNode.textContent = dateText;
  }

  function patchJourneyDates() {
    var journey = readJourney();
    var cycle = currentCycle(journey);
    if (!cycle || !cycle.execution) return;
    var execution = cycle.execution;
    var label = execution.checkInAt ? formatJalali(execution.checkInAt, true) : faNumber(Math.max(1, Math.min(7, Number(execution.check_in_days) || 2))) + " روز بعد از اجرا";
    if (!label) return;

    var activeHomeDate = document.querySelector("#screen-landing .hx-active-task-meta > div:nth-child(2) strong");
    if (activeHomeDate && activeHomeDate.textContent !== label) activeHomeDate.textContent = label;

    var executionDate = document.querySelector("#screen-execution .hx-checkin-card strong");
    if (executionDate && executionDate.textContent !== label) executionDate.textContent = label;

    var journeyInline = document.querySelector("#screen-journey .hx-inline-execution-status small");
    var journeyLabel = "بررسی نتیجه: " + label;
    if (journeyInline && journeyInline.textContent !== journeyLabel) journeyInline.textContent = journeyLabel;
  }

  function patchThemeColor() {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", "#f4f6f8");
  }

  function render() {
    installDock();
    patchThemeColor();
    patchTopbarDate();
    patchJourneyDates();
    updateDockState();
  }

  function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    window.setTimeout(function () {
      renderQueued = false;
      render();
    }, 25);
  }

  function bind() {
    document.addEventListener("click", function (event) {
      var target = event.target.closest && event.target.closest("[data-app-nav]");
      if (!target) return;
      var action = target.getAttribute("data-app-nav");
      if (action === "home") goHome();
      if (action === "journey") goJourney();
      if (action === "diagnosis") goDiagnosis();
      window.setTimeout(updateDockState, 40);
    }, true);
  }

  function init() {
    document.body.classList.add("hx-app-mode");
    bind();
    render();
    if (window.MutationObserver) new MutationObserver(queueRender).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
    window.addEventListener("storage", queueRender);
  }

  window.hxFormatJalali = formatJalali;
  window.hxAppShellRefresh = queueRender;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
