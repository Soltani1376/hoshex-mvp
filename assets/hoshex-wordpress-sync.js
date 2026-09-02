(function () {
  "use strict";

  var API_BASE = "https://hoshex.ir/wp-json/hoshex/v1";
  var JOURNEY_KEY = "hx_business_journey_v1";
  var BUSINESS_KEY = "hx_cloud_business_key_v1";
  var CLOUD_SESSION_KEY = "hx_cloud_session_v1";
  var WP_SESSION_KEY = "hx_wp_session_v1";
  var WP_META_KEY = "hx_wp_sync_meta_v1";
  var syncing = false;
  var lastRaw = "";
  var timer = null;
  var enabled = false;

  function nowIso() { return new Date().toISOString(); }
  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (error) { return null; }
  }
  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (error) { return false; }
  }
  function readJourney() {
    var value = readJson(JOURNEY_KEY);
    return value && Array.isArray(value.cycles) ? value : null;
  }
  function businessKey() {
    var key = localStorage.getItem(BUSINESS_KEY);
    if (!key) {
      key = "business-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
      try { localStorage.setItem(BUSINESS_KEY, key); } catch (error) {}
    }
    return key;
  }
  function safeExternal(value, fallback, max) {
    var text = String(value || fallback || "").replace(/[^A-Za-z0-9._:-]/g, "-").slice(0, max || 100);
    return text || String(fallback || "hx").slice(0, max || 100);
  }
  function track(name, props) {
    if (window.hxTrack) window.hxTrack(name, props || {});
  }
  function accountProfile() {
    var cloud = readJson(CLOUD_SESSION_KEY);
    var user = cloud && cloud.user || {};
    var metadata = user.user_metadata || {};
    var email = String(user.email || "");
    if (/\@guest\.hoshex\.invalid$/i.test(email)) email = "";
    return {
      email: email,
      name: String(metadata.full_name || metadata.name || ""),
      phone: String(user.phone || metadata.phone || "")
    };
  }
  function clientContext() {
    var timezone = "";
    try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (error) {}
    return {
      viewport_width: Math.max(0, Math.round(window.innerWidth || 0)),
      viewport_height: Math.max(0, Math.round(window.innerHeight || 0)),
      screen_width: Math.max(0, Math.round(window.screen && window.screen.width || 0)),
      screen_height: Math.max(0, Math.round(window.screen && window.screen.height || 0)),
      language: navigator.language || "",
      timezone: timezone,
      platform: navigator.userAgentData && navigator.userAgentData.platform || navigator.platform || "",
      touch_points: navigator.maxTouchPoints || 0
    };
  }
  function sessionIsFresh(session) {
    return session && session.token && session.contact_external_id && Number(session.expires_at || 0) * 1000 > Date.now() + 7 * 24 * 60 * 60 * 1000;
  }
  async function ensureSession(force) {
    var saved = readJson(WP_SESSION_KEY);
    if (!force && sessionIsFresh(saved)) return saved;
    var headers = { "Content-Type": "application/json", Accept: "application/json" };
    if (saved && saved.token) headers["X-Hoshex-Session"] = saved.token;
    var response = await fetch(API_BASE + "/session", { method: "POST", headers: headers, body: "{}" });
    if (!response.ok) throw new Error("wp_session_" + response.status);
    var data = await response.json();
    if (!data || !data.token || !data.contact_external_id) throw new Error("wp_session_invalid");
    writeJson(WP_SESSION_KEY, data);
    return data;
  }
  function journeyExternal(journey) {
    return safeExternal(journey.createdAt || "journey-v1", "journey-v1", 120);
  }
  function payloadFor(journey, session) {
    var profile = journey.profile || {};
    var answers = journey.answers || {};
    var account = accountProfile();
    var meta = readJson(WP_META_KEY) || {};
    var bKey = safeExternal(businessKey(), "business-v1", 100);
    var jKey = journeyExternal(journey);
    var payload = {
      contact: {
        external_id: session.contact_external_id,
        email: account.email,
        name: account.name,
        phone: account.phone,
        source: "app-v2",
        status: "active"
      },
      business: {
        external_id: bKey,
        name: profile.businessName || "کسب‌وکار",
        offer: profile.offer || "",
        channel: answers.sales_channel || "",
        current_focus: answers.current_focus || "",
        meta: { questionnaire: "v2", app: "hoshex-app-v2" }
      },
      journey: Object.assign({}, journey, {
        external_id: jKey,
        source: "app-v2",
        version: Number(journey.version || 1)
      }),
      client_context: clientContext()
    };
    if (meta.business_external_id === bKey && meta.journey_external_id === jKey && Number(meta.revision || 0) > 0) {
      payload.base_revision = Number(meta.revision);
    }
    return payload;
  }
  async function postSync(journey, session, retried) {
    var payload = payloadFor(journey, session);
    var response = await fetch(API_BASE + "/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Hoshex-Session": session.token
      },
      body: JSON.stringify(payload)
    });
    if (response.status === 401 && !retried) {
      try { localStorage.removeItem(WP_SESSION_KEY); } catch (error) {}
      return postSync(journey, await ensureSession(true), true);
    }
    var data = null;
    try { data = await response.json(); } catch (error) {}
    if (response.status === 409) {
      writeJson(WP_META_KEY, {
        state: "conflict",
        revision: data && data.data && data.data.server_revision || 0,
        updatedAt: nowIso()
      });
      throw new Error("wp_conflict");
    }
    if (!response.ok || !data || !data.ok) throw new Error("wp_sync_" + response.status);
    writeJson(WP_META_KEY, {
      state: "synced",
      contact_id: data.contact_id,
      business_id: data.business_id,
      journey_id: data.journey_id,
      revision: data.revision,
      business_external_id: payload.business.external_id,
      journey_external_id: payload.journey.external_id,
      syncedAt: nowIso()
    });
    window.dispatchEvent(new CustomEvent("hx:wordpress-synced", { detail: data }));
    track("wordpress_sync_success", { cycles: journey.cycles.length, revision: data.revision });
    return data;
  }
  async function sync(force) {
    if (!enabled || syncing) return false;
    var journey = readJourney();
    if (!journey) return false;
    var raw = JSON.stringify(journey);
    if (!force && raw === lastRaw) return false;
    syncing = true;
    try {
      var session = await ensureSession(false);
      await postSync(journey, session, false);
      lastRaw = raw;
      return true;
    } catch (error) {
      var current = readJson(WP_META_KEY) || {};
      if (current.state !== "conflict") {
        writeJson(WP_META_KEY, { state: "retry", reason: error && error.message || "unknown", updatedAt: nowIso() });
      }
      track("wordpress_sync_failed", { reason: error && error.message || "unknown" });
      return false;
    } finally {
      syncing = false;
    }
  }
  function watch() {
    window.clearInterval(timer);
    timer = window.setInterval(function () { sync(false); }, 1600);
  }

  async function boot() {
    try {
      var response = await fetch(API_BASE + "/health", { method: "GET", headers: { Accept: "application/json" } });
      if (!response.ok) return;
      var data = await response.json();
      var version = String(data && data.version || "0");
      if (!/^1\.(?:[3-9]|[1-9][0-9])\./.test(version) && !/^[2-9]\./.test(version)) return;
      enabled = true;
      watch();
      window.setTimeout(function () { sync(true); }, 350);
      track("wordpress_bridge_ready", { version: version });
    } catch (error) {}
  }

  window.hxWordPressSync = function () { return sync(true); };
  boot();
})();