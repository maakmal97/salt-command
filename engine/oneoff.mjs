/* engine/oneoff.mjs: A PRICE HE TYPES OUTSIDE THE BAND IS ASKED ONCE, THEN STANDS AS A MARKED ONE-OFF (his decision "Ask D", 10 Nov 2026,
 * docs/plan-salt-price-band.html). On a book whose pricing rule carries a band, a goods total he types at Accept, in an offer or in an amendment
 * of an agreed order that is under the Floor or over the Ceiling at its size is refused once, saying by how much and what it means in ringgit;
 * sent again with his reason it goes through as any Accept or amendment does, and the sale's ROW carries `oneOff: {why, side, by}`, the mark the
 * evidence readers leave out (their usual, the suggested %). A book with no band never reaches this file's refusal: its roads refuse as they did.
 *
 * The reason is HIS text about HIS order. It lives on the entry, the draft, the ledger row and his own roads; nothing here is sent to the site,
 * and no customer's view of an order or statement names it.
 *
 * PURE, and it imports nothing, so the taps (engine/stages.mjs), the drafter (src/drafter.js) and the booking law (engine/apply.mjs, which must
 * not reach the drafter) read one copy. It is NOT in tools/engine.mjs's list, so the master's ENGINE block does not carry it, and nothing under
 * stmt/ imports it. It prices nothing: the Floor and the Ceiling are handed in (the drafter's floorFor and bandFor). */
const rm = (n) => "RM " + (Math.abs(n - Math.round(n)) < 0.005 ? String(Math.round(n)) : (+n).toFixed(2));

/* a reason is one line of his, 3 to 120 characters once trimmed; no < or > (a note on this book can be drawn as markup) and no control character */
export const ONE_OFF_BAD = "the reason is one line of 3 to 120 characters, with no < or >";
const lineOk = (t) => typeof t === "string" && t === t.trim() && t.length >= 3 && t.length <= 120 && !/[<>\u0000-\u001f\u007f\u2028\u2029]/.test(t);
/** The reason a request carries: { why: null } with none, { why } trimmed, or { error } for anything that is not one. */
export function reasonOf(b) {
  if (!b || b.oneOff === undefined || b.oneOff === null) return { why: null };
  const t = typeof b.oneOff === "string" ? b.oneOff.trim() : null;
  return lineOk(t) ? { why: t } : { error: ONE_OFF_BAD };
}

/** Where a goods total sits against the band at its size: null inside it, on a book with no band (`band` null), or with no Floor known AT the
 *  size (`fl` is floorFor's answer); else { side, by, floor, ceiling }, ringgit to 2 dp. */
export function outsideBand(total, fl, band) {
  if (!band || !fl || !fl.exact || typeof total !== "number" || !Number.isFinite(total)) return null;
  const floor = +(+fl.floor).toFixed(2), ceiling = Number.isFinite(+band.ceiling) && +band.ceiling > 0 ? +(+band.ceiling).toFixed(2) : null;
  if (total < floor - 0.005) return { side: "under", by: +(floor - total).toFixed(2), floor, ceiling };
  if (ceiling != null && total > ceiling + 0.005) return { side: "over", by: +(total - ceiling).toFixed(2), floor, ceiling };
  return null;
}
/** The refusal that asks: by how much, and what it means in ringgit. `underFloor` stays on the under side, for the readers that knew it. */
export function bandRefusal(out, fl, qty) {
  const error = out.side === "under"
    ? rm(out.by) + " under the Floor of " + rm(out.floor) + " at " + qty + " unit: a loss of " + rm(out.by) + " on this order. Give a reason and it stands as a one-off."
    : rm(out.by) + " over the Ceiling of " + rm(out.ceiling) + " at " + qty + " unit. Give a reason and it stands as a one-off.";
  return Object.assign({ ok: false, status: 409 }, out.side === "under" ? { underFloor: true, floor: { rm: fl.floor, at: fl.at, exact: fl.exact } } : {},
    { outside: { side: out.side, by: out.by, floor: out.floor, ceiling: out.ceiling }, error });
}

/** The mark a row carries, and whether a value is one: exactly why, side and by. */
export const markOf = (out, why) => ({ why, side: out.side, by: out.by });
export const markOk = (m) => !!m && typeof m === "object" && !Array.isArray(m) && Object.keys(m).sort().join() === "by,side,why"
  && lineOk(m.why) && (m.side === "under" || m.side === "over") && typeof m.by === "number" && Number.isFinite(m.by) && m.by > 0 && m.by <= 1000000;
/** The line the Approve card and his yes's digest carry beside the row. */
export const oneOffFlag = (m) => "One-off: " + rm(m.by) + (m.side === "under" ? " under the Floor" : " over the Ceiling") + ", his reason: " + m.why.replace(/[.]+$/, "") + ".";
export const ONE_OFF_CLEARED = "Back inside the price band, so the one-off mark comes off this row.";
