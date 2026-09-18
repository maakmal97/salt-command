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
 * statements/_secrets.json holds the content key, and STMT_MASTER is his. CI holds STMT_KEY but not
 * the master, and a password nobody can hand over is not an account. Everything it writes is a
 * committed file, so the next publish picks it up with no further step.
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
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname, join, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { contentKey, newPassword, makeVerifier, wrapKey, unwrapKey, encryptText, encryptWith, userFor, usersJson, USERNAME_RE } from "./stmt-crypto.mjs";
import POSITION_ENGINE from "../engine/position.mjs";
import { newestIssue } from "./stmt-seal.mjs";

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

/** Mint what is missing. Returns what it did, or would do. */
export async function mintAccounts(root, opts = {}) {
  const here = resolve(root);
  const check = !!opts.check;
  const out = { minted: [], named: [], skipped: [], failed: [], wrote: 0 };

  const secretsFile = join(here, "_secrets.json");
  if (!existsSync(secretsFile)) throw new Error("no statements/_secrets.json: this tool runs on the laptop");
  const secrets = JSON.parse(readFileSync(secretsFile, "utf8"));
  if (!secrets.key) throw new Error("statements/_secrets.json carries no key");
  const master = String(process.env.STMT_MASTER || "").trim();
  if (!master) throw new Error("STMT_MASTER is not set: a password nobody can hand over is not an account");

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

  const { liveStatement } = await import("./make_statements.mjs");
  const now = new Date();
  const issued = now.toLocaleString("en-GB", { timeZone: "Asia/Kuala_Lumpur", day: "2-digit", month: "short", year: "numeric" });

  for (const { code, u } of gaps.noAccount) {
    if (!USERNAME_RE.test(u)) { out.failed.push(code + ": " + u + " is not a username this site would mint"); continue; }
    try {
      const pw = newPassword();
      const ck = await contentKey(secrets.key, u);
      /* THE BUNDLE IS THEIR POSITION AS IT STANDS, one statement dated today. A brand-new account
         has no issued history, and an empty bundle would open on a page with nothing on it. */
      const doc = liveStatement(code, now);
      const bundle = { v: 1, issued: issue, statements: doc ? [{ issued: issue, label: issued, body: doc.body || "" }] : [] };
      const rec = { u, issued: issue, issues: [issue],
        verifier: await makeVerifier(pw), wrap: await wrapKey(pw, ck),
        wrapMaster: await wrapKey(master, ck), pwMaster: await encryptText(master, pw),
        env: await encryptWith(ck, JSON.stringify(bundle)) };
      out.minted.push(code + " (" + u + ")" + (doc ? "" : ", with no rows on the book yet"));
      if (!check) {
        writeFileSync(join(kvDir, u + ".json"), JSON.stringify(rec), "utf8");
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

async function main() {
  const check = process.argv.includes("--check");
  const mint = process.argv.includes("--mint");
  if (!check && !mint) {
    console.error("usage: node tools/stmt-account.mjs --check | --mint");
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
