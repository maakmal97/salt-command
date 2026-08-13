/* d1.mjs — put the extracted book into D1, and prove it came back unchanged.
 *
 * Step two of one source of truth. Step one (tools/ledger.mjs) got the book out of the
 * master and proved the extract; this puts that extract into a store the cloud can read
 * without a rebuild, and then reads it back and compares it to what went in.
 *
 * THE STORE IS A MIRROR AND THE MASTER IS STILL THE SOURCE. Nothing here writes to the
 * master, the Worker cannot write to D1 yet, and the desk still computes from its own
 * arrays. The direction may only flip once the store is proven to reproduce the master's
 * figures exactly, which is a later gate than this one. This gate is narrower and worth
 * having on its own: does the book survive a round trip through SQLite intact?
 *
 * Modes:
 *   node tools/d1.mjs --schema    apply migrations/0001_ledger.sql
 *   node tools/d1.mjs --seed      ledger/ledger.json -> D1 (full replace), then verify
 *   node tools/d1.mjs --verify    read D1 back and deep-compare against ledger/ledger.json
 *   node tools/d1.mjs --status    what the store holds, no writes
 *   --local                       act on the local D1 rather than the remote one
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DB = "salt_ledger";
const LEDGER = resolve(REPO, "ledger", "ledger.json");
const WHERE = process.argv.includes("--local") ? "--local" : "--remote";

import { COLLECTIONS, readBook, bySalt, PROD_ORDER } from "./book.mjs";

const problems = [];
const fail = (m) => { problems.push(m); console.log("  FAIL  " + m); };
const ok = (m) => console.log("  ok    " + m);

function wrangler(args, { quiet = false } = {}) {
  const r = spawnSync("npx", ["wrangler", ...args], { cwd: REPO, shell: true, encoding: "utf8" });
  const out = ((r.stdout || "") + (r.stderr || "")).trim();
  if (!quiet && out) console.log(out.split("\n").map((l) => "        " + l).join("\n"));
  return { code: r.status === null ? 1 : r.status, out };
}
/* READS GO THROUGH --command, NOT --file. Given a file, wrangler uploads it and returns an
   execution SUMMARY ("Total queries executed", "Rows read") instead of the rows, so a SELECT
   run that way comes back looking successful and carrying no data. Writes still use --file
   because the seed is far too long for a command line. Found the first time verify ran. */
function query(sql) {
  const r = wrangler(["d1", "execute", DB, WHERE, "--json", "--command", JSON.stringify(sql)], { quiet: true });
  const i = r.out.indexOf("["), j = r.out.lastIndexOf("]");
  if (i < 0 || j < i) { fail("could not read a JSON result from wrangler:\n        " + r.out.split("\n").slice(0, 4).join("\n        ")); return null; }
  try { return JSON.parse(r.out.slice(i, j + 1)); }
  catch (e) { fail("wrangler returned unparseable JSON: " + e.message); return null; }
}
const q = (v) => v === null || v === undefined ? "NULL" : "'" + String(v).split("'").join("''") + "'";
const num = (v) => (typeof v === "number" && Number.isFinite(v)) ? String(v) : "NULL";
const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);

function loadLedger() {
  if (!existsSync(LEDGER)) {
    console.error("  ledger/ledger.json is not there. Run `node tools/ledger.mjs` first.");
    process.exit(2);
  }
  return JSON.parse(readFileSync(LEDGER, "utf8"));
}

/* ---- schema ------------------------------------------------------------------------- */
function applySchema() {
  console.log("\n1  SCHEMA");
  const r = wrangler(["d1", "execute", DB, WHERE, "--file=migrations/0001_ledger.sql"], { quiet: true });
  if (r.code !== 0) { fail("could not apply the schema:\n        " + r.out.split("\n").slice(-6).join("\n        ")); return false; }
  ok("migrations/0001_ledger.sql applied to " + DB + " (" + WHERE.replace("--", "") + ")");
  return true;
}

/* ---- seed --------------------------------------------------------------------------- */
function buildSeed(body) {
  const L = body.ledger;
  const out = ["DELETE FROM entry;", "DELETE FROM state;", "DELETE FROM snapshot;"];
  let rows = 0;
  for (const c of COLLECTIONS) {
    const arr = L[c];
    if (!Array.isArray(arr)) continue;
    arr.forEach((row, i) => {
      const doc = JSON.stringify(row);
      out.push(`INSERT INTO entry (collection,seq,hash,date,party,product,status,qty,total,doc) VALUES (`
        + [q(c), i, q(sha(doc)), q(row.date ?? null),
           q(row.customer ?? row.supplier ?? row.party ?? null),
           q(row.product ?? null), q(row.status ?? null),
           num(row.qty), num(row.total), q(doc)].join(",") + ");");
      rows++;
    });
  }
  for (const key of Object.keys(L)) {
    if (COLLECTIONS.includes(key)) continue;
    out.push(`INSERT INTO state (key,doc) VALUES (${q(key)},${q(JSON.stringify(L[key]))});`);
  }
  /* AN EMPTY COLLECTION IS STILL A FACT. selfUseLog and lostDemand are both empty today, so
     they produce no `entry` rows and, without this, disappear from the store entirely: a
     reader could not tell "no self-use has been recorded" from "this book has no notion of
     self-use". The names are written down so an empty list comes back as an empty list. */
  const present = COLLECTIONS.filter((c) => Array.isArray(L[c]));
  out.push(`INSERT INTO state (key,doc) VALUES ('__collections',${q(JSON.stringify(present))});`);
  const stamp = new Date().toISOString();
  out.push(`INSERT INTO snapshot (one,v,stamped,sha,rows,at) VALUES (1,${q(body.v)},${q(body.stamped)},`
    + `${q(sha(JSON.stringify(L)))},${rows},${q(stamp)});`);
  return { sql: out.join("\n"), rows };
}

function seed() {
  console.log("\n2  SEED");
  const body = loadLedger();
  const { sql, rows } = buildSeed(body);
  mkdirSync(resolve(REPO, "migrations"), { recursive: true });
  const file = resolve(REPO, "migrations", ".seed.generated.sql");
  writeFileSync(file, sql);
  const r = wrangler(["d1", "execute", DB, WHERE, "--file=migrations/.seed.generated.sql"], { quiet: true });
  if (r.code !== 0) { fail("the seed did not execute:\n        " + r.out.split("\n").slice(-8).join("\n        ")); return false; }
  ok(`seeded ${rows} record rows and ${Object.keys(body.ledger).length - COLLECTIONS.filter(c => Array.isArray(body.ledger[c])).length} state keys from ${body.v}`);
  return true;
}

/* ---- verify -------------------------------------------------------------------------- */
/* THE POINT OF THE FILE. Everything above is plumbing; this is the part that decides whether
   the store can be believed. It reads the whole book back out of D1 and compares it, key by
   key and row by row, against the JSON that went in. A store that quietly rounds a number or
   drops a nested array would otherwise look perfectly healthy. */
function verify() {
  console.log("\n3  VERIFY");
  const body = loadLedger();
  const L = body.ledger;

  const rows = query("SELECT collection,seq,doc FROM entry ORDER BY collection,seq;");
  const states = query("SELECT key,doc FROM state ORDER BY key;");
  if (!rows || !states) return false;

  const back = {};
  const flat = (res) => res.flatMap((r) => r.results || []);
  for (const r of flat(rows)) (back[r.collection] = back[r.collection] || [])[r.seq] = JSON.parse(r.doc);
  for (const r of flat(states)) back[r.key] = JSON.parse(r.doc);
  /* materialise the collections that seeded no rows, then drop the bookkeeping key so it is
     not reported as something the store invented */
  for (const c of (back.__collections || [])) if (!(c in back)) back[c] = [];
  delete back.__collections;

  const missing = Object.keys(L).filter((k) => !(k in back));
  const extra = Object.keys(back).filter((k) => !(k in L));
  if (missing.length) fail("came back missing: " + missing.join(", "));
  if (extra.length) fail("came back carrying keys that never went in: " + extra.join(", "));

  let bad = 0, checked = 0;
  for (const key of Object.keys(L)) {
    if (!(key in back)) continue;
    checked++;
    const a = JSON.stringify(L[key]), b = JSON.stringify(back[key]);
    if (a !== b) {
      bad++;
      if (bad <= 3) {
        const i = [...a].findIndex((ch, n) => ch !== b[n]);
        fail(`${key} came back different at character ${i}:\n        in : ${a.slice(Math.max(0, i - 40), i + 40)}\n        out: ${b.slice(Math.max(0, i - 40), i + 40)}`);
      }
    }
  }
  if (!bad && !missing.length && !extra.length) {
    const recs = Object.keys(L).filter((k) => Array.isArray(L[k])).reduce((a, k) => a + L[k].length, 0);
    ok(`every one of ${checked} keys came back byte for byte, ${recs} records included`);
  } else if (bad) fail(`${bad} of ${checked} keys came back different`);
  return !problems.length;
}

/* ---- prove ---------------------------------------------------------------------------
   THE GATE THAT DECIDES WHEN THE DIRECTION CAN FLIP, and it is a stronger claim than
   --verify makes. --verify compares the store against ledger/ledger.json, which proves the
   store did not mangle the file it was given. This compares the store against THE DESK
   ITSELF, read live out of its own runtime, which closes the whole loop:

       master -> extract -> D1 -> read back -> master

   Why data equality is the right proof and not a weaker stand-in for comparing figures: the
   desk's figures are computed by one engine from this data alone. Same pure function, same
   input, same output. So if every ledger value in the store is identical to every ledger
   value in the desk, the desk cannot compute a different figure from one than the other.
   Comparing rendered figures instead would prove less and break on the clock.

   A FAILURE HERE IS NOT ALWAYS A FAULT. If the desk has moved since the seed, this says so,
   which is exactly what a mirror ought to tell you. It reports the two versions so the
   difference between "stale" and "wrong" is never left to be guessed at. */
async function prove() {
  console.log("\nPROVE: the store against the desk itself");
  const body = existsSync(LEDGER) ? loadLedger() : null;
  const book = await readBook();
  const { dom, ledger, version, stamped, missing } = book;
  try {
    if (missing.length) { fail("these could not be read from the desk: " + missing.join(", ")); return false; }

    const rows = query("SELECT collection,seq,doc FROM entry ORDER BY collection,seq;");
    const states = query("SELECT key,doc FROM state ORDER BY key;");
    const snap = query("SELECT v,stamped FROM snapshot WHERE one=1;");
    if (!rows || !states) return false;
    const flat = (res) => res.flatMap((r) => r.results || []);
    const s = snap && flat(snap)[0];

    if (s && s.v !== version) {
      fail(`the store is a mirror of ${s.v} and the desk is now ${version}. `
        + `That is STALE, not wrong: re-seed with --seed and run this again.`);
    } else if (s) {
      ok(`the store and the desk are both ${version}, stamped ${stamped}`);
    }

    const back = {};
    for (const r of flat(rows)) (back[r.collection] = back[r.collection] || [])[r.seq] = JSON.parse(r.doc);
    for (const r of flat(states)) back[r.key] = JSON.parse(r.doc);
    for (const c of (back.__collections || [])) if (!(c in back)) back[c] = [];
    delete back.__collections;

    let bad = 0, checked = 0, records = 0;
    for (const key of Object.keys(ledger)) {
      checked++;
      if (Array.isArray(ledger[key])) records += ledger[key].length;
      const a = JSON.stringify(ledger[key]), b = JSON.stringify(back[key]);
      if (a === b) continue;
      bad++;
      if (bad <= 3) {
        const i = [...a].findIndex((ch, n) => ch !== (b || "")[n]);
        fail(`${key} differs from the desk at character ${i}:\n        desk : ${a.slice(Math.max(0, i - 40), i + 40)}\n        store: ${(b || "(absent)").slice(Math.max(0, i - 40), i + 40)}`);
      }
    }
    const extra = Object.keys(back).filter((k) => !(k in ledger));
    if (extra.length) fail("the store carries keys the desk does not: " + extra.join(", "));
    if (!bad && !extra.length) ok(`all ${checked} ledger values match the desk exactly, ${records} records included`);
    else if (bad) fail(`${bad} of ${checked} values differ from the desk`);

    /* SALT LEADS, and it is checked here because this is the file that will one day serve
       the figures. Standing instruction: salt before oil wherever the two appear apart. */
    const order = ledger.PROD_ORDER;
    if (!Array.isArray(order) || order[0] !== "salt") fail(`PROD_ORDER leads with ${JSON.stringify(order && order[0])}, not salt`);
    else ok("PROD_ORDER leads with salt");
    for (const key of ["PRODUCTS", "PROD_OPENING"]) {
      const k = Object.keys(ledger[key] || {});
      if (k.length > 1 && k.slice().sort(bySalt).join() !== k.join()) fail(`${key} is not in salt-first order: ${k.join(", ")}`);
    }
    if (body && body.ledger && JSON.stringify(body.ledger.PROD_ORDER) !== JSON.stringify(PROD_ORDER)) {
      fail("the desk's PROD_ORDER and the tools' own no longer agree");
    }
    return !problems.length;
  } finally { dom.window.close(); }
}

function status() {
  console.log("\nSTORE");
  const snap = query("SELECT v,stamped,sha,rows,at FROM snapshot WHERE one=1;");
  const counts = query("SELECT collection, COUNT(*) n FROM entry GROUP BY collection ORDER BY collection;");
  const s = snap && (snap.flatMap((r) => r.results || [])[0]);
  if (!s) { console.log("  the store is empty. Run --schema then --seed."); return; }
  console.log(`  snapshot of ${s.v}, stamped ${s.stamped}`);
  console.log(`  ${s.rows} records, sha ${s.sha}, seeded ${s.at}`);
  for (const c of (counts || []).flatMap((r) => r.results || [])) console.log(`    ${String(c.collection).padEnd(18)} ${c.n}`);
}

/* ---- run ----------------------------------------------------------------------------- */
const arg = process.argv[2];
if (arg === "--status") status();
else if (arg === "--schema") applySchema();
else if (arg === "--verify") verify();
else if (arg === "--prove") await prove();
else if (arg === "--seed") { if (applySchema() && seed()) verify(); }
else { console.log("usage: node tools/d1.mjs --schema | --seed | --verify | --prove | --status  [--local]"); process.exit(2); }

console.log("");
if (problems.length) { console.log(`D1 INCOMPLETE: ${problems.length} problem${problems.length === 1 ? "" : "s"} above.`); process.exitCode = 1; }
else if (arg !== "--status") console.log("D1 OK: the book is in the store and came back unchanged.");
