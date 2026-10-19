/* test/admin-card5.mjs: THE ORDER CARD, THE REST OF FABLE'S LIST (plan 5 of docs/plans-counter-admin.html, 16 Oct 2026).
 *
 * v1117 put progress in the head and Money received in one block, and left three things for later. What is proved here, each check red under its
 * own mutation (test/admin-card5.mutations.json), with invented codes only (rule 2):
 *   A  Bank and Cash are two tiles over one amount: none chosen on a Ready order, Bank alone and chosen on an agreed one; a tap with no road sends
 *      nothing; Bank sends the order's received and Cash its ten-second hold, then its cash, each body byte for byte the one the old buttons sent
 *      for the same figure, so the Desk's rowRoom and the fold's payFault read exactly what they read before
 *   B  Change the order stands under the head, above the money and the units, and sends the same restate (stage amend) it sent
 *   C  the units field has one button: at the size ordered it is the handover with no close offered; fewer show More to come (chosen) and That is
 *      all; More to come sends the part handover and That is all asks on the Sheet and sends the close, each as its old button sent it; a test
 *      order is offered no close; every tile is the system's 44px Option recipe
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage, byAct } from "./maker-act.mjs";

const RID = "[0-9a-f]{32}";
const wireBody = (p, route) => p.wire.filter((x) => x.startsWith(route + " POST ")).map((x) => x.slice(x.lastIndexOf("} ") + 2));

export async function run({ ok, pageWork }) {
  const patch = { "ord-r1": { qty: 3, total: 300 }, "ord-r3": { test: true, qty: 3, total: 300 } };
  const p = await richOwnerPage({ pageWork, review: (j) => { for (const o of j.orders) Object.assign(o, patch[o.id] || {}); return j; } });
  try {
    const d = p.d, w = p.w;
    const part = async (name) => { byAct(d, "part.orders." + name).click(); await p.work.quiet(); };
    const tapRow = async (id) => { const r = byAct(d, "order.open", id); if (r) r.click(); await p.work.quiet(); return !!r; };
    const cardOf = (id) => [...d.querySelectorAll("#makerReview [data-maker-card]")].find((c) => c.getAttribute("data-maker-card") === id) || null;
    const before = (a, b) => !!a && !!b && !!(a.compareDocumentPosition(b) & w.Node.DOCUMENT_POSITION_FOLLOWING);
    const typed = (el, v) => { el.value = v; el.dispatchEvent(new w.Event("input", { bubbles: true })); };
    const sheetOf = () => d.getElementById("ynSheet");
    const say = (id) => (cardOf(id).querySelector("[data-maker-say]") || { textContent: "" }).textContent;
    const roads = (c) => [...c.querySelectorAll('input[data-act="order.pay-by"]')];
    byAct(d, "nav.orders").click(); await p.work.quiet();

    /* A. BANK AND CASH, TWO TILES OVER ONE AMOUNT */
    await part("ready"); await tapRow("ord-r2");
    let c = cardOf("ord-r2");
    ok(c.querySelectorAll('[data-act="order.pay-amount"]').length === 1 && c.querySelectorAll('[data-act="order.pay"]').length === 1
      && roads(c).map((r) => r.value).join() === "bank,cash" && roads(c).every((r) => !r.checked)
      && !["order.received-amount", "order.cash-amount", "order.received", "order.cash"].some((a) => c.querySelector('[data-act="' + a + '"]')),
      "A1: a ready order takes money in one amount over Bank and Cash, neither chosen, with no field or button of a road's own left");
    typed(byAct(c, "order.pay-amount"), "25"); byAct(c, "order.pay").click(); await p.work.quiet();
    ok(p.posts.length === 0 && /Choose Bank or Cash first/.test(say("ord-r2")) && p.timers.every((t) => t.ms !== 10000),
      "A2: a tap with no road chosen sends nothing, holds nothing, and says to choose: " + say("ord-r2"));
    c = cardOf("ord-r2"); typed(byAct(c, "order.pay-amount"), "25"); byAct(c, "order.pay-by", "bank").click();
    ok(byAct(c, "order.pay").textContent === "Record RM 25.00, bank", "A3: the button says the figure and the road: " + byAct(c, "order.pay").textContent);
    byAct(c, "order.pay").click(); await p.work.quiet();
    const bank = wireBody(p, "/all/maker/orders/ord-r2/received");
    ok(bank.length === 1 && new RegExp("^\\{\"rid\":\"" + RID + "\",\"amount\":25\\}$").test(bank[0]),
      "A4: Bank sends the order's received, the body the old Record bank payment sent to the byte: " + JSON.stringify(bank));
    const sent = p.posts.length;
    c = cardOf("ord-r2"); typed(byAct(c, "order.pay-amount"), "50"); byAct(c, "order.pay-by", "cash").click(); byAct(c, "order.pay").click(); await p.work.quiet();
    ok(p.posts.length === sent && !!byAct(d, "order.cash-undo") && p.timers.some((t) => t.ms === 10000 && !t.off),
      "A5: Cash is held ten seconds with its Undo, nothing sent yet");
    p.timers.filter((t) => t.ms === 10000 && !t.off).at(-1).f(); await p.work.quiet();
    const cash = wireBody(p, "/all/maker/orders/ord-r2/cash");
    ok(cash.length === 1 && new RegExp("^\\{\"rid\":\"" + RID + "\",\"amount\":50\\}$").test(cash[0]),
      "A6: and then sends the order's cash, the body the old Record cash sent to the byte: " + JSON.stringify(cash));
    await part("confirmed"); await tapRow("ord-a1");
    c = cardOf("ord-a1");
    ok(roads(c).map((r) => r.value + (r.checked ? "*" : "")).join() === "bank*", "A7: an agreed order not yet Ready has Bank alone, chosen: " + roads(c).map((r) => r.value + r.checked).join());
    typed(byAct(c, "order.pay-amount"), "30"); byAct(c, "order.pay").click(); await p.work.quiet();
    const a1 = wireBody(p, "/all/maker/orders/ord-a1/received");
    ok(a1.length === 1 && new RegExp("^\\{\"rid\":\"" + RID + "\",\"amount\":30\\}$").test(a1[0]), "A8: and its tap sends the received as before: " + JSON.stringify(a1));

    /* B. CHANGE THE ORDER UNDER THE HEAD */
    c = cardOf("ord-a1");
    const amend = byAct(c, "order.amend"), money = [...c.querySelectorAll("h4")].find((h) => h.textContent === "Money received");
    const firstField = c.querySelector("input, select, textarea");
    ok(!!amend && before(c.querySelector(".ordmoney"), amend) && before(amend, money) && before(amend, firstField) && !c.querySelector(".maker-foot").contains(amend),
      "B1: Change the order stands under the head, above the money and every field of the card, never in the foot");
    amend.click(); await p.work.quiet();
    const units = sheetOf() && byAct(sheetOf(), "order.amend-units");
    if (units) units.value = "3";
    const go = d.getElementById("ynGo"); if (go) go.click(); await p.work.quiet();
    const re = p.posts.filter((x) => x.route === "/all/maker/orders/ord-a1/restate");
    ok(re.length === 1 && Object.keys(re[0].body).join() === "rid,qty,total" && re[0].body.qty === 3 && re[0].body.total === 200,
      "B2: and its Sheet sends the same restate, the amend stage's Correction for approval: " + JSON.stringify(re));
    await part("ready"); await tapRow("ord-r1");
    c = cardOf("ord-r1");
    ok(before(byAct(c, "order.handed-units"), byAct(c, "order.amend")), "B3: on a Ready order the units, its main action, stand under the head and Change the order follows them");

    /* C. THE UNITS FIELD HAS ONE BUTTON */
    const rest = () => cardOf("ord-r1").querySelector("fieldset[data-close]");
    const handed = () => byAct(cardOf("ord-r1"), "order.handed");
    ok(!byAct(c, "order.close") && cardOf("ord-r1").querySelectorAll('[data-act="order.handed"]').length === 1 && rest().hidden && handed().textContent === "Handed over, 3 units",
      "C1: at the size ordered the field has one button, the handover, and no close is offered");
    typed(byAct(c, "order.handed-units"), "2");
    const more = byAct(c, "order.handed-rest", "more"), all = byAct(c, "order.handed-rest", "all");
    ok(!rest().hidden && more && more.checked && all && !all.checked && handed().textContent === "Handed over, 2 units",
      "C2: fewer units show More to come, chosen, and That is all, and the button is still the handover: " + handed().textContent);
    handed().click(); await p.work.quiet();
    const part2 = wireBody(p, "/all/maker/orders/ord-r1/handed");
    ok(part2.length === 1 && new RegExp("^\\{\"rid\":\"" + RID + "\",\"qty\":2\\}$").test(part2[0]) && !(sheetOf() && !sheetOf().hidden && /Finish/.test(sheetOf().textContent)),
      "C3: More to come sends the part handover at once, as Handed over sent it: " + JSON.stringify(part2));
    c = cardOf("ord-r1"); typed(byAct(c, "order.handed-units"), "2"); byAct(c, "order.handed-rest", "all").click();
    ok(handed().textContent === "Finish at 2 of 3 units", "C4: That is all turns the one button into the finish: " + handed().textContent);
    const n0 = p.posts.length;
    handed().click(); await p.work.quiet();
    ok(p.posts.length === n0 && !!sheetOf() && /Finish this order at 2 of 3 units/.test(sheetOf().textContent), "C5: and it asks on the Sheet, sending nothing as it opens");
    d.getElementById("ynGo").click(); await p.work.quiet();
    const fin = wireBody(p, "/all/maker/orders/ord-r1/handed");
    ok(fin.length === 2 && new RegExp("^\\{\"rid\":\"" + RID + "\",\"qty\":2,\"close\":true\\}$").test(fin[1]),
      "C6: then sends the close, as Finish at fewer units sent it: " + JSON.stringify(fin));
    const tiles = [...cardOf("ord-r1").querySelectorAll('input[data-act="order.handed-rest"]'), ...roads(cardOf("ord-r1"))];
    ok(tiles.length === 4 && tiles.every((r) => r.type === "radio" && r.classList.contains("salt-option__input") && r.closest("label.salt-option") && r.closest("fieldset.salt-options")),
      "C7: every tile is the system's Option recipe, a radio over its 44px face");
    await tapRow("ord-r3");
    ok(!!cardOf("ord-r3").querySelector('[data-act="order.handed-rest"]') && !!byAct(cardOf("ord-r3"), "order.handed"), "C8: a test order is offered the close too, which the fixture runs at the Desk's own goods (the test surface, P4)");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }
}
