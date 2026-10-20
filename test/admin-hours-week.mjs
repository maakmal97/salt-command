/* test/admin-hours-week.mjs: SALT ADMIN'S WEEK CHART OF THE HOURS (his word of 20 Oct 2026, canvas V63; his answers 3 and 4). Shop > Hours is a
 * row a day, Monday first, a 00 to 24 track with the open span as a brass bar, a span past midnight said "+1" with its tail hatched at the start
 * of the next day's row; a tap opens the day's Opens and Closes in quarter hours and its quick buttons. Each check red under its own mutation
 * (test/admin-hours-week.mutations.json, run with tools/section.mjs):
 *   1  seven rows, Monday first, each a button keyed by its day and named with its hours, "next day" for a span past midnight and the day
 *      before's tail on a day it reaches
 *   2  the bar stands at its open and runs to its close or to 24; the tail runs from 00 to the day before's close; a closed day has no bar
 *   3  a tap opens that day below its row: Opens and Closes as quarter-hour pickers, a time filed off the quarter hour kept as its own choice,
 *      "Closes next day" and "+1" for a span past midnight, Closes named "next day"
 *   4  the quick buttons: Closed (Open on a closed day), Same as the day before, Copy to the rest of its group (Monday to Friday, or Saturday
 *      and Sunday), each changing the week drawn and nothing sent
 *   5  Done sends the whole week once, as drawn, and closes the day; a refusal is said in Admin's words under the chart
 *   6  every row, picker and button is 44px tall
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage, byAct } from "./maker-act.mjs";

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const d = (open, close) => ({ open, close });
/* Sunday first, as filed: Sunday closed, Monday to Wednesday 09:00 to 21:00, Thursday to 21:10 (off the quarter hour), Friday 09:00 to 02:00, Saturday 10:00 to 02:00 */
const WEEK = [null, d("09:00", "21:00"), d("09:00", "21:00"), d("09:00", "21:00"), d("09:00", "21:10"), d("09:00", "02:00"), d("10:00", "02:00")];

export async function run({ ok, pageWork }) {
  const open = async () => {
    const p = await richOwnerPage({ pageWork, hours: (j) => { j.config.schedule.days = WEEK.map((x) => x && { ...x }); return j; } });
    await p.work.quiet();
    p.tap = async (act, key) => { const c = byAct(p.d, act, key); if (c) c.click(); await p.work.quiet(); return !!c; };
    p.pick = async (act, key, value) => { const c = byAct(p.d, act, key); c.value = value; c.dispatchEvent(new p.w.Event("change", { bubbles: true })); await p.work.quiet(); };
    p.rows = () => [...p.d.querySelectorAll("#makerSchedule .maker-week button.maker-day")];
    p.row = (key) => p.rows().find((r) => r.getAttribute("data-key") === key);
    p.sent = () => p.posts.filter((x) => x.route === "/all/maker/hours").map((x) => x.body);
    return p;
  };
  const p = await open();
  try {
    await p.tap("nav.shop"); await p.tap("part.shop.hours");
    /* 1 */
    const rows = p.rows();
    ok(same(rows.map((r) => r.getAttribute("data-key")), ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]) && rows.every((r) => r.getAttribute("data-act") === "hours.day"),
      "seven rows, Monday first, each keyed by its day: " + rows.map((r) => r.getAttribute("data-key")).join());
    ok(p.row("Friday").getAttribute("aria-label") === "Fri: 09:00 to 02:00 next day. Change" && p.row("Monday").getAttribute("aria-label") === "Mon: 09:00 to 21:00. Change"
      && p.row("Saturday").getAttribute("aria-label") === "Sat: 10:00 to 02:00 next day, and Fri until 02:00. Change"
      && p.row("Sunday").getAttribute("aria-label") === "Sun: Closed (open from Sat until 02:00). Change",
    "each row is named with its hours, next day past midnight, and the day before's tail where it reaches: " + rows.map((r) => r.getAttribute("aria-label")).join(" | "));
    ok(p.row("Friday").querySelector(".maker-day-times").textContent === "09:00 to 02:00+1" && p.row("Friday").querySelector(".maker-day-times sup").textContent === "+1"
      && p.row("Monday").querySelector(".maker-day-times").textContent === "09:00 to 21:00" && p.row("Sunday").querySelector(".maker-day-times").textContent === "Closed",
    "a span past midnight reads +1 and a closed day Closed: " + rows.map((r) => r.querySelector(".maker-day-times").textContent).join());
    /* 2 */
    const geo = (key, cls) => { const n = p.row(key).querySelector(".maker-track ." + cls); return n ? parseFloat(n.style.left).toFixed(2) + " " + parseFloat(n.style.width).toFixed(2) : null; };
    ok(geo("Monday", "maker-bar") === "37.50 50.00" && geo("Friday", "maker-bar") === "37.50 62.50" && geo("Saturday", "maker-bar") === "41.67 58.33" && geo("Sunday", "maker-bar") === null,
      "the bar stands at the open and runs to the close, or to 24 past midnight; a closed day has none: " + ["Monday", "Friday", "Saturday", "Sunday"].map((k) => geo(k, "maker-bar")).join(" | "));
    ok(geo("Saturday", "maker-tail") === "0.00 8.33" && geo("Sunday", "maker-tail") === "0.00 8.33" && geo("Monday", "maker-tail") === null && geo("Friday", "maker-tail") === null,
      "the day before's tail runs from 00 to its close, and only where there is one: " + ["Saturday", "Sunday", "Monday", "Friday"].map((k) => geo(k, "maker-tail")).join(" | "));
    /* 3 */
    await p.tap("hours.day", "Friday");
    const box = p.row("Friday").nextElementSibling, from = byAct(p.d, "hours.day-from", "Friday"), to = byAct(p.d, "hours.day-to", "Friday");
    ok(p.row("Friday").getAttribute("aria-expanded") === "true" && !!box && box.classList.contains("maker-dayedit") && box.contains(from) && box.contains(to) && p.d.querySelectorAll(".maker-dayedit").length === 1,
      "a tap opens that day below its row, and only that day");
    ok(from.tagName === "SELECT" && from.options.length === 96 && from.options[1].value === "00:15" && from.value === "09:00" && to.value === "02:00",
      "Opens and Closes are quarter-hour pickers holding the day's times: " + [from.options.length, from.value, to.value]);
    ok(/Closes next day/.test(box.textContent) && !!box.querySelector(".maker-plus1") && to.getAttribute("aria-label") === "Friday closes, next day" && from.getAttribute("aria-label") === "Friday opens",
      "past midnight, the day says Closes next day, +1 stands by Closes and Closes is named next day: " + to.getAttribute("aria-label"));
    await p.tap("hours.day", "Thursday");
    const thu = byAct(p.d, "hours.day-to", "Thursday");
    ok(thu.value === "21:10" && thu.options.length === 97 && !p.d.querySelector(".maker-plus1"), "a time filed off the quarter hour stays a choice of its own, so nothing moves it unseen: " + [thu.value, thu.options.length]);
    /* 4 */
    await p.tap("hours.day", "Friday");
    await p.pick("hours.day-to", "Friday", "20:00");
    ok(p.row("Friday").getAttribute("aria-label") === "Fri: 09:00 to 20:00. Change" && geo("Saturday", "maker-tail") === null && document_focus(p) === byAct(p.d, "hours.day-to", "Friday"),
      "a picked time redraws the week, the tail gone with the span past midnight, and the picker keeps the focus: " + p.row("Friday").getAttribute("aria-label"));
    await p.tap("hours.day-same", "Friday");
    ok(p.row("Friday").getAttribute("aria-label") === "Fri: 09:00 to 21:10. Change" && byAct(p.d, "hours.day-same", "Friday").textContent === "Same as Thu",
      "Same as Thu takes Thursday's times: " + p.row("Friday").getAttribute("aria-label"));
    await p.tap("hours.day-closed", "Friday");
    ok(p.row("Friday").getAttribute("aria-label") === "Fri: Closed. Change" && byAct(p.d, "hours.day-closed", "Friday").textContent === "Open" && byAct(p.d, "hours.day-from", "Friday").disabled,
      "Closed closes the day, its pickers shut, and the button offers Open: " + p.row("Friday").getAttribute("aria-label"));
    await p.tap("hours.day-closed", "Friday");
    await p.pick("hours.day-to", "Friday", "03:00");
    ok(byAct(p.d, "hours.day-copy", "Friday").textContent === "Copy to Mon to Thu", "a weekday copies to the other weekdays: " + byAct(p.d, "hours.day-copy", "Friday").textContent);
    await p.tap("hours.day-copy", "Friday");
    ok(["Monday", "Tuesday", "Wednesday", "Thursday"].every((k) => p.row(k).getAttribute("aria-label").includes("09:00 to 03:00 next day")) && p.row("Saturday").getAttribute("aria-label").startsWith("Sat: 10:00 to 02:00")
      && p.sent().length === 0, "Copy to sets Monday to Thursday to Friday's hours, leaves Saturday, and sends nothing: " + p.rows().map((r) => r.getAttribute("aria-label")).join(" | "));
    await p.tap("hours.day", "Wednesday");
    const wed = byAct(p.d, "hours.day-copy", "Wednesday").textContent;
    await p.tap("hours.day", "Saturday");
    ok(wed === "Copy to Mon, Tue, Thu and Fri" && byAct(p.d, "hours.day-copy", "Saturday").textContent === "Copy to Sun" && byAct(p.d, "hours.day-same", "Saturday").textContent === "Same as Fri",
      "Wednesday names the weekdays around it, Saturday copies to Sunday: " + [wed, byAct(p.d, "hours.day-copy", "Saturday").textContent]);
    /* 5 */
    await p.tap("hours.save", "Saturday");
    const late = d("09:00", "03:00");
    ok(p.sent().length === 1 && same(p.sent()[0], { schedule: { days: [null, late, late, late, late, late, d("10:00", "02:00")] } }),
      "Done sends the whole week once, as drawn: " + JSON.stringify(p.sent()));
    ok(p.d.getElementById("makerHoursSaved").textContent === "Weekly hours saved." && !p.d.querySelector(".maker-dayedit"), "and says so under the chart, the day closed");
    p.refuse["/all/maker/hours"] = "A day cannot open before the day before it closes.";
    await p.tap("hours.day", "Monday"); await p.tap("hours.save", "Monday");
    ok(/A day opens before the day before it has closed/.test(p.d.getElementById("makerHoursSaved").textContent),
      "a refusal is said in Admin's words under the chart: " + p.d.getElementById("makerHoursSaved").textContent);
    /* 6 */
    const css = [...p.d.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    ok(/\.adm \.maker-day\{[^}]*min-height:44px/.test(css) && /\.adm \.maker-dayedit select\{[^}]*min-height:44px/.test(css) && /\.adm \.maker-dayedit-acts button\{[^}]*min-height:44px/.test(css),
      "every row, picker and quick button is 44px tall");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }
}
function document_focus(p) { return p.d.activeElement; }
