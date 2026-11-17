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
import { richOwnerPage, byAct, PART_OF, changeSheet } from "./maker-act.mjs";

const RID = "[0-9a-f]{32}";
const wireBody = (p, route) => p.wire.filter((x) => x.startsWith(route + " POST ")).map((x) => x.slice(x.lastIndexOf("} ") + 2));

export async function run({ ok, pageWork }) {
  const patch = { "ord-r1": { qty: 3, total: 300 }, "ord-r3": { test: true, qty: 3, total: 300 } };
  const p = await richOwnerPage({ pageWork, review: (j) => { for (const o of j.orders) Object.assign(o, patch[o.id] || {}); return j; } });
  try {
    const d = p.d, w = p.w;
    const part = async (name) => { byAct(d, "part.orders." + (PART_OF[name] || name)).click(); await p.work.quiet(); };
    const tapRow = async (id) => { const r = byAct(d, "order.open", id); if (r) r.click(); await p.work.quiet(); return !!r; };
    const cardOf = (id) => [...d.querySelectorAll("#makerReview [data-maker-card]")].find((c) => c.getAttribute("data-maker-card") === id) || null;
    const before = (a, b) => !!a && !!b && !!(a.compareDocumentPosition(b) & w.Node.DOCUMENT_POSITION_FOLLOWING);
    const typed = (el, v) => { el.value = v; el.dispatchEvent(new w.Event("input", { bubbles: true })); };
    const sheetOf = () => d.getElementById("ynSheet");
    const say = (id) => (cardOf(id).querySelector("[data-maker-say]") || { textContent: "" }).textContent;
    let roads = () => [];
    byAct(d, "nav.orders").click(); await p.work.quiet();

    /* A. BANK AND CASH, TWO TILES OVER ONE AMOUNT. 17 Nov 2026: re-aimed to the Change sheet (plan v2): the amount and its two tiles are the Sheet's Received now and Paid by */
    await part("ready"); await tapRow("ord-r2");
    let c = cardOf("ord-r2");
    ok(!["order.pay-amount", "order.pay", "order.pay-by"].some((a) => c.querySelector('[data-act="' + a + '"]')), "A0: the card itself has no amount, no Record button and no road tiles any more");
    let sh = await changeSheet(p, c, { go: false });
    roads = () => [...sh.querySelectorAll('input[data-act="order.change-by"]')];
    ok(sh.querySelectorAll('[data-act="order.change-paid"]').length === 1 && roads().map((r) => r.value).join() === "bank,cash" && roads().every((r) => !r.checked)
      && !["order.received-amount", "order.cash-amount", "order.received", "order.cash"].some((a) => c.querySelector('[data-act="' + a + '"]') || sh.querySelector('[data-act="' + a + '"]')),
      "A1: a ready order takes money in one amount over Bank and Cash on the Change sheet, neither chosen, with no field or button of a road's own left");
    typed(byAct(sh, "order.change-paid"), "25"); d.getElementById("ynGo").click(); await p.work.quiet();
    ok(p.posts.length === 0 && /Choose Bank or Cash first/.test(say("ord-r2")) && p.timers.every((t) => t.ms !== 10000),
      "A2: a Save with no road chosen sends nothing, holds nothing, and says to choose: " + say("ord-r2"));
    sh = await changeSheet(p, cardOf("ord-r2"), { paid: 25, by: "bank", go: false });
    ok(/payment arrived/.test(sh.querySelector("[data-change-told]").textContent), "A3: the Sheet says what they will be told once the figure and the road are there: " + sh.querySelector("[data-change-told]").textContent);
    d.getElementById("ynGo").click(); await p.work.quiet();
    const bank = wireBody(p, "/all/maker/orders/ord-r2/received");
    ok(bank.length === 1 && new RegExp("^\\{\"rid\":\"" + RID + "\",\"amount\":25\\}$").test(bank[0]),
      "A4: Bank sends the order's received, the body the old Record bank payment sent to the byte: " + JSON.stringify(bank));
    const sent = p.posts.length;
    await changeSheet(p, cardOf("ord-r2"), { paid: 50, by: "cash" });
    ok(p.posts.length === sent && !!byAct(d, "order.cash-undo") && p.timers.some((t) => t.ms === 10000 && !t.off),
      "A5: Cash is held ten seconds with its Undo, nothing sent yet");
    p.timers.filter((t) => t.ms === 10000 && !t.off).at(-1).f(); await p.work.quiet();
    const cash = wireBody(p, "/all/maker/orders/ord-r2/cash");
    ok(cash.length === 1 && new RegExp("^\\{\"rid\":\"" + RID + "\",\"amount\":50\\}$").test(cash[0]),
      "A6: and then sends the order's cash, the body the old Record cash sent to the byte: " + JSON.stringify(cash));
    await part("todo"); await tapRow("ord-a1");
    c = cardOf("ord-a1");
    sh = await changeSheet(p, c, { go: false });
    ok(roads().map((r) => r.value + (r.checked ? "*" : "")).join() === "bank*", "A7: an agreed order not yet Ready has Bank alone, chosen: " + roads().map((r) => r.value + r.checked).join());
    typed(byAct(sh, "order.change-paid"), "30"); d.getElementById("ynGo").click(); await p.work.quiet();
    const a1 = wireBody(p, "/all/maker/orders/ord-a1/received");
    ok(a1.length === 1 && new RegExp("^\\{\"rid\":\"" + RID + "\",\"amount\":30\\}$").test(a1[0]), "A8: and its Save sends the received as before: " + JSON.stringify(a1));

    /* B. CHANGE THE ORDER UNDER THE HEAD */
    c = cardOf("ord-a1");
    /* 2 Nov 2026 (his Orders canvas, page 2): the head is the band and its steps; Change the order is a row of the stage's own list (Ready), the Bill is the record under his decision */
    const amend = byAct(c, "order.amend"), money = c.querySelector('h2.salt-settings__head[data-sect="money"]');
    const firstField = c.querySelector("input, select, textarea");
    ok(!!amend && !!amend.closest(".ostagerows") && before(c.querySelector(".ohead"), amend) && before(c.querySelector(".ordsteps"), amend) && before(amend, money) && before(amend, firstField) && !c.querySelector(".maker-foot").contains(amend),
      "B1: Change the order stands under the head, a row of its stage, above the money and every field of the card, never in the foot");
    amend.click(); await p.work.quiet();
    const units = sheetOf() && byAct(sheetOf(), "order.amend-units");
    if (units) units.value = "3";
    const go = d.getElementById("ynGo"); if (go) go.click(); await p.work.quiet();
    const re = p.posts.filter((x) => x.route === "/all/maker/orders/ord-a1/restate");
    ok(re.length === 1 && Object.keys(re[0].body).join() === "rid,qty,total" && re[0].body.qty === 3 && re[0].body.total === 200,
      "B2: and its Sheet sends the same restate, the amend stage's Correction for approval: " + JSON.stringify(re));
    await part("ready"); await tapRow("ord-r1");
    c = cardOf("ord-r1");
    ok(!byAct(c, "order.handed-units") && !byAct(c, "order.handed-rest") && !byAct(c, "order.point-change") && !!byAct(c, "order.handed") && !!byAct(c, "order.amend"),
      "B3: on a Ready order the units field, its tiles and Change point are gone from the card (17 Nov 2026, plan v2): the stage keeps its pill and the Change row");

    /* C. THE UNITS ARE THE SHEET'S: the card's pill hands over all, the Sheet hands over part or finishes at fewer */
    const handed = () => byAct(cardOf("ord-r1"), "order.handed");
    ok(!byAct(c, "order.close") && cardOf("ord-r1").querySelectorAll('[data-act="order.handed"]').length === 1 && handed().hasAttribute("data-handed-all") && handed().textContent === "Handed over, 3 units",
      "C1: the card has one button, the handover of every unit, and no close is offered");
    sh = await changeSheet(p, cardOf("ord-r1"), { go: false });
    const restBox = () => sh.querySelector('fieldset[data-change-field="rest"]');
    ok(restBox().hidden, "C2a: with nothing more handed over the rest tiles are not offered");
    typed(byAct(sh, "order.change-handed"), "2");
    const more = byAct(sh, "order.change-rest", "more"), all = byAct(sh, "order.change-rest", "all");
    ok(!restBox().hidden && more && more.checked && all && !all.checked, "C2: fewer units than ordered show More to come, chosen, and That is all on the Sheet");
    d.getElementById("ynGo").click(); await p.work.quiet();
    const part2 = wireBody(p, "/all/maker/orders/ord-r1/handed");
    ok(part2.length === 1 && new RegExp("^\\{\"rid\":\"" + RID + "\",\"qty\":2\\}$").test(part2[0]),
      "C3: More to come sends the part handover at once, as Handed over sent it: " + JSON.stringify(part2));
    sh = await changeSheet(p, cardOf("ord-r1"), { handed: 2, rest: "all", go: false });
    const n0 = p.posts.length;
    ok(/handed over/.test(sh.querySelector("[data-change-told]").textContent), "C4: the Sheet says what they will be told while That is all is chosen");
    d.getElementById("ynGo").click(); await p.work.quiet();
    const fin = wireBody(p, "/all/maker/orders/ord-r1/handed");
    ok(p.posts.length === n0 + 1 && fin.length === 2 && new RegExp("^\\{\"rid\":\"" + RID + "\",\"qty\":2,\"close\":true\\}$").test(fin[1]),
      "C6: That is all sends the close, as Finish at fewer units sent it (one Save, no second ask): " + JSON.stringify(fin));
    sh = await changeSheet(p, cardOf("ord-r1"), { handed: 2, go: false });
    const tiles = [...sh.querySelectorAll('input[data-act="order.change-rest"]'), ...sh.querySelectorAll('input[data-act="order.change-by"]')];
    ok(tiles.length === 4 && tiles.every((r) => r.type === "radio" && r.classList.contains("salt-option__input") && r.closest("label.salt-option") && r.closest("fieldset.salt-options")),
      "C7: every tile is the system's Option recipe, a radio over its 44px face");
    d.getElementById("ynKeep").click(); await p.work.quiet();
    await tapRow("ord-r3");
    sh = await changeSheet(p, cardOf("ord-r3"), { go: false });
    ok(!!sh.querySelector('[data-act="order.change-rest"]') && !!byAct(cardOf("ord-r3"), "order.handed"), "C8: a test order is offered the close too, which the fixture runs at the Desk's own goods (the test surface, P4)");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }
}
