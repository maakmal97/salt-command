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
 *   SALT_VAULT_PASS   your passphrase. Optional in a terminal: run interactively and the tool
 *                     PROMPTS for it, hidden, asked twice, held only in memory for the one run
 *                     (added for the update-names-id workflow, 28 Aug 2026). Required only when
 *                     there is no terminal to ask, e.g. an unattended run. Never commit it,
 *                     never pass it on a shared command line where history is logged.
 *   SALT_DATA         override the 10_Data folder holding salt_bio.json.
 *
 *   node tools/seed-vault.mjs             encrypt the current names and push to KV
 *   node tools/seed-vault.mjs --dry-run   encrypt only; write the envelope (ciphertext) to
 *                                         test/tmp for inspection, push nothing
 *   node tools/seed-vault.mjs --addr      F14: the places instead, 10_Data\salt_addr.json sealed under the SAME
 *                                         passphrase into KV "vault-addr". Refused unless the passphrase opens the
 *                                         live names vault, and while the live places hold a code the file lacks
 *                                         (--force skips the second check, never the first). Prints codes, never a place.
 *   node tools/seed-vault.mjs --slip-key  F13: mint the slip key, an ECDH P-256 pair. The private half is sealed under the SAME
 *                                         passphrase into KV "vault-key", beside the public half in the clear; the public half
 *                                         alone goes to the Counter's KV "slipkey", and a copy of the envelope (ciphertext) to
 *                                         10_Data\salt_slipkey.json. Refused unless the passphrase opens the live names vault, and
 *                                         while a slip key is filed in KV or in 10_Data: a new one leaves every slip sealed to the
 *                                         old one unreadable (--force goes past that, keeping the old copy beside the new).
 *                                         Lost from KV: npx wrangler kv key put vault-key --path <the copy> --binding SALT_QUEUE --remote
 *   node tools/seed-vault.mjs --slip-pub  F13: the live key's public half to the Counter's KV again, no passphrase; for a
 *                                         --slip-key run whose last push failed
 */
import { wranglerSaid, againIfLapsed } from "./cloudflare.mjs";
import { webcrypto as wc } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, renameSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { pairClient, readVaultAuthority, vaultMapMerge, deskAccess } from "./vault-pair-client.mjs";
import { withVaultFiles } from "./vault-local-files.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const BINDING = "SALT_QUEUE";
const VKEY = "vault";
const AKEY = "vault-addr";   // F14: the places envelope, beside the names, on the same passphrase
const KKEY = "vault-key";    // F13: the slip key's private half, sealed, the vault's third envelope
const PKEY = "slipkey";      // F13: its public half, on the Counter's KV, which the customer's page seals a slip to
const SLIP_COPY = "salt_slipkey.json";
import { DATA_DIR } from "./book.mjs";
const DEFAULT_DATA = DATA_DIR;
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

function wrPut(jsonPath, key = VKEY) {
  if (key !== KKEY) throw new Error("Names and places writes must use the maintenance-gated Worker, never direct KV.");
  return againIfLapsed(() => execFileSync("npx", ["wrangler", "kv", "key", "put", key, "--path", jsonPath, "--binding", BINDING, "--remote"],
    { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" }));
}

export async function seedLegacyEnvelope(envelope, kind, { base, writeKey, accessToken, fetch: transport = globalThis.fetch }) {
  if (!writeKey || !["names", "places"].includes(kind))
    throw new Error("Set SALT_WRITE_KEY for the maintenance-gated names/places writer; it is never saved or printed.");
  const response = await transport(new Request(base.replace(/\/+$/, "") + (kind === "names" ? "/vault" : "/vault/addr"), {
    method: "POST", headers: { "content-type": "application/json", "X-Salt-Key": writeKey,
      ...deskAccess(accessToken) }, body: JSON.stringify(envelope)
  }));
  const result = await response.json();
  if (!response.ok || result.ok !== true) throw new Error(result.error || "The gated vault write was not confirmed.");
  return result;
}
const legacyClient = () => ({ base: process.env.SALT_BASE || "https://salt-command.qyts8mh72kyg.workers.dev",
  writeKey: process.env.SALT_WRITE_KEY, accessToken: process.env.SALT_ACCESS_JWT });

export async function seedVaultPair(pass, { client, baseline, map, kind, review = async () => false,
  dry = false, pending = null, saveRequest, finishRequest, at = new Date().toISOString() }) {
  if (pending) {
    const response = await client.write(pending.body);
    await finishRequest({ ok: true, revision: response.revision, names: pending.body.names,
      places: pending.body.places, updated: pending.body.at }, pending);
    return response;
  }
  if (!baseline || !Number.isSafeInteger(baseline.revision) || !["names", "places"].includes(kind))
    throw new Error("Pull the versioned pair before editing and seeding. A reviewed ciphertext baseline is required.");
  const latest = await client.read();
  const open = async (pair) => ({ names: await vaultDecrypt(pass, pair.names),
    places: pair.places ? await vaultDecrypt(pass, pair.places) : {} });
  const [was, current] = await Promise.all([open(baseline), open(latest)]);
  let merged = vaultMapMerge(was[kind], map, current[kind]);
  if (merged.conflicts.length) {
    if (!await review(merged.conflicts))
      throw new Error("The vault changed at " + merged.conflicts.join(", ") + ". Local edits are kept; review conflicts before sending.");
    merged = vaultMapMerge(was[kind], map, current[kind], merged.conflicts);
  }
  current[kind] = merged.map;
  const body = { at, expectedRevision: latest.revision, names: await vaultEncrypt(pass, current.names),
    places: latest.places === null && kind !== "places" ? null : await vaultEncrypt(pass, current.places) };
  if (dry) return { ok: true, dry: true, revision: latest.revision, changed: merged.changed };
  const request = { kind, body, baseline };
  await saveRequest(request);
  const response = await client.write(body);
  await finishRequest({ ok: true, revision: response.revision, names: body.names, places: body.places, updated: body.at }, request);
  return response;
}

export async function seedVaultPairFiles(pass, { client, dir = DATA, kind = "names", dry = false,
  retry = false, review, at, transaction, afterWrite }) {
  if (!transaction) return withVaultFiles(dir, lock => seedVaultPairFiles(pass,
    { client, dir, kind, dry, retry, review, at, transaction: lock, afterWrite }));
  const baselineFile = join(dir, "salt_vault_pair.json"), requestFile = join(dir, "salt_vault_pair_request.json");
  const read = file => existsSync(file) ? JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, "")) : {};
  const pending = existsSync(requestFile) ? read(requestFile) : null;
  if (pending && !retry) throw new Error("An encrypted request is retained. Use --retry unchanged, or --rebase to keep it aside and review the latest pair.");
  if (pending && dry) throw new Error("A retained transport retry is a write; do not combine --retry and --dry-run.");
  if (pending && !pending.baseline) throw new Error("This retained request lacks its reconciliation baseline. Keep it and recover with reviewed local reconciliation.");
  const localMaps = (bio, addr) => {
    const names = {}, places = {};
    for (const [code, entry] of Object.entries(bio.bio || {})) {
      const raw = String(entry?.raw || "").trim();
      if (raw) names[code] = raw;
    }
    for (const [code, entry] of Object.entries(addr.addr || {})) {
      const value = addrEntry(entry);
      if (!value) throw new Error("Invalid local place entry: " + code);
      places[code] = value;
    }
    return { names, places };
  };
  const bioFile = join(dir, "salt_bio.json"), addrFile = join(dir, "salt_addr.json");
  return seedVaultPair(pass, { client, baseline: read(baselineFile),
    map: pending ? null : localMaps(read(bioFile), read(addrFile))[kind], kind, dry, pending, review, at,
    saveRequest: async request => writeFileSync(requestFile, JSON.stringify(request), { flag: "wx", mode: 0o600 }),
    finishRequest: async (pair, request) => {
      const bio = read(bioFile), addr = read(addrFile), local = localMaps(bio, addr);
      for (const part of ["names", "places"]) {
        const base = request.baseline[part] ? await vaultDecrypt(pass, request.baseline[part]) : {};
        const cloud = pair[part] ? await vaultDecrypt(pass, pair[part]) : {};
        const merged = vaultMapMerge(base, local[part], cloud);
        const map = vaultMapMerge(base, local[part], cloud, merged.conflicts).map;
        const file = part === "names" ? bio : addr, field = part === "names" ? "bio" : "addr";
        file[field] ||= {};
        for (const code of Object.keys(file[field])) if (!(code in map)) delete file[field][code];
        for (const [code, value] of Object.entries(map))
          file[field][code] = { ...file[field][code], ...(part === "names" ? { raw: value } : value) };
      }
      transaction.commit({ bio, addr, pair }, afterWrite);
      rmSync(requestFile);
    }
  });
}

async function seedVersioned(pass, dry, transaction) {
  if (process.argv.includes("--force"))
    throw new Error("--force never bypasses the pair revision or conflict review.");
  const requestFile = join(DATA, "salt_vault_pair_request.json");
  const client = pairClient({ base: process.env.SALT_BASE || "https://salt-command.qyts8mh72kyg.workers.dev",
    writeKey: process.env.SALT_WRITE_KEY, accessToken: process.env.SALT_ACCESS_JWT });
  if (process.argv.includes("--rebase") && existsSync(requestFile)) {
    if (dry) throw new Error("A dry run never abandons a retained request.");
    renameSync(requestFile, requestFile + ".conflict-" + Date.now());
  }
  const kind = process.argv.includes("--addr") ? "places" : "names";
  const result = await seedVaultPairFiles(pass, { client, transaction, kind, dry, retry: process.argv.includes("--retry"),
    review: async (codes) => {
      if (!process.stdin.isTTY || !process.argv.includes("--review-conflicts")) return false;
      const terminal = createInterface({ input: process.stdin, output: process.stdout });
      try { return (await terminal.question("Apply the local edits over changed vault entries for " + codes.join(", ") + "? Type APPLY: ")).trim() === "APPLY"; }
      finally { terminal.close(); }
    }
  });
  console.log(result.dry ? "DRY RUN: versioned pair read and encrypted; nothing written."
    : "SEEDED: versioned ciphertext pair confirmed at revision " + result.revision + ". No names/places KV put was used.");
}
/* THE READ TAKES THE PUT'S ROAD (27 Sep 2026): from the repo, through a shell on Windows, stderr
   kept, a lapsed login tried once more. Without the shell execFileSync("npx") throws ENOENT on the
   laptop, so the read failed there every time, the failure passed for "no vault", and the guard
   in seedRefusal never ran. exec is the suite's way in. */
export function wrGet(exec = execFileSync) {
  return againIfLapsed(() => exec("npx", ["wrangler", "kv", "key", "get", VKEY, "--binding", BINDING, "--remote"],
    { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" }));
}
/* F14: the places envelope, read the same road. Its GET on the Worker is keyed; wrangler needs no key. */
export function wrGetAddr(exec = execFileSync) {
  return againIfLapsed(() => exec("npx", ["wrangler", "kv", "key", "get", AKEY, "--binding", BINDING, "--remote"],
    { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" }));
}

/* A SEED REPLACES THE WHOLE VAULT, so it must not run over names it has never seen (19 Sep 2026).
   Add ID and Amend ID both file names into the vault FROM THE PHONE, and the laptop's directory is
   behind it until pull-vault.mjs runs. The Names rule has said to pull first since v528 and nothing
   enforced it, so a seed could silently drop every name the phone had filed since the last pull.
   It happened twice on 19 Sep. This reads the live vault and refuses while it holds a code the
   directory lacks; --force is for the case where the vault is the thing that is wrong.
   A READ THAT FAILED IS NOT AN EMPTY VAULT (27 Sep 2026). Only wrangler's 404, the key not there,
   goes on; any other failure stops the seed in wrangler's words. Answers the lines to refuse with,
   or null to go on; read is the suite's way in. */
export async function seedRefusal(pass, map, read = wrGet) {
  let cloud;
  try { cloud = JSON.parse(read()); } catch (e) {
    if (/ - 404:/.test(wranglerSaid(e))) return null;
    return ["STOPPED: wrangler could not read the live vault, and a seed replaces the whole of it. Nothing was pushed.",
      "  wrangler said: " + wranglerSaid(e),
      "  Timed out: run it again. If the vault is the thing that is wrong:  node tools/seed-vault.mjs --force"];
  }
  if (!cloud || !cloud.vault) return null;
  let there;
  try { there = await vaultDecrypt(pass, cloud.vault); } catch (e) {
    return ["The vault is there but this passphrase did not open it. Nothing was pushed.",
      "  A seed replaces the whole vault, so it will not run blind over names it cannot read."];
  }
  const missing = Object.keys(there).filter((c) => !(c in map));
  if (!missing.length) return null;
  return [`REFUSED: the vault holds ${missing.length} name(s) this directory does not: ${missing.join(", ")}`,
    "  A seed replaces the whole vault, so pushing now would drop them.",
    "  Pull them down first:  node tools/pull-vault.mjs",
    "  Or, if the vault is the thing that is wrong:  node tools/seed-vault.mjs --force"];
}

/* F14 (28 Sep 2026): THE PLACES, 10_Data\salt_addr.json: {updated, addr: {<code>: {addr, lat, lng, src, at}, _base: {...}}}.
   Only those five fields are sealed, so a `was` the pull keeps, or a note typed beside an entry, never reaches the envelope.
   An entry carries a point, both numbers in range, or an address, or it is named and refused. The file is read here and in
   pull-vault.mjs and nowhere else, and neither prints a place, only codes and counts. */
export function addrEntry(e) {
  if (!e || typeof e !== "object") return null;
  const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
  const lat = num(e.lat), lng = num(e.lng);
  const hasPt = lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  if ((lat !== null || lng !== null) && !hasPt) return null;
  const addr = typeof e.addr === "string" && e.addr.trim() ? e.addr.trim().slice(0, 200) : null;
  if (!hasPt && !addr) return null;
  return { addr, lat: hasPt ? lat : null, lng: hasPt ? lng : null,
    src: typeof e.src === "string" && e.src.trim() ? e.src.trim().slice(0, 20) : "file",
    at: typeof e.at === "string" && e.at.trim() ? e.at.trim().slice(0, 40) : null };
}
export function addrMap(fileJson) {
  const from = (fileJson && fileJson.addr) || {}, map = {}, bad = [];
  for (const code of Object.keys(from)) { const e = addrEntry(from[code]); if (e) map[code] = e; else bad.push(code); }
  return { map, bad };
}
function loadAddr() {
  const p = join(DATA, "salt_addr.json");
  if (!existsSync(p)) throw new Error("salt_addr.json not found at " + p + " (set SALT_DATA)");
  let text = readFileSync(p, "utf8");
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);   // Notepad writes one
  return addrMap(JSON.parse(text));
}
/* THE PLACES SEED IS REFUSED ON THE NAMES' GROUNDS, AND ONE MORE: the passphrase must open the live NAMES vault, so the two
   envelopes are never sealed under two passphrases and the desk's one unlock opens both. --force skips the check of what the
   live places hold, never the passphrase. Answers the lines to refuse with, or null to go on; the reads are the suite's way in. */
export async function addrSeedRefusal(pass, map, readAddr = wrGetAddr, readNames = wrGet, force = false) {
  const got = (read, what) => {
    try { return { j: JSON.parse(read()) }; } catch (e) {
      if (/ - 404:/.test(wranglerSaid(e))) return { j: null };
      return { stop: ["STOPPED: wrangler could not read the live " + what + ". Nothing was pushed.",
        "  wrangler said: " + wranglerSaid(e),
        "  Timed out: run it again."] };
    }
  };
  const names = got(readNames, "names vault");
  if (names.stop) return names.stop;
  if (names.j && names.j.vault) {
    try { await vaultDecrypt(pass, names.j.vault); } catch (e) {
      return ["REFUSED: this passphrase does not open the names vault, and the places are sealed under the same one. Nothing was pushed."];
    }
  }
  if (force) return null;
  const live = got(readAddr, "places vault");
  if (live.stop) return live.stop;
  if (!live.j || !live.j.vault) return null;
  let there;
  try { there = await vaultDecrypt(pass, live.j.vault); } catch (e) {
    return ["The places vault is there but this passphrase did not open it. Nothing was pushed.",
      "  A seed replaces the whole of it, so it will not run blind over places it cannot read."];
  }
  const missing = Object.keys(there).filter((c) => !(c in map));
  /* F14 review: a place filed on the phone since the pull carries a later `at` than the file's, and a seed would put the older
     one back; an entry edited in the file keeps the `at` the pull gave it, so it goes on */
  const newer = Object.keys(there).filter((c) => c in map && there[c] && String(there[c].at || "") > String(map[c].at || "")
    && JSON.stringify(there[c]) !== JSON.stringify(map[c]));
  if (!missing.length && !newer.length) return null;
  return [...(missing.length ? [`REFUSED: the places vault holds ${missing.length} code(s) this file does not: ${missing.join(", ")}`] : []),
    ...(newer.length ? [`REFUSED: the places vault holds a newer entry than this file for ${newer.length} code(s): ${newer.join(", ")}`] : []),
    "  A seed replaces the whole of it, so pushing now would lose them.",
    "  Pull them down first:  node tools/pull-vault.mjs --addr",
    "  Or, if the places vault is the thing that is wrong:  node tools/seed-vault.mjs --addr --force"];
}
async function seedAddr(pass, dry) {
  const { map, bad } = loadAddr();
  if (bad.length) { console.error(`REFUSED: ${bad.length} entr${bad.length === 1 ? "y" : "ies"} in salt_addr.json carry neither a point in range nor an address: ${bad.join(", ")}. Nothing was pushed.`); process.exit(2); }
  const n = Object.keys(map).length;
  if (!n) { console.error("No places found in salt_addr.json; nothing to seed."); process.exit(1); }
  const refused = await addrSeedRefusal(pass, map, wrGetAddr, wrGet, process.argv.includes("--force"));
  if (refused) { for (const l of refused) console.error(l); process.exit(2); }
  const envelope = { updated: new Date().toISOString(), vault: await vaultEncrypt(pass, map) };
  const back = await vaultDecrypt(pass, envelope.vault);
  if (Object.keys(back).length !== n) throw new Error("round-trip check failed");
  mkdirSync(join(REPO, "test", "tmp"), { recursive: true });
  if (dry) {
    const out = join(REPO, "test", "tmp", "vault-addr-seed.json");
    writeFileSync(out, JSON.stringify(envelope, null, 1));   // ciphertext only, safe to write
    console.log(`DRY RUN: encrypted ${n} place(s), round-trip OK. Envelope (ciphertext) at ${out}. Pushed nothing.`);
    return;
  }
  const tmp = join(REPO, "test", "tmp", "vault-addr-push.json");
  writeFileSync(tmp, JSON.stringify(envelope));
  try {
    await seedLegacyEnvelope(envelope, "places", legacyClient());
    console.log(`SEEDED: ${n} place(s) encrypted and pushed to KV "${AKEY}". The desk opens them with the names, on the one passphrase.`);
  } catch (e) {
    console.error("PUSH FAILED: the maintenance-gated places writer did not confirm.");
    console.error("  " + e.message);
    process.exitCode = 1;
  } finally {
    try { rmSync(tmp, { force: true }); } catch (e) {}   // never leave the envelope on disk
  }
}

/* F13 (29 Sep 2026): THE SLIP KEY, the vault's third envelope. An ECDH P-256 pair: the private half, as a JWK of five fields,
   sealed by vaultEncrypt under the vault's passphrase, so the desk's one unlock opens it with the names and the places and
   imports it non-extractable; the public half travels in the clear. A slip is sealed on the customer's device to the public
   half: an ephemeral P-256 pair, ECDH, HKDF-SHA-256 (no salt, info SLIP_INFO) to an AES-GCM-256 key, a fresh 12-byte iv,
   {v: 1, epk: the ephemeral public point raw in base64, iv, ct}. slipSeal and slipOpen here are that protocol, which the desk's
   slipOpen mirrors; the seed uses them to prove a fresh pair before anything is pushed. */
const SLIP_INFO = "salt-slip v1";
const ECDH = { name: "ECDH", namedCurve: "P-256" };
const jwkPub = (k) => ({ kty: k.kty, crv: k.crv, x: k.x, y: k.y });
async function slipAes(priv, pubKey) {
  const bits = await wc.subtle.deriveBits({ name: "ECDH", public: pubKey }, priv, 256);
  const hk = await wc.subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  return wc.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: new TextEncoder().encode(SLIP_INFO) },
    hk, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
export async function slipSeal(pubJwk, bytes) {
  const eph = await wc.subtle.generateKey(ECDH, true, ["deriveBits"]);
  const key = await slipAes(eph.privateKey, await wc.subtle.importKey("jwk", jwkPub(pubJwk), ECDH, false, []));
  const iv = wc.getRandomValues(new Uint8Array(12));
  const ct = await wc.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes);
  return { v: 1, epk: b64e(await wc.subtle.exportKey("raw", eph.publicKey)), iv: b64e(iv), ct: b64e(new Uint8Array(ct)) };
}
export async function slipOpen(privKey, sealed) {
  const key = await slipAes(privKey, await wc.subtle.importKey("raw", b64d(sealed.epk), ECDH, false, []));
  return new Uint8Array(await wc.subtle.decrypt({ name: "AES-GCM", iv: b64d(sealed.iv) }, key, b64d(sealed.ct)));
}
/* the sealed private half opened and imported as the desk imports it: non-extractable, to derive bits and nothing else */
export async function slipKeyOpen(pass, vault) {
  const k = await vaultDecrypt(pass, vault);
  return wc.subtle.importKey("jwk", { ...jwkPub(k), d: k.d }, ECDH, false, ["deriveBits"]);
}
/* A fresh pair, sealed, and proved before it goes anywhere: the envelope opens on the passphrase, and a probe sealed to the
   public half opens with the private half it holds. Answers {updated, vault, pub}, the KV value. */
export async function slipKeyMint(pass) {
  const pair = await wc.subtle.generateKey(ECDH, true, ["deriveBits"]);
  const k = await wc.subtle.exportKey("jwk", pair.privateKey);
  const envelope = { updated: new Date().toISOString(), vault: await vaultEncrypt(pass, { ...jwkPub(k), d: k.d }), pub: jwkPub(k) };
  const probe = wc.getRandomValues(new Uint8Array(32));
  const back = await slipOpen(await slipKeyOpen(pass, envelope.vault), await slipSeal(envelope.pub, probe));
  if (b64e(back) !== b64e(probe)) throw new Error("the slip key did not round-trip");
  return envelope;
}
export function wrGetKey(exec = execFileSync) {
  return againIfLapsed(() => exec("npx", ["wrangler", "kv", "key", "get", KKEY, "--binding", BINDING, "--remote"],
    { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" }));
}
/* the public half to the Counter's KV, through its own config: the Counter never sees the sealed half */
export function wrPutPub(jsonPath, exec = execFileSync) {
  return againIfLapsed(() => exec("npx", ["wrangler", "kv", "key", "put", PKEY, "--path", jsonPath, "--binding", "STMT", "--remote", "-c", "wrangler.stmt.jsonc"],
    { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" }));
}
/* THE SLIP KEY IS REFUSED ON THE PLACES' FIRST GROUND, AND ONE MORE: the passphrase must open the live names vault, so every
   envelope shares it and the one unlock opens them all; and a key already filed, in KV or in 10_Data (`copied`), is never
   replaced unasked, since every slip sealed to it would be lost. --force goes past the second, never the first. Answers the
   lines to refuse with, or null to go on; the reads are the suite's way in. */
export async function slipSeedRefusal(pass, readKey = wrGetKey, readNames = wrGet, copied = false, force = false) {
  const got = (read, what) => {
    try { return { j: JSON.parse(read()) }; } catch (e) {
      if (/ - 404:/.test(wranglerSaid(e))) return { j: null };
      return { stop: ["STOPPED: wrangler could not read the live " + what + ". Nothing was pushed.",
        "  wrangler said: " + wranglerSaid(e), "  Timed out: run it again."] };
    }
  };
  const names = got(readNames, "names vault");
  if (names.stop) return names.stop;
  if (names.j && names.j.vault) {
    try { await vaultDecrypt(pass, names.j.vault); } catch (e) {
      return ["REFUSED: this passphrase does not open the names vault, and the slip key is sealed under the same one. Nothing was pushed."];
    }
  }
  if (force) return null;
  const live = got(readKey, "slip key");
  if (live.stop) return live.stop;
  const inKv = !!(live.j && live.j.vault);
  if (!inKv && !copied) return null;
  return ["REFUSED: a slip key is already filed" + (inKv ? ' in KV "' + KKEY + '"' : "") + (inKv && copied ? " and" : "") + (copied ? " in 10_Data\\" + SLIP_COPY : "") + ".",
    "  A new one leaves every slip sealed to it unreadable. Nothing was pushed.",
    "  To finish a run that stopped part way:  node tools/pull-vault.mjs --slip-key   then   node tools/seed-vault.mjs --slip-pub",
    "  To replace it all the same:  node tools/seed-vault.mjs --slip-key --force"];
}
/* the copy in 10_Data is never overwritten: a replaced one is kept beside it under its own moment */
export function keepAside(p) {
  if (!existsSync(p)) return null;
  const to = p.replace(/\.json$/, "_was_" + new Date().toISOString().replace(/[:.]/g, "-") + ".json");
  renameSync(p, to);
  return to;
}
/* what the Counter is given: the public half and its day, never the sealed half */
export const pubRecord = (envelope) => ({ v: 1, updated: envelope.updated || null, pub: jwkPub(envelope.pub) });
async function pushPub(envelope) {
  const tmp = join(REPO, "test", "tmp", "slipkey-push.json");
  mkdirSync(dirname(tmp), { recursive: true });
  writeFileSync(tmp, JSON.stringify(pubRecord(envelope)));
  try { wrPutPub(tmp); return true; } catch (e) {
    console.error("The public half did not reach the Counter's KV: " + wranglerSaid(e));
    console.error("  Run it again, no passphrase needed:  node tools/seed-vault.mjs --slip-pub");
    process.exitCode = 1; return false;
  } finally { try { rmSync(tmp, { force: true }); } catch (e) {} }
}
async function seedSlipKey(pass, dry) {
  const copy = join(DATA, SLIP_COPY);
  const refused = await slipSeedRefusal(pass, wrGetKey, wrGet, existsSync(copy), process.argv.includes("--force"));
  if (refused) { for (const l of refused) console.error(l); process.exit(2); }
  const envelope = await slipKeyMint(pass);
  mkdirSync(join(REPO, "test", "tmp"), { recursive: true });
  if (dry) {
    const out = join(REPO, "test", "tmp", "vault-key-seed.json");
    writeFileSync(out, JSON.stringify(envelope, null, 1));   // the sealed half and the public half only, safe to write
    console.log(`DRY RUN: minted a slip key, sealed and proved. Envelope (ciphertext) at ${out}. Pushed nothing.`);
    return;
  }
  const tmp = join(REPO, "test", "tmp", "vault-key-push.json");
  writeFileSync(tmp, JSON.stringify(envelope));
  try { wrPut(tmp, KKEY); } catch (e) {
    console.error("PUSH FAILED: wrangler could not write the KV key. Nothing was filed.");
    console.error("  wrangler said: " + wranglerSaid(e));
    process.exitCode = 1; return;
  } finally { try { rmSync(tmp, { force: true }); } catch (e) {} }
  let aside = null;
  try { aside = keepAside(copy); mkdirSync(DATA, { recursive: true }); writeFileSync(copy, JSON.stringify(envelope, null, 1) + "\n"); } catch (e) {
    console.error(`The key is in KV "${KKEY}", but its copy could not be written to ${copy}: ${e.message}`);
    console.error("  Finish with:  node tools/pull-vault.mjs --slip-key   then   node tools/seed-vault.mjs --slip-pub");
    process.exitCode = 1; return;
  }
  if (!(await pushPub(envelope))) return;
  console.log(`SEEDED: the slip key, sealed under the vault's passphrase, in KV "${KKEY}"; its copy at ${copy}${aside ? " (the old one kept at " + aside + ")" : ""};`
    + ` the public half on the Counter's KV "${PKEY}". The desk opens the slip key with the names, on the one passphrase.`);
}
async function slipPub() {
  let j = null;
  try { j = JSON.parse(wrGetKey()); } catch (e) { console.error("No slip key could be read: " + wranglerSaid(e)); process.exit(1); }
  if (!j || !j.pub) { console.error("KV holds no slip key; mint one:  node tools/seed-vault.mjs --slip-key"); process.exit(1); }
  if (await pushPub(j)) console.log(`SEEDED: the public half is on the Counter's KV "${PKEY}".`);
}

/* Ask for the passphrase at the terminal without echoing it. Raw mode, so nothing lands in
   shell history, the screen or a transcript; the string lives only in this process. Returns
   null when there is no terminal to ask, and the env-var road below still stands for that. */
function promptHidden(question) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return Promise.resolve(null);
  return new Promise((res) => {
    process.stdout.write(question);
    const chars = [];
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const onData = (buf) => {
      for (const ch of buf.toString("utf8")) {
        if (ch === "\r" || ch === "\n") {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.off("data", onData);
          process.stdout.write("\n");
          return res(chars.join(""));
        }
        if (ch === "\u0003") { process.stdout.write("\n"); process.exit(130); }   // Ctrl-C
        if (ch === "\u007f" || ch === "\b") { chars.pop(); continue; }
        chars.push(ch);
      }
    };
    process.stdin.on("data", onData);
  });
}

async function main(transaction) {
  const dry = process.argv.includes("--dry-run");
  if (process.argv.includes("--slip-pub")) return slipPub();   // F13: the public half alone, no passphrase
  let pass = process.env.SALT_VAULT_PASS;
  if (!pass) {
    /* Asked twice, because a typo here is silent until the phone cannot decrypt a single
       name: the round-trip below proves the crypto, not the spelling. */
    pass = await promptHidden("vault passphrase (hidden): ");
    if (pass != null) {
      const again = await promptHidden("again, to be sure: ");
      if (pass !== again) { console.error("The two entries differ. Nothing was encrypted, nothing was pushed."); process.exit(2); }
      if (!pass) { console.error("An empty passphrase is refused."); process.exit(2); }
    }
  }
  if (!pass) {
    console.error("No terminal to ask, so SET SALT_VAULT_PASS to your passphrase first. It is never stored or printed.");
    console.error('  PowerShell:  $env:SALT_VAULT_PASS="..."; node tools/seed-vault.mjs');
    process.exit(2);
  }
  if (process.argv.includes("--slip-key")) return seedSlipKey(pass, dry);   // F13: the slip key, not the names
  const authority = await readVaultAuthority(process.env.SALT_BASE || "https://salt-command.qyts8mh72kyg.workers.dev",
    globalThis.fetch, process.env.SALT_ACCESS_JWT);
  if (authority.pair) return seedVersioned(pass, dry, transaction);
  if (process.argv.includes("--addr")) return seedAddr(pass, dry);   // F14: the places, not the names
  const { map, ids } = loadBio();
  const named = Object.keys(map).length;
  if (!named) { console.error("No names found in salt_bio.json; nothing to seed."); process.exit(1); }

  if (!process.argv.includes("--force")) {
    const refused = await seedRefusal(pass, map);
    if (refused) { for (const l of refused) console.error(l); process.exit(2); }
  }

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
    await seedLegacyEnvelope(envelope, "names", legacyClient());
    console.log(`SEEDED: ${named} names encrypted and pushed to KV "${VKEY}". The phone can now decrypt them with the passphrase.`);
  } catch (e) {
    console.error("PUSH FAILED: the maintenance-gated names writer did not confirm.");
    console.error("  " + e.message);
    process.exitCode = 1;
  } finally {
    try { rmSync(tmp, { force: true }); } catch (e) {}   // never leave names or the envelope on disk
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  withVaultFiles(DATA, main).catch(error => { console.error(error.message); process.exitCode = 1; });
