/* test/orderbook-harness.mjs: THE SITE'S DURABLE OBJECT IN NODE, for the suite (S10, D10).
 *
 * stmt/orderbook.js runs on the object's own SQLite, whose statements are synchronous. node:sqlite's are
 * too, so the object is driven here over an in-memory database with the few calls it makes: sql.exec (a
 * cursor with toArray and rowsWritten), transactionSync, and the alarm. The namespace hands every name the
 * same instance, as the platform hands one name one object, and records the names it was asked for.
 * Proved against workerd by hand (Miniflare, 24 Sep 2026): the same calls, the same answers.
 */
import { DatabaseSync } from "node:sqlite";
import { OrderBook } from "../stmt/orderbook.js";

export function objectState() {
  const db = new DatabaseSync(":memory:");
  let alarm = null;
  const sql = {
    exec(q, ...b) {
      const st = db.prepare(q);
      if (/^\s*(SELECT|WITH)\b|\bRETURNING\b/i.test(q)) {
        const rows = st.all(...b);
        return { toArray: () => rows, rowsWritten: 0, [Symbol.iterator]: () => rows[Symbol.iterator]() };
      }
      const r = st.run(...b);
      return { toArray: () => [], rowsWritten: Number(r.changes), [Symbol.iterator]: () => [][Symbol.iterator]() };
    }
  };
  const storage = {
    sql,
    transactionSync(fn) {
      db.exec("BEGIN");
      try { const r = fn(); db.exec("COMMIT"); return r; } catch (e) { db.exec("ROLLBACK"); throw e; }
    },
    async setAlarm(t) { alarm = +t; },
    async getAlarm() { return alarm; },
    async deleteAlarm() { alarm = null; }
  };
  return { storage, db, alarmAt: () => alarm };
}

/** An ORDERBOOK namespace over one fresh object. `env` is what the object is constructed with. The object
 *  starts MOVED IN for its generation unless `movedIn: false`, because a fresh book in a test has nothing to
 *  move in and a real one freezes for a minute first (S10 10.3). `restart()` is the platform evicting the
 *  object: a new instance over the same storage, which is all that survives. */
export function orderBook(env, opts) {
  const state = objectState();
  env = env || {};
  if (!opts || opts.movedIn !== false) {
    new OrderBook(state, env);
    state.db.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('movein:done', ?)").run(String(env.ORDER_MOVE_IN || "1"));
  }
  const h = { book: new OrderBook(state, env), state, db: state.db, names: [] };
  let calls = 0;
  h.ns = {
    idFromName(n) { h.names.push(n); return { name: n }; },
    get() { return { fetch: (url, init) => { calls++; return h.book.fetch(new Request(url, init)); } }; }
  };
  h.calls = () => calls;
  h.restart = () => { h.book = new OrderBook(state, env); return h.book; };
  return h;
}
