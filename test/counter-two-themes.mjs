/* test/counter-two-themes.mjs: ONE AMBIENT HEAD ON EVERY PAGE OF THE SITE, FOLLOWING THE DEVICE (15 Nov 2026, the move to Ambient).
 *
 * Until 15 Nov 2026 this file held the Counter's Night and Tide (his word of 11 Oct 2026), parked since 19 Oct 2026 while Tide was off. His
 * answer of 14 Nov 2026 retired both themes on the Counter and Salt Admin: light and dark follow each device, so the checks are re-aimed at
 * that rule, and the section runs again. Every page the statements Worker draws (Salt Counter, Salt Admin, the guest board, the shut page,
 * the 404, the join page and his test surface) opens on one head: no theme on the root, a page drawn for light and dark, the browser bar at
 * Ambient's base in each (AMB_THEME, read out of the tokens by tools/stmt-style.mjs), the body Ambient's with the icon sprite first, one
 * stylesheet under the nonce that begins with Ambient's tokens, its parts and the site's own layer, and Ambient's script under the nonce
 * before the page's own wherever the page runs one. No face is loaded and no Aurora drawn. Each check is proved red by its own mutation
 * (test/counter-two-themes.mutations.json, run with tools/section.mjs). Every code, name and password here is invented.
 */
import { webcrypto } from "node:crypto";

const wait = async (f, n = 400) => { for (let i = 0; i < n && !f(); i++) await new Promise((r) => setTimeout(r, 15)); return f(); };

export async function run({ ok }) {
  const PG = await import("../stmt/page.js");
  const A = await import("../stmt/statement-css.js");
  const { testShell } = await import("../stmt/testsurface.js");
  const { JSDOM, VirtualConsole } = await import("jsdom");
  const C = await import("../tools/stmt-crypto.mjs");

  const HEAD = '<!DOCTYPE html>\n<html lang="en" translate="no"><head><meta charset="utf-8"><meta name="google" content="notranslate">'
    + '<meta name="color-scheme" content="light dark">'
    + '<meta name="theme-color" media="(prefers-color-scheme: light)" content="' + A.AMB_THEME.light + '">'
    + '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="' + A.AMB_THEME.dark + '">';
  const STYLE = A.AMB_TOKENS + A.AMB_CSS + A.SITE_CSS;
  const pages = [
    ["Salt Counter", PG.landingPage("", "nC", null), "nC", true],
    ["Salt Admin", PG.landingPage("", "nA", { master: "m", accounts: [] }), "nA", true],
    ["the guest board", PG.boardPage({ prices: { products: [], week: { label: "this week" } } }, "nG"), "nG", false],
    ["the shut page", PG.shutPage("nS"), "nS", false],
    ["the 404", PG.notFoundPage("nN"), "nN", false],
    ["the join page", PG.joinPage("nJ", "abcdefghijklmnop"), "nJ", false],
    ["his test surface", testShell("nT", {}), "nT", true]
  ];
  for (const [name, html, nonce, runs] of pages) {
    const styles = html.match(/<style[^>]*>/g) || [], style = (new RegExp('<style nonce="' + nonce + '">([\\s\\S]*?)</style>').exec(html) || [, ""])[1];
    ok(html.startsWith(HEAD) && !/<html[^>]* data-theme=/.test(html) && (html.match(/<meta name="theme-color"/g) || []).length === 2,
      name + ": the one head, no theme on the root, drawn for light and dark, the browser bar at Ambient's base in each");
    ok(styles.length === 1 && style.startsWith(STYLE),
      name + ": one stylesheet under the nonce, opening with Ambient's tokens, its parts and the site's own layer (" + styles.length + " style)");
    const body = html.slice(html.indexOf("</head>") + 7);
    ok(body.startsWith('<body class="amb">' + A.AMB_ICONS),
      name + ": the body is Ambient's, its icon sprite the first thing in it");
    ok(!/@font-face|\/fonts\/|salt-aurora|saltLook|salt-look/.test(html) && !html.includes(A.FONT_FACE_CSS) && !html.includes(A.SITE_RECIPES.slice(0, 400)),
      name + ": no face is loaded, no Aurora drawn, and nothing reads or writes a look");
    const amb = html.indexOf('<script nonce="' + nonce + '">' + A.AMB_JS + "</script>"), scripts = [...html.matchAll(/<script(?![^>]*application\/json)[^>]*>/g)].map((m) => m.index);
    ok(runs ? amb > 0 && scripts.length >= 2 && scripts[0] === amb && html.lastIndexOf("</script>") > amb + A.AMB_JS.length
      : amb < 0 && !html.includes(A.AMB_JS.slice(0, 200)),
      name + (runs ? ": Ambient's script under the nonce, before the page's own" : ": no Ambient script, the page running none of its own or only its own"));
  }

  /* ---- signed in, the Counter's shell is Ambient's and asks for no look ---- */
  const U = "ctab-cdef", PASS = "fixture-pass-two-1", ck = await C.contentKey("test-secret", U);
  const env = await C.encryptWith(ck, JSON.stringify({ statements: [{ issued: "2026-09-01", label: "September", body: "<p>Statement</p>" }] }));
  const b = { ok: true, wrap: await C.wrapKey(PASS, ck), session: "sess-two", env };
  const vc = new VirtualConsole(), errs = []; vc.on("jsdomError", (e) => errs.push(String(e && e.message || e)));
  const dom = new JSDOM(PG.landingPage(U, "nX", null), { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc, beforeParse(win) {
    try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
    win.scrollTo = () => {}; win.HTMLElement.prototype.scrollIntoView = () => {};
    win.fetch = async (path, init) => {
      const p = String(path), m = (init && init.method) || "GET", reply = (status, j) => ({ ok: status === 200, status, type: "basic", json: async () => j });
      if (p === "/open") return reply(200, b);
      if (p === "/orders" && m === "GET") return reply(200, { ok: true, orders: [] });
      return reply(404, { ok: false });
    };
  } });
  const w = dom.window, d = w.document;
  d.getElementById("un").value = U; d.getElementById("pw").value = PASS;
  d.getElementById("f").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
  await wait(() => !d.getElementById("tabs").hidden);
  const tabs = d.getElementById("tabs");
  ok(typeof w.Ambient === "object" && typeof w.Ambient.mood === "function" && errs.length === 0,
    "signed in, Ambient's script has run on the Counter and the page threw nothing: " + JSON.stringify(errs.slice(0, 2)));
  ok(!tabs.hidden && tabs.classList.contains("amb-shell") && tabs.getAttribute("data-mood") === "lagoon" && !d.documentElement.hasAttribute("data-theme"),
    "and its places stand in one Ambient shell, Lagoon, the device choosing light or dark");
  w.close();
}
