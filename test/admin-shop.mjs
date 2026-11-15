/* test/admin-shop.mjs: SALT ADMIN'S SHOP ON THE SALT SYSTEM (canvas Salt Admin Shop, https://claude.ai/artifact/TrC768miLDPZb7U5wWciBQ, and
 * docs/plan-admin-shop.html; his yes of 25 Oct 2026 to every Ask). Each check red under its own mutation (test/admin-shop.mutations.json, run
 * with tools/section.mjs):
 *   (26 Oct 2026, his word: Hours in the same language as Notice, Practice and This device; the glance's tiles went)
 *   P1.1  Now is first on Hours, one list: the state beside what holds it, the confirm time, and Hold the shop; a grey line under it
 *   P1.2b its grey line, the switch on, one sentence (1 Nov 2026)
 *   P1.2  Hold the shop is a Switch: on shows Hold as (a Segment, Closed or Open), Until and Set it, the one pill; off before Set it sends nothing
 *   P2.1  the week and the dates are lists under grey heads, a grey line under each, no chip
 *   P2.2  a tapped day is its name, a list (Open and Open all day switches, Opens and Closes), rows of what can be done, the preview, then Done
 *   P2.3  Discard changes is an ember row of the open day, else a row under the week only while it differs; a tapped date too
 *   P2.4  the dates keep their own wider name column, and the next day's tail is a solid bar, not a hatch
 *   P3.1  the collection points are a list, a code and its place a row, a cross named by its point
 *   P3.2  the cross takes a point off the draft and sends nothing; with none left the list says None
 *   P3.3  New point is a list, Code and Place rows and Add point; Save the points the one pill
 *   P3.4  Help is a list of its four answers under a grey head
 *   P4.1  Notice is two settings groups, Up now and New notice: a row a line, its one grey line, no chip or count
 *   P4.2  New notice is a box filling its cell, one grey line, Set the notice the one pill; Clear the notice an ember row; Read it again hidden
 *   P4.3  with no notice up, the list says None, Clear the notice goes, and no grey line stands
 *   P5.1  Practice is one Practice accounts switch, on only while all three exist, a grey line saying what is made
 *   P5.2  a row an account made, the password row copying it, Open the test page a row to /all/test only while all three are open
 *   P5.3  turning it off asks once on the Sheet: Keep them sends nothing, Remove sends the one removal
 *   P6.1  This device is one list of settings, each row a name and one switch: Show names, Notifications (Tide theme gone, 15 Nov 2026)
 *   P6.2  turning Show names on asks for the password in the one Sheet, and stays off until it is given
 *   P6.3  the Notifications switch takes the old road to turn them on; refused, it stays off and free, the line saying why
 *   P6.4  the customer's page draws no Look row either (15 Nov 2026, the move to Ambient)
 *   P7.1  from 860px the open day stands in the pane beside the week, "No day open" until a tap, and none under its row
 *   P7.2  from 860px Shop takes the whole column, Now, the points and Help in one 640px column, the open day's pane beside the week
 *   P7.3  from 860px Notice, Practice and This device stand in one 640px column, as a Mac's settings
 *   P7.4  Shop's four parts are the Nav bar's text tabs; Collection points and Help head as the other sections
 * Drawn by the maker harness (test/maker-act.mjs). */
import fs from "fs";
import { richOwnerPage, byAct } from "./maker-act.mjs";
import { landingPage } from "../stmt/page.js";

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
  /* 16 Nov 2026, the move to Ambient (place I): Shop is drawn in Ambient's parts. Each check below keeps its number and its claim, read off the new markup:
     settings groups (div.amb-settings with a head, one ul.amb-settings__list of li rows, a foot), input.amb-switch, Segment, the week of spans, panes with their foot */
  const p = await open({ hours: (j) => { j.config.schedule.dates = { "2099-01-01": null }; j.status = { open: true, source: "schedule" }; return j; } });
  try {
    await p.tap("nav.shop"); await p.tap("part.shop.hours");
    /* P1.1, his word of 26 Oct 2026: Hours in the same language as Notice, Practice and This device */
    const card = p.d.getElementById("makerNowCard"), week = p.d.getElementById("makerSchedule"), list = card && card.querySelector(".amb-settings");
    const before = (a, b) => !!(a && b && (a.compareDocumentPosition(b) & p.w.Node.DOCUMENT_POSITION_FOLLOWING));
    const title = card && card.querySelector(".anow-title"), rows = list ? [...list.querySelectorAll(".amb-settings__list > li > *")] : [];
    ok(before(card, week) && !card.className.includes("amb-pane") && t(card.querySelector("h3.amb-settings__head")) === "Now" && !p.d.querySelector("#oShop .amb-tiles, #oShop .shglance")
      && JSON.stringify(rows.map((r) => t(r.querySelector(".amb-setting__name")))) === JSON.stringify([t(title), "Confirm time", "Hold the shop"]),
      "Now is first on Hours, one list: the state, the confirm time and Hold the shop, with no tiles: " + rows.map(t).join(" | "));
    ok(!!title && title.getAttribute("data-now") === "open" && /^Open/.test(t(title)) && t(rows[0].querySelector(".amb-setting__value")) === "Weekly hours"
      && t(p.d.getElementById("makerHoursStatus")) === "Customers can order and you answer now." && p.d.getElementById("makerHoursStatus").classList.contains("amb-settings__foot")
      && t(rows[1].querySelector('[data-glance="confirm"]')) === "None",
      "its first row is the state beside what holds it, the confirm time a row, and one grey line says what it means: " + t(card));
    /* P1.2 */
    const hold = byAct(p.d, "hours.hold");
    ok(!!hold && hold.classList.contains("amb-switch") && hold.type === "checkbox" && hold.getAttribute("role") === "switch" && hold.checked === false && !p.d.getElementById("makerHold")
      && !byAct(p.d, "hours.override-set"), "Hold the shop is a switch, off, with nothing under it and no pill");
    await p.tap("hours.hold");
    const opened = p.d.getElementById("makerHold"), seg = opened && opened.querySelector(".amb-segment");
    ok(!!opened && byAct(p.d, "hours.hold").checked === true && !!seg
      && JSON.stringify([...seg.querySelectorAll(".amb-segment__opt")].map((r) => t(r) + ":" + r.getAttribute("aria-pressed"))) === JSON.stringify(["Closed:true", "Open:false"])
      && !!p.d.querySelector('[data-act="hours.override-until"]') && card.querySelectorAll(".amb-pill:not(.amb-pill--quiet)").length === 1 && t(byAct(p.d, "hours.override-set")) === "Set it",
      "turned on, it shows Hold as, a Segment of Closed and Open, the until time, and Set it, the one pill");
    /* P1.2b, 1 Nov 2026: its grey line is one sentence, as every grey line is (craft.md section 3; it read "Kuala Lumpur time. Customers can still order.") */
    const holdFoot = t(p.d.getElementById("makerHoursStatus"));
    ok(holdFoot === "Kuala Lumpur time; customers can still order." && !/[.!?] [A-Z]/.test(holdFoot), "with Hold the shop on, the grey line is one sentence: " + holdFoot);
    await p.tap("hours.hold");
    ok(!p.d.getElementById("makerHold") && byAct(p.d, "hours.hold").checked === false && !byAct(p.d, "hours.override-set") && !p.posts.some((y) => y.route === "/all/maker/hours"),
      "turned off before Set it, it folds and sends nothing");
    /* P2.1: the week is Ambient's week of spans, the dated days after Sunday in the same list */
    const fig = p.d.querySelector("#makerSchedule > figure.amb-chart"), ol = fig && fig.querySelector("ol.amb-week"), days = ol ? [...ol.children] : [];
    const dgroups = [...p.d.querySelectorAll("#makerSchedule > .amb-settings > h3.amb-settings__head")].map(t), dfoot = t(p.d.querySelector("#makerSchedule > .maker-dates > .amb-settings__foot"));
    ok(!!fig && /^Weekly hours/.test(t(fig.querySelector(".amb-chart__title"))) && /Tap a day to change it/.test(t(fig.querySelector(".amb-chart__note"))) && days.length === 8
      && days.slice(0, 7).every((li) => li.firstElementChild.classList.contains("amb-week__day") && !!li.querySelector("svg.amb-week__bar[viewBox='0 0 24 1']") && !!li.querySelector(".amb-week__name") && !!li.querySelector(".amb-week__said"))
      && days[7].classList.contains("amb-week__dated") && !!days[7].querySelector('[data-act="hours.date"][data-key="2099-01-01"]') && !!fig.querySelector("ol.amb-week__axis") && !!fig.querySelector("ul.amb-legend")
      && JSON.stringify(dgroups) === JSON.stringify(["Dates"]) && /^A date stands in for its weekday/.test(dfoot) && !p.d.querySelector("#makerSchedule .amb-chip, #makerSchedule .salt-status"),
      "the week is a week of spans, a row a day with its bar and its words, the dated day after Sunday, the dates a group under a grey head with a grey line: " + dgroups.join(" | "));
    /* P2.2 */
    await p.tap("hours.day", "Monday");
    const box = p.d.querySelector(".maker-dayedit"), acts = p.d.querySelector(".maker-dayedit-acts"), pv = p.d.querySelector(".maker-preview"), foot = p.d.querySelector("#makerSchedule > .amb-foot");
    const sw = (act) => byAct(box, act, "Monday");
    ok(!!box && t(box.querySelector("h3.amb-settings__head")) === "Monday" && !!acts && before(box, acts) && before(acts, pv) && before(pv, foot) && foot.parentElement === week
      && sw("hours.day-closed").classList.contains("amb-switch") && sw("hours.day-allday").classList.contains("amb-switch") && foot.querySelectorAll(".amb-pill.amb-pill--block").length === 1 && !!byAct(foot, "hours.save", "Monday")
      && [...acts.querySelectorAll("li > button")].every((b) => b.classList.contains("amb-action")),
      "a tapped day is its name, a list (Open and Open all day switches, Opens and Closes), the rows of what can be done, what customers would see, then Done the foot");
    /* P2.3 */
    const to = byAct(p.d, "hours.day-to", "Monday"); to.value = "18:00"; to.dispatchEvent(new p.w.Event("change", { bubbles: true })); await p.work.quiet();
    const dis = byAct(p.d, "hours.discard");
    ok(p.d.querySelectorAll('[data-act="hours.discard"]').length === 1 && !!dis.closest(".maker-dayedit-acts") && dis.classList.contains("amb-action--danger"), "with the day open and changed, its one Discard changes is the day's own, in the danger colour");
    await p.tap("hours.day", "Monday");
    const under = byAct(p.d, "hours.discard");
    ok(!p.d.querySelector(".maker-dayedit") && !!under && !under.closest(".maker-dayedit-acts") && !!under.closest(".maker-keep"), "with the day closed and the week changed, Discard changes is an action under the week");
    await p.tap("hours.discard");
    ok(!byAct(p.d, "hours.discard"), "and goes once the week is as saved");
    await p.tap("hours.date", "2099-01-01");
    const dbox = p.d.querySelector(".maker-dayedit");
    ok(!!dbox && dbox.previousElementSibling === p.d.querySelector("#makerSchedule > figure.amb-chart") && !!p.d.querySelector("#makerHoursPreview")
      && byAct(p.d, "hours.date-remove", "2099-01-01").classList.contains("amb-action--danger"), "a tapped date opens the same editor under the week, Remove this date in the danger colour");
    /* P2.4: a span past midnight leads the next day's bar as a strip, y 0.3 and 0.4 tall */
    const css = [...p.d.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    ok(!/\.maker-track|\.maker-tail|\.maker-day\b/.test(css) && /\.amb-week__bar/.test(css),
      "the page draws no bar of its own: the week's bars and their strips are Ambient's");
    /* P3.1 */
    const pts = p.d.getElementById("makerPoints"), plist = pts.querySelector(".apoints.amb-settings");
    const rowsP = plist ? [...plist.querySelectorAll(".amb-settings__list > li > .amb-setting")] : [];
    const x = byAct(pts, "points.remove", "A2");
    ok(!!plist && !pts.querySelector("table") && JSON.stringify(rowsP.map((r) => t(r.querySelector("[data-point]")) + " " + t(r.querySelector(".apoints-place")))) === JSON.stringify(["A2 3.11111, 101.22222", "B7 3.07381, 101.51846"])
      && t(p.d.getElementById("makerPointsStatus")) === "Ready to collect asks which one." && p.d.getElementById("makerPointsTitle").classList.contains("amb-section"),
      "the points are a list under a heading, a code and its place a row, a grey line under it: " + rowsP.map(t).join(" | "));
    ok(!!x && x.getAttribute("aria-label") === "Remove point A2" && t(x) === "" && !!x.querySelector("svg") && x.classList.contains("amb-circle"), "each row's remove is a cross, named by its point");
    /* P3.2 */
    const sentBefore = p.posts.filter((y) => y.route === "/all/maker/points").length;
    x.click(); await p.work.quiet();
    ok([...p.d.querySelectorAll("#makerPoints [data-point]")].map(t).join() === "B7" && p.posts.filter((y) => y.route === "/all/maker/points").length === sentBefore,
      "the cross takes the point off the draft and sends nothing until Save");
    byAct(p.d, "points.remove", "B7").click(); await p.work.quiet();
    ok(!p.d.querySelector("#makerPoints [data-point]") && t(p.d.querySelector("#makerPoints .apoints .amb-setting")) === "None" && t(p.d.getElementById("makerPointsStatus")) === "Ready to collect needs one.",
      "with no points left the list says None");
    /* P3.3 */
    const addRow = byAct(pts, "points.add"), save = byAct(pts, "points.save"), code = byAct(pts, "points.code"), where = byAct(pts, "points.place");
    ok(code.closest("label.amb-field") && where.closest("label.amb-field") && code.classList.contains("amb-input") && where.placeholder === "Search, or paste a link" && t(code.closest("label").previousElementSibling) === "New point"
      && addRow.classList.contains("amb-pill") && t(addRow) === "Add point" && save.classList.contains("amb-pill") && !!save.closest(".apoints-save") && pts.querySelectorAll(".amb-pill:not(.amb-pill--quiet)").length === 1,
      "New point is Code and Place fields and Add point, and Save the points the one filled pill");
    /* P3.4: Help, read only, a list under a heading */
    const help = p.d.getElementById("mHelp");
    ok(!!help && p.d.getElementById("mHelpH").classList.contains("amb-section") && help.querySelectorAll(".ahelp-list > .amb-settings__list > li > details").length === 4 && !!help.querySelector(".ahelp-list > .amb-settings__foot"),
      "Help is a list of its four answers under a heading, one grey line under it");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* P4: the notice, two lines up */
  const n = await open({ bulletin: (j) => ({ ...j, lines: ["Closed Fri 31 Oct for the stock count.", "Rice lands Saturday. Order ahead."] }) });
  try {
    await n.tap("nav.shop"); await n.tap("part.shop.notice");
    const root = n.d.getElementById("makerBulletin"), heads = [...root.querySelectorAll("h3")].map(t);
    const lines = [...n.d.querySelectorAll("#makerBulletinCurrent > li")].map(t), clear = byAct(root, "notice.clear");
    /* P4.1, his word of 26 Oct 2026: the same design language as This device */
    ok(JSON.stringify(heads) === JSON.stringify(["Up now", "New notice"]) && !root.querySelector(".amb-chip, .lead") && !n.d.getElementById("makerBulletinCount"),
      "Notice is two groups, Up now and New notice, with no chip, count or lead: " + heads.join());
    ok(JSON.stringify(lines) === JSON.stringify(["Closed Fri 31 Oct for the stock count.", "Rice lands Saturday. Order ahead."]) && n.d.getElementById("makerBulletinNone").hidden
      && t(n.d.getElementById("makerBulletinFoot")) === "Shown one at a time on every account.",
      "Up now is a row a line, in the words customers read, and one grey line under it");
    /* P4.2 */
    const set = byAct(root, "notice.set"), again = byAct(root, "notice.read"), box = byAct(root, "notice.text");
    ok(set.classList.contains("amb-pill") && set.closest(".amb-foot") && root.querySelectorAll(".amb-pill").length === 1 && !clear.hidden && clear.classList.contains("amb-action--danger") && t(clear) === "Clear the notice"
      && again.hidden && !!box.closest("label.amb-field") && box.classList.contains("amb-input") && box.placeholder === "One line each" && /Every customer is notified/.test(t(root)),
      "New notice is a field, Set the notice the one pill in its foot, Clear the notice a danger action, Read it again hidden");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { n.w.close(); }

  /* P4.3: no notice up */
  const z = await open({ bulletin: (j) => ({ ...j, lines: [] }) });
  try {
    await z.tap("nav.shop"); await z.tap("part.shop.notice");
    ok(!z.d.getElementById("makerBulletinNone").hidden && t(z.d.getElementById("makerBulletinNone")) === "None" && byAct(z.d, "notice.clear").hidden
      && z.d.querySelectorAll("#makerBulletinCurrent > *").length === 0 && t(z.d.getElementById("makerBulletinFoot")) === "",
      "with no notice up, the list says None, Clear the notice goes, and no grey line stands");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { z.w.close(); }

  /* P5: the practice accounts, one open (the harness's own), then all three */
  const tests = (u) => ({ username: u, code: "", account: true, test: true, state: "open", seen: { opens: 0 } });
  const one = await open();
  try {
    await one.tap("nav.shop"); await one.tap("part.shop.practice");
    const box = one.d.getElementById("mTest"), make = byAct(box, "more.test-accounts");
    /* P5.1, his word of 26 Oct 2026: Practice in This device's language */
    ok(make.classList.contains("amb-switch") && make.getAttribute("role") === "switch" && make.checked === false && t(box.querySelector("h3.amb-settings__head")) === "Accounts" && box.querySelector("h3.amb-settings__head").parentElement.classList.contains("atest-list")
      && t(box.querySelector(".amb-settings__foot")) === "1 of 3 made; turn on to make 0000-0001 and 0000-0002." && !box.querySelector("table, .amb-chip, .amb-pill"),   /* 1 Nov 2026: one sentence, the grey line's rule (craft.md section 3); it read "made. Turn on" */
      "Practice is one switch, off while one of three exists, its grey line naming the missing, and no table, chip or pill");
    /* P5.2 */
    const rowsT = [...box.querySelectorAll(".atest-list .amb-settings__list > li > *")].map(t);
    ok(JSON.stringify(rowsT) === JSON.stringify(["0000-0000Every case", "Password0000-0000-0000-0000"]) && byAct(box, "more.test-password").getAttribute("aria-label") === "Copy the password" && !byAct(box, "more.test-page"),
      "a row for the one made, the password row copying it, and no test page yet: " + JSON.stringify(rowsT));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { one.w.close(); }
  const all = await open({ sheetAnswer: (j) => ({ ...j, accounts: j.accounts.concat(["0000-0001", "0000-0002"].map(tests)) }) });
  try {
    await all.tap("nav.shop"); await all.tap("part.shop.practice");
    const box = all.d.getElementById("mTest"), go = byAct(box, "more.test-page"), rm = byAct(box, "more.test-accounts");
    ok(!!go && go.tagName === "A" && go.getAttribute("href") === "/all/test" && go.classList.contains("amb-setting") && t(go) === "Open the test page"
      && rm.checked === true && box.querySelectorAll(".atest-u").length === 3 && t(box.querySelector(".amb-settings__foot")) === "Nothing they do is recorded.",
      "with all three made: the switch on, a row each, and Open the test page a row to /all/test");
    /* P5.3 */
    const sent = () => all.posts.filter((x) => x.route === "/all/test").length, sheet = () => all.d.getElementById("ynSheet");
    rm.click(); await all.work.quiet();
    ok(!!sheet() && !sheet().hidden && t(sheet().querySelector(".salt-sheet__title, .amb-sheet__title")) === "Remove all three?" && /Everything they wrote goes with them/.test(t(sheet())) && sent() === 0 && byAct(all.d.getElementById("mTest"), "more.test-accounts").checked === true,
      "turning it off asks once on the Sheet and sends nothing yet, the switch staying on until the answer");
    byAct(sheet(), "ask.keep", "test:remove").click(); await all.work.quiet();
    ok(sent() === 0, "Keep them sends nothing");
    byAct(all.d.getElementById("mTest"), "more.test-accounts").click(); await all.work.quiet();
    byAct(sheet(), "ask.go", "test:remove").click(); await all.work.quiet();
    ok(sent() === 1 && JSON.stringify(all.posts.filter((x) => x.route === "/all/test")[0].body) === JSON.stringify({ make: false }), "Remove sends the one removal");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { all.w.close(); }

  /* P6: this device, a list of settings (his word of 26 Oct 2026: "like settings on an iPhone") */
  const dv = await open();
  try {
    await dv.tap("nav.shop"); await dv.tap("part.shop.device");
    const sec = dv.d.getElementById("oLook"), list = sec.querySelector(".amb-settings__list"), rows = list ? [...list.children] : [];
    /* P6.1 */
    /* 15 Nov 2026, the move to Ambient: the Tide theme row went (light and dark follow the device) */
    ok(rows.length === 2 && JSON.stringify(rows.map((r) => t(r.querySelector(".amb-setting__name")))) === JSON.stringify(["Show names", "Notifications"]) && !sec.querySelector(".lead") && rows.every((r) => r.querySelectorAll("button:not([hidden]), input").length === 1 && !!r.querySelector(".amb-switch")),
      "This device is one list of settings, Show names and Notifications, each row a name and one switch, with no lead: " + rows.map((r) => t(r.querySelector(".amb-setting__name"))).join());
    const bell = rows[1].querySelector(".amb-switch");
    ok(!sec.querySelector("[data-look]") && !!bell && bell.getAttribute("role") === "switch" && bell.checked === false && !bell.disabled,
      "Notifications is a switch, off, and no look is asked");
    /* his second look of 26 Oct 2026: Show names is a switch too, and the password is asked in the one Sheet */
    const names = rows[0].querySelector(".amb-switch");
    ok(!!names && names.id === "vaultSwitch" && names.getAttribute("role") === "switch" && names.checked === false && !names.disabled && rows[0].querySelectorAll("input").length === 1,
      "Show names is a switch, off, with no field in its row");
    ok(dv.d.getElementById("alertNote").textContent === "", "and no line of words stands under the list until there is something to say");
    /* P6.2 */
    const reads = dv.wire.filter((w) => String(w).startsWith("/all/maker/vault")).length;
    names.click(); await dv.work.quiet();
    ok(!dv.d.getElementById("vaultSheet").hidden && names.checked === false && dv.wire.filter((w) => String(w).startsWith("/all/maker/vault")).length === reads,
      "turning Show names on asks for the password in the Sheet; it stays off and reads nothing until the password is given");
    /* P6.3 */
    bell.click(); await dv.work.quiet();
    ok(/cannot take notifications/.test(t(dv.d.getElementById("alertNote"))) && bell.checked === false && !bell.disabled,
      "the Notifications switch turns them on by the same road as before; refused, it stays off, free, and the line says why");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { dv.w.close(); }

  /* P7: from 960px, the open day beside the week (Ambient's panes; his 860 became 960 on 16 Nov 2026) */
  const wideMq = (win) => { win.matchMedia = (mq) => ({ matches: /min-width:\s*960px/.test(mq) && !/max-width/.test(mq), media: mq, addEventListener() {}, removeEventListener() {}, addListener() {} }); };
  const wd = await open({ before: wideMq });
  try {
    await wd.tap("nav.shop"); await wd.tap("part.shop.hours");
    const pane = wd.d.getElementById("makerDayPane");
    /* P7.1 */
    ok(!!pane && !!pane.closest(".amb-split--panes") && pane.classList.contains("amb-stack") && t(pane.querySelector("h3")) === "No day open" && !pane.querySelector(".maker-dayedit") && t(pane.querySelector(".amb-setting")) === "Tap a day or a date.",
      "wide, the pane beside the week says no day is open until one is tapped");
    await wd.tap("hours.day", "Monday");
    const box = pane.querySelector(".maker-dayedit");
    ok(!!box && !wd.d.querySelector("#makerSchedule .maker-dayedit") && !!pane.querySelector("#makerHoursPreview") && !!byAct(pane.querySelector(":scope > .amb-foot"), "hours.save", "Monday") && byAct(wd.d, "hours.day", "Monday").getAttribute("aria-current") === "true",
      "a tapped day opens in the pane, its preview and Done foot with it, and none under its row, the day marked current in the week");
    await wd.tap("hours.day", "Monday");
    ok(!pane.querySelector(".maker-dayedit") && t(pane.querySelector("h3")) === "No day open", "a second tap closes it again");
    /* P7.2 */
    const css = [...wd.d.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    ok(!/\.adm \.hsplit|\.adm \.hpane|#oShop\{max-width/.test(css) && css.includes("#makerNowCard, #makerNow, #makerSchedule, #makerPoints, #makerMarket, #makerCalendar, #makerBulletin"),
      "the page lays out no pane of its own: Ambient's panes place the week and the open day, and Shop's wrappers stand aside so the foot is its stack's last child");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { wd.w.close(); }
  /* P7.4: Shop's parts are a Segment, and every part's sections head as one */
  const tb = await open();
  try {
    await tb.tap("nav.shop"); await tb.tap("part.shop.hours");
    const strip = tb.d.querySelector('.aparts[data-place="shop"]'), tabs = strip ? [...strip.querySelectorAll("button")] : [];
    ok(!!strip && strip.classList.contains("amb-segment") && strip.classList.contains("amb-segment--wrap") && strip.parentElement.classList.contains("amb-stack") && tabs.length === 6 && tabs.every((b) => b.classList.contains("amb-segment__opt") && !/salt-/.test(b.className))
      && JSON.stringify(tabs.map((b) => t(b) + ":" + b.getAttribute("aria-pressed"))) === JSON.stringify(["Hours:true", "Market:false", "Calendar:false", "Notice:false", "Practice:false", "This device:false"]),
      "Shop's six parts (Market since 11 Nov 2026, Calendar since 13 Nov 2026) are Ambient's wrapping Segment, Hours pressed: " + tabs.map((b) => t(b) + ":" + b.getAttribute("aria-pressed")).join());
    await tb.tap("part.shop.notice"); await tb.tap("nav.needs"); await tb.tap("nav.shop");
    ok(JSON.stringify([...strip.querySelectorAll("button")].map((b) => b.getAttribute("aria-pressed"))) === JSON.stringify(["true", "false", "false", "false", "false", "false"]), "coming back to Shop opens Hours and presses it, the page pressing what Ambient's script does not");
    ok(["makerPointsTitle", "mHelpH"].every((id) => tb.d.getElementById(id).classList.contains("amb-section")), "Collection points and Help head their sections as every section does");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { tb.w.close(); }
  /* P6.4: the customer's own Look row was drawn as his; 15 Nov 2026, the move to Ambient: neither page draws one */
  const cust = landingPage("0000-0000", "n", null, null);
  ok(!cust.includes('id="lookRow"') && !/data-look=/.test(cust) && !/data-act="look\./.test(cust), "the customer's page draws no Look row either, nor any act of his page");
}
