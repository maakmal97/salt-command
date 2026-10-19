/* tools/testfix.mjs: WHAT HIS TEST ACCOUNTS SHOW (29 Sep 2026, his instruction that they show every feature).
 *
 * The test account (0000-0000, stmt/testfix.js) is his to try the Counter with, and counts nowhere. It showed a
 * one-line statement and whatever he ordered on it, so most of what a customer sees could not be tried without a
 * real customer's account. This builds, for the moment it is given, an invented account holding a case of every
 * feature a customer sees, and the publish seals it for the test account alone (sealFixture). The Worker lays it
 * over the test account's own record and orders and nothing else (stmt/testfix.js), so no count reads it. There are
 * three: 0000-0000 open, a claim of theirs waiting, and 0000-0001 locked (his answer of 29 Sep 2026); and 0000-0002 fresh,
 * with room to order (the test surface, his answers of 18 Oct 2026), built by fresh() below from the same case builders.
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
  ROWED, customerView, rateDue, MAX_OPEN, openCount } from "../stmt/orders.js";
import { PAY_ACCOUNTS } from "../stmt/pay.js";
import { TEST_USER, FIX_VERSION, TESTS, TEST_USERS, EXAMPLE_POINTS } from "../stmt/testfix.js";
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
      { product: "salt", name: "Salt", unit: "unit", basis: "card", supply: { light: "yellow", by: klDay(new Date(now.getTime() + 9 * 864e5)) },
        sizes: [{ q: 1, price: 110 }, { q: 2.5, price: 270 }, { q: 5, price: 530 }, { q: 12.5, price: 1300 }], grid: exampleGrid() },
      { product: "oil", name: "Oil", unit: "unit", basis: "board", supply: { light: "red", by: null }, sizes: [{ q: 1, price: 40 }, { q: 3, price: 115 }] },
      { product: "candy", name: "Candy", unit: "unit", basis: "board", supply: { light: "green", by: null }, sizes: [{ q: 1, price: 12 }, { q: 4, price: 45 }] },
      { product: "rice", name: "Rice", unit: "unit", basis: "board", sizes: [{ q: 1, price: 9 }, { q: 2, price: 17 }] }
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

/* Counter Batch A: Ready to collect names one of the test accounts' invented points, its place beside it as the Counter resolves it */
const AT = (code) => { const p = EXAMPLE_POINTS.find((x) => x.code === code); return { point: code, pointAt: { lat: p.lat, lng: p.lng } }; };
const READY_AT = (code = "Z9") => Object.assign({ status: "ready" }, AT(code));
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

/* THE FRESH ACCOUNT, 0000-0002 (the test surface, his answers of 18 Oct 2026): room to order. One order placed and one ready, so two
   are open and three more fit under the limit of five; three handed over in full, one of them at a size since taken off the list
   (Order again must say so); one withdrawn by them and one declined, which Order again skips; a group order open to join, joined by
   nobody here; no claim waiting and nothing owed past its term, so no gate stands. The same order() and moves as the other two. */
function fresh(now, u) {
  const list = priceList(now), T = (n, m) => ago(now, n, m);
  const oid = (n, k) => T(n, 0).replace(/[-:.TZ]/g, "").slice(0, 14) + "-ex" + k;
  const rail = railFor(offeredMethods().find((m) => m !== "cod"));
  /* the list as it stood: oil at two units as well, a size the list no longer carries */
  const was = Object.assign({}, list, { products: list.products.map((p) => p.product === "oil" ? Object.assign({}, p, { sizes: p.sizes.concat([{ q: 2, price: 78 }]) }) : p) });
  const O = [
    order(oid(0, "f1"), list, T(0, 10), { product: "salt", qty: 2.5, mode: "collect" }, []),
    order(oid(1, "f2"), list, T(1, 10), { product: "candy", qty: 4, mode: "collect" }, [[T(1, 30), "desk", { status: "acknowledged" }], [T(0, 30), "desk", READY_AT()]]),
    order(oid(6, "f3"), list, T(6), { product: "salt", qty: 1, mode: "collect" }, [[T(6, 20), "desk", { status: "acknowledged" }], [T(5), "desk", READY_AT()],
      [T(5, 30), "desk", { handover: { units: 1 } }], [T(5, 31), "desk", { cash: { amount: 110 } }]]),
    order(oid(9, "f4"), list, T(9), { product: "rice", qty: 2, mode: "deliver", place: "Taman Rekaan" }, [[T(9, 20), "desk", { status: "acknowledged", delivery: 3 }],
      [T(8), "desk", { status: "ready" }], [T(8, 30), "desk", { handover: { units: 2, mode: "deliver" } }], [T(8, 31), "desk", { cash: { amount: 20 } }]]),
    order(oid(12, "f5"), was, T(12), { product: "oil", qty: 2, mode: "collect" }, [[T(12, 20), "desk", { status: "acknowledged" }], [T(11), "desk", READY_AT()],
      [T(11, 30), "desk", { handover: { units: 2 } }], [T(11, 40), "customer", Object.assign({ action: "method" }, rail)],
      [T(11, 45), "customer", Object.assign({ action: "pay", amount: 78 }, rail)], [T(11, 50), "desk", { verdict: { kind: "received", claim: T(11, 45), amount: 78 } }]]),
    order(oid(3, "f6"), list, T(3), { product: "rice", qty: 1, mode: "collect" }, [[T(3, 20), "customer", { action: "cancel" }]]),
    order(oid(4, "f7"), list, T(4), { product: "oil", qty: 1, mode: "collect" }, [[T(4, 30), "desk", { status: "declined", note: "None of this size this week." }]])];
  const sales = [];
  for (const o of O) {
    if (!ROWED.includes(o.status)) continue;
    const day = klDay(new Date(o.at));
    o.ledgerKey = FIX_CODE + "|" + day + "|" + o.qty + "|" + o.product;
    sales.push(Object.assign({ rid: "x" + (sales.length + 1), date: day, customer: FIX_CODE, qty: o.qty, total: o.total, product: o.product,
      cash: +o.paid || 0, deliveredQty: +o.moved || 0 }, o.delivery ? { delivery: o.delivery } : {},
      o.movedOn ? { deliveredOn: o.movedOn, handover: o.mode === "deliver" ? "delivered" : "collected" } : {}, +o.paid > 0 ? { paidOn: o.movedOn || day } : {}));
  }
  const pools = [{ id: "p" + T(1, 0).replace(/[-:.TZ]/g, "").slice(0, 14) + "-exf1", kind: "pool", at: T(1), product: "salt", q: 2.5, target: 12.5, state: "open",
    closesOn: klDay(new Date(now.getTime() + 4 * 864e5)), joins: [], seedUnits: 5 }];
  const card = { at: now.toISOString(), products: [{ product: "salt", name: "Salt", unit: "unit", summary: { bought: 110, soldFor: 0, onward: 0, introduced: 0, referred: 0 },
    reward: { earned: 0, taken: 0, left: 0, next: 0.9, held: false }, lines: [{ date: T(6).slice(0, 10), kind: "own", qty: 1, rm: 110 }] }] };
  const book = { sales, customerRefunds: [] }, paynum = { maybank: { number: "0".repeat(13) } };
  return { v: FIX_VERSION, u, state: "fresh", at: now.toISOString(), code: FIX_CODE, book, live: liveFor(book, FIX_CODE, now, U), prices: list,
    orders: O, claims: [], refs: [], card, assoc: true, thread: null, pools, bulletin: null, look: "asked", paynum };
}

/** The fixture for the moment `now`, in one state: the invented book, the orders, the claims, the links, the card and the rest. */
export function build(now = new Date(), state = "open", u = TEST_USER) {
  now = new Date(now);
  U = u;
  if (state === "fresh") return fresh(now, u);
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
    [T(1, 10), "desk", READY_AT()]])));
  /* COLLECTED and paid in cash: complete */
  O.push(order(oid(9, "05"), list, T(9), { product: "salt", qty: 1, mode: "collect" }, [
    [T(9, 20), "desk", { status: "acknowledged" }], [T(8), "desk", READY_AT()],
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
    [T(3, 10), "desk", READY_AT()], [T(3, 30), "desk", { handover: { units: 2.5 } }], [T(2, 10), "desk", { status: "ready" }],
    /* PLAN 4 (16 Oct 2026): A HANDOVER RECORDED BY MISTAKE, TAKEN BACK: one unit too many, undone on the book; the order follows by its
       undo fix, the unit off what they hold, and the page says so in a line of its own */
    [T(2, 12), "desk", { handover: { units: 3.5 } }], [T(2, 14), "desk", { fix: { id: "un-ex14-5", undo: true, unmove: 1 } }],
    [T(2, 20), "desk", { restate: { qty: 5, total: 540, delivery: 0 } }]]));
  O.push(order(oid(3, "15"), list, T(3), { product: "salt", qty: 2.5, mode: "collect", wantBy: klDay(new Date(Date.parse(T(3)) + 6 * 864e5)) }, [
    [T(3, 20), "desk", { status: "acknowledged" }], [T(0, 40), "desk", { handover: { units: 2.5 } }]]));
  /* COUNTER BATCH A: READY TO COLLECT AT ONE POINT, THEN MOVED TO ANOTHER (Change point), nothing yet handed over */
  O.push(order(oid(2, "26"), list, T(2, 5), { product: "oil", qty: 1, mode: "collect" }, [
    [T(2, 25), "desk", { status: "acknowledged" }], [T(1, 30), "desk", READY_AT("Z8")], [T(1, 40), "desk", AT("Z9")]]));
  /* WITHDRAWN by them */
  O.push(order(oid(14, "07"), list, T(14), { product: "rice", qty: 1, mode: "collect" }, [
    [T(14, 40), "customer", { action: "cancel" }]]));
  /* DECLINED by us, with his reason */
  O.push(order(oid(16, "08"), list, T(16), { product: "oil", qty: 1, mode: "collect" }, [
    [T(16, 30), "desk", { status: "declined", note: "None of this size this week." }]]));
  /* CANCELLED by us after agreeing it, with his reason */
  O.push(order(oid(18, "09"), list, T(18), { product: "salt", qty: 1, mode: "deliver", place: "Taman Rekaan" }, [
    [T(18, 20), "desk", { status: "acknowledged", delivery: 5 }],
    [T(17), "desk", { status: "cancelled", note: "The road was shut that day." }]]));
  /* CLOSED at what was handed over: 2.5 of 5, then paid by JomPAY, which he confirmed */
  O.push(order(oid(21, "10"), list, T(21), { product: "salt", qty: 5, mode: "collect" }, [
    [T(21, 20), "desk", { status: "acknowledged" }], [T(20), "desk", READY_AT()],
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
  /* VERSION 2 (10 Oct 2026): HIS ACCEPT FOR THEIR YES. A raise waiting on them, another window waiting on them, and an offer
     that lapsed, the order then agreed at their own terms */
  const yesAt = (at, id, x) => [at, "desk", { offer: Object.assign({ id, kind: "accept", delivery: 4, slot: null,
    until: new Date(Date.parse(at) + 48 * 3600e3).toISOString() }, x) }];
  O.push(order(oid(1, "44"), list, T(1, 4), { product: "salt", qty: 2, mode: "deliver", place: "Taman Rekaan" },
    [yesAt(T(0, 20), "fex44", { total: priceOf(list, "salt", 2) + 20 })]));
  O.push(order(oid(1, "45"), list, T(1, 5), { product: "oil", qty: 1, mode: "deliver", place: "Taman Rekaan", slot: next(8) },
    [yesAt(T(0, 21), "fex45", { total: priceOf(list, "oil", 1), slot: next(16), slotSpan: "16:00-20:00" })]));
  O.push(order(oid(4, "46"), list, T(4, 3), { product: "candy", qty: 1, mode: "deliver", place: "Taman Rekaan" }, [
    yesAt(T(4, 20), "fex46", { total: priceOf(list, "candy", 1) + 10 }), [T(1, 30), "desk", { status: "acknowledged", delivery: 4 }]]));

  /* 11 Oct 2026 (Phase 7d part 1): PAID BEFORE ANYTHING MOVED, a transfer he received on an order agreed and not yet handed over, so
     Cancel this order asks in its Sheet and the Sheet names the refund */
  O.push(order(oid(1, "47"), list, T(1, 30), { product: "candy", qty: 1, mode: "collect" }, [
    [T(1, 40), "desk", { status: "acknowledged" }], [T(1, 45), "customer", pay("transfer")],
    [T(1, 50), "customer", Object.assign({ action: "pay", amount: 12 }, rail("transfer"))],
    [T(1, 55), "desk", { verdict: { kind: "received", claim: T(1, 50), amount: 12 } }]]));

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
    bulletin: { lines: ["An example notice: the counter opens late on Friday.", "A second example line: it turns to this one after six seconds."] },
    /* 11 Oct 2026: THE LOOK. A device is asked Night or Tide once, then never; a test account says "asked" in its sealed bundle, so
       the page asks at every sign-in whatever the device holds and the Sheet can be tried again. The setting under Account is the same. */
    look: "asked",
    /* Phase 7b (11 Oct 2026): THE ACCOUNT NUMBER THE PAY SHEET SHOWS beside the reference, INVENTED: all zeros, one bank. A test account
       is answered this through the Worker's overlay and never reads the real record (KV paynum, written from the laptop). */
    paynum: { maybank: { number: "0".repeat(13) } } };
}

/* ---- WHAT A CUSTOMER SEES, AND THE CASE OF EACH HERE ------------------------------------------------------------
   One line a feature, and the test its case is in the fixture. The suite also derives cases from the code itself
   (every state, way, rail and claim answer), so a new one of those needs no line here to be asked for. */
const has = (f, p) => f.orders.some(p);
const onGrid = (g, q) => !!g && Math.abs((q - g.min) / g.step - Math.round((q - g.min) / g.step)) < 1e-6 && q >= g.min - 1e-9 && q <= g.max + 1e-9;
/* a window's whole four hours, as its span reads when the hours leave all of it */
const spanWhole = (slot) => { const w = +String(slot).slice(11, 13), p = (n) => String(n).padStart(2, "0"); return p(w) + ":00-" + p(w + 4) + ":00"; };
const hist = (o, p) => (o.history || []).some(p);
/* the lines the page draws under To pay now (stmt/page.js nowOf): each part the publish sealed, and each order at Ready still owing
   that no part accounts for (its part is the one on its row's day, of its whole figure and the friend's bucket or not) */
const invoiceLines = (f) => {
  const parts = f.live.pay.now.parts, rowOn = (o) => String(o.ledgerKey || "").split("|")[1], owing = (o) => +o.total + (+o.delivery || 0) - (+o.paid || 0);
  return parts.length + f.orders.filter((o) => o.status === "ready" && owing(o) > 0.004
    && !parts.some((p) => p.date === rowOn(o) && Math.abs((+p.whole || 0) - (+o.total + (+o.delivery || 0))) < 0.005 && !!p.resale === !!o.forFriend)).length;
};
/* his Accept for their yes, open at the fixture's moment */
const accYes = (o, f) => !!(o.price && o.price.from === "accept" && o.price.state === "offered" && String(o.price.offer.until) > f.at);
export const FEATURES = [
  ["order placed, waiting on him", (f) => has(f, (o) => o.status === "placed")],
  ["order replaced before it was confirmed, both kept in history", (f) => has(f, (o) => o.status === "cancelled"
    && o.replacement && has(f, (n) => n.id === o.replacement && n.replaces === o.id && n.status === "placed"))],
  ["order confirmed", (f) => has(f, (o) => o.status === "acknowledged")],
  ["a day they want it by, placed ahead (29 Sep 2026)", (f) => has(f, (o) => o.status === "placed" && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(o.wantBy || "")
    && o.wantBy > klDay(new Date(f.at)))],
  ["a day wanted, handed over early, its row on the handover's day (Step 2, 30 Sep 2026)", (f) => has(f, (o) => /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(o.wantBy || "")
    && +o.moved > 0 && o.movedOn < o.wantBy && String(o.ledgerKey || "").split("|")[1] === o.movedOn && o.movedOn > klDay(new Date(o.at))
    && !!f.live && f.live.pay.now.parts.some((p) => p.date === o.movedOn && Math.abs((+p.whole || 0) - (+o.total + (+o.delivery || 0))) < 0.005))],
  ["a group order open, joined (Pool)", (f) => (f.pools || []).some((p) => p.state === "open" && p.joins.some((j) => has(f, (o) => o.id === j.oid && o.pool === p.id))
    && p.closesOn >= klDay(new Date(f.at)))],
  ["a group order closed, its order confirmed (Pool)", (f) => (f.pools || []).some((p) => p.state === "closed"
    && p.joins.some((j) => has(f, (o) => o.id === j.oid && o.pool === p.id && ROWED.includes(o.status) && hist(o, (h) => h.status === "acknowledged"))))],
  ["order ready", (f) => has(f, (o) => o.status === "ready")],
  ["ready at a collection point (Counter Batch A)", (f) => has(f, (o) => o.status === "ready" && o.mode === "collect" && /^[A-Z][0-9]{1,2}$/.test(o.point || "")
    && !!o.pointAt && Number.isFinite(o.pointAt.lat) && +o.qty - (+o.moved || 0) > 0.004)],
  ["collection point changed (Counter Batch A)", (f) => has(f, (o) => o.status === "ready" && (o.history || []).filter((h) => h && h.point).length > 1
    && (o.history || []).some((h) => h && h.point && h.point !== o.point))],
  ["order complete, collected", (f) => has(f, (o) => o.status === "done" && o.mode === "collect")],
  ["order complete, delivered", (f) => has(f, (o) => o.status === "done" && o.mode === "deliver")],
  ["withdrawn by them", (f) => has(f, (o) => o.status === "cancelled" && hist(o, (h) => h.status === "cancelled" && h.by === "customer"))],
  ["cancelled by us, with his reason", (f) => has(f, (o) => o.status === "cancelled" && hist(o, (h) => h.status === "cancelled" && h.by === "desk" && h.note))],
  ["declined, with his reason", (f) => has(f, (o) => o.status === "declined" && hist(o, (h) => h.status === "declined" && h.note))],
  ["closed at what was handed over", (f) => has(f, (o) => o.closed && o.closed.qty > o.qty)],
  ["amended after it was confirmed, the goods and the delivery restated (06 Oct 2026)", (f) => has(f, (o) => hist(o, (h) => h.by === "desk" && /^amended to /.test(h.note || "")))],
  ["a handover recorded by mistake, taken back (plan 4, 16 Oct 2026)", (f) => has(f, (o) => hist(o, (h) => h.by === "desk" && /^[0-9.]+ unit taken back$/.test(h.note || "")))],
  ["a price set when it was confirmed, what they placed it at beside it (Step 2)", (f) => has(f, (o) => typeof o.asked === "number" && Math.abs(o.asked - o.total) > 0.004)],
  ["a delivery fee, set by distance when it was confirmed (F15)", (f) => has(f, (o) => +o.delivery > 0 && hist(o, (h) => h.status === "acknowledged"))],
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
  ["To pay now over more than three lines, Home showing three and the rest under N more (Phase 7a, 11 Oct 2026)", (f) => !!f.live && invoiceLines(f) > 3],
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
  ["the notice over two lines, one at a time with Pause, in the Today card (Counter Batch A)", (f) => !!(f.bulletin && f.bulletin.lines && f.bulletin.lines.length > 1)],
  ["their latest open order on Home, a pill on a phone and a banner from 1080px (Counter Batch A)", (f) => has(f, (o) => !["done", "declined", "cancelled"].includes(o.status))],
  ["Collect and Deliver tiles on Home, each opening the sheet with its way (Counter Batch B)", (f) => f.prices.products.some((p) => p.sizes && p.sizes.length) && stageOf(f) === 0],
  ["Order again on an order handed over in full, its size still on the list (Counter Batch B)", (f) => has(f, (o) => +o.moved > 0 && +o.moved >= +o.qty - 0.0004
    && !["cancelled", "declined"].includes(o.status) && !o.pool && f.prices.products.some((p) => p.product === o.product && (p.sizes.some((z) => z.q === o.qty) || onGrid(p.grid, o.qty))))],
  ["a basket of two marks on Prices, under the open-order limit (Counter Batch B)", (f) => f.prices.products.filter((p) => p.sizes && p.sizes.length).length > 1 && stageOf(f) === 0
    && new Set(f.orders.filter((o) => OPEN_STATES.includes(o.status)).map((o) => o.sheet || o.id)).size < 5],
  ["the way on Prices, the newest order's, a delivery with its place (Counter Batch B)", (f) => { const n = f.orders.slice().sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];
    return !!n && n.mode === "deliver" && !!String(n.place || "").trim(); }],
  ["This year on Home, off the live statement's lines this year (Counter Batch A)", (f) => !!(f.live && new RegExp('salt-lines__row[^"]*" role="row" data-m="' + new Date(Date.parse(f.at) + 8 * 3600e3).toISOString().slice(0, 4)).test(f.live.body || ""))],
  ["guest links: open, waiting, declined, withdrawn", (f) => ["open", "waiting", "declined", "withdrawn"].every((s) => f.refs.some((r) => refState(r) === s))],
  ["an associate's card, with a reward", (f) => !!(f.card && f.card.products.some((p) => p.reward) && f.card.products.some((p) => !p.reward))],
  ["the nearest reward on Home, its meter to the next unit (Counter Batch A)", (f) => !!(f.card && f.card.products.some((p) => p.reward && p.reward.next != null))],
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
  ["a raise waiting on their yes (10 Oct 2026)", (f) => has(f, (o) => o.status === "placed" && accYes(o, f) && o.price.offer.total > o.total + 0.004)],
  ["another window waiting on their yes (10 Oct 2026)", (f) => has(f, (o) => o.status === "placed" && accYes(o, f) && !!o.slot && !!o.price.offer.slot && o.price.offer.slot !== o.slot)],
  ["an offer for their yes lapsed, then agreed at their terms (10 Oct 2026)", (f) => has(f, (o) => o.status === "acknowledged" && o.price && o.price.from === "accept"
    && o.price.state === "offered" && Math.abs(o.price.offer.total - o.total) > 0.004)],
  ["a fresh account with room to order: two open, three more under the limit (the test surface, 18 Oct 2026)", (f) => f.state === "fresh"
    && openCount(f.orders.filter((o) => OPEN_STATES.includes(o.status))) === 2 && !f.claims.some((c) => c.state === "waiting")
    && f.orders.some((o) => o.status === "done" && !f.prices.products.some((p) => p.product === o.product && (p.sizes.some((s) => s.q === o.qty) || p.grid)))],
  ["orders open at the limit, so New order opens on the limit and each Cancel there asks in a Sheet (Phase 7d, 11 Oct 2026)", (f) => {
    const open = f.orders.filter((o) => OPEN_STATES.includes(o.status));
    return openCount(open) >= MAX_OPEN && open.some((o) => !(+o.moved > 0)); }],
  ["an order paid before anything moved, so Cancel this order asks in its Sheet and names the refund (Phase 7d, 11 Oct 2026)", (f) => has(f, (o) => ["placed", "acknowledged"].includes(o.status)
    && +o.paid > 0.004 && !(+o.moved > 0) && !(o.payments || []).some((p) => p.claim === "waiting"))],
  ["the look: the choice Sheet asked at every sign-in, and the setting under Account (11 Oct 2026)", (f) => f.look === "asked"],
  ["the bank account number beside the reference on the pay sheet (Phase 7b)", (f) => !!f.paynum && Object.values(f.paynum).some((a) => /^0{10,15}$/.test(a && a.number))],
  ["a book priced soon", (f) => !!(f.prices && f.prices.soon && f.prices.soon.length)],
  /* Counter Batch C: drawn on every customer's Account, the test accounts' included, from no data of theirs */
  ["Help under Account, four answers (Counter Batch C)", () => true],
  ["the confirm time on a placed order waiting on his Accept (Counter Batch C)", (f) => has(f, (o) => o.status === "placed" && !o.price)],
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
    env: await seal({ v: 1, issued: fix.at.slice(0, 10), statements: [], look: fix.look }),
    prices: Object.assign({ at: fix.prices.at, week: fix.prices.week.monday, digest: fix.prices.digest },
      Object.keys(priceSteps(fix.prices)).length ? { steps: priceSteps(fix.prices) } : {}, await seal(fix.prices)),
    card: Object.assign({ at: fix.card.at }, await seal(fix.card)), refs: fix.refs, bulletin: fix.bulletin, thread: fix.thread, pools: fix.pools, paynum: fix.paynum,
    makerBook: fix.book, makerOrders: fix.orders };
}
