/* test/counter-b-start.mjs: COLLECT AND DELIVER ON HOME (Counter Batch B, P2, item 10; his answers 2 and 11 of 18 Oct 2026).
 *
 * Two tiles in Home's first column, I will collect and Deliver to me, each opening the order sheet with that way chosen; at five open
 * orders the sheet's limit step. None under the overdue gate or with nothing priced, and the part greyed and inert when the account is
 * locked. Every assertion observes the signed-in page in jsdom (test/counter-b-kit.mjs); each was proved red by its own mutation
 * (test/counter-b-start.mutations.json, tools/section.mjs).
 *   1  Deliver opens the form with Deliver pressed though the last order was collected; Collect opens it with Collect pressed
 *   2  the Deliver tile says the last place is used, or that one is named, off the same read as the sheet
 *   3  at five open orders a tile opens the limit step, never the form
 *   4  none under the overdue gate or with nothing priced; greyed and inert when locked */
import { open, ord, done, txt, ago, LIST } from "./counter-b-kit.mjs";

export async function run({ ok, pageWork }) {
  const pages = [];
  const page = async (o) => { const p = await open(Object.assign({ pageWork }, o)); pages.push(p); return p; };
  const tile = (p, k) => p.d.querySelector('#hStart [data-start="' + k + '"]');
  const pressed = (p) => { const b = p.d.querySelector('#osheet [data-k^="mode:"][aria-pressed="true"]'); return b ? b.getAttribute("data-k") : null; };
  try {
    /* ---- 1 ---- */
    const A = await page({ orders: [done("o1", ago(300), { mode: "deliver", place: "Veloria" }), done("o2", ago(100))] });
    tile(A, "deliver").click(); await A.settle();
    const p1 = pressed(A), where = A.d.getElementById("oWhere");
    A.d.querySelector('#osheet [data-k="close"]').click(); await A.settle();
    tile(A, "collect").click(); await A.settle();
    const p0 = pressed(A);
    ok(p1 === "mode:1" && !!where && where.value === "Veloria" && p0 === "mode:0" && txt(A.d.querySelector("#hStart .hlab")) === "New order",
      "Deliver to me opens the order sheet with Deliver pressed and the last place filled, though the last order was collected; I will collect opens it with Collect pressed: " + JSON.stringify([p1, p0]));

    /* ---- 2 ---- */
    const N = await page({ orders: [done("o1", ago(100))] });
    const say = (p, k) => [".salt-option__label", ".salt-option__detail"].map((s) => txt(tile(p, k).querySelector(s))).join(" / ");
    ok(say(A, "deliver") === "Deliver to me / To your last place" && say(N, "deliver") === "Deliver to me / To a place you name" && say(N, "collect") === "I will collect / Point told at Ready",
      "the Deliver tile says the last place is used, or that one is named: " + JSON.stringify([say(A, "deliver"), say(N, "deliver")]));

    /* ---- 3 ---- */
    const five = [1, 2, 3, 4, 5].map((i) => ord("o" + i, "placed", ago(i)));
    const L = await page({ orders: five });
    tile(L, "deliver").click(); await L.settle();
    const lim = L.d.querySelector("#osheet .salt-insight--copper");
    ok(!!lim && /^Five open orders is the most/.test(txt(lim)) && !L.d.querySelector('#osheet [data-k^="mode:"]'),
      "at five open orders a tile opens the limit step and not the form: " + txt(lim));

    /* ---- 4 ---- */
    const G = await page({ orders: [done("o1", ago(300))], late: 1 });
    const E = await page({ orders: [], list: Object.assign(LIST(), { products: [] }) });
    const K = await page({ orders: [done("o1", ago(300))], late: 5 });
    const k = K.d.getElementById("hStart");
    ok(!G.d.querySelector("#hStart button") && !E.d.querySelector("#hStart button") && !!tile(N, "collect") && !!k && k.classList.contains("lockd") && k.hasAttribute("inert"),
      "no tiles under the overdue gate or with nothing priced, and the part greyed and inert on a locked account: " + JSON.stringify([!!G.d.querySelector("#hStart button"), !!E.d.querySelector("#hStart button"), k && k.className]));
  } catch (e) { ok(false, "counter-b-start stopped on an error: " + (e && e.stack)); }
  finally { pages.forEach((p) => p.close()); }
}
