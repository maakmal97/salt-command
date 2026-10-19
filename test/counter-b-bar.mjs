/* test/counter-b-bar.mjs: THE BASKET'S BAR, REVIEW AND SENT (Counter Batch B, P5, item 12; his answers 3, 4 and 6 of 18 Oct 2026).
 *
 * The bar says how many lines and the goods at the list's figures, delivery left to his confirmation, with Review, which copies the priced
 * lines into the sheet and opens its check: a line a product, each its own rid, two or more under one sheet id. Remove on the check takes
 * a line out and freezes the check again. Sent forgets every size placed, by what is picked on every road and by the basket. The page
 * prices nothing. Every assertion observes the signed-in page in jsdom (test/counter-b-kit.mjs); each was proved red by its own mutation
 * (test/counter-b-bar.mutations.json, tools/section.mjs).
 *   1  the bar's figure is the summed amount's own (10 units at the 10-unit figure, never twice 5), goods only, its words by the way
 *   2  Review with two marks: the check holds two lines; Place posts two bodies, two rids, one sheet id; then the bar and the lines are gone
 *   3  Remove on the check: one line left, a fresh rid and no sheet id, and the basket follows
 *   4  a change in the sheet writes back; a line with no price greys Review and says why
 *   5  Sent forgets the sizes placed on the sheet's own road too, so the next sheet does not offer them again
 *   6  the bar sticks above the App bar under 1080px and to the foot of the column from 1080px
 *   7  after a partial place, Remove on the re-reviewed check keeps the sheet id, so the basket still counts once (Fable's review) */
import { open, done, txt, ago, LIST } from "./counter-b-kit.mjs";

export async function run({ ok, pageWork }) {
  const P = await import("../stmt/page.js");
  const pages = [];
  const page = async (o) => { const p = await open(Object.assign({ pageWork }, o)); pages.push(p); return p; };
  const pane = (p, i) => p.d.querySelectorAll("#pPrices .pgrid > .pane")[i];
  const plus = (p, i, q) => pane(p, i).querySelector('[data-add="' + q + '"]');
  const bar = (p) => { const b = p.d.getElementById("bkBar"); return b && !b.hidden ? b : null; };
  const kpi = (p) => { const b = bar(p); return b ? [".salt-kpi__label", ".salt-kpi__value", ".salt-kpi__note"].map((s) => txt(b.querySelector(s))) : null; };
  try {
    /* ---- 1 ---- */
    const A = await page({ orders: [done("o1", ago(100))] });
    plus(A, 0, 5).click(); plus(A, 0, 5).click();
    const k1 = kpi(A);
    const D = await page({ orders: [done("o1", ago(100), { mode: "deliver", place: "Veloria" })] });
    plus(D, 1, 3).click();
    ok(JSON.stringify(k1) === '["1 in the basket","RM 980.00","to collect"]' && JSON.stringify(kpi(D)) === '["1 in the basket","RM 115.00","and delivery, set when we confirm it"]',
      "the bar's figure is the summed amount's own off the list, 10 units at RM 980.00 and never twice the 5-unit figure, the goods alone, delivery said as his at confirmation: " + JSON.stringify([k1, kpi(D)]));

    /* ---- 2 ---- */
    plus(A, 1, 3).click();
    const k2 = kpi(A);
    A.d.getElementById("bkGo").click(); await A.settle();
    const lines = A.d.querySelectorAll("#osheet .mhero > *").length;
    A.d.getElementById("oPlace").click(); await A.settle();
    const ps = A.st.posts;
    ok(k2[0] === "2 in the basket" && k2[1] === "RM 1,095.00" && lines === 2 && ps.length === 2 && ps[0].product === "salt" && ps[0].qty === 10 && ps[0].total === 980
      && ps[1].product === "oil" && ps[1].qty === 3 && ps[1].total === 115 && ps[0].rid !== ps[1].rid && /^[0-9a-f]{32}$/.test(ps[0].sheet || "") && ps[0].sheet === ps[1].sheet
      && !bar(A) && !pane(A, 0).querySelector(".bkline:not([hidden])") && !A.d.querySelector("#pPrices .bkn"),
      "Review opens the check with the basket's two lines; Place posts two bodies at the list's figures, two rids under one sheet id; then the bar and every line are gone: " + JSON.stringify(ps.map((b) => [b.product, b.qty, b.total, b.sheet])));

    /* ---- 3 ---- */
    const R = await page({ orders: [] });
    plus(R, 0, 1).click(); plus(R, 1, 1).click();
    R.d.getElementById("bkGo").click(); await R.settle();
    R.d.querySelector('#osheet [data-k="rm:1"]').click(); await R.settle();
    const one = R.d.querySelectorAll("#osheet .mhero > *").length;
    R.d.getElementById("oPlace").click(); await R.settle();
    const rb = R.st.posts[0] || {};
    ok(one === 1 && R.st.posts.length === 1 && rb.product === "salt" && !("sheet" in rb) && /^[0-9a-f]{32}$/.test(rb.rid || "") && !bar(R),
      "Remove on the check takes the line out of the sheet and the basket; the one left goes as one order, a fresh rid and no sheet id: " + JSON.stringify(rb));

    /* ---- 4 ---- */
    const C = await page({ orders: [] });
    plus(C, 0, 5).click();
    C.d.getElementById("bkGo").click(); await C.settle();
    C.d.getElementById("oBack").click(); await C.settle();
    const any = C.d.getElementById("oAny0"); any.value = "30"; any.dispatchEvent(new C.w.Event("input", { bubbles: true }));
    C.d.querySelector('#osheet [data-k="close"]').click(); await C.settle();
    const hint = txt(pane(C, 0).querySelector(".bkline .salt-field__hint"));
    ok(txt(pane(C, 0).querySelector(".bkline__t")) === "In your order: 30 units" && C.d.getElementById("bkGo").disabled && hint === "Over 25 units has no list price. Take some off.",
      "a change in the sheet writes back to the basket, and a line with no price greys Review and says why: " + JSON.stringify([txt(pane(C, 0).querySelector(".bkline__t")), hint]));

    /* ---- 5 ---- */
    const S = await page({ orders: [] });
    S.d.querySelector('#pPrices .pgrid > .pane .szrow[data-q="1"]').click(); await S.settle();
    S.d.querySelector('#osheet input[data-k="size1:1"]').click(); await S.settle();
    S.d.getElementById("oGo").click(); await S.settle();
    S.d.getElementById("oPlace").click(); await S.settle();
    S.d.querySelector('#osheet [data-k="close"]').click(); await S.settle();
    S.d.querySelector('button[data-t="order"]').click(); await S.settle();
    S.d.getElementById("oNew").click(); await S.settle();
    const picked = [...S.d.querySelectorAll('#osheet input[type="radio"]:checked')].length;
    ok(S.st.posts.length === 2 && picked === 1, "Sent forgets the sizes it placed on the sheet's own road too: the next sheet offers one size, not both again: " + picked);

    /* ---- 6 ---- */
    const css = [...P.landingPage("", "nbb6", null, null).matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
    const base = /\.bkbar\{z-index:10;position:sticky;margin-top:24px;bottom:calc\(var\(--salt-bar-h\) \+ env\(safe-area-inset-bottom,0px\) - 1px\)/.test(css);
    const wide = /@media \(min-width:1080px\)\{\s*\.bkbar\{bottom:0;/.test(css);
    ok(base && wide, "the bar sticks above the App bar on a phone and to the foot of the column from 1080px, where the bar is the rail: " + JSON.stringify([base, wide]));

    /* ---- 7 ---- */
    const three = LIST(); three.products.push({ product: "candy", unit: "unit", basis: "board", sizes: [{ q: 1, price: 12 }] });
    const Q = await page({ orders: [], list: three });
    plus(Q, 0, 1).click(); plus(Q, 1, 1).click(); plus(Q, 2, 1).click();
    Q.st.refuse.add("oil");
    Q.d.getElementById("bkGo").click(); await Q.settle();
    Q.d.getElementById("oPlace").click(); await Q.settle();
    Q.d.getElementById("oBack").click(); await Q.settle();
    Q.d.getElementById("oGo").click(); await Q.settle();
    Q.d.querySelector('#osheet [data-k="rm:1"]').click(); await Q.settle();
    Q.st.refuse.clear();
    Q.d.getElementById("oPlace").click(); await Q.settle();
    const qp = Q.st.posts.map((b) => [b.product, b.sheet]);
    ok(qp.length === 2 && qp[0][0] === "salt" && qp[1][0] === "oil" && /^[0-9a-f]{32}$/.test(qp[0][1] || "") && qp[1][1] === qp[0][1],
      "after one line placed and one refused, Change, Review and Remove keep the sheet id, so the rest go under it and the basket counts once: " + JSON.stringify(qp));
  } catch (e) { ok(false, "counter-b-bar stopped on an error: " + (e && e.stack)); }
  finally { pages.forEach((p) => p.close()); }
}
