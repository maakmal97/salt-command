/* seed-vault.mjs — put the CURRENT names into the cloud, encrypted.
 *
 * The desk's own "Save" writes plaintext names to salt_bio.json; the encrypted vault
 * (salt_vault.json) is legacy and stale. So this reads the current directory, encrypts
 * it with your passphrase into the exact envelope the desk's vaultDecrypt expects, and
 * pushes ONLY that ciphertext to the cloud (KV key "vault"). The phone then decrypts it
 * with the same passphrase; the plaintext never leaves this machine.
 *
 * The crypto matches the desk byte for byte: PBKDF2-SHA256 x150000 over a random 16-byte
 * salt, AES-GCM-256, a fresh 12-byte iv, base64 throughout.
 *
 *   SALT_VAULT_PASS   your passphrase. Required. Never commit it, never pass it on a shared
 *                     command line where history is logged; prefer setting it for the one call.
 *   SALT_DATA         override the 06_Data folder holding salt_bio.json.
 *
 *   node tools/seed-vault.mjs             encrypt the current names and push to KV
 *   node tools/seed-vault.mjs --dry-run   encrypt only; write the envelope (ciphertext) to
 *                                         test/tmp for inspection, push nothing
 */
import { webcrypto as wc } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const BINDING = "SALT_QUEUE";
const VKEY = "vault";
const DEFAULT_DATA = "C:/Users/maakm/Claude/Projects/Personal/Cow-Crm01_Salt Business/06_Data";
const DATA = process.env.SALT_DATA || DEFAULT_DATA;

const b64e = (buf) => Buffer.from(buf).toString("base64");
const b64d = (s) => new Uint8Array(Buffer.from(s, "base64"));

async function deriveKey(pass, salt) {
  const base = await wc.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  return wc.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
// Exact mirror of the desk's vaultEncrypt / vaultDecrypt, exported for the round-trip test.
export async function vaultEncrypt(pass, mapObj) {
  const salt = wc.getRandomValues(new Uint8Array(16));
  const iv = wc.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pass, salt);
  const ct = await wc.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(mapObj)));
  return { v: 1, salt: b64e(salt), iv: b64e(iv), ct: b64e(new Uint8Array(ct)) };
}
export async function vaultDecrypt(pass, blob) {
  const key = await deriveKey(pass, b64d(blob.salt));
  const pt = await wc.subtle.decrypt({ name: "AES-GCM", iv: b64d(blob.iv) }, key, b64d(blob.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}

function loadBio() {
  const p = join(DATA, "salt_bio.json");
  if (!existsSync(p)) throw new Error("salt_bio.json not found at " + p + " (set SALT_DATA)");
  const j = JSON.parse(readFileSync(p, "utf8"));
  const bio = j.bio || {};
  const map = {}, ids = {};
  for (const code of Object.keys(bio)) {
    const raw = (bio[code] && bio[code].raw || "").trim();
    if (raw) map[code] = raw;    // value is "Name (Location)"; the desk's ID() shows just the name
    ids[code] = code;            // codes map to themselves; a rename would desync the ledger
  }
  return { map, ids };
}

function wrPut(jsonPath) {
  return execFileSync("npx", ["wrangler", "kv", "key", "put", VKEY, "--path", jsonPath, "--binding", BINDING, "--remote"],
    { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" });
}

async function main() {
  const dry = process.argv.includes("--dry-run");
  const pass = process.env.SALT_VAULT_PASS;
  if (!pass) {
    console.error("SET SALT_VAULT_PASS to your passphrase first. It is never stored or printed.");
    console.error('  PowerShell:  $env:SALT_VAULT_PASS="..."; node tools/seed-vault.mjs');
    process.exit(2);
  }
  const { map, ids } = loadBio();
  const named = Object.keys(map).length;
  if (!named) { console.error("No names found in salt_bio.json; nothing to seed."); process.exit(1); }

  const envelope = { updated: new Date().toISOString(), vault: await vaultEncrypt(pass, map), ids };

  // prove it round-trips before we push, so a bad passphrase or a crypto slip is caught here
  const back = await vaultDecrypt(pass, envelope.vault);
  if (Object.keys(back).length !== named) throw new Error("round-trip check failed");

  if (dry) {
    mkdirSync(join(REPO, "test", "tmp"), { recursive: true });
    const out = join(REPO, "test", "tmp", "vault-seed.json");
    writeFileSync(out, JSON.stringify(envelope, null, 1));   // ciphertext only, safe to write
    console.log(`DRY RUN: encrypted ${named} names, round-trip OK. Envelope (ciphertext) at ${out}. Pushed nothing.`);
    return;
  }

  mkdirSync(join(REPO, "test", "tmp"), { recursive: true });
  const tmp = join(REPO, "test", "tmp", "vault-push.json");
  writeFileSync(tmp, JSON.stringify(envelope));
  try {
    wrPut(tmp);
    console.log(`SEEDED: ${named} names encrypted and pushed to KV "${VKEY}". The phone can now decrypt them with the passphrase.`);
  } catch (e) {
    console.error("PUSH FAILED: wrangler could not write the KV key.");
    console.error("  " + String(e.message || e).split("\n")[0]);
    console.error("  Check `npx wrangler whoami`, the KV id in wrangler.jsonc, and CLOUDFLARE_API_TOKEN for unattended runs.");
    process.exitCode = 1;
  } finally {
    try { rmSync(tmp, { force: true }); } catch (e) {}   // never leave names or the envelope on disk
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
