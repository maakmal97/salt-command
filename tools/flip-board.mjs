#!/usr/bin/env node
/* tools/flip-board.mjs: THE FLIP GATE BOARD (29 Oct 2026). One HTML page, in the Salt design system, that shows each line of the S5f gate
 * (tools/flip-gate.mjs) with its progress and carries the flip's runbook (tools/flip.mjs) as a checklist. It READS ONLY: it runs the gate's own
 * collectors and judge, writes the page and one compact snapshot to a history file, and never flips, turns a flag or pushes. The page's ticks are a
 * memory aid kept in the browser; the gate is enforced by flip-gate.mjs and flip.mjs, and every flag and the flip need his typed go.
 * Privacy: the page and the history carry counts, codes, statuses and the gate's own text; every line read off a log is scrubbed of anything
 * shaped like a key, token or link.
 *
 *   node tools/flip-board.mjs [--since YYYY-MM-DD] [--backup-opened YYYY-MM-DD] [--out file.html] [--offline evidence.json] [--history file.json] */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { GATE, judge, collect } from "./flip-gate.mjs";
import { PLAN, realGet } from "./flip.mjs";
import { DATA_DIR } from "./book.mjs";   /* flip.mjs's own data folder, where its way back is written */

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const HISTORY = join(DATA_DIR, "flip-board-history.json");
export const OUT = join(DATA_DIR, "flip-board.html");
export const CAP = 60;
const DAY = 864e5, MYT = 8 * 36e5, MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** 24-hour Kuala Lumpur time, DD Mon YYYY */
export function myt(iso, withTime = true) {
  const t = Date.parse(iso); if (!Number.isFinite(t)) return "unknown";
  const d = new Date(t + MYT), p = (n) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}` + (withTime ? `, ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} MYT` : "");
}
const mytDay = (iso) => new Date(Date.parse(iso) + MYT).toISOString().slice(0, 10);
/** whole Kuala Lumpur calendar days from `now` to the day `day` (YYYY-MM-DD); negative once past */
export const daysTo = (now, day) => Math.round((Date.parse(day) - Date.parse(mytDay(now))) / DAY);

/** the earliest moment the gate can read true: G0's day (the gate reads the UTC date) or G5's seven recorded days, whichever is later */
export function earliestFlipDay(cfg = GATE) {
  const g0 = Date.parse(cfg.earliest + "T00:00:00.000Z"), g5 = Date.parse(cfg.fallbackFrom) + cfg.fallbackDays * DAY;
  const at = new Date(Math.max(g0, g5)).toISOString();
  return { at, myt: myt(at), by: g5 > g0 ? "G5" : "G0" };
}

/** a line read off a log or a store, with anything shaped like a secret or a link taken out */
export function scrub(s) {
  return String(s == null ? "" : s)
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[link]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [hidden]")
    .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]*/g, "[hidden]")
    .replace(/\b(key|token|secret|password|passphrase|pass|auth|authorization|client[-_]?id)(\s*[:=]\s*)("?)[^\s",;]+/gi, "$1$2$3[hidden]")
    .replace(/[A-Za-z0-9+/_-]{32,}={0,2}/g, "[hidden]");
}

const counts = (runs) => {
  const all = (k) => runs.flatMap((r) => (r.log && r.log[k]) || []);
  const loads = all("loads"), withTap = loads.filter((l) => l.closed !== null);
  return { loads: loads.length, withTap: withTap.length, closed: withTap.reduce((a, l) => a + l.closed, 0),
    badLoads: loads.filter((l) => !l.ok || l.bad || !l.agrees || (l.open !== null && l.open !== 0)).length,
    reads: all("readchecks").length, badReads: all("readchecks").filter((r) => !r.ok).length,
    parity: all("parity").length, badParity: all("parity").filter((p) => !p.ok).length,
    sources: all("sources").length, badSources: all("sources").filter((s) => !s.ok).length,
    exports: all("exports").length, badExports: all("exports").filter((e) => !e.ok).length };
};
const meter = (label, n, of) => ({ kind: "meter", label, n, of, ok: n === null || n === undefined ? null : n >= of });
const zero = (label, n) => ({ kind: "zero", label, n, ok: n === null || n === undefined ? null : n === 0 });
const count = (label, n) => ({ kind: "count", label, n });
const flag = (label, got, want, ok) => ({ kind: "flag", label, got, want, ok });

/** what moves each line, one sentence each, from docs/DESK.md S5f-7 */
export const MOVES = {
  G0: "Calendar time only: true from 04 Nov 2026 (the gate reads the UTC date, so from 08:00 MYT).",
  G1: "Each chain load adds a line; it needs one load with a tap line and every load clean, tap: N closed, 0 open.",
  G2: "Real approvals the tap books over the week: 20 closed, 5 new sales, purchases or loans, a trip, a lot and a Received.",
  G3: "Each fold's readcheck; one that differs stays in the window and holds the line false.",
  G4: "The minute net booking every approval within ten minutes, and the readcheck answering its voided count (it needs SALT_BOOK_KEY).",
  G5: "Calendar time only: seven days recorded from the version that records fallbacks, with none recorded.",
  G6: "Each chain run's pricing parity step; a purchase lot must pass through it.",
  G7: "Each fold's statements comparison, and your --backup-opened after you open a Book backup with your key.",
  G8: "Nobody running drafts.mjs --approve or a laptop fold in the window.",
  G9: "Holds while the flags stand as set: book_tap on, book_read book, book_source d1, the export steps on master, no fold handoff in HEAD.",
};
const STATE = (ok) => (ok === true ? "m" : ok === false ? "n" : "u");

/** one compact snapshot for the history: counts and statuses only */
export function snapshotOf(ev, judged) {
  const c = counts(ev.runs || []), d = ev.d1 || {}, k = d.kinds || {};
  const rec = ev.now ? Math.max(0, Math.floor((Date.parse(ev.now) - Date.parse(GATE.fallbackFrom)) / DAY)) : null;
  const num = (v) => (Number.isFinite(v) ? v : null);
  return { at: ev.now || null, ok: judged.ok === true, gates: Object.fromEntries(judged.lines.map((l) => [l.id, STATE(l.ok)])),
    n: { runs: (ev.runs || []).length, closed: c.closed, newIds: num(k.newIds), trips: num(k.trips), purchases: num(k.purchases), received: num(k.received),
      left: num(d.left), voided: num(d.voidedNotRejected), fallbacks: num(d.fallbacks), recorded: rec } };
}
export const appendHistory = (hist, snap, cap = CAP) => [...(Array.isArray(hist) ? hist : []), snap].slice(-cap);
/** the history file, or [] when it is missing, unreadable or not a list: never fatal */
export function readHistory(file) {
  try { const h = JSON.parse(readFileSync(file, "utf8")); return Array.isArray(h) ? h.filter((x) => x && typeof x === "object" && x.gates) : []; } catch (e) { return []; }
}

/** the page's data from the evidence, the judge's answer and the history (which already holds this read). Pure: the clock is ev.now. */
export function viewOf(ev, judged, history = []) {
  const c = counts(ev.runs || []), d = ev.d1 || null, k = d && d.kinds, p = ev.pre || null, now = ev.now || null;
  const since = String(ev.since || GATE.since).slice(0, 10), total = daysTo(since + "T00:00:00.000Z", GATE.earliest) + 0;
  const elapsed = now ? Math.max(0, Math.min(total, Math.round((Date.parse(mytDay(now)) - Date.parse(since)) / DAY))) : null;
  const rec = now ? Math.max(0, Math.floor((Date.parse(now) - Date.parse(GATE.fallbackFrom)) / DAY)) : null;
  const kn = (f) => (k ? k[f] : null), dn = (f) => (d ? d[f] : null);
  const yes = (v) => (v === true ? "yes" : v === false ? "no" : "unread");
  const prog = {
    G0: [meter("Days of the window", elapsed, total), count("Days to 04 Nov 2026", now ? daysTo(now, GATE.earliest) : null)],
    G1: [count("Loads read", c.loads), count("With a tap line", c.withTap), zero("Not clean", c.loads ? c.badLoads : null)],
    G2: [meter("Taps closed", c.loads ? c.closed : null, GATE.minTaps), meter("New rows", kn("newIds"), GATE.minNewIds), meter("Trips", kn("trips"), 1), meter("Purchases", kn("purchases"), 1), meter("Received", kn("received"), 1)],
    G3: [count("Readchecks read", c.reads), zero("Not green", c.reads ? c.badReads : null)],
    G4: [zero("Approved, unbooked past 10 min", dn("left")), zero("Voided, not rejected", dn("voidedNotRejected") ?? null)],
    G5: [meter("Days recorded", rec, GATE.fallbackDays), zero("Fallbacks", dn("fallbacks"))],
    G6: [count("Parity lines read", c.parity), zero("Not equal", c.parity ? c.badParity : null)],
    G7: [count("Statement comparisons", c.sources), zero("Differ", c.sources ? c.badSources : null), count("Export lines", c.exports), zero("Exports failed", c.badExports),
      flag("Backup opened with your key", ev.backupOpened ? myt(ev.backupOpened + "T00:00:00.000Z", false).replace(/^/, "") : "not attested", "attested", ev.backupOpened ? true : null)],
    G8: [zero("Approved by hand", dn("laptopApprovals")), zero("Folded with no tap booking", dn("foldedUnbooked"))],
    G9: [flag("Migrations 0023 and 0024", yes(p && p.migrations), "yes", p ? p.migrations === true : null), flag("book_tap", p ? p.tap || "unread" : "unread", "on", p && p.tap ? p.tap === "on" : null),
      flag("book_read", p ? p.read || "unread" : "unread", "book", p && p.read ? p.read === "book" : null), flag("book_source", p ? p.source || "unread" : "unread", "d1", p && p.source ? p.source === "d1" : null),
      flag("Export steps on master", yes(p && p.exportSteps), "yes", p ? p.exportSteps === true : null), flag("Fold handoff in HEAD", yes(p && p.handoff), "no", p ? p.handoff === false : null)],
  };
  const hist = (Array.isArray(history) ? history : []).slice(-8);
  const gates = judged.lines.map((l) => ({ id: l.id, text: l.text, ok: l.ok, detail: scrub(l.detail), progress: prog[l.id] || [], moves: MOVES[l.id] || "",
    trend: hist.map((h) => ({ at: h.at, s: (h.gates && h.gates[l.id]) || "u" })) }));
  const tally = (v) => judged.lines.filter((l) => l.ok === v).length;
  return { ok: judged.ok === true, met: tally(true), notMet: tally(false), unverified: tally(null), total: judged.lines.length,
    now, nowMyt: now ? myt(now) : "unknown", since, runs: (ev.runs || []).length, daysTo: now ? daysTo(now, GATE.earliest) : null,
    earliest: earliestFlipDay(), backupOpened: ev.backupOpened || null, error: ev.collectError ? scrub(ev.collectError) : null, gates };
}

/** the runbook: his preconditions, the flip in PLAN order, the check after, and the way back. `did` is what flip.mjs prints when the step ran. */
export const RUNBOOK = {
  pre: [
    { id: "P1", title: "Open a Book backup with your key", cmd: "npx wrangler r2 object get salt-d1-backup/bookexport/<YYYY-MM-DD>.json --file $env:TEMP\\book-export.json --remote\nnode tools/backup-open.mjs $env:TEMP\\book-export.json",
      does: "Fetches one night's sealed Book export and opens it with your passphrase; counts only, nothing plaintext is written.", read: "OPENED: the Book export of ... with each collection's row count. Then refresh this board with --backup-opened <that day>." },
    { id: "P2", title: "Read the gate with your attestation", cmd: "node tools/flip-gate.mjs --backup-opened <YYYY-MM-DD>", does: "Reads every line off the evidence; writes nothing.", read: "The gate reads TRUE, every line ok." },
    { id: "P3", title: "Pull and check level", cmd: "git fetch -q\ngit rev-list --count HEAD..origin/master\ngit rev-list --count origin/master..HEAD\ngh run list --limit 20", does: "This checkout level with origin/master and no Actions run in progress or queued.", read: "Both counts 0, and every run completed." },
    { id: "P4", title: "Queue empty", cmd: "node tools/drain.mjs --status\nnode tools/drafts.mjs --list\nnode tools/drafts.mjs --approved", does: "Nothing queued, pending or approved and unbooked: the fold has nothing left to take.", read: "Nothing waiting; approved drafts the Book has not booked: 0." },
    { id: "P5", title: "Dry run of the flip", cmd: "node tools/flip.mjs", does: "Runs the preconditions and prints the plan; writes nothing, anywhere.", read: "Every check ok (gate, level, idle, unbooked, flag)." },
  ],
  go: { id: "GO", title: "Run the flip", cmd: "node tools/flip.mjs --go \"<your typed words>\"", does: "Checks every precondition again, then runs steps 0 to 7 in order and stops at the first failure, saying where.", read: "\"ok\": true and the did list below; on a stop, stoppedAt and the way back." },
  did: { 0: "0 way back written", 3: "3 book_roster on", 4: "4 roster-export --init, the watermark pushed", 5: "5 book_source book", 6: "6 compacted N, marked N", 7: "7 the day's export dispatched", 8: "node tools/flip.mjs --verify: source, roster, readcheck, unbooked and fallbacks all ok" },
  verify: "node tools/flip.mjs --verify",
  back: [
    { id: "B1", title: "Way back, first pass", cmd: "node tools/flip.mjs --back \"<your typed words>\"", when: "After the flip, when anything is wrong. It dispatches the day's export first and moves no flag; wait for that run green." },
    { id: "B2", title: "Way back, after the export", cmd: "node tools/flip.mjs --back \"<your typed words>\" --exported", when: "Once the export run is green: book_source to d1, book_roster off, the mirror seeded from the export, and what was tapped since listed for a hand fold." },
    { id: "B3", title: "Way back, nothing compacted", cmd: "node tools/flip.mjs --back \"<your typed words>\" --no-export", when: "Only when the flip stopped at step 6 or before, so nothing was compacted: the flags alone, no export and no pull." },
  ],
  notProved: [
    "The model's own notes (his D7) are not built: the day's export writes the tool's line saying no model wrote it.",
    "The chain's two export steps and the runbook have run only over stand-ins; with book_source at d1 the export steps are skipped, so read the step list of the first run after the flip.",
    "With git as the source, the chain's source step fails a code push when D1 will not answer (Workers Builds still deploys).",
    "Stale-document flags are noisy until the first export refreshes the derived documents.",
    "The roster export: an entry voided after it was exported is not reversed, and the laptop's _passwords.json is not moved (the seal tool re-pairs).",
    "Left as notes: an edit draft has no party column on Approve's card; a refund with no since is never listed; a double tap before its draft exists passes the twin check.",
    "A backup opened with your key is your word (--backup-opened); no tool can infer it.",
  ],
};

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const GLYPH = { m: "M5 12.5l4.5 4.5L19 7.5", n: "M7 7l10 10M17 7L7 17", u: "M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7v.5M12 17.5v.01" };
const TONE = { m: "salt-status--verdigris", n: "salt-status--ember", u: "salt-status--steel salt-status--dashed" };
const WORD = { m: "Met", n: "Not met", u: "Unverified" };
const glyph = (s) => `<svg class="salt-status__glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="${GLYPH[s]}"/></svg>`;
const chip = (s) => `<span class="salt-status ${TONE[s]}" data-state="${s}">${glyph(s)}${WORD[s]}</span>`;
const hidden = (t) => `<span class="salt-lines__head">${esc(t)}</span>`;
const COPY = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>`;

function prog(p) {
  if (p.kind === "meter") {
    const unread = p.n === null || p.n === undefined, fill = unread ? 0 : Math.max(0, Math.min(100, Math.round((p.n / p.of) * 100)));
    return `<div class="salt-meter${p.ok ? " salt-meter--verdigris" : ""}" data-p="${esc(p.label)}"><div class="salt-meter__line"><span>${esc(p.label)}</span><b data-n>${unread ? "unread" : esc(p.n) + " of " + esc(p.of)}</b></div><div class="salt-meter__track" aria-hidden="true"><div class="salt-meter__fill" style="--salt-fill:${fill}"></div></div></div>`;
  }
  const v = p.kind === "flag" ? `${esc(p.got)} <span class="salt-ledger__label">want ${esc(p.want)}</span>` : p.n === null || p.n === undefined ? "unread" : esc(p.n) + (p.kind === "zero" ? ` <span class="salt-ledger__label">want 0</span>` : "");
  return `<div class="salt-ledger__row" data-p="${esc(p.label)}"><div class="salt-ledger__line"><span class="salt-ledger__label">${esc(p.label)}</span><span class="salt-ledger__value" data-n>${v}</span></div></div>`;
}

function gateCard(g) {
  const s = STATE(g.ok), meters = g.progress.filter((p) => p.kind === "meter"), rows = g.progress.filter((p) => p.kind !== "meter");
  const trend = g.trend.length ? `<ol class="salt-row fb-plain fb-trend" aria-label="${esc(g.id)} over the last ${g.trend.length} reads">${g.trend.map((t) => `<li><span class="salt-status ${TONE[t.s]}" title="${esc(myt(t.at))}: ${WORD[t.s]}">${glyph(t.s)}${hidden(myt(t.at) + ": " + WORD[t.s])}</span></li>`).join("")}</ol>` : "";
  return `<article class="salt-glass-card salt-glass-card--radius-lg salt-glass-card--pad-sm salt-stack" id="${esc(g.id)}" data-gate="${esc(g.id)}" data-state="${s}">
<div class="salt-band__head"><h3 class="salt-band__ref fb-h">${esc(g.id)}</h3>${chip(s)}</div>
<p>${esc(g.text)}</p>
${meters.map(prog).join("\n")}
${rows.length ? `<div class="salt-ledger salt-ledger--plain">${rows.map(prog).join("")}</div>` : ""}
<p class="salt-footnote"><span class="salt-footnote__marker">Read</span>${esc(g.detail)}</p>
<p class="salt-insight"><b>Moves with</b> ${esc(g.moves)}</p>
${trend}
</article>`;
}

function cmdBlock(cmd, locked) {
  return `<div class="salt-settings"><div class="salt-settings__cell"><pre class="salt-ledger fb-cmd" data-cmd>${esc(cmd)}</pre></div><button type="button" class="salt-settings__row salt-settings__row--action" data-copy${locked ? " disabled" : ""}><span class="salt-settings__label">Copy</span><span class="salt-settings__mark">${COPY}</span></button></div>`;
}
function step(id, title, { cmd, does, read, typed, locked }) {
  return `<li class="salt-stack salt-stack--tight" data-step="${esc(id)}"${locked ? ' data-locked=""' : ""}>
<label class="salt-option"><input type="checkbox" class="salt-option__input" data-tick="${esc(id)}"${locked ? " disabled" : ""}><span class="salt-option__face"><span class="salt-option__lead"><span class="salt-status salt-status--mist" data-word>Not ticked</span></span><span class="salt-option__text"><span class="salt-option__label"><span>${esc(id)}</span> <span data-title>${esc(title)}</span>${typed ? ' <span class="salt-status salt-status--copper">Typed go</span>' : ""}</span><span class="salt-option__detail">${esc(does)}</span></span></span></label>
${cmd ? cmdBlock(cmd, locked) : ""}
<p class="salt-settings__foot"><b>Read after:</b> ${esc(read)}</p>${locked ? `\n<p class="salt-settings__foot" data-lock><span class="salt-status salt-status--ember">Locked</span> gate not true.</p>` : ""}
</li>`;
}

/** the page, from viewOf's answer and the runbook. Everything inlined: the system's stylesheet and faces; no network. */
export function renderPage(view, runbook = RUNBOOK, assets = loadAssets()) {
  const lock = !view.ok, s = view.ok ? "m" : "n";
  const refresh = "node tools/flip-board.mjs" + (view.backupOpened ? " --backup-opened " + view.backupOpened : "");
  const tile = (label, value, note) => `<div class="salt-glance__item"><span class="salt-glance__label">${esc(label)}</span><span class="salt-glance__value">${esc(value)}</span>${note ? `<span class="salt-glance__note">${esc(note)}</span>` : ""}</div>`;
  const flipSteps = PLAN.filter(([n]) => n !== "8").map(([n, text]) => step("S" + n, text, { does: "Run by the --go above, never by hand.", read: "In its output: " + runbook.did[n], locked: lock }));
  const last = PLAN.find(([n]) => n === "8");
  return `<!doctype html>
<html lang="en-GB" data-theme="tide">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src data:; img-src data:">
<title>Flip gate board</title>
<script>try{var p=JSON.parse(localStorage.getItem("salt-flip-board")||"{}");if(p&&p.look==="night")document.documentElement.setAttribute("data-theme","night");}catch(e){}</script>
<style>
${assets.fonts}
${assets.css}
/* layout only, on the system's tokens: no colour, face or token is set here */
.fb-main { max-width: 75rem; margin: 0 auto; gap: var(--salt-space-6); }
@media (max-width: 560px) { body.salt-root--padded { padding: var(--salt-space-4); } }
.fb-main h1, .fb-main h2, .fb-h { margin: 0; }
.fb-main p { margin: 0; }
.fb-main article { min-width: 0; overflow-wrap: anywhere; }
.fb-plain { list-style: none; margin: 0; padding: 0; }
.fb-trend .salt-status__glyph { margin-right: 0; }
.fb-main .salt-status { white-space: nowrap; }
.fb-main .salt-band__ref { white-space: normal; }
.fb-cmd { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.fb-head { justify-content: space-between; }
.fb-head .salt-segment { flex: 0 1 14rem; }
</style>
</head>
<body class="salt-root salt-root--padded">
<div class="salt-aurora salt-aurora--page salt-aurora--fixed" aria-hidden="true"><div class="salt-aurora__blob salt-aurora__blob--copper"></div><div class="salt-aurora__blob salt-aurora__blob--brass"></div></div>
<main class="salt-root__content salt-stack fb-main">
<header class="salt-stack">
<div class="salt-row fb-head"><p class="salt-eyebrow salt-eyebrow--copper">Salt Command · S5f</p>
<div class="salt-segment" role="radiogroup" aria-label="Theme" style="--n:2;--i:1"><button type="button" class="salt-segment__opt" role="radio" aria-checked="false" data-look="night">Night</button><button type="button" class="salt-segment__opt" role="radio" aria-checked="true" data-look="tide">Tide</button></div></div>
<h1 class="salt-title salt-title--sm">Flip gate</h1>
<section class="salt-band" aria-label="Verdict" data-verdict="${view.ok ? "true" : "false"}">
<div class="salt-band__head"><h2 class="salt-eyebrow salt-eyebrow--brass">The gate reads ${view.ok ? "TRUE" : "NOT TRUE"}</h2>${chip(s).replace(WORD[s], view.ok ? "True" : "Not true")}</div>
<p class="salt-band__when"><span data-count="met">${view.met}</span> met, <span data-count="not">${view.notMet}</span> not met, <span data-count="unv">${view.unverified}</span> unverified, of ${view.total} lines.${view.ok ? " Every line is met: the flip still needs your typed go." : " Not ready: the flip steps below are locked."}</p>
${view.error ? `<p class="salt-insight salt-insight--alarm"><b>Collect failed</b> ${esc(view.error)}: every line it would have read is Unverified.</p>` : ""}
<div class="salt-band__foot"><span class="salt-kpi__label">Snapshot</span><span class="salt-band__ref" data-now>${esc(view.nowMyt)}</span></div>
</section>
<div class="salt-glance">
${tile("Chain runs read", view.runs, "since " + myt(view.since + "T00:00:00.000Z", false))}
${tile("Days to 04 Nov 2026", view.daysTo === null ? "unknown" : Math.max(0, view.daysTo), view.daysTo !== null && view.daysTo <= 0 ? "the earliest day has come" : "the earliest flip day")}
${tile("Earliest the gate can read true", view.earliest.myt, "set by " + view.earliest.by + (view.earliest.by === "G5" ? ": seven recorded days" : ""))}
</div>
<p class="salt-settings__head">Refresh this board</p>
${cmdBlock(refresh, false)}
<p class="salt-settings__foot">Add --backup-opened &lt;YYYY-MM-DD&gt; once you have opened a Book backup with your key.</p>
<p class="salt-insight salt-insight--copper"><b>Ticks are your memory aid only</b> and change nothing in the system: flip-gate.mjs and flip.mjs enforce the gate, and every flag and the flip need your typed go in the session that acts.</p>
</header>

<section class="salt-stack" aria-labelledby="h-gate">
<h2 class="salt-eyebrow salt-eyebrow--brass" id="h-gate">The gate, G0 to G9</h2>
<div class="salt-grid salt-grid--2">
${view.gates.map(gateCard).join("\n")}
</div>
</section>

<section class="salt-stack" aria-labelledby="h-run">
<h2 class="salt-eyebrow salt-eyebrow--brass" id="h-run">The runbook</h2>
<div class="salt-row"><button type="button" class="salt-ghost" data-reset>Reset ticks</button></div>
<p class="salt-settings__head">Before the flip, by hand</p>
<ol class="fb-plain salt-stack">
${runbook.pre.map((p) => step(p.id, p.title, { cmd: p.cmd, does: p.does, read: p.read })).join("\n")}
</ol>
<p class="salt-settings__head">The flip, in flip.mjs's order</p>
<ol class="fb-plain salt-stack">
${step(runbook.go.id, runbook.go.title, { cmd: runbook.go.cmd, does: runbook.go.does, read: runbook.go.read, typed: true, locked: lock })}
${flipSteps.join("\n")}
${step("S8", last[1], { cmd: runbook.verify, does: "Approve one real row in Salt Admin, then read the Book's health; --verify writes nothing.", read: runbook.did[8], locked: lock })}
</ol>
</section>

<section class="salt-stack" aria-labelledby="h-back">
<h2 class="salt-eyebrow salt-eyebrow--brass" id="h-back">The way back</h2>
<p class="salt-settings__foot">flip.mjs writes the way back first, to 10_Data/flip-way-back.json. --back never turns book_outbox.</p>
${runbook.back.map((b) => `<div class="salt-stack salt-stack--tight" data-back="${esc(b.id)}"><p class="salt-settings__head">${esc(b.title)} <span class="salt-status salt-status--copper">Typed go</span></p>${cmdBlock(b.cmd, false)}<p class="salt-settings__foot">${esc(b.when)}</p></div>`).join("\n")}
</section>

<section class="salt-stack" aria-labelledby="h-not">
<h2 class="salt-eyebrow salt-eyebrow--brass" id="h-not">Not proved by the gate</h2>
<ul class="salt-settings fb-plain">${runbook.notProved.map((t) => `<li class="salt-settings__row salt-settings__row--text"><span class="salt-settings__label">${esc(t)}</span></li>`).join("")}</ul>
</section>
</main>
<script>
(function () {
  var KEY = "salt-flip-board", st = { ticks: {}, look: "tide" };
  try { var p = JSON.parse(localStorage.getItem(KEY) || "null"); if (p && typeof p === "object") { if (p.ticks && typeof p.ticks === "object") st.ticks = p.ticks; if (p.look === "night" || p.look === "tide") st.look = p.look; } } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
  function word(b) { var w = b.closest("li").querySelector("[data-word]"); w.textContent = b.checked ? "Ticked" : "Not ticked"; w.classList.toggle("salt-status--verdigris", b.checked); w.classList.toggle("salt-status--mist", !b.checked); }
  var boxes = Array.prototype.slice.call(document.querySelectorAll("[data-tick]"));
  boxes.forEach(function (b) {
    if (!b.disabled && st.ticks[b.getAttribute("data-tick")]) b.checked = true;
    word(b);
    b.addEventListener("change", function () { var id = b.getAttribute("data-tick"); if (b.checked) st.ticks[id] = 1; else delete st.ticks[id]; word(b); save(); });
  });
  document.querySelector("[data-reset]").addEventListener("click", function () {
    var yes = true; try { yes = window.confirm("Clear every tick on this page?"); } catch (e) { yes = false; }
    if (!yes) return; st.ticks = {}; boxes.forEach(function (b) { b.checked = false; word(b); }); save();
  });
  var seg = document.querySelector(".salt-segment"), opts = Array.prototype.slice.call(seg.querySelectorAll("[data-look]"));
  function look(v, keep) { st.look = v; document.documentElement.setAttribute("data-theme", v); seg.style.setProperty("--i", v === "tide" ? 1 : 0); opts.forEach(function (o) { o.setAttribute("aria-checked", String(o.getAttribute("data-look") === v)); }); if (keep) save(); }
  opts.forEach(function (o) { o.addEventListener("click", function () { look(o.getAttribute("data-look"), true); }); });
  look(st.look, false);
  function fallback(text) { var t = document.createElement("textarea"), ok = false; t.value = text; t.setAttribute("readonly", ""); t.className = "salt-lines__head"; document.body.appendChild(t); t.select(); try { ok = document.execCommand("copy"); } catch (e) {} t.remove(); return ok; }
  Array.prototype.forEach.call(document.querySelectorAll("[data-copy]"), function (row) {
    row.addEventListener("click", function () {
      var text = row.parentNode.querySelector("[data-cmd]").textContent, label = row.querySelector(".salt-settings__label");
      function done(ok) { label.textContent = ok ? "Copied" : "Select the text to copy"; setTimeout(function () { label.textContent = "Copy"; }, 2000); }
      try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(fallback(text)); }); return; } } catch (e) {}
      done(fallback(text));
    });
  });
})();
</script>
</body>
</html>
`;
}

/** the system's own stylesheet and faces, read from the repo's vendored copy, the faces as data URIs */
export function loadAssets() {
  const css = readFileSync(join(REPO, "design", "salt-ds.css"), "utf8");
  const fonts = readFileSync(join(REPO, "design", "fonts.css"), "utf8").replace(/url\(fonts\/([\w.-]+\.woff2)\)/g, (m, f) => `url(data:font/woff2;base64,${readFileSync(join(REPO, "design", "fonts", f)).toString("base64")})`);
  return { css, fonts };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const a = process.argv.slice(2), val = (f) => { const i = a.indexOf(f); return i >= 0 ? a[i + 1] : null; };
  let ev;
  if (val("--offline")) ev = JSON.parse(readFileSync(val("--offline"), "utf8"));
  else {
    const since = val("--since") || GATE.since;
    try { ev = await collect({ since: val("--since"), backupOpened: val("--backup-opened"), get: realGet() }); }
    catch (e) { ev = { since: since + "T00:00:00.000Z", now: new Date().toISOString(), runs: [], d1: null, pre: null, collectError: String(e && e.message || e).slice(0, 200) }; }
  }
  if (val("--backup-opened")) ev.backupOpened = val("--backup-opened");
  const judged = judge(ev);
  const histFile = val("--history") || (val("--offline") ? null : HISTORY);
  let history = histFile ? appendHistory(readHistory(histFile), snapshotOf(ev, judged)) : [snapshotOf(ev, judged)];
  if (histFile) { try { mkdirSync(dirname(histFile), { recursive: true }); writeFileSync(histFile, JSON.stringify(history, null, 1)); } catch (e) { console.log("  history not written (" + e.message + "); the page shows this read alone"); } }
  const out = resolve(val("--out") || OUT);
  if (!existsSync(dirname(out))) mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, renderPage(viewOf(ev, judged, history)));
  console.log(`  The gate reads ${judged.ok ? "TRUE" : "NOT TRUE"}: ${judged.lines.map((l) => l.id + " " + WORD[STATE(l.ok)]).join(", ")}`);
  console.log("  " + pathToFileURL(out).href);
}
