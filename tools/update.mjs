/* update.mjs — "update" as one command, so no surface is left behind.
 *
 * Written 12 Aug 2026, after two runs in a row shipped the master but not the cloud, and
 * one of them left QUEUE_COMMITTED behind so the phone booked three committed orders a
 * second time. Both failures were silent. Neither would have survived this file, because
 * the chain now ends by PROVING every surface is level rather than assuming it.
 *
 * The chain:
 *   1  preflight   git locks, the master, its version and its watermark
 *   2  drain       KV -> 10_Data/salt_queue_cloud.json          (skip with --no-drain)
 *   3  queues      what is still pending, on BOTH queues, and the replay check
 *   4  build       master -> public/index.html
 *   5  test        the smoke suite
 *   6  deploy      only when rev.json's id differs from .deployed.json's
 *   7  version     git add, commit, push                        (skip with --no-push)
 *   8  verify      master == rev.json == live /rev, origin level, no locks left
 *
 * WHAT IT DELIBERATELY WILL NOT DO: fold a queued entry into the ledger. Writing a
 * transaction row is a judgement (which product, whose bucket, what cost, what the note
 * should say), and a script that guessed would be worse than one that refuses. So step 3
 * REPORTS what is pending and, if anything pending already looks committed, says so loudly
 * and exits non-zero. The folding stays with the daily run and with you.
 *
 * Modes:
 *   node tools/update.mjs                the whole chain
 *   node tools/update.mjs --dry          report only, change nothing anywhere
 *   node tools/update.mjs --no-push      build, test and deploy, but do not touch git
 *   node tools/update.mjs --no-deploy    build and test only
 *   node tools/update.mjs --no-drain     leave KV alone (use when offline)
 *   node tools/update.mjs -m "message"   commit message (defaults to the version)
 */

import "./cloudflare.mjs";
import { readFileSync, existsSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { DATA_DIR } from "./book.mjs";
import { readSnapshot } from "./d1.mjs";
import { spawnSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { messageFrom } from "./commitmsg.mjs";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_MASTER =
  resolve(REPO, "master", "salt_command.html");
const MASTER = process.env.SALT_MASTER || DEFAULT_MASTER;
/* v344: the queue folder is ABSOLUTE, matching drain.mjs and drafts.mjs, and no longer
   derived from where the master sits. When the master moved into this repo on 20 Aug the
   derived path became <repo>/10_Data, which does not exist, so both queue reads warned
   "unreadable" on every run and the drain had nowhere to write. The queue files never
   moved; only the master did. */
const DATA = DATA_DIR;
const SITE = (process.env.SALT_URL || "https://salt-command.qyts8mh72kyg.workers.dev").replace(/\/+$/, "");

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const DRY = has("--dry");
const NO_PUSH = has("--no-push") || DRY;
const NO_DEPLOY = has("--no-deploy") || DRY;
const NO_DRAIN = has("--no-drain") || DRY;
/* -m TAKES A MESSAGE OR A FILE HOLDING ONE; tools/commitmsg.mjs says why and is the only part of
   this tool the suite can drive, since everything else here runs on import. */
const MSG = messageFrom(argv);

/* ---- plumbing -------------------------------------------------------------------- */
const problems = [];
const fail = (m) => { problems.push(m); console.log("  FAIL  " + m); };
const warn = (m) => { problems.push(m); console.log("  WARN  " + m); };
const ok = (m) => console.log("  ok    " + m);
const step = (n, t) => console.log("\n" + n + "  " + t.toUpperCase());

function sh(cmd, args, { quiet = false } = {}) {
  const r = spawnSync(cmd, args, { cwd: REPO, shell: true, encoding: "utf8" });
  const out = ((r.stdout || "") + (r.stderr || "")).trim();
  if (!quiet && out) console.log(out.split("\n").map(l => "        " + l).join("\n"));
  return { code: r.status === null ? 1 : r.status, out };
}
const git = (...args) => sh("git", args, { quiet: true }).out.trim();

/* STRIP THE BOM. salt_sync.ps1 writes .deployed.json from PowerShell, which stamps a UTF-8
   byte order mark, and JSON.parse throws on it. Without this the deploy check silently read
   "no record of any deploy" every run and redeployed every time, which is precisely the kind
   of quiet drift this file exists to catch. Caught 12 Aug on the first real run. */
function readJson(p, fallback = null) {
  try { return JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, "")); }
  catch (e) { return fallback; }
}

/* ---- 1. preflight ---------------------------------------------------------------- */
step(1, "preflight");

if (!existsSync(MASTER)) {
  console.error("  the master is not readable at\n    " + MASTER);
  process.exit(2);
}
const masterSrc = readFileSync(MASTER, "utf8");
const VER = (masterSrc.match(/const evolution=\[\{\s*"?v"?\s*:\s*['"](v\d+)['"]/) || [])[1] || null;
/* v344: EITHER QUOTE. booksync.mjs has rendered the book from JSON since v339, so the
   watermark is written with double quotes and this regex stopped matching. It failed the run
   rather than passing it, but the REPLAY CHECK below reads MARK, and a check that never runs
   is the exact shape of fault this file exists to catch. */
const MARK = (masterSrc.match(/const QUEUE_COMMITTED\s*=\s*['"]([^'"]*)['"]/) || [])[1] || null;
if (!VER) fail("no version found in the master (evolution[0].v)");
if (!MARK) fail("no QUEUE_COMMITTED found in the master");
ok(`master ${VER}, watermark ${MARK}`);

/* ---- IS THE REMOTE AHEAD? (10 Sep 2026) --------------------------------------------------
   THIS FILE NEVER FETCHED. Both `origin/master..HEAD` counts in steps 7 and 8 read whatever the
   remote-tracking ref happened to say when something last fetched, which on a laptop that has
   been building for an hour is a lie. It cost two rebuilds on 09 Sep: the cloud chain folded a
   real row and took the version this run was about to claim, twice, and the run only found out
   when the push was rejected, after it had already built, tested and tried to deploy.
   The remote moving is NORMAL here, not exceptional: every approval on the phone dispatches a
   job that folds, commits and pushes. So this asks first, and stops before any work is done.
   A failed fetch is a warning and not a stop: the network is often what is wrong, and refusing
   to build offline would be worse than building against a ref that is merely old.
   IT ASKS ON EVERY RUN, INCLUDING A DRY ONE, and only declines to STOP a run that was not going
   to push anyway. The first cut gated the whole check on !NO_PUSH, and --dry sets NO_PUSH, so
   the one run you would make to find out where you stand was the one that never looked. */
{
  const f = sh("git", ["fetch", "--quiet", "origin", "master"], { quiet: true });
  if (f.code !== 0) warn("could not reach origin; the ahead and behind counts below read a stale ref");
  else {
    const behind = git("rev-list", "--count", "HEAD..origin/master");
    if (behind === "0") ok("origin is level with this tree");
    else {
      const m = `origin is ${behind} commit(s) AHEAD of this tree. The chain has folded since you started.\n` +
                `        Pull first: git pull --ff-only origin master, then rebuild. Do not take a version this run.`;
      if (NO_PUSH) warn(m); else fail(m);
    }
  }
}

/* The lock scan is done in-process rather than by shelling out, because the whole hazard
   this guards against is git leaving files behind, and a fragile quoted one-liner is the
   last thing that should stand between you and noticing. */
function gitStrays() {
  const root = resolve(REPO, ".git");
  const found = [];
  (function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      const p = resolve(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.lock$/.test(e.name) || /^tmp_obj_/.test(e.name)) found.push(p);
    }
  })(root);
  return found;
}

const strays = gitStrays();
if (strays.length) fail("stale git locks present:\n        " + strays.join("\n        "));
else ok("no stale git locks");

/* ---- 2. drain -------------------------------------------------------------------- */
step(2, "drain the phone queue");
if (NO_DRAIN) {
  ok("skipped" + (DRY ? " (dry run)" : ""));
} else {
  /* --keep, 09 Sep 2026: this ran the drain's DEFAULT mode, which deletes each phone's queue key
     from KV after pulling it, the destructive read drain.mjs's own header says must not come back
     (it raced the cloud drafter on 16 Aug and lost an entry). The file is all this run needs. */
  const r = sh("node", ["tools/drain.mjs", "--keep"]);
  if (r.code !== 0) fail("drain failed, so phone entries may not be on disk");
  else ok("KV pulled into 10_Data, the phone's keys kept");
}

/* ---- 3. queues, and the replay check --------------------------------------------- */
step(3, "queues");

const qFiles = [
  ["laptop", resolve(DATA, "salt_queue.json")],
  ["cloud ", resolve(DATA, "salt_queue_cloud.json")]
];
/* NOT A CHECK WORTH HAVING, and it was tried: "the file's `updated` is ahead of the
   watermark" fires on every HEALTHY run, because --committed stamps the file with the
   time it pruned. A check that cries wolf teaches you to skim past the real one, so the
   only guard here is the replay check below, which asks the question that actually
   matters: is something still queued that the ledger already carries? */
let pending = [];
for (const [label, path] of qFiles) {
  const j = readJson(path, null);
  if (!j) { warn(`${label} queue unreadable at ${path}`); continue; }
  const all = Array.isArray(j.queue) ? j.queue : [];
  const above = all.filter(e => e && e.at && MARK && e.at > MARK);
  ok(`${label}: ${all.length} held, ${above.length} above the watermark, updated ${j.updated || "(none)"}`);
  pending.push(...above.map(e => ({ ...e, from: label.trim() })));
}

/* dedupe by at, since a drained entry can sit in both files briefly */
pending = [...new Map(pending.map(e => [e.at, e])).values()].sort((a, b) => a.at < b.at ? -1 : 1);

if (NO_DRAIN) {
  const note = "the drain was skipped, so this is what is on DISK, not what the phone has posted."
    + "\n        Run `node tools/drain.mjs --status` for the live picture.";
  /* In a dry run the skip was asked for, so it is a note. Asked for with --no-drain on a
     real run it is a gap in the very thing "update" promises, so it counts. */
  if (DRY) ok(note); else warn(note);
}

if (!pending.length) {
  ok("nothing pending on disk: every queued entry on disk is committed");
} else {
  console.log("");
  console.log(`        ${pending.length} entr${pending.length === 1 ? "y is" : "ies are"} PENDING and not yet in the ledger:`);
  for (const e of pending) console.log(`          ${e.at}  ${String(e.raw || "(no description)").slice(0, 96)}`);
  console.log("");
  console.log("        These are folded by the daily run, not by this script.");
}

/* THE REPLAY CHECK. For each pending entry, look for a ledger row in the master carrying
   the same date and the same total. A hit means the entry is probably ALREADY committed
   and the watermark was not moved, so the desk would book it twice. It is a heuristic on
   purpose and it says so: it points at a line for you to read, it does not judge. */
let suspect = 0;
for (const e of pending) {
  const raw = String(e.raw || "");
  const date = (raw.match(/\b(20\d\d-\d\d-\d\d)\b/) || [])[1];
  const total = (raw.match(/for RM\s?([\d,]+(?:\.\d+)?)/i) || [])[1];
  if (!date || !total) continue;
  const t = total.replace(/,/g, "");
  const hit = masterSrc.split("\n").find(l =>
    l.includes("date:'" + date + "'") && new RegExp("total:" + t + "\\b").test(l));
  if (hit) {
    suspect++;
    fail(`pending entry ${e.at} already looks COMMITTED (date ${date}, total RM${t}). The ledger has:\n        ${hit.trim().slice(0, 140)}`);
  }
}
if (suspect) {
  console.log("");
  console.log("        If those really are committed, advance the watermark to the queue");
  console.log("        file's own `updated` (never the clock), then prune:");
  console.log("          node tools/drain.mjs --committed <that updated>");
  console.log("");
  if (has("--force-ship")) {
    console.log("        --force-ship given, so carrying on. You have read the rows above and");
    console.log("        judged them a false match. Nothing else about this run is different.");
  } else {
    console.log("        Refusing to go on: shipping now would put a double count on the phone.");
    console.log("        A date and a total CAN collide innocently. If you have read the rows");
    console.log("        and they are genuinely different trades, re-run with --force-ship.");
    process.exit(1);
  }
}

/* ---- 4 and 5. build and test ------------------------------------------------------ */
step(4, "build");
if (DRY) ok("skipped (dry run)");
else if (sh("npm", ["run", "build"]).code !== 0) { fail("build failed"); process.exit(1); }

step(5, "test");
if (DRY) ok("skipped (dry run)");
else if (sh("npm", ["test"]).code !== 0) { fail("tests failed"); process.exit(1); }

/* ---- 6. deploy -------------------------------------------------------------------- */
step(6, "deploy");
const rev = readJson(resolve(REPO, "public", "rev.json"), {});
const deployed = readJson(resolve(REPO, ".deployed.json"), {});
let deployedNow = false;

async function liveRev() {
  try { return await (await fetch(SITE + "/rev", { cache: "no-store" })).json(); }
  catch (e) { return null; }
}
/* WAIT FOR THE EDGE, do not race it. `wrangler deploy` returns once Cloudflare has accepted
   the upload, which is a moment before every colo serves it, so reading /rev immediately can
   still return the PREVIOUS build. That is not a failed deploy and must not be reported as
   one: on 12 Aug it read the old id here and the correct one seconds later in step 8. */
async function waitForRev(id, tries = 8, gapMs = 2000) {
  for (let i = 0; i < tries; i++) {
    const r = await liveRev();
    if (r && r.id === id) return r;
    if (i < tries - 1) await new Promise(res => setTimeout(res, gapMs));
  }
  return await liveRev();
}
/* The deploy is RECORDED HERE, before step 7 commits, and only after the live id has been
   read back. Written after the commit instead (which is where it was first put) it is
   correct but forever uncommitted, so every run left a dirty tree. Caught 12 Aug by running
   the thing. Two writers own this file, salt_sync.ps1 and this, and the rule both obey is
   the same: never record a deploy you have not seen live. */
function recordDeploy(r) {
  writeFileSync(resolve(REPO, ".deployed.json"),
    JSON.stringify({ id: r.id, v: r.v, at: new Date().toISOString() }, null, 4) + "\n");
}

if (NO_DEPLOY) {
  ok("skipped" + (DRY ? " (dry run)" : ""));
} else if (rev.id && deployed.id === rev.id) {
  ok(`already deployed (${rev.v} ${rev.id})`);
} else {
  console.log(`        built ${rev.v} ${rev.id}, last deployed ${deployed.v || "(none)"} ${deployed.id || "(none)"}`);
  if (sh("npx", ["wrangler", "deploy"]).code !== 0) fail("wrangler deploy failed");
  else {
    deployedNow = true;
    const live = await waitForRev(rev.id);
    if (!live) warn("deployed, but /rev could not be read back, so the deploy is NOT recorded");
    else if (live.id !== rev.id) fail(`deployed, but /rev still reads ${live.v} ${live.id} after waiting`);
    else { recordDeploy(rev); ok(`live confirms ${live.v} ${live.id}, recorded in .deployed.json`); }
  }
}

/* ---- 6b. the ledger mirror ----------------------------------------------------------
   The D1 store is a mirror of the desk, and a mirror that falls behind quietly is the same
   class of fault as a build that never shipped. Comparing the desk's version against the
   one the store reports costs one D1 read, so it is checked every run and re-seeded
   when it differs, before the commit, so the refreshed extract is versioned with everything
   else. Skip with --no-mirror.
   14 SEP 2026, HIS QUESTION: IT READS D1 THROUGH WRANGLER NOW, NOT THE KEYED /ledger. From 09 Sep the
   check ran only with SALT_WRITE_KEY in the shell, which no shell on this laptop has, so every run
   printed "not checked". wrangler reads the store on its own login, as drafts.mjs and drain.mjs do. */
step("6b", "the ledger mirror");
if (DRY || has("--no-mirror")) {
  ok("skipped" + (DRY ? " (dry run)" : ""));
} else {
  const snap = readSnapshot();
  if (snap === undefined) warn("wrangler could not read the D1 snapshot twice running, so the mirror was not checked");
  else if (snap === null) {
    warn("the store has never been seeded. Run: node tools/ledger.mjs && node tools/d1.mjs --seed");
  } else if (snap.v === VER) {
    ok(`the mirror is level at ${VER} (${snap.rows} records)`);
  } else {
    console.log(`        the mirror is ${snap.v}, the desk is ${VER}. Re-seeding.`);
    const a = sh("node", ["tools/ledger.mjs"], { quiet: true });
    if (a.code !== 0) fail("the extract failed, so the mirror was NOT refreshed:\n        " + a.out.split("\n").filter(l => /FAIL/.test(l)).join("\n        "));
    else {
      const b = sh("node", ["tools/d1.mjs", "--seed"], { quiet: true });
      if (b.code !== 0) fail("the re-seed failed:\n        " + b.out.split("\n").slice(-4).join("\n        "));
      else ok(`the mirror was re-seeded from ${snap.v} to ${VER}`);
    }
  }
}

/* ---- 7. version ------------------------------------------------------------------- */
step(7, "version");
/* v391: --no-push HOLDS THE PUSH AND NOT THE COMMIT, WHICH IS WHAT IT IS NAMED FOR. It used to
   skip the whole step, so `update.mjs --no-push` DEPLOYED and left the tree dirty with the build
   already live: the cloud carried a bundle the repo had no commit for, step 7 reported "skipped"
   and step 8 reported every surface level, because live and the build on disk genuinely did
   agree. That is the silent divergence ship-check exists to catch, one step earlier and inside
   the tool written to prevent it. A deploy with no source of record is the thing to refuse;
   holding the push is a choice. --dry still touches nothing at all. */
if (DRY) {
  ok("skipped (dry run)");
} else {
  const dirty = git("status", "--porcelain");
  if (dirty) {
    sh("git", ["add", "-A"], { quiet: true });
    const message = MSG || `${rev.v || VER}: build, deploy and version the desk`;
    /* THE MESSAGE GOES THROUGH A FILE, NOT THROUGH -m (18 Sep 2026). It was passed as
       JSON.stringify(message), which turns every real newline into the two characters backslash-n,
       so v694 through v698 each landed as ONE LINE with \n written out in the subject. Nobody saw
       it because git log --oneline shows the subject alone and the subject was still readable.
       A file is also the only route that survives PowerShell here: a heredoc into `git commit -F -`
       breaks on an apostrophe, and a pipe adds a BOM that git keeps. */
    const mfile = join(REPO, ".git", "COMMIT_MSG_UPDATE");
    writeFileSync(mfile, message.endsWith("\n") ? message : message + "\n", "utf8");
    const c = sh("git", ["commit", "-F", mfile], { quiet: true });
    try { rmSync(mfile, { force: true }); } catch (e) { /* the next run overwrites it anyway */ }
    if (c.code !== 0) fail("commit did not take:\n        " + c.out);
    else ok("committed " + git("rev-parse", "--short", "HEAD"));
  } else {
    ok("working tree already clean");
  }
  const ahead = git("rev-list", "--count", "origin/master..HEAD");
  if (NO_PUSH) {
    ok(ahead === "0" ? "not pushing, and nothing is waiting" : `not pushing: ${ahead} commit(s) held locally`);
  } else if (ahead !== "0") {
    const p = sh("git", ["push"], { quiet: true });
    if (p.code !== 0) fail("push failed:\n        " + p.out);
  }
}

/* ---- 8. verify. THE POINT OF THE WHOLE FILE. -------------------------------------- */
step(8, "verify every surface is level");

const revNow = readJson(resolve(REPO, "public", "rev.json"), {});
if (VER && revNow.v && VER !== revNow.v) fail(`master is ${VER} but the build on disk is ${revNow.v}`);
else ok(`master and build agree at ${revNow.v || VER}`);

const live = await liveRev();
if (!live) warn("could not reach " + SITE + "/rev");
else if (live.id !== revNow.id) fail(`the phone is BEHIND: live ${live.v} ${live.id}, built ${revNow.v} ${revNow.id}`);
else ok(`live matches the build (${live.v} ${live.id})`);

/* The catch-up case: the build was already live so step 6 had nothing to do, but the record
   is stale (a hand deploy, or a run that died between deploying and recording). Correct it,
   or the next run redeploys for no reason. */
if (!DRY && live && live.id === revNow.id && readJson(resolve(REPO, ".deployed.json"), {}).id !== revNow.id) {
  recordDeploy(revNow);
  warn(".deployed.json was stale and has been corrected; commit it");
}

if (!NO_PUSH) {
  const ahead = git("rev-list", "--count", "origin/master..HEAD");
  if (ahead !== "0") fail(`${ahead} commit(s) not pushed`);
  else ok("origin is level at " + git("rev-parse", "--short", "HEAD"));
}

const straysAfter = gitStrays();
if (straysAfter.length) fail("git left lock files behind:\n        " + straysAfter.join("\n        "));
else ok("no git locks left behind");

/* ---- the verdict ------------------------------------------------------------------ */
console.log("");
if (problems.length) {
  console.log(`UPDATE INCOMPLETE: ${problems.length} problem${problems.length === 1 ? "" : "s"} above.`);
  /* exitCode, not exit(). Calling process.exit() here aborts node on Windows with a libuv
     assertion, because the keep-alive socket from the /rev fetch above is still closing.
     Setting the code and falling off the end lets it shut down properly. */
  process.exitCode = 1;
} else {
  console.log(`UPDATE COMPLETE${DRY ? " (dry run)" : ""}: ${revNow.v || VER} on the master, in the build, live on the phone`
    + (NO_PUSH ? "" : " and on origin") + ".");
  if (pending.length) console.log(`  ${pending.length} entr${pending.length === 1 ? "y" : "ies"} still queued for the daily run to fold.`);
}
