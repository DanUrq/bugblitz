import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HEURISTIC_KEYS,
  DEFAULT_HEURISTIC,
  normalize,
  toggleFlow,
  progress,
  addFinding,
  updateFinding,
  moveFinding,
  removeFinding,
  filterFindings,
  byHeuristic,
  counts,
  createBlitz,
  safeUrl,
  timeLeft,
  startTimer,
  pauseTimer,
  resetTimer,
  timerRunning,
  clock,
  toMarkdown,
  loadStore,
  saveStore,
  getBlitz,
  putBlitz,
  deleteBlitz,
  resetExample,
  fromRoom,
  FormError,
  parseFlows,
  cleanFinding,
  patchFinding,
  canRemove,
  markKeptSent,
  hasJoined,
  reporterFor,
  randomId,
  newTesterId,
  PATTERNS,
} from './core.js';
import { SAMPLE } from './sample.js';

const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

test('the example is a valid blitz, with every heuristic a known one', () => {
  const b = normalize(SAMPLE);
  assert.equal(b.id, 'example');
  assert.equal(b.flows.length, 7);
  assert.equal(b.findings.length, SAMPLE.findings.length);
  for (const f of b.findings) assert.ok(HEURISTIC_KEYS.includes(f.heuristic));
});

test('a new blitz: product and flows required, list markers stripped, the link kept only when it is http(s)', () => {
  assert.throws(() => createBlitz({ product: ' ', flows: ['a'] }), /Name the product/);
  assert.throws(() => createBlitz({ product: 'App', flows: '\n  \n' }), /at least one flow/);
  const b = createBlitz({ product: ' Acme ', url: 'staging.acme.dev', flows: '- Sign up\n2. Pay\n\n• Refund', minutes: 45 });
  assert.equal(b.product, 'Acme');
  assert.equal(b.url, 'https://staging.acme.dev/');
  assert.deepEqual(
    b.flows.map((f) => f.label),
    ['Sign up', 'Pay', 'Refund'],
  );
  assert.equal(b.timer.minutes, 45);
  assert.deepEqual([b.done, b.findings], [[], []]);
  assert.equal(safeUrl('javascript:alert(1)'), '');
  assert.equal(safeUrl('localhost'), '');
});

test('flows tick and untick, and progress counts them', () => {
  let b = normalize(SAMPLE);
  assert.deepEqual(progress(b), { done: 4, total: 7, pct: 57 });
  b = toggleFlow(b, 'fail');
  assert.equal(progress(b).done, 5);
  b = toggleFlow(b, 'fail');
  assert.equal(progress(b).done, 4);
  assert.equal(toggleFlow(b, 'nope'), b);
});

test('the timer runs, pauses, stops at zero and resets', () => {
  let b = createBlitz({ product: 'A', flows: ['x'], minutes: 30 });
  assert.equal(timeLeft(b, 0), 1800);
  b = startTimer(b, 1000);
  assert.ok(timerRunning(b));
  assert.equal(timeLeft(b, 61000), 1740);
  b = pauseTimer(b, 61000);
  assert.ok(!timerRunning(b));
  assert.equal(timeLeft(b, 999999), 1740);
  b = startTimer(b, 0);
  assert.equal(timeLeft(b, 10e6), 0);
  assert.equal(clock(timeLeft(resetTimer(b))), '30:00');
  assert.equal(clock(65), '1:05');
});

test('a finding needs only a note: the heuristic and severity default', () => {
  const b = normalize({ flows: [], findings: [] });
  assert.throws(() => addFinding(b, { note: '   ' }), /Write what/);
  const { blitz, finding } = addFinding(b, { note: '  Button does nothing  ' });
  assert.equal(finding.note, 'Button does nothing');
  assert.equal(finding.heuristic, DEFAULT_HEURISTIC);
  assert.equal(finding.severity, 'medium');
  assert.equal(finding.status, 'open');
  assert.equal(blitz.findings.length, 1);
  assert.equal(b.findings.length, 0, 'the old blitz is left as it was');
});

test('triage moves open → triaged → sent, or dismissed; sent is final and bad moves are ignored', () => {
  const added = addFinding(normalize({}), { note: 'x', severity: 'high' });
  const { finding } = added;
  let { blitz } = added;
  const id = finding.id;
  const status = () => blitz.findings[0].status;
  blitz = moveFinding(blitz, id, 'triaged');
  assert.equal(status(), 'triaged');
  blitz = moveFinding(blitz, id, 'dismissed');
  assert.equal(status(), 'dismissed');
  blitz = moveFinding(blitz, id, 'sent');
  assert.equal(status(), 'dismissed', 'a dismissed finding is reopened first');
  blitz = moveFinding(blitz, id, 'open');
  assert.equal(status(), 'open');
  blitz = moveFinding(blitz, id, 'sent');
  assert.equal(status(), 'sent');
  const before = blitz;
  assert.equal(moveFinding(blitz, id, 'open'), before);
  assert.equal(updateFinding(blitz, id, { severity: 'low' }), before, 'a sent finding is not edited');
});

test('re-filing changes the heuristic and severity, and only to known ones', () => {
  const added = addFinding(normalize({}), { note: 'x' });
  const { finding } = added;
  let { blitz } = added;
  blitz = updateFinding(blitz, finding.id, { heuristic: 'consistency', severity: 'critical' });
  assert.deepEqual([blitz.findings[0].heuristic, blitz.findings[0].severity], ['consistency', 'critical']);
  blitz = updateFinding(blitz, finding.id, { heuristic: 'nonsense', severity: 'huge' });
  assert.equal(blitz.findings[0].heuristic, 'consistency');
  assert.equal(removeFinding(blitz, finding.id).findings.length, 0);
});

test('filters, counts and the board by heuristic, most severe first', () => {
  const b = normalize(SAMPLE);
  const c = counts(b.findings);
  assert.equal(c.open + c.triaged + c.sent + c.dismissed, c.all);
  assert.ok(filterFindings(b.findings, { status: 'open' }).every((f) => f.status === 'open'));
  assert.ok(filterFindings(b.findings, { severity: 'high' }).every((f) => f.severity === 'high'));
  const cols = byHeuristic(b.findings);
  assert.deepEqual(
    cols.map((col) => col.key),
    HEURISTIC_KEYS,
  );
  assert.deepEqual(
    cols.find((col) => col.key === 'error_prevention').findings.map((f) => f.severity),
    ['critical', 'medium'],
  );
});

test('the export: most severe first, dismissed left out', () => {
  const md = toMarkdown(normalize(SAMPLE));
  assert.match(md, /^# Bug blitz: Fernly, a savings app\n/);
  assert.ok(md.indexOf('## Blocks me: critical') < md.indexOf('## Serious: high'));
  assert.match(md, /- \*\*Error prevention\*\*: Withdraw lets me[^\n]*_\(kept, Wally, s6\)_/);
  assert.match(md, /## Flows\n\n- Sign up and verify your email/);
  assert.match(md, /bug-blitz-tickets skill/);
  const shared = toMarkdown(
    { ...normalize(SAMPLE), findings: [{ ...normalize(SAMPLE).findings[0], screenshot: '/api/blitz?id=abc&shot=s1' }] },
    { origin: 'https://bugblitz.example' },
  );
  assert.match(shared, /\[Screenshot\]\(https:\/\/bugblitz\.example\/api\/blitz\?id=abc&shot=s1\)/);
  assert.doesNotMatch(md, /Confetti/);
  assert.match(md, /1 dismissed, left out/);
});

test('the store: the example first time, round-trips, and odd data falls back without throwing', () => {
  const s = memory();
  let store = loadStore('k', SAMPLE, s);
  assert.deepEqual(
    store.blitzes.map((b) => [b.id, b.example]),
    [['example', true]],
  );
  const mine = createBlitz({ product: 'Mine', flows: ['a'] });
  store = putBlitz(store, mine);
  assert.equal(store.blitzes[0].id, mine.id, 'new blitzes go on top');
  assert.equal(saveStore('k', store, s), true);
  assert.equal(getBlitz(loadStore('k', SAMPLE, s), mine.id).product, 'Mine');
  store = resetExample(deleteBlitz(store, 'example'), SAMPLE);
  assert.deepEqual(
    store.blitzes.map((b) => b.id),
    [mine.id, 'example'],
  );
  s.setItem('k', '{not json');
  assert.equal(loadStore('k', SAMPLE, s).blitzes[0].id, 'example');
  s.setItem(
    'k',
    JSON.stringify({
      blitzes: [
        {
          id: 'z',
          flows: [{ id: 'a', label: 'A' }],
          done: ['a', 'gone'],
          findings: [{ id: '1', note: 'n', heuristic: '??', severity: '??', status: '??', screenshot: 'javascript:alert(1)' }],
          url: 'javascript:x',
        },
      ],
    }),
  );
  const b = loadStore('k', SAMPLE, s).blitzes[0];
  assert.deepEqual(b.done, ['a']);
  assert.equal(b.url, '');
  assert.deepEqual(
    [b.findings[0].heuristic, b.findings[0].severity, b.findings[0].status, b.findings[0].screenshot],
    [DEFAULT_HEURISTIC, 'medium', 'open', null],
  );
  assert.equal(loadStore('k', SAMPLE, null).blitzes.length, 1, 'no storage at all');
  assert.equal(
    saveStore('k', store, {
      setItem() {
        throw new Error('QuotaExceededError');
      },
    }),
    false,
  );
});

test('a shared blitz: the server has the setup and the findings, this device keeps its ticks and timer', () => {
  const server = {
    rev: 5,
    blitz: {
      product: 'Room',
      url: 'https://x.dev/',
      minutes: 20,
      createdAt: '2026-10-19T10:00:00Z',
      flows: [
        { id: 'fl1', label: 'Load' },
        { id: 'fl2', label: 'Sit' },
      ],
    },
    findings: [
      {
        id: 'f-aaaa',
        note: 'n',
        heuristic: 'visibility',
        severity: 'high',
        status: 'open',
        reporter: 'Jonas',
        shot: true,
        createdAt: 't',
        updatedAt: 't',
      },
    ],
  };
  const first = fromRoom(null, 'abcdefghijk2', server);
  assert.equal(first.room, 'abcdefghijk2');
  assert.equal(first.findings[0].screenshot, '/api/blitz?id=abcdefghijk2&shot=f-aaaa');
  const key = 'a'.repeat(24);
  const mine = { ...toggleFlow(first, 'fl1'), key };
  const next = fromRoom(mine, 'abcdefghijk2', { ...server, rev: 6, findings: [] });
  assert.deepEqual([next.done, next.key, next.rev, next.findings.length, next.timer.minutes], [['fl1'], key, 6, 0, 20]);
});

test('an example saved by an older release is replaced by the current one; your own blitzes stay', () => {
  const s = memory();
  const old = { ...SAMPLE, sampleRev: 1, product: 'Kettle, a savings app', example: true };
  const mine = createBlitz({ product: 'Mine', flows: ['a'] });
  s.setItem('k', JSON.stringify({ blitzes: [mine, old] }));
  const store = loadStore('k', SAMPLE, s);
  assert.deepEqual(
    store.blitzes.map((b) => b.product),
    ['Mine', 'Fernly, a savings app'],
  );
  s.setItem('k', JSON.stringify({ blitzes: [{ ...SAMPLE, example: true, findings: [] }] }));
  assert.equal(loadStore('k', SAMPLE, s).blitzes[0].findings.length, 0, 'a current example keeps its changes');
});

test('a bad setup form throws a FormError naming the field', () => {
  assert.throws(
    () => createBlitz({ product: '', flows: ['a'] }),
    (e) => e instanceof FormError && e.field === 'product',
  );
  assert.throws(
    () => createBlitz({ product: 'A', flows: '' }),
    (e) => e instanceof FormError && e.field === 'flows',
  );
  assert.deepEqual(parseFlows('- One\n\n2) Two\n* Three'), ['One', 'Two', 'Three']);
  assert.equal(parseFlows(Array.from({ length: 60 }, (_, i) => `Flow ${i}`)).length, 40);
});

test('one set of finding rules: cleaning, patching and what can be removed', () => {
  assert.equal(cleanFinding({ id: 'f-1', note: '   ' }), null);
  const f = cleanFinding({ id: 'f-1', note: ' Broken ', severity: 'huge', heuristic: 'nope', reporter: ' ' + 'x'.repeat(60) });
  assert.deepEqual([f.note, f.severity, f.heuristic, f.status, f.reporter.length], ['Broken', 'medium', 'unsorted', 'open', 40]);
  assert.equal(cleanFinding({ id: 'f-1', note: 'n', screenshot: 'javascript:alert(1)' }).screenshot, null);
  assert.equal(patchFinding(f, {}), f, 'nothing to change: the same object');
  const kept = patchFinding(f, { status: 'triaged', heuristic: 'visibility' });
  assert.deepEqual([kept.status, kept.heuristic], ['triaged', 'visibility']);
  const sent = patchFinding(kept, { status: 'sent' });
  assert.equal(patchFinding(sent, { severity: 'low' }), sent, 'sent is final');
  assert.deepEqual([canRemove(f), canRemove(kept)], [true, false]);
});

test('removing only takes new findings off, and marking kept as sent moves just the kept ones', () => {
  const b = normalize(SAMPLE);
  const kept = b.findings.filter((f) => f.status === 'triaged').map((f) => f.id);
  assert.equal(removeFinding(b, kept[0]), b);
  const { blitz, ids } = markKeptSent(b);
  assert.deepEqual(ids, kept);
  assert.ok(blitz.findings.filter((f) => kept.includes(f.id)).every((f) => f.status === 'sent'));
});

test('joining: a local blitz is always yours; a shared one needs a name and a join', () => {
  const local = normalize({ flows: [] });
  const shared = normalize({ room: 'abcdefghijk2' });
  assert.deepEqual(
    [
      hasJoined(local, ''),
      hasJoined(shared, 'Wally'),
      hasJoined({ ...shared, joined: true }, 'Wally'),
      hasJoined({ ...shared, joined: true }, ''),
    ],
    [true, false, true, false],
  );
  assert.deepEqual([reporterFor(local, 'Wally'), reporterFor(shared, 'Wally')], ['You', 'Wally']);
});

test('ids come from crypto and match the shapes the server checks', () => {
  assert.match(randomId(12), PATTERNS.room);
  assert.match(randomId(24), PATTERNS.key);
  assert.match(newTesterId(), PATTERNS.tester);
  assert.notEqual(randomId(12), randomId(12));
});
