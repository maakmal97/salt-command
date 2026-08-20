# The cloud fold

**What the scheduled cloud agent does at 10:00 MYT, and what it deliberately does not.**

Written 20 Aug 2026, when the master moved into this repo and Salt left Cowork. The full
laptop-era procedure is kept verbatim beside this as `DAILY_FOLD.md`; it carries a great deal
of context this file does not repeat, and the numbered steps below are the part that survives
into a cloud run. Where the two disagree, this file wins, because `DAILY_FOLD.md` still assumes
a laptop, a server window and a `10_Data` folder that the agent cannot see.

## What the agent has, and what it has not

**Has:** a fresh git checkout of this repo, including `master/salt_command.html`, every tool in
`tools/`, the test suite, and `master/_to_fold.json` if there was anything to fold.

**Has not, and this shapes everything below:** any credential. No Cloudflare token, no write
key, no wrangler auth. It therefore **cannot read D1, cannot reach the queue and cannot
deploy.** GitHub Actions holds the credential and does those three things around it:

| When | Who | What |
|---|---|---|
| 09:30 MYT | `cloud-commit.yml` | reads the approved rows out of D1 into `master/_to_fold.json`, commits |
| 10:00 MYT | **the agent** | folds, rolls the stock, bumps, builds, tests, commits, pushes |
| on push | `cloud-commit.yml` | deploys, checks the phone is serving it, marks the ids committed |
| 11:00 MYT | `ship-check.yml` | proves the repo and the live Worker agree |

## The steps

1. **Read `master/_to_fold.json`.** If it is absent, or `count` is zero, there is nothing to
   fold. Say so in one line and stop; do not bump a version for a day with no trade.

2. **Check for a replay before folding anything.** For each row, look in
   `master/salt_command.html` for an existing row with the same date and the same total. If one
   exists, that row was already folded and the draft was never marked committed. **Do not fold
   it again.** Report it and leave it; a double count is the most expensive fault this book can
   carry, and it has happened.

3. **Look at `amends` on every row before you fold anything.** It is NULL on a new row and set
   on an amendment, and the two are folded completely differently.

   **An amendment does NOT append.** `amends` holds the desk's own `ovKey`, `party|date|total`,
   naming an EXISTING row. `row` is that target as it stood when the draft was written, not a
   row to add. Find it in `master/salt_command.html` and change it.

   **Apply it exactly as `ovAmend` in the master would**, and read that function before you do:
   it is layered, careful logic and the drafter deliberately does not duplicate it. A pending
   lot stops being pending the moment real money or real salt moves against it; a purchase that
   loses `pending` must gain `receivedQty:0` and `inTransit:true` or `poRecvKg` walks the whole
   lot into stock and the cost basis, which is the v146 failure that flag exists to prevent;
   partial receipts accumulate rather than replace. `amendKind` is `Fulfilment` or
   `Cancellation` and nothing else reaches you.

   **Record the tranche in the row's `amend` trail** as `{date,kind,cash,kg}`, because `txDates`
   treats the trail as authoritative and prefers it over `deliveredOn`.

   **The note still matters.** Amend the row's existing note or add to it: what moved, when, and
   what it leaves outstanding.

4. **Fold each approved NEW row into `sales` or `purchases`**, in the shape the arrays already use.
   The drafter wrote the row and he approved it, so the figures are not yours to change. What
   IS yours is the **note**: read the row against the book and write what a person auditing it
   would need. Every row on this book carries one. A fold that drops the prose is the reason
   this step is not a script.

5. **Roll `STATED_STOCK`** for anything that actually moved, and say in the comment what it
   rolled from, what came off, and that it is a ROLL and not a count. Never move `COUNT_ON`:
   only a physical count does that.

6. **Bump the version.** Replace `evolution[0]` with a new entry: `v`, `d`, `t` and an `n`
   array of notes. Then `node tools/changelog.mjs` to put it into `master/changelog.json`.

7. **Put the book back in date order:** `node tools/sort-ledger.mjs`.

8. **Build and test:** `npm run build && npm test`. Both must pass. The build writes
   `public/desk.html`, `public/data.json` and `public/rev.json`, and all three are committed.

9. **Write `master/_folded.json`** as `{"ids":["<id>", ...]}` naming every draft id you folded.
   The deploy job marks exactly these committed, and only after the phone is proven to be
   serving the new build. Get this list wrong and a row is either offered twice or lost.

10. **Move `QUEUE_COMMITTED`** in the master to the NEWEST id you folded, to the millisecond. It
   must sit at or after every id folded and before anything left pending. Never the clock.

11. **Commit and push.** That push is what triggers the deploy.

## What the agent must never do

- **Never fold an amendment whose `amends` key matches no row, or matches more than one.** The
  drafter checked against the open-order snapshot when it drafted, but the book may have moved
  since. A near miss is not a match: report it and fold nothing.
- **Never fold a `Modification`, `Linked` or `Rewarded` amendment.** They never reach you: the
  drafter refuses them because what changed is a judgement rather than which row. If one
  appears in `_to_fold.json`, something upstream is wrong.
- **Never invent a row to explain a shortfall.** On 20 Aug the shelf counted zero against a
  book that said 8.05, and the right answer was to record the count and leave the hole visible,
  not to write rows that would close it. A row written from a hypothesis is worse than a gap.
- **Never write a real name.** Codes only, everywhere, including in a note.
- **Never edit `public/desk.html`.** It is a build output.
- **Never mark a draft committed.** That is the deploy job's, after the phone has it.
