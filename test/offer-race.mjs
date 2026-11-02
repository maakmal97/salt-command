/* test/offer-race.mjs (2 Nov 2026, his word): A YES THAT LANDS BETWEEN A READ AND ITS VOID IS NEVER VOIDED, AND THE EARLIER MOVE WINS. Fable's review of
 * v1366: a Withdraw, the minute's pass (deskPass) and his Accept each read an order, then let an offer's yes go, and the void named no offer, so the yes of a
 * newer offer filed in between, which their Yes may have taken already, went with it: the take then waited under Approve, or the order was agreed at other
 * terms. Now a void names the one offer it read (voidOffers), a Withdraw their Yes beat is refused in words, and on a repeated request id the order book's
 * own answer decides. Driven through both Workers over the real migrated schema (node:sqlite), each interleaving made by a hook on the site (siteHook) or on
 * the void itself (voidHook); every code, username and order id is invented. Each check is red under its own mutation (test/offer-race.mutations.json):
 *   R1  their Yes landing between a Withdraw's read and its move: the order book refuses the move in words of its own (decideDesk, which the
 *       practice road composes into as well), and the Withdraw answers them
 *   R2  a refused Withdraw voids nothing: their yes is spent on the row he offered, and the order agreed at it
 *   R3  a Withdraw tapped after their Yes is refused in the same words, read off the order
 *   R4  a Withdraw's void names the offer the order book withdrew: a newer offer filed and taken between the move and the void is agreed at its figure
 *   R10 a plain Withdraw voids the withdrawn offer's own yes at once, before any later move or the minute's pass (Fable's coverage note of 2 Nov 2026)
 *   R5  an old Withdraw id repeated over a newer offer they took between the read and the move is refused as fresh in the same words, off the order
 *       book's answer and never the read, and that offer is agreed at its figure
 *   R6  the minute's pass lets go only the yes it read: a newer offer filed and taken between its read and its void is agreed at its figure
 *   R7  his Accept lets go only the closed offer's yes: a newer offer filed and taken between its read and its void refuses the Accept and is agreed
 *   R8  an old Withdraw id over a newer offer for their yes that has lapsed is not answered as an open offer
 *   R9  Salt Admin says their Yes came first in one plain sentence
 * And their own answer (3 Nov 2026): a Yes or No thanks names the offer their page drew, read off the order as they read it (priceView's id).
 *   R11 a Yes naming an offer he has since replaced is refused in their words and takes nothing: the newer offer stays open, its yes waiting
 *   R12 a Yes naming the open offer takes it as before, and the order is agreed at its figure
 *   R13 a No thanks naming a replaced offer for their yes is refused too, and the order is not cancelled
 *   R14 a Yes naming no offer (a page loaded before this version) answers the open offer as before
 *   R15 their page's Yes names the offer it drew; refused as changed, it says so in their words and draws the new offer, whose Yes names it
 *   R16 those words go with the offer: refused as changed onto an offer withdrawn since, the page says withdrawn alone (Fable, 3 Nov 2026), on an
 *       answer to their ask and on an offer for their yes alike
 * And his Accept beside an offer of his (3 Nov 2026, Fable's review of v1382): Accept reserves the order, then records its yes, letting every waiting yes go.
 *   R17 an offer filed between an Accept's read and its reservation refuses the Accept, and the offer's yes stands, taken and agreed at its figure
 *   R18 an offer sent between an Accept's reservation and its record is refused in words, and the Accept agrees the order at its own figure
 *   R19 the reservation holds offers back REVIEW_LEASE_MS and no longer; one made before this version holds nothing; a stale one is renewed
 *   R20 two Accepts from his two devices, the second run whole between the first's read and its record: one yes is filed and one row queued, the
 *       first told its row is being drafted (3 Nov 2026, Fable's review of v1384)
 *   R21 a D1 answer with no count never strands his Accept's yes: it is read back by its id, and the order agreed */
import { readdirSync, readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { join } from "node:path";
import { orderBook } from "./orderbook-harness.mjs";
import { Store } from "./maker-order-controls.mjs";
import { richOwnerPage, byAct } from "./maker-act.mjs";

const J = JSON.stringify;
const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const wait = async (f) => { for (let i = 0; i < 200 && !f(); i++) await new Promise((r) => setTimeout(r, 15)); return f(); };
const CHANGED = "This offer has changed; look at the new one.";

export async function run({ ok, skip, pageWork }) {
  let DatabaseSync = null;
  try { ({ DatabaseSync } = await import("node:sqlite")); } catch (e) { /* older runtime */ }
  if (!DatabaseSync) { if (skip) skip("node:sqlite is unavailable here, so the offer races were not driven against the real schema"); return; }
  const O = await import("../stmt/orders.js");
  const { deskPass } = await import("../src/orders.js");
  const deskW = (await import("../src/worker.js")).default, stmtW = (await import("../stmt/worker.js")).default;
  const REPO = join(import.meta.dirname, "..");
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(join(REPO, "migrations")).filter((x) => /^\d+_.*\.sql$/.test(x)).sort()) db.exec(readFileSync(join(REPO, "migrations", f), "utf8"));
  /* an offer's void waits on voidHook while one is set, given the statement's values (the order id second): how a move of his and their Yes land between a
     read and its void. The order's own waits are recordPre's, which name no offer, and the take's, which name its yes by id: neither waits */
  const VOID_RE = /^UPDATE preapproval SET status='void'.*json_extract\(shown,'\$\.offer/;
  let voidHook = null, preHook = null, noMeta = false;   /* noMeta: the yes's INSERT answers with no count */   /* preHook: recordPre's own void, which runs before its yes is filed */
  const PRE_RE = /^UPDATE preapproval SET status='void'.*figures\.claim/;
  const D1 = { prepare(sql) { const st = db.prepare(sql);
    const mk = (a) => ({ run() { const go = () => { const r = st.run(...a); return noMeta && /^INSERT INTO preapproval/.test(sql) ? {} : { meta: { changes: Number(r.changes || 0) } }; };
        return voidHook && VOID_RE.test(sql) ? Promise.resolve(voidHook(a)).then(go) : preHook && PRE_RE.test(sql) ? Promise.resolve(preHook(a)).then(go) : go(); },
      first() { const r = st.get(...a); return r === undefined ? null : r; }, all() { return { results: st.all(...a) }; } });
    const self = mk([]); self.bind = (...a) => mk(a); return self; } };
  const C1 = "CQ5-RC", U1 = "rcab-cdef", C2 = "CQ6-RD", U2 = "rdab-cdef";   /* two accounts, so neither reaches its five open orders */
  /* 3 Nov 2026 (one order stream v3, his answer): two equal orders of one account rowed the same day are refused at Accept, the book keeping one row
     a key, so the scenarios that agree an order at a figure another has on its account today take an account of their own, with the same history */
  const C3 = "CQ7-RE", U3 = "reab-cdef", C4 = "CQ8-RF", U4 = "rfab-cdef", C5 = "CQ9-RG", U5 = "rgab-cdef", C6 = "CR4-RH", U6 = "rhab-cdef", C7 = "CR5-RJ", U7 = "rjab-cdef", C8 = "CR6-RK", U8 = "rkab-cdef", C9 = "CR7-RL", U9 = "rmab-cdef";
  const PRICING = { v: "v900", takenAt: "2026-10-01T00:00:00.000Z", tierNames: ["Ambassador", "Titanium", "Platinum", "Gold", "Silver"], profileRule: { smallUpTo: 1, bigFrom: 3 },
    byProduct: { salt: { stockCost: 56, floors: { "1": { floor: 80 }, "2": { floor: 150 }, "3": { floor: 215 } }, inputs: null, sizes: [1, 2, 3] } } };
  const setState = (k, doc) => db.prepare("INSERT OR REPLACE INTO state (key,doc) VALUES (?,?)").run(k, JSON.stringify(doc));
  let seq = 0;
  for (const cust of [C1, C2, C3, C4, C5, C6, C7, C8, C9]) for (const d of ["2026-08-01", "2026-08-10", "2026-08-20"]) db.prepare("INSERT INTO entry (collection,seq,hash,doc) VALUES (?,?,?,?)")
    .run("sales", seq++, "h" + seq, JSON.stringify({ rid: "s8" + seq, customer: cust, date: d, qty: 1, total: 100, cash: 100, deliveredQty: 1, deliveredOn: d, paidOn: d }));
  setState("roster", [C1, C2, C3, C4, C5, C6, C7, C8, C9]); setState("PRICING", PRICING); setState("OPEN", { byKey: {}, position: {} });
  db.prepare("INSERT INTO snapshot (one,v,stamped) VALUES (1,'v900',NULL)").run();
  let siteHook = null;   /* runs before the desk reaches the site: how their Yes lands between his read and his move */
  const skv = new Store(), dkv = new Store();
  const senv = { STMT: skv, STMT_DESK_KEY: "desk-key", ORDER_STORE: "object" };
  senv.ORDERBOOK = orderBook(senv).ns;
  await dkv.put("stmt-users", JSON.stringify({ [U1]: C1, [U2]: C2, [U3]: C3, [U4]: C4, [U5]: C5, [U6]: C6, [U7]: C7, [U8]: C8, [U9]: C9 }));
  const assets = { fetch: async () => new Response(JSON.stringify({ id: "rev-fixture" }), { headers: { "content-type": "application/json" } }) };
  const denv = { SALT_QUEUE: dkv, SALT_LEDGER: D1, STMT_DESK_KEY: "desk-key", SALT_WRITE_KEY: "k-fixture", REQUIRE_ACCESS: "0", ASSETS: assets,
    STMT_SITE: { fetch: async (url, init) => { if (siteHook) await siteHook(url, init); return stmtW.fetch(new Request(url, init), senv); } } };
  const call = async (path, body) => {
    const r = await deskW.fetch(new Request("https://salt-command.example" + path, { method: "POST",
      headers: { "content-type": "application/json", "X-Salt-Key": "k-fixture" }, body: JSON.stringify(body || {}) }), denv, { waitUntil() {} });
    return { status: r.status, j: await r.json() };
  };
  let n = 0;
  const rid = () => ("offerRaceTap" + (++n) + "0".repeat(16)).slice(0, 24);
  const place = async (u, ask, qty = 2) => (await O.placeOrder(senv, u, Object.assign({ product: "salt", qty, mode: "collect", place: "", unit: 100, total: 100 * qty, week: "", rid: rid() }, ask ? { ask: true } : {}))).order;
  const orderOf = async (id) => (await O.allOrders(senv, true)).find((x) => x.id === id);
  /* his offer of `total` for the goods, previewed and sent as the order card sends it: an answer to their ask, or a raise sent for their yes */
  const offer = async (id, total) => { const pv = await call("/orders/" + id + "/preview", { total }); return call("/orders/" + id + "/offer", { total, delivery: 0, hash: pv.j.offerHash, rid: rid() }); };
  const yesOf = (id, total) => (db.prepare("SELECT status FROM preapproval WHERE order_id=? AND json_extract(shown,'$.offer.total')=?").get(id, total) || {}).status || null;
  const where = async (id, total) => { const o = await orderOf(id); return { st: o && o.status, total: o && o.total, price: o && o.price && o.price.state, yes: yesOf(id, total) }; };
  const agreed = (w, total) => w.st === "acknowledged" && w.total === total && w.yes === "applied";
  /* their Yes, on the order book, while one of his steps is on its way there */
  const onWithdraw = (fn) => async (url, init) => { if (/\/desk\/orders\//.test(String(url)) && /"withdraw":true/.test(String(init && init.body))) { siteHook = null; await fn(); } };
  const onVoid = (id, fn) => async (a) => { if (a[1] !== id) return; voidHook = null; await fn(); };

  /* R1 to R3: THEIR YES LANDS BETWEEN A WITHDRAW'S READ AND ITS MOVE. The order book refuses the move in its own words, as nothing is open to withdraw;
     nothing is voided, and he is told why */
  const a = await place(U1, true);
  await offer(a.id, 160);
  siteHook = onWithdraw(() => O.customerMove(senv, U1, a.id, "take", { rid: rid() }));
  const wA = await call("/orders/" + a.id + "/withdraw", { rid: rid() });
  siteHook = null;
  const said = wA.j.error, SAID = /^they said yes before your withdraw reached them: its row is drafted at your offer$/;
  ok(wA.status === 409 && SAID.test(said || "") && (await orderOf(a.id)).price.state === "taken",
    "R1: their Yes landing between a Withdraw's read and its move refuses the Withdraw in words, the offer standing taken: " + J([wA.status, said]));
  await deskPass(denv, new Date());
  const gA = await where(a.id, 160);
  ok(agreed(gA, 160), "R2: a refused Withdraw voids nothing, so their yes is spent on the row he offered and the order agreed at RM 160: " + J(gA));
  const wA2 = await call("/orders/" + a.id + "/withdraw", { rid: rid() });
  ok(wA2.status === 409 && SAID.test(wA2.j.error || "") && wA2.j.fresh === true, "R3: a Withdraw tapped after their Yes is refused in the same words, read off the order, and fresh, so its id goes: " + J([wA2.status, wA2.j.error, wA2.j.fresh]));

  /* R4: A NEWER OFFER FILED AND TAKEN BETWEEN A WITHDRAW'S MOVE AND ITS VOID (his second device): the void names the offer withdrawn, so the newer yes stands */
  const c = await place(U3, true);
  await offer(c.id, 160);
  voidHook = onVoid(c.id, async () => { await offer(c.id, 230); await O.customerMove(senv, U3, c.id, "take", { rid: rid() }); });
  const wC = await call("/orders/" + c.id + "/withdraw", { rid: rid() });
  voidHook = null;
  await deskPass(denv, new Date());
  const gC = await where(c.id, 230);
  ok(wC.status === 200 && agreed(gC, 230),
    "R4: a newer offer filed and taken between a Withdraw's move and its void keeps its yes, and the order is agreed at it, RM 230: " + J([wC.status, wC.j.error, gC]));

  /* R10: A PLAIN WITHDRAW VOIDS ITS OWN OFFER'S YES AT ONCE. In R4, R6 and R7 the hook's newer offer voids the old yes itself (recordPre), so nothing there proves
     the Withdraw's own void; here no other move follows before the read */
  const g = await place(U4, true);
  await offer(g.id, 160);
  const yesBefore = yesOf(g.id, 160);
  const wG = await call("/orders/" + g.id + "/withdraw", { rid: rid() });
  const yesAfter = yesOf(g.id, 160);
  ok(wG.status === 200 && yesBefore === "waiting" && yesAfter === "void",
    "R10: a Withdraw voids the withdrawn offer's own yes at once: " + J([wG.status, yesBefore, yesAfter]));

  /* R5: AN OLD WITHDRAW ID REPEATED OVER A NEWER OFFER THEY TOOK BETWEEN THE READ AND THE MOVE. The read says withdrawn; the order book's answer says taken */
  const b = await place(U4, true);
  await offer(b.id, 160);
  const wRid = rid(), wB1 = await call("/orders/" + b.id + "/withdraw", { rid: wRid });
  siteHook = onWithdraw(async () => { await offer(b.id, 230); await O.customerMove(senv, U4, b.id, "take", { rid: rid() }); });
  const wB2 = await call("/orders/" + b.id + "/withdraw", { rid: wRid });
  siteHook = null;
  await deskPass(denv, new Date());
  const gB = await where(b.id, 230);
  ok(wB1.status === 200 && wB2.status === 409 && wB2.j.fresh === true && SAID.test(wB2.j.error || "") && agreed(gB, 230),
    "R5: an old Withdraw id over a newer offer they took is refused as fresh in the same words, and that offer is agreed at RM 230: " + J([wB1.status, wB2.status, wB2.j.fresh, wB2.j.error, gB]));

  /* R6: THE MINUTE'S PASS (deskPass) reads their No thanks and lets that yes go; a raise of his filed and taken between its read and its void stands */
  const d = await place(U2, true);
  await offer(d.id, 160);
  await O.customerMove(senv, U2, d.id, "pass", { rid: rid() });
  voidHook = onVoid(d.id, async () => { await offer(d.id, 230); await O.customerMove(senv, U2, d.id, "take", { rid: rid() }); });
  await deskPass(denv, new Date());
  voidHook = null;
  await deskPass(denv, new Date());
  const gD = await where(d.id, 230);
  ok(agreed(gD, 230), "R6: the minute's pass lets go only the yes it read: a raise filed and taken between its read and its void is agreed at RM 230: " + J(gD));

  /* R7: HIS ACCEPT reads their No thanks and lets that yes go; a raise of his filed and taken between its read and its void refuses the Accept */
  const e = await place(U5, true);
  await offer(e.id, 160);
  await O.customerMove(senv, U5, e.id, "pass", { rid: rid() });
  const pvE = await call("/orders/" + e.id + "/preview", {});
  voidHook = onVoid(e.id, async () => { await offer(e.id, 230); await O.customerMove(senv, U5, e.id, "take", { rid: rid() }); });
  const acE = await call("/orders/" + e.id + "/accept", { hash: pvE.j.hash });
  voidHook = null;
  await deskPass(denv, new Date());
  const gE = await where(e.id, 230);
  ok(acE.status === 409 && agreed(gE, 230),
    "R7: his Accept lets go only the closed offer's yes: a raise taken between its read and its void refuses the Accept and is agreed at RM 230: " + J([acE.status, acE.j.error, gE]));

  /* R8: A LAPSED OFFER IS NOT CALLED OPEN. A raise sent for their yes, withdrawn under an id; a newer one, lapsed two days on; the old id repeated */
  const f = await place(U1, false);
  await offer(f.id, 230);
  const fRid = rid(), wF1 = await call("/orders/" + f.id + "/withdraw", { rid: fRid });
  const ofF = await offer(f.id, 240);
  const RealDate = Date, shift = 49 * 3600e3;
  let wF2;
  try {
    globalThis.Date = class extends RealDate { constructor(...x) { if (x.length) super(...x); else super(RealDate.now() + shift); } static now() { return RealDate.now() + shift; } };
    wF2 = await call("/orders/" + f.id + "/withdraw", { rid: fRid });
  } finally { globalThis.Date = RealDate; }
  ok(wF1.status === 200 && ofF.status === 200 && wF2.status === 200 && wF2.j.again === true && !wF2.j.fresh,
    "R8: an old Withdraw id over a newer offer for their yes that has lapsed is answered as the first was, never as an open offer: " + J([wF1.status, ofF.status, wF2.status, wF2.j.again, wF2.j.error]));

  /* R11 to R14: THEIR ANSWER NAMES THE OFFER THEY WERE SHOWN. He replaces an offer while their Yes is on its way: the Yes names the one their page drew */
  const shownOf = async (id) => { const v = O.customerView(await orderOf(id)); return v && v.price ? v.price.id : undefined; };
  const h = await place(U6, true);
  await offer(h.id, 160);
  const shownH = await shownOf(h.id);
  await offer(h.id, 230);
  const tH = await O.customerMove(senv, U6, h.id, "take", { rid: rid(), offer: shownH });
  await deskPass(denv, new Date());
  const gH = await where(h.id, 230), oH = await orderOf(h.id);
  ok(typeof shownH === "string" && shownH.length > 0 && tH.status === 409 && tH.code === "offerChanged" && O.customerView(oH).price.state === "offered"
    && O.customerView(oH).price.total === 230 && gH.st === "placed" && gH.yes === "waiting",
    "R11: a Yes naming an offer he has since replaced is refused in their words and takes nothing, the newer offer open and its yes waiting: " + J([shownH, tH.status, tH.code, tH.error, gH]));
  const shownH2 = await shownOf(h.id);
  const tH2 = await O.customerMove(senv, U6, h.id, "take", { rid: rid(), offer: shownH2 });
  await deskPass(denv, new Date());
  const gH2 = await where(h.id, 230);
  ok(shownH2 !== shownH && !tH2.error && agreed(gH2, 230), "R12: a Yes naming the open offer takes it, and the order is agreed at RM 230: " + J([tH2.error, gH2]));

  const k = await place(U7, false);
  await offer(k.id, 230);
  const shownK = await shownOf(k.id);
  await call("/orders/" + k.id + "/withdraw", { rid: rid() });
  await offer(k.id, 240);
  const pK = await O.customerMove(senv, U7, k.id, "pass", { rid: rid(), offer: shownK });
  const oK = O.customerView(await orderOf(k.id));
  ok(pK.status === 409 && pK.code === "offerChanged" && oK.status === "placed" && oK.price.state === "offered" && oK.price.total === 240,
    "R13: a No thanks naming a replaced offer for their yes is refused, and the order stands with the new offer open: " + J([pK.status, pK.code, oK.status, oK.price]));

  const m = await place(U2, true);
  await offer(m.id, 160);
  const tM = await O.customerMove(senv, U2, m.id, "take", { rid: rid() });
  await deskPass(denv, new Date());
  const gM = await where(m.id, 160);
  ok(!tM.error && agreed(gM, 160), "R14: a Yes naming no offer, from a page loaded before this version, answers the open offer as before: " + J([tM.error, gM]));

  /* R17: AN OFFER FILED BETWEEN AN ACCEPT'S READ AND ITS RESERVATION (his other device): the order book refuses the reservation, so nothing lets its yes go */
  const q = await place(U8, false);
  const pvQ = await call("/orders/" + q.id + "/preview", {});
  let offQ = null;
  siteHook = async (url, init) => { if (/"reserveReview"/.test(String(init && init.body))) { siteHook = null; offQ = await offer(q.id, 230); } };
  const acQ = await call("/orders/" + q.id + "/accept", { hash: pvQ.j.hash });
  siteHook = null;
  const yQ = yesOf(q.id, 230), vQ = O.customerView(await orderOf(q.id));
  const tQ = await O.customerMove(senv, U8, q.id, "take", { rid: rid(), offer: vQ.price && vQ.price.id });
  await deskPass(denv, new Date());
  const gQ = await where(q.id, 230);
  ok(offQ && offQ.status === 200 && acQ.status === 409 && yQ === "waiting" && vQ.status === "placed" && !tQ.error && agreed(gQ, 230),
    "R17: an offer filed between an Accept's read and its reservation refuses the Accept, its yes standing, taken and agreed at RM 230: " + J([offQ && offQ.status, acQ.status, acQ.j.error, yQ, tQ.error, gQ]));

  /* R18: AN OFFER SENT BETWEEN AN ACCEPT'S RESERVATION AND ITS RECORD: refused while the reservation is fresh, so the Accept's record lets no yes of it go */
  const r = await place(U9, false);
  const pvR = await call("/orders/" + r.id + "/preview", {});
  let offR = null;
  preHook = async (a) => { if (a[1] !== r.id) return; preHook = null; offR = await offer(r.id, 230); };
  const acR = await call("/orders/" + r.id + "/accept", { hash: pvR.j.hash });
  preHook = null;
  await deskPass(denv, new Date());
  const oR = await orderOf(r.id);
  ok(offR && offR.status === 409 && /your Accept on this order is on its way/.test(offR.j.error || "") && acR.status === 200 && acR.j.approved === true
    && oR.status === "acknowledged" && oR.total === 200 && yesOf(r.id, 230) === null,
    "R18: an offer sent between an Accept's reservation and its record is refused in words, and the Accept agrees the order at RM 200: " + J([offR && offR.status, offR && offR.j.error, acR.status, acR.j.error, oR.status, oR.total]));

  /* R19: THE LEASE, on the order book's own clock */
  {
    const T0 = "2026-11-03T01:00:00.000Z", in1 = "2026-11-03T01:01:00.000Z", out1 = "2026-11-03T01:02:01.000Z";
    const base = { id: "20261103010000-lease", u: U8, status: "placed", product: "salt", qty: 2, total: 200, mode: "collect", place: "", forFriend: false, wantBy: null, slot: null, reviewed: true, reviewedAt: T0 };
    const off = { offer: { id: "leaseOffer0000000001", kind: "accept", total: 230, delivery: 0, until: "2026-11-05T01:00:00.000Z" } };
    const terms = { status: "placed", product: "salt", qty: 2, total: 200, mode: "collect", place: "", forFriend: false, wantBy: null, slot: null };
    const held = O.decideDesk(base, off, in1), freed = O.decideDesk(base, off, out1), old = O.decideDesk(Object.assign({}, base, { reviewedAt: undefined }), off, in1);
    const within = O.decideDesk(base, { reserveReview: terms }, in1), renew = O.decideDesk(base, { reserveReview: terms }, out1);
    const marked = renew.ev ? O.applyEvent(JSON.parse(J(base)), renew.ev).order : null;
    ok(held.status === 409 && !!freed.ev && !!old.ev && within.none === true && !!renew.ev && marked && marked.reviewedAt === out1 && O.REVIEW_LEASE_MS === 120000,
      "R19: a reservation holds offers back two minutes and no longer, one with no moment holds nothing, and a stale one is renewed from this Accept: " + J([held.status, !!freed.ev, !!old.ev, within.none, !!renew.ev, marked && marked.reviewedAt]));
  }

  /* R20: TWO ACCEPTS OF HIS, ONE ORDER. The second, from his other device, runs whole while the first waits at its record: the first files nothing */
  {
    const w = await place(U3, false);
    const pvW = await call("/orders/" + w.id + "/preview", {});
    let acW2 = null;
    preHook = async (a) => { if (a[1] !== w.id) return; preHook = null; acW2 = await call("/orders/" + w.id + "/accept", { hash: pvW.j.hash }); };
    const acW1 = await call("/orders/" + w.id + "/accept", { hash: pvW.j.hash });
    preHook = null;
    await deskPass(denv, new Date());
    const yesW = db.prepare("SELECT status FROM preapproval WHERE order_id=? AND stage='ack' AND status<>'void'").all(w.id).map((x) => x.status);
    /* a yes filed with its entry is a row queued (queueSale runs once for each) */
    const queued = Number(db.prepare("SELECT COUNT(*) AS n FROM preapproval WHERE order_id=? AND stage='ack' AND status<>'void' AND entry IS NOT NULL").get(w.id).n);
    const oW = await orderOf(w.id);
    ok(acW2 && acW2.status === 200 && acW2.j.approved === true && acW1.status === 409 && /its row is being drafted/.test(acW1.j.error || "")
      && J(yesW) === J(["applied"]) && queued === 1 && oW.status === "acknowledged",
      "R20: two Accepts on one order from his two devices file one yes and queue one row, the other told its row is being drafted: " + J([acW2 && acW2.status, acW1.status, acW1.j.error, yesW, queued, oW.status]));
  }

  /* R21: A D1 ANSWER WITH NO COUNT, on a plain Accept */
  {
    const v = await place(U3, false, 3);   /* its own size: an equal order rowed today is refused at Accept (v1385) */
    const pvV = await call("/orders/" + v.id + "/preview", {});
    noMeta = true;
    let acV;
    try { acV = await call("/orders/" + v.id + "/accept", { hash: pvV.j.hash }); } finally { noMeta = false; }
    const yesV = db.prepare("SELECT status FROM preapproval WHERE order_id=? AND stage='ack' AND status<>'void'").all(v.id).map((x) => x.status), oV = await orderOf(v.id);
    ok(acV.status === 200 && acV.j.approved === true && J(yesV) === J(["applied"]) && oV.status === "acknowledged",
      "R21: a D1 answer with no count is read back by the yes's id, and the order agreed: " + J([acV.status, acV.j.error, yesV, oV.status]));
  }

  /* R15: THEIR PAGE. Its Yes names the offer drawn; refused as changed, it says so and draws the new offer, whose Yes names the new id */
  {
    const { landingPage } = await import("../stmt/page.js"), Cr = await import("../tools/stmt-crypto.mjs"), { JSDOM } = await import("jsdom");
    const U = "rfab-cdef", PASS = "fixture-pass-race-15", ck = await Cr.contentKey("test-secret", U), P = "20261103010000-ofrc", Q = "20261103010001-ofrd", R = "20261103010002-ofre";
    const until = new Date(Date.now() + 20 * 3600e3).toISOString();
    const one = (oid, pid, total, state, from) => Object.assign({ id: oid, at: "2026-11-03T01:00:00Z", product: "salt", qty: 2, unit: 100, total: 200, delivery: 0, mode: "collect", paid: 0, moved: 0, status: "placed",
      history: [{ at: "2026-11-03T01:00:00Z", status: "placed", by: "customer" }], msgs: [], price: Object.assign({ state: state || "offered", id: pid, total, delivery: null, until }, from ? { from, delivery: 0, slot: null, slotSpan: null } : {}) });
    const byId = { [P]: one(P, "offA-race", 160), [Q]: one(Q, "offC-race", 160), [R]: one(R, "offE-race", 230, "offered", "accept") };
    const mk = (pid, total) => { byId[P] = one(P, pid, total); };
    const body = { ok: true, wrap: await Cr.wrapKey(PASS, ck), session: "sess-race",
      env: await Cr.encryptWith(ck, JSON.stringify({ statements: [{ issued: "2026-09-01", label: "September", body: "<p>Statement</p>" }] })) };
    const posts = [];
    const dom = new JSDOM(landingPage(U, "nrace", null), { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true, beforeParse(win) {
      try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
      win.scrollTo = () => {}; win.HTMLElement.prototype.scrollIntoView = () => {};
      win.fetch = async (path, init) => {
        const p = String(path), mth = (init && init.method) || "GET", reply = (status, b) => ({ ok: status === 200, status, type: "basic", json: async () => b });
        if (p === "/open") return reply(200, body);
        if (p === "/orders" && mth === "GET") return reply(200, { ok: true, orders: [byId[P], byId[Q], byId[R]] });
        if (mth === "POST" && p === "/orders/" + R + "/take") { posts.push("R:" + JSON.parse((init && init.body) || "{}").offer); byId[R] = one(R, "offF-race", 240, "withdrawn", "accept");
          return reply(409, { ok: false, code: "offerChanged", error: "this offer has changed; look at the new one" }); }
        if (mth === "POST" && p === "/orders/" + Q + "/take") { posts.push("Q:" + JSON.parse((init && init.body) || "{}").offer); byId[Q] = one(Q, "offD-race", 230, "withdrawn");
          return reply(409, { ok: false, code: "offerChanged", error: "this offer has changed; look at the new one" }); }
        if (mth === "POST" && p === "/orders/" + P + "/take") {
          const b = JSON.parse((init && init.body) || "{}"); posts.push(b.offer);
          if (b.offer === "offB-race") return reply(200, { ok: true });
          mk("offB-race", 230);
          return reply(409, { ok: false, code: "offerChanged", error: "this offer has changed; look at the new one" });
        }
        return reply(404, { ok: false });
      };
    } });
    try {
      const w = dom.window, d = w.document, yes = (sc) => sc && [...sc.querySelectorAll(".oprice button")].find((x) => x.className.includes("salt-pill"));
      d.getElementById("un").value = U; d.getElementById("pw").value = PASS;
      d.getElementById("f").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
      await wait(() => d.querySelector('#pOrder [data-row="' + P + '"]'));
      const row = d.querySelector('#pOrder [data-row="' + P + '"]'); if (row) row.click();
      await wait(() => yes(d.querySelector("#pOrder .oscreen")));
      const y1 = yes(d.querySelector("#pOrder .oscreen")); if (y1) y1.click();
      await wait(() => posts.length >= 1 && /RM ?230/.test(t(d.querySelector("#pOrder .oprice"))));
      const said = t(d.querySelector("#pOrder .oprice"));
      const y2 = yes(d.querySelector("#pOrder .oscreen")); if (y2) y2.click();
      await wait(() => posts.length >= 2 && yes(d.querySelector("#pOrder .oscreen")) && !yes(d.querySelector("#pOrder .oscreen")).disabled);
      ok(posts[0] === "offA-race" && said.includes(CHANGED) && /RM ?230/.test(said) && posts[1] === "offB-race" && posts.length === 2,
        "R15: their page's Yes names the offer drawn; refused as changed it says so and draws the new offer, whose Yes names it: " + J([posts, said.slice(0, 300)]));
      const back = d.querySelector("#pOrder .oback"); if (back) back.click();
      await wait(() => d.querySelector('#pOrder [data-row="' + Q + '"]'));
      const rowQ = d.querySelector('#pOrder [data-row="' + Q + '"]'); if (rowQ) rowQ.click();
      await wait(() => yes(d.querySelector("#pOrder .oscreen")));
      const y3 = yes(d.querySelector("#pOrder .oscreen")); if (y3) y3.click();
      await wait(() => byId[Q].price.state === "withdrawn" && /We withdrew our price/.test(t(d.querySelector("#pOrder .oprice"))));
      const saidQ = t(d.querySelector("#pOrder .oprice"));
      ok(posts[2] === "Q:offC-race" && /We withdrew our price/.test(saidQ) && !saidQ.includes(CHANGED), "R16: refused as changed onto an offer withdrawn since, the page says withdrawn alone: " + J([posts, saidQ]));
      const back2 = d.querySelector("#pOrder .oback"); if (back2) back2.click();
      await wait(() => d.querySelector('#pOrder [data-row="' + R + '"]'));
      const rowR = d.querySelector('#pOrder [data-row="' + R + '"]'); if (rowR) rowR.click();
      await wait(() => yes(d.querySelector("#pOrder .oscreen")) && !yes(d.querySelector("#pOrder .oscreen")).disabled);
      const y4 = yes(d.querySelector("#pOrder .oscreen")); if (y4) y4.click();
      await wait(() => byId[R].price.state === "withdrawn" && /We took that back/.test(t(d.querySelector("#pOrder .oprice"))));
      const saidR = t(d.querySelector("#pOrder .oprice"));
      ok(posts[3] === "R:offE-race" && /We took that back/.test(saidR) && !saidR.includes(CHANGED), "R16: and so on an offer for their yes: " + J([posts, saidR]));
    } finally { await new Promise((r) => setTimeout(r, 60)); dom.window.close(); }
  }

  /* R9: SALT ADMIN, the Desk's own words for a Withdraw their Yes beat, as Needs you's offer card draws them */
  const p = await richOwnerPage({ pageWork, extra: (route) => (/\/all\/maker\/orders\/ord-p4\/withdraw$/.test(route) ? { refuse: said } : undefined) });
  try {
    await p.work.quiet();
    const dd = p.d, click = async (el) => { if (el) el.click(); await p.work.quiet(); };
    await click(byAct(dd, "nav.needs"));
    const card = () => dd.querySelector('#nlist [data-need="f:ord-p4"]');
    await click(card() && byAct(card(), "need.withdraw"));
    await click(card() && byAct(card(), "need.ask-yes"));
    const text = t(card());
    ok(/They said yes before your Withdraw, so its row is drafted at your offer[.]/.test(text), "R9: Salt Admin says their Yes came first in one plain sentence: " + text.slice(-200));
  } finally { p.w.close(); }
}
