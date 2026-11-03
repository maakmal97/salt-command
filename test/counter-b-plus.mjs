/* test/counter-b-plus.mjs: THE BASKET'S LIMIT, THE GATE AND THE PRODUCT WORD ON ORDER (Counter Batch B, P4, item 12; his answers of 18 Oct 2026;
 * re-aimed by plan version 9, 03 Nov 2026).
 *
 * Batch B drew a + and a - beside every size, taps on one mark SUMMED into one line, and a badge counted the taps. Plan version 9 (03 Nov 2026)
 * took them off: each book is a stepper and one Add, and Add SETS the line (test/order-stream-p9-units.mjs holds the stepper itself). What this
 * file still holds of the batch is what the stepper keeps: with five orders open a new line is refused with the limit said once, two orders of
 * one sheet counting once; under the overdue gate the controls are off while the sizes still show; and no product word in any attribute.
 * Retired by plan version 9: the taps summing into one line (5 + 5), a + greying where the sum has no price, the badge, minus and its focus,
 * and a size's row opening the sheet (it sets the stepper now). Every assertion observes the signed-in page in jsdom (test/counter-b-kit.mjs);
 * each was proved red by its own mutation (test/counter-b-plus.mutations.json, tools/section.mjs).
 *   3  at five open orders Add opens the limit step and the limit is said on Order; two orders of one sheet count once
 *   5  no product word in any attribute on Order, and a size's row sets the stepper without opening a sheet or touching the basket
 *   6  under the overdue gate no stepper and no Add, where the sizes still show */
import { open, ord, done, txt, ago, stepTo } from "./counter-b-kit.mjs";

export async function run({ ok, pageWork }) {
  const pages = [];
  const page = async (o) => { const p = await open(Object.assign({ pageWork }, o)); pages.push(p); return p; };
  /* the pane of the n-th mark on Order, salt first, oil second, and its Add */
  const pane = (p, i) => p.d.querySelectorAll("#pPrices .pgrid > .pane")[i];
  const addOf = (p, i) => pane(p, i).querySelector('[data-st="add"]');
  const line = (p, i) => { const n = pane(p, i).querySelector(".bkline"); return n && !n.hidden ? txt(n.querySelector(".bkline__t")) : null; };
  try {
    /* ---- 3 ---- */
    const five = [1, 2, 3, 4, 5].map((i) => ord("o" + i, "placed", ago(i), { sheet: i === 5 ? "sh" : undefined }));
    const F = await page({ orders: five });
    const lim = F.d.getElementById("bkLim");
    addOf(F, 0).click(); await F.settle();
    const said = F.d.querySelector("#osheet .salt-insight--copper");
    const G = await page({ orders: five.slice(0, 3).concat([ord("o5", "placed", ago(5), { sheet: "sh4" }), ord("o6", "placed", ago(6), { sheet: "sh4" })]) });
    addOf(G, 0).click(); await G.settle();
    ok(!!lim && !lim.hidden && /^Five open orders is the most/.test(txt(lim)) && !!said && /^Five open orders is the most/.test(txt(said)) && line(F, 0) === null
      && G.d.getElementById("bkLim").hidden && !G.d.getElementById("osheet") && /^In your order: 1 unit$/.test(line(G, 0) || ""),
      "at five open orders Add opens the limit step and the limit is said on Order; two orders of one sheet count once, so Add puts the line in the basket: " + JSON.stringify([said && txt(said), line(F, 0), line(G, 0)]));

    /* ---- 5 ---- */
    const B = await page({ orders: [] });
    stepTo(B, "salt", 2.5); addOf(B, 0).click(); stepTo(B, "oil", 3); addOf(B, 1).click();
    const words = /\b(salt|oil|candy|rice)\b/i, attrs = [...B.d.querySelectorAll("#pPrices *")].flatMap((e) => [...e.attributes].map((a) => a.name + "=" + a.value.replace(/salt-[a-z_-]+/g, ""))).filter((s) => words.test(s));   /* the design system's class prefix is no product word */
    pane(B, 0).querySelector('.szrow[data-q="1"]').click(); await B.settle();
    ok(!attrs.length && !B.d.getElementById("osheet") && pane(B, 0).querySelector('.szrow[data-q="1"]').getAttribute("aria-pressed") === "true"
      && line(B, 0) === "In your order: 2.5 units" && line(B, 1) === "In your order: 3 units",
      "no product word in any attribute on Order, and a size's own row sets the stepper without opening a sheet or touching the basket: " + JSON.stringify({ attrs, line: line(B, 0) }));

    /* ---- 6 ---- */
    const H = await page({ orders: [done("o1", ago(100))], late: 1 });
    ok(!H.d.querySelector("#pPrices [data-st]") && !!H.d.querySelector("#pPrices .szrow") && H.d.querySelector("#pPrices .szrow").tagName === "DIV", "no stepper and no Add under the overdue gate, where the sizes still show as plain rows");
  } catch (e) { ok(false, "counter-b-plus stopped on an error: " + (e && e.stack)); }
  finally { pages.forEach((p) => p.close()); }
}
