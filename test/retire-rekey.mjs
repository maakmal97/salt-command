/* test/retire-rekey.mjs: THE PER-MINUTE rekeyOrders IS RETIRED, ledgerKeyOf STAYS THE READER (21 Nov 2026, docs/plan-ledger-simplify.html item 1).
 * The V4a pass that gave an old-shape order its product tail ran and its mark `orders:keyed` read `product`; the minute no longer reads it.
 *   R1  a scheduled tick over an order holding an old-shape key asks the site for no list of every order, writes no mark on the store and
 *       leaves the order's key as it was (the roads read it through ledgerKeyOf)
 *   R2  ledgerKeyOf still gives an old shape its tail on another book and changes nothing else
 * Every assertion is red under its own mutation (test/retire-rekey.mutations.json). Codes and usernames invented. */
import { placeOrder, deskMove } from "../stmt/orders.js";
import { ledgerKeyOf } from "../engine/stages.mjs";

class KV {
  constructor() { this.m = new Map(); }
  async put(k, v) { this.m.set(k, v); }
  async get(k, t) { if (!this.m.has(k)) return null; const r = this.m.get(k); return t === "json" ? JSON.parse(r) : r; }
  async delete(k) { this.m.delete(k); }
  async list({ prefix = "" } = {}) { return { keys: [...this.m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; }
}
const J = JSON.stringify;
export async function run({ ok }) {
  const stmtW = (await import("../stmt/worker.js")).default, deskW = (await import("../src/worker.js")).default;
  const U = "rkrk-mmmm", CODE = "CV9-KZ", OLDK = CODE + "|2026-09-20|120", realLog = console.log;
  const skv = new KV(), dkv = new KV(), asked = [];
  const senv = { STMT: skv, STMT_DESK_KEY: "desk-key" };
  const denv = { SALT_QUEUE: dkv, STMT_DESK_KEY: "desk-key", STMT_SITE: { fetch: async (url, init) => {
    const u = new URL(url); asked.push(((init && init.method) || "GET") + " " + u.pathname + u.search);
    return stmtW.fetch(new Request(url, init), senv);
  } } };
  await dkv.put("stmt-users", J({ [U]: CODE }));
  const o = (await placeOrder(senv, U, { product: "oil", qty: 1, mode: "collect", unit: 120, total: 120, week: "" })).order;
  await deskMove(senv, U, o.id, { status: "acknowledged", mode: "collect" });
  await deskMove(senv, U, o.id, { mark: { ledgerKey: OLDK, ack: "2026-09-20T01:00:00.000Z" } });
  const keyOn = async () => {
    const r = await stmtW.fetch(new Request("https://stmt/desk/orders?all=1", { headers: { "X-Stmt-Desk": "desk-key" } }), senv);
    return ((await r.json()).orders.find((x) => x.id === o.id) || {}).ledgerKey;
  };
  asked.length = 0;
  const w = [];
  console.log = () => {};
  try { for (const t of ["2026-11-21T02:07:00Z", "2026-11-21T02:08:00Z"]) await deskW.scheduled({ cron: "* * * * *", scheduledTime: Date.parse(t) }, denv, { waitUntil: (p) => w.push(p) }); await Promise.all(w); }
  finally { console.log = realLog; }
  const during = asked.slice();
  ok(!during.includes("GET /desk/orders?all=1") && !during.some((a) => a.startsWith("POST /desk/orders/") && a.endsWith("/" + o.id)),
    "R1 two scheduled ticks ask the site for no list of every order and mark no order's key: " + J(during));
  ok((await dkv.get("orders:keyed")) === null && (await keyOn()) === OLDK,
    "R1 and write no mark on the store, the old-shape order keeping its key as it was: " + J({ mark: await dkv.get("orders:keyed"), key: await keyOn() }));

  ok(ledgerKeyOf({ ledgerKey: OLDK, product: "oil" }) === OLDK + "|oil" && ledgerKeyOf({ ledgerKey: OLDK, product: "salt" }) === OLDK
      && ledgerKeyOf({ ledgerKey: OLDK + "|oil", product: "oil" }) === OLDK + "|oil" && ledgerKeyOf({}) === null,
    "R2 ledgerKeyOf gives an old shape on another book its tail and leaves salt's key and a tailed key as they are");
}
