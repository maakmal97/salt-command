#!/usr/bin/env node
/* tools/backup-open.mjs: OPEN A NIGHTLY BACKUP, AND TURN IT BACK INTO ROWS (S0b of the Book plan). LAPTOP ONLY.
 *
 *   node tools/backup-open.mjs <backup.json>                      what it holds: the night, and each table's row count
 *   node tools/backup-open.mjs <backup.json> --out <file.json>    and the opened tables, as plaintext JSON
 *   node tools/backup-open.mjs <backup.json> --sql <file.sql>     and a restore script: INSERT statements, parents before children
 *   ... --sql <file.sql> --replace                                 the script first DELETES each table, children first
 *
 * <backup.json> is an object from the R2 bucket (npx wrangler r2 object get <bucket>/backup/<date>.json --file <backup.json>).
 * The passphrase is asked for here, hidden, and opens 10_Data\salt_backupkey.json (tools/backup-key.mjs). THE OUTPUTS ARE
 * PLAINTEXT: the decisions and the vault pair's ciphertext as the database held them. Write them under test\tmp or %TEMP%,
 * never into the repo or a synced folder, and delete them when the drill or the restore is done; an existing file is never
 * overwritten.
 *
 * A RESTORE IS A DRILL FIRST. Run the script against a scratch D1 or a copy (npx wrangler d1 execute <db> --file <file.sql>),
 * compare it with the live tables, and only then, on his word, against the real one. Without --replace the script only inserts, so
 * it fails on the first row that already exists and changes nothing it cannot add; with --replace it is destructive by design.
 * The git mirror (entry, state, snapshot) is not in a backup: a fold re-seeds it. */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { slipKeyOpen, promptHidden } from "./seed-vault.mjs";
import { backupOpen, BACKUP_TABLES } from "../src/backup.js";
import { KEY_FILE } from "./backup-key.mjs";
import { DATA_DIR } from "./book.mjs";

/* the envelope the Worker filed, opened with the private half: {v, at, tables: {name: [rows]}} */
export async function openBackup(privKey, envelope) {
  if (!envelope || envelope.app !== "salt-backup" || envelope.v !== 1) throw new Error("this is not a salt-backup v1 object");
  const plain = JSON.parse(new TextDecoder().decode(await backupOpen(privKey, envelope)));
  if (!plain || plain.v !== 1 || !plain.tables) throw new Error("the backup opened but holds no tables");
  for (const t of BACKUP_TABLES) if (!Array.isArray(plain.tables[t])) throw new Error("the backup holds no table " + t);
  return plain;
}

/* S5a: the Book's own nightly export (src/backup.js runBookExport), sealed to the same key: {v, at, book: {v, stamped, at, rev, base, entries, loads}} */
export async function openBookExport(privKey, envelope) {
  if (!envelope || envelope.app !== "salt-book-export" || envelope.v !== 1) throw new Error("this is not a salt-book-export v1 object");
  const plain = JSON.parse(new TextDecoder().decode(await backupOpen(privKey, envelope)));
  const b = plain && plain.book;
  if (!plain || plain.v !== 1 || !b || !b.base || !b.base.rows || !b.base.state || !Array.isArray(b.entries)) throw new Error("the Book export opened but holds no base or no event log");
  return plain;
}

const lit = (v) => {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") { if (!Number.isFinite(v)) throw new Error("a non-finite number cannot be restored"); return String(v); }
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "string") return "'" + v.replace(/'/g, "''") + "'";
  throw new Error("a " + typeof v + " cannot be restored");
};

/* the rows as SQL, parents before children (BACKUP_TABLES is in that order); replace deletes first, children first */
export function restoreSql(dump, { replace = false } = {}) {
  const out = ["-- salt-backup restore script for the night of " + dump.at + (replace ? " (REPLACE: deletes every table named below first)" : " (insert only)"), ""];
  if (replace) { for (const t of [...BACKUP_TABLES].reverse()) out.push("DELETE FROM " + t + ";"); out.push(""); }
  for (const t of BACKUP_TABLES)
    for (const row of dump.tables[t]) {
      const cols = Object.keys(row);
      out.push("INSERT INTO " + t + " (" + cols.join(", ") + ") VALUES (" + cols.map((c) => lit(row[c])).join(", ") + ");");
    }
  return out.join("\n") + "\n";
}

async function main() {
  const [file, ...rest] = process.argv.slice(2);
  if (!file || file.startsWith("--")) { console.error("usage: node tools/backup-open.mjs <backup.json> [--out file.json] [--sql file.sql [--replace]]"); process.exit(2); }
  const arg = (flag) => { const i = rest.indexOf(flag); return i < 0 ? null : rest[i + 1]; };
  const outFile = arg("--out"), sqlFile = arg("--sql"), replace = rest.includes("--replace");
  for (const f of [outFile, sqlFile].filter(Boolean)) if (existsSync(f)) { console.error("REFUSED: " + f + " exists; this tool never overwrites."); process.exit(1); }
  const keyFile = join(process.env.SALT_DATA || DATA_DIR, KEY_FILE);
  if (!existsSync(keyFile)) { console.error("REFUSED: no backup key at " + keyFile + ". It is minted by tools/backup-key.mjs."); process.exit(1); }
  const pass = process.env.SALT_VAULT_PASS || await promptHidden("vault passphrase (hidden): ");
  if (!pass) { console.error("No terminal to ask, so SET SALT_VAULT_PASS first. It is never stored or printed."); process.exit(2); }
  const key = JSON.parse(readFileSync(keyFile, "utf8"));
  const envelope = JSON.parse(readFileSync(file, "utf8"));
  if (envelope && envelope.app === "salt-book-export") {
    const ex = await openBookExport(await slipKeyOpen(pass, key.vault), envelope), b = ex.book;
    console.log("OPENED: the Book export of " + ex.at + ", version " + b.v + ", revision " + b.rev + ".");
    for (const [c, rows] of Object.entries(b.base.rows)) console.log("  " + c.padEnd(24) + String(rows.length).padStart(7) + " row(s)");
    console.log("  entries (the event log)".padEnd(26) + String(b.entries.length).padStart(5) + ", open " + b.entries.filter((e) => !e.folded_at && !e.voided_at).length + ", folded " + b.entries.filter((e) => e.folded_at).length + ", voided " + b.entries.filter((e) => e.voided_at).length);
    if (outFile) { writeFileSync(outFile, JSON.stringify(ex, null, 1), { flag: "wx" }); console.log("WROTE (plaintext): " + outFile); }
    return;
  }
  const dump = await openBackup(await slipKeyOpen(pass, key.vault), envelope);
  console.log("OPENED: the backup of " + dump.at + ".");
  for (const t of BACKUP_TABLES) console.log("  " + t.padEnd(24) + String(dump.tables[t].length).padStart(7) + " row(s)");
  if (outFile) { writeFileSync(outFile, JSON.stringify(dump, null, 1), { flag: "wx" }); console.log("WROTE (plaintext): " + outFile); }
  if (sqlFile) { writeFileSync(sqlFile, restoreSql(dump, { replace }), { flag: "wx" }); console.log("WROTE (plaintext): " + sqlFile + (replace ? "  (REPLACE)" : "  (insert only)")); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((e) => { console.error(e.message); process.exitCode = 1; });
