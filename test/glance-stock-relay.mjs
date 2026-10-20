/* test/glance-stock-relay.mjs: STOCK ON SALT ADMIN'S GLANCE, P3, THE COUNTER'S RELAY (20 Oct 2026; docs/plan-admin-glance-stock.html, canvas V62).
 * What is proved here, each check red under its own mutation (test/glance-stock-relay.mutations.json):
 *   1  /all/maker/stock asks the Desk's stock by GET over the bridge and carries its figures as they came
 *   2  beside each book, the day he expects its next lot from this site's KV `expected`, today or later in Kuala Lumpur; a passed day, a
 *      malformed one or an unread store is no day, and the figures stand
 *   3  only the verified owner, by GET; under /all/test a fixed example answers and no Desk is called */
import { handleMaker } from "../stmt/maker.js";

class Store {
  constructor(v, fail) { this.v = v; this.fail = fail; }
  async get(key, type) { if (this.fail) throw new Error("kv down"); const v = this.v.get(key) ?? null; return v === null || type !== "json" ? v : JSON.parse(v); }
}
const kl = (ms) => new Date(Date.now() + ms).toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });

export async function run({ ok }) {
  const books = { salt: { shelf: 14.89, free: 13.39, commit: 1.5, coverDays: 2.6, transit: 8 }, oil: { shelf: 45, free: 45, commit: 0, coverDays: 15.1, transit: 0 },
    candy: { shelf: 6, free: 6, commit: 0, coverDays: null, transit: 0 }, rice: { shelf: 15, free: 15, commit: 0, coverDays: 10.3, transit: 0 } };
  const hops = [];
  const today = kl(0), later = kl(5 * 864e5), passed = kl(-2 * 864e5);
  const envOf = (store) => ({ COUNTER_MAKER_KEY: "k".repeat(40), STMT: store,
    DESK_MAKER: { fetch: async (r) => { hops.push({ path: new URL(r.url).pathname, method: r.method, key: r.headers.get("X-Counter-Maker-Key") });
      return new Response(JSON.stringify({ ok: true, version: "v9", today: "2026-10-20", books })); } } });
  const owner = { email: "maakmal97@icloud.com" };
  const call = (env, init, identity = owner, opts) => handleMaker(new Request("https://counter.test/all/maker/stock", init || {}), env, "/all/maker/stock", identity, opts);
  const store = new Store(new Map([["expected", JSON.stringify({ salt: later, oil: passed, candy: "soon", rice: today })]]));
  /* 1 */
  const res = await call(envOf(store)), b = await res.json();
  ok(res.status === 200 && b.ok === true && hops.length === 1 && hops[0].path === "/_internal/maker/stock" && hops[0].method === "GET" && hops[0].key === "k".repeat(40)
    && JSON.stringify(b.books) === JSON.stringify(books) && b.today === "2026-10-20",
  "his read asks the Desk's stock by GET over the bridge and carries its figures as they came: " + JSON.stringify(hops) + " " + JSON.stringify(b).slice(0, 160));
  /* 2 */
  ok(b.by && b.by.salt === later && b.by.rice === today && b.by.oil === null && b.by.candy === null,
    "beside each book the day its next lot is expected, kept today or later in Kuala Lumpur, a passed or malformed day none: " + JSON.stringify(b.by));
  const down = await (await call(envOf(new Store(new Map(), true)))).json();
  ok(down.ok === true && Object.values(down.by).every((v) => v === null) && down.books.salt.shelf === 14.89,
    "an unread store drops the dates, never the figures: " + JSON.stringify(down.by));
  /* 3 */
  const n = hops.length;
  ok((await call(envOf(store), {}, { email: "other@example.test" })).status === 403 && (await call(envOf(store), { method: "POST", body: "{}" })).status === 405
    && hops.length === n, "only the verified owner, and by GET alone, reaches the Desk");
  const t = await call(envOf(store), {}, owner, { test: true }), tb = await t.json();
  ok(t.status === 200 && tb.test === true && tb.books.salt.shelf === 12 && tb.books.salt.transit === 20 && tb.by.salt === kl(3 * 864e5) && hops.length === n,
    "under /all/test a fixed example answers, its day three days on, and no Desk is called: " + JSON.stringify(tb));
}
