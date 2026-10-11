/* Self-lifting maintenance guard. While env.MAINTENANCE_UNTIL parses as an ISO time still ahead,
 * every request answers 503 except the machine routes in MACHINE (their real check is downstream).
 * Absent, empty or unparseable does nothing. env.MAINTENANCE_TEXT, when set, replaces the words, escaped.
 * One copy in src/ and one in stmt/: nothing under stmt/ imports from src/. */
export const MACHINE = { paths: ["/all"], prefixes: ["/all/"], headers: ["x-stmt-desk", "x-counter-maker-key"] };
const TEXT = "The store is currently under maintenance. We are open for business again at 00:01 midnight of October 5.";
const esc = (s) => s.replace(/[&<>"']/g, (c) => "&#" + c.charCodeAt(0) + ";");
/* 11 Oct 2026, his word: two themes on every surface, Tide until a device chooses. This page runs no script (its policy is closed)
   and loads no stylesheet, so no choice can be read here and it is drawn Tide, in Tide's ground and salt from the design system
   (the suite holds the two hexes equal to design/salt-ds.css). */
const TIDE = { ground: "#03141a", text: "#eaf6f6" };
const page = (text) => '<!doctype html><html lang="en-GB" data-theme="tide"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
  + '<meta name="theme-color" content="' + TIDE.ground + '">'
  + "<title>Maintenance</title><style>html{background:" + TIDE.ground + ";color:" + TIDE.text + ";color-scheme:dark}"
  + "body{margin:0;padding:24px;font:18px/1.5 system-ui,sans-serif;max-width:30em}</style></head><body><p>"
  + esc(text) + "</p></body></html>";

export function maintenance(request, env, machine = MACHINE, now = Date.now()) {
  const until = Date.parse(String((env && env.MAINTENANCE_UNTIL) || "").trim());
  if (!Number.isFinite(until) || now >= until) return null;
  const p = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
  if (machine.paths.includes(p) || machine.prefixes.some((x) => p.startsWith(x))
    || machine.headers.some((h) => request.headers.get(h))) return null;
  const head = { "retry-after": String(Math.max(1, Math.ceil((until - now) / 1000))), "cache-control": "no-store" };
  if (/text\/html/i.test(request.headers.get("accept") || ""))
    return new Response(page(String((env && env.MAINTENANCE_TEXT) || "").trim() || TEXT), { status: 503, headers: { ...head,
      "content-type": "text/html; charset=utf-8", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'" } });
  return new Response(JSON.stringify({ ok: false, error: "maintenance" }), { status: 503,
    headers: { ...head, "content-type": "application/json; charset=utf-8" } });
}
