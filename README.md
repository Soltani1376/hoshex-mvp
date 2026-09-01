# Hoshex MVP V2

هوشکس یک عیب‌یاب کسب‌وکار و سازنده قدم بعدی است؛ کاربر از یک وضعیت مبهم به یک «کار امروز» مشخص می‌رسد.

## مسیر فعلی

`Landing → معرفی کوتاه کسب‌وکار → ۵ سؤال تشخیصی → Diagnosis JSON → Today Action → انجام شد؟ → قدم بعدی`

## ساختار

```text
.
├── api
│   ├── analytics.js       # ثبت موقت رویدادها در Runtime Logs
│   └── chat.js            # موتور تشخیص rule-based + اتصال اختیاری AvalAI
├── assets
│   ├── analytics.js       # hxTrack و ذخیره محلی رویدادها
│   ├── hoshex-flow.js     # state machine فرم و سؤال‌ها
│   └── hoshex-result.js   # نمایش امن و ساختاریافته نتیجه
├── tests
│   └── test-cases.json    # سناریوهای پایه V2
├── index.html
├── questions.json
└── vercel.json
```

## اجرا و تست محلی

این پروژه بدون build step اجرا می‌شود. برای مشاهده UI:

```bash
npx serve .
```

برای API در Vercel، مقدار `AVALAI_API_KEY` اختیاری است. اگر کلید موجود نباشد، موتور rule-based همچنان نتیجه قابل استفاده تولید می‌کند؛ بنابراین نسخه MVP در زمان قطعی سرویس خارجی هم متوقف نمی‌شود.

## متغیرهای محیطی

```text
AVALAI_API_KEY=...
AVALAI_MODEL=gpt-4o-mini   # اختیاری
```

کلیدها نباید در Git commit شوند.

## Analytics

`hxTrack(event, properties)` رویدادهای اصلی زیر را در `localStorage` نگه می‌دارد:

- `diagnosis_start`
- `profile_submitted`
- `question_view`
- `question_answered`
- `diagnosis_submit`
- `diagnosis_success`
- `diagnosis_fallback`
- `today_action_completed`

تا قبل از انتخاب دیتابیس، `api/analytics.js` رویدادهای بدون اطلاعات هویتی را در Runtime Logs با پیشوند `[hx-analytics]` ثبت می‌کند. برای فعال‌سازی ارسال Beacon در آینده می‌توان `window.HX_ANALYTICS_ENDPOINT` را تنظیم کرد.

## قرارداد API

درخواست `POST /api/chat`:

```json
{
  "sessionId": "hx-...",
  "profile": { "businessName": "", "offer": "" },
  "answers": {
    "sales_channel": "instagram|website|store|multi_channel",
    "main_problem": "low_conversion|no_leads|sales_process|no_focus",
    "sales_trend": "decreased|stable|growing|new",
    "current_focus": "content|ads|sales|product",
    "last_growth_action": ""
  }
}
```

پاسخ همیشه ساختار JSON دارد و فقط یک اولویت و یک کار امروز برمی‌گرداند.

## استقرار

شاخه فعال ریپوی فعلی `main` است. پس از push موفق، Vercel باید به‌صورت خودکار Preview/Production را بسازد. فایل‌های `api/*.js` به‌عنوان Serverless Function و بقیه فایل‌ها به‌صورت Static منتشر می‌شوند.
