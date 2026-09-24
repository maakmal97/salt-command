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
import POSITION_ENGINE from "../engine/position.mjs";

const DEVICE = "orders";
const MARK = "orders:nudged";
/* v752: a line a customer wrote has its OWN mark. On one mark a message arriving in a quiet hour
   would be compared against the newest PLACEMENT and read as old news, and a placement would clear
   the memory of an unanswered line. Two marks, either of which wakes him. */
const SAID_MARK = "orders:said";
/* v760: the third mark. A placement, a line and a payment each need their own, or the newest of
   them buries the other two: one mark means the second thing to happen in a minute looks old. */
const THEIRS_MARK = "orders:theirs";
/* what the last of them was, for the banner to read. It expires, because a wake is delivered in
   seconds and a line about a payment made this morning would be a lie at lunchtime. */
const NEWS_KEY = "orders:news";
const NEWS_WORD = { pay: "A customer has paid", cancel: "A customer has withdrawn an order", said: "A customer wrote on an order" };
/* v764: the book the return leg last told the site about. A fold mints a new version and re-seeds
   the mirror, so comparing the version is one cheap read a minute and a full pass only when there
   is something new to say. It moves only when the whole pass got through. */
const TOLD_MARK = "orders:told";

function site(env, path, init) {
  if (!env.STMT_SITE || !env.STMT_DESK_KEY) return null;
  const h = Object.assign({ "X-Stmt-Desk": env.STMT_DESK_KEY }, (init && init.headers) || {});
  return env.STMT_SITE.fetch("https://stmt" + path, Object.assign({}, init || {}, { headers: h }));
}

/* ---- WORDS THAT MAY NOT REACH A CUSTOMER'S PAGE (20 Sep 2026) ----------------------------------
 * The desk's name, a roster code and a level's name are never on Salt Counter. Nothing under stmt/ may
 * hold these literals, so the check lives here, on the one road his own words take to the site: the
 * bulletin. A product's name is his to spend there; the phone warns and lets him. */
const LEVEL_WORDS = ["ambassador", "titanium", "platinum", "gold", "silver", "bronze"];
export function siteWords(text) {
  const t = String(text || "");
  if (/salt\s*command/i.test(t)) return "that names the desk, which a customer's page never does";
  if (/\b[A-Z]{2}\d{1,2}-[A-Z]{2,4}(-R)?\b/.test(t)) return "that carries a roster code, which a customer's page never shows";
  if (LEVEL_WORDS.some((w) => new RegExp("\\b" + w + "\\b", "i").test(t))) return "that names a level, which a customer's page never does";
  return "";
}

/** The bulletin, read or set on the site through the binding; a POST is checked line by line first. */
export async function bulletinRelay(env, method, body) {
  if (method === "POST") {
    for (const line of (body && Array.isArray(body.lines)) ? body.lines : []) {
      const why = siteWords(line);
      if (why) return { ok: false, status: 400, error: "the bulletin has a line " + why };
    }
  }
  const r = await site(env, "/desk/bulletin", method === "POST"
    ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) } : undefined);
  if (!r) return { ok: false, status: 503, error: "the order relay is not configured (STMT_SITE binding and STMT_DESK_KEY secret)" };
  const b = await r.json().catch(() => ({}));
  if (!r.ok || !b.ok) return { ok: false, status: r.status, error: b.error || ("the statements site answered http " + r.status) };
  return b;
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
  /* v753: HIS ANSWER GOES THROUGH THE SAME LOCK AS THE BULLETIN. What he types here lands on a page
     that never names this desk, a roster code or a level, and a slip of the thumb is how one gets
     there. Checked HERE and not on the site, because the site holds no roster and would not know a
     code if it saw one; a product's name is his to spend, as it is in the bulletin. */
  if (body && typeof body.message === "string") {
    const why = siteWords(body.message);
    if (why) return { ok: false, status: 400, error: "that message says something " + why };
  }
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
const bucketFor = (code) => POSITION_ENGINE.bookR2({}, "customer", code, null).customer;
export const partyOnBook = (order, code) => (order && order.forFriend ? bucketFor(code) : code);

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
    + (delivery > 0 ? ", delivery RM " + delivery : "") + ". Nothing paid and nothing handed over yet.";
  const raw = "SELL " + books + " " + order.qty + " " + (order.product || "salt") + " RM " + owed
    + ", nothing paid, nothing moved (order " + order.id + ")";
  return {
    at: at.toISOString(), type: "SELL", party: books, qty: order.qty, total: goods, status: "Pending", raw,
    orderKey: orderKeyFor(books, date, owed),
    payload: { mode: "new", product: order.product || "salt", direction: "SELL", party: code, newId: null,
      date, qty: order.qty, total: goods, delivery, cash: 0, kg: 0,
      assoc: friend ? code : null, stream: friend ? "R2" : null, downstream: null,
      kind: null, orderCode: null, linkTo: null, note,
      handover: null, second: null }
  };
}

/** What a customer paid, as a Fulfilment against the row the acknowledgement made. */
export function payEntry(order, code, amount, now) {
  const at = now instanceof Date ? now : new Date(now || Date.now());
  const date = klDate(at);
  const cash = +(+amount).toFixed(2);
  const books = partyOnBook(order, code);
  const method = order.method ? (order.method + (order.account ? " via " + order.account : "")) : "not stated";
  return {
    at: at.toISOString(), type: "SELL", party: books, qty: 0, total: cash, status: "Payment",
    raw: "Payment of RM " + cash + " on " + books + ", order " + order.id + ", by " + method,
    payload: { mode: "amend", kind: "Fulfilment", direction: "SELL", party: books, rid: null,
      orderKey: order.ledgerKey || null, orderCode: null, linkTo: null, assoc: null, downstream: null,
      date, qty: 0, total: 0, cash, kg: 0,
      note: "Paid on the statements site, order " + order.id + ", by " + method + "." }
  };
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
  return {
    at: at.toISOString(), type: "SELL", party: books, qty: moved, total: 0, status: "Handover",
    raw: moved + " unit " + how + " to " + books + ", order " + order.id + ", on " + date,
    payload: { mode: "amend", kind: "Correction", direction: "SELL", party: books, rid: null,
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
  const books = partyOnBook(order, code);
  return {
    at: at.toISOString(), type: "SELL", party: books, qty: 0, total: 0, status: "Cancellation",
    raw: "Cancellation on " + books + ", order " + order.id + ", recorded " + date,
    payload: { mode: "amend", kind: "Cancellation", direction: "SELL", party: books, rid: null,
      orderKey: order.ledgerKey || null, orderCode: null, linkTo: null, assoc: null, downstream: null,
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
  else if (job === "pay") { const p = (order && order.payments) || []; at = p.length ? p[p.length - 1].at : null; }
  else if (job === "move") at = (order && order.movedAt) || last((x) => x.by === "desk" && / unit (delivered|collected)$/.test(String(x.note || "")));
  else if (job === "cancel") at = last((x) => x.status === "cancelled" || x.status === "declined");
  const d = at ? new Date(at) : null;
  return d && !isNaN(d.getTime()) ? d : (now instanceof Date ? now : new Date(now || Date.now()));
}

/** Append one entry to the orders device's queue. Per-device replace, as the phone does.
 * A KEY THIS CANNOT READ IS STARTED AFRESH, AND SAID SO (20 Sep 2026). q:orders held a hand-written
 * value with its quotes stripped from 19 Sep 03:49 UTC: the json read threw, the catch in
 * reconcileOrders swallowed it, and every site order failed in silence for a day. What such a key
 * holds is nothing the book needs: an entry reaches it only from here, is drafted on arrival, and its
 * stage is marked told on the order only after this write, so anything lost is still owed and comes
 * round next minute. The drafter and the drain already read such a key as empty; the writer agrees
 * now, and the head of what it held goes to the log. THE SAME STAGE already queued under its `at` is
 * not queued twice, which is what lets a stage come round again after a failed mark; A DIFFERENT
 * stage that happens to carry the same millisecond (a payment and a handover typed together) takes
 * the next free one, because a draft's id is the `at` and two ids cannot be one. */
export async function queueSale(env, entry) {
  const key = "q:" + DEVICE;
  const raw = await env.SALT_QUEUE.get(key);
  let cur = null;
  if (raw) {
    try { cur = JSON.parse(raw); }
    catch (e) { console.log("orders queue: " + key + " could not be read and is started afresh (" + String((e && e.message) || e) + "); it held: " + String(raw).slice(0, 200)); }
  }
  if (!cur || !Array.isArray(cur.queue)) cur = { device: DEVICE, queue: [] };
  for (;;) {
    const hit = cur.queue.find((x) => x && x.at === entry.at);
    if (!hit) break;
    if (hit.raw === entry.raw) return false;
    entry.at = new Date(Date.parse(entry.at) + 1).toISOString();
  }
  cur.queue = cur.queue.concat([entry]);
  cur.updated = new Date().toISOString();
  await env.SALT_QUEUE.put(key, JSON.stringify(cur));
  return true;
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
  const STAGE_WORD = { pay: "payment", move: "handover", cancel: "withdrawal" };
  for (const o of owing) {
    const code = users[o.u] || null;
    const q = o.queued || {}, mark = {}; const order = Object.assign({}, o);
    /* WHAT THIS PASS MADE OF THE ORDER (20 Sep 2026), written onto the record as `sync` when it changes,
       so the Site orders card says queued, waiting or failed and why, where it promised "queued within
       the minute" whatever had happened. A wait was invisible on every surface for as long as it lasted. */
    let state = null;
    /* no code, no row: the test account and any account published since the last map land here,
       and they wait rather than being guessed at */
    if (!code) { unmapped.push(o.id); state = { state: "waiting", why: "no desk code is mapped to this account yet: publish the statements again" }; }
    else {
    /* the ids already spent on this order: two stages stamped in the same millisecond would share a
       draft id, so the later one takes the next millisecond, and takes it again on a re-queue */
    const used = new Set([q.ack, q.cancel].filter(Boolean));
    try {
      for (const job of o.work || []) {
        let e = null;
        if (job !== "ack" && !(onBook && onBook[order.ledgerKey])) {
          waiting.push(o.id);
          state = { state: "waiting", why: "the " + (STAGE_WORD[job] || job) + " waits for the pending row to reach the book: approve it under Approve, and the fold lands it" };
          break;
        }
        /* each entry is stamped with its stage's own moment (stageAt), never the pass's clock */
        if (job === "ack") e = pendingEntry(order, code, stageAt(order, job, now));
        else if (job === "pay") e = payEntry(order, code, +((+order.paid || 0) - (+q.paid || 0)).toFixed(2), stageAt(order, job, now));
        else if (job === "move") e = handoverEntry(order, code, +order.moved || 0, stageAt(order, job, now));
        /* WHO ENDED IT is read off the event that ended it (24 Sep 2026): a cancellation of his own was
           noted in the committed row as the customer's, because only a decline was taken to be his */
        else if (job === "cancel") {
          const ended = [...(order.history || [])].reverse().find((x) => x && (x.status === "cancelled" || x.status === "declined"));
          e = cancelEntry(order, code, ended && ended.by === "desk" ? "desk" : "customer", stageAt(order, job, now));
        }
        if (!e) continue;
        e.orderId = o.id;   /* which order made it, so a rejection can be told to that order (rejectedOnOrder); never the username */
        while (used.has(e.at)) e.at = new Date(Date.parse(e.at) + 1).toISOString();
        /* counted only when it was actually appended; queueSale may move e.at to a free millisecond, so
           the marks are read off the entry AFTER it */
        if (await queueSale(env, e)) queued++;
        used.add(e.at);
        if (job === "ack") { mark.ledgerKey = e.orderKey; order.ledgerKey = e.orderKey; mark.ack = e.at; }
        else if (job === "pay") mark.paid = +(+order.paid || 0).toFixed(2);
        else if (job === "move") mark.moved = +(+order.moved || 0).toFixed(3);
        else if (job === "cancel") mark.cancel = e.at;
        if (!state) state = { state: "queued", why: "" };
      }
      if (Object.keys(mark).length) {
        const m = await site(env, "/desk/orders/" + encodeURIComponent(o.u) + "/" + encodeURIComponent(o.id), {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mark })
        });
        if (!m || !m.ok) { const why = "the mark could not be written back to the site" + (m ? " (http " + m.status + ")" : ""); failed.push({ id: o.id, why }); state = { state: "failed", why }; }
      }
    } catch (e) { const why = String((e && e.message) || e); failed.push({ id: o.id, why }); state = { state: "failed", why }; }   /* the reason travels, or a day is lost reading a log that says only "failed" */
    }
    /* written back only when it changed, so an order that waits costs one write and not one a minute */
    if (state && !(o.sync && o.sync.state === state.state && o.sync.why === state.why)) {
      try {
        await site(env, "/desk/orders/" + encodeURIComponent(o.u) + "/" + encodeURIComponent(o.id), {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mark: { sync: Object.assign({ at: now.toISOString() }, state) } })
        });
      } catch (e) { /* best effort: the next pass says it again */ }
    }
  }
  return Object.assign({ ok: true, queued }, unmapped.length ? { unmapped } : {},
    waiting.length ? { waiting } : {}, failed.length ? { failed } : {});
}

/* ---- A ROW HE REJECTED IS TOLD TO ITS ORDER (24 Sep 2026) -------------------------------------
 * A rejection drops the entry from every queue and refuses its `at` for good (src/worker.js), while
 * the order keeps the stage mark saying the ledger was told, so the card went on saying the order was
 * on its row. The rejection is written onto the order as its `sync`, which the card reads whatever the
 * marks say. THE MARK STAYS: cleared, the next pass would queue the same stage at the same moment
 * (stageAt), the drafter would skip it as decided, and the mark would be written again. Offering the
 * move again is a fold of its own. */
const REJECTED_WHAT = { Pending: "pending row", Payment: "payment entry", Handover: "handover entry", Cancellation: "cancellation entry" };
export async function rejectedOnOrder(env, entry, at) {
  /* the entry names the order and never its account (the ledger's side knows codes), so the account
     is found among the site's orders, closed ones included */
  const id = entry && entry.orderId;
  if (!id) return false;
  const all = await listOrders(env, true);
  const o = all.ok && all.orders.find((x) => x.id === id);
  if (!o) return false;
  const why = "its " + (REJECTED_WHAT[entry.status] || "entry") + " was rejected under Approve, so the book does not carry it";
  const r = await site(env, "/desk/orders/" + encodeURIComponent(o.u) + "/" + encodeURIComponent(o.id), {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mark: { sync: { state: "rejected", why, at } } })
  });
  return !!(r && r.ok);
}

/* ---- THE RETURN LEG (v764, his instruction of 21 Sep 2026) ------------------------------------
 * Every road built since v694 runs from the site to the book: the customer says what they paid, he
 * says what he handed over on the card, and the reconcile queues the entries. NOTHING RAN THE OTHER
 * WAY. So a payment he took in cash and entered on the desk reached the row and never the order: the
 * customer's page said nothing had been paid, and the site's hourly chase asked them for it again
 * every hour, day and night, until he noticed. That happened on 20 September and was patched by hand.
 *
 * THE ROW IS FOUND BY THE KEY THE ACKNOWLEDGEMENT WROTE, and among EVERY sale rather than the open
 * ones: the case this exists for is a row he has settled in full, which is precisely the row that has
 * left the open list. The figures are the engine's own readings, so the desk and the row cannot
 * disagree about what has been paid.
 */
export async function tellSite(env) {
  if (!env.SALT_LEDGER || !env.SALT_QUEUE) return { ok: true, told: 0 };
  let snap = null;
  try { snap = await env.SALT_LEDGER.prepare("SELECT v,stamped FROM snapshot WHERE one=1").first(); } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
  const v = (snap && snap.v) || null;
  if (!v) return { ok: true, told: 0 };
  if ((await env.SALT_QUEUE.get(TOLD_MARK)) === v) return { ok: true, told: 0, v };
  const r = await listOrders(env, false);
  if (!r.ok) return { ok: false, error: r.error };
  const book = await readBook(env.SALT_LEDGER).catch(() => null);
  const sales = (book && book.sales) || [];
  if (!sales.length) return { ok: true, told: 0, v };
  const byKey = new Map();
  for (const s of sales) byKey.set(POSITION_ENGINE.ovKey(s), s);
  let told = 0; const failed = [];
  for (const o of r.orders) {
    if (!o.ledgerKey || ["done", "cancelled", "declined"].includes(o.status)) continue;
    const row = byKey.get(o.ledgerKey);
    if (!row || row.cancelled) continue;
    const ledger = {};
    const paid = +(+POSITION_ENGINE.txPaid(row)).toFixed(2), moved = +(+POSITION_ENGINE.txEffDeliv(row)).toFixed(3);
    if (paid > (+o.paid || 0) + 0.004) ledger.paid = paid;
    if (moved > (+o.moved || 0) + 0.0004) ledger.moved = moved;
    if (!Object.keys(ledger).length) continue;
    const m = await site(env, "/desk/orders/" + encodeURIComponent(o.u) + "/" + encodeURIComponent(o.id), {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ledger })
    });
    if (!m || !m.ok) failed.push({ id: o.id, why: "the site would not take it" + (m ? " (http " + m.status + ")" : "") });
    else told++;
  }
  /* the mark moves only on a clean pass, so an order the site refused is tried again next minute
     rather than waiting for the next fold */
  if (!failed.length) await env.SALT_QUEUE.put(TOLD_MARK, v);
  return Object.assign({ ok: true, told, v }, failed.length ? { failed } : {});
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
  const newest = b.last || null, said = b.said || null, theirs = b.theirs || null;
  const mark = (await env.SALT_QUEUE.get(MARK)) || "", saidMark = (await env.SALT_QUEUE.get(SAID_MARK)) || "";
  const theirsMark = (await env.SALT_QUEUE.get(THEIRS_MARK)) || "";
  const placed = !!(newest && newest > mark), spoke = !!(said && said > saidMark);
  /* v760: A PAYMENT AND A WITHDRAWAL WOKE NOBODY. The site has written the moment of every change
     since v694 and the desk asked for it every minute and read only the placement, so somebody
     settling RM435 at midnight was invisible until he next opened the desk. The mark carries the
     moment and the word, so the banner can say which rather than guess. */
  /* v768: THE MOMENT ORDERS IT; THE WORD RIDES ALONG. `<iso>|<what>` compares as one string, and on
     a tie in the millisecond the WORD decided: a withdrawal landing in the same millisecond as a
     payment read as older, because "cancel" sorts under "pay", and woke nobody. Found by the full
     suite, where the two land in one millisecond often enough to matter, on a section that passed
     alone every time. The prefix is the order; anything else on the mark means something happened. */
  const momentOf = (m) => String(m || "").split("|")[0];
  const did = !!(theirs && (momentOf(theirs) > momentOf(theirsMark)
    || (momentOf(theirs) === momentOf(theirsMark) && theirs !== theirsMark)));
  if (!placed && !spoke && !did) return { ok: true, sent: 0 };
  /* the marks move whether or not the push reaches anybody: a wake that failed is not a reason to
     wake for the same line every minute until it does */
  if (placed) await env.SALT_QUEUE.put(MARK, newest);
  if (spoke) await env.SALT_QUEUE.put(SAID_MARK, said);
  let news = null;
  if (did) {
    await env.SALT_QUEUE.put(THEIRS_MARK, theirs);
    news = NEWS_WORD[String(theirs).split("|")[1]] || null;
    /* an hour on the key and ten minutes on the reading: two limits because KV's own expiry is not
       prompt enough to be the freshness rule, and a banner is written from what is true now. */
    if (news) await env.SALT_QUEUE.put(NEWS_KEY, JSON.stringify({ what: news, at: String(theirs).split("|")[0] }), { expirationTtl: 3600 });
  } else if (spoke && !placed) {
    /* 24 Sep 2026: A LINE IS NEWS OF ITS OWN. A wake sent because a customer wrote read "New customer
       order" or "is square", the wrong sentence v760 exists to stop. Not on a placement, whose first
       line is the note typed with it: there the new order is the news, and the banner already says so. */
    news = NEWS_WORD.said;
    await env.SALT_QUEUE.put(NEWS_KEY, JSON.stringify({ what: news, at: said }), { expirationTtl: 3600 });
  }
  const p = await sendPush(env, { tag: "orders", urgency: "high" });
  return { ok: true, sent: p.sent || 0, newest: placed ? newest : null, said: spoke ? said : null, did: did ? news : null };
}
