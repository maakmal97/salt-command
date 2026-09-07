/* book.mjs — what the book IS, and how to read it out of the desk.
 *
 * Extracted from ledger.mjs when d1.mjs needed the same answers. Two copies of "which
 * declarations are the ledger" would be two things to keep true, and the one that drifted
 * would drift silently: the extract would carry a row the store never checked, or the store
 * would be proven against a list that no longer matched the book. One definition, imported.
 */
import { readFileSync } from "node:fs";
import { openMaster } from "./payload.mjs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/* THE COMMITTED BOOK IS `BASE_*`, NOT `sales`. The desk keeps two copies of the moving
 * parts: `BASE_SALES` and friends are deep copies taken at load, and `sales` is that copy
 * with the uncommitted queue folded over it by applyOverlay(). They are equal only while the
 * queue is empty. Reading `sales` would therefore treat PROVISIONAL rows as committed the
 * moment anything is queued. Left of the colon is the name in the store; right is the
 * declaration to read from the desk. */
export const LEDGER = {
  PRODUCTS: "PRODUCTS", PROD_ORDER: "PROD_ORDER",
  opening: "opening", PROD_OPENING: "PROD_OPENING", STATED_STOCK: "STATED_STOCK",
  /* WHEN EACH SHELF WAS LAST COUNTED (v319). Part of the book, not metadata: it is the
     difference between a figure somebody looked at and a figure the arithmetic produced,
     and the week to 20 Aug proved that distinction is worth 24 unit. A roll never moves it. */
  COUNT_ON: "COUNT_ON",
  COUNTS: "COUNTS",   /* v504: every count as taken, the leak's measurement */
  purchases: "BASE_PURCHASES",
  sales: "BASE_SALES",
  contacts: "BASE_CONTACTS",
  selfUseLog: "BASE_SELFUSE",
  lostDemand: "BASE_LOST",
  loans: "loans",
  supplierReceivable: "supplierReceivable",
  /* v444: READ THE COMMITTED COPY, like sales and the board. Until this version the overlay
     never touched this list, so reading it live was safe. A cancelled paid order now books a
     payable into it, which means a queued-but-unapproved cancellation would otherwise put a
     provisional refund into the extract and from there into the store. The census caught it. */
  customerRefunds: "BASE_REFUNDS",
  roster: "roster", associates: "associates", PEOPLE: "PEOPLE",
  REWARD_OPENING: "REWARD_OPENING", CUSTOMER_REWARD_OPENING: "CUSTOMER_REWARD_OPENING",
  AWARDS: "AWARDS",
  supplierQuote: "supplierQuote", oilQuote: "oilQuote",
  SOURCING_PLAN: "SOURCING_PLAN",
  /* v354: read the COMMITTED copy, like sales and selfUseLog. PRICE_SET carries the overlay once a
     price edit is queued, and the extract must never see a change nobody has approved. */
  PRICE_SET: "BASE_PRICESET",
  CASH_COUNT_RETIRED: "CASH_COUNT_RETIRED",
  ONE_OFFS: "ONE_OFFS",
  QUEUE_COMMITTED: "QUEUE_COMMITTED",
};
export const LEDGER_KEYS = Object.keys(LEDGER);

/* ============ THE ONE PLACE THE DATA FOLDER IS NAMED (v357) ============
   salt_bio.json, salt_vault.json, menu_secret.txt and the two queue files live in the PROJECT
   folder and never in this repo, by the hard rule at the top of CLAUDE.md. Three tools each
   carried their own copy of that path, and on 24 Aug the project was moved and renamed from
   Projects\Personal\Cow-Crm01_Salt Business to Projects\Personal\Commerce\Per-Crm01_Salt
   Business. All three then pointed at a folder that no longer existed, and drain.mjs did the
   worst thing available: it mkdir'd the dead path and wrote an empty queue into it, so the run
   reported success while the real queue sat elsewhere. Nothing was lost, because the file it
   wrote was empty and the real one was untouched, but only because the timing was kind.
   ONE CONSTANT, AND THE TOOLS FAIL LOUDLY RATHER THAN CREATING A FOLDER. A missing data folder
   means the project has moved, and inventing it hides exactly the fact worth knowing. */
export const PROJECT_DIR = process.env.SALT_PROJECT
  || "C:/Users/maakm/Claude/Projects/Personal/Commerce/Per-Crm01_Salt Business";
export const DATA_DIR = process.env.SALT_DATA || `${PROJECT_DIR}/10_Data`;

/* Lists of records, as against single values. Rows go in `entry`, the rest in `state`. */
export const COLLECTIONS = ["sales", "purchases", "loans", "contacts", "selfUseLog",
  "lostDemand", "customerRefunds", "ONE_OFFS"];

export const META_KEYS = ["LAST_UPDATED", "evolution"];

/* SALT LEADS. Standing instruction of 11 Aug, restated 13 Aug: every list, table and payload
 * shows salt before oil wherever the two appear separately. PROD_ORDER in the master states
 * it and everything there derives from that one line; this is the same answer for anything
 * built out here, so no tool has to decide the order for itself. */
export const PROD_ORDER = ["salt", "oil"];
export const bySalt = (a, b) => {
  const i = PROD_ORDER.indexOf(a), j = PROD_ORDER.indexOf(b);
  return (i < 0 ? 99 : i) - (j < 0 ? 99 : j);
};

/* Read a global by name. The desk's data is declared with `const` at the top level of a
   classic script, so it lives in the global LEXICAL environment and is not a property of
   window; `window.eval` reaches it, a property lookup does not. */
export function reader(w) {
  return function read(name) {
    try { return { ok: true, value: w.eval(name) }; }
    catch (e) {
      if (name in w) return { ok: true, value: w[name] };
      return { ok: false, why: String((e && e.message) || e) };
    }
  };
}

/* WORDS THAT ARE IN THE DIRECTORY BUT ARE NOT NAMES.
 *
 * The leak check searches the built desk for every name in salt_bio.json, case-insensitively.
 * That is right for a person and wrong for the entries which are admissions rather than
 * names: "TBC" where a location was never known, and "General" on a downsell buyer, which is
 * what this desk calls an unnamed buyer rather than anybody's name. Left in, every ordinary
 * use of the word is reported as a leak, including the note reading "to a general downsell
 * buyer" on the very row explaining there is no name to leak. A gate that cries wolf on its
 * own vocabulary is one people learn to wave through.
 *
 * IT LIVES HERE BECAUSE THERE WERE TWO COPIES AND THEY DRIFTED. tools/ledger.mjs and
 * test/verify.mjs each carried their own list; "general" was added to the first and the
 * second went on failing, which is precisely the silent divergence book.mjs exists to stop.
 * One definition, both importers, and a test that asserts neither keeps a private copy. */
export const NAME_STOPWORDS = new Set(["tbc", "unknown", "n/a", "na", "none", "-", "general"]);

/* AND A SECOND LIST, WHICH IS A DIFFERENT AND WORSE PROBLEM, SO IT IS KEPT APART.
 *
 * The words above are not names at all. These ARE names, and are also ordinary words the
 * desk uses in its own furniture: a party called Max against a column headed "Max revenue".
 * Skipping them means a real party is NOT being checked for, which is a genuine hole, not a
 * tidy-up. It is accepted only because the alternative is worse: the gate fails on every
 * build, and a gate that always fails is a gate that gets commented out.
 *
 * THE PRICE IS PAID OUT LOUD. Both callers print what they skipped on every run, so nobody
 * can read a pass as "no name appears" when it means "no name appears except these". Keep
 * this list as short as it can possibly be, and prefer renaming the column to adding a word.
 * A three-letter name is the worst case; anything longer should be argued about first. */
export const NAME_COLLISIONS = new Set(["max", "min"]);

/* THE PRICING SNAPSHOT (v303), and it exists so the cloud drafter is never a second engine.
 *
 * A drafter has to answer two things about a proposed row: what the salt cost, and whether the
 * price clears the floor. Both are the desk's own arithmetic. Recomputing them in a Worker is
 * exactly the drift `data.json` was built to prevent, and the drift would land on the two
 * figures an approval screen is read for. So the desk computes them, through its own
 * functions, and the cloud reads the answers.
 *
 * IT IS ASSEMBLED HERE RATHER THAN ADDED TO THE MASTER. The master is the trading desk and it
 * should not grow a function for the cloud's convenience; every call below is one the desk
 * already makes for itself. Anything missing comes back null, because a drafter that knows it
 * cannot price a row is useful and one that guesses is not.
 *
 * IT IS A SNAPSHOT AND GOES STALE like every other mirrored value: it is re-taken on the same
 * pass that re-seeds the store, and it carries the version it was taken at so a reader can
 * tell. A drafter comparing it against a newer master should flag rather than proceed. */
/* THE OPEN ORDERS, AS THE DESK ITSELF SEES THEM (v322).
 *
 * Same rule and same reason as pricingSnapshot above: the drafter needs to know what is still
 * outstanding against a row before it can describe an amendment to it, and working that out in
 * a Worker would put a second copy of txPaid, txEffDeliv, poCash and poRecvUnits in a second file.
 * Three separate attempts at exactly that arithmetic were wrong on the first real rows on 20
 * Aug, all in the same way: raw fields read with the wrong ruler. So it is not recomputed. The
 * desk answers, during the extract, and the answer is stored.
 *
 * DERIVED, NOT DECLARED, which is why it is not in LEDGER_KEYS: nothing in the master is named
 * OPEN, exactly as nothing in it is named PRICING. */
export function openSnapshot(w) {
  const read = reader(w);
  const call = (expr) => { const r = read(expr); return r.ok && typeof r.value !== "undefined" ? r.value : null; };
  /* phonePayload already builds this list, keyed by the desk's own ovKey and carrying the
     desk's own outstanding figures. Reusing it means there is one definition of "open" on this
     desk rather than two that agree until they do not. */
  const payload = call("(typeof phonePayload==='function')?phonePayload():null");
  const open = (payload && Array.isArray(payload.open)) ? payload.open : [];
  const byKey = {};
  for (const o of open) if (o && o.key) byKey[o.key] = o;
  /* THE POSITION TRAVELS WITH IT, for the same one-engine reason. A count needs to be shown
     against what the book says is on the shelf, and how much of that is already owed to
     somebody: on 20 Aug a count of zero against a roll of 8.05 was six unit that CE4-CHE had
     already paid for, and reading it as ordinary shrinkage would have missed the only part
     that mattered. The desk works that out; nothing downstream should work it out again. */
  const position = (payload && payload.position) || {};
  const countedOn = (payload && payload.countedOn) || {};
  return { at: new Date().toISOString(), count: open.length, byKey, position, countedOn };
}

export function pricingSnapshot(w) {
  const read = reader(w);
  const call = (expr) => { const r = read(expr); return r.ok && typeof r.value !== "undefined" ? r.value : null; };
  const numOrNull = (v) => (typeof v === "number" && Number.isFinite(v)) ? +v.toFixed(4) : null;
  const products = call("PROD_ORDER") || ["salt"];
  const sizes = call("PRICE_TIERS && PRICE_TIERS.sizes") || [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6.25, 12.5];

  const byProduct = {};
  for (const p of products) {
    /* PROD is the desk's own active-product global and every pricing function reads it, so it
       is set, read, and put back. Restoring it matters: this runs inside the extract, and
       leaving the desk on the wrong book would silently change what is extracted next. */
    const before = call("PROD");
    let floors = null, repl = null, stockCost = null, inputs = null;
    try {
      /* v407, round seven, MATERIAL: PROD was assigned bare and the walk was never re-run, so
         every walk-derived global stayed on the PREVIOUS book and all twenty-four oil floors came
         out wrong. This is the production path: it is what the D1 mirror carries and what the
         below-floor flag is read against, so the snapshot must be taken on the book it names. */
      w.eval("PROD=" + JSON.stringify(p) + ";if(typeof recompute==='function')recompute();");
      stockCost = numOrNull(call("stockCostFor(" + JSON.stringify(p) + ")"));
      repl = numOrNull(call("replCost()"));
      /* v337: THE ENGINE'S OWN INPUTS, so the drafter can price any size with the module rather
         than read the nearest carded floor. Read as JSON so nothing from the window leaks through. */
      inputs = { cost: JSON.parse(w.eval("JSON.stringify(pxInputs())")), policy: JSON.parse(w.eval("JSON.stringify(pxPolicy())")) };
      floors = {};
      for (const q of sizes) {
        floors[q] = { floor: numOrNull(call("floorTotal(" + q + ")")) };   // v502: one floor per size
      }
    } catch (e) { /* a product the desk cannot price yields nulls, which the drafter must handle */ }
    finally { if (before != null) { try { w.eval("PROD=" + JSON.stringify(before) + ";if(typeof recompute==='function')recompute();"); } catch (e) { } } }
    byProduct[p] = { stockCost, replCost: repl, floors, inputs };
  }

  return {
    takenAt: new Date().toISOString(),
    sizes,
    ref: call("REF"),                       // the markup-on-cost ladder: floor, good, great, ceiling
    floorPct: call("PRICE && PRICE.floorPct"),   // the OTHER floor, a margin on price. See v300.
    shrinkAttrib: call("SHRINK_ATTRIB"),
    byProduct
  };
}

/* One default, shared with payload.mjs by matching it, and overridable the same way. */
export const MASTER = process.env.SALT_MASTER ||
  resolve(REPO, "master", "salt_command.html");

/* Open the desk and hand back the book as the engine sees it. `close()` is the caller's. */
export async function readBook(masterPath = MASTER) {
  const { dom, w } = await openMaster(masterPath);
  const read = reader(w);
  const ledger = {}, missing = [];
  for (const key of LEDGER_KEYS) {
    const r = read(LEDGER[key]);
    if (!r.ok || typeof r.value === "undefined") { missing.push(key); continue; }
    ledger[key] = r.value;
  }
  const meta = {};
  for (const key of META_KEYS) {
    const r = read(key);
    if (r.ok && typeof r.value !== "undefined") meta[key] = r.value;
  }
  const version = (Array.isArray(meta.evolution) && meta.evolution[0] && meta.evolution[0].v) || null;
  /* Taken LAST, after every value above has been read, because it sets and restores the desk's
     active product and nothing else should be reading while it does. */
  ledger.PRICING = { ...pricingSnapshot(w), v: version };
  ledger.OPEN = { ...openSnapshot(w), v: version };
  return { dom, w, read, ledger, meta, missing, version, stamped: meta.LAST_UPDATED || null,
    src: readFileSync(masterPath, "utf8") };
}
