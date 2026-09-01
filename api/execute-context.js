const DIAGNOSIS_KEYS = ["acquisition", "offer", "sales_process", "focus"];
const TYPES = ["content_cta", "offer_copy", "sales_reply", "focus_plan"];
const CONTEXT_KEYS = ["pain", "cta", "objection", "proof", "outcome", "available_time", "subject", "audience"];

function clean(value, fallback = "", max = 700) {
  if (typeof value !== "string") return fallback;
  return value.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, max);
}

function bodyOf(body) {
  if (body && typeof body === "object") return body;
  try { return JSON.parse(body || "{}"); } catch (error) { return {}; }
}

function normalizeContext(value) {
  const source = value && typeof value === "object" ? value : {};
  return CONTEXT_KEYS.reduce((acc, key) => {
    const item = clean(source[key]);
    if (item) acc[key] = item;
    return acc;
  }, {});
}

function normalizedInput(body) {
  const source = bodyOf(body);
  const profile = source.profile && typeof source.profile === "object" ? source.profile : {};
  const plan = source.currentPlan && typeof source.currentPlan === "object" ? source.currentPlan : {};
  const action = plan.action && typeof plan.action === "object" ? plan.action : {};
  const priority = plan.priority && typeof plan.priority === "object" ? plan.priority : {};
  const metric = plan.metric && typeof plan.metric === "object" ? plan.metric : {};
  const diagnosisKey = clean(source.diagnosisKey, "offer", 40);
  return {
    sessionId: clean(source.sessionId, "", 100),
    cycleNumber: Math.max(1, Math.min(99, Number(source.cycleNumber) || 1)),
    diagnosisKey: DIAGNOSIS_KEYS.includes(diagnosisKey) ? diagnosisKey : "offer",
    profile: { businessName: clean(profile.businessName, "کسب‌وکار"), offer: clean(profile.offer, "محصول یا خدمت اصلی") },
    answers: source.answers && typeof source.answers === "object" ? source.answers : {},
    executionContext: normalizeContext(source.executionContext),
    currentPlan: {
      summary: clean(plan.summary),
      priority: { title: clean(priority.title, "اولویت فعلی"), description: clean(priority.description) },
      action: { title: clean(action.title, "کار فعلی"), steps: Array.isArray(action.steps) ? action.steps.slice(0, 5).map((item) => clean(item)).filter(Boolean) : [], time_required: clean(action.time_required, "کمتر از یک روز") },
      metric: { metric: clean(metric.metric, "نتیجه قابل اندازه‌گیری"), period: clean(metric.period, "تا ۷ روز آینده") }
    }
  };
}

function cta(value) {
  if (value === "website") return "برای دیدن جزئیات و ادامه، روی لینک سایت بزن.";
  if (value === "whatsapp") return "برای ادامه، در واتساپ پیام بده.";
  return "برای ادامه، یک پیام دایرکت بفرست.";
}

function makeExecution(input) {
  const i = input && input.currentPlan ? input : normalizedInput(input || {});
  const ctx = i.executionContext || {};
  const business = i.profile?.businessName || "کسب‌وکار";
  const offer = i.profile?.offer || "محصول یا خدمت اصلی";

  if (i.diagnosisKey === "acquisition") {
    const pain = ctx.pain || "مشکل مشخص مخاطب";
    return { execution_title: "متن جذب آماده انتشار", execution_type: "content_cta", artifact: `هوک:\nاگر «${pain}» برات آشناست، این نکته رو ببین.\n\nمتن:\nدر ${business} برای «${offer}» روی همین مسئله تمرکز کردیم: ${pain}. قبل از معرفی طولانی محصول، اول همان چیزی را می‌گوییم که مخاطب الان با آن درگیر است.\n\nCTA:\n${cta(ctx.cta)}`, usage_hint: "همین نسخه را با یک تصویر یا ویدیوی ساده منتشر کن و CTA را در این تست ثابت نگه دار.", check_in_days: 3 };
  }

  if (i.diagnosisKey === "sales_process") {
    const objection = ctx.objection || "تردید اصلی قبل از خرید";
    const proof = ctx.proof || "اطلاعات واقعی محصول و شرایط خرید را شفاف توضیح می‌دهیم";
    return { execution_title: "پاسخ آماده برای تردید خرید", execution_type: "sales_reply", artifact: `کاملاً قابل درکه که قبل از خرید درباره «${objection}» مطمئن بشی.\n\nچیزی که می‌تونم شفاف بگم اینه: ${proof}.\n\nاگر بخوای، بر اساس نیاز خودت می‌گم «${offer}» واقعاً انتخاب مناسبی هست یا نه.\n\nمهم‌ترین چیزی که هنوز باید بدونی چیه؟`, usage_hint: "همین پاسخ را در اولین گفت‌وگوی مرتبط استفاده کن و پاسخ بعدی مشتری را برای Feedback نگه دار.", check_in_days: 2 };
  }

  if (i.diagnosisKey === "focus") {
    const outcome = ctx.outcome || i.currentPlan.metric.metric;
    const minutes = ctx.available_time || "60";
    return { execution_title: "برنامه اجرایی یک‌تمرکزی", execution_type: "focus_plan", artifact: `نتیجه این چرخه:\n${outcome}\n\nزمان واقعی امروز:\n${minutes} دقیقه\n\nکار اصلی:\n${i.currentPlan.action.title}\n\nقانون چرخه:\nتا انجام این کار، کار تازه‌ای که مستقیم به همین نتیجه کمک نمی‌کند اضافه نکن.\n\nتعریف پایان:\nاقدام انجام شده و عدد نتیجه ثبت شده باشد.`, usage_hint: "تا Check-in فقط همین نتیجه را دنبال کن.", check_in_days: 1 };
  }

  const subject = ctx.subject || offer;
  const audience = ctx.audience || "مخاطب اصلی این پیشنهاد";
  return { execution_title: "پیشنهاد فروش آماده اجرا", execution_type: "offer_copy", artifact: `پیشنهاد اصلی:\n«${subject}» برای ${audience} ساخته شده؛ با یک انتخاب روشن و قدم بعدی مشخص.\n\nاستوری ۱:\nاگر نتیجه‌ای که می‌خوای مشخصه ولی بین گزینه‌ها گیر کردی، اول باید انتخاب مناسب نیاز خودت را پیدا کنی.\n\nاستوری ۲:\nدر ${business}، «${subject}» را برای همین نیاز ارائه می‌کنیم؛ بدون پیچیده‌کردن تصمیم.\n\nاستوری ۳ / CTA:\n${cta(ctx.cta)}`, usage_hint: "این سه بخش را پشت‌سرهم منتشر کن و موضوع، مخاطب و CTA را ثابت نگه دار.", check_in_days: 2 };
}

function validExecution(value) {
  return Boolean(value && TYPES.includes(value.execution_type) && typeof value.execution_title === "string" && typeof value.artifact === "string" && value.artifact.length >= 40 && typeof value.usage_hint === "string" && Number(value.check_in_days) >= 1 && Number(value.check_in_days) <= 7);
}

function parseCandidate(value) {
  if (typeof value !== "string") return null;
  try { return JSON.parse(value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "")); } catch (error) { return null; }
}

function bounded(value, fallback) {
  if (!validExecution(value)) return fallback;
  return {
    execution_title: clean(value.execution_title, fallback.execution_title),
    execution_type: TYPES.includes(value.execution_type) ? value.execution_type : fallback.execution_type,
    artifact: clean(value.artifact, fallback.artifact, 1000),
    usage_hint: clean(value.usage_hint, fallback.usage_hint, 400),
    check_in_days: Math.max(1, Math.min(7, Math.round(Number(value.check_in_days) || fallback.check_in_days)))
  };
}

async function askAvalAI(input, fallback) {
  if (!process.env.AVALAI_API_KEY) return { execution: fallback, source: "rules" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 16000);
  const prompt = `تو Execution Assistant هوشکس هستی. فقط یک خروجی آماده اجرا بساز. فقط JSON معتبر با کلیدهای execution_title, execution_type, artifact, usage_hint, check_in_days برگردان. execution_context داده مستقیم کاربر برای همین اقدام است و باید در متن دیده شود. ادعای تازه، ویژگی محصول یا دلیل اعتماد اختراع نکن. خروجی فارسی، کوتاه، قابل کپی و مستقیم مرتبط با current_plan باشد. acquisition=content_cta، offer=offer_copy، sales_process=sales_reply، focus=focus_plan. check_in_days بین 1 تا 7.`;
  try {
    const response = await fetch("https://api.avalai.ir/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.AVALAI_API_KEY}` },
      body: JSON.stringify({ model: process.env.AVALAI_MODEL || "gpt-4o-mini", temperature: 0.15, max_tokens: 850, messages: [{ role: "system", content: prompt }, { role: "user", content: JSON.stringify({ profile: input.profile, diagnosis_key: input.diagnosisKey, current_plan: input.currentPlan, execution_context: input.executionContext }) }] }),
      signal: controller.signal
    });
    if (!response.ok) return { execution: fallback, source: "rules-fallback" };
    const data = await response.json();
    const candidate = parseCandidate(data?.choices?.[0]?.message?.content);
    return { execution: bounded(candidate, fallback), source: validExecution(candidate) ? "avalai" : "rules-fallback" };
  } catch (error) {
    return { execution: fallback, source: "rules-fallback" };
  } finally { clearTimeout(timer); }
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const input = normalizedInput(req.body);
  if (!input.currentPlan.action.title || !input.currentPlan.priority.title) return res.status(400).json({ error: "اقدام فعالی برای آماده‌سازی پیدا نشد." });
  const fallback = makeExecution(input);
  const result = await askAvalAI(input, fallback);
  const requestId = input.sessionId || `hx-execution-${Date.now().toString(36)}`;
  console.log("[hx-execution-context]", JSON.stringify({ request_id: requestId, source: result.source, diagnosis_key: input.diagnosisKey, execution_type: result.execution.execution_type, context_fields: Object.keys(input.executionContext).length }));
  return res.status(200).json({ execution: result.execution, source: result.source, request_id: requestId });
}
