/* test/lift-pct.mjs: his decision of 18 Oct 2026 (Part 2 of the pricing basis). SALT'S SET PRICE IS THE MINIMUM ON HIS FOUR POINTS, HIS % PER
   CUSTOMER PRICES, AND THE ENGINE ONLY SUGGESTS.
   1. The four points (2.5 at 0.5 unit, 2 at 1, 1.67 at 6.25, 1.33 at 12.5, sliding in the log of size) and the walk from a fixed COGS: the
      Set Price is RM 75, 120, 605 and 980 at 0.5, 1, 6.25 and 12.5 and 1,540 and 1,925 at 20 and 25, the 12.5 unit price lifted from 960
      by the ringgit margin that 11.5 unit had reached.
   2. Over the grid, for every % in use and several costs: the margin in ringgit never falls, no price is under the Floor or over the Ceiling, a
      % is never under the Set Price, the quoted rate never rises by a grid step or more, a % lifts the points it should.
   3. THE MARGIN LIFT IS PATH DEPENDENT, so quoteGrid and quoteAt must walk one path: quoteGrid(...).p[i] is quoteAt(min + i*step) for every %
      and every grid point, on a made-up cost and on the desk's own, and a partner is floorTotal at every one.
   4. A % is 0 to 2 (driftOk), and nothing automatic prices: customers with a long late, a write-off or a perfect record are quoted the Set
      Price, an old held drift (-0.7) is read as none, and the snapshot carries the map as \`lift\`, never \`drift\`, with the suggestion beside it.
   5. The suggestion: paid over the Set Price on the last five sales plus the risk, to the nearest 5%, nothing under three settled rows.
   6. The fold DROPS a salt figure stamped before the switch moment (old unit), a tierset and an Add ID alike, with a note and no refusal: the customer
      books on the Set Price at 0%, a tierset of nothing else is a no-op, and one stamped after it is filed as a %.
      Since 19 Oct 2026 the unit is the first gate: a salt figure with no unit "pct" on its row (a page cached from before the deploy, its own clock
      later than the switch) is dropped the same way, and one with it is held.
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
  const PCTS = [0, 0.05, 0.1, 0.2, 0.3, 1, 2];
  const down5 = (v) => Math.floor(v / 5 + 1e-9) * 5;

  /* 1. THE FOUR POINTS AND THE WALK, on RM 58 a unit */
  const m = (q) => +E.setMultiple(q, R).toFixed(4);
  ok(JSON.stringify(R.points) === "[[0.5,2.5],[1,2],[6.25,1.67],[12.5,1.33]]"
    && [0.5, 1, 6.25, 12.5, 0.25, 25].map(m).join() === "2.5,2,1.67,1.33,2.5,1.33" && m(2.5) === 1.835,
  "the multiple is 2.5, 2, 1.67 and 1.33 at 0.5, 1, 6.25 and 12.5, flat beyond them, and 1.835 at 2.5 unit, halfway in the log between 1 and 6.25: " + JSON.stringify([0.5, 1, 6.25, 12.5, 0.25, 25, 2.5].map(m)));
  const at = [0.5, 1, 6.25, 12.5, 20, 25];
  const pure = at.map((q) => down5(E.floorTotal(q, Cof(58), P) * E.setMultiple(q, R)));
  const set58 = at.map((q) => E.quoteAt(q, Cof(58), P, 0));
  ok(pure.join() === "75,120,605,960,1540,1925" && set58.join() === "75,120,605,980,1540,1925",
    "from RM 58 a unit the floor times the multiple, down to the five, is 75, 120, 605, 960, 1,540 and 1,925, and the Set Price lifts 12.5 unit to 980 by the margin 11.5 unit reached: " + JSON.stringify({ pure, set58 }));
  const lifted = at.map((q) => E.quoteAt(q, Cof(58), P, 0.2));
  ok(lifted.join() === "90,140,730,1155,1850,2310", "and 20% on the Set Price reads 90, 140, 730, 1,155, 1,850 and 2,310 at the same sizes, applied inside the walk: " + JSON.stringify(lifted));

  /* 2. OVER THE GRID, for every % and several costs */
  const bad = { margin: 0, floor: 0, ceiling: 0, five: 0, belowSet: 0, rate: 0, notLifted: 0, notMonotone: 0 };
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
        if (mg < margin - 1e-9) bad.margin++;
        margin = Math.max(margin, mg);
        if (r.p < r.floor - 1e-9) bad.floor++;
        if (r.p > down5(3 * r.floor) + 1e-9) bad.ceiling++;
        if (Math.abs(r.p / 5 - Math.round(r.p / 5)) > 1e-9) bad.five++;
        if (r.p < r.set - 1e-9) bad.belowSet++;
        if (i && r.p / r.q - w[i - 1].p / w[i - 1].q > to / r.q + 1e-9) bad.rate++;
        if (prev && r.p < prev[i].p - 1e-9) bad.notMonotone++;
      });
      if (pct === 0 && w.some((r) => r.p !== r.set)) bad.notLifted++;
      if (pct === 0.2 && !w.some((r) => r.p > r.set)) bad.notLifted++;
      prev = w;
    }
  }
  ok(n2 === 7 * 7 * 99 && Object.values(bad).every((v) => v === 0),
    "over the whole grid, on seven costs and every % in use: the ringgit margin never falls, no price is under the Floor or over the Ceiling, all sit on the five, a % is never under the Set Price nor under a smaller %, and the quoted rate never rises by a step: " + JSON.stringify({ n2, ...bad }));
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
  ok(pts === 4 * 7 * 99 && disagree === 0 && partnerOff === 0,
    "quoteGrid(...).p[i] is quoteAt at that size for every % in {0, 5, 10, 20, 30, 100, 200} and all 99 grid points, on made-up costs and the desk's own, and a partner is floorTotal at every one: " + JSON.stringify({ pts, disagree, partnerOff }));

  /* 4. A % IS 0 TO 2, AND NOTHING AUTOMATIC PRICES */
  ok([-0.1, -1, 2.1, 3, "0.2", NaN, null, undefined].every((v) => !E.driftOk(v)) && [0, 0.05, 1, 2].every((v) => E.driftOk(v)),
    "a % is a number from 0 to 2: -0.1, -1, 2.1, 3, a string, NaN, null and nothing are refused, 0, 0.05, 1 and 2 are taken");
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
  /* an old held drift (-0.7) is not a %, and reads as none; a held 20% prices */
  const held = (v) => { const Bh = JSON.parse(JSON.stringify(B2)); Bh.loanDrawUnits = () => loan; Bh.tierOf = { ...Bh.tierOf, "CZ9-ON": { salt: v } }; return SNAPSHOT_ENGINE.pricing(Bh, RR, today).salt; };
  const old = held(-0.7), h20 = held(0.2);
  ok(JSON.stringify(old.cards["CZ9-ON"]) === cardsOf("CZ9-ON") && (old.lift || {})["CZ9-ON"] === 0
    && (h20.lift || {})["CZ9-ON"] === 0.2 && h20.cards["CZ9-ON"].every(([q, x]) => x === E.quoteAt(q, Kb, Pb, 0.2)) && h20.cards["CZ9-ON"].some(([q, x], i) => x > withPeople.cards["CZ9-ON"][i][1]),
  "an old held drift of -0.7 reads as none and quotes the Set Price, and a held 20% quotes the Set Price lifted 20%, size for size: " + JSON.stringify([(old.lift || {})["CZ9-ON"], (h20.lift || {})["CZ9-ON"]]));

  /* 5. THE SUGGESTION */
  const sug = (sig, ratios) => E.suggestPct(sig, ratios, R.suggest).pct;
  const rs = (v) => [v, v, v, v, v];
  const ok3 = { settled: 5 };
  ok(sug(ok3, rs(1)) === 0 && sug(ok3, rs(1.1)) === 0.1 && sug(ok3, [1, 1.2, 1.3, 1, 1.4]) === 0.2 && sug(ok3, rs(0.9)) === 0
    && sug({ settled: 2 }, rs(1.5)) === 0 && sug({ settled: 3 }, rs(1.5)) === 0.5 && sug(ok3, []) === 0,
  "paid over the Set Price is the median of the last five less one, never under nought, and nothing is suggested under three settled rows");
  ok(sug({ ...ok3, writtenOff: 120 }, rs(1)) === 0.3 && sug({ ...ok3, lateLong: true, late: true }, rs(1)) === 0.2 && sug({ ...ok3, overdueDays: 15 }, rs(1)) === 0.2
    && sug({ ...ok3, overdueDays: 14 }, rs(1)) === 0 && sug({ ...ok3, late: true }, rs(1)) === 0.1 && sug({ ...ok3, writtenOff: 120, lateLong: true, late: true }, rs(1)) === 0.3
    && sug({ ...ok3, writtenOff: 120 }, rs(0.9)) === 0.3,
  "risk is 30% for a write-off, else 20% for a long late or an open overdue past 14 days, else 10% for a late, and the largest alone");
  ok(sug({ ...ok3, late: true }, rs(1.12)) === 0.2 && sug({ ...ok3, late: true }, rs(1.13)) === 0.25 && sug({ ...ok3, writtenOff: 1 }, rs(3)) === 2
    && sug({ ...ok3, onTime: 5, perMonth: 9, unitsPerMonth: 30, orders: 30 }, rs(1)) === 0,
  "the sum rounds to the nearest 5% (22% to 20%, 23% to 25%), is held to 200%, and a good record suggests nothing");
  /* and read off the record by the desk's own readers */
  const sg = withPeople.suggest || {};
  const pc = (id) => sg[id] && sg[id].pct;
  ok(pc("CZ9-ON") === 0 && pc("CZ9-PO") === 0.2 && pc("CZ9-LA") === 0.2 && pc("CZ9-LP") === 0.4 && pc("CZ9-FW") === 0 && pc("CZ9-LO") === 0 && pc("CZ9-GD") === 0,
    "off the record: on time at the Set Price 0, 20% over 20%, ten days late 20%, both 40%, two orders only 0, under the Set Price 0, twelve on time 0: " + JSON.stringify(sg["CZ9-ON"] === undefined ? sg : Object.keys(people).map((id) => [id, sg[id]])));
  /* and each carries its reason, the engine's few words (suggestWhy), which Counter Admin shows beside the % */
  ok(sg["CZ9-ON"].why === "" && sg["CZ9-PO"].why === "paid 20% over" && sg["CZ9-LA"].why === "paid very late" && /^paid 20% over, paid (very )?late$/.test(sg["CZ9-LP"].why) && sg["CZ9-GD"].why === ""
    && E.suggestWhy({ pct: 0.3, paidOver: 0, risk: 0.3 }).join() === "written off" && E.suggestWhy({ pct: 0.1, paidOver: 0.01, risk: 0.1 }).join() === "paid late",
    "the snapshot's suggestion is {pct, why}: no reason for none, 'paid 20% over', 'paid very late', both together, and 'written off' for a write-off: " + JSON.stringify(Object.keys(people).map((id) => [id, sg[id]])));
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
  const ts = (stamp, v, p = "salt") => ({ id: stamp, collection: "tierset", row: { tiers: { "CZ9-DA": { [p]: v } }, unit: "pct" }, entry: { at: stamp, payload: {} } });
  const ad = (stamp, v, p = "salt") => ({ id: stamp, collection: "roster", row: { code: "CZ9-DB", kind: "customer", tiers: { [p]: v }, unit: "pct" }, entry: { at: stamp, payload: {} } });
  const noUnit = (x) => { const c = JSON.parse(JSON.stringify(x)); delete c.row.unit; return c; };   /* the same entry from a page cached from before the deploy: no unit */
  const plan = (x) => F.plan(bk, { ok: true, count: 1, approved: [x] }, null);
  const why = (x) => (plan(x).refused[0] || {}).why || "";
  const planned = plan(ts(before, 0.3)), plannedAd = plan(ad(before, 0.2)), plannedNeg = plan(ts(before, -0.5)), plannedMix = plan({ id: before, collection: "tierset", row: { tiers: { "CZ9-DA": { salt: 0.3, oil: null } } }, entry: { at: before, payload: {} } });
  const fl = (x) => JSON.stringify(x);
  ok(plannedAd.refused.length === 0 && plannedAd.items.length === 1 && plannedAd.items[0].roster.tiers === null && plannedAd.items[0].roster.register === true
    && plannedAd.items[0].does.some((d) => /dropped the old figure/.test(d) && /stays on the Set Price at 0%/.test(d)),
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
  /* 19 Oct 2026: THE UNIT IS THE GATE, NOT THE CLOCK. A Counter Admin page cached from before the deploy sends 0.3 (meaning 30% of the floor) with its own
     clock, later than the switch, and no unit: the fold drops it as it drops one stamped before, a tierset and an Add ID alike; with unit "pct" it is the %. */
  const nuTs = plan(noUnit(ts(after, 0.3))), nuAd = plan(noUnit(ad(after, 0.3))), apNuTs = applied(noUnit(ts(after, 0.3))), apNuAd = applied(noUnit(ad(after, 0.3))), apPct = applied(ts(after, 0.3));
  ok(nuTs.refused.length === 0 && nuTs.items.length === 1 && fl(nuTs.items[0].tiers) === "{}" && /dropped the old figure/.test(nuTs.items[0].does.join()) && /without the % unit/.test(nuTs.items[0].does.join())
    && nuAd.refused.length === 0 && nuAd.items[0].roster.tiers === null && nuAd.items[0].roster.register === true && /dropped the old figure/.test(nuAd.items[0].does.join()),
  "a salt figure queued with no unit, stamped after the switch, is dropped with a note and the batch is not refused, a tierset and an Add ID alike: " + fl([nuTs.items[0] && nuTs.items[0].does, nuAd.items[0] && nuAd.items[0].does]));
  ok(apNuTs.ok && !(apNuTs.book.TIER_OF || {})["CZ9-DA"] && apNuAd.ok && apNuAd.book.roster.includes("CZ9-DB") && !(apNuAd.book.TIER_OF || {})["CZ9-DB"]
    && apPct.ok && fl((apPct.book.TIER_OF || {})["CZ9-DA"]) === fl({ salt: 0.3 }),
  "and folded into the book it holds nothing (no 30% lift), where the same figure with unit pct is held as 0.3: " + fl([apNuTs.problems, (apNuTs.book || {}).TIER_OF && apNuTs.book.TIER_OF["CZ9-DA"], (apPct.book || {}).TIER_OF && apPct.book.TIER_OF["CZ9-DA"]]));
  ok(plan(noUnit(ts(after, null))).refused.length === 0 && fl(plan(noUnit(ts(after, null))).items[0].tiers) === fl({ "CZ9-DA": { salt: null } }) && /not held per customer/.test(why(noUnit(ts(after, 0.2, "oil")))),
  "a clear needs no unit, and a figure on oil is still refused by book: " + fl(plan(noUnit(ts(after, null))).items[0] && plan(noUnit(ts(after, null))).items[0].tiers));
  const pNew = plan(ts(after, 0.3));
  ok(pNew.refused.length === 0 && fl(pNew.items[0].tiers) === fl({ "CZ9-DA": { salt: 0.3 } }) && plan(ts(before, null)).refused.length === 0 && fl(plan(ts(before, null)).items[0].tiers) === fl({ "CZ9-DA": { salt: null } })
    && /not held per customer/.test(why(ts(before, "Gold", "oil"))) && /not held per customer/.test(why(ts(before, 0.2, "oil"))),
  "a salt % stamped after " + since + " is filed as it stands, a clear passes, and a figure on oil, a fixed board, is still refused before or after: " + fl([why(ts(before, "Gold", "oil")), why(ts(before, 0.2, "oil"))]));
  ok(Date.parse(since) > Date.parse("2026-10-17T00:00:00Z") && Date.parse(since) < Date.now() + 2 * 86400e3,
    "the switch moment is an instant at the start of this work, not a date in the future: " + since);
  ok(/not a % from 0 to 200/.test(why(ts(after, -0.4))) && /not a % from 0 to 200/.test(why(ts(after, 2.5))) && why(ts(after, 2)) === "" && why(ts(after, 0)) === "" && /not a % from 0 to 200/.test(why(ad(after, -0.3))),
    "and after it a salt tier entry takes 0 to 2 and refuses -0.4 and 2.5, at a tier entry and at Add ID: " + JSON.stringify([why(ts(after, -0.4)), why(ts(after, 2.5)), why(ad(after, -0.3))]));
  try { w.close(); } catch (e) { /* best effort */ }
}
