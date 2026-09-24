/* tools/stmt-pool.mjs: THE SPARE ACCOUNTS (D15, his answer of 24 Sep 2026: accounts ready on day one).
 *
 * A SPARE is an account the laptop mints before anybody needs it (`node tools/stmt-account.mjs --pool`):
 * a username, its record sealed with an empty bundle, and its password sealed under the master as
 * pwMaster, filed in the newest issue's _kv beside every other record and marked `spare: true`. It is
 * FREE while no code in statements/_users.json holds its username. The fold binds the next free one to
 * a new code at Add ID, which is one line in _users.json, and the publish in the same run seals that
 * customer's statement and price list into it, so a walk-in can sign in within the fold's few minutes.
 *
 * NO KEY AND NO MASTER HERE, and none is needed: this reads committed files and nothing else, which is
 * why the fold in CI may call it. It imports nothing of the statements run, so the fold never loads one.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/* about ten, his figure: every spare is one more small record on every publish. The laptop's chain
   says the pool is low under POOL_LOW, and one line tops it up to POOL_SIZE again. */
export const POOL_SIZE = 10;
export const POOL_LOW = 3;

/** The issue the publish reads: the newest YYYY-MM folder holding a _kv. */
export function newestIssue(root) {
  let latest = null;
  for (const d of readdirSync(root).filter((x) => /^\d{4}-\d{2}$/.test(x)).sort()) {
    if (existsSync(join(root, d, "_kv"))) latest = d;
  }
  return latest;
}

/** A record is a spare while it is marked one and no code holds its username (`byUser`: username to code). */
export const isSpare = (rec, byUser) => !!rec && rec.spare === true && !byUser[rec.u];

/** The free spares in the newest issue, sorted by username, so "the next" is the same on every machine. */
export function freeSpares(root, users) {
  const issue = newestIssue(root);
  if (!issue) return [];
  const byUser = {};
  for (const c of Object.keys(users || {})) byUser[users[c]] = c;
  const dir = join(root, issue, "_kv");
  const out = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
    let rec = null;
    try { rec = JSON.parse(readFileSync(join(dir, f), "utf8")); } catch (e) { continue; }
    if (isSpare(rec, byUser)) out.push(rec.u);
  }
  return out;
}
