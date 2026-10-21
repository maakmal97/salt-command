/* test/admin-ac-railadd.mjs: SALT ADMIN A TO C, P10 (21 Oct 2026; docs/plan-counter-admin-ac.html). What is proved here, each check red under its
 * own mutation (test/admin-ac-railadd.mutations.json):
 *   1  from 1080px no orb floats over the page; the + is a button of the rail, under his places, the system's rail tab with the + mark and words
 *   2  it opens Record on Entry, as the orb does, and stands on every place but Record
 *   3  the phone keeps its orb */
import { richOwnerPage, byAct } from "./maker-act.mjs";

const J = JSON.stringify;

export async function run({ ok, pageWork }) {
  const p = await richOwnerPage({ pageWork });
  try {
    await p.work.quiet();
    const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); };
    const css = [...d.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    const rail = d.getElementById("oAddRail");
    /* 1 */
    ok(/@media \(min-width:1080px\)\{\.adm #oAdd\{display:none\}\}/.test(css) && !!rail && rail.tagName === "BUTTON" && rail.classList.contains("salt-rail__tab")
      && rail.closest("nav.salt-rail") && rail.closest(".salt-rail__group").parentElement.matches("nav.salt-rail") && rail.closest(".salt-rail__group") !== d.querySelector("nav.salt-rail .salt-rail__group") && !!rail.querySelector(".salt-appbar__icon svg")
      && rail.textContent === "New entry" && byAct(d, "rail.add") === rail,
      "from 1080px the orb gives way to a rail button under his places, the system's rail tab with the + mark and its words: " + (rail && rail.outerHTML.slice(0, 160)));
    /* 2 */
    const there = [];
    for (const place of ["needs", "orders", "customers", "shop"]) { await click(byAct(d, "nav." + place)); there.push(!!rail && !rail.hidden); }
    if (rail) await click(rail);
    const lit = d.querySelector('[data-act="nav.record"].salt-rail__tab');
    ok(there.every(Boolean) && lit.getAttribute("aria-current") === "page" && !d.querySelector('[data-in="record"]').hidden && !!rail && rail.hidden && d.getElementById("oAdd").hidden,
      "it stands on every place but Record, and opens Record, where it and the orb both stand down: " + J(there));
    /* 3 */
    ok(!!d.getElementById("oAdd") && /\.adm #oAdd\{position:fixed;right:16px;/.test(css), "and the phone keeps its orb");
  } finally { p.w.close(); }
}
