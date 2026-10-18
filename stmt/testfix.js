/* stmt/testfix.js: HIS TEST ACCOUNTS, AND WHAT THEY SHOW (v689; the fixture, 29 Sep 2026, his instruction that they show
 * every feature a customer sees, EXACTLY as a customer sees it, for his acceptance tests).
 *
 * THE TEST ACCOUNT (v689, his instruction of 18 Sep 2026): one account he can open anywhere, that counts nowhere, and
 * that he can destroy with one tap. ITS NAME IS THE POINT: zeros are not in the alphabet a real username is drawn from,
 * so this one cannot collide with an account and cannot be arrived at by mistyping one. A SECOND, 0000-0001, stands
 * locked (his answer of 29 Sep 2026: a second account, not a switch): a one is outside the alphabet as well. Both open
 * with the same zeros.
 *
 * THE FIXTURE. The publish builds an invented account for each (tools/testfix.mjs): the first open, a claim of theirs
 * waiting so it can order, the second locked, only for paying. Each is sealed under its own account's key and put at
 * fixKey(u). Here it is LAID OVER that account as it is read, and never written anywhere an order, a claim or a link
 * lives: its orders are not in the order book or under order:, its claims not under aclaim:, its links not under g:.
 * So every reader that counts (the desk's reconcile, his lists, the chase, the report card) cannot see it, by
 * construction. `salt` ties it to the account it was sealed for; an account unmade and made again has a new key, and a
 * fixture sealed for the old one is not served.
 * EVERY TAP A CUSTOMER HAS WORKS ON IT: a move on an example order, a claim against the account, a link minted or
 * withdrawn, each by the order book's own decide and apply, written back into that account's fixture and nowhere else,
 * a retry answered once. Until the first publish seals one, a claim or a link is refused, never made for real. The next
 * publish seals the examples afresh. Account threads alone use the book's isolated fixture_thread row when its
 * binding exists, on either store road; no real events, marks or write-behind read that table. A new publication
 * resets its generation. Binding-less legacy customer fixtures remain in KV; new owner replies refuse there.
 */
import { decideCustomer, decideReplace, decideAccountClaim, decideThread, applyEvent, customerView, claimView, ordersOf, ridOf, fixtureThreadMove, fixtureAccountMove, joinLive, poolUnits, POOL_ON_KV } from "./orders.js";
import { refusal } from "./words.js";
import { numbersOf } from "./paynum.js";

export const TEST_USER = "0000-0000";
export const TEST_LOCKED = "0000-0001";
export const TEST_PASS = "0000-0000-0000-0000";
/* each test account and the state its fixture stands in */
export const TESTS = { [TEST_USER]: "open", [TEST_LOCKED]: "locked" };
export const TEST_USERS = Object.keys(TESTS);
export const isTest = (u) => Object.prototype.hasOwnProperty.call(TESTS, String(u || ""));
export const FIX_VERSION = 9;   /* 9: an invented account number for the pay sheet, so the publish seals the fixture afresh (Phase 7b, 11 Oct 2026); 8: the look, asked at every sign-in (11 Oct 2026); 7: his Accept for their yes, a raise and another window waiting on them, and one lapsed (10 Oct 2026) */
export const fixKey = (u) => "testfix:" + u;

/** The fixture for this account as read, or null: a test account's alone, and only the one it was sealed for. */
export async function fixtureOf(env, u, rec) {
  if (!isTest(u) || !rec || rec.test !== true || !rec.wrap) return null;
  let fix = null;
  try { fix = await env.STMT.get(fixKey(u), "json"); } catch (e) { fix = null; }
  return fix && fix.v === FIX_VERSION && fix.salt === rec.wrap.salt ? fix : null;
}
const fixNow = async (env, u) => (isTest(u) ? fixtureOf(env, u, await env.STMT.get("u:" + u, "json")) : null);
const keep = (env, u, fix) => env.STMT.put(fixKey(u), JSON.stringify(fix));
/* a test account with no fixture yet makes nothing real: it waits for the publish */
const soon = () => Object.assign(refusal("testSoon"), { status: 409 });

/** The account's record, u:<username>, as every customer road reads it: a test account's with its fixture over it. */
export async function accountRecord(env, u) {
  const rec = await env.STMT.get("u:" + u, "json");
  const fix = await fixtureOf(env, u, rec);
  if (!fix) return rec;
  return Object.assign({}, rec, { assoc: true, env: fix.env || rec.env, live: fix.live || null, prices: fix.prices || rec.prices || null,
    card: fix.card || null });
}

/** Their orders and claims with the fixture's beside them, newest first, as GET /orders hands them over. */
export async function withExamples(env, u, orders, claims) {
  const fix = await fixNow(env, u);
  if (!fix) return { orders, claims };
  const newest = (a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0);
  const state = env.ORDERBOOK ? await exampleAccount(env, u) : null;
  if (state && !state.ok) throw new Error(state.error);
  return { orders: orders.concat((state ? state.account.orders : fix.orders || []).map(customerView)).sort(newest),
    claims: claims.concat((state ? state.account.claims : fix.claims || []).map(claimView)).sort(newest) };
}

export async function exampleAccount(env, u, move = {}) {
  const fix = await fixNow(env, u);
  if (!fix) return Object.assign({ ok: false }, soon());
  if (!env.ORDERBOOK) return { ok: false, error: "Acceptance claim storage is unavailable.", status: 503 };
  const generation = JSON.stringify([fix.salt, fix.at || "", fix.env?.iv || ""]);
  if (move.expectedGeneration !== undefined && move.expectedGeneration !== generation)
    return { ok: false, error: "The acceptance publication changed. Preview it again.", status: 409 };
  const result = await fixtureAccountMove(env, {
    u, generation, seed: { claims: fix.claims || [], sales: fix.makerBook?.sales || [],
      orders: fix.makerOrders || fix.orders || [], pools: fix.pools || [] },
    actor: "read", ...move
  });
  return { ...result, generation, orders: result.account?.orders || [], prepared: !!fix.makerBook };
}

/** An example order's id: shown by a test account alone. */
export const EXAMPLE_ID = /^[0-9]{14}-ex[a-z0-9]{2,6}$/;
export const isExample = (u, id) => isTest(u) && EXAMPLE_ID.test(String(id || ""));

/** A move of theirs on an example order, by the order book's own rules, written back into the fixture; a retry once. */
export async function exampleMove(env, u, id, action, body) {
  if (env.ORDERBOOK) {
    const result = await exampleAccount(env, u, { actor: "order", id, action, body,
      request: { id, action, body }, rid: ridOf(body) || crypto.randomUUID() });
    return result.ok ? { order: customerView(result.order) } : { error: result.error, status: result.status };
  }
  const fix = await fixNow(env, u);
  const i = fix ? fix.orders.findIndex((o) => o.id === id) : -1;
  if (i < 0) return Object.assign(refusal("noOrder"), { status: 404 });
  const rid = ridOf(body), rids = fix.rids = fix.rids || {};
  if (rid && rids[rid] === id) return { order: fix.orders[i] };
  const mine = fix.orders.concat(await ordersOf(env, u));
  const d = decideCustomer(fix.orders[i], action, body, mine, new Date().toISOString());
  if (d.error) return d;
  const order = applyEvent(JSON.parse(JSON.stringify(fix.orders[i])), d.ev).order;
  fix.orders[i] = customerView(order);
  if (rid) rids[rid] = id;
  await keep(env, u, fix);
  return { order };
}

export async function exampleReplace(env, u, id, body) {
  const fix = await fixNow(env, u);
  if (!fix) return soon();
  if (!body || typeof body !== "object" || Array.isArray(body)
    || Object.hasOwn(body, "total") || Object.hasOwn(body, "unit"))
    return Object.assign(refusal("amendShape"), { status: 400 });
  const i = fix.orders.findIndex((order) => order.id === id);
  if (i < 0) return Object.assign(refusal("noOrder"), { status: 404 });
  const rid = ridOf(body), rids = fix.rids = fix.rids || {}, key = "replace:" + id + ":" + rid;
  const seen = rid && fix.orders.find((order) => order.id === rids[key]);
  if (seen) return { order: seen };
  const product = (fix.prices && fix.prices.products || []).find((item) => item.product === body.product);
  const quote = product && product.sizes.find((size) => size.q === body.qty);
  if (!quote) return Object.assign(refusal("amendPrices"), { status: 409 });
  const priced = Object.assign({}, body, { total: quote.price, unit: +(quote.price / quote.q).toFixed(2) });
  if (env.ORDERBOOK) {
    const result = await exampleAccount(env, u, { actor: "replace", id, body: priced,
      digest: fix.prices?.digest || "", request: { id, body }, rid: rid || crypto.randomUUID() });
    return result.ok ? { order: customerView(result.order) } : { error: result.error, status: result.status };
  }
  const d = decideReplace(fix.orders[i], priced, fix.orders, new Date().toISOString(), fix.prices && fix.prices.digest || "");
  if (d.error) return d;
  d.place.order.id = d.place.order.id.slice(0, 15) + "ex" + crypto.randomUUID().replace(/-/g, "").slice(0, 6);
  d.cancel.replacement = d.place.order.id;
  fix.orders[i] = customerView(applyEvent(fix.orders[i], d.cancel).order);
  const order = customerView(applyEvent(null, d.place).order);
  fix.orders.push(order);
  rids[key] = order.id;
  await keep(env, u, fix);
  return { order };
}

/** Negotiate: a test account's ask for a price, into its fixture alone, by decidePlace's own rules; a retry once. No
    desk ever sees it, so the fixture's own cases show what follows (offered, taken, passed, lapsed). */
export async function examplePlace(env, u, body) {
  const fix = await fixNow(env, u);
  if (!fix) return soon();
  if (!env.ORDERBOOK) return Object.assign(refusal("askStore"), { status: 503 });
  const p = fix.prices || {};
  const result = await exampleAccount(env, u, { actor: "place", body, digest: p.digest || "", steps: p.steps || null,
    request: body, rid: ridOf(body) || crypto.randomUUID() });
  return result.ok ? { order: result.order } : { error: result.error, code: result.code, vars: result.vars, status: result.status };
}

/** Their claim against a test account, into its fixture: it waits there, as a customer's waits on him; a retry once. */
export async function exampleClaim(env, u, body) {
  const fix = await fixNow(env, u);
  if (!fix) return soon();
  if (env.ORDERBOOK) {
    const result = await exampleAccount(env, u, { actor: "customer", request: body, rid: ridOf(body) || crypto.randomUUID() });
    return result.ok ? { claim: result.claim } : { error: result.error, status: result.status };
  }
  const claims = fix.claims = fix.claims || [], rid = ridOf(body), rids = fix.rids = fix.rids || {};
  const again = rid && claims.find((c) => c.id === rids[rid]);
  if (again) return { claim: again };
  const d = decideAccountClaim(u, body, claims.filter((c) => c.state === "waiting"), new Date().toISOString());
  if (d.error) return d;
  const claim = applyEvent(null, d.ev).order;
  claims.push(claim);
  if (rid) rids[rid] = claim.id;
  await keep(env, u, fix);
  return { claim };
}

/** A test account's group orders, from its fixture alone (a real pool is never shown to one): the units in are the fixture's own
 *  invented others (`seedUnits`) and the live orders joined in it. [] with no fixture, and on the KV road, which keeps no pool. */
export async function examplePools(env, u) {
  const fix = await fixNow(env, u);
  if (!fix || !env.ORDERBOOK) return [];
  const state = await exampleAccount(env, u);
  if (!state.ok) throw new Error(state.error);
  const orders = state.account.orders;
  return (state.account.pools || []).map((p) => {
    const mine = (p.joins || []).find((j) => j.u === u && joinLive(orders.find((o) => o.id === j.oid)));
    return Object.assign({}, p, { mine: mine ? mine.oid : null, unitsIn: +((+p.seedUnits || 0) + poolUnits(p, (uu, oid) => orders.find((o) => o.id === oid))).toFixed(3) });
  });
}
/** Their join on a fixture pool, by the book's own rules, in their fixture alone; a retry once. */
export async function exampleJoin(env, u, id, body) {
  const fix = await fixNow(env, u);
  if (!fix) return soon();
  if (!env.ORDERBOOK) return { error: POOL_ON_KV, status: 503 };
  const result = await exampleAccount(env, u, { actor: "pjoin", id, body, digest: (fix.prices && fix.prices.digest) || "",
    request: { id, body }, rid: ridOf(body) || crypto.randomUUID() });
  return result.ok ? { order: customerView(result.order) } : { error: result.error, status: result.status,
    ...(result.code ? { code: result.code } : {}), ...(result.vars ? { vars: result.vars } : {}) };
}

/** Step 7: the fixture's thread, or null: a test account's thread lives there alone, so the desk's Chat never lists it. */
export async function exampleThread(env, u) {
  const fix = await fixNow(env, u);
  if (fix && env.ORDERBOOK) {
    const result = await fixtureThreadMove(env, fixtureThreadArgs(u, fix, "read"));
    if (result.error) throw new Error(result.error);
    return result.thread;
  }
  return (fix && fix.thread) || null;
}
const fixtureThreadArgs = (u, fix, actor, body) => ({
  u, actor, body: actor === "customer" ? { text: body && body.text }
    : body && body.noReply === true ? { noReply: true, rid: ridOf(body) } : { message: body && body.message, rid: ridOf(body) },
  rid: ridOf(body),
  generation: JSON.stringify([fix.salt, fix.at || "", fix.env && fix.env.iv || ""]),
  seed: fix.thread || null
});
/** A line of theirs on a test account's thread, into its fixture by the book's own rules; a retry once. */
export async function exampleSay(env, u, body) {
  const fix = await fixNow(env, u);
  if (!fix) return soon();
  if (env.ORDERBOOK) return fixtureThreadMove(env, fixtureThreadArgs(u, fix, "customer", body));
  const rid = ridOf(body), rids = fix.rids = fix.rids || {};
  if (rid && rids[rid] === "thread") return { thread: fix.thread };
  const d = decideThread(fix.thread || null, body, "customer", new Date().toISOString(), u);
  if (d.error) return d;
  fix.thread = applyEvent(fix.thread || null, d.ev).order;
  if (rid) rids[rid] = "thread";
  await keep(env, u, fix);
  return { thread: fix.thread };
}

export async function exampleDeskSay(env, u, body) {
  if (!env.ORDERBOOK) return Object.assign(refusal("threadOff"), { status: 503 });
  const fix = await fixNow(env, u);
  if (!fix) return soon();
  return fixtureThreadMove(env, fixtureThreadArgs(u, fix, "desk", body));
}

/** The fixture's links beside their own, for /my/refs. */
export async function examplesRefs(env, u) {
  const fix = await fixNow(env, u);
  return (fix && fix.refs) || [];
}
/* A LINK A TEST ACCOUNT MINTS is the fixture's, waiting on him as an associate's does, and never a g: record: a real one
   would wait in Salt Account's count and outlive the account. Its id holds an l, which no real link's can. Null with no
   fixture, when the account is no associate and Links is not open to it. */
export async function exampleMint(env, u, max) {
  const fix = await fixNow(env, u);
  if (!fix) return null;
  const refs = fix.refs = fix.refs || [];
  if (refs.filter((r) => !r.revoked).length >= max) return { full: true };
  const d = () => "23456789"[crypto.getRandomValues(new Uint8Array(1))[0] % 8];
  const rec = { id: "ex" + d() + d() + "-lnk" + d(), made: new Date().toISOString(), opens: 0, last: null, approved: false };
  refs.push(rec);
  await keep(env, u, fix);
  return { ref: rec };
}
/** One of the fixture's links withdrawn, as an associate withdraws their own; null when it is not one. */
export async function exampleRevoke(env, u, id) {
  const fix = await fixNow(env, u);
  const r = fix && (fix.refs || []).find((x) => x.id === id);
  if (!r) return null;
  r.revoked = true;
  await keep(env, u, fix);
  return { ref: r };
}

/** The invented account numbers the pay sheet shows a test account (Phase 7b): the fixture's `paynum`, {key: {number}}, through the
 *  same whitelist as the real record, and {} with no fixture. The real record in KV `paynum` is never read for a test account. */
export async function examplePaynum(env, u) {
  const fix = await fixNow(env, u);
  return numbersOf({ v: 1, accounts: (fix && fix.paynum) || null });
}

/** COUNTER BATCH A (18 Oct 2026): THE TEST ACCOUNTS' COLLECTION POINT, invented and never one of his: "Z9", on a public square.
 *  Counter Admin offers it, and only it, at Ready on an example order, and stmt/maker.js resolves an example order's point from it,
 *  so no real point's place is ever written into a fixture. */
export const EXAMPLE_POINTS = Object.freeze([Object.freeze({ code: "Z9", lat: 3.14786, lng: 101.69369 })]);

/** The fixture's bulletin, for a test account while he has none of his own set. */
export async function exampleBulletin(env, u) {
  const fix = await fixNow(env, u);
  return (fix && fix.bulletin) || null;
}
