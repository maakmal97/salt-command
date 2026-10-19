/* test/counter-today.mjs: THE TODAY CARD AT THE HEAD OF HOME (Counter Batch A, P8, his decisions of 18 Oct 2026, reversing S7 7.5's still
 * card of his D14 of 24 Sep 2026).
 *
 * The card holds the time in Kuala Lumpur, whether the Counter is open and until when or when it opens (read off /hours once signed in), and his
 * notice one line at a time, the next every six seconds, a dot a line and Pause to hold it. Under reduced motion every line stands and no timer,
 * dot or Pause is drawn. Nothing in the card is a live region. The timer is captured, never waited for. Every assertion observes the generated
 * page in jsdom; each was proved red by its own mutation (test/counter-today.mutations.json, run with tools/section.mjs).
 *   1  rotating: one line on, the next after a tick, a dot a line, Pause named and 44px by the recipe, holding it, and saying Play
 *   2  reduced motion: every line, no timer, no dots, no Pause
 *   3  no live region anywhere in the card
 *   4  the open or closed line, off /hours: Open until a time today, Closed and when it opens, nothing while unread */
import { webcrypto } from "node:crypto";

export async function run({ ok }) {
  const P = await import("../stmt/page.js");
  const C = await import("../tools/stmt-crypto.mjs");
  const { JSDOM } = await import("jsdom");
  const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
  const until = async (f, n = 300) => { for (let i = 0; i < n && !f(); i++) await new Promise((r) => setTimeout(r, 15)); return !!f(); };
  const lines = ["Closed Friday", "Open Saturday", "New sizes"];
  const wins = [];
  const bare = (reduce) => {
    const timers = [];
    const dom = new JSDOM(P.landingPage("", "ntd", null, { lines }), { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true, beforeParse(win) {
      win.matchMedia = (q) => ({ matches: !!reduce && /prefers-reduced-motion:\s*reduce/.test(q), media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
      const si = win.setInterval.bind(win);
      win.setInterval = (f, ms) => { if (ms === 6000) { timers.push(f); return 900 + timers.length; } return si(f, ms); };
      win.fetch = async () => ({ ok: false, status: 404, json: async () => ({ ok: false }) });
    } });
    wins.push(dom.window);
    return { d: dom.window.document, timers };
  };
  const on = (d) => [...d.querySelectorAll("#bull .salt-notice__line")].map((p, i) => (p.classList.contains("salt-notice__line--on") ? i : -1)).filter((i) => i >= 0);
  try {
    /* ---- 1: rotating ---- */
    const M = bare(false), pz = M.d.querySelector("#bull .salt-notice__pause"), dots = M.d.querySelectorAll("#bull .salt-notice__dot");
    ok(M.timers.length === 1 && JSON.stringify(on(M.d)) === "[0]" && M.d.querySelectorAll("#bull .salt-notice__line").length === 3 && dots.length === 3
      && dots[0].classList.contains("salt-notice__dot--on") && !!pz && !pz.hidden && pz.getAttribute("aria-label") === "Pause notices" && pz.classList.contains("salt-notice__pause"),
      "the notice shows one line at a time with a dot a line, one six-second timer and Pause, named: " + JSON.stringify([M.timers.length, on(M.d), dots.length]));
    M.timers[0]();
    ok(JSON.stringify(on(M.d)) === "[1]" && M.d.querySelectorAll("#bull .salt-notice__dot")[1].classList.contains("salt-notice__dot--on"), "after six seconds the next line and its dot are on: " + JSON.stringify(on(M.d)));
    M.timers[0](); M.timers[0]();
    ok(JSON.stringify(on(M.d)) === "[0]", "and after the last it comes round to the first");
    pz.click(); M.timers[0](); M.timers[0]();
    ok(JSON.stringify(on(M.d)) === "[0]" && pz.getAttribute("aria-pressed") === "true" && pz.getAttribute("aria-label") === "Play notices",
      "Pause holds the line on screen, says it is pressed, and is then named Play: " + JSON.stringify([on(M.d), pz.getAttribute("aria-label")]));
    pz.click(); M.timers[0]();
    ok(JSON.stringify(on(M.d)) === "[1]" && pz.getAttribute("aria-pressed") === "false", "and a second tap lets it turn again");

    /* ---- 2: reduced motion ---- */
    const S = bare(true), spz = S.d.querySelector("#bull .salt-notice__pause");
    ok(S.timers.length === 0 && S.d.querySelectorAll("#bull .salt-notice__line").length === 3 && S.d.querySelectorAll("#bull .salt-notice__dot").length === 0 && !!spz && spz.hidden,
      "under reduced motion no timer runs, every line is drawn and neither the dots nor Pause is: " + JSON.stringify([S.timers.length, S.d.querySelectorAll("#bull .salt-notice__dot").length]));
    const one = bare(false); one.d.defaultView.bullDraw({ lines: ["Only line"] });
    ok(one.d.querySelector("#bull .salt-notice__pause").hidden && one.d.querySelectorAll("#bull .salt-notice__dot").length === 0 && JSON.stringify(on(one.d)) === "[0]",
      "a notice of one line stands, with no dots and no Pause");

    /* ---- 3: no live region ---- */
    const live = [M.d, S.d].flatMap((d) => [...d.querySelectorAll("#today, #today *")].filter((e) => e.hasAttribute("aria-live") || /^(status|alert|log|marquee|timer)$/.test(e.getAttribute("role") || "")));
    ok(live.length === 0 && !!M.d.querySelector("#pHome #today #bull") && !!M.d.querySelector("#today [data-clock]"),
      "the card is Home's first, holds the clock and the notice, and nothing in it is a live region: " + live.length);
    /* the render pass of 19 Oct 2026: the card wears the system's padding, and on Home the header does not say the time twice */
    /* read off the served sheet: jsdom's parser drops part of this stylesheet, which a browser applies */
    const css = [...P.landingPage("", "ntd3", null, null).matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
    const once = css.match(/\.cshell\[data-place=home\] \.chead \.cclock\{([^}]*)\}/g) || [];
    ok(M.d.getElementById("today").classList.contains("salt-glass-card--pad-sm") && once.length === 1 && /display:none/.test(once[0]),
      "the card is padded by the system's own modifier, and on Home the header's clock gives way to the card's: " + JSON.stringify(once));

    /* ---- 4: open or closed, off /hours ---- */
    const u = "abcd-efgh", pass = "fixture-pass-p8", ck = await C.contentKey("test-secret", u);
    const prices = { at: new Date().toISOString(), week: { monday: "2026-10-12", label: "12 to 18 Oct 2026" }, soon: [], products: [{ product: "salt", unit: "unit", basis: "yours", rate: 10, orders: 1, sizes: [{ q: 1, price: 10 }] }] };
    const opened = { ok: true, assoc: false, wrap: await C.wrapKey(pass, ck), session: "sess-p8-abcdefghij", env: await C.encryptWith(ck, JSON.stringify({ statements: [] })), prices: await C.encryptWith(ck, JSON.stringify(prices)) };
    const hm = (iso) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
    const sameDay = (iso) => { const f = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur" }); return f.format(new Date(iso)) === f.format(new Date()); };
    const signed = async (hours) => {
      const dom = new JSDOM(P.landingPage(u, "ntd2", null, { lines }), { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true, beforeParse(win) {
        try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
        win.scrollTo = () => {};
        win.fetch = async (path) => { const p = String(path);
          if (p === "/open" || p === "/account") return { ok: true, status: 200, json: async () => opened };
          if (p === "/orders") return { ok: true, status: 200, json: async () => ({ ok: true, orders: [], claims: [] }) };
          if (p === "/hours" && hours) return { ok: true, status: 200, type: "basic", json: async () => hours };
          return { ok: false, status: 404, json: async () => ({ ok: false }) }; };
      } });
      wins.push(dom.window);
      const d = dom.window.document;
      d.getElementById("un").value = u; d.getElementById("pw").value = pass;
      d.getElementById("f").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
      await until(() => d.querySelector("#pPrices .pmark"));
      if (hours) await until(() => !d.getElementById("todayOpen").hidden);
      else await new Promise((r) => setTimeout(r, 200));
      return d;
    };
    const soon = new Date(Date.now() + 20 * 60e3).toISOString();
    const dO = await signed({ ok: true, open: true, nextChange: soon, nextOpen: null });
    const wantO = sameDay(soon) ? "Until " + hm(soon) + ". Order now and we confirm it today." : null;
    ok(t(dO.getElementById("todayOpen")) === "Open" && dO.getElementById("todayOpen").classList.contains("salt-status--verdigris")
      && (wantO ? t(dO.getElementById("todayLine")) === wantO : /^Until \d\d \w{3} \d{4}, \d\d:\d\d\. Order now/.test(t(dO.getElementById("todayLine")))),
      "while it is open the card says Open and until when, off /hours: " + t(dO.getElementById("todayLine")));
    const later = new Date(Date.now() + 3 * 864e5).toISOString();
    const dC = await signed({ ok: true, open: false, nextChange: later, nextOpen: later });
    ok(t(dC.getElementById("todayOpen")) === "Closed" && /^Opens \d\d \w{3} \d{4}, \d\d:\d\d\. You can still order; we confirm it then\.$/.test(t(dC.getElementById("todayLine"))),
      "while it is closed the card says Closed and when it opens: " + t(dC.getElementById("todayLine")));
    const dN = await signed(null);
    ok(dN.getElementById("todayOpen").hidden && dN.getElementById("todayLine").hidden, "and while the hours are not read it says neither");
  } catch (e) { ok(false, "counter-today stopped on an error: " + (e && e.stack)); }
  finally { wins.forEach((w) => w.close()); }
}
