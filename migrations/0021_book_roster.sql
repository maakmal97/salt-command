-- 0021_book_roster.sql: WHETHER THE TAP BOOKS AN ADD ID OR A RENAME (S5 of the Book plan, the roster road, 28 Oct 2026).
--
-- One row, 'off' or 'on'. src/book-tap.js reads it. 'on': a tapped roster entry (an Add ID, an appointment, a partner) and a tapped rename are booked in the Book at once, by the
-- engine's own plan and apply (the rename by applyRename, the fold's own re-key), instead of waiting for the fold; the minute net books such drafts approved by another road too. The
-- statement username, the place override and the suite's fixtures are NOT the Book's: the flip's export step writes them in git (tools/roster-export.mjs). 'off': the fold alone books them, as before.
-- It SHIPS 'off' and is turned on at the flip, with his typed go. The way back is one statement, no deploy:
--   npx wrangler d1 execute salt_ledger --remote --command "UPDATE book_roster SET mode='off' WHERE one=1"
-- and forward the same with 'on'. A store before this file reads 'off'.
--
-- A new table only. Apply THIS FILE ALONE to the live D1, BEFORE the deploy that reads it, and read the row back after.

CREATE TABLE IF NOT EXISTS book_roster (
  one  INTEGER PRIMARY KEY CHECK (one = 1),
  mode TEXT NOT NULL CHECK (mode IN ('off','on'))
);
INSERT OR IGNORE INTO book_roster (one, mode) VALUES (1, 'off');
