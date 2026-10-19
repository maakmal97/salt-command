/* test/counter-maintenance.mjs: THE COUNTER'S MAINTENANCE PAGE IS ON ITS FRAME (his yes of 11 Oct 2026, the plan's customer item 10).
 *
 * stmt/maintenance.js answers 503 with the ring over a heading and one sentence, its words from the table (stmt/words.js) and its time read
 * from MAINTENANCE_UNTIL in Kuala Lumpur: "Back at 14:30", or "Back on 13 Oct 2026 at 00:01" once that is not today. MAINTENANCE_TEXT, when set,
 * still wins and is escaped. It runs no script, loads nothing and keeps the closed policy, so the ring is inline and the faces fall back to the
 * system's. What the guard keeps (503, Retry-After, no-store, JSON for a request that is not HTML, the machine routes, the policy) is held by
 * the section "Maintenance guard on both Workers" in test/verify.mjs, and again here on the real Worker. Each check below was proved red by its
 * own mutation (test/counter-maintenance.mutations.json, run with tools/section.mjs). Every date here is invented.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO = join(import.meta.dirname, "..");
const strip = (c) => c.replace(/\/\*[\s\S]*?\*\//g, "");

export async function run({ ok }) {
  const { maintenance, backWords, MACHINE } = await import("../stmt/maintenance.js");
  const W = await import("../stmt/words.js"), PG = await import("../stmt/page.js"), Worker = (await import("../stmt/worker.js")).default;
  const ds = strip(readFileSync(join(REPO, "design", "salt-ds.css"), "utf8"));
  const tide = Object.fromEntries([...((ds.match(/:root\[data-theme="tide"\]\s*\{([^}]*)\}/) || ["", ""])[1]).matchAll(/--salt-([\w-]+):\s*([^;]+);/g)].map((x) => [x[1], x[2].trim()]));
  const lum = (hx) => { const c = [1, 3, 5].map((i) => parseInt(hx.slice(i, i + 2), 16) / 255).map((v) => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const at = (iso) => Date.parse(iso);

  /* ---- the words ---- */
  ok(W.EN["maint.at"] === "Back at {t}" && W.EN["maint.on"] === "Back on {d} at {t}" && W.EN["maint.h"] === "Under maintenance" && W.EN["maint.title"] === "Maintenance",
    "the page's four sentences are keys of the table: " + JSON.stringify(["maint.h", "maint.title", "maint.at", "maint.on"].map((k) => W.EN[k])));

  /* ---- the time, read from MAINTENANCE_UNTIL in Kuala Lumpur ---- */
  const now = at("2026-10-12T02:00:00Z");   /* 10:00 on 12 Oct in Kuala Lumpur */
  ok(backWords(at("2026-10-12T06:30:00Z"), now) === "Back at 14:30", "a time later today says Back at, 24 hours, in Kuala Lumpur (06:30 UTC is 14:30): " + backWords(at("2026-10-12T06:30:00Z"), now));
  ok(backWords(at("2026-10-12T16:01:00Z"), now) === "Back on 13 Oct 2026 at 00:01", "a time on another day says the day as DD Mon YYYY and the time: " + backWords(at("2026-10-12T16:01:00Z"), now));
  const lateNow = at("2026-10-12T15:00:00Z");   /* 23:00 on 12 Oct in Kuala Lumpur, and still 12 Oct in UTC */
  ok(backWords(at("2026-10-12T16:30:00Z"), lateNow) === "Back on 13 Oct 2026 at 00:30",
    "today is the Kuala Lumpur day, not the UTC one (23:00 on 12 Oct, back 00:30 on 13 Oct, both 12 Oct in UTC): " + backWords(at("2026-10-12T16:30:00Z"), lateNow));
  const earlyNow = at("2026-10-12T17:00:00Z");   /* 01:00 on 13 Oct in Kuala Lumpur, and still 12 Oct in UTC */
  ok(backWords(at("2026-10-13T00:30:00Z"), earlyNow) === "Back at 08:30",
    "and the other way (01:00 on 13 Oct, back 08:30 the same Kuala Lumpur day, which is another UTC day): " + backWords(at("2026-10-13T00:30:00Z"), earlyNow));
  ok(backWords(at("2026-10-12T06:30:20Z"), now) === "Back at 14:31", "a moment past the minute is rounded up, so the page never promises a time before the guard lifts: " + backWords(at("2026-10-12T06:30:20Z"), now));
  ok(backWords(at("2026-12-31T16:00:00Z"), at("2026-12-31T10:00:00Z")) === "Back on 01 Jan 2027 at 00:00", "and across a year: " + backWords(at("2026-12-31T16:00:00Z"), at("2026-12-31T10:00:00Z")));

  /* ---- the page, through the guard ---- */
  const req = (p, h) => new Request("https://k7m3p2.example" + p, { headers: h || {} });
  const html = (env, n) => maintenance(req("/", { accept: "text/html" }), env, MACHINE, n);
  const until = new Date(now + 4.5 * 36e5).toISOString();   /* 14:30 */
  const r = html({ MAINTENANCE_UNTIL: until }, now), body = await r.text();
  ok(r.status === 503 && r.headers.get("retry-after") === String(4.5 * 3600) && r.headers.get("cache-control") === "no-store" && /^text\/html/.test(r.headers.get("content-type")),
    "it answers 503 with Retry-After for the whole window and no-store");
  ok(r.headers.get("content-security-policy") === "default-src 'none'; style-src 'unsafe-inline'", "under the closed policy, which admits no script, image or face");
  ok(body.includes("<p>Back at 14:30</p>") && body.includes("<h1>Under maintenance</h1>") && body.includes("<title>Maintenance</title>") && body.includes('lang="en-GB"'),
    "it says the heading and when it is back: " + JSON.stringify(body.replace(/<style>[\s\S]*?<\/style>/, "").replace(/<svg[\s\S]*?<\/svg>/, "[ring]").slice(-150)));
  const ringOf = (h) => (/<path d="[^"]*"[^>]*\/>/.exec(h) || [""])[0];
  ok(ringOf(PG.glyphSvg("ring", 40)) !== "" && body.includes(ringOf(PG.glyphSvg("ring", 40))) && /<svg [^>]*width="40" height="40"/.test(body) && body.indexOf("<svg") < body.indexOf("<h1>"),
    "the ring is the app's own, inline and above the heading, drawn as the page draws it");
  ok(!/<script|<img|<link|\bsrc=|\bhref=|url\(|@import|https?:\/\//i.test(body), "and it loads nothing: no script, image, stylesheet, face or address");
  ok(/theme-color" content="#03141a"/.test(body) && /<html[^>]* data-theme="tide"/.test(body) && /translate="no"/.test(body) && /name="viewport"/.test(body),
    "it is Tide, with the browser bar at Tide's ground, kept from the translator, with a viewport");
  /* each colour it writes is the design system's Tide token */
  const hexes = [...new Set(body.match(/#[0-9a-f]{6}/gi) || [])].map((x) => x.toLowerCase()).sort();
  const want = [tide.obsidian, tide.salt, tide["mist-light"], tide.brass].map((x) => x.toLowerCase()).sort();
  ok(JSON.stringify(hexes) === JSON.stringify(want), "every colour it writes is Tide's obsidian, salt, mist-light or brass in the design system: " + JSON.stringify([hexes, want]));
  const glow = [...body.matchAll(/rgba\((\d+,\d+,\d+),/g)].map((m) => m[1].split(",").join(", ")).sort();
  const css = strip(readFileSync(join(REPO, "stmt", "statement-css.js"), "utf8"));
  const tideRgb = [(/--salt-copper-rgb:\s*([\d, ]+);/.exec(css) || [])[1], (/--salt-brass-rgb:\s*([\d, ]+);/.exec(css) || [])[1]].sort();
  ok(JSON.stringify(glow) === JSON.stringify(tideRgb) && tideRgb.every(Boolean), "and its two corner glows are Tide's copper and brass channels: " + JSON.stringify([glow, tideRgb]));
  ok(ratio(tide.salt, tide.obsidian) >= 4.5 && ratio(tide["mist-light"], tide.obsidian) >= 4.5 && ratio(tide.brass, tide.obsidian) >= 3,
    "the heading and the sentence hold 4.5:1 on the ground and the ring 3:1: " + [ratio(tide.salt, tide.obsidian), ratio(tide["mist-light"], tide.obsidian), ratio(tide.brass, tide.obsidian)].map((x) => x.toFixed(2)).join(" "));
  ok(/<p>Back on 13 Oct 2026 at 00:01<\/p>/.test(await html({ MAINTENANCE_UNTIL: "2026-10-12T16:01:00Z" }, now).text()), "a window that ends on another day says so on the page");

  /* 19 Oct 2026: whole words, so a CSS counter-reset, a salt- recipe class or a word such as desktop is not a name */
  /* nothing a stranger is handed names the app, the desk, a product, a level or a shape (the page's whole source, its comments included) */
  const O = await import("../src/orders.js");
  const words = body.replace(/<[^>]*>/g, " ");
  ok(!O.wordsIn(words, O.PRODUCT_WORDS.concat(O.LEVEL_WORDS)).length && !O.siteWords(words) && !/\b(salt|command|counter|desk)\b(?![-(])/i.test(body)
    && !Object.values(PG.PSHAPE).some((s) => new RegExp("\\b" + s + "\\b", "i").test(words)),
    "and it names no brand, product, shape or level, in what it says or in its source: " + JSON.stringify(words.replace(/\s+/g, " ").trim().slice(0, 120)));

  /* ---- MAINTENANCE_TEXT still wins, escaped, and the heading stays ---- */
  const t = await html({ MAINTENANCE_UNTIL: until, MAINTENANCE_TEXT: "  Back by 6:00 a.m. <b>&</b> 'soon'  " }, now).text();
  ok(t.includes("<p>Back by 6:00 a.m. &#60;b&#62;&#38;&#60;/b&#62; &#39;soon&#39;</p>") && !t.includes("Back at 14:30") && t.includes("<h1>Under maintenance</h1>"),
    "MAINTENANCE_TEXT, when set, replaces the sentence, trimmed and escaped, under the same heading");
  ok(/<p>Back at 14:30<\/p>/.test(await html({ MAINTENANCE_UNTIL: until, MAINTENANCE_TEXT: "   " }, now).text()), "and a blank one is the time's sentence");
  ok(!/October 5|00:01 midnight|currently under maintenance/.test(body), "the old default sentence is gone");

  /* ---- what the guard keeps, on the real Worker ---- */
  const live = new Date(Date.now() + 36e5).toISOString(), env = { MAINTENANCE_UNTIL: live };
  const go = (p, h, e) => Worker.fetch(req(p, h), e || env, {});
  const pg = await go("/", { accept: "text/html,application/xhtml+xml" });
  ok(pg.status === 503 && +pg.headers.get("retry-after") > 3500 && pg.headers.get("cache-control") === "no-store" && /<h1>Under maintenance<\/h1>/.test(await pg.text()),
    "the Worker answers a page with this one: 503, Retry-After, no-store");
  const js = await go("/orders", { accept: "application/json" });
  ok(js.status === 503 && (await js.text()) === '{"ok":false,"error":"maintenance"}' && /^application\/json/.test(js.headers.get("content-type")) && js.headers.get("cache-control") === "no-store" && js.headers.has("retry-after"),
    "a request that is not HTML gets the JSON refusal, not the page");
  /* a pass-through is any answer that is not the guard's, a throw from a bare env included */
  const held = async (p, h, e) => { try { const x = await go(p, h, e); return x.status === 503 && x.headers.has("retry-after"); } catch (err) { return false; } };
  const passes = [["/all", {}], ["/all/maker/x", {}], ["/desk/orders/last", { "x-stmt-desk": "k" }], ["/x", { "x-counter-maker-key": "k" }]];
  const heldAll = [];
  for (const [p, h] of passes) if (await held(p, h)) heldAll.push(p);
  ok(heldAll.length === 0 && await held("/allx", {}) && await held("/orders", { accept: "application/json" }),
    "the machine routes pass the guard for their own check, and a path that only starts like one does not: " + JSON.stringify(heldAll));
  ok(!await held("/", { accept: "text/html" }, { MAINTENANCE_UNTIL: new Date(Date.now() - 1e3).toISOString() }), "and when the time has gone the guard lifts by itself");
}
