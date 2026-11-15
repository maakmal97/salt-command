/* Self-lifting maintenance guard. While env.MAINTENANCE_UNTIL parses as an ISO time still ahead,
 * every request answers 503 except the machine routes in MACHINE (their real check is downstream).
 * Absent, empty or unparseable does nothing. env.MAINTENANCE_TEXT, when set, replaces the sentence, escaped.
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

export function maintenance(request, env, machine = MACHINE, now = Date.now()) {
  const until = Date.parse(String((env && env.MAINTENANCE_UNTIL) || "").trim());
  if (!Number.isFinite(until) || now >= until) return null;
  const p = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
  if (machine.paths.includes(p) || machine.prefixes.some((x) => p.startsWith(x))
    || machine.headers.some((h) => request.headers.get(h))) return null;
  const head = { "retry-after": String(Math.max(1, Math.ceil((until - now) / 1000))), "cache-control": "no-store" };
  if (/text\/html/i.test(request.headers.get("accept") || ""))
    return new Response(page(String((env && env.MAINTENANCE_TEXT) || "").trim() || backWords(until, now)), { status: 503, headers: { ...head,
      "content-type": "text/html; charset=utf-8", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'" } });
  return new Response(JSON.stringify({ ok: false, error: "maintenance" }), { status: 503,
    headers: { ...head, "content-type": "application/json; charset=utf-8" } });
}
