/* test/floor-nrs-anchor.mjs: his answer H of 10 Nov 2026, built 11 Nov. THE FLOOR'S UNPAID SHARE IS RE-MEASURED ONLY WHEN HE STATES THE
   SHELF OR THE COST: a count, a recorded loss or a landed lot. Trading between those days moves nothing, so the Floor, the partner's
   price and a salt discount (a place between the Median and that Floor) stand still.
   1. With nothing after the anchor the reading is the live one, and it says its day and what measured it.
   2. A handover, a gift, a write-off and a later part of a handover dated on or after the anchor move nothing; nor a cancelled row's units.
   3. A new count, a recorded loss and a landed lot each bring them in; another book's count and a lot not landed do not.
   4. A write-off is dated by the engine's writeOffDay, the one the loyalty walk reads.
   5. On the frozen book a sale handed over after the anchor moves no salt floor and no discounted price; a count after it does.
   6. The cost stack carries the day, and the Desk says it beside the share.
   Mutations: test/floor-nrs-anchor.mutations.json. */
import { FROZEN_BOOK } from "./frozen.mjs";
import fs from "node:fs";

export async function run({ ok }) {
  const E = (await import("../engine/pricing.mjs")).default;
  const S = (await import("../engine/snapshot.mjs")).default;
  const PE = (await import("../engine/position.mjs")).default;
  const { pricingFromBook } = await import("../engine/book-inputs.mjs");
  const RULE = { salt: { shortfall: true, gifts: true, writtenOff: true } };
  const lot = (on, more) => Object.assign({ rid: "p1", qty: 50, receivedQty: 50, total: 2500, date: on, receivedOn: on, status: "paid" }, more || {});
  const sold = (rows) => rows.filter((s) => (s.product || "salt") === "salt").reduce((t, s) => t + (+s.deliveredQty || 0), 0);
  const ctx = (sales, B, lock) => ({ B: Object.assign({ sales, defaultProd: "salt" }, B || {}), W: { selfUse: 10, soldUnits: sold(sales) }, R: { RULES: { nrsFloor: RULE, lockDays: lock || 4 } } });
  const read = (sales, B, lock) => S.nrsShare(ctx(sales, B, lock), "salt");
  const bare = (r) => r && { share: r.share, shortfall: r.shortfall, gifts: r.gifts, writtenOff: r.writtenOff, paid: r.paid };
  const same = (a, b) => JSON.stringify(bare(a)) === JSON.stringify(bare(b));

  /* the book as it stood at the count of 05 Nov: a lot landed on 03 Nov, and one handover between the two */
  const before = [
    { rid: "a", qty: 80, deliveredQty: 80, total: 8000, cash: 8000, date: "2026-10-20", deliveredOn: "2026-10-20" },
    { rid: "b", qty: 4, deliveredQty: 4, total: 200, goodwill: true, date: "2026-10-25", deliveredOn: "2026-10-25" },
    { rid: "c", qty: 2, deliveredQty: 2, total: 200, defaulted: true, defaultedOn: "2026-10-30", date: "2026-10-10", deliveredOn: "2026-10-10" },
    { rid: "d", qty: 5, deliveredQty: 5, total: 500, cash: 500, coverUnits: 1, date: "2026-11-04", deliveredOn: "2026-11-04" },
    { rid: "w", qty: 2, deliveredQty: 2, total: 200, cash: 0, date: "2026-10-12", deliveredOn: "2026-10-12" },
    { rid: "s", qty: 5, deliveredQty: 2, total: 500, cash: 500, date: "2026-11-01", amend: [{ kind: "Fulfilment", date: "2026-11-01", kg: 2, cash: 500 }] },
    { rid: "g", qty: 7, deliveredQty: 7, total: 70, goodwill: true, product: "oil", date: "2026-10-20", deliveredOn: "2026-10-20" }];
  const AT = { counts: [{ date: "2026-10-01", product: "salt", qty: 9 }, { date: "2026-11-05", product: "salt", qty: 30 }], purchases: [lot("2026-11-03")], selfUseLog: [] };

  /* 1. NOTHING AFTER THE ANCHOR: THE LIVE READING, WITH ITS DAY */
  const live = read(before), held = read(before, AT);
  ok(live && !("at" in live) && !("by" in live) && live.paid === 88 && live.gifts === 5 && live.writtenOff === 2 && live.share === +(17 / 88).toFixed(6),
    "a book with no count, loss or lot reads live and names no day: " + JSON.stringify(live));
  ok(held && same(held, live) && held.at === "2026-11-05" && held.by === "count",
    "with nothing after it, the reading at the count of 05 Nov is the live one and says the count measured it, the later of the count and the lot of 03 Nov: " + JSON.stringify(held));

  /* 2. TRADING ON OR AFTER THE ANCHOR MOVES NOTHING */
  const later = before.map((s) => s.rid === "w" ? Object.assign({}, s, { defaulted: true, defaultedOn: "2026-11-06" })
    : s.rid === "s" ? Object.assign({}, s, { deliveredQty: 5, amend: s.amend.concat([{ kind: "Fulfilment", date: "2026-11-08", kg: 3, cash: 0 }]) }) : s).concat([
    { rid: "h", qty: 6, deliveredQty: 6, total: 600, cash: 600, date: "2026-11-05", deliveredOn: "2026-11-05" },
    { rid: "i", qty: 9, deliveredQty: 9, total: 900, cash: 900, date: "2026-11-07", deliveredOn: "2026-11-07" },
    { rid: "j", qty: 3, deliveredQty: 3, total: 150, goodwill: true, date: "2026-11-06", deliveredOn: "2026-11-06" },
    { rid: "k", qty: 4, deliveredQty: 4, total: 400, cash: 400, coverUnits: 2, date: "2026-11-07", deliveredOn: "2026-11-07" },
    { rid: "x", qty: 8, deliveredQty: 8, total: 800, cancelled: true, date: "2026-11-06", deliveredOn: "2026-11-06" }]);
  const still = read(later, AT), moved = read(later);
  ok(moved && moved.paid === 114 && moved.gifts === 10 && moved.writtenOff === 4 && !same(moved, live),
    "the same book read live has moved: 114 paid for (a cancelled row's 8 handed over among them, as the walk counts them), 10 given, 4 written off: " + JSON.stringify(moved));
  ok(still && same(still, held) && still.at === "2026-11-05",
    "a handover on the count's own day and after it, a gift, reward cover, a write-off, the second part of a handover and a cancelled row's units, all on or after 05 Nov, leave the reading as it stood: " + JSON.stringify(still));
  const one = (rid) => read(before.concat(later.filter((s) => s.rid === rid)), AT);
  ok(["h", "i", "j", "k", "x"].every((rid) => same(one(rid), held)),
    "each of them alone moves nothing either: " + JSON.stringify(["h", "i", "j", "k", "x"].map((rid) => [rid, (one(rid) || {}).paid, (one(rid) || {}).gifts])));
  const wOnly = read(before.map((s) => s.rid === "w" ? Object.assign({}, s, { defaulted: true, defaultedOn: "2026-11-06" }) : s), AT);
  const wEarly = read(before.map((s) => s.rid === "w" ? Object.assign({}, s, { defaulted: true, defaultedOn: "2026-11-04" }) : s), AT);
  const wDay = read(before.map((s) => s.rid === "w" ? Object.assign({}, s, { defaulted: true, defaultedOn: "2026-11-05" }) : s), AT);
  ok(same(wOnly, held) && same(wDay, held) && wEarly && wEarly.writtenOff === 4 && wEarly.paid === 86,
    "a row written off on 06 Nov, or on the count's own day, stays paid for until the next measure, and one written off on 04 Nov is counted: " + JSON.stringify([bare(wOnly), bare(wDay), bare(wEarly)]));

  /* 3. A COUNT, A LOSS AND A LANDED LOT EACH RE-MEASURE; NOTHING ELSE DOES */
  const count = read(later, Object.assign({}, AT, { counts: AT.counts.concat([{ date: "2026-11-09", product: "salt", qty: 12 }]) }));
  const loss = read(later, Object.assign({}, AT, { selfUseLog: [{ date: "2026-11-09", kg: 1, why: "spillage", product: "salt" }] }));
  const landed = read(later, Object.assign({}, AT, { purchases: AT.purchases.concat([lot("2026-11-09", { rid: "p2" })]) }));
  ok([[count, "count"], [loss, "loss"], [landed, "lot"]].every((x) => x[0] && same(x[0], moved) && x[0].at === "2026-11-09" && x[0].by === x[1]),
    "a count, a recorded loss and a landed lot on 09 Nov each bring everything before that day in, and each says what measured it: " + JSON.stringify([count, loss, landed].map((r) => r && [r.at, r.by, r.paid])));
  const oil = read(later, Object.assign({}, AT, { counts: AT.counts.concat([{ date: "2026-11-09", product: "oil", qty: 12 }]), selfUseLog: [{ date: "2026-11-09", kg: 1, why: "spillage", product: "oil" }] }));
  const road = read(later, Object.assign({}, AT, { purchases: AT.purchases.concat([lot("2026-11-09", { rid: "p3", pending: true }), Object.assign(lot("2026-11-09", { rid: "p4" }), { receivedQty: 0, receivedOn: null, inTransit: true })]) }));
  ok(same(oil, held) && oil.at === "2026-11-05" && same(road, held) && road.at === "2026-11-05",
    "another book's count or loss, and a lot still pending or on the road, are no measure of salt: " + JSON.stringify([oil && oil.at, road && road.at]));
  const mid = read(later, Object.assign({}, AT, { counts: AT.counts.concat([{ date: "2026-11-07", product: "salt", qty: 12 }]) }));
  ok(mid && mid.at === "2026-11-07" && mid.paid === 100 && mid.gifts === 8 && mid.writtenOff === 4,
    "a count on 07 Nov takes in what left before that day (the handover of 05 Nov, the gift and the write-off of 06 Nov) and leaves that day's own: " + JSON.stringify(mid));

  /* 4. THE DAY OF A WRITE-OFF */
  const off = { rid: "o", qty: 1, deliveredQty: 1, total: 100, defaulted: true, date: "2026-10-01", deliveredOn: "2026-10-02" };
  const corr = Object.assign({}, off, { amend: [{ kind: "Correction", date: "2026-10-20", kg: 0 }, { kind: "Correction", date: "2026-10-09", kg: 0 }, { kind: "Correction", date: "2026-10-25", kg: 0, undone: true }] });
  ok(PE.writeOffDay(Object.assign({}, corr, { defaultedOn: "2026-11-02" }), 4) === "2026-11-02" && PE.writeOffDay(corr, 4) === "2026-10-20"
    && PE.writeOffDay(off, 4) === "2026-10-06" && PE.writeOffDay(off, 7) === "2026-10-09" && PE.writeOffDay(off) === "2026-10-06",
    "a write-off's day is the fold's stamp, else the newest Correction standing on the row, else the first handover plus the lock (4 days where none is given): "
      + JSON.stringify([PE.writeOffDay(Object.assign({}, corr, { defaultedOn: "2026-11-02" }), 4), PE.writeOffDay(corr, 4), PE.writeOffDay(off, 4), PE.writeOffDay(off, 7), PE.writeOffDay(off)]));
  const byCorr = (on) => read(before.map((s) => s.rid === "w" ? Object.assign({}, s, { defaulted: true, amend: [{ kind: "Correction", date: on, kg: 0 }] }) : s), AT);
  ok(same(byCorr("2026-11-06"), held) && byCorr("2026-11-02").writtenOff === 4,
    "with no stamp the Correction that wrote the row off dates it: 06 Nov waits, 02 Nov is counted: " + JSON.stringify([bare(byCorr("2026-11-06")), bare(byCorr("2026-11-02"))]));

  const noDay = (lock) => read(before.map((s) => s.rid === "w" ? Object.assign({}, s, { defaulted: true }) : s), AT, lock);
  ok(noDay(4).writtenOff === 4 && same(noDay(30), held),
    "a write-off with no stamp and no Correction is dated its first handover plus the book's own lock: 16 Oct on a lock of 4 days is counted, 11 Nov on a lock of 30 waits: " + JSON.stringify([bare(noDay(4)), bare(noDay(30))]));

  /* 5. THE FROZEN BOOK: A SALE AFTER THE ANCHOR MOVES NO FLOOR AND NO DISCOUNT, A COUNT AFTER IT DOES */
  const frozen = () => JSON.parse(fs.readFileSync(FROZEN_BOOK, "utf8")), NOW = Date.parse("2026-10-16T04:00:00Z");
  const b0 = frozen(), salt0 = pricingFromBook(b0, NOW).byProduct.salt, n0 = salt0.inputs.cost.nrs;
  const days = (rows, f) => (rows || []).filter((r) => r && (r.product || "salt") === "salt").map(f).filter(Boolean).map(String).sort().pop() || "";
  const anchor = [days(b0.COUNTS, (c) => c.date), days(b0.selfUseLog, (c) => c.date), (PE.latestCogs((b0.purchases || []).filter((p) => (p.product || "salt") === "salt")) || {}).date || ""].sort().pop();
  const add = (b, on, qty) => { b.sales.push({ rid: "s9999", customer: b.sales[0].customer, product: "salt", date: on, deliveredOn: on, qty, deliveredQty: qty, total: 120 * qty, cash: 120 * qty, status: "paid" }); b.STATED_STOCK = +(b.STATED_STOCK - qty).toFixed(2); return b; };
  const next = new Date(Date.parse(anchor + "T00:00:00Z") + 864e5).toISOString().slice(0, 10);
  const b1 = add(frozen(), next, 3), salt1 = pricingFromBook(b1, NOW).byProduct.salt, n1 = salt1.inputs.cost.nrs;
  const quotes = (s) => { const K = E.costStack(s.inputs.cost), P = s.inputs.policy; return [1, 3, 6.25, 12.5].map((q) => [E.floorTotal(q, K, P), E.quoteAt(q, K, P, -0.5), E.quoteAt(q, K, P, -1)]); };
  ok(n0 && n0.at === anchor && /^\d{4}-\d{2}-\d{2}$/.test(anchor) && n1 && JSON.stringify(n1) === JSON.stringify(n0)
    && JSON.stringify(salt1.floors) === JSON.stringify(salt0.floors) && JSON.stringify(quotes(salt1)) === JSON.stringify(quotes(salt0)),
    "on the frozen book, measured at " + anchor + ", 3 units sold and handed over on " + next + " move no salt floor, no -50% price and no partner's price: " + JSON.stringify({ n0, n1 }));
  const counted = (b) => { b.COUNTS = (b.COUNTS || []).concat([{ date: "2026-10-15", product: "salt", qty: b.STATED_STOCK, was: b.STATED_STOCK, drift: 0 }]); return pricingFromBook(b, NOW).byProduct.salt.inputs.cost.nrs; };
  const n2 = counted(add(frozen(), next, 3)), n3 = counted(frozen());
  ok(n2 && n3 && n2.at === "2026-10-15" && n2.by === "count" && n3.at === "2026-10-15" && Math.abs(n2.paid - (n3.paid + 3)) < 0.011 && n2.shortfall === n0.shortfall && n2.share < n3.share,
    "a count on 15 Oct after that sale takes its 3 units in, the shortfall as it was, and the share is lower than the same count without the sale: " + JSON.stringify([n2, n3]));

  /* 6. THE STACK CARRIES THE DAY, AND THE DESK SAYS IT */
  const K1 = E.costStack(Object.assign({}, salt0.inputs.cost, { nrs: { share: 0.2, at: "2026-11-10", by: "count" } })), K0 = E.costStack(Object.assign({}, salt0.inputs.cost, { nrs: { share: 0.2 } }));
  ok(K1.nrsAt === "2026-11-10" && K1.nrsBy === "count" && K1.nrs === 0.2 && !("nrsAt" in K0) && !("nrsBy" in K0) && K0.floorEx === K1.floorEx,
    "the cost stack carries the day and what measured it beside the share, and neither for a live reading: " + JSON.stringify([K1.nrsAt, K1.nrsBy, "nrsAt" in K0]));
  const { openMaster } = await import("../tools/payload.mjs");
  const { w } = await openMaster(process.env.SALT_MASTER || undefined);
  const said = JSON.parse(String(w.eval("JSON.stringify([nrsWhen({nrsAt:'2026-11-10',nrsBy:'count'}),nrsWhen({nrsAt:'2026-11-09',nrsBy:'lot'}),nrsWhen({nrsAt:'2026-08-24',nrsBy:'loss'}),nrsWhen({nrs:0.2}),nrsWhen(null)])")));
  ok(JSON.stringify(said) === JSON.stringify([" as measured at the count of 10 Nov 2026", " as measured at the lot landed on 09 Nov 2026", " as measured at the loss recorded on 24 Aug 2026", "", ""]),
    "the Desk's words for the day: " + JSON.stringify(said));
  const drawn = JSON.parse(String(w.eval("(function(){var k=PROD;PROD='salt';recompute();var c=pxCost(),r=JSON.stringify({page:tabPricing(),when:nrsWhen(c),at:c.nrsAt||null,nrs:(pxInputs().nrs||{}).at||null});PROD=k;recompute();return r;})()")));
  const text = String(drawn.page).replace(/<[^>]+>/g, " ");
  ok(drawn.at && drawn.at === drawn.nrs && drawn.when.length > 20 && text.split("for the units that left unpaid" + drawn.when).length === 3,
    "the Pricing page says when the share was measured, beside it in both places: " + JSON.stringify({ at: drawn.at, when: drawn.when, found: text.split("for the units that left unpaid" + drawn.when).length - 1 }));
}
