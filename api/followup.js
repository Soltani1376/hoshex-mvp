const MAX_INPUT_LENGTH = 700;
const DIAGNOSIS_KEYS = ["acquisition", "offer", "sales_process", "focus"];
const OUTCOMES = ["improved", "no_result", "not_done"];

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
      title: cleanString(action.title, "اقدام فعلی"),
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
  const feedback = body.feedback && typeof body.feedback === "object" ? body.feedback : {};
  const diagnosisKey = cleanString(body.diagnosisKey, "offer");
  const outcome = cleanString(feedback.outcome, "not_done");
  return {
    sessionId: cleanString(body.sessionId, "").slice(0, 100),
    cycleNumber: Math.max(1, Math.min(99, Number(body.cycleNumber) || 1)),
    profile: {
      businessName: cleanString(profile.businessName, ""),
      offer: cleanString(profile.offer, "کسب‌وکار")
    },
    diagnosisKey: DIAGNOSIS_KEYS.includes(diagnosisKey) ? diagnosisKey : "offer",
    currentPlan: normalizePlan(body.currentPlan),
    feedback: {
      outcome: OUTCOMES.includes(outcome) ? outcome : "not_done",
      note: cleanString(feedback.note, "")
    }
  };
}

const PLAYBOOKS = {
  acquisition: {
    improved: {
      priority: "مسیر جذب جواب‌داده را تثبیت کن",
      reason: "ورودی بهتر شده؛ الان باید همان پیام و CTA را تکرار کنیم تا بفهمیم نتیجه قابل تکرار است یا تصادفی.",
      action: "بهترین محتوای جذب را با همان CTA یک بار دیگر اجرا کن",
      steps: ["همان موضوعی که بیشترین پیام یا سرنخ آورد نگه دار.", "فقط هوک یا مثال را تازه کن و CTA را تغییر نده.", "تعداد پیام یا سرنخ این اجرای دوم را با قبلی مقایسه کن."],
      metric: "تکرار حداقل ۷۰٪ نتیجه اجرای قبلی",
      period: "تا ۷ روز آینده",
      avoid: "فعلاً کانال جذب تازه یا تبلیغ پیچیده اضافه نکن."
    },
    no_result: {
      priority: "کیفیت پیام جذب را اصلاح کن",
      reason: "اقدام انجام شده اما ورودی حرکت نکرده؛ قبل از افزایش حجم باید پیام یا مخاطب هدف را دقیق‌تر کنیم.",
      action: "یک نسخه تازه از محتوای جذب برای یک درد مشخص‌تر بساز",
      steps: ["یک مشکل خیلی مشخص‌تر از مخاطب انتخاب کن.", "در خط اول همان مشکل را مستقیم نام ببر.", "یک CTA واحد برای پیام با یک کلمه مشخص بگذار."],
      metric: "حداقل ۵ پیام یا سرنخ مرتبط",
      period: "تا ۷ روز آینده",
      avoid: "فعلاً بودجه تبلیغ را بالا نبر."
    },
    not_done: {
      priority: "اقدام جذب را کوچک‌تر کن",
      reason: "تا وقتی اجرا نشده، مشکل را عوض نمی‌کنیم؛ فقط اصطکاک اجرای کار را کم می‌کنیم.",
      action: "یک استوری جذب تک‌اسلایدی با CTA بساز",
      steps: ["یک درد مخاطب را در یک جمله بنویس.", "یک پاسخ کوتاه بده.", "در پایان دعوت کن یک کلمه مشخص دایرکت کند."],
      metric: "انتشار همان یک استوری",
      period: "امروز",
      avoid: "فعلاً برای نسخه کامل یا بی‌نقص وقت نگذار."
    }
  },
  offer: {
    improved: {
      priority: "پیشنهاد برنده را در نقاط فروش تکرار کن",
      reason: "پیشنهاد جدید واکنش بهتری گرفته؛ حالا باید همان پیام را در یک نقطه فروش دیگر تثبیت کنیم.",
      action: "همان پیشنهاد را به صفحه فروش یا یک ریلز کوتاه منتقل کن",
      steps: ["جمله اصلی پیشنهاد را بدون تغییر نگه دار.", "یک دلیل اعتماد یا شاهد واقعی اضافه کن.", "همان CTA را در انتها تکرار کن."],
      metric: "حداقل ۵ تعامل خریدمحور دیگر",
      period: "تا ۷ روز آینده",
      avoid: "فعلاً پیشنهاد دوم یا تخفیف جدید نساز."
    },
    no_result: {
      priority: "دلیل خرید را واضح‌تر کن",
      reason: "پیشنهاد بازنویسی شده اما رفتار خرید تغییر نکرده؛ باید ارزش پیشنهادی را مشخص‌تر کنیم، نه اینکه فقط متن را زیباتر کنیم.",
      action: "پیشنهاد را با یک نتیجه مشخص و یک دلیل اعتماد بازنویسی کن",
      steps: ["بگو این محصول یا خدمت دقیقاً چه نتیجه‌ای می‌دهد.", "یک دلیل اعتماد واقعی اضافه کن: نمونه، تجربه، ضمانت یا مدرک.", "فقط یک CTA برای قدم بعدی بگذار."],
      metric: "حداقل ۳ درخواست قیمت، کلیک یا سفارش مرتبط",
      period: "تا ۷ روز آینده",
      avoid: "فعلاً طراحی یا قالب محتوا را عوض نکن؛ پیام را تست کن."
    },
    not_done: {
      priority: "پیشنهاد را در یک جمله ببند",
      reason: "هنوز داده جدید نداریم؛ پس به‌جای تغییر مسیر، کار را به کوچک‌ترین نسخه قابل اجرا تبدیل می‌کنیم.",
      action: "فقط یک جمله پیشنهاد فروش بنویس و منتشر کن",
      steps: ["یک محصول یا خدمت را انتخاب کن.", "نتیجه اصلی برای مخاطب را در یک جمله بنویس.", "یک CTA کوتاه به همان جمله اضافه کن."],
      metric: "انتشار یک پیشنهاد یک‌جمله‌ای",
      period: "امروز",
      avoid: "فعلاً سه استوری یا کمپین کامل نساز."
    }
  },
  sales_process: {
    improved: {
      priority: "پاسخ مؤثر را به فرآیند ثابت فروش تبدیل کن",
      reason: "کاهش تردید مشتری جواب داده؛ الان باید این پاسخ از حالت اتفاقی به بخشی از فرآیند ثابت فروش تبدیل شود.",
      action: "بهترین پاسخ اعتراض را در متن ثابت فروش قرار بده",
      steps: ["پاسخی که بیشترین ادامه گفتگو ایجاد کرد انتخاب کن.", "آن را کوتاه و قابل کپی کن.", "در دایرکت، صفحه محصول یا پاسخ آماده قرار بده."],
      metric: "استفاده از پاسخ ثابت در حداقل ۵ گفت‌وگوی خرید",
      period: "تا ۷ روز آینده",
      avoid: "فعلاً تخفیف تازه اضافه نکن."
    },
    no_result: {
      priority: "اعتراض اصلی را دقیق‌تر پیدا کن",
      reason: "پاسخ‌های فعلی خرید را جلو نبرده‌اند؛ احتمالاً اعتراض واقعی مشتری چیز دیگری است یا مدرک کافی ندارد.",
      action: "سه گفت‌وگوی ناموفق اخیر را مرور و نقطه توقف را استخراج کن",
      steps: ["سه دایرکت یا گفت‌وگوی واقعی را انتخاب کن.", "آخرین جمله قبل از قطع شدن خرید را یادداشت کن.", "یک الگوی مشترک بین آن‌ها پیدا و برای همان یک پاسخ تازه بنویس."],
      metric: "شناسایی یک اعتراض پرتکرار واقعی",
      period: "تا ۳ روز آینده",
      avoid: "فعلاً همه متن‌های فروش را یک‌جا بازنویسی نکن."
    },
    not_done: {
      priority: "فقط یک اعتراض را جواب بده",
      reason: "کار قبلی هنوز اجرا نشده؛ برای گرفتن داده کافی است از یک اعتراض واقعی شروع کنیم.",
      action: "برای پرتکرارترین سؤال مشتری یک پاسخ آماده بنویس",
      steps: ["فقط یک سؤال پرتکرار انتخاب کن.", "در سه جمله پاسخ بده: جواب، دلیل، قدم بعدی.", "همان پاسخ را در اولین گفت‌وگوی مرتبط استفاده کن."],
      metric: "استفاده واقعی از پاسخ در یک گفت‌وگو",
      period: "امروز",
      avoid: "فعلاً بانک کامل پاسخ‌ها نساز."
    }
  },
  focus: {
    improved: {
      priority: "همان تمرکز را یک چرخه دیگر حفظ کن",
      reason: "تمرکز روی یک هدف نتیجه داده؛ ارزش اصلی الان در ادامه‌دادن است، نه اضافه‌کردن پروژه تازه.",
      action: "همان هدف را برای هفت روز بعد با یک اصلاح کوچک ادامه بده",
      steps: ["همان شاخص اصلی را نگه دار.", "یک کاری که نتیجه کم‌تری داشت حذف کن.", "بیشترین زمان را روی کاری بگذار که مستقیم به همان شاخص کمک می‌کند."],
      metric: "حداقل ۵ اقدام مستقیم روی همان هدف",
      period: "تا ۷ روز آینده",
      avoid: "فعلاً هدف دوم یا کانال جدید اضافه نکن."
    },
    no_result: {
      priority: "هدف هفتگی را قابل‌اندازه‌گیری‌تر کن",
      reason: "تمرکز ایجاد شده اما نتیجه روشن نیست؛ باید هدف را آن‌قدر مشخص کنیم که بتوانیم موفق یا ناموفق بودنش را بفهمیم.",
      action: "هدف این هفته را به یک عدد و سه اقدام مستقیم تبدیل کن",
      steps: ["یک عدد نتیجه انتخاب کن: پیام، سفارش، تماس یا لید.", "سه اقدام مستقیم برای همان عدد بنویس.", "هر کار غیرمرتبط را برای هفت روز متوقف کن."],
      metric: "ثبت روزانه همان یک عدد",
      period: "تا ۷ روز آینده",
      avoid: "فعلاً ابزار مدیریت یا برنامه جدید اضافه نکن."
    },
    not_done: {
      priority: "فقط کار امروز را مشخص کن",
      reason: "برنامه هفت‌روزه هنوز اجرا نشده؛ پس دامنه را از یک هفته به امروز کم می‌کنیم.",
      action: "یک هدف برای امروز و فقط یک کار مرتبط انتخاب کن",
      steps: ["یک نتیجه قابل اندازه‌گیری برای امروز بنویس.", "یک کار که مستقیم به همان نتیجه کمک می‌کند انتخاب کن.", "تا انجامش هیچ کار رشد دیگری شروع نکن."],
      metric: "انجام همان یک کار",
      period: "امروز",
      avoid: "فعلاً برنامه کامل هفته را نساز."
    }
  }
};

function makeFollowup(input) {
  const normalized = input && input.currentPlan ? input : normalizedInput(input || {});
  const key = DIAGNOSIS_KEYS.includes(normalized.diagnosisKey) ? normalized.diagnosisKey : "offer";
  const outcome = OUTCOMES.includes(normalized.feedback?.outcome) ? normalized.feedback.outcome : "not_done";
  const play = PLAYBOOKS[key][outcome];
  const label = outcome === "improved" ? "نتیجه مثبت ثبت شد" : outcome === "no_result" ? "اجرا شد اما نتیجه کافی نبود" : "کار قبلی هنوز اجرا نشده";
  return {
    feedback_summary: normalized.feedback?.note ? `${label}. نکته‌ای که ثبت کردی: ${normalized.feedback.note}` : `${label}.`,
    decision: outcome === "improved" ? "advance" : outcome === "no_result" ? "adjust" : "retry_smaller",
    priority: { title: play.priority, reason: play.reason },
    next_action: { title: play.action, steps: play.steps.slice(0, 4), time_required: outcome === "not_done" ? "۲۰ تا ۳۰ دقیقه" : "۴۵ تا ۹۰ دقیقه" },
    success_metric: { metric: play.metric, period: play.period },
    avoid_now: play.avoid,
    check_in_question: outcome === "improved" ? "این نتیجه در اجرای بعدی هم تکرار شد؟" : outcome === "no_result" ? "بعد از این اصلاح، کدام عدد حرکت کرد؟" : "این نسخه کوچک را انجام دادی؟"
  };
}

function validFollowup(value) {
  return Boolean(
    value && typeof value === "object" &&
    typeof value.feedback_summary === "string" &&
    ["advance", "adjust", "retry_smaller"].includes(value.decision) &&
    value.priority && typeof value.priority.title === "string" && typeof value.priority.reason === "string" &&
    value.next_action && typeof value.next_action.title === "string" && Array.isArray(value.next_action.steps) && value.next_action.steps.length &&
    value.success_metric && typeof value.success_metric.metric === "string"
  );
}

function parseJsonContent(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try { return JSON.parse(trimmed); } catch (error) { return null; }
}

function boundedFollowup(value, fallback) {
  if (!validFollowup(value)) return fallback;
  const decision = ["advance", "adjust", "retry_smaller"].includes(value.decision) ? value.decision : fallback.decision;
  const result = {
    feedback_summary: cleanString(value.feedback_summary, fallback.feedback_summary),
    decision,
    priority: {
      title: cleanString(value.priority.title, fallback.priority.title),
      reason: cleanString(value.priority.reason, fallback.priority.reason)
    },
    next_action: {
      title: cleanString(value.next_action.title, fallback.next_action.title),
      steps: value.next_action.steps.slice(0, 4).map((step) => cleanString(step, "")).filter(Boolean),
      time_required: cleanString(value.next_action.time_required, fallback.next_action.time_required)
    },
    success_metric: {
      metric: cleanString(value.success_metric.metric, fallback.success_metric.metric),
      period: cleanString(value.success_metric.period, fallback.success_metric.period)
    },
    avoid_now: cleanString(value.avoid_now, fallback.avoid_now),
    check_in_question: cleanString(value.check_in_question, fallback.check_in_question)
  };
  return result.next_action.steps.length ? result : fallback;
}

async function askAvalAI(input, fallback) {
  if (!process.env.AVALAI_API_KEY) return { followup: fallback, source: "rules" };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const systemPrompt = `تو موتور پیگیری هوشکس هستی. کاربر قبلاً یک Priority و Today Action گرفته و حالا نتیجه را گزارش کرده است.
فقط JSON معتبر و بدون markdown برگردان با دقیقاً این ساختار:
{"feedback_summary":"","decision":"advance|adjust|retry_smaller","priority":{"title":"","reason":""},"next_action":{"title":"","steps":[""],"time_required":""},"success_metric":{"metric":"","period":""},"avoid_now":"","check_in_question":""}
قواعد:
- این یک تشخیص از صفر نیست؛ ادامه همان مسیر است.
- اگر outcome=improved بود، کار جواب‌داده را تثبیت یا یک مرحله جلو ببر.
- اگر outcome=no_result بود، همان فرضیه را با یک اصلاح مشخص تست کن؛ مستقیم به مشکل کاملاً جدید نپر مگر شواهد قوی وجود داشته باشد.
- اگر outcome=not_done بود، کار را کوچک‌تر و آسان‌تر کن؛ کاربر را سرزنش نکن.
- فقط یک اولویت و یک اقدام بعدی بده.
- اقدام کمتر از یک روز و حداکثر ۴ گام باشد.
- از برنامه‌های بلند، داشبورد، آموزش عمومی و لیست چنداولویتی پرهیز کن.`;
  try {
    const response = await fetch("https://api.avalai.ir/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.AVALAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.AVALAI_MODEL || "gpt-4o-mini",
        temperature: 0.15,
        max_tokens: 750,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify({ profile: input.profile, diagnosis_key: input.diagnosisKey, current_plan: input.currentPlan, feedback: input.feedback, cycle_number: input.cycleNumber }) }
        ]
      }),
      signal: controller.signal
    });
    if (!response.ok) return { followup: fallback, source: "rules-fallback" };
    const data = await response.json();
    const candidate = parseJsonContent(data?.choices?.[0]?.message?.content);
    return { followup: boundedFollowup(candidate, fallback), source: validFollowup(candidate) ? "avalai" : "rules-fallback" };
  } catch (error) {
    return { followup: fallback, source: "rules-fallback" };
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
    return res.status(400).json({ error: "مسیر قبلی برای پیگیری پیدا نشد." });
  }

  const fallback = makeFollowup(input);
  const result = await askAvalAI(input, fallback);
  const requestId = input.sessionId || `hx-followup-${Date.now().toString(36)}`;
  console.log("[hx-followup]", JSON.stringify({ request_id: requestId, source: result.source, diagnosis_key: input.diagnosisKey, outcome: input.feedback.outcome, decision: result.followup.decision }));
  return res.status(200).json({ followup: result.followup, source: result.source, request_id: requestId });
}
