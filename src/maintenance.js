/* Self-lifting maintenance guard. While env.MAINTENANCE_UNTIL parses as an ISO time still ahead,
 * every request answers 503 except the machine routes in MACHINE (their real check is downstream).
 * Absent, empty or unparseable does nothing. One copy in src/ and one in stmt/, the same body:
 * nothing under stmt/ imports from src/. */
export const MACHINE = { paths: ["/rev", "/stmt/rev"], prefixes: ["/_internal/"], headers: ["x-salt-key", "x-stmt-desk", "x-counter-maker-key"] };
const TEXT = "The store is currently under maintenance. We are open for business again at 00:01 midnight of October 5.";
const PAGE = '<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
  + "<title>Maintenance</title><style>body{margin:0;padding:24px;font:18px/1.5 system-ui,sans-serif;max-width:30em}</style></head><body><p>"
  + TEXT + "</p></body></html>";

export function maintenance(request, env, machine = MACHINE, now = Date.now()) {
  const until = Date.parse(String((env && env.MAINTENANCE_UNTIL) || "").trim());
  if (!Number.isFinite(until) || now >= until) return null;
  const p = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
  if (machine.paths.includes(p) || machine.prefixes.some((x) => p.startsWith(x))
    || machine.headers.some((h) => request.headers.get(h))) return null;
  const head = { "retry-after": String(Math.max(1, Math.ceil((until - now) / 1000))), "cache-control": "no-store" };
  if (/text\/html/i.test(request.headers.get("accept") || ""))
    return new Response(PAGE, { status: 503, headers: { ...head, "content-type": "text/html; charset=utf-8",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'" } });
  return new Response(JSON.stringify({ ok: false, error: "maintenance" }), { status: 503,
    headers: { ...head, "content-type": "application/json; charset=utf-8" } });
}
