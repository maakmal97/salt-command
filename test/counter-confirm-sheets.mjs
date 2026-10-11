/* test/counter-confirm-sheets.mjs: CANCELLING AND WITHDRAWING ASK IN A SHEET THAT SAYS WHAT GOES (Phase 7d part 1 of the Salt Account and
 * Counter redesign, his yes of 11 Oct 2026, decision 4: replace every native confirm() with a sheet that restates the customer and the
 * figure).
 *
 * On the customer's page Cancel this order, the same Cancel at the order limit and Withdraw a link each used the browser's confirm(). Each
 * now opens the system's Sheet over the page, restating what is lost (the order by its mark, size, word and figure; the link by its day,
 * its state and what it has done) with one danger action and a ghost that keeps it. The danger action sends the request the confirm let
 * through, the same body and the same id; nothing is sent before it. The order limit is said in words off the code's own limit. Every
 * assertion observes a signed-in page's window in jsdom: its markup, the requests its fetch saw and the cascade jsdom runs (no width
 * query; the 44 px and the two themes are measured in a real browser and recorded in the pull request). Each check below was proved red
 * by its own mutation (test/counter-confirm-sheets.mutations.json, run with tools/section.mjs). Every code, name and password is invented.
 *   1  no native dialog: confirm, alert and prompt throw and count, and not one is called across every flow below
 *   2  each of the three controls opens its Sheet (a labelled dialog the focus is in) and sends nothing yet
 *   3  the order Sheet restates the order (mark and its letter, shape and size, word, figure, day), what is lost, and the money:
 *      nothing paid, or the refund; the link Sheet restates the link (day, state, what it has done) and never its address
 *   4  one danger action (the system's danger ghost) and a ghost that keeps; no product word, no brand, no level, no style attribute
 *   5  the ghost that keeps closes it, sends nothing and gives the focus back to the control
 *   6  the danger action closes it and sends the request the old confirm let through: the path, the method, a body of the id alone, and
 *      the same id on a retry; a link's revoke sends its empty body
 *   7  Escape, the scrim and the close orb each close it, send nothing and give the focus back, for all three controls
 *   8  focus starts in the Sheet and Tab stays inside it, both ways, and a Tab from outside is pulled in
 *   9  at the limit the Sheet lies over the order sheet (its scrim above that sheet, its body above its scrim), Escape closes it alone, and
 *      the order sheet stays
 *  10  a redraw that replaced the control while the Sheet was open still gets the focus back, found again
 *  11  a lapse of the session takes it down and leaves the signed-out Sheet clear; so does Log out, leaving the door
 *  12  the limit is said in words off the code's own limit, in the Order tab and in the limit step, past it too; the words are keys
 *  13  the cascade: the system's recipes, a tap of 44 px by the system's own token, the danger tone a token of the system
 *  14  the practice accounts hold a case of each Sheet, and a fixture without one is red by its line */
import { webcrypto } from "node:crypto";

export async function run({ ok }) {
  const { landingPage, PLET } = await import("../stmt/page.js");
  const C = await import("../tools/stmt-crypto.mjs");
  const W = await import("../stmt/words.js");
  const O = await import("../stmt/orders.js");
  const { JSDOM } = await import("jsdom");

  const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
  const until = async (f, n = 300) => { for (let i = 0; i < n && !f(); i++) await new Promise((r) => setTimeout(r, 15)); return !!f(); };
  const iso = (m) => new Date(Date.now() - m * 60e3).toISOString();
  const money = (n) => "RM " + n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const ord = (id, x) => Object.assign({ id, product: "salt", qty: 1, unit: 100, total: 100, delivery: 0, paid: 0, moved: 0, mode: "collect", status: "placed",
    at: iso(30), history: [{ at: iso(30), status: "placed", by: "customer" }], msgs: [] }, x);
  const A = ord("20261010090001-ccsa", { product: "salt", qty: 2.5, unit: 108, total: 270 });
  const B = ord("20261010090002-ccsb", { product: "candy", qty: 1, unit: 12, total: 12, delivery: 3, mode: "deliver", place: "Taman Contoh", paid: 12, status: "acknowledged" });
  const Cc = ord("20261010090003-ccsc", { product: "oil", qty: 3, unit: 38, total: 115 });
  const D = ord("20261010090004-ccsd", { product: "rice", qty: 1, unit: 9, total: 9 });
  const E = ord("20261010090005-ccse", { product: "salt", qty: 1, total: 100, status: "ready", moved: 1 });
  const F = ord("20261010090006-ccsf", { product: "oil", qty: 1, unit: 40, total: 40 });
  const LINK = { id: "aaaa-bbbb", url: "https://site.test/g/aaaa-bbbb", qr: "data:image/svg+xml,x", made: "2026-09-18T00:00:00Z", opens: 2, last: "2026-09-19T00:00:00Z", state: "open" };
  const WAIT = { id: "cccc-dddd", url: "https://site.test/g/cccc-dddd", qr: "data:image/svg+xml,x", made: "2026-10-01T00:00:00Z", opens: 0, state: "waiting" };

  const u = "abcd-efgh", pass = "fixture-pass-7d1", ck = await C.contentKey("test-secret", u);
  const prices = { at: new Date().toISOString(), week: { monday: "2026-10-05", label: "5 to 11 Oct 2026" }, soon: [],
    products: [{ product: "salt", unit: "unit", basis: "yours", rate: 100, orders: 3, sizes: [{ q: 1, price: 100 }, { q: 2, price: 190 }] }] };
  const cardDoc = { at: "2026-10-01T00:00:00Z", products: [{ product: "salt", name: "Salt", unit: "unit",
    summary: { bought: 100, soldFor: 0, onward: 0, introduced: 0, referred: 0 }, reward: null, lines: [{ date: "2026-10-01", kind: "own", qty: 1, rm: 100 }] }] };
  const body = { ok: true, assoc: true, wrap: await C.wrapKey(pass, ck), session: "sess-7d1-abcdefghij",
    env: await C.encryptWith(ck, JSON.stringify({ statements: [{ issued: "2026-09-01", label: "September", body: "<p>Statement</p>" }] })),
    prices: await C.encryptWith(ck, JSON.stringify(prices)),
    card: Object.assign({ at: cardDoc.at }, await C.encryptWith(ck, JSON.stringify(cardDoc))) };

  const native = [], wins = [];
  const answer = (status, j) => ({ ok: status < 300, status, json: async () => j });
  /* a customer's page, signed in, on an invented account holding `orders` and `refs`; `fast` shortens the poll so a change shows */
  const open = async ({ orders = [], refs = [], fast = false }) => {
    const st = { orders: orders.map((o) => ({ ...o })), refs: refs.map((r) => ({ ...r })), log: [], down: false, cancel: "ok", revoke: "ok" };
    const html = landingPage(u, "n7d1", null), served = fast ? html.replace(/var POLL_MS=[0-9]+/, "var POLL_MS=60") : html;
    const dom = new JSDOM(served, { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true, beforeParse(win) {
      try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
      if (!win.TextEncoder) win.TextEncoder = TextEncoder;
      if (!win.TextDecoder) win.TextDecoder = TextDecoder;
      win.scrollTo = () => {}; win.HTMLElement.prototype.scrollIntoView = () => {};
      for (const k of ["confirm", "alert", "prompt"]) win[k] = () => { native.push(k); throw new Error("the browser's " + k + " was called"); };
      win.fetch = async (path, init) => {
        const p = String(path), m = (init && init.method) || "GET", j = init && init.body ? JSON.parse(init.body) : null;
        if (p === "/open" || p === "/account") return answer(200, body);
        if (p === "/orders" && m === "GET") return st.down ? answer(401, { ok: false }) : answer(200, { ok: true, orders: JSON.parse(JSON.stringify(st.orders)), claims: [] });
        if (p === "/my/refs" && m === "GET") return answer(200, { ok: true, max: 10, refs: st.refs });
        let c = /^[/]orders[/]([^/]+)[/]cancel$/.exec(p);
        if (c) {
          st.log.push({ p, m, j, ct: ((init && init.headers) || {})["content-type"], session: ((init && init.headers) || {})["X-Stmt-Session"] });
          if (st.cancel !== "ok") return answer(500, { ok: false });
          st.orders = st.orders.map((o) => (o.id === c[1] ? { ...o, status: "cancelled" } : o));
          return answer(200, { ok: true });
        }
        c = /^[/]my[/]refs[/]([^/]+)[/]revoke$/.exec(p);
        if (c) {
          st.log.push({ p, m, j });
          if (st.revoke !== "ok") return answer(500, { ok: false });
          st.refs = st.refs.map((r) => (r.id === c[1] ? { ...r, state: "withdrawn" } : r));
          return answer(200, { ok: true });
        }
        return answer(404, { ok: false });
      };
    } });
    wins.push(dom.window);
    const w = dom.window, d = w.document;
    d.getElementById("un").value = u; d.getElementById("pw").value = pass;
    d.getElementById("f").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
    await until(() => d.querySelector("#pOrder [data-row]"));
    return { w, d, st };
  };
  const key = (pg, k, shift = false) => { const e = new pg.w.KeyboardEvent("keydown", { key: k, shiftKey: shift, bubbles: true, cancelable: true });
    (pg.d.activeElement || pg.d.body).dispatchEvent(e); return e; };
  const sheet = (pg) => pg.d.getElementById("ynSheet");
  const sends = (pg) => pg.st.log.length;
  const openOrder = async (pg, id) => { pg.d.querySelector('button[data-t="order"]').click();
    await until(() => pg.d.querySelector('#pOrder [data-row="' + id + '"]')); pg.d.querySelector('#pOrder [data-row="' + id + '"]').click();
    await until(() => pg.d.querySelector('#pOrder .oscreen[data-order="' + id + '"] button[data-yn="cancel:' + id + '"]'));
    return pg.d.querySelector('#pOrder .oscreen[data-order="' + id + '"] button[data-yn="cancel:' + id + '"]'); };
  /* the order sheet at its limit: a size tapped on Prices opens it on the open orders when five are open */
  const openLimit = async (pg) => { pg.d.querySelector('button[data-t="prices"]').click();
    await until(() => pg.d.querySelector("#pPrices .szrow")); pg.d.querySelector("#pPrices .szrow").click();
    await until(() => pg.d.querySelector("#osheet .olim button")); return pg.d.querySelector("#osheet .olim button"); };
  const openLinks = async (pg) => { pg.d.querySelector('button[data-t="card"]').click();
    await until(() => pg.d.querySelector('#pCard button[data-yn="link:' + LINK.id + '"]')); return pg.d.querySelector('#pCard button[data-yn="link:' + LINK.id + '"]'); };

  try {
    /* ---- 2 to 6, the order's own Cancel: a placed order and an order paid before anything moved */
    const P = await open({ orders: [A, B] });
    const cancelA = await openOrder(P, A.id);
    cancelA.focus(); cancelA.click();
    const sh = sheet(P), titleOf = sh && P.d.getElementById(sh.getAttribute("aria-labelledby"));
    ok(!!sh && sh.getAttribute("role") === "dialog" && sh.getAttribute("aria-modal") === "true" && t(titleOf) === W.EN["yn.orderH"] && P.d.activeElement === sh && sends(P) === 0,
      "Cancel this order opens a Sheet, a dialog labelled by its question with the focus in it, and nothing is sent yet: " + JSON.stringify({ title: t(titleOf), sends: sends(P), focusInSheet: P.d.activeElement === sh }));

    /* 3 and 4: what it says */
    const mt = sh.querySelector(".mtile"), say = t(sh);
    ok(!!mt && t(mt.querySelector(".sr")) === "Cube 2.5 units" && t(mt.querySelector(".mq")) === "Cube, 2.5 units" && t(mt.querySelector("svg.psym text.plet")) === PLET.salt,
      "the Sheet restates the order by its mark with its letter, the shape and the size read aloud, and the shape and the size under the mark (7c): " + JSON.stringify(t(mt)));
    ok(t(sh.querySelector(".salt-ledger__value")) === money(270) && /^Placed /.test(t(sh.querySelector(".salt-ledger__flag"))) && /Placed$/.test(t(sh.querySelector(".salt-ledger__label"))),
      "and by its word and its figure and the day it was placed: " + JSON.stringify([t(sh.querySelector(".salt-ledger__label")), t(sh.querySelector(".salt-ledger__value")), t(sh.querySelector(".salt-ledger__flag"))]));
    ok(say.includes(W.EN["yn.orderLost"]) && say.includes(W.EN["yn.orderNone"]) && !say.includes("refunded"),
      "it says what is lost, and that nothing is paid on this one, so nothing is owed: " + JSON.stringify(say));
    const go = P.d.getElementById("ynGo"), keep = P.d.getElementById("ynKeep");
    ok(sh.querySelectorAll(".salt-ghost--danger").length === 1 && go.classList.contains("salt-ghost--danger") && go.classList.contains("salt-ghost") && t(go) === W.EN["ord.cancel"]
      && keep.classList.contains("salt-ghost") && !keep.classList.contains("salt-ghost--danger") && t(keep) === W.EN["yn.keepOrder"]
      && sh.classList.contains("salt-sheet") && P.d.getElementById("ynScrim").classList.contains("salt-sheet-scrim") && !!P.d.getElementById("ynX").classList.contains("salt-orb"),
      "one danger action, the system's danger ghost, and a ghost that keeps, on the system's Sheet with its scrim and its close orb: " + JSON.stringify([go.className, keep.className]));
    const banned = /\b(salt|oil|candy|rice|spare)\b|Titanium|Platinum|Gold|Silver|Bronze|Ambassador|Tier|Level|Counter/i;
    ok(!banned.test(say) && !banned.test(go.textContent + keep.textContent) && !P.d.getElementById("ynWrap").querySelector("[style]") && !/[A-Z]{2,}[0-9]-[A-Z]{3}/.test(say),
      "it names no product, no brand, no level and no code, and carries no style attribute: " + JSON.stringify(say));

    /* 5: keep */
    keep.click();
    ok(!sheet(P) && !P.d.getElementById("ynWrap") && sends(P) === 0 && P.d.activeElement === cancelA,
      "the ghost that keeps closes the Sheet, sends nothing and gives the focus back to the control that opened it");

    /* 6: the danger action, a refusal and a retry; the id the old confirm path sent */
    P.st.cancel = "500";
    cancelA.click(); P.d.getElementById("ynGo").click();
    await until(() => sends(P) === 1);
    ok(!sheet(P) && sends(P) === 1, "the danger action closes the Sheet at once and sends the request: " + sends(P));
    await until(() => P.d.querySelector('#pOrder .oscreen[data-order="' + A.id + '"] button[data-yn="cancel:' + A.id + '"]'));
    const again = P.d.querySelector('#pOrder .oscreen[data-order="' + A.id + '"] button[data-yn="cancel:' + A.id + '"]');
    again.click(); P.d.getElementById("ynGo").click();
    await until(() => sends(P) === 2);
    const [r1, r2] = P.st.log;
    ok(r1.p === "/orders/" + A.id + "/cancel" && r1.m === "POST" && JSON.stringify(Object.keys(r1.j)) === '["rid"]' && O.RID_RE.test(r1.j.rid) && r1.ct === "application/json" && !!r1.session,
      "the request is the one the confirm let through: a POST to the order's cancel, a body of the id alone, under the session: " + JSON.stringify(r1));
    ok(!!r2 && r2.j.rid === r1.j.rid, "and a retry after a refusal carries the same id, the Sheet being only the question in front: " + JSON.stringify([r1.j, r2 && r2.j]));
    P.st.cancel = "ok";
    await until(() => P.d.querySelector('#pOrder .oscreen[data-order="' + A.id + '"] button[data-yn="cancel:' + A.id + '"]'));
    P.d.querySelector('#pOrder .oscreen[data-order="' + A.id + '"] button[data-yn="cancel:' + A.id + '"]').click(); P.d.getElementById("ynGo").click();
    await until(() => sends(P) === 3);
    ok(P.st.log[2].j.rid === r1.j.rid, "and so does the one that lands: the same id all the way through");

    /* 3 again: an order paid before anything moved names the refund */
    const cancelB = await openOrder(P, B.id);
    cancelB.click();
    const shB = sheet(P), sayB = t(shB);
    ok(!!shB && t(shB.querySelector(".salt-ledger__value")) === money(15) && sayB.includes(W.fill(W.EN["yn.orderPaid"], { rm: money(12) }, "en")) && !sayB.includes(W.EN["yn.orderNone"])
      && /Confirmed$/.test(t(shB.querySelector(".salt-ledger__label"))) && t(shB.querySelector(".mtile .sr")) === "Lozenge 1 unit",
      "an order paid before anything moved says its figure with the delivery, and the refund and not that nothing is paid: " + JSON.stringify(sayB));
    P.d.getElementById("ynKeep").click();

    /* 7: Escape, the scrim and the close orb, on the order's Cancel */
    const closers = [["Escape", (pg) => key(pg, "Escape")], ["the scrim", (pg) => pg.d.getElementById("ynScrim").click()], ["the close orb", (pg) => pg.d.getElementById("ynX").click()]];
    const sendsBefore = sends(P), res = [];
    for (const [name, fn] of closers) {
      cancelB.focus(); cancelB.click();
      const was = !!sheet(P); fn(P);
      res.push([name, was && !sheet(P) && !P.d.getElementById("ynWrap") && P.d.activeElement === cancelB]);
    }
    ok(res.every((r) => r[1]) && sends(P) === sendsBefore, "Escape, the scrim and the close orb each close the order's Sheet, send nothing and give the focus back: " + JSON.stringify(res));

    /* 8: Tab stays inside */
    cancelB.click();
    const f0 = P.d.activeElement === sheet(P);
    P.d.getElementById("ynKeep").focus(); const e1 = key(P, "Tab"); const wrapFwd = e1.defaultPrevented && P.d.activeElement === P.d.getElementById("ynX");
    const e2 = key(P, "Tab", true); const wrapBack = e2.defaultPrevented && P.d.activeElement === P.d.getElementById("ynKeep");
    P.d.getElementById("ynGo").focus(); const e3 = key(P, "Tab"); const inner = !e3.defaultPrevented;
    sheet(P).focus(); const e4 = key(P, "Tab", true); const fromBox = e4.defaultPrevented && P.d.activeElement === P.d.getElementById("ynKeep");
    cancelB.focus(); const e5 = key(P, "Tab"); const pulled = e5.defaultPrevented && P.d.activeElement === P.d.getElementById("ynX");
    ok(f0 && wrapFwd && wrapBack && inner && fromBox && pulled,
      "focus starts in the Sheet and Tab stays in it: the last wraps to the first, Shift+Tab the other way, a Tab between two just moves, and a Tab from outside is pulled in: "
      + JSON.stringify({ f0, wrapFwd, wrapBack, inner, fromBox, pulled }));
    P.d.getElementById("ynKeep").click();

    /* ---- the order limit: six open, the sentence in words, the Sheet over the order sheet */
    const L = await open({ orders: [A, B, Cc, D, E, F], fast: true });
    const lim = t(L.d.getElementById("oLimit")), wantLine = W.fill(W.EN["sh.limit"], { n: W.EN["num." + O.MAX_OPEN] }, "en");
    const cb = await openLimit(L);
    const inSheet = t(L.d.querySelector("#osheet .salt-insight"));
    ok(lim === wantLine && inSheet === wantLine && /^Five open orders is the most\./.test(lim) && O.MAX_OPEN === 5,
      "the limit is said in words off the code's own limit, in the Order tab and in the limit step, though six are open: " + JSON.stringify({ lim, inSheet }));
    const limRows = [...L.d.querySelectorAll("#osheet .salt-ledger__row")].map((r) => ({ shape: t(r.querySelector(".mtile .sr")), amount: t(r.querySelector(".salt-ledger__value")), cancel: !!r.querySelector("button") }));
    ok(limRows.length === 6 && limRows[0].shape === "Cube 2.5 units" && limRows.map((r) => r.shape).join("|") === "Cube 2.5 units|Lozenge 1 unit|Droplet 3 units|Capsule 1 unit|Cube 1 unit|Droplet 1 unit"
      && limRows.map((r) => r.amount).join("|") === [270, 15, 115, 9, 100, 40].map(money).join("|") && limRows.filter((r) => r.cancel).length === 5 && !limRows[4].cancel,
      "the limit step lists the open orders by mark, shape and amount, each with its own Cancel where the goods have not moved: " + JSON.stringify(limRows));
    cb.focus(); cb.click();
    const shL = sheet(L), osh = L.d.getElementById("osheet");
    const z = (e) => +L.w.getComputedStyle(e).zIndex, oz = z(osh.querySelector(".salt-sheet")), yScrim = z(L.d.getElementById("ynScrim")), yBox = z(shL);
    ok(!!shL && sends(L) === 0 && L.d.activeElement === shL && !!osh && yScrim > oz && yBox > yScrim
      && t(shL.querySelector(".mtile .sr")) === "Cube 2.5 units" && t(shL.querySelector(".salt-ledger__value")) === money(270),
      "Cancel at the limit opens the Sheet, restating that order, its scrim above the order sheet and its body above its scrim so that it lies over it, and sends nothing: "
      + JSON.stringify({ sends: sends(L), orderSheet: oz, scrim: yScrim, sheet: yBox }));
    key(L, "Escape");
    ok(!sheet(L) && !!L.d.getElementById("osheet") && L.d.getElementById("osheet") === osh && L.d.activeElement === cb && sends(L) === 0,
      "Escape closes the Sheet alone: the order sheet under it stays open, and the focus goes back to the Cancel that was tapped");
    const l2 = [];
    for (const [name, fn] of closers) {
      cb.focus(); cb.click(); const was = !!sheet(L); fn(L);
      l2.push([name, was && !sheet(L) && !!L.d.getElementById("osheet") && L.d.activeElement === cb]);
    }
    cb.click(); L.d.getElementById("ynKeep").click(); l2.push(["the ghost", !sheet(L) && L.d.activeElement === cb]);
    ok(l2.every((r) => r[1]) && sends(L) === 0, "and the scrim, the close orb and the ghost close it the same way there, sending nothing: " + JSON.stringify(l2));

    /* 10: a redraw took the control away while the Sheet was open */
    cb.click();
    L.st.orders = L.st.orders.map((o) => (o.id === Cc.id ? { ...o, msgs: [{ by: "desk", text: "ring first", at: iso(1) }] } : o));
    await until(() => !cb.isConnected, 200);
    const gone = !cb.isConnected && !!sheet(L);
    L.d.getElementById("ynKeep").click();
    const back = L.d.activeElement;
    ok(gone && !!back && back.getAttribute("data-yn") === "limit:" + A.id && back.isConnected && back !== cb,
      "a redraw that replaced the control while the Sheet was open does not lose the focus: it goes to the control found again: " + JSON.stringify({ gone, back: back && back.getAttribute("data-yn") }));

    /* 6 at the limit: the danger action sends the same request, then the sheet goes on to the form */
    L.d.querySelector('#osheet button[data-yn="limit:' + A.id + '"]').click();
    L.d.getElementById("ynGo").click();
    await until(() => sends(L) === 1);
    const rl = L.st.log[0];
    ok(rl.p === "/orders/" + A.id + "/cancel" && rl.m === "POST" && JSON.stringify(Object.keys(rl.j)) === '["rid"]' && O.RID_RE.test(rl.j.rid) && !sheet(L),
      "and its danger action sends that order's cancel with the id alone, as the confirm did: " + JSON.stringify(rl));

    /* ---- Withdraw a link: an open one and one waiting on him */
    const K = await open({ orders: [A], refs: [LINK, WAIT] });
    const wd = await openLinks(K);
    wd.focus(); wd.click();
    const shK = sheet(K), sayK = t(shK);
    ok(!!shK && sends(K) === 0 && K.d.activeElement === shK && t(K.d.getElementById("ynT")) === W.EN["yn.linkH"] && shK.getAttribute("role") === "dialog",
      "Withdraw opens its Sheet, a dialog with the focus in it, and sends nothing yet: " + JSON.stringify({ sends: sends(K) }));
    ok(sayK.includes(W.fill(W.EN["lnk.made"], { d: "18 Sep 2026" }, "en")) && /Open/.test(t(shK.querySelector(".salt-ledger__value"))) && sayK.includes("Opened 2 times, last 19 Sep 2026.")
      && sayK.includes(W.EN["yn.linkLost"]) && !sayK.includes(LINK.id) && !sayK.includes("https://") && t(K.d.getElementById("ynGo")) === W.EN["yn.linkGo"] && t(K.d.getElementById("ynKeep")) === W.EN["yn.keepLink"],
      "it restates the link by its day, its state and what it has done, says what is lost, and never repeats its address: " + JSON.stringify(sayK));
    K.d.getElementById("ynKeep").click();
    ok(!sheet(K) && sends(K) === 0 && K.d.activeElement === wd, "the ghost closes it, nothing is sent, and the focus goes back to Withdraw");
    const waitWd = K.d.querySelector('#pCard button[data-yn="link:' + WAIT.id + '"]');
    waitWd.click();
    ok(/Waiting/.test(t(sheet(K).querySelector(".salt-ledger__value"))) && t(sheet(K)).includes(W.EN["lnk.lineWaiting"]), "a link waiting on him says so in its Sheet: " + JSON.stringify(t(sheet(K))));
    K.d.getElementById("ynKeep").click();
    const l3 = [];
    for (const [name, fn] of closers) { wd.focus(); wd.click(); const was = !!sheet(K); fn(K); l3.push([name, was && !sheet(K) && K.d.activeElement === wd]); }
    ok(l3.every((r) => r[1]) && sends(K) === 0, "Escape, the scrim and the close orb close it, send nothing and give the focus back to Withdraw: " + JSON.stringify(l3));
    /* 10 for a link: a redraw of the card while the Sheet is open */
    wd.click();
    K.d.dispatchEvent(new K.w.Event("visibilitychange"));   /* a return to the page reads the account again and draws it again */
    await until(() => !wd.isConnected, 200);
    const wd2 = K.d.querySelector('#pCard button[data-yn="link:' + LINK.id + '"]');
    const redrawn = !!wd2 && wd2 !== wd && !wd.isConnected;
    K.d.getElementById("ynKeep").click();
    ok(redrawn && K.d.activeElement === wd2, "and a card drawn again under the Sheet gets the focus back on the new Withdraw: " + JSON.stringify({ redrawn }));
    (K.d.querySelector('#pCard button[data-yn="link:' + LINK.id + '"]') || wd).click();
    K.d.getElementById("ynGo").click();
    await until(() => sends(K) === 1);
    const rk = K.st.log[0];
    ok(rk.p === "/my/refs/" + LINK.id + "/revoke" && rk.m === "POST" && JSON.stringify(rk.j) === "{}" && !sheet(K),
      "the danger action withdraws that link with the empty body the confirm path sent: " + JSON.stringify(rk));
    /* 8 and 4 on the link's Sheet are the order's: one Sheet, one set of controls */
    await until(() => !K.d.querySelector('#pCard button[data-yn="link:' + LINK.id + '"]'));

    /* ---- a lapse takes it down and leaves the signed-out Sheet clear */
    const S = await open({ orders: [A], fast: true });
    const cS = await openOrder(S, A.id);
    cS.click();
    const up = !!sheet(S);
    S.st.down = true;
    await until(() => !sheet(S), 200);
    await until(() => !S.d.getElementById("outSheet").hidden, 200);
    ok(up && !sheet(S) && !S.d.getElementById("ynWrap") && !S.d.getElementById("outSheet").hidden && !S.d.getElementById("lapse").hidden && sends(S) === 0,
      "a lapse of the session while the Sheet is open takes it down: nothing lies over the signed-out Sheet, and nothing was sent: "
      + JSON.stringify({ up, ynGone: !sheet(S), out: !S.d.getElementById("outSheet").hidden }));

    /* ---- Log out takes it down too */
    const G = await open({ orders: [A] });
    const cG = await openOrder(G, A.id);
    cG.click();
    const upG = !!sheet(G);
    G.d.getElementById("lock").click(); G.d.getElementById("lock").click();   /* a tap and a tap again (7d part 2) */
    ok(upG && !sheet(G) && !G.d.getElementById("ynWrap") && !G.d.getElementById("f").closest("[hidden]") && sends(G) === 0,
      "Log out with the Sheet open takes it down, leaving the door and not the question: " + JSON.stringify({ upG }));

    /* ---- 1: not once the browser's own dialog */
    ok(native.length === 0, "not one confirm, alert or prompt was called across every flow above (each throws and counts): " + JSON.stringify(native));

    /* ---- 12 the words are keys; the old questions are gone */
    ok(["ord.cancelAsk", "ord.cancelAskPaid", "lnk.withdrawAsk"].every((k) => !(k in W.EN)) && ["yn.orderH", "yn.orderLost", "yn.orderPaid", "yn.orderNone", "yn.keepOrder", "yn.linkH", "yn.linkLost", "yn.linkGo", "yn.keepLink"].every((k) => typeof W.EN[k] === "string")
      && /\{n\}/.test(W.EN["sh.limit"]) && W.EN["num.5"] === "Five",
      "every word is a key in the table, the three browser questions' keys are gone, and the limit's figure is a slot filled from the number's word");

    /* ---- 13 the cascade */
    const cs = (e) => P.w.getComputedStyle(e);
    cancelB.click();
    const tap = { go: cs(P.d.getElementById("ynGo")).minHeight, keep: cs(P.d.getElementById("ynKeep")).minHeight, x: cs(P.d.getElementById("ynX")).width + "|" + cs(P.d.getElementById("ynX")).height };
    const rules = [...P.d.styleSheets].flatMap((s) => [...s.cssRules]).filter((r) => r.selectorText === ".ynsheet .salt-ghost--danger");
    const tone = rules.length === 1 ? rules[0].style.getPropertyValue("--salt-ghost-tone") : "";
    ok(tap.go === "var(--salt-tap)" && tap.keep === "var(--salt-tap)" && tap.x === "var(--salt-tap)|var(--salt-tap)" && tone === "var(--salt-ember)" && !/#[0-9a-f]{3,8}\b|rgb/i.test(rules.length ? rules[0].cssText : "#fff"),
      "a tap is 44 px by the system's own token on both answers and the close orb, and the danger action's tone is the system's ember, never a literal: " + JSON.stringify({ tap, tone }));
    P.d.getElementById("ynKeep").click();

    /* ---- 14 the practice accounts hold a case of each Sheet */
    const TF = await import("../tools/testfix.mjs"), all = TF.buildAll(new Date());
    const paid = TF.FEATURES.map(([n]) => n).find((n) => /paid before anything moved/.test(n)), atLimit = TF.FEATURES.map(([n]) => n).find((n) => /at the limit/.test(n));
    const strip = (keep) => TF.missing(Object.fromEntries(Object.entries(all).map(([s, f]) => [s, Object.assign({}, f, { orders: f.orders.filter(keep) })])));
    const noPaid = strip((o) => !/ex47$/.test(o.id)), noOpen = strip((o) => !O.OPEN_STATES.includes(o.status));
    ok(!!paid && !!atLimit && TF.missing(all).length === 0 && noPaid.includes(paid) && !noPaid.includes(atLimit) && noOpen.includes(atLimit) && noOpen.includes(paid),
      "the practice accounts show every Sheet, an order paid before anything moved, the order limit and the links, and a fixture without a case is red by its line: " + JSON.stringify({ paid: paid || null, atLimit: atLimit || null, missing: TF.missing(all), noPaid, noOpen: noOpen.length }));
  } finally { for (const w of wins) { try { w.close(); } catch (e) { /* jsdom */ } } }
}
