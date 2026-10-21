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
  /* THE HIBERNATION API (Speed Wave 2 L2): accepted sockets with their tags, as the platform keeps them. A socket closed leaves the list;
     its attachment is kept by structured clone, as the platform keeps it; send and close are recorded for the test to read back. */
  const sockets = [];
  let autoResponse = null;
  return { storage, db, blockConcurrencyWhile: async (fn) => fn(), alarmAt: () => alarm, clearAlarm: () => { alarm = null; },
    acceptWebSocket(ws, tags) { ws.tags = tags || []; sockets.push(ws); },
    getWebSockets(tag) { return sockets.filter((w) => !w.closed && (tag === undefined || w.tags.includes(tag))); },
    setWebSocketAutoResponse(pair) { autoResponse = pair; }, autoResponse: () => autoResponse, sockets };
}

/** A socket as the object sees its own end (the server side of a WebSocketPair): send and close recorded, the attachment cloned. */
export function fakeServerSocket() {
  const ws = { sent: [], closed: null, att: null,
    send(m) { if (ws.closed) throw new Error("socket closed"); ws.sent.push(m); },
    close(code, reason) { if (ws.closed) throw new Error("already closed"); ws.closed = { code, reason }; },
    serializeAttachment(v) { ws.att = v === undefined ? null : structuredClone(v); },
    deserializeAttachment() { return ws.att === null ? null : structuredClone(ws.att); },
    kinds() { return ws.sent.map((m) => { try { return JSON.parse(m); } catch (e) { return m; } }); } };
  return ws;
}

/** WebSocketPair and the 101 seam, for Node: pair() hands the object a fresh server socket, and `upgraded` answers a 200 carrying the
 *  client end and the subprotocol, since Node's Response refuses status 101. Returns the sockets made, newest last. */
export function liveSeam(book, made = []) {
  const was = globalThis.WebSocketPair;
  globalThis.WebSocketPair = class { constructor() { const server = fakeServerSocket(), client = { client: true, server }; made.push(server); this[0] = client; this[1] = server; } };
  book.upgraded = (client, echo) => new Response("upgraded", { status: 200, headers: Object.assign({ "x-upgraded": "1" }, echo ? { "Sec-WebSocket-Protocol": "stmt" } : {}) });
  made.restore = () => { if (was === undefined) delete globalThis.WebSocketPair; else globalThis.WebSocketPair = was; };
  return made;
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
    state.db.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('movein:at', ?)").run(new Date().toISOString());
  }
  const h = { book: new OrderBook(state, env), state, db: state.db, names: [] };
  let calls = 0;
  h.ns = {
    idFromName(n) { h.names.push(n); return { name: n }; },
    get() { return { fetch: (url, init) => { calls++; return h.book.fetch(new Request(url, init)); } }; }
  };
  h.calls = () => calls;
  h.restart = () => { h.book = new OrderBook(state, env); return h.book; };
  /* the alarm as the platform fires it: taken off, then run, so what the handler sets is the next one */
  h.fire = async () => { state.clearAlarm(); await h.book.alarm(); };
  return h;
}
