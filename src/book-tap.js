/* src/book-tap.js: S4d OF THE BOOK PLAN, A TAP BOOKS THE ROW AT ONCE (27 Oct 2026; his answers of the same day, Fable's review applied).
   The Worker's side of the Book's `tap` and `void` verbs (src/book.js). Pure plumbing: it asks the Book, it never decides a rule, and the flag
   in D1 (migrations/0019, `book_tap`, shipped 'off') says whether it asks at all. Imports nothing of the drafter or the Worker, so both reach it.

   THE ORDER OF A TAP IS BOOK FIRST, D1 SECOND. The Book books the entries (the engine's own plan and apply, all of a trip or none); the answer's rids and
   booking order are written into each draft's row (`rids`, `booked_seq`) in the SAME D1 batch as the approval, and the fold copies them (tools/fold.mjs).
   The D1 flip is the arbiter: an entry whose draft did not become approved is taken back (`voidUnlessApproved`), and the readers count a booked draft once
   whatever its D1 status (src/way.js). What the Book will not book is approved as it always was: a Book behind the mirror, not answering, or holding a stuck
   entry (`fallback`), and what the fold alone books (`foldOnly`). A refusal by the law is the one thing that stops a tap, with the reason. */
import { BOOK_NAME } from "./book.js";
import { nsOf } from "./book-read.js";

const KL_MS = 8 * 3600000;
/** the Kuala Lumpur day an entry is booked on, YYYY-MM-DD */
export const klDay = (now = Date.now()) => new Date(now + KL_MS).toISOString().slice(0, 10);
export const TAP_COLS = "id,collection,entry,row,reasoning,flags,amends,amend_kind";
const parse = (s, d) => { try { return s == null ? d : JSON.parse(s); } catch (e) { return d; } };

/** 'on' or 'off': the one-row flag, 'off' when the table is missing or unreadable (a store before migrations/0019) */
export async function tapMode(db) {
  try { const r = await db.prepare("SELECT mode FROM book_tap WHERE one=1").first(); return r && r.mode === "on" ? "on" : "off"; } catch (e) { return "off"; }
}

/** a draft's D1 row as the item the fold stages (tools/drafts.mjs approvedRows), made approved at `at` by `by` */
export function stagedItem(r, at, by) {
  return { id: r.id, status: "approved", collection: r.collection, row: parse(r.row, null), reasoning: r.reasoning == null ? null : r.reasoning,
    flags: parse(r.flags, []), amends: r.amends || null, amendKind: r.amend_kind || null, entry: parse(r.entry, null), decidedAt: at, decidedBy: by };
}

async function ask(db, path, method, body) {
  const ns = nsOf(db);
  if (!ns) return null;
  try {
    const r = await ns.get(ns.idFromName(BOOK_NAME)).fetch(new Request("https://book/" + path, method === "GET" ? { method } : { method, body: JSON.stringify(body) }));
    return { status: r.status, body: await r.json() };
  } catch (e) { return null; }
}

/** Book the rows of one tap (the tapped row and its trip's pending rows), `rows` as D1 holds them (TAP_COLS). The answer's `kind`:
      off       the flag is off: approve as before, nothing asked
      booked    every row booked (or already booked): `booked` is [{id, rids, seq, again?, folded?}], to be written beside the approval
      foldOnly  something here is the fold's alone (a roster, a rename, a party not on the book): approve as before, the fold mints
      fallback  the Book cannot book now (behind, silent, an entry stuck, an old object): approve as before, the minute net books it
      refused   the law refuses: `refused` is [{id, why}], nothing was booked, and the approval must not be written */
export async function bookTap(db, rows, by, at) {
  if (await tapMode(db) !== "on") return { kind: "off" };
  if (!nsOf(db)) return { kind: "fallback", why: "the Book is not bound" };
  let v = null;
  try { const h = await db.prepare("SELECT v FROM snapshot WHERE one=1").first(); v = h && h.v != null ? h.v : null; } catch (e) { v = null; }
  const a = await ask(db, "tap", "POST", { items: rows.map((r) => stagedItem(r, at, by)), day: klDay(), v });
  if (!a || !a.body) return { kind: "fallback", why: "the Book did not answer" };
  const b = a.body;
  if (b.ok && Array.isArray(b.booked)) return { kind: "booked", booked: b.booked };
  if (b.ok && Array.isArray(b.foldOnly)) return { kind: "foldOnly", why: b.foldOnly.map((x) => x.why).join("; ") };
  if (!b.ok && Array.isArray(b.refused)) return { kind: "refused", refused: b.refused };
  return { kind: "fallback", why: String(b.error || "the Book would not book it") };
}

/** the statements that write the Book's rids and booking order into the drafts' rows, to ride in the approval's batch. With `fresh` only a row with no
    booking yet is written (the net's: a fold that staged the row first must not have it changed under it). */
export function ridStmts(db, booked, fresh) {
  const guard = fresh ? " AND json_extract(row,'$.booked_seq') IS NULL" : "";
  return booked.map((b) => db.prepare("UPDATE draft SET row=json_set(CASE WHEN json_valid(row) THEN row ELSE '{}' END,'$.rids',json(?1),'$.booked_seq',?2) WHERE id=?3 AND status='approved' AND committed_at IS NULL" + guard)
    .bind(JSON.stringify(b.rids), b.seq, b.id));
}

/** take back the open entries of these drafts. True when the Book answered (an object before S4a answers 404: nothing to take back); false when it did not. */
export async function voidEntries(db, ids) {
  if (!ids.length) return true;
  const a = await ask(db, "void", "POST", { ids });
  return !!a && (a.status === 404 || (a.status === 200 && !!a.body && a.body.ok === true));
}

/** after a tap whose approval did not all land: the entries of drafts that did not become approved are taken back (one decided the other way meanwhile) */
export async function voidUnlessApproved(db, ids) {
  if (!ids.length) return true;
  let live = [];
  try { live = ((await db.prepare("SELECT id FROM draft WHERE status='approved' AND id IN (" + ids.map((_, k) => "?" + (k + 1)).join(",") + ")").bind(...ids).all()).results || []).map((r) => r.id); }
  catch (e) { return false; }
  return voidEntries(db, ids.filter((id) => !live.includes(id)));
}

const NET_GROUPS = 10;
/** THE MINUTE NET (flag on). Two things a tap can leave: an entry whose draft was rejected by a road that does not take it back (a claim not found, a withdrawn
    order) is voided, and an approved draft with no booking (it fell back at the tap, or was approved from the laptop) is booked the way a tap would. A trip is booked
    whole. Idempotent; a row the fold has already staged is never given a booking under it (`fresh`). Counts only, and the reasons of what the law refused. */
export async function bookNet(db, by = "the net") {
  const out = { voided: 0, booked: 0, left: 0, why: [] };
  if (await tapMode(db) !== "on" || !nsOf(db)) return out;
  const ev = await ask(db, "events", "GET");
  if (ev && ev.status === 200 && ev.body && ev.body.ok && Array.isArray(ev.body.ids) && ev.body.ids.length) {
    const gone = [];
    for (let i = 0; i < ev.body.ids.length; i += 50) {
      const part = ev.body.ids.slice(i, i + 50);
      const rs = await db.prepare("SELECT id FROM draft WHERE status='rejected' AND id IN (" + part.map((_, k) => "?" + (k + 1)).join(",") + ")").bind(...part).all();
      for (const r of rs.results || []) gone.push(r.id);
    }
    if (gone.length && await voidEntries(db, gone)) out.voided = gone.length;
  }
  const NONE = "json_extract(CASE WHEN json_valid(row) THEN row ELSE '{}' END,'$.booked_seq') IS NULL";
  const open = "status='approved' AND committed_at IS NULL AND collection NOT IN ('roster','rename') AND " + NONE;
  const cand = ((await db.prepare("SELECT " + TAP_COLS + ",decided_at,decided_by FROM draft WHERE " + open + " ORDER BY drafted_at, id LIMIT 40").all()).results || []);
  const done = new Set();
  let groups = 0;
  for (const first of cand) {
    if (done.has(first.id) || groups >= NET_GROUPS) continue;
    groups++;
    const trip = (parse(first.row, {}) || {}).trip || null;
    const rows = trip
      ? ((await db.prepare("SELECT " + TAP_COLS + ",decided_at,decided_by FROM draft WHERE " + open + " AND collection='sales' AND json_extract(row,'$.trip')=?1 ORDER BY drafted_at, id").bind(trip).all()).results || [])
      : [first];
    for (const r of rows) done.add(r.id);
    const tap = await bookTap(db, rows, first.decided_by || by, first.decided_at);
    if (tap.kind === "booked") {
      const res = await db.batch(ridStmts(db, tap.booked.filter((b) => !b.folded), true));
      out.booked += res.filter((r) => r && r.meta && r.meta.changes > 0).length;
    } else { out.left += rows.length; out.why.push(tap.kind + (tap.why ? ": " + tap.why : tap.refused ? ": " + tap.refused.map((x) => x.why).join("; ") : "")); }
  }
  return out;
}
