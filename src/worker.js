/* Salt Command Worker: the cloud stand-in for serve_desk.py.
 *
 * It speaks the exact HTTP contract the desk already uses, so the ported desk needs
 * almost no change: it pings /queue/ping, gets {ok:true, cloud:true}, enters "server"
 * mode, and POSTs its queue to /queue. Here that queue lands in KV instead of on disk,
 * one key per device, and the daily run drains it into the source (tools/drain.mjs).
 *
 * Plaintext names never touch the cloud. /bio (the plaintext directory) is answered but
 * dropped. /vault DOES sync, but only the encrypted envelope: {v,salt,iv,ct} ciphertext,
 * AES-GCM, the passphrase never leaving the browser. So the phone can show names after a
 * password, and auto-hide them, while the server only ever holds ciphertext. A POST that
 * is not that envelope shape is rejected, so a stray plaintext name cannot land here.
 *
 * Access is controlled by REQUIRE_ACCESS and defaults off in the committed deployment config
 * until its application is provisioned. When enabled, every request must carry a valid Access
 * JWT for the configured team and audience and the owner's exact email; a header alone is not
 * trusted. See CLAUDE.md and docs/DESK.md before changing the deployment setting.
 */

import { runDrafter, dryRunDrafter, readBook, draftRow, tripCheck } from "./drafter.js";
import { sendPush, listSubs } from "./push.js";
import { listOrders, listClaims, listThreads, threadRelay, slipRelay, moveOrder, ordersWaiting, nudgeOrders, tickRead, reconcileOrders, tellSite, rekeyOrders, tellWaiting, bulletinRelay, expectedRelay, rejectedOnOrder, previewOrder, dropQueued, acceptOrder, offerOrder, withdrawOffer, takeOffer, amendOrder, ackOnApproval, deskPass, handedOrder, cashOrder, restateOrder, receivedOrder, againOrder, againOf, notFoundOrder, notFoundClaim, claimPreview, claimReceived, findClaim, fixtureClaimPreview, siteWords, findOrder, queueSale, queueResourceTrades } from "./orders.js";
import { makerKeyMatches, makerOrderFault, makerStockCount, makerCommunicationFault } from "./maker.js";
import { makerCoverPlan, makerInputCatalog, makerTradeBatch, makerTierSet, makerTierAcceptAll, makerHouseSizes, makerHush, hushGet, hushPut, hushFault, makerQueuedTradeCheck, makerLedgerInput, makerLedgerAmendment, makerAmendmentRoom, makerOffsetOffers, makerOffset } from "./maker-inputs.js";
import { makerRequestFingerprint, makerRequestRead, makerRequestClaim, makerRequestFinish, makerAppointmentClaim, makerOrderOnce } from "./maker-request.js";
import { readVaultRegistrations } from "./vault-pair.js";
import POSITION_ENGINE from "../engine/position.mjs";
import { reservedInputs, admitInputs, admitInput, withdrawInputAdmission, finishInputAdmission, admissionDecision, hasInputAdmission,
  acquireDeviceQueueLock, releaseDeviceQueueLock, claimDeviceQueueWithdrawal, finishDeviceQueueWithdrawal,
  queueWithdrawalKey, queueOwnerKey } from "./input-admission.js";
import { ciAccess, ownerAccess } from "./access.js";
import { maintenance } from "./maintenance.js";
import { readVaultPair, commitVaultPair, consumeVaultOutbox } from "./vault-pair.js";
import { officialVaultPoint } from "./vault-locality.js";
import { withVaultWrite, vaultWriteStatus } from "./vault-write-gate.js";

/* X-Robots-Tag matches public/_headers, which sets it on the static assets. It was missing
   here, so GET /queue and GET /rev carried no noindex at all. That mattered little behind
   Access and matters a great deal now the origin is public: GET /queue returns the union of
   every device's queue, which is ledger data, and it is the one endpoint a crawler could
   reach and index without a link ever existing to the desk itself. */
const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-robots-tag": "noindex, nofollow, noarchive"
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: JSON_HEADERS });
const vaultWriteResponse = async (env, action) => {
  const result = await withVaultWrite(env, action);
  return result instanceof Response ? result : json(result, result.status || 503);
};

/* Served in place of every asset when the gate is on and the Access header is absent.
 * Deliberately tiny, self-contained and dataless: no figure from the desk appears here.
 * The service worker shows it rather than a cached desk (a 401 is a resolved response,
 * not a fetch failure), so Access being off is loud on the phone, never silent. */
const LOCKED_HTML = '<!doctype html><html lang="en"><meta charset="utf-8">'
  + '<meta name="viewport" content="width=device-width,initial-scale=1">'
  + '<title>Salt Command locked</title>'
  + '<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0f14;color:#dbe4ee;font:15px/1.6 system-ui,sans-serif">'
  + '<div style="max-width:26em;padding:2em;text-align:center">'
  + '<div style="font-size:2em">&#128274;</div>'
  + '<h1 style="font-size:1.1em;margin:.5em 0">Salt Command is locked</h1>'
  + '<p style="color:#8b98a9;margin:0">This deployment expects Cloudflare Access in front of it, and this request arrived without it. Re-enable Access for salt-command in Zero Trust, then reload.</p>'
  + '</div></body></html>';
const locked = () => new Response(LOCKED_HTML, {
  status: 401,
  headers: {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "x-robots-tag": "noindex, nofollow",
    "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
  }
});

const QKEY = (device) => "q:" + device;
const VKEY = "vault";                 // the encrypted name vault, ciphertext only
const AKEY = "vault-addr";            // F14: the places envelope, ciphertext only, read and written with the key
const KKEY = "vault-key";             // F13: the slip key's sealed private half, read with the key, written only by seed-vault
const DEVICE_RE = /^[A-Za-z0-9._-]{1,80}$/;
// The only shape /vault will store: the desk's AES-GCM envelope. Anything else (a plain
// name map, say) is refused, so plaintext can never reach the cloud through this door.
const isEnvelope = (v) =>
  v && typeof v === "object" &&
  typeof v.salt === "string" && typeof v.iv === "string" && typeof v.ct === "string";

async function accessOk(request, env, p, m) {
  if (String(env.REQUIRE_ACCESS || "0") === "0") return true;
  if (await ownerAccess(request, env)) return true;
  /* The verified service token (CI, and update.mjs's /rev read) reads the build id and rings the
     push, nothing else; the push still needs its own key below. The vault stays the owner's: a
     leaked CI secret with the write key must not reach names or places. */
  return CI_ROUTES.has(m + " " + p) && ciAccess(request, env);
}
const CI_ROUTES = new Set(["GET /rev", "POST /push/send"]);

/* THE WRITE GATE (12 Aug 2026). Reads stay open, by the owner's standing decision; writes
 * do not have to. A caller must present X-Salt-Key matching the SALT_WRITE_KEY secret, and
 * the phone holds that key in localStorage after being asked for it once.
 *
 * THE SECRET IS SET, SO THE GATE IS ARMED (verified against the live Worker, 16 Aug 2026).
 * The dormant branch below stays, and must: with SALT_WRITE_KEY unset this returns true and
 * nothing changes, which is deliberate, because the desk that can send the header has to be
 * live on the phone BEFORE the gate starts demanding it, or the owner locks himself out of
 * his own queue exactly as the Access application did on 11 Aug. That ordering was followed.
 * It binds again only if the secret is ever cleared and reinstated.
 *
 * WHAT IT IS AND IS NOT. It is a shared secret, so it stops a stranger with the URL writing
 * into the ledger, which is the exposure that mattered: drain.mjs unions any POST into the
 * queue and the daily run folds it in as real rows. It is NOT protection against someone who
 * already has the key, and it is not Zero Trust. Reads are still world-readable on purpose.
 *
 * Compared over the whole string rather than with ===, so a wrong key cannot be found one
 * character at a time by timing. The length is not hidden; that is not worth the complexity
 * here, and a passphrase's length is not the secret. */
function writeOk(request, env) {
  const key = String(env.SALT_WRITE_KEY || "");
  if (!key) return true;
  const got = String(request.headers.get("X-Salt-Key") || "");
  return secretMatches(got, key);
}
function secretMatches(got, key) {
  if (!key || got.length !== key.length) return false;
  let diff = 0;
  for (let i = 0; i < key.length; i++) diff |= got.charCodeAt(i) ^ key.charCodeAt(i);
  return diff === 0;
}
const needsKey = () => json({ ok: false, error: "write key required", writeKey: true }, 401);

/* The Counter's keyed, internal read of the Desk build id, for its live statement gate.
 * Dispatched before the Access gate (a service binding carries no owner JWT); read-only,
 * and it accepts only the shared STMT_DESK_KEY. */
async function handleStmtRev(request, env, url, m) {
  if (m !== "GET") return json({ ok: false, error: "method not allowed" }, 405);
  const key = String(env.STMT_DESK_KEY || "");
  if (!secretMatches(String(request.headers.get("X-Stmt-Desk") || ""), key))
    return json({ ok: false, error: "desk key required" }, 401);
  try {
    const res = await env.ASSETS.fetch(new Request(new URL("/rev.json", url), { method: "GET" }));
    if (!res || !res.ok) return json({ ok: false, error: "no build manifest" }, 503);
    const rev = await res.json();
    if (!rev || typeof rev.id !== "string" || !/^[0-9a-f]{16}$/.test(rev.id))
      return json({ ok: false, error: "invalid build manifest" }, 503);
    return json({ ok: true, id: rev.id });
  } catch (e) {
    return json({ ok: false, error: "no build manifest" }, 503);
  }
}

/* THE PUSH KEY (20 Aug 2026): A CAPABILITY, NOT A CREDENTIAL, AND IT OPENS ONE DOOR.
 *
 * CI needs to wake the phone after a fold and nothing else. Handing it SALT_WRITE_KEY would
 * have given a notification step the right to write the queue, replace the vault and approve
 * drafts, which is the whole ledger, to save minting one more secret. A GitHub Actions secret
 * is readable by anyone who can land a workflow in the repo, so the blast radius of the wrong
 * key here is not theoretical.
 *
 * So /push/send accepts EITHER the write key, which the phone already holds, OR this one,
 * which can do nothing else at all. Everything else under /push still needs the write key.
 * If SALT_PUSH_KEY is unset this returns false and the write key remains the only way in,
 * which is the same fail-safe shape writeOk has. */
function pushKeyOk(request, env) {
  const key = String(env.SALT_PUSH_KEY || "");
  if (!key) return false;
  const got = String(request.headers.get("X-Push-Key") || "");
  if (got.length !== key.length) return false;
  let diff = 0;
  for (let i = 0; i < key.length; i++) diff |= got.charCodeAt(i) ^ key.charCodeAt(i);
  return diff === 0;
}

async function readQueuePost(request) {
  const body = await request.json();
  if (!body || typeof body !== "object") throw new Error("expected an object");
  if (!Array.isArray(body.queue)) throw new Error("expected {queue:[...]}");
  if (body.queue.length > 5000) throw new Error("queue too large");
  let device = typeof body.device === "string" && DEVICE_RE.test(body.device) ? body.device : "anon";
  return { device, updated: body.updated || null, queue: body.queue };
}

/* DRAFT ON ARRIVAL (v304), and it exists because the cron alone loses the race.
 *
 * serve_desk.py drains the cloud queue to disk EVERY 60 SECONDS while the laptop is on, and
 * drain.mjs is a destructive read: it unions KV into salt_queue_cloud.json and CLEARS the keys.
 * So a fifteen-minute cron would almost never see an entry. Tested on 16 Aug rather than
 * reasoned about: an entry posted at 14:41 was on disk and gone from KV by 14:52, and the cron
 * had nothing left to draft.
 *
 * Drafting here closes it. The row is written within a second of the entry arriving, long
 * inside the drain window, and the cron drops back to being the safety net it should have been
 * from the start: it catches anything posted while D1 was unreachable.
 *
 * waitUntil, not await: the phone must get its 200 for the ENTRY immediately. A draft that
 * takes a second longer costs nothing, because the Approve tab polls; an entry that takes a
 * second longer is felt at the point of sale. And a drafter fault must never fail the queue
 * write, which is why this cannot throw into the response path. */
/* WAKE THE PHONE WHEN A ROW LANDS. The drafter reports how many it wrote; only a non-zero
   count is worth a banner. A refusal is NOT pushed: it needs a person at the laptop, not an
   interruption on a phone that cannot act on it, and it will be there in the panel when he
   next looks. Failures here are swallowed for the same reason the drafting is: a push service
   having a bad minute must never fail the queue write that triggered it. */
async function pushIfDrafted(env, result) {
  try {
    /* S11: a row his own yes approved as it was drafted waits on nobody, so it wakes nobody */
    if (result && result.drafted - ((result.approved || []).length) > 0) await sendPush(env, { tag: "approve", urgency: "high" });
  } catch { /* a banner is not worth an error path */ }
}

/* S11 (D6): WHAT AN APPROVAL SETS GOING, whichever road approved it: the drafter spending his yes, or his tap
   under Approve. The stage is rung once, as a tap rings it; and a pending row an Accept queued moves its order on
   the site now (ackOnApproval), which is the moment D6 lets the customer be told. A fault is logged and the
   approval stands: the order is moved again by the next Accept, which finds the row approved. */
async function afterApproval(env, ctx, ids) {
  if (!ids || !ids.length) return [];
  stageOnApproval(env, ctx);
  const moved = [];
  for (const id of ids) {
    try {
      /* his approval spends the yes behind the row, whether it was marked as differing or never tested (a fault) */
      await env.SALT_LEDGER.prepare("UPDATE preapproval SET status='applied' WHERE draft_id=?1 AND status='differs'").bind(id).run();
      await env.SALT_LEDGER.prepare("UPDATE preapproval SET status='applied', draft_id=?1, decided_at=?2 WHERE entry_at=?1 AND status='waiting'").bind(id, new Date().toISOString()).run();
      const pre = await env.SALT_LEDGER.prepare("SELECT * FROM preapproval WHERE entry_at=?1 AND stage='ack' AND status='applied'").bind(id).first();
      if (pre) moved.push(Object.assign({ id }, await ackOnApproval(env, pre)));
    } catch (e) { console.log("after approval of " + id + ": " + String((e && e.message) || e)); }
  }
  return moved;
}

/* v762: THE LEDGER IS TOLD ON THE TAP. The reconcile is the one road that queues a site order's
   stages (v694) and it ran on the every-minute cron alone, so his acknowledgement sat for up to a
   minute before the row existed and he had to come back to Approve for it. It is the same call on
   the same road, run beside the answer rather than instead of it: the cron still runs every minute
   as the net, and the reconcile's own marks are what stop a stage being queued twice, so the two
   cannot double up whichever gets there first.
   IT DOES NOT WAKE HIM. This is his own tap, exactly as a row he typed is (v759): the desk draws
   the row under Approve while he is looking at it. The drafter still runs, so the row is there. */
function reconcileOnTap(env, ctx) {
  if (!ctx || typeof ctx.waitUntil !== "function" || !env.STMT_SITE) return;
  ctx.waitUntil((async () => {
    try {
      const rc = await reconcileOrders(env);
      console.log("orders reconcile (on the tap): " + JSON.stringify(rc));
      /* S11: and what the desk queues itself (cash taken at the counter), in the same tail */
      const dp = await deskPass(env, new Date());
      await afterApproval(env, ctx, dp.approved);
      if ((rc.queued || dp.queued) && env.SALT_LEDGER) { const d = await runDrafter(env); console.log("drafter (on the tap): " + JSON.stringify(d)); await afterApproval(env, ctx, d.approved); }
    } catch (e) { console.log("orders reconcile (on the tap) FAILED: " + String((e && e.stack) || e)); }
  })());
}

function draftOnArrival(env, ctx) {
  if (!ctx || typeof ctx.waitUntil !== "function" || !env.SALT_LEDGER) return;
  ctx.waitUntil((async () => {
    try {
      const r = await runDrafter(env);
      console.log("drafter (on arrival): " + JSON.stringify(r));
      await afterApproval(env, ctx, r.approved);
      /* v759: AND NO BANNER. This road is a tap on the phone in his hand, and the desk draws the
         row under Approve while he is looking at it. The other two roads to the drafter, the
         orders reconcile and the quarter-hour net, are the ones that write a row he was not
         watching for, and they still push. The narrowing lived in the subscription until v759,
         where it silenced the morning round and every customer's row as well. */
    } catch (e) {
      console.log("drafter (on arrival) FAILED, the cron will retry: " + String((e && e.stack) || e));
    }
  })());
}

async function handleQueuePost(request, env, ctx, gateHeld = false) {
  if (!env.SALT_QUEUE) return json({ ok: false, error: "no KV binding" }, 500);
  if (!writeOk(request, env)) return needsKey();
  let payload;
  const retainedRequest = request.clone();
  try { payload = await readQueuePost(request); }
  catch (e) { return json({ ok: false, error: String(e && e.message || e) }, 400); }
  if (!gateHeld && payload.queue.some(entry => ["addid", "rename", "place"].includes(entry?.payload?.mode)))
    return vaultWriteResponse(env, () => handleQueuePost(retainedRequest, env, ctx, true));
  const queueLock = env.SALT_LEDGER
    ? await acquireDeviceQueueLock(env.SALT_LEDGER, payload.device) : null;
  if (env.SALT_LEDGER && !queueLock)
    return json({ ok: false, error: "This device queue is changing. Retry the upload." }, 409);
  try {
  /* v525: an entry whose draft was rejected never comes back, whichever device re-posts it */
  const gone = await rejectedAmong(env, payload.queue.map((e) => e && e.at));
  const withdrawn = new Set();
  if (env.SALT_LEDGER) for (const entry of payload.queue) {
    if (!entry?.at) continue;
    const receipt = await env.SALT_LEDGER.prepare(
      "SELECT id FROM maker_request WHERE id=?1 AND operation='queue-withdraw'"
    ).bind(queueWithdrawalKey(entry.at)).first();
    if (receipt) withdrawn.add(entry.at);
  }
  const kept = payload.queue.filter((entry) =>
    !(entry && (gone.has(entry.at) || withdrawn.has(entry.at))));
  if (env.VAULT_STORE === "pair" && kept.some((entry) => ["rename", "place"].includes(entry?.payload?.mode)
    || entry?.payload?.mode === "addid" && entry.payload.kind !== "bucket"))
    return json({ ok: false, error: "ID and place inputs must file the versioned ciphertext pair and transactional outbox. Upgrade this client; nothing was queued." }, 409);
  const previous = await handleQueueGet(env, true);
  const previousBody = await previous.json();
  if (!previous.ok || previousBody.ok !== true)
    return json({ ok: false, error: previousBody.error || "The server queue could not be checked; nothing was queued." }, 503);
  const previousQueue = previousBody.queue;
  const reserved = kept.some((entry) => entry && entry.payload
    && (entry.payload.mode === "repay" || entry.payload.mode === "redeem"
      || entry.payload.fields && (entry.payload.fields.rebateKg != null || entry.payload.fields.coverUnits != null)
      || entry.payload.more && entry.payload.more.coverUnits != null));
  let book, waiting = [];
  if (reserved) {
    if (!env.SALT_LEDGER) return json({ ok: false, error: "The ledger is required to check pending reward and loan inputs." }, 503);
    book = await readBook(env.SALT_LEDGER);
    if (!book.version) return json({ ok: false, error: "The mirror is being seeded. Keep the input and retry." }, 503);
    const drafts = await env.SALT_LEDGER.prepare("SELECT entry FROM draft WHERE committed_at IS NULL AND status IN ('pending','approved')").all();
    waiting = (drafts.results || []).map((row) => JSON.parse(row.entry));
  }
  for (const entry of kept) {
    const previous = previousQueue.find((queued) => queued && entry && queued.at === entry.at);
    if (previous && await makerRequestFingerprint("queue", previous) !== await makerRequestFingerprint("queue", entry))
      return json({ ok: false, error: "A queued timestamp cannot carry a changed input. Keep the original or start a new input." }, 409);
    if (reserved) {
      const fault = POSITION_ENGINE.entryReservationFault(entry, previousQueue.concat(waiting, kept), book);
      if (fault) return json({ ok: false, error: fault }, 409);
    }
  }
  let admissionSources = [];
  if (reserved) {
    const result = await admitInputs(env.SALT_LEDGER, kept, book, "device:" + payload.device);
    if (result.error) return json({ ok: false, error: result.error }, result.status);
    admissionSources = result.newSources || [];
  }
  const ownership = await recordDeviceQueueOwners(env, payload.device, kept);
  if (!ownership.ok) {
    for (const id of admissionSources) await withdrawInputAdmission(env.SALT_LEDGER, id, "device:" + payload.device);
    return json({ ok: false, error: ownership.error }, ownership.status);
  }
  // Per-device replace: this device's key holds its whole current queue, so an undo on
  // the device (which re-posts the shortened queue) is reflected rather than merged away.
  try {
    await env.SALT_QUEUE.put(QKEY(payload.device), JSON.stringify({
      updated: payload.updated, device: payload.device, queue: kept
    }));
  } catch (error) {
    return json({ ok: false, error: "The queue write is uncertain; its device receipt is kept for recovery. Retry the upload or withdraw through the same-origin recovery route." }, 503);
  }
  if (env.SALT_LEDGER) {
    const owned = await env.SALT_LEDGER.prepare("SELECT id FROM input_admission_source WHERE source=?1")
      .bind("device:" + payload.device).all();
    for (const entry of owned.results || [])
      if (!kept.some((item) => item && item.at === entry.id))
        await withdrawInputAdmission(env.SALT_LEDGER, entry.id, "device:" + payload.device);
  }
  draftOnArrival(env, ctx);
  return json({ ok: true, entries: kept.length, device: payload.device,
    dropped: gone.size, droppedAts: [...gone],
    withdrawn: withdrawn.size, withdrawnAts: [...withdrawn] });
  } finally {
    if (queueLock) await releaseDeviceQueueLock(env.SALT_LEDGER, payload.device, queueLock);
  }
}

/* the three lists the Desk's own `offered` check reads, read the way it reads them: the queue, the pending drafts, every
   refusal (Counter Maker A2). A row with a correction on its way is not offered an offset. */
async function offsetHeld(env) {
  const parse = (rows) => (rows.results || []).map((row) => { try { return JSON.parse(row.entry); } catch (e) { return null; } }).filter(Boolean);
  const queued = (await (await handleQueueGet(env, true)).json()).queue || [];
  const pending = await env.SALT_LEDGER.prepare("SELECT entry FROM draft WHERE status='pending'").all();
  const refused = await env.SALT_LEDGER.prepare("SELECT entry FROM refused").all();
  return { queued, pending: parse(pending), refused: parse(refused) };
}
/* a lock on one row's offset, in the shared receipt table: taken before the held lists are read, let go after the draft exists.
   A lock older than a minute is a crashed request's and is taken over. */
async function offsetLock(db, rid) {
  const id = "offset-lock:" + rid, now = Date.now();
  await db.prepare("DELETE FROM maker_request WHERE id=?1 AND operation='offset-lock' AND CAST(entry AS INTEGER) < ?2").bind(id, now - 60000).run();
  const taken = await db.prepare("INSERT OR IGNORE INTO maker_request(id,operation,fingerprint,entry) VALUES (?1,'offset-lock','lock',?2)").bind(id, String(now)).run();
  return taken.meta.changes === 1;
}
async function offsetUnlock(db, rid) {
  await db.prepare("DELETE FROM maker_request WHERE id=?1 AND operation='offset-lock'").bind("offset-lock:" + rid).run();
}
const makerAppointmentKinds = Object.keys(POSITION_ENGINE.ADDID_APPOINTS);
function isMakerAppointment(entry, code = null) {
  const payload = entry && entry.payload;
  return !!payload && payload.mode === "addid" && makerAppointmentKinds.includes(payload.kind)
    && typeof payload.code === "string" && (code === null || payload.code === code);
}
async function makerAppointmentEntries(env) {
  const queueResponse = await handleQueueGet(env, true);
  const queueResult = await queueResponse.json();
  if (!queueResponse.ok || queueResult.ok !== true || !Array.isArray(queueResult.queue))
    throw new Error("The Desk queue could not be verified.");
  const pending = queueResult.queue.slice();
  const drafts = await env.SALT_LEDGER.prepare(
    "SELECT entry FROM draft WHERE committed_at IS NULL AND status IN ('pending','approved')").all();
  if (!Array.isArray(drafts.results)) throw new Error("The Desk drafts could not be verified.");
  for (const row of drafts.results) {
    const entry = JSON.parse(row.entry);
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      throw new Error("A pending Desk draft has an invalid shape.");
    pending.push(entry);
  }
  const requests = await env.SALT_LEDGER.prepare(`SELECT r.entry FROM maker_request r LEFT JOIN draft d ON d.id=r.id
    WHERE r.operation='appoint-existing' AND r.entry IS NOT NULL
      AND (d.id IS NULL OR d.committed_at IS NULL AND d.status IN ('pending','approved'))`).all();
  if (!Array.isArray(requests.results)) throw new Error("The appointment receipts could not be verified.");
  for (const row of requests.results) {
    const entry = JSON.parse(row.entry);
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      throw new Error("An appointment receipt has an invalid shape.");
    pending.push(entry);
  }
  const outbox = await env.SALT_LEDGER.prepare("SELECT entry FROM vault_outbox WHERE state='pending'").all();
  if (!Array.isArray(outbox.results)) throw new Error("The encrypted-input outbox could not be verified.");
  for (const row of outbox.results) {
    const entry = JSON.parse(row.entry);
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      throw new Error("An encrypted-input outbox entry has an invalid shape.");
    pending.push(entry);
  }
  return pending;
}
function makerAppointmentCandidates(book, parties, pending) {
  const state = book.state || {};
  const departed = new Set(((state.PEOPLE && state.PEOPLE.departed) || []).map((person) => person && person.id));
  const banned = new Set(((state.PEOPLE && state.PEOPLE.banned) || [])
    .filter((person) => person && !person.lifted).map((person) => person.id));
  const suppliers = new Set((book.purchases || []).map((row) => row && row.supplier));
  const customers = new Set((book.sales || []).map((row) => row && row.customer));
  const appointments = new Set(pending.filter((entry) => isMakerAppointment(entry)).map((entry) => entry.payload.code));
  return parties.filter((code) => {
    if (typeof code !== "string" || POSITION_ENGINE.isBucket(code)
      || suppliers.has(code) || departed.has(code) || banned.has(code)
      || !customers.has(code) || appointments.has(code)) return false;
    return makerAppointmentKinds.some((kind) => {
      const plan = POSITION_ENGINE.addIdPlan(code, kind, state.roster || [], state.associates || []);
      return plan.known && plan.elevate && !plan.already && !!plan.resell;
    });
  }).sort();
}
async function handleInternalMaker(request, env, ctx, p, m, gateHeld = false, offsetLocked = false) {
  if (p !== "/_internal/maker/drafts" && p !== "/_internal/maker/inputs" && p !== "/_internal/maker/inputs/stock-count"
    && p !== "/_internal/maker/queue"
    && p !== "/_internal/maker/vault" && p !== "/_internal/maker/vault/addr" && p !== "/_internal/maker/vault/pair"
    && p !== "/_internal/maker/geo/expand"
    && p !== "/_internal/maker/trade-cover"
    && p !== "/_internal/maker/threads" && p !== "/_internal/maker/bulletin"
    && p !== "/_internal/maker/claims" && p !== "/_internal/maker/vault/key"
    && !/^\/_internal\/maker\/slips\/[a-z0-9]{4}-[a-z0-9]{4}\/[0-9a-f]{32}$/.test(p)
    && !/^\/_internal\/maker\/fixture-claims\/0000-000[01]\/a[0-9]{14}-[a-z0-9]{1,8}\/preview$/.test(p)
    && !/^\/_internal\/maker\/claims\/[a-z0-9]{4}-[a-z0-9]{4}\/a[0-9]{14}-[a-z0-9]{1,8}\/(preview|received|notfound)$/.test(p)
    && !/^\/_internal\/maker\/threads\/[a-z0-9]{4}-[a-z0-9]{4}$/.test(p)
    && !/^\/_internal\/maker\/inputs\/(sale|purchase|tier-set|tier-accept-all|house-sizes|hush|loan|repay|gift|redeem|add-id|appoint-existing|amend-id|place|ledger-amend)$/.test(p)
    && !/^\/_internal\/maker\/drafts\/[^/]+\/(approve|reject)$/.test(p)
    && !/^\/_internal\/maker\/queue\/[^/]+\/withdraw$/.test(p)
    && p !== "/_internal/maker/order-again" && p !== "/_internal/maker/words"
    && p !== "/_internal/maker/offsets" && p !== "/_internal/maker/inputs/offset"
    && !/^\/_internal\/maker\/orders\/[0-9]{14}-[a-z0-9]{1,8}\/(preview|accept|handed|cash|received|again|amend|notfound|move|restate|take)$/.test(p))
    return json({ ok: false, error: "not found" }, 404);
  if (!env.COUNTER_MAKER_KEY) return json({ ok: false, error: "Counter maker bridge is not configured" }, 503);
  if (!makerKeyMatches(request, env)) return json({ ok: false, error: "not found" }, 404);
  if (p === "/_internal/maker/queue") {
    if (m !== "GET") return json({ ok: false, error: "method not allowed" }, 405);
    const result = await makerQueueReview(env);
    return json(result, result.ok ? 200 : result.status || 503);
  }
  const queueWithdrawal = /^\/_internal\/maker\/queue\/([^/]+)\/withdraw$/.exec(p);
  if (queueWithdrawal) {
    if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
    let id;
    try { id = decodeURIComponent(queueWithdrawal[1]); }
    catch { return json({ ok: false, error: "The entry timestamp is invalid." }, 400); }
    return withdrawMakerQueueEntry(request, env, id);
  }
  if (p === "/_internal/maker/vault/key") return handleVaultKey(env, m);
  if (p === "/_internal/maker/claims") {
    if (m !== "GET") return json({ ok: false, error: "method not allowed" }, 405);
    const result = await listClaims(env, true);
    return json(result, result.ok ? 200 : 503);
  }
  const slip = /^\/_internal\/maker\/slips\/([a-z0-9]{4}-[a-z0-9]{4})\/([0-9a-f]{32})$/.exec(p);
  if (slip) {
    if (m !== "GET") return json({ ok: false, error: "method not allowed" }, 405);
    const result = await slipRelay(env, slip[1], slip[2]);
    return json(result, result.ok ? 200 : (result.status || 502));
  }
  const example = /^\/_internal\/maker\/fixture-claims\/(0000-000[01])\/(a[0-9]{14}-[a-z0-9]{1,8})\/preview$/.exec(p);
  const claim = /^\/_internal\/maker\/claims\/([a-z0-9]{4}-[a-z0-9]{4})\/(a[0-9]{14}-[a-z0-9]{1,8})\/(preview|received|notfound)$/.exec(p);
  if (example || claim) {
    if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
    let body;
    try {
      const raw = await request.text();
      if (raw.length > 1048576) return json({ ok: false, error: "request is too large" }, 413);
      body = JSON.parse(raw);
    } catch { return json({ ok: false, error: "send JSON" }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body))
      return json({ ok: false, error: "send a JSON object" }, 400);
    let result;
    if (example) result = await fixtureClaimPreview(body, example[1], example[2], body.generation);
    else {
      if (claim[1] === "0000-0000" || claim[1] === "0000-0001")
        return json({ ok: false, error: "Acceptance claims cannot use the real ledger." }, 409);
      const found = await findClaim(env, claim[2]);
      if (!found.ok) return json(found, found.status || 503);
      if (found.claim.u !== claim[1]) return json({ ok: false, error: "no such claim" }, 404);
      /* a Counter retry after a lost answer finds the verdict already given and books nothing */
      if (claim[3] !== "preview" && found.claim.state === claim[3])
        return json({ ok: true, again: true, claim: found.claim, rows: [], approved: [] });
      if (claim[3] === "preview") {
        result = await claimPreview(env, claim[2]);
        delete result.own;
      } else if (claim[3] === "notfound") result = await notFoundClaim(env, claim[2], body);
      else {
        result = await claimReceived(env, claim[2], body, "Counter Admin");
        if (result.approved?.length) await afterApproval(env, ctx, result.approved);
      }
    }
    return json(result, result.ok ? 200 : (result.status || 502));
  }
  if (p === "/_internal/maker/threads") {
    if (m !== "GET") return json({ ok: false, error: "method not allowed" }, 405);
    const result = await listThreads(env, true);
    return json(result, result.ok ? 200 : 503);
  }
  const thread = /^\/_internal\/maker\/threads\/([a-z0-9]{4}-[a-z0-9]{4})$/.exec(p);
  if (thread || p === "/_internal/maker/bulletin") {
    if (!thread && m === "GET") {
      const result = await bulletinRelay(env, "GET");
      return json(result, result.ok ? 200 : (result.status || 502));
    }
    if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
    let body;
    try {
      const text = await request.text();
      if (text.length > 4096) return json({ ok: false, error: "request is too large" }, 413);
      body = JSON.parse(text);
    } catch { return json({ ok: false, error: "send JSON" }, 400); }
    const fault = makerCommunicationFault(thread ? "thread" : "bulletin", body);
    if (fault) return json({ ok: false, error: fault }, 400);
    const result = thread ? await threadRelay(env, thread[1], body)
      : await bulletinRelay(env, "POST", { lines: body.lines, mode: "run" });
    return json(result, result.ok ? 200 : (result.status || 502));
  }
  if (p === "/_internal/maker/inputs/offset" && m === "POST" && !offsetLocked && env.SALT_LEDGER) {
    /* one offset a row at a time, the held lists read after the lock is taken: two taps under different request ids cannot both queue */
    const retained = request.clone();
    let rid = null;
    try { rid = (await request.clone().json()).rid; } catch (e) { rid = null; }
    if (typeof rid === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(rid)) {
      if (!await offsetLock(env.SALT_LEDGER, rid))
        return json({ ok: false, error: "Another offset on this row is being recorded. Retry in a moment." }, 409);
      try { return await handleInternalMaker(retained, env, ctx, p, m, gateHeld, true); }
      finally { await offsetUnlock(env.SALT_LEDGER, rid); }
    }
  }
  if (!gateHeld && m === "POST" && /^\/_internal\/maker\/inputs\/(add-id|amend-id|place)$/.test(p))
    return vaultWriteResponse(env, () => handleInternalMaker(request, env, ctx, p, m, true));
  if (p === "/_internal/maker/vault/pair") {
    if (m !== "GET") return json({ ok: false, error: "method not allowed" }, 405);
    return handleVaultPair(request, env, m);
  }
  if (p === "/_internal/maker/geo/expand") {
    if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
    return handleGeoExpand(request);
  }
  if (p === "/_internal/maker/vault" || p === "/_internal/maker/vault/addr") {
    if (m !== "GET") return json({ ok: false, error: "method not allowed" }, 405);
    if (env.VAULT_STORE === "pair") {
      const pair = await readVaultPair(env.SALT_LEDGER);
      return pair.ok ? json({ ok: true, vault: p.endsWith("/addr") ? pair.places : pair.names,
        revision: pair.revision, updated: pair.updated }) : json(pair, pair.status);
    }
    if (!env.SALT_QUEUE) return json({ ok: false, error: "the Desk vault store is required" }, 503);
    const key = p.endsWith("/addr") ? AKEY : VKEY;
    const raw = await env.SALT_QUEUE.get(key);
    if (!raw) return json({ ok: true, vault: null });
    let stored;
    try { stored = JSON.parse(raw); } catch (error) {
      return json({ ok: false, error: "the encrypted vault record is unreadable" }, 503);
    }
    const vault = key === VKEY ? stored.vault : stored.vault;
    return vault == null || isSealed(vault)
      ? json({ ok: true, vault: vault || null })
      : json({ ok: false, error: "the encrypted vault record has an invalid envelope" }, 503);
  }
  if (p === "/_internal/maker/inputs") {
    if (m !== "GET") return json({ ok: false, error: "method not allowed" }, 405);
    if (!env.SALT_LEDGER) return json({ ok: false, error: "the Desk mirror is required" }, 503);
    const book = await readBook(env.SALT_LEDGER);
    if (!book.version) return json({ ok: false, error: "the mirror is being seeded" }, 503);
    let registrations = [];
    if (env.VAULT_STORE === "pair") {
      try { registrations = await readVaultRegistrations(env.SALT_LEDGER); }
      catch (error) { return json({ ok: false, error: "Confirmed Add IDs could not be verified against the vault receipts and outbox." }, 503); }
    }
    const catalog = makerInputCatalog(book, await hushGet(env.SALT_QUEUE), await reservedInputs(env.SALT_LEDGER, book), registrations);
    if (catalog.error) return json({ ok: false, error: catalog.error }, 503);
    try {
      catalog.appointmentCustomers = makerAppointmentCandidates(book, catalog.parties, await makerAppointmentEntries(env));
      catalog.appointmentKinds = makerAppointmentKinds.map((kind) => ({
        kind, stream: POSITION_ENGINE.ADDID_APPOINTS[kind]
      }));
    } catch (error) {
      return json({ ok: false, error: String(error && error.message || error) }, 503);
    }
    return json({ ok: true, products: Object.keys(book.state.PRODUCTS || {}).filter((product) => !book.state.PRODUCTS[product].retired),
      catalog });
  }
  if (p === "/_internal/maker/trade-cover") {
    if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
    if (!env.SALT_LEDGER) return json({ ok: false, error: "The Desk mirror is required." }, 503);
    let body;
    try { body = JSON.parse(await request.text()); }
    catch { return json({ ok: false, error: "send JSON" }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)
      || Object.keys(body).some((key) => !["product", "party", "qty", "total", "stream"].includes(key))
      || typeof body.qty !== "number" || !Number.isFinite(body.qty) || body.qty <= 0 || body.qty > 1000000
      || typeof body.total !== "number" || !Number.isFinite(body.total) || body.total < 0 || body.total > 1000000)
      return json({ ok: false, error: "Choose a book, party, units and goods total for the cover reading." }, 400);
    const book = await readBook(env.SALT_LEDGER);
    if (!book.version) return json({ ok: false, error: "The mirror is being seeded." }, 503);
    return json({ ok: true, cover: makerCoverPlan(body, book, await reservedInputs(env.SALT_LEDGER, book)) });
  }
  if (p === "/_internal/maker/offsets") {
    /* Counter Maker A2: what the Desk's autoOffsets would offer, derived here from the mirror and never priced (a read) */
    if (m !== "GET") return json({ ok: false, error: "method not allowed" }, 405);
    if (!env.SALT_LEDGER || !env.SALT_QUEUE) return json({ ok: false, error: "the Desk queue and mirror are required" }, 503);
    const book = await readBook(env.SALT_LEDGER);
    if (!book.version) return json({ ok: false, error: "the mirror is being seeded" }, 503);
    let held;
    try { held = await offsetHeld(env); }
    catch (error) { return json({ ok: false, error: String(error && error.message || error) }, 503); }
    const listed = makerOffsetOffers(book, held);
    return listed.error ? json({ ok: false, error: listed.error }, 503) : json({ ok: true, version: book.version, offers: listed.offers });
  }
  if (p === "/_internal/maker/drafts") {
    if (m !== "GET") return json({ ok: false, error: "method not allowed" }, 405);
    return handleDraftsGet(env, new URL(request.url));
  }
  if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
  if (p === "/_internal/maker/order-again" || p === "/_internal/maker/words") {
    let body;
    try {
      const text = await request.text();
      if (text.length > 16384) return json({ ok: false, error: "request is too large" }, 413);
      body = JSON.parse(text);
    } catch { return json({ ok: false, error: "send JSON" }, 400); }
    const list = body && Object.keys(body).length === 1 && (p.endsWith("/words") ? body.texts : body.ids);
    if (!Array.isArray(list) || list.length > 200 || list.some((x) => typeof x !== "string" || x.length > 240)
      || !p.endsWith("/words") && list.some((x) => !/^[0-9]{14}-[a-z0-9]{1,8}$/.test(x)))
      return json({ ok: false, error: p.endsWith("/words") ? "Send only the texts to check." : "Send only order ids." }, 400);
    if (p.endsWith("/words")) {
      for (const text of list) {
        const why = siteWords(text);
        if (why) return json({ ok: false, error: "that text says something " + why }, 400);
      }
      return json({ ok: true });
    }
    if (!env.SALT_LEDGER) return json({ ok: false, error: "the Desk mirror is required" }, 503);
    return json({ ok: true, again: await againOf(env.SALT_LEDGER, list) });
  }
  if (p === "/_internal/maker/inputs/offset"
    || /^\/_internal\/maker\/inputs\/(stock-count|sale|purchase|tier-set|tier-accept-all|house-sizes|hush|loan|repay|gift|redeem|add-id|appoint-existing|amend-id|place|ledger-amend)$/.test(p)) {
    let body;
    try {
      const text = await request.text();
      if (text.length > 1_048_576) return json({ ok: false, error: "request is too large" }, 413);
      body = JSON.parse(text);
    } catch (error) { return json({ ok: false, error: "send JSON" }, 400); }
    const operation = p.split("/").pop();
    if (env.VAULT_STORE === "pair" && ["add-id", "amend-id", "place"].includes(operation)
      && !(operation === "add-id" && body?.kind === "bucket"))
      return handleVaultInput(env, operation, body);
    if (!env.SALT_LEDGER || !env.SALT_QUEUE) return json({ ok: false, error: "the Desk queue and mirror are required" }, 503);
    const book = await readBook(env.SALT_LEDGER);
    if (!book.version) return json({ ok: false, error: "the mirror is being seeded" }, 503);
    if (!body || typeof body !== "object" || Array.isArray(body)
      || typeof body.at !== "string" || !Number.isFinite(Date.parse(body.at))
      || new Date(body.at).toISOString() !== body.at)
      return json({ ok: false, error: "The input needs its canonical request timestamp." }, 400);
    const fingerprint = await makerRequestFingerprint(operation, body);
    const previous = await makerRequestRead(env.SALT_LEDGER, body.at, operation, fingerprint);
    if (previous?.pending) return resumeMakerInput(env, previous.pending, fingerprint);
    if (previous) return json(previous.response || { ok: false, error: previous.error }, previous.response ? 200 : 409);
    let appointmentPlan = null;
    if (operation === "appoint-existing") {
      if (Object.keys(body).length !== 3 || !Object.hasOwn(body, "code") || !Object.hasOwn(body, "kind")
        || !/^[A-Z]{1,3}[0-9]{0,2}[A-Z0-9-]*$/.test(body.code)
        || !makerAppointmentKinds.includes(body.kind))
        return json({ ok: false, error: "An existing-customer appointment carries only its timestamp, code and role." }, 400);
      try {
        const candidates = makerAppointmentCandidates(book, makerInputCatalog(book).parties, await makerAppointmentEntries(env));
        if (!candidates.includes(body.code))
          return json({ ok: false, error: "Choose an eligible existing customer; that ID is no longer available for appointment." }, 409);
        appointmentPlan = POSITION_ENGINE.addIdPlan(body.code, body.kind, book.state.roster || [], book.state.associates || []);
        if (!appointmentPlan.elevate || appointmentPlan.already || !appointmentPlan.resell)
          return json({ ok: false, error: "That customer cannot be appointed from the current roster state." }, 409);
      } catch (error) {
        return json({ ok: false, error: String(error && error.message || error) }, 503);
      }
    }
    if (operation === "stock-count"
      && !makerInputCatalog(book).products.some((item) => item.product === body.product))
      return json({ ok: false, error: "Choose an active book for the stock count." }, 400);
    /* the Desk's tierQueued: tiers already queued or waiting under Approve are not proposed again */
    const waitingTiers = operation !== "tier-accept-all" ? [] : (await (await handleQueueGet(env, true)).json()).queue.concat(
      ((await env.SALT_LEDGER.prepare("SELECT entry FROM draft WHERE committed_at IS NULL AND status IN ('pending','approved')").all()).results || [])
        .map((row) => JSON.parse(row.entry)));
    if (operation === "hush") {
      /* the hush map in KV, written once per request id: no queue entry, no draft, no fold */
      const made = makerHush(body, book);
      if (made.error) return json({ ok: false, ...made }, 400);
      if (!await makerRequestClaim(env.SALT_LEDGER, body.at, operation, fingerprint))
        return json({ ok: false, error: "That input is already being recorded. Retry the original request." }, 409);
      await hushPut(env.SALT_QUEUE, made.id, made.until, made.today);
      const response = { ok: true, hushed: made.id, until: made.until };
      await makerRequestFinish(env.SALT_LEDGER, body.at, fingerprint, response);
      return json(response);
    }
    let held = null;
    if (operation === "offset") {
      try { held = await offsetHeld(env); }
      catch (error) { return json({ ok: false, error: String(error && error.message || error) }, 503); }
    }
    const resourcePending = ["sale", "redeem"].includes(operation) ? await reservedInputs(env.SALT_LEDGER, book) : [];
    let registrations = [];
    if (["sale", "purchase"].includes(operation) && env.VAULT_STORE === "pair") {
      try { registrations = await readVaultRegistrations(env.SALT_LEDGER); }
      catch (error) { return json({ ok: false, error: "Confirmed Add IDs could not be verified against the vault receipts and outbox." }, 503); }
    }
    const built = operation === "appoint-existing"
      ? { entry: POSITION_ENGINE.addIdEntry({ at: body.at, code: body.code, kind: body.kind,
        parent: null, rev: appointmentPlan.stream, geo: null, tiers: null }) }
      : operation === "stock-count" ? makerStockCount(body)
      : operation === "tier-accept-all" ? makerTierAcceptAll(body, book, waitingTiers)
      : operation === "house-sizes" ? makerHouseSizes(body, book)
      : operation === "tier-set" ? makerTierSet(body, book)
        : operation === "ledger-amend" ? makerLedgerAmendment(body, book)
          : operation === "offset" ? makerOffset(body, book, held)
          : ["sale", "purchase"].includes(operation) ? makerTradeBatch(operation, body, book, resourcePending, registrations)
          : makerLedgerInput(operation, body, book, resourcePending);
    if (built.error) return json({ ok: false, ...built }, built.twin ? 409 : 400);
    if (built.entries) {
      const entries = built.entries;
      entries.forEach((entry) => { entry.makerRequest = fingerprint; });
      const queued = (await (await handleQueueGet(env, true)).json()).queue;
      const waiting = await env.SALT_LEDGER.prepare("SELECT entry FROM draft WHERE committed_at IS NULL AND status IN ('pending','approved')").all();
      const held = queued.concat((waiting.results || []).map((row) => JSON.parse(row.entry)));
      for (const [i, entry] of entries.entries()) {
        const stored = await env.SALT_LEDGER.prepare("SELECT entry FROM draft WHERE id=?1").bind(entry.at).first();
        const others = held.concat(stored ? [JSON.parse(stored.entry)] : []);
        const checked = makerQueuedTradeCheck(entry, others);
        if (checked.error) return json({ ok: false, ...checked }, 409);
        const reserved = POSITION_ENGINE.entryReservationFault(entry, others.concat(entries.slice(0, i)), book);
        if (reserved) return json({ ok: false, error: reserved }, 409);
        const fault = await tripCheck(env.SALT_LEDGER, book, built.drafts[i].row,
          built.drafts.slice(0, i).map((draft) => draft.row), []);
        if (fault) return json({ ok: false, error: fault }, 409);
      }
      if (!await makerRequestClaim(env.SALT_LEDGER, body.at, operation, fingerprint, entries)) {
        const raced = await makerRequestRead(env.SALT_LEDGER, body.at, operation, fingerprint);
        if (raced?.pending) return resumeMakerInput(env, raced.pending, fingerprint);
        return json(raced?.response || { ok: false, error: raced?.error || "Retry the original request." }, raced?.response ? 200 : 409);
      }
      return resumeMakerInput(env, entries, fingerprint);
    }
    const entry = built.entry;
    if (built.vaultOnly) {
      if (!await makerRequestClaim(env.SALT_LEDGER, body.at, operation, fingerprint))
        return json({ ok: false, error: "That input is already being recorded. Retry the original request." }, 409);
      const envelope = built.vault;
      await env.SALT_QUEUE.put(VKEY, JSON.stringify({ updated: new Date().toISOString(), vault: envelope, ids: null, locs: null }));
      if (body.addrVault) await env.SALT_QUEUE.put(AKEY, JSON.stringify({ updated: new Date().toISOString(), vault: body.addrVault }));
      const response = { ok: true, vaultOnly: true };
      await makerRequestFinish(env.SALT_LEDGER, body.at, fingerprint, response);
      return json(response);
    }

    async function resumeMakerInput(env, entry, fingerprint) {
      const entries = Array.isArray(entry) ? entry : [entry];
      if (entries.some((item) => item.makerRequest !== fingerprint))
        return json({ ok: false, error: "The retained Maker input fingerprint is invalid." }, 409);
      try {
        if (Array.isArray(entry) && entry.some((item) => POSITION_ENGINE.inputConsumesResource(item)))
          await queueResourceTrades(env, entry);
        else await queueSale(env, entry, true);
      }
      catch (error) {
        if (error.status !== 409 && error.status !== 503) throw error;
        return json({ ok: false, error: error.message }, error.status);
      }
      await runDrafter(env);
      const drafts = [];
      for (const item of entries) {
        const draft = await env.SALT_LEDGER.prepare("SELECT status,entry FROM draft WHERE id=?1").bind(item.at).first();
        if (!draft || JSON.parse(draft.entry).makerRequest !== fingerprint)
          return json({ ok: false, error: "The immutable input has not reached its draft. Keep the original request for recovery." }, 503);
        drafts.push({ id: item.at, status: draft.status });
      }
      const response = { ok: true, queued: false, draft: entries[0].at, status: drafts[0].status,
        ...(Array.isArray(entry) ? { drafts, trip: entries[0].payload.trip || null } : {}) };
      await makerRequestFinish(env.SALT_LEDGER, entries[0].at, fingerprint, response);
      return json(response);
    }
    entry.makerRequest = fingerprint;
    const writesNameVault = operation === "amend-id" || operation === "add-id" && body.kind !== "bucket";
    if (writesNameVault && !isSealed(body.vault))
      return json({ ok: false, error: "File the encrypted vault on this device before adding the ID." }, 400);
    const proposed = draftRow(entry, book);
    if (proposed.skip) return json({ ok: false, error: proposed.skip }, 409);
    if (operation === "ledger-amend" || operation === "offset" || operation === "redeem" && entry.payload.mode === "amend") {
      const roomFault = await makerAmendmentRoom(env.SALT_LEDGER, entry, book);
      if (roomFault) return json({ ok: false, error: roomFault }, 409);
    }
    const stored = await env.SALT_LEDGER.prepare("SELECT entry,status FROM draft WHERE id=?1").bind(entry.at).first();
    const queuedEntries = (await (await handleQueueGet(env, true)).json()).queue;
    if (stored) queuedEntries.push(JSON.parse(stored.entry));
    const collision = queuedEntries.find((queued) => queued.at === entry.at && JSON.stringify(queued) !== JSON.stringify(entry));
    if (collision) return json({ ok: false, error: "That request timestamp already names another entry. Start a new input." }, 409);
    if (operation === "sale" || operation === "purchase") {
      const pending = await env.SALT_LEDGER.prepare("SELECT entry FROM draft WHERE status='pending'").all();
      const checked = makerQueuedTradeCheck(entry, queuedEntries.concat((pending.results || []).map((row) => JSON.parse(row.entry))));
      if (checked.error) return json({ ok: false, ...checked }, 409);
    }
    const reservations = await env.SALT_LEDGER.prepare("SELECT entry FROM draft WHERE committed_at IS NULL AND status IN ('pending','approved')").all();
    const reservedFault = POSITION_ENGINE.entryReservationFault(entry,
      queuedEntries.concat((reservations.results || []).map((row) => JSON.parse(row.entry))), book);
    if (reservedFault) return json({ ok: false, error: reservedFault }, 409);
    if (operation === "appoint-existing") {
      let held;
      try { held = await makerAppointmentEntries(env); }
      catch (error) { return json({ ok: false, error: String(error && error.message || error) }, 503); }
      if (held.some((item) => isMakerAppointment(item, body.code)))
        return json({ ok: false, error: "An appointment for this ID is already queued or waiting for approval." }, 409);
      const claim = await makerAppointmentClaim(env.SALT_LEDGER, body.at, fingerprint, entry, body.code);
      if (claim.existing) {
        if (claim.existing.pending) return resumeMakerInput(env, claim.existing.pending, fingerprint);
        if (claim.existing.response) return json(claim.existing.response);
        return json({ ok: false, error: claim.existing.error || "Retry the original appointment request." }, 409);
      }
      if (claim.error) return json({ ok: false, error: claim.error }, 409);
      return resumeMakerInput(env, entry, fingerprint);
    }
    const admission = writesNameVault || body.addrVault
      ? await admitInput(env.SALT_LEDGER, entry, book, "orders") : {};
    if (admission.error) return json({ ok: false, error: admission.error }, admission.status);
    if (!await makerRequestClaim(env.SALT_LEDGER, body.at, operation, fingerprint, writesNameVault || body.addrVault ? null : entry)) {
      const raced = await makerRequestRead(env.SALT_LEDGER, body.at, operation, fingerprint);
      if (raced?.pending) return resumeMakerInput(env, raced.pending, fingerprint);
      return json(raced?.response || { ok: false, error: raced?.error || "Retry the original request." }, raced?.response ? 200 : 409);
    }
    if (!writesNameVault && !body.addrVault) return resumeMakerInput(env, entry, fingerprint);
    if (writesNameVault) {
      await env.SALT_QUEUE.put(VKEY, JSON.stringify({ updated: new Date().toISOString(), vault: body.vault, ids: null, locs: null }));
    }
    if (body.addrVault) await env.SALT_QUEUE.put(AKEY, JSON.stringify({ updated: new Date().toISOString(), vault: body.addrVault }));
    let queued;
    try { queued = await queueSale(env, entry); }
    catch (error) {
      if (error.status !== 409 && error.status !== 503) throw error;
      if (admission.newSource) await withdrawInputAdmission(env.SALT_LEDGER, entry.at, "orders");
      return json({ ok: false, error: error.message }, error.status);
    }
    await runDrafter(env);
    const draft = await env.SALT_LEDGER.prepare("SELECT status FROM draft WHERE id=?1").bind(entry.at).first();
    const response = { ok: true, queued, draft: entry.at, status: draft ? draft.status : "queued" };
    await makerRequestFinish(env.SALT_LEDGER, body.at, fingerprint, { ...response, queued: false });
    return json(response);
  }
  const orderMatch = /^\/_internal\/maker\/orders\/([0-9]{14}-[a-z0-9]{1,8})\/(preview|accept|handed|cash|received|again|amend|notfound|move|restate|take)$/.exec(p);
  if (orderMatch) {
    let body;
    try {
      const text = await request.text();
      if (text.length > 16384) return json({ ok: false, error: "request is too large" }, 413);
      body = JSON.parse(text);
    } catch (e) { return json({ ok: false, error: "send JSON" }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ ok: false, error: "send a JSON object" }, 400);
    const fault = makerOrderFault(orderMatch[2], body);
    if (fault) return json({ ok: false, error: fault }, 400);
    const id = orderMatch[1];
    const action = orderMatch[2];
    let result;
    try {
      if (action === "amend") result = await amendOrder(env, id, body);
      /* Negotiate: their Accept on his offer, told by the Counter at once; the minute's deskPass is the net */
      else if (action === "take") {
        result = await takeOffer(env, id);
        const others = ((result.drafted && result.drafted.approved) || []).filter((x) => x !== result.draft);
        if (others.length) await afterApproval(env, ctx, others);
        else if (result.approved) stageOnApproval(env, ctx);
      }
      else if (action === "notfound") result = await notFoundOrder(env, id, body);
      else if (action === "move") {
        /* his reply, No reply needed, Ready, Decline or Cancel: moveOrder checks every word through siteWords */
        const found = await findOrder(env, id);
        if (!found.ok) result = found;
        else if (found.order.u === "0000-0000" || found.order.u === "0000-0001")
          result = { ok: false, status: 409, error: "Acceptance orders cannot use the real order book." };
        else {
          /* `maker` makes the order book hold Ready to an acknowledged order and Cancel (his decision of 05 Oct 2026) to
             one with nothing paid, in the same step as the move; a claim waiting and goods out refuse it as for the Desk */
          result = await moveOrder(env, found.order.u, id, body.status ? { ...body, maker: true } : body);
          if (result.ok && body.status) reconcileOnTap(env, ctx);
        }
      }
      else if (action === "preview") result = await previewOrder(env, id, body);
      else if (action === "accept") {
        result = await acceptOrder(env, id, body, "Counter Admin");
        const others = ((result.drafted && result.drafted.approved) || []).filter((x) => x !== result.draft);
        if (others.length) await afterApproval(env, ctx, others);
        else if (result.approved) stageOnApproval(env, ctx);
      } else {
        /* a handover, a close, cash, a Received or a move offered again carries its request id: a retry is answered from the first answer */
        const { rid, ...rest } = body;
        const tap = () => ({ handed: handedOrder, cash: cashOrder, restate: restateOrder, received: receivedOrder, again: againOrder })[action](
          env, id, rest, "Counter Admin"
        );
        result = !rid ? await tap() : !env.SALT_LEDGER ? { ok: false, status: 503, error: "the desk has no ledger binding, so no row can be drafted" }
          : await makerOrderOnce(env.SALT_LEDGER, rid, action, { id, ...rest }, tap);
        if (result.ok && !result.again && result.preapproval && result.preapproval.spent === "applied")
          await afterApproval(env, ctx, [result.preapproval.draft]);
        if (result.ok && !result.again) reconcileOnTap(env, ctx);
      }
    } catch (e) { result = { ok: false, status: 500, error: String((e && e.message) || e) }; }
    return json(result, result.ok ? 200 : (result.status || 502));
  }
  const match = /^\/_internal\/maker\/drafts\/([^/]+)\/(approve|reject)$/.exec(p);
  let id;
  try { id = decodeURIComponent(match[1]); } catch (e) { return json({ ok: false, error: "invalid draft id" }, 400); }
  if (!id || id.length > 40) return json({ ok: false, error: "invalid draft id" }, 400);
  if (!Number.isFinite(Date.parse(id)) || new Date(id).toISOString() !== id)
    return json({ ok: false, error: "invalid draft timestamp" }, 400);
  let body;
  try { body = await request.json(); } catch (e) { return json({ ok: false, error: "send JSON" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length)
    return json({ ok: false, error: "draft decisions take an empty object" }, 400);
  const decision = match[2] === "approve" ? "approved" : "rejected";
  const internal = new Request(request.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Salt-Key": String(env.SALT_WRITE_KEY || "")
    },
    body: JSON.stringify({ by: "Counter Admin" })
  });
  return handleDraftDecide(internal, env, ctx, id, decision);
}

/* v525: a rejected entry is dropped from every queue (dropQueued, src/orders.js, which a withdrawal
   uses too since S11 11.10), and a queue POST drops any entry whose draft was rejected, so no device
   can bring it back. */
async function rejectedAmong(env, ats) {
  const out = new Set();
  if (!env.SALT_LEDGER) return out;
  for (const at of ats) {
    if (!at) continue;
    try { const r = await env.SALT_LEDGER.prepare("SELECT status FROM draft WHERE id=?1").bind(at).first(); if (r && r.status === "rejected") out.add(at); }
    catch (e) { /* a store that cannot answer keeps the entry */ }
  }
  return out;
}

const canonicalQueueAt = (value) => typeof value === "string" && Number.isFinite(Date.parse(value))
  && new Date(value).toISOString() === value;

async function deviceQueueRecords(env) {
  if (!env.SALT_QUEUE) throw new Error("The Desk queue is unavailable.");
  const records = [];
  let cursor;
  do {
    const page = await env.SALT_QUEUE.list({ prefix: "q:", cursor });
    for (const key of page.keys) {
      if (key.name === "q:orders" || key.name.startsWith("q:orders:")) continue;
      const device = key.name.slice(2);
      if (!DEVICE_RE.test(device) || device === "orders" || device.includes(":")) continue;
      const raw = await env.SALT_QUEUE.get(key.name);
      if (raw == null) continue;
      let record;
      try { record = JSON.parse(raw); }
      catch { throw new Error("A device queue could not be read; no withdrawal was made."); }
      if (!record || record.device !== device || !Array.isArray(record.queue))
        throw new Error("A device queue has no matching owner record; no withdrawal was made.");
      records.push({ key: key.name, device, record });
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return records;
}

async function recordDeviceQueueOwners(env, device, entries) {
  if (!env.SALT_LEDGER || device === "anon") return { ok: true };
  let records;
  try { records = await deviceQueueRecords(env); }
  catch (error) { return { ok: false, status: 503, error: String(error && error.message || error) }; }
  for (const entry of entries) {
    if (!entry || !canonicalQueueAt(entry.at)) continue;
    const fingerprint = await makerRequestFingerprint("server-queue-entry", entry);
    const otherOwner = records.some(({ device: owner, record }) => owner !== device
      && record.queue.some((held) => held?.at === entry.at));
    if (otherOwner) return { ok: false, status: 409, error: "That timestamp is already held by another device." };
    const key = queueOwnerKey(entry.at), owner = JSON.stringify({ device, fingerprint });
    const current = await env.SALT_LEDGER.prepare("SELECT operation,fingerprint,entry FROM maker_request WHERE id=?1")
      .bind(key).first();
    if (current) {
      let saved;
      try { saved = JSON.parse(current.entry); } catch { saved = null; }
      if (current.operation !== "queue-owner" || current.fingerprint !== fingerprint
        || saved?.device !== device || saved?.fingerprint !== fingerprint)
        return { ok: false, status: 409, error: "That timestamp already names another device entry." };
      continue;
    }
    const draft = await env.SALT_LEDGER.prepare("SELECT entry FROM draft WHERE id=?1").bind(entry.at).first();
    if (draft) {
      let drafted;
      try { drafted = JSON.parse(draft.entry); } catch { drafted = null; }
      if (!drafted || await makerRequestFingerprint("server-queue-entry", drafted) !== fingerprint)
        return { ok: false, status: 409, error: "That drafted timestamp does not match this device entry." };
    }
    await env.SALT_LEDGER.prepare(`INSERT OR IGNORE INTO maker_request(id,operation,fingerprint,entry)
      VALUES (?1,'queue-owner',?2,?3)`).bind(key, fingerprint, owner).run();
    const saved = await env.SALT_LEDGER.prepare("SELECT operation,fingerprint,entry FROM maker_request WHERE id=?1")
      .bind(key).first();
    let proof;
    try { proof = JSON.parse(saved?.entry); } catch { proof = null; }
    if (saved?.operation !== "queue-owner" || saved.fingerprint !== fingerprint
      || proof?.device !== device || proof?.fingerprint !== fingerprint)
      return { ok: false, status: 409, error: "That timestamp's device ownership could not be recorded." };
  }
  return { ok: true };
}

async function makerQueueReview(env) {
  if (!env.SALT_LEDGER || !env.SALT_QUEUE)
    return { ok: false, status: 503, error: "The Desk queue and ledger are required for server-held review." };
  const records = await deviceQueueRecords(env);
  const [draftRows, refusalRows, sourceRows, admissionRows, withdrawalRows] = await Promise.all([
    env.SALT_LEDGER.prepare("SELECT id,status,committed_at FROM draft").all(),
    env.SALT_LEDGER.prepare("SELECT id,entry,why,source,seen_at FROM refused WHERE source='cloud-drafter'").all(),
    env.SALT_LEDGER.prepare("SELECT id,source FROM input_admission_source").all(),
    env.SALT_LEDGER.prepare("SELECT id,state FROM input_admission").all(),
    env.SALT_LEDGER.prepare("SELECT id,entry,response FROM maker_request WHERE operation='queue-withdraw'").all()
  ]);
  const drafts = new Map((draftRows.results || []).map((row) => [row.id, row]));
  const refusals = new Map((refusalRows.results || []).map((row) => [row.id, row]));
  const sources = new Map(), admissions = new Map();
  for (const row of sourceRows.results || []) {
    const list = sources.get(row.id) || [];
    list.push(row.source);
    sources.set(row.id, list);
  }
  for (const row of admissionRows.results || []) admissions.set(row.id, row.state);
  const withdrawals = new Map();
  for (const row of withdrawalRows.results || []) {
    const id = row.id.slice("queue-withdraw:".length);
    if (!canonicalQueueAt(id)) continue;
    let entry = null;
    try { entry = JSON.parse(row.entry); } catch { /* an unreadable receipt is not actionable */ }
    withdrawals.set(id, { entry, pending: !row.response });
  }
  const held = new Map();
  for (const { device, record } of records) for (const entry of record.queue) {
    if (!entry || !canonicalQueueAt(entry.at)) continue;
    const list = held.get(entry.at) || [];
    list.push({ device, entry });
    held.set(entry.at, list);
  }
  const ids = new Set([...held.keys(), ...refusals.keys(),
    ...[...withdrawals].filter(([, receipt]) => receipt.pending).map(([id]) => id)]);
  const entries = [];
  for (const id of [...ids].sort()) {
    if (!canonicalQueueAt(id)) continue;
    const owners = held.get(id) || [];
    const refusal = refusals.get(id) || null;
    const withdrawal = withdrawals.get(id) || null;
    if (withdrawal && !withdrawal.pending) continue;
    let refusedEntry = null;
    if (refusal) {
      try { refusedEntry = JSON.parse(refusal.entry); } catch { /* keep the authoritative reason */ }
    }
    const owner = owners.length === 1 ? owners[0] : null;
    const draft = drafts.get(id) || null;
    const admissionSources = sources.get(id) || [];
    const admissionState = admissions.get(id) || null;
    const ownedSource = owner && (admissionState || admissionSources.length
      ? admissionSources.includes("device:" + owner.device) && admissionSources.every((source) =>
        source === "device:" + owner.device || source === "drafter")
      : true);
    const canWithdraw = !!owner && owner.device !== "anon" && !draft && (!admissionState || admissionState === "accepted")
      && ownedSource && !withdrawal;
    const fingerprint = owner ? await makerRequestFingerprint("server-queue-entry", owner.entry) : null;
    entries.push({
      id,
      date: (owner?.entry && (owner.entry.date || owner.entry.payload?.date))
        || (refusedEntry && (refusedEntry.date || refusedEntry.payload?.date)) || null,
      mode: (owner?.entry && owner.entry.payload?.mode)
        || (refusedEntry && refusedEntry.payload?.mode) || null,
      device: owner?.device || withdrawal?.entry?.device || null,
      devices: owners.map((item) => item.device),
      state: withdrawal?.pending ? "withdrawal-pending"
        : draft?.committed_at ? "committed"
          : draft?.status === "approved" ? "approved"
            : draft ? "drafted" : refusal ? "refused" : "queued",
      why: refusal?.why || null,
      refusalSource: refusal?.source || null,
      seenAt: refusal?.seen_at || null,
      fingerprint: fingerprint || withdrawal?.entry?.fingerprint || null,
      canWithdraw,
      canRetry: !!withdrawal?.pending,
      unavailable: owners.length > 1 ? "More than one device holds this timestamp."
        : withdrawal?.pending ? "Withdrawal is recorded; retry to finish removing it."
          : !owners.length ? "No server-held device entry matches this refusal."
            : owner?.device === "anon" ? "This legacy queue has no uniquely identified device owner."
            : draft?.status === "pending" ? "This entry is drafted; reject it under Desk rows."
              : draft?.status === "approved" || draft?.committed_at ? "This entry is approved or committed and cannot be withdrawn."
                : draft ? "This entry has already been decided and cannot be withdrawn."
                  : !ownedSource || admissionState && admissionState !== "accepted"
                    ? "The active admission is not owned solely by this device."
                    : null
    });
  }
  return { ok: true, entries };
}

function queueDraftConflict(draft) {
  if (!draft) return null;
  const state = draft.committed_at ? "committed"
    : draft.status === "approved" ? "approved"
      : draft.status === "pending" ? "drafted" : draft.status === "rejected" ? "rejected" : "already-decided";
  if (state === "rejected") return null;
  const error = state === "drafted" ? "This entry is drafted; reject it under Desk rows."
    : state === "approved" || state === "committed" ? "This entry is approved or committed and cannot be withdrawn."
      : "This entry has already been decided and cannot be withdrawn.";
  return json({ ok: false, state, error }, 409);
}

async function withdrawMakerQueueEntry(request, env, id, requireDevice = false) {
  if (!env.SALT_QUEUE || !env.SALT_LEDGER)
    return json({ ok: false, state: "withdrawal-pending", error: "The Desk queue and ledger are required for withdrawal." }, 503);
  if (!canonicalQueueAt(id)) return json({ ok: false, state: "entry-changed", error: "The entry timestamp is invalid." }, 400);
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return json({ ok: false, error: "request is too large" }, 413);
    body = JSON.parse(raw);
  } catch { return json({ ok: false, state: "entry-changed", error: "send JSON" }, 400); }
  const fields = requireDevice ? ["device", "fingerprint"] : ["fingerprint"];
  if (!body || typeof body !== "object" || Array.isArray(body)
    || Object.keys(body).length !== fields.length || Object.keys(body).some((key) => !fields.includes(key))
    || !/^[0-9a-f]{64}$/.test(body.fingerprint || "")
    || requireDevice && (!DEVICE_RE.test(body.device || "") || body.device === "anon"))
    return json({ ok: false, state: "entry-changed", error: "Send the server-held entry identity." }, 400);
  const requestedDevice = requireDevice ? body.device : null;

  const key = queueWithdrawalKey(id);
  let receipt = await env.SALT_LEDGER.prepare(
    "SELECT operation,fingerprint,entry,response FROM maker_request WHERE id=?1"
  ).bind(key).first();
  let savedOwner = null;
  if (receipt) {
    try { savedOwner = JSON.parse(receipt.entry); } catch { savedOwner = null; }
    if (receipt.operation !== "queue-withdraw" || !/^[0-9a-f]{64}$/.test(receipt.fingerprint || "")
      || !savedOwner || !DEVICE_RE.test(savedOwner.device || "") || savedOwner.device === "anon"
      || savedOwner.fingerprint !== receipt.fingerprint || requestedDevice && requestedDevice !== savedOwner.device)
      return json({ ok: false, state: "ownership-conflict", error: "That timestamp already names another server withdrawal." }, 409);
    if (receipt.fingerprint !== body.fingerprint)
      return json({ ok: false, state: "entry-changed",
        error: "The saved withdrawal belongs to a different entry identity; its answer cannot confirm this local copy." }, 409);
    if (receipt.response) {
      let answer;
      try { answer = JSON.parse(receipt.response); }
      catch { return json({ ok: false, state: "withdrawal-pending", error: "The saved withdrawal answer is unreadable." }, 503); }
      return json({ ...answer, again: true });
    }
  }

  let records;
  try { records = await deviceQueueRecords(env); }
  catch (error) { return json({ ok: false, state: "withdrawal-pending", error: String(error && error.message || error) }, 503); }
  let matches = records.flatMap(({ device, key: queueKey, record }) =>
    record.queue.filter((entry) => entry?.at === id)
      .map((entry) => ({ device, key: queueKey, record, entry })));
  if (matches.length > 1)
    return json({ ok: false, state: "ownership-conflict", error: "More than one device holds this timestamp; refresh the server-held queue." }, 409);
  if (savedOwner && matches.length && matches[0].device !== savedOwner.device)
    return json({ ok: false, state: "ownership-conflict", error: "The device owner changed; refresh the server-held queue." }, 409);
  let ownerProof = null;
  const ownerRow = await env.SALT_LEDGER.prepare("SELECT operation,fingerprint,entry FROM maker_request WHERE id=?1")
    .bind(queueOwnerKey(id)).first();
  if (ownerRow) {
    try { ownerProof = JSON.parse(ownerRow.entry); } catch { ownerProof = null; }
    if (ownerRow.operation !== "queue-owner" || !/^[0-9a-f]{64}$/.test(ownerRow.fingerprint || "")
      || !ownerProof || ownerProof.fingerprint !== ownerRow.fingerprint || !DEVICE_RE.test(ownerProof.device || "")
      || ownerProof.device === "anon" || requestedDevice && ownerProof.device !== requestedDevice)
      return json({ ok: false, state: "ownership-conflict", error: "The saved device ownership does not match this entry." }, 409);
  }
  if (matches.length && ownerProof && (matches[0].device !== ownerProof.device
    || await makerRequestFingerprint("server-queue-entry", matches[0].entry) !== ownerProof.fingerprint))
    return json({ ok: false, state: "ownership-conflict", error: "The server queue and saved device ownership disagree." }, 409);
  if (matches.length && await makerRequestFingerprint("server-queue-entry", matches[0].entry) !== body.fingerprint) {
    const serverFingerprint = ownerProof && ownerProof.fingerprint;
    return json({ ok: false, state: "entry-changed",
      ...(requireDevice && matches[0].device === requestedDevice && serverFingerprint ? { serverFingerprint } : {}),
      error: "The server-held entry changed; review its current identity before withdrawing." }, 409);
  }
  if (!matches.length && ownerProof && ownerProof.fingerprint !== body.fingerprint) {
    return json({ ok: false, state: "entry-changed",
      error: "The server-held entry identity differs; review its saved identity before withdrawing." }, 409);
  }
  if (matches.length && requestedDevice && matches[0].device !== requestedDevice)
    return json({ ok: false, state: "ownership-conflict", error: "That entry is not held by this device." }, 409);
  const device = savedOwner?.device || ownerProof?.device || matches[0]?.device;
  if (!device || device === "anon" || requestedDevice && requestedDevice !== device)
    return json({ ok: false, state: "not-held", error: "No uniquely owned server-held entry matches this device and timestamp." }, 409);

  const token = await acquireDeviceQueueLock(env.SALT_LEDGER, device);
  if (!token) return json({ ok: false, state: "withdrawal-pending", error: "This device queue is changing. Refresh and retry." }, 409);
  try {
    records = await deviceQueueRecords(env);
    matches = records.flatMap(({ device: owner, key: queueKey, record }) =>
      record.queue.filter((entry) => entry?.at === id)
        .map((entry) => ({ device: owner, key: queueKey, record, entry })));
    if (matches.length > 1 || matches.length && matches[0].device !== device)
      return json({ ok: false, state: "ownership-conflict", error: "The device owner changed; refresh the server-held queue." }, 409);
    if (matches.length && requestedDevice && matches[0].device !== requestedDevice)
      return json({ ok: false, state: "ownership-conflict", error: "That entry is not held by this device." }, 409);
    if (matches.length && await makerRequestFingerprint("server-queue-entry", matches[0].entry) !== body.fingerprint)
      return json({ ok: false, state: "entry-changed", error: "The server-held entry changed; refresh before withdrawing it." }, 409);
    if (!ownerProof && matches.length) {
      const owner = JSON.stringify({ device, fingerprint: body.fingerprint });
      await env.SALT_LEDGER.prepare(`INSERT OR IGNORE INTO maker_request(id,operation,fingerprint,entry)
        VALUES (?1,'queue-owner',?2,?3)`).bind(queueOwnerKey(id), body.fingerprint, owner).run();
      const saved = await env.SALT_LEDGER.prepare("SELECT operation,fingerprint,entry FROM maker_request WHERE id=?1")
        .bind(queueOwnerKey(id)).first();
      let proof;
      try { proof = JSON.parse(saved?.entry); } catch { proof = null; }
      if (saved?.operation !== "queue-owner" || saved.fingerprint !== body.fingerprint
        || proof?.device !== device || proof?.fingerprint !== body.fingerprint)
        return json({ ok: false, state: "ownership-conflict", error: "The device ownership changed; refresh and retry." }, 409);
      ownerProof = proof;
    }
    const draft = await env.SALT_LEDGER.prepare("SELECT status,committed_at,entry FROM draft WHERE id=?1").bind(id).first();
    if (draft) {
      if (draft.status === "rejected") {
        let drafted;
        try { drafted = JSON.parse(draft.entry); } catch { drafted = null; }
        const same = drafted && ownerProof && ownerProof.device === device
          && await makerRequestFingerprint("server-queue-entry", drafted) === body.fingerprint;
        if (!same) return json({ ok: false, state: "ownership-conflict", error: "The rejected row does not match this device entry." }, 409);
        const stillHeld = records.some((item) => item.record.queue.some((entry) => entry?.at === id));
        if (stillHeld) return json({ ok: false, state: "withdrawal-pending", error: "The rejected row still has a server queue copy; retry after it is dropped." }, 503);
        return json({ ok: true, state: "rejected", confirmedAbsent: true, withdrawn: id });
      }
      return queueDraftConflict(draft);
    }
    const refusal = await env.SALT_LEDGER.prepare("SELECT entry FROM refused WHERE id=?1 AND source='cloud-drafter'")
      .bind(id).first();
    if (refusal) {
      let refused;
      try { refused = JSON.parse(refusal.entry); } catch { refused = null; }
      if (!refused || await makerRequestFingerprint("server-queue-entry", refused) !== body.fingerprint)
        return json({ ok: false, state: "entry-changed", error: "The cloud refusal does not match this device entry." }, 409);
    }
    if (!matches.length && !refusal && !(requireDevice && ownerProof))
      return json({ ok: false, state: "not-held", error: "No server-held entry or matching cloud refusal remains." }, 409);
    const claimed = await claimDeviceQueueWithdrawal(env.SALT_LEDGER, id, device, body.fingerprint);
    if (claimed.error) {
      const racedDraft = await env.SALT_LEDGER.prepare("SELECT status,committed_at FROM draft WHERE id=?1").bind(id).first();
      return queueDraftConflict(racedDraft)
        || json({ ok: false, state: "ownership-conflict", error: claimed.error }, 409);
    }
    if (claimed.response) {
      let answer;
      try { answer = JSON.parse(claimed.response); }
      catch { return json({ ok: false, state: "withdrawal-pending", error: "The saved withdrawal answer is unreadable." }, 503); }
      return json({ ...answer, again: true });
    }
    if (matches.length) {
      const current = await env.SALT_QUEUE.get(matches[0].key);
      if (current == null) return json({ ok: false, state: "withdrawal-pending", error: "The server-held device queue changed; retry to finish withdrawal." }, 503);
      let record;
      try { record = JSON.parse(current); }
      catch { return json({ ok: false, state: "withdrawal-pending", error: "The device queue could not be read; withdrawal remains blocked." }, 503); }
      const same = record?.device === device && Array.isArray(record.queue)
        && record.queue.filter((entry) => entry?.at === id).length === 1
        && await makerRequestFingerprint("server-queue-entry", record.queue.find((entry) => entry?.at === id)) === body.fingerprint;
      if (!same) return json({ ok: false, state: "entry-changed", error: "The device queue changed; withdrawal remains blocked. Refresh the queue." }, 409);
      const queue = record.queue.filter((entry) => entry?.at !== id);
      await env.SALT_QUEUE.put(matches[0].key, JSON.stringify({
        ...record, updated: new Date().toISOString(), queue
      }));
      const saved = await env.SALT_QUEUE.get(matches[0].key);
      let after;
      try { after = saved == null ? null : JSON.parse(saved); } catch { after = null; }
      if (!after || after.device !== device || !Array.isArray(after.queue)
        || after.queue.some((entry) => entry?.at === id))
        return json({ ok: false, state: "withdrawal-pending", error: "Withdrawal remains blocked from drafting, but queue removal is unverified; retry." }, 503);
    } else if (!savedOwner && !ownerProof) {
      return json({ ok: false, state: "not-held", error: "No server-held device entry matches this timestamp." }, 409);
    }
    const remaining = (await deviceQueueRecords(env)).some((item) =>
      item.record.queue.some((entry) => entry?.at === id));
    if (remaining)
      return json({ ok: false, state: "withdrawal-pending", error: "Withdrawal remains blocked from drafting, but another device copy is present." }, 409);
    const answer = { ok: true, state: "withdrawn", withdrawn: id };
    if (!await finishDeviceQueueWithdrawal(env.SALT_LEDGER, id, device, body.fingerprint, answer))
      return json({ ok: false, state: "withdrawal-pending", error: "The queue was removed, but the withdrawal answer could not be recorded; retry." }, 503);
    return json(answer);
  } catch (error) {
    return json({ ok: false, state: "withdrawal-pending", error: String(error && error.message || error) }, 503);
  } finally {
    await releaseDeviceQueueLock(env.SALT_LEDGER, device, token);
  }
}

/* Union of every device's queue, for the drain and for eyeballing behind Access. */
async function handleQueueGet(env, strict = false) {
  if (!env.SALT_QUEUE) return json({ ok: false, error: "no KV binding" }, 500);
  const out = [];
  let cursor;
  do {
    const list = await env.SALT_QUEUE.list({ prefix: "q:", cursor });
    for (const k of list.keys) {
      const raw = await env.SALT_QUEUE.get(k.name);
      if (!raw) continue;
      try {
        const v = JSON.parse(raw);
        if (strict && !Array.isArray(v.queue)) throw new Error("queue shape");
        for (const entry of (v.queue || [])) out.push(entry);
      } catch (e) {
        if (strict) throw new Error("The Desk queue contains an unreadable entry; no maker input was added.");
        /* skip a corrupt key rather than fail the whole read */
      }
    }
    cursor = list.list_complete ? null : list.cursor;
  } while (cursor);
  // Dedupe by the entry's own stamp, newest wins, so two devices holding the same entry
  // (or a device that re-posted) never double it.
  const byAt = new Map();
  for (const e of out) byAt.set(e && e.at ? e.at : JSON.stringify(e), e);
  let withdrawn = new Set();
  if (env.SALT_LEDGER) {
    try {
      const receipts = await env.SALT_LEDGER.prepare(
        "SELECT id FROM maker_request WHERE operation='queue-withdraw'"
      ).all();
      withdrawn = new Set((receipts.results || []).map((row) => row.id.slice("queue-withdraw:".length)));
    } catch (error) {
      return json({ ok: false, error: "Withdrawal state could not be checked; the queue is unavailable." }, 503);
    }
  }
  const queue = [...byAt.values()].filter((entry) => !withdrawn.has(entry?.at))
    .sort((a, b) => ((a && a.at) || "") < ((b && b.at) || "") ? -1 : 1);
  return json({ ok: true, entries: queue.length, queue });
}

/* The encrypted vault. GET hands back the ciphertext so the phone can decrypt it with the
 * password; POST stores it, but only if it is the envelope shape (never plaintext). */
async function handleVaultGet(env) {
  if (env.VAULT_STORE === "pair") {
    const pair = await readVaultPair(env.SALT_LEDGER);
    return pair.ok ? json({ ok: true, vault: pair.names, revision: pair.revision, updated: pair.updated })
      : json(pair, pair.status);
  }
  if (!env.SALT_QUEUE) return json({ ok: true, vault: null });
  const raw = await env.SALT_QUEUE.get(VKEY);
  if (!raw) return json({ ok: true, vault: null });
  try {
    const v = JSON.parse(raw);
    // ids/locs are code maps, never names, so they are safe to return; keys omitted when
    // absent so the desk's loader does not wipe a device's own id state.
    const out = { ok: true, vault: v.vault || null, updated: v.updated || null };
    if (v.ids) out.ids = v.ids;
    if (v.locs) out.locs = v.locs;
    return json(out);
  } catch (e) { return json({ ok: false, error: "the vault could not be read" }, 500); }   // F14 review: read as none, the desk's next Add ID would seal one name over them all
}
async function handleVaultPost(request, env) {
  if (env.VAULT_STORE === "pair")
    return json({ ok: false, error: "Upgrade this writer to the revisioned vault pair. Unversioned writes are refused." }, 409);
  if (!env.SALT_QUEUE) return json({ ok: false, error: "no KV binding" }, 500);
  if (!writeOk(request, env)) return needsKey();
  let body;
  try { body = await request.json(); } catch (e) { return json({ ok: false, error: "bad json" }, 400); }
  const v = body && body.vault;
  if (v !== null && !isEnvelope(v)) {
    return json({ ok: false, error: "vault must be the encrypted {v,salt,iv,ct} envelope" }, 400);
  }
  await env.SALT_QUEUE.put(VKEY, JSON.stringify({
    updated: body.updated || null, vault: v, ids: body.ids || null, locs: body.locs || null
  }));
  return json({ ok: true });
}

/* F14 (28 Sep 2026): THE PLACES ENVELOPE, the vault's second. The desk seals {<code>: {addr, lat, lng, src, at}, _base} with
 * the vault's own passphrase and posts only the envelope; an exact point is more than a name, so the read is keyed as well
 * as the write (the route sits in the keyed list in fetch). Only the four envelope fields are kept, and each must read as
 * base64, so a plaintext map, or an address slipped in beside the ciphertext, is refused and never stored. There is no
 * null: nothing on the desk clears the places, and a stray null would. */
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;
const isSealed = (v) => isEnvelope(v) && B64.test(v.salt) && B64.test(v.iv) && B64.test(v.ct);
async function handleVaultAddr(request, env, m) {
  if (env.VAULT_STORE === "pair") {
    if (m !== "GET") return json({ ok: false, error: "Upgrade this writer to the revisioned vault pair. Unversioned writes are refused." }, 409);
    const pair = await readVaultPair(env.SALT_LEDGER);
    return pair.ok ? json({ ok: true, vault: pair.places, revision: pair.revision, updated: pair.updated })
      : json(pair, pair.status);
  }
  if (!env.SALT_QUEUE) return json({ ok: false, error: "no KV binding" }, 500);
  if (m === "GET") {
    const raw = await env.SALT_QUEUE.get(AKEY);
    if (!raw) return json({ ok: true, vault: null });
    try { const v = JSON.parse(raw); return json({ ok: true, vault: v.vault || null, updated: v.updated || null }); }
    catch (e) { return json({ ok: false, error: "the places vault could not be read" }, 500); }   // never read as none: the next save would seal one place over them all
  }

  if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
  let body;
  try { body = await request.json(); } catch (e) { return json({ ok: false, error: "bad json" }, 400); }
  const v = body && body.vault;
  if (!isSealed(v)) return json({ ok: false, error: "vault must be the encrypted {v,salt,iv,ct} envelope" }, 400);
  const at = typeof body.updated === "string" && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(body.updated) ? body.updated : null;
  await env.SALT_QUEUE.put(AKEY, JSON.stringify({ updated: at,
    vault: Object.assign({ v: 1, salt: v.salt, iv: v.iv, ct: v.ct }, Number.isInteger(v.it) && v.it > 0 ? { it: v.it } : {}) }));
  return json({ ok: true });
}

async function handleVaultPair(request, env, method) {
  if (env.VAULT_STORE !== "pair")
    return json({ ok: false, error: "The versioned vault is not enabled. Live vault authority is unchanged." }, 503);
  if (method === "GET") {
    const pair = await readVaultPair(env.SALT_LEDGER);
    return json(pair, pair.ok ? 200 : pair.status);
  }
  if (method !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
  const text = await request.text();
  if (text.length > 1048576) return json({ ok: false, error: "The encrypted vault request is too large." }, 413);
  let body;
  try { body = JSON.parse(text); } catch { return json({ ok: false, error: "Send a ciphertext pair as JSON." }, 400); }
  const result = await commitVaultPair(env.SALT_LEDGER, body, "seed");
  return json(result.status === 409 ? { ...result, code: "vaultConflict" } : result, result.ok ? 200 : result.status);
}

export async function recoverVaultInputs(env, id, gateHeld = false) {
  if (!gateHeld) {
    const result = await withVaultWrite(env, () => recoverVaultInputs(env, id, true), true);
    if (typeof result === "number") return result;
    if (id) throw new Error(result.error);
    return 0;
  }
  const rows = id ? [{ id }] : (await env.SALT_LEDGER.prepare(
    "SELECT id FROM vault_outbox WHERE state='pending' ORDER BY attempted_at,id LIMIT 25").all()).results || [];
  for (const row of rows) {
    try {
      await env.SALT_LEDGER.prepare("UPDATE vault_outbox SET attempted_at=?2 WHERE id=?1")
        .bind(row.id, new Date().toISOString()).run();
      await consumeVaultOutbox(env.SALT_LEDGER, row.id, async (entry) => {
      await queueSale(env, entry, true);
      await runDrafter(env);
      const draft = await env.SALT_LEDGER.prepare("SELECT status FROM draft WHERE id=?1").bind(entry.at).first();
      if (!draft) throw new Error("The filed vault input has not reached its draft. It remains pending recovery.");
      return { ok: true };
      });
    } catch (error) {
      if (id) throw error;
      console.error("vault recovery pending: " + (/^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(row.id) ? row.id : "invalid-id"));
    }
  }
  return rows.length;
}

async function handleVaultInput(env, operation, body) {
  if (!env.SALT_LEDGER || !env.SALT_QUEUE)
    return json({ ok: false, error: "The transactional mirror and queue are required." }, 503);
  if (!body || typeof body !== "object" || Array.isArray(body) || !body.pair)
    return json({ ok: false, error: "This ID/place client needs both ciphertext envelopes and the expected pair revision." }, 409);
  const { pair, ...input } = body;
  const fingerprint = await makerRequestFingerprint("vault-input:" + operation, body);
  const receipt = await env.SALT_LEDGER.prepare(
    "SELECT request_fingerprint,revision,operation FROM vault_receipt WHERE id=?1").bind(input.at).first();
  if (receipt) {
    if (receipt.request_fingerprint !== fingerprint || receipt.operation !== operation)
      return json({ ok: false, error: "That vault input id already carries different content." }, 409);
    await recoverVaultInputs(env, input.at);
    const outbox = await env.SALT_LEDGER.prepare("SELECT id FROM vault_outbox WHERE id=?1").bind(input.at).first();
    return json({ ok: true, replay: true, revision: receipt.revision, vaultOnly: !outbox,
      ...(outbox ? { draft: input.at } : {}) });
  }
  if (Object.keys(pair).some((key) => !["expectedRevision", "names", "places"].includes(key))
    || JSON.stringify(input.vault ?? null) !== JSON.stringify(operation === "place" ? null : pair.names)
    || input.addrVault !== undefined && JSON.stringify(input.addrVault) !== JSON.stringify(pair.places))
    return json({ ok: false, error: "The input envelopes must match its ciphertext pair." }, 400);
  const book = await readBook(env.SALT_LEDGER);
  const points = operation === "place" ? Object.values(input.places || {}) : input.geo ? [input.geo] : [];
  for (const point of points)
    if (!await officialVaultPoint(point))
      return json({ ok: false, error: "A public locality must be on the official place list or gazetteer; exact addresses stay encrypted." }, 400);
  const checkedInput = { ...input };
  if (input.geo) checkedInput.geo = input.geo.slice(0, 2);
  if (operation === "place") checkedInput.places = Object.fromEntries(
    Object.entries(input.places || {}).map(([code, point]) => [code, point.slice(0, 2)]));
  const built = makerLedgerInput(operation, checkedInput, book);
  if (built.error) return json({ ok: false, error: built.error }, 400);
  const entry = built.entry || null;
  if (entry && input.geo?.length === 3) {
    if (entry.payload.mode === "place") entry.payload.places[input.from] = input.geo;
    else entry.payload.geo = input.geo;
  }
  if (entry && operation === "place") entry.payload.places = input.places;
  if (entry) {
    const proposed = draftRow(entry, book);
    if (proposed.skip) return json({ ok: false, error: proposed.skip }, 409);
    const queued = (await (await handleQueueGet(env, true)).json()).queue;
    const draft = await env.SALT_LEDGER.prepare("SELECT entry FROM draft WHERE id=?1").bind(input.at).first();
    if (queued.some((item) => item.at === input.at) || draft)
      return json({ ok: false, error: "That request id already names a queued or drafted input." }, 409);
  }
  const committed = await commitVaultPair(env.SALT_LEDGER, { at: input.at, ...pair }, operation, entry, fingerprint);
  if (!committed.ok) return json({ ...committed, code: "vaultConflict" }, committed.status);
  await recoverVaultInputs(env, input.at);
  return json({ ok: true, revision: committed.revision, vaultOnly: !entry,
    ...(entry ? { draft: input.at, queued: true } : {}) });
}

/* F13 (29 Sep 2026): THE SLIP KEY, the vault's third envelope: {updated, vault: the sealed private half, pub: the public
 * half}. Only `node tools/seed-vault.mjs --slip-key` writes it, through wrangler, so there is no POST: nothing on the desk
 * could replace the key every slip is sealed to. Read with the key, as the places are; the desk opens it on the unlock. */
async function handleVaultKey(env, m) {
  if (m !== "GET") return json({ ok: false, error: "method not allowed" }, 405);
  if (!env.SALT_QUEUE) return json({ ok: true, vault: null });
  const raw = await env.SALT_QUEUE.get(KKEY);
  if (!raw) return json({ ok: true, vault: null });
  try { const v = JSON.parse(raw); return json({ ok: true, vault: v.vault || null, pub: v.pub || null, updated: v.updated || null }); }
  catch (e) { return json({ ok: false, error: "the slip key could not be read" }, 500); }
}

/* F14: A MAPS SHORT LINK OPENED FOR THE DESK, AND NOTHING KEPT. A maps.app.goo.gl link carries no point until it is
 * followed, and the desk cannot follow it itself (rule 4: its CSP is self only, and it loads nothing third party). So the
 * desk posts the link here, keyed, and this follows ONE redirect with redirect "manual" and answers the Location, which the
 * desk reads as it reads any link. Only https://maps.app.goo.gl/<id> is opened: any other host, scheme, port or a
 * credential is refused before a fetch is made, so this is never a door to anywhere else. Nothing is stored and nothing is
 * logged: the link rides in the body, which the invocation log does not keep, and traces are off (wrangler.jsonc). Google
 * is an allowed service, and a redirect needs no key. */
function shortMapsUrl(s) {
  if (typeof s !== "string" || s.length > 300) return null;
  let u;
  try { u = new URL(s.trim()); } catch (e) { return null; }
  return (u.protocol === "https:" && u.hostname === "maps.app.goo.gl" && !u.username && !u.password && !u.port
    && /^\/[A-Za-z0-9_-]{1,64}$/.test(u.pathname)) ? u.origin + u.pathname + u.search : null;
}
async function handleGeoExpand(request) {
  let b = null;
  try { b = await request.json(); } catch (e) { return json({ ok: false, error: "bad json" }, 400); }
  const u = shortMapsUrl(b && b.url);
  if (!u) return json({ ok: false, error: "only a maps.app.goo.gl link is opened here" }, 400);
  let res;
  try { res = await fetch(u, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(8000) }); }
  catch (e) { return json({ ok: false, error: "the link did not answer" }, 502); }
  try { if (res.body) await res.body.cancel(); } catch (e) { /* nothing to free */ }
  const loc = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
  let to = null;
  try { to = loc ? new URL(loc, u) : null; } catch (e) { to = null; }
  if (!to || (to.protocol !== "https:" && to.protocol !== "http:")) return json({ ok: false, error: "the link did not lead to a map" }, 502);
  return json({ ok: true, location: to.href });
}

/* THE LEDGER STORE, READ ONLY (v294).
 *
 * The book now also lives in D1, seeded from the master by tools/d1.mjs. This serves it.
 *
 * IT IS A MIRROR AND IT SAYS SO IN EVERY RESPONSE. The Per-Crm01 master is still the source
 * of truth: the desk computes from its own arrays, the daily run still folds the queue into
 * the master, and nothing here writes. The direction flips only once the store is proven to
 * reproduce the desk's figures exactly, and until then a reader that quietly preferred this
 * endpoint would be reading a copy that can silently fall behind. `snapshot` carries the
 * desk version and the seed time so a caller can tell how far behind it is.
 *
 * There is no write path on purpose. Adding one before the proof would create exactly the
 * second source of truth this whole exercise exists to remove.
 */
/* STATEMENTS OF ACCOUNT ARE NOT SERVED HERE (03 Sep 2026, his instruction). From 02 to 03 Sep
 * they were, at /s/<CODE>, and that put the one address a customer ever holds one path segment
 * from an open desk. They live on their own Worker now, with a cryptic name of its own and its
 * own KV store: stmt/worker.js and wrangler.stmt.jsonc. Nothing on this Worker is meant for
 * anyone but the owner, and nothing a customer holds points at it. */

async function handleLedger(env, url) {
  if (!env.SALT_LEDGER) return json({ ok: false, error: "no ledger binding" }, 503);
  const rest = url.pathname.replace(/^\/ledger\/?/, "").replace(/\/+$/, "");
  try {
    if (!rest) {
      const snap = await env.SALT_LEDGER.prepare("SELECT v,stamped,sha,rows,at FROM snapshot WHERE one=1").first();
      if (!snap) return json({ ok: true, seeded: false, note: "the store is empty; seed it with tools/d1.mjs --seed" });
      const counts = await env.SALT_LEDGER.prepare("SELECT collection, COUNT(*) n FROM entry GROUP BY collection ORDER BY collection").all();
      const by = {};
      for (const r of (counts.results || [])) by[r.collection] = r.n;
      return json({ ok: true, seeded: true, snapshot: snap, counts: by,
        source: "mirror of the Per-Crm01 master; that desk is still authoritative" });
    }
    if (rest === "state") {
      const rs = await env.SALT_LEDGER.prepare("SELECT key,doc FROM state ORDER BY key").all();
      const out = {};
      for (const r of (rs.results || [])) { if (String(r.key).startsWith("__")) continue; out[r.key] = JSON.parse(r.doc); }
      return json({ ok: true, state: out });
    }
    if (!/^[A-Za-z_]{1,32}$/.test(rest)) return json({ ok: false, error: "not a collection" }, 404);
    const rs = await env.SALT_LEDGER.prepare("SELECT doc FROM entry WHERE collection=?1 ORDER BY seq").bind(rest).all();
    const rows = (rs.results || []).map((r) => JSON.parse(r.doc));
    if (!rows.length) {
      /* AN EMPTY COLLECTION IS NOT A MISSING ONE. selfUseLog and lostDemand are both empty
         today; answering 404 for them would report the book as not having the concept. */
      const known = await env.SALT_LEDGER.prepare("SELECT doc FROM state WHERE key='__collections'").first();
      const list = known ? JSON.parse(known.doc) : [];
      if (!list.includes(rest)) return json({ ok: false, error: "unknown collection: " + rest }, 404);
    }
    return json({ ok: true, collection: rest, entries: rows.length, rows });
  } catch (e) {
    return json({ ok: false, error: String((e && e.message) || e) }, 500);
  }
}

/* THE APPROVAL STEP (v302).
 *
 * A queued entry does not become a ledger row unattended. A drafter writes the proposed ROW,
 * this stores it as `pending`, the phone shows it with its cost and margin beside the price,
 * and a tap approves or rejects it. Only approved rows are read back by the commit run.
 *
 * WHAT IS APPROVED IS THE ROW, and migrations/0002_draft.sql explains why at length: the
 * RM115 oil entry of 14 Aug was well-formed and wrong, and only the row showed it.
 *
 * READS ARE OPEN, DECISIONS ARE NOT. That matches the posture of the rest of this Worker
 * since 11 Aug: anyone with the URL reads the book, nobody without the key writes to it. A
 * decision is a write in the fullest sense, since an approved row reaches the master.
 */
const DRAFT_COLS = "id,status,collection,entry,row,reasoning,flags,party,product,date,qty,total,cost,amends,amend_kind,drafter,drafted_at,decided_at,decided_by,committed_at,live_at";

function draftOut(r) {
  const parse = (s, fallback) => { try { return s == null ? fallback : JSON.parse(s); } catch (e) { return fallback; } };
  return {
    id: r.id, status: r.status, collection: r.collection,
    entry: parse(r.entry, null), row: parse(r.row, null),
    reasoning: r.reasoning, flags: parse(r.flags, []),
    party: r.party, product: r.product, date: r.date,
    qty: r.qty, total: r.total, cost: r.cost,
    /* NULL on a new row. Present on an amendment, and then `row` is the TARGET as it stands
       rather than a row to append: see migrations/0004_amend.sql. */
    amends: r.amends || null, amendKind: r.amend_kind || null,
    drafter: r.drafter, draftedAt: r.drafted_at,
    decidedAt: r.decided_at, decidedBy: r.decided_by, committedAt: r.committed_at,
    liveAt: r.live_at || null   /* v519: when the deploy proved the phone was serving the row */
  };
}

async function handleDraftsGet(env, url) {
  if (!env.SALT_LEDGER) return json({ ok: false, error: "no ledger binding" }, 503);
  const want = url.searchParams.get("status") || "pending";
  const all = want === "all";
  if (!all && !["pending", "approved", "rejected"].includes(want)) {
    return json({ ok: false, error: "status must be pending, approved, rejected or all" }, 400);
  }
  /* `uncommitted` is what the commit run asks for: approved and not yet in the master. It is
     a separate question from `approved`, because an approved row stays approved forever. */
  const uncommitted = url.searchParams.get("uncommitted") === "1";
  let sql = `SELECT ${DRAFT_COLS} FROM draft`;
  const binds = [];
  const where = [];
  if (!all) { where.push("status=?"); binds.push(want); }
  if (uncommitted) where.push("committed_at IS NULL");
  if (where.length) sql += " WHERE " + where.join(" AND ");
  sql += " ORDER BY drafted_at";
  const rs = await env.SALT_LEDGER.prepare(sql).bind(...binds).all();
  const drafts = (rs.results || []).map(draftOut);
  /* S11 (D6): A ROW THAT DIFFERS FROM WHAT HE SAID YES TO waits here marked, with what he was shown beside it */
  try {
    const pr = await env.SALT_LEDGER.prepare("SELECT draft_id,stage,shown,at FROM preapproval WHERE status='differs' AND draft_id IS NOT NULL").all();
    const by = new Map((pr.results || []).map((r) => [r.draft_id, r]));
    for (const d of drafts) {
      const p = d.status === "pending" && by.get(d.id);
      if (p) { let shown = null; try { shown = JSON.parse(p.shown); } catch (e) { shown = null; }
        d.preapproval = { state: "differs", says: "differs from what you saw", stage: p.stage, at: p.at, shown }; }
    }
  } catch (e) { /* a store before migrations/0011 marks nothing */ }

  /* THE REFUSED LIST RIDES ALONG, and it is a separate key rather than a fourth status for
     the reason migrations/0003 gives: these carry no proposed row and can never be approved.
     It is returned on the same response because the phone wants both at the same moment and
     a second round trip on a phone is a second chance to be offline. Only on the default
     pending view: asking for approved or rejected rows is a different question. */
  let refused = [];
  if (want === "pending" && !uncommitted) {
    try {
      const rr = await env.SALT_LEDGER.prepare(
        "SELECT id,entry,why,party,source,seen_at FROM refused ORDER BY id"
      ).all();
      refused = (rr.results || []).map((r) => {
        let entry = null;
        try { entry = JSON.parse(r.entry); } catch (e) { /* show the reason even if the entry is unreadable */ }
        return { id: r.id, entry, why: r.why, party: r.party, source: r.source, seenAt: r.seen_at };
      });
    } catch (e) { /* an older store has no `refused` table; the drafts still answer */ }
  }
  /* v519: THE CLOCK RIDES ALONG. The last committed draft's three timestamps, so the Approve
     view can say how long the last tap took to reach the phone without a second round trip
     and without reading every approved row there has ever been: one entry of `draft_committed`
     (migrations/0012), where it read and sorted the whole table before. Pending view only. */
  let clock = null;
  if (want === "pending" && !uncommitted) {
    try {
      const c = await env.SALT_LEDGER.prepare(
        "SELECT id,party,decided_at,live_at,committed_at FROM draft WHERE committed_at IS NOT NULL ORDER BY committed_at DESC LIMIT 1"
      ).first();
      if (c) clock = { id: c.id, party: c.party, decidedAt: c.decided_at, liveAt: c.live_at || null, committedAt: c.committed_at };
    } catch (e) { /* a store without the column answers the drafts and no clock */ }
  }
  return json({ ok: true, count: drafts.length, drafts, refused, refusedCount: refused.length, clock });
}

async function handleDraftPost(request, env) {
  if (!env.SALT_LEDGER) return json({ ok: false, error: "no ledger binding" }, 503);
  if (!writeOk(request, env)) return needsKey();
  let b;
  try { b = await request.json(); } catch (e) { return json({ ok: false, error: "bad json" }, 400); }
  const id = b && typeof b.id === "string" ? b.id.trim() : "";
  if (!id) return json({ ok: false, error: "id is required and is the queue entry's own 'at'" }, 400);
  if (!b.row || typeof b.row !== "object") return json({ ok: false, error: "row is required: a draft with no proposed row is just a queue entry" }, 400);
  if (!b.entry || typeof b.entry !== "object") return json({ ok: false, error: "entry is required" }, 400);
  const reasoning = typeof b.reasoning === "string" ? b.reasoning.trim() : "";
  if (!reasoning) return json({ ok: false, error: "reasoning is required: an unexplained row cannot be reviewed" }, 400);
  const collection = b.collection === "purchases" ? "purchases" : "sales";
  const drafter = (typeof b.drafter === "string" && b.drafter.trim()) || "unknown";
  const num = v => (typeof v === "number" && isFinite(v)) ? v : null;
  /* INSERT OR IGNORE, never REPLACE. Re-drafting an id that has already been decided must not
     quietly reopen it, or a decision could be undone by whatever runs next. */
  const res = await env.SALT_LEDGER.prepare(
    `INSERT OR IGNORE INTO draft
       (id,status,collection,entry,row,reasoning,flags,party,product,date,qty,total,cost,drafter,drafted_at)
     VALUES (?1,'pending',?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)`
  ).bind(
    id, collection, JSON.stringify(b.entry), JSON.stringify(b.row), reasoning,
    JSON.stringify(Array.isArray(b.flags) ? b.flags : []),
    b.row.customer || b.row.supplier || null,
    b.row.product || (collection === "sales" ? "salt" : null),
    b.row.date || null, num(b.row.qty), num(b.row.total), num(b.row.cost),
    drafter, new Date().toISOString()
  ).run();
  const created = !!(res.meta && res.meta.changes);
  return json({ ok: true, id, created, existed: !created });
}

/* AN APPROVAL RINGS THE STAGE (03 Sep 2026, his instruction: approve, stage, fold, commit,
 * push and deploy together, or within minutes).
 *
 * A tap used to flip a row to approved and stop; the hourly stage found it within the hour and
 * a fold happened when someone asked. Now the tap also dispatches cloud-commit.yml, which
 * stages the approved rows at once and rings the fold routine by pushing the `stage` branch.
 * The fold, the deploy and the mark-committed step are unchanged and still hold the judgement
 * and the credentials; this Worker only starts the clock.
 *
 * GitHub, not the routine API, because the stage has to run first in any case, and because
 * the token that can fire a routine is the owner's claude.ai identity, which does not belong in
 * a Worker. A fine-grained GitHub token scoped to this repo's Actions can do nothing else.
 *
 * waitUntil, not await, for the reason the drafter gives: the phone must get its 200 for the
 * DECISION at once, and a dispatch fault must never undo one. Silent when SALT_GITHUB_TOKEN is
 * unset, so the gate is safe to deploy before the secret exists: the hourly stage still runs,
 * and a fold on request still works. Five taps in a row are five dispatches; the lock on job
 * `chain` runs one and holds one pending (a newer pending run replaces an older, and a chain reads
 * D1 when it starts), and the stage's own guard stands the extras down. The suite is its own job
 * and takes no lock, so no dispatch waits behind one. A dispatch that is lost is rung again by
 * redispatchStale below, on the minute cron.
 *
 * THE GITHUB APP (07 Oct 2026). The fine-grained token lapsed about 02 Oct (401), and the one put
 * back on 05 Oct was refused (400), so every fold waited on GitHub's hourly schedule, which fires
 * a few times a day. With GH_APP_KEY set, the Worker signs as the app salt-desk-dispatch-mk
 * (Actions read and write on this repo alone) and trades that for an installation token of one
 * hour, held in this isolate until five minutes before it lapses: nothing for him to renew. The
 * key is PKCS#8 (`openssl pkcs8 -topk8 -nocrypt`); GitHub's own download is PKCS#1, and the
 * failure says so. SALT_GITHUB_TOKEN is the fallback while GH_APP_KEY is unset. A refused
 * dispatch logs GitHub's reason beside its status, so a 400 is never again read blind. */
const STAGE_REPO = "maakmal97/salt-command";
const STAGE_APP_ID = "5222854";
const GH_HEADERS = { accept: "application/vnd.github+json", "user-agent": "salt-command" };
let appToken = null;
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function ghRefusal(r, what) {
  let why = "";
  try { why = (await r.text()).slice(0, 200); } catch (e) { why = ""; }
  return what + " " + r.status + (why ? " " + why : "");
}
async function appInstallToken(env) {
  const pem = String(env.GH_APP_KEY);
  if (/BEGIN RSA PRIVATE KEY/.test(pem)) throw new Error("GH_APP_KEY is PKCS#1; convert it with openssl pkcs8 -topk8 -nocrypt");
  if (appToken && appToken.until - Date.now() > 5 * 60000) return appToken.token;
  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----|\s+/g, "")), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const now = Math.floor(Date.now() / 1000), enc = (o) => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const head = enc({ alg: "RS256", typ: "JWT" }) + "." + enc({ iat: now - 60, exp: now + 540, iss: STAGE_APP_ID });
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(head)));
  const as = { ...GH_HEADERS, authorization: "Bearer " + head + "." + b64url(sig) };
  const inst = await fetch("https://api.github.com/repos/" + STAGE_REPO + "/installation", { headers: as });
  if (!inst.ok) throw new Error(await ghRefusal(inst, "app installation"));
  const { id } = await inst.json();
  const t = await fetch("https://api.github.com/app/installations/" + id + "/access_tokens", {
    method: "POST", headers: { ...as, "content-type": "application/json" },
    body: JSON.stringify({ repositories: ["salt-command"], permissions: { actions: "write" } })
  });
  if (!t.ok) throw new Error(await ghRefusal(t, "app token"));
  const j = await t.json();
  appToken = { token: j.token, until: Date.parse(j.expires_at) || Date.now() + 50 * 60000 };
  return j.token;
}
const dispatchArmed = (env) => !!(env.GH_APP_KEY || env.SALT_GITHUB_TOKEN);
function stageOnApproval(env, ctx) {
  if (!ctx || typeof ctx.waitUntil !== "function" || !dispatchArmed(env)) return;
  ctx.waitUntil((async () => {
    try {
      const token = env.GH_APP_KEY ? await appInstallToken(env) : env.SALT_GITHUB_TOKEN;
      const r = await fetch("https://api.github.com/repos/" + STAGE_REPO + "/actions/workflows/cloud-commit.yml/dispatches", {
        method: "POST",
        headers: { ...GH_HEADERS, authorization: "Bearer " + token, "content-type": "application/json" },
        body: JSON.stringify({ ref: "master", inputs: { stage_only: "true" } })
      });
      console.log(r.ok ? "stage dispatch: " + r.status : await ghRefusal(r, "stage dispatch:"));
    } catch (e) {
      console.log("stage dispatch FAILED, the hourly stage will catch it: " + String((e && e.message) || e));
    }
  })());
}

/* THE RE-DISPATCH LADDER (26 Sep 2026, plan fold 3.3). The dispatch on a tap is one POST with no
 * retry: GitHub down, a lapsed token or a run dropped under load, and the approval waited for the
 * hourly net. The minute cron now rings the stage again while an approved row is uncommitted, at
 * 15, 30 and 60 minutes after the NEWEST approval, once per rung, then leaves it to the hourly net.
 * The rung is read from the approval's age, not the last try, so a KV read up to a minute stale
 * costs at most one extra dispatch, which the stage's guard stands down. The mark is written
 * BEFORE the dispatch, so a lapsed token, a 4xx or a thrown fetch all count as tries: a batch the
 * fold refuses stays approved and uncommitted for good, and nothing may ring for ever over it.
 * A newer approval starts the ladder again. The healthy chain takes about 8 minutes plus its
 * queue, so the first rung at 15 seldom rings a chain that is merely slow; if it does, the extra
 * run waits behind it on the lock, finds nothing to stage and deploys nothing. It runs every
 * minute, so it reads through `draft_status_committed` (migrations/0012): the uncommitted approved
 * rows alone, never every approved row there has ever been. */
const REDISPATCH_KEY = "stage:redispatch";
const REDISPATCH_MIN = [15, 30, 60];
async function redispatchStale(env, ctx, now) {
  if (!env.SALT_LEDGER || !env.SALT_QUEUE || !dispatchArmed(env)) return { waiting: 0 };
  const r = await env.SALT_LEDGER.prepare(
    "SELECT COUNT(*) AS n, MAX(decided_at) AS newest FROM draft WHERE status='approved' AND committed_at IS NULL").first();
  if (!r || !r.n || !r.newest) return { waiting: 0 };
  let mark = null;
  try { mark = await env.SALT_QUEUE.get(REDISPATCH_KEY, "json"); } catch (e) { mark = null; }   /* unreadable: start again */
  const tries = mark && mark.newest === r.newest ? (mark.tries || 0) : 0;
  if (tries >= REDISPATCH_MIN.length) return { waiting: r.n, newest: r.newest, tries, silent: true };
  const age = (now.getTime() - Date.parse(r.newest)) / 60000;
  if (!Number.isFinite(age) || age < REDISPATCH_MIN[tries]) return { waiting: r.n, newest: r.newest, tries };
  await env.SALT_QUEUE.put(REDISPATCH_KEY, JSON.stringify({ newest: r.newest, tries: tries + 1, at: now.toISOString() }));
  stageOnApproval(env, ctx);
  return { did: true, waiting: r.n, newest: r.newest, tries: tries + 1, last: tries + 1 === REDISPATCH_MIN.length };
}

async function makerRegistrationApprovalFault(env, current) {
  let entry, row;
  try { entry = JSON.parse(current.entry || "{}"); row = JSON.parse(current.row || "{}"); }
  catch { return { error: "The trade's Add ID dependency could not be read.", status: 409 }; }
  const candidates = [entry];
  if (entry.makerRequest && entry.payload?.direction === "SELL" && typeof row.trip === "string") {
    const siblings = await env.SALT_LEDGER.prepare(`SELECT entry FROM draft
      WHERE status='pending' AND committed_at IS NULL AND collection='sales' AND id<>?1
        AND json_extract(row,'$.trip')=?2`).bind(current.id, row.trip).all();
    try { candidates.push(...(siblings.results || []).map((item) => JSON.parse(item.entry || "{}"))); }
    catch { return { error: "The shared trip's Add ID dependencies could not be read.", status: 503 }; }
  }
  const trades = candidates.filter((item) => item.makerRequest && item.payload?.mode === "new"
    && ["BUY", "SELL"].includes(item.payload.direction));
  if (!trades.length) return null;
  const book = await readBook(env.SALT_LEDGER);
  if (!book.version) return { error: "The Desk mirror is being seeded; the trade's Add ID cannot be verified yet.", status: 503 };
  const roster = book.state.roster || [];
  const codes = [...new Set(trades.flatMap((item) => [item.payload?.party, item.payload?.assoc, item.payload?.downstream]
    .filter((code) => typeof code === "string" && !roster.includes(code))))];
  if (!codes.length) return null;
  if (env.VAULT_STORE !== "pair")
    return { error: "This trade's new party needs a verified Add ID from the encrypted-pair store.", status: 503 };
  let registrations;
  try { registrations = await readVaultRegistrations(env.SALT_LEDGER); }
  catch { return { error: "The trade's Add ID could not be verified against the vault receipts and outbox.", status: 503 }; }
  for (const item of trades) {
    const payload = item.payload || {};
    const required = [...new Set([payload.party, payload.assoc, payload.downstream]
      .filter((code) => typeof code === "string" && !roster.includes(code)))];
    if (!required.length) continue;
    const stated = item.registrationDependencies;
    if (!Array.isArray(stated) || stated.length !== required.length
      || stated.some((dependency) => !dependency || Object.keys(dependency).sort().join(",") !== "code,id"
        || typeof dependency.code !== "string" || typeof dependency.id !== "string"))
      return { error: "A new party needs its verified Add ID approved before this trade.", status: 409 };
    for (const code of required) {
      const dependencies = stated.filter((dependency) => dependency.code === code);
      const matching = registrations.filter((registration) => registration.code === code);
      const registration = matching.find((candidate) => candidate.id === dependencies[0]?.id);
      if (dependencies.length !== 1 || matching.length !== 1 || !registration
        || registration.status !== "approved" || registration.id !== dependencies[0].id)
        return { error: code + " needs an approved, receipt- and outbox-matched Add ID before this trade.", status: 409 };
    }
  }
  return null;
}

async function handleDraftDecide(request, env, ctx, id, decision) {
  if (!env.SALT_LEDGER) return json({ ok: false, error: "no ledger binding" }, 503);
  if (!writeOk(request, env)) return needsKey();
  let by = "phone";
  try { const b = await request.json(); if (b && typeof b.by === "string" && b.by.trim()) by = b.by.trim(); } catch (e) { /* body is optional */ }
  const cur = await env.SALT_LEDGER.prepare("SELECT id,status,collection,entry,row FROM draft WHERE id=?1").bind(id).first();
  if (!cur) return json({ ok: false, error: "no such draft" }, 404);
  /* Only a pending draft may be decided. Deciding twice is reported rather than applied, so a
     double tap on a phone cannot flip an approval into a rejection. */
  if (cur.status !== "pending") {
    return json({ ok: false, error: "already " + cur.status, status: cur.status }, 409);
  }
  /* S6 6.5 (D7): A CLAIM'S OWN ENTRY IS HIS CHECK, answered on its order's card, never here: approved here it would book
     money he has not confirmed, rejected here the claim would wait for ever. Once his Received has been given for it (a
     yes that found the row other than he was shown), it is a row like any other, decided here. */
  let claim = false;
  try { claim = !!JSON.parse(cur.entry || "{}").claim; } catch (e) { claim = false; }
  if (claim) {
    let yes = null;
    try { yes = await env.SALT_LEDGER.prepare("SELECT id FROM preapproval WHERE draft_id=?1").bind(id).first(); } catch (e) { yes = null; }
    if (!yes) return json({ ok: false, error: "a payment they say they sent is answered on its order's card, Received or Not found" }, 409);
  }
  if (decision === "approved") {
    const dependency = await makerRegistrationApprovalFault(env, cur);
    if (dependency) return json({ ok: false, error: dependency.error }, dependency.status);
  }
  const decide = env.SALT_LEDGER.prepare(
    "UPDATE draft SET status=?1, decided_at=?2, decided_by=?3 WHERE id=?4 AND status='pending'"
  ).bind(decision, new Date().toISOString(), by, id);
  const releases = decision === "rejected" && await hasInputAdmission(env.SALT_LEDGER, id, JSON.parse(cur.entry || "{}"));
  /* 05 Oct 2026, HIS WORD: ONE TAP FOR THE WHOLE TRIP. Every other row of this row's trip still pending is decided the
     same way IN THE SAME BATCH as the tapped row, one transaction, so a trip is decided whole or not at all. A claim and a
     row a site order made are never decided here (each has its own card), so neither is swept in. */
  const ts = await tripStmts(env.SALT_LEDGER, id, cur.row, decision, by);
  const head = [decide].concat(releases ? [admissionDecision(env.SALT_LEDGER, id, "rejected", true)] : []);
  const res = head.length + ts.stmts.length > 1 ? await env.SALT_LEDGER.batch(head.concat(ts.stmts)) : [await decide.run()];
  const upd = res[0];
  const trip = ts.ids.filter((x) => { const r = res[head.length + x.i]; return r && r.meta && r.meta.changes > 0; }).map((x) => x.id);
  /* 08 Sep 2026: THE SELECT ABOVE IS NOT THE UPDATE. Two taps in the same instant both read
     `pending`; the second UPDATE changes no row, and used to answer 200 with the first tap's
     decision in the body, and ring the stage for an approval that was in fact a rejection. */
  if (upd && upd.meta && upd.meta.changes === 0) {
    const now = await env.SALT_LEDGER.prepare("SELECT status FROM draft WHERE id=?1").bind(id).first();
    return json({ ok: false, error: "already " + ((now && now.status) || "decided"), status: now && now.status }, 409);
  }
  /* S11: an approval sets going what any approval does; a rejection spends any yes that was waiting on this row */
  let moved = [];
  if (decision === "approved") moved = await afterApproval(env, ctx, [id].concat(trip));
  let dropped = 0;
  if (decision === "rejected") {
    try { dropped = await dropQueued(env, [id].concat(trip)); } catch (e) { /* the decision stands; the POST filter catches a re-post */ }
    try { await env.SALT_LEDGER.prepare("UPDATE preapproval SET status='void', decided_at=?1 WHERE (entry_at=?2 OR draft_id=?2) AND status IN ('waiting','differs')").bind(new Date().toISOString(), id).run(); }
    catch (e) { /* a store before migrations/0011 has no yes to spend */ }
  }
  const row = await env.SALT_LEDGER.prepare(`SELECT ${DRAFT_COLS} FROM draft WHERE id=?1`).bind(id).first();
  const d = row ? draftOut(row) : null;
  /* 24 Sep 2026: a row a site order made tells that order it was rejected, or its card goes on
     claiming the row (rejectedOnOrder). The decision stands whether or not the site takes it. */
  let order;
  if (decision === "rejected" && d && d.entry && d.entry.orderId) {
    try { order = await rejectedOnOrder(env, d.entry, new Date().toISOString()); } catch (e) { order = false; }
  }
  return json(Object.assign({ ok: true, draft: d, dropped }, order === undefined ? {} : { order }, moved.length ? { moved } : {}, trip.length ? { trip } : {}));
}
/* The rows of a trip decided with the one tapped: pending, uncommitted sales of the same trip, neither a claim nor made by
   a site order. Returns the statements to run in the tapped row's batch, and where each row's UPDATE sits in them. */
export async function tripStmts(db, id, rowText, decision, by) {
  let tripId = null;
  try { tripId = (JSON.parse(rowText || "{}") || {}).trip || null; } catch (e) { tripId = null; }
  if (!tripId) return { stmts: [], ids: [] };
  const sib = await db.prepare(
    "SELECT id,entry FROM draft WHERE status='pending' AND committed_at IS NULL AND collection='sales' AND id<>?1 AND json_extract(row,'$.trip')=?2"
  ).bind(id, tripId).all();
  const rows = (sib.results || []).filter((r) => { try { const e = JSON.parse(r.entry || "{}"); return !e.claim && !e.orderId; } catch (e) { return false; } });
  const at = new Date().toISOString(), stmts = [], ids = [];
  for (const r of rows) {
    ids.push({ id: r.id, i: stmts.length });
    stmts.push(db.prepare("UPDATE draft SET status=?1, decided_at=?2, decided_by=?3 WHERE id=?4 AND status='pending'").bind(decision, at, by, r.id));
    if (decision === "rejected" && await hasInputAdmission(db, r.id, JSON.parse(r.entry || "{}"))) stmts.push(admissionDecision(db, r.id, "rejected", true));
  }
  return { stmts, ids };
}

/* Marked by the commit run once the row is actually in the master, so an approved row is not
   offered to it twice. Only an approved draft can be committed. */
async function handleDraftCommitted(request, env, id) {
  if (!env.SALT_LEDGER) return json({ ok: false, error: "no ledger binding" }, 503);
  if (!writeOk(request, env)) return needsKey();
  const cur = await env.SALT_LEDGER.prepare("SELECT status,committed_at,entry FROM draft WHERE id=?1").bind(id).first();
  if (!cur) return json({ ok: false, error: "no such draft" }, 404);
  if (cur.status !== "approved") return json({ ok: false, error: "only an approved draft may be committed; this one is " + cur.status }, 409);
  if (cur.committed_at) {
    if (cur.entry && await hasInputAdmission(env.SALT_LEDGER, id, JSON.parse(cur.entry)))
      await finishInputAdmission(env.SALT_LEDGER, id, "committed");
    return json({ ok: true, id, alreadyCommitted: true, committedAt: cur.committed_at });
  }
  const at = new Date().toISOString();
  /* v519: liveAt is the deploy job's proof time, sent with the mark; absent on an older caller */
  let liveAt = null;
  try { const b = await request.json(); if (b && typeof b.liveAt === "string" && !Number.isNaN(Date.parse(b.liveAt))) liveAt = b.liveAt; } catch (e) { /* no body */ }
  const mark = env.SALT_LEDGER.prepare("UPDATE draft SET committed_at=?1, live_at=?2 WHERE id=?3 AND committed_at IS NULL").bind(at, liveAt, id);
  if (cur.entry && await hasInputAdmission(env.SALT_LEDGER, id, JSON.parse(cur.entry)))
    await env.SALT_LEDGER.batch([mark, admissionDecision(env.SALT_LEDGER, id, "committed", true)]);
  else await mark.run();
  return json({ ok: true, id, committedAt: at, liveAt });
}

async function handleDrafts(request, env, ctx, url, p, m) {
  if (p === "/drafts") {
    if (m === "GET") return handleDraftsGet(env, url);
    if (m === "POST") return handleDraftPost(request, env);
    return json({ ok: false, error: "method not allowed" }, 405);
  }
  const mm = p.match(/^\/drafts\/(.+?)\/(approve|reject|committed)$/);
  if (!mm) return json({ ok: false, error: "not found" }, 404);
  if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
  const id = decodeURIComponent(mm[1]);
  if (mm[2] === "committed") return handleDraftCommitted(request, env, id);
  return handleDraftDecide(request, env, ctx, id, mm[2] === "approve" ? "approved" : "rejected");
}

export default {
  /* THE CLOUD DRAFTER (v303), on a cron. This is what takes the laptop out of the loop: a
   * queued entry becomes a proposed row here, in the cloud, and waits on the phone.
   *
   * It drafts and stops. It does not approve, does not write to `entry`, and does not touch
   * the master. Everything it needs is already in the store: the book from the mirror, the
   * cost and floors from the pricing snapshot the extract takes with the desk's own functions.
   *
   * A failure here must be loud in the logs and must NOT retry blindly: the insert is
   * INSERT OR IGNORE keyed on the entry's own `at`, so a re-run is harmless, and the next
   * tick is a better retry than a loop. */
  async scheduled(event, env, ctx) {
    /* TWO SCHEDULES, AND THEY DO DIFFERENT JOBS. The every-minute one nudges on a new customer
       order and, on the quarter-hour, runs the drafter's safety net, which pushes only when it
       actually wrote a row. The daily one at 01:00 UTC,
       which is 09:00 in Kuala Lumpur, is the morning nudge.
       THE NUDGE ONLY FIRES IF THERE IS SOMETHING. A banner every morning saying the book is
       square is a banner that gets swiped away unread, and then so does the one that mattered. */
    const daily = String(event && event.cron || "").startsWith("0 1 ");
    ctx.waitUntil((async () => {
      try {
        if (env.VAULT_STORE === "pair") {
          try { await recoverVaultInputs(env); }
          catch (error) { console.error("vault recovery batch unavailable; incumbent cron continues"); }
        }
        if (daily) {
          let worth = false;
          try {
            const d = await env.SALT_LEDGER.prepare("SELECT COUNT(*) AS n FROM draft WHERE status='pending'").first();
            if ((d && d.n) > 0) worth = true;
            /* v708, his instruction of 18 Sep 2026: "if paid, I will need to refund immediately".
               Money he is HOLDING that is somebody else's was the one open figure nothing chased
               him about. customerRefunds is a COLLECTION, so it is in `entry` and not in `state`,
               and a refund carries `since` rather than a date, so the seed leaves entry.date null:
               neither can be keyed on. The row itself says whether it is paid. */
            const rf = await env.SALT_LEDGER.prepare("SELECT doc FROM entry WHERE collection='customerRefunds'").all();
            if ((rf.results || []).some((r) => { try { return !JSON.parse(r.doc).paidOn; } catch (e) { return false; } })) worth = true;
          } catch (e) { console.log("nudge check failed: " + String(e)); }
          console.log("morning nudge: " + (worth ? "sending" : "nothing worth saying"));
          if (worth) await sendPush(env, { tag: "salt", urgency: "normal" });
          return;
        }
        /* V4a: an order acknowledged before the row key named the product takes the key as it is now, once, before
           anything this minute reads its key */
        try {
          const rk = await rekeyOrders(env);
          if (!rk.ok || rk.rekeyed || rk.failed) console.log("orders rekey: " + JSON.stringify(rk));
        } catch (e) { console.log("orders rekey FAILED: " + String((e && e.stack) || e)); }
        /* v764: what the book already holds, back the other way, before the read of what the orders owe:
           an order brought level here owes nothing for the reconcile to queue. A cheap read of the book's
           version on a quiet minute; the site is asked only after a fold. */
        try {
          const ts = await tellSite(env);
          if (!ts.ok || ts.told || ts.followed || ts.fixed || ts.refused || ts.waiting || ts.failed) console.log("orders return leg: " + JSON.stringify(ts));
        } catch (e) { console.log("orders return leg FAILED: " + String((e && e.stack) || e)); }
        /* fold 5.6: ONE READ OF THE SITE for the nudge and the reconcile together (tickRead), after the return
           leg so the owed orders are read as it left them. Failed or unread, each step asks for its own. */
        let read = null;
        try {
          read = await tickRead(env);
          if (!read.ok) console.log("orders read: " + JSON.stringify(read));
        } catch (e) { console.log("orders read FAILED: " + String((e && e.stack) || e)); }
        /* THE EVERY-MINUTE SCHEDULE (16 Sep 2026) exists for the order nudge, and it goes before the
           reconcile so a drafter failure cannot swallow it. A customer order placed since the last
           minute wakes the phones that asked for orders, once. */
        try {
          const n = await nudgeOrders(env, read);
          if (!n.ok || n.newest) console.log("orders nudge: " + JSON.stringify(n));
        } catch (e) { console.log("orders nudge FAILED: " + String((e && e.stack) || e)); }
        /* v694: and the stages the ledger has not been told about. THE ONE PLACE THAT QUEUES them,
           so no two roads can queue the same stage; it drafts what it queued rather than waiting
           for the quarter-hour, because he is looking at Approve. */
        try {
          const rc = await reconcileOrders(env, read);
          /* waiting is logged too (20 Sep 2026): a stage held for its row was invisible for as long as it waited */
          if (!rc.ok || rc.queued || rc.unmapped || rc.waiting || rc.failed || rc.dropped) console.log("orders reconcile: " + JSON.stringify(rc));
          /* S11: and what the desk queued itself, beside it */
          const dp = await deskPass(env, new Date(event.scheduledTime || Date.now()));
          if (dp.queued || dp.dropped || dp.approved) console.log("orders desk pass: " + JSON.stringify(dp));
          await afterApproval(env, ctx, dp.approved);
          if (rc.queued || dp.queued) { const d = await runDrafter(env); console.log("drafter (orders): " + JSON.stringify(d)); await pushIfDrafted(env, d); await afterApproval(env, ctx, d.approved); }
        } catch (e) { console.log("orders reconcile FAILED: " + String((e && e.stack) || e)); }
        /* fold 3.3: an approval still uncommitted is rung again on the ladder; one line a try, none after the last */
        try {
          const rd = await redispatchStale(env, ctx, new Date(event.scheduledTime || Date.now()));
          if (rd.did) console.log("stage re-dispatch " + rd.tries + " of " + REDISPATCH_MIN.length + " for " + rd.waiting + " approved row(s) up to " + rd.newest
            + (rd.last ? ": the last; the hourly net stands" : ""));
        } catch (e) { console.log("stage re-dispatch FAILED: " + String((e && e.stack) || e)); }
        /* the drafter's net still runs on the quarter-hour, as it did when this schedule ran every fifteen minutes */
        if (new Date(event.scheduledTime || Date.now()).getUTCMinutes() % 15 === 0) {
          const r = await runDrafter(env);
          console.log("drafter: " + JSON.stringify(r));
          await pushIfDrafted(env, r);
          await afterApproval(env, ctx, r.approved);
        }
      } catch (e) {
        console.log("scheduled FAILED: " + String((e && e.stack) || e));
      }
    })());
  },

  async fetch(request, env, ctx) {
    const held = maintenance(request, env);
    if (held) return held;
    const url = new URL(request.url);
    const p = (url.pathname.replace(/\/+$/, "") || "/");
    const m = request.method;

    /* Private Counter-to-Desk capability routes are matched before the public Access/read and
       asset paths. Unknown paths under this prefix never fall through to ASSETS. */
    if (p === "/_internal/maker" || p.startsWith("/_internal/maker/")) return handleInternalMaker(request, env, ctx, p, m);

    /* Fail closed. With REQUIRE_ACCESS on, a request that did not pass Cloudflare
     * Access gets nothing: not the ledger, not the queue, not the build id. Access
     * being off at the dashboard must read as an outage, never as an open desk.
     * The API paths answer JSON so the desk's ping-fail path degrades cleanly.
     *
     * ONE EXCEPTION, AND ONLY THIS PATH: the Counter's service-binding read of the build id
     * carries STMT_DESK_KEY and no owner JWT, so it is answered before the human gate. It is
     * a capability, not a sign-in: GET only, the key checked in constant time, the manifest
     * validated, and nothing else under /stmt/ is let past. */
    if (p === "/stmt/rev") return handleStmtRev(request, env, url, m);
    if (!await accessOk(request, env, p, m)) {
      if (p === "/queue" || /^\/queue\/[^/]+\/withdraw$/.test(p) || p === "/queue/ping" || p === "/vault" || p === "/bio" || p === "/bye"
        || p === "/vault/addr" || p === "/vault/pair" || p === "/vault/maintenance" || p === "/vault/key" || p === "/geo/expand" || p.startsWith("/slips/")
        || p === "/rev" || p === "/ledger" || p.startsWith("/ledger/")
        || p === "/drafts" || p.startsWith("/drafts/"))
        return json({ ok: false, error: "not authenticated" }, 401);
      return locked();
    }

    /* --- READS THAT CARRY THE BOOK ARE KEYED TOO (20 Aug 2026) ---------------------
     * The posture used to be "reads open, writes gated", and the gap in it was found by
     * reading the responses rather than the policy. `GET /drafts` returns each proposed row
     * WITH ITS COST AND MARGIN; `GET /ledger` returns the mirror; `GET /queue` returns every
     * device's pending entries. So the three figures the desk works hardest to keep off the
     * public payload -- the phone app's leak gate banned every per-unit cost from data.json
     * for exactly this reason -- were being served in full to anyone with the URL.
     *
     * These three now need the same X-Salt-Key as a write. `/rev`, `/queue/ping` and the
     * static assets stay open: a build id and a liveness probe carry no trade. The site is
     * still PUBLIC in the sense the owner asked for on 11 Aug, and this is not Access coming
     * back; it is the write key covering the reads that are as sensitive as a write.
     *
     * Ordered before the routes rather than added to each handler, so a route added later
     * cannot quietly miss it. */
    if ((p === "/queue" || /^\/queue\/[^/]+\/withdraw$/.test(p) || p === "/ledger" || p.startsWith("/ledger/")
      || p === "/drafts" || p.startsWith("/drafts/")
      || p === "/orders" || p.startsWith("/orders/") || p === "/stmt-users" || p === "/bulletin" || p === "/expected" || p === "/hush"
      || p.startsWith("/claims/")   /* S6: a claim against an account, read and answered like an order */
      || p === "/threads" || p.startsWith("/threads/")   /* Step 7: an account's thread, read and answered like an order's */
      || p === "/vault/addr" || p === "/vault/pair" || p === "/geo/expand"   /* F14: an exact point is more than a name, and a short link opened is his */
      || p === "/vault/maintenance"
      || p === "/vault/key"   /* F13: the slip key's envelope is his alone */
      || p.startsWith("/slips/")   /* F13: a slip is ciphertext, and still his alone to fetch */
      /* /push/key is the ONE push route left open, and only because the VAPID public
         key is public by definition: a browser cannot create a subscription without
         it, and it authorises nothing on its own. Everything else under /push either
         stores a subscription, reads the book, or sends. */
      || (p.startsWith("/push") && p !== "/push/key")) && !writeOk(request, env)
      /* the one narrowing: a caller holding only the push key may send, and may do nothing
         else. It cannot subscribe, cannot read the summary and cannot list subscribers. */
      && !(p === "/push/send" && pushKeyOk(request, env))) return needsKey();

    // --- the desk's HTTP contract -------------------------------------------------
    if (p === "/queue/ping") {
      // cloud:true tells the ported desk to skip the 3s heartbeat and the /bye beacon,
      // and to keep names device-local. writes:['queue'] mirrors serve_desk.py's shape.
      return json({ ok: true, cloud: true, writes: ["queue"] });
    }
    if (p === "/vault/maintenance") {
      if (m !== "GET") return json({ ok: false, error: "Maintenance changes require the authorized account CLI, not a device key." }, 405);
      return json({ ok: true, ...await vaultWriteStatus(env.SALT_LEDGER) });
    }
    if (p === "/queue") {
      if (m === "POST") return handleQueuePost(request, env, ctx);
      if (m === "GET") return handleQueueGet(env);
      return json({ ok: false, error: "method not allowed" }, 405);
    }
    const queueWithdrawal = /^\/queue\/([^/]+)\/withdraw$/.exec(p);
    if (queueWithdrawal) {
      if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
      if (!writeOk(request, env)) return needsKey();
      let id;
      try { id = decodeURIComponent(queueWithdrawal[1]); }
      catch { return json({ ok: false, error: "The entry timestamp is invalid.", state: "entry-changed" }, 400); }
      return withdrawMakerQueueEntry(request, env, id, true);
    }
    if (p === "/bye") return json({ ok: true });            // no server to stop; answer so the beacon is quiet

    /* ONE SURFACE, AND NOW ONLY ONE (v387, his instruction). v290 split them: the root was
     * the phone app and the desk sat at /desk, because a 1.3 MB page built for a laptop rail
     * was not a phone app. That reason went with v371, when the rail became a menu and the
     * desk started laying out like one. v376 made the desk the root and kept the app at /app
     * deliberately, as the difference between a bad afternoon and no phone surface at all,
     * to be retired when a week had passed without it.
     * IT IS RETIRED. The desk is the sole and only cloud copy of this book. /desk still
     * answers so every link and bookmark holds, and /app is gone rather than left to rot:
     * a route serving a surface nobody maintains is worse than no route. public/index.html
     * is archived beside the repo, not deleted. */
    /* THE BROWSER'S OWN REVALIDATION REACHES THE STORE, AND A 304 COMES BACK. The request is
     * forwarded whole, so If-None-Match and HEAD arrive; a matching ETag answers 304 with no
     * body instead of the whole page on every open. The store is asked for /desk, where it
     * serves desk.html: it sends /desk.html there with a 307 (measured live), and a request
     * arriving at the Worker carries redirect "manual", so asking for /desk.html with the
     * request forwarded would get the 307 back and answer 404 here. Only GET and HEAD are
     * the desk; anything else falls through to the not found at the end. */
    if ((p === "/desk" || p === "/") && (m === "GET" || m === "HEAD")) {
      const res = await env.ASSETS.fetch(new Request(new URL("/desk", url), request));
      if (res && (res.ok || res.status === 304)) return res;
      return json({ ok: false, error: "the desk is not built" }, 404);
    }

    /* What build is live. The phone polls this every ten seconds and reloads when the id
     * differs from the one baked into the page it is running, which is how a deploy from
     * the laptop reaches a phone already sitting open. It is deliberately the smallest
     * thing that answers the question: the id, the version and when it was built.
     * Served with no-store, and read through ASSETS so it is written by the build alone. */
    if (p === "/rev") {
      try {
        const res = await env.ASSETS.fetch(new Request(new URL("/rev.json", url), { method: "GET" }));
        if (!res || !res.ok) return json({ ok: false, error: "no build manifest" }, 404);
        return new Response(await res.text(), { status: 200, headers: JSON_HEADERS });
      } catch (e) {
        return json({ ok: false, error: "no build manifest" }, 404);
      }
    }
    /* The ledger store. READ ONLY, and no POST branch exists on purpose: see handleLedger. */
    if (p === "/ledger" || p.startsWith("/ledger/")) {
      if (m === "GET") return handleLedger(env, url);
      return json({ ok: false, error: "the ledger store is read-only; the master is still the source" }, 405);
    }
    /* The approval step. Reads open, decisions write-gated, same posture as everything else. */
    if (p === "/drafts" || p.startsWith("/drafts/")) return handleDrafts(request, env, ctx, url, p, m);
    /* THE CUSTOMER ORDERS (06 Sep 2026), relayed from the statements site: see src/orders.js.
       Keyed like the drafts, because an order names a party and a figure. NO MOVE HERE WRITES a
       queue entry since v694: the every-minute reconcile is the one road, so a stage cannot be
       queued twice by two roads at once, and the order's card says a row is on its way. */
    /* v507: the username-to-code map the publish writes here, for the printed board. Keyed: a
       username is the address of an account. Inverted on the desk. */
    if (p === "/stmt-users") {
      if (m !== "GET") return json({ ok: false, error: "method not allowed" }, 405);
      /* v564: the site's own address travels with the usernames, for the QR the desk draws on the
         board sheet. BEHIND THE KEY, with them, and never in the desk's HTML: /desk is public and
         the statements site is deliberately on its own cryptic name. tools/stmt-publish.mjs writes
         both keys on every deploy; a desk that gets no site draws no QR and says so. */
      return json({ ok: true, users: (await env.SALT_QUEUE.get("stmt-users", "json")) || {},
                    site: (await env.SALT_QUEUE.get("stmt-site")) || null });
    }
    /* THE BULLETIN (20 Sep 2026): his notice board across the top of Salt Counter, set from Enter and
       relayed to the site's own store over the binding. The words are checked in the relay, this Worker
       being the one place that may hold the desk's own name. */
    if (p === "/bulletin") {
      if (m === "GET") { const r = await bulletinRelay(env, "GET"); return json(r, r.ok ? 200 : (r.status || 502)); }
      if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
      let b = {};
      try { b = await request.json(); } catch { b = {}; }
      const r = await bulletinRelay(env, "POST", b);
      return json(r, r.ok ? 200 : (r.status || 502));
    }
    /* F4 (05 Oct 2026): the restock date, set from Enter and relayed to the site's store the bulletin's way */
    if (p === "/expected") {
      if (m === "GET") { const r = await expectedRelay(env, "GET"); return json(r, r.ok ? 200 : (r.status || 502)); }
      if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
      let b = {};
      try { b = await request.json(); } catch { b = {}; }
      /* a book the master does not hold is refused here, before the relay: its ids are the PRICING snapshot's byProduct, which
         the desk derives from PROD_IDS */
      let ids = null;
      try { const bk = await readBook(env.SALT_LEDGER); ids = bk.pricing && bk.pricing.byProduct ? Object.keys(bk.pricing.byProduct) : null; } catch { ids = null; }
      if (!ids || !ids.length) return json({ ok: false, error: "the live book's products could not be read" }, 503);
      if (typeof b.product !== "string" || !ids.includes(b.product)) return json({ ok: false, error: "that is not one of the book's products" }, 400);
      const r = await expectedRelay(env, "POST", b);
      return json(r, r.ok ? 200 : (r.status || 502));
    }
    /* A5: the hushed Whiteboard tips, one store for the desk and Counter Maker */
    if (p === "/hush") {
      if (!env.SALT_QUEUE) return json({ ok: false, error: "the Desk queue is required" }, 503);
      if (m === "GET") return json({ ok: true, hush: await hushGet(env.SALT_QUEUE) });
      if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
      let b = {};
      try { b = await request.json(); } catch { b = {}; }
      const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10), until = b && b.until !== undefined ? b.until : null;
      const extra = !b || typeof b !== "object" || Array.isArray(b) || Object.keys(b).some((k) => !["id", "until", "clear"].includes(k));
      const fault = extra ? "A hush carries only id, until and clear." : hushFault(b.id, b.clear === true ? null : until, today);
      if (fault || b.clear !== undefined && b.clear !== true) return json({ ok: false, error: fault || "clear is true or absent" }, 400);
      return json({ ok: true, hush: await hushPut(env.SALT_QUEUE, b.id, until, today, b.clear === true) });
    }
    if (p === "/orders") {
      if (m !== "GET") return json({ ok: false, error: "method not allowed" }, 405);
      /* S9 9.8: the page's own read carries the count of associate links waiting in Salt Account */
      const r = await listOrders(env, url.searchParams.get("all") === "1", true);
      /* S6 6.6: and the claims against accounts beside them, each on a card of its own; a site that cannot say leaves none */
      if (r.ok) { const c = await listClaims(env, url.searchParams.get("all") === "1"); r.claims = c.ok ? c.claims : []; if (!c.ok) r.claimsUnread = c.error; }
      /* Step 7: and every account's thread, his Chat, each on a card of its own */
      if (r.ok) { const t = await listThreads(env); r.threads = t.ok ? t.threads : []; if (!t.ok) r.threadsUnread = t.error; }
      /* S11 11.13: and what each has to offer again, a row he rejected, read off the drafts; the desk's alone */
      if (r.ok && env.SALT_LEDGER) {
        const again = await againOf(env.SALT_LEDGER, r.orders.map((o) => o.id));
        for (const o of r.orders) if (again[o.id]) o.again = again[o.id];
        /* and whether his Accept is given and not yet spent: its row being drafted (`waiting`), or waiting under Approve
           because it came out other than he saw (`differs`); the card then offers no second Accept */
        try {
          /* Negotiate: an offer of his waiting on their answer, its row not yet queued, is `offer`: the card shows it open */
          const ys = await env.SALT_LEDGER.prepare("SELECT order_id,status,(entry IS NULL AND json_extract(shown,'$.offer') IS NOT NULL) AS off FROM preapproval WHERE stage='ack' AND status IN ('waiting','differs')").all();
          const yes = new Map((ys.results || []).map((y) => [y.order_id, y.off && y.status === "waiting" ? "offer" : y.status]));
          for (const o of r.orders) if (yes.has(o.id)) o.yes = yes.get(o.id);
        } catch (e) { /* a store before migrations/0011 has no yes to say */ }
      }
      return json(r, r.ok ? 200 : 503);
    }
    /* Step 7: HIS CHAT. Every account's thread, read every 2 seconds while one is open on his screen; and his line on one,
       or his No reply needed, checked by siteWords before it goes */
    if (p === "/threads") {
      if (m !== "GET") return json({ ok: false, error: "method not allowed" }, 405);
      const r = await listThreads(env);
      return json(r, r.ok ? 200 : 503);
    }
    const tm = /^\/threads\/([^/]+)$/.exec(p);
    if (tm) {
      if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
      let b = {};
      try { b = await request.json(); } catch { b = {}; }
      const r = await threadRelay(env, decodeURIComponent(tm[1]), b);
      return json(r, r.ok ? 200 : (r.status || 502));
    }
    /* S9 9.8 FIX: the desk's page tells Salt Account what waits here, its own Waiting on you count (tellWaiting) */
    if (p === "/orders/waiting") {
      if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
      let b = {};
      try { b = await request.json(); } catch { b = {}; }
      const r = await tellWaiting(env, b && b.n, b && b.age);
      return json(r, r.ok ? 200 : (r.status || 502));
    }
    /* S11: THE CARD'S OWN ROUTES, by the order's id alone. An order id is minted digits and letters with a
       dash (mintOrderId) and is never one of these words, so they are read before a move `/orders/<u>/<id>`. */
    /* S6 11.14: Not found, on a claim of theirs on an order, or against the account (the claim's id begins with `a`) */
    const nf = /^\/(orders|claims)\/([^/]+)\/notfound$/.exec(p);
    if (nf) {
      if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
      let b = {};
      try { b = await request.json(); } catch { b = {}; }
      let r;
      try { r = nf[1] === "orders" ? await notFoundOrder(env, decodeURIComponent(nf[2]), b) : await notFoundClaim(env, decodeURIComponent(nf[2]), b); }
      catch (e) { r = { ok: false, status: 500, error: String((e && e.message) || e) }; }
      return json(r, r.ok ? 200 : (r.status || 502));
    }
    /* S6 11.15: a claim against the account, drawn row by row and received in one tap */
    const cc = /^\/claims\/([^/]+)\/(preview|received)$/.exec(p);
    if (cc) {
      if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
      let b = {};
      try { b = await request.json(); } catch { b = {}; }
      const by = (b && typeof b.by === "string" && b.by.trim().slice(0, 40)) || "phone";
      let r;
      try {
        if (cc[2] === "preview") { r = await claimPreview(env, decodeURIComponent(cc[1])); if (r.ok) delete r.own; }
        else {
          r = await claimReceived(env, decodeURIComponent(cc[1]), b, by);
          if (r.approved && r.approved.length) await afterApproval(env, ctx, r.approved);
        }
      } catch (e) { r = { ok: false, status: 500, error: String((e && e.message) || e) }; }
      return json(r, r.ok ? 200 : (r.status || 502));
    }
    const cm = /^\/orders\/([^/]+)\/(preview|accept|handed|cash|received|again|restate|offer|withdraw)$/.exec(p);
    if (cm) {
      if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
      let b = {};
      try { b = await request.json(); } catch { b = {}; }
      const id = decodeURIComponent(cm[1]);
      let r;
      const by = (b && typeof b.by === "string" && b.by.trim().slice(0, 40)) || "phone";
      try {
        if (cm[2] === "preview") r = await previewOrder(env, id, b);
        /* Negotiate: his offer on an order whose price they asked for, and its withdrawal */
        else if (cm[2] === "offer") r = await offerOrder(env, id, b, by);
        else if (cm[2] === "withdraw") r = await withdrawOffer(env, id, b);
        else if (cm[2] === "accept") {
          r = await acceptOrder(env, id, b, by);
          /* the stage rung for the row his yes approved; any other row the same drafting pass approved is followed
             as every approval is (its own order moved), this one having moved its order already */
          const others = ((r.drafted && r.drafted.approved) || []).filter((x) => x !== r.draft);
          if (others.length) await afterApproval(env, ctx, others);
          else if (r.approved) stageOnApproval(env, ctx);
        } else {
          /* S11 11.12: Collected, Cash received and Received record his yes, then the site hears the move and the
             ledger is told in the request's tail, as any move of his is (v762) */
          r = await ({ handed: handedOrder, cash: cashOrder, restate: restateOrder, received: receivedOrder, again: againOrder })[cm[2]](env, id, b, by);
          if (r.ok && r.preapproval && r.preapproval.spent === "applied") await afterApproval(env, ctx, [r.preapproval.draft]);
          if (r.ok) reconcileOnTap(env, ctx);
        }
      } catch (e) { r = { ok: false, status: 500, error: String((e && e.message) || e) }; }
      return json(r, r.ok ? 200 : (r.status || 502));
    }
    const om = /^\/orders\/([^/]+)\/([^/]+)$/.exec(p);
    if (om) {
      if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
      let b = {};
      try { b = await request.json(); } catch { b = {}; }
      /* S11: cash he took moves the ledger's mark with it, so only the cash route, which books its row, may send it */
      /* `maker` is Counter Admin's alone, set by the Desk's own private route; a phone never carries it */
      if (b && typeof b === "object") delete b.maker;
      if (b && b.cash) return json({ ok: false, error: "cash taken is recorded through orders/<id>/cash, which books its row" }, 400);
      /* S6: and a claim is answered only through orders/<id>/received, which books its row */
      if (b && b.verdict) return json({ ok: false, error: "a claim is answered through orders/<id>/received, which books its row" }, 400);
      const r = await moveOrder(env, om[1], om[2], b);
      if (!r.ok) return json({ ok: false, error: r.error }, r.status || 502);
      if (!r.order.code) r.warn = "no desk code is mapped to " + r.order.u + ", so nothing can be queued for the ledger: publish the statements again";
      /* v762: and the ledger hears about it now. ONLY A MOVE: a mark is the reconcile's own
         bookkeeping written back, and answering it with another reconcile would be the desk
         talking to itself; a line on the thread moves no goods and no money. */
      if (b && (b.status || b.handover)) reconcileOnTap(env, ctx);
      return json(r);
    }
    /* Run the drafter on demand rather than waiting for the cron: needed to prove it from
       outside, and needed the moment an entry is queued and you want the row now. Write-gated,
       because it writes rows into `draft`. `?dry=1` reports what it would draft and stores
       nothing. */
    /* ---- WEB PUSH -------------------------------------------------------------------
     * The phone asks for the public key, subscribes, and from then on the Worker can WAKE its
     * service worker. Nothing is ever sent IN the push: see src/push.js for why. The worker
     * wakes, reads /push/summary, and writes the banner from live state.
     */
    if (p === "/push/key") {
      return json({ ok: true, key: env.VAPID_PUBLIC_KEY || null,
        configured: !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_JWK) });
    }
    if (p === "/push/subscribe") {
      if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
      if (!env.SALT_QUEUE) return json({ ok: false, error: "no KV binding" }, 500);
      let b;
      try { b = await request.json(); } catch { return json({ ok: false, error: "bad JSON" }, 400); }
      const ep = b && b.endpoint;
      if (typeof ep !== "string" || !/^https:\/\//.test(ep)) {
        return json({ ok: false, error: "a subscription needs an https endpoint" }, 400);
      }
      /* KEYED BY A HASH OF THE ENDPOINT, not by device id. The same phone resubscribing with a
         new endpoint is a new record and the old one dies on its next 410; two devices never
         collide; and the raw endpoint, which is a capability URL, is not in the key name. */
      const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ep));
      const id = [...new Uint8Array(h)].slice(0, 12).map((x) => x.toString(16).padStart(2, "0")).join("");
      /* topics, when given, narrow what wakes this device: see sendPush */
      const topics = Array.isArray(b.topics) ? b.topics.filter((t) => typeof t === "string" && /^[a-z]{1,20}$/.test(t)).slice(0, 8) : null;
      await env.SALT_QUEUE.put("push:" + id, JSON.stringify(Object.assign({ endpoint: ep, at: new Date().toISOString() }, topics ? { topics } : {})));
      return json({ ok: true, id });
    }
    if (p === "/push/unsubscribe") {
      if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
      let b;
      try { b = await request.json(); } catch { return json({ ok: false, error: "bad JSON" }, 400); }
      if (!b || !b.endpoint) return json({ ok: false, error: "no endpoint" }, 400);
      const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(b.endpoint)));
      const id = [...new Uint8Array(h)].slice(0, 12).map((x) => x.toString(16).padStart(2, "0")).join("");
      await env.SALT_QUEUE.delete("push:" + id);
      return json({ ok: true, id, removed: true });
    }
    /* WHAT THE WOKEN SERVICE WORKER READS. Counts and states only: no money, no party code, no
       date. It is still keyed, because the rule set on 20 Aug is that a read carrying the book
       needs the key, and a rule with a convenient exception stops being a rule. */
    if (p === "/push/summary") {
      const out = { ok: true, pending: 0, refused: 0, refunds: 0, now: 0, lines: [] };
      try {
        if (env.SALT_LEDGER) {
          const d = await env.SALT_LEDGER.prepare("SELECT COUNT(*) AS n FROM draft WHERE status='pending'").first();
          out.pending = (d && d.n) || 0;
          const r = await env.SALT_LEDGER.prepare("SELECT COUNT(*) AS n FROM refused").first();
          out.refused = (r && r.n) || 0;
          /* v759: THE REFUND THE MORNING ROUND WAKES HIM FOR. It fires on an open customerRefunds row
             (v708) and the banner never named one, so the round he now actually receives could read
             "square" over money he is holding that is somebody else's. Read exactly as the nudge
             reads it: the collection lives in `entry`, and the row itself says whether it is paid. */
          try {
            const rf = await env.SALT_LEDGER.prepare("SELECT doc FROM entry WHERE collection='customerRefunds'").all();
            out.refunds = (rf.results || []).filter((x) => { try { return !JSON.parse(x.doc).paidOn; } catch (e) { return false; } }).length;
          } catch (e) { out.refunds = 0; }
        }
        /* 24 Sep 2026: `placed` apart, because only those are his to acknowledge; an acknowledged
           order is a row (v766) and the banner no longer asks him to acknowledge it */
        /* 29 Sep 2026: and the lines a customer wrote since `?since=` (an ISO moment; none, the last ten minutes), at most three, so his banner
           can show each on its own. Read off the orders this already reads, stored nowhere. */
        const ow = await ordersWaiting(env, url.searchParams.get("since"));
        out.orders = ow.waiting; out.placed = ow.placed; out.lines = ow.lines || [];
        /* v760: and the last thing a customer DID, while it is fresh. The banner is built from this
           summary and from nothing else, so without it a wake sent because somebody paid reads as
           "an order waiting", which is the wrong sentence about the right order. */
        try {
          const nw = await env.SALT_QUEUE.get("orders:news", "json");
          if (nw && nw.what && Date.now() - Date.parse(nw.at) < 10 * 60 * 1000) out.news = nw.what;
        } catch (e) { /* a banner is not worth an error path */ }
      } catch (e) { out.warn = String((e && e.message) || e); }
      return json(out);
    }
    if (p === "/push/send") {
      if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
      let b = {};
      try { b = await request.json(); } catch { /* a bare POST is fine: it is a wake, not a message */ }
      return json(await sendPush(env, { tag: (b && b.tag) || "salt", urgency: (b && b.urgency) || "normal" }));
    }
    if (p === "/push/subscribers") {
      return json({ ok: true, count: (await listSubs(env)).length });
    }

    if (p === "/draft-now") {
      if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
      if (!writeOk(request, env)) return needsKey();
      try {
        if (url.searchParams.get("dry") === "1") return json(await dryRunDrafter(env));
        const r = await runDrafter(env);
        await afterApproval(env, ctx, r.approved);   /* S11: a row his yes approved sets going what any approval does */
        return json(r);
      } catch (e) {
        return json({ ok: false, error: String((e && e.message) || e) }, 500);
      }
    }
    if (p === "/vault/pair") {
      if (!env.SALT_WRITE_KEY) return json({ ok: false, error: "A configured write key is required for the vault pair." }, 503);
      if (!writeOk(request, env)) return needsKey();
      return m === "POST" ? vaultWriteResponse(env, () => handleVaultPair(request, env, m)) : handleVaultPair(request, env, m);
    }
    const vaultInput = /^\/vault\/inputs\/(add-id|amend-id|place)$/.exec(p);
    if (vaultInput) {
      if (!env.SALT_WRITE_KEY) return json({ ok: false, error: "A configured write key is required for vault inputs." }, 503);
      if (!writeOk(request, env)) return needsKey();
      if (env.VAULT_STORE !== "pair") return json({ ok: false, error: "The versioned vault is not enabled." }, 503);
      if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
      const text = await request.text();
      if (text.length > 1048576) return json({ ok: false, error: "request is too large" }, 413);
      let body;
      try { body = JSON.parse(text); } catch { return json({ ok: false, error: "Send JSON." }, 400); }
      return vaultWriteResponse(env, () => handleVaultInput(env, vaultInput[1], body));
    }
    if (p === "/vault") {
      if (m === "GET") return handleVaultGet(env);               // ciphertext only
      if (m === "POST") {
        if (!writeOk(request, env)) return needsKey();
        return vaultWriteResponse(env, () => handleVaultPost(request, env));
      }
      return json({ ok: false }, 405);
    }
    if (p === "/vault/addr") return m === "POST" ? vaultWriteResponse(env, () => handleVaultAddr(request, env, m))
      : handleVaultAddr(request, env, m);
    if (p === "/vault/key") return handleVaultKey(env, m);              // F13: the slip key, sealed, keyed, never written here
    /* F13: A PAYMENT SLIP, relayed as the site filed it: ciphertext the desk opens with the slip key its unlock holds */
    const sl = /^\/slips\/([^/]+)\/([^/]+)$/.exec(p);
    if (sl) {
      if (m !== "GET") return json({ ok: false, error: "method not allowed" }, 405);
      const r = await slipRelay(env, decodeURIComponent(sl[1]), decodeURIComponent(sl[2]));
      return json(r, r.ok ? 200 : (r.status || 502));
    }
    if (p === "/geo/expand") {                                          // F14: a short Maps link, one redirect, nothing kept
      if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
      return handleGeoExpand(request);
    }
    if (p === "/bio") {
      if (m === "GET") return json({ ok: true, bio: {} });       // plaintext directory never ships
      if (m === "POST") return json({ ok: true });               // dropped
      return json({ ok: false }, 405);
    }
    // The reseller menu needs the LAN signing secret; it stays a laptop-only feature.
    if (p === "/menu/publish" || p === "/menu/mint" || p === "/qr") {
      return json({ ok: false, error: "the reseller menu is laptop-only" }, 501);
    }

    /* ============ THE RETIRED STATEMENT ROUTE, AND WHY IT IS A HANDLER AND NOT A DELETION ====
     *
     * DELETING A ROUTE ON THIS WORKER DOES NOT CLOSE IT. Every unmatched GET falls to the SPA
     * fallback below, which serves the desk. So when /s/<CODE> was removed on 03 Sep 2026 and the
     * statements moved to their own site, that path did not start answering 404: it started
     * answering with the WHOLE PUBLIC LEDGER, at REQUIRE_ACCESS "0", with no sign-in. Thirty-seven
     * September statements were already in customers' hands printing
     * "https://salt-command.qyts8mh72kyg.workers.dev/s/<CODE>" under the words "Scan to open this
     * statement", so every one of those QR codes led to every other customer's code and balance,
     * every cost and margin, the P&L and the sourcing plan. Found by audit on 04 Sep, closed here.
     *
     * The suite's guard on the removal read the SOURCE TEXT of this file for the deleted route, so
     * it went green BECAUSE the route was gone and could not see what replaced it. That assertion
     * is now a fetch; see "the retired route is a dead end" in test/verify.mjs.
     *
     * 410, NOT A REDIRECT, AND THE COPY NAMES NO ADDRESS. A redirect would hand the statements
     * site's address to anyone who scanned an old code off a photographed sheet, which is the one
     * thing moving the statements off this Worker was meant to prevent. A reader who gets here is
     * told the sheet is out of date and to ask for a current one, and nothing else. */
    if (p === "/s" || p.startsWith("/s/")) {
      const gone = '<!doctype html><html lang="en"><meta charset="utf-8">'
        + '<meta name="viewport" content="width=device-width,initial-scale=1">'
        + '<meta name="robots" content="noindex,nofollow,noarchive">'
        + "<title>This statement link has expired</title>"
        + '<body style="margin:0;min-height:100vh;display:grid;place-items:center;'
        + 'background:#05080a;color:#f2f4f5;font:15px/1.7 system-ui,sans-serif">'
        + '<div style="max-width:26em;padding:2em;text-align:center">'
        + '<h1 style="font-size:1.1em;margin:0 0 .6em;color:#c5a059">This statement link has expired</h1>'
        + '<p style="color:#a6afb5;margin:0">The sheet you scanned is out of date. Please ask for a '
        + "current statement, which carries a new code and a username.</p>"
        + "</div></body></html>";
      const html = (m === "GET" || m === "HEAD");
      return new Response(html ? gone : JSON.stringify({ ok: false, error: "gone" }), {
        status: 410,
        headers: {
          "content-type": html ? "text/html; charset=utf-8" : "application/json; charset=utf-8",
          "cache-control": "no-store",
          "x-robots-tag": "noindex, nofollow, noarchive",
          "referrer-policy": "no-referrer",
          "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
        }
      });
    }

    // --- static assets, with SPA fallback the Worker owns ------------------------
    if (m === "GET" || m === "HEAD") {
      const res = await env.ASSETS.fetch(request);
      if (res.status === 404) {
        /* v387: THE FALLBACK NAMES THE DESK RATHER THAN THE ROOT. It used to re-fetch "/",
           which resolved through the asset store to index.html; that file is retired, so the
           fallback would have 404'd and an old /app bookmark with it. There is one surface
           and this is where every unknown path lands on it. */
        return env.ASSETS.fetch(new Request(new URL("/desk.html", url), request));
      }
      return res;
    }
    return json({ ok: false, error: "not found" }, 404);
  }
};
