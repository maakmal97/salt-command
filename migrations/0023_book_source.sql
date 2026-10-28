-- 0023_book_source.sql: WHICH STORE IS THE SOURCE OF THE LEDGER (S5f of the Book plan, the flip, 28 Oct 2026).
--
-- One row, 'd1' or 'book'. src/book-tap.js (`sourceMode`) and the laptop tools (tools/source-flag.mjs) read it. 'd1' (the default, and what a store with no table reads): git's ledger/book.json is the
-- source and the fold writes it, as before; nothing below changes. 'book': the Book (the Desk Worker's Durable Object) is the source: an approval is booked by the tap and is not a version, the fold is
-- not dispatched for what the tap booked, a load into the Book is refused unless it carries an import, `drafts.mjs --approve` and `update.mjs` refuse, and the chain stops re-seeding the D1 mirror
-- (docs/DESK.md, "The flip"). It SHIPS 'd1' and is turned to 'book' only by tools/flip.mjs, on his typed go, on or after 4 Nov 2026 and only when tools/flip-gate.mjs reads every line true.
-- The way back is tools/flip.mjs --back, which runs the export, sets 'd1' and seeds the mirror; the bare statement is
--   npx wrangler d1 execute salt_ledger --remote --command "UPDATE book_source SET mode='d1' WHERE one=1"
-- and is not enough by itself (docs/DESK.md).
--
-- A new table only. Apply THIS FILE ALONE to the live D1, BEFORE the deploy that reads it, and read the row back after.

CREATE TABLE IF NOT EXISTS book_source (
  one  INTEGER PRIMARY KEY CHECK (one = 1),
  mode TEXT NOT NULL CHECK (mode IN ('d1','book'))
);
INSERT OR IGNORE INTO book_source (one, mode) VALUES (1, 'd1');
