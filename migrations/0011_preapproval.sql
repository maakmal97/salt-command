-- 0011_preapproval.sql: his yes, given on the order card before the row it approves exists (S11, his decision D6
-- of 24 Sep 2026).
--
-- WHY. One tap a stage: Accept, Collected, Cash received and Received each approve the row they make, and only if
-- the real draft equals what he was shown. The row may not exist at the tap (between the tap and the drafter, or a
-- stage waiting for the first row to land), so the yes is kept here as the DIGEST of what he was shown
-- (src/drafter.js stageDigest) and spent by the drafter the moment the row is drafted: equal, approved; different,
-- left pending under Approve and marked.
--
-- A NEW TABLE, NOT A REBUILD OF `draft`: the draft CHECK is untouched. Apply THIS FILE ALONE to the live D1, BEFORE
-- the deploy that reads it. Without it the drafter spends no yes, but every tap on the order card that records one
-- (Accept, Collected, Cash received, Received, a move offered again) answers 500 "no such table: preapproval", and
-- Accept is the card's only road to acknowledge an order: so the deploy never goes out ahead of this file.

CREATE TABLE IF NOT EXISTS preapproval (
  id          TEXT PRIMARY KEY,   -- <order id>|<stage>|<the tap's moment>
  order_id    TEXT NOT NULL,      -- the site order
  u           TEXT,               -- the site username it lives under: an address, never a name
  stage       TEXT NOT NULL CHECK (stage IN ('ack','pay','cash','move','cancel')),
  hash        TEXT NOT NULL,      -- the digest of what he was shown
  shown       TEXT NOT NULL,      -- what he was shown, JSON, for Approve to set beside a row that differs
  entry       TEXT,               -- the entry the desk queues itself (Accept, Cash received, a move offered again);
                                  -- NULL when the site's own stage makes it (Collected, Received)
  entry_at    TEXT,               -- that entry's id, once queued
  status      TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','applied','differs','void')),
  draft_id    TEXT,               -- the draft it was spent on
  tapped_by   TEXT,
  at          TEXT NOT NULL,
  decided_at  TEXT,
  acked_at    TEXT                -- (Accept) when its order was marked and moved; until then the desk's pass tries again
);

CREATE INDEX IF NOT EXISTS preapproval_order ON preapproval (order_id, status);
CREATE INDEX IF NOT EXISTS preapproval_entry ON preapproval (entry_at) WHERE entry_at IS NOT NULL;
