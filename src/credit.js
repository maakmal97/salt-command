/* src/credit.js: A REFUND BECOMES THEIR CREDIT, the Worker's half (27 Oct 2026, his word; docs/plan-refund-credit.html P2).
 * Every open refund of theirs is credit, which his Accept spends as cash already paid on the new order's row (the entry's
 * payload.credit, the row's `credit`), and the fold closes (the engine's setOffCredit). Between the Accept and the fold the
 * book still shows the refund open, so a second Accept would spend it again: what is left is the open refunds LESS the credit
 * every unfolded Accept carries. That is read here and nowhere else: the drafts on their way by the book's own bound (pending,
 * or approved and not yet in the book read), and the orders queue's entries no draft holds yet, one an `at`. A rejected draft
 * is neither and its entry is dropped from every queue (dropQueued), so its credit is free again; one the fold booked is in the
 * book, its refunds closed. The arithmetic is the engine's creditOf. */
import POSITION_ENGINE from "../engine/position.mjs";
import { onItsWay, boundOf } from "./way.js";

const QUEUE = "q:orders";   /* the orders device's keys, src/orders.js DEVICE: the only road that queues an Accept */
export const spendsCredit = (e) => !!(e && e.payload && e.payload.mode === "new" && e.payload.direction !== "BUY" && +e.payload.credit > 0.004);

/** The unfolded entries that spend credit, against `book` (its bound decides what the book already holds). */
export async function creditOnWay(env, book) {
  const db = env.SALT_LEDGER, out = new Map();
  if (db) {
    const rs = await db.prepare("SELECT id, entry FROM draft WHERE " + onItsWay(boundOf(book)) + " AND entry LIKE ?1").bind('%"credit":%').all();
    for (const r of rs.results || []) {
      let e = null; try { e = JSON.parse(r.entry); } catch (x) { e = null; }
      if (spendsCredit(e)) out.set(e.at || r.id, e);
    }
  }
  if (env.SALT_QUEUE) {
    const queued = [];
    let cursor;
    do {
      const list = await env.SALT_QUEUE.list({ prefix: QUEUE, cursor });
      for (const k of list.keys) {
        let v = null; try { v = JSON.parse((await env.SALT_QUEUE.get(k.name)) || "null"); } catch (x) { v = null; }
        for (const e of (v && Array.isArray(v.queue) && v.queue) || []) if (spendsCredit(e) && !out.has(e.at)) queued.push(e);
      }
      cursor = list.list_complete ? null : list.cursor;
    } while (cursor);
    /* a queued entry whose draft exists is that draft's: on its way above, or decided (rejected, or in the book) and spent no more */
    const drafted = new Set();
    for (let i = 0; db && i < queued.length; i += 100) {
      const part = queued.slice(i, i + 100).map((e) => e.at);
      const rs = await db.prepare("SELECT id FROM draft WHERE id IN (" + part.map((x, j) => "?" + (j + 1)).join(",") + ")").bind(...part).all();
      for (const r of rs.results || []) drafted.add(r.id);
    }
    for (const e of queued) if (!drafted.has(e.at)) out.set(e.at, e);
  }
  return [...out.values()];
}

/** What `code` may spend now: their open refunds (book.customerRefunds, withRefunds) less the credit on its way. `way`, read once
 *  by the caller, saves a second read. */
export async function creditFor(env, book, code, way) {
  const w = way || await creditOnWay(env, book);
  return POSITION_ENGINE.creditOf((book && book.customerRefunds) || [], code, w.map((e) => ({ party: e.payload.party, credit: +e.payload.credit })));
}
