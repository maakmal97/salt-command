-- 0006_clock.sql — the clock on every approval (v519, his instruction of 08 Sep 2026).
--
-- live_at is the moment the deploy job proved the phone was serving the build that carries the
-- row. decided_at is the tap; committed_at follows live_at by a few seconds. The three together
-- are the literal end-to-end check: tap to phone, tap to committed, on every approval, written
-- into the run summary and read back on the Approve view.
--
-- ADD COLUMN is not idempotent in SQLite; tools/drafts.mjs --schema treats "duplicate column"
-- as applied, so re-running the schema stays safe.

ALTER TABLE draft ADD COLUMN live_at TEXT;
