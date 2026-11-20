/* test/admin-live-owed.mjs: SALT ADMIN'S THEY OWE IS THE DESK'S (20 Nov 2026, docs/plan-admin-live-owed.html, his yes to its picks).
 * The engine's accountStanding, by the statement's own row rule, on an invented book:
 *   E1  a bucket's row counts to its owner          E2  a written-off row owes nought, its goods still counted
 *   E3  a cancelled row's goods are not counted      E4  an agreed row is not owed; agreed is its goods total, no delivery
 *   E5  a row dated after the day read is out, an agreed row whatever its date is in
 * The Desk's answer (makerInputCatalog):
 *   D1  standing names today and one row per owner, no bucket, each the engine's figure
 * Salt Admin's card:
 *   O1  owed the statement has not sealed shows at once     O2  a payment clears it, and the card says what their page still shows
 *   O3  an agreed order alone reads Agreed, never Owed      O4  a code the list does not name keeps its sealed figures
 *   O5  no list keeps the sealed figures, and no mark shows where the two agree
 *   O6  a Desk read that fails takes the live figures back to the sealed ones
 *   O7  the mark names their page's own word and figure, an agreed order as agreed
 * Every assertion is red under its own mutation (test/admin-live-owed.mutations.json). */
import E from "../engine/position.mjs";
import { makerInputCatalog } from "../src/maker-inputs.js";
import { richOwnerPage, enter } from "./maker-act.mjs";
import { frozenBook } from "./frozen.mjs";

const J = JSON.stringify;
export async function run({ ok, pageWork }) {
  /* ---- the engine ---- */
  const row = (p) => ({ rid: "r" + Math.random().toString(36).slice(2, 8), customer: "AQ1-ZZZ", product: "salt", date: "2026-11-10", qty: 2, total: 100, delivery: 10, cash: 0, deliveredQty: 2, ...p });
  const sales = [
    row({ customer: "AQ1-ZZZ-R", total: 40, delivery: 0 }),                                  /* E1: 40 owed through the bucket */
    row({ defaulted: true, deliveredQty: 1 }),                                               /* E2: owes nought, 1 unit to hand over */
    row({ cancelled: true, cancelledOn: "2026-11-11", deliveredQty: 0 }),                    /* E3: nothing */
    row({ date: "2026-11-30", deliveredQty: 0, total: 60, delivery: 5, cash: 0, pending: true, agreedOn: "2026-11-09" }),
    row({ date: "2026-11-25", total: 30, delivery: 0 })                                       /* E5: after the day read */
  ];
  const st = (to) => E.accountStanding(sales, "AQ1-ZZZ", to), a = st("2026-11-20"), stat = sales.map((s) => E.txStat(s).order);
  ok(a.owed === 40, "E1: a bucket's row counts to its owner, the written-off and later rows out: " + J([a, stat]));
  ok(a.toGet === 1, "E2, E3: the written-off row's goods count, the cancelled row's do not: " + J(a));
  ok(stat[3] === "Pending" && a.pend === 60, "E4: an agreed row is not owed, and agreed is its goods total without delivery: " + J([a, stat[3]]));
  ok(st("2026-11-26").owed === 70 && st("2026-11-26").pend === 60, "E5: read to a later day the later row is in, the agreed row in either way: " + J(st("2026-11-26")));
  /* E6: goodwill handed over with nothing paid is a gift: nothing owed, as the statement says "No charge" */
  const gift = row({ customer: "AQ2-ZZZ", goodwill: true, total: 80, delivery: 0 }), g = E.accountStanding([gift], "AQ2-ZZZ", "2026-11-20");
  ok(E.txStat(gift).order !== "Pending" && g.owed === 0 && g.pend === 0, "E6: goodwill with nothing paid owes nothing: " + J([g, E.txStat(gift).order]));

  /* ---- the Desk ---- */
  const { pricingFromBook } = await import("../engine/book-inputs.mjs");
  const book = frozenBook(), desk = { ...book, state: book, pricing: pricingFromBook(book, new Date("2026-10-20T04:00:00Z")), version: "v1" };
  const cat = makerInputCatalog(desk, {}, [], [], "2026-10-20"), rows = (cat.standing && cat.standing.rows) || [];
  const owners = (book.roster || []).filter((c) => !E.isBucket(c));
  const same = rows.every((r) => J(E.accountStanding(book.sales, r.party, "2026-10-20")) === J({ owed: r.owed, toGet: r.toGet, pend: r.pend }));
  ok(cat.standing && cat.standing.today === "2026-10-20" && rows.length === owners.length && rows.every((r) => !E.isBucket(r.party)) && same && rows.some((r) => r.owed > 0),
    "D1: standing names the day and one row per owner, each the engine's figure: " + J({ today: cat.standing && cat.standing.today, n: rows.length, owners: owners.length, same }));

  /* ---- Salt Admin ---- */
  const acct = (u, code, t, flag) => ({ username: u, code, account: true, t: Object.assign({ owed: 0, toGet: 0, refund: 0, pend: 0 }, t), flag,
    seen: { opens: 1, last: "2026-10-10T02:00:00.000Z", how: "link" }, sent: "2026-10-10T02:00:00.000Z", issued: "2026-10-01" });
  const open = async (standing) => {
    const p = await richOwnerPage({ pageWork, probe: true,
      sheetAnswer: (j) => ({ ...j, at: "2026-11-20T01:30:00.000Z", accounts: [
        acct("2222-0001", "CQ1-AAA", {}, "clear"),
        acct("2222-0002", "CQ2-BBB", { owed: 100 }, "owes"),
        acct("2222-0003", "CQ3-CCC", {}, "clear"),
        acct("2222-0004", "CQ4-DDD", { owed: 30 }, "owes"),
        acct("2222-0005", "CQ5-EEE", { owed: 100 }, "owes"),
        acct("2222-0006", "CQ6-FFF", { pend: 40 }, "pend")] }),
      inputsAnswer: (j) => { const c = { ...j.catalog }; if (standing) c.standing = standing; else { delete c.standing; c.openRefunds = []; } return { ...j, catalog: c }; } });
    await p.work.quiet(); enter(p.d, "customers", "accounts"); await p.work.quiet(); await p.work.quiet();
    return p;
  };
  const rowOf = (p, code) => [...p.d.querySelectorAll("#rlist [data-u]")].find((c) => (c.querySelector(".acode") || {}).textContent === code);
  const card = (p, code) => { const r = rowOf(p, code); return r ? r.textContent.replace(/\s+/g, " ") : ""; };
  const opened = async (p, code) => { const r = rowOf(p, code); if (r) { r.querySelector('[data-act="acct.open"]').click(); await p.work.quiet(); await p.work.quiet(); }
    const m = p.d.querySelector("[data-differs]"); return m ? m.textContent : ""; };

  let p = await open({ today: "2026-11-20", rows: [{ party: "CQ1-AAA", owed: 70, toGet: 0, pend: 0 }, { party: "CQ2-BBB", owed: 0, toGet: 0, pend: 0 },
    { party: "CQ3-CCC", owed: 0, toGet: 0, pend: 50 }, { party: "CQ5-EEE", owed: 100, toGet: 0, pend: 0 }, { party: "CQ6-FFF", owed: 25, toGet: 0, pend: 0 }] });
  try {
    const c1 = card(p, "CQ1-AAA"), c2 = card(p, "CQ2-BBB"), c3 = card(p, "CQ3-CCC"), c4 = card(p, "CQ4-DDD");
    ok(/Owed/.test(c1) && /RM 70(?![\d.])/.test(c1), "O1: owed not yet sealed shows at once: " + J(c1));
    ok(c2 && !/Owed/.test(c2), "O2: a payment the Desk holds clears the card: " + J(c2));
    ok(/Agreed/.test(c3) && !/Owed/.test(c3), "O3: an agreed order alone reads Agreed: " + J(c3));
    ok(/Owed/.test(c4) && /RM 30(?![\d.])/.test(c4), "O4: a code the list does not name keeps its sealed figures: " + J(c4));
    const m5 = await opened(p, "CQ5-EEE");
    ok(m5 === "", "O5: no mark where the live and sealed figures agree: " + J(m5));
    const m2 = await opened(p, "CQ2-BBB");
    ok(/Their page shows RM 100\.00 owed, from 09:30/.test(m2), "O2: and its card says what their page still shows, and from when: " + J(m2));
    const m6 = await opened(p, "CQ6-FFF");
    ok(/Their page shows RM 40\.00 agreed/.test(m6), "O7: the mark names their page's own word and figure: " + J(m6));
    p.fail.add("/all/maker/inputs"); p.w.__owner("loadOwed()"); await p.work.quiet(); await p.work.quiet();
    const f2 = card(p, "CQ2-BBB"), f1 = card(p, "CQ1-AAA");
    ok(/Owed/.test(f2) && /RM 100(?![\d.])/.test(f2) && !/Owed/.test(f1), "O6: a failed read takes the live figures back to the sealed ones: " + J([f2, f1]));
    p.fail.delete("/all/maker/inputs"); p.w.__owner("loadOwed()"); await p.work.quiet(); await p.work.quiet();
    const g1 = card(p, "CQ1-AAA");
    ok(/Owed/.test(g1) && /RM 70(?![\d.])/.test(g1), "O6: and the next good read, the same answer as before, lays them again: " + J(g1));
  } catch (x) { ok(false, "O1 stopped on an error: " + (x && x.stack)); } finally { p.w.close(); }

  p = await open(null);
  try {
    const c2 = card(p, "CQ2-BBB");
    ok(/Owed/.test(c2) && /RM 100(?![\d.])/.test(c2), "O5: with no standing from the Desk the sealed owed stands: " + J(c2));
  } catch (x) { ok(false, "O5 stopped on an error: " + (x && x.stack)); } finally { p.w.close(); }
}
