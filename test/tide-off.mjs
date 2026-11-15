/* test/tide-off.mjs: TIDE IS OFF FOR NOW (his word of 19 Oct 2026). Every device opens Night on the Desk, the Counter and Salt Admin,
 * whatever it kept; the Tide button stays in view, greyed (disabled); no choice Sheet opens, since there is nothing to choose; the
 * stored choice is left as it was and Tide's tokens stay in the stylesheets. 15 Nov 2026, the move to Ambient: the Counter and Salt Admin
 * follow each device, light or dark, and their part below asserts that. The two-themes sections are parked behind TIDE_OFF until
 * Tide returns. Each check is proved red by its own mutation (test/tide-off.mutations.json, run with tools/section.mjs). */
import { webcrypto } from "node:crypto";

const wait = async (f, n = 400) => { for (let i = 0; i < n && !f(); i++) await new Promise((r) => setTimeout(r, 15)); return f(); };
export const TIDE_OFF = true;

export async function run({ ok, master }) {
  const NIGHT_BAR = "#05080a";

  const { readFileSync } = await import("node:fs");
  const metas = readFileSync(master, "utf8").match(/<meta name="theme-color" content="[^"]*">/g) || [];
  ok(metas.length === 1 && metas[0].includes(NIGHT_BAR), `the Desk's browser bar starts at Night's ground before any script (read ${metas.join(" ") || "none"})`);

  /* the Desk: a device that kept Tide, and one that kept nothing */
  const { openMaster } = await import("../tools/payload.mjs");
  for (const store of [{ "salt-look": "tide" }, {}]) {
    const { w } = await openMaster(master, { fresh: true, before: (_w, s) => { for (const [k, v] of Object.entries(store)) s.set(k, v); } });
    const d = w.document, tide = d.querySelector('.look-switch [data-look="tide"]'), night = d.querySelector('.look-switch [data-look="night"]');
    const tag = JSON.stringify(store);
    ok(d.documentElement.getAttribute("data-theme") === "night" && d.querySelector('meta[name="theme-color"]').getAttribute("content") === NIGHT_BAR,
      `the Desk opens Night with Night's bar on a device that kept ${tag} (read ${d.documentElement.getAttribute("data-theme")})`);
    ok(!d.getElementById("lookSheet"), `and no choice Sheet opens over it (${tag})`);
    ok(tide && tide.disabled && night && !night.disabled && night.getAttribute("aria-pressed") === "true", `and the rail's Tide button is greyed, Night held (${tag})`);
    if (tide) { tide.disabled = false; tide.click(); }
    ok(d.documentElement.getAttribute("data-theme") === "night" && w.localStorage.getItem("salt-look") === (store["salt-look"] || null),
      `and a forced tap on Tide changes nothing, the stored choice left as it was (${tag})`);
    w.close();
  }

  /* 15 NOV 2026, THE MOVE TO AMBIENT (his answer of 14 Nov 2026): THE COUNTER AND SALT ADMIN FOLLOW EACH DEVICE, light or dark. Their Night and
     Tide are gone with the look's store, its row and its Sheet: signed in on a device that kept Tide, and on one that kept nothing, no theme is
     set on the root, the browser bar is Ambient's base in each scheme, nothing asks, and the stored choice is never read or written. The Desk,
     above, is unchanged until its own move. */
  const { landingPage, DOC_OPEN } = await import("../stmt/page.js");
  const { AMB_THEME } = await import("../stmt/statement-css.js");
  const C = await import("../tools/stmt-crypto.mjs");
  const { JSDOM, VirtualConsole } = await import("jsdom");
  const U = "ctab-cdef", PASS = "fixture-pass-ct-1", ck = await C.contentKey("test-secret", U);
  const env = await C.encryptWith(ck, JSON.stringify({ statements: [{ issued: "2026-09-01", label: "September", body: "<p>Statement</p>" }] }));
  const b = { ok: true, wrap: await C.wrapKey(PASS, ck), session: "sess-ct", env };
  const bars = (d) => [...d.querySelectorAll('meta[name="theme-color"]')].map((m) => (m.getAttribute("media") || "") + "=" + m.getAttribute("content")).join(" ");
  const BARS = "(prefers-color-scheme: light)=" + AMB_THEME.light + " (prefers-color-scheme: dark)=" + AMB_THEME.dark;
  for (const owner of [null, { master: "m", accounts: [] }]) for (const store of [{ "salt-look": "tide" }, {}]) {
    const vc = new VirtualConsole(), wrote = [];
    const dom = new JSDOM(landingPage(U, "nct", owner), { url: "https://site.test/" + (owner ? "all" : ""), runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc, beforeParse(win) {
      try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
      win.scrollTo = () => {}; win.HTMLElement.prototype.scrollIntoView = () => {};
      for (const [k, v] of Object.entries(store)) win.localStorage.setItem(k, v);
      const set = win.Storage.prototype.setItem, get = win.Storage.prototype.getItem;
      win.Storage.prototype.setItem = function (k, v) { if (/look/.test(k)) wrote.push("set " + k); return set.call(this, k, v); };
      win.Storage.prototype.getItem = function (k) { if (/look/.test(k)) wrote.push("get " + k); return get.call(this, k); };
      win.fetch = async (path, init) => {
        const p = String(path), m = (init && init.method) || "GET", reply = (status, j) => ({ ok: status === 200, status, type: "basic", json: async () => j });
        if (p === "/open") return reply(200, b);
        if (p === "/orders" && m === "GET") return reply(200, { ok: true, orders: [] });
        return reply(404, { ok: false });
      };
    } });
    const w = dom.window, d = w.document, tag = (owner ? "Salt Admin, " : "the Counter, ") + JSON.stringify(store);
    if (!owner) {
      d.getElementById("un").value = U; d.getElementById("pw").value = PASS;
      d.getElementById("f").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
      await wait(() => !d.getElementById("tabs").hidden);
    } else await wait(() => !!d.querySelector('#roster .amb-tab[aria-current="page"]'));
    ok(!d.documentElement.hasAttribute("data-theme") && !d.body.hasAttribute("data-theme") && bars(d) === BARS
      && d.querySelector('meta[name="color-scheme"]').getAttribute("content") === "light dark",
      `${tag}: no theme is set on the page, which follows the device, its bar Ambient's base in each scheme (${bars(d)})`);
    ok((owner ? !d.getElementById("roster").hidden : !d.getElementById("tabs").hidden) && !d.getElementById("lookSheet") && !d.getElementById("lookRow") && !d.querySelector("[data-look]"),
      `${tag}: and nothing asks for a look, under This device or in a Sheet`);
    ok(wrote.length === 0 && w.localStorage.getItem("salt-look") === (store["salt-look"] || null),
      `${tag}: and the stored choice is left as it was, never read or written (${wrote.join(", ") || "untouched"})`);
    w.close();
  }
  /* a page served without script (a guest board, the shut page) follows the device too */
  ok(!/data-theme/.test(DOC_OPEN) && DOC_OPEN.includes('<meta name="color-scheme" content="light dark">')
    && DOC_OPEN.includes('<meta name="theme-color" media="(prefers-color-scheme: light)" content="' + AMB_THEME.light + '">')
    && DOC_OPEN.includes('<meta name="theme-color" media="(prefers-color-scheme: dark)" content="' + AMB_THEME.dark + '">'),
    "every page of the site is served for light and dark, its bar Ambient's base in each");

}
