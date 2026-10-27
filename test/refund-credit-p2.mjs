/* test/refund-credit-p2.mjs: A REFUND BECOMES THEIR CREDIT, the engine and the fold (27 Oct 2026, docs/plan-refund-credit.html P2). Every open
 * refund of theirs is credit (the engine's creditOf), less what every unfolded Accept already carries; the fold closes what an Accept spent,
 * oldest first, a part split keeping its rid, and a replay changes nothing (setOffCredit); refundStale also flags a set-off whose row was later
 * paid less; the Worker reads what is on its way from the drafts and the queue, a rejected one released (src/credit.js). Each check is proved
 * red by its own mutation (test/refund-credit-p2.mutations.json). Invented codes beside the live s296 shape.
 *   1  creditOf: their open refunds, own code and bucket; less what is on its way; a bucket spends none; never under nought
 *   2  setOffCredit: a refund used whole is closed and marked; a replay is byte-equal
 *   3  oldest first, a part split keeping the rid, the rest open; refundOnOverpay raises nothing more on the rid after it
 *   4  what no open refund covers is said
 *   5  refundStale flags a set-off whose row was later paid less
 *   6  the fold books it: applyEntry on a credited sale closes the refund and says so
 *   7  creditOnWay: a pending draft and a queued entry count, a rejected draft and a queued entry already drafted do not */
import { creditOnWay, creditFor } from "../src/credit.js";

const J = JSON.stringify;

export async function run({ ok }) {
  const { default: PE } = await import("../engine/position.mjs");
  const ENG = await import("../engine/apply.mjs");
  const { nextRid } = await import("../tools/rid.mjs");
  const r296 = () => ({ party: "CZ4-MK", rid: "s296", amount: 25, since: "2026-10-27", note: "order s296 paid RM 480 against RM 455 it comes to: RM 25 payable back to the customer." });

  /* 1 */
  ok(PE.creditOf([r296()], "CZ4-MK", []) === 25, "CZ4-MK's open RM 25 refund is RM 25 of credit");
  ok(PE.creditOf([r296(), { party: "CZ4-MK", amount: 20, since: "2026-08-26", paidOn: "2026-09-21" }], "CZ4-MK", []) === 25, "a refund paid out (paidOn) is not credit");
  ok(PE.creditOf([r296(), { party: "CZ4-MK-R", rid: "s9", amount: 5, since: "2026-10-20" }, { party: "CY2-NIL", amount: 7 }], "CZ4-MK", []) === 30,
    "their own code's and their bucket's open refunds are theirs, another party's are not");
  ok(PE.creditOf([r296()], "CZ4-MK", [{ party: "CZ4-MK", credit: 25 }]) === 0 && PE.creditOf([r296()], "CZ4-MK", [{ party: "CZ4-MK", credit: 10 }, { party: "CY2-NIL", credit: 9 }]) === 15,
    "credit an unfolded Accept carries is not spent twice; another party's is not theirs");
  ok(PE.creditOf([r296()], "CZ4-MK", [{ party: "CZ4-MK", credit: 40 }]) === 0, "never under nought");
  ok(PE.creditOf([r296(), { party: "CZ4-MK-R", amount: 5 }], "CZ4-MK-R", []) === 0, "an order booked to their bucket spends none: their refunds pay their own orders only");

  /* 2 */
  {
    const list = [r296()], row = { rid: "s300", customer: "CZ4-MK", qty: 1, total: 100, cash: 25, credit: 25, date: "2026-10-28" };
    const so = PE.setOffCredit(list, row, row.date);
    ok(so && so.spent.length === 1 && so.short === 0 && list.length === 1 && list[0].paidOn === "2026-10-28" && list[0].setOff === "s300" && list[0].amount === 25 && list[0].rid === "s296",
      "a refund used whole is closed on the row's day and marked with the row it paid: " + J({ so, list }));
    const once = J(list), again = PE.setOffCredit(list, row, row.date);
    ok(J(list) === once && again && again.replay === true && again.spent.length === 0, "a replay finds the mark and changes nothing, byte for byte: " + J(again));
    ok(PE.creditOf(list, "CZ4-MK", []) === 0, "once closed it is credit no more");
  }

  /* 3 */
  {
    const list = [r296(), { party: "CZ4-MK", rid: "s250", amount: 10, since: "2026-10-01", note: "older" }];
    const row = { rid: "s301", customer: "CZ4-MK", qty: 1, total: 100, cash: 20, credit: 20, date: "2026-10-28" };
    const so = PE.setOffCredit(list, row, row.date);
    const s250 = list.find((r) => r.rid === "s250"), on296 = list.filter((r) => r.rid === "s296");
    const used = on296.find((r) => r.setOff === "s301"), rest = on296.find((r) => !r.paidOn);
    ok(so && s250.paidOn === "2026-10-28" && s250.setOff === "s301" && on296.length === 2 && used && used.amount === 10 && rest && rest.amount === 15,
      "oldest first: the RM 10 of 01 Oct whole, then RM 10 of s296's RM 25 split off and closed, RM 15 left open: " + J(list));
    ok(on296.reduce((a, r) => a + r.amount, 0) === 25 && PE.refundOnOverpay(list, { rid: "s296", customer: "CZ4-MK", qty: 5, total: 455, cash: 480 }, "2026-10-28") === null,
      "both parts keep the rid, so s296 still carries RM 25 of refunds and the fold raises nothing more on it");
    const once = J(list);
    PE.setOffCredit(list, row, row.date);
    ok(J(list) === once && PE.creditOf(list, "CZ4-MK", []) === 15, "a replay of the split changes nothing, and RM 15 stays theirs");
  }

  /* 4 */
  {
    const list = [r296()], so = PE.setOffCredit(list, { rid: "s302", customer: "CZ4-MK", qty: 1, total: 100, cash: 50, credit: 50, date: "2026-10-28" }, "2026-10-28");
    ok(so && so.short === 25 && list[0].setOff === "s302", "credit past every open refund is closed as far as it goes and the RM 25 short said: " + J(so));
  }

  /* 5 */
  {
    const list = [Object.assign(r296(), { paidOn: "2026-10-28", setOff: "s300" })];
    ok(PE.refundStale(list, { rid: "s296", customer: "CZ4-MK", qty: 5, total: 455, cash: 480 }) === 0, "a set-off the row still owes is not stale");
    ok(PE.refundStale(list, { rid: "s296", customer: "CZ4-MK", qty: 5, total: 455, cash: 455 }) === 25, "a set-off whose row was later paid less is flagged");
    ok(PE.refundStale([{ party: "CZ4-MK", rid: "s296", amount: 25, paidOn: "2026-10-28" }], { rid: "s296", customer: "CZ4-MK", qty: 5, total: 455, cash: 455 }) === 0,
      "one paid out in cash stays the hand's, as before");
  }

  /* 6 */
  {
    const book = { STATED_STOCK: 10, COUNT_ON: {}, COUNTS: [], NOTES: {}, PROD_OPENING: {}, purchases: [], roster: ["CZ4-MK"], QUEUE_COMMITTED: "",
      sales: [{ rid: "s296", customer: "CZ4-MK", qty: 5, total: 455, cash: 480, deliveredQty: 5, date: "2026-10-27" }], customerRefunds: [r296()] };
    const sale = { id: "q-c1", status: "approved", collection: "sales", row: { customer: "CZ4-MK", date: "2026-10-28", qty: 1, total: 100, cash: 25, credit: 25, deliveredQty: 0 } };
    const res = ENG.applyEntry(book, { id: "q-c1", append: "sales" }, { nextRid, staged: { approved: [sale] }, notes: { version: "v1", rows: { "q-c1": { note: "credited sale" } } }, moves: [] });
    const row = book.sales.at(-1);
    ok(row.rid === "s297" && row.credit === 25 && book.customerRefunds[0].setOff === "s297" && book.customerRefunds[0].paidOn === "2026-10-28"
      && res.moves.some((m) => /credit set off: CZ4-MK RM 25 of the refund on s296, on s297/.test(m)),
      "the fold books the credited sale and closes s296's refund against it, saying so: " + J({ moves: res.moves, refunds: book.customerRefunds }));
  }

  {
    const book = { STATED_STOCK: 10, COUNT_ON: {}, COUNTS: [], NOTES: {}, PROD_OPENING: {}, purchases: [], roster: ["CZ4-MK"], QUEUE_COMMITTED: "", sales: [],
      customerRefunds: [Object.assign(r296(), { paidOn: "2026-10-27" })] };
    const sale = { id: "q-c2", status: "approved", collection: "sales", row: { customer: "CZ4-MK", date: "2026-10-28", qty: 1, total: 100, cash: 25, credit: 25, deliveredQty: 0 } };
    const res = ENG.applyEntry(book, { id: "q-c2", append: "sales" }, { nextRid, staged: { approved: [sale] }, notes: { version: "v1", rows: { "q-c2": { note: "x" } } }, moves: [] });
    const row = book.sales.at(-1);
    ok(row.cash === 0 && !("credit" in row) && res.moves.some((m) => /CREDIT SHORT on s0*1: RM 25/.test(m)),
      "credit no open refund covers comes off the row's cash, and the fold says so (Fable): " + J({ row, moves: res.moves }));
    ok(PE.setOffCredit([r296()], { rid: "s9", customer: "CZ4-MK", credit: 25 }, null).undated === true, "an undated row closes nothing");
  }

  /* 7: the Worker's read, on a stub D1 and KV */
  {
    const e = (at, credit, party) => ({ at, status: "Pending", payload: { mode: "new", direction: "SELL", party: party || "CZ4-MK", credit, cash: credit } });
    const drafts = [{ id: "a1", status: "pending", entry: J(e("a1", 10)) }, { id: "a2", status: "rejected", entry: J(e("a2", 7)) }, { id: "a3", status: "approved", committed_at: null, entry: J(e("a3", 3)) }];
    const kv = new Map([["q:orders:a4", J({ queue: [e("a4", 5)] })], ["q:orders:a2", J({ queue: [e("a2", 7)] })], ["q:phone", J({ queue: [e("p1", 50)] })]]);
    const env = {
      SALT_LEDGER: { prepare(sql) { return { bind(...a) { return { async all() {
        if (/status='pending'/.test(sql)) return { results: drafts.filter((d) => d.status === "pending" || (d.status === "approved" && !d.committed_at)).filter((d) => d.entry.includes('"credit":')) };
        if (/WHERE id IN/.test(sql)) return { results: drafts.filter((d) => a.includes(d.id)).map((d) => ({ id: d.id })) };
        return { results: [] }; } }; } }; } },
      SALT_QUEUE: { async list({ prefix }) { return { keys: [...kv.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; }, async get(k) { return kv.get(k) || null; } }
    };
    const way = await creditOnWay(env, { at: "2026-10-27T00:00:00.000Z" });
    ok(way.map((x) => x.at).sort().join() === "a1,a3,a4", "on its way: a pending draft, an approved one not yet folded and a queued entry no draft holds; never a rejected draft or another device's queue: " + J(way.map((x) => x.at)));
    const c = await creditFor(env, { customerRefunds: [r296(), { party: "CZ4-MK", rid: "s250", amount: 20, since: "2026-10-01" }] }, "CZ4-MK", way);
    ok(c === 27, "their RM 45 of open refunds less the RM 18 on its way leaves RM 27 to spend: " + c);
  }
}
