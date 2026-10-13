/* test/counter-back-sheet.mjs: BACK CLOSES A SHEET ON THE CUSTOMER'S PAGE (13 Oct 2026, his yes: "Yes, Back closes the sheet"; stress triage R4).
 *
 * The page pushed no history entry for a Sheet, so Back (a phone's button, a browser's swipe) left the Counter with a Sheet open and a note or a place
 * being typed was lost. A Sheet now pushes one entry at the same address, marked in its state, and Back closes the top Sheet only. What is proved, each
 * check red under its own mutation (test/counter-back-sheet.mutations.json) and red on 2937f9dc, where no Sheet pushes anything:
 *   1  the New order sheet: one entry pushed at the same address (no new hash, state marked), Back closes it, the focus goes to the row that opened
 *      it, the page behind is let go, and what was typed in it is still there when it opens again
 *   2  every other Sheet the page draws closes on Back the same way: the question, Pay, the thread, Sign in another device, the bell, the look choice and the
 *      signed-out Sheet that a lapse draws; each opener gets the focus back where it has one
 *   3  a Sheet closed by its own controls (the close orb, the scrim, Escape, Keep it, an answer) hands its entry back: after any open and close the page is
 *      at the entry it was at, and one Back leaves the page as it would have without the Sheet. A lapse that shuts one Sheet and draws another keeps one entry
 *   4  stacked Sheets, the question over the New order sheet: each has its own entry, Back closes the top one and then the next; two quick opens of the
 *      question leave one entry, and the question closed by its ghost leaves the order sheet on its own entry
 *   5  a Sheet that refuses to close (the New order sheet while Place is on its way) refuses Back too, and its entry is put back
 *   6  an entry left behind (a reload with a Sheet open keeps its mark; Forward onto an entry whose Sheet has gone) never makes a second Back: the mark is
 *      cleared on load and a Forward onto a stale entry is stepped off
 *   7  NO ADDRESS WITH A KEY OR A TOKEN IS EVER PUSHED: the page at /app#<key>, /app#qr.<key> and /app#code, signed in at the door, opens the look Sheet and
 *      pushes nothing, and closes it without taking an entry that was never pushed; the page at /s/<token> pushes nothing until the link is spent, and then pushes
 *      the clean address
 *   8  Salt Account is unchanged: its look Sheet pushes nothing and Escape closes it as before; the guest board carries no script to push with
 * Every assertion observes a signed-in page's window in jsdom. Every code, name, key, token and password is invented. */
import { webcrypto } from "node:crypto";

const BUILD = "b".repeat(16);

export async function run({ ok, pageWork }) {
  const { landingPage } = await import("../stmt/page.js");
  const C = await import("../tools/stmt-crypto.mjs");
  const { JSDOM } = await import("jsdom");

  const kl = (n) => new Date(Date.now() + 8 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
  const iso = (m) => new Date(Date.now() - m * 60e3).toISOString();
  const until = async (f, n = 130) => { for (let i = 0; i < n && !f(); i++) await new Promise((r) => setTimeout(r, 15)); return !!f(); };
  /* what the page does at the end of the current work (a promise's turn) has happened; an absence is read after this, never after a pause */
  const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  const part = (i, extra = {}) => Object.assign({ date: kl(-9 + i), since: kl(-1), due: kl(2), late: false, rm: 100 + i, whole: 100 + i, product: "salt", qty: 1 + i, got: 1 + i, gotOn: kl(-1),
    resale: false, goods: 100 + i, deliv: 0, less: 0, rate: 100 }, extra);
  const ord = (id, x) => Object.assign({ id, product: "salt", qty: 1, unit: 100, total: 100, delivery: 0, paid: 0, moved: 0, mode: "collect", status: "placed",
    at: iso(30), history: [{ at: iso(30), status: "placed", by: "customer" }], msgs: [] }, x);
  const A = ord("20261013090001-bsha", { qty: 2.5, unit: 108, total: 270 }), B = ord("20261013090002-bshb", { product: "candy", unit: 12, total: 12 });
  const Cc = ord("20261013090003-bshc", { product: "oil", qty: 3, unit: 38, total: 115 }), D = ord("20261013090004-bshd", { product: "rice", unit: 9, total: 9 });
  const E = ord("20261013090005-bshe", { total: 100 }), F = ord("20261013090006-bshf", { product: "oil", unit: 40, total: 40 });

  const u = "abcd-efgh", pass = "fixture-pass-13b", ck = await C.contentKey("test-secret", u);
  const KEY = "Kq3xaBcDeFgHiJkLmNoPqRsTuVwXyZ01234567", TOK = "Tz9yXwVuTsRqPoNmLkJiHgFeDcBa98765432";
  const wins = [], answer = (status, j) => ({ ok: status < 300, status, json: async () => j });
  /* a customer's page in a window, on a base entry of its own ({base:1}) with an earlier entry behind it, so "leaving" can be seen: the page's own pushes
     are recorded as the address it was at and the one it asked for. `door` signs in through the door's form (the address left as it is); `base` false leaves the page on the entry it loaded on; `payq` leaves the Pay question a reload would have left */
  const open = async ({ list = [], orders = [], fast = false, url = "https://site.test/", look = true, standalone = false, preState = null, door = true, base = true, payq = false } = {}) => {
    const st = { orders: orders.map((o) => ({ ...o })), down: false, held: null, posts: 0 };
    const sum = +list.reduce((s, p) => s + p.rm, 0).toFixed(2), late = list.filter((p) => p.late);
    const pay = { term: 1, hide: 3, lock: 4, window: 60, now: { rm: sum, due: list.length ? list[0].due : null, parts: list },
      overdue: { rm: +late.reduce((s, p) => s + p.rm, 0).toFixed(2), parts: late }, coming: { rm: 0, parts: [] } };
    const stamped = { at: new Date(Date.now() - 3600e3).toISOString(), body: "<p>Live</p>", owed: sum, pay, buildId: BUILD };
    const content = async (wrapWith) => ({ ok: true, u, wrap: await C.wrapKey(wrapWith, ck), session: "sess-13b-abcdefghij", liveStatus: "current",
      live: Object.assign({ at: stamped.at, buildId: BUILD }, await C.encryptWith(ck, JSON.stringify(stamped))),
      env: await C.encryptWith(ck, JSON.stringify({ statements: [{ issued: "2026-09-01", label: "September", body: "<p>Statement</p>" }] })),
      prices: await C.encryptWith(ck, JSON.stringify({ at: new Date().toISOString(), week: { monday: kl(0), label: "This week" },
        products: [{ product: "salt", unit: "unit", basis: "yours", rate: 100, orders: 3, sizes: [{ q: 1, price: 100 }, { q: 2, price: 190 }] }], soon: [] })) });
    const body = await content(pass), linkBody = await content(TOK);
    let html = landingPage(u, "ncbs", null);
    if (fast) html = html.replace(/var POLL_MS=[0-9]+/, "var POLL_MS=60");
    const dom = new JSDOM(html, { url, runScripts: "dangerously", pretendToBeVisual: true, beforeParse(win) {
      try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
      if (!win.TextEncoder) win.TextEncoder = TextEncoder;
      if (!win.TextDecoder) win.TextDecoder = TextDecoder;
      win.scrollTo = () => {}; win.open = () => null; win.HTMLElement.prototype.scrollIntoView = () => {};
      if (look) { try { win.localStorage.setItem("salt-look", "tide"); } catch (e) { /* the look is kept, so its Sheet does not stand over the page this check reads */ } }
      if (standalone) {
        Object.defineProperty(win.navigator, "standalone", { value: true, configurable: true });
        Object.defineProperty(win.navigator, "serviceWorker", { value: { addEventListener() {}, ready: new Promise(() => {}) }, configurable: true });
        win.PushManager = function () {}; win.Notification = { permission: "denied", requestPermission: async () => "denied" };
      }
      if (preState) win.history.replaceState(preState, "");
      if (payq) { try { let h = 2166136261; for (let i = 0; i < u.length; i++) { h ^= u.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
        win.localStorage.setItem("salt-stmt-payq", JSON.stringify({ who: h.toString(36), at: Date.now(), kind: "acct", id: null, away: { amt: 100, rail: "transfer", acct: "maybank" } })); } catch (e) { /* none kept */ } }
      win.fetch = async (path, init) => {
        const p = String(path), m = (init && init.method) || "GET";
        if (p === "/open" || p === "/account") return answer(200, body);
        if (p === "/open-link") { const peek = init && init.body && JSON.parse(init.body).peek; return peek ? answer(200, { ok: true, u }) : answer(200, linkBody); }
        if (p === "/orders" && m === "GET") return answer(st.down ? 401 : 200, st.down ? { ok: false } : { ok: true, orders: JSON.parse(JSON.stringify(st.orders)), claims: [] });
        if (p === "/orders" && m === "POST") { st.posts++; return new Promise((res) => { st.held = () => res(answer(500, { ok: false })); }); }
        if (p === "/my/refs" && m === "GET") return answer(200, { ok: true, max: 10, refs: [] });
        if (p === "/devices") return answer(200, { ok: true, devices: [{ label: "Windows computer", here: true, at: iso(600), last: iso(1), kept: true }] });
        return answer(404, { ok: false });
      };
    } });
    wins.push(dom.window);
    const w = dom.window, d = w.document, pg = { w, d, st, push: [], len0: 0, pops: 0, go: [] };
    /* the earlier entry is the one a Back that leaves lands on; the base entry is {base:1} */
    if (base) w.history.pushState({ base: 1 }, "");
    const real = w.history.pushState.bind(w.history);
    w.history.pushState = (s, t, a) => { pg.push.push({ state: s, at: w.location.href, asked: a === undefined ? "" : String(a) }); return real(s, t, a); };
    pg.len0 = w.history.length;
    /* the page's own moves back are recorded; a Back of the test's is not, and the page's handler for a Back has run by the time this one counts it */
    w.addEventListener("popstate", () => { pg.pops++; });
    const realGo = w.history.go.bind(w.history); w.history.go = (n) => { pg.go.push(n); return realGo(n); };
    if (door) {
      d.getElementById("un").value = u; d.getElementById("pw").value = pass;
      d.getElementById("f").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
      await until(() => !d.getElementById("tabs").hidden && !!d.getElementById("pOrder").textContent);
      if (list.length) await until(() => !d.getElementById("homeFoot").hidden);
    }
    return pg;
  };
  const key = (pg, k) => pg.d.dispatchEvent(new pg.w.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
  const stateIs = (pg, want) => { const s = pg.w.history.state; return want === 0 ? !!s && s.base === 1 : want === null ? s === null : !!s && s.sheet === want; };
  const goBack = async (pg) => { const n = pg.pops; pg.w.history.back(); await until(() => pg.pops > n); };
  const lbl = (e) => (e ? (e.id || e.tagName) : "nothing");
  const noInert = (pg) => !pg.d.querySelector("[inert]");
  /* a tap on a place writes that place into the address over the entry the page is on (the page's own replaceState), which drops the test's mark of the base entry: put it back */
  const tab = (pg, t) => { pg.d.querySelector('button[data-t="' + t + '"]').click(); pg.w.history.replaceState({ base: 1 }, ""); };
  const openRow = async (pg) => { tab(pg, "prices");
    await until(() => pg.d.querySelector("#pPrices .szrow")); const row = pg.d.querySelector("#pPrices .szrow"); row.focus(); row.click();
    await until(() => pg.d.getElementById("osheet")); return row; };
  const openLimit = async (pg) => { tab(pg, "prices");
    await until(() => pg.d.querySelector("#pPrices .szrow")); pg.d.querySelector("#pPrices .szrow").click();
    await until(() => pg.d.querySelector("#osheet .olim button")); return pg.d.querySelector("#osheet .olim button"); };
  const shown = (pg, id) => { const e = pg.d.getElementById(id); return !!e && !e.hidden; };

  try {
    /* ---- 1: the New order sheet, Back closes it, the focus and the draft are kept */
    const P = await open();
    tab(P, "prices"); const href0 = P.w.location.href, row = await openRow(P);
    ok(stateIs(P, 1) && P.push.length === 1 && P.push[0].state.sheet === 1 && P.push[0].asked === "" && P.w.location.href === href0 && P.w.history.length === P.len0 + 1,
      "opening the New order sheet pushes one entry at the same address, marked in its state: " + JSON.stringify(P.push) + " length " + P.w.history.length + "/" + P.len0 + " at " + P.w.location.href);
    P.d.getElementById("oAddNote").click();
    const note = P.d.getElementById("oSay"); note.value = "gate code 4"; note.dispatchEvent(new P.w.Event("input", { bubbles: true }));
    await goBack(P); await until(() => !P.d.getElementById("osheet"));
    ok(!P.d.getElementById("osheet") && stateIs(P, 0) && P.w.location.href === href0 && P.d.activeElement === row && noInert(P),
      "Back closes the New order sheet, the page is back at its base entry, the focus is on the row that opened it and the page behind is let go: focus " + lbl(P.d.activeElement) + " row connected " + row.isConnected);
    row.click(); await until(() => P.d.getElementById("osheet"));
    const kept = P.d.getElementById("oSay");
    ok(!!kept && kept.value === "gate code 4", "and what was typed in it is still there when it opens again: " + (kept ? JSON.stringify(kept.value) : "no note field"));

    /* ---- 3: each way out of the sheet hands its entry back, and one Back then leaves the page */
    const ways = [["the close orb", (pg) => pg.d.querySelector("#osheet .salt-sheet__close").click()], ["the scrim", (pg) => pg.d.querySelector("#osheet .salt-sheet-scrim").click()],
      ["Escape", (pg) => pg.d.querySelector("#osheet .osheet").dispatchEvent(new pg.w.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }))]];
    const wayRes = [];
    for (const [name, fn] of ways) {
      const W = await open(); await openRow(W);
      const up = stateIs(W, 1); fn(W);
      const shut = await until(() => !W.d.getElementById("osheet") && stateIs(W, 0));
      const lengthAfter = W.w.history.length;
      await goBack(W); const left = await until(() => stateIs(W, null));
      wayRes.push([name, up, shut, lengthAfter === W.len0 + 1, left]);
    }
    ok(wayRes.every((r) => r.slice(1).every(Boolean)), "the close orb, the scrim and Escape each hand the entry back: the page is at its base entry, and one Back leaves it: " + JSON.stringify(wayRes));
    const R = await open(); await openRow(R); R.d.querySelector("#osheet .salt-sheet__close").click(); await until(() => stateIs(R, 0));
    await openRow(R); R.d.querySelector("#osheet .salt-sheet__close").click(); await until(() => stateIs(R, 0));
    ok(R.push.length === 2 && R.w.history.length === R.len0 + 1, "and a second open and close is the same: two pushes, the second over the entry the first left, no entry added: " + R.push.length + " length " + R.w.history.length);

    /* ---- 2: every other Sheet closes on Back, and gives the focus back where it has an opener */
    const kinds = [];
    {
      const H = await open({ list: [part(0), part(1)] });
      const pill = H.d.getElementById("payNow"); pill.focus(); pill.click();
      kinds.push(["Pay", H, () => shown(H, "paySheet"), () => H.d.activeElement === H.d.getElementById("payNow")]);
    }
    {
      const T = await open();
      tab(T, "stmt"); await until(() => T.d.querySelector("#aThread .throw"));
      const tr = T.d.querySelector("#aThread .throw"); tr.focus(); tr.click();
      kinds.push(["the thread", T, () => shown(T, "thSheet"), () => !!T.d.activeElement && T.d.activeElement.classList.contains("throw")]);
    }
    {
      const V = await open();
      tab(V, "stmt"); await until(() => [...V.d.querySelectorAll("#devSlot button")].some((b) => /^Sign in another device/.test(b.textContent.trim())));
      const dv = [...V.d.querySelectorAll("#devSlot button")].find((b) => /^Sign in another device/.test(b.textContent.trim())); dv.focus(); dv.click();
      kinds.push(["Sign in another device", V, () => shown(V, "devSheet"), () => !!V.d.activeElement && /^Sign in another device/.test(V.d.activeElement.textContent.trim())]);
    }
    {
      const S = await open({ orders: [A], fast: true });
      S.st.down = true; await until(() => shown(S, "outSheet"), 300);
      kinds.push(["the signed-out Sheet", S, () => shown(S, "outSheet"), () => S.d.activeElement === S.d.getElementById("lapseGo")]);
    }
    {
      const L = await open({ look: false });
      await until(() => shown(L, "lookSheet"));
      kinds.push(["the look choice", L, () => shown(L, "lookSheet"), () => true]);
    }
    {
      const Bl = await open({ standalone: true });
      await until(() => !Bl.d.getElementById("bellBox").hidden);
      const bell = Bl.d.getElementById("bell"); bell.focus(); bell.click();
      kinds.push(["the bell", Bl, () => shown(Bl, "bellSheet"), () => Bl.d.activeElement === Bl.d.getElementById("bell")]);
    }
    {
      const Y = await open({ orders: [A, B, Cc, D, E, F] });
      const cb = await openLimit(Y); cb.focus(); cb.click(); await until(() => Y.d.getElementById("ynSheet"));
      kinds.push(["the question", Y, () => !!Y.d.getElementById("ynSheet"), () => !!Y.d.activeElement && Y.d.activeElement.closest("#osheet .olim") != null, true]);
    }
    {
      const Pq = await open({ list: [part(0), part(1)], payq: true });
      await until(() => shown(Pq, "paySheet"));
      kinds.push(["Pay, asked again after a reload", Pq, () => shown(Pq, "paySheet"), () => Pq.d.activeElement === Pq.d.getElementById("payNow")]);
    }
    const kindRes = [];
    for (const [name, pg, up, focused, stacked] of kinds) {
      const was = up(), depth = stacked ? 2 : 1, pushed = stateIs(pg, depth);
      await goBack(pg); await until(() => !up());
      kindRes.push([name, was, pushed, !up(), stateIs(pg, stacked ? 1 : 0), focused()]);
    }
    ok(kinds.length === 8 && kindRes.every((r) => r.slice(1).every(Boolean)),
      "Pay, the thread, Sign in another device, the signed-out Sheet, the look choice, the bell, the question and the Pay question a reload left each stood on a pushed entry, closed on Back, and left the page at the entry below with the focus on the opener: " + JSON.stringify(kindRes));
    ok(kinds[6][1].d.getElementById("osheet") && !kinds[6][1].d.getElementById("osheet").hasAttribute("inert"),
      "and the question's Back left the New order sheet under it, open and let go of");

    /* ---- 3: the other Sheets' own controls hand their entry back too */
    const ownRes = [];
    {
      const H = await open({ list: [part(0), part(1)] });
      for (const [name, fn] of [["Pay, the close orb", (g) => g.d.getElementById("payX").click()], ["Pay, the scrim", (g) => g.d.getElementById("payScrim").click()], ["Pay, Escape", (g) => key(g, "Escape")]]) {
        const pill = H.d.getElementById("payNow"); pill.focus(); pill.click(); const up = stateIs(H, 1); fn(H);
        ownRes.push([name, up, await until(() => !shown(H, "paySheet") && stateIs(H, 0))]);
      }
      const T = await open();
      tab(T, "stmt"); await until(() => T.d.querySelector("#aThread .throw"));
      T.d.querySelector("#aThread .throw").click(); const upT = stateIs(T, 1); T.d.getElementById("thX").click();
      ownRes.push(["the thread, its orb", upT, await until(() => !shown(T, "thSheet") && stateIs(T, 0))]);
      const Lk = await open({ look: false }); await until(() => shown(Lk, "lookSheet")); const upL = stateIs(Lk, 1); Lk.d.getElementById("lookX").click();
      ownRes.push(["the look choice, its orb", upL, await until(() => !shown(Lk, "lookSheet") && stateIs(Lk, 0))]);
      const Lt = await open({ look: false }); await until(() => shown(Lt, "lookSheet")); Lt.d.querySelector("#lookSheet [data-look]").click();
      ownRes.push(["the look choice, a choice", true, await until(() => !shown(Lt, "lookSheet") && stateIs(Lt, 0))]);
      const Bl = await open({ standalone: true }); await until(() => !Bl.d.getElementById("bellBox").hidden); Bl.d.getElementById("bell").click(); const upB = stateIs(Bl, 1); Bl.d.getElementById("bellDone").click();
      ownRes.push(["the bell, Done", upB, await until(() => !shown(Bl, "bellSheet") && stateIs(Bl, 0))]);
      const So = await open({ orders: [A], fast: true }); So.st.down = true; await until(() => shown(So, "outSheet"), 300); await until(() => stateIs(So, 1)); const upS = stateIs(So, 1); So.d.getElementById("outX").click();
      ownRes.push(["the signed-out Sheet, its orb", upS, await until(() => !shown(So, "outSheet") && stateIs(So, 0))]);
      const Dv = await open(); tab(Dv, "stmt"); await until(() => [...Dv.d.querySelectorAll("#devSlot button")].some((b) => /^Sign in another device/.test(b.textContent.trim())));
      [...Dv.d.querySelectorAll("#devSlot button")].find((b) => /^Sign in another device/.test(b.textContent.trim())).click(); const upD = stateIs(Dv, 1); Dv.d.getElementById("devX").click();
      ownRes.push(["Sign in another device, its orb", upD, await until(() => !shown(Dv, "devSheet") && stateIs(Dv, 0))]);
      const Q = await open({ orders: [A, B, Cc, D, E, F] }); const cb = await openLimit(Q);
      cb.click(); await until(() => Q.d.getElementById("ynSheet")); const upQ = stateIs(Q, 2); Q.d.getElementById("ynKeep").click();
      ownRes.push(["the question, Keep it", upQ, await until(() => !Q.d.getElementById("ynSheet") && stateIs(Q, 1))]);
      const sheetStill = !!Q.d.getElementById("osheet"); await goBack(Q); await until(() => !Q.d.getElementById("osheet"));
      ownRes.push(["and then the New order sheet on its own entry", sheetStill, stateIs(Q, 0)]);
    }
    ok(ownRes.every((r) => r.slice(1).every(Boolean)), "the close orb, the scrim, Escape, Done, a choice and Keep it each hand their entry back: " + JSON.stringify(ownRes));
    ok(ownRes.length === 11, "and every one of the eleven was driven: " + ownRes.length);

    /* the page that closes a Sheet and one Back later has left, for every kind of Sheet: the base entry is the one before the page's own */
    const leaveRes = [];
    {
      const H = await open({ list: [part(0), part(1)] }); H.d.getElementById("payNow").click(); H.d.getElementById("payX").click(); await until(() => stateIs(H, 0));
      await goBack(H); leaveRes.push(["Pay", await until(() => stateIs(H, null))]);
      const T = await open(); tab(T, "stmt"); await until(() => T.d.querySelector("#aThread .throw")); T.d.querySelector("#aThread .throw").click(); T.d.getElementById("thX").click(); await until(() => stateIs(T, 0));
      await goBack(T); leaveRes.push(["the thread", await until(() => stateIs(T, null))]);
      const Lk = await open({ look: false }); await until(() => shown(Lk, "lookSheet")); Lk.d.getElementById("lookX").click(); await until(() => stateIs(Lk, 0));
      await goBack(Lk); leaveRes.push(["the look choice", await until(() => stateIs(Lk, null))]);
      const Bl = await open({ standalone: true }); await until(() => !Bl.d.getElementById("bellBox").hidden); Bl.d.getElementById("bell").click(); Bl.d.getElementById("bellDone").click(); await until(() => stateIs(Bl, 0));
      await goBack(Bl); leaveRes.push(["the bell", await until(() => stateIs(Bl, null))]);
      const Q = await open({ orders: [A, B, Cc, D, E, F] }); const cb = await openLimit(Q); cb.click(); await until(() => Q.d.getElementById("ynSheet"));
      Q.d.getElementById("ynX").click(); await until(() => stateIs(Q, 1)); Q.d.querySelector("#osheet .salt-sheet__close").click(); await until(() => stateIs(Q, 0));
      await goBack(Q); leaveRes.push(["the question and the New order sheet", await until(() => stateIs(Q, null))]);
    }
    ok(leaveRes.every((r) => r[1]), "after any Sheet is opened and closed by its own controls, one Back leaves the page: " + JSON.stringify(leaveRes));

    /* a lapse shuts the New order sheet and draws the signed-out Sheet at once: one entry, taken over, and the signed-out Sheet's Back leaves nothing behind */
    const Lp = await open({ orders: [A], fast: true });
    await openRow(Lp);
    ok(stateIs(Lp, 1), "the New order sheet is on its entry before the lapse");
    Lp.st.down = true; await until(() => shown(Lp, "outSheet"), 300);
    await flush();
    ok(shown(Lp, "outSheet") && !Lp.d.getElementById("osheet") && stateIs(Lp, 1) && Lp.push.length === 1 && Lp.go.length === 0 && Lp.w.history.length === Lp.len0 + 1,
      "a lapse that shuts the New order sheet and draws the signed-out Sheet leaves the one Sheet on one entry: " + JSON.stringify(Lp.w.history.state) + " pushes " + Lp.push.length + " length " + Lp.w.history.length);
    await goBack(Lp); await until(() => !shown(Lp, "outSheet"));
    ok(!shown(Lp, "outSheet") && stateIs(Lp, 0), "and Back closes it and lands on the base entry");

    /* ---- 4: stacked Sheets */
    const Q = await open({ orders: [A, B, Cc, D, E, F] });
    const cb = await openLimit(Q), osh = Q.d.getElementById("osheet");
    cb.focus(); cb.click(); cb.click(); await until(() => Q.d.getElementById("ynSheet")); await flush();
    ok(stateIs(Q, 2) && Q.push.length >= 2 && Q.d.querySelectorAll("#ynSheet").length === 1 && Q.w.history.length <= Q.len0 + 2,
      "the question over the New order sheet stands on a second entry, and two quick opens of it leave one question on one entry: state " + JSON.stringify(Q.w.history.state) + " pushes " + Q.push.length + " length " + Q.w.history.length);
    await goBack(Q); await until(() => !Q.d.getElementById("ynSheet"));
    ok(!Q.d.getElementById("ynSheet") && Q.d.getElementById("osheet") === osh && !osh.hasAttribute("inert") && stateIs(Q, 1) && Q.d.activeElement === cb,
      "the first Back closes the question only; the New order sheet stays, let go of, and the focus is on the Cancel that opened the question: focus " + lbl(Q.d.activeElement));
    await goBack(Q); await until(() => !Q.d.getElementById("osheet"));
    ok(!Q.d.getElementById("osheet") && stateIs(Q, 0) && noInert(Q), "the second Back closes the New order sheet and lands on the base entry");

    /* ---- 5: a Sheet that will not close, will not close for Back */
    const Pl = await open();
    await openRow(Pl);
    Pl.d.getElementById("oGo").click(); await until(() => Pl.d.getElementById("oPlace"));
    Pl.d.getElementById("oPlace").click(); await until(() => Pl.st.posts === 1);
    await goBack(Pl); await until(() => stateIs(Pl, 1));
    ok(!!Pl.d.getElementById("osheet") && stateIs(Pl, 1) && Pl.push.length === 2,
      "while Place is on its way, Back does not close the New order sheet, and its entry is put back: state " + JSON.stringify(Pl.w.history.state) + " pushes " + Pl.push.length);
    Pl.d.querySelector("#osheet .salt-sheet__close").click();
    ok(!!Pl.d.getElementById("osheet") && stateIs(Pl, 1), "and its close orb does not either, which is what Back is held to");
    Pl.st.held(); await until(() => !Pl.d.getElementById("oPlace") || !Pl.d.getElementById("oPlace").disabled);
    await goBack(Pl); const closed = await until(() => !Pl.d.getElementById("osheet"));
    ok(closed && stateIs(Pl, 0), "and once Place has answered, Back closes it");

    /* ---- 6: an entry left behind */
    const Rl = await open({ preState: { sheet: 2 }, base: false, list: [part(0), part(1)] });
    const cleared = Rl.w.history.state === null;
    Rl.d.getElementById("payNow").click(); const upR = stateIs(Rl, 1);
    await goBack(Rl); const shutR = await until(() => !shown(Rl, "paySheet"));
    ok(cleared && upR && shutR && Rl.w.history.state === null,
      "a page that loads on an entry still marked by a Sheet (a reload with the Sheet open) clears the mark, so a Sheet opened there still closes on its first Back: cleared " + cleared + " up " + upR + " closed " + shutR);
    const Fw = await open(); await openRow(Fw); Fw.d.querySelector("#osheet .salt-sheet__close").click(); await until(() => stateIs(Fw, 0));
    const lenFw = Fw.w.history.length; Fw.w.history.forward();
    await until(() => stateIs(Fw, 1), 60); await until(() => stateIs(Fw, 0));
    ok(stateIs(Fw, 0) && !Fw.d.getElementById("osheet") && Fw.w.history.length === lenFw,
      "a Forward onto the entry a closed Sheet left is stepped off at once, to the base entry, with no Sheet drawn: " + JSON.stringify(Fw.w.history.state));

    /* a place written into the address (the page's own replaceState) keeps the mark of the Sheet entry it lands on, or a Back onto that entry would read as the base's */
    const Mk = await open({ list: [part(0), part(1)] });
    Mk.d.getElementById("payNow").click(); const upM = stateIs(Mk, 1);
    Mk.d.querySelector('button[data-t="prices"]').click();
    const keptM = stateIs(Mk, 1) && Mk.w.location.hash === "#prices";
    await goBack(Mk); const shutM = await until(() => !shown(Mk, "paySheet"));
    ok(upM && keptM && shutM, "a place written into the address keeps the mark of the entry a Sheet stands on, and Back still closes the Sheet: up " + upM + " kept " + keptM + " closed " + shutM);

    /* ---- 7: no address with a key or a token is pushed */
    /* the last is not a road the page's own controls reach (a link's page has Continue and no door); its form is submitted by hand to ask the address alone */
    const keyRoads = [["/app#<key>", "https://site.test/app#" + KEY, KEY], ["/app#qr.<key>", "https://site.test/app#qr." + KEY, KEY], ["/app#code", "https://site.test/app#code", "#code"],
      ["/s/<token>", "https://site.test/s/" + TOK, TOK]];
    const keyRes = [];
    for (const [name, url, needle] of keyRoads) {
      const K = await open({ url, look: false, door: false });
      /* the code screen, where the page offers it, hands back to the door: a password signs in there, the address left exactly as it came */
      const toDoor = () => K.d.getElementById("codeDoor");
      await until(() => !K.d.getElementById("gate").hidden || (toDoor() && !K.d.getElementById("codeBox").hidden), 100);
      if (K.d.getElementById("gate").hidden && toDoor()) toDoor().click();
      K.d.getElementById("un").value = u; K.d.getElementById("pw").value = pass;
      K.d.getElementById("f").dispatchEvent(new K.w.Event("submit", { bubbles: true, cancelable: true }));
      await until(() => !K.d.getElementById("tabs").hidden);
      const up = await until(() => shown(K, "lookSheet"));
      const addr = K.w.location.href, lenUp = K.w.history.length;
      K.d.getElementById("lookX").click(); await flush();
      keyRes.push([name, up, K.push.length === 0 && K.go.length === 0, lenUp === K.len0 && K.w.history.length === K.len0, stateIs(K, 0), addr.includes(needle), !K.d.getElementById("lookSheet") || K.d.getElementById("lookSheet").hidden]);
    }
    ok(keyRes.every((r) => r.slice(1).every(Boolean)), "signed in at the door on an address carrying a key or a token (still in the address), the look Sheet opens and nothing is pushed, and its close takes no entry that was never pushed: " + JSON.stringify(keyRes));
    const Lk = await open({ url: "https://site.test/s/" + TOK, look: false, door: false });
    await until(() => !Lk.d.getElementById("link").hidden && !Lk.d.getElementById("linkGo").disabled);
    const before = Lk.push.length;
    Lk.d.getElementById("linkGo").click();
    await until(() => !Lk.d.getElementById("tabs").hidden); await until(() => shown(Lk, "lookSheet"));
    ok(before === 0 && Lk.w.location.pathname === "/" && Lk.push.length === 1 && Lk.push[0].at === "https://site.test/" && !JSON.stringify(Lk.push).includes(TOK) && stateIs(Lk, 1),
      "the page at /s/<token> pushes nothing while the link is waiting, and once it is spent the Sheet pushes the clean address, with no token in any entry: " + JSON.stringify(Lk.push) + " at " + Lk.w.location.href);

    /* ---- 8: Salt Account is unchanged, and the guest board has no script. His page is served at /all, an address the customer's rule would refuse anyway; it is read at / as
       well, where only his own page's refusal stands between the Sheet and a push */
    for (const at of ["/all", "/"]) {
      const errs = [], pushes = []; let work;
      const dom = new JSDOM(landingPage("", "nco", { master: "fixture-master", accounts: [] }), { url: "https://counter.fixture.test" + at, runScripts: "dangerously", pretendToBeVisual: true,
        beforeParse(w) {
          Object.defineProperty(w, "crypto", { value: webcrypto, configurable: true });
          w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder; w.scrollTo = () => {}; w.confirm = () => true;
          w.setTimeout = () => 0; w.clearTimeout = () => {}; w.setInterval = () => 0; w.clearInterval = () => {};
          w.addEventListener("error", (e) => errs.push(String(e.message)));
          const realPush = w.history.pushState.bind(w.history); w.history.pushState = (s, t, a) => { pushes.push(s); return realPush(s, t, a); };
          w.fetch = async () => ({ ok: true, status: 200, type: "basic", json: async () => ({ ok: true, accounts: [], refs: [], tiers: [], claims: [], threads: [], pools: [], lines: [], orders: [], drafts: [], refused: [], queue: [] }) });
          work = pageWork(w);
        } });
      wins.push(dom.window);
      const w = dom.window, d = w.document; await work.quiet();
      const len = w.history.length, up = !!d.getElementById("lookSheet") && !d.getElementById("lookSheet").hidden;
      d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); await flush();
      ok(up && pushes.length === 0 && len === 1 && w.history.length === len && w.history.state === null && d.getElementById("lookSheet").hidden && !errs.length,
        "Salt Account's look Sheet at " + at + " pushes nothing, Escape closes it as before and takes no entry: pushes " + pushes.length + " length " + w.history.length + "/" + len + " errors " + errs.length);
    }
    const { shutPage, notFoundPage } = await import("../stmt/page.js");
    const frames = [shutPage("n1"), notFoundPage("n1")];
    ok(frames.every((h) => h.length > 500 && !/<script/i.test(h) && !/popstate|pushState/.test(h)),
      "the shut page and the 404, which stand on the guest board's frame, carry no script, so nothing there can push an entry");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.stack || e)); } finally { for (const w of wins) { try { w.close(); } catch (e) { /* closed */ } } }
}
