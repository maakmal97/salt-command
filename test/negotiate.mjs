/* test/negotiate.mjs: his decisions of 05 Oct 2026, NEGOTIATE PRICE. A customer asks for a price on an order, he answers with an
   offer for the goods alone, filed as his yes waiting on their answer, and they take it or say no thanks. Driven through both
   Workers over the real migrated schema (node:sqlite), as the Accept sections of test/verify.mjs are; every code, username
   and order id is invented. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { orderBook } from "./orderbook-harness.mjs";
import { Store } from "./maker-order-controls.mjs";

export async function run({ ok, skip }) {
  let DatabaseSync = null;
  try { ({ DatabaseSync } = await import("node:sqlite")); } catch (e) { /* older runtime */ }
  if (!DatabaseSync) { if (skip) skip("node:sqlite is unavailable here, so Negotiate was not driven against the real schema"); return; }
  const O = await import("../stmt/orders.js");
  const { deskPass } = await import("../src/orders.js");
  const { offerDigest, applyPre } = await import("../src/drafter.js");
  const deskW = (await import("../src/worker.js")).default, stmtW = (await import("../stmt/worker.js")).default;
  const REPO = join(import.meta.dirname, "..");
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(join(REPO, "migrations")).filter((x) => /^\d+_.*\.sql$/.test(x)).sort()) db.exec(readFileSync(join(REPO, "migrations", f), "utf8"));
  const D1 = { prepare(sql) { const st = db.prepare(sql);
    const mk = (a) => ({ run() { const r = st.run(...a); return { meta: { changes: Number(r.changes || 0) } }; },
      first() { const r = st.get(...a); return r === undefined ? null : r; }, all() { return { results: st.all(...a) }; } });
    const self = mk([]); self.bind = (...a) => mk(a); return self; } };
  const C1 = "CQ3-NG", U1 = "ngab-cdef", C2 = "CQ4-NH", U2 = "nhab-cdef";   /* a second account for the review's cases, its own open-order count */
  const PRICING = { v: "v900", takenAt: "2026-10-01T00:00:00.000Z", tierNames: ["Ambassador", "Titanium", "Platinum", "Gold", "Silver"], profileRule: { smallUpTo: 1, bigFrom: 3 },
    byProduct: { salt: { stockCost: 56, floors: { "1": { floor: 80 }, "2": { floor: 150 }, "3": { floor: 215 } }, inputs: null, sizes: [1, 2, 3] } } };
  const setState = (k, doc) => db.prepare("INSERT OR REPLACE INTO state (key,doc) VALUES (?,?)").run(k, JSON.stringify(doc));
  let seq = 0;
  for (const cust of [C1, C2]) for (const d of ["2026-08-01", "2026-08-10", "2026-08-20"]) db.prepare("INSERT INTO entry (collection,seq,hash,doc) VALUES (?,?,?,?)")
    .run("sales", seq++, "h" + seq, JSON.stringify({ rid: "s7" + seq, customer: cust, date: d, qty: 1, total: 100, cash: 100, deliveredQty: 1, deliveredOn: d, paidOn: d }));
  setState("roster", [C1, C2]); setState("PRICING", PRICING); setState("OPEN", { byKey: {}, position: {} });
  db.prepare("INSERT INTO snapshot (one,v,stamped) VALUES (1,'v900',NULL)").run();
  /* the queue can be changed between the take's write and the drafter's read, which is how a row comes out other than offered */
  let tamper = null;
  class TKV extends Store { async get(k, t) { const v = await super.get(k, t);
    if (!(tamper && k.startsWith("q:orders") && v)) return v;
    const q = typeof v === "string" ? JSON.parse(v) : v;
    for (const e of q.queue || []) if (e.status === "Pending" && e.payload) tamper(e.payload);
    return t === "json" ? q : JSON.stringify(q); } }
  let siteHook = null;   /* runs before the desk reaches the site: how a customer's tap lands between two of his steps */
  const skv = new Store(), dkv = new TKV();
  const senv = { STMT: skv, STMT_DESK_KEY: "desk-key", ORDER_STORE: "object" };
  senv.ORDERBOOK = orderBook(senv).ns;
  await dkv.put("stmt-users", JSON.stringify({ [U1]: C1, [U2]: C2 }));
  const assets = { fetch: async () => new Response(JSON.stringify({ id: "rev-fixture" }), { headers: { "content-type": "application/json" } }) };
  const denv = { SALT_QUEUE: dkv, SALT_LEDGER: D1, STMT_DESK_KEY: "desk-key", SALT_WRITE_KEY: "k-fixture", REQUIRE_ACCESS: "0", ASSETS: assets,
    STMT_SITE: { fetch: async (url, init) => { if (siteHook) await siteHook(url, init); return stmtW.fetch(new Request(url, init), senv); } } };
  const call = async (path, body) => {
    const r = await deskW.fetch(new Request("https://salt-command.example" + path, { method: "POST",
      headers: { "content-type": "application/json", "X-Salt-Key": "k-fixture" }, body: JSON.stringify(body || {}) }), denv, { waitUntil() {} });
    return { status: r.status, j: await r.json() };
  };
  let n = 0;
  const rid = () => ("negotiateTap" + (++n) + "0000000000000000").slice(0, 24);
  const ask = async (qty, total, extra, u) => O.placeOrder(senv, u || U1, Object.assign({ product: "salt", qty, mode: "collect", place: "", unit: total / qty, total, week: "", ask: true, rid: rid() }, extra || {}));
  const orderOf = async (id) => (await O.allOrders(senv, true)).find((x) => x.id === id);
  const preOf = (id) => db.prepare("SELECT status,entry,entry_at,shown FROM preapproval WHERE order_id=? ORDER BY at DESC").get(id) || null;
  const VIEW = ["state", "total", "delivery", "until"];

  /* 1. ASKED: the order waits on his answer, and their page reads its state alone; Accept is not his road on it */
  const a = (await ask(2, 200, { propose: 180 })).order;
  const vA = O.customerView(await orderOf(a.id)).price;
  const acA = await call("/orders/" + a.id + "/accept", { hash: "x" });
  ok(a.status === "placed" && a.price && a.price.state === "asked" && a.price.proposed === 180 && JSON.stringify(vA) === JSON.stringify({ state: "asked" })
    && acA.status === 409 && /asked for a price/.test(acA.j.error),
    "a price asked waits placed, its own figure kept on the order, their page reading the state alone, and Accept refused: " + JSON.stringify({ vA, ac: acA.status }));

  /* 2. UNDER THE FLOOR IS REFUSED (rule 5): an offer of RM 140 on 2 unit, whose floor is RM 150, moves nothing */
  const pv140 = await call("/orders/" + a.id + "/preview", { total: 140 });
  const of140 = await call("/orders/" + a.id + "/offer", { total: 140, delivery: 0, hash: "x", rid: rid() });
  ok(pv140.status === 409 && of140.status === 409 && of140.j.underFloor === true && (await orderOf(a.id)).price.state === "asked" && !preOf(a.id),
    "an offer under the floor at the size is refused at the preview and at Offer, and the ask stands: " + JSON.stringify([pv140.status, of140.status, of140.j.error]));

  /* 3. HIS OFFER: drafted as Accept would draft it, filed as his yes waiting on their answer, with no entry yet; the site keeps
     the figure and its lapse, and their page reads {state, total, delivery: null, until} and nothing of the desk's */
  const pv = await call("/orders/" + a.id + "/preview", { total: 160 });
  const tap = rid(), of = await call("/orders/" + a.id + "/offer", { total: 160, delivery: 0, hash: pv.j.offerHash, rid: tap });
  const sA = await orderOf(a.id), vOff = O.customerView(sA).price, pre = preOf(a.id);
  const lapse = Math.round((Date.parse(sA.price.offer.until) - Date.now()) / 60e3);
  ok(pv.j.offerHash && of.status === 200 && sA.price.state === "offered" && sA.price.offer.total === 160 && lapse === 48 * 60
    && pre && pre.status === "waiting" && pre.entry === null && JSON.parse(pre.shown).offer.total === 160,
    "his offer of RM 160 is filed as his yes waiting on their answer, no entry queued, open 48 hours: " + JSON.stringify({ st: of.status, e: of.j.error, pre: pre && pre.status, lapse }));
  const leak = JSON.stringify(O.customerView(sA));
  ok(JSON.stringify(Object.keys(vOff)) === JSON.stringify(VIEW) && vOff.delivery === null && vOff.total === 160
    && !/floor|cost|margin|hash|drift|offerHash|proposed/.test(leak),
    "their page reads the offer as {state, total, delivery: null, until} alone, never a floor, cost, margin, digest, drift or their figure: " + JSON.stringify(vOff));
  /* a tap sent twice files one offer */
  const again = await call("/orders/" + a.id + "/offer", { total: 160, delivery: 0, hash: pv.j.offerHash, rid: tap });
  ok(again.status === 200 && again.j.again === true && db.prepare("SELECT COUNT(*) AS n FROM preapproval WHERE order_id=? AND status='waiting'").get(a.id).n === 1,
    "his Offer tapped twice files one offer and one yes: " + JSON.stringify(again.j.error || again.j.again));

  /* 4. AN OPEN OFFER FREEZES THE ORDER: their cancel and amend, and his decline, are refused; the refusal carries no figure */
  const cx = await O.customerMove(senv, U1, a.id, "cancel", { rid: rid() });
  const rp = O.decideReplace(sA, { product: "salt", qty: 3, mode: "collect", place: "", forFriend: false, week: "", digest: "", rid: rid() }, [sA], new Date().toISOString(), "");
  const dc = await call("/orders/" + a.id, { status: "declined", note: "No." }).catch(() => null);
  const decl = O.decideDesk(sA, { status: "declined" }, new Date().toISOString());
  ok(cx.code === "offerOpen" && rp.code === "offerOpen" && /withdraw it first/.test(decl.error || "")
    && Object.keys(cx).every((k) => ["error", "code", "status", "vars"].includes(k)),
    "with an offer open their cancel and amend are refused 'offer open', and his decline asks him to withdraw first: " + JSON.stringify([cx.code, rp.code, decl.error, dc && dc.status]));

  /* 5. THEIR ACCEPT, twice, lands once; the desk's pass drafts the row at the offer and his yes approves it on an exact match */
  const t1 = await O.customerMove(senv, U1, a.id, "take", { rid: "takeTapOne0000000000" }), t2 = await O.customerMove(senv, U1, a.id, "take", { rid: "takeTapOne0000000000" });
  const takes = (await orderOf(a.id)).history.filter((h) => /^price taken/.test(h.note || "")).length;
  ok(!t1.error && !t2.error && takes === 1, "their Accept tapped twice lands once: " + JSON.stringify([t1.error, t2.error, takes]));
  await deskPass(denv, new Date());
  const done = await orderOf(a.id), p2 = preOf(a.id);
  const row = JSON.parse((db.prepare("SELECT row FROM draft WHERE status='approved' ORDER BY id DESC").get() || { row: "{}" }).row);
  ok(p2.status === "applied" && done.status === "acknowledged" && done.total === 160 && row.total === 160 && row.qty === 2,
    "taken, its row is drafted at RM 160 and approved by his yes where it lands, and the order is acknowledged at it: " + JSON.stringify({ pre: p2.status, st: done.status, total: done.total, row: row.total }));

  /* 6. HIS YES IS SPENT ONLY ON THE ROW HE OFFERED: a row that comes out other than offered waits under Approve, marked */
  const b = (await ask(2, 200)).order;
  const pvB = await call("/orders/" + b.id + "/preview", { total: 170 });
  await call("/orders/" + b.id + "/offer", { total: 170, delivery: 0, hash: pvB.j.offerHash, rid: rid() });
  await O.customerMove(senv, U1, b.id, "take", { rid: rid() });
  tamper = (pl) => { pl.total = +pl.total + 10; };
  await deskPass(denv, new Date());
  tamper = null;
  const sB = await orderOf(b.id), pB = preOf(b.id);
  ok(pB.status === "differs" && sB.status === "placed" && sB.sync && sB.sync.state === "waiting",
    "a taken offer whose row comes out other than he offered waits under Approve, the order still placed and marked: " + JSON.stringify({ pre: pB.status, st: sB.status, sync: sB.sync && sB.sync.state }));
  /* the offer's digest reads the row's figures and flags, never its note or date, so a deploy's new pricing version or the
     day they took it does not send it to Approve */
  const e0 = { prepay: false }, r0 = { collection: "sales", row: { customer: C1, qty: 2, total: 160, date: "2026-10-05", note: "a" }, flags: ["f"] };
  const h0 = await offerDigest(e0, r0), hNote = await offerDigest(e0, { ...r0, row: { ...r0.row, note: "b", date: "2026-10-06" } }), hTot = await offerDigest(e0, { ...r0, row: { ...r0.row, total: 161 } });
  const hFlag = await offerDigest(e0, { ...r0, flags: ["g"] });
  ok(h0 === hNote && h0 !== hTot && h0 !== hFlag, "the offer's digest moves with the row's figures and flags and never with its note or date: " + JSON.stringify([h0 === hNote, h0 !== hTot, h0 !== hFlag]));
  const runs = [];
  const fake = { prepare: (sql) => ({ bind: (...x) => ({ run: async () => { runs.push(sql.slice(0, 40)); return { meta: { changes: 1 } }; } }) }) };
  const applied = await applyPre(fake, { id: "p", hash: h0, stage: "ack", shown: JSON.stringify({ offer: { total: 160 } }) }, { id: "d", entry: e0, ...r0 }, {});
  const differs = await applyPre(fake, { id: "p", hash: h0, stage: "ack", shown: JSON.stringify({ offer: { total: 160 } }) }, { id: "d", entry: e0, ...r0, row: { ...r0.row, total: 150 } }, {});
  ok(applied === "applied" && differs === "differs", "his offered yes is spent on the row he offered and refused on any other: " + JSON.stringify([applied, differs]));

  /* 7. THE LAPSE AND THE SIZE ARE READ AT THE TAKE: after 48 hours, or on an order no longer the size offered, Accept is refused */
  const offered = { id: "20261005020000-ab12", u: U1, status: "placed", product: "salt", qty: 2, history: [],
    price: { state: "offered", offer: { id: "f1", total: 160, until: "2026-10-07T02:00:00.000Z", product: "salt", qty: 2 } } };
  const late = O.decideCustomer(offered, "take", {}, [offered], "2026-10-07T02:00:01.000Z");
  const inTime = O.decideCustomer(offered, "take", {}, [offered], "2026-10-07T01:59:59.000Z");
  const resized = O.decideCustomer(Object.assign({}, offered, { qty: 3 }), "take", {}, [offered], "2026-10-06T02:00:00.000Z");
  const passed = O.decideCustomer(offered, "pass", {}, [offered], "2026-10-08T02:00:00.000Z");
  ok(late.code === "offerLapsed" && inTime.ev && inTime.ev.state === "taken" && resized.code === "offerVoid" && passed.ev && passed.ev.state === "passed",
    "Accept after the lapse is refused, inside it taken; on an order of another size the offer is void; No thanks is theirs at any time: " + JSON.stringify([late.code, inTime.ev && inTime.ev.state, resized.code, passed.ev && passed.ev.state]));

  /* 8. THE LIMITS: two asks open an account, none while a payment of theirs waits, none for a friend (a -R bucket), none on a
     sheet, and a figure of theirs that is a number or nothing */
  const at = "2026-10-05T03:00:00.000Z", body = (x) => Object.assign({ product: "salt", qty: 2, mode: "collect", unit: 100, total: 200, week: "", ask: true }, x);
  const open2 = [1, 2].map((i) => ({ id: "o" + i, status: "placed", product: "salt", qty: 1, price: { state: "asked" } }));
  const lim = [O.decidePlace(U1, body(), open2, at, "").code, O.decidePlace(U1, body(), open2.slice(0, 1), at, "").code || "ok",
    O.decidePlace(U1, body(), [], at, "", "customer", null, { claimWaiting: true }).code, O.decidePlace(U1, body({ forFriend: true }), [], at, "").code,
    O.decidePlace(U1, body({ sheet: "sheetOfTwo000001" }), [], at, "").code, O.decidePlace(U1, body({ propose: "cheap" }), [], at, "").code];
  ok(JSON.stringify(lim) === JSON.stringify(["askMax", "ok", "askClaim", "askFriend", "askSheet", "askFigure"]),
    "a third ask open, an ask while their payment waits, for a friend, on a sheet, or with a figure that is not one, is refused: " + JSON.stringify(lim));
  /* ---- 06 Oct 2026, Fable's review of v1028 ---- */
  /* 9. HIS NEW OFFER REACHES THE SITE BEFORE ITS YES IS FILED: their Accept of the old offer landing between refuses the new one,
     and the old yes still stands, so the take is followed to its row */
  const c = (await ask(2, 200)).order;
  const pvC1 = await call("/orders/" + c.id + "/preview", { total: 170 });
  await call("/orders/" + c.id + "/offer", { total: 170, delivery: 0, hash: pvC1.j.offerHash, rid: rid() });
  const pvC2 = await call("/orders/" + c.id + "/preview", { total: 165 });
  siteHook = async (url, init) => { if (/\/desk\/orders\//.test(String(url)) && /"offer"/.test(String(init && init.body))) {
    siteHook = null; await O.customerMove(senv, U1, c.id, "take", { rid: rid() }); } };
  const ofC2 = await call("/orders/" + c.id + "/offer", { total: 165, delivery: 0, hash: pvC2.j.offerHash, rid: rid() });
  siteHook = null;
  const preC = preOf(c.id);
  await deskPass(denv, new Date());
  const sC = await orderOf(c.id);
  ok(ofC2.status === 409 && preC && preC.status === "waiting" && JSON.parse(preC.shown).offer.total === 170 && sC.status === "acknowledged" && sC.total === 170,
    "a take landing between his new offer and its yes refuses the new offer, keeps the old yes, and the order is agreed at the offer taken: "
    + JSON.stringify({ of: ofC2.status, pre: preC && preC.status, st: sC.status, total: sC.total }));

  /* 10. A TAKE WITH NO YES ON FILE IS NEVER STRANDED: its row is queued at the offer and waits under Approve, marked */
  const d = (await ask(2, 200)).order;
  const pvD = await call("/orders/" + d.id + "/preview", { total: 175 });
  await call("/orders/" + d.id + "/offer", { total: 175, delivery: 0, hash: pvD.j.offerHash, rid: rid() });
  db.prepare("DELETE FROM preapproval WHERE order_id=?").run(d.id);
  await O.customerMove(senv, U1, d.id, "take", { rid: rid() });
  const { takeOffer } = await import("../src/orders.js");
  const rD = await takeOffer(denv, d.id), pD = preOf(d.id), sD = await orderOf(d.id);
  const rowD = rD.draft ? JSON.parse((db.prepare("SELECT row FROM draft WHERE id=?").get(rD.draft) || { row: "{}" }).row) : {};
  ok(rD.ok === true && rD.differs === true && pD && pD.status === "differs" && rowD.total === 175 && sD.status === "placed" && sD.sync && sD.sync.state === "waiting",
    "a take with no yes on file queues its row at the offer, waiting under Approve, the order marked and never stranded: "
    + JSON.stringify({ r: rD.error || rD.unmatched, pre: pD && pD.status, row: rowD.total, sync: sD.sync && sD.sync.state }));

  /* 11. A TAKE OF AN OFFER THAT IS NOT THE ONE ON FILE takes the same road: queued, waiting under Approve */
  const e = (await ask(2, 200)).order;
  const pvE = await call("/orders/" + e.id + "/preview", { total: 180 });
  await call("/orders/" + e.id + "/offer", { total: 180, delivery: 0, hash: pvE.j.offerHash, rid: rid() });
  db.prepare("UPDATE preapproval SET shown=json_set(shown,'$.offer.id','someOtherOffer000001') WHERE order_id=?").run(e.id);
  await O.customerMove(senv, U1, e.id, "take", { rid: rid() });
  /* the bridge's nudge and the minute's pass at once: one row queued, never two */
  const [rE1, rE2] = await Promise.all([takeOffer(denv, e.id), takeOffer(denv, e.id)]), pE = preOf(e.id);
  const rE = rE1.unmatched ? rE1 : rE2, queuedE = db.prepare("SELECT COUNT(*) AS n FROM preapproval WHERE order_id=? AND entry IS NOT NULL").get(e.id).n;
  ok(queuedE === 1 && (rE1.again || rE2.again), "two takes of the same mismatched offer at once queue one row, the second answered as again: " + JSON.stringify({ queuedE, a: [rE1.again, rE2.again] }));
  ok(rE.ok === true && rE.differs === true && /not the one on file/.test(rE.unmatched || "") && pE && pE.status === "differs",
    "a take of an offer other than the one on file waits under Approve, never refused into a dead end: " + JSON.stringify({ r: rE.error || rE.unmatched, pre: pE && pE.status }));

  /* 12. NO ASK WHILE GOODS OF THEIRS ARE PAST THEIR GRACE UNPAID, read by the Worker off their own orders */
  const g = (await O.placeOrder(senv, U2, { product: "salt", qty: 1, mode: "collect", place: "", unit: 100, total: 100, week: "", rid: rid() })).order;
  await O.deskMove(senv, U2, g.id, { status: "acknowledged", mode: "collect" });
  await O.deskMove(senv, U2, g.id, { handover: { units: 1, mode: "collect" } });
  const RealDate = Date, shift = 3 * 864e5;
  let overdueAsk;
  try {
    globalThis.Date = class extends RealDate { constructor(...x) { if (x.length) super(...x); else super(RealDate.now() + shift); } static now() { return RealDate.now() + shift; } };
    overdueAsk = await ask(1, 100, {}, U2);
  } finally { globalThis.Date = RealDate; }
  ok(overdueAsk.code === "askOverdue", "an ask is refused while goods of theirs are past their grace unpaid: " + JSON.stringify(overdueAsk.code || overdueAsk.error || "placed"));
  await O.deskMove(senv, U2, g.id, { cash: { amount: 100 } });

  /* 13. NO THANKS CLOSES THE ASK: on the grid the order stands at its listed price and his Accept takes it as ever */
  const h = (await ask(2, 200, {}, U2)).order;
  const pvH = await call("/orders/" + h.id + "/preview", { total: 185 });
  await call("/orders/" + h.id + "/offer", { total: 185, delivery: 0, hash: pvH.j.offerHash, rid: rid() });
  await O.customerMove(senv, U2, h.id, "pass", { rid: rid() });
  const pvH2 = await call("/orders/" + h.id + "/preview", {});
  const acH = await call("/orders/" + h.id + "/accept", { hash: pvH2.j.hash });
  const sH = await orderOf(h.id);
  ok(acH.status === 200 && acH.j.approved === true && sH.status === "acknowledged" && sH.total === 200 && sH.price.state === "passed",
    "after No thanks the order stands at its listed price, RM 200, and his Accept agrees it there: " + JSON.stringify({ ac: acH.status, e: acH.j.error, st: sH.status, total: sH.total }));
  /* past the grid there is no listed price: No thanks, or his withdrawal, cancels the order, and their page says so */
  const big = { id: "20261006020000-ab34", u: U1, status: "placed", product: "salt", qty: 40, total: 0, paid: 0, history: [],
    price: { state: "offered", offer: { id: "f1", total: 4000, until: "2026-10-08T02:00:00.000Z", product: "salt", qty: 40 } } };
  const passBig = O.decideCustomer(big, "pass", {}, [big], "2026-10-07T02:00:00.000Z"), wdBig = O.decideDesk(big, { withdraw: true }, "2026-10-07T02:00:00.000Z");
  const after = O.applyEvent(JSON.parse(JSON.stringify(big)), passBig.ev).order, afterW = O.applyEvent(JSON.parse(JSON.stringify(big)), wdBig.ev).order;
  ok(after.status === "cancelled" && afterW.status === "cancelled" && /order cancelled$/.test(after.history.at(-1).note) && O.customerView(after).price.state === "passed",
    "past the grid, No thanks or his withdrawal cancels the order, its history saying why: " + JSON.stringify([after.status, afterW.status, after.history.at(-1).note]));
  const h2 = (await ask(2, 200, {}, U2)).order;
  const pvH3 = await call("/orders/" + h2.id + "/preview", { total: 185 });
  await call("/orders/" + h2.id + "/offer", { total: 185, delivery: 0, hash: pvH3.j.offerHash, rid: rid() });
  await O.customerMove(senv, U2, h2.id, "pass", { rid: rid() });
  const pvH4 = await call("/orders/" + h2.id + "/preview", { total: 180 });
  const offH = await call("/orders/" + h2.id + "/offer", { total: 180, delivery: 0, hash: pvH4.j.offerHash, rid: rid() });
  const siteOff = O.decideDesk(await orderOf(h2.id), { offer: { id: "anotherOffer0000001", total: 180, until: "2099-01-01T00:00:00.000Z" } }, new Date().toISOString());
  ok(offH.status === 409 && /the ask is closed: the order stands at its listed price, so Accept or decline it/.test(offH.j.error || "") && /the ask is closed/.test(siteOff.error || ""),
    "and a closed ask takes no new offer, on the desk or on the site: " + JSON.stringify([offH.status, offH.j.error, siteOff.error]));
}
