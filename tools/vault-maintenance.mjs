import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdtempSync, unlinkSync, rmdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { readVaultPair, sealedVaultEnvelope } from "../src/vault-pair.js";
import { vaultWriteStatus, changeVaultWritePhase } from "../src/vault-write-gate.js";
import { execFileSync } from "node:child_process";
import { againIfLapsed } from "./cloudflare.mjs";
import { oneLine } from "./d1json.mjs";

const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const literal = (value) => "'" + String(value).replaceAll("'", "''") + "'";
const canonicalAt = (value) => typeof value === "string" && Number.isFinite(Date.parse(value))
  && new Date(value).toISOString() === value;

export function bootstrapPlan(first, second, at) {
  if (!canonicalAt(at) || !first || !second || digest(first) !== digest(second)
    || !sealedVaultEnvelope(first.names) || first.places !== null && !sealedVaultEnvelope(first.places)
    || Object.keys(first).some((key) => !["names", "places"].includes(key)))
    throw new Error("Bootstrap requires two identical, bounded ciphertext pair reads and a canonical timestamp.");
  if (JSON.stringify(first).length > 1048576) throw new Error("Bootstrap pair exceeds the request limit.");
  return { digest: digest(first), revision: 1, sql:
    "INSERT INTO vault_pair(one,revision,names,places,updated) SELECT 1,1,"
    + literal(JSON.stringify(first.names)) + "," + (first.places === null ? "NULL" : literal(JSON.stringify(first.places)))
    + "," + literal(at) + " WHERE EXISTS (SELECT 1 FROM vault_write_gate WHERE one=1 AND phase='paused')"
    + " AND NOT EXISTS (SELECT 1 FROM vault_write_active)"
    + " AND NOT EXISTS (SELECT 1 FROM vault_outbox WHERE state='pending');\n"
    + "SELECT revision,names,places,updated FROM vault_pair WHERE one=1;\n" };
}

export async function rollbackExport(db) {
  const pair = await readVaultPair(db);
  if (!pair.ok) throw new Error(pair.error);
  return { purpose: "reviewed-rollback-export", pair, digest: digest(pair) };
}

export async function pruneReceipts(db, before, now, apply = false) {
  if (!canonicalAt(before) || !canonicalAt(now) || Date.parse(now) - Date.parse(before) < 30 * 86400000)
    throw new Error("Pruning requires a canonical cutoff at least thirty days old.");
  const pending = await db.prepare("SELECT COUNT(*) AS n FROM vault_outbox WHERE state='pending' AND id<=?1").bind(before).first();
  if (pending.n) throw new Error("Pending vault outbox entries prevent advancing the receipt floor. Recover them first.");
  const count = await db.prepare("SELECT COUNT(*) AS n FROM vault_receipt WHERE id<=?1").bind(before).first();
  if (apply) await db.batch([
    db.prepare("UPDATE vault_maintenance SET receipt_floor=MAX(receipt_floor,?1) WHERE one=1").bind(before),
    db.prepare("DELETE FROM vault_outbox WHERE state='complete' AND id<=?1").bind(before),
    db.prepare("DELETE FROM vault_receipt WHERE id<=?1 AND NOT EXISTS (SELECT 1 FROM vault_outbox WHERE vault_outbox.id=vault_receipt.id)").bind(before)
  ]);
  return { ok: true, apply, receipts: count.n, receiptFloor: before };
}

export function sqliteAdapter(sqlite) {
  return {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      const bound = (args) => ({ first: async () => statement.get(...args) || null,
        all: async () => ({ results: statement.all(...args) }),
        run: async () => ({ meta: { changes: Number(statement.run(...args).changes) } }) });
      return { ...bound([]), bind: (...args) => bound(args) };
    },
    async batch(statements) {
      sqlite.exec("BEGIN IMMEDIATE");
      try { const result = []; for (const statement of statements) result.push(await statement.run());
        sqlite.exec("COMMIT"); return result; }
      catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    }
  };
}

async function main(args) {
  const [operation, ...rest] = args;
  const option = (key) => { const at = rest.indexOf(key); return at < 0 ? undefined : rest[at + 1]; };
  const output = option("--output");
  if (!output) throw new Error("An explicit --output ciphertext report path is required.");
  if (operation === "gate") {
    const phase = option("--phase"), at = new Date().toISOString();
    if (rest.includes("--apply-remote") || rest.includes("--read-remote")) {
      if (rest.includes("--apply-remote") && (!rest.includes("--writers-paused") || !["open", "draining", "paused"].includes(phase)))
        throw new Error("Remote gate changes require an explicit phase and --writers-paused account-operator acknowledgement.");
      const query = (sql, writing = false) => {
        let directory, file;
        if (writing) {
          directory = mkdtempSync(join(tmpdir(), "salt-vault-gate-"));
          file = join(directory, "phase.sql");
          writeFileSync(file, sql + "\n", { mode: 0o600 });
        }
        let text;
        try {
          text = againIfLapsed(() => execFileSync("npx", ["wrangler", "d1", "execute", "salt_ledger", "--remote", "--json",
            ...(writing ? ["--file", process.platform === "win32" ? '"' + file + '"' : file]
              : ["--command", process.platform === "win32" ? JSON.stringify(oneLine(sql)) : sql])],
            { encoding: "utf8", shell: process.platform === "win32" }));
        } finally {
          if (file) { unlinkSync(file); rmdirSync(directory); }
        }
        const result = JSON.parse(text.slice(text.indexOf("[")));
        if (result.some(row => row.success !== true)) throw new Error("The remote gate operation was not confirmed.");
        return result.at(-1).results;
      };
      if (rest.includes("--apply-remote")) {
        const sql = phase === "paused"
          ? `UPDATE vault_write_gate SET phase='paused',updated=${literal(at)} WHERE one=1 AND phase='draining'`
            + " AND NOT EXISTS (SELECT 1 FROM vault_write_active)"
            + " AND NOT EXISTS (SELECT 1 FROM vault_outbox WHERE state='pending');"
          : `UPDATE vault_write_gate SET phase=${literal(phase)},updated=${literal(at)} WHERE one=1;`;
        query(sql, true);
      }
      const state = query("SELECT phase,updated,(SELECT COUNT(*) FROM vault_write_active) AS active FROM vault_write_gate WHERE one=1;")[0];
      if (!state || rest.includes("--apply-remote") && state.phase !== phase)
        throw new Error("The gate readback did not confirm the requested phase; it has not been reopened automatically.");
      writeFileSync(output, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
      console.log("Remote gate readback: " + state.phase + "; active writers " + state.active + ". No authority switch.");
      return;
    }
    if (!option("--database")) throw new Error("Gate needs --database, --read-remote or explicit --apply-remote.");
    const apply = rest.includes("--apply-local");
    if (apply && !rest.includes("--writers-paused")) throw new Error("Local gate changes require --writers-paused.");
    const sqlite = new DatabaseSync(resolve(option("--database")), { readOnly: !apply });
    try {
      const db = sqliteAdapter(sqlite);
      const state = apply ? await changeVaultWritePhase(db, phase, at) : await vaultWriteStatus(db);
      writeFileSync(output, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
      console.log("Local gate readback: " + state.phase + "; active writers " + state.active + ". No remote operation.");
    } finally { sqlite.close(); }
    return;
  }
  if (operation === "bootstrap") {
    const first = JSON.parse(readFileSync(option("--first"), "utf8"));
    const second = JSON.parse(readFileSync(option("--second"), "utf8"));
    const plan = bootstrapPlan(first, second, option("--at"));
    writeFileSync(output, JSON.stringify(plan, null, 2) + "\n");
    console.log("Bootstrap SQL plan saved. No database or KV was changed. Review maintenance, then read back revision 1.");
    return;
  }
  if (!["export", "prune"].includes(operation) || !option("--database"))
    throw new Error("Use bootstrap --first/--second/--at, or export/prune --database with an explicit local SQLite file.");
  const apply = rest.includes("--apply-local");
  if (apply && !rest.includes("--writers-paused"))
    throw new Error("Local pruning needs explicit --writers-paused acknowledgement.");
  const sqlite = new DatabaseSync(resolve(option("--database")), { readOnly: !apply });
  try {
    const db = sqliteAdapter(sqlite);
    const result = operation === "export" ? await rollbackExport(db)
      : await pruneReceipts(db, option("--before"), new Date().toISOString(), apply);
    writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
    console.log("Local maintenance report saved. No remote database, KV or authority setting was changed.");
  } finally { sqlite.close(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch((error) => { console.error(error.message); process.exitCode = 1; });
