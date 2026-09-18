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

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** The newest month folder that has a `_kv`, which is the one the publish reads. */
export function newestIssue(root) {
  let latest = null;
  for (const d of readdirSync(root).filter((x) => /^\d{4}-\d{2}$/.test(x)).sort()) {
    if (existsSync(join(root, d, "_kv"))) latest = d;
  }
  return latest;
}

/** Seal every password in `dir` under the master. Returns what it did, or would do. */
export async function sealPasswords(dir, opts = {}) {
  const here = resolve(dir);
  const root = dirname(here);
  const check = !!opts.check;
  const out = { dir: here, sealed: [], already: [], failed: [], skipped: [], wrote: 0 };

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

  for (const r of records) {
    const u = r.rec.u;
    const code = codeOf[u] || Object.keys(passwords).find((c) => users[c] === u) || null;
    if (code && POSITION_ENGINE.isBucket(code)) { out.skipped.push(code + " (a bucket is not its own account)"); continue; }
    const pair = code ? sheetParty(code, users, passwords, htmlFor(code)) : null;
    const pw = pair ? pair.pw : null;
    if (!pw) { out.failed.push((code || u) + ": no password on this laptop"); continue; }
    if (!(await checkVerifier(pw, r.rec.verifier))) { out.failed.push((code || u) + ": the password does not answer this record's verifier"); continue; }
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
