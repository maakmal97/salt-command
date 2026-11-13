/* test/price-band-customers.mjs: the price band's version 3, THE CUSTOMERS (docs/plan-salt-price-band.html, "The engine"; his answers E, F and G of
   10 Nov 2026 and of 11 Nov 2026). The engine's readings on a small book of their own; each check red under its own mutation
   (test/price-band-customers.mutations.json):
   C1  a regular's habit: order days in the window, the median gap and size, early, due, late and lapsed; a partner and a one-off have none
   C2  the habit list: who needs a word first, then the largest margin a month
   C3  the size warning: a bigger lot and ten points off, in ringgit a month at their own units
   C4  the win-back: a lapsed regular alone, ten points under their place, never under -80%; the Worker prices it at the order's size
   C5  new buyers by week, by road, come back, and two thin weeks
   C6  the price test's day: +5 in the even weeks, -5 in the odd, eight weeks from its Monday, nought with the switch off
   C7  in the walk the test moves its one size alone, their % riding on it there
   C8  the test's reading: orders and margin a day, up weeks against down
   C9  the calendar: the lift of a mark that passed, and a suggestion once a name has passed twice
   C10 the snapshot carries the habits, and the policy the day's test (the plain policy none) */
export async function run({ ok }) {
  const E = (await import("../engine/pricing.mjs")).default;
  const S = (await import("../engine/snapshot.mjs")).default;
  const RULES = (await import("../engine/rules.mjs")).default;
  const { inputsFromBook, pricingFromBook } = await import("../engine/book-inputs.mjs");
  const { winBackOf } = await import("../src/orders.js");
  const J = JSON.stringify;
  const Rm = JSON.parse(JSON.stringify(RULES));
  Rm.TIER_RULE.salt.market.since = "2026-10-01";
  Rm.TIER_RULE.salt.test.from = "2026-10-05";   /* a Monday */
  const day = (s, n) => new Date(Date.parse(s + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
  let rid = 0;
  const sale = (customer, date, qty, total, extra = {}) => Object.assign({ rid: "s8" + String(++rid).padStart(3, "0"), date, customer, qty, total, cash: total, deliveredQty: qty, deliveredOn: date, cost: qty * 50 }, extra);
  /* RA every 7 days from 1 Sep, last on 6 Oct; RB every 4 days from 14 Sep, last on 8 Oct (late by 20 Oct); RC every 5 days to 20 Sep (lapsed by 20 Oct); P1 a partner; ON once */
  const sales = [];
  for (let d = "2026-09-01"; d <= "2026-10-06"; d = day(d, 7)) sales.push(sale("RA1-AA", d, 1, 120));
  for (let d = "2026-09-14"; d <= "2026-10-10"; d = day(d, 4)) sales.push(sale("RB1-BB", d, 2, 225));
  for (let d = "2026-08-26"; d <= "2026-09-20"; d = day(d, 5)) sales.push(sale("RC1-CC", d, 6.25, 625));
  for (let d = "2026-09-02"; d <= "2026-10-14"; d = day(d, 6)) sales.push(sale("PA1-PP", d, 1, 65));
  sales.push(sale("ON1-OO", "2026-10-12", 1, 120));
  /* LZ a small buyer lapsed (half a unit every 3 days to 13 Sep); TH three order days, not yet a regular */
  for (let d = "2026-09-01"; d <= "2026-09-13"; d = day(d, 3)) sales.push(sale("LZ1-LL", d, 0.5, 60));
  for (const d of ["2026-10-01", "2026-10-05", "2026-10-09"]) sales.push(sale("TH1-TT", d, 1, 120));
  const book = (extra = {}) => Object.assign({ sales: sales.slice(), purchases: [{ rid: "p801", date: "2026-08-20", receivedOn: "2026-08-20", qty: 200, total: 10000, supplier: "SUP" }],
    PROD_OPENING: { salt: { qty: 0, costPerKg: 50 } }, STATED_STOCK: 30, COUNTS: [], selfUseLog: [], QUOTES: {}, COST_RULE: { salt: { kind: "latestCogs" } }, customerRefunds: [],
    roster: ["RA1-AA", "RB1-BB", "RC1-CC", "PA1-PP", "ON1-OO", "LZ1-LL", "TH1-TT"], partners: ["PA1-PP"], TIER_OF: {}, PROD_ORDER: ["salt"], loans: [], INTRODUCTIONS: [{ by: "RA1-AA", customer: "ON1-OO", since: "2026-10-12", days: 7 }] }, extra);
  const ctx = (b, d, rules = Rm) => { const B = inputsFromBook(b); return { B, R: rules, today: new Date(d + "T00:00:00Z"), over: null, memo: B.memo, W: { buyUnits: 0, selfUse: 0, wavgBuy: 0, stockCost: null } }; };
  const C = ctx(book(), "2026-10-20");

  /* C1 */
  const ha = S.habitOf(C, "salt", "RA1-AA"), hb = S.habitOf(C, "salt", "RB1-BB"), hc = S.habitOf(C, "salt", "RC1-CC");
  ok(ha.regular && ha.gap === 7 && ha.usual === 1 && ha.last === "2026-10-06" && ha.since === 14 && ha.state === "late"
    && hb.gap === 4 && hb.usual === 2 && hb.last === "2026-10-08" && hb.since === 12 && hb.state === "late" && hc.gap === 5 && hc.since === 30 && hc.state === "lapsed",
    "C1 a regular's gap and usual are the medians of their order days, and past 1.5 gaps they are late, past 3 gaps or 21 days lapsed: " + J([ha, hb, hc].map((h) => [h.gap, h.usual, h.since, h.state])));
  const hr = S.habitOf(ctx(book(), "2026-10-09"), "salt", "RA1-AA"), hd = S.habitOf(ctx(book(), "2026-10-15"), "salt", "RA1-AA");
  ok(hr.state === "early" && hd.state === "due" && hd.since === 9 && S.habitOf(C, "salt", "PA1-PP") === null && S.habitOf(C, "salt", "ON1-OO").regular === false
    && S.habitOf(C, "salt", "TH1-TT").regular === false && S.habitOf(C, "salt", "TH1-TT").orders === 3,
    "C1 under one gap they are early, past one gap and within 1.5 due; a partner has no habit, and three order days make no regular: " + J([hr.state, hd.state, hd.since]));
  const h21 = S.habitOf(ctx(book(), "2026-10-21"), "salt", "RB1-BB");
  ok(h21.since === 13 && h21.state === "late", "C1 past three gaps but under 21 days they are late, not lapsed: " + J([h21.since, h21.state]));

  /* C2 */
  const list = S.habits(C, "salt").map((h) => h.code + ":" + h.state);
  ok(J(list) === J(["RC1-CC:lapsed", "LZ1-LL:lapsed", "RB1-BB:late", "RA1-AA:late"]),
    "C2 the list leads with the lapsed, then the late, the larger margin a month first: " + J(list));

  /* C3 */
  const w = S.sizeWarn(C, "salt", "RA1-AA");
  ok(w && w.usual === 1 && w.bigger && w.bigger.q === 3 && w.bigger.perUnit < w.perUnit && w.bigger.less30 > 0 && w.tenOff && w.tenOff.less30 > 0,
    "C3 a bigger lot (3 times their usual) earns less a unit, said in ringgit a month, and so does ten points off: " + J(w));

  /* C4 */
  const wb = S.winBack(C, "salt", "RC1-CC");
  ok(wb && wb.from === 0 && wb.to === -0.1 && S.winBack(C, "salt", "RB1-BB") === null && S.winBack(C, "salt", "RA1-AA") === null,
    "C4 a lapsed regular alone is suggested ten points under their place: " + J(wb));
  const Cf = ctx(book({ TIER_OF: { "RC1-CC": { salt: -0.75 } } }), "2026-10-20");
  ok(J(S.winBack(Cf, "salt", "RC1-CC")) === J({ from: -0.75, to: -0.8, since: 30, gap: 5 }) && S.winBack(ctx(book({ TIER_OF: { "RC1-CC": { salt: -0.8 } } }), "2026-10-20"), "salt", "RC1-CC") === null,
    "C4 never under -80%, so the order still earns, and none when they stand there already: " + J(S.winBack(Cf, "salt", "RC1-CC")));
  const pr = pricingFromBook(Object.assign(book(), { }), new Date("2026-10-20T04:00:00Z"));
  /* the snapshot is struck on the live rules; the Worker reads the habit and the rule off it */
  const wo = winBackOf({ byProduct: { salt: Object.assign({}, pr.byProduct.salt, { habits: { "RC1-CC": { state: "lapsed", since: 30, gap: 5 } }, lift: {} }) } }, "RC1-CC", 6.25);
  const K = E.costStack(pr.byProduct.salt.inputs.cost), P = pr.byProduct.salt.inputs.policy;
  ok(wo && wo.to === -0.1 && wo.price === E.quoteAt(6.25, K, P, -0.1) && wo.now === E.quoteAt(6.25, K, P, 0) && wo.price < wo.now
    && winBackOf({ byProduct: { salt: Object.assign({}, pr.byProduct.salt, { habits: { "RC1-CC": { state: "late" } } }) } }, "RC1-CC", 6.25) === null,
    "C4 at his Accept the Worker prices the win-back at the order's size off the snapshot, for a lapsed regular alone: " + J(wo));

  /* C5 */
  const nb = S.newBuyers(ctx(book(), "2026-10-20"), "salt");
  const onW = nb.weeks.find((x) => x.from <= "2026-10-12" && "2026-10-12" < x.to);
  ok(nb.weeks.length === 8 && onW && onW.count === 1 && onW.introduced === 1 && onW.back === 0 && nb.weeks.reduce((t, x) => t + x.count, 0) === 6 && nb.weeks.reduce((t, x) => t + x.back, 0) === 5,
    "C5 first orders by week, the introduced among them and who came back, a partner left out: " + J(nb.weeks.map((x) => [x.from, x.count, x.introduced, x.back])));
  ok(nb.thin === false && S.newBuyers(ctx(book(), "2026-11-10"), "salt").thin === true,
    "C5 thin when the newest two weeks each run under half the eight weeks' mean");

  /* C6 */
  const t = (d, b = book()) => S.testOf(ctx(b, d), "salt");
  ok(t("2026-10-04") === null && J(t("2026-10-05")) === J({ q: 1, rm: 5, week: 1, weeks: 8, from: "2026-10-05" }) && t("2026-10-12").rm === -5 && t("2026-10-19").rm === 5
    && t("2026-11-29").rm === -5 && t("2026-11-30") === null,
    "C6 the test is RM 5 up at 1 unit in its first week (his answer of 13 Nov 2026), RM 5 down in its second, alternating for eight weeks, then stops by itself: " + J([t("2026-10-05"), t("2026-10-12"), t("2026-11-30")]));
  const off = book({ MARKET: { salt: { switch: [{ on: false, from: "2026-10-10", at: "a" }] } } });
  ok(t("2026-10-12", off) === null, "C6 with his switch off there is no test");

  /* C7 */
  const pol = (test) => Object.assign({ LADDER: { round: { to: 5, up: true } }, minPerUnit: 0, timePerOrder: 0, lotFloor: {}, floorTo: 5, tierRule: RULES.TIER_RULE.salt }, test ? { test } : {});
  const K2 = E.costStack(pr.byProduct.salt.inputs.cost);
  const g0 = E.quoteGrid(K2, pol(null), 0), gU = E.quoteGrid(K2, pol({ q: 1, rm: 5 }), 0), gD = E.quoteGrid(K2, pol({ q: 1, rm: -5 }), 0);
  const sizes = E.gridSizes(E.gridOf(RULES.TIER_RULE.salt)), i1 = sizes.findIndex((q) => Math.abs(q - 1) < 1e-9);
  const others = sizes.every((q, i) => i === i1 || (gU.p[i] === g0.p[i] && gD.p[i] === g0.p[i]));
  ok(others && gU.p[i1] === g0.p[i1] + 5 && gD.p[i1] === g0.p[i1] - 5 && E.quoteAt(1, K2, pol({ q: 1, rm: 5 }), 0) === gU.p[i1],
    "C7 the test moves 1 unit alone, RM 5 up and RM 5 down, every other size at its price: " + J([g0.p[i1], gU.p[i1], gD.p[i1]]));
  const gK = E.quoteGrid(K2, pol({ q: 1, rm: 5 }), 0.3), gK0 = E.quoteGrid(K2, pol(null), 0.3);
  const gL = (k) => E.quoteGrid(K2, pol({ q: 1, rm: -5 }), k), gL0 = (k) => E.quoteGrid(K2, pol(null), k);
  ok([0.3, -0.3, 0.6].every((k) => sizes.every((q, i) => i === i1 || gL(k).p[i] === gL0(k).p[i])),
    "C7 a test RM 5 down at 1 unit leaves every other size at its price under any %, so the walk's state never feels it");
  ok(sizes.every((q, i) => i === i1 || gK.p[i] === gK0.p[i]) && gK.p[i1] >= gK0.p[i1] && E.quoteAt(1, K2, pol({ q: 1, rm: 5 }), "partner") === E.quoteAt(1, K2, pol(null), "partner"),
    "C7 their % rides on the tested Median at 1 unit and nowhere else, and a partner pays the Floor: " + J([gK0.p[i1], gK.p[i1]]));

  /* C8 */
  const trBook = book({ sales: sales.concat([sale("TT1-TT", "2026-10-06", 1, 125), sale("TT1-TT", "2026-10-07", 1, 125), sale("TT2-TT", "2026-10-13", 1, 115)]) });
  const tr = S.testReading(ctx(trBook, "2026-10-19"), "salt");
  ok(tr && tr.up.days === 7 && tr.down.days === 7 && tr.up.orders === 2 + sales.filter((s) => s.qty === 1 && s.customer !== "PA1-PP" && s.date >= "2026-10-05" && s.date < "2026-10-12").length
    && tr.down.orders === 1 + sales.filter((s) => s.qty === 1 && s.customer !== "PA1-PP" && s.date >= "2026-10-12" && s.date < "2026-10-19").length && tr.up.marginDay > 0,
    "C8 the reading counts orders and margin a day at 1 unit, a partner left out, the up weeks against the down: " + J(tr));

  /* C9 */
  const marks = [{ name: "Payday", from: "2026-09-25", to: "2026-09-27" }, { name: "Payday", from: "2026-10-09", to: "2026-10-11" }, { name: "Payday", from: "2026-10-25", to: "2026-10-27" }];
  const cl = S.calendarLift(C, "salt", marks);
  ok(cl.length === 3 && cl[0].passed && typeof cl[0].lift === "number" && cl[1].passed && !cl[2].passed && cl[2].measured === 2 && cl[2].suggest && typeof cl[2].suggest.hold === "number"
    && S.calendarLift(C, "salt", marks.slice(1))[1].suggest === undefined,
    "C9 a mark that passed is measured against the 28 days before it, and a name measured twice suggests stock to hold for the next: " + J(cl));

  /* C10 */
  const pl = pricingFromBook(book(), new Date("2026-10-20T04:00:00Z"));
  const hRA = (pl.byProduct.salt.habits || {})["RA1-AA"] || {};
  ok(hRA.warn && hRA.warn.bigger && hRA.warn.bigger.q === 3 && pl.byProduct.salt.buyers && pl.byProduct.salt.buyers.weeks.length === 8,
    "C10 each habit carries its size warning and the snapshot the new-buyer line, for Salt Admin to read: " + J([hRA.warn, pl.byProduct.salt.buyers && pl.byProduct.salt.buyers.mean]));
  const live = pricingFromBook(book(), new Date("2026-11-17T04:00:00Z"));
  ok(pl.byProduct.salt.habits && pl.byProduct.salt.habits["RC1-CC"].state === "lapsed" && !("PA1-PP" in pl.byProduct.salt.habits) && J(live.byProduct.salt.inputs.policy.test) === J({ q: 1, rm: 5 })
    && S.policy(ctx(book(), "2026-11-17", RULES), "salt", true).test === undefined,
    "C10 the snapshot carries each regular's habit, and the day's policy the test (the plain policy, which the evidence reads, none): " + J([pl.byProduct.salt.habits && Object.keys(pl.byProduct.salt.habits), live.byProduct.salt.inputs.policy.test]));
}
