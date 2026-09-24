/* stmt/orders.js: THE ORDER BOOK ON THE STATEMENTS SITE (his instruction, 06 Sep 2026).
 *
 * A customer who has opened his statement can place an order: a size off his own price list,
 * collected or delivered, and the total the list quoted. That is the third thing the site does,
 * after the statements and the price list, and this file is the whole of its state machine.
 *
 * WHAT AN ORDER IS. One record, order:<username>:<id>, in this site's own store:
 *   { id, u, product, qty, mode, unit, total, week, at, status, history[], method?, account?,
 *     paid, payments[], claimed, moved, movedOn, movedAt?, queued?, ledgerKey?, msgs[] }
 * Plaintext, unlike everything else here, and the reason is stated rather than hidden: the
 * record is written at runtime by the customer, and this Worker holds no key to seal it with.
 * It carries a size, a quoted total and a state; no name, no code, no address. The desk code
 * that names the account is resolved on the ledger's own Worker from its own store, so nothing
 * here says which account on the book a username is.
 *
 * WHERE IT LIVES (S10, D10, his answer of 24 Sep 2026). On the object road, in the site's one Durable
 * Object (stmt/orderbook.js), as the fold of its events; on the KV road, the record above, read and
 * written back whole. ORDER_STORE chooses (`onBook`). ONE STATE MACHINE FOR BOTH: every move is checked
 * by a decide* function and folded by applyEvent, below, so the two roads cannot disagree about a rule.
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
 * deliver first or be paid first, and the order keeps both: `paid` is the money he has confirmed and
 * `claimed` what the customer says they sent and he has not (S6, below), `moved` and `movedOn` are
 * what he says he handed over. `done` is neither side's tap: it is what the record reads when both
 * are complete. The ledger says the
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
 * A SESSION IS THE PASSWORD, ONCE. /open mints a token on a correct password (sess:<sha256(token)>, fifteen
 * minutes, the page drops it when it locks); the order routes take the token and nothing else.
 */
import { PAY_ACCOUNTS } from "./pay.js";
import { wakeCustomer } from "./push.js";
import { sessKey } from "./signin.js";

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
/* v760: AND A MARK ONLY THEIR OWN MOVES WRITE. `last-touched` is written by his moves as well,
 * because the reconcile has to list after a handover too, so waking him on it would have woken him
 * for his own taps. This one is written by a PAYMENT and a WITHDRAWAL and by nothing else: choosing
 * how to pay is not news, and a line they wrote already has `last-said`.
 * IT CARRIES WHAT HAPPENED, not only when: the moment first, so it still compares as a string, then
 * the word. The desk cannot ask afterwards, because by then the order reads the same either way. */
export const LAST_THEIRS = "last-theirs";
/* ---- WHAT A CUSTOMER WRITES ON AN ORDER (v751, his instruction of 20 Sep 2026) ----------------
 * He asked at the start of this work whether a customer could chat about an order, or leave a
 * comment. Both, and they are one thing: a THREAD on the order, `msgs[]`, each { at, by, text }.
 * A line typed at placement is simply its first message, so there is one list to read and not a
 * comment field beside a conversation.
 *
 * IT NEVER RIDES INTO A LEDGER NOTE. This is the second piece of free text a customer types, after
 * `place`, and it is held to exactly the rule v694 gave that one: a note reaches the committed book
 * and what a customer typed could carry a street, a name or anything else. The entries the desk
 * queues are built from fixed words and figures, and the suite asserts that nothing a customer
 * wrote reaches one.
 *
 * TWENTY AN ORDER, TWO HUNDRED CHARACTERS EACH, and the count is of THEIR OWN lines, so an answer
 * never uses up their allowance. Enough for a conversation about one order; not enough to be a
 * channel. The line at placement is shorter, 140, because it is an aside on a form and not a reply.
 */
export const MSG_MAX = 200;
export const MSG_CAP = 20;
export const NOTE_MAX = 140;
export const LAST_SAID = "last-said";
/* one reader for both: collapsed to single spaces, trimmed, cut to length. Whitespace is where a
   long silent block hides, and a line drawn on the page has to be one line. */
export const cleanMsg = (s, max) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, max);
/* their own lines, which is what the cap counts */
export const saidBy = (o, who) => ((o && o.msgs) || []).filter((m) => m && m.by === who).length;

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const OKEY = (u, id) => "order:" + u + ":" + id;
/* THE ORDER'S OWN PUT DECIDES THE ANSWER (24 Sep 2026). What is written after it (the shared marks,
   which every move writes to the same few keys, and a request id) is best effort: KV refuses a
   second write to one key inside a second and the put throws, which answered 500 on a move already
   stored, and the page said "not placed" of an order that was. A put that fails here is logged and
   the move answers with what was stored. A lost mark costs a wake, never a stage: the desk's
   reconcile lists every minute whatever the marks say. */
async function putSoft(env, key, value, opts) {
  try { await env.STMT.put(key, value, opts); }
  catch (e) { console.log("orders: " + key.split(":")[0] + " not written: " + String((e && e.message) || e)); }
}

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/* ---- THE ROAD (S10, D10) ----------------------------------------------------------------------
 * ORDER_STORE in wrangler.stmt.jsonc, with the ORDERBOOK binding present, is THE SWITCH:
 *   unset, or "kv"   the KV road: every order a record under order:, read and written back whole. Also
 *                    the way back: KV is kept current behind the object, so this is a rollback.
 *   "object+kv"      THE WEEK OF READING BOTH (10.3): every order in the one Durable Object, as appended
 *                    events; every order it changes written to its KV key behind it, by the object; a read
 *                    the object cannot answer read from KV; and the site's hourly cron compares the two
 *                    (checkStores).
 *   "object"         after a clean week (10.5): KV order keys no longer written or read. Flipping it is the
 *                    whole of what is built of 10.5; deleting the old keys is not.
 * The object is one name for the whole site, BOOK_NAME, so every request reaches the same one. */
export const BOOK_NAME = "site";
export const onBook = (env) => !!(env && env.ORDERBOOK) && /^object/.test(String(env.ORDER_STORE || ""));
export const readsBoth = (env) => onBook(env) && env.ORDER_STORE === "object+kv";
/* THE KV ROAD'S MARK (S10 fix DS1): the moment it last wrote an order while the book is bound, that is after a
   flip back to "kv". The book moves in again when it finds one later than its own move-in, so coming back with
   ORDER_MOVE_IN left as it was cannot serve, or write behind, an older order than KV holds. */
export const ROAD_KEY = "orderbook:road";
const markRoad = (env) => (env.ORDERBOOK && !onBook(env) ? putSoft(env, ROAD_KEY, new Date().toISOString()) : null);
/* the words while the book is moving in (stmt/orderbook.js): a minute, once, at the deploy that moves it */
export const FROZEN = "Orders are being moved and are paused for a minute. Try again in a minute.";
/* the object's own words for a store it cannot reach, and nothing else: a move is never answered as
   stored when it was not, and never retried here, because a retry is the page's, carrying its own id */
export const BOOK_BUSY = "Orders could not be reached just now. Try again in a minute.";
async function book(env, op, a) {
  const stub = env.ORDERBOOK.get(env.ORDERBOOK.idFromName(BOOK_NAME));
  const r = await stub.fetch("https://orderbook/" + op, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(a || {}) });
  return r.json();
}
/* a move on the object road: its answer, or the store's refusal as the route's own. In the week of reading
   both the book itself writes the order it changed to its KV key behind it (stmt/orderbook.js): a put here,
   a moment after the last, is the second write inside a second that KV refuses (S10 fixes R1, P1, DS2). */
async function bookMove(env, op, a) {
  let r;
  try { r = await book(env, op, a); }
  catch (e) { console.log("orders: the order book did not answer " + op + ": " + String((e && e.message) || e)); return { error: BOOK_BUSY, status: 503 }; }
  if (!r || !r.ok) return { error: (r && r.error) || BOOK_BUSY, status: (r && r.status) || 503 };
  return r;
}
/* a read on the object road; in the week of reading both, KV answers when the object cannot */
async function bookRead(env, op, a, fromKv) {
  try { return await book(env, op, a); }
  catch (e) {
    if (!readsBoth(env)) throw e;
    console.log("orders: the order book did not answer " + op + "; read from KV: " + String((e && e.message) || e));
    return fromKv();
  }
}

/** A fresh session for `u`: the token is the only thing the page holds after the password. */
/* v692: the session is dropped when a reader logs out, rather than left to expire. The page used
   to forget its token and the record sat in the store for the rest of its fifteen minutes. */
export async function dropSession(env, token) {
  if (!token || !env.STMT) return false;
  await env.STMT.delete(await sessKey(token));
  return true;
}

export async function mintSession(env, u) {
  const tok = b64url(crypto.getRandomValues(new Uint8Array(24)));
  await env.STMT.put(await sessKey(tok), JSON.stringify({ u, at: new Date().toISOString() }), { expirationTtl: SESSION_TTL });
  return tok;
}

/** The username a request's session names, or "". */
export async function sessionUser(request, env) {
  const tok = String(request.headers.get("X-Stmt-Session") || "");
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(tok)) return "";
  const s = await env.STMT.get(await sessKey(tok), "json");
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
/* every order on the site, newest first, from whichever store the road names */
async function everyOrder(env) {
  if (onBook(env)) return (await bookRead(env, "orders", {}, async () => ({ orders: await listOrders(env, "order:") }))).orders || [];
  return listOrders(env, "order:");
}

/** The customer's own orders, newest first. */
export const ordersOf = async (env, u) => (onBook(env)
  ? (await bookRead(env, "orders", { u }, async () => ({ orders: await listOrders(env, "order:" + u + ":") }))).orders || []
  : listOrders(env, "order:" + u + ":"));

/* ---- THE WEEK OF READING BOTH (S10 10.3) -------------------------------------------------------
 * Hourly, from the site's cron: every order in the book against its KV key, compared BY THE BOOK
 * (stmt/orderbook.js `check`), each KV record against what the book holds at that moment, and nothing
 * written here (S10 fixes DS1, R2, P2, DS2, P1). The book names, and writes behind itself:
 *   same      KV holds the book's order
 *   pending   KV is behind with the book's write on its way (a count)
 *   repaired  KV is behind with nothing on its way, so the write behind is asked for again
 *   kvAhead   KV holds a state the book never held: written by something else, so LEFT AS IT IS
 *   kvOnly    a KV order the book lacks; bookOnly, a book order KV lacks with nothing on its way; both left
 * While the book is moving in it answers frozen and the check STANDS DOWN: nothing written, the clean run
 * left as it was, because KV is then the old code's and the end pass has still to read it.
 * The answer is logged and kept at CHECK_KEY with `cleanSince`, the first of an unbroken run of clean hours
 * (repaired, kvAhead, kvOnly and bookOnly all empty), so a week is read with one command: seven days after
 * `cleanSince`, ORDER_STORE can go to "object" (10.5). An hour that is not clean empties it. */
export const CHECK_KEY = "orderbook:check";
export async function checkStores(env) {
  const at = new Date().toISOString(), r = await book(env, "check", {});
  if (!r || !r.ok) return { at, stoodDown: (r && r.error) || "no answer", frozen: !!(r && r.frozen) };
  const out = { at, orders: r.orders, same: r.same, pending: r.pending, repaired: r.repaired, kvAhead: r.kvAhead, kvOnly: r.kvOnly, bookOnly: r.bookOnly };
  let was = null;
  try { was = await env.STMT.get(CHECK_KEY, "json"); } catch (e) { was = null; }
  const dirty = [out.repaired, out.kvAhead, out.kvOnly, out.bookOnly].some((l) => !l || l.length);
  out.cleanSince = dirty ? null : ((was && was.cleanSince) || out.at);
  await putSoft(env, CHECK_KEY, JSON.stringify(out));
  return out;
}

/* WHAT A CUSTOMER'S OWN PAGE IS HANDED (24 Sep 2026). The record also carries the desk's
   bookkeeping: `ledgerKey`, which names a roster code when this file says nothing here says which
   account a username is, `queued` and `sync`. Their order list and every answer to a move of theirs
   carry this view instead. A WHITELIST, so a field the desk adds later stays on the desk until it is
   named here; and a desk mark, which changes none of these, no longer redraws their page. */
export const CUSTOMER_FIELDS = ["id", "u", "at", "status", "product", "qty", "unit", "mode", "place", "forFriend", "week",
  "total", "delivery", "paid", "payments", "claimed", "moved", "movedOn", "method", "account", "history", "msgs", "closed"];
export const customerView = (o) => {
  const v = {};
  for (const k of CUSTOMER_FIELDS) if (o && o[k] !== undefined) v[k] = o[k];
  /* S6: a claim's `queued` names the desk's entry for it, which is the desk's bookkeeping */
  if (Array.isArray(v.payments)) v.payments = v.payments.map((p) => { if (!p || !p.queued) return p; const c = Object.assign({}, p); delete c.queued; return c; });
  return v;
};

/** Every order still open, or all of them with `all`, across every customer: the desk's read. */
/* v752: AN ORDER WAITING FOR AN ANSWER IS STILL HIS TO LOOK AT. His card lists the OPEN orders, and
   v751 lets a customer write on any order at any stage, so a question asked about one he has closed
   would have reached a record nothing on his desk draws. The test is the thread's LAST line: theirs,
   and it is waiting; his, and it is not. Answering is what takes a closed order off the card again. */
/* S11 11.6: and a line he marked as needing no reply is answered: `quiet` holds the moment of the last line
   of theirs he let stand, so a later one of theirs waits again. It is the desk's, never on the customer's page. */
export const awaitingAnswer = (o) => {
  const m = (o && o.msgs) || [], l = m[m.length - 1];
  return !!(l && l.by === "customer" && !(o.quiet && String(o.quiet) >= String(l.at)));
};
export async function allOrders(env, all) {
  const list = await everyOrder(env);
  return all ? list : list.filter((o) => OPEN_STATES.includes(o.status) || awaitingAnswer(o));
}

/* ---- A CLAIM IS NOT A PAYMENT (S6 6.5, his decision D7 of 24 Sep 2026) --------------------------
 * "I have sent it" is the customer's word and STAYS their word until his Received: an entry on the order's
 * payments[] with `claim: "waiting"`, summed as `claimed`, and never added to `paid`. His verdict answers ONE
 * claim, named by its moment: received adds it to paid, not found takes it off claimed, and the entry keeps
 * the answer ("received", "notfound"). Each claim is queued for the ledger as its own Fulfilment, flagged as
 * a claim for his check, and `queued` on the entry names that entry: so the ledger hears of the money once,
 * by that entry, whether he answers before it is queued or after. */
export const claimedOf = (o) => +(((o && o.payments) || []).filter((p) => p && p.claim === "waiting")
  .reduce((n, p) => n + (+p.amount || 0), 0)).toFixed(2);
/** Each claim the ledger has not been told of: waiting for his check, or received; never one not found. */
export const claimsToQueue = (o) => ((o && o.payments) || []).filter((p) => p && (p.claim === "waiting" || p.claim === "received") && !p.queued);
/** Money he confirmed that the ledger has not been told of, less a received claim, which its own entry tells. */
export const paidUntold = (o) => +((+o.paid || 0) - (+((o.queued || {}).paid) || 0)
  - claimsToQueue(o).filter((p) => p.claim === "received").reduce((n, p) => n + (+p.amount || 0), 0)).toFixed(2);

/* ---- WHAT THE LEDGER HAS NOT BEEN TOLD (v694) -----------------------------------------------
 * The desk queues an entry per stage and writes back what it queued. This is the difference, read
 * off the record alone, and it is the ONE place that decides a stage is owed, so the desk's every
 * road reads the same list and a step cannot be queued twice by two of them.
 *   ack     the pending row: the order is agreed and no row exists yet
 *   claim   each claim not yet queued, as a Fulfilment of its own for his check (S6 6.5)
 *   pay     money he confirmed SINCE (paidUntold), because a Fulfilment accumulates: the increment, not the total
 *   move    the goods handed over, as a RUNNING TOTAL, because a Correction states rather than adds
 *   close   the row restated at what was handed over (S11 11.9), which states the goods moved as well
 *   cancel  the row withdrawn, and only where a row was made
 * A state that never reached `acknowledged` owes nothing: there is no row to amend. */
export function orderWork(o) {
  const q = (o && o.queued) || {}, jobs = [];
  if (!o) return jobs;
  /* nothing was ever told, and the order ended before it was agreed: there is nothing to undo */
  if (!q.ack && !ROWED.includes(o.status)) return jobs;
  if (!q.ack) jobs.push("ack");
  if (claimsToQueue(o).length) jobs.push("claim");
  if (paidUntold(o) > 0.004) jobs.push("pay");
  /* S11 11.9: a close restates what was handed over with the size, so it is the one entry owed for both */
  const closing = !!(o.closed && !q.close);
  if (Math.abs(+(o.moved || 0) - +(q.moved || 0)) > 0.0004 && !closing) jobs.push("move");
  if (closing) jobs.push("close");
  /* the money goes first, so the fold has a payment to refund when it reads the cancellation */
  if (["cancelled", "declined"].includes(o.status) && !q.cancel) jobs.push("cancel");
  return jobs;
}

/* ---- WHO IS CHASED, AND WHEN (v700; S12 12.3, his decision D5 of 24 Sep 2026) ------------------
 * An advance is the book's own word for goods out ahead of the money, so that is the test, READ AS
 * THE ENGINE READS IT (24 Sep 2026): the share of the goods handed over above the share of what is
 * owed that is paid (engine/position.mjs, txStat's Open · Advance). So only GOODS RECEIVED are chased:
 * a customer who has paid for the 2 of 5 units they hold is not asked about the 3 still to come, and
 * one who has been handed nothing is not chased at all.
 *
 * TWICE A DAY, NOT EVERY HOUR (D5): at 10:00 and 18:00 in Kuala Lumpur, from THE DAY AFTER the goods
 * moved, PAUSED while a claim of theirs waits, and STOPPED when what they received is paid, which is
 * the same test going false (his cash, recorded on the desk, comes back through the return leg). v700
 * chased every hour, day and night, from the first top of the hour after the handover, so a customer
 * paying cash at the counter was asked again within minutes and every hour of the night. The cap is
 * one wake a slot per CUSTOMER, not per order, and its words are its own ("A payment is due").
 */
export const aheadOnGoods = (o) => {
  const owed = +o.total + (+o.delivery || 0), paidF = owed > 0 ? (+o.paid || 0) / owed : 0;
  const movedF = +o.qty > 0 ? (+o.moved || 0) / +o.qty : 0;
  return movedF > paidF + 1e-9 && dueOf(o) > 0.004;
};
export const isAdvance = (o) => !!o && ROWED.includes(o.status) && aheadOnGoods(o);
export const CHASE_KEY = (u) => "chased:" + u;
/** An hour in whole hours since the epoch: the same hour twice is the same bucket, and no clock is read twice. */
export const hourOf = (at) => Math.floor(new Date(at).getTime() / 3600000);
/* The two hours, Kuala Lumpur's (UTC+8, no summer time). The cron stays hourly and this decides: a slot
   is its hour's bucket, or null for every other hour. */
export const CHASE_HOURS = [10, 18];
export const chaseSlot = (at) => {
  const t = new Date(at).getTime();
  return CHASE_HOURS.includes(new Date(t + 8 * 3600000).getUTCHours()) ? hourOf(t) : null;
};
/* A DAY'S GRACE: chased from the day after the last handover (movedOn, a Kuala Lumpur date), never the
   day the goods moved; an order that carries no such day is not chased. */
export const graceOver = (o, at) => !!o.movedOn && o.movedOn < klDay(at);
/* PAUSED WHILE A CLAIM WAITS: a figure they say they sent that he has not answered (S6 6.5). His Received or
   Not found answers it, and the chase runs again only if something is still owed. */
export const claimWaits = (o) => claimedOf(o) > 0.004;

/** Every customer owed a chase at this moment, with the orders that make it, newest order first. */
export async function toChase(env, at = new Date()) {
  const by = new Map();
  for (const o of await everyOrder(env)) {
    if (!isAdvance(o) || !graceOver(o, at) || claimWaits(o)) continue;
    if (!by.has(o.u)) by.set(o.u, []);
    by.get(o.u).push(o);
  }
  return [...by.entries()].map(([u, orders]) => ({ u, orders }));
}

/* THE CHASE MARK (S10): the slot a customer was last woken in, its hour bucket (chaseSlot). On the object road it
   lives in the order book beside the orders it follows; on the KV road it is chased:<username>, lapsing after two
   hours. True when this slot's wake is still to be sent, and the mark is then already written. */
export async function markChased(env, u, hour) {
  if (onBook(env)) {
    const r = await book(env, "chase", { u, hour });
    if (!r.frozen) return !!r.fresh;
    /* the book is moving in: this hour's mark is the KV road's, which the old code shares, and the end pass
       takes it into the book, so the minute of the switch neither skips the hour nor wakes anyone twice */
  }
  const mark = await env.STMT.get(CHASE_KEY(u));
  if (mark && Number(mark) === hour) return false;
  await env.STMT.put(CHASE_KEY(u), String(hour), { expirationTtl: 2 * 3600 });
  return true;
}

/** Every order with a stage the ledger has not been told about, each carrying what it owes. */
export async function ordersOwing(env) {
  /* S6 6.5: and what to tell of the money, read here by the one rule, so the desk never works it out twice */
  return (await everyOrder(env)).map((o) => Object.assign({ work: orderWork(o), tell: { pay: paidUntold(o),
    claims: claimsToQueue(o).map((p) => ({ at: p.at, amount: p.amount, method: p.method || null, account: p.account || null })) } }, o))
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
  /* v702, his instruction of 18 Sep 2026: an associate's own order and one placed on behalf of a
     friend are no longer told apart by what they buy, so they tick it. IT IS TAKEN FROM ANYONE AND
     CHECKED BY NOBODY HERE: this site holds no roster and knows no codes, so it records the claim
     and the DESK decides where the row books, exactly as it does with the quoted total. An account
     that is not an associate has no tick to send, and a tick it sent anyway would reach a desk that
     has no bucket to book it to and would refuse it. */
  const forFriend = body.forFriend === true;
  /* v751: and anything they want to say with it, optional on every order, collect or deliver */
  const note = cleanMsg(body.note, NOTE_MAX);
  if (open.length >= MAX_OPEN) return { error: "you already have " + open.length + " orders open; wait for one to be completed" };
  return { order: { product, qty, mode, unit: +unit.toFixed(2), total: +total.toFixed(2), week,
    place: mode === "deliver" ? place : "", forFriend }, note };
}

/* WHAT IS STILL OWED ON AN ORDER, and what is still to be handed over. Both read the record alone:
   the site prices nothing and the ledger is not here. `due` carries the delivery charge, because
   that is what the customer is asked for. */
export const dueOf = (o) => +((+o.total + (+o.delivery || 0)) - (+o.paid || 0)).toFixed(2);
export const owedUnits = (o) => +((+o.qty) - (+o.moved || 0)).toFixed(3);

/* CASH ON DELIVERY IS NOT OFFERED TO SOMEONE ALREADY HOLDING GOODS THEY HAVE NOT PAID FOR (his
   instruction, 18 Sep 2026). That is an advance in the book's words, and offering to settle it at
   the door is how an advance becomes two. Their own orders answer it; nothing here reads the book.
   The order being paid counts as well (24 Sep 2026): it was left out, so cash was still offered on
   the very order whose goods were out ahead of its money. */
export const hasUnpaidAdvance = (orders) => (orders || []).some(
  (o) => !["cancelled", "declined"].includes(o.status) && aheadOnGoods(o));

/* A RETRY LANDS ONCE (24 Sep 2026). Place and I have paid are the two taps that ADD: a second
   placement is a second order and a second payment is paid twice. The page mints a request id per
   review and per payment and sends it with the tap, so a retry of the same tap (an answer lost on the
   way back, a second tap after "not placed") carries the same one. The first that lands files
   rid:<username>:<rid> for a day naming its order, and a repeat is answered with that order as it
   stands and changes nothing. KV is eventually consistent, so a repeat at another edge inside its
   first minute may not see the key: best effort, as the one-time link is. No id, taken as before.
   ON THE OBJECT ROAD EVERY MOVE CARRIES ONE (S10 10.4), and it is the event's own id, unique in the
   book for good: a repeat is found for certain, and answered with the order as it stands. ACROSS THE SWITCH
   (S10 fix DS4) the move-in files every live rid: key in the book, and in the week of reading both a
   placement's and a payment's id is filed at rid: as well, so a retry either way lands once. */
export const RID_RE = /^[A-Za-z0-9_-]{16,64}$/;
export const RID_TTL = 86400;
export const RID_KEY = (u, rid) => "rid:" + u + ":" + rid;
export const ridOf = (body) => (body && typeof body.rid === "string" && RID_RE.test(body.rid) ? body.rid : "");
async function repeatOf(env, u, rid, id) {
  if (!rid) return null;
  const seen = await env.STMT.get(RID_KEY(u, rid), "json");
  if (!seen || !seen.id || (id && seen.id !== id)) return null;
  const order = await env.STMT.get(OKEY(u, seen.id), "json");
  return order ? { order } : null;
}
const fileRid = (env, u, rid, id) => (rid ? putSoft(env, RID_KEY(u, rid), JSON.stringify({ id }), { expirationTtl: RID_TTL }) : null);

/* ---- A MOVE IS AN EVENT (S10 10.4, D10) --------------------------------------------------------
 * Every move is checked against the order AS IT STANDS by a decide* function, and what passes is one
 * EVENT carrying the move's resolved effect: the rail picked, the figure paid, the state reached, never
 * the request. applyEvent folds one event into the order and reads nothing else, so an order is the fold
 * of its events however often they are replayed. Both roads run exactly these: the KV road reads the
 * record, applies and writes it back whole, as it always did; the order book appends the event under its
 * id and folds it in, in one step no other writer can come between.
 * The kinds: place, status, method, pay (before S6), claim (S6 6.5), say, mark, ledger, handover, cash (S11 11.8), and copy
 * (an order moved in). */
export const mintOrderId = (at) => at.replace(/[-:.TZ]/g, "").slice(0, 14) + "-"
  + b64url(crypto.getRandomValues(new Uint8Array(4))).toLowerCase().replace(/[^a-z0-9]/g, "x");

/** A placement, checked against the customer's open orders. Returns { ev } or { error }. */
export function decidePlace(u, body, open, at) {
  const c = checkPlacement(body, open);
  if (c.error) return { error: c.error };
  const order = Object.assign({ id: mintOrderId(at), u, at, status: "placed", paid: 0, payments: [], moved: 0, movedOn: null,
    msgs: c.note ? [{ at, by: "customer", text: c.note }] : [],   /* v751: the line they typed with the order is its first message */
    history: [{ at, status: "placed", by: "customer" }] }, c.order);
  return { ev: { kind: "place", at, order } };
}

const SAID_AS = { done: "complete", cancelled: "cancelled", declined: "not taken" };
/** The customer's own moves: a rail, a payment, a line, or a withdrawal before anything is on the road.
 *  `mine` is their orders, which the cash rule reads. Returns { ev } or { error, status }. */
export function decideCustomer(order, action, body, mine, at) {
  if (!order) return { error: "no such order", status: 404 };
  if (action === "cancel") {
    /* v694: either side may withdraw at any stage UNTIL THE GOODS MOVE (his rule, 18 Sep 2026).
       What was paid is refunded, which the ledger raises when the cancellation folds. */
    /* S5 5.3 (D11): the refusals the page shows are in the customer's words, never the desk's states */
    if (["done", "cancelled", "declined"].includes(order.status)) return { error: "this order is " + SAID_AS[order.status] + ", so it cannot be cancelled here", status: 409 };
    if ((+order.moved || 0) > 0) return { error: "the goods are already with you, so this cannot be cancelled here", status: 409 };
    return { ev: { kind: "status", at, status: "cancelled", by: "customer" } };
  }
  if (action === "method") {
    if (!PAYABLE.includes(order.status)) return { error: "payment is chosen once the order is confirmed", status: 409 };
    const r = pickRail(order, body, mine);
    if (r.error) return r;
    return { ev: { kind: "method", at, method: r.method, account: r.account } };
  }
  if (action === "pay") {
    /* v694: THE CUSTOMER TYPES WHAT THEY SENT (his instruction, 18 Sep 2026). The site takes no money
       and no rail tells it anything, so what is recorded is their word. S6 6.5 (D7): it is a CLAIM,
       never paid, until his Received; claims accumulate, and together they may not pass what is owed. */
    if (!PAYABLE.includes(order.status)) return { error: "payment is recorded once the order is confirmed", status: 409 };
    const amount = body && body.amount;
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return { error: "say how much you paid", status: 400 };
    const due = +(dueOf(order) - claimedOf(order)).toFixed(2);
    if (due <= 0.004) return { error: "what is owed on this order is sent already and waiting for us to confirm it", status: 409 };
    if (amount > due + 0.004) return { error: "that is more than the " + due.toFixed(2) + " outstanding on this order", status: 400 };
    let method = order.method || null, account = order.account || null;
    if (body && body.method) {
      const r = pickRail(order, body, mine);
      if (r.error) return r;
      method = r.method; account = r.account;
    }
    if (!method) return { error: "choose how you are paying first", status: 400 };
    /* cash is his to record when he takes it (S11 11.8), so it can never count twice */
    if (method === "cod") return { error: "cash is recorded by us when we take it, so there is nothing to send here", status: 409 };
    return { ev: { kind: "claim", at, amount: +amount.toFixed(2), method, account } };
  }
  if (action === "say") {
    /* v751: ON ANY ORDER, at any stage. A question about an order that has been withdrawn or
       completed is still a question about that order, and sending them somewhere else to ask it
       is how a conversation leaves the record it belongs to. */
    const text = cleanMsg(body && body.text, MSG_MAX);
    if (!text) return { error: "write something first", status: 400 };
    if (saidBy(order, "customer") >= MSG_CAP) return { error: "there are already " + MSG_CAP + " of your messages on this order", status: 409 };
    return { ev: { kind: "say", at, by: "customer", text } };
  }
  return { error: "not found", status: 404 };
}
/* the cash rule reads their other orders, and only a rail being picked asks it */
const readsMine = (action, body) => action === "method" || (action === "pay" && !!(body && body.method));

/** The owner's moves, from the phone through the desk's Worker. Returns { ev }, { none } when there is
 *  nothing to record, or { error, status }. */
export function decideDesk(order, body, at) {
  if (!order) return { error: "no such order", status: 404 };
  /* v694: the desk's own bookkeeping, not a move. It is what the ledger has been told, written
     back by the reconcile the moment it queues a stage, and it is the only thing that stops a
     stage being queued twice. It never moves the order and never wakes anybody. */
  if (body && body.mark) {
    const m = body.mark, c = {};
    if (typeof m.ledgerKey === "string" && m.ledgerKey) c.ledgerKey = m.ledgerKey;
    for (const k of ["ack", "cancel", "close"]) if (m[k]) c[k] = String(m[k]).slice(0, 40);
    for (const k of ["paid", "moved"]) if (typeof m[k] === "number" && Number.isFinite(m[k])) c[k] = +m[k].toFixed(3);
    /* S6 6.5: each claim queued, by its moment, with the entry that tells the ledger of it */
    if (Array.isArray(m.claims)) c.claims = m.claims.slice(0, 20).filter((x) => x && typeof x.at === "string" && typeof x.draft === "string")
      .map((x) => ({ at: x.at.slice(0, 40), draft: x.draft.slice(0, 40) }));
    /* 20 Sep 2026: and what the desk made of its last pass over this order, so his card can say the
       truth: queued, waiting for its row, or failed, with the reason and when it was last written. The
       desk writes it only when it changes. It never reaches the customer's page, which reads history
       and figures alone. `rejected` (24 Sep 2026) is his own Reject under Approve on a row this order made. */
    if (m.sync && typeof m.sync === "object" && ["queued", "waiting", "failed", "rejected"].includes(m.sync.state))
      c.sync = { state: m.sync.state, why: String(m.sync.why || "").slice(0, 200), at: String(m.sync.at || at).slice(0, 40) };
    return { ev: { kind: "mark", at, mark: c } };
  }
  /* v764: WHAT THE BOOK ALREADY HOLDS, COMING BACK THE OTHER WAY (his instruction of 21 Sep 2026).
   * Money and goods are two tracks and the site has only ever heard one end of each: the customer
   * types what they paid, he types what he handed over HERE. When he takes the payment in cash and
   * enters it on the desk instead, this order kept saying nothing was paid, the page told them so,
   * and the hourly chase asked them again every hour for money he already had. It happened.
   * IT ONLY EVER RAISES. A customer's own word is never erased by a row that has not caught up, and
   * the figure comes with the MARK moved to match, or the desk's next pass would queue an entry for
   * a payment that is already on the row and count it twice. */
  if (body && body.ledger) {
    const L = body.ledger, ev = { kind: "ledger", at };
    if (isNum(L.paid) && L.paid > (+order.paid || 0) + 0.004) ev.paid = L.paid;
    if (isNum(L.moved) && L.moved > (+order.moved || 0) + 0.0004) ev.moved = L.moved;
    return ev.paid === undefined && ev.moved === undefined ? { none: true } : { ev };
  }
  /* S6 6.5 (D7): HIS ANSWER TO ONE CLAIM, named by its moment. The desk sends the figure it showed him, and this
     checks that it is that claim's and that it still waits; received makes it money he has confirmed. */
  if (body && body.verdict) {
    const v = body.verdict;
    if (!["received"].includes(v.kind)) return { error: "a claim is answered received", status: 400 };
    const p = (order.payments || []).find((x) => x && x.claim === "waiting" && x.at === v.claim);
    if (!p) return { error: "no claim of theirs waits under that name", status: 409 };
    if (!isNum(v.amount) || Math.abs(v.amount - p.amount) > 0.004) return { error: "that claim is " + p.amount.toFixed(2) + ", not " + (isNum(v.amount) ? v.amount.toFixed(2) : "a figure"), status: 409 };
    return { ev: { kind: "verdict", at, verdict: v.kind, claim: p.at, amount: p.amount } };
  }
  /* S11 11.6: NO REPLY NEEDED. A "thanks" had to be answered to leave his card. This answers it without a
     word: the moment of their last line is kept as `quiet`, bookkeeping like a mark, so it moves nothing, sends
     nothing, wakes nobody and never reaches their page. With no line of theirs waiting there is nothing to mark. */
  if (body && body.noReply === true) {
    const m = order.msgs || [], l = m[m.length - 1];
    if (!l || l.by !== "customer") return { none: true };
    return { ev: { kind: "mark", at, mark: { quiet: String(l.at).slice(0, 40) } } };
  }
  /* v753: HIS ANSWER ON THE ORDER. It is a move of his like any other, so it wakes them; it is not
     a state, so nothing about the order changes but the thread. There is no cap on his own lines: the
     cap v751 set counts theirs, and a man answering his own customers is not a thing to ration. */
  if (body && typeof body.message === "string") {
    const text = cleanMsg(body.message, MSG_MAX);
    if (!text) return { error: "write something first", status: 400 };
    return { ev: { kind: "say", at, by: "desk", text } };
  }
  /* S11 11.8: CASH HE TOOK AT THE HANDOVER, recorded from the desk's Cash to record row. It is a payment like
     theirs, adding to what is paid, so the chase stops the moment it is paid; it is his, so it never marks theirs
     and is kept `by: "desk"`. Its Fulfilment is the desk's own (the Cash received tap books it, S11 11.12), so the
     ledger's mark of the money moves with it, by the same figure, and the reconcile never queues it a second time. */
  if (body && body.cash) {
    if (!PAYABLE.includes(order.status)) return { error: "cash is recorded on an agreed order, not one that is " + order.status, status: 409 };
    const a = body.cash.amount;
    if (!isNum(a) || a <= 0) return { error: "say how much was received", status: 400 };
    const due = +(dueOf(order) - claimedOf(order)).toFixed(2);   /* S6: less what they say they sent, which he answers apart */
    if (a > due + 0.004) return { error: "that is more than the " + due.toFixed(2) + " outstanding on this order", status: 400 };
    return { ev: { kind: "cash", at, amount: +a.toFixed(2) } };
  }
  /* v694: what he handed over, in units, whichever way it went. It is its own step and its own
     entry, because goods and money move apart: he may deliver before a ringgit arrives. */
  if (body && body.handover) {
    if (!ROWED.includes(order.status)) return { error: "nothing is handed over on an order that is " + order.status, status: 409 };
    const n = body.handover.units;
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > order.qty + 0.004)
      return { error: "the units handed over have to be a figure from zero to the " + order.qty + " ordered", status: 400 };
    const ev = { kind: "handover", at, units: n };
    if (MODES.includes(body.handover.mode)) ev.mode = body.handover.mode;
    /* S11 11.9: CLOSE AT WHAT WAS HANDED OVER. A short delivery could never complete: nothing amended the
       size, so it held an open slot and was chased for goods never sent. Closing restates the order at what
       went: the size becomes the units handed over and the goods' total is the figure THE DESK STATES
       (its engine's closeGoods), which this only checks lies between nothing and what was agreed: the
       site prices nothing. The delivery charge stands. Its row is a Correction (src/orders.js). */
    if (body.handover.close === true && n < order.qty - 0.004) {
      if (!(n > 0)) return { error: "nothing was handed over, so there is nothing to close at: cancel it instead", status: 400 };
      if (!PAYABLE.includes(order.status)) return { error: "an order that is " + order.status + " cannot be closed short", status: 409 };
      const t = body.handover.total;
      if (!isNum(t) || t < 0 || t > (+order.total) + 0.004) return { error: "a close states the goods' total, from nothing to the " + (+order.total).toFixed(2) + " agreed", status: 400 };
      ev.close = true;
      ev.total = +t.toFixed(2);
    }
    return { ev };
  }
  const status = String((body && body.status) || "");
  if (!NEXT[status]) return { error: "not a state the desk sets", status: 400 };
  if (!NEXT[status].includes(order.status)) return { error: "an order that is " + order.status + " cannot become " + status, status: 409 };
  if (status === "cancelled" && (+order.moved || 0) > 0) return { error: "the goods are already out, so this cannot be cancelled", status: 409 };
  const ev = { kind: "status", at, status, by: "desk" };
  if ((status === "ready" || status === "acknowledged") && body && MODES.includes(body.mode)) ev.mode = body.mode;
  /* v502: delivery is a figure the owner types; v694 moved it to the acknowledgement, because
     that is where the order becomes a row and the row carries the charge inside its total. */
  if (status === "acknowledged") {
    const d = body && typeof body.delivery === "number" && Number.isFinite(body.delivery) && body.delivery >= 0 ? +body.delivery.toFixed(2) : 0;
    ev.delivery = (ev.mode || order.mode) === "deliver" ? d : 0;
  }
  /* S11 11.7: a decline or a cancellation of his carries its reason, which their page reads beside Not taken or
     Cancelled by us; one line, as every line they read is. The desk's relay has put it through siteWords. */
  if (body && typeof body.note === "string" && cleanMsg(body.note, MSG_MAX)) ev.note = cleanMsg(body.note, MSG_MAX);
  return { ev };
}

/** One event folded into the order (null before a placement). Returns { order, done }, `done` when this
 *  event completed it. The order passed in is changed in place, except by a place or a copy. */
export function applyEvent(order, ev) {
  const at = ev.at;
  let done = false;
  if (ev.kind === "place" || ev.kind === "copy") return { order: JSON.parse(JSON.stringify(ev.order)), done };
  if (ev.kind === "status") {
    if (ev.mode) order.mode = ev.mode;
    if (ev.delivery !== undefined) order.delivery = ev.delivery;
    order.status = ev.status;
    const h = { at, status: ev.status, by: ev.by };
    if (ev.note) h.note = ev.note;
    order.history.push(h);
  } else if (ev.kind === "method") {
    order.method = ev.method; order.account = ev.account; order.methodAt = at;
    order.history.push({ at, status: order.status, by: "customer", method: ev.method, account: ev.account });
  } else if (ev.kind === "pay") {
    order.paid = +((+order.paid || 0) + ev.amount).toFixed(2); order.method = ev.method; order.account = ev.account;
    order.payments = (order.payments || []).concat([{ at, amount: +ev.amount.toFixed(2), method: ev.method, account: ev.account }]);
    order.history.push({ at, status: order.status, by: "customer", method: ev.method, account: ev.account, note: "paid " + ev.amount.toFixed(2) });
    done = settle(order, at);
  } else if (ev.kind === "claim") {   /* S6 6.5: their word, waiting for his; paid does not move */
    order.method = ev.method; order.account = ev.account;
    order.payments = (order.payments || []).concat([{ at, amount: ev.amount, method: ev.method, account: ev.account, claim: "waiting" }]);
    order.claimed = claimedOf(order);
    order.history.push({ at, status: order.status, by: "customer", method: ev.method, account: ev.account, note: "sent " + ev.amount.toFixed(2) });
  } else if (ev.kind === "verdict") {   /* S6: his answer to one claim, which keeps its record */
    const p = (order.payments || []).find((x) => x && x.claim === "waiting" && x.at === ev.claim);
    if (p) {
      order.payments = order.payments.map((x) => (x === p ? Object.assign({}, x, { claim: ev.verdict, answered: at }) : x));
      order.claimed = claimedOf(order);
      order.paid = +((+order.paid || 0) + p.amount).toFixed(2);
      /* a claim already queued told the ledger by its own entry, so the ledger's mark of the money moves with it */
      if (p.queued) order.queued = Object.assign({}, order.queued || {}, { paid: +((+((order.queued || {}).paid) || 0) + p.amount).toFixed(2) });
      order.history.push({ at, status: order.status, by: "desk", note: "received " + p.amount.toFixed(2) });
      done = settle(order, at);
    }
  } else if (ev.kind === "cash") {
    order.paid = +((+order.paid || 0) + ev.amount).toFixed(2);
    /* by the amount, not to what is paid: a claim of theirs not yet queued stays owed to the ledger as their own */
    order.queued = Object.assign({}, order.queued || {}, { paid: +((+((order.queued || {}).paid) || 0) + ev.amount).toFixed(2) });
    if (!order.method) order.method = "cod";
    order.payments = (order.payments || []).concat([{ at, amount: ev.amount, method: "cod", account: null, by: "desk" }]);
    order.history.push({ at, status: order.status, by: "desk", method: "cod", note: "paid " + ev.amount.toFixed(2) + " in cash" });
    done = settle(order, at);
  } else if (ev.kind === "say") {
    order.msgs = ((order.msgs) || []).concat([{ at, by: ev.by, text: ev.text }]);
  } else if (ev.kind === "mark") {
    const m = ev.mark, q = Object.assign({}, order.queued || {});
    if (m.ledgerKey) order.ledgerKey = m.ledgerKey;
    /* WHAT THE LEDGER HAS BEEN TOLD OF THE MONEY ONLY RISES (S10 10.2): the reconcile marks what it read, and the
       return leg may have raised the order to the book's figure in the same minute; lowered, the next pass would
       queue the difference a second time. The goods are stated, not added, so their mark is set as read. */
    for (const k of ["ack", "cancel", "close", "paid", "moved"]) if (m[k] !== undefined) q[k] = k === "paid" ? Math.max(+q.paid || 0, m[k]) : m[k];
    if (m.sync) order.sync = m.sync;
    if (m.quiet) order.quiet = m.quiet;   /* S11 11.6: a line he said needs no reply */
    /* S6 6.5: a claim queued is named by its entry, once; one he has received by then is money the ledger is now told of */
    for (const c of m.claims || []) {
      const p = (order.payments || []).find((x) => x && x.claim && x.at === c.at && !x.queued);
      if (!p) continue;
      order.payments = order.payments.map((x) => (x === p ? Object.assign({}, x, { queued: c.draft }) : x));
      if (p.claim === "received") q.paid = +((+q.paid || 0) + p.amount).toFixed(2);
    }
    order.queued = q;
  } else if (ev.kind === "ledger") {
    const q = Object.assign({}, order.queued || {});
    let told = false;
    if (isNum(ev.paid) && ev.paid > (+order.paid || 0) + 0.004) {
      const was = +order.paid || 0;
      order.paid = +ev.paid.toFixed(2); q.paid = order.paid; told = true;
      order.history.push({ at, status: order.status, by: "desk", note: "payment of " + (order.paid - was).toFixed(2) + " recorded" });
    }
    if (isNum(ev.moved) && ev.moved > (+order.moved || 0) + 0.0004) {
      order.moved = +ev.moved.toFixed(3); q.moved = order.moved; told = true;
      order.movedOn = klDay(at);   /* the day of the LAST handover, as Site orders writes it: the chase's grace runs from it (S12-R1) */
      order.history.push({ at, status: order.status, by: "desk", note: order.moved + " unit " + (order.mode === "deliver" ? "delivered" : "collected") });
    }
    if (told) { order.queued = q; done = settle(order, at); }
  } else if (ev.kind === "handover") {
    order.moved = +ev.units.toFixed(3);
    order.movedOn = klDay(at);
    order.movedAt = at;   /* the moment, for the desk to stamp the Correction with (20 Sep 2026) */
    if (ev.mode) order.mode = ev.mode;
    order.history.push({ at, status: order.status, by: "desk", note: order.moved + " unit " + (order.mode === "deliver" ? "delivered" : "collected") });
    if (ev.close) {   /* S11 11.9: the size and the goods' total restated at what went, the old ones kept */
      order.closed = { at, qty: order.qty, total: order.total };
      order.qty = order.moved; order.total = ev.total;
      order.history.push({ at, status: order.status, by: "desk", note: "closed at " + order.qty + " unit of the " + order.closed.qty + " ordered" });
    }
    done = settle(order, at);
  }
  return { order, done };
}

/* WHAT A MOVE TELLS THE REST OF THE SITE: the shared marks it moves, each [key, value] in the order they
   are written, and whether it wakes the customer. A placement marks new business; every move but the
   desk's own bookkeeping marks a change; a line of theirs marks `last-said`; money in and an order taken
   back mark `last-theirs` (v760); his moves wake them, and of theirs only a payment that completes. */
export function marksOf(ev, order) {
  if (ev.kind === "mark" || ev.kind === "copy") return [];
  const at = ev.at;
  if (ev.kind === "place") return [[LAST_PLACED, at], [LAST_TOUCHED, at]].concat(order && order.msgs && order.msgs.length ? [[LAST_SAID, at]] : []);
  const k = [[LAST_TOUCHED, at]];
  if (ev.kind === "say" && ev.by === "customer") k.push([LAST_SAID, at]);
  if (ev.kind === "pay" || ev.kind === "claim") k.push([LAST_THEIRS, at + "|pay"]);
  if (ev.kind === "status" && ev.by === "customer") k.push([LAST_THEIRS, at + "|cancel"]);
  return k;
}
/* S12 12.2: WHAT KIND OF NEWS EACH MOVE OF HIS IS, for the banner, whose words are NEWS in stmt/sw.js.
   A handover says delivered or collected by the order's own mode, and "part" while units are still to come. */
const STATUS_NEWS = { acknowledged: "confirmed", ready: "ready", done: "complete", declined: "declined", cancelled: "cancelled" };
const handedNews = (o) => (+o.moved > 0 ? (owedUnits(o) > 0.004 ? "part-" : "") + (o.mode === "deliver" ? "delivered" : "collected") : null);

/* THE WAKE A MOVE SENDS, { k, o }: its kind (S12 12.2) and the order a tap opens, or null for none. Read off the event
   and the order it folded into, so both roads send the same kind: a payment the book carried back is "paid", else
   the goods it carried back; a handover names what was handed over; his state, its news; his line, a reply; and a
   payment of theirs that completes the order, complete. A handover of nothing still wakes, with no kind, as it did. */
export function wakes(ev, order, done) {
  const o = (order && order.id) || "";
  if (ev.kind === "ledger") return { k: ev.paid !== undefined ? "paid" : handedNews(order), o };
  if (ev.kind === "handover") return { k: handedNews(order), o };
  if (ev.kind === "status" && ev.by === "desk") return { k: STATUS_NEWS[ev.status], o };
  if (ev.kind === "say" && ev.by === "desk") return { k: "reply", o };
  if (ev.kind === "pay" && done) return { k: "complete", o };
  if (ev.kind === "cash") return { k: done ? "complete" : "paid", o };   /* S11 11.8: his cash is their payment received */
  if (ev.kind === "verdict") return { k: done ? "complete" : "paid", o };   /* S6: his Received */
  return null;
}

/** The marks as the desk reads them, one question a minute (/desk/orders/last). */
export async function orderMarks(env) {
  const fromKv = async () => ({ last: await env.STMT.get(LAST_PLACED), touched: await env.STMT.get(LAST_TOUCHED),
    said: await env.STMT.get(LAST_SAID), theirs: await env.STMT.get(LAST_THEIRS) });
  if (!onBook(env)) return fromKv();
  const r = await bookRead(env, "last", {}, fromKv);
  return { last: r.last, touched: r.touched, said: r.said, theirs: r.theirs };
}
/** Every order of one account gone from the book (his test account, unmade). The KV road's keys are the caller's.
 *  ON THE KV ROAD WITH THE BOOK BOUND (after a flip back) the book is told as well, best effort (S10 fix P3):
 *  this is the one place KV loses an order, and a book still holding them would bring them back on the return. */
export async function dropOrders(env, u) {
  if (onBook(env)) return (await book(env, "drop", { u })).dropped || 0;
  let n = 0;
  if (env.ORDERBOOK) {
    try { n = (await book(env, "drop", { u })).dropped || 0; }
    catch (e) { console.log("orders: the order book did not answer drop: " + String((e && e.message) || e)); }
  }
  await markRoad(env);
  return n;
}

export async function placeOrder(env, u, body) {
  if (onBook(env)) {
    const rid = ridOf(body), r = await bookMove(env, "place", { u, body, rid });
    if (r.error) return r;
    /* in the week of reading both the id is filed for the KV road too, so a retry after a flip back lands once (S10 fix DS4) */
    if (readsBoth(env) && !r.again) await fileRid(env, u, rid, r.order.id);
    return { order: r.order };
  }
  const rid = ridOf(body), again = await repeatOf(env, u, rid);
  if (again) return again;
  const open = (await ordersOf(env, u)).filter((o) => OPEN_STATES.includes(o.status));
  const d = decidePlace(u, body, open, new Date().toISOString());
  if (d.error) return { error: d.error };
  const { order } = applyEvent(null, d.ev);
  await env.STMT.put(OKEY(u, order.id), JSON.stringify(order));
  await markRoad(env);
  await fileRid(env, u, rid, order.id);
  for (const [k, v] of marksOf(d.ev, order)) await putSoft(env, k, v);
  return { order };
}

/** The customer's own moves: a rail at ready, or a withdrawal before anything is on the road. */
export async function customerMove(env, u, id, action, body) {
  if (onBook(env)) {
    const r = await bookMove(env, "customer", { u, id, action, body, rid: ridOf(body) });
    if (r.error) return r;
    if (readsBoth(env) && action === "pay" && !r.again) await fileRid(env, u, ridOf(body), id);
    /* v700: a payment that completes the order is the one customer move worth waking the phone for,
       because it is the only one whose answer arrives after they have put the phone down. Every
       other move of theirs happens with the page in front of them. */
    if (r.wake) await wakeCustomer(env, u, r.wake);
    return { order: r.order };
  }
  /* a payment already recorded under this id is answered before anything is checked, because the
     first may have completed the order, and a repeat must not read as a refusal */
  const rid = action === "pay" ? ridOf(body) : "", again = await repeatOf(env, u, rid, id);
  if (again) return again;
  const order = await env.STMT.get(OKEY(u, id), "json");
  const d = decideCustomer(order, action, body, order && readsMine(action, body) ? await ordersOf(env, u) : [], new Date().toISOString());
  if (d.error) return d;
  const { done } = applyEvent(order, d.ev);
  await env.STMT.put(OKEY(u, id), JSON.stringify(order));
  await markRoad(env);
  await fileRid(env, u, rid, id);
  /* v751: and a mark the desk's own nudge can read, so a line waits for him rather than for a poll;
     v760: money in, or the order taken back, both things he has to act on and neither in front of him */
  for (const [k, v] of marksOf(d.ev, order)) await putSoft(env, k, v);
  const w = wakes(d.ev, order, done);
  if (w) await wakeCustomer(env, u, w);
  return { order };
}

/* The rail, checked against the pay master, with the one rail his rule withholds. */
function pickRail(order, body, mine) {
  const method = String((body && body.method) || "");
  if (!METHODS.includes(method)) return { error: "that is not a way to pay this site offers", status: 400 };
  if (method === "cod" && hasUnpaidAdvance(mine))
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
  if (onBook(env)) {
    const r = await bookMove(env, "desk", { u, id, body });
    if (r.error) return r;
    if (!r.wake) return { order: r.order };
    const push = await wakeCustomer(env, u, r.wake);
    return { order: r.order, push };
  }
  const order = await env.STMT.get(OKEY(u, id), "json");
  const d = decideDesk(order, body, new Date().toISOString());
  if (d.error) return d;
  if (d.none) return { order };
  const { done } = applyEvent(order, d.ev);
  await env.STMT.put(OKEY(u, id), JSON.stringify(order));
  await markRoad(env);
  for (const [k, v] of marksOf(d.ev, order)) await putSoft(env, k, v);
  const w = wakes(d.ev, order, done);
  if (!w) return { order };
  const push = await wakeCustomer(env, u, w);
  return { order, push };
}

const klDay = (iso) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });
