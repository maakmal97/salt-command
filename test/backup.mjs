/* test/backup.mjs: S0b of the Book plan. THE NIGHTLY BACKUP OF D1'S DECISIONS (src/backup.js).
 *
 * The migrations are applied to a real in-memory SQLite, so the table list is checked against the schema and the dump is a real
 * transaction; R2 and KV are small fakes that can be made to fail. Every check was proved red by its own mutation
 * (test/backup.mutations.json, run with tools/section.mjs). Every id, code and word here is invented. */
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";

class KV {
  constructor() { this.m = new Map(); this.puts = 0; }
  async put(k, v) { this.m.set(k, v); this.puts++; }
  async get(k, type) { if (!this.m.has(k)) return null; const raw = this.m.get(k); return type === "json" ? JSON.parse(raw) : raw; }
}
class R2 {
  constructor(page = 10) { this.m = new Map(); this.page = page; this.deletes = []; this.failPut = false; this.shortHead = false; this.puts = 0; }
  async put(k, body) {
    if (this.failPut) { const e = new Error("R2 refused the write\nsecond line " + "z".repeat(400)); e.stack = "Error: x\n    at secretStackFrame (file:///x.js:1:1)"; throw e; }
    this.m.set(k, body); this.puts++;
  }
  async head(k) { const b = this.m.get(k); return b === undefined ? null : { size: new TextEncoder().encode(b).length - (this.shortHead ? 1 : 0) }; }
  async list({ prefix = "", cursor } = {}) {
    const keys = [...this.m.keys()].filter((k) => k.startsWith(prefix)).sort(), from = cursor ? +cursor : 0;
    return { objects: keys.slice(from, from + this.page).map((key) => ({ key })), truncated: from + this.page < keys.length, cursor: String(from + this.page) };
  }
  async delete(keys) { for (const k of [].concat(keys)) { this.m.delete(k); this.deletes.push(k); } }
}

export async function run({ ok }) {
  const B = await import("../src/backup.js");
  const { slipOpen } = await import("../tools/seed-vault.mjs");
  const ECDH = { name: "ECDH", namedCurve: "P-256" };
  const pair = await crypto.subtle.generateKey(ECDH, true, ["deriveBits"]);
  const privJwk = await crypto.subtle.exportKey("jwk", pair.privateKey), pubJwk = { kty: privJwk.kty, crv: privJwk.crv, x: privJwk.x, y: privJwk.y };
  const J = JSON.stringify, CANARY = "CANARY-PLAINTEXT-7731";
  const NOW = new Date("2026-10-24T18:30:00Z");   /* 02:30 on 25 Oct in Kuala Lumpur */

  /* a real schema, a few invented rows in every table, and a D1 that counts its batches and can be told to fail one */
  const world = async (opts = {}) => {
    const db = new DatabaseSync(":memory:"), dir = new URL("../migrations/", import.meta.url);
    for (const f of readdirSync(dir).filter((x) => /^\d+_.*\.sql$/.test(x)).sort()) db.exec(readFileSync(new URL(f, dir), "utf8"));
    const ins = (sql, ...a) => db.prepare(sql).run(...a);
    ins("INSERT INTO draft(id,status,collection,entry,row,reasoning,drafter,drafted_at) VALUES (?,?,?,?,?,?,?,?)", "2026-10-24T01:00:00Z", "approved", "sales", J({ n: 1 }), J({ note: CANARY }), "why", "arith", "2026-10-24T01:00:01Z");
    ins("INSERT INTO draft(id,status,collection,entry,row,reasoning,drafter,drafted_at) VALUES (?,?,?,?,?,?,?,?)", "2026-10-24T02:00:00Z", "pending", "sales", J({ n: 2 }), J({}), "why", "arith", "2026-10-24T02:00:01Z");
    ins("INSERT INTO refused(id,entry,why,source,seen_at) VALUES (?,?,?,?,?)", "r1", J({}), "twin", "queue", "2026-10-24T03:00:00Z");
    ins("INSERT INTO preapproval(id,order_id,stage,hash,shown,at) VALUES (?,?,?,?,?,?)", "p1", "o-1", "ack", "h1", J({ shown: CANARY }), "2026-10-24T04:00:00Z");
    ins("INSERT INTO maker_request(id,operation,fingerprint) VALUES (?,?,?)", "m1", "hush", "f1");
    ins("INSERT INTO input_admission(id,fingerprint,resource,amount,snapshot,entry) VALUES (?,?,?,?,?,?)", "a1", "f2", "salt", 5, "s", J({}));
    ins("INSERT INTO input_admission_source(id,source) VALUES (?,?)", "a1", "src1");
    ins("INSERT INTO vault_pair(one,revision,names,places,updated) VALUES (1,?,?,?,?)", 3, J({ v: 1, ct: "AAAA-names" }), J({ v: 1, ct: "BBBB-places" }), "2026-10-24T05:00:00Z");
    ins("INSERT INTO vault_receipt(id,fingerprint,revision,created_at,operation) VALUES (?,?,?,?,?)", "v1", "f3", 3, "2026-10-24T05:00:00Z", "seed");
    ins("INSERT INTO vault_outbox(id,entry) VALUES (?,?)", "v1", J({}));
    const d1 = { batches: 0, failIndex: -1,
      prepare(sql) { const st = db.prepare(sql); return { sql, all: () => ({ results: st.all(), success: true }) }; },
      batch(stmts) { d1.batches++; db.exec("BEGIN"); try { const out = stmts.map((s, i) => { const r = s.all(); if (i === d1.failIndex) r.success = false; return r; }); db.exec("COMMIT"); return out; } catch (e) { db.exec("ROLLBACK"); throw e; } } };
    const kv = new KV(), r2 = new R2(opts.page);
    const env = { SALT_LEDGER: d1, SALT_QUEUE: kv, BACKUP: r2, BACKUP_PUBLIC_JWK: J(pubJwk) };
    const direct = (t) => db.prepare("SELECT * FROM " + t).all();
    return { db, d1, kv, r2, env, direct };
  };
  const NINE = ["draft", "refused", "preapproval", "maker_request", "input_admission", "input_admission_source", "vault_pair", "vault_receipt", "vault_outbox"];

  /* A. WHAT IS BACKED UP */
  const w0 = await world();
  const have = new Set(w0.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name));
  ok(J(B.BACKUP_TABLES) === J(NINE) && NINE.every((t) => have.has(t)),
    "the backup covers exactly the nine tables that hold decisions and the vault pair, and every one is in the migrated schema: " + J(B.BACKUP_TABLES));
  ok(!["entry", "state", "snapshot", "vault_write_gate", "vault_write_active", "vault_maintenance"].some((t) => B.BACKUP_TABLES.includes(t)),
    "the git mirror and the vault's write-gate flags are not backed up: a restored flag would lock the database, and the mirror is re-seeded at every fold");
  const a = await B.runBackup(w0.env, NOW);
  ok(a.ok === true && w0.d1.batches === 1, "the dump is ONE batch, one transaction, so it is one moment: " + J({ ok: a.ok, batches: w0.d1.batches, err: a.error }));
  ok(a.key === "backup/2026-10-25.json" && w0.r2.m.has("backup/2026-10-25.json") && w0.r2.m.size === 1,
    "the object is filed under the Kuala Lumpur date, not the UTC one: " + J(a.key));
  ok(J(a.rows) === J(Object.fromEntries(NINE.map((t) => [t, w0.direct(t).length]))) && a.rows.draft === 2 && a.rows.vault_pair === 1,
    "the result counts every table's rows as the database holds them: " + J(a.rows));

  /* B. SEALED TO A PUBLIC KEY, OPENED ONLY BY THE PRIVATE ONE */
  const stored = w0.r2.m.get(a.key), env0 = JSON.parse(stored);
  const priv = await crypto.subtle.importKey("jwk", privJwk, ECDH, false, ["deriveBits"]);
  const back = JSON.parse(new TextDecoder().decode(await B.backupOpen(priv, env0)));
  ok(NINE.every((t) => J(back.tables[t]) === J(w0.direct(t))) && back.at === NOW.toISOString() && back.v === 1,
    "opened with the private half, the object returns every table exactly as the database holds it, stamped with the moment of the run");
  ok(!stored.includes(CANARY) && !stored.includes("AAAA-names") && !stored.includes("2026-10-24T01:00:00Z"),
    "the stored object holds no plaintext: no row text, no id, no timestamp of a row, not even the vault's own ciphertext");
  ok(env0.app === "salt-backup" && J(env0.tables) === J(NINE) && env0.rows.draft === 2 && env0.v === 1,
    "the clear header names the tables and counts the rows, and says nothing else of the content");
  ok(b64len(env0.iv) === 12 && b64len(env0.epk) === 65, "the iv is 12 bytes and the ephemeral key a 65-byte uncompressed P-256 point: " + J([b64len(env0.iv), b64len(env0.epk)]));
  const other = await crypto.subtle.generateKey(ECDH, true, ["deriveBits"]);
  let wrong = "opened"; try { await B.backupOpen(other.privateKey, env0); } catch (e) { wrong = "refused"; }
  ok(wrong === "refused", "another key cannot open the backup");
  let asSlip = "opened"; try { await slipOpen(priv, { epk: env0.epk, iv: env0.iv, ct: env0.ct }); } catch (e) { asSlip = "refused"; }
  ok(asSlip === "refused", "the slip protocol cannot open a backup even with the right private key: the HKDF label is the backup's own");

  /* C. WHAT IT REFUSES TO DO */
  const w1 = await world(); delete w1.env.BACKUP;
  const s1 = await B.runBackup(w1.env, NOW);
  ok(s1.ok === false && s1.skipped === true && w1.kv.puts === 0 && w1.d1.batches === 0,
    "with no bucket bound the job does nothing and says so: it reads nothing and writes nothing, not even a failure record: " + J(s1));
  const w2 = await world(); delete w2.env.BACKUP_PUBLIC_JWK;
  const s2 = await B.runBackup(w2.env, NOW);
  ok(s2.skipped === true && w2.r2.puts === 0, "with no public key set it files nothing: " + J(s2));
  const w3 = await world(); w3.env.BACKUP_PUBLIC_JWK = J(privJwk);
  const s3 = await B.runBackup(w3.env, NOW);
  ok(s3.ok === false && w3.r2.puts === 0 && /public/.test(s3.error), "a PRIVATE key pasted into the public setting is refused, and nothing is filed: " + J(s3));
  const w4 = await world(); w4.d1.failIndex = 4;
  const s4 = await B.runBackup(w4.env, NOW);
  ok(s4.ok === false && w4.r2.puts === 0 && /input_admission/.test(s4.error), "a table that did not read back fails the whole dump, naming it, and files nothing: " + J(s4));
  const w5 = await world(); w5.r2.shortHead = true;
  const s5 = await B.runBackup(w5.env, NOW);
  ok(s5.ok === false && /read back/.test(s5.error) && w5.r2.deletes.length === 0, "an object whose size is not what was sent is a failed night, not a good one: " + J(s5));

  /* D. A FAILED NIGHT IS RECORDED, KEEPS THE OLD BACKUPS, AND LEAKS NO STACK */
  const w6 = await world();
  for (let i = 0; i < 35; i++) await w6.r2.put("backup/2026-09-" + String(i + 1).padStart(2, "0") + ".json", "x");
  w6.r2.failPut = true; w6.r2.puts = 0;
  const f6 = await B.runBackup(w6.env, NOW), rec6 = await w6.kv.get(B.BACKUP_LAST, "json");
  ok(f6.ok === false && rec6 && rec6.ok === false && rec6.error === f6.error && w6.r2.deletes.length === 0 && w6.r2.m.size === 35,
    "a failed write is recorded in KV and prunes nothing: the old backups are what a restore would need: " + J({ deletes: w6.r2.deletes.length, size: w6.r2.m.size }));
  ok(!/\n/.test(f6.error) && f6.error.length <= 200 && !/secretStackFrame/.test(f6.error), "the recorded error is one line of at most 200 characters, never a stack");

  /* E. RETENTION AND REPEAT RUNS */
  const w7 = await world(5);
  for (let i = 0; i < 35; i++) await w7.r2.put("backup/2026-09-" + String(i + 1).padStart(2, "0") + ".json", "x");
  const r7 = await B.runBackup(w7.env, NOW), kept = [...w7.r2.m.keys()].sort();
  ok(r7.ok && kept.length === 30 && kept.includes("backup/2026-10-25.json") && !kept.includes("backup/2026-09-01.json") && kept.includes("backup/2026-09-35.json") && r7.pruned === 6,
    "the newest 30 stay across several pages of the listing, and the oldest six go: " + J({ kept: kept.length, pruned: r7.pruned }));
  const again = await B.runBackup(w7.env, new Date(NOW.getTime() + 600000));
  ok(again.ok && [...w7.r2.m.keys()].filter((k) => k === "backup/2026-10-25.json").length === 1 && w7.r2.m.size === 30, "a second run the same night overwrites the night's object and adds none");
  const rec = await w7.kv.get(B.BACKUP_LAST, "json");
  ok(rec.ok === true && rec.key === "backup/2026-10-25.json" && rec.bytes === new TextEncoder().encode(w7.r2.m.get(rec.key)).length && rec.rows.draft === 2,
    "the success record in KV carries the key, the byte count the bucket confirmed and the row counts: " + J(rec));

  /* F. THE MORNING DIGEST HEARS OF IT */
  const wA = await world(); delete wA.env.BACKUP;
  ok((await B.backupAlarm(wA.env, NOW)) === null, "with no bucket the alarm is silent: nothing was promised");
  const wB = await world();
  ok(/never run/.test(await B.backupAlarm(wB.env, NOW) || ""), "a bucket and no record reads as a backup that has never run");
  await wB.kv.put(B.BACKUP_LAST, J({ ok: false, at: NOW.toISOString(), error: "R2 said no" }));
  ok(/failed: R2 said no/.test(await B.backupAlarm(wB.env, NOW) || ""), "a failed last night is said, with its reason, even when it is fresh");
  await wB.kv.put(B.BACKUP_LAST, J({ ok: true, at: new Date(NOW.getTime() - 40 * 3600000).toISOString() }));
  ok(/36 hours/.test(await B.backupAlarm(wB.env, NOW) || ""), "a good record 40 hours old is said to be stale");
  await wB.kv.put(B.BACKUP_LAST, J({ ok: true, at: new Date(NOW.getTime() - 30 * 3600000).toISOString() }));
  ok((await B.backupAlarm(wB.env, NOW)) === null, "a good record 30 hours old is a night, not an alarm");
}
const b64len = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)).length;
