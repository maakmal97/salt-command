/* test/price-band.mjs: his decisions of 10 Nov 2026, docs/plan-salt-price-band.html, version 1. ONE PRICE BAND FOR SALT.
   1. The Ceiling is a curve on the supplier's price for a 12.5-unit lot, never COGS: RM 200 a unit at half a unit sliding in the log of size to
      RM 100 at 12.5 and RM 83.93 at 100 at an anchor of RM 56, the order total down to RM 5, never under the Floor; it moves with the anchor
      and not with COGS; a rule with no band keeps ceilingX times the COGS Floor.
   2. The Median Price is what it was: the band moves no figure of it at any grid size.
   3. Their % on salt runs -100% (the Floor, what a partner pays) through 0% (the Median) to +100% (the Ceiling) in even percentage steps
      (bandTop, read back by bandPct), down to RM 5, never under the Floor or over the Ceiling, never falling as the % rises; quoteGrid and
      quoteAt walk one path. A stated board keeps -30% to +30%, and each book's range is read off its rule (liftRange, driftOk, rangeSay).
   4. The switch's carry-over: a figure still held from the old curve is read at its place on the band (heldPct) in the snapshot, one set
      since is read as it stands, and setting one back to exactly the old figure is refused while the table lists them (carryClash).
   5. The gates: a salt figure travels as unit "band" and one sent as "pct" is the old form; the tier-set road, the preview and the catalog
      take salt's range and keep a board's; the preview's Ceiling is the walk's.
   Mutations: test/price-band.mutations.json. */
import { frozenBook } from "./frozen.mjs";
import fs from "node:fs";

export async function run({ ok }) {
  const E = (await import("../engine/pricing.mjs")).default;
  const RULES = (await import("../engine/rules.mjs")).default;
  const { pricingFromBook } = await import("../engine/book-inputs.mjs");
  const MI = await import("../src/maker-inputs.js");
  const { draftRow } = await import("../src/drafter.js");
  const TR = RULES.TIER_RULE, R = TR.salt;

  const costIn = (c, share) => Object.assign({ prod: "salt", lockOn: false, lockState: { state: "none", lock: null }, lockBase: null, over: { cost: null, shrink: null },
    lot: { qty: 50, total: c * 50, rate: c, date: "2026-11-09" }, quoteRate: 56, repl: c, freightRate: 0, meanLot: 50, leak: null,
    costRule: { kind: "latestCogs" }, latest: { quote: c * 50, freight: 0, units: 50, rate: c },
    costBasis: { freightPerTrip: { rm: 0 }, txnPerDelivery: { rm: 0 }, deliveredShare: { v: 0.2 } }, attrib: 1, shrinkRate: 0, avgDel: { n: 5, mean: 2 } },
  share == null ? {} : { nrs: { share } });
  const stack = (c, share) => E.costStack(costIn(c, share));
  const pol = (rule) => ({ LADDER: { round: { to: 5, up: true } }, minPerUnit: 0, timePerOrder: 0, lotFloor: {}, floorTo: 5, tierRule: rule });
  const P = pol(R), C = stack(50, 0.213);   /* the day of the switch: COGS RM 50, the Floor's rate RM 60.65 */
  const noBand = Object.assign({}, R); delete noBand.band;
  const board = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6.25, 12.5];

  /* 1. THE CEILING */
  const want = { 0.5: 100, 1: 175, 1.5: 245, 2: 310, 2.5: 375, 3: 430, 4: 540, 5: 640, 6.25: 755, 12.5: 1250, 25: 2365, 50: 4460, 100: 8390 };
  const sizes = Object.keys(want).map(Number).sort((a, b) => a - b);
  const ceil = (q, c = C, p = P) => E.driftAt(q, c, p, 0).ceiling;
  ok(sizes.every((q) => ceil(q) === want[q]), "the Ceiling at an anchor of RM 56 is his table, the order total down to RM 5: " + JSON.stringify(sizes.map((q) => [q, ceil(q)])));
  ok(Math.abs(E.bandCeiling(0.5, R) - 100) < 1e-9 && Math.abs(E.bandCeiling(12.5, R) - 1250) < 1e-9 && Math.abs(E.bandCeiling(100, R) - 8393) < 1e-6
    && Math.abs(E.bandCeiling(200, R) / 200 - 83.93) < 1e-9 && Math.abs(E.bandCeiling(0.25, R) / 0.25 - 200) < 1e-9 && E.bandCeiling(1, noBand) === null,
  "the curve is RM 200 a unit at half a unit, RM 100 at 12.5 and RM 83.93 at 100, flat beyond both ends, and a rule with no band has none: "
    + JSON.stringify([0.25, 0.5, 12.5, 100, 200].map((q) => +(E.bandCeiling(q, R) / q).toFixed(4))));
  ok(sizes.every((q) => ceil(q, stack(64, 0.213)) === Math.max(want[q], E.floorTotal(q, stack(64, 0.213), P))) && ceil(1, stack(44)) === 175,
    "the Ceiling does not move with COGS: at RM 64 and at RM 44 a unit it is the same total, the Floor alone lifting it");
  const dearer = Object.assign({}, R, { band: Object.assign({}, R.band, { ceiling: Object.assign({}, R.band.ceiling, { supplier: { units: 12.5, total: 750 } }) }) });
  ok(ceil(12.5, C, pol(dearer)) === 1335 && ceil(0.5, C, pol(dearer)) === 105 && ceil(1, C, pol(dearer)) === 190,
    "it moves with the supplier's price in proportion: RM 750 for 12.5 makes RM 1,335 at 12.5, RM 105 at half a unit and RM 190 at 1: "
      + JSON.stringify([0.5, 1, 12.5].map((q) => ceil(q, C, pol(dearer)))));
  const steep = stack(50, 3.5);
  ok(E.floorTotal(0.5, steep, P) === 115 && ceil(0.5, steep) === 115 && E.quoteAt(0.5, steep, P, 1) === 115 && E.quoteAt(0.5, steep, P, 0) === 115,
    "a Floor over the curve lifts the Ceiling to itself, and every price sits on it: " + JSON.stringify([E.floorTotal(0.5, steep, P), ceil(0.5, steep), E.quoteAt(0.5, steep, P, 1)]));
  ok(ceil(1, C, pol(noBand)) === 150 && ceil(12.5, C, pol(noBand)) === 1875 && TR.oil.ceilingX === 3 && TR.candy.ceilingX === 3 && TR.rice.ceilingX === 3 && !TR.oil.band && !TR.candy.band,
    "a rule with no band keeps ceilingX times the COGS Floor, and no other book carries a band: " + JSON.stringify([ceil(1, C, pol(noBand)), ceil(12.5, C, pol(noBand))]));

  /* 2. THE MEDIAN DOES NOT MOVE */
  const grid = E.gridSizes(E.gridOf(R));
  const g1 = E.quoteGrid(C, P, 0), g0 = E.quoteGrid(C, pol(noBand), 0);
  ok(grid.length === 399 && g1.p.length === 399 && g1.p.every((v, i) => v === g0.p[i]),
    "the Median at each of salt's 399 grid sizes is what the rule without the band quotes: " + g1.p.filter((v, i) => v !== g0.p[i]).length + " differ");
  ok(JSON.stringify(board.map((q) => E.quoteAt(q, C, P, 0))) === JSON.stringify([75, 120, 170, 225, 275, 320, 420, 510, 625, 995])
    && JSON.stringify(R.points) === JSON.stringify([[0.5, 3], [1, 2.4], [6.25, 2.004], [12.5, 1.596]]),
  "the Median on COGS RM 50 is v1497's, RM 75, 120, 170, 225, 275, 320, 420, 510, 625 and 995: " + JSON.stringify(board.map((q) => E.quoteAt(q, C, P, 0))));

  /* 3. THE SCALE */
  const lr = E.liftRange(R), lo = E.liftRange(TR.oil);
  ok(lr.min === -1 && lr.max === 1 && lo.min === -0.3 && lo.max === 0.3 && E.liftRange(TR.candy).max === 0.3 && E.liftRange(TR.rice).min === -0.3 && E.liftRange(noBand).max === 0.3,
    "salt's % runs -1 to +1 and a stated board's -0.3 to +0.3, each read off its rule: " + JSON.stringify([lr, lo]));
  ok(E.driftOk(-1, R) && E.driftOk(1, R) && E.driftOk(-0.47, R) && !E.driftOk(1.01, R) && !E.driftOk(-1.01, R) && !E.driftOk("0.2", R) && !E.driftOk(NaN, R)
    && E.driftOk(0.3, TR.oil) && !E.driftOk(0.31, TR.oil) && !E.driftOk(-0.47, TR.oil) && !E.driftOk(1, TR.oil),
  "a figure is judged on its book's range: -0.47 is a % on salt and not on oil, 1.01 on neither");
  ok(E.rangeSay(R).pct === "-100% to +100%" && E.rangeSay(R).num === "-1 to 1" && E.rangeSay(TR.oil).pct === "-30% to +30%" && E.rangeSay(TR.oil).num === "-0.3 to 0.3" && E.rangeSay(TR.oil).plain === "-30 to +30",
    "the range in words follows the book: " + JSON.stringify([E.rangeSay(R), E.rangeSay(TR.oil)]));
  const T = (k) => E.bandTop(120, 65, 175, k);
  ok(T(0) === 120 && Math.abs(T(1) - 175) < 1e-9 && Math.abs(T(-1) - 65) < 1e-9 && Math.abs(T(0.2) / T(0.1) - T(0.9) / T(0.8)) < 1e-12 && Math.abs(T(-0.2) / T(-0.1) - T(-0.9) / T(-0.8)) < 1e-12
    && Math.abs(T(0.1) / T(0) - Math.pow(175 / 120, 0.1)) < 1e-12 && Math.abs(T(-0.1) / T(0) - Math.pow(65 / 120, 0.1)) < 1e-12 && T(0.1) > 120 && T(-0.1) < 120,
  "a place on the band is the Median times (Ceiling over Median) to the %, or (Floor over Median) below nought: every 10 points the same percentage step, -100% the Floor, +100% the Ceiling: "
    + JSON.stringify([-1, -0.5, 0, 0.5, 1].map((k) => +T(k).toFixed(2))));
  const B = (p) => Math.round(E.bandPct(p, 65, 120, 175) * 100);
  ok(B(100) === -30 && B(90) === -47 && B(130) === 21 && B(140) === 41 && B(120) === 0 && B(65) === -100 && B(175) === 100 && B(40) === -100 && B(300) === 100,
    "bandPct reads a price back to its place: at 1 unit RM 100 is -30%, RM 90 -47%, RM 130 +21%, RM 140 +41%, held -100% to +100%: " + JSON.stringify([100, 90, 130, 140].map(B)));
  const at1 = [-1, -0.5, -0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3, 0.5, 1].map((k) => E.quoteAt(1, C, P, k));
  ok(JSON.stringify(at1) === JSON.stringify([65, 85, 95, 105, 110, 120, 120, 125, 130, 140, 175]),
    "at 1 unit the scale quotes RM 65, 85, 95, 105, 110, 120, 120, 125, 130, 140 and 175, each place down to RM 5: " + JSON.stringify(at1));
  ok(board.every((q) => E.quoteAt(q, C, P, -1) === E.quoteAt(q, C, P, "partner") && E.quoteAt(q, C, P, -1) === E.floorTotal(q, C, P)) && board.every((q) => E.quoteAt(q, C, P, 1) === ceil(q)),
    "-100% is the Floor, what a partner pays, and +100% is the Ceiling, at every board size: "
      + JSON.stringify(board.map((q) => [q, E.quoteAt(q, C, P, -1), E.quoteAt(q, C, P, 1)])));
  const pcts = []; for (let k = -100; k <= 100; k += 5) pcts.push(k / 100);
  const to25 = grid.filter((q) => q <= 25);
  let out = 0, falls = 0, offGrid = 0;
  const walks = pcts.map((k) => E.driftWalk(to25, C, P, k));
  walks.forEach((w, i) => w.forEach((x, j) => {
    if (x.p < x.floor - 0.009 || x.p > x.ceiling + 0.009) out++;
    if (Math.abs(x.p / 5 - Math.round(x.p / 5)) > 1e-9) offGrid++;
    if (i && x.p < walks[i - 1][j].p - 0.009) falls++;
  }));
  ok(out === 0 && offGrid === 0 && falls === 0, "at every 5% from -100% to +100% and every grid size to 25, the price is on RM 5, between the Floor and the Ceiling, and never falls as the % rises: "
    + JSON.stringify({ out, offGrid, falls, cells: pcts.length * to25.length }));
  /* the laws hold on any cost, also where the Ceiling holds the Median itself (COGS near or past the supplier's price) */
  const law = { cells: 0, out: 0, five: 0, below: 0, above: 0, falls: 0, rate: 0, margin: 0, floorEnd: 0, pinched: 0 };
  for (const [c, share] of [[40, 0], [50, 0.213], [55, 0], [58, 0], [61, 0.1], [64, 0], [73.37, 0], [120, 0]]) {
    const K = stack(c, share || null); let prev = null;
    for (const k of pcts) {
      const w = E.driftWalk(grid, K, P, k); let mg = -Infinity;
      w.forEach((x, i) => {
        law.cells++;
        if (x.p < x.floor - 0.009 || x.p > x.ceiling + 0.009) law.out++;
        if (Math.abs(x.p / 5 - Math.round(x.p / 5)) > 1e-9) law.five++;
        if (k > 0 && x.p < x.set - 0.009) law.below++;
        if (k < 0 && x.p > x.set + 0.009) law.above++;
        if (prev && x.p < prev[i].p - 0.009) law.falls++;
        if (i && x.p / x.q - w[i - 1].p / w[i - 1].q > 5 / x.q + 1e-9) law.rate++;
        const m = x.p - E.floorBase(x.q, K, P);
        if (m < mg - 1e-9 && x.p < x.ceiling - 1e-9 && x.p > x.floor + 5 - 1e-9) law.margin++;   /* a fall the Ceiling's or the Floor's hold does not explain */
        mg = Math.max(mg, m);
        if (k === -1 && x.p !== E.floorTotal(x.q, K, P)) law.floorEnd++;
        if (k === 0 && x.set >= x.ceiling - 0.009) law.pinched++;
      });
      prev = w;
    }
  }
  ok(law.cells === 8 * 41 * 399 && law.pinched > 500 && ['out', 'five', 'below', 'above', 'falls', 'rate', 'margin', 'floorEnd'].every((n) => law[n] === 0),
    'on eight costs, RM 40 to RM 120 a unit, at every 5% and every grid size: on RM 5 between the Floor and the Ceiling, a lift never under the Median and a discount never over it, never falling as the % rises, the quoted rate never rising by a step, the ringgit margin never falling but under a hold, and -100% the Floor itself, also at the ' + law.pinched + ' sizes where the Ceiling holds the Median: ' + JSON.stringify(law));
  ok(E.quoteAt(8.75, C, P, 0) === 790 && E.quoteAt(8.75, C, P, -0.9) === 550 && E.quoteAt(2.75, C, P, 0) === 300 && E.quoteAt(2.75, C, P, -0.95) === 170,
    'the place is struck on the Median as quoted: at 8.75 unit the Median is RM 790 and -90% RM 550, at 2.75 unit RM 300 and -95% RM 170 (the exact multiple would read RM 555 and RM 175): '
      + JSON.stringify([E.quoteAt(8.75, C, P, -0.9), E.quoteAt(2.75, C, P, -0.95)]));
  const gq = E.quoteGrid(C, P, -0.45), gh = E.quoteGrid(C, P, 0.6);
  ok([0.5, 1, 2.75, 6.25, 12.5, 25, 100].every((q) => gq.p[Math.round((q - gq.min) / gq.step)] === E.quoteAt(q, C, P, -0.45) && gh.p[Math.round((q - gh.min) / gh.step)] === E.quoteAt(q, C, P, 0.6))
    && E.quoteAt(1, C, P, -0.45) < 120 && E.quoteAt(1, C, P, 0.6) > 120,
  "quoteGrid and quoteAt walk one path at a % past the old range: " + JSON.stringify([E.quoteAt(1, C, P, -0.45), E.quoteAt(1, C, P, 0.6)]));
  ok(E.quoteAt(1, C, P, 1.5) === 120 && E.quoteAt(1, C, P, -2) === 120, "a figure past the band is no % at all, so it quotes the Median and never an end: " + JSON.stringify([E.quoteAt(1, C, P, 1.5), E.quoteAt(1, C, P, -2)]));

  /* the suggestion on the band: it starts from the median PLACE of their last sales, not under nought, then the risk and the good record as before,
     to the nearest 5% and held to the book's own range; with no places (a board, or the old call) it is the ratio, held -30% to +30% */
  const SG = R.suggest, AU = R.auto, five = { settled: 5 }, rs5 = (v) => [v, v, v, v, v], O = (places) => ({ min: -1, max: 1, places });
  const sp = (sig, ratios, o) => E.suggestPct(sig, ratios, SG, AU, o).pct;
  const perfect = { settled: 10, onTime: 10, perMonth: 4, unitsPerMonth: 10, orders: 12, sinceLastDays: 5 };
  ok(sp(five, rs5(1.2), O([0.4, 0.5, 0.6, 0.5, 0.52])) === 0.5 && sp(five, rs5(1.2), O([0.1, 0.9, 0.3])) === 0.3 && sp(five, rs5(0.9), O(rs5(-0.4))) === 0
    && sp({ ...five, late: true }, rs5(1.2), O(rs5(0.5))) === 0.6 && sp({ ...five, writtenOff: 120 }, rs5(1.2), O(rs5(0.9))) === 1 && sp(perfect, rs5(1), O(rs5(0))) === -0.3
    && sp(perfect, rs5(1.2), O(rs5(0.8))) === 0.5 && sp({ settled: 2 }, rs5(1.5), O(rs5(1))) === 0
    && sp(five, rs5(1.5)) === 0.3 && sp(five, rs5(1.5), { min: -1, max: 1 }) === 0.5 && E.suggestPct(five, rs5(1.2), SG, AU, O(rs5(1))).paidOver === 0.2,
  "the suggestion on the band is the median place of their last sales (0.5; of three 0.3), never under nought, plus the risk (a late +10%, a write-off held at +100%), less a good record (-30% at the Median, +50% from +80%), nought under three settled; with no places it is the ratio, held to the range it is given, and the words keep the ratio paid over: "
    + JSON.stringify([sp(five, rs5(1.2), O([0.4, 0.5, 0.6, 0.5, 0.52])), sp({ ...five, writtenOff: 120 }, rs5(1.2), O(rs5(0.9))), sp(perfect, rs5(1.2), O(rs5(0.8))), sp(five, rs5(1.5), { min: -1, max: 1 })]));

  /* 4. THE CARRY-OVER */
  const carry = R.band.carry, codes = Object.keys(carry);
  ok(codes.length > 0 && codes.every((c) => typeof carry[c].from === "number" && E.driftOk(carry[c].from, noBand) && E.driftOk(carry[c].to, R) && carry[c].from !== carry[c].to
    && Math.sign(carry[c].from) === Math.sign(carry[c].to)),
  "every carried customer has the figure held on the old curve, inside -0.3 to +0.3, and a place on the band of the same sign: " + codes.length);
  const c0 = codes[0], f0 = carry[c0].from, t0 = carry[c0].to;
  ok(E.heldPct(R, c0, f0) === t0 && E.heldPct(R, c0, t0) === t0 && E.heldPct(R, c0, f0 + 0.01) === f0 + 0.01 && E.heldPct(R, "CX9-NIL", f0) === f0
    && E.heldPct(noBand, c0, f0) === f0 && E.heldPct(R, c0, null) === null && E.heldPct(TR.oil, c0, f0) === f0,
  "heldPct reads the old figure at its place, a figure set since as it stands, and nothing for a customer, a book or a rule the table does not list");
  ok(E.carryClash(R, c0, f0) && !E.carryClash(R, c0, t0) && !E.carryClash(R, "CX9-NIL", f0) && !E.carryClash(TR.oil, c0, f0) && !E.carryClash(R, c0, null),
    "carryClash names only a carried customer's own old figure");
  const FB = frozenBook(), NOW = Date.parse("2026-11-10T04:00:00Z");
  const inBook = codes.filter((c) => (FB.roster || []).includes(c));
  const lifts = (tierOf) => pricingFromBook(Object.assign({}, FB, { TIER_OF: tierOf }), NOW).byProduct.salt;
  const cA = inBook[0], other = (FB.roster || []).find((c) => /^C/.test(c) && !codes.includes(c) && !c.endsWith("-R") && !(FB.partners || []).includes(c));
  const sA = lifts({ [cA]: { salt: carry[cA].from }, [other]: { salt: -0.47 } }), sB = lifts({ [cA]: { salt: +(carry[cA].from + 0.01).toFixed(2) }, [other]: { salt: 0.3 } });
  ok(inBook.length > 0 && !!other && sA.lift[cA] === carry[cA].to && sA.lift[other] === -0.47 && sB.lift[cA] === +(carry[cA].from + 0.01).toFixed(2) && sB.lift[other] === 0.3,
    "the snapshot prices a carried customer at their place on the band, one set since as it stands, and a figure past the old range as a % of salt's: "
      + JSON.stringify([cA, sA.lift[cA], sA.lift[other], sB.lift[cA], sB.lift[other]]));
  const cardOf = (s, c, q) => (s.cards[c] || []).find((x) => Math.abs(x[0] - q) < 0.009);
  const KA = E.costStack(sA.inputs.cost);
  ok(!!cardOf(sA, cA, 1) && cardOf(sA, cA, 1)[1] === E.quoteAt(1, KA, sA.inputs.policy, carry[cA].to) && cardOf(sA, other, 1)[1] === E.quoteAt(1, KA, sA.inputs.policy, -0.47),
    "and their card is quoteAt at that place: " + JSON.stringify([cardOf(sA, cA, 1), cardOf(sA, other, 1)]));

  /* 5. THE GATES */
  ok(E.unitOf(R) === "band" && E.unitOf(TR.oil) === "pct" && E.unitOk(R, "band") && !E.unitOk(R, "pct") && !E.unitOk(R, null) && E.unitOk(TR.oil, "pct") && E.unitOk(TR.oil, "band") && !E.unitOk(TR.oil, undefined),
    "a salt figure travels as band and one sent as pct is the old form; a board takes either");
  const polB = (b) => ({ LADDER: { ...RULES.LADDER, ...(RULES.LADDER_BY[b] || {}) }, floorTo: RULES.RULES.floorTo, minPerUnit: 0, timePerOrder: 0, lotFloor: {}, tierRule: TR[b] });
  const oilIn = Object.assign(costIn(7), { prod: "oil", lot: { qty: 10, total: 70, rate: 7, date: "2026-10-01" }, latest: { quote: 70, freight: 0, units: 10, rate: 7 } });
  const book = { version: 9, purchases: [],
    sales: [{ rid: "s1", customer: "CX1-ZED", product: "salt", date: "2026-10-01", qty: 2, total: 200 }],
    state: { PRODUCTS: { salt: { name: "Salt" }, oil: { name: "Oil" } }, roster: ["CX1-ZED", "CX2-ZED", c0, "SP1-ZED", "CP1-ZED"],
      TIER_OF: { "CX1-ZED": { salt: -0.1 }, [c0]: { salt: f0 } }, partners: ["CP1-ZED"], PROD_OPENING: { salt: { qty: 0, costPerKg: null }, oil: { qty: 0, costPerKg: null } }, PEOPLE: { departed: [] } },
    pricing: { byProduct: {
      salt: { stockCost: 50, rungs: [1, 6.25, 12.5], lift: { "CX1-ZED": -0.1, "CX2-ZED": 0, [c0]: t0, "CP1-ZED": "partner" }, suggest: {}, inputs: { cost: costIn(50, 0.213), policy: polB("salt") } },
      oil: { stockCost: 7, rungs: [10, 30, 50], lift: { "CX1-ZED": 0 }, inputs: { cost: oilIn, policy: polB("oil") } } } } };
  const at = "2026-11-10T02:00:00.000Z", ts = (b) => MI.makerTierSet(Object.assign({ at }, b), book);
  const good = ts({ code: "CX1-ZED", product: "salt", tier: -0.6, unit: "band" });
  ok(!good.error && ts({ code: "CX1-ZED", product: "salt", tier: 1, unit: "band" }).error === undefined && /-100% to \+100%/.test(ts({ code: "CX1-ZED", product: "salt", tier: 1.05, unit: "band" }).error || "")
    && /out of date/.test(ts({ code: "CX1-ZED", product: "salt", tier: -0.2, unit: "pct" }).error || "") && !ts({ code: "CX1-ZED", product: "salt", tier: null, unit: "pct" }).error,
  "the tier-set road takes -60% and +100% on salt as band, refuses 105% with salt's range, and a salt figure sent as pct as the old form; a clear needs no unit: "
    + JSON.stringify([good.error, ts({ code: "CX1-ZED", product: "salt", tier: 1.05, unit: "band" }).error, ts({ code: "CX1-ZED", product: "salt", tier: -0.2, unit: "pct" }).error]));
  ok(!ts({ code: "CX2-ZED", product: "oil", tier: -0.3, unit: "pct" }).error && /-30% to \+30%/.test(ts({ code: "CX2-ZED", product: "oil", tier: -0.6, unit: "pct" }).error || ""),
    "a board keeps -30% to +30% on the same road: " + JSON.stringify(ts({ code: "CX2-ZED", product: "oil", tier: -0.6, unit: "pct" }).error));
  ok(/old scale/.test(ts({ code: c0, product: "salt", tier: f0, unit: "band" }).error || "") && ts({ code: c0, product: "salt", tier: f0, unit: "band" }).error === "That is the figure they held on the old scale. Choose 1% either side." && !ts({ code: c0, product: "salt", tier: t0, unit: "band" }).error
    && !ts({ code: "CX1-ZED", product: "salt", tier: f0, unit: "band" }).error,
  "setting a carried customer back to exactly their old figure is refused, their place and anyone else's same figure are not: " + JSON.stringify(ts({ code: c0, product: "salt", tier: f0, unit: "band" }).error));
  const cat = MI.makerInputCatalog(book), ps = cat.products.find((x) => x.product === "salt"), po = cat.products.find((x) => x.product === "oil");
  ok(ps.driftMin === -100 && ps.driftMax === 100 && ps.driftUnit === "band" && po.driftMin === -30 && po.driftMax === 30 && po.driftUnit === "pct"
    && ps.driftPresets.some((x) => x.name === "Median Price" && x.value === 0) && ps.driftPresets.some((x) => x.value === -0.5) && ps.driftPresets.every((x) => E.driftOk(x.value, R))
    && po.driftPresets.some((x) => x.name === "Median Price" && x.value === 0) && po.driftPresets.every((x) => Math.abs(x.value) <= 0.3),
  "the catalog hands Salt Admin each book's range and unit, and the presets name the Median Price: " + JSON.stringify([ps.driftMin, ps.driftMax, ps.driftUnit, po.driftMin, po.driftMax, po.driftUnit]));
  const card = cat.driftCards.find((x) => x.code === c0 && x.product === "salt");
  ok(!!card && card.held && card.value === t0 && card.current === t0, "a carried customer's card shows their place on the band, not the old figure: " + JSON.stringify(card));
  const pv = MI.makerDriftPreview(book, "CX1-ZED", "salt", 0.75), Kb = E.costStack(book.pricing.byProduct.salt.inputs.cost), Pb = book.pricing.byProduct.salt.inputs.policy;
  ok(!pv.error && pv.rows.length > 0 && pv.rows.every((r) => r.ceiling === E.driftAt(r.q, Kb, Pb, 0).ceiling && r.at === E.quoteAt(r.q, Kb, Pb, 0.75) && r.at <= r.ceiling && r.now === E.quoteAt(r.q, Kb, Pb, -0.1))
    && pv.rows.find((r) => r.q === 1).ceiling === 175 && MI.makerDriftPreview(book, "CX1-ZED", "salt", 1).rows.every((r) => r.edge === "ceiling" || r.at < r.ceiling)
    && /-100% to \+100%/.test(MI.makerDriftPreview(book, "CX1-ZED", "salt", 1.2).error || "") && /-30% to \+30%/.test(MI.makerDriftPreview(book, "CX1-ZED", "oil", 0.5).error || ""),
  "the live preview takes a % to +100% on salt, its Ceiling the walk's own (RM 175 at 1 unit), and refuses past each book's range in that book's words: "
    + JSON.stringify(pv.error || pv.rows.map((r) => [r.q, r.now, r.at, r.ceiling])));
  const draft = (pay) => draftRow({ at, id: at, type: "TIER", status: "tierset", payload: Object.assign({ mode: "tierset" }, pay) }, book);
  const dOk = draft({ tiers: { "CX1-ZED": { salt: -0.6 } }, unit: "band" }), dOld = draft({ tiers: { "CX1-ZED": { salt: -0.2 } }, unit: "pct" }),
    dOut = draft({ tiers: { "CX1-ZED": { salt: 1.2 } }, unit: "band" }), dClash = draft({ tiers: { [c0]: { salt: f0 } }, unit: "band" }), dOil = draft({ tiers: { "CX2-ZED": { oil: -0.45 } }, unit: "pct" });
  ok(dOk && dOk.row && dOk.row.unit === "band" && dOk.row.tiers["CX1-ZED"].salt === -0.6 && !(dOk.flags || []).some((f) => /old form/.test(f))
    && dOld && dOld.row && (dOld.flags || []).some((f) => /old form/.test(f)) && /-100 to \+100/.test((dOut && dOut.skip) || "") && /old scale/.test((dClash && dClash.skip) || "")
    && /-30 to \+30/.test((dOil && dOil.skip) || ""),
  "the drafter keeps the band unit on the row, flags a salt figure sent as pct as the old form, and refuses 120% on salt, -45% on oil and a carried customer's old figure: "
    + JSON.stringify([dOk && (dOk.skip || dOk.row.unit), dOld && (dOld.skip || dOld.flags), dOut && dOut.skip, dClash && dClash.skip, dOil && dOil.skip]));

  /* the fold's law is the same law: the band unit is filed, the old form is dropped with a note, and a figure past the book's range is refused */
  const F = await import("../tools/fold.mjs"), A = await import("../engine/apply.mjs"), { nextRid } = await import("../tools/rid.mjs"), { sortBook } = await import("../tools/sort-ledger.mjs");
  const bk = frozenBook(); bk.roster.push("CZ9-DA");
  const stamp = "2026-11-10T03:00:00.000Z", fts = (v, unit, p = "salt") => ({ id: stamp, collection: "tierset", row: { tiers: { "CZ9-DA": { [p]: v } }, unit }, entry: { at: stamp, payload: {} } });
  const plan = (x) => F.plan(bk, { ok: true, count: 1, approved: [x] }, null), fl = (x) => JSON.stringify(x);
  const applied = (x) => A.applyBatch(JSON.parse(JSON.stringify(bk)), { ok: true, count: 1, approved: [x] }, { version: "v0", date: "10 Nov 2026", title: "T", notes: [], rows: { [x.id]: { note: "n", what: "w" } }, stockNote: "s" }, Object.assign(Object.create(F.planCtx), { nextRid, sortBook }));
  const pBand = plan(fts(-0.6, "band")), pOld = plan(fts(-0.2, "pct")), pOut = plan(fts(1.2, "band")), pOil = plan(fts(-0.45, "pct", "oil")), aBand = applied(fts(-0.6, "band")), aOld = applied(fts(-0.2, "pct"));
  ok(pBand.refused.length === 0 && fl(pBand.items[0].tiers) === fl({ "CZ9-DA": { salt: -0.6 } }) && aBand.ok && fl(aBand.book.TIER_OF["CZ9-DA"]) === fl({ salt: -0.6 })
    && pOld.refused.length === 0 && fl(pOld.items[0].tiers) === "{}" && /on the old scale/.test(pOld.items[0].does.join()) && /Median Price at 0%/.test(pOld.items[0].does.join()) && aOld.ok && !(aOld.book.TIER_OF || {})["CZ9-DA"]
    && /-100 to \+100/.test((pOut.refused[0] || {}).why || "") && /-30 to \+30/.test((pOil.refused[0] || {}).why || ""),
  "the fold files -60% on salt sent as band, drops a salt figure sent as pct as set on the old scale, and refuses 120% on salt and -45% on oil in each book's range: "
    + fl([pBand.items[0] && pBand.items[0].tiers, pOld.items[0] && pOld.items[0].does, (pOut.refused[0] || {}).why, (pOil.refused[0] || {}).why]));

  /* the surfaces read the same range: Salt Admin's stepper and the Desk's routes */
  const owner = fs.readFileSync(new URL("../stmt/owner.js", import.meta.url), "utf8"), worker = fs.readFileSync(new URL("../src/worker.js", import.meta.url), "utf8");
  ok(owner.includes("down.disabled=whole<=lim.min; up.disabled=whole>=lim.max;") && owner.includes("unit:punit}") && !/unit:'pct'/.test(owner)
    && worker.includes("whole < -100 || whole > 100"),
  "Salt Admin's stepper stops at the book's own ends and sends the book's unit, and the Desk's preview route takes a whole % to 100");
}
