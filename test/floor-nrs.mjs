/* test/floor-nrs.mjs: his decision of 10 Nov 2026. SALT'S FLOOR CARRIES THE NON-REVENUE SALT, MEASURED LIVE, AND THE SET PRICE AND
   THE CEILING STAY ON COGS ("Floor first, Set and Ceiling to be determined").
   1. A stack given a share has a Floor rate of COGS times (1 + share); costTotal and effEx stay COGS; a stack given none is as it was.
   2. The Set Price and the Ceiling at every size of salt's grid are the same with a share as without; the Floor and the partner move.
   3. A discount the new Floor overtakes is held at the Floor, never under it.
   4. nrsShare counts the count shortfall, gifts and rewards with reward cover, and written off, over the units paid for; a unit
      settled in kind is paid for; a cancelled row and another book's row count nowhere; each category is the rule's own switch.
   5. On the frozen book salt alone carries a share, its floors are that rate up to the next RM 5, and the drafter reads the same.
   6. The desk's page hands the engine the same walk, so its inputs carry the same share.
   Mutations: test/floor-nrs.mutations.json. */
import { FROZEN_BOOK } from "./frozen.mjs";
import fs from "node:fs";

export async function run({ ok }) {
  const E = (await import("../engine/pricing.mjs")).default;
  const S = (await import("../engine/snapshot.mjs")).default;
  const RULES = (await import("../engine/rules.mjs")).default;
  const { pricingFromBook } = await import("../engine/book-inputs.mjs");
  const { floorFor } = await import("../src/drafter.js");

  const base = { prod: "salt", lockOn: false, lockState: { state: "none", lock: null }, lockBase: null, over: { cost: null, shrink: null },
    lot: { qty: 50, total: 2500, rate: 50, date: "2026-11-09" }, quoteRate: 56, repl: 50, freightRate: 0, meanLot: 50, leak: null,
    costRule: { kind: "latestCogs" }, latest: { quote: 2500, freight: 0, units: 50, rate: 50 },
    costBasis: { freightPerTrip: { rm: 0 }, txnPerDelivery: { rm: 0 }, deliveredShare: { v: 0.2 } }, attrib: 1, shrinkRate: 0, avgDel: { n: 5, mean: 2 } };
  const stack = (share) => E.costStack(Object.assign({}, base, share == null ? {} : { nrs: { share } }));
  const R = RULES.TIER_RULE.salt;
  const P = { LADDER: { round: { to: 5, up: true } }, minPerUnit: 0, timePerOrder: 0, lotFloor: {}, floorTo: 5, tierRule: R };

  /* 1. THE RATE */
  const C0 = stack(null), C2 = stack(0.2);
  ok(C2.floorEx === 60 && C2.nrs === 0.2 && C2.effEx === 50 && E.costTotal(1, C2, P) === 50 && E.costTotal(12.5, C2, P) === 625,
    "a share of 0.2 on COGS RM 50 makes the Floor's rate RM 60, and COGS, effEx and costTotal stay RM 50: " + JSON.stringify([C2.floorEx, C2.nrs, C2.effEx, E.costTotal(1, C2, P), E.costTotal(12.5, C2, P)]));
  ok(E.floorTotal(0.5, C2, P) === 30 && E.floorTotal(1, C2, P) === 60 && E.floorTotal(12.5, C2, P) === 750 && E.floorTotal(1, stack(0.213), P) === 65,
    "the Floor is that rate times the size up to the next RM 5: " + JSON.stringify([0.5, 1, 12.5].map((q) => E.floorTotal(q, C2, P)).concat([E.floorTotal(1, stack(0.213), P)])));
  ok(E.floorBase(1, C2, P) === 50 && E.floorBase(12.5, C2, P) === 625 && E.floorBase(0.5, stack(0.213), P) === 25,
    "floorBase is the COGS Floor whatever the share: " + JSON.stringify([E.floorBase(1, C2, P), E.floorBase(12.5, C2, P), E.floorBase(0.5, stack(0.213), P)]));
  ok(!("floorEx" in C0) && !("nrs" in C0) && !("floorEx" in stack(0)) && !("floorEx" in stack(-0.1)) && E.floorTotal(1, C0, P) === 50 && E.floorTotal(1, C0, P) === E.floorBase(1, C0, P),
    "a stack with no share, a nought or a negative one has no Floor rate of its own and floors at COGS: " + JSON.stringify([Object.keys(C0).includes("floorEx"), E.floorTotal(1, C0, P)]));
  ok(E.floorTotal(1, C2, P, 40) === 40, "a rate a caller states still wins: " + E.floorTotal(1, C2, P, 40));

  /* 2. THE SET PRICE AND THE CEILING DO NOT MOVE; THE FLOOR AND THE PARTNER DO */
  const grid = E.gridSizes(E.gridOf(R)).filter((q) => q <= 25);
  const w0 = E.driftWalk(grid, C0, P, 0), w2 = E.driftWalk(grid, C2, P, 0);
  let setMoved = 0, ceilMoved = 0, floorSame = 0, partnerOff = 0;
  w2.forEach((x, i) => {
    if (x.set !== w0[i].set || x.p !== w0[i].p) setMoved++;
    if (x.ceiling !== w0[i].ceiling) ceilMoved++;
    if (x.floor !== E.floorTotal(x.q, C2, P) || x.floor === w0[i].floor) floorSame++;
    if (E.quoteAt(x.q, C2, P, "partner") !== E.floorTotal(x.q, C2, P)) partnerOff++;
  });
  ok(grid.length === 99 && setMoved === 0 && ceilMoved === 0,
    "at every one of salt's grid sizes to 25 the Set Price and the Ceiling with a share are those without: " + JSON.stringify({ n: grid.length, setMoved, ceilMoved }));
  ok(floorSame === 0 && partnerOff === 0 && E.quoteAt(1, C2, P, "partner") === 60 && E.quoteAt(1, C0, P, "partner") === 50 && E.quoteAt(1, C2, P, 0) === 120,
    "the walk reports the new Floor, a partner pays it, and a stranger still pays the Set Price: " + JSON.stringify({ floorSame, partnerOff, partner: [E.quoteAt(1, C0, P, "partner"), E.quoteAt(1, C2, P, "partner")], set: E.quoteAt(1, C2, P, 0) }));

  /* 3. A DISCOUNT THE FLOOR OVERTAKES IS HELD AT THE FLOOR */
  const low0 = E.quoteAt(12.5, C0, P, -0.3), low2 = E.quoteAt(12.5, C2, P, -0.3), up2 = E.quoteAt(12.5, C2, P, 0.3), up0 = E.quoteAt(12.5, C0, P, 0.3);
  ok(low0 === 900 && low2 === 900 && E.floorTotal(12.5, C2, P) === 750 && E.quoteAt(12.5, stack(0.5), P, -0.3) === E.floorTotal(12.5, stack(0.5), P) && E.floorTotal(12.5, stack(0.5), P) === 940 && up2 === up0,
    "-30% at 12.5 is RM 900 on COGS and over a Floor of RM 750, and is held at the Floor once the Floor passes it (RM 940 at a share of 0.5); +30% does not move: " + JSON.stringify([low0, low2, E.quoteAt(12.5, stack(0.5), P, -0.3), up0, up2]));

  /* 4. THE SHARE, FROM ROWS */
  const sales = [
    { rid: "a", qty: 80, deliveredQty: 80, total: 8000, cash: 8000 },
    { rid: "b", qty: 4, deliveredQty: 4, total: 200, goodwill: true },
    { rid: "c", qty: 2, deliveredQty: 2, total: 200, defaulted: true },
    { rid: "d", qty: 5, deliveredQty: 5, total: 500, cash: 500, coverUnits: 1 },
    { rid: "e", qty: 3, deliveredQty: 3, total: 300, rebate: true, rebateKg: 3 },
    { rid: "f", qty: 9, deliveredQty: 9, total: 450, goodwill: true, cancelled: true },
    { rid: "g", qty: 7, deliveredQty: 7, total: 70, goodwill: true, product: "oil" },
    { rid: "h", qty: 6, deliveredQty: 6, total: 600, cash: 600 }];
  const ctx = (rule) => ({ B: { sales, defaultProd: "salt" }, W: { selfUse: 10, soldUnits: 100 }, R: { RULES: { nrsFloor: rule } } });
  const all = S.nrsShare(ctx({ salt: { shortfall: true, gifts: true, writtenOff: true } }), "salt");
  ok(all && all.shortfall === 10 && all.gifts === 5 && all.writtenOff === 2 && all.paid === 93 && all.share === +(17 / 93).toFixed(6),
    "shortfall 10, gifts and cover 5, written off 2 over 93 paid for, the 3 settled in kind among them: " + JSON.stringify(all));
  const only = (k) => { const r = S.nrsShare(ctx({ salt: k }), "salt"); return r ? r.share : null; };
  ok(only({ shortfall: true }) === +(10 / 93).toFixed(6) && only({ gifts: true }) === +(5 / 93).toFixed(6) && only({ writtenOff: true }) === +(2 / 93).toFixed(6) && only({}) === null,
    "each category counts only where the rule switches it on: " + JSON.stringify([only({ shortfall: true }), only({ gifts: true }), only({ writtenOff: true }), only({})]));
  ok(S.nrsShare(ctx({ oil: { shortfall: true } }), "salt") === null && S.nrsShare(ctx(undefined), "salt") === null
    && JSON.stringify(RULES.RULES.nrsFloor) === JSON.stringify({ salt: { shortfall: true, gifts: true, writtenOff: true } }),
    "a book the rule does not name has no share, and the rule names salt alone with all three: " + JSON.stringify(RULES.RULES.nrsFloor));

  /* 5. THE FROZEN BOOK: SALT ALONE, AND EVERY READER THE SAME FLOOR */
  const book = JSON.parse(fs.readFileSync(FROZEN_BOOK, "utf8"));
  const by = pricingFromBook(book, Date.parse("2026-10-16T04:00:00Z")).byProduct, salt = by.salt, n = salt.inputs.cost.nrs || { share: NaN };
  const K = E.costStack(salt.inputs.cost), up5 = (v) => Math.ceil(v / 5 - 1e-6) * 5;
  let offFloor = 0, offDrafter = 0, under = 0, m = 0;
  for (const q of Object.keys(salt.floors).map(Number)) {
    m++;
    if (salt.floors[q].floor !== up5(+(K.effEx * (1 + n.share) * q).toFixed(2))) offFloor++;
    if (!(salt.floors[q].floor > up5(+(K.effEx * q).toFixed(2)) - 1e-9)) under++;
    const d = floorFor({ pricing: { byProduct: by } }, "salt", q);
    if (!d || d.floor !== salt.floors[q].floor || d.cost !== +(K.effEx * q).toFixed(2)) offDrafter++;
  }
  ok(n && n.share > 0 && Math.abs(n.share - (n.shortfall + n.gifts + n.writtenOff) / n.paid) < 1e-4 && m > 5 && offFloor === 0 && under === 0 && K.floorEx === +(K.effEx * (1 + n.share)).toFixed(6),
    "on the frozen book salt's floors are COGS times (1 + its measured share) up to the next RM 5: " + JSON.stringify({ n, m, offFloor, under, effEx: K.effEx, floorEx: K.floorEx }));
  ok(offDrafter === 0, "the drafter's floor is the snapshot's at every salt size, and its cost stays COGS times the size: " + offDrafter + " of " + m + " differ");
  /* 6. THE PAGE HANDS THE ENGINE THE SAME WALK: the desk's own pxInputs() carries the share pricing() reads from the book alone */
  const { openMaster } = await import("../tools/payload.mjs");
  const { w } = await openMaster(process.env.SALT_MASTER || undefined);
  const page = JSON.parse(String(w.eval("(function(){var k=PROD;PROD='salt';recompute();var r=JSON.stringify(pxInputs().nrs||null);PROD=k;recompute();return r;})()")));
  ok(page && JSON.stringify(page) === JSON.stringify(salt.inputs.cost.nrs),
    "the page's own inputs carry the share the engine reads from the book alone: " + JSON.stringify(page));
  const others = Object.keys(by).filter((p) => p !== "salt");
  ok(others.length >= 3 && others.every((p) => !("nrs" in by[p].inputs.cost) && !("floorEx" in E.costStack(by[p].inputs.cost))),
    "no other book carries a share: " + JSON.stringify(others));
}
