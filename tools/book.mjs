/* book.mjs — what the book IS, and how to read it out of the desk.
 *
 * Extracted from ledger.mjs when d1.mjs needed the same answers. Two copies of "which
 * declarations are the ledger" would be two things to keep true, and the one that drifted
 * would drift silently: the extract would carry a row the store never checked, or the store
 * would be proven against a list that no longer matched the book. One definition, imported.
 */
import { readFileSync } from "node:fs";
import { openMaster } from "./payload.mjs";

/* THE COMMITTED BOOK IS `BASE_*`, NOT `sales`. The desk keeps two copies of the moving
 * parts: `BASE_SALES` and friends are deep copies taken at load, and `sales` is that copy
 * with the uncommitted queue folded over it by applyOverlay(). They are equal only while the
 * queue is empty. Reading `sales` would therefore treat PROVISIONAL rows as committed the
 * moment anything is queued. Left of the colon is the name in the store; right is the
 * declaration to read from the desk. */
export const LEDGER = {
  PRODUCTS: "PRODUCTS", PROD_ORDER: "PROD_ORDER",
  opening: "opening", PROD_OPENING: "PROD_OPENING", STATED_STOCK: "STATED_STOCK",
  purchases: "BASE_PURCHASES",
  sales: "BASE_SALES",
  contacts: "BASE_CONTACTS",
  selfUseLog: "BASE_SELFUSE",
  lostDemand: "BASE_LOST",
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
export const LEDGER_KEYS = Object.keys(LEDGER);

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

/* One default, shared with payload.mjs by matching it, and overridable the same way. */
export const MASTER = process.env.SALT_MASTER ||
  "C:/Users/maakm/Claude/Projects/Personal/Cow-Crm01_Salt Business/01_Dashboard/salt_command.html";

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
  return { dom, w, read, ledger, meta, missing, version, stamped: meta.LAST_UPDATED || null,
    src: readFileSync(masterPath, "utf8") };
}
