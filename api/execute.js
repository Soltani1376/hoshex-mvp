const MAX_INPUT_LENGTH = 900;
const DIAGNOSIS_KEYS = ["acquisition", "offer", "sales_process", "focus"];
const EXECUTION_TYPES = ["content_cta", "offer_copy", "sales_reply", "focus_plan"];

function setJsonHeaders(res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
}

function cleanString(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, MAX_INPUT_LENGTH);
}

function parseBody(body) {
  if (!body) return {};
  if (typeof body === "object") return body;
  if (typeof body !== "string") return {};
  try { return JSON.parse(body); } catch (error) { return {}; }
}

function normalizePlan(plan) {
  const source = plan && typeof plan === "object" ? plan : {};
  const priority = source.priority && typeof source.priority === "object" ? source.priority : {};
  const action = source.action && typeof source.action === "object" ? source.action : {};
  const metric = source.metric && typeof source.metric === "object" ? source.metric : {};
  return {
    summary: cleanString(source.summary, ""),
    priority: {
      title: cleanString(priority.title, "اولویت فعلی"),
      description: cleanString(priority.description, "")
    },
    action: {
      title: cleanString(action.title, "کار فعلی"),
      steps: Array.isArray(action.steps) ? action.steps.slice(0, 5).map((item) => cleanString(item, "")).filter(Boolean) : [],
      time_required: cleanString(action.time_required, "کمتر از یک روز")
    },
    metric: {
      metric: cleanString(metric.metric, "نتیجه قابل اندازه‌گیری"),
      period: cleanString(metric.period, "تا ۷ روز آینده")
    }
  };
}

function normalizedInput(body) {
  const profile = body.profile && typeof body.profile === "object" ? body.profile : {};
  const diagnosisKey = cleanString(body.diagnosisKey, "offer");
  return {
    sessionId: cleanString(body.sessionId, "").slice(0, 100),
    cycleNumber: Math.max(1, Math.min(99, Number(body.cycleNumber) || 1)),
    diagnosisKey: DIAGNOSIS_KEYS.includes(diagnosisKey) ? diagnosisKey : "offer",
    profile: {
      businessName: cleanString(profile.businessName, "کسب‌وکار"),
      offer: cleanString(profile.offer, "محصول یا خدمت اصلی"),
      channel: cleanString(profile.channel, "")
    },
    answers: body.answers && typeof body.answers === "object" ? body.answers : {},
    currentPlan: normalizePlan(body.currentPlan)
  };
}

function makeExecution(input) {
  const normalized = input && input.currentPlan ? input : normalizedInput(input || {});
  const key = DIAGNOSIS_KEYS.includes(normalized.diagnosisKey) ? normalized.diagnosisKey : "offer";
  const business = normalized.profile?.businessName || "کسب‌وکار";
  const offer = normalized.profile?.offer || "محصول یا خدمت اصلی";
  const action = normalized.currentPlan?.action?.title || "کار امروز";

  if (key === "acquisition") {
    return {
      execution_title: "متن جذب آماده انتشار",
      execution_type: "content_cta",
      artifact: `هوک:\nاگر هنوز برای «${offer}» مخاطب درست پیدا نمی‌کنی، احتمالاً قبل از معرفی محصول باید درد اصلی را واضح‌تر بگویی.\n\nمتن:\nدر ${business} قرار نیست فقط درباره محصول حرف بزنیم؛ اول می‌خواهیم ببینیم دقیقاً کجای مسیر برای تو سخت شده. اگر همین مسئله را داری، یک کلمه برایم بفرست تا دقیق‌تر راهنمایی‌ات کنم.\n\nCTA:\nفقط کلمه «راهنما» را دایرکت کن.`,
      usage_hint: "همین متن را با یک تصویر ساده یا ویدیوی کوتاه منتشر کن؛ CTA را تغییر نده.",
      check_in_days: 3
    };
  }

  if (key === "sales_process") {
    return {
      execution_title: "پاسخ آماده برای تردید خرید",
      execution_type: "sales_reply",
      artifact: `کاملاً حق داری قبل از تصمیم مطمئن شوی. برای «${offer}» مهم‌ترین نکته این است که ببینیم آیا واقعاً برای نیاز تو مناسب است یا نه.\n\nاگر بگویی الان اصلی‌ترین دغدغه‌ات درباره خرید چیست، دقیق و کوتاه جواب می‌دهم؛ اگر هم مناسب تو نباشد صادقانه می‌گویم.\n\nاگر آماده‌ای، فقط همان سؤال یا تردیدی که جلوی خریدت را گرفته بفرست.`,
      usage_hint: "این پاسخ را در اولین گفت‌وگوی واقعی که مشتری مردد است استفاده کن و پاسخ بعدی او را ثبت کن.",
      check_in_days: 2
    };
  }

  if (key === "focus") {
    return {
      execution_title: "برنامه اجرایی یک‌تمرکزی",
      execution_type: "focus_plan",
      artifact: `هدف این چرخه:\n${normalized.currentPlan?.priority?.title || "فقط یک اولویت را جلو ببر"}\n\nامروز:\n${action}\n\nفعلاً متوقف کن:\nهر کار جدیدی که مستقیم به همین هدف کمک نمی‌کند.\n\nتعریف انجام‌شدن:\nوقتی «${normalized.currentPlan?.metric?.metric || "معیار تعیین‌شده"}» را اندازه گرفتی، این چرخه تمام شده و قبل از شروع کار بعدی نتیجه را ثبت می‌کنی.`,
      usage_hint: "این متن را به‌عنوان برنامه همین چرخه نگه دار؛ تا ثبت نتیجه کار جدیدی به آن اضافه نکن.",
      check_in_days: 1
    };
  }

  return {
    execution_title: "پیشنهاد فروش آماده اجرا",
    execution_type: "offer_copy",
    artifact: `پیشنهاد اصلی:\n«${offer}» برای کسی است که می‌خواهد با یک مسیر روشن‌تر به نتیجه برسد، بدون اینکه بین چند انتخاب و پیام مختلف سردرگم شود.\n\nاستوری ۱:\nاگر برای رسیدن به نتیجه مدام بین چند راه مختلف می‌چرخی، احتمالاً مشکل کمبود گزینه نیست؛ پیشنهاد واضح کم داری.\n\nاستوری ۲:\nدر ${business}، «${offer}» را برای یک نتیجه مشخص و یک قدم بعدی روشن ارائه می‌کنیم.\n\nاستوری ۳ / CTA:\nاگر می‌خواهی ببینی این پیشنهاد برای تو مناسب است، کلمه «شروع» را دایرکت کن.`,
    usage_hint: "این سه بخش را پشت‌سرهم منتشر کن و فقط همین CTA را نگه دار.",
    check_in_days: 2
  };
}

function validExecution(value) {
  return Boolean(
    value && typeof value === "object" &&
    typeof value.execution_title === "string" && value.execution_title.trim() &&
    EXECUTION_TYPES.includes(value.execution_type) &&
    typeof value.artifact === "string" && value.artifact.trim() &&
    typeof value.usage_hint === "string" && value.usage_hint.trim() &&
    Number.isFinite(Number(value.check_in_days))
  );
}

function parseJsonContent(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try { return JSON.parse(trimmed); } catch (error) { return null; }
}

function boundedExecution(value, fallback) {
  if (!validExecution(value)) return fallback;
  const artifact = cleanString(value.artifact, fallback.artifact);
  const result = {
    execution_title: cleanString(value.execution_title, fallback.execution_title),
    execution_type: EXECUTION_TYPES.includes(value.execution_type) ? value.execution_type : fallback.execution_type,
    artifact: artifact.length >= 40 ? artifact : fallback.artifact,
    usage_hint: cleanString(value.usage_hint, fallback.usage_hint),
    check_in_days: Math.max(1, Math.min(7, Math.round(Number(value.check_in_days) || fallback.check_in_days)))
  };
  return result;
}

async function askAvalAI(input, fallback) {
  if (!process.env.AVALAI_API_KEY) return { execution: fallback, source: "rules" };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 16000);
  const systemPrompt = `تو Execution Assistant هوشکس هستی. کاربر قبلاً تشخیص، یک Priority و یک Today Action گرفته است. وظیفه تو آموزش یا چت نیست؛ باید همان کار را تا حد ممکن برای کاربر آماده اجرا کنی.\nفقط JSON معتبر و بدون markdown با دقیقاً این ساختار برگردان:\n{"execution_title":"","execution_type":"content_cta|offer_copy|sales_reply|focus_plan","artifact":"","usage_hint":"","check_in_days":2}\nقواعد:\n- فقط یک artifact نهایی بده؛ لیست چند خروجی یا چند انتخاب نساز.\n- artifact باید فارسی، آماده کپی/استفاده و بر اساس اطلاعات واقعی کسب‌وکار باشد.\n- acquisition: یک متن محتوای جذب با CTA واحد آماده کن.\n- offer: یک پیشنهاد فروش آماده، ترجیحاً یک مجموعه کوتاه قابل انتشار در استوری/صفحه فروش.\n- sales_process: یک پاسخ آماده برای تردید/اعتراض و ادامه گفت‌وگو بساز.\n- focus: یک برنامه کوتاه یک‌تمرکزی با تعریف انجام‌شدن بساز.\n- خروجی باید مستقیم به current_action مرتبط باشد؛ موضوع جدید نساز.\n- artifact را کوتاه و اجرایی نگه دار؛ حداکثر حدود ۹۰۰ کاراکتر.\n- check_in_days بین ۱ تا ۷ باشد و زمان معقول برای دیدن نتیجه این اقدام را نشان دهد.\n- از توصیه عمومی، مقدمه طولانی، توضیح نظری و داشبورد پرهیز کن.`;

  try {
    const response = await fetch("https://api.avalai.ir/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.AVALAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.AVALAI_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 850,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify({ profile: input.profile, answers: input.answers, diagnosis_key: input.diagnosisKey, current_plan: input.currentPlan, cycle_number: input.cycleNumber }) }
        ]
      }),
      signal: controller.signal
    });
    if (!response.ok) return { execution: fallback, source: "rules-fallback" };
    const data = await response.json();
    const candidate = parseJsonContent(data?.choices?.[0]?.message?.content);
    return { execution: boundedExecution(candidate, fallback), source: validExecution(candidate) ? "avalai" : "rules-fallback" };
  } catch (error) {
    return { execution: fallback, source: "rules-fallback" };
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  setJsonHeaders(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const input = normalizedInput(parseBody(req.body));
  if (!input.currentPlan.action.title || !input.currentPlan.priority.title) {
    return res.status(400).json({ error: "اقدام فعالی برای آماده‌سازی پیدا نشد." });
  }

  const fallback = makeExecution(input);
  const result = await askAvalAI(input, fallback);
  const requestId = input.sessionId || `hx-execution-${Date.now().toString(36)}`;
  console.log("[hx-execution]", JSON.stringify({ request_id: requestId, source: result.source, diagnosis_key: input.diagnosisKey, execution_type: result.execution.execution_type }));
  return res.status(200).json({ execution: result.execution, source: result.source, request_id: requestId });
}
