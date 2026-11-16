/* src/accounts-wanted.js: A NEW ID'S ACCOUNT IS ASKED FOR UNTIL IT IS THERE (17 Nov 2026, his "Both A and B").
 *
 * With the Book as the source an Add ID is booked at his tap, but its account is bound by the next publish
 * (cloud-commit.yml's "Export the Book to the checkout for the publish", tools/roster-export.mjs). The re-dispatch
 * ladder stands down with the Book as the source, so a publish GitHub dropped or left queued had no net but the
 * four-a-day schedule: on 16 Nov 2026 CA9-TBC waited 35 minutes behind a run GitHub never started.
 *
 * The publish writes the username-to-code map into this Worker's KV (`stmt-users`, tools/stmt-publish.mjs) on every
 * run, so "is the account there" is one read: an approved roster draft of a kind that has a statement, its code no
 * value of that map, is an ID still waiting for its username. (With no spare free the export still names one and the
 * publish maps it, so the code leaves this set though it cannot sign in until the laptop mints the account: this net is
 * "the username published", the pool and Salt Admin's Accounts card are the rest.) The minute cron asks for a publish
 * (`wantPublish`) at 11, 20 and 40 minutes after the NEWEST such approval, once per rung, the rung mark written first,
 * then leaves it to the four-a-day net. The first rung is past the Worker's STUCK_MIN (10), so a dispatch GitHub never
 * started no longer covers it (Fable's review of 17 Nov 2026). Only a STRICTLY newer approval starts the rungs again: a
 * newer one bound while an older one waits leaves the rungs where they stood. Only drafts the day's export has not yet marked committed are read
 * (`draft_status_committed`, migrations/0012), and none approved over a day ago. */
import { STATEMENT_KINDS } from "../engine/apply.mjs";

export const ACCOUNT_WANTED_KEY = "account:wanted";
export const ACCOUNT_RUNGS_MIN = [11, 20, 40];
const DAY_MS = 86400000;

/** the codes approved and booked with no account yet: [{code, at}], from the draft rows and the published map */
export function codesWaiting(rows, users, now) {
  const held = new Set(Object.values(users || {}));
  const out = [];
  for (const r of rows || []) {
    let row = null;
    try { row = JSON.parse(r.row || "{}"); } catch (e) { continue; }
    const code = row && row.code, at = Date.parse(r.decided_at);
    if (typeof code !== "string" || !code || /-R$/.test(code) || !STATEMENT_KINDS.includes(row.kind)) continue;
    if (!Number.isFinite(at) || now.getTime() - at > DAY_MS || held.has(code)) continue;
    out.push({ code, at: r.decided_at });
  }
  return out;
}

/** one minute of the net. `want(reason)` marks a publish (the Worker's wantPublish). Answers what it did, for the log. */
export async function accountsWanted(env, now, want) {
  if (!env.SALT_LEDGER || !env.SALT_QUEUE) return {};
  const r = await env.SALT_LEDGER.prepare(
    "SELECT row, decided_at FROM draft WHERE status='approved' AND committed_at IS NULL AND collection='roster'").all();
  if (!r || !r.results || !r.results.length) return {};
  let users = {};
  try { users = (await env.SALT_QUEUE.get("stmt-users", "json")) || {}; } catch (e) { return { unread: true }; }
  const waiting = codesWaiting((r && r.results) || [], users, now);
  if (!waiting.length) return {};
  const newest = waiting.map((w) => w.at).sort().pop();
  let mark = null;
  try { mark = await env.SALT_QUEUE.get(ACCOUNT_WANTED_KEY, "json"); } catch (e) { mark = null; }
  const tries = mark && typeof mark.newest === "string" && newest <= mark.newest ? (mark.tries || 0) : 0;
  const codes = waiting.map((w) => w.code);
  if (tries >= ACCOUNT_RUNGS_MIN.length) return { codes, tries, silent: true };
  const age = (now.getTime() - Date.parse(newest)) / 60000;
  if (age < ACCOUNT_RUNGS_MIN[tries]) return { codes, tries };
  await env.SALT_QUEUE.put(ACCOUNT_WANTED_KEY, JSON.stringify({ newest, tries: tries + 1, at: now.toISOString() }));
  await want("account for " + codes.join(", "));
  return { did: true, codes, tries: tries + 1, last: tries + 1 === ACCOUNT_RUNGS_MIN.length };
}
