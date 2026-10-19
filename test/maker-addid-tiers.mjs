import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { openMaster } from "../tools/payload.mjs";
import { makerLedgerInput } from "../src/maker-inputs.js";
import { handleMaker } from "../stmt/maker.js";
import worker from "../src/worker.js";

/* A3: Maker's Add ID starts a customer on a % lift on salt's Set Price (18 Oct 2026; once a level), as the Desk's Add ID does: inside the addid entry. */
export async function run({ ok }) {
  const at = "2026-10-05T08:00:00.000Z";
  const seal = (label) => ({ v: 1, salt: Buffer.alloc(16).toString("base64"),
    iv: Buffer.alloc(12).toString("base64"), ct: Buffer.from(label.padEnd(16, ".")).toString("base64") });
  const pricing = { byProduct: {
    salt: { stockCost: 40, inputs: { policy: { tierRule: { drift: true } } } },
    oil: { stockCost: 8, inputs: { policy: { tierRule: { fixed: true } } } } } };
  const book = () => ({ version: 1, sales: [], purchases: [], pricing,
    state: { PRODUCTS: { salt: { name: "salt" }, oil: { name: "oil" } }, roster: ["CX1-ZED"], associates: [], PEOPLE: { departed: [] } } });
  const add = (patch = {}) => makerLedgerInput("add-id", { at, code: "CZ4-TST", kind: "customer", parent: null,
    geo: [3.1, 101.7, "Pudu"], tiers: { salt: 0.5 }, unit: "pct", vault: seal("names"), ...patch }, book());

  /* the Desk's own Add ID, the live master, for the same input */
  const { w } = await openMaster();
  try {
  } finally { w.close(); }
  const none = add({ tiers: null });
  ok(!none.error && none.entry.payload.tiers === null, "a registration with no starting tier is unchanged");
  /* 19 Oct 2026: a starting % travels with its unit; a page cached from before the % lift sends none, and it is refused here by unit, not by time */
  const unitless = add({ unit: undefined }), oldUnit = add({ unit: "drift" });
  ok(/Reload (Salt|Counter) Admin/.test(unitless.error || "") && !unitless.entry && !!oldUnit.error && add().entry.payload.unit === "pct" && !add({ tiers: null, unit: undefined }).error && add({ tiers: null }).entry.payload.unit === undefined,
    "a starting % with no unit pct is refused with a message to reload Salt Admin, a registration with none needs no unit, and a starting % carries unit pct in the entry: " + JSON.stringify([unitless.error, oldUnit.error]));
  ok(!!add({ tiers: { oil: 0.5 } }).error && !!add({ tiers: { salt: 0.5, oil: 0.5 } }).error,
    "a starting tier on a fixed book is refused, alone or beside a tiered one");
  ok(!!add({ tiers: { salt: "Bronze" } }).error && !!add({ tiers: { salt: { small: "Gold" } } }).error
    && !!add({ tiers: { salt: null } }).error && !!add({ tiers: {} }).error && !!add({ tiers: { spare: "Gold" } }).error,
    "a starting tier with a bad shape, a band set, a null or an unknown book is refused");
  ok(!!add({ kind: "supplier", tiers: { salt: 0.5 } }).error
    && !!add({ kind: "downstream", parent: "CX1-ZED", tiers: { salt: 0.5 } }).error
    && !add({ kind: "reseller", tiers: { salt: 0.5 } }).error,
    "only a customer or an associate takes a starting tier");
  ok(/holds a starting %/.test(add({ kind: "supplier", tiers: { salt: 0.5 } }).error)
    && /holds a starting %/.test(add({ kind: "downstream", parent: "CX1-ZED", tiers: { salt: 0.5 } }).error),
    "a tier on a supplier or downstream is an input error naming the rule, not a drafter skip");

  /* owner auth: the typed route forwards for the verified owner and for no one else */
  const key = "maker-addid-tiers-capability-0001", calls = [];
  const env = { STMT: { get: async () => null, put: async () => {} }, COUNTER_MAKER_KEY: key,
    DESK_MAKER: { fetch: async (request) => { calls.push({ path: new URL(request.url).pathname, body: await request.json() });
      return new Response(JSON.stringify({ ok: true })); } } };
  const body = { at, code: "CZ4-TST", kind: "customer", parent: null, geo: [3.1, 101.7, "Pudu"], tiers: { salt: 0.5 }, unit: "pct", vault: seal("names") };
  const send = (identity) => handleMaker(new Request("https://counter.test/all/maker/inputs/add-id", { method: "POST", body: JSON.stringify(body) }),
    env, "/all/maker/inputs/add-id", identity);
  const denied = await send({ email: "other@example.test" }), anon = await send(undefined);
  const allowed = await send({ email: "maakmal97@icloud.com" });
  ok(denied.status === 403 && anon.status === 403 && allowed.status === 200 && calls.length === 1
    && calls[0].path === "/_internal/maker/inputs/add-id" && JSON.stringify(calls[0].body.tiers) === '{"salt":0.5}',
    "Add ID with starting tiers reaches the Desk only for the verified owner, and the tiers travel unchanged");

  /* the real Worker, pair vault: a retry lands once, a changed tier under the same id is refused */
  const sqlite = new DatabaseSync(":memory:");
  for (const file of readdirSync(new URL("../migrations/", import.meta.url)).filter((f) => /^[0-9]+_.*[.]sql$/.test(f)).sort())
    sqlite.exec(readFileSync(new URL("../migrations/" + file, import.meta.url), "utf8"));
  const bound = (st, args) => ({ run() { return { meta: { changes: Number(st.run(...args).changes) } }; },
    first() { return st.get(...args) || null; }, all() { return { results: st.all(...args) }; } });
  const d1 = { batch(list) { sqlite.exec("BEGIN IMMEDIATE");
    try { const r = list.map((s) => s.run()); sqlite.exec("COMMIT"); return r; } catch (e) { sqlite.exec("ROLLBACK"); throw e; } },
    prepare(sql) { const st = sqlite.prepare(sql); return Object.assign(bound(st, []), { bind: (...a) => bound(st, a) }); } };
  const state = (k, v) => sqlite.prepare("INSERT INTO state(key,doc) VALUES (?,?)").run(k, JSON.stringify(v));
  state("PRODUCTS", { salt: {}, oil: {} }); state("PRICING", pricing);
  sqlite.prepare("INSERT INTO snapshot(one,v,stamped) VALUES (1,'maker-fixture',NULL)").run();
  sqlite.prepare("INSERT INTO vault_pair(one,revision,names,places,updated) VALUES (1,1,?,?,?)")
    .run(JSON.stringify(seal("n")), JSON.stringify(seal("p")), at);
  const map = new Map();
  const kv = { get: async (k) => map.get(k) ?? null, put: async (k, v) => { map.set(k, v); }, delete: async (k) => { map.delete(k); },
    list: async ({ prefix = "" } = {}) => ({ keys: [...map.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
  const wenv = { SALT_LEDGER: d1, SALT_QUEUE: kv, COUNTER_MAKER_KEY: key, REQUIRE_ACCESS: "0", VAULT_STORE: "pair" };
  const post = (b) => worker.fetch(new Request("https://desk.test/_internal/maker/inputs/add-id", { method: "POST",
    headers: { "content-type": "application/json", "X-Counter-Maker-Key": key }, body: JSON.stringify(b) }), wenv, { waitUntil() {} });
  const input = { at, code: "CZ4-TST", kind: "customer", parent: null, geo: [3.1, 101.7, "Pudu"], tiers: { salt: 0.5 }, unit: "pct",
    vault: seal("nn"), addrVault: seal("pp"), pair: { expectedRevision: 1, names: seal("nn"), places: seal("pp") } };
  const first = await post(input), replay = await post(input), changed = await post({ ...input, tiers: { salt: 1 } });
  const fixed = await post({ ...input, at: "2026-10-05T08:01:00.000Z", code: "CZ5-TST", tiers: { oil: 0.5 } });
  const row = sqlite.prepare("SELECT entry FROM draft WHERE id=?").get(at);
  ok(first.status === 200 && (await replay.json()).replay === true && changed.status === 409 && fixed.status === 400
    && sqlite.prepare("SELECT COUNT(*) AS n FROM draft").get().n === 1
    && JSON.stringify(JSON.parse(row.entry).payload.tiers) === '{"salt":0.5}' && JSON.parse(row.entry).payload.unit === "pct"
    && sqlite.prepare("SELECT revision FROM vault_pair").get().revision === 2,
    "the real Worker drafts Add ID with its starting tier once on retry, refuses a changed tier under the same id and a fixed book before any write");
}
