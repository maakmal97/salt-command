# Monthly statements, in the cloud

Moved out of Cowork on 20 Aug 2026, once the master was in this repo. The laptop-era SKILL is
`Scheduled\salt-monthly-statements\SKILL.md`; this is the part that survives a cloud run, and
where the two disagree this file wins.

## RETIRED, 21 Sep 2026, on his instruction

**There is no monthly statement any more.** The account is ONE LIVE DOCUMENT (v769): the publish
writes it into every record on every run, so it is never more than an hour behind the book, and the
page opens on the whole account rather than a month. A monthly issue adds nothing to that, and a
strip of issues says there is something to catch up on when there is not.

**So nothing runs on the first of the month.** `tools/make_statements.mjs` refuses to seal a NEW
issue and says so; the routine below is kept because it is the only written account of how an issue
is made, and because a sealed issue is still a real thing for a dispute or a position on a day. When
he wants one, it is asked for in so many words:

```bash
node tools/make_statements.mjs statements/2026-10 2026-10-01 --new-issue
```

**What is untouched:** the issues already sealed and sent (August and September) still publish and
still open on the page, because a dated record is not corrected in place; `--archive` of a past month
is not an issue and still works; and the LIVE statement, the price list, the associate's card and the
account mint all run on every publish exactly as before.

**One thing is his to do, and it is not in this repo:** the Cowork task `salt-monthly-statements`
fires from `Scheduled\`, a registry Code cannot see or write. Remove it from Cowork, or it will keep
waking to tell him an issue is due that this repo will refuse to make.

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
statements/<YYYY-MM>/_kv/<username>.json                  verifier, wraps and ciphertext, for the site
statements/<YYYY-MM>/_passwords.json                      GITIGNORED, never committed
statements/_users.json                                    code -> username, for life; committed
statements/_secrets.json                                  GITIGNORED: the key and the master
```

**One statement per person, not per code (v609, his ruling of 13 Sep 2026).** An associate's
`<CODE>-R` bucket is theirs, so it is never a party: its rows print on the associate's statement
marked *on behalf of a friend* (v687; *for resale* until 18 Sep 2026), and its price history
feeds the associate's price list. From October no issue
makes a bucket file; the August and September bucket files stay as sent, and the publish leaves a
bucket's record out, which retires it from the site.

**The username is minted once and kept for life.** `_users.json` sits beside the month folders
because it belongs to every issue, not to one. A customer new to the roster gets a line the day the
fold registers them (v588; before, the first month a statement was made for them), and no line ever changes: a username is the address a
customer keeps, so re-keying one would strand everything they were ever sent. It is committed,
because an address is not a secret; the password beside it is, and that stays out.

**Spare accounts** (D15, his answer of 24 Sep 2026: accounts ready on day one). A spare is a record
in the newest issue's `_kv` marked `spare: true`, free while no code in `_users.json` holds its
username (`tools/stmt-pool.mjs`). The publish writes it like any record and so never retires it,
marks it `spare` in the clear as it marks `assoc`, and lists it nowhere: no sheet row, no roster line,
no count. The site's door answers a spare with its one refusal, his master included, until a code holds it.
**The laptop mints them**, never CI: `node tools/stmt-account.mjs --pool` tops the pool up to ten free
(`--count N` for another figure, `--check` to write nothing) and, as `--mint` does, refuses without a
master that unwraps a record and a key that opens one that is not a spare, `$env:STMT_KEY` winning over
the file. Each is sealed as an account is, around an empty bundle, its password under the master as
`pwMaster` and in the clear under its USERNAME in `_passwords.json`, a spare having no code yet; once
bound it stays there, and a `make_statements` retry and Send look under the username after the code.
`tools/update.mjs` warns with that line when fewer than three are free.
**The fold binds them, never Salt Admin**: at Add ID a registration takes the next free spare as its
username (`registerAccounts` in `tools/fold.mjs`, one line in `_users.json`, no key needed), and the
publish in the same run seals the live statement and price list into it, so a walk-in signs in within
the fold's few minutes. With none free the fold mints a bare username as before; Salt Admin then reads
"Made at the next laptop update. Until then, show the Silver link." (the level is the ladder's last,
from `tiers`), and `update.mjs` mints the account.
**One username, one code**: the next spare is the same on every machine, so two folds from one base
take the same one and git merges their lines cleanly. The fold, the gate and the publish each refuse a
`_users.json` giving one username to two codes (`oneCodeEach`), before anything is written.

One per customer with anything to show, named by code so the folder sorts alphabetically, plus
a review sheet stitching every account together. **The review sheet is not for sending.** It puts
every account beside every other, which is exactly what a statement must never do, and it exists
so a whole run can be checked in one pass.

**The passwords in the clear are in `_passwords.json` and nowhere else.** They were briefly in a
column on the review sheet as well, which made the gitignore rule pointless: the review sheet is
committed, so the same passwords went into git anyway. One place, and that place is not the
repository. The suite asserts that no generated page contains one.

**Sealed under the master, they also ride with the record** (v688, his decision of 18 Sep 2026),
as `pwMaster`, so an account's card on Salt Admin can hand one over from his phone. That is
ciphertext under the passphrase that already unwraps every account, the publish keeps it out of
the record a customer fetches, and his page decrypts it in the browser straight to the clipboard.
`node tools/stmt-seal.mjs statements/<YYYY-MM> [--check]` sealed the issue that went out before
v688; it runs on the laptop, proves each password against the record's own verifier, and writes
nothing else.

**A PASSWORD FILED UNDER A NAME THAT HAS SINCE MOVED IS PAIRED BY ITS OWN VERIFIER** (v705, 18 Sep
2026). `_passwords.json` is keyed by the CODE AS IT WAS AT THE ISSUE, and Amend ID re-keys a code
wherever the book holds it. So a customer re-keyed after an issue has a password filed under a name
that no longer exists, `sheetParty` finds nothing, the account can never be sealed, and it reads
exactly like a password that was lost. Four accounts were in that state and not one was lost:
CA11-SEN to CA2-SEN, CA5-KER to CA5-BAN, CA7-JTR to CA7-AMP, CH5-OUG to CM3-OUG.

`tools/stmt-seal.mjs` now falls back to pairing by PROOF: a record with no password under its own
name is tested against the passwords whose code is **no longer on the roster**, and the one that
answers its own verifier IS its password. A verifier answers one password and no other, so this is
certainty rather than a guess. **Only orphaned passwords are tried**, so a password still filed under
a live code is never claimed by somebody else's record even when it would answer their verifier, and
**one password is one record**, so the second of two accounts issued the same password is reported
rather than handed one already claimed. Nothing is re-issued and no customer is moved off a password
they already hold. The run says which name each was filed under, because a code nobody recognises is
otherwise a puzzle.

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

Plain node, no jsdom, no network, and the master is not an input. It is the v387 desk's
statement code, and `tools/qr.mjs` feeds it the QR.

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

**Not bound to a month** (v690, his instruction of 18 Sep 2026). The live statement has always
carried every order from the start; the page filters it. Each dated row is tagged with its
month in `stmtDoc`, and ONE filter (S7 7.3) sits on the list it filters: All first and chosen (v769),
then the months the account has, newest first. Undated rows show whatever is chosen, and the account's
own position under the list does not move with the filter.

**Account** (S7 7.3, his "all recommended" of 24 Sep 2026). The live document's orders and refunds are
the system's Statement lines (`.salt-lines`, stacked on a phone, a table from about 600px of the list's
own width), "units" above one; an issue is a standalone file and keeps its table. The earlier statements
sit at the foot, each by its date and never "latest issue", and one opens in the statement's place with
Back to your statement above it. **This device** follows (beside it from 1080px), ONE card: saving it as an app
first (the keep card itself, which leads a new account's Home instead, moved and never copied), notifications on or
off, the account's other devices (S9 9.9, below), and Sign out. **Off is kept on the device** (`salt-push-off`): the
subscription is dropped there and the site told (`POST /push/unsubscribe`; a record it was not told of goes at the next
wake it cannot deliver, 404 or 410), and a sign-in files the phone again only once a Turn on has cleared it.
`drawAccount(el)` moves Account into a place and draws it.

**The statements live on their own site, away from the desk.** Until 03 Sep they were a route
on `salt-command` itself, which put the one address a customer ever holds one path segment from
an open ledger. They are a second Worker now, `stmt/worker.js` under `wrangler.stmt.jsonc`, with
a cryptic name that says nothing about salt, a KV store of its own, one Durable Object for its
orders (`stmt/orderbook.js`, S10), and no access to the queue,
the vault, D1 or the desk. Nothing a customer holds points at the desk's address, and the suite
checks that no statement does either.

**Never offered to a translator** (his decision D12, 24 Sep 2026): every page the site serves, a
guest's and Salt Admin's included, opens `<html lang="en" translate="no">` with Google's
`notranslate` meta (`DOC_OPEN` in `stmt/page.js`), because accepting Chrome's offer sends an
opened statement to a translation service. The Counter's script then sets `lang` to the language it reads (13.4).

**Every word by key** (his D12, the plan's 13.3): the Counter's page, its sheets and places, the banner
(`stmt/sw.js`) and every refusal read ONE table a language, `stmt/words.js`: English complete, and a key a
language lacks is English's, never its name. A figure, a date or a username is a `{n}` slot, and no sentence is
joined from translated halves. A refusal a customer can meet is `e.<code>` there: the Worker answers
`{error, code}` through `refusal()`, the order book passing the code and its slots on, and the page words the
code, the Worker's English standing for one it does not know. Salt Admin stays English and unkeyed; a guest's board
and a shut link are keyed but English only (no script); `stmt/send.js` is unkeyed.

**The first Malay slice** (his D12, the plan's 13.4): the `MS` table words the welcome, the door and its refusals,
saving the app (the keep card and Sheets, One step to finish), Home, paying (To pay now, the pay Sheet, Did you send,
a claim), an order's money and its messages, and This device. The page follows the phone (`navigator.languages`, the
first of `ms`, `ms-MY`, `ms-BN`, `zsm` or `en`, else English); a switch, English or Bahasa Melayu, on the door, the
welcome, One step to finish and This device overrides it and is kept on the phone as `salt-lang`, the page drawing the
same without storage. Outside the slice (Prices, the statement, Rewards, the order sheet, the Orders list, and an
order's head, steps, history and cancel) is drawn in English whatever is chosen (`inEn`) and says `lang="en"`
(`enLang`, the slice inside it `rdLang`), a state, size or date the
slice shares included, and so is a note a tap leaves there (`wErrE`), so an order's screen is mixed until its slice comes. The page leaves its language in the
origin's Cache as `/lang` on every open and switch, and `stmt/sw.js` reads it to word a banner, English where there is
none. Salt Admin is English on any phone, with no switch. The sign-in message is English then Bahasa Melayu in one,
since it goes before the phone's language is known. The suite reads the Malay table and a Malay served page for a
product or level word.

Each statement carries a QR code and prints the customer's **username**. The QR opens
`https://k7m3p2.qyts8mh72kyg.workers.dev/?u=<username>`, one landing page for every account,
with the username filled in; the password goes by a different channel. The page checks the
pair, decrypts in his own browser, and opens on **"Now"**, with every issue by its date at the foot. It stays signed in on that device while Keep me signed in is ticked, and Log out ends it (v692); until 18 Sep 2026 it locked after three minutes and asked for the password again, as often as
he likes.

**"Now" is live (his instruction, 03 Sep 2026): every entry from the start to the minute it was
written.** The deploy rewrites it after every fold, so an approved row reaches the customer's
page in the same run that reaches the phone. Its heading names that minute in Kuala Lumpur
time. The dated issues beside it are the monthly statements exactly as sent, the August archive
included, and they never change.

**What is to pay, sealed beside `owed`** (S6, his D9 of 24 Sep 2026). `liveStatement` carries `owed`,
the footer's figure, and `pay` from `payDue` in `tools/make_statements.mjs`: `{term, now: {rm, due,
parts}, overdue: {rm, parts}, coming: {rm, parts}}`. **To pay now** is the desk's receivable,
`txAdvance`, row by row: goods handed over and not paid for, each part due at its order date plus
`term`, the desk's `RULES.creditDays` read out of the master (a master stating none stops the
publish); `now.due` is the soonest. `due` counts from `date`, never `gotOn`, as the desk's Credit age
does, so goods handed over after that day are late the day they go. A part is `late`, and listed in **overdue**, only once its due
day has passed, the desk's `buyerProfile` reading of late; an undated part is never overdue. The
desk's Credit age breach and its chase flag the same part a day earlier, on the due day itself.
**Coming up** is `txPendRM`: agreed, not handed over, money still to pay, an undated order dated by
`agreedOn`. A part carries `date`, `due`, `late`, `rm`, `whole` (goods and delivery), `product` (an
id, drawn as a mark), `qty`, `got`, `gotOn` (the last handover's day, one in stages included) and `resale`; a coming part `date`, `rm`, `product`,
`qty`, `toCome` and `resale`. A gift, a write-off and a row the statement has not reached (not agreed, and
dated after the day) count in none of them, so now plus coming is `owed` plus the
agreed orders it leaves out, less the write-off it still prints. The site draws them and
computes nothing.

**One live password a month, and it cannot be changed.** Each issue mints a fresh password per
customer and re-wraps their key under it, so last month's password stops opening anything the
moment the new issue publishes. There is no change-password control anywhere: a customer who
has lost his asks for it again, and it is read back from `_passwords.json`.

**Four things stand between an account and the public, and none is trusted alone:**

1. Everything a customer reads is AES-GCM ciphertext at rest under a **content key** of his
   own, derived from `STMT_KEY` and his username. The password's only job is to unwrap that
   key, and the wrap is made on the laptop, where the password is. That is what lets the deploy
   write a new live document in the cloud without ever holding a password. The site holds no
   key and could not read anything.
2. A PBKDF2 verifier decides whether the record is handed over at all.
3. Ten failed attempts lock a username for fifteen minutes. A username is random rather than
   a desk code, so it cannot be guessed from a roster, and an unknown username answers byte
   for byte as a wrong password does, so the list cannot be walked.
4. `STMT_MASTER`, a secret on the statements Worker, is his override. It opens any account,
   because each issue carries a second wrap of the key under it, made from the same passphrase in
   `_secrets.json`. The door is one field for each secret since S3 3.7 (his D3; two boxes and four
   from 16 Sep until then), and only the owner's page sends what is typed as a master, so the master
   still cannot be typed at a customer's door: the owner's list at `/all` fills it in for him.

### The secrets, and where each one lives

| Secret | Laptop | Cloud | What it does |
|---|---|---|---|
| `STMT_KEY` | `statements\_secrets.json`, `"key"` | GitHub Actions secret `STMT_KEY` | Derives every customer's content key. The same string in both places. **Lose it and every account is re-issued.** |
| `STMT_MASTER` | `statements\_secrets.json`, `"master"` | Cloudflare secret on the site | His override. The Worker compares it; the laptop wraps the key under it at issue time. |
| the passwords | `statements\<YYYY-MM>\_passwords.json` | sealed under `STMT_MASTER` as `pwMaster`, served only behind Access | One per customer, one live month. In the clear on the laptop alone (v688), and since v710 no message carries one at all. |
| a sign-in link | nowhere | KV `ot:<sha256(token)>`, 3 days (7 until his D1), one use | The content key wrapped under a token his page mints (v710). The token is stored nowhere, so the record opens only for whoever holds the link. Its page asks which account first (`peek`, spending nothing) and spends it on Continue; spent, the record answers the nonce of the page that spent it for two minutes (`RETRY_TTL`), its peek included, so a lost answer is tried again, from a reload of that tab too, and a second device is refused (S3 3.3). Continue also remembers the phone with the door's own split key, and the message says so and names the username (S3 3.4, his D1). |
| a remembered phone | nowhere | KV `rem:<sha256(token)>`, 30 days from the last open (S3 3.6; from the tick until then) | The content key wrapped under a key that never leaves that browser (v692). Filed under the token's hash since S3 3.1, so a copy of the store names no token; a record filed the old way is re-filed on its next open, keeping the end it had, thirty days from its tick, and never sliding, so a copy taken before then dies on time (S3 fix). |
| where an account is signed in | nowhere | KV `dev:<username>:<sha256(key)>`, as long as what it names | A pointer per remembered phone (`rem:`) and per session an open mints (`sess:<sha256(token)>`, a session being filed under its token's hash since an S3 fix, as a phone is), with `how` it came, `at` and `last` (S3 3.2); since S9 9.4 also per sign-in link and hand-over not yet opened (`ot:`, `ho:` with its code's record as `pair`, dropped when spent), and a device's pointer carries its name in the site's words (`label`, `kind`, from `deviceOf`), a remembered phone's the sessions it opened (`sess`, `was`), so it is listed once. Listed by the prefix, it is an account's phones and computers (`devicesIn`) on his account screen and the customer's This device card (`POST /devices` on their session), and what signs them out: one (`POST /all/signout {u, id}`), its alerts with it, since a `push:` record names the session and the remembered phone it was filed from (`sess`, `dev`), the customer's others (`POST /devices/signout`, sparing this phone and its alerts), or everything (`{u, keep}`, which also burns every link and code not yet opened, bar the one his page made and still holds unsent, named by its hash, and drops every alert, answering how many devices, links and codes, and phones, a link counted only once his page has shared or copied it (`out`, set by `POST /all/out`), and never kept then; a link made before S9 9.4 carries no pointer and is not reached, lapsing within three days of that deploy), never the account's own `u:` record; it names hashes, so it opens nothing. |
| `STMT_HANDOVER_KEY` | nowhere | Cloudflare secret on the site, set by hand (S3 3.9) | Keys the hash a hand-over's code and key are filed under and seals the wrap beside them. Unset, the hand-over routes answer 503. Changing it only strands the codes alive at that moment. |
| a hand-over | nowhere | KV `ho:<HMAC(STMT_HANDOVER_KEY, code or key)>`, 15 minutes, one use | The content key wrapped under a key the signed-in page mints, filed under the code and the key, sealed. The contract is below. |

`_secrets.json` is gitignored and looks like
`{"key": "<64 hex characters>", "master": "<the passphrase>"}`. An environment variable of
either name overrides the file, which is how the deploy gets the key. A run that would mint a
record and has no key stops before writing anything.

**The monthly issue runs on the laptop, not in a cloud session.** It needs the key to wrap and
it writes the passwords, and a cloud session has neither the key nor anywhere to keep what it
mints: a September run in a cloud container on 02 Sep produced thirty-seven passwords that
died with the container. The routine's job on the 1st is to say the issue is due.

**What none of it does is stop a statement being forwarded.** A password shared is a password
shared, and an open page can be photographed. Log out is what ends a session on a phone left on a
table with an account on it. Nothing in the copy should promise more than that.

**The address shares the account's `workers.dev` subdomain with the desk**, which is the one
thing a curious customer could still notice. A custom domain on the statements Worker is the
fix: a `routes` block in `wrangler.stmt.jsonc`, and `SALT_BASE_URL` (or the default at the top
of `tools/make_statements.mjs`) changed to match before the next issue, since the QR carries it.

**THE GUEST LINKS ARE FIVE, ONE FOR EACH TIER** (v696, his instruction of 18 Sep 2026: "for the
guest links, produce exactly 5 links, for the five tier pricing"). The five levels a guest may be
quoted are Titanium, Platinum, Gold, Silver and Bronze; Ambassador is the floor and never a guest's.
A standing link carries its `level` and `standing: true`, and `ensureStanding` in `stmt/refs.js`
makes the missing ones on Salt Admin's first read of its links (Needs you or Links): **ensured, not minted on a tap**, so
the answer to "what are my links" is always exactly five and there is nothing to remember. It is
idempotent, and a level that already has one keeps the id it was given, because an id handed to a
stranger must never change what it opens. The level names travel from the book to the Worker as the
KV key `tiers`, written by every publish; with no names to hand it makes none rather than inventing
five. Each standing board is `tierBoard(level, ...)` in `tools/pricelist.mjs`, which is `boardList`
with the level pinned, so there is one definition of what a board is.

**A STANDING LINK READS ITS LEVEL'S BOARD, NOT ONE WRITTEN UNDER ITS OWN ID** (v699). The publish
writes `tboard:1` to `tboard:5` on every run, and `handleGuest` resolves a standing link's level
against the `tiers` names and reads that key. v699 closed a hole v696 left in its own shape: the
five are minted the first time his page reads the links, so any minted since the last publish had no
board of its own and fell back to `board:2`, which is the LAST level; four of the five would have
quoted Bronze until the next deploy. A level's board does not depend on which link points at it, so
nothing is published per standing link and minting one can never be wrong. `tboard:` and not
`board:`, because `board:2` already means the last level and not the second. A link that names an
INTRODUCER still reads its own `gboard:<id>`, because that one does depend on who handed it out, and
still falls back to `board:2` when it was minted since the last publish.

**THE PUBLISH RUNS ON EVERY RUN BUT THE KEY PROBE** (v701, his question of 18 Sep 2026: can the
publish be on any trigger?). It can. It needs nothing the job produces: it reads `ledger/book.json`
and `master/salt_command.html` out of the checkout, never `public/`, so it depends on neither the
fold, the build nor the deploy, and the checkout, `setup-node` and `npm ci` above it are themselves
unconditional. `cloud-commit.yml`'s `plan` step carries a third output, `publish`, which is 1 unless
the run is a `probe_key` dispatch; the publish step reads it instead of `deploy`.

**The rule states what is EXCLUDED, not what it is on.** A list of events goes stale the moment a
trigger is added, and that is exactly how this broke: it was gated on `deploy` alone, a bare
scheduled tick sets `deploy` only when rows were actually folded, and so on a quiet day the sealed
lists were never refreshed at all while both this doc and his instruction said a price always
follows the desk. v699 added `schedule` beside `deploy`, which fixed that day and left the same
shape of bug standing for the next trigger. One exclusion cannot go stale. It is placed after the
fold and the deploy in the step list deliberately, so a run that folds publishes the NEW book. **A run that did not deploy passes `--no-retire`** (`planPublish`'s
`opts`): every sealed list, board, roster and report card is rewritten, and no account is retired,
because retiring one whose record the newest issue does not carry is a judgement about a deploy he
made, not about a clock or an approval, and a partial issue read would otherwise take accounts down
on every tick rather than once. `GET /all/refs` returns the
five in the LADDER's order, then everything else newest first. Links minted against a customer
(v658) still work, still follow their introducer, and sit below the five on the panel under their
own heading.

**A PRODUCT IS A MARK, NOT A WORD** (v695, his instruction of 18 Sep 2026). "The products are only
written as a symbol, the golden cube outline as salt and another one, golden water droplet outline"
for oil. `PSYM` in `stmt/page.js` holds both paths and `psymSvg` draws one; the client script gets
the table through `__PSYM__` and draws its own with `createElementNS`, so nothing is loaded and the
mark takes the ink it sits in (on a brass button it is the button's own, or a brass cube on brass is
no cube at all). A product with no mark of its own draws the **ring** rather than nothing. The order
form's product dropdown became a **segment of marks** (pressed ghosts in the order sheet since S4), because
an `<option>` carries text and no drawing. A control holding only a mark is named by its **shape** (`PSHAPE`: Cube, Droplet, Ring) and
never by its product, so a screen reader is told what is drawn rather than what it is.

**The one name on the site is the app's.** The manifest, the `<title>`, the iPhone app title, the
sign-in link's page and the Keep it on your Home Screen card all say **Salt Counter** (v704, his instruction of 18 Sep 2026; it went Order Salt,
then The Counter, then his own name for it). The icon on a customer's home screen has to say
something: it is the ONE place on this site where something is called something, and the product
word is his to spend there. Inside the page a product is still a mark and never a word. What never
appears is the DESK's name. Twelve characters exactly, which is what iOS gives a home screen. The statement's letterhead, the last
place Salt Command appeared on a customer's page, is gone: `brand` is null for the live statement
and every new issue, and a statement with no brand carries no eyebrow rather than an empty one.
Issues already sealed keep the letterhead they were issued with until they are re-issued.

### The hand-over: a key and an eight-symbol code (S3 3.9, his decision D2 of 24 Sep 2026)

An iPhone's Home Screen app keeps its own storage, so what Safari remembers never reaches it. A page already
signed in (or Salt Admin, for a customer at his counter) hands the sign-in across: a long KEY for Paste and for
`/app#<key>`, and an eight-symbol CODE to type. Mechanism: `stmt/signin.js`; the door: `handleHandover` in
`stmt/worker.js`. **The contract the Counter codes to:**

| Route | Takes | Answers |
|---|---|---|
| `POST /handover` | a live session (`X-Stmt-Session`) and JSON `{token, wrap}`: `token` a key the page mints (24 random bytes, base64url, the shape of a sign-in link's), `wrap` its content key wrapped under it exactly as `wrapUnder(new TextEncoder().encode(token), ck)` wraps | `{ok, code, token, exp, qr}`: `code` eight symbols of the username alphabet as `xxxx-xxxx`, `token` the key sent, `exp` ISO, fifteen minutes on, `qr` a data URI of `<site>/app#code` alone (S9 9.9), which opens the code screen in a browser's own words on any device. 401 with `session:false` with no session; 400 without a key of that shape and a wrap |
| `POST /handover/open` | JSON `{token}` or `{code}` (case, spaces and hyphens forgiven; `token` wins where both are sent); `tab: true` beside a token a browser tab found in its address, which opens only a key his `/all/handover` minted and refuses any other unspent | exactly what `POST /open-link` answers (`u`, `wrap`, `session`, `env`, `live`, `prices`, `card`, `assoc`, `issued`, `issues`, `remembered: true`) **plus `token`**: the page unwraps `wrap` under `token`, the one in the answer, whichever it typed. Both names are burnt. Every refusal is the door's one (401); a brake is the door's (429) |
| `POST /all/handover` | behind Access, JSON `{u, token, wrap}`: his page opens the account under the master and wraps as above | `{ok, code, token, exp, url, qr}`: `url` is `<site>/app#qr.<token>`, the QR's own form, `qr` its rows of `0` and `1`; the record is marked his |

- **Mint when the sheet opens, copy in a tap of its own**: the derivation and the fetch are never in the tap that
  copies or shares (the judges' must-not-ship list).
- **Keyed and sealed**: filed as `ho:<HMAC(STMT_HANDOVER_KEY, "code:" + code)>` and `ho:<HMAC(..., "key:" + token)>`,
  each holding the other's name, `exp`, and the username, key and wrap sealed under AES-GCM keyed from the same
  secret. Eight symbols are 39 bits: never a plain hash.
- **A code is braked** per address (`hofail:<address>`, a v6 address by its /64, ten misses) and site-wide (`hofail`, a
  hundred), fifteen minutes each. A miss is any refused code; a success clears nothing. A key is neither braked nor
  counted (192 bits, as a link's token is), so a flood shuts code sign-in for everyone for fifteen minutes and no other
  door, the key included (S3 fix). JSON only, as `/open`.
- **What the brakes are worth: they bound time, not guesses.** Each count is a KV read then a write, not atomic, and KV
  takes one write to a key a second (a refused put is swallowed), so under a flood the site count rises about once a
  second and cannot trip for the first 100 to 160 seconds; the per-address count lags the same way. The safety is the
  space: 30 to the eighth is 6.6e11 codes (39 bits), so the 1.6e5 guesses 1,000 a second makes before the brake can
  trip find a given live code with odds of 2.4e-7, and 10,000 a second 2.4e-6. A code cannot be walked inside its
  fifteen minutes. An atomic count waits for a Durable Object.
- **Log out burns them**: `POST /logout` takes `handover`, the keys the page minted (ten at most), and deletes both
  records of each unopened, so a key left on a handed-on phone's clipboard or address opens nothing (S3 fix).
- **A code open is an open**: `seen:` says `code` or `key`, and its session leaves a pointer (`dev:`).
- The same two limits as the link: a bearer credential inside its fifteen minutes, and one use best effort on KV.

### This device (S9 9.9, his D2)

Drawn by `drawDev` into Account's This device (`#devSlot`), once signed in and never on his read-only view; its
Turn off (`drawDevice`) also sends `POST /push/unsubscribe {endpoint}`, which drops that phone's own record. Its
phones and computers (`POST /devices {token}` on the session, `token` this phone's own
remembered one, answering each device's name, `at`, `last`, `kept` and `here`, no id and no address), read in the background, so a lapse it meets
says Sign in again on the card and leaves the reopen to the next tap, and drawn again once
the phone is kept; **Sign out other devices** on a second tap (`POST /devices/signout {token, endpoint}`, sparing this
one, its sessions and its alerts); and **Sign in another device**, a Sheet that mints the hand-over as it opens, Copy
the code a tap of its own, and a QR of `<site>/app#code` for the other device's camera, which opens on the code screen in a browser's own words on any device; closing the Sheet reads the list again. **The QR never carries the key**: a
key in an address signs a browser tab in only when his counter minted it (S3), so an address one customer sends
another never signs the other in; the other device opens Salt Counter from the QR and the code is typed there. This device's
first row is how to keep it as an app (S3 3.10), a Plain ledger row where it was a card at the head of the tab.

## The price list and the order book (06 Sep 2026, his instruction)

Three things sit behind the one password since v499: the statements, a **price list** for
the week, and an **order**. The page shows them in PLACES once the password has opened the record (S7 7.1, his
D11 of 24 Sep 2026; three tabs and a fourth until then): **Home**, which opens first, **Prices**, **Orders**, **Account**
(the statement and This device, whose Sign out is the one Log out) and **Rewards** for an associate. They sit on the system's App bar
at the foot of a phone and on its rail from 1080px. A place keeps its tab's id (`stmt`, `order`, `card`) and has an
address (`#home`, `#prices`, `#orders`, `#account`, `#rewards`): a tap writes it, over an empty address or a place's
and never over a key, and a sign-in opens the place it names once. `placeShow` is the one road between them; a
banner's `#o=<id>` still opens Orders at that order. **Home** reads To pay now (S6 6.2, `drawPayHead`: the sealed
figure, its one filled Pay opening the pay sheet, the claims waiting, each overdue part, and over the line the overdue
amount first; Orders is then the payment page), Needs you (a reply not yet shown on this device, goods ready to
collect, goods with them unpaid) and Coming up (an order agreed or sent and not handed over, then any sealed part no
order accounts for, `comingParts`) and **Order again** (S7 7.4): a tile a size, way and place they have
ordered, while the size is on their list, at today's price, whose tap opens the check with them, so the second tap places
it; a new account is offered its list's first sizes, and nothing is offered over the line. A new account opens on Welcome
and "Nothing on your account yet". Nothing about the statements changed.

**THE CUSTOMER SEES NO LEVEL** (S4 4.10, his D11 of 24 Sep 2026, reversing v659's "a very subtle tier
level, in symbol and colour"). Prices drew a glyph in the level's colour beside each product (`MARK`, v659
to S4); it is gone, and nothing on the page reads the level. The name still travels inside the sealed list,
as it has since v651, and the suite holds two lists differing only in level to the same Prices, to the
character.

**AND THEY ARE GREETED AS PERSONALLY AS THIS SITE CAN** (v659, the same instruction). The hour is
theirs, off their own device, so Home's heading is Good morning, Good afternoon or Good evening
(S7 7.1; Prices opened with it until then), and under Prices' week line it says the month their first priced order falls in (`since` in
`tools/pricelist.mjs`, on the same rule the rate uses: a cancelled row, a defaulted one and an award
with no cash are not orders they placed at a price). **No customer's name is used, because none
exists anywhere this site can reach**: hard rule 2 keeps plaintext names off the cloud and
`tools/make_statements.mjs` builds every statement from codes alone. Sealing a name into the
customer's own ciphertext would be possible and is HIS DECISION TO MAKE, not one to drift into: it
would put names, encrypted, into the committed `_kv` records, where today there are none at all.

**The price list is a second sealed document beside the live statement.** The deploy writes
it in the same publish, under the same content key, so the site still holds nothing it can
read. `tools/pricelist.mjs` is the whole rule: the customer's rate on a product is the BEST
unit rate of his last four committed orders of it (v655, his decision of 16 Sep 2026; it was the
median until then), read from orders dated before the week's
Monday in Kuala Lumpur, so the rate he is shown cannot move inside a week. Since v651 (his
decisions of 15 Sep 2026) each board size is the price of the customer's tier for that product, the
tier held on the book or proposed from what they pay for it, never above that rate times the size to
rounded DOWN to the ten and never up (v660), and lifted only to clear the floor: the engine's
`cardPrice`, which the desk's printed board calls too, and the suite holds the two equal. The v510 draw toward the ask retired
with it. **A product with no tier, held or proposed, is not priced**: the list carries it in `soon`,
the page says its price is coming soon, and the order sheet does not offer it. One
price per size, for the goods (v502): delivery is not on the list. It is a figure
he types **when he acknowledges the order** (v694; it was at ready until then, and the order becomes
a row at the acknowledgement, so the charge has to be settled there), the customer sees goods plus
delivery as the sum to pay, and the sale carries it as its own field, `delivery`, inside the total. A customer
with a tier and no history on a product sees the tier's price. Nothing outside the
engine prices: the publish opens the master in jsdom for the desk's PRICING inputs (the same the
drafter reads), which carry each customer's tier and the ladder, and calls `floorTotal` and
`cardPrice`. `node tools/pricelist.mjs --show <CODE>` prints what
a customer sees. `--no-prices` on the publish leaves the list out.
**The list's stamp is a digest of its figures** (S4 4.1), never `prices.at`, which the hourly publish moves:
`priceDigest` in `tools/pricelist.mjs`, keyed under `STMT_KEY` over the username and each product's sizes and
prices, sealed inside the list and in the clear beside it as `prices.digest`. **Place carries the stamp of the
list the page opened** (4.2): one that differs from the record's is answered 409 `prices moved` with the record's
sealed list, after the request id and the order's own checks, on both roads. The page sends the field on every Place,
empty included; a body with none is a page loaded before the stamp, which cannot re-quote, and places as it did. The
site compares stamps; it prices nothing.

**The order lives on the site, in its one Durable Object** (`stmt/orderbook.js`; S10, his answer
to D10 of 24 Sep 2026): every move an event appended under its id, the order the fold of its
events, and the shared and chase marks beside them, one transaction a move, so no writer can erase
another's. It was `order:<username>:<id>` in KV, read and written back whole by three writers, and
the study of 24 Sep played six erasures through that; the suite replays them on both roads. Plaintext,
and the reason is stated in `stmt/orders.js`: it is written at runtime by the customer and the site
holds no key to seal it with. It carries a size, a quoted total and a state; no name, no code.
`/open` mints a **session** on a correct password (fifteen minutes; the page forgets it when it
locks), and the order routes take that and nothing else. The states: placed (the customer),
acknowledged (the owner: agreed, the delivery charge set, and the row queued), ready to collect or
deliver (the owner), done (**neither side's tap**: what the record reads once both tracks are
complete), declined (the owner), cancelled (either side, at any stage until the goods move, and never while a claim of theirs waits on him). **A short
order he closes at what was handed over** (S11 11.9) is restated there: the size becomes the units handed
over, the goods' total follows at the agreed rate, the old figures kept as `closed`, and its row is a
Correction whose new total renames it.
**The customer reads them in their own words** (S5 5.3, his answer to D11): Sent, Confirmed, Ready to
collect or deliver, Collected or Delivered once the goods are all with them, Complete, Not taken,
Cancelled by you or by us; "units" above one; and every refusal of a move of theirs says it so. His
reason for a decline or a cancellation (S11 11.7) follows its word, on the order and in its history; a
close short says on the order and on its Goods line what was handed over of what was ordered.

**THE ORDER IS A SHEET** (S4 4.3, his "all recommended" of 24 Sep 2026). New order lays the system's Sheet
over the page: the product as its mark, the sizes as Option tiles with their prices, the size they order
most tagged *your usual* (read off their own orders on the page), the way and the place as last time, a
folded note, and the total with Review in the foot. **Review freezes one copy of the order** with its
request id: the check draws that copy and Place sends it, and while the check is open the sheet holds no
field, so nothing typed can reach the order unseen. Units above one, unit at one, a guest's board included (one `unitsOf`). A 409 `prices moved` (above;
S4 4.4) brings the account's list as it stands, sealed, which the page opens with the key it already holds
(`openList` keeps it on the list, unenumerable) and draws in the check: "This size is now RM X (was RM Y). Place at RM X?", one tap, a new request id; a list with nothing left to order, or none, is taken as a sign-in takes it, and the check says so with Place held. The page reads the figure off
the list; it compares and prices nothing. **Sent answers in the sheet** (S4 4.5) and asks "A buzz when it is
confirmed?", put only by the tap on Turn on notifications (nothing is asked on the way in since S4, where v693 asked; a sign-in files a phone already on again); See the order
closes the sheet and opens the order's own screen (S5 5.2). New order stands above Your orders, stage 5's rows, at the head
of their column, so on a desk the open order beside it starts at the top of the place and the Notifications pane is left to
Account's This device (S7-R3); on a desk,
while it stands beside an open order, that order's Pay is the lit ghost, one filled control a screen, and Pay is filled
wherever nothing else is (the limit in New order's place, the payment page, a phone). **Five open orders are said before the form** (S4 4.6; `MAX_OPEN` is exported from
`stmt/orders.js` and carried into the page, the Worker still the one that refuses): the Order tab says so in place of
New order, and the sheet opens on the open orders, each in stage 5's word for it (goods handed over in part say so),
Cancel on each whose goods have not moved, going on to the form once
one is gone; a refusal those orders explain turns the sheet to the same list. **Every size on Prices is one tap to
the sheet at that size** (S4 4.8, rows of the plain ledger), and the list says **"Prices as at Thu 24 Sep, 11:59"**
in Kuala Lumpur off its own `at`; a list sealed without one keeps "For the week of". **One delivery sentence**
(`DELIVERY` in `stmt/page.js`, S4 4.9) wherever the charge is explained: Prices, a delivery's check and a guest's
board: "Delivery is charged by area. We tell you the charge when we confirm, before you pay, and you can cancel then
at no cost."

**A RETRY LANDS ONCE** (24 Sep 2026). Every move the page sends carries a request id it mints per
tap (per review, per payment, per line, per withdrawal, per rail; S10 10.4), kept with that move until
it is recorded. On the KV road Place and I have paid are the ids honoured: the site files
`rid:<username>:<rid>` for a day naming the order and answers a repeat with that order, changing
nothing, best effort. On the object road every move is an event filed under its id for good
(`stmt/orderbook.js`), so any repeat is found for certain. **Across the switch too**: the move-in files every
live `rid:` key in the book, and in the week of reading both a placement's and a payment's id is filed at
`rid:` as well, so a retry lands once whichever road it meets.
**The order's own put decides the answer** on the KV road: what is written after it (the shared marks
`last-placed`, `last-touched`, `last-said`, `last-theirs`, and the request id) is best effort, logged
when KV refuses it, so a stored move never answers as a failure. A lost mark costs a wake, not a stage.
In the order book the event, the order and the marks are one transaction.

**THE SWITCH AND THE MOVE-IN (S10 10.3).** `ORDER_STORE` in `wrangler.stmt.jsonc`: `object+kv` is the
week of reading both (the book holds the orders and is the one writer of their KV keys: its alarm writes
each order it changes a second later, moves inside a second as one write, and a write KV refuses again a
second after; a read the book cannot answer is read from KV; a move it cannot take answers 503 and is
written nowhere); `kv` is the old road and the way back, KV a second or so behind the book, and the alarm
still writes what is pending after the flip; `object` stops the KV writes. The first request after the deploy that sets it **moves the book in, once**: every KV
order and the shared and chase marks copied in, then **a minute in which every move answers 503 "try
again in a minute"** (reads from the copy), so a Worker still on the old code during the rollout is the
only writer, then a second copy of whatever KV says differently, and moves are taken. KV is only read.
A copy's id names `ORDER_MOVE_IN`'s generation, the pass and the order, so either pass run again appends
nothing; raise the generation by one only to come back from `kv`, and it takes what the `kv` road wrote.
**Forgetting that is safe**: every order the `kv` road writes while the book is bound marks KV
`orderbook:road`, and the book's first request that finds a mark later than its own move-in moves in again,
a round of the same generation (`<gen>@<mark>`). A KV record the book has already held is behind it, so the
book keeps its own and writes it behind. Either pass takes the later of KV's and the book's shared and chase
marks, and his test account unmade on the `kv` road is dropped from the book as well, so a return does not
bring its orders back.
**The hourly check** (the site's cron, `checkStores`) is the book's own: each KV order compared with what
the book holds at that moment, and nothing written by the check. KV behind with the book's write on its way
is `pending`; behind with nothing on its way is `repaired` (the write behind asked for again); **a record the
book never held is `kvAhead` and left as it is**, the write behind leaving it too, since it is the only copy of
somebody's move; `kvOnly` and `bookOnly` name an order one side lacks, and leave it. **While the book moves in
the check stands down** and writes nothing, and a chase in that minute marks its slot on the KV road, which the end pass
takes in. The result is kept at KV `orderbook:check` with `cleanSince`, the start of an unbroken run of hours
with `repaired`, `kvAhead`, `kvOnly` and `bookOnly` all empty. **Seven days after `cleanSince` is a clean week**: then `ORDER_STORE` goes to `object` (10.5,
whose deletion of the old keys is not built).
**The customer is handed a view, not the record**: their order list and every answer to a move of
theirs carry `customerView` (`CUSTOMER_FIELDS`, a whitelist), never `ledgerKey`, `queued` or `sync`; `rowOn`, the day the
key names, is read off it so the page can tell which part of To pay now is the order's.

**A DELIVERY SAYS ROUGHLY WHERE IT IS GOING** (v694, his instruction of 18 Sep 2026): `place`, one
line of at most sixty characters, a neighbourhood and not an address, refused empty on a delivery and
dropped on a collection. It is shown on his card and **never rides into the ledger row's note**: a
note reaches the committed book, and free text a customer typed is the one thing here that could
carry a street. **Nothing is placed on one tap**: the page reviews the order in words first.

**AN ASSOCIATE SEES THEIR OWN CARD, BY MONTH, FROM THE START** (v706, his instruction of 18 Sep
2026). `associateCard(w, code)` in `tools/book.mjs` builds one associate's own document off the same
jsdom window the prices come from, so a card and a price can never be struck from different states of
the book. `liveRecords` seals it as `rec.card` under the same content key as the statement, and only
for an account the report card names; both doors hand it over, `/open` and `/remember/open`; the page
carries a fourth tab that appears only for an associate.

**Rewards opens on the links** (S8 8.1, his "all recommended" of 24 Sep 2026), then the card, each book's
reward first in units with the system's Meter. Each link says its state in a word in the system's chip
(Waiting, Open, Not approved, Withdrawn), when it was made and what it has done; only an open one shows its
address, **Share** and Show the QR. **Share is minted before the tap**: the address comes with the list
(`GET /my/refs`), so the tap hands it to the share sheet as its first act, nothing fetched between; with no
share sheet it is Copy link. Make a link says, before the tap, that the link stays shut until he approves it.
`drawRewards(el)` draws the place into el.

*It is a different document from his.* `associateSnapshot` is his view of EVERY associate and is
served only at `/all/assoc`, behind Access. Two functions rather than one, deliberately: the two
audiences differ, and the whitelist that guards his card would have had to widen to carry dated lines.

*What is left off, and why.* `share` is a ratio against the WHOLE book's revenue, so an associate
holding their own RM and their own share can solve for his total; `stars` are bands of that same
share and give a range of it; `rank` is a position among other people. None of the three is theirs
to know and none is needed to tell them what they did. The reward is in UNITS, with the distance to
the next as a **share of one unit** drawn as a bar, because the unit itself is a margin figure. No
margin, no cost, no floor, no other party's name.

*Every figure adds up to the list under it.* The lines are struck off `pricedSales`, the same basis
as the summary, and `onward` counts the onward LINES rather than `dsResell`, which counts every R2
row including the pending and the cancelled and read 14 above a list of 10. That is the v385 lesson:
a figure a reader can disprove by looking six lines down is worse than no figure.

*By month, from the start.* The lines are dated and the page filters them with a strip in the same
shape the statement's uses (v690): newest open, All one tap away, and the position above does not
move with the filter. The month pills are a real tap target now; `min-height` was `auto`, so every
month pill and every issue pill had been 29px tall since v690, on strips whose whole purpose is to
be tapped.

**AN ASSOCIATE TICKS AN ORDER AS ON BEHALF OF A FRIEND** (v703, his instruction of 18 Sep 2026).
Their own orders and the ones they place for somebody else can no longer be told apart by what they
buy, so they tick it; the words are his, and they replaced an earlier phrasing he rejected. The tick
is drawn only for an associate, rides the placement as `forFriend`, and is stored on the order. Since S4 4.7 it is the
order sheet's first question, **Who is it for? Me / A friend**, neither chosen and asked on every order: Review waits
for the answer.

*Who is an associate* is the desk's own answer, never a second one: `planPublish` reads the report
card snapshot's `products[].rows[].id` and marks that account's record `assoc: true`. The mark is
**in the clear**, beside `issued` and `issues` which already are, because the page must know whether
to draw the tick before a password has opened anything sealed, and what it says is that this account
MAY order for somebody else: not a figure, not a name, not a fact about the book. Both doors hand it
over, `/open` and `/remember/open`, or the tick would vanish the moment they stopped typing a
password.

*Where it books.* A ticked order goes to the associate's `<CODE>-R` bucket exactly as a
phone-entered downsell does. `pendingEntry` carries `stream: "R2"` and `assoc`, which is the shape
the drafter already takes, and **the engine's own `bookR2` does the booking**: a second copy of that
rule would put two kinds of downsell in the book. **The `orderKey` is built on the BUCKET**, because
that is the party the fold writes, so every later stage, a payment, a handover and a withdrawal,
finds the row; built on the associate's own code they would all miss it. The site checks nothing
here, holding no roster and knowing no codes: it records the claim and the desk decides, exactly as
it does with the quoted total. An associate with no bucket on the roster is refused by the drafter.

**MONEY AND GOODS ARE TWO TRACKS** (v694). `payments[]` is what the customer says they
sent and `paid` what he has received (S6), `moved` and `movedOn` what he says he handed over, and either may lead. Payment is offered
**from the acknowledgement**, in **one pay sheet for every Pay** (To pay now, an order, the held page;
S6 6.4, his D8 as amended): the figure and what it is for, All or Part, then two ways, Transfer or Scan
a code, Transfer chosen as it opens (the way, never the account), **with no account chosen for them**: they choose,
one Option tile a tap, which of his accounts to pay into from those
`payHref` links, a suspended one never offered, and their username is the reference. Show the account
number, or Show the code, hands over one link into QR Command, which the Counter never names or carries
a number of. **On return the sheet asks once** (S6 6.5, his D7), and after a reload too (kept on the device two hours as
`salt-stmt-payq`, never the username): "Did you send RM 70?", with Not yet, never a tap
beside the number; Yes posts a CLAIM (an order's to `/orders/<id>/pay`, To pay now's to `/account/claim`), which
reads "sent, waiting for us to confirm" on the order, its row and To pay now until his Received or Not found, each
shown when it comes; Pay then asks only for what no claim covers, **never the same money twice**: To pay now nets what was
sent on an order whose row is one of its parts (matched by `rowOn` and the whole figure), and the order nets what was sent
against the account that reaches its row, the parts walked oldest first as `claimAlloc` takes them. The accounts it may name are `stmt/pay.js`, generated from the pay master by `node tools/paysync.mjs --sync` with no
number, payload or reference shipped. **`payHref` in it is the one link builder** (D8, 24 Sep
2026): `#<key>/<rail>/<amount>/<reference>`, Transfer or Scan a code, the figure to the sen, the
username as the reference, and "" for anything QR Command would not open. It reads only `PAY_SITE`
and `PAY`, the names `CLIENT_JS` declares, so the page carries `payHref.toString()` as it is. The suite reads the link
back through QR Command's own `linkOf`, so a format change ships there first. **The customer types
what they sent, and it is a CLAIM** (S6 6.5, his D7; the site takes no money and no rail tells it anything): an entry on
`payments[]` with `claim: "waiting"`, summed as `claimed`, never `paid`, until his Received (a `verdict` event naming the
claim by its moment) makes it paid. Claims accumulate; together with what is paid they may not pass what is owed; a claim
in cash is refused, cash being his to record. Each claim is queued as its own Fulfilment, flagged `claim` and stamped with the
claim's moment (`claimsToQueue`, `claimEntry`), and Approve neither approves nor rejects it: it is answered on its card.
**A claim against the ACCOUNT** (S6 6.6) is for money owed on rows he entered on the desk, which have no order to claim
on: `POST /account/claim` (or `/claims`) `{amount, method, account, rid}` on their session, its own record and never an
order (`acl` in the order book, `aclaim:<username>:<id>` on KV, written behind and moved in as an order is, id `a` and the
moment), riding beside the orders on their `GET /orders` as `claims` (`claimView`: `state`, and `claim` holding the same
word) and on the desk's as its own list (`GET /desk/claims`). A waiting one pauses the chase on every order of theirs.
**His answer reaches them** (S6 11.14): Received wakes them "Payment received" (or complete); **Not found** files the
claim's row rejected as `notfound` FIRST, under the id it has or will have, and drops it from every queue, then the site
takes it as ONE event of the order book: the claim leaves `claimed` and its entry's name leaves the claim together, paid
never having moved, and the wake says "Payment not found yet" (`notfound` in `NEWS`). **On the kv road Not found is
refused** (`NOT_FOUND_ON_KV`), a figure that falls never being a read-modify-write. A claim not found is never offered again,
and a Received on a claim whose row was filed not found is refused. **Received, on the book already** answers a claim
that money he recorded another way covers (more than the order still owes, or than the account's rows owe): filed as
`covered` the way Not found files it, one event, the claim received with paid unmoved, the wake Payment received. **A claim against the account is received row by
row** (S6 11.15, D6): the desk Worker drafts the engine's oldest-first allocation (`claimAlloc`: their rows and their
bucket's with goods out and money owed, by date, each to what it owes, less the money already on its way to it: a claim
on its order waiting or received, cash not folded, another account claim's booked row) as one Fulfilment a row, against the mirror and
stored nowhere (`POST /claims/<id>/preview`); the card draws it, and Received sends the digest of the rows drawn, which the
Worker approves only if the rows still stand, each with a yes of its own spent by the drafter (`madeBy` reads `claimId`),
then tells the site. More than the rows owe is never a tap. An order claim's Received is refused on a row an account claim
booked and no fold has landed, so no money is booked on a row twice. **Cash on handover is withheld** from anyone holding an unpaid advance on any live
order, the one being paid included: settling that at the door is how one advance becomes two. It is an
order sheet's third way (S6 6.8), never To pay now's, shown dashed with that reason where withheld;
choosing it sends no figure, because he records the cash when he takes it. The quote is the customer's claim
off his own list: the owner reads the rate against the party's usual on the phone before
acknowledging, and the drafter flags it again when the row is queued.

**The desk reads and moves orders through a service binding**, `STMT_SITE` in
`wrangler.jsonc`, sending `STMT_DESK_KEY`, a secret the same on both Workers. The direction is
desk to site only; the site has no binding, no key of the desk's and no route back. The
Site orders card in Enter (cloud desk) is the taps.

**AN ORDER REACHES THE BOOK IN STAGES, AND NO TAP WRITES** (v694, his instruction of 18 Sep 2026;
it reached it once, at the end, as a sale paid and delivered in full on the day). **Site orders moves
the ORDER; Approve lands the ROW** (since D6 a tap on the card can be that approval, below). The desk's
every-minute cron runs `reconcileOrders`, and it is the ONE road that queues a stage the site makes, so
a stage cannot be queued twice by two roads racing (Accept's pending row is the desk's own, below):

| Stage | What is queued | Why that kind |
|---|---|---|
| Acknowledged | a `new` SELL, delivery inside the total, `cash` 0 and `kg` 0 | the row appears as **Pending**, which is the truth |
| A payment | an `amend` **Fulfilment**, the INCREMENT since the last one | a Fulfilment accumulates cash and units |
| A handover | an `amend` **Correction** stating the running total, `deliveredOn` and `handover` | only a Correction may set when and by whom, and it states rather than adds |
| Closed at what was handed over (S11 11.9) | an `amend` **Correction** stating size, total (the engine's `closeGoods`, which the desk states and the site only range-checks; the rate awaits his word), `deliveredQty`, `deliveredOn` and `handover`; `ledgerKey` then moves to the key the new total makes (`closedKey`); rejected, the close gives it back, and offered again moves it once more | one entry states the handover and the restated row together |
| Cancelled or declined | an `amend` **Cancellation** | the fold raises any refund itself |

**Which row a later stage amends.** A `rid` is minted at fold time and there is no route from the
desk back to the site, so the site can never learn it. The desk writes the other identifier the
drafter takes onto the order at the acknowledgement: `ledgerKey`, which is **the engine's own
`ovKey`**, `party|date|total`, the total as the row carries it (written with `toFixed(2)` it misses
every row by two noughts, which is what driving the chain end to end caught). The site records what
has been told in `queued` (`ack`, `paid`, `moved`, `cancel`) and `orderWork` reads the difference;
that is the one place a stage is decided owed.

**An amendment waits for its row.** The pending row reaches the book by the long road: queued,
drafted, approved, folded, mirror re-seeded. Until `OPEN.byKey` carries the key, the reconcile holds
the amendment rather than queueing one the drafter would refuse, so a customer paying early puts no
refusal on his phone. A mirror that cannot be read holds everything.

**ONE TAP A STAGE, ON AN EXACT MATCH** (S11, his decision D6 of 24 Sep 2026). The card's taps approve
the row they make, in the desk Worker, and only if the real draft equals what he was shown. His yes is
a row in `preapproval` (`migrations/0011`): the digest of what he saw (`stageDigest` in
`src/drafter.js`), spent by the drafter the moment the row is drafted (`preFor`, `applyPre`): equal, the
row is approved where it is drafted; different, it waits under Approve, marked "differs from what you
saw" with what he was shown beside it (`GET /drafts` carries it as `preapproval`), and a yes is spent
once. **Accept** (`POST /orders/<id>/accept {delivery, hash}`) answers a preview (`POST
/orders/<id>/preview`, which drafts the row against the mirror and stores nothing): it drafts again,
refuses with the fresh preview if the digest moved, records the yes, queues the pending row itself and
runs the drafter; the digest covers every field of the row, every flag and the pricing version (the
snapshot's `v` and a digest of the rest). **Only an approved row moves the order** (`ackOnApproval`:
the key and moment marked first, then acknowledged with the charge), so a row that differs leaves the
customer reading Placed, and his approval under Approve moves it then. That is the one stage the desk
queues itself, because the row must exist before the order moves; `deskPass`, beside the reconcile,
follows it up each minute: it spends a yes a fault left waiting on its drafted row, and tells an order
its approved row again until `acked_at` says it was told. His approval under Approve spends any yes behind the row.

**The later stages are one tap too** (S11 11.12): **Collected or Delivered** (`/handed {qty, close}`,
the running total, in the order's own mode; `close` under the size is 11.9's close, previewed as the one
Correction it makes, `closeEntry`, and offered again as Collected's; a close under what they have paid carries
no yes and waits under Approve, since nothing books the difference as a refund yet), **Received** (`/received {amount}`, their recorded payment
in his bank; the site already counts it) and **Cash received** (`/cash {amount}`, money taken at the
counter: the site's `cash` event marks the order paid at once, in cash and as his, which stops the chase,
and moves the ledger's mark of the money by the same figure, because the Fulfilment is the desk's own
entry, `counter: true` and `by: "desk"`, queued by `deskPass` once the row is on the book; the bare move
route refuses `cash`, and the tap is refused while a payment of theirs still waits to be queued). Each builds its
entry as the reconcile will, drafts it now, or before the first row lands against the book as it will
stand (`withPending`), and records that digest; the drafter spends it when the real row is drafted, only
if the kind, party, target, date, figures and every flag are equal (no pricing version: the first row
landing is itself a fold). **Such a stage never waits silently**: the answer carries `waits` and "Booked
when the first row lands". A Received on a payment already drafted is tested at the tap.

**A rejected row is offered again** (S11 11.13). His Reject on a site-made draft is written onto the
order (`sync` rejected) and spends any yes waiting on it, and the move is offered again under a FRESH
entry, a new moment and so a new draft id, the rejected id being refused for good: the stage's own tap
(Accept on a pending row, against its preview and the charge the order already carries; Collected,
Received or Cash received at the rejected figure) or `POST /orders/<id>/again {stage}` (pay, cash, move,
cancel). The fresh entry keeps the move's figures and day, and is approved as it is drafted only if it
equals what he was shown. Cash offered again never raises the order twice. `GET /orders` carries `again`,
the stages each order has to offer, read off the drafts, and `yes` where his Accept is given and not yet spent
(`waiting` or `differs`), when the card offers no second Accept and says where it waits; a row dropped because they withdrew (11.10) is
not his rejection and offers nothing.

**A withdrawal before the row is approved drops it** (S11 11.10). The customer withdraws while the
pending row still waits under Approve, with nothing paid: `dropAck` rejects that draft as `withdrawn`
(filing it rejected first if it is not drafted yet, so no drafter part-way through a pass can draft it
after), takes it off every queue, and marks the withdrawal told, so no Cancellation waits behind a row
that will never land. **An approved row is never dropped**: its Cancellation follows it as before. Money
paid keeps the row too, the refund being the book's to carry, and a cancellation of his own keeps the old
road.

The username-to-code map the relay needs is written to the DESK's
KV as `stmt-users` by every publish; the site never holds it, and an order whose username the map
does not carry is reported as `unmapped` and waits rather than being guessed at.

**THE CHASE** (v700, his instruction of 18 Sep 2026; **twice a day since S12 12.3**, his decision
D5 of 24 Sep 2026). This is the **first clock the statements Worker has ever
had**: until v700 it woke a phone only as a side effect of the desk touching an order.
`wrangler.stmt.jsonc` carries `"triggers": {"crons": ["0 * * * *"]}` and `stmt/worker.js` exports a
`scheduled()` handler beside `fetch`.

**Who is chased.** `isAdvance(o)` in `stmt/orders.js`: the order is agreed (`ROWED`) and its goods are
ahead of its money as the engine reads Open · Advance (24 Sep 2026): the share handed over above the
share of what is owed that is paid, the delivery charge in what is owed because that is what the
customer is asked for. The same test (`aheadOnGoods`) withholds cash on handover. A customer who has paid nothing on an order he has not touched yet is not
chased, because nothing of his is in their hands: **only goods received are chased**. `toChase(env, at)`
groups them by CUSTOMER, and leaves out an order inside its day's grace or with a claim waiting.

**When.** **At 10:00 and 18:00 in Kuala Lumpur** (`chaseSlot`, `CHASE_HOURS`): the cron stays hourly
and the code decides, so every other tick returns before it lists anything. **From the day after the
handover** (`graceOver`): `movedOn`, the Kuala Lumpur day of the last handover, must be before today,
so a customer paying cash at the counter is not asked again that evening; an order with no `movedOn`
is not chased. **Paused while a claim waits** (`claimWaits`): a claim of theirs he has not answered (S6). **Stopped** when what was received is paid, which is `isAdvance` going false,
his cash included once the return leg (v764) carries it to the order, and stage 11's Cash received when it lands.

**How often.** One wake a slot per customer, not per order: two unpaid advances are one person's
problem and one banner. The cap is the chase mark, `chased:<username>` in the order book (in KV on the
`kv` road; `markChased` reads and writes it in one step), holding the slot's **hour bucket** (`hourOf`,
whole hours since the epoch), so a tick that fires twice inside one hour cannot chase twice. It lapses
after two hours, so a customer who settles up leaves nothing behind and there is nothing to turn off.
The test account `0000-0000` is skipped, because it is counted nowhere. Until S12 12.3 it was every
hour, day and night, from the first top of the hour after the handover.

**What it sends.** `wakeCustomer` with its own kind, `due`: the banner reads **A payment is due**,
never "Your order has an update", and a tap opens the oldest order it is about. A phone filed before
its keys still gets the payload-free wake and the old fixed words (Notifications, below). The handler
logs its counts (`chase: {slot, woke, held, quiet}`)
because every push path on this site swallows its own failures, and a wake that reached nobody and a
wake that was not needed look identical from outside.

**A CRON REACHES PRODUCTION ONLY THROUGH A DEPLOY OF THAT CONFIG.** `public/rev.json`'s id does not
cover `wrangler.stmt.jsonc`, so `tools/update.mjs` reports the phone current and ships nothing:
`npx wrangler deploy -c wrangler.stmt.jsonc`.

**AND A PAYMENT THAT COMPLETES AN ORDER WAKES THE PHONE** (v700). It is the one customer move worth
waking for, because it is the only one whose answer arrives after they have put the phone down;
every other move of theirs happens with the page in front of them. The page's own words are his:
"Your order is now complete. Thank you for your loyalty."

**HIS ALERT ON A NEW ORDER** (v675, 16 Sep 2026; silent before it, because the switch left with the
phone app at v387 and nothing had subscribed since). A placement writes `last-placed` in the site's
store; the desk's every-minute cron reads it through `/desk/orders/last`, one read, and a moment newer
than `orders:nudged` wakes every desk subscription asking for `orders`, once. The switch is **Alert me
to new orders** on the cloud desk's Orders card, per device: it subscribes with `topics: ["orders"]`,
so a row he entered himself does not wake him, and hands the write key to the service worker, whose
banner then reads New customer order and opens `/desk#orders/newest`, the card of the newest act, which is the
one that woke him (the address carries nothing else). A subscription with no topics hears
everything, as at v321. On an iPhone the desk has to be opened from the Home Screen. **His wakes name
the kind of act and never a code, a username or an amount** (S11 11.16): New customer order, A customer
wrote, A customer says they paid (their word until he checks it), A customer cancelled (`NEWS_WORD` in
`src/orders.js`, carried in the summary while fresh); a placement clears older news, so a new order is
never titled by a payment's, and `public/sw.js` takes news as a title only in letters and spaces.

**Notifications.** The page polls the customer's orders every ten seconds while it is open.
For a closed page the site has its own Web Push pair. **The banner names the KIND of news** (S12
12.2, his decision D4 of 24 Sep 2026): each move sends `{k, o}`, a kind and the order's id, derived
by `wakes` in `stmt/orders.js` off the event and the order it folded into, so the KV road and the order
book send the same kind for the same move, sealed
for that one phone by `sealFor` in `stmt/push.js` (RFC 8291 aes128gcm, WebCrypto, one record), and
the service worker at `/sw.js` shows the kind's words from its own `NEWS` table: confirmed, ready, a
reply, payment received, a payment is due, delivered or collected (in part or in full), complete,
not taken, cancelled. **Never an amount, a product, an order or a name**; the suite reads every word.
One banner an order: the notification's tag and a sealed wake's push `Topic` are per order (the topic a
digest of the id), so news of one order never replaces another's on the lock screen or at the push service.
A tap opens the Counter at `#o=<id>`; a Counter page already open (never a guest board or Salt Admin in
another tab) is sent a message instead, re-reads its orders, patching only what changed, and opens that one,
or, its session lapsed, keeps it until the phone is back in (reopened from its memory, S3 3.5, or signed in
on the Sheet). A return to the page (S3 3.5) and a lapse reopened patch the orders the same way, so an open
order and a half-typed line survive; only a head of the tab the account now draws differently (the prices, the
payment page, the open orders reaching or leaving the limit) draws the tab again. Neither ever draws the order sheet or
its check; only the sheet's limit step, which holds nothing typed, follows the orders. A subscription filed before its keys gets a payload-free wake and the
old fixed words, so nothing already subscribed went dark; the page re-files the keys at the next
sign-in. A notice keeps its own road: its wake carries no payload, and the service worker reads
the public `bulletin` (v761). On an
iPhone the page has to be on the Home Screen first; the copy says so. A subscription is filed at
`push:<username>:<endpoint hash>` with the phone's two keys, `p256dh` and `auth`, when the page sends
them (`pushKeys` in `stmt/push.js`); a pair that is not one is dropped and the record kept without it,
and a pair that passes the shape check but will not seal gets the payload-free wake.

**Setup, once:** `node tools/stmt-setup.mjs` mints `STMT_DESK_KEY` onto both Workers and the
site's push pair (`STMT_VAPID_PRIVATE_JWK` as a secret, the public key written into
`wrangler.stmt.jsonc`), then commit that file and push. Until the desk key exists the desk's
`/orders` answers 503 and the site's `/desk/orders` refuses everything; until the push pair
exists the page says notifications are not switched on.

### Publishing, and the one-time setup

Statements reach the site through the two steps at the foot of the `deploy` job in
`cloud-commit.yml`. **`Deploy the statements site` uploads the site's CODE** and runs on a push
touching `statements/`, `stmt/`, `wrangler.stmt.jsonc` or the two tools, and on every fold.
**`Publish the statements, live` writes the site's CONTENT and runs on every deploy** (16 Sep
2026): the content is the ledger and the master, so any version that moves a price makes a
published list stale, and v652, v654 and v655 each left the customers' pages on the lists sealed
at v651 while the desk quoted something else. Both run after every step the ledger needs, so a
fault in the statements can never leave a folded row unmarked. The publish is `tools/stmt-publish.mjs`: it
seals the live statement into each of the newest issue's records under the content key, puts
them all in **one bulk call**, retires every record the issue does not carry (so **issuing a
new set retires last month's**), and clears the attempt counters on a new issue only. Without
`STMT_KEY` in the cloud the records go up as issued and "Now" is simply absent; the step warns.
`node tools/stmt-publish.mjs --dry <dir>` writes the bulk files and touches nothing.

Both steps stand down while `wrangler.stmt.jsonc` still carries `PLACEHOLDER_STMT_KV_ID`, so
the site does not exist until the store does. The one-time setup, in **Command Prompt** from
the repo folder:

1. Create the store, and paste the printed `id` into `wrangler.stmt.jsonc` in place of the
   placeholder:
   ```
   cd /d C:\Users\maakm\Claude\Code\salt-command
   npx wrangler kv namespace create stmt -c wrangler.stmt.jsonc
   ```
2. Mint the key, once, and keep the printed line:
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
3. Write `statements\_secrets.json` in Notepad with the key and your master passphrase.
4. Set the master on the site, typing the same passphrase:
   ```
   npx wrangler secret put STMT_MASTER -c wrangler.stmt.jsonc
   ```
5. On GitHub: Settings, Secrets and variables, Actions, New repository secret. Name `STMT_KEY`,
   value the key from step 2.
6. Regenerate the current issue so its records carry the wraps, then commit and push. The push
   deploys the site and publishes, live.

Every wrangler command for this site takes `-c wrangler.stmt.jsonc`; without it, wrangler
addresses the desk.

`REQUIRE_ACCESS` on the desk does not touch this site, and never will: the two share nothing.

## The master account at `/all`, guest links and printed boards

Moved from `CLAUDE.md` on 16 Sep 2026; the rules themselves stay there.

- **No brand** (his instruction, 10 Sep 2026): nothing a customer holds may point at the
  ledger, and an eyebrow carrying the name undid that.
- **Salt Admin opens on Needs you** (S9 9.1, the plan's section 5): one Approve card a thing that waits
  on him, its action on the card, the tap answered there. A card about an account carries its code as a
  button that opens it: from 1080px beside the list (the first such card's account until he picks one, the
  pane drawn again only when its account changes or the sheet is read), on a phone on Accounts. An associate's waiting link (Approve, the tier
  it quotes, Decline); an account refused at an address after ten wrong passwords, which may be anybody holding
  the username and never says the customer is shut out, read off the `fail:` brake by `lockedOut` (how
  many addresses and when it opens, never an address; the count off each key's listing metadata, which the
  brake writes, never a read a key, since anyone can mint `fail:` keys) with Send a sign-in link in two taps, one to make
  it and one to share it, so the share sheet never waits on the derivation; an ID with no account, which the
  fold leaves only when no spare was free (the stranger's standing link, its level the sheet's `stranger`, the one source, and its Accounts row saying the
  same; Send off until the laptop mints it); and the accounts neither ticked sent
  nor ever opened, with **Send them in turn** (S9 9.6): each account's sign-in link is made as its turn
  opens, Share is a tap of its own, and a share that goes through ticks the account sent (the `sent:` tick
  both his devices read) before the next turn; a closed share ticks nothing and Skip leaves one for later. With
  no share sheet, Share copies the message and only his Sent it ticks. The refused card also carries stage 3's Show a
  code (`showHandover`), and every link a card or a turn makes is minted on `keyFor`, the one road Show a code takes too.
- **Each owner app counts the other's waiting items** (S9 9.8), a figure with no link and no name. **The figure
  is the desk's own Waiting on you** (the S9 9.8 fix): once its page has read both the orders and the drafts, and
  neither read failed, it sends `ordActs().length`, the count its Today row and Enter badge show (a new order, a
  question not marked No reply needed, cash to record, a payment they say they made), to the desk Worker's keyed
  `POST /orders/waiting`, and `tellWaiting` in `src/orders.js` relays it through the site's `POST /desk/waiting` into
  the clear key `desk-waiting` `{n, at}`; the first count of a load, every change after it, and the same figure again
  once its reading has moved on five minutes. `at` is the reading's own moment: the page sends its `age`, the older of
  its two reads (Approve polls the drafts alone), the site stamps now less that, and a reading a minute older than the
  one held never replaces it, so a desk left open elsewhere cannot overwrite a newer one. The cron no longer
  counts: its recount (placed, or their line last) missed cash and payments and ignored No reply needed. So the
  figure is as fresh as the desk's last read, and Needs you says when: "N things wait on the desk, as at 14:06." Once
  an order has moved since that reading (the site's `touched` mark later than `at`, `moved` on the sheet's `desk`) it
  says so in the past tense: "Nothing waited on the desk as at 09:00, and an order has moved since." The
  desk's page reads its orders with the count of
  associate links waiting on his word (`/desk/orders?links=1`, `linkWaiting` in `stmt/refs.js`, the
  `approved === false` test), and its rail's foot says "N links wait in Salt Admin".
- **His places** (S9 9.2): Needs you, Accounts, Links and More (the report card and the test account), the
  system's App bar on a phone and its Desk rail from 1080px, a count beside a place that has something waiting.
- **Accounts** (S9 9.2) is one list for what Send and Review were: the system's Inbox row an account, chips
  for where it stands, when and how it was last opened, alerts on (the `push:` keys, counted by
  `alertsOn`), refused at an address and no account; a search and filters (Not sent, Not opened, Owes, Refused, No
  account) above it; a row opens the account, beside the list from 1080px.
- **An account** (S9 9.3, the plan's f13): its code, username, chips and totals; ONE filled **Send a sign-in link**,
  its link made as the account opens (`makeLink`, kept by username in `madeLink` with Needs you's), so the tap's first
  act is the share sheet (or, with none, the clipboard) and no derivation or fetch sits before it; a share that goes
  through ticks the account sent. A link shared or copied from any card is dropped from the page and a fresh one made
  (`retire`), so the one Sign out everywhere spares has never left it. Beside it Show a code, in person; View as them; Copy password;
  Sign out everywhere, on a second tap. Then **How they got in** (`GET /all/account/<username>`): the last ten ways in
  (link; a code scanned from his counter's QR, `qr`, copied across from the customer's own Keep Sheet, `copy`, or typed, `code`; password), each with its moment and the device in the site's own words (`deviceOf`
  in `stmt/signin.js`, from the browser's description at that open: "iPhone, Safari", never an address or a version),
  kept by `markSeen` in `seen:<username>`'s `log`; a remembered phone coming back is not a way in. Share and Copy
  message, and the QR of the username's address, left with the Send card.
- **View as them** (S9 9.5) opens the account's own page under the master, read only: its orders and an
  associate's links come from `GET /all/orders/<username>` behind the prefix's Access check, and nothing on it
  places, pays or sends. The bar says "Viewing as <username>, read only" and its one control is Back to
  accounts, which returns to that account's card, never to a line about signing out.
- **The master account** (v687, his instruction of 18 Sep 2026): the list shows every account with where it stands, in one word
  from `reviewFlag`, and when it was last opened, from the `seen:` keys this Worker has written
  since v499 and nothing read until now. The list comes from `GET /all/sheet`, which merges those
  opens into `sheet`, written by `tools/stmt-publish.mjs` from each statement's own rows through
  `partyTotals`, so the laptop's review sheet and the phone cannot say different things. A bucket
  is never listed: `usersMap` maps it to nothing. It reads in two rounds (2.5): every head at once,
  then each account's `seen:` and `sent:` keys in KV's bulk form, `get(keys[])`, at most 100 keys a
  call; each card's QR is encoded once an isolate (`cardQr`), and the read writes nothing.
- **`/all`** (v566) serves the customer's own page with the roster where the gate is; a tap
  fills the username and `STMT_MASTER` into that form and submits it, so everything past the
  door is the customer's own code. His decision: the gated route hands the master to the page,
  so nothing is typed, and the trade is that an Access session there reads every account. The
  Access application is "Salt statements owner" (`67280e0b-…`, one-time PIN, his address, a
  week's session, 168h, by his D13 of 24 Sep 2026; it was 24h). **When the session lapses, Salt Admin
  says so** (S9 9.7): every request under `/all` is sent with `redirect: 'manual'`, so Access's redirect
  to its login reads as an opaque redirect rather than "Failed to fetch", and that or the Worker's own
  401 turns the page into "Your admin sign-in has ended" with Sign in again, a link to `/all`. A request
  that never went out says so and leaves the page. **Its own icon** (S9 9.7) is the Counter's ring with a
  keyhole for the dot, `ADMIN_ICON_PNG_B64` from `tools/stmt-icon.mjs`, served at `/icon-key.png` outside
  `/all`, since a home screen fetches an icon without the Access cookie. `stmt/access.js` reads the header or the `CF_Authorization` cookie.
  It keeps the team's public keys per issuer and key id for an hour, and a key id it lacks fetches the
  certs once; the signature, issuer, audience and expiry are checked on every request, and `/all/refs`
  takes the gate's verdict rather than verifying twice (the plan's 2.6). `roster` (codes
  beside usernames, never names) is written by the publish.
- **Access on a `workers.dev` path, and how to prove it.** Zero Trust gates one path of a Worker
  with no custom domain; the precedent is QR Command's application, and the verifier to copy is
  `identity()` in `Code\qr-command\src\worker.js`: RS256 against the team's certs with issuer,
  audience and expiry, reading both the header and the cookie (the page's own fetches carry only
  the cookie), never throwing, every fault reading as nobody. A header check is not a gate: prove
  any Access gate with a token whose claims are right and whose signature is another key's.
  Applications, policies and `aud` tags are readable and writable through the Cloudflare API at
  `/accounts/{id}/access/apps`. A team rename moves the issuer: `ACCESS_TEAM` in
  `wrangler.stmt.jsonc` is a config edit plus a hand deploy, and every device signs in again.
- **SIGN-IN LINK, ON EACH ACCOUNT'S CARD** (v710). Since S9 9.3 it is made AS THE ACCOUNT OPENS, never on a
  draw of the list, so the tap only shares (the plan's must-not-ship rule): each opening, and from 1080px the
  account Needs you opens beside itself on every load, files a live three-day record and pointer that nobody may
  ever be sent, lapsing on its own or burnt, uncounted, by Sign out everywhere. His
  page opens the account under the master, wraps the content key under a fresh token, and posts the
  token and the wrap to `POST /all/signin/<username>`, which refuses a username the roster does not
  carry and refuses to hand back a link it could not file. What comes back is the finished message
  from `stmt/send.js`, the one copy of those words, plus the QR; it goes to the share sheet, or to
  the clipboard where there is none. **The token is dropped from the page as soon as it is sent.**
- **SHOW A CODE, IN PERSON** (S3 3.13, his decision D2). For a customer at his counter: the card's Show a code opens
  the system's Sheet and, as it opens, mints a hand-over through `POST /all/handover` (his page opens the account
  under the master and wraps as the Sign-in link does). It shows a QR of `<site>/app#qr.<key>`, drawn in rectangles,
  and the eight symbols in the Code field with when they stop working. It copies and shares nothing, so no
  clipboard waits on the derivation and the fetch. Closing it does not spend the code. The camera opens the QR in
  a browser tab, which spends that form alone and marks it a tab's (`tab: true`), and the Worker opens a tab's key only
  where his route minted it, before the phone's memory, so Replace asks over another account. The plain `/app#<key>` a customer's own Keep Sheet writes is spent by the saved app alone,
  so an address one customer sends another signs nobody in (S3 fix). An app's own browser spends nothing.
- **Guest links `/g/<id>`** (v566) are minted inside `/all` and labelled: a board is what he prints
  and hands to strangers, and the link exists to say WHICH stranger. `stmt/refs.js` mints, lists,
  revokes and counts opens; it prices nothing, and neither does `tools/pricelist.mjs`, which reads
  the same engine the desk does.
- **A LINK NAMES ITS INTRODUCER AND FOLLOWS THEM** (v658, his rule). Minting takes the introducing
  customer's USERNAME, checked against the roster the publish writes; a username nobody holds is
  refused. The guest's level is **two above the introducer's where there is room, else one, capped
  at the last**, per product, and a product the introducer holds no tier on falls to the last level,
  which is what a stranger is quoted anyway. **The level is never stored on the link.** Every
  publish computes it from the introducer's tier at that moment and writes the link's own board as
  `gboard:<id>` (`guestBoard` in `tools/pricelist.mjs`), so moving a customer up moves every link
  they gave out. A link minted since the last publish has no board yet and falls back to `board:2`,
  the board every stranger sees, which is also the cap. `board:1` and `board:2` are still written,
  as Titanium and the last level (Silver since v793, Bronze before it). The level's NAME is not on the guest page, for the same reason it
  is not on a customer's.
- **Print a board** (v564) saves HTML, PDF or JPG: crystal, sizes, username, then a QR to
  `<site>/?u=<username>`. The publish writes KV `stmt-site` and keyed `GET /stmt-users` returns
  it, so the laptop has no username and no QR.

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
- **Never commit `_passwords.json`, and never `_secrets.json`.**
- **Never send anything.** He sends these himself, so they must be right before they are sent.
- **Never regenerate a past month** to match a later code scheme.
- **Never change a line in `_users.json`.** A username is an address a customer keeps.
