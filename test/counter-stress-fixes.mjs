/* test/counter-stress-fixes.mjs: THE CUSTOMER SIDE OF THE STRESS RUN'S FINDINGS (13 Oct 2026, his yes: "Fix all six, one build"; the three that are the Counter's).
 *
 * The AFTER stress run of the Counter found focus falling to the page after a Sheet closed. What is proved here, each check red under its own mutation
 * (test/counter-stress-fixes.mutations.json) and red on 1548e0d8:
 *   4  every Sheet that closes gives the focus back to the control that opened it, through the one road (focusBack): the pay sheet from Home's Pay, the
 *      overdue Pay and an order's Pay, by the close orb, the scrim and Escape; found afresh if a redraw replaced the control while it was open; the
 *      signed-out Sheet to Sign in on the bar by every way; Sign in another device to its button, though its list is drawn again as the Sheet closes
 * Every assertion observes a signed-in page's window in jsdom. Every code, name and password is invented. */
import { webcrypto } from "node:crypto";

const BUILD = "b".repeat(16);

export async function run({ ok }) {
  const { landingPage } = await import("../stmt/page.js");
  const C = await import("../tools/stmt-crypto.mjs");
  const { JSDOM } = await import("jsdom");

  const kl = (n) => new Date(Date.now() + 8 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
  const iso = (m) => new Date(Date.now() - m * 60e3).toISOString();
  const until = async (f, n = 300) => { for (let i = 0; i < n && !f(); i++) await new Promise((r) => setTimeout(r, 15)); return !!f(); };
  const part = (i, extra = {}) => Object.assign({ date: kl(-9 + i), since: kl(-1), due: kl(2), late: false, rm: 100 + i, whole: 100 + i, product: "salt", qty: 1 + i, got: 1 + i, gotOn: kl(-1),
    resale: false, goods: 100 + i, deliv: 0, less: 0, rate: 100 }, extra);
  const ord = (id, x) => Object.assign({ id, product: "salt", qty: 1, unit: 100, total: 100, delivery: 0, paid: 0, moved: 0, mode: "collect", status: "placed",
    at: iso(30), history: [{ at: iso(30), status: "placed", by: "customer" }], msgs: [] }, x);
  const A = ord("20261013090001-csfa", { qty: 2.5, unit: 108, total: 270 }), B = ord("20261013090002-csfb", { product: "candy", unit: 12, total: 12 });
  const Cc = ord("20261013090003-csfc", { product: "oil", qty: 3, unit: 38, total: 115 }), D = ord("20261013090004-csfd", { product: "rice", unit: 9, total: 9 });
  const E = ord("20261013090005-csfe", { total: 100 }), F = ord("20261013090006-csff", { product: "oil", unit: 40, total: 40 });
  const OWED = ord("20261013090007-csfg", { status: "acknowledged", unit: 150, total: 150 });

  const u = "abcd-efgh", pass = "fixture-pass-13a", ck = await C.contentKey("test-secret", u);
  const wins = [], answer = (status, j) => ({ ok: status < 300, status, json: async () => j });
  /* a customer's page, signed in on an invented account: `list` is To pay now (a late part makes the overdue Pay), `orders` the orders, `fast` a quick poll so a lapse shows */
  const open = async ({ list = [], orders = [], fast = false } = {}) => {
    const st = { orders: orders.map((o) => ({ ...o })), down: false, devReads: 0, cancels: [] };
    const sum = +list.reduce((s, p) => s + p.rm, 0).toFixed(2), late = list.filter((p) => p.late);
    const pay = { term: 1, hide: 3, lock: 4, window: 60, now: { rm: sum, due: list.length ? list[0].due : null, parts: list },
      overdue: { rm: +late.reduce((s, p) => s + p.rm, 0).toFixed(2), parts: late }, coming: { rm: 0, parts: [] } };
    const stamped = { at: new Date(Date.now() - 3600e3).toISOString(), body: "<p>Live</p>", owed: sum, pay, buildId: BUILD };
    const body = { ok: true, wrap: await C.wrapKey(pass, ck), session: "sess-13a-abcdefghij", liveStatus: "current",
      live: Object.assign({ at: stamped.at, buildId: BUILD }, await C.encryptWith(ck, JSON.stringify(stamped))),
      env: await C.encryptWith(ck, JSON.stringify({ statements: [{ issued: "2026-09-01", label: "September", body: "<p>Statement</p>" }] })),
      prices: await C.encryptWith(ck, JSON.stringify({ at: new Date().toISOString(), week: { monday: kl(0), label: "This week" },
        products: [{ product: "salt", unit: "unit", basis: "yours", rate: 100, orders: 3, sizes: [{ q: 1, price: 100 }, { q: 2, price: 190 }] }], soon: [] })) };
    let html = landingPage(u, "ncsf", null);
    if (fast) html = html.replace(/var POLL_MS=[0-9]+/, "var POLL_MS=60");
    const dom = new JSDOM(html, { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true, beforeParse(win) {
      try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
      if (!win.TextEncoder) win.TextEncoder = TextEncoder;
      if (!win.TextDecoder) win.TextDecoder = TextDecoder;
      win.scrollTo = () => {}; win.open = () => null; win.HTMLElement.prototype.scrollIntoView = () => {};
      try { win.localStorage.setItem("salt-look", "tide"); } catch (e) { /* the look is kept, so its Sheet does not stand over the page this check reads */ }
      win.fetch = async (path, init) => {
        const p = String(path), m = (init && init.method) || "GET";
        if (p === "/open" || p === "/account") return answer(200, body);
        if (p === "/orders" && m === "GET") return st.down ? answer(401, { ok: false }) : answer(200, { ok: true, orders: JSON.parse(JSON.stringify(st.orders)), claims: [] });
        if (p === "/my/refs" && m === "GET") return answer(200, { ok: true, max: 10, refs: [] });
        if (p === "/devices") { st.devReads++; return answer(200, { ok: true, devices: [{ label: "Windows computer", here: true, at: iso(600), last: iso(1), kept: true }] }); }
        const c = /^[/]orders[/]([^/]+)[/]cancel$/.exec(p);
        if (c) { st.cancels.push(c[1]); return answer(500, { ok: false }); }
        return answer(404, { ok: false });
      };
    } });
    wins.push(dom.window);
    const w = dom.window, d = w.document;
    d.getElementById("un").value = u; d.getElementById("pw").value = pass;
    d.getElementById("f").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
    await until(() => !d.getElementById("tabs").hidden && !!d.getElementById("pOrder").textContent);
    if (list.length) await until(() => !d.getElementById("homeFoot").hidden);
    return { w, d, st };
  };
  const key = (pg, k) => pg.d.dispatchEvent(new pg.w.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
  const cancelBtn = (pg, id) => pg.d.querySelector('#pOrder .oscreen[data-order="' + id + '"] button[data-yn="cancel:' + id + '"]');
  const openOrder = async (pg, id) => { pg.d.querySelector('button[data-t="order"]').click();
    await until(() => pg.d.querySelector('#pOrder [data-row="' + id + '"]')); pg.d.querySelector('#pOrder [data-row="' + id + '"]').click();
    await until(() => pg.d.querySelector('#pOrder .oscreen[data-order="' + id + '"]')); return pg.d.querySelector('#pOrder .oscreen[data-order="' + id + '"]'); };
  const openLimit = async (pg) => { pg.d.querySelector('button[data-t="prices"]').click();
    await until(() => pg.d.querySelector("#pPrices .szrow")); pg.d.querySelector("#pPrices .szrow").click();
    await until(() => pg.d.querySelector("#osheet .olim button")); return pg.d.querySelector("#osheet .olim button"); };
  const payWays = [["the close orb", (pg) => pg.d.getElementById("payX").click()], ["the scrim", (pg) => pg.d.getElementById("payScrim").click()], ["Escape", (pg) => key(pg, "Escape")]];
  const sheetUp = (pg) => !pg.d.getElementById("paySheet").hidden;
  const lbl = (e) => (e ? (e.id || e.tagName) : "nothing");
  /* the controls are found by what they say, as a person finds them, and not by the key the page keeps to find them again */
  const payBtn = (root) => [...root.querySelectorAll("button")].find((b) => /^Pay RM/.test(b.textContent.trim()));
  const anotherBtn = (pg) => [...pg.d.querySelectorAll("#devSlot button")].find((b) => /^Sign in another device/.test(b.textContent.trim()));

  try {
    /* ---- 4: the pay sheet gives the focus back to the Pay that opened it */
    const H = await open({ list: [part(0), part(1)] });
    const homeRes = [];
    for (const [name, fn] of payWays) {
      const pill = H.d.getElementById("payNow");
      pill.focus(); pill.click();
      const was = sheetUp(H); fn(H);
      homeRes.push([name, was && !sheetUp(H) && H.d.activeElement === H.d.getElementById("payNow")]);
    }
    ok(homeRes.every((r) => r[1]), "Home's Pay: the close orb, the scrim and Escape each shut the pay sheet and give the focus back to that Pay, not to the page: " + JSON.stringify(homeRes)
      + " focus is " + lbl(H.d.activeElement));
    const p0 = H.d.getElementById("payNow"); p0.focus(); p0.click();
    const twin = p0.cloneNode(true); p0.replaceWith(twin);
    key(H, "Escape");
    ok(!p0.isConnected && H.d.activeElement === twin && !sheetUp(H),
      "a redraw that replaced the Pay while the sheet was open does not lose the focus: it goes to the Pay found again: " + lbl(H.d.activeElement));

    /* each of these draws the tab again while the sheet is open, as a poll does, so the Pay it was opened from is gone and the page finds the new one; a page apiece */
    const odRes = [];
    for (const [name, fn] of payWays) {
      const OD = await open({ list: [part(0, { late: true, due: kl(-2), since: kl(-3) })] });
      OD.d.querySelector('button[data-t="order"]').click();
      await until(() => payBtn(OD.d.getElementById("pOrder")));
      const b = payBtn(OD.d.getElementById("pOrder"));
      if (!b) { odRes.push([name, false]); continue; }
      b.focus(); b.click(); const was = sheetUp(OD);
      b.replaceWith(b.cloneNode(true));
      fn(OD);
      odRes.push([name, was && !sheetUp(OD) && !b.isConnected && OD.d.activeElement === payBtn(OD.d.getElementById("pOrder"))]);
    }
    ok(odRes.length === 3 && odRes.every((r) => r[1]), "the overdue Pay on Orders gives it back the same three ways, found again when the tab was drawn under the sheet: " + JSON.stringify(odRes));

    const oRes = [];
    for (const [name, fn] of payWays) {
      const O = await open({ orders: [OWED] });
      const scr = await openOrder(O, OWED.id), oScr = () => O.d.querySelector('#pOrder .oscreen[data-order="' + OWED.id + '"]'), b = payBtn(scr);
      if (!b) { oRes.push([name, false]); continue; }
      b.focus(); b.click(); const was = sheetUp(O);
      b.replaceWith(b.cloneNode(true));
      fn(O);
      oRes.push([name, was && !sheetUp(O) && !b.isConnected && O.d.activeElement === payBtn(oScr())]);
    }
    ok(oRes.length === 3 && oRes.every((r) => r[1]), "and an order's Pay, the same: " + JSON.stringify(oRes));

    /* ---- the signed-out Sheet: to Sign in on the bar, by every way */
    const S = await open({ orders: [A], fast: true });
    S.st.down = true;
    await until(() => !S.d.getElementById("outSheet").hidden, 300);
    const outWays = [["the close orb", (pg) => pg.d.getElementById("outX").click()], ["the scrim", (pg) => pg.d.getElementById("outScrim").click()], ["Escape", (pg) => key(pg, "Escape")]];
    const outRes = [];
    for (const [name, fn] of outWays) {
      if (S.d.getElementById("outSheet").hidden) { S.d.getElementById("lapseGo").click(); await until(() => !S.d.getElementById("outSheet").hidden, 200); }
      const was = !S.d.getElementById("outSheet").hidden; fn(S);
      outRes.push([name, was && S.d.getElementById("outSheet").hidden && S.d.activeElement === S.d.getElementById("lapseGo")]);
    }
    ok(outRes.every((r) => r[1]), "the signed-out Sheet gives the focus to Sign in on the bar by the close orb, the scrim and Escape: " + JSON.stringify(outRes) + " focus is " + lbl(S.d.activeElement));

    /* ---- Sign in another device: its list is drawn again as the Sheet closes, and the focus is on the new button */
    const V = await open();
    V.d.querySelector('button[data-t="stmt"]').click();
    await until(() => anotherBtn(V));
    const devRes = [];
    for (const [name, fn] of [["the close orb", (pg) => pg.d.getElementById("devX").click()], ["the scrim", (pg) => pg.d.getElementById("devScrim").click()], ["Escape", (pg) => key(pg, "Escape")]]) {
      const b = anotherBtn(V), reads = V.st.devReads;
      b.focus(); b.click();
      const was = !V.d.getElementById("devSheet").hidden; fn(V);
      await until(() => V.st.devReads > reads, 200); await new Promise((r) => setTimeout(r, 60));
      const now = anotherBtn(V);
      devRes.push([name, was && V.d.getElementById("devSheet").hidden && !!now && V.d.activeElement === now]);
    }
    ok(devRes.every((r) => r[1]), "Sign in another device keeps the focus on its button after the Sheet closes and the list is drawn again: " + JSON.stringify(devRes) + " focus is " + lbl(V.d.activeElement));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.stack || e)); } finally { for (const w of wins) { try { w.close(); } catch (e) { /* closed */ } } }
}
