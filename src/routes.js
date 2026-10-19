// The app's addresses, in the URL's hash so any static host can serve it.
//
//   #/                         home
//   #/new                      a new blitz
//   #/b/<id>[/triage]          a blitz on this device
//   #/r/<room>[/triage]        a shared blitz
//   #/r/<room>/admin/<key>     the creator's admin link
import { PATTERNS } from './core.js';

export function parseRoute(hash) {
  let parts;
  try {
    parts = String(hash || '')
      .replace(/^#\/?/, '')
      .split('/')
      .filter(Boolean)
      .map(decodeURIComponent);
  } catch {
    return { name: 'home' };
  }
  const [head, a, b, c] = parts;
  const tab = b === 'triage' ? 'triage' : 'test';
  if (head === 'new') return { name: 'new' };
  if (head === 'b' && a) return { name: 'blitz', id: a, tab };
  if (head === 'r' && PATTERNS.room.test(a || '')) {
    if (b === 'admin' && PATTERNS.key.test(c || '')) return { name: 'room', room: a, tab: 'test', key: c };
    return { name: 'room', room: a, tab };
  }
  return { name: 'home' };
}

export function routeHash(route) {
  const tab = route.tab === 'triage' ? '/triage' : '';
  if (route.name === 'new') return '#/new';
  if (route.name === 'blitz') return `#/b/${encodeURIComponent(route.id)}${tab}`;
  if (route.name === 'room') return `#/r/${route.room}${tab}`;
  return '#/';
}

/** The route to a blitz, wherever it lives. */
export const routeFor = (blitz, tab = 'test') =>
  blitz.room ? { name: 'room', room: blitz.room, tab } : { name: 'blitz', id: blitz.id, tab };
