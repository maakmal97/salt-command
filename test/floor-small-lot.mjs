/* test/floor-small-lot.mjs: A SMALL LOT DOES NOT SET THE FLOOR (docs/plan-small-lot.html; his answers of 24 and 25 Nov 2026). Each check red under
 * its own mutation (test/floor-small-lot.mutations.json):
 *   L1  candy's lots as they stand (p027, p031, p057, and p062 pending), written out here: MYR 47.20 over 10 units, 1 unit of p057 at MYR 94 and
 *       9 of p031 at MYR 42, p, rid and date still p057's; MYR 30 alone once p062 lands; not MYR 45.25 (the last lot whole) nor MYR 94 (no minimum)
 *   L2  at or over the minimum the answer is the old rule's object, byte for byte (the old function, written out below), on every book of both books
 *       and every day a lot landed; the only days that differ are salt's 23 Jul 2026, and on the live book candy's 17 Nov 2026
 *   L3  the edges: lots short of the minimum are all taken whole; a lot after the day, a pending, a defaulted and a cancelled lot are never
 *       counted; a partly landed lot counts over its units received; the later in the list is the newer on one day; a book COST_MIN does not
 *       name keeps the latest lot alone; only the newest lot's book is blended
 *   L4  COST_MIN is the rules' own, his five figures, and the page's is the module's
 *   L5  the page against the module, on a book holding candy's lots and a master rendered from it: the Desk in jsdom, the module and the drafter
 *       give MYR 47.20; the snapshot and the cost stack carry the lots; candy's Floor is MYR 50 at 1 unit under the board's MYR 60; the page's
 *       pricing is the engine's from the book alone; and Pricing names the newest 10 units and each lot in its seven places
 *   L6  the drafter's note names each lot, the flags say the units counted, a drafted lot second in the blend raises the flag, and the
 *       Workbench says "the newest 10 units"
 *   L7  no other file works out a cost from a lot's quote and freight (the Workbench's figure for a purchase being entered excepted)
 *   L8  tools/product.mjs says a new book COST_MIN does not name prices off its latest lot alone (his answer of 25 Nov 2026)
 * Invented codes for every party; the lots are the book's own, by rid. */
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FROZEN_BOOK, FROZEN_MASTER, LIVE_BOOK } from "./frozen.mjs";
import { syncText } from "../tools/booksync.mjs";
import { openMaster } from "../tools/payload.mjs";
import { pricingSnapshot } from "../tools/book.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const NOW = Date.parse("2026-11-25T04:00:00Z");
const J = (x) => JSON.stringify(x);

/* candy's lots, as the book holds them on 25 Nov 2026 (notes and trails left out: the cost reads none of them) */
const P027 = { rid: "p027", product: "candy", supplier: "SM4-KEP", date: "2026-09-21", receivedOn: "2026-09-21", qty: 30, receivedQty: 30, total: 1140, cash: 1140, status: "paid", handover: "delivered", paidOn: "2026-09-21" };
const P031 = { rid: "p031", product: "candy", supplier: "SM4-KEP", date: "2026-09-24", receivedOn: "2026-09-24", qty: 15, receivedQty: 15, total: 630, cash: 630, status: "paid", paidOn: "2026-09-24" };
const P057 = { rid: "p057", product: "candy", supplier: "SM4-KEP", date: "2026-11-22", receivedOn: "2026-11-17", qty: 1, receivedQty: 1, total: 69, freight: 25, cash: 94, status: "paid", handover: "collected", paidOn: "2026-11-17" };
const P062 = { rid: "p062", product: "candy", supplier: "CM4-TO-R", date: "2026-11-22", qty: 30, total: 900, cash: 0, status: "unpaid", pending: true };
const CANDY = [P027, P031, P057, P062];

export async function run({ ok }) {
  const PE = (await import("../engine/position.mjs")).default;
  const RULES = (await import("../engine/rules.mjs")).default;
  const PX = (await import("../engine/pricing.mjs")).default;
  const { pricingFromBook, pricingDiffer } = await import("../engine/book-inputs.mjs");
  const { cogsFor, draftRow, flagsFor } = await import("../src/drafter.js");
  const { makerTradeReading } = await import("../src/maker-inputs.js");

  /* L1: candy's case */
  const c1 = PE.latestCogs(CANDY, "2026-11-25");
  ok(c1 && c1.rate === 47.2 && c1.units === 10 && c1.quote === 447 && c1.freight === 25 && c1.rid === "p057" && c1.p === P057 && c1.date === "2026-11-17"
    && J(c1.lots) === J([{ rid: "p057", date: "2026-11-17", units: 1, rate: 94, draft: null }, { rid: "p031", date: "2026-09-24", units: 9, rate: 42, draft: null }]),
    "L1: candy's cost is MYR 47.20 over the newest 10 units, 1 of p057 at MYR 94 and 9 of p031 at MYR 42, MYR 447 goods and MYR 25 freight; p, rid and date are p057's: "
    + J(c1 && { rate: c1.rate, units: c1.units, quote: c1.quote, freight: c1.freight, rid: c1.rid, date: c1.date, lots: c1.lots }));
  ok(J(PE.latestCogs(CANDY)) === J(c1), "L1: with no day it reads the same (p062 is pending, so nothing later counts)");
  const landed = Object.assign({}, P062, { pending: false, receivedOn: "2026-11-26", receivedQty: 30, status: "paid", cash: 900 });
  const c2 = PE.latestCogs([P027, P031, P057, landed]);
  ok(c2 && c2.rate === 30 && c2.rid === "p062" && c2.units === 30 && !("lots" in c2),
    "L1: once p062 lands, 30 units reach the minimum alone, so candy reads MYR 30 off p062 and carries no lots: " + J(c2 && { rate: c2.rate, rid: c2.rid, lots: c2.lots }));

  /* L2: the old rule, as it stood at aa317c5a, written out so the comparison does not read the code under test */
  const oldLatest = (purchases, onOrBefore) => {
    let best = null;
    (purchases || []).forEach((p) => {
      if (!p || !PE.poLive(p) || !(PE.poRecvUnits(p) > 0.0001) || !(+p.qty > 0) || !Number.isFinite(+p.total)) return;
      const d = p.receivedOn || p.date || null;
      if (onOrBefore && d && d > onOrBefore) return;
      if (!best || (d || "") >= (best.date || "")) best = { p, date: d };
    });
    if (!best) return null;
    const p = best.p, fr = Number.isFinite(+p.freight) ? +p.freight : 0, u = Math.min(+p.qty, PE.poRecvUnits(p));
    return { p, rid: p.rid || null, date: best.date, quote: +p.total, freight: fr, units: +u, rate: +((+p.total + fr) / u).toFixed(4) };
  };
  const replay = (book) => {
    const differ = [], same = [], books = Object.keys(book.PRODUCTS || { salt: 1 });
    for (const prod of books) {
      const lots = (book.purchases || []).filter((p) => (p.product || "salt") === prod);
      const days = [...new Set(lots.map((p) => p.receivedOn || p.date).filter(Boolean))].sort();
      for (const day of days.concat([null])) {
        const a = PE.latestCogs(lots, day || undefined), b = oldLatest(lots, day || undefined);
        if (J(a) === J(b)) { same.push(prod + "@" + day); continue; }
        const min = +((RULES.COST_MIN || {})[prod]) || 0;
        differ.push({ at: prod + "@" + day, under: !!(b && b.units < min), rate: a && a.rate, was: b && b.rate });
      }
    }
    return { differ, same };
  };
  /* the plan's replay (docs/plan-small-lot.html, "Every lot since June"): only a newest lot under its minimum reads otherwise; by rate, only salt's 23 Jul 2026
     (MYR 64 to MYR 60) and, on the live book, candy from 17 Nov 2026. Salt's 22 Jul 2026 blends too (6.25 of p007 and 6.25 of p006) at the same MYR 56 */
  const frozen = JSON.parse(readFileSync(FROZEN_BOOK, "utf8")), live = JSON.parse(readFileSync(LIVE_BOOK, "utf8"));
  const rf = replay(frozen), fm = rf.differ.map((d) => [d.at, d.was, d.rate]);
  ok(rf.same.length >= 30 && rf.differ.every((d) => d.under) && J(fm) === J([["salt@2026-07-22", 56, 56], ["salt@2026-07-23", 64, 60]]),
    "L2: on the frozen book every book and every day a lot landed reads the old rule's object byte for byte, " + rf.same.length + " readings, but salt's 22 and 23 Jul 2026, a 6.25-unit lot each (MYR 56 held, MYR 64 to MYR 60): " + J(fm));
  const rl = replay(live), lm = rl.differ.map((d) => [d.at, d.was, d.rate]);
  /* the live book moves with every fold, so this half holds only what no fold can change (review of the small lot; L1 pins candy from its own lots):
     a reading moves only where the newest lot was under its minimum */
  ok(rl.same.length >= 30 && rl.differ.every((d) => d.under),
    "L2: on the live book a reading moves only where the newest lot was under its minimum: " + J(lm));

  /* L3: the edges, on invented lots */
  const lot = (rid, day, qty, total, more = {}) => Object.assign({ rid, product: "candy", date: day, receivedOn: day, qty, receivedQty: qty, total, cash: total, status: "paid" }, more);
  const short = PE.latestCogs([lot("pA", "2026-01-01", 3, 90), lot("pB", "2026-01-05", 2, 100, { freight: 10 })]);
  ok(short && short.units === 5 && short.rate === 40 && J((short.lots || []).map((l) => [l.rid, l.units])) === J([["pB", 2], ["pA", 3]]),
    "L3: lots that together fall short of the minimum are all taken whole: 5 units, MYR 200 over 5, MYR 40: " + J(short && [short.units, short.rate, short.lots]));
  const late = PE.latestCogs([lot("pA", "2026-01-01", 20, 400), lot("pB", "2026-01-05", 1, 60), lot("pC", "2026-01-09", 20, 2000)], "2026-01-06");
  ok(late && late.rid === "pB" && late.rate === 24 && J((late.lots || []).map((l) => l.rid)) === J(["pB", "pA"]),
    "L3: a lot landing after the day is never counted in a blend: by 06 Jan, 1 of pB at MYR 60 and 9 of pA at MYR 20, MYR 24: " + J(late && [late.rid, late.rate, late.lots]));
  const dead = PE.latestCogs([lot("pA", "2026-01-01", 20, 400), lot("pX", "2026-01-03", 20, 4000, { cancelled: true }), lot("pY", "2026-01-03", 20, 4000, { defaulted: true }),
    lot("pZ", "2026-01-04", 20, 4000, { pending: true, receivedQty: 0, receivedOn: undefined }), lot("pB", "2026-01-05", 1, 60)]);
  ok(dead && dead.rate === 24 && J((dead.lots || []).map((l) => l.rid)) === J(["pB", "pA"]),
    "L3: a cancelled, a defaulted and a pending lot are never counted in a blend: " + J(dead && [dead.rate, (dead.lots || []).map((l) => l.rid)]));
  const part = PE.latestCogs([lot("pA", "2026-01-01", 20, 400), lot("pB", "2026-01-05", 10, 300, { receivedQty: 4 })]);
  ok(part && J(part.lots) === J([{ rid: "pB", date: "2026-01-05", units: 4, rate: 75, draft: null }, { rid: "pA", date: "2026-01-01", units: 6, rate: 20, draft: null }]) && part.rate === 42,
    "L3: a partly landed lot counts over its units received, its whole quote on them: 4 of pB at MYR 75 and 6 of pA at MYR 20, MYR 42: " + J(part && [part.rate, part.lots]));
  const day = PE.latestCogs([lot("pA", "2026-01-05", 1, 50), lot("pB", "2026-01-05", 1, 90), lot("pC", "2026-01-01", 20, 400)]);
  ok(day && day.rid === "pB" && J((day.lots || []).map((l) => l.rid)) === J(["pB", "pA", "pC"]) && day.rate === 30,
    "L3: on one day the later in the list is the newer, then the one before it: pB, pA, then 8 of pC, MYR 30: " + J(day && [day.rid, day.rate, (day.lots || []).map((l) => l.rid)]));
  const zed = PE.latestCogs([lot("pA", "2026-01-01", 20, 400, { product: "zed" }), lot("pB", "2026-01-05", 1, 60, { product: "zed" })]);
  ok(zed && J(zed) === J(oldLatest([lot("pA", "2026-01-01", 20, 400, { product: "zed" }), lot("pB", "2026-01-05", 1, 60, { product: "zed" })])) && !("lots" in zed) && zed.rate === 60,
    "L3: a book COST_MIN does not name keeps the latest lot alone, MYR 60, as before: " + J(zed && [zed.rid, zed.rate]));
  const mixed = PE.latestCogs([lot("pA", "2026-01-01", 20, 400, { product: "salt" }), lot("pB", "2026-01-05", 1, 60)]);
  ok(mixed && mixed.units === 1 && J((mixed.lots || []).map((l) => l.rid)) === J(["pB"]),
    "L3: a blend takes only the newest lot's book, so a caller's stray salt lot never prices candy: " + J(mixed && mixed.lots));
  const atMin = PE.latestCogs([lot("pA", "2026-01-01", 20, 400), lot("pB", "2026-01-05", 10, 600, { freight: 5 })]);
  ok(atMin && J(atMin) === J(oldLatest([lot("pA", "2026-01-01", 20, 400), lot("pB", "2026-01-05", 10, 600, { freight: 5 })])) && atMin.rate === 60.5,
    "L3: a newest lot exactly at the minimum is that lot alone, the old answer: " + J(atMin && [atMin.rid, atMin.rate]));
  /* undated lots (review of the small lot: neither book holds one): an undated lot is the oldest, as the old rule read it, the later in the list the newer
     among them, and the day passes it as before */
  const U = (rid, qty, total) => Object.assign(lot(rid, undefined, qty, total), { date: undefined, receivedOn: undefined });
  const u1 = PE.latestCogs([U("pU", 50, 2000), lot("pA", "2026-01-01", 20, 400), lot("pB", "2026-01-05", 1, 60)]);
  ok(u1 && u1.rid === "pB" && u1.rate === 24 && J((u1.lots || []).map((l) => l.rid)) === J(["pB", "pA"]),
    "L3: an undated lot is the oldest: 1 of pB and 9 of pA, MYR 24, and the undated 50 units at MYR 40 are not reached: " + J(u1 && [u1.rid, u1.rate, u1.lots]));
  const u2 = PE.latestCogs([U("pU", 20, 400), U("pV", 1, 60)]);
  ok(u2 && u2.rid === "pV" && u2.rate === 24 && u2.date === null && J((u2.lots || []).map((l) => l.rid)) === J(["pV", "pU"]),
    "L3: among undated lots the later in the list is the newer: 1 of pV and 9 of pU, MYR 24: " + J(u2 && [u2.rid, u2.rate, u2.lots]));
  const uAt = [U("pU", 5, 150), lot("pB", "2026-01-05", 10, 600)], uAll = [U("pU", 30, 600), U("pV", 12, 600)];
  ok(J(PE.latestCogs(uAt)) === J(oldLatest(uAt)) && J(PE.latestCogs(uAll)) === J(oldLatest(uAll)) && PE.latestCogs(uAt).rid === "pB" && PE.latestCogs(uAll).rid === "pV",
    "L3: beside undated lots, a newest lot at the minimum is the old answer byte for byte, dated or undated: " + J([PE.latestCogs(uAt).rid, PE.latestCogs(uAll).rid]));
  const uDay = PE.latestCogs([U("pU", 50, 2000), lot("pB", "2026-01-05", 1, 60), lot("pC", "2026-01-09", 20, 2000)], "2026-01-06");
  ok(uDay && uDay.rid === "pB" && uDay.rate === 42 && J((uDay.lots || []).map((l) => l.rid)) === J(["pB", "pU"]),
    "L3: an undated lot passes the day, as before, and is taken last: 1 of pB and 9 of pU at MYR 40, MYR 42: " + J(uDay && [uDay.rid, uDay.rate, uDay.lots]));

  /* L4: the rule itself */
  ok(J(RULES.COST_MIN) === J({ salt: 12.5, oil: 10, candy: 10, rice: 100, gas: 1 }), "L4: COST_MIN is his five figures, typed per book in the rules: " + J(RULES.COST_MIN));

  /* L5: the page against the module, on the frozen book with candy's two newest lots added and a master rendered from it */
  const tmp = join(REPO, "test", "tmp", "small-lot-" + process.pid + "-" + Date.now());
  mkdirSync(tmp, { recursive: true });
  try {
    const book = Object.assign({}, frozen, { purchases: frozen.purchases.concat([P057, P062]) });
    const bookFile = join(tmp, "book.json"), masterFile = join(tmp, "salt_command.html");
    writeFileSync(bookFile, JSON.stringify(book));
    writeFileSync(masterFile, syncText(readFileSync(process.env.SALT_MASTER || FROZEN_MASTER, "utf8"), book));
    const { w } = await openMaster(masterFile, { before: (win) => { win.Date.now = () => NOW; } });
    const page = JSON.parse(String(w.eval("(function(){var k=PROD;PROD='candy';recompute();var c=pxCost(),l=POSITION_ENGINE.latestCogs(pPurch('candy'));"
      + "var o={effEx:c.effEx,latest:c.latest,rate:l&&l.rate,min:JSON.stringify(PRICING_RULES.COST_MIN),pricing:tabPricing(),sourcing:tabSourcing()};PROD=k;recompute();return JSON.stringify(o);})()")));
    const mod = PE.latestCogs(book.purchases.filter((p) => p.product === "candy"));
    const drafted = cogsFor({ purchases: book.purchases }, "candy", "2026-11-25");
    ok(page.rate === 47.2 && page.effEx === 47.2 && mod.rate === 47.2 && drafted.cost === 47.2,
      "L5: on that book the Desk's master in jsdom, the module and the drafter all give candy MYR 47.20: " + J([page.rate, page.effEx, mod.rate, drafted.cost]));
    ok(page.min === J(RULES.COST_MIN), "L4: and the page's COST_MIN is the module's: " + page.min);
    ok(page.latest && page.latest.units === 10 && J(page.latest.lots) === J(mod.lots), "L5: the page's cost stack carries the lots the module names: " + J(page.latest));
    const snap = pricingSnapshot(w), eng = pricingFromBook(book, NOW);
    const cl = snap.byProduct.candy.ladder.find((r) => r.q === 1), el = eng.byProduct.candy.ladder.find((r) => r.q === 1);
    ok(snap.byProduct.candy.floors["1"].floor === 50 && cl && J(cl.prices) === J([50, 60]) && J(el && el.prices) === J([50, 60]),
      "L5: candy's Floor is MYR 50 at 1 unit and the board's MYR 60 stands over it, on the page and from the book alone: " + J([snap.byProduct.candy.floors["1"], cl, el]));
    const elat = eng.byProduct.candy.inputs.cost.latest, stack = PX.costStack(eng.byProduct.candy.inputs.cost).latest;
    ok(elat && J(elat.lots) === J(mod.lots) && elat.units === 10 && stack && J(stack.lots) === J(mod.lots),
      "L5: the snapshot's latest and the cost stack's carry the lots, newest first: " + J([elat && elat.lots, stack && stack.lots]));
    const fz = pricingFromBook(frozen, NOW).byProduct, plain = Object.keys(fz).filter((p) => fz[p].inputs && fz[p].inputs.cost && fz[p].inputs.cost.latest);
    ok(plain.length >= 4 && plain.every((p) => !("lots" in fz[p].inputs.cost.latest) && !("lots" in (PX.costStack(fz[p].inputs.cost).latest || {}))),
      "L5: on the frozen book today, where no book's newest lot is under its minimum, neither the snapshot nor the stack carries lots: " + plain.join());
    const diff = pricingDiffer(eng.byProduct, snap.byProduct);
    ok(diff.length === 0, "L5: the page's pricing is the engine's from the book alone, on the book with candy's lots: " + (diff.join() || "equal"));
    const text = (h) => String(h).replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ");
    const pg = text(page.pricing), so = text(page.sourcing);
    const said = {
      floor: /Floor RM 47\.20 a unit, the newest 10 units: 1 of p057 at RM 94 and 9 of p031 at RM 42; times the size/.test(pg),
      cogs: /COGS is RM 47\.20 a unit off the newest 10 units, quote plus freight/.test(pg),
      repl: /Replacement rate the newest 10 units, 1 of p057 and 9 of p031: their quotes over those units RM 44\.70/.test(pg),
      freight: /the trips of 1 of p057 and 9 of p031, RM 25 over the newest 10 units RM 2\.50/.test(pg),
      caption: /Pricing basis COGS, the floor a unit: landed off the newest 10 units RM 47\.20/.test(pg),
      moved: /The basis moves with the lots: RM 44\.70 on the newest 10 units, 1 of p057 and 9 of p031, each at its own quote\./.test(pg),
      kpi: /Freight per unit RM 2\.50 the trips over the newest 10 units/.test(so),
      none: !/latest purchase/.test(pg + so)
    };
    ok(Object.values(said).every(Boolean), "L5: Pricing names the newest 10 units and each lot in its seven places, and says the latest purchase nowhere: " + J(said));
  } finally { rmSync(tmp, { recursive: true, force: true }); }

  /* L6: the drafter and the Workbench */
  const mirror = (lots, draftLots = []) => ({ version: "v1", purchases: lots, draftLots, sales: [], pricing: pricingFromBook(Object.assign({}, frozen, { purchases: frozen.purchases.concat([P057]) }), NOW),
    state: { roster: ["CZ9-DA"], PRODUCTS: { salt: {}, candy: {} }, QUEUE_COMMITTED: "2026-11-24T00:00:00.000Z" } });
  const sell = (qty, total) => ({ at: "2026-11-25T01:00:00.000Z", payload: { mode: "new", direction: "SELL", product: "candy", party: "CZ9-DA", qty, total, cash: total, kg: qty, date: "2026-11-25" } });
  const d1 = draftRow(sell(2, 60), mirror([P027, P031, P057]));
  const all = (d) => [d.reasoning || "", d.row && d.row.note || "", ...(d.flags || [])].join(" | ");
  ok(d1 && d1.row && d1.row.cost === 94.4 && /COGS off the newest 10 units: 1 of purchase p057 at RM 94 and 9 of purchase p031 at RM 42/.test(all(d1)),
    "L6: a candy sale is costed at MYR 47.20 a unit and its note names the newest 10 units, each lot at its own rate: " + J(d1 && d1.row && d1.row.cost) + " " + all(d1).slice(0, 400));
  /* flag 4 names the basis only for a row that carries no cost of its own (a drafted row carries cogsFor's, and says "stated on the row itself") */
  const M1 = mirror([P027, P031, P057]), f4 = flagsFor(sell(2, 60), { customer: "CZ9-DA", product: "candy", qty: 2, total: 60, date: "2026-11-25" }, M1, cogsFor(M1, "candy", "2026-11-25"));
  ok(f4.some((f) => /against a cost of RM 47\.2, COGS off the newest 10 units: it loses money/.test(f)) && (d1.flags || []).some((f) => /purchase plus freight off the newest 10 units/.test(f)),
    "L6: the below-cost flag and the under-the-Floor flag say the units counted: " + J(f4.concat(d1.flags || []).filter((f) => /newest|latest/.test(f))));
  const dl = lot(undefined, "2026-11-10", 4, 160);
  delete dl.rid; dl._draft = "2026-11-10T02:00:00.000Z";
  const d2 = draftRow(sell(2, 120), mirror([P027, P031, P057], [dl]));
  ok(d2 && d2.row && d2.row.cost === 92.8 && (d2.flags || []).some((f) => /drafted purchase 2026-11-10T02:00:00\.000Z/.test(f) && /not on the book yet/.test(f))
    && /4 of drafted purchase 2026-11-10T02:00:00\.000Z \(not yet folded\) at RM 40/.test(all(d2)),
    "L6: a drafted lot second in the blend (p057 newest) is named in the note and raises the flag: " + J(d2 && d2.row && d2.row.cost) + " " + J((d2.flags || []).filter((f) => /drafted/.test(f))));
  const wb = makerTradeReading({ direction: "purchase", product: "candy", qty: 1, total: 30 }, mirror([P027, P031, P057]));
  ok(wb && wb.cogs && wb.cogs.source === "the newest 10 units" && wb.cogs.rate === 47.2, "L6: Salt Admin's Workbench reads the cost from the newest 10 units: " + J(wb && wb.cogs && [wb.cogs.rate, wb.cogs.source]));
  const wb1 = makerTradeReading({ direction: "purchase", product: "candy", qty: 1, total: 30 }, mirror([P027, P031]));
  ok(wb1 && wb1.cogs && wb1.cogs.source === "the latest purchase" && wb1.cogs.rate === 42, "L6: and from the latest purchase where that lot reaches the minimum: " + J(wb1 && wb1.cogs && [wb1.cogs.rate, wb1.cogs.source]));

  /* L7: one function decides the cost. Widened on review of the small lot (four shapes slipped past two patterns): any code line outside the position
     engine that names a lot's total, quote or goods, names its freight, and divides */
  const COST = (l) => /\b(?:total|quote|goods)\b/.test(l) && /\b(?:freight|fr)\b/.test(l) && /[\w)\]]\s*\/\s*[\w(+]/.test(l);
  const EXEMPT = [
    "const perUnit = +((goods + (body.freight || 0)) / qty).toFixed(2);",   /* the Workbench's figure for a purchase being entered: that entry's own rate, not a cost */
    "COGS is ${fmt(sC.landed)} a unit off"                                   /* Pricing's sentence: "quote plus freight" in its words, the leak's share in its sum */
  ];
  const GENERATED = ["stmt/maker-geo.js"];   /* the map's points, one line of data */
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/(^|[^:"'`\\])\/\/.*$/, "$1")).join("\n");
  const files = [["engine", ".mjs"], ["src", ".js"], ["stmt", ".js"], ["tools", ".mjs"]].flatMap(([d, x]) => readdirSync(join(REPO, d)).filter((f) => f.endsWith(x)).map((f) => d + "/" + f));
  const hits = [];
  for (const f of files) {
    if (f === "engine/position.mjs" || GENERATED.includes(f)) continue;   /* latestCogs itself, the one copy */
    strip(readFileSync(join(REPO, f), "utf8")).split("\n").forEach((l, i) => { if (COST(l) && !EXEMPT.some((e) => l.includes(e))) hits.push(f + ":" + (i + 1)); });
  }
  const m = readFileSync(process.env.SALT_MASTER || FROZEN_MASTER, "utf8");
  const own = m.replace(/\/\* ==== ENGINE (\w+):[\s\S]*?\/\* ==== END ENGINE \1 ==== \*\//g, "").replace(/\/\* ==== BOOK[\s\S]*?\/\* ==== END BOOK ==== \*\//, "");
  strip(own).split("\n").forEach((l, i) => { if (COST(l) && !EXEMPT.some((e) => l.includes(e))) hits.push("master:" + (i + 1)); });
  const pos = strip(readFileSync(join(REPO, "engine", "position.mjs"), "utf8")).split("\n").filter((l) => /\(\+p\.total\+fr\)\/u/.test(l)).length;
  const shapes = ["x=(+lot.total+(+lot.freight||0))/lot.qty", "r=(freight + total) / units", "(+p.total+fr)/u", "((+p.total||0)+(+p.freight||0))/q", "(Number(p.total)+Number(p.freight))/u", "+p.total/u+(+p.freight||0)/u"];
  ok(files.length > 40 && hits.length === 0 && pos === 1 && shapes.every(COST) && !COST("const lot=+LC.quote/+LC.units;") && strip("a=1; // (+p.total+p.freight)/u") === "a=1; ",
    "L7: no file but the position engine works out a cost from a lot's quote and freight (" + files.length + " files and the master's own script read, six shapes caught): " + (hits.join(", ") || "none"));

  /* L8: a book COST_MIN does not name is said so when opened */
  const tmp8 = join(REPO, "test", "tmp", "small-lot-product-" + process.pid + "-" + Date.now());
  mkdirSync(tmp8, { recursive: true });
  try {
    const bk = join(tmp8, "book.json"), ms = join(tmp8, "master.html");
    writeFileSync(bk, readFileSync(FROZEN_BOOK, "utf8"));
    writeFileSync(ms, readFileSync(process.env.SALT_MASTER || FROZEN_MASTER, "utf8"));
    const r = spawnSync(process.execPath, [join(REPO, "tools", "product.mjs"), "--add", "zz", "--name", "Zed"], { env: Object.assign({}, process.env, { SALT_BOOK: bk, SALT_MASTER: ms }), encoding: "utf8" });
    ok(r.status === 0 && /NO SMALL-LOT MINIMUM: COST_MIN in engine\/rules\.mjs does not name zz, so this book prices off its latest lot alone until a version names it there\./.test(r.stdout || ""),
      "L8: tools/product.mjs opens a book and says it prices off its latest lot alone until a version names it in COST_MIN: " + J([r.status, (r.stdout || "").split("\n").filter((l) => /SMALL-LOT|added/.test(l))]));
    /* review of the small lot: a rename moves every key but COST_MIN's, which a version sets, so the tool says the renamed book has lost its minimum */
    const rn = spawnSync(process.execPath, [join(REPO, "tools", "product.mjs"), "--rename", "candy", "sweets", "--orders-done"], { env: Object.assign({}, process.env, { SALT_BOOK: bk, SALT_MASTER: ms }), encoding: "utf8" });
    ok(rn.status === 0 && /NO SMALL-LOT MINIMUM: COST_MIN in engine\/rules\.mjs names candy \(10\) and not sweets, so sweets prices off its latest lot alone until a version names it there\./.test(rn.stdout || ""),
      "L8: and renaming candy says the new name prices off its latest lot alone until a version names it: " + J([rn.status, (rn.stdout || "").split("\n").filter((l) => /SMALL-LOT|renamed/.test(l)), (rn.stderr || "").slice(0, 200)]));
  } finally { rmSync(tmp8, { recursive: true, force: true }); }
}
