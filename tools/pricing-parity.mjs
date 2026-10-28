#!/usr/bin/env node
/* tools/pricing-parity.mjs: S5b OF THE BOOK PLAN, THE ENGINE PRICES AS THE PAGE DID (28 Oct 2026; plan: docs/plan-book-s5-s6.html). Dormant: nothing reads the engine's PRICING yet.
 *
 * The desk's PRICING (ledger/ledger.json) is struck in jsdom over the master at every fold. engine/book-inputs.mjs builds the same figures from the book alone with the engine's own
 * pricing(), which is what lets a Worker or the Book recompute them after a tap once approvals are not versions (S5f). This is the proof, run at every fold: the engine's byProduct (every
 * book's cost, floors, inputs, sizes, rungs, ladder, every customer's card, and a drift book's lift and suggestion) from ledger/book.json equals the page's from ledger/ledger.json, and so
 * do the sizes. A difference names the product and the figure (and, for a card or a lift, how many customers and five codes), never a figure's value (the log is public).
 *
 * Prices read the Kuala Lumpur day (lock ages move every day: the price lock is set for salt and oil). The page struck its PRICING seconds after the fold wrote ledger.json's `stamped`, so
 * the check is made at THAT moment, which is the page's own day and makes a re-run of a failed job days later, or a version pushed the day after its bump, equal as it should be. Only a
 * ledger with no readable stamp falls back to now, and then, if that differs, once more at the day before (a fold struck just before midnight reads as equal with a note).
 * WHAT IT PROVES, said plainly: the glue. The page's own snapshot calls the master's one-line delegations to the same engine (engine/snapshot.mjs, position.mjs, pricing.mjs), so a bug in
 * those would pass on both sides; what is proved is that the context a Worker builds from a book (engine/book-inputs.mjs) is the context the page builds, and nothing else moved. Not covered, said: \`obs\` (the Whiteboard's advice, no
 * figure) and \`profileOf\` (how a customer buys, prices nothing yet), which only the page derives.
 *
 *   node tools/pricing-parity.mjs        (no secrets, no network: the checkout's own two files; the chain runs it after the Book source step, continue-on-error) */
import { readFileSync, appendFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { pricingFromBook, pricingDiffer } from "../engine/book-inputs.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DAY = 86400000;
const MON = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
/** the moment a ledger.json's `stamped` names ("28 Oct 2026, 11:36 KL", the master's LAST_UPDATED the fold wrote seconds before the page struck its figures), or null */
export function stampMoment(s) {
  const m = /^(\d{1,2}) (\w{3}) (\d{4}), (\d{2}):(\d{2}) KL$/.exec(String(s || ""));
  if (!m || !MON[m[2]]) return null;
  const t = Date.parse(m[3] + "-" + String(MON[m[2]]).padStart(2, "0") + "-" + m[1].padStart(2, "0") + "T" + m[4] + ":" + m[5] + ":00+08:00");
  return Number.isFinite(t) ? t : null;
}
const r8 = (v) => JSON.stringify(v, (k, x) => (typeof x === "number" ? Math.round(x * 1e8) / 1e8 : x));

/** The engine's PRICING from a book file against the page's from a ledger file: { ok, products, differ: [names], sizesSame, ms, v, note? } or { ok: false, error }. */
export function checkPricing(bookFile, ledgerFile, { now = new Date(), back = DAY } = {}) {
  let stamped = null;
  let book, led;
  try { book = JSON.parse(readFileSync(bookFile, "utf8")); led = JSON.parse(readFileSync(ledgerFile, "utf8")); }
  catch (e) { return { ok: false, error: "could not read the checkout's files: " + String((e && e.message) || e).slice(0, 160) }; }
  const page = led && led.ledger && led.ledger.PRICING;
  stamped = stampMoment(led && led.stamped);
  if (!page || !page.byProduct) return { ok: false, error: "ledger.json holds no PRICING to compare with" };
  const t0 = Date.now();
  const at = (when) => { const got = pricingFromBook(book, when); return { got, differ: pricingDiffer(got.byProduct, page.byProduct), sizesSame: r8(got.sizes) === r8(page.sizes) }; };
  let note = null, x;
  try {
    x = at(stamped !== null ? new Date(stamped) : now);
    if (stamped === null && (x.differ.length || !x.sizesSame)) { const y = at(new Date(+now - back)); if (!y.differ.length && y.sizesSame) { x = y; note = "equal at the day before: the page struck its figures before midnight in Kuala Lumpur"; } }
  } catch (e) { return { ok: false, error: "the engine could not price the book: " + String((e && e.message) || e).slice(0, 160) }; }
  return { ok: !x.differ.length && x.sizesSame, products: Object.keys(page.byProduct).length, differ: x.differ, sizesSame: x.sizesSame, ms: Date.now() - t0, v: led.v || null, at: stamped !== null ? "the stamp" : "now", ...(note ? { note } : {}) };
}

/** the one line the step says: counts and names, never a figure */
export function line(r) {
  if (!r || r.error) return "Pricing parity NOT RUN: " + ((r && r.error) || "no answer");
  const head = "Pricing parity: ledger " + r.v + ", " + r.products + " books";
  return r.ok ? head + "; the engine's PRICING from the book equals the page's (" + r.ms + " ms)" + (r.note ? "; " + r.note : "")
    : head + "; DIFFER: " + r.differ.join(", ") + (r.sizesSame ? "" : (r.differ.length ? ", " : "") + "sizes");
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const r = checkPricing(join(REPO, "ledger", "book.json"), join(REPO, "ledger", "ledger.json"));
  const said = line(r), good = !!r.ok;
  console.log(good ? said : "::error::" + said);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, "\n### Pricing (the engine against the page)\n" + said + "\n");
  process.exit(good ? 0 : 1);
}
