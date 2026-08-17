-- 0003_refused.sql — the entries the drafter will not draft, kept so they can be SEEN.
--
-- WHY THIS IS ITS OWN TABLE AND NOT A FOURTH `draft` STATUS. 0002 makes `row` and
-- `reasoning` NOT NULL and says why at length: a draft with no proposed row is just a queue
-- entry wearing a different name, and storing one would rebuild the gap the approval step
-- closes. A refusal is exactly that shape. It has no row, by definition, because the whole
-- point is that the drafter declined to write one. Putting it in `draft` would either
-- require those columns to go nullable, which discards 0002's guarantee for every row, or
-- require a fake row, which is worse. So it lives here.
--
-- IT IS NOT AN APPROVAL QUEUE AND MUST NEVER GROW ONE. Nothing in this table can be
-- approved, committed or folded. It carries no decision column on purpose: the only verb it
-- supports is reading. An entry here is handled by a person on the laptop, against the row
-- it amends, exactly as it always was.
--
-- WHAT IT IS FOR, from the incident that produced it. On 17 Aug the same CC5-OKR fulfilment
-- was queued twice, once on the laptop and once from the phone three hours later, with a
-- byte-identical payload. The second was withdrawn before it could put 1 unit and RM80
-- through a completed row a second time. The cause was not carelessness: an entry queued on
-- the laptop is invisible from the phone, so re-entering it is the natural thing to do and
-- looks safe. Amendments are refused by the drafter by design, so they never reach the
-- Approve tab where they would have been seen. This table is what makes them visible there.
--
-- SELF-CLEANING. The drafter deletes anything at or below the master's watermark on every
-- run, so an entry that has since been folded stops being listed without anyone tidying up.

CREATE TABLE IF NOT EXISTS refused (
  id        TEXT PRIMARY KEY,     -- the queue entry's own `at`, as everywhere else
  entry     TEXT NOT NULL,        -- the entry verbatim, so the phone can show what was typed
  why       TEXT NOT NULL,        -- the drafter's reason, in its own words
  party     TEXT,                 -- lifted out for display; a code, never a name
  source    TEXT NOT NULL,        -- which drafter saw it: the cloud run or the laptop sweep
  seen_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS refused_seen ON refused(seen_at);
