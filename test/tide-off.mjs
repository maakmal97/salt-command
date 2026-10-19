/* test/tide-off.mjs: TIDE IS OFF FOR NOW (his word of 19 Oct 2026). Every device opens Night on the Desk, the Counter and Salt Admin,
 * whatever it kept; the Tide button stays in view, greyed (disabled); no choice Sheet opens, since there is nothing to choose; the
 * stored choice is left as it was and Tide's tokens stay in the stylesheets. The two-themes sections are parked behind TIDE_OFF until
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

  /* the Counter: signed in on a device that kept Tide, and on one that kept nothing */
  const { landingPage } = await import("../stmt/page.js");
  const C = await import("../tools/stmt-crypto.mjs");
  const { JSDOM, VirtualConsole } = await import("jsdom");
  const U = "ctab-cdef", PASS = "fixture-pass-ct-1", ck = await C.contentKey("test-secret", U);
  const env = await C.encryptWith(ck, JSON.stringify({ statements: [{ issued: "2026-09-01", label: "September", body: "<p>Statement</p>" }] }));
  const b = { ok: true, wrap: await C.wrapKey(PASS, ck), session: "sess-ct", env };
  for (const store of [{ "salt-look": "tide" }, {}]) {
    const vc = new VirtualConsole();
    const dom = new JSDOM(landingPage(U, "nct", null), { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc, beforeParse(win) {
      try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
      win.scrollTo = () => {}; win.HTMLElement.prototype.scrollIntoView = () => {};
      for (const [k, v] of Object.entries(store)) win.localStorage.setItem(k, v);
      win.fetch = async (path, init) => {
        const p = String(path), m = (init && init.method) || "GET", reply = (status, j) => ({ ok: status === 200, status, type: "basic", json: async () => j });
        if (p === "/open") return reply(200, b);
        if (p === "/orders" && m === "GET") return reply(200, { ok: true, orders: [] });
        return reply(404, { ok: false });
      };
    } });
    const w = dom.window, d = w.document, tag = JSON.stringify(store);
    d.getElementById("un").value = U; d.getElementById("pw").value = PASS;
    d.getElementById("f").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
    await wait(() => !d.getElementById("tabs").hidden);
    const sh = d.getElementById("lookSheet"), tide = d.querySelector('#lookRow [data-look="tide"]'), night = d.querySelector('#lookRow [data-look="night"]');
    ok(d.documentElement.getAttribute("data-theme") === "night" && d.querySelector('meta[name="theme-color"]').getAttribute("content") === NIGHT_BAR,
      `the Counter opens Night with Night's bar on a device that kept ${tag} (read ${d.documentElement.getAttribute("data-theme")})`);
    ok(!d.getElementById("tabs").hidden && sh && sh.hidden, `and no choice Sheet opens once signed in (${tag})`);
    ok(tide && tide.disabled && night && !night.disabled && night.getAttribute("aria-pressed") === "true", `and This device's Tide button is greyed, Night held (${tag})`);
    if (tide) { tide.disabled = false; tide.click(); }
    ok(d.documentElement.getAttribute("data-theme") === "night" && w.localStorage.getItem("salt-look") === (store["salt-look"] || null),
      `and a forced tap on Tide changes nothing, the stored choice left as it was (${tag})`);
    w.close();
  }
  /* a page served without script (a guest board, the shut page) starts at Night too */
  const { DOC_OPEN } = await import("../stmt/page.js");
  ok(DOC_OPEN.includes('data-theme="night"') && DOC_OPEN.includes('content="' + NIGHT_BAR + '"'), "every Counter page is served Night, its bar Night's ground");
}
