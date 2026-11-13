#!/usr/bin/env node
/* tools/flip-board.mjs: THE FLIP GATE BOARD (29 Oct 2026). One HTML page, in the Salt design system, that shows each line of the S5f gate
 * (tools/flip-gate.mjs) with its progress and carries the flip's runbook (tools/flip.mjs) as a checklist. It READS ONLY: it runs the gate's own
 * collectors and judge, writes the page and one compact snapshot to a history file, and never flips, turns a flag or pushes. The page's ticks are a
 * memory aid kept in the browser; the gate is enforced by flip-gate.mjs and flip.mjs, and every flag and the flip need his typed go.
 * Privacy: the page and the history carry counts, codes, statuses and the gate's own text; every line read off a log is scrubbed of anything
 * shaped like a key, token or link.
 * AFTER THE FLIP (14 Nov 2026, his word "Flipped record + health"; the flip ran on 10 Nov 2026): once book_source READS book the board takes its flipped
 * shape: the flip's record, the Book's live health as flip.mjs --verify reads it (flip.mjs `health`, read only) with the day's export, the runbook as
 * run, the way back, and the gate as the pre-flip record, never judged again. Its history is read, never written, in that shape.
 *
 *   node tools/flip-board.mjs [--since YYYY-MM-DD] [--backup-opened YYYY-MM-DD] [--flipped-on YYYY-MM-DD] [--out file.html] [--offline evidence.json] [--history file.json] */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { GATE, judge, collect, attested, collectPre, d1 as gateD1, shellFor } from "./flip-gate.mjs";
import { PLAN, realGet, WAY_BACK, health } from "./flip.mjs";
import { DATA_DIR } from "./book.mjs";   /* flip.mjs's own data folder, where its way back is written */

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const HISTORY = join(DATA_DIR, "flip-board-history.json");
export const OUT = join(DATA_DIR, "flip-board.html");
export const CAP = 60;
const DAY = 864e5, MYT = 8 * 36e5, MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** 24-hour Kuala Lumpur time, DD Mon YYYY */
export function myt(iso, withTime = true, seconds = false) {
  const t = Date.parse(iso); if (!Number.isFinite(t)) return "unknown";
  const d = new Date(t + MYT), p = (n) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}` + (withTime ? `, ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}${seconds ? ":" + p(d.getUTCSeconds()) : ""} MYT` : "");
}
/* G0 reads the UTC date (flip-gate.mjs), so every day count here does too: the board and the gate never disagree on whether the day has come */
const utcDay = (iso) => String(iso).slice(0, 10);
/** whole days from `now`'s UTC date to the day `day` (YYYY-MM-DD), as G0 counts them; 0 or less once the day has come */
export const daysTo = (now, day) => Math.round((Date.parse(day) - Date.parse(utcDay(now))) / DAY);

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
  G9: "Holds while the flags stand as set: book_tap on, book_read book, book_source d1, the export steps on master, the chain marking before it loads, no fold handoff in HEAD.",
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

/** the page's data from the evidence, the judge's answer and the history (which already holds this read). Pure: the clock is ev.now.
 * opts.wayBack: flip.mjs's way-back file exists (the CLI looks); the way back is offered only then or with book_source read as book. */
export function viewOf(ev, judged, history = [], opts = {}) {
  const c = counts(ev.runs || []), d = ev.d1 || null, k = d && d.kinds, p = ev.pre || null, now = ev.now || null;
  const since = String(ev.since || GATE.since).slice(0, 10), total = daysTo(since + "T00:00:00.000Z", GATE.earliest) + 0;
  const elapsed = now ? Math.max(0, Math.min(total, Math.round((Date.parse(utcDay(now)) - Date.parse(since)) / DAY))) : null;
  const rec = now ? Math.max(0, Math.floor((Date.parse(now) - Date.parse(GATE.fallbackFrom)) / DAY)) : null;
  const kn = (f) => (k ? k[f] : null), dn = (f) => (d ? d[f] : null);
  const yes = (v) => (v === true ? "yes" : v === false ? "no" : "unread"), unread = (v) => v === null || v === undefined, bo = attested(ev.backupOpened, now);
  /* a precondition unread is unread (null), never not met: as G9 reads it */
  const pre = (label, v, want, shown, wantShown) => flag(label, shown, wantShown, unread(v) ? null : v === want);
  const prog = {
    G0: [meter("Days of the window", elapsed, total), count("Days to 04 Nov 2026", now ? daysTo(now, GATE.earliest) : null)],
    G1: [count("Loads read", c.loads), count("With a tap line", c.withTap), zero("Not clean", c.loads ? c.badLoads : null)],
    G2: [meter("Taps closed", c.loads ? c.closed : null, GATE.minTaps), meter("New rows", kn("newIds"), GATE.minNewIds), meter("Trips", kn("trips"), 1), meter("Purchases", kn("purchases"), 1), meter("Received", kn("received"), 1)],
    G3: [count("Readchecks read", c.reads), zero("Not green", c.reads ? c.badReads : null)],
    G4: [zero("Approved, unbooked past 10 min", dn("left")), zero("Voided, not rejected", dn("voidedNotRejected") ?? null)],
    G5: [meter("Days recorded", rec, GATE.fallbackDays), zero("Fallbacks", dn("fallbacks"))],
    G6: [count("Parity lines read", c.parity), zero("Not equal", c.parity ? c.badParity : null)],
    G7: [count("Statement comparisons", c.sources), zero("Differ", c.sources ? c.badSources : null), count("Export lines", c.exports), zero("Exports failed", c.badExports),
      flag("Backup opened with your key", bo.date ? myt(bo.date + "T00:00:00.000Z", false) : "not attested", "attested", bo.date ? true : null)],
    G8: [zero("Approved by hand", dn("laptopApprovals")), zero("Folded with no tap booking", dn("foldedUnbooked"))],
    G9: [pre("Migrations 0023 and 0024", p && p.migrations, true, yes(p && p.migrations), "yes"), pre("book_tap", p && p.tap, "on", (p && p.tap) || "unread", "on"),
      pre("book_read", p && p.read, "book", (p && p.read) || "unread", "book"), pre("book_source", p && p.source, "d1", (p && p.source) || "unread", "d1"),
      pre("Export steps on master", p && p.exportSteps, true, yes(p && p.exportSteps), "yes"), pre("Marked before the load", p && p.markBeforeLoad, true, yes(p && p.markBeforeLoad), "yes"),
      pre("Fold handoff in HEAD", p && p.handoff, false, yes(p && p.handoff), "no")],
  };
  const hist = (Array.isArray(history) ? history : []).slice(-8);
  const gates = judged.lines.map((l) => ({ id: l.id, text: l.text, ok: l.ok, detail: scrub(l.detail), progress: prog[l.id] || [], moves: MOVES[l.id] || "",
    trend: hist.map((h) => ({ at: h.at, s: (h.gates && h.gates[l.id]) || "u" })) }));
  const tally = (v) => judged.lines.filter((l) => l.ok === v).length;
  return { ok: judged.ok === true, met: tally(true), notMet: tally(false), unverified: tally(null), total: judged.lines.length,
    now, nowMyt: now ? myt(now) : "unknown", since, runs: (ev.runs || []).length, daysTo: now ? daysTo(now, GATE.earliest) : null,
    g0: (judged.lines.find((l) => l.id === "G0") || {}).ok === true, backReady: opts.wayBack === true || (!!p && p.source === "book"),
    earliest: earliestFlipDay(), backupOpened: bo.date, backupWhy: ev.backupOpened && !bo.date ? scrub(bo.why) : null, error: ev.collectError ? scrub(ev.collectError) : null, gates };
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
    { id: "B3", title: "Way back, nothing compacted", cmd: "node tools/flip.mjs --back \"<your typed words>\" --no-export", when: "Only when the flip stopped at step 6 or before, so nothing was compacted. No export and no pull, but it still seeds the mirror (d1.mjs --seed, a full replace) from this checkout: run it only from a checkout pulled and level with origin/master." },
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
/* the way back is offered only once there is something to go back from: before that, --back would re-seed the mirror from this checkout */
export const BACK_LOCKED = "nothing has flipped; --back would re-seed the mirror from this checkout.";
const textBlock = (cmd) => `<div class="salt-settings"><div class="salt-settings__cell"><pre class="salt-ledger fb-cmd" data-cmd>${esc(cmd)}</pre></div></div>`;
/** the way back's three forms, with Copy only when `ready`; otherwise text, with the chip and the reason (both shapes) */
const backForms = (runbook, ready, word, why) => runbook.back.map((b) => `<div class="salt-stack salt-stack--tight" data-back="${esc(b.id)}"${ready ? "" : ' data-locked=""'}><p class="salt-settings__head">${esc(b.title)} <span class="salt-status salt-status--copper">Typed go</span></p>
${ready ? cmdBlock(b.cmd, false) : textBlock(b.cmd)}<p class="salt-settings__foot">${esc(b.when)}</p>
${ready ? "" : `<p class="salt-settings__foot" data-lock><span class="salt-status salt-status--ember">${esc(word)}</span> ${esc(why)}</p>`}</div>`).join("\n");
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
  return `${pageTop(assets)}
<section class="salt-band" aria-label="Verdict" data-verdict="${view.ok ? "true" : "false"}">
<h2 class="salt-eyebrow salt-eyebrow--brass">The gate reads ${view.ok ? "TRUE" : "NOT TRUE"}</h2>
<div class="salt-row">${chip(s).replace(WORD[s], view.ok ? "True" : "Not true")}</div>
<p class="salt-band__when"><span data-count="met">${view.met}</span> met, <span data-count="not">${view.notMet}</span> not met, <span data-count="unv">${view.unverified}</span> unverified, of ${view.total} lines.${view.ok ? " Every line is met: the flip still needs your typed go." : " Not ready: the flip steps below are locked."}</p>
${view.error ? `<p class="salt-insight salt-insight--alarm"><b>Collect failed</b> ${esc(view.error)}: every line it would have read is Unverified.</p>` : ""}
<div class="salt-band__foot"><span class="salt-kpi__label">Snapshot</span><span class="salt-band__ref" data-now>${esc(view.nowMyt)}</span></div>
</section>
<div class="salt-glance">
${tile("Chain runs read", view.runs, "since " + myt(view.since + "T00:00:00.000Z", false))}
${tile("Days to 04 Nov 2026", view.daysTo === null ? "unknown" : Math.max(0, view.daysTo), view.g0 ? "the earliest day has come" : "the earliest flip day, by the UTC date as G0 reads it")}
${tile("Earliest the gate can read true", view.earliest.myt, "set by " + view.earliest.by + (view.earliest.by === "G5" ? ": seven recorded days" : ""))}
</div>
<p class="salt-settings__head">Refresh this board</p>
${cmdBlock(refresh, false)}
<p class="salt-settings__foot">Add --backup-opened &lt;YYYY-MM-DD&gt; once you have opened a Book backup with your key.</p>
${view.backupWhy ? `<p class="salt-settings__foot" data-backup-why><span class="salt-status salt-status--ember">Not attested</span> ${esc(view.backupWhy)}</p>` : ""}
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
${backForms(runbook, view.backReady, "Locked", BACK_LOCKED)}
</section>

<section class="salt-stack" aria-labelledby="h-not">
<h2 class="salt-eyebrow salt-eyebrow--brass" id="h-not">Not proved by the gate</h2>
<ul class="salt-settings fb-plain">${runbook.notProved.map((t) => `<li class="salt-settings__row salt-settings__row--text"><span class="salt-settings__label">${esc(t)}</span></li>`).join("")}</ul>
</section>
${PAGE_END}`;
}

/** the page's head, its look's segment and its title, the same in both shapes */
function pageTop(assets) {
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
/* layout only, on the system's tokens, no colour, face or token set here; each is a gap logged in docs/DESK.md (the flip board) for salt-ds:
   a page column, the padded root's phone gutter, the browser's own margins, a card that may shrink, a bare list, a code block */
.fb-main { max-width: 75rem; margin: 0 auto; gap: var(--salt-space-6); }
@media (max-width: 560px) { body.salt-root--padded { padding: var(--salt-space-4); } }
.fb-main p, .fb-h { margin: 0; }
.fb-main article { min-width: 0; overflow-wrap: anywhere; }
.fb-plain { list-style: none; margin: 0; padding: 0; }
.fb-cmd { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
</head>
<body class="salt-root salt-root--padded">
<div class="salt-aurora salt-aurora--page salt-aurora--fixed" aria-hidden="true"><div class="salt-aurora__blob salt-aurora__blob--copper"></div><div class="salt-aurora__blob salt-aurora__blob--brass"></div></div>
<main class="salt-root__content salt-stack fb-main">
<header class="salt-stack">
<div class="salt-row"><p class="salt-eyebrow salt-eyebrow--copper">Salt Command · S5f</p>
<div class="salt-segment" role="radiogroup" aria-label="Theme" style="--n:2;--i:1"><button type="button" class="salt-segment__opt" role="radio" aria-checked="false" data-look="night">Night</button><button type="button" class="salt-segment__opt" role="radio" aria-checked="true" data-look="tide">Tide</button></div></div>
<h1 class="salt-title salt-title--sm">Flip gate</h1>`;
}

const PAGE_END = `</main>
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
  var reset = document.querySelector("[data-reset]");
  if (reset) reset.addEventListener("click", function () {
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

/* ---- AFTER THE FLIP (14 Nov 2026, his word "Flipped record + health") ---- */

/** the flipped shape is taken on evidence alone: book_source READ as book. Unread or d1 is never flipped, whatever is on disk (flip.mjs writes its way-back file before any flag moves) */
export const flippedOf = (pre) => !!pre && pre.source === "book";

/** flip.mjs's way-back file, for the record: when it was written, the Book's revision then, the sha and the flags as they stood; his typed words are never read out of it. null when missing or unreadable */
export function readWayBack(file) {
  try {
    const w = JSON.parse(readFileSync(file, "utf8")); if (!w || typeof w !== "object") return null;
    const at = Date.parse(w.writtenAt);
    return { writtenAt: Number.isFinite(at) ? new Date(at).toISOString() : null, bookRev: Number.isInteger(w.bookRev) ? w.bookRev : null, sha: /^[0-9a-f]{7,40}$/.test(String(w.sha)) ? String(w.sha).slice(0, 8) : null,
      flags: w.flags && typeof w.flags === "object" ? Object.fromEntries(Object.entries(w.flags).filter(([k, v]) => /^book_[a-z]+$/.test(k) && /^[a-z0-9]{1,8}$/.test(String(v)))) : null };
  } catch (e) { return null; }
}

/** the flip as the record has it (docs/DESK.md "The flip ran on 10 Nov 2026"; MEMORY.md "THE FLIP RAN"): his words of record, not read live. Commit shas only, never a run id */
export const RECORD = {
  on: "2026-11-10", wayBack: "10 Nov 2026, 02:57:10 MYT", from: "docs/DESK.md, \"The flip ran on 10 Nov 2026\"",
  rows: [["Roster watermark", "seq 177, pushed as 2033e25d"], ["Compaction", "compacted 0, marked 177"], ["First export", "revision 368, 400 rows (347 sales, 53 purchases), pushed as ef61381"],
    ["Verify", "ok at 03:29 MYT"], ["First tap after the flip", "a stock count approved 03:49 MYT, booked at seq 178, no fallback; verify ok again at 04:10 MYT"]],
  since: ["git is the Book's daily export: the day's run writes ledger/book.json from the Book.", "The fold and D1's mirror stand still: the readcheck counts its differences as the frozen mirror.",
    "drafts.mjs --approve, update.mjs and d1.mjs --seed refuse while book_source reads book."],
};

const run = (cmd, args) => { const r = spawnSync(cmd, args, { cwd: REPO, encoding: "utf8", shell: shellFor(cmd), maxBuffer: 64 * 1024 * 1024 }); return { code: r.status === null ? 1 : r.status, out: (r.stdout || "") + (r.stderr || "") }; };
/** the io flip.mjs's health reads through: the gate's D1 read (tried again before it is unread) and the Book's GET, a throw answered as no answer (unread). A 200 that is not the
    route's own answer (no boolean ok: Access's login page, which fetch follows to when no key or login is set; 14 Nov 2026) is no answer either, never a readcheck that failed */
export function boardIo(get = realGet(), d1 = (sql) => gateD1(sql, run)) {
  const answered = (r) => (r && r.status === 200 && (!r.body || typeof r.body.ok !== "boolean") ? { status: 0, body: {} } : r);
  return { d1: (sql) => { const rows = d1(sql); return rows ? { rows } : { error: "unread" }; }, get: async (p) => { try { return answered(await get(p)); } catch (e) { return { status: 0, body: {} }; } } };
}

export const DAY_STEP = "Export the Book to git (the day's record)", EXPORT_HOURS = 30;
/** the newest chain run of the last EXPORT_HOURS whose day's export step ran (not skipped), off gh's step list; null when Actions cannot be read. Reads only */
export function collectExport(now, sh = run, limit = 60) {
  const list = sh("gh", ["run", "list", "--workflow", "cloud-commit.yml", "--limit", String(limit), "--json", "databaseId,createdAt,status"]);
  let rows = null; try { rows = list.code === 0 ? JSON.parse(list.out) : null; } catch (e) { rows = null; }
  if (!Array.isArray(rows)) return null;
  const from = Date.parse(now) - EXPORT_HOURS * 36e5, inWin = rows.filter((r) => Date.parse(r.createdAt) >= from).sort((x, y) => Date.parse(y.createdAt) - Date.parse(x.createdAt));
  let unread = rows.length >= limit && inWin.length === rows.length ? 1 : 0;   /* the list ran out inside the window: an older run there was never seen */
  for (const r of inWin.filter((x) => x.status === "completed")) {
    let steps; try { const v = sh("gh", ["run", "view", String(r.databaseId), "--json", "jobs"]); steps = JSON.parse(v.out).jobs.flatMap((j) => j.steps || []); } catch (e) { unread++; continue; }
    const s = steps.find((x) => x.name === DAY_STEP);
    if (s && s.conclusion && s.conclusion !== "skipped") return { at: r.createdAt, conclusion: s.conclusion, unread };
  }
  const last = sh("git", ["log", "origin/master", "--grep", "^Book export ", "-1", "--format=%cI"]), lt = Date.parse(String(last.out).trim());
  return { at: null, conclusion: null, unread, lastCommit: last.code === 0 && Number.isFinite(lt) ? new Date(lt).toISOString() : null };
}

/** the day's export, judged: true only when the newest that ran in the window succeeded; none in the window is false, unless a run there could not be read */
export function exportCheck(ex) {
  if (!ex) return { ok: null, detail: "Actions unread", last: null };
  if (ex.at) return { ok: ex.conclusion === "success", detail: (ex.conclusion === "success" ? "" : ex.conclusion + " ") + myt(ex.at), last: null };
  return { ok: ex.unread ? null : false, detail: "none in " + EXPORT_HOURS + " hours" + (ex.unread ? ", " + ex.unread + " unread" : ""), last: ex.lastCommit ? "the last in git " + myt(ex.lastCommit) : null };
}

export const HEALTH = [["source", "book_source book"], ["roster", "book_roster on"], ["tap", "book_tap on"], ["read", "book_read book"],
  ["readcheck", "Readcheck, nothing stuck"], ["unbooked", "Approved, unbooked: 0"], ["fallbacks", "Fallbacks today: 0"], ["export", "Day's export, 30 hours"]];
/** the readings from flip.mjs's health (null when it could not run) and the day's export: Healthy only when every reading is true, Not healthy when one is false, else Unverified */
export function healthOf(h, ex) {
  const by = Object.fromEntries(((h && Array.isArray(h.checks)) ? h.checks : []).map((c) => [c.id, c]));
  const tri = (v) => (v === true ? true : v === false ? false : null);
  const said = (c) => { const g = c && c.got; if (!c || c.ok === null) return "unread"; if (c.id !== "readcheck") return g === null || g === undefined ? "unread" : typeof g === "number" ? String(g) : "reads " + g;
    return `${g.source === "book" ? "" : (g.source || "no source") + ", "}rev ${g.rev === null ? "unread" : g.rev}, ${g.sick} stuck, ${g.frozenMirror} frozen`; };
  const items = HEALTH.map(([id, label]) => { if (id === "export") { const e = exportCheck(ex); return { id, label, ok: e.ok, detail: scrub(e.detail), last: e.last }; } const c = by[id]; return { id, label, ok: c ? tri(c.ok) : null, detail: scrub(said(c)) }; });
  return { ok: items.some((i) => i.ok === false) ? false : items.every((i) => i.ok === true) ? true : null, items, rev: by.readcheck && by.readcheck.ok !== null && by.readcheck.got ? by.readcheck.got.rev : null };
}

/** the flipped shape's data. Pure: the clock is ev.now. ev: {now, pre, health (flip.mjs health), export (collectExport), wayBack (readWayBack)}. The gate is the pre-flip record: its
 * lines' words from the judge run over no evidence, a mark only from a snapshot the history kept in the day before the way back was written, never judged again. */
export function flippedView(ev, history = [], opts = {}) {
  const now = ev.now || null, way = ev.wayBack || null, at = way && way.writtenAt ? way.writtenAt : null;
  const over = opts.flippedOn ? attested(opts.flippedOn, now) : null;
  const onShown = over && over.date ? myt(over.date + "T00:00:00.000Z", false) : at ? myt(at, false) : myt(RECORD.on + "T00:00:00.000Z", false);
  const snap = at ? (Array.isArray(history) ? history : []).filter((s) => s && s.gates && Date.parse(s.at) < Date.parse(at) && Date.parse(s.at) >= Date.parse(at) - DAY).sort((x, y) => Date.parse(x.at) - Date.parse(y.at)).pop() || null : null;
  const gates = judge({}).lines.map((l) => ({ id: l.id, text: l.text, s: snap ? (["m", "n", "u"].includes(snap.gates[l.id]) ? snap.gates[l.id] : "u") : null }));
  const h = healthOf(ev.health, ev.export);
  return { flipped: true, now, nowMyt: now ? myt(now) : "unknown", onShown, onFrom: over && over.date ? "your --flipped-on" : at ? "the way-back file" : "the record", flippedOnWhy: over && !over.date ? scrub(over.why) : null,
    wayAt: at ? myt(at, true, true) : null, way, daysSince: now ? Math.max(0, Math.floor((Date.parse(now) - Date.parse(at || RECORD.on + "T00:00:00+08:00")) / DAY)) : null,
    health: h, gates, snap: snap ? { at: snap.at, ok: snap.ok === true } : null, backReady: !!way };
}

const STEP_DONE = (id, title) => `<li class="salt-settings__row salt-settings__row--text" data-step="${esc(id)}"><span class="salt-settings__label">${esc(id)} ${esc(title)}</span><span class="salt-status salt-status--verdigris">Done</span></li>`;
const ROW = (label, value, attr = "") => `<div class="salt-settings__row salt-settings__row--text"${attr}><span class="salt-settings__label">${esc(label)}: ${esc(value)}</span></div>`;
const HWORD = { m: "Healthy", n: "Not healthy", u: "Unverified" };

/** the flipped page: the verdict is the flip and the Book's health; the runbook a record; the way back; the gate as the pre-flip record. Everything inlined, as renderPage */
export function renderFlipped(view, runbook = RUNBOOK, assets = loadAssets()) {
  const h = view.health, hs = STATE(h.ok), tally = (v) => h.items.filter((i) => i.ok === v).length, w = view.way, exp = h.items.find((i) => i.id === "export");
  const tile = (label, value, note) => `<div class="salt-glance__item"><span class="salt-glance__label">${esc(label)}</span><span class="salt-glance__value">${esc(value)}</span>${note ? `<span class="salt-glance__note">${esc(note)}</span>` : ""}</div>`;
  const said = h.ok === true ? "Every reading is healthy: the Book is the source and books the taps." : h.ok === false ? "A reading is not healthy: read it below, and the way back below that." : "Not every reading could be made, and none unread is taken as healthy.";
  const record = [ROW("Way back written", view.wayAt ? view.wayAt : RECORD.wayBack + " (the record)", ' data-rec="way"'), w && w.bookRev !== null ? ROW("Book revision at the way back", w.bookRev) : "", w && w.sha ? ROW("Checkout at the way back", w.sha) : "",
    ROW("book_source", "book, read live"), ...RECORD.rows.map(([k, v]) => ROW(k, v))].filter(Boolean).join("\n");
  const pf = PLAN.filter((s) => s[0] !== "8").map(([n, t]) => STEP_DONE("S" + n, t)), last = PLAN.find(([n]) => n === "8");
  return `${pageTop(assets)}
<section class="salt-band" aria-label="Verdict" data-verdict="flipped" data-health="${hs}">
<h2 class="salt-eyebrow salt-eyebrow--brass">Flipped ${esc(view.onShown)}</h2>
<div class="salt-row">${chip(hs).replace(WORD[hs], HWORD[hs])}</div>
<p class="salt-band__when"><span data-count="ok">${tally(true)}</span> healthy, <span data-count="not">${tally(false)}</span> not healthy, <span data-count="unv">${tally(null)}</span> unverified, of ${h.items.length} readings. ${esc(said)}</p>
<div class="salt-band__foot"><span class="salt-kpi__label">Snapshot</span><span class="salt-band__ref" data-now>${esc(view.nowMyt)}</span></div>
</section>
<div class="salt-glance">
${tile("Days since the flip", view.daysSince === null ? "unknown" : view.daysSince, "flipped " + view.onShown + ", from " + view.onFrom)}
${tile("Book revision", h.rev === null || h.rev === undefined ? "unread" : h.rev, "the readcheck's, live")}
${tile("The day's export", exp.ok === true ? "ran" : exp.ok === false ? "not in 30 hours" : "unread", exp.last || exp.detail)}
</div>
${view.flippedOnWhy ? `<p class="salt-settings__foot" data-flipped-why><span class="salt-status salt-status--ember">Not taken</span> --flipped-on ${esc(view.flippedOnWhy)}</p>` : ""}
<p class="salt-settings__head">Refresh this board</p>
${cmdBlock("node tools/flip-board.mjs", false)}
</header>

<section class="salt-stack" aria-labelledby="h-health">
<h2 class="salt-eyebrow salt-eyebrow--brass" id="h-health">Live health</h2>
<ul class="salt-settings fb-plain">
${h.items.map((i) => `<li class="salt-settings__row" data-item="${esc(i.id)}" data-state="${STATE(i.ok)}"><span class="salt-settings__text"><span class="salt-settings__label">${esc(i.label)}</span><span class="salt-settings__sub" title="${esc(i.detail)}">${esc(i.detail)}</span></span>${chip(STATE(i.ok))}</li>`).join("\n")}
</ul>
<p class="salt-settings__foot">What node tools/flip.mjs --verify reads (it writes nothing), with book_tap and book_read beside it and the day's export off the chain's step list. A reading that could not be made is Unverified, never Met.</p>
</section>

<section class="salt-stack" aria-labelledby="h-record">
<h2 class="salt-eyebrow salt-eyebrow--brass" id="h-record">The flip, as recorded</h2>
<div class="salt-settings">
${record}
</div>
<p class="salt-settings__foot">From ${esc(RECORD.from)}; the way back's time, revision and checkout from 10_Data/flip-way-back.json${w ? "" : ", which is not on this laptop"}.</p>
<p class="salt-settings__head">Since the flip</p>
<ul class="salt-settings fb-plain">${RECORD.since.map((t) => `<li class="salt-settings__row salt-settings__row--text"><span class="salt-settings__label">${esc(t)}</span></li>`).join("")}</ul>
</section>

<section class="salt-stack" aria-labelledby="h-back">
<h2 class="salt-eyebrow salt-eyebrow--brass" id="h-back">The way back</h2>
<p class="salt-settings__foot">flip.mjs wrote the way back first, to 10_Data/flip-way-back.json. --back never turns book_outbox, and every form seeds D1's mirror (d1.mjs --seed, a full replace).</p>
${backForms(runbook, view.backReady, "Text only", BACK_NO_FILE)}
</section>

<section class="salt-stack" aria-labelledby="h-run">
<h2 class="salt-eyebrow salt-eyebrow--brass" id="h-run">The runbook, as run</h2>
<ol class="salt-settings fb-plain">
${runbook.pre.map((p) => STEP_DONE(p.id, p.title)).join("\n")}
${STEP_DONE(runbook.go.id, runbook.go.title)}
${pf.join("\n")}
${STEP_DONE("S8", last[1])}
</ol>
<p class="salt-settings__foot">The record, not a to-do: from ${esc(RECORD.from)}. Nothing here is ticked or kept.</p>
</section>

<section class="salt-stack" aria-labelledby="h-gate">
<h2 class="salt-eyebrow salt-eyebrow--brass" id="h-gate">The gate, G0 to G9: pre-flip record, not live</h2>
<p class="salt-settings__foot" data-pre-flip>Not judged again: after the flip G9 reads book_source book by design. flip.mjs --go starts only once the gate reads true${view.wayAt ? ", so it read true when the way back was written, " + esc(view.wayAt) : ""}. ${view.snap ? "The marks are the last snapshot kept before it, " + esc(myt(view.snap.at)) + "." : "No pre-flip snapshot kept: the lines are shown without marks."}</p>
<ul class="salt-settings fb-plain">
${view.gates.map((g) => `<li class="salt-settings__row salt-settings__row--text" data-gate="${esc(g.id)}" data-state="${g.s || "none"}"><span class="salt-settings__label">${esc(g.id)} ${esc(g.text)}</span>${g.s ? chip(g.s) : ""}</li>`).join("\n")}
</ul>
</section>
${PAGE_END}`;
}
export const BACK_NO_FILE = "the way-back file is not on this laptop, or cannot be read: the commands are text until it is back.";

/** the system's own stylesheet and faces, read from the repo's vendored copy, the faces as data URIs */
export function loadAssets() {
  const css = readFileSync(join(REPO, "design", "salt-ds.css"), "utf8");
  const fonts = readFileSync(join(REPO, "design", "fonts.css"), "utf8").replace(/url\(fonts\/([\w.-]+\.woff2)\)/g, (m, f) => `url(data:font/woff2;base64,${readFileSync(join(REPO, "design", "fonts", f)).toString("base64")})`);
  return { css, fonts };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const a = process.argv.slice(2), val = (f) => { const i = a.indexOf(f); return i >= 0 ? a[i + 1] : null; };
  let ev = val("--offline") ? JSON.parse(readFileSync(val("--offline"), "utf8")) : null;
  /* the shape follows book_source as read: flipped only when it reads book (an unread source keeps the gate's shape, which claims nothing) */
  let pre = ev ? ev.pre : null;
  if (!ev) { try { pre = collectPre(run); } catch (e) { pre = null; } }
  if (flippedOf(pre)) {
    if (!ev) { const now = new Date().toISOString(); let h = null; try { h = await health(boardIo(), { steady: true }); } catch (e) { h = null; } ev = { now, pre, health: h, export: collectExport(now) }; }
    if (!("wayBack" in ev)) ev.wayBack = readWayBack(WAY_BACK);
    /* the gate's history is read for the pre-flip record and never written once flipped: the gate is not judged again */
    const view = flippedView(ev, readHistory(val("--history") || (val("--offline") ? "" : HISTORY)), { flippedOn: val("--flipped-on") });
    const out = resolve(val("--out") || OUT);
    if (!existsSync(dirname(out))) mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, renderFlipped(view));
    console.log(`  Flipped ${view.onShown}; health ${HWORD[STATE(view.health.ok)]}: ${view.health.items.map((i) => i.id + " " + HWORD[STATE(i.ok)]).join(", ")}`);
    console.log("  " + pathToFileURL(out).href);
  } else {
  if (!ev) {
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
  writeFileSync(out, renderPage(viewOf(ev, judged, history, { wayBack: existsSync(WAY_BACK) })));
  console.log(`  The gate reads ${judged.ok ? "TRUE" : "NOT TRUE"}: ${judged.lines.map((l) => l.id + " " + WORD[STATE(l.ok)]).join(", ")}`);
  console.log("  " + pathToFileURL(out).href);
  }
}
