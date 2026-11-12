/* test/order-way-ask.mjs: 11 NOV 2026, HIS REPORT "the Salt Counter tab is called Order and Orders? And sometimes the ordering via
 * Order skips the via delivery or via collection?" and his answers ("Shop and Orders ... consistent after adding to basket"; "Always ask").
 * The way was preset from their last order (else collect), so Continue went straight to the check and nothing asked it.
 *   1  the bar's places read Shop and Orders
 *   2  Continue from Shop with an earlier delivered order opens the sheet, not the check: no way pressed, Choose one beside it, Review
 *      saying why; the Shop line says no way either
 *   3  Orders' New order lands on Shop, and the same basket and sheet follow, asking the way the same
 *   4  a way chosen lets Review go; once Sent, the next order asks again
 *   5  Home's Deliver to me is the answer: its sheet opens on deliver
 * Each check observes the signed-in page in jsdom (test/counter-b-kit.mjs) and was proved red by its own mutation
 * (test/order-way-ask.mutations.json, tools/section.mjs). */
import { open, ord, ago, txt, basketAdd, toSheet, SHAPE } from "./counter-b-kit.mjs";

export async function run({ ok, pageWork }) {
  const pages = [];
  const page = async (o) => { const p = await open(Object.assign({ pageWork }, o)); pages.push(p); return p; };
  const pressed = (p) => { const b = p.d.querySelector('#osheet [data-k^="mode:"][aria-pressed="true"]'); return b ? b.getAttribute("data-k") : ""; };
  const foot = (p) => txt(p.d.querySelector("#osheet .salt-sheet__foot .ototal"));
  const close = async (p) => { const c = p.d.querySelector('#osheet [data-k="close"]'); if (c) { c.click(); await p.settle(); } };
  try {
    const A = await page({ orders: [ord("s1", "done", ago(300), { mode: "deliver", place: "Home" })] });
    /* ---- 1 ---- */
    const word = (t) => txt(A.d.querySelector('button[data-t="' + t + '"]'));
    ok(word("prices") === "Shop" && word("order") === "Orders", "the bar's places read Shop and Orders: " + JSON.stringify([word("prices"), word("order")]));
    /* ---- 2 ---- */
    A.d.querySelector('button[data-t="prices"]').click(); await A.settle();
    const pway = A.d.getElementById("pWay");
    await basketAdd(A, SHAPE.salt, 1); await toSheet(A);
    const legend = txt(A.d.querySelector('#osheet [data-k="mode:0"]') && A.d.querySelector('#osheet [data-k="mode:0"]').closest("fieldset").querySelector("legend"));
    ok(!!A.d.querySelector('#osheet [data-k="mode:0"]') && pressed(A) === "" && /Choose one/.test(legend) && A.d.getElementById("oGo").getAttribute("aria-disabled") === "true"
      && /Choose collect or deliver\./.test(foot(A)) && (!pway || pway.hidden),
      "Continue opens the sheet, not the check, with no way chosen and Review saying why: " + JSON.stringify([pressed(A), legend, foot(A)]));
    await close(A);
    /* ---- 3 ---- */
    A.d.querySelector('button[data-t="order"]').click(); await A.settle();
    const nw = A.d.querySelector("[data-new]") || [...A.d.querySelectorAll("#pOrder button, button")].filter((b) => txt(b) === "New order")[0];
    if (nw) { nw.click(); await A.settle(); }
    const onShop = A.d.querySelector(".cshell") ? A.d.querySelector(".cshell").getAttribute("data-place") : "";
    const bar = A.d.getElementById("bkGo");
    if (bar && !bar.hidden && !bar.disabled) { bar.click(); await A.settle(); }
    ok(!!nw && onShop === "prices" && pressed(A) === "" && /Choose collect or deliver\./.test(foot(A)),
      "Orders' New order lands on Shop, and its basket opens the same sheet asking the way: " + JSON.stringify([!!nw, onShop, pressed(A)]));
    /* ---- 4 ---- */
    A.d.querySelector('#osheet [data-k="mode:0"]').click(); await A.settle();
    const goes = A.d.getElementById("oGo").getAttribute("aria-disabled") !== "true";
    A.d.getElementById("oGo").click(); await A.settle();
    const place = A.d.getElementById("oPlace") || A.d.querySelector('#osheet [data-k="place"]');
    if (place) { place.click(); await A.settle(); await A.settle(); }
    const sent = A.d.querySelector("#osheet") ? txt(A.d.querySelector("#osheet .salt-sheet__head")) : "";
    await close(A);
    A.d.querySelector('button[data-t="prices"]').click(); await A.settle();
    await basketAdd(A, SHAPE.salt, 1); await toSheet(A);
    const asks = !!A.d.querySelector('#osheet [data-k="mode:0"]') && /Choose collect or deliver\./.test(foot(A));
    ok(goes && !!place && A.st.posts.length === 1 && A.st.posts[0].mode === "collect" && asks && pressed(A) === "",
      "a way chosen lets Review go, and after Sent the next order asks again: " + JSON.stringify([goes, !!place, A.st.posts.length, sent, asks, pressed(A)]));
    await close(A);
    /* ---- 5 ---- */
    const B = await page({ orders: [ord("s2", "done", ago(300))] });
    const tile = B.d.querySelector('[data-start="deliver"]');
    if (tile) { tile.click(); await B.settle(); }
    await basketAdd(B, SHAPE.salt, 1); await toSheet(B);
    ok(!!tile && pressed(B) === "mode:1", "Home's Deliver to me is the answer: its sheet opens on deliver: " + pressed(B));
  } finally { for (const p of pages) try { p.close(); } catch (e) { /* closed */ } }
}
