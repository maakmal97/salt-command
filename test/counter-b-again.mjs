/* test/counter-b-again.mjs: ORDER AGAIN (Counter Batch B, P3, item 4; his answers 2, 8 and 9 of 18 Oct 2026).
 *
 * One rule, oAgainOk: an order handed over in full whose size is still on their list, never a withdrawn, declined or group order, nothing
 * under the overdue gate. It stands on the order's screen (a Pill and today's figure off the list), under its card in the list (a ghost
 * beside the card, never inside it) and on Home's tiles; a tap opens the existing sheet at its check, one line at today's figure. Every
 * assertion observes the signed-in page in jsdom (test/counter-b-kit.mjs); each was proved red by its own mutation
 * (test/counter-b-again.mutations.json, tools/section.mjs).
 *   1  only the two orders handed over in full on the list carry it, on their screen, their row and Home's tiles
 *   2  a tap opens the check at the list's figure, never what the order came to; Place posts one body, a fresh rid, no sheet, no note
 *   3  no day wanted from an earlier sheet rides into it
 *   4  none under the overdue gate
 *   5  the card holds no button; a poll that hands an order over brings its Order again, and focus on a ghost stays */
import { open, ord, done, txt, ago, LIST, addSpot } from "./counter-b-kit.mjs";

export async function run({ ok, pageWork }) {
  const pages = [];
  const page = async (o) => { const p = await open(Object.assign({ pageWork }, o)); pages.push(p); return p; };
  const showOrders = async (p) => { p.d.querySelector('button[data-t="order"]').click(); await p.settle(); const e = p.d.querySelector(".olater"); if (e && e.getAttribute("aria-expanded") !== "true") { e.click(); await p.settle(); } };
  const again = (p) => [...p.d.querySelectorAll("#pOrder .olist [data-again]")].map((b) => b.getAttribute("data-again")).sort();
  const C = done("oC", ago(300), { qty: 1, total: 90, msgs: [{ by: "customer", text: "Leave it at the gate", at: ago(300) }] });   /* collected; the list's figure now RM 100 */
  const D = done("oD", ago(200), { qty: 2.5, total: 240, mode: "deliver", place: "Veloria" });   /* delivered; RM 250 now */
  /* each a size and way of its own, so Home's tiles (one a size, way and place) would show any of them the rule let through */
  const rest = [ord("oX", "cancelled", ago(180), { qty: 0.5 }), ord("oN", "declined", ago(170), { qty: 0.75 }), ord("oP", "placed", ago(5), { qty: 5 }),
    ord("oH", "ready", ago(150), { qty: 10, moved: 0.5 }), done("oO", ago(160), { product: "oil", qty: 2, total: 78 }), done("oG", ago(140), { qty: 1.5, pool: "pool-1" })];
  try {
    /* ---- 1 ---- */
    const A = await page({ orders: [C, D].concat(rest) });
    const homeT = [...A.d.querySelectorAll("#hAgain .htile")].length;
    await showOrders(A);
    const rows = again(A);
    const screens = [];
    for (const id of ["oC", "oD", "oP", "oH", "oO", "oG", "oX", "oN"]) {
      A.d.querySelector('#pOrder button[data-row="' + id + '"]').click(); await A.settle();
      const part = A.d.querySelector('.oscreen[data-order="' + id + '"] [data-part="again"]');
      if (part && !part.hidden && part.querySelector("[data-again]")) screens.push(id);
      A.d.querySelector(".oscreen .oback").click(); await A.settle(); await showOrders(A);
    }
    ok(JSON.stringify(rows) === '["oC","oD"]' && JSON.stringify(screens) === '["oC","oD"]' && homeT === 2,
      "only the two orders handed over in full on the list carry Order again, on their screen, under their card and on Home's tiles: " + JSON.stringify({ rows, screens, homeT }));

    /* ---- 2 ---- */
    A.d.querySelector('#pOrder button[data-row="oD"]').click(); await A.settle();
    const line = txt(A.d.querySelector('.oscreen [data-part="again"] p'));
    A.d.querySelector('.oscreen [data-part="again"] [data-again]').click(); await A.settle();
    /* a delivery opens on the form, no spot picked, Review waiting (Counter Batch C, his answer 4 of 20 Oct 2026): the area is added as a spot, then Review */
    const waits = !!A.d.getElementById("spAdd") && A.d.getElementById("oGo").disabled;
    addSpot(A.d, A.w, "Veloria"); await A.settle();
    A.d.getElementById("oGo").click(); await A.settle();
    const sheet = A.d.getElementById("osheet"), checkTxt = txt(sheet);
    A.d.getElementById("oPlace").click(); await A.settle();
    const b = A.st.posts[0] || {};
    ok(waits && line === "RM 250.00 today, same size, delivered" && /Check/.test(checkTxt) && /RM 250\.00/.test(checkTxt) && !/RM 240\.00/.test(checkTxt) && A.st.posts.length === 1
      && b.total === 250 && b.qty === 2.5 && b.mode === "deliver" && b.place === "Veloria" && /^[0-9a-f]{32}$/.test(b.rid || "") && !("sheet" in b) && !b.note,
      "a tap opens the check at today's figure off the list, never what the order came to, and Place posts one body with a fresh rid, no sheet and no note: " + JSON.stringify({ line, b }));

    /* ---- 3 ---- */
    const S = await page({ orders: [C] });
    S.d.querySelector('button[data-t="order"]').click(); await S.settle();
    S.d.getElementById("oNew").click(); await S.settle();
    S.d.querySelector('#osheet [data-k="when:1"]').click(); await S.settle();
    const day = S.d.getElementById("oWant");
    day.value = new Date(Date.now() + 8 * 3600e3 + 3 * 864e5).toISOString().slice(0, 10); day.dispatchEvent(new S.w.Event("change", { bubbles: true }));
    S.d.querySelector('#osheet [data-k="close"]').click(); await S.settle();
    await showOrders(S);
    S.d.querySelector('#pOrder .olist [data-again="oC"]').click(); await S.settle();
    const sayDay = txt(S.d.getElementById("osheet"));
    S.d.getElementById("oPlace").click(); await S.settle();
    const sb = S.st.posts[0] || {};
    ok(S.st.posts.length === 1 && !("wantBy" in sb) && sb.total === 100 && /ASAP/.test(sayDay) && !sb.note,
      "a day wanted in an earlier sheet does not ride into Order again, nor the line on the old order: " + JSON.stringify(sb));

    /* ---- 4 ---- */
    const G = await page({ orders: [C, D], late: 1 });
    await showOrders(G);
    G.d.querySelector('#pOrder button[data-row="oC"]').click(); await G.settle();
    ok(!G.d.querySelector("[data-again]") && !G.d.querySelector("#hAgain .htile"), "no Order again anywhere under the overdue gate");

    /* ---- 5 ---- */
    const F = await page({ orders: [C, ord("oP", "ready", ago(50))] });
    await showOrders(F);
    const card = F.d.querySelector('#pOrder button[data-row="oC"]');
    F.d.querySelector('#pOrder [data-again="oC"]').focus();
    F.st.orders[1] = done("oP", ago(50), { qty: 1 });
    await F.tick();
    const ae = F.d.activeElement;
    ok(!card.querySelector("button") && card.parentNode.getAttribute("data-wrap") === "oC" && JSON.stringify(again(F)) === '["oC","oP"]' && !!ae && ae.getAttribute("data-again") === "oC",
      "the card holds no button, Order again stands beside it; a poll that hands an order over brings its Order again, and focus on a ghost stays: " + JSON.stringify([again(F), ae && ae.getAttribute("data-again")]));
  } catch (e) { ok(false, "counter-b-again stopped on an error: " + (e && e.stack)); }
  finally { pages.forEach((p) => p.close()); }
}
