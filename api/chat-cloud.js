import baseHandler from "./chat.js";

const MAX_TEXT = 700;

function setJsonHeaders(res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
}

function clean(value, max = MAX_TEXT) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, max);
}

function boundedMemory(value) {
  if (!value || typeof value !== "object") return { business: {}, cycles: [] };
  const business = value.business && typeof value.business === "object" ? value.business : {};
  const cycles = Array.isArray(value.cycles) ? value.cycles : [];
  return {
    business: {
      name: clean(business.name, 100),
      offer: clean(business.offer, 180),
      channel: clean(business.channel, 50)
    },
    cycles: cycles.slice(-6).map((cycle) => ({
      diagnosis_key: clean(cycle?.diagnosis_key, 40),
      status: clean(cycle?.status, 30),
      summary: clean(cycle?.summary, 260),
      priority: clean(cycle?.priority, 180),
      action: clean(cycle?.action, 220),
      metric: clean(cycle?.metric, 180),
      feedback: clean(cycle?.feedback, 50),
      decision: clean(cycle?.decision, 50),
      executed: Boolean(cycle?.executed)
    })).filter((cycle) => cycle.diagnosis_key || cycle.summary || cycle.action)
  };
}

function parseJsonContent(content) {
  if (typeof content !== "string") return null;
  const stripped = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(stripped.slice(start, end + 1)); } catch (error) { return null; }
}

function validDiagnosis(value) {
  return Boolean(value && value.main_problem?.title && value.priorities?.[0]?.title && value.today_action?.title && Array.isArray(value.today_action?.steps) && value.success_metric?.metric);
}

function boundDiagnosis(candidate, fallback) {
  if (!validDiagnosis(candidate)) return fallback;
  const severity = ["high", "medium", "low"].includes(String(candidate.main_problem.severity || "").toLowerCase()) ? String(candidate.main_problem.severity).toLowerCase() : fallback.main_problem.severity;
  const steps = candidate.today_action.steps.slice(0, 5).map((step) => clean(step, 260)).filter(Boolean);
  if (!steps.length) return fallback;
  return {
    business_summary: clean(candidate.business_summary, 420) || fallback.business_summary,
    main_problem: {
      title: clean(candidate.main_problem.title, 180) || fallback.main_problem.title,
      reason: clean(candidate.main_problem.reason, 520) || fallback.main_problem.reason,
      severity
    },
    priorities: [{
      rank: 1,
      title: clean(candidate.priorities[0].title, 180) || fallback.priorities[0].title,
      description: clean(candidate.priorities[0].description, 360) || fallback.priorities[0].description
    }],
    today_action: {
      title: clean(candidate.today_action.title, 220) || fallback.today_action.title,
      steps,
      time_required: clean(candidate.today_action.time_required, 100) || fallback.today_action.time_required
    },
    success_metric: {
      metric: clean(candidate.success_metric.metric, 220) || fallback.success_metric.metric,
      period: clean(candidate.success_metric.period, 120) || fallback.success_metric.period
    },
    avoid_now: clean(candidate.avoid_now, 360) || fallback.avoid_now,
    next_step: clean(candidate.next_step, 360) || fallback.next_step
  };
}

async function runBase(req) {
  let statusCode = 200;
  let payload = null;
  const headers = {};
  const fakeRes = {
    setHeader(name, value) { headers[String(name).toLowerCase()] = value; },
    status(code) { statusCode = code; return this; },
    json(value) { payload = value; return value; },
    end() { return null; }
  };
  await baseHandler(req, fakeRes);
  return { statusCode, payload, headers };
}

async function refineWithMemory(body, base, memory) {
  if (!process.env.AVALAI_API_KEY || !memory.cycles.length) return { diagnosis: base, source: "base-no-memory" };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const prompt = `تو لایه حافظه کسب‌وکار هوشکس هستی. یک تشخیص پایه از داده امروز داری و حداکثر ۶ چرخه قبلی هم به عنوان حافظه کمکی.
فقط JSON معتبر و بدون markdown برگردان و ساختار تشخیص پایه را دقیقاً حفظ کن.
قواعد:
- داده امروز از حافظه مهم‌تر است؛ حافظه حق ندارد شواهد فعلی را خنثی کند.
- اگر یک اقدام قبلاً اجرا شده و feedback=no_result بوده، همان اقدام را بدون تغییر تکرار نکن؛ اقدام کوچک‌تر یا فرضیه دقیق‌تری بده.
- اگر feedback=improved بوده، الگوی موفق را در انتخاب قدم بعدی لحاظ کن.
- اگر اقدام قبلی اجرا نشده، مشکل را عوض نکن فقط چون نتیجه نداریم؛ اصطکاک اجرا را کم کن.
- اگر تاریخچه نامرتبط یا ضعیف است، تشخیص پایه را تقریباً دست‌نخورده نگه دار.
- فقط یک مشکل اصلی، یک Priority 01 و یک Today Action.
- reason باید عمدتاً بر شواهد فعلی متکی بماند و فقط در صورت ارتباط روشن به تاریخچه اشاره کند.
ساختار:
{"business_summary":"","main_problem":{"title":"","reason":"","severity":"high|medium|low"},"priorities":[{"rank":1,"title":"","description":""}],"today_action":{"title":"","steps":[""],"time_required":""},"success_metric":{"metric":"","period":""},"avoid_now":"","next_step":""}`;
  try {
    const response = await fetch("https://api.avalai.ir/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.AVALAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.AVALAI_MODEL || "gpt-4o-mini",
        temperature: 0.12,
        max_tokens: 900,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: JSON.stringify({ current: { profile: body.profile || {}, answers: body.answers || {}, base_diagnosis: base }, business_memory: memory }) }
        ]
      }),
      signal: controller.signal
    });
    if (!response.ok) return { diagnosis: base, source: "base-memory-fallback" };
    const data = await response.json();
    const candidate = parseJsonContent(data?.choices?.[0]?.message?.content);
    return { diagnosis: boundDiagnosis(candidate, base), source: validDiagnosis(candidate) ? "avalai-memory" : "base-memory-fallback" };
  } catch (error) {
    return { diagnosis: base, source: "base-memory-fallback" };
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  setJsonHeaders(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = req.body && typeof req.body === "object" ? req.body : (() => { try { return JSON.parse(req.body || "{}"); } catch (error) { return {}; } })();
  const memory = boundedMemory(body.memory);
  const baseReq = { ...req, body: { ...body, memory: undefined } };
  const baseResult = await runBase(baseReq);
  if (baseResult.statusCode !== 200 || !baseResult.payload?.diagnosis) return res.status(baseResult.statusCode).json(baseResult.payload || { error: "diagnosis_failed" });

  const refined = await refineWithMemory(body, baseResult.payload.diagnosis, memory);
  const requestId = baseResult.payload.request_id || `hx-cloud-${Date.now().toString(36)}`;
  console.log("[hx-brain-memory]", JSON.stringify({ request_id: requestId, cycles: memory.cycles.length, source: refined.source }));
  return res.status(200).json({
    ...baseResult.payload,
    diagnosis: refined.diagnosis,
    source: refined.source === "avalai-memory" ? "avalai-memory" : baseResult.payload.source,
    memory: { cycles_used: memory.cycles.length, applied: refined.source === "avalai-memory" }
  });
}
