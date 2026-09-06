/* drafter.js: turn a queued entry into a proposed ledger ROW, in the cloud.
 *
 * This is the piece that removes the laptop from the loop. It reads the queue from KV and the
 * book from D1, writes a proposed row per entry into the `draft` table, and stops. It never
 * writes to `entry`, never touches the master, and never decides anything: the phone does that.
 *
 * IT IS ARITHMETIC, NOT A LANGUAGE MODEL, AND THAT IS A DESIGN DECISION RATHER THAN A LIMIT.
 * Everything an approval screen is read for is a number: the cost the row draws, the margin it
 * makes, whether the price sits on the party's own ladder. Those come from the book and from
 * the desk's own pricing snapshot. Putting a model on that path would add nondeterminism to
 * precisely the figures that have to be right, in a repo whose whole discipline is one engine
 * and no drift. What a model could usefully write is the ROW NOTE, which is prose, and which
 * nobody approves; that is left for later and kept off this path deliberately.
 *
 * WHAT IT REFUSES TO DRAFT is as important as what it drafts. An entry naming a party that is
 * not on the roster, or carrying a shape the desk has no row for, is left alone with a reason
 * recorded. A drafter that guessed would be worse than one that declines, which is the same
 * refusal tools/update.mjs makes for the same reason.
 *
 * THE FLAGS ARE THE POINT. A row that is merely correct tells you nothing you did not type.
 * The value is in the comparisons an entry cannot make against itself: this rate against every
 * rate that party has paid, against the product's whole observed range, against the live floor.
 * The RM115 oil unit of 14 Aug would have tripped two of them.
 */

const round = (n, dp = 2) => Math.round((n + Number.EPSILON) * 10 ** dp) / 10 ** dp;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const prodOf = (r) => (r && r.product) || "salt";

/* ---- reading the book out of the mirror ------------------------------------------- */
/* One query per collection, plus the state singletons. The mirror is kept level by the same
 * pass that commits, so a snapshot older than the master means the run should flag, not
 * proceed: pricing off a stale shelf is how a wrong cost reaches an approval screen looking
 * authoritative. */
import PRICING_ENGINE from "../engine/pricing.mjs";
import POSITION_ENGINE from "../engine/position.mjs";

export async function readBook(db) {
  const rows = async (c) => {
    const rs = await db.prepare("SELECT doc FROM entry WHERE collection=?1 ORDER BY seq").bind(c).all();
    return (rs.results || []).map((r) => { try { return JSON.parse(r.doc); } catch (e) { return null; } }).filter(Boolean);
  };
  const state = {};
  const rs = await db.prepare("SELECT key,doc FROM state").all();
  for (const r of (rs.results || [])) { try { state[r.key] = JSON.parse(r.doc); } catch (e) { /* skip */ } }
  const snap = await db.prepare("SELECT v,stamped FROM snapshot WHERE one=1").first();
  return {
    sales: await rows("sales"),
    purchases: await rows("purchases"),
    state,
    version: snap ? snap.v : null,
    pricing: state.PRICING || null
  };
}

/* ---- addressing a row, and correcting one ------------------------------------------- */
/* A ROW IS NAMED BY ITS rid, NOT BY WHAT IT SAYS. ovKey is `party|date|total`, which is
 * enough for a fulfilment (none of the three ever changes) and not enough for an editor whose
 * whole job is changing them: correct a party and the row's own key no longer names it. It
 * also already collides on the real book, on two SA5-BTR lots. tools/rid.mjs gave every row a
 * rid for this. ovKey is still accepted so an entry queued before rids existed still resolves,
 * and it is refused when it matches more than one row rather than guessing. */
export function findRow(book, ref) {
  if (!ref) return { err: "this correction names no row" };
  for (const coll of ["sales", "purchases"]) {
    const byRid = (book[coll] || []).filter((r) => r && r.rid === ref);
    if (byRid.length === 1) return { row: byRid[0], collection: coll };
    if (byRid.length > 1) return { err: `${ref} matches ${byRid.length} rows, which should be impossible; the book needs a look` };
  }
  for (const coll of ["sales", "purchases"]) {
    const hits = (book[coll] || []).filter((r) => r && POSITION_ENGINE.ovKey(r) === ref);
    if (hits.length === 1) return { row: hits[0], collection: coll };
    if (hits.length > 1) return { err: `${ref} matches ${hits.length} rows on the book, so which one is meant is a judgement. It has a rid now; name that instead` };
  }
  return { err: `no row on the book matches ${ref}` };
}

/* WHAT A CORRECTION MAY SET: every attribute a person states, and nothing the desk computes.
 * Widened to the whole row on 25 Aug 2026 on his instruction, "I need to be able to edit every
 * attribute of an entry on the ledger". The first cut deliberately withheld the settlement
 * figures on the ground that cash and deliveredQty "move by fulfilment, and two writers on one
 * figure drift". READING THE ENGINE SHOWED THAT WAS WRONG: txPaid is (cash + settledRM) read
 * straight off the row, so the `amend` trail is a NARRATIVE beside the figure and never its
 * source. Setting cash directly is a correction; adding to it is a movement. Both legitimately
 * write the same field, which is exactly what ovAmend already does.
 *
 * A field absent from the patch is left alone; a field set to null is CLEARED, which is how a
 * wrong attribution or a stray date comes off a row rather than being overwritten with another
 * wrong one. Four cannot be cleared, only changed, because a row without them is not a row:
 * product, party, qty and total.
 *
 * WHAT IS NOT HERE, and why each one is excluded rather than forgotten:
 *   rid           the row's identity. Editing it would rename the thing being edited.
 *   amend, mod    the trail. Written by the fold as a record of corrections, including this one.
 *   rev, ref,     DERIVED from assoc + stream. Set those and these follow; setting them
 *   refKg         directly would let a row claim R2 and R3 at once.
 *   status        DERIVED on a purchase from cash against total. Recomputed after every change.
 * Every one of those is computed or structural. Everything a person typed is editable. */
/* READ FROM THE ENGINE, re-exported here so the fold and the tests can reach them by the
   name they already use. One table, three consumers: this drafter, tools/fold.mjs and the
   desk's own ovAmend, which gets it inlined with the rest of the engine. */
export const CORRECT_NUM_POS = POSITION_ENGINE.CORRECT_NUM_POS;
export const CORRECT_NUM_NN = POSITION_ENGINE.CORRECT_NUM_NN;
export const CORRECT_DATE = POSITION_ENGINE.CORRECT_DATE;
export const CORRECT_BOOL = POSITION_ENGINE.CORRECT_BOOL;
export const CORRECT_CODE = POSITION_ENGINE.CORRECT_CODE;
export const CORRECT_TEXT = POSITION_ENGINE.CORRECT_TEXT;
export const HANDOVER = POSITION_ENGINE.HANDOVER;
export const CORRECTABLE = POSITION_ENGINE.CORRECTABLE;
const CORRECT_REQUIRED = POSITION_ENGINE.CORRECT_REQUIRED;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/* Each field checked against the book it is going onto, so a correction is refused for the same
 * reasons a new row is: an unknown product cannot be costed, an unknown code cannot be credited.
 * Anything checkable is CHECKED and refuses; anything merely unusual is FLAGGED and proceeds. */
export function checkCorrection(fields, book, target, isSale) {
  const errs = [], flags = [], changes = [];
  const roster = (book.state && book.state.roster) || [];
  const products = (book.state && book.state.PRODUCTS) || {};
  const associates = (book.state && book.state.associates) || [];
  const partyKey = isSale ? "customer" : "supplier";

  /* THE ROW AS A PERSON WOULD NAME IT, not as it is stored. On an R2 row the counterparty field
     holds the associate and the buyer is the downstream, so reading target[partyKey] as "party"
     would report the associate as the buyer and every before-and-after line would be wrong. The
     engine's attributionOf is the one place that knows this. */
  const at = POSITION_ENGINE.attributionOf(target, partyKey);
  const buyerNow = at.stream === "R2" ? (at.downstream || null) : (target[partyKey] || null);
  const now = Object.assign({}, target, {
    party: buyerNow, assoc: at.assoc, stream: at.stream, downstream: at.downstream,
    product: prodOf(target),
  });

  for (const k of Object.keys(fields)) {
    if (!CORRECTABLE.includes(k)) { errs.push(`${k} is not a field a correction may set`); continue; }
    const v = fields[k];
    if (v === undefined) continue;
    /* AN ABSENT FLAG AND false ARE THE SAME THING on this book: a row that is not cancelled
       simply has no `cancelled` key. Comparing them raw would read null against false as a
       change and record a correction on every save that touched nothing. */
    const raw = now[k] === undefined ? null : now[k];
    const isBool = CORRECT_BOOL.includes(k);
    const was = isBool ? !!raw : raw;
    const asIs = isBool ? !!v : v;
    if (JSON.stringify(asIs) === JSON.stringify(was)) continue;   /* asked for, already true */
    changes.push({ field: k, from: was, to: v });

    if (v === null) {
      if (CORRECT_REQUIRED.includes(k)) errs.push(`${k} cannot be cleared, only changed`);
      continue;
    }
    if (k === "product" && !products[v]) errs.push(`${v} is not a product on this book`);
    if (k === "stream" && v !== "R2" && v !== "R3") errs.push(`a stream is R2 or R3, not ${v}`);
    if (k === "handover" && !HANDOVER.includes(v)) errs.push(`handover is delivered or collected, not ${v}`);
    if (CORRECT_DATE.includes(k) && !DATE_RE.test(String(v))) errs.push(`${k} is not a date in YYYY-MM-DD: ${v}`);
    if (CORRECT_NUM_POS.includes(k) && !(isNum(v) && v > 0)) errs.push(`${k} has to be a number above zero`);
    if (CORRECT_NUM_NN.includes(k) && !(isNum(v) && v >= 0)) errs.push(`${k} has to be a number, and not negative`);
    if (CORRECT_BOOL.includes(k) && typeof v !== "boolean") errs.push(`${k} is true or false, not ${v}`);
    if (CORRECT_TEXT.includes(k) && typeof v !== "string") errs.push(`${k} has to be text`);
    if (CORRECT_CODE.includes(k) && !roster.includes(String(v))) {
      flags.push(`${v} is not on the roster. A party needs a code and a directory entry before this is committed.`);
    }
    if (k === "assoc" && !associates.includes(String(v))) {
      flags.push(`${v} is on the book but is not listed as an associate, so crediting a downsell to them is a new relationship rather than an existing one.`);
    }
  }
  if (!changes.length) errs.push("this correction changes nothing on the row it names");

  const after = Object.assign({}, now);
  for (const k of Object.keys(fields)) {
    if (fields[k] === undefined) continue;
    if (fields[k] === null) delete after[k]; else after[k] = fields[k];
  }
  /* round six: cancelled-and-delivered is a contradiction the desk then chases as money owed
     while the delivered unit leaves the shelf uncosted. The two fields are individually
     correctable, so the PAIR is checked here, on the state the correction would leave. */
  /* v407, round seven: a LOT records receivedQty, so a Correction cancelling a landed lot walked
     past a gate that tested deliveredQty alone, kept its units on the shelf and its cost in the
     basis, and therefore moved wavgBuy and every floor beneath it. Whichever field the direction
     uses, the contradiction is the same one. */
  /* v421: CALL THE RULE, DO NOT RETYPE IT. v413 hand-rolled the received-in-full convention here
     and dropped its defaulted case, so the drafter refused a DEFAULTED lot's cancellation with a
     message asserting 12.5 unit had arrived from a supplier who delivered nothing. A probe made
     the identical mistake against this same rule three folds ago and reported correct code as
     wrong; the rule lives in one place and both readers now call it.
     The sale side gets the same treatment: deliveredQty alone misses a settlement in kind, which
     is why the fold reads txEffDeliv since v415. */
  /* AND IT MUST IGNORE THE CANCELLATION IT IS TESTING. v417 taught poRecvUnits that a cancelled
     lot received nothing, which is right, and this gate measures the state the correction WOULD
     leave, which is cancelled by definition. So it asked how much a cancelled row had received,
     was told none, and let every landed lot through: fold 3 silently disarmed this gate and fold 7
     found it. The question here is what the row carries REGARDLESS of the flag being set. */
  /* v436: ONE RULER. Every cross-field refusal on this road is now POSITION_ENGINE.correctionFaults,
     because the desk previewed as applied the very edits this function refuses (round ten). The
     comments above are kept: they are why each rule exists, and the rule now lives in one place.
     What stays here is everything above -- the per-field type and roster checks -- because this is
     the only reader taking untyped input off the wire. */
  for (const why of POSITION_ENGINE.correctionFaults(target, fields, isSale)) errs.push(why);

  /* AN ATTRIBUTION IS THREE FIELDS THAT ONLY MEAN ANYTHING TOGETHER, and the desk's own rule is
     that R2 books the sale to the associate with the buyer behind it, while R3 leaves the buyer
     on the row and credits the introduction. Setting one leg and not the others is how a
     downsell ends up booked to a bucket owed money by nobody, which is the 02 Aug CS6-BS-R
     failure the desk already guards against at entry. */
  if (after.stream === "R2" && after.assoc && !after.downstream) {
    flags.push("R2 books the row to the associate, so without a downstream the end buyer is recorded nowhere.");
  }

  /* THE COMPARISONS A FIELD CANNOT MAKE AGAINST ITSELF. Each of these is a figure that is legal
     on its own and says something worth reading beside the rest of the row. */
  const num = (x) => (isNum(x) ? x : 0);
  if (num(after.cash) > num(after.total) + 0.005) {
    flags.push(`RM ${round(after.cash)} is recorded as paid against a row worth RM ${round(after.total)}, so it would be RM ${round(num(after.cash) - num(after.total))} overpaid.`);
  }
  if (num(after.deliveredQty) > num(after.qty) + 0.005) {
    flags.push(`${round(after.deliveredQty)} unit is recorded as handed over against an order of ${round(after.qty)} unit.`);
  }
  if (num(after.receivedQty) > num(after.qty) + 0.005) {
    flags.push(`${round(after.receivedQty)} unit is recorded as received against a lot of ${round(after.qty)} unit.`);
  }
  const touchedFigure = changes.some((c) => c.field === "cash" || c.field === "deliveredQty" || c.field === "receivedQty");
  if (touchedFigure && (target.amend || []).length) {
    flags.push(`This row carries a trail of ${target.amend.length} step${target.amend.length === 1 ? "" : "s"}. Setting the figure directly does not rewrite them, so the trail will no longer add up to it; the correction is recorded beside them saying so.`);
  }
  if (changes.some((c) => c.field === "cost")) {
    flags.push("A cost typed here overrides what the shelf says this row drew, and it is what every margin on the row is then measured against.");
  }
  if (changes.some((c) => c.field === "cancelled" && c.to === true)) {
    flags.push("Cancelling takes this row out of every figure on the desk: the revenue, the stock it drew and anything owed on it.");
  }
  if (changes.some((c) => c.field === "party")) {
    flags.push(`This moves the row from ${buyerNow} to ${after.party}, so what each of them owes changes with it, and so does every figure drawn per party.`);
  }
  if (changes.some((c) => c.field === "date") && (num(target.deliveredQty) > 0.005 || num(target.cash) > 0.005)) {
    flags.push("Money or stock has already moved against this row, so redating it moves when that counts as having happened.");
  }

  return { errs, flags, changes, after };
}

/* ---- the lot the row draws --------------------------------------------------------- */
/* THE DESK'S OWN ANSWER FIRST. stockCost is what the master says the shelf is carried at, and
 * it is the number every recent row has used. It is preferred over anything computed here for
 * the reason the whole file exists: two engines drift.
 *
 * The FIFO walk below is a CHECK on that, not a replacement. Where the shelf spans two lots the
 * single figure is an average and the true cost of the next unit out depends on which lot it
 * comes off; that is exactly the case that produced the RM54.20 blend on 14 Aug, and it is
 * flagged rather than silently averaged. */
export function costFor(book, product) {
  const p = product || "salt";
  const snap = book.pricing && book.pricing.byProduct && book.pricing.byProduct[p];
  const deskCost = snap && isNum(snap.stockCost) ? snap.stockCost : null;

  const lots = (book.purchases || [])
    .filter((x) => prodOf(x) === p && isNum(x.qty) && x.qty > 0 && isNum(x.total))
    .map((x) => ({ date: x.receivedOn || x.date, qty: x.qty, rate: round(x.total / x.qty, 4), defaulted: !!x.defaulted }))
    .filter((l) => !l.defaulted)
    .sort((a, b) => (a.date || "") < (b.date || "") ? -1 : 1);
  const latest = lots.length ? lots[lots.length - 1] : null;

  /* IS THE SHELF ONE LOT OR A BLEND? The desk already answers this and the answer is the pair
     of numbers, not the purchase history. STOCK_COST equal to the newest lot rate means every
     unit standing there came off that lot; different means it is an average across two rates
     and the true cost of the next unit out depends which one it draws.
     The first version of this compared the last few PURCHASE rates instead, which was wrong in
     the way that matters: it would have flagged a blend on every row for ever after any rate
     change, including now, when the shelf is a single RM56 lot and the RM47 remnant is gone.
     A flag that fires when nothing is wrong is worse than no flag, because it teaches the
     reader to tap through. */
  const blend = (deskCost != null && latest != null) ? Math.abs(deskCost - latest.rate) > 0.005 : false;

  return {
    cost: deskCost != null ? deskCost : (latest ? latest.rate : null),
    source: deskCost != null ? "the desk's own shelf cost" : (latest ? "the newest received lot" : null),
    latestRate: latest ? latest.rate : null,
    mayBlend: blend
  };
}

/* ---- what the desk would refuse ---------------------------------------------------- */
export function floorFor(book, product, qty) {
  const snap = book.pricing && book.pricing.byProduct && book.pricing.byProduct[product || "salt"];
  if (!snap || !snap.floors) return null;
  /* v385: WHAT THE FLOOR CHARGES FOR HIS TIME, READ OFF THE POLICY AND NEVER TYPED HERE. The
     flag has to say what the floor is made of now that the markup leg is gone, and the one
     figure in it that is a stated policy rather than a cost is timePerOrder. Computed on both
     roads, since a snapshot without inputs still carries carded floors that mean the same
     thing. Null on an older snapshot, and the flag then leaves the clause out rather than
     guessing at RM25. */
  const time = snap.inputs && snap.inputs.policy && isNum(snap.inputs.policy.timePerOrder)
    ? +snap.inputs.policy.timePerOrder : null;
  /* v337: THE ENGINE ANSWERS THE EXACT SIZE when the snapshot carries its inputs, which it does
     from v337. It is the same module the desk runs, fed the same inputs, so the figure is the
     desk's figure at that size and not an interpolation of it. An older snapshot without
     inputs still takes the carded-size road below. */
  if (snap.inputs && snap.inputs.cost && snap.inputs.policy && isNum(qty) && qty > 0) {
    try {
      const C = PRICING_ENGINE.costStack(snap.inputs.cost);
      const x = PRICING_ENGINE.floorTotal(qty, C, snap.inputs.policy);
      if (isNum(x)) return { floor: +x.toFixed(2), at: qty, exact: true, time };
    } catch (e) { /* fall through to the carded sizes */ }
  }
  /* the carded sizes are what the snapshot holds; an odd size takes the nearest carded one
     BELOW it, because rounding up would report a floor the desk never quoted. v502: one floor per
     size; a snapshot from before v502 carried a collected/delivered pair and is read by its
     collected figure, which is what the floor now is. */
  const one = (f) => f && (isNum(f.floor) ? f.floor : (isNum(f.collected) ? f.collected : null));
  const sizes = Object.keys(snap.floors).map(Number).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!sizes.length) return null;
  const exact = one(snap.floors[String(qty)]);
  if (exact != null) return { floor: exact, at: qty, exact: true, time };
  let pick = sizes[0];
  for (const s of sizes) if (s <= qty) pick = s;
  const f = one(snap.floors[String(pick)]);
  return f != null ? { floor: f, at: pick, exact: false, time } : null;
}

/* ---- the comparisons an entry cannot make against itself --------------------------- */
export function flagsFor(entry, row, book, priced) {
  const flags = [];
  const p = prodOf(row);
  const qty = row.qty;
  /* v502: the rate and the floor are read on the GOODS: the delivery charge inside the total is
     not a price paid for salt, so it comes out before anything is compared. */
  const total = isNum(row.total) ? row.total - (isNum(row.delivery) ? row.delivery : 0) : row.total;
  const rate = (isNum(total) && isNum(qty) && qty > 0) ? total / qty : null;
  /* A PURCHASE IS NOT A SALE and most of what follows is meaningless on one. The floor is a
     SELLING floor, "below cost" is circular when the row IS the cost, and a supplier has no
     buying history to compare against. The first version ran all of it on both and told me a
     RM700 restock was RM300 under floor, which is the kind of flag that teaches a reader to
     stop reading them. */
  const isSale = !row.supplier;
  /* Only rows that actually MOVED count as history. A pending row is an intention: nothing was
     paid and nothing went out, so it is not evidence of what a party pays. This matters here
     and not in theory: CC5-OKR's pending RM80 sits on the book undated, and counting it made
     his four RM90 orders look like a party with no standing rate at all. */
  const committed = (book.sales || []).filter((s) => !s.cancelled && s.date);

  /* 1. THE RATE AGAINST THE PRODUCT'S WHOLE OBSERVED RANGE. This is the RM115 oil check, and
        it is first because it is the one that would have caught it: RM115 against a book whose
        oil had never left the RM6 to RM13 band. A factor rather than a fixed band, so it
        scales with whatever the product actually trades at. */
  /* s.total > 0: a committed zero-value row (a free unit, a goodwill settlement) is not a
     price anyone paid, and one of them pulled salt's observed low to RM0, which made the
     low-side check `rate < lo/2` unfireable (round six). */
  const seen = committed.filter((s) => prodOf(s) === p && isNum(s.total) && s.total > 0 && isNum(s.qty) && s.qty > 0)
    .map((s) => (s.total - (isNum(s.delivery) ? s.delivery : 0)) / s.qty);
  if (rate != null && seen.length >= 3) {
    const lo = Math.min(...seen), hi = Math.max(...seen);
    if (rate > hi * 2) flags.push(`RM ${round(rate)}/unit is more than double the highest ${p} rate this book has ever carried (RM ${round(hi)}). Check the figure before approving.`);
    else if (rate < lo / 2) flags.push(`RM ${round(rate)}/unit is less than half the lowest ${p} rate on the book (RM ${round(lo)}).`);
  }

  /* 2. THE RATE AGAINST THIS PARTY'S OWN HISTORY. The CC5-OKR case: RM80 against a party who
        had paid RM90 every time.
        MEASURED AGAINST THE MEDIAN, NOT AGAINST PERFECT UNIFORMITY. The first version fired
        only when every prior rate was identical, which meant one odd order switched the check
        off for that party for ever. A median with a tolerance keeps working, and says plainly
        that it is a typical rate rather than a rule. */
  const party = row.customer || row.supplier;
  const theirs = isSale
    /* v407, round seven: the TWIN of the fix sixteen lines above. v406 added the zero-total
       filter to the observed range and not to the party's own history, so one free unit still
       dragged a party's median down: CS6-BS read RM 108.50 against a real RM 110, which misfires
       at a rate they have actually paid and stays silent 10.9% adrift. Same rule, both sets. */
    ? committed.filter((s) => s.customer === party && prodOf(s) === p && isNum(s.total) && s.total > 0 && isNum(s.qty) && s.qty > 0)
      .map((s) => (s.total - (isNum(s.delivery) ? s.delivery : 0)) / s.qty).sort((a, b) => a - b)
    : [];
  if (rate != null && theirs.length >= 2) {
    const mid = theirs.length % 2 ? theirs[(theirs.length - 1) / 2] : (theirs[theirs.length / 2 - 1] + theirs[theirs.length / 2]) / 2;
    if (mid > 0 && Math.abs(rate - mid) / mid >= 0.10) {
      const uniform = theirs.every((r) => Math.abs(r - theirs[0]) < 0.005);
      flags.push(uniform
        ? `${party} has paid RM ${round(mid)}/unit on every one of their ${theirs.length} orders of ${p}; this one is RM ${round(rate)}.`
        : `${party} typically pays about RM ${round(mid)}/unit for ${p} across ${theirs.length} orders; this one is RM ${round(rate)}, ${round(Math.abs(rate - mid) / mid * 100, 1)}% ${rate > mid ? "above" : "below"} that.`);
    }
  }

  /* 3. AGAINST THE LIVE FLOOR, which moves with the cost and is the reason a printed floor is
        refused anywhere on this desk. Sales only: there is no floor on what you pay a supplier.
        v385: THE FLOOR STOPPED MEANING THIN MARGIN AND THIS SENTENCE IS THE ONLY PLACE ANYONE
        FINDS OUT. The markup leg is gone, so floorTotal is the cost leg alone and a row AT the
        floor now earns nothing whatever: it returns the goods, the run out and the stated
        charge for his time, and not a ringgit above them. The old wording said "under the
        delivered floor" and left the reader to supply a meaning that had just changed under it,
        which on a screen whose whole product is the flags is the worst place to be quietly out
        of date. Removing the leg moves no ask on either book, so this refusal line IS the
        change rather than a caption on it.
        AND IT NAMES WHICH FLOOR. RM10 separates delivered from collected where RM50 used to,
        so "the floor" now reads as one thing when it is two. */
  const fl = isSale ? floorFor(book, p, qty) : null;
  if (fl && isNum(total) && total < fl.floor - 0.005) {
    /* v502: ONE FLOOR, and it is the goods after the leak. Delivery is a figure on the order,
       taken out of the total before this comparison, and his time is not charged. */
    const at = fl.exact ? "" : ` (read at ${fl.at} unit, the nearest carded size)`;
    const made = isNum(fl.time) && fl.time > 0
      ? `the goods after the leak and RM ${round(fl.time)} for your time`
      : "the goods after the leak";
    flags.push(`RM ${round(total)} for the goods is RM ${round(fl.floor - total)} under the floor of RM ${round(fl.floor)}${at}, which is what the order costs to take out: ${made}, with nothing above them.`);
  }

  /* 4. BELOW COST. Separate from the floor because it is a different fact and the book has
        actually done it: the RM6 oil resell of 11 Aug. */
  /* v407, round seven: a cost typed on the full order sheet reached the row and not this flag,
     which priced off the shelf, so an under-water row drew no flag and the prose beside it called
     it profitable while the card's own KPI grid printed the opposite number. The row's own stated
     cost wins where there is one, because that is what every margin on the row is measured
     against once it lands. */
  /* v496: the row's cost is absolute; the unit figure is the engine's derivation, and the shelf's figure is already per unit. */
  const ownCost = isNum(row && row.cost) ? POSITION_ENGINE.txUnitCost(row, priced.cost) : (isNum(priced.cost) ? priced.cost : null);
  if (isSale && ownCost != null && rate != null && rate < ownCost) {
    flags.push(`This sells at RM ${round(rate)}/unit against a cost of RM ${round(ownCost)}${isNum(row && row.cost) ? " stated on the row itself" : " from the shelf"}: it loses money on every unit.`);
  }

  /* 5. A BLENDED SHELF. The cost given is an average and the row may in truth draw two lots. */
  if (priced.mayBlend) {
    flags.push(`The shelf spans more than one lot rate, so RM ${round(priced.cost)}/unit is the shelf average rather than the lot this row draws. Check the blend before approving.`);
  }

  /* 6. A PARTY THIS BOOK DOES NOT KNOW. Checked against the right list for the direction: the
        roster names customers, and a supplier is known by having supplied before. Getting this
        wrong told me SA5-BTR, who has sold the desk almost everything on the shelf, had "no
        committed salt order", which is true and completely beside the point. */
  if (party) {
    if (isSale) {
      const roster = (book.state && book.state.roster) || [];
      if (!roster.includes(party)) flags.push(`${party} is not on the roster. A new party needs a code and a directory entry before this row is committed.`);
      else if (!theirs.length) flags.push(`${party} has no committed ${p} order on the book, so there is no rate of theirs to compare this against.`);
    } else {
      const suppliers = new Set((book.purchases || []).map((x) => x.supplier).filter(Boolean));
      if (!suppliers.has(party)) flags.push(`${party} has never supplied this desk before. Check the code before approving.`);
    }
  }

  /* 7. AN ADVANCE, and whether it sits at the retail credit cap. Reported rather than judged:
        the cap lives in the master's RULES, which is configuration and not mirrored here. */
  if (isNum(row.cash) && isNum(total) && row.cash < total - 0.005 && isNum(row.deliveredQty) && row.deliveredQty > 0) {
    flags.push(`This is an ADVANCE: ${row.deliveredQty} unit goes out with RM ${round(total - row.cash)} unpaid. Check it against ${party}'s credit cap.`);
  }

  /* 8. A STALE SNAPSHOT prices the row off a shelf that has since moved. */
  if (book.pricing && book.version && book.pricing.v && book.pricing.v !== book.version) {
    flags.push(`The pricing snapshot was taken at ${book.pricing.v} but the mirror is at ${book.version}, so the cost and floors here may be stale.`);
  }

  return flags;
}

/* ---- the row ----------------------------------------------------------------------- */
/* Built to the shape the master's own arrays use, because the commit run folds it in verbatim.
 * A PENDING order carries NO DATE, which is the desk's standing rule and not a nicety: an
 * agreed date is an intention, a dated row draws stock and books revenue, and a row that did
 * neither would put both on the book before anything moved. */
export function draftRow(entry, book) {
  const pay = entry && entry.payload;
  if (!pay || typeof pay !== "object") return { skip: "the entry carries no payload the desk can read" };
  /* THE REASON HAS TO NAME THE ACTUAL CASE. This once answered "amends an existing row" for
     every mode that was not `new`, so an ADDID, which registers a party and amends nothing,
     was reported as an amendment. That reads as a bug in the entry rather than a category the
     drafter does not handle, and it is the reason a person reads before deciding what to do. */
  /* AMENDMENTS ARE DRAFTED FROM 20 Aug 2026, AND THE RULE THEY REPLACE WAS RIGHT WHEN WRITTEN.
   * It said "which row it amends is a judgement", and that was true of an amendment arriving as
   * free text with nothing identifying its target. It stopped being true when the phone's Amend
   * tab started making you TAP a specific open order and sending the desk's own ovKey for it:
   * the judgement is now made by the person making it, before the entry is ever queued.
   *
   * FULFILMENT, CANCELLATION AND, FROM 24 Aug 2026, MODIFICATION. All three are mechanical once
   * the row is named: a Modification's payload carries newQty and newTotal exactly as a
   * Fulfilment's carries cash and kg, so "what changed" is no longer free text either, it is a
   * figure typed against a specific tapped order. What is left to judge is whether the NEW
   * figure is sound, and that is exactly what flagsFor already answers for a brand new row: the
   * rate against the product's range, against the party's own history, against the live floor,
   * below cost. Running the same comparisons on a restated rate is what closed the 20 Aug gap
   * (docs/CLOUD_FOLD.md and the changelog record it): a Modification that restated an order to
   * 5 unit for RM50, RM10 a unit against salt that has never gone below RM46, reached the fold
   * with nothing beside it but a person reading it, because a Modification did not go through
   * the gate. It does now. Linked and Rewarded stay refused: neither has a phone form that
   * captures a figure to check, only a judgement about which other row or which award applies.
   *
   * IT DOES NOT COMPUTE THE RESULT, and that is the important restraint. ovAmend in the master
   * is layered, careful logic: a pending lot that stops being pending, a partial receipt, the
   * inTransit flag that exists so a deposit cannot walk a whole lot into the cost basis. A
   * second copy of it here would drift from the first the day either changed. So what is
   * drafted, and therefore what is approved, is the IDENTIFICATION and the FIGURES: is this the
   * right row, and is that what happened to it (or, for a Modification, what it would become).
   * The fold applies it where the desk is. */
  if (pay.mode === "amend") {
    const kind = String(pay.kind || "");
    if (kind !== "Fulfilment" && kind !== "Cancellation" && kind !== "Modification" && kind !== "Correction") {
      return { skip: `this is a ${kind || "nameless"} amendment, and what changed is a judgement rather than which row, so it is left for a person` };
    }

    /* A CORRECTION IS THE ONLY AMENDMENT THAT CAN TARGET ANY ROW, so it takes its branch above
       the open-order lookup rather than through it. Every other kind amends an order that is
       still running, and the OPEN snapshot is the right place to find one. A correction fixes
       what a row SAYS about itself, and a row is as often wrong once it is settled as while it
       is live: 118 of the 125 rows on this book are closed, and none of them could be reached
       at all before this. It reads the full book, which readBook already loads. */
    if (kind === "Correction") {
      const fields = (pay.fields && typeof pay.fields === "object" && !Array.isArray(pay.fields)) ? pay.fields : null;
      if (!fields) return { skip: "this correction carries no fields to set" };
      const found = findRow(book, pay.rid || pay.orderKey);
      if (found.err) return { skip: found.err };
      const target = found.row;
      const isSale = found.collection === "sales";
      const partyKey = isSale ? "customer" : "supplier";
      if (target.cancelled) {
        return { skip: `the row at ${target.rid || pay.orderKey} is cancelled, and correcting a cancelled row is a judgement about whether it should be revived` };
      }

      const chk = checkCorrection(fields, book, target, isSale);
      if (chk.errs.length) return { skip: chk.errs.join("; ") };

      const flags = chk.flags.slice();
      const after = chk.after;
      const product = after.product || "salt";
      const priced = isSale ? costFor(book, product) : { cost: null, mayBlend: false };

      /* THE CORRECTED ROW GETS THE SAME COMPARISONS A NEW ONE DOES. A correction can change the
         product, the size and the price, which between them are every input the rate flags read.
         Running them on the RESULT is the whole reason this goes through the gate instead of
         straight onto the book, and it is the same argument that put Modification through it on
         24 Aug: what is approved is the row as it will stand, not the edit that produced it. */
      if (isSale) {
        const synth = { customer: after.party, qty: +after.qty, total: +after.total, cash: target.cash || 0, deliveredQty: target.deliveredQty || 0 };
        if (product !== "salt") synth.product = product;
        for (const f of flagsFor(entry, synth, book, priced)) flags.push(f);
      }
      /* THE EFFECTIVE FIGURES, NOT THE RAW FIELDS. txPaid is cash plus what was settled in
         kind, and txEffDeliv folds the settled and advanced units in; raw cash misses every
         in-kind settlement, and s010 (cash 0, settledRM 80) proved it by raising nothing when
         its total was corrected below what had actually been paid. */
      const paid = isSale ? POSITION_ENGINE.txPaid(target) : POSITION_ENGINE.poCash(target);
      const movedQty = isSale ? POSITION_ENGINE.txEffDeliv(target) : POSITION_ENGINE.poRecvUnits(target);
      if (isNum(after.total) && after.total < paid - 0.005) {
        flags.push(`The corrected total of RM ${round(after.total)} is under the RM ${round(paid)} already paid against this row.`);
      }
      if (isNum(after.qty) && after.qty < movedQty - 0.005) {
        flags.push(`The corrected quantity of ${round(after.qty)} unit is under the ${round(movedQty)} unit already ${isSale ? "handed over" : "received"}.`);
      }
      if (chk.changes.some((c) => c.field === "total") && after.total > 0.005 && target.unpriced && after.unpriced !== false) {
        flags.push("This row is marked unpriced, and this sets a real total, so the fold clears the unpriced flag with it: a row with an agreed figure is priced by definition.");
      }
      if (!isSale && target.pending && after.pending !== false
        && chk.changes.some((c) => c.field === "cash" || c.field === "receivedQty")) {
        flags.push("This lot is marked pending, which means nothing has moved, and this records money or stock against it. Untick pending if it is no longer agreed-only.");
      }
      if (chk.changes.some((c) => c.field === "product") && isSale && priced.cost != null && isNum(target.cost) && Math.abs(priced.cost - POSITION_ENGINE.txUnitCost(target, priced.cost)) > 0.005) {
        flags.push(`The row carries RM ${round(POSITION_ENGINE.txUnitCost(target, priced.cost))}/unit of cost from its old product. ${product} costs RM ${round(priced.cost)}/unit off the shelf, so this row's margin moves when it is recosted.`);
      }

      const words = chk.changes.map((c) => `${c.field} from ${c.from == null ? "unset" : c.from} to ${c.to == null ? "cleared" : c.to}`);
      const row = {
        rid: target.rid || null,
        qty: target.qty, total: target.total, cash: target.cash != null ? target.cash : 0,
        date: target.date || null, product: prodOf(target), changes: chk.changes,
      };
      row[partyKey] = target[partyKey];

      return {
        collection: found.collection,
        row,
        reasoning: [
          `Correction against ${target[partyKey]}'s ${isSale ? "order" : "lot"} of ${round(target.qty)} unit for RM ${round(target.total)}${target.date ? ` dated ${target.date}` : ", pending and undated"}${target.rid ? ` (${target.rid})` : ""}.`,
          `Sets ${words.join(", ")}.`,
          "It moves no cash and no stock: it changes what the row says about itself.",
          "The row is not rewritten here. The fold applies the patch, so there is one definition of what a correction does rather than two.",
        ].join(" "),
        flags,
        amends: target.rid || pay.orderKey,
        amendKind: kind,
      };
    }

    const key = pay.orderKey;
    if (!key) return { skip: "this amendment names no order, so which row it amends is still a judgement" };
    const open = book.state && book.state.OPEN;
    if (!open || !open.byKey) {
      return { skip: "the mirror carries no open-order snapshot, so the target row cannot be confirmed. Reseed the mirror and it will draft" };
    }
    const t = open.byKey[key];
    if (!t) {
      return { skip: `no OPEN order on the book matches ${key}. It has been settled or cancelled since the phone listed it, or it was folded already` };
    }
    const dir2 = t.dir === "B" ? "BUY" : "SELL";

    /* A MODIFICATION IS A DIFFERENT SHAPE FROM A FULFILMENT: it carries newQty/newTotal rather
       than cash/kg, and nothing moves, so it takes its own branch rather than forcing the
       cash/moved reading below to mean two different things. */
    if (kind === "Modification") {
      const newQty = isNum(pay.newQty) ? +pay.newQty : null;
      const newTotal = isNum(pay.newTotal) ? +pay.newTotal : null;
      if (newQty == null || newTotal == null || newQty <= 0) {
        return { skip: "this modification carries no new quantity and total to restate to" };
      }
      const isSale = dir2 === "SELL";
      const product = t.pr || "salt";
      const priced = isSale ? costFor(book, product) : { cost: null, mayBlend: false };
      /* THE SAME COMPARISONS A NEW ROW GETS, run on the RESTATED rate rather than a fresh one.
         This is the check that was missing on 17 Aug: nothing put the new RM10/unit beside the
         product's RM46-and-up range before it reached the fold. flagsFor is the one place those
         comparisons live, so it is reused rather than re-written here. */
      const synth = { qty: newQty, total: newTotal, cash: t.cash, deliveredQty: t.mv || 0 };
      synth[isSale ? "customer" : "supplier"] = t.p;
      if (product !== "salt") synth.product = product;
      const flags = isSale ? flagsFor(entry, synth, book, priced) : [];
      if (newTotal < (t.cash || 0) - 0.005) {
        flags.push(`The new total of RM ${round(newTotal)} is less than the RM ${round(t.cash || 0)} already paid against this order.`);
      }
      if (newQty < (t.mv || 0) - 0.005) {
        flags.push(`The new quantity of ${round(newQty)} unit is less than the ${round(t.mv || 0)} unit already moved against this order.`);
      }
      if (open.v && book.version && open.v !== book.version) {
        flags.push(`The open-order snapshot was taken at ${open.v} but the mirror is at ${book.version}, so the terms it is restating from may be stale.`);
      }
      const rate = newQty > 0 ? newTotal / newQty : null;
      const reasoning = [
        `Modification against ${t.p}'s ${isSale ? "order" : "lot"} of ${round(t.q)} unit for RM ${round(t.t)}${t.d ? ` agreed ${t.d}` : ", pending and undated"}.`,
        `Restates it to ${round(newQty)} unit for RM ${round(newTotal)}, RM ${round(rate)}/unit.`,
        (isSale && priced.cost != null) ? `Costed at RM ${round(priced.cost)}/unit from ${priced.source}, so ${round((newTotal - priced.cost * newQty) / newTotal * 100, 1)}% margin on the new terms.` : "",
        "The row itself is NOT recomputed here: ovAmend in the master applies it, so there is one definition of what a modification does rather than two.",
      ].filter(Boolean).join(" ");

      /* Shaped like a row so the Approve panel needs no special case for what it shows: the
         TARGET as it stands today, WITH the proposed new figures beside it. */
      const row = { qty: t.q, total: t.t, cash: t.cash, date: t.d || null, newQty: round(newQty), newTotal: round(newTotal) };
      row[isSale ? "customer" : "supplier"] = t.p;
      if (t.pr) row.product = t.pr;

      return {
        collection: isSale ? "sales" : "purchases",
        row, reasoning, flags,
        amends: key,
        amendKind: kind,
      };
    }

    const cash = isNum(pay.cash) ? +pay.cash : 0;
    const moved = isNum(pay.kg) ? +pay.kg : 0;
    const when = pay.date || null;
    if (kind === "Fulfilment") {
      if (cash < 0.005 && moved < 0.005) {
        return { skip: "this fulfilment moves neither cash nor stock, so there is nothing to apply" };
      }
      if (!when) return { skip: "something moved on this amendment but it carries no date, and dating it is a judgement" };
    }

    /* Shaped like a row so the Approve panel needs no special case: it is the TARGET as it
       stands today, which is what has to be recognised before the change is agreed to. */
    const row = { qty: t.q, total: t.t, cash: t.cash, date: t.d || null };
    row[dir2 === "BUY" ? "supplier" : "customer"] = t.p;
    if (t.pr) row.product = t.pr;

    const oweRM = +(t.oweRM || 0), oweUnits = +(t.oweUnits || 0);
    const flags = [];
    /* THE COMPARISONS AN AMENDMENT CANNOT MAKE AGAINST ITSELF, which is the same idea as the
       flags on a new row: everything here is the entry measured against the order it targets. */
    if (kind === "Fulfilment") {
      if (cash > oweRM + 0.005) {
        flags.push(`This pays RM ${round(cash)} against RM ${round(oweRM)} outstanding, so RM ${round(cash - oweRM)} more than the order is owed.`);
      }
      if (moved > oweUnits + 0.005) {
        flags.push(`This hands over ${round(moved)} unit against ${round(oweUnits)} still to move, so ${round(moved - oweUnits)} unit more than the order calls for.`);
      }
      if (t.d && when && when < t.d) {
        flags.push(`Dated ${when}, which is before the order's own date of ${t.d}.`);
      }
      if (cash >= oweRM - 0.005 && moved >= oweUnits - 0.005) {
        flags.push(`This SETTLES the order in full: nothing is left outstanding after it.`);
      }
    } else {
      if (t.cash > 0.005 || t.mv > 0.005) {
        flags.push(`This order has already had RM ${round(t.cash)} and ${round(t.mv)} unit against it. Cancelling a row that has moved is not the same as cancelling one that has not.`);
      }
    }
    if (open.v && book.version && open.v !== book.version) {
      flags.push(`The open-order snapshot was taken at ${open.v} but the mirror is at ${book.version}, so what is outstanding here may be stale.`);
    }

    const left = kind === "Fulfilment"
      ? `Leaves RM ${round(Math.max(0, oweRM - cash))} and ${round(Math.max(0, oweUnits - moved))} unit outstanding.`
      : "The order is withdrawn and counts nowhere.";
    const reasoning = [
      `${kind} against ${t.p}'s ${dir2 === "BUY" ? "lot" : "order"} of ${round(t.q)} unit for RM ${round(t.t)}`,
      t.d ? `agreed ${t.d}.` : "which is pending and undated.",
      kind === "Fulfilment"
        ? `RM ${round(cash)} and ${round(moved)} unit move on ${when}, against RM ${round(oweRM)} and ${round(oweUnits)} unit outstanding. ${left}`
        : left,
      "The row itself is NOT recomputed here: ovAmend in the master applies it, so there is one definition of what a fulfilment does rather than two.",
    ].join(" ");

    return {
      collection: dir2 === "BUY" ? "purchases" : "sales",
      row, reasoning, flags,
      amends: key,
      amendKind: kind,
    };
  }
  /* ---- THE BOOKKEEPING ENTRIES (20 Aug 2026) ------------------------------------------
   * A count, a loss, a lost sale and a party registration. None of them is a row in sales or
   * purchases, which is why migrations/0005 had to widen `collection` before any of this could
   * be stored. The desk's own applyOverlay already applies the first three exactly as the fold
   * will, so nothing here is invented: it is the same treatment, made permanent.
   *
   * WHAT IS BEING APPROVED IS NOT THE FACT, IT IS WHAT THE FACT MEANS. He looked at the shelf;
   * that is not in dispute. What the tap is for is seeing the drift with the part that matters
   * attached, which on 20 Aug was that a count of zero against a roll of 8.05 included SIX UNIT
   * somebody had already paid for. Read as ordinary shrinkage it would have missed that. */
  if (pay.mode === "count") {
    const prod = pay.product || "salt";
    const q = isNum(pay.qty) ? +pay.qty : (isNum(pay.kg) ? +pay.kg : null);
    if (q == null || q < 0) return { skip: "a count needs a quantity. Zero is a valid count; nothing is not" };
    const when = pay.date || null;
    if (!when) return { skip: "a count needs the date it was taken, and dating it is a judgement" };

    const snap = (book.state && book.state.OPEN) || null;
    const pos = (snap && snap.position && snap.position[prod]) || null;
    const flags = [];
    let drift = null;
    if (pos && isNum(pos.onHand)) {
      drift = round(q - pos.onHand);
      if (Math.abs(drift) < 0.005) {
        flags.push(`The book says ${round(pos.onHand)} and you counted the same. Nothing is unaccounted for, which is the first time that can be said since the last count.`);
      } else {
        flags.push(`The book says ${round(pos.onHand)} and you counted ${round(q)}: ${drift > 0 ? "+" : ""}${drift} unit unaccounted for. A COUNT ALWAYS WINS, so this becomes the shelf and the gap books as shrinkage across every unit sold.`);
      }
      /* THE PART THAT IS NOT SHRINKAGE. Stock owed out is paid for and belongs to somebody. */
      if (drift != null && drift < -0.005 && isNum(pos.owedOut) && pos.owedOut > 0.005) {
        flags.push(`${round(pos.owedOut)} unit of this shelf is OWED OUT and already paid for. If the count is right, that stock is not there to deliver, which is a different problem from shrinkage and a worse one.`);
      }
      if (q < 0.005 && isNum(pos.promised) && pos.promised > 0.005) {
        flags.push(`Counting zero against ${round(pos.promised)} unit of promises means every open order on the book is unmeetable until a lot lands.`);
      }
    } else {
      flags.push("The mirror carries no position for this product, so the drift could not be worked out. The count still stands; the comparison does not.");
    }
    const since = snap && snap.countedOn && snap.countedOn[prod];
    return {
      collection: "count",
      row: { product: prod, qty: q, date: when, was: pos ? pos.onHand : null, drift },
      flags,
      reasoning: `Counted ${round(q)} unit of ${prod} by hand on ${when}`
        + (pos ? `, against ${round(pos.onHand)} on the book: a drift of ${drift > 0 ? "+" : ""}${drift}.` : ".")
        + (since ? ` The last count was ${since}.` : "")
        + " A count wins over the ledger, and the fold sets the stated stock and moves COUNT_ON to this date.",
    };
  }

  if (pay.mode === "loss") {
    const prod = pay.product || "salt";
    const q = isNum(pay.kg) ? +pay.kg : (isNum(pay.qty) ? +pay.qty : null);
    if (q == null || !(q > 0)) return { skip: "a loss needs a quantity that actually left the shelf" };
    const when = pay.date || null;
    if (!when) return { skip: "a loss needs a date, and dating it is a judgement" };
    const why = String(pay.why || "").trim();
    if (!why) return { skip: "a loss needs a reason. Without one it is indistinguishable from shrinkage, which the plug already carries" };

    const pos = ((book.state && book.state.OPEN && book.state.OPEN.position) || {})[prod] || null;
    const flags = [];
    if (pos && isNum(pos.onHand)) {
      if (q > pos.onHand + 0.005) {
        flags.push(`This is ${round(q)} unit against a shelf the book puts at ${round(pos.onHand)}. Losing more than you hold means the shelf figure is already wrong, and a COUNT would say more than this entry can.`);
      } else if (pos.onHand > 0.005 && q / pos.onHand >= 0.25) {
        flags.push(`That is ${round(q / pos.onHand * 100, 1)}% of the shelf.`);
      }
    }
    return {
      collection: "loss",
      row: { date: when, product: prod, kg: q, why, note: pay.note || null },
      flags,
      reasoning: `${round(q)} unit of ${prod} left the shelf without a sale on ${when}: ${why}.`
        + " It draws stock and books no revenue, so it lands in selfUseLog and raises the effective cost of everything else.",
    };
  }

  if (pay.mode === "lost") {
    const prod = pay.product || "salt";
    const q = isNum(pay.kg) ? +pay.kg : (isNum(pay.qty) ? +pay.qty : null);
    if (q == null || !(q > 0)) return { skip: "a lost sale needs the quantity that was wanted" };
    const when = pay.date || null;
    if (!when) return { skip: "a lost sale needs a date" };
    const why = String(pay.why || "").trim();
    if (!why) return { skip: "a lost sale needs a reason, or it teaches nothing about why it was lost" };

    const pos = ((book.state && book.state.OPEN && book.state.OPEN.position) || {})[prod] || null;
    const flags = [];
    /* THE ONE COMPARISON WORTH MAKING: was it lost for want of stock, which is a buying
       decision, or for some other reason, which is a pricing or a relationship one. */
    if (pos && isNum(pos.onHand) && pos.onHand < q) {
      flags.push(`The shelf held ${round(pos.onHand)} against ${round(q)} wanted, so this was lost for want of stock rather than on price. That is a restock signal, not a pricing one.`);
    }
    return {
      collection: "lostDemand",
      row: { date: when, product: prod, party: pay.party || null, kg: q, rm: isNum(pay.total) ? +pay.total : 0, why, note: pay.note || null },
      flags,
      reasoning: `${round(q)} unit of ${prod} was wanted on ${when}`
        + (pay.party ? ` by ${pay.party}` : " by a walk-up")
        + (isNum(pay.total) && pay.total > 0 ? ` at RM ${round(pay.total)}` : "")
        + ` and not supplied: ${why}.`
        + " It moves no stock and no cash; it is evidence for restock sizing and for what the price is doing.",
    };
  }

  if (pay.mode === "addid") {
    const code = String(pay.code || "").trim().toUpperCase();
    if (!code) return { skip: "a registration needs a code" };
    if (!/^[A-Z]{1,3}\d{0,2}[A-Z0-9-]*$/.test(code)) {
      return { skip: `"${code}" does not look like a desk code. They run like CA4-DAM or SP7-PUD` };
    }
    const kind = String(pay.kind || "customer");
    const parent = pay.parent || null;
    if (kind === "bucket" && !parent) return { skip: "a bucket sits under a party, and which party is a judgement" };

    const roster = (book.state && book.state.roster) || [];
    const flags = [];
    /* THE ONE THAT MATTERS. A duplicate registration is silent: the fold would append a second
       copy and every roster walk would see the party twice. */
    if (roster.includes(code)) {
      flags.push(`${code} is ALREADY on the roster. Folding this would list the party twice, and the desk walks the roster to build its own tables.`);
    }
    if (parent && !roster.includes(parent)) {
      flags.push(`The parent ${parent} is not on the roster either, so this bucket would hang off nothing.`);
    }
    return {
      collection: "roster",
      row: { code, kind, parent, note: pay.note || null },
      flags,
      reasoning: `Registers ${code} as a ${kind}${parent ? ` under ${parent}` : ""}.`
        + " It touches no figure: the fold appends the code to the roster."
        + " THE NAME AND THE PLACE ARE NOT HERE AND MUST NOT BE: the directory is typed at the laptop and never travels.",
    };
  }
  /* A PRICE EDIT (v354). It moves no stock, no cash and no row: it states what the board asks and
     which sizes it shows. What it CAN do is put a price under its own floor, so that is the flag,
     and it is computed off the PRICING snapshot rather than re-derived here, for the same reason
     nothing else in this file prices anything: two engines drift. */
  if (pay.mode === "price") {
    const product = String(pay.product || "salt");
    const prices = (pay.prices && typeof pay.prices === "object") ? pay.prices : {};
    const hide = Array.isArray(pay.hide) ? pay.hide.map(Number).filter((x) => x > 0) : [];
    for (const k of Object.keys(prices)) {
      if (!(+k > 0)) return { skip: `"${k}" is not a size` };
      if (!(+prices[k] > 0)) return { skip: `the price set at ${k} unit is not a figure` };
    }
    if (!Object.keys(prices).length && !hide.length && !pay.clearing) {
      return { skip: "the edit sets no price and hides no size, so there is nothing to fold" };
    }
    const px = (book.state && book.state.PRICING) || {};
    /* round six: the snapshot nests floors at byProduct[product].floors; a read of px.floors
       was always empty, so the under-floor warning below had never once fired. */
    const floors = (px.byProduct && px.byProduct[product] && px.byProduct[product].floors) || {};
    const flags = [];
    for (const k of Object.keys(prices)) {
      const f = floors[k] && (floors[k].floor != null ? floors[k].floor : (floors[k].collected != null ? floors[k].collected : floors[k].delivered));   /* v502: one floor; older snapshots by their collected figure */
      if (f != null && +prices[k] < f - 0.009) {
        flags.push(`RM${prices[k]} at ${k} unit is UNDER the floor of RM${f.toFixed(2)}. The board will lift it to the next step above the floor rather than quote it, so this is not the price it would set.`);
      }
    }
    if (hide.length) {
      flags.push(`It hides ${hide.length} size${hide.length === 1 ? "" : "s"} from the board: ${hide.join(", ")} unit. They stay priceable off the board; they stop being quoted on it.`);
    }
    const bits = Object.keys(prices).map((k) => `${k} unit at RM${prices[k]}`);
    return {
      collection: "priceset",
      row: { product, prices, hide },
      flags,
      reasoning: `Sets the board for ${product}${bits.length ? `: ${bits.join(", ")}` : ""}${hide.length ? `, hiding ${hide.join(", ")} unit` : ""}.`
        + " It moves no stock, no cash and no ledger row: it states what the board asks."
        + " A stated price replaces the markup and nothing else, so the rate-may-not-rise walk and the"
        + " floor guard both still run on it, and setting one price moves every size above it.",
    };
  }
  if (pay.mode && pay.mode !== "new") {
    return { skip: `this entry carries mode "${pay.mode}", which the drafter has no row shape for, so it is left for a person` };
  }

  const dir = String(pay.direction || "").toUpperCase();
  if (dir !== "SELL" && dir !== "BUY") return { skip: "the entry names no direction" };
  const party = pay.party;
  if (!party) return { skip: "the entry names no counterparty" };
  /* ASSOCIATE ATTRIBUTION IS CHECKED NOW, NOT REFUSED WHOLESALE (25 Aug 2026, on his
     instruction). The old line refused any entry carrying assoc, stream, downstream, linkTo or
     orderCode together, on the ground that "whose bucket the row books to" is a judgement. That
     was true of the link fields and never true of the other three: an associate, a stream and a
     downstream are three codes, each either on the roster or not, and the desk's own rule for
     turning them into a row is four lines long and unambiguous. Refusing them meant a downsell
     could only be typed at the laptop, which is the gap that made this whole change necessary.

     THE LINK FIELDS STAY REFUSED, and for the reason the old wording gave: linkTo and orderCode
     name ANOTHER order, and which order a row links to is a judgement no figure settles. */
  if (pay.linkTo || pay.orderCode) {
    return { skip: "the entry links to another order, and which order it links to is a judgement rather than a figure, so it is left for a person" };
  }
  const assoc = pay.assoc || null;
  const stream = pay.stream || null;
  const downstream = pay.downstream || null;
  if (assoc && stream !== "R2" && stream !== "R3") {
    return { skip: `an associate is credited through a stream, R2 or R3, and this entry carries ${stream ? `"${stream}"` : "none"}` };
  }
  if (!assoc && (stream || downstream)) {
    return { skip: "the entry carries a stream or a downstream but names no associate, so the credit reaches nobody" };
  }
  if (assoc && dir === "BUY") {
    return { skip: "an associate credits a sale, and this entry is a purchase" };
  }

  const product = pay.product || "salt";
  const qty = isNum(pay.qty) ? pay.qty : null;
  const total = isNum(pay.total) ? pay.total : null;
  if (qty == null || total == null) return { skip: "the entry has no quantity or no total" };

  const cash = isNum(pay.cash) ? pay.cash : 0;
  const moved = isNum(pay.kg) ? pay.kg : 0;
  const priced = costFor(book, product);
  if (priced.cost == null) return { skip: dir === "BUY"
    ? `the book has no cost for ${product} yet, so this first lot has nothing to be checked against: fold it by hand to establish the cost, then later lots go through this gate`
    : `nothing on the book says what ${product} costs, so the row cannot be priced` };

  const paidInFull = cash >= total - 0.005;
  const deliveredInFull = moved >= qty - 0.005;
  const nothingMoved = cash < 0.005 && moved < 0.005;

  /* v496: the shelf prices per unit; the row's cost is the order's, absolute. */
  const row = { customer: party, qty, total, cost: round(priced.cost * qty), cash: round(cash) };
  /* v502: the delivery charge inside the total, typed per order; absent or zero means none */
  if (isNum(pay.delivery) && pay.delivery > 0.005) {
    if (pay.delivery > total + 0.005) return { skip: `the delivery charge (RM ${round(pay.delivery)}) is more than the order's total (RM ${round(total)})` };
    row.delivery = round(pay.delivery);
  }
  /* v373: who moved the goods, when the entry says. A sale that does not say carries no key,
     because the measured delivered share counts the rows that answered and not the silent ones. */
  if (dir === "SELL" && HANDOVER.includes(pay.handover)) row.handover = pay.handover;
  /* v377: THE REST OF THE ROW, when the sheet stated it. The Workbench names eleven fields in
     the queue contract; the order sheet renders the whole correctable table, so anything past
     those eleven arrives in `more` and is checked HERE, field by field, against the same
     arrays a correction goes through. It refuses rather than guesses: an unknown key, a date
     that is not a date, a flag that is not a boolean, and the row is not drafted at all. */
  if (pay.more && typeof pay.more === "object") {
    const bad = [];
    for (const k of Object.keys(pay.more)) {
      const v = pay.more[k];
      if (v === null || v === undefined) continue;
      if (!CORRECTABLE.includes(k)) { bad.push(`${k} is not a field an entry may set`); continue; }
      if (CORRECT_DATE.includes(k) && !DATE_RE.test(String(v))) bad.push(`${k} is not a date in YYYY-MM-DD: ${v}`);
      else if (CORRECT_NUM_POS.includes(k) && !(isNum(v) && v > 0)) bad.push(`${k} has to be a number above zero`);
      else if (CORRECT_NUM_NN.includes(k) && !(isNum(v) && v >= 0)) bad.push(`${k} has to be a number, and not negative`);
      else if (CORRECT_BOOL.includes(k) && typeof v !== "boolean") bad.push(`${k} is true or false, not ${v}`);
      else if (CORRECT_TEXT.includes(k) && typeof v !== "string") bad.push(`${k} has to be text`);
      else if (CORRECT_BOOL.includes(k)) { if (v === true) row[k] = true; }
      else row[k] = v;
    }
    if (bad.length) return { skip: bad.join("; ") };
  }
  if (dir === "BUY") {
    delete row.customer; delete row.cost;
    row.supplier = party;
    row.status = paidInFull ? "paid" : (cash > 0.005 ? "part" : "unpaid");
    /* PENDING PURCHASES MUST CARRY pending:true, and this was found by folding one.
       poLive() excludes a lot by THIS FLAG, not by any status string, so a purchase written
       without it counts as live the moment it exists. It adds no stock, because received
       quantity is read from receivedOn, but it is eligible to become the NEWEST LOT, and the
       newest lot sets the replacement cost the whole floor is built on. An order that had not
       arrived would have been pricing the book. The first version emitted status:"part" for a
       purchase with nothing paid and nothing received, which is wrong twice over. */
    if (nothingMoved) row.pending = true;
  }
  if (product !== "salt") row.product = product;

  /* THE DATE, and the rule it follows. Nothing moved means nothing happened, so the row is
     pending and undated and counts nowhere until it does. */
  if (!nothingMoved) {
    row.date = pay.date || null;
    if (!row.date) return { skip: "something moved on this entry but it carries no date, and dating it is a judgement" };
    if (dir === "SELL") {
      row.deliveredQty = moved;
      if (moved > 0.005) row.deliveredOn = row.date;
      if (paidInFull) row.paidOn = row.date;
    } else {
      /* v385: A LOT THAT IS PAID AND HAS NOT ARRIVED USED TO BE DRAFTED AS THOUGH IT HAD.
         The SELL branch above states what moved including a zero; this one stated it only when
         something did, so a settled lot came out with no receivedQty and no inTransit. By the
         book's own convention an absent receivedQty on a settled lot means received IN FULL,
         and poRecvUnits agrees, so the row asserted the salt had landed: approve it and the fold
         walks the whole lot into stock and into the cost basis.
         BOTH FIELDS ARE SET, not one, because that is what the fold's own v146 guard does on
         the correction road for exactly this case. A row drafted here and a row corrected there
         have to come out the same shape or the book holds two kinds of unarrived lot. */
      if (moved > 0.005) { row.receivedOn = row.date; row.receivedQty = moved; }
      else { row.receivedQty = 0; row.inTransit = true; }
      if (paidInFull) row.paidOn = row.date;
    }
  } else if (dir === "SELL") {
    /* A PENDING SALE CARRIES NO COST, which is the v266 rule: nothing has been paid and
       nothing delivered, so there is no cost of goods against it, and printing one states a
       profit on a trade that has not happened. The desk suppresses the margin for a Pending
       order anyway, so a stray cost was inert rather than wrong; it is dropped so a drafted
       row has the same shape as every pending row already on the book. */
    delete row.cost;
    row.deliveredQty = 0;
  }
  /* THE DESK'S OWN RULE, COPIED RATHER THAN REINTERPRETED. R2 books the row to the associate;
     R3 leaves the buyer on the row and credits the introduction beside it. These four lines are
     the master's queue branch, and they are here in the same shape deliberately: a phone-entered
     downsell and a laptop-entered one have to produce the same row or the book has two kinds of
     downsell in it. What is NOT copied is the desk's assocOf() inference, which reads the whole
     sales history to guess an associate from a code. Guessing belongs on one side of the gate
     only: the drafter states what it was given and flags the silence, below. */
  const assocFlags = [];
  if (dir === "SELL" && assoc) {
    if (stream === "R3") { row.ref = assoc; row.refKg = qty; }
    else { row.customer = assoc; row.rev = "R2"; if (downstream) row.downstream = downstream; }
    const roster0 = (book.state && book.state.roster) || [];
    const assocs0 = (book.state && book.state.associates) || [];
    if (!roster0.includes(assoc)) assocFlags.push(`${assoc} is not on the roster, so the credit would go to a code the book does not know.`);
    else if (!assocs0.includes(assoc)) assocFlags.push(`${assoc} is on the roster but is not listed as an associate, so this is a new reselling relationship rather than an existing one.`);
    if (downstream && !roster0.includes(downstream)) assocFlags.push(`The downstream ${downstream} is not on the roster.`);
    if (stream === "R2" && !downstream) {
      assocFlags.push(`R2 books this row to ${assoc}, and no downstream was given, so the end buyer ${party} is recorded nowhere on it.`);
    }
    if (stream === "R2") assocFlags.push(`Booked to ${assoc} as an R2 downsell, so ${party} is not the counterparty on this row and gets no statement from it.`);
  }

  if (pay.note) row.note = String(pay.note);

  const rate = qty > 0 ? total / qty : null;
  const margin = (dir === "SELL" && rate != null) ? ((total - priced.cost * qty) / total) * 100 : null;
  const bits = [
    `${dir === "BUY" ? "Bought" : "Sold"} ${qty} unit of ${product} ${dir === "BUY" ? "from" : "to"} ${party} for RM ${round(total)}, RM ${round(rate)}/unit.`,
    dir === "SELL" ? `Costed at RM ${round(priced.cost)}/unit from ${priced.source}, so ${margin == null ? "no margin could be computed" : `RM ${round(total - priced.cost * qty)} on the order at ${round(margin, 1)}%`}.` : "",
    nothingMoved
      ? "Nothing was paid and nothing moved, so the row is PENDING and carries NO DATE: it draws no stock and books no revenue until it does."
      : `${paidInFull ? "Paid in full" : `RM ${round(cash)} of RM ${round(total)} paid`} and ${deliveredInFull ? "delivered in full" : `${moved} of ${qty} unit moved`} on ${row.date}.`,
    "Drafted from the queued entry; the figures come from the mirror and the desk's own pricing snapshot, and nothing is committed until this is approved."
  ].filter(Boolean);

  return {
    collection: dir === "BUY" ? "purchases" : "sales",
    row,
    reasoning: bits.join(" "),
    flags: assocFlags.concat(flagsFor(entry, row, book, priced))
  };
}

/* ---- reading the queue -------------------------------------------------------------- */
async function queueEntries(env) {
  const entries = [];
  let cursor;
  do {
    const list = await env.SALT_QUEUE.list({ prefix: "q:", cursor });
    for (const k of list.keys) {
      const raw = await env.SALT_QUEUE.get(k.name);
      if (!raw) continue;
      try { for (const e of (JSON.parse(raw).queue || [])) entries.push(e); } catch (e) { /* skip a corrupt key */ }
    }
    cursor = list.list_complete ? null : list.cursor;
  } while (cursor);
  const byAt = new Map();
  for (const e of entries) if (e && e.at) byAt.set(e.at, e);
  return byAt;
}

/* ---- a dry run ----------------------------------------------------------------------- */
/* The same decisions, stored nowhere. This is how the drafter is proved against the real book
 * without putting a row in front of anyone: it returns exactly what it WOULD write. */
export async function dryRunDrafter(env) {
  if (!env.SALT_LEDGER) return { ok: false, error: "no ledger binding" };
  if (!env.SALT_QUEUE) return { ok: false, error: "no queue binding" };
  const byAt = await queueEntries(env);
  const book = await readBook(env.SALT_LEDGER);
  const mark = book.state && book.state.QUEUE_COMMITTED;
  const seen = await env.SALT_LEDGER.prepare("SELECT id FROM draft").all();
  const already = new Set((seen.results || []).map((r) => r.id));
  const out = { ok: true, dry: true, mirror: book.version, pricingAt: book.pricing && book.pricing.v, would: [], skipped: [], already: 0, committed: 0 };
  for (const at of [...byAt.keys()].sort()) {
    if (mark && at <= mark) { out.committed++; continue; }
    if (already.has(at)) { out.already++; continue; }
    const d = draftRow(byAt.get(at), book);
    if (d.skip) out.skipped.push({ at, why: d.skip });
    else out.would.push({ at, collection: d.collection, row: d.row, reasoning: d.reasoning, flags: d.flags });
  }
  return out;
}

/* ---- the run ------------------------------------------------------------------------ */
/* Idempotent by construction: a draft's id IS the entry's own `at`, and the insert is
 * INSERT OR IGNORE, so a cron that fires while the last one is still finishing cannot double
 * anything. Entries at or below the watermark are already in the master and are skipped. */
export async function runDrafter(env, { now = () => new Date().toISOString() } = {}) {
  if (!env.SALT_LEDGER) return { ok: false, error: "no ledger binding" };
  if (!env.SALT_QUEUE) return { ok: false, error: "no queue binding" };

  const byAt = await queueEntries(env);
  const book = await readBook(env.SALT_LEDGER);
  const mark = book.state && book.state.QUEUE_COMMITTED;
  const seen = await env.SALT_LEDGER.prepare("SELECT id FROM draft").all();
  const already = new Set((seen.results || []).map((r) => r.id));

  /* SELF-CLEANING, and it runs before anything else. An entry the drafter refused may since
     have been folded by a person, or withdrawn; either way it is at or below the watermark
     now and must stop being listed. Doing it here means nobody has to tidy up, and a stale
     refusal cannot accumulate into a list people learn to ignore. */
  if (mark) await env.SALT_LEDGER.prepare("DELETE FROM refused WHERE id<=?1").bind(mark).run();

  const out = { ok: true, at: now(), considered: 0, drafted: 0, skipped: [], already: 0, committed: 0 };
  for (const at of [...byAt.keys()].sort()) {
    const entry = byAt.get(at);
    if (mark && at <= mark) { out.committed++; continue; }
    out.considered++;
    if (already.has(at)) { out.already++; continue; }
    const d = draftRow(entry, book);
    if (d.skip) {
      out.skipped.push({ at, why: d.skip });
      /* RECORDED SO IT CAN BE SEEN, never so it can be approved. See migrations/0003. */
      await env.SALT_LEDGER.prepare(
        `INSERT OR REPLACE INTO refused (id,entry,why,party,source,seen_at)
         VALUES (?1,?2,?3,?4,?5,?6)`
      ).bind(at, JSON.stringify(entry), d.skip,
        (entry && entry.party) || null, "cloud-drafter", now()).run();
      continue;
    }
    await env.SALT_LEDGER.prepare(
      `INSERT OR IGNORE INTO draft
         (id,status,collection,entry,row,reasoning,flags,party,product,date,qty,total,cost,
          amends,amend_kind,drafter,drafted_at)
       VALUES (?1,'pending',?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)`
    ).bind(
      at, d.collection, JSON.stringify(entry), JSON.stringify(d.row), d.reasoning,
      JSON.stringify(d.flags), d.row.customer || d.row.supplier || null,
      d.row.product || (d.collection === "sales" ? "salt" : null),
      d.row.date || null, d.row.qty ?? null, d.row.total ?? null, d.row.cost ?? null,
      /* NULL on a new row, set on an amendment. The commit run reads these to know whether to
         APPEND the row or apply a change to the one `amends` names. */
      d.amends || null, d.amendKind || null,
      "cloud-drafter", now()
    ).run();
    /* If this id was refused on an earlier pass and now drafts, the refusal is stale the
       moment the row exists. Clearing it here keeps one entry from appearing in both lists. */
    await env.SALT_LEDGER.prepare("DELETE FROM refused WHERE id=?1").bind(at).run();
    out.drafted++;
  }
  return out;
}
