-- 0012_draft_reads.sql: two indexes on `draft`, so the reads that run every minute and every pass stop reading the
-- whole table (26 Sep 2026, fold 5.7 of the streamlining plan).
--
-- WHY. D1 bills the rows a query reads, not the rows it returns. Three reads went through every draft there has ever
-- been, and a draft is kept for good:
--   the drafter's newest commit, `MAX(committed_at)`, on every pass (the minute's orders pass and the quarter-hour net);
--   the Approve view's clock, the newest committed row, on every load of the pending list;
--   the minute cron's re-dispatch ladder (src/worker.js redispatchStale), approved and not yet committed, through
--   `draft_status`, which reads every approved row to find the few with no commit.
-- `draft_committed` answers the first two from one index entry; `draft_status_committed` answers the third, the commit
-- run's `?uncommitted=1` and `tools/drafts.mjs --approved` from the uncommitted rows alone. The drafter's own "which of
-- these entries is drafted" reads by primary key in src/drafter.js and needs nothing here.
--
-- INDEXES ONLY, NOT A REBUILD: no row is copied, dropped or changed, and IF NOT EXISTS makes a second run a no-op. Apply
-- THIS FILE ALONE to the live D1 (`npx wrangler d1 execute salt_ledger --remote --file=migrations/0012_draft_reads.sql`),
-- never the folder: re-running an older rebuild drops rows. Without it the Worker gets the same answers at the old cost
-- in rows read, so it may land before or after the deploy. A later rebuild of `draft` drops every index on it with the old table and
-- must create these two again, as 0010 did `draft_status` and `draft_amends`.

CREATE INDEX IF NOT EXISTS draft_committed ON draft (committed_at);
CREATE INDEX IF NOT EXISTS draft_status_committed ON draft (status, committed_at);
