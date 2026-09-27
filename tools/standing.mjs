#!/usr/bin/env node
/* standing.mjs: THE STANDING STATE, the seven lines every task closes with (CLAUDE.md, "Working on it"), so that no
 * session builds them by hand. Shelf, live credit and written off are each live book's, read in an openMaster window
 * after setProdView, as the desk reads them; pending orders (the engine's txStat Pending: nothing paid, nothing moved)
 * and undated rows count every book. The queue line is the tools' own reads (drafts.mjs --list and --approved, drain.mjs
 * --status), each tried once more on a failure (TOOLING.md: one Cloudflare timeout is "run it again"), and an entry at
 * or below QUEUE_COMMITTED is said to be folded, since a phone's own key keeps what it sent. Staged and the tree are
 * git's. A read that fails says so in its line and never reads as nothing, and the tool then exits 1.
 *
 *   node tools/standing.mjs             the table, in markdown, for this checkout's master (SALT_MASTER reads another)
 *   node tools/standing.mjs --offline   no Cloudflare and no fetch: the queue line says it was not read
 *   node tools/standing.mjs --json      the figures behind the table
 */
import { spawn, spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/* ---- the book, from the engine in the window ---- */
export const pendingOf = (sales, txStat) => sales.filter((s) => txStat(s).order === "Pending").map((s) => s.rid || s.date || "?");
export const undatedOf = (sales, purchases) => sales.filter((s) => !s.date).length + purchases.filter((p) => !p.date).length;
export function bookState(w) {
  const ev = (s) => JSON.parse(w.eval("JSON.stringify(" + s + ")"));
  const was = ev("PROD"), books = {};
  for (const p of ev("PROD_IDS")) {
    w.eval("setProdView(" + JSON.stringify(p) + ")");
    books[p] = ev("({shelf:currentStock,counted:stockCounted,free:+(currentStock-defUnits).toFixed(2),"
      + "credit:+(+arGross).toFixed(2),writtenOff:+(+writtenOffRM).toFixed(2)})");
  }
  w.eval("setProdView(" + JSON.stringify(was) + ")");
  return { books, pending: pendingOf(w.eval("sales"), w.eval("POSITION_ENGINE.txStat")),
    undated: undatedOf(w.eval("sales"), w.eval("purchases")), watermark: ev("QUEUE_COMMITTED") };
}

/* ---- the queue, from the tools' own reads: {status, out} in, a count or {error} out ---- */
const why = (r) => {
  const out = String(r.out || ""), line = out.split("\n").map((l) => l.trim()).find((l) => /FAIL|unreachable|error|timed out/i.test(l));
  const text = (out.match(/"text":\s*"([^"]+)"/) || [])[1];
  return ((line || "exit " + r.status) + (text ? " " + text : "")).replace(/\s+/g, " ").slice(0, 140);
};
export function readList(r) {
  if (r.status !== 0) return { error: why(r) };
  if (/nothing is waiting for a decision/.test(r.out)) return { n: 0 };
  const m = r.out.match(/^\s*(\d+) waiting for a decision/m);
  return m ? { n: +m[1] } : { error: "no count in its answer" };
}
export function readApproved(r) {
  if (r.status !== 0) return { error: why(r) };
  try { const j = JSON.parse(r.out.slice(r.out.indexOf("{"))); return { n: j.count, ids: j.approved.map((a) => a.id) }; }
  catch (e) { return { error: "no count in its answer" }; }
}
const ENTRY = /^\s+(\S+)\s+(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\s+(.*)$/;
export function readQueue(r, watermark) {
  if (r.status !== 0) return { error: why(r) };
  const entries = String(r.out).split("\n").map((l) => l.match(ENTRY)).filter(Boolean).map((m) => ({ where: m[1], at: m[2], what: m[3].trim() }));
  const done = (e) => !!watermark && e.at <= watermark;
  return { waiting: entries.filter((e) => !done(e)), folded: entries.filter(done) };
}
/* one run of a tool, its output and stderr together; the three reads run side by side with the window */
const runOnce = (file, args) => new Promise((done) => {
  const p = spawn(process.execPath, [resolve(REPO, "tools", file), ...args], { cwd: REPO,
    env: Object.assign({}, process.env, { NODE_OPTIONS: "--dns-result-order=ipv4first" }) });
  let out = "";
  const t = setTimeout(() => p.kill(), 180000);
  p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (out += d));
  p.on("error", (e) => { clearTimeout(t); done({ status: -1, out: String((e && e.message) || e) }); });
  p.on("close", (code) => { clearTimeout(t); done({ status: code == null ? -1 : code, out }); });
});
export async function runTool(file, args, run = runOnce) {
  let r;
  for (let i = 0; i < 2; i++) { r = await run(file, args); if (r.status === 0) break; }
  return r;
}

/* ---- the tree, from git ---- */
const git = (...a) => { const p = spawnSync("git", a, { cwd: REPO, encoding: "utf8" }); return p.status === 0 ? String(p.stdout).trim() : null; };
export function treeState(g, fetched) {
  const lr = g("rev-list", "--left-right", "--count", "origin/master...HEAD");
  const [behind, ahead] = lr ? lr.split(/\s+/).map(Number) : [null, null];
  const has = (ref, f) => g("cat-file", "-e", ref + ":master/" + f) !== null;
  return { branch: g("rev-parse", "--abbrev-ref", "HEAD"), head: g("rev-parse", "--short", "HEAD"),
    dirty: (g("status", "--porcelain") || "").split("\n").filter(Boolean).map((l) => l.slice(3)), ahead, behind, fetched,
    staged: ["_to_fold.json", "_folded.json"].filter((f) => has("HEAD", f) || has("origin/master", f)) };
}

/* ---- the table ---- */
const num = (x) => String(+(+x).toFixed(2));
const myr = (x) => "MYR " + (+x).toLocaleString("en-GB", Number.isInteger(+x) ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const byBook = (books, k) => {
  const on = Object.entries(books).filter(([, b]) => b[k] > 0.004);
  return on.length ? on.map(([p, b]) => myr(b[k]) + " (" + p + ")").join(", ") : "MYR 0";
};
const said = (x, fn) => (x.error ? "could not read (" + x.error + ")" : fn(x));
const plural = (n, one, many) => n + " " + (n === 1 ? one : many);
export function table(s) {
  const shelf = Object.entries(s.book.books).filter(([, b]) => b.counted || Math.abs(b.shelf) > 0.004)
    /* free is the shelf less what is owed out; below nothing, it is a restock now (his word, 28 Sep 2026), never a book error */
    .map(([p, b], i) => p + " " + num(b.shelf) + (i === 0 ? " units" : "")
      + (Math.abs(b.free - b.shelf) > 0.004 ? " (free " + num(b.free) + (b.free < -0.004 ? ": restock now" : "") + ")" : ""))
    .join(", ") || "nothing counted or held";
  const q = s.queue, t = s.tree;
  const queue = !q ? "not read (--offline)" : [
    "drafts " + said(q.list, (x) => (x.n ? x.n + " waiting" : "none waiting")),
    "approved " + said(q.approved, (x) => (x.n ? plural(x.n, "row not folded", "rows not folded") : "none")),
    "queue " + said(q.queue, (x) => (x.waiting.length ? plural(x.waiting.length, "entry", "entries") + ": " + x.waiting.map((e) => e.what + " (" + e.at + ")").join("; ") : "empty")
      + (x.folded.length ? ", and " + plural(x.folded.length, "entry", "entries") + " left in a phone's key, already folded: " + x.folded.map((e) => e.what).join("; ") : "")),
  ].join("; ");
  const staged = t.staged.length ? "staged " + t.staged.join(", ") : "nothing staged";
  const tree = (t.branch || "?") + " at " + (t.head || "?") + ", "
    + (t.dirty.length ? plural(t.dirty.length, "file", "files") + " changed (" + t.dirty.slice(0, 3).join(", ") + (t.dirty.length > 3 ? ", more" : "") + ")" : "clean") + ", "
    + (t.ahead == null ? "origin not read" : t.ahead || t.behind ? t.ahead + " ahead of origin, " + t.behind + " behind" : "level with origin")
    + (t.fetched ? "" : ", as last fetched");
  const rows = [["Shelf", shelf], ["Live credit", byBook(s.book.books, "credit")], ["Written off", byBook(s.book.books, "writtenOff")],
    ["Pending orders", s.book.pending.length + (s.book.pending.length ? " (" + s.book.pending.join(", ") + ")" : "")],
    ["Undated rows", String(s.book.undated)], ["Queue, drafts, staged", queue + "; " + staged], ["Tree", tree]];
  return ["| Line | State |", "|---|---|"].concat(rows.map(([k, v]) => "| " + k + " | " + String(v).replace(/\|/g, "/") + " |")).join("\n");
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const argv = process.argv.slice(2), offline = argv.includes("--offline");
  const fetched = !offline && spawnSync("git", ["fetch", "-q", "origin"], { cwd: REPO }).status === 0;
  const reads = offline ? null : Promise.all([runTool("drafts.mjs", ["--list"]), runTool("drafts.mjs", ["--approved"]), runTool("drain.mjs", ["--status"])]);
  const { openMaster } = await import("./payload.mjs");
  const { w } = await openMaster();
  const book = bookState(w);
  w.close();
  const queue = reads && await reads.then(([l, a, d]) => ({ list: readList(l), approved: readApproved(a), queue: readQueue(d, book.watermark) }));
  const state = { book, queue, tree: treeState(git, fetched) };
  console.log(argv.includes("--json") ? JSON.stringify(state, null, 1) : table(state));
  process.exit(queue && [queue.list, queue.approved, queue.queue].some((x) => x.error) ? 1 : 0);
}
