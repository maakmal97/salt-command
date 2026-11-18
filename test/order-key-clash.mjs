/* test/order-key-clash.mjs: TWO ROWS NEVER SHARE A NAME, AND A YES THE BOOK HOLDS IS LET GO (19 Nov 2026, the tie-out's two faults on
 * Salt Admin's Orders: "s395: two rows share its key" and "ssdngq: your yes to its move never reached Approve").
 *   K1  an amendment whose goods and delivery would name another row of theirs on that day is refused, with the way on
 *   K2  an amendment that names no other row, or changes the size alone, goes through
 *   K3  a close at what was handed over that would name another row is refused; a plain handover is not tested and goes through
 *   K4  an early handover's redate onto another row's day and figure is refused
 *   K5  a stale yes to a handover is held by the book when the order and its one row agree on what is out; not when they differ,
 *       not when two rows share the key, and never for another stage
 *   K6  the same for a payment, their credit paid on the row
 *   K7  a cancelled row gives its key to the one live site row that shares it (s393 and s395); any other pair stays twins
 * Every assertion is red under its own mutation (test/order-key-clash.mutations.json); the Desk routes and the tie-out, checked in verify.mjs
 * "28 Sep 2026, fix 3", under test/order-key-clash-fix3.mutations.json. */
import POSITION_ENGINE from "../engine/position.mjs";
import { restateTap, handoverTap, keyClash } from "../engine/stages.mjs";
import { yesHeld, rowIndex } from "../src/orders.js";

const at = new Date("2026-11-18T09:00:00.000Z");
const key = (customer, date, total, delivery) => POSITION_ENGINE.ovKey({ customer, date, total, delivery, product: "salt" });
const row = (over) => Object.assign({ customer: "CQ4-ZEN", date: "2026-11-18", product: "salt", qty: 2, total: 190, delivery: 15, cash: 0, deliveredQty: 0, rid: "s390" }, over || {});
const order = (over) => Object.assign({ id: "20261118131627-kc0001", u: "cq4-zen", code: "CQ4-ZEN", status: "acknowledged", mode: "deliver", product: "salt",
  qty: 2, total: 190, delivery: 15, moved: 0, paid: 0, at: "2026-11-18T05:00:00.000Z", history: [], payments: [],
  ledgerKey: key("CQ4-ZEN", "2026-11-18", 190, 15) }, over || {});
const bookOf = (sales) => ({ version: 1548, sales, state: { OPEN: { byKey: {} } }, pricing: {} });

export async function run({ ok }) {
  const J = JSON.stringify;
  /* another sale of theirs that day at RM 200 in all; the order's own row is RM 205 (goods 190, delivery 15) */
  const own = row(), other = row({ rid: "s385", qty: 2, total: 200, delivery: 0 });
  const book = bookOf([other, own]);
  const ctx = () => ({ book, room: null, earlier: [], live: null });

  /* K1 */
  const a = restateTap(order(), at, { total: 200, delivery: 0 }, ctx());
  ok(a.status === 409 && a.twin === true && /s385/.test(a.error || "") && !a.entry,
    "K1: an amendment that would name another row of theirs that day is refused, the row named: " + J(a));
  const a2 = restateTap(order(), at, { total: 190, delivery: 10 }, ctx());
  ok(a2.status === 409 && a2.twin === true, "K1: goods and delivery are read together, as the key carries them: " + J(a2));

  /* K2 */
  const b = restateTap(order(), at, { total: 195, delivery: 15 }, ctx()), b2 = restateTap(order(), at, { qty: 3, total: 190, delivery: 15 }, Object.assign(ctx(), { book: bookOf([other, own]) }));
  ok(!b.twin && /floor/.test(b.error || ""), "K2: an amendment that names no other row is not a twin, and goes on to the Floor's test: " + J(b));
  ok(!(b2.twin), "K2: a change of size alone keeps the row's name and is never a twin: " + J(b2.error || "ok"));
  ok(keyClash(book, order(), key("CQ4-ZEN", "2026-11-18", 190, 15)) === null && keyClash(book, order(), key("CQ4-ZEN", "2026-11-18", 200, 0)) === other,
    "K2: keyClash names another row only, never the order's own: " + J([keyClash(book, order(), order().ledgerKey)]));

  /* K3: a close at 1 unit restates the goods to half; another row at that figure that day is its twin */
  const half = POSITION_ENGINE.closeGoods(190, 2, 1);
  const twinClose = row({ rid: "s386", qty: 1, total: half, delivery: 15 });
  const moving = order({ status: "ready", moved: 0 });
  const c = handoverTap(moving, { qty: 1, close: true }, at, null, bookOf([twinClose, own]));
  ok(c.status === 409 && c.twin === true && /s386/.test(c.error || ""), "K3: a close that would name another row is refused: " + J(c));
  const c2 = handoverTap(moving, { qty: 1 }, at, null, bookOf([twinClose, own])), c3 = handoverTap(moving, { qty: 1, close: true }, at, null, bookOf([own]));
  ok(!c2.error && c2.entry && !c3.error && c3.entry && c3.entry.status === "Close",
    "K3: a plain handover is not tested, and a close naming no other row goes through: " + J([c2.error, c3.error]));

  /* K4: a wanted-day order acknowledged on the 18th and handed over first on the 19th moves its row to the 19th */
  const acked = order({ status: "ready", wantBy: "2026-11-19", movedOn: "2026-11-19",
    history: [{ at: "2026-11-18T05:00:00.000Z", status: "acknowledged", by: "desk" }] });
  const onNext = row({ rid: "s391", date: "2026-11-19" });
  const d = handoverTap(acked, { qty: 1 }, new Date("2026-11-19T03:00:00.000Z"), null, bookOf([own, onNext]));
  const d2 = handoverTap(acked, { qty: 1 }, new Date("2026-11-19T03:00:00.000Z"), null, bookOf([own]));
  ok(d.status === 409 && d.twin === true && /s391/.test(d.error || "") && !d2.error && d2.entry && d2.entry.redate === true,
    "K4: an early handover's redate onto another row's day and figure is refused; onto a free one it goes through: " + J([d, d2.error]));

  /* K5 */
  const idx = (sales) => { const byKey = new Map(), n = new Map(); for (const s of sales) { const k = POSITION_ENGINE.ovKey(s); byKey.set(k, s); n.set(k, (n.get(k) || 0) + 1); } return { byKey, n }; };
  const out = row({ deliveredQty: 2, deliveredOn: "2026-11-18" }), tied = idx([out]), twins = idx([out, row({ rid: "s392", deliveredQty: 2 })]);
  const moveYes = { stage: "move" }, done = order({ status: "done", moved: 2 });
  ok(yesHeld(moveYes, done, tied.byKey, tied.n) === true, "K5: a stale yes to a handover the book holds is let go");
  ok(yesHeld(moveYes, order({ moved: 1 }), tied.byKey, tied.n) === false, "K5: a stale yes to a handover the row does not hold is still named");
  ok(yesHeld(moveYes, done, twins.byKey, twins.n) === false, "K5: a key two rows share holds no yes");
  ok(yesHeld({ stage: "cancel" }, done, tied.byKey, tied.n) === false && yesHeld({ stage: "amend" }, done, tied.byKey, tied.n) === false,
    "K5: a yes of another stage is never let go this way");

  /* K6 */
  const paidRow = row({ cash: 205, paidOn: "2026-11-18" }), pi = idx([paidRow]);
  ok(yesHeld({ stage: "pay" }, order({ paid: 205 }), pi.byKey, pi.n) === true && yesHeld({ stage: "pay" }, order({ paid: 105, credit: 100 }), pi.byKey, pi.n) === true,
    "K6: a stale yes to a payment the row holds is let go, their credit paid on the row");
  ok(yesHeld({ stage: "pay" }, order({ paid: 100 }), pi.byKey, pi.n) === false, "K6: a payment the row does not hold is still named");

  /* K7 (19 Nov 2026, s393 and s395, his answer A): a cancelled row gives its key to the one live site row that shares it */
  const gone = row({ rid: "s393", cancelled: true, road: "site" }), live = row({ rid: "s395", road: "site" });
  const y1 = rowIndex([gone, live]), y2 = rowIndex([live, gone]), k0 = POSITION_ENGINE.ovKey(live);
  ok(y1.byKey.get(k0) === live && y1.rows.get(k0) === 1 && y2.byKey.get(k0) === live && y2.rows.get(k0) === 1 && y1.ended.get(k0) === gone,
    "K7: a live site row beside a cancelled one of its key is the key's row, counted once, whatever their order; the cancelled one is kept apart: " + J([y1.rows.get(k0), y2.rows.get(k0)]));
  const hand = row({ rid: "s397" }), twoLive = rowIndex([live, row({ rid: "s398", road: "site" })]), handGone = rowIndex([gone, hand]), allGone = rowIndex([gone, row({ rid: "s399", cancelled: true })]);
  ok(twoLive.rows.get(k0) === 2 && handGone.rows.get(k0) === 2 && allGone.rows.get(k0) === 2,
    "K7: two live rows, a hand row beside a cancelled one, and cancelled rows alone are twins as before: " + J([twoLive.rows.get(k0), handGone.rows.get(k0), allGone.rows.get(k0)]));
}
