/* test/admin-orders-moves.mjs: SALT ADMIN ORDERS, THE ROW'S MOVE ACTS (25 Oct 2026, his yes to Ask D of the Orders canvas). What is proved here, each check
 * red under its own mutation (test/admin-orders-moves.mutations.json):
 *   1  Withdraw, Ready (to deliver), Handed and Received ask once under their row and send nothing until Yes; Not now sends nothing and takes the ask away
 *   2  Yes sends what the order card sends, once, under a request id: withdraw {rid}, move {rid, status: ready, mode: deliver}, handed {rid, qty: the
 *      order's units}, received {rid, amount, claim}; and the row says so under itself
 *   3  Agree, a collection's Ready and two payments waiting open the order and send nothing; Message opens it with the reply's fold open
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage, byAct } from "./maker-act.mjs";

const J = JSON.stringify;
const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const base = { product: "salt", delivery: 0, paid: 0, msgs: [], payments: [], history: [], at: "2026-10-10T00:00:00.000Z" };
const EXTRA = (u) => [
  { ...base, u, id: "ord-d1", status: "acknowledged", mode: "deliver", qty: 3, total: 300 },
  { ...base, u, id: "ord-s1", status: "acknowledged", mode: "collect", qty: 1, total: 100, payments: [{ claim: "waiting", amount: 50, at: "2026-10-10T03:00:00.000Z" }] },
  { ...base, u, id: "ord-m1", status: "ready", mode: "collect", qty: 1, moved: 1, total: 100 }
];

export async function run({ ok, pageWork }) {
  const p = await richOwnerPage({ pageWork, review: (j) => ({ ...j, orders: (j.orders || []).concat(EXTRA((j.orders || [])[0].u)) }) });
  try {
    await p.work.quiet();
    const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); };
    const card = (id) => { const r = d.querySelector('#makerOrderList .ordcard > [data-order="' + id + '"]'); return r && r.parentNode; };
    const pill = (id) => card(id) && byAct(card(id), "order.move", id);
    const sent = (id, what) => p.posts.filter((x) => x.route === "/all/maker/orders/" + id + "/" + what);
    const opened = (id) => d.getElementById("oSplit").classList.contains("open") && !!d.querySelector('#makerReview [data-maker-card="' + id + '"]');
    await click(byAct(d, "nav.orders"));

    /* 1 and 2: Withdraw on an offer */
    await click(byAct(d, "part.orders.placed"));
    ok(t(pill("ord-p4")) === "Withdraw", "an offer's move is Withdraw: " + t(pill("ord-p4")));
    await click(pill("ord-p4"));
    ok(/^Take back your offer of RM [0-9,.]+ to /.test(t(card("ord-p4").querySelector(".oask__q"))) && sent("ord-p4", "withdraw").length === 0 && !opened("ord-p4") && pill("ord-p4").hidden,
      "Withdraw asks once under its row and sends nothing yet: " + t(card("ord-p4").querySelector(".oask")));
    await click(byAct(card("ord-p4"), "order.move-no", "ord-p4"));
    ok(!card("ord-p4").querySelector(".oask") && sent("ord-p4", "withdraw").length === 0, "Not now takes the ask away and sends nothing");
    await click(pill("ord-p4")); await click(byAct(card("ord-p4"), "order.move-yes", "ord-p4"));
    const w = sent("ord-p4", "withdraw");
    ok(w.length === 1 && /^[0-9a-f]{32}$/.test(w[0].body.rid) && J(Object.keys(w[0].body)) === J(["rid"]), "Yes sends the card's withdraw once, with its request id: " + J(w.map((x) => x.body)));
    ok(/Offer withdrawn/.test(t(card("ord-p4") && card("ord-p4").querySelector(".oask"))) || /Offer withdrawn/.test(t(d.getElementById("makerReviewStatus"))) || !card("ord-p4"),
      "and the row says what happened, or has left the stage it was in");

    /* 3: Agree opens the order, sends nothing */
    const before = p.posts.length;
    await click(pill("ord-p1"));
    ok(t(byAct(d, "order.move", "ord-p1")) === "Agree" && opened("ord-p1") && p.posts.filter((x) => !/preview/.test(x.route)).length === before, "Agree opens the order and sends nothing");
    await click(byAct(d, "nav.orders"));

    /* 1 and 2: Ready to deliver; a collection's Ready opens the order (its point is chosen there) */
    await click(byAct(d, "part.orders.confirmed"));
    await click(pill("ord-d1"));
    ok(/ready to deliver\?$/.test(t(card("ord-d1").querySelector(".oask__q"))) && sent("ord-d1", "move").length === 0, "Ready asks once for a delivery: " + t(card("ord-d1").querySelector(".oask__q")));
    await click(byAct(card("ord-d1"), "order.move-yes", "ord-d1"));
    const m = sent("ord-d1", "move");
    ok(m.length === 1 && m[0].body.status === "ready" && m[0].body.mode === "deliver" && /^[0-9a-f]{32}$/.test(m[0].body.rid), "Yes sends the card's Ready to deliver: " + J(m.map((x) => x.body)));
    await click(byAct(d, "part.orders.confirmed"));
    const acts = () => p.posts.filter((x) => !/preview/.test(x.route)).length, b2 = acts();
    await click(pill("ord-a2"));
    ok(opened("ord-a2") && acts() === b2, "a collection's Ready opens the order, where its point is chosen, and sends nothing");
    await click(byAct(d, "nav.orders")); await click(byAct(d, "part.orders.confirmed"));

    /* 1 and 2: Received on one payment; two payments open the order */
    ok(t(pill("ord-s1")) === "Received" && t(pill("ord-a1")) === "Received", "a payment they say they sent is the move Received");
    await click(pill("ord-s1"));
    ok(/^Confirm RM 50\.00 received from /.test(t(card("ord-s1").querySelector(".oask__q"))) && sent("ord-s1", "received").length === 0, "Received asks once: " + t(card("ord-s1").querySelector(".oask__q")));
    await click(byAct(card("ord-s1"), "order.move-yes", "ord-s1"));
    const r = sent("ord-s1", "received");
    ok(r.length === 1 && r[0].body.amount === 50 && r[0].body.claim === "2026-10-10T03:00:00.000Z" && /^[0-9a-f]{32}$/.test(r[0].body.rid), "Yes sends the card's Received: " + J(r.map((x) => x.body)));
    await click(byAct(d, "part.orders.confirmed"));
    const b3 = acts();
    await click(pill("ord-a1"));
    ok(opened("ord-a1") && acts() === b3, "two payments waiting open the order, which reads them, and send nothing");
    await click(byAct(d, "nav.orders"));

    /* 1 and 2: Handed */
    await click(byAct(d, "part.orders.ready"));
    await click(pill("ord-r2"));
    ok(/^Hand over 1 unit to /.test(t(card("ord-r2").querySelector(".oask__q"))) && sent("ord-r2", "handed").length === 0, "Handed asks once: " + t(card("ord-r2").querySelector(".oask__q")));
    await click(byAct(card("ord-r2"), "order.move-yes", "ord-r2"));
    const h = sent("ord-r2", "handed");
    ok(h.length === 1 && h[0].body.qty === 1 && /^[0-9a-f]{32}$/.test(h[0].body.rid) && J(Object.keys(h[0].body).sort()) === J(["qty", "rid"]), "Yes sends the card's handover of the order's units: " + J(h.map((x) => x.body)));

    /* 3: Message opens the order with the reply's fold open */
    await click(byAct(d, "part.orders.paid"));
    ok(t(pill("ord-m1")) === "Message", "goods out and money owed: the move is Message");
    await click(pill("ord-m1"));
    const fold = d.querySelector('#makerReview [data-maker-card="ord-m1"] details[data-fold="answer"]');
    ok(opened("ord-m1") && !!fold && fold.open, "Message opens the order with Answer open");
  } catch (e) { ok(false, "admin-orders-moves stopped on an error: " + (e && e.stack)); }
  finally { p.w.close(); }
}
