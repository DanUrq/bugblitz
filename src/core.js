// Bug Blitz: the logic, with no DOM. A blitz is one plain object and every change returns a new
// one. The app (view.js), the server (api/blitz.js) and the tests all use these functions, so the
// rules about a blitz and its findings live in one place.

/* ---------- vocabulary ---------- */

// The categories findings are sorted into. Testers never pick one: they say what happened, and
// findings land in "To sort". Whoever triages files them in plain words (label); the Nielsen
// heuristic behind each one is used in the export and as a ticket label.
export const HEURISTICS = {
  unsorted: {
    label: 'To sort',
    nielsen: 'Not sorted yet',
    hint: 'New findings land here. File each one, or let Claude sort them from the export.',
  },
  visibility: {
    label: 'Didn’t show what’s happening',
    nielsen: 'Visibility of system status',
    hint: 'Silent failures, no loading state, not sure it worked.',
  },
  real_world_match: {
    label: 'Confusing words or order',
    nielsen: 'Match with the real world',
    hint: 'Jargon, unclear labels, steps in a strange order.',
  },
  user_control: { label: 'Stuck, no way back', nielsen: 'User control and freedom', hint: 'Can’t cancel, undo or get out.' },
  consistency: {
    label: 'Inconsistent',
    nielsen: 'Consistency and standards',
    hint: 'The same thing looks or works differently in two places.',
  },
  minimalism: {
    label: 'Too much on screen',
    nielsen: 'Aesthetic and minimalist design',
    hint: 'Clutter that gets in the way of the task.',
  },
  error_prevention: {
    label: 'Too easy to get wrong',
    nielsen: 'Error prevention',
    hint: 'Lets you make a mistake, or doesn’t warn you first.',
  },
  general_ux: {
    label: 'Something else',
    nielsen: 'General usability',
    hint: 'Speed, layout, broken links, anything that doesn’t fit above.',
  },
};
export const HEURISTIC_KEYS = Object.keys(HEURISTICS);
export const DEFAULT_HEURISTIC = 'unsorted';
export const SORTABLE_HEURISTICS = HEURISTIC_KEYS.filter((k) => k !== DEFAULT_HEURISTIC);

// How bad, in a tester's words. The ids are what trackers and the skill map to priority.
export const SEVERITIES = ['low', 'medium', 'high', 'critical'];
export const DEFAULT_SEVERITY = 'medium';
export const SEVERITY_LABELS = { low: 'Minor', medium: 'Annoying', high: 'Serious', critical: 'Blocks me' };
export const SEVERITY_HINTS = {
  low: 'Small, easy to live with.',
  medium: 'Gets in the way, but you can carry on.',
  high: 'You might give up, or lose something.',
  critical: 'You can’t finish what you were doing.',
};

// A finding is New until someone decides it's worth fixing (Kept) or not (Dismissed), and Sent
// once it's in the tracker. Sent is final; a dismissed finding can be brought back.
export const STATUSES = ['open', 'triaged', 'sent', 'dismissed'];
export const STATUS_LABELS = { open: 'New', triaged: 'Kept', sent: 'Sent', dismissed: 'Dismissed' };
const TRANSITIONS = { open: ['triaged', 'sent', 'dismissed'], triaged: ['sent', 'dismissed', 'open'], sent: [], dismissed: ['open'] };
export const canMove = (from, to) => (TRANSITIONS[from] || []).includes(to);

export const LIMITS = {
  note: 4000,
  name: 40,
  product: 120,
  flow: 200,
  flows: 40,
  minutes: { min: 5, max: 240, default: 30 },
  testers: { min: 2, max: 20, default: 10 }, // a private blitz takes the max
};

// The shapes of ids. The server checks every id it's given against these.
export const PATTERNS = {
  room: /^[a-z0-9]{12}$/,
  key: /^[a-z0-9]{24}$/,
  tester: /^t-[a-z0-9]{8,32}$/,
  finding: /^f-[a-z0-9-]{4,48}$/,
};

// Where shared blitzes live (api/blitz.js). Screenshots of a shared blitz are served from here.
export const API = '/api/blitz';

// Flows a team can start from: the shape of most products' core paths.
export const STARTER_FLOWS = [
  'Sign up and sign in',
  'The main thing the product is for, start to finish',
  'Change a setting and see it stick',
  'A path that fails: bad input, a rejected payment, no connection',
  'Every flow again on a phone',
];

/* ---------- small helpers ---------- */

export const now = () => new Date().toISOString();
export const clamp = (n, min, max, fallback) => Math.min(max, Math.max(min, Math.round(Number(n) || fallback)));

const ALPHABET = 'abcdefghijkmnopqrstuvwxyz23456789'; // no l, 0 or 1: easy to read back
/** n random characters from crypto.getRandomValues (in browsers and in Node). */
export function randomId(n) {
  return [...crypto.getRandomValues(new Uint8Array(n))].map((b) => ALPHABET[b % ALPHABET.length]).join('');
}
export const newId = (kind = 'f') => `${kind}-${Date.now().toString(36)}-${randomId(6)}`;
export const newTesterId = () => `t-${randomId(12)}`;

/** A form value that can't be used; `field` names the input it came from. */
export class FormError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'FormError';
    this.field = field;
  }
}

/** A link to the build: http(s) only, else none. */
export function safeUrl(u) {
  const s = String(u || '').trim();
  if (!s) return '';
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
  try {
    const url = new URL(withScheme);
    return /^https?:$/.test(url.protocol) && url.hostname.includes('.') ? url.href : '';
  } catch {
    return '';
  }
}

/** Flows from the setup form: an array, or text with one per line (list markers are dropped). */
export function parseFlows(flows) {
  const lines = Array.isArray(flows) ? flows : String(flows || '').split('\n');
  return lines
    .map((f) =>
      String(f)
        .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')
        .trim(),
    )
    .filter(Boolean)
    .slice(0, LIMITS.flows)
    .map((label) => label.slice(0, LIMITS.flow));
}

/* ---------- a blitz ---------- */

/** A new blitz from the setup form. Throws a FormError when the product or the flows are missing. */
export function createBlitz({ product, url = '', flows = [], minutes = LIMITS.minutes.default } = {}) {
  const name = String(product || '').trim();
  if (!name) throw new FormError('Name the product first.', 'product');
  const labels = parseFlows(flows);
  if (!labels.length) throw new FormError('Add at least one flow to walk.', 'flows');
  return normalize({
    id: newId('b'),
    product: name,
    url,
    timer: { minutes },
    flows: labels.map((label, i) => ({ id: `fl${i + 1}`, label })),
  });
}

/** A finding with every field checked, or null when it has no id or note. */
export function cleanFinding(f, { reporter = 'You' } = {}) {
  if (!f || !f.id) return null;
  const note = String(f.note || '')
    .trim()
    .slice(0, LIMITS.note);
  if (!note) return null;
  const at = f.createdAt || now();
  const shot =
    typeof f.screenshot === 'string' && (f.screenshot.startsWith('data:image/') || f.screenshot.startsWith(`${API}?`))
      ? f.screenshot
      : null;
  return {
    id: String(f.id),
    note,
    heuristic: HEURISTICS[f.heuristic] ? f.heuristic : DEFAULT_HEURISTIC,
    severity: SEVERITIES.includes(f.severity) ? f.severity : DEFAULT_SEVERITY,
    status: STATUSES.includes(f.status) ? f.status : 'open',
    reporter:
      String(f.reporter || '')
        .trim()
        .slice(0, LIMITS.name) || reporter,
    screenshot: shot,
    createdAt: at,
    updatedAt: f.updatedAt || at,
  };
}

/** A blitz as the app expects it, whatever shape it was stored in: unknown values fall back, never throw. */
export function normalize(raw) {
  const b = raw && typeof raw === 'object' ? raw : {};
  const flows = (Array.isArray(b.flows) ? b.flows : [])
    .filter((f) => f && f.id && f.label)
    .map((f) => ({ id: String(f.id), label: String(f.label) }));
  const flowIds = new Set(flows.map((f) => f.id));
  const t = b.timer && typeof b.timer === 'object' ? b.timer : {};
  return {
    id: String(b.id || newId('b')),
    product: String(b.product || 'Untitled product').slice(0, LIMITS.product),
    url: safeUrl(b.url),
    createdAt: b.createdAt || now(),
    flows,
    done: (Array.isArray(b.done) ? b.done : []).filter((id) => flowIds.has(id)), // this device's ticks
    timer: {
      minutes: clamp(t.minutes, LIMITS.minutes.min, LIMITS.minutes.max, LIMITS.minutes.default),
      startedAt: typeof t.startedAt === 'number' ? t.startedAt : null,
      spent: Math.max(0, Number(t.spent) || 0),
    },
    findings: (Array.isArray(b.findings) ? b.findings : []).map((f) => cleanFinding(f)).filter(Boolean),
    // the example that ships with the app, and its revision (an older stored copy is replaced)
    example: !!b.example,
    sampleRev: Number(b.sampleRev) || 1,
    // a shared blitz: its id on the server, its revision, and who can get in
    room: typeof b.room === 'string' && PATTERNS.room.test(b.room) ? b.room : null,
    rev: Number(b.rev) || 0,
    listed: !!b.listed,
    cap: Number(b.cap) || 0,
    testers: Number(b.testers) || 0,
    gone: !!b.gone, // deleted or expired on the server; this is the last copy
    // this device's part in it
    key: typeof b.key === 'string' && PATTERNS.key.test(b.key) ? b.key : null, // the creator's key
    keySaved: !!b.keySaved,
    tester: typeof b.tester === 'string' && PATTERNS.tester.test(b.tester) ? b.tester : null,
    joined: !!b.joined,
  };
}

/** Whether `me` can work in this blitz here: a local blitz always, a shared one once joined with a name. */
export const hasJoined = (blitz, me) => !!blitz && (!blitz.room || (!!me && blitz.joined));
/** Who a finding logged here is from: a name on a shared blitz, You on a local one. */
export const reporterFor = (blitz, me) => (blitz.room ? me : 'You');

/** Tick a flow off, or untick it. */
export function toggleFlow(blitz, id) {
  if (!blitz.flows.some((f) => f.id === id)) return blitz;
  const done = blitz.done.includes(id) ? blitz.done.filter((x) => x !== id) : [...blitz.done, id];
  return { ...blitz, done };
}

/** { done, total, pct } over the flows checklist. */
export function progress(blitz) {
  const total = blitz.flows.length;
  const done = blitz.done.length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

/* ---------- the timer: minutes, and when it was started (ms) plus time already spent ---------- */

/** Seconds left on the clock at `at` (ms). Never below zero. */
export function timeLeft(blitz, at = Date.now()) {
  const { minutes, startedAt, spent } = blitz.timer;
  const run = startedAt != null ? Math.max(0, at - startedAt) / 1000 : 0;
  return Math.max(0, Math.round(minutes * 60 - spent - run));
}
export const timerRunning = (blitz) => blitz.timer.startedAt != null;
export function startTimer(blitz, at = Date.now()) {
  if (timerRunning(blitz) || timeLeft(blitz, at) <= 0) return blitz;
  return { ...blitz, timer: { ...blitz.timer, startedAt: at } };
}
export function pauseTimer(blitz, at = Date.now()) {
  if (!timerRunning(blitz)) return blitz;
  return { ...blitz, timer: { ...blitz.timer, startedAt: null, spent: blitz.timer.minutes * 60 - timeLeft(blitz, at) } };
}
export const resetTimer = (blitz) => ({ ...blitz, timer: { ...blitz.timer, startedAt: null, spent: 0 } });
/** "29:05" */
export const clock = (secs) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

/* ---------- findings: one set of rules, here and on the server ---------- */

/** Log a finding. The note is the only thing required. Throws a FormError without one. */
export function addFinding(blitz, { note, severity, screenshot = null, reporter = 'You' } = {}) {
  const finding = cleanFinding({ id: newId(), note, severity, screenshot, reporter, status: 'open' });
  if (!finding) throw new FormError('Write what’s wrong first.', 'note');
  return { blitz: { ...blitz, findings: [...blitz.findings, finding] }, finding };
}

/** A finding with { status, heuristic, severity } applied where the rules allow: sent is final,
 *  and a status only moves along TRANSITIONS. Returns the same object when nothing changes. */
export function patchFinding(f, { status, heuristic, severity } = {}) {
  if (f.status === 'sent') return f;
  const next = { ...f };
  if (status && canMove(f.status, status)) next.status = status;
  if (heuristic && HEURISTICS[heuristic]) next.heuristic = heuristic;
  if (severity && SEVERITIES.includes(severity)) next.severity = severity;
  const changed = next.status !== f.status || next.heuristic !== f.heuristic || next.severity !== f.severity;
  return changed ? { ...next, updatedAt: now() } : f;
}

/** Only a new finding can be taken back off the board (the Undo after logging it). */
export const canRemove = (f) => !!f && f.status === 'open';

export function updateFinding(blitz, id, patch) {
  let changed = false;
  const findings = blitz.findings.map((f) => {
    if (f.id !== id) return f;
    const next = patchFinding(f, patch);
    changed = changed || next !== f;
    return next;
  });
  return changed ? { ...blitz, findings } : blitz;
}
export const moveFinding = (blitz, id, status) => updateFinding(blitz, id, { status });

export function removeFinding(blitz, id) {
  const f = blitz.findings.find((x) => x.id === id);
  return canRemove(f) ? { ...blitz, findings: blitz.findings.filter((x) => x !== f) } : blitz;
}

/** Every kept finding marked as sent, after the export. Returns the blitz and the ids it moved. */
export function markKeptSent(blitz) {
  const ids = blitz.findings.filter((f) => f.status === 'triaged').map((f) => f.id);
  return { blitz: ids.reduce((b, id) => moveFinding(b, id, 'sent'), blitz), ids };
}

/** The findings a filter lets through: { status: 'all' | a status, severity: 'all' | a severity }. */
export function filterFindings(findings, { status = 'all', severity = 'all' } = {}) {
  return findings.filter((f) => (status === 'all' || f.status === status) && (severity === 'all' || f.severity === severity));
}

/** Findings by heuristic, in board order, most severe first within each. */
export function byHeuristic(findings) {
  const rank = (f) => SEVERITIES.length - SEVERITIES.indexOf(f.severity);
  return HEURISTIC_KEYS.map((key) => ({
    key,
    ...HEURISTICS[key],
    findings: findings.filter((f) => f.heuristic === key).sort((a, b) => rank(a) - rank(b) || a.createdAt.localeCompare(b.createdAt)),
  }));
}

/** How many findings in each status, plus all. */
export function counts(findings) {
  const out = { all: findings.length };
  for (const s of STATUSES) out[s] = findings.filter((f) => f.status === s).length;
  return out;
}

/** "just now", "5 min ago", "2 h ago", or the date. */
export function ago(iso, at = Date.now()) {
  const s = Math.max(0, (at - new Date(iso).getTime()) / 1000);
  if (!Number.isFinite(s)) return '';
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/* ---------- export: the findings worth fixing, as Markdown for Claude, a tracker or a doc ---------- */

/** `origin` turns a shared blitz's screenshot paths into full links a tracker can attach. */
export function toMarkdown(blitz, { origin = '', date = new Date() } = {}) {
  const p = progress(blitz);
  const kept = blitz.findings.filter((f) => f.status !== 'dismissed');
  const dismissed = blitz.findings.length - kept.length;
  const screenshot = (f) => {
    if (!f.screenshot) return '';
    if (f.screenshot.startsWith('data:')) return ' _(screenshot in the app)_';
    return ` [Screenshot](${f.screenshot.startsWith('/') ? origin : ''}${f.screenshot})`;
  };
  const lines = [
    `# Bug blitz: ${blitz.product}`,
    '',
    `Exported ${date.toISOString().slice(0, 10)} from Bug Blitz. To turn it into tickets, give it to Claude with the bug-blitz-tickets skill.`,
    '',
    ...(blitz.url ? [`Build: ${blitz.url}`] : []),
    `Flows walked: ${p.done} of ${p.total}. Findings: ${kept.length}${dismissed ? ` (${dismissed} dismissed, left out)` : ''}.`,
    '',
    '## Flows',
    '',
    ...blitz.flows.map((f) => `- ${f.label}`),
    '',
  ];
  for (const sev of [...SEVERITIES].reverse()) {
    const group = kept.filter((f) => f.severity === sev);
    if (!group.length) continue;
    lines.push(`## ${SEVERITY_LABELS[sev]}: ${sev} (${group.length})`, '');
    for (const f of group) {
      const note = f.note.replace(/\s*\n\s*/g, ' ');
      lines.push(
        `- **${HEURISTICS[f.heuristic].nielsen}**: ${note} _(${STATUS_LABELS[f.status].toLowerCase()}, ${f.reporter}, ${f.id})_${screenshot(f)}`,
      );
    }
    lines.push('');
  }
  return `${lines.join('\n').trim()}\n`;
}

/* ---------- the store: every blitz this browser knows, newest first ---------- */

// localStorage, or null where there is none or it's blocked (reading it can throw in a sandboxed frame).
function browserStorage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

const STORE_VERSION = 2;
const exampleBlitz = (example) => normalize({ ...structuredClone(example), example: true });

/** The stored blitzes, or just the example. Storage can be missing, full or blocked: never throws. */
export function loadStore(key, example, storage = browserStorage()) {
  try {
    const data = JSON.parse(storage?.getItem(key) || 'null');
    if (data) {
      const blitzes = (Array.isArray(data.blitzes) ? data.blitzes : []).map(normalize);
      const store = { me: String(data.me || '').slice(0, LIMITS.name), blitzes };
      // An example from an older release (a renamed product, new findings) is swapped for the current one.
      const stored = blitzes.find((b) => b.example);
      return stored && stored.sampleRev < (Number(example.sampleRev) || 1) ? resetExample(store, example) : store;
    }
  } catch {
    /* unreadable: start again from the example */
  }
  return { me: '', blitzes: [exampleBlitz(example)] };
}

/** Keep the store. False when the browser refuses it (full: screenshots are the usual cause). */
export function saveStore(key, store, storage = browserStorage()) {
  if (!storage) return true; // no storage at all: the app still works, it just forgets on reload
  try {
    storage.setItem(key, JSON.stringify({ version: STORE_VERSION, me: store.me || '', blitzes: store.blitzes }));
    return true;
  } catch {
    return false;
  }
}

export const getBlitz = (store, id) => store.blitzes.find((b) => b.id === id) || null;
export const getRoom = (store, room) => store.blitzes.find((b) => b.room === room) || null;
export const deleteBlitz = (store, id) => ({ ...store, blitzes: store.blitzes.filter((b) => b.id !== id) });

/** The store with this blitz in it: replaced where it was, or added at the top (or the end). */
export function putBlitz(store, blitz, { atEnd = false } = {}) {
  const at = store.blitzes.findIndex((b) => b.id === blitz.id);
  if (at < 0) return { ...store, blitzes: atEnd ? [...store.blitzes, blitz] : [blitz, ...store.blitzes] };
  const blitzes = store.blitzes.slice();
  blitzes[at] = blitz;
  return { ...store, blitzes };
}

/** The example back as it shipped, in its place (or at the end if it was deleted). */
export function resetExample(store, example) {
  const current = store.blitzes.find((b) => b.example);
  return putBlitz(current ? deleteBlitz(store, current.id) : store, exampleBlitz(example), { atEnd: true });
}

/** A shared blitz as the server sends it (api/blitz.js), over this device's copy. The setup and the
 *  findings are everyone's; the flows ticked, the timer and the tester id stay this device's. */
export function fromRoom(local, room, { rev, blitz, findings }) {
  const base = local || { id: newId('b') };
  return normalize({
    ...base,
    room,
    rev,
    product: blitz.product,
    url: blitz.url,
    createdAt: blitz.createdAt,
    flows: blitz.flows,
    timer: { ...base.timer, minutes: blitz.minutes },
    listed: blitz.listed,
    cap: blitz.cap,
    testers: blitz.testers,
    findings: findings.map((f) => ({ ...f, screenshot: f.shot ? `${API}?id=${room}&shot=${f.id}` : null })),
  });
}
