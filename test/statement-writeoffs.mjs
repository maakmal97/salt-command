import { FROZEN_BOOK } from "./frozen.mjs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import E from "../engine/position.mjs";
import { liveFor, stmtRows, partyTotals, liveStatement, klToday } from "../tools/make_statements.mjs";

export function statementWriteoffChecks(ok) {
  const now = new Date("2026-10-03T00:00:00Z");
  const base = { rid: "fixture", customer: "AA1-AAA", date: "2026-10-01",
    qty: 2, total: 120, deliveredQty: 2, defaulted: true };
  const footer = doc => Object.fromEntries([...doc.body.slice(doc.body.indexOf('<div class="tot'))
    .matchAll(/<div class="tr[^"]*"><span[^>]*>([^<]*)<\/span><span[^>]*>([^<]*)<\/span><\/div>/g)]
    .map(m => [m[1], m[2] === "nil" ? 0 : +m[2].replace(/RM |,/g, "")]));
  for (const [name, patch] of [
    ["unpaid", {}],
    ["partial cash", { cash: 30 }],
    ["delivery", { delivery: 20 }],
    ["cash, in-kind and delivery", { cash: 30, settledRM: 10, delivery: 20 }]
  ]) {
    const doc = liveFor({ sales: [{ ...base, ...patch }], customerRefunds: [] },
      base.customer, now, "fixture-user");
    ok(doc && doc.owed === 0 && doc.pay.now.rm === 0,
      "a written-off " + name + " row owes nothing in the live document or To pay now");
    ok(footer(doc)["Written off"] === E.txWrittenOff({ ...base, ...patch }),
      "the " + name + " footer names the engine's actual written-off deduction");
  }
  const pending = liveFor({ sales: [{ ...base, defaulted: false, pending: true,
    deliveredQty: 0, delivery: 20 }], customerRefunds: [] }, base.customer, now, "fixture-user");
  ok(pending && pending.owed === 0 && /to be collected and paid/.test(pending.body),
    "a pending intention still owes nothing and keeps its ordered display");
  const ready = liveFor({ sales: [{ ...base, defaulted: false, pending: true,
    deliveredQty: 0, cash: 30, delivery: 20 }], customerRefunds: [] }, base.customer, now, "fixture-user");
  ok(ready && ready.owed === 110 && ready.pay.now.rm === 0,
    "a part-paid ready order keeps its whole remaining balance, not only handed-over credit");
  const live = liveFor({ sales: [{ ...base, defaulted: false, cash: 30,
    settledRM: 10, delivery: 20 }], customerRefunds: [] }, base.customer, now, "fixture-user");
  ok(live && live.owed === 100 && live.pay.now.rm === 100,
    "a non-defaulted handed order still owes goods plus delivery less cash and in-kind");
  const mixed = liveFor({ sales: [{ ...base, rid: "off", cash: 30, settledRM: 10, delivery: 20 },
    { ...base, rid: "on", defaulted: false, cash: 30, settledRM: 10, delivery: 20 }],
    customerRefunds: [] }, base.customer, now, "fixture-user");
  ok(mixed && mixed.owed === 100,
    "the live aggregate counts the active balance once and no written-off balance");
  ok(footer(mixed)["Written off"] === 100 && footer(mixed).Paid === 80,
    "the aggregate footer deducts one write-off without erasing either row's cash or in-kind");
  const partial = liveFor({ sales: [{ ...base, deliveredQty: 1 }], customerRefunds: [] },
    base.customer, now, "fixture-user");
  ok(partial && /written off/.test(partial.body) && !/paid in full/.test(partial.body),
    "zeroing a write-off labels it written off, never paid in full");
  ok(footer(partial)["Written off"] === 60
    && footer(partial)["Not handed over on written-off orders"] === 60,
    "a partial handover distinguishes the actual loss from the balance never handed over");

  const book = JSON.parse(readFileSync(FROZEN_BOOK, "utf8"));
  const parties = [...new Set(book.sales.map(s => s.customer).filter(c => c && !E.isBucket(c)))];
  const date = klToday(new Date());
  const options = { from: null, to: date, completed: true, open: true, pending: true, dates: true };
  let defaults = 0, bad = 0, aggregate = 0, expected = 0, summaryBad = 0;
  for (const party of parties) {
    const rows = stmtRows(party, options);
    let want = 0;
    for (const row of rows) {
      const source = book.sales.find(s => s.rid === row.rid);
      if (!source) { bad++; continue; }
      if (source.defaulted) { defaults++; if (row.owed !== 0) bad++; }
      const balance = E.txOwed(source) - (source.cash || 0) - (source.settledRM || 0);
      const gift = !!source.goodwill || (!!source.rebate && !(source.cash > 0.009) && balance <= 0.009);
      if (!source.defaulted && !source.cancelled && !gift && E.txStat(source).order !== "Pending")
        want += Math.max(0, +balance.toFixed(2));
    }
    const totals = partyTotals(party, date);
    const doc = liveStatement(party, new Date(), "fixture-user");
    if (Math.abs(totals.owed - want) > 0.011 || (doc && Math.abs(doc.owed - want) > 0.011)) summaryBad++;
    aggregate += totals.owed; expected += want;
  }
  ok(defaults > 0 && bad === 0, "every current written-off statement row carries zero owed, exercised on the book");
  ok(summaryBad === 0 && Math.abs(aggregate - expected) < 0.011,
    "Review totals and sealed-live owed reconcile across every current party, excluding write-offs");
}
