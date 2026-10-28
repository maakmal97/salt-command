-- 0022_book_page.sql: WHETHER THE DESK PAGE READS THE BOOK AT REQUEST TIME (S5d of the Book plan, 28 Oct 2026).
--
-- One row, 'off' or 'on'. src/book-page.js reads it. 'on': GET /rev also answers the Book's revision, and GET /book/page answers the Book's view (the base with every open entry replayed) as a book file with the
-- ids of the drafts it holds; an open Desk that sees the revision move fetches it as its own request and swaps it in over the book baked into the page, dropping a queued entry the Book already holds. 'off': /rev
-- answers the build manifest alone and /book/page answers 404, so the page reads only what was baked into it, as before. The page also keeps the baked book as its fallback for any answer that is not a whole book.
-- It SHIPS 'off'. TURNING IT ON IS HIS CALL, after two days of probing (the plan's word). The way back is one statement, no deploy:
--   npx wrangler d1 execute salt_ledger --remote --command "UPDATE book_page SET mode='off' WHERE one=1"
-- and forward the same with 'on'. A store before this file reads 'off'.
--
-- A new table only. Apply THIS FILE ALONE to the live D1, BEFORE the deploy that reads it, and read the row back after.

CREATE TABLE IF NOT EXISTS book_page (
  one  INTEGER PRIMARY KEY CHECK (one = 1),
  mode TEXT NOT NULL CHECK (mode IN ('off','on'))
);
INSERT OR IGNORE INTO book_page (one, mode) VALUES (1, 'off');
