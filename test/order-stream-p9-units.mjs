/* test/order-stream-p9-units.mjs: A STEPPER A BOOK (plan version 9, 9b, his answer F and the canvas of 03 Nov 2026). Each check red under its
 * own mutation (test/order-stream-p9-units.mutations.json). The Counter page is the real stmt/page.js in jsdom (test/counter-b-kit.mjs
 * open()), its list the kit's (salt on a grid of quarters from 0.5 to 25 with a board, oil on a board alone) or one written here; every code
 * and name invented:
 *   - minus and plus walk the book's own sealed sizes: every grid point the Worker takes (sizeOk: only, multiples) and every board size
 *   - the figure beside it is the list's own; a step is said aloud, the units and the figure
 *   - a grid walked freely takes a typed size: off the walk it says why, past the grid's top it is an ask (no figure, Add still adds)
 *   - a book with only, or a board alone, is not typed
 *   - it starts at the basket's line, else their usual (with the chip), else the smallest; a start tile sets it to the tile's size
 *   - Add sets the basket's line, never adds to it; the button says In basket, then Update basket
 *   - the sizes stand one fold under it, each a tap that sets it, the chosen one pressed
 *   - an ask in the basket keeps Continue open, its line in the sheet carrying no figure */
export async function run({ ok, pageWork }) {
  const K = await import("./counter-b-kit.mjs");
  const pane = (p, shape) => [...p.d.querySelectorAll("#pPrices .pane")].find((x) => ((x.querySelector(".pmark") || {}).getAttribute("aria-label") || "").startsWith(shape));
  const st = (p, shape) => { const pn = pane(p, shape); const q = (s) => pn && pn.querySelector('[data-st="' + s + '"]');
    return { pn, less: q("less"), more: q("more"), val: q("val"), add: q("add"), fig: pn && pn.querySelector(".stfig"), say: pn && pn.querySelector('.sr[aria-live="polite"]'),
      usual: pn && pn.querySelector(".strow .salt-status"), why: pn && pn.querySelector(".salt-stepper__why"), line: pn && pn.querySelector(".bkline") }; };
  const units = (s) => K.txt(s.val);
  const type = async (p, s, v) => { s.val.click(); const i = s.pn.querySelector('[data-st="input"]'); i.value = v;
    i.dispatchEvent(new p.w.KeyboardEvent("keydown", { key: "Enter", bubbles: true })); await p.settle(); };
  const pages = [];
  try {
    const p = await K.open({ ok, pageWork }); pages.push(p);
    let s = st(p, "Cube");
    ok(!!s.less && !!s.more && !!s.val && !!s.add && !p.d.querySelector("#pPrices .szplus"), "9b each book carries a stepper and one Add; the + per size is gone");
    ok(units(s) === "0.5 unit" && s.less.disabled && !s.more.disabled && K.txt(s.fig) === "RM 50.00", "9b with no basket and no usual it starts at the smallest, minus greyed, the list's figure: " + units(s) + " " + K.txt(s.fig));
    s.more.click(); await p.settle(); s = st(p, "Cube");
    ok(units(s) === "0.75 unit" && K.txt(s.fig) === "RM 75.00" && K.txt(s.say) === "0.75 unit, RM 75.00", "9b plus walks the grid's next point, its figure read off the list and said aloud: " + K.txt(s.say));
    /* a typed size: on the walk, off it, past the top */
    ok(s.val.tagName === "BUTTON", "9b a grid walked freely is a tap to type");
    await type(p, s, "7"); s = st(p, "Cube");
    ok(units(s) === "7 units" && K.txt(s.fig) === "RM 686.00" && s.why.hidden, "9b a typed size on the walk is set at its own figure: " + units(s) + " " + K.txt(s.fig));
    await type(p, s, "7.1"); s = st(p, "Cube");
    ok(units(s) === "7 units" && !s.why.hidden && /steps of 0\.25/.test(K.txt(s.why)) && /^[A-Z].*\.$/.test(K.txt(s.why)), "9b a size off the walk is refused in a sentence and changes nothing: " + K.txt(s.why));
    await type(p, s, "30"); s = st(p, "Cube");
    ok(units(s) === "30 units" && K.txt(s.fig) === "Price on asking" && !s.add.disabled && s.more.disabled, "9b past the grid's top a size is an ask, Add still open, nothing above it: " + K.txt(s.fig));
    s.less.click(); await p.settle(); s = st(p, "Cube");
    ok(units(s) === "25 units", "9b minus from an ask steps back onto the walk's top: " + units(s));
    /* the fold */
    const row10 = s.pn.querySelector('details.sfold .szrow[data-q="10"]');
    ok(!!row10 && /Prices by size/.test(K.txt(s.pn.querySelector("details.sfold summary"))), "9b the sizes stand one fold under the stepper, named Prices by size");
    row10.click(); await p.settle(); s = st(p, "Cube");
    ok(units(s) === "10 units" && row10.getAttribute("aria-pressed") === "true" && [...s.pn.querySelectorAll(".szrow[aria-pressed=true]")].length === 1, "9b a size in the fold sets the stepper and is the one pressed");
    /* Add sets the line */
    s.add.click(); await p.settle(); s = st(p, "Cube");
    ok(/10 units/.test(K.txt(s.line)) && K.txt(s.add) === "In basket" && s.add.disabled, "9b Add puts the amount in the basket and then says In basket: " + K.txt(s.line));
    s.less.click(); await p.settle(); s = st(p, "Cube");
    ok(K.txt(s.add) === "Update basket" && !s.add.disabled, "9b a different amount offers Update basket");
    s.add.click(); await p.settle(); s = st(p, "Cube");
    ok(/9\.75 units/.test(K.txt(s.line)) && !/19/.test(K.txt(s.line)), "9b Add sets the line, never adds to it: " + K.txt(s.line));
    /* a board alone is walked by its sizes, never typed */
    let o = st(p, "Droplet");
    ok(!!o.val && o.val.tagName === "OUTPUT" && units(o) === "1 unit", "9b a board alone is not typed and starts at its smallest");
    if (o.more) { o.more.click(); await p.settle(); o = st(p, "Droplet"); }
    ok(!!o.val && units(o) === "3 units" && o.more.disabled && K.txt(o.fig) === "RM 115.00", "9b it walks its board sizes and stops at the last: " + units(o));
    /* an ask in the basket */
    if (o.add) { o.add.click(); await p.settle(); }
    await type(p, s, "30"); s = st(p, "Cube"); s.add.click(); await p.settle();
    ok(/RM 115/.test(K.txt(p.d.getElementById("bkBar"))), "9b the bar adds the priced lines alone: " + K.txt(p.d.getElementById("bkBar")));
    const go = p.d.getElementById("bkGo");
    ok(!!go && !go.disabled, "9b an ask in the basket keeps Continue open");
    go.click(); await p.settle();
    const sh = K.txt(p.d.getElementById("osheet"));
    ok(/30 units/.test(sh) && /115/.test(sh) && !/RM 0.00 /.test(sh), "9b its line rides to the check with the priced one, an ask beside it: " + sh.slice(0, 200));
    p.d.querySelector('#osheet [data-k="close"]').click(); await p.settle();
    /* a start tile sets the stepper; a fresh page starts at the basket's line */
    p.d.querySelector('#tabs button[data-t="home"]').click(); await p.settle();

    /* their usual, and an only grid */
    const list = K.LIST(); const g = list.products[0].grid; g.only = [0.5, 1, 2, 5]; g.max = 5; g.p = g.p.slice(0, 19);
    const u = await K.open({ ok, pageWork, list, orders: [K.done("u1", K.ago(48), { qty: 2, total: 200 }), K.done("u2", K.ago(30), { qty: 2, total: 200 })] }); pages.push(u);
    let v = st(u, "Cube");
    ok(units(v) === "2 units" && !v.usual.hidden && /usual/i.test(K.txt(v.usual)), "9b with no basket it starts at their usual, the chip shown: " + units(v));
    ok(v.val.tagName === "OUTPUT", "9b a grid with only is not typed");
    v.more.click(); await u.settle(); v = st(u, "Cube");
    ok(units(v) === "2.5 units" && v.usual.hidden, "9b only's sizes and the board's are the walk (2 then the board's 2.5), the chip gone off the usual: " + units(v));
    v.more.click(); await u.settle(); v = st(u, "Cube");
    ok(units(v) === "5 units", "9b a grid point only leaves out is skipped (3, 4 and 4.5 never stepped on): " + units(v));
    /* the start tile */
    const fresh = await K.open({ ok, pageWork }); pages.push(fresh);
    const tile = [...fresh.d.querySelectorAll("#pHome .htile")][1];
    tile.click(); await fresh.settle();
    const f = st(fresh, "Cube");
    ok(units(f) === "2.5 units" && fresh.d.activeElement === f.val, "9b a start tile sets its book's stepper to its size and focuses it: " + units(f));
  } finally { pages.forEach((x) => x.close()); }
}
