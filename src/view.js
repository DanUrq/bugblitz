// Bug Blitz, the app. One call mounts it into an element:
//
//   import { mountBugBlitz } from './src/view.js';
//   mountBugBlitz(el, { storageKey, example, className, routing, appUrl, docsUrl });
//
//   storageKey  where this browser keeps its blitzes (default 'bug-blitz')
//   example     the example blitz (default: src/sample.js)
//   className   a class on the app, for theming
//   routing     'hash' puts the view in the address (#/new, #/b/<id>, #/r/<room>); 'memory' keeps
//               it inside, for an embed. Pass appUrl then.
//   appUrl      where the app lives, for invite and admin links (default: this page)
//   docsUrl     a guide to link from the home and the export (default: none)
//
// Three views: home, a new blitz, and a blitz with a Test tab (timer, flows, a note box) and a
// Triage tab (keep or dismiss, how bad, the category, the export). Every change goes through
// core.js. A blitz created while the server is reachable is shared: its link joins anyone to the
// same board, which polls for changes. Without the server it stays on this device.
import {
  SEVERITY_HINTS,
  STATUS_LABELS,
  HEURISTICS,
  STARTER_FLOWS,
  FormError,
  toggleFlow,
  addFinding,
  updateFinding,
  moveFinding,
  removeFinding,
  markKeptSent,
  counts,
  progress,
  hasJoined,
  reporterFor,
  createBlitz,
  newTesterId,
  timeLeft,
  timerRunning,
  startTimer,
  pauseTimer,
  resetTimer,
  clock,
  toMarkdown,
  loadStore,
  saveStore,
  getBlitz,
  getRoom,
  fromRoom,
  putBlitz,
  deleteBlitz,
  resetExample,
} from './core.js';
import {
  createRoom,
  listRooms,
  joinRoom,
  unlistRoom,
  fetchRoom,
  addToRoom,
  updateInRoom,
  removeFromRoom,
  deleteRoom,
  roomLink,
} from './sync.js';
import { parseRoute, routeHash, routeFor } from './routes.js';
import { shrinkImage } from './image.js';
import * as html from './templates.js';
import { SAMPLE } from './sample.js';
import { COPY } from './copy.js';
import { STYLES } from './style.js';

const POLL_MS = 4000;
const IDLE_MS = 5 * 60 * 1000; // stop asking the server once nobody has touched the board for a while
const { esc } = html;

function injectStyle(doc) {
  if (doc.getElementById('bb-style')) return;
  const style = doc.createElement('style');
  style.id = 'bb-style';
  style.textContent = STYLES;
  doc.head.appendChild(style);
}

export function mountBugBlitz(
  root,
  { storageKey = 'bug-blitz', example = SAMPLE, className = '', routing = 'hash', appUrl = null, docsUrl = null } = {},
) {
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  const uid = `bb${Math.random().toString(36).slice(2, 8)}`;
  injectStyle(doc);

  let store = loadStore(storageKey, example);
  let route = routing === 'hash' ? parseRoute(win.location.hash) : { name: 'home' };
  // What's on screen, reset whenever the view changes.
  let filter, shot, justLogged, armed;
  const resetViewState = () => {
    filter = { status: 'all', severity: 'all' };
    shot = null; // the composer's screenshot, a data URL
    justLogged = null;
    armed = null; // a blitz whose Delete has been clicked once
  };
  resetViewState();
  let opening = null; // a shared blitz being fetched: { room, status: 'loading' | 'gone' | 'offline' }
  let toastTimer = 0;
  let tickTimer = 0;
  let lastActive = Date.now();
  let polling = false;
  let redrawPending = false;

  root.innerHTML = html.frame(className);
  const viewEl = root.querySelector('.bb-view');
  const toastEl = root.querySelector('.bb-toast');
  const $ = (sel) => viewEl.querySelector(sel);
  const current = () => (route.name === 'blitz' ? getBlitz(store, route.id) : route.name === 'room' ? getRoom(store, route.room) : null);
  const inviteLink = (room, key) => roomLink(room, key, appUrl || win.location.href);

  /* ---------- saving, and telling the person ---------- */

  function say(text, { error = false, ms = 6000 } = {}) {
    clearTimeout(toastTimer);
    toastEl.classList.toggle('err', error);
    toastEl.innerHTML = text;
    toastEl.classList.toggle('on', !!text);
    if (ms) toastTimer = setTimeout(() => toastEl.classList.remove('on'), ms);
  }

  /** Keeps the store. When the browser refuses (it's full), says so and changes nothing. */
  function save(next, failure = 'Your browser wouldn’t save that. Its storage for this site may be full.') {
    if (!saveStore(storageKey, next)) {
      say(failure, { error: true, ms: 0 });
      return false;
    }
    store = next;
    return true;
  }
  const commit = (blitz, failure) => save(putBlitz(store, blitz), failure);

  /** Applies a change here and, on a shared blitz, sends it on. A refusal from the server is shown,
   *  and the next poll brings back the server's version. */
  function apply(next, request) {
    if (!commit(next)) return false;
    if (next.room && request) {
      request().then((res) => {
        if (!res.ok) say(esc(res.data.error || 'That didn’t reach the others.'), { error: true });
        poll();
      });
    }
    return true;
  }

  /* ---------- routes ---------- */

  function go(next, { replace = false } = {}) {
    const sameView = next.name === route.name && next.id === route.id && next.room === route.room;
    route = next;
    if (!sameView) resetViewState();
    if (routing === 'hash') {
      const hash = routeHash(next);
      if (win.location.hash !== hash) win.history[replace ? 'replaceState' : 'pushState'](null, '', hash);
    }
    enter();
    if (sameView) return;
    const top = root.getBoundingClientRect().top;
    if (routing === 'hash' && top < 0) win.scrollTo({ top: win.scrollY + top });
    if (routing !== 'hash') root.scrollTo?.({ top: 0 });
    const heading = $('h1');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }

  const onPop = () => {
    route = parseRoute(win.location.hash);
    resetViewState();
    enter();
  };

  /** Arriving at a route: what it needs from the server or the address, then draw it. */
  function enter() {
    if (route.name === 'room' && route.key && current()) {
      // An admin link: the key goes into this device's copy and out of the address bar.
      commit({ ...current(), key: route.key, keySaved: true });
      route = { name: 'room', room: route.room, tab: 'test' };
      if (routing === 'hash') win.history.replaceState(null, '', routeHash(route));
      say('Admin link opened: you can manage this blitz from here.', { ms: 4000 });
    }
    render();
    if (route.name === 'home') loadOpenList();
    if (route.name === 'room' && !current() && opening?.room !== route.room) openRoom(route.room);
    if (route.name === 'room' && current()) poll(true);
  }

  /* ---------- drawing ---------- */

  function render() {
    clearInterval(tickTimer);
    const b = current();
    if (route.name === 'blitz' && !b) route = { name: 'home' };
    if (route.name === 'new') viewEl.innerHTML = html.newView(uid);
    else if (route.name === 'room' && !b) viewEl.innerHTML = html.openingView(opening?.room === route.room ? opening.status : 'loading');
    else if (route.name === 'room' && !hasJoined(b, store.me)) viewEl.innerHTML = html.joinView(b, store.me);
    else if (b) {
      viewEl.innerHTML = html.blitzView(b, { tab: route.tab, uid });
      renderParts();
      tick();
    } else viewEl.innerHTML = html.homeView({ blitzes: store.blitzes, uid, docsUrl, newTab: routing !== 'hash' });
  }

  /** Redraws what changes inside a blitz, keeping focus on the control it was on. */
  function renderParts() {
    const b = current();
    if (!b || !$('.bb-tabs')) return;
    redrawPending = false;
    const focused = doc.activeElement;
    const focusKey =
      focused && viewEl.contains(focused) ? ['data-flow', 'data-status', 'data-id'].find((a) => focused.closest(`[${a}]`)) : null;
    const focusValue = focusKey && focused.closest(`[${focusKey}]`).getAttribute(focusKey);

    const open = counts(b.findings).open;
    $('.bb-count-open').textContent = open ? String(open) : '';
    if (route.tab === 'test') {
      const p = progress(b);
      $('.bb-count').textContent = `${p.done} of ${p.total}`;
      $('.bb-meter').setAttribute('aria-valuenow', String(p.pct));
      $('.bb-meter i').style.width = `${p.pct}%`;
      $('.bb-flows ol').innerHTML = html.flowList(b);
      $('.bb-feed ul').innerHTML = html.feed(b, justLogged);
      showSeverityHint();
      showShot();
    } else {
      $('.bb-chips').innerHTML = html.statusChips(b, filter.status);
      $('[data-change="filter-severity"]').value = filter.severity;
      const kept = counts(b.findings).triaged;
      const markSent = $('.bb-mark-sent');
      markSent.hidden = !kept;
      markSent.textContent = `Mark ${kept} kept as sent`;
      $('.bb-board').innerHTML = html.board(b, filter, justLogged);
    }
    if (focusKey) $(`[${focusKey}="${CSS.escape(focusValue)}"]`)?.focus({ preventScroll: true });
  }

  /* ---------- the timer ---------- */

  function tick() {
    clearInterval(tickTimer);
    let b = current();
    const clockEl = $('.bb-clock');
    if (!b || !clockEl) return;
    if (timerRunning(b) && timeLeft(b) <= 0) {
      b = pauseTimer(b);
      commit(b);
      say(esc(COPY.timeUp), { ms: 0 });
    }
    const left = timeLeft(b);
    const running = timerRunning(b);
    clockEl.textContent = clock(left);
    clockEl.classList.toggle('done', left <= 0);
    const button = $('.bb-go');
    button.textContent = running ? 'Pause' : left <= 0 ? 'Time’s up' : b.timer.spent ? 'Resume' : `Start ${b.timer.minutes} minutes`;
    button.disabled = !running && left <= 0;
    button.classList.toggle('solid', !running && left > 0);
    if (running) tickTimer = setInterval(tick, 1000);
  }

  /* ---------- the composer ---------- */

  function showShot() {
    const box = $('.bb-shot');
    if (!box) return;
    box.hidden = !shot;
    const img = box.querySelector('img');
    if (img.getAttribute('src') !== (shot || '')) img.setAttribute('src', shot || '');
    $('.bb-attach').textContent = shot ? 'Replace screenshot' : 'Screenshot';
  }

  function showSeverityHint() {
    const picked = $('input[name="severity"]:checked');
    if (picked) $('.bb-why').textContent = SEVERITY_HINTS[picked.value];
  }

  async function takeImage(file) {
    if (!file || !$('.bb-compose')) return;
    try {
      shot = await shrinkImage(file);
      showShot();
      say('Screenshot attached.', { ms: 2500 });
    } catch (err) {
      say(esc(err.message), { error: true });
    }
  }

  /* ---------- the server: shared blitzes ---------- */

  async function openRoom(room) {
    opening = { room, status: 'loading' };
    const res = await fetchRoom(room);
    if (route.name !== 'room' || route.room !== room) return;
    if (res.ok && res.data.blitz) {
      opening = null;
      save(putBlitz(store, fromRoom(getRoom(store, room), room, res.data)));
    } else opening = { room, status: res.status === 404 ? 'gone' : 'offline' };
    render();
    if (!opening) $('input[name="me"]')?.focus();
  }

  async function loadOpenList() {
    const res = await listRooms();
    const box = route.name === 'home' && $('.bb-open-list');
    if (!box || !res.ok || !res.data.open?.length) return;
    box.querySelector('ul').innerHTML = html.openList(res.data.open);
    box.hidden = false;
  }

  /** Asks the server whether anything changed (one cheap request when nothing has). */
  async function poll(force = false) {
    const b = current();
    if (!b?.room || polling) return;
    if (!force && (doc.visibilityState === 'hidden' || Date.now() - lastActive > IDLE_MS)) return;
    polling = true;
    const res = await fetchRoom(b.room, force ? 0 : b.rev);
    polling = false;
    const latest = getRoom(store, b.room);
    if (!latest) return;
    if (res.status === 404) {
      if (!latest.gone && commit({ ...latest, gone: true }))
        say('This blitz was deleted or has expired. What you see here is the last copy.', { error: true, ms: 0 });
      return;
    }
    if (!res.ok || res.data.same) return;
    commit(fromRoom(latest, b.room, res.data));
    if (current()?.room !== b.room || !$('.bb-tabs')) return;
    // Someone mid-choice in a menu: redraw once they've chosen (see the focusout listener).
    if (doc.activeElement?.tagName === 'SELECT' && viewEl.contains(doc.activeElement)) redrawPending = true;
    else renderParts();
  }

  /* ---------- forms ---------- */

  function submitFinding(form) {
    const b = current();
    const note = form.querySelector('.bb-note');
    const severity = form.querySelector('input[name="severity"]:checked')?.value;
    let added;
    try {
      added = addFinding(b, { note: note.value, severity, screenshot: shot, reporter: reporterFor(b, store.me) });
    } catch (err) {
      say(esc(err.message), { error: true, ms: 3000 });
      note.focus();
      return;
    }
    const { blitz, finding } = added;
    const sent = { id: finding.id, note: finding.note, severity: finding.severity, reporter: finding.reporter };
    if (!apply(blitz, () => addToRoom(b.room, b.tester, sent, finding.screenshot))) return;
    justLogged = finding.id;
    shot = null;
    form.reset();
    renderParts();
    say(`Logged. <button type="button" data-action="undo" data-id="${esc(finding.id)}">Undo</button>`);
    note.focus();
  }

  async function submitNew(form) {
    const err = form.querySelector('.bb-err');
    const fields = form.elements;
    const setup = { product: fields.product.value, url: fields.url.value, flows: fields.flows.value, minutes: fields.minutes.value };
    let local;
    try {
      local = createBlitz(setup); // checks the form before anything goes to the server
    } catch (e) {
      if (!(e instanceof FormError)) throw e;
      err.textContent = e.message;
      fields[e.field]?.focus();
      return;
    }
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    button.textContent = 'Creating…';
    const listed = fields.access.value === 'open';
    const tester = newTesterId();
    const res = await createRoom({ ...setup, flows: local.flows.map((f) => f.label), listed, cap: Number(fields.cap.value), tester });
    if (res.ok) {
      const shared = { ...fromRoom(null, res.data.id, res.data), key: res.data.key, tester, joined: true };
      if (save(putBlitz(store, shared))) {
        go(routeFor(shared));
        say('Ready. Copy the invite link for your testers, then start the timer.', { ms: 5000 });
      }
      return;
    }
    if (res.status >= 400 && res.status < 500) {
      button.disabled = false;
      button.textContent = 'Create blitz';
      err.textContent = res.data.error || 'That didn’t work.';
      return;
    }
    // No server (offline, or the app running without one): the blitz stays on this device.
    if (save(putBlitz(store, local))) {
      go(routeFor(local));
      say('Couldn’t reach the server, so this blitz is on this device only.', { ms: 6000 });
    }
  }

  async function submitJoin(form) {
    const err = form.querySelector('.bb-err');
    const name = form.elements.me.value.trim();
    if (!name) {
      err.textContent = 'Add a name first.';
      form.elements.me.focus();
      return;
    }
    if (!save({ ...store, me: name })) return;
    const b = current();
    if (b?.room && !b.joined) {
      const tester = b.tester || newTesterId();
      const button = form.querySelector('[type="submit"]');
      button.disabled = true;
      const res = await joinRoom(b.room, tester);
      button.disabled = false;
      if (!res.ok) {
        err.textContent = res.data.error || 'Couldn’t join. Try again.';
        return;
      }
      commit({ ...current(), tester, joined: true });
    }
    render();
    say(`You’re in, ${esc(name)}. Start the timer when you’re ready.`, { ms: 4000 });
  }

  async function copy(text, done, fallback) {
    try {
      await win.navigator.clipboard.writeText(text);
      say(done);
    } catch {
      say(fallback, { ms: 0 });
    }
  }

  function exportBlitz(b) {
    const origin = /^https?:/.test(win.location.origin) ? win.location.origin : new URL(appUrl || 'https://localhost').origin;
    const md = toMarkdown(b, { origin });
    const skill = docsUrl ? `the <a href="${esc(docsUrl)}" target="_blank" rel="noopener">Bug Blitz skill</a>` : 'the Bug Blitz skill';
    win.navigator.clipboard.writeText(md).then(
      () => say(`Copied. Paste it into Claude with ${skill} to file tickets, or into a doc.`, { ms: 9000 }),
      () => {
        // No clipboard (an insecure page, or permission refused): download it instead.
        const a = doc.createElement('a');
        a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
        a.download = `bug-blitz-${
          b.product
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'export'
        }.md`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        say('Downloaded as Markdown.');
      },
    );
  }

  async function removeBlitz(b, button) {
    const label = html.removeLabel(b);
    if (armed !== b.id) {
      armed = b.id;
      button.textContent = `${label.split(' ')[0]}? Click again`;
      setTimeout(() => {
        if (armed === b.id && button.isConnected) {
          armed = null;
          button.textContent = label;
        }
      }, 3500);
      return;
    }
    armed = null;
    if (b.example) {
      if (save(resetExample(store, example))) {
        shot = null;
        render();
        say('The example is back as it started.', { ms: 3000 });
      }
      return;
    }
    if (b.room && b.key) {
      button.disabled = true;
      const res = await deleteRoom(b.room, b.key);
      if (!res.ok) {
        button.disabled = false;
        button.textContent = label;
        say(esc(res.data.error || 'Couldn’t delete it. Try again.'), { error: true });
        return;
      }
    }
    if (save(deleteBlitz(store, b.id))) {
      go({ name: 'home' });
      say(b.room && !b.key ? 'Left. The invite link still works if you want back in.' : 'Deleted, for everyone.', { ms: 3500 });
    }
  }

  /* ---------- actions: each control names one with data-action ---------- */

  const actions = {
    go: (el) => go({ name: el.dataset.to }),
    open: (el) => {
      const b = getBlitz(store, el.dataset.id);
      if (b) go(routeFor(b));
    },
    'open-room': (el) => go({ name: 'room', room: el.dataset.room, tab: 'test' }),
    retry: () => {
      opening = null;
      enter();
    },
    tab: (el) => go({ ...route, tab: el.dataset.tab }, { replace: true }),
    starter: () => {
      const area = $('textarea[name="flows"]');
      const have = area.value
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      area.value = [...have, ...STARTER_FLOWS.filter((f) => !have.includes(f))].join('\n');
      area.focus();
    },
    share: (el, b) => {
      const link = inviteLink(b.room);
      copy(link, `Invite link copied. Send it to your testers.`, `Send your testers this link: ${esc(link)}`);
    },
    'copy-admin': (el, b) => {
      const link = inviteLink(b.room, b.key);
      copy(link, 'Admin link copied. Bookmark it or send it to yourself.', `Your admin link: ${esc(link)}`);
      if (!b.keySaved && commit({ ...b, keySaved: true })) render();
    },
    'keep-done': (el, b) => commit({ ...b, keySaved: true }) && render(),
    unlist: async (el, b) => {
      const res = await unlistRoom(b.room, b.tester, b.key);
      if (!res.ok) return say(esc(res.data.error || 'Couldn’t unlist it.'), { error: true });
      if (commit({ ...b, listed: false })) render();
      say('Unlisted. It’s private now: only people with the link can get in.', { ms: 4000 });
    },
    export: (el, b) => exportBlitz(b),
    remove: (el, b) => removeBlitz(b, el),
    timer: (el, b) => commit(timerRunning(b) ? pauseTimer(b) : startTimer(b)) && tick(),
    'timer-reset': (el, b) => {
      if (commit(resetTimer(b))) say('', { ms: 1 });
      tick();
    },
    flow: (el, b) => commit(toggleFlow(b, el.dataset.flow)) && renderParts(),
    attach: () => $('[data-change="file"]').click(),
    unshot: () => {
      shot = null;
      showShot();
      $('.bb-note').focus();
    },
    undo: (el, b) => {
      const fid = el.dataset.id;
      if (!apply(removeFinding(b, fid), () => removeFromRoom(b.room, b.tester, fid))) return;
      justLogged = null;
      renderParts();
      say('Removed.', { ms: 2500 });
    },
    'status-filter': (el) => {
      filter = { ...filter, status: el.dataset.status };
      justLogged = null;
      renderParts();
    },
    thumb: (el) => {
      const bigger = el.getAttribute('aria-expanded') !== 'true';
      el.setAttribute('aria-expanded', String(bigger));
      el.setAttribute('aria-label', bigger ? 'Screenshot: show it smaller' : 'Screenshot: show it larger');
    },
    move: (el, b) => {
      const fid = el.closest('[data-id]').dataset.id;
      const to = el.dataset.to;
      if (!apply(moveFinding(b, fid, to), () => updateInRoom(b.room, b.tester, [fid], { status: to }))) return;
      justLogged = null;
      renderParts();
      say(to === 'open' ? 'Back to new.' : `${STATUS_LABELS[to]}.`, { ms: 2000 });
    },
    'mark-sent': (el, b) => {
      const { blitz, ids } = markKeptSent(b);
      if (!apply(blitz, () => updateInRoom(b.room, b.tester, ids, { status: 'sent' }))) return;
      renderParts();
      say(`${ids.length} marked as sent. They’re final now.`, { ms: 3000 });
    },
  };

  // Inputs and selects: data-change names the handler.
  const changes = {
    access: (el) => ($('.bb-capfield').hidden = el.value !== 'open'),
    'severity-hint': () => showSeverityHint(),
    file: (el) => {
      takeImage(el.files?.[0]);
      el.value = '';
    },
    'filter-severity': (el) => {
      filter = { ...filter, severity: el.value };
      justLogged = null;
      renderParts();
    },
    severity: (el, b) => patchCard(el, b, { severity: el.value }),
    category: (el, b) => {
      if (patchCard(el, b, { heuristic: el.value })) say(`Filed under ${esc(HEURISTICS[el.value].label)}.`, { ms: 2500 });
    },
  };

  function patchCard(el, b, patch) {
    const fid = el.closest('[data-id]').dataset.id;
    if (!apply(updateFinding(b, fid, patch), () => updateInRoom(b.room, b.tester, [fid], patch))) return false;
    justLogged = null;
    renderParts();
    return true;
  }

  /* ---------- events ---------- */

  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || !root.contains(el)) return;
    if (el.tagName === 'A') e.preventDefault();
    actions[el.dataset.action]?.(el, current());
  });

  root.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]');
    if (el) changes[el.dataset.change]?.(el, current());
  });

  root.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = { finding: submitFinding, new: submitNew, join: submitJoin }[e.target.dataset.form];
    form?.(e.target);
  });

  root.addEventListener('keydown', (e) => {
    lastActive = Date.now();
    // Enter logs a finding; Shift+Enter is a new line.
    if (e.target.classList.contains('bb-note') && e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      submitFinding(e.target.form);
    }
  });

  // A redraw held back while a menu was open happens once the menu closes.
  root.addEventListener('focusout', () => setTimeout(() => redrawPending && doc.activeElement?.tagName !== 'SELECT' && renderParts()));

  root.addEventListener('dragover', (e) => {
    const drop = e.target.closest?.('.bb-drop');
    if (drop && e.dataTransfer?.types.includes('Files')) {
      e.preventDefault();
      drop.classList.add('over');
    }
  });
  root.addEventListener('dragleave', (e) => e.target.closest?.('.bb-drop')?.classList.remove('over'));
  root.addEventListener('drop', (e) => {
    const drop = e.target.closest?.('.bb-drop');
    if (!drop) return;
    drop.classList.remove('over');
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      e.preventDefault();
      takeImage(file);
    }
  });

  // Paste an image while the app has focus (or nothing else does): it becomes the screenshot.
  const onPaste = (e) => {
    const active = doc.activeElement;
    if (!(root.contains(active) || active === doc.body) || !$('.bb-compose')) return;
    const file = [...(e.clipboardData?.items || [])].find((i) => i.kind === 'file' && i.type.startsWith('image/'))?.getAsFile();
    if (file) {
      e.preventDefault();
      takeImage(file);
    }
  };

  // Another tab with the app open changed the store: take its version, unless someone's typing here.
  const onStorage = (e) => {
    if (e.key !== storageKey) return;
    store = loadStore(storageKey, example);
    const typing = [...viewEl.querySelectorAll('textarea, input[type="text"], input:not([type])')].some((i) => i.value);
    if (!typing) render();
  };

  const onPointer = () => {
    const wasIdle = Date.now() - lastActive > IDLE_MS;
    lastActive = Date.now();
    if (wasIdle) poll();
  };
  const onVisible = () => {
    if (doc.visibilityState !== 'visible') return;
    lastActive = Date.now();
    poll();
  };
  const pollTimer = setInterval(() => (redrawPending ? null : poll()), POLL_MS);

  root.addEventListener('pointerdown', onPointer);
  doc.addEventListener('paste', onPaste);
  doc.addEventListener('visibilitychange', onVisible);
  win.addEventListener('storage', onStorage);
  if (routing === 'hash') win.addEventListener('popstate', onPop);

  enter();
  if (routing === 'hash' && route.name === 'home' && win.location.hash && win.location.hash !== '#/')
    win.history.replaceState(null, '', '#/');

  return {
    go,
    destroy() {
      clearTimeout(toastTimer);
      clearInterval(tickTimer);
      clearInterval(pollTimer);
      doc.removeEventListener('paste', onPaste);
      doc.removeEventListener('visibilitychange', onVisible);
      win.removeEventListener('storage', onStorage);
      win.removeEventListener('popstate', onPop);
      root.innerHTML = '';
    },
  };
}
