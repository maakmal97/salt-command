/* test/outbox-narrow.mjs: ITEM 4 OF THE LEDGER SIMPLIFICATION (21 Nov 2026, docs/plan-ledger-simplify.html). The outbox's forced pass tells only the orders its booked rows
 * name (src/outbox.js namesOf and onlyOf, src/orders.js onlyOrders and tellSite's only), and the regular pass stays the net. Each check red under its own mutation
 * (test/outbox-narrow.mutations.json):
 *   1  the drain reads each live draft's order, rids and amends and hands them on as only; a draft that names nothing runs the whole pass
 *   2  onlyOrders: by id, by rid, by key, by an amendment's row, and every order of a named row's owner but the cancelled and declined; nothing resolved is the whole pass
 *   3  tellSite: a forced pass tells its own order and no other, a second order of the owner its credit, a finished order of the owner its row; an order the narrowed pass
 *      missed is told by the regular pass; a narrowing that resolves to nobody runs whole
 *   4  the follow: a collision outside only still blocks a follow, an order outside only is not followed by the forced pass but is by the regular one, and a group
 *      member is still held out of the singles */
const T = (n) => "2031-01-0" + n;

export async function run({ ok }) {
  const { tellSite, onlyOrders } = await import("../src/orders.js");
  const { drainOutbox } = await import("../src/outbox.js");
  const { bindBook } = await import("../src/book-read.js");

  /* 1: the drain */
  const drainWorld = (drafts) => {
    const marks = [];
    const D1 = { prepare(sql) { let args = []; const q = { bind(...a) { args = a; return q; },
      first: async () => (/FROM book_outbox/.test(sql) ? { mode: "on" } : null),
      all: async () => ({ results: /FROM draft WHERE id IN/.test(sql) ? drafts.filter((d) => args.includes(d.id)) : [] }),
      run: async () => ({ meta: { changes: 0 } }) }; return q; } };
    const ns = { idFromName: (n) => n, get: () => ({ fetch: async (r) => {
      const path = new URL(r.url).pathname;
      if (path === "/outbox") return Response.json({ ok: true, pending: drafts.map((d, i) => ({ seq: i + 1, draft_id: d.id, at: "2031-01-01T00:00:00.000Z", tries: 0 })) });
      marks.push(path); return Response.json({ ok: true });
    } }) };
    bindBook(D1, ns);
    return { env: { SALT_LEDGER: D1, BOOK: ns }, marks };
  };
  const stub = () => { const calls = []; return { calls, tell: async (env, fixes, m, opts) => { calls.push(opts); return { ok: true, told: 1 }; } }; };
  const dr = (id, entry, row, amends) => ({ id, status: "approved", committed_at: null, entry: JSON.stringify(entry), row: JSON.stringify(row), amends: amends || null });
  const D = drainWorld([dr("d1", { orderId: "o1", payload: { mode: "amend" } }, { customer: "ZZ1-AAA", rids: ["s001"] }, "s001"),
    dr("d2", { claim: true, orderId: "o2", payload: { mode: "amend" } }, { customer: "ZZ1-AAA", rids: [] }, "ZZ1-AAA|" + T(2) + "|80"),
    dr("d3", { payload: { mode: "new" } }, { customer: "ZZ2-BBB", rids: ["s009"] })]);
  const s1 = stub(), d1 = await drainOutbox(D.env, { tell: s1.tell, mirror: async () => ({ sales: [] }) });
  const o1 = s1.calls[0] && s1.calls[0].only;
  ok(d1.sent === 3 && s1.calls.length === 1 && s1.calls[0].force === true && o1 && o1.ids.join() === "o1,o2" && o1.rids.join() === "s001,s009"
    && o1.amends.join() === "s001,ZZ1-AAA|" + T(2) + "|80",
    "the drain hands the forced pass the orders, rids and amended rows its live drafts name: " + JSON.stringify(s1.calls[0]));
  const N = drainWorld([dr("d1", { orderId: "o1", payload: {} }, { rids: ["s001"] }), dr("d4", { payload: { mode: "new" } }, { customer: "ZZ1-AAA" })]);
  const s2 = stub(); await drainOutbox(N.env, { tell: s2.tell, mirror: async () => ({ sales: [] }) });
  ok(s2.calls.length === 1 && s2.calls[0].force === true && !("only" in s2.calls[0]), "one live draft that names no order, rid or row runs the whole forced pass: " + JSON.stringify(s2.calls[0]));

  /* 2: onlyOrders */
  const sales = [
    { rid: "s001", customer: "ZZ1-AAA", date: T(1), qty: 1, total: 100, cash: 100 },
    { rid: "s002", customer: "ZZ1-AAA", date: T(2), qty: 1, total: 80, cash: 0 },
    { rid: "s003", customer: "ZZ2-BBB", date: T(1), qty: 1, total: 90, cash: 90 },
    { rid: "s004", customer: "ZZ1-AAA", date: T(3), qty: 1, total: 150, cash: 100, deliveredQty: 1 },
    { rid: "s005", customer: "ZZ4-DDD-R", date: T(1), qty: 1, total: 70, cash: 70 },
    { rid: "s006", customer: "ZZ5-EEE", date: T(4), qty: 1, total: 60, cash: 60 }];
  const ord = [
    { id: "o1", code: "ZZ1-AAA", status: "ready", ledgerKey: "ZZ1-AAA|" + T(1) + "|100" },
    { id: "o3", code: "ZZ2-BBB", status: "ready", ledgerKey: "ZZ2-BBB|" + T(1) + "|90" },
    { id: "o5", code: "ZZ1-AAA", status: "cancelled", ledgerKey: "ZZ1-AAA|" + T(9) + "|10" },
    { id: "o6", code: "ZZ1-AAA", status: "declined" },
    { id: "o7", code: null, status: "ready", ledgerKey: "ZZ2-BBB|" + T(1) + "|90" },
    { id: "o8", code: null, status: "ready", rid: "s006" },
    { id: "o9", code: "ZZ4-DDD", status: "done", forFriend: true, ledgerKey: "ZZ4-DDD-R|" + T(1) + "|70" },
    { id: "o10", code: "ZZ1-AAA", status: "done", ledgerKey: "ZZ1-AAA|" + T(3) + "|100" },
    { id: "o11", code: "ZZ2-BBB", status: "ready", ledgerKey: "ZZ2-BBB|" + T(5) + "|40" }];
  const ids = (spec) => [...(onlyOrders(ord, sales, spec) || [])].sort().join();
  ok(ids({ ids: ["o3"] }) === "o11,o3" && ids({ rids: ["s003"] }) === "o11,o3,o7", "an order the entry names is in with its owner's other orders, before any rid is written, and no other: " + ids({ ids: ["o3"] }));
  ok(ids({ rids: ["s001"] }) === "o1,o10", "a named row brings every order of its owner but the cancelled and declined, a finished one included: " + ids({ rids: ["s001"] }));
  ok(ids({ rids: ["s006"] }) === "o8", "an order whose rid is a named row's is in, though no code names it: " + ids({ rids: ["s006"] }));
  ok(ids({ amends: ["ZZ2-BBB|" + T(1) + "|90"] }) === "o11,o3,o7", "an amendment's row named by key brings the orders on that key and its owner's: " + ids({ amends: ["ZZ2-BBB|" + T(1) + "|90"] }));
  ok(ids({ amends: ["s005"] }) === "o9", "an amendment's row named by rid on an associate's bucket brings the associate's orders: " + ids({ amends: ["s005"] }));
  ok(onlyOrders(ord, sales, { ids: ["nobody"], rids: ["s999"] }) === null && onlyOrders(ord, sales, null) === null, "a narrowing that resolves to nobody answers null, the whole pass");

  /* 3: tellSite */
  const kv = (init) => { const m = new Map(Object.entries(init || {})); return { m, get: async (k, t) => (m.has(k) ? (t === "json" ? JSON.parse(m.get(k)) : m.get(k)) : null), put: async (k, v) => { m.set(k, v); }, delete: async (k) => { m.delete(k); } }; };
  const siteWorld = (told, orders, amendsRows = []) => {
    const q = kv({ "orders:told": told, "stmt-users": JSON.stringify({ u1: "ZZ1-AAA", u2: "ZZ2-BBB", u3: "ZZ3-CCC" }) }), posts = [];
    const db = { prepare: (sql) => { let args = []; const o = { bind(...a) { args = a; return o; },
      first: async () => (/^SELECT v,stamped/.test(sql) ? { v: "v1300", stamped: "s" } : null),
      all: async () => ({ results: /SELECT amends/.test(sql) ? amendsRows : [] }), run: async () => ({ meta: { changes: 0 } }) }; return o; } };
    const STMT_SITE = { fetch: async (url, init) => {
      if (init && init.method === "POST") {
        const id = decodeURIComponent(String(url).split("?")[0].split("/").pop()), o = orders.find((x) => x.id === id), b = JSON.parse(init.body);
        posts.push({ id, b }); if (o && b.mark) Object.assign(o, b.mark);
        return Response.json({ ok: true, order: o });
      }
      return Response.json({ ok: true, orders }); } };
    return { env: { SALT_LEDGER: db, SALT_QUEUE: q, STMT_SITE, STMT_DESK_KEY: "k" }, posts, orders, to: (id) => posts.filter((p) => p.id === id) };
  };
  const book = async () => ({ sales: sales.slice(0, 4), version: "v1300" });
  const tellOrders = () => [
    { id: "o1", u: "u1", status: "ready", product: "salt", qty: 1, total: 100, paid: 0, moved: 0, ledgerKey: "ZZ1-AAA|" + T(1) + "|100" },
    { id: "o2", u: "u1", status: "ready", product: "salt", qty: 1, total: 80, paid: 0, moved: 0, credit: 20, ledgerKey: "ZZ1-AAA|" + T(2) + "|80" },
    { id: "o3", u: "u2", status: "ready", product: "salt", qty: 1, total: 90, paid: 0, moved: 0, ledgerKey: "ZZ2-BBB|" + T(1) + "|90" },
    { id: "o4", u: "u1", status: "done", product: "salt", qty: 1, total: 100, paid: 100, moved: 1, rid: "s004", queued: { paid: 100, moved: 1 }, ledgerKey: "ZZ1-AAA|" + T(3) + "|100" }];
  const F = siteWorld("v1300", tellOrders()), f = await tellSite(F.env, undefined, book, { force: true, only: { ids: ["o1"], rids: ["s001"] } });
  ok(f.forced && F.to("o1").some((p) => p.b.ledger && p.b.ledger.paid === 100) && F.to("o3").length === 0,
    "a forced pass tells its own order and no other owner's order: " + JSON.stringify({ f, posts: F.posts }));
  ok(F.to("o2").some((p) => p.b.ledger && p.b.ledger.credit === 0), "and a second order of the same owner is told its credit: " + JSON.stringify(F.to("o2")));
  ok(F.to("o4").some((p) => p.b.restate && p.b.restate.total === 150), "and a completed order of the owner that an amendment reopened is restated from its row: " + JSON.stringify(F.to("o4")));
  const R = siteWorld("v1200", F.orders), r = await tellSite(R.env, undefined, book, { only: { ids: ["o1"] } });
  ok(!r.forced && !("only" in r) && R.to("o3").some((p) => p.b.ledger && p.b.ledger.paid === 90), "an order the narrowed pass left out is told by the regular pass, the net, which no only narrows: " + JSON.stringify(R.to("o3")));
  const E = siteWorld("v1300", tellOrders()), e = await tellSite(E.env, undefined, book, { force: true, only: { ids: ["nobody"] } });
  ok(E.to("o1").length >= 1 && E.to("o3").some((p) => p.b.ledger && p.b.ledger.paid === 90) && !("only" in e), "a narrowing that resolves to nobody runs the whole forced pass: " + JSON.stringify(e));

  /* 4: the follow */
  const old = "ZZ1-AAA|" + T(1) + "|285", nk = "ZZ1-AAA|" + T(1) + "|100";
  const followOrders = (collide) => [
    { id: "o1", u: "u1", status: "ready", product: "salt", qty: 1, total: 100, ledgerKey: old },
    { id: "o9", u: "u2", status: "ready", product: "salt", qty: 1, total: 90, ledgerKey: "ZZ2-BBB|" + T(1) + "|999" }]
    .concat(collide ? [{ id: "o7", u: "u3", status: "ready", product: "salt", qty: 1, total: 100, ledgerKey: nk }] : []);
  const AM = [{ amends: "s001", oid: "o1" }, { amends: "s003", oid: "o9" }];
  const C = siteWorld("v1300", followOrders(true), AM), c = await tellSite(C.env, undefined, book, { force: true, only: { ids: ["o1"] } });
  ok(C.orders[0].ledgerKey === old && !c.followed, "a key another order outside only already names still blocks the follow: " + JSON.stringify({ c, key: C.orders[0].ledgerKey }));
  const G = siteWorld("v1300", followOrders(false), AM), g = await tellSite(G.env, undefined, book, { force: true, only: { ids: ["o1"] } });
  ok(g.followed === 1 && G.orders[0].ledgerKey === nk && G.orders[1].ledgerKey === "ZZ2-BBB|" + T(1) + "|999",
    "a forced pass follows its own order to its row and leaves an order outside only where it is: " + JSON.stringify({ g, keys: G.orders.map((o) => o.ledgerKey) }));
  const GR = siteWorld("v1200", G.orders, AM), gr = await tellSite(GR.env, undefined, book);
  ok(gr.followed === 1 && GR.orders[1].ledgerKey === "ZZ2-BBB|" + T(1) + "|90", "and the regular pass follows the one left out: " + JSON.stringify({ gr, keys: GR.orders.map((o) => o.ledgerKey) }));
  /* review, 21 Nov 2026: two movers to one key, one outside only (a cancelled order of the owner whose amendment names the same row): the mover outside is still weighed */
  const M = siteWorld("v1300", [followOrders(false)[0], { id: "o12", u: "u1", status: "cancelled", product: "salt", qty: 1, total: 100, ledgerKey: "ZZ1-AAA|" + T(1) + "|286" }],
    [{ amends: "s001", oid: "o1" }, { amends: "s001", oid: "o12" }]);
  const mv = await tellSite(M.env, undefined, book, { force: true, only: { ids: ["o1"] } });
  ok(!mv.followed && M.orders[0].ledgerKey === old && M.orders[1].ledgerKey === "ZZ1-AAA|" + T(1) + "|286",
    "a mover outside only still counts against a key: two orders moving to one row, neither moves: " + JSON.stringify({ mv, keys: M.orders.map((o) => o.ledgerKey) }));
  /* a group: two done orders of 1 unit for RM 8 on one key no row holds, their one row the sum (s218's pair, test/book-outbox.mjs); only names one member */
  const pairKey = "ZZ1-AAA|" + T(1) + "|8";
  const pairWorld = () => {
    const q = kv({ "orders:told": "v1300", "stmt-users": JSON.stringify({ u1: "ZZ1-AAA" }) });
    const gp = (id, ack) => ({ id, u: "u1", ledgerKey: pairKey, status: "done", product: "salt", qty: 1, total: 8, paid: 8, moved: 1, queued: { ack } });
    const orders = [gp("pa", "ACK-A"), gp("pb", "ACK-B")];
    const db = { prepare: (sql) => { let args = []; const o = { bind(...a) { args = a; return o; },
      first: async () => (/^SELECT v,stamped/.test(sql) ? { v: "v1300", stamped: "s" }
        : /AS landed FROM draft WHERE id=/.test(sql) ? (args[0] === "ACK-A" ? { status: "approved", landed: 1 } : { status: "rejected", landed: 0 }) : null),
      all: async () => ({ results: [] }), run: async () => ({ meta: { changes: 0 } }) }; return o; } };
    const STMT_SITE = { fetch: async (url, init) => {
      if (init && init.method === "POST") { const o = orders.find((x) => x.id === decodeURIComponent(String(url).split("?")[0].split("/").pop())), b = JSON.parse(init.body); if (o && b.mark) Object.assign(o, b.mark); return Response.json({ ok: true, order: o }); }
      return Response.json({ ok: true, orders }); } };
    return { env: { SALT_LEDGER: db, SALT_QUEUE: q, STMT_SITE, STMT_DESK_KEY: "k" }, orders };
  };
  const sumBook = async () => ({ sales: [{ rid: "s001", customer: "ZZ1-AAA", date: T(1), qty: 2, total: 16, mod: "total 8 to 16; qty 1 to 2" }], version: "v1300" });
  const P = pairWorld(), p = await tellSite(P.env, undefined, sumBook, { force: true, only: { ids: ["pa"] } });
  ok(!p.followed && P.orders.every((o) => o.ledgerKey === pairKey), "a group member named alone in only is still held out of the singles: the group is weighed over every order: " + JSON.stringify({ p, keys: P.orders.map((o) => o.ledgerKey) }));
}
