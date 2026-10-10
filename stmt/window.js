/* A DELIVERY'S TIME WINDOW (his decisions of 10 Oct 2026). A delivery is wanted as soon as it can come, or in one of six
 * back-to-back four-hour windows, 00-04 to 20-24 in Kuala Lumpur, each its next occurrence: the first whose start is
 * still ahead and which is not wholly outside the Counter's hours (the weekly schedule and the manual override Counter
 * Admin sets, KV maker:hours), looked for over the next seven days, so a closed day rolls the window to its next open
 * one (his Q6). A window partly inside the hours is offered, and its span is the part inside: "Delivery will be between
 * 09:00 and 12:00". A window is a request, never a promise: he manages it.
 *
 * A window is written `YYYY-MM-DDTHH` (the Kuala Lumpur day and its first hour), its span `HH:MM-HH:MM`: two strings, so
 * every whitelist and every equality the order already passes through takes them as they are.
 *
 * slotSpan and slotNext are ES5 and call nothing outside themselves (slotNext calls slotSpan, carried beside it): the
 * Counter's page carries their source as it carries payHref, so the sheet offers exactly what the Worker takes. No
 * backslash, no backtick, no arrow function, let or const in either; the suite reads them for those. */
export const WINDOWS = [0, 4, 8, 12, 16, 20];
export const SLOT_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T(00|04|08|12|16|20)$/;
export const SPAN_RE = /^([01][0-9]|2[0-4]):[0-5][0-9]-([01][0-9]|2[0-4]):[0-5][0-9]$/;
export const SLOT_DAYS = 7;

/** The part of a window inside the Counter's hours, as {from, to} in minutes of its day, or null when it is wholly outside
 *  them (closed: not offered). `cfg` is the stored hours ({schedule: {days: [7 of {open, close} or null]}, manual: {open,
 *  until}}), null for none set (every window open); `at` is now, in ms, which says whether the manual override still runs. */
export function slotSpan(slot, cfg, at) {
  var m = /^([0-9]{4}-[0-9]{2}-[0-9]{2})T([0-9]{2})$/.exec(String(slot || ""));
  if (!m) return null;
  var H = 3600000, base = Date.parse(m[1] + "T00:00:00Z") - 8 * H;
  if (!(base === base)) return null;
  var a = base + (+m[2]) * H, b = a + 4 * H, parts = [];
  function spanMin(t) { var x = /^([0-9]{2}):([0-9]{2})$/.exec(String(t || "")); return x ? (+x[1]) * 60 + (+x[2]) : null; }
  function spanTake(lo, hi) { if (lo < a) lo = a; if (hi > b) hi = b; if (hi > lo) parts.push([lo, hi]); }
  var days = cfg && cfg.schedule && cfg.schedule.days, s0 = base, s1 = base + 24 * H;
  if (days && days.length === 7) {
    var d = days[new Date(base + 8 * H).getUTCDay()], o = d ? spanMin(d.open) : null, c = d ? spanMin(d.close) : null;
    if (o === null || c === null || c <= o) { s0 = base; s1 = base; }
    else { s0 = base + o * 60000; s1 = base + c * 60000; }
  }
  var man = cfg && cfg.manual, until = man && typeof man.open === "boolean" ? Date.parse(man.until) : NaN;
  var cut = a;
  if (until === until && until > at) {
    if (man.open) spanTake(a, until);
    cut = until > a ? until : a;
  }
  spanTake(cut > s0 ? cut : s0, s1);
  if (!parts.length) return null;
  var lo = parts[0][0], hi = parts[0][1];
  for (var i = 1; i < parts.length; i++) { if (parts[i][0] < lo) lo = parts[i][0]; if (parts[i][1] > hi) hi = parts[i][1]; }
  return { from: Math.round((lo - base) / 60000), to: Math.round((hi - base) / 60000) };
}

/** The next occurrence of window `w` (its first hour) at `at`: {slot, span}, or null when none is open in the next seven
 *  days. `span` is "HH:MM-HH:MM", the part inside the hours. */
export function slotNext(w, cfg, at) {
  var H = 3600000;
  function nextHm(n) { var h = Math.floor(n / 60), x = n % 60; return (h < 10 ? "0" : "") + h + ":" + (x < 10 ? "0" : "") + x; }
  for (var k = 0; k <= 7; k++) {
    var day = new Date(at + 8 * H + k * 24 * H).toISOString().slice(0, 10);
    var start = Date.parse(day + "T00:00:00Z") - 8 * H + w * H;
    if (start <= at) continue;
    if (start - at > 7 * 24 * H) break;
    var slot = day + "T" + (w < 10 ? "0" : "") + w, sp = slotSpan(slot, cfg, at);
    if (sp) return { slot: slot, span: nextHm(sp.from) + "-" + nextHm(sp.to) };
  }
  return null;
}

/** The Worker's check at Place: a window it writes, whose end is still ahead, no more than eight days off, and not wholly
 *  outside the hours read at that moment. It does not insist on the next occurrence, so a sheet opened before a boundary
 *  still places after it. Returns {slot, span} or {error: "slot"}. */
export function slotTake(slot, cfg, at) {
  if (typeof slot !== "string" || !SLOT_RE.test(slot)) return { error: "slot" };
  const day = slot.slice(0, 10), w = +slot.slice(11, 13);
  const start = Date.parse(day + "T00:00:00Z") - 8 * 3600000 + w * 3600000;
  if (!Number.isFinite(start) || new Date(start + 8 * 3600000).toISOString().slice(0, 10) !== day) return { error: "slot" };
  if (start + 4 * 3600000 <= at || start - at > (SLOT_DAYS + 1) * 86400000) return { error: "slot" };
  const sp = slotSpan(slot, cfg, at);
  if (!sp) return { error: "slot" };
  const hm = (n) => String(Math.floor(n / 60)).padStart(2, "0") + ":" + String(n % 60).padStart(2, "0");
  return { slot, span: hm(sp.from) + "-" + hm(sp.to) };
}
