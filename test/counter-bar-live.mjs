/* test/counter-bar-live.mjs: WHAT WAITS ON THEM, ON THE COUNTER (21 Oct 2026, his word; 15 Nov 2026, the move to Ambient).
 *
 * From 21 Oct 2026 the header heading every place was the system's desk bar, the place and the chips of what waits on them. With the move to
 * Ambient the place is the hero's title and the bar's chips went: the orders that need them are the Orders tab's count, Ambient's (0.7.2),
 * the tab's name saying it ("Orders, 1 waiting"), and nothing is drawn while nothing waits; To pay now is Home's own. Never a customer's
 * count on his page. Observed on the signed-in page in jsdom (test/counter-b-kit.mjs); each check proved red by its own mutation
 * (test/counter-bar-live.mutations.json). */
import { open, ago, txt } from "./counter-b-kit.mjs";
import { ord } from "./counter-b-kit.mjs";

export async function run({ ok, pageWork }) {
  const P = await import("../stmt/page.js");
  const pages = [];
  const page = async (o) => { const p = await open(Object.assign({ pageWork }, o)); pages.push(p); return p; };
  try {
    const owes = ord("o1", "ready", ago(30), { moved: 1, movedOn: ago(30).slice(0, 10) });
    const A = await page({ orders: [owes], late: 2 });
    const d = A.d, hero = d.querySelector("#tabs > .amb-screen > header.amb-hero");
    ok(!!hero && hero.contains(d.getElementById("placeT")) && d.getElementById("placeT").classList.contains("amb-hero__title") && !d.getElementById("cBarChips") && !d.querySelector("header.chead"),
      "the customer's place is named by its hero's title, and no bar of chips stands over it");
    const tab = d.querySelector('#tabs .amb-tabbar button[data-t="order"]'), n = tab && tab.querySelector(".amb-tab__count");
    ok(!!n && !n.hidden && +txt(n) > 0 && n.getAttribute("aria-hidden") === "true" && tab.getAttribute("aria-label") === "Orders, " + txt(n) + " waiting",
      "the Orders tab carries the orders that need them, its name saying it: " + JSON.stringify([n && txt(n), tab && tab.getAttribute("aria-label")]));
    const others = [...d.querySelectorAll("#tabs .amb-tabbar [data-n]")].filter((c) => c.getAttribute("data-n") !== "order");
    ok(others.length === 4 && others.every((c) => c.hidden && c.textContent === ""), "and no other place carries a count");
    tab.click(); await A.settle();
    ok(d.getElementById("tabs").getAttribute("data-place") === "order", "a tap on the Orders tab opens Orders: " + d.getElementById("tabs").getAttribute("data-place"));

    const B = await page({ orders: [] });
    const tb = B.d.querySelector('#tabs .amb-tabbar button[data-t="order"]');
    ok(tb.querySelector(".amb-tab__count").hidden && tb.getAttribute("aria-label") === "Orders", "with nothing waiting, nothing is drawn and the tab is its word: " + tb.getAttribute("aria-label"));

    const html = P.landingPage("", "nown", { master: "fixture-master", accounts: [] });
    ok(!/id="cBarChips"/.test(html) && !/class="chead/.test(html), "his view of an account carries no customer bar");
  } finally { pages.forEach((p) => { try { p.w.close(); } catch (e) { } }); }
}
