const MAX_INPUT_LENGTH = 700;
const DIAGNOSIS_KEYS = ["acquisition", "offer", "sales_process", "focus"];

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

function makeScoreBoard() {
  return { acquisition: 0, offer: 0, sales_process: 0, focus: 0 };
}

function addSignal(state, key, weight, evidence) {
  if (!DIAGNOSIS_KEYS.includes(key) || !Number.isFinite(weight)) return;
  state.scores[key] += weight;
  if (evidence) state.evidence.push({ key, weight, evidence });
}

function addTextSignals(state, text) {
  if (!text) return;
  const rules = [
    ["acquisition", 3.2, /هیچ\s*(بازدید|پیام|مشتری|سرنخ|لید)/i, "از اقدام قبلی ورودی قابل‌اتکا نگرفتی"],
    ["acquisition", 2.8, /(بازدید|ورودی|مشتری|سرنخ|لید).{0,14}(کم|ندار|نیامد|نمیاد|نمی‌آید)/i, "حجم ورودی یا سرنخ پایین است"],
    ["acquisition", 2.5, /(تبلیغ|ریلز|محتوا).{0,35}(پیام|سرنخ|مشتری).{0,12}(نگرف|نیا|نداد)/i, "اقدام جذب قبلی سرنخ نساخته"],
    ["acquisition", 1.5, /تازه\s*(شروع|راه)/i, "کسب‌وکار هنوز در مرحله ساخت ورودی اولیه است"],

    ["offer", 3.2, /بازدید.{0,24}(فروش|خرید).{0,14}(کم|ندار|نشد|نمی)/i, "توجه وجود دارد اما به خرید تبدیل نمی‌شود"],
    ["offer", 3.0, /پیشنهاد.{0,16}(مشخص|واضح).{0,10}(ندار|نبود|نیست)/i, "پیشنهاد فروش هنوز واضح نیست"],
    ["offer", 2.5, /کلیک.{0,24}(خرید|فروش).{0,14}(کم|نشد|نمی)/i, "کلیک به خرید تبدیل نمی‌شود"],
    ["offer", 1.4, /(cta|دعوت به اقدام)/i, "مسیر دعوت به اقدام نیاز به شفافیت دارد"],
    ["offer", 0.7, /(ریلز|محتوا|صفحه محصول)/i, "تمرکز فعلی روی لایه ارائه و پیشنهاد است"],

    ["sales_process", 3.8, /(دایرکت|مشتری|آدم|نفر).{0,40}(قیمت|سؤال|پرس).{0,40}(نمی.?خر|نخرید|خرید نمی|مردد|منصرف)/i, "مشتری تا مرحله سؤال و قیمت می‌آید اما خرید نمی‌کند"],
    ["sales_process", 2.6, /(مردد|اعتراض|اعتماد|گرونه|گران|تخفیف)/i, "تردید یا اعتراض نزدیک خرید دیده می‌شود"],
    ["sales_process", 2.4, /سبد.{0,18}(رها|ترک)/i, "بخشی از مشتری‌ها نزدیک خرید متوقف می‌شوند"],
    ["sales_process", 1.5, /قیمت\s*(می.?پرس|پرسید|پرسن)/i, "مشتری وارد گفت‌وگوی خرید می‌شود"],
    ["sales_process", 1.4, /(خرید|سفارش).{0,12}(نکرد|نمی.?کن|نشد)/i, "اصطکاک در مرحله نهایی خرید دیده می‌شود"],

    ["focus", 2.8, /هم.?زمان/i, "چند مسیر به‌صورت هم‌زمان جلو می‌رود"],
    ["focus", 2.4, /نمی.?دانم.{0,18}(تمرکز|اولویت|کدوم|کدام)/i, "اولویت اجرایی روشن نیست"],
    ["focus", 2.0, /(چند|همه).{0,24}(کار|کانال|محصول|مسیر|کمپین)/i, "انرژی بین چند مسیر تقسیم شده"],
    ["focus", 1.7, /(سایت|پیج).{0,28}(و|،).{0,28}(سایت|پیج|محصول|تبلیغ)/i, "چند کانال یا پروژه هم‌زمان فعال است"],
    ["focus", 1.2, /(محصول تازه|محصول جدید|کمپین تازه|ابزار جدید)/i, "کار جدید قبل از تثبیت مسیر قبلی اضافه شده"]
  ];

  for (const [key, weight, pattern, evidence] of rules) {
    if (pattern.test(text)) addSignal(state, key, weight, evidence);
  }
}

function analyzeSignals(input) {
  const answers = input?.answers || {};
  const state = { scores: makeScoreBoard(), evidence: [] };
  const selfMap = {
    low_conversion: "offer",
    no_leads: "acquisition",
    sales_process: "sales_process",
    no_focus: "focus"
  };
  const selfReportedKey = selfMap[answers.main_problem] || null;
  if (selfReportedKey) addSignal(state, selfReportedKey, 2.0, "برداشت خودت از مشکل فعلی");

  if (answers.sales_trend === "new") addSignal(state, "acquisition", 1.6, "کسب‌وکار تازه شروع شده");
  if (answers.sales_trend === "decreased") {
    addSignal(state, "acquisition", 0.4, "فروش در هفته‌های اخیر افت کرده");
    addSignal(state, "offer", 0.4, "فروش در هفته‌های اخیر افت کرده");
    addSignal(state, "sales_process", 0.4, "فروش در هفته‌های اخیر افت کرده");
  }

  const focusMap = { ads: "acquisition", content: "offer", sales: "sales_process", product: "focus" };
  if (focusMap[answers.current_focus]) addSignal(state, focusMap[answers.current_focus], 0.5, "جایی که الان بیشترین زمانت را می‌گیرد");

  if (answers.sales_channel === "multi_channel") addSignal(state, "focus", 0.4, "فروش از چند کانال انجام می‌شود");
  if (answers.sales_channel === "store") addSignal(state, "sales_process", 0.2, "فروش حضوری اصطکاک تصمیم خرید را مهم‌تر می‌کند");
  if (answers.sales_channel === "website") addSignal(state, "offer", 0.2, "شفافیت پیشنهاد در سایت مستقیماً روی تبدیل اثر دارد");
  if (answers.sales_channel === "instagram") addSignal(state, "offer", 0.2, "در اینستاگرام وضوح پیشنهاد و CTA نقش مستقیم دارد");

  addTextSignals(state, String(answers.last_growth_action || "").toLowerCase());

  const ranked = Object.entries(state.scores)
    .map(([key, score]) => ({ key, score: Number(score.toFixed(2)) }))
    .sort((a, b) => b.score - a.score || DIAGNOSIS_KEYS.indexOf(a.key) - DIAGNOSIS_KEYS.indexOf(b.key));
  const winner = ranked[0]?.key || selfReportedKey || "offer";
  const runnerUp = ranked[1]?.key || null;
  const gap = Number(((ranked[0]?.score || 0) - (ranked[1]?.score || 0)).toFixed(2));
  const conflictingSelfReport = Boolean(selfReportedKey && selfReportedKey !== winner && gap >= 1.2);
  const evidence = state.evidence
    .filter((item) => item.key === winner)
    .sort((a, b) => b.weight - a.weight)
    .map((item) => item.evidence)
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 3);

  return {
    winner,
    runner_up: runnerUp,
    gap,
    confidence: gap >= 2.5 ? "high" : gap >= 1 ? "medium" : "low",
    self_reported: selfReportedKey,
    conflicting_self_report: conflictingSelfReport,
    scores: ranked.reduce((acc, item) => { acc[item.key] = item.score; return acc; }, {}),
    evidence
  };
}

function evidenceReason(analysis, fallback) {
  if (!analysis?.evidence?.length) return fallback;
  const evidence = analysis.evidence.slice(0, 2).join(" و ");
  if (analysis.conflicting_self_report) {
    return `با اینکه برداشت اولیه‌ات چیز دیگری بود، نشانه‌های قوی‌تر می‌گویند ${evidence}.`;
  }
  return `${fallback} نشانه اصلی این است که ${evidence}.`;
}

function makeDiagnosis(input) {
  const { profile = {}, answers = {} } = input || {};
  const offer = profile.offer || "کسب‌وکارت";
  const channelLabel = {
    instagram: "اینستاگرام",
    website: "سایت",
    store: "مغازه",
    multi_channel: "چند کانال"
  }[answers.sales_channel] || "مسیر فروش";
  const analysis = analyzeSignals(input || {});

  if (analysis.winner === "acquisition") {
    return {
      business_summary: `${offer} در ${channelLabel} قبل از هر بهینه‌سازی دیگری به ورودی مناسب و قابل‌اندازه‌گیری بیشتری نیاز دارد.`,
      main_problem: {
        title: "ورودی مشتری کم است",
        reason: evidenceReason(analysis, "مسئله اصلی فعلاً بالای قیف است؛ هنوز آدم مناسب کافی وارد مسیر خرید نمی‌شود."),
        severity: "high"
      },
      priorities: [{ rank: 1, title: "یک مسیر جذب مشخص بساز", description: "یک مخاطب، یک پیام و یک CTA را انتخاب کن و فقط همان مسیر را اندازه بگیر." }],
      today_action: {
        title: "یک محتوای جذب مشتری با دعوت به پیام بساز",
        steps: ["یک مشکل مشخص مخاطب را انتخاب کن.", `یک راه‌حل کوتاه و مرتبط با ${offer} ارائه بده.`, "در پایان فقط یک CTA برای پیام یا ثبت سفارش بگذار."],
        time_required: "۶۰ تا ۹۰ دقیقه"
      },
      success_metric: { metric: "حداقل ۱۰ پیام یا سرنخ مرتبط", period: "تا ۷ روز آینده" },
      avoid_now: "فعلاً روی تخفیف، محصول تازه یا بهینه‌سازی جزئی صفحه فروش وقت نگذار؛ اول ورودی را قابل‌اندازه‌گیری کن.",
      next_step: "اگر ورودی ایجاد شد، کیفیت سرنخ‌ها و نرخ تبدیل همان مسیر را بررسی کن."
    };
  }

  if (analysis.winner === "sales_process") {
    return {
      business_summary: `مشتری به ${offer} نزدیک می‌شود، اما بخش مهمی از تقاضا در مرحله تصمیم نهایی از دست می‌رود.`,
      main_problem: {
        title: "فرآیند تبدیل مشتری ناقص است",
        reason: evidenceReason(analysis, "مسئله بیشتر در لحظه تصمیم خرید است تا کمبود ورودی."),
        severity: "high"
      },
      priorities: [{ rank: 1, title: "تردیدهای خرید را همان‌جا جواب بده", description: "اعتراض، دلیل اعتماد و قدم بعدی سفارش را در کوتاه‌ترین مسیر ممکن روشن کن." }],
      today_action: {
        title: "پاسخ آماده برای سه اعتراض پرتکرار بنویس",
        steps: ["سه سؤال یا اعتراضی که مشتری‌ها تکرار می‌کنند جمع کن.", "برای هرکدام یک پاسخ کوتاه با مدرک یا مثال بنویس.", "پاسخ‌ها را در دایرکت، صفحه محصول یا ویترین قرار بده."],
        time_required: "۴۵ تا ۶۰ دقیقه"
      },
      success_metric: { metric: "افزایش گفت‌وگوهایی که به درخواست سفارش یا پرداخت می‌رسند", period: "تا ۷ روز آینده" },
      avoid_now: "فعلاً صرفاً تخفیف بیشتری نده؛ اول مشخص کن مشتری دقیقاً کجا مردد می‌شود.",
      next_step: "اعتراض پرتکراری که بیشترین اثر را داشت به متن ثابت فروش تبدیل کن."
    };
  }

  if (analysis.winner === "focus") {
    return {
      business_summary: `برای ${offer} چند مسیر هم‌زمان باز است و هنوز یک هدف واحد فرصت کافی برای نتیجه‌دادن پیدا نکرده.`,
      main_problem: {
        title: "اولویت اجرایی روشن نیست",
        reason: evidenceReason(analysis, "پخش شدن زمان بین چند مسیر باعث می‌شود داده کافی برای تصمیم بعدی شکل نگیرد."),
        severity: "medium"
      },
      priorities: [{ rank: 1, title: "یک نتیجه را برای این هفته انتخاب کن", description: "فقط یک عدد قابل اندازه‌گیری را هدف بگیر و بقیه پروژه‌های غیرضروری را موقتاً متوقف کن." }],
      today_action: {
        title: "برنامه هفت‌روزه یک‌هدفه بنویس",
        steps: ["یک هدف عددی برای هفت روز آینده تعیین کن.", "فقط یک کانال و یک پیشنهاد را انتخاب کن.", "سه کار مستقیم مرتبط با همان هدف را در تقویم بگذار."],
        time_required: "۳۰ تا ۴۵ دقیقه"
      },
      success_metric: { metric: "انجام حداقل ۵ اقدام مستقیم روی همان هدف", period: "تا ۷ روز آینده" },
      avoid_now: "فعلاً ابزار، محصول، کانال یا کمپین تازه اضافه نکن.",
      next_step: "در پایان هفته فقط بر اساس عدد هدف، یک اصلاح برای هفته بعد انتخاب کن."
    };
  }

  return {
    business_summary: `در ${channelLabel}، توجه به ${offer} وجود دارد اما پیشنهاد هنوز به اندازه کافی روشن و خریدپذیر نشده است.`,
    main_problem: {
      title: "پیشنهاد فروش به اندازه کافی واضح نیست",
      reason: evidenceReason(analysis, "مسئله اصلی بین توجه مخاطب و فهم سریع ارزش پیشنهادی قرار دارد."),
      severity: "high"
    },
    priorities: [{ rank: 1, title: "پیشنهاد فروش را در یک جمله شفاف کن", description: "یک محصول، یک مخاطب، یک نتیجه و یک CTA واحد را کنار هم قرار بده." }],
    today_action: {
      title: "یک پیشنهاد فروش یک‌جمله‌ای و سه استوری بساز",
      steps: ["یک محصول یا خدمت اصلی را انتخاب کن.", "نتیجه‌ای که برای مخاطب می‌سازد را در یک جمله بنویس.", "سه استوری منتشر کن: مشکل، پیشنهاد، دعوت به اقدام."],
      time_required: "۶۰ دقیقه"
    },
    success_metric: { metric: "حداقل ۵ پاسخ، کلیک یا درخواست خرید مرتبط", period: "تا ۴۸ ساعت آینده" },
    avoid_now: "فعلاً محصول یا کانال تازه اضافه نکن؛ اول همین پیشنهاد را قابل‌فهم و قابل‌اندازه‌گیری کن.",
    next_step: "اگر پاسخ گرفتی، همین پیشنهاد را به صفحه فروش و یک ریلز کوتاه تبدیل کن."
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
  const allowedSeverity = ["high", "medium", "low"];
  const severity = cleanString(value.main_problem.severity, fallback.main_problem.severity).toLowerCase();
  const result = {
    business_summary: cleanString(value.business_summary, fallback.business_summary),
    main_problem: {
      title: cleanString(value.main_problem.title, fallback.main_problem.title),
      reason: cleanString(value.main_problem.reason, fallback.main_problem.reason),
      severity: allowedSeverity.includes(severity) ? severity : fallback.main_problem.severity
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

async function askAvalAI(input, fallback, signalAnalysis) {
  if (!process.env.AVALAI_API_KEY) return { diagnosis: fallback, source: "rules" };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const systemPrompt = `تو موتور تشخیص هوشکس هستی؛ عیب‌یاب کسب‌وکار و سازنده قدم بعدی.
فقط JSON معتبر و بدون markdown برگردان، با دقیقاً همین کلیدها:
{"business_summary":"","main_problem":{"title":"","reason":"","severity":"high|medium|low"},"priorities":[{"rank":1,"title":"","description":""}],"today_action":{"title":"","steps":[""],"time_required":""},"success_metric":{"metric":"","period":""},"avoid_now":"","next_step":""}
قواعد تشخیص:
- جواب main_problem فقط برداشت اولیه کاربر است؛ آن را کورکورانه تکرار نکن.
- sales_trend، current_focus و last_growth_action را شواهد مستقل در نظر بگیر.
- signal_analysis یک فرضیه وزن‌دار از چند سیگنال است. اگر conflicting_self_report=true بود، تضاد را حل کن و تشخیص قوی‌تر را انتخاب کن.
- در reason تا حد ممکن به حداقل دو مشاهده واقعی از داده کاربر تکیه کن، نه جمله‌های عمومی.
- فقط یک مشکل اصلی، فقط یک Priority 01 و فقط یک کار امروز.
- کار امروز کمتر از یک روز، حداکثر پنج گام، فارسی، کوتاه و قابل‌اندازه‌گیری باشد.
- آموزش عمومی، فهرست بلند، چند اولویت و توصیه مبهم ممنوع.`;
  try {
    const response = await fetch("https://api.avalai.ir/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.AVALAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.AVALAI_MODEL || "gpt-4o-mini",
        temperature: 0.15,
        max_tokens: 900,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify({ profile: input.profile, answers: input.answers, signal_analysis: signalAnalysis }) }
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

  const signalAnalysis = analyzeSignals(input);
  const fallback = makeDiagnosis(input);
  const result = await askAvalAI(input, fallback, signalAnalysis);
  const requestId = input.sessionId || `hx-${Date.now().toString(36)}`;
  const meta = {
    rules_hypothesis: signalAnalysis.winner,
    confidence: signalAnalysis.confidence,
    score_gap: signalAnalysis.gap,
    conflicting_self_report: signalAnalysis.conflicting_self_report
  };
  console.log("[hx-diagnosis]", JSON.stringify({ request_id: requestId, source: result.source, ...meta }));
  return res.status(200).json({ diagnosis: result.diagnosis, source: result.source, request_id: requestId, meta });
}
