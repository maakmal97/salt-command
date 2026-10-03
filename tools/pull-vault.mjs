#!/usr/bin/env node
/* pull-vault.mjs — bring the names filed on the phone down into the laptop's directory (v528,
 * Part B step 10 of his instruction of 08 Sep 2026).
 *
 * Since v528 Add ID on the phone files the party's name and place into the cloud vault, encrypted
 * with the passphrase and never in the queue. The laptop's directory, 10_Data\salt_bio.json, is
 * then behind the vault until this runs: it fetches the envelope (ciphertext, an open read),
 * decrypts it here with the passphrase, and adds every code the directory lacks.
 * v628: AND WHERE THE VAULT SPELLS A NAME DIFFERENTLY, THE VAULT'S WINS, because Amend ID on the phone
 * writes there. Kept the other way round, the next seed from the laptop's older copy would undo
 * the amendment without a word. Nothing is lost: the directory's old spelling stays beside it as
 * `was`, which the seed never reads. Run before any edit here, as the skill does, so the only
 * spelling this can replace is one already seeded.
 *
 *   node tools/pull-vault.mjs             merge the vault's names into salt_bio.json
 *   node tools/pull-vault.mjs --dry-run   say what would be added, write nothing
 *   node tools/pull-vault.mjs --addr      F14: the places instead, KV "vault-addr" into 10_Data\salt_addr.json, the
 *                                         phone's entry winning where it differs and the old one kept as `was`;
 *                                         read through wrangler, since the Worker keys the places' read
 *   node tools/pull-vault.mjs --slip-key  F13: the slip key's envelope, KV "vault-key", proved to open on the passphrase and
 *                                         copied (ciphertext) to 10_Data\salt_slipkey.json, a different copy there kept beside it
 *   SALT_VAULT_PASS                       the passphrase, when there is no terminal to ask
 *   SALT_DATA                             override the 10_Data folder
 *
 * The passphrase is asked hidden, used once, never stored or printed. Laptop only.
 */
import { wranglerSaid } from "./cloudflare.mjs";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { vaultDecrypt, wrGetAddr, addrEntry, wrGetKey, slipKeyOpen, keepAside } from "./seed-vault.mjs";
import { DATA_DIR } from "./book.mjs";
import { pairClient, readVaultAuthority } from "./vault-pair-client.mjs";
import { withVaultFiles } from "./vault-local-files.mjs";

const BASE = (process.env.SALT_BASE || "https://salt-command.qyts8mh72kyg.workers.dev").replace(/\/+$/, "");
const CTRL_C = String.fromCharCode(3), DEL = String.fromCharCode(127), BOM = String.fromCharCode(0xFEFF);

/* pure: the directory with the vault's names added where it has none, and the vault's spelling where it differs */
export function mergeBio(bioJson, map) {
  const out = JSON.parse(JSON.stringify(bioJson || {}));
  out.bio = out.bio || {};
  const added = [], kept = [], amended = [];
  for (const code of Object.keys(map || {})) {
    const raw = String(map[code] || "").trim();
    if (!raw) continue;
    const cur = out.bio[code] && String(out.bio[code].raw || "").trim();
    if (cur === raw) { kept.push(code); continue; }
    out.bio[code] = Object.assign({}, out.bio[code] || {}, cur ? { raw, was: cur } : { raw });
    (cur ? amended : added).push(code);
  }
  if (added.length || amended.length) out.updated = new Date().toISOString();
  return { bio: out, added, kept, amended };
}

/* F14: the places pulled as the names are: the cloud's entry wins where it differs and the file's old one is kept beside it
   as `was`, which the seed never reads (it seals five fields and no more). Pure; it counts and names codes, never a place. */
export function mergeAddr(fileJson, map) {
  const out = JSON.parse(JSON.stringify(fileJson || {}));
  out.addr = out.addr || {};
  const added = [], kept = [], amended = [];
  const five = (e) => ({ addr: e.addr ?? null, lat: e.lat ?? null, lng: e.lng ?? null, src: e.src ?? null, at: e.at ?? null });
  for (const code of Object.keys(map || {})) {
    const e = addrEntry(map[code]);
    if (!e) continue;
    const cur = out.addr[code] && typeof out.addr[code] === "object" ? five(out.addr[code]) : null;
    if (cur && JSON.stringify(cur) === JSON.stringify(five(e))) { kept.push(code); continue; }
    const next = Object.assign({}, out.addr[code] || {}, five(e));
    if (cur) next.was = cur; else delete next.was;
    out.addr[code] = next;
    (cur ? amended : added).push(code);
  }
  if (added.length || amended.length) out.updated = new Date().toISOString();
  return { file: out, added, kept, amended };
}
async function pullAddr(pass, dry) {
  const file = join(DATA_DIR, "salt_addr.json");
  let raw;
  try { raw = wrGetAddr(); } catch (e) {
    if (/ - 404:/.test(wranglerSaid(e))) { console.error("The cloud holds no places vault."); process.exit(1); }
    console.error("wrangler could not read the places vault: " + wranglerSaid(e)); process.exit(1);
  }
  let j = null;
  try { j = JSON.parse(raw); } catch (e) { j = null; }
  if (!j || !j.vault) { console.error("The cloud holds no places vault."); process.exit(1); }
  let map;
  try { map = await vaultDecrypt(pass, j.vault); } catch (e) { console.error("That passphrase did not open the places vault. Nothing written."); process.exit(1); }
  let cur = {};
  if (existsSync(file)) { let t = readFileSync(file, "utf8"); if (t.startsWith(BOM)) t = t.slice(1); cur = JSON.parse(t); }
  const m = mergeAddr(cur, map);
  console.log(`places vault updated ${j.updated || "?"}: ${Object.keys(map).length} place(s); the file has ${Object.keys(cur.addr || {}).length}; ${m.added.length} to add (${m.added.join(", ") || "none"}), ${m.amended.length} changed on the phone (${m.amended.join(", ") || "none"}), ${m.kept.length} already the same here.`);
  if (dry || !(m.added.length || m.amended.length)) { console.log(dry ? "DRY RUN: nothing written." : "Nothing to write."); return; }
  writeFileSync(file, JSON.stringify(m.file, null, 2) + "\n");
  console.log(`wrote ${file}: ${m.added.length} added, ${m.amended.length} changed, each old entry kept as was. The places are on the laptop; nothing in the repo moved.`);
}

/* F13: the slip key comes down as the ciphertext it is, once the passphrase is proved to open it; nothing is decrypted to disk */
export async function slipKeyPull(pass, read = wrGetKey) {
  let j = null;
  try { j = JSON.parse(read()); } catch (e) {
    return { error: / - 404:/.test(wranglerSaid(e)) ? "The cloud holds no slip key." : "wrangler could not read the slip key: " + wranglerSaid(e) };
  }
  if (!j || !j.vault) return { error: "The cloud holds no slip key." };
  try { await slipKeyOpen(pass, j.vault); } catch (e) { return { error: "That passphrase did not open the slip key. Nothing written." }; }
  return { envelope: j };
}
async function pullSlipKey(pass, dry) {
  const r = await slipKeyPull(pass);
  if (r.error) { console.error(r.error); process.exit(1); }
  const file = join(DATA_DIR, "salt_slipkey.json"), text = JSON.stringify(r.envelope, null, 1) + "\n";
  const same = existsSync(file) && readFileSync(file, "utf8") === text;
  console.log(`slip key updated ${r.envelope.updated || "?"}: it opens on this passphrase; the copy in 10_Data is ${same ? "the same" : existsSync(file) ? "different" : "missing"}.`);
  if (dry || same) { console.log(dry ? "DRY RUN: nothing written." : "Nothing to write."); return; }
  const aside = keepAside(file);
  writeFileSync(file, text);
  console.log(`wrote ${file}${aside ? ", the old copy kept at " + aside : ""}. Ciphertext only.`);
}

export async function pullVaultPair(pass, { client, bio, addr, dry = false, persist }) {
  const pair = await client.read();
  const names = await vaultDecrypt(pass, pair.names);
  const places = pair.places ? await vaultDecrypt(pass, pair.places) : {};
  const mergedBio = mergeBio(bio, names), mergedAddr = mergeAddr(addr, places);
  if (!dry) await persist({ bio: mergedBio.bio, addr: mergedAddr.file, pair });
  return { revision: pair.revision, dry, names: mergedBio, places: mergedAddr };
}

export async function pullVaultPairFiles(pass, { client, dir = DATA_DIR, dry = false, transaction, afterWrite }) {
  if (!transaction) return withVaultFiles(dir, lock => pullVaultPairFiles(pass, { client, dir, dry, transaction: lock, afterWrite }));
  const namesFile = join(dir, "salt_bio.json"), placesFile = join(dir, "salt_addr.json");
  const read = (file) => existsSync(file) ? JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, "")) : {};
  const result = await pullVaultPair(pass, {
    client,
    bio: read(namesFile), addr: read(placesFile), dry,
    persist: async ({ bio, addr, pair }) => {
      transaction.commit({ bio, addr, pair }, afterWrite);
    }
  });
  return result;
}
async function pullVersioned(pass, dry, transaction) {
  const result = await pullVaultPairFiles(pass, { dry, transaction,
    client: pairClient({ base: BASE, writeKey: process.env.SALT_WRITE_KEY, accessToken: process.env.SALT_ACCESS_JWT }) });
  console.log(dry ? "DRY RUN: consistent pair opened at revision " + result.revision + "; nothing written."
    : "PULLED: names, places and ciphertext merge baseline from one revision " + result.revision + ". No legacy KV reads were used.");
}

function promptHidden(question) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return Promise.resolve(null);
  return new Promise((res) => {
    process.stdout.write(question);
    const chars = [];
    process.stdin.setRawMode(true); process.stdin.resume();
    const onData = (buf) => {
      for (const ch of buf.toString("utf8")) {
        if (ch === "\r" || ch === "\n") { process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.off("data", onData); process.stdout.write("\n"); return res(chars.join("")); }
        if (ch === CTRL_C) { process.stdout.write("\n"); process.exit(130); }
        if (ch === DEL || ch === "\b") { chars.pop(); continue; }
        chars.push(ch);
      }
    };
    process.stdin.on("data", onData);
  });
}

async function main(transaction) {
  const dry = process.argv.includes("--dry-run");
  const file = join(DATA_DIR, "salt_bio.json");
  if (!existsSync(file)) { console.error("salt_bio.json not found at " + file + " (set SALT_DATA). This runs on the laptop only."); process.exit(2); }
  let pass = process.env.SALT_VAULT_PASS || await promptHidden("vault passphrase (hidden): ");
  if (!pass) { console.error("No passphrase. Set SALT_VAULT_PASS or run in a terminal."); process.exit(2); }
  if (process.argv.includes("--slip-key")) return pullSlipKey(pass, dry);   // F13: the slip key, not the names
  const authority = await readVaultAuthority(BASE, globalThis.fetch, process.env.SALT_ACCESS_JWT);
  if (authority.pair) return pullVersioned(pass, dry, transaction);
  if (process.argv.includes("--addr")) return pullAddr(pass, dry);   // F14: the places, not the names
  const j = authority.reading;
  if (!j || !j.vault) { console.error("The cloud holds no vault."); process.exit(1); }
  let map;
  try { map = await vaultDecrypt(pass, j.vault); } catch (e) { console.error("That passphrase did not open the vault. Nothing written."); process.exit(1); }
  pass = null;
  /* stripped of a byte-order mark first: Notepad on Windows writes one by default */
  let text = readFileSync(file, "utf8");
  if (text.startsWith(BOM)) text = text.slice(1);
  const bio = JSON.parse(text);
  const m = mergeBio(bio, map);
  console.log(`vault updated ${j.updated || "?"}: ${Object.keys(map).length} names; directory has ${Object.keys(bio.bio || {}).length}; ${m.added.length} to add (${m.added.join(", ") || "none"}), ${m.amended.length} amended on the phone (${m.amended.join(", ") || "none"}), ${m.kept.length} already the same here.`);
  if (dry || !(m.added.length || m.amended.length)) { console.log(dry ? "DRY RUN: nothing written." : "Nothing to write."); return; }
  writeFileSync(file, JSON.stringify(m.bio, null, 2) + "\n");
  console.log(`wrote ${file}: ${m.added.length} added, ${m.amended.length} amended, each old spelling kept as was. The names are on the laptop; codes only in the repo, as always.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  withVaultFiles(DATA_DIR, main).catch(error => { console.error(error.message); process.exitCode = 1; });
