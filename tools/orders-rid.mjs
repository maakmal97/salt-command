#!/usr/bin/env node
/* orders-rid.mjs: the laptop half of the rid backfill (21 Nov 2026, item 3A of docs/plan-ledger-simplify.html, his answer E: run by him, dry first).
 *
 *   node tools/orders-rid.mjs          dry (the default): every order the clean tie-out would stamp with its row's rid, one line an order, then the
 *                                      orders whose rid names a row no longer live (their stages naming it are refused at drafting), and a total
 *   node tools/orders-rid.mjs --run    the real stamp: each order marked with its row's rid on the Counter, every one read back
 *
 * Over the Desk's keyed POST /orders/rid, which builds the list from the Book and the site's orders as the minute's tie-out does, never from this laptop's
 * book.json. Refused by the Desk whole unless the tie-out is clean with nothing waiting. --run also refuses here while an Actions run is in progress or an
 * approved row waits unfolded (runGuards, as tools/orders-import.mjs). Needs SALT_WRITE_KEY and SALT_ACCESS_JWT in the environment; SALT_BASE overrides
 * the address. It never writes a file. A stamp is set once on the Counter, so a second run stamps nothing new; there is no undo, nothing to take back:
 * version A reads a rid first and falls back to the key, so an order stamped reads its row as it did. */
import { pathToFileURL } from "node:url";
import { runGuards, outside } from "./orders-import.mjs";
import { deskAccess } from "./vault-pair-client.mjs";

export function client({ base, key, token, fetch: transport = globalThis.fetch }) {
  const headers = { "X-Salt-Key": key, "content-type": "application/json", ...deskAccess(token) };
  const root = base.replace(/\/+$/, "");
  return {
    async stamp(dry) {
      const r = await transport(root + "/orders/rid", { method: "POST", headers, body: JSON.stringify({ dry }), cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      return r.ok && j.ok ? j : { ok: false, error: (j.error || "HTTP " + r.status) + " (" + r.status + ")" };
    }
  };
}
/** the printed lines of one answer: an order a line, the stale ones, the total. */
export function report(a, run) {
  const out = [];
  for (const s of a.stamp || []) out.push(s.id + "  " + (s.ridWas ? s.ridWas + " -> " : "") + s.rid + (run ? ((a.differ || []).includes(s.id) ? "  NOT READ BACK" : "") : ""));
  for (const x of a.staleRid || []) out.push(x.order + "  names " + x.rid + ", no longer a live row: " + x.who);
  out.push((run ? "RUN" : "DRY") + ": " + (a.stamp || []).length + " order(s) to stamp" + (run ? ", " + (a.stamped || 0) + " stamped, " + ((a.failed || []).length) + " failed, "
    + ((a.differ || []).length) + " not read back" : "") + "; " + (a.staleRid || []).length + " naming a row no longer live; " + (a.fallback || 0) + " read by key before this run");
  for (const f of a.failed || []) out.push("  FAILED " + f.id + ": " + f.why);
  return out;
}
/** the whole run against a client: dry first always, then (with run) the stamp. { ok, answer }. */
export async function drive(c, { run, say = () => {} }) {
  const dry = await c.stamp(true);
  if (!dry.ok) { say("STOP: " + dry.error); return { ok: false }; }
  if (!run) { report(dry, false).forEach(say); return { ok: true, answer: dry }; }
  const got = await c.stamp(false);
  if (!got.ok) { say("STOP: " + got.error); return { ok: false }; }
  report(got, true).forEach(say);
  return { ok: !(got.failed || []).length && !(got.differ || []).length && !got.readBack, answer: got };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const argv = process.argv.slice(2), run = argv.includes("--run");
  const key = process.env.SALT_WRITE_KEY;
  if (!key) { console.error("Set SALT_WRITE_KEY in the environment (and SALT_ACCESS_JWT); neither is ever written to a file."); process.exit(2); }
  if (run && argv.includes("--dry")) { console.error("--run and --dry are opposites."); process.exit(2); }
  if (run) {
    const g = runGuards(outside());
    if (g.length) { console.error("Refused: " + g.join("; ") + "."); process.exit(1); }
  }
  const c = client({ base: process.env.SALT_BASE || "https://salt-command.qyts8mh72kyg.workers.dev", key, token: process.env.SALT_ACCESS_JWT });
  const r = await drive(c, { run, say: (s) => console.log(s) });
  process.exit(r.ok ? 0 : 1);
}
