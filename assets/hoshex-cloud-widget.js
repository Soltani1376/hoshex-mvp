(function () {
  "use strict";
  var URL = "https://ihxbwyqmmzbyolsdryec.supabase.co";
  var KEY = "sb_publishable_FZzQMdoK6L356q4tRpugwA_OjjejS09";
  var SESSION_KEY = "hx_cloud_widget_session_v1";

  function esc(value) { return String(value == null ? "" : value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;"); }
  function readSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch (e) { return null; } }
  function saveSession(value) { try { localStorage.setItem(SESSION_KEY, JSON.stringify(value)); } catch (e) {} return value; }
  function jalali(value) { try { return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year:"numeric", month:"long", day:"numeric" }).format(new Date(value)); } catch (e) { return ""; } }
  async function auth(path, options) {
    options = options || {};
    var headers = Object.assign({ apikey:KEY, "Content-Type":"application/json", Accept:"application/json" }, options.headers || {});
    return fetch(URL + path, Object.assign({}, options, { headers:headers }));
  }
  async function refresh(session) {
    if (!session || !session.refresh_token) return null;
    var res = await auth("/auth/v1/token?grant_type=refresh_token", { method:"POST", body:JSON.stringify({ refresh_token:session.refresh_token }) });
    if (!res.ok) return null;
    var data = await res.json();
    return saveSession({ access_token:data.access_token, refresh_token:data.refresh_token, expires_at:Math.floor(Date.now()/1000)+Number(data.expires_in||3600), user:data.user });
  }
  async function session() {
    var s = readSession();
    if (!s) return null;
    if (Number(s.expires_at||0)*1000 < Date.now()+60000) s = await refresh(s);
    return s;
  }
  async function login(email,password) {
    var res = await auth("/auth/v1/token?grant_type=password", { method:"POST", body:JSON.stringify({ email:email, password:password }) });
    var data = await res.json().catch(function(){return {};});
    if (!res.ok) throw new Error(data.message || "login_failed");
    return saveSession({ access_token:data.access_token, refresh_token:data.refresh_token, expires_at:Math.floor(Date.now()/1000)+Number(data.expires_in||3600), user:data.user });
  }
  async function rest(path,s) {
    return fetch(URL + "/rest/v1/" + path, { headers:{ apikey:KEY, Authorization:"Bearer "+s.access_token, Accept:"application/json" } });
  }
  async function loadPath(s) {
    var jres = await rest("journeys?user_id=eq."+encodeURIComponent(s.user.id)+"&select=*&order=updated_at.desc&limit=1",s);
    if (!jres.ok) throw new Error("journey_failed");
    var journeys = await jres.json();
    var journey = journeys[0];
    if (!journey) return null;
    var cres = await rest("cycles?journey_id=eq."+encodeURIComponent(journey.id)+"&select=*&order=created_at.desc&limit=1",s);
    var cycles = cres.ok ? await cres.json() : [];
    var cycle = cycles[0] || null;
    var eres = cycle ? await rest("executions?cycle_id=eq."+encodeURIComponent(cycle.id)+"&select=*&limit=1",s) : null;
    var executions = eres && eres.ok ? await eres.json() : [];
    return { journey:journey, cycle:cycle, execution:executions[0]||null };
  }

  function styles() {
    if (document.getElementById("hx-cloud-widget-style")) return;
    var style=document.createElement("style"); style.id="hx-cloud-widget-style";
    style.textContent='.hxw{direction:rtl;font-family:Tahoma,Arial,sans-serif;max-width:520px;border:1px solid #e7e9f0;border-radius:16px;background:#fff;padding:16px;color:#172033;box-shadow:0 10px 30px rgba(15,23,42,.05)}.hxw *{box-sizing:border-box}.hxw b{font-size:12px;color:#5b56d8}.hxw h3{margin:5px 0 12px;font-size:20px}.hxw p{margin:0 0 10px;color:#687386;font-size:13px;line-height:1.8}.hxw-grid{display:grid;gap:8px}.hxw-card{padding:11px;border-radius:11px;background:#f8fafc}.hxw-card span{display:block;color:#98a1b2;font-size:10px}.hxw-card strong{display:block;margin-top:3px;font-weight:600;font-size:13px}.hxw form{display:grid;gap:8px}.hxw input,.hxw button{height:42px;border-radius:10px;font-family:inherit}.hxw input{border:1px solid #e2e8f0;padding:0 10px}.hxw button{border:0;background:#5546d8;color:#fff;cursor:pointer}.hxw small{color:#98a1b2;font-size:10px}.hxw-actions{display:flex;gap:7px;margin-top:10px}.hxw-actions button{flex:1}.hxw-actions .ghost{background:#f1f5f9;color:#64748b}';
    document.head.appendChild(style);
  }

  async function render(el) {
    styles();
    var s=await session();
    if (!s) {
      el.innerHTML='<div class="hxw"><b>HOSHEX CLOUD</b><h3>مسیر کسب‌وکارت</h3><p>با همان حساب هوشکس وارد شو تا آخرین تشخیص و قدم بعدی روی سایت هم نمایش داده شود.</p><form data-hxw-login><input name="email" type="email" autocomplete="email" required placeholder="ایمیل"><input name="password" type="password" autocomplete="current-password" required minlength="8" placeholder="رمز عبور"><button type="submit">ورود و نمایش مسیر</button><small data-hxw-error></small></form></div>';
      return;
    }
    var data=await loadPath(s).catch(function(){return null;});
    if (!data || !data.cycle) {
      el.innerHTML='<div class="hxw"><b>HOSHEX CLOUD</b><h3>هنوز مسیری ثبت نشده</h3><p>از App V2 یک تشخیص انجام بده؛ بعد همین‌جا ادامه مسیرت نمایش داده می‌شود.</p><div class="hxw-actions"><button data-hxw-open>باز کردن هوشکس</button><button class="ghost" data-hxw-logout>خروج</button></div></div>';
      return;
    }
    var cycle=data.cycle, execution=data.execution;
    var check=execution&&execution.check_in_at?jalali(execution.check_in_at):(execution?execution.check_in_days+' روز بعد از اجرا':'بعد از اجرا');
    el.innerHTML='<div class="hxw"><b>HOSHEX CLOUD · مسیر فعال</b><h3>'+esc(cycle.priority&&cycle.priority.title||"اولویت فعلی")+'</h3><div class="hxw-grid"><div class="hxw-card"><span>کار فعلی</span><strong>'+esc(cycle.action&&cycle.action.title||"-")+'</strong></div><div class="hxw-card"><span>معیار نتیجه</span><strong>'+esc(cycle.metric&&cycle.metric.metric||"-")+'</strong></div><div class="hxw-card"><span>بررسی بعدی</span><strong>'+esc(check)+'</strong></div></div><div class="hxw-actions"><button data-hxw-open>ادامه در هوشکس</button><button class="ghost" data-hxw-logout>خروج</button></div></div>';
  }

  document.addEventListener("submit",function(e){var form=e.target.closest&&e.target.closest("[data-hxw-login]");if(!form)return;e.preventDefault();var root=form.closest("[data-hoshex-cloud-widget]");var err=form.querySelector("[data-hxw-error]");login(form.email.value.trim().toLowerCase(),form.password.value).then(function(){render(root);}).catch(function(){err.textContent="ورود انجام نشد؛ ایمیل، رمز یا تأیید حساب را بررسی کن.";});},true);
  document.addEventListener("click",function(e){var open=e.target.closest&&e.target.closest("[data-hxw-open]");if(open)window.open("https://hoshex-app.vercel.app","_blank","noopener");var logout=e.target.closest&&e.target.closest("[data-hxw-logout]");if(logout){try{localStorage.removeItem(SESSION_KEY);}catch(x){}render(logout.closest("[data-hoshex-cloud-widget]"));}},true);
  function init(){document.querySelectorAll("[data-hoshex-cloud-widget]").forEach(render);}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();