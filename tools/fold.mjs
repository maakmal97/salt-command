/* fold.mjs — THE FOLD AS A DATA WRITE (move 3 of the rebuild, v340).
 *
 * An approved draft becomes a record in ledger/book.json, with its note, and the book is
 * synced into the master. The agent keeps the judgement (the note on every row, the sentence
 * on the roll, the version entry) and loses the syntax: nothing here edits a twelve-thousand
 * line page by hand, and nothing here invents a figure.
 *
 *   node tools/fold.mjs --plan     read master/_to_fold.json against the book; say what each row
 *                                  would do and what it refuses; write master/_fold_notes.json as a
 *                                  skeleton for the agent to fill (never overwrites one that exists)
 *   node tools/fold.mjs --apply    fold everything in the batch with the notes; write book.json,
 *                                  sync the master, set the version and the stamp, prepend the
 *                                  changelog, sort, write master/_folded.json. All or nothing.
 *
 * Paths can be overridden for the tests: --staged, --notes, --book, --master, --folded, --today.
 *
 * WHAT IT APPLIES, exactly as docs/CLOUD_FOLD.md states and as the desk's own overlay would:
 *   a new row         appended to sales or purchases WITH ITS NOTE (a row with no note is refused)
 *   a fulfilment      applied to the row its key names, as ovAmend in the desk applies it: cash
 *                     and units added, the trail extended, a pending lot that stops being pending
 *                     gets receivedQty 0 and inTransit so a deposit cannot walk it into stock
 *   a cancellation    the row marked cancelled, the trail extended
 *   a modification    the row's qty and total REPLACED with the new terms (nothing added, unlike
 *                     a fulfilment), unpriced cleared if the new total is real, the trail
 *                     extended and a plain restated-from-to line appended to the row's mod field
 *   a count           the stated stock set and COUNT_ON moved; the one entry that moves it
 *   a loss            appended to selfUseLog     a lost sale   appended to lostDemand
 *   a registration    the code appended to the roster; the directory is never touched
 *   an appointment    a registration whose kind is reseller or referral: the code also joins
 *                     associates, and is given its <CODE>-R account (v610). The code may
 *                     already be on the roster, since a party is registered when they first buy
 *                     and appointed when he decides
 *   a price edit      PRICE_SET[product] REPLACED with what he set: the form on the desk is the
 *                     whole statement of what the board should be, so a price he cleared is cleared
 *   a rename (v628)   Amend ID: the code re-keyed wherever the book holds it, AFTER every other row
 *                     in the batch, with its -R account; the statement key, a place override and the
 *                     suite's fixtures follow; refused for a code the desk's own logic names
 *   a place (v633)    PLACED[code] set to the point its place was found or tapped at, one party or
 *                     many; a registration and a rename may carry the point too
 *   a tier (v643)     TIER_OF[code][product] set to the level named or cleared, one customer or every
 *                     proposal at once; one for each product since v646
 * then the shelf is ROLLED for what physically moved (a roll, never a count), the watermark
 * moves to the newest id folded, and the book is sorted.
 *
 * WHAT IT REFUSES: a Linked or Rewarded amendment (neither carries a figure the drafter can
 * check, only a judgement about which other row or which award applies); an amendment whose key
 * matches no row or more than one; a new row that would replay one already on the book (same
 * party, date and total); a new row with no note; a version entry with no title or notes. A
 * refusal folds nothing: the batch is applied whole or not at all. */
import { readFileSync, writeFileSync, existsSync, unlinkSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { readBookFile, writeBookFile, syncText, BOOK as BOOK_DEFAULT, MASTER as MASTER_DEFAULT } from "./booksync.mjs";
import PRICING_ENGINE from "../engine/pricing.mjs";   /* v670: the one shape check for a held tier, shared with the drafter */
/* v670: a tier as words, one level or a band set spelled band by band, so a refusal or a plan line never reads [object Object] */
const sayLevel = (v) => v == null ? "not set" : typeof v === "string" ? v
  : (typeof v === "object" ? (["small", "mid", "big"].filter((k) => v[k]).map((k) => k + " " + v[k]).join(", ") || JSON.stringify(v)) : String(v));
import { sortBook } from "./sort-ledger.mjs";
import POSITION_ENGINE from "../engine/position.mjs";
import { nextRid } from "./rid.mjs";
import { userFor, usersJson } from "./stmt-crypto.mjs";
import { freeSpares, oneCodeEach } from "./stmt-pool.mjs";
import { CORRECT_BOOL, CORRECT_DATE, CORRECT_NUM_NN, CORRECT_NUM_POS, CORRECT_TEXT } from "../src/drafter.js";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const opt = (name, d) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const MASTER = opt("--master", MASTER_DEFAULT);
const BOOK = opt("--book", BOOK_DEFAULT);
const STAGED = opt("--staged", resolve(dirname(MASTER), "_to_fold.json"));
const NOTES = opt("--notes", resolve(dirname(MASTER), "_fold_notes.json"));
const FOLDED = opt("--folded", resolve(dirname(MASTER), "_folded.json"));
const USERS = opt("--users", resolve(REPO, "statements", "_users.json"));   // v588
const PLACES = opt("--places", resolve(REPO, "geo", "places.json"));       // v628
const SUITE = opt("--suite", resolve(REPO, "test", "verify.mjs"));         // v628
const STMTS = opt("--statements", resolve(REPO, "statements"));             // 19 Sep 2026: the password files, laptop only
const TODAY = opt("--today", new Date(Date.now() + 8 * 36e5).toISOString().slice(0, 10));   // Kuala Lumpur

const E = POSITION_ENGINE;
const r2 = (v) => +(+v).toFixed(2);
/* the engine's table, not a second copy: which Add ID kind appoints, and for which stream */
const APPOINTS = POSITION_ENGINE.ADDID_APPOINTS;
/* v588, HIS INSTRUCTION OF 11 SEP 2026: EVERY CUSTOMER HAS A PERMANENT STATEMENT USERNAME FROM THE DAY THEY ARE
   REGISTERED. It used to be minted the month a customer was first issued a statement, so a new customer had
   no address for up to a month: no statement link, and no QR on a printed board. The fold mints it with the
   registration, by the same userFor as the statements run, and never touches one that exists. These are the
   kinds whose rows book to them and so are issued a statement; a supplier, a bucket and an associate's end
   buyer are not, and get none. */
const STATEMENT_KINDS = ["customer", "reseller", "referral"];
/* D15, HIS ANSWER OF 24 SEP 2026: ACCOUNTS READY ON DAY ONE. `spares` are the free spare accounts the laptop
   minted ahead of need (tools/stmt-pool.mjs), in order: a registration takes the next one, so its username
   already has a sealed record behind it and the publish in this same run opens it. The binding is the one
   line in _users.json, so it lives in the repo, and nothing here needs a key. With none free it mints a bare
   username as before, and the laptop's next update makes the account. */
export function mintUsernames(users, staged, folded, spares) {
  const minted = [];
  const free = (spares || []).slice();
  for (const a of (staged && staged.approved) || []) {
    const r = a.row || {};
    if (a.collection === "roster" && folded.includes(a.id) && STATEMENT_KINDS.includes(r.kind) && !users[r.code]) {
      if (free.length) users[r.code] = free.shift(); else userFor(users, r.code);
      minted.push(r.code);
    }
  }
  return minted;
}
/* The run's half: read the pool off the committed records, bind, and write _users.json in its one format.
   It throws, writing nothing, on a file that gives one username to two codes (oneCodeEach), and the run
   calls it before the book is written, so that refusal folds nothing. */
export function registerAccounts(stmtsDir, usersFile, staged, folded) {
  const users = existsSync(usersFile) ? JSON.parse(readFileSync(usersFile, "utf8")) : {};
  const spares = freeSpares(stmtsDir, users);
  const minted = mintUsernames(users, staged, folded, spares);
  oneCodeEach(users);
  if (minted.length) writeFileSync(usersFile, usersJson(users));
  return { users, minted, bound: minted.filter((c) => spares.includes(users[c])) };
}
const stamp = () => { const d = new Date(Date.now() + 8 * 36e5); const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} KL`; };
const dayOf = (iso) => { const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; const [y, m, d] = iso.split("-"); return `${d} ${MON[+m - 1]} ${y}`; };

/* ---- read the batch ---------------------------------------------------------------------- */
function readStaged() {
  if (!existsSync(STAGED)) return null;
  const j = JSON.parse(readFileSync(STAGED, "utf8"));
  if (!j || !j.ok) throw new Error("the staged file does not report ok");
  return j;
}
function prodOf(row) { return (row && row.product) || "salt"; }
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
    case "count": return `COUNT ${r.product} ${r.qty} unit on ${r.date} (book said ${r.was}, drift ${r.drift})`;
    case "loss": return `LOSS ${r.kg} unit ${r.product} on ${r.date}: ${r.why}`;
    case "loan": return `${r.direction === "in" ? "BORROW" : "LEND"} ${r.form === "cash" ? "RM " + r.valueRM + " in cash" : r.valueKg + " unit " + (r.product || "salt")} ${r.direction === "in" ? "from" : "to"} ${r.party} on ${r.date}`;
    case "repayment": return `REPAY ${r.form === "cash" ? "RM " + r.rm : r.kg + " unit " + (r.product || "salt")} ${r.direction === "in" ? "to" : "from"} ${r.party} on loan ${r.loan}, ${r.date}${r.settles ? ", settling it" : ""}`;
    case "lostDemand": return `LOST SALE ${r.kg} unit ${r.product}${r.party ? " to " + r.party : ""} on ${r.date}: ${r.why}`;
    case "roster": return `${APPOINTS[r.kind] ? "APPOINT" : "REGISTER"} ${r.code} as ${r.kind}${r.parent ? " under " + r.parent : ""}${r.tiers ? " at " + Object.entries(r.tiers).map(([p, t]) => p + " " + t).join(", ") : ""}`;
    case "rename": return `RENAME ${r.from} to ${r.to}`;
    case "place": return `PLACE ${Object.keys(r.places || {}).join(", ")} on the map`;
    case "tierset": return `TIER ${Object.entries(r.tiers || {}).map(([c, t]) => c + " " + Object.entries(t || {}).map(([p, v]) => p + " " + sayLevel(v)).join(" ")).join(", ")}`;
    case "priceset": return `SET THE BOARD for ${r.product}${Object.keys(r.prices || {}).length ? ": " + Object.entries(r.prices).map(([q, p]) => `${q} unit at RM${p}`).join(", ") : ""}${(r.hide || []).length ? `, hiding ${r.hide.join(", ")} unit` : ""}`;
    default: return `${item.collection}: ${JSON.stringify(r).slice(0, 80)}`;
  }
}

/* ---- the plan: what each item would do, and what is refused ----------------------------- */
export function plan(book, staged, notes) {
  const out = { items: [], refused: [], moves: [] };
  const rows = (staged && staged.approved) || [];
  /* v742: WHAT EACH ROW HAS MOVED SO FAR IN THIS BATCH, keyed on the book row, so a second amendment on one row in
     one batch is struck from where the first left it and not from the book as it stood before the batch: a handover
     in two stages inside one hour stages two corrections, and the site's running total would have rolled twice. The
     baseline is the ENGINE's reading, not the raw field: a lot stored without receivedQty is read by poRecvUnits as
     received in full, and stating that figure must move nothing. */
  const movedSoFar = new Map();
  const movedOf = (row, d) => movedSoFar.has(row) ? movedSoFar.get(row) : (d === "BUY" ? E.poRecvUnits(row) : (+row.deliveredQty || 0));
  for (const it of rows) {
    const entry = { id: it.id, what: describe(it), does: [] };
    const r = it.row || {};
    /* round six: the fold took row.product verbatim, so a row folded under an unregistered
       product shipped to the phone as a ledger line while every total excluded it. This is
       the third-product bootstrap path (the drafter refuses the first lot, so it is
       hand-folded, and hand-folding is where registration gets forgotten). */
    if (!it.amends && ["sales", "purchases", "count", "loss", "lostDemand", "priceset"].includes(it.collection)) {
      const pr = prodOf(r);
      if (!((book.PRODUCTS || {})[pr])) { out.refused.push({ id: it.id, why: `${pr} is not a product on this book: register it in PRODUCTS and PROD_ORDER (and give it a quote) before its rows fold` }); continue; }
    }
    if (it.amends) {
      if (it.amendKind !== "Fulfilment" && it.amendKind !== "Cancellation" && it.amendKind !== "Modification" && it.amendKind !== "Correction") { out.refused.push({ id: it.id, why: `${it.amendKind || "nameless"} amendment: what changed is a judgement, left for a person` }); continue; }
      const dir = (it.entry && it.entry.payload && it.entry.payload.direction) || "SELL";
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
        entry.pay = { date: pay.date || null, kind: "Correction", cash: 0, kg: 0, fields };
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
        entry.does.push(`${it.amendKind.toLowerCase()} ${entry.pay.cash ? "RM" + entry.pay.cash + " " : ""}${entry.pay.kg ? entry.pay.kg + " unit " : ""}on ${entry.pay.date} against ${dir === "BUY" ? "lot" : "order"} ${it.amends}`);
      }
      if (dir !== "BUY" && entry.pay.kg > 0.009) out.moves.push({ product: prodOf(hits[0]), kg: -entry.pay.kg, who: hits[0].customer, when: entry.pay.date });
      if (dir === "BUY" && entry.pay.kg > 0.009) out.moves.push({ product: prodOf(hits[0]), kg: +entry.pay.kg, who: hits[0].supplier, when: entry.pay.date, landed: true });
      if (entry.pay.kg > 0.009) movedSoFar.set(hits[0], +(movedOf(hits[0], dir) + entry.pay.kg).toFixed(3));   /* v742: the batch's running figure follows a fulfilment too */
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
      const twinOf = (x) => x[key] === r[key] && (x.date || null) === (r.date || null) && +x.total === +r.total && +x.qty === +r.qty;
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
      entry.append = it.collection; entry.row = r;   /* the row, so a later item in this batch can see it */
      entry.does.push(`append to ${it.collection} with its note`);
      const moved = it.collection === "sales" ? (+r.deliveredQty || 0) : (r.pending || r.inTransit ? 0 : (r.receivedQty != null ? +r.receivedQty : +r.qty || 0));
      if (moved > 0.009) out.moves.push({ product: prodOf(r), kg: it.collection === "sales" ? -moved : +moved, who: r[key], when: r.date || TODAY, landed: it.collection === "purchases" });
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
      const appoints = !!APPOINTS[r.kind];
      const onRoster = (book.roster || []).includes(r.code);
      if (onRoster && !appoints) { out.refused.push({ id: it.id, why: `${r.code} is already on the roster` }); continue; }
      if (appoints && (book.associates || []).includes(r.code)) { out.refused.push({ id: it.id, why: `${r.code} is already an associate` }); continue; }
      const resell = POSITION_ENGINE.appointBucket(r.kind, r.code);
      const rt = r.tiers || {}, rtOff = Object.keys(rt).filter((p) => !(book.PRODUCTS || {})[p]), rtBad = Object.keys(rt).filter((p) => !tierNames().includes(rt[p]));   // v645, per product since v646
      if (rtOff.length || rtBad.length) { out.refused.push({ id: it.id, why: rtOff.length ? `${rtOff.join(" and ")} is not a product on this book` : `${rtBad.map((p) => rt[p]).join(" and ")} is not a tier` }); continue; }
      entry.roster = { code: r.code, register: !onRoster, appoint: appoints, resell: resell && !(book.roster || []).includes(resell) ? resell : null, geo: r.geo || null, tiers: r.tiers || null };
      if (entry.roster.register) entry.does.push(`append ${r.code} to the roster (the directory is not touched)`);
      if (r.geo) entry.does.push(`file ${r.code} as a point on the map, about a kilometre, where its place was found`);
      if (STATEMENT_KINDS.includes(r.kind)) entry.does.push(`give ${r.code} a statement username if they have none, kept for life, on the next free spare account where there is one`);
      /* THE FIGURES ARE NOT RESTATED HERE. The reward hurdles and the credit caps are the
         engine's (REWARD.hurdleMultiple, RULES.creditUnits), and a second copy in the fold's
         prose is a second copy that will differ. What the line says is which rules start
         reading them, which is the part that is true whatever the numbers are. */
      if (appoints) entry.does.push(`appoint ${r.code} an associate: R2 and R3 credit reaches them, their credit cap moves from the retail one to the associate one, their turnover hurdles to the associate hurdle, and they leave the customer reward table for the network bench`);
      if (entry.roster.resell) entry.does.push(`append ${entry.roster.resell} to the roster as their resell account, which holds what they buy to sell on`);
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
      /* v643: a customer's tier for each product (v646), checked against the book it folds into and the level names the
         master states; a null clears the product's tier */
      const codes = Object.keys(r.tiers || {}), off = codes.filter((c) => !(book.roster || []).includes(c) || E.isBucket(c));
      const pairs = codes.flatMap((c) => Object.entries((r.tiers[c] && typeof r.tiers[c] === "object") ? r.tiers[c] : {}).map(([p, v]) => [c, p, v]));
      /* v670: a tier may be a band set, so the check is the engine's shape rule rather than a name lookup */
      const noProd = codes.filter((c) => !pairs.some((x) => x[0] === c)), offP = pairs.filter((x) => !(book.PRODUCTS || {})[x[1]]), bad = pairs.filter((x) => x[2] !== null && !PRICING_ENGINE.levelShapeOk(x[2], tierNames()));
      if (!codes.length || off.length || noProd.length || offP.length || bad.length) {
        out.refused.push({ id: it.id, why: !codes.length ? "a tier entry names no customer" : off.length ? `${off.join(" and ")} is not a customer on the roster`
          : noProd.length ? `the tier entry for ${noProd.join(" and ")} names no product` : offP.length ? `${offP.map((x) => x[1]).join(" and ")} is not a product on this book` : `${bad.map((x) => sayLevel(x[2])).join(" and ")} is not a tier` });
        continue;
      }
      entry.tiers = r.tiers;
      entry.does.push(`set ${pairs.map(([c, p, v]) => `${c}'s ${p} tier to ${sayLevel(v)}`).join(", ")}`);
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
    out.items.push(entry);
  }
  return out;
}

/* v628: A CODE WRITTEN INTO THE DESK'S OWN LOGIC cannot be re-keyed by a fold, which writes the book and never the
   master's code: CJ4-OKR is named in DIAMOND and R0_NETWORK. A code quoted anywhere in the master outside the
   generated blocks and the version history is refused, a comment included, because a refusal costs a hand fold
   and a miss costs a desk that names a party the book no longer has. */
let masterLines = null;
/* v643: the level names, read off the master's own TIER_NAMES line, so a fold refuses a tier the desk does not name */
function tierNames() {
  masterLines = masterLines || readFileSync(MASTER, "utf8").split("\n");
  const line = masterLines.find((l) => l.startsWith("const TIER_NAMES=["));
  return line ? (line.match(/'([^']+)'/g) || []).map((x) => x.slice(1, -1)) : [];
}
function pinnedInMaster(code) {
  masterLines = masterLines || readFileSync(MASTER, "utf8").split("\n");
  let generated = false;
  return masterLines.some((l) => {
    if (/^\/\* ==== (BOOK|GEO|ENGINE|DESIGN)\b/.test(l)) { generated = true; return false; }
    if (/^\/\* ==== END (BOOK|GEO|ENGINE|DESIGN)\b/.test(l)) { generated = false; return false; }
    if (generated || /^(const evolution=\[)?\{\s*"?v"?\s*:/.test(l)) return false;
    return l.includes("'" + code + "'") || l.includes('"' + code + '"');
  });
}

/* v628: the files a rename reaches beyond the book. Pure, so the suite folds them on fixtures.
   19 Sep 2026: A FOURTH, because three was never all of them. _passwords.json is filed by CODE and
   nothing moved it, so every Amend ID left that customer's password under the name they had left.
   Four were in that state on the live book and the seal tool had to pair them back by verifier
   proof on every run. Proof is the right SAFETY NET and the wrong mechanism. */
/* the statement account moves to the new code and keeps its username, his rule: the username never changes */
export function renameUsers(users, pairs) {
  for (const [f, t] of pairs) if (users[f] && !users[t]) { users[t] = users[f]; delete users[f]; }
  return users;
}
/* the password goes with the code, so Send can still hand it over after a re-key. LAPTOP ONLY, and
   silently a no-op where the file is absent: _passwords.json is gitignored, so the cloud fold has
   nothing to move and must not pretend otherwise. */
export function renamePasswords(passwords, pairs) {
  let moved = 0;
  for (const [f, t] of pairs) if (passwords[f] !== undefined && passwords[t] === undefined) { passwords[t] = passwords[f]; delete passwords[f]; moved++; }
  return moved;
}
/* a place override follows its code while the code ends in the same place, and goes when the place changed */
export function renameLocs(places, pairs) {
  const L = places.LOCS || {}, tail = (c) => c.slice(c.indexOf("-") + 1);
  let moved = 0;
  for (const [f, t] of pairs) if (f in L) { if (tail(f) === tail(t)) L[t] = L[f]; delete L[f]; moved++; }
  return moved;
}
/* the suite's fixtures name live codes and move with the book, as v603 moved them by hand; whole codes only */
export function renameSuiteText(text, pairs) {
  for (const [f, t] of pairs) text = text.replace(new RegExp("(?<![A-Za-z0-9-])" + f + "(?![A-Za-z0-9-])", "g"), t);
  return text;
}

/* ---- the skeleton the agent fills in ---------------------------------------------------- */
function skeleton(book, staged, p) {
  const cur = book.STATED_STOCK;
  const rows = {};
  for (const it of p.items) rows[it.id] = { what: it.what, note: "" };
  return {
    version: "", date: dayOf(TODAY), title: "", notes: [],
    rows,
    stockNote: "", stockCost: null, stockCostNote: "",
    hint: `Fill note for every row (prose a person auditing it would need; codes only, never a name), the version (the next after the master's), a title in capitals and notes as an array of HTML strings. stockNote is prepended to the roll sentence the tool writes; the salt shelf stands at ${cur}. Leave stockCost null unless a lot landed and the cost basis moves.`
  };
}

/* ---- apply ------------------------------------------------------------------------------- */
/* ovAmend, as the desk applies it, on a plain row */
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
           seeded a step that did not say the row was pending. The desk had it; the fold did not. */
        row.amend = [seedStep(row, dir)];
      }
      row.amend = row.amend.concat([{ date: pay.date || null, kind: "Correction", cash: 0, kg: 0, note: note || line }]);
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
  if (dir === "BUY") {
    /* v435, ROUND TEN: A LOT THAT HAS ARRIVED CANNOT HAVE BEEN DEFAULTED ON. The flag means the supplier
     took the money and sent nothing, and poRecvUnits short-circuits on it, so setting it on a
     landed lot does not merely mislabel the row: it ERASES the goods. Defaulting p001 took its
     received quantity from 12.5 to 0, walking stock that is physically on the shelf out of the
     book. Seventeen lots were offerable. */
    if (pay.kind === "Default") {
      const arrived = E.poRecvUnits(row);
      if (arrived > 0.009) throw new Error(`this lot has received ${arrived} unit, so it cannot be recorded as a supplier default: a default means nothing arrived. Restate the quantity by Modification for what did arrive, then default the remainder`);
      row.defaulted = true; delete row.receivedOn; delete row.pending; return;
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

export function apply(book, staged, notes, masterText) {
  const p = plan(book, staged, notes);
  const problems = [];
  if (p.refused.length) p.refused.forEach((x) => problems.push(`${x.id}: ${x.why}`));
  if (!notes || !notes.version || !/^v\d+$/.test(notes.version)) problems.push("notes.version is missing (the next version after the master's)");
  /* 08 Sep 2026: AND IT IS THE NEXT ONE. The shape alone was checked, so a notes file left behind
     by an earlier hand fold (a v518 file sat beside a v542 master) was accepted whole and wrote
     its stale version ahead of the current one; the changelog then said "already in". */
  else { const m = /const evolution=\[\{\s*"?v"?\s*:\s*['"]v(\d+)['"]/.exec(masterText || "");
    if (m && +notes.version.slice(1) <= +m[1]) problems.push(`notes.version is ${notes.version} against a master already at v${m[1]}: a stale notes file. Delete ${NOTES} and run --plan again`); }
  if (!notes || !notes.title) problems.push("notes.title is missing");
  if (!notes || !Array.isArray(notes.notes) || !notes.notes.length) problems.push("notes.notes is empty: the version entry needs at least one note");
  for (const it of p.items) {
    const n = notes && notes.rows && notes.rows[it.id];
    if (it.append === "sales" || it.append === "purchases") { if (!n || !String(n.note || "").trim()) problems.push(`${it.id}: a new row needs a note`); }
  }
  if (problems.length) return { ok: false, problems };

  const stockCost = (() => { const m = /const STOCK_COST=([\d.]+);/.exec(masterText); return m ? +m[1] : null; })();
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
      }
      /* v496: the shelf's figure is RM per unit; the order's cost is absolute, so it is the shelf times the order's units. */
      if (it.dir !== "BUY" && it.pay.kg > 0.009 && it.target.cost == null && prodOf(it.target) === "salt" && stockCost != null) it.target.cost = +(stockCost * it.target.qty).toFixed(2);
      if (n.cost != null) it.target.cost = +n.cost;
      /* v496: the step was written inside applyAmend before either fill above, so a movement on a row the
         shelf costs, or one the notes recost, takes its cost here, from the order's unit cost as it now stands. */
      { const last = it.target.amend && it.target.amend[it.target.amend.length - 1];
        if (last && (+last.kg || 0) > 0.0001 && it.target.cost != null && it.target.qty > 0) last.cost = +(E.txUnitCost(it.target) * (+last.kg)).toFixed(2); }
      if (n.rowNote) it.target.note = String(n.rowNote) + " " + (it.target.note || "");
    } else if (it.append === "sales" || it.append === "purchases") {
      const row = { ...src.row };
      if (n.cost != null) row.cost = +n.cost;
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

  /* the master: the book, the version entry, the stamp, and the cost basis if it moved */
  let m = syncText(masterText, book);
  const entry = { v: notes.version, d: notes.date || dayOf(TODAY), t: notes.title, n: notes.notes };
  const open = m.indexOf("const evolution=[");
  if (open < 0) return { ok: false, problems: ["the master has no evolution array"] };
  /* v803: THE MASTER HOLDS ONE ENTRY, THE CURRENT VERSION, so the new one REPLACES it; the one it replaces is in
     master/changelog.json already, the gate refusing a master whose version the changelog lacks */
  const close = m.indexOf("}];", open);
  if (close < 0) return { ok: false, problems: ["the master's evolution array is never closed"] };
  m = m.slice(0, open) + "const evolution=[" + JSON.stringify(entry) + "];" + m.slice(close + 3);
  m = m.replace(/const LAST_UPDATED='[^']*';/, `const LAST_UPDATED='${stamp()}';`);
  if (notes.stockCost != null) {
    const re = /const STOCK_COST=[\d.]+;(\s*\/\*)?/;
    if (!re.test(m)) return { ok: false, problems: ["the master has no STOCK_COST line to move"] };
    m = m.replace(re, (all, c) => `const STOCK_COST=${+notes.stockCost};` + (c ? `  /* ${notes.version}: ${String(notes.stockCostNote || "the cost basis moved with the lot that landed").replace(/\*\//g, "* /")}` + (c.includes("/*") ? "\n  " : "") : ""));
  }
  return { ok: true, folded, newest, moves, master: m, plan: p, renames };
}

/* ---- the command line ---------------------------------------------------------------------- */
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const mode = argv.find((a) => a === "--plan" || a === "--apply" || a === "--replays");
  if (!mode) { console.log("usage: node tools/fold.mjs --plan | --apply | --replays   [--staged f] [--notes f] [--book f] [--master f] [--folded f] [--users f] [--today YYYY-MM-DD]"); process.exit(2); }
  const staged = readStaged();
  if (!staged || !staged.count) { console.log("  nothing to fold: no staged batch, or its count is zero. Stop here; do not bump a version."); process.exit(mode === "--replays" ? 1 : 0); }
  const book = readBookFile(BOOK);
  /* v512: IS THE WHOLE BATCH A REPLAY? Exit 0 and print the ids when every staged row is refused
     because the same row is already on the book, and 1 for anything else. The stage job reads
     this to clear a handoff the fold could never take, rather than standing down for ever. */
  if (mode === "--replays") {
    const p = plan(book, staged, null);
    const replay = p.refused.filter((x) => /would be a replay/.test(x.why));
    if (p.items.length === 0 && replay.length === staged.count && replay.length > 0) {
      console.log(replay.map((x) => x.id).join(" ")); process.exit(0);
    }
    console.log("  not a replay batch: " + p.items.length + " row(s) would fold, " + (p.refused.length - replay.length) + " refused for other reasons, " + replay.length + " replay(s)");
    process.exit(1);
  }
  const notes = existsSync(NOTES) ? JSON.parse(readFileSync(NOTES, "utf8")) : null;
  if (mode === "--plan") {
    const p = plan(book, staged, notes);
    console.log(`\nTHE BATCH: ${staged.count} approved row(s) against the book at ${book.QUEUE_COMMITTED}\n`);
    for (const it of p.items) console.log(`  FOLD     ${it.id}  ${it.what}\n           -> ${it.does.join("; ")}`);
    for (const x of p.refused) console.log(`  REFUSE   ${x.id}  ${x.why}`);
    if (p.moves.length) console.log("\n  MOVES    " + p.moves.map((m) => `${m.kg > 0 ? "+" : ""}${m.kg} ${m.product} (${m.who})`).join("; ") + `  from a salt shelf of ${book.STATED_STOCK}`);
    if (!notes) { writeFileSync(NOTES, JSON.stringify(skeleton(book, staged, p), null, 2) + "\n"); console.log(`\n  wrote ${NOTES}: fill in the notes, then run --apply`); }
    else console.log(`\n  ${NOTES} exists; --apply will use it`);
    if (p.refused.length) { console.log("\n  A refusal folds nothing. Resolve it or take the row out of the batch."); process.exit(1); }
  } else {
    if (!notes) { console.log(`  FAIL  no notes at ${NOTES}. Run --plan first and fill in the skeleton.`); process.exit(1); }
    const masterText = readFileSync(MASTER, "utf8");
    const res = apply(book, staged, notes, masterText);
    if (!res.ok) { console.log("  FAIL  nothing folded:"); res.problems.forEach((x) => console.log("         " + x)); process.exit(1); }
    /* v588: a registration that folded is minted its statement username now, not the month of its first statement;
       D15: on the next free spare account where there is one, which opens at this run's publish. Before the book
       is written, so a _users.json giving one username to two codes folds nothing. */
    let reg;
    try { reg = registerAccounts(STMTS, USERS, staged, res.folded); }
    catch (e) { console.log("  FAIL  nothing folded: " + e.message); process.exit(1); }
    const { users, minted, bound } = reg;
    writeBookFile(book, BOOK);
    writeFileSync(MASTER, res.master);
    writeFileSync(FOLDED, JSON.stringify({ ids: res.folded }) + "\n");
    if (minted.length) console.log(`  ok    statement username minted for ${minted.join(", ")}, kept for life`
      + (bound.length ? `; ${bound.join(", ")} on a spare account, which opens at this run's publish` : ""));
    const waiting = minted.filter((c) => !bound.includes(c));
    if (waiting.length) console.log(`  note  no spare account was free for ${waiting.join(", ")}: the account is made at the next laptop update`);
    /* v628: a rename reaches three files beyond the book: the statement key, a place override and the suite */
    const pairs = res.renames.flatMap((x) => x.pairs);
    if (pairs.length) {
      writeFileSync(USERS, usersJson(renameUsers(users, pairs)));
      if (existsSync(SUITE)) writeFileSync(SUITE, renameSuiteText(readFileSync(SUITE, "utf8"), pairs));
      /* the password file, where this laptop has one. The cloud fold has none and skips in silence. */
      for (const dir of readdirSync(STMTS, { withFileTypes: true }).filter((d) => d.isDirectory() && /^\d{4}-\d{2}$/.test(d.name))) {
        const pwFile = resolve(STMTS, dir.name, "_passwords.json");
        if (!existsSync(pwFile)) continue;
        const pw = JSON.parse(readFileSync(pwFile, "utf8").replace(/^\ufeff/, ""));
        const n = renamePasswords(pw, pairs);
        if (n) { writeFileSync(pwFile, JSON.stringify(pw, null, 2) + "\n"); console.log(`  ok    ${n} password(s) moved with the code in ${dir.name}, so Send still finds them`); }
      }
      const places = JSON.parse(readFileSync(PLACES, "utf8"));
      if (renameLocs(places, pairs)) {
        writeFileSync(PLACES, JSON.stringify(places, null, 1) + "\n");
        /* geosync reads the repo's geo/ and nothing else, so only the repo's own file is synced into the master */
        if (PLACES === resolve(REPO, "geo", "places.json")) execFileSync("node", [resolve(REPO, "tools", "geosync.mjs"), "--sync"], { cwd: REPO, encoding: "utf8", env: { ...process.env, SALT_MASTER: MASTER } });
      }
      console.log(`  ok    renamed ${pairs.map((x) => x[0] + " -> " + x[1]).join(", ")} in the book, the statement key, the place overrides and the suite`);
    }
    try { execFileSync("node", [resolve(REPO, "tools", "changelog.mjs")], { cwd: REPO, encoding: "utf8", env: { ...process.env, SALT_MASTER: MASTER } }); }
    catch (e) { console.log("  FAIL  the changelog did not take: " + String((e && e.stdout) || e)); process.exit(1); }
    console.log(`  ok    folded ${res.folded.length} row(s) into ${BOOK} and the master at ${notes.version}`);
    /* 08 Sep 2026: the notes are spent. Left behind, --plan refuses to overwrite them and a later
       hand fold takes them whole, stale version and all. */
    try { unlinkSync(NOTES); } catch (e) { /* already gone */ }
    for (const mv of res.moves) console.log(mv.uncounted ? `  note  ${mv.product}: ${mv.out} out, ${mv.inn} in, but this book is uncounted so nothing stated was rolled` : `  ok    ${mv.product} shelf rolled ${mv.from} -> ${mv.to} (${mv.out} out, ${mv.inn} in)`);
    console.log(`  ok    QUEUE_COMMITTED -> ${book.QUEUE_COMMITTED}; ${FOLDED} names ${res.folded.length} id(s)`);
    console.log("  next  npm run build && npm test, then commit and push. The deploy marks the ids committed.");
  }
}
