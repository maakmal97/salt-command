import { allOrders, deskSeen, placeOrder, customerView, RID_RE, onBook, allPools, poolOpen, poolClose, deskBody } from "./orders.js";
import { accountRecord, exampleAccount, examplePlace, examplePools, exampleThread, exampleDeskSay, isTest, isExample, EXAMPLE_ID, TEST_USERS, EXAMPLE_POINTS } from "./testfix.js";
import { POINTS_KEY, readPoints, validatePoints, resolvePoint, isPointCode } from "./points.js";
import { hoursStatus, validateManualHours, validateWeeklyHours, HOURS_KEY, windowHours } from "./hours.js";

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
  const fields = action === "notfound" ? ["rid", "claim", "amount"] : action === "restate" ? ["rid", "qty", "total", "delivery", "undo"] : ["rid", "status", "note", "message", "noReply", "mode", "point"];
  if (Object.keys(body).some((key) => !fields.includes(key))) return "Unsupported order action fields.";
  if (!RID_RE.test(String(body.rid || ""))) return "Send the action's immutable request id.";
  if (action === "restate") {
    const figs = ["qty", "total", "delivery"].filter((key) => body[key] !== undefined);
    if (!figs.length) return "Say which figure changes.";
    if (figs.some((key) => typeof body[key] !== "number" || !Number.isFinite(body[key]) || body[key] < 0 || body[key] > 1000000)) return "Order figures must be finite, non-negative numbers.";
    if (body.undo !== undefined && (!Number.isInteger(body.undo) || body.undo < 1 || figs.length !== 3)) return "An undo names its step and the figures it puts back.";
    return body.qty === 0 || body.total === 0 ? "A size and a price are above nothing." : "";
  }
  if (action === "notfound")
    return typeof body.claim === "string" && Number.isFinite(Date.parse(body.claim))
      && typeof body.amount === "number" && Number.isFinite(body.amount) && body.amount > 0 ? "" : "Name the claim and its amount.";
  /* Counter Batch A: a point alone is a fourth move, Change point; beside a status it is Ready to collect's */
  const kinds = ["status", "message", "noReply"].filter((key) => body[key] !== undefined).length + (body.point !== undefined && body.status === undefined ? 1 : 0);
  if (kinds !== 1) return "Send one move: a status, a reply, No reply needed or a collection point.";
  if (body.point !== undefined && !isPointCode(body.point)) return "A collection point is one capital letter and one or two digits.";
  if (body.point !== undefined && body.status !== undefined && !(body.status === "ready" && body.mode === "collect"))
    return "A collection point goes only with Ready to collect, or alone.";
  if (body.status === "ready" && body.mode === "collect" && body.point === undefined) return "Ready to collect names its collection point.";
  if (body.status !== undefined && !["ready", "declined", "cancelled"].includes(body.status)) return "Choose Ready, Decline or Cancel.";
  if (body.message !== undefined && (typeof body.message !== "string" || !body.message.trim() || body.message.length > 200))
    return "A reply is 1 to 200 characters.";
  if (body.noReply !== undefined && body.noReply !== true) return "No reply needed is true or absent.";
  if (body.note !== undefined && (!["declined", "cancelled"].includes(body.status)
    || typeof body.note !== "string" || !body.note.trim() || body.note.length > 140))
    return "A reason goes only with Decline or Cancel, up to 140 characters.";
  if (body.mode !== undefined && (body.status !== "ready" || !["collect", "deliver"].includes(body.mode)))
    return "Collected or delivered goes only with Ready.";
  return "";
}

/* whether a request the order book kept under this id is the move now asked for */
function sameMove(action, body, kept) {
  if (!kept || typeof kept !== "object") return false;
  if (action === "notfound") return !!kept.verdict && kept.verdict.kind === "notfound" && kept.verdict.claim === body.claim
    && Math.abs(+kept.verdict.amount - body.amount) <= 0.004 && Object.keys(kept).length === 1;
  const keys = ["status", "note", "message", "noReply", "mode", "point"];
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
    || path === "/_internal/maker/queue" && method === "GET"
    || path === "/_internal/maker/trade-cover" && method === "POST"
    || path === "/_internal/maker/trade-reading" && method === "POST"
    || path === "/_internal/maker/trip-split" && method === "POST"
    || path === "/_internal/maker/undo" && method === "POST"
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
    || TEST_USERS.includes(path.split("/")[4]) && /^\/_internal\/maker\/fixture-claims\/[0-9]{4}-[0-9]{4}\/a[0-9]{14}-[a-z0-9]{1,8}\/preview$/.test(path) && method === "POST"
    || /^\/_internal\/maker\/threads\/[a-z0-9]{4}-[a-z0-9]{4}$/.test(path) && method === "POST"
    || path === "/_internal/maker/offsets" && method === "GET"
    || path === "/_internal/maker/ledger" && ["GET", "POST"].includes(method)
    || path === "/_internal/maker/inputs/offset" && method === "POST"
    || path === "/_internal/maker/inputs/stock-count" && method === "POST"
    || /^\/_internal\/maker\/inputs\/(sale|purchase|tier-set|partner|house-sizes|hush|loan|repay|gift|redeem|add-id|appoint-existing|amend-id|place|ledger-amend|trip-pay|trip-join)$/.test(path) && method === "POST"
    || /^\/_internal\/maker\/drafts\/[^/]+\/(approve|reject)$/.test(path) && method === "POST"
    || /^\/_internal\/maker\/queue\/[^/]+\/withdraw$/.test(path) && method === "POST"
    || /^\/_internal\/maker\/orders\/[0-9]{14}-[a-z0-9]{1,8}\/(preview|accept|handed|cash|received|again|notfound|move|restate)$/.test(path) && method === "POST"
    || (path === "/_internal/maker/order-again" || path === "/_internal/maker/words" || path === "/_internal/maker/fixture-check") && method === "POST";
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
  /* the test surface's two Desk reads on a Desk that has not shipped them: said plainly, never a 404 of the Counter's own */
  if (response.status === 404 && result && result.error === "not found" && /^\/_internal\/maker\/fixture-(check|claims)/.test(path))
    throw Object.assign(new Error("The Desk is not updated yet."), { status: 503 });
  if (!response.ok || !result || result.ok !== true)
    throw Object.assign(new Error(result && result.error || "The Desk maker operation failed."),
      { status: response.ok ? 502 : response.status, state: result && result.state,
        twin: result && result.twin, queuedTwin: result && result.queuedTwin, restate: result && result.restate });
  return result;
}

export async function customerAmend(env, u, id, body) {
  if (!onBook(env)) return { error: "Atomic order storage is unavailable.", code: "amendStore", status: 503 };
  const secret = String(env.COUNTER_MAKER_KEY || "");
  if (!env.DESK_MAKER || secret.length < 32)
    return { error: "The private Desk maker bridge is not configured.", code: "amendBridge", status: 503 };
  const fields = ["product", "qty", "mode", "place", "forFriend", "rid", "week", "digest", "wantBy", "slot"];
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

/** Negotiate: their Accept on his offer, told to the desk at once (best effort; the desk's minute pass follows it anyway). */
export async function takeNudge(env, id) {
  const secret = String(env.COUNTER_MAKER_KEY || "");
  if (!env.DESK_MAKER || secret.length < 32 || !/^[0-9]{14}-[a-z0-9]{1,8}$/.test(id)) return null;
  const response = await env.DESK_MAKER.fetch(new Request("https://desk/_internal/maker/orders/" + id + "/take", {
    method: "POST", headers: { "X-Counter-Maker-Key": secret, "content-type": "application/json" }, body: "{}"
  }));
  return response.ok;
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

/* COUNTER BATCH A (18 Oct 2026): HIS COLLECTION POINTS, Counter KV maker:points, as the hours are: written here directly, no Desk
   hop, one shape a POST (the whole list), checked by validatePoints. The answer carries the test accounts' invented list beside his,
   which his page offers at Ready on an example order and nowhere else. Removing a code an open order sits at is allowed: the order
   keeps its own copy. */
async function makerPoints(request, env, method) {
  if (!env.STMT) return json({ ok: false, error: "no Counter store" }, 503);
  if (method === "GET") return json({ ok: true, points: await readPoints(env), examples: EXAMPLE_POINTS });
  if (method !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
  const parsed = await bodyOf(request);
  if (parsed.error) return json({ ok: false, error: parsed.error }, parsed.status);
  const next = validatePoints(parsed.body);
  if (next.error) return json({ ok: false, error: next.error }, 400);
  await env.STMT.put(POINTS_KEY, JSON.stringify(next));
  return json({ ok: true, points: next, examples: EXAMPLE_POINTS });
}

/* ---- THE TEST SURFACE: EVERY MOVE ON AN EXAMPLE ORDER (his answers of 18 Oct 2026, Asks 2, 6 and 7) ----------------------------------
 * One road for example orders, on /all and /all/test alike. Each tap composes the body the Desk would send and runs it through the order
 * book's own decideDesk in the account's fixture alone (actor deskorder), so every rule a real order keeps holds here, and nothing is
 * queued, drafted, approved or folded. Three rules live only on the Desk, and the one stateless read, fixture-check, answers them: the
 * word check, what needs their yes at Accept and a close's goods. Nothing prices: the fixture's prices are invented, so no floor is
 * asked for. Pay first is his switch here, since paid in advance is read off the real book. A retry under an id lands once. */
async function exampleFind(env, id) {
  for (const u of TEST_USERS) {
    const fixture = await exampleAccount(env, u);
    if (!fixture.ok) {
      if (fixture.status === 409) continue;
      return { response: json(fixture, fixture.status || 503) };
    }
    const found = fixture.orders.find((o) => o.id === id);
    if (found && isExample(u, id)) return { u, found };
  }
  return { response: json({ ok: false, error: "order not found" }, 404) };
}
const fixtureTerms = (o) => ({ total: +o.total || 0, qty: +o.qty, mode: o.mode, slot: o.slot || null, wantBy: o.wantBy || null });
const fixtureCheck = (env, o, move) => deskCall(env, "/_internal/maker/fixture-check", "POST", { order: fixtureTerms(o), move });
async function digestOf(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value))));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const EXAMPLE_FIELDS = { preview: ["delivery", "total", "slot", "prepay"], accept: ["delivery", "total", "slot", "prepay", "hash", "rid"],
  offer: ["delivery", "total", "slot", "hash", "rid"], withdraw: ["rid"], handed: ["qty", "close", "rid"], cash: ["amount", "rid"], received: ["amount", "claim", "rid"] };
const OFFER_MS = 48 * 3600e3;
async function exampleAction(env, id, action, body) {
  if (action === "again") return json({ ok: false, error: "An example order has no rejected row to offer again." }, 409);
  const fields = EXAMPLE_FIELDS[action];
  if (!fields || Object.keys(body).some((key) => !fields.includes(key))) return json({ ok: false, error: "Unsupported order action fields." }, 400);
  for (const key of ["delivery", "total", "qty", "amount"])
    if (body[key] !== undefined && (typeof body[key] !== "number" || !Number.isFinite(body[key]) || body[key] < 0 || body[key] > 1000000))
      return json({ ok: false, error: "Order figures must be finite, non-negative numbers." }, 400);
  if (body.prepay !== undefined && typeof body.prepay !== "boolean" || body.close !== undefined && typeof body.close !== "boolean"
    || body.slot !== undefined && body.slot !== "" && typeof body.slot !== "string" || body.hash !== undefined && typeof body.hash !== "string")
    return json({ ok: false, error: "Unsupported order action fields." }, 400);
  const f = await exampleFind(env, id);
  if (f.response) return f.response;
  const { u, found: o } = f;
  let rid = body.rid, move = null;
  if (["preview", "accept", "offer"].includes(action)) {
    const delivery = o.mode === "deliver" ? (typeof body.delivery === "number" ? +body.delivery.toFixed(2) : null) : 0;
    if (delivery == null) return json({ ok: false, error: "choose the delivery charge first" }, 400);
    const total = typeof body.total === "number" && body.total > 0 ? +body.total.toFixed(2) : +o.total;
    const check = await fixtureCheck(env, o, Object.assign({ total }, body.slot ? { slot: body.slot } : {}));
    const terms = { id, status: o.status, step: (o.history || []).length, total, delivery, slot: check.slot || null, prepay: body.prepay === true };
    const hash = await digestOf(terms);
    if (action === "preview") return json({ ok: true, test: true, hash, offerHash: hash, quote: total, delivery, slot: check.slot || null,
      needsYes: check.yes === true, prepay: terms.prepay, chargeChosen: true, flags: [] });
    /* Accept carries no id of its own on his page: it is named by the figures he agreed (the hash he was shown), so a retry after the
       order has moved on is still the same tap */
    rid = rid || (action === "accept" && /^[0-9a-f]{64}$/.test(String(body.hash || "")) ? "acc" + body.hash.slice(0, 40) : rid);
    const seen = await exampleSeen(env, u, id, action, body, rid);
    if (seen) return seen;
    if (body.hash !== hash) return json({ ok: false, differs: true, error: "The figures changed since the card drew them. Read them again." }, 409);
    const until = new Date(Date.now() + OFFER_MS).toISOString();
    if (action === "accept") {
      if (check.yes) return json({ ok: false, needsYes: true, error: "this raises their price or changes their window: send it to them for their yes" }, 409);
      move = Object.assign({ status: "acknowledged", delivery, prepay: terms.prepay }, Math.abs(total - (+o.total || 0)) > 0.004 ? { total } : {},
        check.slot ? { slot: check.slot } : {});
    } else if (o.price && o.price.from !== "accept" && ["asked", "offered"].includes(o.price.state)) move = { offer: { id: String(rid || ""), total, until } };
    else {
      if (!check.yes) return json({ ok: false, error: "nothing here needs their yes: Accept it" }, 409);
      move = { offer: { id: String(rid || ""), kind: "accept", total, delivery, slot: check.slot || null, until } };
    }
  } else {
    const seen = await exampleSeen(env, u, id, action, body, rid);
    if (seen) return seen;
    if (action === "withdraw") move = { withdraw: true };
    if (action === "cash") move = { cash: { amount: body.amount } };
    if (action === "handed") {
      if (typeof body.qty !== "number") return json({ ok: false, error: "Say how many units were handed over." }, 400);
      const closing = body.close === true && body.qty < +o.qty - 0.004;
      if (!closing && Math.abs(body.qty - (+o.moved || 0)) < 0.0004) return json({ ok: false, error: "that is what the order already says was handed over" }, 409);
      move = { handover: Object.assign({ units: body.qty, mode: o.mode }, closing ? { close: true, total: (await fixtureCheck(env, o, { close: body.qty })).close } : {}) };
    }
    if (action === "received") {
      const waiting = (o.payments || []).filter((p) => p && p.claim === "waiting");
      const p = body.claim ? waiting.find((x) => x.at === body.claim) : waiting[0];
      if (!p) return json({ ok: false, error: "nothing they recorded is waiting to be received here" }, 409);
      if (typeof body.amount !== "number" || Math.abs(p.amount - body.amount) > 0.004) return json({ ok: false, error: "That claim amount has changed." }, 409);
      move = { verdict: { kind: "received", claim: p.at, amount: p.amount } };
    }
  }
  const shaped = await deskBody(env, move);
  if (shaped.error) return json({ ok: false, error: shaped.error }, shaped.status || 400);
  const result = await exampleAccount(env, u, { actor: "deskorder", id, rid, request: { id, action, body }, body: shaped.body });
  return json(result.ok ? { ok: true, order: result.order, test: true, ...(result.again ? { again: true } : {}) } : result, result.ok ? 200 : result.status || 503);
}
/* a tap the order book already holds under its id is answered from it, before anything is read again; other content under it is refused */
async function exampleSeen(env, u, id, action, body, rid) {
  if (!RID_RE.test(String(rid || ""))) return json({ ok: false, error: "Send the action's immutable request id." }, 400);
  const r = await exampleAccount(env, u, { actor: "orderreceipt", rid, request: { id, action, body } });
  if (!r.ok) return json(r, r.status || 503);
  return r.found ? json({ ok: true, order: r.order, test: true, again: true }) : null;
}

function internalOperation(path) {
  if (path === "/all/maker/trade-cover") return { kind: "trade-cover" };
  if (path === "/all/maker/trade-reading") return { kind: "trade-reading" };
  if (path === "/all/maker/trip-split") return { kind: "trip-split" };
  if (path === "/all/maker/undo") return { kind: "undo" };
  if (path === "/all/maker/review") return { kind: "review" };
  if (path === "/all/maker/queue") return { kind: "queue" };
  const withdrawal = /^\/all\/maker\/queue\/([^/]+)\/withdraw$/.exec(path);
  if (withdrawal) return { kind: "queue-withdraw", id: withdrawal[1] };
  if (path === "/all/maker/hours") return { kind: "hours" };
  if (path === "/all/maker/points") return { kind: "points" };
  if (path === "/all/maker/inputs") return { kind: "inputs" };
  if (path === "/all/maker/vault") return { kind: "vault" };
  if (path === "/all/maker/vault/addr") return { kind: "vault-addr" };
  if (path === "/all/maker/vault/pair") return { kind: "vault-pair" };
  if (path === "/all/maker/geo/expand") return { kind: "geo-expand" };
  if (path === "/all/maker/threads") return { kind: "threads" };
  if (path === "/all/maker/bulletin") return { kind: "bulletin" };
  if (path === "/all/maker/claims") return { kind: "claims" };
  if (path === "/all/maker/pools") return { kind: "pools" };
  const pool = /^\/all\/maker\/pools\/(p[0-9]{14}-[a-z0-9]{1,8})\/close$/.exec(path);
  if (pool) return { kind: "pool-close", id: pool[1] };
  if (path === "/all/maker/vault/key") return { kind: "slip-key" };
  const slip = /^\/all\/maker\/slips\/([a-z0-9]{4}-[a-z0-9]{4})\/([0-9a-f]{32})$/.exec(path);
  if (slip) return { kind: "slip", u: slip[1], id: slip[2] };
  const claim = /^\/all\/maker\/claims\/([a-z0-9]{4}-[a-z0-9]{4})\/(a[0-9]{14}-[a-z0-9]{1,8})\/(preview|received|notfound)$/.exec(path);
  if (claim) return { kind: "claim", u: claim[1], id: claim[2], action: claim[3] };
  const thread = /^\/all\/maker\/threads\/([a-z0-9]{4}-[a-z0-9]{4})$/.exec(path);
  if (thread) return { kind: "thread", u: thread[1] };
  if (path === "/all/maker/offsets") return { kind: "offsets" };
  if (path === "/all/maker/ledger") return { kind: "ledger" };
  if (path === "/all/maker/inputs/offset") return { kind: "input", input: "offset" };
  if (path === "/all/maker/inputs/stock-count") return { kind: "stock-count" };
  const input = /^\/all\/maker\/inputs\/(sale|purchase|tier-set|partner|house-sizes|hush|loan|repay|gift|redeem|add-id|appoint-existing|amend-id|place|ledger-amend|trip-pay|trip-join)$/.exec(path);
  if (input) return { kind: "input", input: input[1] };
  const customer = /^\/all\/maker\/customers\/([a-z0-9]{4}-[a-z0-9]{4})\/orders$/.exec(path);
  if (customer) return { kind: "place", u: customer[1] };
  if (/^\/all\/maker\/drafts$/.test(path)) return { kind: "drafts" };
  const dm = /^\/all\/maker\/drafts\/([^/]+)\/(approve|reject)$/.exec(path);
  if (dm) return { kind: "draft-decision", id: dm[1], decision: dm[2] };
  const om = /^\/all\/maker\/orders\/([0-9]{14}-[a-z0-9]{1,8})\/(preview|accept|offer|withdraw|handed|cash|received|again)$/.exec(path);
  if (om) return { kind: "order-action", id: om[1], action: om[2] };
  const mm = /^\/all\/maker\/orders\/([0-9]{14}-[a-z0-9]{1,8})\/(move|notfound|restate)$/.exec(path);
  if (mm) return { kind: "order-move", id: mm[1], action: mm[2] };
  return null;
}

/* THE TEST SURFACE (his answers of 18 Oct 2026): what Salt Admin may do under /all/test, on the example orders and the test accounts
   alone. Every other kind, every real order and every real username answers 404; the reads come from the fixtures and call no Desk route;
   a reply on a test account's thread is written in-process and wakes nobody (Fable's review). */
const TEST_KINDS = { review: ["GET"], "order-action": ["POST"], "order-move": ["POST"], claim: ["POST"], claims: ["GET"], thread: ["POST"],
  threads: ["GET"], pools: ["GET"], hours: ["GET"], points: ["GET"] };
async function testMaker(request, env, op) {
  const method = request.method;
  if (!Object.hasOwn(TEST_KINDS, op.kind) || !TEST_KINDS[op.kind].includes(method)) return json({ ok: false, error: "not found" }, 404);
  if ((op.kind === "order-action" || op.kind === "order-move") && !EXAMPLE_ID.test(op.id)) return json({ ok: false, error: "not found" }, 404);
  if ((op.kind === "claim" || op.kind === "thread") && !isTest(op.u)) return json({ ok: false, error: "not found" }, 404);
  const fixtures = async (read) => {
    const out = [];
    for (const u of TEST_USERS) {
      const fixture = await exampleAccount(env, u);
      if (!fixture.ok) { if (fixture.status === 409) continue; throw Object.assign(new Error(fixture.error), { status: fixture.status || 503 }); }
      out.push(...read(u, fixture));
    }
    return out;
  };
  if (op.kind === "review") {
    const orders = await fixtures((u, f) => f.orders.map((o) => ({ ...o, u: o.u || u, test: true })));
    return json({ ok: true, test: true, orders, drafts: [], refused: [], queue: [], unreadable: [], trips: [], sameDay: [], rows: [], refunds: {} });
  }
  if (op.kind === "claims") return json({ ok: true, test: true, claims: await fixtures((u, f) => f.account.claims.map((c) => ({ ...c, test: true }))) });
  if (op.kind === "pools") {
    const pools = [];
    for (const u of TEST_USERS) pools.push(...(await examplePools(env, u)).map((p) => ({ ...p, test: true })));
    return json({ ok: true, test: true, pools });
  }
  if (op.kind === "threads") {
    const threads = [];
    for (const u of TEST_USERS) { const t = await exampleThread(env, u); if (t) threads.push(Object.assign({}, t, { u, code: "TEST", test: true })); }
    return json({ ok: true, test: true, threads });
  }
  if (op.kind === "thread") {
    const parsed = await bodyOf(request);
    if (parsed.error) return json({ ok: false, error: parsed.error }, parsed.status);
    const b = parsed.body;
    if (Object.keys(b).some((k) => !["rid", "message", "noReply"].includes(k)) || !RID_RE.test(String(b.rid || ""))
      || (b.noReply === true) === (typeof b.message === "string") || typeof b.message === "string" && (!b.message.trim() || b.message.length > 200))
      return json({ ok: false, error: "A reply needs its fixed request id and one message of 1 to 200 characters, or No reply needed." }, 400);
    if (typeof b.message === "string") await fixtureCheck(env, { total: 0, qty: 1, mode: "collect" }, { texts: [b.message] });
    const r = await exampleDeskSay(env, op.u, b);
    return r.error ? json({ ok: false, error: r.error, ...(r.code ? { code: r.code } : {}) }, r.status || 400) : json({ ok: true, test: true, thread: r.thread });
  }
  return null;   /* the moves and the claim road: the ordinary handlers, which keep example ids and test accounts on their own roads */
}

export async function handleMaker(request, env, pathname, verifiedIdentity, opts = {}) {
  if (!allowedOwner(verifiedIdentity)) return json({ ok: false, error: "Admin access required" }, 403);
  if (!pathname.startsWith("/all/maker/")) return json({ ok: false, error: "not found" }, 404);
  const op = internalOperation(pathname);
  if (!op) return json({ ok: false, error: "not found" }, 404);
  const method = request.method;
  try {
    if (opts.test === true) {
      const answered = await testMaker(request, env, op);
      if (answered) return answered;
    }
    if (op.kind === "trade-cover") {
      if (method !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
      const parsed = await bodyOf(request);
      if (parsed.error) return json({ ok: false, error: parsed.error }, parsed.status);
      return json(await deskCall(env, "/_internal/maker/trade-cover", "POST", parsed.body));
    }
    if (op.kind === "trade-reading") {
      if (method !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
      const parsed = await bodyOf(request);
      if (parsed.error) return json({ ok: false, error: parsed.error }, parsed.status);
      return json(await deskCall(env, "/_internal/maker/trade-reading", "POST", parsed.body));
    }
    /* plan 3 (16 Oct 2026): one payment for an order of several books, split by the Desk before anything is sent; a read */
    if (op.kind === "trip-split") {
      if (method !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
      const parsed = await bodyOf(request);
      if (parsed.error) return json({ ok: false, error: parsed.error }, parsed.status);
      if (Object.keys(parsed.body).some((key) => !["trip", "amount"].includes(key)))
        return json({ ok: false, error: "Send only the order and the amount." }, 400);
      return json(await deskCall(env, "/_internal/maker/trip-split", "POST", parsed.body));
    }
    /* plan 4 (16 Oct 2026): one sale's History and the undo of its newest move, read by the Desk; a read, nothing is sent */
    if (op.kind === "undo") {
      if (method !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
      const parsed = await bodyOf(request);
      if (parsed.error) return json({ ok: false, error: parsed.error }, parsed.status);
      if (Object.keys(parsed.body).length !== 1 || !["rid", "order"].includes(Object.keys(parsed.body)[0]))
        return json({ ok: false, error: "Send only the row or the order." }, 400);
      return json(await deskCall(env, "/_internal/maker/undo", "POST", parsed.body));
    }
    if (op.kind === "hours") return await makerHours(request, env, method);
    if (op.kind === "points") return await makerPoints(request, env, method);
    /* THE POOL, A GROUP ORDER: his read of every one, his opening of one (a product, a size, a target, a closing day), and his
       Close. Close is the order book's first (each joiner told once), then each joined order is previewed and accepted through
       the Desk, as his own Accept on its card would be; a joined order the Desk will not accept is written on the pool as
       closeLeft with its reason, the rest carry on, and Close again retries only those. Under the target it still closes. */
    if (op.kind === "pools") {
      if (method === "GET") return json({ ok: true, pools: await allPools(env) });
      if (method !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
      const parsed = await bodyOf(request);
      if (parsed.error) return json({ ok: false, error: parsed.error }, parsed.status);
      const r = await poolOpen(env, parsed.body);
      return r.error ? json({ ok: false, error: r.error, ...(r.code ? { code: r.code } : {}) }, r.status || 400) : json({ ok: true, pool: r.pool });
    }
    if (op.kind === "pool-close") {
      if (method !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
      const parsed = await bodyOf(request);
      if (parsed.error) return json({ ok: false, error: parsed.error }, parsed.status);
      if (Object.keys(parsed.body).length) return json({ ok: false, error: "Close takes an empty object." }, 400);
      const first = await poolClose(env, op.id, {});
      if (first.error) return json({ ok: false, error: first.error, ...(first.code ? { code: first.code } : {}) }, first.status || 400);
      /* the first close answers every order still to acknowledge; a Close again only the ones it could not */
      const left = new Set(((first.pool && first.pool.closeLeft) || []).map((x) => x.id));
      const todo = first.joined.filter((j) => j.status === "placed" && (first.closed || !left.size || left.has(j.id)));
      const accepted = [], failed = [];
      for (const j of todo) {
        try {
          const pv = await deskCall(env, "/_internal/maker/orders/" + j.id + "/preview", "POST", {});
          const ac = await deskCall(env, "/_internal/maker/orders/" + j.id + "/accept", "POST", { hash: pv.hash });
          if (ac.differs) failed.push({ id: j.id, why: "its row differs from the preview and waits under Approve" });
          else accepted.push(j.id);
        } catch (error) { failed.push({ id: j.id, why: String(error && error.message || error).slice(0, 200) }); }
      }
      let pool = first.pool;
      if (JSON.stringify(failed) !== JSON.stringify((pool && pool.closeLeft) || [])) {
        const written = await poolClose(env, op.id, { left: failed });
        if (written.pool) pool = written.pool;
      }
      return json({ ok: true, pool, accepted, left: failed });
    }
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
    if (op.kind === "ledger") {
      if (method !== "GET" && method !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
      return json(await deskCall(env, "/_internal/maker/ledger", method, method === "POST" ? {} : undefined));
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
      /* a test account's order goes to its fixture on this road too, never the book (the test surface, Ask 4) */
      const result = isTest(op.u) ? await examplePlace(env, op.u, body) : await placeOrder(env, op.u, body, "desk");
      if (!result.order) return json({ ok: false, ...result }, result.status || 400);
      return json({ ok: true, order: customerView(result.order) });
    }
    if (op.kind === "review") {
      if (method !== "GET") return json({ ok: false, error: "method not allowed" }, 405);
      if (!env.STMT) return json({ ok: false, error: "no Counter store" }, 503);
      const [orders, drafts, queue] = await Promise.all([
        allOrders(env, true), deskCall(env, "/_internal/maker/drafts", "GET"),
        deskCall(env, "/_internal/maker/queue", "GET")
      ]);
      if (!Array.isArray(queue.entries)) return json({ ok: false, error: "The server-held queue was unreadable." }, 502);
      /* a move he rejected under Approve, offered again from here: the Desk's own againOf names the stages */
      /* open orders first, then the rest: a cancellation he rejected leaves the order cancelled, still offered again */
      const open = (o) => !["declined", "cancelled", "done"].includes(o.status);
      const ids = [...orders.filter(open), ...orders.filter((o) => !open(o))].map((o) => o.id).slice(0, 200);
      const againRes = ids.length ? await deskCall(env, "/_internal/maker/order-again", "POST", { ids }) : {}, again = againRes.again || {}, whole = againRes.whole || {};
      for (const o of orders) if (Array.isArray(again[o.id]) && again[o.id].length) { o.again = again[o.id]; if (whole[o.id] === true) o.againWhole = true; }
      /* the acceptance accounts' orders, from their serialized fixture alone, marked so no real road is offered */
      for (const u of TEST_USERS) {
        const fixture = await exampleAccount(env, u);
        if (!fixture.ok) {
          if (fixture.status === 409) continue;
          return json(fixture, fixture.status || 503);
        }
        orders.push(...fixture.orders.map((o) => ({ ...o, u: o.u || u, test: true })));
      }
      /* plan 1: a queue key the Desk could not read is named, never read as an empty queue (src/worker.js makerQueueReview) */
      const unreadable = Array.isArray(queue.unreadable) ? queue.unreadable.filter((k) => typeof k === "string" && /^q:[A-Za-z0-9._-]{1,80}$/.test(k)).slice(0, 20) : [];
      /* plan 3: the orders of several books the Desk read with the drafts, or that it could not read them */
      const trips = Array.isArray(drafts.trips) ? drafts.trips : [], sameDay = Array.isArray(drafts.sameDay) ? drafts.sameDay : [];
      /* 17 Oct 2026: every live row of the book is an order here; a row a live site order holds is drawn as that order, by its key */
      const held = new Set(orders.filter((o) => !o.test && !["declined", "cancelled"].includes(o.status) && typeof o.ledgerKey === "string").map((o) => o.ledgerKey));
      const rows = Array.isArray(drafts.rows) ? drafts.rows.filter((r) => r && !held.has(r.key)) : [];
      return json({ ok: true, orders, drafts: drafts.drafts || [], refused: drafts.refused || [], queue: queue.entries, unreadable, trips, sameDay, rows, refunds: drafts.refunds && typeof drafts.refunds === "object" ? drafts.refunds : {},
        ...(typeof drafts.tripsError === "string" || !Array.isArray(drafts.trips) ? { tripsError: drafts.tripsError || "Orders of several books could not be read." } : {}) });
    }
    if (op.kind === "queue") {
      if (method !== "GET") return json({ ok: false, error: "method not allowed" }, 405);
      return json(await deskCall(env, "/_internal/maker/queue", "GET"));
    }
    if (op.kind === "queue-withdraw") {
      if (method !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
      const parsed = await bodyOf(request);
      if (parsed.error) return json({ ok: false, error: parsed.error }, parsed.status);
      if (Object.keys(parsed.body).length !== 1 || !/^[0-9a-f]{64}$/.test(parsed.body.fingerprint || ""))
        return json({ ok: false, error: "Send only the server-held entry fingerprint." }, 400);
      let id;
      try { id = decodeURIComponent(op.id); }
      catch { return json({ ok: false, error: "Invalid queue timestamp." }, 400); }
      if (!Number.isFinite(Date.parse(id)) || new Date(id).toISOString() !== id)
        return json({ ok: false, error: "Invalid queue timestamp." }, 400);
      return json(await deskCall(env, "/_internal/maker/queue/" + encodeURIComponent(id) + "/withdraw", "POST", parsed.body));
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
      /* the test surface: an example order's every move, in its fixture alone (exampleAction) */
      if (EXAMPLE_ID.test(op.id)) return await exampleAction(env, op.id, op.action, parsed.body);
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
        /* the words through the Desk's one stateless read for example orders (the test surface), as every other move of theirs */
        const texts = [rest.message, rest.note].filter((text) => typeof text === "string");
        if (texts.length) await fixtureCheck(env, found, { texts });
        let move = rest;
        if (rest.status) move = { ...rest, maker: true };   /* the same rules as a real order's, held by the order book */
        if (op.action === "restate") move = { restate: { qty: rest.qty !== undefined ? rest.qty : found.qty, total: rest.total !== undefined ? rest.total : found.total, delivery: rest.delivery !== undefined ? rest.delivery : +(found.delivery || 0) } };
        if (op.action === "notfound") {
          const waiting = (found.payments || []).find((p) => p && p.claim === "waiting" && p.at === rest.claim);
          if (!waiting) return json({ ok: false, error: "That claim is not waiting any more." }, 409);
          if (Math.abs(waiting.amount - rest.amount) > 0.004) return json({ ok: false, error: "That claim amount has changed." }, 409);
          move = { verdict: { kind: "notfound", claim: waiting.at, amount: waiting.amount } };
        }
        /* Counter Batch A: an example order's point is the test accounts' own, resolved here, never from his list; its place
           rides beside the move and never into the request kept under the id */
        const pointAt = rest.point !== undefined ? resolvePoint(EXAMPLE_POINTS, rest.point) : undefined;
        const result = await exampleAccount(env, u, { actor: "deskorder", id: op.id, rid,
          request: { id: op.id, action: op.action, body: rest }, body: move, ...(pointAt !== undefined ? { pointAt } : {}) });
        return json(result.ok ? { ok: true, order: result.order, test: true, ...(result.again ? { again: true } : {}) } : result,
          result.ok ? 200 : result.status || 503);
      }
      const order = (await allOrders(env, true)).find((item) => item.id === op.id);
      if (!order) return json({ ok: false, error: "order not found" }, 404);
      /* an amendment is a queued row: the Desk's own once-per-id guard answers its retry */
      if (op.action === "restate") return json(await deskCall(env, "/_internal/maker/orders/" + op.id + "/restate", "POST", body));
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
    return json({ ok: false, error: String(error && error.message || error),
      ...(typeof error.state === "string" ? { state: error.state } : {}),
      ...(error.twin ? { twin: error.twin } : {}),
      ...(error.queuedTwin ? { queuedTwin: error.queuedTwin } : {}),
      ...(error.restate && typeof error.restate === "object" ? { restate: error.restate } : {}) }, status);
  }
  return json({ ok: false, error: "not found" }, 404);
}

export async function publicHours(env) {
  const value = env.STMT ? await env.STMT.get(HOURS_KEY, "json") : null;
  if (!value) return Object.assign(hoursStatus(null), { config: windowHours(null) });
  if (value.schedule != null) {
    const valid = validateWeeklyHours(value.schedule);
    if (valid.error) throw new TypeError("Stored operating hours are invalid: " + valid.error);
  }
  /* 10 Oct 2026: and the hours themselves, the weekly days and a manual override, so the order sheet offers the delivery
     windows the Worker takes (stmt/window.js): opening hours, which the page said in words already */
  return Object.assign(hoursStatus(value), { config: windowHours(value) });
}
