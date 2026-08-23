# The cloud fold

**What the scheduled cloud agent does four times a day, and what it deliberately does not.**

Rewritten 23 Aug 2026 for the book as data (v339) and the fold tool (v340). The laptop-era
procedure is kept verbatim beside this as `DAILY_FOLD.md` for its context; where the two
disagree, this file wins.

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
| hourly | `cloud-commit.yml` | reads the approved rows out of D1 into `master/_to_fold.json`, commits |
| 08:52, 14:52, 20:52, 02:52 MYT | **the agent** | folds with the tool, builds, tests, commits, pushes |
| on push | `cloud-commit.yml` | deploys, checks the phone is serving it, marks the ids committed, re-seeds the mirror |
| 11:00 MYT | `ship-check.yml` | proves the repo and the live Worker agree |

## The steps

1. **`node tools/fold.mjs --plan`.** If it says there is nothing to fold, stop: say so in one line
   and do not bump a version. Otherwise it prints, for every row in the batch, what the fold would
   do (append, fulfil, count, register) and what will leave or land on the shelf, refuses anything
   it must refuse, and writes **`master/_fold_notes.json`**, a skeleton with one entry per row.

2. **A refusal folds nothing.** The tool refuses a Modification, Linked or Rewarded amendment
   (what changed is a judgement), an amendment whose key matches no row or more than one, a
   registration already on the roster, and a new row that would replay one already on the book
   (same party, date, size and total). If anything is refused, report it and stop; do not edit the
   batch to get past it. A day with no commit is cheap and a wrong row is not.

3. **Fill in `master/_fold_notes.json`.** This is the judgement, and it is most of what makes this
   book worth auditing:
   - `rows.<id>.note` for every NEW row: what a person auditing it would need. Read the row
     against the book: the party's history, the rate against the ladder and the floor (the Pricing
     tab, never a figure computed by hand), whether the cost the draft carries is the shelf's (the
     shelf is the latest lot; a draft written against a stale mirror may carry an older rate, and
     `rows.<id>.cost` overrides it, with the reason in the note). Codes only, never a name.
   - `rows.<id>.note` for an amendment is the trail note: what moved, when, what it leaves
     outstanding. `rows.<id>.rowNote`, if given, is prepended to the row's own note.
   - `version`: the next after the master's. `title`: in capitals, as every entry before it.
     `notes`: an array of HTML strings, each opening with a bold lead, saying what was folded, what
     was unusual, and what the shelf did.
   - `stockNote`: your words on the roll, appended to the sentence the tool writes.
   - `stockCost` and `stockCostNote`: only when a lot landed and the cost basis moves.

4. **`node tools/fold.mjs --apply`.** It appends the new rows with their notes, applies each
   fulfilment exactly as the desk's own `ovAmend` would (cash and units added, the trail extended
   from an as-booked seed, a pending lot that stops being pending gets `receivedQty:0` and
   `inTransit` so a deposit cannot walk it into stock), sets a count's stated shelf and moves
   `COUNT_ON`, appends a loss to `selfUseLog` and a lost sale to `lostDemand`, adds a registration
   to the roster, **rolls the stated stock for what physically moved** (a roll and not a count;
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

## What the agent must never do

- **Never edit the rows in `master/salt_command.html`.** They are a generated copy; the next sync
  overwrites the edit and CI fails until then.
- **Never fold past a refusal.** Report it and fold nothing.
- **Never invent a row to explain a shortfall.** A row written from a hypothesis is worse than a gap.
- **Never write a real name.** Codes only, everywhere, including in a note.
- **Never edit `public/desk.html`.** It is a build output.
- **Never mark a draft committed.** That is the deploy job's, after the phone has it.
