import { allOrders, deskSeen, placeOrder, customerView, RID_RE, onBook } from "./orders.js";
import { accountRecord, exampleAccount, isTest, isExample, EXAMPLE_ID, TEST_USERS } from "./testfix.js";
import { hoursStatus, validateManualHours, validateWeeklyHours } from "./hours.js";

const HOURS_KEY = "maker:hours";
const OWNER_EMAIL = "maakmal97@icloud.com";
const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-robots-tag": "noindex, nofollow, noarchive"
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: HEADERS });

const allowedOwner = (identity) =>
  !!identity && typeof identity.email === "string" && identity.email.trim().toLowerCase() === OWNER_EMAIL;

/* his order controls, the same shape the Desk's makerOrderFault holds, checked here too because an example order never
   reaches the Desk's route */
function orderMoveFault(action, body) {
  const fields = action === "notfound" ? ["rid", "claim", "amount"] : ["rid", "status", "note", "message", "noReply"];
  if (Object.keys(body).some((key) => !fields.includes(key))) return "Unsupported order action fields.";
  if (!RID_RE.test(String(body.rid || ""))) return "Send the action's immutable request id.";
  if (action === "notfound")
    return typeof body.claim === "string" && Number.isFinite(Date.parse(body.claim))
      && typeof body.amount === "number" && Number.isFinite(body.amount) && body.amount > 0 ? "" : "Name the claim and its amount.";
  const kinds = ["status", "message", "noReply"].filter((key) => body[key] !== undefined).length;
  if (kinds !== 1) return "Send one move: a status, a reply, or No reply needed.";
  if (body.status !== undefined && !["ready", "declined", "cancelled"].includes(body.status)) return "Choose Ready, Decline or Cancel.";
  if (body.message !== undefined && (typeof body.message !== "string" || !body.message.trim() || body.message.length > 200))
    return "A reply is 1 to 200 characters.";
  if (body.noReply !== undefined && body.noReply !== true) return "No reply needed is true or absent.";
  if (body.note !== undefined && (!["declined", "cancelled"].includes(body.status)
    || typeof body.note !== "string" || !body.note.trim() || body.note.length > 140))
    return "A reason goes only with Decline or Cancel, up to 140 characters.";
  return "";
}

/* whether a request the order book kept under this id is the move now asked for */
function sameMove(action, body, kept) {
  if (!kept || typeof kept !== "object") return false;
  if (action === "notfound") return !!kept.verdict && kept.verdict.kind === "notfound" && kept.verdict.claim === body.claim
    && Math.abs(+kept.verdict.amount - body.amount) <= 0.004 && Object.keys(kept).length === 1;
  const keys = ["status", "note", "message", "noReply"];
  /* the Desk adds `maker` to a status move; it is the Desk's own, never the owner's content */
  return Object.keys(kept).every((key) => keys.includes(key) || key === "maker") && keys.every((key) => kept[key] === body[key]);
}

async function bodyOf(request) {
  const text = await request.text();
  if (text.length > 1048576) return { error: "request is too large", status: 413 };
  try {
    const body = JSON.parse(text);
    return body && typeof body === "object" && !Array.isArray(body) ? { body } : { error: "send a JSON object", status: 400 };
  } catch (e) { return { error: "send JSON", status: 400 }; }
}

async function deskCall(env, path, method, body) {
  const secret = String(env.COUNTER_MAKER_KEY || "");
  if (secret.length < 32 || !env.DESK_MAKER) throw new Error("The private Desk maker bridge is not configured.");
  const allowed = path === "/_internal/maker/drafts" && method === "GET"
    || path === "/_internal/maker/inputs" && method === "GET"
    || path === "/_internal/maker/vault" && method === "GET"
    || path === "/_internal/maker/vault/addr" && method === "GET"
    || path === "/_internal/maker/vault/pair" && method === "GET"
    || path === "/_internal/maker/geo/expand" && method === "POST"
    || path === "/_internal/maker/threads" && method === "GET"
    || path === "/_internal/maker/bulletin" && ["GET", "POST"].includes(method)
    || path === "/_internal/maker/claims" && method === "GET"
    || path === "/_internal/maker/vault/key" && method === "GET"
    || /^\/_internal\/maker\/slips\/[a-z0-9]{4}-[a-z0-9]{4}\/[0-9a-f]{32}$/.test(path) && method === "GET"
    || /^\/_internal\/maker\/claims\/[a-z0-9]{4}-[a-z0-9]{4}\/a[0-9]{14}-[a-z0-9]{1,8}\/(preview|received|notfound)$/.test(path) && method === "POST"
    || /^\/_internal\/maker\/fixture-claims\/0000-000[01]\/a[0-9]{14}-[a-z0-9]{1,8}\/preview$/.test(path) && method === "POST"
    || /^\/_internal\/maker\/threads\/[a-z0-9]{4}-[a-z0-9]{4}$/.test(path) && method === "POST"
    || path === "/_internal/maker/offsets" && method === "GET"
    || path === "/_internal/maker/inputs/offset" && method === "POST"
    || path === "/_internal/maker/inputs/stock-count" && method === "POST"
    || /^\/_internal\/maker\/inputs\/(sale|purchase|tier-set|tier-accept-all|house-sizes|loan|repay|gift|redeem|add-id|amend-id|place|ledger-amend)$/.test(path) && method === "POST"
    || /^\/_internal\/maker\/drafts\/[^/]+\/(approve|reject)$/.test(path) && method === "POST"
    || /^\/_internal\/maker\/orders\/[0-9]{14}-[a-z0-9]{1,8}\/(preview|accept|handed|cash|received|again|notfound|move)$/.test(path) && method === "POST"
    || (path === "/_internal/maker/order-again" || path === "/_internal/maker/words") && method === "POST";
  if (!allowed) throw new Error("That Desk maker operation is not available.");
  const response = await env.DESK_MAKER.fetch(new Request("https://desk" + path, {
    method,
    headers: {
      "X-Counter-Maker-Key": secret,
      ...(body === undefined ? {} : { "content-type": "application/json" })
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  }));
  let result;
  try { result = await response.json(); } catch (e) { throw new Error("The Desk maker route returned an unreadable response."); }
  if (!response.ok || !result || result.ok !== true)
    throw Object.assign(new Error(result && result.error || "The Desk maker operation failed."),
      { status: response.ok ? 502 : response.status, twin: result && result.twin, queuedTwin: result && result.queuedTwin });
  return result;
}

export async function customerAmend(env, u, id, body) {
  if (!onBook(env)) return { error: "Atomic order storage is unavailable.", code: "amendStore", status: 503 };
  const secret = String(env.COUNTER_MAKER_KEY || "");
  if (!env.DESK_MAKER || secret.length < 32)
    return { error: "The private Desk maker bridge is not configured.", code: "amendBridge", status: 503 };
  const fields = ["product", "qty", "mode", "place", "forFriend", "rid", "week", "digest", "wantBy"];
  if (!/^[0-9]{14}-[a-z0-9]{1,8}$/.test(id) || !body || typeof body !== "object" || Array.isArray(body)
    || Object.keys(body).some((key) => !fields.includes(key)))
    return { error: "Send only the replacement order fields.", code: "amendShape", status: 400 };
  const response = await env.DESK_MAKER.fetch(new Request("https://desk/_internal/maker/orders/" + id + "/amend", {
    method: "POST", headers: { "X-Counter-Maker-Key": secret, "content-type": "application/json" },
    body: JSON.stringify(Object.assign({}, body, { u }))
  }));
  const result = await response.json();
  return response.ok && result.ok ? { order: result.order }
    : { ...result, error: result.error || "The amendment could not be recorded.",
      code: result.code || (response.status === 409 ? "amendClosed" : response.status === 400 ? "amendShape"
        : response.status === 404 ? "noOrder" : "amendBridge"), status: response.status };
}

async function readHours(env) {
  const value = await env.STMT.get(HOURS_KEY, "json");
  if (!value) return { config: null, status: hoursStatus(null) };
  if (value.schedule != null) {
    const schedule = validateWeeklyHours(value.schedule);
    if (schedule.error) throw new TypeError("Stored operating hours are invalid: " + schedule.error);
  }
  return { config: value, status: hoursStatus(value) };
}

async function makerHours(request, env, method) {
  if (!env.STMT) return json({ ok: false, error: "no Counter store" }, 503);
  if (method === "GET") {
    const result = await readHours(env);
    return json({ ok: true, config: result.config, status: result.status });
  }
  if (method !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
  const parsed = await bodyOf(request);
  if (parsed.error) return json({ ok: false, error: parsed.error }, parsed.status);
  const current = await readHours(env);
  const body = parsed.body;
  if (body.clearManual === true && Object.keys(body).length === 1) {
    const next = Object.assign({}, current.config || {});
    delete next.manual;
    await env.STMT.put(HOURS_KEY, JSON.stringify(next));
    return json({ ok: true, config: next, status: hoursStatus(next) });
  }
  if (Object.keys(body).length === 1 && body.manual && typeof body.manual === "object") {
    const manual = validateManualHours(body.manual);
    if (manual.error) return json({ ok: false, error: manual.error }, 400);
    const next = Object.assign({}, current.config || {}, { manual });
    await env.STMT.put(HOURS_KEY, JSON.stringify(next));
    return json({ ok: true, config: next, status: hoursStatus(next) });
  }
  if (Object.keys(body).length === 1 && body.schedule) {
    const schedule = validateWeeklyHours(body.schedule);
    if (schedule.error) return json({ ok: false, error: schedule.error }, 400);
    const next = Object.assign({}, current.config || {}, {
      schedule: { days: schedule.days.map((day) => day && { open: day.open, close: day.close }) }
    });
    await env.STMT.put(HOURS_KEY, JSON.stringify(next));
    return json({ ok: true, config: next, status: hoursStatus(next) });
  }
  return json({ ok: false, error: "Set a weekly schedule, a temporary open/closed override, or clear the override." }, 400);
}

function internalOperation(path) {
  if (path === "/all/maker/review") return { kind: "review" };
  if (path === "/all/maker/hours") return { kind: "hours" };
  if (path === "/all/maker/inputs") return { kind: "inputs" };
  if (path === "/all/maker/vault") return { kind: "vault" };
  if (path === "/all/maker/vault/addr") return { kind: "vault-addr" };
  if (path === "/all/maker/vault/pair") return { kind: "vault-pair" };
  if (path === "/all/maker/geo/expand") return { kind: "geo-expand" };
  if (path === "/all/maker/threads") return { kind: "threads" };
  if (path === "/all/maker/bulletin") return { kind: "bulletin" };
  if (path === "/all/maker/claims") return { kind: "claims" };
  if (path === "/all/maker/vault/key") return { kind: "slip-key" };
  const slip = /^\/all\/maker\/slips\/([a-z0-9]{4}-[a-z0-9]{4})\/([0-9a-f]{32})$/.exec(path);
  if (slip) return { kind: "slip", u: slip[1], id: slip[2] };
  const claim = /^\/all\/maker\/claims\/([a-z0-9]{4}-[a-z0-9]{4})\/(a[0-9]{14}-[a-z0-9]{1,8})\/(preview|received|notfound)$/.exec(path);
  if (claim) return { kind: "claim", u: claim[1], id: claim[2], action: claim[3] };
  const thread = /^\/all\/maker\/threads\/([a-z0-9]{4}-[a-z0-9]{4})$/.exec(path);
  if (thread) return { kind: "thread", u: thread[1] };
  if (path === "/all/maker/offsets") return { kind: "offsets" };
  if (path === "/all/maker/inputs/offset") return { kind: "input", input: "offset" };
  if (path === "/all/maker/inputs/stock-count") return { kind: "stock-count" };
  const input = /^\/all\/maker\/inputs\/(sale|purchase|tier-set|tier-accept-all|house-sizes|loan|repay|gift|redeem|add-id|amend-id|place|ledger-amend)$/.exec(path);
  if (input) return { kind: "input", input: input[1] };
  const customer = /^\/all\/maker\/customers\/([a-z0-9]{4}-[a-z0-9]{4})\/orders$/.exec(path);
  if (customer) return { kind: "place", u: customer[1] };
  if (/^\/all\/maker\/drafts$/.test(path)) return { kind: "drafts" };
  const dm = /^\/all\/maker\/drafts\/([^/]+)\/(approve|reject)$/.exec(path);
  if (dm) return { kind: "draft-decision", id: dm[1], decision: dm[2] };
  const om = /^\/all\/maker\/orders\/([0-9]{14}-[a-z0-9]{1,8})\/(preview|accept|handed|cash|received|again)$/.exec(path);
  if (om) return { kind: "order-action", id: om[1], action: om[2] };
  const mm = /^\/all\/maker\/orders\/([0-9]{14}-[a-z0-9]{1,8})\/(move|notfound)$/.exec(path);
  if (mm) return { kind: "order-move", id: mm[1], action: mm[2] };
  return null;
}

export async function handleMaker(request, env, pathname, verifiedIdentity) {
  if (!allowedOwner(verifiedIdentity)) return json({ ok: false, error: "Admin access required" }, 403);
  if (!pathname.startsWith("/all/maker/")) return json({ ok: false, error: "not found" }, 404);
  const op = internalOperation(pathname);
  if (!op) return json({ ok: false, error: "not found" }, 404);
  const method = request.method;
  try {
    if (op.kind === "hours") return await makerHours(request, env, method);
    if (op.kind === "slip" || op.kind === "slip-key" || op.kind === "claims") {
      if (method !== "GET") return json({ ok: false, error: "method not allowed" }, 405);
      if (op.kind === "slip-key") return json(await deskCall(env, "/_internal/maker/vault/key", "GET"));
      if (op.kind === "slip") return json(await deskCall(env, "/_internal/maker/slips/" + op.u + "/" + op.id, "GET"));
      const result = await deskCall(env, "/_internal/maker/claims", "GET");
      if (!Array.isArray(result.claims)) return json({ ok: false, error: "The Desk claim list was unreadable." }, 502);
      for (const u of TEST_USERS) {
        const fixture = await exampleAccount(env, u);
        if (!fixture.ok) {
          if (fixture.status === 409) continue;
          return json(fixture, fixture.status || 503);
        }
        result.claims.push(...fixture.account.claims.map((claim) => ({ ...claim, test: true })));
      }
      return json(result);
    }
    if (op.kind === "claim") {
      if (method !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
      const parsed = await bodyOf(request);
      if (parsed.error) return json({ ok: false, error: parsed.error }, parsed.status);
      const body = parsed.body;
      const fields = op.action === "preview" ? [] : op.action === "received" ? ["hash", "covered", "rid"] : ["amount", "rid"];
      if (Object.keys(body).some((key) => !fields.includes(key))
        || op.action !== "preview" && (!RID_RE.test(String(body.rid || ""))
          || op.action === "received" && (typeof body.hash !== "string"
            || body.covered !== undefined && typeof body.covered !== "boolean")
          || op.action === "notfound" && (typeof body.amount !== "number" || !Number.isFinite(body.amount))))
        return json({ ok: false, error: "Send the claim preview and its immutable action id." }, 400);
      if (!isTest(op.u)) return json(await deskCall(env,
        "/_internal/maker/claims/" + op.u + "/" + op.id + "/" + op.action, "POST", body));
      const intention = { id: op.id, action: op.action, body };
      if (op.action !== "preview") {
        const receipt = await exampleAccount(env, op.u, { actor: "receipt", rid: body.rid, request: intention });
        if (!receipt.ok) return json(receipt, receipt.status || 503);
        if (receipt.found) return json({ ok: true, claim: receipt.claim, again: true, test: true });
      }
      const snapshot = await exampleAccount(env, op.u);
      if (!snapshot.ok) return json(snapshot, snapshot.status || 503);
      const preview = await deskCall(env, "/_internal/maker/fixture-claims/" + op.u + "/" + op.id + "/preview",
        "POST", snapshot);
      if (!preview.claim || !Number.isFinite(preview.claim.amount) || !Number.isFinite(preview.left)
        || typeof preview.hash !== "string" || !Array.isArray(preview.rows))
        return json({ ok: false, error: "The Desk claim preview was unreadable." }, 502);
      if (op.action === "preview") return json(preview);
      if (op.action === "notfound" && Math.abs(body.amount - preview.claim.amount) > 0.004)
        return json({ ok: false, error: "That claim amount has changed." }, 409);
      if (op.action === "received" && body.hash !== preview.hash)
        return json({ ok: false, error: "The acceptance rows changed. Preview them again.", differs: true }, 409);
      if (op.action === "received" && (body.covered ? preview.left <= 0.004 : preview.left > 0.004))
        return json({ ok: false, error: body.covered ? "Their rows owe all of it." : "Part of this claim exceeds what the rows owe." }, 409);
      const result = await exampleAccount(env, op.u, { actor: "desk", id: op.id,
        rid: body.rid, request: intention, revision: preview.revision, expectedGeneration: preview.generation, rows: preview.rows,
        body: { verdict: { kind: op.action === "received" ? "received" : "notfound",
          amount: preview.claim.amount, ...(body.covered ? { covered: true } : {}) } } });
      return json(result.ok ? { ok: true, claim: result.claim, test: true } : result, result.ok ? 200 : result.status || 503);
    }
    if (op.kind === "threads" || op.kind === "thread" || op.kind === "bulletin") {
      const read = method === "GET" && op.kind !== "thread";
      if (!read && !(method === "POST" && op.kind !== "threads"))
        return json({ ok: false, error: "method not allowed" }, 405);
      const parsed = read ? {} : await bodyOf(request);
      if (parsed.error) return json({ ok: false, error: parsed.error }, parsed.status);
      const route = op.kind === "bulletin" ? "/bulletin" : "/threads" + (op.u ? "/" + op.u : "");
      return json(await deskCall(env, "/_internal/maker" + route, method, parsed.body));
    }
    if (op.kind === "geo-expand") {
      if (method !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
      const parsed = await bodyOf(request);
      if (parsed.error) return json({ ok: false, error: parsed.error }, parsed.status);
      if (Object.keys(parsed.body).length !== 1 || typeof parsed.body.url !== "string")
        return json({ ok: false, error: "Send only the short map link." }, 400);
      return json(await deskCall(env, "/_internal/maker/geo/expand", "POST", parsed.body));
    }
    if (op.kind === "offsets") {
      if (method !== "GET") return json({ ok: false, error: "method not allowed" }, 405);
      return json(await deskCall(env, "/_internal/maker/offsets", "GET"));
    }
    if (op.kind === "inputs") {
      if (method !== "GET") return json({ ok: false, error: "method not allowed" }, 405);
      return json(await deskCall(env, "/_internal/maker/inputs", "GET"));
    }
    if (op.kind === "vault" || op.kind === "vault-addr" || op.kind === "vault-pair") {
      if (method !== "GET") return json({ ok: false, error: "method not allowed" }, 405);
      return json(await deskCall(env, "/_internal/maker/vault" + (op.kind === "vault-addr" ? "/addr" : op.kind === "vault-pair" ? "/pair" : ""), "GET"));
    }
    if (op.kind === "stock-count" || op.kind === "input") {
      if (method !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
      const parsed = await bodyOf(request);
      if (parsed.error) return json({ ok: false, error: parsed.error }, parsed.status);
      return json(await deskCall(env, "/_internal/maker/inputs/" + (op.input || "stock-count"), "POST", parsed.body));
    }
    if (op.kind === "place") {
      if (method !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
      const parsed = await bodyOf(request);
      if (parsed.error) return json({ ok: false, error: parsed.error }, parsed.status);
      const body = parsed.body;
      const fields = ["product", "qty", "mode", "unit", "total", "place", "forFriend", "rid", "week", "digest", "wantBy"];
      if (Object.keys(body).some((key) => !fields.includes(key)) || !RID_RE.test(String(body.rid || ""))
        || typeof body.digest !== "string" || typeof body.forFriend !== "boolean")
        return json({ ok: false, error: "Send a quoted order and its request id, without private fields." }, 400);
      if (!env.STMT) return json({ ok: false, error: "no Counter store" }, 503);
      const account = await accountRecord(env, op.u);
      if (!account) return json({ ok: false, error: "account not found" }, 404);
      const result = await placeOrder(env, op.u, body, "desk");
      if (!result.order) return json({ ok: false, ...result }, result.status || 400);
      return json({ ok: true, order: customerView(result.order) });
    }
    if (op.kind === "review") {
      if (method !== "GET") return json({ ok: false, error: "method not allowed" }, 405);
      if (!env.STMT) return json({ ok: false, error: "no Counter store" }, 503);
      const [orders, drafts] = await Promise.all([allOrders(env, true), deskCall(env, "/_internal/maker/drafts", "GET")]);
      /* a move he rejected under Approve, offered again from here: the Desk's own againOf names the stages */
      const ids = orders.filter((o) => !["declined", "cancelled"].includes(o.status)).map((o) => o.id).slice(0, 200);
      const again = ids.length ? (await deskCall(env, "/_internal/maker/order-again", "POST", { ids })).again || {} : {};
      for (const o of orders) if (Array.isArray(again[o.id]) && again[o.id].length) o.again = again[o.id];
      /* the acceptance accounts' orders, from their serialized fixture alone, marked so no real road is offered */
      for (const u of TEST_USERS) {
        const fixture = await exampleAccount(env, u);
        if (!fixture.ok) {
          if (fixture.status === 409) continue;
          return json(fixture, fixture.status || 503);
        }
        orders.push(...fixture.orders.map((o) => ({ ...o, u: o.u || u, test: true })));
      }
      return json({ ok: true, orders, drafts: drafts.drafts || [], refused: drafts.refused || [] });
    }
    if (op.kind === "drafts") {
      if (method !== "GET") return json({ ok: false, error: "method not allowed" }, 405);
      return json(await deskCall(env, "/_internal/maker/drafts", "GET"));
    }
    if (op.kind === "draft-decision") {
      if (method !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
      const parsed = await bodyOf(request);
      if (parsed.error) return json({ ok: false, error: parsed.error }, parsed.status);
      if (Object.keys(parsed.body).length) return json({ ok: false, error: "Draft decisions take an empty object." }, 400);
      const id = decodeURIComponent(op.id);
      if (!Number.isFinite(Date.parse(id)) || new Date(id).toISOString() !== id)
        return json({ ok: false, error: "Invalid draft timestamp." }, 400);
      const safeId = encodeURIComponent(id);
      return json(await deskCall(env, "/_internal/maker/drafts/" + safeId + "/" + op.decision, "POST", {}));
    }
    if (op.kind === "order-action") {
      if (method !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
      const parsed = await bodyOf(request);
      if (parsed.error) return json({ ok: false, error: parsed.error }, parsed.status);
      if (EXAMPLE_ID.test(op.id))
        return json({ ok: false, error: "Not available on an example order." }, 409);
      return json(await deskCall(env, "/_internal/maker/orders/" + op.id + "/" + op.action, "POST", parsed.body));
    }
    if (op.kind === "order-move") {
      if (method !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
      const parsed = await bodyOf(request);
      if (parsed.error) return json({ ok: false, error: parsed.error }, parsed.status);
      const body = parsed.body;
      const fault = orderMoveFault(op.action, body);
      if (fault) return json({ ok: false, error: fault }, 400);
      const { rid, ...rest } = body;
      if (EXAMPLE_ID.test(op.id)) {
        /* an example order moves in its account's serialized fixture alone, by the order book's own decideDesk */
        let u = null, found = null;
        for (const t of TEST_USERS) {
          const fixture = await exampleAccount(env, t);
          if (!fixture.ok) {
            if (fixture.status === 409) continue;
            return json(fixture, fixture.status || 503);
          }
          found = fixture.orders.find((o) => o.id === op.id);
          if (found) { u = t; break; }
        }
        if (!found || !isExample(u, op.id)) return json({ ok: false, error: "order not found" }, 404);
        const texts = [rest.message, rest.note].filter((text) => typeof text === "string");
        if (texts.length) await deskCall(env, "/_internal/maker/words", "POST", { texts });
        let move = rest;
        if (rest.status) move = { ...rest, maker: true };   /* the same rules as a real order's, held by the order book */
        if (op.action === "notfound") {
          const waiting = (found.payments || []).find((p) => p && p.claim === "waiting" && p.at === rest.claim);
          if (!waiting) return json({ ok: false, error: "That claim is not waiting any more." }, 409);
          if (Math.abs(waiting.amount - rest.amount) > 0.004) return json({ ok: false, error: "That claim amount has changed." }, 409);
          move = { verdict: { kind: "notfound", claim: waiting.at, amount: waiting.amount } };
        }
        const result = await exampleAccount(env, u, { actor: "deskorder", id: op.id, rid,
          request: { id: op.id, action: op.action, body: rest }, body: move });
        return json(result.ok ? { ok: true, order: result.order, test: true, ...(result.again ? { again: true } : {}) } : result,
          result.ok ? 200 : result.status || 503);
      }
      const order = (await allOrders(env, true)).find((item) => item.id === op.id);
      if (!order) return json({ ok: false, error: "order not found" }, 404);
      /* the order book keeps the request id: a retry that already landed is answered from it, other content refused */
      const seen = await deskSeen(env, order.u, op.id, rid);
      if (!seen.ok) return json({ ok: false, error: seen.error || "The order book could not be read." }, seen.status || 503);
      if (seen.seen) {
        let same = false;
        try { same = sameMove(op.action, rest, JSON.parse(seen.request)); } catch (e) { same = false; }
        return same ? json({ ok: true, order: seen.order, again: true })
          : json({ ok: false, error: "That request id already names different content." }, 409);
      }
      return json(await deskCall(env, "/_internal/maker/orders/" + op.id + "/" + op.action, "POST", body));
    }
  } catch (error) {
    const status = Number.isInteger(error && error.status) ? error.status : 503;
    return json({ ok: false, error: String(error && error.message || error) }, status);
  }
  return json({ ok: false, error: "not found" }, 404);
}

export async function publicHours(env) {
  const value = env.STMT ? await env.STMT.get(HOURS_KEY, "json") : null;
  if (!value) return hoursStatus(null);
  if (value.schedule != null) {
    const valid = validateWeeklyHours(value.schedule);
    if (valid.error) throw new TypeError("Stored operating hours are invalid: " + valid.error);
  }
  return hoursStatus(value);
}
