/* stmt/testusers.js: HIS TEST ACCOUNTS, ONE LIST (the Counter test surface, his answers of 18 Oct 2026). A leaf: it imports
 * nothing, so the order book, the fixture, Counter Admin's page and the Worker read the same names from one place. Zeros and
 * ones are outside the alphabet a real username is drawn from, so none of these can collide with an account or be reached by
 * mistyping one. The Desk (src/) keeps its own literals, 0000-000[0-2], because the build id hashes src/*.js alone and an
 * import from here would ship Desk code unbuilt. */
export const TEST_USER = "0000-0000";
export const TEST_LOCKED = "0000-0001";
export const TEST_FRESH = "0000-0002";
/* each test account and the state its fixture stands in: open (every case a customer sees), locked (the overdue gate, paying
   only), fresh (room to order: two open, the rest done, cancelled or declined) */
export const TESTS = Object.freeze({ [TEST_USER]: "open", [TEST_LOCKED]: "locked", [TEST_FRESH]: "fresh" });
export const TEST_USERS = Object.freeze(Object.keys(TESTS));
export const isTest = (u) => Object.prototype.hasOwnProperty.call(TESTS, String(u || ""));
