-- 0019_book_tap.sql: WHETHER A TAP BOOKS THE ROW AT ONCE (S4d of the Book plan, 27 Oct 2026).
--
-- One row, 'off' or 'on'. decideDraft, decide-many and the spending of a pre-approval (src/book-tap.js) read it: 'on' books the tapped row in the Book
-- (src/book.js `tap`) before the approval is written, and writes the rids the Book minted into the draft's row beside the approval; 'off' approves as before.
-- It SHIPS AS 'off'. TURNING IT ON IS HIS CALL. The way back is one statement, no deploy:
--   npx wrangler d1 execute salt_ledger --remote --command "UPDATE book_tap SET mode='off' WHERE one=1"
-- and forward the same with 'on'. Entries already booked stay open and the fold takes them with their rids; nothing else changes. A flag in D1 and not
-- in KV or the Book itself, as book_read is: it must be readable when the Book is what is broken.
--
-- A new table only (the draft table is untouched). Apply THIS FILE ALONE to the live D1, BEFORE the deploy that reads it, and read the row back after.
-- A store before this file reads as 'off' (the reader catches the missing table).

CREATE TABLE IF NOT EXISTS book_tap (
  one  INTEGER PRIMARY KEY CHECK (one = 1),
  mode TEXT NOT NULL CHECK (mode IN ('off','on'))
);
INSERT OR IGNORE INTO book_tap (one, mode) VALUES (1, 'off');
