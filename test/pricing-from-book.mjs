/* test/pricing-from-book.mjs: S5b OF THE BOOK PLAN, THE ENGINE PRICES FROM A BOOK ALONE (28 Oct 2026). Dormant: nothing reads the engine's PRICING yet. Each check red under its own mutation
 * (test/pricing-from-book.mutations.json):
 *   1  engine/book-inputs.mjs builds the context the page builds out of its globals: every field equal to the page's own on the frozen book (a page opened in jsdom), the loans net by the
 *      master's own rule, the default book, the page's TODAY
 *   2  pricing() over that context is the page's byProduct for every book (cost, floors, inputs, sizes, rungs, ladder, every customer's card, lift and suggestion) and its sizes, on the pinned
 *      fixture the page gave; the module imports engine files only, so a Worker can run it
 *   3  pricingDiffer names the product and the figure, and for a customer map how many and five codes, with no value
 *   4  tools/pricing-parity.mjs: equal on equal files, a difference named, the day before accepted with a note, a file missing or without PRICING an error, and the line carries no figure
 *   5  the chain runs it after the Book source step, continue-on-error, no secrets */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FROZEN_BOOK } from "./frozen.mjs";
import { openMaster } from "../tools/payload.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE_NOW = Date.parse("2026-10-16T04:00:00Z");   /* the day the pinned fixture was taken (test/engine-snapshot.mjs) */

export async function run({ ok }) {
  const { inputsFromBook, pricingFromBook, pricingDiffer, klToday, DEFAULT_PROD } = await import("../engine/book-inputs.mjs");
  const { checkPricing, line, stampMoment } = await import("../tools/pricing-parity.mjs");
  const SNAPSHOT_ENGINE = (await import("../engine/snapshot.mjs")).default, RULES = (await import("../engine/rules.mjs")).default;
  const book = JSON.parse(readFileSync(FROZEN_BOOK, "utf8"));
  const fixture = JSON.parse(readFileSync(join(REPO, "test", "fixtures", "pricing-before-s1c.json"), "utf8"));
  const r8 = (v) => JSON.stringify(v, (k, x) => (typeof x === "number" ? Math.round(x * 1e8) / 1e8 : x));

  /* 1: the context */
  const { w } = await openMaster(undefined, { before: (win) => { win.Date.now = () => FIXTURE_NOW; } });
  const J = (e) => JSON.parse(String(w.eval("JSON.stringify(" + e + ")")));
  const B = inputsFromBook(book);
  const fields = [["sales", "sales"], ["purchases", "purchases"], ["opening", "PROD_OPENING"], ["statedStockBy", "statedStockBy"], ["statedStock", "STATED_STOCK"], ["counts", "COUNTS"], ["selfUseLog", "selfUseLog"],
    ["quotes", "QUOTES"], ["costRule", "COST_RULE"], ["refunds", "customerRefunds"], ["roster", "roster"], ["partners", "partners"], ["tierOf", "TIER_OF"], ["prodOrder", "PROD_ORDER"], ["defaultProd", "DEFAULT_PROD"]];
  const bad = fields.filter(([k, g]) => JSON.stringify(B[k]) !== JSON.stringify(J("typeof " + g + "!=='undefined'?" + g + ":null"))).map(([k]) => k);
  ok(!bad.length, "every field of the context equals the page's own global on the frozen book (" + fields.length + " fields): " + (bad.join() || "all"));
  ok(JSON.stringify(B.priceSet) === JSON.stringify(J("typeof PRICE_SET!=='undefined'?PRICE_SET:null")) && JSON.stringify(B.supplierReceivable) === JSON.stringify(J("typeof supplierReceivable!=='undefined'?supplierReceivable:null")),
    "and so are the price set and the supplier receivable (each null when the book has none)");
  ok(Math.abs(B.loanDrawUnits() - J("loanDrawUnits()")) < 1e-9, "the loans net, by the master's own rule, is the page's: " + B.loanDrawUnits());
  const loans = { loans: [
    { direction: "out", valueKg: 10, repaid: [{ kg: 3 }] },                      /* 7 out */
    { direction: "out", valueKg: 5, status: "settled" },                           /* nothing: settled */
    { direction: "out", valueKg: 8, preOpening: true },                            /* nothing: before the opening */
    { direction: "in", valueKg: 4, repaid: [{ kg: 1 }] }                           /* 3 in */
  ] };
  ok(inputsFromBook(loans).loanDrawUnits() === 4 && inputsFromBook({}).loanDrawUnits() === 0, "loans net as the master nets them: out less repaid, a settled loan and a loan before the opening nothing, in subtracted (7 less 3 is 4), no loans nought");
  ok(DEFAULT_PROD === "salt" && B.defaultProd === "salt" && inputsFromBook({}).defaultProd === "salt", "the default book is salt even though no book key says so (a salt row names no product)");
  ok(klToday(Date.parse("2026-10-27T15:59:00Z")).toISOString() === "2026-10-27T00:00:00.000Z" && klToday(Date.parse("2026-10-27T16:00:00Z")).toISOString() === "2026-10-28T00:00:00.000Z"
    && klToday(new Date("2026-10-28T03:00:00Z")).getTime() === klToday(Date.parse("2026-10-28T03:00:00Z")).getTime() && klToday(FIXTURE_NOW).getTime() === J("TODAY.getTime()"),
    "today is the Kuala Lumpur calendar day at midnight UTC, as the page's TODAY is (the day turns at 16:00 UTC)");
  const empty = inputsFromBook({});
  ok(Object.keys(empty).length >= 15 && empty.sales.length === 0 && inputsFromBook({ sales: [1] }).sales.length === 1 && JSON.stringify(empty.opening) === "{}" && JSON.stringify(empty.quotes) === "{}" && Array.isArray(empty.roster) && empty.roster.length === 0 && JSON.stringify(empty.tierOf) === "{}" && Array.isArray(empty.prodOrder) && empty.prodOrder.length === 0,
    "a book with keys missing gives empty lists and objects");
  let thrown = null, ep = null; try { ep = pricingFromBook({}, FIXTURE_NOW); } catch (e) { thrown = e.message; }
  ok(!thrown && ep && ep.sizes === null && Object.keys(ep.byProduct).length === 0, "and pricing it is nothing, not a throw (in a Worker that would be a 500): " + (thrown || "none"));
  /* the render's cache: the engine asks for it by key, and the same key answers from the cache */
  const counted = inputsFromBook(book); let asks = 0, ran = 0; const wrapped = counted.memo;
  counted.memo = (k, f) => { asks++; return wrapped(k, (...a) => { ran++; return f(...a); }); };
  const viaCache = SNAPSHOT_ENGINE.pricing(counted, RULES, klToday(FIXTURE_NOW), null);
  const noCache = SNAPSHOT_ENGINE.pricing({ ...inputsFromBook(book), memo: undefined }, RULES, klToday(FIXTURE_NOW), null);
  ok(asks > 100 && ran < asks && r8(viaCache) === r8(noCache), "the engine asks the supplied cache by key (" + asks + " asks, " + (asks - ran) + " answered from it, the work done " + ran + " times) and the figures are the same with and without it");

  /* 2: the figures */
  const got = pricingFromBook(book, FIXTURE_NOW);
  const products = Object.keys(fixture.byProduct);
  ok(products.length >= 6 && products.every((p) => r8(got.byProduct[p]) === r8(fixture.byProduct[p])) && r8(got.sizes) === r8(fixture.sizes),
    "pricing() from the book alone is the page's byProduct for every book (" + products.join(", ") + ") and its sizes, on the pinned fixture");
  ok(Object.keys(got.byProduct.salt.cards).length > 10 && Object.keys(got.byProduct.salt.lift || {}).length > 10 && got.byProduct.salt.ladder.length > 5, "and that includes the customers' cards, the lift of a % book and the ladder, not an empty shell");
  const later = pricingFromBook(book, FIXTURE_NOW + 40 * 86400000);
  ok(r8(later.byProduct) !== r8(got.byProduct), "the clock is an input: forty days on, the figures that read the day (lock ages, drift) are not the same");
  const src = readFileSync(join(REPO, "engine", "book-inputs.mjs"), "utf8");
  const imports = [...src.matchAll(/^import .* from "([^"]+)";/gm)].map((m) => m[1]);
  ok(imports.length === 2 && imports.every((i) => /^\.\/\w+\.mjs$/.test(i)) && !/\bnode:|\brequire\(|process\./.test(src.replace(/\/\*[\s\S]*?\*\//g, "")), "the module imports engine files only and reads nothing of node, so a Worker can run it: " + imports.join());

  /* 3: the differ */
  const a = { salt: { stockCost: 1, floors: { 1: { floor: 5 } }, cards: { A: [[1, 10]], B: [[1, 11]] }, ladder: [] }, oil: { stockCost: 2 } };
  const clone = () => JSON.parse(JSON.stringify(a));
  ok(pricingDiffer(a, clone()).length === 0 && pricingDiffer(a, { ...clone(), salt: { ...clone().salt, stockCost: 1 + 1e-10 } }).length === 0, "equal figures differ by nothing, and a difference under the eighth place is none");
  const b1 = clone(); b1.salt.stockCost = 2;
  ok(pricingDiffer(a, b1).join() === "salt.stockCost", "one figure that differs is named by product and key: " + pricingDiffer(a, b1).join());
  const b2 = clone(); b2.salt.cards = { A: [[1, 99]], B: [[1, 11]], C: [[1, 1]] };
  ok(pricingDiffer(a, b2).join() === "salt.cards (2: A, C)", "a customer map names how many differ and the codes: " + pricingDiffer(a, b2).join());
  const b3 = clone(); for (const c of "ABCDEFGH") b3.salt.cards[c] = [[1, 1]];
  ok(/^salt\.cards \(8: A, B, C, D, E, \.\.\.\)$/.test(pricingDiffer(a, b3).join()) && !/\d\.\d/.test(pricingDiffer(a, b3).join()), "five codes at most, and no value anywhere in the line");
  const b4 = clone(); delete b4.oil;
  ok(pricingDiffer(a, b4).join() === "oil (missing on one side)", "a book on one side only is named");

  /* 4: the tool */
  const dir = mkdtempSync(join(tmpdir(), "salt-pp-test-"));
  try {
    const bookFile = join(dir, "book.json"), ledFile = join(dir, "ledger.json");
    writeFileSync(bookFile, JSON.stringify(book));
    const led = (pricing, v = "v1303", stamped = "x") => JSON.stringify({ v, stamped, source: "y", ledger: { PRICING: pricing } });
    writeFileSync(ledFile, led(fixture));
    const now = new Date(FIXTURE_NOW);
    const eq = checkPricing(bookFile, ledFile, { now });
    ok(eq.ok && eq.differ.length === 0 && eq.sizesSame && eq.products === products.length && eq.v === "v1303" && !eq.note, "on equal files the check is ok over every book: " + JSON.stringify({ ok: eq.ok, products: eq.products, ms: eq.ms }));
    const off = JSON.parse(JSON.stringify(fixture)); off.byProduct.salt.stockCost += 1; off.sizes = [1];
    writeFileSync(ledFile, led(off));
    const df = checkPricing(bookFile, ledFile, { now });
    ok(!df.ok && df.differ.join() === "salt.stockCost" && df.sizesSame === false && /DIFFER: salt\.stockCost, sizes/.test(line(df)), "a figure that differs, and the sizes, are named: " + line(df));
    /* the page struck its figures the day before: the same fixture read at the day after is equal at the day before */
    writeFileSync(ledFile, led(fixture));
    /* the clock is the page's own: the stamp the fold wrote seconds before the page struck its figures, read as Kuala Lumpur time */
    ok(stampMoment("16 Oct 2026, 12:00 KL") === FIXTURE_NOW && stampMoment("1 Jan 2027, 00:05 KL") === Date.parse("2026-12-31T16:05:00Z") && stampMoment("x") === null && stampMoment("28 Foo 2026, 11:36 KL") === null && stampMoment(undefined) === null,
      "the stamp reads as Kuala Lumpur time (12:00 KL is 04:00 UTC), and anything else as none");
    writeFileSync(ledFile, led(fixture, "v1303", "16 Oct 2026, 12:00 KL"));
    const byStamp = checkPricing(bookFile, ledFile, { now: new Date(FIXTURE_NOW + 40 * 86400000) });
    ok(byStamp.ok && byStamp.at === "the stamp" && !byStamp.note, "with a readable stamp the check is made on the page's own day, whenever it is run (here forty days later): a re-run of a failed job is equal as it should be");
    writeFileSync(ledFile, led(fixture, "v1303", "17 Oct 2026, 12:00 KL"));
    const wrongDay = checkPricing(bookFile, ledFile, { now: new Date(FIXTURE_NOW + 86400000) });   /* now - one day is the page's day: only the stamp's rule keeps this a difference */
    ok(!wrongDay.ok && wrongDay.at === "the stamp" && !wrongDay.note, "a stamp a day off the page's is a difference, and is not forgiven by the day-before allowance, which is for a ledger with no stamp");
    writeFileSync(ledFile, led(fixture));
    const sz = JSON.parse(JSON.stringify(fixture)); sz.sizes = [1, 2];
    writeFileSync(ledFile, led(sz));
    const onlySizes = checkPricing(bookFile, ledFile, { now });
    ok(!onlySizes.ok && onlySizes.differ.length === 0 && onlySizes.sizesSame === false && /DIFFER: sizes$/.test(line(onlySizes)), "sizes that differ alone are a difference too, named: " + line(onlySizes));
    writeFileSync(ledFile, led(fixture));
    /* the smallest shift of the clock that moves a figure on this fixture; the tool's allowance is one day, tried here at that shift so a day that moves nothing cannot hide the mechanism */
    let k = 0; const base = r8(got.byProduct);
    for (let d = 1; d <= 30 && !k; d++) if (r8(pricingFromBook(book, FIXTURE_NOW + d * 86400000).byProduct) !== base) k = d;
    const nowK = new Date(FIXTURE_NOW + k * 86400000);
    const direct = checkPricing(bookFile, ledFile, { now: nowK, back: 1 });   /* an allowance of nothing: the day after is a difference */
    const roll = checkPricing(bookFile, ledFile, { now: nowK, back: k * 86400000 });
    ok(k > 0 && !direct.ok && roll.ok && /equal at the day before/.test(roll.note || "") && /equals the page's/.test(line(roll)) && /day before/.test(line(roll)),
      "figures struck the day before read as equal with a note (the smallest clock shift that moves a figure here is " + k + " days; the allowance is one day in the chain)");
    ok(checkPricing(bookFile, ledFile, { now: new Date(FIXTURE_NOW + 40 * 86400000) }).ok === false, "forty days on they do not: the allowance is the one day, not a licence");
    writeFileSync(ledFile, JSON.stringify({ v: "v1", ledger: {} }));
    const none = checkPricing(bookFile, ledFile, { now });
    const gone = checkPricing(join(dir, "nope.json"), ledFile, { now });
    ok(!none.ok && /no PRICING/.test(none.error) && /NOT RUN/.test(line(none)) && !gone.ok && /could not read/.test(gone.error), "a ledger with no PRICING, and a missing file, are errors and say NOT RUN, never an equality");
    const ln = line({ ok: true, products: 6, v: "v1303", ms: 700, differ: [] });
    ok(/Pricing parity: ledger v1303, 6 books; the engine's PRICING from the book equals the page's \(700 ms\)/.test(ln) && !/\d+\.\d+/.test(ln), "the line carries counts and a time and no figure: " + ln);
  } finally { rmSync(dir, { recursive: true, force: true }); }

  /* 5: the chain */
  const yml = readFileSync(join(REPO, ".github", "workflows", "cloud-commit.yml"), "utf8");
  const at = yml.indexOf("- name: Check the Book builds the same statements"), pp = yml.indexOf("- name: Check the engine prices as the page did");
  const step = pp > 0 ? yml.slice(pp, pp + 700) : "";
  ok(at > 0 && pp > at && /continue-on-error: true/.test(step) && /if: steps\.plan\.outputs\.deploy == '1'/.test(step) && /run: node tools\/pricing-parity\.mjs/.test(step) && !/secrets\./.test(step.split("run:")[0]),
    "the chain runs it after the Book source step, only on a deploy, continue-on-error, with no secret");
}
