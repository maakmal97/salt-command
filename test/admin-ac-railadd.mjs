/* test/admin-ac-railadd.mjs: SALT ADMIN A TO C, P10 (21 Oct 2026; docs/plan-counter-admin-ac.html), re-aimed 15 Nov 2026 with the move to
 * Ambient. From 21 Oct 2026 the + was a rail button from 1080px and a floating orb on a phone. Ambient's app bar floats over the screen at
 * every width, so the + was one circle in it, the orb's id and act kept, and the rail's button was gone.
 * 22 Nov 2026 (the place head, his word: the + is retired): his page draws no app bar and no +, so Record is reached in one tap from the dock and the rail,
 * and nothing keeps the room a + took. What is proved here, each check red under its own mutation (test/admin-ac-railadd.mutations.json):
 *   1  there is no + on his page: no app bar, no circle, no #oAdd, no nav.add act, no rail button or orb, and no rule of the page's placing one
 *   2  Record is one tap in the dock, and a tap opens Record on Entry from every other place */
import { richOwnerPage, byAct } from "./maker-act.mjs";
import { landingPage } from "../stmt/page.js";

const J = JSON.stringify;

export async function run({ ok, pageWork }) {
  const p = await richOwnerPage({ pageWork });
  try {
    await p.work.quiet();
    const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); };
    const css = [...d.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    const html = landingPage("", "railadd", { master: "", accounts: [] });
    /* 1 */
    ok(!d.querySelector("#roster > .amb-appbar") && !d.querySelector("#roster .amb-appbar, #roster .amb-circle") && !d.getElementById("oAdd") && !byAct(d, "nav.add")
      && !d.getElementById("oAddRail") && !byAct(d, "rail.add") && !/#oAdd\b/.test(css) && !/nav\.add/.test(html),
      "there is no + on his page: no app bar, no circle, no #oAdd, no nav.add act (page or script), no rail button, and no rule of the page's placing one");
    /* 2 */
    const rec = d.querySelector('#roster .amb-tabbar .place[data-m="record"]');
    ok(!!rec && rec.getAttribute("data-act") === "nav.record" && /Record/.test(rec.textContent),
      "Record stands in the dock, one tap from every place: " + (rec && rec.outerHTML.slice(0, 120)));
    const from = [];
    for (const place of ["needs", "orders", "customers", "shop"]) {
      await click(byAct(d, "nav." + place));
      await click(byAct(d, "nav.record"));
      const strip = d.querySelector('.aparts[data-place="record"] [data-part="entry"]');
      from.push(rec.getAttribute("aria-current") === "page" && !d.querySelector('[data-in="record"]').hidden && !!strip && strip.getAttribute("aria-pressed") === "true");
    }
    ok(from.length === 4 && from.every(Boolean), "a tap on Record from Needs you, Orders, Customers or Settings opens Record on Entry: " + J(from));
  } finally { p.w.close(); }
}
