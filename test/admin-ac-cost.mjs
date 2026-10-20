/* test/admin-ac-cost.mjs: SALT ADMIN, WHAT THE GOODS COST ON THE BILL (20 Oct 2026; canvas V22 and V27, his rule that a figure which does not add
 * up has no line of its own). What is proved here, each check red under its own mutation (test/admin-ac-cost.mutations.json):
 *   1  Goods' sub-label is the cost: the Desk's trade reading a unit (its latestCogs, through the hop the trade form reads), times the units,
 *      "Cost RM 36.00, incl. freight"; while placed, "At the list price · cost RM 36.00, incl. freight"
 *   2  it is asked once an order, a GET that sends nothing, as a sale of that product, size and total, an agreed one on the day it was
 *      agreed (Kuala Lumpur), and a redraw of the card asks nothing more
 *   3  a book with no cost, or a read that fails, says no cost
 *   4  the Counter relays the GET to the Desk's reading as the trade form's body: the four fields and a day, nothing else carried
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage, byAct } from "./maker-act.mjs";
import { handleMaker } from "../stmt/maker.js";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const base = { u: "abcd-efgh", delivery: 0, msgs: [], history: [], payments: [], paid: 0, mode: "collect", at: "2026-10-10T02:00:00.000Z" };
const extra = [
  { ...base, id: "ord-cp", status: "placed", product: "salt", qty: 5, total: 58 },
  { ...base, id: "ord-ca", status: "acknowledged", product: "salt", qty: 5, total: 58, history: [{ status: "acknowledged", at: "2026-10-10T03:00:00.000Z" }] },
  { ...base, id: "ord-cn", status: "acknowledged", product: "oil", qty: 2, total: 36 },
  { ...base, id: "ord-cf", status: "acknowledged", product: "rice", qty: 1, total: 20 }
];

export async function run({ ok, pageWork }) {
  /* 4: the Counter relays the GET to the Desk's own reading as the body the trade form posts, the four fields and a day, nothing else */
  const hops = [];
  const env = { COUNTER_MAKER_KEY: "k".repeat(40), DESK_MAKER: { fetch: async (r) => { hops.push({ path: new URL(r.url).pathname, method: r.method, body: await r.json() }); return new Response(JSON.stringify({ ok: true, reading: { cogs: { rate: 7.2 } } })); } } };
  const url = "/all/maker/trade-reading?direction=sale&product=salt&qty=5&total=58&date=2026-10-10&party=CX1-ZED";
  const res = await (await handleMaker(new Request("https://counter.test" + url), env, "/all/maker/trade-reading", { email: "maakmal97@icloud.com" })).json();
  ok(res.reading && res.reading.cogs.rate === 7.2 && hops.length === 1 && hops[0].path === "/_internal/maker/trade-reading" && hops[0].method === "POST"
    && JSON.stringify(hops[0].body) === JSON.stringify({ direction: "sale", product: "salt", qty: 5, total: 58, date: "2026-10-10" }),
    "the Counter relays his GET to the Desk's reading as the trade form's body, the four fields and a day and nothing else: " + JSON.stringify(hops));
  /* the oil read is held back while oilGate stands: the harness answers a test's own route before its gates, so the hold is the answer's own */
  let oilGate = null, oilGo = null;
  const p = await richOwnerPage({ pageWork, review: (j) => ({ ...j, orders: (j.orders || []).concat(extra) }),
    extra: (route) => { if (!route.startsWith("/all/maker/trade-reading?")) return undefined; const body = Object.fromEntries(new URL(route, "https://x.test").searchParams);
      return 0 ? 0
      : body.product === "rice" ? { refuse: "No reading" } : body.product === "oil" && oilGate ? oilGate : { ok: true, reading: { cogs: { rate: body.product === "salt" ? 7.2 : null, source: "the latest purchase" } } }; } });
  try {
    await p.work.quiet();
    const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); };
    const reads = () => p.wire.filter((x) => x.startsWith("/all/maker/trade-reading?")).map((x) => ({ method: x.split(" ")[1], body: Object.fromEntries(new URL(x.split(" ")[0], "https://x.test").searchParams) }));
    const sub = (id) => t(p.card(id) && p.card(id).querySelector(".ordmoney [data-cost]"));
    await click(byAct(d, "nav.orders")); await click(byAct(d, "part.orders.placed")); await click(byAct(d, "order.open", "ord-cp"));
    /* 1 */
    ok(sub("ord-cp") === "At the list price · cost RM 36.00, incl. freight", "while placed, Goods is at the list price and says what it cost: " + sub("ord-cp"));
    await click(byAct(d, "part.orders.confirmed")); await click(byAct(d, "order.open", "ord-ca"));
    ok(sub("ord-ca") === "Cost RM 36.00, incl. freight", "agreed, Goods says what it cost, the cost a unit times the units: " + sub("ord-ca"));
    /* 2 */
    const mine = reads().filter((x) => x.body && x.body.product === "salt");
    ok(mine.length === 2 && mine.every((x) => x.method === "GET") && JSON.stringify(mine[0].body) === JSON.stringify({ direction: "sale", product: "salt", qty: "5", total: "58" })
      && mine[1].body.date === "2026-10-10" && !p.posts.some((x) => /trade-reading/.test(x.route)),
      "each order asks once, a read that sends nothing, as a sale of its product, size and total, an agreed one on the day it was agreed: " + JSON.stringify(mine.map((x) => x.body)));
    await click(byAct(d, "order.open", "ord-ca")); await click(byAct(d, "order.open", "ord-ca"));
    ok(reads().filter((x) => x.body && x.body.product === "salt").length === 2 && sub("ord-ca") === "Cost RM 36.00, incl. freight", "and a redraw asks nothing more");
    /* 2, while its read is still out: a redraw asks nothing more either */
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    oilGate = new Promise((r) => { oilGo = () => r({ ok: true, reading: { cogs: { rate: null } } }); });
    const release = () => { oilGate = null; oilGo(); };
    byAct(d, "order.open", "ord-cn").click(); await sleep(30); byAct(d, "order.open", "ord-ca").click(); await sleep(30); byAct(d, "order.open", "ord-cn").click(); await sleep(30);
    const oil = reads().filter((x) => x.body && x.body.product === "oil").length;
    release(); await p.work.quiet();
    ok(oil === 1, "a redraw while the read is still out asks nothing more: " + oil);
    /* 3 */
    const cn = p.card("ord-cn") ? sub("ord-cn") : null;
    await click(byAct(d, "order.open", "ord-cf"));
    ok(sub("ord-cf") === "" && cn === "", "a book with no cost, or a read that fails, says no cost: " + JSON.stringify([cn, sub("ord-cf")]));
  } finally { p.w.close(); }
}
