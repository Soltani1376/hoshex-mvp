const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const chatPath = path.join(root, "api", "chat.js");
const casesPath = path.join(__dirname, "test-cases.json");

let source = fs.readFileSync(chatPath, "utf8");
source = source.replace("export default async function handler", "async function handler");
source += "\nmodule.exports = { makeDiagnosis };\n";

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
vm.runInContext(source, sandbox, { filename: "api/chat.js" });

const { makeDiagnosis } = sandbox.module.exports;
if (typeof makeDiagnosis !== "function") throw new Error("makeDiagnosis is not testable");

const cases = JSON.parse(fs.readFileSync(casesPath, "utf8"));
let failures = 0;

for (const testCase of cases) {
  const diagnosis = makeDiagnosis({ profile: testCase.profile, answers: testCase.answers });
  const problem = diagnosis?.main_problem?.title || "";
  const action = diagnosis?.today_action?.title || "";
  const priorities = Array.isArray(diagnosis?.priorities) ? diagnosis.priorities : [];

  const checks = [
    [problem.includes(testCase.expect.main_problem_contains), `main problem should contain: ${testCase.expect.main_problem_contains}`],
    [action.includes(testCase.expect.today_action_contains), `today action should contain: ${testCase.expect.today_action_contains}`],
    [priorities.length === 1 && priorities[0]?.rank === 1, "must return exactly one Priority 01"],
    [Array.isArray(diagnosis?.today_action?.steps) && diagnosis.today_action.steps.length >= 1 && diagnosis.today_action.steps.length <= 5, "today action must have 1-5 steps"],
    [Boolean(diagnosis?.success_metric?.metric), "must include a success metric"]
  ];

  const failed = checks.filter(([ok]) => !ok).map(([, message]) => message);
  if (failed.length) {
    failures += 1;
    console.error(`FAIL ${testCase.id}`);
    failed.forEach((message) => console.error(`  - ${message}`));
  } else {
    console.log(`PASS ${testCase.id}`);
  }
}

if (failures) {
  console.error(`\n${failures} V2 test case(s) failed.`);
  process.exitCode = 1;
} else {
  console.log(`\nAll ${cases.length} V2 test cases passed.`);
}
