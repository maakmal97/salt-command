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
 *   node tools/drain.mjs --status      read-only: print the KV union and the file, no writes.
 *   node tools/drain.mjs --forget <at> withdraw ONE entry, from the file and from KV, by
 *                                      its own `at`. For testing the phone leg without
 *                                      leaving a fake sale for the daily run to commit.
 *
 * Env:  SALT_DATA overrides the 10_Data folder. Uses the machine's existing wrangler auth;
 *       an unattended run may need CLOUDFLARE_API_TOKEN set.
 */

import { wranglerSaid } from "./cloudflare.mjs";
import { readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { DATA_DIR } from "./book.mjs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const BINDING = "SALT_QUEUE";
const FILE = "salt_queue_cloud.json";

const DATA = DATA_DIR;
const OUT = join(DATA, FILE);

const nowISO = () => new Date().toISOString();

/* ---- wrangler KV helpers -------------------------------------------------------- */
function wr(args) {
  // Run in the repo so wrangler.jsonc (and its KV binding) is found. --remote targets
  // the deployed namespace, not the local simulator.
  return execFileSync("npx", ["wrangler", ...args, "--binding", BINDING, "--remote"], {
    cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32"
  });
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

function runStatus() {
  let keys = [];
  try { keys = kvList(); } catch (e) { console.error("KV unreachable: " + e.message); process.exit(1); }
  const kv = [];
  for (const k of keys) { const v = kvGet(k); if (v) { const j = jsonSlice(v, "{", "}"); if (j && Array.isArray(j.queue)) kv.push(...j.queue); } }
  const file = readFile();
  console.log(`KV: ${keys.length} device key(s), ${kv.length} entr${kv.length === 1 ? "y" : "ies"}.`);
  console.log(`File ${FILE}: ${file.queue.length} entr${file.queue.length === 1 ? "y" : "ies"}.`);
  const all = unionByAt(file.queue, kv);
  console.log(`Union (dedup by at): ${all.length}.`);
  /* LIST THEM, because a count cannot be acted on. --forget needs an entry's own `at`,
     and without this the only way to read one was to drain first, which is the very thing
     you do not want to do while deciding whether an entry should reach the ledger.
     Codes only, never names: this output gets pasted around. */
  if (all.length) {
    console.log("");
    for (const e of all) {
      const where = kv.some(k => k && k.at === e.at) ? "KV " : "file";
      console.log(`  ${where}  ${e.at}  ${String(e.raw || "(no description)").slice(0, 96)}`);
    }
    console.log("");
    console.log("  To take one back out before it reaches the ledger:");
    console.log("    node tools/drain.mjs --forget <at>");
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
    const j = jsonSlice(raw, "{", "}");
    captured.push({ name, raw, entries: (j && Array.isArray(j.queue)) ? j.queue : [] });
  }
  const fresh = captured.flatMap(c => c.entries);
  const file = IO.read();
  const merged = unionByAt(file.queue, fresh);
  IO.write({ updated: nowISO(), desk: "cloud", queue: merged });

  let cleared = 0, kept = 0;
  if (!keep) {
    for (const c of captured) {
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
function runForget() {
  const at = process.argv[3];
  if (!at) { console.error("usage: drain.mjs --forget <the entry's own at, e.g. 2026-08-09T04:12:33.123Z>"); process.exit(2); }

  const f = readFile();
  const before = f.queue.length;
  f.queue = forgetOne(f.queue, at);
  const fromFile = before - f.queue.length;
  if (fromFile) { f.updated = nowISO(); writeAtomic(f); }

  /* and out of KV, or the next drain would simply bring it back */
  let fromKv = 0, keys = [];
  try { keys = kvList(); }
  catch (e) { console.error("KV unreachable, so only the file was cleaned: " + wranglerSaid(e)); }
  for (const name of keys) {
    const raw = kvGet(name); if (!raw) continue;
    const j = jsonSlice(raw, "{", "}"); if (!j || !Array.isArray(j.queue)) continue;
    if (!j.queue.some(e => e && e.at === at)) continue;
    const kept = forgetOne(j.queue, at);
    fromKv += j.queue.length - kept.length;
    if (kept.length) {
      try { wr(["kv", "key", "put", name, JSON.stringify({ updated: nowISO(), desk: j.desk || "cloud", queue: kept })]); }
      catch (e) { console.error("  could not rewrite " + name + ": " + wranglerSaid(e)); }
    } else { kvDelete(name); }
  }
  console.log(`FORGOT ${at}`);
  console.log(`  removed from the file: ${fromFile}   removed from KV: ${fromKv}`);
  if (!fromFile && !fromKv) console.log("  nothing carried that timestamp; check it against --status.");
  else console.log("  it will not reach the ledger.");
}

function main() {
  const arg = process.argv[2];
  if (arg === "--forget") return runForget();
  if (arg === "--committed") return runCommitted();
  if (arg === "--status") return runStatus();
  if (arg === "--keep") return runDrain({ keep: true });
  return runDrain();
}

// Run only when invoked directly, so the test suite can import the pure helpers.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
