/* test/any-quantity.mjs: his decisions of 05 Oct 2026, ANY QUANTITY AT AN AUTOMATIC PRICE. One rule, the engine's quoteAt, priced
   over each book's grid and sealed per customer; the rate never rises across the grid; the Counter's Worker refuses a size off
   the step or over the max (Negotiate alone past it) and a Place with no stamp; the stamp covers the grid; the page reads a
   price off the sealed grid and works nothing out. Run on the live master's own inputs, every code real but never printed in
   a sentence the suite publishes: a failure names the count, never a code. */
import vm from "node:vm";

export async function run({ ok }) {
  const E = (await import("../engine/pricing.mjs")).default;
  const O = await import("../stmt/orders.js");
  const { priceDigest, priceSteps } = await import("../tools/pricelist.mjs");
  const { openMaster } = await import("../tools/payload.mjs");
  const { w } = await openMaster(process.env.SALT_MASTER || undefined);
  const rd = (e) => JSON.parse(String(w.eval("JSON.stringify(" + e + ")")));
  const books = ["salt", "oil", "candy", "rice"];
  const ctx = {};
  for (const p of books) {
    w.eval("setProd(" + JSON.stringify(p) + ");recompute();");
    const R = rd("TIER_RULE[PROD]"), P = { ...rd("pxPolicy()"), tierRule: R }, C = rd("pxCost()");
    const codes = rd("tierCustomers().filter(function(id){return !isPartner(id);})"), drift = rd("(function(){var o={};tierCustomers().forEach(function(id){var d=driftBook(PROD)?driftOf(id,PROD):null;o[id]=d?d.d:0;});return o;})()");
    const cards = rd("(function(){var o={};tierCustomers().forEach(function(id){o[id]=TIER_RULE[PROD].rungs.map(function(q){return cardQuote(id,q);});});return o;})()");
    ctx[p] = { R, P, C, codes, drift, cards };
  }
  w.eval("setProd('salt');recompute();");

  /* 1. ONE RULE: the desk's cardQuote at every rung is the engine's quoteAt, for every account on every book */
  let diff = 0, n1 = 0;
  for (const p of books) { const { R, P, C, codes, drift, cards } = ctx[p];
    for (const id of codes) R.rungs.forEach((q, i) => { n1++; const a = E.quoteAt(q, C, P, drift[id]); if (cards[id][i] == null || Math.abs(a - cards[id][i]) > 0.004) diff++; }); }
  ok(n1 > 100 && diff === 0, "the desk's card at every rung of every book is the engine's quoteAt, for every account: " + diff + " of " + n1 + " differ");

  /* 2. THE WALK ONLY EVER LOWERS A RUNG: against the rungs-only walk (the rule before 05 Oct 2026), a drift book's rung moves
     down or not at all, and a stated board's rung is his typed price exactly */
  const { R: RS, P: PS, C: CS, codes: cs, drift: ds } = ctx.salt;
  const before = (q, d) => { const w0 = E.driftWalk(RS.rungs.filter((r) => r < q - 0.009).concat([q]), CS, PS, d); return E.cardPrice(null, E.floorTotal(q, CS, PS), w0[w0.length - 1].p); };
  let up = 0, down = 0, same = 0;
  for (const id of cs) for (const q of RS.rungs) { const b = before(q, ds[id]), a = E.quoteAt(q, CS, PS, ds[id]); if (a > b + 0.004) up++; else if (a < b - 0.004) down++; else same++; }
  ok(up === 0 && down > 0 && same > 0, "walked over the grid, a salt rung moves down or not at all, never up: " + JSON.stringify({ up, down, same }));
  let typedOff = 0;
  for (const p of ["oil", "candy", "rice"]) { const { R, P, C } = ctx[p]; for (const q of R.rungs) if (E.quoteAt(q, C, P, 0) !== +R.fixed[String(q)]) typedOff++; }
  ok(typedOff === 0, "every rung of a stated board quotes his typed price exactly: " + typedOff + " differ");
  /* the worked example is pinned to the COGS it was worked at, RM 64 a unit (lot p035 of 05 Oct 2026), never the live lot's:
     a new salt lot moves the live board by rule 5 and must not turn this red */
  const C64 = { ...CS, repl: 60, lot: 60, freight: 4, landed: 64, inventoriable: 64, eff: 64, effEx: 64 };
  ok(E.quoteAt(6.25, C64, PS, 0) === 660 && E.quoteAt(1, C64, PS, 0) === 160 && E.quoteAt(12.5, C64, PS, 0) === 1090,
    "the stranger's board at RM 64 COGS: 6.25 unit comes down to RM 660 and 1 and 12.5 unit hold at RM 160 and RM 1,090: " + JSON.stringify([1, 6.25, 12.5].map((q) => E.quoteAt(q, C64, PS, 0))));

  /* 3. THE RATE NEVER RISES across each book's grid, for every account; the one exception is where the floor holds the price
     (the floor's own ten, rule 5), where it can rise by less than a ten over the size */
  let rises = 0, held = 0, pts = 0;
  for (const p of books) { const { P, C, codes, drift } = ctx[p];
    for (const id of codes) { const g = E.quoteGrid(C, P, drift[id]);
      for (let i = 1; i < g.p.length; i++) { pts++; const q0 = g.min + (i - 1) * g.step, q1 = g.min + i * g.step;
        if (g.p[i] / q1 > g.p[i - 1] / q0 + 1e-9) { const lift = Math.ceil((E.floorTotal(q1, C, P) - 0.009) / 10) * 10;
          if (g.p[i] === lift && g.p[i] - (g.p[i - 1] / q0) * q1 < 10) held++; else rises++; } } } }
  ok(pts > 5000 && rises === 0, "the rate never rises from one grid point to the next on any book, the floor's own ten apart: " + JSON.stringify({ rises, held, pts }));

  /* 4. THE GRID IS quoteAt AT EVERY POINT, one walk a book; and a book's grid is its TIER_RULE's {min, step, max} */
  let gridOff = 0;
  for (const p of books) { const { P, C, codes, drift } = ctx[p];
    for (const id of codes.slice(0, 6)) { const g = E.quoteGrid(C, P, drift[id]); g.p.forEach((x, i) => { if (Math.abs(x - E.quoteAt(g.min + i * g.step, C, P, drift[id])) > 0.004) gridOff++; }); } }
  const shape = books.map((p) => { const g = E.quoteGrid(ctx[p].C, ctx[p].P, 0); return [g.min, g.step, g.max, g.p.length]; });
  ok(gridOff === 0 && JSON.stringify(shape) === "[[0.5,0.25,25,99],[10,1,50,41],[1,1,30,30],[1,1,10,10]]",
    "each point of a sealed grid is quoteAt at its size, over salt 0.5 to 25 in quarters, oil 10 to 50, candy 1 to 30 and rice 1 to 10: " + JSON.stringify({ gridOff, shape }));

  /* 5. THE WORKER: a size off the step or over the max is refused, over the max is Negotiate's alone, and with no steps
     (a list from before the grid) any size is taken as before */
  const steps = { salt: { min: 0.5, step: 0.25, max: 25 } }, at = "2026-10-05T02:00:00.000Z";
  const body = (x) => Object.assign({ product: "salt", qty: 6.75, mode: "collect", unit: 104, total: 702, week: "" }, x);
  const cOn = O.checkPlacement(body(), [], at, false, steps), cOff = O.checkPlacement(body({ qty: 6.8, total: 707 }), [], at, false, steps);
  const cOver = O.checkPlacement(body({ qty: 30, total: 3000 }), [], at, false, steps), cAsk = O.checkPlacement(body({ qty: 30, total: 0, unit: 0, ask: true }), [], at, false, steps);
  const cOld = O.checkPlacement(body({ qty: 6.8, total: 707 }), [], at, false, null);
  ok(!cOn.error && cOff.code === "offStep" && cOver.code === "overMax" && !cAsk.error && cAsk.order.total === 0 && cAsk.ask.state === "asked" && !cOld.error,
    "6.75 unit is on the salt grid, 6.8 is off its step, 30 is over its max unless asked for, and a list with no steps takes any size: "
    + JSON.stringify([cOn.error || "ok", cOff.code, cOver.code, cAsk.error || "ok", cOld.error || "ok"]));
  /* a Place with no stamp against a stamped list is refused, as a moved one is */
  const noStamp = O.decidePlace("ab12-cd34", body(), [], at, "d-one", "customer", null, { steps }), stamped = O.decidePlace("ab12-cd34", body({ digest: "d-one" }), [], at, "d-one", "customer", null, { steps });
  ok(noStamp.error === O.PRICES_MOVED && stamped.ev, "a Place with no stamp is refused as moved against a stamped list, and the stamped one placed: " + JSON.stringify([noStamp.error, !!stamped.ev]));

  /* 6. THE STAMP COVERS THE GRID: one point moved re-quotes; the steps travel in the clear, with no price */
  const list = { products: [{ product: "salt", sizes: [{ q: 1, price: 150 }], grid: { min: 0.5, step: 0.25, max: 25, p: Array.from({ length: 99 }, (_, i) => 100 + i) } }] };
  const moved = JSON.parse(JSON.stringify(list)); moved.products[0].grid.p[40] -= 10;
  const st = priceSteps(list);
  ok(priceDigest(list, "k", "u") !== priceDigest(moved, "k", "u") && JSON.stringify(st) === JSON.stringify({ salt: { min: 0.5, step: 0.25, max: 25 } }),
    "a price moved at one grid point moves the stamp, and the steps in the clear carry no price: " + JSON.stringify(st));

  /* 7. THE PAGE READS THE GRID: priceAt off the sealed points, a board size off the grid by its row, nothing past the max */
  const { landingPage } = await import("../stmt/page.js");
  const html = landingPage(null, "n0nce", false, null), a0 = html.indexOf("function gridOf(P)"), a1 = html.indexOf("function overMax(P,q)");
  const src = html.slice(a0, html.indexOf("\n", a1));
  const pg = {}; vm.createContext(pg); vm.runInContext(src, pg);
  const P0 = { sizes: [{ q: 0.25, price: 40 }, { q: 1, price: 150 }], grid: { min: 0.5, step: 0.25, max: 25, p: Array.from({ length: 99 }, (_, i) => 1000 + i) } };
  const got = [pg.priceAt(P0, 6.75), pg.priceAt(P0, 1), pg.priceAt(P0, 0.25), pg.priceAt(P0, 6.8), pg.priceAt(P0, 30), pg.overMax(P0, 30), pg.overMax(P0, 6.75), pg.overMax(P0, 1000), pg.overMax(P0, 1001)];
  ok(a0 > 0 && JSON.stringify(got) === JSON.stringify([1025, 1002, 40, null, null, true, false, true, false]),
    "the page's priceAt reads 6.75 unit off the grid (not the board), a size off the grid off its board row, and nothing off the step or past the max, an ask capped at the Worker's 1,000 units: " + JSON.stringify(got));
  /* 8. THE DESK (06 Oct 2026): an order whose ask closed (No thanks, or his withdrawal) is a New one again at its listed price,
     his Accept as ever; an ask still open is his Asked act */
  const acts = JSON.parse(String(w.eval(`(function(){ORD_OPEN=[
    {id:'o1',u:'x',code:'CX1-AB',status:'placed',qty:2,total:200,product:'salt',mode:'collect',at:'2026-10-06T01:00:00Z',yes:'offer',price:{state:'passed',passedAt:'2026-10-06T02:00:00Z'},history:[],msgs:[]},
    {id:'o2',u:'x',code:'CX1-AB',status:'placed',qty:2,total:200,product:'salt',mode:'collect',at:'2026-10-06T01:00:00Z',price:{state:'asked',askedAt:'2026-10-06T01:00:00Z'},history:[],msgs:[]}];
    return JSON.stringify(ordActs().map(function(a){return a.o.id+':'+a.kind;}).sort());})()`)));
  ok(JSON.stringify(acts) === JSON.stringify(["o1:new", "o2:asked"]), "on the desk an ask closed by No thanks is a New order again, and an open ask his Asked act: " + JSON.stringify(acts));
}
