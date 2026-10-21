/* test/counter-bar-live.mjs: THE COUNTER'S HEADER IS THE BAR AGAIN (21 Oct 2026, his word, reversing Counter Batch A's no bar of 18 Oct 2026).
 *
 * The header heading every place is the system's desk bar: the place they are in, then only what waits on them, each a chip to where it is:
 * To pay now with its figure, the orders that need them (the rail's own count), and their messages while ours is unread. Nothing waits, nothing
 * is drawn. Never on his view of an account, which has his own bar. Observed on the signed-in page in jsdom (test/counter-b-kit.mjs); each check
 * proved red by its own mutation (test/counter-bar-live.mutations.json). */
import { open, ago, txt } from "./counter-b-kit.mjs";
import { ord } from "./counter-b-kit.mjs";

export async function run({ ok, pageWork }) {
  const P = await import("../stmt/page.js");
  const pages = [];
  const page = async (o) => { const p = await open(Object.assign({ pageWork }, o)); pages.push(p); return p; };
  try {
    const owes = ord("o1", "ready", ago(30), { moved: 1, movedOn: ago(30).slice(0, 10) });
    const A = await page({ orders: [owes], late: 2 });
    const d = A.d, head = d.querySelector("header.chead"), box = d.getElementById("cBarChips");
    ok(!!head && head.classList.contains("salt-deskbar") && !!box && head.contains(box) && head.contains(d.getElementById("placeT")),
      "the customer's header is the desk bar, holding the place and what waits");
    const chip = (k) => box.querySelector('[data-act="bar.' + k + '"]');
    const rail = txt(d.querySelector('#tabs [data-n="order"]'));
    ok(!!chip("order") && txt(chip("order").querySelector(".salt-deskbar__n")) === rail && +rail > 0,
      "Orders carries the orders that need them, the rail's own count: " + JSON.stringify([chip("order") && txt(chip("order")), rail]));
    const tile = txt(d.querySelector("#homeFoot .salt-kpi__value, #payHead .salt-kpi__value"));
    ok(!!chip("pay") && /^RM [0-9,]+\.[0-9]{2}$/.test(tile) && txt(chip("pay")) === "To pay now " + tile, "To pay now carries Home's own figure: " + JSON.stringify([chip("pay") && txt(chip("pay")), tile]));
    ok([...box.querySelectorAll("button")].every((b) => b.hasAttribute("data-act")), "every chip carries its act");
    chip("order").click(); await A.settle();
    ok(d.getElementById("tabs").getAttribute("data-place") === "order", "a tap on Orders opens Orders: " + d.getElementById("tabs").getAttribute("data-place"));
    chip("pay").click(); await A.settle();
    ok(d.getElementById("tabs").getAttribute("data-place") === "home", "a tap on To pay now opens Home, where Pay is: " + d.getElementById("tabs").getAttribute("data-place"));

    const B = await page({ orders: [] });
    ok(B.d.getElementById("cBarChips").children.length === 0, "with nothing waiting, nothing is drawn: " + B.d.getElementById("cBarChips").innerHTML);

    const html = P.landingPage("", "nown", { master: "fixture-master", accounts: [] });
    ok(!/id="cBarChips"/.test(html) && !/class="chead salt-deskbar/.test(html), "his view of an account keeps its own bar: no customer bar on his page");
  } finally { pages.forEach((p) => { try { p.w.close(); } catch (e) { } }); }
}
