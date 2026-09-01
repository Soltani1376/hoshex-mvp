import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../api/chat.js", import.meta.url), "utf8")
  .replace("export default async function handler", "async function handler");
const context = {
  console,
  process: { env: {} },
  fetch: globalThis.fetch,
  AbortController,
  setTimeout,
  clearTimeout,
  Date,
  JSON,
  Math,
  String,
  Boolean,
  Object,
  Array,
  Promise
};
vm.createContext(context);
vm.runInContext(`${source}\nthis.handler = handler;`, context);

class ResponseMock {
  constructor() { this.code = 200; this.body = null; this.headers = {}; }
  setHeader(key, value) { this.headers[key] = value; }
  status(code) { this.code = code; return this; }
  json(body) { this.body = body; return this; }
  end() { return this; }
}

const cases = JSON.parse(fs.readFileSync(new URL("./test-cases.json", import.meta.url), "utf8"));
for (const testCase of cases) {
  const response = new ResponseMock();
  await context.handler({ method: "POST", body: { profile: testCase.profile, answers: testCase.answers } }, response);
  assert.equal(response.code, 200, testCase.id);
  assert.ok(response.body?.diagnosis, testCase.id);
  assert.equal(response.body.diagnosis.priorities.length, 1, testCase.id);
  assert.equal(response.body.diagnosis.priorities[0].rank, 1, testCase.id);
  assert.ok(response.body.diagnosis.today_action.steps.length > 0, testCase.id);
  assert.match(response.body.diagnosis.main_problem.title, new RegExp(testCase.expect.main_problem_contains), testCase.id);
  assert.match(response.body.diagnosis.today_action.title, new RegExp(testCase.expect.today_action_contains), testCase.id);
}

const invalid = new ResponseMock();
await context.handler({ method: "POST", body: { profile: { offer: "" }, answers: {} } }, invalid);
assert.equal(invalid.code, 400);

context.process.env.AVALAI_API_KEY = "test-key";
const aiPayload = {
  business_summary: "AI",
  main_problem: { title: "تست", reason: "دلیل", severity: "medium" },
  priorities: [{ rank: 1, title: "اولویت", description: "شرح" }],
  today_action: { title: "اقدام تست", steps: ["گام اول"], time_required: "۳۰ دقیقه" },
  success_metric: { metric: "یک نتیجه", period: "فردا" },
  avoid_now: "هیچ",
  next_step: "بعدی"
};
context.fetch = async () => ({
  ok: true,
  json: async () => ({ choices: [{ message: { content: "```json\\n" + JSON.stringify(aiPayload) + "\\n```" } }] })
});
const aiResponse = new ResponseMock();
await context.handler({ method: "POST", body: { profile: cases[0].profile, answers: cases[0].answers } }, aiResponse);
assert.equal(aiResponse.code, 200);
assert.equal(aiResponse.body.source, "avalai");
assert.equal(aiResponse.body.diagnosis.today_action.steps.length, 1);

console.log(`Hoshex V2 API tests passed: ${cases.length + 2}`);
