#!/usr/bin/env node
/* tools/roster-export.mjs: S5 OF THE BOOK PLAN, THE ROSTER ROAD'S GIT SIDE (28 Oct 2026; plan: docs/plan-book-s5-s6.html). Dormant until the flip.
 *
 * Once the Book is the source, an Add ID or a rename is booked by the tap (flag D1 book_roster) and the fold no longer runs, so nothing moves the files git holds BESIDE the book: the
 * statement username (statements/_users.json: a registration takes the next free spare account, a rename moves the account to the new code, its username unchanged), the place override
 * (geo/places.json LOCS) and the suite's fixtures that name a live code. This is that step, and it does it with the fold's own functions (tools/fold.mjs mintUsernames, renameUsers,
 * renameLocs, renameSuiteText), from what the Book RECORDED each entry did (GET /book/roster: codes, kinds and the re-key pairs, never a row or a figure).
 *
 *   sideFiles(events, files, spares)   pure: the events in booking order against { users, places, suite }, a registration binding the next spare (and then it is not free for the next), a rename
 *                                      moving the account, the override and the fixtures; answers the new files and a report. Idempotent: an account that exists is never touched, a code already
 *                                      moved has nothing left to move, so a replay changes nothing.
 *   fetchRoster(base, env, after)      the Worker's route behind the two keys of the readcheck, retrying a 5xx.
 *   --init                             writes the watermark at the Book's highest booking order, touching nothing else: the flip's first step, so entries the fold already took are not replayed.
 *   --apply                            writes the files and the watermark (statements/_roster_export.json); without it nothing is written (a dry run). The log says counts and codes only.
 * The laptop's _passwords.json (gitignored) is not here: it is laptop only, and the seal tool pairs a re-keyed code back by verifier proof (tools/stmt-seal.mjs), as it has for every rename.
 *
 *   node tools/roster-export.mjs [--init|--apply]   SALT_BASE, SALT_BOOK_KEY, CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET in the environment */
import "./cloudflare.mjs";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mintUsernames, renameUsers, renameLocs, renameSuiteText } from "./fold.mjs";
import { freeSpares, oneCodeEach } from "./stmt-pool.mjs";
import { usersJson } from "./stmt-crypto.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** the Worker's GET /book/roster: {ok, rev, at, max, events:[{seq, draft_id, effects, folded}]} or {error}. A 4xx is final. */
export async function fetchRoster(base, env, after, { tries = 3, wait = 2000, fetchImpl = fetch } = {}) {
  const key = String(env.SALT_BOOK_KEY || "");
  if (!key) return { error: "SALT_BOOK_KEY is not set, so the Book was not read" };
  const headers = { "X-Book-Key": key };
  if (env.CF_ACCESS_CLIENT_ID && env.CF_ACCESS_CLIENT_SECRET) { headers["CF-Access-Client-Id"] = env.CF_ACCESS_CLIENT_ID; headers["CF-Access-Client-Secret"] = env.CF_ACCESS_CLIENT_SECRET; }
  let last = "";
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetchImpl(base.replace(/\/+$/, "") + "/book/roster?after=" + (after || 0), { headers });
      const j = await r.json().catch(() => ({}));
      if (r.status === 200 && j && j.ok && Array.isArray(j.events)) return j;
      last = "HTTP " + r.status + " " + String((j && j.error) || "").slice(0, 200);
      if (r.status < 500) return { error: last };
    } catch (e) { last = String((e && e.message) || e); }
    if (i < tries) await new Promise((res) => setTimeout(res, wait));
  }
  return { error: last };
}

/** the entries booked and not yet folded: the fold stops at the flip, so these would never be exported once the watermark passed them (--init refuses while any stands) */
export const openEntries = (events) => (events || []).filter((e) => !e.folded);

/** the events against the files, in booking order. `files` = { users: {code: username}, places: {LOCS...}, suite: text or null }; `spares` the free spare usernames, in order. Mutates nothing it was given. */
export function sideFiles(events, files, spares) {
  const users = { ...(files.users || {}) }, places = JSON.parse(JSON.stringify(files.places || {})), free = (spares || []).slice();
  let suite = files.suite == null ? null : String(files.suite);
  const rep = { minted: [], bound: [], waiting: [], renamed: [], moved: { users: 0, locs: 0, suite: false } };
  const evs = (events || []).slice().sort((a, b) => a.seq - b.seq);
  /* where a code ends up through the renames booked after position i: a registration whose code was renamed on and whose account already stands under the new code is a replay, and mints nothing */
  const finalOf = (code, i) => { let c = code; for (const later of evs.slice(i + 1)) for (const rn of (later.effects || {}).renames || []) for (const [f, to] of rn.pairs || []) if (f === c) c = to; return c; };
  for (let i = 0; i < evs.length; i++) {
    const ev = evs[i], fx = ev.effects || {};
    for (const rg of fx.roster || []) {
      if (!rg.register || users[rg.code]) continue;
      const end = finalOf(rg.code, i);
      if (end !== rg.code && users[end]) continue;
      const before = Object.keys(users).length;
      mintUsernames(users, { approved: [{ collection: "roster", id: ev.draft_id, row: { code: rg.code, kind: rg.kind } }] }, [ev.draft_id], free);
      if (Object.keys(users).length > before) {
        rep.minted.push(rg.code);
        const i = free.indexOf(users[rg.code]);
        if (i >= 0) { free.splice(i, 1); rep.bound.push(rg.code); } else rep.waiting.push(rg.code);
      }
    }
    for (const rn of fx.renames || []) {
      const pairs = rn.pairs || [];
      const had = pairs.filter(([f, t]) => users[f] && !users[t]).length;
      renameUsers(users, pairs); rep.moved.users += had;
      rep.moved.locs += renameLocs(places, pairs);
      if (suite !== null) { const next = renameSuiteText(suite, pairs); if (next !== suite) { suite = next; rep.moved.suite = true; } }
      rep.renamed.push(...pairs.map((x) => x[0] + " -> " + x[1]));
    }
  }
  oneCodeEach(users);
  return { users, places, suite, report: rep };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const argv = process.argv.slice(2), has = (f) => argv.includes(f);
  const MARK = resolve(REPO, "statements", "_roster_export.json"), USERS = resolve(REPO, "statements", "_users.json"), PLACES = resolve(REPO, "geo", "places.json"), SUITE = resolve(REPO, "test", "verify.mjs");
  const mark = existsSync(MARK) ? JSON.parse(readFileSync(MARK, "utf8")) : { seq: 0 };
  const base = process.env.SALT_BASE;
  if (!base) { console.log("  FAIL  SALT_BASE is not set"); process.exit(1); }
  const res = await fetchRoster(base, process.env, has("--init") ? 0 : mark.seq);
  if (res.error) { console.log("  FAIL  the Book's roster entries were not read: " + res.error); process.exit(1); }
  if (has("--init")) {
    const open = openEntries(res.events);
    if (open.length) { console.log("  FAIL  --init refused: " + open.length + " roster or rename entr" + (open.length === 1 ? "y is" : "ies are") + " booked and not yet folded (booking order " + open.map((e) => e.seq).join(", ") + "); once the fold stops nothing would export them. Let a fold take them, or export them first with --apply"); process.exit(1); }
    writeFileSync(MARK, JSON.stringify({ seq: res.max }) + "\n"); console.log(`  ok    the watermark is the Book's highest booking order (${res.max}); nothing else was touched`); process.exit(0);
  }
  const users = existsSync(USERS) ? JSON.parse(readFileSync(USERS, "utf8")) : {};
  const out = sideFiles(res.events, { users, places: JSON.parse(readFileSync(PLACES, "utf8")), suite: existsSync(SUITE) ? readFileSync(SUITE, "utf8") : null }, freeSpares(resolve(REPO, "statements"), users));
  const r = out.report;
  console.log(`  ${res.events.length} roster or rename entr${res.events.length === 1 ? "y" : "ies"} after ${mark.seq}: ${r.minted.length} registered (${r.bound.length} on a spare account, ${r.waiting.length} waiting for the laptop's next update), ${r.renamed.length} code${r.renamed.length === 1 ? "" : "s"} re-keyed`);
  if (r.waiting.length) console.log("  note  no spare account was free for " + r.waiting.join(", ") + ": the account is made at the next laptop update");
  if (!has("--apply")) { console.log("  dry run: nothing written (--apply writes)"); process.exit(0); }
  if (r.minted.length || r.moved.users) writeFileSync(USERS, usersJson(out.users));
  if (r.moved.locs) { writeFileSync(PLACES, JSON.stringify(out.places, null, 1) + "\n"); execFileSync("node", [resolve(REPO, "tools", "geosync.mjs"), "--sync"], { cwd: REPO, encoding: "utf8" }); }
  if (r.moved.suite) writeFileSync(SUITE, out.suite);
  writeFileSync(MARK, JSON.stringify({ seq: Math.max(mark.seq, res.max) }) + "\n");
  console.log("  ok    the files are written and the watermark is " + Math.max(mark.seq, res.max));
}
