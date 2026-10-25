/* test/backup-tools.mjs: S0b of the Book plan. THE LAPTOP'S HALF: the key that opens a backup, and the drill that turns one back
 * into rows (tools/backup-key.mjs, tools/backup-open.mjs).
 *
 * The drill is the point: a real migrated SQLite is filled, backed up through the real Worker code to a fake bucket, opened with the
 * key the tool minted, turned into a restore script, and the script is run into a second, empty, migrated SQLite. Every table must come
 * back identical, including a value with quotes, a line break, an accent and a null. Every check was proved red by its own mutation
 * (test/backup-tools.mutations.json, run with tools/section.mjs). Every code, name and word here is invented. */
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

class KV { constructor() { this.m = new Map(); } async put(k, v) { this.m.set(k, v); } async get(k, t) { if (!this.m.has(k)) return null; const r = this.m.get(k); return t === "json" ? JSON.parse(r) : r; } }
class R2 {
  constructor() { this.m = new Map(); }
  async put(k, b) { this.m.set(k, b); }
  async head(k) { const b = this.m.get(k); return b === undefined ? null : { size: new TextEncoder().encode(b).length }; }
  async list({ prefix = "" } = {}) { return { objects: [...this.m.keys()].filter((k) => k.startsWith(prefix)).sort().map((key) => ({ key })), truncated: false }; }
  async delete() {}
}

export async function run({ ok }) {
  const K = await import("../tools/backup-key.mjs"), O = await import("../tools/backup-open.mjs"), B = await import("../src/backup.js");
  const { vaultEncrypt, slipKeyOpen } = await import("../tools/seed-vault.mjs");
  const J = JSON.stringify, PASS = "a passphrase for the suite only", NOW = new Date("2026-10-24T18:30:00Z");
  const dir = mkdtempSync(join(tmpdir(), "backup-tools-"));
  try {
    /* A. THE KEY */
    const file = await K.mintBackupKey(PASS);
    ok(file.v === 1 && J(Object.keys(file.pub).sort()) === J(["crv", "kty", "x", "y"]) && !("d" in file.pub) && !/"d":/.test(J(file)) && file.vault.ct && file.vault.salt,
      "the key file holds a public half with no private part and the private half only as the passphrase's ciphertext: " + J(Object.keys(file)));
    const priv = await slipKeyOpen(PASS, file.vault);
    let wrongPass = "opened"; try { await slipKeyOpen("not the passphrase", file.vault); } catch (e) { wrongPass = "refused"; }
    ok(priv && priv.type === "private" && wrongPass === "refused", "the sealed private half opens with the passphrase and with nothing else");
    const probe = crypto.getRandomValues(new Uint8Array(40)), back = await B.backupOpen(priv, await B.backupSeal(file.pub, probe));
    ok(Buffer.compare(Buffer.from(back), Buffer.from(probe)) === 0, "a probe sealed to the public half with the backup protocol opens with the unsealed private half");

    /* B. WHAT THE MINT REFUSES */
    const names = await vaultEncrypt(PASS, { "CZ4-MK": "Test Person (Test Place)" });
    const pairOf = (n) => J({ ok: true, revision: 1, names: n, places: names, updated: "2026-10-24T00:00:00.000Z" });
    const dNo = mkdtempSync(join(dir, "no-pair-"));
    const rNo = await K.backupKeyRefusal(PASS, { dir: dNo });
    ok(Array.isArray(rNo) && /no local copy of the vault pair/.test(rNo[0]), "with no local vault pair there is nothing to check the passphrase against, so it refuses: " + J(rNo));
    const dPair = mkdtempSync(join(dir, "pair-")); writeFileSync(join(dPair, "salt_vault_pair.json"), pairOf(names));
    const rBad = await K.backupKeyRefusal("a different passphrase", { dir: dPair });
    ok(Array.isArray(rBad) && /does not open the names vault/.test(rBad[0]), "a passphrase that does not open the names vault is refused, so a typo cannot seal a key nobody can open: " + J(rBad));
    ok((await K.backupKeyRefusal(PASS, { dir: dPair })) === null, "the right passphrase and no key on file goes ahead");
    writeFileSync(join(dPair, K.KEY_FILE), J(file));
    const rHave = await K.backupKeyRefusal(PASS, { dir: dPair });
    ok(Array.isArray(rHave) && /already filed/.test(rHave[0]) && /unreadable/.test(rHave.join(" ")), "a key already on file is never replaced unasked: a new one would leave every backup unreadable: " + J(rHave));
    ok((await K.backupKeyRefusal(PASS, { dir: dPair, force: true })) === null, "--force goes past that one refusal");

    /* C. THE RESTORE DRILL */
    const migrated = () => {
      const db = new DatabaseSync(":memory:"), m = new URL("../migrations/", import.meta.url);
      for (const f of readdirSync(m).filter((x) => /^\d+_.*\.sql$/.test(x)).sort()) db.exec(readFileSync(new URL(f, m), "utf8"));
      return db;
    };
    const TABLES = B.BACKUP_TABLES, all = (db, t) => db.prepare("SELECT * FROM " + t).all(), same = (a, b) => TABLES.every((t) => J(all(a, t)) === J(all(b, t)));
    const db1 = migrated(), ins = (sql, ...a) => db1.prepare(sql).run(...a);
    const TRICKY = "it's a \"quoted\" line\nand a second line, with an accent: café, and a semicolon; --not a comment";
    ins("INSERT INTO draft(id,status,collection,entry,row,reasoning,drafter,drafted_at,party,qty,total) VALUES (?,?,?,?,?,?,?,?,?,?,?)", "d1", "approved", "sales", J({ n: 1 }), J({ note: TRICKY }), TRICKY, "arith", "2026-10-24T01:00:01Z", null, 2.5, 1234.56);
    ins("INSERT INTO draft(id,status,collection,entry,row,reasoning,drafter,drafted_at) VALUES (?,?,?,?,?,?,?,?)", "d2", "pending", "sales", "{}", "{}", "why", "arith", "2026-10-24T02:00:01Z");
    ins("INSERT INTO refused(id,entry,why,source,seen_at) VALUES (?,?,?,?,?)", "r1", "{}", "twin", "queue", "2026-10-24T03:00:00Z");
    ins("INSERT INTO preapproval(id,order_id,stage,hash,shown,at) VALUES (?,?,?,?,?,?)", "p1", "o-1", "ack", "h1", "{}", "2026-10-24T04:00:00Z");
    ins("INSERT INTO maker_request(id,operation,fingerprint) VALUES (?,?,?)", "m1", "hush", "f1");
    ins("INSERT INTO input_admission(id,fingerprint,resource,amount,snapshot,entry) VALUES (?,?,?,?,?,?)", "a1", "f2", "salt", 5, "s", "{}");
    ins("INSERT INTO input_admission_source(id,source) VALUES (?,?)", "a1", "src1");
    ins("INSERT INTO vault_pair(one,revision,names,places,updated) VALUES (1,?,?,?,?)", 3, J({ v: 1, ct: "AAAA" }), null, "2026-10-24T05:00:00Z");
    ins("INSERT INTO vault_receipt(id,fingerprint,revision,created_at,operation) VALUES (?,?,?,?,?)", "v1", "f3", 3, "2026-10-24T05:00:00Z", "seed");
    ins("INSERT INTO vault_outbox(id,entry) VALUES (?,?)", "v1", "{}");
    const d1 = { prepare(sql) { const st = db1.prepare(sql); return { all: () => ({ results: st.all(), success: true }) }; },
      batch(s) { db1.exec("BEGIN"); try { const o = s.map((x) => x.all()); db1.exec("COMMIT"); return o; } catch (e) { db1.exec("ROLLBACK"); throw e; } } };
    const r2 = new R2(), res = await B.runBackup({ SALT_LEDGER: d1, SALT_QUEUE: new KV(), BACKUP: r2, BACKUP_PUBLIC_JWK: J(file.pub) }, NOW);
    const envelope = JSON.parse(r2.m.get(res.key));
    const dump = await O.openBackup(priv, envelope);
    ok(res.ok && dump.at === NOW.toISOString() && TABLES.every((t) => J(dump.tables[t]) === J(all(db1, t))),
      "a backup made by the Worker's code opens with the key the tool minted, and holds every table as the database held it: " + J(res.ok ? res.rows : res));
    const sql = O.restoreSql(dump), db2 = migrated();
    const exec = (db, text) => { try { db.exec(text); return "ran"; } catch (e) { return "threw: " + e.message; } };
    const first = exec(db2, sql);
    ok(first === "ran" && same(db1, db2) && all(db2, "draft").some((r) => r.reasoning === TRICKY), "THE DRILL: the restore script run into an empty, migrated database brings back every table identically, quotes, line break, accent and null included: " + first);
    const twice = exec(db2, sql);
    ok(/^threw/.test(twice) && same(db1, db2), "run again without --replace it fails on the first row that exists and changes nothing");
    db2.prepare("UPDATE draft SET status='rejected' WHERE id='d1'").run(); db2.prepare("DELETE FROM vault_outbox").run();
    ok(!same(db1, db2), "(the copy is now changed, so the next check means something)");
    const replaced = exec(db2, O.restoreSql(dump, { replace: true }));
    ok(replaced === "ran" && same(db1, db2), "with --replace the script deletes children first and inserts parents first, and a changed copy is put back exactly: " + replaced);
    const rep = O.restoreSql(dump, { replace: true }), plain = O.restoreSql(dump);
    ok(plain.startsWith("-- salt-backup restore script for the night of 2026-10-24T18:30:00.000Z (insert only)") && rep.includes("(REPLACE: deletes every table named below first)"),
      "the script says which night it restores and whether it deletes, in its first line");
    ok(!/DELETE/.test(plain) && rep.indexOf("DELETE FROM vault_outbox;") < rep.indexOf("DELETE FROM vault_receipt;") && rep.indexOf("DELETE FROM input_admission_source;") < rep.indexOf("DELETE FROM input_admission;"),
      "the insert-only script has no DELETE, and the replace script deletes a child table before its parent");
    ok(plain.indexOf("INSERT INTO input_admission (") < plain.indexOf("INSERT INTO input_admission_source (") && plain.indexOf("INSERT INTO vault_receipt (") < plain.indexOf("INSERT INTO vault_outbox ("),
      "parents are inserted before their children");

    /* D. WHAT OPENING AND RESTORING REFUSE */
    let foreign = "opened"; try { await O.openBackup(priv, { ...envelope, app: "something-else" }); } catch (e) { foreign = "refused"; }
    let v2 = "opened"; try { await O.openBackup(priv, { ...envelope, v: 2 }); } catch (e) { v2 = "refused"; }
    ok(foreign === "refused" && v2 === "refused", "an object that is not a salt-backup v1 is refused before anything is opened");
    const ct = envelope.ct, flipped = ct.slice(0, 20) + (ct[20] === "A" ? "B" : "A") + ct.slice(21);
    let tampered = "opened"; try { await O.openBackup(priv, { ...envelope, ct: flipped }); } catch (e) { tampered = "refused"; }
    ok(tampered === "refused", "a backup with one character of its ciphertext changed does not open: the seal authenticates");
    const thin = { v: 1, at: "x", tables: Object.fromEntries(TABLES.slice(1).map((t) => [t, []])) };
    let missing = "opened"; try { await O.openBackup(priv, { ...envelope, ...(await B.backupSeal(file.pub, new TextEncoder().encode(J(thin)))) }); } catch (e) { missing = /no table draft/.test(e.message) ? "refused" : "other: " + e.message; }
    ok(missing === "refused", "a backup that opens but lacks a table is refused by name, not restored short: " + missing);
    const bad = (v) => { try { O.restoreSql({ at: "x", tables: { ...Object.fromEntries(TABLES.map((t) => [t, []])), draft: [{ id: v }] } }); return "written"; } catch (e) { return "refused"; } };
    ok(bad(NaN) === "refused" && bad(Infinity) === "refused" && bad({ a: 1 }) === "refused" && bad(Buffer.from("x")) === "refused" && bad("fine") === "written",
      "a value a script cannot carry exactly (NaN, a non-finite number, an object, bytes) stops the script rather than being written as something else");
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
