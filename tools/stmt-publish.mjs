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
import "./cloudflare.mjs";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { liveRecords, siteBaseUrl, partyTotals, reviewFlag, klToday } from "./make_statements.mjs";
import POSITION_ENGINE from "../engine/position.mjs";
import { isSpare } from "./stmt-pool.mjs";

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
  /* v609: a bucket is not its own person, so its username maps to nothing: no order placed on the site
     can book to it, and the owner's list does not offer it. The line stays in _users.json, kept for life. */
  for (const code of Object.keys(users)) if (!POSITION_ENGINE.isBucket(code)) out[users[code]] = code;
  return out;
}

/** Everything the publish would do, as data: the puts, the deletes and what it found. */
export async function planPublish(root, key, now, existingKeys, storedIssue, pricing, assoc, opts) {
  const r = await liveRecords(root, key, now, pricing, (opts && opts.cards) || null);
  /* v688: THE SEALED PASSWORD IS NOT IN THE RECORD A CUSTOMER FETCHES. It is sealed under the
     master, so a customer could not open it, but /open hands the whole record's fields to whoever
     answers the door and there is no reason for it to be there at all. It travels in `sheet`,
     which only the Access-gated route serves. */
  /* v702, HIS INSTRUCTION OF 18 SEP 2026: an associate's own orders and the ones they place on
     behalf of a friend can no longer be told apart by what they buy, so they get a tick. The page
     has to know whether to draw it, and WHO IS AN ASSOCIATE IS THE DESK'S ANSWER, not a second one
     invented here: it is the report card's own list, read off the same snapshot that writes `assoc`
     below, so the two can never disagree about who one is.
     THE MARK IS IN THE CLEAR, deliberately, beside `issued` and `issues` which already are. The
     tick has to be drawn before a password has opened anything sealed, and what it says is that
     this account MAY order for somebody else: not a figure, not a name, not a fact about the book.
     Nothing downstream trusts it either; the desk decides where a row books. */
  const byUser0 = usersMap(root);
  const assocCodes = new Set();
  for (const prod of (assoc && assoc.products) || []) for (const row of prod.rows || []) if (row && row.id) assocCodes.add(row.id);
  /* D15, HIS ANSWER OF 24 SEP 2026: THE POOL. A spare account (tools/stmt-pool.mjs) is published like
     any record, so it is in the store the moment the fold binds it, and so never retired; it is marked
     `spare` IN THE CLEAR, as assoc is, and the site's door opens it for nobody until a code holds it.
     No code, so no row on his list, no line on the roster and nothing in any count. Once bound, the
     mark goes and it is an ordinary account: the live statement and the price list are sealed in above. */
  const spares = new Set(r.records.filter((rec) => isSpare(rec, byUser0)).map((rec) => rec.u));
  const puts = r.records.map(rec => {
    const { pwMaster, spare, ...forCustomer } = rec;
    if (assocCodes.has(byUser0[rec.u])) forCustomer.assoc = true;
    if (spares.has(rec.u)) forCustomer.spare = true;
    return { key: "u:" + rec.u, value: JSON.stringify(forCustomer) };
  });
  const keep = new Set(r.records.map(rec => "u:" + rec.u));
  const issued = r.records.length ? r.records[0].issued : null;
  const newIssue = !!issued && storedIssue !== issued;
  const deletes = [];
  /* NOTHING PUBLISHABLE MEANS NOTHING TOUCHED: an issue of stale records must not retire what
     is already in the store, or a botched regeneration would take every account down. */
  /* v689: HIS TEST ACCOUNT IS NOT AN ACCOUNT OF THE BOOK'S. The Worker makes it and the Worker
     unmakes it; the publish neither writes it nor retires it, or every deploy would take away the
     one account he keeps for trying the page out. stmt/worker.js states the name. */
  const TEST_REC = "u:0000-0000";
  /* v698: WRITING IS HOURLY, RETIRING IS NOT (his instruction of 18 Sep 2026 that prices always
     follow the desk). The hourly refresh runs with --no-retire, because retiring an account whose
     record the newest issue does not carry is a judgement about a deploy he made, not about a
     clock: a partial or botched issue read would otherwise take accounts down twenty-four times a
     day rather than once. The puts are unchanged either way, so an hourly run still refreshes
     every sealed list, board and roster. */
  const retire = !(opts && opts.noRetire);
  if (r.records.length && retire) {
    for (const k of existingKeys || []) {
      if (k.startsWith("u:") && !keep.has(k) && k !== TEST_REC) deletes.push(k);
      if (newIssue && k.startsWith("fail:")) deletes.push(k);
      /* a tick no longer lapses (23 Sep 2026), so a new sealed issue, which has to be sent again,
         is what clears the last one's; the new issue's own ticks are a different key */
      if (newIssue && k.startsWith("sent:") && !k.startsWith("sent:" + issued + ":")) deletes.push(k);
    }
  }
  if (r.records.length) puts.push({ key: "issue", value: issued });
  /* ---- THE ACCOUNT LIST THE MASTER PAGE READS (v687) --------------------------------------
     His master account reviews every account from his phone, so each one needs the two things
     the review sheet has always shown: where it stands and one word for it. Both come from the
     statement's own rows through partyTotals, so the sheet on the laptop and the list on the
     phone cannot say different things about the same account. Read live, to today in Kuala
     Lumpur, which is what "Now" on a statement means.
     A BUCKET IS NOT ITS OWN ACCOUNT (his instruction, 18 Sep 2026): usersMap drops <CODE>-R, so
     it has no code here and is left out; its rows are already on its associate's statement,
     marked for resale. CODES, NEVER NAMES, as the roster beside it. */
  const byUser = usersMap(root);
  const day = klToday(now);
  const sheet = r.records.map((rec) => {
    const code = byUser[rec.u] || null;
    if (!code) return null;
    const t = partyTotals(code, day);
    return { code, username: rec.u, issued: rec.issued || null, t, flag: reviewFlag(t), pwMaster: rec.pwMaster || null };
  }).filter(Boolean).sort((a, b) => a.code.localeCompare(b.code));
  if (r.records.length) {
    puts.push({ key: "sheet", value: JSON.stringify({ at: new Date(now || Date.now()).toISOString(), issue: issued, accounts: sheet }) });
  }
  /* v691: the associates' report card rides the same bulk put, so it lands or fails with the
     records rather than in a write of its own. Given only when the desk was opened for prices. */
  if (assoc) puts.push({ key: "assoc", value: JSON.stringify(assoc) });
  return { latest: r.latest, issued, newIssue, live: r.live, priced: r.priced || 0, unmatched: r.unmatched.filter((u) => !spares.has(u)),
    spares: [...spares], stale: r.stale, wrongKey: r.wrongKey || [], puts, deletes, sheet, users: usersMap(root) };
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
/* the desk's own config (no -c), for the two keys this publish writes to the desk's store */
function deskWrangler(args, opts = {}) {
  return execFileSync("npx", ["wrangler", ...args],
    { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], shell: true, ...opts });
}
/* A DESK WRITE READS ITSELF BACK, the way the bulk put into the site's store already does
   (10 Sep 2026). It did not, and that is why stmt-users was absent from the desk's store from the
   day it was invented (03 Sep) until this was found: the publish printed a success line, wrangler
   exited 0, and the key was not there. Both halves of the fault are fixed, because either alone
   leaves it live: the "Retire the old statement keys" step that was deleting them seconds later is
   gone from cloud-commit.yml, and a write that does not land is now red rather than a line in a log.
   Read back against the FILE, not against a substring: an empty value and a stale value both pass a
   substring test, and this key has been wrong in exactly that quiet way for a week.
   Exported so it can be driven against the real store by hand, on a throwaway key, which is the
   only place it can be proved: the suite reaches no network and --dry never writes. */
export function deskPut(key, file, what) {
  deskWrangler(["kv", "key", "put", key, "--path", file, "--remote", "--binding", "SALT_QUEUE"], { stdio: "inherit" });
  let got = "";
  /* a missing key exits non-zero, which throws; that is the failure, not an error to report */
  try { got = String(deskWrangler(["kv", "key", "get", key, "--remote", "--binding", "SALT_QUEUE"], { stdio: ["ignore", "pipe", "ignore"] })); }
  catch (e) { got = ""; }
  if (got.replace(/^\uFEFF/, "").trim() !== readFileSync(file, "utf8").trim()) {
    console.error("::error::wrangler reported writing " + key + " to the desk's store and it does not read back. "
      + "The desk cannot name an account on an order, and the board sheet's QR is not drawn. "
      + "Check nothing in cloud-commit.yml deletes it after this step.");
    process.exit(1);
  }
  console.log("wrote " + key + " (" + what + ") to the desk's store, and read it back");
}
/* v658: the guest links themselves, so a board can be written for each. They live in the site's own
   store under g:, which this tool already reads through wrangler's login. */
function refIds() {
  return listKeys("g:").map((k) => k.slice(2)).filter((x) => /^[a-z0-9]{4}-[a-z0-9]{4}$/.test(x));
}
function readRef(id) {
  try { return JSON.parse(wrangler(["kv", "key", "get", "--remote", "--binding", "STMT", "g:" + id])); }
  catch (e) { return null; }
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
    existing = [...listKeys("u:"), ...listKeys("fail:"), ...listKeys("sent:")];
    /* absent on a fresh store, which wrangler reports as a 404 on stderr; that is not news */
    try { storedIssue = wrangler(["kv", "key", "get", "--remote", "--binding", "STMT", "issue"], { stdio: ["ignore", "pipe", "ignore"] }).trim() || null; }
    catch (e) { storedIssue = null; }
  }
  /* THE PRICE LIST NEEDS THE DESK'S PRICING SNAPSHOT, which only the desk can produce: pxInputs and
     pxPolicy are the desk's contribution to the engine, so the master is opened in jsdom here, the
     way tools/d1.mjs --seed already does in the step before this one. About ten seconds. A dry run
     skips it, and so does --no-prices, and the records then go up without a list. */
  let pricing = null, assoc = null; const cards = {};
  if (!dry && !process.argv.includes("--no-prices") && key) {
    const { readBook, associateSnapshot } = await import("./book.mjs");
    /* v691: one window, two readings. The associates' report card comes off the same desk the
       prices do, so a card and a price can never be from different states of the book. */
    const rb = await readBook();
    pricing = rb.ledger.PRICING;
    try { assoc = associateSnapshot(rb.w); } catch (e) { console.log("::warning::no associates snapshot: " + e.message); }
    /* v706: and one card per associate, off the SAME window, so a card and a price can never be
       struck from different states of the book. One per associate, not one per account: only an
       account the report card names gets one. */
    try {
      const { associateCard } = await import("./book.mjs");
      for (const prod of (assoc && assoc.products) || []) {
        for (const row of prod.rows || []) {
          if (!row || !row.id || cards[row.id]) continue;
          const c = associateCard(rb.w, row.id);
          if (c) cards[row.id] = c;
        }
      }
    } catch (e) { console.log("::warning::no associate cards: " + e.message); }
  }
  const noRetire = process.argv.includes("--no-retire");
  const plan = await planPublish(root, key, new Date(), existing, storedIssue, pricing, assoc, { noRetire, cards });
  if (noRetire) console.log("--no-retire: every list, board and roster is refreshed; no account is retired");
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
  /* THE ROSTER, for the owner's list at /all (10 Sep 2026). It is what turns a page of usernames
     into a page of accounts: a code is what he knows a party by, and without this the list can only
     show the eight random symbols printed on the paper. CODES, NEVER NAMES. A code is already public
     on the desk, whereas a plaintext name has never reached this site and does not start now; the
     directory stays in the vault on the other Worker. It rides the same bulk put as the records, so
     it lands or fails with them rather than in a write of its own. */
  const rosterList = Object.entries(plan.users)
    .map(([username, code]) => ({ code, username }))
    .sort((a, b) => String(a.code).localeCompare(String(b.code)));
  plan.puts.push({ key: "roster", value: JSON.stringify(rosterList) });

  /* v691: the report card is in the plan (planPublish puts it); this only says so out loud */
  if (Object.keys(cards).length) console.log("and " + Object.keys(cards).length + " associate(s) carry their own card, sealed on their own record");
  /* v707: A ROSTER CODE WITH NO ACCOUNT CANNOT SIGN IN, and nothing said so. The fold mints a
     USERNAME when an ID is registered and stops; the record behind it is made on the laptop at an
     issue, so anybody added between issues had an address and nothing behind it. Two were in that
     state when this was written, silently. This run cannot mint one (the content key and the master
     are laptop-only, deliberately), so it says who, on every run, and names the one command. */
  try {
    const { accountGaps } = await import("./stmt-account.mjs");
    const bookNow2 = JSON.parse(readFileSync(join(REPO, "ledger", "book.json"), "utf8"));
    const rosterNow = (bookNow2.state && bookNow2.state.roster) || bookNow2.roster || [];
    const usersNow = JSON.parse(readFileSync(join(root, "_users.json"), "utf8"));
    const gaps = accountGaps(rosterNow, usersNow, plan.puts.filter((x) => x.key.startsWith("u:")).map((x) => x.key.slice(2)));
    const stuck = gaps.noAccount.map((x) => x.code).concat(gaps.noUsername);
    if (stuck.length) {
      console.log("::warning::" + stuck.length + " roster code(s) have no account and cannot sign in: " + stuck.join(", ")
        + ". On the laptop: node tools/stmt-account.mjs --mint");
    }
  } catch (e) { console.log("::warning::the account gap could not be read: " + e.message); }
  if (assoc) {
    console.log("and the associates' report card: " + (assoc.products[0] ? assoc.products[0].rows.length : 0)
      + " associates over " + assoc.products.length + " book(s)");
  }

  /* THE TWO GUEST BOARDS (10 Sep 2026). A referral link opens one tier's board and nothing else, so
     both are written on every publish, beside the sealed per-customer lists and from the same
     snapshot, which is what keeps a guest and a customer from ever being quoted off different
     inputs. They are NOT sealed: a board is the price he prints and hands to strangers, and the
     link's own id is what decides who gets to read one. tools/pricelist.mjs states that argument.
     No snapshot, no boards, exactly as no snapshot means no price lists. */
  if (pricing) {
    const { boardList, guestBoard, tierBoard } = await import("./pricelist.mjs");
    const bookNow = JSON.parse(readFileSync(join(REPO, "ledger", "book.json"), "utf8"));
    const madeAt = new Date();
    for (const tier of [1, 2]) {
      plan.puts.push({ key: "board:" + tier, value: JSON.stringify(boardList(tier, bookNow, pricing, madeAt)) });
    }
    /* v696: the level NAMES, so the Worker can ensure one standing link per tier without stating
       what the tiers are called. The book decides that, and this is the one road it travels. */
    if (Array.isArray(pricing.tierNames) && pricing.tierNames.length)
      plan.puts.push({ key: "tiers", value: JSON.stringify(pricing.tierNames) });
    /* ============ v698: A BOARD PER LEVEL, NOT PER STANDING LINK ============
       v696 wrote a board under each standing link's own id, which left a hole its own shape: the
       five are minted the first time he opens the Links panel, so any minted since the last publish
       had no board and fell back to board:2, the board a stranger sees. Four of the five would have
       quoted Bronze until the next deploy.
       A standing link IS a level, and a level's board does not depend on which link points at it.
       So the five boards are written here, keyed by level, and a standing link reads its own level's
       board. Nothing has to be published for a link to be right, so minting one can never be wrong.
       tboard:, not board:, deliberately: board:1 and board:2 are the OLD two-board names and board:2
       already means the LAST level, not the second. Reusing them would make 2 mean two things. */
    /* one a tier, four since 23 Sep 2026: Bronze's tboard:5 is left where it lies and nothing reads it, a link whose
       level the book no longer names reading the stranger's board instead */
    for (let k = 1; k < ((pricing.tierNames || []).length || 6); k++) {
      plan.puts.push({ key: "tboard:" + k, value: JSON.stringify(tierBoard(k, bookNow, pricing, madeAt)) });
    }
    /* ============ v658: AND ONE BOARD PER LINK, FROM ITS INTRODUCER'S LEVEL ============
       A guest link is quoted two levels above the customer who handed it out, capped at the last,
       per product. That level is never stored on the link: it is computed HERE, on every publish,
       so a link follows its introducer the moment he moves them. A link whose introducer is not on
       this issue's roster gets none, and the Worker falls back to the board every stranger sees. */
    /* ============ v696, HIS INSTRUCTION: FIVE LINKS, ONE PER TIER ============
       A STANDING link is a level and nothing else, so its board is written from that level alone and
       follows nobody. The Worker mints the five on the first open of the Links panel; this writes
       their boards on every publish, exactly as it does for the links that name an introducer. */
    const byUser = plan.users || {};
    let boards = 0, orphans = 0, standing = 0;
    for (const id of refIds()) {
      const rec = readRef(id);
      /* v698: a standing link needs nothing written under its own id; it reads its level's board.
         v709: and so does ANY link carrying a level, including one he pinned when approving an
         associate's, because the Worker keys on the level alone now. */
      if (rec && rec.level) { standing++; continue; }
      /* a link waiting on him serves nothing, so nothing is written for it either */
      if (rec && rec.approved === false) { orphans++; continue; }
      const user = rec && String(rec.introducer || "").toLowerCase();
      const code = user ? byUser[user] : null;
      if (!code) { orphans++; continue; }
      plan.puts.push({ key: "gboard:" + id, value: JSON.stringify(guestBoard(code, bookNow, pricing, madeAt)) });
      boards++;
    }
    console.log("and both guest boards, tier 1 and tier 2, and the five level boards"
      + (standing ? " the " + standing + " standing link" + (standing === 1 ? "" : "s") + " read" : "")
      + (boards ? ", plus " + boards + " link board" + (boards === 1 ? "" : "s") + " from their introducers" : "")
      + (orphans ? " (" + orphans + " link" + (orphans === 1 ? "" : "s") + " names no customer on this roster and falls back to the board)" : ""));
  }
  const putFile = join(outDir, "put.json"), delFile = join(outDir, "delete.json");
  writeFileSync(putFile, JSON.stringify(plan.puts));
  writeFileSync(delFile, JSON.stringify(plan.deletes));
  const usersFile = join(outDir, "users.json");
  writeFileSync(usersFile, JSON.stringify(plan.users));
  /* COUNT THE RECORDS, NOT THE KEYS. This said puts.length - 1, which was right when `issue` was
     the only key in the plan that is not a record; `sheet` and `roster` joined it and the line has
     over-reported by two ever since, saying 39 where it publishes 37. It is the line he reads to
     confirm that an account he minted actually went out, so it is the one number here that has to
     be the real one. */
  const recordCount = plan.puts.filter((x) => String(x.key || "").startsWith("u:")).length;
  console.log((dry ? "would publish " : "publishing ") + recordCount + " records from " + plan.latest
    + (key ? ", " + plan.live + " with a live statement, " + plan.priced + " with a price list" : ", NO live statements: STMT_KEY is not set")
    + (plan.newIssue ? ", a new issue (" + plan.issued + "), attempt counters cleared" : "")
    + ", " + plan.spares.length + " of them spare account(s) free for the next Add ID");
  if (plan.unmatched.length) console.log("::warning::no code in _users.json for: " + plan.unmatched.join(", "));
  if (dry) { console.log("wrote " + putFile + ", " + delFile + " and " + usersFile); return; }

  wrangler(["kv", "bulk", "put", putFile, "--remote", "--binding", "STMT"], { stdio: "inherit" });
  /* the desk's map, so the ledger's Worker can name the account an order belongs to */
  deskPut("stmt-users", usersFile, Object.keys(plan.users).length + " usernames");
  /* ============ v564: AND THE SITE'S OWN ADDRESS, FOR THE QR ON THE BOARD SHEET ============
     The desk draws a QR to the customer's page on the sheet he hands over, so it needs the address,
     and the address MUST NOT be baked into the desk: /desk is public by his decision of 11 Aug and
     the statements site is deliberately on its own cryptic name ("nothing in that name says salt").
     So it travels the same road the usernames already travel: this key, read back by GET /stmt-users
     behind the write key. It is siteBaseUrl(), the same one derivation make_statements prints on
     paper, read out of wrangler.stmt.jsonc rather than restated, because a QR handed to a customer
     that points at a hostname answering nothing is the fault that derivation exists to prevent.
     A SEPARATE KEY, not a field inside stmt-users: src/orders.js reads that key as a flat username
     to code map and changing its shape would break the order relay. */
  const siteFile = join(outDir, "site.txt");
  writeFileSync(siteFile, siteBaseUrl());
  deskPut("stmt-site", siteFile, siteBaseUrl());

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
