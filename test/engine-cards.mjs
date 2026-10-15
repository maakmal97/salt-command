/* test/engine-cards.mjs: S1c-iii of the Book plan. THE CARDS AND THE DRIFT LIVE IN engine/snapshot.mjs, AND NO FIGURE MOVED.
   1. pricingSnapshot() on the frozen book (the clock pinned to 16 Oct 2026) is byte-identical, takenAt out and rounded to 8 places, to
      test/fixtures/pricing-before-s1c.json, which the master gave before any of this moved.
   2. NOT CIRCULAR: the engine's pricing(B,R,today) called in node with no page (the book read out of the page as plain data, the rules from
      engine/rules.mjs, the master's LADDER, PRICE and PRICE_LOCK_ON beside them) gives, for every book, the FIXTURE's stockCost, replCost, floors,
      inputs, sizes, rungs, ladder, cards, partners and drift. The page's delegations are not asked.
   3. The master's own script holds each moved function once, as a one-line delegation to SNAPSHOT_ENGINE, and the retired bodies nowhere.
   LADDER, PRICE and PRICE_LOCK_ON are still the master's own consts (R is built with them here); a Worker that runs pricing() supplies the
   same three from its own copy of the master's literals until S1c-iv moves them into engine/rules.mjs.
   Mutations: test/engine-cards.mutations.json. */
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { openMaster } from "../tools/payload.mjs";
import { pricingSnapshot } from "../tools/book.mjs";
import SNAPSHOT_ENGINE from "../engine/snapshot.mjs";
import RULES_MOD from "../engine/rules.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const round = (s) => JSON.stringify(s, (k, v) => typeof v === "number" ? Math.round(v * 1e8) / 1e8 : v);
const FUNCS = ["buyerProfile", "driftSignals", "driftOfNow", "driftOf", "driftBook", "tierCustomers", "pbPriced", "lateOf", "isPartner", "cardQuote"];
const CONSTS = ["ownerOf", "isResellAcct", "isPerson"];
const GONE = ["const R=PROFILE_RULE, DAY=86400000", "PRICING_ENGINE.autoDrift(", "PRICING_ENGINE.quoteAt(q,pxCost()", "roster.map(ownerOf)"];

const FIXTURE_NOW = Date.parse("2026-10-16T04:00:00Z");
const pinClock = (w) => { w.Date.now = () => FIXTURE_NOW; };

export async function run({ ok }) {
  const { w } = await openMaster(undefined, { before: pinClock });
  const src = readFileSync(process.env.SALT_MASTER || join(REPO, "master", "salt_command.html"), "utf8");
  const outside = src.replace(/\/\* ==== ENGINE (\w+):[\s\S]*?\/\* ==== END ENGINE \1 ==== \*\//g, "");
  const fixtureText = readFileSync(join(REPO, "test", "fixtures", "pricing-before-s1c.json"), "utf8");

  const snap = pricingSnapshot(w); delete snap.takenAt;
  ok(round(snap) === fixtureText, "S1c-3: pricingSnapshot() on the frozen book is the one the master gave before the cards and drift moved");

  const J = (e) => JSON.parse(String(w.eval("JSON.stringify(" + e + ")")));
  const today = new Date(w.eval("TODAY.getTime()"));
  const keep = w.eval("PROD");
  w.eval("PROD='salt';recompute();");
  const loan = +w.eval("loanDrawUnits()");
  w.eval("PROD=" + JSON.stringify(keep) + ";recompute();");
  const B = J("({sales:sales,purchases:purchases,opening:PROD_OPENING,statedStockBy:statedStockBy,statedStock:STATED_STOCK,supplierReceivable:typeof supplierReceivable!=='undefined'?supplierReceivable:null,"
    + "counts:COUNTS,selfUseLog:selfUseLog,quotes:QUOTES,priceSet:PRICE_SET,costRule:COST_RULE,defaultProd:DEFAULT_PROD,roster:roster,partners:partners,tierOf:TIER_OF,prodOrder:PROD_ORDER})");
  B.loanDrawUnits = () => loan;
  const R = { ...RULES_MOD, ...J("({LADDER:LADDER,PRICE:PRICE,PRICE_LOCK_ON:PRICE_LOCK_ON})") };

  const want = JSON.parse(fixtureText).byProduct;
  const got = JSON.parse(JSON.stringify(SNAPSHOT_ENGINE.pricing(B, R, today)));
  let same = 0, n = 0;
  ok(round(Object.keys(got)) === round(Object.keys(want)) && Object.keys(want).length > 1, "S1c-3: pricing() in node names the fixture's books");
  for (const p of Object.keys(want)) {
    ok(round(Object.keys(got[p] || {})) === round(Object.keys(want[p])), `S1c-3: ${p}: the same fields as the fixture`);
    for (const k of Object.keys(want[p])) {
      n++;
      const good = round(got[p] && got[p][k]) === round(want[p][k]);
      if (good) same++;
      ok(good, `S1c-3: ${p}: ${k} from the engine in node is the fixture's`);
    }
  }
  ok(same === n && n > 0, "S1c-3: every field of every book agrees (" + same + " of " + n + ")");
  ok(Object.values(want).some((b) => b.drift && Object.values(b.drift).includes("partner")) && Object.values(want).some((b) => b.partners && b.partners.length),
    "S1c-3: the fixture holds a partner and a drift, so the comparison is not vacuous");

  for (const f of FUNCS) {
    const defs = outside.match(new RegExp("\\bfunction\\s+" + f + "\\s*\\(", "g")) || [];
    ok(defs.length === 1 && new RegExp("\\nfunction " + f + "\\([^)\\n]*\\)\\{return SNAPSHOT_ENGINE\\.\\w+\\([^\\n{}]*\\);\\}[^\\n]*\\n").test(outside),
      `S1c-3: the master's ${f} is one definition and a one-line delegation`);
  }
  for (const f of CONSTS) {
    ok((outside.match(new RegExp("\\nconst " + f + "=", "g")) || []).length === 1 && new RegExp("\\nconst " + f + "=SNAPSHOT_ENGINE\\." + f + ";\\n").test(outside),
      `S1c-3: the master's ${f} is one definition and the engine's`);
  }
  for (const g of GONE) ok(!outside.includes(g), `S1c-3: the retired body "${g}" is gone from the master's script`);
}
