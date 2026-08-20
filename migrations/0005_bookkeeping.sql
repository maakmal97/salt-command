-- 0005_bookkeeping.sql — let a draft be something other than a row in sales or purchases.
--
-- WHY. The gate was built for trades and the `collection` check said so: sales or purchases and
-- nothing else. That was right while a trade was the only thing the drafter would touch. His
-- instruction of 20 Aug 2026 is a completely phone-able app, with the laptop kept for fixing
-- bugs and auditing, and four entries the phone can already RECORD still could not reach the
-- ledger without one: a stock count, a loss, a lost sale and a party registration.
--
-- NONE OF THEM IS A ROW, and that is the whole reason this migration exists rather than a
-- reinterpretation of `row`:
--
--   count   sets the stated stock for a product. A STATE change, not an append.
--   loss    appends to selfUseLog: stock that left without a sale.
--   lost    appends to lostDemand: a sale that did not happen. Touches no stock and no cash.
--   roster  appends a code. Touches no figure at all.
--
-- The desk's own applyOverlay already applies the first three exactly this way, so the fold is
-- following the desk rather than inventing anything. `addid` is not in applyOverlay because it
-- changes no figure; the fold appends the code to `roster` and the DIRECTORY entry, which
-- carries the real name and the place, is typed at the laptop and never travels.
--
-- WHY A COUNT IS STILL APPROVED, when it is a statement of fact from the person who looked at
-- the shelf. Because the approval screen is where the drift is put in front of him with what it
-- means: on 20 Aug a count of zero against a roll of 8.05 was SIX UNIT CE4-CHE HAD ALREADY PAID
-- FOR, and reading that as ordinary shrinkage would have missed the only part that mattered.
-- The tap costs nothing. Seeing that costs a conversation if it is skipped.
--
-- SQLite cannot alter a CHECK constraint, so the table is rebuilt. The data is copied first and
-- the old table dropped only after, which is the ordinary safe order and worth stating because
-- this table holds decisions that cannot be reconstructed from anywhere else.

PRAGMA foreign_keys=off;

CREATE TABLE IF NOT EXISTS draft_new (
  id          TEXT PRIMARY KEY,
  status      TEXT NOT NULL CHECK (status IN ('pending','approved','rejected')),
  collection  TEXT NOT NULL
              CHECK (collection IN ('sales','purchases','count','loss','lostDemand','roster')),
  entry       TEXT NOT NULL,
  row         TEXT NOT NULL,
  reasoning   TEXT NOT NULL,
  flags       TEXT,
  party       TEXT,
  product     TEXT,
  date        TEXT,
  qty         REAL,
  total       REAL,
  cost        REAL,
  amends      TEXT,
  amend_kind  TEXT,
  drafter     TEXT NOT NULL,
  drafted_at  TEXT NOT NULL,
  decided_at  TEXT,
  decided_by  TEXT,
  committed_at TEXT
);

INSERT OR IGNORE INTO draft_new
  (id,status,collection,entry,row,reasoning,flags,party,product,date,qty,total,cost,
   amends,amend_kind,drafter,drafted_at,decided_at,decided_by,committed_at)
SELECT id,status,collection,entry,row,reasoning,flags,party,product,date,qty,total,cost,
   amends,amend_kind,drafter,drafted_at,decided_at,decided_by,committed_at
FROM draft;

DROP TABLE draft;
ALTER TABLE draft_new RENAME TO draft;

CREATE INDEX IF NOT EXISTS draft_status ON draft (status);
CREATE INDEX IF NOT EXISTS draft_amends ON draft (amends) WHERE amends IS NOT NULL;

PRAGMA foreign_keys=on;
