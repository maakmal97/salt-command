/* drain.mjs — move the cloud queue from KV into a file the daily run already reads.
 *
 * The phone POSTs its queue to the Worker, which stores it in KV, one key per device
 * (q:<deviceId>). This drains those keys into 06_Data/salt_queue_cloud.json in the same
 * {updated, desk, queue:[...]} shape as salt_queue.json, so salt-daily-price-brief folds
 * it into the source exactly as it folds the laptop's own queue. Names are never in KV,
 * so nothing sensitive is drained.
 *
 * Modes:
 *   node tools/drain.mjs               pull KV -> file (union by 'at'), then clear the
 *                                      KV keys it drained (race-safe: only if unchanged).
 *   node tools/drain.mjs --committed <ISO>
 *                                      after a successful commit, drop file entries whose
 *                                      'at' <= <ISO> (the QUEUE_COMMITTED watermark the run
 *                                      just set), leaving only still-uncommitted entries.
 *   node tools/drain.mjs --status      read-only: print the KV union and the file, no writes.
 *
 * Env:  SALT_DATA overrides the 06_Data folder. Uses the machine's existing wrangler auth;
 *       an unattended run may need CLOUDFLARE_API_TOKEN set.
 */

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const BINDING = "SALT_QUEUE";
const FILE = "salt_queue_cloud.json";

const DEFAULT_DATA =
  "C:/Users/maakm/Claude/Projects/Personal/Cow-Crm01_Salt Business/06_Data";
const DATA = process.env.SALT_DATA || DEFAULT_DATA;
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
  mkdirSync(DATA, { recursive: true });
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
  console.log(`Union (dedup by at): ${unionByAt(file.queue, kv).length}.`);
}

function runDrain() {
  let keys;
  try { keys = kvList(); }
  catch (e) {
    console.error("DRAIN FAILED: wrangler could not reach the KV namespace.");
    console.error("  " + e.message.split("\n")[0]);
    console.error("  Check `npx wrangler whoami`, that the KV id in wrangler.jsonc is real, and CLOUDFLARE_API_TOKEN for unattended runs.");
    process.exit(1);
  }
  const captured = [];   // {name, raw, entries}
  for (const name of keys) {
    const raw = kvGet(name);
    if (!raw) continue;
    const j = jsonSlice(raw, "{", "}");
    captured.push({ name, raw, entries: (j && Array.isArray(j.queue)) ? j.queue : [] });
  }
  const fresh = captured.flatMap(c => c.entries);
  const file = readFile();
  const merged = unionByAt(file.queue, fresh);
  writeAtomic({ updated: nowISO(), desk: "cloud", queue: merged });

  let cleared = 0, kept = 0;
  for (const c of captured) {
    const now = kvGet(c.name);            // re-read: only delete if this device has not pushed since
    if (now !== null && now === c.raw) { if (kvDelete(c.name)) cleared++; }
    else kept++;                          // changed mid-drain; its new entries land next drain (dedup by at)
  }
  console.log(`DRAIN OK -> ${OUT}`);
  console.log(`  devices: ${captured.length}   fresh entries: ${fresh.length}   file now holds: ${merged.length}`);
  console.log(`  KV keys cleared: ${cleared}${kept ? `, ${kept} left (changed mid-drain, next run gets them)` : ""}`);
  if (merged.length) console.log(`  the daily run should commit ${FILE}, then: node tools/drain.mjs --committed <QUEUE_COMMITTED>`);
}

function main() {
  const arg = process.argv[2];
  if (arg === "--committed") return runCommitted();
  if (arg === "--status") return runStatus();
  return runDrain();
}

// Run only when invoked directly, so the test suite can import the pure helpers.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
