/* test/ledger-plain.mjs: THE LEDGER CHECK'S THREE DIFFERENCES (20 Nov 2026, his word: "find what it is, and why is it not in plain language, and fix
 * them, and make sure they are future-proof too"). One live order, paid and delivered on the site, stood on the book unpaid and undelivered: its price
 * was changed after Accept, the row took the new figure's key, and the order never followed, because a CANCELLED order of the same customer, day and
 * figure already named that key. Every later tap on it waited for a row that had landed, and the check said so in ids, keys and "your yes".
 *   F1  a live order follows its row onto a key a cancelled order names, and the cash he tapped is pointed at the row
 *   F2  not while the cancelled order's row is still live (two rows at the key), and never onto a key another live order names
 *   F3  followFree alone: an ended order's own move is weighed against every order, as before
 *   T1  the stuck order is ONE difference, named by code, book, size, total and day; its taps are held, not lost; no id, key, "row" or "yes"
 *   T2  a cancelled order whose sale on the book is still live is a difference, whoever else names its key
 *   D1  the drafter finds the key's one live site row beside cancelled rows, so the handover of an order that followed can be drafted
 *   T3  every sentence the check can say is plain: figures, ends, write-offs, twins, a rejected sale, a stale tap
 *   T4  oneAnOrder joins an order's sentences and leaves the orders-behind item alone
 *   P1  Salt Admin draws who and the sentences, never the order's id; the orders-behind item is its plain sentence; the book is "revision N"
 * Every assertion is red under its own mutation (test/ledger-plain.mutations.json). */
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import POSITION_ENGINE from "../engine/position.mjs";
import { frozenBook } from "./frozen.mjs";
import { richOwnerPage, byAct } from "./maker-act.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const V = "v1552", J = JSON.stringify;
const CODE = "ZZ1-AAA", BUCKET = "ZZ1-AAA-R", DAY = "2026-11-18";
const LIVE = "20261118135922-aaaaaa", GONE = "20261118131627-bbbbbb";
const key = (customer, total, delivery, product = "oil", date = DAY) => POSITION_ENGINE.ovKey({ customer, date, total, delivery, product });
const K130 = key(BUCKET, 130, 0), K110 = key(BUCKET, 110, 0);
const row = (over) => Object.assign({ customer: BUCKET, date: DAY, product: "oil", qty: 10, total: 110, delivery: 0, cash: 0, deliveredQty: 0, road: "site", rev: "R2" }, over || {});
const order = (over) => Object.assign({ id: LIVE, u: "u1", status: "done", mode: "deliver", product: "oil", forFriend: true, qty: 10, total: 110, delivery: 0, paid: 110, moved: 10,
  at: "2026-11-18T13:59:22.294Z", ledgerKey: K130, queued: { ack: "2026-11-18T14:00:00.568Z", paid: 110 }, history: [], payments: [] }, over || {});
const gone = (over) => order(Object.assign({ id: GONE, status: "cancelled", paid: 0, moved: 0, ledgerKey: K110, at: "2026-11-18T13:16:27.875Z", queued: { ack: "2026-11-18T13:16:30.757Z", cancel: "2026-11-18T13:57:46.196Z" } }, over || {}));
/* what the check must never say to him: an order's id, a key, or the desk's own words for its parts */
const JARGON = /\|| \d{14}-[a-z0-9]{6}|\b(rows?|keys?|yes|yeses|preapproval|ledgerKey|draft)\b/i;

export async function run({ ok, pageWork }) {
  const { buildSeed } = await import("../tools/d1.mjs");
  const { tellSite, tieOut, followFree, oneAnOrder, tieWho, sayDay } = await import("../src/orders.js");
  const { findRow } = await import("../src/drafter.js");
  const world = () => {
    const db = new DatabaseSync(":memory:");
    for (const f of readdirSync(join(REPO, "migrations")).filter((x) => /^\d+_.*\.sql$/.test(x)).sort()) db.exec(readFileSync(join(REPO, "migrations", f), "utf8"));
    const { NOTES, ...bookless } = frozenBook();
    db.exec(buildSeed({ v: V, stamped: "20 Nov 2026, 03:00 KL", ledger: { ...bookless, PRICING: { v: V, floors: {}, sizes: [1] }, OPEN: { v: V, count: 0, byKey: {} }, TERMS: {}, REWARD: { stated: {} }, STOCK: { books: {} } } }).sql);
    db.exec("UPDATE snapshot SET at='2026-11-19T23:00:00.000Z'");
    const mkq = (a, sql) => { const st = db.prepare(sql); return { run() { const x = st.run(...a); return { meta: { changes: Number(x.changes || 0) } }; }, first() { const x = st.get(...a); return x === undefined ? null : x; }, all() { return { results: st.all(...a) }; } }; };
    const D1 = { prepare(sql) { const o = mkq([], sql); o.bind = (...a) => mkq(a, sql); return o; } };
    const draft = (id, oid, over = {}) => db.prepare("INSERT INTO draft (id,status,collection,entry,row,reasoning,flags,party,drafter,drafted_at,decided_at,decided_by,amends,committed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(id, over.status || "approved", "sales", J(Object.assign({ at: id, orderId: oid }, over.entry || {})), "{}", "r", "[]", BUCKET, "t", id, id, "t", over.amends || null, over.committed === null ? null : "2026-11-18T19:26:24.375Z");
    const yes = (oid, stage, at, entry) => db.prepare("INSERT INTO preapproval (id,order_id,u,stage,hash,shown,entry,status,at) VALUES (?,?,?,?,?,?,?,?,?)")
      .run(oid + "|" + stage + "|" + at, oid, "u1", stage, "h", "{}", entry ? J(entry) : null, "waiting", at);
    return { db, D1, draft, yes };
  };
  const kv = (m = new Map()) => ({ m, get: async (k, t) => (m.has(k) ? (t === "json" ? JSON.parse(m.get(k)) : m.get(k)) : null), put: async (k, v) => { m.set(k, v); }, delete: async (k) => { m.delete(k); } });
  /* the site: its orders, and every mark the desk writes, taken as the order book takes one */
  const envOf = (W, orders, told = "v1") => {
    const q = kv(); q.m.set("stmt-users", J({ u1: CODE })); q.m.set("orders:told", told); q.m.set("orders:fixed", "{}");
    const marks = [];
    const STMT_SITE = { fetch: async (url, init) => {
      if (String(url).includes("/desk/orders?")) return Response.json({ ok: true, orders });
      const id = decodeURIComponent(String(url).split("/").pop()), o = orders.find((x) => x.id === id), b = init && init.body ? JSON.parse(init.body) : {};
      if (o && b.mark) { marks.push({ id, mark: b.mark }); Object.assign(o, b.mark); }
      return Response.json({ ok: true, order: o || null });
    } };
    return { env: { SALT_LEDGER: W.D1, SALT_QUEUE: q, STMT_SITE, STMT_DESK_KEY: "k" }, marks, orders };
  };
  /* the order as it stood on 20 Nov 2026: its pending row and its amendment landed, the cash and the handover he tapped still waiting */
  const stuck = (sales) => {
    const W = world();
    W.draft("2026-11-18T14:00:00.568Z", LIVE);
    W.draft("2026-11-18T14:40:12.109Z", LIVE, { amends: "s395", entry: { status: "Amendment" } });
    W.draft("2026-11-18T13:16:30.757Z", GONE);
    W.yes(LIVE, "cash", "2026-11-18T15:14:08.357Z", { at: "2026-11-18T15:14:08.357Z", party: BUCKET, payload: { mode: "amend", party: BUCKET, orderKey: K130 }, orderId: LIVE });
    W.yes(LIVE, "move", "2026-11-18T16:07:12.558Z", null);
    return { W, mirror: async () => ({ version: V, sales, state: { OPEN: { byKey: {} } } }) };
  };
  const live395 = () => row({ rid: "s395" }), dead393 = () => row({ rid: "s393", cancelled: true, cancelledOn: DAY });
  const NOW = new Date("2026-11-20T03:00:00.000Z");
  const said = (t) => (t.faults || []).concat(t.waiting || []).flatMap((f) => [].concat(f.what || []));

  /* F1 */
  {
    const S = stuck([dead393(), live395()]), E = envOf(S.W, [order(), gone()]);
    const t = await tellSite(E.env, [], S.mirror);
    const moved = E.marks.filter((m) => m.id === LIVE && m.mark.ledgerKey).map((m) => m.mark.ledgerKey);
    ok(t.ok && t.followed === 1 && J(moved) === J([K110]) && E.orders[0].ledgerKey === K110 && E.orders[1].ledgerKey === K110,
      "F1: a live order follows its row onto the key a cancelled order of theirs names, once: " + J([t.followed, moved, t.failed]));
    const e = JSON.parse(S.W.db.prepare("SELECT entry FROM preapproval WHERE stage='cash'").get().entry);
    ok(e.payload.orderKey === K110 && e.party === BUCKET, "F1: and the cash he tapped is pointed at the row before the order takes its key: " + J(e.payload));
  }
  /* F2 */
  {
    const S = stuck([row({ rid: "s393" }), live395()]), E = envOf(S.W, [order(), gone()]);
    const t = await tellSite(E.env, [], S.mirror);
    ok(t.ok && !t.followed && E.orders[0].ledgerKey === K130, "F2: while the cancelled order's row is still live the key is two rows, and the order waits: " + J([t.followed, E.orders[0].ledgerKey]));
    const S2 = stuck([dead393(), live395()]), E2 = envOf(S2.W, [order(), gone(), order({ id: "20261118150000-cccccc", status: "acknowledged", paid: 0, moved: 0, ledgerKey: K110, queued: { ack: "2026-11-18T15:00:01.000Z" } })]);
    const t2 = await tellSite(E2.env, [], S2.mirror);
    ok(t2.ok && E2.orders[0].ledgerKey === K130, "F2: and it never takes a key another live order names: " + J([t2.followed, E2.orders[0].ledgerKey]));
  }
  /* F3 */
  {
    const a = order(), g = gone(), g2 = gone({ id: "20261118120000-dddddd", ledgerKey: K130 });
    const one = new Map([[K110, 1]]), kept = new Map([[K110, dead393()]]);
    const liveFree = followFree([a, g], [{ o: a, k: K130, nk: K110 }], one, kept)({ o: a, nk: K110 });
    const endedHeld = followFree([a, g, g2], [{ o: g2, k: K130, nk: K110 }], one, kept)({ o: g2, nk: K110 });
    const endedFree = followFree([g2], [{ o: g2, k: K130, nk: K110 }], one, kept)({ o: g2, nk: K110 });
    /* Fable's review: one row at the key and no cancelled row kept apart is the ended order's own row, still live: never the live order's to take */
    const itsOwn = followFree([a, g], [{ o: a, k: K130, nk: K110 }], one, new Map())({ o: a, nk: K110 });
    ok(itsOwn === false, "F3: a live order never passes an ended one onto a key whose one row is not beside a cancelled one: " + itsOwn);
    ok(liveFree === true && endedHeld === false && endedFree === true,
      "F3: a live order passes an ended one; an ended order's own move is weighed against every order, as it was: " + J([liveFree, endedHeld, endedFree]));
    const pair = [order({ id: "p1" }), order({ id: "p2" })], plan = pair.map((o) => ({ o, k: K130, nk: K110 }));
    ok(followFree(pair, plan, one, kept)({ o: pair[0], nk: K110 }, 2) === true && followFree(pair, plan, one, kept)({ o: pair[0], nk: K110 }) === false,
      "F3: a group moving together is counted whole, and one order alone is never let onto a key two are moving to");
  }
  /* T1 */
  {
    const S = stuck([dead393(), live395()]), E = envOf(S.W, [order(), gone()], V);
    const t = await tieOut(E.env, S.mirror, NOW), f = (t.faults || [])[0] || {}, w = f.what || [];
    ok(t.ok && t.faults.length === 1 && f.order === LIVE && f.who === BUCKET + ", Oil, 10 units, RM 110, ordered 18 Nov 2026",
      "T1: the stuck order is one difference, named by its code, book, size, total and day: " + J([t.faults.length, f.who]));
    ok(w.length === 3 && /^the Cash received you tapped on 18 Nov 2026 is held, not lost/.test(w[0]) && /^the handover you tapped on 19 Nov 2026 is held, not lost/.test(w[1])
      && w[2] === "the book has no sale for this order: it looked for one of RM 130 on 18 Nov 2026, and the order now says RM 110",
    "T1: its taps are held, not lost, each by the tap's own name and Kuala Lumpur day, and the sale it looked for is said by figure and day: " + J(w));
    ok(w.length > 0 && !w.some((x) => JARGON.test(x) || /tap it again/.test(x)) && !JARGON.test(f.who || "|"), "T1: no id, no key, no desk word, and never 'tap it again' on an order with no sale: " + J(w));
    /* once it has followed, a tap the book still lacks is said as before, by its name */
    E.orders[0].ledgerKey = K110;
    const t2 = await tieOut(E.env, S.mirror, NOW), w2 = said(t2);
    ok(w2.some((x) => /^the handover you tapped on 19 Nov 2026 never reached Approve, so the book does not hold it: tap it again on the order if it is still owed$/.test(x)) && !w2.some((x) => JARGON.test(x)),
      "T1: with its sale on the book, a tap that never reached Approve says so and what to do: " + J(w2));
  }
  /* T2 */
  {
    const W = world(), mirror = async () => ({ version: V, sales: [live395()], state: { OPEN: { byKey: {} } } });
    const E = envOf(W, [order({ ledgerKey: K110, paid: 0, moved: 0, status: "acknowledged", queued: {} }), gone({ queued: {} })], V);
    const t = await tieOut(E.env, mirror, NOW), f1 = (t.faults || []).concat(t.waiting || []).find((f) => f.order === GONE);
    const E2 = envOf(world(), [gone({ queued: {} })], V);
    const t2 = await tieOut(E2.env, mirror, NOW), f2 = (t2.faults || []).concat(t2.waiting || []).find((f) => f.order === GONE);
    ok(!!f1 && !!f2 && [f1, f2].every((f) => f.what.includes("the order is cancelled and its sale on the book is not")),
      "T2: a cancelled order whose sale is still live is a difference, with a live order naming its key or with none (Fable's review: never hidden): " + J([f1, f2]));
  }
  /* D1 */
  {
    const a = live395(), b = dead393(), hand = row({ rid: "s397", road: "hand" });
    const got = (sales) => { const f = findRow({ sales, purchases: [] }, K110); return f.row ? f.row.rid : "err"; };
    ok(got([b, a]) === "s395" && got([a, b]) === "s395", "D1: the drafter finds the key's one live site row beside a cancelled one, whatever their order: " + J([got([b, a]), got([a, b])]));
    ok(got([a, row({ rid: "s398" })]) === "err" && got([b, hand]) === "err" && got([b, row({ rid: "s399", cancelled: true })]) === "err" && got([b]) === "s393" && got([a]) === "s395",
      "D1: two live rows, a hand row beside a cancelled one and cancelled rows alone are still a judgement; a row alone at its key is found as before");
  }
  /* T3 */
  {
    const mk = (n, over) => order(Object.assign({ id: "20261118" + "10000" + n + "-eeeee" + n, queued: {}, status: "ready", paid: 0, moved: 0, forFriend: false }, over));
    const k = (total, delivery, date) => key(CODE, total, delivery, "oil", date);
    const sales = [
      row({ rid: "s1", customer: CODE, qty: 9, total: 90, delivery: 20, cash: 30, deliveredQty: 4, road: "hand" }),                 /* figures */
      row({ rid: "s2", customer: CODE, total: 210, cancelled: true }),                                                                /* the sale ended, the order not */
      row({ rid: "s3", customer: CODE, total: 310, defaulted: true }),                                                                /* written off on the book alone */
      row({ rid: "s4", customer: CODE, total: 410, road: "hand" }), row({ rid: "s5", customer: CODE, total: 410, road: "hand" }),       /* twins */
      row({ rid: "s6", customer: CODE, total: 610, qty: 20 })                                                                         /* two orders, one written off */
    ];
    const W = world(); W.draft("2026-11-18T10:00:05.000Z", "20261118100005-eeeee5", { status: "rejected", committed: null });
    const orders = [mk(1, { total: 100, delivery: 10, ledgerKey: k(100, 10) }), mk(2, { total: 210, ledgerKey: k(210, 0) }), mk(3, { total: 310, ledgerKey: k(310, 0) }), mk(4, { total: 410, ledgerKey: k(410, 0) }),
      mk(5, { total: 510, ledgerKey: k(510, 0), status: "acknowledged", queued: { ack: "2026-11-18T10:00:05.000Z" } }),
      mk(6, { total: 305, ledgerKey: k(610, 0), status: "done" }), mk(7, { total: 305, ledgerKey: k(610, 0), status: "done", writtenOff: true })];
    W.yes(orders[0].id, "pay", "2026-11-18T11:00:00.000Z", null);
    const E = envOf(W, orders, V), t = await tieOut(E.env, async () => ({ version: V, sales, state: { OPEN: { byKey: {} } } }), NOW), w = said(t);
    const want = [/^units 10 on the order, 9 on the book$/, /^goods RM 100 on the order, RM 90 on the book$/, /^delivery RM 10 on the order, RM 20 on the book$/, /^paid RM 0 on the order, RM 30 on the book$/,
      /^handed over 0 on the order, 4 on the book$/, /^its sale on the book is cancelled and the order is ready$/, /^its sale on the book is written off and the order is not$/,
      /^the book holds two sales of theirs with this day and total, so it cannot tell which is this order's$/, /^you rejected its sale under Approve: tap Accept again or cancel the order$/,
      /^some of the orders sharing its sale on the book are written off and some are not$/, /^the Received you tapped on 18 Nov 2026 never reached Approve/];
    const missing = want.filter((re) => !w.some((x) => re.test(x))).map(String);
    ok(t.ok && missing.length === 0, "T3: every kind of difference is said, each in its own sentence: missing " + J(missing) + " of " + J(w));
    const bad = w.filter((x) => JARGON.test(x)), who = (t.faults || []).concat(t.waiting || []).map((f) => f.who);
    ok(w.length >= want.length && bad.length === 0 && who.every((x) => typeof x === "string" && x.startsWith(CODE + ", Oil, ") && !JARGON.test(x)),
      "T3: and none of them carries an id, a key or a desk word; each order is named by who: " + J([bad, who.slice(0, 2)]));
    ok(sayDay("2026-11-08") === "08 Nov 2026" && sayDay("") === "an unknown day" && tieWho(null) === "an order no longer on the site" && /, 1 unit, RM 15, /.test(tieWho(order({ qty: 1, total: 10, delivery: 5 }))),
      "T3: a day is DD Mon YYYY, one unit is singular, the total is goods and delivery, and an order gone from the site is said so");
  }
  /* T4 */
  {
    const leg = { what: "return leg", why: "w", say: "s" };
    const m = oneAnOrder([{ order: "a", what: ["one"] }, leg, { order: "b", who: "B", what: ["x"] }, { order: "a", who: "A", rid: "s9", what: ["two", "one"] }]);
    ok(m.length === 3 && J(m[0]) === J({ order: "a", what: ["one", "two"], rid: "s9", who: "A" }) && m[1] === leg && m[2].who === "B",
      "T4: an order's sentences are joined in the order found, said once, and an item with no order is left as it is: " + J(m));
  }
  /* P1 */
  if (pageWork) {
    const tie = { ok: true, at: "2026-11-19T19:05:08.151Z", v: "book@594", orders: 145, clean: false, waiting: [], faults: [
      { order: LIVE, who: BUCKET + ", Oil, 10 units, RM 110, ordered 18 Nov 2026", rid: "s395", what: ["first plain sentence", "second plain sentence"] },
      { what: "return leg", why: "the Counter has not been told of book book@594", say: "the orders have not been brought up to date with the book since 19 Nov 2026" },
      { order: "20261101000000-oldold", what: ["a difference filed before the Desk said who"] }] };
    const p = await richOwnerPage({ pageWork, extra: (route) => route === "/all/maker/ledger" ? { ok: true, version: 3, orders: 9, open: [], pending: [], recent: [], tieout: tie } : undefined });
    try {
      byAct(p.d, "nav.orders").click(); await p.work.quiet();
      byAct(p.d, "part.orders.ledger").click(); await p.work.quiet();
      const lines = [...p.d.querySelectorAll("#led-tie p.maker-facts")].map((x) => x.textContent), all = p.d.getElementById("led-tie").textContent;
      ok(lines[0] === BUCKET + ", Oil, 10 units, RM 110, ordered 18 Nov 2026 · s395: first plain sentence; second plain sentence." && !all.includes(LIVE),
        "P1: a difference is drawn as who it is and its sentences, never the order's id: " + J(lines[0]));
      ok(lines[1] === "the orders have not been brought up to date with the book since 19 Nov 2026." && !/return leg|Counter has not been told/.test(all),
        "P1: the orders-behind item is its plain sentence, never the desk's own name for it: " + J(lines[1]));
      ok(lines[2] === "20261101000000-oldold: a difference filed before the Desk said who.", "P1: a check filed before the Desk said who still names its order: " + J(lines[2]));
      ok(/145 orders checked against book revision 594 at /.test(all) && !/book@/.test(all), "P1: the book is its revision number, never book@: " + J(all.slice(0, 200)));
    } catch (e) { ok(false, "P1 stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }
  }
}
