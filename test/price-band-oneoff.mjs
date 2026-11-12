/* test/price-band-oneoff.mjs: his decision "Ask D" of 10 Nov 2026 (docs/plan-salt-price-band.html). A PRICE HE TYPES OUTSIDE THE BAND IS ASKED
   ONCE, THEN STANDS AS A MARKED ONE-OFF. On a book with a price band (salt) a goods total he types at Accept, in an offer or in an amendment of an
   agreed order that is under the Floor or over the Ceiling at its size is refused once (409, `outside`), saying by how much; sent again with his
   reason (`oneOff`, one line of 3 to 120 characters) it goes through as any Accept or amendment does, the sale's row carrying
   `oneOff: {why, side, by}` and its card the flag. A book with no band refuses as it always did. The reason is his alone: nothing the site keeps
   or a customer reads names it. The evidence readers (their usual, their rates) leave a marked row out.
   Driven through both Workers over the real migrated schema (node:sqlite), as test/negotiate.mjs is, then Salt Admin's page in jsdom; every code,
   username, order id and reason is invented. Mutations: test/price-band-oneoff.mutations.json. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { webcrypto } from "node:crypto";
import { JSDOM } from "jsdom";
import { orderBook } from "./orderbook-harness.mjs";
import { Store } from "./maker-order-controls.mjs";
import { cardOf } from "./maker-act.mjs";

export async function run({ ok, skip }) {
  let DatabaseSync = null;
  try { ({ DatabaseSync } = await import("node:sqlite")); } catch (e) { /* older runtime */ }
  if (!DatabaseSync) { if (skip) skip("node:sqlite is unavailable here, so the one-off was not driven against the real schema"); return; }
  const O = await import("../stmt/orders.js");
  const { deskPass } = await import("../src/orders.js");
  const DR = await import("../src/drafter.js");
  const { applyAmend } = await import("../engine/apply.mjs");
  const ONE = await import("../engine/oneoff.mjs");
  const RULES = (await import("../engine/rules.mjs")).default;
  const PE = (await import("../engine/position.mjs")).default;
  const { handleMaker } = await import("../stmt/maker.js");
  const { landingPage } = await import("../stmt/page.js");
  const deskW = (await import("../src/worker.js")).default, stmtW = (await import("../stmt/worker.js")).default;
  const REPO = join(import.meta.dirname, "..");
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(join(REPO, "migrations")).filter((x) => /^\d+_.*\.sql$/.test(x)).sort()) db.exec(readFileSync(join(REPO, "migrations", f), "utf8"));
  const D1 = { prepare(sql) { const st = db.prepare(sql);
    const mk = (a) => ({ async run() { const r = st.run(...a); return { meta: { changes: Number(r.changes || 0) } }; },
      async first() { const r = st.get(...a); return r === undefined ? null : r; }, async all() { return { results: st.all(...a) }; } });
    const self = mk([]); self.bind = (...a) => mk(a); return self; } };

  /* THE BOOKS: salt on his band (COGS RM 50, the Floor carrying a 21.3% share, so RM 65 at 1 unit; the Ceiling RM 175 at 1 unit off the
     supplier's price), and oil, a stated board with no band (cost RM 7, the Floor RM 70 at 10 unit) */
  const TR = RULES.TIER_RULE;
  const costIn = (c, share) => Object.assign({ prod: "x", lockOn: false, lockState: { state: "none", lock: null }, lockBase: null, over: { cost: null, shrink: null },
    lot: { qty: 10, total: c * 10, rate: c, date: "2026-10-01" }, quoteRate: c, repl: c, freightRate: 0, meanLot: 10, leak: null,
    costBasis: { freightPerTrip: { rm: 0 }, txnPerDelivery: { rm: 0 }, deliveredShare: { v: 0 } }, attrib: 1, shrinkRate: 0, avgDel: { n: 0, mean: 0 },
    costRule: { kind: "latestCogs" }, latest: { quote: c * 10, freight: 0, units: 10, rate: c } }, share == null ? {} : { nrs: { share } });
  const pol = (b) => ({ LADDER: { ...RULES.LADDER, ...(RULES.LADDER_BY[b] || {}) }, floorTo: RULES.RULES.floorTo, minPerUnit: 0, timePerOrder: 0, lotFloor: {}, tierRule: TR[b] });
  const PRICING = { v: "v900", takenAt: "2026-10-01T00:00:00.000Z", profileRule: { smallUpTo: 1, bigFrom: 3 },
    byProduct: { salt: { stockCost: 50, floors: { "1": { floor: 65 } }, inputs: { cost: costIn(50, 0.213), policy: pol("salt") }, sizes: [1, 2, 3] },
      oil: { stockCost: 7, floors: { "10": { floor: 70 } }, inputs: { cost: costIn(7), policy: pol("oil") }, sizes: [10, 20] } } };
  const pbook = { pricing: PRICING };
  const fl1 = DR.floorFor(pbook, "salt", 1), band1 = DR.bandFor(pbook, "salt", 1), bandOil = DR.bandFor(pbook, "oil", 10);
  /* and a derived rule with no band (salt's own, less its band) has no Ceiling to ask about, whatever its ceilingX makes */
  const { band: dropped, ...noBandRule } = TR.salt;
  const plain = { pricing: { byProduct: { salt: { floors: {}, inputs: { cost: costIn(50, 0.213), policy: { ...pol("salt"), tierRule: noBandRule } } } } } };
  const bandPlain = DR.bandFor(plain, "salt", 1), outPlain = ONE.outsideBand(5000, DR.floorFor(plain, "salt", 1), bandPlain);
  ok(fl1 && fl1.floor === 65 && fl1.exact === true && band1 && band1.ceiling === 175 && bandOil === null && !!dropped && bandPlain === null && outPlain === null,
    "the fixture is the day of the switch: salt's Floor RM 65 and Ceiling RM 175 at 1 unit, and a rule with no band (oil's board, or salt's less its band) has no Ceiling to ask about: "
    + JSON.stringify({ fl1, band1, bandOil, bandPlain, outPlain }));

  /* the people: one account a case, so no order is the twin of another and no account runs out of open orders */
  const WHO = { A: ["CQ3-NA", "naab-cdef"], B: ["CQ3-NB", "nbab-cdef"], C: ["CQ3-NC", "ncab-cdef"], D: ["CQ3-ND", "ndab-cdef"], E: ["CQ3-NE", "neab-cdef"],
    F: ["CQ3-NF", "nfab-cdef"], G: ["CQ3-NG", "ngab-cdef"], H: ["CQ3-NH", "nhab-cdef"] };
  const setState = (k, doc) => db.prepare("INSERT OR REPLACE INTO state (key,doc) VALUES (?,?)").run(k, JSON.stringify(doc));
  let seq = 0;
  const seed = (row) => db.prepare("INSERT INTO entry (collection,seq,hash,doc) VALUES (?,?,?,?)").run("sales", seq++, "h" + seq, JSON.stringify(row));
  for (const [code] of Object.values(WHO)) for (const d of ["2026-08-01", "2026-08-10", "2026-08-20"])
    seed({ rid: "s7" + seq, customer: code, date: d, qty: 1, total: 120, cash: 120, deliveredQty: 1, deliveredOn: d, paidOn: d });
  let open = { sales: [], state: { OPEN: { byKey: {}, position: {} } } };
  setState("roster", Object.values(WHO).map((w) => w[0])); setState("PRICING", PRICING); setState("OPEN", open.state.OPEN);
  db.prepare("INSERT INTO snapshot (one,v,stamped) VALUES (1,'v900',NULL)").run();
  const sent = [];   /* every word the Desk sends the site */
  const skv = new Store(), dkv = new Store();
  const KEY = "oneoff-maker-test-capability-000001";
  const senv = { STMT: skv, STMT_DESK_KEY: "desk-key", ORDER_STORE: "object", COUNTER_MAKER_KEY: KEY };
  senv.ORDERBOOK = orderBook(senv).ns;
  await dkv.put("stmt-users", JSON.stringify(Object.fromEntries(Object.values(WHO).map(([c, u]) => [u, c]))));
  const assets = { fetch: async () => new Response(JSON.stringify({ id: "rev-fixture" }), { headers: { "content-type": "application/json" } }) };
  const denv = { SALT_QUEUE: dkv, SALT_LEDGER: D1, STMT_DESK_KEY: "desk-key", SALT_WRITE_KEY: "k-fixture", REQUIRE_ACCESS: "0", ASSETS: assets, COUNTER_MAKER_KEY: KEY,
    STMT_SITE: { fetch: async (url, init) => { sent.push(String(url) + " " + String((init && init.body) || "")); return stmtW.fetch(new Request(url, init), senv); } } };
  /* what the Desk hands to waitUntil (the drafter on the tap) is awaited, so a read after a tap sees what the tap made */
  const bg = [], ctx = { waitUntil(p) { bg.push(Promise.resolve(p).catch(() => {})); } };
  const settle = async () => { while (bg.length) await bg.shift(); };
  senv.DESK_MAKER = { fetch: async (request) => { const r = await deskW.fetch(request, denv, ctx); await settle(); return r; } };
  const call = async (path, body) => {
    const r = await deskW.fetch(new Request("https://salt-command.example" + path, { method: "POST",
      headers: { "content-type": "application/json", "X-Salt-Key": "k-fixture" }, body: JSON.stringify(body || {}) }), denv, ctx);
    await settle();
    return { status: r.status, j: await r.json().catch(() => ({})) };
  };
  let n = 0;
  const rid = () => ("bandAskTap" + (++n) + "0".repeat(20)).slice(0, 24);
  const place = async (who, product, qty, total) => (await O.placeOrder(senv, WHO[who][1], { product, qty, mode: "collect", place: "", unit: total / qty, total, week: "", rid: rid() })).order;
  const orderOf = async (id) => (await O.allOrders(senv, true)).find((x) => x.id === id);
  const drafts = () => db.prepare("SELECT id,status,row,flags,entry FROM draft ORDER BY id").all().map((d) => ({ ...d, row: JSON.parse(d.row || "{}"), flags: JSON.parse(d.flags || "[]"), entry: JSON.parse(d.entry || "{}") }));
  const draftOf = (id) => drafts().filter((d) => d.entry && d.entry.orderId === id).pop() || null;
  const preOf = (id, stage) => db.prepare("SELECT status,entry,shown FROM preapproval WHERE order_id=? AND stage=? ORDER BY at DESC").get(id, stage) || null;
  const WHY = "A sample for the chef", MARK_UNDER = { why: WHY, side: "under", by: 45 };
  const SAY_UNDER = "RM 45 under the Floor of RM 65 at 1 unit: a loss of RM 45 on this order. Give a reason and it stands as a one-off.";
  const SAY_OVER = "RM 20 over the Ceiling of RM 175 at 1 unit. Give a reason and it stands as a one-off.";
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  /* 1. UNDER THE FLOOR, ASKED: 409, the old underFloor kept, and `outside` says the side, by how much, the Floor and the Ceiling */
  const a = await place("A", "salt", 1, 120);
  const pvU = await call("/orders/" + a.id + "/preview", { total: 20 });
  ok(pvU.status === 409 && pvU.j.underFloor === true && same(pvU.j.outside, { side: "under", by: 45, floor: 65, ceiling: 175 }) && pvU.j.error === SAY_UNDER,
    "a price typed under salt's Floor is asked once at the preview, in his sentence, with the figures beside it: " + JSON.stringify(pvU));

  /* 2. OVER THE CEILING, ASKED: 409, no underFloor, the same shape */
  const pvO = await call("/orders/" + a.id + "/preview", { total: 195 });
  ok(pvO.status === 409 && pvO.j.underFloor === undefined && same(pvO.j.outside, { side: "over", by: 20, floor: 65, ceiling: 175 }) && pvO.j.error === SAY_OVER,
    "a price typed over salt's Ceiling is asked once at the preview, in his sentence, and is no floor refusal: " + JSON.stringify(pvO));

  /* 3. A REASON IS ONE LINE OF 3 TO 120 CHARACTERS: anything else is a 400 in one plain sentence, on the preview and on Accept */
  const bad = ["x", "  ab  ", "a".repeat(121), "two\nlines", "a <b> tag", 7];
  const badPv = [], badAc = [];
  for (const b of bad) { badPv.push(await call("/orders/" + a.id + "/preview", { total: 20, oneOff: b })); badAc.push(await call("/orders/" + a.id + "/accept", { total: 20, delivery: 0, hash: "x", oneOff: b })); }
  ok(badPv.concat(badAc).every((r) => r.status === 400 && typeof r.j.error === "string" && r.j.error.length > 10 && !r.j.outside) && !draftOf(a.id),
    "a reason that is not one line of 3 to 120 characters is refused 400, and nothing is drafted: " + JSON.stringify(badPv.concat(badAc).map((r) => [r.status, r.j.error])));

  /* 4. WITH HIS REASON THE PREVIEW GOES THROUGH: the row carries the mark, exactly why, side and by, and the flags say it */
  const pvW = await call("/orders/" + a.id + "/preview", { total: 20, oneOff: "  " + WHY + "  " });
  const FLAG_UNDER = "One-off: RM 45 under the Floor, his reason: " + WHY + ".";
  ok(pvW.status === 200 && pvW.j.row && same(pvW.j.row.oneOff, MARK_UNDER) && (pvW.j.flags || []).includes(FLAG_UNDER) && pvW.j.row.total === 20,
    "with his reason the preview reads the row at his price, marked a one-off, the reason trimmed, and the card's flags say it: " + JSON.stringify({ st: pvW.status, row: pvW.j.row, flags: pvW.j.flags, e: pvW.j.error }));

  /* 5. ACCEPT WITHOUT THE REASON IS STILL ASKED, the digest of the marked row notwithstanding */
  const acNo = await call("/orders/" + a.id + "/accept", { total: 20, delivery: 0, hash: pvW.j.hash });
  ok(acNo.status === 409 && acNo.j.outside && acNo.j.outside.side === "under" && acNo.j.error === SAY_UNDER && !draftOf(a.id) && (await orderOf(a.id)).status === "placed",
    "Accept at that price with no reason is asked as the preview was, and nothing moves: " + JSON.stringify([acNo.status, acNo.j.error]));

  /* 6. ONE TAP STILL APPROVES: Accept with the reason drafts the marked row, his yes covers it, and the order is agreed at his price */
  const ac = await call("/orders/" + a.id + "/accept", { total: 20, delivery: 0, hash: pvW.j.hash, oneOff: WHY });
  const dA = draftOf(a.id), pA = preOf(a.id, "ack"), oA = await orderOf(a.id);
  ok(ac.status === 200 && ac.j.approved === true && pA && pA.status === "applied" && dA && dA.status === "approved" && oA.status === "acknowledged" && oA.total === 20,
    "Accept with the reason is one tap: the row is drafted, his yes approves it, and the order is agreed at RM 20: " + JSON.stringify({ st: ac.status, e: ac.j.error, pre: pA && pA.status, d: dA && dA.status, o: oA.status }));
  ok(dA && same(dA.row.oneOff, MARK_UNDER) && dA.flags.includes(FLAG_UNDER) && same(dA.entry.payload.oneOff, MARK_UNDER),
    "the drafted row carries oneOff {why, side, by} from its entry, and its card the One-off flag: " + JSON.stringify(dA && { row: dA.row.oneOff, flags: dA.flags.filter((f) => /One-off/.test(f)), entry: dA.entry.payload.oneOff }));

  /* 7. A PRICE INSIDE THE BAND TAKES NO MARK, reason or none */
  const b = await place("B", "salt", 1, 120);
  const pvIn = await call("/orders/" + b.id + "/preview", { total: 100, oneOff: WHY });
  ok(pvIn.status === 200 && pvIn.j.row.total === 100 && pvIn.j.row.oneOff === undefined && !(pvIn.j.flags || []).some((f) => /One-off/.test(f)),
    "a price inside the band is drafted unmarked even when a reason is sent with it: " + JSON.stringify({ st: pvIn.status, row: pvIn.j.row, e: pvIn.j.error }));

  /* 8. A BOOK WITH NO BAND REFUSES AS IT ALWAYS DID: under its Floor in the old words with no `outside`, a reason changing nothing; and it knows no Ceiling */
  const c = await place("C", "oil", 10, 130);
  const oilU = await call("/orders/" + c.id + "/preview", { total: 50 }), oilW = await call("/orders/" + c.id + "/preview", { total: 50, oneOff: WHY });
  const oilO = await call("/orders/" + c.id + "/preview", { total: 900, oneOff: WHY });
  const OLD = "RM 50 is under the floor of RM 70 at 10 unit, so it cannot be set";
  ok(oilU.status === 409 && oilU.j.error === OLD && oilU.j.underFloor === true && oilU.j.outside === undefined && same(oilU.j, oilW.j)
    && oilO.status === 200 && oilO.j.row.total === 900 && oilO.j.row.oneOff === undefined,
    "oil, with no band, refuses under its Floor in the words it always had, reason or none, and takes any price over it unmarked: " + JSON.stringify([oilU.j, oilW.status, oilO.status, oilO.j.row && oilO.j.row.oneOff]));

  /* 9. OVER THE CEILING IS A RAISE, SO IT GOES TO THEM FOR THEIR YES: the offer is asked the same way, carries his reason on his own yes, and the
     row their yes drafts is marked; their page reads the offer's figure and nothing of the reason */
  const d = await place("D", "salt", 1, 120);
  const pvD = await call("/orders/" + d.id + "/preview", { total: 195, oneOff: "Rare lot, agreed by phone" });
  const ofNo = await call("/orders/" + d.id + "/offer", { total: 195, delivery: 0, hash: pvD.j.offerHash, rid: rid() });
  const of = await call("/orders/" + d.id + "/offer", { total: 195, delivery: 0, hash: pvD.j.offerHash, rid: rid(), oneOff: "Rare lot, agreed by phone" });
  const sD = await orderOf(d.id), viewD = JSON.stringify(O.customerView(sD));
  ok(ofNo.status === 409 && ofNo.j.error === SAY_OVER && ofNo.j.outside && of.status === 200 && sD.price && sD.price.state === "offered" && sD.price.offer.total === 195,
    "an offer over the Ceiling is asked without a reason and filed with one: " + JSON.stringify({ no: [ofNo.status, ofNo.j.error], of: [of.status, of.j.error], st: sD.price && sD.price.state }));
  const take = await O.customerMove(senv, WHO.D[1], d.id, "take", { rid: rid(), offer: sD.price.offer.id });
  await deskPass(denv, new Date());
  const dD = draftOf(d.id), pD = preOf(d.id, "ack"), MARK_OVER = { why: "Rare lot, agreed by phone", side: "over", by: 20 };
  ok(!take.error && dD && dD.status === "approved" && pD && pD.status === "applied" && dD.row.total === 195 && same(dD.row.oneOff, MARK_OVER)
    && dD.flags.includes("One-off: RM 20 over the Ceiling, his reason: Rare lot, agreed by phone."),
    "their yes drafts the row at his offer, marked a one-off with the reason he gave when he made it, and his yes approves it: "
    + JSON.stringify({ take: take.error, d: dD && [dD.status, dD.row.total, dD.row.oneOff], pre: pD && pD.status }));

  /* and Negotiate's own offer, on a price they asked for: asked the same way, and his yes keeps the marked row he was shown (his alone) */
  const i = (await O.placeOrder(senv, WHO.B[1], { product: "salt", qty: 1, mode: "collect", place: "", unit: 120, total: 120, week: "", ask: true, rid: rid() })).order;
  const pvI = await call("/orders/" + i.id + "/preview", { total: 195, oneOff: "Rare lot, agreed by phone" });
  const ngNo = await call("/orders/" + i.id + "/offer", { total: 195, delivery: 0, hash: pvI.j.offerHash, rid: rid() });
  const ng = await call("/orders/" + i.id + "/offer", { total: 195, delivery: 0, hash: pvI.j.offerHash, rid: rid(), oneOff: "Rare lot, agreed by phone" });
  const pI = preOf(i.id, "ack"), shownI = pI ? JSON.parse(pI.shown) : {};
  ok(ngNo.status === 409 && ngNo.j.error === SAY_OVER && ng.status === 200 && pI && pI.status === "waiting" && shownI.row && same(shownI.row.oneOff, MARK_OVER),
    "his offer on a price they asked for is asked the same way, and with his reason his yes keeps the marked row: " + JSON.stringify({ no: [ngNo.status, ngNo.j.error], ng: [ng.status, ng.j.error], row: shownI.row }));

  /* 10. AN AMENDMENT OUTSIDE THE BAND IS ASKED THE SAME WAY, on either side; with his reason the Correction carries the mark beside its fields */
  const agreed = async (who, row, product) => {
    seed(row); open = DR.withPending(open, row); setState("OPEN", open.state.OPEN);
    const o = await place(who, product || "salt", row.qty, row.total);
    await O.deskMove(senv, WHO[who][1], o.id, { status: "acknowledged", mode: "collect" });
    await O.deskMove(senv, WHO[who][1], o.id, { mark: { ledgerKey: PE.ovKey(row), ack: "2026-11-05T01:00:00.000Z" } });
    return o;
  };
  const e = await agreed("E", { rid: "s901", customer: WHO.E[0], date: "2026-11-05", qty: 1, total: 120, cash: 0 });
  const rsO = await call("/orders/" + e.id + "/restate", { total: 195 }), rsU = await call("/orders/" + e.id + "/restate", { total: 20 });
  ok(rsO.status === 409 && rsO.j.error === SAY_OVER && same(rsO.j.outside, { side: "over", by: 20, floor: 65, ceiling: 175 }) && rsO.j.underFloor === undefined
    && rsU.status === 409 && rsU.j.error === SAY_UNDER && rsU.j.underFloor === true && rsU.j.outside.side === "under" && !preOf(e.id, "amend") && (await orderOf(e.id)).total === 120,
    "an amendment of an agreed order to a goods total outside the band is asked on either side, and nothing is filed: " + JSON.stringify([rsO.status, rsO.j.error, rsU.status, rsU.j.error]));
  const rsW = await call("/orders/" + e.id + "/restate", { total: 195, oneOff: "Rare lot, agreed by phone" });
  await deskPass(denv, new Date());
  const dE = draftOf(e.id), pE = preOf(e.id, "amend");
  ok(rsW.status === 200 && dE && same(dE.entry.payload.oneOff, MARK_OVER) && dE.entry.payload.fields.total === 195 && dE.flags.includes("One-off: RM 20 over the Ceiling, his reason: Rare lot, agreed by phone.")
    && dE.status === "approved" && pE && pE.status === "applied",
    "with his reason the amendment is one tap: its Correction carries the mark beside its fields, its card the flag, and his yes approves it: "
    + JSON.stringify({ st: rsW.status, e: rsW.j.error, entry: dE && dE.entry.payload, flags: dE && dE.flags, d: dE && dE.status, pre: pE && pE.status }));

  /* his yes to an amendment answers its mark too: the digest moves when the mark is set, changed or cleared, and is as it was with none */
  const eAm = { kind: "Correction", party: WHO.E[0], orderKey: "k", date: "2026-11-10", cash: 0, kg: 0, fields: { total: 195 } }, dAm = { amendKind: null, flags: [] };
  const hNone = await DR.stageDigest("amend", { payload: eAm }, dAm), hMark = await DR.stageDigest("amend", { payload: { ...eAm, oneOff: MARK_OVER } }, dAm);
  const hOther = await DR.stageDigest("amend", { payload: { ...eAm, oneOff: { ...MARK_OVER, why: "Another reason" } } }, dAm), hNull = await DR.stageDigest("amend", { payload: { ...eAm, oneOff: null } }, dAm);
  ok(new Set([hNone, hMark, hOther, hNull]).size === 4, "an amendment's digest moves with its one-off mark, set, reworded or cleared: " + JSON.stringify([hNone, hMark, hOther, hNull].map((x) => x.slice(0, 8))));

  /* 11. THE FOLD PUTS THE MARK ON THE ROW AND TAKES IT OFF: applyAmend reads the Correction's mark beside its fields, null clears it, any other shape
     is refused, a purchase takes none, and the step keeps the mark it replaced */
  const rowE = { rid: "s901", customer: WHO.E[0], date: "2026-11-05", qty: 1, total: 120, cash: 0 };
  applyAmend(rowE, { date: "2026-11-10", kind: "Correction", cash: 0, kg: 0, fields: { total: 195 }, oneOff: MARK_OVER }, "SELL", "amended");
  const marked = JSON.parse(JSON.stringify(rowE));
  applyAmend(rowE, { date: "2026-11-10", kind: "Correction", cash: 0, kg: 0, fields: { total: 120 }, oneOff: null }, "SELL", "amended");
  let threw = "";
  try { applyAmend({ ...marked, amend: [] }, { date: "2026-11-10", kind: "Correction", cash: 0, kg: 0, fields: { total: 190 }, oneOff: { why: WHY, side: "under", by: 45, extra: 1 } }, "SELL", "x"); } catch (err) { threw = err.message; }
  const lot = { rid: "p901", supplier: "SP1-ZED", date: "2026-11-05", qty: 10, total: 500, cash: 0 };
  applyAmend(lot, { date: "2026-11-10", kind: "Correction", cash: 0, kg: 0, fields: { total: 510 }, oneOff: MARK_OVER }, "BUY", "amended");
  ok(marked.total === 195 && same(marked.oneOff, MARK_OVER) && rowE.total === 120 && rowE.oneOff === undefined && same(rowE.amend[rowE.amend.length - 1].oneOffWas, MARK_OVER) && rowE.amend[rowE.amend.length - 2].oneOffWas === undefined
    && /one-off mark/.test(threw) && lot.oneOff === undefined,
    "the fold's writer sets the mark from the Correction, clears it on null keeping what it replaced on the step, refuses a mark of another shape and marks no purchase: "
    + JSON.stringify({ marked: marked.oneOff, cleared: rowE.oneOff, was: rowE.amend.map((s) => s.oneOffWas || null), threw, lot: lot.oneOff }));

  /* 12. BACK INSIDE THE BAND, THE MARK COMES OFF: an amendment of a marked row to a figure inside the band carries oneOff null and says so; an
     amendment of an unmarked row inside the band carries no mark at all */
  const f = await agreed("F", { rid: "s902", customer: WHO.F[0], date: "2026-11-06", qty: 1, total: 195, cash: 0, oneOff: MARK_OVER });
  const rsIn = await call("/orders/" + f.id + "/restate", { total: 130 });
  const g = await agreed("G", { rid: "s903", customer: WHO.G[0], date: "2026-11-07", qty: 1, total: 120, cash: 0 });
  const rsPlain = await call("/orders/" + g.id + "/restate", { total: 125 });
  await deskPass(denv, new Date());
  const dF = draftOf(f.id), dG = draftOf(g.id);
  ok(rsIn.status === 200 && dF && dF.entry.payload.oneOff === null && dF.flags.includes(ONE.ONE_OFF_CLEARED)
    && rsPlain.status === 200 && dG && !("oneOff" in dG.entry.payload) && !dG.flags.some((x) => /one-off/i.test(x)),
    "an amendment that brings a one-off row back inside the band clears the mark and says so, and one on an unmarked row carries none: "
    + JSON.stringify({ in: [rsIn.status, rsIn.j.error, dF && dF.entry.payload.oneOff, dF && dF.flags], plain: [rsPlain.status, dG && Object.keys(dG.entry.payload)] }));

  /* 13. AN AMENDMENT ON A BOOK WITH NO BAND keeps the old refusal, reason or none */
  const h = await agreed("H", { rid: "s904", customer: WHO.H[0], product: "oil", date: "2026-11-07", qty: 10, total: 130, cash: 0 }, "oil");
  const rsOil = await call("/orders/" + h.id + "/restate", { total: 50 }), rsOilW = await call("/orders/" + h.id + "/restate", { total: 50, oneOff: WHY });
  ok(rsOil.status === 409 && rsOil.j.error === OLD && rsOil.j.outside === undefined && rsOil.j.underFloor === undefined && same(rsOil.j, rsOilW.j) && !preOf(h.id, "amend"),
    "an oil order amended under its Floor is refused in the old words with nothing to ask, a reason changing nothing: " + JSON.stringify([rsOil.j, rsOilW.j]));

  /* 14. THE REASON IS HIS ALONE: nothing the Desk sent the site, nothing the site keeps of any order and no customer's view holds either reason,
     the mark's name or the flag */
  const kept = JSON.stringify(await O.allOrders(senv, true)) + [...skv.values.values()].join(" ") + sent.join(" ");
  const views = JSON.stringify((await O.allOrders(senv, true)).map((o) => O.customerView(o))) + viewD;
  ok(sent.length > 4 && !/sample for the chef|Rare lot|oneOff|One-off/.test(kept) && !/sample for the chef|Rare lot|oneOff|One-off|outside/.test(views),
    "neither reason, the mark nor its flag is in anything sent to the site, kept there or read by a customer: " + sent.length + " sends read");

  /* 15. THE EVIDENCE LEAVES A ONE-OFF OUT: their usual and their rates read the rows they paid at their own price, never the marked one */
  const paid = (rid0, total, extra) => Object.assign({ rid: rid0, customer: "CQ9-EV", date: "2026-10-0" + rid0.slice(-1), qty: 1, total, cash: total, deliveredQty: 1, deliveredOn: "2026-10-09", paidOn: "2026-10-09" }, extra || {});
  const evBook = { sales: [paid("s1", 120), paid("s2", 120), paid("s3", 120), paid("s4", 20, { oneOff: MARK_UNDER })], purchases: [], state: {} };
  const usual = DR.usualFor(evBook, { customer: "CQ9-EV", qty: 1, total: 120 }), rates = DR.theirRates(evBook, "CQ9-EV", "salt"), recent = DR.recentRates(evBook, "CQ9-EV", "salt");
  ok(usual.orders === 3 && usual.rate === 120 && usual.uniform === true && same(rates, [120, 120, 120]) && recent.length === 3 && recent.every((r) => r.rate === 120),
    "their usual, their rates and their recent prices leave the one-off row out: " + JSON.stringify({ usual, rates, recent }));

  /* 16. SALT ADMIN'S BRIDGE CARRIES THE ASK AND THE REASON: the Counter's maker road relays `outside` (and underFloor) with the sentence, and passes
     oneOff to the Desk on the preview and on an amendment */
  const ident = { email: "maakmal97@icloud.com" };
  const maker = async (path, body) => {
    const r = await handleMaker(new Request("https://counter.test" + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), senv, path, ident);
    return { status: r.status, j: await r.json().catch(() => ({})) };
  };
  const mPv = await maker("/all/maker/orders/" + b.id + "/preview", { total: 20, delivery: 0 });
  const mPvW = await maker("/all/maker/orders/" + b.id + "/preview", { total: 20, delivery: 0, oneOff: WHY });
  const mRs = await maker("/all/maker/orders/" + g.id + "/restate", { total: 400, rid: rid() });
  /* with the reason the tap is reached, which refuses for its own cause (G's earlier amendment is not on the book yet), never for the key */
  const mRsW = await maker("/all/maker/orders/" + g.id + "/restate", { total: 400, rid: rid(), oneOff: WHY });
  ok(mPv.status === 409 && mPv.j.error === SAY_UNDER && mPv.j.underFloor === true && same(mPv.j.outside, { side: "under", by: 45, floor: 65, ceiling: 175 })
    && mPvW.status === 200 && same(mPvW.j.row.oneOff, MARK_UNDER)
    && mRs.status === 409 && mRs.j.outside && mRs.j.outside.side === "over" && /over the Ceiling of RM 175 at 1 unit/.test(mRs.j.error)
    && mRsW.status === 409 && !mRsW.j.outside && /earlier amendment/.test(mRsW.j.error),
    "Salt Admin's road relays the ask with its figures and carries his reason to the Desk: " + JSON.stringify({ pv: [mPv.status, mPv.j], w: [mPvW.status, mPvW.j.error], rs: [mRs.status, mRs.j], rsW: [mRsW.status, mRsW.j] }));

  /* ---- 17 to 19. SALT ADMIN'S PAGE, in the actual owner script: the Reason field and Let it stand on a placed order and on Change the order ---- */
  const posts = [], fails = { n: 0 };
  const PL = "20261110090001-pla", AG = "20261110090002-ack", RAISE = "20261110090003-pla";
  const orderFix = (id, status, patch = {}) => ({ id, u: "abcd-efgh", product: "salt", qty: 1, total: 120, status, mode: "collect", history: [], ...patch });
  const reviewBody = { ok: true, drafts: [], orders: [orderFix(PL, "placed"), orderFix(AG, "acknowledged"), orderFix(RAISE, "placed")] };
  const asked = (side) => ({ ok: false, error: side === "under" ? SAY_UNDER : SAY_OVER, outside: side === "under" ? { side, by: 45, floor: 65, ceiling: 175 } : { side, by: 20, floor: 65, ceiling: 175 }, ...(side === "under" ? { underFloor: true } : {}) });
  const browser = new JSDOM(landingPage("", "fixture", { master: "local-master", accounts: [] }), {
    url: "https://counter.fixture.test/all", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(window) {
      Object.defineProperty(window, "crypto", { value: { getRandomValues: (x) => webcrypto.getRandomValues(x), randomUUID: () => webcrypto.randomUUID(), subtle: webcrypto.subtle } });
      window.TextEncoder = TextEncoder; window.TextDecoder = TextDecoder;
      window.scrollTo = () => {};
      window.fetch = async (path, init) => {
        if (init && init.method === "POST" && String(path).startsWith("/all/maker/orders/")) {
          const body = JSON.parse(init.body), kind = String(path).split("/").pop();
          posts.push({ kind, path: String(path), body });
          const out = body.total < 65 ? "under" : body.total > 175 ? "over" : null;
          if (kind === "preview" && fails.n > 0) { fails.n--; return Response.json({ ok: false, error: "The Desk is not answering." }, { status: 503 }); }
          if ((kind === "preview" || kind === "accept" || kind === "restate") && out && !body.oneOff) return Response.json(asked(out), { status: 409 });
          if (kind === "preview") return Response.json({ ok: true, hash: "h-" + posts.length, offerHash: "o-" + posts.length, quote: body.total, delivery: 0, row: { qty: 1, total: body.total },
            cost: { unit: 50, total: 50, source: "purchase" }, card: 120, floor: { rm: 65, at: 1, exact: true }, margin: { rm: body.total - 50, pct: 0 },
            flags: body.oneOff && out ? ["One-off: RM 45 under the Floor, his reason: " + body.oneOff + "."] : [] });
          return Response.json({ ok: true });
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
    const win = browser.window, doc = win.document;
    const until = async (predicate) => { for (let i = 0; i < 300 && !predicate(); i++) await new Promise((resolve) => setTimeout(resolve, 10)); return !!predicate(); };
    const card = (id) => cardOf(doc, id);
    const fire = (node, type) => node.dispatchEvent(new win.Event(type, { bubbles: true }));
    const of1 = (kind, id) => posts.filter((p) => p.kind === kind && p.path.includes(id));
    doc.querySelector('[data-act="nav.orders"]').click();
    await until(() => doc.querySelector('[data-act="order.open"]'));
    await until(() => card(PL) && card(PL).querySelector("[data-accept]"));
    const total = card(PL).querySelector('[data-act="order.total"]');
    total.value = "20"; fire(total, "input"); fire(total, "change");
    await until(() => card(PL).querySelector("[data-one-off]"));
    const why = card(PL).querySelector("[data-one-off]"), go = card(PL).querySelector("[data-one-off-go]");
    const label = why && why.closest("label") && why.closest("label").querySelector("span");
    /* 17. the ask on a placed order: the Desk's own sentence, one Reason line (required, 120 at most) and Let it stand, which waits for a reason; no Agree */
    ok(!!why && !!go && card(PL).textContent.includes(SAY_UNDER) && label && label.textContent === "Reason" && why.type === "text" && why.required && why.maxLength === 120
      && go.textContent === "Let it stand" && go.disabled === true && !card(PL).querySelector("[data-accept]"),
      "a placed order priced outside the band shows the Desk's sentence, a Reason line and Let it stand, greyed until a reason is typed, and no Agree: "
      + JSON.stringify({ why: !!why, go: go && [go.textContent, go.disabled], said: card(PL) && card(PL).textContent.includes(SAY_UNDER) }));
    /* 18. Let it stand reads the same figures again with his reason, the reading shows the one-off in its flags, and Agree sends the same reason */
    why.value = "ab"; fire(why, "input");
    const short = go.disabled;
    why.value = "  " + WHY + " "; fire(why, "input");
    const ready = !go.disabled;
    go.click();
    await until(() => card(PL).querySelector("[data-accept]"));
    const pvs = of1("preview", PL), lastPv = pvs[pvs.length - 1];
    const saidFlag = card(PL).textContent.includes("One-off: RM 45 under the Floor, his reason: " + WHY + ".");
    card(PL).querySelector("[data-accept]").click();
    await until(() => of1("accept", PL).length > 0);
    const said = (re) => [...doc.querySelectorAll("[data-maker-say], #makerReviewStatus")].some((x) => re.test(x.textContent));
    await until(() => said(/Agreed and sent to the Desk/));   /* the tap has landed, so the page takes the next one */
    const acP = of1("accept", PL)[0];
    ok(short === true && ready === true && lastPv && lastPv.body.total === 20 && lastPv.body.oneOff === WHY && saidFlag
      && acP && acP.body.total === 20 && acP.body.oneOff === WHY && acP.body.hash === "h-" + (posts.indexOf(lastPv) + 1),
      "Let it stand reads the figures again with the reason, the reading says the one-off, and Agree sends that reason with the digest it read: "
      + JSON.stringify({ short, ready, pv: lastPv && lastPv.body, flag: saidFlag, accept: acP && acP.body }));
    /* 19. Change the order: an amendment the Desk asks about opens the Sheet again with its sentence and a Reason line, and Let it stand sends the
       same figures with the reason under a request id of its own */
    await until(() => card(AG) && [...card(AG).querySelectorAll("button")].find((x) => x.textContent === "Change the order"));
    [...card(AG).querySelectorAll("button")].find((x) => x.textContent === "Change the order").click();
    const sheet = () => doc.getElementById("ynSheet");
    const fieldOf = (text) => { const w = sheet() && [...sheet().querySelectorAll("label")].find((l) => l.querySelector(".salt-field__label") && l.querySelector(".salt-field__label").textContent === text); return w && w.querySelector("input"); };
    fieldOf("Price (goods)").value = "195";
    doc.getElementById("ynGo").click();
    await until(() => !!fieldOf("Reason"));
    const rs1 = of1("restate", AG)[0], reason = fieldOf("Reason"), goS = doc.getElementById("ynGo");
    const drawn = !!reason && sheet().textContent.includes(SAY_OVER) && goS.textContent === "Let it stand" && goS.disabled === true && reason.maxLength === 120 && reason.required;
    reason.value = "Rare lot, agreed by phone"; fire(reason, "input");
    const lit = !goS.disabled;
    goS.click();
    await until(() => of1("restate", AG).length > 1);
    const rs2 = of1("restate", AG)[1];
    ok(drawn && lit && rs1 && rs1.body.total === 195 && rs1.body.oneOff === undefined && rs2 && rs2.body.total === 195 && rs2.body.oneOff === "Rare lot, agreed by phone"
      && /^[0-9a-f]{32}$/.test(rs2.body.rid) && rs2.body.rid !== rs1.body.rid,
      "an amendment outside the band opens the Sheet again with the Desk's sentence and a Reason line, and Let it stand sends the same figures with it: "
      + JSON.stringify({ drawn, lit, first: rs1 && rs1.body, second: rs2 && rs2.body }));
    /* 20. a raise over the Ceiling goes to them for their yes, and Ask them sends his reason with the offer's own digest */
    await until(() => said(/Change sent/));
    await until(() => card(RAISE) && card(RAISE).querySelector("[data-accept]"));
    const up = card(RAISE).querySelector('[data-act="order.total"]');
    up.value = "195"; fire(up, "input"); fire(up, "change");
    await until(() => card(RAISE).querySelector("[data-one-off]"));
    const askedOver = card(RAISE).textContent.includes(SAY_OVER), whyUp = card(RAISE).querySelector("[data-one-off]");
    whyUp.value = "Rare lot, agreed by phone"; fire(whyUp, "input");
    card(RAISE).querySelector("[data-one-off-go]").click();
    await until(() => card(RAISE).querySelector("[data-accept]"));
    const pvUp = of1("preview", RAISE).pop(), askThem = card(RAISE).querySelector("[data-accept]");
    const words = askThem.textContent, act = askThem.getAttribute("data-act");
    askThem.click();
    await until(() => of1("offer", RAISE).length > 0);
    const ofP = of1("offer", RAISE)[0];
    ok(askedOver && pvUp.body.oneOff === "Rare lot, agreed by phone" && /^Ask them, /.test(words) && act === "order.send-yes"
      && ofP && ofP.body.total === 195 && ofP.body.oneOff === "Rare lot, agreed by phone" && ofP.body.hash === "o-" + (posts.indexOf(pvUp) + 1) && of1("accept", RAISE).length === 0,
      "a raise over the Ceiling is asked the same way, and Ask them sends the offer with his reason and the digest it read: "
      + JSON.stringify({ askedOver, words, act, offer: ofP && ofP.body }));
    /* 21. a reason is for the price it was given for: a new goods total is read without it, and asked afresh on an empty line */
    await until(() => said(/Sent to them for their yes/));
    await until(() => card(RAISE) && card(RAISE).querySelector("[data-accept]"));
    const again = card(RAISE).querySelector('[data-act="order.total"]');
    again.value = "30"; fire(again, "input"); fire(again, "change");
    await until(() => card(RAISE).querySelector("[data-one-off]"));
    const pvNew = of1("preview", RAISE).pop(), fresh = card(RAISE).querySelector("[data-one-off]");
    ok(pvNew.body.total === 30 && pvNew.body.oneOff === undefined && fresh && fresh.value === "",
      "a new goods total is read without the old reason and asked afresh: " + JSON.stringify({ body: pvNew.body, line: fresh && fresh.value }));
    /* 22. (12 Nov 2026, his screenshot of an ask under the Floor) THE PILL SAYS WHAT THE ASK WAITS FOR: Give a reason, a button that sends nothing and
       puts him on the Reason line, never the greyed Figures not read */
    const waitOf = (id) => card(id).querySelector("[data-accept-wait]");
    const pill = waitOf(RAISE), sentBefore = posts.length;
    if (pill) pill.click();
    ok(!!pill && pill.textContent === "Give a reason" && pill.disabled === false && doc.activeElement === fresh && posts.length === sentBefore
      && !/Figures not read/.test(card(RAISE).textContent),
      "while a reason is asked the pill says Give a reason, and its tap puts him on the Reason line and sends nothing: "
      + JSON.stringify({ pill: pill && [pill.textContent, pill.disabled], on: doc.activeElement && doc.activeElement.getAttribute("data-act"), sent: posts.length - sentBefore }));
    /* 23. A READ THAT FAILED IS READ AGAIN BY THE PILL ITSELF: it says so, is never greyed, and its tap reads the same figures once more */
    fails.n = 1;
    again.value = "150"; fire(again, "input"); fire(again, "change");
    await until(() => waitOf(RAISE) && waitOf(RAISE).textContent === "Read the figures again");
    const retry = waitOf(RAISE), readsBefore = of1("preview", RAISE).length, lit23 = !!retry && retry.textContent === "Read the figures again" && retry.disabled === false && !card(RAISE).querySelector("[data-accept]");
    if (retry) retry.click();
    await until(() => card(RAISE).querySelector("[data-accept]"));
    const pvRetry = of1("preview", RAISE).pop();
    ok(lit23 && of1("preview", RAISE).length === readsBefore + 1 && pvRetry.body.total === 150 && !!card(RAISE).querySelector("[data-accept]") && !waitOf(RAISE),
      "a read that failed leaves the pill saying Read the figures again, lit, and its tap reads the same figures and brings the answer back: "
      + JSON.stringify({ pill: retry && [retry.textContent, retry.disabled], reads: of1("preview", RAISE).length - readsBefore, body: pvRetry && pvRetry.body, accept: !!card(RAISE).querySelector("[data-accept]") }));
  } catch (err) { ok(false, "Salt Admin's page stopped on an error: " + (err && err.stack || err)); } finally { browser.window.close(); }
}
