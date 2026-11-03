/* test/order-stream-p10-coins.mjs: THE MARKS AS COINS (plan version 10, 10b and 10c, the canvas of 03 Nov 2026, salt-ds 1.25.0). Each check red
 * under its own mutation (test/order-stream-p10-coins.mutations.json). The Counter page is the real stmt/page.js in jsdom (test/counter-b-kit.mjs
 * open()), the guest board the real boardPage; every code and name invented:
 *   - a book's head on Order is a coin, md: the ring, the book's own shape, his letter under it; its hue by the book's index (data-b), never a
 *     product word in any attribute; hidden from a reader, the head naming the shape
 *   - the restock light is a dot and its word beside the coin (salt-light), never a border on the mark
 *   - Home's start tiles take the large coin, a card's mark (order cards, Availability, Salt Admin's book tiles through mtile) the small one (a mark under 28px keeps the plain shape)
 *   - the guest board's heads are coins; both pages carry the hue of every book by its index; the letter's size follows its length */
export async function run({ ok, pageWork }) {
  const K = await import("./counter-b-kit.mjs");
  const P = await import("../stmt/page.js");
  const { JSDOM } = await import("jsdom");
  const WORDS = ["oil", "candy", "rice", "gas", "prep"];
  const attrsOf = (e) => [...e.querySelectorAll("*")].concat([e]).flatMap((x) => [...x.attributes].map((a) => a.value.toLowerCase()));
  const pages = [];
  try {
    const list = K.LIST(); list.products[0].supply = { light: "yellow", by: K.kl(5) }; list.products[1].supply = { light: "green" };
    const p = await K.open({ ok, pageWork, list, orders: [K.ord("o1", "placed", K.ago(2), { qty: 2.5, total: 250 })] }); pages.push(p);
    const head = (shape) => [...p.d.querySelectorAll("#pPrices .pane > h2.pmark")].find((h) => (h.getAttribute("aria-label") || "").startsWith(shape));
    const hs = head("Cube"), ho = head("Droplet");
    const cs = hs && hs.querySelector(".salt-coin"), co = ho && ho.querySelector(".salt-coin");
    ok(!!cs && cs.classList.contains("salt-coin--md") && cs.getAttribute("data-b") === "0" && !!co && co.getAttribute("data-b") === "1",
      "10b a book's head on Order is a medium coin, its hue by the book's index: " + (cs ? cs.outerHTML.slice(0, 120) : "none"));
    ok(!!cs && !!cs.querySelector("circle.salt-coin__ring") && cs.querySelector("path.salt-coin__shape").getAttribute("d") === P.PSYM.salt
      && (cs.querySelector("text.salt-coin__let") || {}).textContent === P.PLET.salt && co.querySelector("path.salt-coin__shape").getAttribute("d") === P.PSYM.oil,
      "10b the coin holds the ring, the book's whole shape and his letter under it");
    ok(cs.getAttribute("aria-hidden") === "true" && /^Cube/.test(hs.getAttribute("aria-label")) && !hs.querySelector("svg.psym"),
      "10b the coin is hidden from a reader and the head names the shape; the old mark is gone from the head");
    ok(attrsOf(p.d.getElementById("pPrices")).every((v) => !WORDS.some((w) => new RegExp("(^|[^a-z])" + w + "([^a-z]|$)").test(v))) && [...p.d.querySelectorAll(".salt-coin")].every((c) => [...c.classList].every((k) => /^salt-coin(--(sm|md|lg))?$/.test(k))),
      "10b no product word in any attribute of Order, a coin's classes its recipe and its size alone: " + JSON.stringify(attrsOf(p.d.getElementById("pPrices")).filter((v) => WORDS.some((w) => new RegExp("(^|[^a-z])" + w + "([^a-z]|$)").test(v))).slice(0, 5)));
    const light = hs.parentNode.querySelector(".supline .salt-light");
    ok(!/\bsup\b/.test(hs.className) && !!light && light.classList.contains("salt-light--yellow") && /Selling fast/.test(K.txt(light)) && /selling fast/i.test(hs.getAttribute("aria-label")),
      "10b the light is a dot and its word beside the coin, no border on the mark, the head saying it: " + (light ? light.outerHTML : "none"));
    const lo = ho.parentNode.querySelector(".supline .salt-light");
    ok(!!lo && lo.className === "salt-light" && /Available/.test(K.txt(lo)), "10b a green light is the plain dot");
    /* Home */
    p.d.querySelector('#tabs button[data-t="home"]').click(); await p.settle();
    const sup = p.d.querySelector("#pHome .hsup");
    ok(!!sup && !!sup.querySelector(".salt-coin.salt-coin--sm") && !!sup.querySelector(".salt-light") && !sup.querySelector(".pmark.sup"),
      "10b Home's Availability rows carry the small coin and the light's dot and word");
    const card = p.d.querySelector("#pOrder .mtile");
    ok(!!card && !!card.querySelector(".salt-coin.salt-coin--sm") && !card.querySelector("svg.psym"), "10b an order card's mark is the small coin");
    const fresh = await K.open({ ok, pageWork }); pages.push(fresh);
    const tile = fresh.d.querySelector("#pHome .htile");
    ok(!!tile && !!tile.querySelector(".salt-coin.salt-coin--lg") && !tile.querySelector("svg.psym"), "10b Home's start tiles carry the large coin");
    /* the guest board */
    const html = P.boardPage({ prices: { week: { label: "this week" }, products: [{ product: "prep", unit: "unit", sizes: [{ q: 12, price: 60 }] }, { product: "gas", unit: "unit", sizes: [{ q: 1, price: 75 }] }] } }, "nonce10");
    const g = new JSDOM(html).window.document;
    const gc = [...g.querySelectorAll("h2.pmark .salt-coin")];
    ok(gc.length === 2 && gc.every((c) => c.classList.contains("salt-coin--md")) && gc[0].getAttribute("data-b") === String(Object.keys(P.PSYM).indexOf("prep")),
      "10b the guest board's heads are coins, by the book's index");
    ok(gc[0].querySelector("text").getAttribute("font-size") === "11" && gc[1].querySelector("text").getAttribute("font-size") === "12" && P.coinSvg("salt", "sm").includes('font-size="13"'),
      "10b the letter's size follows its length: one 13, three 12, four 11");
    const css = [...g.querySelectorAll("style")].map((s) => s.textContent).join("");
    const land = P.landingPage("abcd-efgh", "n10", null);
    ok(Object.keys(P.PSYM).every((k, i) => css.includes('.salt-coin[data-b="' + i + '"]{--salt-hue:var(--salt-product-' + k + ")}") && land.includes('.salt-coin[data-b="' + i + '"]')),
      "10b the guest board and the account both carry every book's hue by its index");
    ok(css.includes(".salt-coin__ring") && css.includes(".salt-light::before"), "10a the coin and the light recipes reach the Counter's stylesheet");
  } finally { pages.forEach((x) => x.close()); }
}
