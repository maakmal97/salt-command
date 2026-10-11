/* test/counter-account-door.mjs: ACCOUNT LEADS WITH THIS DEVICE, AND THE DOOR NAMES THE APP (Phase 7d part 2 of the Salt Account and Counter
 * redesign, his yes of 11 Oct 2026, the plan's section 7 items 7 and 8, and Fable's notes on #133).
 *
 * Every assertion observes a signed-in page's window in jsdom: its markup, the requests its fetch saw and the cascade jsdom runs (no width
 * query; the gap, Sign out's position and the two themes are measured in a real browser and recorded in the pull request). Each check
 * below was proved red by its own mutation (test/counter-account-door.mutations.json, run with tools/section.mjs). Every code, name and
 * password is invented.
 *   1  Account reads Messages, then This device, then the statement under its own heading, from the rendered DOM; the statement's parts
 *      (month filter, list, earlier statements) stay together after the card; the gap is a flex gap of 28px, none of it a margin
 *   2  This device is compact and ordered: notifications, the Look, Sign out, then the other devices and the install guide; every control
 *      keeps its id; the install guide's heading is the card's own third level, not a page's first
 *   3  Sign out is a tap and a tap again on the same control: the first tap arms it, says so in its own words and sends nothing; a second
 *      inside the window signs out exactly as before (the request, the door); left alone the arm lets go by itself, and a tap after that
 *      only arms again; it is never the browser's confirm
 *   4  the door names the app, Salt Counter, in its ring and one eyebrow line above Sign in, and his own page carries none of it
 *   5  the help line is a sentence, with nothing bold, brass or linked in it; the door holds no link at all */
import { webcrypto } from "node:crypto";

export async function run({ ok }) {
  const { landingPage } = await import("../stmt/page.js");
  const C = await import("../tools/stmt-crypto.mjs");
  const W = await import("../stmt/words.js");
  const { JSDOM } = await import("jsdom");

  const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
  const until = async (f, n = 300) => { for (let i = 0; i < n && !f(); i++) await new Promise((r) => setTimeout(r, 15)); return !!f(); };

  const u = "abcd-efgh", pass = "fixture-pass-7d2", ck = await C.contentKey("test-secret", u);
  const prices = { at: new Date().toISOString(), week: { monday: "2026-10-05", label: "5 to 11 Oct 2026" }, soon: [],
    products: [{ product: "salt", unit: "unit", basis: "yours", rate: 100, orders: 3, sizes: [{ q: 1, price: 100 }, { q: 2, price: 190 }] }] };
  const live = { at: "2026-10-11T08:00:00Z", owed: 0, pay: null,
    body: '<h2 class="stmth">Statement of account</h2><p class="meta">Live statement</p><div class="salt-lines"><div class="salt-lines__row" data-m="2026-10">One line</div></div>' };
  const body = { ok: true, assoc: false, wrap: await C.wrapKey(pass, ck), session: "sess-7d2-abcdefghij", liveStatus: "fixture",
    env: await C.encryptWith(ck, JSON.stringify({ statements: [{ issued: "2026-09-01", label: "September", body: "<p>Statement</p>" }] })),
    live: Object.assign({ at: live.at }, await C.encryptWith(ck, JSON.stringify(live))),
    prices: await C.encryptWith(ck, JSON.stringify(prices)) };

  const native = [], wins = [];
  const answer = (status, j) => ({ ok: status < 300, status, json: async () => j });
  /* a customer's page, signed in, on an invented account; `lockMs` shortens the arm of Sign out so a lapse can be waited for */
  const open = async ({ lockMs = 0 } = {}) => {
    const st = { log: [] };
    let html = landingPage(u, "n7d2", null);
    if (lockMs) html = html.replace(/var LOCK_MS=[0-9]+/, "var LOCK_MS=" + lockMs);
    const dom = new JSDOM(html, { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true, beforeParse(win) {
      try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
      if (!win.TextEncoder) win.TextEncoder = TextEncoder;
      if (!win.TextDecoder) win.TextDecoder = TextDecoder;
      win.scrollTo = () => {}; win.HTMLElement.prototype.scrollIntoView = () => {};
      try { win.localStorage.setItem("salt-look", "tide"); } catch (e) { /* the Sheet asks, and the checks below close it */ }
      for (const k of ["confirm", "alert", "prompt"]) win[k] = () => { native.push(k); throw new Error("the browser's " + k + " was called"); };
      win.fetch = async (path, init) => {
        const p = String(path), m = (init && init.method) || "GET";
        if (p === "/open" || p === "/account") return answer(200, body);
        if (p === "/orders" && m === "GET") return answer(200, { ok: true, orders: [], claims: [] });
        if (p === "/my/refs" && m === "GET") return answer(200, { ok: true, max: 10, refs: [] });
        if (p === "/logout") { st.log.push({ p, m, session: ((init && init.headers) || {})["X-Stmt-Session"] }); return answer(200, { ok: true }); }
        return answer(404, { ok: false });
      };
    } });
    wins.push(dom.window);
    const w = dom.window, d = w.document;
    d.getElementById("un").value = u; d.getElementById("pw").value = pass;
    d.getElementById("f").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
    await until(() => !d.getElementById("tabs").hidden && d.querySelector("#out .stmth"));
    d.querySelector('button[data-t="stmt"]').click();
    await until(() => !d.getElementById("thisDevice").hidden);
    return { w, d, st };
  };
  const before = (a, b) => !!a && !!b && (a.compareDocumentPosition(b) & 4) !== 0;   /* a precedes b in the document */

  try {
    /* ---- 1: Account's order, read from the rendered DOM */
    const P = await open();
    const { d } = P;
    const thread = d.querySelector("#acct #aThread .throw"), dev = d.querySelector("#acct #thisDevice"), stmt = d.querySelector("#acct .acct__main"), head = d.querySelector("#acct .acct__main #out .stmth");
    ok(!!thread && t(thread.querySelector(".salt-inbox-row__title")) === W.EN["th.row"] && !!dev && !dev.hidden && !!head && t(head) === "Statement of account"
      && before(thread, dev) && before(dev, head) && before(dev, stmt) && dev.parentNode === d.getElementById("acct") && stmt.parentNode === d.getElementById("acct"),
      "Account reads Messages, then This device, then the statement under its own heading: " + JSON.stringify({ thread: !!thread, dev: !!dev, head: t(head) }));
    const parts = ["stmtBack", "mfil", "mfnote", "out", "stmtFoot"].map((id) => d.getElementById(id));
    ok(parts.every((x) => x && stmt.contains(x)) && !dev.contains(d.getElementById("out")) && !d.getElementById("aThread").closest(".acct__main"),
      "the statement's parts (the way back, the month filter and its note, the list, the earlier statements) stay together after the card, and Messages is not among them");
    const acctRules = [...d.styleSheets].flatMap((s) => [...s.cssRules]).filter((r) => r.selectorText === ".acct");
    const rule = acctRules.length === 1 ? acctRules[0].cssText.replace(/\s+/g, "") : "";
    const gapRules = [...d.styleSheets].flatMap((s) => [...s.cssRules]).filter((r) => /^\.(acct__main|devcard|acct)$/.test(r.selectorText || "") && /margin(-top)?:\s*[1-9]/.test(r.cssText));
    ok(/display:flex/.test(rule) && /flex-direction:column/.test(rule) && /gap:28px/.test(rule) && gapRules.length === 0 && d.querySelector("#aThread:empty") === null,
      "the gap between the parts is the container's own, 28px, so a part not drawn leaves none, and no margin stands in for it: " + rule);

    /* ---- 2: the card, compact and ordered, every control with its id */
    const card = d.getElementById("thisDevice");
    const seq = ["devH", "devRows", "lookRow", "lock", "devSlot", "keepCard"].map((id) => d.getElementById(id));
    ok(seq.every((x) => !!x && card.contains(x)) && seq.every((x, i) => i === 0 || before(seq[i - 1], x)),
      "This device reads notifications, the Look, Sign out, then the other devices and the install guide, each control with its id");
    ok(!!d.querySelector('#lookRow [data-look="night"]') && !!d.querySelector('#lookRow [data-look="tide"]') && t(d.getElementById("lock")) === W.fill(W.EN["dev.out"], { dev: "computer" }, "en")
      && d.getElementById("keepHead").tagName === "H3" && d.querySelectorAll("#pStmt h1").length === 0,
      "the Look keeps its two taps, Sign out its words, and the install guide's heading is the card's third level, so Account carries no second page heading of its own: "
      + JSON.stringify({ lock: t(d.getElementById("lock")), keep: d.getElementById("keepHead").tagName }));

    /* ---- 3: Sign out, a tap and a tap again */
    const lock = d.getElementById("lock"), asked = W.fill(W.EN["dev.outAsk"], { dev: "computer" }, "en");
    lock.click();
    ok(t(lock) === asked && !d.getElementById("tabs").hidden && d.getElementById("gate").hidden && P.st.log.length === 0 && lock.getAttribute("aria-live") === "polite",
      "the first tap arms Sign out, says so in its own words, and sends nothing: " + JSON.stringify({ said: t(lock), sent: P.st.log.length, signedIn: !d.getElementById("tabs").hidden }));
    lock.click();
    await until(() => !d.getElementById("gate").hidden && P.st.log.length === 1);
    ok(!d.getElementById("gate").hidden && d.getElementById("tabs").hidden && P.st.log.length === 1 && P.st.log[0].p === "/logout" && P.st.log[0].m === "POST" && !!P.st.log[0].session
      && t(lock) === W.fill(W.EN["dev.out"], { dev: "computer" }, "en"),
      "the second signs out exactly as before: the door is back, one logout is sent under the session, and the words are Sign out's again: " + JSON.stringify(P.st.log));

    const L = await open({ lockMs: 60 });
    const lock2 = L.d.getElementById("lock");
    lock2.click();
    const armed = t(lock2) === asked;
    ok(await until(() => t(lock2) === W.fill(W.EN["dev.out"], { dev: "computer" }, "en")) && armed && !L.d.getElementById("tabs").hidden && L.st.log.length === 0,
      "left alone, the arm lets go by itself: the words come back and nothing was sent");
    lock2.click();
    ok(t(lock2) === asked && !L.d.getElementById("tabs").hidden && L.st.log.length === 0,
      "and a tap after it lapsed only arms again, never signs out: " + JSON.stringify({ said: t(lock2), sent: L.st.log.length }));
    /* his Back to accounts shares the id on his page and stays a plain tap: it is not Sign out, and nothing arms it */
    const EMPTY = { ok: true, accounts: [], refs: [], claims: [], threads: [], pools: [], lines: [], orders: [], drafts: [], refused: [], queue: [] };
    const owner = new JSDOM(landingPage("", "n7d2o", { master: "fixture-master", accounts: [] }), { url: "https://counter.fixture.test/all", runScripts: "dangerously", pretendToBeVisual: true, beforeParse(win) {
      try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
      win.TextEncoder = TextEncoder; win.TextDecoder = TextDecoder; win.scrollTo = () => {};
      win.setTimeout = () => 0; win.clearTimeout = () => {}; win.setInterval = () => 0; win.clearInterval = () => {};
      win.fetch = async () => ({ ok: true, status: 200, type: "basic", json: async () => EMPTY });
    } });
    wins.push(owner.window);
    const od = owner.window.document, back = od.getElementById("lock"), backWords = t(back);
    const placeBefore = od.getElementById("oCustomers").hidden;
    back.click();
    ok(backWords === "Back to accounts" && t(back) === backWords && !back.hasAttribute("data-w") && placeBefore && !od.getElementById("oCustomers").hidden,
      "his Back to accounts is a plain tap: one tap does its work and the control never reads as armed: " + JSON.stringify({ backWords, now: t(back), customersShown: !od.getElementById("oCustomers").hidden }));
    /* ---- 4 and 5: the door, as served */
    const door = new JSDOM(landingPage(u, "n7d2d", null), { url: "https://site.test/" });
    wins.push(door.window);
    const dd = door.window.document, gate = dd.getElementById("gate"), h1 = gate.querySelector("h1"), appName = gate.querySelector('[data-w="door.app"]');
    ok(!!appName && t(appName) === "Salt Counter" && t(appName) === W.EN["door.app"] && appName.tagName === "P" && appName.classList.contains("salt-eyebrow")
      && before(appName, h1) && t(h1) === W.EN["door.h"] && !!gate.querySelector(".appmark svg") && before(gate.querySelector(".appmark"), appName)
      && gate.querySelector(".appmark svg").getAttribute("aria-hidden") === "true",
      "the door names the app, Salt Counter, in its ring and one eyebrow line above Sign in, which stays the page's one heading: " + JSON.stringify({ name: t(appName), h1: t(h1) }));
    const ownerGate = new JSDOM(landingPage("", "n7d2e", { master: "fixture-master", accounts: [] }), { url: "https://counter.fixture.test/all" }).window.document.getElementById("gate");
    ok(!!ownerGate && !ownerGate.querySelector('[data-w="door.app"]') && !ownerGate.querySelector(".appmark"),
      "his own page, which is Salt Account, carries no copy of the customer's door name");
    const help = [...gate.querySelectorAll(".salt-insight")].find((x) => /Lost your password or your link\?/.test(x.textContent));
    ok(!!help && help.children.length === 0 && help.innerHTML === W.fillHtml(W.EN["door.help"], {}, "en") && !/[*]/.test(W.EN["door.help"]) && !/[*]/.test(gate.textContent)
      && gate.querySelectorAll("a, [role=link], b, strong").length === 0 && /Ask us for a new sign-in link\./.test(t(help)),
      "the help line is a sentence: plain words with nothing bold, brass or linked in it, and the door holds no link at all: " + JSON.stringify(help && help.innerHTML));
    ok(native.length === 0, "no confirm, alert or prompt was called across the flows above: " + JSON.stringify(native));
  } finally { for (const w of wins) { try { w.close(); } catch (e) { /* jsdom */ } } }
}
