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
 *   node tools/drafts.mjs --schema             apply every migration in migrations/
 *   node tools/drafts.mjs --list [--all]       what is waiting, read-only (default: pending)
 *   node tools/drafts.mjs --draft <file.json>  stage a proposed row for approval
 *   node tools/drafts.mjs --from-queue         draft the LAPTOP queue too, so it passes the same gate
 *   node tools/drafts.mjs --approve <id>... --by "..."   record a decision taken away from the phone
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
const DATA = process.env.SALT_DATA ||
  "C:/Users/maakm/Claude/Projects/Personal/Cow-Crm01_Salt Business/10_Data";
const LAPTOP_QUEUE = resolve(DATA, "salt_queue.json");
const CLOUD_QUEUE  = resolve(DATA, "salt_queue_cloud.json");
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
  /* Both migrations, in order, and each is CREATE TABLE IF NOT EXISTS so re-running is safe. */
  for (const name of ["0002_draft.sql", "0003_refused.sql", "0004_amend.sql", "0005_bookkeeping.sql"]) {
    if (!existsSync(resolve(REPO, "migrations", name))) { fail("migrations/" + name + " is not there"); continue; }
    const r = wrangler(["d1", "execute", DB, WHERE, "--file=migrations/" + name], { quiet: true });
    if (r.code !== 0) { fail("could not apply " + name + ":\n        " + r.out.split("\n").slice(0, 6).join("\n        ")); continue; }
    ok("migrations/" + name + " applied to " + DB + " (" + WHERE.replace("--", "") + ")");
  }
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

/* ---- from-queue ---------------------------------------------------------------------- */
/* THE LAPTOP'S OWN ROAD, routed through the same gate (v305).
 *
 * The phone's entries are drafted in the cloud the moment they arrive. The desk's own queue,
 * 10_Data\salt_queue.json, never goes near the cloud at all: it is written by serve_desk.py
 * when a transaction is entered on the laptop, and until now the daily run folded it straight
 * into the master. That was the second ungated road, and leaving it open would have made the
 * approval step something you could walk around without noticing.
 *
 * It uses the SAME draftRow as the Worker, imported rather than reimplemented, because two
 * drafters would disagree the first time either was touched. The book comes from the live
 * /ledger endpoints, which are open reads, and the insert goes through wrangler, so this needs
 * no write key.
 */
async function fromQueue() {
  const { draftRow } = await import("../src/drafter.js");
  const files = [];
  const arg = valOf("--from-queue");
  if (arg && !arg.startsWith("--")) files.push(arg);
  else {
    for (const f of [LAPTOP_QUEUE, CLOUD_QUEUE]) if (existsSync(f)) files.push(f);
  }
  if (!files.length) { ok("no queue file on disk, so there is nothing to draft"); return; }

  const base = (process.env.SALT_BASE || "https://salt-command.maakmal97.workers.dev").replace(/\/+$/, "");
  const get = async (p) => {
    const r = await fetch(base + p);
    if (!r.ok) throw new Error("GET " + p + " -> " + r.status);
    return r.json();
  };
  let book;
  try {
    const snap = await get("/ledger");
    const st = await get("/ledger/state");
    book = {
      version: snap.snapshot && snap.snapshot.v,
      sales: (await get("/ledger/sales")).rows || [],
      purchases: (await get("/ledger/purchases")).rows || [],
      state: st.state || {},
      pricing: (st.state || {}).PRICING || null
    };
  } catch (e) { fail("could not read the book from the mirror: " + e.message); return; }
  if (!book.pricing) { fail("the mirror carries no PRICING snapshot; run `node tools/ledger.mjs && node tools/d1.mjs --seed` first"); return; }

  const existing = query("SELECT id FROM draft");
  if (!existing) return;
  const already = new Set(existing.map((r) => r.id));
  const mark = book.state.QUEUE_COMMITTED;

  let drafted = 0, skipped = 0, seen = 0;
  for (const f of files) {
    let doc;
    try { doc = JSON.parse(readFileSync(f, "utf8")); }
    catch (e) { fail("could not read " + f + ": " + e.message); continue; }
    for (const entry of (doc.queue || [])) {
      if (!entry || !entry.at) continue;
      seen++;
      if (mark && entry.at <= mark) continue;         // already in the master
      if (already.has(entry.at)) continue;            // already drafted, here or in the cloud
      const d = draftRow(entry, book);
      if (d.skip) {
        skipped++;
        console.log("  skip  " + entry.at + "  " + d.skip);
        /* RECORDED SO THE PHONE CAN SEE IT. This is the half that matters for the laptop
           queue: an amendment typed here is refused by the drafter and would otherwise be
           invisible from the phone, which is how the same CC5-OKR fulfilment came to be
           queued twice on 17 Aug. It cannot be approved from there; it can only be seen. */
        const rsql = "INSERT OR REPLACE INTO refused (id,entry,why,party,source,seen_at) VALUES ("
          + [q(entry.at), q(JSON.stringify(entry)), q(d.skip), q(entry.party || null),
             q("laptop-queue"), q(new Date().toISOString())].join(",") + ")";
        const rr = wrangler(["d1", "execute", DB, WHERE, "--json", "--command", JSON.stringify(rsql)], { quiet: true });
        if (rr.code !== 0) fail("could not record the refusal of " + entry.at + "; it will not show on the phone");
        continue;
      }
      const row = d.row;
      const sql = "INSERT OR IGNORE INTO draft (id,status,collection,entry,row,reasoning,flags,party,product,date,qty,total,cost,drafter,drafted_at) VALUES ("
        + [q(entry.at), "'pending'", q(d.collection), q(JSON.stringify(entry)), q(JSON.stringify(row)), q(d.reasoning),
           q(JSON.stringify(d.flags)), q(row.customer || row.supplier || null),
           q(row.product || (d.collection === "sales" ? "salt" : null)), q(row.date || null),
           num(row.qty), num(row.total), num(row.cost), q("laptop-queue"), q(new Date().toISOString())].join(",")
        + ")";
      const r = wrangler(["d1", "execute", DB, WHERE, "--json", "--command", JSON.stringify(sql)], { quiet: true });
      if (r.code !== 0) { fail("could not stage " + entry.at); continue; }
      already.add(entry.at);
      drafted++;
      console.log("  draft " + entry.at + "  " + (row.customer || row.supplier) + "  " + (row.qty ?? "?") + " unit  RM " + (row.total ?? "?")
        + (d.flags.length ? "   " + d.flags.length + " flag(s)" : ""));
    }
  }
  ok(`${seen} entry(ies) on disk: ${drafted} newly drafted, ${skipped} left for a person, the rest already committed or drafted`);
  if (drafted) console.log("  They are PENDING. Approve them on the phone; nothing reaches the ledger until you do.");
}

/* ---- approve --------------------------------------------------------------------------
 * RECORDING A DECISION TAKEN AWAY FROM THE PHONE (v311).
 *
 * The phone is the normal road and should stay so: it is the surface that shows the cost,
 * the margin and the flags beside the price, which is the whole reason the row is drafted
 * rather than the entry. But the decision belongs to the owner, not to the handset, and he
 * takes it wherever he is. Before this there was no way to record one from here at all, so
 * the choice was to leave his instruction unrecorded or to fold a row the table still called
 * pending, and the second leaves the ledger and the store disagreeing about what happened.
 *
 * --by IS REQUIRED AND MUST SAY WHO AND ON WHAT BASIS. Nothing here may be called blind by a
 * later script: a decision with no stated author is exactly what the approval step exists to
 * prevent, and an empty reason is refused. It writes the same columns a phone tap writes, so
 * the audit trail reads the same and says where the decision actually came from.
 */
function approve() {
  const i = argv.indexOf("--approve");
  const by = (valOf("--by") || "").trim();
  /* The VALUE of --by is not a flag, so a naive "everything after --approve that does not
     start with --" swallows it and then reports it as a missing draft. Anything that follows
     a valued flag is excluded by position rather than by shape. */
  const byAt = argv.indexOf("--by");
  const ids = argv.slice(i + 1)
    .filter((a, k) => !a.startsWith("--") && (byAt < 0 || (i + 1 + k) !== byAt + 1));
  if (!ids.length) { fail("--approve needs at least one draft id"); return; }
  if (!by) { fail("--by is required: say who decided and on what basis. A decision with no author is not one."); return; }
  const at = new Date().toISOString();
  for (const id of ids) {
    const cur = query("SELECT status FROM draft WHERE id=" + q(id));
    if (!cur) return;
    if (!cur.length) { fail("no such draft: " + id); continue; }
    if (cur[0].status !== "pending") { fail(id + " is already " + cur[0].status + "; refusing to decide it twice"); continue; }
    const sql = "UPDATE draft SET status='approved', decided_at=" + q(at) + ", decided_by=" + q(by)
      + " WHERE id=" + q(id) + " AND status='pending'";
    const r = wrangler(["d1", "execute", DB, WHERE, "--json", "--command", JSON.stringify(sql)], { quiet: true });
    if (r.code !== 0) { fail("could not approve " + id); continue; }
    ok(id + " approved (" + by + ")");
  }
}

/* ---- approved ------------------------------------------------------------------------ */
/* What the commit run asks for: approved and not yet folded into the master. Approved and
   committed are different questions, because an approved row stays approved forever. */
function approved() {
  const rows = query("SELECT id,collection,row,reasoning,flags,amends,amend_kind,entry,decided_at,decided_by FROM draft"
    + " WHERE status='approved' AND committed_at IS NULL ORDER BY drafted_at");
  if (!rows) return;
  const out = rows.map((r) => {
    const parse = (s, d) => { try { return s == null ? d : JSON.parse(s); } catch (e) { return d; } };
    /* amends/amendKind are NULL on a new row and set on an amendment. The fold reads them to
       know whether to APPEND `row` or apply a change to the row `amends` names. Carrying them
       here rather than leaving the fold to re-query is what lets the cloud agent, which has no
       credentials, do the whole job from the staged file. */
    return { id: r.id, collection: r.collection, row: parse(r.row, null), reasoning: r.reasoning,
             flags: parse(r.flags, []), amends: r.amends || null, amendKind: r.amend_kind || null,
             entry: parse(r.entry, null),
             decidedAt: r.decided_at, decidedBy: r.decided_by };
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
else if (has("--from-queue")) await fromQueue();
else if (has("--approve")) approve();
else if (has("--approved")) approved();
else if (has("--committed")) committed();
else if (has("--list") || argv.filter((a) => a !== "--local" && a !== "--all").length === 0) list();
else { console.log("unknown mode. See the header of tools/drafts.mjs for the four."); process.exit(2); }

process.exit(failed ? 1 : 0);
