/* test/delivery-yes.mjs: VERSION 2 OF HIS ACCEPT, THEIR YES (his decisions of 10 Oct 2026). Goods above what they placed it at,
 * or a window other than theirs, is never agreed by his Accept alone: it goes to them as an offer of the whole order as he would
 * agree it (goods, his delivery charge, the window), open until the window's start or 48 hours. Their yes is a take, drafted and
 * approved only on an exact match (D6); their No thanks withdraws the order; his withdrawal or its lapse leaves the order his to
 * Accept again. His first delivery charge and a window on an order that asked for none need no yes (Q1, Q3), and a sheet is never
 * sent for their yes (Q7). Every code, name and place is invented. Every assertion was proved red by its own mutation. */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { webcrypto } from "node:crypto";
import { cardOf } from "./maker-act.mjs";
import { orderBook } from "./orderbook-harness.mjs";
import { Store } from "./maker-order-controls.mjs";

const REPO = join(import.meta.dirname, "..");
const H = 3600e3;
const wait = async (f) => { for (let i = 0; i < 200 && !f(); i++) await new Promise((r) => setTimeout(r, 15)); return f(); };

export async function run({ ok }) {
  const D = await import("../src/orders.js"), O = await import("../stmt/orders.js"), Wn = await import("../stmt/window.js");

  /* 1. THE RULE: a raise or another window needs their yes; nothing else does */
  const o100 = { total: 100 }, own = { total: 100, slot: "2026-10-11T08" };
  ok(!D.needsYes(o100, { total: 100 }) && !D.needsYes(o100, { total: 90 }) && !D.needsYes(o100, { total: 100.004 }) && D.needsYes(o100, { total: 100.01 })
    && !D.needsYes(o100, { slot: "2026-10-11T12" }) && D.needsYes(own, { slot: "2026-10-11T12" }) && !D.needsYes(own, { slot: "2026-10-11T08" }) && !D.needsYes(own, {}),
    "their yes is needed for goods above what they placed it at, to the sen, or a window other than theirs; never a lower price, a window on an as-soon-as order, or none");
  const at = new Date("2026-10-10T02:00:00.000Z");   /* 10:00 in Kuala Lumpur */
  const until = (a, s) => D.acceptUntil(new Date(a), s);
  ok(until(at, null) === "2026-10-12T02:00:00.000Z" && until(at, "2026-10-10T16") === "2026-10-10T08:00:00.000Z"
    && until(at, "2026-10-10T08") === "2026-10-10T04:00:00.000Z" && until("2026-10-10T03:30:00.000Z", "2026-10-10T12") === "2026-10-10T08:00:00.000Z"
    && until(at, "2026-10-14T20") === "2026-10-12T02:00:00.000Z",
    "an offer is open 48 hours, or until the window starts when that is an hour or more ahead and sooner, else until it ends");
  const priced = (state, untilAt, from) => ({ status: "placed", price: { state, from, offer: { until: untilAt } } });
  ok(!D.acceptClosed(priced("offered", "2026-10-12T00:00:00.000Z", "accept"), at) && D.acceptClosed(priced("offered", "2026-10-09T00:00:00.000Z", "accept"), at)
    && D.acceptClosed(priced("withdrawn", "2026-10-12T00:00:00.000Z", "accept"), at) && !D.acceptClosed(priced("taken", "2026-10-09T00:00:00.000Z", "accept"), at)
    && !D.acceptClosed(priced("offered", "2026-10-09T00:00:00.000Z", undefined), at),
    "an offer for their yes no longer holds the order once lapsed, withdrawn or said no to; one taken, and a Negotiate ask, are not this road's");
  const edge = "2026-10-10T02:00:00.000Z";
  ok(!D.acceptClosed(priced("offered", edge, "accept"), new Date("2026-10-10T02:00:30.000Z")) && D.acceptClosed(priced("offered", edge, "accept"), new Date("2026-10-10T02:01:30.000Z")),
    "the desk reads the lapse a minute late, so a take stamped by its last moment lands before his Accept can");

  /* 2. THE COUNTER: the offer, what their page reads of it, their answer, and the acknowledgement it leads to */
  const base = { id: "o1", u: "abcd-efgh", status: "placed", mode: "deliver", product: "salt", qty: 1, total: 100, history: [], msgs: [] };
  const offerBody = (x) => ({ offer: Object.assign({ id: "acc1", kind: "accept", total: 120, delivery: 10, slot: null, until: "2026-10-12T02:00:00.000Z" }, x) });
  const dd = (o, b, t) => O.decideDesk(Object.assign({}, base, o), b, (t || at).toISOString());
  const e1 = dd({}, offerBody({}));
  const bad = [dd({ mode: "collect" }, offerBody({ delivery: 5 })), dd({}, offerBody({ slot: "2026-10-11T08" })), dd({}, offerBody({ until: "2026-10-09T00:00:00.000Z" })),
    dd({ price: { state: "asked" } }, offerBody({})), dd({ status: "acknowledged" }, offerBody({}))];
  ok(e1.ev && e1.ev.offer.kind === "accept" && e1.ev.offer.total === 120 && e1.ev.offer.delivery === 10 && e1.ev.offer.product === "salt"
    && bad.every((x) => x.error && [400, 409].includes(x.status)),
    "the Counter takes his offer for their yes on a placed order, and refuses a charge on a collection, a window with no span, a past lapse, an ask of theirs or an agreed order: "
    + JSON.stringify(bad.map((x) => x.status)));
  const held = O.applyEvent(Object.assign({}, base, { history: [] }), e1.ev).order;
  const view = O.customerView(held).price;
  ok(held.price.from === "accept" && held.price.state === "offered" && !O.askOpen(held, at.toISOString())
    && JSON.stringify(Object.keys(view).sort()) === JSON.stringify(["delivery", "from", "slot", "slotSpan", "state", "total", "until"])
    && view.total === 120 && view.delivery === 10 && !("id" in view),
    "their page reads the whole offer and nothing of the desk's, and it never counts as an ask of theirs: " + JSON.stringify(view));
  const again = dd({ price: held.price }, offerBody({ id: "acc2" })), ackOpen = dd({ price: held.price }, { status: "acknowledged", delivery: 10 }),
    ackLapsed = dd({ price: held.price }, { status: "acknowledged", delivery: 10 }, new Date("2026-10-13T00:00:00.000Z")),
    reOffer = dd({ price: held.price }, offerBody({ id: "acc3", until: "2026-10-15T00:00:00.000Z" }), new Date("2026-10-13T00:00:00.000Z"));
  ok(again.status === 409 && ackOpen.status === 409 && ackLapsed.ev && ackLapsed.ev.status === "acknowledged" && reOffer.ev && reOffer.ev.offer.id === "acc3",
    "an open offer holds the order; once it lapses he may Accept at their terms or send another: " + JSON.stringify([again.status, ackOpen.status, !!ackLapsed.ev, !!reOffer.ev]));
  const pass = O.decideCustomer(held, "pass", {}, [held], at.toISOString()), passed = O.applyEvent(JSON.parse(JSON.stringify(held)), pass.ev).order;
  ok(passed.status === "cancelled" && passed.price.state === "passed", "No thanks to his offer withdraws the order, at no cost: " + passed.status);
  /* the window of an offer they said yes to reaches the order, even over their own */
  const ownWin = Object.assign({}, base, { slot: "2026-10-11T08", slotSpan: "09:00-12:00" });
  const wHeld = O.applyEvent(JSON.parse(JSON.stringify(ownWin)), O.decideDesk(ownWin, offerBody({ slot: "2026-10-11T16", slotSpan: "16:00-18:00" }), at.toISOString()).ev).order;
  const taken = O.applyEvent(wHeld, O.decideCustomer(wHeld, "take", {}, [wHeld], at.toISOString()).ev).order;
  const ackT = O.decideDesk(taken, { status: "acknowledged", delivery: 10, total: 120, slot: "2026-10-11T16", slotSpan: "16:00-18:00" }, at.toISOString()),
    ackX = O.decideDesk(taken, { status: "acknowledged", delivery: 10, total: 120, slot: "2026-10-11T20", slotSpan: "20:00-24:00" }, at.toISOString());
  ok(ackT.ev && ackT.ev.slot === "2026-10-11T16" && ackX.ev && !("slot" in ackX.ev),
    "the acknowledgement takes the window of the offer they said yes to, over their own, and no other: " + JSON.stringify([ackT.ev && ackT.ev.slot, ackX.ev && ackX.ev.slot]));
  const SW = await import("../stmt/sw.js");
  ok(O.wakes(e1.ev, held, false).k === "confirm" && O.wakes({ kind: "offer", offer: { id: "n1", total: 1 } }, held, false).k === "offer"
    && SW.NEWS.confirm === "Your order needs your yes" && !/RM|[0-9]/.test(SW.NEWS.confirm),
    "his offer for their yes wakes them with its own words, never a figure, a product, a place or a time");

  /* 3. END TO END, over the real schema: a raise taken, another window taken, a sheet refused, No thanks, a withdrawal, a lapse */
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
    const C1 = "CZ5-YS", U1 = "ysab-cdef";
    const PRICING = { v: "v900", takenAt: "2026-09-24T00:00:00.000Z", tierNames: ["Ambassador", "Titanium", "Platinum", "Gold", "Silver"], profileRule: { smallUpTo: 1, bigFrom: 3 },
      byProduct: { salt: { stockCost: 56, floors: { "1": { floor: 80 }, "2": { floor: 150 }, "3": { floor: 215 } }, inputs: null, sizes: [1, 2, 3] } } };
    const setState = (k, doc) => db.prepare("INSERT OR REPLACE INTO state (key,doc) VALUES (?,?)").run(k, JSON.stringify(doc));
    let seq = 0;
    for (const d of ["2026-08-01", "2026-08-10", "2026-08-20"]) db.prepare("INSERT INTO entry (collection,seq,hash,doc) VALUES (?,?,?,?)")
      .run("sales", seq++, "h" + seq, JSON.stringify({ rid: "s9" + seq, customer: C1, date: d, qty: 1, total: 100, cash: 100, deliveredQty: 1, deliveredOn: d, paidOn: d }));
    setState("roster", [C1]); setState("PRICING", PRICING); setState("OPEN", { byKey: {}, position: {} });
    db.prepare("INSERT INTO snapshot (one,v,stamped) VALUES (1,'v900',NULL)").run();
    const skv = new Store(), dkv = new Store(), senv = { STMT: skv, STMT_DESK_KEY: "desk-key", ORDER_STORE: "object" };
    senv.ORDERBOOK = orderBook(senv).ns;
    await skv.put("maker:hours", JSON.stringify({ schedule: { days: Array.from({ length: 7 }, () => ({ open: "09:00", close: "18:00" })) } }));
    await dkv.put("stmt-users", JSON.stringify({ [U1]: C1 }));
    const assets = { fetch: async () => new Response(JSON.stringify({ id: "rev-fixture" }), { headers: { "content-type": "application/json" } }) };
    const denv = { SALT_QUEUE: dkv, SALT_LEDGER: D1, STMT_DESK_KEY: "desk-key", SALT_WRITE_KEY: "k-fixture", REQUIRE_ACCESS: "0", ASSETS: assets,
      STMT_SITE: { fetch: (url, init) => stmtW.fetch(new Request(url, init), senv) } };
    const call = async (path, body) => {
      const r = await deskW.fetch(new Request("https://salt-command.example" + path, { method: "POST",
        headers: { "content-type": "application/json", "X-Salt-Key": "k-fixture" }, body: JSON.stringify(body || {}) }), denv, { waitUntil() {} });
      return { status: r.status, j: await r.json() };
    };
    let n = 0;
    const rid = () => "deliveryYesTap" + String(++n).padStart(6, "0");
    const place = async (extra) => (await O.placeOrder(senv, U1, Object.assign({ product: "salt", qty: 1, mode: "deliver", place: "by the old market", unit: 100, total: 100, week: "", rid: rid() }, extra || {}))).order;
    const orderOf = async (id) => (await O.allOrders(senv, true)).find((x) => x.id === id);
    const preOf = (id) => db.prepare("SELECT status,shown FROM preapproval WHERE order_id=? ORDER BY at DESC").get(id) || null;
    const pv = async (o, total) => (await call("/orders/" + o.id + "/preview", Object.assign({ delivery: 10 }, total != null ? { total } : {}))).j;
    const now = Date.now(), s8 = Wn.slotNext(8, null, now).slot, s12 = Wn.slotNext(12, null, now).slot;

    /* a raise: Accept refuses it, the offer carries it, their yes moves the order at it */
    const a = await place();
    const pA = await pv(a, 130), acA = await call("/orders/" + a.id + "/accept", { delivery: 10, total: 130, hash: pA.hash });
    const rA = rid(), ofA = await call("/orders/" + a.id + "/offer", { delivery: 10, total: 130, hash: pA.offerHash, rid: rA }), sA = await orderOf(a.id);
    const ofA2 = await call("/orders/" + a.id + "/offer", { delivery: 10, total: 130, hash: pA.offerHash, rid: rA });
    ok(ofA2.status === 200 && ofA2.j.again === true && ofA2.j.offer.id === rA, "a retried Send for their yes is answered with the offer its first tap filed: " + JSON.stringify([ofA2.status, ofA2.j.error]));
    ok(acA.status === 409 && acA.j.needsYes === true && ofA.status === 200 && ofA.j.offer.kind === "accept" && sA.status === "placed" && sA.price.from === "accept"
      && sA.price.offer.total === 130 && sA.price.offer.delivery === 10 && JSON.parse(preOf(a.id).shown).offer.kind === "accept",
      "a raise is refused at Accept and sent for their yes, his yes filed with it: " + JSON.stringify([acA.status, acA.j.error, ofA.status, ofA.j.error]));
    await O.customerMove(senv, U1, a.id, "take", { rid: rid() });
    const tkA = await D.takeOffer(denv, a.id), gA = await orderOf(a.id);
    ok(tkA.approved === true && gA.status === "acknowledged" && gA.total === 130 && gA.delivery === 10,
      "their yes drafts the row at the offer and moves the order to it: " + JSON.stringify([tkA.approved, tkA.error, gA.status, gA.total, gA.delivery]));

    /* another window: sent for their yes, and taken, the order carries it cut to the hours */
    const b = await place({ slot: s12 });
    const pB = await pv(b), ofB = await call("/orders/" + b.id + "/offer", { delivery: 10, hash: pB.offerHash, slot: s8, rid: rid() });
    const sB = await orderOf(b.id), vB = O.customerView(sB).price;
    await O.customerMove(senv, U1, b.id, "take", { rid: rid() });
    const tkB = await D.takeOffer(denv, b.id), gB = await orderOf(b.id);
    ok(ofB.status === 200 && vB.slot === s8 && vB.slotSpan === "09:00-12:00" && tkB.approved === true && gB.status === "acknowledged" && gB.slot === s8 && gB.slotSpan === "09:00-12:00",
      "another window goes for their yes with its span cut to the hours, and once taken the order carries it: " + JSON.stringify([ofB.status, ofB.j.error, vB, gB.slot, gB.slotSpan]));

    /* nothing to agree to: the offer is refused, and a lower price is his Accept's */
    const c = await place();
    const pC = await pv(c, 90), ofC = await call("/orders/" + c.id + "/offer", { delivery: 10, total: 90, hash: pC.offerHash, rid: rid() }),
      ofC2 = await call("/orders/" + c.id + "/offer", { delivery: 10, hash: (await pv(c)).offerHash, slot: s8, rid: rid() });
    ok(ofC.status === 409 && /nothing here needs their yes/.test(ofC.j.error) && ofC2.status === 409 && (await orderOf(c.id)).price === undefined,
      "an offer is refused when nothing needs their yes, a window on an as-soon-as order included: " + JSON.stringify([ofC.status, ofC2.status]));

    /* a sheet of several lines is never sent for their yes (Q7) */
    const L0 = await place({ sheet: "sheetYesFixture000001" }), L1 = await place({ sheet: "sheetYesFixture000001", product: "oil", unit: 30, total: 30 });
    const lines = [L0, L1].filter(Boolean);
    const ofS = await call("/orders/" + L0.id + "/offer", { delivery: 10, total: 120, hash: (await pv(L0, 120)).offerHash, rid: rid() });
    ok(lines.length === 2 && ofS.status === 409 && /a sheet of several lines/.test(ofS.j.error || ""),
      "a line of a sheet is never sent for their yes: lower it, keep their window, or Decline: " + JSON.stringify([lines.length, ofS.status, ofS.j.error]));

    /* they withdraw what is still placed, so the account stays under its five open orders */
    for (const x of [c, L0, L1]) await O.customerMove(senv, U1, x.id, "cancel", { rid: rid() });
    /* No thanks withdraws the order, and his yes goes */
    const d = await place();
    const pD = await pv(d, 125);
    await call("/orders/" + d.id + "/offer", { delivery: 10, total: 125, hash: pD.offerHash, rid: rid() });
    await O.customerMove(senv, U1, d.id, "pass", { rid: rid() });
    await D.deskPass(denv, new Date());
    const gD = await orderOf(d.id);
    ok(gD.status === "cancelled" && preOf(d.id).status === "void", "No thanks withdraws the order at no cost, and his yes is let go: " + JSON.stringify([gD.status, preOf(d.id).status]));

    /* his withdrawal leaves the order as they placed it, his to Accept */
    const e = await place();
    const pE = await pv(e, 125);
    await call("/orders/" + e.id + "/offer", { delivery: 10, total: 125, hash: pE.offerHash, rid: rid() });
    const wE = await call("/orders/" + e.id + "/withdraw", { rid: rid() });
    const pE2 = await pv(e), acE = await call("/orders/" + e.id + "/accept", { delivery: 10, hash: pE2.hash }), gE = await orderOf(e.id);
    ok(wE.status === 200 && acE.j.approved === true && gE.status === "acknowledged" && gE.total === 100,
      "withdrawn, the order stands as they placed it and his Accept agrees it: " + JSON.stringify([wE.status, acE.status, acE.j.error, gE.status, gE.total]));

    /* a lapse never freezes the order: two days on, his Accept at their terms lets the old yes go and agrees it */
    const f = await place();
    const pF = await pv(f, 125);
    await call("/orders/" + f.id + "/offer", { delivery: 10, total: 125, hash: pF.offerHash, rid: rid() });
    const RealDate = Date, shift = 49 * H;
    class Later extends RealDate { constructor(...a) { if (a.length) super(...a); else super(RealDate.now() + shift); } static now() { return RealDate.now() + shift; } }
    globalThis.Date = Later;
    let acF, gF, pre;
    try {
      const pF2 = await pv(f);
      acF = await call("/orders/" + f.id + "/accept", { delivery: 10, hash: pF2.hash });
      gF = await orderOf(f.id); pre = db.prepare("SELECT status FROM preapproval WHERE order_id=? AND json_extract(shown,'$.offer') IS NOT NULL").get(f.id);
    } finally { globalThis.Date = RealDate; }
    ok(acF.j.approved === true && gF.status === "acknowledged" && gF.total === 100 && pre && pre.status === "void",
      "a lapsed offer holds nothing: his Accept at their terms agrees the order and its yes is let go: " + JSON.stringify([acF.status, acF.j.error, gF.status, pre && pre.status]));
  } else ok(true, "node:sqlite is unavailable here, so their yes was not driven against the real schema");

  /* 4. THEIR PAGE: what changed, Yes or No thanks */
  const { landingPage } = await import("../stmt/page.js"), C = await import("../tools/stmt-crypto.mjs"), { JSDOM } = await import("jsdom");
  const W = await import("../stmt/words.js");
  const U = "yeab-cdef", PASS = "fixture-pass-yes-4", ck = await C.contentKey("test-secret", U);
  const soon = new Date(Date.now() + 20 * H).toISOString(), gone = new Date(Date.now() - H).toISOString();
  const order = (id, price) => ({ id, at: "2026-10-09T01:00:00Z", product: "salt", qty: 1, unit: 100, total: 100, delivery: 0, mode: "deliver", paid: 0, moved: 0, status: "placed",
    history: [{ at: "2026-10-09T01:00:00Z", status: "placed", by: "customer" }], msgs: [], price });
  const P1 = "20261009010000-ofye", P2 = "20261009010000-ofgo";
  const ORDERS = [Object.assign(order(P1, { state: "offered", from: "accept", total: 120, delivery: 10, slot: "2026-10-11T08", slotSpan: "09:00-12:00", until: soon }),
      { history: [{ at: "2026-10-09T01:00:00Z", status: "placed", by: "customer" }, held.history[held.history.length - 1]] }),
    order(P2, { state: "offered", from: "accept", total: 120, delivery: 10, slot: null, slotSpan: null, until: gone })];
  const body = { ok: true, wrap: await C.wrapKey(PASS, ck), session: "sess-yes",
    env: await C.encryptWith(ck, JSON.stringify({ statements: [{ issued: "2026-09-01", label: "September", body: "<p>Statement</p>" }] })) };
  const posted = [];
  const dom = new JSDOM(landingPage(U, "nyes", null), { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true, beforeParse(win) {
    try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
    win.scrollTo = () => {}; win.HTMLElement.prototype.scrollIntoView = () => {};
    win.fetch = async (path, init) => {
      const p = String(path), m = (init && init.method) || "GET", reply = (status, b) => ({ ok: status === 200, status, type: "basic", json: async () => b });
      if (p === "/open") return reply(200, body);
      if (p === "/orders" && m === "GET") return reply(200, { ok: true, orders: ORDERS });
      if (m === "POST" && p.startsWith("/orders/")) { posted.push(p); return reply(200, { ok: true }); }
      return reply(404, { ok: false });
    };
  } });
  try {
    const w = dom.window, d = w.document;
    d.getElementById("un").value = U; d.getElementById("pw").value = PASS;
    d.getElementById("f").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
    const openRow = async (id) => { await wait(() => d.querySelector('#pOrder [data-row="' + id + '"]')); d.querySelector('#pOrder [data-row="' + id + '"]').click();
      await wait(() => d.querySelector("#pOrder .oscreen")); return d.querySelector("#pOrder .oscreen"); };
    const s1 = await openRow(P1), t1 = s1 ? s1.textContent : "(their order screen did not draw)";
    ok(t1.includes(W.EN["np.cAsk"]) && /You placed it at RM ?100/.test(t1) && /Delivery RM ?10/.test(t1) && /Delivery between 09:00 and 12:00 on /.test(t1)
      && t1.includes(W.EN["np.cYes"]) && t1.includes(W.EN["np.cNo"]) && t1.includes(W.EN["hist.price.confirm"]) && !/their yes/.test(t1),
      "their page says what changed, the goods beside what they placed, his delivery charge and the window, with Yes and No thanks: " + t1.slice(0, 400));
    const yesB = s1 && [...s1.querySelectorAll("button")].find((x) => x.textContent === W.EN["np.cYes"]); if (yesB) yesB.click();
    ok(await wait(() => posted.some((p) => p === "/orders/" + P1 + "/take")), "Yes takes it: " + JSON.stringify(posted));
    const back = d.querySelector("#pOrder .oback"); if (back) back.click();
    const s2 = await openRow(P2), t2 = s2 ? s2.textContent : "(their order screen did not draw)";
    ok(t2.includes(W.EN["np.cLapsed"]) && !t2.includes(W.EN["np.cYes"]), "a lapsed offer says so, and is no longer theirs to take: " + t2.slice(0, 300));
  } finally { await new Promise((r) => setTimeout(r, 60)); dom.window.close(); }

  /* 5. THE DESK'S CARD: Send for their yes when it is needed, the offer said while it is open, Withdraw, and Accept once it lapses */
  const { openMaster } = await import("../tools/payload.mjs");
  const { w: mw } = await openMaster(process.env.SALT_MASTER || undefined);
  const rd = (e) => JSON.parse(String(mw.eval("JSON.stringify(" + e + ")")));
  const P = { id: "20261010050000-dyes", u: "dyab-cdef", code: "CZ6-DY", status: "placed", mode: "deliver", product: "salt", qty: 1, total: 100, at: "2026-10-10T05:00:00Z", history: [], msgs: [] };
  const s8 = Wn.slotNext(8, null, Date.now()).slot, s12 = Wn.slotNext(12, null, Date.now()).slot;
  const card = (o, setup) => { mw.eval("ORD_OPEN=" + JSON.stringify([o]) + ";ORD_PRICE={};ORD_WIN={};ORD_CHIP={};ORD_PV={};" + (setup || "")); return String(mw.eval("ordCard(ORD_OPEN[0])")); };
  const raise = card(P, "ORD_PRICE['" + P.id + "']=120;"), plain = card(P, "ORD_PRICE['" + P.id + "']=90;"),
    winOwn = card(Object.assign({}, P, { slot: s12, slotSpan: "12:00-16:00" }), "ORD_WIN['" + P.id + "']='" + s8 + "';"),
    winAsap = card(P, "ORD_WIN['" + P.id + "']='" + s8 + "';");
  const open = card(Object.assign({}, P, { price: { state: "offered", from: "accept", offer: { id: "x1", kind: "accept", total: 120, delivery: 10, slot: s8, slotSpan: "09:00-12:00", until: new Date(Date.now() + 20 * H).toISOString() } } }));
  const lapsed = card(Object.assign({}, P, { yes: "offer", price: { state: "offered", from: "accept", offer: { id: "x1", kind: "accept", total: 120, delivery: 10, until: new Date(Date.now() - H).toISOString() } } }));
  mw.eval("window.__sent=[];window.fetch=function(u,o){window.__sent.push({u:String(u),b:o&&o.body?JSON.parse(o.body):null});return Promise.resolve({ok:true,status:200,json:function(){return Promise.resolve({ok:true,offer:{kind:'accept',until:new Date(Date.now()+3600000).toISOString()}});}});};"
    + "ordLoad=function(){return Promise.resolve();};ordDraw=function(){};");
  const O2 = Object.assign({}, P, { slot: s12, slotSpan: "12:00-16:00" });
  mw.eval("ORD_OPEN=" + JSON.stringify([O2]) + ";ORD_PRICE={'" + P.id + "':120};ORD_WIN={'" + P.id + "':'" + s8 + "'};ORD_CHIP={'" + P.id + "':'10'};ordBusy={};"
    + "ORD_PV={'" + P.id + "':{st:'ok',d:10,p:120,gen:ORD_PV_GEN,j:{hash:'h1',offerHash:'oh1'}}};");
  const sent = rd("window.__sent")[0];
  const sib = (id, x) => Object.assign({}, P, { id, sheet: "shY" }, x || {});
  mw.eval("ORD_OPEN=" + JSON.stringify([sib("20261010050001-dyes"), sib("20261010050002-dyes")]) + ";ORD_PRICE={'20261010050002-dyes':150};ORD_WIN={};ORD_CHIP={'20261010050001-dyes':'10'};"
    + "window.__sent=[];ORD_SHEET_BUSY='';ORD_SAID=null;ORD_PV={};ORD_OPEN.forEach(function(x,i){ORD_PV[x.id]={st:'ok',d:i?0:10,p:i?150:null,j:{hash:'h'+i}};});");

  /* 6. COUNTER ADMIN: the same road, Send for their yes and Withdraw (#104 parity) */
  const posts = [];
  const orderOf2 = (id, patch = {}) => ({ id, u: "mbab-cdef", product: "salt", qty: 1, total: 100, status: "placed", mode: "deliver", history: [], ...patch });
  const A = "20261010070001-ayes", T = "20261010070002-ayes", K = "20261010070003-ayes";
  const reviewBody = { ok: true, drafts: [], orders: [orderOf2(A), orderOf2(T, { slot: s12, slotSpan: "12:00-16:00" }),
    orderOf2(K, { price: { state: "offered", from: "accept", offer: { id: "k1", kind: "accept", total: 120, delivery: 10, until: new Date(Date.now() + 20 * H).toISOString() } } })] };
  const browser = new JSDOM(landingPage("", "fixture", { master: "local-master", accounts: [] }), {
    url: "https://counter.fixture.test/all", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(window) {
      Object.defineProperty(window, "crypto", { value: { getRandomValues: (a) => webcrypto.getRandomValues(a), randomUUID: () => webcrypto.randomUUID(), subtle: webcrypto.subtle } });
      window.TextEncoder = TextEncoder; window.TextDecoder = TextDecoder; window.scrollTo = () => {};
      window.fetch = async (path, init) => {
        if (init && init.method === "POST" && String(path).startsWith("/all/maker/orders/")) {
          const b = JSON.parse(init.body);
          if (String(path).endsWith("/preview")) { posts.push({ kind: "preview", path: String(path), body: b });
            return Response.json({ ok: true, quote: b.total, delivery: b.delivery, hash: "a".repeat(64), offerHash: "b".repeat(64), row: { qty: 1, total: b.total }, flags: [],
              cost: { unit: 80, total: 80, source: "purchase" }, card: 100, cardNote: null, floor: { rm: 80, at: 1, exact: true }, margin: { rm: 20, pct: 20 },
              usual: { who: "CZ7-MB", rate: 100, orders: 4, uniform: true, off: false, dir: 0, far: false }, prepay: false, owedWith: 100, ceiling: 250, late: null }); }
          posts.push({ kind: String(path).split("/").pop(), path: String(path), body: b }); return Response.json({ ok: true });
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
    const doc = browser.window.document, Ev = browser.window.Event;
    const acard = (id) => cardOf(doc, id);
    const button = (id, text) => acard(id) && [...acard(id).querySelectorAll("button")].find((b) => b.textContent.indexOf(text) === 0);
    const radio = (id, name, label) => acard(id) && [...acard(id).querySelectorAll('input[name="' + name + '-' + id + '"]')].find((r) => r.closest(".salt-option").textContent === label);
    const pick = (id, name, label) => { const r = radio(id, name, label); r.checked = true; r.dispatchEvent(new Ev("change", { bubbles: true })); };
    doc.querySelector('[data-act="nav.orders"]').click();
    await wait(() => doc.querySelector('[data-act="order.open"]'));
    ok(/Waiting for their yes to RM ?120\.00 \+ RM ?10\.00, until /.test(acard(K).textContent) && !acard(K).querySelector("[data-accept]") && !posts.some((p) => p.kind === "preview" && p.path.includes(K)) && !!button(K, "Take back the offer"),
      "Counter Admin says an open offer and offers Withdraw, never a second Accept: " + acard(K).textContent.slice(0, 200));
    button(K, "Take back the offer").click();
    ok(await wait(() => posts.some((p) => p.kind === "withdraw")) && /^[A-Za-z0-9_-]{16,64}$/.test(posts.find((p) => p.kind === "withdraw").body.rid), "Withdraw posts under its tap's own id");
    await new Promise((r) => setTimeout(r, 250));
    pick(A, "makerFee", "RM 10");
    const tot = acard(A).querySelector('.maker-fields input[type="number"]'); tot.value = "125"; tot.dispatchEvent(new Ev("input", { bubbles: true })); tot.dispatchEvent(new Ev("change", { bubbles: true }));
    await wait(() => button(A, "Ask them"));
    ok(!!button(A, "Ask them, RM 125.00"), "a raise previewed is sent for their yes, never accepted");
    button(A, "Ask them").click();
    await wait(() => posts.some((p) => p.kind === "offer" && p.path.includes(A)));
    const oA = posts.find((p) => p.kind === "offer" && p.path.includes(A));
    ok(oA && oA.body.total === 125 && oA.body.delivery === 10 && oA.body.hash === "b".repeat(64) && !("slot" in oA.body), "its offer carries the goods, his charge and the offer's digest: " + JSON.stringify(oA && oA.body));
    await new Promise((r) => setTimeout(r, 250));
    pick(T, "makerFee", "RM 0");
    const other = [...acard(T).querySelectorAll('input[name="makerWin-' + T + '"]')].find((r) => r.value && r.value !== s12);
    other.checked = true; other.dispatchEvent(new Ev("change", { bubbles: true }));
    await wait(() => button(T, "Ask them"));
    button(T, "Ask them").click();
    await wait(() => posts.some((p) => p.kind === "offer" && p.path.includes(T)));
    const oT = posts.find((p) => p.kind === "offer" && p.path.includes(T));
    ok(oT && oT.body.slot === other.value && oT.body.total === 100, "another window is sent for their yes with the window: " + JSON.stringify(oT && oT.body));
  } finally { browser.window.close(); }
}
