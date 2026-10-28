-- 0024_draft_edit.sql: let a draft be a hand edit of the ledger (S5f-5 of the Book plan, his answer to Ask A, 28 Oct 2026).
--
-- WHY. With the Book as the source a hand edit of git's ledger/book.json is no longer a ledger edit. The common ones (a refund marked paid, a stale refund removed) are an `edit` entry he approves in Salt Admin,
-- booked by the tap like any row; the rare ones are a load of the export from the laptop (tools/book-load.mjs --import). The drafter returns the new collection `edit`, which the CHECK of 0010 does not name, so
-- the insert would fail.
--
-- SQLite cannot alter a CHECK constraint, so the table is rebuilt as 0005 to 0010 did: copied first, the old table dropped only after. A REBUILD DROPS THE INDEXES, so all four the live table carries are made again
-- below (draft_status, draft_amends from 0005 onwards; draft_committed and draft_status_committed from 0012). Apply THIS FILE ALONE to a live database, BEFORE the deploy that drafts an `edit`: re-running an older
-- rebuild after it would copy the rows through its narrower CHECK, and INSERT OR IGNORE drops what a CHECK refuses. Read the row count and the four indexes back after.

PRAGMA foreign_keys=off;

CREATE TABLE IF NOT EXISTS draft_new (
  id          TEXT PRIMARY KEY,
  status      TEXT NOT NULL CHECK (status IN ('pending','approved','rejected')),
  collection  TEXT NOT NULL
              CHECK (collection IN ('sales','purchases','count','loss','lostDemand','roster','priceset','loan','repayment','rename','place','tierset','label','edit')),
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
CREATE INDEX IF NOT EXISTS draft_committed ON draft (committed_at);
CREATE INDEX IF NOT EXISTS draft_status_committed ON draft (status, committed_at);

PRAGMA foreign_keys=on;
