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
 * publish seals the examples afresh. One KV value an account: a tap may take a minute to show on another phone.
 */
import { decideCustomer, decideAccountClaim, applyEvent, customerView, claimView, ordersOf, ridOf } from "./orders.js";
import { refusal } from "./words.js";

export const TEST_USER = "0000-0000";
export const TEST_LOCKED = "0000-0001";
export const TEST_PASS = "0000-0000-0000-0000";
/* each test account and the state its fixture stands in */
export const TESTS = { [TEST_USER]: "open", [TEST_LOCKED]: "locked" };
export const TEST_USERS = Object.keys(TESTS);
export const isTest = (u) => Object.prototype.hasOwnProperty.call(TESTS, String(u || ""));
export const FIX_VERSION = 3;
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
  return { orders: orders.concat(fix.orders || []).sort(newest), claims: claims.concat((fix.claims || []).map(claimView)).sort(newest) };
}

/** An example order's id: shown by a test account alone. */
export const EXAMPLE_ID = /^[0-9]{14}-ex[0-9]{2}$/;
export const isExample = (u, id) => isTest(u) && EXAMPLE_ID.test(String(id || ""));

/** A move of theirs on an example order, by the order book's own rules, written back into the fixture; a retry once. */
export async function exampleMove(env, u, id, action, body) {
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

/** Their claim against a test account, into its fixture: it waits there, as a customer's waits on him; a retry once. */
export async function exampleClaim(env, u, body) {
  const fix = await fixNow(env, u);
  if (!fix) return soon();
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

/** The fixture's bulletin, for a test account while he has none of his own set. */
export async function exampleBulletin(env, u) {
  const fix = await fixNow(env, u);
  return (fix && fix.bulletin) || null;
}
