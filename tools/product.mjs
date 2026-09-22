#!/usr/bin/env node
/* product.mjs — REGISTERING A PRODUCT IS A COMMAND, NOT SURGERY (v778).
 *
 * The desk has traded two products since v228 and had never added a third. Oil did not arrive
 * through a workflow: it pre-dated the repo and was carried in at v339 when the book left the
 * desk, so there was no precedent to copy and "add a product" meant hand-editing the book in
 * six places and hoping none was missed. This is that job, stated once.
 *
 *   node tools/product.mjs --list
 *   node tools/product.mjs --add candy --name Candy [--note "..."] [--since 2026-09-22]
 *   node tools/product.mjs --rename spare rice
 *   node tools/product.mjs --retire spare
 *   node tools/product.mjs --unretire spare
 *
 * Every one writes ledger/book.json and then runs booksync --sync, because the master's BOOK
 * block is generated and a book edited without a sync fails CI until somebody notices.
 *
 * WHAT IT DOES NOT DO. It does not give a product a hue or a mark: those are design decisions
 * and they live in design/salt-ds.css and stmt/page.js, where a colour and a drawing belong.
 * A product with neither still works; it draws in the fallback and says so. It does not price
 * anything: a new book has no cost, so the fold refuses its first sale and asks for the first
 * lot by hand, which is v228's own bootstrap rule and not a gap.
 *
 * WHY --retire REFUSES A BOOK WITH ROWS. `retired` is read by prodLive() in the master, which
 * feeds PROD_IDS, which every consolidated total reads. Hiding a book that had a past would
 * therefore quietly drop its revenue out of the whole-book figures, and nothing would say so.
 * So the flag is only ever allowed on a book with nothing on it. Retiring a book that traded
 * is a different question, with an answer somebody has to choose; this refuses rather than
 * guesses. */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BOOK = process.env.SALT_BOOK || resolve(REPO, "ledger", "book.json");

/* the keys that are a map of product to something */
const MAPS = ["PRODUCTS", "PROD_OPENING", "COUNT_ON", "PRICE_SET", "COST_RULE", "QUOTES"];
/* the collections whose rows carry a product, and where an absent field means salt */
const ROWS = ["sales", "purchases", "loans", "COUNTS", "selfUseLog", "lostDemand"];

const read = () => JSON.parse(readFileSync(BOOK, "utf8"));
const write = (b) => writeFileSync(BOOK, JSON.stringify(b, null, 2) + "\n");
const die = (m) => { console.error("REFUSED: " + m); process.exit(1); };

function sync() {
  execFileSync(process.execPath, [resolve(REPO, "tools", "booksync.mjs"), "--sync"], { stdio: "inherit" });
}

/* Every row on the book that belongs to this product. An absent product field means salt, so
   salt owns every row that names nothing: see docs/PRODUCTS.md section 6. */
function rowsOf(b, id) {
  let n = 0;
  for (const k of ROWS) for (const r of (b[k] || [])) if (((r && r.product) || "salt") === id) n++;
  return n;
}

function list(b) {
  const order = b.PROD_ORDER || [];
  for (const id of Object.keys(b.PRODUCTS || {})) {
    const p = b.PRODUCTS[id];
    const at = order.indexOf(id);
    console.log(
      "  " + id.padEnd(10) +
      (p.name || "").padEnd(10) +
      (p.retired ? "RETIRED  " : "live     ") +
      String(rowsOf(b, id)).padStart(4) + " rows   " +
      (at < 0 ? "not in PROD_ORDER" : "order " + at) +
      (b.QUOTES && b.QUOTES[id] ? "   quoted" : "   no quote"));
  }
}

function add(b, id, name, note, since) {
  if (!/^[a-z][a-z0-9]{1,19}$/.test(id)) die(`"${id}" is not a product id: lower case, letters and digits, 2 to 20 characters. The site's own order check uses the same shape.`);
  if (b.PRODUCTS && b.PRODUCTS[id]) die(`${id} is already a product on this book.`);
  if (!name) die("a product needs a --name; it is what the desk calls it on the switch.");

  b.PRODUCTS[id] = {
    id, name, unit: "unit",
    accent: `var(--salt-product-${id})`,
    since: since || new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10),
    retired: false,
    note: note || `Opened by tools/product.mjs. No lot, no sale and no count yet, so the fold will refuse a sale on it until its first lot is entered by hand.`,
  };
  b.PROD_ORDER.push(id);
  b.PROD_OPENING[id] = { qty: 0, costPerKg: null, stated: null };
  b.COUNT_ON[id] = null;
  b.PRICE_SET[id] = { prices: {}, hide: [] };
  b.COST_RULE[id] = { kind: "stack", note: "Stated deliberately, as salt's and oil's are, rather than left to the default. Change it when the book's own economics are known." };
  b.QUOTES[id] = null;
  console.log(`added ${id} (${name}): registered in ${MAPS.length} maps and PROD_ORDER.`);
  /* Say what is actually missing, not what usually is: a hue and a mark may already have been
     drawn before the book was opened, and a reminder that is wrong is worse than none. */
  const has = (f, needle) => { try { return readFileSync(resolve(REPO, f), "utf8").includes(needle); } catch (e) { return false; } };
  if (!has("design/salt-ds.css", `--salt-product-${id}:`))
    console.log(`  NO HUE: add --salt-product-${id} upstream in the design system, then designsync --pull --sync and stmt-style --sync. An undefined var() resolves to nothing, so the accent would go missing in silence.`);
  if (!has("stmt/page.js", `${id}: '`))
    console.log(`  no mark: add PSYM.${id} and PSHAPE.${id} in stmt/page.js, or the Counter draws it as the Ring.`);
}

function rename(b, from, to) {
  if (!b.PRODUCTS[from]) die(`${from} is not a product on this book.`);
  if (b.PRODUCTS[to]) die(`${to} is already a product on this book.`);
  if (!/^[a-z][a-z0-9]{1,19}$/.test(to)) die(`"${to}" is not a product id: lower case, letters and digits, 2 to 20 characters.`);
  if (from === "salt") die("salt is the book's default: a row that names no product is salt, so re-keying it would silently re-attribute every row that names nothing. See docs/PRODUCTS.md section 6.");

  for (const k of MAPS) {
    if (!b[k] || !(from in b[k])) continue;
    const v = b[k][from];
    delete b[k][from];
    b[k][to] = v;
  }
  if (b.PRODUCTS[to]) {
    b.PRODUCTS[to].id = to;
    if (b.PRODUCTS[to].accent === `var(--salt-product-${from})`) b.PRODUCTS[to].accent = `var(--salt-product-${to})`;
  }
  b.PROD_ORDER = (b.PROD_ORDER || []).map((p) => (p === from ? to : p));

  let moved = 0;
  for (const k of ROWS) for (const r of (b[k] || [])) if (r && r.product === from) { r.product = to; moved++; }
  let tiers = 0;
  for (const code of Object.keys(b.TIER_OF || {})) {
    const t = b.TIER_OF[code];
    if (t && from in t) { t[to] = t[from]; delete t[from]; tiers++; }
  }
  console.log(`renamed ${from} to ${to}: ${moved} rows, ${tiers} customer tiers, and every map key.`);
}

function retire(b, id, on) {
  if (!b.PRODUCTS[id]) die(`${id} is not a product on this book.`);
  if (on) {
    const n = rowsOf(b, id);
    if (n) die(`${id} has ${n} row(s) on the book. Retiring it would take them out of PROD_IDS and out of every consolidated total with nothing to say so. Retiring a book that traded is a different question and needs your word on what its history should do.`);
    const o = b.PROD_OPENING[id] || {};
    if (o.qty || o.stated != null) die(`${id} carries an opening (${JSON.stringify(o)}). Clear it first, or it is a book with a position that nothing shows.`);
  }
  b.PRODUCTS[id].retired = !!on;
  console.log(`${id} is now ${on ? "RETIRED: off the switch, the Enter form, the tier grid and the parity scan, and still in the book" : "live again"}.`);
}

const a = process.argv.slice(2);
const flag = (n) => { const i = a.indexOf(n); return i < 0 ? null : (a[i + 1] || null); };

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const b = read();
  b.PRODUCTS = b.PRODUCTS || {}; b.PROD_ORDER = b.PROD_ORDER || [];
  for (const k of MAPS) b[k] = b[k] || {};

  if (a.includes("--list") || !a.length) { list(b); process.exit(0); }
  else if (a.includes("--add")) add(b, flag("--add"), flag("--name"), flag("--note"), flag("--since"));
  else if (a.includes("--rename")) { const i = a.indexOf("--rename"); rename(b, a[i + 1], a[i + 2]); }
  else if (a.includes("--retire")) retire(b, flag("--retire"), true);
  else if (a.includes("--unretire")) retire(b, flag("--unretire"), false);
  else die("no command. One of --list, --add, --rename, --retire, --unretire.");

  write(b);
  sync();
  console.log("book written and the master's BOOK block synced. Build and run the suite.");
}

export { rowsOf, MAPS, ROWS };
