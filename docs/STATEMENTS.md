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

Do NOT write a new generator and do NOT reimplement the statement rules. They live in the desk
itself (`stmtRows`, `stmtRefunds`, `stmtRecon`, `stmtDoc` in `master/salt_command.html`), and a
second copy would drift the first time either changed. That is the same rule `data.json` obeys
and for the same reason.

```bash
node tools/make_statements.cjs master/salt_command.html statements/<YYYY-MM> <YYYY-MM-DD>
```

jsdom is already a devDependency, so `npm ci` is all the setup there is.

## Before committing

**Statements carry desk CODES and never a real name.** That is checked, not assumed: the
generator reads only the desk, and the desk holds no names. A scan of a full run against the
plaintext directory on 20 Aug found nothing, once `sans-serif` in the font stack was excluded
from the crude substring test that first flagged it.

Commit the folder and push. Nothing deploys and nothing touches the ledger: this task reads the
desk and writes files beside it.

## What this task must never do

- **Never edit the master.** It is read-only here.
- **Never send anything.** He sends these himself, so they must be right before they are sent.
- **Never regenerate a past month** to match a later code scheme.
