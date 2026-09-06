import assert from 'node:assert/strict';
import { createHandler, validatePrompts } from '../api/generate-prompts.js';

const env = { CRON_SECRET: 'test-secret-not-for-production-123456789', WORDPRESS_USERNAME: 'automation', WORDPRESS_APPLICATION_PASSWORD: 'test-password', AVALAI_API_KEY: 'test-model-key' };
const prompts = ['معماری ویلای ساحلی', 'عکاسی تبلیغاتی عطر', 'پرترهٔ سینمایی هنرمند'].map((title, i) => ({
  title, prompt: `Create a cinematic professional image of subject number ${i + 1}. Use a carefully composed eye-level camera angle and an 85mm lens. Shape natural window lighting with a large softbox and subtle negative fill. Preserve authentic material texture and fine detail. Compose balanced negative space, realistic reflections, a restrained color palette and natural depth of field. Deliver premium commercial photography, 8K resolution and a 4:5 aspect ratio. Avoid lettering and watermarks.`,
  language: 'انگلیسی', sample_output: 'تصویری حرفه‌ای با نورپردازی سینمایی و جزئیات دقیق.', version: '1.0', access_type: 'رایگان'
}));
const saved = { status: 'success', count: 3, prompts, post_ids: [701, 702, 703] };
const state = { ready: true, day: '2026-09-06', previous_titles: [], batch: null };
const json = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
let passed = 0;
async function test(name, run) { await run(); passed++; console.log(`PASS ${name}`); }
async function invoke(fetchImpl, options = {}) {
  const logs = [];
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.code = n; return this; }, json(body) { this.body = body; return this; } };
  await createHandler({ env: options.env || env, fetchImpl, logger: { log(...args) { logs.push(args); }, error(...args) { logs.push(args); } } })(
    { method: options.method || 'GET', headers: { authorization: options.authorization ?? `Bearer ${env.CRON_SECRET}` } }, res);
  return { ...res, logs };
}

await test('unauthenticated callers cannot invoke AI or write WordPress', async () => {
  const r = await invoke(() => { throw Error('must not call network'); }, { authorization: '' });
  assert.equal(r.code, 401);
});
await test('missing or short cron secret fails closed', async () => {
  for (const secret of ['', 'short']) {
    const r = await invoke(() => { throw Error('must not call network'); }, { env: { ...env, CRON_SECRET: secret } });
    assert.equal(r.code, 503);
  }
});
await test('unsupported methods cannot create drafts', async () => {
  assert.equal((await invoke(() => { throw Error('network'); }, { method: 'DELETE' })).code, 405);
});
await test('full flow creates exactly three and returns verified WordPress IDs', async () => {
  const calls = [];
  const r = await invoke(async (url, options) => {
    calls.push({ url, options });
    if (url.includes('avalai')) return json({ choices: [{ message: { content: JSON.stringify({ prompts }) } }] });
    if (options.method === 'POST') {
      assert.deepEqual(JSON.parse(options.body), { day: state.day, prompts });
      return json(saved);
    }
    return json(state);
  });
  assert.equal(r.code, 200);
  assert.deepEqual(r.body.post_ids, [701, 702, 703]);
  assert.equal(r.body.count, 3);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].options.redirect, 'error');
  assert.ok(calls[0].options.signal);
  for (const secret of [env.CRON_SECRET, env.AVALAI_API_KEY, env.WORDPRESS_APPLICATION_PASSWORD]) assert.ok(!JSON.stringify(r.logs).includes(secret));
});
await test('same-day replay uses saved batch without AI or another write', async () => {
  let calls = 0;
  const r = await invoke(async (_, options) => { calls++; assert.notEqual(options.method, 'POST'); return json({ ...state, batch: saved }); });
  assert.equal(r.code, 200); assert.equal(calls, 1);
});
await test('interrupted partial run resumes the stored prompts, without regeneration', async () => {
  let calls = 0;
  const r = await invoke(async (url, options) => {
    assert.ok(!url.includes('avalai')); calls++;
    return json(options.method === 'POST' ? saved : { ...state, batch: { ...saved, status: 'partial', count: 1, post_ids: [701] } });
  });
  assert.equal(r.code, 200); assert.equal(calls, 2);
});
await test('lost save response is reconciled without duplicate creation', async () => {
  let posts = 0, reads = 0;
  const r = await invoke(async (url, options) => {
    if (url.includes('avalai')) return json({ choices: [{ message: { content: JSON.stringify({ prompts }) } }] });
    if (options.method === 'POST') { posts++; throw new Error('socket closed after commit'); }
    reads++; return json(reads === 1 ? state : { ...state, batch: saved });
  });
  assert.equal(r.code, 200); assert.equal(posts, 1); assert.equal(reads, 2);
});
await test('malformed AI response never writes placeholders to WordPress', async () => {
  let ai = 0, posts = 0;
  const r = await invoke(async (url, options) => {
    if (url.includes('avalai')) { ai++; return json({ choices: [{ message: { content: '{bad json}' } }] }); }
    if (options.method === 'POST') posts++;
    return json(state);
  });
  assert.equal(r.code, 502); assert.equal(ai, 2); assert.equal(posts, 0);
});
await test('unavailable ACF configuration prevents paid generation', async () => {
  let calls = 0;
  const r = await invoke(async () => { calls++; return json({ ...state, ready: false }); });
  assert.equal(r.code, 503); assert.equal(calls, 1);
});
await test('provider authentication failure is reported, not retried or disguised', async () => {
  let ai = 0;
  const r = await invoke(async url => {
    if (url.includes('avalai')) { ai++; return json({ error: 'private provider detail' }, 401); }
    return json(state);
  });
  assert.equal(r.code, 502); assert.equal(ai, 1); assert.ok(!JSON.stringify(r).includes('private provider detail'));
});
await test('partial WordPress save cannot be reported as success', async () => {
  const r = await invoke(async (url, options) => {
    if (url.includes('avalai')) return json({ choices: [{ message: { content: JSON.stringify({ prompts }) } }] });
    return json(options.method === 'POST' ? { ...saved, status: 'partial', count: 2, post_ids: [701, 702] } : state);
  });
  assert.equal(r.code, 502); assert.equal(r.body.status, 'error');
});
await test('invalid counts, duplicate titles and old titles are rejected', async () => {
  assert.throws(() => validatePrompts(prompts.slice(0, 2)));
  assert.throws(() => validatePrompts([prompts[0], prompts[0], prompts[2]]));
  assert.throws(() => validatePrompts(prompts, [prompts[1].title]));
  assert.throws(() => validatePrompts(prompts.map(p => ({ ...p, prompt: 'short' }))));
});
await test('model cannot change free access, version or field language', async () => {
  const result = validatePrompts(prompts.map(p => ({ ...p, access_type: 'paid', version: '2', language: 'other' })));
  assert.ok(result.every(p => p.access_type === 'رایگان' && p.version === '1.0' && p.language === 'انگلیسی'));
});
await test('credentials are not transmitted over plain HTTP', async () => {
  const r = await invoke(() => { throw Error('must not call network'); }, { env: { ...env, WORDPRESS_URL: 'http://hoshex.ir' } });
  assert.equal(r.code, 503);
});
console.log(`${passed} prompt automation tests passed.`);
