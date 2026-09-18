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
 *   acknowledged  the owner, from the phone: agreed, the delivery charge set, and the moment the
 *                 pending row is queued for the ledger
 *   ready         the owner: ready to collect, or ready to deliver (`mode` says which)
 *   done          both sides are complete: paid in full and handed over in full
 *   declined      the owner, at any open state
 *   cancelled     either side, at any stage until the goods move
 *
 * MONEY AND GOODS ARE TWO TRACKS, NOT ONE STATE (v694, his instruction of 18 Sep 2026). He may
 * deliver first or be paid first, and the order keeps both: `paid` and `payments[]` are what the
 * customer says they have paid, `moved` and `movedOn` are what he says he handed over. `done` is
 * neither side's tap: it is what the record reads when both are complete. The ledger says the
 * same thing in its own words, Open · Advance for goods out and money owed, Open · Deferred for
 * money in and goods owed, and it says it because each step queued its own entry.
 *
 * PAYMENT IS OFFERED FROM acknowledged. The customer picks the rail (cash on collection or delivery,
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
 * WHERE IT IS GOING STAYS HERE. A delivery order carries `place`, a general location the customer
 * types: a neighbourhood, not an address. It is shown on his card and it does NOT ride into the
 * ledger row's note, because a note reaches the committed book and free text a customer typed is
 * the one thing here that could carry a street.
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
/* v694: the states from which the ledger already holds a row, so a later step has something to
   amend, and the states in which money may be paid. Acknowledged is the line between them. */
export const ROWED = ["acknowledged", "ready", "done"];
export const PAYABLE = ["acknowledged", "ready"];
/* The newest placement's moment, so the desk can ask "anything new?" with one read a minute rather
   than listing every order ever placed (16 Sep 2026). Not under order:, so no listing sees it. */
export const LAST_PLACED = "last-placed";
/* v694: and the moment of the newest CHANGE of any kind, so the desk's every-minute reconcile asks
   one question before it lists anything. A payment the customer made moves this and not that. */
export const LAST_TOUCHED = "last-touched";

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const OKEY = (u, id) => "order:" + u + ":" + id;

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** A fresh session for `u`: the token is the only thing the page holds after the password. */
/* v692: the session is dropped when a reader logs out, rather than left to expire. The page used
   to forget its token and the record sat in the store for the rest of its fifteen minutes. */
export async function dropSession(env, token) {
  if (!token || !env.STMT) return false;
  await env.STMT.delete("sess:" + token);
  return true;
}

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

/* ---- WHAT THE LEDGER HAS NOT BEEN TOLD (v694) -----------------------------------------------
 * The desk queues an entry per stage and writes back what it queued. This is the difference, read
 * off the record alone, and it is the ONE place that decides a stage is owed, so the desk's every
 * road reads the same list and a step cannot be queued twice by two of them.
 *   ack     the pending row: the order is agreed and no row exists yet
 *   pay     the money ARRIVED SINCE, because a Fulfilment accumulates: the increment, not the total
 *   move    the goods handed over, as a RUNNING TOTAL, because a Correction states rather than adds
 *   cancel  the row withdrawn, and only where a row was made
 * A state that never reached `acknowledged` owes nothing: there is no row to amend. */
export function orderWork(o) {
  const q = (o && o.queued) || {}, jobs = [];
  if (!o) return jobs;
  /* nothing was ever told, and the order ended before it was agreed: there is nothing to undo */
  if (!q.ack && !ROWED.includes(o.status)) return jobs;
  if (!q.ack) jobs.push("ack");
  if (+(o.paid || 0) > +(q.paid || 0) + 0.004) jobs.push("pay");
  if (Math.abs(+(o.moved || 0) - +(q.moved || 0)) > 0.0004) jobs.push("move");
  /* the money goes first, so the fold has a payment to refund when it reads the cancellation */
  if (["cancelled", "declined"].includes(o.status) && !q.cancel) jobs.push("cancel");
  return jobs;
}

/* ---- WHO IS CHASED, AND HOW OFTEN (v700, his instruction of 18 Sep 2026) ---------------------
 * "The customer will be notified every hour to pay if it is an advanced order." An advance is the
 * book's own word for goods out with money owed, so that is the test: something has been handed
 * over and something is still outstanding. A customer who has paid nothing on an order he has not
 * touched yet is not chased, because nothing of his is in their hands.
 *
 * DAY AND NIGHT, HIS WORD, and until it is paid. The cap is one wake an hour per CUSTOMER, not per
 * order: two unpaid advances are one person's problem and one banner, and the banner names no
 * amount and no order anyway.
 */
export const isAdvance = (o) => !!o && ROWED.includes(o.status) && (+o.moved || 0) > 0.004 && dueOf(o) > 0.004;
export const CHASE_KEY = (u) => "chased:" + u;
/** An hour in whole hours since the epoch: the same hour twice is the same bucket, and no clock is read twice. */
export const hourOf = (at) => Math.floor(new Date(at).getTime() / 3600000);

/** Every customer holding an unpaid advance, with the orders that make it, newest order first. */
export async function toChase(env) {
  const by = new Map();
  for (const o of await listOrders(env, "order:")) {
    if (!isAdvance(o)) continue;
    if (!by.has(o.u)) by.set(o.u, []);
    by.get(o.u).push(o);
  }
  return [...by.entries()].map(([u, orders]) => ({ u, orders }));
}

/** Every order with a stage the ledger has not been told about, each carrying what it owes. */
export async function ordersOwing(env) {
  return (await listOrders(env, "order:")).map((o) => Object.assign({ work: orderWork(o) }, o))
    .filter((o) => o.work.length > 0);
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
  /* v694: a delivery says roughly where it is going. One line, no punctuation a street needs, and
     never a figure of its own: it tells him which way to drive and nothing else. */
  const place = String(body.place || "").replace(/\s+/g, " ").trim().slice(0, 60);
  if (mode === "deliver" && place.length < 2) return { error: "say roughly where it is going, so the delivery can be quoted" };
  if (open.length >= MAX_OPEN) return { error: "you already have " + open.length + " orders open; wait for one to be completed" };
  return { order: { product, qty, mode, unit: +unit.toFixed(2), total: +total.toFixed(2), week, place: mode === "deliver" ? place : "" } };
}

/* WHAT IS STILL OWED ON AN ORDER, and what is still to be handed over. Both read the record alone:
   the site prices nothing and the ledger is not here. `due` carries the delivery charge, because
   that is what the customer is asked for. */
export const dueOf = (o) => +((+o.total + (+o.delivery || 0)) - (+o.paid || 0)).toFixed(2);
export const owedUnits = (o) => +((+o.qty) - (+o.moved || 0)).toFixed(3);

/* CASH ON DELIVERY IS NOT OFFERED TO SOMEONE ALREADY HOLDING GOODS THEY HAVE NOT PAID FOR (his
   instruction, 18 Sep 2026). That is an advance in the book's words, and offering to settle it at
   the door is how an advance becomes two. Their own orders answer it; nothing here reads the book. */
export const hasUnpaidAdvance = (orders, exceptId) => (orders || []).some(
  (o) => o.id !== exceptId && !["cancelled", "declined"].includes(o.status) && (+o.moved || 0) > 0 && dueOf(o) > 0.004);

export async function placeOrder(env, u, body) {
  const open = (await ordersOf(env, u)).filter((o) => OPEN_STATES.includes(o.status));
  const c = checkPlacement(body, open);
  if (c.error) return { error: c.error };
  const at = new Date().toISOString();
  const id = at.replace(/[-:.TZ]/g, "").slice(0, 14) + "-" + b64url(crypto.getRandomValues(new Uint8Array(4))).toLowerCase().replace(/[^a-z0-9]/g, "x");
  const order = Object.assign({ id, u, at, status: "placed", paid: 0, payments: [], moved: 0, movedOn: null,
    history: [{ at, status: "placed", by: "customer" }] }, c.order);
  await env.STMT.put(OKEY(u, id), JSON.stringify(order));
  await env.STMT.put(LAST_PLACED, at);
  await env.STMT.put(LAST_TOUCHED, at);
  return { order };
}

/** The customer's own moves: a rail at ready, or a withdrawal before anything is on the road. */
export async function customerMove(env, u, id, action, body) {
  const order = await env.STMT.get(OKEY(u, id), "json");
  if (!order) return { error: "no such order", status: 404 };
  const at = new Date().toISOString();
  let done = false;
  if (action === "cancel") {
    /* v694: either side may withdraw at any stage UNTIL THE GOODS MOVE (his rule, 18 Sep 2026).
       What was paid is refunded, which the ledger raises when the cancellation folds. */
    if (["done", "cancelled", "declined"].includes(order.status)) return { error: "an order that is " + order.status + " cannot be withdrawn from here", status: 409 };
    if ((+order.moved || 0) > 0) return { error: "the goods are already with you, so this cannot be withdrawn here", status: 409 };
    order.status = "cancelled";
    order.history.push({ at, status: "cancelled", by: "customer" });
  } else if (action === "method") {
    if (!PAYABLE.includes(order.status)) return { error: "payment is chosen once the order is acknowledged", status: 409 };
    const r = pickRail(order, body, await ordersOf(env, u));
    if (r.error) return r;
    order.method = r.method; order.account = r.account; order.methodAt = at;
    order.history.push({ at, status: order.status, by: "customer", method: r.method, account: r.account });
  } else if (action === "pay") {
    /* v694: THE CUSTOMER TYPES WHAT THEY PAID (his instruction, 18 Sep 2026). The site takes no
       money and no rail tells it anything, so what is recorded is their word; the figure is
       checked against the fold, and he sees the running total on his card. It accumulates, so a
       part payment is a part payment and two of them are two. */
    if (!PAYABLE.includes(order.status)) return { error: "payment is recorded once the order is acknowledged", status: 409 };
    const amount = body && body.amount;
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return { error: "say how much you paid", status: 400 };
    const due = dueOf(order);
    if (amount > due + 0.004) return { error: "that is more than the " + due.toFixed(2) + " outstanding on this order", status: 400 };
    let method = order.method || null, account = order.account || null;
    if (body && body.method) {
      const r = pickRail(order, body, await ordersOf(env, u));
      if (r.error) return r;
      method = r.method; account = r.account;
    }
    if (!method) return { error: "choose how you are paying first", status: 400 };
    const paid = +((+order.paid || 0) + amount).toFixed(2);
    order.paid = paid; order.method = method; order.account = account;
    order.payments = (order.payments || []).concat([{ at, amount: +amount.toFixed(2), method, account }]);
    order.history.push({ at, status: order.status, by: "customer", method, account, note: "paid " + amount.toFixed(2) });
    done = settle(order, at);
  } else return { error: "not found", status: 404 };
  await env.STMT.put(OKEY(u, id), JSON.stringify(order));
  await env.STMT.put(LAST_TOUCHED, at);
  /* v700: a payment that completes the order is the one customer move worth waking the phone for,
     because it is the only one whose answer arrives after they have put the phone down. Every
     other move of theirs happens with the page in front of them. */
  if (done) await wakeCustomer(env, u);
  return { order };
}

/* The rail, checked against the pay master, with the one rail his rule withholds. */
function pickRail(order, body, mine) {
  const method = String((body && body.method) || "");
  if (!METHODS.includes(method)) return { error: "that is not a way to pay this site offers", status: 400 };
  if (method === "cod" && hasUnpaidAdvance(mine, order.id))
    return { error: "cash on handover is not offered while goods you already hold are unpaid", status: 409 };
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
  return { method, account };
}

/* BOTH SIDES COMPLETE IS `done`, AND NOBODY TAPS IT (v694). Paid in full and handed over in full,
   whichever arrives second, and the customer is told the words he chose. */
function settle(order, at) {
  if (!PAYABLE.includes(order.status)) return false;
  if (dueOf(order) > 0.004 || owedUnits(order) > 0.004) return false;
  order.status = "done";
  order.history.push({ at, status: "done", by: "site" });
  return true;
}

const NEXT = { acknowledged: ["placed"], ready: ["acknowledged", "placed"], done: ["ready", "acknowledged"],
  declined: OPEN_STATES, cancelled: OPEN_STATES };

/** The owner's moves, from the phone through the desk's Worker. Every change wakes the customer. */
export async function deskMove(env, u, id, body) {
  const order = await env.STMT.get(OKEY(u, id), "json");
  if (!order) return { error: "no such order", status: 404 };
  const at = new Date().toISOString();
  /* v694: the desk's own bookkeeping, not a move. It is what the ledger has been told, written
     back by the reconcile the moment it queues a stage, and it is the only thing that stops a
     stage being queued twice. It never moves the order and never wakes anybody. */
  if (body && body.mark) {
    const m = body.mark, q = Object.assign({}, order.queued || {});
    if (typeof m.ledgerKey === "string" && m.ledgerKey) order.ledgerKey = m.ledgerKey;
    for (const k of ["ack", "cancel"]) if (m[k]) q[k] = String(m[k]).slice(0, 40);
    for (const k of ["paid", "moved"]) if (typeof m[k] === "number" && Number.isFinite(m[k])) q[k] = +m[k].toFixed(3);
    order.queued = q;
    await env.STMT.put(OKEY(u, id), JSON.stringify(order));
    return { order };
  }
  /* v694: what he handed over, in units, whichever way it went. It is its own step and its own
     entry, because goods and money move apart: he may deliver before a ringgit arrives. */
  if (body && body.handover) {
    if (!ROWED.includes(order.status)) return { error: "nothing is handed over on an order that is " + order.status, status: 409 };
    const n = body.handover.units;
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > order.qty + 0.004)
      return { error: "the units handed over have to be a figure from zero to the " + order.qty + " ordered", status: 400 };
    order.moved = +n.toFixed(3);
    order.movedOn = klDay(at);
    if (MODES.includes(body.handover.mode)) order.mode = body.handover.mode;
    order.history.push({ at, status: order.status, by: "desk", note: order.moved + " unit " + (order.mode === "deliver" ? "delivered" : "collected") });
    settle(order, at);
    await env.STMT.put(OKEY(u, id), JSON.stringify(order));
    await env.STMT.put(LAST_TOUCHED, at);
    const push = await wakeCustomer(env, u);
    return { order, push };
  }
  const status = String((body && body.status) || "");
  if (!NEXT[status]) return { error: "not a state the desk sets", status: 400 };
  if (!NEXT[status].includes(order.status)) return { error: "an order that is " + order.status + " cannot become " + status, status: 409 };
  if (status === "cancelled" && (+order.moved || 0) > 0) return { error: "the goods are already out, so this cannot be cancelled", status: 409 };
  if (status === "ready" && body && MODES.includes(body.mode)) order.mode = body.mode;
  /* v502: delivery is a figure the owner types; v694 moved it to the acknowledgement, because
     that is where the order becomes a row and the row carries the charge inside its total. */
  if (status === "acknowledged") {
    if (body && MODES.includes(body.mode)) order.mode = body.mode;
    const d = body && typeof body.delivery === "number" && Number.isFinite(body.delivery) && body.delivery >= 0 ? +body.delivery.toFixed(2) : 0;
    order.delivery = order.mode === "deliver" ? d : 0;
  }
  order.status = status;
  const ev = { at, status, by: "desk" };
  if (body && typeof body.note === "string" && body.note.trim()) ev.note = body.note.trim().slice(0, 200);
  order.history.push(ev);
  await env.STMT.put(OKEY(u, id), JSON.stringify(order));
  await env.STMT.put(LAST_TOUCHED, at);
  const push = await wakeCustomer(env, u);
  return { order, push };
}

const klDay = (iso) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });
