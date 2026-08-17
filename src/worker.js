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
function draftOnArrival(env, ctx) {
  if (!ctx || typeof ctx.waitUntil !== "function" || !env.SALT_LEDGER) return;
  ctx.waitUntil((async () => {
    try {
      const r = await runDrafter(env);
      console.log("drafter (on arrival): " + JSON.stringify(r));
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
 * IT IS A MIRROR AND IT SAYS SO IN EVERY RESPONSE. The Cow-Crm01 master is still the source
 * of truth: the desk computes from its own arrays, the daily run still folds the queue into
 * the master, and nothing here writes. The direction flips only once the store is proven to
 * reproduce the desk's figures exactly, and until then a reader that quietly preferred this
 * endpoint would be reading a copy that can silently fall behind. `snapshot` carries the
 * desk version and the seed time so a caller can tell how far behind it is.
 *
 * There is no write path on purpose. Adding one before the proof would create exactly the
 * second source of truth this whole exercise exists to remove.
 */
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
        source: "mirror of the Cow-Crm01 master; that desk is still authoritative" });
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
const DRAFT_COLS = "id,status,collection,entry,row,reasoning,flags,party,product,date,qty,total,cost,drafter,drafted_at,decided_at,decided_by,committed_at";

function draftOut(r) {
  const parse = (s, fallback) => { try { return s == null ? fallback : JSON.parse(s); } catch (e) { return fallback; } };
  return {
    id: r.id, status: r.status, collection: r.collection,
    entry: parse(r.entry, null), row: parse(r.row, null),
    reasoning: r.reasoning, flags: parse(r.flags, []),
    party: r.party, product: r.product, date: r.date,
    qty: r.qty, total: r.total, cost: r.cost,
    drafter: r.drafter, draftedAt: r.drafted_at,
    decidedAt: r.decided_at, decidedBy: r.decided_by, committedAt: r.committed_at
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
  return json({ ok: true, count: drafts.length, drafts, refused, refusedCount: refused.length });
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

async function handleDraftDecide(request, env, id, decision) {
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
  await env.SALT_LEDGER.prepare("UPDATE draft SET committed_at=?1 WHERE id=?2 AND committed_at IS NULL").bind(at, id).run();
  return json({ ok: true, id, committedAt: at });
}

async function handleDrafts(request, env, url, p, m) {
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
  return handleDraftDecide(request, env, id, mm[2] === "approve" ? "approved" : "rejected");
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
    ctx.waitUntil((async () => {
      try {
        const r = await runDrafter(env);
        console.log("drafter: " + JSON.stringify(r));
      } catch (e) {
        console.log("drafter FAILED: " + String((e && e.stack) || e));
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

    /* THE FULL DESK, at a path (v290). The root is the phone app now; the 900 KB desk built
     * from the master stays reachable here so nothing the app has not rebuilt becomes
     * laptop-only. Served through ASSETS by its real filename, so the app keeps the root. */
    if (p === "/desk") {
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
    if (p === "/drafts" || p.startsWith("/drafts/")) return handleDrafts(request, env, url, p, m);
    /* Run the drafter on demand rather than waiting for the cron: needed to prove it from
       outside, and needed the moment an entry is queued and you want the row now. Write-gated,
       because it writes rows into `draft`. `?dry=1` reports what it would draft and stores
       nothing. */
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

    // --- static assets, with SPA fallback the Worker owns ------------------------
    if (m === "GET" || m === "HEAD") {
      const res = await env.ASSETS.fetch(request);
      if (res.status === 404) {
        return env.ASSETS.fetch(new Request(new URL("/", url), request));
      }
      return res;
    }
    return json({ ok: false, error: "not found" }, 404);
  }
};
