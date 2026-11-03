/* test/admin-orders-count.mjs: 3 Nov 2026 (his word, CN3-WM's book row and trip of salt and rice stood in Open, owing, and the Orders count left them out).
 * The Orders count on the rail and the bar is every open order the list holds: a site order still open, and a row of the book, an order of several books
 * or a buyer's same day not done or ended. Each check red under its own mutation (test/admin-orders-count.mutations.json); invented codes only (rule 2).
 *   1  the count on load, both the rail and the bar's chip, against the Open list it counts
 *   2  the count after the bars redraw alone (Needs you's draw, drawCounts)
 *   3  the count after the orders are read again (the five-second read, the list then the bars) */
import { richOwnerPage, byAct } from "./maker-act.mjs";

const D = "2026-10-05";
const site = (id, status, patch = {}) => ({ id, u: "u-cnt-" + id, product: "salt", qty: 1, total: 110, delivery: 0, paid: 0, moved: 0, mode: "collect", at: D + "T01:00:00.000Z", payments: [], msgs: [], history: [], status, ...patch });
const row = (rid, stage, patch = {}) => ({ rid, party: "CQ7-ZED", product: "salt", date: D, key: "k-" + rid, qty: 1, total: 110, delivery: 0, paid: 0, owed: 110, handed: 0, left: 1, waiting: 0, stage, ...patch });
const lines = (a, b) => [{ rid: a, key: "k-" + a, product: "salt", total: 130, delivery: 0 }, { rid: b, key: "k-" + b, product: "rice", total: 15, delivery: 0 }];
/* counted: the agreed site order, the agreed and the out-owing book rows, the trip owing, the same day agreed: five */
const ORDERS = [site("cnt-a", "acknowledged"), site("cnt-d", "done", { paid: 110, moved: 1 }), site("cnt-x", "placed", { u: "0000-0000", test: true })];
const ROWS = [row("cq1", "confirmed"), row("cq2", "paid", { qty: 2.5, total: 250, paid: 140, owed: 110, handed: 2.5, left: 0 }), row("cq3", "done", { paid: 110, owed: 0, handed: 1, left: 0 }),
  row("cq4", "ended", { cancelled: true, owed: 0 })];
const TRIPS = [{ trip: "t1792000000000", party: "CQ7-ZED", date: D, owed: 145, stage: "paid", lines: lines("cq5", "cq6") }];
const DAYS = [{ rids: ["cq7", "cq8"], party: "CQ8-ZED", date: D, owed: 145, stage: "confirmed", lines: lines("cq7", "cq8") },
  { rids: ["cq9", "cq10"], party: "CQ8-ZED", date: D, owed: 0, stage: "done", lines: lines("cq9", "cq10") }];

export async function run({ ok, pageWork }) {
  const p = await richOwnerPage({ pageWork, bare: true, review: (j) => ({ ...j, orders: ORDERS, drafts: [], queue: [], rows: ROWS, trips: TRIPS, sameDay: DAYS }) });
  try {
    await p.work.quiet();
    const d = p.d, rail = () => { const c = d.querySelector('.salt-rail [data-count="orders"]'); return c ? c.textContent : null; };
    const bar = () => { const c = d.querySelector('[data-act="bar.orders"] .salt-deskbar__n'); return c ? c.textContent : null; };
    const tap = async (act, key) => { const e = byAct(d, act, key); if (e) e.click(); await p.work.quiet(); return !!e; };
    /* 1 */
    await tap("nav.orders"); await tap("part.orders.open");
    const open = [...d.querySelectorAll('#makerOrderList [data-act="order.open"]')].filter((r) => { for (let e = r; e; e = e.parentElement) if (e.hidden) return false; return true; })
      .map((r) => r.getAttribute("data-key")).sort();
    ok(rail() === "5" && bar() === "5" && open.join() === ["cnt-a", "day:cq7+cq8", "row:cq1", "row:cq2", "trip:t1792000000000"].sort().join(),
      "the Orders count is every open order Open lists, the site order, the two book rows, the trip and the same day, never a done, ended or practice one: rail "
      + rail() + ", bar " + bar() + ", Open " + open.join());
    /* 2 */
    await tap("nav.needs");
    ok(rail() === "5", "the bars redrawn alone still count the book's open orders: " + rail());
    /* 3 */
    const t = p.intervals.filter((i) => i.ms === 5000 && !i.off)[0];
    d.querySelectorAll('.salt-rail [data-count="orders"]').forEach((c) => { c.textContent = ""; });
    await tap("nav.orders"); if (t) t.f(); await p.work.quiet();
    ok(rail() === "5", "and so does the list redrawn on the orders' read: " + rail());
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }
}
