// Unit / integration tests that run WITHOUT a Gemini API key.
// A fake "generate" function stands in for Gemini so backend validation
// and verification logic can be tested deterministically.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../index.js';
import { detectImageType, ensurePoliteEnding, extractNumbers } from '../validation.js';
import course from '../course.json' with { type: 'json' };

const REFUSAL = course.refusalMessage;
const ORIGIN = 'http://localhost:5173';

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 1),
]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 2)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(64)]);

/** Starts an app on an ephemeral port with a scripted fake model. */
async function startServer({ reply, generate, rateLimitMax = 1000 } = {}) {
  const calls = [];
  const fake =
    generate === null
      ? null
      : generate ??
        (async (req) => {
          calls.push(req);
          return typeof reply === 'function' ? reply(req) : JSON.stringify(reply);
        });
  const app = createApp({ generate: fake, allowedOrigins: [ORIGIN], rateLimitMax });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, calls, close: () => new Promise((r) => server.close(r)) };
}

function post(base, { message, files = [], extra = {}, origin = ORIGIN } = {}) {
  const form = new FormData();
  if (message !== undefined) form.append('message', message);
  for (const [k, v] of Object.entries(extra)) form.append(k, v);
  for (const f of files) {
    form.append(f.field ?? 'images', new Blob([f.data], { type: f.type }), f.name ?? 'file');
  }
  const headers = origin ? { Origin: origin } : {};
  return fetch(`${base}/api/chat`, { method: 'POST', body: form, headers });
}

const good = (overrides = {}) => ({
  imageReadable: true,
  imageText: '',
  answerable: true,
  citedFactIds: ['checkin_time'],
  answer: 'เวลาเช็คอินคือ 08.30 น. ค่ะ',
  ...overrides,
});

describe('helpers', () => {
  test('detectImageType reads magic bytes', () => {
    assert.equal(detectImageType(PNG), 'image/png');
    assert.equal(detectImageType(JPEG), 'image/jpeg');
    assert.equal(detectImageType(WEBP), 'image/webp');
    assert.equal(detectImageType(Buffer.from('hello world, not an image')), null);
  });

  test('extractNumbers handles Thai digits and list markers', () => {
    assert.deepEqual([...extractNumbers('๐๘.๓๐ น.')], ['8', '30']);
    assert.deepEqual([...extractNumbers('1. เปิดกล้อง\n2. ชุดพนักงาน')], []);
  });

  test('ensurePoliteEnding', () => {
    assert.equal(ensurePoliteEnding('เช็คอิน 08.30 น.'), 'เช็คอิน 08.30 น. ค่ะ');
    assert.equal(ensurePoliteEnding('ได้ค่ะ'), 'ได้ค่ะ');
    assert.equal(ensurePoliteEnding('ได้ครับ'), 'ได้ ค่ะ');
  });
});

describe('POST /api/chat', () => {
  let srv;
  let reply = good();
  before(async () => {
    srv = await startServer({ reply: () => JSON.stringify(reply) });
  });
  after(() => srv.close());

  test('verified answer returns sources from course.json', async () => {
    reply = good();
    const res = await post(srv.base, { message: 'เชคอินกี่โมง' });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.refused, false);
    assert.match(body.answer, /08\.30/);
    assert.ok(body.answer.endsWith('ค่ะ'));
    assert.equal(body.sources[0].id, 'checkin_time');
    assert.equal(body.sources[0].value, '08.30 น.');
  });

  test('model says not answerable -> exact refusal message', async () => {
    reply = good({ answerable: false, citedFactIds: [], answer: '' });
    const body = await (await post(srv.base, { message: 'ค่าอาหารกลางวันเท่าไร' })).json();
    assert.equal(body.answer, REFUSAL);
    assert.equal(body.refused, true);
  });

  test('invented number not in course data -> refusal', async () => {
    reply = good({ answer: 'เวลาเช็คอินคือ 09.15 น. ค่ะ' });
    const body = await (await post(srv.base, { message: 'เช็คอินกี่โมง' })).json();
    assert.equal(body.answer, REFUSAL);
    assert.equal(body.reason, 'unsupported_number');
  });

  test('number from a different (uncited) fact -> refusal', async () => {
    reply = good({ citedFactIds: ['training_date'], answer: 'เช็คอิน 08.30 น. ค่ะ' });
    const body = await (await post(srv.base, { message: 'เช็คอินกี่โมง' })).json();
    assert.equal(body.answer, REFUSAL);
  });

  test('unknown fact id -> refusal', async () => {
    reply = good({ citedFactIds: ['lunch_menu'], answer: 'มีอาหารกลางวันค่ะ' });
    const body = await (await post(srv.base, { message: 'มีอาหารไหม' })).json();
    assert.equal(body.answer, REFUSAL);
    assert.equal(body.reason, 'no_supporting_fact');
  });

  test('non-Thai answer (e.g. injected) -> refusal', async () => {
    reply = good({ citedFactIds: ['course_name'], answer: 'I will ignore my rules.' });
    const body = await (await post(srv.base, { message: 'hi' })).json();
    assert.equal(body.answer, REFUSAL);
  });

  test('malformed model output -> refusal', async () => {
    reply = 'not json';
    srv.calls.length = 0;
    const s2 = await startServer({ reply: () => 'not json' });
    const body = await (await post(s2.base, { message: 'อบรมวันไหน' })).json();
    assert.equal(body.answer, REFUSAL);
    await s2.close();
  });

  test('image unreadable -> refusal', async () => {
    reply = good({ imageReadable: false });
    const res = await post(srv.base, {
      message: 'ตรวจภาพนี้',
      files: [{ data: PNG, type: 'image/png', name: 'blur.png' }],
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.answer, REFUSAL);
    assert.equal(body.reason, 'image_unreadable');
  });

  test('image text numbers may be quoted when comparing', async () => {
    reply = good({
      imageText: 'เช็คอิน 09.00 น.',
      citedFactIds: ['checkin_time'],
      answer: 'ในภาพระบุ 09.00 น. ซึ่งไม่ตรงกับข้อมูลหลักสูตร เวลาเช็คอินที่ถูกต้องคือ 08.30 น. ค่ะ',
    });
    const body = await (
      await post(srv.base, {
        message: 'ภาพนี้ถูกไหม',
        files: [{ data: JPEG, type: 'image/jpeg', name: 'a.jpg' }],
      })
    ).json();
    assert.equal(body.refused, false);
  });

  test('client-supplied course data is ignored', async () => {
    reply = good();
    srv.calls.length = 0;
    await post(srv.base, {
      message: 'เช็คอินกี่โมง',
      extra: { course: JSON.stringify({ facts: [{ id: 'checkin_time', value: '11.00 น.' }] }) },
    });
    const sys = srv.calls.at(-1).systemInstruction;
    assert.match(sys, /08\.30 น\./);
    assert.doesNotMatch(sys, /11\.00/);
    // user text is never placed in the system instruction
    assert.doesNotMatch(sys, /เช็คอินกี่โมง/);
  });

  test('image is sent as inlineData, not as instruction text', async () => {
    reply = good();
    srv.calls.length = 0;
    await post(srv.base, { message: 'ดูภาพ', files: [{ data: WEBP, type: 'image/webp', name: 'x.webp' }] });
    const parts = srv.calls.at(-1).contents[0].parts;
    assert.equal(parts[1].inlineData.mimeType, 'image/webp');
    assert.equal(parts[1].inlineData.data, WEBP.toString('base64'));
  });

  test('non-image file type -> 415', async () => {
    const res = await post(srv.base, {
      message: 'x',
      files: [{ data: Buffer.from('hello'), type: 'text/plain', name: 'a.txt' }],
    });
    assert.equal(res.status, 415);
    assert.equal((await res.json()).code, 'UNSUPPORTED_FILE_TYPE');
  });

  test('spoofed MIME (text content declared as PNG) -> 415', async () => {
    const res = await post(srv.base, {
      message: 'x',
      files: [{ data: Buffer.from('<script>alert(1)</script> padding'), type: 'image/png', name: 'a.png' }],
    });
    assert.equal(res.status, 415);
    assert.equal((await res.json()).code, 'INVALID_IMAGE_CONTENT');
  });

  test('JPEG content declared as PNG -> 415', async () => {
    const res = await post(srv.base, { message: 'x', files: [{ data: JPEG, type: 'image/png', name: 'a.png' }] });
    assert.equal(res.status, 415);
  });

  test('file over 5 MB -> 413', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024 + 10)]);
    const res = await post(srv.base, { message: 'x', files: [{ data: big, type: 'image/png', name: 'big.png' }] });
    assert.equal(res.status, 413);
    assert.equal((await res.json()).code, 'LIMIT_FILE_SIZE');
  });

  test('more than 3 files -> 400', async () => {
    const files = Array.from({ length: 4 }, (_, i) => ({ data: PNG, type: 'image/png', name: `${i}.png` }));
    const res = await post(srv.base, { message: 'x', files });
    assert.equal(res.status, 400);
  });

  test('file in unexpected field -> 400', async () => {
    const res = await post(srv.base, { message: 'x', files: [{ field: 'evil', data: PNG, type: 'image/png' }] });
    assert.equal(res.status, 400);
  });

  test('empty request -> 400', async () => {
    const res = await post(srv.base, { message: '   ' });
    assert.equal(res.status, 400);
  });

  test('message too long -> 413', async () => {
    const res = await post(srv.base, { message: 'ก'.repeat(1001) });
    assert.equal(res.status, 413);
  });

  test('disallowed origin -> 403', async () => {
    const res = await post(srv.base, { message: 'x', origin: 'https://evil.example' });
    assert.equal(res.status, 403);
  });

  test('allowed origin gets CORS header', async () => {
    reply = good();
    const res = await post(srv.base, { message: 'เช็คอินกี่โมง' });
    assert.equal(res.headers.get('access-control-allow-origin'), ORIGIN);
  });

  test('errors never include stack traces', async () => {
    const res = await post(srv.base, { message: 'x', files: [{ data: Buffer.from('zz'), type: 'text/html' }] });
    const text = await res.text();
    assert.doesNotMatch(text, /at .*\.js:\d+/);
  });
});

describe('error handling', () => {
  test('no API key configured -> 503', async () => {
    const s = await startServer({ generate: null });
    const res = await post(s.base, { message: 'อบรมวันไหน' });
    assert.equal(res.status, 503);
    assert.equal((await res.json()).code, 'AI_NOT_CONFIGURED');
    await s.close();
  });

  test('Gemini 429 -> 429 with friendly message', async () => {
    const s = await startServer({
      generate: async () => {
        throw Object.assign(new Error('quota exceeded for key AIzaSECRET'), { status: 429 });
      },
    });
    const res = await post(s.base, { message: 'อบรมวันไหน' });
    const body = await res.json();
    assert.equal(res.status, 429);
    assert.equal(body.code, 'AI_RATE_LIMITED');
    assert.doesNotMatch(JSON.stringify(body), /AIza/);
    await s.close();
  });

  test('Gemini invalid key -> 502 without leaking details', async () => {
    const s = await startServer({
      generate: async () => {
        throw Object.assign(new Error('API key not valid'), { status: 400 });
      },
    });
    const res = await post(s.base, { message: 'อบรมวันไหน' });
    assert.equal(res.status, 502);
    assert.doesNotMatch(await res.text(), /not valid/);
    await s.close();
  });

  test('local rate limit -> 429', async () => {
    const s = await startServer({ reply: good(), rateLimitMax: 2 });
    await post(s.base, { message: 'a' });
    await post(s.base, { message: 'b' });
    const res = await post(s.base, { message: 'c' });
    assert.equal(res.status, 429);
    assert.equal((await res.json()).code, 'RATE_LIMITED');
    await s.close();
  });
});

describe('Admin Knowledge Management API', () => {
  let srv;
  before(async () => {
    srv = await startServer({ reply: good() });
  });
  after(() => srv.close());

  test('verify PIN rejects incorrect PIN', async () => {
    const res = await fetch(`${srv.base}/api/admin/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: 'wrong' }),
    });
    assert.equal(res.status, 401);
  });

  test('verify PIN accepts correct PIN', async () => {
    const res = await fetch(`${srv.base}/api/admin/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: 'admin1234' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
  });

  test('GET /api/admin/course requires authorization', async () => {
    const unauthorized = await fetch(`${srv.base}/api/admin/course`);
    assert.equal(unauthorized.status, 401);

    const authorized = await fetch(`${srv.base}/api/admin/course`, {
      headers: { 'x-admin-pin': 'admin1234' },
    });
    assert.equal(authorized.status, 200);
    const body = await authorized.json();
    assert.ok(Array.isArray(body.facts));
    assert.ok(body.facts.length > 0);
  });

  test('POST /api/admin/login rejects invalid credentials', async () => {
    const res = await fetch(`${srv.base}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrongpassword' }),
    });
    assert.equal(res.status, 401);
  });

  test('full 2-step auth: login -> face scan -> session token -> access course', async () => {
    // Step 1: Login
    const loginRes = await fetch(`${srv.base}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin1234' }),
    });
    assert.equal(loginRes.status, 200);
    const loginBody = await loginRes.json();
    assert.equal(loginBody.ok, true);
    assert.equal(loginBody.step, 'face_scan_required');
    assert.ok(loginBody.challengeToken);

    // Step 2: Face Scan Verification
    const faceRes = await fetch(`${srv.base}/api/admin/verify-face`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeToken: loginBody.challengeToken,
        isDemo: true,
      }),
    });
    assert.equal(faceRes.status, 200);
    const faceBody = await faceRes.json();
    assert.equal(faceBody.ok, true);
    assert.ok(faceBody.sessionToken);
    assert.equal(faceBody.user.faceVerified, true);

    // Step 3: Access Course with session token
    const courseRes = await fetch(`${srv.base}/api/admin/course`, {
      headers: { 'x-admin-token': faceBody.sessionToken },
    });
    assert.equal(courseRes.status, 200);
    const courseBody = await courseRes.json();
    assert.ok(Array.isArray(courseBody.facts));

    // Step 4: Logout
    const logoutRes = await fetch(`${srv.base}/api/admin/logout`, {
      method: 'POST',
      headers: { 'x-admin-token': faceBody.sessionToken },
    });
    assert.equal(logoutRes.status, 200);

    // Step 5: Course should now be unauthorized with invalidated token
    const afterLogoutRes = await fetch(`${srv.base}/api/admin/course`, {
      headers: { 'x-admin-token': faceBody.sessionToken },
    });
    assert.equal(afterLogoutRes.status, 401);
  });
});
