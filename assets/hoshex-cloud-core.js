(function () {
  "use strict";

  var SUPABASE_URL = "https://ihxbwyqmmzbyolsdryec.supabase.co";
  var PUBLISHABLE_KEY = "sb_publishable_FZzQMdoK6L356q4tRpugwA_OjjejS09";
  var JOURNEY_KEY = "hx_business_journey_v1";
  var SESSION_KEY = "hx_cloud_session_v1";
  var BUSINESS_KEY = "hx_cloud_business_key_v1";
  var GUEST_BACKUP_KEY = "hx_cloud_guest_backup_v1";
  var CLOUD_META_KEY = "hx_cloud_meta_v1";
  var syncTimer = null;
  var syncing = false;
  var lastJourneyRaw = "";

  function nowIso() { return new Date().toISOString(); }
  function uuid() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return "hx-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }
  function esc(value) {
    if (window.hxEscape) return window.hxEscape(value);
    return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
  }
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
  function currentCycle(journey) {
    if (!journey || !journey.cycles || !journey.cycles.length) return null;
    return journey.cycles.find(function (cycle) { return cycle.id === journey.currentCycleId; }) || journey.cycles[journey.cycles.length - 1];
  }
  function getBusinessKey() {
    var key = localStorage.getItem(BUSINESS_KEY);
    if (!key) {
      key = "business-" + uuid();
      try { localStorage.setItem(BUSINESS_KEY, key); } catch (error) {}
    }
    return key;
  }
  function emit(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
  }
  function track(name, properties) {
    if (window.hxTrack) window.hxTrack(name, properties || {});
  }

  async function authFetch(path, options) {
    options = options || {};
    var headers = Object.assign({ apikey: PUBLISHABLE_KEY, "Content-Type": "application/json", Accept: "application/json" }, options.headers || {});
    return fetch(SUPABASE_URL + path, Object.assign({}, options, { headers: headers }));
  }

  function normalizeSession(payload, guest) {
    if (!payload || !payload.access_token || !payload.refresh_token) return null;
    return {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      expires_at: Number(payload.expires_at || (Math.floor(Date.now() / 1000) + Number(payload.expires_in || 3600))),
      user: payload.user || null,
      guest: Boolean(guest)
    };
  }

  function saveSession(session) {
    if (!session) return null;
    writeJson(SESSION_KEY, session);
    emit("hx:cloud-session", { session: session });
    renderCloudUi();
    return session;
  }

  async function refreshSession(session) {
    if (!session || !session.refresh_token) return null;
    try {
      var response = await authFetch("/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        body: JSON.stringify({ refresh_token: session.refresh_token })
      });
      if (!response.ok) return null;
      var payload = await response.json();
      return saveSession(normalizeSession(payload, session.guest));
    } catch (error) { return null; }
  }

  async function bootstrapGuest() {
    try {
      var response = await fetch(SUPABASE_URL + "/functions/v1/guest-bootstrap", {
        method: "POST",
        headers: { apikey: PUBLISHABLE_KEY, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ source: "hoshex-app-v2" })
      });
      if (!response.ok) throw new Error("guest_bootstrap_failed");
      var payload = await response.json();
      var session = normalizeSession(payload, true);
      if (!session) throw new Error("guest_session_missing");
      saveSession(session);
      track("cloud_guest_created");
      return session;
    } catch (error) {
      writeJson(CLOUD_META_KEY, { state: "offline", updatedAt: nowIso() });
      renderCloudUi();
      return null;
    }
  }

  async function ensureSession() {
    var session = readJson(SESSION_KEY);
    if (session && session.access_token) {
      if (Number(session.expires_at || 0) * 1000 > Date.now() + 90 * 1000) return session;
      var refreshed = await refreshSession(session);
      if (refreshed) return refreshed;
    }
    return bootstrapGuest();
  }

  async function rest(path, options, session) {
    session = session || await ensureSession();
    if (!session) throw new Error("cloud_session_unavailable");
    options = options || {};
    var headers = Object.assign({
      apikey: PUBLISHABLE_KEY,
      Authorization: "Bearer " + session.access_token,
      "Content-Type": "application/json",
      Accept: "application/json"
    }, options.headers || {});
    var response = await fetch(SUPABASE_URL + "/rest/v1/" + path, Object.assign({}, options, { headers: headers }));
    if (response.status === 401) {
      var refreshed = await refreshSession(session);
      if (refreshed) return rest(path, options, refreshed);
    }
    return response;
  }

  async function upsert(table, conflict, body, session) {
    var response = await rest(table + "?on_conflict=" + encodeURIComponent(conflict) + "&select=*", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(body)
    }, session);
    if (!response.ok) throw new Error("upsert_" + table + "_failed");
    var data = await response.json();
    return Array.isArray(data) ? data[0] : data;
  }

  function executionPayload(execution, ids, userId) {
    if (!execution || !execution.artifact) return null;
    return {
      user_id: userId,
      business_id: ids.businessId,
      journey_id: ids.journeyId,
      cycle_id: ids.cycleId,
      execution_type: execution.execution_type || null,
      execution_title: execution.execution_title || null,
      artifact: execution.artifact || "",
      usage_hint: execution.usage_hint || "",
      context: execution.context || {},
      check_in_days: Math.max(1, Math.min(7, Number(execution.check_in_days) || 2)),
      check_in_at: execution.checkInAt || null,
      copied_at: execution.copiedAt || null,
      executed_at: execution.executedAt || null,
      source: execution.source || null,
      updated_at: nowIso()
    };
  }

  async function syncJourney(force) {
    if (syncing) return false;
    var journey = readJourney();
    if (!journey) return false;
    var raw = JSON.stringify(journey);
    if (!force && raw === lastJourneyRaw) return false;
    syncing = true;
    try {
      var session = await ensureSession();
      if (!session || !session.user || !session.user.id) throw new Error("missing_user");
      var userId = session.user.id;
      var profile = journey.profile || {};
      var answers = journey.answers || {};
      var business = await upsert("businesses", "user_id,client_key", {
        user_id: userId,
        client_key: getBusinessKey(),
        name: profile.businessName || "کسب‌وکار",
        offer: profile.offer || "",
        channel: answers.sales_channel || null,
        current_focus: answers.current_focus || null,
        updated_at: nowIso()
      }, session);
      var cloudJourney = await upsert("journeys", "user_id,business_id", {
        user_id: userId,
        business_id: business.id,
        local_journey_id: journey.createdAt || "journey-v1",
        source: "app-v2",
        answers: answers,
        profile: profile,
        updated_at: journey.updatedAt || nowIso()
      }, session);

      var cycleMap = {};
      for (var i = 0; i < journey.cycles.length; i += 1) {
        var cycle = journey.cycles[i];
        var cloudCycle = await upsert("cycles", "journey_id,local_cycle_id", {
          user_id: userId,
          business_id: business.id,
          journey_id: cloudJourney.id,
          local_cycle_id: cycle.id || ("cycle-" + i),
          kind: cycle.kind || "diagnosis",
          diagnosis_key: cycle.diagnosisKey || null,
          status: cycle.status || "active",
          summary: cycle.summary || "",
          priority: cycle.priority || {},
          action: cycle.action || {},
          metric: cycle.metric || {},
          avoid_now: cycle.avoid_now || "",
          check_in_question: cycle.check_in_question || "",
          decision: cycle.decision || null,
          feedback: cycle.feedback || null,
          raw_cycle: cycle,
          updated_at: cycle.updatedAt || nowIso()
        }, session);
        cycleMap[cycle.id] = cloudCycle.id;
        var execution = executionPayload(cycle.execution, { businessId: business.id, journeyId: cloudJourney.id, cycleId: cloudCycle.id }, userId);
        if (execution) await upsert("executions", "cycle_id", execution, session);
        if (cycle.feedback && cycle.feedback.outcome) {
          await upsert("feedback", "cycle_id", {
            user_id: userId,
            business_id: business.id,
            journey_id: cloudJourney.id,
            cycle_id: cloudCycle.id,
            outcome: cycle.feedback.outcome,
            note: cycle.feedback.note || "",
            payload: cycle.feedback
          }, session);
        }
      }

      var currentCloudCycle = cycleMap[journey.currentCycleId] || null;
      if (currentCloudCycle) {
        var patch = await rest("journeys?id=eq." + encodeURIComponent(cloudJourney.id), {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ current_cycle_id: currentCloudCycle, updated_at: journey.updatedAt || nowIso() })
        }, session);
        if (!patch.ok) throw new Error("journey_pointer_failed");
      }
      lastJourneyRaw = raw;
      writeJson(CLOUD_META_KEY, { state: "synced", businessId: business.id, journeyId: cloudJourney.id, syncedAt: nowIso() });
      emit("hx:cloud-synced", { businessId: business.id, journeyId: cloudJourney.id });
      track("cloud_sync_success", { cycles: journey.cycles.length, guest: session.guest });
      renderCloudUi();
      return true;
    } catch (error) {
      writeJson(CLOUD_META_KEY, { state: "retry", updatedAt: nowIso() });
      track("cloud_sync_failed", { reason: error && error.message || "unknown" });
      renderCloudUi();
      return false;
    } finally {
      syncing = false;
    }
  }

  async function pullLatest() {
    var session = await ensureSession();
    if (!session || !session.user) return null;
    try {
      var journeysRes = await rest("journeys?user_id=eq." + encodeURIComponent(session.user.id) + "&select=*&order=updated_at.desc&limit=1", { method: "GET" }, session);
      if (!journeysRes.ok) return null;
      var journeys = await journeysRes.json();
      var cloudJourney = journeys && journeys[0];
      if (!cloudJourney) return null;
      var cyclesRes = await rest("cycles?journey_id=eq." + encodeURIComponent(cloudJourney.id) + "&select=*&order=created_at.asc", { method: "GET" }, session);
      if (!cyclesRes.ok) return null;
      var cloudCycles = await cyclesRes.json();
      var executionsRes = await rest("executions?journey_id=eq." + encodeURIComponent(cloudJourney.id) + "&select=*", { method: "GET" }, session);
      var executions = executionsRes.ok ? await executionsRes.json() : [];
      var executionByCycle = {};
      (executions || []).forEach(function (item) { executionByCycle[item.cycle_id] = item; });
      var cloudToLocal = {};
      var cycles = (cloudCycles || []).map(function (item) {
        var cycle = item.raw_cycle && typeof item.raw_cycle === "object" ? item.raw_cycle : {};
        cycle.id = cycle.id || item.local_cycle_id || item.id;
        cycle.kind = item.kind || cycle.kind;
        cycle.diagnosisKey = item.diagnosis_key || cycle.diagnosisKey;
        cycle.status = item.status || cycle.status;
        cycle.summary = item.summary || cycle.summary;
        cycle.priority = item.priority || cycle.priority || {};
        cycle.action = item.action || cycle.action || {};
        cycle.metric = item.metric || cycle.metric || {};
        cycle.avoid_now = item.avoid_now || cycle.avoid_now || "";
        cycle.check_in_question = item.check_in_question || cycle.check_in_question || "";
        cycle.decision = item.decision || cycle.decision;
        cycle.feedback = item.feedback || cycle.feedback;
        cycle.updatedAt = item.updated_at || cycle.updatedAt;
        cloudToLocal[item.id] = cycle.id;
        var execution = executionByCycle[item.id];
        if (execution) {
          cycle.execution = {
            execution_type: execution.execution_type,
            execution_title: execution.execution_title,
            artifact: execution.artifact,
            usage_hint: execution.usage_hint,
            context: execution.context || {},
            check_in_days: execution.check_in_days,
            checkInAt: execution.check_in_at || "",
            copiedAt: execution.copied_at || "",
            executedAt: execution.executed_at || "",
            source: execution.source || "cloud"
          };
        }
        return cycle;
      });
      var rebuilt = {
        version: 1,
        createdAt: cloudJourney.created_at,
        updatedAt: cloudJourney.updated_at,
        profile: cloudJourney.profile || {},
        answers: cloudJourney.answers || {},
        currentCycleId: cloudToLocal[cloudJourney.current_cycle_id] || (cycles[cylesSafeIndex(cycles)] && cycles[cylesSafeIndex(cycles)].id) || null,
        cycles: cycles
      };
      var local = readJourney();
      var localTime = local && Date.parse(local.updatedAt || local.createdAt || 0) || 0;
      var cloudTime = Date.parse(rebuilt.updatedAt || rebuilt.createdAt || 0) || 0;
      if (!local || cloudTime > localTime) {
        writeJson(JOURNEY_KEY, rebuilt);
        lastJourneyRaw = JSON.stringify(rebuilt);
        emit("hx:cloud-pulled", { journey: rebuilt });
        if (window.hxCompletionRefresh) window.hxCompletionRefresh();
        if (window.hxAppShellRefresh) window.hxAppShellRefresh();
        track("cloud_pull_applied", { cycles: cycles.length });
        return rebuilt;
      }
      return local;
    } catch (error) { return null; }
  }

  function cylesSafeIndex(cycles) { return Math.max(0, (cycles || []).length - 1); }

  function brainMemory() {
    var journey = readJourney();
    if (!journey || !journey.cycles) return { cycles: [] };
    return {
      business: {
        name: journey.profile && journey.profile.businessName || "",
        offer: journey.profile && journey.profile.offer || "",
        channel: journey.answers && journey.answers.sales_channel || ""
      },
      cycles: journey.cycles.slice(-6).map(function (cycle) {
        return {
          diagnosis_key: cycle.diagnosisKey || "",
          status: cycle.status || "",
          summary: cycle.summary || "",
          priority: cycle.priority && cycle.priority.title || "",
          action: cycle.action && cycle.action.title || "",
          metric: cycle.metric && cycle.metric.metric || "",
          feedback: cycle.feedback && cycle.feedback.outcome || "",
          decision: cycle.decision || "",
          executed: Boolean(cycle.execution && cycle.execution.executedAt)
        };
      })
    };
  }

  function installDiagnosisBridge() {
    if (!window.fetch || window.fetch.__hxCloudWrapped) return;
    var nativeFetch = window.fetch.bind(window);
    async function wrapped(input, init) {
      var url = typeof input === "string" ? input : input && input.url || "";
      var method = String(init && init.method || "GET").toUpperCase();
      if (/\/api\/chat(?:\?|$)/.test(url) && method === "POST" && init && typeof init.body === "string") {
        try {
          var body = JSON.parse(init.body);
          body.memory = brainMemory();
          init = Object.assign({}, init, { body: JSON.stringify(body) });
          input = url.replace(/\/api\/chat(?=\?|$)/, "/api/chat-cloud");
        } catch (error) {}
      }
      return nativeFetch(input, init);
    }
    wrapped.__hxCloudWrapped = true;
    wrapped.__hxCloudNative = nativeFetch;
    window.fetch = wrapped;
  }

  async function signUp(email, password) {
    var response = await authFetch("/auth/v1/signup", {
      method: "POST",
      body: JSON.stringify({ email: email, password: password, data: { source: "hoshex-cloud" } })
    });
    var payload = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(payload.msg || payload.message || payload.error_description || "signup_failed");
    track("cloud_account_signup_requested");
    return payload;
  }

  async function signIn(email, password) {
    var guestSession = readJson(SESSION_KEY);
    if (guestSession && guestSession.guest) writeJson(GUEST_BACKUP_KEY, guestSession);
    var response = await authFetch("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email: email, password: password })
    });
    var payload = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(payload.msg || payload.message || payload.error_description || "signin_failed");
    var session = normalizeSession(payload, false);
    saveSession(session);
    var guest = readJson(GUEST_BACKUP_KEY);
    if (guest && guest.access_token && guest.user && guest.user.id !== session.user.id) await claimGuest(guest, session);
    try { localStorage.removeItem(GUEST_BACKUP_KEY); } catch (error) {}
    await pullLatest();
    await syncJourney(true);
    track("cloud_account_signed_in");
    renderCloudUi();
    return session;
  }

  async function claimGuest(guest, target) {
    var response = await fetch(SUPABASE_URL + "/functions/v1/claim-guest", {
      method: "POST",
      headers: { apikey: PUBLISHABLE_KEY, Authorization: "Bearer " + target.access_token, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ guest_access_token: guest.access_token })
    });
    if (!response.ok) throw new Error("claim_guest_failed");
    var payload = await response.json();
    track("cloud_guest_claimed", payload.moved || {});
    return payload;
  }

  function signOut() {
    try { localStorage.removeItem(SESSION_KEY); localStorage.removeItem(GUEST_BACKUP_KEY); } catch (error) {}
    bootstrapGuest().then(function () { syncJourney(true); });
    track("cloud_signed_out");
    renderCloudUi();
  }

  function closeModal() {
    var modal = document.querySelector("[data-hx-cloud-modal]");
    if (modal) modal.remove();
  }

  function accountModal(mode) {
    closeModal();
    var session = readJson(SESSION_KEY);
    var guest = !session || session.guest;
    var modal = document.createElement("div");
    modal.className = "hx-cloud-modal";
    modal.setAttribute("data-hx-cloud-modal", "true");
    modal.innerHTML = '<div class="hx-cloud-dialog" role="dialog" aria-modal="true" aria-labelledby="hx-cloud-title"><button class="hx-cloud-close" type="button" data-cloud-action="close">×</button><span class="hx-cloud-badge">HOSHEX CLOUD</span><h2 id="hx-cloud-title">' + (guest ? 'مسیرت رو روی هوشکس ذخیره کن' : 'حساب هوشکس') + '</h2><p>' + (guest ? 'با حساب، همین مسیر روی سایت، موبایل و دستگاه بعدی ادامه پیدا می‌کند.' : 'داده‌های این کسب‌وکار با Cloud همگام می‌شوند.') + '</p><div class="hx-cloud-tabs"><button type="button" data-cloud-tab="login" class="' + (mode === "login" ? 'is-active' : '') + '">ورود</button><button type="button" data-cloud-tab="signup" class="' + (mode !== "login" ? 'is-active' : '') + '">ساخت حساب</button></div><form id="hx-cloud-account-form"><input type="email" id="hx-cloud-email" autocomplete="email" required placeholder="ایمیل"><input type="password" id="hx-cloud-password" autocomplete="current-password" minlength="8" required placeholder="رمز عبور (حداقل ۸ کاراکتر)"><p class="hx-cloud-error" id="hx-cloud-error"></p><button class="hx-primary" type="submit">' + (mode === "login" ? 'ورود و بازیابی مسیر ←' : 'ساخت حساب و ذخیره مسیر ←') + '</button></form><small>اگر حساب جدید می‌سازی، ایمیل تأیید Supabase را باز کن و بعد از همین پنجره وارد شو.</small></div>';
    modal.setAttribute("data-mode", mode || "signup");
    document.body.appendChild(modal);
    var email = modal.querySelector("#hx-cloud-email");
    if (email) setTimeout(function () { email.focus(); }, 50);
  }

  function cloudStateLabel() {
    var session = readJson(SESSION_KEY);
    var meta = readJson(CLOUD_META_KEY) || {};
    if (!session) return "Cloud خاموش";
    if (!session.guest) return meta.state === "synced" ? "Cloud ذخیره شد" : "حساب هوشکس";
    if (meta.state === "synced") return "مسیر موقت ذخیره شد";
    return "ذخیره مسیر";
  }

  function renderCloudUi() {
    var topbar = document.querySelector(".hx-topbar");
    if (!topbar) return;
    var existing = topbar.querySelector("[data-hx-cloud-status]");
    if (!existing) {
      existing = document.createElement("button");
      existing.type = "button";
      existing.className = "hx-cloud-status";
      existing.setAttribute("data-hx-cloud-status", "true");
      existing.setAttribute("data-cloud-action", "account");
      topbar.appendChild(existing);
    }
    var session = readJson(SESSION_KEY);
    existing.classList.toggle("is-account", Boolean(session && !session.guest));
    existing.innerHTML = '<span class="hx-cloud-dot"></span><span>' + esc(cloudStateLabel()) + '</span>';
  }

  function bindUi() {
    document.addEventListener("click", function (event) {
      var target = event.target.closest && event.target.closest("[data-cloud-action], [data-cloud-tab]");
      if (!target) return;
      var action = target.getAttribute("data-cloud-action");
      var tab = target.getAttribute("data-cloud-tab");
      if (action === "close") closeModal();
      if (action === "account") accountModal(readJson(SESSION_KEY) && !readJson(SESSION_KEY).guest ? "login" : "signup");
      if (tab) accountModal(tab);
    }, true);
    document.addEventListener("submit", async function (event) {
      if (!event.target || event.target.id !== "hx-cloud-account-form") return;
      event.preventDefault();
      var modal = event.target.closest("[data-hx-cloud-modal]");
      var mode = modal && modal.getAttribute("data-mode") || "signup";
      var email = String(document.getElementById("hx-cloud-email").value || "").trim().toLowerCase();
      var password = String(document.getElementById("hx-cloud-password").value || "");
      var errorNode = document.getElementById("hx-cloud-error");
      if (password.length < 8) { errorNode.textContent = "رمز باید حداقل ۸ کاراکتر باشد."; return; }
      var submit = event.target.querySelector("button[type=submit]");
      if (submit) submit.disabled = true;
      try {
        if (mode === "login") {
          await signIn(email, password);
          closeModal();
          if (window.hxShowToast) window.hxShowToast("حساب وصل شد و مسیرت از Cloud بازیابی شد.");
        } else {
          await signUp(email, password);
          errorNode.textContent = "ایمیل تأیید ارسال شد. بعد از تأیید، از تب «ورود» وارد شو تا مسیر به حسابت منتقل شود.";
          if (window.hxShowToast) window.hxShowToast("ایمیل تأیید حساب ارسال شد.");
        }
      } catch (error) {
        errorNode.textContent = "عملیات حساب انجام نشد. ایمیل، رمز یا تأیید ایمیل را بررسی کن.";
      } finally { if (submit) submit.disabled = false; }
    }, true);
  }

  function watchJourney() {
    lastJourneyRaw = "";
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = setInterval(function () {
      var raw = "";
      try { raw = localStorage.getItem(JOURNEY_KEY) || ""; } catch (error) {}
      if (raw && raw !== lastJourneyRaw) syncJourney(false);
    }, 1800);
  }

  async function init() {
    installDiagnosisBridge();
    bindUi();
    renderCloudUi();
    await ensureSession();
    await pullLatest();
    await syncJourney(true);
    watchJourney();
    renderCloudUi();
    emit("hx:cloud-ready", { session: readJson(SESSION_KEY) });
  }

  window.hxCloud = {
    ensureSession: ensureSession,
    sync: function () { return syncJourney(true); },
    pull: pullLatest,
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    account: accountModal,
    memory: brainMemory,
    session: function () { return readJson(SESSION_KEY); }
  };
  window.hxCloudGetBrainMemory = brainMemory;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();