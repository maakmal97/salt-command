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
import "./cloudflare.mjs";
import { readFileSync, existsSync, writeFileSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { DATA_DIR } from "./book.mjs";
import { spawnSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DB = "salt_ledger";
const WHERE = process.argv.includes("--local") ? "--local" : "--remote";
const DATA = DATA_DIR;
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
/* WRITES GO THROUGH --file (v478). An INSERT carries the entry, the row and the reasoning as
   JSON on the command line, and on Windows the shell reads a | in an order key as a pipe: the
   first Correction staged from this machine failed with "'2026-09-02' is not recognized as an
   internal or external command". A write wants no rows back, so the file form is safe for it. */
function execFile(sql) {
  const f = join(REPO, "test", "tmp", `d1-${Date.now()}.sql`);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, sql + ";" + String.fromCharCode(10), "utf8");
  const r = wrangler(["d1", "execute", DB, WHERE, "--json", "--file", JSON.stringify(f)], { quiet: true });
  try { rmSync(f, { force: true }); } catch (e) { /* best effort */ }
  return r;
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
/* Every migration from 0002 in order, read off the folder (0001 is tools/d1.mjs's). A list written here by hand stopped at
   0009 while 0010 and 0011 shipped, so a local D1 built by --schema had no preapproval table and the card's Accept failed. */
export const schemaFiles = () => readdirSync(resolve(REPO, "migrations")).filter((n) => /^\d{4}_.*\.sql$/.test(n) && n >= "0002").sort();
function schema() {
  /* v628: in order for a new database; a live one takes the newest alone (its own header says why) */
  for (const name of schemaFiles()) {
    if (!existsSync(resolve(REPO, "migrations", name))) { fail("migrations/" + name + " is not there"); continue; }
    const r = wrangler(["d1", "execute", DB, WHERE, "--file=migrations/" + name], { quiet: true });
    /* v519: 0006 is an ADD COLUMN, which SQLite refuses the second time; that refusal means applied */
    if (r.code !== 0 && /duplicate column/i.test(r.out)) { ok("migrations/" + name + " was already applied"); continue; }
    if (r.code !== 0) { fail("could not apply " + name + ":\n        " + r.out.split("\n").slice(0, 6).join("\n        ")); continue; }
    ok("migrations/" + name + " applied to " + DB + " (" + WHERE.replace("--", "") + ")");
  }
}

/* ---- list ---------------------------------------------------------------------------- */
/* v596: A DRAFT'S COST IS THE ORDER'S, ABSOLUTE, as it has been since v496, and this read it as a
   unit cost: 10 unit of oil for RM 150 at RM 75.25 printed "cost RM 75.25/unit   margin -401.7%"
   where the phone's Approve card showed RM 75.25 (RM 7.53/unit) and 49.8%. It reads as the card does. */
/* v606: AND THE MARGIN IS STRUCK ON THE GOODS TOO, on his ruling of 12 Sep 2026 that the
   delivery charge is a pass-through at cost. It is revenue with no matching cost on the row, so
   counting it flatters the margin on every delivered order, in the one direction that matters:
   these figures exist to catch underpricing. v602 put the RATE on the goods and left this. */
export function costAndMargin(r) {
  const unit = (r.cost != null && r.qty > 0) ? " (" + money(r.cost / r.qty) + "/unit)" : "";
  const goods = goodsOf(r);
  const margin = (goods > 0 && r.cost != null && r.qty) ? (((goods - r.cost) / goods) * 100).toFixed(1) + "%" : "-";
  return "cost " + money(r.cost) + unit + "   margin " + margin;
}

/* The delivery is not a column of its own; it is in the proposed row, which is the thing being
   approved. One reader for both figures, so the rate and the margin cannot drift apart again. */
function goodsOf(r) {
  let delivery = 0;
  try { const proposed = JSON.parse(r.row || "{}"); if (typeof proposed.delivery === "number") delivery = proposed.delivery; }
  catch (e) { /* a bad row blob reads as no delivery rather than hiding the figures */ }
  /* 19 Sep 2026: the total IS the goods now, the carriage having moved out beside it */
  return (r.total == null) ? 0 : r.total;
}

/* v602: THE SELLING RATE IS STRUCK ON THE GOODS, as every rate on the desk has been since v502
   and as the phone's Approve card shows it. This divided the whole total, the delivery charge
   inside it, by the units: the 10 unit oil order at RM 150 carrying RM 20 of delivery read
   RM 15/unit here against RM 13/unit on the phone, on the same row. The delivery is not a column
   of its own; it is in the PROPOSED ROW, which is the thing being approved, so it is read from
   there. A row that carries no delivery is unchanged, which is every salt row to date. */
export function rateLine(r) {
  if (r.total == null || !r.qty) return "";
  return money(goodsOf(r) / r.qty) + "/unit";
}
function list() {
  const all = has("--all");
  const sql = "SELECT id,status,collection,party,product,date,qty,total,cost,row,reasoning,flags,drafter,drafted_at,decided_at,committed_at"
    + " FROM draft" + (all ? "" : " WHERE status='pending'") + " ORDER BY drafted_at";
  const rows = query(sql);
  if (!rows) return;
  if (!rows.length) { ok(all ? "the draft table is empty" : "nothing is waiting for a decision"); return; }
  console.log("  " + rows.length + (all ? " draft(s)" : " waiting for a decision") + ":\n");
  for (const r of rows) {
    const per = rateLine(r);
    console.log("  " + r.id + "   [" + r.status + "]" + (r.committed_at ? " committed" : ""));
    console.log("    " + (r.collection === "purchases" ? "BUY " : "SELL") + "  " + (r.party || "?")
      + "  " + (r.qty ?? "?") + " unit " + (r.product || "salt")
      + "  " + money(r.total) + (per ? "  (" + per + ")" : "")
      + "   " + costAndMargin(r));
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
  /* v518: a hand-staged count was written as a sale, because this read every collection but
     purchases as sales. The fold then planned it as "SELL undefined". The drafter's five other
     collections are honoured; anything else is still a sale. */
  /* v628: and repayment and rename (v633: and place), which the list had never named, so a hand-staged one was written as a sale */
  const collection = ["purchases", "count", "loss", "lostDemand", "roster", "priceset", "loan", "repayment", "rename", "place", "tierset"].includes(d.collection) ? d.collection : "sales";
  const row = d.row;
  /* v478: amends and amend_kind travel with the draft, as they do from the Worker. Without them the
     fold reads an amendment as nameless and refuses it, which is what the laptop road had done to
     every Correction it staged. */
  const sql = "INSERT OR IGNORE INTO draft (id,status,collection,entry,row,reasoning,flags,party,product,date,qty,total,cost,amends,amend_kind,drafter,drafted_at) VALUES ("
    + [q(d.id), "'pending'", q(collection), q(JSON.stringify(d.entry)), q(JSON.stringify(row)), q(d.reasoning),
       q(JSON.stringify(d.flags || [])), q(row.customer || row.supplier || null),
       q(row.product || (collection === "sales" ? "salt" : null)), q(row.date || null),
       num(row.qty), num(row.total), num(row.cost), q(d.amends || null), q(d.amendKind || null), q(d.drafter || "laptop"), q(new Date().toISOString())].join(",")
    + ")";
  const r = execFile(sql);
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
 * drafters would disagree the first time either was touched. The book and the insert both go
 * through wrangler, so this needs no write key.
 *
 * THE BOOK CAME OVER THE KEYED READS AND THE ROAD WAS SHUT (16 Sep 2026). It read the book from
 * /ledger, /ledger/state, /ledger/sales and /ledger/purchases, which were open reads when this
 * was written and have needed X-Salt-Key since the gate was armed on 16 Aug 2026. It sent none,
 * so the first GET answered 401 and every run died on "could not read the book from the mirror",
 * which is why CLAUDE.md has carried this path as broken. No shell on the laptop holds that key:
 * d1.mjs and update.mjs hit the same wall and both read the mirror through wrangler's own login
 * instead. This now does the same, taking the rows the endpoints themselves serve, in the same
 * shapes, from the same D1 tables, and it follows --local with them.
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

  /* The four reads the endpoints make, made here: the version off `snapshot`, the state map off
     `state` with the __ keys the endpoint hides dropped, and each collection off `entry` in seq
     order. A null back from query() has already said why, so it returns rather than repeating it. */
  const docsOf = (c) => {
    const rs = query("SELECT doc FROM entry WHERE collection='" + c + "' ORDER BY seq");
    if (!rs) return null;
    try { return rs.map((r) => JSON.parse(r.doc)); }
    catch (e) { fail("a " + c + " row in the mirror is not JSON: " + e.message); return null; }
  };
  const snap = query("SELECT v FROM snapshot WHERE one=1");
  if (!snap) return;
  const stRows = query("SELECT key,doc FROM state ORDER BY key");
  if (!stRows) return;
  const sales = docsOf("sales"); if (!sales) return;
  const purchases = docsOf("purchases"); if (!purchases) return;
  if (!snap.length) { fail("the mirror is empty; run `node tools/ledger.mjs && node tools/d1.mjs --seed` first"); return; }
  const state = {};
  try {
    for (const r of stRows) { if (String(r.key).startsWith("__")) continue; state[r.key] = JSON.parse(r.doc); }
  } catch (e) { fail("a state row in the mirror is not JSON: " + e.message); return; }
  const book = { version: snap[0].v, sales, purchases, state, pricing: state.PRICING || null };
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
        const rr = execFile(rsql);
        if (rr.code !== 0) fail("could not record the refusal of " + entry.at + "; it will not show on the phone");
        continue;
      }
      const row = d.row;
      const sql = "INSERT OR IGNORE INTO draft (id,status,collection,entry,row,reasoning,flags,party,product,date,qty,total,cost,amends,amend_kind,drafter,drafted_at) VALUES ("
        + [q(entry.at), "'pending'", q(d.collection), q(JSON.stringify(entry)), q(JSON.stringify(row)), q(d.reasoning),
           q(JSON.stringify(d.flags)), q(row.customer || row.supplier || null),
           q(row.product || (d.collection === "sales" ? "salt" : null)), q(row.date || null),
           num(row.qty), num(row.total), num(row.cost), q(d.amends || null), q(d.amendKind || null), q("laptop-queue"), q(new Date().toISOString())].join(",")
        + ")";
      const r = execFile(sql);
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
    const r = execFile(sql);   /* 08 Sep 2026: every write goes by --file; --command hands the text to a shell */
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
  /* v519: --live <ISO> is the moment the deploy job proved the phone was serving the build; its
     value is not an id, so it is excluded by position as --by is in approve() */
  const liveAt = valOf("--live") || null, liveIdx = argv.indexOf("--live");
  const ids = argv.slice(i + 1).filter((a, k) => !a.startsWith("--") && (liveIdx < 0 || (i + 1 + k) !== liveIdx + 1));
  if (!ids.length) { fail("--committed needs at least one draft id"); return; }
  const clock = [];
  for (const id of ids) {
    const cur = query("SELECT status,committed_at,decided_at,live_at FROM draft WHERE id=" + q(id));
    if (!cur) return;
    /* v391: A FOLD STATED DIRECTLY HAS NO DRAFTS BEHIND IT, AND THAT IS NOT A FAILURE.
       This step exists to mark the drafts a fold consumed. When he states the day's trade
       instead of queueing it, the fold writes rows with no draft ids that mean anything, and
       CI then tried to mark them and exited 1 on every push from 27 Aug. That failure sat
       BEFORE the D1 re-seed in the same job, so the mirror went a week stale behind it: one
       stale file, an inbox of failure mail, and a drafter reading a book from before the
       26th. "There was no draft" is a valid answer to "mark the draft". */
    if (!cur.length) { ok(id + ": no draft behind it, which is what a fold stated directly looks like"); continue; }
    if (cur[0].status !== "approved") { fail(id + " is " + cur[0].status + ", not approved; refusing to mark it committed"); continue; }
    if (cur[0].committed_at) { ok(id + " was already marked committed at " + cur[0].committed_at); continue; }
    const at = new Date().toISOString();
    const r = execFile("UPDATE draft SET committed_at=" + q(at) + ", live_at=" + (liveAt ? q(liveAt) : "NULL") + " WHERE id=" + q(id) + " AND committed_at IS NULL");
    if (r.code !== 0) { fail("could not mark " + id + " committed"); continue; }
    ok(id + " marked committed");
    clock.push(clockLine(id, cur[0].decided_at, liveAt, at));
  }
  /* THE LITERAL CHECK (v519): tap to phone and tap to committed, from D1's own timestamps, on
     every approval. Printed here, and into the run summary when Actions offers one. */
  if (clock.length) {
    for (const c of clock) console.log("  clock " + c);
    if (process.env.GITHUB_STEP_SUMMARY) {
      try { writeFileSync(process.env.GITHUB_STEP_SUMMARY, "### The clock\n\n" + clock.map((c) => "- " + c).join("\n") + "\n", { flag: "a" }); } catch (e) { /* the summary is a courtesy */ }
    }
  }
}
/* seconds from the tap, or a dash when a timestamp is missing (a fold stated directly has no tap) */
export function clockLine(id, decidedAt, liveAt, committedAt) {
  const sec = (a, b) => (a && b) ? Math.round((new Date(b) - new Date(a)) / 1000) + " s" : "-";
  return id + ": tap to phone " + sec(decidedAt, liveAt) + ", tap to committed " + sec(decidedAt, committedAt);
}

/* ---- a refusal the fold made, put where the phone shows refusals (v512) ------------------
   The drafter writes `refused` for what it will not draft; the fold has had no way to say what it
   would not fold. This records one, keyed on the draft id so the drafter's self-cleaning retires
   it once the watermark passes, or, while its entry is still queued, once that entry is withdrawn
   (v586). Source "fold", so the phone can tell the two apart. */
function refusedNote() {
  const i = argv.indexOf("--refused-note");
  const id = argv[i + 1], why = argv.slice(i + 2).filter((a) => !a.startsWith("--")).join(" ");
  if (!id || !why) { fail("--refused-note needs a draft id and a reason"); return; }
  const cur = query("SELECT entry,party FROM draft WHERE id=" + q(id));
  if (!cur) return;
  const entry = cur.length ? cur[0].entry : JSON.stringify({ raw: id });
  const party = cur.length ? cur[0].party : null;
  /* 08 Sep 2026: BY FILE, NOT BY --command. With shell:true the reason went to /bin/sh on the runner,
     where a backtick in the fold's own refusal text ran as a command and the stored note read
     "the party of a row is , not". The entry JSON carries phone-typed text on the same road. */
  const r = execFile("INSERT OR REPLACE INTO refused (id,entry,why,party,source,seen_at) VALUES (" + q(id) + "," + q(entry) + "," + q(why) + "," + (party == null ? "NULL" : q(party)) + ",'fold'," + q(new Date().toISOString()) + ")");
  if (r.code !== 0) { fail("could not record the refusal of " + id); return; }
  ok(id + " recorded as refused by the fold");
}

/* v805: a test notice goes the moment a later run's suite passes; the drafter's own rule keeps a fold notice until a fold commits */
function clearSuiteNotices() {
  const r = execFile("DELETE FROM refused WHERE id LIKE 'suite:%'");
  if (r.code !== 0) { fail("could not clear the test notices"); return; }
  ok("test notices cleared: the suite passed");
}

/* ---- main ---------------------------------------------------------------------------- */
/* v596: only when run, so the suite can import costAndMargin without reading the live table and
   exiting. fold.mjs's own line: a hand-built file URL is false on Linux, and the job would do nothing. */
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  if (has("--schema")) schema();
  else if (has("--draft")) draft();
  else if (has("--from-queue")) await fromQueue();
  else if (has("--refused-note")) refusedNote();
  else if (has("--clear-suite-notices")) clearSuiteNotices();
  else if (has("--approve")) approve();
  else if (has("--approved")) approved();
  else if (has("--committed")) committed();
  else if (has("--list") || argv.filter((a) => a !== "--local" && a !== "--all").length === 0) list();
  else { console.log("unknown mode. See the header of tools/drafts.mjs for the four."); process.exit(2); }

  process.exit(failed ? 1 : 0);
}
