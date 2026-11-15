/* test/counter-b-bar.mjs: THE BASKET'S BAR, REVIEW AND SENT (Counter Batch B, P5, item 12; his answers 3, 4 and 6 of 18 Oct 2026).
 *
 * The bar says how many lines and the goods at the list's figures, delivery left to his confirmation, with Continue (Review until plan version 8), which copies the priced
 * lines into the sheet and opens its check: a line a product, each its own rid, two or more under one sheet id. Remove on the check takes
 * a line out and freezes the check again. Sent forgets every size placed, by what is picked on every road and by the basket. The page
 * prices nothing. Every assertion observes the signed-in page in jsdom (test/counter-b-kit.mjs); each was proved red by its own mutation
 * (test/counter-b-bar.mutations.json, tools/section.mjs).
 *   1  the bar's figure is the summed amount's own (10 units at the 10-unit figure), goods only, its words by the way
 *   2  Review with two marks: the check holds two lines; Place posts two bodies, two rids, one sheet id; then the bar and the lines are gone
 *   3  Remove on the check: one line left, a fresh rid and no sheet id, and the basket follows
 *   4, 5  retired by plan version 8 (03 Nov 2026): the sheet's own size field is gone, so nothing writes back and nothing is left to forget
 *   6  the bar sticks above the App bar under 1080px and to the foot of the column from 1080px
 *   7  after a partial place, Remove on the re-reviewed check keeps the sheet id, so the basket still counts once (Fable's review) */
import { open, done, txt, ago, LIST, stepTo } from "./counter-b-kit.mjs";

export async function run({ ok, pageWork }) {
  const P = await import("../stmt/page.js");
  const pages = [];
  const page = async (o) => { const p = await open(Object.assign({ pageWork }, o)); pages.push(p); return p; };
  const pane = (p, i) => p.d.querySelectorAll("#pPrices .pgrid > .pane")[i];
  /* plan version 9: a line is the stepper set to the amount and Add; Add sets the line, it never sums taps */
  const put = async (p, i, q) => { stepTo(p, ["salt", "oil", "candy"][i], q); pane(p, i).querySelector('[data-st="add"]').click(); await p.settle(); };
  /* 11 Nov 2026 (his answer "Always ask"): the sheet asks the way, so a check that places chooses collect first */
  const collect = async (p) => { const m = p.d.querySelector('#osheet [data-k="mode:0"]:not([aria-pressed="true"])'); if (m) { m.click(); await p.settle(); } const g = p.d.getElementById("oGo"); if (g && g.getAttribute("aria-disabled") !== "true") { g.click(); await p.settle(); } };
  const bar = (p) => { const b = p.d.getElementById("bkBar"); return b && !b.hidden ? b : null; };
  /* 16 Nov 2026, the move to Ambient: the bar's figure is the system's Stat (its label, its value, the words under it as a second label) with the one pill in a foot */
  const kpi = (p) => { const b = bar(p); if (!b) return null; const l = b.querySelectorAll(".amb-stat__label"); return [txt(l[0]), txt(b.querySelector(".amb-stat__value")), txt(l[1])]; };
  try {
    /* ---- 1 ---- */
    const A = await page({ orders: [done("o1", ago(100))] });
    await put(A, 0, 10);
    const k1 = kpi(A);
    const D = await page({ orders: [done("o1", ago(100), { mode: "deliver", place: "Veloria" })] });
    D.d.querySelector('[data-start="deliver"]').click(); await D.settle();   // 11 Nov 2026: no order presets the way; Home's Deliver tile answers it
    await put(D, 1, 3);
    ok(JSON.stringify(k1) === '["1 in the basket","RM 980.00","to collect"]' && JSON.stringify(kpi(D)) === '["1 in the basket","RM 115.00","and delivery, set when we confirm it"]',
      "the bar's figure is the summed amount's own off the list, 10 units at RM 980.00, the goods alone, delivery said as his at confirmation: " + JSON.stringify([k1, kpi(D)]));

    /* ---- 2 ---- */
    await put(A, 1, 3);
    const k2 = kpi(A);
    A.d.getElementById("bkGo").click(); await A.settle();
    await collect(A);
    const lines = A.d.querySelectorAll("#osheet .amb-list > li").length;
    A.d.getElementById("oPlace").click(); await A.settle();
    const ps = A.st.posts;
    ok(k2[0] === "2 in the basket" && k2[1] === "RM 1,095.00" && lines === 2 && ps.length === 2 && ps[0].product === "salt" && ps[0].qty === 10 && ps[0].total === 980
      && ps[1].product === "oil" && ps[1].qty === 3 && ps[1].total === 115 && ps[0].rid !== ps[1].rid && /^[0-9a-f]{32}$/.test(ps[0].sheet || "") && ps[0].sheet === ps[1].sheet
      && !bar(A) && !pane(A, 0).querySelector(".bkline:not([hidden])"),
      "Review opens the check with the basket's two lines; Place posts two bodies at the list's figures, two rids under one sheet id; then the bar and every line are gone: " + JSON.stringify(ps.map((b) => [b.product, b.qty, b.total, b.sheet])));

    /* ---- 3 ---- */
    const R = await page({ orders: [] });
    await put(R, 0, 1); await put(R, 1, 1);
    R.d.getElementById("bkGo").click(); await R.settle(); await collect(R);
    R.d.querySelector('#osheet [data-k="rm:1"]').click(); await R.settle();
    const one = R.d.querySelectorAll("#osheet .amb-list > li").length;
    R.d.getElementById("oPlace").click(); await R.settle();
    const rb = R.st.posts[0] || {};
    ok(one === 1 && R.st.posts.length === 1 && rb.product === "salt" && !("sheet" in rb) && /^[0-9a-f]{32}$/.test(rb.rid || "") && !bar(R),
      "Remove on the check takes the line out of the sheet and the basket; the one left goes as one order, a fresh rid and no sheet id: " + JSON.stringify(rb));

    /* ---- 4 and 5, retired by plan version 8 (03 Nov 2026) ----
       4 was a change typed into the sheet's own size field writing back to the basket, and a line with no price greying Review; 5 was Sent forgetting
       the sizes the sheet chose for itself. The sheet has no size field and chooses no size any more (version 9 brings the typed size to Order), so
       nothing is written back and nothing is left to forget: every new sheet is built from the tap or the basket alone (pickBasket). What remains of
       both is 2 (Place and Sent clear the bar and the lines) and 3 (Remove keeps the basket). */

    /* ---- 6 ---- */
    /* 16 Nov 2026, the move to Ambient: the bar's own sticking is the system's foot (it holds the one pill and stands at the screen's foot above the dock by itself); the bar's box takes no
       place of its own, so the figure stands in the stack and the foot after it */
    const css = [...P.landingPage("", "nbb6", null, null).matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
    const base = /#pWay, #bkBar \{ display: contents; \}/.test(css);
    const wide = !!bar(D) && !!bar(D).querySelector(".amb-foot > #bkGo.amb-pill.amb-pill--block") && !bar(D).querySelector(".amb-foot").nextElementSibling;
    ok(base && wide, "the bar takes no place of its own and its one Continue is the system's foot: " + JSON.stringify([base, wide]));

    /* ---- 7 ---- */
    const three = LIST(); three.products.push({ product: "candy", unit: "unit", basis: "board", sizes: [{ q: 1, price: 12 }] });
    const Q = await page({ orders: [], list: three });
    await put(Q, 0, 1); await put(Q, 1, 1); await put(Q, 2, 1);
    Q.st.refuse.add("oil");
    Q.d.getElementById("bkGo").click(); await Q.settle();
    await collect(Q); Q.d.getElementById("oPlace").click(); await Q.settle();
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
