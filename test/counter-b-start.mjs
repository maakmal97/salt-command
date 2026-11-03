/* test/counter-b-start.mjs: COLLECT AND DELIVER ON HOME (Counter Batch B, P2, item 10; his answers 2 and 11 of 18 Oct 2026; re-aimed by plan version 8, 03 Nov 2026).
 *
 * Two tiles in Home's first column, I will collect and Deliver to me, each landing on Order with that way chosen (said by the way's line, and
 * pressed when Change opens the sheet); at five open orders Order says the limit and opens no sheet. None under the overdue gate or with nothing
 * priced, and the part greyed and inert when the account is locked. Every assertion observes the signed-in page in jsdom (test/counter-b-kit.mjs);
 * each was proved red by its own mutation (test/counter-b-start.mutations.json, tools/section.mjs).
 *   1  Deliver lands on Order with Delivering to the last place said though the last order was collected, Change pressing Deliver; Collect says Collecting
 *   2  the Deliver tile says the last place is used, or that one is named, off the same read as the sheet
 *   3  at five open orders a tile lands on Order, which says the limit, and opens no sheet
 *   4  none under the overdue gate or with nothing priced; greyed and inert when locked
 * Plan version 8 took the sheet off the tile: it opened the form at a size nobody had chosen. */
import { open, ord, done, txt, ago, LIST } from "./counter-b-kit.mjs";

export async function run({ ok, pageWork }) {
  const pages = [];
  const page = async (o) => { const p = await open(Object.assign({ pageWork }, o)); pages.push(p); return p; };
  const tile = (p, k) => p.d.querySelector('#hStart [data-start="' + k + '"]');
  const pressed = (p) => { const b = p.d.querySelector('#osheet [data-k^="mode:"][aria-pressed="true"]'); return b ? b.getAttribute("data-k") : null; };
  try {
    /* ---- 1 ---- */
    const A = await page({ orders: [done("o1", ago(300), { mode: "deliver", place: "Veloria" }), done("o2", ago(100))] });
    const onOrder = (p) => !p.d.getElementById("pPrices").hidden && !p.d.getElementById("osheet");
    const wayLine = (p) => txt(p.d.querySelector("#pWay .pway__t"));
    tile(A, "deliver").click(); await A.settle();
    const l1 = wayLine(A), on1 = onOrder(A);
    A.d.getElementById("pWayGo").click(); await A.settle();
    const p1 = pressed(A), where = A.d.getElementById("oWhere");
    const waiting = !!A.d.getElementById("spAdd") && !A.d.getElementById("oGo") && !!A.d.getElementById("oDone");
    A.d.querySelector('#osheet [data-k="close"]').click(); await A.settle();
    tile(A, "collect").click(); await A.settle();
    const l0 = wayLine(A), on0 = onOrder(A);
    A.d.getElementById("pWayGo").click(); await A.settle();
    const p0 = pressed(A);
    ok(on1 && on0 && l1 === "Delivering to Veloria" && l0 === "Collecting" && p1 === "mode:1" && !where && waiting && p0 === "mode:0" && txt(A.d.querySelector("#hStart .hlab")) === "New order",
      "Deliver to me lands on Order saying Delivering, and Change opens the sheet with Deliver pressed, no spot picked and no line to review (the last place is no longer filled: Counter Batch C, his answer 4 of 20 Oct 2026); I will collect says Collecting and presses Collect: " + JSON.stringify([on1, on0, l1, l0, p1, p0]));

    /* ---- 2 ---- */
    const N = await page({ orders: [done("o1", ago(100))] });
    const say = (p, k) => [".salt-option__label", ".salt-option__detail"].map((s) => txt(tile(p, k).querySelector(s))).join(" / ");
    ok(say(A, "deliver") === "Deliver to me / To your last place" && say(N, "deliver") === "Deliver to me / To a place you name" && say(N, "collect") === "I will collect / Point told at Ready",
      "the Deliver tile says the last place is used, or that one is named: " + JSON.stringify([say(A, "deliver"), say(N, "deliver")]));

    /* ---- 3 ---- */
    const five = [1, 2, 3, 4, 5].map((i) => ord("o" + i, "placed", ago(i)));
    const L = await page({ orders: five });
    tile(L, "deliver").click(); await L.settle();
    const lim = L.d.getElementById("bkLim");
    ok(!!lim && !lim.hidden && /^Five open orders is the most/.test(txt(lim)) && onOrder(L) && !L.d.querySelector('#osheet [data-k^="mode:"]'),
      "at five open orders a tile lands on Order, which says the limit, and opens no form: " + txt(lim));

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
