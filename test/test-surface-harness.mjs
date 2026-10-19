/* test/test-surface-harness.mjs: the Desk and the Counter wired as live, for the test surface's checks (his answers of 18 Oct 2026).
   The Counter's KV and order book, the Desk's queue KV and a D1 that records every statement and answers none, the maker bridge, the
   Desk's site binding, an Access JWT signed for him or for anyone, and a test account's fixture put where the publish puts it. */
import { webcrypto } from "node:crypto";
import desk from "../src/worker.js";
import counter from "../stmt/worker.js";
import { orderBook } from "./orderbook-harness.mjs";
import { FIX_VERSION, fixKey } from "../stmt/testfix.js";

export class Store {
  values = new Map();
  writes = 0;
  async get(key, type) {
    const value = this.values.get(key) ?? null;
    return value === null || type !== "json" ? value : JSON.parse(value);
  }
  async put(key, value) { this.writes++; this.values.set(key, value); }
  async delete(key) { this.writes++; this.values.delete(key); }
  async list({ prefix = "" } = {}) {
    return { keys: [...this.values.keys()].filter((name) => name.startsWith(prefix)).map((name) => ({ name })), list_complete: true };
  }
}

/* each surface signs with its own key under its own kid: the Access check keeps keys by issuer and kid for the process, and the sections share one */
let surfaces = 0;
export async function surface(opts = {}) {
  const store = new Store(), queue = new Store(), team = "surface-fixture", audience = opts.audience ?? "surface-audience", kid = "surface-key-" + (++surfaces);
  const signing = await webcrypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const publicKey = await webcrypto.subtle.exportKey("jwk", signing.publicKey);
  const env = { STMT: store, ACCESS_TEAM: team, ACCESS_AUD: audience, STMT_MASTER: "surface-local-master",
    STMT_DESK_KEY: "surface-desk-test-capability-00001", COUNTER_MAKER_KEY: "surface-maker-test-capability-0001", ORDER_STORE: "object" };
  const harness = orderBook(env); env.ORDERBOOK = harness.ns;
  const sqls = [];
  const d1 = { prepare(sql) {
    const q = { bind() { return q; },
      async first() { sqls.push(sql); return null; },
      async run() { sqls.push(sql); return {}; },
      async all() { sqls.push(sql); return { results: [] }; } };
    return q;
  } };
  const deskEnv = { SALT_QUEUE: queue, SALT_LEDGER: d1, COUNTER_MAKER_KEY: env.COUNTER_MAKER_KEY, STMT_DESK_KEY: env.STMT_DESK_KEY,
    STMT_SITE: { fetch: (url, init) => counter.fetch(new Request(url, init), env) } };
  const bridge = [];
  env.DESK_MAKER = { fetch: (request) => {
    bridge.push(new URL(request.url).pathname);
    return desk.fetch(request, deskEnv, {});
  } };
  const certs = "https://" + team + ".cloudflareaccess.com/cdn-cgi/access/certs";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url) === certs) return Response.json({ keys: [{ ...publicKey, kid }] });
    throw new Error("Unexpected test-surface fixture request: " + url);
  };
  const token = async (email) => {
    const header = Buffer.from(JSON.stringify({ alg: "RS256", kid })).toString("base64url");
    const claims = Buffer.from(JSON.stringify({ iss: "https://" + team + ".cloudflareaccess.com", aud: [audience || "surface-audience"], email,
      exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url");
    return header + "." + claims + "." + Buffer.from(await webcrypto.subtle.sign("RSASSA-PKCS1-v1_5",
      signing.privateKey, new TextEncoder().encode(header + "." + claims))).toString("base64url");
  };
  const jwt = await token("maakmal97@icloud.com");
  /* a request to the Counter as he makes it (his JWT), or with any other token, or none */
  const owner = (path, body, auth = jwt, method = "POST", headers = {}) => counter.fetch(new Request("https://counter.fixture.test" + path, {
    method, headers: { ...(auth ? { "cf-access-jwt-assertion": auth } : {}), "content-type": "application/json", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  }), env);
  /* a request straight to the Desk's private maker route, with the capability or another */
  const deskCall = (path, body, key = env.COUNTER_MAKER_KEY) => desk.fetch(new Request("https://desk.fixture.test" + path, {
    method: "POST", headers: { "X-Counter-Maker-Key": key, "content-type": "application/json" }, body: JSON.stringify(body) }), deskEnv, {});
  /* a test account made and its fixture put where the publish puts it */
  const putFixture = async (u, fix) => {
    const salt = "surface-wrap-" + u;
    await store.put("u:" + u, JSON.stringify({ test: true, wrap: { salt } }));
    await store.put(fixKey(u), JSON.stringify({ v: FIX_VERSION, salt, at: "2026-10-18T07:00:00.000Z", env: { iv: "surface-iv-" + u },
      claims: [], orders: [], makerBook: { sales: [] }, ...fix }));
  };
  const close = () => { globalThis.fetch = originalFetch; };
  return { env, deskEnv, store, queue, harness, sqls, bridge, token, jwt, owner, deskCall, putFixture, close, desk, counter };
}
