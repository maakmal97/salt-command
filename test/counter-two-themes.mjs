/* test/counter-two-themes.mjs: THE COUNTER WEARS NIGHT OR TIDE, CHOSEN ON EACH DEVICE (his word of 11 Oct 2026).
 *
 * Two themes on every surface, kept per device (localStorage salt-look, night or tide), Tide until one is chosen. A signed-in
 * customer page on a device that has chosen nothing asks once in a Sheet; Account holds a Look setting with the two options; Salt
 * Account (his page) opens in the stored theme from the same head script and has a switch of its own in Shop (test/admin-look.mjs);
 * a guest board, the shut page, the site's 404 and the maintenance page run no script, so they are drawn Tide. Every assertion below observes a
 * page's window or the generated stylesheet's declared values, and each was proved red by its own mutation
 * (test/counter-two-themes.mutations.json, run with tools/section.mjs). Every code, name and password here is invented.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { webcrypto } from "node:crypto";

const REPO = join(import.meta.dirname, "..");
const wait = async (f, n = 400) => { for (let i = 0; i < n && !f(); i++) await new Promise((r) => setTimeout(r, 15)); return f(); };
const strip = (c) => c.replace(/\/\*[\s\S]*?\*\//g, "");

export async function run({ ok }) {
  const { landingPage, boardPage, shutPage, notFoundPage } = await import("../stmt/page.js");
  const { STATEMENT_CSS, SITE_RECIPES } = await import("../stmt/statement-css.js");
  const { maintenance } = await import("../stmt/maintenance.js");
  const W = await import("../stmt/words.js"), C = await import("../tools/stmt-crypto.mjs"), TF = await import("../tools/testfix.mjs");
  const { JSDOM, VirtualConsole } = await import("jsdom");

  /* ---- the generated stylesheet's two themes, and the design system they were read from ---- */
  const ds = strip(readFileSync(join(REPO, "design", "salt-ds.css"), "utf8"));
  const toks = (css, re) => Object.fromEntries([...((strip(css).match(re) || ["", ""])[1]).matchAll(/--salt-([\w-]+):\s*([^;]+);/g)].map((x) => [x[1], x[2].trim()]));
  const NIGHT_RE = /:root\s*\{([^}]*)\}/, TIDE_RE = /:root\[data-theme="tide"\]\s*\{([^}]*)\}/;
  const NIGHT = toks(STATEMENT_CSS, NIGHT_RE), TIDE_OVER = toks(STATEMENT_CSS, TIDE_RE), TIDE = { ...NIGHT, ...TIDE_OVER };
  const SYS_NIGHT = toks(ds, NIGHT_RE), SYS_TIDE = toks(ds, TIDE_RE);
  const same = (a, b) => Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((k) => a[k] === b[k]);
  ok(Object.keys(TIDE_OVER).length > 20 && same(NIGHT, SYS_NIGHT) && same(TIDE_OVER, SYS_TIDE),
    `the generated stylesheet carries both themes as the design system holds them: Night's ${Object.keys(NIGHT).length} tokens and Tide's ${Object.keys(TIDE_OVER).length} restated`);
  const tideRule = (STATEMENT_CSS.match(/:root\[data-theme="tide"\]\s*\{/g) || []).length;
  ok(tideRule === 1 && STATEMENT_CSS.indexOf(':root[data-theme="tide"]') > STATEMENT_CSS.indexOf(":root"),
    "and Tide's block comes once, after Night's, so the attribute alone changes every token");

  /* ---- text contrast, measured off the generated CSS: every colour the customer page sets as text, on each theme's ground and slate ---- */
  const lum = (hx) => { const c = [1, 3, 5].map((i) => parseInt(hx.slice(i, i + 2), 16) / 255).map((v) => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const HEX = /^#[0-9a-f]{6}$/i;
  const pageHtml = landingPage("abcd-efgh", "nct", null);
  const allCss = (pageHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/) || ["", ""])[1];
  /* the page's style is the faces, the statement's stylesheet, the system's recipes and then the page's own layer, in that order */
  const cutAt = allCss.indexOf(SITE_RECIPES);
  const pageCss = cutAt >= 0 ? allCss.slice(cutAt + SITE_RECIPES.length) : "";
  ok(cutAt > 0 && allCss.includes(STATEMENT_CSS) && pageCss.includes(".look-tile"), "the page's style carries the statement's stylesheet, the recipes and its own layer, which holds the Look");
  const noPrint = (css) => { let out = strip(css), at; while ((at = out.search(/@media\s+print\s*\{/)) >= 0) { let d = 0, i = out.indexOf("{", at); for (; i < out.length; i++) { if (out[i] === "{") d++; else if (out[i] === "}" && --d === 0) break; } out = out.slice(0, at) + out.slice(i + 1); } return out; };
  const layer = noPrint(STATEMENT_CSS).replace(NIGHT_RE, "").replace(TIDE_RE, "");
  const used = new Set(), css3 = [layer, noPrint(SITE_RECIPES), noPrint(pageCss)];
  for (const css of css3)
    for (const m of css.matchAll(/(?:^|[;{\s])color\s*:\s*var\(--salt-([\w-]+)\)/g)) used.add(m[1]);
  /* a component's tone is a variable it sets to a token (a chip, a ghost, an action's severity): the text is the tokens it is set to */
  for (const tone of ["status-tone", "ghost-tone", "sev"]) {
    if (!used.delete(tone)) continue;
    for (const css of css3) for (const m of css.matchAll(new RegExp("--salt-" + tone + "\\s*:\\s*var\\(--salt-([\\w-]+)\\)", "g"))) used.add(m[1]);
  }
  used.delete("ink-on-accent");   /* the ink on a filled control is measured on its accent below */
  used.delete("slate");           /* the QR panel's title, set on the panel's own paper: measured on it below */
  const resolve = (T, k) => { let v = T[k]; for (let i = 0; i < 6 && /^var\(--salt-([\w-]+)\)$/.test(v || ""); i++) v = T[/^var\(--salt-([\w-]+)\)$/.exec(v)[1]]; return v; };
  const lowest = (T) => {
    const grounds = [T.obsidian, T.slate], rows = [...used].map((k) => { const h = resolve(T, k); return [k, HEX.test(h || "") ? Math.min(...grounds.map((g) => ratio(h, g))) : 0]; });
    return { weak: rows.filter((r) => r[1] < 4.5).map((r) => r[0] + " " + (r[1] ? r[1].toFixed(2) : "unresolved")), min: Math.min(...rows.map((r) => r[1])), low: rows.sort((a, b) => a[1] - b[1])[0] };
  };
  const ln = lowest(NIGHT), lt = lowest(TIDE);
  ok(used.size >= 8 && ["salt", "mist", "brass", "copper", "ember", "verdigris", "steel"].every((k) => used.has(k)),
    `the colours the customer page sets as text are read off its CSS (${used.size}: ${[...used].sort().join(" ")})`);
  ok(ln.weak.length === 0, `every text colour holds 4.5:1 on Night's ground and slate (lowest ${ln.low[0]} ${ln.min.toFixed(2)}; short: ${ln.weak.join(", ") || "none"})`);
  ok(lt.weak.length === 0, `and on Tide's (lowest ${lt.low[0]} ${lt.min.toFixed(2)}; short: ${lt.weak.join(", ") || "none"})`);
  /* the ink on a filled control sits on the ends of the accent gradient (Night's are brass and copper, Tide's two hexes of its own) */
  const ink = (T) => { const ends = /^var\(/.test(((T.gradient || "").split(",")[1] || "").trim()) ? [resolve(T, "brass"), resolve(T, "copper")] : [...(T.gradient || "").matchAll(/#[0-9a-f]{6}/gi)].map((m) => m[0]);
    return ends.length === 2 && ends.every((e) => HEX.test(e || "")) && HEX.test(resolve(T, "ink-on-accent") || "") ? Math.min(...ends.map((e) => ratio(resolve(T, "ink-on-accent"), e))) : 0; };
  const inkN = ink(NIGHT), inkT = ink(TIDE);
  ok(inkN >= 4.5 && inkT >= 4.5, `and the ink on a filled control holds 4.5:1 on the ends of its accent gradient (Night ${inkN.toFixed(2)}, Tide ${inkT.toFixed(2)})`);
  const qrN = ratio(resolve(NIGHT, "slate"), resolve(NIGHT, "qr-field")), qrT = ratio(resolve(TIDE, "slate"), resolve(TIDE, "qr-field"));
  ok(css3.some((c) => /\.salt-qr__title\s*\{[^}]*color:\s*var\(--salt-slate\)/.test(c)) && qrN >= 4.5 && qrT >= 4.5, `and the QR panel's title holds it on the panel's paper, which a code always scans on (Night ${qrN.toFixed(2)}, Tide ${qrT.toFixed(2)})`);

  /* ---- no colour of the page's own is a literal (12 Oct 2026, Phase 5b): the statement layer, its print block included, and the page's CSS read tokens.
     The recipes are the system's own and are held to it in its repo (npm run contrast there). The token blocks are where a colour is declared. ---- */
  const LIT = /#[0-9a-fA-F]{3,8}\b|rgba?\((?!\s*var)[^)]*\)/g;
  const layerAll = strip(STATEMENT_CSS).replace(NIGHT_RE, "").replace(TIDE_RE, "");
  const litLayer = layerAll.match(LIT) || [], litPage = strip(pageCss).match(LIT) || [];
  ok(litLayer.length === 0, `the statement layer writes no colour as a literal, its print block too (found ${litLayer.join(" ") || "none"})`);
  ok(litPage.length === 0, `nor does the page's own CSS, the look swatches included (found ${litPage.join(" ") || "none"})`);
  const flat = layerAll.replace(/\s+/g, " ");
  ok(/body\{ margin:0;padding:22px 18px 60px; color:var\(--salt-text\); background:var\(--salt-obsidian\);/.test(flat) && !/radial-gradient/.test(flat) && !/-rgb\b/.test(layerAll),
    "so the body's ground is the obsidian token, which Tide restates, with no glow of the layer's own (the light is the system's Aurora since 18 Oct 2026, test/counter-page-css.mjs), and reads no pair of channels");
  /* the swatches are the system's four tokens, each theme's ground and accent, the same under either theme; the page writes none and no theme restates them */
  const SWATCHES = ["night-ground", "night-accent", "tide-ground", "tide-accent"];
  ok(SWATCHES.every((k) => pageCss.includes("var(--salt-swatch-" + k + ")")) && !/--look-/.test(pageCss) && !Object.keys(TIDE_OVER).some((k) => /^swatch-/.test(k))
    && NIGHT["swatch-night-ground"] === NIGHT.obsidian && NIGHT["swatch-night-accent"] === NIGHT.brass && NIGHT["swatch-tide-ground"] === TIDE.obsidian && NIGHT["swatch-tide-accent"] === TIDE.brass,
    "the choice sheet's two swatches are each theme's own ground and accent, read from the system's four swatch tokens: " + JSON.stringify(SWATCHES.map((k) => NIGHT["swatch-" + k])));
  /* the print block is drawn in the system's paper inks, the same under both themes (a sheet is not a theme): each text ink holds 4.5:1 on the sheet and on the panels on it */
  const printOf = (css) => { let out = "", rest = strip(css), at; while ((at = rest.search(/@media\s+print\s*\{/)) >= 0) { let d = 0, i = rest.indexOf("{", at); const from = i; for (; i < rest.length; i++) { if (rest[i] === "{") d++; else if (rest[i] === "}" && --d === 0) break; } out += rest.slice(from + 1, i) + " "; rest = rest.slice(i + 1); } return out; };
  const printInk = [...new Set([...printOf(STATEMENT_CSS).matchAll(/(?:^|[;{\s])color\s*:\s*var\(--salt-([\w-]+)\)/g)].map((m) => m[1]))], sheets = ["paper", "paper-card", "paper-warn"];
  const weakPaper = printInk.filter((k) => !HEX.test(NIGHT[k] || "") || sheets.some((s) => !HEX.test(NIGHT[s] || "") || ratio(NIGHT[k], NIGHT[s]) < 4.5));
  ok(printInk.length >= 6 && printInk.every((k) => /^paper-/.test(k)) && weakPaper.length === 0 && !Object.keys(TIDE_OVER).some((k) => /^paper/.test(k)),
    `and the print block's text is the paper inks (${printInk.length}), the same under Tide, each holding 4.5:1 on the sheet and its panels (short: ${weakPaper.join(", ") || "none"})`);

  /* ---- before paint: the head script, and the pages that cannot run one ---- */
  const scripts = [...pageHtml.matchAll(/<script nonce="nct">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const head = pageHtml.indexOf("<head>") >= 0 ? pageHtml.slice(pageHtml.indexOf("<head>"), pageHtml.indexOf("<style")) : "";
  ok(scripts.length === 2 && head.includes(scripts[0]) && !head.includes(scripts[1].slice(0, 80)) && scripts[0].includes("'" + NIGHT.obsidian + "'") && scripts[0].includes("'" + TIDE.obsidian + "'"),
    "the page carries a nonce'd script in its head, ahead of the stylesheet, holding the two themes' grounds in the design system");
  ok(/<html lang="en" translate="no" data-theme="tide">/.test(pageHtml) && pageHtml.includes('<meta name="theme-color" content="' + TIDE.obsidian + '">')
    && (pageHtml.match(/<meta name="theme-color"/g) || []).length === 1,
    "and is served Tide, with one theme-color meta at Tide's ground, for whatever the script then finds");
  const guest = boardPage({ tier: 1, prices: { products: [], week: { label: "this week" } } }, "ng"), shut = shutPage("ns"), lost = notFoundPage("nl");
  const maint = await (maintenance(new Request("https://k7m3p2.example/", { headers: { accept: "text/html" } }), { MAINTENANCE_UNTIL: new Date(Date.now() + 36e5).toISOString() })).text();
  for (const [name, html] of [["a guest board", guest], ["the shut page", shut], ["the 404 page", lost], ["the maintenance page", maint]]) {
    ok(/<html[^>]* data-theme="tide"/.test(html) && html.includes('<meta name="theme-color" content="' + TIDE.obsidian + '">') && !/<script/i.test(html),
      `${name} runs no script and is drawn Tide: data-theme="tide" on the root and Tide's ground in the browser bar`);
  }
  const dsHex = (T, k) => T[k];
  ok(new RegExp("background:[^}]*" + dsHex(TIDE, "obsidian") + ";background-attachment:fixed").test(maint) && !/html\{[^}]*background/.test(maint) && maint.includes("color:" + dsHex(TIDE, "salt")) && ratio(TIDE.salt, TIDE.obsidian) >= 4.5,
    "the maintenance page's own ground, on the canvas, and text are Tide's obsidian and salt in the design system");
  for (const [name, html] of [["a guest board", guest], ["the shut page", shut], ["the 404 page", lost]]) {
    const dom = new JSDOM(html, { url: "https://site.test/g/x", runScripts: "dangerously", beforeParse(w) { w.localStorage.setItem("salt-look", "night"); } });
    ok(dom.window.document.documentElement.getAttribute("data-theme") === "tide", `${name} stays Tide on a device that chose Night: no script can read the choice`);
    dom.window.close();
  }

  /* ---- the signed-in page, in a window: a sign-in against a stubbed Worker, the store seeded or made to throw ---- */
  const U = "ctab-cdef", PASS = "fixture-pass-ct-1", ck = await C.contentKey("test-secret", U);
  const env = (extra) => C.encryptWith(ck, JSON.stringify(Object.assign({ statements: [{ issued: "2026-09-01", label: "September", body: "<p>Statement</p>" }] }, extra || {})));
  const body = async (extra) => ({ ok: true, wrap: await C.wrapKey(PASS, ck), session: "sess-ct", env: await env(extra) });
  const wins = [];
  const open = async ({ store, throws, page, extra, signIn = true } = {}) => {
    const errs = [], vc = new VirtualConsole(); vc.on("jsdomError", (e) => errs.push(String(e.message || e)));
    const b = await body(extra), kept = {};
    const dom = new JSDOM(page || landingPage(U, "nct", null), { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc, beforeParse(win) {
      try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
      win.scrollTo = () => {}; win.HTMLElement.prototype.scrollIntoView = () => {};
      win.addEventListener("error", (e) => errs.push(String(e.message)));
      if (throws) {
        const real = win.localStorage;
        Object.defineProperty(win, "localStorage", { configurable: true, get() { throw new Error("SecurityError"); } });
        void real;
      } else for (const [k, v] of Object.entries(store || {})) win.localStorage.setItem(k, v);
      win.fetch = async (path, init) => {
        const p = String(path), m = (init && init.method) || "GET", reply = (status, j) => ({ ok: status === 200, status, type: "basic", json: async () => j });
        if (p === "/open") return reply(200, b);
        if (p === "/orders" && m === "GET") return reply(200, { ok: true, orders: [] });
        return reply(404, { ok: false });
      };
    } });
    wins.push(dom.window);
    const w = dom.window, d = w.document;
    if (signIn) {
      d.getElementById("un").value = U; d.getElementById("pw").value = PASS;
      d.getElementById("f").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
      await wait(() => !d.getElementById("tabs").hidden);
    }
    const state = () => ({ theme: d.documentElement.getAttribute("data-theme"), bar: d.querySelector('meta[name="theme-color"]').getAttribute("content"),
      sheet: !!d.getElementById("lookSheet") && !d.getElementById("lookSheet").hidden, scrim: !!d.getElementById("lookScrim") && !d.getElementById("lookScrim").hidden,
      kept: throws ? "(unreadable)" : w.localStorage.getItem("salt-look"),
      held: [...d.querySelectorAll("#lookRow [data-look]")].filter((x) => x.getAttribute("aria-pressed") === "true").map((x) => x.dataset.look).join("+") });
    /* the device's look as this window holds it, to open the next window as the same device (not its remembered sign-in) */
    const snap = () => (w.localStorage.getItem("salt-look") === null ? {} : { "salt-look": w.localStorage.getItem("salt-look") });
    return { w, d, dom, errs, state, snap };
  };
  const tap = (d, sel) => { const e = d.querySelector(sel); if (e) e.click(); return !!e; };   /* a missing control is a failed check, not a crash */
  const press = (w, key, o = {}) => w.document.dispatchEvent(new w.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...o }));
  try {
    /* 1. the door, before anyone is signed in: the stored theme, and no sheet */
    const dn = await open({ store: { "salt-look": "night" }, signIn: false }), dt = await open({ signIn: false });
    ok(dn.state().theme === "night" && dn.state().bar === NIGHT.obsidian && !dn.state().sheet, `the door opens Night on a device that chose Night, its bar Night's ground, and asks nothing (${JSON.stringify(dn.state())})`);
    ok(dt.state().theme === "tide" && dt.state().bar === TIDE.obsidian && !dt.state().sheet, `and Tide on a device that chose nothing, still asking nothing before a sign-in (${JSON.stringify(dt.state())})`);

    /* 2. signed in with nothing kept: Tide, and the Sheet over it, once */
    const f = await open({});
    const s0 = f.state();
    ok(s0.theme === "tide" && s0.bar === TIDE.obsidian && s0.sheet && s0.scrim && s0.kept === null, `signed in on a device that chose nothing, the page is Tide with the Sheet over it and nothing yet kept (${JSON.stringify(s0)})`);
    const sh = f.d.getElementById("lookSheet");
    const label = sh && f.d.getElementById(sh.getAttribute("aria-labelledby"));
    ok(sh && sh.getAttribute("role") === "dialog" && sh.getAttribute("aria-modal") === "true" && label && label.textContent.trim() === W.EN["look.sheetH"]
      && [...sh.querySelectorAll("[data-look]")].map((b) => b.dataset.look).join() === "night,tide" && sh.querySelector(".look-swatch--night") && sh.querySelector(".look-swatch--tide")
      && sh.textContent.includes(W.EN["look.note"]) && /Account/.test(sh.textContent),
      "the Sheet is a modal dialog with its heading, a tile for Night and one for Tide each with its swatch, and the line saying where to change it");
    ok(sh && [...sh.querySelectorAll(".salt-option__face--tap")].length === 2 && [...sh.querySelectorAll(".salt-option__label")].map((x) => x.textContent).join() === W.EN["look.night"] + "," + W.EN["look.tide"],
      "its tiles are the system's Option face as a tap, named Night and Tide");
    ok(f.d.activeElement === sh, "the Sheet takes focus as it opens");
    const fb = sh ? [...sh.querySelectorAll("button")] : [];
    if (fb.length) fb[fb.length - 1].focus(); if (sh) sh.dispatchEvent(new f.w.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    ok(fb.length === 3 && f.d.activeElement === fb[0], "Tab from its last control wraps to its first, so focus stays inside it");
    if (sh) sh.dispatchEvent(new f.w.KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }));
    ok(f.d.activeElement === fb[fb.length - 1], "and Shift+Tab from the first wraps to the last");
    ok(f.errs.length === 0, `no error is raised signing in (${f.errs.join(" | ") || "none"})`);

    /* 3. a choice stored: that theme, the setting marked, and no sheet */
    const nn = await open({ store: { "salt-look": "night" } }), tt = await open({ store: { "salt-look": "tide" } });
    ok(nn.state().theme === "night" && nn.state().bar === NIGHT.obsidian && nn.state().held === "night" && !nn.state().sheet, `with night kept the signed-in page is Night, its bar, its setting on Night, no Sheet (${JSON.stringify(nn.state())})`);
    ok(tt.state().theme === "tide" && tt.state().bar === TIDE.obsidian && tt.state().held === "tide" && !tt.state().sheet, `with tide kept it is Tide and asks nothing (${JSON.stringify(tt.state())})`);
    const bad = await open({ store: { "salt-look": "dusk" } });
    ok(bad.state().theme === "tide" && bad.state().bar === TIDE.obsidian && bad.state().sheet, `a value that is not a theme counts as nothing kept: Tide, and the Sheet (${JSON.stringify(bad.state())})`);

    /* 4. choosing on the Sheet applies at once, keeps it, closes it, and is not asked again on that device */
    const c1 = await open({});
    c1.w.__same = 1;
    tap(c1.d, '#lookSheet [data-look="night"]');
    const cn = c1.state();
    ok(cn.theme === "night" && cn.bar === NIGHT.obsidian && cn.held === "night" && cn.kept === "night" && !cn.sheet && !cn.scrim,
      `choosing Night applies it at once with the bar, keeps it, marks the setting and closes the Sheet and its scrim (${JSON.stringify(cn)})`);
    ok(c1.w.__same === 1 && c1.errs.length === 0, `with no reload and no error (${c1.errs.join(" | ") || "none"})`);
    const again = await open({ store: c1.snap() });
    ok(again.state().theme === "night" && !again.state().sheet, "and the next sign-in on that device wears Night and is not asked");
    const c2 = await open({});
    tap(c2.d, '#lookSheet [data-look="tide"]');
    ok(c2.state().kept === "tide" && c2.state().theme === "tide" && !c2.state().sheet && c2.state().held === "tide", "choosing Tide keeps it too, and closes the Sheet");

    /* 5. leaving without choosing keeps Tide, stores nothing, and the next open asks again */
    const e1 = await open({});
    press(e1.w, "Escape");
    const es = e1.state();
    ok(!es.sheet && !es.scrim && es.theme === "tide" && es.kept === null, `Escape closes the Sheet with Tide kept and nothing stored (${JSON.stringify(es)})`);
    ok((await open({ store: e1.snap() })).state().sheet, "and the next open on that device asks again");
    const e2 = await open({});
    tap(e2.d, "#lookX");
    ok(!e2.state().sheet && e2.state().kept === null && e2.state().theme === "tide", "the Close control does the same");
    const e3 = await open({});
    tap(e3.d, "#lookScrim");
    ok(!e3.state().sheet && e3.state().kept === null && e3.state().theme === "tide", "and so does a tap on the scrim");

    /* 5b. a visit asks once: signing out and in again in the same page does not ask a second time */
    const e4 = await open({});
    press(e4.w, "Escape");
    e4.d.getElementById("lock").click(); e4.d.getElementById("lock").click();   /* a tap and a tap again */
    await wait(() => e4.d.getElementById("tabs").hidden && !e4.d.getElementById("gate").hidden);
    e4.d.getElementById("un").value = U; e4.d.getElementById("pw").value = PASS;
    e4.d.getElementById("f").dispatchEvent(new e4.w.Event("submit", { bubbles: true, cancelable: true }));
    await wait(() => !e4.d.getElementById("tabs").hidden);
    ok(!e4.d.getElementById("tabs").hidden && !e4.state().sheet && e4.state().kept === null && e4.state().theme === "tide",
      `a visit asks once: after the Sheet was closed, signing out and in again in the same page does not ask again (${JSON.stringify(e4.state())})`);
    const e5 = await open({});
    ok(e5.state().sheet, "though a sign-out with the Sheet still open takes it down");
    e5.d.getElementById("lock").click(); e5.d.getElementById("lock").click();
    await wait(() => e5.d.getElementById("tabs").hidden);
    ok(e5.d.getElementById("tabs").hidden && !e5.state().sheet && !e5.state().scrim, `so the door is never left under it (${JSON.stringify(e5.state())})`);

    /* 6. the setting under Account: two ghosts in the Account place, at once, kept, no reload */
    const a1 = await open({ store: { "salt-look": "night" } });
    a1.w.__same = 1;
    const row = a1.d.getElementById("lookRow"), btns = row ? [...row.querySelectorAll("[data-look]")] : [];
    ok(row && row.closest("#pStmt") && row.closest("#thisDevice") && !a1.d.getElementById("thisDevice").hidden
      && btns.map((b) => b.dataset.look + ":" + b.textContent.trim()).join() === "night:" + W.EN["look.night"] + ",tide:" + W.EN["look.tide"]
      && btns.every((b) => b.classList.contains("salt-ghost") && b.type === "button") && row.textContent.includes(W.EN["look.h"]),
      "Account's This device holds a Look setting of two ghost buttons, Night and Tide, on the system's 44px recipe");
    const grp = row && row.querySelector('[role="group"]');
    ok(grp && a1.d.getElementById(grp.getAttribute("aria-labelledby")).textContent.trim() === W.EN["look.h"], "grouped and named Look");
    if (btns.length === 2) {
      btns[1].click();
      const t1 = a1.state();
      ok(t1.theme === "tide" && t1.bar === TIDE.obsidian && t1.held === "tide" && t1.kept === "tide", `choosing Tide there changes data-theme, the bar and the held button at once, and keeps it (${JSON.stringify(t1)})`);
      btns[0].click();
      const t2 = a1.state();
      ok(t2.theme === "night" && t2.bar === NIGHT.obsidian && t2.held === "night" && t2.kept === "night", `and back to Night the same way (${JSON.stringify(t2)})`);
      ok(a1.w.__same === 1 && a1.errs.length === 0 && !t2.sheet, `with no reload, no error and no Sheet (${a1.errs.join(" | ") || "none"})`);
    } else ok(false, "Account holds no Look setting of two buttons to choose with");

    /* 7. a store that throws: Tide, no error, no Sheet (the answer could not be kept), and the setting still works for the visit */
    const th = await open({ throws: true });
    const ts = th.state();
    ok(ts.theme === "tide" && ts.bar === TIDE.obsidian && !ts.sheet && th.errs.length === 0, `a device whose store throws opens Tide with no error and no Sheet (${JSON.stringify(ts)}; errors ${th.errs.join(" | ") || "none"})`);
    const thb = th.d.querySelector('#lookRow [data-look="night"]');
    if (thb) thb.click();
    ok(!!thb && th.d.documentElement.getAttribute("data-theme") === "night" && th.state().held === "night" && th.errs.length === 0, `and the setting still changes the visit, whose store refuses the write (errors ${th.errs.join(" | ") || "none"})`);

    /* 8. Salt Admin: the stored theme from the head script (its own Sheet and switch are proved in test/admin-look.mjs) */
    const ownerPage = landingPage("", "nco", { master: "fixture-master", accounts: [] });
    for (const [stored, want] of [[undefined, "tide"], ["night", "night"], ["tide", "tide"], ["dusk", "tide"]]) {
      const dom = new JSDOM(ownerPage, { url: "https://site.test/all", runScripts: "dangerously", pretendToBeVisual: true, beforeParse(w) {
        w.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) }); w.scrollTo = () => {};
        if (stored) w.localStorage.setItem("salt-look", stored);
      } });
      const dd = dom.window.document;
      ok(dd.documentElement.getAttribute("data-theme") === want && dd.querySelector('meta[name="theme-color"]').getAttribute("content") === (want === "night" ? NIGHT.obsidian : TIDE.obsidian),
        `Salt Admin opens ${want} for ${stored === undefined ? "a store with nothing" : "a store holding " + stored}, its bar at that theme's ground`);
      dom.window.close();
    }
    const oThrow = new JSDOM(ownerPage, { url: "https://site.test/all", runScripts: "dangerously", beforeParse(w) {
      w.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) }); w.scrollTo = () => {};
      Object.defineProperty(w, "localStorage", { configurable: true, get() { throw new Error("SecurityError"); } });
    } });
    ok(oThrow.window.document.documentElement.getAttribute("data-theme") === "tide", "and Tide where its store throws");
    oThrow.window.close();

    /* 9. a test account: its sealed bundle says asked, so the Sheet comes at every sign-in whatever the device holds */
    const ta = await open({ store: { "salt-look": "night" }, extra: { look: "asked" } });
    ok(ta.state().sheet && ta.state().theme === "night", `a test account's bundle that says asked opens the Sheet over a device that has chosen (${JSON.stringify(ta.state())})`);
    const tx = await open({ throws: true, extra: { look: "asked" } });
    ok(!tx.state().sheet, "though not where the store cannot be read");
    const all = TF.buildAll(new Date()), f0 = all[Object.keys(all)[0]];
    const look = TF.FEATURES.find(([n]) => /^the look/.test(n));
    ok(look && Object.values(all).every((x) => look[1](x)) && TF.missing(all).length === 0 && !look[1]({ ...f0, look: undefined }),
      "the fixtures hold the case of the look, both accounts, and the line is red without it: " + JSON.stringify(TF.missing(all)));
    const pass = "0000-0000-0000-0000", tck = await C.contentKey("test-secret", "0000-0000"), rec = { test: true, wrap: await C.wrapKey(pass, tck) };
    const sealed = await TF.sealFixture(f0, rec, pass);
    const bundle = JSON.parse(await C.decryptWith(tck, sealed.env));
    ok(bundle.look === "asked" && Array.isArray(bundle.statements), "and the sealed bundle the page opens carries it: " + JSON.stringify(Object.keys(bundle)));

    /* 10. words: every one by key, English, no brand and no product word */
    const KEYS = ["look.h", "look.sheetH", "look.night", "look.tide", "look.note"];
    ok(KEYS.every((k) => typeof W.EN[k] === "string" && W.EN[k].length > 0) && W.EN["look.night"] === "Night" && W.EN["look.tide"] === "Tide" && !KEYS.some((k) => /salt|counter|oil|candy|rice|bronze|silver|gold/i.test(W.EN[k])),
      "the Sheet and the setting are worded by key, plainly, with no brand and no product word");
  } finally { for (const w of wins) { try { w.close(); } catch (e) { /* jsdom */ } } }
}
