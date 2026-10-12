/* test/counter-offline-line.mjs: A READ THAT FAILS SAYS WHEN THE PAGE LAST READ (his yes of 11 Oct 2026, the plan's customer item 10).
 *
 * Offline, or a read the site refused, after the page has read once: Home leads with "Not updated since 10:42" (Kuala Lumpur, 24 hours;
 * the day as DD Mon once it is not today) in place of the figure it can no longer vouch for, and the pay foot goes with the figure. The
 * next good read clears it. A page that never read has nothing to date and says what it said before. Every assertion below drives the
 * real page in a window against a stubbed Worker with a clock of its own, and each was proved red by its own mutation
 * (test/counter-offline-line.mutations.json, run with tools/section.mjs). Every code, name and password here is invented.
 */
import { webcrypto } from "node:crypto";

const wait = async (f, n = 400) => { for (let i = 0; i < n && !f(); i++) await new Promise((r) => setTimeout(r, 15)); return !!f(); };

export async function run({ ok }) {
  const W = await import("../stmt/words.js"), C = await import("../tools/stmt-crypto.mjs");
  const { landingPage } = await import("../stmt/page.js");
  const { JSDOM, VirtualConsole } = await import("jsdom");

  const U = "ctab-cdef", PASS = "fixture-pass-ol-1", BUILD = "b".repeat(16), ck = await C.contentKey("test-secret", U);
  const part = { product: "salt", qty: 3, rm: 40, whole: 45, date: "2026-09-10", gotOn: "2026-09-12", due: "2026-09-20", late: true };
  const liveDoc = { at: "2026-10-12T02:00:00Z", buildId: BUILD, body: "<p>Live</p>", owed: 40,
    pay: { now: { rm: 40, due: "2026-09-20", parts: [part] }, overdue: { rm: 40, parts: [part] }, coming: { rm: 0, parts: [] } } };
  const envC = await C.encryptWith(ck, JSON.stringify({ v: 1, issued: "2026-09-01", statements: [] }));
  const live = Object.assign({ at: liveDoc.at, buildId: BUILD }, await C.encryptWith(ck, JSON.stringify(liveDoc)));
  const openBody = { ok: true, byMaster: false, wrap: await C.wrapKey(PASS, ck), wrapMaster: null, session: "sess-ol", env: envC, live, liveStatus: "current", prices: null };
  const reply = (status, j) => ({ ok: status < 400, status, type: "basic", json: async () => j });
  const good = async () => reply(200, { ok: true, orders: [], claims: [] });
  const refused = async () => reply(500, { ok: false, error: "no KV binding" });
  const offline = async () => { throw new TypeError("Failed to fetch"); };

  /* a page of its own: a clock the test moves, and an orders read the test answers */
  const wins = [];
  const open = async (orders, start) => {
    const clock = { t: Date.parse(start), n: 0, orders: Array.isArray(orders) ? orders : [orders] }, errs = [], vc = new VirtualConsole();
    vc.on("jsdomError", (e) => errs.push(String(e.message || e)));
    const dom = new JSDOM(landingPage(U, "nol", null), { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc,
      beforeParse(win) {
        try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
        win.scrollTo = () => {}; win.HTMLElement.prototype.scrollIntoView = () => {};
        win.addEventListener("error", (e) => errs.push(String(e.message)));
        const Real = win.Date;
        win.Date = class extends Real { constructor(...a) { super(...(a.length ? a : [clock.t])); } static now() { return clock.t; } };
        win.fetch = async (path, init) => {
          const p = String(path), m = (init && init.method) || "GET";
          if (p === "/open") return reply(200, openBody);
          if (p === "/account") return reply(200, { ok: true, env: envC, live, liveStatus: "current" });
          if (p === "/orders" && m === "GET") { clock.n++; return (clock.orders.length > 1 ? clock.orders.shift() : clock.orders[0])(); }
          return reply(404, { ok: false });
        };
      } });
    wins.push(dom.window);
    const w = dom.window, d = w.document;
    d.getElementById("un").value = U; d.getElementById("pw").value = PASS;
    d.getElementById("f").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
    await wait(() => !d.getElementById("tabs").hidden);
    /* a return to the page: the page reads again, as it does on its own every ten seconds */
    const read = async () => {
      const n0 = clock.n;
      d.dispatchEvent(new w.Event("visibilitychange"));
      /* the orders' read is the sign that the return reached its end; its answer lands in microtasks, which the next timer outlasts */
      await wait(() => clock.n > n0);
      await new Promise((r) => setTimeout(r, 20));
    };
    const head = () => d.getElementById("payHead"), foot = () => d.getElementById("homeFoot");
    return { w, d, clock, errs, read, head, foot, stale: () => head().querySelector("[data-stale]"), figure: () => /RM 40[.]00/.test(head().textContent) && /Please pay the overdue amount/.test(head().textContent), say: () => (head().textContent || "").replace(/\s+/g, " ").trim() };
  };
  try {
    /* ---- the line, its words and its time ---- */
    ok(W.EN["read.since"] === "Not updated since {t}", "the line is a key of the table, and the time its only slot: " + JSON.stringify(W.EN["read.since"]));

    /* 1. a read that works, then one that fails: the line in place of the figure, and the pay foot gone */
    const a = await open([good, refused], "2026-10-12T02:42:00Z");
    await wait(() => a.figure() && !a.foot().hidden);
    ok(a.figure() && /To pay now/.test(a.foot().textContent) && !a.foot().hidden && !a.stale(), "the fixture: a page that reads leads with its figure and the overdue sentence, the pay foot standing with To pay now: " + JSON.stringify(a.say().slice(0, 90)));
    a.clock.t = Date.parse("2026-10-12T03:05:00Z");
    await a.read();
    ok(!!a.stale() && a.say() === "Not updated since 10:42" && a.stale().querySelector("p").getAttribute("role") === "status",
      "a read the site refuses, after one that worked, leads Home with the time of the last read in Kuala Lumpur, 24 hours (10:42 for 02:42 UTC): " + JSON.stringify(a.say()));
    ok(!a.figure() && !/RM|Overdue|Please pay/.test(a.say()), "in place of the figure and the overdue sentence, never beside them");
    ok(a.foot().hidden, "and the pay foot, which holds the same figure, goes with it");
    /* a second failed read does not move the time: it is the last GOOD read's */
    a.clock.t = Date.parse("2026-10-12T04:30:00Z");
    await a.read();
    ok(a.say() === "Not updated since 10:42", "a later failed read keeps the time of the last good one: " + JSON.stringify(a.say()));
    /* the next good read clears it */
    a.clock.orders = [good];
    await a.read();
    await wait(() => !a.stale());
    ok(!a.stale() && a.figure() && !a.foot().hidden, "the next good read clears the line and brings the figure and its Pay back: " + JSON.stringify(a.say().slice(0, 90)));
    ok(a.errs.length === 0, "no error is raised through it (" + (a.errs.join(" | ") || "none") + ")");

    /* 2. offline is the same: the request never leaves the phone */
    const o = await open([good, offline], "2026-10-12T02:42:00Z");
    await wait(() => o.figure());
    o.clock.t = Date.parse("2026-10-12T02:50:00Z");
    await o.read();
    ok(o.say() === "Not updated since 10:42" && o.foot().hidden, "offline, a request that never answers, says the same: " + JSON.stringify(o.say()));

    /* 3. a day before today is DD Mon, and it is the Kuala Lumpur day: 23:30 on 12 Oct there is 15:30 UTC, and 00:30 on 13 Oct is still 12 Oct in UTC */
    const k = await open([good, refused], "2026-10-12T15:30:00Z");
    await wait(() => k.figure());
    k.clock.t = Date.parse("2026-10-12T16:30:00Z");
    await k.read();
    ok(k.say() === "Not updated since 12 Oct", "from the day after, the day stands in place of the time, by the Kuala Lumpur calendar (23:30 on 12 Oct, read at 00:30 on 13 Oct): " + JSON.stringify(k.say()));
    const k2 = await open([good, refused], "2026-10-12T15:30:00Z");
    await wait(() => k2.figure());
    k2.clock.t = Date.parse("2026-10-12T15:55:00Z");
    await k2.read();
    ok(k2.say() === "Not updated since 23:30", "and the same evening it is still the time: " + JSON.stringify(k2.say()));

    /* 4. a page that never read has nothing to date: the figure stays, and the orders say they could not be read, as before */
    const n = await open([refused], "2026-10-12T02:42:00Z");
    await wait(() => !!n.d.querySelector('#hNeeds [data-unread="ord.unread"]'));
    ok(!n.stale() && n.figure() && !!n.d.querySelector('#hNeeds [data-unread="ord.unread"]') && !n.foot().hidden,
      "a first read that fails has no time to give: Home keeps its figure and the orders' own line, with no Not updated: " + JSON.stringify(n.say().slice(0, 90)));
    /* its Try again, answered, is the first good read; a later failure then dates from it */
    n.clock.t = Date.parse("2026-10-12T03:00:00Z");
    n.clock.orders = [good, refused];
    n.d.querySelector('#hNeeds [data-unread] button').click();
    await wait(() => !n.d.querySelector('[data-unread="ord.unread"]'));
    n.clock.t = Date.parse("2026-10-12T03:20:00Z");
    await n.read();
    ok(n.say() === "Not updated since 11:00", "and once a read has worked, a failure after it dates from that read: " + JSON.stringify(n.say()));

    /* 5. the time belongs to the visit: sign out and in again, with every read failing, and there is nothing to date */
    n.d.getElementById("lock").click(); n.d.getElementById("lock").click();   /* a tap and a tap again */
    await wait(() => n.d.getElementById("tabs").hidden && !n.d.getElementById("gate").hidden);
    n.clock.orders = [refused];
    n.d.getElementById("un").value = U; n.d.getElementById("pw").value = PASS;
    n.d.getElementById("f").dispatchEvent(new n.w.Event("submit", { bubbles: true, cancelable: true }));
    await wait(() => !n.d.getElementById("tabs").hidden && !!n.d.querySelector('#hNeeds [data-unread="ord.unread"]'));
    ok(!n.d.getElementById("tabs").hidden && !n.stale() && n.figure(), "a new sign-in does not inherit the last visit's time: its first read failing has none to give, so the line is not drawn: " + JSON.stringify(n.say().slice(0, 90)));
  } finally { for (const w of wins) { try { w.close(); } catch (e) { /* jsdom */ } } }
}
