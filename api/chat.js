const MAX_INPUT_LENGTH = 700;

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

function normalizedInput(body) {
  const profile = body.profile && typeof body.profile === "object" ? body.profile : {};
  const answers = body.answers && typeof body.answers === "object" ? body.answers : {};
  return {
    sessionId: cleanString(body.sessionId, "").slice(0, 100),
    profile: {
      businessName: cleanString(profile.businessName, ""),
      offer: cleanString(profile.offer, "کسب‌وکار")
    },
    answers: {
      sales_channel: cleanString(answers.sales_channel, ""),
      main_problem: cleanString(answers.main_problem, ""),
      sales_trend: cleanString(answers.sales_trend, ""),
      current_focus: cleanString(answers.current_focus, ""),
      last_growth_action: cleanString(answers.last_growth_action, "")
    }
  };
}

function makeDiagnosis(input) {
  const { profile, answers } = input;
  const offer = profile.offer || "کسب‌وکارت";
  const channelLabel = {
    instagram: "اینستاگرام",
    website: "سایت",
    store: "مغازه",
    multi_channel: "چند کانال"
  }[answers.sales_channel] || "مسیر فروش";

  if (answers.main_problem === "no_leads" || (answers.main_problem === "" && answers.sales_trend === "new")) {
    return {
      business_summary: `${offer} در ${channelLabel} فعلاً ورودی کافی برای رشد پایدار ندارد.`,
      main_problem: {
        title: "ورودی مشتری کم است",
        reason: "تا وقتی تعداد آدم‌های مناسب که پیشنهادت را می‌بینند بالا نرود، بهینه‌سازی خرید نتیجه محدودی دارد.",
        severity: "high"
      },
      priorities: [{ rank: 1, title: "یک مسیر جذب مشخص بساز", description: "یک مخاطب و یک پیشنهاد ورودی را انتخاب کن و همان را در کانال اصلی تکرار کن." }],
      today_action: {
        title: "یک محتوای جذب مشتری با دعوت به پیام بساز",
        steps: ["یک مشکل مشخص مخاطب را انتخاب کن.", `یک راه‌حل کوتاه و مرتبط با ${offer} ارائه بده.`, "در پایان فقط یک CTA برای پیام یا ثبت سفارش بگذار."],
        time_required: "۶۰ تا ۹۰ دقیقه"
      },
      success_metric: { metric: "حداقل ۱۰ پیام یا سرنخ مرتبط", period: "تا ۷ روز آینده" },
      avoid_now: "فعلاً تبلیغ پولی را بدون یک پیشنهاد و CTA مشخص شروع نکن.",
      next_step: "محتوای جذب را با همان پیام، سه بار در هفته تکرار و مقایسه کن."
    };
  }

  if (answers.main_problem === "sales_process") {
    return {
      business_summary: `مشتری به ${offer} نزدیک می‌شود، اما در لحظه تصمیم مکث می‌کند.`,
      main_problem: {
        title: "فرآیند تبدیل مشتری ناقص است",
        reason: "بخشی از تردیدهای مشتری مثل اعتماد، قیمت یا قدم بعدی قبل از خرید پاسخ داده نمی‌شود.",
        severity: "high"
      },
      priorities: [{ rank: 1, title: "تردیدهای خرید را همان‌جا جواب بده", description: "ارزش، دلیل اعتماد و روش سفارش را در یک مسیر کوتاه و واضح کنار هم بگذار." }],
      today_action: {
        title: "پاسخ آماده برای سه اعتراض پرتکرار بنویس",
        steps: ["سه سؤال یا اعتراضی که مشتری‌ها تکرار می‌کنند جمع کن.", "برای هرکدام یک پاسخ کوتاه با مدرک یا مثال بنویس.", "پاسخ‌ها را در دایرکت، صفحه محصول یا ویترین قرار بده."],
        time_required: "۴۵ تا ۶۰ دقیقه"
      },
      success_metric: { metric: "افزایش پاسخ‌های ادامه‌دار و درخواست قیمت یا سفارش", period: "تا ۷ روز آینده" },
      avoid_now: "فعلاً تخفیف جدید نده؛ اول دلیل نخریدن را روشن کن.",
      next_step: "پاسخ‌های مؤثر را به متن ثابت فروش و محتوای بعدی تبدیل کن."
    };
  }

  if (answers.main_problem === "no_focus") {
    return {
      business_summary: `برای ${offer} چند مسیر هم‌زمان باز است و انرژی روی یک نتیجه متمرکز نمی‌شود.`,
      main_problem: {
        title: "اولویت اجرایی روشن نیست",
        reason: "پخش شدن زمان بین محتوا، تبلیغ و کارهای جانبی باعث می‌شود هیچ اقدام واحدی فرصت نتیجه دادن پیدا نکند.",
        severity: "medium"
      },
      priorities: [{ rank: 1, title: "یک نتیجه را برای این هفته انتخاب کن", description: "فقط یک عدد قابل اندازه‌گیری را هدف بگیر و بقیه کارها را موقتاً کنار بگذار." }],
      today_action: {
        title: "برنامه هفت‌روزه یک‌هدفه بنویس",
        steps: ["یک هدف عددی برای هفت روز آینده تعیین کن.", "فقط یک کانال و یک پیشنهاد را انتخاب کن.", "سه کار روزانه مرتبط با همان هدف را در تقویم بگذار."],
        time_required: "۳۰ تا ۴۵ دقیقه"
      },
      success_metric: { metric: "انجام حداقل ۵ اقدام مستقیم روی همان هدف", period: "تا ۷ روز آینده" },
      avoid_now: "فعلاً ابزار، دوره یا کمپین تازه اضافه نکن.",
      next_step: "در پایان هفته عدد هدف را بررسی کن و فقط یک اصلاح انجام بده."
    };
  }

  return {
    business_summary: `در ${channelLabel}، بازدید یا توجه به ${offer} به اندازه کافی به اقدام خرید تبدیل نمی‌شود.`,
    main_problem: {
      title: "پیشنهاد فروش به اندازه کافی واضح نیست",
      reason: "وقتی مخاطب دقیقاً نداند چه چیزی، برای چه کسی و با چه قدمی باید بخرد، توجه به فروش تبدیل نمی‌شود.",
      severity: "high"
    },
    priorities: [{ rank: 1, title: "پیشنهاد فروش را در یک جمله شفاف کن", description: "یک محصول، یک مخاطب و یک دلیل خرید را کنار یک CTA واحد قرار بده." }],
    today_action: {
      title: "یک پیشنهاد فروش یک‌جمله‌ای و سه استوری بساز",
      steps: ["یک محصول یا خدمت اصلی را انتخاب کن.", "نتیجه‌ای که برای مخاطب می‌سازد را در یک جمله بنویس.", "سه استوری منتشر کن: مشکل، پیشنهاد، دعوت به اقدام."],
      time_required: "۶۰ دقیقه"
    },
    success_metric: { metric: "حداقل ۵ پاسخ، کلیک یا درخواست خرید مرتبط", period: "تا ۴۸ ساعت آینده" },
    avoid_now: "فعلاً محصول جدید یا کانال تازه اضافه نکن.",
    next_step: "اگر پاسخ گرفتی، همین پیشنهاد را به صفحه فروش و ریلز تبدیل کن."
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
  return Boolean(
    value && typeof value === "object" &&
    value.main_problem && typeof value.main_problem.title === "string" &&
    value.today_action && typeof value.today_action.title === "string" &&
    Array.isArray(value.today_action.steps) && value.today_action.steps.length > 0 &&
    value.success_metric && typeof value.success_metric.metric === "string"
  );
}

function boundedDiagnosis(value, fallback) {
  if (!validDiagnosis(value)) return fallback;
  const result = {
    business_summary: cleanString(value.business_summary, fallback.business_summary),
    main_problem: {
      title: cleanString(value.main_problem.title, fallback.main_problem.title),
      reason: cleanString(value.main_problem.reason, fallback.main_problem.reason),
      severity: cleanString(value.main_problem.severity, fallback.main_problem.severity).toLowerCase()
    },
    priorities: [{
      rank: 1,
      title: cleanString(value.priorities?.[0]?.title, fallback.priorities[0].title),
      description: cleanString(value.priorities?.[0]?.description, fallback.priorities[0].description)
    }],
    today_action: {
      title: cleanString(value.today_action.title, fallback.today_action.title),
      steps: value.today_action.steps.slice(0, 5).map((step) => cleanString(step, "")).filter(Boolean),
      time_required: cleanString(value.today_action.time_required, fallback.today_action.time_required)
    },
    success_metric: {
      metric: cleanString(value.success_metric.metric, fallback.success_metric.metric),
      period: cleanString(value.success_metric.period, fallback.success_metric.period)
    },
    avoid_now: cleanString(value.avoid_now, fallback.avoid_now),
    next_step: cleanString(value.next_step, fallback.next_step)
  };
  return result.today_action.steps.length ? result : fallback;
}

async function askAvalAI(input, fallback) {
  if (!process.env.AVALAI_API_KEY) return { diagnosis: fallback, source: "rules" };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const systemPrompt = `تو موتور تشخیص هوشکس هستی؛ عیب‌یاب کسب‌وکار و سازنده قدم بعدی.
فقط JSON معتبر و بدون markdown برگردان، با دقیقاً همین کلیدها:
{"business_summary":"","main_problem":{"title":"","reason":"","severity":"high|medium|low"},"priorities":[{"rank":1,"title":"","description":""}],"today_action":{"title":"","steps":[""],"time_required":""},"success_metric":{"metric":"","period":""},"avoid_now":"","next_step":""}
قوانین: فقط یک مشکل اصلی و فقط یک اولویت با rank=1؛ فقط یک کار امروز؛ کار امروز کمتر از یک روز و حداکثر پنج گام؛ کوتاه، فارسی، عملی و متناسب با اطلاعات کاربر؛ آموزش عمومی و فهرست بلند ممنوع.`;
  try {
    const response = await fetch("https://api.avalai.ir/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.AVALAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.AVALAI_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 900,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify({ profile: input.profile, answers: input.answers }) }
        ]
      }),
      signal: controller.signal
    });
    if (!response.ok) return { diagnosis: fallback, source: "rules-fallback" };
    const data = await response.json();
    const candidate = parseJsonContent(data?.choices?.[0]?.message?.content);
    return { diagnosis: boundedDiagnosis(candidate, fallback), source: validDiagnosis(candidate) ? "avalai" : "rules-fallback" };
  } catch (error) {
    return { diagnosis: fallback, source: "rules-fallback" };
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  setJsonHeaders(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = parseBody(req.body);
  const input = normalizedInput(body);
  if (!input.profile.offer || Object.keys(input.answers).filter((key) => input.answers[key]).length < 5) {
    return res.status(400).json({ error: "اطلاعات بررسی کامل نیست." });
  }

  const fallback = makeDiagnosis(input);
  const result = await askAvalAI(input, fallback);
  return res.status(200).json({ diagnosis: result.diagnosis, source: result.source, request_id: input.sessionId || `hx-${Date.now().toString(36)}` });
}
