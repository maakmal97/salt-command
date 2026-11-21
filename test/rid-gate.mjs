/* test/rid-gate.mjs: THE RECORD THAT GATES ITEM 3B (21 Nov 2026, his answer D: item 3 as two versions a week apart). The minute's kept tie-out writes KV
 * RIDGATE_KEY: since (when the healthy run began), count, repeat (orders that fell back on two kept tie-outs running), stale, clean, last (at most 500 ids).
 *   G1  the first pass with fallbacks begins the run: since is its own moment
 *   G2  a second pass with one of the same ids resets: since moves, repeat 1, and why says so; a pass of all new ids keeps since
 *   G3  a staleRid resets; a tie-out with a fault resets
 *   G4  the transient list never reaches TIEOUT_KEY, and last is capped at 500
 *   G5  a throwing get or put of the record leaves the tie-out kept and the stamps sent
 *   G6  ridGateDue: fresh and 7 days is due; 6 days is not; a stale record is not
 * Every assertion is red under its own mutation (test/rid-gate.mutations.json). */
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import POSITION_ENGINE from "../engine/position.mjs";
import { frozenBook } from "./frozen.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const V = "v1552", J = JSON.stringify;
const CODE = "ZZ1-AAA", DAY = "2026-11-18";
const key = (total, delivery = 0, customer = CODE, product = "oil") => POSITION_ENGINE.ovKey({ customer, date: DAY, total, delivery, product });
const row = (over) => Object.assign({ customer: CODE, date: DAY, product: "oil", qty: 10, total: 110, delivery: 0, cash: 110, deliveredQty: 10, road: "site", rev: "R2" }, over || {});
const AT = (n) => "2026-11-18T14:00:0" + n + ".000Z";
const mk = (n, total = 110 + n) => ({ id: "2026111813592" + n + "-aaaaaa", u: "u1", code: CODE, status: "done", mode: "deliver", product: "oil", forFriend: false, qty: 10, total, delivery: 0, paid: total, moved: 10,
  at: "2026-11-18T13:59:22.294Z", ledgerKey: key(total), queued: { ack: AT(n), paid: total, moved: 10 }, history: [], payments: [] });
const T0 = new Date("2026-11-20T03:00:00.000Z"), MIN = 60000, DAYMS = 86400000;

export async function run({ ok }) {
  const { buildSeed } = await import("../tools/d1.mjs");
  const O = await import("../src/orders.js");
  const C = await import("../stmt/orders.js");
  const world = (n) => {
    const db = new DatabaseSync(":memory:");
    for (const f of readdirSync(join(REPO, "migrations")).filter((x) => /^\d+_.*\.sql$/.test(x)).sort()) db.exec(readFileSync(join(REPO, "migrations", f), "utf8"));
    const { NOTES, ...bookless } = frozenBook();
    db.exec(buildSeed({ v: V, stamped: "20 Nov 2026, 03:00 KL", ledger: { ...bookless, PRICING: { v: V, floors: {}, sizes: [1] }, OPEN: { v: V, count: 0, byKey: {} }, TERMS: {}, REWARD: { stated: {} }, STOCK: { books: {} } } }).sql);
    db.exec("UPDATE snapshot SET at='2026-11-19T23:00:00.000Z'");
    const mkq = (a, sql) => { const st = db.prepare(sql); return { run() { const x = st.run(...a); return { meta: { changes: Number(x.changes || 0) } }; }, first() { const x = st.get(...a); return x === undefined ? null : x; }, all() { return { results: st.all(...a) }; } }; };
    const D1 = { prepare(sql) { const o = mkq([], sql); o.bind = (...a) => mkq(a, sql); return o; } };
    for (const i of n) db.prepare("INSERT INTO draft (id,status,collection,entry,row,reasoning,flags,party,drafter,drafted_at,decided_at,decided_by,amends,committed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(AT(i), "approved", "sales", J({ at: AT(i), orderId: mk(i).id }), "{}", "r", "[]", CODE, "t", AT(i), AT(i), "t", null, "2026-11-18T19:26:24.375Z");
    return D1;
  };
  const kv = (m = new Map(), bad = {}) => ({ m, get: async (k, t) => { if (bad.get && k === O.RIDGATE_KEY) throw new Error("kv get down"); return m.has(k) ? (t === "json" ? JSON.parse(m.get(k)) : m.get(k)) : null; },
    put: async (k, v) => { if (bad.put && k === O.RIDGATE_KEY) throw new Error("kv put down"); m.set(k, v); }, delete: async (k) => { m.delete(k); } });
  /* one kept pass at `now` over orders (ids by number) with the rows' rids; the gate's record is carried from `from` (a kv map) */
  const pass = async (ids, now, from, { bad, rows, orders } = {}) => {
    const q = kv(from ? new Map(from) : new Map(), bad); q.m.set("stmt-users", J({ u1: CODE })); q.m.set("orders:told", V); q.m.set("orders:fixed", "{}");
    const list = orders || ids.map((i) => mk(i)), sent = [];
    const STMT_SITE = { fetch: async (url, init) => {
      if (String(url).includes("/desk/orders?")) return Response.json({ ok: true, orders: list });
      const id = decodeURIComponent(String(url).split("/").pop()), i = list.findIndex((x) => x.id === id), b = init && init.body ? JSON.parse(init.body) : {};
      sent.push(id);
      const d = C.decideDesk(list[i], b, now.toISOString());
      if (d.error) return Response.json({ ok: false, error: d.error }, { status: d.status });
      if (d.ev) list[i] = Object.assign(list[i], C.applyEvent(JSON.parse(J(list[i])), d.ev).order);
      return Response.json({ ok: true, order: list[i] });
    } };
    const env = { SALT_LEDGER: world(ids), SALT_QUEUE: q, STMT_SITE, STMT_DESK_KEY: "k" };
    const sales = rows || ids.map((i) => row({ rid: "s39" + i, total: 110 + i, cash: 110 + i }));
    let k; try { k = await O.tieOutKept(env, async () => ({ version: V, sales, state: { OPEN: { byKey: {} } } }), now); } catch (e) { k = { tie: { ok: false, error: String(e) }, st: null }; }
    return { ...k, q, sent, rec: q.m.has(O.RIDGATE_KEY) ? JSON.parse(q.m.get(O.RIDGATE_KEY)) : null };
  };
  const quiet = console.log; let said = [];
  console.log = (...a) => { said.push(a.join(" ")); };
  try {
    /* G1 */
    const p1 = await pass([1, 2], T0);
    ok(p1.tie.clean && p1.rec && p1.rec.since === T0.toISOString() && p1.rec.at === T0.toISOString() && p1.rec.count === 2 && p1.rec.repeat === 0 && p1.rec.stale === 0 && !p1.rec.why,
      "G1: the first pass with fallbacks begins the run at its own moment: " + J(p1.rec));
    ok(J(p1.rec.last) === J([mk(1).id, mk(2).id].sort()) || J(p1.rec.last.slice().sort()) === J([mk(1).id, mk(2).id].sort()), "G1: the record holds the full list of fallback ids, last: " + J(p1.rec.last));
    /* G2 */
    const T1 = new Date(T0.getTime() + 5 * MIN), p2 = await pass([2, 3], T1, p1.q.m);
    ok(p2.rec.since === T1.toISOString() && p2.rec.repeat === 1 && /fell back on two kept tie-outs running/.test(p2.rec.why || ""), "G2: one of the same ids on the next pass resets the run, repeat 1, and says why: " + J(p2.rec));
    ok(said.some((s) => /^orders rid gate reset: /.test(s)), "G2: a reset prints one line: " + J(said));
    const T2 = new Date(T1.getTime() + 5 * MIN), p3 = await pass([4, 5], T2, p2.q.m);
    ok(p3.rec.since === T1.toISOString() && p3.rec.repeat === 0 && !p3.rec.why && p3.rec.count === 2, "G2: a pass whose fallbacks are all new ids keeps since: " + J(p3.rec));
    /* G3 */
    const stale = [mk(1, 110)]; stale[0].rid = "s390"; stale[0].ledgerKey = key(77);
    const T3 = new Date(T2.getTime() + 5 * MIN), p4 = await pass([1], T3, p3.q.m, { orders: stale, rows: [row({ rid: "s390", cancelled: true, total: 99 })] });
    ok(p4.rec.stale === 1 && p4.rec.since === T3.toISOString() && /staleRid/.test(p4.rec.why || ""), "G3: a staleRid resets the run: " + J(p4.rec));
    const T4 = new Date(T3.getTime() + 5 * MIN), unclean = [mk(1), Object.assign(mk(2, 50), { status: "ready", queued: { ack: AT(2) } })];
    const p5 = await pass([1], T4, p3.q.m, { orders: unclean, rows: [row({ rid: "s391", total: 111, cash: 111 }), row({ rid: "s392", total: 50, cash: 50, qty: 5, deliveredQty: 5 })] });
    ok(!p5.tie.clean && p5.rec.clean === false && p5.rec.since === T4.toISOString() && /not clean/.test(p5.rec.why || ""), "G3: a tie-out with a fault resets the run: " + J([p5.tie.clean, p5.rec]));
    /* G4 */
    const stored = JSON.parse(p1.q.m.get(O.TIEOUT_KEY));
    ok(!("ridFallbackAll" in stored) && !("ridFallbackAll" in p1.tie) && stored.ridFallback.count === 2, "G4: the transient full list never reaches TIEOUT_KEY nor the answer: " + J(Object.keys(stored)));
    const many = Array.from({ length: 520 }, (_, i) => { const t = 1000 + i; return Object.assign(mk(1, t), { id: "20261118135922-" + String(i).padStart(6, "0") }); });
    const bigRows = many.map((o, i) => row({ rid: "s" + (5000 + i), total: o.total, cash: o.total }));
    const big = await pass([], T0, null, { orders: many, rows: bigRows });
    ok(big.rec && big.rec.count === 520 && big.rec.last.length === 500, "G4: last is capped at 500 and count is the whole: " + J([big.rec && big.rec.count, big.rec && big.rec.last.length]));
    /* G5 */
    for (const bad of [{ get: true }, { put: true }]) {
      const p = await pass([1], T0, null, { bad });
      ok(p.tie.ok && p.tie.clean && p.q.m.has(O.TIEOUT_KEY) && p.st && p.st.stamped === 1 && p.sent.length === 1 && (!bad.get || (p.rec && p.rec.since === T0.toISOString())), "G5: a throwing " + Object.keys(bad)[0] + " of the record leaves the check kept and the stamp sent: " + J([p.tie.ok, p.st, p.sent]));
    }
    /* G6 */
    const rec = (since, at) => ({ v: 1, at: at.toISOString(), since: since.toISOString() }), NOW = new Date("2026-11-30T03:00:00.000Z");
    const d7 = O.ridGateDue(rec(new Date(NOW.getTime() - 7 * DAYMS - MIN), new Date(NOW.getTime() - MIN)), NOW);
    ok(d7.due === true && d7.since, "G6: a fresh record with a run of 7 days is due: " + J(d7));
    const d6 = O.ridGateDue(rec(new Date(NOW.getTime() - 6 * DAYMS), new Date(NOW.getTime() - MIN)), NOW);
    ok(d6.due === false && /under 7/.test(d6.why), "G6: a run of 6 days is not: " + J(d6));
    const dOld = O.ridGateDue(rec(new Date(NOW.getTime() - 9 * DAYMS), new Date(NOW.getTime() - 7 * 3600000)), NOW);
    ok(dOld.due === false && /stale/.test(dOld.why), "G6: a record 7 hours old is not: " + J(dOld));
    ok(O.ridGateDue(null, NOW).due === false && O.ridGateDue({ at: "x", since: "y" }, NOW).due === false, "G6: no record, or one unreadable, is not due");
  } finally { console.log = quiet; }
}
