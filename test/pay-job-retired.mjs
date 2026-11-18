/* test/pay-job-retired.mjs: THE RECONCILE BOOKS NO PAYMENT (18 Nov 2026).
 * The Desk's every-minute reconcile used to queue a payment entry for a "pay" job the Counter listed, and only then post the mark back, with no
 * rowRoom read on that road: run twice before the mark landed, or beside his own Received or Cash received, a part-paid row could be booked twice.
 * Since S6 a customer's "I have sent it" is a claim, booked only by his Received, so the job is retired on both sides:
 *   the Counter (stmt/orders.js orderWork) lists no "pay" job in any state, and the Desk (src/orders.js reconcileOrders) books nothing for one an
 *   older Counter still hands it, so either deploy order is safe.
 * Each check is proved red by its own mutation (test/pay-job-retired.mutations.json). All figures and ids are invented.
 *   1  the Counter lists no pay job for an order whose paid runs ahead of what was told, in every shape of it, and still lists every other job
 *   2  a Desk handed a pay job queues no entry (the queue holds nothing new)
 *   3  and posts no paid mark to the order
 *   4  and says so: `retired` in the pass's result and a waiting state on the order's card, and the cron's console line reads it
 *   5  run twice it still queues nothing
 *   6  the other jobs of the same pass queue as before, the pay job ahead of them or behind them
 *   7  his Received on a claim books the payment once, and rowRoom still refuses a second (a payment past the room) */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { readBook } from "../tools/book.mjs";
import { buildSeed } from "../tools/d1.mjs";
import * as SO from "../stmt/orders.js";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const at = (p) => pathToFileURL(join(REPO, p)).href;

class Store {
  values = new Map();
  async get(key, type) { const v = this.values.get(key) ?? null; return v === null || type !== "json" ? v : JSON.parse(v); }
  async put(key, value) { this.values.set(key, value); }
  async delete(key) { this.values.delete(key); }
  async list({ prefix = "" } = {}) { return { keys: [...this.values.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; }
}

export async function run({ ok }) {
  const O = await import(at("src/orders.js") + "?payretired");
  const T0 = "2026-10-16T02:00:00.000Z";
  const base = { id: "20261016-0001-pr", u: "u001-aaaa", code: "ZZ9-TST", status: "acknowledged", product: "salt", qty: 4, total: 400, delivery: 0, mode: "collect",
    forFriend: false, ledgerKey: "ZZ9-TST|2026-10-16|400", moved: 0, movedOn: null, paid: 0, claimed: 0, payments: [], at: T0,
    history: [{ at: T0, status: "acknowledged", by: "desk" }], queued: { ack: T0, paid: 0, moved: 0 } };
  const mk = (extra) => Object.assign(structuredClone(base), extra);
  const claim = (state) => ({ at: "2026-10-16T04:00:00.000Z", amount: 30, claim: state, method: "transfer", account: "maybank" });

  /* ---- 1 the Counter: every state that used to list "pay" ---- */
  const legacy = mk({}); SO.applyEvent(legacy, { kind: "pay", at: "2026-10-16T03:00:00.000Z", amount: 60, method: "transfer", account: "maybank" });   /* the form before S6, replayed from an old event log */
  const states = {
    "paid ahead of what was told": mk({ paid: 100 }),
    "part told": mk({ paid: 100, queued: { ack: T0, paid: 40, moved: 0 } }),
    "an old pay event replayed": legacy,
    "paid ahead with a waiting claim": mk({ paid: 100, claimed: 30, payments: [claim("waiting")] }),
    "paid ahead with a received claim not yet queued": mk({ paid: 130, payments: [claim("received")] }),
    "paid ahead and handed over": mk({ paid: 100, moved: 2, movedOn: "2026-10-16" }),
  };
  const worked = Object.entries(states).map(([k, o]) => [k, SO.paidUntold(o), SO.orderWork(o)]);
  ok(worked.filter(([, n]) => n > 0.004).length >= 5 && worked.every(([, , w]) => !w.includes("pay")),
    "the Counter lists no pay job in any state that used to list it: " + JSON.stringify(worked));
  const all = SO.orderWork(mk({ queued: {}, moved: 2, paid: 100, claimed: 30, payments: [claim("waiting")] }));
  const cl = SO.orderWork(mk({ closed: { at: "2026-10-16T05:00:00.000Z", qty: 4, total: 400 }, moved: 4 })), cn = SO.orderWork(mk({ status: "cancelled" }));
  ok(all.join() === "ack,claim,move" && cl.join() === "close" && cn.join() === "cancel",
    "and every other job is listed as before: " + JSON.stringify({ all, cl, cn }));

  /* ---- the Desk's reconcile, on a stub site and queue ---- */
  const world = (list) => {
    const queue = new Store(), posts = [];
    queue.values.set("stmt-users", JSON.stringify(Object.fromEntries(list.map((o) => [o.u, o.code]))));
    const site = { fetch: async (url, init) => { posts.push(JSON.parse((init && init.body) || "{}")); return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } }); } };
    const env = { SALT_QUEUE: queue, STMT_SITE: site, STMT_DESK_KEY: "pay-job-retired-fixture" };
    const mirror = async () => ({ state: { OPEN: { byKey: Object.fromEntries(list.map((o) => [o.ledgerKey, { q: o.qty }])) } } });
    const queued = () => [...queue.values.entries()].filter(([k]) => k !== "stmt-users").map(([, v]) => JSON.parse(v).queue[0]);
    return { env, posts, mirror, queued };
  };
  const owing = (o, work, extra) => ({ ok: true, owing: [Object.assign(structuredClone(o), extra || {}, { work, tell: { pay: 60, claims: [] } })] });
  const payOnly = mk({ paid: 60 });
  const w1 = world([payOnly]), r1 = await O.reconcileOrders(w1.env, owing(payOnly, ["pay"]), w1.mirror);
  ok(r1.ok && r1.queued === 0 && w1.queued().length === 0, "a Desk handed a pay job queues no entry: " + JSON.stringify({ r1, q: w1.queued().length }));
  ok(w1.posts.every((p) => !p.mark || p.mark.paid === undefined), "and posts no paid mark to the order: " + JSON.stringify(w1.posts));
  const state = (w1.posts.find((p) => p.mark && p.mark.sync) || { mark: {} }).mark.sync;
  ok(Array.isArray(r1.retired) && r1.retired[0] === payOnly.id && state && state.state === "waiting" && /no longer books/.test(state.why),
    "and says so, in the pass's result and on the order's card: " + JSON.stringify({ r1, state }));
  const wk = readFileSync(join(REPO, "src/worker.js"), "utf8");
  ok(/rc\.dropped \|\| rc\.retired\) console\.log\("orders reconcile: "/.test(wk), "and the cron's console line reads a retired job");
  const r2 = await O.reconcileOrders(w1.env, owing(payOnly, ["pay"]), w1.mirror);
  ok(r2.ok && r2.queued === 0 && w1.queued().length === 0 && w1.posts.every((p) => !p.mark || p.mark.paid === undefined), "run twice it still queues nothing and marks nothing paid: " + JSON.stringify(r2));

  const mixes = {};
  const hand = { moved: 2, movedOn: "2026-10-16", movedAt: "2026-10-16T02:30:00.000Z" };
  for (const [name, work, extra] of [["pay then move", ["pay", "move"], hand], ["move then pay", ["move", "pay"], hand],
    ["pay then claim", ["pay", "claim"], { claimed: 30, payments: [claim("waiting")] }]]) {
    const o = mk({ paid: 60 }), w = world([o]);
    const claims = extra.payments ? [{ at: extra.payments[0].at, amount: 30, method: "transfer", account: "maybank" }] : [];
    const r = await O.reconcileOrders(w.env, { ok: true, owing: [Object.assign(structuredClone(o), extra, { work, tell: { pay: 60, claims } })] }, w.mirror);
    mixes[name] = { queued: r.queued, status: w.queued().map((e) => e.status), marks: w.posts.map((p) => Object.keys(p.mark || {}).filter((k) => k !== "sync").join("+")).filter(Boolean) };
  }
  ok(JSON.stringify(mixes) === JSON.stringify({ "pay then move": { queued: 1, status: ["Handover"], marks: ["moved"] }, "move then pay": { queued: 1, status: ["Handover"], marks: ["moved"] },
    "pay then claim": { queued: 1, status: ["Payment"], marks: ["claims"] } }), "the other jobs of the same pass queue as before, before or after a pay job: " + JSON.stringify(mixes));

  /* ---- 7 his Received books once, and rowRoom refuses a second ---- */
  const src = await readBook(), ledger = JSON.parse(JSON.stringify(src.ledger));
  if (ledger.REWARD && ledger.REWARD.stated && ledger.REWARD.stated.salt && ledger.REWARD.stated.salt.associate) delete ledger.REWARD.stated.salt.associate.since;
  const seedSql = buildSeed({ v: src.version, stamped: ledger.stamped || null, ledger }).sql;
  const migSql = readdirSync(join(REPO, "migrations")).filter((x) => /^\d+_.*\.sql$/.test(x)).sort().map((f) => readFileSync(join(REPO, "migrations", f), "utf8"));
  const E = (await import(at("engine/position.mjs"))).default;
  const row = Object.values(ledger.OPEN.byKey).filter((r) => r.dir === "S").map((r) => ledger.sales.find((s) => s.rid === r.rid)).filter(Boolean).find((r) => (+r.total + (+r.delivery || 0)) - (+r.cash || 0) > 60);
  const t0 = (row.date || "2026-10-01") + "T02:00:00.000Z", owed = +((+row.total + (+row.delivery || 0)) - (+row.cash || 0)).toFixed(2);
  const ord = { id: "20261015-0001-" + row.rid, u: "u001-aaaa", code: row.customer, status: "acknowledged", product: row.product || "salt", qty: row.qty, total: row.total,
    delivery: row.delivery || 0, mode: "collect", forFriend: false, ledgerKey: E.ovKey(row), moved: row.deliveredQty || 0, movedOn: null, paid: row.cash || 0, claimed: 0,
    payments: [], at: t0, history: [{ at: t0, status: "acknowledged", by: "desk" }], queued: { ack: t0, paid: row.cash || 0, moved: row.deliveredQty || 0 } };
  const rw = (claimAmount) => {
    const db = new DatabaseSync(":memory:"); for (const m of migSql) db.exec(m); db.exec(seedSql);
    const D1 = { batch(sts) { db.exec("BEGIN IMMEDIATE"); try { const out = sts.map((s) => s.run()); db.exec("COMMIT"); return out; } catch (e) { db.exec("ROLLBACK"); throw e; } },
      prepare(sql) { const st = db.prepare(sql);
        const mkq = (a) => ({ async run() { return { meta: { changes: Number(st.run(...a).changes || 0) } }; }, async first() { const r = st.get(...a); return r === undefined ? null : r; }, async all() { return { results: st.all(...a) }; } });
        const self = mkq([]); self.bind = (...a) => mkq(a); return self; } };
    const queue = new Store(); queue.values.set("stmt-users", JSON.stringify({ [ord.u]: ord.code }));
    const orders = [Object.assign(structuredClone(ord), { claimed: claimAmount, payments: [{ at: "2026-10-16T01:00:00.000Z", amount: claimAmount, claim: "waiting", method: "transfer", account: "maybank" }] })];
    const site = { fetch: async (url, init) => {
      if (((init && init.method) || "GET") === "GET") return new Response(JSON.stringify({ ok: true, orders }), { status: 200, headers: { "content-type": "application/json" } });
      return new Response(JSON.stringify({ ok: true, order: orders[0], push: null }), { status: 200, headers: { "content-type": "application/json" } }); } };
    return { env: { SALT_LEDGER: D1, SALT_QUEUE: queue, STMT_SITE: site, STMT_DESK_KEY: "pay-job-retired-fixture" }, db };
  };
  const a = rw(12), r7 = await O.receivedOrder(a.env, ord.id, { amount: 12 }, "desk", new Date("2026-10-16T05:00:00.000Z"));
  const pre = () => a.db.prepare("SELECT * FROM preapproval").all().length;
  const n1 = pre();
  ok(r7.ok === true && n1 === 1 && (r7.preapproval || {}).stage === "pay", "his Received on a claim books the payment once, as one preapproved Payment: " + JSON.stringify({ ok: r7.ok, n1, stage: (r7.preapproval || {}).stage }));
  const big = +(owed + 50).toFixed(2), b = rw(big), r7c = await O.receivedOrder(b.env, ord.id, { amount: big }, "desk", new Date("2026-10-16T05:00:00.000Z"));
  ok(r7c.ok !== true && r7c.status === 409 && /past what it owes/.test(String(r7c.error)) && b.db.prepare("SELECT * FROM preapproval").all().length === 0,
    "and rowRoom still refuses a payment past what the row can take, booking nothing: " + JSON.stringify({ ok: r7c.ok, status: r7c.status, why: String(r7c.error || "").slice(0, 100) }));
}
