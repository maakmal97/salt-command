export async function vaultWriteStatus(db) {
  const row = await db.prepare("SELECT phase,updated,(SELECT COUNT(*) FROM vault_write_active) AS active FROM vault_write_gate WHERE one=1").first();
  if (!row) throw new Error("The vault write gate is unavailable. No vault writer may proceed.");
  return row;
}

export async function withVaultWrite(env, action, consuming = false) {
  if (!env.SALT_LEDGER) return { ok: false, status: 503, error: "The vault write gate requires its durable store. Keep this input." };
  const id = crypto.randomUUID(), started = new Date().toISOString();
  const result = await env.SALT_LEDGER.prepare(`INSERT INTO vault_write_active(id,started)
    SELECT ?1,?2 FROM vault_write_gate WHERE one=1 AND (phase='open' OR (?3=1 AND phase='draining'))`).bind(id, started, consuming ? 1 : 0).run();
  if (result.meta.changes !== 1)
    return { ok: false, status: 503, error: "Vault maintenance is in progress. Keep this input and retry unchanged when writes reopen." };
  try { return await action(); }
  finally { await env.SALT_LEDGER.prepare("DELETE FROM vault_write_active WHERE id=?1").bind(id).run(); }
}

export async function changeVaultWritePhase(db, phase, at) {
  if (!["open", "draining", "paused"].includes(phase) || typeof at !== "string"
    || !Number.isFinite(Date.parse(at)) || new Date(at).toISOString() !== at)
    throw new Error("Choose a write-gate phase and canonical timestamp.");
  if (phase === "paused") {
    await db.prepare(`UPDATE vault_write_gate SET phase='paused',updated=?1
      WHERE one=1 AND phase='draining' AND NOT EXISTS (SELECT 1 FROM vault_write_active)
        AND NOT EXISTS (SELECT 1 FROM vault_outbox WHERE state='pending')`).bind(at).run();
  } else {
    await db.prepare("UPDATE vault_write_gate SET phase=?1,updated=?2 WHERE one=1").bind(phase, at).run();
  }
  const state = await vaultWriteStatus(db);
  if (state.phase !== phase) throw new Error("The write gate cannot pause until accepted writers finish. It remains draining.");
  return state;
}
