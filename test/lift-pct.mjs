/* test/lift-pct.mjs: his decision of 18 Oct 2026 (Part 2 of the pricing basis). SALT'S SET PRICE IS THE MINIMUM ON HIS FOUR POINTS, HIS % PER
   CUSTOMER PRICES, AND THE ENGINE ONLY SUGGESTS.
   1. The four points (2.5 at 0.5 unit, 2 at 1, 1.67 at 6.25, 1.33 at 12.5, sliding in the log of size) and the walk from a fixed COGS: the
      Set Price is RM 75, 120, 605 and 980 at 0.5, 1, 6.25 and 12.5 and 1,540 and 1,925 at 20 and 25, the 12.5 unit price lifted from 960
      by the ringgit margin that 11.5 unit had reached.
   2. Over the grid, for every % in use and several costs: the margin in ringgit never falls, no price is under the Floor or over the Ceiling, a
      % of nought or more is never under the Set Price and a negative one never over it, the quoted rate never rises by a grid step or more, a % lifts the points it should.
   3. THE MARGIN LIFT IS PATH DEPENDENT, so quoteGrid and quoteAt must walk one path: quoteGrid(...).p[i] is quoteAt(min + i*step) for every %
      and every grid point, on a made-up cost and on the desk's own, and a partner is floorTotal at every one.
   4. A % is -0.3 to +0.3 (driftOk, LIFT_MIN and LIFT_MAX; his decision of 21 Oct 2026, it was 0 to 2), and nothing automatic prices: customers
      with a long late, a write-off or a perfect record are quoted the Set Price, an old held drift (-0.7) is read as none, and the snapshot
      carries the map as \`lift\`, never \`drift\`, with the suggestion beside it. A negative % quotes under the Set Price, never under the
      Floor, and the ringgit margin still never falls across sizes: -30% at RM 58 is 60, 95, 520, 885, 1,390 and 1,740 on his curve (22 Oct 2026). The presets mirror the range.
   5. The suggestion: paid over the Set Price on the last five sales plus the risk, less a good record's discount (up to 30%, only while nothing
      is late, overdue or written off), to the nearest 5%, held to -30% to +30%, nothing under three settled rows.
   6. The fold DROPS a salt figure stamped before the switch moment (old unit), a tierset and an Add ID alike, with a note and no refusal: the customer
      books on the Set Price at 0%, a tierset of nothing else is a no-op, and one stamped after it is filed as a %.
      Since 19 Oct 2026 the unit is the first gate: a salt figure with no unit "pct" on its row (a page cached from before the deploy, its own clock
      later than the switch) is dropped the same way, and one with it is held.
   10 Nov 2026, THE PRICE BAND (docs/plan-salt-price-band.html, version 1; its own section is test/price-band.mjs): salt's % now runs -100% to +100%
   as a place between the Floor, the Median Price (the Set Price's name since) and the Ceiling, the Ceiling a curve on the supplier's price, and a
   salt figure travels as unit "band". The checks below that walked the old -30% to +30% curve walk the band; a board keeps the old range.
   Mutations: test/lift-pct.mutations.json. */
import { openMaster } from "../tools/payload.mjs";
import { pricingSnapshot } from "../tools/book.mjs";
import SNAPSHOT_ENGINE from "../engine/snapshot.mjs";
import RULES_MOD from "../engine/rules.mjs";
import { readFileSync } from "node:fs";
import { FROZEN_BOOK } from "./frozen.mjs";

const FIXTURE_NOW = Date.parse("2026-10-16T04:00:00Z");
const pinClock = (w) => { w.Date.now = () => FIXTURE_NOW; };

export async function run({ ok }) {
  const E = (await import("../engine/pricing.mjs")).default;
  const O = await import("../src/orders.js");
  const PL = await import("../tools/pricelist.mjs");
  const R = RULES_MOD.TIER_RULE.salt, to = RULES_MOD.LADDER.round.to;
  const P = { LADDER: RULES_MOD.LADDER, floorTo: RULES_MOD.RULES.floorTo, minPerUnit: 0, timePerOrder: 0, lotFloor: {}, tierRule: R };
  const Cof = (c) => ({ eff: c, effEx: c, landed: c });
  const qs = E.gridSizes(E.gridOf(R));
  const PCTS = [-1, -0.5, -0.3, -0.1, 0, 0.1, 0.3, 0.5, 1];   /* 10 Nov 2026: the band's range, both ends in */
  const down5 = (v) => Math.floor(v / 5 + 1e-9) * 5;

  /* 1. THE FOUR POINTS AND THE WALK, on RM 58 a unit */
  const m = (q) => +E.setMultiple(q, R).toFixed(4);
  ok(JSON.stringify(R.points) === "[[0.5,3],[1,2.4],[6.25,2.004],[12.5,1.596]]"
    && [0.5, 1, 6.25, 12.5, 0.25, 25].map(m).join() === "3,2.4,2.004,1.596,3,1.596" && m(2.5) === 2.202,
  "the multiple is 3, 2.4, 2.004 and 1.596 at 0.5, 1, 6.25 and 12.5, flat beyond them, and 2.202 at 2.5 unit, halfway in the log between 1 and 6.25: " + JSON.stringify([0.5, 1, 6.25, 12.5, 0.25, 25, 2.5].map(m)));
  const at = [0.5, 1, 6.25, 12.5, 20, 25];
  const pure = at.map((q) => down5(E.floorTotal(q, Cof(58), P) * E.setMultiple(q, R)));
  const set58 = at.map((q) => E.quoteAt(q, Cof(58), P, 0));
  ok(pure.join() === "90,140,730,1155,1850,2310" && set58.join() === "90,140,730,1155,1850,2310",
    "from RM 58 a unit the floor times the multiple, down to the five, is 90, 140, 730, 1,155, 1,850 and 2,310, and the Set Price needs no margin lift on these sizes (the walk's lift is held by its mutation): " + JSON.stringify({ pure, set58 }));
  const lifted = at.map((q) => E.quoteAt(q, Cof(58), P, 0.2));
  /* 10 Nov 2026, the band: +20% is a fifth of the way, in even percentage steps, from the Median to the Ceiling (100, 175, 755, 1,250, 1,925 and 2,365 here), down to the five */
  const ceil58 = at.map((q) => E.driftAt(q, Cof(58), P, 0).ceiling);
  const want20 = at.map((q, i) => Math.max(set58[i], down5(set58[i] * Math.pow(ceil58[i] / set58[i], 0.2))));
  ok(ceil58.join() === "100,175,755,1250,1925,2365" && lifted.join() === "90,145,730,1170,1860,2320" && lifted.every((p, i) => Math.abs(p - want20[i]) <= 5),
    "and 20% on the band reads 90, 145, 730, 1,170, 1,860 and 2,320 at the same sizes, a fifth of the way from the Median to the Ceiling in even percentage steps, inside the walk: " + JSON.stringify({ lifted, want20, ceil58 }));

  const off30 = at.map((q) => E.quoteAt(q, Cof(58), P, -0.3));
  const fl58 = at.map((q) => E.floorTotal(q, Cof(58), P)), want30 = at.map((q, i) => down5(set58[i] * Math.pow(fl58[i] / set58[i], 0.3)));
  ok(off30.join() === "60,105,590,1000,1605,2005" && off30.every((p, i) => Math.abs(p - want30[i]) <= 5 && p > fl58[i]),
    "and -30% on the band reads 60, 105, 590, 1,000, 1,605 and 2,005 at the same sizes, three tenths of the way from the Median to the Floor (30, 60, 365 at 0.5, 1, 6.25) in even percentage steps, inside the walk and above the Floor: " + JSON.stringify({ off30, want30, fl58 }));

  /* 10 Nov 2026: on the band the Ceiling is the curve, RM 100 at half a unit, and +100% is that Ceiling; a rule with no band keeps ceilingX, where the
     multiple times (1 + %) at +30% (117) is held to 90 under 3 times the Floor of 30, and to 80 under 2.8 times it */
  const NB = (() => { const x = { ...R }; delete x.band; return x; })();
  const P3 = { ...P, tierRule: NB }, P28 = { ...P, tierRule: { ...NB, ceilingX: 2.8 } };
  ok(E.quoteAt(0.5, Cof(58), P28, 0.3) === 80 && E.quoteAt(0.5, Cof(58), P3, 0.3) === 90 && E.quoteAt(0.5, Cof(58), P, 1) === 100 && E.quoteAt(0.5, Cof(58), P, 0.3) === 90,
    "the Ceiling holds a price: with no band +30% at half a unit on RM 58 is 90 (3 times the Floor of 30), held to 80 under 2.8 times it; on the band +100% is the curve's RM 100: " + [E.quoteAt(0.5, Cof(58), P28, 0.3), E.quoteAt(0.5, Cof(58), P3, 0.3), E.quoteAt(0.5, Cof(58), P, 1)].join(", "));

  /* 2. OVER THE GRID, for every % and several costs */
  const bad = { margin: 0, floor: 0, ceiling: 0, five: 0, belowSet: 0, aboveSet: 0, rate: 0, notLifted: 0, notMonotone: 0, notFloor: 0 };
  let n2 = 0;
  for (const c of [31.37, 40, 58, 59, 64, 73.37, 120]) {
    const C = Cof(c);
    let prev = null;
    for (const pct of PCTS) {
      const w = E.driftWalk(qs, C, P, pct);
      let margin = -Infinity;
      w.forEach((r, i) => {
        n2++;
        const mg = r.p - r.floor;
        if (mg < margin - 1e-9 && r.p < r.ceiling - 1e-9) bad.margin++;   /* 10 Nov 2026: but where the Ceiling holds the price (the band's Ceiling rises slower than a high cost's Floor) */
        margin = Math.max(margin, mg);
        if (r.p < r.floor - 1e-9) bad.floor++;
        if (r.p > r.ceiling + 1e-9 || r.ceiling !== Math.max(down5(E.bandCeiling(r.q, R)), r.floor)) bad.ceiling++;
        if (Math.abs(r.p / 5 - Math.round(r.p / 5)) > 1e-9) bad.five++;
        if (pct >= 0 && r.p < r.set - 1e-9) bad.belowSet++;
        if (pct < 0 && r.p > r.set + 1e-9) bad.aboveSet++;
        if (pct === -1 && r.p !== r.floor) bad.notFloor++;
        if (i && r.p / r.q - w[i - 1].p / w[i - 1].q > to / r.q + 1e-9) bad.rate++;
        if (prev && r.p < prev[i].p - 1e-9) bad.notMonotone++;
      });
      if (pct === 0 && w.some((r) => r.p !== r.set)) bad.notLifted++;
      if (pct === 0.3 && c < 70 && !w.some((r) => r.p > r.set)) bad.notLifted++;   /* at RM 73.37 and RM 120 the Ceiling holds the Median at nearly every size, so nothing is left to lift */
      if (pct === -0.3 && !w.some((r) => r.p < r.set)) bad.notLifted++;
      prev = w;
    }
  }
  ok(n2 === 7 * 9 * 399 && Object.values(bad).every((v) => v === 0),
    "over the whole grid, on seven costs and nine places from -100% to +100%: the ringgit margin never falls but under the Ceiling's hold, no price is under the Floor or over the Ceiling (the curve, or the Floor where that is higher), all sit on the five, a % of nought or more is never under the Median Price, a negative one never over it, none is under a smaller %, -100% is the Floor, and the quoted rate never rises by a step: " + JSON.stringify({ n2, ...bad }));
  const rise = (() => { const w = E.driftWalk(qs, Cof(58), P, 0); let mx = 0; w.forEach((r, i) => { if (i) mx = Math.max(mx, (r.p / r.q - w[i - 1].p / w[i - 1].q) * r.q); }); return mx; })();
  ok(rise > 0 && rise < to, "and the rate does rise between some quarters, by under one step of the grid over the size (the law is on the exact rate): " + rise.toFixed(3));

  /* 3. quoteGrid IS quoteAt AT EVERY POINT, for every %, and a partner is the Floor */
  const { w } = await openMaster(undefined, { before: pinClock });
  const snap0 = pricingSnapshot(w), S0 = snap0.byProduct.salt, K = E.costStack(S0.inputs.cost), PP = S0.inputs.policy;
  let disagree = 0, partnerOff = 0, pts = 0;
  for (const [C, PX] of [[Cof(58), P], [Cof(64), P], [Cof(73.37), P], [K, PP]]) {
    for (const pct of PCTS) {
      const g = E.quoteGrid(C, PX, pct);
      g.p.forEach((x, i) => { pts++; if (x !== E.quoteAt(g.min + i * g.step, C, PX, pct)) disagree++; });
    }
    const gp = E.quoteGrid(C, PX, "partner");
    gp.p.forEach((x, i) => { const q = gp.min + i * gp.step; if (x !== E.floorTotal(q, C, PX) || E.quoteAt(q, C, PX, "partner") !== x) partnerOff++; });
  }
  ok(pts === 4 * 9 * 399 && disagree === 0 && partnerOff === 0,
    "quoteGrid(...).p[i] is quoteAt at that size for every % in {-100, -50, -30, -10, 0, 10, 30, 50, 100} and all 399 grid points, on made-up costs and the desk's own, and a partner is floorTotal at every one: " + JSON.stringify({ pts, disagree, partnerOff }));

  /* 4. A % IS -0.3 TO +0.3, AND NOTHING AUTOMATIC PRICES */
  const OIL = RULES_MOD.TIER_RULE.oil;
  ok([-1.01, 1.01, 2, 3, "0.2", NaN, null, undefined].every((v) => !E.driftOk(v, R)) && [-1, -0.3, -0.05, 0, 0.05, 0.3, 1].every((v) => E.driftOk(v, R))
    && [-0.31, -1, 0.31, 1, 2, 3, "0.2", NaN, null, undefined].every((v) => !E.driftOk(v, OIL)) && [-0.3, -0.05, 0, 0.05, 0.3].every((v) => E.driftOk(v, OIL)) && E.LIFT_MIN === -0.3 && E.LIFT_MAX === 0.3,
    "a salt % is a number from -1 to 1 (10 Nov 2026): -1.01, 1.01, 2, 3, a string, NaN, null and nothing are refused, -1, -0.3, 0, 0.3 and 1 are taken; a board's is -0.3 to 0.3, where -0.31, -1, 0.31 and 1 are refused, and LIFT_MIN and LIFT_MAX say so");
  ok(JSON.stringify(R.presets) === JSON.stringify({ "-50%": -0.5, "-30%": -0.3, "-20%": -0.2, "-10%": -0.1, "Median Price": 0, "+10%": 0.1, "+20%": 0.2, "+30%": 0.3, "+50%": 0.5 })
    && Object.values(R.presets).every((v) => E.driftOk(v, R)),
  "Add ID's presets run -50% to +50% with the Median Price at 0, each a valid %: " + JSON.stringify(R.presets));
  /* the book's synthetic customers: the same sales at different records, built on the desk's own book */
  const jj = (e) => JSON.parse(String(w.eval("JSON.stringify(" + e + ")")));
  w.eval("PROD='salt';recompute();");
  const loan = +w.eval("loanDrawUnits()");
  const B = jj("({sales:sales,purchases:purchases,opening:PROD_OPENING,statedStockBy:statedStockBy,statedStock:STATED_STOCK,supplierReceivable:typeof supplierReceivable!=='undefined'?supplierReceivable:null,"
    + "counts:COUNTS,selfUseLog:selfUseLog,quotes:QUOTES,priceSet:PRICE_SET,costRule:COST_RULE,defaultProd:DEFAULT_PROD,roster:roster,partners:partners,tierOf:TIER_OF,prodOrder:PROD_ORDER})");
  B.loanDrawUnits = () => loan;
  const today = new Date(w.eval("TODAY.getTime()"));
  const RR = { ...RULES_MOD };
  const base = SNAPSHOT_ENGINE.pricing(B, RR, today).salt;
  const Kb = E.costStack(base.inputs.cost), Pb = base.inputs.policy;
  const day = (n) => new Date(Date.UTC(2026, 8, 1 + n * 4)).toISOString().slice(0, 10);
  const later = (d, k) => new Date(Date.parse(d) + k * 86400000).toISOString().slice(0, 10);
  const rows = (code, count, mult, lateDays, qty = 1) => Array.from({ length: count }, (_, i) => {
    const d = day(i), paid = later(d, lateDays || 0), total = Math.round(E.quoteAt(qty, Kb, Pb, 0) * mult);
    return { customer: code, qty, total, cash: total, date: d, deliveredQty: qty, deliveredOn: d, paidOn: paid, handover: "collected", cost: 58, rid: code + "-" + i };
  });
  const people = { "CZ9-ON": [5, 1.0, 0], "CZ9-PO": [5, 1.2, 0, 2], "CZ9-LA": [5, 1.0, 10], "CZ9-LP": [5, 1.2, 10], "CZ9-FW": [2, 1.5, 0], "CZ9-LO": [5, 0.9, 0], "CZ9-GD": [12, 1.0, 0] };
  const B2 = JSON.parse(JSON.stringify(B)); B2.loanDrawUnits = () => loan;
  for (const [code, [count, mult, late, qty]] of Object.entries(people)) { B2.roster.push(code); B2.sales.push(...rows(code, count, mult, late, qty)); }
  const withPeople = SNAPSHOT_ENGINE.pricing(B2, RR, today).salt;
  const cardsOf = (id) => JSON.stringify(withPeople.cards[id]);
  ok(cardsOf("CZ9-ON") && ["CZ9-LA", "CZ9-LP", "CZ9-GD", "CZ9-PO", "CZ9-LO", "CZ9-FW"].every((id) => cardsOf(id) === cardsOf("CZ9-ON"))
    && Object.keys(people).every((id) => (withPeople.lift || {})[id] === 0),
  "a customer paying ten days late, one writing a 20% premium, one with twelve on-time orders and one under the Set Price are all quoted the Set Price, none holding a %: " + JSON.stringify(Object.keys(people).map((id) => [id, (withPeople.lift || {})[id]])));
  ok(withPeople.drift === undefined && base.drift === undefined && typeof withPeople.lift === "object" && typeof withPeople.suggest === "object",
    "the snapshot's map is \`lift\` and the engine's suggestion \`suggest\`; no \`drift\` is carried, so an old reader finds nothing and falls back to the board");
  /* a held figure past the band (-1.7, an old drift's range and more) is not a %, and reads as none; a held 20% prices */
  const held = (v) => { const Bh = JSON.parse(JSON.stringify(B2)); Bh.loanDrawUnits = () => loan; Bh.tierOf = { ...Bh.tierOf, "CZ9-ON": { salt: v } }; return SNAPSHOT_ENGINE.pricing(Bh, RR, today).salt; };
  const old = held(-1.7), h20 = held(0.2);
  ok(JSON.stringify(old.cards["CZ9-ON"]) === cardsOf("CZ9-ON") && (old.lift || {})["CZ9-ON"] === 0
    && (h20.lift || {})["CZ9-ON"] === 0.2 && h20.cards["CZ9-ON"].every(([q, x]) => x === E.quoteAt(q, Kb, Pb, 0.2)) && h20.cards["CZ9-ON"].some(([q, x], i) => x > withPeople.cards["CZ9-ON"][i][1]),
  "a held figure of -1.7, past the band, reads as none and quotes the Median Price, and a held 20% quotes its place on the band, size for size: " + JSON.stringify([(old.lift || {})["CZ9-ON"], (h20.lift || {})["CZ9-ON"]]));

  /* 5. THE SUGGESTION */
  const sug = (sig, ratios) => E.suggestPct(sig, ratios, R.suggest, R.auto).pct;
  const rs = (v) => [v, v, v, v, v];
  const ok3 = { settled: 5 };
  ok(sug(ok3, rs(1)) === 0 && sug(ok3, rs(1.1)) === 0.1 && sug(ok3, [1, 1.2, 1.3, 1, 1.4]) === 0.2 && sug(ok3, rs(0.9)) === 0
    && sug({ settled: 2 }, rs(1.5)) === 0 && sug({ settled: 3 }, rs(1.5)) === 0.3 && sug(ok3, []) === 0,
  "paid over the Set Price is the median of the last five less one, never under nought, and nothing is suggested under three settled rows (50% over is held to +30%)");
  ok(sug({ ...ok3, writtenOff: 120 }, rs(1)) === 0.3 && sug({ ...ok3, lateLong: true, late: true }, rs(1)) === 0.2 && sug({ ...ok3, overdueDays: 15 }, rs(1)) === 0.2
    && sug({ ...ok3, overdueDays: 14 }, rs(1)) === 0 && sug({ ...ok3, late: true }, rs(1)) === 0.1 && sug({ ...ok3, writtenOff: 120, lateLong: true, late: true }, rs(1)) === 0.3
    && sug({ ...ok3, writtenOff: 120 }, rs(0.9)) === 0.3,
  "risk is 30% for a write-off, else 20% for a long late or an open overdue past 14 days, else 10% for a late, and the largest alone");
  ok(sug({ ...ok3, late: true }, rs(1.12)) === 0.2 && sug({ ...ok3, late: true }, rs(1.13)) === 0.25 && sug({ ...ok3, writtenOff: 1 }, rs(3)) === 0.3,
  "the sum rounds to the nearest 5% (22% to 20%, 23% to 25%) and is held to +30%");
  /* 21 Oct 2026: a good record earns a discount, only while nothing is late, overdue or written off */
  const perfect = { settled: 10, onTime: 10, perMonth: 4, unitsPerMonth: 10, orders: 12, sinceLastDays: 5 };
  const sgP = E.suggestPct(perfect, rs(1), R.suggest, R.auto);
  ok(sgP.pct === -0.3 && sgP.good === 0.3 && E.suggestWhy(sgP).join() === "good record" && sug(perfect, rs(1.1)) === -0.2
    && sug({ ...perfect, late: true }, rs(1)) === 0.1 && sug({ ...perfect, writtenOff: 120 }, rs(1)) === 0.3 && sug({ ...perfect, overdueDays: 15 }, rs(1)) === 0.2
    && E.suggestPct({ ...perfect, late: true }, rs(1), R.suggest, R.auto).good === 0 && sug({ ...perfect, settled: 2 }, rs(1)) === 0 && sug({ settled: 5 }, rs(1)) === 0,
  "a perfect record suggests -30% with the reason 'good record', paying 10% over with it -20%, any late, overdue or write-off gives no discount, a middling record and under three settled rows nothing: " + JSON.stringify(sgP));
  /* and read off the record by the desk's own readers */
  const sg = withPeople.suggest || {};
  const pc = (id) => sg[id] && sg[id].pct;
  /* 10 Nov 2026, on the band: what they paid is read as a PLACE (bandPct at the sale's own size). Twenty per cent over the Median at 2 unit is past the
     Ceiling on this book's cost, so its place is +100%: less the good record's 25% that is +75%, and with a long late (+20%) it is held at +100% */
  const w2 = E.driftAt(2, Kb, Pb, 0);
  ok(Math.round(w2.set * 1.2) > w2.ceiling && E.bandPct(Math.round(w2.set * 1.2), w2.floor, w2.set, w2.ceiling) === 1
    && pc("CZ9-ON") === -0.2 && pc("CZ9-PO") === 0.75 && pc("CZ9-LA") === 0.2 && pc("CZ9-LP") === 1 && pc("CZ9-FW") === 0 && pc("CZ9-LO") === -0.2 && pc("CZ9-GD") === -0.3,
    "off the record: five on time at the Median Price -20% (a good record), 20% over, which is past the Ceiling at 2 unit, +75% (the Ceiling's +100% less the discount), ten days late 20%, both +100% (held), two orders only 0, under the Median Price -20%, twelve on time -30%: " + JSON.stringify([w2.set, w2.ceiling]) + " " + JSON.stringify(sg["CZ9-ON"] === undefined ? sg : Object.keys(people).map((id) => [id, sg[id]])));
  /* and each carries its reason, the engine's few words (suggestWhy), which Salt Admin shows beside the % */
  ok(sg["CZ9-ON"].why === "good record" && sg["CZ9-PO"].why === "paid 20% over, good record" && sg["CZ9-LA"].why === "paid very late" && /^paid 20% over, paid (very )?late$/.test(sg["CZ9-LP"].why) && sg["CZ9-FW"].why === ""
    && E.suggestWhy({ pct: 0.3, paidOver: 0, risk: 0.3 }).join() === "written off" && E.suggestWhy({ pct: 0.1, paidOver: 0.01, risk: 0.1 }).join() === "paid late",
    "the snapshot's suggestion is {pct, why}: no reason for none, 'good record', 'paid 20% over' less the discount, 'paid very late', both together, and 'written off' for a write-off: " + JSON.stringify(Object.keys(people).map((id) => [id, sg[id]])));
  ok((base.partners || []).length > 0 && (base.partners || []).every((id) => (withPeople.lift || {})[id] === "partner" && sg[id] === undefined),
    "a partner is 'partner' in the lift and has no suggestion");

  /* the readers of the map: the Counter's card off the board, and the customer's sealed grid, read `lift` */
  const id = Object.keys(S0.cards)[0], lift = JSON.parse(JSON.stringify(snap0));
  lift.byProduct.salt.lift = { ...(lift.byProduct.salt.lift || {}), [id]: 0.2 };
  const off = O.cardAt(lift, id, "salt", 3.1);
  ok(off.card === E.quoteAt(3.1, K, PP, 0.2) && off.card > E.quoteAt(3.1, K, PP, 0),
    "the Counter's card at a size off the board is the Set Price lifted by the % in the snapshot's lift: " + JSON.stringify(off));
  const book = JSON.parse(readFileSync(FROZEN_BOOK, "utf8"));
  const list = PL.priceList(id, book, lift, new Date(FIXTURE_NOW)), g = list.products.find((p) => p.product === "salt").grid;
  ok(g && JSON.stringify(g.p) === JSON.stringify(E.quoteGrid(K, PP, 0.2).p),
    "and the customer's sealed grid is quoteGrid at that %");
  const nolift = JSON.parse(JSON.stringify(snap0)); delete nolift.byProduct.salt.lift; nolift.byProduct.salt.drift = { [id]: 0.2 };
  ok(!PL.priceList(id, book, nolift, new Date(FIXTURE_NOW)).products.find((p) => p.product === "salt").grid && O.cardAt(nolift, id, "salt", 3.1).card == null,
    "a snapshot from before, which carries the map as drift, is read as none: no grid and no card off the board, the board alone");

  /* 6. THE DATED GATE, in the fold's plan */
  const F = await import("../tools/fold.mjs"), A = await import("../engine/apply.mjs"), { nextRid } = await import("../tools/rid.mjs"), { sortBook } = await import("../tools/sort-ledger.mjs");
  const bk = JSON.parse(readFileSync(FROZEN_BOOK, "utf8")); bk.roster.push("CZ9-DA");
  const since = RULES_MOD.RULES.liftSince, before = new Date(Date.parse(since) - 3600e3).toISOString(), after = new Date(Date.parse(since) + 3600e3).toISOString();
  const ts = (stamp, v, p = "salt") => ({ id: stamp, collection: "tierset", row: { tiers: { "CZ9-DA": { [p]: v } }, unit: "band" }, entry: { at: stamp, payload: {} } });   /* 10 Nov 2026: a salt figure travels as band; a board takes either */
  const ad = (stamp, v, p = "salt") => ({ id: stamp, collection: "roster", row: { code: "CZ9-DB", kind: "customer", tiers: { [p]: v }, unit: "band" }, entry: { at: stamp, payload: {} } });
  const noUnit = (x) => { const c = JSON.parse(JSON.stringify(x)); delete c.row.unit; return c; };   /* the same entry from a page cached from before the deploy: no unit */
  const plan = (x) => F.plan(bk, { ok: true, count: 1, approved: [x] }, null);
  const why = (x) => (plan(x).refused[0] || {}).why || "";
  const planned = plan(ts(before, 0.3)), plannedAd = plan(ad(before, 0.2)), plannedNeg = plan(ts(before, -0.5)), plannedMix = plan({ id: before, collection: "tierset", row: { tiers: { "CZ9-DA": { salt: 0.3, oil: null } } }, entry: { at: before, payload: {} } });
  const fl = (x) => JSON.stringify(x);
  ok(plannedAd.refused.length === 0 && plannedAd.items.length === 1 && plannedAd.items[0].roster.tiers === null && plannedAd.items[0].roster.register === true
    && plannedAd.items[0].does.some((d) => /dropped the old figure/.test(d) && /stays on the Median Price at 0%/.test(d)),
  "an Add ID stamped before " + since + " carrying a salt figure is not refused: it books with no % and a note saying the old figure was dropped: " + fl(plannedAd.items[0] && plannedAd.items[0].does));
  ok(planned.refused.length === 0 && planned.items.length === 1 && fl(planned.items[0].tiers) === "{}" && planned.items[0].does.length === 1 && /dropped the old figure/.test(planned.items[0].does[0])
    && plannedNeg.refused.length === 0 && fl(plannedNeg.items[0].tiers) === "{}",
  "and a tierset of that salt figure alone, in the old unit (0.3, -0.5), is a no-op that is filed, not refused, with the same note: " + fl([planned.items, plannedNeg.refused]));
  ok(plannedMix.refused.length === 0 && fl(plannedMix.items[0].tiers) === fl({ "CZ9-DA": { oil: null } }),
    "a tierset stamped before it with other content keeps that content and drops only the salt figure: " + fl(plannedMix.items[0] && plannedMix.items[0].tiers));
  const applied = (x) => { const b2 = JSON.parse(JSON.stringify(bk)); return A.applyBatch(b2, { ok: true, count: 1, approved: [x] }, { version: "v0", date: "18 Oct 2026", title: "T", notes: [], rows: { [x.id]: { note: "n", what: "w" } }, stockNote: "s" }, Object.assign(Object.create(F.planCtx), { nextRid, sortBook })); };
  const apOld = applied(ad(before, 0.2)), apNew = applied(ad(after, 0.2)), apTs = applied(ts(before, 0.3));
  ok(apOld.ok && !(apOld.book.TIER_OF || {})["CZ9-DB"] && apOld.book.roster.includes("CZ9-DB")
    && apTs.ok && !(apTs.book.TIER_OF || {})["CZ9-DA"] && apNew.ok && fl((apNew.book.TIER_OF || {})["CZ9-DB"]) === fl({ salt: 0.2 }),
  "folded into the book, the old Add ID registers the customer with no held %, the old tierset holds nothing, and the same figure stamped after the switch is held as 0.2: " + fl([apOld.problems, (apOld.book || {}).TIER_OF && apOld.book.TIER_OF["CZ9-DB"]]));
  /* 19 Oct 2026: THE UNIT IS THE GATE, NOT THE CLOCK. A Salt Admin page cached from before the deploy sends 0.3 (meaning 30% of the floor) with its own
     clock, later than the switch, and no unit: the fold drops it as it drops one stamped before, a tierset and an Add ID alike; with unit "pct" it is the %. */
  const nuTs = plan(noUnit(ts(after, 0.3))), nuAd = plan(noUnit(ad(after, 0.3))), apNuTs = applied(noUnit(ts(after, 0.3))), apNuAd = applied(noUnit(ad(after, 0.3))), apPct = applied(ts(after, 0.3));
  ok(nuTs.refused.length === 0 && nuTs.items.length === 1 && fl(nuTs.items[0].tiers) === "{}" && /dropped the old figure/.test(nuTs.items[0].does.join()) && /without the % unit/.test(nuTs.items[0].does.join())
    && nuAd.refused.length === 0 && nuAd.items[0].roster.tiers === null && nuAd.items[0].roster.register === true && /dropped the old figure/.test(nuAd.items[0].does.join()),
  "a salt figure queued with no unit, stamped after the switch, is dropped with a note and the batch is not refused, a tierset and an Add ID alike: " + fl([nuTs.items[0] && nuTs.items[0].does, nuAd.items[0] && nuAd.items[0].does]));
  ok(apNuTs.ok && !(apNuTs.book.TIER_OF || {})["CZ9-DA"] && apNuAd.ok && apNuAd.book.roster.includes("CZ9-DB") && !(apNuAd.book.TIER_OF || {})["CZ9-DB"]
    && apPct.ok && fl((apPct.book.TIER_OF || {})["CZ9-DA"]) === fl({ salt: 0.3 }),
  "and folded into the book it holds nothing (no 30% lift), where the same figure with its unit (band, since 10 Nov 2026) is held as 0.3: " + fl([apNuTs.problems, (apNuTs.book || {}).TIER_OF && apNuTs.book.TIER_OF["CZ9-DA"], (apPct.book || {}).TIER_OF && apPct.book.TIER_OF["CZ9-DA"]]));
  ok(plan(noUnit(ts(after, null))).refused.length === 0 && fl(plan(noUnit(ts(after, null))).items[0].tiers) === fl({ "CZ9-DA": { salt: null } }) && !why(ts(after, 0.2, "oil")),
  "a clear needs no unit, and a % on oil is filed since 22 Oct 2026 (every book takes Their %): " + fl(plan(noUnit(ts(after, null))).items[0] && plan(noUnit(ts(after, null))).items[0].tiers));
  const pNew = plan(ts(after, 0.3));
  ok(pNew.refused.length === 0 && fl(pNew.items[0].tiers) === fl({ "CZ9-DA": { salt: 0.3 } }) && plan(ts(before, null)).refused.length === 0 && fl(plan(ts(before, null)).items[0].tiers) === fl({ "CZ9-DA": { salt: null } })
    && /not a %/.test(why(ts(after, "Gold", "oil"))),
  "a salt % stamped after " + since + " is filed as it stands, a clear passes, and a level word on oil is refused as no %: " + fl([why(ts(after, "Gold", "oil")), why(ts(after, 0.2, "oil"))]));
  ok(Date.parse(since) > Date.parse("2026-10-17T00:00:00Z") && Date.parse(since) < Date.now() + 2 * 86400e3,
    "the switch moment is an instant at the start of this work, not a date in the future: " + since);
  ok(/not a % from -100 to \+100/.test(why(ts(after, -1.4))) && /not a % from -100 to \+100/.test(why(ts(after, 2.5))) && /not a % from -100 to \+100/.test(why(ts(after, 1.4))) && why(ts(after, 0.3)) === "" && why(ts(after, -0.3)) === "" && why(ts(after, 0)) === ""
    && why(ts(after, -1)) === "" && why(ts(after, 1)) === "" && /not a % from -100 to \+100/.test(why(ad(after, 2))) && why(ad(after, -0.3)) === ""
    && /not a % from -30 to \+30/.test(why(ts(after, -0.4, "oil"))) && /not a % from -30 to \+30/.test(why(ts(after, 0.4, "oil"))) && why(ts(after, -0.3, "oil")) === "",
    "and after it a salt tier entry takes -1 to 1 and refuses -1.4, 1.4 and 2.5, at a tier entry and at Add ID (-0.3 is a valid Add ID figure), and oil keeps -0.3 to 0.3, refusing -0.4 and 0.4: " + JSON.stringify([why(ts(after, -1.4)), why(ts(after, 1.4)), why(ts(after, 2.5)), why(ad(after, 2)), why(ts(after, -0.4, "oil"))]));
  try { w.close(); } catch (e) { /* best effort */ }
}
