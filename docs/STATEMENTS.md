# Monthly statements, in the cloud

Moved out of Cowork on 20 Aug 2026, once the master was in this repo. The laptop-era SKILL is
`Scheduled\salt-monthly-statements\SKILL.md`; this is the part that survives a cloud run, and
where the two disagree this file wins.

## The gate, first and most important

The routine fires **every Sunday** because cron cannot express "first Sunday of the month":
day-of-month and day-of-week are OR'd in most implementations, not AND'd. The gate that stops
most runs is the design working, not a fault.

Establish the date and weekday in Asia/Kuala_Lumpur before anything else:

```bash
TZ=Asia/Kuala_Lumpur date '+%u %d'     # %u is ISO weekday: SUNDAY IS 7, NOT 0
```

- **Day of month greater than 7:** not the first Sunday. Stop immediately, produce nothing,
  write nothing, say in one line that no statements were due.
- **Day 1 to 7 but not Sunday:** a manual or retried run on the wrong day. Stop on the same
  terms, saying which day it actually is.
- **Day 1 to 7 and Sunday:** continue.

## What to produce

```
statements/<YYYY-MM>/statement_<CODE>_<YYYY-MM-DD>.html
statements/<YYYY-MM>/_review_<YYYY-MM-DD>.html
```

One per customer with anything to show, named by code so the folder sorts alphabetically, plus
a review sheet stitching every account together. **The review sheet is not for sending.** It is
labelled internally and exists so a whole run can be checked in one pass.

**Check the folder before writing into it.** The generator overwrites silently and has no
re-run guard. If `statements/<YYYY-MM>` already holds a set: same issue date is a clean retry
and may be regenerated in place; a *different* issue date means a second issue in one month, so
stop and say so rather than overwriting what was already sent.

**Folders written under superseded code schemes stay as issued.** The customer codes have been
re-keyed before. Earlier folders carry the codes current at issue; do not rename, regenerate or
reconcile them.

## How to produce them

Do NOT write a new generator and do NOT reimplement the statement rules. They live in
`tools/make_statements.mjs` and nowhere else. Until v388 they lived in the desk and the tool
drove it headlessly; v388 removed the desk's statement panel and all five functions on his
instruction, so the module now carries the v387 text itself, proven byte-identical against the
v387 desk's own output when it moved (29 Aug 2026). Every figure still comes from
`ledger/book.json` and `engine/position.mjs`, the same book and engine the desk runs, so the
arithmetic cannot drift; what lives in the module alone is the statement's own law. If the desk
ever regains a statements panel, inline the module the way `tools/engine.mjs` inlines the
engines: one copy, wherever it lives.

```bash
node tools/make_statements.mjs statements/<YYYY-MM> <YYYY-MM-DD>
```

Plain node, no jsdom, no network, and the master is not an input.

## Before committing

**Statements carry desk CODES and never a real name.** That is checked, not assumed: the
generator reads only the book and the engine, and neither holds a name. A scan of a full run
against the plaintext directory on 20 Aug found nothing, once `sans-serif` in the font stack
was excluded from the crude substring test that first flagged it, and since 29 Aug the suite's
statements section builds a full run and greps every statement for the seller's vocabulary,
for any other party's code and for the ledger's own notes.

Commit the folder and push. Nothing deploys and nothing touches the ledger: this task reads the
desk and writes files beside it.

## What this task must never do

- **Never edit the master.** It is read-only here.
- **Never send anything.** He sends these himself, so they must be right before they are sent.
- **Never regenerate a past month** to match a later code scheme.
