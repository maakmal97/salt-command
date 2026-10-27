/* test/admin-orders-review.mjs: SALT ADMIN ORDERS, THE REVIEW OF 28 OCT 2026 (his word: no UI/UX fault and no bug on the Orders page). What is proved
 * here, each check red under its own mutation (test/admin-orders-review.mutations.json):
 *   1  their credit his Agree spent (v1284, order.credit, kept apart from paid) is paid: the Bill has a Credit line and owes the rest, an order its credit
 *      settles stands under Out or paid, the stage's lead counts the rest owed, and a claim past the rest is Already recorded on the row's ask
 *   2  cash measured as the Desk's cashTap measures it, less their credit: cash past the rest says the excess is a refund to them
 *   3  while cash is held for an order its row offers no move, as its card shuts every control
 *   4  a Ready the Desk refused is said as refused on the row, never "Marked ready"
 *   5  Placed's lead counts what the rows show, goods and delivery
 *   6  a part handed over asks for what is left
 *   7  Not now leaves focus on the row's own move, never on the page
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage, byAct } from "./maker-act.mjs";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const base = { product: "salt", delivery: 0, paid: 0, msgs: [], payments: [], history: [], at: "2026-10-10T00:00:00.000Z" };
const later = { paid: 0 };   /* what a later read says is paid on ord-c5 */
const EXTRA = (u) => [
  { ...base, u, id: "ord-c5", status: "acknowledged", mode: "collect", qty: 1, total: 100, paid: later.paid, claimed: 50,
    payments: [{ claim: "waiting", amount: 50, at: "2026-10-10T05:00:00.000Z" }] },
  { ...base, u, id: "ord-c1", status: "acknowledged", mode: "collect", qty: 1, total: 100, credit: 25 },
  { ...base, u, id: "ord-c2", status: "acknowledged", mode: "collect", qty: 1, total: 100, credit: 100 },
  { ...base, u, id: "ord-c3", status: "acknowledged", mode: "collect", qty: 1, total: 100, credit: 25, claimed: 80,
    payments: [{ claim: "waiting", amount: 80, at: "2026-10-10T03:00:00.000Z" }] },
  { ...base, u, id: "ord-c4", status: "ready", mode: "collect", qty: 1, total: 100, credit: 25 },
  { ...base, u, id: "ord-h1", status: "ready", mode: "collect", qty: 5, moved: 2, total: 500 },
  { ...base, u, id: "ord-y1", status: "ready", mode: "collect", qty: 1, moved: 0, total: 100 },
  { ...base, u, id: "ord-f1", status: "acknowledged", mode: "deliver", qty: 2, total: 200 },
  { ...base, u, id: "ord-q1", status: "placed", mode: "deliver", qty: 1, total: 100, delivery: 15 }
];

export async function run({ ok, pageWork }) {
  const p = await richOwnerPage({ pageWork, review: (j) => ({ ...j, orders: EXTRA((j.orders || [])[0].u) }) });
  try {
    await p.work.quiet();
    const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); };
    const row = (id) => { const r = d.querySelector('#makerOrderList .ordcard > [data-order="' + id + '"]'); return r && r.parentNode; };
    const inPart = (id, k) => !!row(id) && row(id).getAttribute("data-in") === "orders." + k;   /* every stage's rows are drawn, shown by data-in */
    const pill = (id) => row(id) && byAct(row(id), "order.move", id);
    const part = async (k) => { await click(byAct(d, "nav.orders")); await click(byAct(d, "part.orders." + k)); };
    const openCard = async (id) => { await click(row(id).querySelector(".ordrow")); return d.querySelector('#makerReview [data-maker-card="' + id + '"]'); };
    const lead = () => t(d.getElementById("makerReviewStatus"));

    /* 1: credit */
    await part("confirmed");
    ok(inPart("ord-c1", "confirmed") && inPart("ord-c2", "paid"), "an order its credit settles stands under Out or paid, one it leaves owing under Agreed: "
      + [row("ord-c1") && row("ord-c1").getAttribute("data-in"), row("ord-c2") && row("ord-c2").getAttribute("data-in")].join(", "));
    ok(/^RM 450 owed on 4 agreed orders/.test(lead()), "Agreed's lead counts what credit leaves owed (RM 75, RM 75, RM 200 and RM 100): " + lead());
    /* 7: focus after Not now */
    await click(pill("ord-f1")); await click(byAct(row("ord-f1"), "order.move-no", "ord-f1"));
    ok(d.activeElement === pill("ord-f1"), "Not now leaves focus on the row's own move: " + (d.activeElement && d.activeElement.outerHTML.slice(0, 80)));
    /* Fable, 28 Oct 2026: a claim past what credit leaves owed is Already recorded, which books nothing, so the row opens the card and sends nothing */
    const sentN = p.posts.filter((x) => !/preview/.test(x.route)).length;
    await click(pill("ord-c3"));
    const c3 = d.querySelector('#makerReview [data-maker-card="ord-c3"]');
    ok(!row("ord-c3") || !row("ord-c3").querySelector(".oask"), "a claim past what credit leaves owed asks nothing on its row");
    ok(!!c3 && /^Already recorded, RM 80\.00$/.test(t(byAct(c3, "order.claim-received", "2026-10-10T03:00:00.000Z"))) && p.posts.filter((x) => !/preview/.test(x.route)).length === sentN,
      "it opens the card, whose button says Already recorded, and sends nothing: " + t(c3 && byAct(c3, "order.claim-received", "2026-10-10T03:00:00.000Z")));
    await part("confirmed");
    const c1 = await openCard("ord-c1");
    const bill = c1 && c1.querySelector(".ordmoney");
    ok(!!bill && !!bill.querySelector("[data-credit]") && /RM 25\.00/.test(t(bill.querySelector("[data-credit]"))) && /RM 75\.00/.test(t(bill.querySelector(".odue"))),
      "the Bill names their credit and owes the rest: " + t(bill));

    /* 2 and 3: cash on a ready order with credit */
    await part("ready");
    const c4 = await openCard("ord-c4");
    const cashIn = byAct(c4, "order.pay-amount"); cashIn.value = "100"; cashIn.dispatchEvent(new p.w.Event("input", { bubbles: true }));
    byAct(c4, "order.pay-by", "cash").click(); byAct(d, "order.pay", "ord-c4").click(); await p.work.quiet();
    const note = d.querySelector('[data-maker-cash-status="ord-c4"]');
    ok(/RM 25\.00 over what they owe, a refund to them/.test(t(note)), "cash past what credit leaves owed says the excess is a refund: " + t(note));
    await part("ready");
    ok(!!row("ord-c4") && !pill("ord-c4") && !!pill("ord-y1"), "while cash is held its row offers no move, and another row still does: " + [!!row("ord-c4"), t(pill("ord-c4")), t(pill("ord-y1")), t(row("ord-y1"))].join(" / "));
    byAct(d, "order.cash-undo") ? await click(byAct(d, "order.cash-undo")) : null;
    await part("ready");

    /* 6: a part handed over asks for what is left */
    await click(pill("ord-h1"));
    ok(/^Hand over the last 3 units to /.test(t(row("ord-h1").querySelector(".oask__q"))), "a part handed over asks for what is left: " + t(row("ord-h1").querySelector(".oask__q")));
    await click(byAct(row("ord-h1"), "order.move-no", "ord-h1"));

    /* 4: a refused Ready */
    await part("confirmed");
    p.fail.add("/all/maker/orders/ord-f1/move");
    await click(pill("ord-f1")); await click(byAct(row("ord-f1"), "order.move-yes", "ord-f1"));
    const said = t(row("ord-f1") && row("ord-f1").querySelector(".oask"));
    ok(/^Not sent. Check the connection/.test(said) && !/Marked ready|Busy/.test(said), "a refused Ready says the refusal, never marked ready nor busy: " + said);
    p.fail.delete("/all/maker/orders/ord-f1/move");

    /* Fable's re-check: asked while the claim fits, then a read leaves it past what is owed; the Yes opens the card and sends nothing */
    await part("confirmed");
    await click(pill("ord-c5"));
    ok(/^Confirm RM 50[.]00 received from /.test(t(row("ord-c5").querySelector(".oask__q"))), "a claim that fits asks on its row: " + t(row("ord-c5").querySelector(".oask__q")));
    later.paid = 60; await click(byAct(d, "maker.refresh"));
    const before5 = p.posts.filter((x) => x.route.endsWith("ord-c5/received")).length;
    await click(byAct(row("ord-c5"), "order.move-yes", "ord-c5"));
    ok(p.posts.filter((x) => x.route.endsWith("ord-c5/received")).length === before5 && !!d.querySelector('#makerReview [data-maker-card="ord-c5"]'),
      "its Yes after a read left it past what is owed sends nothing and opens the card");

    /* 5: Placed's lead */
    await part("placed");
    ok(t(row("ord-q1").querySelector(".ofig")) === "RM 115" && /^RM 115 waits on your Agree/.test(lead()), "Placed's lead counts what its row shows, goods and delivery: " + t(row("ord-q1").querySelector(".ofig")) + " / " + lead());
  } catch (e) { ok(false, "admin-orders-review stopped on an error: " + (e && e.stack)); }
  finally { p.w.close(); }
}
