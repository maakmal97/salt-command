/* test/counter-c-confirm.mjs: THE CONFIRM TIME, MEASURED (Counter Batch C, P3, item 19; his answers of 18 and 20 Oct 2026, Fable's review).
 *
 * stmt/confirm.js measures the median Place to Accept over his last 30 confirmations made in Counter hours, up to the next quarter
 * hour; the Counter's hourly cron files it at KV confirm:within before the chase's slot return; GET /hours carries {mins, n} while
 * it is under three hours old. Each check drives the module, the cron or the route; each was proved red by its own mutation
 * (test/counter-c-confirm.mutations.json, tools/section.mjs).
 *   1  the median: an odd count takes the middle, an even count the mean of the middle two before rounding
 *   2  the rounding: 0 and 3 to 15, 14 to 15, 16 to 30, 45 stays 45
 *   3  the first acknowledged line wins over a later one
 *   4  moments inside the hours, read from ISO strings, count; a placing or an Accept out of hours is left out
 *   5  the manual override is ignored, so a closed override now recolours no past moment
 *   6  nine gives null, ten a figure; only the latest 30 by Accept count
 *   7  any order with a price, a group order and a test account are left out
 *   8  a replacement is measured from the root of its chain; a loop or a missing root falls back to its own placing, no throw
 *   9  the cron files the figure at an hour with no chase slot, and a throw in it leaves the chase running
 *  10  GET /hours carries {mins, n} and nothing else of the orders, and drops a figure over three hours old */
import { webcrypto } from "node:crypto";

class KV {
  constructor() { this.m = new Map(); this.opts = new Map(); }
  async put(k, v, o) { this.m.set(k, v); this.opts.set(k, o || null); }
  async get(k, type) { if (!this.m.has(k)) return null; const raw = this.m.get(k); return type === "json" ? JSON.parse(raw) : raw; }
  async delete(k) { this.m.delete(k); }
  async list({ prefix = "" } = {}) { return { keys: [...this.m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; }
}
const J = (o) => JSON.stringify(o);
/* the Counter open 09:00 to 18:00 Kuala Lumpur, every day: 01:00 to 10:00 UTC */
const WEEK = { days: Array.from({ length: 7 }, () => ({ open: "09:00", close: "18:00" })) };
const T0 = Date.parse("2026-10-12T01:30:00Z");   /* 09:30 MYT */
const iso = (t) => new Date(t).toISOString();
let seq = 0;
/* an order placed at `p` (ms) and acknowledged `mins` later */
const mk = (p, mins, extra = {}) => {
  const id = "20261012" + String(++seq).padStart(6, "0") + "-c" + seq;
  return Object.assign({ id, u: "abcd-efgh", at: iso(p), status: "acknowledged", history: [{ at: iso(p), status: "placed", by: "customer" }, { at: iso(p + mins * 60000), status: "acknowledged", by: "desk" }] }, extra);
};
/* n orders, one an hour apart from T0 (wrapping into the next day's hours), with these minutes */
const set = (mins, base = T0) => mins.map((m, k) => mk(base + Math.floor(k / 6) * 86400000 + (k % 6) * 3600000, m));

export async function run({ ok }) {
  const C = await import("../stmt/confirm.js?" + Date.now());
  const cfg = { schedule: WEEK };

  /* ---- 1 ---- */
  const odd = C.confirmWithin(set([1, 1, 1, 1, 1, 40, 100, 100, 100, 100, 100]), cfg);
  const even = C.confirmWithin(set([1, 1, 1, 1, 14, 46, 100, 100, 100, 100]), cfg);
  ok(J(odd) === J({ mins: 45, n: 11 }) && J(even) === J({ mins: 30, n: 10 }),
    "the median: eleven take the middle (40, to 45); ten the mean of the middle two (14 and 46 make 30) before rounding: " + J([odd, even]));

  /* ---- 2 ---- */
  ok([0, 3, 14, 16, 45].map(C.quarterUp).join() === "15,15,15,30,45", "up to the next quarter hour, never under 15, an Accept in the same minute included: " + [0, 3, 14, 16, 45].map(C.quarterUp).join());

  /* ---- 3 ---- */
  const twice = set(Array(10).fill(20));
  twice[0].history.push({ at: iso(Date.parse(twice[0].at) + 300 * 60000), status: "acknowledged", by: "desk" });
  for (const o of twice.slice(1, 6)) o.history.push({ at: iso(Date.parse(o.at) + 200 * 60000), status: "acknowledged", by: "desk" });
  ok(J(C.confirmWithin(twice, cfg)) === J({ mins: 30, n: 10 }) && C.acceptedAt(twice[0]) === Date.parse(twice[0].at) + 20 * 60000,
    "the first acknowledgement wins over a later one: " + J(C.confirmWithin(twice, cfg)));

  /* ---- 4 ---- */
  const inside = set(Array(10).fill(30));
  const early = mk(Date.parse("2026-10-12T00:30:00Z"), 60);    /* placed 08:30, accepted 09:30 */
  const late = mk(Date.parse("2026-10-12T09:40:00Z"), 30);     /* placed 17:40, accepted 18:10 */
  const r4 = C.confirmWithin(inside.concat([early, late]), cfg);
  ok(J(r4) === J({ mins: 30, n: 10 }), "ten placed and accepted inside the hours count, read from their ISO moments; one placed before nine and one accepted after six are left out: " + J(r4));

  /* ---- 5 ---- */
  const shut = { schedule: WEEK, manual: { open: false, until: iso(Date.now() + 86400000) } };
  ok(J(C.confirmWithin(inside, shut)) === J({ mins: 30, n: 10 }), "a closed override now is ignored: the past is judged on the weekly hours: " + J(C.confirmWithin(inside, shut)));

  /* ---- 6 ---- */
  const nine = C.confirmWithin(set(Array(9).fill(30)), cfg), ten = C.confirmWithin(set(Array(10).fill(30)), cfg);
  const old = set(Array(31).fill(200), T0 - 30 * 86400000).concat(set(Array(30).fill(20)));
  const r6 = C.confirmWithin(old, cfg);
  ok(nine === null && J(ten) === J({ mins: 30, n: 10 }), "nine confirmations give nothing, ten a figure: " + J([nine, ten]));
  ok(J(r6) === J({ mins: 30, n: 30 }), "only the latest 30 by Accept count, the 31 older and slower left out: " + J(r6));

  /* ---- 7 ---- */
  const base = set(Array(10).fill(15));
  const priced = mk(T0 + 7 * 86400000, 300, { price: { state: "taken", from: "accept" } });
  const asked = mk(T0 + 7 * 86400000 + 3600000, 300, { price: { state: "taken" } });
  const grouped = mk(T0 + 7 * 86400000 + 7200000, 300, { pool: "p20261012" });
  const tester = mk(T0 + 7 * 86400000 + 10800000, 300, { u: "0000-0000" });
  const r7 = C.confirmWithin(base.concat([priced, asked, grouped, tester]), cfg);
  ok(J(r7) === J({ mins: 15, n: 10 }), "an Accept sent as an offer, a haggled ask, a group order and a test account are left out: " + J(r7));

  /* ---- 8 ---- */
  const root = Object.assign(mk(T0 + 8 * 86400000, 0), { status: "cancelled", history: [{ at: iso(T0 + 8 * 86400000), status: "placed" }, { at: iso(T0 + 8 * 86400000 + 20 * 60000), status: "cancelled" }] });
  const mid = Object.assign(mk(T0 + 8 * 86400000 + 20 * 60000, 0), { replaces: root.id, status: "cancelled", history: [{ at: iso(T0 + 8 * 86400000 + 20 * 60000), status: "placed" }] });
  const tip = Object.assign(mk(T0 + 8 * 86400000 + 40 * 60000, 80), { replaces: mid.id });
  ok(C.placedAt(tip, new Map([root, mid, tip].map((o) => [o.id, o]))) === T0 + 8 * 86400000,
    "a replacement of a replacement is placed when its root was");
  /* nine others and the tip: from its root the middle two are 60 and 120 (90); from its own placing they would be 60 and 80 (75) */
  const r8 = C.confirmWithin(set([60, 60, 60, 60, 60, 200, 200, 200, 200]).concat([root, mid, tip]), cfg);
  ok(J(r8) === J({ mins: 90, n: 10 }), "and counts from there, 120 minutes and not 80: " + J(r8));
  const a = mk(T0 + 10 * 86400000, 45), b = mk(T0 + 10 * 86400000 + 600000, 45);
  a.replaces = b.id; b.replaces = a.id;
  const lost = Object.assign(mk(T0 + 10 * 86400000 + 1200000, 45), { replaces: "20260101000000-gone" });
  let r8b, threw = null;
  try { r8b = [C.placedAt(a, new Map([[a.id, a], [b.id, b]])), C.placedAt(lost, new Map([[lost.id, lost]]))]; } catch (e) { threw = String(e); }
  ok(!threw && r8b[0] === Date.parse(a.at) && r8b[1] === Date.parse(lost.at),
    "a loop or a missing root falls back to the order's own placing, with no throw: " + J(threw || r8b));

  /* ---- 9 ---- */
  const stmtW = (await import("../stmt/worker.js")).default;
  const kp = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const envOf = async (kv) => ({ STMT: kv, STMT_VAPID_PUBLIC_KEY: "pubc", STMT_VAPID_PRIVATE_JWK: JSON.stringify(await webcrypto.subtle.exportKey("jwk", kp.privateKey)), STMT_VAPID_SUBJECT: "mailto:a@b.test" });
  const logs = [], hits = [], realFetch = globalThis.fetch;
  const tick = async (at, env) => {
    const w = [], realLog = console.log;
    console.log = (...x) => { logs.push(x.join(" ")); };
    try { await stmtW.scheduled({ cron: "0 * * * *", scheduledTime: Date.parse(at) }, env, { waitUntil: (p) => w.push(p) }); await Promise.all(w); }
    finally { console.log = realLog; }
  };
  globalThis.fetch = async (url) => { hits.push(String(url)); return new Response("", { status: 201 }); };
  try {
    const kv = new KV(), env = await envOf(kv);
    await kv.put("maker:hours", J({ schedule: WEEK }));
    for (const o of set(Array(12).fill(30))) await kv.put("order:" + o.u + ":" + o.id, J(o));
    await tick("2026-10-20T17:00:00Z", env);    /* 01:00 MYT: no chase slot */
    const filed = await kv.get("confirm:within", "json");
    ok(filed && filed.mins === 30 && filed.n === 12 && filed.at === "2026-10-20T17:00:00.000Z",
      "the cron files the figure at 01:00, an hour with no chase slot: " + J(filed));
    const kv2 = new KV(), env2 = await envOf(kv2);
    await kv2.put("maker:hours", J({ schedule: { days: [1, 2] } }));   /* a stored schedule that no longer validates: hoursStatus throws */
    await kv2.put("order:aaaa-bbbb:20261019000000-a1", J({ id: "20261019000000-a1", u: "aaaa-bbbb", at: "2026-10-19T02:00:00Z", status: "acknowledged", qty: 2, total: 200,
      delivery: 0, paid: 50, moved: 2, movedOn: "2026-10-19", rateAsk: "2026-10-19T12:00:00Z",
      history: [{ at: "2026-10-19T02:00:00Z", status: "placed" }, { at: "2026-10-19T02:30:00Z", status: "acknowledged" }] }));
    await kv2.put("push:aaaa-bbbb:aa11", J({ endpoint: "https://push.example/aaaa-bbbb", at: "2026-10-19T00:00:00Z" }));
    logs.length = 0;
    await tick("2026-10-20T02:00:00Z", env2);   /* 10:00 MYT, a chase slot */
    ok(hits.includes("https://push.example/aaaa-bbbb") && logs.some((l) => /^confirm FAILED/.test(l)) && !(await kv2.get("confirm:within")),
      "a throw in the measure is logged and leaves the chase running: " + J({ hits, logs: logs.map((l) => l.slice(0, 40)) }));
  } finally { globalThis.fetch = realFetch; }

  /* ---- 10 ---- */
  const kv3 = new KV(), env3 = await envOf(kv3);
  const hours = async () => (await (await stmtW.fetch(new Request("https://counter.fixture.test/hours"), env3, { waitUntil() {} })).json());
  await kv3.put("maker:hours", J({ schedule: WEEK }));
  await kv3.put("confirm:within", J({ mins: 45, n: 30, at: new Date(Date.now() - 3600000).toISOString(), orders: ["x"] }));
  const h1 = await hours();
  await kv3.put("confirm:within", J({ mins: 45, n: 30, at: new Date(Date.now() - 4 * 3600000).toISOString() }));
  const h2 = await hours();
  ok(J(h1.confirm) === J({ mins: 45, n: 30 }) && !("confirm" in h2) && "open" in h1,
    "GET /hours carries {mins, n} and nothing else, and drops a figure over three hours old: " + J([h1.confirm, h2.confirm]));
  ok(C.confirmView({ mins: 45, n: 9, at: new Date().toISOString() }) === null && C.confirmView({ mins: 7, n: 12, at: new Date().toISOString() }) === null,
    "and nothing under ten confirmations or under a quarter hour is carried");
  /* 20 Oct 2026 (his answer): the time between Place and Accept is counted in open minutes; placed 17:50 and agreed 09:10 the next morning
     on 09:00 to 18:00 is 20 open minutes (30 up to the quarter hour), never the 920 on the clock */
  const night = Array.from({ length: 10 }, (_, k) => mk(Date.parse("2026-10-12T09:50:00Z") + k * 86400000, 920));
  ok(J(C.confirmWithin(night, cfg)) === J({ mins: 30, n: 10 }), "a night closed between Place and Accept is not counted: " + J(C.confirmWithin(night, cfg)));
}
