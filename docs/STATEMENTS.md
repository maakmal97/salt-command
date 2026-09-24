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

One per customer with anything to show, named by code so the folder sorts alphabetically, plus
a review sheet stitching every account together. **The review sheet is not for sending.** It puts
every account beside every other, which is exactly what a statement must never do, and it exists
so a whole run can be checked in one pass.

**The passwords in the clear are in `_passwords.json` and nowhere else.** They were briefly in a
column on the review sheet as well, which made the gitignore rule pointless: the review sheet is
committed, so the same passwords went into git anyway. One place, and that place is not the
repository. The suite asserts that no generated page contains one.

**Sealed under the master, they also ride with the record** (v688, his decision of 18 Sep 2026),
as `pwMaster`, so Send statement on his master account can hand one over from his phone. That is
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
carried every order from the start; the page now filters it. Each dated row is tagged with its
month in `stmtDoc`, the strip above the table is built from the months that account has, the
newest opens, and All is one tap. Undated rows show whatever is chosen, and the account's own
position under the table does not move with the filter.

**The statements live on their own site, away from the desk.** Until 03 Sep they were a route
on `salt-command` itself, which put the one address a customer ever holds one path segment from
an open ledger. They are a second Worker now, `stmt/worker.js` under `wrangler.stmt.jsonc`, with
a cryptic name that says nothing about salt, a KV store of its own, and no access to the queue,
the vault, D1 or the desk. Nothing a customer holds points at the desk's address, and the suite
checks that no statement does either.

Each statement carries a QR code and prints the customer's **username**. The QR opens
`https://k7m3p2.qyts8mh72kyg.workers.dev/?u=<username>`, one landing page for every account,
with the username filled in; the password goes by a different channel. The page checks the
pair, decrypts in his own browser, and shows a strip: **"Now"**, then every issue by its date,
newest first. It stays signed in on that device while Remember me is ticked, and Log out ends it (v692); until 18 Sep 2026 it locked after three minutes and asked for the password again, as often as
he likes.

**"Now" is live (his instruction, 03 Sep 2026): every entry from the start to the minute it was
written.** The deploy rewrites it after every fold, so an approved row reaches the customer's
page in the same run that reaches the phone. Its heading names that minute in Kuala Lumpur
time. The dated issues beside it are the monthly statements exactly as sent, the August archive
included, and they never change.

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
   `_secrets.json`. Since 16 Sep 2026 the door takes the username in two boxes and the password in
   four, four symbols each, so the master can no longer be typed there: the owner's list at `/all`
   fills it in for him.

### The secrets, and where each one lives

| Secret | Laptop | Cloud | What it does |
|---|---|---|---|
| `STMT_KEY` | `statements\_secrets.json`, `"key"` | GitHub Actions secret `STMT_KEY` | Derives every customer's content key. The same string in both places. **Lose it and every account is re-issued.** |
| `STMT_MASTER` | `statements\_secrets.json`, `"master"` | Cloudflare secret on the site | His override. The Worker compares it; the laptop wraps the key under it at issue time. |
| the passwords | `statements\<YYYY-MM>\_passwords.json` | sealed under `STMT_MASTER` as `pwMaster`, served only behind Access | One per customer, one live month. In the clear on the laptop alone (v688), and since v710 no message carries one at all. |
| a sign-in link | nowhere | KV `ot:<sha256(token)>`, 7 days, one use | The content key wrapped under a token his page mints (v710). The token is stored nowhere, so the record opens only for whoever holds the link. |
| a remembered phone | nowhere | KV `rem:<sha256(token)>`, 30 days from the last open (S3 3.6; from the tick until then) | The content key wrapped under a key that never leaves that browser (v692). Filed under the token's hash since S3 3.1, so a copy of the store names no token; a record filed the old way is re-filed on its next open. |
| where an account is signed in | nowhere | KV `dev:<username>:<sha256(key)>`, as long as what it names | A pointer per remembered phone (`rem:`) and per session an open mints (`sess:`), with `how` it came, `at` and `last` (S3 3.2). Listed by the prefix, it is what shows an account's phones and signs them all out; it opens nothing. |
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
makes the missing ones on the first open of the Links panel: **ensured, not minted on a tap**, so
the answer to "what are my links" is always exactly five and there is nothing to remember. It is
idempotent, and a level that already has one keeps the id it was given, because an id handed to a
stranger must never change what it opens. The level names travel from the book to the Worker as the
KV key `tiers`, written by every publish; with no names to hand it makes none rather than inventing
five. Each standing board is `tierBoard(level, ...)` in `tools/pricelist.mjs`, which is `boardList`
with the level pinned, so there is one definition of what a board is.

**A STANDING LINK READS ITS LEVEL'S BOARD, NOT ONE WRITTEN UNDER ITS OWN ID** (v699). The publish
writes `tboard:1` to `tboard:5` on every run, and `handleGuest` resolves a standing link's level
against the `tiers` names and reads that key. v699 closed a hole v696 left in its own shape: the
five are minted the first time he opens the Links panel, so any minted since the last publish had no
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
form's product dropdown became a **segment of marks**, because an `<option>` carries text and no
drawing. A control holding only a mark is named by its **shape** (`PSHAPE`: Cube, Droplet, Ring) and
never by its product, so a screen reader is told what is drawn rather than what it is.

**The one name on the site is the app's.** The manifest, the `<title>`, the iPhone app title and the
install tutorial all say **Salt Counter** (v704, his instruction of 18 Sep 2026; it went Order Salt,
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
| `POST /handover` | a live session (`X-Stmt-Session`) and JSON `{token, wrap}`: `token` a key the page mints (24 random bytes, base64url, the shape of a sign-in link's), `wrap` its content key wrapped under it exactly as `wrapUnder(new TextEncoder().encode(token), ck)` wraps | `{ok, code, token, exp}`: `code` eight symbols of the username alphabet as `xxxx-xxxx`, `token` the key sent, `exp` ISO, fifteen minutes on. 401 with `session:false` with no session; 400 without a key of that shape and a wrap |
| `POST /handover/open` | JSON `{token}` or `{code}` (case, spaces and hyphens forgiven; `token` wins where both are sent) | exactly what `POST /open-link` answers (`u`, `wrap`, `session`, `env`, `live`, `prices`, `card`, `assoc`, `issued`, `issues`, `remembered: true`) **plus `token`**: the page unwraps `wrap` under `token`, the one in the answer, whichever it typed. Both names are burnt. Every refusal is the door's one (401); a brake is the door's (429) |

- **Mint when the sheet opens, copy in a tap of its own**: the derivation and the fetch are never in the tap that
  copies or shares (the judges' must-not-ship list).
- **Keyed and sealed**: filed as `ho:<HMAC(STMT_HANDOVER_KEY, "code:" + code)>` and `ho:<HMAC(..., "key:" + token)>`,
  each holding the other's name, `exp`, and the username, key and wrap sealed under AES-GCM keyed from the same
  secret. Eight symbols are 39 bits: never a plain hash.
- **Braked** per address (`hofail:<address>`, ten misses) and site-wide (`hofail`, a hundred), fifteen minutes each.
  A miss is any refusal; a success clears nothing. A flood shuts code sign-in for everyone for fifteen minutes and
  touches no other door. JSON only, as `/open`.
- **A code open is an open**: `seen:` says `code` or `key`, and its session leaves a pointer (`dev:`).
- The same two limits as the link: a bearer credential inside its fifteen minutes, and one use best effort on KV.

## The price list and the order book (06 Sep 2026, his instruction)

Three things sit behind the one password since v499: the statements, a **price list** for
the week, and an **order**. The page shows them as three tabs once the password has opened
the record. Nothing about the statements changed.

**THE LABEL IS A MARK, NOT A NAME** (v659, his instruction of 16 Sep 2026: "a very subtle tier level,
in symbol and colour (for each tier), marked in the pricing"). Each product on the price list carries
a small glyph in its level's colour beside the product's name: `MARK` in `stmt/page.js`, six shapes
from one Unicode block so they render the same everywhere, and none of them a count. **The level is
never named in the page**, which is the whole of subtle: two customers comparing pages cannot order
themselves by it. The name does travel inside the sealed list, as it has since v651, and stays out of
the text and out of the mark's own label, which is `aria-hidden` so it is not read out either.

**AND THEY ARE GREETED AS PERSONALLY AS THIS SITE CAN** (v659, the same instruction). The hour is
theirs, off their own device, so the page opens with Good morning, Good afternoon or Good evening,
and under the week's line it says the month their first priced order falls in (`since` in
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
the page says its price is coming soon, and the order form does not offer it. One
price per size, for the goods (v502): delivery is not on the list. It is a figure
he types **when he acknowledges the order** (v694; it was at ready until then, and the order becomes
a row at the acknowledgement, so the charge has to be settled there), the customer sees goods plus
delivery as the sum to pay, and the sale carries it as its own field, `delivery`, inside the total. A customer
with a tier and no history on a product sees the tier's price. Nothing outside the
engine prices: the publish opens the master in jsdom for the desk's PRICING inputs (the same the
drafter reads), which carry each customer's tier and the ladder, and calls `floorTotal` and
`cardPrice`. `node tools/pricelist.mjs --show <CODE>` prints what
a customer sees. `--no-prices` on the publish leaves the list out.

**The order lives on the site, in its own store**, as `order:<username>:<id>`, plaintext, and
the reason is stated in `stmt/orders.js`: it is written at runtime by the customer and the site
holds no key to seal it with. It carries a size, a quoted total and a state; no name, no code.
`/open` mints a **session** on a correct password (fifteen minutes; the page forgets it when it
locks), and the order routes take that and nothing else. The states: placed (the customer),
acknowledged (the owner: agreed, the delivery charge set, and the row queued), ready to collect or
deliver (the owner), done (**neither side's tap**: what the record reads once both tracks are
complete), declined (the owner), cancelled (either side, at any stage until the goods move).

**A RETRY LANDS ONCE** (24 Sep 2026). Place and I have paid carry a request id the page mints per
review and per payment; the site files `rid:<username>:<rid>` for a day naming the order and answers a
repeat with that order, changing nothing. Best effort, KV being eventually consistent.
**The order's own put decides the answer**: what is written after it (the shared marks
`last-placed`, `last-touched`, `last-said`, `last-theirs`, and the request id) is best effort, logged
when KV refuses it, so a stored move never answers as a failure. A lost mark costs a wake, not a stage.
**The customer is handed a view, not the record**: their order list and every answer to a move of
theirs carry `customerView` (`CUSTOMER_FIELDS`, a whitelist), never `ledgerKey`, `queued` or `sync`.

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
carries a fourth tab that appears only where the record that opened actually has one.

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
is drawn only for an associate, rides the placement as `forFriend`, and is stored on the order.

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

**MONEY AND GOODS ARE TWO TRACKS** (v694). `paid` and `payments[]` are what the customer says they
have paid, `moved` and `movedOn` what he says he handed over, and either may lead. Payment is offered
**from the acknowledgement**. Five rails: cash on collection or delivery, DuitNow
Transfer to a named account, a DuitNow QR to save, JomPAY, and the Touch 'n Go Business code;
the page hands over one link into QR Command for the rail chosen, and the accounts it may name
are `stmt/pay.js`, generated from the pay master by `node tools/paysync.mjs --sync` with no
number, payload or reference shipped. **The customer types what they paid** (the site takes no money
and no rail tells it anything), part payments accumulate, and more than what is outstanding is
refused. **Cash on handover is withheld** from anyone holding an unpaid advance on any live
order, the one being paid included: settling that at the door is how one advance becomes two. The quote is the customer's claim
off his own list: the owner reads the rate against the party's usual on the phone before
acknowledging, and the drafter flags it again when the row is queued.

**The desk reads and moves orders through a service binding**, `STMT_SITE` in
`wrangler.jsonc`, sending `STMT_DESK_KEY`, a secret the same on both Workers. The direction is
desk to site only; the site has no binding, no key of the desk's and no route back. The
Site orders card in Enter (cloud desk) is the taps.

**AN ORDER REACHES THE BOOK IN STAGES, AND NO TAP WRITES** (v694, his instruction of 18 Sep 2026;
it reached it once, at the end, as a sale paid and delivered in full on the day). **Site orders moves
the ORDER; Approve lands the ROW.** The desk's every-minute cron runs `reconcileOrders`, and it is
the ONE road that queues anything, so a stage cannot be queued twice by two roads racing:

| Stage | What is queued | Why that kind |
|---|---|---|
| Acknowledged | a `new` SELL, delivery inside the total, `cash` 0 and `kg` 0 | the row appears as **Pending**, which is the truth |
| A payment | an `amend` **Fulfilment**, the INCREMENT since the last one | a Fulfilment accumulates cash and units |
| A handover | an `amend` **Correction** stating the running total, `deliveredOn` and `handover` | only a Correction may set when and by whom, and it states rather than adds |
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
is not chased. **Paused while a claim waits** (`claimWaits`): what they say they sent (`payments`)
above what the order counts as `paid`. Today none waits, their "I have paid" raising `paid` on
their word, so this is where stage 6's claim plugs in; a Not found that lowers `paid` must take its
claim out with it. **Stopped** when what was received is paid, which is `isAdvance` going false,
his cash included once the return leg (v764) carries it to the order, and stage 11's Cash received when it lands.

**How often.** One wake a slot per customer, not per order: two unpaid advances are one person's
problem and one banner. The cap is `chased:<username>`, holding the slot's **hour bucket** (`hourOf`,
whole hours since the epoch), so a tick that fires twice inside one hour cannot chase twice. It carries
a two-hour TTL, so a customer who settles up leaves nothing behind and there is nothing to turn off.
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
banner then reads New customer order and opens `/desk#orders`. A subscription with no topics hears
everything, as at v321. On an iPhone the desk has to be opened from the Home Screen.

**Notifications.** The page polls the customer's orders every ten seconds while it is open.
For a closed page the site has its own Web Push pair. **The banner names the KIND of news** (S12
12.2, his decision D4 of 24 Sep 2026): each move sends `{k, o}`, a kind and the order's id, sealed
for that one phone by `sealFor` in `stmt/push.js` (RFC 8291 aes128gcm, WebCrypto, one record), and
the service worker at `/sw.js` shows the kind's words from its own `NEWS` table: confirmed, ready, a
reply, payment received, a payment is due, delivered or collected (in part or in full), complete,
not taken, cancelled. **Never an amount, a product, an order or a name**; the suite reads every word.
One banner an order: the notification's tag and a sealed wake's push `Topic` are per order (the topic a
digest of the id), so news of one order never replaces another's on the lock screen or at the push service.
A tap opens the Counter at `#o=<id>`; a page already open is sent a message instead, re-reads its
orders and opens that one, or, its session lapsed, keeps it for the sign-in after Continue. A subscription filed before its keys gets a payload-free wake and the
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
- **The master account** (v687, his instruction of 18 Sep 2026) opens on what it can do: Review
  statement, and the links below it. Review lists every account with where it stands, in one word
  from `reviewFlag`, and when it was last opened, from the `seen:` keys this Worker has written
  since v499 and nothing read until now. The list comes from `GET /all/sheet`, which merges those
  opens into `sheet`, written by `tools/stmt-publish.mjs` from each statement's own rows through
  `partyTotals`, so the laptop's review sheet and the phone cannot say different things. A bucket
  is never listed: `usersMap` maps it to nothing.
- **`/all`** (v566) serves the customer's own page with the roster where the gate is; a tap
  fills the username and `STMT_MASTER` into that form and submits it, so everything past the
  door is the customer's own code. His decision: the gated route hands the master to the page,
  so nothing is typed, and the trade is that an Access session there reads every account. The
  Access application is "Salt statements owner" (`67280e0b-…`, one-time PIN, his address,
  24h). `stmt/access.js` reads the header or the `CF_Authorization` cookie. `roster` (codes
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
- **SIGN-IN LINK, ON EACH ACCOUNT'S CARD** (v710). It is minted ON A TAP and never on a draw: drawing
  the Send panel would file a record per account on every page load and burn links nobody sent. His
  page opens the account under the master, wraps the content key under a fresh token, and posts the
  token and the wrap to `POST /all/signin/<username>`, which refuses a username the roster does not
  carry and refuses to hand back a link it could not file. What comes back is the finished message
  from `stmt/send.js`, the one copy of those words, plus the QR; it goes to the share sheet, or to
  the clipboard where there is none. **The token is dropped from the page as soon as it is sent.**
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
