/* Self-lifting maintenance guard. While env.MAINTENANCE_UNTIL parses as an ISO time still ahead,
 * every request answers 503 except the machine routes in MACHINE (their real check is downstream).
 * Absent, empty or unparseable does nothing. env.MAINTENANCE_TEXT, when set, replaces the sentence, escaped.
 * One copy in src/ (the desk's, its own words) and one in stmt/, which imports stmt/words.js and nothing else.
 * 12 Oct 2026 (Phase 7d part 4, his yes of 11 Oct): the page is the Counter's frame, the ring over a heading and one sentence, its words
 * from the table and its time read from MAINTENANCE_UNTIL in Kuala Lumpur, so it never says a day that has passed. */
import { EN, fill } from "./words.js";

export const MACHINE = { paths: ["/all"], prefixes: ["/all/"], headers: ["x-stmt-desk", "x-counter-maker-key"] };
const esc = (s) => s.replace(/[&<>"']/g, (c) => "&#" + c.charCodeAt(0) + ";");
/* 11 Oct 2026, his word: two themes on every surface, Tide until a device chooses. This page runs no script (its policy is closed)
   and loads no stylesheet or face, so no choice can be read here and it is drawn Tide, in Tide's tokens from the design system
   (the suite holds each hex equal to design/salt-ds.css). The ring is the app's, inline: the policy admits no image. */
const TIDE = { ground: "#03141a", text: "#eaf6f6", soft: "#a4bbbf", accent: "#7fd1c0", glow: "98,182,204", glow2: "127,209,192" };
const RING = '<svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true" focusable="false"><path d="M12 4.2 A7.8 7.8 0 1 1 11.99 4.2 Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/></svg>';
/* the body's background is the canvas's (the root has none), so the ground and its two glows fill the screen as the frame's do */
const CSS = "html{color:" + TIDE.text + ";color-scheme:dark;-webkit-text-size-adjust:100%}"
  + "body{margin:0;padding:44px 20px 60px;font:0.9375rem/1.6 'Fraunces',Georgia,'Times New Roman',serif;"
  + "background:radial-gradient(1200px 640px at 82% -12%,rgba(" + TIDE.glow + ",.16) 0,transparent 62%),"
  + "radial-gradient(900px 560px at -10% 6%,rgba(" + TIDE.glow2 + ",.1) 0,transparent 58%) " + TIDE.ground + ";background-attachment:fixed}"
  + "main{max-width:620px;margin:0 auto}svg{display:block;margin:0 0 14px;color:" + TIDE.accent + "}"
  + "h1{margin:0 0 6px;font-size:1.5rem;font-weight:600;line-height:1.2}p{margin:0;color:" + TIDE.soft + ";line-height:1.7}";
const page = (text) => '<!doctype html><html lang="en-GB" translate="no" data-theme="tide"><head><meta charset="utf-8"><meta name="google" content="notranslate">'
  + '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow,noarchive">'
  + '<meta name="theme-color" content="' + TIDE.ground + '">'
  + "<title>" + esc(EN["maint.title"]) + "</title><style>" + CSS + "</style></head><body><main>" + RING
  + "<h1>" + esc(EN["maint.h"]) + "</h1><p>" + esc(text) + "</p></main></body></html>";

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
