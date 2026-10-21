/* test/loyalty-walk.mjs: THE LOYALTY UNIT, P1: THE WALK (his rule of 20 Oct 2026, docs/plan-loyalty-unit.html). Each check red under its own
 * mutation (test/loyalty-walk.mutations.json), on invented books, so no real code or figure is read but the last check's:
 *   1  a unit at exactly 20 units and not at 19
 *   2  two at 40 in one order, both on that order
 *   3  a row a sen under their price counts none of its units
 *   4  a short-closed row re-stamped for its final size counts its final qty
 *   5  a re-sized row reads their price per unit off listQty
 *   6  an unpaid and a part-paid row count nothing; a row with no stamp counts nothing
 *   7  a row paid late counts nothing and pauses the next
 *   8  three payments on time lift the pause, the third counting
 *   9  a delay open on pOn and settled later still pauses; a late after the day does not pause an earlier order
 *   10 a write-off pauses for good, an undelivered one included; one dated after an order does not touch it
 *   11 progress is kept through a pause, never reset
 *   12 an associate, the partner, a supplier and a -R bucket do not walk
 *   13 an oil row, a gift and a row before since count nothing; with no loyal scheme the walk is null
 *   14 cadenceOf is the desk's custCadence, on the frozen book
 *   15 a sale written off by a Correction (no defaultedOn, as the real road writes it) is dated by that step, so a write-off booked later
 *      leaves the orders before it counted; with no step, by the first handover plus the lock
 *   16 a row whose handover has no day counts nothing (its lateness cannot be read) */
import E from "../engine/position.mjs";
import { frozenBook } from "./frozen.mjs";

const ID = "CQ1-ZUL";
/* a salt order of q units at RM 100 a unit, their price RM 100 a unit, handed over on `got` and paid on `paid` */
const row = (rid, q, got, paid, more = {}) => ({ rid, customer: ID, product: "salt", date: got, qty: q, total: 100 * q, cost: 58 * q,
  listRM: 100 * q, listQty: q, deliveredQty: q, deliveredOn: got, cash: paid ? 100 * q : 0, ...(paid ? { paidOn: paid } : {}), ...more });
function book(sales, { since = "2026-10-21", extra = {}, purchases = [] } = {}) {
  return { sales, purchases,
    state: { REWARD: { stated: { salt: { margin: 500, associate: { margin: 470, r3Hurdle: 1.2, times: 10, since: "2026-10-20" },
      ...(since ? { loyal: { every: 20, since } } : {}) } } },
      TERMS: { holdDays: 1, lockDays: 4, lateResetRepeat: 3, lateWindowDays: 90 },
      associates: ["AX9-VOR"], partners: ["PX9-NUD"], INTRODUCTIONS: [], PEOPLE: { departed: [] }, PRODUCTS: { salt: {}, oil: {} }, ...extra } };
}
const walk = (b, id = ID, today = "2026-11-30") => E.loyaltyWalk(b, id, today);
const j = (x) => JSON.stringify(x);

export async function run({ ok }) {
  /* 1 */
  const at20 = walk(book([row("s301", 12, "2026-10-22", "2026-10-22"), row("s302", 8, "2026-10-23", "2026-10-23")]));
  const at19 = walk(book([row("s301", 12, "2026-10-22", "2026-10-22"), row("s302", 7, "2026-10-23", "2026-10-23")]));
  ok(at20.walks && at20.earned === 1 && at20.units === 0 && at20.crossings[0].rid === "s302" && at20.crossings[0].day === "2026-10-23"
    && at19.earned === 0 && at19.units === 19 && at19.next === 0.95,
    "a unit at exactly 20 units and not at 19: " + j([at20.earned, at20.crossings, at19.earned, at19.units, at19.next]));
  /* 2 */
  const big = walk(book([row("s301", 41, "2026-10-22", "2026-10-22")]));
  ok(big.earned === 2 && big.crossings.length === 2 && big.crossings.every((c) => c.rid === "s301") && big.units === 1,
    "two units at 40 in one order, both on that order: " + j([big.earned, big.crossings, big.units]));
  /* 3: RM 1,999.99 for 20 against their RM 2,000 */
  const sen = walk(book([row("s301", 20, "2026-10-22", "2026-10-22", { total: 1999.99, cash: 1999.99 })]));
  const even = walk(book([row("s301", 20, "2026-10-22", "2026-10-22")]));
  ok(sen.earned === 0 && sen.units === 0 && sen.rows[0].why === "under" && even.earned === 1,
    "a row a sen under their price counts none of its units: " + j([sen.earned, sen.units, sen.rows, even.earned]));
  /* 4: 20 agreed, closed short at 19 and re-stamped for 19; 1 more on another order makes 20 */
  const short = walk(book([row("s301", 19, "2026-10-22", "2026-10-22"), row("s302", 1, "2026-10-24", "2026-10-24")]));
  const shortOnly = walk(book([row("s301", 19, "2026-10-22", "2026-10-22")]));
  /* and one closed short at the agreed rate before the re-stamp: their RM 2,000 for 20, 19 handed over and paid at RM 1,900 */
  const unstamped = walk(book([row("s301", 19, "2026-10-22", "2026-10-22", { listRM: 2000, listQty: 20 })]));
  ok(short.earned === 1 && shortOnly.units === 19 && shortOnly.earned === 0 && unstamped.units === 19 && unstamped.earned === 0,
    "a short-closed row counts its final qty: " + j([short.earned, shortOnly.units, unstamped.units]));
  /* 5: stamped RM 2,000 for 20, re-sized to 10 for RM 1,000: RM 100 a unit either way */
  const resized = walk(book([row("s301", 10, "2026-10-22", "2026-10-22", { listRM: 2000, listQty: 20 })]));
  ok(resized.units === 10 && resized.rows[0].counts === true,
    "a re-sized row reads their price per unit off listQty: " + j(resized.rows));
  /* 6 */
  const owed = walk(book([row("s301", 20, "2026-10-22", null), row("s302", 20, "2026-10-22", null, { cash: 1999 }),
    row("s303", 20, "2026-10-22", "2026-10-22", { listRM: undefined, listQty: undefined })]));
  ok(owed.earned === 0 && owed.units === 0 && owed.rows.length === 1 && owed.rows[0].why === "unstamped",
    "an unpaid and a part-paid row count nothing, and a row with no stamp counts nothing: " + j([owed.earned, owed.rows]));
  /* 7: s301 handed over 22 Oct, paid 26 Oct (four days); s302 on time on 27 Oct */
  const late = walk(book([row("s301", 10, "2026-10-22", "2026-10-26"), row("s302", 10, "2026-10-27", "2026-10-27")]));
  ok(late.earned === 0 && late.units === 0 && late.rows[0].why === "late" && late.rows[1].why === "late",
    "a row paid late counts nothing and pauses the next: " + j(late.rows));
  /* 8: then on time on 28 and 29 Oct: the third payment on time lifts it and counts */
  const lift = walk(book([row("s301", 10, "2026-10-22", "2026-10-26"), row("s302", 10, "2026-10-27", "2026-10-27"),
    row("s303", 10, "2026-10-28", "2026-10-28"), row("s304", 7, "2026-10-29", "2026-10-29")]));
  ok(lift.units === 7 && lift.rows.map((r) => r.counts).join() === "false,false,false,true" && lift.paused === false,
    "three payments on time lift the pause, the third counting: " + j([lift.units, lift.rows, lift.paused]));
  /* 9: s301 handed over 22 Oct and still unpaid on 25 Oct (paid 30 Oct); s302 on time on 25 Oct */
  const open = walk(book([row("s301", 10, "2026-10-22", "2026-10-30"), row("s302", 5, "2026-10-25", "2026-10-25")]));
  /* and s301 handed over only on 24 Oct, paid late on 30 Oct: s302 on time on 23 Oct came first */
  const after = walk(book([row("s301", 10, "2026-10-24", "2026-10-30"), row("s302", 5, "2026-10-23", "2026-10-23")]));
  ok(open.rows.find((r) => r.rid === "s302").why === "late" && open.units === 0
    && after.rows.find((r) => r.rid === "s302").counts === true && after.units === 5,
    "a delay open on pOn and settled later pauses; a late after the day does not pause an earlier order: " + j([open.rows, after.rows]));
  /* 10: s300 written off with nothing handed over, dated 22 Oct; on time on 23 Oct and three times after */
  const off = { rid: "s300", customer: ID, product: "salt", date: "2026-10-22", qty: 3, total: 300, cash: 0, deliveredQty: 0, defaulted: true, defaultedOn: "2026-10-22" };
  const wo = walk(book([off, row("s301", 5, "2026-10-23", "2026-10-23"), row("s302", 5, "2026-10-24", "2026-10-24"),
    row("s303", 5, "2026-10-25", "2026-10-25"), row("s304", 5, "2026-10-26", "2026-10-26")]));
  const woAfter = walk(book([Object.assign({}, off, { date: "2026-10-28", defaultedOn: "2026-10-28" }), row("s301", 5, "2026-10-23", "2026-10-23")]));
  ok(wo.units === 0 && wo.rows.every((r) => r.why === "writeoff") && wo.paused && wo.why === "writeoff"
    && woAfter.units === 5 && woAfter.paused === true,
    "a write-off pauses for good, an undelivered one included, and one dated after an order leaves it counted: " + j([wo.rows, woAfter.units, woAfter.why]));
  /* 11: 15 counted, then a late pause, then three on time: the third's 5 cross 20 */
  const kept = walk(book([row("s301", 15, "2026-10-22", "2026-10-22"), row("s302", 1, "2026-10-23", "2026-10-28"),
    row("s303", 1, "2026-10-29", "2026-10-29"), row("s304", 1, "2026-10-30", "2026-10-30"), row("s305", 5, "2026-10-31", "2026-10-31")]));
  ok(kept.earned === 1 && kept.crossings[0].rid === "s305" && kept.units === 0,
    "progress is kept through a pause and crosses after it: " + j([kept.earned, kept.crossings, kept.units]));
  /* 12 */
  const as = (id) => ({ ...row("s301", 20, "2026-10-22", "2026-10-22"), customer: id });
  const assoc = walk(book([as("AX9-VOR")]), "AX9-VOR"), partner = walk(book([as("PX9-NUD")]), "PX9-NUD");
  const sup = walk(book([as("SX9-MEB")], { purchases: [{ rid: "p9", supplier: "SX9-MEB", product: "salt", qty: 10, total: 500, date: "2026-10-01" }] }), "SX9-MEB");
  const bucket = walk(book([as("CQ1-ZUL-R")]), "CQ1-ZUL-R");
  const r2 = walk(book([{ ...as("BX9-TAV-R"), rev: "R2" }]), "BX9-TAV");
  ok(assoc.walks === false && assoc.why === "associate" && partner.why === "partner" && sup.why === "supplier" && bucket.why === "bucket"
    && r2.why === "associate",
    "an associate, the partner, a supplier and a -R bucket do not walk: " + j([assoc, partner, sup, bucket, r2]));
  /* 13 */
  const odd = walk(book([{ ...row("s301", 20, "2026-10-22", "2026-10-22"), product: "oil" }, row("s302", 20, "2026-10-22", "2026-10-22", { goodwill: true }),
    row("s303", 20, "2026-10-20", "2026-10-20")]));
  ok(odd.earned === 0 && odd.units === 0 && odd.rows.length === 0 && walk(book([row("s301", 20, "2026-10-22", "2026-10-22")], { since: null })) === null,
    "an oil row, a gift and a row before since count nothing, and no scheme is null: " + j([odd.earned, odd.rows]));
  /* 14: the desk's custCadence as it stood before the move, on the real book's priced salt rows, for every code */
  const real = frozenBook();
  const priced = real.sales.filter((s) => (s.product || "salt") === "salt" && !s.goodwill && !["Pending", "Cancelled"].includes(E.txStat(s).order));
  const old = (id, merge) => {
    const ds = [...new Set(priced.filter((s) => (merge ? E.ownsCode(id, s.customer) : s.customer === id) && !s.cancelled && s.date).map((s) => s.date))].sort();
    if (ds.length < 2) return null;
    const g = []; for (let i = 1; i < ds.length; i++) g.push(Math.round((new Date(ds[i]) - new Date(ds[i - 1])) / 86400000));
    const sorted = g.slice().sort((a, b) => a - b);
    return { n: ds.length, med: sorted[Math.floor(sorted.length / 2)], last: ds[ds.length - 1], gaps: g };
  };
  const codes = [...new Set(priced.map((s) => E.ownerCode(s.customer)))];
  const diff = codes.filter((c) => j(E.cadenceOf(priced, c, true)) !== j(old(c, true)) || j(E.cadenceOf(priced, c, false)) !== j(old(c, false)));
  const any = codes.map((c) => E.cadenceOf(priced, c, true)).filter(Boolean);
  ok(codes.length > 5 && any.length > 3 && diff.length === 0 && any.some((x) => x.gaps.length > 2),
    "cadenceOf is the desk's custCadence on the real book, for every code: " + j([codes.length, any.length, diff]));
  /* 15: s300 handed over 22 Oct, unpaid, written off by a Correction on 1 Nov; 20 units on time on 22 and 23 Oct */
  const wo1 = { rid: "s300", customer: ID, product: "salt", date: "2026-10-22", qty: 1, total: 100, cash: 0, deliveredQty: 1, deliveredOn: "2026-10-22", defaulted: true,
    amend: [{ date: "2026-10-22", kind: "Fulfilment", cash: 0, kg: 1, note: "as booked" }, { date: "2026-11-01", kind: "Correction", cash: 0, kg: 0, note: "written off" }] };
  const kept15 = walk(book([wo1, row("s301", 12, "2026-10-22", "2026-10-22"), row("s302", 8, "2026-10-23", "2026-10-23"), row("s303", 5, "2026-11-02", "2026-11-02")]));
  const noStep = walk(book([{ ...wo1, amend: [{ date: "2026-10-22", kind: "Fulfilment", cash: 0, kg: 1, note: "as booked" }] },
    row("s301", 5, "2026-10-25", "2026-10-25"), row("s302", 5, "2026-10-27", "2026-10-27")]));
  ok(kept15.earned === 1 && kept15.crossings[0].rid === "s302" && kept15.rows.find((r) => r.rid === "s303").why === "writeoff"
    && noStep.rows.find((r) => r.rid === "s301").why !== "writeoff" && noStep.rows.find((r) => r.rid === "s302").why === "writeoff",
    "a write-off is dated by its own Correction, else the first handover plus the lock: " + j([kept15.earned, kept15.rows, noStep.rows]));
  /* 16: 20 units handed over with no day, paid on 30 Oct */
  const undated = walk(book([row("s301", 20, "2026-10-22", "2026-10-30", { deliveredOn: undefined })]));
  ok(undated.earned === 0 && undated.rows[0].why === "undated", "a row whose handover has no day counts nothing: " + j(undated.rows));
}
