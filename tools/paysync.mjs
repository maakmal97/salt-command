#!/usr/bin/env node
/* tools/paysync.mjs: THE PAYMENT RAILS THE ORDER PAGE MAY OFFER, generated from the pay master.
 *
 * A customer who has been told his order is ready picks how he will pay, and the page hands him
 * ONE link into QR Command (Code\qr-command), the read-only site that draws the codes and copies
 * the account numbers. Which accounts exist, what each is called and which rails each carries
 * are decided in the pay store (Code\qr-command\data\accounts.json) and nowhere else, so this
 * file reads that record and writes stmt/pay.js from it, the way tools/stmt-style.mjs writes
 * stmt/statement-css.js: one source, a generated copy where the source cannot reach, and the
 * suite holding the two together whenever the master is on the machine.
 *
 * WHAT SHIPS IS THE NAME AND THE RAILS, AND NOTHING THAT PAYS. No account number, no payload,
 * no biller reference, no member number, no owner, no colour. The statements site is a second
 * Worker that holds nothing but ciphertext and a verifier, and this must not make it the third
 * place an account number is written down. The number lives on the QR Command page the link
 * opens, behind its own Copy button. The suite asserts no run of five digits reaches stmt/pay.js.
 *
 * THE NUMBER FOR THE PAY SHEET (Phase 7b, his yes of 11 Oct 2026) NEVER TRAVELS BY GIT. The repo is public (rule 3), so the
 * account number the sheet shows beside the reference is written from this laptop into the Counter's KV, key `paynum`, by
 * `--numbers`, under his own wrangler login, and read by the Counter's `GET /pay/accounts` on a customer session. The record is
 * {v: 1, at, accounts: {<key>: {number: "<10 to 15 digits>"}}} for the accounts above with the transfer rail and not suspended,
 * and nothing else: no holder, owner, payee, bank, member number or payload. Every line this tool prints names a key and the
 * LAST FOUR digits, never a whole number.
 *
 * A rail is a property of an account, derived and never stored (qr-command, 4 Sep 2026):
 *   qr        the account has a DuitNow payload, so its coin can be scanned or saved as an image
 *   transfer  the account names a bank, so it can be paid by DuitNow Transfer to the number
 *   jompay    the account carries a JomPAY biller code
 * A suspended account (`maintenance`) is carried with its flag so the page can leave it out.
 *
 * THE LINK IS BUILT HERE TOO (the owner's D8, 24 Sep 2026): `payHref(key, rail, amount, ref)`
 * rides in stmt/pay.js and writes QR Command's #<key>/<rail>/<amount>/<reference>, the account the
 * customer chose, Transfer or Scan a code, the figure to the sen and their username as the
 * reference, so the pay page opens at that rail with that amount. It answers "" for anything the
 * page could not open: an unknown or suspended account, a rail it is not on or not one of the two,
 * a figure or a reference QR Command would drop. The amount and the reference are arguments,
 * never data in this file. Written in ES5 without a backslash, and reading only PAY_SITE and PAY,
 * the names the page's own script gives the site and the list, so the page may carry its source
 * (`payHref.toString()`, which leaves the `export` off) as it is.
 *
 *   node tools/paysync.mjs --sync            write stmt/pay.js from the master
 *   node tools/paysync.mjs --check           exit 1 if stmt/pay.js is not what the master produces
 *   node tools/paysync.mjs --numbers         write the account numbers to the Counter's KV `paynum` (laptop only)
 *   node tools/paysync.mjs --numbers --dry   the same, to the screen only: keys and last four digits, nothing written
 *   node tools/paysync.mjs --check-numbers   exit 1 if KV `paynum` is not what the master produces (last four digits only)
 */
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { wranglerSaid, againIfLapsed } from "./cloudflare.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(REPO, "stmt", "pay.js");
/* the same defaults qr-command's own build uses; both repos sit beside this one */
/* 08 Sep 2026: the pay master moved. pay-afif-site was retired that day and the store is
   Code\qr-command\data\accounts.json, committed in that repo; this read the retired file. */
export const PAY_MASTER = process.env.QR_MASTER || "C:/Users/maakm/Claude/Code/qr-command/data";
export const QR_REPO = process.env.QR_REPO || "C:/Users/maakm/Claude/Code/qr-command";
const WORKERS_SUBDOMAIN = "qyts8mh72kyg";

export function mastersPresent() {
  return existsSync(join(PAY_MASTER, "accounts.json")) && existsSync(join(QR_REPO, "wrangler.jsonc"));
}

/** The address of QR Command, read from its own config so a rename there cannot strand a link. */
export function paySiteUrl() {
  const cfg = readFileSync(join(QR_REPO, "wrangler.jsonc"), "utf8");
  const m = /^\s*"name"\s*:\s*"([^"]+)"/m.exec(cfg);
  if (!m) throw new Error("qr-command's wrangler.jsonc names no Worker");
  return "https://" + m[1] + "." + WORKERS_SUBDOMAIN + ".workers.dev";
}

/** What the page may know about each account: the key, the name, the bank and the rails. */
export function shipAccounts(doc) {
  return (doc.accounts || []).map((a) => ({
    key: String(a.key),
    name: String(a.name || a.key),
    bank: String(a.bank || ""),
    qr: !!a.payload,
    transfer: !!a.bank,
    jompay: !!a.biller,
    maintenance: !!a.maintenance
  }));
}

/* The link builder, shipped as source (see the header). Its two checks are QR Command's own
   (linkOf in its app.js): 1e8 sen is a million ringgit, the first figure a six-digit amount
   refuses, and a reference is up to twenty letters, digits and hyphens. */
const PAY_HREF = [
  "/** QR Command at the account, the rail and the amount, with the username as the reference; \"\" when the page could not open it. */",
  "export function payHref(key, rail, amount, ref) {",
  "  var a = null, sen = Math.round(Number(amount) * 100);",
  "  for (var i = 0; i < PAY.length; i++) if (PAY[i].key === key) a = PAY[i];",
  "  if (!a || a.maintenance || (rail !== \"qr\" && rail !== \"transfer\") || !a[rail]) return \"\";",
  "  if (!(sen > 0 && sen < 1e8) || !/^[A-Za-z0-9-]{1,20}$/.test(String(ref))) return \"\";",
  "  return PAY_SITE + \"/#\" + [a.key, rail, (sen / 100).toFixed(2), ref].map(encodeURIComponent).join(\"/\");",
  "}"
].join("\n");

export function renderPayJs(site, accounts) {
  return "/* GENERATED by `node tools/paysync.mjs --sync`. Do not edit.\n"
    + " *\n"
    + " * The payment rails the order page may offer, read out of the pay store\n"
    + " * (Code\\qr-command\\data\\accounts.json) and QR Command's own address, and the one link into it.\n"
    + " * Names and rails only: no account number, payload or reference is here, by design. Edit the\n"
    + " * store, then sync.\n"
    + " */\n"
    + "export const PAY_SITE = " + JSON.stringify(site) + ";\n"
    + "export const PAY_ACCOUNTS = " + JSON.stringify(accounts, null, 1) + ";\n"
    + "/* payHref reads the list as PAY, the name the page's own script gives it */\n"
    + "const PAY = PAY_ACCOUNTS;\n"
    + PAY_HREF + "\n";
}

export function payJs() {
  const doc = JSON.parse(readFileSync(join(PAY_MASTER, "accounts.json"), "utf8").replace(/^\uFEFF/, ""));
  return renderPayJs(paySiteUrl(), shipAccounts(doc));
}

/* ---- THE ACCOUNT NUMBERS, FOR THE PAY SHEET (Phase 7b): the pure parts, then the two wrangler calls ---------------------
   The pay store calls the number `sub` (qr-command's build renames it `acct`). The picker takes the accounts the page can
   offer for a transfer (the bank named, not suspended, exactly shipAccounts' transfer and maintenance), refuses one whose key
   stmt/pay.js lacks (the page draws no tile for it, so run --sync first) and one whose number, spaces stripped, is not 10 to 15
   digits, and answers every refusal by KEY alone: no message here ever holds a number, whole or in part. */
export const PAYNUM_KEY = "paynum";
export const NUM_RE = /^[0-9]{10,15}$/;
export const lastFour = (n) => String(n).slice(-4);
const shown = (n) => "....." + lastFour(n);

/** { accounts: {key: {number}}, refused: ["key: why"] } from the pay store's record; `known` is the set of keys stmt/pay.js names. */
export function pickNumbers(doc, known) {
  const accounts = {}, refused = [], ship = shipAccounts(doc);
  ship.forEach((s, i) => {
    if (!s.transfer || s.maintenance) return;
    if (!known.has(s.key)) { refused.push(s.key + ": stmt/pay.js has no such account; run --sync first"); return; }
    const sub = (doc.accounts || [])[i].sub;
    const number = typeof sub === "string" ? sub.replace(/\s+/g, "") : "";
    if (!NUM_RE.test(number)) { refused.push(s.key + ": its account number is not 10 to 15 digits"); return; }
    accounts[s.key] = { number };
  });
  if (!refused.length && !Object.keys(accounts).length) refused.push("no account offers a transfer with a number");
  return { accounts, refused };
}

/** What the Counter's KV holds under `paynum`: the version, the day and the numbers, nothing else. */
export const numbersRecord = (accounts, at = new Date().toISOString()) => ({ v: 1, at, accounts });

/** The same accounts as the screen shows them: a key and the last four digits. */
export const numbersTable = (accounts) => Object.keys(accounts).map((k) => "  " + k.padEnd(10) + shown(accounts[k].number));

/** The numbers two records disagree on, by key, as lines that name the last four digits of each side and no more. */
export function numbersDiff(want, have) {
  const w = (want && want.accounts) || {}, h = (have && have.accounts) || {}, out = [];
  for (const k of Object.keys(w)) {
    if (!h[k]) out.push("  " + k.padEnd(10) + "missing from the Counter (store " + shown(w[k].number) + ")");
    else if (h[k].number !== w[k].number) out.push("  " + k.padEnd(10) + "differs (store " + shown(w[k].number) + ", Counter " + shown(h[k].number) + ")");
  }
  for (const k of Object.keys(h)) if (!w[k]) out.push("  " + k.padEnd(10) + "is on the Counter but not in the store (Counter " + shown(h[k].number) + ")");
  return out;
}

/* the Counter's KV through its own config, as seed-vault files the slip key's public half: a temporary file for the value so no
   quoting is in play, and it lives outside the repo. `exec` is the seam the suite drives; it never reaches wrangler there. */
const WR = { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" };
export function wrPutNumbers(path, exec = execFileSync) {
  return againIfLapsed(() => exec("npx", ["wrangler", "kv", "key", "put", PAYNUM_KEY, "--path", path, "--binding", "STMT", "--remote", "-c", "wrangler.stmt.jsonc"], WR));
}
export function wrGetNumbers(exec = execFileSync) {
  return againIfLapsed(() => exec("npx", ["wrangler", "kv", "key", "get", PAYNUM_KEY, "--binding", "STMT", "--remote", "-c", "wrangler.stmt.jsonc"], WR));
}

async function numbersMain(argv) {
  const dry = argv.includes("--dry");
  if (!mastersPresent()) { console.log("paysync: the pay master or qr-command is not on this machine; nothing to do"); return; }
  const { PAY_ACCOUNTS } = await import(pathToFileURL(OUT).href);
  const doc = JSON.parse(readFileSync(join(PAY_MASTER, "accounts.json"), "utf8").replace(/^\uFEFF/, ""));
  const { accounts, refused } = pickNumbers(doc, new Set(PAY_ACCOUNTS.map((a) => a.key)));
  if (refused.length) { console.error("STOPPED: nothing was written.\n  " + refused.join("\n  ")); process.exit(1); }
  const rec = numbersRecord(accounts);
  if (argv.includes("--check-numbers")) {
    let live;
    try { live = JSON.parse(wrGetNumbers()); } catch (e) {
      console.error(/ - 404:/.test(wranglerSaid(e)) ? "FAIL  the Counter holds no `paynum`; run: node tools/paysync.mjs --numbers" : "STOPPED: wrangler could not read the Counter's KV: " + wranglerSaid(e));
      process.exit(1);
    }
    const diff = numbersDiff(rec, live);
    if (!diff.length && live && live.v === 1) { console.log("  ok    KV `paynum` is what the pay master produces (" + Object.keys(accounts).length + " accounts)\n" + numbersTable(accounts).join("\n")); return; }
    console.error("  FAIL  KV `paynum` differs from the pay master; run: node tools/paysync.mjs --numbers\n" + diff.join("\n"));
    process.exit(1);
  }
  console.log((dry ? "would write " : "writing ") + "KV `paynum`, " + Object.keys(accounts).length + " accounts:\n" + numbersTable(accounts).join("\n"));
  if (dry) return;
  const dir = mkdtempSync(join(tmpdir(), "paynum-")), file = join(dir, "paynum.json");
  try {
    writeFileSync(file, JSON.stringify(rec));
    wrPutNumbers(file);
    console.log("wrote KV `paynum` on the Counter. Check it: node tools/paysync.mjs --check-numbers");
  } catch (e) { console.error("PUSH FAILED: wrangler could not write the Counter's KV: " + wranglerSaid(e)); process.exitCode = 1; }
  finally { try { rmSync(dir, { recursive: true, force: true }); } catch (e) { /* the system's temp folder */ } }
}

async function main() {
  if (process.argv.includes("--numbers") || process.argv.includes("--check-numbers")) return numbersMain(process.argv);
  const check = process.argv.includes("--check");
  if (!mastersPresent()) {
    console.log("paysync: the pay master or qr-command is not on this machine; " + (check ? "nothing to check against" : "nothing written"));
    return;
  }
  const want = payJs();
  const have = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (check) {
    if (want === have) { console.log("  ok    stmt/pay.js is what the pay master produces"); return; }
    console.log("  FAIL  stmt/pay.js differs from the pay master; run: node tools/paysync.mjs --sync");
    process.exit(1);
  }
  writeFileSync(OUT, want);
  console.log("wrote " + OUT + " (" + (want.match(/"key":/g) || []).length + " accounts)");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(String((e && e.stack) || e)); process.exit(1); });
}
