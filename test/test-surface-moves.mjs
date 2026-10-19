/* test/test-surface-moves.mjs: P4 of the Counter test surface (his answers of 18 Oct 2026, Asks 2, 6 and 7). Every Admin move on an
   example order, composed as the Desk would compose it and run through the order book's decideDesk in the fixture alone; and Reset.
   1. Accept, after its preview, moves a placed example order to Confirmed in the fixture, his Pay first switch kept on it, and the
      book is untouched;
   2. a raise at Accept is refused for their yes, and the same figures sent as an offer go to them as one;
   3. an Accept with a window on a delivery that asked for none carries the window's span;
   4. Handed over whole, and a close short at the goods the Desk's closeGoods states; Cash; Received on a claim waiting;
   5. a retry under an id lands once, and other content under it is refused;
   6. an id that is not an example's never reaches the fixture road: it goes to the Desk;
   7. Reset restores the published orders and drops the receipts, so an old id replays as a new move;
   8. Start empty is refused for 0000-0000 and taken for 0000-0002;
   9. Reset never moves the real book in (no moveIn), and writes no event. */
import { surface } from "./test-surface-harness.mjs";
import * as O from "../stmt/orders.js";
import { exampleAccount, exampleReset } from "../stmt/testfix.js";

export async function run({ ok }) {
  const s = await surface();
  try {
    const at = new Date(Date.now() - 3600e3).toISOString(), digest = "surface-list";
    const base = { product: "salt", qty: 2, total: 190, unit: 95, mode: "collect", place: "", forFriend: false, week: "", digest };
    const ex = (k, patch = {}, body = {}) => ({ ...O.decidePlace("0000-0002", { ...base, ...body, rid: "surface-ex-" + k + "-padded-pad" }, [], at, digest).ev.order,
      id: "20261019010000-ex" + k, ...patch });
    const acked = { status: "acknowledged", history: [{ at, status: "placed", by: "customer" }, { at, status: "acknowledged", by: "desk" }] };
    const claim = { at: "2026-10-19T00:30:00.000Z", amount: 30, method: "transfer", account: "maybiz", claim: "waiting" };
    const seed = [ex("aa1"), ex("aa2", {}, { mode: "deliver", place: "Taman Rekaan" }), ex("aa3", acked, { qty: 3, total: 95 }),
      ex("aa4", { ...acked, payments: [claim], claimed: 30 }), ex("aa5", acked), ex("aa6", acked), ex("aa7")];
    await s.putFixture("0000-0002", { makerOrders: seed, orders: seed });
    const book = () => ({ ev: s.harness.db.prepare("SELECT COUNT(*) AS n FROM ev").get().n, ord: s.harness.db.prepare("SELECT COUNT(*) AS n FROM ord").get().n });
    const before = book();
    const act = async (id, action, body) => { const r = await s.owner("/all/maker/orders/" + id + "/" + action, body); return { status: r.status, body: await r.json() }; };
    const state = async (id) => (await exampleAccount(s.env, "0000-0002")).orders.find((o) => o.id === id) || {};
    const rid = (n) => "surface-move-" + n + "-padded-pad";

    /* 1. Accept, Pay first */
    const pv = await act("20261019010000-exaa1", "preview", { delivery: 0, prepay: true });
    const acc = await act("20261019010000-exaa1", "accept", { delivery: 0, prepay: true, hash: pv.body.hash });
    const a1 = await state("20261019010000-exaa1");
    ok(pv.status === 200 && pv.body.test === true && acc.status === 200 && a1.status === "acknowledged" && a1.prepay === true && JSON.stringify(book()) === JSON.stringify(before),
      "Accept, after its preview, confirms an example order in its fixture with his Pay first switch, and the book is untouched: " + JSON.stringify([pv.status, acc.status, acc.body.error, a1.status, a1.prepay, book()]));

    /* 2. a raise goes for their yes */
    const pvR = await act("20261019010000-exaa7", "preview", { delivery: 0, total: 230 });
    const accR = await act("20261019010000-exaa7", "accept", { delivery: 0, total: 230, hash: pvR.body.hash });
    const off = await act("20261019010000-exaa7", "offer", { delivery: 0, total: 230, hash: pvR.body.offerHash, rid: rid(1) });
    const a7 = await state("20261019010000-exaa7");
    ok(pvR.body.needsYes === true && accR.status === 409 && accR.body.needsYes === true && off.status === 200 && a7.status === "placed"
      && a7.price && a7.price.from === "accept" && a7.price.state === "offered" && a7.price.offer.total === 230,
      "A raise at Accept is refused for their yes, and the same figures sent as an offer go to them as one: " + JSON.stringify([pvR.body.needsYes, accR.status, off.status, off.body.error, a7.price]));

    /* 3. a window at Accept carries its span */
    const day = new Date(Date.now() + 8 * 3600e3 + 2 * 86400e3).toISOString().slice(0, 10);
    const pvW = await act("20261019010000-exaa2", "preview", { delivery: 10, slot: day + "T12" });
    const accW = await act("20261019010000-exaa2", "accept", { delivery: 10, slot: day + "T12", hash: pvW.body.hash });
    const a2 = await state("20261019010000-exaa2");
    ok(accW.status === 200 && a2.status === "acknowledged" && a2.slot === day + "T12" && a2.slotSpan === "12:00-16:00" && a2.delivery === 10,
      "An Accept with a window on a delivery that asked for none carries the window and its span: " + JSON.stringify([accW.status, accW.body.error, a2.slot, a2.slotSpan, a2.delivery]));

    /* 4. Handed over, a close short, Cash, Received */
    const whole = await act("20261019010000-exaa5", "handed", { qty: 2, rid: rid(2) });
    const short = await act("20261019010000-exaa3", "handed", { qty: 2, close: true, rid: rid(3) });
    const cash = await act("20261019010000-exaa6", "cash", { amount: 50, rid: rid(4) });
    const recv = await act("20261019010000-exaa4", "received", { amount: 30, claim: claim.at, rid: rid(5) });
    const [a5, a3, a6, a4] = [await state("20261019010000-exaa5"), await state("20261019010000-exaa3"), await state("20261019010000-exaa6"), await state("20261019010000-exaa4")];
    ok(whole.status === 200 && +a5.moved === 2 && short.status === 200 && a3.qty === 2 && a3.total === 63.33 && a3.closed && cash.status === 200 && +a6.paid === 50
      && recv.status === 200 && a4.payments[0].claim === "received" && +a4.paid === 30 && JSON.stringify(book()) === JSON.stringify(before),
      "Handed over whole, a close short at the Desk's closeGoods (RM 95 for 3 closed at 2 is RM 63.33), Cash and Received each move an example order in its fixture alone: "
      + JSON.stringify([whole.status, a5.moved, short.status, short.body.error, a3.qty, a3.total, cash.status, a6.paid, recv.status, recv.body.error, a4.paid]));

    /* 5. a retry lands once */
    const again = await act("20261019010000-exaa6", "cash", { amount: 50, rid: rid(4) });
    const other = await act("20261019010000-exaa6", "cash", { amount: 20, rid: rid(4) });
    const a6b = await state("20261019010000-exaa6");
    const accAgain = await act("20261019010000-exaa1", "accept", { delivery: 0, prepay: true, hash: pv.body.hash });
    ok(again.status === 200 && again.body.again === true && other.status === 409 && +a6b.paid === 50 && accAgain.status === 200 && accAgain.body.again === true
      && (await state("20261019010000-exaa1")).history.filter((h) => h.status === "acknowledged").length === 1,
      "A retried Cash or Accept under its id lands once, and other content under the same id is refused: " + JSON.stringify([again.status, again.body.again, other.status, a6b.paid, accAgain.status, accAgain.body.error]));

    /* 6. not an example's id: the Desk's road, never the fixture */
    const rev = (await exampleAccount(s.env, "0000-0002")).account.revision, bridged = s.bridge.length;
    const real = await act("20261019010000-r1", "cash", { amount: 5, rid: rid(6) });
    ok(s.bridge.slice(bridged).includes("/_internal/maker/orders/20261019010000-r1/cash") && (await exampleAccount(s.env, "0000-0002")).account.revision === rev && real.status !== 200,
      "An id that is not an example's goes to the Desk's road and never reaches the fixture: " + JSON.stringify([real.status, s.bridge.slice(bridged)]));

    /* 7 and 9. Reset */
    let moved = 0; const moveIn = s.harness.book.moveIn.bind(s.harness.book);
    s.harness.book.moveIn = async (...x) => { moved++; return moveIn(...x); };
    const reset = await exampleReset(s.env, "0000-0002");
    s.harness.book.moveIn = moveIn;
    const back = await exampleAccount(s.env, "0000-0002");
    const replay = await act("20261019010000-exaa6", "cash", { amount: 50, rid: rid(4) });
    ok(reset.ok && back.account.revision >= 0 && JSON.stringify(back.orders.map((o) => [o.id, o.status])) !== "[]"
      && back.orders.find((o) => o.id === "20261019010000-exaa1").status === "placed" && replay.status === 200 && replay.body.again !== true,
      "Reset restores the published orders, and an id from before it replays as a new move: " + JSON.stringify([reset, back.orders.map((o) => o.status), replay.status, replay.body.again]));
    ok(moved === 0 && JSON.stringify(book()) === JSON.stringify(before), "Reset never moves the real book in and writes no event: " + JSON.stringify([moved, book()]));

    /* 8. Start empty */
    await s.putFixture("0000-0000", { makerOrders: seed, orders: seed });
    const e0 = await exampleReset(s.env, "0000-0000", true), e2 = await exampleReset(s.env, "0000-0002", true);
    const empty = await exampleAccount(s.env, "0000-0002"), full = await exampleAccount(s.env, "0000-0000");
    /* and the order book's own op refuses it, whatever reaches it */
    const op0 = s.harness.book.run("fixture-reset", { u: "0000-0000", empty: true, generation: JSON.stringify(["s", "a", "i"]) });
    ok(e0.ok !== true && e2.ok === true && empty.orders.length === 0 && full.orders.length === seed.length && op0.ok === false && op0.status === 400,
      "Start empty is refused for 0000-0000, on the road and by the order book's own op, and starts 0000-0002 with no orders: " + JSON.stringify([e0.error, e2.ok, empty.orders.length, full.orders.length, op0]));
  } finally { s.close(); }
}
