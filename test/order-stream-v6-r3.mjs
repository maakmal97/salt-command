/* test/order-stream-v6-r3.mjs: R3, A REFEREE'S FIRST WEEK COUNTS FOR THE ASSOCIATE WHO BROUGHT THEM IN (plan version 6, his answers R3 and E3
 * of 02 Nov 2026). Each check red under its own mutation (test/order-stream-v6-r3.mutations.json), on invented books and the frozen book:
 *   W1 a referee's order placed in their first week counts toward the introducer's walk once paid in full; the day the week ends and the day
 *      before it opens count nothing
 *   W2 an unpaid, a cancelled and a gift row of the referee count nothing; an introducer with no opening, or no associate, has nothing counted
 *   W3 an R3 row nets nothing he gave under the referee's price off the associate's unit, and takes no stamp of the referee's
 *   W4 only the first windowed link counts, the old count reads only the declared network, and a referee's own walk never counts a row it
 *      gave its introducer
 *   W5 the referee is never told of the associate's unit: rwdOf and their reward reading see no unit that is not theirs
 *   W6 his reading names each first week and its orders counted, and a referee's order says whose week it counts in
 *   F1 an Add ID naming an associate files the first week from the fold's day; a non-associate files none and the registration stands; a
 *      second link for the same customer is never filed
 *   F2 a referee's payment in the week raises the associate's unit, once, named for the referee's order; a referee's handover never delivers
 *      it; the associate's own next handover does
 *   F3 a referee's row redated out of the week flags the associate's unit STALE at once
 *   R1 Salt Admin's road takes an introducer only for a customer and only an associate's code, and the entry carries it; the drafter's row too
 *   P1 the associate's Counter card says how many first-week orders counted, a count and nothing else, and nothing at none */
import { pathToFileURL } from "node:url";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { frozenBook } from "./frozen.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function run({ ok, pageWork }) {
  const E = (await import("../engine/position.mjs")).default, ST = await import("../engine/stages.mjs");

  /* ---- the walk, on invented books ---- */
  const lot = (rid, date, qty, total) => ({ rid, product: "salt", date, receivedOn: date, qty, total, cash: total, received: qty });
  const sale = (rid, customer, date, total, more = {}) => ({ rid, customer, product: "salt", date, qty: 1, total, cost: 50, cash: total,
    deliveredQty: 1, deliveredOn: date, ...more });
  const intro = (by, customer, since, days = 7) => ({ by, customer, since, days, note: "R3 by join link" });
  function book(sales, { intros, open, associates = ["AX1-ZED"] } = {}) {
    return { sales, purchases: [lot("p1", "2026-10-01", 10, 500)],
      state: { REWARD: { stated: { salt: { margin: 500, associate: { margin: 470, r3Hurdle: 1.2, times: 10, since: "2026-10-20" } } } },
        REWARD_OPEN: open === undefined ? { "AX1-ZED": { earned: 2, share: 0, upTo: "s100", on: "2026-10-20" } } : open,
        associates, INTRODUCTIONS: intros === undefined ? [intro("AX1-ZED", "CR1-ZED", "2026-11-01")] : intros, PEOPLE: { departed: [] },
        PRODUCTS: { salt: {} }, PROD_OPENING: { salt: { qty: 0, costPerKg: null } } } };
  }
  const walk = (b, id = "AX1-ZED") => E.rewardWalk(b, id);
  /* a referee order of RM 550 at RM 50 cost is RM 500 of margin: exactly the step */
  /* W1 */
  const inWeek = walk(book([sale("s101", "CR1-ZED", "2026-11-01", 550)])), lastDay = walk(book([sale("s101", "CR1-ZED", "2026-11-07", 550)]));
  const after = walk(book([sale("s101", "CR1-ZED", "2026-11-08", 550)])), before = walk(book([sale("s101", "CR1-ZED", "2026-10-31", 550)]));
  ok(inWeek.earned === 3 && inWeek.crossings.length === 1 && inWeek.crossings[0].rid === "s101" && inWeek.r3.rows === 1 && inWeek.r3.by["CR1-ZED"] === 1
    && lastDay.earned === 3 && after.earned === 2 && after.r3.rows === 0 && before.earned === 2,
    "W1 a referee's order in their first week counts once paid in full; the day it ends and the day before it opens count nothing: "
      + JSON.stringify([inWeek.earned, inWeek.r3, lastDay.earned, after.earned, before.earned]));
  /* W2 */
  const unpaid = walk(book([sale("s101", "CR1-ZED", "2026-11-02", 550, { cash: 0 })]));
  const gone = walk(book([sale("s101", "CR1-ZED", "2026-11-02", 550, { cancelled: true })]));
  const gift = walk(book([sale("s101", "CR1-ZED", "2026-11-02", 550), sale("s102", "CR1-ZED", "2026-11-02", 0, { goodwill: true, cost: 400 })]));
  const noOpen = book([sale("s101", "CR1-ZED", "2026-11-02", 550)], { intros: [intro("AX2-ZED", "CR1-ZED", "2026-11-01")], associates: ["AX1-ZED", "AX2-ZED"] });
  ok(unpaid.earned === 2 && unpaid.r3.rows === 0 && gone.earned === 2 && gift.earned === 3 && gift.progress === 0
    && E.r3Of(noOpen, noOpen.sales[0]) === null && !!walk(noOpen, "AX2-ZED").error && walk(noOpen).r3.rows === 0,
    "W2 unpaid, cancelled and gift rows count nothing; an introducer with no opening has nothing counted: "
      + JSON.stringify([unpaid.earned, gone.earned, gift.earned, gift.progress, E.r3Of(noOpen, noOpen.sales[0])]));
  /* W3: RM 50 given under the referee's own price, and a stamp of a lower step, both theirs and not the associate's */
  const listed = walk(book([sale("s101", "CR1-ZED", "2026-11-02", 550, { listRM: 600, rwdStep: 100, rwdRate: 10 })]));
  ok(listed.given === 0 && listed.crossings.length === 1 && listed.crossings[0].given === 0 && listed.crossings[0].step === 500 && listed.progress === 0,
    "W3 an R3 row nets nothing given under the referee's price and takes no stamp of theirs: " + JSON.stringify([listed.given, listed.crossings]));
  /* W4 */
  const two = book([sale("s101", "CR1-ZED", "2026-11-02", 550)], { intros: [intro("AX1-ZED", "CR1-ZED", "2026-11-01"), intro("AX2-ZED", "CR1-ZED", "2026-11-01")],
    associates: ["AX1-ZED", "AX2-ZED"], open: { "AX1-ZED": { earned: 2, share: 0, upTo: "s100", on: "2026-10-20" }, "AX2-ZED": { earned: 0, share: 0, upTo: "s100", on: "2026-10-20" } } });
  const oldRefs = book([sale("s101", "CR1-ZED", "2026-11-02", 550)]);
  oldRefs.state.REWARD.stated.salt.margin = 100;
  const appointed = book([sale("s101", "CR1-ZED", "2026-11-02", 550)], { associates: ["AX1-ZED", "CR1-ZED"],
    open: { "AX1-ZED": { earned: 2, share: 0, upTo: "s100", on: "2026-10-20" }, "CR1-ZED": { earned: 0, share: 0, upTo: "s100", on: "2026-11-03", pend: ["s101"] } } });
  const oldCount = E.rewardAccount(oldRefs, "AX1-ZED", "salt", { old: true });
  ok(walk(two).earned === 3 && walk(two, "AX2-ZED").earned === 0 && E.r3Link(two.state, "CR1-ZED").by === "AX1-ZED"
    && oldCount.margin === 0 && walk(appointed).earned === 3 && walk(appointed, "CR1-ZED").earned === 0,
    "W4 one link a customer, the old count reads the declared network only, and a row given its introducer is not the referee's own: "
      + JSON.stringify([walk(two).earned, walk(two, "AX2-ZED").earned, oldCount.margin, walk(appointed).earned, walk(appointed, "CR1-ZED").earned]));
  /* W5: the associate's unit for the referee's order, handed over to the associate */
  const unit = { rid: "s102", customer: "AX1-ZED", product: "salt", qty: 1, total: 50, cost: 50, cash: 0, settledRM: 50, rebate: true, rebateKg: 1, goodwill: true,
    deliveredQty: 1, deliveredOn: "2026-11-03", rewardOf: "s101", auto: true, given: 0 };
  const told = book([sale("s101", "CR1-ZED", "2026-11-02", 550), unit]);
  /* and were the referee appointed since, their own reading of that order holds no unit of the associate's */
  const told2 = book([sale("s101", "CR1-ZED", "2026-11-02", 550), unit], { associates: ["AX1-ZED", "CR1-ZED"],
    open: { "AX1-ZED": { earned: 2, share: 0, upTo: "s100", on: "2026-10-20" }, "CR1-ZED": { earned: 0, share: 0, upTo: "s100", on: "2026-11-03" } } });
  const reading = ST.rewardReading(told2, "CR1-ZED", { rid: "s101" });
  ok(ST.rwdOf(told, told.sales[0], "cross", "2026-11-03") === null && ST.rwdOf(told, told.sales[0], undefined, "2026-11-03") === undefined
    && reading.associate === true && reading.unit === null,
    "W5 the referee is never told of the associate's unit, and no unit of another's reads as this order's: "
      + JSON.stringify([ST.rwdOf(told, told.sales[0], "cross", "2026-11-03"), reading.unit]));
  /* W6 */
  const his = ST.rewardReading(book([sale("s101", "CR1-ZED", "2026-11-02", 550)]), "AX1-ZED", {});
  const theirs = ST.rewardReading(book([sale("s101", "CR1-ZED", "2026-11-02", 550)]), "CR1-ZED", { rid: "s101" });
  const preview = ST.rewardReading(book([]), "CR1-ZED", { qty: 1, goods: 550, day: "2026-11-09" });
  ok(JSON.stringify(his.r3) === JSON.stringify([{ code: "CR1-ZED", since: "2026-11-01", last: "2026-11-07", orders: 1 }])
    && theirs.associate === false && theirs.r3For && theirs.r3For.by === "AX1-ZED" && theirs.r3For.last === "2026-11-07" && theirs.r3For.counts === true
    && preview.r3For && preview.r3For.counts === false,
    "W6 his reading names the week and its orders, and a referee's order says whose week it counts in: " + JSON.stringify([his.r3, theirs.r3For, preview.r3For]));

  /* ---- the fold, on the frozen book ---- */
  const ENG = await import("../engine/apply.mjs");
  const { nextRid } = await import("../tools/rid.mjs"), { sortBook } = await import("../tools/sort-ledger.mjs");
  const FOLD = await import(pathToFileURL(join(REPO, "tools", "fold.mjs")).href + "?r3v6");
  const reward = { stated: { salt: { margin: 500, associate: { margin: 470, r3Hurdle: 1.2, times: 10, since: "2026-10-20" } } } };
  const ctx = (today) => Object.create(FOLD.planCtx, { nextRid: { value: nextRid }, sortBook: { value: sortBook }, reward: { value: reward }, today: { value: today } });
  const D = (n) => "2031-01-" + String(n).padStart(2, "0"), T = (n, k) => D(n) + "T0" + k + ":00:00.000Z";
  const base = frozenBook();
  const rate = E.latestCogs(base.purchases.filter((p) => (p.product || "salt") === "salt"), D(2)).rate, step = +(rate * 10).toFixed(2), cost = +(10 * rate).toFixed(2);
  const top = Math.max(...base.sales.map((s) => E.rewardRid(s.rid)));
  const mk = (rows, intros) => {
    const b = frozenBook();
    b.roster.push("AX1-ZED", "AX1-ZED-R", "CX1-ZED", "CR1-ZED"); b.associates.push("AX1-ZED");
    b.REWARD_OPEN["AX1-ZED"] = { earned: 0, share: 0, upTo: "s" + top, on: "2026-10-20" };
    b.INTRODUCTIONS = (b.INTRODUCTIONS || []).concat(intros || [intro("AX1-ZED", "CR1-ZED", D(1))]);
    b.STATED_STOCK = 500;
    (rows || []).forEach((r) => b.sales.push(r));
    return b;
  };
  const order = (rid, who, more) => ({ rid, customer: who, product: "salt", date: D(2), qty: 10, total: +(step + cost).toFixed(2), cost, cash: 0, deliveredQty: 0, ...more });
  const pay = (id, rid, cash, day) => ({ id, status: "approved", collection: "sales", amends: rid, amendKind: "Fulfilment", row: { cash: 0 },
    entry: { at: id, payload: { mode: "amend", kind: "Fulfilment", direction: "SELL", date: day, cash, kg: 0 } } });
  const fix = (id, rid, fields, day) => ({ id, status: "approved", collection: "sales", amends: rid, amendKind: "Correction", row: {},
    entry: { at: id, payload: { mode: "amend", kind: "Correction", direction: "SELL", date: day, fields } } });
  const add = (id, code, introducer, kind = "customer") => ({ id, status: "approved", collection: "roster", row: { code, kind, parent: null, note: null, introducer },
    entry: { at: id, payload: { mode: "addid", code, kind, introducer } } });
  const go = (b, rows, today = D(9)) => ENG.applyBatch(b, { ok: true, count: rows.length, approved: rows },
    { version: "v9999", rows: Object.fromEntries(rows.map((r) => [r.id, { note: "note " + r.id }])) }, ctx(today));
  const units = (b) => b.sales.filter((s) => s.rewardOf && E.ownerCode(s.customer) === "AX1-ZED");

  /* F1 */
  const b1 = mk([], []);
  const f1 = go(b1, [add(T(9, 1), "CN1-ZED", "AX1-ZED")], D(9));
  const f1b = go(mk([], []), [add(T(9, 1), "CN1-ZED", "CX1-ZED")], D(9));
  const f1c = go(mk([], [intro("CX1-ZED", "CN1-ZED", D(3))]), [add(T(9, 1), "CN1-ZED", "AX1-ZED")], D(9));
  const banned = mk([], []); banned.PEOPLE = Object.assign({}, banned.PEOPLE, { banned: [{ id: "AX1-ZED" }] });
  const f1d = go(banned, [add(T(9, 1), "CN1-ZED", "AX1-ZED")], D(9));
  ok(f1d.ok && f1d.book.roster.includes("CN1-ZED") && !(f1d.book.INTRODUCTIONS || []).some((e) => e.customer === "CN1-ZED"),
    "F1d a banned associate's Add ID files no week, and the registration stands (Fable's review): " + JSON.stringify(f1d.ok || f1d.problems));
  const filed = f1.ok ? (f1.book.INTRODUCTIONS || []).filter((e) => e.customer === "CN1-ZED") : [];
  const twice = f1c.ok ? (f1c.book.INTRODUCTIONS || []).filter((e) => e.customer === "CN1-ZED") : null;
  ok(f1.ok && filed.length === 1 && filed[0].by === "AX1-ZED" && filed[0].since === D(9) && filed[0].days === 7 && f1.book.roster.includes("CN1-ZED")
    && f1b.ok && f1b.book.roster.includes("CN1-ZED") && !(f1b.book.INTRODUCTIONS || []).some((e) => e.customer === "CN1-ZED")
    && f1c.ok && twice.length === 1 && twice[0].by === "CX1-ZED",
    "F1 an Add ID naming an associate files the week from the fold's day; a non-associate files none and the ID stands; never a second: "
      + JSON.stringify([f1.ok ? filed : f1.problems, f1b.ok || f1b.problems, twice]));
  /* F2 */
  const two2 = go(mk([order("s9001", "CR1-ZED"), order("s9002", "AX1-ZED", { date: D(1), qty: 1, total: 100, cost: rate, cash: 100 })]),
    [pay(T(3, 1), "s9001", +(step + cost).toFixed(2), D(3))]);
  const u2 = two2.ok ? units(two2.book) : [];
  const again = two2.ok ? go(two2.book, [fix(T(4, 1), "s9001", { deliveredQty: 10, deliveredOn: D(4), handover: "delivered" }, D(4))]) : { ok: false };
  const u2b = again.ok ? units(again.book) : [];
  const own = again.ok ? go(again.book, [fix(T(5, 1), "s9002", { deliveredQty: 1, deliveredOn: D(5), handover: "delivered" }, D(5))]) : { ok: false };
  const u2c = own.ok ? units(own.book) : [];
  ok(two2.ok && u2.length === 1 && u2[0].rewardOf === "s9001" && /CR1-ZED in their first week/.test(u2[0].note || "")
    && again.ok && u2b.length === 1 && !(+u2b[0].deliveredQty > 0) && own.ok && u2c.length === 1 && u2c[0].deliveredQty === 1,
    "F2 a referee's payment in the week raises the associate's unit once; their handover never delivers it; the associate's does: "
      + JSON.stringify([two2.ok ? u2.map((s) => [s.rewardOf, s.deliveredQty]) : two2.problems, u2b.map((s) => s.deliveredQty), u2c.map((s) => s.deliveredQty)]));
  /* F3 */
  const moved = two2.ok ? go(two2.book, [fix(T(6, 1), "s9001", { date: D(20) }, D(6))]) : { ok: false };
  ok(moved.ok && moved.moves.some((m) => typeof m === "string" && /^STALE reward on /.test(m)),
    "F3 a referee's row redated out of the week flags the associate's unit STALE at once: " + JSON.stringify(moved.ok ? moved.moves.filter((m) => typeof m === "string") : moved.problems));

  /* ---- Salt Admin's road and the drafter ---- */
  const MI = await import("../src/maker-inputs.js"), DR = await import("../src/drafter.js");
  const roadOk = typeof MI.makerLedgerInput === "function";
  let rOk = false, rWhy = "makerLedgerInput not exported";
  if (roadOk) {
    const mirror = { state: { roster: ["AX1-ZED", "AX1-ZED-R", "CX1-ZED"], associates: ["AX1-ZED"], INTRODUCTIONS: [], REWARD_OPEN: { "AX1-ZED": { earned: 0, share: 0, upTo: "s1", on: "2026-10-20" } },
      PRODUCTS: { salt: {} }, PEOPLE: {} }, sales: [], purchases: [], pricing: { byProduct: {} }, version: "v9999" };
    const env = { v: 1, salt: "AAAA", iv: "AAAA", ct: "AAAA" };
    const body = (introducer, kind = "customer") => ({ at: "2031-01-09T01:00:00.000Z", code: "CN1-ZED", kind, parent: null, geo: null, tiers: null, vault: env, ...(introducer === undefined ? {} : { introducer }) });
    const good = MI.makerLedgerInput("add-id", body("AX1-ZED"), mirror), none = MI.makerLedgerInput("add-id", body(undefined), mirror);
    const bad = MI.makerLedgerInput("add-id", body("CX1-ZED"), mirror), sup = MI.makerLedgerInput("add-id", { ...body("AX1-ZED", "supplier"), code: "SN1-ZED" }, mirror);
    const drafted = good && good.draft ? good.draft : null;
    rOk = !!(good && good.entry && good.entry.payload.introducer === "AX1-ZED" && none && none.entry && !("introducer" in none.entry.payload)
      && bad && bad.error && sup && sup.error && !!drafted && !!drafted.row && drafted.row.introducer === "AX1-ZED");
    rWhy = JSON.stringify([good && (good.error || good.entry.payload), none && (none.error || none.entry.payload), bad, sup, drafted && drafted.row]);
  }
  ok(rOk, "R1 his road takes an introducer for a customer only and an associate's code only, and the entry and the drafter's row carry it: " + rWhy);

  /* ---- the associate's Counter card ---- */
  const K = await import("./counter-b-kit.mjs");
  const card = (r3) => ({ at: new Date().toISOString(), products: [{ product: "salt", name: "Salt", unit: "unit", summary: { bought: 100, soldFor: 0, onward: 0, introduced: 0, referred: 1 },
    reward: { earned: 1, taken: 0, left: 1, next: 0.4, held: false, r3 }, lines: [] }] });
  const pages = [];
  try {
    const said = [];
    for (const n of [2, 1, 0]) {
      const p = await K.open({ ok, pageWork, assoc: true, card: card(n) }); pages.push(p);
      await K.until(() => /first week|Rewards|reward/i.test(K.txt(p.d.getElementById("pCard"))), 60);
      said.push([...p.d.querySelectorAll("#pCard p.sub2")].map(K.txt).filter((x) => /first week/.test(x)));
    }
    ok(JSON.stringify(said) === JSON.stringify([["2 orders from people you brought in counted, in their first week."], ["1 order from someone you brought in counted, in their first week."], []]),
      "P1 the associate's card counts the first-week orders of people they brought in, and says nothing at none: " + JSON.stringify(said));
  } finally { for (const p of pages) p.close(); }
}
