/* test/test-surface-shell.mjs: P7 of the Counter test surface (his answers of 18 Oct 2026, Asks 1, 3, 8 and 10). The shell at /all/test.
   1. it is served inside /all's gate alone, its frames this origin's, and says where each test account stands: ready, made and waiting
      for the publish, or not made;
   2. its frames are the two views, the customer's on the account chosen (the fresh one first) and Counter Admin's; choosing another
      account moves the customer's view; Make shows only for an account not made, Start empty only on the fresh one;
   3. Reset asks once: the first tap clears nothing and says so on the control, a second within four seconds resets that account and
      both views read it again, and left alone it lets go;
   4. Reset all resets every test account, and Start empty asks once and starts the fresh one empty;
   5. every control is 44px both ways;
   6. the two views stand side by side from 1080px with no tabs, and below it are two tabs showing one view at a time;
   7. its text holds 4.5:1 on Night's and Tide's ground and slate;
   8. it carries no brand but Salt Counter, no product word and no roster code. */
import { surface } from "./test-surface-harness.mjs";

export async function run({ ok }) {
  const T = await import("../stmt/testsurface.js");
  const { TS } = await import("../stmt/words.js");
  const { STATEMENT_CSS } = await import("../stmt/statement-css.js");
  const O = await import("../src/orders.js");
  const { JSDOM } = await import("jsdom");
  const until = async (f, n = 100) => { for (let i = 0; i < n && !f(); i++) await new Promise((r) => setTimeout(r, 10)); return f(); };

  /* ---- 1: the route */
  const s = await surface();
  let html = "";
  try {
    await s.putFixture("0000-0000", {});
    await s.store.put("u:0000-0001", JSON.stringify({ test: true, wrap: { salt: "x" } }));
    const none = await s.owner("/all/test", undefined, "", "GET"), other = await s.owner("/all/test", undefined, await s.token("someone@example.test"), "GET");
    const r = await s.owner("/all/test", undefined, s.jwt, "GET"); html = await r.text();
    const csp = r.headers.get("content-security-policy") || "", st = JSON.parse((/STATE=(\{[^}]*\})/.exec(html) || [0, "{}"])[1]);
    ok(none.status === 401 && other.status === 401 && r.status === 200 && /frame-src 'self'/.test(csp) && /frame-ancestors 'none'/.test(csp) && /script-src 'nonce-/.test(csp)
      && st["0000-0000"] === "ready" && st["0000-0001"] === "waiting" && st["0000-0002"] === "none",
      "The shell is served inside /all's gate alone, its frames this origin's, and says where each test account stands: " + JSON.stringify([none.status, other.status, r.status, st]));
  } finally { s.close(); }

  /* the shell in a window, its fetch and its four-second timer held */
  const open = (state, width) => {
    const posts = [], timers = [];
    let page = T.testShell("ns", state);
    if (width) page = page.replace(/@media\s*\(min-width:(\d+)px\)\s*\{/g, (m, px) => (width >= +px ? "@media all{" : m));
    const dom = new JSDOM(page, { url: "https://site.test/all/test", runScripts: "dangerously", pretendToBeVisual: true, beforeParse(win) {
      win.fetch = async (path, init) => { posts.push([String(path), JSON.parse(init.body)]); return { ok: true, status: 200, json: async () => ({ ok: true }) }; };
      const st = win.setTimeout.bind(win);
      win.setTimeout = (f, ms) => { if (ms === T.RESET_ARM_MS) { timers.push(f); return timers.length; } return st(f, ms); };
      win.clearTimeout = () => {};
    } });
    return { w: dom.window, d: dom.window.document, posts, timers, close: () => dom.window.close() };
  };
  const all = { "0000-0000": "ready", "0000-0001": "ready", "0000-0002": "ready" };

  /* ---- 2: the frames */
  const A = open({ ...all, "0000-0001": "none" });
  try {
    const cSrc = () => A.d.getElementById("tsC").getAttribute("src"), aSrc = () => A.d.getElementById("tsA").getAttribute("src");
    const first = [cSrc(), aSrc(), A.d.getElementById("tsMake").hidden, A.d.getElementById("tsEmpty").hidden];
    const pickU = (u) => { const r = A.d.querySelector('input[name="tsAcct"][value="' + u + '"]'); r.checked = true; r.dispatchEvent(new A.w.Event("change", { bubbles: true })); };
    pickU("0000-0001");
    const locked = [cSrc(), A.d.getElementById("tsMake").hidden, A.d.getElementById("tsEmpty").hidden, A.d.getElementById("tsSay").textContent];
    pickU("0000-0000");
    const open0 = [cSrc(), A.d.getElementById("tsMake").hidden];
    ok(first[0] === "/all/test/c?u=0000-0002" && first[1] === "/all/test/admin" && first[2] === true && first[3] === false
      && locked[0] === "/all/test/c?u=0000-0001" && locked[1] === false && locked[2] === true && locked[3] === TS["ts.none"] && open0[0] === "/all/test/c?u=0000-0000" && open0[1] === true,
      "Its frames are the customer's view on the account chosen, fresh first, and Counter Admin's; Make only for an account not made, Start empty only on the fresh one: " + JSON.stringify([first, locked, open0]));

    /* ---- 3: Reset asks once */
    const reset = A.d.getElementById("tsReset");
    A.d.getElementById("tsC").setAttribute("src", "about:blank");
    reset.click();
    const armed = [A.posts.length, reset.textContent];
    (A.timers.shift() || (() => {}))();   /* left alone, it lets go */
    const letGo = reset.textContent;
    reset.click(); reset.click();
    await until(() => A.posts.length === 1 && A.d.getElementById("tsSay").textContent === TS["ts.done"]);
    ok(armed[0] === 0 && armed[1] === TS["ts.ask"] && letGo === TS["ts.reset"] && A.posts.length === 1 && A.posts[0][0] === "/all/test/reset"
      && JSON.stringify(A.posts[0][1]) === '{"u":"0000-0000"}' && A.d.getElementById("tsC").getAttribute("src") === "/all/test/c?u=0000-0000" && A.d.getElementById("tsSay").textContent === TS["ts.done"],
      "Reset asks once: the first tap clears nothing and says so, left alone it lets go, and a second tap resets that account and both views read it again: " + JSON.stringify([armed, letGo, A.posts]));

    /* ---- 4: Reset all and Start empty */
    A.d.getElementById("tsAll").click(); A.d.getElementById("tsAll").click();
    await until(() => A.posts.length === 2);
    const pickF = A.d.querySelector('input[name="tsAcct"][value="0000-0002"]'); pickF.checked = true; pickF.dispatchEvent(new A.w.Event("change", { bubbles: true }));
    A.d.getElementById("tsEmpty").click();
    const emptyArmed = A.posts.length;
    A.d.getElementById("tsEmpty").click();
    await until(() => A.posts.length === 3);
    ok(JSON.stringify(A.posts[1][1]) === '{"all":true}' && emptyArmed === 2 && JSON.stringify(A.posts[2][1]) === '{"u":"0000-0002","empty":true}',
      "Reset all resets every test account, and Start empty asks once and starts the fresh one empty: " + JSON.stringify(A.posts.map((p) => p[1])));

    /* ---- 5: 44px */
    const tap = (/--salt-tap:\s*([^;]+);/.exec(STATEMENT_CSS) || [])[1];
    const controls = [...A.d.querySelectorAll("button, a, .salt-option__face")];
    const short = controls.filter((e) => { const c = A.w.getComputedStyle(e); return c.minHeight !== "var(--salt-tap)" || c.minWidth !== "var(--salt-tap)"; }).map((e) => e.id || e.textContent);
    ok(tap === "44px" && controls.length >= 9 && short.length === 0, "Every control is 44px both ways: " + JSON.stringify([tap, controls.length, short]));
  } finally { A.close(); }

  /* ---- 6: the layout */
  const P6 = open(all, 390), D = open(all, 1280);
  try {
    const cs = (x, sel) => x.w.getComputedStyle(x.d.querySelector(sel));
    const phone = [cs(P6, ".ts-tabs").display, cs(P6, "#tsC").display, cs(P6, "#tsA").display];
    P6.d.querySelector('.ts-tabs [data-view="a"]').click();
    const phoneA = [cs(P6, "#tsC").display, cs(P6, "#tsA").display, P6.d.querySelector('.ts-tabs [data-view="a"]').getAttribute("aria-selected")];
    const desk = [cs(D, ".ts-tabs").display, cs(D, ".ts-views").display, cs(D, ".ts-views").gridTemplateColumns, cs(D, "#tsC").display, cs(D, "#tsA").display];
    ok(phone[0] === "flex" && phone[1] !== "none" && phone[2] === "none" && phoneA[0] === "none" && phoneA[1] !== "none" && phoneA[2] === "true"
      && desk[0] === "none" && desk[1] === "grid" && desk[2] === "1fr 1fr" && desk[3] !== "none" && desk[4] !== "none",
      "The two views stand side by side from 1080px with no tabs, and below it two tabs show one view at a time: " + JSON.stringify([phone, phoneA, desk]));
  } finally { P6.close(); D.close(); }

  /* ---- 7: contrast */
  const strip = (c) => c.replace(/\/\*[\s\S]*?\*\//g, "");
  const toks = (re) => Object.fromEntries([...((strip(STATEMENT_CSS).match(re) || ["", ""])[1]).matchAll(/--salt-([\w-]+):\s*([^;]+);/g)].map((x) => [x[1], x[2].trim()]));
  const NIGHT = toks(/:root\s*\{([^}]*)\}/), TIDE = { ...NIGHT, ...toks(/:root\[data-theme="tide"\]\s*\{([^}]*)\}/) };
  const resolve = (Tk, k) => { let v = Tk[k]; for (let i = 0; i < 6 && /^var\(--salt-([\w-]+)\)$/.test(v || ""); i++) v = Tk[/^var\(--salt-([\w-]+)\)$/.exec(v)[1]]; return v; };
  const lum = (hx) => { const c = [1, 3, 5].map((i) => parseInt(hx.slice(i, i + 2), 16) / 255).map((v) => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const shellCss = (/(body\{margin:0;[\s\S]*)$/.exec((html.match(/<style[^>]*>([\s\S]*?)<\/style>/) || ["", ""])[1]) || ["", ""])[1];
  const used = [...new Set([...shellCss.matchAll(/(?:^|[;{\s])color\s*:\s*var\(--salt-([\w-]+)\)/g)].map((m) => m[1]))];
  const low = (Tk) => Math.min(...used.flatMap((k) => [Tk.obsidian, Tk.slate].map((g) => /^#[0-9a-f]{6}$/i.test(resolve(Tk, k) || "") ? ratio(resolve(Tk, k), g) : 0)));
  ok(used.length >= 2 && used.includes("mist") && low(NIGHT) >= 4.5 && low(TIDE) >= 4.5,
    "Its text holds 4.5:1 on Night's and Tide's ground and slate: " + JSON.stringify([used, low(NIGHT).toFixed(2), low(TIDE).toFixed(2)]));

  /* ---- 8: words */
  const text = Object.values(TS).join(" ") + " " + new JSDOM(html).window.document.body.textContent;
  const brands = (text.match(/Salt [A-Z][a-z]+/g) || []).filter((b) => b !== "Salt Counter");
  ok(brands.length === 0 && !/Salt Command|Salt Account|Salt Desk/i.test(html) && !O.wordsIn(text, O.PRODUCT_WORDS).length && !/\bsalt\b/i.test(text.replace(/Salt Counter/g, ""))
    && !/\b[A-Z]{2}\d-[A-Z]{2,4}\b/.test(text),
    "It carries no brand but Salt Counter, no product word and no roster code: " + JSON.stringify([brands, O.wordsIn(text, O.PRODUCT_WORDS)]));
}
