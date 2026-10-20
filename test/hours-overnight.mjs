/* test/hours-overnight.mjs: OPENING HOURS PAST MIDNIGHT (his word of 20 Oct 2026, canvas V63). A close earlier than the open is the
 * next day's, read by one rule (stmt/hours.js openParts) everywhere the hours are read. What is proved here, each check red under its
 * own mutation (test/hours-overnight.mutations.json):
 *   1  Friday 09:00 to 02:00 is open at Saturday 01:59 and closed at 02:00, and at Friday 23:00 the next change is Saturday 02:00;
 *      Saturday's tail opens a closed Sunday until 02:00
 *   2  with only Sunday 22:00 to 02:00 open, the next open from Monday 03:00 is the coming Sunday 22:00
 *   3  openMinutes counts a night across midnight: Friday 20:00 to Saturday 10:00 is 360 minutes
 *   4  spans that touch or overlap are one stretch: no change at the join, and no minute counted twice
 *   5  the check of the week: a close before the open is taken, the same time refused, a day opening before the day before closes
 *      refused (Saturday into Sunday too), touching taken, an unreadable time refused in its own words
 *   6  the delivery windows follow: Saturday 00-04 reads 00:00-02:00 off Friday's tail, a closed Sunday's 00-04 off Saturday's, and a
 *      window holding two stretches is said from the first's start to the last's end (his answer) */
import { hoursStatus, openMinutes, openParts, validateWeeklyHours } from "../stmt/hours.js";
import { slotSpan, slotNext } from "../stmt/window.js";

const kl = (s) => Date.parse(s + "+08:00");
const iso = (s) => new Date(kl(s)).toISOString();
const d = (open, close) => ({ open, close });
/* the canvas's week: Sunday closed, Monday to Thursday 09:00 to 21:00, Friday 09:00 to 02:00, Saturday 10:00 to 02:00 */
const wk = () => [null, d("09:00", "21:00"), d("09:00", "21:00"), d("09:00", "21:00"), d("09:00", "21:00"), d("09:00", "02:00"), d("10:00", "02:00")];
const cfgOf = (days) => ({ schedule: { days }, manual: null });

export async function run({ ok }) {
  const canvas = cfgOf(wk());
  /* 1: 16 Oct 2026 is a Friday */
  const a1 = hoursStatus(canvas, kl("2026-10-17T01:59:00")), b1 = hoursStatus(canvas, kl("2026-10-17T02:00:00")), c1 = hoursStatus(canvas, kl("2026-10-16T23:00:00"));
  ok(a1.open === true && b1.open === false && c1.open === true && c1.nextChange === iso("2026-10-17T02:00:00"),
    "Friday to 02:00 is open at Saturday 01:59, closed at 02:00, and at Friday 23:00 closes at Saturday 02:00: " + JSON.stringify([a1.open, b1.open, c1.nextChange]));
  const s1 = hoursStatus(canvas, kl("2026-10-18T01:00:00"));
  ok(s1.open === true && s1.nextChange === iso("2026-10-18T02:00:00"), "Saturday's tail opens a closed Sunday until 02:00: " + JSON.stringify(s1));
  /* 2 */
  const sunNight = cfgOf([d("22:00", "02:00"), null, null, null, null, null, null]);
  const s2 = hoursStatus(sunNight, kl("2026-10-19T03:00:00"));
  ok(s2.open === false && s2.nextOpen === iso("2026-10-25T22:00:00"), "only Sunday night open: from Monday 03:00 it next opens Sunday 22:00: " + JSON.stringify(s2));
  /* 3 */
  ok(openMinutes(canvas, kl("2026-10-16T20:00:00"), kl("2026-10-17T10:00:00")) === 360,
    "a night across midnight counts: Friday 20:00 to Saturday 10:00 is 360 open minutes: " + openMinutes(canvas, kl("2026-10-16T20:00:00"), kl("2026-10-17T10:00:00")));
  /* 4 */
  const touch = wk(); touch[6] = d("02:00", "12:00");
  /* read inside a try, so a week the check refuses reads as a wrong answer here, never a crash */
  let t4, m4;
  try { t4 = hoursStatus(cfgOf(touch), kl("2026-10-17T01:00:00")); m4 = openMinutes(cfgOf(touch), kl("2026-10-17T01:00:00"), kl("2026-10-17T03:00:00")); }
  catch (e) { t4 = { error: e.message }; }
  ok(t4.open === true && t4.nextChange === iso("2026-10-17T12:00:00") && m4 === 120,
    "Friday to 02:00 and Saturday from 02:00 are one stretch: no change at 02:00: " + JSON.stringify(t4));
  const lap = wk(); lap[5] = d("09:00", "04:00"); lap[6] = d("02:00", "12:00");
  const parts = openParts(lap, kl("2026-10-17T00:00:00"), kl("2026-10-17T06:00:00"));
  ok(parts.length === 1 && parts[0][0] === kl("2026-10-17T00:00:00") && parts[0][1] === kl("2026-10-17T06:00:00"),
    "overlapping spans are one stretch, so no minute is counted twice: " + JSON.stringify(parts));
  /* 5 */
  const v = (days) => validateWeeklyHours({ days });
  const same = wk(); same[2] = d("09:00", "09:00");
  const early = wk(); early[6] = d("01:00", "12:00");
  const round = wk(); round[0] = d("01:00", "05:00");
  const joined = wk(); joined[6] = d("02:00", "12:00");
  const bad = wk(); bad[3] = d("24:00", "21:00");
  ok(!v(wk()).error && v(wk()).days[5].end === 120, "a close earlier than the open is taken: " + JSON.stringify(v(wk()).days[5]));
  ok(v(same).error === "A day cannot open and close at the same time.", "the same time to open and close is refused, never read as all day: " + JSON.stringify(v(same)));
  /* 20 Oct 2026 (his answer to Fable's design): merged, no longer refused */
  let e5, r5;
  try { e5 = hoursStatus(cfgOf(early), kl("2026-10-17T01:00:00")); r5 = hoursStatus(cfgOf(round), kl("2026-10-18T01:30:00")); } catch (e) { e5 = r5 = { error: e.message }; }
  ok(!v(early).error && !v(round).error && e5.nextChange === iso("2026-10-17T12:00:00") && r5.nextChange === iso("2026-10-18T05:00:00"),
    "a day opening before the day before closes is taken and merged into one stretch, Saturday into Sunday too: " + JSON.stringify([e5, r5]));
  ok(!v(joined).error && v(bad).error === "Use valid 24-hour times.", "touching is taken; an unreadable time is refused in its own words: " + JSON.stringify([v(joined), v(bad)]));
  /* 6 */
  const fri = kl("2026-10-16T13:00:00");
  ok(JSON.stringify(slotSpan("2026-10-17T00", canvas, fri)) === JSON.stringify({ from: 0, to: 120 }) && JSON.stringify(slotNext(0, canvas, fri)) === JSON.stringify({ slot: "2026-10-17T00", span: "00:00-02:00" }),
    "Friday's tail opens Saturday's 00-04 window as 00:00-02:00: " + JSON.stringify(slotNext(0, canvas, fri)));
  ok(JSON.stringify(slotSpan("2026-10-18T00", canvas, fri)) === JSON.stringify({ from: 0, to: 120 }) && slotSpan("2026-10-18T04", canvas, fri) === null,
    "a closed Sunday's 00-04 window opens off Saturday's tail, and its 04-08 stays shut");
  const gap = wk(); gap[6] = d("03:00", "12:00");
  ok(JSON.stringify(slotSpan("2026-10-17T00", cfgOf(gap), fri)) === JSON.stringify({ from: 0, to: 240 }),
    "a window holding two stretches is said from the first's start to the last's end: " + JSON.stringify(slotSpan("2026-10-17T00", cfgOf(gap), fri)));
}
