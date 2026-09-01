const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const executionPath = path.join(root, "api", "execute.js");
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
vm.runInContext(source, sandbox, { filename: "api/execute.js" });
const { makeExecution, normalizedInput, validExecution } = sandbox.module.exports;
if (typeof makeExecution !== "function" || typeof normalizedInput !== "function" || typeof validExecution !== "function") throw new Error("execution brain is not testable");

const cases = [
  ["acquisition", "content_cta"],
  ["offer", "offer_copy"],
  ["sales_process", "sales_reply"],
  ["focus", "focus_plan"]
];
let failures = 0;

for (const [key, type] of cases) {
  const input = normalizedInput({
    profile: { businessName: "فروشگاه تست", offer: "محصول تست", channel: "instagram" },
    diagnosisKey: key,
    cycleNumber: 1,
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

for (const relative of ["assets/hoshex-execution.js", "assets/analytics.js"]) {
  const code = fs.readFileSync(path.join(root, relative), "utf8");
  try {
    new Function(code);
    console.log(`PASS syntax ${relative}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL syntax ${relative}: ${error.message}`);
  }
}

const css = fs.readFileSync(path.join(root, "assets/hoshex-execution.css"), "utf8");
for (const selector of [".hx-artifact-card", ".hx-checkin-card", ".hx-result-execute", ".hx-inline-execution-status"]) {
  if (!css.includes(selector)) {
    failures += 1;
    console.error(`FAIL execution CSS contract: missing ${selector}`);
  }
}
if (!failures) console.log("PASS execution CSS contract");

const analytics = fs.readFileSync(path.join(root, "assets/analytics.js"), "utf8");
if (!analytics.includes("/assets/hoshex-execution.js") || !analytics.includes("/assets/hoshex-execution.css")) {
  failures += 1;
  console.error("FAIL execution assets are not loaded by analytics.js");
} else {
  console.log("PASS execution assets loaded");
}

if (failures) {
  console.error(`\n${failures} execution assistant check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log("\nAll execution assistant checks passed.");
}
