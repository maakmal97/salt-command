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
    /* 22 Nov 2026: a book of three letters too, so the twins are compared on a coin whose letters are sized by their class */
    list.products.push({ product: "gas", unit: "unit", basis: "board", sizes: [{ q: 1, price: 20 }] });
    const p = await K.open({ ok, pageWork, list, orders: [K.ord("o1", "placed", K.ago(2), { qty: 2.5, total: 250 }), K.done("o2", K.ago(3), { product: "gas", qty: 1, total: 20 })] }); pages.push(p);
    const head = (shape) => [...p.d.querySelectorAll("#pPrices .pane > h2.pmark")].find((h) => (h.getAttribute("aria-label") || "").startsWith(shape));
    const hs = head("Cube"), ho = head("Droplet");
    const cs = hs && hs.querySelector(".amb-thumb"), co = ho && ho.querySelector(".amb-thumb");
    ok(!!cs && cs.classList.contains("amb-thumb--mark") && cs.classList.contains("amb-thumb--ring") && cs.classList.contains("amb-thumb--md") && cs.classList.contains("amb-kind-1") && !!co && co.classList.contains("amb-kind-2"),
      "10b a book's head on Order is a medium mark thumb, its hue by the book's index: " + (cs ? cs.outerHTML.slice(0, 120) : "none"));
    /* 22 Nov 2026, his word (the letter inside the shape on every coin, Ambient 0.7.34; it retires the 44px coin as the shape alone, his answer of 17 Nov 2026): the head's thumb is the 44px coin, the book's own shape with his letter inside it */
    const inOf = (c) => (c.querySelector("svg.amb-thumb__shape > text.amb-thumb__letter") || { textContent: "" }).textContent;
    ok(!!cs && !!cs.querySelector("svg.amb-thumb__shape path") && inOf(cs) === P.PLET.salt && inOf(co) === P.PLET.oil && !p.d.querySelector(".amb-thumb__word") && !!co.querySelector("svg.amb-thumb__shape path")
      && cs.querySelector("svg.amb-thumb__shape path").getAttribute("d") !== co.querySelector("svg.amb-thumb__shape path").getAttribute("d"),
      "10b the thumb holds the book's own shape, his letter inside it at 44px, and no word stands under any shape (his word of 22 Nov 2026)");
    /* and his letter stands on every coin of 56px and over the page draws (the default 56px and lg 72px), the Ring bare */
    const big = [...p.d.querySelectorAll(".amb-thumb--mark:not(.amb-thumb--md):not(.amb-thumb--sm)")];
    const ringOf = (c) => /A8\.6 8\.6/.test(c.querySelector("path").getAttribute("d")), wordOf = inOf;
    ok(big.some((c) => !ringOf(c)) && big.every((c) => (ringOf(c) ? wordOf(c) === "" : Object.values(P.PLET).includes(wordOf(c)))),
      "10b every coin of 56px and over carries his letter inside its shape, the Ring bare: " + big.length);
    /* 22 Nov 2026: THE TWINS DRAW ONE COIN. Every coin on the page (the script's markThumb) holds the very svg the markup's markThumbHtml gives for its
       book and size, the letter, its class and its place included; and Ambient's floor leaves a 36px coin the shape alone (three letters at 44px too, none today: gas is P since 25 Nov 2026). */
    const KEYS = Object.keys(P.PSYM).filter((x) => x !== "_"), sizeOf = (c) => (["sm", "md", "lg"].find((z) => c.classList.contains("amb-thumb--" + z)) || "");
    const bookOf = (c) => KEYS[+(([...c.classList].find((x) => /^amb-kind-\d$/.test(x)) || "").slice(9)) - 1];
    const svgOf = (html) => new JSDOM("<body>" + html + "</body>").window.document.querySelector("svg").innerHTML;
    const drawn = [...p.d.querySelectorAll(".amb-thumb--mark")].filter((c) => bookOf(c)), apart = drawn.filter((c) => c.querySelector("svg").innerHTML !== svgOf(P.markThumbHtml(bookOf(c), sizeOf(c))));
    ok(drawn.length >= 4 && new Set(drawn.map(sizeOf)).size >= 2 && drawn.some((c) => bookOf(c) === "gas" && sizeOf(c) !== "md" && (c.querySelector("text.amb-thumb__letter") || {}).textContent === "P") && drawn.some((c) => bookOf(c) === "gas" && sizeOf(c) === "md" && (c.querySelector("text") || {}).textContent === "P") && !apart.length,
      "10b every coin the page draws is the markup's own for its book and size, letter and all: " + JSON.stringify([drawn.map((c) => bookOf(c) + ":" + sizeOf(c)).join(" "), apart.slice(0, 2).map((c) => c.outerHTML.slice(0, 200))]));
    const lt = (book, size) => { const x = new JSDOM("<body>" + P.markThumbHtml(book, size) + "</body>").window.document.querySelector("text"); return x ? [x.textContent, x.getAttribute("class"), x.getAttribute("x"), x.getAttribute("y")].concat(x.getAttribute("textLength") ? [x.getAttribute("textLength"), x.getAttribute("lengthAdjust")] : []).join("|") : ""; };
    const rule = [lt("gas"), lt("gas", "lg"), lt("gas", "md"), lt("gas", "sm"), lt("salt", "sm"), lt("salt", "md"), lt("oil", "md"), lt("tin")];
    ok(JSON.stringify(rule) === JSON.stringify(["P|amb-thumb__letter|12|12", "P|amb-thumb__letter|12|12", "P|amb-thumb__letter|12|12", "", "", "I|amb-thumb__letter|12|12", "G|amb-thumb__letter|12|13.4", ""]),
      "10b gas's P stands on every coin from 44px like the other capitals (his word of 25 Nov 2026), every 36px coin and the Ring are bare, a letter is sized by its class and centred, lower in the droplet: " + JSON.stringify(rule));
    /* the word path stays for a book lettered with a word (gas was POP until 25 Nov 2026); no book carries one, so gas lends POP for this check alone */
    const was = P.PLET.gas; let word; try { P.PLET.gas = "POP"; word = [lt("gas"), lt("gas", "md")]; } finally { P.PLET.gas = was; }
    ok(JSON.stringify(word) === JSON.stringify(["POP|amb-thumb__letter amb-thumb__letter--3|12|12|13.5|spacingAndGlyphs", ""]) && P.PLET.gas === "P",
      "10b a word of three letters stands from 56px, sized by its class and held to 13.5 on the grid, and is the shape alone at 44px: " + JSON.stringify(word));
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
    const card = p.d.querySelector("#pOrder [data-row]");   /* 16 Nov 2026: an order is the system's Row, its thumb the Row's own size */
    ok(!!card && !!card.querySelector(".amb-thumb--mark.amb-thumb--ring[class*='amb-kind-']") && !card.querySelector("svg.psym"), "10b an order row's mark is the ringed mark thumb in its book's hue");
    const fresh = await K.open({ ok, pageWork }); pages.push(fresh);
    const tile = fresh.d.querySelector("#pHome [data-hagain]");
    ok(!!tile && !!tile.querySelector(".amb-thumb--mark.amb-thumb--ring") && !tile.querySelector("svg.psym"), "10b Home's order-again rows carry the book's mark thumb");
    /* the guest board */
    const html = P.boardPage({ prices: { week: { label: "this week" }, products: [{ product: "rice", unit: "unit", sizes: [{ q: 1, price: 8 }] }, { product: "gas", unit: "unit", sizes: [{ q: 1, price: 75 }] }] } }, "nonce10");
    const g = new JSDOM(html).window.document;
    /* 16 Nov 2026, the move to Ambient (place E): the board's heads are the system's mark thumbs, each in its book's hue by the book's index (PSYM's order less the ring, N from 1),
       carrying his letter; the system fits the letter to the thumb */
    const gc = [...g.querySelectorAll("h2.amb-settings__head .amb-thumb--mark.amb-thumb--ring")], kindOf = (k) => Object.keys(P.PSYM).filter((x) => x !== "_").indexOf(k) + 1;
    ok(gc.length === 2 && gc[0].classList.contains("amb-kind-" + kindOf("rice")) && gc[1].classList.contains("amb-kind-" + kindOf("gas")) && !g.querySelector("svg.psym, .salt-coin"),
      "10b the guest board's heads are mark thumbs, by the book's index");
    ok((gc[0].querySelector("svg.amb-thumb__shape > text.amb-thumb__letter") || {}).textContent === P.PLET.rice && (gc[1].querySelector("svg.amb-thumb__shape > text.amb-thumb__letter") || {}).textContent === P.PLET.gas && gc[0].querySelectorAll("svg path").length === 1,
      "10b each carries its book's letter or letters inside its shape (22 Nov 2026)");
    const css = [...g.querySelectorAll("style")].map((s) => s.textContent).join("");
    const land = P.landingPage("abcd-efgh", "n10", null);
    ok([1, 2, 3, 4, 5, 6].every((n) => css.includes(".amb-kind-" + n) && land.includes(".amb-kind-" + n)),
      "10b the guest board and the account both carry every book's hue by its index");
    /* 16 Nov 2026, the move to Ambient (10a): the recipes the Counter's pages carry for a mark and a light are the system's, the mark thumb and the chip with its tones; the guest board's own markup is its builder's */
    const lst = (land.match(/<style[^>]*>([\s\S]*?)<\/style>/) || [, ""])[1];
    ok(lst.includes(".amb-thumb--ring") && lst.includes(".amb-thumb--mark") && lst.includes(".amb-chip--warn") && lst.includes(".amb-chip--neg") && lst.includes(".amb-chip--pos") && lst.includes(".amb-chip__dot"),
      "10a the mark thumb and the light's chip, with its tones, reach the Counter's stylesheet");
  } finally { pages.forEach((x) => x.close()); }
}
