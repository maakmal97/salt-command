/* test/admin-hours-week.mjs: SALT ADMIN'S WEEK CHART OF THE HOURS (his word of 20 Oct 2026, canvas V63, and his eight answers that day to
 * Fable's design). Shop > Hours is a row a day, Monday first, a 00 to 24 track with a brass bar a span, a span past midnight said "+1" with
 * its tail hatched at the start of the next day's row; a tap opens the day's spans in quarter hours and its buttons; below, what customers
 * would see and the dated days. Each check red under its own mutation (test/admin-hours-week.mutations.json, run with tools/section.mjs):
 *   1  seven rows, Monday first, each a button keyed by its day and named with its hours, "next day" past midnight and the day before's tail
 *   2  a bar a span at its open to its close or to 24; the tail from 00 to the day before's close; a closed day has no bar
 *   3  a tap opens that day below its row: Opens and Closes in quarter hours, Closes offering 24:00, a time filed off the quarter hour kept
 *      as its own choice, "Closes next day" and "+1" past midnight
 *   4  Closed (Open on a closed day), Same as the day before, and Copy to: a chip a day, its group chosen at first, any day added, Apply
 *   5  Add hours puts a second span after the last, drawn as a second bar and said "2 spans"; Remove takes it out; Open all day is 00:00 to 24:00
 *   6  a stretch past midnight that reaches the next day's opening is said to run on as one
 *   7  what customers would see, read for the day being changed, its hours and delivery windows, sent as a read
 *   8  Discard changes puts the saved week back; Done sends the whole week once, as drawn, and closes the day; Undo sends back the week it replaced
 *   9  a date added stands closed with its own row and Remove this date; Done sends it beside the week
 *  10  a refusal is said in Admin's words under the chart; every row, picker, chip and button is 44px tall
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage, byAct } from "./maker-act.mjs";
import { validateWeeklyHours, plainWeek } from "../stmt/hours.js";
import { hoursPreview } from "../stmt/maker.js";

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const d = (open, close) => ({ open, close });
/* Sunday first, as filed: Sunday closed, Monday to Wednesday 09:00 to 21:00, Thursday to 21:10 (off the quarter hour), Friday 09:00 to 02:00, Saturday 10:00 to 02:00 */
const WEEK = [null, d("09:00", "21:00"), d("09:00", "21:00"), d("09:00", "21:00"), d("09:00", "21:10"), d("09:00", "02:00"), d("10:00", "02:00")];
const PV = "/all/maker/hours?preview=";

export async function run({ ok, pageWork }) {
  const open = async () => {
    const p = await richOwnerPage({ pageWork, hours: (j) => { j.config.schedule.days = WEEK.map((x) => x && { ...x }); return j; },
      /* the preview, answered by the Worker's own rule on the week the page sent */
      extra: (route) => { if (!route.startsWith(PV)) return undefined; const now = Date.now(), w = validateWeeklyHours(JSON.parse(decodeURIComponent(route.slice(PV.length))), now);
        return w.error ? { refuse: w.error } : { ok: true, preview: hoursPreview(plainWeek(w, now), null, now) }; } });
    await p.work.quiet();
    p.tap = async (act, key) => { const c = byAct(p.d, act, key); if (c) c.click(); await p.work.quiet(); return !!c; };
    p.pick = async (act, key, value) => { const c = byAct(p.d, act, key); c.value = value; c.dispatchEvent(new p.w.Event("change", { bubbles: true })); await p.work.quiet(); };
    p.rows = () => [...p.d.querySelectorAll("#makerSchedule .maker-week:not(.maker-dates) button.maker-day")];
    p.row = (key) => p.rows().find((r) => r.getAttribute("data-key") === key);
    p.label = (key) => p.row(key).getAttribute("aria-label");
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
    ok(p.label("Friday") === "Fri: 09:00 to 02:00 next day. Change" && p.label("Monday") === "Mon: 09:00 to 21:00. Change"
      && p.label("Saturday") === "Sat: 10:00 to 02:00 next day, and Fri until 02:00. Change" && p.label("Sunday") === "Sun: Closed (open from Sat until 02:00). Change",
    "each row is named with its hours, next day past midnight, and the day before's tail where it reaches: " + rows.map((r) => r.getAttribute("aria-label")).join(" | "));
    ok(p.row("Friday").querySelector(".maker-day-times").textContent === "09:00 to 02:00+1" && p.row("Monday").querySelector(".maker-day-times").textContent === "09:00 to 21:00"
      && p.row("Sunday").querySelector(".maker-day-times").textContent === "Closed", "a span past midnight reads +1 and a closed day Closed");
    /* 2 */
    const geo = (key, cls) => [...p.row(key).querySelectorAll(".maker-track ." + cls)].map((n) => parseFloat(n.style.left).toFixed(2) + " " + parseFloat(n.style.width).toFixed(2)).join(" | ") || null;
    ok(geo("Monday", "maker-bar") === "37.50 50.00" && geo("Friday", "maker-bar") === "37.50 62.50" && geo("Saturday", "maker-bar") === "41.67 58.33" && geo("Sunday", "maker-bar") === null,
      "a bar at the open runs to the close, or to 24 past midnight; a closed day has none: " + ["Monday", "Friday", "Saturday", "Sunday"].map((k) => geo(k, "maker-bar")).join(" / "));
    ok(geo("Saturday", "maker-tail") === "0.00 8.33" && geo("Sunday", "maker-tail") === "0.00 8.33" && geo("Monday", "maker-tail") === null && geo("Friday", "maker-tail") === null,
      "the day before's tail runs from 00 to its close, and only where there is one");
    /* 3 */
    await p.tap("hours.day", "Friday");
    const box = p.row("Friday").nextElementSibling, from = byAct(p.d, "hours.day-from", "Friday"), to = byAct(p.d, "hours.day-to", "Friday");
    ok(p.row("Friday").getAttribute("aria-expanded") === "true" && !!box && box.classList.contains("maker-dayedit") && box.contains(from) && p.d.querySelectorAll(".maker-dayedit").length === 1,
      "a tap opens that day below its row, and only that day");
    ok(from.options.length === 96 && to.options.length === 97 && to.options[96].value === "24:00" && from.value === "09:00" && to.value === "02:00",
      "Opens and Closes are quarter-hour pickers, Closes offering 24:00: " + [from.options.length, to.options.length, from.value, to.value]);
    ok(/Closes next day/.test(box.textContent) && !!box.querySelector(".maker-plus1") && to.getAttribute("aria-label") === "Friday closes, next day",
      "past midnight, the day says Closes next day, +1 stands by Closes and Closes is named next day");
    await p.tap("hours.day", "Thursday");
    const thu = byAct(p.d, "hours.day-to", "Thursday");
    ok(thu.value === "21:10" && thu.options.length === 98, "a time filed off the quarter hour stays a choice of its own: " + [thu.value, thu.options.length]);
    /* 4 */
    await p.tap("hours.day", "Friday");
    await p.pick("hours.day-to", "Friday", "20:00");
    ok(p.label("Friday") === "Fri: 09:00 to 20:00. Change" && geo("Saturday", "maker-tail") === null && p.d.activeElement === byAct(p.d, "hours.day-to", "Friday"),
      "a picked time redraws the week, the tail gone, and the picker keeps the focus: " + p.label("Friday"));
    await p.tap("hours.day-same", "Friday");
    ok(p.label("Friday") === "Fri: 09:00 to 21:10. Change" && byAct(p.d, "hours.day-same", "Friday").textContent === "Same as Thu", "Same as Thu takes Thursday's times");
    await p.tap("hours.day-closed", "Friday");
    ok(p.label("Friday") === "Fri: Closed. Change" && byAct(p.d, "hours.day-closed", "Friday").textContent === "Open" && byAct(p.d, "hours.day-from", "Friday").disabled,
      "Closed closes the day and offers Open");
    await p.tap("hours.day-closed", "Friday");
    await p.pick("hours.day-to", "Friday", "03:00");
    await p.tap("hours.day-copy", "Friday");
    const chips = () => [...p.d.querySelectorAll(".maker-copy [data-act='hours.copy-day']")];
    ok(same(chips().map((c) => c.getAttribute("data-key") + ":" + c.getAttribute("aria-pressed")), ["Monday:true", "Tuesday:true", "Wednesday:true", "Thursday:true", "Saturday:false", "Sunday:false"]),
      "Copy to offers a chip for every other day, its group chosen at first: " + chips().map((c) => c.getAttribute("data-key") + ":" + c.getAttribute("aria-pressed")).join());
    await p.tap("hours.copy-day", "Saturday"); await p.tap("hours.copy-day", "Tuesday"); await p.tap("hours.copy-apply", "Friday");
    ok(["Monday", "Wednesday", "Thursday", "Saturday"].every((k) => p.label(k).includes("09:00 to 03:00 next day")) && p.label("Tuesday").startsWith("Tue: 09:00 to 21:00")
      && p.label("Sunday").startsWith("Sun: Closed") && p.sent().length === 0,
    "Apply copies to the days chosen, any of them, and sends nothing: " + p.rows().map((r) => r.getAttribute("aria-label")).join(" | "));
    /* 5 */
    await p.tap("hours.day", "Tuesday"); await p.tap("hours.day-add", "Tuesday");
    ok(p.label("Tuesday").startsWith("Tue: 09:00 to 21:00, 22:00 to 24:00") && geo("Tuesday", "maker-bar") === "37.50 50.00 | 91.67 8.33" && p.row("Tuesday").querySelector(".maker-day-times").textContent === "2 spans"
      && byAct(p.d, "hours.day-from", "Tuesday 2").value === "22:00", "Add hours puts a second span after the last, a second bar, said 2 spans: " + p.label("Tuesday"));
    await p.tap("hours.day-remove", "Tuesday 2");
    ok(p.label("Tuesday").startsWith("Tue: 09:00 to 21:00") && !p.label("Tuesday").includes("22:00") && !byAct(p.d, "hours.day-from", "Tuesday 2"), "Remove takes the span out: " + p.label("Tuesday"));
    await p.tap("hours.day-allday", "Tuesday");
    ok(p.label("Tuesday").startsWith("Tue: Open all day") && geo("Tuesday", "maker-bar") === "0.00 100.00" && byAct(p.d, "hours.day-to", "Tuesday").value === "24:00", "Open all day is 00:00 to 24:00, the whole track");
    /* 6: Friday 20:00 to 11:00 reaches Saturday's opening at 10:00 */
    await p.tap("hours.day", "Friday"); await p.pick("hours.day-from", "Friday", "20:00"); await p.pick("hours.day-to", "Friday", "11:00");
    ok(/runs on into the next day.s hours: one stretch/.test(p.row("Friday").nextElementSibling.textContent), "a stretch past midnight that reaches the next day's opening is said to run on as one: " + p.label("Friday") + " / " + p.label("Saturday") + " / " + p.row("Friday").nextElementSibling.textContent.slice(0, 200));
    /* 7 */
    const pv = p.d.getElementById("makerHoursPreview");
    ok(/^Customers would see: (Open|Closed).*Fri [0-9]+ [A-Z][a-z]{2}: 00:00 to 03:00, 20:00 to 24:00\. Delivery windows 00-04 as 00:00-03:00, 20-24\.$/.test(pv.textContent)
      && p.posts.every((x) => !String(x.route).includes("preview")), "what customers would see is read for the day being changed, its hours and windows, and sent as a read: " + pv.textContent);
    /* 8 */
    ok(!!byAct(p.d, "hours.discard"), "Discard changes stands while the week differs from the saved one");
    await p.tap("hours.discard");
    ok(p.label("Friday") === "Fri: 09:00 to 02:00 next day. Change" && p.label("Tuesday") === "Tue: 09:00 to 21:00. Change" && !byAct(p.d, "hours.discard") && !p.d.querySelector(".maker-dayedit"),
      "Discard changes puts the saved week back and closes the day");
    await p.tap("hours.day", "Monday"); await p.tap("hours.day-closed", "Monday");
    await p.tap("hours.save", "Monday");
    ok(p.sent().length === 1 && same(p.sent()[0], { schedule: { days: [null, null, d("09:00", "21:00"), d("09:00", "21:00"), d("09:00", "21:10"), d("09:00", "02:00"), d("10:00", "02:00")] } }),
      "Done sends the whole week once, as drawn: " + JSON.stringify(p.sent()));
    ok(p.d.getElementById("makerHoursSaved").textContent === "Weekly hours saved." && !p.d.querySelector(".maker-dayedit"), "and says so under the chart, the day closed");
    await p.tap("hours.undo");
    ok(p.sent().length === 2 && same(p.sent()[1], { schedule: { days: WEEK } }) && p.d.getElementById("makerHoursSaved").textContent === "Back to the hours before." && !byAct(p.d, "hours.undo"),
      "Undo sends back the week Done replaced, once: " + JSON.stringify(p.sent()[1]));
    /* 9 */
    await p.tap("hours.date-add");
    const pickDate = byAct(p.d, "hours.date-pick"), today = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
    const plus = (n) => new Date(Date.parse(today + "T00:00:00Z") + n * 86400e3).toISOString().slice(0, 10);
    ok(pickDate && pickDate.type === "date" && pickDate.min === today && pickDate.max === plus(90), "Add a date offers a date from today to 90 days ahead: " + (pickDate && [pickDate.min, pickDate.max]));
    pickDate.value = plus(5); await p.tap("hours.date-new");
    const dateRow = p.d.querySelector(".maker-dates button.maker-day");
    ok(!!dateRow && dateRow.getAttribute("data-key") === plus(5) && / Closed/.test(dateRow.getAttribute("aria-label")) && !!byAct(p.d, "hours.date-remove", plus(5)) && !byAct(p.d, "hours.day-copy", plus(5)),
      "a date added stands closed in its own row, open with Remove this date and no Copy to: " + (dateRow && dateRow.getAttribute("aria-label")));
    await p.tap("hours.save", plus(5));
    ok(p.sent().length === 3 && same(p.sent()[2].schedule.dates, { [plus(5)]: null }), "Done sends the date beside the week: " + JSON.stringify(p.sent()[2]));
    /* 10 */
    p.refuse["/all/maker/hours"] = "A day's hours cannot run for more than 24 hours.";
    await p.tap("hours.day", "Monday"); await p.tap("hours.save", "Monday");
    ok(/A day holds 24 hours at most/.test(p.d.getElementById("makerHoursSaved").textContent), "a refusal is said in Admin's words under the chart: " + p.d.getElementById("makerHoursSaved").textContent);
    const css = [...p.d.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    ok(/\.adm \.maker-day\{[^}]*min-height:44px/.test(css) && /\.adm \.maker-dayedit select\{[^}]*min-height:44px/.test(css) && /\.adm \.maker-dayedit-acts button\{[^}]*min-height:44px/.test(css)
      && /\.adm \.maker-copy button\{[^}]*min-height:44px/.test(css) && /\.adm \.maker-dayedit-times>button\{[^}]*min-height:44px/.test(css),
    "every row, picker, chip and button is 44px tall");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }
}
