/* test/loyalty-fold.mjs: THE LOYALTY UNIT, P2: THE FOLD RAISES THE UNIT AS A GIFT AT COST AND HANDS IT OVER WITH ITS ORDER (his rule of 20 Oct
 * 2026, docs/plan-loyalty-unit.html). On the frozen book with an invented customer (CQ1-ZUL) and associate (AX1-ZED); each check red under its
 * own mutation (test/loyalty-fold.mutations.json):
 *   1  the paying move books exactly one row of the gift's shape (goodwill, total nought, no rebate, loyal) at the crossing day's landed cost
 *   2  a re-run books none, and a loyal row he cancelled by hand is not raised again
 *   3  the associate's due ignores loyal rows and the loyal due ignores the associate's rows
 *   4  a customer's rewardAccount (and its old count), inputResource and the reservation read the same with a loyal row on the book
 *   5  the handover that takes the order to its full quantity delivers the unit with it, and the shelf rolls one more
 *   6  every reader takes it as a gift: it owes nothing and is no revenue; an undone payment flags it STALE and withdraws nothing
 *   7  a departed customer gets none; an order under their price raises none
 *   9  the walk in the fold reads the terms the scheme carries (the extract's TERMS)
 *   10 two units crossed by one big order book two
 *   8  the desk's pricing snapshot and suggestOf for every customer are byte for byte the same with a delivered loyal row on the book */
import { pathToFileURL } from "node:url";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { frozenBook } from "./frozen.mjs";
import { readBook, pricingSnapshot } from "../tools/book.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function run({ ok }) {
  const ENG = await import("../engine/apply.mjs"), E = (await import("../engine/position.mjs")).default;
  const { nextRid } = await import("../tools/rid.mjs"), { sortBook } = await import("../tools/sort-ledger.mjs");
  const FOLD = await import(pathToFileURL(join(REPO, "tools", "fold.mjs")).href + "?loyaltyfold");
  const reward = { stated: { salt: { margin: 500, associate: { margin: 470, r3Hurdle: 1.2, times: 10, since: "2026-10-20" }, loyal: { every: 20, since: "2026-10-21" } } },
    terms: { holdDays: 1, lockDays: 4, lateResetRepeat: 3, lateWindowDays: 90 } };
  const ctx = () => Object.create(FOLD.planCtx, { nextRid: { value: nextRid }, sortBook: { value: sortBook }, reward: { value: reward }, today: { value: "2031-01-09" } });
  const D = (n) => "2031-01-0" + n, T = (n, k) => D(n) + "T0" + k + ":00:00.000Z";
  const base = frozenBook();
  const unit = +(+E.latestCogs(base.purchases.filter((p) => (p.product || "salt") === "salt"), D(2)).rate).toFixed(2);
  const top = Math.max(...base.sales.map((s) => E.rewardRid(s.rid)));
  const mk = (extra) => {
    const b = frozenBook();
    b.roster.push("CQ1-ZUL", "AX1-ZED", "AX1-ZED-R"); b.associates.push("AX1-ZED");
    b.REWARD_OPEN["AX1-ZED"] = { earned: 0, share: 0, upTo: "s" + top, on: "2026-10-20" };
    b.STATED_STOCK = 500;
    (extra || []).forEach((r) => b.sales.push(r));
    return b;
  };
  const order = (rid, more) => ({ rid, customer: "CQ1-ZUL", product: "salt", date: D(1), qty: 20, total: 2000, cost: +(20 * unit).toFixed(2), cash: 0, deliveredQty: 0,
    listRM: 2000, listQty: 20, ...more });
  const pay = (id, rid, cash, day) => ({ id, status: "approved", collection: "sales", amends: rid, amendKind: "Fulfilment", row: { cash: 0 },
    entry: { at: id, payload: { mode: "amend", kind: "Fulfilment", direction: "SELL", date: day, cash, kg: 0 } } });
  const hand = (id, rid, qty, day) => ({ id, status: "approved", collection: "sales", amends: rid, amendKind: "Correction", row: {},
    entry: { at: id, payload: { mode: "amend", kind: "Correction", direction: "SELL", date: day, fields: { deliveredQty: qty, deliveredOn: day, handover: "delivered" } } } });
  const sell = (id, row) => ({ id, status: "approved", collection: "sales", row: { product: "salt", ...row } });
  const go = (book, rows) => {
    const st = { ok: true, count: rows.length, approved: rows };
    const nt = { version: "v9999", rows: Object.fromEntries(rows.map((r) => [r.id, { note: "note " + r.id }])) };
    return ENG.applyBatch(book, st, nt, ctx());
  };
  const loyal = (b, code = "CQ1-ZUL") => b.sales.filter((s) => s.rewardOf && s.loyal && E.ownerCode(s.customer) === code);
  const j = (x) => JSON.stringify(x);

  /* 1 */
  const one = go(mk([order("s9001")]), [pay(T(2, 1), "s9001", 2000, D(2))]);
  const r1 = one.ok ? loyal(one.book) : [];
  const shape = r1[0] && j(Object.keys(r1[0]).sort()) === j(["auto", "cash", "cost", "customer", "date", "deliveredQty", "goodwill", "loyal",
    "note", "product", "qty", "rewardOf", "rid", "total"].sort());
  ok(one.ok && r1.length === 1 && shape && r1[0].rewardOf === "s9001" && r1[0].qty === 1 && r1[0].total === 0 && r1[0].cost === unit && r1[0].cash === 0
    && r1[0].goodwill === true && !r1[0].rebate && r1[0].deliveredQty === 0 && r1[0].auto === true && r1[0].loyal === true && r1[0].date === D(2)
    && one.moves.some((m) => typeof m === "string" && /^loyalty unit: /.test(m)),
    "the paying move books one gift row at the day's landed cost: " + j(one.ok ? r1 : one.problems));
  /* 2 */
  const again = go(JSON.parse(j(one.book)), [sell(T(3, 1), { customer: "CQ1-ZUL", date: D(3), qty: 1, total: 100, cost: unit, cash: 0, deliveredQty: 0 })]);
  const cancelled = JSON.parse(j(one.book));
  (loyal(cancelled)[0] || {}).cancelled = true;
  const again2 = go(cancelled, [sell(T(3, 1), { customer: "CQ1-ZUL", date: D(3), qty: 1, total: 100, cost: unit, cash: 0, deliveredQty: 0 })]);
  ok(again.ok && loyal(again.book).length === 1 && again2.ok && loyal(again2.book).length === 1,
    "a re-run books none, and a loyal row cancelled by hand is not raised again: " + j([again.ok && loyal(again.book).length, again2.ok && loyal(again2.book).length]));
  /* 3: a customer carrying an associate's reward row on s9001 still gets the loyal one; an associate carrying a loyal row on s9002 still gets theirs */
  const assocRow = { customer: "CQ1-ZUL", product: "salt", qty: 1, total: 58, cost: 58, cash: 0, settledRM: 58, rebate: true, rebateKg: 1, goodwill: true,
    deliveredQty: 0, date: D(1), rewardOf: "s9001", auto: true, rid: "s9900" };
  const cross = go(mk([order("s9001"), assocRow]), [pay(T(2, 1), "s9001", 2000, D(2))]);
  const step = +(unit * 10).toFixed(2);
  const aOrder = { rid: "s9002", customer: "AX1-ZED", product: "salt", date: D(1), qty: 10, total: +(step + 10 * unit).toFixed(2), cost: +(10 * unit).toFixed(2), cash: 0, deliveredQty: 0 };
  const loyalOnA = { customer: "AX1-ZED", product: "salt", qty: 1, total: 0, cost: 58, cash: 0, goodwill: true, deliveredQty: 0, date: D(1), rewardOf: "s9002", auto: true, loyal: true, rid: "s9901" };
  const aCross = go(mk([aOrder, loyalOnA]), [pay(T(2, 1), "s9002", aOrder.total, D(2))]);
  const aUnits = aCross.ok ? aCross.book.sales.filter((s) => s.rewardOf === "s9002" && !s.loyal) : [];
  ok(cross.ok && loyal(cross.book).length === 1 && aCross.ok && aUnits.length === 1 && loyal(aCross.book, "AX1-ZED").length === 1,
    "each due counts its own rows: " + j([cross.ok && loyal(cross.book).length, aUnits.length]));
  /* 4 */
  const eb = (b) => ({ sales: b.sales, purchases: b.purchases, state: { ...b, REWARD: reward } });
  const withRow = mk([order("s9001", { cash: 2000, deliveredQty: 20, deliveredOn: D(2) })]), without = JSON.parse(j(withRow));
  withRow.sales.push({ customer: "CQ1-ZUL", product: "salt", qty: 1, total: 0, cost: 58, cash: 0, goodwill: true, deliveredQty: 1, deliveredOn: D(2), date: D(2),
    rewardOf: "s9001", auto: true, loyal: true, rid: "s9902" });
  const spend = { at: "x", payload: { mode: "amend", kind: "Correction", direction: "SELL", rid: "s9902", fields: { rebate: true, rebateKg: 1 } } };
  ok(j(E.rewardAccount(eb(withRow), "CQ1-ZUL")) === j(E.rewardAccount(eb(without), "CQ1-ZUL"))
    && j(E.rewardAccount(eb(withRow), "CQ1-ZUL", "salt", { old: true })) === j(E.rewardAccount(eb(without), "CQ1-ZUL", "salt", { old: true }))
    && E.inputResource(spend, eb(withRow)) === null && E.entryReservationFault(spend, [], eb(withRow)) === "",
    "a customer's reward, its old count and every spend read the same with a loyal row: " + j([E.rewardAccount(eb(withRow), "CQ1-ZUL", "salt", { old: true }),
      E.rewardAccount(eb(without), "CQ1-ZUL", "salt", { old: true }), E.inputResource(spend, eb(withRow))]));
  /* 5 */
  const both0 = mk([order("s9001")]), shelf0 = both0.STATED_STOCK;
  const both = go(both0, [pay(T(2, 1), "s9001", 2000, D(2)), hand(T(2, 2), "s9001", 20, D(2))]);
  const r5 = both.ok ? loyal(both.book) : [];
  ok(both.ok && r5.length === 1 && r5[0].deliveredQty === 1 && r5[0].deliveredOn === D(2) && r5[0].handover === "delivered" && both.book.STATED_STOCK === shelf0 - 21
    && both.moves.some((m) => typeof m === "string" && m.startsWith("loyalty unit " + r5[0].rid + " handed over")),
    "the handover delivers the unit with its order and the shelf rolls one more: " + j(both.ok ? [r5, both.book.STATED_STOCK - shelf0] : both.problems));
  /* 6 */
  const g = r5[0] || {};
  const undone = JSON.parse(j(one.book)), x = undone.sales.find((s) => s.rid === "s9001");
  x.cash = 0; (x.amend || []).forEach((a) => { if (+a.cash > 0) a.undone = true; });
  const flagged = go(undone, [sell(T(3, 1), { customer: "CQ1-ZUL", date: D(3), qty: 1, total: 100, cost: unit, cash: 0, deliveredQty: 0 })]);
  ok(E.txOwed(g) === 0 && E.txStat(g).order === "Completed" && E.txStat(g).pay === "Paid" && E.txGoods(g) === 0
    && flagged.ok && loyal(flagged.book).length === 1 && !loyal(flagged.book)[0].cancelled
    && flagged.moves.some((m) => typeof m === "string" && m.startsWith("STALE loyalty on " + loyal(flagged.book)[0].rid)),
    "it owes nothing and is no revenue, and an undone payment flags it STALE: " + j([E.txStat(g), flagged.ok && flagged.moves.filter((m) => typeof m === "string")]));
  /* 7 */
  const gone0 = mk([order("s9001")]); gone0.PEOPLE.departed = (gone0.PEOPLE.departed || []).concat([{ id: "CQ1-ZUL" }]);
  const gone = go(gone0, [pay(T(2, 1), "s9001", 2000, D(2))]);
  const cheap = go(mk([order("s9001", { total: 1990 })]), [pay(T(2, 1), "s9001", 1990, D(2))]);
  ok(gone.ok && loyal(gone.book).length === 0 && cheap.ok && loyal(cheap.book).length === 0,
    "a departed customer gets none, and an order under their price raises none: " + j([gone.ok && loyal(gone.book).length, cheap.ok && loyal(cheap.book).length]));
  /* 10: 40 units at their price, paid at once: two units, both for s9001 */
  const big = go(mk([order("s9001", { qty: 40, total: 4000, listRM: 4000, listQty: 40 })]), [pay(T(2, 1), "s9001", 4000, D(2))]);
  ok(big.ok && loyal(big.book).length === 2 && loyal(big.book).every((s) => s.rewardOf === "s9001"),
    "two units crossed by one big order book two: " + j(big.ok ? loyal(big.book).length : big.problems));
  /* 9: handed over on 1 Jan and paid on 5 Jan, four days on: late under the master's term of a day, on time under a term of ten */
  const lateOrder = () => mk([order("s9001", { deliveredQty: 20, deliveredOn: D(1), handover: "collected" })]);
  const strict = go(lateOrder(), [pay(T(5, 1), "s9001", 2000, D(5))]);
  const easy = (() => { const r0 = reward.terms; reward.terms = { ...r0, holdDays: 10, lockDays: 20 }; try { return go(lateOrder(), [pay(T(5, 1), "s9001", 2000, D(5))]); } finally { reward.terms = r0; } })();
  ok(strict.ok && loyal(strict.book).length === 0 && easy.ok && loyal(easy.book).length === 1,
    "the walk in the fold reads the terms the scheme carries: " + j([strict.ok && loyal(strict.book).length, easy.ok && loyal(easy.book).length]));
  /* 8 */
  const desk = await readBook();
  try {
    const strip = (p) => { const c = JSON.parse(j(p)); delete c.at;
      for (const b of Object.values(c.byProduct || {})) if (b && b.inputs && b.inputs.cost) delete b.inputs.cost.shrinkRate;
      return j(c); };
    const sug = () => desk.w.eval("JSON.stringify(tierCustomers().map(function(c){return [c.id||c,suggestOf(c.id||c,'salt')];}))");
    const before = strip(pricingSnapshot(desk.w)), sb = sug(), code = desk.w.eval("(networkStats()[0]||{}).id");
    const row = { customer: code, product: "salt", qty: 1, total: 0, cost: unit, cash: 0, goodwill: true, deliveredQty: 1, deliveredOn: D(2), handover: "delivered",
      date: D(2), rewardOf: "s1", auto: true, loyal: true, rid: "s99999", note: "test" };
    desk.w.eval("sales.push(" + j(row) + ");BASE_SALES.push(" + j(row) + ");PROD='salt';recompute();");
    const after = strip(pricingSnapshot(desk.w)), sa = sug();
    ok(before.length > 1000 && before === after && sb.length > 20 && sb === sa,
      "the pricing snapshot and every suggestion are byte for byte the same with a delivered loyal row: " + before.length + " / " + after.length + " " + (sb === sa));
  } finally { desk.dom.window.close(); }
}
