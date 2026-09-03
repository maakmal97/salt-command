#!/usr/bin/env node
/* tools/stmt-publish.mjs: WHAT THE DEPLOY DOES FOR THE STATEMENTS, in one command.
 *
 * Runs at the foot of the deploy job after every push that deploys, which is every fold. It
 * takes the newest issue's records, seals a LIVE statement into each one under the customer's
 * content key (every entry from the start to this minute), and puts the lot into the site's
 * store in one bulk call. Then it retires every account record the issue does not carry, and
 * on a NEW issue only, clears the attempt counters, so a customer locked out last month is not
 * locked out against a password he has only just been given.
 *
 * ONE BULK CALL, NOT ONE CALL PER KEY. Thirty-seven `kv key put` calls took two and a quarter
 * minutes on 03 Sep 2026, and this runs after every fold, not once a month.
 *
 * It goes through wrangler with the deploy's own token, so it holds no Cloudflare secret of its
 * own. STMT_KEY is the one secret it needs beyond that, and without it the records still go up
 * exactly as issued: the site works, and the live document is simply absent until the secret
 * exists. `--dry <dir>` writes the bulk files and touches nothing remote, which is how the suite
 * proves it. It stands down while wrangler.stmt.jsonc still carries the placeholder store id.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { liveRecords } from "./make_statements.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = join(REPO, "wrangler.stmt.jsonc");

/** Everything the publish would do, as data: the puts, the deletes and what it found. */
export async function planPublish(root, key, now, existingKeys, storedIssue) {
  const r = await liveRecords(root, key, now);
  const puts = r.records.map(rec => ({ key: "u:" + rec.u, value: JSON.stringify(rec) }));
  const keep = new Set(r.records.map(rec => "u:" + rec.u));
  const issued = r.records.length ? r.records[0].issued : null;
  const newIssue = !!issued && storedIssue !== issued;
  const deletes = [];
  for (const k of existingKeys || []) {
    if (k.startsWith("u:") && !keep.has(k)) deletes.push(k);
    if (newIssue && k.startsWith("fail:")) deletes.push(k);
  }
  if (issued) puts.push({ key: "issue", value: issued });
  return { latest: r.latest, issued, newIssue, live: r.live, unmatched: r.unmatched, puts, deletes };
}

function wrangler(args, opts = {}) {
  return execFileSync(process.platform === "win32" ? "npx.cmd" : "npx",
    ["wrangler", "-c", CONFIG, ...args], { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], ...opts });
}
function listKeys(prefix) {
  const t = wrangler(["kv", "key", "list", "--remote", "--binding", "STMT", "--prefix", prefix]);
  const i = t.indexOf("[");
  return i < 0 ? [] : JSON.parse(t.slice(i)).map(k => String(k.name));
}

async function main() {
  const dryAt = process.argv.indexOf("--dry");
  const dry = dryAt >= 0;
  const outDir = dry ? resolve(process.argv[dryAt + 1] || join(REPO, "statements", ".publish")) : join(REPO, "statements", ".publish");
  const root = process.env.SALT_STATEMENTS_DIR || join(REPO, "statements");
  const key = process.env.STMT_KEY || "";

  if (!dry && /PLACEHOLDER_STMT_KV_ID/.test(readFileSync(CONFIG, "utf8"))) {
    console.log("the statements store is not created yet (placeholder id in wrangler.stmt.jsonc); nothing published");
    return;
  }
  let existing = [], storedIssue = null;
  if (!dry) {
    existing = [...listKeys("u:"), ...listKeys("fail:")];
    try { storedIssue = wrangler(["kv", "key", "get", "--remote", "--binding", "STMT", "issue"]).trim() || null; }
    catch (e) { storedIssue = null; }
  }
  const plan = await planPublish(root, key, new Date(), existing, storedIssue);
  if (!plan.latest) { console.log("no statement set to publish; normal for a build with no issue in it"); return; }

  mkdirSync(outDir, { recursive: true });
  const putFile = join(outDir, "put.json"), delFile = join(outDir, "delete.json");
  writeFileSync(putFile, JSON.stringify(plan.puts));
  writeFileSync(delFile, JSON.stringify(plan.deletes));
  console.log((dry ? "would publish " : "publishing ") + (plan.puts.length - 1) + " records from " + plan.latest
    + (key ? ", " + plan.live + " with a live statement" : ", NO live statements: STMT_KEY is not set")
    + (plan.newIssue ? ", a new issue (" + plan.issued + "), attempt counters cleared" : ""));
  if (plan.unmatched.length) console.log("::warning::no code in _users.json for: " + plan.unmatched.join(", "));
  if (dry) { console.log("wrote " + putFile + " and " + delFile); return; }

  wrangler(["kv", "bulk", "put", putFile, "--remote", "--binding", "STMT"], { stdio: "inherit" });
  if (plan.deletes.length) {
    wrangler(["kv", "bulk", "delete", delFile, "--remote", "--binding", "STMT", "--force"], { stdio: "inherit" });
    console.log("retired " + plan.deletes.length + " key(s)");
  }
  console.log("published " + (plan.puts.length - 1) + " records");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.error(String((e && e.stack) || e)); process.exit(1); });
}
