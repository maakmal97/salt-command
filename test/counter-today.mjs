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
 *   4  the open or closed chip and its time, off /hours: Open and until a time today, Closed and when it opens, nothing while unread, forgotten at Log out
 * 22 Nov 2026 (the place head, with the reviewer's findings of the same day): the chip is the status row's (#cOpen, under the title on every place), a dot and its
 * word alone; when it changes is its own span beside it (#cWhen: until 22:00, opens Tue 09:00, opens 2 Dec), which a phone keeps; "Signed in as" is the word a phone drops.
 * The Today card keeps only what it means for an order (#todayLine) and stands while that or the notice has something to say. */
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
  /* 16 Nov 2026, the move to Ambient: the card is one notice, its lines spans (.hline) the turned-away ones hidden, Pause a quiet pill, and no dots */
  const on = (d) => [...d.querySelectorAll("#bull .hline")].map((p, i) => (p.hidden ? -1 : i)).filter((i) => i >= 0);
  try {
    /* ---- 1: rotating ---- */
    const M = bare(false), pz = M.d.querySelector("#bull .hpause");
    ok(M.timers.length === 1 && JSON.stringify(on(M.d)) === "[0]" && M.d.querySelectorAll("#bull .hline").length === 3
      && !!pz && !pz.hidden && pz.getAttribute("aria-label") === "Pause notices" && pz.classList.contains("amb-pill") && pz.textContent === "Pause notices",
      "the notice shows one line at a time, one six-second timer and Pause, a pill named: " + JSON.stringify([M.timers.length, on(M.d)]));
    M.timers[0]();
    ok(JSON.stringify(on(M.d)) === "[1]", "after six seconds the next line is the one shown: " + JSON.stringify(on(M.d)));
    M.timers[0](); M.timers[0]();
    ok(JSON.stringify(on(M.d)) === "[0]", "and after the last it comes round to the first");
    pz.click(); M.timers[0](); M.timers[0]();
    ok(JSON.stringify(on(M.d)) === "[0]" && pz.getAttribute("aria-pressed") === "true" && pz.getAttribute("aria-label") === "Play notices" && pz.textContent === "Play notices",
      "Pause holds the line on screen, says it is pressed, and is then named Play: " + JSON.stringify([on(M.d), pz.getAttribute("aria-label")]));
    pz.click(); M.timers[0]();
    ok(JSON.stringify(on(M.d)) === "[1]" && pz.getAttribute("aria-pressed") === "false", "and a second tap lets it turn again");

    /* ---- 2: reduced motion ---- */
    const S = bare(true), spz = S.d.querySelector("#bull .hpause");
    ok(S.timers.length === 0 && JSON.stringify(on(S.d)) === "[0,1,2]" && !!spz && spz.hidden,
      "under reduced motion no timer runs, every line stands on the screen and Pause is not drawn: " + JSON.stringify([S.timers.length, on(S.d)]));
    const one = bare(false); one.d.defaultView.bullDraw({ lines: ["Only line"] });
    ok(one.d.querySelector("#bull .hpause").hidden && JSON.stringify(on(one.d)) === "[0]",
      "a notice of one line stands, with no Pause");
    const none = bare(false); none.d.defaultView.bullDraw({ lines: [] });
    ok(none.d.getElementById("today").hidden && !one.d.getElementById("today").hidden, "with no notice and no hours read the card is not drawn, and a notice brings it");

    /* ---- 3: no live region ---- */
    const live = [M.d, S.d].flatMap((d) => [...d.querySelectorAll("#today, #today *")].filter((e) => e.hasAttribute("aria-live") || /^(status|alert|log|marquee|timer)$/.test(e.getAttribute("role") || "")));
    ok(live.length === 0 && !!M.d.querySelector("#pHome #today #bull") && !M.d.querySelector("#today [data-clock]") && !M.d.querySelector(".amb-hero > .amb-hero__time, .amb-hero [data-clock]"),
      /* 17 Nov 2026, the move to Ambient (Fable's review): the Counter's hero carries no bare clock any more, so the card and the hero say no time */
      "the card is Home's first and holds the notice, the Counter's hero says no time, and nothing in the card is a live region: " + live.length);
    /* the render pass of 19 Oct 2026: the card wears the system's padding, and on Home the header does not say the time twice */
    /* read off the served sheet: jsdom's parser drops part of this stylesheet, which a browser applies */
    const css = [...P.landingPage("", "ntd3", null, null).matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
    /* 16 Nov 2026, the move to Ambient: the card is Ambient's notice, and the hero's time line is the one clock, so no rule hides it on Home */
    const once = css.match(/#tabs\[data-place="home"\] > \.amb-screen > \.amb-hero > \.amb-hero__time \{([^}]*)\}/g) || [];
    ok(M.d.getElementById("today").classList.contains("amb-notice") && once.length === 0,
      "the card is Ambient's notice, and no rule stands for a clock in the hero (17 Nov 2026, Fable's review: it is not drawn): " + JSON.stringify(once));

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
      if (hours) await until(() => !d.getElementById("cOpen").hidden);   /* 22 Nov 2026 (the place head): the chip stands once the hours are read */
      else await new Promise((r) => setTimeout(r, 200));
      return d;
    };
    /* 22 Nov 2026 (the place head, the reviewer's findings): the chip (#cOpen) is a dot and its word alone, Open or Closed; when it changes is its own span beside it
       (#cWhen, a time, never a word a phone drops): until 22:00 or opens 08:00 on the same day, else the C17 date and time, until 25 Nov 2026, 09:00 (the page's stamp, a
       three-letter month of its own: toLocaleDateString says Sept, so the expected text is built from a table of months here) */
    const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const stampOf = (iso) => { const q = {}; new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur", day: "2-digit", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso)).forEach((x) => { q[x.type] = x.value; }); return q.day + " " + MON[+q.month - 1] + " " + q.year + ", " + q.hour + ":" + q.minute; };
    const whenOf = (verb, iso) => verb + " " + (sameDay(iso) ? hm(iso) : stampOf(iso));
    const SHAPE = /^(until|opens) (\d\d:\d\d|\d\d [A-Z][a-z]{2} \d{4}, \d\d:\d\d)$/;
    const soon = new Date(Date.now() + 20 * 60e3).toISOString();
    const dO = await signed({ ok: true, open: true, nextChange: soon, nextOpen: null });
    const chO = dO.getElementById("cOpen"), wO = dO.getElementById("cWhen");
    ok(chO.classList.contains("amb-status__state") && chO.classList.contains("amb-status__state--pos") && !!chO.closest("#cHead .amb-status") && !!chO.querySelector(".amb-chip__dot")
      && t(chO.querySelector(".amb-status__label")) === "Open" && t(chO) === "Open" && !chO.querySelector(".amb-status__word")
      && t(dO.getElementById("todayLine")) === "Order now and we confirm it today." && !dO.getElementById("today").hidden,
      "while it is open the status row's chip says Open alone, in the gain's colour, off /hours, and the card says what it means for an order: " + t(chO) + " | " + t(dO.getElementById("todayLine")));
    ok(!wO.hidden && wO.classList.contains("amb-status__time") && !wO.classList.contains("amb-status__word") && wO.previousElementSibling === chO && wO.parentNode === chO.parentNode
      && t(wO) === whenOf("until", soon) && SHAPE.test(t(wO)),
      "and when it closes stands beside it in a span of its own, until 22:00: " + t(wO));
    const later = new Date(Date.now() + 3 * 864e5).toISOString();
    const dC = await signed({ ok: true, open: false, nextChange: later, nextOpen: later });
    const chC = dC.getElementById("cOpen");
    ok(!chC.classList.contains("amb-status__state--pos") && t(chC) === "Closed" && !chC.querySelector(".amb-status__word") && !dC.getElementById("cWhen").hidden
      && t(dC.getElementById("cWhen")) === "opens " + stampOf(later) && SHAPE.test(t(dC.getElementById("cWhen")))
      && t(dC.getElementById("todayLine")) === "You can still order; we confirm it then.",
      "while it is closed the chip says Closed and its own span when it opens, the date and time past today, and the card says it can still be ordered: " + t(chC) + " | " + t(dC.getElementById("cWhen")));
    const dS = await signed({ ok: true, open: false, nextChange: soon, nextOpen: soon });
    ok(t(dS.getElementById("cOpen")) === "Closed" && t(dS.getElementById("cWhen")) === whenOf("opens", soon) && SHAPE.test(t(dS.getElementById("cWhen"))),
      "closed and opening later today it says opens 08:00 in the same span: " + t(dS.getElementById("cWhen")));
    const far = new Date(Date.now() + 10 * 864e5).toISOString();
    const dF = await signed({ ok: true, open: true, nextChange: far, nextOpen: null }), dG = await signed({ ok: true, open: false, nextChange: far, nextOpen: far });
    ok(t(dF.getElementById("cWhen")) === "until " + stampOf(far) && t(dG.getElementById("cWhen")) === "opens " + stampOf(far) && SHAPE.test(t(dF.getElementById("cWhen"))) && SHAPE.test(t(dG.getElementById("cWhen"))),
      "and ten days on it says the same date and time, in the page's own three-letter month: " + JSON.stringify([t(dF.getElementById("cWhen")), t(dG.getElementById("cWhen"))]));
    const dN = await signed(null);
    ok(dN.getElementById("cOpen").hidden && dN.getElementById("cWhen").hidden && dN.getElementById("todayLine").hidden && t(dN.getElementById("cOpen")) === "" && t(dN.getElementById("cWhen")) === "",
      "and while the hours are not read it says neither, the chip and its time hidden and empty");
    /* a phone keeps the time and does without "Signed in as" (Ambient's rule below 480px hides what is a status word); the username stays. jsdom lays nothing out, so the rule is read as served */
    const who = dO.querySelector("#cHead .amb-status__text[data-wholine]");
    ok(css.replace(/\s+/g, " ").includes("@container amb (max-width: 479.98px) { .amb-status .amb-status__word {") && !!who && who.children[1].classList.contains("amb-status__word") && /^Signed in as\s*$/.test(who.children[1].textContent)
      && who.lastElementChild.hasAttribute("data-whoname") && !who.lastElementChild.classList.contains("amb-status__word") && who.lastElementChild.textContent === u && !wO.classList.contains("amb-status__word")
      && who.children[0].matches("svg.amb-icon--sm") && !!who.children[0].querySelector("use[href='#amb-person']") && who.children.length === 3 && !who.querySelector("svg").closest(".amb-status__word"),
      "a phone drops the word Signed in as, which is a status word Ambient hides under 480px, and keeps the person glyph, the username and the time, which are not: " + t(who));
    /* View as them reads the hours too (his answer, 22 Nov 2026) is Salt Admin's flow; here a customer's Log out forgets them: the chip and its time stand down with the account */
    dO.getElementById("lock").click(); dO.getElementById("lock").click();
    ok(await until(() => dO.getElementById("cOpen").hidden), "Log out lets the status row forget the last account's hours: " + t(dO.getElementById("cOpen")));
    ok(dO.getElementById("cWhen").hidden && t(dO.getElementById("cWhen")) === "" && t(dO.getElementById("cOpen")) === "", "the chip, and its time, are hidden and empty again after Log out");
    /* the hero is the title alone and the status row sits beside it under no app bar; a customer is shown no bare clock there (Fable's review of 17 Nov 2026) */
    ok(dO.querySelectorAll("#tabs > .amb-appbar").length === 0 && !!dO.querySelector("#tabs > .amb-screen > .amb-hero.amb-hero--title > #placeT") && dO.querySelectorAll("#tabs > .amb-screen > .amb-hero > *").length === 1
      && !!dO.querySelector("#tabs > .amb-screen > #cHead.amb-head > .amb-status") && !dO.querySelector("#cHead [data-clock]") && !dO.querySelector("#today #cOpen"),
      "the hero holds the title alone, no app bar stands over it, and the chip is the status row's, not the card's");
  } catch (e) { ok(false, "counter-today stopped on an error: " + (e && e.stack)); }
  finally { wins.forEach((w) => w.close()); }
}
