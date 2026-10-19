/* test/counter-stamp-follow.mjs: AN OPEN PAGE FOLLOWS A PUBLISH (R1, the Live and fast plan, 19 Oct 2026).
 *
 * The Counter's page re-read the orders, the hours and the bulletin on its 10-second poll, never the account, so a statement or price list
 * republished while it stayed open was never seen. The poll now also reads GET /account/stamp (the moments and the verdict, no figure) and,
 * when that differs from the stamp the page opened with, re-opens the sealed documents as a return does, keeping the place and the scroll,
 * but only when the page is idle: a Sheet open, a field focused or a line half typed holds it until the next poll. An unchanged stamp reads
 * nothing more. A test account follows the same way. Each assertion drives the real page in a window against a stubbed Worker whose
 * account the test republishes, and was proved red by its own mutation (test/counter-stamp-follow.mutations.json, run with
 * tools/section.mjs). Every username, key and password here is invented. */
import { webcrypto } from "node:crypto";

const wait = async (f, n = 400) => { for (let i = 0; i < n && !f(); i++) await new Promise((r) => setTimeout(r, 15)); return !!f(); };

export async function run({ ok, pageWork }) {
  const C = await import("../tools/stmt-crypto.mjs");
  const { landingPage } = await import("../stmt/page.js");
  const { JSDOM, VirtualConsole } = await import("jsdom");
  const PASS = "fixture-pass-sf-1", BUILD = "c".repeat(16);
  const reply = (status, j) => ({ ok: status < 400, status, type: "basic", json: async () => j });
  const wins = [];

  /* one page on one account whose publish the test moves: state.live (at, marker), state.list (at, digest, price) and state.status */
  const open = async (U, status) => {
    const ck = await C.contentKey("test-secret", U), state = { status, live: { at: "2026-10-19T02:00:00Z", marker: "Statement one" },
      list: { at: "2026-10-19T01:00:00Z", digest: "list-one", price: 100 } }, n = { account: 0, stamp: 0, orders: 0 };
    const envC = await C.encryptWith(ck, JSON.stringify({ v: 1, issued: "2026-09-01", statements: [] }));
    const liveOf = async () => {
      if (state.status === "updating" || state.status === "unavailable") return { live: null, liveStatus: state.status };
      const doc = { at: state.live.at, buildId: BUILD, body: "<p>" + state.live.marker + "</p>", owed: 0, pay: null };
      return { live: Object.assign({ at: doc.at, buildId: BUILD }, await C.encryptWith(ck, JSON.stringify(doc))), liveStatus: state.status };
    };
    const listOf = async () => {
      const l = { at: state.list.at, week: { monday: "2026-10-19", label: "This week" }, soon: [], digest: state.list.digest,
        products: [{ product: "salt", unit: "unit", basis: "tier", sizes: [{ q: 1, price: state.list.price }, { q: 5, price: state.list.price * 4 }] }] };
      return Object.assign({ at: l.at, week: l.week.monday, digest: l.digest }, await C.encryptWith(ck, JSON.stringify(l)));
    };
    const account = async () => ({ ok: true, u: U, issued: "2026-09-01", assoc: false, card: null, env: envC, ...(await liveOf()), prices: await listOf() });
    const stamp = async () => { const l = await liveOf(), p = await listOf();
      return { ok: true, issued: "2026-09-01", liveStatus: l.liveStatus, live: l.live ? { at: l.live.at, buildId: l.live.buildId } : null,
        prices: { at: p.at, digest: p.digest }, card: null }; };
    const errs = [], vc = new VirtualConsole(), intervals = [], scrolls = [];
    vc.on("jsdomError", (e) => errs.push(String(e.message || e)));
    let Y = 0;
    const dom = new JSDOM(landingPage(U, "nsf", null), { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc,
      beforeParse(win) {
        try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
        try { win.localStorage.setItem("salt-look", "tide"); } catch (e) { /* none */ }   /* a device that has chosen its look is not asked, by a Sheet that would hold the page */
        win.scrollTo = (x, y) => { scrolls.push([x, y]); }; win.HTMLElement.prototype.scrollIntoView = () => {};
        Object.defineProperty(win, "scrollY", { configurable: true, get: () => Y });
        win.addEventListener("error", (e) => errs.push(String(e.message)));
        const real = win.setInterval.bind(win);
        win.setInterval = (f, ms) => { const id = real(f, ms); intervals.push({ f, ms, id }); return id; };
        win.fetch = async (path, init) => {
          const p = String(path), m = (init && init.method) || "GET";
          if (p === "/open") return reply(200, { ok: true, byMaster: false, wrap: await C.wrapKey(PASS, ck), wrapMaster: null, session: "sess-sf", ...(await account()) });
          if (p === "/account") { n.account++; return reply(200, await account()); }
          if (p === "/account/stamp") { n.stamp++; return reply(200, await stamp()); }
          if (p === "/orders" && m === "GET") { n.orders++; return reply(200, { ok: true, orders: [], claims: [] }); }
          if (p === "/hours") return reply(200, { open: true });
          if (p === "/bulletin") return reply(200, { ok: true, lines: [], mode: "run" });
          if (p === "/thread") return reply(200, { ok: true, thread: { at: null, msgs: [] } });
          return reply(404, { ok: false });
        };
      } });
    wins.push(dom.window);
    const w = dom.window, d = w.document, work = pageWork(w);
    d.getElementById("un").value = U; d.getElementById("pw").value = PASS;
    d.getElementById("f").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
    await wait(() => !d.getElementById("tabs").hidden);
    await work.quiet();
    const settle = async () => { await work.quiet(); await new Promise((r) => setTimeout(r, 60)); await work.quiet(); };
    const poll = () => intervals.filter((i) => i.ms === 10000).pop();
    const tick = async () => { const t = poll(); if (t) t.f(); await settle(); return !!t; };
    const shown = () => (d.getElementById("out").textContent || "").replace(/\s+/g, " ");
    const place = () => (d.querySelector('#tabs button[data-t][aria-current="page"]') || { getAttribute: () => "" }).getAttribute("data-t");
    const go = async (t) => { d.querySelector('#tabs button[data-t="' + t + '"]').click(); await settle(); };
    return { w, d, n, state, errs, scrolls, tick, settle, shown, place, go, poll, setY: (v) => { Y = v; } };
  };

  try {
    /* 1. an unchanged stamp reads nothing more */
    const a = await open("ctab-cdef", "current");
    ok(!!a.poll() && /Statement one/.test(a.shown()), "(the page is open on the first statement, and polls every ten seconds)");
    await a.go("prices");
    const base = { account: a.n.account, stamp: a.n.stamp };
    await a.tick(); await a.tick(); await a.tick();
    ok(a.n.stamp - base.stamp === 3 && a.n.account === base.account, "three polls with nothing published read the stamp each time and the account not at all: " + JSON.stringify([a.n.stamp - base.stamp, a.n.account - base.account]));

    /* 2. a republish while the page is open and idle: the statement is re-opened, the place and the scroll kept */
    a.state.live = { at: "2026-10-19T03:00:00Z", marker: "Statement two" };
    a.setY(340); a.scrolls.length = 0;
    await a.tick();
    ok(a.n.account === base.account + 1 && /Statement two/.test(a.shown()) && !/Statement one/.test(a.shown()),
      "a republished statement is on the page at the next poll: " + JSON.stringify([a.n.account - base.account, a.shown().slice(0, 60)]));
    ok(a.place() === "prices" && a.scrolls.length > 0 && a.scrolls[a.scrolls.length - 1][1] === 340,
      "and the page stays on Prices at the scroll it had: " + JSON.stringify([a.place(), a.scrolls.slice(-2)]));
    const afterOne = a.n.account;
    await a.tick();
    ok(a.n.account === afterOne, "and the poll after that reads the stamp alone again: " + (a.n.account - afterOne));

    /* 3. a republished price list is followed the same way */
    a.state.list = { at: "2026-10-19T04:00:00Z", digest: "list-two", price: 120 };
    await a.tick();
    ok(a.n.account === afterOne + 1 && /120/.test(a.d.getElementById("pPrices") ? a.d.getElementById("pPrices").textContent : a.d.body.textContent),
      "a republished price list is re-opened too, and Prices shows its figure: " + (a.n.account - afterOne));

    /* 4. a Sheet open holds it until the next poll after it shuts */
    const b = await open("ctab-cdef", "current");
    const row = b.d.querySelector("#hThread .throw") || b.d.querySelector(".throw");
    row.click(); await b.settle();
    const sheetOpen = !b.d.getElementById("thSheet").hidden;
    const b0 = b.n.account;
    b.state.live = { at: "2026-10-19T03:00:00Z", marker: "Statement two" };
    await b.tick(); await b.tick();
    ok(sheetOpen && b.n.account === b0 && /Statement one/.test(b.shown()) && b.n.stamp > 0, "with a Sheet open, a republish waits: nothing re-opened over it");
    b.d.getElementById("thX").click(); await b.settle();
    await b.tick();
    ok(b.n.account === b0 + 1 && /Statement two/.test(b.shown()), "and the poll after the Sheet shuts brings it in: " + (b.n.account - b0));

    /* 5. a field focused holds it, and so does a line half typed in a field he has left */
    const c = await open("ctab-cdef", "current");
    const field = c.d.createElement("input"); field.type = "text"; c.d.body.appendChild(field); field.focus();
    const c0 = c.n.account;
    c.state.live = { at: "2026-10-19T03:00:00Z", marker: "Statement two" };
    await c.tick(); await c.tick();
    ok(c.d.activeElement === field && c.n.account === c0 && /Statement one/.test(c.shown()), "with a field focused, a republish waits");
    field.value = "half a line"; field.blur();
    await c.tick();
    ok(c.d.activeElement !== field && c.n.account === c0 && /Statement one/.test(c.shown()), "and so does a line half typed in a field he has left");
    field.value = "";
    await c.tick();
    ok(c.n.account === c0 + 1 && /Statement two/.test(c.shown()), "and with the field empty the next poll brings it in: " + (c.n.account - c0));

    /* 6. a page showing that the statement is updating moves once the publish lands */
    const u = await open("ctab-cdef", "updating");
    ok(/updating/.test(u.shown()), "(the page shows that the live statement is updating)");
    const u0 = u.n.account;
    u.state.status = "current";
    await u.tick();
    ok(u.n.account === u0 + 1 && /Statement one/.test(u.shown()) && !/updating/.test(u.shown()), "and once the Worker's verdict is current the statement is on the page: " + u.shown().slice(0, 60));

    /* 6b. the verdict alone moves it: neither state has a live document, so no moment differs, only the words the page shows */
    const v = await open("ctab-cdef", "unavailable");
    ok(/could not be verified/.test(v.shown()), "(the page shows that the live statement could not be verified)");
    const v0 = v.n.account;
    v.state.status = "updating";
    await v.tick();
    ok(v.n.account === v0 + 1 && /updating/.test(v.shown()) && !/could not be verified/.test(v.shown()), "and when the verdict alone changes to updating the page says so: " + v.shown().slice(0, 60));

    /* 7. a test account follows the same way */
    const t = await open("0000-0000", "fixture");
    const t0 = t.n.account;
    await t.tick();
    t.state.live = { at: "2026-10-19T03:00:00Z", marker: "Statement two" };
    await t.tick();
    ok(t.n.account === t0 + 1 && /Statement two/.test(t.shown()), "a test account's republished fixture is followed too, and an unchanged stamp read nothing: " + (t.n.account - t0));

    ok([a, b, c, u, t].every((x) => x.errs.length === 0), "no error is raised through any of it (" + [a, b, c, u, t].flatMap((x) => x.errs).join(" | ") + ")");
  } finally { for (const w of wins) { try { w.close(); } catch (e) { /* jsdom */ } } }
}
