/* test/admin-ac-railadd.mjs: SALT ADMIN A TO C, P10 (21 Oct 2026; docs/plan-counter-admin-ac.html), re-aimed 15 Nov 2026 with the move to
 * Ambient. From 21 Oct 2026 the + was a rail button from 1080px and a floating orb on a phone. Ambient's app bar floats over the screen at
 * every width, so the + is one circle in it, the orb's id and act kept, and the rail's button is gone. What is proved here, each check red
 * under its own mutation (test/admin-ac-railadd.mutations.json):
 *   1  the + is one Ambient circle in the app bar's right group, the plus glyph, named by its label, and no rail button or orb rule stands
 *   2  it opens Record on Entry and stands on every place but Record, where it stands down */
import { richOwnerPage, byAct } from "./maker-act.mjs";

const J = JSON.stringify;

export async function run({ ok, pageWork }) {
  const p = await richOwnerPage({ pageWork });
  try {
    await p.work.quiet();
    const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); };
    const css = [...d.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    const add = d.getElementById("oAdd");
    /* 1 */
    ok(!!add && add.tagName === "BUTTON" && add.classList.contains("amb-circle") && add.parentElement.matches("#roster > .amb-appbar > .amb-appbar__group")
      && !!add.querySelector('svg.amb-icon use[href="#amb-plus"]') && add.getAttribute("aria-label") === "Record an entry" && byAct(d, "nav.add") === add
      && !d.getElementById("oAddRail") && !byAct(d, "rail.add") && !/#oAdd\{/.test(css),
      "the + is one Ambient circle in the app bar, the plus glyph, named by its label, with no rail button and no rule of the page's placing it: " + (add && add.outerHTML.slice(0, 160)));
    /* 2 */
    const there = [];
    for (const place of ["needs", "orders", "customers", "shop"]) { await click(byAct(d, "nav." + place)); there.push(!!add && !add.hidden); }
    await click(add);
    const lit = d.querySelector('.amb-tabbar [data-act="nav.record"]');
    ok(there.every(Boolean) && lit.getAttribute("aria-current") === "page" && !d.querySelector('[data-in="record"]').hidden && add.hidden,
      "it stands on every place but Record, and opens Record, where it stands down: " + J(there));
  } finally { p.w.close(); }
}
