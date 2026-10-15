/* src/approve-figures.js: NOW AND AFTER FOR A ROW WAITING UNDER APPROVE (plan 2 of docs/plans-counter-admin.html, 16 Oct 2026).
 *
 * Counter Admin's approve card says what a draft does to its order: Paid, Owed and Handed over, now and after. The Counter computes
 * no money, so the Desk works the figures out here, off the mirror and the engine's own readings (txPaid, txOwed, txEffDeliv,
 * partyOwedRM), and they ride on each draft of the review read as `figures`. Nothing here decides anything: the drafter, the fold
 * and what one approval does are unchanged, and a draft whose figures cannot be read carries none.
 *
 * A move on a row starts from the row as the mirror holds it, then every move on that row already approved and not yet folded,
 * then each move still pending, in the order they were entered, so two drafts on one row read as one change. The row is moved as
 * the master's ovAmend moves a sale, for the fields a figure reads: a Correction sets the fields it names (null clears), a
 * Modification restates the quantity and total, a Cancellation cancels, any other kind adds its cash and its units. Sales only:
 * a lot's paid and received are other readings, and its card keeps no Now and After.
 *
 * `owedNow` and `owedAfter` are what the customer (the owner of a bucket) owes across the book before and after, partyOwedRM over
 * the mirror's sales with this row as it would stand, and `ceiling` the credit ceiling from TERMS; the card asks a decision only
 * when what they owe goes up. No name is read or returned: codes only (rule 2). */
import POSITION_ENGINE from "../engine/position.mjs";

const E = POSITION_ENGINE;
const PLAIN = [].concat(E.CORRECT_NUM_POS, E.CORRECT_NUM_NN, E.CORRECT_DATE, E.CORRECT_TEXT);
const r2 = (n) => +(+n || 0).toFixed(2);

/** the three figures the card reads off a sale, and its size, total and delivery */
export function rowFigures(s) {
  const paid = E.txPaid(s);
  return {
    paid: r2(paid),
    owed: s.cancelled || s.goodwill || s.defaulted ? 0 : r2(Math.max(0, E.txOwed(s) - paid)),
    handed: +(+E.txEffDeliv(s) || 0).toFixed(3),
    qty: +s.qty || 0, total: r2(s.total), delivery: r2(s.delivery),
    ...(s.cancelled ? { cancelled: true } : {})
  };
}

/** a sale as one move leaves it: a copy, the figure fields only, as ovAmend writes them */
export function moveRow(row, draft) {
  const s = Object.assign({}, row);
  const p = (draft && draft.entry && draft.entry.payload) || {};
  const kind = draft.amendKind || p.kind;
  if (kind === "Correction") {
    const f = p.fields || {};
    const asked = (k) => Object.prototype.hasOwnProperty.call(f, k) && f[k] !== undefined;
    for (const k of PLAIN) if (asked(k)) { if (f[k] === null) delete s[k]; else s[k] = f[k]; }
    for (const k of E.CORRECT_BOOL) if (asked(k)) { if (f[k] === true) s[k] = true; else delete s[k]; }
    return s;
  }
  if (kind === "Modification") {
    if (+p.newQty > 0 && +p.newTotal >= 0) { s.qty = +p.newQty; s.total = +p.newTotal; }
    return s;
  }
  if (kind === "Cancellation") { if (!(E.txEffDeliv(s) > 0.009)) s.cancelled = true; return s; }
  if (s.cancelled) return s;
  s.cash = r2((+s.cash || 0) + (+p.cash || 0));
  s.deliveredQty = r2((+s.deliveredQty || 0) + (+p.kg || 0));
  return s;
}

/** the figures for every pending sale in `pending`, moves on one row read in the order they were entered after the approved
 * ones not yet folded (`waiting`); a draft whose row the mirror lacks carries none. Writes `figures` onto each draft. */
export function approveFigures(book, pending, waiting) {
  const sales = (book && book.sales) || [];
  const terms = (book && book.state && book.state.TERMS) || {};
  const ceiling = typeof terms.ceiling === "number" && Number.isFinite(terms.ceiling) ? terms.ceiling : null;
  /* a move names its row by rid, or by the order key before the row had one (the drafter's `t.rid || orderKey`), as ovAmend finds it */
  const byRid = new Map();
  for (const s of sales) if (s && s.rid) byRid.set(s.rid, s);
  for (const s of sales) { if (!s) continue; const k = E.ovKey(s); if (k && !byRid.has(k)) byRid.set(k, s); }
  /* the book with this row as it would stand: the mirror's row (found by identity, so an order key works as a rid does) swapped for it */
  const owedOf = (owner, base, swapRow, extra) => {
    const root = base && origin.get(base);
    return r2(E.partyOwedRM(sales.map((s) => (root && s === root ? swapRow : s)).concat(extra ? [extra] : []), owner));
  };
  const origin = new Map();   /* each replayed state back to the mirror's row it started from */
  const at = (d) => String(d.id || "");
  const isSale = (d) => d && d.collection === "sales";
  /* the row each pending move starts from: the mirror's, then the approved moves on it not yet folded, in entry order */
  const state = new Map(), before = new Map();
  for (const d of (waiting || []).filter((d) => isSale(d) && d.amends).sort((a, b) => at(a).localeCompare(at(b)))) {
    const base = state.get(d.amends) || byRid.get(d.amends);
    if (!base) continue;
    const moved = moveRow(base, d);
    origin.set(moved, origin.get(base) || base);
    state.set(d.amends, moved);
    before.set(d.amends, (before.get(d.amends) || 0) + 1);
  }
  for (const d of (pending || []).filter(isSale).sort((a, b) => at(a).localeCompare(at(b)))) {
    try {
      if (d.amends) {
        const now = state.get(d.amends) || byRid.get(d.amends);
        if (!now) continue;
        const after = moveRow(now, d);
        if (!origin.has(now)) origin.set(now, now);
        origin.set(after, origin.get(now));
        const owner = E.ownerCode(now.customer || d.party || "");
        /* plan 3 (16 Oct 2026): the order of several books the row rides, so the moves on its rows are one card */
        d.figures = { ...(now.rid ? { rid: now.rid } : {}), ...(now.trip ? { trip: now.trip } : {}), now: rowFigures(now), after: rowFigures(after), party: owner,
          owedNow: owedOf(owner, now, now), owedAfter: owedOf(owner, now, after), ceiling,
          ...(before.get(d.amends) ? { approvedBefore: before.get(d.amends) } : {}) };
        state.set(d.amends, after);
      } else if (d.row && typeof d.row === "object") {
        const row = Object.assign({ customer: d.party }, d.row);
        const owner = E.ownerCode(row.customer || "");
        d.figures = { now: null, after: rowFigures(row), party: owner,
          owedNow: owedOf(owner), owedAfter: owedOf(owner, null, null, row), ceiling };
      }
    } catch (e) { delete d.figures; }
  }
  return pending;
}
