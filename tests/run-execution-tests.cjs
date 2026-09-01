const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const executionPath = path.join(root, "api", "execute-context.js");
let source = fs.readFileSync(executionPath, "utf8");
source = source.replace("export default async function handler", "async function handler");
source += "\nmodule.exports = { makeExecution, normalizedInput, validExecution };\n";

const sandbox = {
  module: { exports: {} },
  exports: {},
  console,
  process: { env: {} },
  fetch: async () => { throw new Error("network disabled in deterministic tests"); },
  AbortController,
  setTimeout,
  clearTimeout
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: "api/execute-context.js" });
const { makeExecution, normalizedInput, validExecution } = sandbox.module.exports;
if (typeof makeExecution !== "function" || typeof normalizedInput !== "function" || typeof validExecution !== "function") throw new Error("execution brain is not testable");

const cases = [
  ["acquisition", "content_cta", { pain: "پیدا کردن هدیه خاص سخت است", cta: "dm" }, "هدیه خاص"],
  ["offer", "offer_copy", { subject: "کیف چرمی مدل X", audience: "خانم‌های شاغل که کیف سبک می‌خواهند", cta: "website" }, "کیف چرمی مدل X"],
  ["sales_process", "sales_reply", { objection: "مطمئن نیست کیفیت خوب باشد", proof: "هفت روز امکان مرجوعی داریم" }, "هفت روز امکان مرجوعی"],
  ["focus", "focus_plan", { outcome: "۵ سفارش واقعی", available_time: "60" }, "۵ سفارش واقعی"]
];
let failures = 0;

for (const [key, type, executionContext, expectedText] of cases) {
  const input = normalizedInput({
    profile: { businessName: "فروشگاه تست", offer: "محصول تست" },
    diagnosisKey: key,
    cycleNumber: 1,
    executionContext,
    currentPlan: {
      summary: "خلاصه مسیر",
      priority: { title: "اولویت تست", description: "توضیح تست" },
      action: { title: "کار امروز تست", steps: ["گام اول", "گام دوم"], time_required: "۶۰ دقیقه" },
      metric: { metric: "۵ پیام مرتبط", period: "تا ۳ روز" }
    }
  });
  const result = makeExecution(input);
  const checks = [
    [validExecution(result), "must match execution contract"],
    [result.execution_type === type, `execution type should be ${type}`],
    [Boolean(result.execution_title), "must include title"],
    [typeof result.artifact === "string" && result.artifact.length >= 80, "artifact must be copy-ready and substantive"],
    [result.artifact.includes(expectedText), "artifact must use the user's execution context"],
    [Boolean(result.usage_hint), "must include usage hint"],
    [Number(result.check_in_days) >= 1 && Number(result.check_in_days) <= 7, "check-in must be 1-7 days"],
    [!Array.isArray(result.artifact), "must return one artifact, not a list"]
  ];
  const failed = checks.filter(([ok]) => !ok).map(([, message]) => message);
  if (failed.length) {
    failures += 1;
    console.error(`FAIL ${key}`);
    failed.forEach((message) => console.error(`  - ${message}`));
  } else {
    console.log(`PASS ${key} -> ${result.execution_type}`);
  }
}

for (const relative of ["assets/hoshex-execution.js", "assets/hoshex-completion.js", "assets/hoshex-result.js", "assets/hoshex-journey-hook.js", "assets/analytics.js"]) {
  const code = fs.readFileSync(path.join(root, relative), "utf8");
  try {
    new Function(code);
    console.log(`PASS syntax ${relative}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL syntax ${relative}: ${error.message}`);
  }
}

const executionCss = fs.readFileSync(path.join(root, "assets/hoshex-execution.css"), "utf8");
for (const selector of [".hx-artifact-card", ".hx-checkin-card", ".hx-inline-execution-status"]) {
  if (!executionCss.includes(selector)) {
    failures += 1;
    console.error(`FAIL execution CSS contract: missing ${selector}`);
  }
}
if (!failures) console.log("PASS execution CSS contract");

const completionCss = fs.readFileSync(path.join(root, "assets/hoshex-completion.css"), "utf8");
for (const selector of [".hx-decision-shell", ".hx-execution-context-step", ".hx-active-home", ".hx-business-snapshot", ".hx-path-progress"]) {
  if (!completionCss.includes(selector)) {
    failures += 1;
    console.error(`FAIL completion CSS contract: missing ${selector}`);
  }
}

const analytics = fs.readFileSync(path.join(root, "assets/analytics.js"), "utf8");
for (const asset of ["/assets/hoshex-execution.js", "/assets/hoshex-execution.css", "/assets/hoshex-completion.js", "/assets/hoshex-completion.css"]) {
  if (!analytics.includes(asset)) {
    failures += 1;
    console.error(`FAIL analytics loader missing ${asset}`);
  }
}

const result = fs.readFileSync(path.join(root, "assets/hoshex-result.js"), "utf8");
const primaryCards = ["hx-decision-diagnosis", "hx-decision-priority", "hx-decision-action"];
for (const card of primaryCards) {
  if (!result.includes(card)) {
    failures += 1;
    console.error(`FAIL simplified result missing ${card}`);
  }
}
if (result.includes("hx-card-index\">۴") || result.includes("hx-card-index\">۵") || result.includes("hx-card-index\">۶")) {
  failures += 1;
  console.error("FAIL result still exposes the old six-card hierarchy");
}

if (failures) {
  console.error(`\n${failures} completion/execution check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log("\nAll completion and context-aware execution checks passed.");
}
