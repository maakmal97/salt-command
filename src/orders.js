/* src/orders.js: THE ORDER BOOK, SEEN FROM THE LEDGER'S SIDE (his instruction, 06 Sep 2026).
 *
 * The orders live on the statements site, in that Worker's own store, placed by customers on a
 * session (stmt/orders.js). This Worker is the only thing that reads them for him: it holds the
 * shared key STMT_DESK_KEY and reaches the site over a SERVICE BINDING (STMT_SITE in
 * wrangler.jsonc), so the phone talks to the desk it already talks to, with the write key it
 * already holds, and the site keeps having no route to the desk, no key of the desk's and no
 * idea the desk exists. These relays remain Desk-to-Counter. The separately keyed maker
 * capability in src/maker.js is the only Counter-to-Desk writer.
 *
 * WHAT THIS ADDS TO AN ORDER IS THE CODE. The site knows a username; the book knows a code. The
 * deploy writes the map (stmt-users, username to code) into THIS Worker's store on every publish,
 * and it is joined here. The site never holds it.
 *
 * WHAT COMPLETION DOES. "Done" is the owner's word that the goods are handed over and the money
 * is in. That is a sale, and a sale reaches the book by the one road every sale takes: a queue
 * entry, drafted, approved on the phone, staged, folded, deployed. So done writes an entry into
 * the queue under its own device, one key an entry (q:orders:<at>, fold 2.1), each shaped exactly as
 * the Workbench shapes a device's queue, and the drafter drafts it on arrival. Nothing here writes a
 * row. The live statement follows the fold, which is what "an updated statement after completion"
 * means on this book.
 */
import { sendPush } from "./push.js";
import { readBook, bookOnce, draftRow, cogsFor, floorFor, usualFor, pricingOf, stageDigest, runDrafter, settlePre, withPending, noteQueued, offerDigest, isOfferPre } from "./drafter.js";
import POSITION_ENGINE from "../engine/position.mjs";
import { admitInput, admitInputs } from "./input-admission.js";
import { makerRequestFingerprint } from "./maker-request.js";
import PRICING_ENGINE from "../engine/pricing.mjs";
/* S1b: THE ENTRY EACH STAGE MAKES lives in engine/stages.mjs (pure); this reads, calls it, and queues. The builders stay named here for every importer. */
import { rm, chargeOf, priceOf, advanceOf, acceptEntry, floorRefusal, ackRowWanted, stageAgainst, jobEntry, againEntry, keyGivenBack,
  handoverTap, receivedTap, cashTap, restateTap, pastRoom, claimRows, claimOrderFlight, claimEntry,
  stageAt, keyAfter, closedKey, ledgerKeyOf, partyOnBook, bucketFor, termsFromRow, settledFromRow, rowOut } from "../engine/stages.mjs";
export { orderKeyFor, partyOnBook, ledgerKeyOf, pendingEntry, payEntry, claimEntry, handoverEntry, redateFrom, closeEntry, closedKey, cancelEntry,
  amendEntry, stageAt, advanceOf, claimOrderFlight } from "../engine/stages.mjs";

const DEVICE = "orders";
/* ONE KEY AN ENTRY (fold 2.1, 26 Sep 2026). q:orders was one blob that three roads (the minute's reconcile, a tap's
   reconcile and Accept) read, appended to and wrote back whole, so a writer holding a copy up to a minute old erased
   what another had appended, and nothing ever took a folded stage out. Each entry now has its own key, holding
   the device's shape {device, updated, queue: [entry]}, so every reader that lists the q: prefix and collapses by
   `at` reads both without a change. THE OLD BLOB IS READ, NEVER APPENDED TO: queueSale looks in it for a clash, the
   drafter prunes it, and only `node tools/drain.mjs --retire-orders-blob` deletes it, and only once it is empty. */
const OKEY = (at) => "q:" + DEVICE + ":" + at;
const BLOB = "q:" + DEVICE;
/** The queued entry of the orders device under `at`: its own key first, then the old blob; null when neither holds it
 * or neither can be read. */
async function queuedAt(env, at) {
  for (const k of [OKEY(at), BLOB]) {
    let v = null; try { v = await env.SALT_QUEUE.get(k, "json"); } catch (e) { v = null; }
    const hit = ((v && Array.isArray(v.queue) && v.queue) || []).find((e) => e && e.at === at);
    if (hit) return hit;
  }
  return null;
}
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
const NEWS_WORD = { pay: "A customer says they paid", cancel: "A customer cancelled", said: "A customer wrote", rate: "A customer rated an order",
  take: "A customer took your price", pass: "A customer said no to your price" };
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
 * The lists below are the ones the suite pins against the book's names and the master's TIER_NAMES, and the desk's
 * siteSafe mirrors them. English only (the second language was removed on 05 Oct 2026, the owner's decision).
 * A word with no Latin letter is found as a substring, \b being blind to it, and is never one character. */
export const LEVEL_WORDS = ["ambassador", "titanium", "platinum", "gold", "silver", "bronze"];
export const PRODUCT_WORDS = ["salt", "oil", "candy", "rice"];
/** Which of `words` the text holds: whole words for Latin ones, a substring for any other script. */
export function wordsIn(text, words) {
  const t = String(text || "").toLowerCase();
  return words.filter((w) => /[a-z]/.test(w) ? new RegExp("\\b" + w + "\\b").test(t) : t.includes(w));
}
export function siteWords(text) {
  const t = String(text || "");
  if (/salt\s*command/i.test(t)) return "that names the desk, which a customer's page never does";
  if (/\b[A-Z]{2}\d{1,2}-[A-Z]{2,4}(-R)?\b/.test(t)) return "that carries a roster code, which a customer's page never shows";
  if (wordsIn(t, LEVEL_WORDS).length) return "that names a level, which a customer's page never does";
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

/** F4: the restock date of each book, relayed to the site's own store (KV `expected`); the site checks the day. A product is
 *  named by its shape alone here, the book being the desk's to validate. */
export async function expectedRelay(env, method, body) {
  const r = await site(env, "/desk/expected", method === "POST"
    ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ product: body && body.product, on: body && Object.hasOwn(body, "on") ? body.on : undefined }) } : undefined);
  if (!r) return { ok: false, status: 503, error: "the order relay is not configured (STMT_SITE binding and STMT_DESK_KEY secret)" };
  const b = await r.json().catch(() => ({}));
  if (!r.ok || !b.ok) return { ok: false, status: r.status, error: b.error || ("the statements site answered http " + r.status) };
  return b;
}

export async function usersMap(env) {
  try { return (await env.SALT_QUEUE.get("stmt-users", "json")) || {}; } catch { return {}; }
}

/** Every open order (or all with `all`), each with the desk code the username maps to; with `links`, how many
 *  associate links wait in Salt Account as well (S9 9.8), a count the desk's page shows and nothing more. */
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

/** Step 7: every account's thread on the site, newest first, each with the desk code its username maps to. A test
 *  account's lives in its fixture, so it is never here. */
export async function listThreads(env, examples = false) {
  const r = await site(env, "/desk/threads" + (examples ? "?examples=1" : ""));
  if (!r) return { ok: false, error: "the order relay is not configured (STMT_SITE binding and STMT_DESK_KEY secret)" };
  const b = await r.json().catch(() => ({}));
  if (!r.ok || !b.ok) return { ok: false, error: b.error || ("the statements site answered http " + r.status) };
  const users = await usersMap(env);
  return { ok: true, threads: (b.threads || []).map((t) => Object.assign({ code: users[t.u] || null }, t)) };
}
/** Step 7: HIS LINE ON AN ACCOUNT'S THREAD, or his No reply needed, relayed to the site. His words go through the same lock
 *  as a line on an order (siteWords), here, where the roster is known; only a message or noReply is sent on. */
export async function threadRelay(env, u, body) {
  if (!/^[a-z0-9]{4}-[a-z0-9]{4}$/.test(String(u || ""))) return { ok: false, status: 404, error: "no such account" };
  const noReply = !!(body && body.noReply === true);
  const message = typeof (body && body.message) === "string" ? body.message : "";
  if (!noReply) {
    const why = siteWords(message);
    if (why) return { ok: false, status: 400, error: "that message says something " + why };
  }
  const r = await site(env, "/desk/threads/" + encodeURIComponent(u), {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(Object.assign(noReply ? { noReply: true } : { message },
      body && body.rid !== undefined ? { rid: body.rid } : {}))
  });
  if (!r) return { ok: false, status: 503, error: "the order relay is not configured (STMT_SITE binding and STMT_DESK_KEY secret)" };
  const b = await r.json().catch(() => ({}));
  if (!r.ok || !b.ok) return { ok: false, status: r.status, error: b.error || ("the statements site answered http " + r.status) };
  const users = await usersMap(env);
  return { ok: true, thread: Object.assign({ code: users[b.thread && b.thread.u] || null }, b.thread), push: b.push || null };
}

/** 10 Oct 2026: a delivery's exact spot as the site filed it, ciphertext sealed on the customer's phone to his slip key under
 *  the info "salt-pin v1" (stmt/pin.js), for the desk to open with the key his vault holds. Stored nowhere here. */
export async function pinRelay(env, u, id) {
  if (!/^[0-9a-f]{32}$/.test(String(id || "")) || !/^[a-z0-9-]{1,40}$/.test(String(u || ""))) return { ok: false, status: 404, error: "no such location" };
  const r = await site(env, "/desk/pins/" + encodeURIComponent(u) + "/" + id);
  if (!r) return { ok: false, status: 503, error: "the order relay is not configured (STMT_SITE binding and STMT_DESK_KEY secret)" };
  const b = await r.json().catch(() => ({}));
  if (!r.ok || !b.ok) return { ok: false, status: r.status === 404 ? 404 : 502, error: b.error || ("the statements site answered http " + r.status) };
  return { ok: true, pin: b.pin };
}

/** F13: a payment slip as the site filed it, ciphertext sealed on the customer's phone to his slip key, for the desk to
 *  open with the key his vault holds. The username and the id as the claim carries them; stored nowhere here. */
export async function slipRelay(env, u, id) {
  if (!/^[0-9a-f]{32}$/.test(String(id || "")) || !/^[a-z0-9-]{1,40}$/.test(String(u || ""))) return { ok: false, status: 404, error: "no such slip" };
  const r = await site(env, "/desk/slips/" + encodeURIComponent(u) + "/" + id);
  if (!r) return { ok: false, status: 503, error: "the order relay is not configured (STMT_SITE binding and STMT_DESK_KEY secret)" };
  const b = await r.json().catch(() => ({}));
  if (!r.ok || !b.ok) return { ok: false, status: r.status === 404 ? 404 : 502, error: b.error || ("the statements site answered http " + r.status) };
  return { ok: true, slip: b.slip };
}

/** One order, closed or open, with its code: the routes below act on an order by its id alone. */
export async function findOrder(env, id) {
  const r = await listOrders(env, true);
  if (!r.ok) return { ok: false, status: 503, error: r.error };
  const o = r.orders.find((x) => x.id === id);
  /* V5b2a: the list rides along, so Accept decides paid in advance on the orders it was found among (Fable's review) */
  return o ? { ok: true, order: o, orders: r.orders } : { ok: false, status: 404, error: "no such order" };
}

/* ---- WHAT THE CUSTOMER'S PAGE SAYS OF EACH STATE (S11 11.1) ------------------------------------
 * The card says what the customer is looking at before his yes. These are the page's own words, the state
 * chip (oWord) and the start of the sentence under it (oWhen), in stmt/page.js's CLIENT_JS: copied, because
 * they live inside a template literal the desk cannot import, and HELD TOGETHER by the suite, so the day the
 * page's words change this turns it red until it follows. Since the Counter's stage 5 (S5 5.3) they are the
 * customer's own words. Each is [chip, sentence], and where the chip reads by the mode or by whose the
 * cancellation was, [collect or theirs, sentence, deliver or his, sentence]. No figure: the card draws the figures. */
export const CUSTOMER_SEES = {
  placed: ["Placed", "Waiting for us to confirm"],
  acknowledged: ["Confirmed", "Confirmed on"],
  ready: ["Ready to collect", "Ready to collect, since", "Ready to deliver", "Ready to deliver, since"],
  done: ["Complete", "Your order is now complete"],
  declined: ["Declined", "We could not take this order"],   /* S11 11.7: his reason and "Nothing is owed" follow on the page */
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
/* 10 Oct 2026 (his Q3): A WINDOW AT ACCEPT, only on a delivery that asked for none (as soon as it can, no day wanted), so no
   window goes out without their yes: theirs is never changed this version (his Q2). Its end ahead and its start at most eight
   days off; the Counter cuts it to its hours as it moves the order. Absent or empty, none. Returns { slot } or { error }. */
export const ACCEPT_SLOT_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T(00|04|08|12|16|20)$/;
export function slotOf(b, o, at) {
  const s = b && b.slot;
  if (s === undefined || s === null || s === "") return { slot: null };
  if (typeof s !== "string" || !ACCEPT_SLOT_RE.test(s)) return { error: "a time window is a day and one of the six four-hour windows", status: 400 };
  if (!o || o.mode !== "deliver") return { error: "only a delivery takes a time window", status: 400 };
  if (o.wantBy) return { error: "they chose their own day, and it stands", status: 409 };
  if (o.slot === s) return { slot: null };   /* their own window, named again: it stands as it is */
  const start = Date.parse(s.slice(0, 10) + "T00:00:00Z") + (+s.slice(11, 13) - 8) * 3600e3, now = at.getTime();
  if (!(start + 4 * 3600e3 > now) || start - now > 8 * 86400e3) return { error: "that window has passed or is more than a week off: choose another", status: 400 };
  return { slot: s, change: !!o.slot };
}
/* VERSION 2 (his decisions of 10 Oct 2026): WHAT NEEDS THEIR YES. Goods above what they placed it at, to the sen, or a window
   other than the one they chose (Q2's window stays fixed once agreed). Never his first delivery charge (Q1), never a window
   on an order that asked for none (Q3), never a lower price. Needed, Accept is refused and the card sends it as an offer. */
export function needsYes(o, x) {
  const total = x && x.total, slot = x && x.slot;
  return (typeof total === "number" && total > (+o.total || 0) + 0.004) || (!!slot && !!o.slot && slot !== o.slot);
}
/* an offer for their yes (`from: "accept"`) that no longer holds the order: they said no (which cancels it), he withdrew it,
   or it lapsed. It never freezes the order: he Accepts at their terms, offers again, or Declines. The desk reads the lapse a
   minute late (ACCEPT_GRACE), so a take the Counter stamped by `until` always lands before his Accept can (Fable's review) */
const ACCEPT_GRACE = 60e3;
export const acceptClosed = (o, at) => !!(o && o.price && o.price.from === "accept" && (["passed", "withdrawn"].includes(o.price.state)
  || (o.price.state === "offered" && o.price.offer && (at || new Date()).getTime() > Date.parse(o.price.offer.until) + ACCEPT_GRACE)));
/* the window's lapse for an offer: 48 hours, or the window's start when that is at least an hour ahead and sooner, else its end */
export function acceptUntil(at, slot) {
  const t = at.getTime(), max = t + OFFER_HOURS * 3600e3;
  if (!slot) return new Date(max).toISOString();
  const start = Date.parse(slot.slice(0, 10) + "T00:00:00Z") + (+slot.slice(11, 13) - 8) * 3600e3, end = start + 4 * 3600e3;
  return new Date(start - t >= 3600e3 ? Math.min(start, max) : Math.min(end, max)).toISOString();
}
/* their card at this size: the desk's own cardQuote, carried in the pricing snapshot (tools/book.mjs), read and never worked out */
export function cardAt(pricing, code, product, qty) {
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
  /* 05 Oct 2026 (any quantity at an automatic price): A SIZE OFF THE BOARD is the engine's quoteAt on the snapshot's own inputs
     and their drift, which is what their sealed grid was struck from, so the card here and the price their page quoted agree */
  const at = quoteOff(snap, code, qty);
  if (at != null) return { card: at, cardNote: (fixed ? "the board, one price for everybody" : "their card") + " at " + qty + " unit" };
  return { card: null, cardNote: qty + " unit is not a size on their board, so there is no card at it" };
}
function quoteOff(snap, code, qty) {
  const I = snap && snap.inputs;
  if (!I || !I.cost || !I.policy || !(qty > 0)) return null;
  const R = I.policy.tierRule || null;
  const d = (snap.partners || []).includes(code) ? "partner" : R && R.drift ? (snap.drift && typeof snap.drift[code] === "number" ? snap.drift[code] : null) : 0;
  if (d == null) return null;
  try { const v = PRICING_ENGINE.quoteAt(qty, PRICING_ENGINE.costStack(I.cost), I.policy, d); return v != null && isFinite(v) && v > 0 ? v : null; }
  catch (e) { return null; }
}
/* `mirror`, here and below: the invocation's one reader of the mirror (bookOnce, 06 Oct 2026); without one, a read of its own */
async function previewAck(env, o, code, delivery, now, ctx, price, mirror) {
  if (!env.SALT_LEDGER) return { ok: false, status: 503, error: "the desk has no ledger binding, so no row can be drafted" };
  /* the charge is the site's own rule (decideDesk): typed for a delivery, nought for a collection; Step 2: the goods at the
     price he sets on this order, when he sets one, so the row, its key and the digest are all drafted on it */
  const { agreed, entry } = acceptEntry(o, code, delivery, price, now);
  const book = await (mirror ? mirror() : readBook(env.SALT_LEDGER));
  /* fold 2.2: no snapshot is a mirror being seeded, and the drafter stands down on it; so does the card */
  if (book.version == null) return { ok: false, status: 503, error: "the mirror is being seeded: try again in a minute" };
  const product = o.product || "salt", qty = +o.qty, goods = +(+agreed.total).toFixed(2);
  const fl = floorFor(book, product, qty);
  const under = floorRefusal(price, fl, qty);   /* never under the floor at this size (rule 5), engine/stages.mjs */
  if (under) return under;
  const d = draftRow(entry, book);
  if (d.skip) return { ok: false, status: 409, error: "the drafter would not draft it: " + d.skip };
  /* V5b2 (his answers of 29 Sep 2026): PAID IN ADVANCE when what they owe at once, with this order, is over the ceiling.
     The Worker decides, from the book and the site's own orders, never the phone; the verdict rides on the entry and in
     the digest, so his yes covers it and the order is moved with it (ackOnApproval). */
  const adv = advanceOf(book, agreed, code, agreed.delivery, Object.assign({ today: new Date(now.getTime() + 8 * 36e5).toISOString().slice(0, 10) }, ctx || {}));
  if (adv.error) return { ok: false, status: 503, error: adv.error };
  if (adv.prepay) entry.prepay = true;
  const pricing = await pricingOf(book);
  const priced = cogsFor(book, product, agreed.date || null);   /* 05 Oct 2026: a sale shows COGS off the latest purchase, the drafter's own basis */
  const cost = priced.cost == null ? null : { unit: priced.cost, total: +(priced.cost * qty).toFixed(2), source: priced.source };
  return Object.assign({ ok: true, stage: "ack", id: o.id, entry, row: d.row, flags: d.flags, reasoning: d.reasoning,
    quote: goods, asked: +(+o.total).toFixed(2), set: price != null, delivery: agreed.delivery, cost,
    margin: cost && goods > 0 ? { rm: +(goods - cost.total).toFixed(2), pct: +((goods - cost.total) / goods * 100).toFixed(1) } : null,
    floor: fl ? { rm: fl.floor, at: fl.at, exact: fl.exact } : null,
    usual: usualFor(book, d.row), told: toldOf(o), pricing, prepay: adv.prepay, owedWith: adv.owedWith, ceiling: adv.ceiling, late: adv.late || null,
    hash: await stageDigest("ack", entry, d, pricing) },
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
  /* offered again (11.13), the charge and the goods are the ones already on the order: the customer was told them */
  const pr = again ? { price: null } : priceOf(body);
  if (pr.error) return { ok: false, status: 400, error: pr.error };
  const p = await previewAck(env, o, o.code, again ? (+o.delivery || 0) : chargeOf(body), now || new Date(), { orders: f.orders, again }, pr.price);
  if (!p.ok) return p;
  /* 05 Oct 2026 (Negotiate): on an order whose price they asked for, the digest his Offer sends back is the offer's own,
     on the row's figures and flags (offerDigest), and the ask rides along for the card: their own figure, if they gave one */
  /* version 2: and on any placed order, since a raise or a changed window goes to them as an offer */
  if (o.status === "placed") Object.assign(p, { offerHash: await offerDigest(p.entry, { collection: "sales", row: p.row, flags: p.flags }) },
    o.price && o.price.from !== "accept" ? { ask: { state: o.price.state, proposed: typeof o.price.proposed === "number" ? o.price.proposed : null } } : {});
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
/* the window his yes carries: Accept's own, or an offer's they took (version 2) */
const slotShown = (sh) => [sh && sh.slot, sh && sh.offer && sh.offer.slot].find((x) => typeof x === "string" && ACCEPT_SLOT_RE.test(x)) || null;
export async function ackOnApproval(env, pre) {
  const entry = typeof pre.entry === "string" ? JSON.parse(pre.entry) : pre.entry;
  let shown = {};
  try { shown = typeof pre.shown === "string" ? JSON.parse(pre.shown) : (pre.shown || {}); } catch (e) { shown = {}; }
  /* V4a: a yes given before the row key named the product is told in the key's shape now */
  const m = await markOrder(env, pre.u, pre.order_id, { ack: entry.at, ledgerKey: POSITION_ENGINE.ovRekey(entry.orderKey, entry.payload && entry.payload.product), sync: { state: "queued", why: "", at: new Date().toISOString() } });
  if (!m || !m.ok) return { ok: false, error: "the row is approved but its mark could not be written to the order" + (m ? " (http " + m.status + ")" : "") };
  /* an order already agreed (a row offered again) has nothing to move; one that ended meanwhile refuses the move,
     and its Cancellation then follows the approved row, as any withdrawal of an agreed order does */
  const r = shown.from !== "placed" ? { ok: true }
    : await moveOrder(env, pre.u, pre.order_id, Object.assign({ status: "acknowledged", delivery: +(entry.payload && entry.payload.delivery) || 0, prepay: entry.prepay === true },
      /* Step 2: the goods the row was drafted at, the site keeping what they placed it at beside it; a yes filed without a
         figure (an older entry's shape) sends none, and the order keeps its own */
      typeof entry.total === "number" && entry.total > 0 ? { total: entry.total } : {},
      /* 10 Oct 2026: the window he chose at Accept, from what he was shown, never a body: this runs minutes later */
      slotShown(shown) ? { slot: slotShown(shown) } : {}));
  /* told once the move is made, or refused for good: the order ended, or was moved already */
  if ((r.ok || r.status === 409) && env.SALT_LEDGER)
    await env.SALT_LEDGER.prepare("UPDATE preapproval SET acked_at=?1 WHERE id=?2").bind(new Date().toISOString(), pre.id).run();
  return r;
}

/** POST /orders/<id>/accept {delivery, hash}. Returns { ok, approved, differs?, waiting?, order?, draft, drafted? }. */
export async function acceptOrder(env, id, body, by, now, mirror) {
  const at = now || new Date();
  const f = await findOrder(env, id);
  if (!f.ok) return f;
  const o = f.order, db = env.SALT_LEDGER;
  mirror = mirror || (db ? bookOnce(db) : null);
  if (!o.code) return { ok: false, status: 409, error: "no desk code is mapped to this account yet: publish the statements again" };
  if (!db) return { ok: false, status: 503, error: "the desk has no ledger binding, so no row can be drafted" };
  if (!body || typeof body.hash !== "string") return { ok: false, status: 400, error: "Accept answers a preview: send the digest the preview gave" };
  /* 05 Oct 2026 (Negotiate): an order whose price they asked for is agreed only by an offer of his that they take, while the
     ask is open; after No thanks or his withdrawal (06 Oct 2026) it is back at its listed price and Accept is his as ever */
  if (o.price && o.status === "placed" && ASKING.includes(o.price.state) && !acceptClosed(o, at)) return { ok: false, status: 409, error: o.price.state === "taken"
    ? "they have taken your offer: its row is drafted at it, so there is nothing to accept here"
    : o.price.from === "accept" ? "an offer is open on this order, waiting on their answer"
    : "they asked for a price on this order: send them an offer, which they take or decline" };
  /* one pending row an order: a yes already given is followed, never given twice; an offer they declined or he withdrew is
     no longer his yes, and goes here rather than at the minute's pass */
  let live = await livePre(db, id, "ack");
  if (live && isOfferPre(live) && live.status === "waiting" && !live.entry && o.price && (!ASKING.includes(o.price.state) || acceptClosed(o, at))) {
    await voidOffers(db, id, at.toISOString()); live = await livePre(db, id, "ack");
  }
  if (live && live.status === "applied") return o.status === "placed"
    ? Object.assign({ approved: true, again: true, draft: live.draft_id }, await ackOnApproval(env, live))   /* its move failed before: again */
    : { ok: true, approved: true, again: true, draft: live.draft_id, order: o };
  if (live) return { ok: false, status: 409, error: live.status === "differs" ? "its row differs from what you saw and waits under Approve"
    : isOfferPre(live) ? "an offer is open on this order, waiting on their answer" : "its row is being drafted: look again in a moment" };
  const again = o.status !== "placed" && ROWED_ON_SITE.includes(o.status) && !!(await rejectedOf(db, id, "ack"));
  if (o.status !== "placed" && !again) return { ok: false, status: 409, error: "this order is " + o.status + ", so there is nothing to accept" };
  const delivery = again ? (+o.delivery || 0) : chargeOf(body);
  if (o.mode === "deliver" && delivery == null) return { ok: false, status: 400, error: "choose the delivery charge first" };
  const pr = again ? { price: null } : priceOf(body);
  if (pr.error) return { ok: false, status: 400, error: pr.error };
  const win = again ? { slot: null } : slotOf(body, o, at);
  if (win.error) return { ok: false, status: win.status, error: win.error };
  if (!again && needsYes(o, { total: pr.price, slot: win.slot }))
    return { ok: false, status: 409, needsYes: true, error: "this raises their price or changes their window: send it to them for their yes" };
  const pv = await previewAck(env, o, o.code, delivery, at, { orders: f.orders, again }, pr.price, mirror);
  if (!pv.ok) return pv;
  const entry = pv.entry;
  delete pv.entry;
  if (pv.hash !== body.hash) return { ok: false, status: 409, differs: true, error: "the row has changed since the card drew it: look at it again before you accept", preview: pv };
  if (o.status === "placed") {
    /* the window is named only on an order that has one, so a Counter not yet carrying windows still reserves the rest */
    const fields = ["status", "product", "qty", "total", "mode", "place", "forFriend", "wantBy"].concat(o.slot ? ["slot"] : []);
    const reserved = await moveOrder(env, o.u, id, { reserveReview: Object.fromEntries(fields.map((key) => [key, o[key] ?? null])) });
    if (!reserved.ok) return reserved;
  }
  const preId = await recordPre(db, { order_id: id, u: o.u, stage: "ack", hash: pv.hash, entry, at: at.toISOString(), by,
    shown: Object.assign({ from: o.status, row: pv.row, flags: pv.flags, pricing: pv.pricing }, win.slot ? { slot: win.slot } : {}) });
  await queueSale(env, entry, false, mirror);   /* which may move entry.at to a free millisecond */
  await db.prepare("UPDATE preapproval SET entry_at=?1, entry=?2 WHERE id=?3").bind(entry.at, JSON.stringify(entry), preId).run();
  /* D6: THE DRAFTER READS THE MIRROR FOR ITSELF, never the card's read above, so a mirror that moved under the tap drafts
     a row that differs from what he saw and waits under Approve (S11 11.11); the yes it tests shares the drafter's read */
  const fresh = bookOnce(db);
  const drafted = await runDrafter(env, { mirror: fresh });
  /* a pass that drafted it before the pre-approval knew its id tests it here instead, on the row as stored */
  let pre = await preById(db, preId);
  if (pre.status === "waiting") { await settlePre(db, pre, await fresh()); pre = await preById(db, preId); }
  const out = { draft: entry.at, drafted };
  if (pre.status === "applied") return Object.assign(out, { approved: true }, await ackOnApproval(env, pre));
  if (pre.status === "differs") {
    await markOrder(env, o.u, id, { sync: { state: "waiting", why: "its pending row differs from what you saw, so it waits under Approve; approving it there moves the order", at: new Date().toISOString() } });
    return Object.assign(out, { ok: true, approved: false, differs: true });
  }
  return Object.assign(out, { ok: true, approved: false, waiting: true });
}

/* ---- NEGOTIATE: HIS OFFER, THEIR ANSWER (his decisions of 05 Oct 2026) ------------------------------------------------
 * A customer may ask for a price on an order (stmt/orders.js, `ask`). He answers with an OFFER, the goods alone, typed on the
 * order card: this drafts the pending row at it exactly as Accept would (previewAck, which refuses it under the floor), and
 * records his yes as an ack pre-approval that WAITS ON THEIR ANSWER, its digest the offer's own, on the row's figures and
 * flags (offerDigest), never the pricing version. Then the site is told the figure and the moment it lapses, OFFER_HOURS on,
 * and their phone is woken. One live offer an order: a new one voids the yes before it (recordPre). Their Accept is a tap
 * on the site, which tells this Worker at once (takeOffer, through the maker bridge) and the minute's deskPass as the net:
 * the row is drafted again at the offer's figure and queued, and the drafter approves it where it lands only on an exact
 * match (D6); otherwise it waits under Approve, marked. The figure stays on that one order (`asked` keeps what it was placed
 * at); the board, a drift and a held card never move by it (rule 5). The lapse is read at the take and nowhere else. */
export const OFFER_HOURS = 48;
/* the states of an ask still open: asked, an offer of his out (lapsed or not), or one they took on its way to its row */
const ASKING = ["asked", "offered", "taken"];
const voidOffers = (db, id, at) => db.prepare("UPDATE preapproval SET status='void', decided_at=?1 WHERE order_id=?2 AND stage='ack' AND status='waiting' AND entry IS NULL AND json_extract(shown,'$.offer') IS NOT NULL").bind(at, id).run();
/** POST /orders/<id>/offer {total, delivery, hash}. Returns { ok, order, offer } or { ok: false, status, error }. */
export async function offerOrder(env, id, body, by, now) {
  const at = now || new Date();
  const f = await findOrder(env, id);
  if (!f.ok) return f;
  const o = f.order, db = env.SALT_LEDGER;
  if (!o.code) return { ok: false, status: 409, error: "no desk code is mapped to this account yet: publish the statements again" };
  if (!db) return { ok: false, status: 503, error: "the desk has no ledger binding, so no row can be drafted" };
  if (o.status !== "placed") return { ok: false, status: 409, error: "this order is " + o.status + ", so there is nothing to offer" };
  /* version 2: an order they asked no price for, or whose offer for their yes is closed, takes his Accept as an offer */
  if (!o.price || acceptClosed(o, at) || (o.price.from !== "accept" && ["passed", "withdrawn"].includes(o.price.state) && +o.total > 0))
    return acceptOffer(env, f, body, by, at);
  /* a retried Send for their yes whose first tap landed is answered with the offer it filed (Fable's review) */
  if (o.price.from === "accept" && body && typeof body.rid === "string" && o.price.offer && o.price.offer.id === body.rid) return { ok: true, again: true, order: o, offer: o.price.offer };
  if (o.price.from === "accept") return { ok: false, status: 409, error: o.price.state === "taken" ? "they have said yes already: its row is drafted at it" : "an offer is open on this order, waiting on their answer" };
  if (o.price.state === "taken") return { ok: false, status: 409, error: "they have taken your offer already: its row is drafted at it" };
  if (!ASKING.includes(o.price.state)) return { ok: false, status: 409, error: "the ask is closed: the order stands at its listed price, so Accept or decline it" };
  /* a tap that already landed is answered with the offer it filed, never filed twice */
  if (body && typeof body.rid === "string" && o.price.offer && o.price.offer.id === body.rid) return { ok: true, again: true, order: o, offer: o.price.offer };
  const pr = priceOf(body);
  if (pr.error) return { ok: false, status: 400, error: pr.error };
  if (pr.price == null) return { ok: false, status: 400, error: "type your price for the goods first" };
  const delivery = o.mode === "deliver" ? chargeOf(body) : 0;
  if (delivery == null) return { ok: false, status: 400, error: "choose the delivery charge first" };
  if (!body || typeof body.hash !== "string") return { ok: false, status: 400, error: "an offer answers a preview: send the digest the preview gave" };
  const live = await livePre(db, id, "ack");
  if (live && !isOfferPre(live)) return { ok: false, status: 409, error: "a yes of yours on this order is already on its way to its row" };
  /* the row at his figure, drafted as Accept would draft it: under the floor it is refused here, before anything is told */
  const pv = await previewAck(env, o, o.code, delivery, at, { orders: f.orders }, pr.price);
  if (!pv.ok) return pv;
  const entry = pv.entry;
  delete pv.entry;
  const hash = await offerDigest(entry, { collection: "sales", row: pv.row, flags: pv.flags });
  if (hash !== body.hash) return { ok: false, status: 409, differs: true, error: "the row has changed since the card drew it: look at it again before you offer", preview: Object.assign(pv, { offerHash: hash }) };
  const until = new Date(at.getTime() + OFFER_HOURS * 3600e3).toISOString();
  /* the tap's own request id names the offer, so a tap sent twice files one offer (the order book's desk rid road) */
  const rid = typeof body.rid === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(body.rid) ? body.rid : "f" + at.getTime().toString(36) + Math.random().toString(36).slice(2, 12).padEnd(10, "0");
  const offer = { id: rid, total: pr.price, delivery, until, qty: +o.qty, product: o.product || "salt" };
  /* THE SITE FIRST, HIS YES SECOND (06 Oct 2026, Fable's review): recorded first, the yes voided the one before it, and a take
     of the old offer landing between found no yes on file and stranded the order at taken. A refused move now leaves the old
     yes standing, and a take that still finds none is queued to wait under Approve (queueOffer) */
  const r = await moveOrder(env, o.u, id, { offer: { id: offer.id, total: offer.total, until }, rid });
  if (!r.ok) return r;
  await recordPre(db, { order_id: id, u: o.u, stage: "ack", hash, entry: null, at: at.toISOString(), by,
    shown: { from: "placed", offer, row: pv.row, flags: pv.flags, prepay: !!entry.prepay } });
  return { ok: true, order: r.order, offer, push: r.push || null, preview: pv };
}
/* VERSION 2: HIS ACCEPT, FOR THEIR YES. What needsYes says they must agree to goes to them as an offer of the whole order as he
   would accept it: the goods, his delivery charge and the window, open until acceptUntil. The row is drafted at it now, as
   Accept drafts it (never under the floor), and his yes waits on theirs exactly as Negotiate's does: their Accept is a take,
   their No thanks withdraws the order, and his own withdrawal or its lapse leaves the order as it was, his to Accept again.
   Refused when nothing needs their yes, and on a sheet of several lines, which one take cannot answer (his Q7). */
async function acceptOffer(env, f, body, by, at) {
  const o = f.order, db = env.SALT_LEDGER, id = o.id;
  if (body && typeof body.rid === "string" && o.price && o.price.offer && o.price.offer.id === body.rid) return { ok: true, again: true, order: o, offer: o.price.offer };
  const pr = priceOf(body);
  if (pr.error) return { ok: false, status: 400, error: pr.error };
  const delivery = o.mode === "deliver" ? chargeOf(body) : 0;
  if (delivery == null) return { ok: false, status: 400, error: "choose the delivery charge first" };
  const win = slotOf(body, o, at);
  if (win.error) return { ok: false, status: win.status, error: win.error };
  if (!needsYes(o, { total: pr.price, slot: win.slot })) return { ok: false, status: 409, error: "nothing here needs their yes: Accept it" };
  if (o.sheet && f.orders.some((x) => x.id !== o.id && x.u === o.u && x.sheet === o.sheet && x.status === "placed"))
    return { ok: false, status: 409, error: "a sheet of several lines is agreed by one Accept: lower it to what they placed, keep their window, or Decline" };
  if (!body || typeof body.hash !== "string") return { ok: false, status: 400, error: "an offer answers a preview: send the digest the preview gave" };
  const live = await livePre(db, id, "ack");
  if (live && !isOfferPre(live)) return { ok: false, status: 409, error: "a yes of yours on this order is already on its way to its row" };
  const pv = await previewAck(env, o, o.code, delivery, at, { orders: f.orders }, pr.price);
  if (!pv.ok) return pv;
  const entry = pv.entry;
  delete pv.entry;
  const hash = await offerDigest(entry, { collection: "sales", row: pv.row, flags: pv.flags });
  if (hash !== body.hash) return { ok: false, status: 409, differs: true, error: "the row has changed since the card drew it: look at it again before you send it", preview: Object.assign(pv, { offerHash: hash }) };
  const rid = typeof body.rid === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(body.rid) ? body.rid : "f" + at.getTime().toString(36) + Math.random().toString(36).slice(2, 12).padEnd(10, "0");
  const total = pr.price != null ? pr.price : +o.total;
  const offer = { id: rid, kind: "accept", total, delivery, slot: win.slot, until: acceptUntil(at, win.slot), qty: +o.qty, product: o.product || "salt" };
  /* the site first, his yes second, as for Negotiate */
  const r = await moveOrder(env, o.u, id, { offer: { id: offer.id, kind: "accept", total, delivery, slot: win.slot, until: offer.until }, rid });
  if (!r.ok) return r;
  await recordPre(db, { order_id: id, u: o.u, stage: "ack", hash, entry: null, at: at.toISOString(), by,
    shown: { from: "placed", offer, row: pv.row, flags: pv.flags, prepay: !!entry.prepay } });
  return { ok: true, order: r.order, offer, push: r.push || null, preview: pv };
}
/** POST /orders/<id>/withdraw: his open offer taken back; his yes with it. */
export async function withdrawOffer(env, id, body) {
  const f = await findOrder(env, id);
  if (!f.ok) return f;
  const o = f.order;
  if (!o.price || o.price.state !== "offered") return { ok: false, status: 409, error: "no offer of yours is open on this order" };
  const r = await moveOrder(env, o.u, id, Object.assign({ withdraw: true }, body && typeof body.rid === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(body.rid) ? { rid: body.rid } : {}));
  if (!r.ok) return r;
  if (env.SALT_LEDGER) await voidOffers(env.SALT_LEDGER, id, new Date().toISOString());
  return { ok: true, order: r.order };
}
/** THEIR ACCEPT, followed: the row drafted at the offer and queued, approved where it lands only if it equals what he offered. */
export async function takeOffer(env, id, now, mirror) {
  const at = now || new Date();
  const f = await findOrder(env, id);
  if (!f.ok) return f;
  const o = f.order, db = env.SALT_LEDGER;
  if (!db) return { ok: false, status: 503, error: "the desk has no ledger binding, so no row can be drafted" };
  mirror = mirror || bookOnce(db);
  if (!o.code) return { ok: false, status: 409, error: "no desk code is mapped to this account yet: publish the statements again" };
  if (!o.price || o.price.state !== "taken") return { ok: false, status: 409, error: "no offer of yours is taken on this order" };
  const pre = await livePre(db, id, "ack");
  if (!pre || !isOfferPre(pre)) return o.status === "placed" ? queueOffer(env, f, null, "no yes of yours was on file for the offer they took", at, mirror)
    : { ok: false, status: 409, error: "this order is " + o.status + ", so there is nothing to take" };
  if (pre.status === "applied") return o.status === "placed" ? Object.assign({ approved: true, again: true, draft: pre.draft_id }, await ackOnApproval(env, pre))
    : { ok: true, approved: true, again: true, draft: pre.draft_id, order: o };
  if (pre.status === "differs") return { ok: true, approved: false, differs: true, again: true };
  if (o.status !== "placed") return { ok: false, status: 409, error: "this order is " + o.status + ", so there is nothing to take" };
  const shown = JSON.parse(pre.shown || "{}"), off = shown.offer || {};
  /* bound to the offer they saw, the order's product and size, and its lapse, read at the take */
  const bad = !o.price.offer || o.price.offer.id !== off.id ? "the offer they took is not the one on file"
    : String(o.price.takenAt || "") > String(off.until) ? "they took it after it lapsed"
    : o.product !== off.product || Math.abs(+o.qty - +off.qty) > 0.0004 ? "the order is no longer the size the offer was made for" : "";
  if (bad) {
    /* the bridge's nudge and the minute's pass can both get here: only the one that voids the yes queues the row (queueSale
       moves a second entry to a free millisecond, never dropping it, so two takes would be two rows) */
    const v = await db.prepare("UPDATE preapproval SET status='void', decided_at=?1 WHERE id=?2 AND status='waiting'").bind(at.toISOString(), pre.id).run();
    if (!(v && v.meta && v.meta.changes === 1)) return { ok: true, again: true };
    return queueOffer(env, f, off, bad, at, mirror);
  }
  if (!pre.entry_at) {
    const pv = await previewAck(env, o, o.code, off.delivery || 0, at, { orders: f.orders }, off.total, mirror);
    if (!pv.ok) {
      await markOrder(env, o.u, id, { sync: { state: "waiting", why: "they took your offer, but its row could not be drafted: " + pv.error, at: new Date().toISOString() } });
      return pv;
    }
    const entry = pv.entry;
    await queueSale(env, entry, false, mirror);   /* which may move entry.at to a free millisecond */
    await db.prepare("UPDATE preapproval SET entry_at=?1, entry=?2 WHERE id=?3").bind(entry.at, JSON.stringify(entry), pre.id).run();
  }
  const fresh = bookOnce(db);   /* D6, as at Accept: the drafter's own read, shared with the yes it tests */
  const drafted = await runDrafter(env, { mirror: fresh });
  let p = await preById(db, pre.id);
  if (p.status === "waiting") { await settlePre(db, p, await fresh()); p = await preById(db, pre.id); }
  const out = { draft: p.entry_at, drafted };
  if (p.status === "applied") return Object.assign(out, { approved: true }, await ackOnApproval(env, p));
  if (p.status === "differs") {
    await markOrder(env, o.u, id, { sync: { state: "waiting", why: "they took your offer, but its row differs from what you offered, so it waits under Approve; approving it there moves the order", at: new Date().toISOString() } });
    return Object.assign(out, { ok: true, approved: false, differs: true });
  }
  return Object.assign(out, { ok: true, approved: false, waiting: true });
}
/* A TAKEN OFFER WITH NO YES THAT FITS IT IS NEVER STRANDED (06 Oct 2026, Fable's review): its row is queued at the offer's
   figure under a yes that cannot match (its reason for a digest), so the drafter marks it and it waits under Approve, where
   approving it moves the order as any Accept that came out other than he saw. Once queued, a take finds that yes. */
async function queueOffer(env, f, off, why, at, mirror) {
  const o = f.order, db = env.SALT_LEDGER, offer = o.price.offer || {};
  const delivery = off && typeof off.delivery === "number" ? off.delivery : 0;
  const say = (w) => markOrder(env, o.u, o.id, { sync: { state: "waiting", why: w, at: new Date().toISOString() } });
  const pv = await previewAck(env, o, o.code, delivery, at, { orders: f.orders }, +offer.total, mirror);
  if (!pv.ok) { await say("they took your offer, but its row could not be drafted: " + pv.error); return pv; }
  const entry = pv.entry;
  await queueSale(env, entry, false, mirror);   /* which may move entry.at to a free millisecond */
  const preId = await recordPre(db, { order_id: o.id, u: o.u, stage: "ack", hash: "unmatched: " + why, entry, at: at.toISOString(), by: "take",
    shown: { from: "placed", offer: Object.assign({ product: o.product, qty: +o.qty, delivery }, offer), row: pv.row, flags: pv.flags, unmatched: why } });
  await db.prepare("UPDATE preapproval SET entry_at=?1, entry=?2 WHERE id=?3").bind(entry.at, JSON.stringify(entry), preId).run();
  const drafted = await runDrafter(env);   /* D6: the drafter's own read */
  await say("they took your offer, but " + why + ", so its row waits under Approve" + (o.mode === "deliver" ? " at no delivery charge" : "")
    + "; approving it there moves the order");
  return { ok: true, approved: false, differs: true, unmatched: why, draft: entry.at, drafted };
}
/* the minute's net for the offers: a take not followed yet is followed, and an offer they declined or he withdrew lets its yes
   go. An offer past its lapse is left: it is read at a take and nowhere else. */
async function offerPass(env, now, mirror) {
  const db = env.SALT_LEDGER;
  let rows = [];
  try { rows = (await db.prepare("SELECT order_id FROM preapproval WHERE stage='ack' AND status='waiting' AND entry_at IS NULL AND json_extract(shown,'$.offer') IS NOT NULL").all()).results || []; }
  catch (e) { return []; }
  if (!rows.length) return [];
  const all = await listOrders(env, true);
  if (!all.ok) return [];
  const taken = [];
  for (const { order_id: id } of rows) {
    const o = all.orders.find((x) => x.id === id);
    if (o && o.status === "placed" && o.price && o.price.state === "taken") {
      try { const r = await takeOffer(env, id, now, mirror); if (r && r.approved && r.draft) taken.push(r.draft); } catch (e) { /* the next minute tries again */ }
    } else if (!o || o.status !== "placed" || !o.price || ["passed", "withdrawn"].includes(o.price.state)) await voidOffers(db, id, (now || new Date()).toISOString());
  }
  return taken;
}
export async function amendOrder(env, id, body) {
  if (!env.SALT_LEDGER) return { ok: false, status: 503, error: "the Desk mirror is required to check this amendment" };
  const found = await findOrder(env, id);
  if (!found.ok) return found;
  if (found.order.u !== body.u) return { ok: false, status: 404, error: "no such order" };
  const owner = (await usersMap(env))[body.u];
  if (!owner || !POSITION_ENGINE.ownsCode(owner, found.order.code)
    || found.order.ledgerKey && !POSITION_ENGINE.ownsCode(owner, found.order.ledgerKey.split("|")[0]))
    return { ok: false, status: 404, error: "no such order" };
  const replacement = Object.assign({}, body);
  delete replacement.u;
  const relay = async () => {
    const response = await site(env, "/desk/orders/" + encodeURIComponent(found.order.u) + "/" + id + "/replace", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(replacement)
    });
    if (!response) return { ok: false, status: 503, error: "the Counter relay is not configured" };
    const result = await response.json();
    return response.ok && result.ok ? result : Object.assign({}, result, { ok: false, status: response.status });
  };
  if (found.order.replacement) return relay();
  if (found.order.status !== "placed" || found.order.reviewed || found.order.ledgerKey || (found.order.queued || {}).ack)
    return { ok: false, status: 409, error: "this order is already under review or agreed", code: "amendClosed" };
  const pre = await env.SALT_LEDGER.prepare(
    "SELECT id, shown, status FROM preapproval WHERE order_id=?1 AND status IN ('waiting','differs','applied') LIMIT 1"
  ).bind(id).first();
  /* 05 Oct 2026 (Negotiate): an offer of his open on it freezes it, in the customer's words (offer open); one they declined,
     he withdrew or that lapsed is no longer his yes, and goes as the order is changed */
  if (pre && isOfferPre(pre) && pre.status === "waiting") {
    const p = found.order.price || {}, now = new Date().toISOString();
    if (p.state === "offered" && p.offer && now <= String(p.offer.until)) return { ok: false, status: 409, error: "an offer is open on this order", code: "offerOpen" };
    if (p.state === "taken") return { ok: false, status: 409, error: "this order is already under review or agreed", code: "amendClosed" };
    await env.SALT_LEDGER.prepare("UPDATE preapproval SET status='void', decided_at=?1 WHERE id=?2 AND status='waiting'").bind(now, pre.id).run();
  } else if (pre) return { ok: false, status: 409, error: "this order has already been approved for a row and cannot be changed" };
  if (body.product !== found.order.product) return { ok: false, status: 400, error: "replace the same product line" };
  if (!env.ASSETS) return { ok: false, status: 503, error: "the Desk revision is unavailable" };
  const revisionResponse = await env.ASSETS.fetch(new Request("https://desk/rev.json"));
  if (!revisionResponse.ok) return { ok: false, status: 503, error: "the Desk revision is unavailable" };
  const revision = await revisionResponse.json(), book = await readBook(env.SALT_LEDGER);
  if (!revision || !/^[a-f0-9]{16}$/.test(revision.id || "") || !book.version || book.version !== revision.v)
    return { ok: false, status: 409, error: "the Desk mirror is updating", code: "amendPrices" };
  const quoted = cardAt(book.pricing, owner, body.product, body.qty).card;
  const floor = floorFor(book, body.product, body.qty);
  if (!Number.isFinite(quoted) || !(quoted > 0) || !floor || floor.exact !== true || quoted < floor.floor)
    return { ok: false, status: 409, error: "this size has no current card above the floor", code: "amendPrices" };
  Object.assign(replacement, { total: quoted, unit: +(quoted / body.qty).toFixed(2), buildId: revision.id });
  return relay();
}

/* ---- COLLECTED, CASH RECEIVED, RECEIVED: A YES FOR A ROW NOT DRAFTED YET (S11 11.12, D6) ----------
 * Each later stage is one tap too. The tap builds the entry exactly as it will be queued (the reconcile's own
 * builder, stamped as the reconcile stamps it), drafts it now against the book, or, before the first row has
 * landed, against the book as it will stand when it does (withPending), and records the digest of that draft
 * as his yes. The drafter spends it when the real row is drafted, only if equal: the kind, party, target,
 * date, figures and every flag. So a stage that waits on the first row NEVER WAITS SILENTLY: it is booked
 * when that row lands, and the card can say so ("waits": true). The pricing version is not part of it,
 * because the first row landing is itself a fold. */
async function stagePreview(env, o, stage, entry, mirror) {
  const db = env.SALT_LEDGER;
  const book = await (mirror ? mirror() : readBook(db));
  const open = (book.state && book.state.OPEN && book.state.OPEN.byKey) || {};
  let rd = null;
  if (!open[entry.payload.orderKey] && o.queued && o.queued.redate) {
    const pending = await queuedAt(env, o.queued.redate);
    if (pending) rd = { entry: JSON.stringify(pending), status: "pending" };
    else rd = await db.prepare("SELECT entry,status FROM draft WHERE entry LIKE ?1 AND entry LIKE '%\"redate\":true%' ORDER BY id DESC LIMIT 1")
      .bind('%"orderId":"' + o.id + '"%').first();
  }
  /* the pending row a stage waits on, when the book's own does not hold the row yet (engine/stages.mjs stageAgainst) */
  const ack = o.queued && o.queued.ack;
  const ackRow = ack && ackRowWanted(book, entry, rd) ? await db.prepare("SELECT row,status FROM draft WHERE id=?1").bind(ack).first() : null;
  const ag = stageAgainst(book, entry, rd, ackRow);
  if (!ag.ok) return ag;
  const d = draftRow(entry, ag.against);
  if (d.skip) return { ok: false, status: 409, error: "the drafter would not draft it: " + d.skip };
  return { ok: true, waits: ag.waits, d, hash: await stageDigest(stage, entry, d, null) };
}
const yesWords = (waits) => (waits ? "Booked when the first row lands" : "Booked as it is drafted");
async function stageTap(env, id, body, by, now, stage, build, mirror) {
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
  mirror = mirror || (db ? bookOnce(db) : null);   /* the tap's one read: the preview, the yes it tests and the route's tail */
  const pv = await stagePreview(env, o, stage, b.entry, mirror);
  if (!pv.ok) return pv;
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
  const spent = pre.status === "waiting" && b.pin ? await settlePre(db, pre, await mirror()) : null;
  /* 06 Oct 2026: a close or an amendment under what they paid says what opens with it: the refund the fold raises */
  return { ok: true, order: o, push, preapproval: Object.assign({ stage, waits: pv.waits, says: yesWords(pv.waits), flags: pv.d.flags, spent: spent || null,
    draft: spent ? (await preById(db, preId)).draft_id : null }, b.refund > 0.004 ? { refund: +b.refund.toFixed(2) } : {}) };
}
const ROWED_ON_SITE = ["acknowledged", "ready", "done"];

/** POST /orders/<id>/handed {qty, close}: Collected or Delivered, in the order's own mode, the running total handed over. */
export async function handedOrder(env, id, body, by, now, mirror) {
  const rej = await rejectedOf(env.SALT_LEDGER, id, "move");
  return stageTap(env, id, body, by, now, "move", (o, at) => handoverTap(o, body, at, rej), mirror);
}

/** POST /orders/<id>/received {amount}: the payment they recorded is in his bank. The site already counts it. */
export async function receivedOrder(env, id, body, by, now, mirror) {
  mirror = mirror || (env.SALT_LEDGER ? bookOnce(env.SALT_LEDGER) : null);   /* the room's read and the tap's are one */
  if (body && body.covered === true) return notFoundOrder(env, id, body, now, true);   /* S6 fix: on the book already */
  const rej = await rejectedOf(env.SALT_LEDGER, id, "pay");
  /* their payment may be drafted already (the reconcile queues it within the minute once the row is on the book),
     and then that draft's own entry is the one his yes answers */
  let queued = [], shut = new Set(), onRows = {}, way = null;
  if (env.SALT_LEDGER) {
    const rs = await env.SALT_LEDGER.prepare("SELECT id,entry FROM draft WHERE status='pending' AND entry LIKE ?1 ORDER BY id DESC").bind('%"orderId":"' + id + '"%').all();
    queued = (rs.results || []).map((r) => { try { return JSON.parse(r.entry); } catch (e) { return null; } })
      .filter((e) => e && e.orderId === id && e.status === "Payment" && !e.counter);
    /* S6 11.14: a claim's entry filed not found never lands, so that claim is not received after it */
    const rj = await env.SALT_LEDGER.prepare("SELECT id FROM draft WHERE status='rejected' AND decided_by='notfound' AND entry LIKE ?1").bind('%"orderId":"' + id + '"%').all();
    shut = new Set((rj.results || []).map((r) => r.id));
    way = await paysOnWay(env.SALT_LEDGER);   /* read once: the claims' rows and the room both take it */
    onRows = await acctInFlight(env.SALT_LEDGER, null, way);
  }
  const room = env.SALT_LEDGER ? await rowRoom(env.SALT_LEDGER, "SELL", way, mirror) : null;
  return stageTap(env, id, body, by, now, "pay", (o, at) => receivedTap(o, at, body, { queued, shut, onRows, rej, room }), mirror);
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
    const q = await queuedAt(env, at);
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
  const verdict = covered ? { kind: "received", covered: true, claim: p.at, amount: p.amount } : { kind: "notfound", claim: p.at, amount: p.amount };
  /* Counter Admin's tap carries an immutable id, which the order book keeps so a retry lands once */
  return moveOrder(env, o.u, id, Object.assign({ verdict }, typeof body.rid === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(body.rid) ? { rid: body.rid } : {}));
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
/* 28 Sep 2026, s210: ON ITS WAY UNTIL THE MIRROR HAS IT. The chain marks a row committed before it re-seeds the mirror,
   with a push between (cloud-commit.yml), so for those seconds a folded row was neither on its way by committed_at nor on
   the mirror, and a tap in them saw neither. A row committed after the mirror was seeded (snapshot.at) is still on its way. */
const ON_ITS_WAY = "(status='pending' OR (status='approved' AND (committed_at IS NULL OR committed_at > (SELECT at FROM snapshot WHERE one=1))))";
/* every payment on its way to a sale's row: a Fulfilment carrying cash, pending, or approved and not yet on the mirror */
async function paysOnWay(db, direction = "SELL") {
  const rs = await db.prepare("SELECT entry FROM draft WHERE " + ON_ITS_WAY + " AND (entry LIKE ?1 OR entry LIKE ?2 OR entry LIKE ?3)")
    .bind('%"kind":"Fulfilment"%', '%"kind":"Correction"%', '%"kind":"Payment"%').all();
  const out = [];
  for (const r of rs.results || []) {
    let e = null; try { e = JSON.parse(r.entry); } catch (x) { e = null; }
    const p = e && e.payload;
    if (p && p.mode === "amend" && (direction === "BUY" ? p.direction === "BUY" : p.direction !== "BUY")
      && ((p.kind === "Fulfilment" || p.kind === "Payment" && direction === "BUY") && +p.cash > 0.004
        || p.kind === "Correction" && p.fields && (+p.fields.cash > 0.004 || +p.fields.settledRM > 0.004)))
      out.push(e);
  }
  return out;
}
/* the row a payment names, by its key: the rid first, as the fold finds it, then the key it was queued under */
function rowKeyer(sales) {
  const byRid = new Map();
  for (const s of sales || []) if (s && s.rid) byRid.set(s.rid, POSITION_ENGINE.ovKey(s));
  return (p) => (p.rid && byRid.get(p.rid)) || p.orderKey || null;
}
async function acctInFlight(db, except, way) {
  const by = {};
  for (const e of way || await paysOnWay(db)) {
    const k = e.claimId && e.claimId !== except && e.payload.orderKey;
    if (k) by[k] = +((by[k] || 0) + (+e.payload.cash || 0)).toFixed(2);
  }
  return by;
}
/* 28 Sep 2026, s210: WHAT A ROW CAN STILL TAKE, by its key: what the mirror says it owes, the goods and the delivery less
   what was paid, less every payment on its way to it by any road (a claim against the account, a claim of theirs on an
   order, cash at the counter, a payment typed on the desk), a tap's own entry left out. The site's figure for an order
   knows its own moves at once and a claim against the account never; the mirror knows every folded row and nothing on its
   way; a tap that books money answers to both. null where the mirror has no row by that key yet, and there the fold's own
   rule measures. */
export async function rowRoom(db, direction = "SELL", onWay, mirror) {
  /* 30 Sep 2026: the book and the payments on their way are two reads that wait on nothing of each other, so both go at once */
  const [book, way] = await Promise.all([(mirror ? mirror() : readBook(db)).catch(() => null), onWay || paysOnWay(db, direction)]);
  const isSale = direction !== "BUY";
  const sales = ((book && book[isSale ? "sales" : "purchases"]) || []).filter((s) => s && !s.cancelled);
  const keyOf = rowKeyer(sales), byRid = new Map(sales.filter((s) => s.rid).map((s) => [s.rid, s]));
  const byKey = new Map(), on = {};
  for (const s of sales) {
    const key = POSITION_ENGINE.ovKey(s);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(s);
  }
  for (const e of way) { const k = keyOf(e.payload); if (k) (on[k] = on[k] || []).push(e); }
  return Object.assign((key, own) => {
    const matches = key ? byKey.get(key) || [] : [];
    const rid = own && own.payload && own.payload.rid;
    const s = rid ? byRid.get(rid) : matches.length === 1 ? matches[0] : null;
    if (!s) return null;
    const paid = (row) => isSale ? POSITION_ENGINE.txPaid(row) : POSITION_ENGINE.poCash(row);
    const way = +((on[key] || []).filter((e) => (!own || e.at !== own.at)
      && (!e.payload.rid || e.payload.rid === s.rid)).reduce((n, e) => {
      const p = e.payload;
      return n + (p.kind === "Correction" ? Math.max(0, paid({ ...s, ...p.fields }) - paid(s)) : +p.cash);
    }, 0)).toFixed(2);
    const owes = +Math.max(0, isSale ? POSITION_ENGINE.txOwed(s) - POSITION_ENGINE.txPaid(s)
      : (+s.total || 0) - POSITION_ENGINE.poCash(s)).toFixed(2);
    return { owes, on: way, left: +Math.max(0, owes - way).toFixed(2) };
  }, { version: book && book.version });
}
/* and (pay terms V2, 28 Sep 2026) the rows of the claimant's orders he has made Ready, by their key, which the engine's
   allocation takes as owing all that is left on them: an order at Ready is due at once, a cash-on-handover one included
   (his C1). Read off the same list, so nothing more is fetched. An order at Ready with no row on the book yet has no key,
   so what it would take is left over, and Received refuses that on a tap until the fold lands it. */
/* 28 Sep 2026, s210 TO s212: A DONE ORDER'S FIGURE IS FINAL, AND IT CAN OUTLIVE WHAT THE BOOK HOLDS. Its key can outlive its row: a row
   moved to the resale account leaves its order naming the old key, which a new row of theirs that day at that figure
   carries, and the order's paid, read against that row's cash, took it as paid. And its paid can outlive the money: a
   Cash received tapped by mistake and corrected off the row stays paid on the site, where no road lowers it. So a done
   order's money is on its way only until the book has it: paid past the ledger's mark of it (queued); its own entries
   queued and not yet drafted, a tap of his held on his yes or queued (the pre-approval's entry) and a claim of theirs the
   reconcile queued (named on the order); and its drafts not yet on the mirror, each by the row it names. */
async function heldPays(db) {
  let rs = [];
  try { rs = (await db.prepare("SELECT entry,entry_at FROM preapproval WHERE status IN ('waiting','differs') AND entry IS NOT NULL").all()).results || []; }
  catch (e) { rs = []; }   /* a store before migrations/0011 */
  return rs.map((r) => { let e = null; try { e = JSON.parse(r.entry); } catch (x) { e = null; } return { at: r.entry_at || null, e }; })
    .filter((p) => p.e && p.e.orderId && p.e.payload && p.e.payload.kind === "Fulfilment" && +p.e.payload.cash > 0.004);
}
/* by the hundred: D1 binds at most 100 values a statement, and a claimant's received claims only grow */
async function draftedOf(db, ids) {
  const out = new Set();
  for (let i = 0; i < ids.length; i += 100) {
    const part = ids.slice(i, i + 100);
    const rs = (await db.prepare("SELECT id FROM draft WHERE id IN (" + part.map((x, j) => "?" + (j + 1)).join(",") + ")").bind(...part).all()).results || [];
    for (const r of rs) out.add(r.id);
  }
  return out;
}
async function inFlight(env, db, c, sales) {
  const all = await listOrders(env, true);
  if (!all.ok) return null;
  const by = {}, keyOf = rowKeyer(sales);
  const add = (k, rm) => { rm = +(+rm).toFixed(2); if (k && rm > 0.004) by[k] = +((by[k] || 0) + rm).toFixed(2); };
  const done = new Map(all.orders.filter((o) => o.u === c.u && o.status === "done").map((o) => [o.id, o]));
  /* a claim against the account's own rows are its own; an open order's own moves are read off the site below, which knows
     them at once; the rest (other claims against the account, a payment typed on the desk, a done order's own drafts) are
     on their way to the rows they name */
  for (const e of await paysOnWay(db)) {
    if ((e.claimId && e.claimId === c.id) || (e.orderId && !done.has(e.orderId))) continue;
    add(keyOf(e.payload), e.payload.cash);
  }
  const wait = (await heldPays(db)).filter((p) => done.has(p.e.orderId)).map((p) => ({ id: p.at, k: keyOf(p.e.payload), rm: p.e.payload.cash }));
  for (const o of done.values()) for (const p of o.payments || []) if (p && p.claim === "received" && p.queued) wait.push({ id: p.queued, k: ledgerKeyOf(o), rm: p.amount });
  const drafted = await draftedOf(db, wait.map((w) => w.id).filter(Boolean));
  for (const w of wait) if (!w.id || !drafted.has(w.id)) add(w.k, w.rm);
  return claimOrderFlight(sales, all.orders, c.u, by, await offBook(db, all.orders.filter((o) => o.u === c.u && o.ledgerKey && !done.has(o.id))));
}
/** Ids of the orders with no row on the book: the ack draft rejected (by him, covered or withdrawn) and no draft approved. One read of the rejected pending drafts; only
    their orders are then read draft by draft. */
export async function offBook(db, orders) {
  const off = new Set();
  if (!db || !orders.length) return off;
  try {
    const want = new Set(orders.map((o) => o.id));
    const rs = await db.prepare("SELECT entry FROM draft WHERE status='rejected' AND entry LIKE ?1").bind('%"status":"Pending"%').all();
    const ids = [...new Set((rs.results || []).map((r) => { try { return JSON.parse(r.entry).orderId; } catch (e) { return null; } }).filter((x) => x && want.has(x)))];
    /* a yes waiting on the pending row, or any draft still pending, keeps the order on the book */
    const live = new Set(((await db.prepare("SELECT order_id FROM preapproval WHERE stage='ack' AND status IN ('waiting','differs')").all()).results || []).map((r) => r.order_id));
    for (const id of ids) {
      if (live.has(id)) continue;
      const all = await draftsOfOrders(db, [id]), ack = all.find((r) => ofStage(r, "ack"));
      if (ack && ack.status === "rejected" && !all.some((r) => r.status === "approved" || r.status === "pending")) off.add(id);
    }
  } catch (e) { /* unreadable: the order counts as it did */ }
  return off;
}
export async function fixtureClaimPreview(snapshot, u, id, generation) {
  if (!["0000-0000", "0000-0001"].includes(u) || !snapshot?.prepared
    || !Array.isArray(snapshot.account?.sales) || !Array.isArray(snapshot.account?.claims)
    || !Array.isArray(snapshot.orders) || !Number.isInteger(snapshot.account.revision))
    return { ok: false, error: "Publish the new acceptance cases before previewing example claims.", status: 409 };
  const claim = snapshot.account.claims.find((c) => c.id === id && c.u === u);
  if (!claim) return { ok: false, error: "No such acceptance claim.", status: 404 };
  if (claim.state !== "waiting") return { ok: false, error: "That acceptance claim is answered already.", status: 409 };
  const sales = snapshot.account.sales, flight = claimOrderFlight(sales, snapshot.orders, u);
  const adjusted = sales.map((s) => Object.assign({}, s, { cash: +((+s.cash || 0) + (flight.by[POSITION_ENGINE.ovKey(s)] || 0)).toFixed(2) }));
  const allocation = POSITION_ENGINE.claimAlloc(adjusted, "TX0-FIX", claim.amount, flight.ready);
  const hash = await hex(JSON.stringify({ generation, revision: snapshot.account.revision, claim, allocation }));
  return { ok: true, test: true, claim, rows: allocation.rows, left: allocation.left, hash,
    generation, revision: snapshot.account.revision };
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
export async function claimPreview(env, id, mirror) {
  const f = await findClaim(env, id);
  if (!f.ok) return f;
  const c = f.claim, db = env.SALT_LEDGER;
  if (!c.code) return { ok: false, status: 409, error: "no desk code is mapped to this account yet: publish the statements again" };
  if (!db) return { ok: false, status: 503, error: "the desk has no ledger binding, so no row can be drafted" };
  if (c.state !== "waiting") return { ok: false, status: 409, error: "that claim is answered already" };
  const booked = await claimBooked(db, c.id);
  if (booked) return { ok: true, claim: c, rows: booked, left: 0, booked: true, own: [] };
  const book = await (mirror ? mirror() : readBook(db));
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
export async function claimReceived(env, id, body, by, now, mirror) {
  const at = now || new Date();
  mirror = mirror || (env.SALT_LEDGER ? bookOnce(env.SALT_LEDGER) : null);
  const pv = await claimPreview(env, id, mirror);
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
    if (!was) await queueSale(env, e, false, mirror);
    await db.prepare("UPDATE preapproval SET entry_at=?1, entry=?2 WHERE id=?3").bind(e.at, JSON.stringify(e), preId).run();
    pres.push(preId);
  }
  const fresh = bookOnce(db);   /* D6, as at Accept: the drafter's own read, shared with the yes each row tests */
  const drafted = pres.length ? await runDrafter(env, { mirror: fresh }) : null;
  const book = pres.length ? await fresh() : null;
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
export async function cashOrder(env, id, body, by, now, mirror) {
  mirror = mirror || (env.SALT_LEDGER ? bookOnce(env.SALT_LEDGER) : null);   /* the room's read and the tap's are one */
  const rej = await rejectedOf(env.SALT_LEDGER, id, "cash");
  const room = env.SALT_LEDGER ? await rowRoom(env.SALT_LEDGER, "SELL", undefined, mirror) : null;
  return stageTap(env, id, body, by, now, "cash", (o, at) => cashTap(o, at, body, { rej, room }), mirror);
}

/** POST /orders/<id>/restate {qty, total, delivery}: his decision of 06 Oct 2026, that EVERYTHING ON AN AGREED ORDER IS AMENDABLE,
 *  the size, the goods' price and the delivery charge. One Correction restating the row, for approval, the digest of what he
 *  was shown; the floor holds at the size and the board is never repriced, the row waits for money on its way to it
 *  (rowRoom, which the fold's payFault repeats), under what is paid the fold raises the refund (06 Oct 2026), and one
 *  amendment is in flight at a time. */
export async function restateOrder(env, id, body, by, now, mirror) {
  mirror = mirror || (env.SALT_LEDGER ? bookOnce(env.SALT_LEDGER) : null);   /* the room's read, the book's and the tap's are one */
  const db = env.SALT_LEDGER;
  const room = db ? await rowRoom(db, "SELL", undefined, mirror) : null;
  const book = mirror ? await mirror().catch(() => null) : null;
  const earlier = db ? await db.prepare("SELECT id,status,committed_at FROM draft WHERE entry LIKE ?1 AND entry LIKE '%\"status\":\"Amendment\"%' ORDER BY id DESC").bind('%"orderId":"' + id + '"%').all().catch(() => ({ results: [] })) : { results: [] };
  const live = db ? await livePre(db, id, "amend").catch(() => null) : null;
  return stageTap(env, id, body, by, now, "amend", (o, at) => restateTap(o, at, body, { book, room, earlier: earlier.results || [], live }), mirror);
}

/* ---- OFFERED AGAIN (S11 11.13, D6) ----------------------------------------------------------------
 * A row he rejects under Approve is written back onto its order (rejectedOnOrder), and the move that made it
 * is OFFERED AGAIN: the card's own tap for that stage (Accept, Collected, Received, Cash received) or
 * `/again {stage}` queues the same move under a FRESH ENTRY, a new moment and so a new draft id, because the
 * rejected id is refused for good. It is his yes like any other tap, spent only if the fresh row equals what
 * he was shown. The rejected entry is the move: its figures and its day are kept, and only its moment is new.
 * GET /orders says which stages an order has to offer again (`again`), read off the drafts. */
const STATUS_OF_STAGE = { ack: "Pending", pay: "Payment", cash: "Payment", move: "Handover", cancel: "Cancellation", amend: "Amendment" };
const STAGE_WORD = { ack: "pending row", pay: "payment", cash: "cash payment", move: "handover", cancel: "cancellation", amend: "amendment" };
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
/* 'covered' and 'covered:<rid>' (the hand row that holds the cash) are the same filing */
const isCovered = (by) => by === "covered" || String(by || "").startsWith("covered:");
const rejectedByHim = (d) => !!d && d.status === "rejected" && !["withdrawn", "notfound"].includes(d.decided_by) && !isCovered(d.decided_by);   /* S6: nor a claim not found, or on the book already */
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
  /* each order's drafts are their own question of the store: asked together, the stages of one still in their own order */
  await Promise.all(hit.map(async (id) => {
    let all = [];
    try { all = await draftsOfOrders(db, [id]); } catch (e) { return; }
    for (const st of Object.keys(STATUS_OF_STAGE)) if (rejectedByHim(all.find((r) => ofStage(r, st)))) (out[id] = out[id] || []).push(st);
  }));
  return out;
}
/** What Not needed may cover on an order: { whole, stages }. Whole when his ack was rejected and no draft on the order is approved (no row on the book). */
export async function dropMode(db, id) {
  const all = await draftsOfOrders(db, [id]);
  const stages = Object.keys(STATUS_OF_STAGE).filter((st) => rejectedByHim(all.find((r) => ofStage(r, st))));
  return { whole: stages.includes("ack") && !all.some((r) => r.status === "approved"), stages };
}
/** POST /orders/<id>/again {stage}: a payment, cash payment, handover or cancellation he rejected, offered again. */
export async function againOrder(env, id, body, by, now, mirror) {
  mirror = mirror || (env.SALT_LEDGER ? bookOnce(env.SALT_LEDGER) : null);   /* the room's read and the preview's are one */
  const at = now || new Date();
  const stage = String((body && body.stage) || "");
  /* a rejected step he says is on the book already is filed 'covered', so it is offered no more. Whole-order mode: his ack was rejected and no
     draft is approved, so the order has no row and every rejected stage but pay goes; with a row, only cancel, move or amend, named. All or none. */
  if (body && body.drop === true) {
    const f = await findOrder(env, id);
    if (!f.ok) return f;
    const db = env.SALT_LEDGER;
    if (!db) return { ok: false, status: 503, error: "the desk has no ledger binding, so no row can be filed" };
    const m = await dropMode(db, id);
    let want;
    if (m.whole) {
      if (body.stage !== undefined && body.stage !== "") return { ok: false, status: 400, error: "this order has no row on the book: Not needed covers the whole order" };
      if (m.stages.includes("pay")) return { ok: false, status: 409, error: "answer their payment claim with Received first: on the book already" };
      want = m.stages;
    } else {
      if (!["cancel", "move", "amend"].includes(stage)) return { ok: false, status: 400, error: "pay and cash are answered by Received or Cash, on the book already; a pending row by Accept again" };
      want = m.stages.includes(stage) ? [stage] : [];
    }
    for (const st of want) { const lv = await livePre(db, id, st); if (lv && (lv.status === "waiting" || lv.status === "differs")) return { ok: false, status: 409, error: "the " + STAGE_WORD[st] + " is offered again already: let it land first" }; }
    const o = f.order;
    let onRow = null, taken = false, known = [];
    if (m.whole && (+o.paid || 0) > 0) {
      /* money paid on the site is on the book already, or Not needed would strand it: a cash Fulfilment covered never lands, and a paid cancellation owes a refund */
      if (want.includes("cancel")) return { ok: false, status: 409, error: "a paid cancellation owes a refund; send it again" };
      const book = await (mirror || bookOnce(db))().catch(() => null), party = partyOnBook(o, o.code), day = String(o.at || "").slice(0, 10);
      /* a site order's own row is no proof of another's cash: rows are told apart by key, the keys of every site order's row being known */
      const all = await listOrders(env, true), offs = await offBook(db, all.ok ? all.orders : []);
      /* an order with no row on the book has no row of its own: the hand row that covers it may bear its key */
      const own = new Set((all.ok ? all.orders : []).filter((x) => !offs.has(x.id)).map((x) => ledgerKeyOf(x)).filter(Boolean));
      const cands = ((book && book.sales) || []).filter((r) => r && r.rid && !r.cancelled && !own.has(POSITION_ENGINE.ovKey(r)) && r.customer === party
        && (r.product || "salt") === (o.product || "salt") && String(r.date || "") >= day);
      /* and one hand row proves the cash of as many orders as it holds: what other orders were covered against it is spoken for */
      for (const r of cands) {
        if ((+r.cash || 0) + 0.004 < (+o.paid || 0)) continue;
        const rs = await db.prepare("SELECT entry FROM draft WHERE decided_by=?1").bind("covered:" + r.rid).all();
        const ids = new Set((rs.results || []).map((x) => { try { return JSON.parse(x.entry).orderId; } catch (e) { return null; } }).filter((x) => x && x !== id));
        const spoken = (all.ok ? all.orders : []).filter((x) => ids.has(x.id)).reduce((n, x) => n + (+x.paid || 0), 0);
        if ((+r.cash || 0) + 0.004 >= spoken + (+o.paid || 0)) { onRow = r; known = [...ids, id]; break; }
        taken = true;
      }
      if (!onRow) return { ok: false, status: 409, error: taken ? "that row's cash is already spoken for" : "record the cash on the row first" };
      if (!/^[A-Za-z0-9_-]+$/.test(String(onRow.rid))) return { ok: false, status: 409, error: "that row's id cannot be filed against" };
    }
    const found = [];
    for (const st of want) { const d = await rejectedOf(db, id, st); if (d) found.push({ st, id: d.id, by: d.decided_by }); }
    const label = onRow ? "covered:" + onRow.rid : "covered";
    if (found.length) {
      /* ONE statement covers every draft, so the cover is all or none: its guard refuses if a yes is waiting on ANY covered stage or, against a hand row,
         if another order's cover on that row landed outside the ones the sum read (that would spend the same cash twice) */
      const args = [label, id], ph = (v) => { args.push(v); return "?" + args.length; };
      const idIn = found.map((x) => ph(x.id)).join(","), stIn = found.map((x) => ph(x.st)).join(",");
      const hold = onRow ? " AND NOT EXISTS (SELECT 1 FROM draft d2 WHERE d2.decided_by=" + ph(label) + " AND json_extract(d2.entry,'$.orderId') NOT IN (" + known.map((k) => ph(k)).join(",") + "))" : "";
      const guard = " AND NOT EXISTS (SELECT 1 FROM preapproval WHERE order_id=?2 AND stage IN (" + stIn + ") AND status IN ('waiting','differs'))" + hold;
      /* early refusal before the write; the guard in the statement is what closes the race */
      const live = await db.prepare("SELECT 1 AS x FROM preapproval WHERE order_id=?1 AND stage IN (" + found.map((_, i) => "?" + (i + 2)).join(",") + ") AND status IN ('waiting','differs')").bind(id, ...found.map((x) => x.st)).first();
      if (live) return { ok: false, status: 409, error: "a yes is waiting on one of those steps: let it land first" };
      const res = await db.prepare("UPDATE draft SET decided_by=?1 WHERE id IN (" + idIn + ") AND status='rejected'" + guard).bind(...args).run();
      const n = res && res.meta && res.meta.changes;
      if (n !== found.length) {
        /* the one statement changed nothing, or (a draft no longer rejected) only some: put back what it changed, so no order is left part-covered */
        if (n > 0) for (const x of found) await db.prepare("UPDATE draft SET decided_by=?1 WHERE id=?2 AND decided_by=?3").bind(x.by, x.id, label).run();
        return { ok: false, status: 409, error: "a yes landed on one of those steps meanwhile: read the order again" };
      }
    }
    const dropped = found.map((x) => x.st);
    return Object.assign({ ok: true, order: f.order, dropped }, onRow ? { row: onRow.rid || null } : {});
  }
  if (!["pay", "cash", "move", "cancel", "amend"].includes(stage)) return { ok: false, status: 400, error: "offer again a pay, cash, move, cancel or amend; a pending row is offered again by Accept, against its preview" };
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
  const entry = againEntry(rej.entry, o, at);   /* V4a: a move rejected before the row key named the product is offered again under the key as it is now */
  /* 28 Sep 2026, s210: a payment offered again answers to what the row can still take, as the tap that made it does now */
  if (stage === "pay" || stage === "cash") { const past = pastRoom(await rowRoom(db, "SELL", undefined, mirror), o, entry, "offered again"); if (past) return Object.assign({ ok: false }, past); }
  const pv = await stagePreview(env, o, stage, entry, mirror);
  if (!pv.ok) return pv;
  /* a close offered again restates the row once more, so later stages wait for it under the name it will leave, as the
     reconcile had them wait when it first queued it */
  if (entry.status === "Close" || entry.redate) {
    const m = await markOrder(env, o.u, id, { ledgerKey: keyAfter(o, entry) });
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
export async function deskPass(env, now, mirror) {
  const db = env.SALT_LEDGER;
  if (!db) return { ok: true, queued: 0 };
  mirror = mirror || bookOnce(db);
  let pres = [], untold = [];
  try {
    pres = (await db.prepare("SELECT * FROM preapproval WHERE status IN ('waiting','differs') AND entry IS NOT NULL ORDER BY at").all()).results || [];
    untold = (await db.prepare("SELECT * FROM preapproval WHERE stage='ack' AND status='applied' AND acked_at IS NULL ORDER BY at").all()).results || [];
  } catch (e) { return { ok: true, queued: 0 }; }   /* before migrations/0011 */
  for (const p of untold) { try { await ackOnApproval(env, p); } catch (e) { /* the next minute tries again */ } }
  /* 05 Oct 2026 (Negotiate): an offer they took, followed, and one they declined or he withdrew, let go */
  const offered = await offerPass(env, now, mirror);
  if (!pres.length) return Object.assign({ ok: true, queued: 0 }, offered.length ? { approved: offered } : {});
  let queued = 0; const dropped = [], approved = offered.slice(); let open = null;
  for (const p of pres.filter((x) => !x.entry_at)) {
    const entry = JSON.parse(p.entry);
    /* an amendment the desk made itself (cash taken, 11.12) waits for its row exactly as a stage the site made does */
    if (p.stage !== "ack") {
      if (!open) { const bk = await mirror().catch(() => null); open = (bk && bk.state && bk.state.OPEN && bk.state.OPEN.byKey) || {}; }
      if (!open[entry.payload.orderKey]) continue;
    }
    await queueSale(env, entry, false, mirror);
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
    const book = await mirror();
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
     customer's page reads; a decline's or a cancellation's reason is sent so, and is the customer's banner,
     so it would reach the page unchecked. Every free-text field his moves can carry goes through this one lock,
     on the one road they take to the site. */
  /* 29 Sep 2026: AND SO DOES A FIX'S REASON. The site files `fix.cancel` as the note of the cancellation it makes, which
     the page prints like any other; it is read as the site reads it, String() of whatever came, so no shape slips past. */
  const text = (v) => typeof v === "string" ? v : "", fix = (body && body.fix) || {};
  const said = { message: text(body && body.message), note: text(body && body.note), "fix's reason": fix.cancel == null ? "" : String(fix.cancel) };
  for (const [k, v] of Object.entries(said)) {
    const why = siteWords(v);
    if (why) return { ok: false, status: 400, error: "that " + k + " says something " + why };
  }
  const r = await site(env, "/desk/orders/" + encodeURIComponent(u) + "/" + encodeURIComponent(id), {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {})
  });
  if (!r) return { ok: false, status: 503, error: "the order relay is not configured (STMT_SITE binding and STMT_DESK_KEY secret)" };
  const b = await r.json().catch(() => ({}));
  if (!r.ok || !b.ok) return { ok: false, status: r.status, error: b.error || ("the statements site answered http " + r.status) };
  const users = await usersMap(env);
  return Object.assign({ ok: true, order: Object.assign({ code: users[b.order.u] || null }, b.order), push: b.push }, b.again ? { again: true } : {});
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


/** Queue one entry for the orders device, under its own key (fold 2.1).
 * A BLOB THIS CANNOT READ IS LEFT ALONE, AND SAID SO (20 Sep 2026). q:orders held a hand-written value
 * with its quotes stripped from 19 Sep 03:49 UTC: the json read threw, the catch in reconcileOrders
 * swallowed it, and every site order failed in silence for a day. Nothing writes the blob now, so such a
 * value blocks nothing: it is read as holding no clash, the entry takes its own key, and the head of what
 * the blob held goes to the log. THE SAME STAGE already queued under its `at` is not queued twice, which
 * is what lets a stage come round again after a failed mark; A DIFFERENT stage that happens to carry the
 * same millisecond (a payment and a handover typed together) takes the next free one, because a draft's
 * id is the `at` and two ids cannot be one. A millisecond is spent while its entry is queued in either
 * shape, and for good once the draft table holds it: the drafter prunes a committed entry from the queue,
 * and a stage landing on its millisecond after that would be counted committed and never drafted. */
async function queueFixedTrades(env, entry, admissionCheck = async () => {}) {
    const key = OKEY(entry[0].at);
    const kept = await env.SALT_QUEUE.get(key, "json");
    if (kept && await makerRequestFingerprint("fixed-trades", kept.queue)
      !== await makerRequestFingerprint("fixed-trades", entry))
      throw Object.assign(new Error("That fixed request id already names different content."), { status: 409 });
    for (const e of entry) {
      const own = await env.SALT_QUEUE.get(OKEY(e.at), "json");
      const hit = own && (own.queue || []).find((item) => item.at === e.at);
      if (hit && await makerRequestFingerprint("fixed-input", hit)
        !== await makerRequestFingerprint("fixed-input", e))
        throw Object.assign(new Error("That fixed request id already names different content."), { status: 409 });
      const draft = await env.SALT_LEDGER.prepare("SELECT entry FROM draft WHERE id=?1").bind(e.at).first();
      if (draft && await makerRequestFingerprint("fixed-input", JSON.parse(draft.entry))
        !== await makerRequestFingerprint("fixed-input", e))
        throw Object.assign(new Error("That fixed request id already names different content."), { status: 409 });
    }
    await admissionCheck();
    if (kept) return false;
    await env.SALT_QUEUE.put(key, JSON.stringify({ device: DEVICE, updated: new Date().toISOString(), queue: entry }));
    noteQueued(env.SALT_QUEUE, key);
    return true;
}

export async function queueResourceTrades(env, entries) {
  if (!Array.isArray(entries) || !entries.length || entries.some((entry) => entry?.payload?.mode !== "new"
    || !["SELL", "BUY"].includes(entry.payload.direction))
    || !entries.some((entry) => POSITION_ENGINE.inputConsumesResource(entry)))
    throw Object.assign(new Error("A resource trade batch carries native trade entries and a reward cover."), { status: 400 });
  return queueFixedTrades(env, entries, async () => {
    const book = env.SALT_LEDGER ? await readBook(env.SALT_LEDGER) : null;
    if (!book) throw Object.assign(new Error("The Desk mirror is required."), { status: 503 });
    for (const entry of entries) {
      const drafted = draftRow(entry, book);
      if (drafted.skip) throw Object.assign(new Error(drafted.skip), { status: 409 });
      const fault = POSITION_ENGINE.entryReservationFault(entry, entries, book);
      if (fault) throw Object.assign(new Error(fault), { status: 409 });
    }
    const admission = await admitInputs(env.SALT_LEDGER, entries, book, "orders");
    if (admission.error) throw Object.assign(new Error(admission.error), { status: admission.status });
  });
}

export async function queueSale(env, entry, fixedId = false, mirror = null) {
  if (Array.isArray(entry)) {
    if (!fixedId || !entry.length || entry.some((e) => !e || POSITION_ENGINE.inputConsumesResource(e)))
      throw Object.assign(new Error("A fixed trade batch carries ordinary trade entries only."), { status: 400 });
    return queueFixedTrades(env, entry);
  }
  const resourceInput = POSITION_ENGINE.inputConsumesResource(entry);
  const admissionCheck = async () => {
    if (!resourceInput) return;
    const book = env.SALT_LEDGER ? await (mirror ? mirror() : readBook(env.SALT_LEDGER)) : null;
    const admission = await admitInput(env.SALT_LEDGER, entry, book, "orders");
    if (admission.error) throw Object.assign(new Error(admission.error), { status: admission.status });
  };
  const raw = await env.SALT_QUEUE.get(BLOB);
  let blob = [];
  if (raw) {
    try { const j = JSON.parse(raw); blob = (j && Array.isArray(j.queue) && j.queue) || []; }
    catch (e) { console.log("orders queue: " + BLOB + " could not be read and is left alone, so this entry takes its own key (" + String((e && e.message) || e) + "); it held: " + String(raw).slice(0, 200)); }
  }
  const spent = async (at) => {
    let own = null; try { own = await env.SALT_QUEUE.get(OKEY(at), "json"); } catch (e) { if (fixedId) throw e; own = null; }   /* its own key unreadable: written over */
    const hit = ((own && Array.isArray(own.queue) && own.queue) || []).concat(blob).find((x) => x && x.at === at);
    if (hit || !env.SALT_LEDGER) return hit || null;
    try { const d = await env.SALT_LEDGER.prepare("SELECT entry FROM draft WHERE id=?1").bind(at).first(); return d && d.entry ? (JSON.parse(d.entry) || {}) : null; }
    catch (e) { if (fixedId) throw e; return null; }
  };
  for (;;) {
    const hit = await spent(entry.at);
    if (!hit) break;
    if (fixedId) {
      if (await makerRequestFingerprint("fixed-input", hit) !== await makerRequestFingerprint("fixed-input", entry))
        throw Object.assign(new Error("That fixed request id already names different content."), { status: 409 });
      return false;
    }
    if (resourceInput && (hit.raw !== entry.raw
      || await makerRequestFingerprint("resource-payload", hit.payload)
        !== await makerRequestFingerprint("resource-payload", entry.payload)))
      throw Object.assign(new Error("That timestamp already names another input. Start a new input."), { status: 409 });
    if (hit.raw === entry.raw) { await admissionCheck(); return false; }
    entry.at = new Date(Date.parse(entry.at) + 1).toISOString();
  }
  await admissionCheck();
  await env.SALT_QUEUE.put(OKEY(entry.at), JSON.stringify({ device: DEVICE, updated: new Date().toISOString(), queue: [entry] }));
  noteQueued(env.SALT_QUEUE, OKEY(entry.at));   /* a new key may be missing from the listing for a minute; the drafter reads it by name */
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
export async function reconcileOrders(env, read, mirror) {
  /* fold 5.6: the minute's one read carries the owed orders (tickRead); any other caller, or a Counter that sent none, asks */
  let owing = read && read.ok && Array.isArray(read.owing) ? read.owing : null;
  if (!owing) {
    const r = await site(env, "/desk/orders?work=1");
    if (!r) return { ok: false, error: "the order relay is not configured (STMT_SITE binding and STMT_DESK_KEY secret)" };
    const b = await r.json().catch(() => ({}));
    if (!r.ok || !b.ok) return { ok: false, error: b.error || ("the statements site answered http " + r.status) };
    owing = b.orders || [];
  }
  if (!owing.length) return { ok: true, queued: 0 };
  const users = await usersMap(env);
  /* AN AMENDMENT WAITS FOR ITS ROW. The pending row reaches the book by the long road: queued,
     drafted, approved, folded, and the mirror re-seeded. Until it is there, nothing can be amended,
     and queueing the amendment anyway would put a refusal on his phone every time a customer paid
     early. So the same question the drafter would ask is asked one step earlier, and a stage that
     cannot land yet simply stays owed. A mirror that cannot be read holds everything, rather than
     queueing what would be refused. */
  mirror = mirror || (env.SALT_LEDGER ? bookOnce(env.SALT_LEDGER) : null);
  const book = mirror ? await mirror().catch(() => null) : null;
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
    const used = new Set([q.ack, q.cancel, q.close, q.redate].filter(Boolean));
    try {
      /* S11 11.10: WITHDRAWN BY THEM WHILE ITS ROW WAITED UNDER APPROVE, nothing paid: the row is dropped (dropAck)
         and the withdrawal is spent with it, so no Cancellation waits behind a row that will never land */
      const ended = [...(order.history || [])].reverse().find((x) => x && (x.status === "cancelled" || x.status === "declined"));
      if ((o.work || []).includes("cancel") && q.ack && ended && ended.by === "customer" && !((+order.paid || 0) > 0.004 || (+order.claimed || 0) > 0.004)
        && !(onBook && onBook[ledgerKeyOf(order)]) && (await dropAck(env, q.ack, now)) === "dropped") {
        mark.cancel = stageAt(order, "cancel", now).toISOString();
        state = { state: "queued", why: "withdrawn by the customer while its pending row waited under Approve: the row was dropped, so nothing reaches the book" };
        dropped.push(o.id);
      }
      for (const job of mark.cancel ? [] : (o.work || [])) {
        let e = null;
        if (job !== "ack" && !(onBook && onBook[ledgerKeyOf(order)])) {
          waiting.push(o.id);
          /* A REJECTED ROW STAYS SAID (24 Sep 2026): a row he rejected never reaches the book, so every
             later stage waits here, and "approve it under Approve" would send him to a row he has already
             turned down and that Approve no longer lists */
          if (!(o.sync && o.sync.state === "rejected")) {
            /* S11 (D6): THE ROW WAITED FOR MAY BE APPROVED ALREADY, by his yes on the card, and then Approve no longer lists
               it and only the fold is left; sending him there sent him to a row he could not find */
            const what = q.close ? "close" : q.redate ? "handover that redates its row" : "pending row", id = q.close || q.redate || q.ack;
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
            if (await queueSale(env, c, false, mirror)) queued++;
            used.add(c.at);
            (mark.claims = mark.claims || []).push({ at: p.at, draft: c.at });
          }
          if (!state) state = { state: "queued", why: "" };
          continue;
        }
        /* each entry is stamped with its stage's own moment (stageAt), never the pass's clock */
        const told = o.tell ? +o.tell.pay : +((+order.paid || 0) - (+q.paid || 0)).toFixed(2);
        e = jobEntry(job, order, code, told, now);
        if (!e) continue;
        e.orderId = o.id;   /* which order made it, so a rejection can be told to that order (rejectedOnOrder); never the username */
        while (used.has(e.at)) e.at = new Date(Date.parse(e.at) + 1).toISOString();
        /* counted only when it was actually appended; queueSale may move e.at to a free millisecond, so
           the marks are read off the entry AFTER it */
        if (await queueSale(env, e, false, mirror)) queued++;
        used.add(e.at);
        if (job === "ack") { mark.ledgerKey = e.orderKey; order.ledgerKey = e.orderKey; mark.ack = e.at; }
        else if (job === "pay") mark.paid = +((+q.paid || 0) + told).toFixed(2);
        else if (job === "move") {
          mark.moved = +(+order.moved || 0).toFixed(3);
          if (e.redate) { const nk = keyAfter(order, e); mark.ledgerKey = nk; order.ledgerKey = nk; mark.redate = e.at; }
        }
        else if (job === "close") {
          mark.close = e.at; mark.moved = +(+order.moved || 0).toFixed(3);
          if (e.redate) mark.redate = e.at;
          const nk = keyAfter(order, e); mark.ledgerKey = nk; order.ledgerKey = nk;
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
  const entry = await queuedAt(env, at);
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
   decision is the record. An entry's own key (q:orders:<at>, fold 2.1) left holding nothing is deleted,
   never kept empty; a device's key and the old blob are rewritten as before. */
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
      if (v.queue.length === before) continue;
      dropped += before - v.queue.length;
      if (!v.queue.length && k.name.startsWith(BLOB + ":")) await env.SALT_QUEUE.delete(k.name);
      else await env.SALT_QUEUE.put(k.name, JSON.stringify(v));
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
const REJECTED_WHAT = { Pending: "pending row", Payment: "payment entry", Handover: "handover entry", Close: "closing correction", Cancellation: "cancellation entry", Amendment: "amendment entry" };
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
  const given = keyGivenBack(entry, o);   /* V4a: in the key's shape now */
  if (given) mark.ledgerKey = given;
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
/* ---- AN ORDER FOLLOWS ITS ROW (28 Sep 2026, his answer on CE5-SA's s211) ---------------------------------------
 * A site order names its row by the key the acknowledgement wrote, and a row's key can change after it: a Correction
 * moving it between the associate's own code and their resale bucket (s210 and s212 at v918), or restating its figure.
 * The order was left naming a row the book no longer held: its later stages waited for good, the return leg lost it,
 * and the Counter, pairing To pay now by forFriend against the part's bucket, read its figure twice. So each book,
 * before the return leg, every order takes its row's key and its row's side (forFriend, true on the bucket).
 * An order whose key names no row finds it by the rid its own approved amendments name, the one way the fold finds a
 * row (tools/fold.mjs), and only where they name one row of its own product; one whose close names the row ahead of its
 * fold (closedKey) waits for the close to land or be rejected. An order never amended looks on its own account, its code or
 * their bucket, at the same day, figure, size and product, and takes only a row a Correction moved (a stream line in
 * its mod), once its own pending row has landed, so it never takes a twin's. A key another order names, or that two
 * orders want, is followed by neither. The side is marked first and alone, and the key only once the site's answer
 * carries the side, so a Counter that does not know the side yet moves nothing. */
/* what became of the row an entry made: landed on the mirror, rejected, or (null, or neither) still on its way */
const FATE = "SELECT status, committed_at IS NOT NULL AND committed_at <= (SELECT at FROM snapshot WHERE one=1) AS landed FROM draft WHERE id=?1";
const fate = async (env, id) => { try { return id ? await env.SALT_LEDGER.prepare(FATE).bind(id).first() : null; } catch (e) { return null; } };
/* a close names the row as the close will leave it (closedKey) before its Correction folds, and so does a close rejected
   and offered again (againOrder), whose first draft queued.close still names: so the ORDER'S NEWEST Close draft is read,
   and one offered again that is not drafted yet is on its way too. A read that fails is read as on its way. */
const NEWEST_CLOSE = "SELECT status, committed_at IS NOT NULL AND committed_at <= (SELECT at FROM snapshot WHERE one=1) AS landed FROM draft WHERE entry LIKE ?1 AND entry LIKE '%\"status\":\"Close\"%' ORDER BY id DESC LIMIT 1";
const NEWEST_REDATE = "SELECT status, committed_at IS NOT NULL AND committed_at <= (SELECT at FROM snapshot WHERE one=1) AS landed FROM draft WHERE entry LIKE ?1 AND entry LIKE '%\"redate\":true%' ORDER BY id DESC LIMIT 1";
async function closeOnItsWay(env, o) {
  const q = o.queued || {};
  for (const [on, sql, like] of [[q.close, NEWEST_CLOSE, '%"status":"Close"%'], [q.redate, NEWEST_REDATE, '%"redate":true%']]) {
    if (!on) continue;
    try {
      const d = await env.SALT_LEDGER.prepare(sql).bind('%"orderId":"' + o.id + '"%').first();
      if (!d) return true;
      if (d.status !== "rejected") { if (!d.landed) return true; continue; }
      if (await env.SALT_LEDGER.prepare("SELECT 1 FROM preapproval WHERE order_id=?1 AND stage='move' AND status IN ('waiting','differs') AND entry LIKE ?2").bind(o.id, like).first()) return true;
    } catch (e) { return true; }
  }
  return false;
}
const AMENDS = "SELECT amends, json_extract(entry,'$.orderId') AS oid FROM draft WHERE status='approved' AND amends IS NOT NULL AND entry LIKE ?1";
async function rowOf(env, o, k, idx, amended) {
  if (await closeOnItsWay(env, o)) return null;
  const rids = amended.get(o.id), product = o.product || "salt";
  if (rids) { const hit = [...rids].map((r) => idx.byRid.get(r)).filter((r) => r && (r.product || "salt") === product); return hit.length === 1 ? hit[0] : null; }
  const day = k.split("|").slice(1), hits = [o.code, bucketFor(o.code)].map((p) => [p].concat(day).join("|")).filter((c) => c !== k && idx.rows.get(c) === 1);
  const row = hits.length === 1 ? idx.byKey.get(hits[0]) : null;
  const ours = row && +row.qty === +o.qty && (row.product || "salt") === product && /\bstream [^;,]* to /.test(row.mod || "");
  const found = ours ? row : ["cancelled", "declined"].includes(o.status) ? null : strayRow(o, k, idx, product);   /* a cancelled order has no row to follow */
  if (!found) return null;
  const ack = await fate(env, o.queued && o.queued.ack);
  return ack && ack.landed ? found : null;
}
/* Two more ways a key names no row (his two live orders, 05 Oct 2026), each taking ONE row and nothing on a doubt. (a) Amend ID
   re-keyed the customer, so the key's party is a code no row holds now: the one row of the order's own account (code or bucket)
   at that day, figure, size and product. (b) the key's party is the order's own, and the row that carried it was restated by a
   Correction (its mod says so): the one row of that account, product and day, whatever its figure and size are now. */
/* 17 Oct 2026 (the first live tie-out, urhoba and s252): a key's figure is goods plus delivery, so a Correction of the delivery alone moves the key;
   the row is the order's when its mod names a delivery that, with its goods, is the key's figure */
function deliveryWas(r, total) {
  for (const m of String(r.mod || "").matchAll(/\bdelivery (\d+(?:\.\d+)?|\(unset\)) to /g))   /* a delivery never set is none */
    if (+((+r.total || 0) + (m[1] === "(unset)" ? 0 : +m[1])).toFixed(2) === total) return true;
  return false;
}
function strayRow(o, k, idx, product) {
  const [party, day, total] = k.split("|"), PE = POSITION_ENGINE, rows = [...idx.byKey.values()];
  const sole = (l) => l.length === 1 && idx.rows.get(PE.ovKey(l[0])) === 1 ? l[0] : null;   /* byKey keeps one of two twins */
  const mine = rows.filter((r) => PE.ownerCode(r.customer) === o.code && (r.product || "salt") === product && r.date === day);
  const twins = mine.some((r) => idx.rows.get(PE.ovKey(r)) > 1);
  if (PE.ownerCode(party) === o.code) {
    const r = twins ? null : sole(mine.filter((x) => !x.cancelled && !x.defaulted));   /* a row he voided or wrote off is no restated row */
    if (r) return new RegExp("\\btotal " + (+total) + " to ").test(r.mod || "") || deliveryWas(r, +total) ? r : null;   /* the Correction names the old figure, not any correction */
    /* 17 Oct 2026, HIS FLOW: and a row a Correction re-dated, its mod naming the key's day as the old one, at the key's figure or one the mod names */
    const was = new RegExp("\\bdate " + day + " to "), moved = rows.filter((x) => PE.ownerCode(x.customer) === o.code && (x.product || "salt") === product
      && x.date !== day && !x.cancelled && !x.defaulted && was.test(x.mod || ""));
    const m = moved.some((x) => idx.rows.get(PE.ovKey(x)) > 1) ? null : sole(moved);
    return m && (+((+m.total || 0) + (+m.delivery || 0)).toFixed(2) === +total || new RegExp("\\btotal " + (+total) + " to ").test(m.mod || "")) ? m : null;
  }
  if (rows.some((r) => PE.ownerCode(r.customer) === PE.ownerCode(party))) return null;
  return twins ? null : sole(mine.filter((r) => +r.qty === +o.qty && +((+r.total || 0) + (+r.delivery || 0)).toFixed(2) === +total));
}
const answerOf = async (m) => Object.assign({ why: m ? " (http " + m.status + ")" : "" }, m && m.ok ? await m.json().catch(() => ({})) : {});
/* his yes still waiting for the row it amends (cash taken at the counter, 11.12) is pointed at the order's row, its key
   and party, BEFORE the order takes the key: at the old key it would wait for good, as tg8bpq's did, and a key taken
   first would leave nothing on a later pass to say which yes still names the old one. Its draft then differs from what
   he was shown, the key and party being part of it, and waits under Approve for him to look again. */
async function repoint(db, id, nk, party) {
  const ps = (await db.prepare("SELECT id,entry FROM preapproval WHERE order_id=?1 AND stage<>'ack' AND status IN ('waiting','differs') AND entry IS NOT NULL AND entry_at IS NULL").bind(id).all()).results || [];
  for (const p of ps) {
    const e = JSON.parse(p.entry);
    if (!e.payload || (e.payload.orderKey === nk && e.party === party && e.payload.party === party)) continue;
    e.payload.orderKey = nk; e.payload.party = party; e.party = party;
    await db.prepare("UPDATE preapproval SET entry=?1 WHERE id=?2 AND entry_at IS NULL").bind(JSON.stringify(e), p.id).run();
  }
}
async function followRows(env, orders, idx) {
  const plan = [], failed = [], amended = new Map(), miss = new Set();
  for (const o of orders) if (o.code && ledgerKeyOf(o) && !idx.rows.get(ledgerKeyOf(o))) miss.add(o.id);
  try {
    if (miss.size) for (const r of (await env.SALT_LEDGER.prepare(AMENDS).bind('%"orderId":%').all()).results || [])
      if (miss.has(r.oid)) amended.set(r.oid, (amended.get(r.oid) || new Set()).add(r.amends));
  } catch (e) { return { followed: 0, failed: [{ id: null, why: "the drafts could not be read, so no order follows its row this pass" }] }; }
  for (const o of orders) {
    const k = ledgerKeyOf(o);
    if (!k || !o.code) continue;
    const row = idx.rows.get(k) ? idx.byKey.get(k) : await rowOf(env, o, k, idx, amended);
    if (!row || POSITION_ENGINE.ownerCode(row.customer) !== o.code) continue;
    const nk = POSITION_ENGINE.ovKey(row), friend = POSITION_ENGINE.isBucket(row.customer);
    if (nk !== k || !!o.forFriend !== friend) plan.push({ o, k, nk, friend, party: row.customer });
  }
  const wants = new Map();
  for (const o of orders) { const k = ledgerKeyOf(o); if (k) wants.set(k, (wants.get(k) || 0) + 1); }
  for (const p of plan) if (p.nk !== p.k) wants.set(p.nk, (wants.get(p.nk) || 0) + 1);
  let followed = 0;
  for (const { o, k, nk, friend, party } of plan) {
    if (nk !== k && wants.get(nk) !== 1) continue;
    if (!!o.forFriend !== friend) {
      const b = await answerOf(await markOrder(env, o.u, o.id, { forFriend: friend }));
      if (!b.order || b.order.forFriend !== friend) { failed.push({ id: o.id, why: "the site would not take its row's side" + b.why }); continue; }
      o.forFriend = friend;
    }
    try { await repoint(env.SALT_LEDGER, o.id, nk, party); } catch (e) { failed.push({ id: o.id, why: "its waiting yes could not be pointed at the row" }); continue; }
    if (nk !== k) {
      const b = await answerOf(await markOrder(env, o.u, o.id, { ledgerKey: nk }));
      if (!b.order || b.order.ledgerKey !== nk) { failed.push({ id: o.id, why: "the site would not take its row's key" + b.why }); continue; }
      o.ledgerKey = nk;
    }
    followed++;
  }
  return { followed, failed };
}
/* an Amendment of the order not on the book yet (drafted and undecided, approved and not on the mirror: marked committed before the re-seed reads
   as on its way, as a close's landing does, or his yes waiting to be drafted), or a close
   or redate on its way: the order already says what the row will. A read that fails is read as on its way. */
const AMEND_FLIGHT = "SELECT 1 FROM draft WHERE entry LIKE ?1 AND entry LIKE '%\"status\":\"Amendment\"%' AND (status='pending' OR (status='approved' AND (committed_at IS NULL OR committed_at > (SELECT at FROM snapshot WHERE one=1)))) LIMIT 1";
/* 17 Oct 2026 (Fable's review): A SETTLED ORDER IS RESTATED ONLY WHEN NOTHING OF ITS OWN IS ON ITS WAY TO THE ROW: any draft naming it undecided or
   not on the mirror yet (a Received, cash, a handover, as well as an amendment), any yes of his waiting in any stage, or a close or redate */
const ORDER_FLIGHT = "SELECT 1 FROM draft WHERE entry LIKE ?1 AND (status='pending' OR (status='approved' AND (committed_at IS NULL OR committed_at > (SELECT at FROM snapshot WHERE one=1)))) LIMIT 1";
/* 17 Oct 2026 (the first live tie-out): his yes waiting on a row the site is to make is on its way for a day. Such a yes is spent within minutes
   of the tap; ones waiting since 02 and 12 Oct named moves the book took by a Correction, and held their orders as on their way for good. Older,
   it holds nothing, and the tie-out names it. A yes whose own entry is queued (entry_at) waits for the drafter however long that takes. */
const YES_FRESH_MS = 24 * 3600000;
const yesFresh = (now = Date.now()) => new Date(now - YES_FRESH_MS).toISOString();
export async function orderInFlight(env, o) {
  if (await closeOnItsWay(env, o)) return true;
  try {
    if (await env.SALT_LEDGER.prepare(ORDER_FLIGHT).bind('%"orderId":"' + o.id + '"%').first()) return true;
    return !!(await env.SALT_LEDGER.prepare("SELECT 1 FROM preapproval WHERE order_id=?1 AND status='waiting' AND (entry_at IS NOT NULL OR at > ?2) LIMIT 1").bind(o.id, yesFresh()).first());
  } catch (e) { return true; }
}
export async function termsInFlight(env, o) {
  if (await closeOnItsWay(env, o)) return true;
  try {
    if (await env.SALT_LEDGER.prepare(AMEND_FLIGHT).bind('%"orderId":"' + o.id + '"%').first()) return true;
    return !!(await env.SALT_LEDGER.prepare("SELECT 1 FROM preapproval WHERE order_id=?1 AND stage='amend' AND status='waiting' AND (entry_at IS NOT NULL OR at > ?2) LIMIT 1").bind(o.id, yesFresh()).first());
  } catch (e) { return true; }
}
export async function tellSite(env, fixes, mirror) {
  if (!env.SALT_LEDGER || !env.SALT_QUEUE) return { ok: true, told: 0 };
  let snap = null;
  try { snap = await env.SALT_LEDGER.prepare("SELECT v,stamped FROM snapshot WHERE one=1").first(); } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
  const v = (snap && snap.v) || null;
  if (!v) return { ok: true, told: 0 };
  if ((await env.SALT_QUEUE.get(TOLD_MARK)) === v) return { ok: true, told: 0, v };
  const r = await listOrders(env, true);   /* every order: a finished one follows its row too */
  if (!r.ok) return { ok: false, error: r.error };
  const book = await (mirror ? mirror() : readBook(env.SALT_LEDGER)).catch(() => null);
  const sales = (book && book.sales) || [];
  if (!sales.length) return { ok: true, told: 0, v };
  const byKey = new Map(), rows = new Map(), byRid = new Map();
  for (const s of sales) { const k = POSITION_ENGINE.ovKey(s); byKey.set(k, s); rows.set(k, (rows.get(k) || 0) + 1); if (s.rid) byRid.set(s.rid, s); }
  const { followed, failed } = await followRows(env, r.orders, { byKey, rows, byRid });
  /* a fix not yet sent to an order (an undo on its row) is the one road for what it takes back: a settled order waits for it (Fable's review) */
  const allFixes = (fixes || SITE_FIXES).concat(undoFixes(r.orders, byKey, rows));
  const fixedDone = (await env.SALT_QUEUE.get(FIXED_MARK, "json").catch(() => null)) || {};
  const fixWaits = new Set(allFixes.filter((f) => !fixedDone[f.id]).map((f) => f.order));
  let told = 0;
  const named = namedKeys(r.orders);
  for (const o of r.orders) {
    if (!o.ledgerKey || ["cancelled", "declined"].includes(o.status)) continue;
    const row = byKey.get(ledgerKeyOf(o));   /* V4a: never a salt twin's row by the old shape */
    if (!row) continue;
    /* 17 Oct 2026 (Fable's review): a key two live orders name is neither's row: one re-dated away and another landed under its old key */
    if (named.get(ledgerKeyOf(o)) > 1) continue;
    const sole = rows.get(ledgerKeyOf(o)) === 1;   /* a key two rows share names neither: byKey keeps one of the twins */
    /* 17 Oct 2026, HIS FLOW: what the book ended, the order ends: a row cancelled there cancels its order, and a write-off marks it written off
       (or undone, clears it), once nothing of the order's own is on its way to the row */
    /* a cancel of a row with goods out (a hand fold) is not the order's: the site would refuse it for good, so it is never sent (Fable's review) */
    const out = POSITION_ENGINE.txEffDeliv(row) > 0.0004 || (+o.moved || 0) > 0.0004;
    const end = row.cancelled ? (out ? null : "cancelled") : !!row.defaulted !== !!o.writtenOff ? (row.defaulted ? "writtenOff" : "restored") : null;
    if (end && sole && !fixWaits.has(o.id) && !(await orderInFlight(env, o))) {
      const b = await site(env, "/desk/orders/" + encodeURIComponent(o.u) + "/" + encodeURIComponent(o.id), {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bookEnd: end })
      });
      if (!b || !b.ok) failed.push({ id: o.id, why: "the site would not take its row's end" + (b ? " (http " + b.status + ")" : "") });
      else told++;
    }
    if (row.cancelled || row.defaulted) continue;
    if (o.status === "done") {
      /* 17 Oct 2026, his yes: a settled order takes all its row states, its money and goods included, once nothing is on its way to the row */
      const s = sole && !fixWaits.has(o.id) ? settledFromRow(o, row) : null;
      if (!s || await orderInFlight(env, o)) continue;
      const d = await site(env, "/desk/orders/" + encodeURIComponent(o.u) + "/" + encodeURIComponent(o.id), {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ restate: Object.assign({}, s, { book: true }) })
      });
      if (!d || !d.ok) failed.push({ id: o.id, why: "the site would not take its row's figures" + (d ? " (http " + d.status + ")" : "") });
      else told++;
      continue;
    }
    const ledger = {};
    const paid = +(+POSITION_ENGINE.txPaid(row)).toFixed(2), moved = rowOut(row);
    /* 17 Oct 2026, HIS FLOW: money or goods LOWERED on the book (a Correction, never an undo, which its fix tells) reach an agreed order too, as the
       book's figures whole, once nothing of the order's own is on its way and the site holds no move the book has not heard */
    if (sole && !fixWaits.has(o.id) && (paid < (+o.paid || 0) - 0.004 || moved < (+o.moved || 0) - 0.0004)) {
      const s = settledFromRow(Object.assign({}, o, { status: "done" }), row);
      if (s && !(await orderInFlight(env, o))) {
        const d = await site(env, "/desk/orders/" + encodeURIComponent(o.u) + "/" + encodeURIComponent(o.id), {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ restate: { ...s, book: true } })
        });
        if (!d || !d.ok) failed.push({ id: o.id, why: "the site would not take its row's figures" + (d ? " (http " + d.status + ")" : "") });
        else told++;
        continue;
      }
      /* nothing sent (a move of its own on its way): what rose on the book is still told, below (Fable's review) */
    }
    if (paid > (+o.paid || 0) + 0.004) ledger.paid = paid;
    if (moved > (+o.moved || 0) + 0.0004) ledger.moved = moved;
    if (Object.keys(ledger).length) {
      const m = await site(env, "/desk/orders/" + encodeURIComponent(o.u) + "/" + encodeURIComponent(o.id), {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ledger })
      });
      if (!m || !m.ok) { failed.push({ id: o.id, why: "the site would not take it" + (m ? " (http " + m.status + ")" : "") }); continue; }
      told++;
    }
    /* 16 Oct 2026: AND THE ORDER STATES WHAT ITS ROW STATES. A Correction on the row (Counter Admin's Corrections, a hand fold) changed
       the book alone, so the order kept its old figure (CR3-DAM's s263: RM65 on the book, RM80 on the order). The row wins, except
       while a change of the order's own is on its way to the row: his Amend and a close tell the order at the tap, before it folds. */
    const terms = sole ? termsFromRow(o, row, ledger.moved) : null;
    if (!terms || await termsInFlight(env, o)) continue;
    const t = await site(env, "/desk/orders/" + encodeURIComponent(o.u) + "/" + encodeURIComponent(o.id), {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ restate: terms })
    });
    if (!t || !t.ok) failed.push({ id: o.id, why: "the site would not take its row's figures" + (t ? " (http " + t.status + ")" : "") });
    else told++;
  }
  /* fix 4: the committed list's corrections, sent on the list of orders this pass already read; and (plan 4) each undo the book now holds
     on a site order's row, taking back off the order what it took back off the row, once, by its own id */
  const fx = await sendFixes(env, r.orders, allFixes);
  failed.push(...(fx.failed || []));
  /* the mark moves only on a clean pass, so an order the site refused is tried again next minute
     rather than waiting for the next fold */
  if (!failed.length) await env.SALT_QUEUE.put(TOLD_MARK, v);
  /* 17 Oct 2026: and what held it, for the tie-out to name (Fable's review): the stall is then an order's, not the return leg's */
  try { if (failed.length) await env.SALT_QUEUE.put(TOLD_FAILED, JSON.stringify({ v, at: new Date().toISOString(), failed: failed.slice(0, 20) })); else await env.SALT_QUEUE.delete(TOLD_FAILED); } catch (e) {}
  return Object.assign({ ok: true, told, v }, followed ? { followed } : {}, fx.sent ? { fixed: fx.sent } : {}, fx.refused ? { refused: fx.refused } : {}, fx.waiting ? { waiting: fx.waiting } : {},
    failed.length ? { failed } : {});
}

/* ---- THE TIE-OUT (17 Oct 2026, HIS FLOW: "exactly the same at any given point") ---------------------------------------------
 * Every site order that has a row against the row: size, goods, delivery (a trip row's is its trip's, so not read), paid, handed over,
 * and the end (cancelled with cancelled, written off with written off). A difference a move of the order's own on its way explains
 * (orderInFlight) is listed as waiting, never as a fault; an order whose key names no row is a fault unless its pending row or a close
 * is still to land. And the return leg itself: a book version the Counter has not been told of for TIEOUT_STALL_MS is a fault, so a
 * stalled pass is never silent. The answer is kept at KV TIEOUT_KEY for Counter Admin's Ledger; a clean one is the proof. */
export const TIEOUT_KEY = "orders:tieout";
const TOLD_FAILED = "orders:toldFailed";
/* how many live orders name each key: a key two of them name is neither's row */
const namedKeys = (orders) => {
  const n = new Map();
  for (const o of orders || []) { if (!o || o.test || !o.ledgerKey || ["cancelled", "declined"].includes(o.status)) continue; const k = ledgerKeyOf(o); n.set(k, (n.get(k) || 0) + 1); }
  return n;
};
const TIEOUT_STALL_MS = 15 * 60000;
export async function tieOut(env, mirror, now = new Date()) {
  const at = now.toISOString(), faults = [], waiting = [];
  let snap = null;
  try { snap = await env.SALT_LEDGER.prepare("SELECT v, at FROM snapshot WHERE one=1").first(); } catch (e) { snap = null; }
  const v = (snap && snap.v) || null, told = await env.SALT_QUEUE.get(TOLD_MARK);
  try {
    const old = (await env.SALT_LEDGER.prepare("SELECT order_id, stage, at FROM preapproval WHERE status='waiting' AND entry_at IS NULL AND json_extract(shown,'$.offer') IS NULL AND at <= ?1 ORDER BY at LIMIT 20").bind(yesFresh(now.getTime())).all()).results || [];
    for (const y of old) faults.push({ order: y.order_id, what: ["your yes to its " + y.stage + " of " + String(y.at).slice(0, 10) + " never reached Approve, so it holds nothing: tap it again if the move is still owed"] });
  } catch (e) { /* the yeses are read again next pass */ }
  if (v && told !== v && snap.at && now.getTime() - Date.parse(snap.at) > TIEOUT_STALL_MS) {
    let held = null;
    try { held = await env.SALT_QUEUE.get(TOLD_FAILED, "json"); } catch (e) { held = null; }
    const who = held && Array.isArray(held.failed) && held.failed.length ? "; held by " + held.failed.map((f) => (f.id || "the pass") + " (" + f.why + ")").join(", ") : "";
    faults.push({ what: "return leg", why: "the Counter has not been told of book " + v + " since " + snap.at + " (last told " + (told || "never") + ")" + who });
  }
  const r = await listOrders(env, true);
  if (!r.ok) return { at, v, ok: false, error: "the site's orders could not be read: " + (r.error || "") };
  const book = await (mirror ? mirror() : readBook(env.SALT_LEDGER)).catch(() => null);
  if (!book || !book.sales) return { at, v, ok: false, error: "the book could not be read" };
  const byKey = new Map(), n = new Map();
  for (const s of book.sales) { const k = POSITION_ENGINE.ovKey(s); byKey.set(k, s); n.set(k, (n.get(k) || 0) + 1); }
  const f2 = (x) => +(+x || 0).toFixed(2), f3 = (x) => +(+x || 0).toFixed(3), named = namedKeys(r.orders);
  let orders = 0;
  for (const o of r.orders) {
    if (o.test || !o.ledgerKey || !ROWED_ON_SITE.concat(["cancelled", "declined"]).includes(o.status)) continue;
    const k = ledgerKeyOf(o), row = byKey.get(k), ended = ["cancelled", "declined"].includes(o.status);
    if (ended && !row) continue;   /* withdrawn before its row landed, or its row dropped: nothing to tie */
    orders++;
    const diff = [];
    if (!row) diff.push("no row on the book under " + k);
    else if (!ended && (named.get(k) || 0) > 1) diff.push("another order names its key, so the row is neither's");
    else if ((n.get(k) || 0) > 1) diff.push("two rows share its key, so neither is its");
    else {
      if (!!row.cancelled !== ended) diff.push(row.cancelled ? "the row is cancelled and the order is " + o.status : "the order is " + o.status + " and its row is live");
      if (!ended) {
        if (!!row.defaulted !== !!o.writtenOff) diff.push(row.defaulted ? "the row is written off and the order is not" : "the order is written off and its row is not");
        if (Math.abs(f3(row.qty) - f3(o.qty)) > 0.0004) diff.push("units " + f3(o.qty) + " on the order, " + f3(row.qty) + " on the row");
        if (Math.abs(f2(row.total) - f2(o.total)) > 0.004) diff.push("goods RM " + f2(o.total) + " on the order, RM " + f2(row.total) + " on the row");
        if (!row.trip && Math.abs(f2(row.delivery) - f2(o.delivery)) > 0.004) diff.push("delivery RM " + f2(o.delivery) + " on the order, RM " + f2(row.delivery) + " on the row");
        const paid = f2(POSITION_ENGINE.txPaid(row)), moved = rowOut(row);
        if (Math.abs(paid - f2(o.paid)) > 0.004) diff.push("paid RM " + f2(o.paid) + " on the order, RM " + paid + " on the row");
        if (Math.abs(moved - f3(o.moved)) > 0.0004) diff.push("handed over " + f3(o.moved) + " on the order, " + moved + " on the row");
      }
    }
    if (!diff.length) continue;
    const item = { order: o.id, ...(row && row.rid ? { rid: row.rid } : {}), what: diff };
    /* a claim of theirs waiting holds the order on purpose: his Received or Not found is owed, so it is waiting, said so (Fable's review) */
    if ((o.payments || []).some((p) => p && p.claim === "waiting")) waiting.push({ ...item, what: diff.concat(["a payment they say they sent waits on your Received or Not found"]) });
    else if (await orderInFlight(env, o)) waiting.push(item);
    else if (!row) {
      const ack = await fate(env, o.queued && o.queued.ack);
      /* its pending row rejected under Approve is no row to come: the re-offer is owed */
      if (ack && ack.status === "rejected") faults.push({ ...item, what: diff.concat(["its pending row was rejected under Approve: tap Accept again or cancel the order"]) });
      else if (!ack || !ack.landed) waiting.push(item); else faults.push(item);
    }
    else faults.push(item);
  }
  return { at, v, told, ok: true, orders, clean: !faults.length, faults, waiting };
}

/* ---- A LINE THE DESK WROTE BY MISTAKE, TAKEN BACK (28 Sep 2026, fix 4, his answers on CE5-SA's three orders) ------
 * Cash received was tapped by mistake on three of one account's orders, and the site kept each as money paid in cash.
 * The book has been put right by Corrections; the site is put right here: EACH CORRECTION IS A LINE OF THIS LIST, added by
 * a Code session and shipped in a version, and the return leg's pass after that version's fold (tellSite) sends each line
 * once, on the list of orders it has already read, as one event in the order book under the line's id (stmt/orders.js
 * decideFix), so a repeat is answered and never applied twice. What was sent is kept in KV under FIXED_MARK, by id: sent,
 * or refused with the site's own reason (its 400 or 409, beginning "fix refused: "), never sent again; any other answer,
 * a Counter deployed a minute behind the desk's mirror among them, leaves the pass unclean, so
 * the next minute sends it again, and so does a site on the kv road, which refuses a fix (it keeps no event log). A line
 * whose order is not on the site's list waits, recorded nowhere, and the pass says so (waiting). Nothing here reaches the
 * ledger: the fix lowers what the ledger was told with what the site shows, so the reconcile has nothing to queue.
 *   line     the moment of the desk's payment line on that order
 *   method   and account: the way the money came, restated on the line and its history (unpay absent)
 *   unpay    the line taken back, and with it the history written with it; an order it completed is open again
 *   unmove   the handover taken back too, and cancel his reason: cancelled by us, nothing paid, handed over or owed */
export const SITE_FIXES = [
  { id: "fx4-tg8bpq-carried", order: "20260926131647-tg8bpq", line: "2026-09-27T15:52:02.970Z", unpay: true, unmove: true, cancel: "Carried on your order of 27 Sep" },
  { id: "fx4-ndxqjg-unpaid", order: "20260927221155-ndxqjg", line: "2026-09-27T22:29:15.338Z", unpay: true },
  { id: "fx4-gwepmw-transfer", order: "20260927095911-gwepmw", line: "2026-09-27T13:09:07.720Z", method: "transfer", account: "tng" }
];
const FIXED_MARK = "orders:fixed";
/* PLAN 4 (16 Oct 2026): THE UNDOS ON SITE ORDERS' ROWS, as lines of the list sendFixes sends: each undo step on a row an order names (its one
   row by the key, never a twin's), what it took back (`took`, the fold's reading) as the order's undo fix, its id the row and the step, so a
   pass sends it once and the done mark keeps it from ever going twice. A change of terms took nothing back here: restateOrder told the order. */
export function undoFixes(orders, byKey, rows) {
  const out = [];
  for (const o of orders || []) {
    if (!o || !o.ledgerKey || ["cancelled", "declined"].includes(o.status)) continue;
    const k = ledgerKeyOf(o), row = byKey.get(k);
    if (!row || row.cancelled || !row.rid || (rows.get(k) || 0) > 1) continue;
    (row.amend || []).forEach((a, i) => {
      if (!a || a.undoes == null || !a.took) return;
      const id = ("un-" + String(row.rid).toLowerCase() + "-" + i).slice(0, 40);
      if (!/^[a-z0-9-]{1,40}$/.test(id)) return;   /* the order book's FIX_ID_RE */
      out.push(Object.assign({ id, order: o.id, undo: true }, +a.took.cash > 0.004 ? { unpay: +a.took.cash } : {}, +a.took.units > 0.0004 ? { unmove: +a.took.units } : {}));
    });
  }
  return out.filter((f) => f.unpay || f.unmove);
}
/** Each line of the list not yet sent, to its order on `orders`: { sent, refused?, waiting?, failed? }. */
export async function sendFixes(env, orders, fixes) {
  const list = fixes || SITE_FIXES;
  if (!env.SALT_QUEUE || !list.length) return { sent: 0 };
  const done = (await env.SALT_QUEUE.get(FIXED_MARK, "json")) || {};
  let sent = 0; const failed = [], refused = [], waiting = [];
  for (const f of list.filter((x) => !done[x.id])) {
    const o = (orders || []).find((x) => x.id === f.order), why = f.cancel ? siteWords(f.cancel) : "";
    if (!o) { waiting.push(f.id); continue; }
    if (why) { done[f.id] = { at: new Date().toISOString(), refused: "its reason " + why }; refused.push(f.id); continue; }
    const fix = Object.assign({}, f); delete fix.order;
    const m = await site(env, "/desk/orders/" + encodeURIComponent(o.u) + "/" + encodeURIComponent(o.id),
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fix }) });
    const b = m ? await m.json().catch(() => ({})) : {};
    if (m && m.ok && b.ok) { done[f.id] = { at: new Date().toISOString(), sent: true }; sent++; }
    else if (m && (m.status === 400 || m.status === 409) && /^fix refused: /.test(String(b.error || ""))) { done[f.id] = { at: new Date().toISOString(), refused: String(b.error || "http " + m.status).slice(0, 200) }; refused.push(f.id); }
    else failed.push({ id: f.id, why: "the site would not take it" + (m ? " (http " + m.status + ")" : "") });
  }
  if (sent || refused.length) await env.SALT_QUEUE.put(FIXED_MARK, JSON.stringify(done));
  return Object.assign({ sent }, refused.length ? { refused } : {}, waiting.length ? { waiting } : {}, failed.length ? { failed } : {});
}

/* ---- V4a: A KEY WRITTEN BEFORE THE PRODUCT WAS IN IT (28 Sep 2026) -----------------------------------------------
 * The row key names the product on every book but salt (the engine's ovKey), and an order acknowledged before that
 * carries the old key as its ledgerKey: on salt it is the same key, on any other book it lacks the tail. ONCE, on the
 * minute's first pass after the version that brought it and ahead of every other step, each such order is marked with
 * its key as the engine gives it now (ledgerKeyOf: the tail and nothing else), a finished order too, so nothing on the
 * site names a row by the old shape. The mark on this store moves only when every order took its key; until then the
 * next minute tries again, and every road here reads the key through ledgerKeyOf meanwhile. It costs the first minute
 * one more question to the site, and no minute after it. */
const KEYED_MARK = "orders:keyed";
export async function rekeyOrders(env) {
  if (!env.SALT_QUEUE || !env.STMT_SITE) return { ok: true, rekeyed: 0 };
  if ((await env.SALT_QUEUE.get(KEYED_MARK)) === "product") return { ok: true, rekeyed: 0 };
  const r = await listOrders(env, true);
  if (!r.ok) return { ok: false, error: r.error };
  let rekeyed = 0; const failed = [];
  for (const o of r.orders) {
    const nk = ledgerKeyOf(o);
    if (!o.ledgerKey || nk === o.ledgerKey) continue;
    const m = await markOrder(env, o.u, o.id, { ledgerKey: nk });
    if (m && m.ok) rekeyed++;
    else failed.push({ id: o.id, why: "the site would not take the key" + (m ? " (http " + m.status + ")" : "") });
  }
  if (!failed.length) await env.SALT_QUEUE.put(KEYED_MARK, "product");
  return Object.assign({ ok: true, rekeyed }, failed.length ? { failed } : {});
}

/** How many customer orders are waiting on him: placed, and acknowledged but not yet ready; and of
 *  those, how many are still to be acknowledged, which is all his banner may ask him to acknowledge.
 *  `lines` are the customer's own lines newer than `since` (an ISO moment; none given, the last ten minutes),
 *  at most three, the newest three shown oldest first, each cut to 200 characters. Read off the orders this
 *  already reads (`msgs[]` rides on every order the site lists) and stored nowhere. */
export const LINE_MAX = 200, LINES_MAX = 3, LINE_FRESH_MS = 10 * 60 * 1000;
export async function ordersWaiting(env, since) {
  const r = await listOrders(env, false);
  if (!r.ok) return { ok: false, waiting: 0, placed: 0, lines: [] };
  const from = typeof since === "string" && Number.isFinite(Date.parse(since)) ? Date.parse(since) : Date.now() - LINE_FRESH_MS;
  const lines = [];
  /* Step 7: and their lines on the account threads, read beside the orders; a thread that cannot be read adds none */
  const th = await listThreads(env);
  for (const o of r.orders.concat(th.ok ? th.threads : [])) for (const m of (o && o.msgs) || []) {
    if (m && m.by === "customer" && typeof m.text === "string" && m.text.trim() && Date.parse(m.at) > from) lines.push({ at: String(m.at), t: m.text.trim().slice(0, LINE_MAX) });
  }
  lines.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return { ok: true, waiting: r.orders.filter((o) => o.status === "placed" || o.status === "acknowledged").length,
    placed: r.orders.filter((o) => o.status === "placed").length, lines: lines.slice(-LINES_MAX) };
}

/* S9 9.8 FIX (25 Sep 2026): SALT ACCOUNT'S LINE IS THE DESK'S OWN COUNT. The desk's page counts Waiting on you (the
   master's ordActs, over the orders and the drafts together: a new order not yet accepted, a question of theirs not
   marked No reply needed, cash to record, a payment they say they made) for its Today row and its Enter badge, and once
   it has read both it sends that figure here (POST /orders/waiting), which this relays to the site's desk-waiting mark.
   One reading, the desk's: this Worker's own recount every minute (placed, or their line last) missed cash and payments
   and ignored his No reply needed, so the two apps disagreed. The trade, stated: the figure is as fresh as the desk's
   last read of its orders, and the mark carries its moment, which Salt Account shows. S9 fix: the page sends how old its
   reading is (`age`, whole seconds), passed through, and the site stamps the moment from it. */
export async function tellWaiting(env, n, age) {
  if (!Number.isInteger(n) || n < 0 || n > 9999) return { ok: false, status: 400, error: "send the count as a whole number" };
  const a = Number.isInteger(age) && age >= 0 && age <= 30 * 86400 ? age : 0;
  const t = await site(env, "/desk/waiting", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ n, age: a }) });
  if (!t) return { ok: false, status: 503, error: "the order relay is not configured (STMT_SITE binding and STMT_DESK_KEY secret)" };
  if (!t.ok) return { ok: false, status: 502, error: "the site would not take the count (http " + t.status + ")" };
  return { ok: true, n };
}

/* ---- ONE QUESTION TO THE SITE A MINUTE (fold 5.6, 26 Sep 2026) ---------------------------------
 * The minute asked the site twice, the marks for the nudge and the owed orders for the reconcile, and from
 * 24 Sep 22:00 UTC each trip took about 165 ms where it had taken 10, while the order book's own time stayed
 * at 1 to 10 ms. The marks now come with the owed orders (/desk/orders/last?work=1), so a quiet minute is one
 * trip. A Counter still on the old code answers that path with the marks alone, and the reconcile asks for
 * the orders itself: the desk deploys first, so that is the minute between the two deploys. A read that
 * failed leaves each step to ask for its own, as they did before. */
async function siteMarks(env, work) {
  const r = await site(env, "/desk/orders/last" + (work ? "?work=1" : ""));
  if (!r) return { ok: false, error: "the order relay is not configured (STMT_SITE binding and STMT_DESK_KEY secret)" };
  const b = await r.json().catch(() => ({}));
  if (!r.ok || !b.ok) return { ok: false, error: b.error || ("the statements site answered http " + r.status) };
  return { ok: true, marks: b, owing: work && Array.isArray(b.orders) ? b.orders : null };
}
export const tickRead = (env) => siteMarks(env, true);

/* THE NUDGE, every minute (16 Sep 2026; it was the drafter's quarter-hour, and nothing had
   subscribed since v387, so an order arrived in silence). The site cannot reach this Worker, so a
   new order is noticed here, by asking the site for the moment of its newest placement: one read,
   not a listing. Anything newer than the mark wakes the phones that asked for orders, once. */
export async function nudgeOrders(env, read) {
  /* fold 5.6: the marks of the minute's one read (tickRead); without them, or when it failed, the marks alone are asked for */
  const got = read && read.ok ? read : await siteMarks(env, false);
  if (!got.ok) return { ok: false, error: got.error };
  const b = got.marks;
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
