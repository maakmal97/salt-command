/* stmt/testfix.js: HIS TEST ACCOUNT, AND WHAT IT SHOWS (v689; the fixture, 29 Sep 2026, his instruction that it show
 * every feature a customer sees).
 *
 * THE TEST ACCOUNT (v689, his instruction of 18 Sep 2026): one account he can open anywhere, that counts nowhere, and
 * that he can destroy with one tap. ITS NAME IS THE POINT: zeros are not in the alphabet a real username is drawn from,
 * so this one cannot collide with an account and cannot be arrived at by mistyping one.
 *
 * THE FIXTURE. The publish builds an invented account holding a case of every feature (tools/testfix.mjs), seals its
 * documents under the test account's key and puts it at FIX_KEY. Here it is LAID OVER the test account as it is read,
 * and never written anywhere an order, a claim or a link lives: its orders are not in the order book or under order:,
 * its claims not under aclaim:, its links not under g:. So every reader that counts (the desk's reconcile, his lists,
 * the chase, the report card) cannot see it, by construction. `salt` ties it to the test account it was sealed for;
 * an account unmade and made again has a new key, and a fixture sealed for the old one is not served.
 * Nothing here imports anything but the words.
 */
import { refusal } from "./words.js";

export const TEST_USER = "0000-0000";
export const TEST_PASS = "0000-0000-0000-0000";
export const FIX_KEY = "testfix";
export const FIX_VERSION = 1;

/** The fixture for this account as read, or null: the test account alone, and only the one it was sealed for. */
export async function fixtureOf(env, u, rec) {
  if (u !== TEST_USER || !rec || rec.test !== true || !rec.wrap) return null;
  let fix = null;
  try { fix = await env.STMT.get(FIX_KEY, "json"); } catch (e) { fix = null; }
  return fix && fix.v === FIX_VERSION && fix.salt === rec.wrap.salt ? fix : null;
}

/** The account's record, u:<username>, as every customer road reads it: the test account's with its fixture over it. */
export async function accountRecord(env, u) {
  const rec = await env.STMT.get("u:" + u, "json");
  const fix = await fixtureOf(env, u, rec);
  if (!fix) return rec;
  return Object.assign({}, rec, { assoc: true, live: fix.live || rec.live || null, prices: fix.prices || rec.prices || null,
    card: fix.card || null });
}

/** Their orders and claims with the fixture's beside them, newest first, as GET /orders hands them over. */
export async function withExamples(env, u, orders, claims) {
  if (u !== TEST_USER) return { orders, claims };
  const fix = await fixtureOf(env, u, await env.STMT.get("u:" + u, "json"));
  if (!fix) return { orders, claims };
  const newest = (a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0);
  return { orders: orders.concat(fix.orders || []).sort(newest), claims: claims.concat(fix.claims || []).sort(newest) };
}

/** The fixture's links beside their own, for /my/refs. */
export async function examplesRefs(env, u) {
  if (u !== TEST_USER) return [];
  const fix = await fixtureOf(env, u, await env.STMT.get("u:" + u, "json"));
  return (fix && fix.refs) || [];
}

/** The fixture's bulletin, for the test account while he has none of his own set. */
export async function exampleBulletin(env, u) {
  if (u !== TEST_USER) return null;
  const fix = await fixtureOf(env, u, await env.STMT.get("u:" + u, "json"));
  return (fix && fix.bulletin) || null;
}

/** A move on an example order is refused in words, never a missing order: it is shown and never moves. */
export const EXAMPLE_ID = /^[0-9]{14}-ex[0-9]{2}$/;
export const isExample = (u, id) => u === TEST_USER && EXAMPLE_ID.test(String(id || ""));
export const exampleRefusal = () => Object.assign(refusal("example"), { status: 409 });
/* THE TEST ACCOUNT MAKES NO LINK. The fixture makes it an associate, and a link it minted would be a real g: record,
   waiting on him in Salt Account's count and outliving the account; so its links are the fixture's, shown, never made
   or withdrawn. */
export const exampleLinkRefusal = () => Object.assign(refusal("exampleLink"), { status: 409 });
