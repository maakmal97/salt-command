/* tools/stmt-account.mjs: AN ACCOUNT FOR AN ID THAT HAS NONE (v707, his instruction of 18 Sep 2026).
 *
 * "An add ID, or amend ID, is applicable to the accounts available for sign in. Their password will
 * be minted properly."
 *
 * WHAT WAS MISSING. The fold mints a USERNAME when an ID is registered (mintUsernames in fold.mjs)
 * and stops there. A username is an address; an account is a record with a verifier, a wrap of the
 * content key, and a sealed bundle. Those are made by make_statements at an issue, on the laptop,
 * because that is where the content key lives. So somebody added between issues had an address and
 * nothing behind it, and could not sign in at all until the next monthly run. Two were in exactly
 * that state when this was written.
 *
 * WHERE IT MAY RUN. The laptop, and nowhere else, for the same reason stmt-seal.mjs does:
 * statements/_secrets.json holds the content key and, beside it, the master; CI holds STMT_KEY and
 * not the master, and a password nobody can hand over is not an account. Everything it writes is a
 * committed file, so the next publish picks it up with no further step. v771: the master is read
 * from that file, with an environment variable of either name overriding it, which is the rule every
 * other tool here follows; v707 read the environment alone and refused a laptop that already had it.
 *
 * WHAT IT WILL NOT DO:
 *   - touch an account that already exists. It mints for a code with NO record, and nothing else;
 *     re-issuing a password for somebody who has one is stmt-seal's business, not this.
 *   - mint for a bucket, which is not its own person (his ruling of 13 Sep 2026).
 *   - mint for a supplier: a statement is a customer's.
 *   - start unless the master it has unwraps an existing record, so a wrapMaster it writes can
 *     never be under a passphrase that opens nothing.
 *
 *   node tools/stmt-account.mjs --check    say who has no account, write nothing
 *   node tools/stmt-account.mjs --mint     mint one for each of them
 *   node tools/stmt-account.mjs --pool     top the pool of spare accounts up to ten free (D15);
 *                                          --count N for another figure, --check to write nothing
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname, join, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { contentKey, newPassword, newUsername, makeVerifier, wrapKey, unwrapKey, encryptText, encryptWith, userFor, usersJson, USERNAME_RE } from "./stmt-crypto.mjs";
import POSITION_ENGINE from "../engine/position.mjs";
import { newestIssue, freeSpares, POOL_SIZE, POOL_LOW } from "./stmt-pool.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Every roster code that ought to have an account, and what it is missing. */
export function accountGaps(roster, users, kvNames) {
  const have = new Set(kvNames || []);
  const out = { noAccount: [], noUsername: [], skipped: [] };
  for (const code of roster || []) {
    if (POSITION_ENGINE.isBucket(code)) { out.skipped.push(code + " (a bucket is not its own person)"); continue; }
    /* a supplier's code leads with S, and a statement is a customer's */
    if (/^S/.test(code)) { out.skipped.push(code + " (a supplier has no statement)"); continue; }
    const u = users[code];
    if (!u) { out.noUsername.push(code); continue; }
    if (!have.has(u)) out.noAccount.push({ code, u });
  }
  return out;
}

/* v767: WHO IS STUCK, ANSWERABLE WITHOUT THE MASTER. The mint refuses outright where the master is
   not in the environment, which is right, but it means the question "is anybody stuck?" could only
   be asked by somebody already able to fix it. This reads the records and the map and nothing else. */
export function whoIsStuck(root, opts = {}) {
  const here = resolve(root);
  const issue = newestIssue(here);
  if (!issue) return [];
  const kvDir = join(here, issue, "_kv");
  const kvNames = existsSync(kvDir) ? readdirSync(kvDir).filter((f) => f.endsWith(".json")).map((f) => basename(f, ".json")) : [];
  const usersFile = join(here, "_users.json");
  const users = existsSync(usersFile) ? JSON.parse(readFileSync(usersFile, "utf8")) : {};
  const roster = opts.roster || (() => {
    const book = JSON.parse(readFileSync(join(REPO, "ledger", "book.json"), "utf8"));
    return (book.state && book.state.roster) || book.roster || [];
  })();
  const g = accountGaps(roster, users, kvNames);
  return g.noAccount.map((x) => x.code).concat(g.noUsername);
}

/* v767, his instruction of 21 Sep 2026: AN ID ADDED IS AN ACCOUNT, WITHOUT BEING ASKED.
 *
 * WHERE IT CAN RUN, stated rather than wished. An account is a record sealed under the CONTENT KEY,
 * which lives in statements/_secrets.json, with a password sealed under HIS master; neither may
 * reach the cloud (rule 2). So the fold that mints the USERNAME in CI cannot mint the ACCOUNT behind
 * it, and this is not a limitation to engineer around: it is the posture that keeps a stranger with
 * the runner's secrets from opening every statement on the site.
 * SO THE LAPTOP'S OWN CHAIN DOES IT, on every run, and the gap closes at the next update rather than
 * at the next monthly issue. Where the master is not in the environment it names exactly who is
 * stuck and the one command; it does not stop the run, because an update held over an account is a
 * worse trade than an account minted a run later.
 */
export async function accountSweep(root, opts = {}) {
  const here = resolve(root);
  if (!existsSync(join(here, "_secrets.json"))) return { ran: false, why: "not the laptop", minted: [], stuck: [] };
  /* D15: how many spare accounts are free, which needs no secret, so the chain can say when it runs low */
  const usersFile = join(here, "_users.json");
  const pool = freeSpares(here, existsSync(usersFile) ? JSON.parse(readFileSync(usersFile, "utf8")) : {}).length;
  let look = null;
  try { look = await mintAccounts(here, Object.assign({}, opts, { check: true })); }
  catch (e) {
    const why = String((e && e.message) || e);
    return { ran: false, why: /master passphrase/.test(why) ? "no master" : why, minted: [], stuck: whoIsStuck(here, opts), pool };
  }
  if (!look.minted.length) return { ran: true, why: "", minted: [], named: [], wrote: 0, stuck: [], pool };
  const did = await mintAccounts(here, opts);
  return { ran: true, why: "", minted: did.minted, named: did.named, failed: did.failed, wrote: did.wrote,
    stuck: did.failed.length ? whoIsStuck(here, opts) : [], pool };
}

/* What the chain says about a sweep, as lines rather than as printing, because a branch that can
   only be reached by running the whole update tool is a branch nothing can put a mutation through. */
export function sweepLines(sweep, opts = {}) {
  const L = (level, text) => ({ level, text });
  if (opts.dry) return [L("ok", "skipped (dry run)")];
  if (opts.error) return [L("warn", "the account sweep could not run: " + opts.error)];
  if (!sweep) return [L("warn", "the account sweep answered nothing at all")];
  if (!sweep.ran && sweep.why === "not the laptop")
    return [L("ok", "skipped: the content key lives on the laptop, and an account cannot be sealed anywhere else")];
  if (!sweep.ran && sweep.why !== "no master") return [L("warn", "the account sweep stopped: " + sweep.why)];
  const out = [];
  if (!sweep.ran) {
    out.push(sweep.stuck.length
      ? L("warn", sweep.stuck.join(", ") + " cannot sign in: an ID with a username and no account behind it. "
        + "The master passphrase goes in statements/_secrets.json beside the key, or in $env:STMT_MASTER; "
        + "then: node tools/stmt-account.mjs --mint")
      : L("ok", "every ID that should have an account has one, so no master was needed on this run"));
  } else {
    if (sweep.minted.length) {
      out.push(L("ok", "minted an account for " + sweep.minted.join(", ") + "; it goes live at the next publish"));
      if (sweep.named && sweep.named.length) out.push(L("ok", "and a username first for " + sweep.named.join(", ")));
    } else out.push(L("ok", "every ID that should have an account has one"));
    if (sweep.failed && sweep.failed.length) out.push(L("warn", "and could not mint: " + sweep.failed.join("; ")));
  }
  /* D15: THE POOL, said when it runs low, with the one line that tops it up. A spare is what lets an ID
     added at the fold sign in that same run; with none free it waits for a laptop update instead. */
  if (typeof sweep.pool === "number" && sweep.pool < POOL_LOW) {
    out.push(L("warn", (sweep.pool ? "only " + sweep.pool : "no") + " spare account" + (sweep.pool === 1 ? "" : "s")
      + " free, so an ID added after the last one waits for a laptop update to sign in. Top the pool up: node tools/stmt-account.mjs --pool"));
  }
  return out;
}

/* THE LAPTOP'S TWO SECRETS AND THE ISSUE THEY OPEN, the master proved before anything is written.
   One road for the account mint and the pool mint (D15), so the two can never disagree about where
   an account is filed or what date it carries. */
async function openIssue(here) {
  /* v771, his instruction of 21 Sep 2026 ("help me set the environment so the accounts can be
     minted"): THERE WAS NOTHING TO SET. statements/_secrets.json carries the master beside the key
     and every other tool reads it from there, an environment variable of either name overriding the
     file; v707 read the environment ALONE, so a laptop that already held the master was refused, and
     the sweep of v767 then reported him stuck on every run of the chain.
     IT IS NOT loadSecrets ITSELF, which returns as soon as a KEY is in the environment: in the cloud
     there is no file to fall back to and that is right, but here there is, and a shell holding
     STMT_KEY would lose the master sitting beside it in the file. Same rule, read out in full.
     TRIMMED, AND THE BOM STRIPPED, for the reason loadSecrets states: a passphrase with an invisible
     byte on it derives nothing and says nothing about why. */
  const secretsFile = join(here, "_secrets.json");
  if (!existsSync(secretsFile)) throw new Error("no statements/_secrets.json: this tool runs on the laptop");
  const tr = (v) => String(v == null ? "" : v).trim();
  const onFile = JSON.parse(readFileSync(secretsFile, "utf8").replace(/^\uFEFF/, ""));
  const secrets = { key: tr(process.env.STMT_KEY) || tr(onFile.key) };
  if (!secrets.key) throw new Error("statements/_secrets.json carries no key");
  const master = tr(process.env.STMT_MASTER) || tr(onFile.master);
  if (!master) throw new Error("no master passphrase: put it in statements/_secrets.json beside the key, or set STMT_MASTER");

  const issue = newestIssue(here);
  if (!issue) throw new Error("no issue folder with a _kv in " + here);
  const kvDir = join(here, issue, "_kv");
  const kvNames = readdirSync(kvDir).filter((f) => f.endsWith(".json")).map((f) => basename(f, ".json"));

  /* THE MASTER IS PROVED BEFORE ANYTHING IS WRITTEN, against a record that already exists: a
     wrapMaster written under the wrong passphrase opens nothing and looks perfectly well formed. */
  let proved = false;
  for (const u of kvNames) {
    const rec = JSON.parse(readFileSync(join(kvDir, u + ".json"), "utf8"));
    if (!rec.wrapMaster) continue;
    try { await unwrapKey(master, rec.wrapMaster); proved = true; break; } catch (e) { /* try the next */ }
  }
  if (!proved) throw new Error("the master given does not unwrap any record in " + issue + ": nothing was written");

  /* THE ISSUE'S DATE IS NOT THE FOLDER'S NAME, and a record carries the DATE. newestIssue answers
     "2026-09", because that is what names the directory; every record make_statements writes
     carries "2026-09-01", because makeStatements is handed the issue DATE and stamps that.
     Stamping the folder here would be invisible on the record itself and loud everywhere else:
     tools/make_statements.mjs sorts _kv BY FILENAME, tools/stmt-publish.mjs takes the store's
     `issue` key off records[0].issued, and a username that sorts first would therefore publish
     "2026-09" as the live issue. `storedIssue !== issued` then reads as a NEW ISSUE and clears
     every attempt counter, and stmt/worker.js keys each sent tick as `sent:<issue>:<username>`,
     so every statement he has already sent would read as never sent.
     IT IS TAKEN FROM THE RECORDS ALREADY THERE rather than computed, so a minted record agrees
     with its neighbours by construction, whatever the convention turns out to be; the first of
     the month is only the fallback for an issue that has no records yet to agree with. */
  const issueDate = (() => {
    const seen = {};
    for (const u of kvNames) {
      try {
        const d = JSON.parse(readFileSync(join(kvDir, u + ".json"), "utf8")).issued;
        if (d) seen[d] = (seen[d] || 0) + 1;
      } catch (e) { /* an unreadable record decides nothing */ }
    }
    const best = Object.keys(seen).sort((a, b) => seen[b] - seen[a])[0];
    return best || issue + "-01";
  })();
  return { key: secrets.key, master, issue, kvDir, kvNames, issueDate };
}

/* One account's record, sealed as every record here is: the verifier, the content key wrapped under
   the password and under the master, the password itself under the master (pwMaster, for Send), and
   the bundle under the content key. `extra` is the spare mark and nothing else. */
async function sealRecord(key, master, u, pw, bundle, issueDate, extra) {
  const ck = await contentKey(key, u);
  return Object.assign({ u, issued: issueDate, issues: [issueDate],
    verifier: await makeVerifier(pw), wrap: await wrapKey(pw, ck),
    wrapMaster: await wrapKey(master, ck), pwMaster: await encryptText(master, pw),
    env: await encryptWith(ck, JSON.stringify(bundle)) }, extra || {});
}

/** Mint what is missing. Returns what it did, or would do. */
export async function mintAccounts(root, opts = {}) {
  const here = resolve(root);
  const check = !!opts.check;
  const out = { minted: [], named: [], skipped: [], failed: [], wrote: 0 };
  const { key, master, issue, kvDir, kvNames, issueDate } = await openIssue(here);

  const usersFile = join(here, "_users.json");
  const users = existsSync(usersFile) ? JSON.parse(readFileSync(usersFile, "utf8")) : {};
  /* the roster may be handed in, so the checks can pin a small one rather than mint against the
     whole live book; unhanded it is the book's own, which is what the command line means */
  const roster = opts.roster || (() => {
    const book = JSON.parse(readFileSync(join(REPO, "ledger", "book.json"), "utf8"));
    return (book.state && book.state.roster) || book.roster || [];
  })();

  const gaps = accountGaps(roster, users, kvNames);
  out.skipped = gaps.skipped;

  /* A CODE WITH NO USERNAME GETS ONE FIRST, minted exactly as the fold mints one and kept for life. */
  for (const code of gaps.noUsername) {
    userFor(users, code);
    out.named.push(code + " -> " + users[code]);
    gaps.noAccount.push({ code, u: users[code] });
  }

  const pwFile = join(here, issue, "_passwords.json");
  const passwords = existsSync(pwFile) ? JSON.parse(readFileSync(pwFile, "utf8")) : {};

  const { liveStatement, klShort } = await import("./make_statements.mjs");
  const now = new Date();
  const issued = klShort(now);

  for (const { code, u } of gaps.noAccount) {
    if (!USERNAME_RE.test(u)) { out.failed.push(code + ": " + u + " is not a username this site would mint"); continue; }
    try {
      const pw = newPassword();
      /* THE BUNDLE IS THEIR POSITION AS IT STANDS, one statement dated today. A brand-new account
         has no issued history, and an empty bundle would open on a page with nothing on it. */
      const doc = liveStatement(code, now, u);
      const bundle = { v: 1, issued: issueDate, statements: doc ? [{ issued: issueDate, label: issued, body: doc.body || "" }] : [] };
      const rec = await sealRecord(key, master, u, pw, bundle, issueDate);
      out.minted.push(code + " (" + u + ")" + (doc ? "" : ", with no rows on the book yet"));
      if (!check) {
        writeFileSync(join(kvDir, u + ".json"), JSON.stringify(rec) + "\n", "utf8");
        passwords[code] = pw;
        out.wrote++;
      }
    } catch (e) { out.failed.push(code + ": " + String((e && e.message) || e)); }
  }

  if (!check && (out.wrote || out.named.length)) {
    writeFileSync(pwFile, JSON.stringify(passwords, null, 2) + "\n", "utf8");
    writeFileSync(usersFile, usersJson(users), "utf8");
  }
  out.issue = issue;
  return out;
}

/* D15, HIS ANSWER OF 24 SEP 2026: THE POOL OF SPARE ACCOUNTS (tools/stmt-pool.mjs). Minted here ahead
   of need, so the fold can bind the next free one to a new code at Add ID and the customer signs in
   the same run, with no key in CI. It TOPS UP to `count` free spares, so the one line is the same line
   every time and a second run mints nothing. A spare is a username no code holds and no record
   carries, sealed exactly as an account is but around an empty bundle, marked `spare: true`. Its plain
   password is filed under the USERNAME in _passwords.json, a spare having no code yet. */
export async function mintPool(root, opts = {}) {
  const here = resolve(root);
  const count = opts.count == null ? POOL_SIZE : opts.count;
  const { key, master, issue, kvDir, kvNames, issueDate } = await openIssue(here);
  const usersFile = join(here, "_users.json");
  const users = existsSync(usersFile) ? JSON.parse(readFileSync(usersFile, "utf8")) : {};
  const free = freeSpares(here, users).length;
  const out = { issue, free, minted: [], wrote: 0 };
  const taken = new Set(Object.values(users).concat(kvNames));
  const pwFile = join(here, issue, "_passwords.json");
  const passwords = existsSync(pwFile) ? JSON.parse(readFileSync(pwFile, "utf8")) : {};
  for (let i = free; i < count; i++) {
    let u;
    do { u = newUsername(); } while (taken.has(u));
    taken.add(u);
    out.minted.push(u);
    if (opts.check) continue;
    const pw = newPassword();
    const rec = await sealRecord(key, master, u, pw, { v: 1, issued: issueDate, statements: [] }, issueDate, { spare: true });
    writeFileSync(join(kvDir, u + ".json"), JSON.stringify(rec) + "\n", "utf8");
    passwords[u] = pw;
    out.wrote++;
  }
  if (out.wrote) writeFileSync(pwFile, JSON.stringify(passwords, null, 2) + "\n", "utf8");
  out.free = free + out.wrote;
  return out;
}

async function main() {
  const check = process.argv.includes("--check");
  const mint = process.argv.includes("--mint");
  if (process.argv.includes("--pool")) {
    const at = process.argv.indexOf("--count");
    const count = at >= 0 ? Number(process.argv[at + 1]) : POOL_SIZE;
    if (!Number.isInteger(count) || count < 0) { console.error("--count takes a whole number of spare accounts"); process.exit(2); }
    const p = await mintPool(join(REPO, "statements"), { count, check });
    console.log((check ? "would mint " : "minted ") + p.minted.length + " spare account(s) into " + p.issue
      + "; the pool holds " + (check ? p.free + " free, " + (p.free + p.minted.length) + " after a run" : p.free + " free"));
    if (p.wrote) console.log("Commit statements/: the next publish carries them, and the fold binds the next free one at each Add ID.");
    return;
  }
  if (!check && !mint) {
    console.error("usage: node tools/stmt-account.mjs --check | --mint | --pool [--count N] [--check]");
    process.exit(2);
  }
  const out = await mintAccounts(join(REPO, "statements"), { check: !mint });
  console.log((mint ? "minted " : "would mint ") + out.minted.length + " account(s) into " + out.issue);
  if (out.named.length) console.log("  a username was minted first for: " + out.named.join(", "));
  if (out.minted.length) for (const m of out.minted) console.log("  " + m);
  if (out.failed.length) {
    console.log("::warning::" + out.failed.length + " could not be minted:");
    for (const f of out.failed) console.log("  " + f);
  }
  if (mint && out.wrote) console.log("Commit statements/ and the next publish hands them out; send each password from the master account.");
  if (check && out.minted.length) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
}
