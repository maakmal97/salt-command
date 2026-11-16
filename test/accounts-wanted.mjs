/* test/accounts-wanted.mjs: A NEW ID'S ACCOUNT IS ASKED FOR UNTIL IT IS THERE (17 Nov 2026, his "Both A and B"; src/accounts-wanted.js).
 *   A1  an approved roster draft of a statement kind, its code in no value of the published map, waits; a held code, a -R bucket, a supplier,
 *       one approved over a day ago and an unreadable row do not
 *   A2  the rungs: nothing before 6 minutes after the newest approval, one ask at 6, 15 and 30, the rung mark written before the ask, then silent
 *   A3  a code the map holds asks nothing, and a newer approval starts the rungs again
 * The cron's wiring and a run GitHub never started are driven in section "Publish on change" 5c and 5d (test/verify.mjs).
 * Every assertion is red under its own mutation (test/accounts-wanted.mutations.json). */
import { codesWaiting, accountsWanted, ACCOUNT_WANTED_KEY } from "../src/accounts-wanted.js";

const J = JSON.stringify;
class MiniKV {
  constructor() { this.m = new Map(); }
  async get(k, t) { const v = this.m.has(k) ? this.m.get(k) : null; return v == null ? null : t === "json" ? JSON.parse(v) : v; }
  async put(k, v) { this.m.set(k, String(v)); }
}
const T = Date.parse("2026-11-17T05:00:00.000Z");
const at = (min) => new Date(T + min * 60000);
const draft = (code, kind, min) => ({ row: JSON.stringify({ code, kind }), decided_at: at(min).toISOString() });
const db = (rows) => ({ prepare: (sql) => ({ all: async () => ({ results: /collection='roster'/.test(sql) && /committed_at IS NULL/.test(sql) && /status='approved'/.test(sql) ? rows : [] }) }) });

export async function run({ ok }) {
  /* A1 */
  const rows = [draft("CA9-NEW", "customer", 0), draft("CA9-OLD", "customer", 0), draft("CA9-NEW-R", "customer", 0), draft("SU1-SUP", "supplier", 0),
    draft("CB2-AGO", "customer", -25 * 60), draft("RS3-ASC", "reseller", 0), { row: "{not json", decided_at: at(0).toISOString() }];
  const w = codesWaiting(rows, { "abcd-efgh": "CA9-OLD" }, at(10)).map((x) => x.code);
  ok(J(w) === J(["CA9-NEW", "RS3-ASC"]),
    "A1 a new customer or associate with no account waits; a held code, a -R bucket, a supplier, one over a day old and an unreadable row do not: " + J(w));

  /* A2 */
  const kv = new MiniKV(), env = { SALT_LEDGER: db([draft("CA9-NEW", "customer", 0)]), SALT_QUEUE: kv };
  const asks = [];
  const want = async (why) => { asks.push({ why, mark: await kv.get(ACCOUNT_WANTED_KEY, "json") }); return true; };
  const seq = [];
  for (const m of [5, 6, 7, 14, 15, 29, 30, 60]) seq.push([m, await accountsWanted(env, at(m), want)]);
  const did = seq.filter(([, r]) => r.did).map(([m, r]) => [m, r.tries]);
  ok(J(did) === J([[6, 1], [15, 2], [30, 3]]) && asks.length === 3 && asks.every((a) => a.why === "account for CA9-NEW" && a.mark && a.mark.tries >= 1)
    && seq.find(([m]) => m === 30)[1].last === true && seq.find(([m]) => m === 60)[1].silent === true,
    "A2 one ask at 6, 15 and 30 minutes, each with its rung already marked, the last said, then silent: " + J({ did, asks, last: seq.slice(-1) }));

  /* A3 */
  const kv2 = new MiniKV(); await kv2.put("stmt-users", J({ "abcd-efgh": "CA9-NEW" }));
  const asks2 = [];
  const held = await accountsWanted({ SALT_LEDGER: db([draft("CA9-NEW", "customer", 0)]), SALT_QUEUE: kv2 }, at(20), async (why) => asks2.push(why));
  const kv3 = new MiniKV(), asks3 = [];
  const w3 = async (why) => asks3.push(why);
  for (const m of [6, 15, 30, 31]) await accountsWanted({ SALT_LEDGER: db([draft("CA9-NEW", "customer", 0)]), SALT_QUEUE: kv3 }, at(m), w3);
  const newer = [];
  for (const m of [36, 40]) newer.push(await accountsWanted({ SALT_LEDGER: db([draft("CA9-NEW", "customer", 0), draft("CC3-TWO", "customer", 30)]), SALT_QUEUE: kv3 }, at(m), w3));
  ok(!held.did && asks2.length === 0 && asks3.length === 4 && asks3[3] === "account for CA9-NEW, CC3-TWO" && newer[0].did && newer[0].tries === 1 && !newer[1].did,
    "A3 a code the map holds asks nothing; a newer approval after the last rung starts the rungs again, naming both: " + J({ held, asks3, newer }));
}
