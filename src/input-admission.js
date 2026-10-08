import E from "../engine/position.mjs";
import { makerRequestFingerprint } from "./maker-request.js";

const fault = (error, status = 409) => ({ error, status });
const normalized = (entry) => {
  const body = { ...entry };
  delete body.makerRequest;
  return body;
};

export async function reservedInputs(db, book) {
  const rows = await db.prepare(`SELECT id,entry FROM input_admission
    WHERE state='accepted' OR state='committed' AND snapshot=?1
    UNION ALL SELECT id,entry FROM draft WHERE committed_at IS NULL AND status IN ('pending','approved')
      AND id NOT IN (SELECT id FROM input_admission)`).bind(String(book.version)).all();
  return (rows.results || []).map((row) => JSON.parse(row.entry));
}

/** One conditional insertion admits the complete set or none; source ownership shares that transaction. */
export async function admitInputs(db, entries, book, source) {
  if (!db || !book?.version || typeof db.batch !== "function")
    return fault("Durable input admission and a complete mirror are required.", 503);
  const claims = [];
  const identities = new Map();
  for (const entry of entries) {
    const checked = await checkInputAdmission(db, entry, book);
    if (checked.error) return checked;
    if (checked.claim) {
      if (identities.has(entry.at)) {
        if (identities.get(entry.at) !== checked.fingerprint)
          return fault("That timestamp already names a different resource input.");
        continue;
      }
      identities.set(entry.at, checked.fingerprint);
      claims.push({ entry, ...checked });
    }
  }
  if (!claims.length) return {};
  const values = JSON.stringify(claims.map(({ entry, claim, fingerprint }) => [
    entry.at, fingerprint, claim.resource, claim.amount, String(book.version),
    JSON.stringify(normalized(entry)), claim.available
  ]));
  const incoming = `WITH incoming(id,fingerprint,resource,amount,snapshot,entry,available) AS (
    SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]'),json_extract(value,'$[2]'),
      json_extract(value,'$[3]'),json_extract(value,'$[4]'),json_extract(value,'$[5]'),
      json_extract(value,'$[6]') FROM json_each(?1)) `;
  const allFit = `NOT EXISTS (SELECT 1 FROM incoming i WHERE
    NOT EXISTS (SELECT 1 FROM snapshot WHERE one=1 AND v=i.snapshot)
    OR EXISTS (SELECT 1 FROM input_admission a WHERE a.id=i.id AND (a.fingerprint<>i.fingerprint OR a.state<>'accepted'))
    OR EXISTS (SELECT 1 FROM draft d WHERE d.id=i.id AND (d.status='rejected' OR d.committed_at IS NOT NULL))
    OR EXISTS (SELECT 1 FROM maker_request WHERE id='queue-withdraw:'||i.id)
    OR (SELECT COALESCE(SUM(j.amount),0) FROM incoming j WHERE j.resource=i.resource
        AND j.id NOT IN (SELECT id FROM input_admission))
      + (SELECT COALESCE(SUM(a.amount),0) FROM input_admission a WHERE a.resource=i.resource
        AND (a.state='accepted' OR a.state='committed' AND a.snapshot=i.snapshot)) > i.available + 0.005)`;
  const insert = db.prepare(incoming + `INSERT OR IGNORE INTO input_admission
    (id,fingerprint,resource,amount,snapshot,entry)
    SELECT id,fingerprint,resource,amount,snapshot,entry FROM incoming WHERE ` + allFit).bind(values);
  const owners = claims.map(({ entry }) => db.prepare(incoming + `INSERT OR IGNORE INTO input_admission_source(id,source)
    SELECT id,?2 FROM incoming WHERE id=?3 AND NOT EXISTS
      (SELECT 1 FROM incoming i WHERE NOT EXISTS (SELECT 1 FROM input_admission a
        WHERE a.id=i.id AND a.fingerprint=i.fingerprint AND a.state='accepted')) AND ` + allFit).bind(values, source, entry.at));
  const results = await db.batch([insert, ...owners]);
  for (const { entry, fingerprint } of claims) {
    const accepted = await db.prepare(`SELECT fingerprint,state FROM input_admission WHERE id=?1
      AND NOT EXISTS (SELECT 1 FROM maker_request WHERE id='queue-withdraw:'||?1)`).bind(entry.at).first();
    if (!accepted || accepted.fingerprint !== fingerprint || accepted.state !== "accepted")
      return fault("The book changed or this batch's balance is already reserved. Retry the original request.");
  }
  const current = await db.prepare("SELECT v FROM snapshot WHERE one=1").first();
  if (String(current?.v) !== String(book.version)) {
    for (const [i, { entry }] of claims.entries())
      if (results[i + 1].meta.changes === 1) await withdrawInputAdmission(db, entry.at, source);
    return fault("The book changed during admission. This batch was not sent; retry the original request.");
  }
  return {
    accepted: true,
    newSources: claims.filter((_, index) => results[index + 1].meta.changes === 1)
      .map(({ entry }) => entry.at)
  };
}

export async function checkInputAdmission(db, entry, book) {
  if (!E.inputConsumesResource(entry)) return {};
  const claim = E.inputResource(entry, book);
  if (!claim) return {};
  if (claim.error || !(claim.amount > 0) || !Number.isFinite(claim.available))
    return fault(claim?.error || "This input has no valid resource amount.");
  const fingerprint = await makerRequestFingerprint("resource-input", normalized(entry));
  const previous = await db.prepare("SELECT * FROM input_admission WHERE id=?1").bind(entry.at).first();
  if (previous) {
    if (previous.fingerprint !== fingerprint) return fault("That timestamp already names a different resource input.");
    if (previous.state !== "accepted") return fault("That input is already " + previous.state + ". Do not send it again.");
  }
  const legacy = await db.prepare(
    "SELECT entry FROM draft WHERE committed_at IS NULL AND status IN ('pending','approved') AND id NOT IN (SELECT id FROM input_admission)"
  ).all();
  let held = 0;
  for (const row of legacy.results || []) {
    const other = JSON.parse(row.entry);
    if (other.at === entry.at) continue;
    const resource = E.inputResource(other, book);
    if (resource?.resource === claim.resource) held += resource.amount;
  }
  const reserved = await db.prepare(`SELECT COALESCE(SUM(amount),0) AS amount FROM input_admission
    WHERE resource=?1 AND id<>?2 AND (state='accepted' OR state='committed' AND snapshot=?3)`)
    .bind(claim.resource, entry.at, String(book.version)).first();
  if (claim.amount > claim.available - held - Number(reserved?.amount || 0) + 0.005)
    return fault("This balance is already reserved or has changed on the book.");
  return { claim: { ...claim, available: claim.available - held }, fingerprint };
}

export async function admitInput(db, entry, book, source) {
  if (!E.inputConsumesResource(entry)) return {};
  if (!book) return fault("Durable input admission and a complete mirror are required.", 503);
  if (!E.inputResource(entry, book)) return {};
  if (!db || !book?.version || typeof db.batch !== "function")
    return fault("Durable input admission and a complete mirror are required.", 503);
  const checked = await checkInputAdmission(db, entry, book);
  if (checked.error) return checked;
  if (!checked.claim) return {};
  const { claim, fingerprint } = checked;
  const insert = db.prepare(`INSERT OR IGNORE INTO input_admission
    (id,fingerprint,resource,amount,snapshot,entry)
    SELECT ?1,?2,?3,?4,?5,?6
    WHERE (SELECT v FROM snapshot WHERE one=1)=?5
      AND ?4 + COALESCE((SELECT SUM(amount) FROM input_admission
        WHERE resource=?3 AND (state='accepted' OR state='committed' AND snapshot=?5)),0) <= ?7 + 0.005
      AND NOT EXISTS (SELECT 1 FROM draft WHERE id=?1 AND (status='rejected' OR committed_at IS NOT NULL))
      AND NOT EXISTS (SELECT 1 FROM maker_request WHERE id=?8 AND operation='queue-withdraw')`)
    .bind(entry.at, fingerprint, claim.resource, claim.amount, String(book.version),
      JSON.stringify(normalized(entry)), claim.available, queueWithdrawalKey(entry.at));
  const owner = db.prepare(`INSERT OR IGNORE INTO input_admission_source(id,source)
    SELECT id,?3 FROM input_admission WHERE id=?1 AND fingerprint=?2 AND state='accepted'`)
    .bind(entry.at, fingerprint, source);
  const results = await db.batch([insert, owner]);
  const accepted = await db.prepare("SELECT fingerprint,state FROM input_admission WHERE id=?1").bind(entry.at).first();
  if (!accepted) return fault("The book changed or this balance is already reserved. Read the input again.");
  if (accepted.fingerprint !== fingerprint) return fault("That timestamp already names a different resource input.");
  if (accepted.state !== "accepted") return fault("That input is already " + accepted.state + ". Do not send it again.");
  const current = await db.prepare("SELECT v FROM snapshot WHERE one=1").first();
  if (String(current?.v) !== String(book.version)) {
    if (results[1].meta.changes === 1) await withdrawInputAdmission(db, entry.at, source);
    return fault("The book changed during admission. This input was not sent; start a new input.");
  }
  return { accepted: true, newSource: results[1].meta.changes === 1 };
}

export function admissionDecision(db, id, state, requireDraft = false) {
  if (!["rejected", "committed"].includes(state)) throw new Error("Unsupported input admission decision.");
  const guard = requireDraft ? state === "rejected"
    ? " AND EXISTS (SELECT 1 FROM draft WHERE id=?1 AND status='rejected')"
    : " AND EXISTS (SELECT 1 FROM draft WHERE id=?1 AND committed_at IS NOT NULL)" : "";
  return db.prepare("UPDATE input_admission SET state=?2 WHERE id=?1 AND state='accepted'" + guard).bind(id, state);
}

export async function finishInputAdmission(db, id, state) {
  await admissionDecision(db, id, state).run();
}

export async function hasInputAdmission(db, id, entry) {
  if (!E.inputConsumesResource(entry)) return false;
  return !!await db.prepare("SELECT id FROM input_admission WHERE id=?1 AND state='accepted'").bind(id).first();
}

export async function withdrawInputAdmission(db, id, source) {
  await db.batch([
    db.prepare("DELETE FROM input_admission_source WHERE id=?1 AND source=?2").bind(id, source),
    db.prepare(`UPDATE input_admission SET state='withdrawn' WHERE id=?1 AND state='accepted'
      AND NOT EXISTS (SELECT 1 FROM input_admission_source WHERE id=?1)
      AND NOT EXISTS (SELECT 1 FROM draft WHERE id=?1 AND status IN ('pending','approved') AND committed_at IS NULL)`).bind(id)
  ]);
}

const DEVICE_QUEUE_LOCK_MS = 120000;
export const queueWithdrawalKey = (id) => "queue-withdraw:" + id;
export const queueOwnerKey = (id) => "queue-owner:" + id;
const deviceQueueLockKey = (device) => "queue-device:" + device;

export async function acquireDeviceQueueLock(db, device, now = Date.now()) {
  const id = deviceQueueLockKey(device), token = crypto.randomUUID();
  const result = await db.prepare(`INSERT OR REPLACE INTO maker_request(id,operation,fingerprint,entry)
    SELECT ?1,'queue-device-lock',?2,?3
    WHERE NOT EXISTS (SELECT 1 FROM maker_request WHERE id=?1
      AND (operation<>'queue-device-lock' OR CAST(entry AS INTEGER)>=?4))`)
    .bind(id, token, String(now), now - DEVICE_QUEUE_LOCK_MS).run();
  return result.meta.changes === 1 ? token : null;
}

export async function releaseDeviceQueueLock(db, device, token) {
  await db.prepare("DELETE FROM maker_request WHERE id=?1 AND operation='queue-device-lock' AND fingerprint=?2")
    .bind(deviceQueueLockKey(device), token).run();
}

export async function claimDeviceQueueWithdrawal(db, id, device, fingerprint) {
  const key = queueWithdrawalKey(id), source = "device:" + device;
  const entry = JSON.stringify({ device, fingerprint });
  const result = await db.batch([
    db.prepare(`INSERT OR IGNORE INTO maker_request(id,operation,fingerprint,entry)
      SELECT ?1,'queue-withdraw',?2,?3
      WHERE NOT EXISTS (SELECT 1 FROM draft WHERE id=?4)
        AND NOT EXISTS (SELECT 1 FROM input_admission a WHERE a.id=?4
          AND (a.state NOT IN ('accepted','rejected')
            OR NOT EXISTS (SELECT 1 FROM input_admission_source s WHERE s.id=a.id AND s.source=?5)))
        AND NOT EXISTS (SELECT 1 FROM input_admission_source s WHERE s.id=?4 AND s.source NOT IN (?5,'drafter'))`)
      .bind(key, fingerprint, entry, id, source),
    db.prepare(`DELETE FROM input_admission_source WHERE id=?1 AND source IN (?2,'drafter')
      AND EXISTS (SELECT 1 FROM maker_request WHERE id=?3 AND operation='queue-withdraw'
        AND fingerprint=?4 AND entry=?5)`).bind(id, source, key, fingerprint, entry),
    db.prepare(`UPDATE input_admission SET state='withdrawn' WHERE id=?1 AND state='accepted'
      AND NOT EXISTS (SELECT 1 FROM input_admission_source WHERE id=?1)
      AND NOT EXISTS (SELECT 1 FROM draft WHERE id=?1)
      AND EXISTS (SELECT 1 FROM maker_request WHERE id=?2 AND operation='queue-withdraw'
        AND fingerprint=?3 AND entry=?4)`)
      .bind(id, key, fingerprint, entry)
  ]);
  const claim = await db.prepare("SELECT operation,fingerprint,entry,response FROM maker_request WHERE id=?1").bind(key).first();
  if (!claim || claim.operation !== "queue-withdraw" || claim.fingerprint !== fingerprint || claim.entry !== entry)
    return { error: "The entry's owner or status changed. Refresh the server-held queue before retrying." };
  return { claimed: result[0].meta.changes === 1, response: claim.response || null };
}

export async function finishDeviceQueueWithdrawal(db, id, device, fingerprint, response) {
  const key = queueWithdrawalKey(id), entry = JSON.stringify({ device, fingerprint });
  const result = await db.prepare(`UPDATE maker_request SET response=?1
    WHERE id=?2 AND operation='queue-withdraw' AND fingerprint=?3 AND entry=?4 AND response IS NULL`)
    .bind(JSON.stringify(response), key, fingerprint, entry).run();
  if (result.meta.changes === 1) return true;
  const current = await db.prepare("SELECT response FROM maker_request WHERE id=?1 AND operation='queue-withdraw' AND fingerprint=?2 AND entry=?3")
    .bind(key, fingerprint, entry).first();
  return !!current?.response && current.response === JSON.stringify(response);
}
