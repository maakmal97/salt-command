-- 0009_place.sql: let a draft be a place on the map (v633, 14 Sep 2026).
--
-- WHY. A party's place reaches the map on its own (his decision of 14 Sep 2026): the phone queues
-- the point a place was found or tapped at as the collection `place`, which the CHECK of 0008 does
-- not name, so the insert would fail.
--
-- SQLite cannot alter a CHECK constraint, so the table is rebuilt as 0005, 0007 and 0008 did: copied
-- first, the old table dropped only after. Apply THIS FILE ALONE to a live database: re-running an
-- older one after it would copy the rows through its narrower CHECK, and INSERT OR IGNORE drops what
-- a CHECK refuses.

PRAGMA foreign_keys=off;

CREATE TABLE IF NOT EXISTS draft_new (
  id          TEXT PRIMARY KEY,
  status      TEXT NOT NULL CHECK (status IN ('pending','approved','rejected')),
  collection  TEXT NOT NULL
              CHECK (collection IN ('sales','purchases','count','loss','lostDemand','roster','priceset','loan','repayment','rename','place')),
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
