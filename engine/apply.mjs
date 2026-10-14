/* engine/apply.mjs: THE BOOKING LAW, THE ROW CORE (S1a-i of the Book plan, 14 Oct 2026). Lifted out of tools/fold.mjs with no
 * behaviour change: how an amendment is written on a row (applyAmend), and what a planned batch does to a book (applyBatch):
 * the rows, the cost stamps, the rids, the counts, the roll and the renames, in the order the fold has always done them.
 *
 * PURE. No fs, no child process, no clock, no reading of the master, and it never mutates what it is handed: applyBatch works on a
 * clone and returns it. What the fold read from disk or the clock comes in through `ctx`: { plan, nextRid, sortBook }, where
 * plan(book, staged, notes) is the plan of this batch against the book it is given (it moves in with S1a-ii), nextRid is
 * tools/rid.mjs's minter and sortBook is tools/sort-ledger.mjs's, both of which read files and so stay outside.
 * It is NOT in tools/engine.mjs's list, so the master's ENGINE block does not carry it, and nothing under stmt/ may import it. */
import POSITION_ENGINE from "./position.mjs";
import { CORRECT_BOOL, CORRECT_DATE, CORRECT_NUM_NN, CORRECT_NUM_POS, CORRECT_TEXT } from "../src/drafter.js";

const E = POSITION_ENGINE;
const r2 = (v) => +(+v).toFixed(2);
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
    const said = [];
    for (const k of E.CORRECTABLE) {
      const was = before[k] === undefined ? null : before[k];
      const now = after[k] === undefined ? null : after[k];
      if (JSON.stringify(was) === JSON.stringify(now)) continue;
      const why = reasons[k] ? `, ${reasons[k]}` : "";
      said.push(`${k} ${was == null ? "(unset)" : was} to ${now == null ? "(cleared)" : now}${why}`);
    }

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
      row.amend = row.amend.concat([{ date: pay.date || null, kind: "Correction", cash: 0, kg: Math.abs(moved) > 0.0009 ? moved : 0, note: note || line }]);
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

/* what a planned batch does to a book (applyBatch: a clone of it, and the argument untouched): the rows in plan order, then the renames, then the roll (a count is its own row, a roll
   is for what physically moved). Returns { book, plan, folded, newest, moves, renames }; the argument is untouched. */
export function applyBatch(book0, staged, notes, ctx) {
  const book = structuredClone(book0);
  const p = ctx.plan(book, staged, notes);
  return applyInto(book, p, staged, notes, ctx);
}
/* the same, on a book the caller owns and wants folded IN PLACE (tools/fold.mjs's apply, whose callers hold the book and its rows
   by identity): `book` is the caller's own working copy and `p` the plan made against it. Everything else goes through applyBatch. */
export function applyInto(book, p, staged, notes, ctx) {
  const nextRid = ctx.nextRid, sortBook = ctx.sortBook;
  /* 26 Sep 2026, HIS INSTRUCTION: THE SHELF'S RATE IS DERIVED FROM THE LOTS, so the master has no STOCK_COST line to
     read or to move. A salt sale leaving the shelf with no cost of its own is costed at the engine's stockBasis on the
     book as it stands before this batch: salt's received lots, allocated newest-first under the salt count the book
     states (PROD_OPENING.salt.stated, else STATED_STOCK, as the desk's countedFor reads it), at their goods rate. It is
     the function the desk's walk runs, so the fold and the desk carry one rate. No salt count stated, no fill, as a
     master without the line had none. */
  const saltOpening = (book.PROD_OPENING || {}).salt || null;
  const saltCount = saltOpening && saltOpening.stated != null ? saltOpening.stated : book.STATED_STOCK;
  const stockCost = saltCount != null ? E.stockBasis((book.purchases || []).filter((r) => prodOf(r) === "salt"), +saltCount, saltOpening).rate : null;
  const fromSalt = book.STATED_STOCK;
  const moves = [];
  let newest = book.QUEUE_COMMITTED || "";
  const folded = [], renames = [];
  for (const it of p.items) {
    const src = staged.approved.find((x) => x.id === it.id);
    const n = (notes.rows && notes.rows[it.id]) || {};
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
    } else if (it.count) {
      const c = it.count;
      if (c.product === "salt") book.STATED_STOCK = c.qty;
      else { book.PROD_OPENING[c.product] = book.PROD_OPENING[c.product] || { qty: 0, costPerKg: null, stated: null }; book.PROD_OPENING[c.product].stated = c.qty; }
      book.COUNT_ON[c.product] = c.date;
      /* v504: every count is kept; the leak is charged from the drift of the last three */
      book.COUNTS = book.COUNTS || [];
      book.COUNTS.push({ product: c.product, date: c.date, qty: c.qty, was: c.was != null ? c.was : null, drift: c.drift != null ? c.drift : null });
      const sentence = `COUNTED AT ${notes.version} on ${c.date}: the ${c.product} inventory held ${c.qty} against ${c.was != null ? c.was : "?"} on the roll, a drift of ${c.drift != null ? c.drift : "?"}. A COUNT AND NOT A ROLL, so COUNT_ON.${c.product} moves to ${c.date}.` + (n.note ? " " + String(n.note).trim() : "");
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
    if (it.id > newest) newest = it.id;
    folded.push(it.id);
  }
  /* v628: A RENAME GOES LAST, so a row folded in the same batch under the old code moves with the rest */
  for (const rn of renames) {
    E.renameInBook(book, rn.pairs);   // PLACED is a map keyed by code, so a point filed earlier moves with the code
    if (rn.geo) { book.PLACED = book.PLACED || {}; book.PLACED[rn.to] = rn.geo; }   // v633: and a new place moves it on
  }
  /* THE ROLL: what physically moved, per product, applied to the stated figure that stands */
  const byProd = {};
  for (const m of p.moves) { byProd[m.product] = byProd[m.product] || []; byProd[m.product].push(m); }
  for (const prod of Object.keys(byProd)) {
    const ms = byProd[prod];
    const out = ms.filter((m) => m.kg < 0).reduce((a, m) => a - m.kg, 0), inn = ms.filter((m) => m.kg > 0).reduce((a, m) => a + m.kg, 0);
    const desc = ms.map((m) => `${Math.abs(m.kg)} unit ${m.kg < 0 ? "to" : "from"} ${m.who} on ${m.when}`).join(", ");
    if (prod === "salt") {
      const from = book.STATED_STOCK, to = r2(from - out + inn);
      book.STATED_STOCK = to;
      const sentence = `ROLLED AT ${notes.version}: ${desc}, so ${from}${out ? " less " + r2(out) : ""}${inn ? " plus " + r2(inn) : ""} is ${to}. A ROLL AND NOT A COUNT; COUNT_ON is untouched.` + (notes.stockNote ? " " + String(notes.stockNote).trim() : "");
      book.NOTES = book.NOTES || {}; book.NOTES.STATED_STOCK = [sentence].concat(book.NOTES.STATED_STOCK || []);
      moves.push({ product: prod, from, out, inn, to });
    } else {
      const o = (book.PROD_OPENING || {})[prod];
      if (o && o.stated != null) {
        const from = o.stated, to = r2(from - out + inn); o.stated = to;
        const sentence = `ROLLED AT ${notes.version} (${prod}): ${desc}, so ${from}${out ? " less " + r2(out) : ""}${inn ? " plus " + r2(inn) : ""} is ${to}. A ROLL AND NOT A COUNT; COUNT_ON is untouched.`;
        book.NOTES = book.NOTES || {}; book.NOTES.PROD_OPENING = [sentence].concat(book.NOTES.PROD_OPENING || []);
        moves.push({ product: prod, from, out, inn, to });
      } else moves.push({ product: prod, from: null, out, inn, to: null, uncounted: true });
    }
  }
  if (newest && newest > (book.QUEUE_COMMITTED || "")) book.QUEUE_COMMITTED = newest;
  sortBook(book);
  return { book, plan: p, folded, newest, moves, renames };
}
