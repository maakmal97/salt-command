/* tools/testfix.mjs: WHAT HIS TEST ACCOUNTS SHOW (29 Sep 2026, his instruction that they show every feature).
 *
 * The test account (0000-0000, stmt/testfix.js) is his to try the Counter with, and counts nowhere. It showed a
 * one-line statement and whatever he ordered on it, so most of what a customer sees could not be tried without a
 * real customer's account. This builds, for the moment it is given, an invented account holding a case of every
 * feature a customer sees, and the publish seals it for the test account alone (sealFixture). The Worker lays it
 * over the test account's own record and orders and nothing else (stmt/testfix.js), so no count reads it. There are
 * two (his answer of 29 Sep 2026): 0000-0000 open, a claim of theirs waiting so it can order, and 0000-0001 locked.
 *
 * EVERYTHING HERE IS INVENTED: the code, the places, the words, the prices. The orders are made by the order
 * book's own decide and apply functions, so an order here has the shape a real one has and cannot drift from it;
 * the live statement is the real renderer over an invented book (make_statements liveFor).
 *
 * FEATURES is the list the suite holds the fixture to: every feature a customer sees, each with the test that its
 * case is here. A feature that lands later lands with its line here and its case in build(), or the suite is red.
 */
import { createHash } from "node:crypto";
import { decidePlace, decideDesk, decideCustomer, decideAccountClaim, applyEvent, MODES, METHODS, VERDICTS, OPEN_STATES,
  ROWED, customerView, rateDue } from "../stmt/orders.js";
import { PAY_ACCOUNTS } from "../stmt/pay.js";
import { TEST_USER, FIX_VERSION, TESTS, TEST_USERS } from "../stmt/testfix.js";
import { unwrapKey, encryptWith } from "./stmt-crypto.mjs";
import { liveFor, holdTerm, stageDays } from "./make_statements.mjs";

/* the invented account on the invented book: no roster holds either code */
export const FIX_CODE = "TX0-FIX";
let U = TEST_USER;   /* the account a build is for, set by build() */

const klDay = (d) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });
/* `n` days before `now` and an hour earlier, with `m` minutes on (under sixty), so every moment is past and the history
   reads in order */
const ago = (now, n, m = 0) => new Date(now.getTime() - n * 864e5 - (60 - m) * 6e4).toISOString();

/* the rail a payment is made by, off the accounts the site takes today: a method no account runs has no case */
const railFor = (method) => {
  if (method === "cod") return { method, account: null };
  if (method === "tngbiz") { const a = PAY_ACCOUNTS.find((x) => x.key === "tngbiz" && !x.maintenance && x.qr); return a ? { method, account: a.key } : null; }
  const a = PAY_ACCOUNTS.find((x) => x.key !== "tngbiz" && !x.maintenance && x[method]);
  return a ? { method, account: a.key } : null;
};
/** Every way to pay the site offers today: the methods the suite asks a case of. */
export const offeredMethods = () => METHODS.filter((m) => railFor(m));

/* THE PRICE LIST, invented, with a cap on salt so an order over it is paid in advance (V3) and one book not yet priced */
function priceList(now) {
  const monday = klDay(new Date(now.getTime() - ((new Date(now).getUTCDay() + 6) % 7) * 864e5));
  const list = { at: now.toISOString(), week: { monday, sunday: monday, label: "this week" }, since: klDay(new Date(now.getTime() - 60 * 864e5)),
    products: [
      { product: "salt", name: "Salt", unit: "unit", basis: "tier", tier: "Silver", levels: null, cap: { own: 10, friend: 5 },
        sizes: [{ q: 1, price: 110 }, { q: 2.5, price: 270 }, { q: 5, price: 530 }, { q: 12.5, price: 1300 }] },
      { product: "oil", name: "Oil", unit: "unit", basis: "board", tier: null, levels: null, sizes: [{ q: 1, price: 40 }, { q: 3, price: 115 }] },
      { product: "candy", name: "Candy", unit: "unit", basis: "board", tier: null, levels: null, sizes: [{ q: 1, price: 12 }, { q: 4, price: 45 }] },
      { product: "rice", name: "Rice", unit: "unit", basis: "board", tier: null, levels: null, sizes: [{ q: 1, price: 9 }, { q: 2, price: 17 }] }
    ],
    soon: [{ product: "spare", name: "Spare" }] };
  list.digest = createHash("sha256").update("testfix\n" + JSON.stringify(list.products.map((p) => [p.product, p.sizes, p.cap || null]))).digest("hex");
  return list;
}
const priceOf = (list, product, q) => list.products.find((p) => p.product === product).sizes.find((s) => s.q === q).price;

/* one order, taken through the order book's own moves: each step is [moment, who, body] */
function order(id, list, placedAt, place, steps) {
  const body = Object.assign({ unit: 0, week: list.week.monday, digest: list.digest }, place);
  body.total = priceOf(list, body.product, body.qty); body.unit = +(body.total / body.qty).toFixed(2);
  const caps = { salt: list.products[0].cap };
  const p = decidePlace(U, body, [], placedAt, list.digest, caps);
  if (p.error) throw new Error("the fixture's order " + id + " was refused at Place: " + p.error);
  let o = applyEvent(null, p.ev).order;
  o.id = id;
  for (const [at, who, b] of steps) {
    const d = who === "desk" ? decideDesk(o, b, at) : decideCustomer(o, b.action, b, [], at);
    if (d.error) throw new Error("the fixture's order " + id + " was refused a move (" + JSON.stringify(b) + "): " + d.error);
    if (d.none) continue;
    o = applyEvent(o, d.ev).order;
  }
  return o;
}

/* HOW OLD THE OVERDUE GOODS ARE IN EACH ACCOUNT'S STATE (stmt/testfix.js TESTS), in days since the handover, off the
   desk's own stages: locked past the lock day, and open past it too with a claim waiting, which lifts every stage */
export function overdueDays(state) {
  const term = holdTerm(), st = stageDays(), hide = st.hide != null ? st.hide : term + 1, lock = st.lock != null ? st.lock : hide + 1;
  return { open: lock + 3, locked: lock + 1 }[state];
}

/** The fixture for the moment `now`, in one state: the invented book, the orders, the claims, the links, the card and the rest. */
export function build(now = new Date(), state = "open", u = TEST_USER) {
  now = new Date(now);
  U = u;
  /* ONLY OPEN HAS A CLAIM WAITING, since any claim of theirs waiting lifts the hold and every stage */
  const W = state === "open";
  const list = priceList(now), T = (n, m) => ago(now, n, m);
  const oid = (n, k) => T(n, 0).replace(/[-:.TZ]/g, "").slice(0, 14) + "-ex" + k;
  /* a rail the site does not take today falls back to one it does, never to nothing */
  const fallback = railFor(offeredMethods().find((m) => m !== "cod")), rail = (m) => railFor(m) || fallback;
  const pay = (m) => Object.assign({ action: "method" }, rail(m));
  const O = [];
  /* A SHEET OF TWO, placed: salt over the cap, so paid in advance (V3), and rice beside it (v936) */
  const sheet = "exampleSheet0001";
  O.push(order(oid(0, "01"), list, T(0, 5), { product: "salt", qty: 12.5, mode: "deliver", place: "Jalan Contoh", sheet,
    note: "Please ring when you are outside." }, []));
  O.push(order(oid(0, "02"), list, T(0, 5), { product: "rice", qty: 2, mode: "deliver", place: "Jalan Contoh", sheet }, []));
  /* AGREED, delivered, a delivery charge, a transfer they say they sent and he has not answered, and a thread */
  O.push(order(oid(2, "03"), list, T(2), { product: "oil", qty: 3, mode: "deliver", place: "Taman Rekaan" }, [
    [T(2, 30), "desk", { status: "acknowledged", delivery: 5 }],
    [T(2, 40), "customer", { action: "say", text: "Could it come after three?" }],
    [T(2, 55), "desk", { message: "After three is fine." }],
    [T(1), "customer", pay("transfer")]].concat(W ? [
    [T(1, 2), "customer", Object.assign({ action: "pay", amount: 120, slip: "e0a1b2c3d4e5f60718293a4b5c6d7e8f" }, rail("transfer"))]] : [])));   /* F13: with a slip */
  /* READY to collect, due at Ready, for a friend of an associate's; part of it said sent with a slip long past its thirty
     days, so the page says the slip is no longer kept (F13) */
  /* and priced at the acknowledgement under what they placed it at, which the page shows beside it (Step 2) */
  O.push(order(oid(35, "04"), list, T(35), { product: "salt", qty: 2.5, mode: "collect", forFriend: true }, [
    [T(35, 20), "desk", { status: "acknowledged", total: 260 }]].concat(W ? [
    [T(34), "customer", Object.assign({ action: "pay", amount: 100, slip: "e1a1b2c3d4e5f60718293a4b5c6d7e8f" }, rail("transfer"))]] : [], [
    [T(1, 10), "desk", { status: "ready" }]])));
  /* COLLECTED and paid in cash: complete */
  O.push(order(oid(9, "05"), list, T(9), { product: "salt", qty: 1, mode: "collect" }, [
    [T(9, 20), "desk", { status: "acknowledged" }], [T(8), "desk", { status: "ready" }],
    [T(8, 30), "desk", { handover: { units: 1 } }], [T(8, 31), "desk", { cash: { amount: 110 } }]]));
  /* DELIVERED and paid by a transfer he received: complete */
  O.push(order(oid(12, "06"), list, T(12), { product: "candy", qty: 4, mode: "deliver", place: "Taman Rekaan" }, [
    [T(12, 20), "desk", { status: "acknowledged", delivery: 3 }], [T(11), "customer", pay("transfer")],
    [T(11, 5), "customer", Object.assign({ action: "pay", amount: 48 }, rail("transfer"))],
    [T(11, 30), "desk", { verdict: { kind: "received", claim: T(11, 5), amount: 48 } }],
    [T(10), "desk", { status: "ready" }], [T(10, 30), "desk", { handover: { units: 4, mode: "deliver" } }],
    [T(7), "customer", { action: "rate", stars: 4 }]]));   /* F10: and rated, four stars */
  /* A SHEET AGREED, MADE READY AND HANDED OVER TOGETHER (V4b.2, v938): the charge on the first order, none on the rest */
  const sheet2 = "exampleSheet0002";
  for (const [k, product, qty, deliv, paid] of [["12", "oil", 1, 4, 44], ["13", "candy", 1, 0, 12]]) {
    O.push(order(oid(6, k), list, T(6), { product, qty, mode: "deliver", place: "Taman Rekaan", sheet: sheet2 }, [
      [T(6, 20), "desk", { status: "acknowledged", delivery: deliv }], [T(5), "desk", { status: "ready" }],
      [T(5, 30), "desk", { handover: { units: qty, mode: "deliver" } }], [T(5, 31), "desk", { cash: { amount: paid } }]]));
  }
  /* READY AGAIN FOR THE REST (Step 1b): paid ahead by a transfer, half handed over, and the rest ready */
  O.push(order(oid(4, "14"), list, T(4), { product: "salt", qty: 5, mode: "collect" }, [
    [T(4, 20), "desk", { status: "acknowledged" }], [T(4, 30), "customer", pay("transfer")],
    [T(4, 35), "customer", Object.assign({ action: "pay", amount: 530 }, rail("transfer"))],
    [T(4, 50), "desk", { verdict: { kind: "received", claim: T(4, 35), amount: 530 } }],
    [T(3, 10), "desk", { status: "ready" }], [T(3, 30), "desk", { handover: { units: 2.5 } }], [T(2, 10), "desk", { status: "ready" }]]));
  /* WITHDRAWN by them */
  O.push(order(oid(14, "07"), list, T(14), { product: "rice", qty: 1, mode: "collect" }, [
    [T(14, 40), "customer", { action: "cancel" }]]));
  /* NOT TAKEN by us, with his reason */
  O.push(order(oid(16, "08"), list, T(16), { product: "oil", qty: 1, mode: "collect" }, [
    [T(16, 30), "desk", { status: "declined", note: "None of this size this week." }]]));
  /* CANCELLED by us after agreeing it, with his reason */
  O.push(order(oid(18, "09"), list, T(18), { product: "salt", qty: 1, mode: "deliver", place: "Taman Rekaan" }, [
    [T(18, 20), "desk", { status: "acknowledged", delivery: 5 }],
    [T(17), "desk", { status: "cancelled", note: "The road was shut that day." }]]));
  /* CLOSED at what was handed over: 2.5 of 5, then paid by JomPAY, which he confirmed */
  O.push(order(oid(21, "10"), list, T(21), { product: "salt", qty: 5, mode: "collect" }, [
    [T(21, 20), "desk", { status: "acknowledged" }], [T(20), "desk", { status: "ready" }],
    [T(20, 30), "desk", { handover: { units: 2.5, close: true, total: 265 } }],
    [T(20, 40), "customer", pay("jompay")],
    [T(20, 45), "customer", Object.assign({ action: "pay", amount: 265 }, rail("jompay"))],
    [T(19), "desk", { verdict: { kind: "received", claim: T(20, 45), amount: 265 } }]]));
  /* a claim he did not find, on a done order paid by the Touch 'n Go code since */
  O.push(order(oid(25, "11"), list, T(25), { product: "rice", qty: 2, mode: "collect" }, [
    [T(25, 20), "desk", { status: "acknowledged" }], [T(25, 30), "desk", { handover: { units: 2 } }],
    [T(24), "customer", pay("tngbiz")],
    [T(24, 5), "customer", Object.assign({ action: "pay", amount: 17 }, rail("tngbiz"))],
    [T(23), "desk", { verdict: { kind: "notfound", claim: T(24, 5), amount: 17 } }],
    [T(22), "customer", Object.assign({ action: "pay", amount: 17 }, rail("tngbiz"))],
    [T(22, 30), "desk", { verdict: { kind: "received", claim: T(22), amount: 17 } }]]));

  /* EACH ORDER ON THE BOOK IS A ROW, dated its placing day, as the desk's reconcile would book it; the key names the
     invented code, and the page reads only its day (rowOn) */
  const sales = [];
  let rid = 0;
  const row = (r) => { sales.push(Object.assign({ rid: "x" + (++rid), cash: 0, deliveredQty: 0 }, r)); return r; };
  for (const o of O) {
    if (!ROWED.includes(o.status) && !(o.status === "cancelled" && o.history.some((h) => h.status === "acknowledged"))) continue;
    const day = klDay(new Date(o.at)), customer = o.forFriend ? FIX_CODE + "-R" : FIX_CODE;
    o.ledgerKey = customer + "|" + day + "|" + o.qty + "|" + o.product;
    row(Object.assign({ date: day, customer, qty: o.qty, total: o.total, product: o.product, cash: +o.paid || 0, deliveredQty: +o.moved || 0 },
      o.delivery ? { delivery: o.delivery } : {}, o.forFriend ? { rev: "R2" } : {},
      o.movedOn ? { deliveredOn: o.movedOn, handover: o.mode === "deliver" ? "delivered" : "collected" } : {},
      +o.paid > 0 ? { paidOn: o.movedOn || day } : {},
      o.status === "cancelled" ? { cancelled: true, cancelledOn: klDay(new Date(o.history[o.history.length - 1].at)) } : {}));
  }
  /* AND TWO ROWS HE ENTERED ON THE DESK: goods with them on credit, inside the term, and goods past it, overdue */
  row({ date: klDay(new Date(T(1))), customer: FIX_CODE, qty: 1, total: 110, product: "salt", deliveredQty: 1, deliveredOn: klDay(new Date(T(1))), handover: "collected" });
  const od = overdueDays(state);
  row({ date: klDay(new Date(T(od))), customer: FIX_CODE, qty: 4, total: 45, product: "candy", deliveredQty: 4, deliveredOn: klDay(new Date(T(od))), handover: "collected" });

  /* A CLAIM AGAINST THE ACCOUNT, waiting on him, for the overdue goods, when open: it is what reopens ordering (his D9,
     amended) and lifts every stage; and one he received, by a DuitNow QR */
  const claims = [];
  const aclaim = (at, amount, method, verdict, answeredAt) => {
    const d = decideAccountClaim(U, Object.assign({ amount }, rail(method)), [], at);
    if (d.error) throw new Error("the fixture's claim was refused: " + d.error);
    let c = applyEvent(null, d.ev).order;
    c.id = "a" + T(0, 0).replace(/[-:.TZ]/g, "").slice(0, 14) + "-ex" + (claims.length + 1);
    if (verdict) c = applyEvent(c, { kind: "verdict", at: answeredAt, verdict }).order;
    claims.push(c);
  };
  if (W) aclaim(T(0, 1), 45, "transfer");
  aclaim(T(30), 60, "qr", "received", T(29));

  /* HIS GUEST LINKS AS AN ASSOCIATE SEES THEM: one open, one waiting on him, one he declined, one withdrawn. The ids are
     of a link's shape and are no link: the site answers them with its one shut page */
  const refs = [
    { id: "exa2-mpl3", made: T(40), opens: 3, last: T(2) },
    { id: "exa4-mpl5", made: T(1), opens: 0, approved: false },
    { id: "exa6-mpl7", made: T(20), opens: 0, approved: false, declined: true },
    { id: "exa8-mpl9", made: T(50), opens: 1, last: T(45), revoked: true }];

  /* AN ASSOCIATE'S CARD, each book's sales progress, the reward on salt alone (a tiered book) */
  const card = { at: now.toISOString(), products: [
    { product: "salt", name: "Salt", unit: "unit", summary: { bought: 1805, soldFor: 270, onward: 1, introduced: 530, referred: 2 },
      reward: { earned: 42.5, taken: 20, left: 22.5, next: 0.4, held: false },
      lines: [{ date: T(3).slice(0, 10), kind: "onward", qty: 2.5, rm: 270 }, { date: T(9).slice(0, 10), kind: "own", qty: 1, rm: 110 },
        { date: T(21).slice(0, 10), kind: "own", qty: 2.5, rm: 265 }] },
    { product: "oil", name: "Oil", unit: "unit", summary: { bought: 115, soldFor: 0, onward: 0, introduced: 0, referred: 0 }, reward: null,
      lines: [{ date: T(2).slice(0, 10), kind: "own", qty: 3, rm: 115 }] }] };

  const book = { sales, customerRefunds: [] };
  return { v: FIX_VERSION, u, state, at: now.toISOString(), code: FIX_CODE, book, live: liveFor(book, FIX_CODE, now, U), prices: list,
    caps: { salt: list.products[0].cap }, orders: O, claims, refs, card, assoc: true,
    bulletin: { lines: ["An example notice: the counter opens late on Friday."] } };
}

/* ---- WHAT A CUSTOMER SEES, AND THE CASE OF EACH HERE ------------------------------------------------------------
   One line a feature, and the test its case is in the fixture. The suite also derives cases from the code itself
   (every state, way, rail and claim answer), so a new one of those needs no line here to be asked for. */
const has = (f, p) => f.orders.some(p);
const hist = (o, p) => (o.history || []).some(p);
export const FEATURES = [
  ["order placed, waiting on him", (f) => has(f, (o) => o.status === "placed")],
  ["order agreed", (f) => has(f, (o) => o.status === "acknowledged")],
  ["order ready", (f) => has(f, (o) => o.status === "ready")],
  ["order complete, collected", (f) => has(f, (o) => o.status === "done" && o.mode === "collect")],
  ["order complete, delivered", (f) => has(f, (o) => o.status === "done" && o.mode === "deliver")],
  ["withdrawn by them", (f) => has(f, (o) => o.status === "cancelled" && hist(o, (h) => h.status === "cancelled" && h.by === "customer"))],
  ["cancelled by us, with his reason", (f) => has(f, (o) => o.status === "cancelled" && hist(o, (h) => h.status === "cancelled" && h.by === "desk" && h.note))],
  ["not taken, with his reason", (f) => has(f, (o) => o.status === "declined" && hist(o, (h) => h.status === "declined" && h.note))],
  ["closed at what was handed over", (f) => has(f, (o) => o.closed && o.closed.qty > o.qty)],
  ["a price set at the acknowledgement, what they placed it at beside it (Step 2)", (f) => has(f, (o) => typeof o.asked === "number" && Math.abs(o.asked - o.total) > 0.004)],
  ["a delivery fee, set by distance at the acknowledgement (F15)", (f) => has(f, (o) => +o.delivery > 0 && hist(o, (h) => h.status === "acknowledged"))],
  ["ready again for the rest after a part (Step 1b)", (f) => has(f, (o) => o.status === "ready" && +o.moved > 0 && o.moved < o.qty
    && (o.history || []).filter((h) => h.status === "ready" && h.by === "desk" && !h.note && !h.method).length > 1)],
  ["a slip sent with a claim (F13)", (f) => has(f, (o) => (o.payments || []).some((p) => p.claim === "waiting" && p.slip && Date.parse(f.at) - Date.parse(p.at) < 30 * 864e5))],
  ["a slip no longer kept, past its thirty days (F13)", (f) => has(f, (o) => (o.payments || []).some((p) => p.claim === "waiting" && p.slip && Date.parse(f.at) - Date.parse(p.at) >= 30 * 864e5))],
  ["the stages (V5): a part overdue past the lock day, every stage lifted by the claim waiting", (f) => {
    const P = f.live && f.live.pay, day = f.at.slice(0, 10);
    return !!P && P.lock != null && P.hide != null && f.claims.some((c) => c.state === "waiting")
      && P.overdue.parts.some((p) => p.since && Date.parse(day) - Date.parse(p.since) >= P.lock * 864e5); }],
  /* held and prices hidden are no test account's (his answer of 29 Sep 2026: an open one and a locked one); the suite
     keeps them */
  ["locked, only for paying (V5)", (f) => stageOf(f) === 3],
  ["a rating given (F10)", (f) => has(f, (o) => o.rating && o.rating.stars >= 1)],
  ["asked how an order was (F10)", (f) => has(f, (o) => rateDue(o, new Date(f.at)))],
  ["on credit: goods with them inside the term", (f) => f.live && f.live.pay.now.parts.some((p) => !p.late)],
  ["overdue past its term", (f) => f.live && f.live.pay.overdue.parts.length > 0],
  ["coming up: agreed and not handed over", (f) => f.live && f.live.pay.coming.parts.length > 0],
  ["due at Ready", (f) => has(f, (o) => o.status === "ready" && +o.total + (+o.delivery || 0) - (+o.paid || 0) > 0.004)],
  ["paid in advance over the cap (V3)", (f) => has(f, (o) => o.prepay === true) && Object.keys(f.caps || {}).length > 0],
  ["a claim on an order waiting on him", (f) => has(f, (o) => (o.payments || []).some((p) => p.claim === "waiting"))],
  ["a claim against the account waiting on him", (f) => f.claims.some((c) => c.state === "waiting")],
  ["cash he took", (f) => has(f, (o) => (o.payments || []).some((p) => p.method === "cod" && p.by === "desk"))],
  ["a transfer he received", (f) => has(f, (o) => (o.payments || []).some((p) => p.method === "transfer" && p.claim === "received"))],
  ["a sheet agreed together, the charge on its first order alone (V4b.2)", (f) => { const s = {}; f.orders.forEach((o) => { if (o.sheet && o.status !== "placed") (s[o.sheet] = s[o.sheet] || []).push(o); });
    return Object.values(s).some((l) => l.length > 1 && l.filter((o) => +o.delivery > 0).length === 1); }],
  ["one sheet, several products (v936)", (f) => { const s = {}; f.orders.forEach((o) => { if (o.sheet) s[o.sheet] = (s[o.sheet] || 0) + 1; }); return Object.values(s).some((n) => n > 1); }],
  ["a friend's order, for an associate", (f) => f.assoc === true && has(f, (o) => o.forFriend === true)],
  ["a thread, theirs and his", (f) => has(f, (o) => (o.msgs || []).some((m) => m.by === "customer") && (o.msgs || []).some((m) => m.by === "desk"))],
  ["the bulletin", (f) => !!(f.bulletin && f.bulletin.lines && f.bulletin.lines.length)],
  ["guest links: open, waiting, declined, withdrawn", (f) => ["open", "waiting", "declined", "withdrawn"].every((s) => f.refs.some((r) => refState(r) === s))],
  ["an associate's card, with a reward", (f) => !!(f.card && f.card.products.some((p) => p.reward) && f.card.products.some((p) => !p.reward))],
  ["a book priced soon", (f) => !!(f.prices && f.prices.soon && f.prices.soon.length)],
  ["the statement, live", (f) => !!(f.live && f.live.body)]
];
/* THE STAGE THE PAGE DRAWS (stmt/page.js stageNow): nothing while a claim of theirs waits or nothing is overdue, else by
   the days since the oldest overdue handover, against the sealed hide and lock days */
export function stageOf(f) {
  const P = f.live && f.live.pay;
  if (!P || !(P.overdue.rm > 0.004)) return 0;
  const waiting = f.claims.some((c) => c.state === "waiting")
    || f.orders.some((o) => !["cancelled", "declined"].includes(o.status) && (o.payments || []).some((p) => p.claim === "waiting"));
  if (waiting) return 0;
  const day = new Date(f.at).toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });
  const d = Math.max(...P.overdue.parts.map((p) => Math.round((Date.parse(day) - Date.parse(p.since || p.date)) / 864e5)));
  return P.lock != null && d >= P.lock ? 3 : P.hide != null && d >= P.hide ? 2 : 1;
}
/** Both test accounts' fixtures, built at one moment, by username. */
export const buildAll = (now = new Date()) => Object.fromEntries(TEST_USERS.map((t) => [t, build(now, TESTS[t], t)]));
/** What the fixtures lack: each line no account has a case of, and each state, way, rail or claim answer none holds. */
export function missing(all) {
  const fs = Object.values(all);
  const lines = FEATURES.filter(([, t]) => !fs.some((f) => t(f))).map(([n]) => n);
  const names = [...new Set(fs.flatMap((f) => derivedCases(f).map((c) => c[0])))];
  return lines.concat(names.filter((n) => !fs.some((f) => derivedCases(f).some((c) => c[0] === n && c[1]))));
}
export const refState = (r) => (r.revoked ? "withdrawn" : r.declined === true ? "declined" : r.approved === false ? "waiting" : "open");

/** The cases the code itself names, each with whether the fixture holds one: a state, a way, a rail, a claim answer. */
export function derivedCases(f) {
  const statuses = [...new Set(OPEN_STATES.concat(ROWED, ["cancelled", "declined"]))];
  const pays = f.orders.flatMap((o) => o.payments || []).concat(f.claims.map((c) => ({ method: c.method, claim: c.state })));
  return [].concat(
    statuses.map((s) => ["state " + s, has(f, (o) => o.status === s)]),
    MODES.map((m) => ["way " + m, has(f, (o) => o.mode === m)]),
    offeredMethods().map((m) => ["rail " + m, pays.some((p) => p.method === m)]),
    ["waiting"].concat(VERDICTS).map((v) => ["claim " + v, pays.some((p) => p.claim === v)]));
}

/* ---- SEALED FOR THE TEST ACCOUNT ALONE -------------------------------------------------------------------------
   The test account's content key is wrapped under its password, the zeros, which are no secret: so the publish opens
   it here and seals the three documents under it, and the page opens them exactly as it opens a real account's. The
   orders, claims and links are the site's plaintext kind, as a real account's are. `salt` ties the fixture to the
   test account it was sealed for: the Worker lays it over that account only (stmt/testfix.js), so one sealed for an
   account since unmade and made again is never served. */
export async function sealFixture(fix, rec, pass) {
  const ck = await unwrapKey(pass, rec.wrap);
  const seal = async (obj) => encryptWith(ck, JSON.stringify(obj));
  /* the statement bundle of an account minted today: no sealed issue, the live document is the statement */
  return { v: fix.v, u: fix.u, at: fix.at, salt: rec.wrap.salt, assoc: true,
    live: fix.live ? Object.assign({ at: fix.live.at }, await seal(fix.live)) : null, orders: fix.orders.map(customerView), claims: fix.claims,
    env: await seal({ v: 1, issued: fix.at.slice(0, 10), statements: [] }),
    prices: Object.assign({ at: fix.prices.at, week: fix.prices.week.monday, digest: fix.prices.digest, caps: fix.caps }, await seal(fix.prices)),
    card: Object.assign({ at: fix.card.at }, await seal(fix.card)), refs: fix.refs, bulletin: fix.bulletin };
}
