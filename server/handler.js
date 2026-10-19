// Shared blitzes: one blitz, many testers. Whoever sets it up gets an invite link, everyone with the
// link logs into the same board, and each board polls for changes. The app works without any of
// this, on one device.
//
//   POST   /api/blitz                       create one → { id, key, rev, blitz, findings }
//   GET    /api/blitz?list=1                the open blitzes, newest first (cached at the edge)
//   GET    /api/blitz?id=…[&rev=n]          the blitz, or { rev, same: true } when nothing changed
//   POST   /api/blitz?id=…                  a change: { op, tester, … } (see OPS)
//   GET    /api/blitz?id=…&shot=<finding>   a finding's screenshot, from the private Blob store
//   DELETE /api/blitz?id=…                  delete it all, with the creator's key in x-blitz-key
//
// Private blitzes (the default) are reached only through their link, whose id is random and long
// enough not to guess. Open ones are listed for anyone to join. Either way a tester joins once,
// with an id their device keeps, before they can change anything, and every blitz has a tester cap.
// Everything expires seven days after the last change.
//
// Redis layout, per blitz: bb:<id>:meta (the setup, JSON), bb:<id>:f (a hash, one field per
// finding, so two testers never overwrite each other), bb:<id>:t (the set of tester ids) and
// bb:<id>:rev (bumped on every write; boards poll it). bb:listed is a sorted set of open blitzes.

import {
  LIMITS as RULES,
  PATTERNS,
  FormError,
  cleanFinding,
  patchFinding,
  canRemove,
  createBlitz,
  clamp,
  randomId,
  now,
} from '../src/core.js';

export const LIMITS = {
  ttl: 7 * 24 * 3600,
  findings: 300,
  shotBytes: 700 * 1024,
  createsPerHour: 20,
  writesPerMinute: 120,
  listed: 12,
};

const LISTED = 'bb:listed';
const keys = (id) => ({ meta: `bb:${id}:meta`, f: `bb:${id}:f`, rev: `bb:${id}:rev`, t: `bb:${id}:t` });
const shotPath = (id, fid) => `bug-blitz/${id}/${fid}.jpg`;

/* ---------- helpers ---------- */

const json = (data, status = 200, headers = {}) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
const fail = (status, error, extra = {}) => json({ error, ...extra }, status);

/** The caller's IP, for rate limits. Vercel sets x-real-ip; anything else falls back to the first forwarded address. */
const ipOf = (req) => req.headers.get('x-real-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';

async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Compares two hex digests without stopping at the first difference. */
function sameDigest(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** The creator's key, or the deployment's admin key (BUG_BLITZ_ADMIN_KEY) for moderating open blitzes. */
async function isOwner(req, meta, env = process.env) {
  const given = req.headers.get('x-blitz-key') || '';
  if (!given) return false;
  const digest = await sha256(given);
  if (env.BUG_BLITZ_ADMIN_KEY && env.BUG_BLITZ_ADMIN_KEY.length >= 16 && sameDigest(digest, await sha256(env.BUG_BLITZ_ADMIN_KEY)))
    return true;
  return sameDigest(digest, meta.ownerHash);
}

/** Counts a hit against this IP's allowance in the current window; true once it's over. */
async function limited(kv, req, name, max, seconds) {
  const k = `bb:rl:${name}:${ipOf(req)}:${Math.floor(Date.now() / 1000 / seconds)}`;
  const [n] = await kv.pipe([
    ['INCR', k],
    ['EXPIRE', k, seconds],
  ]);
  return n > max;
}

/** A JPEG data URL as bytes, or null when it isn't one or is too big. */
export function jpegBytes(dataUrl) {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) return null;
  const bytes = Buffer.from(m[1], 'base64');
  return bytes.length && bytes.length <= LIMITS.shotBytes && bytes[0] === 0xff && bytes[1] === 0xd8 ? bytes : null;
}

/** Writes, bumps the revision and pushes every key's expiry out to seven days from now. Returns the new revision. */
async function write(kv, id, cmds) {
  const k = keys(id);
  const expire = [k.meta, k.f, k.rev, k.t].map((key) => ['EXPIRE', key, LIMITS.ttl]);
  const out = await kv.pipe([...cmds, ['INCR', k.rev], ...expire]);
  return out[cmds.length];
}

/** The setup as anyone with the link sees it: without the creator's key hash. */
function publicMeta(meta, testers) {
  const { ownerHash, ...rest } = meta;
  return { ...rest, listed: !!rest.listed, cap: rest.cap || RULES.testers.max, testers: testers || 0 };
}
const parseFindings = (vals) => (vals || []).map((v) => JSON.parse(v)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

/* ---------- reading ---------- */

async function listOpen(kv) {
  const ids = (await kv.cmd('ZREVRANGE', LISTED, 0, LIMITS.listed * 2 - 1)) || [];
  const rows = ids.length
    ? await kv.pipe(
        ids.flatMap((x) => [
          ['GET', keys(x).meta],
          ['SCARD', keys(x).t],
        ]),
      )
    : [];
  const open = [];
  const gone = [];
  ids.forEach((id, i) => {
    const meta = rows[i * 2] && JSON.parse(rows[i * 2]);
    if (!meta?.listed) gone.push(id);
    else if (open.length < LIMITS.listed)
      open.push({
        id,
        product: meta.product,
        flows: meta.flows.length,
        minutes: meta.minutes,
        testers: rows[i * 2 + 1] || 0,
        cap: meta.cap,
        createdAt: meta.createdAt,
      });
  });
  if (gone.length) await kv.cmd('ZREM', LISTED, ...gone); // expired or unlisted since they were listed
  return json({ open }, 200, { 'Cache-Control': 'public, max-age=30, s-maxage=120, stale-while-revalidate=600' });
}

async function readBlitz(kv, id, since) {
  const k = keys(id);
  if (since !== null) {
    // A poll: one command when nothing changed.
    const rev = Number(await kv.cmd('GET', k.rev)) || 0;
    if (rev > 0 && Number(since) === rev) return json({ rev, same: true });
  }
  const [rev, meta, vals, testers] = await kv.pipe([
    ['GET', k.rev],
    ['GET', k.meta],
    ['HVALS', k.f],
    ['SCARD', k.t],
  ]);
  if (!meta) return fail(404, 'This blitz has expired or was deleted.');
  return json({ rev: Number(rev) || 0, blitz: publicMeta(JSON.parse(meta), testers), findings: parseFindings(vals) });
}

async function readShot(blob, id, fid) {
  const file = PATTERNS.finding.test(fid) ? await blob.get(shotPath(id, fid)) : null;
  if (!file) return new Response('Not found', { status: 404 });
  return new Response(file.stream, {
    headers: { 'Content-Type': 'image/jpeg', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, max-age=86400' },
  });
}

/* ---------- creating and deleting ---------- */

async function create(kv, req) {
  if (await limited(kv, req, 'create', LIMITS.createsPerHour, 3600))
    return fail(429, 'Too many new blitzes from here. Try again in a while.');
  const body = await req.json();
  const b = createBlitz(body);
  const id = randomId(12);
  const key = randomId(24);
  const listed = body.listed === true;
  const meta = {
    product: b.product,
    url: b.url,
    flows: b.flows,
    minutes: b.timer.minutes,
    createdAt: now(),
    ownerHash: await sha256(key),
    listed,
    cap: listed ? clamp(body.cap, RULES.testers.min, RULES.testers.max, RULES.testers.default) : RULES.testers.max,
  };
  const k = keys(id);
  if (!(await kv.cmd('SET', k.meta, JSON.stringify(meta), 'NX', 'EX', LIMITS.ttl))) return fail(409, 'Try again.');
  // The creator takes the first place, in the same write.
  const tester = PATTERNS.tester.test(String(body.tester || '')) ? body.tester : null;
  const rev = await write(kv, id, [...(tester ? [['SADD', k.t, tester]] : []), ...(listed ? [['ZADD', LISTED, Date.now(), id]] : [])]);
  return json({ id, key, rev, blitz: publicMeta(meta, tester ? 1 : 0), findings: [] }, 201);
}

async function remove(kv, blob, req, id) {
  const k = keys(id);
  const [meta, vals] = await kv.pipe([
    ['GET', k.meta],
    ['HVALS', k.f],
  ]);
  if (!meta) return json({ ok: true });
  if (!(await isOwner(req, JSON.parse(meta)))) return fail(403, 'Only whoever set it up can delete it.');
  await blob.del(
    parseFindings(vals)
      .filter((f) => f.shot)
      .map((f) => shotPath(id, f.id)),
  );
  await kv.pipe([
    ['DEL', k.meta, k.f, k.rev, k.t],
    ['ZREM', LISTED, id],
  ]);
  return json({ ok: true });
}

/* ---------- changes: who may make each one, and what it does ---------- */

// auth: 'any' (anyone with the link), 'tester' (joined), 'owner' (the creator's key).
// Each gets { kv, blob, req, id, k, meta, body, found } and returns a Response.
const OPS = {
  join: {
    auth: 'any',
    async run({ kv, id, k, meta, body, member, testers }) {
      if (!PATTERNS.tester.test(String(body.tester || ''))) return fail(400, 'That isn’t a tester id.');
      if (member) return json({ ok: true });
      const cap = meta.cap || RULES.testers.max;
      if (testers >= cap) return fail(409, `This blitz is full: ${cap} testers already joined.`, { full: true });
      return json({ ok: true, rev: await write(kv, id, [['SADD', k.t, body.tester]]) });
    },
  },

  add: {
    auth: 'tester',
    async run({ kv, blob, id, k, body, count }) {
      const raw = body.finding || {};
      if (!PATTERNS.finding.test(String(raw.id || ''))) return fail(400, 'That isn’t a finding id.');
      const clean = cleanFinding({ ...raw, status: 'open', createdAt: now(), updatedAt: null, screenshot: null }, { reporter: 'Someone' });
      if (!clean) return fail(400, 'A finding needs a note.');
      if (count >= LIMITS.findings) return fail(409, `This blitz is full (${LIMITS.findings} findings).`);
      const { screenshot, ...finding } = { ...clean, shot: false };
      if (body.shot) {
        const bytes = jpegBytes(body.shot);
        if (!bytes) return fail(413, 'That screenshot is too big or not a JPEG.');
        await blob.put(shotPath(id, finding.id), bytes);
        finding.shot = true;
      }
      return json({ rev: await write(kv, id, [['HSET', k.f, finding.id, JSON.stringify(finding)]]), finding });
    },
  },

  update: {
    auth: 'tester',
    async run({ kv, id, k, body, found }) {
      const fields = [];
      for (const f of found) {
        if (!f) return fail(404, 'That finding is gone.');
        const next = patchFinding(f, body.patch);
        if (next === f && f.status === 'sent') return fail(409, 'Sent findings are final.');
        if (next !== f) fields.push(f.id, JSON.stringify(next));
      }
      if (!fields.length) return json({ ok: true });
      return json({ rev: await write(kv, id, [['HSET', k.f, ...fields]]) });
    },
  },

  remove: {
    auth: 'tester',
    async run({ kv, blob, id, k, found: [f] }) {
      if (!f) return fail(404, 'That finding is gone.');
      if (!canRemove(f)) return fail(409, 'Only new findings can be removed.');
      if (f.shot) await blob.del([shotPath(id, f.id)]);
      return json({ rev: await write(kv, id, [['HDEL', k.f, f.id]]) });
    },
  },

  unlist: {
    auth: 'owner',
    async run({ kv, id, k, meta }) {
      return json({
        ok: true,
        rev: await write(kv, id, [
          ['SET', k.meta, JSON.stringify({ ...meta, listed: false }), 'EX', LIMITS.ttl],
          ['ZREM', LISTED, id],
        ]),
      });
    },
  },
};

async function change(kv, blob, req, id) {
  if (await limited(kv, req, 'write', LIMITS.writesPerMinute, 60)) return fail(429, 'Slow down a little.');
  const body = await req.json();
  const op = Object.hasOwn(OPS, body.op) ? OPS[body.op] : null;
  if (!op) return fail(400, 'Unknown change.');
  // The findings a change is about: one (fid), or several (fids) for marking a batch as sent.
  const fids = (Array.isArray(body.fids) ? body.fids : body.fid ? [body.fid] : []).map(String).slice(0, LIMITS.findings);
  if (!fids.every((fid) => PATTERNS.finding.test(fid))) return fail(404, 'That finding is gone.');
  const k = keys(id);
  const [meta, member, testers, count, ...rows] = await kv.pipe([
    ['GET', k.meta],
    ['SISMEMBER', k.t, String(body.tester || '')],
    ['SCARD', k.t],
    ['HLEN', k.f],
    ...fids.map((fid) => ['HGET', k.f, fid]),
  ]);
  if (!meta) return fail(404, 'This blitz has expired or was deleted.');
  const parsed = JSON.parse(meta);
  if (op.auth === 'tester' && !member) return fail(403, 'Join the blitz first.');
  if (op.auth === 'owner' && !(await isOwner(req, parsed))) return fail(403, 'Only whoever set it up can do that.');
  const found = rows.map((r) => (r ? JSON.parse(r) : null));
  return op.run({ kv, blob, req, id, k, meta: parsed, body, member: !!member, testers, count, found });
}

/* ---------- the handler ---------- */

/** The API, given its stores. Pure apart from the stores, so the tests run it in memory. */
export async function handle(req, { kv, blob }) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (id !== null && !PATTERNS.room.test(id)) return fail(404, 'Not found.');
  try {
    switch (req.method) {
      case 'GET':
        if (!id) return url.searchParams.has('list') ? await listOpen(kv) : fail(404, 'Not found.');
        if (url.searchParams.has('shot')) return await readShot(blob, id, url.searchParams.get('shot'));
        return await readBlitz(kv, id, url.searchParams.get('rev'));
      case 'POST':
        return id ? await change(kv, blob, req, id) : await create(kv, req);
      case 'DELETE':
        return id ? await remove(kv, blob, req, id) : fail(404, 'Not found.');
      default:
        return fail(405, 'Method not allowed.');
    }
  } catch (err) {
    if (err instanceof SyntaxError) return fail(400, 'Invalid request.');
    if (err instanceof FormError) return fail(400, err.message, { field: err.field });
    console.error('bug-blitz', err);
    return fail(500, 'Something went wrong. Try again.');
  }
}
