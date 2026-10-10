import { makerRequestFingerprint } from "./maker-request.js";
import POSITION_ENGINE from "../engine/position.mjs";

const object = (value) => value && typeof value === "object" && !Array.isArray(value);
const canonical = (value) => Array.isArray(value) ? value.map(canonical)
  : object(value) ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
const sameJson = (left, right) => JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
const parsed = (value) => {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return null; }
};
const encoded = (value, bytes) => {
  if (typeof value !== "string" || value.length > 524288 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value))
    return false;
  try {
    const decoded = atob(value);
    return btoa(decoded) === value && (bytes ? decoded.length === bytes : decoded.length >= 16);
  } catch { return false; }
};
export const sealedVaultEnvelope = (value) => object(value) && value.v === 1
  && Object.keys(value).every((key) => ["v", "salt", "iv", "ct", "it"].includes(key))
  && encoded(value.salt, 16) && encoded(value.iv, 12) && encoded(value.ct)
  && (value.it === undefined || Number.isInteger(value.it) && value.it >= 100000 && value.it <= 1000000);
const sealed = sealedVaultEnvelope;
const failure = (error, status = 409) => ({ ok: false, error, status });
const canonicalAt = (value) => typeof value === "string" && Number.isFinite(Date.parse(value))
  && new Date(value).toISOString() === value;

export async function readVaultPair(db) {
  if (!db) return failure("The versioned vault store is unavailable.", 503);
  const row = await db.prepare("SELECT revision,names,places,updated FROM vault_pair WHERE one=1").first();
  if (!row) return failure("The versioned vault has not been bootstrapped. Use the maintenance procedure.", 503);
  const names = JSON.parse(row.names), places = row.places == null ? null : JSON.parse(row.places);
  if (!Number.isSafeInteger(row.revision) || !sealed(names) || places !== null && !sealed(places))
    return failure("The versioned vault record is invalid. Nothing may replace it.", 503);
  return { ok: true, revision: row.revision, names, places, updated: row.updated };
}

// The caller supplies only a server-constructed, already-validated cloud-safe ID/place entry.
export async function commitVaultPair(db, body, operation, entry = null, requestFingerprint = null) {
  if (!db || typeof db.batch !== "function") return failure("The transactional vault store is unavailable.", 503);
  if (!object(body) || Object.keys(body).some((key) => !["at", "expectedRevision", "names", "places"].includes(key))
    || !canonicalAt(body.at) || !Number.isSafeInteger(body.expectedRevision)
    || body.expectedRevision < 1 || body.expectedRevision >= Number.MAX_SAFE_INTEGER
    || !sealed(body.names) || body.places !== null && !sealed(body.places)
    || !["seed", "add-id", "amend-id", "place"].includes(operation))
    return failure("Send a request timestamp, expected revision and both ciphertext envelopes.", 400);
  if (entry && (!object(entry) || entry.at !== body.at || !object(entry.payload)
    || !["addid", "rename", "place"].includes(entry.payload.mode) || entry.payload.note != null))
    return failure("The vault outbox accepts only a validated ID or placement input.", 400);
  if (JSON.stringify(body).length + JSON.stringify(entry).length > 1048576)
    return failure("The encrypted vault request is too large.", 413);
  const fingerprint = await makerRequestFingerprint("vault:" + operation, { ...body, entry });
  const replay = await db.prepare("SELECT fingerprint,revision FROM vault_receipt WHERE id=?1").bind(body.at).first();
  if (replay) return replay.fingerprint === fingerprint
    ? { ok: true, revision: replay.revision, replay: true }
    : failure("That request id already carries different vault content.");
  const maintenance = await db.prepare("SELECT receipt_floor FROM vault_maintenance WHERE one=1").first();
  if (!maintenance || body.at <= maintenance.receipt_floor)
    return failure("That vault request predates retained receipts. Read the pair and start a new reviewed request.");
  const capacity = await db.prepare("SELECT COUNT(*) AS n FROM vault_receipt").first();
  if (Number(capacity?.n) >= 1000)
    return failure("The vault receipt store is full. Run reviewed maintenance before writing.", 503);
  const revision = body.expectedRevision + 1;
  const results = await db.batch([
    db.prepare(`UPDATE vault_pair SET revision=?1,names=?2,places=?3,updated=?4,request_id=?4,fingerprint=?5
      WHERE one=1 AND revision=?6 AND NOT EXISTS (SELECT 1 FROM vault_receipt WHERE id=?4)
        AND EXISTS (SELECT 1 FROM vault_maintenance WHERE one=1 AND receipt_floor<?4)
        AND (SELECT COUNT(*) FROM vault_receipt)<1000`)
      .bind(revision, JSON.stringify(body.names), body.places === null ? null : JSON.stringify(body.places),
        body.at, fingerprint, body.expectedRevision),
    db.prepare(`INSERT INTO vault_receipt(id,fingerprint,revision,created_at,operation,request_fingerprint)
      SELECT ?1,?2,revision,?1,?3,?5 FROM vault_pair
      WHERE one=1 AND revision=?4 AND request_id=?1 AND fingerprint=?2
        AND NOT EXISTS (SELECT 1 FROM vault_receipt WHERE id=?1)`)
      .bind(body.at, fingerprint, operation, revision, requestFingerprint),
    db.prepare(`INSERT INTO vault_outbox(id,entry)
      SELECT id,?3 FROM vault_receipt WHERE id=?1 AND fingerprint=?2 AND ?3 IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM vault_outbox WHERE id=?1)`)
      .bind(body.at, fingerprint, entry === null ? null : JSON.stringify(entry))
  ]);
  const receipt = await db.prepare("SELECT fingerprint,revision FROM vault_receipt WHERE id=?1").bind(body.at).first();
  if (!receipt || receipt.fingerprint !== fingerprint)
    return failure("The vault changed. Keep this draft, read the latest pair and review the conflicting edit.");
  return { ok: true, revision: receipt.revision, replay: results[0].meta.changes === 0 };
}

export async function consumeVaultOutbox(db, id, send) {
  const row = await db.prepare("SELECT entry,state FROM vault_outbox WHERE id=?1").bind(id).first();
  if (!row) return { ok: true, queued: false };
  if (row.state === "complete") return { ok: true, queued: false, replay: true };
  const entry = JSON.parse(row.entry);
  // send must be the idempotent, fixed-id queue writer; a crash before marking calls it again.
  const result = await send(entry);
  if (!result || result.ok !== true)
    throw new Error("The vault outbox writer did not confirm this fixed-id input. It remains pending.");
  await db.prepare("UPDATE vault_outbox SET state='complete',completed_at=?2 WHERE id=?1 AND state='pending'")
    .bind(id, new Date().toISOString()).run();
  return { ok: true, queued: true };
}

export function verifiedVaultRegistration(draft, receipt, outbox) {
  if (!draft || draft.collection !== "roster" || !["pending", "approved"].includes(draft.status)
    || !receipt || receipt.id !== draft.id || receipt.operation !== "add-id"
    || !Number.isSafeInteger(receipt.revision) || receipt.revision < 1
    || !/^[0-9a-f]{64}$/.test(receipt.fingerprint || "")
    || !/^[0-9a-f]{64}$/.test(receipt.request_fingerprint || "")
    || !outbox || outbox.id !== draft.id || outbox.state !== "complete"
    || typeof outbox.completed_at !== "string" || !Number.isFinite(Date.parse(outbox.completed_at)))
    return null;
  const entry = parsed(draft.entry), queued = parsed(outbox.entry), row = parsed(draft.row);
  if (!object(entry) || !object(queued) || !object(row) || !sameJson(entry, queued)) return null;
  const payload = entry.payload;
  if (!object(payload) || payload.mode !== "addid" || payload.note != null
    || !/^[A-Z]{1,3}[0-9]{0,2}[A-Z0-9-]*$/.test(payload.code || "")
    || !["customer", "supplier", "reseller", "referral", "downstream", "bucket"].includes(payload.kind)
    || (payload.parent ?? null) !== (row.parent ?? null)
    || row.code !== payload.code || row.kind !== payload.kind
    || (payload.rev ?? null) !== (POSITION_ENGINE.ADDID_APPOINTS[payload.kind] || null))
    return null;
  const expected = POSITION_ENGINE.addIdEntry({ at: draft.id, code: payload.code, kind: payload.kind,
    parent: payload.parent ?? null, rev: payload.rev ?? null, geo: payload.geo ?? null,
    tiers: payload.tiers ?? null, note: null });
  if (!sameJson(entry, expected)) return null;
  return { id: draft.id, code: payload.code, kind: payload.kind, parent: payload.parent ?? null };
}

export async function readVaultRegistrations(db) {
  if (!db) throw new Error("The versioned vault registration store is unavailable.");
  const rows = (await db.prepare(`SELECT d.id,d.status,d.collection,d.entry,d.row,
      r.id AS receipt_id,r.fingerprint AS receipt_fingerprint,r.request_fingerprint,r.revision AS receipt_revision,
      r.operation AS receipt_operation,o.id AS outbox_id,o.entry AS outbox_entry,o.state AS outbox_state,
      o.completed_at AS outbox_completed_at
    FROM draft d
    JOIN vault_receipt r ON r.id=d.id
    LEFT JOIN vault_outbox o ON o.id=d.id
    WHERE d.collection='roster' AND d.committed_at IS NULL AND d.status IN ('pending','approved')`).all()).results || [];
  const verified = rows.flatMap((row) => {
    const registration = verifiedVaultRegistration(row, {
      id: row.receipt_id, fingerprint: row.receipt_fingerprint, request_fingerprint: row.request_fingerprint,
      revision: row.receipt_revision, operation: row.receipt_operation
    }, {
      id: row.outbox_id, entry: row.outbox_entry, state: row.outbox_state, completed_at: row.outbox_completed_at
    });
    return registration ? [{ ...registration, status: row.status }] : [];
  });
  const counts = new Map();
  for (const registration of verified)
    counts.set(registration.code, (counts.get(registration.code) || 0) + 1);
  return verified.filter((registration) => counts.get(registration.code) === 1);
}
