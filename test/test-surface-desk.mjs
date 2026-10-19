/* test/test-surface-desk.mjs: P1 of the Counter test surface (his answers of 18 Oct 2026). The Desk's one stateless read,
   POST /_internal/maker/fixture-check, and the third test account, 0000-0002, in the Desk's own literals.
   1. fixture-check answers the word check, the yes rule (a raise; another window) and a close's goods from the Desk's own code;
   2. it reads and writes nothing: no KV write on either side, no D1 statement, no order-book event;
   3. it refuses a missing or wrong maker key with the private route's 404, and a body with any other field;
   4. the claim preview takes 0000-0002 as it takes the other two, and still refuses a real username;
   5. a Desk move on a 0000-0002 order in the real book is refused as it is for 0000-0000, and moves nothing. */
import { surface } from "./test-surface-harness.mjs";
import * as O from "../stmt/orders.js";

export async function run({ ok }) {
  const s = await surface();
  try {
    const check = async (body, key) => { const r = await s.deskCall("/_internal/maker/fixture-check", body, key); return { status: r.status, body: await r.json() }; };
    const before = { kv: s.store.writes + s.queue.writes, sql: s.sqls.length, ev: s.harness.db.prepare("SELECT COUNT(*) AS n FROM ev").get().n };
    const order = { total: 100, qty: 2, mode: "collect" };
    const words = await check({ order, move: { texts: ["Ready at the square"] } });
    const level = await check({ order, move: { texts: ["Fine", "You are gold now"] } });
    ok(words.status === 200 && words.body.ok === true && words.body.yes === false && level.status === 400 && /level/.test(level.body.error),
      "fixture-check passes a plain line and refuses one that names a level, through the Desk's siteWords: " + JSON.stringify([words, level]));
    const raise = await check({ order, move: { total: 120 } }), lower = await check({ order, move: { total: 90 } }), same = await check({ order, move: { total: 100 } });
    ok(raise.body.yes === true && lower.body.yes === false && same.body.yes === false,
      "fixture-check says a raise needs their yes and the same or a lower figure does not (needsYes): " + JSON.stringify([raise.body, lower.body, same.body]));
    const kl = (days) => new Date(Date.now() + 8 * 3600e3 + days * 86400e3).toISOString().slice(0, 10);
    const deliver = { total: 100, qty: 2, mode: "deliver", slot: kl(2) + "T08" };
    const other = await check({ order: deliver, move: { slot: kl(2) + "T12" } }), theirs = await check({ order: deliver, move: { slot: kl(2) + "T08" } });
    const collectSlot = await check({ order, move: { slot: kl(2) + "T12" } });
    ok(other.body.yes === true && other.body.slot === kl(2) + "T12" && theirs.body.yes === false && theirs.body.slot === null && collectSlot.status === 400,
      "fixture-check reads the window by the Desk's slotOf: another window needs their yes, their own is no change, a collection takes none: " + JSON.stringify([other, theirs, collectSlot]));
    const close = await check({ order: { total: 95, qty: 3, mode: "collect" }, move: { close: 2 } }), none = await check({ order, move: {} });
    ok(close.body.close === 63.33 && none.body.close === null,
      "fixture-check states a close's goods by the engine's closeGoods (RM 95 for 3, closed at 2, is RM 63.33): " + JSON.stringify([close.body, none.body]));
    const after = { kv: s.store.writes + s.queue.writes, sql: s.sqls.length, ev: s.harness.db.prepare("SELECT COUNT(*) AS n FROM ev").get().n };
    ok(JSON.stringify(before) === JSON.stringify(after), "fixture-check writes nothing and reads no state: KV writes, D1 statements and book events unchanged: "
      + JSON.stringify([before, after]));
    const wrong = await check({ order, move: {} }, "wrong-capability-wrong-capability-0001");
    const bare = await s.desk.fetch(new Request("https://desk.fixture.test/_internal/maker/fixture-check", { method: "POST", body: JSON.stringify({ order, move: {} }) }), s.deskEnv, {});
    const extra = await check({ order, move: {}, u: "abcd-efgh" }), extraMove = await check({ order, move: { status: "ready" } });
    ok(wrong.status === 404 && bare.status === 404 && extra.status === 400 && extraMove.status === 400,
      "fixture-check refuses a wrong or missing maker key with 404 and any field beyond the order's terms and the move with 400: "
      + [wrong.status, bare.status, extra.status, extraMove.status].join(","));

    /* the claim preview: 0000-0002 as the other two; a real username never */
    const claim = (u) => ({ id: "a20261018070000-c1", u, state: "waiting", amount: 10, at: "2026-10-18T07:00:00.000Z" });
    const snap = (u) => ({ prepared: true, account: { sales: [], claims: [claim(u)], revision: 0 }, orders: [], generation: "g" });
    const preview = (u) => s.deskCall("/_internal/maker/fixture-claims/" + u + "/a20261018070000-c1/preview", snap(u));
    const [p0, p2, pr] = await Promise.all([preview("0000-0000"), preview("0000-0002"), preview("abcd-efgh")]);
    const p2b = await p2.json();
    ok(p0.status === 200 && p2.status === 200 && p2b.ok === true && p2b.test === true && pr.status === 404,
      "The Desk's claim preview takes 0000-0002 as it takes 0000-0000 and still refuses a real username: " + [p0.status, p2.status, pr.status].join(","));
    const real = await s.deskCall("/_internal/maker/claims/0000-0002/a20261018070000-c1/received", { hash: "x", rid: "surface-claim-rid-0001" });
    ok(real.status === 409, "A real claim road refuses 0000-0002 as it refuses the other two: " + real.status);

    /* a Desk move on a 0000-0002 order held in the real book is refused as for 0000-0000 */
    const at = new Date().toISOString();
    const put = (u, n) => {
      const o = O.decidePlace(u, { product: "salt", qty: 2, total: 190, unit: 95, mode: "collect", place: "", forFriend: false, week: "", digest: "d", rid: "surface-place-" + n + "-padded" }, [], at, "d").ev.order;
      o.id = "2026" + "1018" + "070" + String(n).padStart(3, "0") + "-r" + n;
      s.harness.book.append(null, u, o.id, { kind: "place", at, order: o }, null);
      s.harness.book.run("desk", { u, id: o.id, body: { status: "acknowledged", mode: "collect" } });
      return o.id;
    };
    const id0 = put("0000-0000", 1), id2 = put("0000-0002", 2);
    const mv = (id, n) => s.deskCall("/_internal/maker/orders/" + id + "/move", { status: "declined", rid: "surface-move-rid-" + n + "-pad" });
    const [m0, m2] = [await mv(id0, 1), await mv(id2, 2)];
    const b0 = await m0.json(), b2 = await m2.json();
    ok(m2.status === m0.status && m2.status === 409 && b2.error === b0.error && s.harness.book.order("0000-0002", id2).status === "acknowledged",
      "A Desk move on a 0000-0002 order in the real book is refused as it is for 0000-0000, and the order stays: " + JSON.stringify([m0.status, b0.error, m2.status, b2.error]));
  } finally { s.close(); }
}
