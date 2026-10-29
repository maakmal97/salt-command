#!/usr/bin/env node
/* tools/flip-gate.mjs: S5f-7 OF THE BOOK PLAN, THE GATE BEFORE THE FLIP, READ OFF THE EVIDENCE (29 Oct 2026; docs/plan-book-s5-s6.html, "The gate before the flip"). It decides nothing and flips nothing: it reads, and prints each line
 * of the gate as true, false or UNVERIFIED with what it read, and exits 0 only when every line is true. The flip itself (tools/flip.mjs) runs it first and refuses unless it exits 0.
 *
 * Evidence, and where each comes from (counts and codes only; the Actions log is public and so is this output):
 *   the chain's logs   every cloud-commit.yml run in the window: "Book loaded: ... tap: N closed, M open" (G1, G2), "Book readcheck: ..." (G3), "Pricing parity: ... equals" (G6), "Book export: ..." (G7)
 *   D1                 the drafts decided in the window and how the tap booked them (G2, G4, G5, G8), the flags and migrations (G9)
 *   his word           the Book backup opened with his key (G7): `--backup-opened YYYY-MM-DD`, an attestation, never inferred
 * A line whose evidence cannot be read is UNVERIFIED (null), never true: a gate that guesses is not one. The window starts at `--since` (default 28 Oct 2026, the day the tap went on) and the earliest flip is 4 Nov 2026.
 *
 *   node tools/flip-gate.mjs [--since YYYY-MM-DD] [--backup-opened YYYY-MM-DD] [--json]        (needs gh and wrangler, like the tools that read the same things) */
import "./cloudflare.mjs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { d1Rows, commandArgs } from "./d1json.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/* `fallbackFrom`: the moment the version that records an approval's fall back to the fold went live (S5f-7 noteFallback); a fallback before it left no trace, so G5 reads only over the days since, and needs seven of them. */
export const GATE = { since: "2026-10-28", earliest: "2026-11-04", minTaps: 20, minNewIds: 5, fallbackFrom: "2026-10-29T12:00:00.000Z", fallbackDays: 7 };

/** the chain's load, readcheck, pricing-parity and export lines out of one run's log text (a line carries its text after a timestamp) */
export function parseLog(text) {
  const out = { loads: [], readchecks: [], parity: [], sources: [], exports: [] };
  for (const raw of String(text || "").split("\n")) {
    const l = raw.replace(/^.*?\d{4}-\d\d-\d\dT[\d:.]+Z\s?/, "");
    let m;
    if (/Book loaded:|Book NOT loaded:/.test(l)) out.loads.push({ line: l, ok: /Book loaded:/.test(l), closed: (m = /tap: (\d+) closed, (\d+) open/.exec(l)) ? +m[1] : null, open: m ? +m[2] : null,
      bad: /FOLD BOOKED DIFFERENTLY|STUCK|CLASH|CLASHING|parity FAILED|parity NOT CHECKED/i.test(l), agrees: /agrees with git/.test(l) });
    else if (/Book readcheck:/.test(l)) out.readchecks.push({ line: l, ok: /agree over/.test(l) && !/DIFFER|differ|FAILED|would be refused/.test(l.replace(/compaction would hold/, "")) });
    else if (/Book source:/.test(l)) out.sources.push({ line: l, ok: /equal those built from git/.test(l) });
    else if (/Pricing parity:/.test(l)) out.parity.push({ line: l, ok: /equals the page's/.test(l) });
    else if (/Book export( FAILED|:)/.test(l)) out.exports.push({ line: l, ok: !/FAILED/.test(l) });
  }
  return out;
}

/** the gate, from evidence: { runs: [{id, at, event, log: parseLog()}], d1: {...}, backupOpened, now }. Pure. Answers {ok, lines: [{id, text, ok: true|false|null, detail}]}. */
export function judge(ev, cfg = GATE) {
  const L = [], line = (id, text, ok, detail) => L.push({ id, text, ok, detail });
  const runs = ev.runs || [], loads = runs.flatMap((r) => r.log.loads), reads = runs.flatMap((r) => r.log.readchecks), par = runs.flatMap((r) => r.log.parity), srcs = runs.flatMap((r) => r.log.sources || []), exps = runs.flatMap((r) => r.log.exports);
  const d = ev.d1 || null;
  line("G0", "the earliest day, 4 Nov 2026, has come", ev.now ? ev.now.slice(0, 10) >= cfg.earliest : null, "today is " + (ev.now || "unknown").slice(0, 10));
  /* G1 */
  const withTap = loads.filter((l) => l.closed !== null), badLoads = loads.filter((l) => !l.ok || l.bad || !l.agrees || (l.open !== null && l.open !== 0));
  line("G1", "every load says tap: N closed, 0 open (a load with no entry open has no tap line), and no difference, stuck, clash or parity failure", !loads.length ? null : !badLoads.length && withTap.length >= 1, loads.length + " loads read, " + withTap.length + " with a tap line, " + badLoads.length + " not clean" + (badLoads[0] ? ": " + badLoads[0].line.slice(0, 160) : ""));
  /* G2 */
  const closed = withTap.reduce((a, l) => a + l.closed, 0);
  const k = d && d.kinds;
  line("G2", `at least ${cfg.minTaps} taps closed, ${cfg.minNewIds} of them new rows with a minted rid (a new sale, purchase or loan: an Add ID is the fold's alone until the roster flag is on), one trip, one purchase lot and one Received`,
    !loads.length || !k ? null : closed >= cfg.minTaps && k.newIds >= cfg.minNewIds && k.trips >= 1 && k.purchases >= 1 && k.received >= 1,
    `${closed} closed by loads; booked by the tap in the window: ${k ? `${k.booked} rows, ${k.newIds} new rows (a sale, purchase or loan that minted its own rid), ${k.trips} trip rows, ${k.purchases} purchases, ${k.received} Received` : "unread"}`);
  /* G3 */
  const badReads = reads.filter((r) => !r.ok);
  line("G3", "the readcheck green at every load", !reads.length ? null : !badReads.length, reads.length + " readchecks read, " + badReads.length + " not green" + (badReads[0] ? ": " + badReads[0].line.slice(0, 160) : ""));
  /* G4 */
  line("G4", "the minute net's left at 0 (no approved draft waiting unbooked past ten minutes) and nothing voided but after a rejection", !d || d.voidedNotRejected === null || d.voidedNotRejected === undefined ? null : d.left === 0 && d.voidedNotRejected === 0,
    d ? `${d.left} approved and unbooked past ten minutes; ${d.voidedNotRejected === null || d.voidedNotRejected === undefined ? "entries voided whose draft was not rejected: UNREAD (the readcheck answered none)" : d.voidedNotRejected + " entries voided whose draft was not rejected"}` : "D1 unread");
  /* G5 */
  const recorded = ev.now && cfg.fallbackFrom ? Math.floor((Date.parse(ev.now) - Date.parse(cfg.fallbackFrom)) / 864e5) : null;
  line("G5", `zero approvals that fell back to the fold (the Book refused a rule the fold would take), over ${cfg.fallbackDays} days that were recorded`, !d ? null : d.fallbacks > 0 ? false : recorded !== null && recorded >= cfg.fallbackDays ? true : null,
    d ? `${d.fallbacks} approvals recorded as fallen back; recording began ${cfg.fallbackFrom}, ${recorded === null ? "unknown" : recorded + " of " + cfg.fallbackDays} days ago (an earlier fallback left no trace)` : "D1 unread");
  /* G6 */
  const badPar = par.filter((p) => !p.ok);
  line("G6", "the Worker's PRICING equal to the page's at every load, after a lot included", !par.length ? null : !badPar.length, par.length + " parity lines read, " + badPar.length + " not equal" + (badPar[0] ? ": " + badPar[0].line.slice(0, 160) : ""));
  /* G7 */
  /* before the flip the export cannot have run (it runs only with the Book as the source), so what proves the Book exports git's own book is the per-fold comparison of the statements built from each (the S5e step); any export line that exists must be clean too */
  const badExp = exps.filter((e) => !e.ok), badSrc = srcs.filter((s) => !s.ok);
  line("G7", "the Book builds git's own statements at every fold, any export that ran is clean, and one Book backup opened with his key", !srcs.length || !ev.backupOpened ? null : !badSrc.length && !badExp.length, srcs.length + " statement comparisons read, " + badSrc.length + " differ; " + exps.length + " export lines, " + badExp.length + " failed; backup opened: " + (ev.backupOpened || "NOT ATTESTED (--backup-opened YYYY-MM-DD)"));
  /* G8 */
  line("G8", "no drafts.mjs --approve run in the window, and no row folded by the laptop", !d ? null : d.laptopApprovals === 0 && d.foldedUnbooked === 0, d ? `${d.laptopApprovals} approved by hand; ${d.foldedUnbooked} approved rows committed by the fold with no tap booking` : "D1 unread");
  /* G9 */
  const p = ev.pre || null;
  line("G9", "the flip's own preconditions stand: migrations 0023 and 0024 applied, book_tap on, book_read book, book_source d1, the export steps in the chain on master, no fold handoff in HEAD", !p ? null :
    p.migrations && p.tap === "on" && p.read === "book" && p.source === "d1" && p.exportSteps && !p.handoff, p ? JSON.stringify(p) : "unread");
  return { ok: L.every((x) => x.ok === true), lines: L, window: { since: ev.since || cfg.since, runs: runs.length } };
}

/* ---- the collectors: each answers its evidence or null, and says so ---- */
const sh = (cmd, args, input) => { const r = spawnSync(cmd, args, { cwd: REPO, encoding: "utf8", shell: process.platform === "win32", maxBuffer: 256 * 1024 * 1024, input }); return { code: r.status === null ? 1 : r.status, out: (r.stdout || "") + (r.stderr || "") }; };
export function d1(sql, run = sh) { const r = d1Rows(run("npx", ["wrangler", "d1", "execute", "salt_ledger", "--remote", "--json", ...commandArgs(sql)])); return r.error ? null : r.rows; }

/** the chain's runs in the window, each with its parsed log (gh; the log of a run is available once it has finished) */
export function collectRuns(since, run = sh) {
  const list = run("gh", ["run", "list", "--workflow", "cloud-commit.yml", "--limit", "300", "--json", "databaseId,createdAt,event,conclusion,status"]);
  let rows; try { rows = JSON.parse(list.out); } catch (e) { return null; }
  const out = [];
  for (const r of rows.filter((x) => x.createdAt >= since && x.status === "completed")) {
    const l = run("gh", ["run", "view", String(r.databaseId), "--log"]);
    if (l.code === 0) out.push({ id: r.databaseId, at: r.createdAt, event: r.event, log: parseLog(l.out) });
  }
  return out;
}

export function collectD1(since, run = sh) {
  const q = (sql) => d1(sql, run);
  const kinds = q(`SELECT COUNT(*) AS booked, SUM(collection IN ('sales','purchases','loan') AND amends IS NULL) AS newIds, SUM(json_extract(row,'$.trip') IS NOT NULL) AS trips, SUM(collection='purchases' AND amends IS NULL) AS purchases, SUM(amends IS NOT NULL AND amend_kind IN ('Payment','Fulfilment')) AS received FROM draft WHERE status='approved' AND decided_at >= '${since}' AND json_extract(CASE WHEN json_valid(row) THEN row ELSE '{}' END,'$.booked_seq') IS NOT NULL`);
  const left = q(`SELECT COUNT(*) AS n FROM draft WHERE status='approved' AND committed_at IS NULL AND decided_at < strftime('%Y-%m-%dT%H:%M:%fZ','now','-10 minutes') AND json_extract(CASE WHEN json_valid(row) THEN row ELSE '{}' END,'$.booked_seq') IS NULL`);
  const fb = q(`SELECT COUNT(*) AS n, MIN(json_extract(row,'$.tap_fallback.at')) AS first FROM draft WHERE json_extract(CASE WHEN json_valid(row) THEN row ELSE '{}' END,'$.tap_fallback') IS NOT NULL AND decided_at >= '${since}'`);
  /* from the first approval the tap booked, and never the fold's alone (an Add ID or a rename is the fold's until the roster flag is on): a row approved before the tap was on, or one only the fold may book, is not a hand approval */
  const hand = q(`SELECT SUM(decided_by LIKE '%laptop%' OR decided_by LIKE '%drafts.mjs%' OR decided_by LIKE '%hand%') AS h, SUM(committed_at IS NOT NULL AND collection NOT IN ('roster','rename') AND json_extract(CASE WHEN json_valid(row) THEN row ELSE '{}' END,'$.booked_seq') IS NULL) AS f FROM draft WHERE status='approved' AND decided_at >= MAX('${since}', COALESCE((SELECT MIN(decided_at) FROM draft WHERE json_extract(CASE WHEN json_valid(row) THEN row ELSE '{}' END,'$.booked_seq') IS NOT NULL), '${since}'))`);
  if (!kinds || !left || !fb || !hand) return null;
  return { kinds: { booked: +kinds[0].booked || 0, newIds: +kinds[0].newIds || 0, trips: +kinds[0].trips || 0, purchases: +kinds[0].purchases || 0, received: +kinds[0].received || 0 },
    left: +left[0].n || 0, voidedNotRejected: null, fallbacks: +fb[0].n || 0, fallbackSince: fb[0].first || null, laptopApprovals: +hand[0].h || 0, foldedUnbooked: +hand[0].f || 0 };
}

export function collectPre(run = sh) {
  const flag = (t) => { const r = d1(`SELECT mode FROM ${t} WHERE one=1`, run); return r && r[0] ? r[0].mode : null; };
  const tbl = d1("SELECT name FROM sqlite_master WHERE name IN ('book_source') OR (name='draft' AND sql LIKE '%''edit''%')", run);
  const yml = run("git", ["show", "origin/master:.github/workflows/cloud-commit.yml"]);
  const handoff = run("git", ["ls-tree", "-r", "--name-only", "origin/master", "master/_to_fold.json", "master/_folded.json"]);
  return { migrations: !!(tbl && tbl.length >= 2), tap: flag("book_tap"), read: flag("book_read"), source: flag("book_source"),
    exportSteps: yml.code === 0 && /Export the Book to git \(the day's record\)/.test(yml.out) && /Export the Book to the checkout for the publish/.test(yml.out), handoff: handoff.code === 0 && handoff.out.trim().length > 0 };
}

/** the readcheck's count of entries voided whose draft was not rejected (GET /book/readcheck), or null: it needs the Book's key like every tool that reads the Book */
export async function collectVoided(get) {
  try { const r = await get("/book/readcheck"); return r && r.status === 200 && Number.isInteger(r.body.voidedUnrejected) ? r.body.voidedUnrejected : null; } catch (e) { return null; }
}

export async function collect(opts = {}, run = sh, get = opts.get) {
  const since = (opts.since && opts.since.length > 10 ? opts.since : (opts.since || GATE.since) + "T00:00:00.000Z");
  const d = collectD1(since, run);
  if (d && get) d.voidedNotRejected = await collectVoided(get);
  return { since, now: new Date().toISOString(), backupOpened: opts.backupOpened || null, runs: collectRuns(since, run) || [], d1: d, pre: collectPre(run) };
}

export const say = (r) => r.lines.map((x) => `  ${x.ok === true ? "ok        " : x.ok === false ? "NOT MET   " : "UNVERIFIED"} ${x.id}  ${x.text}\n              ${x.detail}`).join("\n") + `\n\n  The gate reads ${r.ok ? "TRUE" : "NOT TRUE"} over ${r.window.runs} chain runs since ${String(r.window.since).slice(0, 10)}.`;

/** a GET of the Book's keyed routes (the readcheck), for the gate. It lives here and not in flip.mjs: flip.mjs imports this file, so a command line
    that imported flip.mjs back deadlocked on the cycle and exited 13 with "unsettled top-level await" (29 Oct 2026). flip.mjs re-exports it. */
export function realGet(env = process.env) {
  const base = (env.SALT_BASE || "https://salt-command.qyts8mh72kyg.workers.dev").replace(/\/+$/, "");
  return async (path) => {
    const h = { "X-Book-Key": String(env.SALT_BOOK_KEY || "") };
    if (env.CF_ACCESS_CLIENT_ID && env.CF_ACCESS_CLIENT_SECRET) { h["CF-Access-Client-Id"] = env.CF_ACCESS_CLIENT_ID; h["CF-Access-Client-Secret"] = env.CF_ACCESS_CLIENT_SECRET; }
    const r = await fetch(base + path, { headers: h }); return { status: r.status, body: await r.json().catch(() => ({})) };
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const a = process.argv.slice(2), val = (f) => { const i = a.indexOf(f); return i >= 0 ? a[i + 1] : null; };
  const r = judge(await collect({ since: val("--since"), backupOpened: val("--backup-opened"), get: realGet() }));
  console.log(a.includes("--json") ? JSON.stringify(r, null, 1) : say(r));
  process.exit(r.ok ? 0 : 1);
}
