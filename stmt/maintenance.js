/* TWO GUARDS, ONE PAGE OF WORDS.
 * 1. env.MAINTENANCE_UNTIL, a COMPLETE BLOCK set by a deploy (the guard below): while it parses as an ISO time still ahead, every request
 *    answers 503 except the machine routes in MACHINE (their real check is downstream). Absent, empty or unparseable does nothing.
 *    env.MAINTENANCE_TEXT, when set, replaces the sentence, escaped.
 * 2. HIS SWITCH on Salt Admin (KV MAINT_KEY, below), NOT a block (his word of 18 Nov 2026: "they cannot sign in and notice is put outside,
 *    rather than complete block of the worker"): the Worker answers as usual, and under the switch (stmt/worker.js) the door pages carry the
 *    notice, no customer account opens (every road that opens one answers the refusal `maint`, an admin account excepted), a customer
 *    already signed in is left in, reads as usual, and can change nothing (the Worker refuses each customer write, and the page, told by
 *    `maint: true` on its account read, makes every control inert and says nothing). Guest links, the service worker, the manifest and the
 *    icons are untouched. A switch that cannot be read holds for a minute: read as on. The MAINTENANCE_UNTIL block ignores the switch.
 * One copy in src/ (the desk's, its own words) and one in stmt/, which imports stmt/words.js and the generated Ambient strings
 * (stmt/statement-css.js) and nothing else.
 * 12 Oct 2026 (Phase 7d part 4, his yes of 11 Oct): one heading and one sentence, its words from the table and its time read from
 * MAINTENANCE_UNTIL in Kuala Lumpur, so it never says a day that has passed.
 * 15 Nov 2026, THE MOVE TO AMBIENT (his word of 15 Nov 2026: "make sure that guard is also on Ambient"): the page is one Ambient shell
 * at rest (Slate) and its hero, the heading its title and the sentence under it, following the device in light and dark. It runs no
 * script and its policy stays closed, so what it draws with travels inline: Ambient's tokens and the few rules of the parts it wears,
 * cut out of ambient.css by tools/stmt-style.mjs (AMB_MAINT_CSS), both without their comments. Nothing here names a colour. */
import { EN, fill } from "./words.js";
import { AMB_TOKENS, AMB_MAINT_CSS, AMB_THEME } from "./statement-css.js";

export const MACHINE = { paths: ["/all"], prefixes: ["/all/"], headers: ["x-stmt-desk", "x-counter-maker-key"] };
const esc = (s) => s.replace(/[&<>"']/g, (c) => "&#" + c.charCodeAt(0) + ";");
const CSS = (AMB_TOKENS + AMB_MAINT_CSS).replace(/\/\*[\s\S]*?\*\//g, "");
const page = (text) => '<!doctype html><html lang="en-GB" translate="no"><head><meta charset="utf-8"><meta name="google" content="notranslate">'
  + '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow,noarchive">'
  + '<meta name="color-scheme" content="light dark">'
  + '<meta name="theme-color" media="(prefers-color-scheme: light)" content="' + AMB_THEME.light + '">'
  + '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="' + AMB_THEME.dark + '">'
  + "<title>" + esc(EN["maint.title"]) + "</title><style>" + CSS + '</style></head><body class="amb">'
  + '<div class="amb-shell" data-mood="slate"><main class="amb-screen"><header class="amb-hero amb-mesh">'
  + '<h1 class="amb-hero__title">' + esc(EN["maint.h"]) + '</h1><p class="amb-hero__sub">' + esc(text) + "</p></header></main></div></body></html>";

/* a moment in Kuala Lumpur, in parts */
const klParts = (ms) => {
  const p = {};
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "numeric", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(ms)).forEach((x) => { p[x.type] = x.value; });
  return p;
};
/* when it is back, the minute rounded UP so the page never promises a moment before the guard lifts: "Back at 14:30" if that is today
   in Kuala Lumpur, else "Back on 13 Oct 2026 at 00:01" */
export function backWords(until, now) {
  const u = klParts(Math.ceil(until / 60000) * 60000), n = klParts(now), t = u.hour + ":" + u.minute;
  if (u.day === n.day && u.month === n.month && u.year === n.year) return fill(EN["maint.at"], { t });
  return fill(EN["maint.on"], { d: u.day + " " + EN["mon3"].split(" ")[+u.month - 1] + " " + u.year, t });
}

/* 17 Nov 2026, his word: HIS SWITCH ON SALT ADMIN (Shop, Hours). Counter KV `maint` holds {until}, an ISO UTC time with no milliseconds, written
   and cleared by /all/maker/maintenance (stmt/maker.js) and read by the Worker on every request but the machine routes (switchOf), so it stands
   at once with no deploy and lifts by itself at that time, as MAINTENANCE_UNTIL does. From 18 Nov 2026 it is a notice and a sign-in stop, not a block. */
export const MAINT_KEY = "maint";
const isoMin = (t) => new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z");
/* what he sends: {until} later than now; the answer is the record to file, or {error} */
export function maintSet(body, now = Date.now()) {
  const keys = body && typeof body === "object" ? Object.keys(body) : [];
  if (keys.length !== 1 || keys[0] !== "until" || typeof body.until !== "string") return { error: "Send only when it is back." };
  const t = Date.parse(body.until.trim());
  if (!Number.isFinite(t) || !/^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d(\.\d{1,3})?)?(Z|[+-]\d\d:\d\d)$/.test(body.until.trim())) return { error: "Choose when it is back." };
  if (t <= now) return { error: "Choose a time later than now." };
  return { until: isoMin(Math.ceil(t / 60000) * 60000) };
}
/* the record as it stands: {until} while it is ahead, else null */
export function maintOf(value, now = Date.now()) {
  const t = Date.parse(String((value && value.until) || ""));
  return Number.isFinite(t) && t > now ? { until: isoMin(t) } : null;
}
/* a request the guard never holds: the machine routes, whose real check is downstream */
export function exempt(request, machine = MACHINE) {
  const p = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
  return machine.paths.includes(p) || machine.prefixes.some((x) => p.startsWith(x)) || machine.headers.some((h) => request.headers.get(h));
}

/* his switch as it stands: the moment it lifts in ms, or 0 for off. A switch that cannot be read is read as ON for a minute, never open
   and never a raw error (18 Nov 2026) */
export async function switchOf(env, now = Date.now()) {
  if (!(env && env.STMT)) return 0;
  try {
    const t = Date.parse(String(((await env.STMT.get(MAINT_KEY, "json")) || {}).until || "").trim());
    return Number.isFinite(t) && t > now ? t : 0;
  } catch (e) { return now + 60000; }
}

/* the complete block, MAINTENANCE_UNTIL alone; his switch is never read here */
export function maintenance(request, env, machine = MACHINE, now = Date.now()) {
  const until = Date.parse(String((env && env.MAINTENANCE_UNTIL) || "").trim());
  if (!(until > now)) return null;
  if (exempt(request, machine)) return null;
  const head = { "retry-after": String(Math.max(1, Math.ceil((until - now) / 1000))), "cache-control": "no-store" };
  if (/text\/html/i.test(request.headers.get("accept") || ""))
    return new Response(page(String((env && env.MAINTENANCE_TEXT) || "").trim() || backWords(until, now)), { status: 503, headers: { ...head,
      "content-type": "text/html; charset=utf-8", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'" } });
  return new Response(JSON.stringify({ ok: false, error: "maintenance" }), { status: 503,
    headers: { ...head, "content-type": "application/json; charset=utf-8" } });
}
