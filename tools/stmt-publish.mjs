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

/* THE USERNAME-TO-CODE MAP, FOR THE DESK'S OWN STORE (06 Sep 2026). An order placed on the
   statements site names a username and nothing else; the ledger's Worker turns that into the
   desk code from this map, which the publish writes to the DESK's KV (stmt-users), never to the
   site's. The site keeps having no idea which account on the book a username is. The map is
   _users.json inverted, and _users.json is committed, so nothing secret moves. */
export function usersMap(root) {
  const file = join(root, "_users.json");
  const users = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  const out = {};
  for (const code of Object.keys(users)) out[users[code]] = code;
  return out;
}

/** Everything the publish would do, as data: the puts, the deletes and what it found. */
export async function planPublish(root, key, now, existingKeys, storedIssue, pricing) {
  const r = await liveRecords(root, key, now, pricing);
  const puts = r.records.map(rec => ({ key: "u:" + rec.u, value: JSON.stringify(rec) }));
  const keep = new Set(r.records.map(rec => "u:" + rec.u));
  const issued = r.records.length ? r.records[0].issued : null;
  const newIssue = !!issued && storedIssue !== issued;
  const deletes = [];
  /* NOTHING PUBLISHABLE MEANS NOTHING TOUCHED: an issue of stale records must not retire what
     is already in the store, or a botched regeneration would take every account down. */
  if (r.records.length) {
    for (const k of existingKeys || []) {
      if (k.startsWith("u:") && !keep.has(k)) deletes.push(k);
      if (newIssue && k.startsWith("fail:")) deletes.push(k);
    }
    puts.push({ key: "issue", value: issued });
  }
  return { latest: r.latest, issued, newIssue, live: r.live, priced: r.priced || 0, unmatched: r.unmatched, stale: r.stale, wrongKey: r.wrongKey || [], puts, deletes, users: usersMap(root) };
}

/* shell:true, and NOT an npx.cmd branch. Node refuses to spawn a .cmd without a shell on Windows
   (EINVAL since the 2024 argument-injection hardening), so the hand-run path died at the first
   call on the one machine it exists for: the day the deploy is down and the store has to be
   repaired by hand. With shell:true Node quotes the argv array itself, so nothing in a path or a
   value becomes shell syntax. tools/d1.mjs and tools/drafts.mjs already do it this way. */
function wrangler(args, opts = {}) {
  return execFileSync("npx", ["wrangler", "-c", CONFIG, ...args],
    { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], shell: true, ...opts });
}
/* the desk's own config, for the one key this publish writes to the desk's store */
function deskWrangler(args, opts = {}) {
  return execFileSync("npx", ["wrangler", ...args],
    { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], shell: true, ...opts });
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
  const key = (process.env.STMT_KEY || "").trim();   /* trimmed at every door, as make_statements does (08 Sep 2026) */

  if (!dry && /PLACEHOLDER_STMT_KV_ID/.test(readFileSync(CONFIG, "utf8"))) {
    console.log("the statements store is not created yet (placeholder id in wrangler.stmt.jsonc); nothing published");
    return;
  }
  let existing = [], storedIssue = null;
  if (!dry) {
    existing = [...listKeys("u:"), ...listKeys("fail:")];
    /* absent on a fresh store, which wrangler reports as a 404 on stderr; that is not news */
    try { storedIssue = wrangler(["kv", "key", "get", "--remote", "--binding", "STMT", "issue"], { stdio: ["ignore", "pipe", "ignore"] }).trim() || null; }
    catch (e) { storedIssue = null; }
  }
  /* THE PRICE LIST NEEDS THE DESK'S PRICING SNAPSHOT, which only the desk can produce: pxInputs and
     pxPolicy are the desk's contribution to the engine, so the master is opened in jsdom here, the
     way tools/d1.mjs --seed already does in the step before this one. About ten seconds. A dry run
     skips it, and so does --no-prices, and the records then go up without a list. */
  let pricing = null;
  if (!dry && !process.argv.includes("--no-prices") && key) {
    const { readBook } = await import("./book.mjs");
    pricing = (await readBook()).ledger.PRICING;
  }
  const plan = await planPublish(root, key, new Date(), existing, storedIssue, pricing);
  if (!plan.latest) { console.log("no statement set to publish; normal for a build with no issue in it"); return; }

  /* THE STEP ASSERTS ITS OWN EFFECT, and does not merely report one (04 Sep 2026 audit). Every
     deploy on master was publishing NOTHING and exiting 0: the committed records were all of the
     pre-username shape, so every one was stale, all thirty-seven accounts were absent from the
     store, any customer reaching the site was told his password was not accepted, and the only
     trace was one warning line in a log nobody reads. That is the same shape as the 10 Aug deploy
     and the 19 Aug ship, which is why the stage job grew its own "Commit it, and prove it" step.
     An issue that carries records but can publish none of them is a broken site, so it is red. */
  if (plan.stale.length && !plan.puts.length) {
    console.error("::error::" + plan.latest + " carries " + plan.stale.length + " record(s) and NONE is publishable, "
      + "so every account is absent from the site. Regenerate the issue on the laptop: "
      + "node tools/make_statements.mjs statements/" + plan.latest + " <issue date>");
    process.exit(1);
  }
  if (plan.stale.length) {
    console.log("::warning::" + plan.stale.length + " record(s) in " + plan.latest + " carry no username and are from before the site: "
      + plan.stale.join(", ") + ". Regenerate the issue on the laptop; they are not published.");
  }
  if (!plan.puts.length) { console.log("nothing publishable in " + plan.latest + "; the store is left as it is"); return; }

  mkdirSync(outDir, { recursive: true });
  const putFile = join(outDir, "put.json"), delFile = join(outDir, "delete.json");
  writeFileSync(putFile, JSON.stringify(plan.puts));
  writeFileSync(delFile, JSON.stringify(plan.deletes));
  const usersFile = join(outDir, "users.json");
  writeFileSync(usersFile, JSON.stringify(plan.users));
  console.log((dry ? "would publish " : "publishing ") + (plan.puts.length - 1) + " records from " + plan.latest
    + (key ? ", " + plan.live + " with a live statement, " + plan.priced + " with a price list" : ", NO live statements: STMT_KEY is not set")
    + (plan.newIssue ? ", a new issue (" + plan.issued + "), attempt counters cleared" : ""));
  if (plan.unmatched.length) console.log("::warning::no code in _users.json for: " + plan.unmatched.join(", "));
  if (dry) { console.log("wrote " + putFile + ", " + delFile + " and " + usersFile); return; }

  wrangler(["kv", "bulk", "put", putFile, "--remote", "--binding", "STMT"], { stdio: "inherit" });
  /* the desk's map, so the ledger's Worker can name the account an order belongs to */
  deskWrangler(["kv", "key", "put", "stmt-users", "--path", usersFile, "--remote", "--binding", "SALT_QUEUE"], { stdio: "inherit" });
  console.log("wrote stmt-users (" + Object.keys(plan.users).length + " usernames) to the desk's store");

  /* AND THE EFFECT IS READ BACK. A bulk put that reported success and stored nothing would be
     invisible otherwise, which is the whole class of fault this file was rewritten for. */
  const probe = plan.puts.find((x) => x.key.startsWith("u:"));
  const got = wrangler(["kv", "key", "get", "--remote", "--binding", "STMT", probe.key],
    { stdio: ["ignore", "pipe", "ignore"] });
  if (String(got).indexOf('"u"') < 0) {
    console.error("::error::the bulk put reported success but " + probe.key + " does not read back from the store.");
    process.exit(1);
  }
  console.log("read back " + probe.key + " from the store");
  console.log("published " + (plan.puts.length - 1) + " records");

  if (plan.deletes.length) {
    wrangler(["kv", "bulk", "delete", delFile, "--remote", "--binding", "STMT", "--force"], { stdio: "inherit" });
    console.log("retired " + plan.deletes.length + " key(s)");
  }

  /* THE KEY MISMATCH IS REPORTED AFTER THE PUBLISH, NOT INSTEAD OF IT. The monthly statements open
     under the customer's own password whatever the deploy's secret is, so refusing to publish would
     take a working site down to punish a wrong secret. What is missing is the live document, and
     that is worth a red run: correcting STMT_KEY and letting the next fold deploy restores it with
     nothing to re-issue. */
  if (plan.wrongKey.length) {
    console.error("::error::STMT_KEY here is not the key this issue was sealed with on the laptop, so no live "
      + "statement could be written for " + plan.wrongKey.length + " account(s). The monthly statements ARE "
      + "published and open normally. Set the STMT_KEY secret to exactly the \"key\" in "
      + "statements/_secrets.json; the next deploy writes the live statements.");
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.error(String((e && e.stack) || e)); process.exit(1); });
}
