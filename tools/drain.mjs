/* drain.mjs — pull the cloud queue from KV onto disk. A HAND TOOL, NOT A COMMIT SOURCE.
 *
 * ITS ROLE CHANGED AT v305 AND THE OLD ONE MUST NOT COME BACK. It used to be the road a
 * phone entry took into the ledger: serve_desk.py ran it every sixty seconds and the daily
 * run folded 10_Data/salt_queue_cloud.json into the master. That road bypassed the approval
 * step of v302, so a phone entry became a real ledger row with nobody having read the row.
 * It was also a DESTRUCTIVE read racing the cloud drafter, and winning: an entry posted at
 * 14:41 on 16 Aug was on disk and gone from KV by 14:52, with nothing left to draft.
 *
 * WHAT REPLACED IT. The Worker drafts an entry into the `draft` table on arrival, the phone
 * approves it, and the run folds ONLY approved drafts (`node tools/drafts.mjs --approved`).
 *
 * WHAT THIS IS FOR NOW: reading the cloud queue by hand (`--status`), withdrawing an entry
 * (`--forget`), and recovering entries if the cloud drafter is ever broken. If you drain
 * to disk in that case, put the entries through `node tools/drafts.mjs --from-queue` so
 * they still pass the gate. DO NOT FOLD salt_queue_cloud.json STRAIGHT INTO THE MASTER.
 *
 * The phone POSTs its queue to the Worker, which stores it in KV, one key per device
 * (q:<deviceId>). Names are never in KV, so nothing sensitive is drained.
 *
 * Modes:
 *   node tools/drain.mjs               pull KV -> file (union by 'at'), then clear the
 *                                      KV keys it drained (race-safe: only if unchanged).
 *   node tools/drain.mjs --committed <ISO>
 *                                      after a successful commit, drop file entries whose
 *                                      'at' <= <ISO> (the QUEUE_COMMITTED watermark the run
 *                                      just set), leaving only still-uncommitted entries.
 *   node tools/drain.mjs --keep        pull KV -> file as above and clear NOTHING: the mode
 *                                      update.mjs runs (09 Sep 2026), so a laptop update never
 *                                      races the cloud drafter for a phone entry.
 *   node tools/drain.mjs --status      read-only: print the KV union and the file, no writes. Each entry is set
 *                                      against QUEUE_COMMITTED in ledger/book.json and, where D1 answers, its
 *                                      draft: what is folded or decided is listed apart from what is still to
 *                                      reach the ledger, and --forget is offered for the second alone.
 *   node tools/drain.mjs --forget <at> withdraw ONE entry, from the file and from KV, by
 *                                      its own `at`. For testing the phone leg without
 *                                      leaving a fake sale for the daily run to commit.
 *                                      It rewrites a KV key through --path, never as a
 *                                      JSON argument: the win32 shell strips the quotes.
 *   node tools/drain.mjs --retire-orders-blob
 *                                      delete the old orders blob q:orders, ONLY when it holds
 *                                      nothing. Since fold 2.1 the site's stages take one key an
 *                                      entry (q:orders:<at>) and the drafter prunes the blob as
 *                                      the fold passes its entries; run this after seven days of
 *                                      `"legacy":0` on the drafter's log line. It refuses while
 *                                      the blob holds an entry or cannot be read, and says why.
 *   A device key that cannot be parsed is NAMED by every mode and deleted by none.
 *
 * Env:  SALT_DATA overrides the 10_Data folder. Uses the machine's existing wrangler auth;
 *       an unattended run may need CLOUDFLARE_API_TOKEN set.
 */

import { wranglerSaid, againIfLapsed } from "./cloudflare.mjs";
import { readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { DATA_DIR } from "./book.mjs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const BINDING = "SALT_QUEUE";
const FILE = "salt_queue_cloud.json";
const BLOB = "q:orders";   /* the orders device's old one-key queue; its entries take q:orders:<at> since fold 2.1 */

const DATA = DATA_DIR;
const OUT = join(DATA, FILE);
const BOOK = process.env.SALT_BOOK || resolve(REPO, "ledger", "book.json");

const nowISO = () => new Date().toISOString();

/* ---- wrangler KV helpers -------------------------------------------------------- */
function wr(args) {
  // Run in the repo so wrangler.jsonc (and its KV binding) is found. --remote targets
  // the deployed namespace, not the local simulator.
  return againIfLapsed(() => execFileSync("npx", ["wrangler", ...args, "--binding", BINDING, "--remote"], {
    cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32"
  }));
}
function jsonSlice(s, open, close) {
  const a = s.indexOf(open), b = s.lastIndexOf(close);
  if (a < 0 || b < 0 || b < a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
}
function kvList() {
  const out = wr(["kv", "key", "list"]);
  const arr = jsonSlice(out, "[", "]");
  if (!Array.isArray(arr)) throw new Error("could not parse `kv key list` output");
  return arr.map(k => k.name).filter(n => typeof n === "string" && n.startsWith("q:"));
}
function kvGet(name) {
  try { return wr(["kv", "key", "get", name]); }
  catch (e) { return null; }   // a key deleted mid-run just drops out
}
function kvDelete(name) {
  try { wr(["kv", "key", "delete", name]); return true; } catch (e) { return false; }
}
/* WRITE THROUGH A FILE, NEVER AN ARGUMENT (20 Sep 2026). wr() runs wrangler through the shell on
   win32 (shell: true above), and the shell strips the double quotes from a JSON argument: on 19 Sep
   --forget wrote q:orders as {updated:...,desk:cloud,queue:[...]}, the Worker's json read threw on
   it every minute, and every site order failed in silence for a day. --path hands wrangler the bytes. */
function kvPut(name, obj) {
  const dir = _mkdtemp(_join(_tmpdir(), "drain-")), file = _join(dir, "value.json");
  _write(file, JSON.stringify(obj));
  try { wr(["kv", "key", "put", name, "--path", file]); }
  finally { try { _rm(dir, { recursive: true, force: true }); } catch (e) { /* a temp dir */ } }
}
/* ONE READER for a device key: its queue, or null when the value cannot be read, so every mode says
   so rather than counting it as empty, which is how the corrupt key hid behind "0 entries". */
export function deviceQueue(raw) {
  const j = jsonSlice(raw, "{", "}");
  return (j && Array.isArray(j.queue)) ? j.queue : null;
}
import { mkdtempSync as _mkdtemp, rmSync as _rm, writeFileSync as _write } from "node:fs";
import { tmpdir as _tmpdir } from "node:os";
import { join as _join } from "node:path";

/* THE DRAFTS BEHIND THE LISTED ENTRIES, read by id as the drafter reads them (draftedOf, src/drafter.js), never the
   whole table, through wrangler's own login as drafts.mjs reads D1, forty ids a read, with the drafter's refusals,
   which live in `refused` and never in `draft`. Only an `at` of the shape every device mints is asked, since it is
   written into the SQL and passes a shell. Each id asked maps to its draft, else its refusal (status "refused"), else
   null; a failure throws, in wrangler's words. */
const ISO_AT = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/;
function d1Drafts(ats) {
  const ids = ats.filter((a) => ISO_AT.test(a || "")), found = new Map(ids.map((id) => [id, null]));
  for (let i = 0; i < ids.length; i += 40) {
    const inList = "('" + ids.slice(i, i + 40).join("','") + "')";
    const sql = "SELECT id,status,committed_at,NULL AS why FROM draft WHERE id IN " + inList
      + " UNION ALL SELECT id,'refused',NULL,why FROM refused WHERE id IN " + inList;
    const out = againIfLapsed(() => execFileSync("npx", ["wrangler", "d1", "execute", "salt_ledger", "--remote", "--json", "--command", JSON.stringify(sql)], {
      cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: true
    }));
    const j = jsonSlice(out, "[", "]");
    if (!Array.isArray(j) || !j[0] || !Array.isArray(j[0].results)) throw new Error("D1's answer could not be read: " + out.trim().slice(0, 80));
    for (const r of j[0].results) if (found.has(r.id) && (!found.get(r.id) || r.status !== "refused")) found.set(r.id, r);
  }
  return found;
}
/* the watermark the fold moves (tools/fold.mjs), as this checkout's book holds it, or null */
function bookMark() {
  try { return JSON.parse(readFileSync(BOOK, "utf8")).QUEUE_COMMITTED || null; } catch (e) { return null; }
}

/* ---- file helpers --------------------------------------------------------------- */
function readFile() {
  if (!existsSync(OUT)) return { updated: null, desk: "cloud", queue: [] };
  try { const j = JSON.parse(readFileSync(OUT, "utf8")); if (!Array.isArray(j.queue)) j.queue = []; return j; }
  catch (e) { return { updated: null, desk: "cloud", queue: [] }; }
}
function writeAtomic(obj) {
  /* v357: NEVER CREATE IT. A missing data folder means the project has moved, and mkdir here
     wrote an empty queue into a dead path on 24 Aug while the real one sat elsewhere. */
  if (!existsSync(DATA)) {
    console.error(`  FAIL  the data folder does not exist: ${DATA}`);
    console.error("        The project has moved. Fix DATA_DIR in tools/book.mjs, or set SALT_DATA.");
    process.exit(2);
  }
  const tmp = OUT + ".tmp";
  writeFileSync(tmp, JSON.stringify(obj, null, 1));
  renameSync(tmp, OUT);
}
/* ---- pure helpers (exported for the test suite) --------------------------------- */
export function unionByAt(...lists) {
  const byAt = new Map();
  for (const list of lists) for (const e of (list || [])) {
    const k = e && e.at ? e.at : JSON.stringify(e);
    byAt.set(k, e);   // later lists win; callers pass existing first, fresh second
  }
  return [...byAt.values()].sort((a, b) => ((a && a.at) || "") < ((b && b.at) || "") ? -1 : 1);
}
export function pruneCommitted(queue, iso) {
  return (queue || []).filter(e => !(e && e.at && e.at <= iso));
}
/* WITHDRAW EXACTLY ONE ENTRY, BY ITS OWN `at`. Added for testing the phone leg, which
   has a trap in it: the daily run is told, correctly, to treat every queued row as REAL
   and never as demo content. So a test transaction tapped out on the phone would be
   committed into the ledger as a genuine sale unless it could be taken back.
   --committed CANNOT do this job: it prunes everything at or before a timestamp, so
   withdrawing a test would also silently swallow any real entry that happened to be
   older. This removes one entry and nothing else. */
export function forgetOne(queue, at) {
  return (queue || []).filter(e => !(e && e.at === at));
}

/* WHERE A QUEUED ENTRY STANDS (28 Sep 2026). A device's key is that device's own: the drafter never prunes one
   (pruneOrders, src/drafter.js), and the device drops a folded entry only when it next loads and posts its queue, so a
   key can hold entries folded days before. --status listed every one as outstanding under the --forget advice, and on
   28 Sep two sessions reported as queued a correction approved and committed on 26 Sep, under a watermark of 27 Sep.
   An entry is closed, folded or decided, by its draft where D1 answered for it, and by QUEUE_COMMITTED alone where it
   did not, which --status then says. One at or under the watermark that D1 does not know is still to reach the ledger:
   the drafter drafts it, where it is in a device's key; in the file alone only drafts.mjs --from-queue drafts it.
   `drafts` maps each id D1 was asked about to its row or null, or is null when D1 was not read. */
export function standing(e, mark, drafts, inKv = true) {
  const at = (e && e.at) || "";
  if (drafts && drafts.has(at)) {
    const d = drafts.get(at);
    if (!d) return { closed: false, why: !inKv ? "not drafted, and in the file alone, which only drafts.mjs --from-queue drafts"
      : mark && at <= mark ? "not drafted, though at or under the watermark" : "not drafted" };
    if (d.status === "refused") return { closed: false, why: "refused: " + String(d.why || "").slice(0, 80) };
    if (d.committed_at) return { closed: true, why: "committed " + d.committed_at };
    if (d.status === "approved") return { closed: true, why: "approved, not yet marked committed; withdrawn only in D1 (docs/CLOUD_FOLD.md)" };
    if (d.status === "rejected") return { closed: true, why: "rejected" };
    return { closed: false, why: "drafted, waiting under Approve" };
  }
  return mark && at && at <= mark ? { closed: true, why: "at or under the watermark" } : { closed: false, why: "" };
}

/* what --status prints for the union: the watermark and the drafts it read, then what is folded or decided (or, with
   D1 not read, what the watermark alone passes), then what is still to reach the ledger, and the --forget advice under
   that group alone. `kv` is the set of ats KV holds. */
export function statusLines(all, { kv = new Set(), mark = null, drafts = null, d1 = "" } = {}) {
  const known = drafts ? [...drafts.values()].filter(Boolean).length : 0;
  const out = [`Watermark: ${mark ? "QUEUE_COMMITTED " + mark : "none"}, from this checkout's ledger/book.json. `
    + (drafts ? `D1: ${drafts.size} asked, ${known} drafted or refused.` : `D1 not read${d1 ? " (" + d1 + ")" : ""}, so the watermark alone decides.`)];
  const rows = all.map((e) => ({ e, s: standing(e, mark, drafts, kv.has(e && e.at)) }));
  const line = ({ e, s }) => `  ${kv.has(e && e.at) ? "KV " : "file"}  ${e && e.at}  ${s.why ? s.why + "  " : ""}${String((e && e.raw) || "(no description)").slice(0, 96)}`;
  const closed = rows.filter((r) => r.s.closed), open = rows.filter((r) => !r.s.closed);
  if (closed.length) out.push("", drafts
    ? `Folded or decided: ${closed.length}. Listed only because a device's key keeps them until it posts again, the file until --committed.`
    : `At or under the watermark, D1 not read: ${closed.length}. Folded on the watermark's word alone, until D1 answers.`, ...closed.map(line));
  if (open.length) out.push("", `Still to reach the ledger: ${open.length}.`, ...open.map(line), "",
    "  To take one back out before it reaches the ledger:", "    node tools/drain.mjs --forget <at>",
    "  A drafted one is rejected under Approve instead: --forget leaves its draft there to be approved.");
  return out;
}

/* ---- modes ---------------------------------------------------------------------- */
function runCommitted() {
  const iso = process.argv[3];
  if (!iso) { console.error("usage: drain.mjs --committed <ISO timestamp>"); process.exit(2); }
  const f = readFile();
  const before = f.queue.length;
  f.queue = pruneCommitted(f.queue, iso);
  f.updated = nowISO();
  writeAtomic(f);
  const gone = before - f.queue.length;
  console.log(`PRUNED ${gone} committed entr${gone === 1 ? "y" : "ies"} (<= ${iso}); ${f.queue.length} remain in ${FILE}.`);
}

export function runStatus({ io = {} } = {}) {
  const IO = Object.assign({ list: kvList, get: kvGet, read: readFile, mark: bookMark, drafts: d1Drafts }, io);
  let keys = [];
  try { keys = IO.list(); } catch (e) { console.error("KV unreachable: " + e.message); process.exit(1); }
  const kv = [], bad = [];
  for (const k of keys) { const v = IO.get(k); if (v) { const qq = deviceQueue(v); if (qq) kv.push(...qq); else bad.push([k, v]); } }
  const file = IO.read();
  console.log(`KV: ${keys.length} device key(s), ${bad.length} unreadable, ${kv.length} entr${kv.length === 1 ? "y" : "ies"}.`);
  /* fold 2.1: the old orders blob, read only now, until --retire-orders-blob takes it */
  if (keys.includes(BLOB)) {
    const bq = deviceQueue(IO.get(BLOB) || ""), own = keys.filter((k) => k.startsWith(BLOB + ":")).length;
    console.log(`  ${BLOB}, the old orders blob: ${bq ? bq.length : "unreadable"}; orders keys of their own: ${own}.`);
  }
  for (const [k, v] of bad) console.log(`  ${k} could not be parsed (${Buffer.byteLength(v, "utf8")} bytes): ${v.slice(0, 80)}`);
  console.log(`File ${FILE}: ${file.queue.length} entr${file.queue.length === 1 ? "y" : "ies"}.`);
  const all = unionByAt(file.queue, kv);
  console.log(`Union (dedup by at): ${all.length}.`);
  /* LIST THEM, because a count cannot be acted on. --forget needs an entry's own `at`,
     and without this the only way to read one was to drain first, which is the very thing
     you do not want to do while deciding whether an entry should reach the ledger.
     Codes only, never names: this output gets pasted around. A D1 read that fails is said, and the watermark
     alone decides: it is never read as no drafts. */
  if (all.length) {
    let drafts = null, d1 = "";
    try { drafts = IO.drafts(all.map((e) => e && e.at)); } catch (e) { d1 = wranglerSaid(e); }
    console.log("");
    for (const l of statusLines(all, { kv: new Set(kv.map((e) => e && e.at)), mark: IO.mark(), drafts, d1 })) console.log(l);
  }
}

/* `keep` pulls and clears nothing (09 Sep 2026): the mode update.mjs runs, because the default
   is the destructive read the header says must not come back, and update.mjs had been running
   it on every laptop update since v305. `io` is the KV and file access, injectable so the suite
   can prove which keys a mode deletes without a namespace. */
export function runDrain({ keep = false, io = {} } = {}) {
  const IO = Object.assign({ list: kvList, get: kvGet, del: kvDelete, read: readFile, write: writeAtomic }, io);
  let keys;
  try { keys = IO.list(); }
  catch (e) {
    console.error("DRAIN FAILED: wrangler could not reach the KV namespace.");
    console.error("  wrangler said: " + wranglerSaid(e));
    console.error("  Timed out: run it again. Anything else: check `npx wrangler whoami`, that the KV id in wrangler.jsonc is real, and CLOUDFLARE_API_TOKEN for unattended runs.");
    process.exit(1);
  }
  const captured = [];   // {name, raw, entries}
  for (const name of keys) {
    const raw = IO.get(name);
    if (!raw) continue;
    const qq = deviceQueue(raw);
    captured.push({ name, raw, entries: qq || [], unreadable: !qq });
  }
  const fresh = captured.flatMap(c => c.entries);
  const file = IO.read();
  const merged = unionByAt(file.queue, fresh);
  IO.write({ updated: nowISO(), desk: "cloud", queue: merged });

  let cleared = 0, kept = 0;
  if (!keep) {
    for (const c of captured) {
      if (c.unreadable) { kept++; console.log("  " + c.name + " could not be parsed and is left alone"); continue; }
      const now = IO.get(c.name);           // re-read: only delete if this device has not pushed since
      if (now !== null && now === c.raw) { if (IO.del(c.name)) cleared++; }
      else kept++;                          // changed mid-drain; its new entries land next drain (dedup by at)
    }
  }
  console.log(`DRAIN OK -> ${OUT}`);
  console.log(`  devices: ${captured.length}   fresh entries: ${fresh.length}   file now holds: ${merged.length}`);
  console.log(keep ? "  KV keys kept: the phone's queue is untouched (--keep)"
    : `  KV keys cleared: ${cleared}${kept ? `, ${kept} left (changed mid-drain, next run gets them)` : ""}`);
  if (merged.length && !keep) console.log(`  the daily run should commit ${FILE}, then: node tools/drain.mjs --committed <QUEUE_COMMITTED>`);
  return { devices: captured.length, fresh: fresh.length, merged: merged.length, cleared, kept };
}

/* --forget <at>: take one entry back out of BOTH the file and KV. */
export function runForget({ at = process.argv[3], io = {} } = {}) {
  const IO = Object.assign({ list: kvList, get: kvGet, del: kvDelete, put: kvPut, read: readFile, write: writeAtomic }, io);
  if (!at) { console.error("usage: drain.mjs --forget <the entry's own at, e.g. 2026-08-09T04:12:33.123Z>"); process.exit(2); }

  const f = IO.read();
  const before = f.queue.length;
  f.queue = forgetOne(f.queue, at);
  const fromFile = before - f.queue.length;
  if (fromFile) { f.updated = nowISO(); IO.write(f); }

  /* and out of KV, or the next drain would simply bring it back */
  let fromKv = 0, keys = [];
  try { keys = IO.list(); }
  catch (e) { console.error("KV unreachable, so only the file was cleaned: " + wranglerSaid(e)); }
  for (const name of keys) {
    const raw = IO.get(name); if (!raw) continue;
    const qq = deviceQueue(raw);
    if (!qq) { console.log("  " + name + " could not be parsed and is left alone"); continue; }
    if (!qq.some(e => e && e.at === at)) continue;
    const kept = forgetOne(qq, at);
    fromKv += qq.length - kept.length;
    if (kept.length) {
      /* the DEVICE shape the Worker writes, and through --path: a JSON argument loses its quotes to the shell */
      try { IO.put(name, { device: name.slice(2).split(":")[0], updated: nowISO(), queue: kept }); }
      catch (e) { console.error("  could not rewrite " + name + ": " + wranglerSaid(e)); }
    } else { IO.del(name); }
  }
  console.log(`FORGOT ${at}`);
  console.log(`  removed from the file: ${fromFile}   removed from KV: ${fromKv}`);
  if (!fromFile && !fromKv) console.log("  nothing carried that timestamp; check it against --status.");
  else console.log("  it will not reach the ledger.");
}

/* --retire-orders-blob (fold 2.1): the old orders blob goes only when it holds nothing. An entry still in it is a
   stage the fold has not passed, and one that cannot be read is named and kept, as every mode keeps such a key. */
export function runRetireOrdersBlob({ io = {} } = {}) {
  const IO = Object.assign({ get: kvGet, del: kvDelete }, io);
  const raw = IO.get(BLOB);
  if (!raw) { console.log(`${BLOB} is not there: nothing to retire.`); return "absent"; }
  const q = deviceQueue(raw);
  if (!q) { console.log(`REFUSED: ${BLOB} could not be parsed, so it is left alone: ${raw.slice(0, 80)}`); return "unreadable"; }
  if (q.length) {
    console.log(`REFUSED: ${BLOB} still holds ${q.length} entr${q.length === 1 ? "y" : "ies"}; the drafter prunes each once the fold passes it:`);
    for (const e of q) console.log(`  ${(e && e.at) || "(no at)"}  ${String((e && e.raw) || "(no description)").slice(0, 96)}`);
    return "refused";
  }
  if (!IO.del(BLOB)) { console.log(`${BLOB} is empty but could not be deleted: run it again.`); return "failed"; }
  console.log(`RETIRED ${BLOB}: it held nothing, and the orders queue is one key an entry from here.`);
  return "retired";
}

function main() {
  const arg = process.argv[2];
  if (arg === "--retire-orders-blob") { const r = runRetireOrdersBlob(); if (r !== "retired" && r !== "absent") process.exitCode = 1; return; }
  if (arg === "--forget") return runForget();
  if (arg === "--committed") return runCommitted();
  if (arg === "--status") return runStatus();
  if (arg === "--keep") return runDrain({ keep: true });
  return runDrain();
}

// Run only when invoked directly, so the test suite can import the pure helpers.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
