/* test/admin-shop.mjs: SALT ADMIN'S SHOP ON THE SALT SYSTEM (canvas Salt Admin Shop, https://claude.ai/artifact/TrC768miLDPZb7U5wWciBQ, and
 * docs/plan-admin-shop.html; his yes of 25 Oct 2026 to every Ask). Each check red under its own mutation (test/admin-shop.mutations.json, run
 * with tools/section.mjs):
 *   P1.1  For now is first on Hours, before the glance and the week: the state as its title, the source as a chip, one line under it
 *   P1.2  its form is folded: Hold the shop opens it (Closed or Open, the until time, Not now and Set it) and Not now folds it again
 *   P1.3  the glance is three one-line KPI tiles, Points, Dates and Confirm time, each its count, and the confirm time's state in one line;
 *         a fresh read of the points redraws their count
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage, byAct } from "./maker-act.mjs";

const t = (n) => (n ? n.textContent.replace(/\s+/g, " ").trim() : "");
const p0 = { slow: false };
const POINTS = { ok: true, points: { v: 1, list: [{ code: "A2", lat: 3.11111, lng: 101.22222 }, { code: "B7", lat: 3.07381, lng: 101.51846 }] }, examples: [] };

export async function run({ ok, pageWork }) {
  const open = async (opts = {}) => {
    /* slow: the points answer after the hours have drawn, as a slower read would */
    const p = await richOwnerPage({ pageWork, extra: (route) => (route !== "/all/maker/points" ? undefined
      : p0.slow ? new Promise((done) => setTimeout(() => done(JSON.parse(JSON.stringify(POINTS))), 30)) : JSON.parse(JSON.stringify(POINTS))), ...opts });
    await p.work.quiet();
    p.tap = async (act, key) => { const c = byAct(p.d, act, key); if (c) c.click(); await p.work.quiet(); return !!c; };
    return p;
  };
  const p = await open({ hours: (j) => { j.config.schedule.dates = { "2099-01-01": null }; j.status = { open: true, source: "schedule" }; return j; } });
  try {
    await p.tap("nav.shop"); await p.tap("part.shop.hours");
    /* P1.1 */
    const card = p.d.getElementById("makerNowCard"), glance = p.d.getElementById("makerConfirm"), week = p.d.getElementById("makerSchedule");
    const before = (a, b) => !!(a && b && (a.compareDocumentPosition(b) & p.w.Node.DOCUMENT_POSITION_FOLLOWING));
    const title = card && card.querySelector(".anow-title");
    ok(before(card, glance) && before(glance, week) && card.classList.contains("salt-glass-card"),
      "For now is first on Hours, a glass card before the glance and the week");
    ok(!!title && title.getAttribute("data-now") === "open" && /^Open/.test(t(title)) && t(card.querySelector(".anow-head .salt-status")) === "Weekly hours"
      && t(p.d.getElementById("makerHoursStatus")) === "Customers can order and you answer now.",
      "its title is the state, its chip the source and one line says what it means: " + t(card));
    /* P1.2 */
    const form = p.d.getElementById("makerHold"), hold = byAct(p.d, "hours.hold");
    ok(!!form && form.hidden && !!hold && t(hold) === "Hold the shop" && hold.classList.contains("salt-pill") && hold.getAttribute("aria-expanded") === "false" && !byAct(p.d, "hours.override-clear"),
      "the form is folded behind one pill, Hold the shop, and no way back is offered with no override filed");
    await p.tap("hours.hold");
    const opened = p.d.getElementById("makerHold"), not = byAct(p.d, "hours.hold");
    ok(!!opened && !opened.hidden && !!opened.querySelector('[data-act="hours.override-state"]') && !!opened.querySelector('[data-act="hours.override-until"]')
      && t(not) === "Not now" && opened.contains(not) && opened.contains(byAct(p.d, "hours.override-set")) && not.getAttribute("aria-expanded") === "true",
      "Hold the shop opens it: the two tiles, the until time, then Not now beside Set it");
    await p.tap("hours.hold");
    ok(p.d.getElementById("makerHold").hidden && t(byAct(p.d, "hours.hold")) === "Hold the shop", "Not now folds it again");
    /* P1.3 */
    const tiles = [...p.d.querySelectorAll("#makerConfirm .salt-kpi")];
    ok(tiles.length === 3 && tiles.every((x) => x.classList.contains("salt-kpi--line"))
      && JSON.stringify(tiles.map((x) => t(x.querySelector(".salt-kpi__label")) + "=" + t(x.querySelector(".salt-kpi__value")))) === JSON.stringify(["Points=2", "Dates=1", "Confirm time=None"]),
      "the glance is three one-line tiles, Points, Dates and Confirm time, each its count: " + tiles.map(t).join(" | "));
    ok(t(p.d.querySelector("#makerConfirm .shglance-note")) === "Not measured yet · the hourly measure files it", "and the confirm time's state is one line under them");
    POINTS.points.list.push({ code: "C3", lat: 3.2, lng: 101.6 }); p0.slow = true;
    await p.tap("part.shop.notice"); await p.tap("part.shop.hours");
    await new Promise((done) => setTimeout(done, 80)); await p.work.quiet(); p0.slow = false; POINTS.points.list.pop();
    ok(t(p.d.querySelector('#makerConfirm [data-glance="points"]')) === "3", "a fresh read of the points redraws their count");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }
}
