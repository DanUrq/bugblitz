// The app's line to the server (server/handler.js). Every call resolves to { ok, status, data } and
// never throws, so the app can carry on on this device when the server can't be reached.
import { API } from './core.js';

async function call(method, query = '', body = undefined, headers = {}) {
  try {
    const res = await fetch(`${API}${query}`, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: 'Can’t reach the server.' } };
  }
}

const at = (room) => `?id=${encodeURIComponent(room)}`;
const change = (room, tester, body, headers) => call('POST', at(room), { tester, ...body }, headers);

export const createRoom = (setup) => call('POST', '', setup);
export const listRooms = () => call('GET', '?list=1');
export const fetchRoom = (room, rev = 0) => call('GET', `${at(room)}${rev ? `&rev=${rev}` : ''}`);
export const deleteRoom = (room, key) => call('DELETE', at(room), undefined, { 'x-blitz-key': key });

export const joinRoom = (room, tester) => change(room, tester, { op: 'join' });
export const addToRoom = (room, tester, finding, shot) => change(room, tester, { op: 'add', finding, ...(shot ? { shot } : {}) });
export const updateInRoom = (room, tester, fids, patch) => change(room, tester, { op: 'update', fids, patch });
export const removeFromRoom = (room, tester, fid) => change(room, tester, { op: 'remove', fid });
export const unlistRoom = (room, tester, key) => change(room, tester, { op: 'unlist' }, { 'x-blitz-key': key });

/** The link that joins a shared blitz: the app's address plus #/r/<id>. With the creator's key it's
 *  their admin link; the key sits after the #, so browsers never send it to the server. */
export function roomLink(room, key = null, appUrl = typeof location === 'undefined' ? '' : location.href) {
  return `${String(appUrl).split('#')[0]}#/r/${room}${key ? `/admin/${key}` : ''}`;
}
