/* engine/apply.mjs: THE BOOKING LAW, THE ROW CORE (S1a-i of the Book plan, 14 Oct 2026). Lifted out of tools/fold.mjs with no
 * behaviour change: how an amendment is written on a row (applyAmend), and what a planned batch does to a book (applyBatch):
 * the rows, the cost stamps, the rids, the counts, the roll and the renames, in the order the fold has always done them.
 *
 * PURE. No fs, no child process, no clock, no reading of the master, and it never mutates what it is handed: applyBatch works on a
 * clone and returns it. What the fold read from disk or the clock comes in through `ctx`: { driftBooks, pinnedInMaster(code),
 * today, reward } for the plan, and { nextRid, sortBook } for the booking, the last two being tools/rid.mjs's and tools/sort-ledger.mjs's, which
 * read files and so stay outside.
 * It is NOT in tools/engine.mjs's list, so the master's ENGINE block does not carry it, and nothing under stmt/ may import it. */
import POSITION_ENGINE from "./position.mjs";
import PRICING_ENGINE from "./pricing.mjs";
import PRICING_RULES from "./rules.mjs";
import { verifiedVaultRegistration } from "../src/vault-pair.js";
import { CORRECT_BOOL, CORRECT_DATE, CORRECT_NUM_NN, CORRECT_NUM_POS, CORRECT_TEXT } from "../src/drafter.js";

const E = POSITION_ENGINE;
const r2 = (v) => +(+v).toFixed(2);
/* which entry made each of a plan's moves (a WeakMap, so the plan's own text is unchanged) */
const MOVE_OF = new WeakMap(), PLANNED = new WeakSet();
/* a plan planBatch did not build (or a clone of one) has no attribution, so this throws rather than answer [] (applyInto reads it for every entry) */
export const movesOf = (p, it) => {
  if (!PLANNED.has(p)) throw new Error("movesOf: not a plan built by planBatch");
  return p.moves.filter((m) => MOVE_OF.get(m) === it.id);
};
function prodOf(row) { return (row && row.product) || "salt"; }

/* The attribution rule lives in engine/position.mjs, because the desk, this fold and the
   phone payload all need the same answer to "who is the associate on this row". Both this
   file and the master carried their own copy for about an hour on 25 Aug, which is exactly
   the drift the engine exists to stop. */
const attributionOf = E.attributionOf;

/* v449: THE FIRST STEP OF A TRAIL IS THE ROW AS BOOKED, READ WITH THE ROW'S OWN RULER. Three sites
   seeded it with txPaid and txDeliv, which read cash, settledRM, deliveredQty and settledKg and know
   nothing of a lot: on p001, paid in full and 12.5 unit received, they read RM 0 and 0 unit, so the
   first Correction on any lot would have opened its trail with "as booked: nothing paid, nothing
   received". The same twin as v441 and v446, in the seed rather than the status. One helper now,
   and the desk's ovSeed is its mirror. */
function seedStep(row, dir) {
  return { date: row.date, kind: "Fulfilment", cash: dir === "BUY" ? E.poCash(row) : E.txPaid(row),
    kg: dir === "BUY" ? E.poRecvUnits(row) : E.txDeliv(row), note: "as booked" + (row.date ? "" : ", pending and undated") };
}
export function applyAmend(row, pay, dir, note) {   /* v413: exported so the suite can FOLD a cancellation rather than grep the source for one */
  /* A CORRECTION REWRITES WHAT THE ROW SAYS, and nothing else. It moves no cash and no stock,
     so cash, deliveredQty, receivedQty and the shelf are untouched by design: those move by
     fulfilment, and letting an editor set them directly would put two writers on one figure.

     WHAT IT DOES WRITE, besides the field, is a line in the trail saying what the value was
     before. The rate is the record: a row whose price changed without saying so is worse than
     no row at all, so every correction leaves its old value readable in `mod`. */
  /* A CORRECTION REWRITES WHAT THE ROW SAYS, and from 25 Aug 2026 that is EVERY attribute a
     person states: what was traded, who it books to, when, what has actually moved, what was
     settled other than in cash, and the row's own flags. It still writes nothing the desk
     computes: rid is identity, amend and mod are the trail, rev/ref/refKg follow from the
     attribution, and a purchase's status is recomputed from cash against total below.

     WHAT IT ALWAYS WRITES, besides the fields, is a line saying what each was before. The rate
     is the record: a row whose price or party changed without saying so is worse than no row,
     so every correction leaves its old values readable in `mod`. */
  if (pay.kind === "Correction") {
    /* v739: the SHELF follows a corrected deliveredQty or receivedQty through plan()'s moves; this applier
       still writes only the row. */
    /* v416: CAPTURE THE PAYMENT BEFORE ANY FIELD IS WRITTEN. poCash reads status:"paid" as
       meaning the row's TOTAL, so calling it after a total correction returns the NEW total as
       the amount paid, and a RM 10 price fix would read as RM 10 already paid. Read once, at
       the top, off the row as it arrived. */
    const paidBefore = E.poCash(row);
    const f = pay.fields || {};
    /* v436: and the WRITER refuses too, rather than trusting the plan above to have looked. A
       correction reaching applyAmend by any other road -- a hand-written _to_fold.json, the
       differential test, a future caller -- got no check at all before this line. */
    const faults = E.correctionFaults(row, f, dir !== "BUY");
    if (faults.length) throw new Error(faults[0]);
    /* plan 4: AN UNDO IS CHECKED AGAIN BY THE WRITER, on the row as it arrives: the newest move still, and the figures undoing it sets */
    const undo = pay.undo != null ? E.undoOf(row, pay.undo) : null;
    if (undo && undo.fault) throw new Error("the undo was refused: " + undo.fault);
    if (undo && !E.undoSame(undo.fields, f)) throw new Error("the undo was refused: it does not set what undoing that move sets");
    const partyKey = dir === "BUY" ? "supplier" : "customer";
    const attr = E.attributionOf(row, partyKey);
    const buyerNow = attr.stream === "R2" ? (attr.downstream || null) : (row[partyKey] || null);
    const before = Object.assign({}, row, {
      product: row.product || "salt", party: buyerNow,
      assoc: attr.assoc, stream: attr.stream, downstream: attr.downstream,
    });
    const asked = (k) => Object.prototype.hasOwnProperty.call(f, k) && f[k] !== undefined;
    /* v385: `said` IS BUILT AT THE FOOT OF THIS BLOCK, FROM WHAT WAS WRITTEN, NOT FROM WHAT WAS
       ASKED. It used to be built here, by walking Object.keys(f), while the writes below walk
       CORRECTABLE. Two lists, no check that they agreed, and at v381 they did not: a correction
       naming `customer` wrote nothing and claimed a re-key anyway, on two rows. v383 made the
       fold REFUSE an unknown field, which stops the known case; building the claim from the
       write makes the whole class impossible, because a field nothing wrote cannot be claimed.
       Reasons carry the one thing a diff cannot know: WHY a value the editor did not name
       moved. */
    const reasons = {};

    /* THE PLAIN FIELDS: set, or delete when cleared. Everything numeric, dated or textual goes
       through here, so adding a field to the drafter's table is all it takes to make it
       editable end to end. */
    const PLAIN = [].concat(CORRECT_NUM_POS, CORRECT_NUM_NN, CORRECT_DATE, CORRECT_TEXT);
    for (const k of PLAIN) {
      if (!asked(k)) continue;
      if (f[k] === null) delete row[k]; else row[k] = f[k];
    }
    /* 08 Sep 2026: THE COST FOLLOWS THE QUANTITY. `cost` is the order's absolute cost (v496) and a
       Modification rescales it; a Correction of qty wrote the quantity and left the cost, so 1 unit
       to 2 halved the unit cost and the margin read 78% for 56%. Scaled unless the correction set
       the cost itself. */
    if (asked("qty") && !asked("cost") && before.cost != null && +before.qty > 0 && +row.qty > 0) {
      row.cost = +(before.cost / before.qty * row.qty).toFixed(2);
      reasons.cost = "the order's cost follows its quantity";
    }
    /* A FALSE FLAG IS AN ABSENT FLAG on this book. Every row that is not cancelled simply has
       no `cancelled` key, and writing cancelled:false would make the corrected row the only
       one shaped differently from its peers, which is the same reason product:"salt" is
       deleted rather than written. */
    for (const k of CORRECT_BOOL) {
      if (!asked(k)) continue;
      if (f[k] === true) row[k] = true; else delete row[k];
    }
    /* 05 Oct 2026 (A4): a lot revived from a default loses the date of the default with it */
    if (asked("defaulted") && f.defaulted !== true) delete row.defaultedOn;
    /* A ROW WITH AN AGREED FIGURE IS PRICED BY DEFINITION. Same behaviour as a Modification,
       which has cleared the flag since v358; a correction that sets the total should not need
       a second tap to say so, and the trail records that it happened. */
    if (!asked("unpriced") && asked("total") && f.total > 0.005 && row.unpriced) {
      delete row.unpriced;
      reasons.unpriced = "a real total was set";
    }
    /* THE v146 GUARD, on the correction road too. poRecvUnits reads an ABSENT receivedQty as
       fully received, which is how every settled historical lot is stored. So clearing
       `pending` alone would walk the whole lot into stock and the cost basis the moment a
       deposit is recorded; the receipt has to be stated explicitly: nothing has arrived, the
       lot is on order. ovAmend's fulfilment path does exactly this, for exactly this reason. */
    if (dir === "BUY" && asked("pending") && f.pending !== true && row.receivedQty == null) {
      row.receivedQty = 0; row.inTransit = true;
      reasons.receivedQty = "the lot is on order and nothing has arrived";
      reasons.inTransit = "the lot is on order and nothing has arrived";
    }
    if (asked("product")) { if (f.product === "salt") delete row.product; else row.product = f.product; }

    /* THEN THE ATTRIBUTION, once, from the three fields read together. A per-field write would
       see them half-applied and book the row to a code that was only ever half-chosen. */
    const wantAssoc = asked("assoc") ? f.assoc : attr.assoc;
    const wantStream = asked("stream") ? f.stream : attr.stream;
    let wantBuyer = asked("party") ? f.party : buyerNow;
    if (asked("downstream") && f.downstream !== null) wantBuyer = f.downstream;
    delete row.rev; delete row.ref; delete row.refKg; delete row.downstream;
    if (wantAssoc && wantStream === "R3") {
      row[partyKey] = wantBuyer; row.ref = wantAssoc; row.refKg = row.qty;
    } else if (wantAssoc) {
      /* v611: into the associate's bucket, the one writer the drafter and the desk read too; a
         named buyer is noted, and the bucket itself is never kept as a buyer */
      POSITION_ENGINE.bookR2(row, partyKey, wantAssoc, wantBuyer);
    } else {
      /* CLEARING AN R2 PUTS THE BUYER BACK, or the row stays booked to the associate with
         nothing left saying who actually bought it. v611: with no buyer named, a row leaving a
         bucket goes to the associate who owns it, never to the bucket as a buyer in its own right. */
      row[partyKey] = wantBuyer || POSITION_ENGINE.ownerCode(row[partyKey]);
    }

    /* A PURCHASE'S status IS DERIVED, so it is recomputed rather than offered. ovAmend does
       exactly this after a payment, and a corrected cash or total has to leave the same answer. */
    /* ONLY WHEN A FIGURE IT DERIVES FROM WAS SET. An old lot stores its payment as
       status:"paid" with no cash field at all, so an unconditional recompute read paid as
       zero and flipped the lot to unpaid on ANY correction, a date fix included. Touch the
       status only when cash or total moved, and read what was asked rather than a raw field
       that is legitimately absent. */
    if (dir === "BUY" && (asked("cash") || asked("total"))) {
      /* v416: was a raw read, so a lot stored status:"paid" with no cash field read as nothing
         paid and a price correction alone rewrote it to unpaid, inventing a payable for money
         already handed over. Five lots on the book are stored that way, RM 5,450 of them. */
      const paid = asked("cash") ? (row.cash != null ? +row.cash : 0) : paidBefore;
      row.status = paid >= (row.total || 0) - 0.009 ? "paid" : (paid <= 0.009 ? "unpaid" : "partial");
    }

    /* NOW READ THE ROW BACK AND SAY WHAT ACTUALLY MOVED. attributionOf is the same function the
       desk, the payload and the fold all use to answer who a row books to, so the three stated
       attribution fields are compared the way they are READ rather than the way they were
       stored, which is the only comparison that can be trusted after the R2/R3 rewrite above. */
    const attrNow = E.attributionOf(row, partyKey);
    const after = Object.assign({}, row, {
      product: row.product || "salt",
      party: attrNow.stream === "R2" ? (attrNow.downstream || null) : (row[partyKey] || null),
      assoc: attrNow.assoc, stream: attrNow.stream, downstream: attrNow.downstream,
    });
    const said = [], was = {};
    for (const k of E.CORRECTABLE) {
      const was0 = before[k] === undefined ? null : before[k];
      const now = after[k] === undefined ? null : after[k];
      if (JSON.stringify(was0) === JSON.stringify(now)) continue;
      const why = reasons[k] ? `, ${reasons[k]}` : "";
      said.push(`${k} ${was0 == null ? "(unset)" : was0} to ${now == null ? "(cleared)" : now}${why}`);
      was[k] = was0;
    }
    if (undo && !said.length) throw new Error("the undo was refused: the row already says what undoing that move sets");

    if (said.length) {
      const line = `corrected${pay.date ? " on " + pay.date : ""}: ${said.join("; ")}`;
      row.mod = row.mod ? row.mod + ", then " + line : line;
      if (!row.amend || !row.amend.length) {
        /* v439: the undated suffix its two siblings have carried since v420. This was the third
           site of the same seeding and the only one without it, so a correction on an undated row
           seeded a step that did not say the row was pending. The desk had it; the fold did not.
           28 Sep 2026: SEEDED FROM THE ROW AS IT ARRIVED (`before`), since the step says "as booked" and the
           fields above are already written: a first handover folded as a Correction seeded its own units at the
           booking date, and with the units now on the Correction's step they would have counted twice. */
        row.amend = [seedStep(before, dir)];
      }
      /* 28 SEP 2026 (his instruction that overdue counts from the handover): A CORRECTION THAT RESTATES WHAT MOVED
         CARRIES THE UNITS IT MOVED on its step, the difference the shelf is rolled by, so the day each stage of a
         site handover went survives on the row: deliveredOn is the last handover's, overwritten at every stage, and
         the engine's txUnpaidSince walks the steps to date the goods still unpaid. A step moving nothing says 0. The
         units are the engine's reading, never the raw field: a lot with no receivedQty has received the lot. */
      const units = dir === "BUY" ? E.poRecvUnits : E.txPhys;
      const moved = +(units(after) - units(before)).toFixed(3);
      /* plan 4 (16 Oct 2026): AND IT SAYS WHAT IT REPLACED (`was`), so the change can be undone from its own record. An undo's step names
         the step it undoes and moves nothing on the walk (its units are the step's it undoes, now passed over), and that step is marked undone. */
      const step = { date: pay.date || null, kind: "Correction", cash: 0, kg: undo ? 0 : (Math.abs(moved) > 0.0009 ? moved : 0), note: note || line, was };
      if (undo) {
        step.undoes = undo.i;
        /* what the undo took back, by the engine's readings, which the site order follows (src/orders.js tellSite) */
        const tookCash = +(E.txPaid(before) - E.txPaid(after)).toFixed(2), tookUnits = +(E.txPhys(before) - E.txPhys(after)).toFixed(4);
        if (dir !== "BUY" && (tookCash > 0.004 || tookUnits > 0.0004)) step.took = Object.assign({}, tookCash > 0.004 ? { cash: tookCash } : {}, tookUnits > 0.0004 ? { units: tookUnits } : {});
      }
      row.amend = row.amend.concat([step]);
      if (undo) row.amend[undo.i] = Object.assign({}, row.amend[undo.i], { undone: pay.date || true });
    }
    if (note && !asked("note")) row.note = note + " " + (row.note || "");
    return;
  }
  if (pay.kind === "Modification") {
    const wasQty = row.qty, wasTotal = row.total;
    /* v416: CAPTURE THE PAYMENT BEFORE ANY FIELD IS WRITTEN. poCash reads status:"paid" as
       meaning the row's TOTAL, so calling it after a total correction returns the NEW total as
       the amount paid, and a RM 10 price fix would read as RM 10 already paid. Read once, at
       the top, off the row as it arrived. */
    const paidBefore = E.poCash(row);
    const modLine = `restated${pay.date ? " on " + pay.date : ""} from ${wasQty} unit / RM${wasTotal} to ${pay.newQty} unit / RM${pay.newTotal}`;
    row.mod = row.mod ? row.mod + ", then " + modLine : modLine;
    if (dir === "BUY") {
      /* v450: A LOT KEEPS A TRAIL. This branch and the movement branch below returned before the seed
         and the step, so a lot restated or fulfilled through the fold carried no trail at all, the one
         lot with a step (p016) had it written by hand, and the Ledger had nothing to draw. The same
         seed and the same step the SELL tail writes, in the same order: before the figures move. */
      if (!row.amend || !row.amend.length) row.amend = [seedStep(row, dir)];
      { const step = { date: pay.date, kind: "Modification", cash: 0, kg: 0 }; if (note) step.note = note; row.amend = row.amend.concat([step]); }
      row.qty = pay.newQty;
      row.total = pay.newTotal;
      const paid = paidBefore;                       /* v416: what was paid, not what is now owed */
      row.status = paid >= row.total - 0.009 ? "paid" : (paid <= 0.009 ? "unpaid" : "partial");
      if (note) row.note = note + " " + (row.note || "");
      return;
    }
    /* SELL: qty and total are REPLACED, not added to, which is what "restate" means and what
       tells this apart from a Fulfilment. Nothing moves, so cash/deliveredQty are untouched. */
    if (!row.amend || !row.amend.length)
      row.amend = [seedStep(row, dir)];
    const step = { date: pay.date, kind: "Modification", cash: 0, kg: 0 };
    if (note) step.note = note;
    row.amend = row.amend.concat([step]);
    /* v496: the order's cost is absolute and follows its quantity, so the unit cost it was costed at is kept. */
    if (row.cost != null && row.qty > 0) row.cost = +(E.txUnitCost(row) * pay.newQty).toFixed(2);
    row.qty = pay.newQty;
    row.total = pay.newTotal;
    if (row.unpriced && pay.newTotal > 0) delete row.unpriced;
    return;
  }
  /* v434, ROUND TEN: THE GATE MEASURED THE ROW AND NOT THE ORDER OF THE BATCH. Cancelling a row that
     has moved nothing is legitimate and passes; recording a movement on a row that is ALREADY
     cancelled is the same contradiction from the other side, and nothing said so. So two approved
     items against one row were each faultless alone and the outcome turned on which id sorted
     first: cancel-then-fulfil left s119 {cancelled:true, cash:10, deliveredQty:1} with a unit off
     the shelf carrying neither revenue nor cost, which is verbatim the v407 failure, while
     fulfil-then-cancel threw. Both orders refuse now. A Correction, a Modification and a repeat
     Cancellation are still allowed on a cancelled row, because restating the record of one is not
     the same as moving goods against it. */
  if (row.cancelled && ((+pay.cash || 0) > 0.009 || (+pay.kg || 0) > 0.009))
    throw new Error(`this row is already cancelled, so ${(+pay.cash || 0) > 0.009 ? "RM " + (+pay.cash) + " " : ""}${(+pay.kg || 0) > 0.009 ? (+pay.kg) + " unit " : ""}cannot be recorded against it: revive it by Correction first, or record the movement on the row that actually carries it`);
  /* 05 Oct 2026 (A4): a defaulted lot takes no money and no units, as a cancelled row takes none. */
  if (row.defaulted && ((+pay.cash || 0) > 0.009 || (+pay.kg || 0) > 0.009))
    throw new Error("this lot is already a supplier default, so it cannot take a payment or a receipt: restate it by Correction first if it was marked in error");
  /* 28 Sep 2026, s210: the writer refuses it too, before it touches the row, rather than trusting plan() to have looked
     (the v436 reason): a payment measured before other money reached the row, which would take it past what it owes */
  { const pf = E.payFault(row, pay.cash, dir !== "BUY", pay.drafted); if (pf) throw new Error(pf); }
  if (dir === "BUY") {
    /* v435, ROUND TEN: A LOT THAT HAS ARRIVED CANNOT HAVE BEEN DEFAULTED ON. The flag means the supplier
     took the money and sent nothing, and poRecvUnits short-circuits on it, so setting it on a
     landed lot does not merely mislabel the row: it ERASES the goods. Defaulting p001 took its
     received quantity from 12.5 to 0, walking stock that is physically on the shelf out of the
     book. Seventeen lots were offerable. */
    if (pay.kind === "Default") {
      const arrived = E.poRecvUnits(row);
      if (arrived > 0.009) throw new Error(`this lot has received ${arrived} unit, so it cannot be recorded as a supplier default: a default means nothing arrived. Restate the quantity by Modification for what did arrive, then default the remainder`);
      /* 05 Oct 2026 (A4): a default is dated and leaves its step in the lot's trail, as a cancellation does. */
      if (!row.amend || !row.amend.length) row.amend = [seedStep(row, dir)];
      { const step = { date: pay.date, kind: "Default", cash: 0, kg: 0 }; if (note) step.note = note; row.amend = row.amend.concat([step]); }
      row.defaulted = true; if (pay.date) row.defaultedOn = pay.date; delete row.receivedOn; delete row.pending; return;
    }
    /* v413, ROUND EIGHT, MATERIAL: this branch RETURNED before the Cancellation handler below, so
       cancelling a lot set nothing, fell through to the status recompute, and rewrote a lot stored
       status:"paid" to unpaid. One right-click and an approval, and the chip, the panel, the draft
       reasoning, plan(), apply() and the desk overlay all reported success. */
    /* v450: the seed and the step, before anything moves; see the Modification branch. */
    if (!row.amend || !row.amend.length) row.amend = [seedStep(row, dir)];
    { const step = { date: pay.date, kind: pay.kind, cash: +pay.cash || 0, kg: +pay.kg || 0 }; if (note) step.note = note; row.amend = row.amend.concat([step]); }
    if (pay.kind === "Cancellation") {
      const movedB = E.poRecvUnits(row);
      if (movedB > 0.009) throw new Error(`cancelling this lot would leave it carrying ${movedB} unit already received, which contradicts itself: restate qty by Modification for what arrived, then cancel the remainder`);
      row.cancelled = true; if (pay.date) row.cancelledOn = pay.date; return;
    }
    const wasPending = !!row.pending;
    if (((+pay.cash || 0) > 0.009) || ((+pay.kg || 0) > 0.009)) {
      delete row.pending;
      if (wasPending && row.receivedQty == null) { row.receivedQty = 0; row.inTransit = true; }
    }
    if ((+pay.cash || 0) > 0.009) {
      const before = wasPending ? 0 : (row.cash != null ? row.cash : (row.status === "paid" ? row.total : 0));
      row.cash = +(before + (+pay.cash)).toFixed(2);
    }
    if ((+pay.kg || 0) > 0.009) {
      row.receivedOn = pay.date;
      const had = row.receivedQty != null ? row.receivedQty : ((wasPending || row.inTransit) ? 0 : row.qty);
      row.receivedQty = Math.max(0, Math.min(had + (+pay.kg || 0), row.qty));
      if (row.receivedQty >= row.qty - 0.0001) delete row.inTransit; else row.inTransit = true;
    }
    /* v413: the accumulator nine lines above honours status:"paid" as meaning the total, and this
       did not, so ANY unit-only fulfilment on a settled lot rewrote it to unpaid and invented
       supplier bills that had been settled. One convention, read by both. */
    const paid = E.poCash(row);
    row.status = paid >= row.total - 0.009 ? "paid" : (paid <= 0.009 ? "unpaid" : "partial");
    if (!row.date) row.date = pay.date;
    if (!row.paidOn && row.status === "paid" && (+pay.cash || 0) > 0.009) row.paidOn = pay.date;
    return;
  }
  if (!row.amend || !row.amend.length)
    row.amend = [seedStep(row, dir)];
  const step = { date: pay.date, kind: pay.kind, cash: +pay.cash || 0, kg: +pay.kg || 0 };
  /* v496: a movement carries the cost of what it moved, in RM, from the row's own unit cost. A row
     the shelf costs below (it.target.cost filled from stockCost) has its cost by the time this runs. */
  if ((+pay.kg || 0) > 0.0001 && row.cost != null && row.qty > 0) step.cost = +(E.txUnitCost(row) * (+pay.kg)).toFixed(2);
  if (note) step.note = note;
  row.amend = row.amend.concat([step]);
  /* v407, round seven, MATERIAL: both v406 gates sat on the Correction path, and this branch set
     cancelled and returned without ever looking at what had moved. s117 was open on the book with
     one unit handed over, so the pair was fully reachable on the normal approved road: the unit
     left the shelf carrying neither revenue nor cost, and the money was still chased. The fold is
     all or nothing by contract, so a contradictory row stops the batch rather than landing. */
  if (pay.kind === "Cancellation") {
    /* v415: A SALE IS NOT MEASURED WITH THE LOT'S RULER, and v413 measured it with one. poRecvUnits
       falls through to "received in full" when receivedQty is absent, which is TRUE of a lot and
       true of EVERY SALE EVER WRITTEN, because a sale has no receivedQty at all. So from v413 every
       sale cancellation was refused, on the only road into one. The direction picks the ruler, as
       the walk itself does at position.mjs:195. */
    const moved = dir === "BUY" ? E.poRecvUnits(row) : Math.max(+row.deliveredQty || 0, E.txEffDeliv(row));
    if (moved > 0.009) throw new Error(`cancelling this row would leave it carrying ${moved} unit already moved, which contradicts itself: restate qty by Modification for what moved, then cancel the remainder`);
    /* 08 Sep 2026: THE DATE IS STAMPED ON THE ROW AS WELL AS IN THE TRAIL. A row cancelled by a
       Correction carries cancelledOn and no Cancellation step; one cancelled here carried the step
       and no field, so the desk's "Cancelled on" cell and the refund's `since` read the field on
       three cancelled rows and nothing on four. Both kinds now carry both. */
    row.cancelled = true; if (pay.date) row.cancelledOn = pay.date; return;
  }
  row.cash = +((row.cash || 0) + (+pay.cash || 0)).toFixed(2);
  row.deliveredQty = +((row.deliveredQty || 0) + (+pay.kg || 0)).toFixed(2);
  /* the dates the phone and the ledger read: the first movement dates an undated order, and a
     step that completes delivery or payment stamps the day it did */
  if (!row.date) row.date = pay.date;
  if ((+pay.kg || 0) > 0.009 && row.qty > 0 && row.deliveredQty >= row.qty - 0.0001) row.deliveredOn = pay.date;
  if ((+pay.cash || 0) > 0.009 && row.total > 0 && row.cash >= E.txOwed(row) - 0.009) row.paidOn = pay.date;   /* v738: paid in full is the goods and the delivery */
}

/* a held figure as words, so a refusal or a plan line never reads [object Object]: a % lift on the Set Price, or what was sent */
const sayLift = (v) => v == null ? "not set" : typeof v === "number" ? (+(v * 100).toFixed(2)) + "% lift" : typeof v === "object" ? JSON.stringify(v) : String(v);
const APPOINTS = POSITION_ENGINE.ADDID_APPOINTS;
export const STATEMENT_KINDS = ["customer", "reseller", "referral"];
function describe(item) {
  const r = item.row || {};
  if (item.amends) {
    if (item.amendKind === "Modification") return `Modification on ${item.amends}: to ${r.newQty ?? "?"} unit / RM${r.newTotal ?? "?"}`;
    if (item.amendKind === "Correction") {
      const f = (item.entry && item.entry.payload && item.entry.payload.fields) || {};
      return `Correction on ${item.amends}: ${Object.keys(f).join(", ") || "nothing"}`;
    }
    return `${item.amendKind} on ${item.amends}: cash ${r.cash != null ? r.cash : "?"}`;
  }
  switch (item.collection) {
    case "sales": return `SELL ${r.customer} ${r.qty} unit ${prodOf(r)} RM${r.total}${r.date ? " on " + r.date : " (pending, undated)"}`;
    case "purchases": return `BUY ${r.supplier} ${r.qty} unit ${prodOf(r)} RM${r.total}${r.pending ? " (pending lot)" : ""}`;
    case "count": return `COUNT ${r.product} ${r.qty} unit on ${r.date} (book said ${r.was}, difference ${r.drift})`;
    case "loss": return `LOSS ${r.kg} unit ${r.product} on ${r.date}: ${r.why}`;
    case "loan": return `${r.direction === "in" ? "BORROW" : "LEND"} ${r.form === "cash" ? "RM " + r.valueRM + " in cash" : r.valueKg + " unit " + (r.product || "salt")} ${r.direction === "in" ? "from" : "to"} ${r.party} on ${r.date}`;
    case "repayment": return `REPAY ${r.form === "cash" ? "RM " + r.rm : r.kg + " unit " + (r.product || "salt")} ${r.direction === "in" ? "to" : "from"} ${r.party} on loan ${r.loan}, ${r.date}${r.settles ? ", settling it" : ""}`;
    case "lostDemand": return `LOST SALE ${r.kg} unit ${r.product}${r.party ? " to " + r.party : ""} on ${r.date}: ${r.why}`;
    case "roster": if (r.partner) return `PARTNER ${r.code}: pays the Floor`; return `${APPOINTS[r.kind] ? "APPOINT" : "REGISTER"} ${r.code} as ${r.kind}${r.parent ? " under " + r.parent : ""}${r.tiers ? " at " + Object.entries(r.tiers).map(([p, t]) => p + " " + t).join(", ") : ""}`;
    case "rename": return `RENAME ${r.from} to ${r.to}`;
    case "place": return `PLACE ${Object.keys(r.places || {}).join(", ")} on the map`;
    case "tierset": return `THEIR % ${Object.entries(r.tiers || {}).map(([c, t]) => c + " " + Object.entries(t || {}).map(([p, v]) => p + " " + sayLift(v)).join(" ")).join(", ")}`;
    case "priceset": return `SET THE BOARD for ${r.product}${Object.keys(r.prices || {}).length ? ": " + Object.entries(r.prices).map(([q, p]) => `${q} unit at RM${p}`).join(", ") : ""}${(r.hide || []).length ? `, hiding ${r.hide.join(", ")} unit` : ""}`;
    default: return `${item.collection}: ${JSON.stringify(r).slice(0, 80)}`;
  }
}

/* ---- the plan: what each item would do, and what is refused ----------------------------- */
export function planBatch(book, staged, notes, ctx) {
  /* what the fold read from disk and the clock comes in through ctx: { driftBooks, pinnedInMaster(code), today, reward } */
  const TODAY = ctx.today, pinnedInMaster = ctx.pinnedInMaster;
  const driftBooks = () => ctx.driftBooks;
  /* a figure of his is a % lift on a book that has a Set Price and nothing on any other: oil, candy and rice are fixed boards */
  const tierOk = (p, v) => driftBooks().includes(p) && PRICING_ENGINE.driftOk(v);
  /* 18 OCT 2026, HIS DECISION: A SALT FIGURE SET IN THE OLD UNIT (a drift, -1 to +1) IS DROPPED, NEVER READ AS A %:
     0.3 then meant 30% of the floor, now 30% on the Set Price, and everyone starts at 0%. The batch is not refused: the customer books on the Set Price with
     no figure held, and a note says the old figure was dropped. A tierset whose only content was such a figure folds as a no-op. A clear (null) carries no figure.
     19 OCT 2026: THE UNIT IS THE GATE, THE STAMP IS THE SECOND NET. The new forms send unit "pct" with every salt figure (on the row: row.unit); a figure with
     none came from a page cached from before the deploy, whose `at` is the page's own clock and can be later than the switch. The stamp still drops one
     stamped before RULES.liftSince, whatever its unit. */
  const liftAt = Date.parse(PRICING_RULES.RULES.liftSince);
  const oldWhy = (it, p, v) => !(driftBooks().includes(p) && v !== null && v !== undefined) ? null
    : (it.row && it.row.unit) !== "pct" ? "without the % unit"
    : Date.parse((it.entry && it.entry.at) || it.id) < liftAt ? "before " + PRICING_RULES.RULES.liftSince : null;
  const oldLift = (it, p, v) => oldWhy(it, p, v) !== null;
  const oldLiftNote = (c, ps, why) => `dropped the old figure: ${c}'s ${ps.join(" and ")} figure was set ${why}, in the old unit (-1 to +1), so ${c} stays on the Set Price at 0%`;
  const out = { items: [], refused: [], moves: [] };
  let tagged = 0;
  let rows = (staged && staged.approved) || [];
  const registrations = rows.flatMap((item) => {
    if (item.status !== "approved") return [];
    const proof = verifiedVaultRegistration(item, item.vaultReceipt, item.vaultOutbox);
    return proof ? [{ item, proof }] : [];
  });
  const registrationIds = new Set(registrations.map((registration) => registration.item.id));
  const plannedRegistrations = new Set();
  const registrationsByCode = new Map();
  for (const registration of registrations) {
    const known = registrationsByCode.get(registration.proof.code) || [];
    known.push(registration);
    registrationsByCode.set(registration.proof.code, known);
  }
  const dependencies = new Map(), dependencyFaults = new Map();
  for (const item of rows) {
    if (!["sales", "purchases"].includes(item.collection)
      || item.entry?.payload?.mode !== "new" || !item.entry?.makerRequest) continue;
    const payload = item.entry.payload || {};
    const partyCodes = [...new Set([payload.party, payload.assoc, payload.downstream]
      .filter((value) => typeof value === "string" && !(book.roster || []).includes(value)))];
    if (!partyCodes.length) continue;
    const stated = item.entry.registrationDependencies;
    if (!Array.isArray(stated) || stated.length !== partyCodes.length
      || stated.some((dependency) => !dependency || Object.keys(dependency).sort().join(",") !== "code,id"
        || typeof dependency.code !== "string" || typeof dependency.id !== "string")) {
      dependencyFaults.set(item.id, "a Counter trade names a party not on the book and has no server-verified Add ID dependency");
      continue;
    }
    const required = [];
    for (const code of partyCodes) {
      const matching = registrationsByCode.get(code) || [];
      const declared = stated.filter((dependency) => dependency.code === code);
      const registration = matching.find((candidate) => candidate.proof.id === declared[0]?.id);
      if (declared.length !== 1 || matching.length !== 1 || !registration
        || registration.item.status !== "approved"
        || registration.item.id !== registration.proof.id) {
        dependencyFaults.set(item.id, `${code} needs one approved, receipt- and outbox-matched Add ID in this batch`);
        break;
      }
      required.push(registration.item.id);
    }
    if (!dependencyFaults.has(item.id)) dependencies.set(item.id, required);
  }
  const ordered = [], waiting = rows.slice(), applied = new Set();
  while (waiting.length) {
    const next = waiting.findIndex((item) => !(dependencies.get(item.id) || []).some((id) => !applied.has(id)));
    if (next < 0) break;
    const [item] = waiting.splice(next, 1);
    ordered.push(item);
    applied.add(item.id);
  }
  rows = ordered.concat(waiting);
  /* v742: WHAT EACH ROW HAS MOVED SO FAR IN THIS BATCH, keyed on the book row, so a second amendment on one row in
     one batch is struck from where the first left it and not from the book as it stood before the batch: a handover
     in two stages inside one hour stages two corrections, and the site's running total would have rolled twice. The
     baseline is the ENGINE's reading, not the raw field: a lot stored without receivedQty is read by poRecvUnits as
     received in full, and stating that figure must move nothing. */
  const movedSoFar = new Map();
  /* 16 Oct 2026 (plan 3): the rows this batch joins to a trip, as they will stand, so a trip set across several corrections holds together */
  const tripJoins = new Map();
  const movedOf = (row, d) => movedSoFar.has(row) ? movedSoFar.get(row) : (d === "BUY" ? E.poRecvUnits(row) : (+row.deliveredQty || 0));
  /* 28 Sep 2026, s210: AND THE ROW AS THE BATCH LEAVES IT, for the payment rule. Two payments in one batch, or a
     correction of the total before a payment, are measured one after the other on a copy each accepted amendment is
     applied to, so the rule reads what the row will say when this item lands, not what it said before the batch. */
  const simSoFar = new Map();
  const simOf = (row) => simSoFar.has(row) ? simSoFar.get(row) : JSON.parse(JSON.stringify(row));
  const reservedEntries = [];
  const reservationState = book.REWARD ? book : { ...book, REWARD: ctx.reward };
  for (const it of rows) {
    const entry = { id: it.id, what: describe(it), does: [] };
    const r = it.row || {};
    if (dependencyFaults.has(it.id)) {
      out.refused.push({ id: it.id, why: dependencyFaults.get(it.id) });
      continue;
    }
    const failedDependency = (dependencies.get(it.id) || []).find((id) => !plannedRegistrations.has(id));
    if (failedDependency) {
      out.refused.push({ id: it.id,
        why: `the approved Add ID ${failedDependency} was refused by the native fold plan; this trade remains staged until its registration can be applied` });
      continue;
    }
    const resourceEntry = it.collection === "repayment" ? { at: it.id,
      payload: { mode: "repay", loan: r.loan, kg: r.kg, rm: r.rm } } : it.entry;
    const reservationFault = E.entryReservationFault(resourceEntry, reservedEntries,
      { state: reservationState, sales: book.sales || [], purchases: book.purchases || [] });
    if (reservationFault) { out.refused.push({ id: it.id, why: reservationFault }); continue; }
    /* round six: the fold took row.product verbatim, so a row folded under an unregistered
       product shipped to the phone as a ledger line while every total excluded it. This is
       the third-product bootstrap path (the drafter refuses the first lot, so it is
       hand-folded, and hand-folding is where registration gets forgotten). */
    if (!it.amends && ["sales", "purchases", "count", "loss", "lostDemand", "priceset"].includes(it.collection)) {
      const pr = prodOf(r);
      if (!((book.PRODUCTS || {})[pr])) { out.refused.push({ id: it.id, why: `${pr} is not a product on this book: register it in PRODUCTS and PROD_ORDER (and give it a quote) before its rows fold` }); continue; }
    }
    if (it.amends) {
      const dir = (it.entry && it.entry.payload && it.entry.payload.direction) || "SELL";
      /* 05 Oct 2026 (A4): a lot's Payment, Receipt and Default fold; Linked and Rewarded stay a person's. */
      const buyKind = ["Payment", "Receipt", "Default"].includes(it.amendKind) && dir === "BUY";
      if (!buyKind && it.amendKind !== "Fulfilment" && it.amendKind !== "Cancellation" && it.amendKind !== "Modification" && it.amendKind !== "Correction") { out.refused.push({ id: it.id, why: `${it.amendKind || "nameless"} amendment: what changed is a judgement, left for a person` }); continue; }
      const arr = dir === "BUY" ? book.purchases : book.sales;
      /* BY rid FIRST (25 Aug 2026). ovKey is party|date|total, which names a row only for as
         long as none of those three changes. A correction changes exactly those, and two
         SA5-BTR lots already share one key, so an id that survives an edit is the only thing
         that can name a row for an editor. ovKey stays as the fallback, so anything queued
         before rids existed still folds. */
      const byRid = arr.filter((x) => x && x.rid && x.rid === it.amends);
      const hits = byRid.length ? byRid : arr.filter((x) => E.ovKey(x) === it.amends);
      if (hits.length !== 1) { out.refused.push({ id: it.id, why: hits.length ? `key ${it.amends} matches ${hits.length} rows` : `no row on the book matches ${it.amends}` }); continue; }
      /* v347: A CANCELLED ORDER IS NOT A TARGET. The match was by key alone, so a fulfilment
         queued against an order that has since been cancelled would fold straight onto it and
         quietly bring it back: cash, units and a date on a row the book says did not happen.
         Nothing has hit it yet, but v345 cancelled two live pending orders, so the road is
         open. Reviving a cancelled order is a judgement in any case, which is the same test
         every other amendment here is measured by.

         NARROWED TO EXCLUDE A CORRECTION, 04 Sep 2026, on his instruction that no undated row
         may stand on the ledger. The danger v347 named is a movement: cash, units, a date that
         asserts the order happened. A Correction carries none of those. It moves nothing, and
         the comment eight lines below says so in terms: "A CORRECTION MOVES NOTHING, so it adds
         nothing to out.moves and needs no date to be valid: what it changes is what the row SAYS
         about itself." Refusing it bought no safety and cost the book two rows it could not
         repair: s108 and s109 were cancelled undated on 24 Aug 2026, and from that moment there
         was no route to date them. Queue the correction, the plan refuses it, every time.

         THE TWO GUARDS FOR THIS QUESTION ALREADY DISAGREED, which is what makes this a fix
         rather than a loosening. applyAmend below refuses only cash or units on a cancelled row,
         and its v434 comment states the policy outright: "A Correction, a Modification and a
         repeat Cancellation are still allowed on a cancelled row, because restating the record
         of one is not the same as moving goods against it." The suite has asserted that at the
         apply layer since v434. This guard sat in front of it and blocked the call, so the
         stated policy could never run. v347 was written first and never swept when v434 refined
         it: the twin, again.

         MODIFICATION AND REPEAT CANCELLATION STAY REFUSED HERE, which is narrower than v434's
         comment describes, and deliberately so. A Modification restates qty and total, which is
         a figure and not a record, and nothing on the book needs it today. The gap between the
         two guards is left listed rather than taken, because widening it further has no reason
         behind it yet and this fold has one. */
      if (hits[0].cancelled && it.amendKind !== "Correction") { out.refused.push({ id: it.id, why: `the row at ${it.amends} is cancelled; reviving it is a judgement, left for a person` }); continue; }
      const pay = (it.entry && it.entry.payload) || {};
      entry.target = hits[0]; entry.dir = dir;
      /* v358: A MODIFICATION CARRIES newQty/newTotal, NOT cash/kg. It moves nothing, so it adds
         nothing to out.moves, and it is described by what it restates the order TO rather than
         by what moved. */
      if (it.amendKind === "Correction") {
        /* A CORRECTION MOVES NOTHING (v739: except what it restates as moved, which rolls the shelf by the
           difference, below), so it needs no date to be valid: what it changes is what the row SAYS about itself. The patch is read from the
           ENTRY rather than from the drafted row, because the drafted row is a before-and-after
           card built for the Approve screen and the entry is what was actually asked for. */
        const fields = pay.fields && typeof pay.fields === "object" ? pay.fields : null;
        if (!fields || !Object.keys(fields).length) { out.refused.push({ id: it.id, why: `the correction on ${it.amends} carries no fields to set` }); continue; }
        /* v383: A FIELD THIS BOOK CANNOT CORRECT IS REFUSED, NOT QUIETLY DROPPED. The apply
           writes only what is in CORRECTABLE, but it built the `mod` line and the trail note
           from whatever keys the caller supplied, so the two disagreed the moment a key was
           wrong. A correction naming `customer` rather than `party` was accepted on 27 Aug:
           it recorded "customer CZ4-TBC to CZ4-MK" in mod, extended the trail, and left the
           party exactly as it was. A row asserting a change it did not make is worse than a
           refusal, and it is the one thing a ledger must never do. */
        const unknown = Object.keys(fields).filter((k) => !E.CORRECTABLE.includes(k));
        if (unknown.length) { out.refused.push({ id: it.id, why: `the correction on ${it.amends} names ${unknown.join(", ")}, which ${unknown.length > 1 ? "are not correctable fields" : "is not a correctable field"} (the party of a row is \`party\`, not \`customer\`)` }); continue; }
        /* round six: the cancelled/delivered PAIR is a contradiction the desk then chases as
           money owed. Both fields are individually correctable, so the pair is checked here
           on the state the correction would leave. The drafter refuses it too; this gate is
           for a correction that reaches the fold another way. */
        /* v436: ONE RULER. This gate had a rule of its own, the drafter had a second, and the two
           readers BELOW -- applyAmend and the desk's ovAmend -- had none at all, so the row editor
           previewed as applied the correction this line refuses. All four call the engine now. */
        const cf = E.correctionFaults(hits[0], fields, !((hits[0].supplier !== undefined) || it.collection === "purchases"));
        if (cf.length) { out.refused.push({ id: it.id, why: `the correction on ${it.amends} was refused: ${cf[0]}` }); continue; }
        /* the row as this batch leaves it (simOf), with this correction applied; a join, or a correction moving the delivery, buyer, day or
           book of a row on a trip (Fable's review of 16 Oct 2026), holds the trip together with its rows on the book and those joined in this batch */
        const tripOn = fields.trip !== undefined ? fields.trip : simOf(hits[0]).trip;
        if (dir === "SELL" && tripOn != null && (fields.trip != null || ["delivery", "party", "date", "product", "assoc", "stream"].some((k) => k in fields))) {
          const joined = (tripJoins.get(tripOn) || []).filter((x) => x._of !== hits[0]), sim = simOf(hits[0]);
          let applies = true;
          try { applyAmend(sim, { date: pay.date || null, kind: "Correction", cash: 0, kg: 0, fields }, dir, null); } catch (e) { applies = false; /* the apply refuses it below, with its own reason */ }
          sim.trip = tripOn;
          const tf = E.tripFault((book.sales || []).filter((x) => x && x !== hits[0] && x.trip === tripOn && !joined.some((j) => j._of === x)).concat(joined, [sim]));
          if (tf) { out.refused.push({ id: it.id, why: `the correction on ${it.amends} was refused: ${tf}` }); continue; }
          Object.defineProperty(sim, "_of", { value: hits[0] });
          if (applies) { joined.push(sim); tripJoins.set(tripOn, joined); }   /* a trip-mate only if the correction itself applies (Fable's re-check) */
        }
        entry.pay = { date: pay.date || null, kind: "Correction", cash: 0, kg: 0, fields };
        /* plan 4: an undo names the step it undoes, and is refused unless that step is still the newest move on the row as this batch
           leaves it and the figures are the ones undoing it sets: a move folded since, in this batch or before, refuses it */
        if (pay.undo != null) {
          const u = Number.isInteger(pay.undo) ? E.undoOf(simOf(hits[0]), pay.undo) : { fault: "it names no step" };
          if (u.fault || !E.undoSame(u.fields, fields)) { out.refused.push({ id: it.id, why: `the undo on ${it.amends} was refused: ${u.fault || "it does not set what undoing that move sets"}` }); continue; }
          entry.pay.undo = pay.undo;
        }
        /* v739: A CORRECTION THAT RESTATES WHAT MOVED ROLLS THE SHELF BY THE DIFFERENCE. "A correction moves
           nothing" was written at v358, when a correction could not touch deliveredQty. It has been able to
           since 25 Aug 2026 (what has actually moved is a thing a person states), seven rows on the book carry
           one, and a site handover arrives as one (v694). So goods left the shelf on the row and never left the
           stated figure: s183's 5 unit of 19 Sep. The row is the record of what moved, and the roll follows the
           record in either direction, so a reversal puts the goods back. The date is the row's own moved-on date
           where the correction states one, else the correction's day. */
        const qk = dir === "BUY" ? "receivedQty" : "deliveredQty";
        if (fields[qk] != null && Number.isFinite(+fields[qk])) {
          const delta = +((+fields[qk]) - movedOf(hits[0], dir)).toFixed(3);   /* v742: against the batch's running figure */
          movedSoFar.set(hits[0], +fields[qk]);
          if (Math.abs(delta) > 0.009) {
            const who = hits[0][dir === "BUY" ? "supplier" : "customer"];
            const when = fields[dir === "BUY" ? "receivedOn" : "deliveredOn"] || pay.date || hits[0].date || TODAY;
            out.moves.push({ product: prodOf(hits[0]), kg: dir === "BUY" ? delta : -delta, who, when, landed: dir === "BUY" });
            entry.does.push(`roll the shelf by ${Math.abs(delta)} unit, ${delta > 0 ? (dir === "BUY" ? "in from" : "out to") : (dir === "BUY" ? "back to" : "back from")} ${who}: the difference the correction states`);
          }
        }
        const words = Object.keys(fields).map((k) => `${k} to ${fields[k] === null ? "(cleared)" : fields[k]}`);
        entry.does.push(`correct ${dir === "BUY" ? "lot" : "order"} ${it.amends}: ${words.join(", ")}`);
        /* v611: SAY WHEN THE ROW CHANGES ACCOUNT. An R2 books to the associate's bucket, so a correction can move a
           row from the plain code into the bucket without naming either code, and the trail's field list reads the
           buyer and would not say so. Measured by applying the patch to a copy, the one definition of a correction. */
        try {
          const pk = dir === "BUY" ? "supplier" : "customer", sim = JSON.parse(JSON.stringify(hits[0]));
          applyAmend(sim, entry.pay, dir, null);
          if (sim[pk] !== hits[0][pk]) entry.does.push(`move ${it.amends} from ${hits[0][pk]} to ${sim[pk]}${E.isBucket(sim[pk]) ? ", the associate's resale account, where an R2 books since v611" : ""}`);
        } catch (e) { /* the apply refuses it below, with its own reason */ }
      } else if (it.amendKind === "Modification") {
        const newQty = +pay.newQty, newTotal = +pay.newTotal;
        if (!(newQty > 0) || !(newTotal >= 0)) { out.refused.push({ id: it.id, why: `the modification on ${it.amends} carries no valid new quantity and total` }); continue; }
        /* 08 Sep 2026: AN UNDATED AMENDMENT IS REFUSED, not dated to the order. The draft row carries
           the target's own date, so `pay.date || r.date` stamped a fulfilment typed today with the day
           the order was agreed. The drafter refuses a movement with no date; this gate now does too. */
        if (!pay.date) { out.refused.push({ id: it.id, why: `the modification on ${it.amends} carries no date; an amendment is dated the day it happened, not the day the order was agreed` }); continue; }
        entry.pay = { date: pay.date, kind: "Modification", cash: 0, kg: 0, newQty, newTotal };
        entry.does.push(`restate ${dir === "BUY" ? "lot" : "order"} ${it.amends} to ${newQty} unit / RM${newTotal}${pay.date ? " on " + pay.date : ""}`);
      } else {
        if (!pay.date) { out.refused.push({ id: it.id, why: `the ${it.amendKind.toLowerCase()} on ${it.amends} carries no date; an amendment is dated the day it happened, not the day the order was agreed` }); continue; }
        entry.pay = { date: pay.date, kind: it.amendKind, cash: +pay.cash || 0, kg: +pay.kg || 0 };
        /* 28 Sep 2026, s210: a payment measured before other money reached its row, which would now take the row past
           what it owes, is refused here on the row as this batch leaves it. The drafted row's cash is what it was
           measured on; it rides with the payment so applyAmend reads the same rule. */
        if (r.cash != null && Number.isFinite(+r.cash)) entry.pay.drafted = +r.cash;
        const pf = E.payFault(simOf(hits[0]), entry.pay.cash, dir !== "BUY", entry.pay.drafted);
        if (pf) { out.refused.push({ id: it.id, why: `the ${it.amendKind.toLowerCase()} on ${it.amends} was refused: ${pf}` }); continue; }
        entry.does.push(`${it.amendKind.toLowerCase()} ${entry.pay.cash ? "RM" + entry.pay.cash + " " : ""}${entry.pay.kg ? entry.pay.kg + " unit " : ""}on ${entry.pay.date} against ${dir === "BUY" ? "lot" : "order"} ${it.amends}`);
      }
      if (dir !== "BUY" && entry.pay.kg > 0.009) out.moves.push({ product: prodOf(hits[0]), kg: -entry.pay.kg, who: hits[0].customer, when: entry.pay.date });
      if (dir === "BUY" && entry.pay.kg > 0.009) out.moves.push({ product: prodOf(hits[0]), kg: +entry.pay.kg, who: hits[0].supplier, when: entry.pay.date, landed: true });
      if (entry.pay.kg > 0.009) movedSoFar.set(hits[0], +(movedOf(hits[0], dir) + entry.pay.kg).toFixed(3));   /* v742: the batch's running figure follows a fulfilment too */
      { const s = simOf(hits[0]); try { applyAmend(s, entry.pay, dir, null); } catch (e) { /* the apply refuses it below, with its own reason */ } simSoFar.set(hits[0], s); }
    } else if (it.collection === "sales" || it.collection === "purchases") {
      const key = it.collection === "sales" ? "customer" : "supplier";
      /* v540: EVERY ROW IS DATED (v487), and a pending row is dated to the day it was agreed. A draft
         made before the drafter learnt that arrives undated; the entry it came from carries the date
         the phone typed, and that is the row's date. With neither, the fold refuses rather than put
         an undated row on the book for the gate to throw back.
         08 Sep 2026: THIS RUNS BEFORE THE REPLAY GUARD, which it used to follow, so an undated draft
         compared `null` against the book's dates, matched nothing, was then dated, and folded a
         twin beside the row it replayed. */
      if (!r.date) {
        const typed = it.entry && it.entry.payload && it.entry.payload.date;
        if (!typed) { out.refused.push({ id: it.id, why: "the row carries no date and the entry typed none; every row on the ledger is dated (v487)" }); continue; }
        r.date = typed;
        entry.does.push(`date the pending row ${typed}, the day it was agreed, from the entry`);
      }
      /* V4a (28 Sep 2026): AND THE PRODUCT. Two lines of one order sheet, a salt and an oil at one size and one figure on
         one day, are two orders; the second was refused here as a replay and left the batch staged. A replay is the
         same entry twice, so the same product, as the phone's replayTwin has read it since v526. */
      const twinOf = (x) => x[key] === r[key] && (x.product || "salt") === (r.product || "salt") && (x.date || null) === (r.date || null) && +x.total === +r.total && +x.qty === +r.qty;
      /* 08 Sep 2026: AND THE BATCH IS READ AS WELL AS THE BOOK. Two identical approved drafts, from
         two devices or the laptop road, both matched nothing on the book and both folded. */
      const dup = (book[it.collection] || []).find(twinOf)
        || (out.items.find((e) => e.append === it.collection && e.row && twinOf(e.row)) || {}).row;
      /* v526: THE REPLAY QUESTION IS ASKED ON THE PHONE. An entry that matches a row on the book by
         party, date, size and total is refused as a replay unless the phone asked and he said it is a
         second order, which the entry then carries as `second`. Two identical CS6-BS rows on 07 Sep
         were real; the guard would have refused the second. */
      const second = !!(it.entry && it.entry.payload && it.entry.payload.second);
      if (dup && !second) { out.refused.push({ id: it.id, why: `a row for ${r[key]} with the same date, size and total is already on the book${dup.rid ? "" : " or in this batch"}, so this would be a replay` }); continue; }
      if (dup && second) entry.does.push(`a second order beside ${dup.rid || "the row"} with the same party, date, size and total, marked so at entry on his word`);
      /* 05 Oct 2026: A TRIP HOLDS TOGETHER on the book it folds into: its rows there and in this batch, with this one */
      if (it.collection === "sales" && r.trip) {
        const tf = E.tripFault((book.sales || []).filter((x) => x && x.trip === r.trip)
          .concat(out.items.filter((e) => e.append === "sales" && e.row && e.row.trip === r.trip).map((e) => e.row), tripJoins.get(r.trip) || [], [r]));
        if (tf) { out.refused.push({ id: it.id, why: tf }); continue; }
        entry.does.push(`one row of trip ${r.trip}${+r.delivery > 0.005 ? ", carrying its one delivery" : ", its delivery on another row"}`);
      }
      entry.append = it.collection; entry.row = r;   /* the row, so a later item in this batch can see it */
      entry.does.push(`append to ${it.collection} with its note`);
      const moved = it.collection === "sales" ? (+r.deliveredQty || 0) : (r.pending || r.inTransit ? 0 : (r.receivedQty != null ? +r.receivedQty : +r.qty || 0));
      if (moved > 0.009) out.moves.push(Object.assign({ product: prodOf(r), kg: it.collection === "sales" ? -moved : +moved, who: r[key], when: r.date || TODAY, landed: it.collection === "purchases" }, it.collection === "sales" && r.trip ? { trip: r.trip } : {}));
    } else if (it.collection === "count") {
      entry.count = { product: r.product || "salt", qty: +r.qty, date: r.date || TODAY, was: r.was, drift: r.drift };
      entry.does.push(`set the stated ${entry.count.product} inventory to ${entry.count.qty} and move COUNT_ON.${entry.count.product} to ${entry.count.date}`);
    } else if (it.collection === "loss") {
      entry.append = "selfUseLog"; entry.does.push("append to selfUseLog; it draws stock and books no revenue");
      if (+r.kg > 0.009) out.moves.push({ product: r.product || "salt", kg: -(+r.kg), who: "loss: " + r.why, when: r.date || TODAY });
    } else if (it.collection === "loan") {
      /* v527: a loan in lands on the inventory, a loan out leaves it; both are owed back in kind */
      entry.append = "loans";
      entry.does.push(r.form === "cash"   // v589: the move below is guarded on valueKg, so a cash loan moves no inventory
        ? (r.direction === "in" ? "append to loans as cash borrowed in: it moves the cash flow, not the inventory, and is owed back in cash" : "append to loans as cash lent out: it moves the cash flow, not the inventory, and is owed back in cash")
        : (r.direction === "in" ? "append to loans as borrowed in: it lands on the inventory and is owed back in kind" : "append to loans as lent out: it leaves the inventory and is owed back in kind"));
      if (+r.valueKg > 0.009) out.moves.push({ product: r.product || "salt", kg: r.direction === "in" ? +r.valueKg : -(+r.valueKg), who: (r.direction === "in" ? "borrowed from " : "lent to ") + r.party, when: r.date || TODAY });
    } else if (it.collection === "lostDemand") {
      entry.append = "lostDemand"; entry.does.push("append to lostDemand; touches no stock and no cash");
    } else if (it.collection === "roster") {
      /* ====== v570: THE KIND IS NOT DECORATION ==========================================
         Add ID has offered "Associate, resells for you (R2)" since v343 and the fold appended
         the bare code and stopped, so a party registered as an associate was not one: it never
         reached book.associates, which is the only thing associateIds() reads for an appointment.
         Every consequence of standing hung off that list and none of them fired -- the Workbench's
         associate picker, the network bench, the credit cap of 2 unit against retail's 1, and the
         move off the customer reward table. The option was a label over an act nobody performed.

         AN APPOINTMENT IS ALSO WHY A CODE ALREADY ON THE ROSTER IS NOT A DUPLICATE. A person is
         registered when they first buy and appointed when he decides, which can be months apart:
         CR3-DAM bought from 29 Jun and was appointed on 11 Sep. So the already-on-the-roster
         refusal holds for a plain registration, which really would list the party twice, and
         becomes the appointment's ordinary road. What it refuses instead is appointing an
         associate twice, which is the duplicate that matters on this collection.

         THE -R ACCOUNT IS MINTED WITH THE APPOINTMENT, so an associate never has a second act to
         remember before their first resale can book. v610, HIS RULING OF 13 SEP 2026: EVERY
         appointment mints it, a referrer's included. Their own buying and their buying to sell on
         are one stream for the reward and any associate may resell; the engine's appointBucket is
         the one answer this, the drafter and the Add ID preview all read. */
      const partner = r.partner === true;
      if (r.partner != null && !partner) { out.refused.push({ id: it.id, why: "partner is true or absent" }); continue; }
      const appoints = !!APPOINTS[r.kind] && !(partner && (book.associates || []).includes(r.code));   // a partner already appointed is not appointed twice
      const onRoster = (book.roster || []).includes(r.code);
      if (partner && (!APPOINTS[r.kind] || !onRoster)) { out.refused.push({ id: it.id, why: `${r.code} must be on the roster and appointed on an associate kind to be made a partner` }); continue; }
      if (partner && (book.partners || []).includes(r.code)) { out.refused.push({ id: it.id, why: `${r.code} is already a partner` }); continue; }
      if (onRoster && !appoints && !partner) { out.refused.push({ id: it.id, why: `${r.code} is already on the roster` }); continue; }
      if (appoints && (book.associates || []).includes(r.code)) { out.refused.push({ id: it.id, why: `${r.code} is already an associate` }); continue; }
      const resell = POSITION_ENGINE.appointBucket(r.kind, r.code);
      const rt = r.tiers || {}, rtOff = Object.keys(rt).filter((p) => !(book.PRODUCTS || {})[p]), rtOld = Object.keys(rt).filter((p) => oldLift(it, p, rt[p])), rtBad = Object.keys(rt).filter((p) => !rtOld.includes(p) && !tierOk(p, rt[p]));   /* a % lift on a book with a Set Price, nothing on any other */   // v645, per product since v646
      if (rtOff.length || rtBad.length) { out.refused.push({ id: it.id, why: rtOff.length ? `${rtOff.join(" and ")} is not a product on this book` : `${rtBad.map((p) => sayLift(rt[p]) + (driftBooks().includes(p) ? " is not a % from 0 to 200 (0 to 2)" : " is not held per customer on this book")).join(" and ")}` }); continue; }
      const rtKept = Object.fromEntries(Object.entries(rt).filter(([p]) => !rtOld.includes(p)));
      entry.roster = { code: r.code, register: !onRoster, appoint: appoints, resell: resell && !(book.roster || []).includes(resell) ? resell : null, geo: r.geo || null, tiers: Object.keys(rtKept).length ? rtKept : null, partner };
      if (partner) entry.does.push(`make ${r.code} a partner: they pay the Floor, up to the next RM 5, on every book; they keep every associate property`);
      if (entry.roster.register) entry.does.push(`append ${r.code} to the roster (the directory is not touched)`);
      if (r.geo) entry.does.push(`file ${r.code} as a point on the map, about a kilometre, where its place was found`);
      if (STATEMENT_KINDS.includes(r.kind)) entry.does.push(`give ${r.code} a statement username if they have none, kept for life, on the next free spare account where there is one`);
      /* THE FIGURES ARE NOT RESTATED HERE. The reward hurdles and the credit caps are the
         engine's (REWARD.hurdleMultiple, RULES.creditUnits), and a second copy in the fold's
         prose is a second copy that will differ. What the line says is which rules start
         reading them, which is the part that is true whatever the numbers are. */
      if (appoints) entry.does.push(`appoint ${r.code} an associate: R2 and R3 credit reaches them, their credit cap moves from the retail one to the associate one, their turnover hurdles to the associate hurdle, and they leave the customer reward table for the network bench`);
      if (entry.roster.resell) entry.does.push(`append ${entry.roster.resell} to the roster as their resell account, which holds what they buy to sell on`);
      if (rtOld.length) entry.does.push(oldLiftNote(r.code, rtOld, oldWhy(it, rtOld[0], rt[rtOld[0]])));
    } else if (it.collection === "priceset") {
      /* v354: A PRICE EDIT MOVES NO STOCK AND NO CASH. It REPLACES that product's entry in
         PRICE_SET rather than merging into it, so the form on the desk is the whole statement of
         what he wants the board to be and a price he cleared is actually cleared. */
      const prod = r.product || "salt";
      if (!(book.PRODUCTS || {})[prod]) { out.refused.push({ id: it.id, why: `${prod} is not a product on this book` }); continue; }
      entry.priceset = { product: prod, prices: r.prices || {}, hide: r.hide || [] };
      const n = Object.keys(r.prices || {}).length;
      entry.does.push(`set ${n} price${n === 1 ? "" : "s"} on the ${prod} board${(r.hide || []).length ? ` and hide ${r.hide.join(", ")} unit` : ""}; it moves no stock and no cash`);
    } else if (it.collection === "repayment") {
      /* v595: A REPAYMENT IS WRITTEN ON ITS LOAN, named by rid, and the loan settles when nothing is left owing.
         Earlier repayments of the same loan in this batch count, so two approvals cannot repay it twice. */
      const loan = (book.loans || []).find((l) => l && l.rid === r.loan);
      if (!loan) { out.refused.push({ id: it.id, why: `no loan ${r.loan} is on the book` }); continue; }
      if (loan.status === "settled") { out.refused.push({ id: it.id, why: `loan ${r.loan} is already settled` }); continue; }
      const cashL = loan.form === "cash", amt = +(cashL ? r.rm : r.kg);
      const paid = (loan.repaid || []).reduce((a, x) => a + (+(cashL ? x.rm : x.kg) || 0), 0)
        + out.items.filter((e) => e.repay && e.repay.rid === r.loan).reduce((a, e) => a + (+(cashL ? e.repay.rm : e.repay.kg) || 0), 0);
      const owed = +((cashL ? +loan.valueRM : +loan.valueKg) - paid).toFixed(2);
      if (!(amt > 0) || amt > owed + 0.005) { out.refused.push({ id: it.id, why: `repays ${amt} against ${owed} still owing on ${r.loan}` }); continue; }
      const settles = owed - amt < 0.005;
      entry.repay = { rid: r.loan, date: r.date, kg: cashL ? null : amt, rm: cashL ? amt : null, settles };
      entry.does.push(`record the repayment on loan ${r.loan}${settles ? " and settle it" : `, leaving ${+(owed - amt).toFixed(2)} owing`}`);
      if (!cashL) out.moves.push({ product: loan.product || "salt", kg: loan.direction === "in" ? -amt : +amt, who: (loan.direction === "in" ? "repaid to " : "repaid by ") + loan.party, when: r.date || TODAY });
    } else if (it.collection === "place") {
      /* v633: where parties are on the map, as points; checked against the book it folds into */
      const codes = Object.keys(r.places || {}), off = codes.filter((c) => !(book.roster || []).includes(c));
      if (!codes.length || off.length) { out.refused.push({ id: it.id, why: codes.length ? `${off.join(" and ")} is not on the roster` : "a place entry names no party" }); continue; }
      entry.place = r.places;
      entry.does.push(`file ${codes.join(", ")} as ${codes.length === 1 ? "a point" : "points"} on the map, about a kilometre each`);
    } else if (it.collection === "tierset") {
      /* v643: a customer's held figure for each product (v646), checked against the book it folds into; a null clears it */
      const codes = Object.keys(r.tiers || {}), off = codes.filter((c) => !(book.roster || []).includes(c) || E.isBucket(c));
      const pairs = codes.flatMap((c) => Object.entries((r.tiers[c] && typeof r.tiers[c] === "object") ? r.tiers[c] : {}).map(([p, v]) => [c, p, v]));
      const noProd = codes.filter((c) => !pairs.some((x) => x[0] === c)), offP = pairs.filter((x) => !(book.PRODUCTS || {})[x[1]]), bad = pairs.filter((x) => x[2] !== null && !oldLift(it, x[1], x[2]) && !tierOk(x[1], x[2]));   /* 05 Oct 2026: a figure of his on a drift book (18 Oct 2026: a % lift, 0 to 2), held as a tier was; none on any other */
      if (!codes.length || off.length || noProd.length || offP.length || bad.length) {
        out.refused.push({ id: it.id, why: !codes.length ? "a % entry names no customer" : off.length ? `${off.join(" and ")} is not a customer on the roster`
          : noProd.length ? `the % entry for ${noProd.join(" and ")} names no product` : offP.length ? `${offP.map((x) => x[1]).join(" and ")} is not a product on this book` : bad.map((x) => sayLift(x[2]) + (driftBooks().includes(x[1]) ? " is not a % from 0 to 200 (0 to 2)" : " is not held per customer on this book")).join(" and ") });
        continue;
      }
      const oldTs = pairs.filter((x) => oldLift(it, x[1], x[2])), keptTs = pairs.filter((x) => !oldLift(it, x[1], x[2]));
      const keptTiers = {};
      for (const [c, p, v] of keptTs) (keptTiers[c] = keptTiers[c] || {})[p] = v;
      entry.tiers = keptTs.length ? keptTiers : {};   /* a tierset of old figures alone folds as a no-op: the item is filed, the book unchanged */
      if (keptTs.length) entry.does.push(`set ${keptTs.map(([c, p, v]) => `${c}'s ${p} figure to ${sayLift(v)}`).join(", ")}`);
      for (const c of [...new Set(oldTs.map((x) => x[0]))]) entry.does.push(oldLiftNote(c, oldTs.filter((x) => x[0] === c).map((x) => x[1]), oldWhy(it, oldTs.find((x) => x[0] === c)[1], oldTs.find((x) => x[0] === c)[2])));
    } else if (it.collection === "rename") {
      /* v628, AMEND ID: checked again against the book it folds into, since a code can be taken or retired
         between the draft and the fold. What moves is the engine's renamePairs, as on the card. */
      const roster = book.roster || [];
      if (!roster.includes(r.from)) { out.refused.push({ id: it.id, why: `${r.from} is not on the roster, so there is nothing to rename` }); continue; }
      if (E.isBucket(r.from) || !r.to || r.to === r.from) { out.refused.push({ id: it.id, why: `${r.from} to ${r.to} is not a rename this fold takes` }); continue; }
      const pairs = E.renamePairs(roster, r.from, r.to);
      const taken = pairs.map((x) => x[1]).filter((c) => roster.includes(c));
      if (taken.length) { out.refused.push({ id: it.id, why: `${taken.join(" and ")} already belongs to another party` }); continue; }
      const pinned = pairs.map((x) => x[0]).filter(pinnedInMaster);
      if (pinned.length) { out.refused.push({ id: it.id, why: `${pinned.join(" and ")} is written into the desk's own code, which a fold never edits, so this rename is left for a hand fold` }); continue; }
      entry.rename = { from: r.from, to: r.to, pairs, geo: r.geo || null };
      entry.does.push(`re-key ${pairs.map((x) => x[0] + " to " + x[1]).join(" and ")} wherever the book holds the code, after every other row in this batch; notes and history keep the old code`);
      entry.does.push("move the statement account to the new code, its username unchanged, with any place override and the suite's fixtures");
    } else { out.refused.push({ id: it.id, why: `unknown collection ${it.collection}` }); continue; }
    for (; tagged < out.moves.length; tagged++) MOVE_OF.set(out.moves[tagged], it.id);   /* every refusal (continue) in this iteration came before this line, so the moves made since the last entry are this entry's alone */
    out.items.push(entry);
    if (it.collection === "roster" && registrationIds.has(it.id)) plannedRegistrations.add(it.id);
    if (resourceEntry) reservedEntries.push(resourceEntry);
  }
  /* 05 Oct 2026: A TRIP IS STAGED TOGETHER. A refused row of a trip holds back its siblings in this batch, so the row that
     carries the delivery is never left behind while the others land with no charge. They stay staged with it. */
  const tripOf = new Map(rows.map((it) => [it.id, it.collection === "sales" && it.row && it.row.trip]));
  const held = new Set(out.refused.map((x) => tripOf.get(x.id)).filter(Boolean));
  if (held.size) {
    out.items = out.items.filter((e) => {
      const tr = e.append === "sales" && e.row && e.row.trip;
      if (!tr || !held.has(tr)) return true;
      out.refused.push({ id: e.id, why: `another row of trip ${tr} was refused, so this one waits with it` });
      return false;
    });
    out.moves = out.moves.filter((m) => !(m.trip && held.has(m.trip)));
  }
  PLANNED.add(out);
  return out;
}

/* what a planned batch does to a book (applyBatch: a clone of it, and the argument untouched): the rows in plan order, then the renames, then the roll (a count is its own row, a roll
   is for what physically moved). Returns { ok: true, book, plan, folded, newest, moves, renames }, or { ok: false, problems } when the plan refuses anything
   or a new row has no note; the arguments are untouched. */
export function applyBatch(book0, staged, notes, ctx) {
  const book = structuredClone(book0), st = structuredClone(staged);   /* neither argument is aliased by the result */
  const p = planBatch(book, st, notes, ctx);
  /* all or nothing, as the fold has always been: a refusal, or a new row with no note, folds nothing */
  const problems = p.refused.map((x) => `${x.id}: ${x.why}`);
  for (const it of p.items) {
    const n = notes && notes.rows && notes.rows[it.id];
    if ((it.append === "sales" || it.append === "purchases") && (!n || !String(n.note || "").trim())) problems.push(`${it.id}: a new row needs a note`);
  }
  if (problems.length) return { ok: false, problems };
  return Object.assign({ ok: true }, applyInto(book, p, st, notes, ctx));
}
/* the salt fallback rate (see applyInto): the engine's stockBasis on the book as it stands, null with no salt count stated */
function stockCostOf(book) {
  const saltOpening = (book.PROD_OPENING || {}).salt || null;
  const saltCount = saltOpening && saltOpening.stated != null ? saltOpening.stated : book.STATED_STOCK;
  return saltCount != null ? E.stockBasis((book.purchases || []).filter((r) => prodOf(r) === "salt"), +saltCount, saltOpening).rate : null;
}
/* THE ASSOCIATE REWARD UNIT, RAISED BY THE FOLD (his rules of 20 Oct 2026). Once the switch is taken (REWARD names times and since, and
   the book states REWARD_OPEN), after every entry:
   - a party the engine now reads as an associate with no opening (an appointment, a ref or an R2 on a sale, an introduction) opens
     that day on what the count before the switch reads for them, so no lump is raised on their next payment;
   - for the party a salt sale entry touched, due is the walk's crossings less every reward row already on the book for them
     (rewardOf, cancelled ones included, so a re-run adds nothing and a row he cancels is not raised again), and each due unit is
     appended as its own row, at the crossing day's landed cost (Ask 9): goodwill and rebate, settled by the reward, so no price
     reader counts it. rewardOf is the row that crossed, never recomputed. A departed associate gets none until they return;
   - a reward row the walk no longer earns (an undone payment) is flagged STALE in the moves, never withdrawn: he removes it in
     ledger/book.json, never cancels it, since a cancelled reward row still counts;
   - when this entry hands salt over to them, each reward row waiting whose own order is now handed over in full goes with it
     (deliveredQty 1, its day and handover), and its unit leaves the shelf through unitMoves, which applyEntry adds to the roll: a
     reward raised after its order went out rides on their next salt handover (Ask 4). */
/* THE LOYALTY UNIT, RAISED BY THE SAME FOLD (his rule of 20 Oct 2026, docs/plan-loyalty-unit.html). For a customer the walk is the engine's
   loyaltyWalk, a unit at every 20 salt units bought at or above their price, and the unit is a GIFT (goodwill, total nought, no rebate), so
   no reader takes it for a redemption against what they hold, and it is an expense at the crossing day's landed cost, as a gift is. The
   due, the hand-cancelled row, the STALE flag and the delivery with the order are the associate's, on rows marked loyal: each count reads
   its own rows (rewardOf and loyal, or rewardOf and not), so neither due reads the other's. A departed customer gets none until they return. */
function rewardEngineBook(book, scheme) { return { sales: book.sales || [], purchases: book.purchases || [], state: { ...book, REWARD: scheme, ...(scheme.terms ? { TERMS: scheme.terms } : {}) } }; }
function rewardFold(book, it, c, unitMoves) {
  const scheme = c.reward;
  if (!scheme) return;
  const eb = rewardEngineBook(book, scheme);
  const assoc = !!book.REWARD_OPEN && !!E.rewardScheme(eb);
  if (!assoc && !E.loyalScheme(eb)) return;
  const day = (it.pay && it.pay.date) || (c.appended && c.appended.date) || (c.src && c.src.row && c.src.row.date) || c.today || null;
  if (assoc) for (const code of [...new Set((book.roster || []).filter((x) => typeof x === "string" && !E.isBucket(x)))]) {
    if (book.REWARD_OPEN[code] || !E.rewardAccount(eb, code, "salt", { old: true }).associate) continue;
    const o = E.rewardOpening(eb, code, day);
    if (o.error) continue;
    book.REWARD_OPEN[code] = o;
    c.moves.push(`reward opening: ${code} opens on ${o.earned} unit earned and ${Math.round(o.share * 100)}% of the next, ${day}`);
  }
  const touched = it.target && it.dir !== "BUY" ? it.target : it.append === "sales" ? c.appended : null;
  if (!touched || prodOf(touched) !== "salt") return;
  const code = E.ownerCode(touched.customer);
  if (!assoc || !E.rewardIsAssociate(eb.state, eb.sales, code)) { loyalFold(book, eb, code, day, touched, c, unitMoves); return; }
  const acc = E.rewardAccount(eb, code);
  if (acc.error || !acc.associate) return;
  const walk = E.rewardWalk(eb, code);
  if (!walk || walk.error) return;
  const mine = (s) => !!(s && s.rewardOf && !s.loyal && E.ownerCode(s.customer) === code);
  const seen = {};   /* per crossing order: the n-th crossing on a row is raised once that row names n units (cancelled ones included) */
  for (const cr of walk.crossings) {
    seen[cr.rid] = (seen[cr.rid] || 0) + 1;
    if (book.sales.filter((s) => mine(s) && s.rewardOf === cr.rid).length >= seen[cr.rid]) continue;
    const cost = +(+cr.rate).toFixed(2);
    const row = { customer: code, product: "salt", qty: 1, total: cost, cost, cash: 0, settledRM: cost, rebate: true, rebateKg: 1, goodwill: true,
      deliveredQty: 0, date: day, rewardOf: cr.rid, auto: true, given: cr.given,
      note: `<b>REWARD UNIT: 1 UNIT OF SALT TO ${code} AT COST, NO CHARGE.</b> Their margin on their own buying and resale reached the step of RM ${cr.step} (${walk.times} units at RM ${cr.rate} landed on ${cr.day}) with ${cr.rid}, paid in full. Raised by the fold at RM ${cost} and settled by the reward, so it is cost and not revenue; it goes with ${cr.rid}'s delivery, or with their next salt order where that has gone. RM ${cr.given} was given under their own price since the last reward (his information only).` };
    row.rid = c.nextRid(book.sales, "s")(1);
    book.sales.push(row);
    c.moves.push(`reward unit: ${row.rid}, 1 unit to ${code} at RM ${cost}, for ${cr.rid}`);
  }
  rewardFollow(book, code, walk.crossings, mine, touched, day, c, unitMoves, "reward");
}
function loyalFold(book, eb, code, day, touched, c, unitMoves) {
  if (((book.PEOPLE || {}).departed || []).some((p) => p && p.id === code)) return;
  const walk = E.loyaltyWalk(eb, code, c.today || day || undefined);
  if (!walk || !walk.walks) return;
  const mine = (s) => !!(s && s.rewardOf && s.loyal && E.ownerCode(s.customer) === code);
  const lots = (book.purchases || []).filter((p) => prodOf(p) === "salt"), seen = {};
  for (const cr of walk.crossings) {
    seen[cr.rid] = 1 + (seen[cr.rid] || 0);
    const had = book.sales.filter((s) => mine(s) && s.rewardOf === cr.rid).length;   /* cancelled ones included */
    if (had >= seen[cr.rid]) continue;
    const lc = E.latestCogs(lots, cr.day), rate = lc && lc.rate > 0 ? +lc.rate : c.stockCost;
    if (!(rate > 0)) { c.moves.push(`loyalty unit for ${cr.rid} not raised: no landed cost of salt on ${cr.day}`); continue; }
    const cost = +(+rate).toFixed(2);
    const row = { customer: code, product: "salt", qty: 1, total: 0, cost, cash: 0, goodwill: true, deliveredQty: 0, date: day, rewardOf: cr.rid, auto: true, loyal: true,
      note: `<b>LOYALTY UNIT: 1 UNIT OF SALT TO ${code} AT COST, NO CHARGE.</b> Their salt bought at or above their own price, paid in full, reached ${walk.every} units with ${cr.rid} on ${cr.day}. Raised by the fold at RM ${cost}, the landed cost that day, as a gift, so it is cost and not revenue; it goes with ${cr.rid}'s delivery, or with their next salt order where that has gone.` };
    row.rid = c.nextRid(book.sales, "s")(1);
    book.sales.push(row);
    c.moves.push(`loyalty unit: ${row.rid}, 1 unit to ${code} at RM ${cost}, for ${cr.rid}`);
  }
  rewardFollow(book, code, walk.crossings, mine, touched, day, c, unitMoves, "loyalty");
}
/* what both units share once raised: a live row past what its walk earns on its order is flagged STALE, per order, never withdrawn; and the
   handover that takes salt to them delivers each unit waiting whose own order is handed over in full, its unit off the shelf through unitMoves */
function rewardFollow(book, code, crossings, mine, touched, day, c, unitMoves, what) {
  const live = book.sales.filter((s) => mine(s) && !s.cancelled), per = {};
  for (const x of crossings) per[x.rid] = (per[x.rid] || 0) + 1;
  const held = {};
  for (const s of live) {
    held[s.rewardOf] = (held[s.rewardOf] || 0) + 1;
    if (held[s.rewardOf] > (per[s.rewardOf] || 0))
      c.moves.push(`STALE ${what} on ${s.rid}: the walk no longer earns it (its payment was undone); remove the row in ledger/book.json, never cancel it`);
  }
  if ((c.entryMoves || []).some((m) => m && m.product === "salt" && +m.kg < 0 && E.ownerCode(m.who) === code))
    for (const s of book.sales.filter((x) => mine(x) && !x.cancelled && !(+x.deliveredQty > 0.009))) {
      const of = book.sales.find((x) => x && x.rid === s.rewardOf);
      if (!of || E.txDeliv(of) < (+of.qty || 0) - 0.009) continue;
      s.deliveredQty = 1; s.deliveredOn = day;
      if (touched.handover) s.handover = touched.handover;
      unitMoves.push({ product: "salt", kg: -1, who: code, when: day });
      c.moves.push(`${what} unit ${s.rid} handed over to ${code} with ${touched.rid || "this order"}`);
    }
}
/* ONE PLANNED ITEM BOOKED INTO THE BOOK: the body of the fold's loop, shared by applyInto (a batch) and applyEntry (one entry). c = { src, n, notes, stockCost, nextRid, moves, renames }:
   the staged item, its notes row, the batch notes, the salt fallback rate, the rid minter, and the two lists it adds to (refund words; renames, applied last by the caller). */
function bookItem(book, it, c) {
  const { src, n, notes, stockCost, nextRid, moves, renames } = c;
    if (it.target) {
      applyAmend(it.target, it.pay, it.dir, String(n.note || "").trim() || undefined);
      /* v444, HIS INSTRUCTION: a cancelled order that was paid for is a payable, recorded exactly
         like an overpayment. This sits after applyAmend rather than inside it because applyAmend
         is handed a ROW and the payable belongs to the BOOK, and it covers BOTH roads to a
         cancelled sale, the Cancellation kind and a Correction setting the flag, because it asks
         the row what it is rather than asking the amendment what it was called. */
      if (it.dir !== "BUY") {
        book.customerRefunds = book.customerRefunds || [];
        const rec = E.refundOnCancel(book.customerRefunds, it.target, (it.pay && it.pay.date) || null);
        if (rec) moves.push(`refund payable: ${rec.party} RM ${rec.amount}`);
        /* 06 Oct 2026: AND A ROW PAID PAST WHAT IT COMES TO, by the same rule asked of the row: a close at what was
           handed over or an amendment of an agreed order under what they paid, which the desk held or refused until
           now, and a payment over the row. The engine measures it against every refund the rid already carries. */
        const over = E.refundOnOverpay(book.customerRefunds, it.target, (it.pay && it.pay.date) || null);
        if (over) moves.push(`refund payable: ${over.party} RM ${over.amount}, paid past what the row comes to`);
        /* and a refund the row no longer owes is flagged, never withdrawn: he removes it in ledger/book.json */
        const stale = E.refundStale(book.customerRefunds, it.target);
        if (stale) moves.push(`STALE refund on ${it.target.rid}: RM ${stale} of its open refunds is no longer owed; remove it in ledger/book.json`);
      }
      /* v496: the shelf's figure is RM per unit; the order's cost is absolute, so it is the shelf times the order's units. */
      /* 24 Sep 2026: A PENDING ORDER ALSO GOES OUT BY A CORRECTION, which raises deliveredQty and moves no kg,
         and s183 and s196 went live that way with no cost, blanking the gross margin. Goods out is the test. */
      /* 05 Oct 2026, HIS SETTLED RULE: A SALE IS COSTED AT COGS OFF THE LATEST PURCHASE, the engine's latestCogs over that
         book's lots landed on or before the movement, as the drafter costs one; the shelf's rate stays for a gift or a
         reward, and for salt where no lot has landed. */
      if (it.dir !== "BUY" && (it.pay.kg > 0.009 || (+it.target.deliveredQty || 0) > 0.009) && it.target.cost == null) {
        const gift = !!(it.target.goodwill || it.target.rebate);
        const lc = gift ? null : E.latestCogs((book.purchases || []).filter((r) => prodOf(r) === prodOf(it.target)), (it.pay && it.pay.date) || it.target.date || null);
        if (lc) it.target.cost = +(lc.rate * it.target.qty).toFixed(2);
        else if (prodOf(it.target) === "salt" && stockCost != null) it.target.cost = +(stockCost * it.target.qty).toFixed(2);
      }
      /* 05 Oct 2026: A COST THE CORRECTION SETS STANDS: the notes may not move it back to the shelf rate */
      if (n.cost != null && !(it.pay && it.pay.fields && it.pay.fields.cost != null)) it.target.cost = +n.cost;
      /* v496: the step was written inside applyAmend before either fill above, so a movement on a row the
         shelf costs, or one the notes recost, takes its cost here, from the order's unit cost as it now stands. */
      { const last = it.target.amend && it.target.amend[it.target.amend.length - 1];
        if (last && (+last.kg || 0) > 0.0001 && it.target.cost != null && it.target.qty > 0) last.cost = +(E.txUnitCost(it.target) * (+last.kg)).toFixed(2); }
      if (n.rowNote) it.target.note = String(n.rowNote) + " " + (it.target.note || "");
      /* 20 Oct 2026 (the associate reward, his rule 4): a restated size or goods takes their own price again, for the new size, off the
         pricing snapshot the drafter read (the extract's PRICING); nothing prices from it */
      const f = it.pay && it.pay.fields;
      if (it.dir !== "BUY" && f && (f.qty != null || f.total != null || f.product != null || f.party != null) && it.target.listRM != null && c.pricing) {
        const card = PRICING_ENGINE.cardAt(c.pricing, E.ownerCode(it.target.customer), prodOf(it.target), +it.target.qty).card;
        if (prodOf(it.target) === "salt" && card != null && isFinite(card) && card > 0) { it.target.listRM = +(+card).toFixed(2); it.target.listQty = +it.target.qty; }
        else { delete it.target.listRM; delete it.target.listQty; }
      }
    } else if (it.append === "sales" || it.append === "purchases") {
      const row = { ...src.row };
      /* 05 OCT 2026: A NEW SALE KEEPS THE DRAFTER'S COST. The drafter costs a sale at COGS off the latest purchase on or
         before its date (v1009, cogsFor); the notes' cost moved the CE5-SA-R salt row of trip t1791145053619 back to the
         shelf's RM60 a unit from p035's RM64. A notes cost is taken only where the draft carried none, or on a lot. */
      if (n.cost != null && !(it.append === "sales" && src.row.cost != null)) row.cost = +n.cost;
      row.note = String(n.note).trim();
      /* EVERY ROW GETS AN ID ON THE WAY IN (25 Aug 2026). A row with no rid cannot be named by
         the editor, so a fold that appended one without would put a row on the book that could
         never be corrected. Minted by the same function tools/rid.mjs uses, so the two cannot
         disagree about the shape, and never reused: it reads the highest already on the book. */
      row.rid = nextRid(book[it.append] || [], it.append === "sales" ? "s" : "p")(1);
      book[it.append].push(row);
      c.appended = row;
    } else if (it.count) {
      const c = it.count;
      if (c.product === "salt") book.STATED_STOCK = c.qty;
      else { book.PROD_OPENING[c.product] = book.PROD_OPENING[c.product] || { qty: 0, costPerKg: null, stated: null }; book.PROD_OPENING[c.product].stated = c.qty; }
      book.COUNT_ON[c.product] = c.date;
      /* v504: every count is kept; the leak is charged from the drift of the last three */
      book.COUNTS = book.COUNTS || [];
      book.COUNTS.push({ product: c.product, date: c.date, qty: c.qty, was: c.was != null ? c.was : null, drift: c.drift != null ? c.drift : null });
      const sentence = `COUNTED AT ${notes.version} on ${c.date}: the ${c.product} inventory held ${c.qty} against ${c.was != null ? c.was : "?"} on the roll, a difference of ${c.drift != null ? c.drift : "?"}. A COUNT AND NOT A ROLL, so COUNT_ON.${c.product} moves to ${c.date}.` + (n.note ? " " + String(n.note).trim() : "");
      const key = c.product === "salt" ? "STATED_STOCK" : "PROD_OPENING";
      book.NOTES = book.NOTES || {}; book.NOTES[key] = [sentence].concat(book.NOTES[key] || []);
    } else if (it.append === "selfUseLog" || it.append === "lostDemand" || it.append === "loans") {
      const row = { ...src.row }; if (n.note) row.note = String(n.note).trim();
      if (it.append === "loans" && !row.rid) row.rid = nextRid(book.loans || [], "l")(1);   // v595: a loan is named by its repayments
      book[it.append] = book[it.append] || []; book[it.append].push(row);
    } else if (it.repay) {
      /* v595: the repayment is written on its loan, which settles when it is paid off */
      const rp = it.repay, loan = (book.loans || []).find((l) => l && l.rid === rp.rid);
      loan.repaid = (loan.repaid || []).concat([rp.kg != null ? { date: rp.date, kg: rp.kg } : { date: rp.date, rm: rp.rm }]);
      if (rp.settles) { loan.status = "settled"; loan.settledOn = rp.date; }
    } else if (it.roster) {
      /* v570: three writes, each guarded, because a re-run of a fold must add nothing twice.
         The plan has already refused the duplicate cases; these guards are what makes the
         apply itself idempotent, as refundOnCancel is. */
      const rr = it.roster;
      if (rr.register && !book.roster.includes(rr.code)) book.roster.push(rr.code);
      if (rr.geo) { book.PLACED = book.PLACED || {}; book.PLACED[rr.code] = rr.geo; }   // v633: the place found at Add ID
      if (rr.tiers) { book.TIER_OF = book.TIER_OF || {}; book.TIER_OF[rr.code] = Object.assign({}, book.TIER_OF[rr.code], rr.tiers); }   // v645: the starting tiers chosen at Add ID
      if (rr.resell && !book.roster.includes(rr.resell)) book.roster.push(rr.resell);
      if (rr.appoint) {
        book.associates = book.associates || [];
        if (!book.associates.includes(rr.code)) book.associates.push(rr.code);
      }
      if (rr.partner) {   // 09 Oct 2026: a partner pays cost
        book.partners = book.partners || [];
        if (!book.partners.includes(rr.code)) book.partners.push(rr.code);
      }
    } else if (it.priceset) {
      const ps = it.priceset;
      book.PRICE_SET = book.PRICE_SET || {};
      book.PRICE_SET[ps.product] = { prices: ps.prices, hide: ps.hide };
      if (n && String(n.note || "").trim()) {
        book.NOTES = book.NOTES || {};
        book.NOTES.PRICE_SET = [String(n.note).trim()].concat(book.NOTES.PRICE_SET || []);
      }
    } else if (it.place) { book.PLACED = book.PLACED || {}; Object.assign(book.PLACED, it.place); }   // v633
    else if (it.tiers) {   // v643, a product at a time since v646: a null clears that product, and a customer left with none leaves TIER_OF
      book.TIER_OF = book.TIER_OF || {};
      for (const [c, t] of Object.entries(it.tiers)) {
        const now = Object.assign({}, book.TIER_OF[c], t);
        Object.keys(now).forEach((p) => { if (now[p] == null) delete now[p]; });
        if (Object.keys(now).length) book.TIER_OF[c] = now; else delete book.TIER_OF[c];
      }
    }
    else if (it.rename) renames.push(it.rename);
}
/* S1d: ONE ENTRY BOOKED AT A TIME, the step applyInto folds over a batch. ctx = { nextRid, staged, notes, moves }, moves being this entry's own
   (movesOf(plan, it)). It books the item, then rolls the stated figure of each product the entry moved, at once: a count sets the figure, a move after it adds or
   takes off what stands, and a move before a count is overwritten by it. The salt fallback rate is read on the book before THIS entry. It writes no ROLLED sentence, renames
   nothing and sets neither QUEUE_COMMITTED nor the order of the rows: a wrapper does those once for a batch, from what this returns,
   { id, newest, moves (refund words), renames, rolls: [{ product, out, inn, from, to, uncounted }], entryMoves }.
   The order of the entries decides: a count and a move on one product give 10.5 for a sale then a count of 10.5, and 8.5 for the count then a sale of 2. */
export function applyEntry(book, it, ctx) {
  const src = ctx.staged.approved.find((x) => x.id === it.id), n = (ctx.notes.rows && ctx.notes.rows[it.id]) || {};
  const moves = [], renames = [], unitMoves = [];
  const c = { src, n, notes: ctx.notes, stockCost: stockCostOf(book), nextRid: ctx.nextRid, moves, renames,
    reward: ctx.reward || null, today: ctx.today || null, pricing: ctx.pricing || null, entryMoves: ctx.moves || [] };
  bookItem(book, it, c);
  rewardFold(book, it, c, unitMoves);   /* 20 Oct 2026: the associate reward's unit, and its unit off the shelf with the handover */
  const entryMoves = (ctx.moves || []).concat(unitMoves), rolls = [];
  for (const prod of [...new Set(entryMoves.map((m) => m.product))]) {
    const ms = entryMoves.filter((m) => m.product === prod);
    const out = ms.filter((m) => m.kg < 0).reduce((a, m) => a - m.kg, 0), inn = ms.filter((m) => m.kg > 0).reduce((a, m) => a + m.kg, 0);
    const o = prod === "salt" ? null : (book.PROD_OPENING || {})[prod];
    if (prod === "salt") { const from = book.STATED_STOCK, to = r2(from - out + inn); book.STATED_STOCK = to; rolls.push({ product: prod, from, out, inn, to }); }
    else if (o && o.stated != null) { const from = o.stated, to = r2(from - out + inn); o.stated = to; rolls.push({ product: prod, from, out, inn, to }); }
    else rolls.push({ product: prod, from: null, out, inn, to: null, uncounted: true });
  }
  return { id: it.id, newest: it.id, moves, renames, rolls, entryMoves };
}

/* S1d-ii (18 Oct 2026, his answers of 16 Oct): A BATCH IS ITS ENTRIES BOOKED IN EVENT ORDER, one applyEntry after another, on the book the caller owns and wants folded IN PLACE
   (tools/fold.mjs's apply, whose callers hold the book and its rows by identity): `book` is the caller's own working copy and `p` the plan made against it. Everything else goes
   through applyBatch. Each entry rolls the stated figure of what it moved at once, so a count stands and only the moves after it change it (sale then count 10.5, count then sale
   8.5); a rename applies where it stands, and an Add ID has booked before the trade that names it (the plan orders them). What is written once for the batch is the ROLLED
   sentence, the sum of every roll of a product, QUEUE_COMMITTED and the sort. */
export function applyInto(book, p, staged, notes, ctx) {
  const nextRid = ctx.nextRid, sortBook = ctx.sortBook;
  const moves = [], rolls = [], entryMoves = [];
  let newest = book.QUEUE_COMMITTED || "";
  const folded = [], renames = [];
  for (const it of p.items) {
    const r = applyEntry(book, it, { nextRid, staged, notes, moves: movesOf(p, it), reward: ctx.reward || null, today: ctx.today || null, pricing: ctx.pricing || null });
    moves.push(...r.moves);   /* refund words, in entry order */
    rolls.push(...r.rolls); entryMoves.push(...r.entryMoves);
    for (const rn of renames) E.renameInBook(book, rn.pairs);   /* a rename already applied carries a row booked after it under the old code, as the fold's last-of-all rename always did */
    for (const rn of r.renames) {   /* v628, now in booked order: the rename applies when its entry does */
      E.renameInBook(book, rn.pairs);   // PLACED is a map keyed by code, so a point filed earlier moves with the code
      if (rn.geo) { book.PLACED = book.PLACED || {}; book.PLACED[rn.to] = rn.geo; }   // v633: and a new place moves it on
      renames.push(rn);
    }
    if (r.newest > newest) newest = r.newest;
    folded.push(it.id);
  }
  /* THE ROLL NOTE: one sentence a product for the batch, the entries' rolls summed (from the first, to the last) */
  const byProd = {};
  for (const m of entryMoves) { byProd[m.product] = byProd[m.product] || []; byProd[m.product].push(m); }
  for (const prod of Object.keys(byProd)) {
    const ms = byProd[prod], rs = rolls.filter((x) => x.product === prod && !x.uncounted);
    const out = ms.filter((m) => m.kg < 0).reduce((a, m) => a - m.kg, 0), inn = ms.filter((m) => m.kg > 0).reduce((a, m) => a + m.kg, 0);
    if (!rs.length) { moves.push({ product: prod, from: null, out, inn, to: null, uncounted: true }); continue; }
    const desc = ms.map((m) => `${Math.abs(m.kg)} unit ${m.kg < 0 ? "to" : "from"} ${m.who} on ${m.when}`).join(", ");
    const from = rs[0].from, counted = p.items.some((it) => it.count && it.count.product === prod);
    /* a count of this product in the batch stands whatever came before it, so the note names the figure that stands, not the last roll's */
    const to = counted ? (prod === "salt" ? book.STATED_STOCK : (book.PROD_OPENING || {})[prod].stated) : rs[rs.length - 1].to;
    const sums = `${from}${out ? " less " + r2(out) : ""}${inn ? " plus " + r2(inn) : ""}`;
    const sentence = `ROLLED AT ${notes.version}${prod === "salt" ? "" : ` (${prod})`}: ${desc}, ` + (counted
      ? `from ${from}; a count of this product came in this batch and stands, so the figure that now stands is ${to}.`
      : `so ${sums} is ${to}.`) + ` A ROLL AND NOT A COUNT; COUNT_ON is untouched.` + (prod === "salt" && notes.stockNote ? " " + String(notes.stockNote).trim() : "");
    const key = prod === "salt" ? "STATED_STOCK" : "PROD_OPENING";
    book.NOTES = book.NOTES || {}; book.NOTES[key] = [sentence].concat(book.NOTES[key] || []);
    moves.push({ product: prod, from, out, inn, to });
  }
  if (newest && newest > (book.QUEUE_COMMITTED || "")) book.QUEUE_COMMITTED = newest;
  sortBook(book);
  return { book, plan: p, folded, newest, moves, renames };
}
