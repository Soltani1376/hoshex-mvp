const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const followupPath = path.join(root, "api", "followup.js");
let source = fs.readFileSync(followupPath, "utf8");
source = source.replace("export default async function handler", "async function handler");
source += "\nmodule.exports = { makeFollowup, normalizedInput };\n";

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
vm.runInContext(source, sandbox, { filename: "api/followup.js" });
const { makeFollowup, normalizedInput } = sandbox.module.exports;
if (typeof makeFollowup !== "function" || typeof normalizedInput !== "function") throw new Error("follow-up brain is not testable");

const keys = ["acquisition", "offer", "sales_process", "focus"];
const outcomes = [
  ["improved", "advance"],
  ["no_result", "adjust"],
  ["not_done", "retry_smaller"]
];
let failures = 0;

for (const key of keys) {
  for (const [outcome, decision] of outcomes) {
    const input = normalizedInput({
      profile: { businessName: "تست", offer: "محصول تست" },
      diagnosisKey: key,
      cycleNumber: 2,
      currentPlan: {
        summary: "مسیر تست",
        priority: { title: "اولویت قبلی", description: "توضیح" },
        action: { title: "کار قبلی", steps: ["گام اول", "گام دوم"], time_required: "۶۰ دقیقه" },
        metric: { metric: "۵ پیام", period: "تا ۷ روز" }
      },
      feedback: { outcome, note: "مشاهده واقعی" }
    });
    const result = makeFollowup(input);
    const checks = [
      [result.decision === decision, `decision should be ${decision}`],
      [Boolean(result.priority?.title), "must return one priority"],
      [Boolean(result.priority?.reason), "priority needs a reason"],
      [Boolean(result.next_action?.title), "must return one next action"],
      [Array.isArray(result.next_action?.steps) && result.next_action.steps.length >= 1 && result.next_action.steps.length <= 4, "next action must have 1-4 steps"],
      [Boolean(result.success_metric?.metric), "must include success metric"],
      [Boolean(result.success_metric?.period), "must include metric period"],
      [Boolean(result.check_in_question), "must include next check-in question"]
    ];
    const failed = checks.filter(([ok]) => !ok).map(([, message]) => message);
    if (failed.length) {
      failures += 1;
      console.error(`FAIL ${key}/${outcome}`);
      failed.forEach((message) => console.error(`  - ${message}`));
    } else {
      console.log(`PASS ${key}/${outcome} -> ${result.decision}`);
    }
  }
}

for (const relative of ["assets/hoshex-journey.js", "assets/hoshex-journey-hook.js", "assets/analytics.js"]) {
  const code = fs.readFileSync(path.join(root, relative), "utf8");
  try {
    new Function(code);
    console.log(`PASS syntax ${relative}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL syntax ${relative}: ${error.message}`);
  }
}

const journeyCss = fs.readFileSync(path.join(root, "assets/hoshex-journey.css"), "utf8");
if (!journeyCss.includes(".hx-resume-card") || !journeyCss.includes(".hx-feedback-options")) {
  failures += 1;
  console.error("FAIL journey CSS contract");
} else {
  console.log("PASS journey CSS contract");
}

if (failures) {
  console.error(`\n${failures} follow-up/journey check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log("\nAll recurring journey checks passed.");
}
