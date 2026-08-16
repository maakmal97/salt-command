-- 0002_draft.sql — the approval step between a queued entry and a ledger row.
--
-- WHY THIS EXISTS, from the row that caused it. On 14 Aug an oil unit was queued at RM115.
-- The entry was unremarkable on its face: a product, a party, a quantity, a price, all
-- well-formed. It was the ROW written from it, carrying RM7 of cost and a 93.9% margin
-- beside the price, that made the fault obvious on sight. The real figure was RM11.50 and
-- the book carried RM103.50 of revenue that never existed until it was corrected.
--
-- So the thing being approved here is the ROW, not the entry. An entry cannot be checked
-- against anything; a row can be checked against the lot it draws, the floor it clears and
-- every other price that party has paid. That is the whole design and it is why `row` and
-- `reasoning` are NOT NULL: a draft with no proposed row is just a queue entry wearing a
-- different name, and it would rebuild the exact gap this table closes.
--
-- D1 AND NOT KV, for the reason 0001 gives: KV rewrites a whole blob and last write wins,
-- so two devices deciding at once would silently lose a decision. An approval is a ledger
-- act and must not be lossy.
--
-- THIS TABLE IS NOT A MIRROR, which makes it the first thing in the store the cloud owns
-- outright. `entry` and `state` mirror the master and the master stays authoritative for
-- them. A draft has no counterpart in the master: it is created here, decided here, and
-- only its APPROVED rows are ever read back by the commit run. Writing to it therefore does
-- not flip the direction 0001 reserves, and nothing here may write to `entry`.

CREATE TABLE IF NOT EXISTS draft (
  id          TEXT PRIMARY KEY,        -- the queue entry's own `at`, so it dedupes exactly as drain.mjs does
  status      TEXT NOT NULL            -- pending -> approved | rejected. No other value is legal.
              CHECK (status IN ('pending','approved','rejected')),
  collection  TEXT NOT NULL            -- which array of the master the row belongs in
              CHECK (collection IN ('sales','purchases')),
  entry       TEXT NOT NULL,           -- the queue entry verbatim, so the phone can show what was typed
  row         TEXT NOT NULL,           -- the PROPOSED ledger row, as JSON. The thing being approved.
  reasoning   TEXT NOT NULL,           -- why the drafter chose that cost, that date, that bucket
  flags       TEXT,                    -- JSON array of things the drafter wants looked at, e.g. a rate off its own ladder
  party       TEXT,                    -- lifted out for display and querying; a code, never a name
  product     TEXT,
  date        TEXT,                    -- NULL is legal and meaningful: a pending order has no date
  qty         REAL,
  total       REAL,
  cost        REAL,                    -- per unit, as the drafter proposes it
  drafter     TEXT NOT NULL,           -- who wrote the row, so an unattended draft is never mistaken for a typed one
  drafted_at  TEXT NOT NULL,
  decided_at  TEXT,                    -- set on approve or reject, never cleared
  decided_by  TEXT,
  committed_at TEXT                    -- set by the commit run once the row is in the master; approved-but-uncommitted is the queue it works from
);
CREATE INDEX IF NOT EXISTS draft_status ON draft(status);
CREATE INDEX IF NOT EXISTS draft_party  ON draft(party);
