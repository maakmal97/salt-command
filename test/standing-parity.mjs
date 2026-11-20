/* test/standing-parity.mjs: THE ENGINE'S accountStanding IS THE STATEMENT'S OWN READING (20 Nov 2026, docs/plan-admin-live-owed.html P4).
 * Salt Admin's card reads owed, goods to hand over and agreed live off the Book through the engine's accountStanding; the customer's
 * statement reads them through make_statements' stmtRows and accountTotals. Two readers of one figure drift in silence, so:
 *   S1  every party on the live book, to today: owed, goods and agreed equal to the sen (goods to four places)
 *   S2  the same on the suite's frozen book, to today and to a day inside it
 *   S3  the same on every practice account's invented book (tools/testfix.mjs)
 *   S4  the cases the rule turns on are on those books, so the parity is not vacuous: an agreed row, a cancelled row, a gift or
 *       written-off row, a bucket's row and a row dated after the day read
 * Every assertion is red under its own mutation (test/standing-parity.mutations.json). */
import E from "../engine/position.mjs";
import { partyTotalsFor, klToday } from "../tools/make_statements.mjs";
import { buildAll } from "../tools/testfix.mjs";
import { liveBook, frozenBook } from "./frozen.mjs";

const J = JSON.stringify;
export async function run({ ok }) {
  const owners = (book) => [...new Set((book.sales || []).map((s) => s && s.customer).filter((c) => typeof c === "string" && c).map((c) => E.ownerCode(c)))];
  const diff = (book, to) => {
    const out = [];
    for (const p of owners(book)) {
      const a = E.accountStanding(book.sales, p, to), t = partyTotalsFor(book, p, to);
      const b = { owed: +t.owed.toFixed(2), toGet: +t.toGet.toFixed(4), pend: +t.pend.toFixed(2) };
      const bad = [a.owed, a.toGet, a.pend, b.owed, b.toGet, b.pend].some((x) => typeof x !== "number" || !Number.isFinite(x));
      if (bad || Math.abs(a.owed - b.owed) > 0.004 || Math.abs(a.toGet - b.toGet) > 0.00005 || Math.abs(a.pend - b.pend) > 0.004) out.push({ p, engine: a, statement: b });
    }
    return out;
  };
  const today = klToday(new Date()), live = liveBook(), frozen = frozenBook();
  const d1 = diff(live, today);
  ok(owners(live).length > 10 && !d1.length, "S1: every party on the live book stands as their statement reads it: " + J(d1.slice(0, 3)));
  const dates = (frozen.sales || []).map((s) => s.date).filter(Boolean).sort(), mid = dates[Math.floor(dates.length / 2)];
  const d2 = diff(frozen, today).concat(diff(frozen, mid));
  ok(owners(frozen).length > 10 && !d2.length, "S2: and on the frozen book, to today and to " + mid + ": " + J(d2.slice(0, 3)));
  const fx = Object.values(buildAll(new Date())), d3 = fx.flatMap((x) => diff(x.book, today));
  ok(fx.length >= 3 && !d3.length, "S3: and on every practice account's book: " + J(d3.slice(0, 3)));
  const all = [live, frozen, ...fx.map((x) => x.book)].flatMap((b) => b.sales || []);
  const has = {
    agreed: all.some((s) => E.txStat(s).order === "Pending"), cancelled: all.some((s) => E.txStat(s).order === "Cancelled"),
    giftOrOff: all.some((s) => s.goodwill || s.defaulted), bucket: all.some((s) => E.isBucket(s.customer)),
    later: (frozen.sales || []).some((s) => s.date && s.date > mid && E.txStat(s).order !== "Pending")
  };
  ok(Object.values(has).every(Boolean), "S4: the books carry every case the rule turns on: " + J(has));
  /* S5: the check itself sees a figure that is not a number: an agreed row with no total, which the statement sums as NaN */
  const odd = { sales: [{ rid: "x1", customer: "PQ1-ZZZ", product: "salt", date: "2026-11-30", qty: 1, cash: 0, deliveredQty: 0, pending: true }], customerRefunds: [] };
  ok(diff(odd, today).length === 1, "S5: the parity check refuses a figure that is not a number: " + J(diff(odd, today)));
}
