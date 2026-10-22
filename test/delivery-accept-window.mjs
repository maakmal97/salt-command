/* test/delivery-accept-window.mjs: HIS ACCEPT CARRIES THE WINDOW, AND REMINDS THEM TO PAY NOW (his answers of 10 Oct 2026). A
 * delivery asked for as soon as it can may be answered at Accept with one of the six windows (Q3), needing no yes of theirs;
 * a window they chose stands and is never changed this version (Q2). The yes carries the window in what he was shown, and the
 * Counter cuts it to its hours as it moves the order, his choice standing whole when the hours leave none of it; one already
 * past is left off rather than stall an approved row. Salt Admin offers the six windows as one When choice, a sheet's
 * lines taking its first order's. The acknowledgement's words remind them to pay now, words only (Q4). Every code, name and
 * place is invented. Every assertion was proved red by its own mutation. */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { webcrypto } from "node:crypto";
import { cardOf } from "./maker-act.mjs";

const REPO = join(import.meta.dirname, "..");
const wait = async (f) => { for (let i = 0; i < 200 && !f(); i++) await new Promise((r) => setTimeout(r, 15)); return f(); };

export async function run({ ok, KV, assets }) {
  const D = await import("../src/orders.js"), O = await import("../stmt/orders.js"), Wn = await import("../stmt/window.js");

  /* 1. THE RULE AT ACCEPT: none, or a window on a delivery that asked for none, its end ahead and under eight days off */
  const at = new Date("2026-10-10T02:00:00.000Z");   /* 10:00 in Kuala Lumpur */
  const dlv = { mode: "deliver" }, said = (b, o) => { const r = D.slotOf(b, o, at); return r.error ? r.status : r.slot; };
  ok(said({}, dlv) === null && said({ slot: "" }, dlv) === null && said({ slot: "2026-10-10T12" }, dlv) === "2026-10-10T12"
    && said({ slot: "2026-10-10T08" }, dlv) === "2026-10-10T08" && said({ slot: "2026-10-17T20" }, dlv) === "2026-10-17T20",
    "Accept takes no window, or one of the six whose end is ahead, the window running now included");
  ok(said({ slot: "2026-10-10T10" }, dlv) === 400 && said({ slot: 12 }, dlv) === 400 && said({ slot: "2026-10-10T04" }, dlv) === 400
    && said({ slot: "2026-10-19T00" }, dlv) === 400,
    "a window is refused that is not one of the six, has ended, or starts more than eight days off");
  const other = D.slotOf({ slot: "2026-10-10T12" }, { mode: "deliver", slot: "2026-10-11T08" }, at), same = D.slotOf({ slot: "2026-10-11T08" }, { mode: "deliver", slot: "2026-10-11T08" }, at);
  ok(said({ slot: "2026-10-10T12" }, { mode: "collect" }) === 400 && other.slot === "2026-10-10T12" && other.change === true && same.slot === null
    && said({ slot: "2026-10-10T12" }, { mode: "deliver", wantBy: "2026-10-12" }) === 409 && said({}, { mode: "deliver", slot: "2026-10-11T08" }) === null
    && D.slotOf({ slot: "2026-10-10T12" }, dlv, at).change === false,
    "only a delivery takes one; a day they asked for stands, their own window named again is no change, and another is a change for their yes");

  /* 2. THE COUNTER'S SIDE: the acknowledgement takes a window it can trust, and leaves out anything else rather than refuse */
  const base = { id: "o1", u: "abcd-efgh", status: "placed", mode: "deliver", qty: 1, total: 100, history: [], msgs: [] };
  const ack = (o, b) => O.decideDesk(Object.assign({}, base, o), Object.assign({ status: "acknowledged", delivery: 10 }, b), at.toISOString());
  const a1 = ack({}, { slot: "2026-10-10T12", slotSpan: "12:00-16:00" }), a2 = ack({ mode: "collect" }, { slot: "2026-10-10T12", slotSpan: "12:00-16:00" }),
    a3 = ack({ slot: "2026-10-11T08", slotSpan: "09:00-12:00" }, { slot: "2026-10-10T12", slotSpan: "12:00-16:00" }),
    a4 = ack({ wantBy: "2026-10-12" }, { slot: "2026-10-10T12", slotSpan: "12:00-16:00" }), a5 = ack({}, { slot: "2026-10-10T12", slotSpan: "noon" }),
    a6 = ack({}, { slot: "2026-10-10T12" });
  ok(a1.ev && a1.ev.slot === "2026-10-10T12" && a1.ev.slotSpan === "12:00-16:00" && [a2, a3, a4, a5, a6].every((x) => x.ev && x.ev.status === "acknowledged" && !("slot" in x.ev)),
    "the acknowledgement takes his window on an as-soon-as delivery, and leaves it off a collection, an order with its own time or day, or one with no good span, never refusing: "
    + JSON.stringify([a1, a2, a3, a4, a5, a6].map((x) => x.ev && x.ev.slot)));
  const folded = Object.assign({}, base);
  O.applyEvent(folded, a1.ev);
  ok(folded.status === "acknowledged" && folded.slot === "2026-10-10T12" && folded.slotSpan === "12:00-16:00", "and the order carries it as their own window would be carried");
  /* a desk that names no window reserves an order with none, as before windows; never one that has its own */
  const terms = (o) => ({ status: "placed", product: null, qty: 1, total: 100, mode: "deliver", place: null, forFriend: null, wantBy: null, ...o });
  const rv1 = O.decideDesk(Object.assign({}, base), { reserveReview: terms({}) }, at.toISOString()),
    rv2 = O.decideDesk(Object.assign({}, base, { slot: "2026-10-10T12" }), { reserveReview: terms({}) }, at.toISOString()),
    rv3 = O.decideDesk(Object.assign({}, base, { slot: "2026-10-10T12" }), { reserveReview: terms({ slot: "2026-10-10T12" }) }, at.toISOString());
  ok(rv1.ev && rv1.ev.kind === "mark" && rv2.status === 409 && rv3.ev && rv3.ev.kind === "mark",
    "the review is reserved with or without the window named, and refused when the order has a window the desk did not name: " + JSON.stringify([rv1.ev && rv1.ev.kind, rv2.status, rv3.ev && rv3.ev.kind]));
  /* a window gone by the time the row is approved is left off, and the order still moves */
  const kv = new KV(), past = { id: "20261009010000-pppp", u: "abcd-efgh", status: "placed", mode: "deliver", qty: 1, total: 100, at: "2026-10-09T01:00:00Z", history: [], msgs: [] };
  await kv.put("order:abcd-efgh:" + past.id, JSON.stringify(past));
  const mv = await O.deskMove({ STMT: kv }, "abcd-efgh", past.id, { status: "acknowledged", delivery: 0, slot: "2026-10-09T08", slotSpan: "08:00-12:00" });
  ok(mv.order && mv.order.status === "acknowledged" && !mv.order.slot && !mv.order.slotSpan, "a window already past when the order moves is left off, and the order is acknowledged: " + JSON.stringify(mv.order && [mv.order.status, mv.order.slot]));

  /* 3. END TO END: Accept on the desk Worker, the row approved, the order moved with the window cut to the Counter's hours */
  let DatabaseSync = null;
  try { ({ DatabaseSync } = await import("node:sqlite")); } catch (e) { /* older runtime */ }
  if (DatabaseSync) {
    const deskW = (await import("../src/worker.js")).default, stmtW = (await import("../stmt/worker.js")).default;
    const db = new DatabaseSync(":memory:");
    for (const f of readdirSync(join(REPO, "migrations")).filter((x) => /^\d+_.*\.sql$/.test(x)).sort()) db.exec(readFileSync(join(REPO, "migrations", f), "utf8"));
    const D1 = { prepare(sql) { const st = db.prepare(sql);
      const mk = (a) => ({ run() { const r = st.run(...a); return { meta: { changes: Number(r.changes || 0) } }; },
        first() { const r = st.get(...a); return r === undefined ? null : r; }, all() { return { results: st.all(...a) }; } });
      const self = mk([]); self.bind = (...a) => mk(a); return self; } };
    const C1 = "CZ1-WN", U1 = "wnab-cdef";
    const PRICING = { v: "v900", takenAt: "2026-09-24T00:00:00.000Z", tierNames: ["Ambassador", "Titanium", "Platinum", "Gold", "Silver"], profileRule: { smallUpTo: 1, bigFrom: 3 },
      byProduct: { salt: { stockCost: 56, floors: { "1": { floor: 80 }, "2": { floor: 150 }, "3": { floor: 215 } }, inputs: null, sizes: [1, 2, 3] } } };
    const setState = (k, doc) => db.prepare("INSERT OR REPLACE INTO state (key,doc) VALUES (?,?)").run(k, JSON.stringify(doc));
    let seq = 0;
    for (const d of ["2026-08-01", "2026-08-10", "2026-08-20"]) db.prepare("INSERT INTO entry (collection,seq,hash,doc) VALUES (?,?,?,?)")
      .run("sales", seq++, "h" + seq, JSON.stringify({ rid: "s9" + seq, customer: C1, date: d, qty: 1, total: 100, cash: 100, deliveredQty: 1, deliveredOn: d, paidOn: d }));
    setState("roster", [C1]); setState("PRICING", PRICING); setState("OPEN", { byKey: {}, position: {} });
    db.prepare("INSERT INTO snapshot (one,v,stamped) VALUES (1,'v900',NULL)").run();
    const skv = new KV(), dkv = new KV(), senv = { STMT: skv, STMT_DESK_KEY: "desk-key" };
    /* the Counter's hours: every day 09:00 to 18:00 */
    await skv.put("maker:hours", JSON.stringify({ schedule: { days: Array.from({ length: 7 }, () => ({ open: "09:00", close: "18:00" })) } }));
    await dkv.put("stmt-users", JSON.stringify({ [U1]: C1 }));
    const reserves = [];
    const denv = { SALT_QUEUE: dkv, SALT_LEDGER: D1, STMT_DESK_KEY: "desk-key", SALT_WRITE_KEY: "k-fixture", REQUIRE_ACCESS: "0", ASSETS: assets,
      STMT_SITE: { fetch: (url, init) => { try { const b = init && init.body ? JSON.parse(init.body) : null; if (b && b.reserveReview) reserves.push(b.reserveReview); } catch (e) { /* not JSON */ }
        return stmtW.fetch(new Request(url, init), senv); } } };
    const call = async (path, body) => {
      const r = await deskW.fetch(new Request("https://salt-command.example" + path, { method: "POST",
        headers: { "content-type": "application/json", "X-Salt-Key": "k-fixture" }, body: JSON.stringify(body || {}) }), denv, { waitUntil() {} });
      return { status: r.status, j: await r.json() };
    };
    const place = async (mode, extra) => (await O.placeOrder(senv, U1, Object.assign({ product: "salt", qty: 1, mode, place: mode === "deliver" ? "by the old market" : "", unit: 100, total: 100, week: "" }, extra || {}))).order;
    const orderOf = async (id) => (await O.allOrders(senv, true)).find((x) => x.id === id);
    const shownOf = (id) => { const r = db.prepare("SELECT shown FROM preapproval WHERE order_id=? ORDER BY at DESC").get(id); return r ? JSON.parse(r.shown) : null; };
    const accept = async (o, extra) => { const d = o.mode === "deliver" ? 10 : 0, pv = await call("/orders/" + o.id + "/preview", { delivery: d });
      return call("/orders/" + o.id + "/accept", Object.assign({ delivery: d, hash: pv.j.hash }, extra || {})); };
    const now = Date.now(), s8 = Wn.slotNext(8, null, now).slot, s20 = Wn.slotNext(20, null, now).slot, s12 = Wn.slotNext(12, null, now).slot;
    const o1 = await place("deliver"), r1 = await accept(o1, { slot: s8 }), g1 = await orderOf(o1.id);
    ok(r1.status === 200 && r1.j.approved === true && g1.status === "acknowledged" && g1.slot === s8 && g1.slotSpan === "09:00-12:00" && shownOf(o1.id).slot === s8,
      "Accept with a window: his yes carries it, the row is approved, and the order is acknowledged with the window cut to the hours: "
      + JSON.stringify({ st: r1.status, ap: r1.j.approved, err: r1.j.error, order: g1 && [g1.status, g1.slot, g1.slotSpan], shown: shownOf(o1.id) }));
    const o2 = await place("deliver"), r2 = await accept(o2, { slot: s20 }), g2 = await orderOf(o2.id);
    ok(r2.j.approved === true && g2.slot === s20 && g2.slotSpan === "20:00-24:00", "a window the hours leave none of is his choice, and it stands whole: " + JSON.stringify(g2 && [g2.slot, g2.slotSpan]));
    const o3 = await place("collect"), r3 = await accept(o3, { slot: s8 }), g3 = await orderOf(o3.id);
    const o4 = await place("deliver", { slot: s12 }), r4 = await accept(o4, { slot: s8 }), g4a = await orderOf(o4.id);
    ok(r3.status === 400 && g3.status === "placed" && !shownOf(o3.id) && r4.status === 409 && g4a.status === "placed" && g4a.slot === s12,
      "a collection is refused a window at Accept, and so is an order that chose its own, which stands: " + JSON.stringify([r3.status, r3.j.error, r4.status, r4.j.error]));
    const r4b = await accept(o4, {}), g4 = await orderOf(o4.id);
    const o5 = await place("deliver"), r5 = await accept(o5, {}), g5 = await orderOf(o5.id);
    ok(r4b.j.approved === true && g4.status === "acknowledged" && g4.slot === s12 && g4.slotSpan === "12:00-16:00" && r5.j.approved === true && g5.status === "acknowledged" && !g5.slot && !("slot" in shownOf(o5.id)),
      "their own window rides through Accept unchanged, and an Accept with none moves the order as it always did: " + JSON.stringify([g4.slot, g4.slotSpan, g5.slot]));
    ok(reserves.length >= 4 && reserves.filter((r) => "slot" in r).length === 1 && reserves.some((r) => r.slot === s12),
      "the desk names the window in its review only on the order that has one, so a Counter yet to carry windows still reserves the rest: " + JSON.stringify(reserves.map((r) => r.slot)));
  } else ok(true, "node:sqlite is unavailable here, so Accept was not driven against the real schema");

  /* 4. THE PAY-NOW WORDS: the banner's body on credit, and a sentence on an agreed order still owing */
  const W = await import("../stmt/words.js");
  ok(/^Please pay now if you can\. Payment is due when/.test(W.EN["news.confirmed-credit.b"]) && W.EN["news.confirmed.b"] === "Please make your payment now.",
    "the acknowledgement's banner asks them to pay now if they can, the terms said beside it");
  const { landingPage } = await import("../stmt/page.js"), C = await import("../tools/stmt-crypto.mjs"), { JSDOM } = await import("jsdom");
  const U = "pyab-cdef", PASS = "fixture-pass-paynow-3", ck = await C.contentKey("test-secret", U);
  const order = (id, x) => Object.assign({ id, at: "2026-10-09T01:00:00Z", product: "salt", qty: 1, unit: 100, total: 100, delivery: 10, mode: "deliver", paid: 0, moved: 0, status: "acknowledged",
    history: [{ at: "2026-10-09T01:00:00Z", status: "placed", by: "customer" }, { at: "2026-10-09T02:00:00Z", status: "acknowledged", by: "desk" }], msgs: [] }, x);
  const ORDERS = [order("20261009010000-cred"), order("20261009010000-prep", { prepay: true }), order("20261009010000-paid", { paid: 110 }), order("20261009010000-plcd", { status: "placed", history: [] })];
  const body = { ok: true, wrap: await C.wrapKey(PASS, ck), session: "sess-pay",
    env: await C.encryptWith(ck, JSON.stringify({ statements: [{ issued: "2026-09-01", label: "September", body: "<p>Statement</p>" }] })) };
  const dom = new JSDOM(landingPage(U, "npay", null), { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true, beforeParse(win) {
    try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
    win.scrollTo = () => {}; win.HTMLElement.prototype.scrollIntoView = () => {};
    win.fetch = async (path, init) => {
      const p = String(path), m = (init && init.method) || "GET", reply = (status, b) => ({ ok: status === 200, status, type: "basic", json: async () => b });
      if (p === "/open") return reply(200, body);
      if (p === "/orders" && m === "GET") return reply(200, { ok: true, orders: ORDERS });
      return reply(404, { ok: false });
    };
  } });
  try {
    const w = dom.window, d = w.document;
    d.getElementById("un").value = U; d.getElementById("pw").value = PASS;
    d.getElementById("f").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
    const said = async (id) => {
      await wait(() => d.querySelector('#pOrder [data-row="' + id + '"]'));
      const row = d.querySelector('#pOrder [data-row="' + id + '"]'); if (!row) return "(no row)";
      row.click(); await wait(() => d.querySelector("#pOrder .oscreen"));
      const t = (d.querySelector("#pOrder .oscreen") || {}).textContent || "";
      const back = d.querySelector("#pOrder .oback"); if (back) back.click();
      return t;
    };
    const cred = await said(ORDERS[0].id), prep = await said(ORDERS[1].id), paid = await said(ORDERS[2].id), plcd = await said(ORDERS[3].id);
    ok(/Confirmed on .*Please pay now if you can\./.test(cred) && /Please make your payment now\./.test(prep) && !/Please (pay now|make your payment)/.test(cred.replace(/Please pay now if you can\./, "x")),
      "an agreed order still owing asks them to pay now, on credit if they can and in advance plainly: " + JSON.stringify([cred.slice(0, 200), prep.slice(0, 200)]));
    ok(!/Please (pay now|make your payment)/.test(paid) && !/Please (pay now|make your payment)/.test(plcd) && /Confirmed on/.test(paid),
      "a paid order is not asked, nor one still placed: " + JSON.stringify([paid.slice(0, 160), plcd.slice(0, 160)]));
  } finally { await new Promise((r) => setTimeout(r, 60)); dom.window.close(); }

  function s12w() { return Wn.slotNext(12, null, Date.now()).slot; }

  /* 5. SALT ADMIN: the six windows, sent with its Accept, a sheet's lines taking its first order's (#104 parity) */
  const posts = [];
  const orderOf2 = (id, patch = {}) => ({ id, u: "maab-cdef", product: "salt", qty: 1, total: 100, status: "placed", mode: "deliver", history: [], ...patch });
  const A = "20261010060001-awin", B = "20261010060002-awin", T = "20261010060003-awin", PN = "20261010060004-awin";
  const reviewBody = { ok: true, drafts: [], orders: [orderOf2(A, { sheet: "sa1" }), orderOf2(B, { sheet: "sa1" }), orderOf2(T, { slot: s12w(), slotSpan: "12:00-16:00" }),
    orderOf2(PN, { pin: "ab".repeat(16) })] };
  const browser = new JSDOM(landingPage("", "fixture", { master: "local-master", accounts: [] }), {
    url: "https://counter.fixture.test/all", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(window) {
      Object.defineProperty(window, "crypto", { value: { getRandomValues: (a) => webcrypto.getRandomValues(a), randomUUID: () => webcrypto.randomUUID(), subtle: webcrypto.subtle } });
      window.TextEncoder = TextEncoder; window.TextDecoder = TextDecoder; window.scrollTo = () => {};
      window.fetch = async (path, init) => {
        if (init && init.method === "POST" && String(path).startsWith("/all/maker/orders/")) {
          const b = JSON.parse(init.body);
          if (String(path).endsWith("/preview")) { posts.push({ kind: "preview", path: String(path), body: b });
            return Response.json({ ok: true, quote: b.total, delivery: b.delivery, hash: "h-" + posts.length, row: { qty: 1, total: b.total }, flags: [],
              cost: { unit: 80, total: 80, source: "purchase" }, card: 100, cardNote: null, floor: { rm: 80, at: 1, exact: true }, margin: { rm: 20, pct: 20 },
              usual: { who: "CZ3-MA", rate: 100, orders: 4, uniform: true, off: false, dir: 0, far: false }, prepay: false, owedWith: 100, ceiling: 250, late: null }); }
          posts.push({ kind: "accept", path: String(path), body: b }); return Response.json({ ok: true });
        }
        if (path === "/all/maker/review") return Response.json(reviewBody);
        if (path === "/all/maker/claims") return Response.json({ ok: true, claims: [] });
        if (path === "/all/maker/threads") return Response.json({ ok: true, threads: [] });
        if (path === "/all/maker/bulletin") return Response.json({ ok: true, bulletin: { lines: [] } });
        if (path === "/all/maker/inputs") return Response.json({ ok: true, catalog: { products: [], parties: [], loans: [], rewards: [], ledger: [] } });
        if (path === "/all/maker/hours") return Response.json({ ok: true, config: null, status: {} });
        return Response.json({ ok: true, accounts: [] });
      };
    }
  });
  try {
    const doc = browser.window.document;
    const acard = (id) => cardOf(doc, id);
    const button = (id, text) => acard(id) && [...acard(id).querySelectorAll("button")].find((b) => b.textContent === text);
    /* 22 Oct 2026 (his canvas): the charge and the time are each ONE select in the Agree grid, the time (data-when) listing ASAP or theirs, then every window ahead */
    const whenOf = (id) => acard(id) ? acard(id).querySelector("select[data-when]") : null;
    const wins = (id) => whenOf(id) ? [...whenOf(id).options].map((o) => [o.value, o.textContent]) : [];
    const feeOf = (id) => acard(id).querySelector('select[data-act="order.fee"]');
    const choose = (sel, v) => { sel.value = v; sel.dispatchEvent(new browser.window.Event("change", { bubbles: true })); };
    doc.querySelector('[data-act="nav.orders"]').click();
    await wait(() => doc.querySelector('[data-act="order.open"]'));
    /* an Accept reloads the review, so each card is found again once the reload has settled */
    const acceptOf = async (id) => { await new Promise((r) => setTimeout(r, 250)); await wait(() => acard(id).querySelector("[data-accept]")); acard(id).querySelector("[data-accept]").click();
      await wait(() => posts.some((p) => p.kind === "accept" && p.path.includes(id))); return posts.filter((p) => p.kind === "accept" && p.path.includes(id)).pop().body; };
    /* what the card must offer, worked here from the clock and the Worker's six windows alone: Kuala Lumpur's next eight days, and on a
       day the windows whose start is still ahead (the Counter's hours are unset in this fixture, so every window is open) */
    const HR = 3600e3, MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], p2 = (n) => String(n).padStart(2, "0");
    const t0 = Date.now(), dayN = (i) => new Date(t0 + 8 * HR + i * 864e5).toISOString().slice(0, 10), dayName = (d) => (+d.slice(8)) + " " + MON[+d.slice(5, 7) - 1];
    const winsOn = (day) => Wn.WINDOWS.filter((h) => Date.parse(day + "T00:00:00Z") + (h - 8) * HR > t0).map((h) => [day + "T" + p2(h), p2(h) + ":00 to " + p2(h + 4) + ":00"]);
    const days = [0, 1, 2, 3, 4, 5, 6, 7].map(dayN).filter((d) => winsOn(d).length), tDay = s12w().slice(0, 10);
    const WKD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], dayLabel = (d) => d === dayN(0) ? "Today" : d === dayN(1) ? "Tomorrow" : WKD[new Date(d + "T00:00:00Z").getUTCDay()] + " " + dayName(d);
    const listed = (skip) => days.flatMap((d) => winsOn(d).filter((x) => x[0] !== skip).map((x) => [x[0], dayLabel(d) + ", " + x[1]]));
    ok(Wn.WINDOWS.length === 6 && days.length >= 7 && JSON.stringify(wins(A)) === JSON.stringify([["", "ASAP"]].concat(listed()))
      && !whenOf(B) && JSON.stringify(wins(T)) === JSON.stringify([["", "Theirs, 12:00 to 16:00 on " + dayName(tDay)]].concat(listed(s12w()))),
      "Salt Admin offers one When: ASAP, then every window still to start on each of the coming week's days, each saying its day, none on a sheet's other lines, and theirs first on an order with its own: "
      + JSON.stringify({ a: wins(A).slice(0, 4), b: wins(B), t: wins(T).slice(0, 3), days }));
    const first = winsOn(days[0])[0];
    choose(feeOf(A), "10"); choose(whenOf(A), first[0]);
    choose(feeOf(T), "0");
    const bA = await acceptOf(A), bB = await acceptOf(B), bT = await acceptOf(T);
    ok(bA.slot === first[0] && bB.slot === first[0] && !("slot" in bT) && bA.delivery === 10 && bB.delivery === 0,
      "Salt Admin's Accept sends the window he picked, its sheet's other line the same, and an order with its own time none: " + JSON.stringify([bA, bB, bT]));
    /* 20 Oct 2026 (his answer): Salt Admin opens the spot too, after the one unlock; locked, its card says Sealed and never the id */
    ok(!!acard(PN).querySelector("[data-pin-gate]") && /Delivery address\s*Sealed/.test(acard(PN).textContent) && !acard(T).querySelector("[data-pin-gate]") && !/abababab/.test(acard(PN).textContent),
      "Salt Admin says a spot was shared, sealed until the one unlock, never its id: " + acard(PN).textContent.slice(0, 200));
  } finally { browser.window.close(); }
}
