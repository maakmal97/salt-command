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
 *   ev    every move, appended and never changed
 *   ord   each order as the fold of its events, kept beside them so a read is one select
 *   meta  the site's shared marks
 *
 * A PLAIN CLASS WITH fetch(), not an RPC class: that would extend `cloudflare:workers`, which is not a
 * sibling file, and nothing under stmt/ imports anything else (the suite checks). It is also what lets the
 * suite drive it in Node, over node:sqlite, whose statements run synchronously exactly as the object's do.
 */
export const BOOK_NAME = "site";

export class OrderBook {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    const sql = state.storage.sql;
    sql.exec("CREATE TABLE IF NOT EXISTS ev (seq INTEGER PRIMARY KEY AUTOINCREMENT, eid TEXT NOT NULL UNIQUE, u TEXT NOT NULL, oid TEXT NOT NULL, kind TEXT NOT NULL, at TEXT NOT NULL, body TEXT NOT NULL)");
    sql.exec("CREATE TABLE IF NOT EXISTS ord (u TEXT NOT NULL, oid TEXT NOT NULL, at TEXT NOT NULL, doc TEXT NOT NULL, PRIMARY KEY (u, oid))");
    sql.exec("CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)");
  }

  /* IDLE (10.1): bound and deployed, and nothing on the site calls it yet. */
  async fetch(request) {
    const op = new URL(request.url).pathname.slice(1);
    if (op === "orders") return Response.json({ ok: true,
      orders: this.state.storage.sql.exec("SELECT doc FROM ord ORDER BY at DESC").toArray().map((r) => JSON.parse(r.doc)) });
    return Response.json({ ok: false, error: "not found", status: 404 }, { status: 404 });
  }
}
