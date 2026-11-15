/* test/order-stream-p10-coins.mjs: THE MARKS AS COINS (plan version 10, 10b and 10c, the canvas of 03 Nov 2026, salt-ds 1.25.0). Each check red
 * under its own mutation (test/order-stream-p10-coins.mutations.json). The Counter page is the real stmt/page.js in jsdom (test/counter-b-kit.mjs
 * open()), the guest board the real boardPage; every code and name invented:
 *   - a book's head on Order is the mark thumb (16 Nov 2026, the move to Ambient), md: the ring, the book's own shape, his letter in it; its hue by the book's index (amb-kind-N), never a
 *     product word in any attribute; hidden from a reader, the head naming the shape
 *   - the restock light is the one chip (hLight) beside the thumb, a dot and its word, its tone by the light (Available pos, Low on stock warn, Out of stock neg, Selling fast plain), never a border on the mark
 *   - Home's start tiles take the large coin, a card's mark (order cards, Availability, Salt Admin's book tiles through mtile) the small one (a mark under 28px keeps the plain shape)
 *   - the guest board's heads are coins; both pages carry the hue of every book by its index; the letter's size follows its length */
export async function run({ ok, pageWork }) {
  const K = await import("./counter-b-kit.mjs");
  const P = await import("../stmt/page.js");
  const { JSDOM } = await import("jsdom");
  const WORDS = ["oil", "candy", "rice", "gas"];
  const attrsOf = (e) => [...e.querySelectorAll("*")].concat([e]).flatMap((x) => [...x.attributes].map((a) => a.value.toLowerCase()));
  const pages = [];
  try {
    const list = K.LIST(); list.products[0].supply = { light: "yellow", by: K.kl(5) }; list.products[1].supply = { light: "green" };
    const p = await K.open({ ok, pageWork, list, orders: [K.ord("o1", "placed", K.ago(2), { qty: 2.5, total: 250 })] }); pages.push(p);
    const head = (shape) => [...p.d.querySelectorAll("#pPrices .pane > h2.pmark")].find((h) => (h.getAttribute("aria-label") || "").startsWith(shape));
    const hs = head("Cube"), ho = head("Droplet");
    const cs = hs && hs.querySelector(".amb-thumb"), co = ho && ho.querySelector(".amb-thumb");
    ok(!!cs && cs.classList.contains("amb-thumb--mark") && cs.classList.contains("amb-thumb--ring") && cs.classList.contains("amb-thumb--md") && cs.classList.contains("amb-kind-1") && !!co && co.classList.contains("amb-kind-2"),
      "10b a book's head on Order is a medium mark thumb, its hue by the book's index: " + (cs ? cs.outerHTML.slice(0, 120) : "none"));
    ok(!!cs && !!cs.querySelector("svg.amb-thumb__shape path") && (cs.querySelector(".amb-thumb__word") || {}).textContent === P.PLET.salt && !!co.querySelector("svg.amb-thumb__shape path")
      && cs.querySelector("svg.amb-thumb__shape path").getAttribute("d") !== co.querySelector("svg.amb-thumb__shape path").getAttribute("d"),
      "10b the thumb holds the book's own shape and his letter");
    ok(cs.getAttribute("aria-hidden") === "true" && /^Cube/.test(hs.getAttribute("aria-label")) && !hs.querySelector("svg.psym"),
      "10b the thumb is hidden from a reader and the head names the shape; the old mark is gone from the head");
    ok(attrsOf(p.d.getElementById("pPrices")).every((v) => !WORDS.some((w) => new RegExp("(^|[^a-z])" + w + "([^a-z]|$)").test(v))) && [...p.d.querySelectorAll("#pPrices .amb-thumb")].every((c) => [...c.classList].every((k) => /^amb-(thumb|thumb--(ring|mark|sm|md|lg)|kind-[1-6])$/.test(k))),
      "10b no product word in any attribute of Order, a thumb's classes its part, its size and its kind alone: " + JSON.stringify(attrsOf(p.d.getElementById("pPrices")).filter((v) => WORDS.some((w) => new RegExp("(^|[^a-z])" + w + "([^a-z]|$)").test(v))).slice(0, 5)));
    /* 16 Nov 2026: the light is Home's chip, the one function; its tone is by the light and Selling fast is plain */
    const light = hs.querySelector(".amb-chip");
    ok(!/\bsup\b/.test(hs.className) && !!light && light.className === "amb-chip" && !!light.querySelector(".amb-chip__dot") && /Selling fast/.test(K.txt(light)) && /selling fast/i.test(hs.getAttribute("aria-label")),
      "10b the light is a plain chip, its dot and its word, beside the thumb, no border on the mark, the head saying it: " + (light ? light.outerHTML : "none"));
    const lo = ho.querySelector(".amb-chip");
    ok(!!lo && lo.className === "amb-chip amb-chip--pos" && /Available/.test(K.txt(lo)), "10b a green light is the positive chip: " + (lo && lo.className));
    {
      const tl = K.LIST(); tl.products[0].supply = { light: "amber", by: K.kl(5) }; tl.products[1].supply = { light: "red", by: null };
      const q = await K.open({ ok, pageWork, list: tl }); pages.push(q);
      const hq = (shape) => [...q.d.querySelectorAll("#pPrices .pane > h2.pmark")].find((h) => (h.getAttribute("aria-label") || "").startsWith(shape));
      const ca = hq("Cube").querySelector(".amb-chip"), cr = hq("Droplet").querySelector(".amb-chip");
      ok(ca.className === "amb-chip amb-chip--warn" && /Low on stock/.test(K.txt(ca)) && cr.className === "amb-chip amb-chip--neg" && /Out of stock/.test(K.txt(cr)),
        "10b Low on stock is the warning chip and Out of stock the negative one: " + JSON.stringify([ca.className, cr.className]));
    }
    /* Home */
    p.d.querySelector('#tabs button[data-t="home"]').click(); await p.settle();
    /* 16 Nov 2026, the move to Ambient: Home's marks are the mark thumb ringed in the book's hue, and its light a chip with its dot and word */
    const sup = p.d.querySelector("#pHome [data-sup]");
    ok(!!sup && !!sup.querySelector(".amb-thumb--mark.amb-thumb--ring[class*='amb-kind-']") && !!sup.querySelector(".amb-chip[data-light] .amb-chip__dot") && !sup.querySelector(".pmark.sup"),
      "10b Home's Availability rows carry the book's mark thumb and the light's chip, a dot and its word");
    const card = p.d.querySelector("#pOrder .mtile");
    ok(!!card && !!card.querySelector(".amb-thumb--mark.amb-thumb--ring.amb-thumb--md") && !card.querySelector("svg.psym"), "10b an order card's mark is the medium mark thumb");
    const fresh = await K.open({ ok, pageWork }); pages.push(fresh);
    const tile = fresh.d.querySelector("#pHome [data-hagain]");
    ok(!!tile && !!tile.querySelector(".amb-thumb--mark.amb-thumb--ring") && !tile.querySelector("svg.psym"), "10b Home's order-again rows carry the book's mark thumb");
    /* the guest board */
    const html = P.boardPage({ prices: { week: { label: "this week" }, products: [{ product: "rice", unit: "unit", sizes: [{ q: 1, price: 8 }] }, { product: "gas", unit: "unit", sizes: [{ q: 1, price: 75 }] }] } }, "nonce10");
    const g = new JSDOM(html).window.document;
    const gc = [...g.querySelectorAll("h2.pmark .salt-coin")];
    ok(gc.length === 2 && gc.every((c) => c.classList.contains("salt-coin--md")) && gc[0].getAttribute("data-b") === String(Object.keys(P.PSYM).indexOf("rice")),
      "10b the guest board's heads are coins, by the book's index");
    ok(gc[0].querySelector("text").getAttribute("font-size") === "13" && gc[1].querySelector("text").getAttribute("font-size") === "12" && P.coinSvg("salt", "sm").includes('font-size="13"'),
      "10b the letter's size follows its length: one 13, three 12");
    const css = [...g.querySelectorAll("style")].map((s) => s.textContent).join("");
    const land = P.landingPage("abcd-efgh", "n10", null);
    ok(Object.keys(P.PSYM).every((k, i) => css.includes('.salt-coin[data-b="' + i + '"]{--salt-hue:var(--salt-product-' + k + ")}") && land.includes('.salt-coin[data-b="' + i + '"]')),
      "10b the guest board and the account both carry every book's hue by its index");
    /* 16 Nov 2026, the move to Ambient (10a): the recipes the Counter's pages carry for a mark and a light are the system's, the mark thumb and the chip with its tones; the guest board's own markup is its builder's */
    const lst = (land.match(/<style[^>]*>([\s\S]*?)<\/style>/) || [, ""])[1];
    ok(lst.includes(".amb-thumb--ring") && lst.includes(".amb-thumb--mark") && lst.includes(".amb-chip--warn") && lst.includes(".amb-chip--neg") && lst.includes(".amb-chip--pos") && lst.includes(".amb-chip__dot"),
      "10a the mark thumb and the light's chip, with its tones, reach the Counter's stylesheet");
  } finally { pages.forEach((x) => x.close()); }
}
