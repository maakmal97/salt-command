/* test/assoc-reward-walk.mjs: THE ASSOCIATE REWARD, P1: THE WALK (his rules of 20 Oct 2026). Each check red under its own mutation
 * (test/assoc-reward-walk.mutations.json), on invented books, so no real code or figure is read:
 *   1  a unit at exactly the step (10 x the crossing day's landed cost), and not a sen under
 *   2  the step is the crossing day's lot, not today's
 *   3  a row stamped rwdStep at Accept is measured at the lesser step
 *   4  a row made whole in kind and in cash counts once paid in full, on its pOn (the last cash step)
 *   5  with COGS fallen and no row paid, next holds at 1 and nothing is earned
 *   6  a COGS rise lowers next and earns nothing back
 *   7  an unpaid and a part-paid row count nothing
 *   8  a -R row counts; an R3 introduction and an oil row do not
 *   9  a gift's cost comes off on the day it is handed over
 *   10 a written-off row counts nothing
 *   11 a row the opening already read (rid at or under upTo) is not counted again; one Pending then (pend) is
 *   12 rewardAccount takes an associate's units from the walk, and refuses one with no opening; before the switch it is unchanged
 *   13 given is their own price over the goods since the last crossing, never a row over their price */
import E from "../engine/position.mjs";

const lot = (rid, date, qty, total) => ({ rid, product: "salt", date, receivedOn: date, qty, total, cash: total, received: qty });
const sale = (rid, date, total, more = {}) => ({ rid, customer: "AX1-ZED", product: "salt", date, qty: 1, total, cost: 50, cash: total,
  deliveredQty: 1, deliveredOn: date, ...more });
function book(sales, { purchases, open, since = "2026-10-20", extra = {} } = {}) {
  return { sales, purchases: purchases || [lot("p1", "2026-10-01", 10, 500), lot("p2", "2026-10-25", 10, 600)],
    state: { REWARD: { stated: { salt: { margin: 500, associate: { margin: 470, r3Hurdle: 1.2, times: 10, since } } } },
      REWARD_OPEN: open === undefined ? { "AX1-ZED": { earned: 2, share: 0.5, upTo: "s100", on: "2026-10-20" } } : open,
      associates: ["AX1-ZED"], INTRODUCTIONS: [], PEOPLE: { departed: [] }, PRODUCTS: { salt: {}, oil: {} },
      PROD_OPENING: { salt: { qty: 0, costPerKg: null } }, ...extra } };
}
const walk = (b, today) => E.rewardWalk(b, "AX1-ZED", today);

export async function run({ ok }) {
  /* 1: opening 0.5 x RM 500 (RM 50 on 20 Oct) = RM 250; a RM 300 sale at RM 50 cost adds RM 250 */
  const at = walk(book([sale("s101", "2026-10-21", 300)])), under = walk(book([sale("s101", "2026-10-21", 299.99)]));
  ok(at.earned === 3 && at.crossings.length === 1 && at.crossings[0].step === 500 && at.crossings[0].rate === 50 && at.progress === 0
    && under.earned === 2 && under.progress === 499.99,
    "a unit at exactly the step and not a sen under: " + JSON.stringify([at.earned, at.crossings, under.earned, under.progress]));
  /* 2: the same sale paid on 26 Oct, after the RM 60 lot landed, meets a RM 600 step */
  const late = walk(book([sale("s101", "2026-10-26", 300)]));
  ok(late.earned === 2 && late.progress === 500 && at.crossings[0].day === "2026-10-21",
    "the step is the crossing day's lot: paid on 26 Oct the RM 500 of progress meets RM 600 and earns nothing: " + JSON.stringify([late.earned, late.progress]));
  /* 3 */
  const kept = walk(book([sale("s101", "2026-10-26", 300, { rwdStep: 500 })])), dear = walk(book([sale("s101", "2026-10-21", 300, { rwdStep: 700 })]));
  ok(kept.earned === 3 && kept.crossings[0].step === 500 && kept.crossings[0].rate === 60 && dear.earned === 3 && dear.crossings[0].step === 500,
    "a row stamped at Accept is measured at the lesser of its stamp and the day's step: " + JSON.stringify([kept.crossings, dear.crossings]));
  /* 4: RM 100 cash on 22 Oct and RM 200 settled in kind make it whole */
  const kind = walk(book([sale("s101", "2026-10-21", 300, { cash: 100, settledRM: 200, settle: "barter",
    amend: [{ date: "2026-10-21", kind: "Fulfilment", cash: 0, kg: 1, note: "as booked" }, { date: "2026-10-22", kind: "Fulfilment", cash: 100, kg: 0 }] })]));
  ok(kind.earned === 3 && kind.crossings[0].day === "2026-10-22",
    "a row made whole in kind and cash counts on its pOn: " + JSON.stringify(kind.crossings));
  /* 5: share 0.9 at RM 60 on the switch (RM 540), then a RM 50 lot lands: today's step is RM 500 */
  const fell = book([], { purchases: [lot("p1", "2026-10-01", 10, 600), lot("p2", "2026-10-22", 10, 500)],
    open: { "AX1-ZED": { earned: 4, share: 0.9, upTo: "s100", on: "2026-10-20" } } });
  const f = walk(fell);
  ok(f.next === 1 && f.earned === 4 && f.crossings.length === 0 && f.progress === 540,
    "with COGS fallen and nothing paid, next holds at 1 and nothing is earned: " + JSON.stringify([f.next, f.earned, f.progress]));
  /* 6: share 0.5 at RM 50 (RM 250) and today's RM 60 lot: next falls to 250 / 600 */
  const rose = walk(book([]));
  ok(rose.next === 0.4167 && rose.earned === 2 && rose.step === 600, "a COGS rise lowers next and earns nothing back: " + JSON.stringify([rose.next, rose.earned]));
  /* 7 */
  const owed = walk(book([sale("s101", "2026-10-21", 3000, { cash: 0 }), sale("s102", "2026-10-21", 3000, { cash: 2999 })]));
  ok(owed.rows === 0 && owed.earned === 2, "an unpaid and a part-paid row count nothing: " + JSON.stringify([owed.rows, owed.earned]));
  /* 8 */
  const who = walk(book([sale("s101", "2026-10-21", 300, { customer: "AX1-ZED-R", rev: "R2" }),
    sale("s102", "2026-10-21", 3000, { customer: "CX9-ZED", ref: "AX1-ZED" }), sale("s103", "2026-10-21", 3000, { product: "oil" })]));
  ok(who.rows === 1 && who.earned === 3 && who.crossings[0].rid === "s101",
    "a -R row counts; an introduction and an oil row do not: " + JSON.stringify([who.rows, who.crossings]));
  /* 9: a unit given on 23 Oct takes its RM 50 cost off; the paid RM 300 sale on 24 Oct then sits RM 50 short */
  const gift = walk(book([sale("s101", "2026-10-24", 300), { rid: "s102", customer: "AX1-ZED", product: "salt", date: "2026-10-23", qty: 1,
    total: 0, cost: 50, cash: 0, goodwill: true, deliveredQty: 1, deliveredOn: "2026-10-23" }]));
  ok(gift.earned === 2 && gift.progress === 450 && gift.rows === 2, "a gift's cost comes off on its delivery day: " + JSON.stringify([gift.earned, gift.progress]));
  /* 10 */
  const lost = walk(book([sale("s101", "2026-10-21", 300, { defaulted: true })]));
  ok(lost.rows === 0 && lost.earned === 2, "a written-off row counts nothing: " + JSON.stringify([lost.rows, lost.earned]));
  /* 11 */
  const seen = walk(book([sale("s099", "2026-10-21", 300), sale("s098", "2026-10-21", 300)],
    { open: { "AX1-ZED": { earned: 2, share: 0.5, upTo: "s100", on: "2026-10-20", pend: ["s098"] } } }));
  ok(seen.rows === 1 && seen.crossings[0].rid === "s098", "a row the opening read is not counted again; one Pending then is: " + JSON.stringify(seen.crossings));
  /* 12 */
  const acc = E.rewardAccount(book([sale("s101", "2026-10-21", 300)]), "AX1-ZED"), none = E.rewardAccount(book([], { open: {} }), "AX1-ZED");
  const before = E.rewardAccount(book([sale("s101", "2026-10-21", 3000)], { since: null }), "AX1-ZED");
  ok(acc.earned === 3 && acc.margin === 0 && /no reward opening/.test(none.error || "") && before.earned === 6 && E.rewardWalk(book([], { since: null }), "AX1-ZED") === null,
    "rewardAccount takes an associate's units from the walk and refuses one with no opening; before the switch the old count: "
      + JSON.stringify([acc.earned, none.error, before.earned]));
  /* 13: their price RM 320 on the crossing row (RM 20 given), RM 340 on the next (RM 40), a row over their price gives nought */
  const gv = walk(book([sale("s101", "2026-10-21", 300, { listRM: 320 }), sale("s102", "2026-10-22", 100, { listRM: 140 }),
    sale("s103", "2026-10-22", 100, { listRM: 90 })]));
  ok(gv.crossings[0].given === 20 && gv.given === 40, "given is their own price over the goods since the last crossing: " + JSON.stringify([gv.crossings, gv.given]));
}
