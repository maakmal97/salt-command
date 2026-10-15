/* test/engine-snapshot.mjs: S1c-ii of the Book plan. THE COST GLUE THE PRICING SNAPSHOT READS LIVES IN engine/snapshot.mjs, AND NO FIGURE MOVED.
   1. pricingSnapshot() on the frozen book is byte-identical (takenAt out, rounded to 8 places as in engine-rules.mjs) to the one the master gave at v1126.
   2. For every book, the engine's figures() called in node with no page (the book and rules read out of the page as plain data, today pinned to the
      page's TODAY) give the page's own stockCostFor, replCost, pxInputs, pxPolicy, floorTotal at every size, sizes, shSizes and fiveTiersNow.
   3. The master's own script holds each moved function once, as a one-line delegation to SNAPSHOT_ENGINE, and the retired helpers nowhere.
   Mutations: test/engine-snapshot.mutations.json. */
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { openMaster } from "../tools/payload.mjs";
import { pricingSnapshot } from "../tools/book.mjs";
import SNAPSHOT_ENGINE from "../engine/snapshot.mjs";
import RULES_MOD from "../engine/rules.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const round = (s) => JSON.stringify(s, (k, v) => typeof v === "number" ? Math.round(v * 1e8) / 1e8 : v);
const FUNCS = ["posInputs", "replCost", "pxQuoteRate", "pxFreightRate", "pxLeakCharge", "pxReplRate", "pxShrinkRate", "priceLockState", "latestLot",
  "meanLotQty", "delShare", "avgDelivery", "pxInputs", "pxPolicy", "fiveTiersNow", "ladderFor", "hiddenFor", "setPricesFor", "sizesFor", "shownSizes",
  "shSizes", "countedFor"];
const ARROWS = ["openingFor", "pSales", "pPurch"];
const GONE = ["pxWindowLots", "pxSampleUnits"];

export async function run({ ok }) {
  const { w } = await openMaster();
  const src = readFileSync(process.env.SALT_MASTER || join(REPO, "master", "salt_command.html"), "utf8");
  const outside = src.replace(/\/\* ==== ENGINE (\w+):[\s\S]*?\/\* ==== END ENGINE \1 ==== \*\//g, "");

  const snap = pricingSnapshot(w); delete snap.takenAt;
  ok(round(snap) === readFileSync(join(REPO, "test", "fixtures", "pricing-before-s1c.json"), "utf8"),
    "S1c-ii: pricingSnapshot() on the frozen book is the one the master gave before the glue moved");

  const J = (e) => JSON.parse(String(w.eval("JSON.stringify(" + e + ")")));
  const today = new Date(w.eval("TODAY.getTime()"));
  const B = J("({sales:sales,purchases:purchases,opening:PROD_OPENING,statedStockBy:statedStockBy,statedStock:STATED_STOCK,supplierReceivable:typeof supplierReceivable!=='undefined'?supplierReceivable:null,"
    + "counts:COUNTS,selfUseLog:selfUseLog,quotes:QUOTES,priceSet:PRICE_SET,costRule:COST_RULE,defaultProd:DEFAULT_PROD})");
  const R = { ...RULES_MOD, ...J("({LADDER:LADDER,PRICE:PRICE,PRICE_LOCK_ON:PRICE_LOCK_ON})") };
  const keep = w.eval("PROD");
  const books = J("PROD_ORDER");
  let same = 0, n = 0;
  for (const p of books) {
    w.eval("PROD=" + JSON.stringify(p) + ";recompute();");
    B.loanDrawUnits = (v => () => v)(+w.eval("loanDrawUnits()"));
    const sizes = J("sizesFor(PROD)");
    const page = {
      stockCost: J("stockCostFor(PROD)"), replCost: J("replCost()"), inputs: { cost: J("pxInputs()"), policy: J("pxPolicy()") }, sizes,
      floors: Object.fromEntries(sizes.map((q) => [q, { floor: J("floorTotal(" + q + ")") }])), rungs: J("shSizes()"), ladder: J("fiveTiersNow()")
    };
    const eng = JSON.parse(JSON.stringify(SNAPSHOT_ENGINE.figures(B, R, p, today)));
    for (const k of Object.keys(page)) {
      n++;
      const good = JSON.stringify(page[k]) === JSON.stringify(eng[k]);
      if (good) same++;
      ok(good, `S1c-ii: ${p}: ${k} from the engine in node is the page's own`);
    }
  }
  w.eval("PROD=" + JSON.stringify(keep) + ";recompute();");
  ok(books.length > 1 && same === n, "S1c-ii: every figure of every book agrees (" + same + " of " + n + ")");

  for (const f of FUNCS) {
    const defs = outside.match(new RegExp("\\bfunction\\s+" + f + "\\s*\\(", "g")) || [];
    ok(defs.length === 1 && new RegExp("\\nfunction " + f + "\\([^)]*\\)\\{return SNAPSHOT_ENGINE\\.\\w+\\(snapCtx\\(\\)[^\\n{}]*\\);?\\}[^\\n]*\\n").test(outside),
      `S1c-ii: the master's ${f} is one definition and a one-line delegation`);
  }
  for (const f of ARROWS) {
    ok((outside.match(new RegExp("\\bconst " + f + "=", "g")) || []).length === 1 && new RegExp("\\nconst " + f + "=p=>SNAPSHOT_ENGINE\\.\\w+\\(snapCtx\\(\\)[^\\n{}]*\\);\\n").test(outside),
      `S1c-ii: the master's ${f} is one definition and a one-line delegation`);
  }
  ok(/\nfunction stockCostFor\(p\)\{[^\n]*\n[^\n]*SNAPSHOT_ENGINE\.stockCost\(snapCtx\(\),k\)\);\}/.test(outside), "S1c-ii: stockCostFor keeps its cache and walks through the engine");
  for (const f of GONE) ok(!new RegExp("\\b" + f + "\\b").test(outside), `S1c-ii: ${f} is gone from the master's script`);
}
