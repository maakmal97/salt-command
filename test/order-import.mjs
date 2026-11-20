/* test/order-import.mjs: AN OLDER SALE BECOMES A SITE ORDER, BORN TOLD (20 Nov 2026, docs/plan-order-import.html, Part 1: the pure rule).
 *   I1  a settled salt row's order, every field; I2 a non-salt key carries its product tail; I3 a -R row is the associate's order for a friend
 *   I4  a trip of two lines is one sheet, the carrying line first, the delivery on it alone
 *   I5  each refusal, with its reason
 *   I6  a trip with one bad line refuses both
 *   I7  importPlan over the frozen book: no row twice, no id twice, and orderWork owes every order nothing
 * Every group is red under its own mutation (test/order-import.mutations.json). */
import { readFileSync } from "node:fs";
import POSITION_ENGINE from "../engine/position.mjs";
import { importOf, importPlan, tripCarrier } from "../engine/stages.mjs";
import { orderWork } from "../stmt/orders.js";
import { frozenBook, liveBook } from "./frozen.mjs";

const J = JSON.stringify;
const row = (o) => Object.assign({ customer: "CQ4-ZEN", date: "2026-11-10", product: "salt", qty: 2, total: 190, delivery: 15, cash: 205, deliveredQty: 2,
  deliveredOn: "2026-11-11", handover: "delivered", rid: "s401", road: "hand" }, o || {});
const ctx = (o) => Object.assign({ users: { "CQ4-ZEN": "abcd-efgh" }, orders: [], onWay: new Set(), test: new Set(["0000-0000"]) }, o || {});
const why = (r, c) => importOf(row(Object.assign({ rid: "s402" }, r)), ctx(c)).refused;

export async function run({ ok }) {
  /* I1 */
  const r = importOf(row({ credit: 5 }), ctx()), o = r.order || {};
  const at = "2026-11-09T16:00:00.000Z";
  ok(J(o) === J({ id: "20261110000000-i401", u: "abcd-efgh", status: "done", product: "salt", qty: 2, total: 190, delivery: 15, mode: "deliver", forFriend: false,
    credit: 5, movedOn: "2026-11-11", at, imported: true, rid: "s401", ledgerKey: "CQ4-ZEN|2026-11-10|205", rateAsk: at, payments: [], msgs: [], claimed: 0,
    history: [{ at, status: "done", by: "import" }], paid: 200, moved: 2, queued: { ack: at, paid: 200, moved: 2 } }), "I1: a settled salt row's order, every field: " + J(r));
  ok(!o.queued.close && !o.queued.redate && !o.queued.cancel && !o.closed && /^[0-9]{14}-[a-z0-9]{1,8}$/.test(o.id), "I1: never closed, redated or cancelled, and an id of the site's shape");
  const col = importOf(row({ rid: "s403", delivery: 0, handover: "collected", deliveredOn: undefined, cash: 190 }), ctx()).order;
  ok(col && col.mode === "collect" && col.movedOn === "2026-11-10" && col.paid === 190, "I1: no charge and collected is a collection, moved on the row's own day: " + J(col));
  ok(POSITION_ENGINE.ovKey(row()) === o.ledgerKey, "I1: the key is the engine's own");

  /* I2 */
  const oil = importOf(row({ rid: "s404", product: "oil", delivery: 0, cash: 190 }), ctx()).order;
  ok(oil && oil.product === "oil" && oil.ledgerKey === "CQ4-ZEN|2026-11-10|190|oil", "I2: a non-salt key has its product tail: " + J(oil && oil.ledgerKey));

  /* I3 */
  const fr = importOf(row({ rid: "s405", customer: "CA3-PJ-R" }), ctx({ users: { "CA3-PJ-R": "ca3p-pjpj" } })).order;
  ok(fr && fr.forFriend === true && fr.u === "ca3p-pjpj" && fr.ledgerKey.startsWith("CA3-PJ-R|"), "I3: a -R row is the associate's order, for a friend: " + J(fr));

  /* I4 */
  const tripRows = [row({ rid: "s410", trip: "t1791145053619", delivery: 0, cash: 190 }), row({ rid: "s411", trip: "t1791145053619", product: "rice", total: 10, qty: 2, delivery: 40, cash: 50 })];
  const tp = importPlan({ sales: tripRows }, ctx());
  const [a, b] = tp.orders;
  ok(tp.orders.length === 2 && !tp.refused.length && a.rid === "s411" && b.rid === "s410" && a.sheet === b.sheet && /^[A-Za-z0-9_-]{16,64}$/.test(a.sheet) && a.id < b.id,
    "I4: a trip of two lines is one sheet, the carrying line first: " + J(tp));
  ok(a.delivery === 40 && b.delivery === 0 && a.mode === "deliver" && b.mode === "deliver", "I4: the delivery rides the carrying line alone, both lines deliver");
  ok(tripCarrier(b, tp.orders).rid === "s411", "I4: the engine's own tripCarrier names the carrying line");

  /* I5 */
  const R = (re, got, what) => ok(re.test(got || ""), "I5: " + what + ": " + got);
  R(/reward/, why({ road: "fold", goodwill: true }), "a fold gift");
  R(/purchase/, importOf({ supplier: "X", rid: "p1" }, ctx()).refused, "a purchase");
  R(/cancelled/, why({ cancelled: true }), "cancelled");
  R(/written off/, why({ defaulted: true, cash: 0 }), "written off");
  R(/owing/, why({ cash: 100 }), "owing money");
  R(/owing/, why({ deliveredQty: 1 }), "owing goods");
  R(/test/, why({}, { users: { "CQ4-ZEN": "0000-0000" } }), "a test account");
  R(/username/, why({}, { users: {} }), "no username");
  const pair = importPlan({ sales: [row({ rid: "s420" }), row({ rid: "s421" })] }, ctx());
  ok(!pair.orders.length && pair.refused.length === 2 && /shares its key/.test(pair.refused[0].why), "I5: a key two live rows share refuses both: " + J(pair.refused));
  const live = importPlan({ sales: [row({ rid: "s420" }), row({ rid: "s421", cancelled: true })] }, ctx());
  ok(!live.orders.length && live.refused.some((r) => /another sale, cancelled, shares its key/.test(r.why)), "I5: a live row beside a cancelled twin on its key is refused, saying so: " + J(live.refused));
  const key = POSITION_ENGINE.ovKey(row());
  R(/names it/, why({}, { orders: [{ id: "x1", u: "abcd-efgh", ledgerKey: key, product: "salt" }] }), "named by an order's key");
  R(/names it/, why({ product: "oil", delivery: 0, cash: 190 }, { orders: [{ id: "x2", u: "abcd-efgh", ledgerKey: "CQ4-ZEN|2026-11-10|190", product: "oil" }] }), "named by an old untailed key");
  R(/names it/, why({}, { orders: [{ id: "x3", u: "abcd-efgh", rid: "s402", status: "done" }] }), "named by rid");
  R(/no row/, why({}, { orders: [{ id: "x4", u: "abcd-efgh", status: "placed", at: "2026-11-10T03:00:00.000Z" }] }), "their live order that day naming no row");
  R(/no row/, why({}, { orders: [{ id: "x5", u: "abcd-efgh", status: "done", at: "2026-11-10T03:00:00.000Z" }] }), "their done order that day naming no row");
  ok(why({}, { orders: [{ id: "x7", u: "abcd-efgh", status: "cancelled", at: "2026-11-10T03:00:00.000Z" }] }) === undefined, "I5: a cancelled order that day is no bar");
  ok(why({}, { orders: [{ id: "x5", u: "abcd-efgh", status: "placed", at: "2026-11-12T03:00:00.000Z" }, { id: "x6", u: "other", status: "placed", at: "2026-11-10T03:00:00.000Z" }] }) === undefined,
    "I5: a live order of another day, or of another account, is no bar");
  R(/on its way/, why({}, { onWay: new Set(["s402"]) }), "money on its way, by rid");
  R(/on its way/, why({}, { onWay: new Set([key]) }), "a yes on its way, by key");

  /* I6 */
  const mixed = importPlan({ sales: [tripRows[0], Object.assign({}, tripRows[1], { cash: 20 })] }, ctx());
  ok(!mixed.orders.length && mixed.refused.length === 2 && /owing/.test(mixed.refused[0].why + mixed.refused[1].why), "I6: a trip with one bad line refuses both: " + J(mixed.refused));
  const two = importPlan({ sales: [tripRows[0], tripRows[1], Object.assign({}, tripRows[0], { rid: "s412", product: "oil", delivery: 5 })] }, ctx());
  ok(!two.orders.length && two.refused.length === 3 && /delivery/.test(two.refused[0].why), "I6: a trip the engine faults refuses every line: " + J(two.refused));

  /* I7 */
  const users = JSON.parse(readFileSync(new URL("../statements/_users.json", import.meta.url), "utf8"));
  const fu = Object.assign({}, users); for (const c of Object.keys(users)) fu[c + "-R"] = users[c];
  const world = { users: fu, orders: [], onWay: new Set(), test: new Set(["0000-0000", "0000-0001", "0000-0002"]) };
  const plan = importPlan(frozenBook(), world);
  const rids = plan.orders.map((x) => x.rid), ids = plan.orders.map((x) => x.id);
  ok(plan.orders.length > 50 && new Set(rids).size === rids.length && new Set(ids).size === ids.length && !plan.refused.some((x) => rids.includes(x.rid)),
    "I7: the frozen book imports no row twice, no id twice: " + plan.orders.length);
  const bad = plan.orders.filter((x) => orderWork(x).length);
  ok(plan.orders.length && !bad.length, "I7: orderWork owes the book nothing for every imported order: " + J(bad.slice(0, 2)));

  /* the real book, reported and never asserted */
  const lp = importPlan(liveBook(), world), by = {};
  for (const x of lp.refused) { const k = x.why.replace(/ \(.*\)/, ""); by[k] = (by[k] || 0) + 1; }
  console.log("order-import over the real book: imported " + lp.orders.length + ", refused " + lp.refused.length + " " + J(by));
}
