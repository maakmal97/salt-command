function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

export async function makerRequestFingerprint(operation, body) {
  const bytes = new TextEncoder().encode(JSON.stringify([operation, canonical(body)]));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function makerRequestRead(db, id, operation, fingerprint) {
  const stored = await db.prepare("SELECT operation,fingerprint,response,entry FROM maker_request WHERE id=?1").bind(id).first();
  if (!stored) return null;
  if (stored.operation !== operation || stored.fingerprint !== fingerprint)
    return { error: "That request timestamp already names another input. Restore the original input or start a new one." };
  if (stored.response) return { response: JSON.parse(stored.response) };
  const draft = await db.prepare("SELECT status,entry FROM draft WHERE id=?1").bind(id).first();
  if (draft && JSON.parse(draft.entry).makerRequest === fingerprint)
    return { response: { ok: true, queued: false, draft: id, status: draft.status } };
  if (stored.entry) return { pending: JSON.parse(stored.entry) };
  return { error: "That input is still being recorded. Keep this request and retry; do not send another." };
}

export async function makerRequestClaim(db, id, operation, fingerprint, entry = null) {
  const result = await db.prepare(
    "INSERT OR IGNORE INTO maker_request(id,operation,fingerprint,entry) VALUES (?1,?2,?3,?4)"
  ).bind(id, operation, fingerprint, entry ? JSON.stringify(entry) : null).run();
  return result.meta.changes === 1;
}

export async function makerRequestFinish(db, id, fingerprint, response) {
  await db.prepare("UPDATE maker_request SET response=?3 WHERE id=?1 AND fingerprint=?2")
    .bind(id, fingerprint, JSON.stringify(response)).run();
}
