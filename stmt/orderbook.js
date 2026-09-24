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
 *   acl   each claim against an account (S6 6.6), the fold of its events as `ord` is an order's: never an order, so no
 *         reader of orders sees one; named by an id no order takes (`a` and the moment), written behind to aclaim:
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
 * pass run twice (the object restarted halfway) appends nothing new. REVERSIBLE: the move-in only reads KV,
 * and this book writes every order it changes to its KV key behind it (below), so setting ORDER_STORE to "kv"
 * is the old road with a current store. Coming back after one is ORDER_MOVE_IN raised by one: the move-in
 * then runs again and takes what the KV road wrote. FORGETTING THAT IS SAFE (S10 fix DS1): every order the
 * KV road writes while this book is bound marks KV orderbook:road (ROAD_KEY), and a book that finds a mark
 * later than its own move-in moves in again before it answers, a round of the same generation, `<gen>@<mark>`.
 * A KV record the book has already held is behind it, not ahead, so a return keeps the book's own and
 * writes it behind rather than take the older one.
 *
 * WRITTEN BEHIND BY THE BOOK ALONE (S10 fixes R1, P1, DS2). On ORDER_STORE "object+kv" every order a move
 * changes is named in `behind`, and the alarm writes its CURRENT doc to its KV key a second and more later.
 * KV takes one write a second per key and the reconcile makes two moves on one order inside a second, so the
 * Worker's own put after each answer lost the second; here moves inside a second are one write, a put KV
 * refuses stays named and is tried again a second later, and no older copy can land after a newer one,
 * because the book is the one writer of order keys and always writes what it holds now.
 *
 * KV IS NEVER WRITTEN OVER WITH WHAT THE BOOK HAS NOT HELD (S10 fixes DS1, R2, P2, DS2). A KV record the book
 * never held was written by something else, the old code during the rollout or the KV road after a flip back,
 * and it is the only copy of that move: a write behind leaves it, and the hourly check names it `kvAhead`. The
 * check is the book's own (`check`), so each KV record is compared with what the book holds at that moment,
 * and it writes nothing itself: a record KV holds behind the book is named for the write behind. While the
 * book is moving in the check stands down, because KV is then the old code's and the end pass still to read.
 *
 * A PLAIN CLASS WITH fetch(), not an RPC class: that would extend `cloudflare:workers`, which is not a
 * sibling file, and nothing under stmt/ imports anything else (the suite checks). It is also what lets the
 * suite drive it in Node, over node:sqlite, whose statements run synchronously exactly as the object's do.
 */
import { BOOK_NAME, OPEN_STATES, LAST_PLACED, LAST_TOUCHED, LAST_SAID, LAST_THEIRS, FROZEN, ROAD_KEY, decidePlace, decideCustomer, decideDesk,
  applyEvent, marksOf, wakes, isClaimId, decideAccountClaim, decideClaimDesk } from "./orders.js";

export { BOOK_NAME };
const MARKS = { last: LAST_PLACED, touched: LAST_TOUCHED, said: LAST_SAID, theirs: LAST_THEIRS };
export const FREEZE_MS = 60000;
/* past KV's cache life, counted from the END of the start copy (S10 fix DS3): a key the start pass read is
   served from this location's cache for a minute after THAT read, so an end inside the minute reads the start
   pass's own value back and misses what the old code wrote since */
export const FREEZE_SPARE_MS = 5000;
/* how often a moved-in book looks for the KV road's mark: once a minute, and at once in a new instance, which
   is what a deploy (the flip back included) makes */
const ROAD_MS = 60000;
/* a write behind waits past KV's one write a second per key */
export const BEHIND_MS = 1100;
/* a KV record as this book would write it, or null */
const norm = (raw) => { try { const o = JSON.parse(raw); return o && typeof o === "object" ? JSON.stringify(o) : null; } catch (e) { return null; } };
/* what writes: refused while the book is moving in. Not "drop": his test account unmade is gone from KV first,
   so no pass brings it back, and it reaches the book from the kv road too (S10 fix P3), where it must neither
   wait on a move-in nor start one */
const WRITES = ["place", "customer", "desk", "chase", "aclaim", "adesk"];
/* S6 6.6: an account claim lives beside the orders, in its own table and under its own KV prefix */
const TABLE = (oid) => (isClaimId(oid) ? "acl" : "ord");
const KVKEY = (u, oid) => (isClaimId(oid) ? "aclaim:" : "order:") + u + ":" + oid;

export class OrderBook {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    const sql = state.storage.sql;
    sql.exec("CREATE TABLE IF NOT EXISTS ev (seq INTEGER PRIMARY KEY AUTOINCREMENT, eid TEXT NOT NULL UNIQUE, u TEXT NOT NULL, oid TEXT NOT NULL, kind TEXT NOT NULL, at TEXT NOT NULL, body TEXT NOT NULL)");
    sql.exec("CREATE TABLE IF NOT EXISTS ord (u TEXT NOT NULL, oid TEXT NOT NULL, at TEXT NOT NULL, doc TEXT NOT NULL, PRIMARY KEY (u, oid))");
    sql.exec("CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)");
    sql.exec("CREATE TABLE IF NOT EXISTS behind (u TEXT NOT NULL, oid TEXT NOT NULL, PRIMARY KEY (u, oid))");
    sql.exec("CREATE TABLE IF NOT EXISTS acl (u TEXT NOT NULL, oid TEXT NOT NULL, at TEXT NOT NULL, doc TEXT NOT NULL, PRIMARY KEY (u, oid))");
  }

  async fetch(request) {
    const op = new URL(request.url).pathname.slice(1);
    let a = null;
    try { a = await request.json(); } catch (e) { a = null; }
    if (op !== "drop") await this.moveIn(true);
    if (op === "check") return Response.json(await this.check());
    const out = this.run(op, a && typeof a === "object" ? a : {});
    if (out.ok && out.order && !out.again && !out.none && this.writesKv()) await this.arm();
    return Response.json(out);
  }
  /* the end of the minute, with or without a request to notice it; once moved in, the writes behind */
  async alarm() {
    await this.moveIn(false);
    if (this.frozen()) {
      const end = +(this.meta("movein:" + this.want()) || 0);
      if (end) await this.state.storage.setAlarm(end);
      return;
    }
    await this.writeBehind();
  }

  /* ---- written behind (S10 fixes R1, P1, DS2) ---- */
  writesKv() { return !!(this.env && this.env.STMT) && this.env.ORDER_STORE === "object+kv"; }
  async arm() {
    const t = Date.now() + BEHIND_MS, cur = await this.state.storage.getAlarm();
    if (cur == null || cur <= Date.now() || cur > t) await this.state.storage.setAlarm(t);
  }
  async writeBehind() {
    const kv = this.env && this.env.STMT;
    if (!kv) return;
    let left = 0;
    for (const { u, oid } of this.state.storage.sql.exec("SELECT u, oid FROM behind").toArray()) {
      const key = KVKEY(u, oid);
      let raw, doc;
      try { raw = norm(await kv.get(key)); }
      catch (e) { left++; console.log("orderbook: " + key + " not read, tried again in a second: " + String((e && e.message) || e)); continue; }
      doc = this.doc(u, oid);
      if (doc == null || raw === doc) { this.unbehind(u, oid); continue; }
      if (raw != null && !this.held(u, oid, raw)) {
        this.unbehind(u, oid);
        console.log("orderbook: " + key + " in KV is a state the book never held; left as it is");
        continue;
      }
      try { await kv.put(key, doc); }
      catch (e) { left++; console.log("orderbook: " + key + " not written behind, tried again in a second: " + String((e && e.message) || e)); continue; }
      /* a move taken while the put was on its way leaves the order named: the next pass writes it */
      if (this.doc(u, oid) === doc) this.unbehind(u, oid); else left++;
    }
    if (left) await this.arm();
  }
  unbehind(u, oid) { this.state.storage.sql.exec("DELETE FROM behind WHERE u = ? AND oid = ?", u, oid); }
  behind(u, oid) { this.state.storage.sql.exec("INSERT OR IGNORE INTO behind (u, oid) VALUES (?, ?)", u, oid); }
  isBehind(u, oid) { return this.state.storage.sql.exec("SELECT 1 FROM behind WHERE u = ? AND oid = ?", u, oid).toArray().length > 0; }
  /* whether the order ever stood as `raw` in this book: its events folded one at a time, compared after each */
  held(u, oid, raw) {
    let o = null;
    for (const r of this.state.storage.sql.exec("SELECT body FROM ev WHERE u = ? AND oid = ? ORDER BY seq", u, oid).toArray()) {
      o = applyEvent(o, JSON.parse(r.body)).order;
      if (JSON.stringify(o) === raw) return true;
    }
    return false;
  }

  /* ---- the hourly check (S10 10.3; fixes DS1, R2, P2, DS2, P1) ---- */
  async check() {
    if (this.frozen()) return { ok: false, frozen: true, error: FROZEN, status: 503 };
    const kv = this.env && this.env.STMT;
    if (!kv) return { ok: false, error: "no KV", status: 500 };
    const seen = new Set(), repaired = [], kvAhead = [], kvOnly = [], bookOnly = [];
    let same = 0, pending = 0, cursor;
    do {
      const page = await kv.list({ prefix: "order:", cursor });
      for (const k of page.keys) {
        const raw = norm(await kv.get(k.name)), o = raw && JSON.parse(raw);
        if (!o || !o.id || !o.u) continue;
        seen.add(o.u + ":" + o.id);
        const doc = this.doc(o.u, o.id);   /* read after KV answered: a move taken meanwhile is in it */
        if (doc == null) kvOnly.push(o.id);
        else if (raw === doc) same++;
        else if (!this.held(o.u, o.id, raw)) kvAhead.push(o.id);
        else if (this.isBehind(o.u, o.id)) pending++;
        else { this.behind(o.u, o.id); repaired.push(o.id); }
      }
      cursor = page.list_complete ? null : page.cursor;
    } while (cursor);
    const all = this.state.storage.sql.exec("SELECT u, oid FROM ord").toArray();
    for (const r of all) if (!seen.has(r.u + ":" + r.oid)) { if (this.isBehind(r.u, r.oid)) pending++; else bookOnly.push(r.oid); }
    if (repaired.length) await this.arm();
    return { ok: true, orders: all.length, same, pending, repaired, kvAhead, kvOnly, bookOnly };
  }

  /* ---- moving in (S10 10.3) ---- */
  gen() { return String((this.env && this.env.ORDER_MOVE_IN) || "1"); }
  /* the round this book is to be moved in for: the generation, or a later round of it the KV road's mark asked for */
  want() { const w = this.meta("movein:want"), g = this.gen(); return w && w.split("@")[0] === g ? w : g; }
  frozen() { return this.meta("movein:done") !== this.want(); }
  async roadCheck() {
    const kv = this.env && this.env.STMT;
    if (!kv || (this.roadAt && Date.now() - this.roadAt < ROAD_MS)) return;
    this.roadAt = Date.now();
    let road = null;
    try { road = await kv.get(ROAD_KEY); } catch (e) { return; }
    if (road && road > (this.meta("movein:at") || "")) this.setMeta("movein:want", this.gen() + "@" + road);
  }
  /* a request looks for the KV road's mark first; the alarm does not, so a write behind still retrying after a
     flip to "kv" never starts a move-in the site is not using */
  async moveIn(road) {
    if (road && !this.frozen()) await this.roadCheck();
    if (!this.frozen()) return;
    /* one run at a time: a request arriving while a pass reads KV waits for the same pass */
    if (!this.moving) this.moving = this.movePass().finally(() => { this.moving = null; });
    return this.moving;
  }
  async movePass() {
    const gen = this.want(), until = +(this.meta("movein:" + gen) || 0);
    if (!until) {
      const c = await this.copy(gen, "start");
      const end = Date.now() + FREEZE_MS + FREEZE_SPARE_MS;
      this.setMeta("movein:" + gen, String(end));
      await this.state.storage.setAlarm(end);
      console.log("orderbook: moving in, generation " + gen + ", frozen for a minute: " + JSON.stringify(c));
    } else if (Date.now() >= until) {
      const c = await this.copy(gen, "end");
      this.setMeta("movein:done", gen);
      this.setMeta("movein:at", new Date().toISOString());
      console.log("orderbook: moved in, generation " + gen + ": " + JSON.stringify(c));
    }
  }
  /* every KV order in, as an event of its own, and the shared and chase marks beside them: at either pass the
     later of KV's and the book's, so a chase the KV road marked while the book was frozen is not sent twice */
  async copy(gen, pass) {
    const kv = this.env && this.env.STMT;
    if (!kv) return { orders: 0, took: 0 };
    let cursor, orders = 0, took = 0;
    for (const prefix of ["order:", "aclaim:"]) {   /* S6 6.6: and the account claims the KV road took */
      cursor = undefined;
      do {
        const page = await kv.list({ prefix, cursor });
        for (const k of page.keys) {
          let o = null;
          try { o = JSON.parse(await kv.get(k.name)); } catch (e) { o = null; }
          if (!o || !o.id || !o.u || isClaimId(o.id) !== (prefix === "aclaim:")) continue;
          orders++;
          if (this.takeIn(o, "copy:" + gen + ":" + pass + ":" + o.u + ":" + o.id)) took++;
        }
        cursor = page.list_complete ? null : page.cursor;
      } while (cursor);
    }
    for (const key of Object.values(MARKS)) { const v = await kv.get(key), b = this.meta(key); if (v != null && (b == null || v > b)) this.setMeta(key, v); }
    const ch = await kv.list({ prefix: "chased:" });
    for (const k of ch.keys) { const v = await kv.get(k.name), b = this.meta(k.name); if (v != null && (b == null || +v > +b)) this.setMeta(k.name, v); }
    /* A RETRY ACROSS THE SWITCH LANDS ONCE (S10 fix DS4): the KV road files the id of a placement or a payment at
       rid:<username>:<id> for a day, and a page keeps its id through a lost answer, so each live one is filed here
       under both ids a repeat is looked for by, an event that folds to nothing */
    const rids = await kv.list({ prefix: "rid:" });
    for (const k of rids.keys) {
      const [, u, rid] = k.name.split(":");
      let seen = null;
      try { seen = JSON.parse(await kv.get(k.name)); } catch (e) { seen = null; }
      if (!u || !rid || !seen || !seen.id || this.doc(u, seen.id) == null) continue;
      const body = JSON.stringify({ kind: "rid", at: new Date().toISOString() });
      for (const eid of ["c:" + u + ":place:" + rid, "c:" + u + ":" + seen.id + ":" + rid])
        this.state.storage.sql.exec("INSERT OR IGNORE INTO ev (eid, u, oid, kind, at, body) VALUES (?, ?, ?, 'rid', ?, ?)", eid, u, seen.id, new Date().toISOString(), body);
    }
    return { orders, took };
  }
  takeIn(o, eid) {
    const cur = this.doc(o.u, o.id), raw = JSON.stringify(o);
    if (cur === raw) return false;
    /* KV holds a state this book has held: KV is behind, so the book's stands and is written behind */
    if (cur != null && this.held(o.u, o.id, raw)) { if (this.writesKv()) this.behind(o.u, o.id); return false; }
    if (this.event(eid)) return false;
    this.append(eid, o.u, o.id, { kind: "copy", at: new Date().toISOString(), order: o }, null);
    return true;
  }

  /* every answer is { ok, ... } or { ok: false, error, status }, and nothing here awaits */
  run(op, a) {
    const at = new Date().toISOString();
    if (WRITES.includes(op) && this.frozen()) return { ok: false, error: FROZEN, status: 503, frozen: true };
    if (op === "orders") return { ok: true, orders: a.u ? this.ordersOf(String(a.u)) : this.all() };
    /* S6 6.6: the account claims, one customer's or all, newest first */
    if (op === "claims") return { ok: true, claims: this.state.storage.sql.exec("SELECT doc FROM acl" + (a.u ? " WHERE u = ?" : "") + " ORDER BY at DESC", ...(a.u ? [String(a.u)] : [])).toArray().map((r) => JSON.parse(r.doc)) };
    if (op === "aclaim") {
      const u = String(a.u || ""), eid = a.rid ? "c:" + u + ":aclaim:" + a.rid : null;
      const seen = eid ? this.event(eid) : null;
      if (seen) return { ok: true, order: this.order(seen.u, seen.oid), again: true };
      const waiting = this.state.storage.sql.exec("SELECT doc FROM acl WHERE u = ?", u).toArray().map((r) => JSON.parse(r.doc)).filter((c) => c.state === "waiting");
      const d = decideAccountClaim(u, a.body, waiting, at);
      if (d.error) return { ok: false, error: d.error, status: d.status || 400 };
      return this.append(eid, u, d.ev.claim.id, d.ev, null);
    }
    /* his Received or Not found on one, as one event (S6 11.14) */
    if (op === "adesk") {
      const u = String(a.u || ""), id = String(a.id || "");
      const claim = isClaimId(id) ? this.order(u, id) : null;
      const d = decideClaimDesk(claim, a.body, at);
      if (d.error) return { ok: false, error: d.error, status: d.status || 400 };
      return this.append(null, u, id, d.ev, claim);
    }
    if (op === "last") {
      const out = { ok: true };
      for (const [k, key] of Object.entries(MARKS)) out[k] = this.meta(key);
      return out;
    }
    if (op === "place") {
      const u = String(a.u || ""), eid = a.rid ? "c:" + u + ":place:" + a.rid : null;
      const seen = eid ? this.event(eid) : null;
      if (seen) return { ok: true, order: this.order(seen.u, seen.oid), again: true };
      const d = decidePlace(u, a.body, this.ordersOf(u).filter((o) => OPEN_STATES.includes(o.status)), at, a.digest);
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
    /* THE CHASE MARK lives here with the orders it follows: true when this slot's wake (S12 12.3) is still to be
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
        this.state.storage.sql.exec("DELETE FROM acl WHERE u = ?", u);
        this.state.storage.sql.exec("DELETE FROM behind WHERE u = ?", u);
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
      sql.exec("INSERT OR REPLACE INTO " + TABLE(oid) + " (u, oid, at, doc) VALUES (?, ?, ?, ?)", u, oid, String(r.order.at || ev.at), JSON.stringify(r.order));
      for (const [k, v] of marksOf(ev, r.order)) this.setMeta(k, v);
      if (ev.kind !== "copy" && this.writesKv()) sql.exec("INSERT OR IGNORE INTO behind (u, oid) VALUES (?, ?)", u, oid);
      out = { ok: true, order: r.order, wake: wakes(ev, r.order, r.done) };   /* the wake and its S12 kind, or null */
    });
    return out;
  }

  event(eid) { return this.state.storage.sql.exec("SELECT u, oid FROM ev WHERE eid = ?", eid).toArray()[0] || null; }
  doc(u, oid) { const r = this.state.storage.sql.exec("SELECT doc FROM " + TABLE(oid) + " WHERE u = ? AND oid = ?", u, oid).toArray()[0]; return r ? r.doc : null; }
  order(u, oid) { const d = this.doc(u, oid); return d == null ? null : JSON.parse(d); }
  ordersOf(u) { return this.state.storage.sql.exec("SELECT doc FROM ord WHERE u = ? ORDER BY at DESC", u).toArray().map((r) => JSON.parse(r.doc)); }
  all() { return this.state.storage.sql.exec("SELECT doc FROM ord ORDER BY at DESC").toArray().map((r) => JSON.parse(r.doc)); }
  meta(k) { const r = this.state.storage.sql.exec("SELECT v FROM meta WHERE k = ?", k).toArray()[0]; return r ? r.v : null; }
  setMeta(k, v) { this.state.storage.sql.exec("INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)", k, String(v)); }
}
