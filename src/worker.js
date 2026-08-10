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
 * AUTHENTICATION, AS AT 11 AUG 2026: THERE IS NONE, BY DECISION. Cloudflare Access was
 * removed and REQUIRE_ACCESS is "0" on the owner's instruction ("I want no zero trust
 * requirements right now"), so accessOk() below returns true unconditionally and every
 * path serves, read and write alike. That means POST /queue accepts an unauthenticated
 * body from anyone, and the daily run folds it into the real ledger. See CLAUDE.md,
 * "Access, and why it is off", before changing REQUIRE_ACCESS back: doing so WITHOUT
 * first recreating the Access application locks the owner out of his own desk, because
 * nothing would be issuing the header this then demands.
 */

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

async function readQueuePost(request) {
  const body = await request.json();
  if (!body || typeof body !== "object") throw new Error("expected an object");
  if (!Array.isArray(body.queue)) throw new Error("expected {queue:[...]}");
  if (body.queue.length > 5000) throw new Error("queue too large");
  let device = typeof body.device === "string" && DEVICE_RE.test(body.device) ? body.device : "anon";
  return { device, updated: body.updated || null, queue: body.queue };
}

async function handleQueuePost(request, env) {
  if (!env.SALT_QUEUE) return json({ ok: false, error: "no KV binding" }, 500);
  if (!accessOk(request, env)) return json({ ok: false, error: "not authenticated" }, 401);
  let payload;
  try { payload = await readQueuePost(request); }
  catch (e) { return json({ ok: false, error: String(e && e.message || e) }, 400); }
  // Per-device replace: this device's key holds its whole current queue, so an undo on
  // the device (which re-posts the shortened queue) is reflected rather than merged away.
  await env.SALT_QUEUE.put(QKEY(payload.device), JSON.stringify({
    updated: payload.updated, device: payload.device, queue: payload.queue
  }));
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = (url.pathname.replace(/\/+$/, "") || "/");
    const m = request.method;

    /* Fail closed. With REQUIRE_ACCESS on, a request that did not pass Cloudflare
     * Access gets nothing: not the ledger, not the queue, not the build id. Access
     * being off at the dashboard must read as an outage, never as an open desk.
     * The API paths answer JSON so the desk's ping-fail path degrades cleanly. */
    if (!accessOk(request, env)) {
      if (p === "/queue" || p === "/queue/ping" || p === "/vault" || p === "/bio" || p === "/bye" || p === "/rev")
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
      if (m === "POST") return handleQueuePost(request, env);
      if (m === "GET") return handleQueueGet(env);
      return json({ ok: false, error: "method not allowed" }, 405);
    }
    if (p === "/bye") return json({ ok: true });            // no server to stop; answer so the beacon is quiet

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
