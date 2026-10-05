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

/* A Counter Admin stage tap (a handover, a close, a move offered again) under its immutable request id: the first
   answer that lands is kept and a retry under the id is answered from it; other content under the id is refused; a
   refusal is not kept, so the same request may be tried again and the native road judges it afresh. A claim left with no
   answer (a request that died mid-way) is taken over after two minutes, the native road still refusing a duplicate. */
const ORDER_TAP_STALE_MS = 120000;
export async function makerOrderOnce(db, rid, action, body, run, now = Date.now()) {
  const id = "order:" + rid, operation = "order-" + action;
  const fingerprint = await makerRequestFingerprint(operation, body);
  let claimed = await makerRequestClaim(db, id, operation, fingerprint, String(now));
  if (!claimed) {
    const stored = await db.prepare("SELECT operation,fingerprint,response,entry FROM maker_request WHERE id=?1").bind(id).first();
    if (!stored) claimed = await makerRequestClaim(db, id, operation, fingerprint, String(now));
    else if (stored.operation !== operation || stored.fingerprint !== fingerprint)
      return { ok: false, status: 409, error: "That request id already names another order action." };
    else if (stored.response) return { ...JSON.parse(stored.response), again: true };
    else if (now - Number(JSON.parse(stored.entry)) < ORDER_TAP_STALE_MS)
      return { ok: false, status: 409, error: "That order action is still being recorded. Retry it in a minute; do not send another." };
    else {
      const taken = await db.prepare("UPDATE maker_request SET entry=?3 WHERE id=?1 AND entry=?2 AND response IS NULL")
        .bind(id, stored.entry, JSON.stringify(String(now))).run();
      claimed = taken.meta.changes === 1;
    }
    if (!claimed) return { ok: false, status: 409, error: "That order action is still being recorded. Retry it in a minute; do not send another." };
  }
  let result;
  try { result = await run(); }
  catch (error) { await db.prepare("DELETE FROM maker_request WHERE id=?1 AND response IS NULL").bind(id).run(); throw error; }
  if (result && result.ok) await makerRequestFinish(db, id, fingerprint, result);
  else await db.prepare("DELETE FROM maker_request WHERE id=?1 AND response IS NULL").bind(id).run();
  return result;
}

export async function makerRequestFinish(db, id, fingerprint, response) {
  await db.prepare("UPDATE maker_request SET response=?3 WHERE id=?1 AND fingerprint=?2")
    .bind(id, fingerprint, JSON.stringify(response)).run();
}
