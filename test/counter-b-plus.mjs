/* test/counter-b-plus.mjs: THE BASKET'S + AND MINUS ON PRICES (Counter Batch B, P4, item 12; his answers of 18 Oct 2026).
 *
 * A + beside each size adds it to that mark's line, and taps on one mark SUM into one line, priced at the summed amount's own figure; a +
 * greys where the sum would have no price, and every + greys with five orders open, the limit said once. The badge counts the taps on a
 * size and minus takes one off. A tap patches the controls where they stand, so focus stays; nothing names a product in an attribute.
 * Every assertion observes the signed-in page in jsdom (test/counter-b-kit.mjs); each was proved red by its own mutation
 * (test/counter-b-plus.mutations.json, tools/section.mjs).
 *   1  5 units twice is one line of 10 units (5 + 5), the badge 2, and the + that would pass the grid's max greys
 *   2  a board's sum with no price greys its +
 *   3  at five open orders every + greys and the limit is said
 *   4  focus stays on the tapped +; minus takes one off, and the last one off gives focus back to the +
 *   5  no product word in any attribute; a size's own row still opens the sheet at that size alone, the basket untouched
 *   6  no + under the overdue gate */
import { open, ord, done, txt, ago } from "./counter-b-kit.mjs";

export async function run({ ok, pageWork }) {
  const pages = [];
  const page = async (o) => { const p = await open(Object.assign({ pageWork }, o)); pages.push(p); return p; };
  /* the pane of the n-th mark on Prices, salt first, oil second, and a size's + in it */
  const pane = (p, i) => p.d.querySelectorAll("#pPrices .pgrid > .pane")[i];
  const plus = (p, i, q) => pane(p, i).querySelector('[data-add="' + q + '"]');
  const less = (p, i, q) => pane(p, i).querySelector('[data-less="' + q + '"]');
  const badge = (p, i, q) => { const b = plus(p, i, q).parentNode.querySelector(".bkn"); return b ? b.textContent : ""; };
  const line = (p, i) => { const n = pane(p, i).querySelector(".bkline"); return n && !n.hidden ? txt(n.querySelector(".bkline__t")) : null; };
  try {
    /* ---- 1 ---- */
    const A = await page({ orders: [done("o1", ago(100))] });
    plus(A, 0, 5).click(); plus(A, 0, 5).click();
    const l1 = line(A, 0), b1 = badge(A, 0, 5);
    plus(A, 0, 10).click();
    plus(A, 0, 5).click();
    const off = { ten: plus(A, 0, 10).disabled, five: plus(A, 0, 5).disabled, one: plus(A, 0, 1).disabled };
    ok(l1 === "In your order: 10 units (5 + 5)" && b1 === "2" && line(A, 0) === "In your order: 25 units (10 + 5 + 5 + 5)" && off.ten && off.five && off.one && plus(A, 0, 2.5).disabled,
      "5 units twice is one line of 10 units (5 + 5), the badge says 2, and at 25 units every + that would pass the grid's max greys: " + JSON.stringify([l1, b1, line(A, 0), off]));

    /* ---- 2 ---- */
    plus(A, 1, 1).click();
    ok(line(A, 1) === "In your order: 1 unit" && plus(A, 1, 3).disabled && plus(A, 1, 1).disabled,
      "on a board, a sum with no price of its own greys the +: 1 and 1 make 2 and 1 and 3 make 4, neither on the board: " + JSON.stringify([line(A, 1), plus(A, 1, 3).disabled]));

    /* ---- 3 ---- */
    const five = [1, 2, 3, 4, 5].map((i) => ord("o" + i, "placed", ago(i), { sheet: i === 5 ? "sh" : undefined }));
    const F = await page({ orders: five });
    const all = [...F.d.querySelectorAll("#pPrices [data-add]")], lim = F.d.getElementById("bkLim");
    const G = await page({ orders: five.slice(0, 3).concat([ord("o5", "placed", ago(5), { sheet: "sh4" }), ord("o6", "placed", ago(6), { sheet: "sh4" })]) });
    ok(all.length === 6 && all.every((b) => b.disabled) && !!lim && !lim.hidden && /^Five open orders is the most/.test(txt(lim))
      && [...G.d.querySelectorAll("#pPrices [data-add]")].some((b) => !b.disabled) && G.d.getElementById("bkLim").hidden,
      "at five open orders every + greys and the limit is said; two orders of one sheet count once: " + JSON.stringify([all.length, all.filter((b) => b.disabled).length]));

    /* ---- 4 ---- */
    const B = await page({ orders: [] });
    const p5 = plus(B, 0, 5); p5.focus(); p5.click(); p5.click();
    const kept = B.d.activeElement === p5 && p5.isConnected;
    less(B, 0, 5).focus(); less(B, 0, 5).click();
    const l4 = line(B, 0), b4 = badge(B, 0, 5);
    less(B, 0, 5).click();
    ok(kept && l4 === "In your order: 5 units" && b4 === "1" && line(B, 0) === null && !less(B, 0, 5) && B.d.activeElement === p5,
      "focus stays on the tapped +; minus takes one off, and the last one off leaves the line and gives focus back to the +: " + JSON.stringify([kept, l4, b4, line(B, 0)]));

    /* ---- 5 ---- */
    plus(B, 0, 2.5).click(); plus(B, 1, 3).click();
    const words = /\b(salt|oil|candy|rice)\b/i, attrs = [...B.d.querySelectorAll("#pPrices *")].flatMap((e) => [...e.attributes].map((a) => a.name + "=" + a.value.replace(/salt-[a-z_-]+/g, ""))).filter((s) => words.test(s));   /* the design system's class prefix is no product word */
    B.d.querySelector('#pPrices .pgrid > .pane .szrow[data-q="1"]').click(); await B.settle();
    const checked = [...B.d.querySelectorAll('#osheet input[type="radio"]:checked')].map((r) => r.getAttribute("data-k"));
    B.d.querySelector('#osheet [data-k="close"]').click(); await B.settle();
    ok(!attrs.length && JSON.stringify(checked) === '["size:1"]' && line(B, 0) === "In your order: 2.5 units" && line(B, 1) === "In your order: 3 units",
      "no product word in any attribute on Prices, and a size's own row opens the sheet at that size alone, the basket untouched: " + JSON.stringify({ attrs, checked }));

    /* ---- 6 ---- */
    const H = await page({ orders: [done("o1", ago(100))], late: 1 });
    ok(!H.d.querySelector("#pPrices [data-add]") && !!H.d.querySelector("#pPrices .szrow"), "no + under the overdue gate, where the sizes still show");
  } catch (e) { ok(false, "counter-b-plus stopped on an error: " + (e && e.stack)); }
  finally { pages.forEach((p) => p.close()); }
}
