/* test/admin-ac-cost.mjs: SALT ADMIN, WHAT THE GOODS COST ON THE BILL (20 Oct 2026; canvas V22 and V27, his rule that a figure which does not add
 * up has no line of its own). What is proved here, each check red under its own mutation (test/admin-ac-cost.mutations.json):
 *   1  Goods' sub-label is the cost: the Desk's trade reading a unit (its latestCogs, through the hop the trade form reads), times the units,
 *      "Cost RM 36.00, incl. freight"; while placed, "At the list price · cost RM 36.00, incl. freight"
 *   2  it is asked once an order, as a sale of that product, size and total, and a redraw of the card asks nothing more
 *   3  a book with no cost, or a read that fails, says no cost
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage, byAct } from "./maker-act.mjs";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const base = { u: "abcd-efgh", delivery: 0, msgs: [], history: [], payments: [], paid: 0, mode: "collect", at: "2026-10-10T02:00:00.000Z" };
const extra = [
  { ...base, id: "ord-cp", status: "placed", product: "salt", qty: 5, total: 58 },
  { ...base, id: "ord-ca", status: "acknowledged", product: "salt", qty: 5, total: 58 },
  { ...base, id: "ord-cn", status: "acknowledged", product: "oil", qty: 2, total: 36 },
  { ...base, id: "ord-cf", status: "acknowledged", product: "rice", qty: 1, total: 20 }
];

export async function run({ ok, pageWork }) {
  /* the oil read is held back while oilGate stands: the harness answers a test's own route before its gates, so the hold is the answer's own */
  let oilGate = null, oilGo = null;
  const p = await richOwnerPage({ pageWork, review: (j) => ({ ...j, orders: (j.orders || []).concat(extra) }),
    extra: (route, body) => route !== "/all/maker/trade-reading" ? undefined
      : body.product === "rice" ? { refuse: "No reading" } : body.product === "oil" && oilGate ? oilGate : { ok: true, reading: { cogs: { rate: body.product === "salt" ? 7.2 : null, source: "the latest purchase" } } } });
  try {
    await p.work.quiet();
    const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); };
    const reads = () => p.posts.filter((x) => x.route === "/all/maker/trade-reading");
    const sub = (id) => t(p.card(id) && p.card(id).querySelector(".ordmoney [data-cost]"));
    await click(byAct(d, "nav.orders")); await click(byAct(d, "part.orders.placed")); await click(byAct(d, "order.open", "ord-cp"));
    /* 1 */
    ok(sub("ord-cp") === "At the list price · cost RM 36.00, incl. freight", "while placed, Goods is at the list price and says what it cost: " + sub("ord-cp"));
    await click(byAct(d, "part.orders.confirmed")); await click(byAct(d, "order.open", "ord-ca"));
    ok(sub("ord-ca") === "Cost RM 36.00, incl. freight", "agreed, Goods says what it cost, the cost a unit times the units: " + sub("ord-ca"));
    /* 2 */
    const mine = reads().filter((x) => x.body && x.body.product === "salt");
    ok(mine.length === 2 && JSON.stringify(mine[0].body) === JSON.stringify({ direction: "sale", product: "salt", qty: 5, total: 58 }),
      "each order asks once, as a sale of its product, size and total: " + JSON.stringify(mine.map((x) => x.body)));
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
