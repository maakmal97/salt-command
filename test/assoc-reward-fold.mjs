/* test/assoc-reward-fold.mjs: THE ASSOCIATE REWARD, P3: THE FOLD RAISES THE UNIT AND HANDS IT OVER WITH ITS ORDER (his rules of 20 Oct 2026).
 * On the frozen book with an invented associate (AX1-ZED) and customer (CX1-ZED); each check red under its own mutation
 * (test/assoc-reward-fold.mutations.json):
 *   1  the paying move books exactly one row, of the reward's shape, at the crossing day's landed cost, by an amendment
 *   2  and by a new row drafted paid in full; handed over in the same entry, the unit goes with it
 *   3  a re-run books none, and a reward row he cancelled by hand is not raised again
 *   4  two units crossed by one big order book two
 *   5  the handover that takes the order to its full quantity delivers the unit with it, and the shelf rolls one more
 *   6  a reward raised after its order went out in full waits, and goes with their next salt handover; one whose own order is still to
 *      go out waits for that order, whatever else of theirs is handed over first
 *   7  the stated shelf and the rows' own deliveries move together
 *   8  an undone payment flags the row STALE and withdraws nothing
 *   9  a departed associate gets none
 *   10 a customer who becomes an associate by a ref on a sale opens that day at their %, so no unit is raised in a lump
 *   11 the pricing snapshot (every Floor, the grid, the Ceilings, every card, the delivery the cost stack reads) is byte for byte the same with a
 *      delivered reward row; only the leak's shrink rate, information beside the Floor, reads the unit that left the shelf
 *   12 and the fold tool itself (tools/fold.mjs apply) raises it, reading the scheme from the extract */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { frozenBook } from "./frozen.mjs";
import { readBook, pricingSnapshot } from "../tools/book.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function run({ ok }) {
  const ENG = await import("../engine/apply.mjs"), E = (await import("../engine/position.mjs")).default;
  const { nextRid } = await import("../tools/rid.mjs"), { sortBook } = await import("../tools/sort-ledger.mjs");
  const FOLD = await import(pathToFileURL(join(REPO, "tools", "fold.mjs")).href + "?assocreward");
  const reward = { stated: { salt: { margin: 500, associate: { margin: 470, r3Hurdle: 1.2, times: 10, since: "2026-10-20" } } } };
  const ctx = () => Object.create(FOLD.planCtx, { nextRid: { value: nextRid }, sortBook: { value: sortBook }, reward: { value: reward }, today: { value: "2031-01-09" } });
  const D = (n) => "2031-01-0" + n, T = (n, k) => D(n) + "T0" + k + ":00:00.000Z";
  const base = frozenBook();
  const rate = E.latestCogs(base.purchases.filter((p) => (p.product || "salt") === "salt"), D(2)).rate, step = +(rate * 10).toFixed(2);
  const cost = +(10 * rate).toFixed(2), unit = +(+rate).toFixed(2);
  const top = Math.max(...base.sales.map((s) => E.rewardRid(s.rid)));
  const mk = (extra) => {
    const b = frozenBook();
    b.roster.push("AX1-ZED", "AX1-ZED-R", "CX1-ZED", "CX2-ZED"); b.associates.push("AX1-ZED");
    b.REWARD_OPEN["AX1-ZED"] = { earned: 0, share: 0, upTo: "s" + top, on: "2026-10-20" };
    b.STATED_STOCK = 500;
    (extra || []).forEach((r) => b.sales.push(r));
    return b;
  };
  const order = (rid, more) => ({ rid, customer: "AX1-ZED", product: "salt", date: D(1), qty: 10, total: +(step + cost).toFixed(2), cost, cash: 0, deliveredQty: 0, ...more });
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
  const rewards = (b, code = "AX1-ZED") => b.sales.filter((s) => s.rewardOf && E.ownerCode(s.customer) === code);
  const phys = (b) => b.sales.filter((s) => (s.product || "salt") === "salt").reduce((a, s) => a + (+s.deliveredQty || 0), 0);

  /* 1 */
  const one = go(mk([order("s9001")]), [pay(T(2, 1), "s9001", +(step + cost).toFixed(2), D(2))]);
  const r1 = one.ok ? rewards(one.book) : [];
  const shape = r1[0] && JSON.stringify(Object.keys(r1[0]).sort()) === JSON.stringify(["auto", "cash", "cost", "customer", "date", "deliveredQty", "given", "goodwill",
    "note", "product", "qty", "rebate", "rebateKg", "rewardOf", "rid", "settledRM", "total"].sort());
  ok(one.ok && r1.length === 1 && shape && r1[0].rewardOf === "s9001" && r1[0].qty === 1 && r1[0].total === unit && r1[0].cost === unit && r1[0].settledRM === unit
    && r1[0].cash === 0 && r1[0].rebate === true && r1[0].rebateKg === 1 && r1[0].goodwill === true && r1[0].deliveredQty === 0 && r1[0].auto === true && r1[0].date === D(2)
    && one.moves.some((m) => typeof m === "string" && /^reward unit: /.test(m)),
    "the paying move books one reward row of its shape at the day's landed cost: " + JSON.stringify(one.ok ? r1 : one.problems));
  /* 2 */
  const drafted = go(mk(), [sell(T(2, 1), { customer: "AX1-ZED", date: D(2), qty: 10, total: +(step + cost).toFixed(2), cost, cash: +(step + cost).toFixed(2), deliveredQty: 10 })]);
  const r2 = drafted.ok ? rewards(drafted.book) : [];
  ok(drafted.ok && r2.length === 1 && r2[0].deliveredQty === 1 && drafted.book.sales.some((s) => s.rid === r2[0].rewardOf && s.customer === "AX1-ZED" && s.qty === 10),
    "a new row drafted paid in full that crosses earns at once, and goes with that delivery: " + JSON.stringify(drafted.ok ? r2 : drafted.problems));
  /* 3: a small new order of theirs on the folded book raises nothing more; with the reward row cancelled by hand, still nothing */
  const again = go(JSON.parse(JSON.stringify(one.book)), [sell(T(3, 1), { customer: "AX1-ZED", date: D(3), qty: 1, total: 10, cost: unit, cash: 0, deliveredQty: 0 })]);
  const cancelled = JSON.parse(JSON.stringify(one.book));
  (rewards(cancelled)[0] || {}).cancelled = true;
  const again2 = go(cancelled, [sell(T(3, 1), { customer: "AX1-ZED", date: D(3), qty: 1, total: 10, cost: unit, cash: 0, deliveredQty: 0 })]);
  ok(again.ok && rewards(again.book).length === 1 && again2.ok && rewards(again2.book).length === 1,
    "a re-run books none, and a reward row cancelled by hand is not raised again: " + JSON.stringify([again.ok && rewards(again.book).length, again2.ok && rewards(again2.book).length]));
  /* 4 */
  const big = go(mk([order("s9001", { total: +(2 * step + cost).toFixed(2) })]), [pay(T(2, 1), "s9001", +(2 * step + cost).toFixed(2), D(2))]);
  ok(big.ok && rewards(big.book).length === 2 && rewards(big.book).every((s) => s.rewardOf === "s9001"), "two units crossed by one big order book two: " + (big.ok ? rewards(big.book).length : big.problems));
  /* 5 and 7: paid, then handed over in the same batch */
  const both0 = mk([order("s9001")]), shelf0 = both0.STATED_STOCK, phys0 = phys(both0);
  const both = go(both0, [pay(T(2, 1), "s9001", +(step + cost).toFixed(2), D(2)), hand(T(2, 2), "s9001", 10, D(2))]);
  const r5 = both.ok ? rewards(both.book) : [];
  ok(both.ok && r5.length === 1 && r5[0].deliveredQty === 1 && r5[0].deliveredOn === D(2) && r5[0].handover === "delivered" && both.book.STATED_STOCK === shelf0 - 11
    && ((both.book.NOTES.STATED_STOCK || [])[0] || "").includes("1 unit to AX1-ZED on " + D(2)),
    "the handover delivers the unit with its order and the shelf rolls one more: " + JSON.stringify(both.ok ? [r5, both.book.STATED_STOCK - shelf0] : both.problems));
  ok(both.ok && Math.abs((phys(both.book) - phys0) + (both.book.STATED_STOCK - shelf0)) < 1e-9,
    "the stated shelf and the rows' own deliveries move together: " + JSON.stringify(both.ok && [phys(both.book) - phys0, both.book.STATED_STOCK - shelf0]));
  /* 6: handed over at booking and paid later: the unit waits, and goes with the next salt handover */
  const out0 = mk([order("s9001", { deliveredQty: 10, deliveredOn: D(1), handover: "collected" })]), outShelf = out0.STATED_STOCK;
  const paidLate = go(out0, [pay(T(2, 1), "s9001", +(step + cost).toFixed(2), D(2))]);
  const waits = paidLate.ok && rewards(paidLate.book)[0];
  const next = paidLate.ok && go(paidLate.book, [sell(T(3, 1), { customer: "AX1-ZED", date: D(3), qty: 1, total: 100, cost: unit, cash: 0, deliveredQty: 1, handover: "collected" })]);
  const rode = next && next.ok && rewards(next.book)[0];
  ok(waits && waits.deliveredQty === 0 && paidLate.book.STATED_STOCK === outShelf && rode && rode.deliveredQty === 1 && rode.deliveredOn === D(3) && next.book.STATED_STOCK === outShelf - 2,
    "a reward after the goods went out waits, and goes with the next salt handover: " + JSON.stringify([waits && waits.deliveredQty, rode && rode.deliveredQty, next && next.ok && next.book.STATED_STOCK - outShelf]));
  const early = go(mk([order("s9001")]), [pay(T(2, 1), "s9001", +(step + cost).toFixed(2), D(2)),
    sell(T(2, 2), { customer: "AX1-ZED", date: D(2), qty: 1, total: 100, cost: unit, cash: 0, deliveredQty: 1, handover: "collected" })]);
  ok(early.ok && rewards(early.book).length === 1 && rewards(early.book)[0].deliveredQty === 0,
    "a unit whose own order is still to go out waits for it, though another order of theirs is handed over: " + JSON.stringify(early.ok ? rewards(early.book) : early.problems));
  /* 8: the payment undone (its step marked undone, its cash back off the row), then any move of theirs */
  const undone = JSON.parse(JSON.stringify(one.book)), x = undone.sales.find((s) => s.rid === "s9001");
  x.cash = 0; (x.amend || []).forEach((a) => { if (+a.cash > 0) a.undone = true; });
  const flagged = go(undone, [sell(T(3, 1), { customer: "AX1-ZED", date: D(3), qty: 1, total: 10, cost: unit, cash: 0, deliveredQty: 0 })]);
  ok(flagged.ok && rewards(flagged.book).length === 1 && !rewards(flagged.book)[0].cancelled
    && flagged.moves.some((m) => typeof m === "string" && m.startsWith("STALE reward on " + rewards(flagged.book)[0].rid) && /remove the row in ledger\/book\.json, never cancel/.test(m)),
    "an undone payment flags the reward STALE and withdraws nothing: " + JSON.stringify(flagged.ok ? flagged.moves.filter((m) => typeof m === "string") : flagged.problems));
  /* 9 */
  const gone0 = mk([order("s9001")]); gone0.PEOPLE.departed = (gone0.PEOPLE.departed || []).concat([{ id: "AX1-ZED" }]);
  const gone = go(gone0, [pay(T(2, 1), "s9001", +(step + cost).toFixed(2), D(2))]);
  ok(gone.ok && rewards(gone.book).length === 0, "a departed associate gets none: " + (gone.ok ? rewards(gone.book).length : gone.problems));
  /* 10: CX1-ZED has bought before; a sale to CX2-ZED carrying their ref makes them an associate */
  const flip0 = mk([{ rid: "s9001", customer: "CX1-ZED", product: "salt", date: D(1), qty: 10, total: +(step + cost).toFixed(2), cost, cash: +(step + cost).toFixed(2), deliveredQty: 10 }]);
  const flip = go(flip0, [sell(T(2, 1), { customer: "CX2-ZED", ref: "CX1-ZED", date: D(2), qty: 1, total: 100, cost: unit, cash: 100, deliveredQty: 1 })]);
  const o = flip.ok && flip.book.REWARD_OPEN["CX1-ZED"];
  const was = E.rewardOpening({ sales: flip.ok ? flip.book.sales : [], purchases: base.purchases, state: { ...(flip.ok ? flip.book : {}), REWARD: reward } }, "CX1-ZED", D(2));
  ok(flip.ok && o && o.on === D(2) && o.earned === was.earned && o.share === was.share && rewards(flip.book, "CX1-ZED").length === 0
    && flip.moves.some((m) => typeof m === "string" && m.startsWith("reward opening: CX1-ZED")),
    "a customer who becomes an associate by a ref opens that day at their %, and no unit is raised: " + JSON.stringify([o, flip.ok && rewards(flip.book, "CX1-ZED").length]));
  /* 12 */
  /* the fold reads its scheme from the extract beside the book it folds (--ledger); the suite's book is the frozen fixture, so name the live extract */
  const argv = process.argv.slice();
  process.argv.push("--ledger", join(REPO, "ledger", "ledger.json"));
  const FOLD2 = await import(pathToFileURL(join(REPO, "tools", "fold.mjs")).href + "?assocreward-ledger");
  process.argv.splice(0, process.argv.length, ...argv);
  const viaFold = mk([order("s9001")]);
  const fr = FOLD2.apply(viaFold, { ok: true, count: 1, approved: [pay(T(2, 1), "s9001", +(step + cost).toFixed(2), D(2))] },
    { version: "v9999", date: "02 Jan 2031", title: "A TEST", notes: ["<b>TEST.</b>"], rows: { [T(2, 1)]: { note: "pay" } }, stockNote: "" }, readFileSync(process.env.SALT_MASTER, "utf8"));
  ok(fr.ok && rewards(viaFold).length === 1, "the fold tool raises the unit through its own apply: " + JSON.stringify(fr.ok ? rewards(viaFold).length : fr.problems));
  /* 11: the desk's own pricing snapshot, before and after a delivered reward row is on the book */
  const desk = await readBook();
  try {
    const strip = (p) => { const c = JSON.parse(JSON.stringify(p)); delete c.at;
      for (const b of Object.values(c.byProduct || {})) if (b && b.inputs && b.inputs.cost) delete b.inputs.cost.shrinkRate;
      return JSON.stringify(c); };
    const before = strip(pricingSnapshot(desk.w)), code = desk.w.eval("(networkStats()[0]||{}).id");
    const row = { customer: code, product: "salt", qty: 1, total: unit, cost: unit, cash: 0, settledRM: unit, rebate: true, rebateKg: 1, goodwill: true,
      deliveredQty: 1, deliveredOn: D(2), handover: "delivered", date: D(2), rewardOf: "s1", auto: true, given: 0, rid: "s99999", note: "test" };
    desk.w.eval("sales.push(" + JSON.stringify(row) + ");BASE_SALES.push(" + JSON.stringify(row) + ");PROD='salt';recompute();");
    const after = strip(pricingSnapshot(desk.w));
    ok(before.length > 1000 && before === after, "the pricing snapshot is byte for byte the same with a delivered reward row on the book: " + before.length + " / " + after.length + (before === after ? "" : " at " + [...before].findIndex((ch, i) => ch !== after[i]) + ": " + before.slice([...before].findIndex((ch, i) => ch !== after[i]) - 400, [...before].findIndex((ch, i) => ch !== after[i]) + 40)));
  } finally { desk.dom.window.close(); }
}
