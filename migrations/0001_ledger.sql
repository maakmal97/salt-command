-- 0001_ledger.sql — the shape of the book in D1.
--
-- DERIVED FROM THE ROWS, NOT GUESSED. tools/ledger.mjs censused the master before this was
-- written: `sales` is 80 rows carrying 26 DISTINCT FIELDS, of which only five (cash,
-- customer, deliveredQty, qty, total) appear on every row, plus a nested `amend` array on 19
-- of them. Three fields appear exactly once. A 26 column table with 21 nullable columns
-- would therefore be wrong twice over: mostly empty, and needing an ALTER every time the
-- book records something it has not recorded before, which it demonstrably keeps doing.
--
-- So each record is stored as its own JSON document, with only the columns worth QUERYING
-- lifted out beside it. That keeps real rows and transactional writes, which is why this is
-- D1 and not KV, without freezing the shape of a book that is still growing.
--
-- IT IS A MIRROR. The Cow-Crm01 master remains the source of truth. `seq` is the row's
-- position in the master's own array, which is a stable address only for as long as that is
-- true; durable ids get assigned when the store becomes authoritative and not before.
-- Saying so here rather than discovering it later.

CREATE TABLE IF NOT EXISTS entry (
  collection TEXT    NOT NULL,          -- sales, purchases, loans, contacts, ...
  seq        INTEGER NOT NULL,          -- position in the master's array
  hash       TEXT    NOT NULL,          -- of the document, so a changed row is detectable
  date       TEXT,                      -- NULL is legal: a pending order has no date
  party      TEXT,                      -- customer or supplier code, never a name
  product    TEXT,                      -- salt or oil; absent on a row means salt
  status     TEXT,
  qty        REAL,
  total      REAL,
  doc        TEXT    NOT NULL,          -- the record, verbatim
  PRIMARY KEY (collection, seq)
);
CREATE INDEX IF NOT EXISTS entry_date  ON entry(date);
CREATE INDEX IF NOT EXISTS entry_party ON entry(party);
CREATE INDEX IF NOT EXISTS entry_prod  ON entry(collection, product);

-- Everything that is not a list of records: the opening position, the counts, the roster,
-- the quotes, the watermark. Stored whole because that is what they are.
CREATE TABLE IF NOT EXISTS state (
  key TEXT PRIMARY KEY,
  doc TEXT NOT NULL
);

-- Which desk this mirror was taken from, so a reader can tell whether it is behind.
CREATE TABLE IF NOT EXISTS snapshot (
  one     INTEGER PRIMARY KEY CHECK (one = 1),
  v       TEXT,
  stamped TEXT,
  sha     TEXT,
  rows    INTEGER,
  at      TEXT
);
