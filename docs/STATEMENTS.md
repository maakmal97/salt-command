# Monthly statements, in the cloud

Moved out of Cowork on 20 Aug 2026, once the master was in this repo. The laptop-era SKILL is
`Scheduled\salt-monthly-statements\SKILL.md`; this is the part that survives a cloud run, and
where the two disagree this file wins.

## The gate, first and most important

**From 01 Sep 2026 the routine fires on the first of the month, not the first Sunday.** The
old schedule needed the gate because cron cannot express "first Sunday". The new one still
needs it, for a different reason: routine crons are UTC, midnight in Kuala Lumpur is 16:00 UTC
on the *previous* day, and which day that is changes with the length of the month. So the
trigger fires on the 28th to the 31st and the gate keeps exactly one run a month. Verified
against every month length, February and leap February included.

Establish the date in Asia/Kuala_Lumpur before anything else:

```bash
TZ=Asia/Kuala_Lumpur date '+%d'
```

- **Not 01:** stop immediately, produce nothing, write nothing, say in one line that no
  statements were due. Most fires stop here and that is the design working.
- **01:** continue. The issue date is that day, `YYYY-MM-01`.

There is no longer a weekday test. If you find one, it is left over from the Sunday schedule.
Folders issued before Sep 2026 are named by first-Sunday dates, because that is when they were
issued; they are not renamed.

## What to produce

```
statements/<YYYY-MM>/statement_<CODE>_<YYYY-MM-DD>.html   his copy, one per customer
statements/<YYYY-MM>/_review_<YYYY-MM-DD>.html            every account in one pass
statements/<YYYY-MM>/_kv/<username>.json                  ciphertext + verifier, for the site
statements/<YYYY-MM>/_passwords.json                      GITIGNORED, never committed
statements/_users.json                                    code -> username, for life; committed
```

**The username is minted once and kept for life.** `_users.json` sits beside the month folders
because it belongs to every issue, not to one. A customer new to the roster gets a line the first
month a statement is made for them, and no line ever changes: a username is the address a
customer keeps, so re-keying one would strand everything they were ever sent. It is committed,
because an address is not a secret; the password beside it is, and that stays out.

One per customer with anything to show, named by code so the folder sorts alphabetically, plus
a review sheet stitching every account together. **The review sheet is not for sending.** It puts
every account beside every other, which is exactly what a statement must never do, and it exists
so a whole run can be checked in one pass.

**The passwords are in `_passwords.json` and nowhere else.** They were briefly in a column on the
review sheet as well, which made the gitignore rule pointless: the review sheet is committed, so
the same passwords went into git anyway. One place, and that place is not the repository. The
suite asserts that no generated page contains one.

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

**A BACK-DATED SET IS AN ARCHIVE, and it takes `--archive`.**

```bash
node tools/make_statements.mjs statements/<YYYY-MM> <YYYY-MM-DD> --archive
```

It writes the statements and the review sheet and nothing else: no QR, no password, no
encrypted record. The QR is the reason. The site opens whichever issue was published last, so
a code printed on a July statement asks for September's password and the reader is told his
was refused, on a document that looks perfectly current. A record of a past position is worth
keeping; a dead code on it is not. The publish step skips a folder with no `_kv`, so an archive
never becomes the live set. **It still reaches the customer**: every later issue reads the
archive back as history and carries it inside that month's record.

**The re-issue guard is in the tool, not in this file.** Same issue date is a clean retry and
regenerates in place, keeping the passwords already issued, because minting fresh ones would
invalidate every password already sent. A *different* issue date means a second issue in one
month and the tool refuses. Do not talk it out of that.

## How a customer reads it (03 Sep 2026, his instruction)

**The statements live on their own site, away from the desk.** Until 03 Sep they were a route
on `salt-command` itself, which put the one address a customer ever holds one path segment from
an open ledger. They are a second Worker now, `stmt/worker.js` under `wrangler.stmt.jsonc`, with
a cryptic name that says nothing about salt, a KV store of its own, and no access to the queue,
the vault, D1 or the desk. Nothing a customer holds points at the desk's address, and the suite
checks that no statement does either.

Each statement carries a QR code and prints the customer's **username**. The QR opens
`https://k7m3p2.qyts8mh72kyg.workers.dev/?u=<username>`, one landing page for every account,
with the username filled in; the password goes by a different channel. The page checks the
pair, decrypts in his own browser, and shows **this month's statement and every earlier one**,
newest first, on a strip of issue dates. It locks after **three minutes**; the same password
opens it again as often as he likes.

**One live password a month, and it cannot be changed.** Each issue mints a fresh password per
customer and re-encrypts their whole history under it, so last month's password stops opening
anything the moment the new issue publishes. There is no change-password control anywhere: a
customer who has lost his asks for it again, and it is read back from `_passwords.json`.

**Four things stand between an account and the public, and none is trusted alone:**

1. The statements are AES-GCM ciphertext at rest under that customer's password, with the
   same crypto as the name vault. The site holds no key and could not read one.
2. A PBKDF2 verifier decides whether the envelope is handed over at all.
3. Ten failed attempts lock a username for fifteen minutes. A username is random rather than
   a desk code, so it cannot be guessed from a roster, and an unknown username answers byte
   for byte as a wrong password does, so the list cannot be walked.
4. `STMT_MASTER`, a secret on the statements Worker, is his override.

**What none of it does is stop a statement being forwarded.** A password shared is a password
shared, and an open page can be photographed. The three minutes stop a phone being left on a
table with an account on it. Nothing in the copy should promise more than that.

**The address shares the account's `workers.dev` subdomain with the desk**, which is the one
thing a curious customer could still notice. A custom domain on the statements Worker is the
fix: a `routes` block in `wrangler.stmt.jsonc`, and `SALT_BASE_URL` (or the default at the top
of `tools/make_statements.mjs`) changed to match before the next issue, since the QR carries it.

### Publishing, and the one-time setup

Statements reach the site through the two steps at the foot of the `deploy` job in
`cloud-commit.yml`, `Deploy the statements site` and `Publish the newest statements`, on any
push to master that touches `statements/`, `stmt/` or `wrangler.stmt.jsonc`. They run after
every step the ledger needs, so a fault in the statements can never leave a folded row
unmarked. The publish uploads the newest month only and retires every record that month does
not carry, so **issuing a new set retires last month's**, and it clears the attempt counters so
nobody starts a month locked out.

Both steps stand down while `wrangler.stmt.jsonc` still carries `PLACEHOLDER_STMT_KV_ID`, so
the site does not exist until the store does. Creating it is one-time work on the laptop, in
**Command Prompt**, from the repo folder:

```
cd /d C:\Users\maakm\Claude\Code\salt-command
npx wrangler kv namespace create stmt -c wrangler.stmt.jsonc
```

It prints an `id`. Paste it into `wrangler.stmt.jsonc` in place of `PLACEHOLDER_STMT_KV_ID`,
commit and push; the next deploy creates the site and publishes. Then the override:

```
npx wrangler secret put STMT_MASTER -c wrangler.stmt.jsonc
```

Every wrangler command for this site takes `-c wrangler.stmt.jsonc`; without it, wrangler
addresses the desk.

`REQUIRE_ACCESS` on the desk does not touch this site, and never will: the two share nothing.

## Before committing

**Statements carry desk CODES and never a real name.** That is checked, not assumed: the
generator reads only the book and the engine, and neither holds a name. A scan of a full run
against the plaintext directory on 20 Aug found nothing, once `sans-serif` in the font stack
was excluded from the crude substring test that first flagged it, and since 29 Aug the suite's
statements section builds a full run and greps every statement for the seller's vocabulary,
for any other party's code and for the ledger's own notes.

Commit the folder and push. `_passwords.json` is gitignored; confirm `git status` does not
offer it. The `_kv` records are ciphertext and a verifier, and those ARE committed, because the
deploy is what uploads them; so is `statements/_users.json`, which the run may have added a
line to. Nothing touches the ledger: this task reads `ledger/book.json` and writes files beside
it.

## What this task must never do

- **Never edit the master or the book.** Both are read-only here.
- **Never commit `_passwords.json`.**
- **Never send anything.** He sends these himself, so they must be right before they are sent.
- **Never regenerate a past month** to match a later code scheme.
- **Never change a line in `_users.json`.** A username is an address a customer keeps.
