import { allOrders, deskMove, placeOrder, customerView, RID_RE, onBook } from "./orders.js";
import { accountRecord } from "./testfix.js";
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
    || path === "/_internal/maker/inputs/stock-count" && method === "POST"
    || /^\/_internal\/maker\/inputs\/(sale|purchase|tier-set|loan|repay|gift|redeem|add-id|amend-id|place|ledger-amend)$/.test(path) && method === "POST"
    || /^\/_internal\/maker\/drafts\/[^/]+\/(approve|reject)$/.test(path) && method === "POST"
    || /^\/_internal\/maker\/orders\/[0-9]{14}-[a-z0-9]{1,8}\/(preview|accept|handed|cash|received|again)$/.test(path) && method === "POST";
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
  if (path === "/all/maker/inputs/stock-count") return { kind: "stock-count" };
  const input = /^\/all\/maker\/inputs\/(sale|purchase|tier-set|loan|repay|gift|redeem|add-id|amend-id|place|ledger-amend)$/.exec(path);
  if (input) return { kind: "input", input: input[1] };
  const customer = /^\/all\/maker\/customers\/([a-z0-9]{4}-[a-z0-9]{4})\/orders$/.exec(path);
  if (customer) return { kind: "place", u: customer[1] };
  if (/^\/all\/maker\/drafts$/.test(path)) return { kind: "drafts" };
  const dm = /^\/all\/maker\/drafts\/([^/]+)\/(approve|reject)$/.exec(path);
  if (dm) return { kind: "draft-decision", id: dm[1], decision: dm[2] };
  const om = /^\/all\/maker\/orders\/([0-9]{14}-[a-z0-9]{1,8})\/(preview|accept|handed|cash|received|again)$/.exec(path);
  if (om) return { kind: "order-action", id: om[1], action: om[2] };
  const mm = /^\/all\/maker\/orders\/([0-9]{14}-[a-z0-9]{1,8})\/move$/.exec(path);
  if (mm) return { kind: "order-move", id: mm[1] };
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
    if (op.kind === "geo-expand") {
      if (method !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
      const parsed = await bodyOf(request);
      if (parsed.error) return json({ ok: false, error: parsed.error }, parsed.status);
      if (Object.keys(parsed.body).length !== 1 || typeof parsed.body.url !== "string")
        return json({ ok: false, error: "Send only the short map link." }, 400);
      return json(await deskCall(env, "/_internal/maker/geo/expand", "POST", parsed.body));
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
      return json(await deskCall(env, "/_internal/maker/orders/" + op.id + "/" + op.action, "POST", parsed.body));
    }
    if (op.kind === "order-move") {
      if (method !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
      const parsed = await bodyOf(request);
      if (parsed.error) return json({ ok: false, error: parsed.error }, parsed.status);
      const body = parsed.body;
      if (Object.keys(body).some((key) => key !== "status") || !["ready", "declined"].includes(body.status))
        return json({ ok: false, error: "Choose Ready or Decline." }, 400);
      const order = (await allOrders(env, true)).find((item) => item.id === op.id);
      if (!order) return json({ ok: false, error: "order not found" }, 404);
      if (body.status === "ready" && order.status !== "acknowledged")
        return json({ ok: false, error: "Only an acknowledged order can be marked ready." }, 409);
      const result = await deskMove(env, order.u, order.id, { status: body.status });
      if (!result.order) return json({ ok: false, error: result.error || "order could not be moved" }, result.status || 409);
      return json({ ok: true, order: result.order });
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
