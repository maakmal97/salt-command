/* test/counter-maintenance.mjs: THE COUNTER'S MAINTENANCE PAGE IS ON ITS FRAME (his yes of 11 Oct 2026, the plan's customer item 10).
 *
 * stmt/maintenance.js answers 503 with a heading and one sentence (15 Nov 2026, the move to Ambient: one Ambient shell at rest, its hero), its words from the table (stmt/words.js) and its time read
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
  /* 15 Nov 2026, the move to Ambient: the page is one Ambient shell at rest (Slate), its hero the heading and the sentence, in light and dark
     as the device is; it runs no script, loads nothing, and carries Ambient's tokens and the rules of the parts it wears, cut whole, inline */
  const H = (t) => '<h1 class="amb-hero__title">' + t + "</h1>", P = (t) => '<p class="amb-hero__sub">' + t + "</p>";
  ok(body.includes(P("Back at 14:30")) && body.includes(H("Under maintenance")) && body.includes("<title>Maintenance</title>") && body.includes('lang="en-GB"'),
    "it says the heading and when it is back: " + JSON.stringify(body.replace(/<style>[\s\S]*?<\/style>/, "").slice(-200)));
  const A = await import("../stmt/statement-css.js");
  const shell = /<body class="amb"><div class="amb-shell" data-mood="slate"><main class="amb-screen"><header class="amb-hero amb-mesh">(<h1 [^>]*>[^<]*<\/h1>)(<p [^>]*>[^<]*<\/p>)<\/header><\/main><\/div><\/body><\/html>$/.exec(body);
  ok(shell && shell[1] === H("Under maintenance") && shell[2] === P("Back at 14:30"),
    "it is one Ambient shell at rest (Slate), its hero the heading as the title and the sentence under it, and nothing else");
  ok(!/<script|<img|<link|\bsrc=|\bhref=|url\(|@import|https?:\/\//i.test(body), "and it loads nothing: no script, image, stylesheet, face or address");
  ok(!/<[a-z][^>]* data-theme=/.test(body) && /<meta name="color-scheme" content="light dark">/.test(body)
    && body.includes('<meta name="theme-color" media="(prefers-color-scheme: light)" content="' + A.AMB_THEME.light + '">')
    && body.includes('<meta name="theme-color" media="(prefers-color-scheme: dark)" content="' + A.AMB_THEME.dark + '">')
    && /translate="no"/.test(body) && /name="viewport"/.test(body),
    "it follows the device, light or dark, the browser bar at Ambient's base in each, kept from the translator, with a viewport");
  /* what it draws with is Ambient's, inline and whole: its style is the token block and the cut rules, comments out, and nothing of its own */
  const style = (/<style>([\s\S]*?)<\/style>/.exec(body) || [, ""])[1];
  ok(style === (A.AMB_TOKENS + A.AMB_MAINT_CSS).replace(/\/\*[\s\S]*?\*\//g, "") && style.includes(".amb-hero__title{") && style.includes("--amb-l-ink:"),
    "its style is Ambient's tokens and the parts it wears, as the generator cut them, with no rule or colour of its own (" + style.length + " bytes)");
  /* every colour it can show is a token of Ambient's, measured there: the slate ink holds 4.5:1 on the slate base in both modes */
  const slate = (/\[data-mood="slate"\]\s*\{([^}]*)\}/.exec(A.AMB_TOKENS) || [, ""])[1], tok = (k) => (new RegExp("--amb-" + k + ":\\s*(#[0-9a-f]{6});", "i").exec(slate) || [])[1];
  const pairs = [["l-ink", "l-base"], ["d-ink", "d-base"]].map(([x, y]) => tok(x) && tok(y) ? ratio(tok(x), tok(y)) : 0);
  ok(pairs.every((r) => r >= 4.5) && !/#[0-9a-f]{3,8}\b/i.test(body.replace(/<style>[\s\S]*?<\/style>/, "").replace(/<meta name="theme-color"[^>]*>/g, "")),
    "the heading and the sentence are Ambient's ink, 4.5:1 or more on Slate's ground in light and dark, and no colour is written outside its tokens: " + pairs.map((x) => x.toFixed(2)).join(" "));

  ok(/<p class="amb-hero__sub">Back on 13 Oct 2026 at 00:01<\/p>/.test(await html({ MAINTENANCE_UNTIL: "2026-10-12T16:01:00Z" }, now).text()), "a window that ends on another day says so on the page");

  /* 19 Oct 2026: whole words, so a CSS counter-reset, a salt- recipe class or a word such as desktop is not a name */
  /* nothing a stranger is handed names the app, the desk, a product, a level or a shape (the page's whole source, its comments included) */
  const O = await import("../src/orders.js");
  /* 15 Nov 2026: what it says is read outside its style, which is Ambient's own tokens and rules (held whole above), where a token's name
     such as --amb-solid-capsule is not a shape; its source is still searched whole for a brand */
  const words = body.replace(/<style>[\s\S]*?<\/style>/, " ").replace(/<[^>]*>/g, " ");
  ok(!O.wordsIn(words, O.PRODUCT_WORDS.concat(O.LEVEL_WORDS)).length && !O.siteWords(words) && !/\b(salt|command|counter|desk)\b(?![-(])/i.test(body)
    && !Object.values(PG.PSHAPE).some((s) => new RegExp("\\b" + s + "\\b", "i").test(words)),
    "and it names no brand, product, shape or level, in what it says or in its source: " + JSON.stringify(words.replace(/\s+/g, " ").trim().slice(0, 120)));

  /* ---- MAINTENANCE_TEXT still wins, escaped, and the heading stays ---- */
  const t = await html({ MAINTENANCE_UNTIL: until, MAINTENANCE_TEXT: "  Back by 6:00 a.m. <b>&</b> 'soon'  " }, now).text();
  ok(t.includes('<p class="amb-hero__sub">Back by 6:00 a.m. &#60;b&#62;&#38;&#60;/b&#62; &#39;soon&#39;</p>') && !t.includes("Back at 14:30") && t.includes('<h1 class="amb-hero__title">Under maintenance</h1>'),
    "MAINTENANCE_TEXT, when set, replaces the sentence, trimmed and escaped, under the same heading");
  ok(/<p class="amb-hero__sub">Back at 14:30<\/p>/.test(await html({ MAINTENANCE_UNTIL: until, MAINTENANCE_TEXT: "   " }, now).text()), "and a blank one is the time's sentence");
  ok(!/October 5|00:01 midnight|currently under maintenance/.test(body), "the old default sentence is gone");

  /* ---- what the guard keeps, on the real Worker ---- */
  const live = new Date(Date.now() + 36e5).toISOString(), env = { MAINTENANCE_UNTIL: live };
  const go = (p, h, e) => Worker.fetch(req(p, h), e || env, {});
  const pg = await go("/", { accept: "text/html,application/xhtml+xml" });
  ok(pg.status === 503 && +pg.headers.get("retry-after") > 3500 && pg.headers.get("cache-control") === "no-store" && /<h1 class="amb-hero__title">Under maintenance<\/h1>/.test(await pg.text()),
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
