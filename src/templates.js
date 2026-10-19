// The app's HTML, as pure functions of what's on screen. Controls carry data-action (clicks) or
// data-change (inputs); view.js looks those up. Everything that came from a person is escaped.
import {
  HEURISTICS,
  SORTABLE_HEURISTICS,
  DEFAULT_HEURISTIC,
  SEVERITIES,
  DEFAULT_SEVERITY,
  SEVERITY_LABELS,
  STATUSES,
  STATUS_LABELS,
  LIMITS,
  STARTER_FLOWS,
  progress,
  counts,
  filterFindings,
  byHeuristic,
  ago,
} from './core.js';
import { routeHash, routeFor } from './routes.js';
import { COPY } from './copy.js';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const svg = (viewBox, body, width = 1.6) =>
  `<svg viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  bug: svg(
    '0 0 24 24',
    '<path d="M9 6.5a3 3 0 0 1 6 0"/><rect x="7" y="8" width="10" height="12" rx="5"/><path d="M12 11v9M7 13H3.5M17 13h3.5M7.5 17.5l-3 2M16.5 17.5l3 2M7.5 9.5l-3-2M16.5 9.5l3-2"/>',
  ),
  tick: svg('0 0 12 12', '<path d="M2.5 6.5l2.3 2.3L9.5 3.8"/>', 1.8),
};

const back = '<a class="bb-back" href="#/" data-action="go" data-to="home">← All blitzes</a>';
const tag = (text, extra = '') => `<span class="bb-tag bb-mono${extra}">${text}</span>`;

/* ---------- the frame ---------- */

export const frame = (className) => `<div class="bb-app ${esc(className)}">
  <header class="bb-top">
    <a class="bb-brand" href="#/" data-action="go" data-to="home"><span class="bb-mark">${ICONS.bug}</span>${esc(COPY.name)}</a>
    <span class="bb-mono">${esc(COPY.tagline)}</span>
  </header>
  <div class="bb-view"></div>
  <div class="bb-toast" role="status" aria-live="polite"></div>
</div>`;

/* ---------- home ---------- */

function summary(b) {
  const p = progress(b);
  const c = counts(b.findings);
  return `${p.done} of ${plural(p.total, 'flow')} · ${plural(c.all, 'finding')}${c.open ? ` · ${c.open} to triage` : ''}`;
}

function blitzRow(b) {
  const kind = b.example ? tag('Example') : b.room ? tag(b.listed ? 'Open' : 'Private') : '';
  return `<li><a href="${routeHash(routeFor(b))}" data-action="open" data-id="${esc(b.id)}"><b>${esc(b.product)} ${kind}</b><span class="bb-mono">${summary(b)}</span></a></li>`;
}

export function homeView({ blitzes, uid, docsUrl, newTab }) {
  const example = blitzes.find((b) => b.example);
  return `<section class="bb-home">
  <div class="bb-hero">
    <h1>${esc(COPY.title)}</h1>
    <p class="bb-lead">${esc(COPY.lead)}</p>
    <div class="bb-ctas">
      <a class="bb-btn solid big" href="#/new" data-action="go" data-to="new">${esc(COPY.start)}</a>
      ${example ? `<a class="bb-btn big" href="${routeHash(routeFor(example))}" data-action="open" data-id="${esc(example.id)}">${esc(COPY.example)}</a>` : ''}
    </div>
  </div>
  ${blitzes.length ? `<section class="bb-sec" aria-labelledby="${uid}-yours"><h2 id="${uid}-yours" class="bb-h">${esc(COPY.yours)}</h2><ul class="bb-rows">${blitzes.map(blitzRow).join('')}</ul></section>` : ''}
  <section class="bb-sec bb-open-list" aria-labelledby="${uid}-open" hidden><h2 id="${uid}-open" class="bb-h">${esc(COPY.openList)}</h2><ul class="bb-rows"></ul></section>
  <section class="bb-sec" aria-labelledby="${uid}-how"><h2 id="${uid}-how" class="bb-h">${esc(COPY.howTitle)}</h2>
    <ol class="bb-steps">${COPY.steps.map(([title, text], i) => `<li class="bb-panel"><span class="bb-mono">${i + 1}</span><b>${esc(title)}</b><p>${esc(text)}</p></li>`).join('')}</ol>
    ${docsUrl ? `<p class="bb-more"><a href="${esc(docsUrl)}"${newTab ? ' target="_blank" rel="noopener"' : ''}>${esc(COPY.guide)}</a></p>` : ''}
  </section>
  <details class="bb-sec bb-panel bb-ref">
    <summary><span class="bb-h">${esc(COPY.heuristicsTitle)}</span><span class="bb-plus" aria-hidden="true">+</span></summary>
    <p>${esc(COPY.heuristicsIntro)}</p>
    <dl>${SORTABLE_HEURISTICS.map((k) => `<div><dt>${esc(HEURISTICS[k].label)} <span class="bb-mono">${esc(HEURISTICS[k].nielsen)}</span></dt><dd>${esc(HEURISTICS[k].hint)}</dd></div>`).join('')}</dl>
  </details>
  <p class="bb-note-s">${esc(COPY.local)}</p>
</section>`;
}

export function openList(open) {
  return open
    .map((o) => {
      const full = o.testers >= o.cap;
      const places = full ? 'full' : `${o.testers} of ${o.cap} testers · Join →`;
      return `<li><a href="${routeHash({ name: 'room', room: o.id })}" data-action="open-room" data-room="${esc(o.id)}"><b>${esc(o.product)}</b><span class="bb-mono">${plural(o.flows, 'flow')} · ${o.minutes} min · ${places}</span></a></li>`;
    })
    .join('');
}

/* ---------- opening and joining a shared blitz ---------- */

const OPENING = {
  loading: { title: 'Opening the blitz…' },
  gone: {
    title: 'This blitz has gone.',
    lead: 'Shared blitzes delete themselves seven days after the last change, or when whoever set it up deletes them.',
    home: 'Start your own',
  },
  offline: { title: 'Can’t reach the blitz.', lead: 'Check your connection and try again.', home: 'Home', retry: true },
};

export function openingView(status) {
  const o = OPENING[status] || OPENING.loading;
  const actions = o.home
    ? `<div class="bb-ctas">${o.retry ? '<button type="button" class="bb-btn solid big" data-action="retry">Try again</button>' : ''}<a class="bb-btn big" href="#/" data-action="go" data-to="home">${o.home}</a></div>`
    : '';
  return `<section class="bb-new"><h1>${esc(o.title)}</h1>${o.lead ? `<p class="bb-lead">${esc(o.lead)}</p>` : ''}${actions}</section>`;
}

export function joinView(b, me) {
  const open = b.listed ? ` An open blitz: ${b.testers} of ${b.cap} testers so far.` : '';
  return `<section class="bb-new">
  ${back}
  <h1>${b.key ? `One thing before ${esc(b.product)}` : `Join the blitz on ${esc(b.product)}`}</h1>
  <p class="bb-lead">${plural(b.flows.length, 'flow')} to walk, ${b.timer.minutes} minutes each.${open} Add your name so the team knows who logged what.</p>
  <form class="bb-panel bb-form" data-form="join" novalidate>
    <label class="bb-field"><span>Your name</span><input class="bb-input" name="me" maxlength="${LIMITS.name}" autocomplete="given-name" placeholder="First name is fine" value="${esc(me)}" required></label>
    <p class="bb-err" role="alert"></p>
    <div class="bb-ctas"><button type="submit" class="bb-btn solid big">${b.key ? 'Continue' : 'Join'}</button></div>
  </form>
</section>`;
}

/* ---------- a new blitz ---------- */

export function newView(uid) {
  const { minutes, testers } = LIMITS;
  return `<section class="bb-new">
  ${back}
  <h1>${esc(COPY.newTitle)}</h1>
  <p class="bb-lead">${esc(COPY.newLead)}</p>
  <form class="bb-panel bb-form" data-form="new" novalidate>
    <label class="bb-field"><span>Product</span><input class="bb-input" name="product" maxlength="${LIMITS.product}" autocomplete="off" placeholder="What are you testing?" required></label>
    <label class="bb-field"><span>Link to the build <i>optional</i></span><input class="bb-input" name="url" inputmode="url" autocomplete="off" placeholder="staging.example.com"></label>
    <div class="bb-field">
      <label for="${uid}-flows"><span>Flows to walk, one per line</span></label>
      <textarea class="bb-input" id="${uid}-flows" name="flows" rows="6" placeholder="${esc(STARTER_FLOWS.slice(0, 3).join('\n'))}"></textarea>
      <button type="button" class="bb-link" data-action="starter">Use starter flows</button>
    </div>
    <label class="bb-field bb-num"><span>Minutes per tester</span><input class="bb-input" name="minutes" type="number" min="${minutes.min}" max="${minutes.max}" step="5" value="${minutes.default}"></label>
    <fieldset class="bb-field bb-access"><legend>Who can join</legend>
      <label class="bb-choice"><input type="radio" name="access" value="private" data-change="access" checked><span><b>Private</b>Only people you send the link to. Not listed anywhere.</span></label>
      <label class="bb-choice"><input type="radio" name="access" value="open" data-change="access"><span><b>Open</b>Listed on Bug Blitz for anyone to join, up to a number of testers.</span></label>
    </fieldset>
    <label class="bb-field bb-num bb-capfield" hidden><span>Testers, at most</span><input class="bb-input" name="cap" type="number" min="${testers.min}" max="${testers.max}" value="${testers.default}"></label>
    <p class="bb-err" role="alert"></p>
    <div class="bb-ctas"><button type="submit" class="bb-btn solid big">Create blitz</button><a class="bb-btn big" href="#/" data-action="go" data-to="home">Cancel</a></div>
  </form>
</section>`;
}

/* ---------- a blitz ---------- */

export const removeLabel = (b) => (b.example ? 'Reset example' : b.room && !b.key ? 'Leave' : 'Delete');

function liveTag(b) {
  if (!b.room) return b.example ? tag('Example, made up') : '';
  return tag(`<i></i>${b.listed ? `Open, ${b.testers} of ${b.cap} testers` : 'Private, live'}`, ' bb-live-tag');
}

export function blitzView(b, { tab, uid }) {
  const tools = [
    b.room && '<button type="button" class="bb-btn solid" data-action="share">Copy invite link</button>',
    b.room && b.listed && b.key && '<button type="button" class="bb-btn" data-action="unlist">Unlist</button>',
    b.room && b.key && b.keySaved && '<button type="button" class="bb-btn" data-action="copy-admin">Admin link</button>',
    b.url && `<a class="bb-btn" href="${esc(b.url)}" target="_blank" rel="noopener noreferrer">Open the build ↗</a>`,
    '<button type="button" class="bb-btn" data-action="export">Export</button>',
    `<button type="button" class="bb-btn" data-action="remove">${removeLabel(b)}</button>`,
  ].filter(Boolean);
  const keep =
    b.room && b.key && !b.keySaved
      ? `<div class="bb-panel bb-keep">
    <div><b>Save your admin link.</b><p>It’s how you manage this blitz from another device, or after clearing this browser. Keep it to yourself: the invite link is for testers.</p></div>
    <div class="bb-ctas"><button type="button" class="bb-btn solid" data-action="copy-admin">Copy admin link</button><button type="button" class="bb-link" data-action="keep-done">Done</button></div>
  </div>`
      : '';
  return `<section class="bb-blitz">
  ${back}
  <div class="bb-blitz-head">
    <div class="bb-title"><h1>${esc(b.product)}</h1>${liveTag(b)}</div>
    <div class="bb-tools">${tools.join('')}</div>
  </div>
  ${keep}
  <div class="bb-tabs" role="tablist" aria-label="Blitz">
    <button type="button" role="tab" class="bb-tab" data-action="tab" data-tab="test" aria-selected="${tab === 'test'}">Test</button>
    <button type="button" role="tab" class="bb-tab" data-action="tab" data-tab="triage" aria-selected="${tab === 'triage'}">Triage <b class="bb-count-open"></b></button>
  </div>
  ${tab === 'test' ? testView(uid) : triageView()}
</section>`;
}

function testView(uid) {
  return `<div class="bb-layout" role="tabpanel">
  <aside class="bb-side">
    <div class="bb-panel bb-timer">
      <div class="bb-clock"></div>
      <div class="bb-timer-btns"><button type="button" class="bb-btn bb-go" data-action="timer"></button><button type="button" class="bb-link" data-action="timer-reset">Reset</button></div>
    </div>
    <div class="bb-panel bb-flows">
      <div class="bb-head"><h3 id="${uid}-flows">Flows</h3><span class="bb-mono bb-count"></span></div>
      <div class="bb-meter" role="progressbar" aria-labelledby="${uid}-flows" aria-valuemin="0" aria-valuemax="100"><i></i></div>
      <ol></ol>
      <p>Think aloud: what you’re trying to do, what you expect, what happens.</p>
    </div>
  </aside>
  <div class="bb-main">
    <form class="bb-panel bb-compose" data-form="finding" novalidate>
      <label class="bb-note-l" for="${uid}-note">What’s wrong?</label>
      <div class="bb-drop">
        <textarea class="bb-note" id="${uid}-note" rows="3" maxlength="${LIMITS.note}" placeholder="What you did, what you expected, what happened." aria-describedby="${uid}-hint"></textarea>
        <div class="bb-shot" hidden><img alt="Screenshot to attach"><button type="button" class="bb-chip" data-action="unshot">Remove</button></div>
      </div>
      <p class="bb-hint" id="${uid}-hint">Enter logs it, Shift+Enter for a new line. Paste or drop a screenshot on the box.</p>
      <div class="bb-fields">
        <div class="bb-field" role="radiogroup" aria-label="How bad is it?"><span aria-hidden="true">How bad is it?</span>
          <div class="bb-seg">${SEVERITIES.map((s) => `<label><input type="radio" name="severity" value="${s}" data-change="severity-hint"${s === DEFAULT_SEVERITY ? ' checked' : ''}><span><i class="bb-dot ${s}"></i>${SEVERITY_LABELS[s]}</span></label>`).join('')}</div>
        </div>
        <div class="bb-compose-end">
          <button type="button" class="bb-btn bb-attach" data-action="attach">Screenshot</button>
          <button type="submit" class="bb-btn solid">Log finding</button>
        </div>
      </div>
      <p class="bb-why"></p>
      <input type="file" accept="image/*" data-change="file" hidden>
    </form>
    <section class="bb-feed" aria-labelledby="${uid}-feed">
      <div class="bb-head"><h3 id="${uid}-feed">Logged</h3><button type="button" class="bb-link" data-action="tab" data-tab="triage">Triage →</button></div>
      <ul class="bb-list"></ul>
    </section>
  </div>
</div>`;
}

function triageView() {
  return `<div role="tabpanel" class="bb-triage">
  <div class="bb-filters">
    <div class="bb-chips" role="group" aria-label="Show findings by status"></div>
    <button type="button" class="bb-btn bb-mark-sent" data-action="mark-sent" hidden></button>
    <select class="bb-select" data-change="filter-severity" aria-label="Show findings by how bad they are"><option value="all">Any level</option>${[
      ...SEVERITIES,
    ]
      .reverse()
      .map((s) => `<option value="${s}">${SEVERITY_LABELS[s]}</option>`)
      .join('')}</select>
  </div>
  <div class="bb-board"></div>
</div>`;
}

/* ---------- the parts of a blitz that change ---------- */

export const flowList = (b) =>
  b.flows
    .map(
      (f) =>
        `<li><button type="button" class="bb-flow" data-action="flow" data-flow="${esc(f.id)}" aria-pressed="${b.done.includes(f.id)}"><span class="bb-box">${ICONS.tick}</span><span class="bb-flow-t">${esc(f.label)}</span></button></li>`,
    )
    .join('');

export function feed(b, justLogged) {
  if (!b.findings.length) return '<li class="bb-empty">Nothing logged yet. The first snag you hit goes here.</li>';
  return [...b.findings]
    .reverse()
    .map((f) => {
      const filed = f.heuristic === DEFAULT_HEURISTIC ? '' : `<span>${esc(HEURISTICS[f.heuristic].label)}</span>`;
      return `<li class="bb-f compact ${f.status}${f.id === justLogged ? ' new' : ''}" data-id="${esc(f.id)}">
      ${f.screenshot ? `<img class="bb-mini" src="${esc(f.screenshot)}" alt="">` : ''}
      <div><p>${esc(f.note)}</p><div class="bb-f-meta bb-mono"><i class="bb-dot ${f.severity}" aria-hidden="true"></i><span>${SEVERITY_LABELS[f.severity]}</span>${filed}<span>${STATUS_LABELS[f.status]}</span></div></div>
    </li>`;
    })
    .join('');
}

export const statusChips = (b, active) => {
  const c = counts(b.findings);
  return ['all', ...STATUSES]
    .map(
      (s) =>
        `<button type="button" class="bb-chip" data-action="status-filter" data-status="${s}" aria-pressed="${active === s}">${s === 'all' ? 'All' : STATUS_LABELS[s]} <b>${c[s]}</b></button>`,
    )
    .join('');
};

// A triage card asks one thing: worth fixing? Keep or Dismiss, with Undo. How bad and where it's
// filed are two small pickers; on a finding still to sort, the filing picker says so.
function card(f, justLogged) {
  const sent = f.status === 'sent';
  const unsorted = f.heuristic === DEFAULT_HEURISTIC;
  const severity = sent
    ? `<span class="bb-pick ro"><i class="bb-dot ${f.severity}" aria-hidden="true"></i>${SEVERITY_LABELS[f.severity]}</span>`
    : `<label class="bb-pick"><i class="bb-dot ${f.severity}" aria-hidden="true"></i><select data-change="severity" aria-label="How bad">${SEVERITIES.map((s) => `<option value="${s}"${s === f.severity ? ' selected' : ''}>${SEVERITY_LABELS[s]}</option>`).join('')}</select></label>`;
  const category = sent
    ? ''
    : `<label class="bb-pick${unsorted ? ' ask' : ''}"><select data-change="category" aria-label="Category">${unsorted ? `<option value="${DEFAULT_HEURISTIC}" selected>Sort into…</option>` : ''}${SORTABLE_HEURISTICS.map((k) => `<option value="${k}"${k === f.heuristic ? ' selected' : ''}>${esc(HEURISTICS[k].label)}</option>`).join('')}</select></label>`;
  const undo = '<button type="button" class="bb-undo-s" data-action="move" data-to="open">Undo</button>';
  const decision = {
    open: '<button type="button" class="bb-do keep" data-action="move" data-to="triaged">Keep</button><button type="button" class="bb-do" data-action="move" data-to="dismissed">Dismiss</button>',
    triaged: `<span class="bb-state ok">${ICONS.tick}Kept</span>${undo}`,
    dismissed: `<span class="bb-state">Dismissed</span>${undo}`,
    sent: `<span class="bb-state ok">${ICONS.tick}Sent</span>`,
  }[f.status];
  return `<li class="bb-f ${f.status}${f.id === justLogged ? ' new' : ''}" data-id="${esc(f.id)}" tabindex="-1">
  ${f.screenshot ? `<button type="button" class="bb-thumb" data-action="thumb" aria-expanded="false" aria-label="Screenshot: show it larger"><img src="${esc(f.screenshot)}" alt="Screenshot attached to this finding"></button>` : ''}
  <p>${esc(f.note)}</p>
  <div class="bb-f-by bb-mono">${esc(f.reporter)} · ${esc(ago(f.createdAt))}</div>
  <div class="bb-f-pick">${severity}${category}</div>
  <div class="bb-f-do">${decision}</div>
</li>`;
}

export function board(b, filter, justLogged) {
  if (!b.findings.length) return '<div class="bb-panel bb-empty">Nothing to triage yet. Log findings on the Test tab.</div>';
  const columns = byHeuristic(filterFindings(b.findings, filter)).filter((col) => col.findings.length);
  if (!columns.length) return '<div class="bb-panel bb-empty">No findings match these filters.</div>';
  return columns
    .map(
      (col) => `<section class="bb-panel bb-col" aria-label="${esc(col.label)}">
  <header><h4>${esc(col.label)}<span class="bb-mono">${col.findings.length}</span></h4>${col.key === DEFAULT_HEURISTIC ? '' : `<span class="bb-mono bb-nielsen">${esc(col.nielsen)}</span>`}<p>${esc(col.hint)}</p></header>
  <ul class="bb-list">${col.findings.map((f) => card(f, justLogged)).join('')}</ul>
</section>`,
    )
    .join('');
}
