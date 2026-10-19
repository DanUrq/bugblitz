import test from 'node:test';
import assert from 'node:assert/strict';
import { handle, jpegBytes, LIMITS } from './handler.js';
import { memoryKv, memoryBlob, upstash } from './stores.js';

const stores = () => ({ kv: memoryKv(), blob: memoryBlob() });
let ip = 0;
const call = (s, method, query = '', body, headers = {}) =>
  handle(
    new Request(`https://bugblitz.example/api/blitz${query}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-real-ip': `10.0.0.${(ip += 1) % 250}`, ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    s,
  );
const data = async (res) => ({ status: res.status, body: await res.json() });

const ME = 't-creatorcreator';
const JPEG = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString('base64')}`;
const finding = (id, extra = {}) => ({ id, note: 'Button does nothing', severity: 'high', reporter: 'Wally', ...extra });

async function created(s, extra = {}) {
  const { status, body } = await data(
    await call(s, 'POST', '', { product: 'Acme', url: 'staging.acme.dev', flows: ['Sign up', 'Pay'], tester: ME, ...extra }),
  );
  assert.equal(status, 201);
  return body;
}
const change = (s, id, body, headers) => call(s, 'POST', `?id=${id}`, { tester: ME, ...body }, headers);

test('creating returns everything the app needs, and the creator takes the first place', async () => {
  const s = stores();
  const b = await created(s);
  assert.match(b.id, /^[a-z0-9]{12}$/);
  assert.equal(b.key.length, 24);
  assert.equal(b.blitz.product, 'Acme');
  assert.equal(b.blitz.ownerHash, undefined, 'the key hash never leaves');
  assert.deepEqual([b.blitz.listed, b.blitz.cap, b.blitz.testers, b.findings.length], [false, 20, 1, 0]);
  assert.ok(b.rev > 0);
});

test('a bad form is a 400 that names the field', async () => {
  const s = stores();
  assert.deepEqual((await data(await call(s, 'POST', '', { product: ' ', flows: ['a'] }))).body.field, 'product');
  assert.deepEqual((await data(await call(s, 'POST', '', { product: 'A', flows: [] }))).body.field, 'flows');
  const bad = new Request('https://bugblitz.example/api/blitz', { method: 'POST', body: '{' });
  assert.equal((await handle(bad, s)).status, 400);
});

test('everyone who joined logs into one board, and an unchanged board answers small', async () => {
  const s = stores();
  const { id } = await created(s);
  assert.equal((await change(s, id, { op: 'join', tester: 't-jasperjasper' })).status, 200);
  await change(s, id, { op: 'add', finding: finding('f-aa11') });
  await change(s, id, {
    op: 'add',
    tester: 't-jasperjasper',
    finding: finding('f-bb22', { reporter: 'Jasper', severity: '??', status: 'sent' }),
  });
  const { body } = await data(await call(s, 'GET', `?id=${id}`));
  assert.deepEqual(
    body.findings.map((f) => [f.id, f.reporter, f.status, f.severity]),
    [
      ['f-aa11', 'Wally', 'open', 'high'],
      ['f-bb22', 'Jasper', 'open', 'medium'],
    ],
  );
  assert.deepEqual(await (await call(s, 'GET', `?id=${id}&rev=${body.rev}`)).json(), { rev: body.rev, same: true });
});

test('every change needs a tester who joined', async () => {
  const s = stores();
  const { id } = await created(s);
  await change(s, id, { op: 'add', finding: finding('f-aa11') });
  for (const op of [
    { op: 'add', finding: finding('f-bb22') },
    { op: 'update', fid: 'f-aa11', patch: { status: 'dismissed' } },
    { op: 'remove', fid: 'f-aa11' },
  ]) {
    assert.equal((await change(s, id, { ...op, tester: 't-strangerxx' })).status, 403, op.op);
  }
});

test('triage follows the same rules as the app: sent is final, only new findings come off', async () => {
  const s = stores();
  const { id } = await created(s);
  await change(s, id, { op: 'add', finding: finding('f-aa11') });
  const get = async () => (await data(await call(s, 'GET', `?id=${id}`))).body.findings[0];
  await change(s, id, { op: 'update', fid: 'f-aa11', patch: { status: 'triaged', severity: 'critical', heuristic: 'visibility' } });
  assert.deepEqual([(await get()).status, (await get()).severity, (await get()).heuristic], ['triaged', 'critical', 'visibility']);
  assert.equal((await change(s, id, { op: 'remove', fid: 'f-aa11' })).status, 409);
  await change(s, id, { op: 'update', fid: 'f-aa11', patch: { status: 'sent' } });
  assert.equal((await change(s, id, { op: 'update', fid: 'f-aa11', patch: { status: 'open' } })).status, 409);
});

test('a batch of findings can be marked sent in one change', async () => {
  const s = stores();
  const { id } = await created(s);
  for (const fid of ['f-aa11', 'f-bb22', 'f-cc33']) await change(s, id, { op: 'add', finding: finding(fid) });
  await change(s, id, { op: 'update', fids: ['f-aa11', 'f-bb22'], patch: { status: 'triaged' } });
  await change(s, id, { op: 'update', fids: ['f-aa11', 'f-bb22'], patch: { status: 'sent' } });
  const { body } = await data(await call(s, 'GET', `?id=${id}`));
  assert.deepEqual(
    body.findings.map((f) => f.status),
    ['sent', 'sent', 'open'],
  );
});

test('screenshots: a JPEG goes to private storage and comes back through here; anything else is refused', async () => {
  const s = stores();
  const { id } = await created(s);
  assert.equal((await change(s, id, { op: 'add', finding: finding('f-cc33'), shot: 'data:image/png;base64,AAAA' })).status, 413);
  assert.equal((await data(await change(s, id, { op: 'add', finding: finding('f-cc33'), shot: JPEG }))).body.finding.shot, true);
  const img = await call(s, 'GET', `?id=${id}&shot=f-cc33`);
  assert.equal(img.headers.get('content-type'), 'image/jpeg');
  assert.equal((await img.arrayBuffer()).byteLength, 7);
  assert.equal((await call(s, 'GET', `?id=${id}&shot=f-nope`)).status, 404);
  assert.equal(jpegBytes(`data:image/jpeg;base64,${Buffer.alloc(LIMITS.shotBytes + 10, 0xff).toString('base64')}`), null);
});

test('only the creator deletes it, and everything goes, screenshots too', async () => {
  const s = stores();
  const { id, key } = await created(s);
  await change(s, id, { op: 'add', finding: finding('f-dd44'), shot: JPEG });
  assert.equal((await call(s, 'DELETE', `?id=${id}`, undefined, { 'x-blitz-key': 'wrong' })).status, 403);
  assert.equal((await call(s, 'DELETE', `?id=${id}`, undefined, { 'x-blitz-key': key })).status, 200);
  assert.equal((await call(s, 'GET', `?id=${id}`)).status, 404);
  assert.equal(s.blob.m.size, 0);
  assert.equal([...s.kv.m.keys()].filter((k) => k.startsWith(`bb:${id}`)).length, 0);
});

test('private blitzes are capped at 20 testers and stay unlisted', async () => {
  const s = stores();
  const { id } = await created(s);
  assert.deepEqual((await data(await call(s, 'GET', '?list=1'))).body.open, []);
  for (let i = 0; i < 19; i++)
    assert.equal((await change(s, id, { op: 'join', tester: `t-tester${String(i).padStart(4, '0')}` })).status, 200);
  const full = await data(await change(s, id, { op: 'join', tester: 't-onetoomany' }));
  assert.deepEqual([full.status, full.body.full], [409, true]);
  assert.equal((await change(s, id, { op: 'join' })).status, 200, 'someone already in can join again');
});

test('open blitzes are listed with their places, and the creator can unlist', async () => {
  const s = stores();
  const { id, key } = await created(s, { listed: true, cap: 2 });
  const list = await call(s, 'GET', '?list=1');
  assert.match(list.headers.get('cache-control'), /s-maxage=120/);
  assert.deepEqual(
    (await list.json()).open.map((o) => [o.id, o.flows, o.testers, o.cap]),
    [[id, 2, 1, 2]],
  );
  assert.equal((await change(s, id, { op: 'join', tester: 't-jasperjasper' })).status, 200);
  assert.equal((await change(s, id, { op: 'join', tester: 't-bertiebertie' })).status, 409);
  assert.equal((await change(s, id, { op: 'unlist' }, { 'x-blitz-key': 'nope' })).status, 403);
  assert.equal((await change(s, id, { op: 'unlist' }, { 'x-blitz-key': key })).status, 200);
  assert.deepEqual((await data(await call(s, 'GET', '?list=1'))).body.open, []);
});

test('the cap stays in range, and a deleted open blitz leaves the list', async () => {
  const s = stores();
  const big = await created(s, { listed: true, cap: 999 });
  await created(s, { listed: true, cap: 0 });
  assert.deepEqual(
    (await data(await call(s, 'GET', '?list=1'))).body.open.map((o) => o.cap).sort((a, b) => a - b),
    [10, 20],
  );
  await call(s, 'DELETE', `?id=${big.id}`, undefined, { 'x-blitz-key': big.key });
  assert.equal((await data(await call(s, 'GET', '?list=1'))).body.open.length, 1);
});

test('odd ids, unknown changes and methods are turned away cleanly', async () => {
  const s = stores();
  assert.equal((await call(s, 'GET', '?id=../../etc')).status, 404);
  assert.equal((await call(s, 'GET', '?id=aaaaaaaaaaaa')).status, 404);
  const { id } = await created(s);
  assert.equal((await change(s, id, { op: 'add', finding: { id: 'bad id', note: 'x' } })).status, 400);
  assert.equal((await change(s, id, { op: 'constructor' })).status, 400);
  assert.equal((await change(s, id, { op: 'update', fid: '../x', patch: {} })).status, 404);
  assert.equal((await call(s, 'PUT', `?id=${id}`, {})).status, 405);
});

test('upstash speaks the REST API: one command, or a pipeline', async () => {
  const seen = [];
  const kv = upstash('https://eu.upstash.io/', 'tok', async (url, init) => {
    seen.push([url, init.headers.Authorization]);
    return new Response(JSON.stringify(url.endsWith('/pipeline') ? [{ result: 1 }, { result: 'OK' }] : { result: 'v' }));
  });
  assert.equal(await kv.cmd('GET', 'k'), 'v');
  assert.deepEqual(
    await kv.pipe([
      ['INCR', 'a'],
      ['SET', 'b', 1],
    ]),
    [1, 'OK'],
  );
  assert.deepEqual(seen, [
    ['https://eu.upstash.io', 'Bearer tok'],
    ['https://eu.upstash.io/pipeline', 'Bearer tok'],
  ]);
});
