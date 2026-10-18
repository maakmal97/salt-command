/* test/floor-basis.mjs: his decision of 18 Oct 2026 (Part 1 of the pricing basis). THE FLOOR IS THE ORDER TOTAL ROUNDED UP TO THE NEXT
   RM 5, THE CEILING IS THREE TIMES IT ON EVERY BOOK, AND A PARTNER PAYS THE FLOOR.
   1. floorTotal is costTotal up to the next RM 5 and never down; costTotal is the total to the sen; the multiple is the policy's.
   2. The partner's quote, the snapshot's floors and the drafter's floor are floorTotal at every size of every book, and a partner's grid too.
   3. ceilingX is 3 on salt, oil, candy and rice, and a typed board is held to three times the floor on the book's own grid.
   4. salt's grid is the five, oil's stays the ten, candy's and rice's the ringgit.
   Mutations: test/floor-basis.mutations.json. */
import { FROZEN_BOOK } from "./frozen.mjs";
import fs from "node:fs";

export async function run({ ok }) {
  const E = (await import("../engine/pricing.mjs")).default;
  const RULES = (await import("../engine/rules.mjs")).default;
  const { pricingSnapshot } = await import("../tools/book.mjs");
  const { priceList } = await import("../tools/pricelist.mjs");
  const { floorFor } = await import("../src/drafter.js");
  const { openMaster } = await import("../tools/payload.mjs");

  /* 1. THE ROUNDING, on stacks with a known cost a unit, over sizes whose totals fall on and off a five */
  const base = { prod: "x", lockOn: false, lockState: { state: "none", lock: null }, lockBase: null, over: { cost: null, shrink: null },
    lot: { qty: 10, total: 500, rate: 50, date: "2026-09-01" }, quoteRate: 56, repl: 55, freightRate: 3, meanLot: 10,
    leak: { ratio: 0.25 }, costBasis: { freightPerTrip: { rm: 30 }, txnPerDelivery: { rm: 10 }, deliveredShare: { v: 0.2 } },
    attrib: 1, shrinkRate: 0.1, avgDel: { n: 5, mean: 2 } };
  const cogs = (rate) => E.costStack(Object.assign({}, base, { costRule: { kind: "latestCogs" }, latest: { quote: rate * 10, freight: 0, units: 10, rate } }));
  const P = { LADDER: { round: { to: 5, up: true } }, minPerUnit: 0, timePerOrder: 0, lotFloor: {} };
  const sizes = [0.25, 0.5, 1, 1.5, 2.5, 3, 6.25, 12.5, 25];
  let off = 0, below = 0, notFive = 0, over = 0, exact = 0, n = 0;
  for (const rate of [7, 12.34, 35, 56.01, 58, 64]) {
    const C = cogs(rate);
    for (const q of sizes) {
      n++;
      const c = E.costTotal(q, C, P), f = E.floorTotal(q, C, P);
      if (c !== +(rate * q).toFixed(2)) off++;
      if (f < c - 1e-9) below++;
      if (Math.abs(f / 5 - Math.round(f / 5)) > 1e-9) notFive++;
      if (f - c >= 5 - 1e-9) over++;
      if (c % 5 === 0 && f !== c) exact++;
    }
  }
  ok(n === 54 && off === 0 && below === 0 && notFive === 0 && over === 0 && exact === 0,
    "floorTotal is costTotal up to the next RM 5 and never down, and an exact multiple of five stays; costTotal is COGS times the size to the sen: " + JSON.stringify({ n, off, below, notFive, over, exact }));
  /* the floating point guard: a typed lot floor a hair over RM 35 stays RM 35, a sen over goes to RM 40 */
  const C0 = cogs(0.01), lot = (v) => Object.assign({}, P, { lotFloor: { "1": v } });
  ok(E.floorTotal(1, C0, lot(35)) === 35 && E.floorTotal(1, C0, lot(35.0000001)) === 35 && E.floorTotal(1, C0, lot(35.01)) === 40 && E.floorTotal(1, C0, lot(34.99)) === 35,
    "RM 35 stays RM 35 whether it comes exact or 35.0000001, and RM 35.01 goes to RM 40: " + JSON.stringify([35, 35.0000001, 35.01, 34.99].map((v) => E.floorTotal(1, C0, lot(v)))));
  /* the multiple is the policy's own */
  const ten = Object.assign({}, P, { floorTo: 10 });
  ok(E.floorTotal(1, cogs(64), ten) === 70 && E.floorTotal(1, cogs(64), P) === 65 && RULES.RULES.floorTo === 5,
    "the multiple is the policy's floorTo, and RULES states RM 5: " + JSON.stringify([E.floorTotal(1, cogs(64), ten), E.floorTotal(1, cogs(64), P), RULES.RULES.floorTo]));

  /* 2. THE PARTNER, THE SNAPSHOT AND THE DRAFTER AGREE WITH floorTotal AT EVERY SIZE OF EVERY BOOK */
  const { w } = await openMaster(process.env.SALT_MASTER || undefined);
  const book = JSON.parse(fs.readFileSync(FROZEN_BOOK, "utf8"));
  const snap = pricingSnapshot(w), partner = (book.partners || [])[0];
  const books = ["salt", "oil", "candy", "rice"];
  let pn = 0, offPartner = 0, offGridPartner = 0, offSnap = 0, offDrafter = 0, offList = 0;
  for (const p of books) {
    const s = snap.byProduct[p], C = E.costStack(s.inputs.cost), PP = s.inputs.policy, R = PP.tierRule;
    const qs = Object.keys(s.floors).map(Number).concat(R.rungs);
    for (const q of qs) {
      pn++;
      const F = E.floorTotal(q, C, PP);
      if (E.quoteAt(q, C, PP, "partner") !== F) offPartner++;
      if (s.floors[q] && s.floors[q].floor !== F) offSnap++;
      const fx = floorFor({ pricing: snap }, p, q);
      if (!fx || fx.floor !== F) offDrafter++;
    }
    const g = E.quoteGrid(C, PP, "partner");
    g.p.forEach((x, i) => { if (x !== E.floorTotal(g.min + i * g.step, C, PP)) offGridPartner++; });
    const pl = priceList(partner, book, snap, Date.now()).products.find((x) => x.product === p);
    pl.sizes.forEach((x) => { if (x.price !== E.floorTotal(x.q, C, PP)) offList++; });
    pl.grid.p.forEach((x, i) => { if (x !== E.floorTotal(pl.grid.min + i * pl.grid.step, C, PP)) offList++; });
  }
  ok(pn > 40 && offPartner === 0 && offGridPartner === 0, "the partner's quote and grid are floorTotal, the RM 5 Floor, at every size of every book: " + JSON.stringify({ pn, offPartner, offGridPartner }));
  ok(offSnap === 0 && offDrafter === 0 && offList === 0, "and the snapshot's floors, the drafter's floor and the partner's sealed list are that same figure: " + JSON.stringify({ offSnap, offDrafter, offList }));

  /* 3. THE CEILING IS THREE TIMES THE FLOOR ON EVERY BOOK: the rule's number, the page's, and the engine holding a huge typed price to it */
  ok(books.every((p) => RULES.TIER_RULE[p].ceilingX === 3 && JSON.parse(String(w.eval("JSON.stringify(TIER_RULE." + p + ".ceilingX)"))) === 3),
    "ceilingX is 3 on salt, oil, candy and rice, in the engine's rules and on the page: " + JSON.stringify(books.map((p) => RULES.TIER_RULE[p].ceilingX)));
  let held = 0, cn = 0;
  for (const p of ["oil", "candy", "rice"]) {
    const s = snap.byProduct[p], C = E.costStack(s.inputs.cost), PP = s.inputs.policy, R = PP.tierRule, to = PP.LADDER.round.to;
    const huge = Object.assign({}, R, { fixed: Object.fromEntries(Object.keys(R.fixed).map((k) => [k, 1e6])) });
    for (const x of E.fiveTiers(R.rungs, C, Object.assign({}, PP, { tierRule: huge }))) {
      cn++; const top = x.prices[x.prices.length - 1], F = E.floorTotal(x.q, C, PP);
      if (top === Math.floor(3 * F / to + 1e-9) * to) held++;
    }
  }
  const S = snap.byProduct.salt, CS = E.costStack(S.inputs.cost);
  const wk = E.driftWalk(S.inputs.policy.tierRule.rungs, CS, S.inputs.policy, 1);
  ok(cn > 8 && held === cn && wk.every((r) => Math.abs(r.ceiling - 3 * r.floor) < 0.01),
    "a typed board is held to three times the floor on its own grid, and salt's walk carries a ceiling of three times: " + JSON.stringify({ cn, held, salt: wk.slice(0, 2).map((r) => [r.floor, r.ceiling]) }));

  /* 4. THE GRIDS: salt the five, oil the ten, candy and rice the ringgit */
  ok(JSON.stringify(books.map((p) => snap.byProduct[p].inputs.policy.LADDER.round.to)) === "[5,10,1,1]" && RULES.LADDER.round.to === 5
    && (RULES.LADDER_BY.oil.round || {}).to === 10 && RULES.LADDER_BY.candy.round.to === 1 && RULES.LADDER_BY.rice.round.to === 1,
    "salt's grid is the five, oil's the ten, candy's and rice's the ringgit: " + JSON.stringify(books.map((p) => snap.byProduct[p].inputs.policy.LADDER.round.to)));
}
