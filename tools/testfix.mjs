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
import { decidePlace, decideDesk, decideCustomer, decideAccountClaim, decideThread, applyEvent, MODES, METHODS, VERDICTS, OPEN_STATES,
  ROWED, customerView, rateDue } from "../stmt/orders.js";
import { PAY_ACCOUNTS } from "../stmt/pay.js";
import { TEST_USER, FIX_VERSION, TESTS, TEST_USERS } from "../stmt/testfix.js";
import { unwrapKey, encryptWith } from "./stmt-crypto.mjs";
import { liveFor, holdTerm, stageDays, ceilingRM } from "./make_statements.mjs";
import { priceSteps } from "./pricelist.mjs";
import { slotNext } from "../stmt/window.js";

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

/* THE PRICE LIST, invented, one book not yet priced, and the master's ceiling sealed in it outside the stamp (V5b2b) */
function priceList(now) {
  const monday = klDay(new Date(now.getTime() - ((new Date(now).getUTCDay() + 6) % 7) * 864e5));
  const list = { at: now.toISOString(), week: { monday, sunday: monday, label: "this week" }, since: klDay(new Date(now.getTime() - 60 * 864e5)),
    products: [
      { product: "salt", name: "Salt", unit: "unit", basis: "card", tier: null, levels: null, supply: { light: "yellow", by: klDay(new Date(now.getTime() + 9 * 864e5)) },
        sizes: [{ q: 1, price: 110 }, { q: 2.5, price: 270 }, { q: 5, price: 530 }, { q: 12.5, price: 1300 }], grid: exampleGrid() },
      { product: "oil", name: "Oil", unit: "unit", basis: "board", tier: null, levels: null, supply: { light: "red", by: null }, sizes: [{ q: 1, price: 40 }, { q: 3, price: 115 }] },
      { product: "candy", name: "Candy", unit: "unit", basis: "board", tier: null, levels: null, supply: { light: "green", by: null }, sizes: [{ q: 1, price: 12 }, { q: 4, price: 45 }] },
      { product: "rice", name: "Rice", unit: "unit", basis: "board", tier: null, levels: null, sizes: [{ q: 1, price: 9 }, { q: 2, price: 17 }] }
    ],
    soon: [{ product: "spare", name: "Spare" }] };
  list.digest = createHash("sha256").update("testfix\n" + JSON.stringify(list.products.map((p) => [p.product, p.sizes, p.grid || null]))).digest("hex");
  const ceiling = ceilingRM();
  if (ceiling != null) list.ceiling = ceiling;
  return list;
}
/* 05 Oct 2026: ANY AMOUNT, an invented grid for salt from 0.5 to 25 in quarters, the rate never rising, the board's sizes on it */
function exampleGrid() {
  const p = [];
  for (let i = 0; i <= 98; i++) {
    const q = 0.5 + i * 0.25, rate = q <= 1 ? 110 : q <= 2.5 ? 108 : q <= 5 ? 106 : q <= 12.5 ? 104 : 102;
    p.push(+(q * rate).toFixed(2));
  }
  return { min: 0.5, step: 0.25, max: 25, p };
}
const priceOf = (list, product, q) => {
  const P = list.products.find((x) => x.product === product), g = P.grid, i = g ? Math.round((q - g.min) / g.step) : -1;
  if (g && i >= 0 && i < g.p.length && Math.abs(g.min + i * g.step - q) < 1e-6) return g.p[i];
  const s = P.sizes.find((x) => x.q === q);
  return s ? s.price : 0;   /* past the grid: a price asked, placed at nothing */
};

/* one order, taken through the order book's own moves: each step is [moment, who, body] */
function order(id, list, placedAt, place, steps, hours) {
  const body = Object.assign({ unit: 0, week: list.week.monday, digest: list.digest }, place);
  body.total = priceOf(list, body.product, body.qty); body.unit = +(body.total / body.qty).toFixed(2);
  const p = decidePlace(U, body, [], placedAt, list.digest, "customer", null, { steps: priceSteps(list), hours: hours || null });
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
  /* A SHEET OF TWO, placed, salt and rice beside it (v936) */
  const sheet = "exampleSheet0001";
  /* and wanted by a day five days on (29 Sep 2026), which a sheet's lines share */
  const wantBy = klDay(new Date(now.getTime() + 5 * 864e5));
  O.push(order(oid(0, "01"), list, T(0, 5), { product: "salt", qty: 12.5, mode: "deliver", place: "Jalan Contoh", sheet, wantBy,
    note: "Please ring when you are outside." }, []));
  O.push(order(oid(0, "02"), list, T(0, 5), { product: "rice", qty: 2, mode: "deliver", place: "Jalan Contoh", sheet, wantBy }, []));
  const replaced = order(oid(1, "24"), list, T(1), { product: "rice", qty: 1, mode: "collect" },
    [[T(1, 20), "customer", { action: "cancel" }]]);
  const replacement = order(oid(1, "25"), list, T(1, 20), { product: "rice", qty: 2, mode: "collect" }, []);
  replaced.replacement = replacement.id; replacement.replaces = replaced.id;
  O.push(replaced, replacement);
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
  /* READY AGAIN FOR THE REST (Step 1b): paid in advance, the desk's verdict at Accept (V5b2a), by a transfer, half handed
     over, and the rest ready */
  O.push(order(oid(4, "14"), list, T(4), { product: "salt", qty: 5, mode: "collect" }, [
    [T(4, 20), "desk", { status: "acknowledged", prepay: true }], [T(4, 30), "customer", pay("transfer")],
    [T(4, 35), "customer", Object.assign({ action: "pay", amount: 530 }, rail("transfer"))],
    [T(4, 50), "desk", { verdict: { kind: "received", claim: T(4, 35), amount: 530 } }],
    [T(3, 10), "desk", { status: "ready" }], [T(3, 30), "desk", { handover: { units: 2.5 } }], [T(2, 10), "desk", { status: "ready" }],
    [T(2, 20), "desk", { restate: { qty: 5, total: 540, delivery: 0 } }]]));
  O.push(order(oid(3, "15"), list, T(3), { product: "salt", qty: 2.5, mode: "collect", wantBy: klDay(new Date(Date.parse(T(3)) + 6 * 864e5)) }, [
    [T(3, 20), "desk", { status: "acknowledged" }], [T(0, 40), "desk", { handover: { units: 2.5 } }]]));
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

  /* 10 Oct 2026: A DELIVERY'S TIME AND PLACE. One asked for in a window with their exact spot shared (sealed to his key on their
     phone: the fixture names an invented id and files nothing), one in a window the Counter's hours leave part of, the part said;
     and one asked for as soon as it can that he answered at Accept with a window, which reminds them to pay now */
  const HOURS = { schedule: { days: Array.from({ length: 7 }, () => ({ open: "09:00", close: "18:00" })) } };
  const next = (w) => slotNext(w, null, now.getTime()).slot;
  O.push(order(oid(0, "41"), list, T(0, 4), { product: "candy", qty: 4, mode: "deliver", place: "Taman Rekaan", slot: next(12), pin: "f0a1b2c3d4e5f60718293a4b5c6d7e8f" }, []));
  O.push(order(oid(0, "42"), list, T(0, 4), { product: "oil", qty: 1, mode: "deliver", place: "Taman Rekaan", slot: next(8) }, [], HOURS));
  O.push(order(oid(1, "43"), list, T(1, 4), { product: "candy", qty: 1, mode: "deliver", place: "Taman Rekaan" }, [
    [T(1, 30), "desk", { status: "acknowledged", delivery: 4, slot: next(12), slotSpan: "12:00-16:00" }]]));

  /* A GROUP ORDER (the pool): one open with the account joined (the order it made carries the pool's id, and the units in are the
     account's with invented others, `seedUnits`), and one he closed whose joined order is acknowledged. The order is made by the
     book's own moves, and the pool is a fixture's: a join on it is written there alone (stmt/testfix.js exampleJoin) */
  const pid = (n, k) => "p" + T(n, 0).replace(/[-:.TZ]/g, "").slice(0, 14) + "-ex" + k;
  const poolJoined = order(oid(1, "16"), list, T(1, 40), { product: "salt", qty: 2.5, mode: "collect" }, []);
  poolJoined.pool = pid(1, "1");
  const poolAcked = order(oid(8, "17"), list, T(8), { product: "oil", qty: 3, mode: "collect" }, [[T(7, 30), "desk", { status: "acknowledged" }]]);
  poolAcked.pool = pid(8, "2");
  O.push(poolJoined, poolAcked);
  const pools = [
    { id: pid(1, "1"), kind: "pool", at: T(2), product: "salt", q: 2.5, target: 12.5, state: "open", closesOn: klDay(new Date(now.getTime() + 4 * 864e5)),
      joins: [{ u: U, oid: poolJoined.id, at: poolJoined.at }], seedUnits: 5 },
    { id: pid(8, "2"), kind: "pool", at: T(9), product: "oil", q: 3, target: 9, state: "closed", closedAt: T(7, 40),
      joins: [{ u: U, oid: poolAcked.id, at: poolAcked.at }], seedUnits: 6 }];

  /* 05 Oct 2026: ANY AMOUNT, agreed at 6.75 units off the grid; and NEGOTIATE, a price asked (with a figure of theirs),
     offered and open, taken and agreed at it, declined, and lapsed. The agreed ones are collected and paid, and the declined
     one withdrawn after, so the cases add only the three a negotiation leaves open to the account's open orders */
  O.push(order(oid(2, "31"), list, T(2, 10), { product: "salt", qty: 6.75, mode: "collect" }, [[T(2, 25), "desk", { status: "acknowledged" }],
    [T(2, 30), "desk", { handover: { units: 6.75 } }], [T(2, 31), "desk", { cash: { amount: priceOf(list, "salt", 6.75) } }]]));
  const offerAt = (at, id, total, hours) => [at, "desk", { offer: { id, total, until: new Date(Date.parse(at) + hours * 3600e3).toISOString() } }];
  O.push(order(oid(0, "32"), list, T(0, 3), { product: "salt", qty: 7, mode: "collect", ask: true, propose: 690 }, []));
  O.push(order(oid(1, "33"), list, T(1, 3), { product: "salt", qty: 10, mode: "collect", ask: true }, [offerAt(T(0, 20), "fex33", 1010, 48)]));
  O.push(order(oid(3, "34"), list, T(3, 3), { product: "salt", qty: 8, mode: "collect", ask: true, propose: 800 }, [
    offerAt(T(3, 20), "fex34", 810, 48), [T(3, 40), "customer", { action: "take" }], [T(2, 50), "desk", { status: "acknowledged", total: 810 }],
    [T(2, 55), "desk", { handover: { units: 8 } }], [T(2, 56), "desk", { cash: { amount: 810 } }]]));
  O.push(order(oid(5, "35"), list, T(5, 3), { product: "salt", qty: 9, mode: "collect", ask: true }, [
    offerAt(T(5, 20), "fex35", 920, 48), [T(5, 40), "customer", { action: "pass" }]]));
  /* 06 Oct 2026: No thanks closes the ask; on the grid the order stands at its listed price (above), past it there is none and
     the order is cancelled */
  O.push(order(oid(4, "37"), list, T(4, 3), { product: "salt", qty: 40, mode: "collect", ask: true }, [
    offerAt(T(4, 20), "fex37", 4000, 48), [T(4, 40), "customer", { action: "pass" }]]));
  O.push(order(oid(6, "36"), list, T(6, 3), { product: "salt", qty: 30, mode: "collect", ask: true }, [offerAt(T(6, 20), "fex36", 3000, 48)]));

  /* EACH ORDER ON THE BOOK IS A ROW, dated its placing day, as the desk's reconcile would book it; the key names the
     invented code, and the page reads only its day (rowOn); a wanted-day order moves to its first handover's day */
  const sales = [];
  let rid = 0;
  const row = (r) => { sales.push(Object.assign({ rid: "x" + (++rid), cash: 0, deliveredQty: 0 }, r)); return r; };
  for (const o of O) {
    if (!ROWED.includes(o.status) && !(o.status === "cancelled" && o.history.some((h) => h.status === "acknowledged"))) continue;
    const placed = klDay(new Date(o.at)), day = o.wantBy && +o.moved > 0 && o.movedOn > placed ? o.movedOn : placed, customer = o.forFriend ? FIX_CODE + "-R" : FIX_CODE;
    o.ledgerKey = customer + "|" + day + "|" + o.qty + "|" + o.product;
    row(Object.assign({ date: day, customer, qty: o.qty, total: o.total, product: o.product, cash: +o.paid || 0, deliveredQty: +o.moved || 0 },
      o.delivery ? { delivery: o.delivery } : {}, o.forFriend ? { rev: "R2" } : {},
      o.movedOn ? { deliveredOn: o.movedOn, handover: o.mode === "deliver" ? "delivered" : "collected" } : {},
      +o.paid > 0 ? { paidOn: o.movedOn || day } : {},
      o.status === "cancelled" ? { cancelled: true, cancelledOn: klDay(new Date(o.history[o.history.length - 1].at)) } : {}));
  }
  /* AND TWO ROWS HE ENTERED ON THE DESK: goods with them on credit, inside the term, and goods past it, overdue */
  /* handed over an hour ago, never a day and an hour: just after midnight in Kuala Lumpur that was two days back, past
     the one-day term, and the case was lost for the first hour of every day */
  row({ date: klDay(new Date(T(0))), customer: FIX_CODE, qty: 1, total: 110, product: "salt", deliveredQty: 1, deliveredOn: klDay(new Date(T(0))), handover: "collected" });
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

  /* Step 7: THE ACCOUNT'S THREAD, a question about no one order, and his answer, by the book's own decide and apply */
  let thread = null;
  for (const [at, by, body] of [[T(4), "customer", { text: "Do you deliver on Sundays?" }], [T(4, 20), "desk", { message: "Not on Sundays, any other day." }]])
    thread = applyEvent(thread, decideThread(thread, body, by, at, u).ev).order;

  const book = { sales, customerRefunds: [] };
  return { v: FIX_VERSION, u, state, at: now.toISOString(), code: FIX_CODE, book, live: liveFor(book, FIX_CODE, now, U), prices: list,
    orders: O, claims, refs, card, assoc: true, thread, pools,
    bulletin: { lines: ["An example notice: the counter opens late on Friday."] } };
}

/* ---- WHAT A CUSTOMER SEES, AND THE CASE OF EACH HERE ------------------------------------------------------------
   One line a feature, and the test its case is in the fixture. The suite also derives cases from the code itself
   (every state, way, rail and claim answer), so a new one of those needs no line here to be asked for. */
const has = (f, p) => f.orders.some(p);
/* a window's whole four hours, as its span reads when the hours leave all of it */
const spanWhole = (slot) => { const w = +String(slot).slice(11, 13), p = (n) => String(n).padStart(2, "0"); return p(w) + ":00-" + p(w + 4) + ":00"; };
const hist = (o, p) => (o.history || []).some(p);
export const FEATURES = [
  ["order placed, waiting on him", (f) => has(f, (o) => o.status === "placed")],
  ["order replaced before acknowledgement, both kept in history", (f) => has(f, (o) => o.status === "cancelled"
    && o.replacement && has(f, (n) => n.id === o.replacement && n.replaces === o.id && n.status === "placed"))],
  ["order agreed", (f) => has(f, (o) => o.status === "acknowledged")],
  ["a day they want it by, placed ahead (29 Sep 2026)", (f) => has(f, (o) => o.status === "placed" && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(o.wantBy || "")
    && o.wantBy > klDay(new Date(f.at)))],
  ["a day wanted, handed over early, its row on the handover's day (Step 2, 30 Sep 2026)", (f) => has(f, (o) => /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(o.wantBy || "")
    && +o.moved > 0 && o.movedOn < o.wantBy && String(o.ledgerKey || "").split("|")[1] === o.movedOn && o.movedOn > klDay(new Date(o.at))
    && !!f.live && f.live.pay.now.parts.some((p) => p.date === o.movedOn && Math.abs((+p.whole || 0) - (+o.total + (+o.delivery || 0))) < 0.005))],
  ["a group order open, joined (Pool)", (f) => (f.pools || []).some((p) => p.state === "open" && p.joins.some((j) => has(f, (o) => o.id === j.oid && o.pool === p.id))
    && p.closesOn >= klDay(new Date(f.at)))],
  ["a group order closed, its order acknowledged (Pool)", (f) => (f.pools || []).some((p) => p.state === "closed"
    && p.joins.some((j) => has(f, (o) => o.id === j.oid && o.pool === p.id && ROWED.includes(o.status) && hist(o, (h) => h.status === "acknowledged"))))],
  ["order ready", (f) => has(f, (o) => o.status === "ready")],
  ["order complete, collected", (f) => has(f, (o) => o.status === "done" && o.mode === "collect")],
  ["order complete, delivered", (f) => has(f, (o) => o.status === "done" && o.mode === "deliver")],
  ["withdrawn by them", (f) => has(f, (o) => o.status === "cancelled" && hist(o, (h) => h.status === "cancelled" && h.by === "customer"))],
  ["cancelled by us, with his reason", (f) => has(f, (o) => o.status === "cancelled" && hist(o, (h) => h.status === "cancelled" && h.by === "desk" && h.note))],
  ["not taken, with his reason", (f) => has(f, (o) => o.status === "declined" && hist(o, (h) => h.status === "declined" && h.note))],
  ["closed at what was handed over", (f) => has(f, (o) => o.closed && o.closed.qty > o.qty)],
  ["amended after the acknowledgement, the goods and the delivery restated (06 Oct 2026)", (f) => has(f, (o) => hist(o, (h) => h.by === "desk" && /^amended to /.test(h.note || "")))],
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
  ["what paying late costs, off the sealed term, lock and window (V5c)", (f) => { const P = f.live && f.live.pay;
    return !!P && typeof P.term === "number" && typeof P.lock === "number" && typeof P.window === "number" && P.now.rm > 0.004; }],
  ["coming up: agreed and not handed over", (f) => f.live && f.live.pay.coming.parts.length > 0],
  ["due at Ready", (f) => has(f, (o) => o.status === "ready" && +o.total + (+o.delivery || 0) - (+o.paid || 0) > 0.004)],
  ["paid in advance, the desk's verdict at Accept (V5b2a)", (f) => has(f, (o) => o.prepay === true)],
  ["the ceiling sealed with the list, for the sheet's forecast (V5b2b)", (f) => typeof f.prices.ceiling === "number"],
  ["a claim on an order waiting on him", (f) => has(f, (o) => (o.payments || []).some((p) => p.claim === "waiting"))],
  ["a claim against the account waiting on him", (f) => f.claims.some((c) => c.state === "waiting")],
  ["cash he took", (f) => has(f, (o) => (o.payments || []).some((p) => p.method === "cod" && p.by === "desk"))],
  ["a transfer he received", (f) => has(f, (o) => (o.payments || []).some((p) => p.method === "transfer" && p.claim === "received"))],
  ["a sheet agreed together, the charge on its first order alone (V4b.2)", (f) => { const s = {}; f.orders.forEach((o) => { if (o.sheet && o.status !== "placed") (s[o.sheet] = s[o.sheet] || []).push(o); });
    return Object.values(s).some((l) => l.length > 1 && l.filter((o) => +o.delivery > 0).length === 1); }],
  ["one sheet, several products (v936)", (f) => { const s = {}; f.orders.forEach((o) => { if (o.sheet) s[o.sheet] = (s[o.sheet] || 0) + 1; }); return Object.values(s).some((n) => n > 1); }],
  ["a friend's order, for an associate", (f) => f.assoc === true && has(f, (o) => o.forFriend === true)],
  ["a thread, theirs and his", (f) => has(f, (o) => (o.msgs || []).some((m) => m.by === "customer") && (o.msgs || []).some((m) => m.by === "desk"))],
  ["the account's thread, theirs and his (Step 7)", (f) => !!f.thread && f.thread.msgs.some((m) => m.by === "customer") && f.thread.msgs.some((m) => m.by === "desk")],
  ["the bulletin", (f) => !!(f.bulletin && f.bulletin.lines && f.bulletin.lines.length)],
  ["guest links: open, waiting, declined, withdrawn", (f) => ["open", "waiting", "declined", "withdrawn"].every((s) => f.refs.some((r) => refState(r) === s))],
  ["an associate's card, with a reward", (f) => !!(f.card && f.card.products.some((p) => p.reward) && f.card.products.some((p) => !p.reward))],
  ["the restock light: green, yellow with its day, red (F4)", (f) => { const s = ((f.prices && f.prices.products) || []).map((p) => p.supply).filter(Boolean);
    return ["green", "red"].every((l) => s.some((x) => x.light === l)) && s.some((x) => x.light === "yellow" && /^\d{4}-\d{2}-\d{2}$/.test(x.by || "")); }],
  ["order at 6.75 units, any amount off the grid (05 Oct 2026)", (f) => has(f, (o) => Math.abs(+o.qty - 6.75) < 1e-9 && !o.price && o.status !== "placed" && o.total > 0)
    && f.prices.products.some((p) => p.grid && p.grid.step > 0 && p.grid.p.length > 1)],
  ["price asked (Negotiate)", (f) => has(f, (o) => o.status === "placed" && o.price && o.price.state === "asked")],
  ["price offered, open", (f) => has(f, (o) => o.status === "placed" && o.price && o.price.state === "offered" && String(o.price.offer.until) > f.at)],
  ["offer accepted, agreed at it", (f) => has(f, (o) => o.price && o.price.state === "taken" && ["acknowledged", "ready", "done"].includes(o.status) && Math.abs(o.total - o.price.offer.total) < 0.005)],
  ["offer declined, the order back at its listed price", (f) => has(f, (o) => o.price && o.price.state === "passed" && o.status === "placed" && o.total > 0)],
  ["offer declined past the grid, the order cancelled", (f) => has(f, (o) => o.price && o.price.state === "passed" && o.status === "cancelled")],
  ["offer lapsed", (f) => has(f, (o) => o.status === "placed" && o.price && o.price.state === "offered" && String(o.price.offer.until) < f.at)],
  ["a delivery's time window, asked for (10 Oct 2026)", (f) => has(f, (o) => o.status === "placed" && o.mode === "deliver"
    && /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}$/.test(o.slot || "") && /^[0-9]{2}:[0-9]{2}-[0-9]{2}:[0-9]{2}$/.test(o.slotSpan || "") && o.slot > klDay(new Date(f.at)))],
  ["a window the hours leave part of, the part said (10 Oct 2026)", (f) => has(f, (o) => o.slot && o.slotSpan && o.slotSpan !== spanWhole(o.slot))],
  ["their exact spot shared, sealed (10 Oct 2026)", (f) => has(f, (o) => o.status === "placed" && o.mode === "deliver" && /^[0-9a-f]{32}$/.test(o.pin || ""))],
  ["his window at Accept, and the pay-now reminder (10 Oct 2026)", (f) => has(f, (o) => o.status === "acknowledged" && o.mode === "deliver" && !!o.slot
    && !(+o.moved > 0) && +o.total + (+o.delivery || 0) - (+o.paid || 0) > 0.004)],
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
    prices: Object.assign({ at: fix.prices.at, week: fix.prices.week.monday, digest: fix.prices.digest },
      Object.keys(priceSteps(fix.prices)).length ? { steps: priceSteps(fix.prices) } : {}, await seal(fix.prices)),
    card: Object.assign({ at: fix.card.at }, await seal(fix.card)), refs: fix.refs, bulletin: fix.bulletin, thread: fix.thread, pools: fix.pools,
    makerBook: fix.book, makerOrders: fix.orders };
}
