-- 0007_loan.sql — let a draft be a loan, and let a price set through (v527, 08 Sep 2026).
--
-- WHY. Part B step 9 of his instruction of 08 Sep 2026: a borrowing or a lending of salt is
-- entered on the phone, drafted, approved and folded like everything else, instead of on his
-- word in a Code session as the two loans in of v518 were. A loan is a row in `loans`, not in
-- sales or purchases, so `collection` widens to carry it. `priceset` is added at the same time:
-- the drafter has returned it since the price board could be set from the phone, and the CHECK
-- of 0005 never named it, so a price draft would have failed the insert.
--
-- SQLite cannot alter a CHECK constraint, so the table is rebuilt as 0005 did: copied first,
-- the old table dropped only after. live_at (0006) travels with it.

PRAGMA foreign_keys=off;

CREATE TABLE IF NOT EXISTS draft_new (
  id          TEXT PRIMARY KEY,
  status      TEXT NOT NULL CHECK (status IN ('pending','approved','rejected')),
  collection  TEXT NOT NULL
              CHECK (collection IN ('sales','purchases','count','loss','lostDemand','roster','priceset','loan')),
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
  committed_at TEXT,
  live_at     TEXT
);

INSERT OR IGNORE INTO draft_new
  (id,status,collection,entry,row,reasoning,flags,party,product,date,qty,total,cost,
   amends,amend_kind,drafter,drafted_at,decided_at,decided_by,committed_at,live_at)
SELECT id,status,collection,entry,row,reasoning,flags,party,product,date,qty,total,cost,
   amends,amend_kind,drafter,drafted_at,decided_at,decided_by,committed_at,live_at
FROM draft;

DROP TABLE draft;
ALTER TABLE draft_new RENAME TO draft;

CREATE INDEX IF NOT EXISTS draft_status ON draft (status);
CREATE INDEX IF NOT EXISTS draft_amends ON draft (amends) WHERE amends IS NOT NULL;

PRAGMA foreign_keys=on;
