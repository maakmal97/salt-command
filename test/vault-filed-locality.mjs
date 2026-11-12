/* test/vault-filed-locality.mjs: A LOCALITY ALREADY FILED IS PUBLIC, SO PLACE ON THE MAP MAY FILE IT AGAIN (12 Nov 2026, his
 * Place on the map for CI5-PER refused "A public locality must be on the official place list or gazetteer"). Salt Admin's Place
 * list carries the localities filed in PLACED (Permaisuri among them), which are public since v680; the Desk's vault check
 * knew only the official list, the areas and the gazetteer, so it refused a place the page itself offered.
 *   F1  the Desk Worker files a point whose locality is already filed beside another party's point, over the real routes
 *   F2  a locality neither official nor filed is still refused, and nothing is written to the pair
 *   F3  a filed locality is matched whole, never as a part of a longer word
 * Each check red under its own mutation (test/vault-filed-locality.mutations.json, run with tools/section.mjs). */
import { webcrypto } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { handleMaker } from "../stmt/maker.js";
import worker from "../src/worker.js";
import { officialVaultPoint } from "../src/vault-locality.js";

export async function run({ ok }) {
  const pass = "invented-vault-pass", key = "filed-locality-fixture-capability";
  const sqlite = new DatabaseSync(":memory:");
  for (const file of readdirSync(new URL("../migrations/", import.meta.url)).filter((f) => /^[0-9]+_.*[.]sql$/.test(f)).sort())
    sqlite.exec(readFileSync(new URL("../migrations/" + file, import.meta.url), "utf8"));
  const bound = (st, args) => ({
    run() { return { meta: { changes: Number(st.run(...args).changes) } }; },
    first() { return st.get(...args) || null; }, all() { return { results: st.all(...args) }; }
  });
  const d1 = {
    batch(list) {
      sqlite.exec("BEGIN IMMEDIATE");
      try { const result = list.map((s) => s.run()); sqlite.exec("COMMIT"); return result; }
      catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
    prepare(sql) { const st = sqlite.prepare(sql); return Object.assign(bound(st, []), { bind: (...a) => bound(st, a) }); }
  };
  const state = (k, v) => sqlite.prepare("INSERT OR REPLACE INTO state(key,doc) VALUES (?,?)").run(k, JSON.stringify(v));
  state("PRODUCTS", { salt: { name: "salt" } });
  state("PRICING", { tierNames: [], byProduct: { salt: { stockCost: 40, inputs: { policy: { tierRule: { fixed: true } } } } } });
  state("roster", ["CX1-FIK", "CX2-QOR"]); state("associates", []);
  /* an invented locality word, filed for one party, that is on no official list, area or gazetteer */
  state("PLACED", { "CX2-QOR": [3.1, 101.71, "Zorvenhill"] });
  sqlite.exec("INSERT INTO snapshot(one,v,stamped) VALUES (1,'filed-locality-fixture',NULL)");
  const crypt = async (value) => {
    const salt = webcrypto.getRandomValues(new Uint8Array(16)), iv = webcrypto.getRandomValues(new Uint8Array(12));
    const base = await webcrypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
    const aes = await webcrypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 1000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
    return { v: 1, salt: Buffer.from(salt).toString("base64"), iv: Buffer.from(iv).toString("base64"),
      ct: Buffer.from(await webcrypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, new TextEncoder().encode(JSON.stringify(value)))).toString("base64") };
  };
  const names = await crypt({ "CX1-FIK": "Invented Person", "CX2-QOR": "Invented Other" });
  sqlite.prepare("INSERT INTO vault_pair(one,revision,names,places,updated) VALUES (1,1,?,?,?)")
    .run(JSON.stringify(names), JSON.stringify(await crypt({ _base: { addr: "Invented base", lat: 3.1, lng: 101.7 } })), "2026-11-12T01:00:00.000Z");
  const map = new Map();
  const kv = {
    get: async (k, type) => { const v = map.get(k) ?? null; return type === "json" && v ? JSON.parse(v) : v; },
    put: async (k, v) => { map.set(k, v); }, delete: async (k) => { map.delete(k); },
    list: async ({ prefix = "" } = {}) => ({ keys: [...map.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true })
  };
  const deskEnv = { SALT_LEDGER: d1, SALT_QUEUE: kv, COUNTER_MAKER_KEY: key, REQUIRE_ACCESS: "0", VAULT_STORE: "pair" };
  const counterEnv = { STMT: kv, COUNTER_MAKER_KEY: key, DESK_MAKER: { fetch: (request) => worker.fetch(request, deskEnv, { waitUntil() {} }) } };
  const route = "/all/maker/inputs/place";
  const place = async (at, locality) => {
    const revision = sqlite.prepare("SELECT revision FROM vault_pair").get().revision;
    const places = await crypt({ _base: { addr: "Invented base", lat: 3.1, lng: 101.7 }, "CX1-FIK": { addr: "Invented lane", lat: 3.0976, lng: 101.7127, src: "google" } });
    const body = { at, places: { "CX1-FIK": [3.1, 101.71, locality] }, addrVault: places, pair: { expectedRevision: revision, names, places } };
    const res = await handleMaker(new Request("https://counter.test" + route, { method: "POST", body: JSON.stringify(body) }), counterEnv, route, { email: "maakmal97@icloud.com" });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
  const revision = () => sqlite.prepare("SELECT revision FROM vault_pair").get().revision;
  try {
    /* F1 */
    const filed = await place("2026-11-12T02:00:00.000Z", "Zorvenhill");
    ok(filed.status === 200 && filed.body.ok === true && revision() === 2
      && sqlite.prepare("SELECT COUNT(*) n FROM draft WHERE id=?").get("2026-11-12T02:00:00.000Z").n === 1,
      "F1 a point whose locality is already filed for another party is filed, the pair moved and its draft made: " + JSON.stringify(filed));
    /* F2 */
    const before = revision(), stranger = await place("2026-11-12T02:01:00.000Z", "Quellbrook");
    ok(stranger.status === 400 && /official place list or gazetteer/.test(stranger.body.error || "") && revision() === before,
      "F2 a locality neither official nor filed is still refused, nothing written: " + JSON.stringify(stranger));
    /* F3 */
    const parts = await Promise.all([[3.1, 101.71, "Zorvenhill Utara"], [3.1, 101.71, "Zorven"], [3.1, 101.71, " zorvenhill "]]
      .map((p) => officialVaultPoint(p, { "CX2-QOR": [3.1, 101.71, "Zorvenhill"] })));
    ok(JSON.stringify(parts) === "[false,false,true]",
      "F3 a filed locality is matched whole, as the place key reads it, never inside a longer word: " + JSON.stringify(parts));
  } catch (e) { ok(false, "the filed-locality section stopped on an error: " + (e && e.stack || e)); }
}
