/* test/order-stream-p8-order.mjs: ORDER IS WHERE EVERY ORDER STARTS (plan version 8, 8a and 8b, his answers F and G of 02 Nov 2026 and the
 * canvas of 03 Nov 2026). Each check red under its own mutation (test/order-stream-p8-order.mutations.json). The Counter page is the real
 * stmt/page.js in jsdom (test/counter-b-kit.mjs open()), every code and name invented:
 *   8a Prices is named Order and stands second after Home; Orders' New order, Home's start tiles and Home's Collect and Deliver land on
 *      Order, never on the sheet, a tile at its book with its size in focus and the way chosen kept
 *   8b a new order's sheet keeps the way, the place, when, the note and the check: no size is chosen in it; its lines are the basket's (or
 *      the size tapped), listed with their figures, and the units change on Order; opened on the way alone it lists none, offers no
 *      Review and closes with Done, keeping the way; nothing is filled in for them, a size tapped before included */
export async function run({ ok, pageWork }) {
  const K = await import("./counter-b-kit.mjs");
  const shown = (p) => !p.d.getElementById("pPrices").hidden && !!p.d.querySelector('#tabs button[data-t="prices"][aria-current="page"]');
  const sheet = (p) => p.d.getElementById("osheet");
  const pages = [];
  try {
    /* ---- 8a: the place ---- */
    const p = await K.open({ ok, pageWork }); pages.push(p);
    const bar = [...p.d.querySelectorAll("#tabs button[data-t]")].filter((b) => !b.closest(".salt-rail"));
    const rail = [...p.d.querySelectorAll(".salt-rail button[data-t]")];
    ok([bar, rail].every((l) => l.length >= 4 && l[0].getAttribute("data-t") === "home" && l[1].getAttribute("data-t") === "prices" && K.txt(l[1]) === "Order"),
      "8a Prices is named Order and stands second after Home, on the bar and the rail: " + JSON.stringify(rail.map(K.txt)));
    ok(!p.d.body.innerHTML.includes(">Prices<"), "8a no place is named Prices any more");
    /* a fresh account: Home's start tiles and its Collect and Deliver */
    const tile = p.d.querySelector("#pHome .htile");
    ok(!!tile, "the fixture: a fresh account's Home draws start tiles");
    tile.click(); await p.settle();
    const focused = p.d.activeElement;
    ok(shown(p) && !sheet(p), "8a a start tile lands on Order and opens no sheet");
    ok(!!focused && focused.classList.contains("szrow") && focused.getAttribute("data-q") === "1" && !!focused.closest(".pane") && !!focused.closest(".pane").querySelector(".pmark"),
      "8a the tile's size is in focus on Order, in its book's pane: " + (focused ? focused.className + " " + focused.getAttribute("data-q") : "none"));
    p.d.querySelector('#tabs button[data-t="home"]').click(); await p.settle();
    p.d.querySelector('#pHome .hstart[data-start="deliver"]').click(); await p.settle();
    ok(shown(p) && !sheet(p) && /Delivering/.test(K.txt(p.d.getElementById("pWay"))), "8a Home's Deliver lands on Order, the way said there, no sheet: " + K.txt(p.d.getElementById("pWay")));
    p.d.querySelector('#tabs button[data-t="order"]').click(); await p.settle();
    const nb = p.d.getElementById("oNew");
    ok(!!nb, "the fixture: Orders offers New order");
    nb.click(); await p.settle();
    ok(shown(p) && !sheet(p), "8a Orders' New order lands on Order and opens no sheet");

    /* ---- 8b: the sheet ---- */
    /* a size tapped on Order opens the sheet on that line alone */
    const row = [...p.d.querySelectorAll("#pPrices .szrow[data-q]")].find((r) => r.getAttribute("data-q") === "2.5");
    row.click(); await p.settle();
    const lines = () => [...p.d.querySelectorAll("#osheet [data-sheet-lines] .salt-settings__row")];
    ok(!!sheet(p) && !p.d.querySelector('#osheet input[type="radio"][name^="osize"]') && !p.d.querySelector("#osheet .oany"),
      "8b a new order's sheet chooses no size: no size radios and no typed size");
    ok(lines().length === 1 && /2\.5 units/.test(K.txt(lines()[0])) && /RM 250/.test(K.txt(lines()[0])), "8b the size tapped is the sheet's one line, with its figure: " + lines().map(K.txt));
    ok(/Change the units on Order\./.test(K.txt(sheet(p))), "8b the sheet says the units change on Order");
    ok(!!p.d.getElementById("oGo") && !p.d.getElementById("oDone"), "8b with a line, Review stands and Done does not");
    p.d.querySelector('#osheet [data-k="close"]').click(); await p.settle();
    /* the basket's lines are the sheet's */
    const plus = (prod, q) => [...p.d.querySelectorAll("#pPrices .szplus")].find((b) => b.getAttribute("data-add") === q && b.closest(".pane") && b.closest(".pane").querySelector(".pmark").getAttribute("aria-label").startsWith(prod));
    plus("Cube", "1").click(); plus("Droplet", "3").click(); await p.settle();
    p.d.getElementById("bkGo").click(); await p.settle();
    ok(lines().length === 2 && lines().map(K.txt).join("|").includes("RM 100") && lines().map(K.txt).join("|").includes("RM 115"),
      "8b Review from the basket lists the basket's two lines: " + lines().map(K.txt));
    p.d.querySelector('#osheet [data-k="close"]').click(); await p.settle();
    p.d.querySelector("#pPrices [data-bkout]").click(); await p.settle();
    p.d.querySelector("#pPrices [data-bkout]").click(); await p.settle();
    /* the way alone: nothing filled in, Done keeps the way */
    p.d.getElementById("pWayGo").click(); await p.settle();
    ok(!!sheet(p) && lines().length === 0 && /the units are chosen on Order/.test(K.txt(sheet(p))),
      "8b the way's Change with an empty basket opens the sheet on the way alone, no line filled in for them (the size tapped before included)");
    ok(!p.d.getElementById("oGo") && !!p.d.getElementById("oDone"), "8b on the way alone there is no Review, and Done");
    p.d.querySelector('#osheet [data-k="mode:0"]').click(); await p.settle();
    p.d.getElementById("oDone").click(); await p.settle();
    ok(!sheet(p) && /Collecting/.test(K.txt(p.d.getElementById("pWay"))), "8b Done closes the sheet and the way chosen stands on Order: " + K.txt(p.d.getElementById("pWay")));
  } finally { pages.forEach((x) => x.close()); }
}
