/* test/admin-shop.mjs: SALT ADMIN'S SHOP ON THE SALT SYSTEM (canvas Salt Admin Shop, https://claude.ai/artifact/TrC768miLDPZb7U5wWciBQ, and
 * docs/plan-admin-shop.html; his yes of 25 Oct 2026 to every Ask). Each check red under its own mutation (test/admin-shop.mutations.json, run
 * with tools/section.mjs):
 *   P1.1  For now is first on Hours, before the glance and the week: the state as its title, the source as a chip, one line under it
 *   P1.2  its form is folded: Hold the shop opens it (Closed or Open, the until time, Not now and Set it) and Not now folds it again
 *   P1.3  the glance is three one-line KPI tiles, Points, Dates and Confirm time, each its count, and the confirm time's state in one line;
 *         a fresh read of the points redraws their count
 *   P2.1  the week and the dates each head their card in one row, the word and a chip
 *   P2.2  a tapped day holds, in order, its second choices two by two, what customers would see, then Discard changes beside Done; a tapped date too
 *   P2.3  Discard changes stands under the week only while it differs and no day is open
 *   P2.4  the dates keep their own wider name column, and the next day's tail is a solid bar, not a hatch
 *   P3.1  the collection points are a plain table in a card, a code and its place a row, a cross named by its point
 *   P3.2  the cross takes a point off the draft and sends nothing; with none left there is no table
 *   P3.3  the code and place fields side by side, Add a ghost beside its line, Save the points a pill across
 *   P4.1  Up now and New notice head the notice; Up now is the Counter's Notice recipe, the first line on, and every line numbered
 *   P4.2  the box is One line each, Set the notice a pill across, Clear it beside Read it again
 *   P4.3  with no notice up, the card goes and a line says customers see none
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
    /* P2.1 */
    const heads = [...p.d.querySelectorAll("#makerSchedule .anow-head")].map((h) => t(h.querySelector("h3")) + "/" + t(h.querySelector(".salt-status")));
    ok(JSON.stringify(heads) === JSON.stringify(["Weekly hours/Tap a day", "Dates/Stand in for the weekday"]), "the week and the dates each head their card in one row: " + heads.join(" | "));
    /* P2.2 */
    await p.tap("hours.day", "Monday");
    const box = p.d.querySelector(".maker-dayedit"), kids = box ? [...box.children] : [];
    const at = (sel) => kids.findIndex((k) => k.matches(sel));
    const pair = box && box.querySelector(".apair");
    ok(at(".ashop-two") >= 0 && at(".ashop-two") < at(".ashop-pv") && at(".ashop-pv") < at(".apair") && at(".apair") === kids.filter((k) => !k.hidden).length - 1
      && !!box.querySelector(".ashop-pv #makerHoursPreview") && !!pair && pair.children[0] === byAct(p.d, "hours.discard") && pair.children[1] === byAct(p.d, "hours.save", "Monday"),
      "a tapped day holds its second choices, what customers would see, then Discard changes beside Done: " + kids.map((k) => k.className).join(" | "));
    /* P2.3 */
    const to = byAct(p.d, "hours.day-to", "Monday"); to.value = "18:00"; to.dispatchEvent(new p.w.Event("change", { bubbles: true })); await p.work.quiet();
    ok(p.d.querySelectorAll('[data-act="hours.discard"]').length === 1 && !!byAct(p.d, "hours.discard").closest(".maker-dayedit"), "with the day open and changed, its one Discard changes is the day's own");
    await p.tap("hours.day", "Monday");
    const under = byAct(p.d, "hours.discard");
    ok(!p.d.querySelector(".maker-dayedit") && !!under && !under.closest(".maker-dayedit"), "with the day closed and the week changed, Discard changes stands under the week");
    await p.tap("hours.discard");
    ok(!byAct(p.d, "hours.discard"), "and goes once the week is as saved");
    await p.tap("hours.date", "2099-01-01");
    const dbox = p.d.querySelector(".maker-dates .maker-dayedit");
    ok(!!dbox && !!dbox.querySelector(".ashop-pv #makerHoursPreview") && !!dbox.querySelector('.apair [data-act="hours.discard"]'), "a tapped date opens the same editor, its preview and Discard changes inside");
    /* P2.4 */
    const css = [...p.d.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    ok(css.includes(".adm .maker-dates .maker-day{grid-template-columns:84px minmax(0,1fr) 128px}") && css.includes(".adm .maker-tail{background:color-mix(in srgb,var(--salt-brass) 45%,transparent)}"),
      "the dates keep an 84px name column, and the next day's tail is a solid bar at 45% brass");
    /* P3.1 */
    const pts = p.d.getElementById("makerPoints"), tbl = pts.querySelector("table.salt-table--plain");
    const cols = tbl ? [...tbl.querySelectorAll("thead th")].map(t) : [];
    const rowsP = tbl ? [...tbl.querySelectorAll("tbody tr")] : [];
    const x = byAct(pts, "points.remove", "A2");
    ok(!!tbl && !!tbl.closest(".salt-glass-card") && JSON.stringify(cols) === JSON.stringify(["Point", "Place", "Remove"])
      && JSON.stringify(rowsP.map((r) => t(r.querySelector("th[data-point]")) + " " + t(r.querySelector(".apoints-place")))) === JSON.stringify(["A2 3.11111, 101.22222", "B7 3.07381, 101.51846", "C3 3.20000, 101.60000"]),
      "the points are a plain table in a card, a code and its place a row: " + rowsP.map(t).join(" | "));
    ok(!!x && x.classList.contains("salt-ghost") && x.getAttribute("aria-label") === "Remove point A2" && t(x) === "" && !!x.querySelector("svg"),
      "each row's remove is a cross, named by its point");
    /* P3.2 */
    const sentBefore = p.posts.filter((y) => y.route === "/all/maker/points").length;
    x.click(); await p.work.quiet();
    ok([...p.d.querySelectorAll("#makerPoints tbody th[data-point]")].map(t).join() === "B7,C3" && p.posts.filter((y) => y.route === "/all/maker/points").length === sentBefore,
      "the cross takes the point off the draft and sends nothing until Save");
    for (const k of ["B7", "C3"]) { byAct(p.d, "points.remove", k).click(); await p.work.quiet(); }
    ok(!p.d.querySelector("#makerPoints table"), "with no points left there is no table");
    /* P3.3 */
    const addRow = byAct(pts, "points.add"), save = byAct(pts, "points.save");
    ok(!!byAct(pts, "points.code").closest(".apoints-add") && byAct(pts, "points.place").closest(".apoints-add") === byAct(pts, "points.code").closest(".apoints-add")
      && byAct(pts, "points.place").placeholder === "3.15214, 101.70312" && addRow.closest(".apair") && addRow.classList.contains("salt-ghost") && t(addRow.closest(".apair").querySelector(".msg")) === "Or paste a Maps link."
      && save.classList.contains("salt-pill") && !!save.closest(".apoints-save"),
      "the code and the place stand side by side, Add a ghost beside its line, and Save the points a pill across");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* P4: the notice, two lines up */
  const n = await open({ bulletin: (j) => ({ ...j, lines: ["Closed Fri 31 Oct for the stock count.", "Rice lands Saturday. Order ahead."] }) });
  try {
    await n.tap("nav.shop"); await n.tap("part.shop.notice");
    const root = n.d.getElementById("makerBulletin"), heads = [...root.querySelectorAll(".anow-head")];
    const up = n.d.getElementById("makerBulletinUp"), rec = up && up.querySelector(".salt-notice");
    /* P4.1 */
    ok(heads.length === 2 && JSON.stringify(heads.map((h) => t(h.querySelector("h3")) + "/" + t(h.querySelector(".salt-status")))) === JSON.stringify(["Up now/2 lines · every 6 s", "New notice/Notifies everyone"]),
      "Up now and New notice head their parts, the count of lines and that setting one notifies everyone: " + heads.map(t).join(" | "));
    ok(!!rec && !up.hidden && up.classList.contains("salt-glass-card") && t(rec.querySelector(".salt-notice__line--on")) === "Closed Fri 31 Oct for the stock count."
      && rec.querySelectorAll(".salt-notice__line").length === 2 && rec.querySelectorAll(".salt-notice__line--on").length === 1 && rec.querySelectorAll(".salt-notice__dot").length === 2,
      "Up now draws the notice on the Counter's Notice recipe, the first line on, a dot a line");
    ok(JSON.stringify([...n.d.querySelectorAll("#makerBulletinCurrent li")].map(t)) === JSON.stringify(["Closed Fri 31 Oct for the stock count.", "Rice lands Saturday. Order ahead."]) && n.d.getElementById("makerBulletinNone").hidden,
      "and every line numbered under it");
    /* P4.2 */
    const set = byAct(root, "notice.set"), clear = byAct(root, "notice.clear"), again = byAct(root, "notice.read");
    ok(set.classList.contains("salt-pill") && t(clear) === "Clear it" && clear.parentElement === again.parentElement && clear.parentElement.classList.contains("ashop-two")
      && t(byAct(root, "notice.text").closest("label").querySelector(".salt-field__label")) === "One line each",
      "the box is One line each, Set the notice a pill across, Clear it beside Read it again");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { n.w.close(); }

  /* P4.3: no notice up */
  const z = await open({ bulletin: (j) => ({ ...j, lines: [] }) });
  try {
    await z.tap("nav.shop"); await z.tap("part.shop.notice");
    ok(z.d.getElementById("makerBulletinUp").hidden && !z.d.getElementById("makerBulletinNone").hidden && t(z.d.getElementById("makerBulletinCount")) === "None",
      "with no notice up, the card goes and a line says customers see none");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { z.w.close(); }
}
