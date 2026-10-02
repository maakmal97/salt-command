const DAY_MS = 86400000;
const KL_OFFSET_MS = 8 * 60 * 60 * 1000;
const CLOCK_RE = /^([01][0-9]|2[0-3]):([0-5][0-9])$/;

const toMinutes = (value) => {
  const match = CLOCK_RE.exec(String(value || ""));
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

const klStart = (at) => {
  const local = new Date(at + KL_OFFSET_MS);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - KL_OFFSET_MS;
};

const localDay = (start, offset) => new Date(start + offset * DAY_MS + KL_OFFSET_MS).getUTCDay();

function openAt(schedule, at) {
  if (!schedule) return true;
  const local = new Date(at + KL_OFFSET_MS);
  const day = schedule.days[local.getUTCDay()];
  if (!day) return false;
  const minute = local.getUTCHours() * 60 + local.getUTCMinutes();
  return minute >= day.start && minute < day.end;
}

function nextScheduleOpen(schedule, at) {
  if (!schedule) return null;
  const start = klStart(at);
  for (let offset = 0; offset < 15; offset++) {
    const hours = schedule.days[localDay(start, offset)];
    if (!hours) continue;
    const open = start + offset * DAY_MS + hours.start * 60000;
    if (open > at) return new Date(open).toISOString();
  }
  return null;
}

function nextScheduleChange(schedule, at) {
  if (!schedule) return null;
  const start = klStart(at);
  const times = [];
  for (let offset = 0; offset < 8; offset++) {
    const hours = schedule.days[localDay(start, offset)];
    if (!hours) continue;
    const open = start + offset * DAY_MS + hours.start * 60000;
    const close = start + offset * DAY_MS + hours.end * 60000;
    if (open > at) times.push(open);
    if (close > at) times.push(close);
  }
  times.sort((a, b) => a - b);
  const change = times.find((time) => openAt(schedule, time) !== openAt(schedule, time - 1));
  return change == null ? null : new Date(change).toISOString();
}

export function validateWeeklyHours(value) {
  if (!value || typeof value !== "object" || Object.keys(value).some((key) => key !== "days")
    || !Array.isArray(value.days) || value.days.length !== 7)
    return { error: "Set hours or mark closed for each day of the week." };
  const days = [];
  for (const day of value.days) {
    if (day === null) { days.push(null); continue; }
    if (!day || typeof day !== "object" || Array.isArray(day) || Object.keys(day).some((key) => !["open", "close"].includes(key)))
      return { error: "Each day must be closed or have opening and closing times." };
    const start = toMinutes(day.open), end = toMinutes(day.close);
    if (start === null || end === null || start >= end)
      return { error: "Use valid 24-hour times, with closing later than opening on the same day." };
    days.push({ open: String(day.open), close: String(day.close), start, end });
  }
  return { days };
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

export function hoursStatus(config, at = Date.now()) {
  const parsed = !config || config.schedule == null ? { days: null } : validateWeeklyHours(config.schedule);
  if (parsed.error) throw new TypeError(parsed.error);
  const schedule = parsed.days ? { days: parsed.days } : null;
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
