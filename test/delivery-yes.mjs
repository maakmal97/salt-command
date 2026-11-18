/* test/delivery-yes.mjs: VERSIONS 2 AND 3 OF HIS ACCEPT, THEIR YES (his decisions of 10 Oct 2026). Goods above what they placed it at,
 * a change of units or way, or a window other than theirs, is never agreed by his Accept alone: it goes to them as an offer of the
 * whole order as he would agree it (goods, units, way, his delivery charge, the window), open until the window's start or 48 hours.
 * Their yes is a take, drafted and
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
  const placed = { total: 100, qty: 1, mode: "deliver" };
  ok(!D.needsYes(placed, { total: 100, qty: 1, mode: "deliver" })
    && D.needsYes(placed, { total: 100, qty: 2, mode: "deliver" })
    && D.needsYes(placed, { total: 100, qty: 1, mode: "collect" }),
    "their yes is needed before changing the units or the way");
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
  /* V3: Negotiate's offer on an asked order carries the units and the way, and refuses terms that do not hold together */
  const negBody = (x) => ({ offer: Object.assign({ id: "neg1", total: 120, delivery: 0, qty: 2, mode: "collect", termsChanged: true, wasQty: 1, wasMode: "deliver", until: "2026-10-12T02:00:00.000Z" }, x) });
  const asked = { price: { state: "asked" } }, neg = dd(asked, negBody({}));
  const negBad = [dd(asked, negBody({ mode: "air" })), dd(asked, negBody({ delivery: 10 })), dd(asked, negBody({ delivery: undefined })), dd(asked, negBody({ mode: "deliver", wasMode: "deliver", delivery: undefined })), dd(asked, negBody({ wasMode: "collect" })),
    dd(asked, negBody({ wasQty: 3 })), dd(asked, negBody({ qty: 0 })), dd(asked, negBody({ termsChanged: "yes" })), dd(asked, negBody({ slot: "2026-10-11T08", slotSpan: "09:00-12:00" })),
    dd(asked, negBody({ mode: "deliver", delivery: -1 }))];
  const negO = neg.ev && neg.ev.offer;
  ok(negO && negO.qty === 2 && negO.mode === "collect" && negO.delivery === 0 && negO.termsChanged === true && negO.wasQty === 1 && negO.wasMode === "deliver"
    && negBad.every((x) => x.error && x.status === 400),
    "Negotiate's offer keeps the units, the way and what they were changed from, and refuses a way that is not one, a charge on a collection, a way with no charge (a delivery too), terms changed from what the order is, a size of nothing, a flag that is no flag, a window on a collection and a negative charge: " + JSON.stringify([negO, negBad.map((x) => x.status)]));
  const held = O.applyEvent(Object.assign({}, base, { history: [] }), e1.ev).order;
  const view = O.customerView(held).price;
  ok(held.price.from === "accept" && held.price.state === "offered" && !O.askOpen(held, at.toISOString())
    /* 3 Nov 2026: and the offer's id, a random request id their Yes names back so it reaches only this offer (Fable reviewed it safe) */
    && JSON.stringify(Object.keys(view).sort()) === JSON.stringify(["delivery", "from", "id", "mode", "qty", "slot", "slotSpan", "state", "total", "until"])
    && view.total === 120 && view.delivery === 10 && view.id === held.price.offer.id,
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
  const dated = Object.assign({}, base, { wantBy: "2026-10-11", slot: "2026-10-11T08", slotSpan: "09:00-12:00" });
  const change = O.decideDesk(dated, offerBody({ id: "acc-change", delivery: 0, qty: 2, mode: "collect", slot: null,
    slotSpan: null, wasQty: 1, wasMode: "deliver" }), at.toISOString());
  const changeHeld = O.applyEvent(JSON.parse(JSON.stringify(dated)), change.ev).order, changeView = O.customerView(changeHeld).price;
  const changeTake = O.decideCustomer(changeHeld, "take", {}, [changeHeld], at.toISOString());
  const changeTaken = changeTake.ev ? O.applyEvent(JSON.parse(JSON.stringify(changeHeld)), changeTake.ev).order : changeHeld;
  /* their yes is judged on the terms they were shown (wasQty, wasMode), so a changed size or way voids it, and the right order takes it */
  const voidQty = O.decideCustomer(Object.assign({}, changeHeld, { qty: 5 }), "take", {}, [changeHeld], at.toISOString()),
    voidWay = O.decideCustomer(Object.assign({}, changeHeld, { mode: "collect" }), "take", {}, [changeHeld], at.toISOString());
  ok(!!changeTake.ev && !changeTake.error && !!voidQty.error && voidQty.status === 409 && !!voidWay.error && voidWay.status === 409,
    "their yes is taken by the order they were shown and refused once its size or its way has changed: " + JSON.stringify([changeTake.error, voidQty.status, voidWay.status]));
  const changeAck = O.decideDesk(changeTaken, { status: "acknowledged", total: 120, qty: 2, mode: "collect", delivery: 0 }, at.toISOString());
  const changeFinal = O.applyEvent(JSON.parse(JSON.stringify(changeTaken)), changeAck.ev).order;
  ok(change.ev && change.ev.offer.qty === 2 && change.ev.offer.mode === "collect" && changeView.qty === 2 && changeView.mode === "collect"
    && changeAck.ev && changeAck.ev.qty === 2 && changeAck.ev.mode === "collect" && changeFinal.qty === 2 && changeFinal.mode === "collect"
    && changeFinal.delivery === 0 && !("slot" in changeFinal) && !("wantBy" in changeFinal),
    "their yes sees the new units and way, and acknowledgement applies them while clearing the old delivery window and date: "
    + JSON.stringify({ view: changeView, order: changeFinal }));
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
      byProduct: { salt: { stockCost: 56, cards: { "CZ5-YS": [[2, 207], [3, 290]] }, floors: { "1": { floor: 80 }, "2": { floor: 150 }, "3": { floor: 215 } }, inputs: null, sizes: [1, 2, 3] } } };
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

    /* V3: changing units and way is an offer; the customer's yes is the order that reaches the row */
    const b = await place({ slot: s12, qty: 2, total: 200 });
    const pB = await call("/orders/" + b.id + "/preview", { total: 215, qty: 3, mode: "collect", delivery: 0 });
    const acB = await call("/orders/" + b.id + "/accept", { total: 215, qty: 3, mode: "collect", delivery: 0, hash: pB.j.hash });
    const ofB = await call("/orders/" + b.id + "/offer", { total: 215, qty: 3, mode: "collect", delivery: 0, hash: pB.j.offerHash, rid: rid() });
    const sB = await orderOf(b.id), vB = O.customerView(sB).price;
    await O.customerMove(senv, U1, b.id, "take", { rid: rid() });
    const tkB = await D.takeOffer(denv, b.id), gB = await orderOf(b.id);
    ok(pB.status === 200 && pB.j.needsYes && pB.j.terms.qty === 3 && pB.j.terms.mode === "collect"
      && acB.status === 409 && acB.j.needsYes === true && ofB.status === 200
      && vB.qty === 3 && vB.mode === "collect" && tkB.approved === true
      && gB.status === "acknowledged" && gB.qty === 3 && gB.mode === "collect" && gB.delivery === 0 && !gB.slot,
      "V3: a changed order waits for their yes, whose take acknowledges the offered units and way and clears its window: "
      + JSON.stringify({ preview: pB.status, accept: acB.status, offer: ofB.status, view: vB, order: gB }));

    /* another window: sent for their yes, and taken, the order carries it cut to the hours (restored beside V3's change of units and way) */
    const bw = await place({ slot: s12, qty: 2, total: 200 });
    const pBw = await pv(bw), ofBw = await call("/orders/" + bw.id + "/offer", { delivery: 10, hash: pBw.offerHash, slot: s8, rid: rid() });
    const sBw = await orderOf(bw.id), vBw = O.customerView(sBw).price;
    await O.customerMove(senv, U1, bw.id, "take", { rid: rid() });
    const tkBw = await D.takeOffer(denv, bw.id), gBw = await orderOf(bw.id);
    ok(ofBw.status === 200 && vBw.slot === s8 && vBw.slotSpan === "09:00-12:00" && tkBw.approved === true && gBw.status === "acknowledged" && gBw.slot === s8 && gBw.slotSpan === "09:00-12:00"
      && JSON.parse(preOf(bw.id).shown).terms.slot === s8,
      "another window goes for their yes with its span cut to the hours, and once taken the order carries it: " + JSON.stringify([ofBw.status, ofBw.j.error, vBw, gBw.slot, gBw.slotSpan, tkBw.error]));
    await O.customerMove(senv, U1, bw.id, "cancel", { rid: rid() });   /* the account stays under its five open orders */
    /* a yes filed before V3 (its record holds the offer's window and neither terms nor a way) still carries that window to the order */
    const bl = await place({ slot: s12, qty: 2, total: 210 });
    const pBl = await pv(bl), ofBl = await call("/orders/" + bl.id + "/offer", { delivery: 10, hash: pBl.offerHash, slot: s8, rid: rid() });
    const rowBl = db.prepare("SELECT id, shown FROM preapproval WHERE order_id=? ORDER BY at DESC").get(bl.id), shBl = JSON.parse(rowBl.shown);
    delete shBl.terms; delete shBl.offer.mode; db.prepare("UPDATE preapproval SET shown=? WHERE id=?").run(JSON.stringify(shBl), rowBl.id);
    await O.customerMove(senv, U1, bl.id, "take", { rid: rid() });
    const tkBl = await D.takeOffer(denv, bl.id), gBl = await orderOf(bl.id);
    ok(ofBl.status === 200 && tkBl.approved === true && gBl.status === "acknowledged" && gBl.slot === s8 && gBl.slotSpan === "09:00-12:00",
      "a yes filed with no terms record still carries the offer's window to the order: " + JSON.stringify([ofBl.status, tkBl.approved, tkBl.error, gBl.status, gBl.slot]));
    await O.customerMove(senv, U1, bl.id, "cancel", { rid: rid() });

    /* 18 Nov 2026: a changed size with no figure typed is priced at THEIR price for it, read off the pricing snapshot by the engine's cardAt (the one reader a new order's preview
       uses), a typed figure stands, an unchanged size is as it was, and a size with no price for them is refused */
    const rf = await place({ total: 103 });
    const theirs2 = D.cardAt(PRICING, C1, "salt", 2).card, theirs4 = D.cardAt(PRICING, C1, "salt", 4).card;
    const rfA = await call("/orders/" + rf.id + "/preview", { delivery: 10, qty: 2 }), rfB = await call("/orders/" + rf.id + "/preview", { delivery: 10, qty: 2, total: 251 }),
      rfC = await call("/orders/" + rf.id + "/preview", { delivery: 10 }), rfC2 = await call("/orders/" + rf.id + "/preview", { delivery: 10, qty: 1 }), rfD = await call("/orders/" + rf.id + "/preview", { delivery: 10, qty: 4 });
    ok(theirs2 === 207 && rfA.status === 200 && rfA.j.terms.total === theirs2 && rfA.j.quote === theirs2,
      "(a) a changed size with no total is priced at their price for it, the one the engine reader gives: " + JSON.stringify([theirs2, rfA.status, rfA.j.error, rfA.j.terms, rfA.j.quote]));
    ok(rfB.status === 200 && rfB.j.terms.total === 251 && rfB.j.quote === 251, "(b) a changed size with a typed total keeps the typed total: " + JSON.stringify([rfB.status, rfB.j.error, rfB.j.terms]));
    ok(rfC.status === 200 && rfC.j.terms.total === 103 && rfC.j.quote === 103 && rfC.j.terms.qty === 1 && rfC2.status === 200 && rfC2.j.terms.total === 103, "(c) an unchanged size (named or not) is priced as before, at what they placed it at: " + JSON.stringify([rfC.status, rfC.j.error, rfC.j.terms]));
    ok(theirs4 == null && rfD.status === 400 && /type your price for the goods first/.test(rfD.j.error || ""), "(d) a size with no price for them is refused: " + JSON.stringify([theirs4, rfD.status, rfD.j.error]));
    await O.customerMove(senv, U1, rf.id, "cancel", { rid: rid() });

    /* V3: the Desk reads the take against the terms the offer was made for: an order whose way or size is no longer that one is not drafted at the offer; its row waits under Approve */
    const voided = async (tamper, tot) => {
      const x = await place({ qty: 1, total: tot }), px = (await call("/orders/" + x.id + "/preview", { total: tot, qty: 1, mode: "collect", delivery: 0 })).j;
      const ox = await call("/orders/" + x.id + "/offer", { total: tot, qty: 1, mode: "collect", delivery: 0, hash: px.offerHash, rid: rid() });
      const row = db.prepare("SELECT id, shown FROM preapproval WHERE order_id=? ORDER BY at DESC").get(x.id); if (!row) throw new Error(JSON.stringify([px, ox])); const sh = JSON.parse(row.shown);
      tamper(sh.offer); db.prepare("UPDATE preapproval SET shown=? WHERE id=?").run(JSON.stringify(sh), row.id);
      await O.customerMove(senv, U1, x.id, "take", { rid: rid() });
      const tk = await D.takeOffer(denv, x.id), gx = await orderOf(x.id);
      await O.customerMove(senv, U1, x.id, "cancel", { rid: rid() });
      return { ofs: ox.status, tk, why: gx.sync && gx.sync.why || "" };
    };
    const vMode = await voided((o) => { o.wasMode = "collect"; }, 110), vQty = await voided((o) => { o.wasQty = 4; }, 120), vOk = await voided(() => {}, 125);
    ok(vMode.ofs === 200 && /no longer has the terms the offer was made for/.test(vMode.why) && vQty.ofs === 200 && /no longer has the terms the offer was made for/.test(vQty.why)
      && !/no longer has the terms/.test(vOk.why),
      "their yes on an order whose way or size is not the one the offer was made for is not drafted at the offer, and one that is, is: " + JSON.stringify([vMode.ofs, vMode.why, vQty.why, vOk.why]));

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
    const tripWay = await call("/orders/" + L0.id + "/preview", { delivery: 0, total: 100, mode: "collect" });
    ok(tripWay.status === 409 && /trip keeps one way/.test(tripWay.j.error || ""),
      "a line of a trip cannot change its way and split the shared delivery charge: " + JSON.stringify(tripWay));

    /* they withdraw what is still placed, so the account stays under its five open orders */
    for (const x of [L0, L1]) await O.customerMove(senv, U1, x.id, "cancel", { rid: rid() });

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
    for (const x of [a, b, e, f]) await O.customerMove(senv, U1, x.id, "cancel", { rid: rid() });
    await skv.put("u:" + U1, JSON.stringify({ prices: { digest: "pool-digest" } }));
    const group = await O.poolOpen(senv, { product: "salt", q: 1, target: 3 });
    const joined = await O.poolJoin(senv, U1, group.pool.id, { q: 1, total: 80, unit: 80, digest: "pool-digest", rid: rid() });
    const groupChange = await call("/orders/" + joined.order.id + "/preview", { delivery: 0, total: 80, qty: 2, mode: "collect" });
    ok(joined.order && groupChange.status === 409 && /group order keeps its size and way/.test(groupChange.j.error || ""),
      "a group order cannot change its joined size or collection way: " + JSON.stringify(groupChange));
  } else ok(true, "node:sqlite is unavailable here, so their yes was not driven against the real schema");

  /* 4. THEIR PAGE: what changed, Yes or No thanks */
  const { landingPage } = await import("../stmt/page.js"), C = await import("../tools/stmt-crypto.mjs"), { JSDOM } = await import("jsdom");
  const W = await import("../stmt/words.js");
  const U = "yeab-cdef", PASS = "fixture-pass-yes-4", ck = await C.contentKey("test-secret", U);
  const soon = new Date(Date.now() + 20 * H).toISOString(), gone = new Date(Date.now() - H).toISOString();
  const order = (id, price) => ({ id, at: "2026-10-09T01:00:00Z", product: "salt", qty: 1, unit: 100, total: 100, delivery: 0, mode: "deliver", paid: 0, moved: 0, status: "placed",
    history: [{ at: "2026-10-09T01:00:00Z", status: "placed", by: "customer" }], msgs: [], price });
  const P1 = "20261009010000-ofye", P2 = "20261009010000-ofgo", P3 = "20261009010000-ofun", P4 = "20261009010000-ofwy";
  const ORDERS = [Object.assign(order(P1, { state: "offered", from: "accept", total: 120, delivery: 10, slot: "2026-10-11T08", slotSpan: "09:00-12:00", until: soon }),
      { history: [{ at: "2026-10-09T01:00:00Z", status: "placed", by: "customer" }, held.history[held.history.length - 1]] }),
    order(P2, { state: "offered", from: "accept", total: 120, delivery: 10, slot: null, slotSpan: null, until: gone }),
    /* V3: a Negotiate offer on a placed order that changes the units and the way, and one that adds a delivery and its window */
    order(P3, { state: "offered", total: 150, qty: 3, mode: "collect", delivery: 0, until: soon }),
    Object.assign(order(P4, { state: "offered", total: 150, qty: 1, mode: "deliver", delivery: 10, slot: "2026-10-11T08", slotSpan: "09:00-12:00", until: soon }), { mode: "collect" })];
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
    const back2 = d.querySelector("#pOrder .oback"); if (back2) back2.click();
    const s3 = await openRow(P3), t3 = s3 ? s3.textContent : "(their order screen did not draw)";
    ok(t3.includes(W.EN["np.cWayCollect"]) && /Units: 3/.test(t3) && t3.includes(W.EN["np.collect"]) && !/Delivery RM/.test(t3),
      "an offer that changes the units and the way says both, and a collection carries no delivery charge: " + t3.slice(0, 500));
    const back3 = d.querySelector("#pOrder .oback"); if (back3) back3.click();
    const s4 = await openRow(P4), t4 = s4 ? s4.textContent : "(their order screen did not draw)";
    ok(t4.includes(W.EN["np.cWayDeliver"]) && /Delivery RM ?10/.test(t4) && /Delivery between 09:00 and 12:00 on /.test(t4) && !/Units:/.test(t4),
      "an offer that makes it a delivery says the way, the charge and the window, and no units when they are as placed: " + t4.slice(0, 500));
  } finally { await new Promise((r) => setTimeout(r, 60)); dom.window.close(); }

  /* 5. SALT ADMIN: the road, Send for their yes and Withdraw (#104 parity) */
  const s12 = Wn.slotNext(12, null, Date.now()).slot;
  const posts = [];
  const orderOf2 = (id, patch = {}) => ({ id, u: "mbab-cdef", product: "salt", qty: 1, total: 100, status: "placed", mode: "deliver", history: [], ...patch });
  const A = "20261010070001-ayes", T = "20261010070002-ayes", K = "20261010070003-ayes",
    G = "20261010070004-ayes", M = "20261010070005-ayes", RF = "20261010070006-ayes";
  const reviewBody = { ok: true, drafts: [], orders: [orderOf2(A), orderOf2(T, { slot: s12, slotSpan: "12:00-16:00" }),
    orderOf2(K, { price: { state: "offered", from: "accept", offer: { id: "k1", kind: "accept", total: 120, delivery: 10, until: new Date(Date.now() + 20 * H).toISOString() } } }),
    orderOf2(G, { pool: "p20261010070000-aaaa", mode: "collect" }), orderOf2(M), orderOf2(RF)] };
  const browser = new JSDOM(landingPage("", "fixture", { master: "local-master", accounts: [] }), {
    url: "https://counter.fixture.test/all", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(window) {
      Object.defineProperty(window, "crypto", { value: { getRandomValues: (a) => webcrypto.getRandomValues(a), randomUUID: () => webcrypto.randomUUID(), subtle: webcrypto.subtle } });
      window.TextEncoder = TextEncoder; window.TextDecoder = TextDecoder; window.scrollTo = () => {};
      window.fetch = async (path, init) => {
        if (init && init.method === "POST" && String(path).startsWith("/all/maker/orders/")) {
          const b = JSON.parse(init.body);
          if (String(path).endsWith("/preview")) { posts.push({ kind: "preview", path: String(path), body: b });
            const given = b.total === undefined ? 240 : b.total;   /* the Desk answers their price for a changed size, whose body carries no total */
            return Response.json({ ok: true, quote: given, terms: { total: given }, delivery: b.delivery, needsYes: b.qty !== 1 || b.mode !== "deliver", hash: "a".repeat(64), offerHash: "b".repeat(64), row: { qty: 1, total: given }, flags: [],
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
    /* 22 Oct 2026 (his canvas): the charge and the time are each one select in the Agree grid; a choice is its value and a change */
    const feeSel = (id) => acard(id) && acard(id).querySelector('select[data-act="order.fee"]'), whenSel = (id) => acard(id) && acard(id).querySelector("select[data-when]");
    const choose = (sel, v) => { sel.value = v; sel.dispatchEvent(new Ev("change", { bubbles: true })); };
    doc.querySelector('[data-act="nav.orders"]').click();
    await wait(() => doc.querySelector('[data-act="order.open"]'));
    ok(/Waiting for their yes to RM ?120\.00 \+ RM ?10\.00, until /.test(acard(K).textContent) && !acard(K).querySelector("[data-accept]") && !posts.some((p) => p.kind === "preview" && p.path.includes(K)) && !!button(K, "Take back the offer"),
      "Salt Admin says an open offer and offers Withdraw, never a second Accept: " + acard(K).textContent.slice(0, 200));
    button(K, "Take back the offer").click();
    ok(await wait(() => posts.some((p) => p.kind === "withdraw")) && /^[A-Za-z0-9_-]{16,64}$/.test(posts.find((p) => p.kind === "withdraw").body.rid), "Withdraw posts under its tap's own id");
    await new Promise((r) => setTimeout(r, 250));
    choose(feeSel(A), "10");
    /* 2 Nov 2026 (his Orders canvas, page 2): Goods is a settings row of Agree, no .maker-fields label above the field; found by its act */
    const tot = acard(A).querySelector('input[data-act="order.total"]'); tot.value = "125"; tot.dispatchEvent(new Ev("input", { bubbles: true })); tot.dispatchEvent(new Ev("change", { bubbles: true }));
    await wait(() => button(A, "Ask them"));
    ok(!!button(A, "Ask them, RM 135"), "a raise previewed is sent for their yes, never accepted, its pill saying the goods and the delivery together");
    button(A, "Ask them").click();
    await wait(() => posts.some((p) => p.kind === "offer" && p.path.includes(A)));
    const oA = posts.find((p) => p.kind === "offer" && p.path.includes(A));
    ok(oA && oA.body.total === 125 && oA.body.delivery === 10 && oA.body.hash === "b".repeat(64) && !("slot" in oA.body), "its offer carries the goods, his charge and the offer's digest: " + JSON.stringify(oA && oA.body));
    await new Promise((r) => setTimeout(r, 250));
    choose(feeSel(T), "0");
    const other = [...whenSel(T).options].find((o) => o.value && o.value !== s12);
    choose(whenSel(T), other.value);
    await wait(() => button(T, "Ask them"));
    button(T, "Ask them").click();
    await wait(() => posts.some((p) => p.kind === "offer" && p.path.includes(T)));
    const oT = posts.find((p) => p.kind === "offer" && p.path.includes(T));
    ok(oT && oT.body.slot === other.value && oT.body.total === 100, "another window is sent for their yes with the window: " + JSON.stringify(oT && oT.body));

    const pooled = cardOf(doc, G), pooledQty = pooled && pooled.querySelector('input[data-act="order.qty"]'),
      pooledWay = pooled && pooled.querySelector('select[data-act="order.mode"]');
    ok(!!pooledQty && pooledQty.disabled && !!pooledWay && pooledWay.disabled,
      "a group order's size and way cannot be changed in the Agree sheet");

    cardOf(doc, M);
    const liveChanged = () => [...doc.querySelectorAll("[data-maker-card]")].find((c) => c.getAttribute("data-maker-card") === M) || null;
    const changedPreview = (total, delivery, qty, mode) => posts.some((p) => p.kind === "preview" && p.path.includes(M)
      && p.body.total === total && p.body.delivery === delivery && p.body.qty === qty && p.body.mode === mode);
    const changedSend = () => liveChanged() && liveChanged().querySelector("button[data-accept]");
    const changedStatus = () => liveChanged() && [...liveChanged().querySelectorAll('[role="status"]')].some((n) => n.textContent.startsWith("Figures read:"));
    const readChanged = async (total, delivery, qty, mode) => wait(() => changedPreview(total, delivery, qty, mode) && changedStatus() && changedSend());
    choose(liveChanged().querySelector('select[data-act="order.fee"]'), "10");
    await readChanged(100, 10, 1, "deliver");
    const changedQty = liveChanged().querySelector('input[data-act="order.qty"]');
    changedQty.value = "2"; changedQty.dispatchEvent(new Ev("input", { bubbles: true })); changedQty.dispatchEvent(new Ev("change", { bubbles: true }));
    await readChanged(undefined, 10, 2, "deliver");
    ok(liveChanged().querySelector('input[data-act="order.total"]').value === "240" && !posts.some((p) => p.kind === "preview" && p.path.includes(M) && p.body.qty === 2 && p.body.total === 100),
      "changing the units clears the old goods figure, asks for no total and fills Goods with their price from the preview: " + JSON.stringify(posts.filter((p) => p.kind === "preview" && p.path.includes(M)).map((p) => p.body)));
    const changedTotal = liveChanged().querySelector('input[data-act="order.total"]');
    changedTotal.value = "150"; changedTotal.dispatchEvent(new Ev("input", { bubbles: true })); changedTotal.dispatchEvent(new Ev("change", { bubbles: true }));
    await readChanged(150, 10, 2, "deliver");
    const changedWay = liveChanged().querySelector('select[data-act="order.mode"]');
    choose(changedWay, "collect");
    await readChanged(150, 0, 2, "collect");
    ok(!!changedSend() && changedPreview(150, 0, 2, "collect") && changedStatus(),
      "the Agree sheet previews changed units and a collection with no delivery charge: " +
      JSON.stringify({ live: liveChanged() && liveChanged().isConnected,
        previews: posts.filter((p) => p.kind === "preview" && p.path.includes(M)).map((p) => p.body), buttons: liveChanged() && [...liveChanged().querySelectorAll("button")].map((b) => b.textContent) }));
    if (changedSend()) changedSend().click();
    await wait(() => posts.some((p) => p.kind === "offer" && p.path.includes(M)));
    const oM = posts.find((p) => p.kind === "offer" && p.path.includes(M));
    ok(oM && oM.body.qty === 2 && oM.body.mode === "collect" && oM.body.delivery === 0,
      "the offer sent for their yes carries the changed units and way: " + JSON.stringify(oM && oM.body));

    /* (e) the refill is what Save carries: the units change, Goods fills from the preview, and the offer holds that figure, never the order's old one */
    cardOf(doc, RF);
    const liveRF = () => [...doc.querySelectorAll("[data-maker-card]")].find((c) => c.getAttribute("data-maker-card") === RF) || null;
    const rfRead = (qty) => posts.some((p) => p.kind === "preview" && p.path.includes(RF) && p.body.qty === qty && p.body.total === undefined);
    choose(liveRF().querySelector('select[data-act="order.fee"]'), "10");
    await wait(() => posts.some((p) => p.kind === "preview" && p.path.includes(RF)) && liveRF().querySelector("button[data-accept]"));
    const rfQty = liveRF().querySelector('input[data-act="order.qty"]');
    rfQty.value = "3"; rfQty.dispatchEvent(new Ev("input", { bubbles: true })); rfQty.dispatchEvent(new Ev("change", { bubbles: true }));
    const midGoods = liveRF().querySelector('input[data-act="order.total"]').value, midSend = !!liveRF().querySelector("button[data-accept]");
    await wait(() => rfRead(3) && liveRF().querySelector("button[data-accept]") && liveRF().querySelector('input[data-act="order.total"]').value === "240");
    liveRF().querySelector("button[data-accept]").click();
    await wait(() => posts.some((p) => p.kind === "offer" && p.path.includes(RF)));
    const oRF = posts.find((p) => p.kind === "offer" && p.path.includes(RF));
    ok(midGoods === "" && midSend === false && oRF && oRF.body.qty === 3 && oRF.body.total === 240,
      "until their price for the new size has come back the goods are empty and nothing can be sent; then Save carries that figure, not the old one: " + JSON.stringify([midGoods, midSend, oRF && oRF.body]));
  } finally { browser.window.close(); }

  /* 6. WHAT STILL WAITS ON HIM, on the Desk's To do (18 Oct 2026: the Desk draws no order card, but it counts the acts): an Accept sent for
     their yes holds the order while it is open, and once it lapses the order is a new one again at its terms */
  const { openMaster } = await import("../tools/payload.mjs");
  const { w: mw } = await openMaster(process.env.SALT_MASTER || undefined);
  const acts = (o) => JSON.parse(String(mw.eval("JSON.stringify((function(){ORD_OPEN=" + JSON.stringify([o]) + ";AP_DRAFTS=[];return ordActs().map(function(a){return a.kind;});})())")));
  const pending = { id: "20261010050000-dyes", u: "dyab-cdef", code: "CZ6-DY", status: "placed", mode: "deliver", product: "salt", qty: 1, total: 100, at: "2026-10-10T05:00:00Z", history: [], msgs: [] };
  const offer = (until) => Object.assign({}, pending, { price: { state: "offered", from: "accept", offer: { id: "x1", kind: "accept", total: 120, delivery: 10, until } } });
  ok(JSON.stringify(acts(pending)) === '["new"]' && JSON.stringify(acts(offer(new Date(Date.now() + 20 * H).toISOString()))) === "[]" && JSON.stringify(acts(offer(new Date(Date.now() - H).toISOString()))) === '["new"]',
    "an order is a new act for him, held while his Accept waits for their yes, and new again once that offer has lapsed: "
    + JSON.stringify([acts(pending), acts(offer(new Date(Date.now() + 20 * H).toISOString())), acts(offer(new Date(Date.now() - H).toISOString()))]));
}
