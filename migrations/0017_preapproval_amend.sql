-- 0017_preapproval_amend.sql: let his yes be an amendment's (06 Oct 2026).
--
-- WHY. Everything on an agreed order is amendable after Accept (his decision of 06 Oct 2026): restateOrder in src/orders.js
-- records his yes through stageTap as stage 'amend', and the stage CHECK of 0011 does not name it, so every amend tap
-- answered 500 "CHECK constraint failed". The live D1 carried the same CHECK, read back on 06 Oct 2026.
--
-- SQLite cannot alter a CHECK constraint, so the table is rebuilt as 0010 rebuilt `draft`: copied first, the old table
-- dropped only after, and both indexes of 0011 made again (a rebuild drops them). A plain INSERT, never OR IGNORE: the old
-- CHECK is a subset of the new, so every row fits, and a row that did not would stop the file rather than be dropped.
-- Apply THIS FILE ALONE to the live D1, BEFORE the deploy that relies on it, and read the schema back after.

PRAGMA foreign_keys=off;

CREATE TABLE IF NOT EXISTS preapproval_new (
  id          TEXT PRIMARY KEY,   -- <order id>|<stage>|<the tap's moment>
  order_id    TEXT NOT NULL,      -- the site order
  u           TEXT,               -- the site username it lives under: an address, never a name
  stage       TEXT NOT NULL CHECK (stage IN ('ack','pay','cash','move','cancel','amend')),
  hash        TEXT NOT NULL,      -- the digest of what he was shown
  shown       TEXT NOT NULL,      -- what he was shown, JSON, for Approve to set beside a row that differs
  entry       TEXT,               -- the entry the desk queues itself (Accept, Cash received, a move offered again, an amendment);
                                  -- NULL when the site's own stage makes it (Collected, Received)
  entry_at    TEXT,               -- that entry's id, once queued
  status      TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','applied','differs','void')),
  draft_id    TEXT,               -- the draft it was spent on
  tapped_by   TEXT,
  at          TEXT NOT NULL,
  decided_at  TEXT,
  acked_at    TEXT                -- (Accept) when its order was marked and moved; until then the desk's pass tries again
);

INSERT INTO preapproval_new
  (id,order_id,u,stage,hash,shown,entry,entry_at,status,draft_id,tapped_by,at,decided_at,acked_at)
SELECT id,order_id,u,stage,hash,shown,entry,entry_at,status,draft_id,tapped_by,at,decided_at,acked_at FROM preapproval;

DROP TABLE preapproval;
ALTER TABLE preapproval_new RENAME TO preapproval;

CREATE INDEX IF NOT EXISTS preapproval_order ON preapproval (order_id, status);
CREATE INDEX IF NOT EXISTS preapproval_entry ON preapproval (entry_at) WHERE entry_at IS NOT NULL;

PRAGMA foreign_keys=on;
