const DAY_MS = 86400000;
const CLOCK_RE = /^([01][0-9]|2[0-3]):([0-5][0-9])$/;
const DATE_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
/* 20 Oct 2026 (his eight answers to Fable's design): up to six spans a day, open all day as 00:00 to 24:00, dated exceptions up to
   90 days ahead and 40 of them */
export const SPANS_MAX = 6, DATES_AHEAD = 90, DATES_MAX = 40;

const toMinutes = (value) => {
  const match = CLOCK_RE.exec(String(value || ""));
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};
/* a close may also be 24:00, the end of the day (open all day is 00:00 to 24:00) */
const closeMinutes = (value) => (String(value) === "24:00" ? 1440 : toMinutes(value));
const hm = (m) => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");


/** 20 Oct 2026 (his word, canvas V63): THE ONE RULE OF THE WEEKLY HOURS. A span runs from its open to its close, and a close earlier
 *  than the open is the next day's (Fri 09:00 to 02:00 is open until Sat 02:00); a close of 24:00 is the day's end. The open
 *  stretches between lo and hi, in ms, as [from, to] pairs in order, touching or overlapping spans merged into one, so nothing counts
 *  a minute twice. `days` is seven days, Sunday first, Kuala Lumpur time, each null (closed), one {open, close} of "HH:MM" strings
 *  or a list of them (a break, a split shift; his answers of 20 Oct 2026); `dates`, when given, maps a Kuala Lumpur "YYYY-MM-DD"
 *  to a day of the same form, which stands in for that weekday whole (a holiday closed, a special day's hours). openAt, the next
 *  open and the next change, openMinutes and the delivery windows (stmt/window.js slotSpan) all read it. ES5 and calls nothing
 *  outside itself: the Counter's page carries its source beside slotSpan, so no backslash, backtick, arrow function, let or const. */
export function openParts(days, lo, hi, dates) {
  var H = 3600000, D = 24 * H, parts = [], out = [];
  if (!days || days.length !== 7 || !(hi > lo)) return out;
  function partMin(t) { var x = /^([01][0-9]|2[0-4]):([0-5][0-9])$/.exec(String(t || "")); var m = x ? (+x[1]) * 60 + (+x[2]) : null; return m === null || m > 1440 ? null : m; }
  var l = new Date(lo + 8 * H), s = Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate()) - 8 * H - D;
  for (var n = 0; s < hi && n < 401; s += D, n++) {
    var k = new Date(s + 8 * H), ymd = k.toISOString().slice(0, 10);
    var d = dates && Object.prototype.hasOwnProperty.call(dates, ymd) ? dates[ymd] : days[k.getUTCDay()];
    var list = !d ? [] : Object.prototype.toString.call(d) === "[object Array]" ? d : [d];
    for (var j = 0; j < list.length; j++) {
      var o = list[j] ? partMin(list[j].open) : null, c = list[j] ? partMin(list[j].close) : null;
      if (o === null || c === null || c === o || o >= 1440) continue;
      var a = s + o * 60000, b = s + (c < o ? c + 1440 : c) * 60000;
      if (a < lo) a = lo;
      if (b > hi) b = hi;
      if (b > a) parts.push([a, b]);
    }
  }
  parts.sort(function (p, q) { return p[0] - q[0]; });
  for (var i = 0; i < parts.length; i++) {
    var last = out.length ? out[out.length - 1] : null;
    if (last && parts[i][0] <= last[1]) { if (parts[i][1] > last[1]) last[1] = parts[i][1]; }
    else out.push([parts[i][0], parts[i][1]]);
  }
  return out;
}

function openAt(schedule, at) {
  if (!schedule) return true;
  return openParts(schedule.days, at, at + 1, schedule.dates).length > 0;
}

function nextScheduleOpen(schedule, at) {
  if (!schedule) return null;
  const part = openParts(schedule.days, at, at + 15 * DAY_MS, schedule.dates).find((p) => p[0] > at);
  return part ? new Date(part[0]).toISOString() : null;
}

function nextScheduleChange(schedule, at) {
  if (!schedule) return null;
  const times = [];
  for (const [open, close] of openParts(schedule.days, at, at + 8 * DAY_MS, schedule.dates)) {
    if (open > at) times.push(open);
    if (close > at) times.push(close);
  }
  times.sort((a, b) => a - b);
  const change = times.find((time) => openAt(schedule, time) !== openAt(schedule, time - 1));
  return change == null ? null : new Date(change).toISOString();
}

/** One day checked and put in order: null, one {open, close} or a list of up to six, each span's times read (a close may be 24:00),
 *  the same time to open and close refused (never read as all day), then sorted and merged where they touch or overlap (his answer:
 *  merged, not refused), one span kept as the object a day was before 20 Oct 2026, so a page cached before then reads it as it did. */
function checkDay(day) {
  if (day === null) return { day: null };
  const list = Array.isArray(day) ? day : [day];
  if (!list.length || list.length > SPANS_MAX || list.some((x) => !x || typeof x !== "object" || Array.isArray(x) || Object.keys(x).some((key) => !["open", "close"].includes(key))))
    return { error: "Each day must be closed or have opening and closing times." };
  const spans = [];
  for (const x of list) {
    const start = toMinutes(x.open), end = closeMinutes(x.close);
    if (start === null || end === null) return { error: "Use valid 24-hour times." };
    if (start === end || (start === 0 && end === 1440 && x.close !== "24:00")) return { error: "A day cannot open and close at the same time." };
    spans.push([start, end <= start ? end + 1440 : end]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [a, b] of spans) {
    const last = merged[merged.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b); else merged.push([a, b]);
  }
  /* one span holds a day at most: 00:00 to 24:00 is all day, and a stretch the merge carried further is refused, never cut short */
  if (merged.some(([a, b]) => b - a > 1440 || (b - a === 1440 && a !== 0))) return { error: "A day's hours cannot run for more than 24 hours." };
  const out = merged.map(([a, b]) => {
    const close = b === 1440 ? "24:00" : hm(b % 1440);
    return { open: hm(a), close, start: a, end: closeMinutes(close) };
  });
  return { day: out.length === 1 ? out[0] : out };
}

/** The weekly hours checked: seven days, Sunday first, and the dated days beside them. Given `now` (a write), a date must be a real
 *  Kuala Lumpur day from today to 90 days ahead, 40 at most; a reader passes no `now`, so a date that has since passed still reads. */
export function validateWeeklyHours(value, now) {
  if (!value || typeof value !== "object" || Object.keys(value).some((key) => key !== "days" && key !== "dates")
    || !Array.isArray(value.days) || value.days.length !== 7)
    return { error: "Set hours or mark closed for each day of the week." };
  const days = [];
  for (const day of value.days) {
    const c = checkDay(day);
    if (c.error) return c;
    days.push(c.day);
  }
  if (value.dates === undefined) return { days };
  if (!value.dates || typeof value.dates !== "object" || Array.isArray(value.dates))
    return { error: "Each date must be closed or have opening and closing times." };
  const keys = Object.keys(value.dates).sort(), dates = {};
  if (keys.length > DATES_MAX) return { error: "Keep to 40 dates at a time." };
  const today = Number.isFinite(now) ? new Date(now + 8 * 3600000).toISOString().slice(0, 10) : null;
  const last = Number.isFinite(now) ? new Date(now + 8 * 3600000 + DATES_AHEAD * DAY_MS).toISOString().slice(0, 10) : null;
  for (const key of keys) {
    const t = Date.parse(key + "T00:00:00Z");
    if (!DATE_RE.test(key) || !Number.isFinite(t) || new Date(t).toISOString().slice(0, 10) !== key)
      return { error: "Use a real date for each dated day." };
    if (today && (key < today || key > last)) return { error: "Set dates from today to 90 days ahead." };
    const c = checkDay(value.dates[key]);
    if (c.error) return c;
    dates[key] = c.day;
  }
  return { days, dates };
}

/** A day as stored and as a page reads it: its spans' open and close alone. */
export function plainDay(d) {
  if (!d) return null;
  return Array.isArray(d) ? d.map((x) => ({ open: x.open, close: x.close })) : { open: d.open, close: d.close };
}
/** The weekly hours as stored: the days, and the dates still to come at `now` (a past date is pruned on every read and write). */
export function plainWeek(parsed, now) {
  const week = { days: parsed.days.map(plainDay) };
  if (parsed.dates) {
    const today = Number.isFinite(now) ? new Date(now + 8 * 3600000).toISOString().slice(0, 10) : "";
    const dates = {};
    for (const key of Object.keys(parsed.dates)) if (key >= today) dates[key] = plainDay(parsed.dates[key]);
    if (Object.keys(dates).length) week.dates = dates;
  }
  return week;
}

export function validateManualHours(value, now = Date.now()) {
  if (!value || typeof value !== "object" || Object.keys(value).some((key) => !["open", "until"].includes(key))
    || typeof value.open !== "boolean" || typeof value.until !== "string")
    return { error: "Choose whether the Counter is open or closed." };
  const until = Date.parse(value.until);
  if (!Number.isFinite(until) || until <= now || until > now + 14 * DAY_MS)
    return { error: "Set an end time within the next 14 days." };
  return { open: value.open, until: new Date(until).toISOString() };
}

export const HOURS_KEY = "maker:hours";

/** The hours as a delivery window reads them (stmt/window.js), from Salt Admin's store: {schedule, manual}, each null
 *  when unset. A store that cannot be read, or holds what no longer validates, reads as none set, every window open, so a
 *  fault in the hours never stops an order (as the page's own note says, "you can still place an order"). */
export async function hoursConfig(env) {
  let value = null;
  try { value = env && env.STMT ? await env.STMT.get(HOURS_KEY, "json") : null; } catch (e) { value = null; }
  return windowHours(value);
}
/** The two parts of the stored hours a window reads, checked: the weekly days with their dates, and a manual override still well formed. */
export function windowHours(value, now = Date.now()) {
  if (!value || typeof value !== "object") return { schedule: null, manual: null };
  const days = value.schedule != null ? validateWeeklyHours(value.schedule) : null;
  const m = value.manual;
  const manual = m && typeof m === "object" && typeof m.open === "boolean" && typeof m.until === "string" && Number.isFinite(Date.parse(m.until))
    ? { open: m.open, until: new Date(Date.parse(m.until)).toISOString() } : null;
  return { schedule: days && !days.error ? plainWeek(days, now) : null, manual };
}

/** 20 Oct 2026 (his answer): the minutes the Counter was open between two moments, on the weekly hours as they stand and with no manual
 *  override, as stmt/confirm.js measures "in Counter hours"; with no weekly hours filed it is open at every moment. Salt Admin's waited
 *  meter reads it off the review answer, so an order placed while closed counts from opening. */
export function openMinutes(config, from, to) {
  if (!(Number.isFinite(from) && Number.isFinite(to) && to > from)) return 0;
  const parsed = !config || config.schedule == null ? { days: null } : validateWeeklyHours(config.schedule);
  if (parsed.error) throw new TypeError(parsed.error);
  if (!parsed.days) return (to - from) / 60000;
  return openParts(parsed.days, from, to, parsed.dates).reduce((sum, [a, b]) => sum + b - a, 0) / 60000;
}

export function hoursStatus(config, at = Date.now()) {
  const parsed = !config || config.schedule == null ? { days: null } : validateWeeklyHours(config.schedule);
  if (parsed.error) throw new TypeError(parsed.error);
  const schedule = parsed.days ? { days: parsed.days, dates: parsed.dates } : null;
  const manual = config && config.manual;
  const manualUntil = manual && Date.parse(manual.until);
  const manualActive = !!manual && typeof manual.open === "boolean" && Number.isFinite(manualUntil) && manualUntil > at;
  const open = manualActive ? manual.open : openAt(schedule, at);
  const nextChange = manualActive ? new Date(manualUntil).toISOString() : nextScheduleChange(schedule, at);
  let nextOpen = null;
  if (!open) {
    if (manualActive && manual.open === false && openAt(schedule, manualUntil)) nextOpen = new Date(manualUntil).toISOString();
    else nextOpen = nextScheduleOpen(schedule, manualActive ? manualUntil : at);
  }
  return { open, source: manualActive ? "manual" : schedule ? "schedule" : "default", nextChange, nextOpen };
}
