/* test/admin-sizes-hours.mjs: PRINTED SIZES ARE A GRID OF TILES, THE WEEKLY HOURS A TABLE WITH LABELLED COLUMNS (Phase 4a of the Salt Admin redesign, 12 Oct 2026; docs/STATEMENTS.md "Record's forms" and "Shop").
 *
 * Printed sizes (Record > Pricing) was a list of checkboxes in a column; it is the system's Option tiles in a grid, a size a tile, ticked while it is printed. Hours (Shop) was a
 * row of three bare controls a day; it is a table whose columns are Day, Opens and Closes, and the override that closes the shop for now is a pair of tiles and a field
 * that says Closed until (Open until when the shop is held open). What either form sends is what it always sent. Each check red under its own mutation
 * (test/admin-sizes-hours.mutations.json, run with tools/section.mjs):
 *   1  the sizes: one tile for each size of the book, a checkbox in the recipe's label with its face and its size in words, ticked unless hidden, each keeping its act keyed by the size
 *   2  the sizes sent: the product and the sizes left unticked, as numbers, for each book, and the grid drawn again for the other book
 *   3  the hours: a table, its head naming the three columns, a row for each weekday in order, a control in each cell named for its day and its column, a closed day's times shut
 *   4  the hours sent: the weekly hours and the override (closed, open, and back to the weekly hours) in the bodies they always had, and the field that names what the override does
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage, byAct } from "./maker-act.mjs";
import { unitsOf } from "../stmt/page.js";

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/* what Record's forms are told: salt prints six sizes and hides two, oil two */
function told(j) {
  j.catalog.houseBoards = { salt: { sizes: [0.5, 1, 2.5, 5, 10, 12.5], hidden: [2.5, 12.5] }, oil: { sizes: [1, 5], hidden: [] } };
  return j;
}

export async function run({ ok, pageWork }) {
  const open = async (opts = {}) => {
    const p = await richOwnerPage({ pageWork, inputsAnswer: told, ...opts });
    await p.work.quiet();
    p.tap = async (act, key) => { const c = byAct(p.d, act, key); if (c) c.click(); await p.work.quiet(); return !!c; };
    p.form = (name) => [...p.d.querySelectorAll("#makerInputs section.maker-input")].find((s) => s.querySelector("h3").textContent === name) || null;
    p.type = (control, value) => { control.value = value; control.dispatchEvent(new p.w.Event("input", { bubbles: true })); control.dispatchEvent(new p.w.Event("change", { bubbles: true })); };
    p.tick = (control, on) => { control.checked = on; control.dispatchEvent(new p.w.Event("input", { bubbles: true })); control.dispatchEvent(new p.w.Event("change", { bubbles: true })); };
    p.sent = (route) => p.posts.filter((x) => x.route === route).map((x) => x.body);
    return p;
  };

  /* 1 AND 2. THE PRINTED SIZES */
  let p = await open();
  try {
    await p.tap("nav.record");
    const form = p.form("Printed sizes");
    const group = form && form.querySelector("fieldset.maker-sizes");
    const grid = group && group.querySelector(":scope > .salt-options__grid");
    const ticks = () => (grid ? [...grid.querySelectorAll("input")] : []);
    const want = [0.5, 1, 2.5, 5, 10, 12.5];
    const tiles = grid ? [...grid.children] : [];
    ok(!!group && !!grid && group.classList.contains("salt-options") && group.querySelector(":scope > legend.salt-options__legend") && /^Sizes to print$/.test(group.querySelector("legend").textContent)
      && tiles.length === want.length && tiles.every((t, i) => t.tagName === "LABEL" && t.classList.contains("salt-option") && t.firstElementChild === ticks()[i]
        && ticks()[i].classList.contains("salt-option__input") && ticks()[i].nextElementSibling.classList.contains("salt-option__face")
        && ticks()[i].nextElementSibling.textContent === unitsOf(want[i])),
    "the sizes are a group of the system's Option tiles named by a legend, a tile for each size in order, its face saying the size in words: " + (grid ? [...grid.children].map((t) => t.textContent).join() : "no grid"));
    ok(ticks().length === want.length && ticks().every((t, i) => t.type === "checkbox" && t.value === String(want[i]) && t.getAttribute("data-act") === "record.house.size" && t.getAttribute("data-key") === String(want[i]))
      && same(ticks().map((t) => t.checked), [true, true, false, true, true, false]),
    "each tile is a checkbox with the act it had, keyed by its size, ticked while the size is printed and not when it is hidden: " + ticks().map((t) => t.getAttribute("data-key") + ":" + t.checked).join());
    ok(form && form.querySelectorAll("label.maker-field input[type=checkbox]").length === 0, "and no list of checkboxes in rows is left in the form");
    const css = [...p.d.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    ok(/\.adm \.maker-sizes\s*\{[^}]*flex:\s*1 1 100%[^}]*min-width:\s*0/.test(css) && /\.adm \.maker-sizes \.salt-options__grid\s*\{[^}]*repeat\(auto-fill,\s*minmax\(/.test(css),
      "the group has the row of its form to itself and its tiles run in as many columns as the pane holds");
    const send = async () => {
      const before = p.sent("/all/maker/inputs/house-sizes").length;
      byAct(form, "record.house.send").click(); await p.work.quiet();
      const all = p.sent("/all/maker/inputs/house-sizes");
      return all.length === before + 1 ? all.at(-1) : null;
    };
    p.tick(ticks()[1], false); p.tick(ticks()[2], true); p.tick(ticks()[3], false);
    const body = await send();
    ok(body && body.product === "salt" && same(body.hide, [1, 5, 12.5]) && Object.keys(body).sort().join() === "at,hide,product",
      "the sizes sent are the product and the sizes left unticked, as numbers, with the id and nothing else: " + JSON.stringify(body));
    const books = form.querySelector("fieldset.maker-tiles");
    const oil = [...books.querySelectorAll("input")].find((r) => r.value === "oil");
    oil.checked = true; oil.dispatchEvent(new p.w.Event("change", { bubbles: true }));
    ok(same(ticks().map((t) => t.value), ["1", "5"]) && ticks().every((t) => t.checked) && ticks().every((t) => t.getAttribute("data-act") === "record.house.size"),
      "the other book draws its own sizes, all ticked: " + ticks().map((t) => t.value + ":" + t.checked).join());
    p.tick(ticks()[0], false);
    const oilBody = await send();
    ok(oilBody && oilBody.product === "oil" && same(oilBody.hide, [1]), "and sends them: " + JSON.stringify(oilBody));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* 3 AND 4. THE HOURS. 25 Oct 2026 (Salt Admin Shop): the Weekly hours ghost stands only while an override is filed, so the hours read back the one sent */
  let filed = null;
  p = await open({ hours: (j) => { if (filed) { j.config.manual = filed; j.status = { open: filed.open, source: "manual" }; } return j; } });
  try {
    await p.tap("nav.shop"); await p.tap("part.shop.hours");
    const root = p.d.getElementById("makerSchedule");
    /* 20 Oct 2026 (canvas V63): the week is a chart now, its rows, pickers and quick buttons proved in test/admin-hours-week.mjs; the body it sends is the one it always sent */
    const hoursBody = (n) => p.sent("/all/maker/hours")[n];
    await p.tap("hours.day", "Tuesday"); await p.tap("hours.day-closed", "Tuesday");
    for (const [act, v] of [["hours.day-from", "08:30"], ["hours.day-to", "12:00"]]) p.type(byAct(root, act, "Tuesday"), v);
    await p.work.quiet();
    await p.tap("hours.day", "Monday"); await p.tap("hours.day-closed", "Monday");
    await p.tap("hours.save", "Monday");
    ok(same(hoursBody(0), { schedule: { days: [null, null, { open: "08:30", close: "12:00" }, null, null, null, null] } }),
      "the weekly hours sent are the day's times, or none for a closed day, in the week's order: " + JSON.stringify(hoursBody(0)));
    /* the override */
    /* a save draws the hours again, so the controls are found afresh each time */
    const ui = () => {
      /* 25 Oct 2026 (Salt Admin Shop): the override is For now's form, first on Hours, opened by Hold the shop */
      const now = p.d.getElementById("makerNowCard");
      const state = [...now.querySelectorAll("fieldset.maker-tiles")].find((f) => f.querySelector("legend").textContent === "Hold the shop");
      const until = now.querySelector('input[type="datetime-local"]');
      return { radios: state ? [...state.querySelectorAll("input")] : [], until, label: until ? until.closest("label").querySelector(".lbl").textContent : "no field" };
    };
    const choose = (value) => { const r = ui().radios.find((x) => x.value === value); r.checked = true; r.dispatchEvent(new p.w.Event("change", { bubbles: true })); };
    const radios = ui().radios;
    ok(radios.length === 2 && same(radios.map((r) => r.value), ["false", "true"]) && same(radios.map((r) => r.nextElementSibling.textContent), ["Closed", "Open"])
      && radios.every((r) => r.getAttribute("data-act") === "hours.override-state") && radios[0].checked && !radios[1].checked && ui().label === "Closed until",
    "the shop held for now is two tiles, Closed first and chosen, over a field that says Closed until: " + radios.map((r) => r.value + ":" + r.checked).join() + " " + ui().label);
    choose("true");
    const openLabel = ui().label;
    choose("false");
    ok(openLabel === "Open until" && ui().label === "Closed until", "the field names what the tile chosen does: " + openLabel + " then " + ui().label);
    const before = p.sent("/all/maker/hours").length;
    byAct(p.d, "hours.override-set").click(); await p.work.quiet();
    ok(p.sent("/all/maker/hours").length === before && /Choose an end time/.test(p.d.getElementById("makerHoursMessage").textContent), "with no end time chosen it says so and sends nothing");
    const stamp = new Date(Date.now() + 3 * 86400000 + 8 * 3600000).toISOString().slice(0, 16);
    p.type(ui().until, stamp);
    ok(!byAct(p.d, "hours.override-clear"), "with no override filed there is no way back to the weekly hours to offer");
    filed = { open: false, until: new Date(Date.parse(stamp + ":00+08:00")).toISOString() };
    byAct(p.d, "hours.override-set").click(); await p.work.quiet();
    ok(!!byAct(p.d, "hours.override-clear") && byAct(p.d, "hours.override-clear").getAttribute("aria-label") === "Back to the weekly hours" && byAct(p.d, "hours.hold").textContent === "Change",
      "once one is filed, Weekly hours stands beside Change, named Back to the weekly hours");
    byAct(p.d, "hours.hold").click(); await p.work.quiet();
    choose("true"); p.type(ui().until, stamp);
    byAct(p.d, "hours.override-set").click(); await p.work.quiet();
    byAct(p.d, "hours.override-clear").click(); await p.work.quiet();
    const iso = new Date(Date.parse(stamp + ":00+08:00")).toISOString();
    const sent = p.sent("/all/maker/hours");
    ok(same(sent.slice(1), [{ manual: { open: false, until: iso } }, { manual: { open: true, until: iso } }, { clearManual: true }]),
      "Closed sends manual open false and the end time, Open sends open true, and Back to the weekly hours sends clearManual, as the select form sent: " + JSON.stringify(sent.slice(1)));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }
}
