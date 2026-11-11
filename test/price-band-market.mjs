/* test/price-band-market.mjs: the price band's version 2, THE MARKET (docs/plan-salt-price-band.html Steps 3 and 4 and "Dependable"; his answer B of
   10 Nov 2026 and his answers of 11 Nov 2026).
   1. The move inside the walk: the Median goes to a place mk on the band, walked by the same laws; a customer's % rides on the moved Median (his
      answer), so -100% is the Floor and +100% the Ceiling under any move, a partner pays the Floor, and the rate never rises with size.
   2. The walk of the move: supply off the one plain cover at the start of each day (his answer), 5 points a day at most towards the target, held
      -15 to +20; the pace said and never priced (acts false); his switch off is nought that day and on again climbs from nought; the stand-down;
      a sale dated today moves nothing until tomorrow; nought before the rule's since; the reason in his words.
   3. His re-anchored points, from their day, the newest at a size winning; the policy carries the move and his points; the evidence reads the
      plain Median; the snapshot carries the day's move.
   4. The road: Salt Admin's Off, On and Use this point (makerMarket), the drafter's row (the multiple struck on the COGS Floor), the fold filing
      the MARKET document once, a point outside the band asked once.
   5. The 90-day reading's profit-best (a cancelled order a decline), the suggestion's two tests, the scorecard and the replay.
   6. The suite's frozen book holds the move off, so no other check's price moves with the calendar.
   Mutations: test/price-band-market.mutations.json. */
import { frozenBook } from "./frozen.mjs";

export async function run({ ok }) {
  const E = (await import("../engine/pricing.mjs")).default;
  const S = (await import("../engine/snapshot.mjs")).default;
  const POS = (await import("../engine/position.mjs")).default;
  const RULES = (await import("../engine/rules.mjs")).default;
  const { inputsFromBook, pricingFromBook } = await import("../engine/book-inputs.mjs");
  const MI = await import("../src/maker-inputs.js");
  const { draftRow } = await import("../src/drafter.js");
  const { Book } = await import("../src/book.js");
  const { objectState } = await import("./orderbook-harness.mjs");
  const R = RULES.TIER_RULE.salt;

  const costIn = (c, share) => Object.assign({ prod: "salt", lockOn: false, lockState: { state: "none", lock: null }, lockBase: null, over: { cost: null, shrink: null },
    lot: { qty: 50, total: c * 50, rate: c, date: "2026-11-09" }, quoteRate: 56, repl: c, freightRate: 0, meanLot: 50, leak: null,
    costRule: { kind: "latestCogs" }, latest: { quote: c * 50, freight: 0, units: 50, rate: c },
    costBasis: { freightPerTrip: { rm: 0 }, txnPerDelivery: { rm: 0 }, deliveredShare: { v: 0.2 } }, attrib: 1, shrinkRate: 0, avgDel: { n: 5, mean: 2 } },
  share == null ? {} : { nrs: { share } });
  const K = E.costStack(costIn(50, 0.213));
  const pol = (mk, rule = R) => Object.assign({ LADDER: { round: { to: 5, up: true } }, minPerUnit: 0, timePerOrder: 0, lotFloor: {}, floorTo: 5, tierRule: rule }, mk == null ? {} : { market: mk });
  const grid = E.gridSizes(E.gridOf(R));
  const down5 = (v) => Math.floor(v / 5 + 1e-9) * 5;

  /* 1. THE MOVE INSIDE THE WALK */
  const at = (q, mk, k) => E.driftAt(q, K, pol(mk), k);
  const m0 = at(1, null, 0), m15 = at(1, 0.15, 0), mDn = at(1, -0.1, 0);
  ok(m0.p === 120 && m15.p === down5(E.bandTop(120, m0.floor, m0.ceiling, 0.15)) && m15.p === 125 && m15.plain === 120 && mDn.p === down5(E.bandTop(120, m0.floor, m0.ceiling, -0.1)) && mDn.p < 120,
    "the move puts the Median at its place on the band, down to RM 5: RM 120 at 1 unit is RM " + m15.p + " at +15 and RM " + mDn.p + " at -10, the plain Median said beside it");
  const moves = [-0.15, -0.05, 0.05, 0.2], pcts = [-0.5, -0.1, 0.1, 0.3];
  const ends = moves.every((mk) => grid.every((q) => { const fl = E.driftAt(q, K, pol(mk), -1), ce = E.driftAt(q, K, pol(mk), 1); return fl.p === fl.floor && ce.p === E.driftAt(q, K, pol(null), 1).p; }));
  ok(ends && moves.every((mk) => E.quoteAt(3, K, pol(mk), "partner") === E.floorTotal(3, K, pol(null))),
    "-100% is the Floor and +100% the Ceiling under every move, at every grid size, and a partner pays the Floor: the ends never move");
  const rides = moves.every((mk) => pcts.every((k) => grid.every((q) => { const w = E.driftAt(q, K, pol(mk), k); return k > 0 ? w.p >= w.set - 1e-9 : w.p <= w.set + 1e-9; })))
    && E.driftAt(1, K, pol(0.15), 0.1).p > E.driftAt(1, K, pol(null), 0.1).p && E.driftAt(1, K, pol(-0.1), -0.1).p < E.driftAt(1, K, pol(null), -0.1).p;
  ok(rides, "their % rides on the moved Median (his answer): a lift is never under the moved Median and a discount never over it, and a customer on +10% or -10% moves with the market");
  const rateOk = moves.every((mk) => pcts.concat([0]).every((k) => { const g = E.quoteGrid(K, pol(mk), k); return g && g.p.every((v, i) => !i || v / grid[i] <= g.p[i - 1] / grid[i - 1] + 5 / grid[i] + 1e-9); }));
  const gridOk = moves.every((mk) => { const g = E.quoteGrid(K, pol(mk), 0.1); return [0.5, 1, 6.25, 12.5, 25].every((q) => g.p[grid.findIndex((x) => Math.abs(x - q) < 1e-9)] === E.quoteAt(q, K, pol(mk), 0.1)); });
  ok(rateOk && gridOk, "under any move the rate law holds on the grid (under RM 5 a unit at most between quarters) and quoteGrid and quoteAt walk one path");
  const noBand = Object.assign({}, R); delete noBand.band;
  ok(JSON.stringify(E.quoteGrid(K, pol(0.2, noBand), 0).p) === JSON.stringify(E.quoteGrid(K, pol(null, noBand), 0).p) && E.quoteAt(1, K, pol(0.15), 0) !== E.quoteAt(1, K, pol(null), 0),
    "a rule with no band takes no move");

  /* 2. THE WALK OF THE MOVE, on a small book of its own */
  const Rm = JSON.parse(JSON.stringify(RULES));
  Rm.TIER_RULE.salt.market.since = "2026-10-01";
  const sale = (i, date, qty, total, extra = {}) => Object.assign({ rid: "s9" + String(i).padStart(3, "0"), date, customer: "CX" + (i % 7) + "-AA", qty, total, cash: total, deliveredQty: qty, deliveredOn: date, cost: qty * 50 }, extra);
  const lots = [{ rid: "p901", date: "2026-09-01", receivedOn: "2026-09-01", qty: 60, total: 3000, supplier: "SUP" }];
  const baseSales = []; for (let i = 0; i < 30; i++) baseSales.push(sale(i, "2026-09-" + String(2 + i % 27).padStart(2, "0"), 1, 120));
  const book = (extra = {}) => Object.assign({ sales: baseSales.slice(), purchases: lots.slice(), PROD_OPENING: { salt: { qty: 0, costPerKg: 50 } }, STATED_STOCK: 30, COUNTS: [],
    selfUseLog: [], QUOTES: {}, COST_RULE: { salt: { kind: "latestCogs" } }, customerRefunds: [], roster: [], partners: [], TIER_OF: {}, PROD_ORDER: ["salt"], loans: [] }, extra);
  const ctx = (b, day, rules = Rm) => { const B = inputsFromBook(b); return { B, R: rules, today: new Date(day + "T00:00:00Z"), over: null, memo: B.memo, W: { buyUnits: 0, selfUse: 0, wavgBuy: 0, stockCost: null } }; };
  const b1 = book();
  ok(S.shelfAt(ctx(b1, "2026-10-01"), "salt", "2026-10-01") === 30 && S.shelfAt(ctx(b1, "2026-10-01"), "salt", "2026-09-02") === 60
    && S.shelfAt(ctx(book({ COUNTS: [{ date: "2026-09-20", product: "salt", qty: 40 }] }), "2026-10-01"), "salt", "2026-10-01") === 40 - baseSales.filter((s) => s.date > "2026-09-20").length,
  "the shelf at the start of a day is rebuilt from the opening or the last count before it, lots received since and handovers since");
  /* 30 units left, 30 sold over September: about a unit a day */
  const w1 = S.marketWalk(ctx(b1, "2026-10-08"), "salt", "2026-10-08");
  const short = book({ purchases: [{ rid: "p901", date: "2026-09-01", receivedOn: "2026-09-01", qty: 32, total: 1600, supplier: "SUP" }] });
  const w2 = S.marketWalk(ctx(short, "2026-10-06"), "salt", "2026-10-06");
  ok(w2.log[0].supply === 0.15 && w2.log.slice(0, 3).map((e) => e.k).join() === "0.05,0.1,0.15" && w1.log.every((e) => e.k <= 0.2 + 1e-9 && e.k >= -0.15 - 1e-9),
    "with two days of cover the target is +15 and the move goes 5 points a day towards it: " + w2.log.map((e) => e.k).join());
  const long = book({ purchases: [{ rid: "p901", date: "2026-09-01", receivedOn: "2026-09-01", qty: 400, total: 20000, supplier: "SUP" }] });
  const w3 = S.marketWalk(ctx(long, "2026-10-05"), "salt", "2026-10-05");
  ok(w3.log[0].long && w3.log[0].supply === -0.1 && w3.log.map((e) => e.k).join() === "-0.05,-0.1,-0.1,-0.1,-0.1",
    "past 14 days of cover the target is -10, reached in two days: " + w3.log.map((e) => e.k).join());
  const Rhot = JSON.parse(JSON.stringify(Rm)); Rhot.TIER_RULE.salt.market.supply = [[3, 0.4]];
  const wHot = S.marketWalk(ctx(short, "2026-10-08"), "salt", "2026-10-08", null);
  const wCap = (() => { const C = ctx(short, "2026-10-08", Rhot); return S.marketWalk(C, "salt", "2026-10-08"); })();
  ok(Math.max(...wCap.log.map((e) => e.k)) === 0.2 && wCap.log.every((e) => e.target <= 0.2 + 1e-9) && wHot.log.length === 8,
    "the target is held at +20 at most whatever the signals add: " + wCap.log.map((e) => e.k).join());
  /* the pace: the last 14 days against the last 56, said and never priced while acts is false */
  const busy = book({ sales: baseSales.concat([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => sale(100 + i, "2026-09-2" + (i % 9), 2, 240))),
    purchases: [{ rid: "p901", date: "2026-09-01", receivedOn: "2026-09-01", qty: 300, total: 15000, supplier: "SUP" }] });
  const wp = S.marketWalk(ctx(busy, "2026-10-01"), "salt", "2026-10-01");
  const Racts = JSON.parse(JSON.stringify(Rm)); Racts.TIER_RULE.salt.market.pace.acts = true;
  const wa = S.marketWalk(ctx(busy, "2026-10-01", Racts), "salt", "2026-10-01");
  ok(wp.log[0].pacePts === 0.05 && wp.log[0].target === wp.log[0].supply && wa.log[0].target === +(wa.log[0].supply + 0.05).toFixed(4) && /said and not priced/.test(S.marketWhy(wp)),
    "the pace is read (" + wp.log[0].pace + " against normal) and said, never priced while it has no measured basis; with acts it would add: " + [wp.log[0].target, wa.log[0].target].join(" against "));
  /* his switch */
  const off = book({ purchases: short.purchases, sales: baseSales.concat([1, 2, 3, 4, 5, 6, 7].map((d) => sale(700 + d, "2026-10-0" + d, 1, 120))), MARKET: { salt: { switch: [{ on: false, from: "2026-10-03", at: "a" }, { on: true, from: "2026-10-05", at: "b" }] } } });
  const ws = S.marketWalk(ctx(off, "2026-10-07"), "salt", "2026-10-07");
  ok(ws.log.map((e) => e.k).join() === "0.05,0.1,0,0,0.05,0.1,0.15" && ws.log[2].on === false && S.switchOn(ctx(off, "2026-10-07"), "salt", "2026-10-04") === false
    && /Switched off/.test(S.marketWhy(ws.log[2])),
    "switched off, the move is nought that day and every day until on again, and on again it climbs from nought: " + ws.log.map((e) => e.k).join());
  /* the stand-down: margin a day falling two weeks running while the move is up holds it at nought or under for seven days */
  const falling = []; let n = 300;
  [["2026-10-01", 6], ["2026-10-08", 4], ["2026-10-15", 2]].forEach(([d0, per]) => { for (let j = 0; j < 7; j++) for (let x = 0; x < per; x++) falling.push(sale(n++, "2026-10-" + String(+d0.slice(8) + j).padStart(2, "0"), 0.5, 60)); });
  const fb = book({ sales: falling, purchases: [{ rid: "p901", date: "2026-09-01", receivedOn: "2026-09-01", qty: 44, total: 2200, supplier: "SUP" }] });
  const wf = S.marketWalk(ctx(fb, "2026-10-30"), "salt", "2026-10-30");
  const trig = wf.log.findIndex((e) => e.stood);
  ok(trig > 0 && wf.log[trig - 1].k > 0 && wf.log.slice(trig, trig + 7).every((e) => e.stood && e.target <= 0) && /margin a day fell two weeks running/.test(S.marketWhy(wf.log[trig])),
    "margin a day falling two weeks running while the move is up stands it down for seven days, and says so: from " + (wf.log[trig] || {}).day);
  /* a sale dated today moves nothing until tomorrow; before since it is nought */
  const today = book({ purchases: short.purchases, sales: baseSales.concat([sale(900, "2026-10-04", 20, 2400)]) });
  ok(S.marketWalk(ctx(today, "2026-10-04"), "salt", "2026-10-04").k === S.marketWalk(ctx(short, "2026-10-04"), "salt", "2026-10-04").k
    && JSON.stringify(S.marketCover(ctx(today, "2026-10-04"), "salt", "2026-10-04")) === JSON.stringify(S.marketCover(ctx(short, "2026-10-04"), "salt", "2026-10-04"))
    && S.marketCover(ctx(today, "2026-10-05"), "salt", "2026-10-05").free < S.marketCover(ctx(short, "2026-10-05"), "salt", "2026-10-05").free,
    "each day is read as the book stood when it began: a sale dated today moves the next day's cover, never today's move");
  const early = S.marketWalk(ctx(short, "2026-09-20"), "salt", "2026-09-20");
  ok(early.k === 0 && early.before && S.marketOf(ctx(short, "2026-09-20"), "salt").k === 0 && /starts on 2026-10-01/.test(S.marketWhy(early)) && RULES.TIER_RULE.salt.market.since >= "2026-11-11",
    "before the rule's since the move is nought, and the live rule starts from the day the version ships (his answer)");
  ok(S.marketWhy(w2.log[2]).startsWith("Median +15: " + w2.log[2].cover.toFixed(1) + " days of cover") && S.marketWhy(w2.log[0]).startsWith("Median +5: " + w2.log[0].cover.toFixed(1) + " days of cover, moving 5 a day towards +15"),
    "the reason is said in his words: " + S.marketWhy(w2.log[0]));

  /* 3. HIS POINTS, THE POLICY, THE EVIDENCE AND THE SNAPSHOT */
  const anch = book({ MARKET: { salt: { anchors: [{ q: 1, x: 2.2, from: "2026-10-03", at: "a" }, { q: 1, x: 2.3, from: "2026-10-04", at: "b" }, { q: 2, x: 2.1, from: "2026-11-30", at: "c" }] } } });
  const r3 = S.ruleFor(ctx(anch, "2026-10-05"), "salt"), r2 = S.ruleFor(ctx(anch, "2026-10-03"), "salt"), r1 = S.ruleFor(ctx(anch, "2026-10-02"), "salt");
  ok(r3.points.find((x) => x[0] === 1)[1] === 2.3 && r2.points.find((x) => x[0] === 1)[1] === 2.2 && r1 === Rm.TIER_RULE.salt && !r3.points.some((x) => x[0] === 2) && r3.points.length === R.points.length,
    "his points stand from their day, the newest at a size winning, and a later one waits for its day");
  const live = frozenBook(); delete live.MARKET;
  const day = "2026-11-20";
  const Cl = ctx(live, day, RULES), Coff = ctx(frozenBook(), day, RULES);
  const pl = S.policy(Cl, "salt"), mkLive = S.marketOf(Cl, "salt");
  ok(mkLive && pl.market === (Math.abs(mkLive.k) > 1e-9 ? mkLive.k : undefined) && S.policy(Cl, "salt", true).market === undefined && S.policy(Coff, "salt").market === undefined,
    "the policy carries the day's move on a band book (" + (mkLive && mkLive.k) + " on " + day + "), plain leaves it out, and the switch off leaves none");
  const someone = Object.keys(live.TIER_OF || {}).find((c) => (live.TIER_OF[c] || {}).salt != null) || (live.roster || [])[0];
  ok(JSON.stringify(S.suggestOf(Cl, "salt", someone)) === JSON.stringify(S.suggestOf(Coff, "salt", someone)),
    "the suggestion reads the plain Median: the day's move does not move what a customer's past sales say");
  const ps = pricingFromBook(live, new Date(day + "T04:00:00Z")).byProduct.salt, po = pricingFromBook(frozenBook(), new Date(day + "T04:00:00Z")).byProduct.salt;
  ok(ps.market && ps.market.day === day && typeof ps.market.why === "string" && po.market && po.market.on === false && (Math.abs(ps.market.k) < 1e-9 || JSON.stringify(ps.cards) !== JSON.stringify(po.cards)),
    "the snapshot carries the day's move, its reason and his switch; the cards follow it: " + (ps.market || {}).why);

  /* 4. THE ROAD: Salt Admin, the drafter, the fold */
  const pricing = pricingFromBook(frozenBook(), new Date("2026-11-20T04:00:00Z"));
  const desk = { state: { roster: [], associates: [] }, pricing, ledger: [], version: "v1502" };
  const at0 = "2026-11-20T03:00:00.000Z";
  const offE = MI.makerMarket({ at: at0, kind: "marketOff" }, desk), twin = MI.makerMarket({ at: "2026-11-20T03:01:00.000Z", kind: "marketOn" }, desk, [offE.entry]);
  const bad = MI.makerMarket({ at: at0, kind: "marketOff", price: 100 }, desk), oil = MI.makerMarket({ at: at0, kind: "marketOff", product: "oil" }, desk);
  ok(offE.entry && offE.entry.payload.mode === "edit" && offE.entry.payload.kind === "marketOff" && twin.twin && bad.error && oil.error,
    "Off and On are edits on Salt Admin's road; a second while one waits is a twin, a switch carries no price, and a book with no market has none");
  const fl1 = pricing.byProduct.salt.floors["1"] || pricing.byProduct.salt.floors[1];
  const under = MI.makerMarket({ at: at0, kind: "anchor", q: 1, price: 40 }, desk), offGrid = MI.makerMarket({ at: at0, kind: "anchor", q: 1.25, price: 110 }, desk);
  const odd0 = 0, odd = MI.makerMarket({ at: at0, kind: "anchor", q: 1, price: 112 }, desk), why = MI.makerMarket({ at: at0, kind: "anchor", q: 1, price: 40, why: "clearance day" }, desk);
  const fine = MI.makerMarket({ at: at0, kind: "anchor", q: 1, price: 110 }, desk);
  ok(under.error && under.outside && under.outside.side === "under" && /under the Floor/.test(under.error) && offGrid.error && odd.error === "A Median point is a price in steps of RM 5." && why.entry && why.entry.payload.why === "clearance day" && fine.entry && !fine.entry.payload.why,
    "a point is a price in RM 5 at an ordered size; outside the band it is asked once with what it means, and stands with his reason: " + under.error);
  const drafted = draftRow(fine.entry, desk), dOff = draftRow(offE.entry, desk);
  const K2 = E.costStack(pricing.byProduct.salt.inputs.cost), plainP = Object.assign({}, pricing.byProduct.salt.inputs.policy); delete plainP.market;
  ok(drafted.collection === "edit" && drafted.row.kind === "anchor" && drafted.row.from === "2026-11-20" && Math.abs(drafted.row.x - 110 / E.floorBase(1, K2, plainP)) < 1e-6
    && /goes from RM/.test(drafted.flags[0]) && dOff.row.kind === "marketOff" && dOff.row.from === "2026-11-20",
    "the drafter strikes the point's multiple on the COGS Floor at the size and says what the Median becomes: " + drafted.flags[0]);
  /* the Book's own tap (the plan and apply the fold runs): the MARKET document filed once by each entry's moment, a re-tap the same booking */
  const b4 = frozenBook(); delete b4.MARKET;
  const V = "v1252", derived = { OPEN: { v: V, at: "2026-10-28T01:00:00.000Z", count: 0, byKey: {} }, TERMS: { creditDays: 7 }, REWARD: { stated: {} }, STOCK: { today: "2026-10-28", books: {} } };
  const BK = new Book(objectState(), {}); let tick = 0;
  BK.clock = () => "2026-11-20T10:00:" + String(10 + (tick++ % 50)).padStart(2, "0") + ".000Z";
  const call = async (path, init) => { const r = await BK.fetch(new Request("https://book" + path, init)); return { status: r.status, ...(await r.json()) }; };
  await BK.fetch(new Request("https://book/load", { method: "POST", body: JSON.stringify({ rev: "r", book: b4, pricing: { v: V, floors: { salt: { 1: 60 } }, sizes: [0.5, 1] }, derived, v: V, stamped: "20 Nov 2026, 10:00 KL" }) }));
  const tap = (items, roster = false) => call("/tap", { method: "POST", body: JSON.stringify(Object.assign({ items, day: "2026-11-20", v: V }, roster ? { roster: true } : {})), headers: {} });
  const items = [{ id: offE.entry.at, status: "approved", collection: "edit", row: dOff.row }, { id: "2026-11-20T03:05:00.000Z", status: "approved", collection: "edit", row: drafted.row }];
  const t1 = await tap(items), again = await tap(items), mk = ((await call("/read")).state || {}).MARKET;
  const nogo = await tap([{ id: "2026-11-20T03:09:00.000Z", status: "approved", collection: "edit", row: { kind: "anchor", product: "salt", from: "2026-11-20", at: "z" } }]);
  ok(t1.ok && again.ok && mk && mk.salt && mk.salt.switch.length === 1 && mk.salt.switch[0].on === false && mk.salt.switch[0].from === "2026-11-20" && mk.salt.anchors.length === 1 && mk.salt.anchors[0].x === drafted.row.x
    && nogo.status === 409 && /names its size/.test(JSON.stringify(nogo.refused)),
    "the tap files the MARKET document once by each entry's moment, a point with no size refused: " + JSON.stringify(mk));

  /* 5. THE READING, THE SCORE AND THE REPLAY */
  /* four paid RM 100 and six RM 140, and two cancelled at RM 140: without the declines RM 140 earns most (90 x 6 against 50 x 10), with them RM 100 (50 x 12 against 90 x 6) */
  const rd = book({ sales: [0, 1, 2, 3].map((i) => sale(500 + i, "2026-10-1" + i, 1, 100)).concat([4, 5, 6, 7, 8, 9].map((i) => sale(500 + i, "2026-10-1" + i, 1, 140)),
    [sale(510, "2026-10-19", 1, 140, { cancelled: true, cash: 0, deliveredQty: 0 }), sale(511, "2026-10-19", 1, 140, { cancelled: true, cash: 0, deliveredQty: 0 })]) });
  const reading = S.priceReading(ctx(rd, "2026-10-25"), "salt"), one = reading.find((x) => x.q === 1);
  ok(one && one.sales === 10 && one.declined === 2 && one.best === 100 && one.usual === 140 && one.suggest === (Math.abs(one.best - one.median) >= 5),
    "the profit-best is the price paid that earns the most per buyer seen, a cancelled order a decline: RM " + (one && one.best) + " at 1 unit over " + (one && one.sales) + " sales");
  const nine = book({ sales: rd.sales.slice(1) }), r9 = S.priceReading(ctx(nine, "2026-10-25"), "salt").find((x) => x.q === 1);
  ok(r9 && r9.sales === 9 && r9.suggest === false && one.suggest === true, "a re-anchor is suggested only at a size with 10 sales or more and RM 5 or more between the reading and the Median");
  const sc = S.marketScore(ctx(rd, "2026-10-20"), "salt");
  ok(sc && sc.orders === 7 && sc.newBuyers === 4 && Math.abs(sc.margin - (90 * 6 + 50) / 7) < 0.01 && typeof sc.added === "number",
    "the scorecard reads the week: margin a day, orders and new buyers: " + JSON.stringify(sc));
  const rp = S.marketReplay(ctx(short, "2026-10-04"), "salt", 1);
  ok(rp && rp[0].day === "2026-09-02" && rp.length === 33 && rp.every((e) => typeof e.quote === "number") && rp[rp.length - 1].k === S.marketWalk(ctx(short, "2026-10-04"), "salt", "2026-10-04", "2026-09-02").k,
    "the replay walks the move from the book's first sale and quotes each day at the size, beside what was paid");

  /* 7. HIS WORD OF 11 NOV 2026, "ALWAYS START A STRANGER AT +30%": a new ID that names no figure starts there, and the guest board shows it */
  const rosterTap = await tap([{ id: "2026-11-20T04:00:00.000Z", status: "approved", collection: "roster", row: { code: "ZZ9-NEW", kind: "customer" } },
    { id: "2026-11-20T04:01:00.000Z", status: "approved", collection: "roster", row: { code: "ZZ8-NEW", kind: "customer", tiers: { salt: 0 }, unit: "band" } },
    { id: "2026-11-20T04:02:00.000Z", status: "approved", collection: "roster", row: { code: "SZ7-NEW", kind: "supplier" } }], true);
  const st = (await call("/read")).state || {}, to = st.TIER_OF || {};
  ok(rosterTap.ok && to["ZZ9-NEW"] && to["ZZ9-NEW"].salt === 0.3 && to["ZZ8-NEW"] && to["ZZ8-NEW"].salt === 0 && !to["SZ7-NEW"] && R.start === 0.3,
    "a new customer who names no figure starts at +30% on salt's band, a figure he chose (nought included) stands, and a supplier holds none: " + JSON.stringify([to["ZZ9-NEW"], to["ZZ8-NEW"], to["SZ7-NEW"]]));
  const { guestBoard } = await import("../tools/pricelist.mjs");
  const gb = guestBoard(frozenBook(), pricing, new Date("2026-11-20T04:00:00Z")), gs = gb.products.find((x) => x.product === "salt"), go = gb.products.find((x) => x.product === "oil");
  const Kg = E.costStack(pricing.byProduct.salt.inputs.cost), Pg = pricing.byProduct.salt.inputs.policy;
  ok(gs && gs.sizes.every((r) => r.price === E.quoteAt(r.q, Kg, Pg, 0.3)) && gs.sizes.some((r) => r.price > E.quoteAt(r.q, Kg, Pg, 0))
    && (!go || go.sizes.every((r) => r.price === E.quoteAt(r.q, E.costStack(pricing.byProduct.oil.inputs.cost), pricing.byProduct.oil.inputs.policy, 0))),
    "the guest board shows salt at +30% on the band and a stated board at its own price");

  /* 6. THE SUITE HOLDS THE MOVE OFF */
  const fz = frozenBook();
  ok(fz.MARKET && fz.MARKET.salt.switch[0].on === false && S.marketOf(ctx(fz, "2027-03-01", RULES), "salt").k === 0,
    "the suite's frozen book holds the market move off, so no other check's salt price moves with the calendar");
}
