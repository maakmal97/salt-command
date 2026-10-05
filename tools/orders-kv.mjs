/* orders-kv.mjs: retire the Counter's old KV order keys (S10 10.5). LAPTOP ONLY, and nothing runs unless asked.
 *
 *   node tools/orders-kv.mjs --check    the book's own compare of every KV record (the keyed, read-only
 *                                       GET /desk/orders/store-check), then the KV listing; refuses unless every
 *                                       record is same or pending (kvAhead and kvOnly stop it)
 *   node tools/orders-kv.mjs --backup   every value under the prefixes below to 10_Data/orders_kv_backup_<date>.json
 *   node tools/orders-kv.mjs --restore <backup>  puts a backup's keys back (wrangler kv bulk put), allow-listed keys only
 *   node tools/orders-kv.mjs --delete   a clean check AND a backup under an hour old holding every key about to go,
 *                                       both in this run, then a bulk delete of ONLY the keys below; prints counts
 *
 * Needs STMT_URL (the Counter's address, never in the public desk) and STMT_DESK_KEY (the shared key) in the
 * environment, and wrangler's login. THE ALLOW-LIST IS THE WHOLE SAFETY: `allowed` is the one place a key is named,
 * every list and every delete goes through it, and a key outside it throws before wrangler is asked. Every other
 * prefix (u:, ot:, rem:, push:, dev:, seen:, sent:, g:, gboard:, board:, tboard:, slip:, slipkey, sheet, tiers,
 * roster, issue, assoc, desk-waiting, testfix:, pk:, pkd:, maker:hours) is never listed here, let alone deleted. */
import { againIfLapsed } from "./cloudflare.mjs";
import { DATA_DIR } from "./book.mjs";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const NS = "d193671c174545c29dbef5604b1d9502";
export const PREFIXES = ["order:", "aclaim:", "thr:"];
export const EXACT = ["last-placed", "last-touched", "last-said", "last-theirs", "orderbook:check"];
export const allowed = (name) => typeof name === "string" && (EXACT.includes(name) || PREFIXES.some((p) => name.startsWith(p) && name.length > p.length));
export const FRESH_MS = 60 * 60000;

/* the book's compare, as a verdict: null when every KV record is same or pending, else the reason */
export function verdict(c) {
  if (!c || c.ok !== true) return "the book did not answer: " + ((c && c.error) || "no answer");
  /* a book on any other store still writes KV behind it, so a compare read now could be stale an instant later */
  if (c.retired !== true) return "the store is not object (ORDER_STORE), so the book may still write KV";
  const bad = [["kvAhead", c.kvAhead], ["kvOnly", c.kvOnly]].filter(([, l]) => !Array.isArray(l) || l.length);
  return bad.length ? bad.map(([k, l]) => k + " " + (Array.isArray(l) ? l.length : "?")).join(", ") : null;
}
/* the backup holds every key that is to be deleted, and is fresh */
export function backupFault(file, keys, now = Date.now()) {
  if (!existsSync(file)) return "no backup at " + file;
  if (now - statSync(file).mtimeMs > FRESH_MS) return "the backup is over an hour old; run --backup again";
  let b; try { b = JSON.parse(readFileSync(file, "utf8")); } catch (e) { return "the backup does not read"; }
  const miss = keys.filter((k) => !Object.prototype.hasOwnProperty.call(b.values || {}, k));
  return miss.length ? miss.length + " key(s) are not in the backup, e.g. " + miss[0] : null;
}
/* a backup as wrangler's bulk put takes it: [{key, value}], a value kept as a string, only keys the allow-list names */
export function restorePairs(b) {
  const v = (b && b.values) || {};
  return Object.keys(v).filter((key) => v[key] != null).map((key) => {   /* null: a key absent at backup time */
    if (!allowed(key)) throw new Error("refusing: " + key + " is outside the allow-list");
    return { key, value: typeof v[key] === "string" ? v[key] : JSON.stringify(v[key]) };
  });
}
export const backupPath =(day = new Date().toISOString().slice(0, 10)) => join(DATA_DIR, "orders_kv_backup_" + day + ".json");

function wr(args) {
  return againIfLapsed(() => execFileSync("npx", ["wrangler", ...args, "--namespace-id", NS, "--remote"], {
    cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32", maxBuffer: 256 << 20 }));
}
const slice = (s, a, b) => { const i = s.indexOf(a), j = s.lastIndexOf(b); if (i < 0 || j < i) throw new Error("wrangler's answer could not be read"); return JSON.parse(s.slice(i, j + 1)); };
function listAll() {
  const names = [];
  for (const p of PREFIXES) for (const k of slice(wr(["kv", "key", "list", "--prefix", p]), "[", "]")) names.push(k.name);
  for (const e of EXACT) if (slice(wr(["kv", "key", "list", "--prefix", e]), "[", "]").some((k) => k.name === e)) names.push(e);
  for (const n of names) if (!allowed(n)) throw new Error("refusing: " + n + " is outside the allow-list");
  return names;
}
function viaFile(obj, run) {
  const dir = mkdtempSync(join(tmpdir(), "orders-kv-")), f = join(dir, "keys.json");
  try { writeFileSync(f, JSON.stringify(obj)); return run(f); } finally { try { rmSync(dir, { recursive: true, force: true }); } catch (e) { /* temp */ } }
}
async function compare() {
  const url = process.env.STMT_URL, key = process.env.STMT_DESK_KEY;
  if (!url || !key) throw new Error("set STMT_URL and STMT_DESK_KEY");
  const r = await fetch(url.replace(/\/$/, "") + "/desk/orders/store-check", { headers: { "X-Stmt-Desk": key } });
  return r.json();
}
async function check() {
  const c = await compare(), keys = listAll();
  console.log("book: " + JSON.stringify({ orders: c.orders, same: c.same, pending: c.pending, kvAhead: c.kvAhead, kvOnly: c.kvOnly, bookOnly: c.bookOnly }));
  console.log("KV keys under the allow-list: " + keys.length);
  const v = verdict(c);
  if (v) { console.log("REFUSED: " + v); return null; }
  console.log("clean: every KV record is the book's or behind it.");
  return keys;
}
function backup(keys) {
  const values = {};
  for (let i = 0; i < keys.length; i += 100)
    Object.assign(values, viaFile(keys.slice(i, i + 100), (f) => slice(wr(["kv", "bulk", "get", f]), "{", "}")));
  const file = backupPath();
  writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), namespace: NS, values }, null, 1));
  console.log("backup: " + Object.keys(values).length + " of " + keys.length + " keys to " + file);
}
function restore(file) {
  const pairs = restorePairs(JSON.parse(readFileSync(file, "utf8")));
  for (let i = 0; i < pairs.length; i += 5000) viaFile(pairs.slice(i, i + 5000), (f) => wr(["kv", "bulk", "put", f]));
  console.log("restored " + pairs.length + " keys from " + file + ". The kv road is back only once ORDER_MOVE_IN is raised by one and the Worker deployed.");
}
function remove(keys) {
  for (const n of keys) if (!allowed(n)) throw new Error("refusing: " + n + " is outside the allow-list");
  for (let i = 0; i < keys.length; i += 5000) viaFile(keys.slice(i, i + 5000), (f) => wr(["kv", "bulk", "delete", f, "--force"]));
  const by = (p) => keys.filter((k) => k.startsWith(p)).length;
  console.log("deleted " + keys.length + ": " + PREFIXES.map((p) => p + " " + by(p)).join(", ") + ", exact " + keys.filter((k) => EXACT.includes(k)).length);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2];
  if (mode === "--check") process.exit((await check()) ? 0 : 1);
  else if (mode === "--backup") { backup(listAll()); }
  else if (mode === "--restore") {
    if (!process.argv[3] || !existsSync(process.argv[3])) { console.log("node tools/orders-kv.mjs --restore <backup file>"); process.exit(2); }
    restore(process.argv[3]);
  } else if (mode === "--delete") {
    const keys = await check();
    if (!keys) process.exit(1);
    const bad = backupFault(backupPath(), keys);
    if (bad) { console.log("REFUSED: " + bad); process.exit(1); }
    remove(keys);
  } else { console.log("node tools/orders-kv.mjs --check | --backup | --delete"); process.exit(2); }
}
