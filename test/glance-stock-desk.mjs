/* test/glance-stock-desk.mjs: STOCK ON SALT ADMIN'S GLANCE, P2, THE DESK'S ROUTE (20 Oct 2026; docs/plan-admin-glance-stock.html, canvas V62).
 * What is proved here, each check red under its own mutation (test/glance-stock-desk.mutations.json):
 *   1  makerStock carries STOCK as it is: five figures a book, numbers or null, in the PRICING order, the desk's day, nothing else
 *   2  an unseeded mirror, or one with no STOCK, is an error and not an empty list
 *   3  the route, over a mirror seeded as the chain seeds it, answers each book's figures by GET to the bridge's capability alone
 * The expected figures are written out by hand, never computed by the code under test. */
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import desk from "../src/worker.js";
import { makerStock } from "../src/maker-inputs.js";
import { buildSeed } from "../tools/d1.mjs";

const STOCK = { today: "2026-10-20", v: "v9", books: { oil: { shelf: 45, free: 45, commit: 0, coverDays: 15.1, transit: 0, lot: "pX1", supplier: "SZ9-AAA" },
  salt: { shelf: 14.891, free: 13.39, commit: 1.5, coverDays: null, transit: 8 }, rice: { shelf: "9", free: 1, commit: 0, coverDays: 2, transit: 0 } } };
const PRICING = { byProduct: { salt: {}, oil: {}, rice: {} }, v: "v9" };

export async function run({ ok }) {
  /* 1 */
  const pure = makerStock({ sales: [], purchases: [], version: "v9", pricing: PRICING, state: { STOCK, PRICING } });
  ok(JSON.stringify(pure) === JSON.stringify({ today: "2026-10-20", books: {
    salt: { shelf: 14.89, free: 13.39, commit: 1.5, coverDays: null, transit: 8 },
    oil: { shelf: 45, free: 45, commit: 0, coverDays: 15.1, transit: 0 },
    rice: { shelf: null, free: 1, commit: 0, coverDays: 2, transit: 0 } } }),
  "makerStock carries STOCK as it is, five figures a book in the PRICING order, a figure that is not a number null, no lot or supplier: " + JSON.stringify(pure));
  /* 2 */
  ok(!!makerStock({ sales: [], state: {} }).error && !!makerStock({ sales: [], version: "v9", state: { PRICING } }).error,
    "an unseeded mirror, or one with no STOCK, is an error and not an empty list");
  /* 3 */
  const migrations = new URL("../migrations/", import.meta.url), db = new DatabaseSync(":memory:");
  for (const f of readdirSync(migrations).filter((x) => /^\d+_.*\.sql$/.test(x)).sort()) db.exec(readFileSync(new URL(f, migrations), "utf8"));
  db.exec(buildSeed({ v: "v9", stamped: null, ledger: { sales: [], purchases: [], PRICING, STOCK } }).sql);
  const D1 = { batch(statements) { return statements.map((s) => s.run()); }, prepare(sql) {
    const st = db.prepare(sql);
    const mk = (a) => ({ run() { return { meta: { changes: Number(st.run(...a).changes || 0) } }; },
      first() { const r = st.get(...a); return r === undefined ? null : r; }, all() { return { results: st.all(...a) }; } });
    const self = mk([]); self.bind = (...a) => mk(a); return self;
  } };
  const key = "glance-stock-local-capability-0123456789";
  const env = { SALT_LEDGER: D1, COUNTER_MAKER_KEY: key };
  const hit = (headers, method = "GET") => desk.fetch(new Request("https://desk.test/_internal/maker/stock", { method, headers }), env, { waitUntil() {} });
  const r = await hit({ "X-Counter-Maker-Key": key }), b = await r.json();
  ok(r.status === 200 && b.ok === true && b.version === "v9" && b.today === "2026-10-20" && Object.keys(b.books).join() === "salt,oil,rice"
    && b.books.salt.shelf === 14.89 && b.books.salt.transit === 8 && b.books.oil.coverDays === 15.1 && !("lot" in b.books.oil),
  "the route answers each book's figures off the seeded mirror: " + r.status + " " + JSON.stringify(b));
  ok((await hit({ "X-Counter-Maker-Key": key }, "POST")).status === 405, "the stock is read by GET alone");
  ok((await hit({ "X-Counter-Maker-Key": "x".repeat(40) })).status === 404 && (await hit({})).status === 404,
    "the Desk's end of the bridge answers the stock only to its capability");
  db.exec("DELETE FROM snapshot;");
  ok((await hit({ "X-Counter-Maker-Key": key })).status === 503, "a mirror being seeded answers 503, never an empty list");
}
