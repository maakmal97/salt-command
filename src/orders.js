/* src/orders.js: THE ORDER BOOK, SEEN FROM THE LEDGER'S SIDE (his instruction, 06 Sep 2026).
 *
 * The orders live on the statements site, in that Worker's own store, placed by customers on a
 * session (stmt/orders.js). This Worker is the only thing that reads them for him: it holds the
 * shared key STMT_DESK_KEY and reaches the site over a SERVICE BINDING (STMT_SITE in
 * wrangler.jsonc), so the phone talks to the desk it already talks to, with the write key it
 * already holds, and the site keeps having no route to the desk, no key of the desk's and no
 * idea the desk exists. The direction is desk to site, never the other way.
 *
 * WHAT THIS ADDS TO AN ORDER IS THE CODE. The site knows a username; the book knows a code. The
 * deploy writes the map (stmt-users, username to code) into THIS Worker's store on every publish,
 * and it is joined here. The site never holds it.
 *
 * WHAT COMPLETION DOES. "Done" is the owner's word that the goods are handed over and the money
 * is in. That is a sale, and a sale reaches the book by the one road every sale takes: a queue
 * entry, drafted, approved on the phone, staged, folded, deployed. So done writes an entry into
 * the queue under its own device, q:orders, shaped exactly as the Workbench shapes one, and the
 * drafter drafts it on arrival. Nothing here writes a row. The live statement follows the fold,
 * which is what "an updated statement after completion" means on this book.
 */
import { sendPush } from "./push.js";
import { readBook } from "./drafter.js";

const DEVICE = "orders";
const MARK = "orders:nudged";

function site(env, path, init) {
  if (!env.STMT_SITE || !env.STMT_DESK_KEY) return null;
  const h = Object.assign({ "X-Stmt-Desk": env.STMT_DESK_KEY }, (init && init.headers) || {});
  return env.STMT_SITE.fetch("https://stmt" + path, Object.assign({}, init || {}, { headers: h }));
}

export async function usersMap(env) {
  try { return (await env.SALT_QUEUE.get("stmt-users", "json")) || {}; } catch { return {}; }
}

/** Every open order (or all with `all`), each with the desk code the username maps to. */
export async function listOrders(env, all) {
  const r = await site(env, "/desk/orders" + (all ? "?all=1" : ""));
  if (!r) return { ok: false, error: "the order relay is not configured (STMT_SITE binding and STMT_DESK_KEY secret)" };
  const b = await r.json().catch(() => ({}));
  if (!r.ok || !b.ok) return { ok: false, error: b.error || ("the statements site answered http " + r.status) };
  const users = await usersMap(env);
  return { ok: true, orders: (b.orders || []).map((o) => Object.assign({ code: users[o.u] || null }, o)) };
}

/** Forward the owner's move. Returns the site's answer with the code joined. */
export async function moveOrder(env, u, id, body) {
  const r = await site(env, "/desk/orders/" + encodeURIComponent(u) + "/" + encodeURIComponent(id), {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {})
  });
  if (!r) return { ok: false, status: 503, error: "the order relay is not configured (STMT_SITE binding and STMT_DESK_KEY secret)" };
  const b = await r.json().catch(() => ({}));
  if (!r.ok || !b.ok) return { ok: false, status: r.status, error: b.error || ("the statements site answered http " + r.status) };
  const users = await usersMap(env);
  return { ok: true, order: Object.assign({ code: users[b.order.u] || null }, b.order), push: b.push };
}

/* ---- AN ORDER REACHES THE BOOK IN STAGES (v694, his instruction of 18 Sep 2026) ---------------
 * It used to reach it once, at the end, as a sale paid and delivered in full on the day. He asked
 * for the truth as it happens: the row appears when he acknowledges the order, with nothing paid
 * and nothing moved, and every later step amends it. Each stage is its own queue entry and each
 * one waits under Approve, so nothing enters the book unapproved: Site orders moves the order,
 * Approve lands the row.
 *
 * WHICH ROW A LATER STAGE AMENDS. A rid is minted at fold time and there is no route back from the
 * desk to the site, so the site can never learn it. The desk remembers the other identifier the
 * drafter takes, the open-order key `<code>|<date>|<total>`, at the moment it queues the pending
 * row, and writes it onto the order record. Every later amendment names that key. It is exactly
 * what the Whiteboard's own Amend tab sends.
 *
 * WHY A FULFILMENT FOR MONEY AND A CORRECTION FOR THE HANDOVER. A Fulfilment accumulates cash and
 * units, which is what a payment is: the customer types what they paid and it adds to what is in.
 * A handover also has to say WHEN and BY WHOM (deliveredOn, handover), which only a Correction may
 * set, and a Correction states figures rather than adding them, so it carries the running total of
 * what has been handed over. Both kinds are among the four the drafter accepts. */
/* IT IS THE ENGINE'S ovKey AND NOTHING ELSE: `${party}|${date}|${total}`, the total as the row
   carries it. It was written here with toFixed(2) and every amendment missed its row by the two
   noughts, which is the sort of thing that only shows when the chain is driven end to end. */
export const orderKeyFor = (code, date, total) => code + "|" + date + "|" + (+total);
const klDate = (now) => (now instanceof Date ? now : new Date(now || Date.now()))
  .toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });

/** The pending row an acknowledged order becomes: agreed, nothing paid, nothing moved. */
export function pendingEntry(order, code, now) {
  const at = now instanceof Date ? now : new Date(now || Date.now());
  const date = klDate(at);
  const delivery = +(order.delivery || 0);
  const total = +(order.total + delivery).toFixed(2);
  /* the general location the customer typed stays on the site, on his card: a note reaches the
     committed book, and free text a customer typed is the one thing here that could carry a street */
  const note = "Ordered on the statements site, order " + order.id + ", acknowledged"
    + (order.mode === "deliver" ? ", to be delivered" : ", to collect")
    + (delivery > 0 ? ", delivery RM " + delivery : "") + ". Nothing paid and nothing handed over yet.";
  const raw = "SELL " + code + " " + order.qty + " " + (order.product || "salt") + " RM " + total
    + ", nothing paid, nothing moved (order " + order.id + ")";
  return {
    at: at.toISOString(), type: "SELL", party: code, qty: order.qty, total, status: "Pending", raw,
    orderKey: orderKeyFor(code, date, total),
    payload: { mode: "new", product: order.product || "salt", direction: "SELL", party: code, newId: null,
      date, qty: order.qty, total, delivery, cash: 0, kg: 0,
      assoc: null, stream: null, downstream: null, kind: null, orderCode: null, linkTo: null, note,
      handover: null, second: null }
  };
}

/** What a customer paid, as a Fulfilment against the row the acknowledgement made. */
export function payEntry(order, code, amount, now) {
  const at = now instanceof Date ? now : new Date(now || Date.now());
  const date = klDate(at);
  const cash = +(+amount).toFixed(2);
  const method = order.method ? (order.method + (order.account ? " via " + order.account : "")) : "not stated";
  return {
    at: at.toISOString(), type: "SELL", party: code, qty: 0, total: cash, status: "Payment",
    raw: "Payment of RM " + cash + " on " + code + ", order " + order.id + ", by " + method,
    payload: { mode: "amend", kind: "Fulfilment", direction: "SELL", party: code, rid: null,
      orderKey: order.ledgerKey || null, orderCode: null, linkTo: null, assoc: null, downstream: null,
      date, qty: 0, total: 0, cash, kg: 0,
      note: "Paid on the statements site, order " + order.id + ", by " + method + "." }
  };
}

/** What was handed over, as a Correction: the running total, the day, and who moved it. */
export function handoverEntry(order, code, units, now) {
  const at = now instanceof Date ? now : new Date(now || Date.now());
  const date = klDate(at);
  const moved = +(+units).toFixed(2);
  const how = order.mode === "deliver" ? "delivered" : "collected";
  return {
    at: at.toISOString(), type: "SELL", party: code, qty: moved, total: 0, status: "Handover",
    raw: moved + " unit " + how + " to " + code + ", order " + order.id + ", on " + date,
    payload: { mode: "amend", kind: "Correction", direction: "SELL", party: code, rid: null,
      orderKey: order.ledgerKey || null, orderCode: null, linkTo: null, assoc: null, downstream: null,
      date, qty: 0, total: 0, cash: 0, kg: 0,
      fields: { deliveredQty: moved, deliveredOn: date, handover: how },
      note: moved + " unit " + how + " for order " + order.id + "." }
  };
}

/** Either side withdrew it: the row is cancelled, and the fold raises any refund itself. */
export function cancelEntry(order, code, why, now) {
  const at = now instanceof Date ? now : new Date(now || Date.now());
  const date = klDate(at);
  return {
    at: at.toISOString(), type: "SELL", party: code, qty: 0, total: 0, status: "Cancellation",
    raw: "Cancellation on " + code + ", order " + order.id + ", recorded " + date,
    payload: { mode: "amend", kind: "Cancellation", direction: "SELL", party: code, rid: null,
      orderKey: order.ledgerKey || null, orderCode: null, linkTo: null, assoc: null, downstream: null,
      date, qty: 0, total: 0, cash: 0, kg: 0,
      note: "Withdrawn on the statements site by " + (why === "desk" ? "the desk" : "the customer") + ", order " + order.id + "." }
  };
}

/** Append one entry to the orders device's queue. Per-device replace, as the phone does. */
export async function queueSale(env, entry) {
  const cur = (await env.SALT_QUEUE.get("q:" + DEVICE, "json")) || { device: DEVICE, queue: [] };
  cur.queue = (cur.queue || []).concat([entry]);
  cur.updated = entry.at;
  await env.SALT_QUEUE.put("q:" + DEVICE, JSON.stringify(cur));
  return cur.queue.length;
}

/* ---- THE RECONCILE (v694): THE ONE ROAD FROM A STAGE TO THE QUEUE -----------------------------
 * It runs on the every-minute cron and nowhere else, so there is exactly one writer and a stage
 * cannot be queued twice by two roads racing. The site decides what is owed (orderWork there, on
 * the record that holds the marks); this queues it and writes back what it queued, per order, the
 * moment it is queued, so a failure halfway leaves the rest owed rather than lost.
 *
 * A MINUTE IS NOT A DELAY THAT MATTERS: the entry still has to be drafted and then approved under
 * Approve, and the customer's card says so while it waits.
 */
export async function reconcileOrders(env) {
  const r = await site(env, "/desk/orders?work=1");
  if (!r) return { ok: false, error: "the order relay is not configured (STMT_SITE binding and STMT_DESK_KEY secret)" };
  const b = await r.json().catch(() => ({}));
  if (!r.ok || !b.ok) return { ok: false, error: b.error || ("the statements site answered http " + r.status) };
  const owing = b.orders || [];
  if (!owing.length) return { ok: true, queued: 0 };
  const users = await usersMap(env);
  /* AN AMENDMENT WAITS FOR ITS ROW. The pending row reaches the book by the long road: queued,
     drafted, approved, folded, and the mirror re-seeded. Until it is there, nothing can be amended,
     and queueing the amendment anyway would put a refusal on his phone every time a customer paid
     early. So the same question the drafter would ask is asked one step earlier, and a stage that
     cannot land yet simply stays owed. A mirror that cannot be read holds everything, rather than
     queueing what would be refused. */
  const book = await readBook(env.SALT_LEDGER).catch(() => null);
  const onBook = (book && book.state && book.state.OPEN && book.state.OPEN.byKey) || null;
  const now = new Date();
  let queued = 0; const unmapped = [], failed = [], waiting = [];
  for (const o of owing) {
    const code = users[o.u] || null;
    /* no code, no row: the test account and any account published since the last map land here,
       and they wait rather than being guessed at */
    if (!code) { unmapped.push(o.id); continue; }
    const q = o.queued || {}, mark = {}; const order = Object.assign({}, o);
    try {
      for (const job of o.work || []) {
        let e = null;
        if (job !== "ack" && !(onBook && onBook[order.ledgerKey])) { waiting.push(o.id); break; }
        if (job === "ack") { e = pendingEntry(order, code, now); mark.ledgerKey = e.orderKey; order.ledgerKey = e.orderKey; mark.ack = e.at; }
        else if (job === "pay") { e = payEntry(order, code, +((+order.paid || 0) - (+q.paid || 0)).toFixed(2), now); mark.paid = +(+order.paid || 0).toFixed(2); }
        else if (job === "move") { e = handoverEntry(order, code, +order.moved || 0, now); mark.moved = +(+order.moved || 0).toFixed(3); }
        else if (job === "cancel") { e = cancelEntry(order, code, order.status === "declined" ? "desk" : "customer", now); mark.cancel = e.at; }
        if (e) { await queueSale(env, e); queued++; }
      }
      if (Object.keys(mark).length) {
        const m = await site(env, "/desk/orders/" + encodeURIComponent(o.u) + "/" + encodeURIComponent(o.id), {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mark })
        });
        if (!m || !m.ok) failed.push(o.id);
      }
    } catch (e) { failed.push(o.id); }
  }
  return Object.assign({ ok: true, queued }, unmapped.length ? { unmapped } : {},
    waiting.length ? { waiting } : {}, failed.length ? { failed } : {});
}

/** How many customer orders are waiting on him: placed, and acknowledged but not yet ready. */
export async function ordersWaiting(env) {
  const r = await listOrders(env, false);
  if (!r.ok) return 0;
  return r.orders.filter((o) => o.status === "placed" || o.status === "acknowledged").length;
}

/* THE NUDGE, every minute (16 Sep 2026; it was the drafter's quarter-hour, and nothing had
   subscribed since v387, so an order arrived in silence). The site cannot reach this Worker, so a
   new order is noticed here, by asking the site for the moment of its newest placement: one read,
   not a listing. Anything newer than the mark wakes the phones that asked for orders, once. */
export async function nudgeOrders(env) {
  const r = await site(env, "/desk/orders/last");
  if (!r) return { ok: false, error: "the order relay is not configured (STMT_SITE binding and STMT_DESK_KEY secret)" };
  const b = await r.json().catch(() => ({}));
  if (!r.ok || !b.ok) return { ok: false, error: b.error || ("the statements site answered http " + r.status) };
  const newest = b.last || null;
  const mark = (await env.SALT_QUEUE.get(MARK)) || "";
  if (!newest || newest <= mark) return { ok: true, sent: 0 };
  await env.SALT_QUEUE.put(MARK, newest);
  const p = await sendPush(env, { tag: "orders", urgency: "high" });
  return { ok: true, sent: p.sent || 0, newest };
}
