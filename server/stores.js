// Where shared blitzes are kept: Redis through Upstash's REST API, and screenshots in a private
// Vercel Blob store. Each has an in-memory stand-in with the same shape, for local development
// and the tests.

/** Redis over Upstash's REST API: one command, or several in one round trip. */
export function upstash(url, token, send = fetch) {
  const base = url.replace(/\/$/, '');
  const call = async (path, body) => {
    const res = await send(`${base}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`Redis answered ${res.status}`);
    return res.json();
  };
  return {
    cmd: async (...args) => (await call('', args)).result,
    pipe: async (cmds) =>
      (await call('/pipeline', cmds)).map((r) => {
        if (r.error) throw new Error(r.error);
        return r.result;
      }),
  };
}

/** The Redis commands the handler uses, in memory. Expiry is ignored. */
export function memoryKv() {
  const m = new Map();
  const of = (k, Type) => {
    if (!(m.get(k) instanceof Type)) m.set(k, new Type());
    return m.get(k);
  };
  const run = ([cmd, k, ...a]) => {
    switch (String(cmd).toUpperCase()) {
      case 'GET':
        return typeof m.get(k) === 'string' ? m.get(k) : null;
      case 'SET':
        if (a.includes('NX') && m.has(k)) return null;
        m.set(k, String(a[0]));
        return 'OK';
      case 'INCR': {
        const n = Number(m.get(k) || 0) + 1;
        m.set(k, String(n));
        return n;
      }
      case 'EXPIRE':
        return m.has(k) ? 1 : 0;
      case 'DEL':
        return [k, ...a].filter((x) => m.delete(x)).length;
      case 'HSET': {
        const h = of(k, Map);
        for (let i = 0; i < a.length; i += 2) h.set(a[i], String(a[i + 1]));
        return a.length / 2;
      }
      case 'HGET':
        return m.get(k) instanceof Map ? (m.get(k).get(a[0]) ?? null) : null;
      case 'HDEL':
        return m.get(k) instanceof Map ? a.filter((x) => m.get(k).delete(x)).length : 0;
      case 'HLEN':
        return m.get(k) instanceof Map ? m.get(k).size : 0;
      case 'HVALS':
        return m.get(k) instanceof Map ? [...m.get(k).values()] : [];
      case 'SADD': {
        const set = of(k, Set);
        return a.filter((x) => !set.has(x) && set.add(x)).length;
      }
      case 'SISMEMBER':
        return m.get(k) instanceof Set && m.get(k).has(a[0]) ? 1 : 0;
      case 'SCARD':
        return m.get(k) instanceof Set ? m.get(k).size : 0;
      case 'ZADD':
        of(k, Map).set(a[1], Number(a[0]));
        return 1;
      case 'ZREM':
        return m.get(k) instanceof Map ? a.filter((x) => m.get(k).delete(x)).length : 0;
      case 'ZREVRANGE': {
        const z = m.get(k) instanceof Map ? [...m.get(k).entries()] : [];
        return z
          .sort((x, y) => y[1] - x[1])
          .map(([x]) => x)
          .slice(Number(a[0]), Number(a[1]) + 1);
      }
      default:
        throw new Error(`memoryKv doesn't know ${cmd}`);
    }
  };
  return { cmd: async (...args) => run(args), pipe: async (cmds) => cmds.map(run), m };
}

/** Screenshots in a private Vercel Blob store, read back through the handler. */
export async function vercelBlob() {
  const { put, get, del } = await import('@vercel/blob');
  return {
    put: (path, bytes) => put(path, bytes, { access: 'private', contentType: 'image/jpeg', allowOverwrite: true }),
    get: async (path) => {
      const r = await get(path, { access: 'private' });
      return r?.statusCode === 200 ? { stream: r.stream } : null;
    },
    del: async (paths) => {
      if (paths.length) await del(paths);
    },
  };
}

export function memoryBlob() {
  const m = new Map();
  return {
    put: async (path, bytes) => void m.set(path, bytes),
    get: async (path) => (m.has(path) ? { stream: new Blob([m.get(path)]).stream() } : null),
    del: async (paths) => paths.forEach((p) => m.delete(p)),
    m,
  };
}

let memory = null;

/** The stores the environment provides: Upstash and Blob when they're connected, memory in local
 *  development. A deployment without Redis is a mistake, so it fails rather than forgetting. */
export async function storesFrom(env = process.env) {
  const url = env.UPSTASH_REDIS_KV_REST_API_URL || env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_KV_REST_API_TOKEN || env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    const hasBlob = env.BLOB_STORE_ID || env.BLOB_READ_WRITE_TOKEN;
    return { kv: upstash(url, token), blob: hasBlob ? await vercelBlob() : memoryBlob() };
  }
  if (env.VERCEL_ENV === 'production' || env.VERCEL_ENV === 'preview') throw new Error('No Redis is connected to this deployment.');
  memory ||= { kv: memoryKv(), blob: memoryBlob() };
  return memory;
}
