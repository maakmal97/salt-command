/* tools/stmt-seal.mjs: SEAL AN ISSUE'S PASSWORDS UNDER THE MASTER, ON THE LAPTOP (v688).
 *
 * WHY. Send statement on his master account hands a customer their link and their password from
 * his phone. The password has never been in the cloud, and still is not in the clear: from v688
 * an issue seals each one beside its record as `pwMaster`, under the same passphrase that already
 * unwraps every account, and only his own page decrypts it, in the browser. That happens at issue
 * time in make_statements.mjs. THIS tool is for the issue that already went out: September's
 * records were written before v688 and carry no pwMaster, and re-issuing would mint new passwords
 * and retire the ones customers hold, which his rules forbid.
 *
 * WHERE IT MAY RUN. The laptop, and nowhere else: it reads statements/<month>/_passwords.json,
 * which is gitignored and exists on this machine only. It writes `_kv/*.json`, which ARE
 * committed, and nothing else. It prints codes and counts, never a password.
 *
 *   node tools/stmt-seal.mjs statements/2026-09 --check    say what it would do, write nothing
 *   node tools/stmt-seal.mjs statements/2026-09            seal, then read every file back
 *
 * WHAT IT REFUSES TO DO:
 *   - work on any folder but the newest with a `_kv`, because that is the one the publish reads,
 *     and a past month must never be rewritten;
 *   - start unless the master it has unwraps every record's `wrapMaster`, so a pwMaster cannot be
 *     sealed under a passphrase the site does not hold;
 *   - seal a password the record's own verifier refuses, which is how a re-keyed code or a
 *     mismatched file is caught rather than shipped;
 *   - change anything else in a record: the file is rebuilt with pwMaster in its place and
 *     compared, minus that one field, byte for byte against what was there.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import POSITION_ENGINE from "../engine/position.mjs";
import { checkVerifier, decryptText, encryptText, unwrapKey } from "./stmt-crypto.mjs";
import { loadSecrets } from "./make_statements.mjs";
import { sheetParty } from "./stmt-send.mjs";
import { newestIssue } from "./stmt-pool.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/* the newest month folder that has a `_kv`, which is the one the publish reads: stated once, in
   tools/stmt-pool.mjs, because the fold reads it too and must not load the statements run to do so */
export { newestIssue };

/** Seal every password in `dir` under the master. Returns what it did, or would do. */
export async function sealPasswords(dir, opts = {}) {
  const here = resolve(dir);
  const root = dirname(here);
  const check = !!opts.check;
  const out = { dir: here, sealed: [], already: [], failed: [], skipped: [], rekeyed: [], wrote: 0 };

  const kvDir = join(here, "_kv");
  if (!existsSync(kvDir)) throw new Error("no _kv in " + here + ": nothing was ever issued from it");
  const newest = newestIssue(root);
  if (basename(here) !== newest) {
    throw new Error("refusing " + basename(here) + ": the publish reads " + newest
      + ", and a past issue is never rewritten");
  }
  const pwFile = join(here, "_passwords.json");
  if (!existsSync(pwFile)) throw new Error("no _passwords.json in " + here + ": this tool runs on the laptop");
  const passwords = JSON.parse(readFileSync(pwFile, "utf8").replace(/^﻿/, ""));
  const usersFile = join(root, "_users.json");
  const users = existsSync(usersFile) ? JSON.parse(readFileSync(usersFile, "utf8").replace(/^﻿/, "")) : {};
  const master = String((opts.master != null ? opts.master : loadSecrets(here).master) || "");
  if (!master) throw new Error("no master passphrase: set it in statements/_secrets.json or STMT_MASTER");

  const files = readdirSync(kvDir).filter((f) => f.endsWith(".json")).sort();
  const records = files.map((f) => ({ f, path: join(kvDir, f), text: readFileSync(join(kvDir, f), "utf8") }))
    .map((r) => Object.assign(r, { rec: JSON.parse(r.text.replace(/^﻿/, "")) }));

  /* THE MASTER IS PROVED BEFORE ANY WRITE. A pwMaster under the wrong passphrase is worse than
     none: his page would refuse to open it and nothing would say why. */
  let proved = 0;
  for (const r of records) {
    if (!r.rec.wrapMaster) continue;
    try { await unwrapKey(master, r.rec.wrapMaster); proved++; }
    catch (e) { throw new Error("the master does not unwrap " + r.f + ": nothing was written"); }
  }
  if (!proved) throw new Error("no record in " + basename(here) + " carries a wrapMaster, so there is no master to seal under");
  out.proved = proved;

  /* the code each username belongs to now, so a code re-keyed since the issue still finds its password */
  const statements = readdirSync(here).filter((f) => /^statement_.*\.html$/.test(f));
  const htmlFor = (code) => {
    const f = statements.find((x) => x.startsWith("statement_" + code.replace(/[^A-Za-z0-9._-]+/g, "-") + "_"));
    return f ? readFileSync(join(here, f), "utf8") : "";
  };
  const codeOf = {};
  for (const code of Object.keys(users)) codeOf[users[code]] = code;

  /* ---- WHERE THE NAME HAS MOVED, PAIR BY PROOF (v705, 18 Sep 2026) ---------------------------
   * _passwords.json is keyed by the CODE AS IT WAS AT THE ISSUE, and Amend ID re-keys a code
   * wherever the book holds it. So a customer re-keyed after an issue has a password filed under a
   * name that no longer exists, sheetParty finds nothing, and the account can never be sealed. Four
   * were in exactly that state, and all four looked like a lost password: CA11-SEN to CA2-SEN,
   * CA5-KER to CA5-BAN, CA7-JTR to CA7-AMP, CH5-OUG to CM3-OUG.
   *
   * A VERIFIER IS PROOF, NOT A GUESS. It answers one password and no other, so a record with no
   * password under its own name is matched against the passwords whose code is no longer on the
   * roster, and the one that answers its verifier IS its password. Nothing is re-issued and no
   * customer is moved off a password they already hold. Only ORPHANED passwords are tried, so a
   * password still filed under a live code can never be claimed by somebody else's record.
   */
  const orphaned = Object.keys(passwords).filter((c) => !users[c]);
  const takenBy = {};
  const pairByProof = async (rec) => {
    for (const c of orphaned) {
      if (takenBy[c]) continue;
      if (await checkVerifier(passwords[c], rec.verifier)) { takenBy[c] = rec.u; return { pw: passwords[c], was: c }; }
    }
    return null;
  };

  for (const r of records) {
    const u = r.rec.u;
    const code = codeOf[u] || Object.keys(passwords).find((c) => users[c] === u) || null;
    if (code && POSITION_ENGINE.isBucket(code)) { out.skipped.push(code + " (a bucket is not its own account)"); continue; }
    const pair = code ? sheetParty(code, users, passwords, htmlFor(code)) : null;
    let pw = pair ? pair.pw : null, was = null;
    if (!pw) {
      const proof = await pairByProof(r.rec);
      if (proof) { pw = proof.pw; was = proof.was; }
    }
    if (!pw) { out.failed.push((code || u) + ": no password on this laptop"); continue; }
    if (!(await checkVerifier(pw, r.rec.verifier))) { out.failed.push((code || u) + ": the password does not answer this record's verifier"); continue; }
    if (was) {
      out.rekeyed = (out.rekeyed || []).concat([(code || u) + " (its password was filed under " + was + ", before it was re-keyed)"]);
      /* AND THE PAIRING IS WRITTEN BACK, so it is solved once rather than re-proved on every run
         (19 Sep 2026). The proof has just held: this password answered this record's own verifier,
         which answers one password and no other. Leaving the file alone meant Send read a code the
         customer had left for as long as the account existed, and four were in that state. Only a
         code the roster no longer carries is ever moved, and never onto one already taken. */
      if (code && passwords[code] === undefined) { passwords[code] = passwords[was]; delete passwords[was]; out.moved = (out.moved || []).concat([was + " -> " + code]); }
    }
    if (r.rec.pwMaster) {
      let same = false;
      try { same = (await decryptText(master, r.rec.pwMaster)) === pw; } catch (e) { same = false; }
      if (same) { out.already.push(code || u); continue; }
    }
    if (check) { out.sealed.push(code || u); continue; }

    /* REBUILT IN ORDER, with pwMaster where the issue would have written it, and proved to have
       changed nothing else: the record minus that field must be what was on disk. */
    const rebuilt = {};
    for (const k of Object.keys(r.rec)) {
      rebuilt[k] = r.rec[k];
      if (k === "wrapMaster") rebuilt.pwMaster = await encryptText(master, pw);
    }
    if (!rebuilt.pwMaster) rebuilt.pwMaster = await encryptText(master, pw);
    writeFileSync(r.path, JSON.stringify(rebuilt) + "\n");
    const back = JSON.parse(readFileSync(r.path, "utf8"));
    const got = await decryptText(master, back.pwMaster);
    const without = Object.assign({}, back); delete without.pwMaster;
    if (got !== pw) throw new Error(r.f + " did not read back as the password it was given");
    if (JSON.stringify(without) !== JSON.stringify(r.rec)) throw new Error(r.f + " changed in some other way, which this tool must never do");
    out.sealed.push(code || u);
    out.wrote++;
  }
  /* the re-keyed password file, written only on a real run and only when a pairing moved */
  if (!check && (out.moved || []).length) writeFileSync(pwFile, JSON.stringify(passwords, null, 2) + "\n");
  return out;
}

async function main() {
  const dir = process.argv[2];
  const check = process.argv.includes("--check");
  if (!dir) {
    console.error("usage: node tools/stmt-seal.mjs statements/<YYYY-MM> [--check]");
    process.exit(2);
  }
  const out = await sealPasswords(resolve(REPO, dir), { check });
  console.log((check ? "would seal " : "sealed ") + out.sealed.length + " of " + (out.sealed.length + out.already.length + out.failed.length)
    + " record(s) in " + basename(out.dir) + (out.already.length ? ", " + out.already.length + " already sealed" : ""));
  if (out.sealed.length) console.log("  " + out.sealed.join(", "));
  /* v705: say when a password was found under a name that has since moved, because that is the
     thing a reader would otherwise have to work out from a code they do not recognise. */
  if (out.rekeyed && out.rekeyed.length) {
    console.log("  paired by their own verifier, the name having moved since the issue:");
    for (const r of out.rekeyed) console.log("    " + r);
  }
  if (out.skipped.length) console.log("  skipped: " + out.skipped.join(", "));
  if (out.failed.length) {
    console.log("::warning::" + out.failed.length + " record(s) were not sealed:");
    for (const f of out.failed) console.log("  " + f);
  }
  if (check && out.sealed.length) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
}
