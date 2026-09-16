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

/** The queue entry a completed order becomes: the Workbench's own shape, cash and units in full. */
export function saleEntry(order, code, now) {
  const at = now instanceof Date ? now : new Date(now || Date.now());
  const date = at.toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });
  const method = order.method ? (order.method + (order.account ? " via " + order.account : "")) : "not stated";
  /* v502: the total to pay is the goods plus the delivery typed at ready; delivery rides as its own field */
  const delivery = +(order.delivery || 0);
  const total = +(order.total + delivery).toFixed(2);
  const note = "Ordered on the statements site, order " + order.id + ", " + (order.mode === "deliver" ? "delivered" : "collected")
    + (delivery > 0 ? ", delivery RM " + delivery : "") + ", paid by " + method + ".";
  const raw = "SELL " + code + " " + order.qty + " " + (order.product || "salt") + " RM " + total
    + ", RM " + total + " cash, " + order.qty + " moved (order " + order.id + ")";
  return {
    at: at.toISOString(), type: "SELL", party: code, qty: order.qty, total, status: "Completed", raw,
    payload: { mode: "new", product: order.product || "salt", direction: "SELL", party: code, newId: null,
      date, qty: order.qty, total, delivery, cash: total, kg: order.qty,
      assoc: null, stream: null, downstream: null, kind: null, orderCode: null, linkTo: null, note,
      handover: order.mode === "deliver" ? "delivered" : "collected" }
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
