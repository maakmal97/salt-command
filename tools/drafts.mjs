#!/usr/bin/env node
/* drafts.mjs — the approval step, from the laptop side.
 *
 * A queued entry does not become a ledger row unattended. Something drafts the ROW, the phone
 * approves or rejects it, and only approved rows are folded into the master. This tool is the
 * laptop half of that: it applies the schema, lists what is waiting, and hands the commit run
 * the rows that were approved.
 *
 * IT DOES NOT WRITE ROWS INTO THE MASTER, and that is the same refusal tools/update.mjs makes
 * for the same reason: which product, whose bucket, what cost, what the note says are
 * judgements, and a script that guessed would be worse than one that declines. What this adds
 * is that the judgement is now written down BEFORE it is applied, and looked at.
 *
 * Modes:
 *   node tools/drafts.mjs --schema             apply migrations/0002_draft.sql
 *   node tools/drafts.mjs --list [--all]       what is waiting, read-only (default: pending)
 *   node tools/drafts.mjs --draft <file.json>  stage a proposed row for approval
 *   node tools/drafts.mjs --approved           the approved, uncommitted rows the run should fold in
 *   node tools/drafts.mjs --committed <id>...  mark rows as folded into the master
 *   --local                                    act on the local D1 rather than the remote one
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DB = "salt_ledger";
const WHERE = process.argv.includes("--local") ? "--local" : "--remote";
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const valOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

let failed = 0;
const ok = (m) => console.log("  ok    " + m);
const fail = (m) => { failed++; console.log("  FAIL  " + m); };

function wrangler(args, { quiet = false } = {}) {
  const r = spawnSync("npx", ["wrangler", ...args], { cwd: REPO, shell: true, encoding: "utf8" });
  const out = ((r.stdout || "") + (r.stderr || "")).trim();
  if (!quiet && out) console.log(out.split("\n").map((l) => "        " + l).join("\n"));
  return { code: r.status === null ? 1 : r.status, out };
}
/* Reads go through --command, not --file: given a file wrangler returns an execution summary
   rather than the rows, so a SELECT run that way looks successful and carries no data. The
   same trap 0001's tooling documents. */
function query(sql) {
  const r = wrangler(["d1", "execute", DB, WHERE, "--json", "--command", JSON.stringify(sql)], { quiet: true });
  const i = r.out.indexOf("["), j = r.out.lastIndexOf("]");
  if (i < 0 || j < i) { fail("could not read a JSON result from wrangler:\n        " + r.out.split("\n").slice(0, 4).join("\n        ")); return null; }
  try {
    const parsed = JSON.parse(r.out.slice(i, j + 1));
    return (parsed[0] && parsed[0].results) || [];
  } catch (e) { fail("wrangler returned unparseable JSON: " + e.message); return null; }
}
const q = (v) => v === null || v === undefined ? "NULL" : "'" + String(v).split("'").join("''") + "'";
const num = (v) => (typeof v === "number" && Number.isFinite(v)) ? String(v) : "NULL";
const money = (v) => v == null ? "-" : "RM " + Number(v).toLocaleString("en-MY", { maximumFractionDigits: 2 });

/* ---- schema -------------------------------------------------------------------------- */
function schema() {
  const f = resolve(REPO, "migrations", "0002_draft.sql");
  if (!existsSync(f)) { fail("migrations/0002_draft.sql is not there"); return; }
  const r = wrangler(["d1", "execute", DB, WHERE, "--file=migrations/0002_draft.sql"], { quiet: true });
  if (r.code !== 0) { fail("could not apply the migration:\n        " + r.out.split("\n").slice(0, 6).join("\n        ")); return; }
  ok("migrations/0002_draft.sql applied to " + DB + " (" + WHERE.replace("--", "") + ")");
}

/* ---- list ---------------------------------------------------------------------------- */
function list() {
  const all = has("--all");
  const sql = "SELECT id,status,collection,party,product,date,qty,total,cost,reasoning,flags,drafter,drafted_at,decided_at,committed_at"
    + " FROM draft" + (all ? "" : " WHERE status='pending'") + " ORDER BY drafted_at";
  const rows = query(sql);
  if (!rows) return;
  if (!rows.length) { ok(all ? "the draft table is empty" : "nothing is waiting for a decision"); return; }
  console.log("  " + rows.length + (all ? " draft(s)" : " waiting for a decision") + ":\n");
  for (const r of rows) {
    const per = (r.total != null && r.qty) ? money(r.total / r.qty) + "/unit" : "";
    const marginPct = (r.total > 0 && r.cost != null && r.qty)
      ? (((r.total - r.cost * r.qty) / r.total) * 100).toFixed(1) + "%" : "-";
    console.log("  " + r.id + "   [" + r.status + "]" + (r.committed_at ? " committed" : ""));
    console.log("    " + (r.collection === "purchases" ? "BUY " : "SELL") + "  " + (r.party || "?")
      + "  " + (r.qty ?? "?") + " unit " + (r.product || "salt")
      + "  " + money(r.total) + (per ? "  (" + per + ")" : "")
      + "   cost " + money(r.cost) + "/unit   margin " + marginPct);
    console.log("    date: " + (r.date || "NONE (pending: nothing has moved)") + "   drafted by " + r.drafter);
    let flags = [];
    try { flags = JSON.parse(r.flags || "[]"); } catch (e) { /* a bad flags blob must not hide the row */ }
    for (const f of flags) console.log("    FLAG: " + f);
    console.log("    " + String(r.reasoning || "").replace(/\s+/g, " ").slice(0, 300));
    console.log("");
  }
  if (!all) console.log("  Approve or reject on the phone, or read them all with --all.\n");
}

/* ---- draft --------------------------------------------------------------------------- */
/* Staged from a file rather than from flags. A proposed row carries a date, a cost, a bucket
   and prose; that is not a command line, and putting it in a file means the thing approved is
   the thing that was written down. */
function draft() {
  const f = valOf("--draft");
  if (!f) { fail("--draft needs a JSON file: {id,collection,entry,row,reasoning,flags,drafter}"); return; }
  if (!existsSync(f)) { fail("no such file: " + f); return; }
  let d;
  try { d = JSON.parse(readFileSync(f, "utf8")); }
  catch (e) { fail("could not parse " + f + ": " + e.message); return; }
  for (const k of ["id", "entry", "row", "reasoning"]) {
    if (!d[k]) { fail(k + " is required. A draft with no proposed row is just a queue entry."); return; }
  }
  const collection = d.collection === "purchases" ? "purchases" : "sales";
  const row = d.row;
  const sql = "INSERT OR IGNORE INTO draft (id,status,collection,entry,row,reasoning,flags,party,product,date,qty,total,cost,drafter,drafted_at) VALUES ("
    + [q(d.id), "'pending'", q(collection), q(JSON.stringify(d.entry)), q(JSON.stringify(row)), q(d.reasoning),
       q(JSON.stringify(d.flags || [])), q(row.customer || row.supplier || null),
       q(row.product || (collection === "sales" ? "salt" : null)), q(row.date || null),
       num(row.qty), num(row.total), num(row.cost), q(d.drafter || "laptop"), q(new Date().toISOString())].join(",")
    + ")";
  const r = wrangler(["d1", "execute", DB, WHERE, "--json", "--command", JSON.stringify(sql)], { quiet: true });
  if (r.code !== 0) { fail("the insert failed:\n        " + r.out.split("\n").slice(0, 6).join("\n        ")); return; }
  ok("staged " + d.id + " for approval. It is PENDING until it is approved on the phone.");
}

/* ---- approved ------------------------------------------------------------------------ */
/* What the commit run asks for: approved and not yet folded into the master. Approved and
   committed are different questions, because an approved row stays approved forever. */
function approved() {
  const rows = query("SELECT id,collection,row,reasoning,flags,decided_at,decided_by FROM draft"
    + " WHERE status='approved' AND committed_at IS NULL ORDER BY drafted_at");
  if (!rows) return;
  const out = rows.map((r) => {
    const parse = (s, d) => { try { return s == null ? d : JSON.parse(s); } catch (e) { return d; } };
    return { id: r.id, collection: r.collection, row: parse(r.row, null), reasoning: r.reasoning,
             flags: parse(r.flags, []), decidedAt: r.decided_at, decidedBy: r.decided_by };
  });
  console.log(JSON.stringify({ ok: true, count: out.length, approved: out }, null, 1));
}

/* ---- committed ----------------------------------------------------------------------- */
function committed() {
  const i = argv.indexOf("--committed");
  const ids = argv.slice(i + 1).filter((a) => !a.startsWith("--"));
  if (!ids.length) { fail("--committed needs at least one draft id"); return; }
  for (const id of ids) {
    const cur = query("SELECT status,committed_at FROM draft WHERE id=" + q(id));
    if (!cur) return;
    if (!cur.length) { fail("no such draft: " + id); continue; }
    if (cur[0].status !== "approved") { fail(id + " is " + cur[0].status + ", not approved; refusing to mark it committed"); continue; }
    if (cur[0].committed_at) { ok(id + " was already marked committed at " + cur[0].committed_at); continue; }
    const r = wrangler(["d1", "execute", DB, WHERE, "--json", "--command",
      JSON.stringify("UPDATE draft SET committed_at=" + q(new Date().toISOString()) + " WHERE id=" + q(id) + " AND committed_at IS NULL")], { quiet: true });
    if (r.code !== 0) { fail("could not mark " + id + " committed"); continue; }
    ok(id + " marked committed");
  }
}

/* ---- main ---------------------------------------------------------------------------- */
if (has("--schema")) schema();
else if (has("--draft")) draft();
else if (has("--approved")) approved();
else if (has("--committed")) committed();
else if (has("--list") || argv.filter((a) => a !== "--local" && a !== "--all").length === 0) list();
else { console.log("unknown mode. See the header of tools/drafts.mjs for the four."); process.exit(2); }

process.exit(failed ? 1 : 0);
