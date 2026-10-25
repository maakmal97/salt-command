#!/usr/bin/env node
/* tools/backup-key.mjs: THE KEY THAT OPENS THE NIGHTLY BACKUP (S0b of the Book plan). LAPTOP ONLY.
 *
 * The Worker seals each night's dump to a PUBLIC key (src/backup.js); only the private half can open one, so the private half
 * never goes near Cloudflare. It is minted here and sealed under the VAULT PASSPHRASE, the same envelope the slip key uses, so the
 * one passphrase he already holds opens it and no new secret is invented:
 *
 *   node tools/backup-key.mjs           mint it; writes 10_Data\salt_backupkey.json and prints the public half for wrangler.jsonc
 *   node tools/backup-key.mjs --force   replace one that exists (the old file is kept aside); EVERY BACKUP SEALED TO THE OLD KEY
 *                                       IS THEN UNREADABLE, so it is refused unasked
 *
 * It is refused unless the passphrase opens the names vault in 10_Data\salt_vault_pair.json (pull-vault first), so a typo cannot
 * seal a key nobody can open. The passphrase is asked for here, hidden and twice, and is never printed, stored or sent; the agent
 * never receives it (SALT_VAULT_PASS in the environment still works for an unattended run). Nothing is sent anywhere: the public
 * half is printed for him to put in wrangler.jsonc, and the file stays on the laptop. Keep a copy of the file somewhere that is not
 * this disk: it is ciphertext, and without it, or the passphrase, no backup can be opened. */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { slipKeyMint, slipKeyOpen, vaultDecrypt, keepAside, promptHidden } from "./seed-vault.mjs";
import { backupSeal, backupOpen } from "../src/backup.js";
import { DATA_DIR } from "./book.mjs";

export const KEY_FILE = "salt_backupkey.json";
const DATA = () => process.env.SALT_DATA || DATA_DIR;

/* A fresh pair, proved before it is filed: a probe sealed to the public half with the BACKUP protocol opens with the private half
   the passphrase unseals. Answers the file's content: {v, updated, pub, vault}. */
export async function mintBackupKey(pass) {
  const e = await slipKeyMint(pass);
  const probe = crypto.getRandomValues(new Uint8Array(32));
  const back = await backupOpen(await slipKeyOpen(pass, e.vault), await backupSeal(e.pub, probe));
  if (Buffer.compare(Buffer.from(back), Buffer.from(probe)) !== 0) throw new Error("the backup key did not round-trip");
  return { v: 1, updated: e.updated, pub: e.pub, vault: e.vault };
}

/* The lines to refuse with, or null to go on. */
export async function backupKeyRefusal(pass, { dir = DATA(), force = false } = {}) {
  const pairFile = join(dir, "salt_vault_pair.json");
  if (!existsSync(pairFile)) return ["REFUSED: no local copy of the vault pair at " + pairFile + ".", "  Run  node tools/pull-vault.mjs  first, so the passphrase can be checked against the names vault."];
  let names; try { names = JSON.parse(readFileSync(pairFile, "utf8").replace(/^﻿/, "")).names; } catch (e) { names = null; }
  if (!names) return ["REFUSED: the local vault pair holds no names envelope to check the passphrase against."];
  try { await vaultDecrypt(pass, names); } catch (e) {
    return ["REFUSED: this passphrase does not open the names vault, and the backup key is sealed under the same one. Nothing was written."];
  }
  if (existsSync(join(dir, KEY_FILE)) && !force)
    return ["REFUSED: a backup key is already filed in " + join(dir, KEY_FILE) + ".", "  A new one leaves every backup sealed to it unreadable. Nothing was written.",
      "  To replace it all the same:  node tools/backup-key.mjs --force"];
  return null;
}

async function main() {
  const force = process.argv.includes("--force");
  let pass = process.env.SALT_VAULT_PASS;
  if (!pass) {
    pass = await promptHidden("vault passphrase (hidden): ");
    if (pass != null) {
      const again = await promptHidden("again, to be sure: ");
      if (pass !== again) { console.error("The two entries differ. Nothing was written."); process.exit(2); }
    }
  }
  if (!pass) { console.error("No terminal to ask, so SET SALT_VAULT_PASS to the passphrase first. It is never stored or printed."); process.exit(2); }
  const dir = DATA(), refusal = await backupKeyRefusal(pass, { dir, force });
  if (refusal) { console.error(refusal.join("\n")); process.exit(1); }
  const file = await mintBackupKey(pass);
  mkdirSync(dir, { recursive: true });
  const aside = keepAside(join(dir, KEY_FILE));
  writeFileSync(join(dir, KEY_FILE), JSON.stringify(file, null, 1));
  console.log("MINTED: the backup key is in " + join(dir, KEY_FILE) + (aside ? " (the old one kept at " + aside + ")" : "") + ". Its private half is sealed under the vault passphrase.");
  console.log("\nThe public half, for wrangler.jsonc  \"vars\"  as BACKUP_PUBLIC_JWK (one line, as a string):\n");
  console.log(JSON.stringify(JSON.stringify(file.pub)));
  console.log("\nKeep a copy of " + KEY_FILE + " off this disk. It is ciphertext; without it or the passphrase no backup can be opened.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((e) => { console.error(e.message); process.exitCode = 1; });
