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
 * AUTHENTICATION, AS AT 16 AUG 2026: READS ARE OPEN, WRITES ARE GATED BY A SHARED KEY, AND
 * THE GATE IS ARMED. See writeOk() below. The key lives in the SALT_WRITE_KEY secret, which
 * is set (wrangler secret list returns it) and was verified on 16 Aug 2026 refusing an
 * unkeyed POST /queue with 401 "write key required"; the phone holds it in localStorage
 * after being asked once. Zero Trust stays off either way.
 *
 * READS, AS AT 11 AUG 2026: THERE IS NO AUTHENTICATION, BY DECISION. Cloudflare Access was
 * removed and REQUIRE_ACCESS is "0" on the owner's instruction ("I want no zero trust
 * requirements right now"), so accessOk() below returns true unconditionally and every
 * path serves. That used to mean write as well: POST /queue accepted an unauthenticated
 * body from anyone and the daily run folded it into the real ledger as real rows. The write
 * gate closes that half, so the open surface is READS ONLY as at 16 Aug 2026, which is still
 * the whole ledger to anyone with the URL. See CLAUDE.md,
 * "Access, and why it is off", before changing REQUIRE_ACCESS back: doing so WITHOUT
 * first recreating the Access application locks the owner out of his own desk, because
 * nothing would be issuing the header this then demands.
 */

import { runDrafter, dryRunDrafter } from "./drafter.js";
import { sendPush, listSubs } from "./push.js";
import { listOrders, moveOrder, saleEntry, queueSale, ordersWaiting, nudgeOrders } from "./orders.js";

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
const DEVICE_RE = /^[A-Za-z0-9._-]{1,80}$/;

// The only shape /vault will store: the desk's AES-GCM envelope. Anything else (a plain
// name map, say) is refused, so plaintext can never reach the cloud through this door.
const isEnvelope = (v) =>
  v && typeof v === "object" &&
  typeof v.salt === "string" && typeof v.iv === "string" && typeof v.ct === "string";

/* Cloudflare injects Cf-Access-Jwt-Assertion on every request that passed Access, and
 * strips any client-supplied copy. Presence is a sound signal that Access ran. Full JWT
 * verification against the team's public keys is the next hardening step; presence is
 * enough to stop the queue being writable with Access misconfigured. */
function accessOk(request, env) {
  if (String(env.REQUIRE_ACCESS || "0") !== "1") return true;
  return !!request.headers.get("Cf-Access-Jwt-Assertion");
}

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
  if (got.length !== key.length) return false;
  let diff = 0;
  for (let i = 0; i < key.length; i++) diff |= got.charCodeAt(i) ^ key.charCodeAt(i);
  return diff === 0;
}
const needsKey = () => json({ ok: false, error: "write key required", writeKey: true }, 401);

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
    if (result && result.drafted > 0) await sendPush(env, { tag: "approve", urgency: "high" });
  } catch { /* a banner is not worth an error path */ }
}

function draftOnArrival(env, ctx) {
  if (!ctx || typeof ctx.waitUntil !== "function" || !env.SALT_LEDGER) return;
  ctx.waitUntil((async () => {
    try {
      const r = await runDrafter(env);
      console.log("drafter (on arrival): " + JSON.stringify(r));
      await pushIfDrafted(env, r);
    } catch (e) {
      console.log("drafter (on arrival) FAILED, the cron will retry: " + String((e && e.stack) || e));
    }
  })());
}

async function handleQueuePost(request, env, ctx) {
  if (!env.SALT_QUEUE) return json({ ok: false, error: "no KV binding" }, 500);
  if (!accessOk(request, env)) return json({ ok: false, error: "not authenticated" }, 401);
  if (!writeOk(request, env)) return needsKey();
  let payload;
  try { payload = await readQueuePost(request); }
  catch (e) { return json({ ok: false, error: String(e && e.message || e) }, 400); }
  // Per-device replace: this device's key holds its whole current queue, so an undo on
  // the device (which re-posts the shortened queue) is reflected rather than merged away.
  await env.SALT_QUEUE.put(QKEY(payload.device), JSON.stringify({
    updated: payload.updated, device: payload.device, queue: payload.queue
  }));
  draftOnArrival(env, ctx);
  return json({ ok: true, entries: payload.queue.length, device: payload.device });
}

/* Union of every device's queue, for the drain and for eyeballing behind Access. */
async function handleQueueGet(env) {
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
        for (const entry of (v.queue || [])) out.push(entry);
      } catch (e) { /* skip a corrupt key rather than fail the whole read */ }
    }
    cursor = list.list_complete ? null : list.cursor;
  } while (cursor);
  // Dedupe by the entry's own stamp, newest wins, so two devices holding the same entry
  // (or a device that re-posted) never double it.
  const byAt = new Map();
  for (const e of out) byAt.set(e && e.at ? e.at : JSON.stringify(e), e);
  const queue = [...byAt.values()].sort((a, b) => ((a && a.at) || "") < ((b && b.at) || "") ? -1 : 1);
  return json({ ok: true, entries: queue.length, queue });
}

/* The encrypted vault. GET hands back the ciphertext so the phone can decrypt it with the
 * password; POST stores it, but only if it is the envelope shape (never plaintext). */
async function handleVaultGet(env) {
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
  } catch (e) { return json({ ok: true, vault: null }); }
}
async function handleVaultPost(request, env) {
  if (!env.SALT_QUEUE) return json({ ok: false, error: "no KV binding" }, 500);
  if (!accessOk(request, env)) return json({ ok: false, error: "not authenticated" }, 401);
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
     and without reading every approved row there has ever been. Pending view only. */
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
 * and a fold on request still works. Five taps in a row are five dispatches; the workflow's
 * concurrency group queues them and the stage's own guard stands the extras down. */
const STAGE_REPO = "maakmal97/salt-command";
function stageOnApproval(env, ctx) {
  if (!ctx || typeof ctx.waitUntil !== "function" || !env.SALT_GITHUB_TOKEN) return;
  ctx.waitUntil((async () => {
    try {
      const r = await fetch("https://api.github.com/repos/" + STAGE_REPO + "/actions/workflows/cloud-commit.yml/dispatches", {
        method: "POST",
        headers: {
          authorization: "Bearer " + env.SALT_GITHUB_TOKEN,
          accept: "application/vnd.github+json",
          "content-type": "application/json",
          "user-agent": "salt-command"
        },
        body: JSON.stringify({ ref: "master", inputs: { stage_only: "true" } })
      });
      console.log("stage dispatch: " + r.status);
    } catch (e) {
      console.log("stage dispatch FAILED, the hourly stage will catch it: " + String((e && e.message) || e));
    }
  })());
}

async function handleDraftDecide(request, env, ctx, id, decision) {
  if (!env.SALT_LEDGER) return json({ ok: false, error: "no ledger binding" }, 503);
  if (!writeOk(request, env)) return needsKey();
  let by = "phone";
  try { const b = await request.json(); if (b && typeof b.by === "string" && b.by.trim()) by = b.by.trim(); } catch (e) { /* body is optional */ }
  const cur = await env.SALT_LEDGER.prepare("SELECT status FROM draft WHERE id=?1").bind(id).first();
  if (!cur) return json({ ok: false, error: "no such draft" }, 404);
  /* Only a pending draft may be decided. Deciding twice is reported rather than applied, so a
     double tap on a phone cannot flip an approval into a rejection. */
  if (cur.status !== "pending") {
    return json({ ok: false, error: "already " + cur.status, status: cur.status }, 409);
  }
  await env.SALT_LEDGER.prepare(
    "UPDATE draft SET status=?1, decided_at=?2, decided_by=?3 WHERE id=?4 AND status='pending'"
  ).bind(decision, new Date().toISOString(), by, id).run();
  if (decision === "approved") stageOnApproval(env, ctx);
  const row = await env.SALT_LEDGER.prepare(`SELECT ${DRAFT_COLS} FROM draft WHERE id=?1`).bind(id).first();
  return json({ ok: true, draft: row ? draftOut(row) : null });
}

/* Marked by the commit run once the row is actually in the master, so an approved row is not
   offered to it twice. Only an approved draft can be committed. */
async function handleDraftCommitted(request, env, id) {
  if (!env.SALT_LEDGER) return json({ ok: false, error: "no ledger binding" }, 503);
  if (!writeOk(request, env)) return needsKey();
  const cur = await env.SALT_LEDGER.prepare("SELECT status,committed_at FROM draft WHERE id=?1").bind(id).first();
  if (!cur) return json({ ok: false, error: "no such draft" }, 404);
  if (cur.status !== "approved") return json({ ok: false, error: "only an approved draft may be committed; this one is " + cur.status }, 409);
  if (cur.committed_at) return json({ ok: true, id, alreadyCommitted: true, committedAt: cur.committed_at });
  const at = new Date().toISOString();
  /* v519: liveAt is the deploy job's proof time, sent with the mark; absent on an older caller */
  let liveAt = null;
  try { const b = await request.json(); if (b && typeof b.liveAt === "string" && !Number.isNaN(Date.parse(b.liveAt))) liveAt = b.liveAt; } catch (e) { /* no body */ }
  await env.SALT_LEDGER.prepare("UPDATE draft SET committed_at=?1, live_at=?2 WHERE id=?3 AND committed_at IS NULL").bind(at, liveAt, id).run();
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
    /* TWO SCHEDULES, AND THEY DO DIFFERENT JOBS. The quarter-hourly one is the drafter's
       safety net and pushes only when it actually wrote a row. The daily one at 01:00 UTC,
       which is 09:00 in Kuala Lumpur, is the morning nudge.
       THE NUDGE ONLY FIRES IF THERE IS SOMETHING. A banner every morning saying the book is
       square is a banner that gets swiped away unread, and then so does the one that mattered. */
    const daily = String(event && event.cron || "").startsWith("0 1 ");
    ctx.waitUntil((async () => {
      try {
        if (daily) {
          let worth = false;
          try {
            const d = await env.SALT_LEDGER.prepare("SELECT COUNT(*) AS n FROM draft WHERE status='pending'").first();
            if ((d && d.n) > 0) worth = true;
            const c = await env.SALT_LEDGER.prepare("SELECT doc FROM state WHERE key='COUNT_ON'").first();
            if (c && c.doc) {
              const on = JSON.parse(c.doc), today = new Date().toISOString().slice(0, 10);
              if (Object.keys(on).some((k) => on[k] !== today)) worth = true;
            }
          } catch (e) { console.log("nudge check failed: " + String(e)); }
          console.log("morning nudge: " + (worth ? "sending" : "nothing worth saying"));
          if (worth) await sendPush(env, { tag: "salt", urgency: "normal" });
          return;
        }
        const r = await runDrafter(env);
        console.log("drafter: " + JSON.stringify(r));
        await pushIfDrafted(env, r);
        /* a customer order placed since the last quarter-hour wakes the phone once */
        console.log("orders nudge: " + JSON.stringify(await nudgeOrders(env)));
      } catch (e) {
        console.log("scheduled FAILED: " + String((e && e.stack) || e));
      }
    })());
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const p = (url.pathname.replace(/\/+$/, "") || "/");
    const m = request.method;

    /* Fail closed. With REQUIRE_ACCESS on, a request that did not pass Cloudflare
     * Access gets nothing: not the ledger, not the queue, not the build id. Access
     * being off at the dashboard must read as an outage, never as an open desk.
     * The API paths answer JSON so the desk's ping-fail path degrades cleanly. */
    if (!accessOk(request, env)) {
      if (p === "/queue" || p === "/queue/ping" || p === "/vault" || p === "/bio" || p === "/bye"
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
     * public payload -- phonePayloadLeaks() bans every per-unit cost from data.json for
     * exactly this reason -- were being served in full to anyone with the URL.
     *
     * These three now need the same X-Salt-Key as a write. `/rev`, `/queue/ping` and the
     * static assets stay open: a build id and a liveness probe carry no trade. The site is
     * still PUBLIC in the sense the owner asked for on 11 Aug, and this is not Access coming
     * back; it is the write key covering the reads that are as sensitive as a write.
     *
     * Ordered before the routes rather than added to each handler, so a route added later
     * cannot quietly miss it. */
    if ((p === "/queue" || p === "/ledger" || p.startsWith("/ledger/")
      || p === "/drafts" || p.startsWith("/drafts/")
      || p === "/orders" || p.startsWith("/orders/") || p === "/stmt-users"
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
    if (p === "/queue") {
      if (m === "POST") return handleQueuePost(request, env, ctx);
      if (m === "GET") return handleQueueGet(env);
      return json({ ok: false, error: "method not allowed" }, 405);
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
    if (p === "/desk" || p === "/") {
      const res = await env.ASSETS.fetch(new Request(new URL("/desk.html", url), { method: "GET" }));
      if (res && res.ok) return new Response(res.body, { status: 200, headers: res.headers });
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
       Keyed like the drafts, because an order names a party and a figure. A move to "done" is
       the one that writes: a queue entry under q:orders, drafted on arrival like any other. */
    /* v507: the username-to-code map the publish writes here, for the printed board. Keyed: a
       username is the address of an account. Inverted on the desk. */
    if (p === "/stmt-users") {
      if (m !== "GET") return json({ ok: false, error: "method not allowed" }, 405);
      return json({ ok: true, users: (await env.SALT_QUEUE.get("stmt-users", "json")) || {} });
    }
    if (p === "/orders") {
      if (m !== "GET") return json({ ok: false, error: "method not allowed" }, 405);
      const r = await listOrders(env, url.searchParams.get("all") === "1");
      return json(r, r.ok ? 200 : 503);
    }
    const om = /^\/orders\/([^/]+)\/([^/]+)$/.exec(p);
    if (om) {
      if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
      let b = {};
      try { b = await request.json(); } catch { b = {}; }
      const r = await moveOrder(env, om[1], om[2], b);
      if (!r.ok) return json({ ok: false, error: r.error }, r.status || 502);
      if (b && b.status === "done") {
        if (r.order.code) {
          const e = saleEntry(r.order, r.order.code, new Date());
          await queueSale(env, e);
          draftOnArrival(env, ctx);
          r.queued = e.at;
        } else r.warn = "no desk code is mapped to " + r.order.u + ", so no sale was queued: publish the statements again, then enter the sale by hand";
      }
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
      await env.SALT_QUEUE.put("push:" + id, JSON.stringify({ endpoint: ep, at: new Date().toISOString() }));
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
      const out = { ok: true, pending: 0, refused: 0, countDue: [], now: 0 };
      try {
        if (env.SALT_LEDGER) {
          const d = await env.SALT_LEDGER.prepare("SELECT COUNT(*) AS n FROM draft WHERE status='pending'").first();
          out.pending = (d && d.n) || 0;
          const r = await env.SALT_LEDGER.prepare("SELECT COUNT(*) AS n FROM refused").first();
          out.refused = (r && r.n) || 0;
          const c = await env.SALT_LEDGER.prepare("SELECT doc FROM state WHERE key='COUNT_ON'").first();
          if (c && c.doc) {
            const on = JSON.parse(c.doc), today = new Date().toISOString().slice(0, 10);
            for (const k of Object.keys(on)) if (on[k] !== today) out.countDue.push(k);
          }
        }
        out.orders = await ordersWaiting(env);
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
        return json(await runDrafter(env));
      } catch (e) {
        return json({ ok: false, error: String((e && e.message) || e) }, 500);
      }
    }
    if (p === "/vault") {
      if (m === "GET") return handleVaultGet(env);               // ciphertext only
      if (m === "POST") return handleVaultPost(request, env);    // stores the envelope, rejects plaintext
      return json({ ok: false }, 405);
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
