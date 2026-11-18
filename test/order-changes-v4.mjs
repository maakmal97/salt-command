/* test/order-changes-v4.mjs: THE ORDER-CHANGES PLAN, VERSION 4 (18 Nov 2026, docs/plan-order-changes.html, his answers 5 and 6 of 17 Nov 2026).
 * What is paid or handed over is taken back from Salt Admin's one Change sheet, with his reason, as one Correction of the row for his Approve, the
 * order lowered at his tap and told as changed; a new window after Accept is told when it is earlier and asked of them, as an offer, when it is
 * later. Fable reviewed the design (an `expect` on the Correction, the refund, the raise held while it is on its way, a window offer of its own).
 *   V1  the Desk drafts one Correction of the row (cash, paidOn cleared, deliveredQty), the figures it was measured on, his reason, the site told
 *   V2  the Desk refuses: no reason, a raise, row and order apart, money on its way, a refund left unowed, their credit
 *   V3  the drafter, the fold's plan and the booking law each refuse a take-back on a row that moved since it was measured
 *   V4  the order book lowers the order and what the ledger was told, keeps the terms' was, says what it showed, opens a done order owing, wakes changed;
 *       a retry and a lower overtaken by a payment are none
 *   V5  a take-back he rejects heals by the raise, and the Bill's line goes with it
 *   V6  a window: earlier told, later an offer (and every window where they asked for none), their Yes sets it, No keeps theirs, a change to collect voids it,
 *       a lapse refuses it, his withdraw, and their answer reaches the window offer before an earlier price offer's
 *   V7  the Desk's maker gate takes a take-back and a window, and refuses the shapes it does not make
 *   V8  a change of way alone with nothing handed over goes to the site alone, no row (Fable's note at v1525)
 *   V9  the sheet takes back Paid so far with a reason, alone; V10 the sheet's window; V11 a delivery at Ready made a collection names its point
 *   V12 their page: the Bill says what it showed, and the later window asks Yes or No, naming its offer
 *   V13 his answer to Ask 1 (18 Nov 2026): a Ready order with nothing handed over goes back to Agreed, told as changed, its point dropped; the sheet's Stage
 * Invented codes only (rule 2). Every assertion is red under its own mutation (test/order-changes-v4.mutations.json). */
import { lowerTap, restateTap } from "../engine/stages.mjs";
import { expectFault } from "../engine/expect.mjs";
import { applyAmend } from "../engine/apply.mjs";
import { plan } from "../tools/fold.mjs";
import { draftRow } from "../src/drafter.js";
import { makerOrderFault } from "../src/maker.js";
import { decideDesk, decideCustomer, applyEvent, wakes } from "../stmt/orders.js";
import POSITION_ENGINE from "../engine/position.mjs";
import { richOwnerPage, byAct, changeSheet, POINTS_ANSWER } from "./maker-act.mjs";
import { open, ago, ord, txt } from "./counter-b-kit.mjs";

const J = JSON.stringify;
const AT = new Date("2026-11-18T05:00:00.000Z"), ATS = AT.toISOString();
const row = (over) => Object.assign({ rid: "zv1", customer: "ZZ1-QQQ", date: "2026-11-18", qty: 2, total: 200, delivery: 0, cash: 200, deliveredQty: 2,
  deliveredOn: "2026-11-18", paidOn: "2026-11-18", product: "salt", cost: 100 }, over || {});
const order = (over, r) => Object.assign({ id: "20261118010000-abcd12", u: "abcd-efgh", code: "ZZ1-QQQ", status: "done", mode: "collect", product: "salt", qty: 2, total: 200,
  delivery: 0, paid: 200, moved: 2, ledgerKey: POSITION_ENGINE.ovKey(r || row()), queued: { paid: 200, moved: 2 }, history: [{ at: ATS, status: "ready", by: "desk" }], payments: [] }, over || {});
const ctx = (over) => Object.assign({ book: { version: 1, sales: [row()], customerRefunds: [] }, room: null, earlier: [], live: null }, over || {});
const copy = (x) => JSON.parse(JSON.stringify(x));

export async function run({ ok, pageWork }) {
  /* V1 */
  const a = lowerTap(order(), AT, { paid: 150, moved: 1, why: "one unit came back" }, ctx());
  const p = a.entry && a.entry.payload;
  ok(!a.error && a.entry.status === "Amendment" && p.kind === "Correction" && J(p.fields) === J({ cash: 150, paidOn: null, deliveredQty: 1 })
    && J(p.expect) === J({ cash: 200, deliveredQty: 2 }) && /His reason: one unit came back[.]$/.test(p.note) && J(a.site) === J({ lower: { tell: true, paid: 150, wasPaid: 200, moved: 1, wasMoved: 2 } }),
  "V1: a take-back drafts one Correction of the row, the figures it was measured on and his reason, and tells the site: " + J(a.error || [p.fields, p.expect, a.site]));
  const a2 = lowerTap(order(), AT, { moved: 0, why: "none were handed over" }, ctx());
  ok(!a2.error && J(a2.entry.payload.fields) === J({ deliveredQty: 0, deliveredOn: null }) && J(a2.site.lower) === J({ tell: true, moved: 0, wasMoved: 2 }),
    "V1b: taking back every unit clears the row's day handed over and leaves its money alone: " + J(a2.error || a2.entry.payload.fields));

  /* V2 */
  const refused = [
    lowerTap(order(), AT, { paid: 150 }, ctx()).error,
    lowerTap(order(), AT, { paid: 210, why: "abc" }, ctx()).error,
    lowerTap(order({ paid: 190 }), AT, { paid: 150, why: "abc" }, ctx()).error,
    lowerTap(order(), AT, { paid: 150, why: "abc" }, ctx({ room: () => ({ on: 20, owes: 0, left: 0 }) })).error,
    lowerTap(order({ total: 180 }, row({ total: 180 })), AT, { paid: 190, why: "abc" }, ctx({ book: { version: 1, sales: [row({ total: 180 })], customerRefunds: [{ rid: "zv1", amount: 20 }] } })).error,
  ];
  ok(/say why/.test(refused[0] || "") && /only takes back/.test(refused[1] || "") && /do not agree yet/.test(refused[2] || "") && /on its way/.test(refused[3] || "")
    && /already their refund on this order: mark the refund paid instead/.test(refused[4] || ""),
  "V2: no reason, a raise, row and order apart, money on its way and a refund left unowed are each refused: " + J(refused));
  /* their credit is paid on the row as cash and kept apart on the order: what comes down is their money alone */
  const cr = lowerTap(order({ paid: 100, credit: 50 }), AT, { paid: 0, why: "abc" }, ctx({ book: { version: 1, sales: [row({ cash: 150, credit: 50 })], customerRefunds: [] } }));
  const off = lowerTap(order({ paid: 30, credit: 50 }), AT, { paid: 0, why: "abc" }, ctx({ book: { version: 1, sales: [row({ cash: 50, credit: 50, settledRM: 30 })], customerRefunds: [] } }));
  ok(!cr.error && cr.entry.payload.fields.cash === 50 && cr.entry.payload.expect.cash === 150 && /their credit/.test(off.error || ""),
    "V2b: taking back all they paid leaves their credit on the row, and one an offset paid beside it is never taken under it: " + J([cr.error || cr.entry.payload.fields, off.error]));

  /* V3 */
  const fields = { cash: 150, paidOn: null, deliveredQty: 1 }, expect = { cash: 200, deliveredQty: 2 };
  const entry = (ex) => ({ at: ATS, type: "SELL", party: "ZZ1-QQQ", status: "Amendment", payload: { mode: "amend", kind: "Correction", direction: "SELL", party: "ZZ1-QQQ",
    rid: "zv1", date: "2026-11-18", qty: 0, total: 0, cash: 0, kg: 0, fields, expect: ex } });
  const dbook = { sales: [row()], purchases: [], state: { roster: ["ZZ1-QQQ"], PRODUCTS: { salt: {} } } };
  const dOk = draftRow(entry(expect), dbook), dStale = draftRow(entry({ cash: 210 }), dbook);
  const item = (id, payload) => ({ id, collection: "sales", amends: "zv1", amendKind: payload.kind, row: row(), entry: { payload: { mode: "amend", direction: "SELL", rid: "zv1", date: "2026-11-18", ...payload } } });
  const pOk = plan({ sales: [row()], purchases: [] }, { approved: [item("a", { kind: "Correction", fields, expect })] });
  const pMoved = plan({ sales: [row()], purchases: [] }, { approved: [item("b0", { kind: "Fulfilment", cash: 0, kg: 0.5 }), item("b", { kind: "Correction", fields, expect })] });
  let law = "";
  try { applyAmend(row({ cash: 210 }), { date: "2026-11-18", kind: "Correction", cash: 0, kg: 0, fields, expect }, "SELL", "x"); } catch (e) { law = e.message; }
  const fine = row(); applyAmend(fine, { date: "2026-11-18", kind: "Correction", cash: 0, kg: 0, fields, expect }, "SELL", "x");
  ok(!dOk.skip && /take-back was refused/.test(dStale.skip || "") && pOk.refused.length === 0 && pMoved.refused.length === 1 && pMoved.refused[0].id === "b"
    && /take-back on zv1 was refused/.test(pMoved.refused[0].why) && /take-back was refused/.test(law) && fine.cash === 150 && fine.deliveredQty === 1 && !fine.paidOn,
  "V3: the drafter, the fold's plan and the booking law each refuse a take-back on a row that moved, and book one on the row it was measured on: " + J([dStale.skip, pMoved.refused, law]));
  ok(expectFault(row(), { cash: 200 }) === "" && /shape/.test(expectFault(row(), { qty: 2 })) && /shape/.test(expectFault(row(), {})),
    "V3b: the measure names cash and units handed over alone, as figures: " + J([expectFault(row(), { qty: 2 }), expectFault(row(), {})]));

  /* V4 */
  const o4 = order(), d4 = decideDesk(copy(o4), a.site, ATS), f4 = applyEvent(copy(o4), d4.ev), n4 = f4.order;
  ok(d4.ev && d4.ev.kind === "lower" && n4.paid === 150 && n4.moved === 1 && J(n4.queued) === J({ paid: 150, moved: 1 }) && n4.status === "ready"
    && n4.changed && n4.changed.lower && n4.changed.wasPaid === 200 && n4.changed.wasMoved === 2 && J(n4.changed.was) === J({ qty: 2, total: 200, delivery: 0, mode: "collect" })
    && J(wakes(d4.ev, n4, f4.done)) === J({ k: "changed", o: o4.id, v: "owed" }),
  "V4: the order book lowers the order and what the ledger was told, opens it again at Ready owing, says what it showed and wakes changed: " + J([d4, n4.queued, n4.changed, n4.status]));
  const kept = { at: "2026-11-17T01:00:00.000Z", kind: "discount", was: { qty: 2, total: 220, delivery: 0, mode: "collect" } };
  const n4b = applyEvent(order({ changed: kept }), decideDesk(order({ changed: kept }), a.site, ATS).ev).order;
  const again = decideDesk(n4, a.site, ATS), overtaken = decideDesk(order({ paid: 120, queued: { paid: 120, moved: 2 } }), { lower: { paid: 150, moved: 1, tell: true } }, ATS);
  const claim = decideDesk(order({ status: "ready", payments: [{ claim: "waiting", amount: 10, at: ATS }] }), a.site, ATS);
  const moved4 = decideDesk(order({ paid: 220, queued: { paid: 220, moved: 2 } }), a.site, ATS);
  const againPlain = decideDesk(n4, { lower: { paid: 150, moved: 1, tell: true } }, ATS);   /* the practice road sends no measure */
  ok(J(n4b.changed.was) === J(kept.was) && again.none === true && overtaken.none === true && claim.status === 409 && moved4.status === 409 && /moved since/.test(moved4.error || "") && againPlain.none === true,
    "V4b: the terms' was is kept for backTo, a retry and an older lower overtaken by a payment are none, a claim waiting refuses it, and one measured before a payment is refused: " + J([n4b.changed.was, again, overtaken, claim, moved4]));

  /* V5 */
  const healed = applyEvent(copy(n4), decideDesk(copy(n4), { ledger: { paid: 200, moved: 2 } }, ATS).ev).order;
  const n5 = applyEvent(order({ changed: kept }), decideDesk(order({ changed: kept }), a.site, ATS).ev).order;
  const healed5 = applyEvent(copy(n5), decideDesk(copy(n5), { ledger: { paid: 200, moved: 2 } }, ATS).ev).order;
  const n6 = applyEvent(copy(n5), decideDesk(copy(n5), { lower: { paid: 100, wasPaid: 150, tell: true } }, ATS).ev).order;
  const healed6 = applyEvent(copy(n6), decideDesk(copy(n6), { ledger: { paid: 150 } }, ATS).ev).order;
  ok(healed.paid === 200 && healed.moved === 2 && !healed.changed && J(healed5.changed) === J(kept) && J(healed6.changed) === J(kept),
    "V5: a take-back he rejected heals by the raise, the Bill's line about it going and the change before it coming back: " + J([healed.paid, healed.changed, healed5.changed]));

  /* V6 */
  const dv = (over) => order(Object.assign({ status: "acknowledged", mode: "deliver", moved: 0, paid: 0, queued: {}, delivery: 5, slot: "2026-11-20T12", slotSpan: "12:00-16:00" }, over || {}));
  const early = decideDesk(dv(), { slot: "2026-11-20T08", slotSpan: "08:00-12:00" }, ATS), late = decideDesk(dv(), { slot: "2026-11-21T08", slotSpan: "08:00-12:00" }, ATS);
  const asap = decideDesk(dv({ slot: undefined, slotSpan: undefined }), { slot: "2026-11-19T08", slotSpan: "08:00-12:00" }, ATS);
  const byDay = decideDesk(dv({ slot: undefined, slotSpan: undefined, wantBy: "2026-11-21" }), { slot: "2026-11-21T16", slotSpan: "16:00-20:00" }, ATS);
  const coll = decideDesk(dv({ mode: "collect", delivery: 0 }), { slot: "2026-11-20T08", slotSpan: "08:00-12:00" }, ATS);
  const eo = early.ev ? applyEvent(dv(), early.ev).order : {};
  ok(early.ev && early.ev.kind === "window" && J(wakes(early.ev, eo)) === J({ k: "changed", o: eo.id, v: "owed" }) && eo.slot === "2026-11-20T08" && eo.changed.wasSlot === "2026-11-20T12"
    && eo.changed.wasSpan === "12:00-16:00" && late.ev && late.ev.kind === "winoffer" && asap.ev && asap.ev.kind === "winoffer" && byDay.ev && byDay.ev.kind === "window" && coll.status === 409,
  "V6: an earlier window is told as changed, a later one or any where they asked for none is an offer, one on the day they wanted is told, and a collection has none: " + J([early.ev, late.ev && late.ev.kind, asap.ev && asap.ev.kind, byDay.ev && byDay.ev.kind, coll]));
  const wo = applyEvent(dv(), late.ev).order, wid = wo.winOffer.id;
  const take = decideCustomer(copy(wo), "take", { offer: wid }, [], "2026-11-18T06:00:00.000Z"), taken = take.ev ? applyEvent(copy(wo), take.ev).order : { winOffer: {} };
  const pass = decideCustomer(copy(wo), "pass", { offer: wid }, [], "2026-11-18T06:00:00.000Z"), passed = pass.ev ? applyEvent(copy(wo), pass.ev).order : { winOffer: {} };
  ok(J(wakes(late.ev, wo)) === J({ k: "confirm", o: wo.id }) && wo.slot === "2026-11-20T12" && taken.slot === "2026-11-21T08" && taken.slotSpan === "08:00-12:00" && taken.winOffer.state === "taken"
    && passed.slot === "2026-11-20T12" && passed.winOffer.state === "passed",
  "V6b: the later window asks their yes and theirs stands; Yes sets it, No keeps theirs: " + J([wo.slot, taken.slot, passed.slot]));
  const collected = applyEvent(copy(wo), decideDesk(copy(wo), { restate: { qty: 2, total: 200, delivery: 0, mode: "collect", tell: true } }, ATS).ev).order;
  const lapsed = decideCustomer(copy(wo), "take", { offer: wid }, [], "2026-11-21T06:00:00.000Z");
  const wd = decideDesk(copy(wo), { winWithdraw: true }, ATS), wdo = wd.ev ? applyEvent(copy(wo), wd.ev).order : { winOffer: {} };
  const sameAgain = decideDesk(copy(wo), { slot: "2026-11-20T12", slotSpan: "12:00-16:00" }, ATS);
  const soon = decideDesk(dv(), { slot: "2026-11-21T08", slotSpan: "08:00-12:00" }, "2026-11-20T20:00:00.000Z");
  const begun = decideDesk(dv(), { slot: "2026-11-21T08", slotSpan: "08:00-12:00" }, "2026-11-21T01:00:00.000Z");
  const byOffer = Object.assign(copy(wo), { price: { from: "accept", state: "taken", offer: { id: "fex1" } } });
  const first = decideCustomer(byOffer, "take", { offer: wid }, [], "2026-11-18T06:00:00.000Z");
  ok(collected.winOffer.state === "void" && lapsed.status === 409 && wdo.winOffer.state === "withdrawn" && wdo.slot === "2026-11-20T12" && first.ev && first.ev.kind === "winanswer"
    && sameAgain.ev && sameAgain.ev.kind === "winanswer" && sameAgain.ev.state === "withdrawn" && soon.ev && soon.ev.offer.until === "2026-11-21T00:00:00.000Z" && begun.status === 400,
    "V6c: a change to collect voids the ask, a lapse refuses their Yes, his withdraw keeps theirs, their answer reaches the window before an older price offer, theirs again withdraws it, and an ask lapses at its window's start: " + J([collected.winOffer.state, lapsed, wdo.winOffer.state, first, sameAgain.ev, soon.ev && soon.ev.offer.until, begun]));

  /* V7 */
  const rid = "rid-order-changes-v4-0001";
  ok(makerOrderFault("lower", { rid, paid: 50, why: "abc" }) === "" && makerOrderFault("lower", { rid, why: "abc" }) !== "" && makerOrderFault("lower", { rid, paid: 50 }) !== ""
    && makerOrderFault("lower", { rid, paid: 50, why: "abc", qty: 1 }) !== "" && makerOrderFault("move", { rid, slot: "2026-11-20T08" }) === "" && makerOrderFault("move", { rid, winWithdraw: true }) === ""
    && makerOrderFault("move", { rid, slot: "2026-11-20T09" }) !== "" && makerOrderFault("move", { rid, slot: "2026-11-20T08", message: "hi" }) !== ""
    && makerOrderFault("move", { rid, back: true }) === "" && makerOrderFault("move", { rid, back: false }) !== "",
  "V7: the Desk's maker gate takes a take-back with its reason and a window alone, and refuses the shapes it does not make");

  /* V8 */
  const r0 = row({ deliveredQty: 0, deliveredOn: undefined, cash: 0, paidOn: undefined });
  const way = restateTap(order({ status: "acknowledged", moved: 0, paid: 0, queued: {} }, r0), AT, { mode: "deliver" }, ctx({ book: { version: 1, sales: [r0] } }));
  const wayOut = restateTap(order({ status: "ready" }), AT, { mode: "deliver" }, ctx());
  ok(way.siteOnly === true && !way.entry && J(way.site.restate) === J({ qty: 2, total: 200, delivery: 0, mode: "deliver", tell: true })
    && !wayOut.siteOnly && wayOut.entry && wayOut.entry.payload.fields.handover === "delivered",
  "V8: a change of way alone with nothing handed over goes to the site alone, and with goods out it is still the row's Correction: " + J([way.site, wayOut.entry && wayOut.entry.payload.fields]));

  /* V13 */
  const rd = order({ status: "ready", mode: "collect", moved: 0, paid: 0, queued: {}, point: "A2", pointAt: { lat: 3.1, lng: 101.2 } });
  const bk = decideDesk(copy(rd), { back: true }, ATS), bo = bk.ev ? applyEvent(copy(rd), bk.ev).order : {};
  const bkOut = decideDesk(order({ status: "ready" }), { back: true }, ATS), bkAck = decideDesk(order({ status: "acknowledged", moved: 0 }), { back: true }, ATS);
  ok(bk.ev && bo.status === "acknowledged" && !bo.point && !bo.pointAt && bo.changed && bo.changed.wasReady === true && J(wakes(bk.ev, bo)) === J({ k: "changed", o: bo.id, v: "owed" })
    && bkOut.status === 409 && bkAck.status === 409,
  "V13: a Ready order with nothing out goes back to Agreed, its point dropped and told as changed; with goods out, or not Ready, it is refused: " + J([bo.status, bo.changed, bkOut, bkAck]));

  /* V9 to V11: Salt Admin's sheet */
  const base = { u: "abcd-efgh", product: "salt", delivery: 0, paid: 0, msgs: [], payments: [], history: [] };
  const review = (j) => {
    j.orders.push({ ...base, id: "ord-d1", status: "done", mode: "collect", qty: 1, total: 100, moved: 1, paid: 100 });
    j.orders.push({ ...base, id: "ord-w1", status: "acknowledged", mode: "deliver", qty: 1, total: 100, delivery: 5, slot: "2000-01-01T08", slotSpan: "08:00-12:00" });
    j.orders.push({ ...base, id: "ord-w2", status: "acknowledged", mode: "deliver", qty: 1, total: 100, delivery: 5, slot: "2099-01-01T08", slotSpan: "08:00-12:00" });
    j.orders.push({ ...base, id: "ord-r9", status: "ready", mode: "deliver", qty: 2, total: 200, delivery: 5 });
    j.orders.push({ ...base, id: "ord-rb", status: "ready", mode: "collect", qty: 1, total: 100, point: "A2" });
    return j;
  };
  const P = await richOwnerPage({ pageWork, review, extra: POINTS_ANSWER });
  try {
    const d = P.d, w = P.w;
    const part = async (name) => { byAct(d, "part.orders." + name).click(); await P.work.quiet(); };
    const tapRow = async (id) => { const r = byAct(d, "order.open", id); if (r) r.click(); await P.work.quiet(); return !!r; };
    const cardOf = (id) => [...d.querySelectorAll("#makerReview [data-maker-card]")].find((c) => c.getAttribute("data-maker-card") === id) || null;
    const set = (sh, act, v) => { const e = byAct(sh, act); e.value = String(v); e.dispatchEvent(new w.Event("input", { bubbles: true })); e.dispatchEvent(new w.Event("change", { bubbles: true })); };
    const told = (sh) => (sh.querySelector("[data-change-told]") || { textContent: "" }).textContent;
    const say = (id) => (cardOf(id).querySelector("[data-maker-say]") || { textContent: "" }).textContent;
    const closeSheet = async () => { const k = d.getElementById("ynKeep"); if (k) k.click(); await P.work.quiet(); };
    const routes = () => P.posts.map((x) => x.route.split("/").pop());
    byAct(d, "nav.orders").click(); await P.work.quiet();

    /* V9 */
    await part("done"); await tapRow("ord-d1");
    let sh = await changeSheet(P, cardOf("ord-d1"), { go: false });
    const whyWrap = () => byAct(sh, "order.change-why").closest(".amb-field") || byAct(sh, "order.change-why").parentNode;
    const hidden0 = whyWrap().hidden;
    set(sh, "order.change-paid-so-far", 60);
    const shown = !whyWrap().hidden, line = told(sh);
    P.posts.length = 0; d.getElementById("ynGo").click(); await P.work.quiet();
    const noReason = P.posts.length === 0 && /Say why it is taken back/.test(say("ord-d1"));
    sh = await changeSheet(P, cardOf("ord-d1"), { go: false });
    set(sh, "order.change-paid-so-far", 60); set(sh, "order.change-why", "paid twice by mistake");
    P.posts.length = 0; d.getElementById("ynGo").click(); await P.work.quiet();
    const sent = P.posts.slice();
    sh = await changeSheet(P, cardOf("ord-d1"), { total: 90, go: false });
    set(sh, "order.change-paid-so-far", 60); set(sh, "order.change-why", "paid twice by mistake");
    P.posts.length = 0; d.getElementById("ynGo").click(); await P.work.quiet();
    const mixed = P.posts.length === 0 && /Take back on its own/.test(say("ord-d1"));
    ok(hidden0 && shown && /Taken back: they are told their order has changed/.test(line) && noReason && sent.length === 1 && sent[0].route.endsWith("/ord-d1/lower")
      && sent[0].body.paid === 60 && sent[0].body.why === "paid twice by mistake" && sent[0].body.moved === undefined && mixed,
    "V9: Paid so far lowered asks why, says they are told it changed, posts one /lower with the figure and his reason, and goes alone: " + J([hidden0, shown, line, sent, say("ord-d1")]));

    /* V10 */
    const winLine = async (id) => {
      for (const pt of ["todo", "open", "done"]) { if (cardOf(id)) break; await part(pt); await tapRow(id); }
      const s = await changeSheet(P, cardOf(id), { go: false }), sel = byAct(s, "order.change-window");
      const v = sel && [...sel.querySelectorAll("option")].map((o) => o.value).filter(Boolean)[0];
      if (v) set(s, "order.change-window", v);
      return { s, v, line: told(s) };
    };
    const later = await winLine("ord-w1");
    P.posts.length = 0; d.getElementById("ynGo").click(); await P.work.quiet();
    const movePost = P.posts.slice();
    const earlier = await winLine("ord-w2"); await closeSheet();
    ok(later.v && /later window asks their yes/.test(later.line) && /earlier window/.test(earlier.line) && movePost.length === 1 && movePost[0].route.endsWith("/ord-w1/move")
      && movePost[0].body.slot === later.v && Object.keys(movePost[0].body).sort().join() === "rid,slot",
    "V10: the sheet's When says an earlier window is told and a later one asks their yes, and posts one /move with the window: " + J([later.line, earlier.line, movePost]));

    /* V11 */
    await part("open"); await tapRow("ord-r9");
    sh = await changeSheet(P, cardOf("ord-r9"), { go: false });
    const ptHidden = byAct(sh, "order.change-point").closest(".amb-field").hidden;
    set(sh, "order.amend-way", "collect");
    const ptShown = !byAct(sh, "order.change-point").closest(".amb-field").hidden;
    P.posts.length = 0; d.getElementById("ynGo").click(); await P.work.quiet();
    const noPoint = P.posts.length === 0 && /Choose the point/.test(say("ord-r9"));
    sh = await changeSheet(P, cardOf("ord-r9"), { way: "collect", go: false }); set(sh, "order.change-point", "A2");
    P.posts.length = 0; d.getElementById("ynGo").click(); await P.work.quiet();
    ok(ptHidden && ptShown && noPoint && J(routes()) === J(["restate", "move"]) && P.posts[1].body.point === "A2",
      "V11: a delivery at Ready made a collection shows its Point, asks for one, then posts the restate and the point: " + J([ptHidden, ptShown, routes(), say("ord-r9")]));
    /* V13b */
    for (const pt of ["open", "todo", "done"]) { if (cardOf("ord-rb")) break; await part(pt); await tapRow("ord-rb"); }
    sh = await changeSheet(P, cardOf("ord-rb"), { go: false });
    set(sh, "order.change-stage", "back");
    const backLine = told(sh);
    P.posts.length = 0; d.getElementById("ynGo").click(); await P.work.quiet();
    ok(/Back to Agreed: they are told their order has changed/.test(backLine) && J(routes()) === J(["move"]) && P.posts[0].body.back === true && Object.keys(P.posts[0].body).sort().join() === "back,rid",
      "V13b: the sheet's Stage sends Back to Agreed as one /move and says they are told: " + J([backLine, P.posts]));
  } catch (e) { ok(false, "the sheet's checks stopped on an error: " + (e && e.stack)); } finally { P.w.close(); }
  /* V11b: no points to offer, the way to collect is not sent */
  const P2 = await richOwnerPage({ pageWork, review, extra: (route) => route === "/all/maker/points" ? { ok: true, points: { v: 1, list: [] }, examples: [] } : undefined });
  try {
    const d = P2.d, w = P2.w;
    const part = async (name) => { byAct(d, "part.orders." + name).click(); await P2.work.quiet(); };
    const cardOf = (id) => [...d.querySelectorAll("#makerReview [data-maker-card]")].find((c) => c.getAttribute("data-maker-card") === id) || null;
    byAct(d, "nav.orders").click(); await P2.work.quiet();
    for (const pt of ["open", "todo"]) { if (cardOf("ord-r9")) break; await part(pt); const r = byAct(d, "order.open", "ord-r9"); if (r) { r.click(); await P2.work.quiet(); } }
    P2.posts.length = 0;
    await changeSheet(P2, cardOf("ord-r9"), { way: "collect" });
    const said = (cardOf("ord-r9").querySelector("[data-maker-say]") || { textContent: "" }).textContent;
    ok(P2.posts.length === 0 && /none could be offered here/.test(said), "V11b: with no point to offer, a delivery at Ready is not made a collection, and the sheet says why: " + J([P2.posts, said]));
  } catch (e) { ok(false, "V11b stopped on an error: " + (e && e.stack)); } finally { P2.w.close(); }

  /* V12: their page */
  const pages = [];
  try {
    const at = ago(1), slot = new Date(Date.now() + 8 * 3600e3 + 2 * 864e5).toISOString().slice(0, 10);
    const back = ord("20261118000000-tv1", "ready", ago(3), { qty: 1, total: 105, moved: 0, changed: { at, kind: "changed", lower: true, was: { qty: 1, total: 105, delivery: 0, mode: "collect" }, wasMoved: 1 } });
    const ask = ord("20261118000000-tv2", "acknowledged", ago(3), { mode: "deliver", delivery: 5, slot: slot + "T08", slotSpan: "08:00-12:00",
      winOffer: { id: "wtest1", state: "offered", slot: slot + "T16", slotSpan: "16:00-20:00", until: new Date(Date.now() + 864e5).toISOString(), was: slot + "T08", wasSpan: "08:00-12:00" } });
    const wasReady = ord("20261118000000-tv3", "acknowledged", ago(3), { changed: { at, kind: "changed", was: { qty: 1, total: 100, delivery: 0, mode: "collect" }, wasReady: true } });
    /* Ready again after going back reads from the newest Ready (his answer to Ask 1), as an order made ready only then does */
    const H = (id, hist) => ord(id, "ready", ago(200), { history: hist });
    /* built by the order book's own events, so their page and the book's Back line are pinned together (Fable's re-check) */
    let again2 = H("20261118000000-tv4", [{ at: ago(199), status: "acknowledged", by: "desk" }, { at: ago(150), status: "ready", by: "desk" }]);
    again2.status = "ready";
    again2 = applyEvent(again2, decideDesk(copy(again2), { back: true }, ago(140)).ev).order;
    again2 = applyEvent(again2, decideDesk(copy(again2), { status: "ready", mode: "collect", point: "A2", pointAt: { lat: 3.1, lng: 101.2 }, maker: true }, ago(2)).ev).order;
    again2.history = again2.history.map((h) => ({ at: h.at, status: h.status, by: h.by, ...(h.note ? { note: h.note } : {}) }));
    const only = H("20261118000000-tv5", [{ at: ago(199), status: "acknowledged", by: "desk" }, { at: ago(2), status: "ready", by: "desk" }]);
    const A = await open({ pageWork, orders: [back, ask, wasReady, again2, only] }); pages.push(A);
    const calls = [], f0 = A.w.fetch;
    A.w.fetch = async (path, init) => { if (/^\/orders\/[^/]+\/(take|pass)$/.test(String(path))) { calls.push([String(path), JSON.parse(init.body)]); return { ok: true, status: 200, json: async () => ({ ok: true }) }; } return f0(path, init); };
    const openRow = async (id) => { const r = A.d.querySelector('[data-row="' + id + '"]'); if (r) { r.click(); await A.settle(); } };
    await openRow("20261118000000-tv1");
    const bill = [...A.d.querySelectorAll('[data-part="money"] .amb-setting')].map((r) => txt(r));
    const lineB = bill.find((r) => /^Changed on /.test(r)) || "";
    await openRow("20261118000000-tv2");
    const card = A.d.querySelector('[data-part="price"]'), words = txt(card);
    const yes = card && [...card.querySelectorAll("button")].find((b) => b.textContent === "Yes, that time");
    if (yes) { yes.click(); await A.settle(); }
    await openRow("20261118000000-tv3");
    const lineR = [...A.d.querySelectorAll('[data-part="money"] .amb-setting')].map((r) => txt(r)).find((r) => /^Changed on /.test(r)) || "";
    const readyLine = async (id) => { await openRow(id); return txt(A.d.querySelector('[data-part="steps"]')); };
    const r4 = await readyLine("20261118000000-tv4"), r5 = await readyLine("20261118000000-tv5");
    ok(r4 && r4 === r5, "V12b: Ready again after going back is counted from the newest Ready, as an order made ready only then: " + J([r4, r5]));
    ok(/It showed 1 unit handed over[.]$/.test(lineB) && !/It was /.test(lineB) && /We would like to deliver at a later time/.test(words) && /Yours stands until you say yes: 08:00 to 12:00/.test(words)
      && !!yes && calls.length === 1 && /\/orders\/20261118000000-tv2\/take$/.test(calls[0][0]) && calls[0][1].offer === "wtest1" && /It was ready[.] We will tell you when it is ready again[.]$/.test(lineR),
    "V12: their Bill says what it showed (and that it was ready), and the later window asks Yes or No, its Yes naming the window offer: " + J([lineB, words, calls, lineR]));
  } catch (e) { ok(false, "their page's checks stopped on an error: " + (e && e.stack)); } finally { for (const p of pages) p.close(); }
}
