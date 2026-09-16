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
import { LEDGER, LEDGER_KEYS, META_KEYS, reader, pricingSnapshot, openSnapshot, NAME_STOPWORDS, NAME_COLLISIONS, DATA_DIR, areaNameSet, publishedLocalities } from "./book.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const OUT_DIR = resolve(REPO, "ledger");
const DEFAULT_MASTER =
  resolve(REPO, "master", "salt_command.html");
const MASTER = process.env.SALT_MASTER || DEFAULT_MASTER;
const CHECK = process.argv.includes("--check");

/* WHAT THE LEDGER IS and WHICH COPY TO TAKE now live in book.mjs, because d1.mjs needs
   the same answers and two copies of "which declarations are the book" would be two
   things to keep true, with the one that drifted doing so in silence. */
/* Version metadata travels with the extract but is NOT ledger; see book.mjs. */

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
  "PRICE", "PRICE_ENGINE", "PRICING_ENGINE", "POSITION_ENGINE" /* v337, v338: the engine modules inlined by tools/engine.mjs; functions, no data */,
  "QR_ENGINE" /* v564: the third inlined module, engine/qr.mjs. Functions and the format's own
     constant tables; a QR is drawn from an address, and the address is not held here. */,
  "PB_A4" /* v564: the page size the board sheet's PDF is written onto, in points. A measurement of
     paper, not of anything that happened. */,
  "VIEWS", "VIEW_OF", "PART_Q", "PART_DRAW", "VIEW_PART" /* v341: the seven views over the tabs; navigation, not the book */,
  "EDFORM" /* v363: the row editor's form spec. Labels, control kinds and hints for the thirty
     editable attributes: presentation of the book, never the book. It is data-shaped because a
     table beats thirty hand-written fields that would drift, which is the same reason VIEWS is
     data-shaped and equally not a fact about any trade. */, "PRICE_TIERS", "PRICE_MODEL", "PRICE_LOCK", "PXBANDS", "PX",
  "REF", "REF_POINTS", "LADDER", "LADDER_BY" /* round 5: the per-book ladder anchors; a rule, like LADDER itself */,
  "TIER_RULE", "TIER_NAMES" /* v641, v642: the tiers' rule per book and the levels' names; a rule and its presentation, like LADDER */,
  "PROFILE_RULE" /* v666: the thresholds a customer's profile is read against; a rule, not a record, like TIER_RULE */,
  "BAND_LABEL", "BAND_NAME", "COST_BASIS", "COST_BOOK", "SALES_POLICY",
  "RULES", "SHRINK", "R0_NETWORK", "REBATE", "REWARD", "FWD", "PROD_STOCK_COST", "PROD_IDS",
  "TIERS", "SIZES", "PRICES", "BANDS", "HURDLES", "REWARDS", "CADENCE", "THRESHOLDS",

  /* vocabulary, labels and taxonomy: presentation */
  "ADDID_KIND_LABEL" /* v365: the Add ID kind dropdown's own wording, reused so the preview and
     the queued line read what the dropdown says rather than the raw select value. */,
  "LOSS_LABEL", "LOST_LABEL", "CONTACT_HOW", "CONTACT_OUT", "TAB_LABEL", "OBS_FAM", "OBS_SEV",
  "ORD_WORD" /* v499: the Orders card's state words; the orders themselves live on the statements site */,
  "OBS_CONF", "ACTSEV", "bSevTag", "WB_NO_PROD", "CHART_INK", "DIAMOND",
  "LOCS", "PLACES", "METRO", "NON_PLACE", "PLACEHOLDER", "BASEMAP", "BASEMAP_META", "DOW", "DOW3", "KL_HOLIDAYS", "HOL_MAP",
  "AREAS", "AREAS_META", "DISTRICTS", "MAPC" /* v630: the areas the map shades, and its steps; geography, not trade */,
  "GAZ", "GAZ_META" /* v633: the hashed place list; geography, not trade */, "WB_GEO" /* v633: the place being typed on the Enter form */,
  "MAP_METRICS" /* v635: the names of what the map can shade by */, "PLACE_WORDS" /* v680: short forms spelled out in a locality */, "PLACE_LIST" /* v682: the locations to choose from */, "MAP_MON" /* v636: month names for the map's period */,
  "LEAK_TEST", "BIO_FIELDS", "PROD_META", "builders",

  /* transient UI state, not persisted anywhere */
  "ledF", "ledSort", "jrnF", "concSort", "mnOver", "pxOver",

  /* v359: A MEMOISATION CACHE, NOT A FACT. _wavgMemo holds wavgFor()'s answer per product for
     the life of one page load, so a second call in the same run does not re-walk every
     purchase. It stayed invisible here for as long as nothing in the extract path happened to
     call wavgFor(): an empty object is treated as scratch and skipped, and a batch large or
     varied enough is what makes that call fire for the first time. Computed from purchases on
     demand, never stored, never read back; the next load starts it empty again. */
  "_wavgMemo",

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

const read = reader(w);

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

/* THE PRICING SNAPSHOT, taken after every declaration above has been read. It is DERIVED
   rather than declared, which is why it is not in LEDGER_KEYS: nothing in the master is named
   PRICING, and the completeness sweep above would rightly refuse to find it. It exists so the
   cloud drafter reads the desk's own cost and floors instead of recomputing them. See the
   long note in book.mjs. Taken last because it moves PROD while it runs. */
ledger.PRICING = { ...pricingSnapshot(w), v: (Array.isArray(meta.evolution) && meta.evolution[0] && meta.evolution[0].v) || null };
/* The open orders as the desk sees them, for the drafter to describe an amendment against.
   Derived like PRICING and for the same reason: three attempts at this arithmetic in a
   Worker were wrong on real rows before it was moved here. */
ledger.OPEN = { ...openSnapshot(w), v: (Array.isArray(meta.evolution) && meta.evolution[0] && meta.evolution[0].v) || null };
{
  const P = ledger.PRICING, salt = P.byProduct && P.byProduct.salt;
  if (!salt || salt.stockCost == null || !salt.floors) fail("the pricing snapshot came back without a salt cost or floors; the drafter cannot price a row without it");
  else ok(`pricing snapshot taken: salt at ${salt.stockCost}/unit, floor at 1 unit ${salt.floors["1"] && salt.floors["1"].floor}, ${Object.keys(P.byProduct).length} product(s)`);
}

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
/* THE DIRECTORY IS IN THE PROJECT FOLDER, NOT THE REPO (corrected 12 Sep 2026). This resolved
   the bio relative to the master, which worked while the master lived beside it and has been
   wrong since the master moved into this repo on 20 Aug 2026: the path pointed at
   <repo>/10_Data, nothing was there, and the gate reported "not on this machine" and passed on
   every run for three weeks. Hard rule 2 keeps salt_bio.json in the project folder deliberately,
   and DATA_DIR is the one place that knows where that is. */
const BIO = resolve(DATA_DIR, "salt_bio.json");
if (existsSync(BIO)) {
  let names = [], places = [], bioCodes = {};
  try {
    const bio = JSON.parse(readFileSync(BIO, "utf8")).bio || {};
    bioCodes = bio;
    for (const code of Object.keys(bio)) {
      const raw = String((bio[code] || {}).raw || "");
      const m = /^([^(]+?)\s*(?:\(([^)]+)\))?$/.exec(raw.trim());
      if (m) { if (m[1]) names.push(m[1].trim()); if (m[2]) places.push(m[2].trim()); }
    }
  } catch (e) { fail("salt_bio.json could not be read, so the name check did not run"); }
  /* "TBC" IS NOT A PLACE. Two parties carry it in the directory as an admission that the
     location was never known, and the desk says so in its own notes. Treating it as a name
     makes the gate cry wolf on the one row that is honest about not having one. */
  /* "GENERAL" JOINS THEM, and the case is worth writing down because the gate failed closed
     on it. A downstream buyer in the directory carries the name "General", which is what the
     desk calls an unnamed downsell buyer rather than anybody's name. The scan is
     case-insensitive, so from then on every ordinary use of the word tripped it: the note
     reading "to a general downsell buyer" was reported as a leaked name, on the very row
     explaining that there is no name to leak. A gate that cries wolf on its own vocabulary
     is a gate people learn to wave through, which is worse than not having one.
     THE ENTRY ITSELF IS THE REAL ODDITY and it is left alone deliberately: by the v199 rule a
     buyer with no name takes a `-Gen` bucket and NO directory entry at all, so this one is
     probably a placeholder somebody typed. Renaming a party is his call, not this tool's. */
  /* v680: a place filed as a party's locality is public by his decision of 17 Sep 2026; places only, a name is never exempted */
  const localities = publishedLocalities(ledger);
  names = names.concat(places.filter((n) => !localities.has(n.toLowerCase())));
  const PLACEHOLDER = NAME_STOPWORDS;   // one definition, in book.mjs
  /* Names that collide with the desk's own vocabulary are skipped and SAID SO. See book.mjs. */
  const collided = [...new Set(names.filter((n) => NAME_COLLISIONS.has(n.toLowerCase())))];
  /* v630, HIS DECISION OF 14 SEP 2026: AREA NAMES SHOW ON THE MAP. A directory place that IS an official district, mukim,
     bandar or pekan name is public geography and is not searched for; one that merely contains an area name still is.
     Counted and said on every run, like the collisions below. */
  const areaWords = areaNameSet(JSON.parse(readFileSync(resolve(REPO, "geo", "areas.json"), "utf8")));
  const asArea = [...new Set(names.filter((n) => areaWords.has(n.toLowerCase())))];
  names = [...new Set(names.filter((n) => n.length >= 3 && !PLACEHOLDER.has(n.toLowerCase()) && !NAME_COLLISIONS.has(n.toLowerCase()) && !areaWords.has(n.toLowerCase())))];
  /* THE CODES COME OUT FIRST. A party code embeds its own place abbreviation by design, so
     CH6-TBC contains "TBC" and CS6-BS contains "BS". Searching the raw text therefore reports
     every code as a leak, which is the fastest way to teach someone to ignore this check.
     Remove every known code, then look at what is left. */
  const codes = [...new Set([...(ledger.roster || []), ...Object.keys(bioCodes)])]
    .sort((a, b) => b.length - a.length);
  const strip = (t) => { for (const c of codes) t = t.split(c).join("~"); return t; };
  /* AND THE MASTER IS SCANNED BESIDE THE EXTRACT (12 Sep 2026). This read the extract alone,
     so it saw row NOTEs and nothing else. A supplier's name in a script comment and two places
     in Journal version notes therefore sat on the PUBLIC desk for months: the one instrument
     against hard rule 3 was pointed at the one file that never carried them. The master is what
     the desk is built from, so it is the thing that has to be clean. */
  const SOURCES = [
    { what: "the extract", hay: strip(JSON.stringify(ledger)) },
    { what: "the master", hay: strip(readFileSync(MASTER, "utf8")) },
  ];
  for (const src of SOURCES) {
    const hits = [];
    for (const n of names) {
      const re = new RegExp("\\b" + n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");
      const m = re.exec(src.hay);
      if (!m) continue;
      const at = Math.max(0, m.index - 45);
      hits.push({ masked: n[0] + "*".repeat(n.length - 1), len: n.length,
        near: src.hay.slice(at, m.index + n.length + 45).split(n).join("***") });
    }
    if (hits.length) {
      fail(`${src.what} carries ${hits.length} real name(s) or place(s) from the directory. It must not be committed.`);
      hits.forEach((h) => { console.log(`          ${h.masked} (${h.len} chars) near: ...${h.near}...`); });
    } else ok(`no real name or place from the directory appears in ${src.what} (${names.length} checked, ${codes.length} codes excluded)`);
  }
  /* Said on every run, pass or fail. A skipped name is a party this gate is NOT checking for,
     and that has to be visible or a pass reads as more than it is. */
  if (asArea.length) console.log(`  note  ${asArea.length} directory place(s) not checked, because each is an official area name the map shows (his decision, 14 Sep 2026)`);
  if (collided.length) {
    console.log(`  note  ${collided.length} name(s) NOT checked, because they collide with the desk's own`
      + ` vocabulary: ${collided.map((n) => n[0] + "*".repeat(n.length - 1)).join(", ")}.`
      + ` Rename the column rather than lengthening that list. See NAME_COLLISIONS in book.mjs.`);
  }
} else {
  console.log("  note  salt_bio.json is not on this machine, so the name check did not run");
}

/* ---- write --------------------------------------------------------------------------- */
const stamp = meta.LAST_UPDATED || null;
const version = (Array.isArray(meta.evolution) && meta.evolution[0] && meta.evolution[0].v) || null;
const body = { v: version, stamped: stamp, source: "master/salt_command.html", ledger: roundTripped || ledger };
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
