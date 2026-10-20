/* test/hours-spans.mjs: THE MOST CONTROL OVER THE HOURS (his eight answers of 20 Oct 2026 to Fable's design). A day may hold up to six
 * spans, open all day is 00:00 to 24:00, spans that touch or overlap are merged (no longer refused), and dated days stand in for their
 * weekday up to 90 days ahead; one rule (stmt/hours.js openParts) reads them all, and Salt Admin can ask what customers would see before
 * saving. What is proved here, each check red under its own mutation (test/hours-spans.mutations.json):
 *   1  a day with a break: closed in the break, the open minutes leave it out, and the window over it is said first start to last end
 *   2  open all day: 00:00 to 24:00 is taken and read open at every minute with no change ahead; 24:00 as an open is refused
 *   3  a day's spans are put in order and merged on the check, one span kept as the single object a day always was; seven spans, or a
 *      stretch longer than a day, refused
 *   4  a dated day stands in for its weekday whole: a holiday closed, a special day's hours, and a dated span past midnight runs on
 *   5  a write takes dates from today to 90 days ahead and 40 at most; a reader still reads a date that has passed; a week filed before
 *      today reads as it did
 *   6  the Worker: a preview says what customers would see and stores nothing; a save stores the week put in order; a read leaves out a
 *      date that has passed */
import { hoursStatus, openMinutes, openParts, validateWeeklyHours, plainWeek } from "../stmt/hours.js";
import { slotSpan } from "../stmt/window.js";
import { handleMaker } from "../stmt/maker.js";

const kl = (s) => Date.parse(s + "+08:00");
const iso = (s) => new Date(kl(s)).toISOString();
const d = (open, close) => ({ open, close });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const safe = (f) => { try { return f(); } catch (e) { return { error: e.message }; } };
const week = (day) => [0, 1, 2, 3, 4, 5, 6].map(() => day);

export async function run({ ok }) {
  /* 1: 19 Oct 2026 is a Monday; Monday to Saturday 09:00 to 13:00 and 14:00 to 18:00 */
  const split = { schedule: { days: [null, ...[1, 2, 3, 4, 5, 6].map(() => [d("09:00", "13:00"), d("14:00", "18:00")])] } };
  const s1 = safe(() => [hoursStatus(split, kl("2026-10-19T12:59:00")).open, hoursStatus(split, kl("2026-10-19T13:30:00")).open, hoursStatus(split, kl("2026-10-19T13:30:00")).nextOpen]);
  ok(same(s1, [true, false, iso("2026-10-19T14:00:00")]), "a day with a break is closed in the break and opens again after it: " + JSON.stringify(s1));
  ok(safe(() => openMinutes(split, kl("2026-10-19T12:00:00"), kl("2026-10-19T16:00:00"))) === 180,
    "the open minutes leave the break out: " + JSON.stringify(safe(() => openMinutes(split, kl("2026-10-19T12:00:00"), kl("2026-10-19T16:00:00")))));
  ok(same(slotSpan("2026-10-19T12", split, kl("2026-10-19T08:00:00")), { from: 720, to: 960 }), "the window over the break is said from its first start to its last end");
  /* 2 */
  const all = { schedule: { days: week(d("00:00", "24:00")) } };
  const s2 = safe(() => hoursStatus(all, kl("2026-10-19T23:59:00")));
  ok(!validateWeeklyHours(all.schedule).error && s2.open === true && s2.nextChange === null && safe(() => openMinutes(all, kl("2026-10-19T00:00:00"), kl("2026-10-21T00:00:00"))) === 2880,
    "open all day is 00:00 to 24:00, open at every minute with no change ahead: " + JSON.stringify(s2));
  ok(validateWeeklyHours({ days: week(d("24:00", "09:00")) }).error === "Use valid 24-hour times." && openParts(week(d("24:00", "02:00")), kl("2026-10-19T00:00:00"), kl("2026-10-21T00:00:00")).length === 0,
    "24:00 is a close, never an open, in the check and in the rule itself");
  /* 3 */
  const tidy = validateWeeklyHours({ days: [null, [d("13:00", "17:00"), d("09:00", "13:00")], [d("20:00", "02:00"), d("06:00", "08:00")], null, null, null, null] });
  ok(!tidy.error && same(plainWeek(tidy).days.slice(1, 3), [d("09:00", "17:00"), [d("06:00", "08:00"), d("20:00", "02:00")]]),
    "a day's spans are put in order and merged where they touch, one span kept as the single object: " + JSON.stringify(tidy.days && plainWeek(tidy).days.slice(1, 3)));
  ok(validateWeeklyHours({ days: [null, [1, 2, 3, 4, 5, 6, 7].map((h) => d("0" + h + ":00", "0" + h + ":30")), null, null, null, null, null] }).error === "Each day must be closed or have opening and closing times."
    && validateWeeklyHours({ days: [null, [d("00:00", "24:00"), d("20:00", "04:00")], null, null, null, null, null] }).error === "A day's hours cannot run for more than 24 hours.",
  "seven spans in a day, or a stretch longer than a day, are refused");
  /* 4: Monday 26 Oct 2026 closed, Sunday 25 Oct 10:00 to 12:00, Saturday 24 Oct 20:00 to 03:00 */
  const dated = { schedule: { days: split.schedule.days, dates: { "2026-10-26": null, "2026-10-25": d("10:00", "12:00"), "2026-10-24": d("20:00", "03:00") } } };
  ok(safe(() => openMinutes(dated, kl("2026-10-26T00:00:00"), kl("2026-10-27T00:00:00"))) === 0 && safe(() => openMinutes(dated, kl("2026-10-27T00:00:00"), kl("2026-10-28T00:00:00"))) === 480,
    "a dated holiday is closed all day, and the next weekday keeps its hours");
  const h4 = safe(() => hoursStatus(dated, kl("2026-10-26T10:00:00")));
  ok(h4.open === false && h4.nextOpen === iso("2026-10-27T09:00:00"), "and the Counter reads closed on it, opening the next day: " + JSON.stringify(h4));
  ok(safe(() => openMinutes(dated, kl("2026-10-25T00:00:00"), kl("2026-10-26T00:00:00"))) === 300 && safe(() => openMinutes(dated, kl("2026-10-24T00:00:00"), kl("2026-10-25T00:00:00"))) === 240,
    "a special day's hours stand in for its weekday whole, and a dated span past midnight runs on into the next day: " + JSON.stringify([safe(() => openMinutes(dated, kl("2026-10-25T00:00:00"), kl("2026-10-26T00:00:00"))), safe(() => openMinutes(dated, kl("2026-10-24T00:00:00"), kl("2026-10-25T00:00:00")))]));
  /* 5 */
  const now = kl("2026-10-20T10:00:00"), on = (dates) => validateWeeklyHours({ days: week(null), dates }, now).error;
  const many = Object.fromEntries(Array.from({ length: 41 }, (_, i) => [new Date(now + 8 * 3600e3 + i * 86400e3).toISOString().slice(0, 10), null]));
  ok(on({ "2026-10-20": null }) === undefined && on({ "2026-10-19": null }) === "Set dates from today to 90 days ahead." && on({ "2027-01-19": null }) === "Set dates from today to 90 days ahead."
    && on(many) === "Keep to 40 dates at a time." && on({ "2026-02-30": null }) === "Use a real date for each dated day.",
  "a write takes dates from today to 90 days ahead, 40 at most, real ones only");
  ok(!validateWeeklyHours({ days: week(null), dates: { "2026-10-19": null } }).error && same(plainWeek(validateWeeklyHours({ days: week(d("09:00", "17:00")) })), { days: week(d("09:00", "17:00")) }),
    "a reader still reads a date that has passed, and a week filed before today reads as it was filed");
  /* 6 */
  const kv = new Map(), puts = [];
  const env = { STMT: { get: async (k, t) => (kv.has(k) ? (t === "json" ? JSON.parse(kv.get(k)) : kv.get(k)) : null), put: async (k, v) => { puts.push(k); kv.set(k, v); } } };
  const call = async (body) => (await handleMaker(new Request("https://counter.test/all/maker/hours", { method: body ? "POST" : "GET", ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}) }), env, "/all/maker/hours", { email: "maakmal97@icloud.com" })).json();
  const pv = await call({ preview: { days: week([d("09:00", "13:00"), d("14:00", "18:00")]) } });
  ok(pv.ok && puts.length === 0 && pv.preview.week.length === 7 && pv.preview.week[0].said === "09:00 to 13:00, 14:00 to 18:00" && pv.preview.week[0].windows.some((x) => x.w === 12 && x.span === "12:00-16:00") && typeof pv.preview.status.open === "boolean",
    "a preview says what customers would see, each day's hours and windows, and stores nothing: " + JSON.stringify(pv.preview && pv.preview.week[0]));
  const today = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
  const saved = await call({ schedule: { days: week([d("13:00", "17:00"), d("09:00", "13:00")]), dates: { [today]: null } } });
  ok(saved.ok && same(JSON.parse(kv.get("maker:hours")).schedule, { days: week(d("09:00", "17:00")), dates: { [today]: null } }), "a save stores the week put in order, with its dates: " + kv.get("maker:hours"));
  kv.set("maker:hours", JSON.stringify({ schedule: { days: week(null), dates: { "2026-01-01": null, [today]: d("10:00", "12:00") } } }));
  const read = await call();
  ok(read.ok && same(read.config.schedule.dates, { [today]: d("10:00", "12:00") }), "a read leaves out a date that has passed: " + JSON.stringify(read.config && read.config.schedule));
}
