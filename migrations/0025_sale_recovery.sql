-- 0025_sale_recovery.sql: WHETHER SALT ADMIN'S SALE WITH NO ORDER IS TAKEN (item 2 of docs/plan-ledger-simplify.html, 21 Nov 2026).
--
-- One row, 'off' or 'on'. The Desk's maker input `sale` (src/worker.js, saleRecoveryOn) reads it: 'off' refuses every new sale there with 409
-- ("Order for them"), since a new sale is a site order; 'on' takes one sent with `recovery: true`, for a Counter outage, and the drafter marks its
-- card with the noOrder flag. It SHIPS AS 'off'. TURNING IT ON IS HIS CALL. Forward and back are one statement each, no deploy:
--   npx wrangler d1 execute salt_ledger --remote --command "UPDATE sale_recovery SET mode='on' WHERE one=1"
--   npx wrangler d1 execute salt_ledger --remote --command "UPDATE sale_recovery SET mode='off' WHERE one=1"
-- A flag in D1, as book_tap is, so it reads when the Counter is what is broken.
--
-- A new table only (the draft table is untouched). Apply THIS FILE ALONE to the live D1, BEFORE the deploy that reads it, and read the row back after.
-- A store before this file reads as 'off' (the reader catches the missing table), so the refusal holds either way.

CREATE TABLE IF NOT EXISTS sale_recovery (
  one  INTEGER PRIMARY KEY CHECK (one = 1),
  mode TEXT NOT NULL CHECK (mode IN ('off','on'))
);
INSERT OR IGNORE INTO sale_recovery (one, mode) VALUES (1, 'off');
