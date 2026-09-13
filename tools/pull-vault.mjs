#!/usr/bin/env node
/* pull-vault.mjs — bring the names filed on the phone down into the laptop's directory (v528,
 * Part B step 10 of his instruction of 08 Sep 2026).
 *
 * Since v528 Add ID on the phone files the party's name and place into the cloud vault, encrypted
 * with the passphrase and never in the queue. The laptop's directory, 10_Data\salt_bio.json, is
 * then behind the vault until this runs: it fetches the envelope (ciphertext, an open read),
 * decrypts it here with the passphrase, and adds every code the directory lacks. A name already
 * in the directory is never overwritten: the laptop's copy is the one he edits by hand.
 *
 *   node tools/pull-vault.mjs             merge the vault's names into salt_bio.json
 *   node tools/pull-vault.mjs --dry-run   say what would be added, write nothing
 *   SALT_VAULT_PASS                       the passphrase, when there is no terminal to ask
 *   SALT_DATA                             override the 10_Data folder
 *
 * The passphrase is asked hidden, used once, never stored or printed. Laptop only.
 */
import "./cloudflare.mjs";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { vaultDecrypt } from "./seed-vault.mjs";
import { DATA_DIR } from "./book.mjs";

const BASE = (process.env.SALT_BASE || "https://salt-command.qyts8mh72kyg.workers.dev").replace(/\/+$/, "");
const CTRL_C = String.fromCharCode(3), DEL = String.fromCharCode(127), BOM = String.fromCharCode(0xFEFF);

/* pure: the directory with the vault's names added where the directory has none */
export function mergeBio(bioJson, map) {
  const out = JSON.parse(JSON.stringify(bioJson || {}));
  out.bio = out.bio || {};
  const added = [], kept = [];
  for (const code of Object.keys(map || {})) {
    const raw = String(map[code] || "").trim();
    if (!raw) continue;
    const cur = out.bio[code] && String(out.bio[code].raw || "").trim();
    if (cur) { kept.push(code); continue; }
    out.bio[code] = Object.assign({}, out.bio[code] || {}, { raw });
    added.push(code);
  }
  if (added.length) out.updated = new Date().toISOString();
  return { bio: out, added, kept };
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

async function main() {
  const dry = process.argv.includes("--dry-run");
  const file = join(DATA_DIR, "salt_bio.json");
  if (!existsSync(file)) { console.error("salt_bio.json not found at " + file + " (set SALT_DATA). This runs on the laptop only."); process.exit(2); }
  let pass = process.env.SALT_VAULT_PASS || await promptHidden("vault passphrase (hidden): ");
  if (!pass) { console.error("No passphrase. Set SALT_VAULT_PASS or run in a terminal."); process.exit(2); }
  const r = await fetch(BASE + "/vault", { cache: "no-store" });
  const j = r.ok ? await r.json() : null;
  if (!j || !j.vault) { console.error("The cloud holds no vault."); process.exit(1); }
  let map;
  try { map = await vaultDecrypt(pass, j.vault); } catch (e) { console.error("That passphrase did not open the vault. Nothing written."); process.exit(1); }
  pass = null;
  /* stripped of a byte-order mark first: Notepad on Windows writes one by default */
  let text = readFileSync(file, "utf8");
  if (text.startsWith(BOM)) text = text.slice(1);
  const bio = JSON.parse(text);
  const m = mergeBio(bio, map);
  console.log(`vault updated ${j.updated || "?"}: ${Object.keys(map).length} names; directory has ${Object.keys(bio.bio || {}).length}; ${m.added.length} to add (${m.added.join(", ") || "none"}), ${m.kept.length} already named here.`);
  if (dry || !m.added.length) { console.log(dry ? "DRY RUN: nothing written." : "Nothing to write."); return; }
  writeFileSync(file, JSON.stringify(m.bio, null, 2) + "\n");
  console.log(`wrote ${file}: ${m.added.length} added. The names are on the laptop; codes only in the repo, as always.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
