/* stmt/orders.js: THE ORDER BOOK ON THE STATEMENTS SITE (his instruction, 06 Sep 2026).
 *
 * A customer who has opened his statement can place an order: a size off his own price list,
 * collected or delivered, and the total the list quoted. That is the third thing the site does,
 * after the statements and the price list, and this file is the whole of its state machine.
 *
 * WHAT AN ORDER IS. One record, order:<username>:<id>, in this site's own store:
 *   { id, u, product, qty, mode, unit, total, week, at, status, history[], method?, account? }
 * Plaintext, unlike everything else here, and the reason is stated rather than hidden: the
 * record is written at runtime by the customer, and this Worker holds no key to seal it with.
 * It carries a size, a quoted total and a state; no name, no code, no address. The desk code
 * that names the account is resolved on the ledger's own Worker from its own store, so nothing
 * here says which account on the book a username is.
 *
 * THE STATES, AND WHO MOVES THEM:
 *   placed        the customer, on the page
 *   acknowledged  the owner, from the phone: seen, and being prepared
 *   ready         the owner: ready to collect, or ready to deliver (`mode` says which)
 *   done          the owner: handed over and paid, which is the moment the sale is queued for
 *                 the ledger and the live statement follows on the next fold
 *   declined      the owner, at any open state
 *   cancelled     the customer, while the order is placed or acknowledged and nothing is on the road
 * PAYMENT IS OFFERED ONLY AT ready. Until the owner says the order is ready the page shows the
 * state and nothing else; at ready the customer picks the rail (cash on collection or delivery,
 * DuitNow Transfer to a named account, a DuitNow QR to save, JomPAY, or the Touch 'n Go Business
 * code) and the page hands him one link into QR Command. The choice is written back so the owner
 * can see how the money is coming. The list of accounts is stmt/pay.js, generated from the pay
 * master, and a choice naming an account that list does not carry, or a rail that account does
 * not run, is refused.
 *
 * THE QUOTE IS THE CUSTOMER'S CLAIM. The price list is sealed under his content key and opened in
 * his browser, so the Worker cannot check the total against it. It stores what was sent; the owner
 * reads the quoted rate against the floor on the phone before acknowledging, and the drafter
 * flags it again against the book when the sale is queued. Nothing here prices.
 *
 * A SESSION IS THE PASSWORD, ONCE. /open mints a token on a correct password (sess:<token>, fifteen
 * minutes, the page drops it when it locks); the order routes take the token and nothing else.
 */
import { PAY_ACCOUNTS } from "./pay.js";
import { wakeCustomer } from "./push.js";

export const SESSION_TTL = 900;
export const OPEN_STATES = ["placed", "acknowledged", "ready"];
export const MODES = ["collect", "deliver"];
export const METHODS = ["cod", "transfer", "qr", "jompay", "tngbiz"];
const MAX_OPEN = 5;

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const OKEY = (u, id) => "order:" + u + ":" + id;

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** A fresh session for `u`: the token is the only thing the page holds after the password. */
export async function mintSession(env, u) {
  const tok = b64url(crypto.getRandomValues(new Uint8Array(24)));
  await env.STMT.put("sess:" + tok, JSON.stringify({ u, at: new Date().toISOString() }), { expirationTtl: SESSION_TTL });
  return tok;
}

/** The username a request's session names, or "". */
export async function sessionUser(request, env) {
  const tok = String(request.headers.get("X-Stmt-Session") || "");
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(tok)) return "";
  const s = await env.STMT.get("sess:" + tok, "json");
  return (s && typeof s.u === "string") ? s.u : "";
}

async function listOrders(env, prefix) {
  const out = [];
  let cursor;
  do {
    const page = await env.STMT.list({ prefix, cursor });
    for (const k of page.keys) {
      const o = await env.STMT.get(k.name, "json");
      if (o && o.id) out.push(o);
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/** The customer's own orders, newest first. */
export const ordersOf = (env, u) => listOrders(env, "order:" + u + ":");

/** Every order still open, or all of them with `all`, across every customer: the desk's read. */
export async function allOrders(env, all) {
  const list = await listOrders(env, "order:");
  return all ? list : list.filter((o) => OPEN_STATES.includes(o.status));
}

/** What the customer sent, checked field by field. Returns { order } or { error }. */
export function checkPlacement(body, open) {
  if (!body || typeof body !== "object") return { error: "expected an order" };
  const product = String(body.product || "").trim();
  if (!/^[a-z]{1,20}$/.test(product)) return { error: "the product is not one the list carries" };
  const qty = body.qty;
  if (!isNum(qty) || qty <= 0 || qty > 1000) return { error: "the size has to be a number above zero" };
  const mode = String(body.mode || "");
  if (!MODES.includes(mode)) return { error: "collected or delivered, one or the other" };
  const total = body.total, unit = body.unit;
  if (!isNum(total) || !(total > 0) || total > 1000000) return { error: "the total is not a figure the list quoted" };   /* 08 Sep 2026: RM 0 was accepted */
  if (!isNum(unit) || unit < 0) return { error: "the unit rate is not a figure the list quoted" };
  const week = String(body.week || "").slice(0, 40);
  if (open.length >= MAX_OPEN) return { error: "you already have " + open.length + " orders open; wait for one to be completed" };
  return { order: { product, qty, mode, unit: +unit.toFixed(2), total: +total.toFixed(2), week } };
}

export async function placeOrder(env, u, body) {
  const open = (await ordersOf(env, u)).filter((o) => OPEN_STATES.includes(o.status));
  const c = checkPlacement(body, open);
  if (c.error) return { error: c.error };
  const at = new Date().toISOString();
  const id = at.replace(/[-:.TZ]/g, "").slice(0, 14) + "-" + b64url(crypto.getRandomValues(new Uint8Array(4))).toLowerCase().replace(/[^a-z0-9]/g, "x");
  const order = Object.assign({ id, u, at, status: "placed", history: [{ at, status: "placed", by: "customer" }] }, c.order);
  await env.STMT.put(OKEY(u, id), JSON.stringify(order));
  return { order };
}

/** The customer's own moves: a rail at ready, or a withdrawal before anything is on the road. */
export async function customerMove(env, u, id, action, body) {
  const order = await env.STMT.get(OKEY(u, id), "json");
  if (!order) return { error: "no such order", status: 404 };
  const at = new Date().toISOString();
  if (action === "cancel") {
    if (!["placed", "acknowledged"].includes(order.status)) return { error: "an order that is " + order.status + " cannot be withdrawn from here", status: 409 };
    order.status = "cancelled";
    order.history.push({ at, status: "cancelled", by: "customer" });
  } else if (action === "method") {
    if (order.status !== "ready") return { error: "payment is chosen once the order is ready", status: 409 };
    const method = String((body && body.method) || "");
    if (!METHODS.includes(method)) return { error: "that is not a way to pay this site offers", status: 400 };
    let account = null;
    if (method === "transfer" || method === "qr" || method === "jompay") {
      const key = String((body && body.account) || "");
      const a = PAY_ACCOUNTS.find((x) => x.key === key && !x.maintenance);
      if (!a || !a[method]) return { error: "that account does not take that rail", status: 400 };
      account = a.key;
    } else if (method === "tngbiz") {
      const a = PAY_ACCOUNTS.find((x) => x.key === "tngbiz" && !x.maintenance && x.qr);
      if (!a) return { error: "the Touch 'n Go Business code is not available", status: 400 };
      account = a.key;
    }
    order.method = method; order.account = account; order.methodAt = at;
    order.history.push({ at, status: "ready", by: "customer", method, account });
  } else return { error: "not found", status: 404 };
  await env.STMT.put(OKEY(u, id), JSON.stringify(order));
  return { order };
}

const NEXT = { acknowledged: ["placed"], ready: ["acknowledged", "placed"], done: ["ready"], declined: OPEN_STATES };

/** The owner's moves, from the phone through the desk's Worker. Every change wakes the customer. */
export async function deskMove(env, u, id, body) {
  const order = await env.STMT.get(OKEY(u, id), "json");
  if (!order) return { error: "no such order", status: 404 };
  const status = String((body && body.status) || "");
  if (!NEXT[status]) return { error: "not a state the desk sets", status: 400 };
  if (!NEXT[status].includes(order.status)) return { error: "an order that is " + order.status + " cannot become " + status, status: 409 };
  const at = new Date().toISOString();
  if (status === "ready" && body && MODES.includes(body.mode)) order.mode = body.mode;
  /* v502: delivery is a figure the owner types when he marks the order ready to deliver; it is
     shown to the customer on top of the goods, and rides into the sale as its own field. */
  if (status === "ready") {
    const d = body && typeof body.delivery === "number" && Number.isFinite(body.delivery) && body.delivery >= 0 ? +body.delivery.toFixed(2) : 0;
    order.delivery = order.mode === "deliver" ? d : 0;
  }
  order.status = status;
  const ev = { at, status, by: "desk" };
  if (body && typeof body.note === "string" && body.note.trim()) ev.note = body.note.trim().slice(0, 200);
  order.history.push(ev);
  await env.STMT.put(OKEY(u, id), JSON.stringify(order));
  const push = await wakeCustomer(env, u);
  return { order, push };
}
