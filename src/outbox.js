/* src/outbox.js: S6 OF THE BOOK PLAN, A BOOKED ROW TELLS ITS ORDER AT ONCE (28 Oct 2026; Fable's review of the same day applied). SHIPPED OFF behind the D1 flag `book_outbox` (migrations/0020).
   The Book writes a row of its outbox in the tap's own transaction for every sale or amendment it books (src/book.js). This is the Desk's side: with the flag on, after a tap and in the minute cron,
   it reads the pending rows, drops the ones whose drafts were rejected, and for the rest runs ONE forced pass of the return leg (src/orders.js tellSite, `force`): every order is told what the
   ledger says, by the leg's own state messages (raise-only, idempotent), so a row drained twice, or a pass that ran for another row, tells nothing twice. A clean pass marks the rows it covered
   sent; a pass with a refusal marks none, counts the try, and the next minute tries again. A row whose draft is still pending in D1 (the tap booked, the approval's batch has not landed) is left
   alone, never sent and never dropped. What it does NOT do: retire the regular return leg, which still runs when a fold changes the version and is the net for everything no tap booked (a
   hand fold, rwd, a phone's undo). No retry is silent: a pass that keeps failing is the tie-out's return-leg fault, as before. Nothing here imports the Worker. */
import { BOOK_NAME } from "./book.js";
import { nsOf } from "./book-read.js";
import { tellSite } from "./orders.js";
import { bookOnce } from "./drafter.js";

/** 'on' or 'off': the one-row flag, 'off' when the table is missing or unreadable (a store before migrations/0020) */
export async function outboxMode(db) {
  try { const r = await db.prepare("SELECT mode FROM book_outbox WHERE one=1").first(); return r && r.mode === "on" ? "on" : "off"; } catch (e) { return "off"; }
}

async function ask(db, path, method, body) {
  const ns = nsOf(db);
  if (!ns) return null;
  try {
    const r = await ns.get(ns.idFromName(BOOK_NAME)).fetch(new Request("https://book/" + path, method === "GET" ? { method } : { method, body: JSON.stringify(body) }));
    return { status: r.status, body: await r.json() };
  } catch (e) { return null; }
}

/** One drain. `tell` and `mirror` are the suite's to replace. Answers counts only. */
const MARK_MAX = 500, STUCK_MS = 10 * 60000;
/* the marks in lists of at most 500 (the Book's verbs refuse more), every answer checked: a mark that did not land is said, never assumed */
async function mark(db, path, seqs, extra) {
  let ok = true;
  for (let i = 0; i < seqs.length; i += MARK_MAX) { const r = await ask(db, path, "POST", { seqs: seqs.slice(i, i + MARK_MAX), ...(extra || {}) }); if (!r || r.status !== 200 || !r.body || !r.body.ok) ok = false; }
  return ok;
}

export async function drainOutbox(env, { tell = tellSite, mirror = null, now = Date.now() } = {}) {
  const db = env.SALT_LEDGER;
  if (!db || await outboxMode(db) !== "on") return { skipped: true };
  const a = await ask(db, "outbox", "GET");
  if (!a || a.status !== 200 || !a.body || !a.body.ok) return { ok: false, why: "the Book did not answer" };
  const pending = a.body.pending || [];
  if (!pending.length) return { ok: true, pending: 0 };
  /* what each draft is in D1: approved is live, rejected or missing is dead (nothing booked will tell an order), pending is not yet decided */
  const ids = [...new Set(pending.map((r) => r.draft_id))], status = new Map();
  for (let i = 0; i < ids.length; i += 50) {
    const part = ids.slice(i, i + 50);
    const rs = await db.prepare("SELECT id, status, committed_at FROM draft WHERE id IN (" + part.map((_, k) => "?" + (k + 1)).join(",") + ")").bind(...part).all();
    for (const r of rs.results || []) status.set(r.id, r.committed_at ? "committed" : r.status);
  }
  /* approved and not yet folded is live; folded (the regular pass told the orders at that fold), rejected or missing is dead; pending is not decided yet */
  const live = pending.filter((r) => status.get(r.draft_id) === "approved");
  const dead = pending.filter((r) => status.get(r.draft_id) !== "approved" && status.get(r.draft_id) !== "pending");
  const stuck = pending.filter((r) => status.get(r.draft_id) === "pending" && now - Date.parse(r.at) > STUCK_MS).length;   /* booked, never approved: a batch that failed; the readcheck names the entry */
  const out = Object.assign({ ok: true, pending: pending.length, dropped: dead.length }, stuck ? { stuck } : {});
  if (dead.length && !await mark(db, "outbox/done", dead.map((r) => r.seq))) out.markFailed = true;
  if (!live.length) return out;
  let res;
  try { res = await tell(env, undefined, mirror || bookOnce(db), { force: true }); }
  catch (e) { res = { ok: false, error: String((e && e.message) || e) }; }
  const clean = !!res && res.ok !== false && !(res.failed && res.failed.length);
  if (clean) { if (!await mark(db, "outbox/done", live.map((r) => r.seq))) return Object.assign(out, { ok: false, markFailed: true }); return Object.assign(out, { sent: live.length, told: res.told || 0 }); }
  await mark(db, "outbox/fail", live.map((r) => r.seq), { err: (res && (res.error || (res.failed && JSON.stringify(res.failed).slice(0, 160)))) || "the pass did not finish" });
  return Object.assign(out, { ok: false, failed: live.length });
}
