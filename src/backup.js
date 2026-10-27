/* src/backup.js: THE NIGHTLY BACKUP OF D1'S DECISIONS (S0b of the Book plan, F9; his word of 25 Oct 2026, "start on S0b backup").
 *
 * D1 holds what git does not: the drafts and their decisions, the pre-approvals, the refusals, the maker requests, the input
 * admissions, and the names and places vault pair. Until this job they were in no export. Once a night the Desk Worker reads those
 * tables in ONE batch (a single transaction, so the dump is one moment, never a row from before a write and a row from after it),
 * seals the lot to a PUBLIC key it holds, and files the ciphertext in R2 under backup/<Kuala Lumpur date>.json. The private half is
 * on his laptop (tools/backup-key.mjs, sealed under the vault passphrase), so nothing on Cloudflare can open a backup, this Worker
 * included, and a leaked bucket reads as noise. The same primitives as a slip (docs/DESK.md, F13): an ephemeral P-256 pair, ECDH,
 * HKDF-SHA-256 (no salt, info "salt-backup v1" so a slip key can never open a backup), AES-GCM-256, {epk, iv, ct} in base64.
 *
 * Not in the dump: entry, state and snapshot (the mirror of git's book, re-seeded at every fold) and the vault's own write gate
 * (flags that would lock a restored database). The newest 30 days stay; the day's key is overwritten if the job runs twice.
 * FAIL CLOSED, AND SAY SO: the object is read back (its size must be what was sent) before the night counts as done, and the result,
 * good or bad, is KV `backup:last`, which the morning digest reads (backupAlarm) so a backup that stops is heard of in a day, not
 * found at a restore. With no bucket or no public key bound the job does nothing and says so; it never invents either.
 * Nothing here imports anything. */
export const BACKUP_TABLES = ["draft", "refused", "preapproval", "maker_request", "input_admission", "input_admission_source",
  "vault_pair", "vault_receipt", "vault_outbox"];
export const BACKUP_CRON = "30 18 * * *";            /* 02:30 in Kuala Lumpur, the quietest hour */
export const BACKUP_KEEP = 30;
export const BACKUP_LAST = "backup:last";
export const BACKUP_STALE_MS = 36 * 3600000;        /* a night missed is heard of at the next morning digest */
export const BACKUP_PREFIX = "backup/";
export const BOOKEXPORT_PREFIX = "bookexport/";
export const BOOKEXPORT_LAST = "bookexport:last";
const INFO = "salt-backup v1";
const ECDH = { name: "ECDH", namedCurve: "P-256" };
const wc = globalThis.crypto;
const b64e = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const b64d = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const jwkPub = (k) => ({ kty: k.kty, crv: k.crv, x: k.x, y: k.y });
const said = (e) => String((e && e.message) || e).replace(/\s+/g, " ").slice(0, 200);   /* a message, never a stack */

async function aes(priv, pubKey) {
  const bits = await wc.subtle.deriveBits({ name: "ECDH", public: pubKey }, priv, 256);
  const hk = await wc.subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  return wc.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: new TextEncoder().encode(INFO) },
    hk, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
export async function backupSeal(pubJwk, bytes) {
  const eph = await wc.subtle.generateKey(ECDH, true, ["deriveBits"]);
  const key = await aes(eph.privateKey, await wc.subtle.importKey("jwk", jwkPub(pubJwk), ECDH, false, []));
  const iv = wc.getRandomValues(new Uint8Array(12));
  const ct = await wc.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes);
  return { epk: b64e(new Uint8Array(await wc.subtle.exportKey("raw", eph.publicKey))), iv: b64e(iv), ct: b64e(new Uint8Array(ct)) };
}
/* the laptop's half (tools/backup-open.mjs) and the suite's; the Worker never calls it */
export async function backupOpen(privKey, sealed) {
  const key = await aes(privKey, await wc.subtle.importKey("raw", b64d(sealed.epk), ECDH, false, []));
  return new Uint8Array(await wc.subtle.decrypt({ name: "AES-GCM", iv: b64d(sealed.iv) }, key, b64d(sealed.ct)));
}

/* every table in one batch: one transaction, one moment. A statement that did not succeed fails the whole dump. */
export async function dumpTables(db) {
  const out = await db.batch(BACKUP_TABLES.map((t) => db.prepare("SELECT * FROM " + t)));
  if (!Array.isArray(out) || out.length !== BACKUP_TABLES.length) throw new Error("the dump batch answered " + (out && out.length) + " results for " + BACKUP_TABLES.length + " tables");
  const tables = {};
  out.forEach((r, i) => {
    if (!r || r.success === false || !Array.isArray(r.results)) throw new Error("the dump of " + BACKUP_TABLES[i] + " did not succeed");
    tables[BACKUP_TABLES[i]] = r.results;
  });
  return tables;
}

export const backupKeyFor = (now) => BACKUP_PREFIX + new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10) + ".json";

function publicKeyOf(env) {
  let k; try { k = JSON.parse(env.BACKUP_PUBLIC_JWK); } catch (e) { throw new Error("BACKUP_PUBLIC_JWK is not JSON"); }
  if (!k || k.kty !== "EC" || k.crv !== "P-256" || typeof k.x !== "string" || typeof k.y !== "string" || "d" in k) throw new Error("BACKUP_PUBLIC_JWK is not a public P-256 key");
  return jwkPub(k);
}

async function prune(bucket, keepKey, prefix = BACKUP_PREFIX) {
  const names = []; let cursor;
  for (;;) {
    const page = await bucket.list({ prefix, cursor });
    for (const o of page.objects || []) names.push(o.key);
    if (!page.truncated) break;
    cursor = page.cursor;
  }
  names.sort();
  const drop = names.slice(0, Math.max(0, names.length - BACKUP_KEEP)).filter((k) => k !== keepKey);
  if (drop.length) await bucket.delete(drop);
  return drop.length;
}

export async function runBackup(env, now = new Date()) {
  if (!env.BACKUP || !env.BACKUP_PUBLIC_JWK || !env.SALT_LEDGER) return { ok: false, skipped: true, why: !env.BACKUP ? "no bucket bound" : !env.BACKUP_PUBLIC_JWK ? "no public key set" : "no database bound" };
  const at = now.toISOString();
  try {
    const pub = publicKeyOf(env);
    const tables = await dumpTables(env.SALT_LEDGER);
    const rows = Object.fromEntries(BACKUP_TABLES.map((t) => [t, tables[t].length]));
    const sealed = await backupSeal(pub, new TextEncoder().encode(JSON.stringify({ v: 1, at, tables })));
    const body = JSON.stringify({ v: 1, app: "salt-backup", at, tables: BACKUP_TABLES, rows, ...sealed });
    const bytes = new TextEncoder().encode(body).length, key = backupKeyFor(now);
    await env.BACKUP.put(key, body, { httpMetadata: { contentType: "application/json" }, customMetadata: { at } });
    const head = await env.BACKUP.head(key);
    if (!head || head.size !== bytes) throw new Error("the object read back " + (head ? head.size : "missing") + " bytes, not the " + bytes + " sent");
    const pruned = await prune(env.BACKUP, key);
    const last = { ok: true, at, key, bytes, rows, pruned };
    if (env.SALT_QUEUE) await env.SALT_QUEUE.put(BACKUP_LAST, JSON.stringify(last));
    return last;
  } catch (e) {
    const last = { ok: false, at, error: said(e) };
    try { if (env.SALT_QUEUE) await env.SALT_QUEUE.put(BACKUP_LAST, JSON.stringify(last)); } catch (ignored) { /* the log below still says it */ }
    return last;
  }
}

/* S5a: THE BOOK'S OWN EXPORT, nightly, beside the D1 dump and sealed to the same public key (same primitives, same info string, so tools/backup-open.mjs opens either). Until S5 the
   Book is a copy of git's book plus the entries a tap booked; after it, it is the only copy, and its only other protection is the platform's 30 days of point-in-time recovery.
   The object carries the base as /read?base=1 answers it, the whole event log (every entry, open, folded or voided, as staged), the revision and the last loads. Read back before the
   night counts; the result is KV `bookexport:last`, which the morning digest reads. With no bucket, key or Book bound it does nothing and says so. */
export const bookExportKeyFor = (now) => BOOKEXPORT_PREFIX + new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10) + ".json";
export async function runBookExport(env, now = new Date()) {
  if (!env.BACKUP || !env.BACKUP_PUBLIC_JWK || !env.BOOK) return { ok: false, skipped: true, why: !env.BACKUP ? "no bucket bound" : !env.BACKUP_PUBLIC_JWK ? "no public key set" : "no Book bound" };
  const at = now.toISOString();
  try {
    const pub = publicKeyOf(env);
    const r = await env.BOOK.get(env.BOOK.idFromName("book")).fetch(new Request("https://book/export"));
    const book = await r.json();
    if (!r.ok || !book || !book.ok) throw new Error("the Book would not export: " + said((book && book.error) || "HTTP " + r.status));
    const entries = book.entries.length;
    const sealed = await backupSeal(pub, new TextEncoder().encode(JSON.stringify({ v: 1, at, book })));
    const body = JSON.stringify({ v: 1, app: "salt-book-export", at, bookV: book.v, rev: book.rev, entries, ...sealed });
    const bytes = new TextEncoder().encode(body).length, key = bookExportKeyFor(now);
    await env.BACKUP.put(key, body, { httpMetadata: { contentType: "application/json" }, customMetadata: { at } });
    const head = await env.BACKUP.head(key);
    if (!head || head.size !== bytes) throw new Error("the object read back " + (head ? head.size : "missing") + " bytes, not the " + bytes + " sent");
    const pruned = await prune(env.BACKUP, key, BOOKEXPORT_PREFIX);
    const last = { ok: true, at, key, bytes, entries, rev: book.rev, bookV: book.v, pruned };
    if (env.SALT_QUEUE) await env.SALT_QUEUE.put(BOOKEXPORT_LAST, JSON.stringify(last));
    return last;
  } catch (e) {
    const last = { ok: false, at, error: said(e) };
    try { if (env.SALT_QUEUE) await env.SALT_QUEUE.put(BOOKEXPORT_LAST, JSON.stringify(last)); } catch (ignored) { /* the log still says it */ }
    return last;
  }
}
export async function bookExportAlarm(env, now = new Date()) {
  if (!env.BACKUP || !env.SALT_QUEUE || !env.BOOK) return null;
  let last = null; try { last = await env.SALT_QUEUE.get(BOOKEXPORT_LAST, "json"); } catch (e) { /* unreadable reads as never run */ }
  if (!last) return "the Book export has never run";
  if (!last.ok) return "the last Book export failed: " + last.error;
  if (now.getTime() - Date.parse(last.at) > BACKUP_STALE_MS) return "the last Book export is more than 36 hours old";
  return null;
}

/* the morning digest's question: a sentence when the backup is not as it should be, else null. Quiet until a bucket is bound. */
export async function backupAlarm(env, now = new Date()) {
  if (!env.BACKUP || !env.SALT_QUEUE) return null;
  let last = null; try { last = await env.SALT_QUEUE.get(BACKUP_LAST, "json"); } catch (e) { /* unreadable reads as never run */ }
  if (!last) return "the backup has never run";
  if (!last.ok) return "the last backup failed: " + last.error;
  if (now.getTime() - Date.parse(last.at) > BACKUP_STALE_MS) return "the last backup is more than 36 hours old";
  return null;
}
