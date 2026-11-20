#!/usr/bin/env node
/* orders-import.mjs: the laptop half of the order import (20 Nov 2026, docs/plan-order-import.html, Part 6).
 *
 *   node tools/orders-import.mjs                    dry (the default): every sales rid in ledger/book.json, one line a rid, then a total by verdict and reason
 *   node tools/orders-import.mjs --rids s1,s2       only those rows
 *   node tools/orders-import.mjs --run              the real import
 *
 * The rids go to the Desk's keyed POST /orders/import, 20 at a time (a trip is never split across two calls); the Desk builds each order from the Book,
 * never from this laptop's book.json, which may be a day behind and is read here only for the list of rids. Needs SALT_WRITE_KEY (and SALT_ACCESS_JWT,
 * the owner's `cloudflared access token`, since the route is behind Access) in the environment; SALT_BASE overrides the address, as for every sibling tool.
 *
 * --run refuses unless no Actions run is in progress or queued and no approved row waits unfolded. Each batch is asked dry first, so the orders it
 * expects are in hand, then run; it stops at the first batch with any per-order failure, then reads the batch back from the Desk's GET /orders?all=1 and
 * stops on any difference. It never writes a file. The way back is the Counter's unimport over the same ids (docs/plan-order-import.html). */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { deskAccess } from "./vault-pair-client.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const BATCH = 20;
const BUSY = ["in_progress", "queued", "waiting", "pending", "requested"];
/* every field of the order as the dry run built it, read back and compared; `importedAt` is the run's own and is only required to be there */
const FIELDS = ["id", "u", "status", "product", "qty", "total", "delivery", "mode", "forFriend", "credit", "rid", "ledgerKey", "paid", "moved", "movedOn", "at", "sheet", "imported"];

/** rows (each {rid, trip?}) into batches of at most `size`, a trip kept whole; a trip longer than a batch is an error. */
export function batches(rows, size = BATCH) {
  const groups = [], at = new Map();
  for (const r of rows) {
    if (r.trip && at.has(r.trip)) { groups[at.get(r.trip)].push(r.rid); continue; }
    if (r.trip) at.set(r.trip, groups.length);
    groups.push([r.rid]);
  }
  const out = [];
  let cur = [];
  for (const g of groups) {
    if (g.length > size) throw new Error("a trip of " + g.length + " lines does not fit a batch of " + size);
    if (cur.length + g.length > size) { out.push(cur); cur = []; }
    cur.push(...g);
  }
  if (cur.length) out.push(cur);
  return out;
}
/** `{ import: n, refused: n, why: { reason: n } }` over a run of per-rid results. */
export function tally(results) {
  const t = { import: 0, refused: 0, why: {} };
  for (const r of results || []) {
    if (r.verdict === "import") t.import++;
    else { t.refused++; const w = String(r.why || "no reason"); t.why[w] = (t.why[w] || 0) + 1; }
  }
  return t;
}
/** what stops a real run: an Actions run in progress, or an approved row not folded. Each is a sentence; none means go. */
export function runGuards({ runs, approved }) {
  const out = [];
  if (!Array.isArray(runs)) out.push("the Actions runs could not be read, so none is known to be idle");
  else { const busy = runs.filter((r) => r && BUSY.includes(String(r.status || "").toLowerCase())); if (busy.length) out.push(busy.length + " Actions run" + (busy.length === 1 ? " is" : "s are") + " in progress or queued"); }
  if (!approved || !Number.isInteger(approved.count) || approved.count < 0) out.push("the approved rows could not be read, so none is known to be folded");
  else if (approved.count > 0 || approved.held > 0) out.push((approved.count || 0) + (approved.held || 0) + " approved row(s) wait unfolded");
  return out;
}
/** a batch that stops the run: any per-order failure among its results (an import verdict the Counter did not take). */
export const failures = (results) => (results || []).filter((r) => r.verdict === "import" && r.ok !== true);
/** the fields on which an order read back differs from the one the dry run built; `importedAt` must be present. */
export function diffOrder(want, got) {
  if (!got) return ["missing on the Counter"];
  const d = FIELDS.filter((f) => JSON.stringify(want[f]) !== JSON.stringify(got[f]));
  if (typeof got.importedAt !== "string" || !got.importedAt) d.push("importedAt");
  return d;
}
/** one printed line a rid. */
export const line = (r) => (r.rid + "  " + r.verdict + (r.verdict === "import" ? (r.id ? "  " + r.id + (r.ok === true ? (r.again ? "  (already there)" : "  ok") : "  FAILED: " + (r.why || "")) : r.order ? "  " + r.order.id : "") : "  " + (r.why || "")));

const salesRids = (file) => { const b = JSON.parse(readFileSync(file, "utf8")); return (b.sales || []).filter((s) => s && s.rid && s.customer).map((s) => ({ rid: s.rid, trip: s.trip || null })); };
function outside() {
  const gh = spawnSync("gh", ["run", "list", "--limit", "30", "--json", "status,workflowName"], { cwd: REPO, shell: true, encoding: "utf8" });
  let runs = null; try { if (gh.status === 0) runs = JSON.parse(gh.stdout); } catch (e) { runs = null; }
  const dr = spawnSync("node", ["tools/drafts.mjs", "--approved"], { cwd: REPO, shell: true, encoding: "utf8" });
  let approved = null; try { const s = String(dr.stdout || ""); approved = JSON.parse(s.slice(s.indexOf("{"))); } catch (e) { approved = null; }
  return { runs, approved };
}
export function client({ base, key, token, fetch: transport = globalThis.fetch }) {
  const headers = { "X-Salt-Key": key, "content-type": "application/json", ...deskAccess(token) };
  const root = base.replace(/\/+$/, "");
  return {
    async imp(rids, dry) {
      const r = await transport(root + "/orders/import", { method: "POST", headers, body: JSON.stringify({ rids, dry }), cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      return r.ok && j.ok ? { ok: true, results: j.results } : { ok: false, error: (j.error || "HTTP " + r.status) + " (" + r.status + ")" };
    },
    async orders() {
      const r = await transport(root + "/orders?all=1", { headers, cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      return r.ok && j.ok ? { ok: true, orders: j.orders } : { ok: false, error: (j.error || "HTTP " + r.status) };
    }
  };
}
/** the whole run over `groups` of rids, against a client; `say` prints. Returns { ok, results }. A dry run never writes. */
export async function drive(c, groups, { run, say = () => {} }) {
  const all = [];
  for (const rids of groups) {
    const want = await c.imp(rids, true);
    if (!want.ok) { say("STOP: " + want.error); return { ok: false, results: all }; }
    if (!run) { for (const r of want.results) { say(line(r)); all.push(r); } continue; }
    const made = new Map(want.results.filter((r) => r.order).map((r) => [r.rid, r.order]));
    const got = await c.imp(rids, false);
    if (!got.ok) { say("STOP: " + got.error); return { ok: false, results: all }; }
    for (const r of got.results) { say(line(r)); all.push(r); }
    const bad = failures(got.results);
    if (bad.length) { say("STOP: " + bad.length + " order(s) failed in this batch: " + bad.map((r) => r.rid).join(", ")); return { ok: false, results: all }; }
    const back = await c.orders();
    if (!back.ok) { say("STOP: the orders could not be read back: " + back.error); return { ok: false, results: all }; }
    const byId = new Map(back.orders.map((o) => [o.id, o]));
    const diffs = got.results.filter((r) => r.verdict === "import").map((r) => ({ rid: r.rid, d: diffOrder(made.get(r.rid) || {}, byId.get(r.id)) })).filter((x) => x.d.length);
    if (diffs.length) { say("STOP: read back differs: " + diffs.map((x) => x.rid + " (" + x.d.join(", ") + ")").join("; ")); return { ok: false, results: all }; }
    say("read back: " + got.results.filter((r) => r.verdict === "import").length + " order(s) match");
  }
  return { ok: true, results: all };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const argv = process.argv.slice(2), run = argv.includes("--run"), i = argv.indexOf("--rids");
  const key = process.env.SALT_WRITE_KEY;
  if (!key) { console.error("Set SALT_WRITE_KEY in the environment (and SALT_ACCESS_JWT); neither is ever written to a file."); process.exit(2); }
  if (run && argv.includes("--dry")) { console.error("--run and --dry are opposites."); process.exit(2); }
  const rows = i >= 0 && argv[i + 1] ? argv[i + 1].split(",").map((x) => ({ rid: x.trim(), trip: null })).filter((x) => x.rid) : salesRids(resolve(REPO, "ledger", "book.json"));
  if (run) {
    const g = runGuards(outside());
    if (g.length) { console.error("Refused: " + g.join("; ") + "."); process.exit(1); }
  }
  /* a --rids list cannot know the trips, so the Desk refuses a trip line asked alone; the full list keeps each trip whole */
  const c = client({ base: process.env.SALT_BASE || "https://salt-command.qyts8mh72kyg.workers.dev", key, token: process.env.SALT_ACCESS_JWT });
  const r = await drive(c, batches(rows), { run, say: (s) => console.log(s) });
  const t = tally(r.results);
  console.log((run ? "RUN" : "DRY") + ": " + r.results.length + " rid(s): " + t.import + " import, " + t.refused + " refused");
  for (const [w, n] of Object.entries(t.why).sort((a, b) => b[1] - a[1])) console.log("  " + String(n).padStart(4) + "  " + w);
  process.exit(r.ok ? 0 : 1);
}
