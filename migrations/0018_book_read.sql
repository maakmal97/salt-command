-- 0018_book_read.sql: WHICH STORE THE READERS READ (S3 of the Book plan, 25 Oct 2026).
--
-- One row, 'd1' or 'book'. readBook (src/drafter.js) reads it with the book: 'book' reads the Book Durable Object (src/book.js) unless
-- the Book trails the mirror, 'd1' reads the mirror as before. It SHIPS AS 'd1'. The way back is one statement, no deploy:
--   npx wrangler d1 execute salt_ledger --remote --command "UPDATE book_read SET mode='d1' WHERE one=1"
-- and forward the same with 'book'. A flag in D1 and not in KV or the Book itself: it must be readable when the Book is what is broken,
-- and it is consistent with the snapshot the reader reads beside it.
--
-- A new table only (the draft table is untouched). Apply THIS FILE ALONE to the live D1, BEFORE the deploy that reads it, and read the
-- row back after. A store before this file reads as 'd1' (the reader catches the missing table).

CREATE TABLE IF NOT EXISTS book_read (
  one  INTEGER PRIMARY KEY CHECK (one = 1),
  mode TEXT NOT NULL CHECK (mode IN ('d1','book'))
);
INSERT OR IGNORE INTO book_read (one, mode) VALUES (1, 'd1');
