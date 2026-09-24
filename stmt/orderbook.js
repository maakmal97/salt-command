/* stmt/orderbook.js: THE ORDER BOOK, ONE DURABLE OBJECT FOR THE WHOLE SITE (S10, D10, his answer of 24 Sep 2026).
 *
 * WHY. Every site order was one KV record that three writers read, changed and wrote back whole: the
 * customer's page, his desk, and the desk's reconcile and return leg. KV lets a location serve a copy up
 * to a minute old and takes one write a second per key, so any of them could erase what another had just
 * written, and nobody was told. The study of 24 Sep 2026 played six such erasures through the real code:
 * a line, a payment, a handover, a withdrawal, an acknowledgement and the ledger's own marks.
 *
 * ONE OBJECT FOR THE WHOLE SITE, not one per account (his answer to D10): the desk reads every order at
 * once, and a customer's cap and the cash rule read all of theirs, so one place answers every question.
 *
 * WHAT IT HOLDS, in its own SQLite (the kind the free plan offers):
 *   ev    every move, appended and never changed, under its id (below)
 *   ord   each order as the fold of its events, kept beside them so a read is one select
 *   meta  the site's shared marks: last-placed, last-touched, last-said, last-theirs, and chased:<username>
 *
 * A MOVE IS ONE STEP NOBODY CAN COME BETWEEN. It is checked against the order as it stands (decide* in
 * stmt/orders.js, the same functions the KV road runs), appended, folded and marked inside one synchronous
 * transaction: there is no await from the read to the write, so no other request is let in between.
 * Nothing is ever written back whole from an older copy, which is what every one of the six erasures was.
 *
 * AN EVENT'S ID IS THE DEVICE'S. The page mints one per tap and sends it with the move, so a retry of the
 * same tap is found here and answered with the order as it stands, changing nothing: c:<username>:<order>:
 * <id> (c:<username>:place:<id> for a placement). A move with no id (his desk's, which the relay does not
 * change) is given one here, s:<random>, and is simply not a retry. The ids are kept for good.
 *
 * MOVING IN (S10 10.3): A ONE-MINUTE FREEZE, A COPY, AND KV KEPT BEHIND. The first request after a deploy
 * that names this object (ORDER_STORE) finds it not yet moved in for ORDER_MOVE_IN's generation, and:
 *   1. copies every KV order in as a `copy` event, and the shared and chase marks beside them;
 *   2. refuses every move for a minute with FROZEN, reads answered from the copy, so a Worker still
 *      running the old code during the rollout is the only writer, and it writes KV;
 *   3. at the end of the minute (the alarm, or the first request after it) copies again whatever the KV
 *      record says that the copy does not, and is moved in. Moves are taken from then on.
 * ONCE A GENERATION: the generation is stored when it is done, so a second deploy does nothing. IDEMPOTENT:
 * a copy's id names the generation, the pass and the order, and an order already the same is skipped, so a
 * pass run twice (the object restarted halfway) appends nothing new. REVERSIBLE: KV is only read, and the
 * Worker writes every order it changes back to its KV key behind it (ORDER_STORE "object+kv"), so setting
 * ORDER_STORE to "kv" is the old road with a current store. Coming back after one is ORDER_MOVE_IN raised by
 * one: the move-in then runs again and takes KV as the truth.
 *
 * A PLAIN CLASS WITH fetch(), not an RPC class: that would extend `cloudflare:workers`, which is not a
 * sibling file, and nothing under stmt/ imports anything else (the suite checks). It is also what lets the
 * suite drive it in Node, over node:sqlite, whose statements run synchronously exactly as the object's do.
 */
import { BOOK_NAME, OPEN_STATES, LAST_PLACED, LAST_TOUCHED, LAST_SAID, LAST_THEIRS, FROZEN, decidePlace, decideCustomer, decideDesk, applyEvent,
  marksOf, wakes } from "./orders.js";

export { BOOK_NAME };
const MARKS = { last: LAST_PLACED, touched: LAST_TOUCHED, said: LAST_SAID, theirs: LAST_THEIRS };
export const FREEZE_MS = 60000;
/* past KV's cache life, counted from the END of the start copy (S10 fix DS3): a key the start pass read is
   served from this location's cache for a minute after THAT read, so an end inside the minute reads the start
   pass's own value back and misses what the old code wrote since */
export const FREEZE_SPARE_MS = 5000;
/* what writes: refused while the book is moving in */
const WRITES = ["place", "customer", "desk", "chase", "drop"];

export class OrderBook {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    const sql = state.storage.sql;
    sql.exec("CREATE TABLE IF NOT EXISTS ev (seq INTEGER PRIMARY KEY AUTOINCREMENT, eid TEXT NOT NULL UNIQUE, u TEXT NOT NULL, oid TEXT NOT NULL, kind TEXT NOT NULL, at TEXT NOT NULL, body TEXT NOT NULL)");
    sql.exec("CREATE TABLE IF NOT EXISTS ord (u TEXT NOT NULL, oid TEXT NOT NULL, at TEXT NOT NULL, doc TEXT NOT NULL, PRIMARY KEY (u, oid))");
    sql.exec("CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)");
  }

  async fetch(request) {
    const op = new URL(request.url).pathname.slice(1);
    let a = null;
    try { a = await request.json(); } catch (e) { a = null; }
    await this.moveIn();
    return Response.json(this.run(op, a && typeof a === "object" ? a : {}));
  }
  /* the end of the minute, with or without a request to notice it */
  async alarm() { await this.moveIn(); }

  /* ---- moving in (S10 10.3) ---- */
  gen() { return String((this.env && this.env.ORDER_MOVE_IN) || "1"); }
  frozen() { return this.meta("movein:done") !== this.gen(); }
  async moveIn() {
    if (!this.frozen()) return;
    /* one run at a time: a request arriving while a pass reads KV waits for the same pass */
    if (!this.moving) this.moving = this.movePass().finally(() => { this.moving = null; });
    return this.moving;
  }
  async movePass() {
    const gen = this.gen(), until = +(this.meta("movein:" + gen) || 0);
    if (!until) {
      const c = await this.copy(gen, "start");
      const end = Date.now() + FREEZE_MS + FREEZE_SPARE_MS;
      this.setMeta("movein:" + gen, String(end));
      await this.state.storage.setAlarm(end);
      console.log("orderbook: moving in, generation " + gen + ", frozen for a minute: " + JSON.stringify(c));
    } else if (Date.now() >= until) {
      const c = await this.copy(gen, "end");
      this.setMeta("movein:done", gen);
      console.log("orderbook: moved in, generation " + gen + ": " + JSON.stringify(c));
    }
  }
  /* every KV order in, as an event of its own; at the start the shared and chase marks too, where none is here */
  async copy(gen, pass) {
    const kv = this.env && this.env.STMT;
    if (!kv) return { orders: 0, took: 0 };
    let cursor, orders = 0, took = 0;
    do {
      const page = await kv.list({ prefix: "order:", cursor });
      for (const k of page.keys) {
        let o = null;
        try { o = JSON.parse(await kv.get(k.name)); } catch (e) { o = null; }
        if (!o || !o.id || !o.u) continue;
        orders++;
        if (this.takeIn(o, "copy:" + gen + ":" + pass + ":" + o.u + ":" + o.id)) took++;
      }
      cursor = page.list_complete ? null : page.cursor;
    } while (cursor);
    if (pass === "start") {
      for (const key of Object.values(MARKS)) { const v = await kv.get(key); if (v != null && this.meta(key) == null) this.setMeta(key, v); }
      const ch = await kv.list({ prefix: "chased:" });
      for (const k of ch.keys) { const v = await kv.get(k.name); if (v != null && this.meta(k.name) == null) this.setMeta(k.name, v); }
    }
    return { orders, took };
  }
  takeIn(o, eid) {
    const cur = this.order(o.u, o.id);
    if (cur && JSON.stringify(cur) === JSON.stringify(o)) return false;
    if (this.event(eid)) return false;
    this.append(eid, o.u, o.id, { kind: "copy", at: new Date().toISOString(), order: o }, cur);
    return true;
  }

  /* every answer is { ok, ... } or { ok: false, error, status }, and nothing here awaits */
  run(op, a) {
    const at = new Date().toISOString();
    if (WRITES.includes(op) && this.frozen()) return { ok: false, error: FROZEN, status: 503, frozen: true };
    if (op === "orders") return { ok: true, orders: a.u ? this.ordersOf(String(a.u)) : this.all() };
    if (op === "last") {
      const out = { ok: true };
      for (const [k, key] of Object.entries(MARKS)) out[k] = this.meta(key);
      return out;
    }
    if (op === "place") {
      const u = String(a.u || ""), eid = a.rid ? "c:" + u + ":place:" + a.rid : null;
      const seen = eid ? this.event(eid) : null;
      if (seen) return { ok: true, order: this.order(seen.u, seen.oid), again: true };
      const d = decidePlace(u, a.body, this.ordersOf(u).filter((o) => OPEN_STATES.includes(o.status)), at);
      if (d.error) return { ok: false, error: d.error, status: 400 };
      return this.append(eid, u, d.ev.order.id, d.ev, null);
    }
    if (op === "customer") {
      const u = String(a.u || ""), id = String(a.id || ""), eid = a.rid ? "c:" + u + ":" + id + ":" + a.rid : null;
      const order = this.order(u, id);
      if (eid && order && this.event(eid)) return { ok: true, order, again: true };
      const d = decideCustomer(order, a.action, a.body, this.ordersOf(u), at);
      if (d.error) return { ok: false, error: d.error, status: d.status || 400 };
      return this.append(eid, u, id, d.ev, order);
    }
    if (op === "desk") {
      const u = String(a.u || ""), id = String(a.id || "");
      const order = this.order(u, id);
      const d = decideDesk(order, a.body, at);
      if (d.error) return { ok: false, error: d.error, status: d.status || 400 };
      if (d.none) return { ok: true, order, none: true };
      return this.append(null, u, id, d.ev, order);
    }
    /* THE CHASE MARK lives here with the orders it follows: true when this hour's wake is still to be
       sent, and the mark is then written; a mark two hours old is dropped, as its KV lapse dropped it */
    if (op === "chase") {
      const u = String(a.u || ""), hour = Math.floor(+a.hour);
      if (!u || !Number.isFinite(hour)) return { ok: false, error: "a chase names a customer and an hour", status: 400 };
      if (this.meta("chased:" + u) === String(hour)) return { ok: true, fresh: false };
      this.state.storage.transactionSync(() => {
        this.setMeta("chased:" + u, String(hour));
        this.state.storage.sql.exec("DELETE FROM meta WHERE k LIKE 'chased:%' AND CAST(v AS INTEGER) < ?", hour - 1);
      });
      return { ok: true, fresh: true };
    }
    /* his test account, unmade: its orders and their events go with it */
    if (op === "drop") {
      const u = String(a.u || "");
      const n = this.ordersOf(u).length;
      this.state.storage.transactionSync(() => {
        this.state.storage.sql.exec("DELETE FROM ev WHERE u = ?", u);
        this.state.storage.sql.exec("DELETE FROM ord WHERE u = ?", u);
      });
      return { ok: true, dropped: n };
    }
    return { ok: false, error: "not found", status: 404 };
  }

  /* the event, the order it folds into and the marks it moves, as one transaction */
  append(eid, u, oid, ev, order) {
    const sql = this.state.storage.sql;
    let out = null;
    this.state.storage.transactionSync(() => {
      const r = applyEvent(order, ev);
      sql.exec("INSERT INTO ev (eid, u, oid, kind, at, body) VALUES (?, ?, ?, ?, ?, ?)",
        eid || "s:" + crypto.randomUUID(), u, oid, ev.kind, ev.at, JSON.stringify(ev));
      sql.exec("INSERT OR REPLACE INTO ord (u, oid, at, doc) VALUES (?, ?, ?, ?)", u, oid, String(r.order.at || ev.at), JSON.stringify(r.order));
      for (const [k, v] of marksOf(ev, r.order)) this.setMeta(k, v);
      out = { ok: true, order: r.order, wake: wakes(ev, r.done) };
    });
    return out;
  }

  event(eid) { return this.state.storage.sql.exec("SELECT u, oid FROM ev WHERE eid = ?", eid).toArray()[0] || null; }
  order(u, oid) {
    const r = this.state.storage.sql.exec("SELECT doc FROM ord WHERE u = ? AND oid = ?", u, oid).toArray()[0];
    return r ? JSON.parse(r.doc) : null;
  }
  ordersOf(u) { return this.state.storage.sql.exec("SELECT doc FROM ord WHERE u = ? ORDER BY at DESC", u).toArray().map((r) => JSON.parse(r.doc)); }
  all() { return this.state.storage.sql.exec("SELECT doc FROM ord ORDER BY at DESC").toArray().map((r) => JSON.parse(r.doc)); }
  meta(k) { const r = this.state.storage.sql.exec("SELECT v FROM meta WHERE k = ?", k).toArray()[0]; return r ? r.v : null; }
  setMeta(k, v) { this.state.storage.sql.exec("INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)", k, String(v)); }
}
