/* test/test-surface-page.mjs: P6 of the Counter test surface (his answers of 18 Oct 2026, Asks 1, 6, 7 and 8). The page under a base.
   1. a real page carries nothing of the test surface: the customer's and Salt Admin's, with no test argument or a null one, have no
      shim, channel or base, and keep their manifest;
   2. the customer view signs in by itself as the account named, with the published test password, and every request it makes is under
      /all/test/c (a stub refuses any other path);
   3. it writes and removes no localStorage key but under salt-test:, and a real phone's remembered key is left as it was;
   4. it registers no service worker and asks for no passkey;
   5. it re-reads every 2 seconds, not 10;
   6. a write that went through in one pane is told on the channel, and the other pane re-reads at once;
   7. Salt Admin in test draws four places, Needs you, Orders, Payments and Chat, no Record, Shop, inputs, Approve, account list, links
      or + orb, reads only the examples' orders, payments and chats under /all/test/maker, and an address of Record lands on Needs you;
   8. an example order's Accept carries his Pay first switch into the preview and the Accept, and its preview is drawn as a practice
      order, with no margin or flags;
   9. the two views are served inside /all's gate, framed by this origin alone, Salt Admin's with no master, the customer's only for a
      test account. Every code and password here is invented, but the test password, which is published. */
import { webcrypto } from "node:crypto";
import { surface } from "./test-surface-harness.mjs";

export async function run({ ok, pageWork }) {
  const P = await import("../stmt/page.js");
  const C = await import("../tools/stmt-crypto.mjs");
  const { JSDOM } = await import("jsdom");
  const until = async (f, n = 200) => { for (let i = 0; i < n && !f(); i++) await new Promise((r) => setTimeout(r, 15)); return f(); };
  const wins = [];
  const at = new Date(Date.now() - 3600e3).toISOString();

  /* a channel shared by the panes of one test, as the browser's BroadcastChannel is shared by one origin's pages */
  const bus = new Set();
  class Channel {
    constructor(name) { this.name = name; this.onmessage = null; bus.add(this); }
    postMessage(data) { for (const c of bus) if (c !== this && c.name === this.name && c.onmessage) c.onmessage({ data }); }
    close() { bus.delete(this); }
  }

  /* ---- 1: real pages */
  const bull = { lines: ["Open as usual"] }, own = { master: "m", accounts: [] };
  const real = [P.landingPage("0000-0002", "n1", null, bull), P.landingPage("0000-0002", "n1", null, bull, null), P.landingPage("", "n1", own, bull), P.landingPage("", "n1", own, bull, null)];
  ok(real[0] === real[1] && real[2] === real[3] && real.every((h) => !/salt-test|BroadcastChannel|TCFG|\/all\/test\/(c|maker|admin)/.test(h) && /rel="manifest"/.test(h)) && /var TESTING=false/.test(real[2]),
    "A real page carries nothing of the test surface: no shim, channel or base, and its manifest stays");

  /* ---- the customer view */
  const u = "0000-0002", pass = "0000-0000-0000-0000", ck = await C.contentKey("test-secret", u);
  const prices = await C.encryptWith(ck, JSON.stringify({ at: new Date().toISOString(), week: { monday: at.slice(0, 10), label: "This week" },
    products: [{ product: "salt", unit: "unit", basis: "yours", rate: 10, orders: 1, sizes: [{ q: 1, price: 10 }] }], soon: [] }));
  const opened = { ok: true, wrap: await C.wrapKey(pass, ck), session: "sess-surface", liveStatus: "none", env: await C.encryptWith(ck, JSON.stringify({ statements: [] })), prices };
  const customer = async (name) => {
    const seen = { paths: [], bodies: [], writes: [], sets: [], intervals: [], sw: 0, pk: 0 };
    let work;
    const dom = new JSDOM(P.landingPage(u, "nc", null, null, { base: "/all/test/c", u }), { url: "https://site.test/all/test/c?u=" + u, runScripts: "dangerously", pretendToBeVisual: true, beforeParse(win) {
      try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
      win.scrollTo = () => {}; win.open = () => null; win.BroadcastChannel = Channel;
      win.localStorage.setItem("salt-look", "tide"); win.localStorage.setItem("salt-stmt-seen", "real-phone");
      const S = win.Storage.prototype, set = S.setItem, rm = S.removeItem;
      S.setItem = function (k, v) { seen.writes.push(String(k)); seen.sets.push(String(k)); return set.call(this, k, v); };
      S.removeItem = function (k) { seen.writes.push(String(k)); return rm.call(this, k); };
      Object.defineProperty(win.navigator, "serviceWorker", { configurable: true, value: { register: async () => { seen.sw++; }, ready: new Promise(() => {}), getRegistration: async () => null, addEventListener() { seen.sw++; } } });
      win.PublicKeyCredential = function () {};
      Object.defineProperty(win.navigator, "credentials", { configurable: true, value: { get: async () => { seen.pk++; }, create: async () => { seen.pk++; } } });
      const si = win.setInterval.bind(win);
      win.setInterval = (f, ms) => { seen.intervals.push(ms); return si(f, 3600e3); };
      win.fetch = async (path, init) => {
        const p = String(path), m = (init && init.method) || "GET";
        seen.paths.push(m + " " + p); if (init && init.body) seen.bodies.push([p, JSON.parse(init.body)]);
        if (!p.startsWith("/all/test/c/")) return { ok: false, status: 599, json: async () => ({ ok: false }) };
        const q = p.slice("/all/test/c".length);
        const j = q === "/open" || q === "/account" ? opened : q === "/orders" && m === "GET" ? { ok: true, orders: [{ id: "20261019010000-exaa9", status: "placed", at, product: "salt", qty: 1, unit: "unit", total: 10, delivery: 0, paid: 0, moved: 0,
          mode: "collect", history: [{ at, status: "placed", by: "customer" }], msgs: [], payments: [] }], claims: [] } : q === "/hours" ? { ok: true } : null;
        return { ok: !!j, status: j ? 200 : 404, json: async () => j || { ok: false } };
      };
      work = pageWork(win);
    } });
    wins.push(dom.window);
    const d = dom.window.document;
    await until(() => !d.getElementById("tabs").hidden);
    await work.quiet();
    return { name, w: dom.window, d, seen };
  };

  try {
    /* ---- 2: signs in by itself, under the base */
    const A = await customer("A");
    const signIn = A.seen.bodies.find((b) => b[0] === "/all/test/c/open");
    ok(!A.d.getElementById("tabs").hidden && signIn && signIn[1].u === u && signIn[1].password === pass && signIn[1].master === undefined && !A.d.querySelector('link[rel="manifest"]')
      && A.seen.paths.length >= 3 && A.seen.paths.every((p) => / \/all\/test\/c\//.test(p)),
      "The customer view signs in by itself as the account named, with the test password, and every request is under /all/test/c: " + JSON.stringify([signIn && signIn[1].u, A.seen.paths]));

    /* ---- 4 and 5 */
    ok(A.seen.sw === 0 && A.seen.pk === 0 && !A.seen.paths.some((p) => /push|passkey|remember|handover|devices/.test(p)),
      "No service worker is registered and no passkey asked for: " + JSON.stringify([A.seen.sw, A.seen.pk, A.seen.paths]));
    ok(A.seen.intervals.includes(P.TEST_POLL_MS) && P.TEST_POLL_MS === 2000 && !A.seen.intervals.includes(P.POLL_MS),
      "The test view re-reads every 2 seconds, not 10: " + JSON.stringify(A.seen.intervals));

    /* ---- 6: the channel */
    const before = A.seen.paths.filter((p) => p === "GET /all/test/c/orders").length;
    const B = await customer("B");   /* B's sign-in is a write that went through */
    await until(() => A.seen.paths.filter((p) => p === "GET /all/test/c/orders").length > before, 40);
    ok(A.seen.paths.filter((p) => p === "GET /all/test/c/orders").length > before && B.seen.paths.includes("POST /all/test/c/open"),
      "A write that went through in one pane is told on the channel, and the other pane re-reads at once: " + JSON.stringify([before, A.seen.paths.filter((p) => p === "GET /all/test/c/orders").length]));

    /* ---- 3: storage, over a sign-in and a sign-out (two taps), which drops this phone's remembered account and seen marks */
    B.d.querySelector('button.salt-ghost[data-look="night"]').click();   /* a look chosen here is this pane's own */
    B.d.getElementById("lock").click(); B.d.getElementById("lock").click();
    await until(() => !B.d.getElementById("gate").hidden, 40);
    ok(B.seen.sets.length > 0 && B.seen.writes.length > B.seen.sets.length && B.seen.writes.every((k) => k.indexOf("salt-test:") === 0) && B.w.localStorage.getItem("salt-stmt-seen") === "real-phone" && B.w.localStorage.getItem("salt-look") === "tide",
      "No localStorage key is written or removed but under salt-test:, and a real phone's keys are left as they were: " + JSON.stringify(B.seen.writes));

    /* ---- 7 and 8: Salt Admin */
    const order = { id: "20261019010000-exaa1", u, test: true, status: "placed", at, product: "salt", qty: 2, unit: "unit", total: 190, delivery: 0, paid: 0, moved: 0, mode: "collect",
      history: [{ at, status: "placed", by: "customer" }], msgs: [], payments: [] };
    const calls = [];
    let awork;
    const adm = new JSDOM(P.landingPage("", "na", { master: "", accounts: [] }, null, { base: "/all/test" }), { url: "https://site.test/all/test/admin", runScripts: "dangerously", pretendToBeVisual: true, beforeParse(win) {
      try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
      win.scrollTo = () => {}; win.BroadcastChannel = Channel;
      win.localStorage.setItem("salt-look", "tide");
      win.fetch = async (path, init) => {
        const p = String(path), b = init && init.body ? JSON.parse(init.body) : null; calls.push([p, b]);
        let j = null;
        if (p === "/all/test/maker/review") j = { ok: true, test: true, orders: [order], drafts: [], refused: [], queue: [], unreadable: [], trips: [], sameDay: [], rows: [], refunds: {} };
        else if (p === "/all/test/maker/claims") j = { ok: true, claims: [] };
        else if (p === "/all/test/maker/threads") j = { ok: true, threads: [] };
        else if (/^\/all\/test\/maker\/orders\/[^/]+\/preview$/.test(p))
          j = { ok: true, test: true, hash: "h".repeat(64), offerHash: "h".repeat(64), quote: 190, delivery: 0, needsYes: false, prepay: !!(b && b.prepay), chargeChosen: true, flags: [] };
        else if (/^\/all\/test\/maker\/orders\/[^/]+\/accept$/.test(p)) j = { ok: true, test: true, order };
        return { ok: !!j, status: j ? 200 : 404, json: async () => j || { ok: false, error: "not found" }, headers: new win.Headers() };
      };
      awork = pageWork(win);
    } });
    wins.push(adm.window);
    const ad = adm.window.document, tick = () => new Promise((r) => setTimeout(r, 60));
    await until(() => calls.length >= 3); await awork.quiet();
    const places = [...ad.querySelectorAll("nav.salt-rail .place")].map((b) => b.textContent.trim());
    const parts = [...ad.querySelectorAll(".aparts [data-part]")].map((b) => b.closest(".aparts").getAttribute("data-place") + "." + b.getAttribute("data-part"));
    adm.window.location.hash = "#record"; await tick();
    const onRecord = [...ad.querySelectorAll('nav.salt-rail .place[aria-current="page"]')].map((b) => b.textContent.trim());
    ok(JSON.stringify(places) === JSON.stringify(["Needs you", "Orders", "Payments", "Chat"]) && !ad.getElementById("oAdd")
      && !parts.some((x) => /approve|group|ledger|accounts|links|associates|record\.|shop\./.test(x)) && parts.includes("orders.payments") && parts.includes("customers.messages")
      && JSON.stringify(onRecord) === JSON.stringify(["Needs you"]),
      "Salt Admin in test draws Needs you, Orders, Payments and Chat, no Record, Shop, Approve, account list, links or + orb, and #record lands on Needs you: " + JSON.stringify([places, parts, onRecord]));
    ad.querySelector('nav.salt-rail .place[data-p="payments"]').click(); await tick();
    const onPay = [...ad.querySelectorAll('.aparts[data-place="orders"] [data-part]')].filter((b) => b.getAttribute("aria-selected") === "true").map((b) => b.getAttribute("data-part"));
    ad.querySelector('nav.salt-rail .place[data-p="messages"]').click(); await tick();
    ad.querySelector('nav.salt-rail .place[data-m="orders"]:not([data-p])').click(); await tick();
    const reads = [...new Set(calls.map((c) => c[0]))];
    ok(reads.length >= 3 && reads.every((p) => /^\/all\/test\/maker\/(review|claims|threads)$/.test(p)) && JSON.stringify(onPay) === '["payments"]' && ad.getElementById("nFail").hidden,
      "Salt Admin in test reads only the examples' orders, payments and chats under /all/test/maker, and Payments opens its part: " + JSON.stringify([reads, onPay]));

    ad.querySelector("#makerOrderList .ordrow").click(); await until(() => !!ad.querySelector('[data-act="order.pay-first"]'), 40);
    const first = ad.querySelector('[data-act="order.pay-first"]');
    first.checked = true; first.dispatchEvent(new adm.window.Event("change", { bubbles: true }));
    await until(() => calls.some((c) => /preview$/.test(c[0]) && c[1] && c[1].prepay === true), 40); await tick();
    const figs = ad.getElementById("makerReview").textContent;
    ad.querySelector('[data-act="order.accept"]').click();
    await until(() => calls.some((c) => /accept$/.test(c[0])), 40);
    const pv = calls.filter((c) => /preview$/.test(c[0])).map((c) => c[1].prepay), acc = (calls.find((c) => /accept$/.test(c[0])) || [])[1] || {};
    ok(pv[0] === false && pv[pv.length - 1] === true && acc.prepay === true && acc.hash === "h".repeat(64),
      "An example order's Accept carries his Pay first switch into the preview and the Accept: " + JSON.stringify([pv, acc]));
    ok(/A practice order: nothing is priced or checked, and they pay first\./.test(figs) && !/Your margin|Floor|things? to check|Nothing to check/.test(figs),
      "An example order's preview is drawn as a practice order, with no margin, floor or flags: " + figs.slice(0, 200));

    /* ---- 9: the routes */
    const s = await surface();
    try {
      const get = (path, auth = s.jwt) => s.owner(path, undefined, auth, "GET");
      const cv = await get("/all/test/c?u=0000-0002"), ch = await cv.text(), av = await get("/all/test/admin"), ah = await av.text();
      const cr = await get("/all/test/c?u=abcd-efgh"), crh = await cr.text(), none = await get("/all/test/c?u=0000-0002", ""), noneA = await get("/all/test/admin", "");
      ok(cv.status === 200 && /frame-ancestors 'self'/.test(cv.headers.get("content-security-policy")) && /"u":"0000-0002"/.test(ch) && /"base":"\/all\/test\/c"/.test(ch)
        && av.status === 200 && /"base":"\/all\/test"/.test(ah) && /var TESTING=true/.test(ah) && !ah.includes(s.env.STMT_MASTER)
        && /"u":""/.test(crh) && none.status === 401 && noneA.status === 401,
        "The two views are served inside /all's gate, framed by this origin alone, Salt Admin's with no master, the customer's signed in only as a test account: "
        + JSON.stringify([cv.status, av.status, ah.includes(s.env.STMT_MASTER), /"u":""/.test(crh), none.status, noneA.status]));
    } finally { s.close(); }
  } finally { wins.forEach((w) => { try { w.close(); } catch (e) {} }); }
}
