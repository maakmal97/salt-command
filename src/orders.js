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
import { readBook, draftRow, costFor, floorFor, usualFor, pricingOf, stageDigest, runDrafter, settlePre, withPending } from "./drafter.js";
import POSITION_ENGINE from "../engine/position.mjs";
import PRICING_ENGINE from "../engine/pricing.mjs";

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
/* S11 11.16: HIS WAKES NAME THE KIND OF ACT, and nothing else: never a code, a name or an amount. What
   they did is their word until he checks it, so a payment is what they SAY. The banner (public/sw.js)
   takes these as its title, and only in letters and spaces; a new order is its own title there. */
const NEWS_WORD = { pay: "A customer says they paid", cancel: "A customer cancelled", said: "A customer wrote" };
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
 * bulletin. A product's name is his to spend there; the phone warns and lets him.
 *
 * S13 13.2, HIS DECISION D12 OF 24 SEP 2026: THE WORDS IN MALAY TOO, before any Malay ships. The lists
 * below are the ones the suite pins against the book's names and the master's TIER_NAMES, and the desk's
 * siteSafe mirrors them. PERAK, EMAS AND GANGSA ARE ORDINARY WORDS: Perak is the state a delivery goes to,
 * "peluang emas" is a golden chance, and each is also the metal. So they name a level only after a word
 * that says level (tahap emas, peringkat perak); anywhere else the desk warns and asks him, and this lock
 * lets them through. A word that says member, customer, price or reward, or "now" and "up to", names a
 * level before emas or gangsa (ahli emas, anda kini gangsa) but not before perak, because Malay puts the
 * place after the noun: pelanggan Perak is Perak's customers, harga Perak the Perak price, naik ke Perak
 * going up to Perak. Between the two may stand up to four characters that are no letter, digit or stop
 * (Tahap: Emas, tahap-emas, a quote) and one of "your" or "new" (tahap anda: Perak). Platinum and
 * titanium are the same word in both languages.
 * A word with no Latin letter (Chinese, when he names any) is found as a substring, \b being blind to it,
 * and is never one character: gold is in the word for an amount and silver in the word for a bank. */
export const LEVEL_WORDS = ["ambassador", "titanium", "platinum", "gold", "silver", "bronze"];
export const LEVEL_WORDS_MS = ["emas", "perak", "gangsa"];
export const LEVEL_CUES_MS = ["tahap", "peringkat", "taraf", "pangkat", "kategori", "level", "tier"];
export const LEVEL_CUES_MS_NOT_PERAK = ["ahli", "keahlian", "pelanggan", "harga", "kad", "kelas", "status", "pakej", "ganjaran",
  "kini", "naik ke"];
export const LEVEL_BETWEEN_MS = ["anda", "awak", "kamu", "baru"];
export const PRODUCT_WORDS = ["salt", "oil", "candy", "rice", "spare", "garam", "minyak", "gula-gula", "gula", "beras"];
/** Which of `words` the text holds: whole words for Latin ones, a substring for any other script. */
export function wordsIn(text, words) {
  const t = String(text || "").toLowerCase();
  return words.filter((w) => /[a-z]/.test(w) ? new RegExp("\\b" + w + "\\b").test(t) : t.includes(w));
}
const SEP = "[^a-z0-9.,;!?]{1,4}";
const cued = (cues, words) => new RegExp("\\b(" + cues.join("|") + ")(" + SEP + "(" + LEVEL_BETWEEN_MS.join("|") + "))?"
  + SEP + "(" + words.join("|") + ")\\b", "i");
const LEVEL_CUED = cued(LEVEL_CUES_MS, LEVEL_WORDS_MS);
const LEVEL_CUED_NOT_PERAK = cued(LEVEL_CUES_MS_NOT_PERAK, LEVEL_WORDS_MS.filter((w) => w !== "perak"));
export function siteWords(text) {
  const t = String(text || "");
  if (/salt\s*command/i.test(t)) return "that names the desk, which a customer's page never does";
  if (/\b[A-Z]{2}\d{1,2}-[A-Z]{2,4}(-R)?\b/.test(t)) return "that carries a roster code, which a customer's page never shows";
  if (wordsIn(t, LEVEL_WORDS).length || LEVEL_CUED.test(t) || LEVEL_CUED_NOT_PERAK.test(t)) return "that names a level, which a customer's page never does";
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

/** Every open order (or all with `all`), each with the desk code the username maps to; with `links`, how many
 *  associate links wait in Salt Admin as well (S9 9.8), a count the desk's page shows and nothing more. */
export async function listOrders(env, all, links) {
  const q = [all ? "all=1" : "", links ? "links=1" : ""].filter(Boolean).join("&");
  const r = await site(env, "/desk/orders" + (q ? "?" + q : ""));
  if (!r) return { ok: false, error: "the order relay is not configured (STMT_SITE binding and STMT_DESK_KEY secret)" };
  const b = await r.json().catch(() => ({}));
  if (!r.ok || !b.ok) return { ok: false, error: b.error || ("the statements site answered http " + r.status) };
  const users = await usersMap(env);
  return Object.assign({ ok: true, orders: (b.orders || []).map((o) => Object.assign({ code: users[o.u] || null }, o)) },
    links && Number.isInteger(b.links) ? { links: b.links } : {});
}

/** S6 6.6: every claim against an account still waiting (or all with `all`), each with the desk code its username maps
 *  to. Never an order: it is read beside them and drawn on its own card. */
export async function listClaims(env, all) {
  const r = await site(env, "/desk/claims" + (all ? "?all=1" : ""));
  if (!r) return { ok: false, error: "the order relay is not configured (STMT_SITE binding and STMT_DESK_KEY secret)" };
  const b = await r.json().catch(() => ({}));
  if (!r.ok || !b.ok) return { ok: false, error: b.error || ("the statements site answered http " + r.status) };
  const users = await usersMap(env);
  return { ok: true, claims: (b.claims || []).map((c) => Object.assign({ code: users[c.u] || null }, c)) };
}

/** One order, closed or open, with its code: the routes below act on an order by its id alone. */
export async function findOrder(env, id) {
  const r = await listOrders(env, true);
  if (!r.ok) return { ok: false, status: 503, error: r.error };
  const o = r.orders.find((x) => x.id === id);
  return o ? { ok: true, order: o } : { ok: false, status: 404, error: "no such order" };
}

/* ---- WHAT THE CUSTOMER'S PAGE SAYS OF EACH STATE (S11 11.1) ------------------------------------
 * The card says what the customer is looking at before his yes. These are the page's own words, the state
 * chip (oWord) and the start of the sentence under it (oWhen), in stmt/page.js's CLIENT_JS: copied, because
 * they live inside a template literal the desk cannot import, and HELD TOGETHER by the suite, so the day the
 * page's words change this turns it red until it follows. Since the Counter's stage 5 (S5 5.3) they are the
 * customer's own words. Each is [chip, sentence], and where the chip reads by the mode or by whose the
 * cancellation was, [collect or theirs, sentence, deliver or his, sentence]. No figure: the card draws the figures. */
export const CUSTOMER_SEES = {
  placed: ["Sent", "Waiting to be confirmed"],
  acknowledged: ["Confirmed", "Confirmed on"],
  ready: ["Ready to collect", "Ready to collect, since", "Ready to deliver", "Ready to deliver, since"],
  done: ["Complete", "Your order is now complete"],
  declined: ["Not taken", "Not taken"],   /* S11 11.7: his reason and "Nothing is owed" follow on the page */
  cancelled: ["Cancelled by you", "Cancelled before anything moved", "Cancelled by us", "Cancelled by us"]
};
export function toldOf(o) {
  const w = CUSTOMER_SEES[o && o.status];
  if (!w) return "";
  const end = (o.history || []).filter((x) => x && x.status === o.status).slice(-1)[0];
  const alt = o.status === "ready" ? o.mode === "deliver" : o.status === "cancelled" && !!end && end.by === "desk";
  /* their own cancellation with money paid opens on the refund, which is a figure */
  const word = w[alt ? 2 : 0], line = o.status === "cancelled" && !alt && (+o.paid || 0) > 0 ? word : w[alt ? 3 : 1];
  return "They see " + word + (line.indexOf(word) === 0 ? "" : ": " + line) + ".";   /* a sentence opening on the chip adds nothing */
}

/* ---- THE ROW BEFORE HIS YES (S11 11.1, his decision D6 of 24 Sep 2026) ---------------------------
 * The order card draws the pending row an Accept would make BEFORE he taps it: drafted by the drafter,
 * against the mirror, from exactly the entry an Accept queues, and STORED NOWHERE (no draft, no queue
 * entry, no mark on the order). It is not /draft-now?dry=1, which drafts the queue; this drafts one
 * order that is on no queue. Back come the row and the drafter's own flags, the cost, margin and floor
 * the drafter reads, the customer's usual and their card, what their page says, the pricing version,
 * and the digest an Accept sends back to prove it answered this row. */
const rm = (n) => "RM " + (Math.abs(n - Math.round(n)) < 0.005 ? String(Math.round(n)) : n.toFixed(2));
const chargeOf = (b) => (b && typeof b.delivery === "number" && Number.isFinite(b.delivery) && b.delivery >= 0 ? +b.delivery.toFixed(2) : null);
/* their card at this size: the desk's own cardQuote, carried in the pricing snapshot (tools/book.mjs), read and never worked out */
function cardAt(pricing, code, product, qty) {
  const snap = pricing && pricing.byProduct && pricing.byProduct[product];
  if (!snap || !snap.cards) return { card: null, cardNote: "the pricing snapshot carries no cards yet: the next re-seed brings them" };
  const fixed = (snap.ladder || []).some((r) => r && r.fixed);
  const hit = (snap.cards[code] || []).find((x) => Math.abs(x[0] - qty) < 0.009);
  if (hit) {
    const held = ((pricing.tierOf || {})[code] || {})[product];
    const level = fixed ? null : PRICING_ENGINE.levelAt(held, qty, pricing.profileRule || { smallUpTo: 1, bigFrom: 3 });
    return { card: hit[1], cardNote: fixed ? "the board, one price for everybody" : (level ? level : "their card") + " at " + qty + " unit" };
  }
  if (!snap.cards[code]) return { card: null, cardNote: "no tier is held or proposed for them on " + product + ", so there is no card" };
  return { card: null, cardNote: qty + " unit is not a size on their board, so there is no card at it" };
}
async function previewAck(env, o, code, delivery, now) {
  if (!env.SALT_LEDGER) return { ok: false, status: 503, error: "the desk has no ledger binding, so no row can be drafted" };
  /* the charge is the site's own rule (decideDesk): typed for a delivery, nought for a collection */
  const agreed = Object.assign({}, o, { delivery: o.mode === "deliver" ? (delivery || 0) : 0 });
  const entry = pendingEntry(agreed, code, now);
  entry.orderId = o.id;
  const book = await readBook(env.SALT_LEDGER);
  const d = draftRow(entry, book);
  if (d.skip) return { ok: false, status: 409, error: "the drafter would not draft it: " + d.skip };
  const pricing = await pricingOf(book);
  const product = o.product || "salt", qty = +o.qty, goods = +(+o.total).toFixed(2);
  const priced = costFor(book, product), fl = floorFor(book, product, qty);
  const cost = priced.cost == null ? null : { unit: priced.cost, total: +(priced.cost * qty).toFixed(2), source: priced.source };
  return Object.assign({ ok: true, stage: "ack", id: o.id, entry, row: d.row, flags: d.flags, reasoning: d.reasoning,
    quote: goods, delivery: agreed.delivery, cost,
    margin: cost && goods > 0 ? { rm: +(goods - cost.total).toFixed(2), pct: +((goods - cost.total) / goods * 100).toFixed(1) } : null,
    floor: fl ? { rm: fl.floor, at: fl.at, exact: fl.exact } : null,
    usual: usualFor(book, d.row), told: toldOf(o), pricing, hash: await stageDigest("ack", entry, d, pricing) },
    cardAt(book.pricing, code, product, qty));
}
/** POST /orders/<id>/preview {delivery}: the pending row an Accept would make now. Stores nothing. */
export async function previewOrder(env, id, body, now) {
  const f = await findOrder(env, id);
  if (!f.ok) return f;
  const o = f.order;
  if (!o.code) return { ok: false, status: 409, error: "no desk code is mapped to this account yet: publish the statements again" };
  const again = o.status !== "placed" && ROWED_ON_SITE.includes(o.status) && !!(await rejectedOf(env.SALT_LEDGER, id, "ack"));
  if (o.status !== "placed" && !again) return { ok: false, status: 409, error: "this order is " + o.status + ", so its pending row is not Accept's to make" };
  /* offered again (11.13), the charge is the one already on the order: the customer was told it */
  const p = await previewAck(env, o, o.code, again ? (+o.delivery || 0) : chargeOf(body), now || new Date());
  if (!p.ok) return p;
  delete p.entry;   /* what Accept will queue is Accept's to build again; the card holds the digest */
  return Object.assign(p, { again, chargeChosen: again || o.mode !== "deliver" || chargeOf(body) != null });
}

/* ---- ACCEPT: HIS YES IS THE ROW'S APPROVAL, ONLY ON AN EXACT MATCH (S11 11.11, his decision D6) --------
 * Accept answers a preview. It drafts the pending row again from the order as it stands and refuses if the
 * digest is not the one the card drew, so what he looked at is what he said yes to. Then it records the yes
 * (a pre-approval, migrations/0011), queues the entry ITSELF, and runs the drafter, which approves the row
 * where it drafts it only if the real draft equals the preview in every field, every flag and the pricing
 * version. ONLY THEN IS THE ORDER MOVED ON THE SITE (ackOnApproval), so the customer is told Acknowledged
 * about a row the book will carry. Anything different waits under Approve, marked, and the order stays
 * Placed; approving it there moves the order then. The reconcile is still the one road for every stage the
 * SITE makes; this is the one it cannot make, because the row has to exist before the order moves. */
const livePre = async (db, orderId, stage) => {
  try { return await db.prepare("SELECT * FROM preapproval WHERE order_id=?1 AND stage=?2 AND status IN ('waiting','differs','applied') ORDER BY at DESC").bind(orderId, stage).first(); }
  catch (e) { return null; }
};
const preById = async (db, id) => db.prepare("SELECT * FROM preapproval WHERE id=?1").bind(id).first();
/* a newer yes on the same order and stage replaces one still waiting for a row the SITE makes: the newest is what he
   last said. Never one carrying its own entry (cash taken, a move offered again): each of those is a row of its own,
   and voided before it was queued it was never booked, the site already counting the cash. S6 fix: nor a claim's.
   Each claim is a row of its own and its yes answers that claim alone: a second claim's Received, given before the
   first claim's row was drafted, voided the first yes, and that row could then never be booked. */
async function recordPre(db, p) {
  const id = p.order_id + "|" + p.stage + "|" + p.at;
  await db.prepare("UPDATE preapproval SET status='void', decided_at=?1 WHERE order_id=?2 AND stage=?3 AND status='waiting' AND entry IS NULL AND json_extract(shown,'$.figures.claim') IS NULL").bind(p.at, p.order_id, p.stage).run();
  await db.prepare("INSERT INTO preapproval (id,order_id,u,stage,hash,shown,entry,status,tapped_by,at) VALUES (?1,?2,?3,?4,?5,?6,?7,'waiting',?8,?9)")
    .bind(id, p.order_id, p.u || null, p.stage, p.hash, JSON.stringify(p.shown || {}), p.entry ? JSON.stringify(p.entry) : null, p.by || null, p.at).run();
  return id;
}
const markOrder = (env, u, id, mark) => site(env, "/desk/orders/" + encodeURIComponent(u) + "/" + encodeURIComponent(id),
  { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mark }) });

/** An approved pending row the desk queued moves its order: the row's key and moment are marked first, so no pass
 *  of the reconcile can queue a second pending row, and then the order is acknowledged with the charge it carries.
 *  Until both are done the yes is not `acked_at`, and the desk's pass tells the order again every minute (deskPass). */
export async function ackOnApproval(env, pre) {
  const entry = typeof pre.entry === "string" ? JSON.parse(pre.entry) : pre.entry;
  let shown = {};
  try { shown = typeof pre.shown === "string" ? JSON.parse(pre.shown) : (pre.shown || {}); } catch (e) { shown = {}; }
  const m = await markOrder(env, pre.u, pre.order_id, { ack: entry.at, ledgerKey: entry.orderKey, sync: { state: "queued", why: "", at: new Date().toISOString() } });
  if (!m || !m.ok) return { ok: false, error: "the row is approved but its mark could not be written to the order" + (m ? " (http " + m.status + ")" : "") };
  /* an order already agreed (a row offered again) has nothing to move; one that ended meanwhile refuses the move,
     and its Cancellation then follows the approved row, as any withdrawal of an agreed order does */
  const r = shown.from !== "placed" ? { ok: true }
    : await moveOrder(env, pre.u, pre.order_id, { status: "acknowledged", delivery: +(entry.payload && entry.payload.delivery) || 0 });
  /* told once the move is made, or refused for good: the order ended, or was moved already */
  if ((r.ok || r.status === 409) && env.SALT_LEDGER)
    await env.SALT_LEDGER.prepare("UPDATE preapproval SET acked_at=?1 WHERE id=?2").bind(new Date().toISOString(), pre.id).run();
  return r;
}

/** POST /orders/<id>/accept {delivery, hash}. Returns { ok, approved, differs?, waiting?, order?, draft, drafted? }. */
export async function acceptOrder(env, id, body, by, now) {
  const at = now || new Date();
  const f = await findOrder(env, id);
  if (!f.ok) return f;
  const o = f.order, db = env.SALT_LEDGER;
  if (!o.code) return { ok: false, status: 409, error: "no desk code is mapped to this account yet: publish the statements again" };
  if (!db) return { ok: false, status: 503, error: "the desk has no ledger binding, so no row can be drafted" };
  if (!body || typeof body.hash !== "string") return { ok: false, status: 400, error: "Accept answers a preview: send the digest the preview gave" };
  /* one pending row an order: a yes already given is followed, never given twice */
  const live = await livePre(db, id, "ack");
  if (live && live.status === "applied") return o.status === "placed"
    ? Object.assign({ approved: true, again: true, draft: live.draft_id }, await ackOnApproval(env, live))   /* its move failed before: again */
    : { ok: true, approved: true, again: true, draft: live.draft_id, order: o };
  if (live) return { ok: false, status: 409, error: live.status === "differs" ? "its row differs from what you saw and waits under Approve" : "its row is being drafted: look again in a moment" };
  const again = o.status !== "placed" && ROWED_ON_SITE.includes(o.status) && !!(await rejectedOf(db, id, "ack"));
  if (o.status !== "placed" && !again) return { ok: false, status: 409, error: "this order is " + o.status + ", so there is nothing to accept" };
  const delivery = again ? (+o.delivery || 0) : chargeOf(body);
  if (o.mode === "deliver" && delivery == null) return { ok: false, status: 400, error: "choose the delivery charge first" };
  const pv = await previewAck(env, o, o.code, delivery, at);
  if (!pv.ok) return pv;
  const entry = pv.entry;
  delete pv.entry;
  if (pv.hash !== body.hash) return { ok: false, status: 409, differs: true, error: "the row has changed since the card drew it: look at it again before you accept", preview: pv };
  const preId = await recordPre(db, { order_id: id, u: o.u, stage: "ack", hash: pv.hash, entry, at: at.toISOString(), by,
    shown: { from: o.status, row: pv.row, flags: pv.flags, pricing: pv.pricing } });
  await queueSale(env, entry);   /* which may move entry.at to a free millisecond */
  await db.prepare("UPDATE preapproval SET entry_at=?1, entry=?2 WHERE id=?3").bind(entry.at, JSON.stringify(entry), preId).run();
  const drafted = await runDrafter(env);
  /* a pass that drafted it before the pre-approval knew its id tests it here instead, on the row as stored */
  let pre = await preById(db, preId);
  if (pre.status === "waiting") { await settlePre(db, pre, await readBook(db)); pre = await preById(db, preId); }
  const out = { draft: entry.at, drafted };
  if (pre.status === "applied") return Object.assign(out, { approved: true }, await ackOnApproval(env, pre));
  if (pre.status === "differs") {
    await markOrder(env, o.u, id, { sync: { state: "waiting", why: "its pending row differs from what you saw, so it waits under Approve; approving it there moves the order", at: new Date().toISOString() } });
    return Object.assign(out, { ok: true, approved: false, differs: true });
  }
  return Object.assign(out, { ok: true, approved: false, waiting: true });
}

/* ---- COLLECTED, CASH RECEIVED, RECEIVED: A YES FOR A ROW NOT DRAFTED YET (S11 11.12, D6) ----------
 * Each later stage is one tap too. The tap builds the entry exactly as it will be queued (the reconcile's own
 * builder, stamped as the reconcile stamps it), drafts it now against the book, or, before the first row has
 * landed, against the book as it will stand when it does (withPending), and records the digest of that draft
 * as his yes. The drafter spends it when the real row is drafted, only if equal: the kind, party, target,
 * date, figures and every flag. So a stage that waits on the first row NEVER WAITS SILENTLY: it is booked
 * when that row lands, and the card can say so ("waits": true). The pricing version is not part of it,
 * because the first row landing is itself a fold. */
async function stagePreview(env, o, stage, entry) {
  const db = env.SALT_LEDGER;
  const book = await readBook(db);
  const open = (book.state && book.state.OPEN && book.state.OPEN.byKey) || {};
  let against = book, waits = false;
  if (!open[entry.payload.orderKey]) {
    /* not on the book yet: the pending row, as it was drafted, is what will land */
    const ack = o.queued && o.queued.ack;
    const r = ack ? await db.prepare("SELECT row,status FROM draft WHERE id=?1").bind(ack).first() : null;
    if (!r || r.status === "rejected") return { ok: false, status: 409, error: "its pending row " + (r ? "was rejected" : "is not drafted yet") + ", so there is no row for this to amend" };
    against = withPending(book, JSON.parse(r.row));
    waits = true;
  }
  const d = draftRow(entry, against);
  if (d.skip) return { ok: false, status: 409, error: "the drafter would not draft it: " + d.skip };
  return { ok: true, waits, d, hash: await stageDigest(stage, entry, d, null) };
}
const yesWords = (waits) => (waits ? "Booked when the first row lands" : "Booked as it is drafted");
async function stageTap(env, id, body, by, now, stage, build) {
  const at = now || new Date();
  const f = await findOrder(env, id);
  if (!f.ok) return f;
  const o = f.order, db = env.SALT_LEDGER;
  if (!o.code) return { ok: false, status: 409, error: "no desk code is mapped to this account yet: publish the statements again" };
  if (!db) return { ok: false, status: 503, error: "the desk has no ledger binding, so no row can be drafted" };
  if (!ROWED_ON_SITE.includes(o.status)) return { ok: false, status: 409, error: "this order is " + o.status + ", so there is nothing to record against it" };
  if (!o.ledgerKey) return { ok: false, status: 409, error: "its pending row is not queued yet: accept it first" };
  const b = build(o, at);
  if (b.again) return againOrder(env, id, { stage: b.again }, by, now);
  if (b.error) return { ok: false, status: b.status || 400, error: b.error };
  const pv = await stagePreview(env, o, stage, b.entry);
  if (!pv.ok) return pv;
  /* a row that leaves money owed back is never approved on a tap: it waits under Approve with the drafter's own flags */
  if (b.hold) {
    const r = b.site ? await moveOrder(env, o.u, id, b.site) : { ok: true, order: o };
    if (!r.ok) return r;
    return { ok: true, order: r.order, preapproval: { stage, waits: pv.waits, held: true, says: "It waits under Approve: " + b.hold, flags: pv.d.flags } };
  }
  const preId = await recordPre(db, { order_id: id, u: o.u, stage, hash: pv.hash, entry: b.queueIt ? b.entry : null, at: at.toISOString(), by,
    shown: { from: o.status, figures: b.shown, flags: pv.d.flags, waits: pv.waits } });
  if (b.pin) await db.prepare("UPDATE preapproval SET entry_at=?1 WHERE id=?2").bind(b.pin, preId).run();
  /* the site hears what he did (a handover, cash taken), after the yes is on file, so no pass can draft the row first */
  let push = null;
  if (b.site) {
    const r = await moveOrder(env, o.u, id, b.site);
    push = r.push || null;   /* S6: the wake it sent, so the card can say whether their phone heard */
    if (!r.ok) {
      await db.prepare("UPDATE preapproval SET status='void', decided_at=?1 WHERE id=?2").bind(new Date().toISOString(), preId).run();
      return r;
    }
    o.moved = r.order.moved; o.paid = r.order.paid; o.status = r.order.status;
  }
  /* a row already drafted (a payment of theirs, drafted a minute before his Received) is tested now, and only that
     row: a stage the site makes is queued after this, so any row of its stage drafted before it is an older one */
  const pre = await preById(db, preId);
  const spent = pre.status === "waiting" && b.pin ? await settlePre(db, pre, await readBook(db)) : null;
  return { ok: true, order: o, push, preapproval: { stage, waits: pv.waits, says: yesWords(pv.waits), flags: pv.d.flags, spent: spent || null,
    draft: spent ? (await preById(db, preId)).draft_id : null } };
}
const ROWED_ON_SITE = ["acknowledged", "ready", "done"];

/** POST /orders/<id>/handed {qty, close}: Collected or Delivered, in the order's own mode, the running total handed over. */
export async function handedOrder(env, id, body, by, now) {
  const rej = await rejectedOf(env.SALT_LEDGER, id, "move");
  return stageTap(env, id, body, by, now, "move", (o, at) => {
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
    /* A CLOSE UNDER WHAT THEY HAVE PAID leaves money he holds that is theirs, and nothing books that as a refund yet (the
       fold raises one only for a cancelled row): so no tap approves it, and it waits under Approve for him */
    const over = closing ? +((+o.paid || 0) - (+entry.total + (+o.delivery || 0))).toFixed(2) : 0;
    const hold = over > 0.004 ? "they have paid " + rm(+o.paid || 0) + ", " + rm(over) + " more than it now comes to, and the book carries no refund for that" : "";
    return { entry, hold, site: { handover }, shown: { units: qty, how: o.mode === "deliver" ? "delivered" : "collected", close: closing } };
  });
}

/** POST /orders/<id>/received {amount}: the payment they recorded is in his bank. The site already counts it. */
export async function receivedOrder(env, id, body, by, now) {
  if (body && body.covered === true) return notFoundOrder(env, id, body, now, true);   /* S6 fix: on the book already */
  const rej = await rejectedOf(env.SALT_LEDGER, id, "pay");
  /* their payment may be drafted already (the reconcile queues it within the minute once the row is on the book),
     and then that draft's own entry is the one his yes answers */
  let queued = [], shut = new Set(), onRows = {};
  if (env.SALT_LEDGER) {
    const rs = await env.SALT_LEDGER.prepare("SELECT id,entry FROM draft WHERE status='pending' AND entry LIKE ?1 ORDER BY id DESC").bind('%"orderId":"' + id + '"%').all();
    queued = (rs.results || []).map((r) => { try { return JSON.parse(r.entry); } catch (e) { return null; } })
      .filter((e) => e && e.orderId === id && e.status === "Payment" && !e.counter);
    /* S6 11.14: a claim's entry filed not found never lands, so that claim is not received after it */
    const rj = await env.SALT_LEDGER.prepare("SELECT id FROM draft WHERE status='rejected' AND decided_by='notfound' AND entry LIKE ?1").bind('%"orderId":"' + id + '"%').all();
    shut = new Set((rj.results || []).map((r) => r.id));
    onRows = await acctInFlight(env.SALT_LEDGER, null);
  }
  return stageTap(env, id, body, by, now, "pay", (o, at) => {
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
      const onRow = onRows[o.ledgerKey] || 0, due = +((+o.total + (+o.delivery || 0)) - (+o.paid || 0)).toFixed(2);
      if (onRow > 0.004 && p.amount > due - onRow + 0.004) return { status: 409, error: "RM " + onRow.toFixed(2) + " sent against their account is booked on this order's row and not folded yet, so this claim would pay it twice: answer it once the fold lands" };
      const site = { verdict: { kind: "received", claim: p.at, amount: p.amount } }, shown = { amount: p.amount, claim: p.at };
      const own = queued.find((e) => e.at === p.queued) || claimEntry(o, p);
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
  });
}

/* ---- NOT FOUND (S6 11.14, his decision D7) ---------------------------------------------------------------------
 * What they say they sent has not arrived. The claim's own entry is FILED REJECTED FIRST, under the id it has or will
 * have (the claim's moment), and dropped from every queue, so no pass of the drafter can draft it after; only then is
 * the site told, as one event that takes the claim off what they say they sent and its entry's name off the claim (the
 * order book's; never on the kv road). The site wakes them with its kind. Paid never moved, so nothing lowers it. */
const FILED = { notfound: "Not found: what they say they sent has not arrived, so nothing reaches the book.",
  covered: "Received, on the book already: money he recorded another way carries it, so this entry never lands." };
async function fileNotFound(env, at, entry, now, how) {
  const db = env.SALT_LEDGER, when = (now instanceof Date ? now : new Date()).toISOString(), by = how || "notfound";
  await db.prepare("INSERT OR IGNORE INTO draft (id,status,collection,entry,row,reasoning,flags,party,drafter,drafted_at,decided_at,decided_by) "
    + "VALUES (?1,'rejected','sales',?2,'{}',?3,'[]',?4,'orders',?5,?5,?6)")
    .bind(at, JSON.stringify(entry), FILED[by], entry.party || null, when, by).run();
  await db.prepare("UPDATE draft SET status='rejected', decided_at=?1, decided_by=?3 WHERE id=?2 AND status='pending'").bind(when, at, by).run();
  const cur = await db.prepare("SELECT status FROM draft WHERE id=?1").bind(at).first();
  return !!cur && cur.status === "rejected";
}
/** POST /orders/<id>/notfound {claim, amount}: a claim of theirs on an order has not arrived. S6 fix: `covered` (from
 *  /received) is Received, on the book already: money he recorded another way carries it, so its entry is filed the same
 *  way and never lands, and the site hears Received, which it takes only where the claim is more than is still owed. */
export async function notFoundOrder(env, id, body, now, covered) {
  const f = await findOrder(env, id);
  if (!f.ok) return f;
  const o = f.order, db = env.SALT_LEDGER;
  if (!db) return { ok: false, status: 503, error: "the desk has no ledger binding, so the claim's row cannot be filed" };
  const amount = body && body.amount;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return { ok: false, status: 400, error: "say which figure was not found" };
  const waiting = (o.payments || []).filter((p) => p && p.claim === "waiting");
  const p = body.claim ? waiting.find((x) => x.at === body.claim) : waiting[0];
  if (!p) return { ok: false, status: 409, error: "that claim of theirs is not waiting any more: look again" };
  if (Math.abs(p.amount - amount) > 0.004) return { ok: false, status: 409, error: "RM " + p.amount.toFixed(2) + " they say they sent is waiting here, not RM " + amount.toFixed(2) };
  /* queued, its entry is named on the claim; not yet, the reconcile would give it the claim's own moment, unless another
     stage's entry already holds that moment, which is then left alone */
  let at = p.queued || p.at;
  if (!p.queued) {
    const d = await db.prepare("SELECT entry FROM draft WHERE id=?1").bind(at).first();
    let q = null; try { q = ((await env.SALT_QUEUE.get("q:" + DEVICE, "json")) || { queue: [] }).queue.find((e) => e && e.at === at) || null; } catch (e) { q = null; }
    const theirs = (e) => !e || e.claimOf === p.at;
    let de = null; try { de = d ? JSON.parse(d.entry) : null; } catch (e) { de = {}; }
    if (!theirs(de) || !theirs(q)) at = null;
  }
  /* the site's own test, asked first, so nothing is filed for a claim it would refuse */
  if (covered && !(p.amount > +((+o.total + (+o.delivery || 0)) - (+o.paid || 0)).toFixed(2) + 0.004))
    return { ok: false, status: 409, error: "the order still owes what this claim is: answer it Received" };
  if (at && !(await fileNotFound(env, at, Object.assign(claimEntry(o, p), { at }), now, covered ? "covered" : "notfound")))
    return { ok: false, status: 409, error: "its row is decided already, so it cannot be filed " + (covered ? "as on the book already" : "not found") };
  if (at) await dropQueued(env, [at]);
  return moveOrder(env, o.u, id, { verdict: covered ? { kind: "received", covered: true, claim: p.at, amount: p.amount } : { kind: "notfound", claim: p.at, amount: p.amount } });
}
/** POST /claims/<id>/notfound {amount}: a claim against the account has not arrived. Nothing was queued for it. */
export async function notFoundClaim(env, id, body) {
  const f = await findClaim(env, id);
  if (!f.ok) return f;
  const c = f.claim, amount = body && body.amount;
  if (typeof amount !== "number" || !Number.isFinite(amount) || Math.abs(amount - c.amount) > 0.004)
    return { ok: false, status: 409, error: "RM " + (+c.amount).toFixed(2) + " they say they sent is waiting here" + (typeof amount === "number" ? ", not RM " + amount.toFixed(2) : "") };
  /* S6 fix: rows his Received booked for it, the site not having heard, are money the book carries: never not found */
  if (env.SALT_LEDGER && (await claimBooked(env.SALT_LEDGER, id))) return { ok: false, status: 409, error: "its rows are booked: tap Received again so they are told" };
  return moveClaim(env, c.u, id, { verdict: { kind: "notfound", amount: c.amount } });
}
/* ---- A CLAIM AGAINST THE ACCOUNT, ROW BY ROW, AND ONE TAP (S6 11.15, his decisions D6 and D7) ---------------------------
 * What they say they sent against the account settles the rows they owe on, oldest first: the ENGINE'S allocation
 * (claimAlloc in engine/position.mjs), drawn on his card row by row before his yes. Each row is a Fulfilment of its own,
 * drafted here against the mirror exactly as it will be queued and stored nowhere, and the digest of all of them is
 * what the card sends back. ONE TAP APPROVES EXACTLY THOSE ROWS by the stage 11 road: drafted again, and only if the
 * digest is the one he was shown is each queued with a yes of its own carrying its entry, spent by the drafter only on
 * an exact match; then the site hears Received. Different, the tap is refused with the rows as they now stand and
 * nothing is queued. A figure more than the rows owe is never approved on a tap: the card says what is left over. */
const hex = async (s) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");
/* S6 fix: MONEY ALREADY ON ITS WAY TO A ROW, by the row's key. What a claim against the account has booked on it, pending or
   approved, that no fold has landed yet; and with the site's orders, what the site knows of an order beyond its row's
   cash (a claim waiting, one received, cash he took: none of them folded yet). An account claim takes each row as owing
   that much less, and an order claim's Received refuses money a claim against the account booked on its row, so the same
   money is never booked on a row twice. */
async function acctInFlight(db, except) {
  const by = {};
  const rs = await db.prepare("SELECT entry FROM draft WHERE (status='pending' OR (status='approved' AND committed_at IS NULL)) AND entry LIKE ?1").bind('%"claimId":"%').all();
  for (const r of rs.results || []) {
    let e = null; try { e = JSON.parse(r.entry); } catch (x) { e = null; }
    const k = e && e.claimId && e.claimId !== except && e.payload && e.payload.orderKey;
    if (k) by[k] = +((by[k] || 0) + (+e.payload.cash || 0)).toFixed(2);
  }
  return by;
}
async function inFlight(env, db, c, sales) {
  const all = await listOrders(env, true);
  if (!all.ok) return null;
  const by = await acctInFlight(db, c.id), cash = {};
  for (const s of sales) { const k = POSITION_ENGINE.ovKey(s); cash[k] = (cash[k] || 0) + (+s.cash || 0); }
  for (const o of all.orders) {
    if (o.u !== c.u || !o.ledgerKey || ["cancelled", "declined"].includes(o.status)) continue;
    const more = +((+o.paid || 0) + (+o.claimed || 0) - (cash[o.ledgerKey] || 0)).toFixed(2);
    if (more > 0.004) by[o.ledgerKey] = +((by[o.ledgerKey] || 0) + more).toFixed(2);
  }
  return by;
}
function claimRows(book, c, fl) {
  const sales = (book.sales || []).map((s) => { const on = fl && fl[POSITION_ENGINE.ovKey(s)];
    return on ? Object.assign({}, s, { cash: +((+s.cash || 0) + on).toFixed(2) }) : s; });
  const alloc = POSITION_ENGINE.claimAlloc(sales, c.code, +c.amount);
  const date = klDate(new Date(c.at)), method = c.method + (c.account ? " via " + c.account : "");
  const entries = alloc.rows.map((r, i) => ({ at: new Date(Date.parse(c.at) + i).toISOString(), type: "SELL", party: r.party, qty: 0, total: r.rm,
    status: "Payment", by: "customer", claim: true, claimId: c.id,
    raw: "Payment of RM " + r.rm + " on " + r.party + ", against the account (claim " + c.id + "), by " + method,
    payload: { mode: "amend", kind: "Fulfilment", direction: "SELL", party: r.party, rid: r.rid || null, orderKey: r.key, orderCode: null, linkTo: null,
      assoc: null, downstream: null, date, qty: 0, total: 0, cash: r.rm, kg: 0, note: "Paid on the statements site against the account, by " + method + "." } }));
  return { alloc, entries };
}
/* S6 fix: WHAT HIS RECEIVED ALREADY BOOKED FOR A CLAIM. A yes of his on file for any of its rows (queued, drafted, marked
   or spent), or a row of it approved, means Received was given and those rows are the ones he said yes to. A retry after
   the site did not hear tells the site again and queues nothing, however the allocation now falls: a fold since may have
   moved it, and a fresh one booked rows the card never drew, and more than the claim. */
async function claimBooked(db, id) {
  let pres = [];
  try { pres = (await db.prepare("SELECT shown,status FROM preapproval WHERE order_id=?1 AND stage='pay' AND status IN ('waiting','differs','applied') ORDER BY at").bind(id).all()).results || []; }
  catch (e) { pres = []; }   /* a store before migrations/0011 */
  const appr = (await db.prepare("SELECT id FROM draft WHERE status='approved' AND entry LIKE ?1").bind('%"claimId":"' + id + '"%').all()).results || [];
  if (!pres.length && !appr.length) return null;
  return pres.map((p) => { let sh = {}; try { sh = JSON.parse(p.shown || "{}") || {}; } catch (e) { sh = {}; }
    return { key: sh.row || null, date: sh.date || null, owed: sh.owed != null ? sh.owed : null, rm: +((sh.figures || {}).amount) || 0, flags: sh.flags || [], state: p.status }; });
}
/** POST /claims/<id>/preview: the rows the claim settles, drafted, stored nowhere; or, once Received booked them, those rows. */
export async function claimPreview(env, id) {
  const f = await findClaim(env, id);
  if (!f.ok) return f;
  const c = f.claim, db = env.SALT_LEDGER;
  if (!c.code) return { ok: false, status: 409, error: "no desk code is mapped to this account yet: publish the statements again" };
  if (!db) return { ok: false, status: 503, error: "the desk has no ledger binding, so no row can be drafted" };
  if (c.state !== "waiting") return { ok: false, status: 409, error: "that claim is answered already" };
  const booked = await claimBooked(db, c.id);
  if (booked) return { ok: true, claim: c, rows: booked, left: 0, booked: true, own: [] };
  const book = await readBook(db);
  const fl = await inFlight(env, db, c, book.sales || []);
  if (!fl) return { ok: false, status: 503, error: "the site's orders could not be read, so the rows it settles cannot be drawn" };
  const { alloc, entries } = claimRows(book, c, fl);
  const rows = [], own = [];
  for (let i = 0; i < entries.length; i++) {
    const d = draftRow(entries[i], book);
    if (d.skip) return { ok: false, status: 409, error: "the row of " + (alloc.rows[i].date || "no date") + " would not draft: " + d.skip };
    const digest = await stageDigest("pay", entries[i], d, null);
    rows.push(Object.assign({}, alloc.rows[i], { flags: d.flags || [] }));
    own.push({ entry: entries[i], digest, flags: d.flags || [] });
  }
  const hash = await hex(JSON.stringify({ claim: c.id, amount: +c.amount, left: alloc.left, rows: own.map((x) => x.digest) }));
  return { ok: true, claim: c, rows, left: alloc.left, hash, own };
}
/** POST /claims/<id>/received {hash}: his one tap on the rows drawn. */
export async function claimReceived(env, id, body, by, now) {
  const at = now || new Date();
  const pv = await claimPreview(env, id);
  if (!pv.ok) return pv;
  const own = pv.own, db = env.SALT_LEDGER;
  delete pv.own;
  /* booked already: the site is told again, and nothing more is queued or approved */
  if (pv.booked) {
    const r = await moveClaim(env, pv.claim.u, id, { verdict: { kind: "received", amount: pv.claim.amount } });
    return Object.assign({ ok: r.ok, again: true, rows: [], approved: [] },
      r.ok ? { claim: r.claim, push: r.push } : { status: r.status, error: "the rows are booked, but the site was not told: " + r.error });
  }
  /* S6 fix: RECEIVED, ON THE BOOK ALREADY: more than their rows owe, because he recorded it by hand, so it books nothing */
  if (body && body.covered === true) {
    if (!(pv.left > 0.004)) return { ok: false, status: 409, error: "their rows owe all of it: answer it Received" };
    const r = await moveClaim(env, pv.claim.u, id, { verdict: { kind: "received", amount: pv.claim.amount, covered: true } });
    return Object.assign({ ok: r.ok, covered: true, rows: [], approved: [] }, r.ok ? { claim: r.claim, push: r.push } : { status: r.status, error: r.error });
  }
  if (!body || typeof body.hash !== "string") return { ok: false, status: 400, error: "Received answers the rows drawn: send the digest the preview gave" };
  if (pv.hash !== body.hash) return { ok: false, status: 409, differs: true, error: "the rows have changed since the card drew them: look at them again", preview: pv };
  if (pv.left > 0.004) return { ok: false, status: 409, error: "RM " + pv.left.toFixed(2) + " of it is more than their rows owe, so it is not approved on a tap: answer Received, on the book already, if you recorded it by hand, or Not found" };
  if (!own.length) return { ok: false, status: 409, error: "no row of theirs owes anything to settle" };
  const pres = [];
  for (let i = 0; i < own.length; i++) {
    const e = own[i].entry;
    const was = await db.prepare("SELECT status FROM draft WHERE id=?1").bind(e.at).first();
    if (was && was.status === "rejected") return { ok: false, status: 409, error: "the row of " + (pv.rows[i].date || "no date") + " was rejected: answer it under Approve" };
    const preId = await recordPre(db, { order_id: id, u: pv.claim.u, stage: "pay", hash: own[i].digest, entry: e, by,
      at: new Date(at.getTime() + i).toISOString(), shown: { claim: id, figures: { amount: e.payload.cash }, row: pv.rows[i].key, date: pv.rows[i].date || null, owed: pv.rows[i].owed, flags: own[i].flags } });
    if (!was) await queueSale(env, e);
    await db.prepare("UPDATE preapproval SET entry_at=?1, entry=?2 WHERE id=?3").bind(e.at, JSON.stringify(e), preId).run();
    pres.push(preId);
  }
  const drafted = pres.length ? await runDrafter(env) : null;
  const book = pres.length ? await readBook(db) : null;
  const rows = [];
  for (const preId of pres) {
    let pre = await preById(db, preId);
    if (pre.status === "waiting") { await settlePre(db, pre, book); pre = await preById(db, preId); }
    rows.push({ draft: pre.entry_at, state: pre.status });
  }
  const r = await moveClaim(env, pv.claim.u, id, { verdict: { kind: "received", amount: pv.claim.amount } });
  return Object.assign({ ok: r.ok, rows, drafted, approved: rows.filter((x) => x.state === "applied").map((x) => x.draft) },
    r.ok ? { claim: r.claim, push: r.push } : { status: r.status, error: "the rows are booked, but the site was not told: " + r.error });
}

/** One claim against an account, waiting or answered, with its code. */
export async function findClaim(env, id) {
  const r = await listClaims(env, true);
  if (!r.ok) return { ok: false, status: 503, error: r.error };
  const c = r.claims.find((x) => x.id === id);
  return c ? { ok: true, claim: c } : { ok: false, status: 404, error: "no such claim" };
}
/** His answer on a claim against the account, relayed to the site, which wakes them. */
export async function moveClaim(env, u, id, body) {
  const r = await site(env, "/desk/claims/" + encodeURIComponent(u) + "/" + encodeURIComponent(id), {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) });
  if (!r) return { ok: false, status: 503, error: "the order relay is not configured (STMT_SITE binding and STMT_DESK_KEY secret)" };
  const b = await r.json().catch(() => ({}));
  if (!r.ok || !b.ok) return { ok: false, status: r.status, error: b.error || ("the statements site answered http " + r.status) };
  const users = await usersMap(env);
  return { ok: true, claim: Object.assign({ code: users[b.claim.u] || null }, b.claim), push: b.push };
}

/** POST /orders/<id>/cash {amount}: cash taken at the counter. The site's cash event marks the order paid at once, which
 *  stops the chase, and the Fulfilment is the desk's own entry, queued when the first row is on the book (deskPass). */
export async function cashOrder(env, id, body, by, now) {
  const rej = await rejectedOf(env.SALT_LEDGER, id, "cash");
  return stageTap(env, id, body, by, now, "cash", (o, at) => {
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
    /* the site's own cash event (S11 11.8): paid at once, kept as his in cash, and the ledger's mark of the money moved
       by the same figure, because this Fulfilment is the desk's own and the reconcile must not queue it again */
    return { entry, queueIt: true, site: { cash: { amount: +amount.toFixed(2) } }, shown: { amount: +amount.toFixed(2), cash: true } };
  });
}

/* ---- OFFERED AGAIN (S11 11.13, D6) ----------------------------------------------------------------
 * A row he rejects under Approve is written back onto its order (rejectedOnOrder), and the move that made it
 * is OFFERED AGAIN: the card's own tap for that stage (Accept, Collected, Received, Cash received) or
 * `/again {stage}` queues the same move under a FRESH ENTRY, a new moment and so a new draft id, because the
 * rejected id is refused for good. It is his yes like any other tap, spent only if the fresh row equals what
 * he was shown. The rejected entry is the move: its figures and its day are kept, and only its moment is new.
 * GET /orders says which stages an order has to offer again (`again`), read off the drafts. */
const STATUS_OF_STAGE = { ack: "Pending", pay: "Payment", cash: "Payment", move: "Handover", cancel: "Cancellation" };
const STAGE_WORD = { ack: "pending row", pay: "payment", cash: "cash payment", move: "handover", cancel: "cancellation" };
async function draftsOfOrders(db, ids) {   /* one order's, in practice: ids holds one */
  const rs = await db.prepare("SELECT id,status,decided_by,entry FROM draft WHERE entry LIKE ?1 ORDER BY id DESC").bind('%"orderId":"' + ids[0] + '"%').all();
  const want = new Set(ids);
  return (rs.results || []).map((r) => { try { return Object.assign({}, r, { entry: JSON.parse(r.entry) }); } catch (e) { return null; } })
    .filter((r) => r && r.entry && want.has(r.entry.orderId));
}
/* a close (S11 11.9) is Collected's too: its row restates what was handed over */
const ofStage = (r, stage) => (stage === "move" ? ["Handover", "Close"].includes(r.entry.status) : r.entry.status === STATUS_OF_STAGE[stage])
  && (stage === "pay" ? !r.entry.counter : stage === "cash" ? !!r.entry.counter : true);
/* he rejected it: a withdrawal's drop (11.10) is filed rejected too, and is not his */
const rejectedByHim = (d) => !!d && d.status === "rejected" && !["withdrawn", "notfound", "covered"].includes(d.decided_by);   /* S6: nor a claim not found, or on the book already */
/** The newest draft of a stage for an order, when it is one he rejected; else null. */
export async function rejectedOf(db, id, stage) {
  if (!db) return null;
  try { const d = (await draftsOfOrders(db, [id])).find((r) => ofStage(r, stage)); return rejectedByHim(d) ? d : null; }
  catch (e) { return null; }
}
/** Which stages each order has to offer again, for the card: { <order id>: [stage, ...] }. */
export async function againOf(db, ids) {
  const out = {};
  if (!db || !ids.length) return out;
  /* the card polls this, so it reads the few rows he rejected, and only their orders' drafts, never every site draft */
  let hit = [];
  try {
    const rs = await db.prepare("SELECT entry FROM draft WHERE status='rejected' AND entry LIKE ?1").bind('%"orderId":"%').all();
    const want = new Set(ids);
    hit = [...new Set((rs.results || []).map((r) => { try { return JSON.parse(r.entry).orderId; } catch (e) { return null; } }).filter((x) => x && want.has(x)))];
  } catch (e) { return out; }
  for (const id of hit) {
    let all = [];
    try { all = await draftsOfOrders(db, [id]); } catch (e) { continue; }
    for (const st of Object.keys(STATUS_OF_STAGE)) if (rejectedByHim(all.find((r) => ofStage(r, st)))) (out[id] = out[id] || []).push(st);
  }
  return out;
}
/** POST /orders/<id>/again {stage}: a payment, cash payment, handover or cancellation he rejected, offered again. */
export async function againOrder(env, id, body, by, now) {
  const at = now || new Date();
  const stage = String((body && body.stage) || "");
  if (!["pay", "cash", "move", "cancel"].includes(stage)) return { ok: false, status: 400, error: "offer again a pay, cash, move or cancel; a pending row is offered again by Accept, against its preview" };
  const f = await findOrder(env, id);
  if (!f.ok) return f;
  const o = f.order, db = env.SALT_LEDGER;
  if (!o.code) return { ok: false, status: 409, error: "no desk code is mapped to this account yet: publish the statements again" };
  if (!db) return { ok: false, status: 503, error: "the desk has no ledger binding, so no row can be drafted" };
  const rej = await rejectedOf(db, id, stage);
  if (!rej) return { ok: false, status: 409, error: "there is no rejected " + STAGE_WORD[stage] + " on this order to offer again" };
  const live = await livePre(db, id, stage);
  if (live && live.status === "waiting" && live.entry) return { ok: false, status: 409, error: "that " + STAGE_WORD[stage] + " is offered again already and is being drafted" };
  if (stage === "move" && Math.abs((+o.moved || 0) - (+((rej.entry.payload.fields || {}).deliveredQty) || 0)) > 0.0004)
    return { ok: false, status: 409, error: "the order has moved on since that handover: record the handover as it stands" };
  const entry = Object.assign({}, rej.entry, { at: at.toISOString() });
  const pv = await stagePreview(env, o, stage, entry);
  if (!pv.ok) return pv;
  /* a close offered again restates the row once more, so later stages wait for it under the name it will leave, as the
     reconcile had them wait when it first queued it */
  if (entry.status === "Close") {
    const m = await markOrder(env, o.u, id, { ledgerKey: closedKey(o) });
    if (!m || !m.ok) return { ok: false, status: 502, error: "the order could not be marked for the close offered again" + (m ? " (http " + m.status + ")" : "") };
  }
  await recordPre(db, { order_id: id, u: o.u, stage, hash: pv.hash, entry, at: at.toISOString(), by,
    shown: { from: o.status, again: rej.id, flags: pv.d.flags, waits: pv.waits } });
  /* queued by the desk's own pass, which the request's tail runs: the row it amends is on the book, the rejected one having been drafted against it */
  return { ok: true, order: o, preapproval: { stage, waits: pv.waits, says: yesWords(pv.waits), flags: pv.d.flags, again: rej.id } };
}

/* ---- THE DESK'S OWN PASS, EVERY MINUTE (S11) ------------------------------------------------------
 * What the desk queued itself is followed up here, beside the reconcile that follows what the site made:
 *   an entry recorded and not yet queued is queued now: an Accept's whose queue write failed, and cash taken
 *   at the counter (11.12) once the row it amends is on the book;
 *   a pending row an Accept queued, whose order the CUSTOMER then withdrew while the row was still not
 *   approved, is dropped as 11.10 drops one the reconcile queued. The site cannot say so here, because an order
 *   Accept has not moved yet owes the reconcile nothing and is never on its list;
 *   a yes still waiting on a row that was drafted without spending it (a fault in the pass that drafted it, or a
 *   pass that drafted it before the yes knew its id) is spent on that row now, and the approvals are returned for
 *   the caller to follow (afterApproval);
 *   an Accept whose row is approved but whose order was never told (the mark or the move failed) is told again. */
export async function deskPass(env, now) {
  const db = env.SALT_LEDGER;
  if (!db) return { ok: true, queued: 0 };
  let pres = [], untold = [];
  try {
    pres = (await db.prepare("SELECT * FROM preapproval WHERE status IN ('waiting','differs') AND entry IS NOT NULL ORDER BY at").all()).results || [];
    untold = (await db.prepare("SELECT * FROM preapproval WHERE stage='ack' AND status='applied' AND acked_at IS NULL ORDER BY at").all()).results || [];
  } catch (e) { return { ok: true, queued: 0 }; }   /* before migrations/0011 */
  for (const p of untold) { try { await ackOnApproval(env, p); } catch (e) { /* the next minute tries again */ } }
  if (!pres.length) return { ok: true, queued: 0 };
  let queued = 0; const dropped = [], approved = []; let open = null;
  for (const p of pres.filter((x) => !x.entry_at)) {
    const entry = JSON.parse(p.entry);
    /* an amendment the desk made itself (cash taken, 11.12) waits for its row exactly as a stage the site made does */
    if (p.stage !== "ack") {
      if (!open) { const bk = await readBook(db).catch(() => null); open = (bk && bk.state && bk.state.OPEN && bk.state.OPEN.byKey) || {}; }
      if (!open[entry.payload.orderKey]) continue;
    }
    await queueSale(env, entry);
    await db.prepare("UPDATE preapproval SET entry_at=?1, entry=?2 WHERE id=?3").bind(entry.at, JSON.stringify(entry), p.id).run();
    p.entry_at = entry.at;   /* a row already drafted from it is tested below, in this pass */
    queued++;
  }
  const acks = pres.filter((x) => x.stage === "ack" && x.entry_at);
  if (acks.length) {
    const all = await listOrders(env, true);
    for (const p of all.ok ? acks : []) {
      const o = all.orders.find((x) => x.id === p.order_id);
      const ended = o && [...(o.history || [])].reverse().find((x) => x && (x.status === "cancelled" || x.status === "declined"));
      /* S6: nor while they say they sent something, which may be money the book has to carry back */
      if (!o || !ended || ended.by !== "customer" || (+o.paid || 0) > 0.004 || (+o.claimed || 0) > 0.004 || (o.queued && o.queued.ack)) continue;
      if ((await dropAck(env, p.entry_at, now)) !== "dropped") continue;
      await db.prepare("UPDATE preapproval SET status='void', decided_at=?1 WHERE id=?2").bind((now || new Date()).toISOString(), p.id).run();
      dropped.push(o.id);
    }
  }
  const unspent = pres.filter((x) => x.status === "waiting" && x.entry_at && !dropped.includes(x.order_id));
  if (unspent.length) {
    const book = await readBook(db);
    for (const p of unspent) if ((await settlePre(db, p, book)) === "applied") approved.push(p.entry_at);
  }
  return Object.assign({ ok: true, queued }, dropped.length ? { dropped } : {}, approved.length ? { approved } : {});
}

/** Forward the owner's move. Returns the site's answer with the code joined. */
export async function moveOrder(env, u, id, body) {
  /* v753: HIS ANSWER GOES THROUGH THE SAME LOCK AS THE BULLETIN. What he types here lands on a page
     that never names this desk, a roster code or a level, and a slip of the thumb is how one gets
     there. Checked HERE and not on the site, because the site holds no roster and would not know a
     code if it saw one; a product's name is his to spend, as it is in the bulletin. */
  /* 24 Sep 2026: AND SO DOES A STATUS NOTE. The site files `note` on the order's history, which the
     customer's page reads; nothing sends one today, and the first decline to carry a reason would have
     reached the page unchecked. Every free-text field his moves can carry goes through this one lock,
     on the one road they take to the site. */
  for (const k of ["message", "note"]) {
    const why = body && typeof body[k] === "string" ? siteWords(body[k]) : "";
    if (why) return { ok: false, status: 400, error: "that " + k + " says something " + why };
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
      orderKey: order.ledgerKey || null, orderCode: null, linkTo: null, assoc: null, downstream: null,
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

/** S11 11.9: an order closed at what was handed over, as a Correction restating the row: its size and the
 *  goods' total at what went, what was handed over and when. The cost follows the size in the fold. */
export function closeEntry(order, code, now) {
  const at = now instanceof Date ? now : new Date(now || Date.now());
  const date = order.movedOn || klDate(at);
  const books = partyOnBook(order, code);
  const how = order.mode === "deliver" ? "delivered" : "collected";
  const qty = +(+order.qty).toFixed(3), goods = +(+order.total).toFixed(2), was = (order.closed && order.closed.qty) || qty;
  return {
    at: at.toISOString(), type: "SELL", party: books, qty, total: goods, status: "Close",
    raw: "Closed at " + qty + " unit " + how + " to " + books + " for RM " + goods + ", order " + order.id + ", of " + was + " ordered",
    payload: { mode: "amend", kind: "Correction", direction: "SELL", party: books, rid: null,
      orderKey: order.ledgerKey || null, orderCode: null, linkTo: null, assoc: null, downstream: null,
      date, qty: 0, total: 0, cash: 0, kg: 0,
      fields: { qty, total: goods, deliveredQty: +(+order.moved || 0).toFixed(3), deliveredOn: date, handover: how },
      note: "Closed at " + qty + " unit " + how + " for order " + order.id + ", of the " + was + " ordered." }
  };
}
/* THE ROW'S NAME MOVES WITH ITS TOTAL: the engine's ovKey of the row as the close leaves it, the party and the
   day kept from the key the acknowledgement wrote. Later stages then wait for the close to fold, as a first
   stage waits for its pending row, and the return leg finds the row by the name it will carry. */
export const closedKey = (order) => {
  const [party, date] = String(order.ledgerKey || "").split("|");
  return POSITION_ENGINE.ovKey({ customer: party, date, total: +(+order.total).toFixed(2), delivery: +order.delivery || 0 });
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
  else if (job === "pay") { const p = ((order && order.payments) || []).filter((x) => x && !x.claim); at = p.length ? p[p.length - 1].at : null; }   /* a claim is stamped by its own moment (S6) */
  else if (job === "move") at = (order && order.movedAt) || last((x) => x.by === "desk" && / unit (delivered|collected)$/.test(String(x.note || "")));
  else if (job === "cancel") at = last((x) => x.status === "cancelled" || x.status === "declined");
  else if (job === "close") at = (order && order.closed && order.closed.at) || null;
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
  let queued = 0; const unmapped = [], failed = [], waiting = [], dropped = [];
  const STAGE_WORD = { claim: "payment they say they sent", pay: "payment", move: "handover", close: "close", cancel: "withdrawal" };
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
    const used = new Set([q.ack, q.cancel, q.close].filter(Boolean));
    try {
      /* S11 11.10: WITHDRAWN BY THEM WHILE ITS ROW WAITED UNDER APPROVE, nothing paid: the row is dropped (dropAck)
         and the withdrawal is spent with it, so no Cancellation waits behind a row that will never land */
      const ended = [...(order.history || [])].reverse().find((x) => x && (x.status === "cancelled" || x.status === "declined"));
      if ((o.work || []).includes("cancel") && q.ack && ended && ended.by === "customer" && !((+order.paid || 0) > 0.004 || (+order.claimed || 0) > 0.004)
        && !(onBook && onBook[order.ledgerKey]) && (await dropAck(env, q.ack, now)) === "dropped") {
        mark.cancel = stageAt(order, "cancel", now).toISOString();
        state = { state: "queued", why: "withdrawn by the customer while its pending row waited under Approve: the row was dropped, so nothing reaches the book" };
        dropped.push(o.id);
      }
      for (const job of mark.cancel ? [] : (o.work || [])) {
        let e = null;
        if (job !== "ack" && !(onBook && onBook[order.ledgerKey])) {
          waiting.push(o.id);
          /* A REJECTED ROW STAYS SAID (24 Sep 2026): a row he rejected never reaches the book, so every
             later stage waits here, and "approve it under Approve" would send him to a row he has already
             turned down and that Approve no longer lists */
          if (!(o.sync && o.sync.state === "rejected")) {
            /* S11 (D6): THE ROW WAITED FOR MAY BE APPROVED ALREADY, by his yes on the card, and then Approve no longer lists
               it and only the fold is left; sending him there sent him to a row he could not find */
            const what = q.close ? "close" : "pending row", id = q.close || q.ack;
            let d = null;
            try { d = id && env.SALT_LEDGER ? await env.SALT_LEDGER.prepare("SELECT status FROM draft WHERE id=?1").bind(id).first() : null; } catch (e) { d = null; }
            state = { state: "waiting", why: "the " + (STAGE_WORD[job] || job) + " waits for the " + what + " to reach the book: "
              + (d && d.status === "approved" ? "it is approved, and the next fold lands it" : "approve it under Approve, and the fold lands it") };
          }
          break;
        }
        /* S6 6.5 (D7): EACH CLAIM IS ITS OWN FULFILMENT, FOR HIS CHECK, NOT MONEY IN. Flagged `claim`, so no
           Approve tap books it as money before his Received (src/worker.js); stamped with the claim's own moment
           and marked on the site by that moment, so his answer finds the entry whichever came first */
        if (job === "claim") {
          for (const p of (o.tell && o.tell.claims) || []) {
            const c = claimEntry(Object.assign({}, order, { code }), p);
            while (used.has(c.at)) c.at = new Date(Date.parse(c.at) + 1).toISOString();
            if (await queueSale(env, c)) queued++;
            used.add(c.at);
            (mark.claims = mark.claims || []).push({ at: p.at, draft: c.at });
          }
          if (!state) state = { state: "queued", why: "" };
          continue;
        }
        /* each entry is stamped with its stage's own moment (stageAt), never the pass's clock */
        const told = o.tell ? +o.tell.pay : +((+order.paid || 0) - (+q.paid || 0)).toFixed(2);
        if (job === "ack") e = pendingEntry(order, code, stageAt(order, job, now));
        else if (job === "pay") e = payEntry(order, code, told, stageAt(order, job, now));
        else if (job === "move") e = handoverEntry(order, code, +order.moved || 0, stageAt(order, job, now));
        else if (job === "close") e = closeEntry(order, code, stageAt(order, job, now));
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
        else if (job === "pay") mark.paid = +((+q.paid || 0) + told).toFixed(2);
        else if (job === "move") mark.moved = +(+order.moved || 0).toFixed(3);
        else if (job === "close") {
          mark.close = e.at; mark.moved = +(+order.moved || 0).toFixed(3);
          const nk = closedKey(order); mark.ledgerKey = nk; order.ledgerKey = nk;
        }
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
    waiting.length ? { waiting } : {}, failed.length ? { failed } : {}, dropped.length ? { dropped } : {});
}

/* ---- A WITHDRAWAL BEFORE ITS ROW WAS APPROVED (S11 11.10) ---------------------------------------
 * A customer who withdraws while the pending row still waits under Approve has taken back an order the book
 * never held, so the queued acknowledgement is dropped: rejected as `withdrawn`, out of every queue, and
 * nothing reaches the book. Before this he approved a row for a dead order, waited for the fold, and then
 * approved its Cancellation. ONLY WHILE IT IS PENDING: an approved row is never dropped by a withdrawal (the
 * judges' list), and its Cancellation follows the row as before. A row not yet drafted is filed rejected under
 * its own id first, so a drafter part-way through a pass cannot draft it after. "dropped" or "kept". */
export async function dropAck(env, at, now) {
  const db = env.SALT_LEDGER;
  if (!db || !at) return "kept";
  const when = (now instanceof Date ? now : new Date()).toISOString();
  let entry = null;
  try { const q = await env.SALT_QUEUE.get("q:" + DEVICE, "json"); entry = ((q && q.queue) || []).find((e) => e && e.at === at) || null; } catch (e) { entry = null; }
  await db.prepare("INSERT OR IGNORE INTO draft (id,status,collection,entry,row,reasoning,flags,party,drafter,drafted_at,decided_at,decided_by) "
    + "VALUES (?1,'rejected','sales',?2,'{}',?3,'[]',?4,'orders',?5,?5,'withdrawn')")
    .bind(at, JSON.stringify(entry || { at }), "Withdrawn by the customer before it was drafted, so nothing reaches the book.", (entry && entry.party) || null, when).run();
  await db.prepare("UPDATE draft SET status='rejected', decided_at=?1, decided_by='withdrawn' WHERE id=?2 AND status='pending'").bind(when, at).run();
  const cur = await db.prepare("SELECT status FROM draft WHERE id=?1").bind(at).first();
  if (!cur || cur.status !== "rejected") return "kept";
  await dropQueued(env, [at]);
  return "dropped";
}

/* v525: REJECT MEANS DISCARD. A rejected entry used to sit in every device's queue until the
   fold's watermark passed it, and a device that still held it re-posted it with its next tap.
   The Worker now drops it from every q:* key on the rejection, and a queue POST drops any entry
   whose draft was rejected, so no device can bring it back. The draft row stays, rejected: the
   decision is the record. */
export async function dropQueued(env, ats) {
  const want = new Set(ats.filter(Boolean));
  if (!env.SALT_QUEUE || !want.size) return 0;
  let dropped = 0, cursor;
  do {
    const list = await env.SALT_QUEUE.list({ prefix: "q:", cursor });
    for (const k of list.keys) {
      const raw = await env.SALT_QUEUE.get(k.name);
      if (!raw) continue;
      let v; try { v = JSON.parse(raw); } catch (e) { continue; }
      const before = (v.queue || []).length;
      v.queue = (v.queue || []).filter((e) => !(e && want.has(e.at)));
      if (v.queue.length !== before) { dropped += before - v.queue.length; await env.SALT_QUEUE.put(k.name, JSON.stringify(v)); }
    }
    cursor = list.list_complete ? null : list.cursor;
  } while (cursor);
  return dropped;
}

/* ---- A ROW HE REJECTED IS TOLD TO ITS ORDER (24 Sep 2026) -------------------------------------
 * A rejection drops the entry from every queue and refuses its `at` for good (src/worker.js), while
 * the order keeps the stage mark saying the ledger was told, so the card went on saying the order was
 * on its row. The rejection is written onto the order as its `sync`, which the card reads whatever the
 * marks say. THE MARK STAYS: cleared, the next pass would queue the same stage at the same moment
 * (stageAt), the drafter would skip it as decided, and the mark would be written again. Offering the
 * move again is a fold of its own. */
const REJECTED_WHAT = { Pending: "pending row", Payment: "payment entry", Handover: "handover entry", Close: "closing correction", Cancellation: "cancellation entry" };
export async function rejectedOnOrder(env, entry, at) {
  /* the entry names the order and never its account (the ledger's side knows codes), so the account
     is found among the site's orders, closed ones included */
  const id = entry && entry.orderId;
  if (!id) return false;
  const all = await listOrders(env, true);
  const o = all.ok && all.orders.find((x) => x.id === id);
  if (!o) return false;
  const why = "its " + (REJECTED_WHAT[entry.status] || "entry") + " was rejected under Approve, so the book does not carry it";
  const mark = { sync: { state: "rejected", why, at } };
  /* A CLOSE HE REJECTS NEVER LANDS, so the row keeps the name it had: the order names it by that key again, and every
     later stage, the return leg and the card's taps find the row the book still carries (offered again, the close
     moves the name once more, againOrder) */
  if (entry.status === "Close" && entry.payload && entry.payload.orderKey) mark.ledgerKey = entry.payload.orderKey;
  const r = await site(env, "/desk/orders/" + encodeURIComponent(o.u) + "/" + encodeURIComponent(o.id), {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mark })
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

/** How many customer orders are waiting on him: placed, and acknowledged but not yet ready; and of
 *  those, how many are still to be acknowledged, which is all his banner may ask him to acknowledge. */
export async function ordersWaiting(env) {
  const r = await listOrders(env, false);
  if (!r.ok) return { ok: false, waiting: 0, placed: 0 };
  return { ok: true, waiting: r.orders.filter((o) => o.status === "placed" || o.status === "acknowledged").length,
    placed: r.orders.filter((o) => o.status === "placed").length };
}

/* S9 9.8 FIX (25 Sep 2026): SALT ADMIN'S LINE IS THE DESK'S OWN COUNT. The desk's page counts Waiting on you (the
   master's ordActs, over the orders and the drafts together: a new order not yet accepted, a question of theirs not
   marked No reply needed, cash to record, a payment they say they made) for its Today row and its Enter badge, and once
   it has read both it sends that figure here (POST /orders/waiting), which this relays to the site's desk-waiting mark.
   One reading, the desk's: this Worker's own recount every minute (placed, or their line last) missed cash and payments
   and ignored his No reply needed, so the two apps disagreed. The trade, stated: the figure is as fresh as the desk's
   last read of its orders, and the mark carries its moment, which Salt Admin shows. S9 fix: the page sends how old its
   reading is (`age`, whole seconds), passed through, and the site stamps the moment from it. */
export async function tellWaiting(env, n, age) {
  if (!Number.isInteger(n) || n < 0 || n > 9999) return { ok: false, status: 400, error: "send the count as a whole number" };
  const a = Number.isInteger(age) && age >= 0 && age <= 30 * 86400 ? age : 0;
  const t = await site(env, "/desk/waiting", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ n, age: a }) });
  if (!t) return { ok: false, status: 503, error: "the order relay is not configured (STMT_SITE binding and STMT_DESK_KEY secret)" };
  if (!t.ok) return { ok: false, status: 502, error: "the site would not take the count (http " + t.status + ")" };
  return { ok: true, n };
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
       line is the note typed with it: there the new order is the news. */
    news = NEWS_WORD.said;
    await env.SALT_QUEUE.put(NEWS_KEY, JSON.stringify({ what: news, at: said }), { expirationTtl: 3600 });
  } else if (placed) {
    /* S11 11.16: A PLACEMENT CLEARS THE NEWS, so its wake reads as a new order (the banner's own title for one).
       Left standing, the news of a payment minutes before titled the wake for a new order, and said a
       customer had paid. */
    await env.SALT_QUEUE.delete(NEWS_KEY);
  }
  const p = await sendPush(env, { tag: "orders", urgency: "high" });
  return { ok: true, sent: p.sent || 0, newest: placed ? newest : null, said: spoke ? said : null, did: did ? news : null };
}
