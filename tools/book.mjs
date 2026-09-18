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
  /* v589: READ THE COMMITTED COPY, as refunds have since v444. The overlay puts a queued loan into the
     live list, and until v589 it pushed that loan again on every redraw; reading the live list would
     carry an unapproved loan into the store. */
  loans: "BASE_LOANS",
  supplierReceivable: "supplierReceivable",
  /* v444: READ THE COMMITTED COPY, like sales and the board. Until this version the overlay
     never touched this list, so reading it live was safe. A cancelled paid order now books a
     payable into it, which means a queued-but-unapproved cancellation would otherwise put a
     provisional refund into the extract and from there into the store. The census caught it. */
  customerRefunds: "BASE_REFUNDS",
  roster: "roster", associates: "associates", PEOPLE: "PEOPLE",
  /* v615: who introduced whom where no row carries the referral stamp; a fact on his word */
  INTRODUCTIONS: "INTRODUCTIONS",
  /* v633: where each party is on the map, a point to 0.01 degrees filed by Add ID, Amend ID or a place entry; renamed with its code */
  PLACED: "PLACED",
  /* v643: each customer's tier, a level name from TIER_NAMES in the master, set on the phone and folded; renamed with its code */
  TIER_OF: "TIER_OF",
  /* v616 and v618: REWARD_OPENING and CUSTOMER_REWARD_OPENING retired; the whole-ledger recounts replaced them. */
  AWARDS: "AWARDS",
  supplierQuote: "supplierQuote", oilQuote: "oilQuote",
  COST_RULE: "COST_RULE",
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
/* v610, 13 Sep 2026: "to be confirmed" is what TBC stands for, written out. Add ID has filed it as
 * the place of a buyer registered before their location was known, and the note on s134 says the
 * same words about another such buyer, so the scan failed closed on the one row being honest that
 * there is no place to leak. The same reason "tbc" is here. */
export const NAME_STOPWORDS = new Set(["tbc", "to be confirmed", "unknown", "n/a", "na", "none", "-", "general"]);

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
/* v630, HIS DECISION OF 14 SEP 2026: AREA NAMES SHOW ON THE MAP, so an official district, mukim, bandar or pekan name is
 * public geography. This is every form the desk draws one in, lower-cased: the district, an area's short name, and its
 * kind with the name. A leak check exempts a directory word only when it IS one of these, never when it contains one. */
export function areaNameSet(areas) {
  const out = new Set(), cap = (k) => k.charAt(0).toUpperCase() + k.slice(1);
  for (const d of (areas && areas.districts) || []) out.add(d.name.toLowerCase());
  for (const a of (areas && areas.areas) || []) { out.add(a.short.toLowerCase()); if (a.kind) out.add((cap(a.kind) + " " + a.short).toLowerCase()); }
  return out;
}

/* v680, HIS DECISION OF 17 SEP 2026: A PARTY'S LOCALITY IS PUBLIC. It is filed as the third element of the party's point in
 * PLACED and shown on Coverage for everyone, so a directory place that IS a filed locality is not a leak. Lower-cased; a leak
 * check exempts a word only when it equals one, never when it contains one, and a name is never exempted by it. */
export function publishedLocalities(book) {
  const out = new Set();
  for (const g of Object.values((book && book.PLACED) || {})) if (Array.isArray(g) && typeof g[2] === "string" && g[2].trim()) out.add(g[2].trim().toLowerCase());
  return out;
}

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
    let floors = null, repl = null, stockCost = null, inputs = null, sizesHere = sizes, ladder = null;
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
      /* 08 Sep 2026: THE SIZES ARE THIS BOOK'S. `sizes` above was read once before the loop, so
         oil's floors were keyed by salt's 0.5 to 12.5 while oil sells 10 to 50, and the drafter's
         carded fallback for a 30 unit oil order read the 12.5 floor. recompute() has just rebuilt
         PRICE_TIERS for this product; read it now, and carry it so the price list can too. */
      sizesHere = call("PRICE_TIERS && PRICE_TIERS.sizes") || sizes;
      /* v651: Ambassador and the tiers at this book's rungs, the prices the customer's page quotes from */
      ladder = (call("typeof fiveTiersNow==='function'?fiveTiersNow():null") || []).map((r) => ({ q: r.q, prices: r.prices }));
      floors = {};
      for (const q of sizesHere) {
        floors[q] = { floor: numOrNull(call("floorTotal(" + q + ")")) };   // v502: one floor per size
      }
    } catch (e) { /* a product the desk cannot price yields nulls, which the drafter must handle */ }
    finally { if (before != null) { try { w.eval("PROD=" + JSON.stringify(before) + ";if(typeof recompute==='function')recompute();"); } catch (e) { } } }
    byProduct[p] = { stockCost, replCost: repl, floors, inputs, sizes: sizesHere, ladder };
  }

  return {
    takenAt: new Date().toISOString(),
    sizes,
    ref: call("REF"),                       // the markup-on-cost ladder: floor, good, great, ceiling
    floorPct: call("PRICE && PRICE.floorPct"),   // the OTHER floor, a margin on price. See v300.
    shrinkAttrib: call("SHRINK_ATTRIB"),
    tierNames: call("typeof TIER_NAMES!=='undefined'?TIER_NAMES:null"),   // v643: the levels' names, for the drafter's tier check
    /* v651: every customer's tier for each product, the one held on the book or, until he sets one, the one proposed from
       what they pay for it; a product with neither is left out, and their page reads its price as coming soon */
    tierOf: call("(function(){if(typeof tierBoards!=='function')return null;var b=tierBoards(),o={};tierCustomers().forEach(function(id){PROD_IDS.forEach(function(p){var t=(TIER_OF[id]||{})[p]||(typeof ruleProposal==='function'?ruleProposal(id,p,b):tierProposal(id,p,b));if(t){o[id]=o[id]||{};o[id][p]=t;}});});return o;})()"),
    /* v666: how each customer buys each product, the desk's own reading, so the price list and the drafter read the same
       profile the desk shows rather than working one out of their own. Prices nothing yet. */
    profileOf: call("(function(){if(typeof buyerProfile!=='function')return null;var o={},keep=PROD;try{tierCustomers().forEach(function(id){PROD_IDS.forEach(function(p){var f=buyerProfile(id,p);if(f){o[id]=o[id]||{};o[id][p]=f;}});});}finally{PROD=keep;}return o;})()"),
    profileRule: call("typeof PROFILE_RULE!=='undefined'?PROFILE_RULE:null"),
    byProduct
  };
}

/* ---- THE ASSOCIATES' REPORT CARD (v691, his decisions of 18 Sep 2026) -------------------------
 * What each associate did for him and what they have earned, per product, taken from the desk's
 * own readers so nothing is worked out twice: networkStats for the three streams and the stars,
 * rebateApplied for what they have drawn, isDeparted and canRedeem for whether it is theirs to
 * take. It runs the way pricingSnapshot runs, because networkStats reads PROD: set it, read it,
 * put it back.
 *
 * NO MARGIN CROSSES. `marginMine`, `marginIntro`, `marginTotal`, `nMine`, `nIntro`, `r3x` and the
 * reward's own unit are every one of them a margin figure or a divisor of one, and the phone
 * payload dropped `toNext` for exactly that reason at v616. What travels is UNITS and the RM a
 * customer paid, which he already sees on a statement, plus a percentage: `next` is how far
 * through the current unit they are, which is a ratio and not an amount. ASSOC_FIELDS is the
 * whitelist, and the suite reads it against what comes out.
 * CODES ONLY, and nothing from PEOPLE.departed but the fact of it: a reason or a memorial is his
 * note about a person, and this is read on a page a person opens. */
export const ASSOC_FIELDS = ["id", "founder", "rank", "bought", "soldFor", "onward", "introduced",
  "referred", "share", "stars", "departed", "reward"];
export const REWARD_FIELDS = ["earned", "taken", "left", "next", "held"];
export function associateSnapshot(w) {
  const read = reader(w);
  const call = (expr) => { const r = read(expr); return r.ok && typeof r.value !== "undefined" ? r.value : null; };
  const products = call("PROD_ORDER") || ["salt"];
  const before = call("PROD");
  const out = [];
  try {
    for (const p of products) {
      w.eval("PROD=" + JSON.stringify(p) + ";if(typeof recompute==='function')recompute();");
      const rows = JSON.parse(w.eval(`JSON.stringify((function(){
        if(typeof networkStats!=='function') return [];
        return networkStats().map(function(r){
          var taken = typeof rebateApplied==='function' ? +(+rebateApplied(r.id)).toFixed(2) : 0;
          var earned = +(+r.earned).toFixed(2);
          /* how far through the next unit, as a share of one: the unit itself is a margin figure
             and does not travel, so the ratio is worked out here and only the ratio leaves */
          var next = (r.unit && r.toNext != null) ? Math.max(0, Math.min(1, +(1 - r.toNext / r.unit).toFixed(3))) : null;
          return {
            id: r.id,
            founder: r.kind === 'R0',
            rank: r.rNum || null,
            bought: +(+r.direct).toFixed(2),
            soldFor: +(+r.indirect).toFixed(2),
            onward: r.dsResell || 0,
            introduced: +(+r.r3).toFixed(2),
            referred: (r.referrals || []).length,
            share: +(+r.share).toFixed(1),
            stars: r.starN || 0,
            departed: typeof isDeparted==='function' ? !!isDeparted(r.id) : false,
            reward: r.unit == null ? null : {
              earned: earned, taken: taken, left: +(earned - taken).toFixed(2), next: next,
              held: typeof canRedeem==='function' ? !canRedeem(r.id) : false
            }
          };
        });
      })())`));
      out.push({ product: p, name: call("PRODUCTS && PRODUCTS[" + JSON.stringify(p) + "] && PRODUCTS[" + JSON.stringify(p) + "].name") || p, rows });
    }
  } finally {
    if (before != null) { try { w.eval("PROD=" + JSON.stringify(before) + ";if(typeof recompute==='function')recompute();"); } catch (e) { /* the extract goes on */ } }
  }
  return { at: new Date().toISOString(), products: out };
}

/* ---- AN ASSOCIATE'S OWN CARD (v706, his instruction of 18 Sep 2026) ---------------------------
 * "Associates see their own live report card, by month, from the start." That is a DIFFERENT
 * document from associateSnapshot above, which is HIS view of every associate and is served only
 * behind Access: this one is sealed onto one associate's own record and opens with their password.
 * Two functions rather than one, deliberately, because the two audiences are different and the
 * whitelist that guards his card would have to be widened to carry dated lines.
 *
 * WHAT IS LEFT OFF, AND WHY. `share` is a ratio against the WHOLE book's revenue, so an associate
 * holding their own RM and their own share can solve for his total revenue; `stars` are bands of
 * that same share and give a range of it; `rank` is a position among other people. None of the
 * three is theirs to know, and none is needed to tell them what they did. The reward's distance to
 * the next unit travels as a SHARE of one unit, exactly as it does on his card, because the unit
 * is a margin figure. No margin, no cost, no floor, no other party.
 *
 * BY MONTH, FROM THE START, so the lines are DATED and the page filters them with the same month
 * strip a statement uses (v690). Nothing here windows anything: the whole history travels and the
 * reader chooses, which is the rule for everything a customer sees.
 */
export const CARD_LINE_FIELDS = ["date", "kind", "qty", "rm"];
export const CARD_SUM_FIELDS = ["bought", "soldFor", "onward", "introduced", "referred"];

export function associateCard(w, code) {
  const read = reader(w);
  const call = (expr) => { const r = read(expr); return r.ok && typeof r.value !== "undefined" ? r.value : null; };
  const products = call("PROD_ORDER") || ["salt"];
  const before = call("PROD");
  const out = [];
  try {
    for (const p of products) {
      w.eval("PROD=" + JSON.stringify(p) + ";if(typeof recompute==='function')recompute();");
      const one = JSON.parse(w.eval(`JSON.stringify((function(){
        var id = ${JSON.stringify(code)};
        if(typeof networkStats!=='function') return null;
        var r = networkStats().filter(function(x){ return x.id === id; })[0];
        if(!r) return null;
        /* THE LINES ARE THE ROWS THEMSELVES, dated, so the month strip has something to filter.
           Their own purchases and the sales that went through their bucket, and nothing of anybody
           else's: ownerOf maps a bucket back to its owner, which is the one rule for whose a row is. */
        var lines = [];
        /* THE SAME BASIS AS THE SUMMARY ABOVE IT, which is pricedSales: a line a reader can add up
           to something the summary contradicts is worse than no line at all (the lesson of v385).
           A pending order is on their statement, which is where a pending order belongs. */
        (typeof pricedSales !== 'undefined' ? pricedSales : []).forEach(function(s){
          if(s.total == null || s.cancelled) return;
          var mine = (s.customer === id && s.rev !== 'R2');
          var through = (typeof ownerOf === 'function' && ownerOf(s.customer) === id && s.rev === 'R2');
          if(!mine && !through) return;
          lines.push({ date: s.date || null, kind: mine ? 'own' : 'onward',
            qty: +(+(s.qty || 0)).toFixed(3), rm: +(+s.total).toFixed(2) });
        });
        lines.sort(function(a,b){ var x=a.date||'', y=b.date||''; return x<y?1:x>y?-1:0; });
        var taken = typeof rebateApplied === 'function' ? +(+rebateApplied(id)).toFixed(2) : 0;
        var earned = +(+r.earned).toFixed(2);
        var next = (r.unit && r.toNext != null) ? Math.max(0, Math.min(1, +(1 - r.toNext / r.unit).toFixed(3))) : null;
        return {
          summary: {
            bought: +(+r.direct).toFixed(2), soldFor: +(+r.indirect).toFixed(2),
            /* THE COUNT IS THE LINES' OWN, not dsResell, which counts every R2 row including the
               pending and the cancelled: it read 14 above a list of 10. The lesson of v385 is that
               a figure a reader can disprove by looking six lines down is worse than no figure, and
               here the list is right there under it. */
            onward: lines.filter(function(l){ return l.kind === 'onward'; }).length,
            introduced: +(+r.r3).toFixed(2), referred: (r.referrals || []).length
          },
          reward: r.unit == null ? null : {
            earned: earned, taken: taken, left: +(earned - taken).toFixed(2), next: next,
            held: typeof canRedeem === 'function' ? !canRedeem(id) : false
          },
          lines: lines
        };
      })())`));
      if (one) out.push(Object.assign({ product: p,
        name: call("PRODUCTS && PRODUCTS[" + JSON.stringify(p) + "] && PRODUCTS[" + JSON.stringify(p) + "].name") || p,
        unit: call("PRODUCTS && PRODUCTS[" + JSON.stringify(p) + "] && PRODUCTS[" + JSON.stringify(p) + "].unit") || "unit" }, one));
    }
  } finally {
    if (before != null) { try { w.eval("PROD=" + JSON.stringify(before) + ";if(typeof recompute==='function')recompute();"); } catch (e) { /* the extract goes on */ } }
  }
  return out.length ? { at: new Date().toISOString(), products: out } : null;
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
