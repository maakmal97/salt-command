/* test/admin-change-sheet.mjs: ONE CHANGE SHEET ON EVERY AGREED ORDER (17 Nov 2026, docs/plan-order-changes.html, version 2).
 *
 * An acknowledged, ready or done order's card has one row, Change (act order.amend). It opens the one Sheet for every change: Order (Way, Units, Price,
 * Delivery) and So far (Point, Handed over and The rest, Received now and Paid by), and one Save sends them in a fixed order, stopping at the first that does
 * not land. What is proved here, each check red under its own mutation (test/admin-change-sheet.mutations.json), invented codes only (rule 2):
 *   C1  one Change row on each of the three stages, and none of the retired controls on the card
 *   C2  the groups and fields a stage offers: Ready (collect, units left, two points) the lot, acknowledged Received now and Bank alone, done no So far
 *   C3  Save with one so-far field posts exactly one request, in the body the old control sent
 *   C4  terms and a payment: the restate goes first, then the received; a refused restate stops the rest
 *   C5  the told line: discount, changed, nothing
 *   C6  the Ready stage's pill hands over the full quantity
 *   C7  the one [data-amend] row Needs you's owed-money Record opens the order on (that tap itself: test/admin-needs.mjs)
 *   C8  money above what is owed now, with a terms change, posts nothing
 *   C9  a page with a move on its way posts nothing
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage, byAct, changeSheet, POINTS_ANSWER } from "./maker-act.mjs";

const RID = "[0-9a-f]{32}";
const wireBody = (p, route) => p.wire.filter((x) => x.startsWith(route + " POST ")).map((x) => x.slice(x.lastIndexOf("} ") + 2));
const base = { u: "abcd-efgh", product: "salt", delivery: 0, paid: 0, msgs: [], payments: [], history: [] };

export async function run({ ok, pageWork }) {
  const review = (j) => {
    for (const o of j.orders) if (o.id === "ord-r1") Object.assign(o, { qty: 3, total: 300 });
    j.orders.push({ ...base, id: "ord-d1", status: "done", mode: "collect", qty: 1, total: 100, moved: 1, paid: 100 });
    return j;
  };
  const p = await richOwnerPage({ pageWork, review, extra: POINTS_ANSWER });
  try {
    const d = p.d, w = p.w;
    const part = async (name) => { byAct(d, "part.orders." + name).click(); await p.work.quiet(); };
    const tapRow = async (id) => { const r = byAct(d, "order.open", id); if (r) r.click(); await p.work.quiet(); return !!r; };
    const cardOf = (id) => [...d.querySelectorAll("#makerReview [data-maker-card]")].find((c) => c.getAttribute("data-maker-card") === id) || null;
    const typed = (el, v) => { el.value = v; el.dispatchEvent(new w.Event("input", { bubbles: true })); el.dispatchEvent(new w.Event("change", { bubbles: true })); };
    const heads = (sh) => [...sh.querySelectorAll("[data-change-group]")].map((h) => h.getAttribute("data-change-group")).join();
    const present = (sh, ...acts) => acts.map((a) => !!sh.querySelector('[data-act="' + a + '"]'));
    const closeSheet = async () => { const k = d.getElementById("ynKeep"); if (k) k.click(); await p.work.quiet(); };
    const say = (id) => (cardOf(id).querySelector("[data-maker-say]") || { textContent: "" }).textContent;
    byAct(d, "nav.orders").click(); await p.work.quiet();

    /* C1 */
    const RETIRED = ["order.point-change", "order.handed-units", "order.handed-rest", "order.pay-amount", "order.pay-by", "order.pay"];
    const rows = {};
    await part("todo"); await tapRow("ord-a1"); rows.ack = cardOf("ord-a1");
    await part("open"); await tapRow("ord-r1"); rows.ready = cardOf("ord-r1");
    await part("done"); await tapRow("ord-d1"); rows.done = cardOf("ord-d1");
    const one = (c) => !!c && c.querySelectorAll('[data-act="order.amend"]').length === 1 && byAct(c, "order.amend").textContent === "Change" && byAct(c, "order.amend").hasAttribute("data-amend");
    ok(one(rows.ack) && one(rows.ready) && one(rows.done), "C1: an acknowledged, a ready and a done order each show one row, Change");
    ok(Object.values(rows).every((c) => c && RETIRED.every((a) => !c.querySelector('[data-act="' + a + '"]'))), "C1b: none shows Change point, a units field or an amount control any more");

    /* C2 */
    await part("open"); await tapRow("ord-r1");
    let sh = await changeSheet(p, cardOf("ord-r1"), { go: false });
    ok(heads(sh) === "Order,So far" && present(sh, "order.change-point", "order.change-handed", "order.change-paid").every(Boolean)
      && [...sh.querySelectorAll('[data-act="order.change-by"]')].map((r) => r.value).join() === "bank,cash" && [...sh.querySelectorAll("select[data-change-field=point] option")].filter((o) => o.value).map((o) => o.value).join() === "A2,B3"
      && present(sh, "order.amend-way", "order.amend-units", "order.amend-total", "order.amend-delivery").every(Boolean),
    "C2a: at Ready (collect, units left, two points) the Sheet has Order and So far, Point, Handed over, Received now and Paid by with Bank and Cash: " + heads(sh));
    await closeSheet();
    await part("todo"); await tapRow("ord-a1");
    sh = await changeSheet(p, cardOf("ord-a1"), { go: false });
    ok(heads(sh) === "Order,So far" && J(present(sh, "order.change-paid", "order.change-point", "order.change-handed", "order.change-rest")) === J([true, false, false, false])
      && [...sh.querySelectorAll('[data-act="order.change-by"]')].map((r) => r.value).join() === "bank",
    "C2b: an acknowledged order's So far has Received now and Bank alone: " + heads(sh));
    await closeSheet();
    await part("done"); await tapRow("ord-d1");
    sh = await changeSheet(p, cardOf("ord-d1"), { go: false });
    ok(heads(sh) === "Order" && !sh.querySelector("[data-change-field]") && present(sh, "order.amend-units")[0], "C2c: a done order's Sheet has no So far: " + heads(sh));
    await closeSheet();

    /* C3 */
    p.posts.length = 0;
    await part("todo"); await tapRow("ord-a1");
    await changeSheet(p, cardOf("ord-a1"), { paid: 40, by: "bank" });
    const rec = wireBody(p, "/all/maker/orders/ord-a1/received");
    ok(p.posts.length === 1 && rec.length === 1 && new RegExp("^\\{\"rid\":\"" + RID + "\",\"amount\":40\\}$").test(rec[0]),
      "C3a: Received now 40 by Bank posts exactly one /received with {amount, rid}: " + J(p.posts));
    p.posts.length = 0;
    await part("open"); await tapRow("ord-r1");
    await changeSheet(p, cardOf("ord-r1"), { handed: 2, rest: "all" });
    const hd = wireBody(p, "/all/maker/orders/ord-r1/handed");
    ok(p.posts.length === 1 && hd.length === 1 && new RegExp("^\\{\"rid\":\"" + RID + "\",\"qty\":2,\"close\":true\\}$").test(hd[0]),
      "C3b: Handed over 2 with That is all posts exactly one /handed with {qty, close:true}: " + J(p.posts));
    p.posts.length = 0;
    await changeSheet(p, cardOf("ord-r1"), { point: "B3" });
    const mv = wireBody(p, "/all/maker/orders/ord-r1/move");
    ok(p.posts.length === 1 && mv.length === 1 && new RegExp("^\\{\"rid\":\"" + RID + "\",\"point\":\"B3\"\\}$").test(mv[0]),
      "C3c: a changed point posts exactly one /move with {point, rid}: " + J(p.posts));

    /* C4: ord-a1 owes RM 200; the terms go to Approve, the payment within what is owed now goes after them */
    p.posts.length = 0;
    await part("todo"); await tapRow("ord-a1");
    await changeSheet(p, cardOf("ord-a1"), { total: 180, paid: 50, by: "bank" });
    ok(J(p.posts.map((x) => x.route.split("/").pop())) === J(["restate", "received"]) && p.posts[0].body.total === 180 && p.posts[1].body.amount === 50,
      "C4a: a terms change and a payment within what is owed post the restate first, then the received: " + J(p.posts));
    p.posts.length = 0; p.refuse["/all/maker/orders/ord-a1/restate"] = "The Desk refused the change.";
    await changeSheet(p, cardOf("ord-a1"), { total: 170, paid: 50, by: "bank" });
    ok(p.posts.length === 1 && p.posts[0].route.endsWith("/restate"), "C4b: a restate that is refused (409) stops the rest: nothing else is posted: " + J(p.posts.map((x) => x.route)));
    delete p.refuse["/all/maker/orders/ord-a1/restate"];

    /* C5 */
    const told = (sheet) => sheet.querySelector("[data-change-told]").textContent;
    await tapRow("ord-a1");
    sh = await changeSheet(p, cardOf("ord-a1"), { total: 150, go: false });
    const lower = told(sh); await closeSheet();
    sh = await changeSheet(p, cardOf("ord-a1"), { total: 250, go: false });
    const higher = told(sh); await closeSheet();
    await part("open"); await tapRow("ord-r2");
    sh = await changeSheet(p, cardOf("ord-r2"), { go: false });
    const none = told(sh); await closeSheet();
    ok(/discount/.test(lower) && !/changed/.test(lower) && /changed/.test(higher) && !/discount/.test(higher) && /Nothing is sent/.test(none),
      "C5: the told line says discount for a lower price, changed for a higher one and Nothing is sent with nothing changed: " + J([lower, higher, none]));

    /* C6 */
    p.posts.length = 0;
    await part("open"); await tapRow("ord-r1");
    const handedBefore = wireBody(p, "/all/maker/orders/ord-r1/handed").length;
    byAct(cardOf("ord-r1"), "order.handed").click(); await p.work.quiet();
    const full = wireBody(p, "/all/maker/orders/ord-r1/handed").slice(handedBefore);
    ok(p.posts.length === 1 && full.length === 1 && new RegExp("^\\{\"rid\":\"" + RID + "\",\"qty\":3\\}$").test(full[0]),
      "C6: the Ready stage's pill posts /handed with the full quantity: " + J(p.posts));

    /* C8: money above what is owed now, with a terms change */
    p.posts.length = 0;
    await part("todo"); await tapRow("ord-a1");
    await changeSheet(p, cardOf("ord-a1"), { total: 180, paid: 250, by: "bank" });
    ok(p.posts.length === 0 && /waits for your Approve/.test(say("ord-a1")), "C8: a terms change with more received than is owed now posts nothing and says why: " + J([p.posts, say("ord-a1")]));

    /* C9: a move on its way */
    await part("open"); await tapRow("ord-r2");
    p.posts.length = 0;
    sh = await changeSheet(p, cardOf("ord-r2"), { paid: 25, by: "bank", go: false });
    const release = p.hold("/all/maker/orders/ord-r2/handed");
    /* the held answer keeps the page's work from going quiet, so these wait on the microtask queue alone */
    const tick = async () => { for (let i = 0; i < 60; i++) await Promise.resolve(); };
    byAct(cardOf("ord-r2"), "order.handed").click(); await tick();
    const flying = p.posts.length;
    d.getElementById("ynGo").click(); await tick();
    ok(flying === 1 && p.posts.length === 1 && /on its way/.test(say("ord-r2")), "C9: with another move on its way Save posts nothing and says so: " + J([p.posts.map((x) => x.route), say("ord-r2")]));
    release(); await p.work.quiet();

    /* C7: Needs you's owed-money Record and Handover open the order on its Change row: that tap needs the Needs you fixture of test/admin-needs.mjs, where it is checked
       (its check "Record payment opens the order the row is, on its Change row", with its mutation in test/admin-needs.mutations.json); here, the one row they land on */
    await part("open"); await tapRow("ord-r1");
    const land = d.querySelector("#makerReview [data-amend]");
    ok(!!land && land === byAct(cardOf("ord-r1"), "order.amend") && d.querySelectorAll("#makerReview [data-amend]").length === 1, "C7: the order card has exactly one [data-amend] row, the one Needs you's Record and Handover open it on");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }
}
const J = (v) => JSON.stringify(v);
