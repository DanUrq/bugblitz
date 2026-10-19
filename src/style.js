// Bug Blitz's styles, as a string the view adds to the page once. A host themes it by setting the
// --bb-* properties on .bb-app (index.html maps them to its own tokens).
// Laid out by the width of its box, not the window, so it fits a page column and an OS window alike.

export const STYLES = `
.bb-app {
  --bb-ink: #f2f2f3; --bb-muted: #a9abb1; --bb-paper: #0b0b0c; --bb-soft: #141518; --bb-rule: #232428;
  --bb-accent: var(--bb-ink); --bb-on-accent: var(--bb-paper);
  --bb-crit: #ef4444; --bb-high: #f59e0b; --bb-live: #4ade80;
  --bb-chevron: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='none' stroke='%23999' stroke-width='1.5' stroke-linecap='round'%3E%3Cpath d='M3 4.5l3 3 3-3'/%3E%3C/svg%3E"); --bb-med: var(--bb-muted); --bb-low: color-mix(in srgb, var(--bb-muted) 45%, transparent);
  --bb-font: ui-sans-serif, system-ui, sans-serif; --bb-mono: ui-monospace, "SF Mono", Menlo, monospace;
  --bb-r: 14px; --bb-r-sm: 9px;
  container-type: inline-size;
  color: var(--bb-ink); font: 14px/1.5 var(--bb-font); text-align: left;
}
:where(.bb-app) *, :where(.bb-app) *::before, :where(.bb-app) *::after { box-sizing: border-box; }
:where(.bb-app) :is(button, select, textarea, input) { font: inherit; color: inherit; }
:where(.bb-app) button { cursor: pointer; }
:where(.bb-app) button:disabled { cursor: default; opacity: .5; }
.bb-app :focus-visible { outline: 2px solid var(--bb-accent); outline-offset: 2px; }
:where(.bb-app) :is(ul, ol) { list-style: none; margin: 0; padding: 0; }
.bb-app [hidden] { display: none !important; }
.bb-mono { font-family: var(--bb-mono); font-size: 11.5px; letter-spacing: .01em; color: var(--bb-muted); font-variant-numeric: tabular-nums; }

/* the app's own header, the toast */
.bb-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 4px 0 28px; }
.bb-brand { display: inline-flex; align-items: center; gap: 10px; color: var(--bb-ink); text-decoration: none; font-weight: 500; font-size: 15px; letter-spacing: -.005em; }
.bb-mark { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; background: var(--bb-ink); color: var(--bb-paper); }
.bb-mark svg { width: 19px; height: 19px; }
.bb-toast { position: sticky; bottom: 16px; z-index: 5; display: flex; align-items: center; gap: 10px; width: fit-content; max-width: calc(100% - 16px); margin: 16px auto 0; padding: 10px 16px; border: 1px solid var(--bb-rule); border-radius: 999px; background: var(--bb-paper); box-shadow: 0 12px 32px -16px rgb(0 0 0 / .6); font-size: 13.5px; opacity: 0; transform: translateY(8px); pointer-events: none; transition: opacity .2s, transform .2s cubic-bezier(.2, .8, .2, 1); }
.bb-toast.on { opacity: 1; transform: none; pointer-events: auto; }
.bb-toast.err { border-color: color-mix(in srgb, var(--bb-crit) 60%, transparent); }
.bb-toast button { padding: 0; border: 0; background: none; font-weight: 500; text-decoration: underline; text-underline-offset: 3px; text-decoration-color: var(--bb-muted); }
.bb-tag { display: inline-flex; align-items: center; height: 22px; padding: 0 9px; border: 1px solid var(--bb-rule); border-radius: 999px; vertical-align: middle; }
.bb-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 34px; padding: 0 14px; border: 1px solid var(--bb-rule); border-radius: 999px; background: none; color: var(--bb-ink); font-size: 13px; text-decoration: none; white-space: nowrap; transition: border-color .15s, background-color .15s, opacity .15s, transform .15s; }
.bb-btn:hover:not(:disabled) { border-color: var(--bb-ink); }
.bb-btn:active:not(:disabled) { transform: scale(.97); }
.bb-btn.solid { background: var(--bb-accent); border-color: var(--bb-accent); color: var(--bb-on-accent); font-weight: 500; }
.bb-btn.solid:hover:not(:disabled) { opacity: .88; }
.bb-btn.big { min-height: 44px; padding: 0 20px; font-size: 15px; }
.bb-link { padding: 0; border: 0; background: none; color: var(--bb-muted); font-size: 13px; text-decoration: underline; text-underline-offset: 3px; text-decoration-color: var(--bb-rule); transition: color .15s; }
.bb-link:hover { color: var(--bb-ink); }
.bb-back { display: inline-block; margin-bottom: 20px; color: var(--bb-muted); font-size: 13px; text-decoration: none; } .bb-back:hover { color: var(--bb-ink); }
.bb-app h1 { margin: 0; font-weight: 500; letter-spacing: -.03em; line-height: 1.08; text-wrap: balance; font-size: clamp(1.6rem, 4cqi, 2.2rem); }
.bb-app h1:focus { outline: none; }
.bb-lead { margin: 14px 0 0; max-width: 56ch; color: var(--bb-muted); font-size: 16px; line-height: 1.55; text-wrap: pretty; }
.bb-ctas { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 24px; }
.bb-h { margin: 0 0 14px; font-size: 13px; font-weight: 500; color: var(--bb-muted); letter-spacing: .01em; }

/* home */
.bb-hero { padding: 24px 0 8px; }
.bb-hero h1 { font-size: clamp(2.2rem, 7cqi, 3.6rem); letter-spacing: -.04em; max-width: 14ch; }
.bb-hero .bb-lead { font-size: clamp(16px, 2.2cqi, 19px); }
.bb-sec { margin-top: 56px; }
.bb-rows li { border-top: 1px solid var(--bb-rule); } .bb-rows li:last-child { border-bottom: 1px solid var(--bb-rule); }
.bb-rows a { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 16px; padding: 16px 2px; color: var(--bb-ink); text-decoration: none; }
.bb-rows a:hover b { text-decoration: underline; text-decoration-color: var(--bb-rule); text-underline-offset: 3px; }
.bb-rows b { font-weight: 500; font-size: 15px; display: inline-flex; align-items: center; gap: 10px; }
.bb-steps { display: grid; gap: 12px; }
@container (min-width: 640px) { .bb-steps { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.bb-steps li { display: flex; flex-direction: column; gap: 8px; }
.bb-more { margin: 16px 0 0; font-size: 14px; } .bb-more a, .bb-toast a { color: var(--bb-ink); text-underline-offset: 3px; text-decoration-color: var(--bb-muted); }
.bb-steps b { font-weight: 500; font-size: 15px; }
.bb-steps p { margin: 0; color: var(--bb-muted); font-size: 14px; line-height: 1.55; }
.bb-ref summary { display: flex; justify-content: space-between; align-items: center; cursor: pointer; list-style: none; }
.bb-ref summary::-webkit-details-marker { display: none; }
.bb-ref summary .bb-h { margin: 0; color: var(--bb-ink); font-size: 14px; }
.bb-plus { font-size: 18px; line-height: 1; color: var(--bb-muted); transition: transform .2s; } .bb-ref[open] .bb-plus { transform: rotate(45deg); }
.bb-ref > p { margin: 14px 0 0; max-width: 64ch; color: var(--bb-muted); font-size: 14px; }
.bb-ref dl { display: grid; gap: 12px 24px; margin: 16px 0 0; } @container (min-width: 640px) { .bb-ref dl { grid-template-columns: 1fr 1fr; } }
.bb-ref dt { font-size: 14px; font-weight: 500; } .bb-ref dd { margin: 2px 0 0; font-size: 13.5px; color: var(--bb-muted); }
.bb-note-s { margin: 32px 0 0; color: var(--bb-muted); font-size: 13px; max-width: 64ch; }

/* new blitz */
.bb-form { display: flex; flex-direction: column; gap: 18px; max-width: 640px; margin-top: 28px; padding: 20px; }
.bb-form .bb-field > span, .bb-form .bb-field > label > span { font-size: 13px; color: var(--bb-ink); }
.bb-form i { font-style: normal; color: var(--bb-muted); }
.bb-input { width: 100%; padding: 10px 12px; border: 1px solid var(--bb-rule); border-radius: var(--bb-r-sm); background: var(--bb-soft); color: var(--bb-ink); font: inherit; font-size: 14px; line-height: 1.5; transition: border-color .15s; }
.bb-input:focus { border-color: var(--bb-muted); outline: none; } .bb-input::placeholder { color: var(--bb-muted); opacity: .8; }
textarea.bb-input { resize: vertical; min-height: 120px; }
.bb-form .bb-link { align-self: flex-start; margin-top: 2px; }
.bb-num .bb-input { width: 110px; }
.bb-access { margin: 0; padding: 0; border: 0; display: grid; gap: 8px; } @container (min-width: 520px) { .bb-access { grid-template-columns: 1fr 1fr; } }
.bb-access legend { padding: 0; margin-bottom: 6px; font-size: 13px; }
.bb-choice { position: relative; display: block; cursor: pointer; }
.bb-choice input { position: absolute; opacity: 0; inset: 0; margin: 0; cursor: pointer; }
.bb-choice span { display: flex; flex-direction: column; gap: 2px; height: 100%; padding: 12px 14px; border: 1px solid var(--bb-rule); border-radius: var(--bb-r-sm); background: var(--bb-soft); color: var(--bb-muted); font-size: 13px; transition: border-color .15s; }
.bb-choice b { color: var(--bb-ink); font-weight: 500; font-size: 14px; }
.bb-choice input:checked + span { border-color: var(--bb-ink); }
.bb-choice input:focus-visible + span { outline: 2px solid var(--bb-accent); outline-offset: 2px; }
.bb-err { margin: 0; color: var(--bb-crit); font-size: 13px; } .bb-err:empty { display: none; }
.bb-form .bb-ctas { margin-top: 0; }

/* a blitz */
.bb-blitz-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px 20px; }
.bb-live-tag { gap: 7px; color: var(--bb-ink); } .bb-live-tag i { width: 6px; height: 6px; border-radius: 50%; background: var(--bb-live); box-shadow: 0 0 0 3px color-mix(in srgb, var(--bb-live) 25%, transparent); }
.bb-title { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; min-width: 0; }
.bb-tools { display: flex; flex-wrap: wrap; gap: 8px; }
.bb-keep { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 20px; margin-top: 20px; border-color: color-mix(in srgb, var(--bb-high) 45%, var(--bb-rule)); }
.bb-keep b { font-weight: 500; font-size: 14px; } .bb-keep p { margin: 4px 0 0; max-width: 60ch; color: var(--bb-muted); font-size: 13.5px; }
.bb-keep .bb-ctas { margin: 0; align-items: center; }
.bb-tabs { display: flex; gap: 4px; margin: 24px 0 16px; border-bottom: 1px solid var(--bb-rule); }
.bb-tab { position: relative; display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 14px; border: 0; background: none; color: var(--bb-muted); font-size: 14px; transition: color .15s; }
.bb-tab:hover { color: var(--bb-ink); }
.bb-tab[aria-selected="true"] { color: var(--bb-ink); font-weight: 500; }
.bb-tab[aria-selected="true"]::after { content: ""; position: absolute; left: 10px; right: 10px; bottom: -1px; height: 2px; border-radius: 2px; background: var(--bb-ink); }
.bb-tab b { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; background: var(--bb-soft); font-size: 11.5px; font-weight: 500; line-height: 20px; text-align: center; font-variant-numeric: tabular-nums; } .bb-tab b:empty { display: none; }
.bb-side { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.bb-timer { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 14px; }
.bb-clock { font: 500 34px/1 var(--bb-mono); letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.bb-clock.done { color: var(--bb-muted); }
.bb-timer-btns { display: flex; align-items: center; gap: 12px; }
.bb-feed { min-width: 0; padding: 4px 2px 0; }
.bb-f.compact { flex-direction: row; align-items: flex-start; gap: 12px; }
.bb-f.compact > div { display: flex; flex-direction: column; gap: 6px; min-width: 0; flex: 1; }
.bb-mini { flex: none; width: 56px; height: 40px; object-fit: cover; object-position: top; border-radius: 6px; border: 1px solid var(--bb-rule); }
.bb-list > .bb-empty, .bb-board > .bb-empty { padding: 14px; font-size: 13px; color: var(--bb-muted); }
.bb-list > .bb-empty { border: 1px dashed var(--bb-rule); border-radius: var(--bb-r-sm); }
.bb-board > .bb-empty { grid-column: 1 / -1; }

.bb-layout { display: grid; gap: 12px; }
@container (min-width: 760px) { .bb-layout { grid-template-columns: minmax(0, 17rem) minmax(0, 1fr); align-items: start; } }
.bb-panel { border: 1px solid var(--bb-rule); border-radius: var(--bb-r); background: var(--bb-paper); padding: 16px; min-width: 0; }
.bb-main { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.bb-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin: 0 0 12px; }
.bb-head h3 { margin: 0; font-size: 14px; font-weight: 500; letter-spacing: -.005em; }

/* flows */
.bb-meter { height: 4px; border-radius: 999px; background: var(--bb-soft); overflow: hidden; margin: -4px 0 12px; }
.bb-meter i { display: block; height: 100%; background: var(--bb-ink); border-radius: inherit; transition: width .3s cubic-bezier(.2, .8, .2, 1); }
.bb-flows ol { display: flex; flex-direction: column; gap: 2px; }
.bb-flow { display: flex; gap: 10px; align-items: flex-start; padding: 6px; margin: 0 -6px; border: 0; border-radius: 8px; background: none; text-align: left; font-size: 13.5px; line-height: 1.4; transition: background-color .15s; width: calc(100% + 12px); }
.bb-flow:hover { background: var(--bb-soft); }
.bb-box { flex: none; display: grid; place-items: center; width: 15px; height: 15px; margin-top: 2px; border: 1.5px solid var(--bb-muted); border-radius: 4px; }
.bb-box svg { width: 10px; height: 10px; opacity: 0; }
.bb-flow[aria-pressed="true"] .bb-box { background: var(--bb-ink); border-color: var(--bb-ink); color: var(--bb-paper); }
.bb-flow[aria-pressed="true"] .bb-box svg { opacity: 1; }
.bb-flow[aria-pressed="true"] .bb-flow-t { color: var(--bb-muted); text-decoration: line-through; text-decoration-color: var(--bb-rule); }
.bb-flows p { margin: 12px 0 0; padding-top: 12px; border-top: 1px solid var(--bb-rule); font-size: 12.5px; line-height: 1.5; color: var(--bb-muted); }

/* the composer */
.bb-compose { display: flex; flex-direction: column; gap: 10px; }
.bb-compose label.bb-note-l { font-size: 14px; font-weight: 500; }
.bb-drop { position: relative; border: 1px solid var(--bb-rule); border-radius: var(--bb-r-sm); background: var(--bb-soft); transition: border-color .15s; }
.bb-drop:focus-within { border-color: var(--bb-muted); }
.bb-drop.over { border-color: var(--bb-ink); border-style: dashed; }
.bb-note { display: block; width: 100%; min-height: 76px; resize: vertical; padding: 10px 12px; border: 0; border-radius: inherit; background: none; font-size: 14px; line-height: 1.5; }
.bb-note:focus-visible { outline: none; }
.bb-note::placeholder { color: var(--bb-muted); opacity: .8; }
.bb-shot { display: flex; align-items: center; gap: 10px; padding: 0 12px 10px; }
.bb-shot .bb-chip { height: 28px; }
.bb-shot img { width: 72px; height: 48px; object-fit: cover; border-radius: 6px; border: 1px solid var(--bb-rule); }
.bb-hint { margin: -2px 0 0; font-size: 12px; color: var(--bb-muted); }
.bb-fields { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px 14px; }
.bb-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.bb-field > span { font-size: 12px; color: var(--bb-muted); }
.bb-select { height: 34px; max-width: 100%; padding: 0 30px 0 10px; border: 1px solid var(--bb-rule); border-radius: var(--bb-r-sm); background: var(--bb-paper) var(--bb-chevron) right 9px center / 12px no-repeat; appearance: none; -webkit-appearance: none; font-size: 13px; }
.bb-select option { background: var(--bb-paper); color: var(--bb-ink); }
.bb-seg { display: inline-flex; padding: 2px; border: 1px solid var(--bb-rule); border-radius: var(--bb-r-sm); }
.bb-seg label { position: relative; }
.bb-seg input { position: absolute; opacity: 0; inset: 0; margin: 0; cursor: pointer; }
.bb-seg span { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border-radius: 7px; font-size: 12.5px; color: var(--bb-muted); transition: background-color .15s, color .15s; }
.bb-seg input:checked + span { background: var(--bb-soft); color: var(--bb-ink); }
.bb-seg input:focus-visible + span { outline: 2px solid var(--bb-accent); outline-offset: 1px; }
.bb-compose-end { display: flex; flex-wrap: wrap; gap: 8px; margin-left: auto; }
.bb-why { margin: 0; font-size: 12px; color: var(--bb-muted); min-height: 1.5em; }

/* severity: a dot */
.bb-dot { flex: none; display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--bb-low); }
.bb-dot.critical { background: var(--bb-crit); } .bb-dot.high { background: var(--bb-high); } .bb-dot.medium { background: var(--bb-med); }

/* filters */
.bb-triage { display: flex; flex-direction: column; gap: 12px; }
.bb-filters { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 16px; }
.bb-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.bb-chip { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 11px; border: 1px solid var(--bb-rule); border-radius: 999px; background: none; font-size: 12.5px; color: var(--bb-muted); transition: border-color .15s, color .15s, background-color .15s; }
.bb-chip:hover { color: var(--bb-ink); }
.bb-chip[aria-pressed="true"] { background: var(--bb-ink); border-color: var(--bb-ink); color: var(--bb-paper); }
.bb-chip b { font-weight: 500; font-variant-numeric: tabular-nums; }

/* the board: one card per heuristic */
.bb-board { display: grid; gap: 12px; }
@container (min-width: 560px) { .bb-board { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@container (min-width: 1100px) { .bb-board { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.bb-col { display: flex; flex-direction: column; gap: 10px; }
.bb-col header { display: flex; flex-direction: column; gap: 2px; }
.bb-col h4 { display: flex; justify-content: space-between; gap: 8px; margin: 0; font-size: 13.5px; font-weight: 500; }
.bb-col .bb-nielsen { font-size: 10.5px; letter-spacing: .02em; }
.bb-ref dt .bb-mono { font-size: 10.5px; margin-left: 6px; }
.bb-col header p { margin: 0; font-size: 12px; line-height: 1.45; color: var(--bb-muted); }
.bb-list { display: flex; flex-direction: column; gap: 8px; }
.bb-f { display: flex; flex-direction: column; gap: 10px; padding: 14px; border-radius: var(--bb-r-sm); background: var(--bb-soft); font-size: 13px; line-height: 1.45; outline: none; }
.bb-f:focus-visible { box-shadow: 0 0 0 2px var(--bb-accent); }
.bb-f.new { animation: bb-in .9s cubic-bezier(.2, .8, .2, 1); }
@keyframes bb-in { from { box-shadow: 0 0 0 2px var(--bb-ink); transform: translateY(4px); opacity: 0; } 40% { opacity: 1; transform: none; } to { box-shadow: 0 0 0 0 transparent; } }
.bb-f p { margin: 0; overflow-wrap: anywhere; white-space: pre-wrap; }
.bb-f.dismissed p, .bb-f.sent p { color: var(--bb-muted); }
.bb-f.dismissed p { text-decoration: line-through; text-decoration-color: var(--bb-rule); }
.bb-thumb { display: block; padding: 0; border: 1px solid var(--bb-rule); border-radius: 6px; overflow: hidden; background: var(--bb-paper); }
.bb-thumb img { display: block; width: 100%; max-height: 120px; object-fit: cover; object-position: top; }
.bb-thumb[aria-expanded="true"] img { max-height: none; object-fit: contain; }
.bb-f-by { font-size: 11.5px; }
.bb-f-pick { display: flex; flex-wrap: wrap; gap: 6px; }
.bb-pick { position: relative; display: inline-flex; align-items: center; gap: 7px; height: 28px; padding: 0 10px; border: 1px solid var(--bb-rule); border-radius: 999px; background: var(--bb-paper); font-size: 12.5px; color: var(--bb-ink); max-width: 100%; transition: border-color .15s; }
.bb-pick:hover, .bb-pick:focus-within { border-color: var(--bb-muted); }
.bb-pick select { appearance: none; -webkit-appearance: none; border: 0; background: none; padding: 0 14px 0 0; font: inherit; color: inherit; cursor: pointer; min-width: 0; text-overflow: ellipsis; background: var(--bb-chevron) right center / 10px no-repeat; }
.bb-pick select:focus-visible { outline: none; }
.bb-pick option { background: var(--bb-paper); color: var(--bb-ink); }
.bb-pick.ask { border-style: dashed; color: var(--bb-muted); }
.bb-pick.ro { color: var(--bb-muted); }
.bb-f-do { display: flex; align-items: center; gap: 8px; padding-top: 4px; }
.bb-do { flex: 1; height: 32px; border: 1px solid var(--bb-rule); border-radius: 10px; background: var(--bb-paper); font-size: 13px; font-weight: 500; color: var(--bb-muted); transition: border-color .15s, color .15s, background-color .15s; }
.bb-do:hover { border-color: var(--bb-ink); color: var(--bb-ink); }
.bb-do.keep { background: var(--bb-ink); border-color: var(--bb-ink); color: var(--bb-paper); }
.bb-do.keep:hover { opacity: .88; }
.bb-state { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--bb-muted); }
.bb-state.ok { color: var(--bb-ink); } .bb-state svg { width: 12px; height: 12px; color: var(--bb-live); }
.bb-undo-s { margin-left: auto; padding: 0; border: 0; background: none; font-size: 12.5px; color: var(--bb-muted); text-decoration: underline; text-underline-offset: 3px; text-decoration-color: var(--bb-rule); }
.bb-undo-s:hover { color: var(--bb-ink); }
.bb-f.dismissed { opacity: .6; }
.bb-filters .bb-mark-sent { margin-left: auto; }
.bb-f-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 8px; }
.bb-f-meta .bb-dot { margin-right: -2px; }
.bb-f-meta > span + span::before { content: "·"; margin-right: 8px; color: var(--bb-rule); }

@media (prefers-reduced-motion: reduce) {
  .bb-app *, .bb-app *::before, .bb-app *::after { transition: none !important; animation: none !important; }
}
`;
