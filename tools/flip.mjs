#!/usr/bin/env node
/* tools/flip.mjs: S5f-7 OF THE BOOK PLAN, THE FLIP AND ITS WAY BACK (29 Oct 2026; docs/plan-book-s5-s6.html, "The flip and its way back"). THE FLIP IS NOT RUN BY ANYTHING BUT THIS, AND ONLY ON HIS TYPED GO: this session built it and ran
 * none of it. Read docs/DESK.md "The flip (S5f)" first.
 *
 * DRY RUN BY DEFAULT. With no flag it reads, checks and prints the plan, every command it would run in order, and writes nothing, anywhere. `--go "<his typed words>"` runs it, once, and only when every precondition below stands:
 *   1  the gate reads TRUE (tools/flip-gate.mjs), which includes 4 Nov 2026 having come
 *   2  this checkout is level with origin/master, no cloud-commit run is in progress or queued, and no approved draft waits unbooked (the fold has nothing left to take: "fold once more, read 0")
 * THE WAY BACK IS WRITTEN FIRST (step 0), before any flag moves: 10_Data/flip-way-back.json, holding the flags as they stand, the Book's revision, the sha and the commands, so a run that
 * stops halfway can be undone by `--back` without this tool's memory. Then, in order, each step checked before the next, a failure stops the run and says how far it got:
 *   3  book_roster on (the tap books an Add ID, a rename, a partner: the fold no longer does)          4  roster-export --init (the watermark, so nothing the fold took is replayed)
 *   5  book_source to book (every guard of S5f-3 stands from here: a load is an import, no laptop approve or update, no mirror re-seed, no fold)
 *   6  POST /book/compact (marks every draft the Book closes committed in one batch, S5f-3)          7  dispatch the day's export (cloud-commit.yml, export=true) and wait for it green: git now holds the export
 *   8  print what to watch: approve one real row, then `--verify` (reads the readcheck, the revision, the marks, the fallbacks)
 * `--back` is the way back: the export (a day's run), book_source to d1, book_roster off, the mirror seeded from the export (d1.mjs --seed, allowed again once the flag reads d1), the stage working again; what was tapped since the
 * export is listed for a hand fold (it is the open entries and the drafts approved since). It holds only if the export ran: it runs it first and stops if it cannot. It never turns book_outbox: that flag is his call apart.
 *
 *   node tools/flip.mjs                       dry run: the checks and the plan
 *   node tools/flip.mjs --go "<his words>"     the flip
 *   node tools/flip.mjs --verify              after the first tap: is the Book the source and healthy
 *   node tools/flip.mjs --back "<his words>"   the way back */
import "./cloudflare.mjs";
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { d1Rows, commandArgs } from "./d1json.mjs";
import { judge, collect, say } from "./flip-gate.mjs";
import { DATA_DIR } from "./book.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const WAY_BACK = join(DATA_DIR, "flip-way-back.json");   /* the project's own data folder, which is never committed: the way back must survive this run */

/** a GET of the Book's keyed routes (the readcheck), for the gate: defined in flip-gate.mjs so that file never imports this one back (a cycle that deadlocked the gate's command line) */
export { realGet } from "./flip-gate.mjs";

/** the real io: wrangler for D1, gh for Actions, git, node for the repo's own tools, fetch for the Book's keyed routes. Replaced by the suite. */
export function realIo(env = process.env) {
  const sh = (cmd, args) => { const r = spawnSync(cmd, args, { cwd: REPO, encoding: "utf8", shell: process.platform === "win32", maxBuffer: 64 * 1024 * 1024 }); return { code: r.status === null ? 1 : r.status, out: (r.stdout || "") + (r.stderr || "") }; };
  const base = (env.SALT_BASE || "https://salt-command.qyts8mh72kyg.workers.dev").replace(/\/+$/, "");
  return {
    sh,
    d1: (sql) => d1Rows(sh("npx", ["wrangler", "d1", "execute", "salt_ledger", "--remote", "--json", ...commandArgs(sql)])),
    d1Write: (sql) => sh("npx", ["wrangler", "d1", "execute", "salt_ledger", "--remote", "--json", ...commandArgs(sql)]),
    post: async (path, body) => {
      const h = { "content-type": "application/json", "X-Book-Key": String(env.SALT_BOOK_KEY || "") };
      if (env.CF_ACCESS_CLIENT_ID && env.CF_ACCESS_CLIENT_SECRET) { h["CF-Access-Client-Id"] = env.CF_ACCESS_CLIENT_ID; h["CF-Access-Client-Secret"] = env.CF_ACCESS_CLIENT_SECRET; }
      const r = await fetch(base + path, { method: "POST", headers: h, body: JSON.stringify(body || {}) }); return { status: r.status, body: await r.json().catch(() => ({})) };
    },
    get: async (path) => {
      const h = { "X-Book-Key": String(env.SALT_BOOK_KEY || "") };
      if (env.CF_ACCESS_CLIENT_ID && env.CF_ACCESS_CLIENT_SECRET) { h["CF-Access-Client-Id"] = env.CF_ACCESS_CLIENT_ID; h["CF-Access-Client-Secret"] = env.CF_ACCESS_CLIENT_SECRET; }
      const r = await fetch(base + path, { headers: h }); return { status: r.status, body: await r.json().catch(() => ({})) };
    },
    writeFile: (f, text) => { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, text); },
    now: () => new Date().toISOString(),
    collect, judge,
  };
}

const flagOf = (io, t) => { const r = io.d1(`SELECT mode FROM ${t} WHERE one=1`); return r.rows && r.rows[0] ? r.rows[0].mode : null; };
const setFlag = (io, t, m) => io.d1Write(`UPDATE ${t} SET mode='${m}' WHERE one=1`);

/** the preconditions: the gate, level with origin, no run in flight, nothing approved and unbooked. Answers {ok, checks: [{id, ok, text}]}; reads only. */
export async function preflight(io, opts = {}) {
  const checks = [], add = (id, ok, text) => checks.push({ id, ok: ok === true, text });
  const gate = io.judge(await io.collect({ since: opts.since, backupOpened: opts.backupOpened, get: io.get }));
  add("gate", gate.ok, "the gate reads " + (gate.ok ? "true" : "NOT true:\n" + say(gate)));
  io.sh("git", ["fetch", "-q"]);
  const behind = io.sh("git", ["rev-list", "--count", "HEAD..origin/master"]), ahead = io.sh("git", ["rev-list", "--count", "origin/master..HEAD"]);
  add("level", behind.code === 0 && ahead.code === 0 && behind.out.trim() === "0" && ahead.out.trim() === "0", `this checkout is level with origin/master (behind ${behind.out.trim()}, ahead ${ahead.out.trim()})`);
  const runs = io.sh("gh", ["run", "list", "--limit", "20", "--json", "status,name"]);
  let live = null; try { live = JSON.parse(runs.out).filter((r) => r.status !== "completed"); } catch (e) { live = null; }
  add("idle", live !== null && live.length === 0, live === null ? "Actions could not be read" : live.length + " runs in progress or queued");
  const open = io.d1("SELECT COUNT(*) AS n FROM draft WHERE status='approved' AND committed_at IS NULL AND json_extract(CASE WHEN json_valid(row) THEN row ELSE '{}' END,'$.booked_seq') IS NULL");
  add("unbooked", !open.error && open.rows && +open.rows[0].n === 0, "approved drafts the Book has not booked: " + (open.error ? "unread" : open.rows[0].n));
  const src = flagOf(io, "book_source");
  add("flag", src === "d1", "book_source reads " + src + " (the flip starts from d1)");
  return { ok: checks.every((c) => c.ok), checks, gate };
}

export const PLAN = [
  ["0", "write the way back (flags, the Book's revision, the sha, the commands) before anything moves"],
  ["3", "book_roster on: the tap books an Add ID, a rename and a partner"],
  ["4", "roster-export --init: the watermark at the Book's highest booking order"],
  ["5", "book_source to book: the guards of S5f-3 stand from here"],
  ["6", "POST /book/compact: the drafts the Book closes are marked committed in one batch"],
  ["7", "dispatch the day's export (cloud-commit.yml, export=true) and wait for it green"],
  ["8", "approve one real row, then flip.mjs --verify"],
];

/** the flip. `opts.go` is his typed words, required to act; without it nothing is written. Answers {ok, dry, did: [], stoppedAt?, error?}. */
export async function flip(io, opts = {}) {
  const did = [], pre = await preflight(io, opts), out = { ok: false, dry: !opts.go, pre, plan: PLAN, did };
  if (!opts.go) { out.ok = pre.ok; return out; }
  if (typeof opts.go !== "string" || opts.go.trim().length < 8) return { ...out, error: "--go takes his typed words, not a bare flag" };
  if (!pre.ok) return { ...out, error: "a precondition does not stand: " + pre.checks.filter((c) => !c.ok).map((c) => c.id).join(", "), stoppedAt: "preflight" };
  const stop = (step, error) => ({ ...out, stoppedAt: step, error: String(error).slice(0, 300), wayBack: WAY_BACK });
  /* 0: the way back, first */
  const at = await io.get("/book/readcheck");
  const flags = { book_tap: flagOf(io, "book_tap"), book_read: flagOf(io, "book_read"), book_source: flagOf(io, "book_source"), book_roster: flagOf(io, "book_roster"), book_outbox: flagOf(io, "book_outbox"), book_page: flagOf(io, "book_page") };
  const sha = io.sh("git", ["rev-parse", "HEAD"]).out.trim();
  const way = { writtenAt: io.now(), his: opts.go, sha, flags, bookRev: at.body && at.body.bookRev, back: ["node tools/flip.mjs --back \"<his words>\"", "or by hand: the day's export, then UPDATE book_source SET mode='d1', UPDATE book_roster SET mode='off', node tools/d1.mjs --seed, hand-fold what was tapped since"] };
  try { io.writeFile(WAY_BACK, JSON.stringify(way, null, 1)); } catch (e) { return stop("0", "the way back could not be written: " + e.message); }
  did.push("0 way back written");
  /* 3 to 6 */
  const r3 = setFlag(io, "book_roster", "on"); if (r3.code !== 0 || flagOf(io, "book_roster") !== "on") return stop("3", "book_roster did not read on after it was set");
  did.push("3 book_roster on");
  const r4 = io.sh("node", ["tools/roster-export.mjs", "--init"]); if (r4.code !== 0) return stop("4", r4.out);
  /* the chain reads the watermark from origin, not from this checkout: it is committed and pushed, or every day's export replays the roster from the start (Fable's review) */
  const w1 = io.sh("git", ["add", "statements/_roster_export.json"]), w2 = io.sh("git", ["commit", "-q", "-m", "The flip: the roster export's watermark", "--", "statements/_roster_export.json"]), w3 = io.sh("git", ["push", "origin", "HEAD:master"]);
  if (w1.code !== 0 || w2.code !== 0 || w3.code !== 0) return stop("4", "the watermark was written and could not be committed and pushed: " + [w1, w2, w3].filter((x) => x.code !== 0).map((x) => x.out).join(" "));
  did.push("4 roster-export --init, the watermark pushed");
  const r5 = setFlag(io, "book_source", "book"); if (r5.code !== 0 || flagOf(io, "book_source") !== "book") return stop("5", "book_source did not read book after it was set");
  did.push("5 book_source book");
  const r6 = await io.post("/book/compact", {}); if (r6.status !== 200 || !r6.body.ok) return stop("6", "the compaction: " + JSON.stringify(r6.body).slice(0, 200));
  did.push("6 compacted " + (r6.body.compacted || 0) + ", marked " + (r6.body.closed || 0));
  const r7 = io.sh("gh", ["workflow", "run", "cloud-commit.yml", "-f", "export=true", "-f", "reason=the flip's first export"]); if (r7.code !== 0) return stop("7", r7.out);
  did.push("7 the day's export dispatched: read its step list and its \"Book export:\" line, then approve one real row and run --verify");
  return { ...out, ok: true, wayBack: WAY_BACK };
}

/** after the first tap: is the Book the source and healthy. Reads only. */
export async function verify(io) {
  const checks = [], add = (id, ok, text) => checks.push({ id, ok: ok === true, text });
  add("source", flagOf(io, "book_source") === "book", "book_source reads book");
  add("roster", flagOf(io, "book_roster") === "on", "book_roster reads on");
  const rc = await io.get("/book/readcheck");
  add("readcheck", rc.status === 200 && rc.body.ok === true && rc.body.source === "book", "the readcheck is green and says source book: " + JSON.stringify({ ok: rc.body.ok, source: rc.body.source, rev: rc.body.bookRev }));
  const unb = io.d1("SELECT COUNT(*) AS n FROM draft WHERE status='approved' AND committed_at IS NULL AND json_extract(CASE WHEN json_valid(row) THEN row ELSE '{}' END,'$.booked_seq') IS NULL");
  add("unbooked", !unb.error && +unb.rows[0].n === 0, "approved drafts unbooked: " + (unb.error ? "unread" : unb.rows[0].n));
  const fb = io.d1("SELECT COUNT(*) AS n FROM draft WHERE json_extract(CASE WHEN json_valid(row) THEN row ELSE '{}' END,'$.tap_fallback') IS NOT NULL AND decided_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 day')");
  add("fallbacks", !fb.error && +fb.rows[0].n === 0, "approvals that fell back in the last day: " + (fb.error ? "unread" : fb.rows[0].n));
  return { ok: checks.every((c) => c.ok), checks };
}

/** the way back. The export first: without it the way back loses what was tapped, so it stops if it cannot run. */
export async function back(io, opts = {}) {
  const did = [];
  if (typeof opts.go !== "string" || opts.go.trim().length < 8) return { ok: false, did, error: "--back takes his typed words" };
  const stop = (step, error) => ({ ok: false, did, stoppedAt: step, error: String(error).slice(0, 300) });
  /* `noExport`: the flip stopped before anything was compacted (step 6 refused), so there is nothing to export and the way back is the flags alone */
  if (!opts.exported && !opts.noExport) {
    const d = io.sh("gh", ["workflow", "run", "cloud-commit.yml", "-f", "export=true", "-f", "reason=the way back's export"]); if (d.code !== 0) return stop("export", d.out);
    did.push("the day's export dispatched: wait for it green before going on (the run is the export)");
    return { ok: true, did, waiting: "re-run with --exported once the export run is green", exportedFirst: true };
  }
  const s = setFlag(io, "book_source", "d1"); if (s.code !== 0 || flagOf(io, "book_source") !== "d1") return stop("flag", "book_source did not read d1");
  did.push("book_source d1");
  const r = setFlag(io, "book_roster", "off"); if (r.code !== 0) return stop("roster", r.out);
  did.push("book_roster off");
  /* the mirror is seeded from the export the chain pushed, not from whatever this checkout held: pulled, the extract made again, then seeded */
  if (!opts.noExport) { const pu = io.sh("git", ["pull", "--ff-only"]); if (pu.code !== 0) return stop("pull", pu.out); const lg = io.sh("node", ["tools/ledger.mjs"]); if (lg.code !== 0) return stop("extract", lg.out); }
  const seed = io.sh("node", ["tools/d1.mjs", "--seed"]); if (seed.code !== 0) return stop("seed", seed.out);
  did.push("the mirror seeded from the export");
  const since = io.d1("SELECT id, collection FROM draft WHERE status='approved' AND json_extract(CASE WHEN json_valid(row) THEN row ELSE '{}' END,'$.booked_seq') IS NOT NULL AND committed_at IS NULL ORDER BY id");
  return { ok: true, did, handFold: since.error ? "unread" : since.rows.map((x) => x.id) };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const a = process.argv.slice(2), val = (f) => { const i = a.indexOf(f); return i >= 0 ? a[i + 1] : null; };
  const io = realIo();
  const r = a.includes("--verify") ? await verify(io) : a.includes("--back") ? await back(io, { go: val("--back"), exported: a.includes("--exported"), noExport: a.includes("--no-export") }) : await flip(io, { go: val("--go"), backupOpened: val("--backup-opened"), since: val("--since") });
  console.log(JSON.stringify(r, (k, v) => (k === "gate" ? undefined : v), 1));
  if (r.pre && !r.ok) console.log("\n" + r.pre.checks.map((c) => (c.ok ? "  ok   " : "  NOT  ") + c.text).join("\n"));
  process.exit(r.ok ? 0 : 1);
}
