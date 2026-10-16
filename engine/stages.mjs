/* engine/stages.mjs: THE ENTRY EACH ORDER STAGE MAKES (S1b of the Book plan, 16 Oct 2026). Lifted out of src/orders.js with no behaviour
 * change: the Accept entry (the pending row, at the goods he set for that one order, its key, and the floor no price goes under),
 * the handover with its early redate (and the key given back when it is rejected), cash, Received (the claim's allocation through
 * the engine's claimAlloc), the close, the cancellation, the amendment, and the account claim's rows.
 *
 * PURE. No env, KV, D1, fetch or clock: the order, the book, the drafts the caller read and the moment all come in as arguments,
 * and nothing it is handed is changed. The Worker (src/orders.js) reads, calls these, and queues; what a tap queues is what it
 * queued before. It is NOT in tools/engine.mjs's list, so the master's ENGINE block does not carry it, and nothing under stmt/ may
 * import it. The digest (stageDigest) and the drafter (draftRow) stay in src/drafter.js, which this reads for withPending and floorFor. */
import POSITION_ENGINE from "./position.mjs";
import { withPending, floorFor } from "../src/drafter.js";

/* ---- WORDS AND FIGURES THE STAGES SHARE ------------------------------------------------------------------------------- */
export const rm = (n) => "RM " + (Math.abs(n - Math.round(n)) < 0.005 ? String(Math.round(n)) : n.toFixed(2));
export const chargeOf = (b) => (b && typeof b.delivery === "number" && Number.isFinite(b.delivery) && b.delivery >= 0 ? +b.delivery.toFixed(2) : null);
/* Step 2 (his Q10 of 28 Sep 2026): THE PRICE HE SETS ON THIS ONE ORDER at its acknowledgement, the goods to 2 dp. Absent, the
   order's own total; present and not a figure above nothing, refused. The board, the tiers and the pricing state never move. */
export const priceOf = (b) => {
  if (!b || b.total === undefined || b.total === null) return { price: null };
  const t = b.total;
  if (typeof t !== "number" || !Number.isFinite(t) || !(t > 0) || t > 1000000) return { error: "the price has to be a figure above nothing" };
  return { price: +t.toFixed(2) };
};

/* WHAT THEY OWE AT ONCE WITH THIS ORDER: the book's rows (the engine's partyOwedRM), the owner's agreed site orders whose
   row is not on the book yet, then this order with its delivery. Everything counts until paid. A SHEET IS ONE VERDICT
   (his answer of 29 Sep 2026): its lines, placed or agreed and not yet on the book, count together at their goods, the
   sheet's charge left out, so every line reads the same figure whichever is accepted first. The orders are the list the
   order was found in (findOrder), never a second read. STEP 2: A PRICE HE SETS ON A LINE MOVES THE SHEET'S FIGURE: a line
   agreed at his price counts at it and a line still placed at what it was placed at, so lines he prices differently can
   read different figures, each at the money it is agreed for. Offered again, an order keeps the verdict it was agreed on, as it
   keeps its charge: it has no move left to carry a new one. A book with no TERMS decides nothing. */
export const AGREED_ON_SITE = ["acknowledged", "ready"];
export function lateHistory(book, owner, today, terms) {
  if (!today) return { error: "the day was not read, so paid in advance after lateness cannot be decided: try again in a minute" };
  const E = POSITION_ENGINE, st = E.lateOffer(E.payDelays(book.sales || [], owner, today, terms), terms);
  const need = typeof terms.lateResetRepeat === "number" ? terms.lateResetRepeat : 3;
  return st.late && st.run < need ? { prepay: true, run: st.run, need } : { prepay: false };
}
export function advanceOf(book, o, code, delivery, ctx) {
  if (ctx.again) return { prepay: !!o.prepay, owedWith: null, ceiling: null };
  const terms = (book.state && book.state.TERMS) || {};
  const ceiling = typeof terms.ceiling === "number" && Number.isFinite(terms.ceiling) ? terms.ceiling : null;
  if (ceiling == null) return { prepay: false, owedWith: null, ceiling: null };
  if (!Array.isArray(ctx.orders)) return { error: "the site's orders were not read, so paid in advance cannot be decided: try again in a minute" };
  const E = POSITION_ENGINE, owner = E.ownerCode(code);
  const keys = new Set((book.sales || []).map((s) => E.ovKey(s)));
  const onBook = (k, p) => !!k && (keys.has(k) || keys.has(E.ovRekey(k, p)));
  const onSheet = (x) => !!o.sheet && x.sheet === o.sheet && x.u === o.u;
  const mineToo = ctx.orders.filter((x) => x.id !== o.id && x.code && E.ownsCode(owner, x.code));
  const agreed = mineToo.filter((x) => !onSheet(x) && AGREED_ON_SITE.includes(x.status) && !onBook(x.ledgerKey, x.product))
    .reduce((a, x) => a + Math.max(0, (+x.total || 0) + (+x.delivery || 0) - (+x.paid || 0)), 0);
  const sheet = mineToo.filter((x) => onSheet(x) && (x.status === "placed" || (AGREED_ON_SITE.includes(x.status) && !onBook(x.ledgerKey, x.product))));
  const lines = sheet.reduce((a, x) => a + Math.max(0, (+x.total || 0) - (+x.paid || 0)), 0);
  const mine = (+o.total || 0) + (sheet.length ? 0 : (+delivery || 0));
  const owedWith = +(E.partyOwedRM(book.sales, owner) + agreed + lines + mine).toFixed(2);
  /* V5b2c (his decisions of 29 Sep and 05 Oct 2026): a customer who has EVER paid late pays in advance until three payments
     in a row are on time. It reads the engine's lateOffer, the one state machine, over payDelays on the book's rows: on time is
     within the term, a paid-in-advance order counts once handed over, an amount open past the term is late today. */
  const late = lateHistory(book, owner, ctx.today, terms);
  if (late.error) return late;
  return { prepay: owedWith > ceiling + 0.004 || late.prepay, owedWith, ceiling, late: late.prepay ? late : null };
}
/* 28 Sep 2026, s210: the refusal a tap gives when its payment would take the row past what it can still take. A claim of
   theirs is also told how it is answered: Received, on the book already, which the site takes only once its order has
   heard of the money (the return leg, in the minute after the mirror is re-seeded), or Not found */
export function pastRoom(room, o, entry, word, claim) {
  const r = room ? room(ledgerKeyOf(o), entry) : null, rm = +((entry && entry.payload) || {}).cash || 0;
  if (!r || !(rm > r.left + 0.004)) return null;
  const due = +((+o.total + (+o.delivery || 0)) - (+o.paid || 0)).toFixed(2);
  return { status: 409, error: "the row owes RM " + r.owes.toFixed(2)
    + (r.on > 0.004 ? ", and RM " + r.on.toFixed(2) + " of it is on its way already, received or waiting under Approve and not folded yet" : "")
    + ", so RM " + rm.toFixed(2) + " " + word + " would pay it past what it owes" + (r.left > 0.004 ? ": RM " + r.left.toFixed(2) + " is what it can still take" : "")
    + (claim ? ". " + (r.on > 0.004 ? "Once that is folded, answer" : rm > due + 0.004 ? "Answer" : "Within the minute its order hears of the book: then answer")
      + " it Received, on the book already, if you recorded it, or Not found" : "") };
}
export function claimOrderFlight(sales, orders, u, by = {}, off = new Set()) {
  const cash = {}, ready = [];
  const add = (k, rm) => { rm = +(+rm).toFixed(2); if (k && rm > 0.004) by[k] = +((by[k] || 0) + rm).toFixed(2); };
  const done = new Set(orders.filter((o) => o.u === u && o.status === "done").map((o) => o.id));
  for (const s of sales) { const k = POSITION_ENGINE.ovKey(s); cash[k] = (cash[k] || 0) + (+s.cash || 0); }
  for (const o of orders) {
    if (o.u !== u || !o.ledgerKey || off.has(o.id) || ["cancelled", "declined"].includes(o.status)) continue;
    const lk = ledgerKeyOf(o);   /* V4a: the row's key as the book names it, whether or not the pass has reached the order */
    if (o.status === "ready") ready.push(lk);
    add(lk, done.has(o.id) ? (+o.paid || 0) - (+((o.queued || {}).paid) || 0) : (+o.paid || 0) + (+o.claimed || 0) - (cash[lk] || 0));
  }
  return { by, ready };
}
export function claimRows(book, c, fl) {
  const sales = (book.sales || []).map((s) => { const on = fl && fl.by[POSITION_ENGINE.ovKey(s)];
    return on ? Object.assign({}, s, { cash: +((+s.cash || 0) + on).toFixed(2) }) : s; });
  const alloc = POSITION_ENGINE.claimAlloc(sales, c.code, +c.amount, fl && fl.ready);
  const date = klDate(new Date(c.at)), method = c.method + (c.account ? " via " + c.account : "");
  const entries = alloc.rows.map((r, i) => ({ at: new Date(Date.parse(c.at) + i).toISOString(), type: "SELL", party: r.party, qty: 0, total: r.rm,
    status: "Payment", by: "customer", claim: true, claimId: c.id,
    raw: "Payment of RM " + r.rm + " on " + r.party + ", against the account (claim " + c.id + "), by " + method,
    payload: { mode: "amend", kind: "Fulfilment", direction: "SELL", party: r.party, rid: r.rid || null, orderKey: r.key, orderCode: null, linkTo: null,
      assoc: null, downstream: null, date, qty: 0, total: 0, cash: r.rm, kg: 0, note: "Paid on the statements site against the account, by " + method + "." } }));
  return { alloc, entries };
}
/** The amendment as a Correction restating the row's size, the goods' price and the delivery charge. */
export function amendEntry(order, code, figs, was, now) {
  const at = now instanceof Date ? now : new Date(now || Date.now());
  const books = partyOnBook(order, code);
  const said = ["qty", "total", "delivery"].filter((k) => Math.abs(figs[k] - was[k]) > 0.0004).map((k) => (k === "qty" ? "size " : k === "total" ? "goods RM " : "delivery RM ") + was[k] + " to " + figs[k]);
  return {
    at: at.toISOString(), type: "SELL", party: books, qty: figs.qty, total: figs.total, status: "Amendment",
    raw: "Amended " + books + ", order " + order.id + ": " + said.join(", "),
    payload: { mode: "amend", kind: "Correction", direction: "SELL", party: books, rid: null,
      orderKey: ledgerKeyOf(order), orderCode: null, linkTo: null, assoc: null, downstream: null,
      date: klDate(at), qty: 0, total: 0, cash: 0, kg: 0,
      fields: { qty: figs.qty, total: figs.total, delivery: figs.delivery },
      note: "Amended after Accept for order " + order.id + ": " + said.join(", ") + "." }
  };
}

/* IT IS THE ENGINE'S ovKey AND NOTHING ELSE: `${party}|${date}|${total}`, the total as the row
   carries it. It was written here with toFixed(2) and every amendment missed its row by the two
   noughts, which is the sort of thing that only shows when the chain is driven end to end. */
/* V4a (28 Sep 2026): AND ovKey BUILDS IT, from the goods, the carriage and the product the row will carry, so the key
   and the row cannot part: `party|date|amount` on salt, as it always was, and `|product` after it on any other book. */
export const orderKeyFor = (code, date, total, product, delivery) => POSITION_ENGINE.ovKey({ customer: code, date, total, delivery, product });
export const klDate = (now) => (now instanceof Date ? now : new Date(now || Date.now()))
  .toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });

/* ---- ON BEHALF OF A FRIEND (v702, his instruction of 18 Sep 2026) ----------------------------
 * An associate's own order and one placed for somebody else are no longer told apart by what they
 * buy; they tick it, and a ticked order books to their `<CODE>-R` bucket exactly as a phone-entered
 * downsell does. NOTHING HERE DOES THE BOOKING: the entry carries `stream: "R2"` and `assoc`, which
 * is the shape the drafter already takes, and the drafter calls the engine's own bookR2. A second
 * copy of that rule would be a second kind of downsell in the book.
 *
 * THE KEY NAMES THE ROW AS IT WILL STAND, so it is built on the BUCKET, because that is the party
 * the fold will write. Built on the associate's own code, every later amendment would miss its row.
 */
export const bucketFor = (code) => POSITION_ENGINE.bookR2({}, "customer", code, null).customer;
export const partyOnBook = (order, code) => (order && order.forFriend ? bucketFor(code) : code);
/* V4a: THE KEY AN ORDER NAMES ITS ROW BY, for every stage it builds and every road here that looks the row up: its own
   ledgerKey, given the product's tail if it was written before V4a, so an order rekeyOrders has not reached yet never
   names a salt twin's row by the old shape */
export const ledgerKeyOf = (order) => POSITION_ENGINE.ovRekey(order && order.ledgerKey, order && order.product) || null;

/** The pending row an acknowledged order becomes: agreed, nothing paid, nothing moved. */
export function pendingEntry(order, code, now) {
  const at = now instanceof Date ? now : new Date(now || Date.now());
  const date = klDate(at);
  const delivery = +(order.delivery || 0);
  /* 19 SEP 2026: THE ROW TAKES THE GOODS AND THE CARRIAGE APART, and the KEY keeps them together.
     The site has always kept them apart (stmt/page.js prints "RM x for the goods and RM y delivery")
     and this is where they were folded back into one figure on the way to the book. The row now
     carries what the site sent; the order key is still what the customer agreed to pay, which is the
     two together, because that key is written onto a LIVE order and a key that moved would orphan
     every order in flight. */
  const goods = +(+order.total).toFixed(2);
  const owed = +(order.total + delivery).toFixed(2);
  const friend = !!order.forFriend;
  const books = partyOnBook(order, code);
  /* the general location the customer typed stays on the site, on his card: a note reaches the
     committed book, and free text a customer typed is the one thing here that could carry a street */
  const note = "Ordered on the statements site, order " + order.id + ", acknowledged"
    + (friend ? ", on behalf of a friend" : "")
    + (order.mode === "deliver" ? ", to be delivered" : ", to collect")
    + (delivery > 0 ? ", delivery RM " + delivery : "")
    /* Step 2: a price he set on this order at its acknowledgement, and what they placed at */
    + (typeof order.asked === "number" && Math.abs(order.asked - goods) > 0.004 ? ", priced at RM " + goods + " on this order, placed at RM " + order.asked : "")
    /* 29 Sep 2026: the day they asked for rides as fixed words, never their text; the row stays dated at the acknowledgement */
    + (/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(order.wantBy || "") ? ", wanted by " + order.wantBy : "")
    + ". Nothing paid and nothing handed over yet.";
  const raw = "SELL " + books + " " + order.qty + " " + (order.product || "salt") + " RM " + owed
    + ", nothing paid, nothing moved (order " + order.id + ")";
  return {
    at: at.toISOString(), type: "SELL", party: books, qty: order.qty, total: goods, status: "Pending", raw,
    orderKey: orderKeyFor(books, date, goods, order.product || "salt", delivery),
    payload: { mode: "new", product: order.product || "salt", direction: "SELL", party: code, newId: null,
      date, qty: order.qty, total: goods, delivery, cash: 0, kg: 0,
      assoc: friend ? code : null, stream: friend ? "R2" : null, downstream: null,
      kind: null, orderCode: null, linkTo: null, note,
      handover: null, second: null }
  };
}

/** What a customer paid, as a Fulfilment against the row the acknowledgement made. `cash`: money he took at the
 *  handover and recorded on the card (S11 11.8, 11.12), the one payment the site did not hear first: the desk's own
 *  entry, said as his and marked `by: "desk"`, so the desk never reads it as a payment of theirs waiting on him. */
export function payEntry(order, code, amount, now, cash) {
  const at = now instanceof Date ? now : new Date(now || Date.now());
  const date = klDate(at);
  const rm = +(+amount).toFixed(2);
  const books = partyOnBook(order, code);
  const method = cash ? "cash at the counter" : (order.method ? (order.method + (order.account ? " via " + order.account : "")) : "not stated");
  return {
    at: at.toISOString(), type: "SELL", party: books, qty: 0, total: rm, status: "Payment", by: cash ? "desk" : "customer",
    raw: "Payment of RM " + rm + " on " + books + ", order " + order.id + ", by " + method,
    payload: { mode: "amend", kind: "Fulfilment", direction: "SELL", party: books, rid: null,
      orderKey: ledgerKeyOf(order), orderCode: null, linkTo: null, assoc: null, downstream: null,
      date, qty: 0, total: 0, cash: rm, kg: 0,
      note: (cash ? "Cash received at the handover, recorded on the desk, order " + order.id : "Paid on the statements site, order " + order.id + ", by " + method) + "." }
  };
}

/** S6 6.5: a claim's own Fulfilment, flagged as a claim for his check and stamped with the claim's moment, the one
 *  builder for the reconcile that queues it and the Received that answers it before it is queued. */
export function claimEntry(order, p) {
  const e = payEntry(Object.assign({}, order, { method: p.method || null, account: p.account || null }), order.code, p.amount, new Date(p.at));
  e.orderId = order.id; e.claim = true; e.claimOf = p.at;
  return e;
}

/** What was handed over, as a Correction: the running total, the day, and who moved it. */
export function handoverEntry(order, code, units, now) {
  const at = now instanceof Date ? now : new Date(now || Date.now());
  /* the day HE typed it on the site: movedOn is that moment's Kuala Lumpur day, so the Correction
     and the order agree even when this runs after midnight; a record from before movedOn falls back */
  const date = order.movedOn || klDate(at);
  const moved = +(+units).toFixed(2);
  const books = partyOnBook(order, code);
  const how = order.mode === "deliver" ? "delivered" : "collected";
  const was = moved > 0 ? redateFrom(order, date) : "";
  return Object.assign({
    at: at.toISOString(), type: "SELL", party: books, qty: moved, total: 0, status: "Handover",
    raw: moved + " unit " + how + " to " + books + ", order " + order.id + ", on " + date,
    payload: { mode: "amend", kind: "Correction", direction: "SELL", party: books, rid: null,
      orderKey: ledgerKeyOf(order), orderCode: null, linkTo: null, assoc: null, downstream: null,
      date, qty: 0, total: 0, cash: 0, kg: 0,
      fields: Object.assign({ deliveredQty: moved, deliveredOn: date, handover: how }, was ? { date } : {}),
      note: moved + " unit " + how + " for order " + order.id + redateWords(was, date) + "." }
  }, was ? { redate: true } : {});
}

/* The first later handover moves a wanted-day order from its acknowledgement's date. */
export function redateFrom(order, date) {
  if (!order || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(order.wantBy || "")) return "";
  if (+((order.queued || {}).moved) > 0) return "";
  const rowOn = String(order.ledgerKey || "").split("|")[1] || "";
  const h = order.history || [];
  let ack = null;
  for (let i = h.length - 1; i >= 0 && !ack; i--) if (h[i] && h[i].status === "acknowledged" && h[i].by === "desk" && !h[i].note) ack = h[i].at;
  if (!ack || isNaN(Date.parse(ack)) || rowOn !== klDate(new Date(ack))) return "";
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date || "") && date > rowOn ? rowOn : "";
}
const redateWords = (was, date) => (was ? ", its first handover, so the row moves from " + was + " to " + date : "");
export const keyAfter = (order, e) => (e.status === "Close" || e.redate ? closedKey(order, e.redate ? e.payload.fields.date : undefined) : ledgerKeyOf(order));

/** S11 11.9: an order closed at what was handed over, as a Correction restating the row: its size and the
 *  goods' total at what went, what was handed over and when. The cost follows the size in the fold. */
export function closeEntry(order, code, now) {
  const at = now instanceof Date ? now : new Date(now || Date.now());
  const date = order.movedOn || klDate(at);
  const books = partyOnBook(order, code);
  const how = order.mode === "deliver" ? "delivered" : "collected";
  const qty = +(+order.qty).toFixed(3), goods = +(+order.total).toFixed(2), was = (order.closed && order.closed.qty) || qty;
  const from = +order.moved > 0 ? redateFrom(order, date) : "";
  return Object.assign({
    at: at.toISOString(), type: "SELL", party: books, qty, total: goods, status: "Close",
    raw: "Closed at " + qty + " unit " + how + " to " + books + " for RM " + goods + ", order " + order.id + ", of " + was + " ordered",
    payload: { mode: "amend", kind: "Correction", direction: "SELL", party: books, rid: null,
      orderKey: ledgerKeyOf(order), orderCode: null, linkTo: null, assoc: null, downstream: null,
      date, qty: 0, total: 0, cash: 0, kg: 0,
      fields: Object.assign({ qty, total: goods, deliveredQty: +(+order.moved || 0).toFixed(3), deliveredOn: date, handover: how }, from ? { date } : {}),
      note: "Closed at " + qty + " unit " + how + " for order " + order.id + ", of the " + was + " ordered" + redateWords(from, date) + "." }
  }, from ? { redate: true } : {});
}
/* THE ROW'S NAME MOVES WITH ITS TOTAL: the engine's ovKey of the row as the close leaves it, the party and the
   day kept from the key the acknowledgement wrote. Later stages then wait for the close to fold, as a first
   stage waits for its pending row, and the return leg finds the row by the name it will carry. */
/* V4a: and the product the order carries, so a close keeps a row's tail. `date` is a day a stage restates in place of
   the key's own: Step 2's early handover redates the row, and its key moves here as a close's does. */
export const closedKey = (order, date) => {
  const [party, was] = String(order.ledgerKey || "").split("|");
  return POSITION_ENGINE.ovKey({ customer: party, date: date || was, total: +(+order.total).toFixed(2), delivery: +order.delivery || 0, product: order.product });
};

/** Either side withdrew it: the row is cancelled, and the fold raises any refund itself. */
export function cancelEntry(order, code, why, now) {
  const at = now instanceof Date ? now : new Date(now || Date.now());
  const date = klDate(at);
  const books = partyOnBook(order, code);
  return {
    at: at.toISOString(), type: "SELL", party: books, qty: 0, total: 0, status: "Cancellation",
    raw: "Cancellation on " + books + ", order " + order.id + ", recorded " + date,
    payload: { mode: "amend", kind: "Cancellation", direction: "SELL", party: books, rid: null,
      orderKey: ledgerKeyOf(order), orderCode: null, linkTo: null, assoc: null, downstream: null,
      date, qty: 0, total: 0, cash: 0, kg: 0,
      note: "Withdrawn on the statements site by " + (why === "desk" ? "the desk" : "the customer") + ", order " + order.id + "." }
  };
}

/* ---- THE STAGE'S OWN MOMENT (20 Sep 2026) -----------------------------------------------------
 * Every entry queued in one pass carried the pass's clock, and a draft's id IS the entry's `at`: on
 * 18 Sep three acknowledgements queued in one tick collapsed to ONE draft in the drafter's byAt map,
 * and the pending row for order 4l1kkq was never made. An entry is stamped with the moment its stage
 * happened on the site instead: the acknowledgement's history event, the last payment, the handover
 * (movedAt), the withdrawal. Two stages are two moments, so two ids; a stage queued again after a
 * failed mark lands on the same id, which the drafter's INSERT OR IGNORE collapses; and the pending
 * row is dated the day he agreed it rather than the day the cron noticed (acknowledged at 23:59 and
 * reconciled at 00:00 it was dated tomorrow, inside its own key). A record from before this carries
 * no movedAt: the handover's own history note stands in, and the pass's clock is the last resort. */
export function stageAt(order, job, now) {
  const h = (order && order.history) || [];
  const last = (test) => { for (let i = h.length - 1; i >= 0; i--) if (h[i] && test(h[i])) return h[i].at; return null; };
  let at = null;
  if (job === "ack") at = last((x) => x.status === "acknowledged" && x.by === "desk");
  else if (job === "pay") { const p = ((order && order.payments) || []).filter((x) => x && !x.claim); at = p.length ? p[p.length - 1].at : null; }   /* a claim is stamped by its own moment (S6) */
  else if (job === "move") at = (order && order.movedAt) || last((x) => x.by === "desk" && / unit (delivered|collected)$/.test(String(x.note || "")));
  else if (job === "cancel") at = last((x) => x.status === "cancelled" || x.status === "declined");
  else if (job === "close") at = (order && order.closed && order.closed.at) || null;
  const d = at ? new Date(at) : null;
  return d && !isNaN(d.getTime()) ? d : (now instanceof Date ? now : new Date(now || Date.now()));
}

/* ---- ACCEPT: THE PENDING ROW AT THE GOODS HE SET, AND THE ONE LINE NO PRICE GOES UNDER (rule 5) ---------------------------
   The order as it is agreed: the charge the site decides (typed for a delivery, nought for a collection) and, when he sets a
   price on this one order, the goods at it with what they placed it at kept beside it as `asked`. The entry, its key and its
   note are all built on the agreed order, so the row, its key and the digest are drafted on what he set. */
export function acceptEntry(o, code, delivery, price, now) {
  const agreed = Object.assign({}, o, { delivery: o.mode === "deliver" ? (delivery || 0) : 0 }, price != null ? { total: price, asked: +(+o.total).toFixed(2) } : {});
  const entry = pendingEntry(agreed, code, now);
  entry.orderId = o.id;
  return { agreed, entry };
}
/* never under the floor at this size: the one line no price he sets goes under (rule 5). A price is set only against the
   floor AT this size: none known, or only a carded size below it (an older snapshot), and no price can be set on it. `fl` is
   the drafter's floorFor answer; null when no price is set, or the price holds. */
export function floorRefusal(price, fl, qty) {
  if (price != null && (!fl || !fl.exact))
    return { ok: false, status: 409, underFloor: true, floor: fl ? { rm: fl.floor, at: fl.at, exact: false } : null,
      error: "no floor is known at " + qty + " unit, so no price can be set on it: accept it at theirs" };
  if (price != null && price < fl.floor - 0.005)
    return { ok: false, status: 409, underFloor: true, floor: { rm: fl.floor, at: fl.at, exact: fl.exact },
      error: rm(price) + " is under the floor of " + rm(fl.floor) + " at " + qty + " unit, so it cannot be set" };
  return null;
}

/* ---- THE BOOK A STAGE'S ENTRY IS DRAFTED AGAINST --------------------------------------------------------------------------
   Not on the book yet, the pending row as it was drafted is what will land, and an early handover's redate stands in the
   row it moves. `rd` is the redate entry's draft ({entry, status}) or null and `ackRow` the pending row's draft ({row, status})
   or null, both read by the caller (ackRowWanted says whether the second is needed). Returns { ok, against, waits } or the
   refusal. The book is never changed. */
const NO_ROW = (r) => ({ ok: false, status: 409, error: "its pending row " + (r ? "was rejected" : "is not drafted yet") + ", so there is no row for this to amend" });
export const ackRowWanted = (book, entry, rd) => {
  const open = (book.state && book.state.OPEN && book.state.OPEN.byKey) || {};
  return rd && rd.status !== "rejected" ? !open[JSON.parse(rd.entry).payload.orderKey] : !open[entry.payload.orderKey];
};
export function stageAgainst(book, entry, rd, ackRow) {
  const open = (book.state && book.state.OPEN && book.state.OPEN.byKey) || {};
  if (rd && rd.status !== "rejected") {
    const re = JSON.parse(rd.entry), was = re.payload.orderKey, day = re.payload.fields.date;
    let base = book;
    if (!open[was]) {
      if (!ackRow || ackRow.status === "rejected") return NO_ROW(ackRow);
      base = withPending(book, JSON.parse(ackRow.row));
    }
    const row = (base.sales || []).find((s) => POSITION_ENGINE.ovKey(s) === was);
    if (!row) return { ok: false, status: 409, error: "the row its first handover redates is not on the book, so there is no row for this to amend" };
    const sales = base.sales.filter((s) => s !== row), st = Object.assign({}, base.state || {}), op = Object.assign({}, st.OPEN || {});
    op.byKey = Object.assign({}, op.byKey || {}); delete op.byKey[was]; st.OPEN = op;
    return { ok: true, waits: true, against: withPending(Object.assign({}, base, { sales, state: st }), Object.assign({}, row, { date: day })) };
  }
  if (!open[entry.payload.orderKey]) {
    if (!ackRow || ackRow.status === "rejected") return NO_ROW(ackRow);
    return { ok: true, waits: true, against: withPending(book, JSON.parse(ackRow.row)) };
  }
  return { ok: true, waits: false, against: book };
}

/* ---- THE ENTRY A JOB OF THE RECONCILE MAKES, stamped with its stage's own moment (stageAt) -------------------------------
   `told` is the payment a pay job carries; null for a job this does not make. WHO ENDED IT is read off the event that ended
   it (24 Sep 2026): a cancellation of his own was noted in the committed row as the customer's. */
export function jobEntry(job, order, code, told, now) {
  if (job === "ack") return pendingEntry(order, code, stageAt(order, job, now));
  if (job === "pay") return payEntry(order, code, told, stageAt(order, job, now));
  if (job === "move") return handoverEntry(order, code, +order.moved || 0, stageAt(order, job, now));
  if (job === "close") return closeEntry(order, code, stageAt(order, job, now));
  if (job === "cancel") {
    const ended = [...(order.history || [])].reverse().find((x) => x && (x.status === "cancelled" || x.status === "declined"));
    return cancelEntry(order, code, ended && ended.by === "desk" ? "desk" : "customer", stageAt(order, job, now));
  }
  return null;
}
/* a move he rejected, offered again: the same entry under a fresh moment, its key in the shape the row key has now (V4a) */
export function againEntry(rejected, o, at) {
  const entry = Object.assign({}, rejected, { at: at.toISOString() });
  if (entry.payload && entry.payload.orderKey) entry.payload = Object.assign({}, entry.payload, { orderKey: POSITION_ENGINE.ovRekey(entry.payload.orderKey, o.product) });
  return entry;
}
/* A CLOSE OR REDATE HE REJECTS NEVER LANDS, so the row keeps the name it had: the key the order is given back, or null */
export const keyGivenBack = (entry, o) => ((entry.status === "Close" || entry.redate) && entry.payload && entry.payload.orderKey ? POSITION_ENGINE.ovRekey(entry.payload.orderKey, o.product) : null);

/* ---- THE TAPS: what each queues, from the order and what the caller read ------------------------------------------------
   Each answers as stageTap's build does: { error, status } | { again: stage } | { entry, site, shown, ... }. None reads a store. */

/** Collected or Delivered: the running total handed over, or a close at what was. `rej` is the newest rejected move, if any. */
export function handoverTap(o, body, at, rej) {
  const qty = body && body.qty;
  if (typeof qty !== "number" || !Number.isFinite(qty) || qty < 0 || qty > +o.qty + 0.004) return { error: "the units handed over have to be a figure from zero to the " + o.qty + " ordered" };
  /* S11 11.9: CLOSE AT WHAT WAS HANDED OVER is a close only under the size, as the site decides it; its row is the
     one Correction restating size and total (closeEntry), so that is the row his yes is the digest of, and a close
     at what is already out is a tap of its own, never "that is what the order already says" */
  const closing = body.close === true && qty < +o.qty - 0.004;
  if (closing && !(qty > 0)) return { error: "nothing was handed over, so there is nothing to close at: cancel it instead" };
  if (!closing && Math.abs(qty - (+o.moved || 0)) < 0.0004) {
    if (rej && Math.abs(qty - (+((rej.entry.payload.fields || {}).deliveredQty) || 0)) < 0.0004) return { again: "move" };
    return { status: 409, error: "that is what the order already says was handed over" };
  }
  /* stamped as the site stamps it: the Kuala Lumpur day of the tap, the handover's own day */
  const handed = Object.assign({}, o, { movedOn: klDate(at), moved: qty });
  const entry = closing
    ? closeEntry(Object.assign(handed, { qty, total: POSITION_ENGINE.closeGoods(o.total, +o.qty, qty), closed: { at: at.toISOString(), qty: o.qty, total: o.total } }), o.code, at)
    : handoverEntry(handed, o.code, qty, at);
  entry.orderId = o.id;
  const handover = { units: qty, mode: o.mode };
  if (closing) { handover.close = true; handover.total = entry.total; }   /* stated, the site pricing nothing */
  /* A CLOSE UNDER WHAT THEY HAVE PAID leaves money he holds that is theirs: the fold raises a customerRefunds row for the
     difference as its Correction lands (the engine's refundOnOverpay), so the tap files his yes like any close, and the
     answer and the drafter's flag say what opens */
  const over = closing ? +((+o.paid || 0) - (+entry.total + (+o.delivery || 0))).toFixed(2) : 0;
  const shown = { units: qty, how: o.mode === "deliver" ? "delivered" : "collected", close: closing };
  if (over > 0.004) shown.refund = over;
  return Object.assign({ entry, site: { handover }, shown }, over > 0.004 ? { refund: over } : {});
}

/** Received: their payment, or a claim of theirs, in his bank. ctx: { queued: their pending Payment entries, shut: ids of claims
 *  filed not found, onRows: money on its way by row key, rej: the newest rejected payment, room: rowRoom's reader or null }. */
export function receivedTap(o, at, body, ctx) {
  const { queued, shut, onRows, rej, room } = ctx;
  const b = (() => {
    const amount = body && body.amount;
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return { error: "say how much was received" };
    /* S6 6.5 (D7): A CLAIM OF THEIRS, named by its moment (the oldest waiting when the tap names none). His yes is to
       the claim's own entry, drafted or still to be, and the site hears it as one verdict: it becomes paid there */
    const waiting = (o.payments || []).filter((p) => p && p.claim === "waiting");
    if (waiting.length) {
      const p = body.claim ? waiting.find((x) => x.at === body.claim) : waiting[0];
      if (!p) return { status: 409, error: "that claim of theirs is not waiting any more: look again" };
      if (Math.abs(p.amount - amount) > 0.004) return { status: 409, error: "RM " + p.amount.toFixed(2) + " they say they sent is waiting to be received here, not RM " + amount.toFixed(2) };
      if (shut.has(p.queued || "") || shut.has(p.at)) return { status: 409, error: "that claim was filed not found, and its row with it: it cannot be received now" };
      /* S6 fix: money sent against the account, booked on this order's row and not folded yet, may be this very money */
      const onRow = onRows[ledgerKeyOf(o)] || 0, due = +((+o.total + (+o.delivery || 0)) - (+o.paid || 0)).toFixed(2);
      if (onRow > 0.004 && p.amount > due - onRow + 0.004) return { status: 409, error: "RM " + onRow.toFixed(2) + " sent against their account is booked on this order's row and not folded yet, so this claim would pay it twice: answer it once the fold lands" };
      const site = { verdict: { kind: "received", claim: p.at, amount: p.amount } }, shown = { amount: p.amount, claim: p.at };
      const own = Object.assign({}, queued.find((e) => e.at === p.queued) || claimEntry(o, p));
      if (p.queued) { own.at = p.queued; return { entry: own, pin: p.queued, site, shown }; }
      return { entry: own, site, shown };
    }
    const drafted = queued.find((e) => Math.abs(+e.payload.cash - amount) < 0.005 && !e.claim);
    if (drafted) return { entry: drafted, pin: drafted.at, shown: { amount: +drafted.payload.cash } };
    /* a claim he received and not yet queued is told by its own entry, as the site's paidUntold reads it */
    const own = (o.payments || []).filter((p) => p && p.claim === "received" && !p.queued).reduce((n, p) => n + (+p.amount || 0), 0);
    const inc = +((+o.paid || 0) - own - (+((o.queued || {}).paid) || 0)).toFixed(2);
    if (!(inc > 0.004) && rej && Math.abs(+rej.entry.payload.cash - amount) < 0.005) return { again: "pay" };
    if (!(inc > 0.004)) return { status: 409, error: "nothing they recorded is waiting to be received here" };
    if (Math.abs(inc - amount) > 0.004) return { status: 409, error: "RM " + inc.toFixed(2) + " they recorded is waiting to be received, not RM " + amount.toFixed(2) };
    /* the Fulfilment the reconcile will queue for it: the increment, stamped with their last payment */
    const entry = payEntry(o, o.code, inc, stageAt(o, "pay", at));
    entry.orderId = o.id;
    return { entry, shown: { amount: inc } };
  })();
  /* 28 Sep 2026, s210: whichever entry his yes answers, it answers to what the row can still take */
  return (b.entry && pastRoom(room, o, b.entry, "received", !!b.site)) || b;
}

/** Cash received: cash taken at the counter. ctx: { rej: the newest rejected cash entry, room: rowRoom's reader or null }. */
export function cashTap(o, at, body, ctx) {
  const { rej, room } = ctx;
  const amount = body && body.amount;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return { error: "say how much cash was taken" };
  /* the order already counts that cash: raising it again would count it twice */
  if (rej && Math.abs(+rej.entry.payload.cash - amount) < 0.005) return { again: "cash" };
  const due = +((+o.total + (+o.delivery || 0)) - (+o.paid || 0) - (+o.claimed || 0)).toFixed(2);   /* S6: less what they say they sent */
  if (amount > due + 0.004) return { error: "that is more than the RM " + due.toFixed(2) + " still owed on this order" + ((+o.claimed || 0) > 0.004 ? " beside what they say they sent" : "") };
  /* a payment of theirs not yet queued would be swallowed by the mark the cash moves (orderWork reads paid against it) */
  /* S6: a claim he received and not yet queued is told by its own entry, so it is left out, as the site's paidUntold leaves it */
  const own = (o.payments || []).filter((p) => p && p.claim === "received" && !p.queued).reduce((n, p) => n + (+p.amount || 0), 0);
  if ((+o.paid || 0) - own > (+((o.queued || {}).paid) || 0) + 0.004) return { status: 409, error: "a payment they recorded is still waiting for its row: receive that first" };
  const entry = payEntry(o, o.code, amount, at, true);
  entry.orderId = o.id; entry.counter = true;   /* the desk's own, which a Received never answers */
  /* 28 Sep 2026, s210: AND WHAT THE ROW CAN STILL TAKE, asked of every road the money can come by */
  const past = pastRoom(room, o, entry, "cash");
  if (past) return past;
  /* the site's own cash event (S11 11.8): paid at once, kept as his in cash, and the ledger's mark of the money moved
     by the same figure, because this Fulfilment is the desk's own and the reconcile must not queue it again */
  return { entry, queueIt: true, site: { cash: { amount: +amount.toFixed(2) } }, shown: { amount: +amount.toFixed(2), cash: true } };
}

/** 16 Oct 2026, his word on CR3-DAM's s263 (a Correction cut the row to RM65 and the order kept RM80): AN AGREED ORDER STATES
 *  WHAT ITS ROW STATES. The size, the goods and the delivery the return leg restates the order to, or null when they already
 *  agree or the order cannot take them now (not agreed, a claim of theirs waiting, a size under what is out, a charge on a
 *  collection). A row on a trip carries the trip's one delivery or none, so the order keeps its own. `moved` is what the order
 *  will hold once the same pass has carried the handovers back. */
export function termsFromRow(o, row, moved) {
  if (!o || !row || !AGREED_ON_SITE.includes(o.status)) return null;
  if ((o.payments || []).some((p) => p && p.claim === "waiting")) return null;
  const qty = +(+row.qty).toFixed(3), total = +(+row.total).toFixed(2);
  const delivery = row.trip ? +(+(o.delivery || 0)).toFixed(2) : +(+(row.delivery || 0)).toFixed(2);
  if (!(qty > 0) || !(total > 0) || !(delivery >= 0)) return null;
  if (delivery > 0.004 && o.mode !== "deliver") return null;
  if (qty < Math.max(+o.moved || 0, +moved || 0) - 0.0004) return null;
  if (Math.abs(qty - +o.qty) < 0.0004 && Math.abs(total - +o.total) < 0.004 && Math.abs(delivery - (+o.delivery || 0)) < 0.004) return null;
  return { qty, total, delivery };
}

/** Amend after Accept (06 Oct 2026): one Correction restating size, goods and delivery. ctx: { book, room, earlier: the order's
 *  Amendment drafts ({status, committed_at}), live: a yes waiting on an amendment or null }. */
export function restateTap(o, at, body, ctx) {
  const { book, room, earlier, live } = ctx;
  if (!AGREED_ON_SITE.includes(o.status)) return { status: 409, error: "this order is " + o.status + ", so its figures are not amended" };
  const num = (v) => typeof v === "number" && Number.isFinite(v);
  const qty = body && body.qty !== undefined ? body.qty : +o.qty;
  const total = body && body.total !== undefined ? body.total : +o.total;
  const delivery = body && body.delivery !== undefined ? body.delivery : +(o.delivery || 0);
  if (!num(qty) || !(qty > 0) || qty > 1000000) return { error: "the size has to be a figure above nothing" };
  if (!num(total) || !(total > 0) || total > 1000000) return { error: "the goods' price has to be a figure above nothing" };
  if (!num(delivery) || delivery < 0 || delivery > 1000000) return { error: "the delivery charge has to be a figure from nothing" };
  if (delivery > 0 && o.mode !== "deliver") return { error: "a collection carries no delivery charge" };
  const figs = { qty: +qty.toFixed(3), total: +total.toFixed(2), delivery: +delivery.toFixed(2) };
  const was = { qty: +o.qty, total: +(+o.total).toFixed(2), delivery: +(+(o.delivery || 0)).toFixed(2) };
  if (Math.abs(figs.qty - was.qty) < 0.0004 && figs.total === was.total && figs.delivery === was.delivery) return { status: 409, error: "that is what the order already says" };
  if (figs.qty < (+o.moved || 0) - 0.0004) return { error: "the size cannot go under the " + o.moved + " already handed over" };
  if (o.closed && Math.abs(figs.qty - was.qty) > 0.0004) return { status: 409, error: "the order was closed at what was handed over, so its size stays; amend the price or the delivery" };
  if ((o.payments || []).some((p) => p && p.claim === "waiting")) return { status: 409, error: "a payment they say they sent waits on this order: answer it first, Received or Not found" };
  const owed = +(figs.total + figs.delivery).toFixed(2);
  /* 06 Oct 2026: under what they paid is no longer refused; the fold raises a refund for the difference (refundOnOverpay) */
  const over = +((+o.paid || 0) - owed).toFixed(2);
  if (!book || book.version == null) return { status: 503, error: "the mirror is being seeded: try again in a minute" };
  /* never under the floor at the size, and the board is never repriced: what changes is this one order's figure */
  if (figs.qty !== was.qty || figs.total !== was.total) {
    const fl = floorFor(book, o.product || "salt", figs.qty);
    if (!fl || !fl.exact) return { status: 409, error: "no floor is known at " + figs.qty + " unit, so no price can be set on it" };
    if (figs.total < fl.floor - 0.005) return { status: 409, error: rm(figs.total) + " is under the floor of " + rm(fl.floor) + " at " + figs.qty + " unit, so it cannot be set" };
  }
  /* money on its way to the row (a claim against the account, cash, a payment typed on the desk) is measured once it lands:
     the refund is read off the row as it stands when each entry folds, so the figure waits for that money */
  const r = room ? room(ledgerKeyOf(o), null) : null;
  if (r && r.on > 0.004) {
    const paidRow = +(was.total + was.delivery - r.owes).toFixed(2);
    if (owed < paidRow + r.on - 0.004) return { status: 409, error: "the row has " + rm(paidRow) + " paid and " + rm(r.on) + " more on its way, so it cannot come to " + rm(owed) + " until that lands" };
  }
  if (earlier.some((x) => x.status === "pending" || (x.status === "approved" && !x.committed_at)))
    return { status: 409, error: "an earlier amendment of this order is not on the book yet: wait for it to land" };
  if (live && live.status === "waiting") return { status: 409, error: "an earlier amendment of this order is waiting to be drafted" };
  const entry = amendEntry(o, o.code, figs, was, at);
  entry.orderId = o.id;
  /* plan 4 (16 Oct 2026): AN UNDO OF THE ORDER'S NEWEST CHANGE OF TERMS comes this road, so the order keeps its row: the change must still be
     the newest move on the row, nothing on its way to it, and these figures the ones it replaced; the Correction then carries exactly what
     undoing it sets, which the drafter and the fold check again, and the site's restate says it is an undo, which tells the customer */
  let undone = null;
  if (body && body.undo !== undefined) {
    const row = book && (book.sales || []).find((s) => s && !s.cancelled && POSITION_ENGINE.ovKey(s) === ledgerKeyOf(o));
    const u = !Number.isInteger(body.undo) ? { fault: "it names no step" } : row ? POSITION_ENGINE.undoOf(row, body.undo) : { fault: "the order's row is not on the book" };
    if (u.fault) return { status: 409, error: "the undo was refused: " + u.fault };
    if (u.kind !== "terms" || Object.keys(u.fields).some((k) => !["qty", "total", "delivery", "cost", "unpriced"].includes(k))) return { status: 409, error: "that change on a site order is undone by hand" };
    if (r && r.on > 0.004) return { status: 409, error: "money is already on its way to this row: decide it before undoing a move" };
    if ((+o.paid || 0) - (+((o.queued || {}).paid) || 0) > 0.004) return { status: 409, error: "the order has a payment the book has not heard yet: wait for it to land" };
    const back = Object.assign({}, row);
    for (const [k, v] of Object.entries(u.fields)) { if (v === null) delete back[k]; else back[k] = v; }
    if (Math.abs(figs.qty - +back.qty) > 0.0004 || Math.abs(figs.total - +back.total) > 0.004 || Math.abs(figs.delivery - (+back.delivery || 0)) > 0.004)
      return { status: 409, error: "the undo changed since it was read: read the order again" };
    entry.payload.fields = Object.assign({}, u.fields);
    entry.payload.undo = u.i;
    undone = u.i;
  }
  const shown = Object.assign({ was }, figs);
  if (over > 0.004) shown.refund = over;
  if (undone != null) shown.undo = undone;
  return Object.assign({ entry, queueIt: true, site: { restate: Object.assign({}, figs, undone != null ? { undo: true } : {}) }, shown }, over > 0.004 ? { refund: over } : {});
}
