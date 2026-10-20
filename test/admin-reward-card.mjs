/* test/admin-reward-card.mjs: SALT ADMIN, THE ASSOCIATE REWARD CARD (P7, canvas V51 and V52, his rules of 20 Oct 2026). On an associate's salt order,
 * under the Bill: the copper eyebrow, a chip (Reaches a reward, or how far short), the meter of what is carried and what this order adds
 * against the step, and the unit's ringgit net of what he gave under their price. Drawn by the maker harness (test/maker-act.mjs); each check
 * red under its own mutation (test/admin-reward-card.mutations.json):
 *   1  a placed order reads the preview's figures: Reaches a reward, the meter, and the note with the step, the cost, what was given and the net
 *   2  an agreed order reads his reading by its ledgerKey: the chip says how far short, and the meter names the code
 *   3  an order whose unit is raised says the unit is on this delivery, with its net
 *   4  no card on an oil order, nor where the Desk does not read the party as an associate
 *   5  the card's words keep to the Admin's weights: nothing of its own over 500 (the eyebrow is the system's recipe, the Bill's own) */
import { richOwnerPage, byAct } from "./maker-act.mjs";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const meter = (c) => [...c.querySelectorAll(".salt-meter__line > span")].map(t).join(" | ");

export async function run({ ok, pageWork }) {
  const base = { u: "abcd-efgh", product: "salt", msgs: [], history: [], payments: [], paid: 0, qty: 1, total: 100, delivery: 0, mode: "collect", at: "2026-10-10T02:00:00.000Z" };
  const extra = [{ ...base, id: "ord-r1", status: "placed" },
    { ...base, id: "ord-r2", status: "acknowledged", ledgerKey: "AX1-ZED|2026-10-10|100" },
    { ...base, id: "ord-r3", status: "acknowledged", ledgerKey: "AX2-ZED|2026-10-10|100" },
    { ...base, id: "ord-r4", status: "acknowledged", product: "oil", ledgerKey: "AX1-ZED|2026-10-10|100|oil" },
    { ...base, id: "ord-r5", status: "acknowledged", ledgerKey: "CX1-ZED|2026-10-10|100" }];
  const reading = (more) => ({ associate: true, departed: false, times: 10, rate: 58, step: 580, progress: 300, next: 0.52, given: 20, net: 38, order: null, unit: null, ...more });
  const routes = {
    ["/all/maker/reward/" + encodeURIComponent("AX1-ZED|2026-10-10|100")]: { ok: true, reading: reading({ order: { rid: "s1", margin: 70, paid: false, step: 580, reaches: false, short: 210 } }) },
    ["/all/maker/reward/" + encodeURIComponent("AX2-ZED|2026-10-10|100")]: { ok: true, reading: reading({ unit: { rid: "s2", cost: 58, given: 20, net: 38, delivered: false } }) },
    ["/all/maker/reward/" + encodeURIComponent("AX1-ZED|2026-10-10|100|oil")]: { ok: true, reading: reading({ order: { margin: 70, reaches: false, short: 210, step: 580 } }) },
    ["/all/maker/reward/" + encodeURIComponent("CX1-ZED|2026-10-10|100")]: { ok: true, reading: { associate: false } }
  };
  const preview = { ok: true, hash: "a".repeat(64), offerHash: "b".repeat(64), quote: 100, delivery: 0, card: 100, floor: 60, margin: { rm: 42, pct: 42 }, cost: { total: 58 },
    usual: { rate: 100 }, flags: [], row: { qty: 1, total: 100, rwdStep: 580 }, rwd: "cross",
    reward: reading({ progress: 530, order: { rid: null, margin: 70, paid: false, step: 580, reaches: true, short: 0 } }) };
  const p = await richOwnerPage({ pageWork, review: (j) => ({ ...j, orders: (j.orders || []).concat(extra) }),
    extra: (route) => routes[route] || (route === "/all/maker/orders/ord-r1/preview" ? preview : undefined) });
  await p.work.quiet();
  try {
    const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); };
    const card = (id) => p.card(id) && p.card(id).querySelector("[data-reward]");
    await click(byAct(d, "nav.orders")); await click(byAct(d, "part.orders.placed")); await click(byAct(d, "order.open", "ord-r1"));
    /* 1 */
    const c1 = card("ord-r1");
    ok(!!c1 && !c1.hidden && t(c1.querySelector(".salt-eyebrow")) === "Associate reward" && t(c1.querySelector(".salt-status")) === "Reaches a reward"
      && /salt-status--brass/.test(c1.querySelector(".salt-status").className) && meter(c1) === "RM 530.00 + RM 70.00 | Next reward 10 units’ cost"
      && t(c1.querySelector(".orwdnote")) === "Margin past 10 units at landed cost (RM 580.00 at RM 58.00 today). Once paid, 1 unit joins this order at cost, one delivery: RM 58.00, less RM 20.00 given under their Set Price since the last reward, RM 38.00 net. Salt only."
      && c1.querySelector(".salt-meter").style.getPropertyValue("--salt-fill") === "100",
      "a placed order reads the preview: " + t(c1));
    await click(byAct(d, "part.orders.confirmed")); await click(byAct(d, "order.open", "ord-r2"));
    /* 2 */
    const c2 = card("ord-r2");
    ok(!!c2 && !c2.hidden && t(c2.querySelector(".salt-status")) === "RM 210.00 short" && /salt-status--mist/.test(c2.querySelector(".salt-status").className)
      && meter(c2) === "AX1-ZED RM 300.00 + RM 70.00 | Next reward 10 units’ cost" && c2.querySelector(".salt-meter").style.getPropertyValue("--salt-fill") === "64",
      "an agreed order reads his reading by its key: " + t(c2));
    /* 3 */
    await click(byAct(d, "order.open", "ord-r3"));
    const c3 = card("ord-r3");
    ok(!!c3 && !c3.hidden && t(c3.querySelector(".orwdnote")) === "1 reward unit on this delivery, RM 38.00 net." && !c3.querySelector(".salt-meter"),
      "a raised unit says it is on this delivery, with its net: " + t(c3));
    /* 4 */
    await click(byAct(d, "order.open", "ord-r4"));
    const c4 = p.card("ord-r4");
    await click(byAct(d, "order.open", "ord-r5"));
    const c5 = card("ord-r5");
    ok(!!c4 && !c4.querySelector("[data-reward]") && !!c5 && c5.hidden && !t(c5), "no card on oil, none for a party the Desk does not read as an associate: " + t(c5));
    /* 5 */
    const heavy = [...(c2 ? c2.querySelectorAll("*") : [])].filter((n) => !n.matches("h4.salt-eyebrow")).filter((n) => { const fw = p.w.getComputedStyle(n).fontWeight; return fw && fw !== "normal" && +fw > 500 || fw === "bold"; });
    ok(!!c2 && heavy.length === 0, "nothing in the card over the weight of 500: " + heavy.map((n) => n.tagName + ":" + p.w.getComputedStyle(n).fontWeight).join(" "));
  } finally { p.w.close(); }
}
