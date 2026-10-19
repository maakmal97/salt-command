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
 *   5  the help line is a sentence, with nothing bold, brass or linked in it; the door holds no link at all
 *   6  the yes-or-no Sheet's danger action sends once: a second tap cannot, and one left behind by a closed Sheet cannot answer for the next
 *   7  while a Sheet is open the page behind it is inert, its own scrim and body live, and nothing is left shut by any way of closing it: the look
 *      Sheet, the yes-or-no Sheet, the order sheet under a yes or no, the signed-out Sheet a lapse opens, Log out with a question open, and the
 *      pay Sheet, whether an order's Pay opens it or the return from the bank does */
import { webcrypto } from "node:crypto";
import { TIDE_OFF } from "./tide-off.mjs";

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
  const iso = (m) => new Date(Date.now() - m * 60e3).toISOString();
  const ord = (id, x) => Object.assign({ id, product: "salt", qty: 1, unit: 100, total: 100, delivery: 0, paid: 0, moved: 0, mode: "collect", status: "placed",
    at: iso(30), history: [{ at: iso(30), status: "placed", by: "customer" }], msgs: [] }, x);
  const A = ord("20261011090001-adoa", { qty: 2.5, unit: 108, total: 270 }), B = ord("20261011090002-adob", { product: "candy", unit: 12, total: 12 });
  const Cc = ord("20261011090003-adoc", { product: "oil", qty: 3, unit: 38, total: 115 }), D = ord("20261011090004-adod", { product: "rice", unit: 9, total: 9 });
  const E = ord("20261011090005-adoe", { total: 100 }), F = ord("20261011090006-adof", { product: "oil", unit: 40, total: 40 });
  /* a customer's page, signed in, on an invented account holding `orders`: `lockMs` shortens the arm of Sign out so a lapse can be waited for, `fast`
     the poll so a lapse shows, `asked` leaves the device with no look chosen, so the Sheet asks as the page opens, and `payq` is the question
     kept on the device while they were at their bank */
  const open = async ({ lockMs = 0, fast = false, asked = false, orders = [], payq = "" } = {}) => {
    const st = { log: [], orders: orders.map((o) => ({ ...o })), down: false, cancels: [], cancel: "500" };
    let html = landingPage(u, "n7d2", null);
    if (lockMs) html = html.replace(/var LOCK_MS=[0-9]+/, "var LOCK_MS=" + lockMs);
    if (fast) html = html.replace(/var POLL_MS=[0-9]+/, "var POLL_MS=60");
    const dom = new JSDOM(html, { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true, beforeParse(win) {
      try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
      if (!win.TextEncoder) win.TextEncoder = TextEncoder;
      if (!win.TextDecoder) win.TextDecoder = TextDecoder;
      win.scrollTo = () => {}; win.HTMLElement.prototype.scrollIntoView = () => {};
      if (!asked) { try { win.localStorage.setItem("salt-look", "tide"); } catch (e) { /* the Sheet asks, and the checks below close it */ } }
      if (payq) { try { win.localStorage.setItem("salt-stmt-payq", payq); } catch (e) { /* no question is kept */ } }
      for (const k of ["confirm", "alert", "prompt"]) win[k] = () => { native.push(k); throw new Error("the browser's " + k + " was called"); };
      win.fetch = async (path, init) => {
        const p = String(path), m = (init && init.method) || "GET";
        if (p === "/open" || p === "/account") return answer(200, body);
        if (p === "/orders" && m === "GET") return st.down ? answer(401, { ok: false }) : answer(200, { ok: true, orders: JSON.parse(JSON.stringify(st.orders)), claims: [] });
        const c = /^[/]orders[/]([^/]+)[/]cancel$/.exec(p);
        if (c) {
          st.cancels.push({ p, m, id: c[1] });
          if (st.cancel !== "ok") return answer(500, { ok: false });
          st.orders = st.orders.map((o) => (o.id === c[1] ? { ...o, status: "cancelled" } : o));
          return answer(200, { ok: true });
        }
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
  /* the order screen's own Cancel, found by its data-yn, and the order sheet at its limit */
  const cancelBtn = (pg, id) => pg.d.querySelector('#pOrder .oscreen[data-order="' + id + '"] button[data-yn="cancel:' + id + '"]');
  const openOrder = async (pg, id) => { pg.d.querySelector('button[data-t="order"]').click();
    await until(() => pg.d.querySelector('#pOrder [data-row="' + id + '"]')); pg.d.querySelector('#pOrder [data-row="' + id + '"]').click();
    await until(() => cancelBtn(pg, id)); return cancelBtn(pg, id); };
  const openLimit = async (pg) => { pg.d.querySelector('button[data-t="prices"]').click();
    await until(() => pg.d.querySelector("#pPrices .szrow")); pg.d.querySelector("#pPrices .szrow").click();
    await until(() => pg.d.querySelector("#osheet .olim button")); return pg.d.querySelector("#osheet .olim button"); };
  const key = (pg, k) => pg.d.dispatchEvent(new pg.w.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
  const before = (a, b) => !!a && !!b && (a.compareDocumentPosition(b) & 4) !== 0;   /* a precedes b in the document */

  try {
    /* ---- 1: Account's order, read from the rendered DOM */
    const P = await open();
    const { d } = P;
    const thread = d.querySelector("#acct #aThread .throw"), dev = d.querySelector("#acct #thisDevice"), stmt = d.querySelector("#acct .acct__main"), head = d.querySelector("#acct .acct__main #out .stmth");
    ok(!!thread && t(thread.querySelector(".salt-inbox-row__title")) === W.EN["th.row"] && !!dev && !dev.hidden && !!head && t(head) === "Statement of account"
      && before(thread, dev) && before(dev, head) && before(dev, stmt) && dev.parentNode === d.getElementById("acct") && stmt.parentNode === d.getElementById("acct"),
      "Account reads Messages, then This device, then the statement under its own heading: " + JSON.stringify({ thread: !!thread, dev: !!dev, head: t(head) }));
    const parts = ["mfil", "mfnote", "out"].map((id) => d.getElementById(id));
    ok(parts.every((x) => x && stmt.contains(x)) && !dev.contains(d.getElementById("out")) && !d.getElementById("aThread").closest(".acct__main")
      && !d.getElementById("stmtFoot") && !d.getElementById("stmtBack"),
      "the statement's parts (the month filter and its note, the list) stay together after the card, Messages is not among them, and no earlier statement or way back to one is drawn (14 Oct 2026)");
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
    const ownSheetUp = !od.getElementById("lookSheet").hidden && [...od.body.children].every((c) => !c.hasAttribute("inert") && !c.hasAttribute("data-behind"));
    back.click();
    ok(backWords === "Back to accounts" && t(back) === backWords && !back.hasAttribute("data-w") && placeBefore && !od.getElementById("oCustomers").hidden,
      "his Back to accounts is a plain tap: one tap does its work and the control never reads as armed: " + JSON.stringify({ backWords, now: t(back), customersShown: !od.getElementById("oCustomers").hidden }));
    ok(TIDE_OFF || ownSheetUp,   /* parked while Tide is off (19 Oct 2026): no look Sheet opens */ 
      "and his page, which draws Sheets of its own, is left as it was: its look Sheet is open and nothing on it is shut");

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
    /* ---- 6: the yes-or-no Sheet's danger tap sends once, from the tap that sent it */
    const Y = await open({ orders: [A, B] });
    const cancelA = await openOrder(Y, A.id);
    cancelA.click();
    const goA = Y.d.getElementById("ynGo");
    goA.click(); goA.click();
    await until(() => Y.st.cancels.length >= 1 && !!cancelBtn(Y, A.id));
    ok(Y.st.cancels.length === 1 && Y.st.cancels[0].id === A.id && !Y.d.getElementById("ynSheet"),
      "a second tap on the danger action, here a programmatic one, cannot send twice: " + JSON.stringify(Y.st.cancels.map((x) => x.id)));
    const cancelA2 = cancelBtn(Y, A.id);
    cancelA2.click();
    const staleGo = Y.d.getElementById("ynGo");
    Y.d.getElementById("ynKeep").click();
    const cancelB = await openOrder(Y, B.id);
    cancelB.click();
    const asksB = t(Y.d.getElementById("ynSheet"));
    staleGo.click();
    ok(Y.st.cancels.length === 1 && !!Y.d.getElementById("ynSheet") && t(Y.d.getElementById("ynSheet")) === asksB,
      "nor can a danger action left behind by a Sheet that closed answer for the next one: the new Sheet stays open and nothing is sent");
    const goB = Y.d.getElementById("ynGo");   /* a missing control is a failed check below, never a crash */
    if (goB) goB.click();
    ok(await until(() => Y.st.cancels.length === 2) && Y.st.cancels[1].id === B.id && !Y.d.getElementById("ynSheet"), "while the new Sheet's own danger action still sends, for its own order");

    /* ---- 7: while a Sheet is open the page behind it is inert, and nothing is left shut by any way of closing it */
    const rootsOf = (d) => [...d.body.children].filter((c) => !/^(SCRIPT|STYLE)$/.test(c.tagName));
    const shutIds = (d) => rootsOf(d).filter((c) => c.hasAttribute("inert")).map((c) => c.id || c.tagName.toLowerCase());
    const liveIds = (d) => rootsOf(d).filter((c) => !c.hasAttribute("inert")).map((c) => c.id || c.tagName.toLowerCase());
    const clean = (d) => shutIds(d).length === 0 && !d.querySelector("[data-behind]");
    const behindShut = (d, live) => JSON.stringify(liveIds(d)) === JSON.stringify(live) && shutIds(d).includes("tabs") && shutIds(d).includes("gate") && shutIds(d).length === rootsOf(d).length - live.length;

    /* the look Sheet, which a device that has chosen nothing is asked at sign-in */
    const lookWays = [["the close orb", (pg) => pg.d.getElementById("lookX").click()], ["the scrim", (pg) => pg.d.getElementById("lookScrim").click()],
      ["Escape", (pg) => key(pg, "Escape")], ["a tile", (pg) => pg.d.querySelector('#lookSheet [data-look="night"]').click()]];
    const lookRes = [];
    for (const [name, fn] of TIDE_OFF ? [] : lookWays) {   /* parked while Tide is off (19 Oct 2026): no look Sheet opens */ 
      const K = await open({ asked: true });
      const up = !K.d.getElementById("lookSheet").hidden && behindShut(K.d, ["lookScrim", "lookSheet"]);
      fn(K);
      lookRes.push([name, up, K.d.getElementById("lookSheet").hidden && clean(K.d)]);
    }
    ok(lookRes.every((r) => r[1] && r[2]), "the look Sheet shuts the page behind it, its own scrim and body live, and every way of closing it gives the page back: " + JSON.stringify(lookRes));

    /* the yes-or-no Sheet, over the order screen */
    const ynRes = [], ynWays = [["Keep it", (pg) => pg.d.getElementById("ynKeep").click()], ["the danger action", (pg) => pg.d.getElementById("ynGo").click()],
      ["the close orb", (pg) => pg.d.getElementById("ynX").click()], ["the scrim", (pg) => pg.d.getElementById("ynScrim").click()], ["Escape", (pg) => key(pg, "Escape")]];
    const N = await open({ orders: [A] });
    for (const [name, fn] of ynWays) {
      const opener = await openOrder(N, A.id);
      opener.focus(); opener.click();
      const up = !!N.d.getElementById("ynSheet") && behindShut(N.d, ["ynWrap"]);
      fn(N);
      ynRes.push([name, up, !N.d.getElementById("ynSheet") && clean(N.d)]);
      await until(() => !!cancelBtn(N, A.id));
    }
    ok(ynRes.every((r) => r[1] && r[2]), "the yes-or-no Sheet shuts the page behind it, and each way of closing it, the danger action included, gives it back: " + JSON.stringify(ynRes));

    /* a yes or no over the order sheet at its limit shuts that sheet too, and gives it back when it closes */
    const Lm = await open({ orders: [A, B, Cc, D, E, F], fast: true });
    const lim = await openLimit(Lm);
    const orderUp = behindShut(Lm.d, ["osheet"]);
    lim.click();
    const askUp = behindShut(Lm.d, ["ynWrap"]) && Lm.d.getElementById("osheet").hasAttribute("inert");
    Lm.d.getElementById("ynKeep").click();
    const orderBack = behindShut(Lm.d, ["osheet"]) && !Lm.d.getElementById("osheet").hasAttribute("inert");
    Lm.d.querySelector("#osheet .salt-sheet__close").click();
    ok(orderUp && askUp && orderBack && !Lm.d.getElementById("osheet") && clean(Lm.d),
      "the order sheet shuts the page, a yes or no over it shuts the order sheet too and hands it back on Keep it, and closing the order sheet hands back the page: " + JSON.stringify({ orderUp, askUp, orderBack }));

    /* the signed-out Sheet, which a lapse opens over whatever was on screen, a yes or no included */
    const S = await open({ orders: [A], fast: true });
    const cS = await openOrder(S, A.id);
    cS.click();
    const askedFirst = !!S.d.getElementById("ynSheet");
    S.st.down = true;
    await until(() => !S.d.getElementById("outSheet").hidden, 300);
    const lapseUp = !S.d.getElementById("ynSheet") && behindShut(S.d, ["outScrim", "outSheet"]);
    S.d.getElementById("outX").click();
    ok(askedFirst && lapseUp && S.d.getElementById("outSheet").hidden && clean(S.d) && S.d.activeElement === S.d.getElementById("lapseGo"),
      "a lapse takes the question down and leaves the signed-out Sheet over a shut page, and closing it gives the page back, the focus on Continue: " + JSON.stringify({ askedFirst, lapseUp, clean: clean(S.d) }));
    const S2 = await open({ orders: [A], fast: true });
    S2.st.down = true;
    await until(() => !S2.d.getElementById("outSheet").hidden, 300);
    const wayRes = [];
    for (const [name, fn] of [["the scrim", (pg) => pg.d.getElementById("outScrim").click()], ["Escape", (pg) => key(pg, "Escape")]]) {
      if (S2.d.getElementById("outSheet").hidden) { S2.d.getElementById("lapseGo").click(); await until(() => !S2.d.getElementById("outSheet").hidden, 200); }
      const up = behindShut(S2.d, ["outScrim", "outSheet"]);
      fn(S2);
      wayRes.push([name, up, S2.d.getElementById("outSheet").hidden && clean(S2.d)]);
    }
    ok(wayRes.every((r) => r[1] && r[2]), "and the scrim and Escape give it back the same way: " + JSON.stringify(wayRes));

    /* Log out with a question open takes it down and leaves nothing shut, the door clear */
    const Q = await open({ orders: [A] });
    const cQ = await openOrder(Q, A.id);
    cQ.click();
    const lock3 = Q.d.getElementById("lock");
    lock3.click(); lock3.click();
    ok(!Q.d.getElementById("ynSheet") && !Q.d.getElementById("gate").hidden && clean(Q.d),
      "Log out with a question open takes it down, leaves the door in reach and nothing shut: " + JSON.stringify({ shut: shutIds(Q.d) }));
    /* the pay Sheet, opened by an order's Pay and again on the return from the bank, which asks Did you send it as the page opens */
    const who = (x) => { let h = 2166136261; for (let i = 0; i < x.length; i++) { h ^= x.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); };
    const owed = ord("20261011090007-adog", { status: "acknowledged", unit: 150, total: 150 });
    const R = await open({ orders: [owed], payq: JSON.stringify({ who: who(u), at: Date.now(), kind: "order", id: owed.id, away: { amt: 150, rail: "transfer", acct: "maybank" } }) });
    await until(() => !R.d.getElementById("paySheet").hidden);
    const backUp = !R.d.getElementById("paySheet").hidden && behindShut(R.d, ["payScrim", "paySheet"]);
    R.d.getElementById("payX").click();
    const Pp = await open({ orders: [owed] });
    Pp.d.querySelector('button[data-t="order"]').click();
    await until(() => Pp.d.querySelector('#pOrder [data-row="' + owed.id + '"]')); Pp.d.querySelector('#pOrder [data-row="' + owed.id + '"]').click();
    await until(() => [...Pp.d.querySelectorAll("#pOrder .oact button")].some((b) => /^Pay RM/.test(t(b))));
    [...Pp.d.querySelectorAll("#pOrder .oact button")].find((b) => /^Pay RM/.test(t(b))).click();
    const payUp = !Pp.d.getElementById("paySheet").hidden && behindShut(Pp.d, ["payScrim", "paySheet"]);
    Pp.d.getElementById("payX").click();
    ok(backUp && R.d.getElementById("paySheet").hidden && clean(R.d) && payUp && Pp.d.getElementById("paySheet").hidden && clean(Pp.d),
      "the pay Sheet shuts the page behind it, opened by an order's Pay or again on the return from the bank, and closing it gives the page back: " + JSON.stringify({ backUp, payUp, shut: [shutIds(R.d), shutIds(Pp.d)] }));
    ok(native.length === 0, "no confirm, alert or prompt was called across the flows above: " + JSON.stringify(native));
  } finally { for (const w of wins) { try { w.close(); } catch (e) { /* jsdom */ } } }
}
