-- 0020_book_outbox.sql: WHETHER A BOOKED ROW TELLS ITS ORDER AT ONCE (S6 of the Book plan, 28 Oct 2026).
--
-- One row, 'off' or 'on'. src/outbox.js reads it. 'on': a tap that booked a sale (or an amendment of one) leaves a row in the Book's own outbox, and the Desk drains it straight after the tap
-- and in the minute cron: one forced pass of the return leg (src/orders.js tellSite), which tells every order what the ledger now says, so a booked payment reaches the customer's order in
-- seconds and not at the next fold. 'off': the Book still writes the rows (they cost nothing and nothing reads them), and the return leg runs as before, once a fold changes the version.
-- It SHIPS 'off'. TURNING IT ON IS HIS CALL. The way back is one statement, no deploy:
--   npx wrangler d1 execute salt_ledger --remote --command "UPDATE book_outbox SET mode='off' WHERE one=1"
-- and forward the same with 'on'. A flag in D1 as book_read and book_tap are: readable when the Book is what is broken. A store before this file reads 'off'.
--
-- A new table only. Apply THIS FILE ALONE to the live D1, BEFORE the deploy that reads it, and read the row back after.

CREATE TABLE IF NOT EXISTS book_outbox (
  one  INTEGER PRIMARY KEY CHECK (one = 1),
  mode TEXT NOT NULL CHECK (mode IN ('off','on'))
);
INSERT OR IGNORE INTO book_outbox (one, mode) VALUES (1, 'off');
