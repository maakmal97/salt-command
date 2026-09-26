# The cloud fold

**What an agent does when asked to fold, and what it deliberately does not.**

Rewritten 23 Aug 2026 for the book as data (v339) and the fold tool (v340). The routine that
once ran this four times a day (`Salt daily fold`, trig_01UrnjQMWA3f6GXN5R6Dzi4S) was disabled
24 Aug 2026: a fold reached on request lands inside a minute, faster than the six-hourly slot
ever did, so the clock was adding a race (see CLAUDE.md, "The chain: tap to deploy") without adding
speed. **From 03 Sep 2026 the fold runs inside `cloud-commit.yml`: an approval on the phone
dispatches it, and the Claude Code action folds in the same run, before the deploy. Since v520
(08 Sep 2026) stage, fold and deploy are steps of one job, `chain`, and since v521 the Fold step
is `node tools/foldcall.mjs`: the plan below, a dossier the tools compute, one Claude call for the
notes, a check against the house rules, then `--apply`. **Since v792 (22 Sep 2026) that call is not
a condition of the fold**: with no key, with a call that will not go through, or with a reply twice
against the house rules, `tools/foldnotes.mjs` writes the notes from the same dossier and the fold
lands, recording no judgement and saying so in every row note and in the version entry. This document is what that call is told
to do, and what any agent asked to fold by hand still does** (CLAUDE.md, "The chain: tap to deploy"). The routine is kept, disabled,
as the manual backup. Whoever folds: if `master/_to_fold.json` is not in master, nothing is
staged, say so in one line and stop; if `master/_folded.json` is present, the last batch is
folded and waiting for its deploy to clear it, stop likewise: the next cloud run stages nothing,
deploys it, marks its rows and clears both files (26 Sep 2026), never reading it as a replay.
This procedure is unchanged and still what any agent follows, whether that is the Fold step, a
Code session asked to fold, or the routine fired by hand. The laptop-era procedure is
kept verbatim beside this as `DAILY_FOLD.md` for its context; where the two disagree, this file
wins. **`DAILY_FOLD.md` was RETIRED on 12 Sep 2026** and now opens by saying so: every path in
it died when the master moved into this repo on 20 Aug, so it is history and never instruction.

## The shape of it

**The book is `ledger/book.json`.** The rows, the stated stock, the count dates, the roster, the
quotes and the watermark are data in that file, and `NOTES` in the same file holds the prose that
sits beside a figure (the roll of the stated stock, the oil counts). The master carries a generated
copy of the book between its `BOOK` markers, written by `node tools/booksync.mjs --sync`; CI fails
if the copy is not the file. **Nothing edits the rows in the master by hand any more.**

**The fold is a data write, done by a tool, with the judgement supplied by you.**
`tools/fold.mjs` reads the staged batch, tells you what each row would do, takes your notes, and
writes the book, the master, the version entry and the changelog in one pass, all or nothing.
What stays yours is exactly what a person is for: the note on every row, the sentence on the roll,
the version entry. What leaves you is the syntax.

## What the agent has, and what it has not

**Has:** a fresh git checkout of this repo: `ledger/book.json`, `master/salt_command.html`, every
tool in `tools/`, the test suite, and `master/_to_fold.json` if there was anything to fold.

**Has not:** any credential. No Cloudflare token, no write key, no wrangler auth. It therefore
**cannot read D1, cannot reach the queue and cannot deploy.** GitHub Actions does those around it:

| When | Who | What |
|---|---|---|
| on a tap, and hourly | `cloud-commit.yml`, job `chain`, then job `suite` | `chain`, holding the lock: reads the approved rows out of D1 into `master/_to_fold.json`, commits, then folds with the agent, gates the tree once (the Gate step stands down on the tree the Fold step's gate passed), deploys, proves the phone is serving it (reading `/rev` every 2 s for up to a minute), sends the folded-row banner, marks the ids committed with the clock, re-seeds the mirror and publishes the statements; `suite`, outside the lock and only after a deploy: runs the suite on the sha chain proved |
| on demand | **the agent, asked to fold** | folds with the tool, builds, tests, commits, pushes; the push runs the deploy steps alone |
| 11:00 MYT | `ship-check.yml` | proves the repo and the live Worker agree |

## The steps

1. **`node tools/fold.mjs --plan`.** If it says there is nothing to fold, stop: say so in one line
   and do not bump a version. Otherwise it prints, for every row in the batch, what the fold would
   do (append, fulfil, count, register) and what will leave or land on the shelf, refuses anything
   it must refuse, and writes **`master/_fold_notes.json`**, a skeleton with one entry per row.

2. **A refusal folds nothing.** A **Correction** is mechanical from 25 Aug 2026 and folds like
   any other amendment: it rewrites what a row says (its product, its party, its attribution, its
   date, its size, its total, its note), moves no cash and no stock, and leaves the old value in
   the row's `mod` field. The tool refuses a Linked or Rewarded amendment (neither carries
   a figure to check, only a judgement about which other row or which award applies; a
   Modification is mechanical from 24 Aug 2026, see below), an amendment whose key matches no
   row or more than one, a registration already on the roster, and a new row that would replay
   one already on the book (same party, date, size and total). If anything is refused, report it
   and stop; do not edit the
   batch to get past it. A day with no commit is cheap and a wrong row is not.

3. **Fill in `master/_fold_notes.json`.** This is the judgement, and it is most of what makes this
   book worth auditing:
   - `rows.<id>.note` for every NEW row: what a person auditing it would need. Read the row
     against the book: the party's history, the rate against the ladder and the floor (the Pricing
     tab, never a figure computed by hand), whether the cost the draft carries is the shelf's (the
     shelf is the latest lot; a draft written against a stale mirror may carry an older rate, and
     `rows.<id>.cost` overrides it, in RM for the whole order since v496, never per unit, with the reason in the note). Codes only, never a name.
   - `rows.<id>.note` for an amendment is the trail note: what moved, when, what it leaves
     outstanding. `rows.<id>.rowNote`, if given, is prepended to the row's own note.
   - `version`: the next after the master's. `title`: in capitals, as every entry before it.
     `notes`: an array of HTML strings, each opening with a bold lead, saying what was folded, what
     was unusual, and what the shelf did.
   - `stockNote`: your words on the roll, appended to the sentence the tool writes.
   - `stockCost` and `stockCostNote`: leave them null and empty. Since 26 Sep 2026 every book's
     inventory rate is derived from its lots (the engine's `stockBasis`, read by `stockCostFor`), so
     there is no line to roll; `fold.mjs --apply` ignores a figure here and prints a `note` saying so.

4. **`node tools/fold.mjs --apply`.** It appends the new rows with their notes, applies each
   fulfilment exactly as the desk's own `ovAmend` would (cash and units added, the trail extended
   from an as-booked seed, a pending lot that stops being pending gets `receivedQty:0` and
   `inTransit` so a deposit cannot walk it into stock), **replaces** a modified row's qty and
   total with its new terms (nothing is added, unlike a fulfilment; `unpriced` is cleared if the
   new total is real, and a plain restated-from-to line is appended to the row's `mod` field),
   sets a count's stated shelf and moves
   `COUNT_ON`, appends a loss to `selfUseLog` and a lost sale to `lostDemand`, adds a registration
   to the roster, re-keys a rename (v628, Amend ID) wherever the book holds the code AFTER every other
   row in the batch, with its statement key, place override and the suite's fixtures, files a party's
   point on the map in `PLACED` from a `place` entry or the `geo` a registration or rename carries (v633),
   files a customer's tier for each product in `TIER_OF` from a `tierset` entry (v643, per product since v646, a null
   clearing one) or the starting tiers a registration carries (v645),
   **rolls the stated stock for what physically moved** (a roll and not a count;
   `COUNT_ON` is untouched) and writes the roll sentence into `NOTES`, moves `QUEUE_COMMITTED` to
   the newest id folded, sorts the book, syncs the master, writes the version entry and the stamp,
   prepends the changelog, and writes **`master/_folded.json`** naming the ids. All of it or none.

5. **`node tools/ledger.mjs`, then `npm run build && npm test`.** All three must pass.
   `ledger.mjs` re-reads the folded master in jsdom and rewrites `ledger/ledger.json`, the
   extract the D1 seed is built from; the test suite compares it against `ledger/book.json` on
   every key, so a fold that skips it leaves a stale extract and fails CI. The build writes
   `public/desk.html`, `public/data.json` and `public/rev.json`; commit all four with the book
   and the master.

6. **Commit and push.** Say plainly what was folded, what was refused and why, and any figure you
   were unsure of. That push is what triggers the deploy, and the deploy marks the ids committed
   only after the phone is proven to be serving the new build.

## Folding from the laptop

- **Approve LAST.** An approved row is fair game for the next cloud tick, whose timing is
  irregular, and a tick inside the window folds it in the cloud and refuses the laptop's push. So
  build the batch from the PENDING drafts first: the same SELECT `drafts.mjs approved()` runs,
  `status='pending'` in its place, shaped identically, written to the scratchpad (D1 reads by
  `--command`). Run `fold.mjs --plan --staged <that> --notes <scratch>` and `foldcall.mjs --dry`
  with the same flags for the dossier; write the notes and check them with the exported
  `checkNotes` and the prompt's word limits. Only then approve, run `--approved >
  master/_to_fold.json`, confirm its rows equal the provisional batch bar `decidedAt` and
  `decidedBy`, `--apply`, `node tools/ledger.mjs`, commit both `_to_fold.json` and `_folded.json`,
  and ship within minutes. `decided_by` names him, the Code session and its date, then the basis.
- **Re-drafting an entry he later calls real.** A draft keeps its id (the entry's `at`) once
  decided, and `INSERT OR IGNORE` never re-drafts it; a pending card's flags are frozen too. Mint a
  fresh `at` above `QUEUE_COMMITTED`, run `draftRow(entry, book)` from `src/drafter.js` with the book
  from `readBook()` in `tools/book.mjs` (`{sales, purchases, state, pricing: state.PRICING}`;
  `file:///` import URLs on Windows), write `{id, collection, entry, row, reasoning, flags, amends,
  amendKind, drafter}`, stage it with `drafts.mjs --draft`, approve with `--approve <id> --by
  "..."`, then `--approved > master/_to_fold.json` and the normal fold. Never touch the decided rows.
- **Withdrawing an approved row** has no tool: an UPDATE on D1 through `wrangler d1 execute --file`
  with `decided_by` naming the reason, on his word, then `drain.mjs --forget <at>`.
- **`drain.mjs --status` can fail in a Code shell** when wrangler's KV listing wants a token; the
  drafter drafts every arrival, so an empty `drafts.mjs --list` is the working proof that the queue
  is clear. Say the KV read failed.

## What the agent must never do

- **Never edit the rows in `master/salt_command.html`.** They are a generated copy; the next sync
  overwrites the edit and CI fails until then.
- **Never fold past a refusal.** Report it and fold nothing.
- **Never invent a row to explain a shortfall.** A row written from a hypothesis is worse than a gap.
- **Never write a real name.** Codes only, everywhere, including in a note.
- **Never edit `public/desk.html`.** It is a build output.
- **Never mark a draft committed.** That is the deploy steps', after the phone has it.
