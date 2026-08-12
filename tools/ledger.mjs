/* ledger.mjs — get the ledger out of the master, completely and provably.
 *
 * THE FIRST STEP TOWARD ONE SOURCE OF TRUTH, and the only one that has to be right before
 * any of the others can be attempted. Today the book is DATA BAKED INTO A CODE ARTEFACT:
 * `const sales=[...]` inside a 935 KB HTML file. That single fact forces everything else.
 * A transaction needs a rebuild and a redeploy; a queue is needed to carry entries between
 * rebuilds; a watermark is needed to stop the queue replaying; and the watermark is a
 * constant a human has to remember to move, which is how v287 double-counted three orders.
 *
 * Move the ledger into a store and the queue, the watermark, the drain and the fold all
 * stop being necessary. But nothing may be moved until it can be got out INTACT, so this
 * file does exactly one job and refuses to guess:
 *
 *   1  READ the declarations out of the desk's own runtime, not by parsing text. The master
 *      is run in jsdom and the values are read from the global scope, so what is extracted
 *      is what the engine actually sees.
 *   2  PROVE the extract is complete. Every top-level declaration is discovered from the
 *      source and classified. An unclassified declaration that is DATA-SHAPED fails the run,
 *      so a new array added to the master can never be silently left behind.
 *   3  PROVE the extract is faithful. JSON cannot hold a function, undefined, NaN, Infinity
 *      or a Date, and a ledger row that carried one would lose it on the way to a database
 *      without a word. Every value is walked and any hazard is reported by path.
 *   4  CENSUS the shape, so the schema that comes next is derived from the rows that exist
 *      rather than guessed from the ones I remember.
 *
 * It writes `ledger/ledger.json` and `ledger/schema.json` and changes NOTHING else. The
 * master remains the source of truth until the store is proven; this is a photograph.
 *
 * Usage:
 *   node tools/ledger.mjs            extract, verify, write, report
 *   node tools/ledger.mjs --check    verify only, write nothing (exit non-zero on a fault)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { openMaster } from "./payload.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const OUT_DIR = resolve(REPO, "ledger");
const DEFAULT_MASTER =
  "C:/Users/maakm/Claude/Projects/Personal/Cow-Crm01_Salt Business/01_Dashboard/salt_command.html";
const MASTER = process.env.SALT_MASTER || DEFAULT_MASTER;
const CHECK = process.argv.includes("--check");

/* WHAT THE LEDGER IS, and WHICH COPY OF IT TO TAKE.
 *
 * THE COMMITTED BOOK IS `BASE_*`, NOT `sales`. The desk keeps two copies of the moving
 * parts: `BASE_SALES` and friends are deep copies taken at load, and `sales` is that copy
 * with the uncommitted queue folded over it by applyOverlay(). They are equal only while
 * the queue is empty. Extracting `sales` would therefore write PROVISIONAL rows into the
 * store as though they were committed, the moment anything is queued, and the store would
 * then disagree with the master about what has actually happened. So every overlaid array
 * is read from its BASE copy, and the mapping is written out rather than implied.
 *
 * Left of the arrow is the name in the store; right is the declaration to read. */
const LEDGER = {
  PRODUCTS: "PRODUCTS", PROD_ORDER: "PROD_ORDER",
  opening: "opening", PROD_OPENING: "PROD_OPENING", STATED_STOCK: "STATED_STOCK",
  purchases: "BASE_PURCHASES",     // overlaid: committed copy
  sales: "BASE_SALES",             // overlaid: committed copy
  contacts: "BASE_CONTACTS",       // overlaid: committed copy
  selfUseLog: "BASE_SELFUSE",      // overlaid: committed copy
  lostDemand: "BASE_LOST",         // overlaid: committed copy
  loans: "loans",
  supplierReceivable: "supplierReceivable",
  customerRefunds: "customerRefunds",
  roster: "roster", associates: "associates", PEOPLE: "PEOPLE",
  REWARD_OPENING: "REWARD_OPENING", CUSTOMER_REWARD_OPENING: "CUSTOMER_REWARD_OPENING",
  AWARDS: "AWARDS",
  supplierQuote: "supplierQuote", oilQuote: "oilQuote",
  SOURCING_PLAN: "SOURCING_PLAN",
  CASH_COUNT_RETIRED: "CASH_COUNT_RETIRED",
  ONE_OFFS: "ONE_OFFS",
  QUEUE_COMMITTED: "QUEUE_COMMITTED",
};
const LEDGER_KEYS = Object.keys(LEDGER);
/* Version metadata. It travels with the extract so a stored ledger can say which desk it
   came from, but it is NOT ledger and must never be treated as a figure. */
const META_KEYS = ["LAST_UPDATED", "evolution"];

/* Declarations that are data-shaped but are CONFIGURATION, not the book: pricing ladders,
   thresholds, vocabulary. They are listed rather than pattern-matched so that adding one
   is a decision somebody made, not something a regex allowed through. */
const NOT_LEDGER = new Set([
  /* THE BOUNDARY, stated once so it can be applied rather than re-argued: the LEDGER is
     what happened and what is held (trades, counts, balances, parties and their state,
     refunds, awards, quotes received, plans stated). CONFIGURATION is the rules and the
     presentation (how a price is computed, what a band is called, which days are holidays).
     A rule can be rewritten from the code; a fact cannot be rewritten from anywhere. */

  /* pricing, cost and reward MODEL: rules, not facts */
  "PRICE", "PRICE_ENGINE", "PRICE_TIERS", "PRICE_MODEL", "PRICE_LOCK", "PXBANDS", "PX",
  "REF", "REF_POINTS", "BAND_LABEL", "BAND_NAME", "COST_BASIS", "COST_BOOK", "SALES_POLICY",
  "RULES", "SHRINK", "R0_NETWORK", "REBATE", "REWARD", "FWD", "PROD_STOCK_COST", "PROD_IDS",
  "TIERS", "SIZES", "PRICES", "BANDS", "HURDLES", "REWARDS", "CADENCE", "THRESHOLDS",

  /* vocabulary, labels and taxonomy: presentation */
  "LOSS_LABEL", "LOST_LABEL", "CONTACT_HOW", "CONTACT_OUT", "TAB_LABEL", "OBS_FAM", "OBS_SEV",
  "OBS_CONF", "ACTSEV", "bSevTag", "WB_NO_PROD", "PLAN_ST", "CHART_INK", "DIAMOND",
  "LOCS", "PLACES", "METRO", "NON_PLACE", "DOW", "DOW3", "KL_HOLIDAYS", "HOL_MAP",
  "LEAK_TEST", "BIO_FIELDS", "PROD_META", "builders",

  /* transient UI state, not persisted anywhere */
  "ledF", "concSort", "mnOver", "pxOver",

  /* QUOTES IS AN ACCESSOR, NOT DATA, and the JSON check is what proved it: both its keys
     hold FUNCTIONS over supplierQuote and oilQuote, which are extracted in their own right.
     Stored, it would have arrived as `{"salt":null,"oil":null}` with nothing to say a
     lookup had been lost. This is the single best argument for checking fidelity by walking
     the values rather than trusting that a book of records is made of records. */
  "QUOTES",
]);

const isObj = (v) => v !== null && typeof v === "object";
const tag = (v) => Object.prototype.toString.call(v);

/* JSON HAZARDS. The values JSON silently drops or mangles. A ledger row carrying one of
   these would arrive in a database subtly wrong and nothing would say so. */
function hazards(value, path = "", out = []) {
  const t = typeof value;
  if (t === "function") out.push(`${path}: function`);
  else if (t === "undefined") out.push(`${path}: undefined`);
  else if (t === "symbol") out.push(`${path}: symbol`);
  else if (t === "bigint") out.push(`${path}: bigint`);
  else if (t === "number" && !Number.isFinite(value)) out.push(`${path}: ${String(value)}`);
  else if (isObj(value)) {
    if (tag(value) === "[object Date]") out.push(`${path}: Date`);
    else if (Array.isArray(value)) value.forEach((v, i) => hazards(v, `${path}[${i}]`, out));
    else for (const k of Object.keys(value)) hazards(value[k], path ? `${path}.${k}` : k, out);
  }
  return out;
}

/* A FIELD CENSUS, so the schema is derived from the rows rather than remembered. Reports
   every key that appears on any row, how many rows carry it, and the types it takes. */
function census(rows) {
  const fields = {};
  for (const row of rows) {
    if (!isObj(row)) continue;
    for (const k of Object.keys(row)) {
      const v = row[k];
      const ty = v === null ? "null" : Array.isArray(v) ? "array" : typeof v;
      const f = fields[k] || (fields[k] = { present: 0, types: [] });
      f.present++;
      if (!f.types.includes(ty)) f.types.push(ty);
    }
  }
  const total = rows.length;
  const out = {};
  for (const k of Object.keys(fields).sort()) {
    out[k] = {
      present: fields[k].present,
      of: total,
      optional: fields[k].present !== total,
      types: fields[k].types.sort(),
    };
  }
  return out;
}

/* ------------------------------------------------------------------------------------ */
const problems = [];
const fail = (m) => { problems.push(m); console.log("  FAIL  " + m); };
const ok = (m) => console.log("  ok    " + m);

console.log("\nLEDGER EXTRACT" + (CHECK ? " (check only)" : ""));
if (!existsSync(MASTER)) { console.error("  the master is not readable at\n    " + MASTER); process.exit(2); }

const src = readFileSync(MASTER, "utf8");
const { dom, w } = await openMaster(MASTER);

/* Read a global by name. The desk's data is declared with `const` at the top level of a
   classic script, so it lives in the global LEXICAL environment and is not a property of
   window; `window.eval` reaches it, a property lookup does not. */
function read(name) {
  try {
    const v = w.eval(name);
    return { ok: true, value: v };
  } catch (e) {
    if (name in w) return { ok: true, value: w[name] };
    return { ok: false, why: String(e && e.message || e) };
  }
}

/* ---- 1. read the ledger ------------------------------------------------------------- */
const ledger = {};
for (const key of LEDGER_KEYS) {
  const from = LEDGER[key];
  const r = read(from);
  if (!r.ok) { fail(`${key} could not be read from the master as ${from} (${r.why})`); continue; }
  if (typeof r.value === "undefined") { fail(`${key} is undefined in the master (read as ${from})`); continue; }
  ledger[key] = r.value;
}
/* THE OVERLAY MUST BE OFF. If the committed copy and the live array differ, something is
   queued, and that is the exact condition under which reading the wrong one would corrupt
   the store. Say so, and say which, rather than shipping a quiet provisional row. */
for (const [key, from] of Object.entries(LEDGER)) {
  if (!from.startsWith("BASE_")) continue;
  const live = read(key === "selfUseLog" ? "selfUseLog" : key);
  if (!live.ok || !Array.isArray(live.value) || !Array.isArray(ledger[key])) continue;
  if (live.value.length !== ledger[key].length) {
    ok(`${key}: taking the COMMITTED ${ledger[key].length} rows, not the ${live.value.length} the overlay shows`);
  }
}
const meta = {};
for (const key of META_KEYS) {
  const r = read(key);
  if (r.ok && typeof r.value !== "undefined") meta[key] = r.value;
}
if (Object.keys(ledger).length === LEDGER_KEYS.length) ok(`read all ${LEDGER_KEYS.length} ledger declarations from the desk's own runtime`);

/* ---- 2. prove it is complete -------------------------------------------------------- */
/* `let` AND `var` COUNT. Scanning only `const` is how selfUseLog and lostDemand were missed
   on the first run: both are ledger arrays, both are reassigned by applyOverlay, and both
   were therefore invisible to a const-only sweep. There is no size threshold either, for
   the same reason: a book with two self-use rows is still the book. */
const declared = [...src.matchAll(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/gm)].map((m) => m[1]);
const uniqueDeclared = [...new Set(declared)];
const classified = new Set([...LEDGER_KEYS, ...Object.values(LEDGER), ...META_KEYS, ...NOT_LEDGER]);
const unclassifiedData = [];
for (const name of uniqueDeclared) {
  if (classified.has(name)) continue;
  const r = read(name);
  if (!r.ok || !isObj(r.value)) continue;
  if (tag(r.value) !== "[object Object]" && !Array.isArray(r.value)) continue;   // DOM nodes and the like
  const v = r.value;
  if (Array.isArray(v) ? v.length === 0 : Object.keys(v).length === 0) continue;  // empty scratch
  unclassifiedData.push({ name, kind: Array.isArray(v) ? `array[${v.length}]` : `object{${Object.keys(v).length}}` });
}
if (unclassifiedData.length) {
  fail(`${unclassifiedData.length} data-shaped declaration(s) are neither ledger nor listed as configuration:`);
  unclassifiedData.forEach((u) => console.log(`          ${u.name}  ${u.kind}`));
  console.log("        Add each to LEDGER_KEYS if it is part of the book, or to NOT_LEDGER if it is not.");
  console.log("        Refusing to call the extract complete while one is unaccounted for.");
} else {
  ok(`every data-shaped declaration is accounted for (${uniqueDeclared.length} top-level consts scanned)`);
}

/* ---- 3. prove it is faithful -------------------------------------------------------- */
const haz = hazards(ledger);
if (haz.length) {
  fail(`${haz.length} value(s) cannot survive JSON and would be lost on the way to a store:`);
  haz.slice(0, 12).forEach((h) => console.log("          " + h));
  if (haz.length > 12) console.log(`          ... and ${haz.length - 12} more`);
} else {
  ok("every value survives JSON: no function, undefined, NaN, Infinity or Date anywhere");
}

/* Round-trip, which is the check that matters once the hazards are clear. */
let roundTripped = null;
try {
  roundTripped = JSON.parse(JSON.stringify(ledger));
  const a = JSON.stringify(ledger), b = JSON.stringify(roundTripped);
  if (a === b) ok("the extract round-trips through JSON unchanged");
  else fail("the extract does NOT round-trip through JSON unchanged");
} catch (e) {
  fail("the extract cannot be serialised: " + (e && e.message));
}

/* ---- 4. census the shape ------------------------------------------------------------ */
const schema = {};
for (const key of ["sales", "purchases", "loans", "contacts"]) {
  if (Array.isArray(ledger[key])) schema[key] = { rows: ledger[key].length, fields: census(ledger[key]) };
}

/* ---- 5. prove it carries no names ----------------------------------------------------
   THIS FILE GETS COMMITTED, and hard rule 3 of this repo is that no real name may ever be.
   The ledger is keyed by code, so it should be clean by construction, but a NOTE is free
   prose and a name could have been typed into one at any point in eighty rows. So it is
   checked rather than assumed, against the actual directory on this machine: every name and
   place in salt_bio.json is searched for as a whole word. The directory is gitignored and
   never leaves the laptop, which is exactly why it is the right thing to check against. */
const BIO = resolve(dirname(MASTER), "..", "06_Data", "salt_bio.json");
if (existsSync(BIO)) {
  let names = [], bioCodes = {};
  try {
    const bio = JSON.parse(readFileSync(BIO, "utf8")).bio || {};
    bioCodes = bio;
    for (const code of Object.keys(bio)) {
      const raw = String((bio[code] || {}).raw || "");
      const m = /^([^(]+?)\s*(?:\(([^)]+)\))?$/.exec(raw.trim());
      if (m) { if (m[1]) names.push(m[1].trim()); if (m[2]) names.push(m[2].trim()); }
    }
  } catch (e) { fail("salt_bio.json could not be read, so the name check did not run"); }
  names = [...new Set(names.filter((n) => n.length >= 3))];
  /* THE CODES COME OUT FIRST. A party code embeds its own place abbreviation by design, so
     CH6-TBC contains "TBC" and CS6-BS contains "BS". Searching the raw text therefore reports
     every code as a leak, which is the fastest way to teach someone to ignore this check.
     Remove every known code, then look at what is left. */
  let hay = JSON.stringify(ledger);
  const codes = [...new Set([...(ledger.roster || []), ...Object.keys(bioCodes)])]
    .sort((a, b) => b.length - a.length);
  for (const c of codes) hay = hay.split(c).join("~");
  const hits = [];
  for (const n of names) {
    const re = new RegExp("\\b" + n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");
    const m = re.exec(hay);
    if (!m) continue;
    const at = Math.max(0, m.index - 45);
    hits.push({ masked: n[0] + "*".repeat(n.length - 1), len: n.length,
      near: hay.slice(at, m.index + n.length + 45).split(n).join("***") });
  }
  if (hits.length) {
    fail(`the extract carries ${hits.length} real name(s) or place(s) from the directory. It must not be committed.`);
    hits.forEach((h) => { console.log(`          ${h.masked} (${h.len} chars) near: ...${h.near}...`); });
  } else ok(`no real name or place from the directory appears in the extract (${names.length} checked, ${codes.length} codes excluded)`);
} else {
  console.log("  note  salt_bio.json is not on this machine, so the name check did not run");
}

/* ---- write --------------------------------------------------------------------------- */
const stamp = meta.LAST_UPDATED || null;
const version = (Array.isArray(meta.evolution) && meta.evolution[0] && meta.evolution[0].v) || null;
const body = { v: version, stamped: stamp, source: "Cow-Crm01 salt_command.html", ledger: roundTripped || ledger };
const json = JSON.stringify(body, null, 1);
const hash = createHash("sha256").update(json).digest("hex").slice(0, 16);

if (!CHECK && !problems.length) {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(resolve(OUT_DIR, "ledger.json"), json + "\n");
  writeFileSync(resolve(OUT_DIR, "schema.json"), JSON.stringify({ v: version, derivedFrom: hash, tables: schema }, null, 2) + "\n");
  ok(`wrote ledger/ledger.json  (${(Buffer.byteLength(json) / 1024).toFixed(1)} KB, sha ${hash})`);
  ok("wrote ledger/schema.json");
}

/* ---- report -------------------------------------------------------------------------- */
console.log("");
console.log(`  desk ${version || "(unknown)"}, stamped ${stamp || "(none)"}`);
for (const key of LEDGER_KEYS) {
  const v = ledger[key];
  const shape = Array.isArray(v) ? `${v.length} rows`
    : isObj(v) ? `${Object.keys(v).length} keys`
      : JSON.stringify(v);
  console.log(`    ${key.padEnd(20)} ${shape}`);
}
if (schema.sales) {
  console.log("");
  console.log(`  sales: ${schema.sales.rows} rows, ${Object.keys(schema.sales.fields).length} distinct fields`);
  const req = Object.entries(schema.sales.fields).filter(([, f]) => !f.optional).map(([k]) => k);
  console.log(`    on every row: ${req.length ? req.join(", ") : "(none)"}`);
}

dom.window.close();
console.log("");
if (problems.length) {
  console.log(`LEDGER EXTRACT INCOMPLETE: ${problems.length} problem${problems.length === 1 ? "" : "s"} above. Nothing was written.`);
  process.exitCode = 1;
} else {
  console.log(`LEDGER EXTRACT OK: the book is fully expressible as JSON and nothing was left behind.`);
}
