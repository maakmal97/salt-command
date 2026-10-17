# Monthly statements, in the cloud

## RETIRED, 21 Sep 2026, on his instruction

**There is no monthly statement any more.** The account is ONE LIVE DOCUMENT (v769): each publish
excludes a defaulted row's balance from Outstanding and sealed `owed`, while retaining its actual
cash, in-kind, goods and delivery history and marking it written off. A pending intention still
owes nothing; a part-paid ready order retains its full remaining balance, not merely `txAdvance`.
Previously sealed issues are not rewritten. Each publish
seals it into every real account record with the Desk build id both beside and inside the ciphertext.
Before serving it, the Counter reads the Desk's authenticated `/stmt/rev` route and requires the
published stamp to match. A mismatch says the statement is updating; an unavailable or invalid
revision withholds it and says it could not be verified. The page opens on the whole account rather
than a month. A monthly issue adds nothing to that, and a strip of issues says there is something to
catch up on when there is not. Sealed issues and the invented test-account fixtures are unaffected.

**So nothing runs on the first of the month.** `tools/make_statements.mjs` refuses to seal a NEW
issue and says so; the routine below is kept because it is the only written account of how an issue
is made, and because a sealed issue is still a real thing for a dispute or a position on a day. When
he wants one, it is asked for in so many words:

```bash
node tools/make_statements.mjs statements/2026-10 2026-10-01 --new-issue
```

**Past statements are gone from the customer (15 Oct 2026, his instruction: "remove Past Statements from each user
account; there is only one live statement, and users can use the months or date ranges or products filter").** The page
stopped drawing an earlier statement in v1105 (14 Oct). From this version nothing a customer can reach carries one
either: `liveRecords` (`tools/make_statements.mjs`) seals each record's bundle again with **no statements** after it has
proved the key on the old one, and drops the clear `issues` list, so the store holds no monthly issue; the Worker no
longer sends `issues` on any open (`issued`, one date, stays for the owner's list and the publish read-back); the test
account's bundle is empty too and its one document is the live one. The page keeps its filter on the first statement
only as a cut for a record not yet republished. **How the existing sealed issues are left:** `statements/2026-08` and
`statements/2026-09` stay on disk exactly as issued (dated records, never rewritten) and the owner's page keeps them
at the foot; only the publish stops carrying them, so the old text a customer's record held is gone from the store at
the next publish, and a publish with no `STMT_KEY` (or a record the key does not open) leaves such a record as it was.
Still working: `--archive` of a past month, `--new-issue` for a dispute (its file is the owner's, never published to a
customer), and the LIVE statement with its month, range and product filters, the price list, the associate's card and
the account mint, on every publish as before.

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
**The fold binds them, never Salt Account**: at Add ID a registration takes the next free spare as its
username (`registerAccounts` in `tools/fold.mjs`, one line in `_users.json`, no key needed), and the
publish in the same run seals the live statement and price list into it, so a walk-in signs in within
the fold's few minutes. With none free the fold mints a bare username as before; Salt Account then reads
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
as `pwMaster`, so an account's card on Salt Account can hand one over from his phone. That is
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
own width), "units" above one; an issue is a standalone file and keeps its table. **The account is the live
document or nothing** (C15 and C13, his yes of 29 Sep 2026): the sealed issues are off the Counter and out of every published record (15 Oct 2026), kept on disk and on
his own page, where they sit at the foot by date; a live document that will not open says so with Try again, one the
publish wrote none of says the account shows after the next update, and neither is ever an issue drawn in its place.
A re-read that meets either keeps the hold where it last stood; a first open has no last state, so the gate is open
until the document reads. A failed read of orders says so on Orders and Home with Try again (C14), and a fault's own
words never reach a customer: a 5xx is the site busy, a codeless body takes the page's words (C16). **The live document inside the Counter** (C2 to C11,
C21, C25, the same yes): an h2 under the place's h1, the header naming the username so the document names nobody; every fully
paid row says the day it was paid under its state word; the footer and the workings carry RM; units above one and at nought,
the workings included, and goods, never the product's word; a refund row carries its month, and the line under the filter
names what stays the whole account's; No orders yet, never a period; Refunds and Still to collect are h3; a book's day is
written from its digits, never a clock. An issue keeps every word it was sent with. The page prints money as RM and two
places, every date DD Mon YYYY with a weekday only before a due date, the bar is the Places landmark, and a guest page opens
on its h1 (C5, C17, C19, C21, C22). **This device** comes first, after Messages (and beside the statement from 1080px, `#thisDevice`, ONE compact card): notifications on or
off (where the bell's plain tap lands; Step 1b), the Look, **Sign out** (a tap and a tap again, below), the account's other devices (S9 9.9, below) and Saved as an app, whose heading is the card's own third level. The statement follows under its own `h2`, 28 px below the card (the `.acct` container's gap, never a margin). **Off is kept on the device** (`salt-push-off`): the
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
guest's and Salt Account's included, opens `<html lang="en" translate="no">` with Google's
`notranslate` meta (`DOC_OPEN` in `stmt/page.js`), because accepting Chrome's offer sends an
opened statement to a translation service. The Counter's script then sets `lang` to the language it reads (13.4).

**Every word by key** (his D12, the plan's 13.3): the Counter's page, its sheets and places, the banner
(`stmt/sw.js`) and every refusal read ONE table a language, `stmt/words.js`: English complete, and a key a
language lacks is English's, never its name. A figure, a date or a username is a `{n}` slot, and no sentence is
joined from translated halves. A refusal a customer can meet is `e.<code>` there: the Worker answers
`{error, code}` through `refusal()`, the order book passing the code and its slots on, and the page words the
code, the Worker's English standing for one it does not know. Salt Account stays English and unkeyed; a guest's board
and a shut link are keyed but English only (no script); `stmt/send.js` is unkeyed.

**English only.** Malay was removed everywhere on 05 Oct 2026, the owner's decision, superseding D12, F7 and the kept `MS` table: `stmt/words.js` holds `EN` alone (`WORDS = { en: EN }`), the page draws no language switch and keeps nothing as `salt-lang`, writes no `/lang` to the Cache, and `stmt/sw.js` words the banner in English; the sign-in message (`stmt/send.js`) is English alone. Salt Account is English on any phone. The suite asserts that no Malay table, switch or word list returns. The superseded D12 and F7 narrative is in `docs/NOTES.md`.

Each statement carries a QR code and prints the customer's **username**. The QR opens
`https://k7m3p2.qyts8mh72kyg.workers.dev/?u=<username>`, one landing page for every account,
with the username filled in; the password goes by a different channel. The page checks the
pair, decrypts in his own browser, and opens on **"Now"**, the live statement alone (no issue is listed; 15 Oct 2026). It stays signed in on that device while Keep me signed in is ticked, and Log out ends it (v692); until 18 Sep 2026 it locked after three minutes and asked for the password again, as often as
he likes.

**A passkey opens it too (Step 6, his decisions of 29 Sep 2026).** Signed in, This device offers **Save a passkey**; the
customer's own store keeps it under Salt Counter (NordPass, Apple, Google: any passkey works), and the door's **Open with
a passkey** signs them in with the face or finger that store asks for. The Worker (`stmt/passkey.js`) checks the client
data's type, challenge and origin, the authenticator data's relying party (this address) and its user-present and
user-verified flags, and the signature with the public key filed at saving (ES256, EdDSA, RS256); only then does it hand
back its share of the unlock key. The other half is 32 bytes the device keeps, or the secret the passkey returns where
its store gives one (PRF: Apple Passwords, Google Password Manager), which is the same on every device the passkey
reaches, so such a passkey opens the account anywhere. With neither on a device, the open answers `once` with no session:
the door fills the username, asks for the password once, and files that device's wrap after it (his decision: the password
once a new device, so the Worker still holds no key that opens an account). A device signed in by password first offers
**Use your passkey on this device** where the account has one. A passkey lasts a year from its last use; **Log out keeps
it** (the passkey still asks for the face), **Remove this passkey** ends it, and so do Sign out everywhere, Sign out other
devices and his own Sign out, with every device's wrap. The test accounts save and use passkeys as any account does; a
passkey is a credential, not fixture data, and counts nowhere.

**"Now" is live (his instruction, 03 Sep 2026): every entry from the start to the minute it was
written.** The deploy rewrites it after every fold, so an approved row reaches the customer's
page in the same run that reaches the phone. Its heading names that minute in Kuala Lumpur
time. There are no dated issues beside it for a customer any more (15 Oct 2026); the sealed ones
stay on disk as sent and never change.

**The account closes in stages (V5, his answers of 29 Sep 2026).** Counted from the handover of the oldest part still
overdue (`since`), on the phone's own Kuala Lumpur day: past the term, day 2, no new order (the hold); from `pay.hide`
(`RULES.hideDays`, 3) the prices are hidden, Prices saying why (`pr.hidden`); from `pay.lock` (`RULES.lockDays`, 4) the
account is only for paying: To pay now and its Pay stay live, and the rest of Home and an associate's Rewards are seen but
greyed out and out of reach (`grey`: class `lockd` and `inert`; his answer of 29 Sep 2026). The handover is day 0. Each stage is said before it comes, under To pay now
(`stageNote`: `st.prices`, then `st.lock`, then `st.locked`), and the chase wakes them (tapered, below). A
claim of theirs waiting on him lifts every stage, as it lifts the hold (D9), whatever its figure. `payDue` seals `hide`
and `lock` read out of the master beside `term`; a master stating neither seals neither, and the page then stops at the
hold. The sales provisioning ladder (V5a, `docs/DESK.md`) reaches 100% on the day the account locks.

**What is to pay, sealed beside `owed`** (S6, his D9 of 24 Sep 2026, as his instruction of 28 Sep 2026
amends it). `liveStatement` carries `owed`, the footer's figure, and `pay` from `payDue` in
`tools/make_statements.mjs`: `{term, hide, lock, now: {rm, due, parts}, overdue: {rm, parts}, coming: {rm, parts}}`.
**To pay now** is the desk's receivable, `txAdvance`, row by row: goods handed over and not paid for.
**Overdue is counted from the day the goods were collected or delivered** (28 Sep 2026, in place of ten
days from the order date): a part's `since` is the engine's `txUnpaidSince`, the handover of the oldest
unit still unpaid, walking the unit steps in date order against the units the money covers, so money for
the first units starts no clock and a later handover restarts none (units with no step of their own went on
`deliveredOn`, else the row's date; since 28 Sep 2026 the fold writes the units a Correction moved on its step, so
a site handover in stages keeps each stage's day). `due` is `since` plus `term`, the desk's `RULES.holdDays` (1 since V5, 29 Sep 2026; it was 3) read out
of the master (a master stating none stops the publish): the last day it can be paid with ordering kept
open; `now.due` is the soonest. A part is `late`, and listed in **overdue**, once that day has passed,
whatever its amount (D9's RM 100 line is retired); an undated part is never overdue. The page also counts a part
late once its `due` day has passed on the phone's own Kuala Lumpur day (`lateNow`), since only the Actions chain
publishes, once a Kuala Lumpur day at least, soon after 00:05 MYT; it only ever adds, so a phone's date set back lifts no sealed late. The desk's Credit age
breach and its chase on Today count the same way (his answer of 28 Sep 2026): past the term from the handover the chase
is Now and carries the reminder, inside it This week, and the suite holds the desk's breaches to the parties `payDue`
seals overdue that day. The desk's pricing profile keeps `RULES.creditDays`, ten days from the order date, for its own
"late", since that moves prices, and the cash-in forecast expects a receivable at it.
**Coming up** is `txPendRM`: agreed, not handed over, money still to pay, an undated order dated by
`agreedOn`. A part carries `date`, `since`, `due`, `late`, `rm`, `whole` (goods and delivery), `product` (an
id, drawn as a mark), `qty`, `got`, `gotOn` (the last handover's day, one in stages included) and `resale`, and (pay terms V2,
28 Sep 2026) its invoice line: `goods` and `deliv` on the units handed over, `less` (what is paid, the engine's `txPaid`,
cash and in kind) and `rate` (the goods' rate), with `goods + deliv - less = rm` to the sen, the delivery taking the worth
the goods leave and none on a row with no charge; a coming part `date`, `rm`, `product`,
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
| a passkey (Step 6) | nowhere | KV `pk:<sha256(credential id)>`, a year from its last use | A customer's passkey, saved on a session (his decisions of 29 Sep 2026): its public key and algorithm, the share of the unlock key the Worker hands back once the passkey's signature checks, and the roaming wrap once a device whose passkey gives a secret has made one. Listed with the account's devices through its `dev:` pointer; Log out keeps it; Remove, Sign out everywhere, Sign out other devices and his own Sign out end it with its devices' wraps. Nothing here opens an account: the share is half of the key. |
| a device's passkey wrap (Step 6) | nowhere | KV `pkd:<credential hash>:<sha256(device token)>`, a year from its last use | The content key wrapped under the share and 32 bytes that never leave that browser (`salt-stmt-passkey`), for a passkey whose store gives no secret (NordPass). A new device signs in by password once, after Open with a passkey answers `once`, and files its own. |
| a passkey challenge (Step 6) | nowhere | KV `pkc:<sha256(challenge)>`, five minutes, spent once | What a save, a link or an open is signed over; a session's names the account and the share a new passkey keeps. |
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

**On a drift book (salt since 05 Oct 2026) every link quotes the Set Price**: no level exists there
for a standing link or an introducer to pick, so `boardList` falls back to `ladderRow`'s ask.

**THE GUEST LINKS ARE FIVE, ONE FOR EACH TIER** (v696, his instruction of 18 Sep 2026: "for the
guest links, produce exactly 5 links, for the five tier pricing"). The five levels a guest may be
quoted are Titanium, Platinum, Gold, Silver and Bronze; Ambassador is the floor and never a guest's.
A standing link carries its `level` and `standing: true`, and `ensureStanding` in `stmt/refs.js`
makes the missing ones on Salt Account's first read of its links (Needs you or Links): **ensured, not minted on a tap**, so
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

**WHAT ASKS FOR A PUBLISH (10 Oct 2026, his choice).** Every input a sealed statement, price list, board or card
reads, and what moves it:

| Input | Where it lives | What publishes it |
|---|---|---|
| The rows, roster, tiers and drifts held, `TERMS`, `RULES`, the ladder and boards, `_users.json` and the issue's `_kv` | git: `ledger/book.json`, the master, `statements/` | the push: a version moves `public/rev.json`, and a statements path is on the push paths |
| Site orders, claims and messages | the Counter's order book | nothing: none is sealed, and an order reaches a list once it is a row on the book, so through git |
| The restock date | the Counter's KV `expected`, written only through the desk's `/expected` | the desk marks KV `publish:wanted`, and its minute cron dispatches |
| The day: the drift's days since the last order and oldest overdue, the restock date's lapse (`restockSupply`), the week line, `pay`'s `late` | the clock | the desk's minute cron asks once a Kuala Lumpur day, 00:05 to 03:00 MYT; the page counts `late` and the hold, hide and lock stages on its own day besides |
| A guest link minted or approved since the last publish | the Counter's KV `g:` | nothing yet: it reads `board:2` until the next publish (below) |

The desk Worker's `wantPublish` writes `publish:wanted` `{at, reason}`; `publishWanted`, on the minute cron, sends
one `stage_only` dispatch named `publish: <reason>` when the mark is newer than the last such dispatch
(`publish:dispatched`) and five minutes have passed since it, the dispatch mark written first. A `stage_only` run and
not a new mode, because it shares the chain's lock (`cloud-commit`, never cancelled), so no older checkout publishes
over a newer chain, which the Counter would then withhold on the build id. **It is never sent while a Cloud commit run
waits in the group** (`cloudCommitWaiting`: the workflow's runs, and the jobs of one in progress, since the lock is job `chain`'s): GitHub keeps one pending run and a newer one
replaces it, so a pending push run, which deploys, re-seeds and retires, would be lost to a run that does none of those;
the waiting run reads everything when it starts and publishes, so it covers the mark. GitHub unread, nothing is sent and
the next minute asks again. A failed dispatch is logged and not retried: the next write or
the four-a-day net publishes. **A new input outside git calls `wantPublish` at its write road.**

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

**A letter of his in every mark, 20 px and over; it names nothing** (F8, his answers of 28 Sep 2026: "everywhere",
then "Yes everywhere", the statement and the guest board included; v913's letters on Prices alone are superseded).
`PLET` in `stmt/page.js`: I in the cube, G in the droplet, E in the lozenge, V in the capsule, none its book's initial
in English and together no product word. `psymSvg` and the page's `psym` draw it always (spliced to the page as
`__PLET__`); there is no switch. **No mark is drawn under 20 px**, where the letter, a third of the mark, is too small to
read: every smaller mark was raised, the statement's 13 px ones among them.

**In a card the mark is a button with its size under it** (his note on the sheet of the raised marks, 28 Sep
2026: a card never sets the glyph beside words or figures; then "number alone", and "It will be rendered cards in the
statement"). `mtileSvg` in `stmt/page.js` and the page's `mtile`: the mark at 28 px on the pressed ghost's edge and
glass, the caption in the mono face under it (the size in words, "2.5 units"; no shape word is drawn, see Phase 7c below), and a reader told the shape and the size in words, once. Check your order
leads with it and carries no What line; an order's row (Your orders, and Home's rows, which are the same row), an
order's own screen, Home's part rows under Coming up and the open orders at the limit take it; Order again's face is
itself the button, the mark and the caption stacked on it. The live statement's lines, its totals and its Still to
collect are cards too. A sentence (a part of an order, the pay sheet's note) keeps its mark beside the size, at 20 px;
a mark alone (Prices, Rewards, the guest board, the order sheet's choice of book and its heading) keeps its size; an
issue's table keeps its mark beside the size, at 20 px. Sealed issues and archives keep what they were issued with (an
archive draws no mark). **Every letter is the same size on
the same line** (`PLET_AT`: 8 in the 24 grid, its capitals centred on the mark's centre), and **every book's mark stands
2.6 to 21.4 about the centre**, on every surface (his redraw of 28 Sep 2026, "of the same ratio 1:1"): the lozenge made
square, the droplet rounder, the capsule turned to the diagonal so it is as wide as it is tall, the book's ring larger,
the cube as it was. The app's own ring on the door and the rail keeps the home-screen icon's proportion (`APP_RING`). Where a line of the mark would
cross its letter, `PLET_ROOM` gives it room: the cube's three inner edges stop at radius 5 and the capsule's seam gives
way. A book with no mark draws the Ring, bare, and the aria stays the shape (spare, the book that exercised it, was retired on 15 Oct 2026). The letter's face is the class `.plet`, never a style attribute: the site's
style policy refuses one. The guest board carries it in the page's own styles, with the mono face its policy lets load.

**The one name on the site is the app's.** The manifest, the `<title>`, the iPhone app title, the
sign-in link's page and the Keep it on your Home Screen card all say **Salt Counter** (v704, his instruction of 18 Sep 2026; it went Order Salt,
then The Counter, then his own name for it). The icon on a customer's home screen has to say
something: it is the ONE place on this site where something is called something, and the product
word is his to spend there. Inside the page a product is still a mark and never a word. What never
appears is the DESK's name, nor his page's: the customer-page sweeps refuse Salt Command, Salt Desk (the desk as it
installs, his Q6 of 28 Sep 2026), Salt Account (`/all`, which was Salt Admin until then, twelve characters too) and
Salt Admin (the desk's admin surface to come). Twelve characters exactly, which is what iOS gives a home screen. The statement's letterhead, the last
place Salt Command appeared on a customer's page, is gone: `brand` is null for the live statement
and every new issue, and a statement with no brand carries no eyebrow rather than an empty one.
Issues already sealed keep the letterhead they were issued with until they are re-issued.

### The hand-over: a key and an eight-symbol code (S3 3.9, his decision D2 of 24 Sep 2026)

An iPhone's Home Screen app keeps its own storage, so what Safari remembers never reaches it. A page already
signed in (or Salt Account, for a customer at his counter) hands the sign-in across: a long KEY for Paste and for
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
another never signs the other in; the other device opens Salt Counter from the QR and the code is typed there. **The account works in a browser or the saved app**: installation is optional. A signed-in browser opens the
account normally; Account > This device keeps the optional install steps and, on an iPhone, a hand-over code for a separately
stored Home Screen app. A browser can continue using the account without installing.

### The customer's look: Night or Tide, chosen on each device (11 Oct 2026, his decision)

Two themes on every surface, kept per device, **Tide until one is chosen**; the design is in `docs/DESIGN.md`. A customer chooses on
their next sign-in and can change it under Account.

- **Kept** in localStorage `salt-look`, `night` or `tide`, on the device and nowhere else: not on the site, in no record and in no
  statement. Anything else, or a store that cannot be read, is nothing chosen and the page is Tide. Every read and write is in a try.
- **The Sheet** (`lookSheet()` in `stmt/page.js`, opened by `lookAsk` from `enter`): the first time a signed-in customer page opens
  on a device whose store is readable and holds no choice, the system's Sheet asks over the page, which is already Tide behind it.
  Two large Option tiles, Night and Tide, each with a swatch of its own ground and accent, and one line, "You can change this under
  Account." Choosing applies at once (`data-theme` and the browser bar's colour, through `saltLook`), keeps the choice and closes the
  Sheet, with no reload. Escape, Close or a tap on the scrim keeps Tide, stores nothing and asks again on the next open. Focus goes
  into the Sheet and Tab stays in it. **A visit asks once**: signing out and in again in the same page does not ask a second time, and
  a sign-out with the Sheet open takes it down. A store that cannot be read is never asked, because the answer could not be kept.
  Once chosen, a device is never asked again.
- **Look, under Account**: This device holds a Look row of two ghosts, Night and Tide, the held one `aria-pressed`, 44px both ways.
  It applies at once, keeps the choice and needs no reload; on a store that refuses the write it holds for the visit.
- **His page has its own, below ("His look").** Salt Account (`/all`) opens in the stored theme from the same head script. View as
  them on it asks nothing and shows no setting.
- **Not on a page with no script**: a guest board, the shut page and the maintenance page are Tide, always.
- **Words**: `look.h` (Look), `look.sheetH` (Choose your look), `look.night`, `look.tide`, `look.note`, in `stmt/words.js`; no
  product word and no brand, and a customer is never told a level.
- **The test accounts** (fixture version 8) show it: their sealed bundle carries `look: "asked"` (`tools/testfix.mjs`, a line in
  `FEATURES` and the case in `build()`), and a bundle that says so asks at every sign-in whatever the device holds, so the Sheet can
  be tried again; the Look row is the same as anyone's. A real account's bundle says nothing and is asked once.

### His look: Salt Account chooses its own Night or Tide (11 Oct 2026, his decision)

The same two themes, kept per device and **Tide until one is chosen**, chosen on Salt Account itself: `salt-look` in localStorage on
the Counter's origin, which is also the origin of `/all`. It is apart from the Desk's (another origin) and shared with the Counter's
own pages on that device: the customer's pages (View as them, a test account) read the same key, so a browser that uses both wears
one choice on both, there being no second key.

- **The Sheet.** The first time Salt Account opens on a device whose store is readable and holds no choice, the customer's Sheet
  (`lookSheet(true)` in `stmt/page.js`; the same recipe, markup and script, with the acts below and one line that names Shop, "You can
  change this later under Shop, in This device.") asks over the page, which is already Tide behind it. The owner's script calls
  `lookAsk(null, true)` once at the end of its setup; the customer's own call passes nothing and an owner's account view is refused, so
  View as them never asks. Choosing applies at once through `saltLook` (the attribute and the browser bar), keeps the choice and closes
  the Sheet with no reload. Escape, Close or a tap on the scrim keeps Tide, stores nothing and asks again on the next open. Focus goes
  into the Sheet and Tab stays in it. A store that cannot be read is never asked, because the answer could not be kept.
- **An Access lapse wins.** The Sheet and its scrim are children of the body beside `#aEnded`, so `body.ended` hides them with the rest
  of the page, and `ended()` in `stmt/owner.js` takes the Sheet down first (`lookShut`), so a lapse never leaves the choice open over
  "Your admin sign-in has ended". After signing in again the page asks again if nothing was chosen.
- **Shop, This device, Look.** Shop's fourth part, `This device` (`part.shop.device`, address `#shop/device`, reading nothing), holds
  the customer's Look row (`lookRow(true)`): two ghosts, Night and Tide, 44px both ways, the held one `aria-pressed`, acts `look.night`
  and `look.tide`. A tap applies at once, keeps the choice on this device and needs no reload; on a store that refuses the write it holds
  for the visit.
- **What it shares and what it does not.** Markup (`lookRow`, `lookSheet`) and script (`lookSet`, `lookShut`, `lookMark`, the Sheet's
  focus and key handling) are the customer's; with no argument they draw as they did. The owner's version adds the acts and its own
  line. No new CSS: the look rules are the customer's and apply to both pages.
- **The suite.** The section "Salt Account wears Night or Tide, chosen on its own (11 Oct 2026)" (`test/admin-look.mjs`, its mutations in
  `test/admin-look.mutations.json`) drives his page in a window with a store that holds nothing, either theme, a value that is not a
  theme and one that throws, and with the Access login's 401; the customer's page is checked drawn as it was. `test/maker-act.mjs`
  audits the Sheet's controls with the rest of his page.

### A yes or no is a Sheet (Phase 7d part 1, 11 Oct 2026, his decision 4)

The customer's page calls no native `confirm()`, `alert()` or `prompt()`. The three questions it asked that way, **Cancel this order**, the same
Cancel in the order limit's list, and **Withdraw** a link, each open the system's Sheet over the page (`ynOpen` in `stmt/page.js`: the scrim, the
grabber, a title, a close orb, a body and a foot), built from the page's own nodes at the root of the body, last, and given its own stacking
(`#ynScrim` 72, `.ynsheet` 73, over the system's 70 and 71), because a later place in the page is not enough to lie over the order sheet at
the limit: its scrim sat under that sheet's body until it had a number of its own. It restates what goes:

- **An order**: its mark (the product's mark with his letter, the size under it, the shape and the size read aloud, never a product word), the
  order's own word (Placed, Confirmed), its figure (goods plus delivery, as the limit's list draws it) and the day it was placed; then what is
  lost (`yn.orderLost`) and the money: `yn.orderNone` where nothing is paid, or `yn.orderPaid` with the refund where something is.
- **A link**: the day it was made, its state (Open, Waiting) and what it has done (Opened 2 times, last 19 Sep 2026), then what is lost
  (`yn.linkLost`). Its address is never repeated.
- **Two answers.** One danger action, the system's danger ghost with its ember tone (`.ynsheet .salt-ghost--danger`, a token of the system),
  first; a ghost that keeps below it. Both are full width and 44 px; the close orb is the system's.

**The Sheet only replaces the yes or no in front of the call.** The danger action closes the Sheet and runs the call the confirm let through,
with the same path, the same body (an order's cancel sends the id alone, `ridFor(id:cancel)`, the same on every retry and dropped once recorded;
a link's revoke sends `{}`) and the same ways of answering. Nothing is sent before it. The ghost, the close orb, the scrim and Escape each close
it and send nothing, and the focus goes back to the control that opened it, found again by its `data-yn` (`cancel:<id>`, `limit:<id>`,
`link:<id>`) if a redraw replaced it while the Sheet was open. Focus starts in the Sheet and Tab stays in it, both ways, a Tab from outside pulled
in; the key handler is on `document` in the capture phase and runs only while the Sheet is open, so Escape at the limit shuts this Sheet and
leaves the order sheet under it open. **A lapse of the session or a log out takes it down** (`ynShut(true)` in `lapsed()` and `lock()`), so it is
never left over the signed-out Sheet or the door. The Sheet shows the order as it stood when it was opened; the Worker is still the check on what
can be cancelled, and a refusal is said beside the control as it was.

The words are keys (`yn.*`, `num.1` to `num.10`, `sh.limit` with its `{n}` slot); the three browser questions' keys (`ord.cancelAsk`,
`ord.cancelAskPaid`, `lnk.withdrawAsk`) are gone. Salt Account (`stmt/owner.js`) keeps its own questions, another lane's.

**The test accounts show every Sheet**: they hold more than five open orders (the limit's list and each Cancel there), an order agreed and paid
before anything moved (`ex47`, so the Sheet names a refund), and an open and a waiting link (`tools/testfix.mjs` `FEATURES`). The suite section
"Cancelling and withdrawing ask in a Sheet that says what goes" (`test/counter-confirm-sheets.mjs`, its mutations in
`test/counter-confirm-sheets.mutations.json`) drives all three controls through the generated page in jsdom, with `confirm`, `alert` and
`prompt` made to throw and count. The 44 px and both themes are measured in a real browser and recorded in the pull request.

**One word per state, and the mark alone** (Phase 7c of the Salt Account and Counter redesign, his decision 10 of 11 Oct 2026; the shape word it drew
beside the mark was taken back by his word of 12 Oct 2026, below). The page named one step four ways (Sent, Acknowledged, agreed, your yes). Now an
order is one of six words and a claim of theirs has its own. **The record's states do not move** (`placed`, `acknowledged`, `ready`, `done`,
`declined`, `cancelled`; the fold, the drafter and the order book read them); **the keys of `stmt/words.js` do not move** (S13 13.3 reads the
table by key); only the customer's words do.

| Was | Now | Key |
|---|---|---|
| Sent | **Placed** | `st.placed`, `sh.lineSent`, `sh.sent` ("Order placed") |
| Acknowledged | **Confirmed** | `st.acknowledged`, `ow.confirmed`, `news.confirmed` and `news.confirmed-credit` ("Order confirmed") |
| Not taken | **Declined** | `st.declined`, `ow.declined`, `ow.declinedWhy`, `news.declined` ("Order declined") |
| Waiting to be acknowledged | **Waiting for us to confirm** (an order placed, and a claim of theirs) | `ow.placed`, `why.placed`, `hc.placed`, `om.waiting` |
| Expected by DD Mon | **More by DD Mon** (supply, yellow with a day) | `sup.by` |
| we acknowledge / acknowledged it | we confirm / confirmed it | `deliv`, `sh.setOnConfirm`, `om.set`, `om.placedAt`, `hp.closed`, `news.pool-closed.b`, the refusals `e.payEarly`, `e.methodEarly`, `e.cancelDeclined` |

Ready to collect or deliver, Collected or Delivered, Complete and the two cancellations are as they were, and a claim of theirs still reads
Waiting for us to confirm. No value of the table, and no markup or quoted string in the page's script, holds *acknowledg*, *Not taken* or
*Expected by* (`stmt/owner.js`, Salt Account's own page, is another lane's and keeps its own words).

**The mark stands alone** (his word of 12 Oct 2026, "Remove the shapes names in the Order page, and anywhere", which took back the shape word 7c drew beside it, and
then "and even the name of the product" for Salt Account, below). **No shape word is drawn, on any screen of the Counter**: in a card (`mtile`, `mtileSvg`) the caption
under the mark is the size in words alone, "2.5 units", and a book's heading (`pmarkHead`, Prices and Rewards, the guest board), a size with its mark (`withMark`, the
order sheet's legends and lines), a mark leading a note (`markLead`) and a mark in a sentence (`markHtml`, which the invoice lines and the pay sheet's note share) are the
mark alone. **The reader is still told the shape** (`PSHAPE`, by key `shape.<Shape>`): a tile's hidden `.sr` reads "Cube 2.5 units", a heading's `aria-label` is the
shape (with the light where the book has one), and an inline mark is followed by a hidden `.sr`; a control holding only a mark is named by its shape, never its product.
**No shape word is a product's**: Cube, Droplet, Lozenge, Capsule and Ring name nothing, and the product-word and level-word scans (v695, v704, `siteWords`)
pass them and every sentence of the new words; the suite drives that both ways. The Desk never drew a shape word and keeps its book names.

**What follows on the Desk**: the order card's `ordTold` and `toldOf` in `src/orders.js` (`CUSTOMER_SEES`) say what they see in these words, the Accept and
Decline answers read "They see Confirmed" and "They read Declined", the reasons legend says "Why it is declined", and the restock card says More by. The
practice accounts' feature labels follow (`tools/testfix.mjs`, the pool fixture), with no new `FEATURES` line.

The suite section "One word per state, and the mark alone" (`test/counter-state-words.mjs`, its mutations in
`test/counter-state-words.mutations.json`) drives the generated page in jsdom over an order in each state and reads the text it renders (each state's
chip, sentence, steps and history, the claim, Home, the order sheet and Place), builds each banner from the real wake through the service worker, sweeps
every word the page is served for the family, and checks that no shape word is drawn on any screen, that every mark on every screen still has its shape as the
reader's name, and that none is a product's.

### Account leads with this device, and the door names the app (Phase 7d part 2, 11 Oct 2026, his yes)

**Account reads Messages, This device, then the statement** (`drawAccount`, `stmt/page.js`), each its own child of `#acct`, a flex column with a 28 px gap
so a part not drawn leaves none (from 1080px a grid: the card in the second column beside Messages and the statement). Every control kept its id,
data attributes, request and behaviour; only the order and the grouping moved. The install guide's heading is now an `h3` inside the card, so Account
carries one second-level heading of its own, the statement's, and no stray first-level one. Measured in a real browser at 375 and 768, Night and Tide:
the gap between the card and the statement's heading is 28 px (it was 0), Sign out sits at y 434 of 5,113 (it was 4,876 of 5,017), no sideways scroll,
every control in the card 44 px tall.

**Sign out is a tap and a tap again, on the same control.** The first tap arms it and says so in its own words (`dev.outAsk`, "Tap again to sign out of this
{dev}", announced because the button is `aria-live=polite`) and sends nothing; a second within four seconds (`LOCK_MS`) signs out exactly as before; left alone
it lets go by itself. Never the browser's `confirm()` (7d part 1). His own page shares the control as Back to accounts and keeps one tap.

**The door names the app**: the ring and one eyebrow line, `door.app` (Salt Counter, the one name allowed), above Sign in; his own page carries none of it. The
help line (`door.help`) is a plain sentence, nothing bold, brass or linked; the door holds no link. D3's rules are unchanged.

**While any Sheet is open the page behind it is inert** (Fable's note on #133). `behind()` reads the DOM every time (a `[role=dialog][aria-modal=true]` that is not
hidden is open) and marks everything else at the root of the body `inert` with `data-behind`; the Sheet's own wrapper or scrim and body stay live, and a yes or no
over the order sheet shuts that sheet too. It is never a held flag, so no way of closing a Sheet can leave the page shut: every open and every close of the eight
Sheets calls it (the pay Sheet at both its openings, an order's Pay and the return from the bank), a close before focus goes back, and a lapse or a log out reaches it
through the closes they already make. A page that was shut by something else (Home's greyed stages) is left alone, since only `data-behind` is taken back. His page draws
Sheets of its own and is left as it was. **The yes or no's danger action is guarded**: its handler returns unless its own Sheet is still the open one, so a second tap
or a stale button cannot send a cancel twice. A device that has not chosen a look is asked at its first sign-in, so a test that reads `[inert]` stores a look first.

**Every Sheet gives the focus back to the control that opened it, through one road** (13 Oct 2026, the stress run's cosmetic finding; `test/counter-stress-fixes.mjs`, its
mutations in `test/counter-stress-fixes.mutations.json`): `focusBack(from, again)`, after `behind()`, focuses the opener, or, if a redraw replaced it, the control
`again` finds (`backFind(key)`: the control carries `data-back`, as the yes or no's opener carries `data-yn`). The order sheet, the yes or no, the pay Sheet (Home's Pay
`pay:now`, the overdue Pay `pay:od`, an order's `pay:<id>`), the signed-out Sheet (to Sign in on the bar), the bell, the look Sheet, the thread and Sign in another device
(`dev:another`, whose list is drawn again as it closes, so `drawDev` hands the focus to the new button) all end there. A lock, a sign-in done or another account passes
`quiet` (`=== true`; a close wired straight to an event gets the event and is not quiet) so focus is not sent to a page that is leaving. **A Pay radio chosen by the
keyboard keeps the focus**: `drawPay` rebuilds the sheet, so it reads the radio that holds focus (its name and value) before it clears the body and focuses the matching
one after. **The yes or no over the New order sheet closes alone** (`ynKeys` stops Escape, `ynOpen` shuts any question already open first): the stress run's "did not
close" on Cancel this order there was its runner counting the order sheet, which correctly stays beneath, as a Sheet that would not close; the page was not changed for it.

**Back closes the top Sheet** (13 Oct 2026, his yes: "Yes, Back closes the sheet"; stress triage R4; `test/counter-back-sheet.mjs`, its mutations in
`test/counter-back-sheet.mutations.json`). Opening a Sheet pushes one history entry at the same address (no new hash), marked in its state (`{sheet:n}`, n the depth), through
`bkOpen(name, close)` beside `behind()`; Back (a phone's button, a browser's swipe) is a `popstate` onto the entry below, which closes the top Sheet only through that Sheet's
own close, so the draft stays and the focus goes back to the opener by `focusBack`. A close that refuses is refused for Back too: the order sheet while Place is on its way
(`sheetDismiss` returns `false`), and the entry is pushed again. A Sheet closed by its own controls (the orb, the scrim, Escape, Keep it, an answer, a lapse or a lock) calls
`bkDrop(name)`, and the entry it pushed is given back by one `history.go(-n)` made once the current work is done (`bkOwe`, `bkGo`): a Sheet opened straight after a close takes
the entry over (the question opened twice, the signed-out Sheet a lapse draws after the order sheet it shuts), and Sheets that come down together go back once. After any open
and close the page is at the entry it was at and one Back leaves as it would have without the Sheet; the entry that was left is a forward entry (the history's length is one
more until the next push), and a Forward onto it is stepped off at once. A page that loads on an entry still marked (a reload with a Sheet open) clears the mark. **NOTHING IS
PUSHED AT AN ADDRESS THAT CARRIES A KEY OR A TOKEN** (`bkClean`): the path must be `/` or `/app` and the hash empty, a place, `#thread` or an order (`#o=<id>`), so `/s/<token>`,
`/app#<key>`, `/app#qr.<key>`, `/app#code` and anything else the hand-over or link road reads push nothing, and a Sheet there closes by its own controls alone (no entry was
pushed, so none is given back). Every Sheet the customer's page draws has a way out of its own (the orb, the scrim, Escape or a button), so none is left that Back cannot
close; the signed-out Sheet a lapse draws closes on Back too, and the page keeps its Continue line on the bar. The one Sheet whose own controls refuse is the order sheet while
Place is on its way, and Back is held to the same. A browser that skips a history entry pushed before the person has touched the page (Chrome's history manipulation
intervention) would let Back pass over a Sheet drawn on an untouched page, such as a lapse on a page left open (unverified: the test browser's Back ignores it). Salt Account pushes nothing (`bkOpen` returns for `OWNER`, and the
`popstate` listener is the customer's alone), and the guest board, the shut page and the 404 run no script.

The suite section "Account leads with this device, and the door names the app" (`test/counter-account-door.mjs`, its mutations in
`test/counter-account-door.mutations.json`) drives all of it through the generated page in jsdom.

### Failures and public pages on brand (Phase 7d part 4, 12 Oct 2026, his yes of 11 Oct)

**A read that fails says when the page last read.** After the orders' read has worked once (`readAt`, stamped by `loadOrders` on a good answer), a read that
fails, being offline or one the site refused, leads Home with `read.since`, "Not updated since 10:42" (Kuala Lumpur, 24 hours; the day as DD Mon once the
last read was not today, by the Kuala Lumpur calendar), in place of the figure and the overdue sentence, and the pay foot, which holds the same figure,
goes with it (`staleNow`, `staleNode`, `payHeadNode`, `payFootNode`). The time is the last GOOD read's, never the latest try. The next good read clears the
line and brings the figure and its Pay back. A page that has not yet read once has nothing to date and keeps its figure and the orders' own line (`ord.unread`,
with Try again). Sign-out and a new sign-in forget the time. The test accounts need no case: it is not data, so `FEATURES` asks for none (airplane mode shows
it). `test/counter-offline-line.mjs`, its mutations in `test/counter-offline-line.mutations.json`.

**The maintenance page is the Counter's frame** (`stmt/maintenance.js`, which imports `stmt/words.js` and nothing else; `src/maintenance.js` is the Desk's
own and is untouched). The app's ring inline over a heading (`maint.h`) and one sentence, Tide (the page runs no script), under the same closed
policy, `default-src 'none'; style-src 'unsafe-inline'`, so no face, image or script loads. The sentence is read from `MAINTENANCE_UNTIL` in Kuala Lumpur
(`backWords`): `maint.at`, "Back at 14:30", or `maint.on`, "Back on 13 Oct 2026 at 00:01" once that is not today there; a moment past the minute is
rounded up, so the page never promises a time before the guard lifts. `MAINTENANCE_TEXT`, when set, still replaces the sentence, trimmed and escaped. The old
default sentence is retired. The answer is unchanged: 503, `retry-after`, `no-store`, JSON for a request that is not HTML, the machine routes in `MACHINE` passing.
`test/counter-maintenance.mjs`, its mutations in `test/counter-maintenance.mutations.json`; the guard's own section is "Maintenance guard on both Workers".

**The shut page and the site's 404 stand on the door's frame with the ring** (`onePage` in `stmt/page.js`: the app's ring in `.appmark`, one `h1` and one line, from
`shut.*` and `nf.*` in the table). Both are Tide and run no script, under the guest board's policy (`guestHtml`: `default-src 'none'`, styles by nonce,
`script-src 'none'`). **Every shut id still answers ONE page**, byte for byte the same but its nonce, status 404. The 404 is the plain `Not found` only for a request
that does not ask for a page: `notFound()` marks its answer, and the Worker's door (the last lines of `stmt/worker.js`) swaps a marked answer for `lost()`, the
styled page, when the request's Accept names `text/html` (a browser's address bar). A page's own fetch, a machine and a route that answers a 404 of its own in JSON keep
what they had. The 404 says one thing and echoes nothing of the path or the query; an unknown path past the `/all` check is the same 404 as any other. Neither page
names the app, a product, a shape or a level, in what it says or in its source. `test/counter-shut-404.mjs`, its mutations in `test/counter-shut-404.mutations.json`;
the shut kinds themselves are also held by "S8 8.2".

## The price list and the order book (06 Sep 2026, his instruction)

Three things sit behind the one password since v499: the statements, a **price list** for
the week, and an **order**. The page shows them in PLACES once the password has opened the record (S7 7.1, his
D11 of 24 Sep 2026; three tabs and a fourth until then): **Home**, which opens first, **Prices**, **Orders**, **Account**
(the statement and This device, whose Sign out is the one Log out) and **Rewards** for an associate. They sit on the system's App bar
at the foot of a phone and on its rail from 1080px. **Under 1080px the frame is equal** (his C2 of 28 Sep 2026): 16px on
every side, each safe area added, the App bar cleared by the same 16px, Home's sections one 24px gap apart and no row's
margin left after a list; Salt Account's shell takes the same frame, its rule placed after the shell's own, which would
otherwise win. A place keeps its tab's id (`stmt`, `order`, `card`) and has an
address (`#home`, `#prices`, `#orders`, `#account`, `#rewards`): a tap writes it, over an empty address or a place's
and never over a key, and a sign-in opens the place it names once. `placeShow` is the one road between them; a
banner's `#o=<id>` still opens Orders at that order. **Home** reads To pay now (S6 6.2, `drawPayHead`; since pay terms
V2 of 28 Sep 2026 an INVOICE, `nowOf`: a line for each order at Ready still owing, read off the order itself so it is due
the moment he taps Ready, and a line for each sealed part no order at Ready accounts for, in `claimAlloc`'s order (goods
out oldest first, then the orders at Ready with nothing handed over), then Less sent, what was sent on those lines or
against the account, spread in that order; the figure is the Total and its one filled Pay opens the pay sheet on the same
invoice, drawn whole there with each line's rate, when, goods, delivery and paid, then the totals. Home draws a line a
row with its due in a word or three, his "less words, but maximum impact". **Home leads with the one action** (Phase 7a,
his yes of 11 Oct 2026): the figure and its one filled Pay stand in a sticky foot (`#homeFoot`, `payFootNode`), the last
child of `#pHome` and pinned just above the App bar, so the Pay is never under it; from 1080px the rail replaces the bar
and the foot is static at the head of the first column. The head keeps the lines and the claim sentence, but only three
lines show: the rest fold behind a native details reading "N more" (`inv.more`, `invMore`, its open state kept across
redraws), and the pay sheet still draws every line. With nothing to pay now no foot is drawn and the head keeps the
verdigris tile; at a closing stage the foot is not greyed, since To pay now is the one thing left live. Over the line the overdue amount first, the
hold reading the sealed parts alone, so an order at Ready is due and never overdue; Orders is then the payment page),
Needs you (a reply not yet shown on this device, goods ready to collect, goods with them unpaid) and Coming up (an order
agreed or sent and not handed over, an order at Ready still owing excepted, then any sealed part no order accounts for,
`comingParts`) and **Order again** (S7 7.4): a tile a size, way and place they have
ordered, while the size is on their list, at today's price, whose tap opens the check with them, so the second tap places
it; a new account is offered its list's first sizes, and nothing is offered over the line. A new account opens on Welcome
and "Nothing on your account yet". Nothing about the statements changed.

**THE CUSTOMER SEES NO LEVEL** (S4 4.10, his D11 of 24 Sep 2026, reversing v659's "a very subtle tier
level, in symbol and colour"). Prices drew a glyph in the level's colour beside each product (`MARK`, v659
to S4); it is gone, and nothing on the page reads the level. The name still travels inside the sealed list,
as it has since v651, and the suite holds two lists differing only in level to the same Prices, to the
character. **Nor their own rate, nor a word that prices differ between customers** (his instruction of 27 Sep
2026): a product's pane is its mark and its sizes, the lead says nothing of history or of a week, and the
retired words are deleted from `stmt/words.js`, whose every word is served in the page's source. Since the
cap was retired the same day, the sealed list carries no `rate` or `orders`, and `basis` is `tier` or `board`;
the suite holds three lists differing only in history to the same Prices, to the character.

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
read. `tools/pricelist.mjs` is the whole rule: since v651 (his decisions of 15 Sep 2026) each board
size is the price of the customer's tier for that product, the tier held on the book or proposed from
what they pay for it, lifted only to clear the floor: the engine's `cardPrice`, which the desk's
printed board calls too, and the suite holds the two equal. **The cap is retired** (his decision of
27 Sep 2026): until then the tier was a ceiling, lowered to the best unit rate of their last four orders
before the week's Monday (v655), rounded down to the ten (v660); now what they paid before lowers
nothing, and nothing on the list is weekly. The v510 draw toward the ask retired with v651. **A product with no tier, held or proposed, is not priced**: the list carries it in `soon`,
the page says its price is coming soon, and the order sheet does not offer it. One
price per size, for the goods (v502): delivery is not on the list. It is a figure
he types **when he acknowledges the order** (v694; it was at ready until then, and the order becomes
a row at the acknowledgement, so the charge has to be settled there), the customer sees goods plus
delivery as the sum to pay, and the sale carries it as its own field, `delivery`, inside the total. Nothing outside the
engine prices: the publish opens the master in jsdom for the desk's PRICING inputs (the same the
drafter reads), which carry each customer's tier and the ladder, and calls `floorTotal` and
`cardPrice`. `node tools/pricelist.mjs --show <CODE>` prints what
a customer sees. `--no-prices` on the publish leaves the list out.
**The list's stamp is a digest of its figures** (S4 4.1), never `prices.at`, which the scheduled publish moves:
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
**The customer reads them in their own words** (S5 5.3, his answer to D11; one word a state since 11 Oct 2026): Placed, Confirmed, Ready to
collect or deliver, Collected or Delivered once the goods are all with them, Complete, Declined,
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
the list; it compares and prices nothing. **Order placed answers in the sheet** (S4 4.5); since Step 1b the bell asks for notifications, on every view of the saved app until they are on, only from a tap (nothing is asked on the way in since S4, where v693 asked; a sign-in files a phone already on again); See the order
closes the sheet and opens the order's own screen (S5 5.2). New order stands above Your orders, stage 5's rows, at the head
of their column, so on a desk the open order beside it starts at the top of the place and the Notifications pane is left to
Account's This device (S7-R3); on a desk,
while it stands beside an open order, that order's Pay is the lit ghost, one filled control a screen, and Pay is filled
wherever nothing else is (the limit in New order's place, the payment page, a phone). **Five open orders are said before the form**, in words (S4 4.6; since 11 Oct 2026 "Five open orders is the most", the number's word read by key, `num.<n>`, off the code's own `MAX_OPEN` and never off the count open; `MAX_OPEN` is exported from
`stmt/orders.js` and carried into the page, the Worker still the one that refuses): the Order tab says so in place of
New order, and the sheet opens on the open orders, each in stage 5's word for it (goods handed over in part say so),
Cancel on each whose goods have not moved, going on to the form once
one is gone (each Cancel asks in a Sheet of its own, below); a refusal those orders explain turns the sheet to the same list. **Every size on Prices is one tap to
the sheet at that size** (S4 4.8, rows of the plain ledger), and the list says **"Prices as at 24 Sep 2026, 11:59" (C17: every Counter date DD Mon YYYY, a weekday only before a due date)**
in Kuala Lumpur off its own `at`; a list sealed without one keeps "For the week of". **One delivery sentence**
(`DELIVERY` in `stmt/page.js`, S4 4.9) wherever the charge is explained: Prices, a delivery's check and a guest's
board: "Delivery is charged by distance. We tell you the charge when we confirm your order, before you pay, and you
can cancel then at no cost."

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

**THE SWITCH AND THE MOVE-IN (S10 10.3).** Since 04 Oct 2026 `wrangler.stmt.jsonc` ships `object` (10.5): the KV writes have stopped. `ORDER_STORE` in `wrangler.stmt.jsonc`: `object+kv` is the
week of reading both (the book holds the orders and is the one writer of their KV keys: its alarm writes
each order it changes a second later, moves inside a second as one write, and a write KV refuses again a
second after; a read the book cannot answer is read from KV; a move it cannot take answers 503 and is
written nowhere); `kv` is the old road and the way back, KV a second or so behind the book, and the alarm
still writes what is pending after the flip (**after the old keys are deleted, `kv` is a way back only through
`tools/orders-kv.mjs --restore <backup>`; the restored KV is the store as it stood at the flip to `object`, so a return to
`kv` loses the moves since, and `ORDER_MOVE_IN` is raised on the return to `object`, not on the flip to `kv`**); `object` stops the KV writes. The first request after the deploy that sets it **moves the book in, once**: every KV
order and the shared and chase marks copied in, then **a minute in which every move answers 503 "try
again in a minute"** (reads from the copy), so a Worker still on the old code during the rollout is the
only writer, then a second copy of whatever KV says differently, and moves are taken. KV is only read.
A copy's id names `ORDER_MOVE_IN`'s generation, the pass and the order, so either pass run again appends
nothing; raise the generation by one only to come back from `kv`, and it takes what the `kv` road wrote.
**Forgetting that is safe**: every order the `kv` road writes while the book is bound marks KV
`orderbook:road`, and the book's first request that finds a mark later than its own move-in moves in again,
a round of the same generation (`<gen>@<mark>`). The book looks for the mark at once in a new instance, which
every deploy makes, then once a minute while the instance is under fifteen minutes old (a rollout's tail),
then once in fifteen minutes (`roadCheck`), so only a laptop's `wrangler dev` on the `kv` road is seen late. A KV record the book has already held is behind it, so the
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
with `repaired`, `kvAhead`, `kvOnly` and `bookOnly` all empty. **Seven days after `cleanSince` is a clean week**: then `ORDER_STORE` goes to `object` (10.5).
**Retiring the old keys (10.5, built).** Under `object` the book writes no KV: `check` and `writeBehind` do nothing, arm no
alarm, and clear any `behind` row left from the week of reading both, so nothing recreates a key (`retired()`; `kv` is not
retired, its alarm still writes what was pending). The keyed, read-only `GET /desk/orders/store-check` (`X-Stmt-Desk`,
`storeCompare`, the book's `compare`) puts every KV `order:`, `aclaim:` and `thr:` record to the book and writes nothing, not
even `orderbook:check`: `same`, `pending` (the book has held it and moved past), `kvAhead` (a state the book never held),
`kvOnly`, `bookOnly`, and `retired` (true only when the store is `object`). Like every request to the book it runs the
move-in first, so a newer `orderbook:road` mark can start a move-in and its minute of 503s before it answers; it still
writes no KV. **`tools/orders-kv.mjs`**, laptop only, needs `STMT_URL` and `STMT_DESK_KEY`: `--check` refuses unless
`retired` is true and no record is `kvAhead` or `kvOnly`; `--restore <backup>` puts a backup's keys back (`kv bulk put`); `--backup` writes every value to `10_Data/orders_kv_backup_<date>.json` (gitignored);
`--delete` runs the check and needs a backup under an hour old holding every key, then bulk-deletes ONLY `order:`,
`aclaim:`, `thr:`, `last-placed`, `last-touched`, `last-said`, `last-theirs` and `orderbook:check`, through one allow-list (`allowed`)
that every list and delete passes. No other prefix is touched. Not yet run against live.
**The customer is handed a view, not the record**: their order list and every answer to a move of
theirs carry `customerView` (`CUSTOMER_FIELDS`, a whitelist), never `ledgerKey`, `queued`, `sync` or `rateAsk`; `rowOn`, the day the
key names, is read off it so the page can tell which part of To pay now is the order's; `rating` (F10) travels.

**A DELIVERY SAYS ROUGHLY WHERE IT IS GOING** (v694, his instruction of 18 Sep 2026): `place`, one
line of at most sixty characters, a neighbourhood and not an address, refused empty on a delivery and
dropped on a collection. It is shown on his card and **never rides into the ledger row's note**: a
note reaches the committed book, and free text a customer typed is the one thing here that could
carry a street. **Nothing is placed on one tap**: the page reviews the order in words first.

**AND MAY SHARE THE EXACT SPOT, SEALED** (his decisions of 10 Oct 2026): under the area a delivery offers Use my location
(read once, fresh, `getCurrentPosition` with no cache) or Paste a map link (Google Maps or Waze, read on the phone by
`pinRead`; a `maps.app.goo.gl` short link is kept as the link). Only while the site serves his slip key, and not on an
amendment, which keeps the order's spot. The point is held as a name is held (rule 2): the page seals it to the slip key
with the slip's protocol under its own info, `salt-pin v1`, so a spot never opens as a slip nor a slip as a spot, and the
area may then be left empty. `takePin` (`stmt/pin.js`) swaps the envelope for its id before the order book is asked, so
the book's events hold the id alone; `keepPin` files the ciphertext at `pin:<username>:<id>` for 30 days ONLY ONCE THE
ORDER IS RECORDED AND NAMES IT, and each read by the desk files it for 30 more. A test account's is never filed. The
customer reads `pinned` and never the id; Counter Admin says Location shared and opens nothing. **Only the desk opens
one**: the Site orders card, with the vault open, reads it keyed (`GET /pins/<username>/<id>`, relayed from
`/desk/pins/...`, never cached by `sw.js`), opens it with the slip key the one unlock holds (`ordPinPoint`), measures the
fee to it ahead of `vault-addr` and `PLACED` (F15), names it and never its figures, and offers File as their place, which
writes it into the places vault on the device through the vault's own road (`src: "pin"`, the address filed kept); never
for a friend's order or a `-R` bucket. **The batch** (his choice of 13 Oct 2026): above the order list, every spot opened
whose customer has no point filed, the newest order's for each (`ordPinBatch`), is filed by one tap, File all, under one
passphrase and one vault write (`ordPinFileAll`); the write decides again on the vault it has just read, so a point filed
meanwhile stands and the answer says so. A customer whose filed point differs keeps the card's own tap. The lock drops
every spot opened (`ORD_PIN`) and the batch's answer (`ORD_PIN_ALL`).

**AN ORDER MAY BE WANTED BY A DAY** (29 Sep 2026, the plan's future-dated orders): the sheet asks When you want it, As
soon as it can already chosen, or By a day, a date from tomorrow to `WANT_DAYS` (60) days on in Kuala Lumpur. The Worker's
`wantByFault` (`stmt/orders.js`) is the check, a real YYYY-MM-DD in range or nothing; `wantBy` rides on the order, in
`CUSTOMER_FIELDS`, and a sheet's lines share it. **It is a day they asked for and nothing more**: the Pending row stays
dated at the acknowledgement under the same key, its note carrying ", wanted by YYYY-MM-DD" in fixed words
(`pendingEntry`, never their text), and the term and the chase count from the handover, so nothing that prices or chases
reads it. The desk's card says it and how far off (`ordWantLine`) while goods are still to go.

**A DELIVERY ASKS AS SOON AS IT CAN, OR A FOUR-HOUR WINDOW** (his decisions of 10 Oct 2026): a delivery's When is As soon
as it can or one of six windows, 00-04 to 20-24 Kuala Lumpur, each its next occurrence within `SLOT_DAYS` (7) whose start
is ahead (`slotNext`), and never a day. One rule on page and Worker (`stmt/window.js`, its ES5 carried into the page as
text): a window the Counter's weekly Hours leave none of is not offered, and one they leave part of says "Delivery will be
between x and y", the part inside (`slotSpan`, manual override included). The hours are Counter Admin's own (`maker:hours`,
served with `GET /hours` as `config`, the weekly schedule and any override in the open, as the page already says them in
words); none set, every window is whole. The Worker's check at Place is `slotTake`: its end
ahead, its start at most eight days off, not wholly outside the hours read then; the order carries `slot`
(`YYYY-MM-DDTHH`) and `slotSpan` (`HH:MM-HH:MM`), a request he manages, never on the row. **His Accept may answer an
as-soon-as delivery with a window** (Q3), on the desk's card and Counter Admin's, a sheet's lines taking its first order's:
the desk's `slotOf` refuses one on a collection or on an order with its own window or day, which stand unchanged (Q2), and
one ended or more than a week off. The yes carries it in what he was shown (`shown.slot`), `ackOnApproval` sends it from
there, and `deskMove` cuts it to the hours read at that moment (`ackSlot`), his choice standing whole when they leave none
of it and left off when it has already passed, so an approved row never stalls. **The acknowledgement reminds them to pay
now, in words only** (Q4): "Please pay now if you can" on credit, "Please make your payment now" in advance, on the banner
and on the order while anything is owed; every term, the chase and the overdue gate stand.

**ITS FIRST HANDOVER REDATES THE ROW** (Step 2, 30 Sep 2026): on an order with a wanted day, the first handover on a later
day than the acknowledgement moves the row to the handover's day, so demand and revenue read from when the goods went.
`redateFrom` (`src/orders.js`) requires a wanted day, no earlier handover, and a row still on its acknowledgement's day.
The redate rides on that handover's Correction (or on the close if it is the first handover); the key moves with it,
later stages wait for it, and a rejection restores the old key. An order without a wanted day keeps its acknowledgement's
day. On the Counter, a part sealed before the redate is paired by its acknowledgement day until the next publish.

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

**Both cards carry every book's sales progress, and the reward on the tiered books alone** (F9, his answers
of 28 Sep 2026, revised the same day: "Rewards remains solely for salt", and associates "can see all but just
on the sales progress"). Both functions loop `PROD_ORDER` and fill `reward` only on a book the desk's
`tieredBooks()` names, salt where the window has none, null on every other whatever `networkStats` says. Each
page draws a book's reward block only where it is present, so a fixed board (oil, candy, rice)
shows the progress alone, on his card and theirs.

*What is left off, and why.* `share` is a ratio against the WHOLE book's revenue, so an associate
holding their own RM and their own share can solve for his total; `stars` are bands of that same
share and give a range of it; `rank` is a position among other people. None of the three is theirs
to know and none is needed to tell them what they did. The reward is in UNITS, with the distance to
the next as a **share of one unit** drawn as a bar, because the unit itself is a margin figure. No
margin, no cost, no floor, no other party's name.

*A reward that later covers part of an order carries no ringgit either* (his decision of 27 Sep 2026,
"drop the ringgit"). `coverPlan` values a unit at cost, so the statement's order line and Home's parts
to pay only name that the reward paid part of it (`part.cover`, no amount); a figure would hand a
customer salt's own cost per unit.

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
S6 6.4, his D8 as amended, then Phase 7b of 11 Oct 2026): **his banks first**, one Option tile a tap, **none chosen for them**
(from those `payHref` links, a suspended one never offered); then the figure, All or Part, and What this pays, the invoice's
lines in a shut Plan fold; then two ways, Transfer or Scan a code, Transfer chosen as it opens (the way, never the account). Their
username is the reference. **With a bank chosen on Transfer the sheet shows two rows: the account number, in groups of four for
reading with Copy (digits alone to the clipboard) and the bank's name, then the reference with its Copy.** Scan a code shows no
number. **The number is never in git** (rule 3): it is Counter KV `paynum`, `{v: 1, at, accounts: {<key>: {number}}}`, written from
the laptop by `node tools/paysync.mjs --numbers` (the pay store's number with its spaces stripped, refused unless 10 to 15 digits
or if `stmt/pay.js` lacks the key, nothing else carried, each key shown by its last four digits) and read back by `--check-numbers`.
It is served on a customer's session at `GET /pay/accounts`, whitelisted to `number` and to the accounts the page offers for a
transfer, `no-store`, `{ok: true, accounts: {}}` when none is filed or the read fails; the page asks at sign-in and again at a
sheet's open once the last answer is a minute old, and never on his read-only view. **An account QR Command has under maintenance
now is never offered** (his instruction of 17 Oct 2026): the same answer carries `down`, `{<key>: bool}` for every account
`stmt/pay.js` names, read live off QR Command's public `/state.json` through the service binding `QRCMD` (`stmt/paystate.js`), its
word winning over the baked flag a key at a time, as on QR Command's own phone; the page lays it on `PAY`, so `payHref` and the bank
tiles follow, a bank chosen before the answer included, and no number is served for it. An unbound, failed or
malformed read leaves `down` out and the baked flags stand; QR Command's own page still refuses a suspended code. **The practice accounts are answered their fixture's invented all-zero number** through the test-account
overlay (`paynum` in `tools/testfix.mjs`, `FIX_VERSION` 9) and never the real record. **With a number** the filled pill is I have
paid, straight to Did you send, and a ghost Open the payment page keeps the `payHref` link; **with none, and on Scan a code**, the
filled pill is the link as it was (Show the account number, or Show the code) and a ghost I am back moves to the same question, the
window's blur and focus staying as the fallback. **On return the sheet asks once** (S6 6.5, his D7), and after a reload too (kept on the device two hours as
`salt-stmt-payq`, never the username): "Did you send RM 70?", with Not yet, never a tap
beside the number; Yes posts a CLAIM (an order's to `/orders/<id>/pay`, To pay now's to `/account/claim`), which
reads "sent, waiting for us to confirm" on the order, its row and To pay now until his Received or Not found, each
shown when it comes; Pay then asks only for what no claim covers, **never the same money twice**: To pay now nets what was
sent on an order whose row is one of its parts (matched by `rowOn` and the whole figure), and the order nets what was sent
against the account that reaches its row, the lines walked as `claimAlloc` takes them (since V2: the rows with goods out
oldest first, then the orders at Ready with nothing handed over; an order at Ready with no `rowOn` takes none). The accounts it may name are `stmt/pay.js`, generated from the pay master by `node tools/paysync.mjs --sync` with no
number, payload or reference shipped (the suite holds `stmt/pay.js` to no run of five digits, and, on the laptop, holds every
tracked file free of every private value of the pay store, count only; every tracked text file but `master/`, `public/`, `ledger/` and `MEMORY.md` holds no
run of ten digits but a run of zeros, eight zeros and up to four digits, an order id's fourteen-digit stamp and its dash, a binary literal, a whole UUID, a hex digest, a blob or a 13-digit epoch beside a letter,
and four named constants, so a number joined from parts is how a test invents one; `tools/paysync.mjs` masks any run of five digits in every error it prints, and takes its executable from
`PAYSYNC_NPX` when set, which the suite points at a stand-in so no test can reach the real wrangler). **`payHref` in it is the one link builder** (D8, 24 Sep
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
**A slip on a claim** (F13, 29 Sep 2026): either claim may carry `slip`, a sealed picture `{v: 1, epk, iv, ct}` made on
their phone (the page's `slipSeal`, to the public half the site serves on their session at `GET /slip/key` from KV
`slipkey`); `takeSlip` (`stmt/slip.js`) measures its shape, refuses one over `SLIP_MAX` or a body over `SLIP_BODY_MAX` by its
content-length (`e.slipBig`, 413) or of any other shape, a bare id included (`e.slipBad`), and hands the decide functions
the id alone (`slipOf`), the first 16 bytes of its SHA-256 in hex, so the payment entry or the `acl` record carries
`slip: <id>`; ONLY ONCE THE CLAIM IS RECORDED AND NAMES IT does `keepSlip` file the ciphertext at `slip:<username>:<id>` for
30 days, so a refused claim stores nothing. Only a claim carries one: on any other move no claim names it, so it is never filed. The desk reads
it keyed at `GET /desk/slips/<username>/<id>`, 404 once lapsed. Nothing on the site can open a slip, and nothing
deletes one: it lapses with its 30 days. Salt Account draws one as a `blob:` URL, so the owner page's policy alone adds
`blob:` to its `img-src`; the customer page's stays `'self' data:`. The page says Slip sent on the order while its claim waits, and
Slip no longer kept after the 30 days.
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
on its order waiting or received, cash not folded, another account claim's booked row, a payment typed on the desk; and, since
pay terms V2 of 28 Sep 2026, an order at Ready being due at once, the rows of their orders he has made Ready, `ready`, which
the Worker names from the site's orders at `ready` with a `ledgerKey`, a cash-on-handover one included (his C1): each owes
all that is left on it, `txOwed - txPaid`, one with goods out in its place among the rows with goods out, then the Ready
rows with nothing handed over, oldest first; a Ready order whose row is not on the mirror yet leaves its share over, which
Received refuses on a tap until the fold lands it) as one Fulfilment a row, against the mirror and
stored nowhere (`POST /claims/<id>/preview`); the card draws it, and Received sends the digest of the rows drawn, which the
Worker approves only if the rows still stand, each with a yes of its own spent by the drafter (`madeBy` reads `claimId`),
then tells the site. More than the rows owe is never a tap. An order claim's Received is refused on a row an account claim
booked and no fold has landed, so no money is booked on a row twice. **Every tap that books money answers to what its row
can still take** (28 Sep 2026, after s210 took RM 210 twice, a claim against the account and then Cash received on its
order): Received, Cash received and a payment offered again are refused past the mirror's figure less every payment on
its way to the row by any road (`rowRoom` in `src/orders.js`), the tap's own entry left out. A row marked committed is on
its way until the mirror is re-seeded (`snapshot.at`), since the chain marks before it seeds. A claim of theirs refused so
is told its answer: Received, on the book already, or Not found, once the money is folded and its order has heard of it
(the return leg, the minute after the re-seed), and the refusal says which of those it is waiting on. **Cash on handover is withheld** from anyone holding an unpaid advance on any live
order, the one being paid included: settling that at the door is how one advance becomes two. It is an
order sheet's third way (S6 6.8), never To pay now's and never at Ready (pay terms V2, his C1: an order at Ready is due
now, cash on handover chosen or not, and says "Due now"), shown dashed with that reason where withheld;
choosing it sends no figure, because he records the cash when he takes it. **An order paid in advance** says "Before we hand it over" until
Ready makes it due now, and cash on handover is refused on it (`cashPrepay`, the tile dashed with its reason). V3's unit
cap per book (his point 4 of 28 Sep 2026), stamped at Place off caps written beside the list's stamp, retired in V5b2b
(his answer of 29 Sep 2026, "RM 250 replaces"): Place stamps nothing and the stamp is the figures alone again.
**V5b2a (his answers of 29 Sep 2026): RM 250 OWED AT ONCE, EVERYONE, DECIDED AT ACCEPT.** The desk Worker decides
(`advanceOf` in `src/orders.js`, inside `previewAck`): what the customer owes on every row of theirs and their bucket
(the engine's `partyOwedRM`: goods and delivery less what is paid; a gift, a write-off or a cancelled row owes nothing),
plus their site orders agreed and not yet on the mirror, plus this order with its delivery, against `TERMS.ceiling`.
**A sheet is one verdict** (his answer of 29 Sep 2026; a price he sets at Accept on one line moves the figure the others
read, each line counting at the money it is agreed for): its lines, placed or agreed and not yet on the mirror, count
together at their goods with the sheet's charge left out, so every line reads the same figure and digest whichever is
accepted first (once the lead's row lands on the mirror it counts with its charge, so a sheet at the edge can read the
charge more between a fold and the next line's Accept, which is then refused as changed, as any row a fold moves is).
The orders read are the list `findOrder` found the order in; unread, nothing is decided (503). Offered
again, an order keeps the verdict it was agreed on. `TERMS.ceiling` is the master's `RULES.creditCeilingRM` in a state key of its own beside
`PRICING` (never inside it, whose digest marks preapprovals). Everything counts until it is paid. Over it, the entry
carries `prepay: true` and the ack digest includes it, so his yes covers it and `applyPre` matches only what he saw; the
order is moved with `prepay` and `decideDesk` sets or clears it, the desk's verdict being the order's from then on. The
card says "In advance" or "On credit" with the figure before Accept, and "Paid in advance: RM x is still to pay before
it is handed over" on an agreed order while it is unpaid. The phone decides nothing.
**V5b2b: the page forecasts it.** The publish seals `RULES.creditCeilingRM` into each list
as `ceiling` (`ceilingRM` in `tools/make_statements.mjs`), outside the stamp, so a moved ceiling is no re-quote. The
sheet adds the sealed To pay now and Coming up, their agreed orders whose row no sealed part is yet (`onStatement`: a now part by day, side and whole, a coming part by
day, side and product, so an order accepted since the last publish still counts), and the sheet's lines at their
goods, and over the ceiling says once under the sizes "Over RM 250 owed with this order: likely paid in advance."; the
check carries "Likely in advance" and that the desk confirms it when it accepts. Nothing is sent at Place.

**V5b2c: lateness joins the verdict**
(his decisions of 29 Sep and 05 Oct 2026). `advanceOf` also reads the engine's `lateOffer` over `payDelays` on the book's
rows (the one walk, its `late` and `run`, never a second): a customer with any delay in all history is in advance until
`RULES.lateResetRepeat` (3, sealed in `TERMS` with `lateWindowDays`) payments on time in a row follow the last. On time is within `holdDays`; a paid-in-advance order
counts on time once handed over; an amount open past the term is late today. The verdict is the party's, so a sheet reads
one; the card says "paid late before, N of 3 on time since". The Counter page does not forecast it (only the ceiling).

**One sheet takes several products** (pay terms V4b, his point 5 of 28 Sep 2026, his Q3: one order a product, sent
together). The form draws every product on their list, its sizes under its mark (the segment of marks went with the
one-product sheet), a size of each they want; a size tapped again comes off, one product on the list always keeps its
size, and a sheet opens on what was picked last, else their usual. Review freezes a line a product, each its own `rid`,
and two or more share a `sheet` id minted with them; the check has a row a line, a Total, and the likely in advance
forecast, one for the sheet, on each line. Place sends the lines in order, the note with the first; a line placed is marked Sent and never sent again,
so a Place tapped after a refusal sends only what is still to go, and a retry the Worker answers `sheetTwice` is placed.
Leaving a check with a line placed (`dropPlaced`) takes that product off the picks: Change sends the rest under the same
sheet id, the note not again; closed, they start afresh. A moved list is read again line by line. The Worker keeps the `sheet` on each order (`SHEET_RE`, in the customer's view),
refuses a product twice on one sheet (`sheetTwice`), and **counts a sheet once against `MAX_OPEN`** (`openCount`), so
a line joining a sheet already open is never the sixth; the page's `openN` counts the same way. On the desk each order
keeps its own card, Accept and row; `ordSheetLine` names the others open on its sheet, each a tap to its card, and a
delivery still to agree says the trip is one, its charge on one order and RM 0 on the rest. **A sheet is agreed
together** (V4b.2, his word of 29 Sep 2026): while every order on it waits for his Accept (`ordSheetLead`, none with a
yes given or a refusal begun), its first order's card (by id, `ordSheetGroup`) carries one Accept for all, the charge
chosen there and every other order drafted and accepted at RM 0 (`ordPvDelivery`), each row drawn on that card and
Accept shut until every row is; the other cards keep Decline. While none has moved, the first card also makes the sheet
Ready and hands it over whole. The one tap is each order's own move in turn (`ordSheetAct` over `ordAct`), the plan of
charges fixed before the first move, stopping at the first refusal and saying how many went.
**The Counter Admin card takes the same charge rule** (`stmt/owner.js`, placed-order preview): RM 0, 10, 15 or Other, none chosen by default, and only a sheet's first order asks, the rest sending 0. The distance-based delivery offer is the Desk's alone: it needs the vault's places, which never reach the Counter.
The quote is the customer's claim
off his own list: the owner reads the rate against the party's usual on the phone before
acknowledging, and the drafter flags it again when the row is queued.

**The desk reads and moves orders through a service binding**, `STMT_SITE` in
`wrangler.jsonc`, sending `STMT_DESK_KEY`, a secret the same on both Workers. The direction is
desk to site for orders; the site's reverse `DESK` binding reads only `/stmt/rev` with the shared
key to verify live statements, never the ledger or an order. The
Site orders card under Order book (cloud desk) is the taps.

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
every row by two noughts, which is what driving the chain end to end caught), and since V4a (28 Sep
2026) `|product` after it on any book but salt, so two lines of one sheet on one day for one figure
are two keys. An order acknowledged before V4a carries the old shape: the desk's minute gives it its
tail once (`rekeyOrders`, marked `orders:keyed` in the desk's KV), and every road reads an order's key
through `ledgerKeyOf` meanwhile. The fold's replay guard and the drafter's twin flag compare the
product too, so another book's row at the same figures is never a replay. A Linked step's `refKeys`
are spelt the same way and read through `ovKey`. The pass is one way: code from before V4a reads a
tailed key as no row's, so a rollback past V4a strips the tails first, and `tools/product.mjs
--rename` refuses a book with rows until `--orders-done` says no order, entry, draft or fold still
holds its keys. The site records what
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
snapshot's `v` and a digest of the rest). **Step 2 (his Q10 of 28 Sep 2026): the price at Accept.** Both take an
optional `total`, the goods for this one order, up or down: the row, its key and so the digest are drafted at it, and
under the floor at that size (`floorFor`) or at nothing it is refused, and so is any price on a size with no floor of its own
(none known, or only a carded size below it): it is accepted at theirs. The card has a Price field a line (a sheet's too),
filled with what they placed it at, the floor said under it. `ackOnApproval` sends it with the acknowledgement, the only
move the Counter takes a `total` on (`decideDesk`); the order keeps what they placed it at as `asked`, their Goods line
saying so, and the row's note says it. Offered again, the order keeps its own total. No pricing state moves: the board,
`TIER_OF` and `PRICE_SET` stand, and what they paid never lowers a card. **Only an approved row moves the order** (`ackOnApproval`:
the key and moment marked first, then acknowledged with the charge), so a row that differs leaves the
customer reading Placed, and his approval under Approve moves it then. That is the one stage the desk
queues itself, because the row must exist before the order moves; `deskPass`, beside the reconcile,
follows it up each minute: it spends a yes a fault left waiting on its drafted row, and tells an order
its approved row again until `acked_at` says it was told. His approval under Approve spends any yes behind the row.

**The later stages are one tap too** (S11 11.12): **Collected or Delivered** (`/handed {qty, close}`,
the running total, in the order's own mode; `close` under the size is 11.9's close, previewed as the one
Correction it makes, `closeEntry`, and offered again as Collected's; a close under what they have paid files its yes
like any other since 06 Oct 2026, the answer carrying `refund`, the difference opening as a `customerRefunds` row when
the Correction folds, the engine's `refundOnOverpay`), **Received** (`/received {amount}`, their recorded payment
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
cancel). Not needed (`{drop: true}`) files rejected stages as `covered` (`covered:<rid>` against the hand row that holds a paid order's cash, which one row can hold once), offering nothing again and drafting nothing: with no row on the book (his pending row rejected, no draft approved) it covers every rejected stage at once, refused while a payment claim is among them; with a row it covers one named cancel, move or amend, never pay, cash or a pending row; any live yes on a stage refuses all. The fresh entry keeps the move's figures and day, and is approved as it is drafted only if it
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

**THE CHASE** (v700, his instruction of 18 Sep 2026; twice a day from S12 12.3, his decision D5 of 24 Sep 2026;
**every hour from 08:00 to 22:00 since V5**, his answer of 29 Sep 2026). This is the **first clock the statements Worker has ever
had**: until v700 it woke a phone only as a side effect of the desk touching an order.
`wrangler.stmt.jsonc` carries `"triggers": {"crons": ["0 * * * *"]}` and `stmt/worker.js` exports a
`scheduled()` handler beside `fetch`.

**Who is chased.** `isAdvance(o)` in `stmt/orders.js`: the order is agreed (`ROWED`) and its goods are
ahead of its money as the engine reads Open · Advance (24 Sep 2026): the share handed over above the
share of what is owed that is paid, the delivery charge in what is owed because that is what the
customer is asked for. The same test (`aheadOnGoods`) withholds cash on handover. A customer who has paid nothing on an order he has not touched yet is not
chased, because nothing of his is in their hands: **only goods received are chased**. `toChase(env, at)`
groups them by CUSTOMER, and leaves out an order inside its day's grace or with a claim waiting.

**When.** **Every hour from 08:00 to 22:00 in Kuala Lumpur** (`chaseSlot`, `CHASE_HOURS`; V5, his answer of 29 Sep 2026,
"hourly", in place of D5's 10:00 and 18:00) **for three days from the oldest unpaid handover, then at 10:00, 14:00 and
18:00** (`chaseDue`, `chaseDay`, `CHASE_LATE_HOURS`; his "taper" of the same day, the handover day 0): the cron stays hourly
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

**AND THE ASK, HOW WAS YOUR ORDER** (F10, his Q9b of 28 Sep 2026), at the same slots. `toRate(env, at)` names each
order whose units are all handed over (`handedAll`, never a part handover or a cancelled order), not rated and never
asked, whose last handover (`movedOn`) is at least `RATE_AFTER` (2) days before today and under `RATE_UNTIL` (14), so an
order from before F10 is never asked about. `markRateAsk` writes the ask on the order first, as its own event
(`rateask`, one of the book's writes, refused while it moves in; `rateAsk` on the KV road), and only the call that
wrote it wakes: a tick firing twice asks once. One wake a customer a slot, kind `rate`, **How was your order?**,
opening the newest order it asks about; the test accounts are skipped, and so is a customer owed a chase that slot
(nothing written, so a later slot asks: the two banners share an order's tag and the later would replace "A payment is due"); the handler logs `rate: {slot, asked, quiet}`.
A phone with no push meets the same ask as Home's card (`homeRate`, the same two days and fortnight), and the order
itself asks for good once the two days are past (`oRate`). **The rating** is the customer's `rate` move, `POST
/orders/<id>/rate {stars}`: a whole number from one to five, once every unit is with them (`e.rateEarly`), once
(`e.rated`; a second is refused, never a change of mind), folded as `rating: {stars, at}`. It marks `last-theirs`
`|rate`, so his minute nudge says **A customer rated an order**, and his Site orders card shows it as five marks with
the figure, or that they were asked and have not answered: a rating in the last fortnight keeps its order on his
default list (`ratedSince`), and `GET /desk/orders?all=1` carries every one. **It prices nothing**:
no entry, row or note reads it, and a rating queues no stage (`orderWork`). A word about the order goes on its thread.

**ONE THREAD AN ACCOUNT** (Step 7, his Q5 of 28 Sep 2026): a question about no one order. `{id: "thread", u, kind: "thread",
at, msgs[], quiet?}`, folded in the order book from `tsay` and `tmark` events under oid `thread`, one row an account in
its own table `thr`, written behind to `thr:<username>` in the week of reading both. The KV road has no reader: there a
line is refused (`e.threadOff`, 503) and the read is empty. Routes: `GET` and `POST /thread` on their session (a line
under its device-minted `rid`, so a retry lands once), and `GET /orders` carries `thread` beside the orders (the orders,
the claims and the thread read from the book in ONE round trip, the book's `mine` through `accountBook`, since 06 Oct 2026;
it was three, every ten seconds for every open page); `GET
/desk/threads` (every thread, newest first) and `POST /desk/threads/<u>` `{message}` or `{noReply: true}` on the desk key.
Theirs: 200 characters, 20 a Kuala Lumpur day (`e.threadCap`); his uncapped; the last 200 lines kept. A line of theirs marks
`last-said` and touches no order; his wakes them as kind `message` (`Counter says:` and his words in quotation marks, tag
`m-thread-<at>`, a push topic of its own), a tap opening `#thread`. The page opens it in a Sheet from Home's card and a
row on Account and reads it every `THREAD_POLL_MS` (2 seconds) only while the Sheet is open and the page showing. A test
account's thread lives in its fixture (`exampleThread`, `exampleSay`); the desk cannot write one.
**His side** (7b): the desk Worker's keyed `GET /threads` (each with its desk code) and `POST /threads/<username>`, which
sends on only `{message}`, past `siteWords`, or `{noReply: true}`; `GET /orders` carries `threads`, and `/push/summary`'s
lines take their thread lines too. On the desk each thread is a card of Waiting on you (`thrCard`): an Asked act while
their line is the last and not marked No reply needed, else under Chat; read every 2 seconds (`THR_POLL`) only while one is
open and the desk showing. `public/sw.js` never caches `/threads` (`salt-shell-v7`).

**A CRON REACHES PRODUCTION ONLY THROUGH A DEPLOY OF THAT CONFIG.** `wrangler.stmt.jsonc` is on
`cloud-commit.yml`'s push paths (since 03 Sep 2026), so a push to master that touches it runs the job, and its
`Deploy the statements site` step deploys it. `public/rev.json`'s id does not cover it, so `tools/update.mjs`
reports the phone current and ships nothing: a laptop change not yet pushed, or a push whose Actions run was
refused, needs `npx wrangler deploy -c wrangler.stmt.jsonc`.

`wrangler.stmt.jsonc` sets `preview_urls` to `false` (09 Oct 2026, as the desk did on 03 Oct 2026), because a version's own preview address would sit outside the Access application that covers `/all` by hostname. Nothing used one (checked 09 Oct 2026: no reference in the repo or the workflows).

**AND A PAYMENT THAT COMPLETES AN ORDER WAKES THE PHONE** (v700). It is the one customer move worth
waking for, because it is the only one whose answer arrives after they have put the phone down;
every other move of theirs happens with the page in front of them. The page's own words are his:
"Your order is now complete. Thank you for your loyalty."

**HIS ALERT ON A NEW ORDER** (v675, 16 Sep 2026; silent before it, because the switch left with the
phone app at v387 and nothing had subscribed since). A placement writes `last-placed` in the site's
store; the desk's every-minute cron reads it through `/desk/orders/last?work=1`, one read that also
carries the orders the reconcile owes (`tickRead`, fold 5.6; a Counter answering the marks alone makes
the reconcile ask `/desk/orders?work=1` itself), and a moment newer
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

**Notifications.** The page polls the customer's orders every ten seconds while it is on screen;
a hidden page's tick reads nothing, and its return re-reads the account and the orders.
For a closed page the site has its own Web Push pair. **The banner is a plain sentence of its kind, in his words** (S12
12.2, his decision D4 of 24 Sep 2026; his sentences of 28 Sep 2026, Step 1b): each move sends `{k, o}`, a kind and the order's id, with the case its body is chosen by (`v`, `payCase`: owed, waiting on his Received, or paid) and, on his line or his reason at Decline or Cancel, his text (`t`, cut to 200, checked by `siteWords` on the desk), derived
by `wakes` in `stmt/orders.js` off the event and the order it folded into, so the KV road and the order
book send the same kind for the same move, sealed
for that one phone by `sealFor` in `stmt/push.js` (RFC 8291 aes128gcm, WebCrypto, one record), and
the service worker at `/sw.js` shows the kind's title and body from `news.*` in `stmt/words.js`: confirmed (pay now on
an order paid in advance, `prepay`; on credit otherwise, due at Ready), ready to collect or on its way, his line (`Counter says:`,
his words in quotation marks), payment received or not found yet, payment due, delivered or collected (in part or in full),
complete, declined or cancelled with his reason. **Never an amount, a product or a name**; the suite reads every word.
One banner an order: the notification's tag and a sealed wake's push `Topic` are per order (the topic a
digest of the id), so news of one order never replaces another's on the lock screen or at the push service; a line
of his takes a tag and a `Topic` of its own (over the order and the line's moment), so none of his words is replaced
unseen. **Ready is his to tap again** while units are still owed on an order at ready (his 1.13 and 1.14), telling them
the rest is ready.
A tap opens the Counter at `#o=<id>`; a Counter page already open (never a guest board or Salt Account in
another tab) is sent a message instead, re-reads its orders, patching only what changed, and opens that one,
or, its session lapsed, keeps it until the phone is back in (reopened from its memory, S3 3.5, or signed in
on the Sheet). A return to the page (S3 3.5) and a lapse reopened patch the orders the same way, so an open
order and a half-typed line survive; only a head of the tab the account now draws differently (the prices, the
payment page, the open orders reaching or leaving the limit) draws the tab again. Neither ever draws the order sheet or
its check; only the sheet's limit step, which holds nothing typed, follows the orders. A subscription filed before its keys gets a payload-free wake and the
fixed words (Order update), so nothing already subscribed went dark; the page re-files the keys at the next
sign-in. A notice keeps its own road: its wake carries no payload, and the service worker reads
the public `bulletin` (v761). The lines already up, set again, store nothing and wake nobody
(`unchanged` in the answer; Salt Account says "That notice is already up. No phone was woken."),
and Salt Account's Notice box empties once a notice is set (11 Oct 2026). On an
iPhone the page has to be on the Home Screen first; the copy says so. A subscription is filed at
`push:<username>:<endpoint hash>` with the phone's two keys, `p256dh` and `auth`, when the page sends
them (`pushKeys` in `stmt/push.js`); a pair that is not one is dropped and the record kept without it,
and a pair that passes the shape check but will not seal gets the payload-free wake.

**Setup, once:** `node tools/stmt-setup.mjs` mints `STMT_DESK_KEY` onto both Workers and the
site's push pair (`STMT_VAPID_PRIVATE_JWK` as a secret, the public key written into
`wrangler.stmt.jsonc`), then commit that file and push. Until the desk key exists the desk's
`/orders` answers 503 and the site's `/desk/orders` refuses everything; until the push pair
exists the page says notifications are not switched on.

### Any quantity, and Negotiate (his decisions of 05 Oct 2026)

- **Any quantity at an automatic price.** Each book's `TIER_RULE` carries `grid`, {min, step, max}: salt 0.5 to 25 in
  quarters, oil 10 to 50 in tens, candy 1 to 30 and rice 1 to 10 in ones (his word of 15 Oct 2026: each book is ordered in its
  smallest unit step, and `step` is that setting, read by the page's field, the Worker's `onStep` and nothing else). The publish seals each customer's `grid`
  ({min, step, max, p[]}, the engine's `quoteGrid` at their drift) beside the board's `sizes`, and writes the steps alone,
  no price, in the clear beside the stamp (`priceSteps`). The stamp covers the grid. The page reads every figure through one
  `priceAt(P, q)` and works nothing out. The Worker refuses a size off the step (`offStep`) or over the max (`overMax`,
  Negotiate's alone, and still a whole number of steps from the min: oil 60 is asked for, oil 55 is refused) and **a Place with no stamp** against a stamped list (as moved, 409 with the list). The desk Worker's
  card at any size is the engine's `quoteAt` on the snapshot's inputs and the drift it carries per code (`cardAt`).
- **Negotiate.** An order placed with `ask` (a figure of theirs optional, a number only) waits in `price` (asked). His offer
  is the goods alone (`POST /orders/<id>/offer`): drafted as Accept drafts it (never under the floor), filed as an ack
  pre-approval with no entry and `shown.offer`, digested on the row's figures and flags only (`offerDigest`), open 48 hours.
  Their Accept (`take`) is followed at once through the maker bridge and by the minute's `deskPass`; the row is drafted at
  the offer and his yes is spent only on an exact match, else it waits under Approve, marked. One live offer an order; an
  open offer freezes it (their amend and cancel, his decline and cancel: `offerOpen`); the lapse and the size are read at
  the take. Limits: two asks open an account, none while a claim of theirs waits, none for a friend (a `-R` bucket) or on a
  sheet; while the overdue gate is on the page closes the sheet, Negotiate with it (the Worker cannot read the sealed
  `pay`). Their view of it is `priceView`: {state, total, delivery: null, until}. The accepted price stays on that order.
- **His Accept, for their yes** (version 2, his decisions of 10 Oct 2026). `needsYes` decides it: goods above what they
  placed it at (to the sen), or a window other than the one they chose. Never his first delivery charge, never a window on an
  order asked for as soon as it can, never a lower price. Accept with either is refused (409, `needsYes`), and the card, or
  Counter Admin's button, sends it instead as an offer of the whole order as he would agree it (`POST /orders/<id>/offer`
  with `slot`, the preview's `offerHash`): `{id, kind: "accept", total, delivery, slot, until}`, `until` from `acceptUntil`
  (48 hours, or the window's start when that is an hour or more ahead and sooner, else its end), the window cut to the hours
  as at an acknowledgement and refused once past. His yes is filed as an offer pre-approval and no row is queued. Their Yes
  is Negotiate's take, drafted and spent only on an exact match (D6), the acknowledgement carrying the offer's window
  (`slotShown`); their No thanks cancels the order at no cost; his Withdraw or the lapse (`acceptClosed`) leaves it placed,
  his to Accept at their terms, send again or Decline, and Accept then lets the old yes go. A sheet that would need their yes
  is refused (his Q7), and so is an offer with nothing to agree. Their view adds `from: "accept"`, the delivery and the
  window; it is never an ask (`askOpen`), and its push is `confirm`, words only.

### Publishing, and the one-time setup

Statements reach the site through the two steps at the foot of job `chain` in
`cloud-commit.yml`. **`Deploy the statements site` uploads the site's CODE** and runs on a push
touching `statements/`, `stmt/`, `wrangler.stmt.jsonc` or the two tools, and on every fold.
**`Publish the statements, live` writes the site's CONTENT and runs on every run but the key probe**
(16 Sep 2026, on every deploy; every run since v701; what asks for one: "What asks for a publish", above): the content is the ledger and the master, so any version that moves a price makes a
published list stale, and v652, v654 and v655 each left the customers' pages on the lists sealed
at v651 while the desk quoted something else. Both run after every step the ledger needs, so a
fault in the statements can never leave a folded row unmarked. The publish is `tools/stmt-publish.mjs`: it
seals the live statement into each of the newest issue's records under the content key, stamps it
with `public/rev.json`'s Desk build id, puts
them all in **one bulk call**, retires every record the issue does not carry (so **issuing a
new set retires last month's**), and clears the attempt counters on a new issue only. **A failed
read of the store's `issue` is not a fresh store** (27 Sep 2026): only wrangler's 404 is absent, a
lapsed login is tried once more, and any other failure publishes as usual, clears no counter or
older tick, and says why in a warning in wrangler's words, his answer, since stopping would fail
the chain job and skip its suite. After the bulk write, every intended real account record is read back and compared in full. KV is
eventually consistent, so a record not yet read back is read again, alone, after 5, 10, 20 and 30
seconds (`ACCOUNT_READBACK_WAITS_MS`). A record that a later publish wrote over ours counts as
written (`supersedes`): the same username and issue, its live statement stamped strictly later.
The build id is not compared because a hash has no order, and the Counter withholds any stamp
the live Desk does not serve anyway. A record still missing or changed after the last read, or
one stamped earlier than ours, makes the publish fail before the Desk's account map is updated. The
Counter's `DESK` service binding and the Desk's `/stmt/rev` route use the existing `STMT_DESK_KEY`;
either missing configuration, a failed read, or an invalid id withholds the live document. The Desk
answers `GET /stmt/rev` before its human Access gate, since a service binding carries no owner JWT:
that one path alone, keyed and read-only, so `REQUIRE_ACCESS` "1" never withholds every statement. A change
to `wrangler.stmt.jsonc` deploys with the push that carries it (it is on the push paths); only one not yet
pushed needs the hand deploy. Without `STMT_KEY` in the cloud the records go up
as issued and "Now" is simply absent; the step warns.
`node tools/stmt-publish.mjs --dry <dir>` writes the bulk files and touches nothing. Each wrangler
call is a process, so it reads as little as it can (fold 5.5, 26 Sep 2026): the guest links in one
list and one `kv bulk get`, falling back to a get per link, with a warning, when that open-beta
command does not answer as text; and the three lists that feed only the retirement not at all
under `--no-retire`. Every intended real account is verified by a separate bulk read, falling
back to individual reads with a warning if the bulk read fails or has an invalid shape. With eight
links and up to a hundred accounts, the scheduled run spawns eleven processes, including the two
test-account reads and the real-account verification.

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
- **Needs you is a ranked inbox** (Phase 1b, 11 Oct 2026): every thing that waits on him is one card on the system's Action recipe
  (`salt-action`, coloured by its `--salt-sev`), headed Now, Soon or Watch, the oldest first in each. **Now** is a customer waiting:
  an order placed, a payment they say they sent (on an order, summed and as old as its oldest, or against the account), a message asked
  (an account's thread, or a question of theirs on an order, open or closed, that he has not answered and not marked No reply needed:
  the Worker's `awaitingAnswer`, kind Messages, `om:<order>`, which is also what marks that order Waiting on you in Orders), an account refused at an address. **Soon** is his own work: a Desk row to approve, an entry that did not get through (the drafter's
  refusal, a refused server-held entry), a stage he rejected under Approve, a guest link, an ID with no account, accounts nobody has been
  sent. **Watch** is the Desk's own count line, an override in force ("Closed until Fri 18:00") and a notice set. A card is its kind word,
  who (the code), what (book, units, RM), its age (minutes under the hour, hours to two days, then days) and one **Open** that goes to the
  detail by `showPlace`: an order, a payment on an order or a question on an order to Orders, the stage it stands at (payments they say they sent to Payments), with that order's card open, a message to Customers > Messages with that thread open, an
  account beside the list on a desktop and on Accounts on a phone, a link to Customers > Links, a row or an entry to Orders > Approve, the
  hours and the notice to Shop; the Desk's line has none. **One filled pill, only where the page already has that exact action as a single
  tap**: Approve (Approve both or Approve all on a trip) on a Desk row is Orders > Approve's own function (`approveDraft`: the same question, on the page's Sheet, the same request,
  the same answer line; a customer's claim row has none, it is answered through Received on its order), and the guest link, the refused
  account and the accounts not sent keep the action they had. **A card is titled by what to do, verb first, then who, with the figure under it** (17 Oct 2026, "Agree CQ5-HAR's order", "Confirm CW4-FEL's RM 500.00", "Reply to CX7-LUM"); the kind word is a small eyebrow. **Its main button is on the card and reaches the same function the full card's button calls**, never a new road: Reply and Agree (which needs the delivery charge and the window) open the full card; a money tap asks once on the card, "Confirm RM 500.00 received from CW4-FEL?" with Yes and Cancel, and Yes calls `orderReceived` (an order with one payment waiting; several open the full card) or `sendClaimAnswer` (a payment against the account, after its rows are read as the card does; rows needing a look open the full card), under the one request id and busy flag the full card uses, so a second tap sends nothing. Practice accounts leave Now, Soon and Watch for one folded line at the foot, "Practice: N", which opens them in place, and are counted nowhere. The line under the title is "12 to do now · 11 soon", or "Nothing needs you"; **a failed read is named by its own banner**
  ("Couldn't read orders and rows and messages"), so a failed read is never taken for nothing waiting; the chips under it (All, Orders, Payments,
  Messages, Rows, Accounts) filter the one list and read nothing; they are drawn as the parts strip is (a `tablist` of `tab` pills, the one in
  force `aria-selected`), because the recipe draws a selected pill from `aria-selected` and `aria-pressed` is styled on a ghost alone. **Every item of the bars carries its count**: Needs you the Now, Orders
  the open orders (not ended or completed; only Needs you counts what waits on him), Customers the threads asked and the links waiting,
  Record and Shop none, the same on the rail and the bar and never a practice item. **It is read on entering and again every 30 seconds while it
  shows**, as Orders is: the orders and rows, the claims, the threads, the hours, the notice, and (after the page has read them once) the
  accounts and the links; the poll stops when another place shows or the page is hidden, and a page that comes back reads at once. **A tick reads
  nothing while an account is viewed as them**: the page hides his own then (`#roster` hidden), nobody is looking at it, and the read goes on the
  moment he is back (`tickPlace`). **It also stops
  when his Access sign-in ends**: the read that meets the lapse gives the page way to Sign in again (`ended()`), which clears the poll, and
  nothing sets it again on that page, so no further request goes to the login. No read
  starts while another of its kind is out (the newest review wins), a read that finds what it found last time draws nothing, and on
  Orders a poll leaves a part he has begun on (a field open, a claim opened, a slip open, cash held, a tap in flight) alone. **A tap inside
  Orders that redraws nothing (View slip, Close and lock slip) holds the Orders poll off that part until he leaves Orders or
  taps Refresh, and a claim's card opened holds the claims off until it is closed**: what it shows may be stale, and is never disrupted. No route,
  body, request id, retained send, vault or cash rule changed.
- **Salt Account opens on Needs you** (S9 9.1, the plan's section 5): a card a thing that waits
  on him, its action on the card, the tap answered there. A card about an account opens it with its Open:
  from 1080px beside the list (the first such card's account until he picks one, the
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
  figure is as fresh as the desk's last read, and Needs you (a Watch card) says when: "N things wait on the desk, as at 14:06." Once
  an order has moved since that reading (the site's `touched` mark later than `at`, `moved` on the sheet's `desk`) it
  says so in the past tense: "Nothing waited on the desk as at 09:00, and an order has moved since." The
  desk's page reads its orders with the count of
  associate links waiting on his word (`/desk/orders?links=1`, `linkWaiting` in `stmt/refs.js`, the
  `approved === false` test), and its rail's foot says "N links wait in Salt Account".
- **His places** (S9 9.2, made five on 11 Oct 2026): Needs you, Orders, Customers, Record and Shop; "Maker" is retired on
  screen. The system's App bar on a phone and its Desk rail from 1080px, a count beside a place that has something waiting
  (Needs you, Orders and Customers; Record and Shop have none; see Needs you above). Each place but Needs you has its parts as the system's tab strip, the first
  open with the place: **Orders**, drawn from 18 Oct 2026 as two strips of one list of parts: the six stages first, in the order an order moves (Received, Agreed, Ready, Delivered or paid, Completed, Ended, each with its count of what waits on him), then a smaller strip beneath for Approve, Payments, Group and Ledger; every part keeps its id, act, address and read, and `PARTS` is both strips together. A row is one line, the code, the mark with the size written once, the total, Deliver or Collect and the age. An order's card leads with the answer: at Received, **Agree** is the filled pill at the top with the terms it will send beside it in one line (`Delivery RM 10.00 · as soon as it can`, kept in step with the card's choices); until the figures are read it is a stand-in that sends nothing (`order.accept-wait`: it asks for the delivery charge and opens Change terms, else says it is reading). **Change terms** (the goods' price, the delivery charge and the time) and **Answer them** (the reply) are folded sections, shut until a tap (`order.terms`, `order.answer`; a question of theirs opens the reply); Decline stands apart at the card's end, in the flow and never sticky, as a ghost danger button; the main action stands directly under the card's head, above Goods and Details, and each Orders strip is one row that scrolls sideways. The later stages lead the same way: Ready to collect or deliver, Handed over with its units and tiles, and their claim's Received and Not found stand at the top, Cancel at the foot. Nothing any button sends changed. The parts are (Placed, Confirmed, Ready, Done, Ended, Approve, Payments, Group, Ledger; Approve, from 17 Oct 2026 as the Desk's Order book holds it, is the Desk's rows waiting for him and the entries the server holds, and the old address `#record/approve` lands on it: the order review filtered by the customer's stages, an order in exactly one, and what waits on him a pill on its row and a count on its stage; opens on the first stage with something waiting; from 860px the first order of the stage opens in the detail column; the account
  claims under Payments, the group orders under Group, Order for them at the head of the place), **Customers** (Accounts,
  Messages, Links, Associates: the list and the card, the chat, the guest links, the report card), **Record** (Entry,
  Customers, Pricing: the forms by the part they belong to; each waits for his approval under Orders > Approve) and
  **Shop** (Hours, Notice, Practice, This device: the operating hours, the notice, the two test accounts, and this device's Look,
  see "His look" below). `data-in` on a section, a card or a
  form names the places and parts it shows in (`orders` is every part of Orders, `orders.group` that part alone) and the owner's
  script hides the rest. **Each place reads only what it shows, on entering it, and a part on entering the part**: Orders reads the
  orders and the claims (the stages are one list, so moving between them reads nothing) and its Approve part the Desk's rows, Record the forms, and
  the parts of Customers and Shop each their own; entering Shop reads no order and entering Orders reads no form (Needs you reads what
  its cards are drawn from, and not again within 30 seconds of its last read). No route, body,
  request id or retained send changed. **The addresses**: `#needs`, `#orders`, `#customers`, `#record`, `#shop` and a part
  as `#orders/ready`; the old ones stay (`#maker` Orders, `#more` Shop, `#accounts` and `#links` those parts of Customers, `#cards`
  the associates' report card). A tap writes the address, so Back and Forward move between places, and a customer's place is never
  read off it. Every rule of the owner page in `PAGE_CSS` sits under `.adm`, the root of his page; the suite refuses one that does not.
- **Orders are a list and a detail** (Phase 1c, 11 Oct 2026, his decision 9): each part of Orders is a list of rows in `#makerOrderList`, the
  system's Inbox row (`orderRow`): the mark with its units, who by code, the pill Waiting on you when it waits on him (the stage is the part he is in)
  with what is asked of him beside it (Says sent, Offer again, Asked, Cash held, Practice), the units and delivery or collect, the age and the
  figure (goods and delivery). A row carries no preview, which is a read the Desk charges for. A row (`order.open`, key the order id) opens
  that order's card in `#makerReview`, **today's card with every control, request, request id and guard it had**, drawn for the order opened
  and for no other (`drawOrderPane`, from the read that stands; a tap that redraws keeps the order open). A closed order's card has its
  figures and nothing to move it by; one with a stage he rejected keeps its Offer again; one with a question of theirs he has not answered
  (the Worker's `awaitingAnswer`, read by `orderAsked`) has the reply and No reply needed alone, with no Decline, Cancel or reason; and cash
  held for an order keeps its Undo or Retry on a row of its own. An order with such a question is marked Waiting on you. Done and Ended each list at most fifty orders with nothing else asked of him, and every one that also waits on him (never dropped); its note counts what it shows against every closed order ("51 of 56 closed orders are shown."). **From 860px the
  list stands beside the card** (a grid of 280 to 360px and the rest, the card sticky and scrolling inside itself); **below it the card
  takes the list's place and has a way back** (`order.back`, the head of the card, which also returns him to the row he came from). Between
  860 and 1080px, where the App bar still stands, the page widens for Orders alone, the other places keep their 600px column, and the sticky card's height gives up the bar's (it was 40px under the fixed bar at 1024x768; now 24px clear). **Back,
  leaving the part, leaving the place, and the order leaving the part (agreed since) each close the card**; a read that finds the same
  leaves it, and tapping the part he is in does not redraw what he is typing in. A row tap takes him to the top only while the card's way back
  shows (below 860px); from 860px the list is the page's scroll and the card is sticky, so the page stays where it is and the card is brought into view. The ids `#makerReview`, `#makerClaims` and `#makerPools`
  ride on the moved containers, so the map's selectors and the maker tests find them. **The owner's script shares the customer page's scope**
  (`stmt/page.js` splices it in at the end of the page script), so a name it declares at the top must not be one the customer's code declares:
  `oOpen` was both, and View as them met "oOpen is not a function" until the owner's became `ordOpened`; `test/admin-orders.mjs` section 9 compares
  the two lists, every declarator of a `var` list included (the owner's `HOW`, which overwrote the customer's pay ways, is `HOW_IN`).
- **An agreed order's card leads with its progress and takes money in one block** (15 Oct 2026, `test/admin-order-card.mjs` section 5). The head of an
  Agreed, Ready or Done order is Owed, Paid and Handed (`moved` of `qty`), with Says sent beside them while a claim of theirs is waiting; the goods and the
  delivery charge, already in the title, stand in Details. A Placed, Declined or Cancelled order keeps Goods, since no figure is yet owed. **Money received** is
  one block under its own heading, in the order the money comes: their claim answered (Yes, I got, Not found), then one amount (`order.pay-amount`) over two
  tiles, Bank and Cash (`order.pay-by`), and one button (`order.pay`) that says the figure and the road once both are there (Record RM 25.00, bank). Cash is
  offered on a Ready order only and neither tile is chosen there until he chooses; an Agreed order has Bank alone, chosen (plan 5, 16 Oct 2026,
  `makerPayControl`). Bank sends the order's `received` and Cash is still held ten seconds with its Undo, each body the one the two buttons sent before it.
  The reply stands below the block with their last line above it (They wrote, the moment, their words):
  the card drew none before. Cash held shuts the whole card, the reply included, and leaves Undo or Retry live.
- **Plan 5 of the order card** (16 Oct 2026, `test/admin-card5.mjs`). Change the order (`order.amend`) stands under the head, opening the same Sheet and the
  same `restate`. The units field has one button: at the units ordered it is Handed over; fewer units show More to come and That is all
  (`order.handed-rest`, More to come chosen), and That is all turns it into Finish at n of the size, asked on the Sheet and sent as the close it was.
- **The order card reads its own preview** (Phase 2a, 12 Oct 2026, his decision 6 of 11 Oct; `test/admin-order-card.mjs`, its mutations in
  `test/admin-order-card.mutations.json`). **A placed order reads its preview when its detail is opened**, once, and again when an input is
  changed: choosing a delivery charge or a window reads at once, and the goods total reads when the field is finished (`change`), taking
  Accept away as it is typed. **The Preview button is retired** (`order.preview`, and `order.preview-again` on an order with a rejected pending
  row, which reads its Accept again on opening). A row of the list, and listing, read nothing: only the opened order draws a card, so the Desk is
  asked once for an order he opens, and again each time he opens it. A redraw of the card (a read that changed, a tap) keeps the figures it has
  (`makerQuotes`, held against the order as it stood) or waits on the read that is out (`makerPv`), and never asks twice for the same figures.
  A delivery with no charge chosen reads nothing and says to choose one. A read that fails leaves no Accept, says why, and offers Read the figures
  again (`order.reread`). Nothing the request carries has changed: the route, the body `{total, delivery}`, Accept's digest and its single flight.
  **A charge or a time that did not save is not shown as chosen** (13 Oct 2026, the stress run's High finding; `test/admin-stress-fixes.mjs`, its mutations in
  `test/admin-stress-fixes.mutations.json`): the card holds the choice the last good read stood on (`chip.kept`, `win.kept`), and a read that fails (a 500, no
  connection, a refusal) puts the radios, and the figure typed under Other, back to it, with the card's line saying "That charge did not save" (or "That time")
  and what is still chosen; Read the figures again then reads for the choice put back, and with none chosen there is nothing to read.
  **An answer stands beside the control that asked** (13 Oct 2026, the stress run's Medium finding; same test): Save on Shop's weekly hours answers in
  `#makerHoursSaved` under it (`hoursSaid('week', ...)`; Set it and Back keep `#makerHoursMessage` under theirs), Make a link in `#gmsg` under it (`linkSay`)
  with the new link scrolled into reach, Refresh in `#makerRefreshSaid` under it, and an order card's own line (the #120 status) stands under the delivery charge,
  above the time and the figures, so that it is not a screen below the radio that asked. Each is a polite status line and is brought into reach (`block:
  'nearest'`, clear of the bar by `.adm .osaid`'s scroll margin); an answer whose card has gone from the list scrolls the list's line instead. The page's one line
  at the foot of Customers keeps the rest.
  **For a friend is the tick Sent is** (13 Oct 2026, the stress run's Low finding; same test): the label draws the box beside the input (`tickbox`) and the rules
  are `.adm .atick` (a class only his page draws, which the suite requires of a rule under `.adm`), not `.adm .oacct .tick`, so its input is the 44px tap and its label measures 44px, `width:fit-content` so a tap beside the words toggles
  nothing. It was measured 102 by 19; the hit test in Chromium is in the pull request.
  **The stage foot** (Phase 2a): the moves of the card's stage stand together at its foot (`makerCardFoot`, `.maker-foot`), the filled one first and the
  quiet ones beside it, then the card's answer line: a placed order's Accept (Send for their yes, when the figures raise the price or change the
  window) and Decline, or Withdraw the offer while an offer is out; Accept again, with the stages he rejected offered again; Ready to collect and
  Ready to deliver, with Cancel order, on an agreed order; Record handover, with Cancel order, on a ready one. The fields stay in the body, with
  the claims, Received, Amend, the close at fewer units and the cash controls (`makerCashControls`, which is untouched). **Cash held for an
  order shuts the card's controls, the foot's too**; Undo opens them. A foot with moves is sticky, clear of the App bar on a phone and along the
  card's own foot from 860px, with a gutter at its right for the + orb; a closed order's foot is its answer line alone.
  **The card asks on the page's Sheet, never a native confirm** (his decision 4 of 11 Oct 2026): Decline, Cancel order, Close at these units and
  Offer the rejected stage again each open `ynOpen`, the Sheet the customer's Cancel and Withdraw use, restating the order by its mark, its code, its
  size and its figure and saying what follows. One action sends the request the confirm let through, the same route, body and request id; the
  ghost, the close control, the scrim and Escape send nothing (`order.ask-go`, `order.ask-keep`, `order.ask-close`), and focus goes back to the control
  that asked, found again by its `data-yn` if a redraw replaced it. Tab inside a sheet visits its tiles and its field as well as its buttons
  (`ynTabs`, which every yes or no sheet shares). **Decline and Cancel ask the
  reason on the sheet**: the Desk's three lines as the system's Option tiles (`order.reason-stock`, `-price`, and `-place` on an order to be
  delivered only) and a field for his own words (`order.reason`); a tile fills the field and typing clears the pick, the reason is optional and
  rides as `note`, checked by `siteWords` on the Desk. The money taps (handover, cash, and Confirm received for another amount) are guarded once, as
  they were, with no sheet; **a claim's Received and Not found are not guarded once, they ask on the Sheet** (Phase 2b, below), and so do a Desk row's
  Approve and Reject (`approveDraft`, Phase 2c, below).
  **An edit put back to what it was offers its read** (Phase 2b, Fable's follow-up to 2a): the total's `input` takes the quote and Accept away, and
  only a `change` reads again, which a value put back before the field is left never fires, so the card said the figures would be read when he
  finished and showed no control. From the moment the total, or the charge typed as Other, is edited, the card offers Read the figures again
  (`order.reread`, as after a read that failed), which reads the figures as they stand; a `change` still reads at once and takes the control away.
  **The Sent tick on an account card is a 44px target** (rule 6, measured on the control, which a hit test reads): it measured 18 by 18 inside a 44px
  label, so its input is now the `--salt-tap` token both ways, laid unseen over the 18px box drawn beside it (`.tickbox`, which shows ticked and
  unticked and takes the focus ring). A real click at each corner of the input toggles it, at 1280 and at 375 in Chromium; the suite, with no layout
  in jsdom, holds the CSS rules and the markup (`test/admin-order-card.mjs`, section 4).
- **The claim card reads its own rows, shows the slip, and asks on the Sheet** (Phase 2b, 12 Oct 2026, his decisions 3, 4 and 6 of 11 Oct;
  `test/admin-claim-card.mjs`, its mutations in `test/admin-claim-card.mutations.json`, and `test/maker-claims.mjs` for the slip's crypto). **A waiting
  account claim is a row** of the system's Inbox row (`claim.open`, key the username and the claim id): its code, that they say they sent it, a slip
  if one is attached, how long ago and how much; **the row opened is its card, under it, one at a time**, and a tap on the row open closes it.
  **The card reads the claim's rows when it is opened** (`makerClaimCard`, the Desk's preview through `/all/maker/claims/<u>/<id>/preview`, stored
  nowhere), never a row and never by listing, afresh each time it is drawn, and **the Preview rows button is retired** (`claim.preview`). Received
  and Received, on the book already, wait for the rows and open by what they say (`left` over the rows or not); Not found does not wait. A read that
  fails says why, leaves Received shut and offers Read the rows again (`claim.reread`). A poll leaves the claims alone while a card is open
  (`makerClaimOpen`), and leaving Payments, or Orders, draws them again with every card shut. No route, body or request id changed.
  **The slip is a thumbnail drawn only once the page holds the slip key**, which is the one unlock (Phase 4b, below). With the page locked the card says
  the slip is sealed and offers the one Unlock (`vault.unlock`, keyed by the claim), never a password field of its own; **no ciphertext is fetched that the
  page cannot open**. With the key held, a card opened draws its slip at once, from the key. The picture is a `blob:` URL on a button (`claim.slip`, the
  44px token both ways) that a tap enlarges in place and the next shrinks, as the Desk's View slip draws it whole. **The URL is revoked on the lock**
  (`vault.lock` on the card is the lock, which seals the card again), **on the page hidden, and when the card closes**; a read held across any of them paints
  nothing (`makerSlipGeneration`). A slip that could not be opened offers Open the slip again (`claim.view-slip`). **The unlock is the page's, not Orders'**:
  it survives a move between the parts of Orders and leaving Orders, going only with the lock; leaving Payments lets the picture go and shuts the card,
  and a card opened again draws its slip from the key at once. A vault with no slip key filed still opens the names and places, and the card says no key is filed.
  **Received and Not found ask on the page's Sheet, never a native confirm** (his decision 4), on an account's claim and on an order's own claim
  (Receive claimed, Received on the book already, Not found, each a Sheet naming who and how much). An account claim's Sheet restates the claim as
  a line (`makerClaimAskRow`), lists the rows Received would settle and says what follows; one action (`claim.ask-go`) sends the request the confirm
  let through, the same route and body under the request id the claim keeps until it lands (`makerClaimRequests`), and the ghost, the close control,
  the scrim and Escape send nothing (`claim.ask-keep`, `claim.ask-close`). An answer sent again after a lost reply goes at once under the id it had,
  with no second question, as the confirm was not asked twice; a second tap on a Sheet already closed sends nothing, since the Sheet is shut before
  the request goes. An answered claim leaves the list and its line stands in its place ("Recorded. CX4-ABC is told."). An order's claim uses
  `makerAsk`, so its Sheet restates the order, and `makerTap` and `makerMove` still carry its request id and the Desk's single flight.
- **One unlock opens the names, the places and the slip key, every place reads it, and hiding the page locks them all** (Phase 4b, 12 Oct 2026, his decision
  3 of 11 Oct: one unlock per page for names, places and the slip key, on the device only, cleared on hide; `test/admin-one-unlock.mjs`, its mutations in
  `test/admin-one-unlock.mutations.json`). **One Sheet with one password field** (`#vaultSheet`; acts `vault.passphrase`, `vault.open`, `vault.cancel`,
  `vault.close`) opens all three envelopes through the roads that already read them (`GET /all/maker/vault`, `/vault/pair` or `/vault/addr`, and
  `/vault/key`): the names and places under the one password, then the slip key sealed under it. A wrong password opens none and leaves the page locked with
  the field emptied. The Sheet is a dialog, closes on Escape, its close control, Not now and the scrim, sends nothing when closed or empty, clears the field
  whenever it closes and keeps Tab inside. **Shop > This device holds the control that is always in reach** (`vault.unlock`, and `vault.lock` once open) with
  the state beside it. **What is held, in the page's memory and nowhere else:** the password as a PBKDF2 base key imported NON-EXTRACTABLE (it derives the key
  of any envelope from that envelope's own salt, so a newly salted seal needs no password string kept), the names and places as the vault opened them, and the
  slip key imported non-extractable for `deriveBits`. The password is read from its field, the field cleared, and the string never kept; every key the page
  derives is non-extractable and none is exported. **Nothing here is sent, logged or written** to localStorage, sessionStorage, IndexedDB or a cookie, and no
  request carries the password or a plaintext name or place: the unlock only reads ciphertext, and what Add ID, Amend ID and Place on the map send is what they
  sent (`makerVaultOpen` and `makerVaultSeal` now take the held base key where they took the password; the sealed device retries still take the master, as
  before). What a send keeps on the device for a retry is the ciphertext and codes `makerGeo.pendingOk` allows, as before.
  **Every place that asked for a password of its own reads the unlock** (`makerVaultGate`): Add ID, Amend ID, Place on the map, an unsent name or place (the
  Unsent entry, which carries the gate only when its body holds an envelope) and a claim's slip. Locked, each says Locked and offers the same Unlock
  (`vault.unlock`), never a field; open, each says names and places are open on this phone, and Place on the map adds whether a place is filed for the party
  chosen, from the held places, never where. A send from a locked page is refused where it stands ("Unlock names and places first."), before any request and
  with the form kept. **A name stands beside its code** wherever the page draws one for an account (`data-who`, set by `whoTag` only on a value shaped like a
  code, and painted by `makerVaultPaint`, which a redraw reaches through an observer): the roster row, the account card, an order's row and head, a claim's row
  and head, a chat's list and head, and a Needs card. A code the vault holds no name for shows alone, and codes are all there is once locked.
  **The lock lets all of it go together** (`makerVaultLock`): the keys, the names and places, every slip picture (its `blob:` URL revoked, the image removed), the
  Sheet with whatever was typed in it, **the last pair Add ID, Amend ID and Place on the map prepared** (each lists its draft in `pairDrafts` and the lock clears
  them; Phase 4c, 12 Oct 2026, Fable's note on #146: a prepared pair carries the plain places map until the form strips it, and Place on the map, which asks the
  gazetteer for a locality after the pair is prepared, stripped it only on the way that reached the send, so it is stripped in a `finally` now;
  `test/admin-place-drafts.mjs`, its mutations in `test/admin-place-drafts.mutations.json`), and the gates, the Shop row and the card read Locked again. It fires **on the page hidden** (`visibilitychange`), **on
  `ended()`** (Access has ended), **on a lapse** (`lapseHooks`, which `lapsed()` runs first: the customer's page holds an empty list and the owner's script adds the
  lock, so a customer's page names nothing of his) and **on Lock** (Shop, or the slip card's own). An unlock still being read when the lock comes lands on nothing
  (`makerVaultTurn`). The claim card's own unlock and lock (`claim.passphrase`, `claim.lock-slip`) and the password fields of Add ID, Amend ID, Place on the map
  and the unsent entry (`record.add-id.passphrase`, `record.amend-id.passphrase`, `record.place.passphrase`, `record.retained.passphrase`) are retired from the
  act table. No route, body or request id changed; the Desk's own vault code is untouched, and no route writes `vault-key`.
- **The approve card says the change, one card and one Approve an order** (plan 2 of `docs/plans-counter-admin.html`, 16 Oct 2026;
  `test/admin-approve-card.mjs`, its mutations in `test/admin-approve-card.mutations.json`). The head is the customer's code (read off the
  draft, the entry or its payload, so a correction never reads "no code") and the book's mark; **the row's id and where the entry came from (Counter Admin by its `makerRequest`,
  the site by its `orderId` unless the Desk's own cash, the laptop by a bare payload, else the phone) and when stand in Details** (clarity part 4, 18 Oct 2026). Then one plain verb off the draft's kind, the
  fields it changes and which way (Take back a payment, Payment received, Handover, Change the price, Close the order, New sale, Fix a row ...); Correction and
  Fulfilment stand only in Details. **Now and After** (Paid, Owed, Handed over), only what changes marked, are the Desk's: `src/approve-figures.js` reads each
  pending sale's row off the mirror, applies the approved moves on that row not yet folded and then the pending ones in entry order, moved for the figure fields
  as `ovAmend` moves a sale, and reads them with the engine's `txPaid`, `txOwed` and `txEffDeliv`; `owedNow` and `owedAfter` are `partyOwedRM` for the bucket's
  owner against `TERMS.ceiling`. The Counter computes no money. **At most two lines that ask a decision**, in sentence case: over the ceiling (or, on a move on a
  booked row that raises what is owed, under it), then the drafter's flags for under the floor, a refund opening, stock below zero and a twin. Every flag, the
  drafter's note and the row (its id added where the drafted row leaves it off) stand in **Details**, its own control. **Drafts on one row (same `amends`), or
  one trip, are one card**; its Approve, which says the result ("Approve: s262 closed"), sends each draft's own approval in entry order and stops at the first
  refusal, naming it; a trip is still one request. A move left after a partial approval reads from the approved one and says Half approved. Needs you holds the
  same one card an order. The drafter, the fold, the preapproval (D6) and what one approval does are unchanged.
- **The rows to approve wear the approve card, the queue folds away, and no native confirm is left** (Phase 2c, 12 Oct 2026, his decision 4 of 11 Oct;
  `test/admin-approve-queue.mjs`, its mutations in `test/admin-approve-queue.mutations.json`). **A Desk row to approve is the system's Approve recipe**
  (`salt-approve`, carried whole by `SITE_RECIPES` and restated nowhere: the page's own rules naming it only take its empty answer line away and leave it out of
  the glass card's padding, which the suite reads). The head is the row's code and the entry as typed; the figures that decide it follow, **read off the draft
  and computed nowhere** (the row's total, its cost and margin); then the flags the row was drafted with as chips (they freeze at drafting), the drafter's
  reasoning and the row itself, folded. Approve is the one filled pill, first, and Reject the danger ghost, in the recipe's actions; a trip's rows stand in
  one card with one Approve and one Reject, as they did. What Approve approves, **the row as drafted, never recomputed**, and its route, empty body and single
  flight (`makerBusy`) are as they were; a decided row still answers 409. **The queue is the system's Plan fold, shut** (`#makerQueue`, its summary
  `record.queue-toggle`): titled Server-held queue and counted (the entries the server holds, drawn with them), opened by a tap and left as he set it by a
  redraw; its entries and their Withdraw stand inside it, unchanged.
  **No native confirm is left in `stmt/owner.js`**, and the suite scans for it. Every other yes or no is `ownerAsk`, over `ynOpen`: a promise that answers true on
  the one action and false on the ghost, the close control, the scrim, Escape or a lapse (`ynOpen`'s `shut` hook, told as the Sheet comes down and read after
  the action, which runs just after), so a flow that awaits it carries on as it did when the confirm said no; a second tap on the action finds the Sheet gone and
  sends nothing. Its controls are `ask.go`, `ask.keep` and `ask.close`, keyed by what is asked, and focus goes back to the control that asked, found by its
  `data-yn` if a redraw replaced it. It asks, in place of the confirm: a Desk row's Approve and Reject, and a trip's (every row listed; `approveDraft` and
  `rejectDraft`, which shut nothing until his yes, so a no leaves the Needs you pill as it was); Withdraw server-held entry (Finish server withdrawal,
  begun already, asked nothing before and asks nothing now); the group order's Close; the notice's Set and Clear; a twin at entry (`makerSecond` for a loan or
  a gift, the trade's own); Cancel retained input, beside a form's button and on Record's retained input; Cancel reply retry on a chat; and the vault
  conflict. Every request, body and request id is as it was. `ended()` now takes a Sheet left open down with the page, as `lapsed()` and `lock()` do. A test that
  once stubbed `window.confirm` has each Sheet answered as it comes up (`answerSheets` in `test/maker-act.mjs`).
- **The page wears the recipes and restates none, and every colour is a token** (Phase 5, 12 Oct 2026; `test/counter-page-css.mjs`, its mutations in
  `test/counter-page-css.mutations.json`). `RECIPE_HEADS` now carries **Metric row, Table and Product tag** beside the rest, and the sync tool still refuses two
  recipes with one header. **What `PAGE_CSS` keeps is placement**: a form's label is the system's Field label (`salt-field__label`, or `salt-options__legend--label` on a
  legend) beside `lbl`; the weekly hours are the Table (`salt-table`, the day's cell its `salt-table__label`); a pane, a guest link and the report card are the Glass
  card at its medium radius; the report card's figures, an approve card's cost and margin and an order's goods, delivery and paid are the Metric row, a label
  over its figure, with a space between the two so the words read as they did; a guest link's moves are ghosts, Withdraw and Decline the danger ghost, whose
  rest in the alarm is the system's own recipe (the sheet's copy of it and the desk's are gone); Rewards' months are the Tab strip; and a book named on a row
  of his page (a row to approve, a group order) wears the **Product tag**, the book's mark in it (no word, his word of 12 Oct 2026) and the book's accent its hue, which is the
  system's `--salt-product-<book>` token that `PRODUCTS.accent` names. The tag is drawn by this page's script alone: a customer's page draws no tag and no word for a book.
  What stays by design: `select.fld` (the system's select rule carries a `url(`, which the sync strips, so the chevron is drawn from two gradients), `.msg`
  and `.maker-say` (no recipe draws a sentence line), `.maker-facts` (a meta line) and the customer's invoice lines (Phase 7). **No colour is a literal** in the
  statement layer, its print block or `PAGE_CSS`: the print block is the system's `--salt-paper*` inks and the look swatches its `--salt-swatch-*` tokens
  (`docs/DESIGN.md`). The suite reads `PAGE_CSS` for a restated recipe, for every text colour at 4.5:1 on obsidian, slate and a card's glass on both themes,
  for a font under 11px and for a control under 44px, and draws Salt Account on its busiest day to read every label, link, card, table and tag. No route, body,
  request id or send changed.
- **Record is a menu of forms, and one + orb opens it** (Phase 1c, 11 Oct 2026, his decision 9): Entry, Customers and Pricing each show a menu, a
  row of the system's Inbox row for every form of the part by name (`record.form`, key the name as a slug), in the order the page draws them:
  Entry (**grouped by use under small eyebrows, 18 Oct 2026**: Everyday, Sale or purchase, Repayment, Stock count; Now and then, Gift, Loan, Rewards, Offsets; Fixing, Correct a row, Reopen a cancelled order;
  a form not listed follows them), Customers (Add ID, Appoint existing customer, Amend ID, Map placement), Pricing (Customer tier, Tips, Customer drift, Printed
  board sizes). A row opens **that form alone, in the menu's place**, with a way back at the head (`record.form-back`, "← Entry") that returns him
  to the row he came from. **The form is the node it was, moved and never drawn again**: its fields, its retained send and its request ids are
  untouched, shown and hidden by `sweep` from `fOpen` (the form open, a slug), so what he has typed survives Back and opening another form.
  The count's controls are a form of their own now (Stock count). A **Retained input stays on the menu**, above the rows, and below 860px goes while a form
  is open. Opening a form reads and sends nothing. Leaving the part or the place closes the form. **The + orb** (`nav.add`, `#oAdd`, the system's raised
  orb) stands over every place but Record, 16px above the App bar on a phone and in the corner from 1080px, under the bar and the sheets; it opens
  Record on Entry, the menu of entries. The room under the last section on a phone is the orb's. No route, body, request id or retained send changed.
  **The form open is a pane** (Phase 4a, 12 Oct 2026, `test/admin-orders.mjs` section 4b, its mutations in `test/admin-orders.mutations.json`): the menu and a
  retained input are one column (`.reclist`) and the forms the pane beside it (`.recpane`), both in `#makerFormGrid`, the nodes moved into them by
  `recordMenu` and never drawn again, so a half-typed form survives Back and another form. **From 860px** the menu stays beside the form open (its row marked
  `aria-current`, the grid carrying `open`), another form opens straight from its row with no Back between, the pane is sticky and scrolls inside itself
  (between 860 and 1080px its height gives up the App bar's, as Orders' card does), Record widens for its forms (the rows to approve, under Orders, keep their 600px column)
  and the way back is not drawn. **Below 860px** the form open takes the menu's place and has its way back, and the pane's invitation to choose one is not
  drawn. `sweep` no longer hides the menu while a form is open: the CSS decides by width, as it does for Orders.
  **The few, fixed choices of a form are the system's Option tiles** (Phase 4a, 12 Oct 2026, `test/admin-tiles.mjs`, its mutations in
  `test/admin-tiles.mutations.json`): where a form asked in a `<select>` for a book, a direction, a handover, a kind of entry, a role, a level, a drift, a
  stream or a time to hide a reminder, it asks in `makerTiles` (`stmt/owner.js`), a fieldset (`salt-options maker-tiles`) whose legend is the field's label and
  a real radio in each tile (`salt-option`, face 44px, the radio laid over the whole tile), so the group is one tab stop, the arrows move the choice and a
  tile is a 44px target in both dimensions. The group answers where the select did: `.value` is the tile chosen (`''` when none is), `.disabled` shuts every
  tile (a supplier has no starting level or drift), the radios' `change` and `input` bubble to it, and `fill(items)` draws the tiles again, keeping the choice
  while it is still offered, else the first tile (the appointment's role starts with none chosen, as its select did). **Each radio keeps its select's act**,
  keyed by its value (`none` for the empty one) and, for a group drawn once for each book, by that book first (`record.add-id.tier`, key `salt-Silver`), so the
  act table below and the audit are as they were. **What a form sends is the value it always sent**: no route, body, field, request id, retained send,
  timestamp or signature cache, completion hook or `entryFault` changed. A **party, a row, a loan, a field or a reminder, a list as long as the book, stays
  a select**, and so does a code in a correction.
  **The printed sizes are a grid of tiles** (Phase 4a, `test/admin-sizes-hours.mjs`, its mutations in `test/admin-sizes-hours.mutations.json`): a size is a tile of the
  same recipe, a checkbox in `salt-option` with its face saying the size in words, in a fieldset (`maker-sizes`, legend "Sizes to print") whose grid runs in as many
  columns of 88px or more as the pane holds, ticked while the size is printed. Each tick keeps `record.house.size`, keyed by the size, and the body is as it was: the
  book and the sizes left unticked as numbers (`hide`). **The weekly hours are a table** (Shop, Hours): its head names three columns, Day (the tick, its label the day's
  name), Opens and Closes, a row for each weekday in order, each control named for its day and its column, a closed day's times shut, the columns sharing the width so
  the head stands over them at 375px as at 1280. The override that holds the shop for now is two tiles, Closed and Open (`hours.override-state`, keyed `false` and
  `true`), over a field that says **Closed until**, or Open until when Open is chosen, in Kuala Lumpur time. What is sent is what it was: `{schedule: {days}}`, then
  `{manual: {open, until}}` or `{clearManual: true}`. `tools/maker-forms-geometry.mjs` measures the pane, every form's tiles, the size grid and the hours table in a
  real browser at 1280 and 375px, and proves a 20px tile red.
  **The bar of five places stands on the screen's foot** (12 Oct 2026, his iPhone report that on Record it did not; `test/admin-bar-foot.mjs`, its mutations in
  `test/admin-bar-foot.mutations.json`): the system's `.salt-appbar` is `position: fixed` against the screen's left, right and bottom, a child of the shell
  (`#roster`), and no rule of the page frames it, the shell, the body and the root carrying no transform, filter, perspective, containment, will-change or container.
  What moves it is not a rule of its own: **a fixed bar is laid out against the layout viewport and drawn on the visible one, and a phone's layout viewport grows to hold
  anything wider than the phone**, so the bar then stands off the foot (measured: a 1200px section at 375px puts it 1,822px below the screen). The weekly hours table
  is such a thing on a phone narrower than 356px (its columns need 340px, and the page's gutter is 16px); Record's menu and its seventeen forms are not, down to 260px.
  **In the iPhone's saved app a short document lifts it** (his screenshots, 12 Oct 2026, 393x852 pt, each page at its top, Safari never): Orders, a long page, had the bar on the
  screen's foot; Record with one short card had it 20pt above; Needs you ("Nothing here.") 55pt above, the page ground showing under it. The shorter the page, the higher the bar,
  so the fixed bar's frame there ends at the larger of the document and a layout viewport short of the screen. **So the document is the screen tall at least in the saved
  app** (`html[data-app] body{min-height:100vh;min-height:var(--app-h,100vh)}` under 1080px, in the shared PAGE_CSS, so the customer's page has it too): the head script
  (`LOOK_HEAD`) marks the root `data-app` when `navigator.standalone` is true (the iPhone's alone; Android's installed pages are not marked) and sets `--app-h` to the screen's
  height, the longer side upright and the shorter lying down, again on a turn; the viewport units are not used, none being known to reach the screen's foot there.
  The body is border-box, so its padding adds no scroll. **Unverified here (iOS is not reproducible on the laptop): his iPhone is the proof.** `tools/maker-forms-geometry.mjs` reads the bar's
  bottom against the visible viewport on every place, Record's four parts and each of its forms, at 375 and 768, Night and Tide, as a browser and as the saved app (the
  phone's `navigator.standalone` set), with the page not scrolling sideways, the last control clear of the bar and, in the saved app, the document the screen tall and a short
  place scrolling by no more than a pixel, and proves a lifted bar, a page wider than the phone and a document shorter than the screen red.
- **The test accounts show every feature a customer sees** (29 Sep 2026, his instruction), so he can try any of them
  by signing in with the zeros, exactly as a customer sees it (his acceptance tests). There are two (his answer of 29
  Sep 2026, a second account rather than a switch): `0000-0000`, open, a claim of theirs waiting, which reopens
  ordering (his D9, amended) and lifts every stage of V5, so he can place an order; and `0000-0001`, locked, only for
  paying, its overdue part past the lock day and nothing of theirs waiting. The same zeros open both; a one is outside
  the alphabet, as a zero is, and the door lets it through (`normUser`, the page's `shaped` and `unfit`). Held and
  prices hidden are shown by neither and stay the suite's. `tools/testfix.mjs` `build(now, state, u)` makes an
  invented account: its orders driven through
  the order book's own `decidePlace`, `decideDesk`, `decideCustomer` and `applyEvent`, so their shape cannot drift;
  an invented book derived from those orders (each order on the book a row, dated its placing day, with two rows he
  entered on the desk, one on credit and one overdue), whose live statement is the real renderer's (`liveFor` in
  `tools/make_statements.mjs`, which swaps the book's two lists for the call and puts them back); an invented price
  list with a cap on salt and a book priced soon; account claims, guest links, an associate's card and a bulletin.
  Every publish (`tools/stmt-publish.mjs` `fixtureEntry`) reads each test account's `u:` record, opens its content
  key with the public zeros, seals the statement, the list and the card under it, with the statement bundle of an
  account minted today (no sealed issue), and puts the lot at KV `testfix:<username>`, stamped with the record's wrap
  salt; with no such account it writes nothing, and a read that fails warns and publishes the rest.
  **The Worker lays it over that test account alone** (`stmt/testfix.js`): `accountRecord` is the one read of a `u:`
  record on every customer road (open, re-read, remembered, link, hand-over, Place, links, his view of the account),
  and serves the fixture's documents and the associate mark only for the test account whose salt it carries;
  `GET /orders` adds its orders and claims, `/my/refs` its links, and `/bulletin`, asked on a test account's session,
  its notice while he has none set. **Nothing of it is written where an order, a claim or a link lives**, so the desk's
  reconcile, his lists, the chase and the report card cannot read it. **Every tap answers as it would a customer's**:
  a move on an example order (`-exNN`) is decided by `decideCustomer` and applied by `applyEvent`, a claim against the
  account by `decideAccountClaim`, and each is written back into that fixture, a retry under the same `rid` landing
  once as a customer's does; a link it makes waits on him inside the fixture (its id holds an `l`, which no real link's
  can), never a `g:` record, which would wait in Salt Account and outlive the account, and a link it withdraws is
  withdrawn there. None of its slips is filed. **Until the first publish seals a fixture, nothing real is made**: the
  account is no associate, so Links answers the site's 404, and a claim is refused (`e.testSoon`). One KV value an
  account, read and written whole: a tap may take a minute to show on another phone, and two at once may lose one,
  which the next publish puts right. Orders it places are real orders on the book, as before, under a username no code
  maps to. Making an account deletes its fixture, unmaking takes both accounts and both fixtures, and the next publish
  seals new ones. **A feature a customer sees lands with its case**:
  `FEATURES` lists each with the test of its case, and the suite fails on a line with none; every state, way, rail
  offered and claim answer is asked for off the code (`derivedCases`), so a new one needs no line to be asked for.
  Step 1b, F10, F15, V4b.2, V5, F13 (a slip sent, and one no longer kept) and the delivery's window and spot (a window
  asked for, one partly inside the hours, a spot shared, and his window at Accept, 10 Oct 2026) and his Accept for their yes (a
  raise and another window waiting on them, one lapsed then agreed at their terms, 10 Oct 2026) have their cases; a feature that lands
  later is added by the lane that builds it.
- **The test accounts are wrapped on his page** (fold 2.7): Make the test accounts makes a key for each and wraps it
  under the zeros and under the master at 150,000 rounds (`testKeys` in `stmt/owner.js`, the page's own `wrapUnder`),
  and `POST /all/test` takes `{make: true, u, key, wrap, wrapMaster}` once per account, checks the name and their shape
  and seals under the key. The
  Worker never derives above 100,000: the production runtime refuses PBKDF2 above that and the local one does not,
  so only the suite's spy on SubtleCrypto sees it. A bare `{make: true}` answers 400 with a reason.
- **Accounts** (S9 9.2) is one list for what Send and Review were: the system's Inbox row an account, chips
  for where it stands, when and how it was last opened, alerts on (the `push:` keys, counted by
  `alertsOn`), refused at an address and no account; a search and filters (Not sent, Not opened, Owes, Refused, No
  account) above it; a row opens the account, beside the list from 1080px.
- **An account** (S9 9.3, the plan's f13): its code, username, chips and totals; ONE filled **Send a sign-in link**.
  Looking makes no link (his decision 7 of 11 Oct 2026): the first tap makes it (`makeLink`, kept by username in
  `madeLink` with Needs you's, so a redraw keeps it) and the button says Share the link; the second tap shares it, the
  share sheet (or, with none, the clipboard) the tap's first act with no derivation or fetch before it; a share that goes
  through ticks the account sent. A link shared or copied from any card is dropped from the page (`retire`) and the next
  tap makes a fresh one, so the one Sign out everywhere spares has never left it. Beside it Show a code, in person; View as them; Copy password;
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
  call (`getMany` in `stmt/refs.js`, which `listRefs` reads every guest link through, 5.3); each card's QR
  is encoded once an isolate (`cardQr`), and the read writes nothing.
- **`/all`** (v566) serves the customer's own page with the roster where the gate is; a tap
  fills the username and `STMT_MASTER` into that form and submits it, so everything past the
  door is the customer's own code. His decision: the gated route hands the master to the page,
  so nothing is typed, and the trade is that an Access session there reads every account. The
  intended Access application is "Salt statements owner" (`67280e0b-…`, one-time PIN, a
  week's session, 168h, by his D13 of 24 Sep 2026; it was 24h). Its policy must allow only
  `maakmal97@icloud.com`; the Worker independently checks that email on `/all` and every `/all/*`
  request. Customer routes outside `/all` keep their sign-in links, passkeys and one-time code.
  This workstream changes code only; it does not verify or change live Access configuration.
  **When the session lapses, Salt Account
  says so** (S9 9.7): every request under `/all` is sent with `redirect: 'manual'`, so Access's redirect
  to its login reads as an opaque redirect rather than "Failed to fetch", and that or the Worker's own
  401 turns the page into "Your admin sign-in has ended" with Sign in again, a link to `/all`. A request
  that never went out says so and leaves the page. **Its own icon** (S9 9.7) is the Counter's ring with a
  keyhole for the dot, `ADMIN_ICON_PNG_B64` from `tools/stmt-icon.mjs`, served at `/icon-key.png` outside
  `/all`, since a home screen fetches an icon without the Access cookie. `stmt/access.js` reads the header or the `CF_Authorization` cookie.
  It keeps the team's public keys per issuer and key id for an hour, and a key id it lacks fetches the
  certs once; the signature, issuer, audience and expiry are checked on every request, and `/all/refs`
  takes the gate's verdict rather than verifying twice (the plan's 2.6). The verified identity's
  email is checked by the Worker; neither a customer account nor a caller-supplied email grants
  Admin access. `roster` (codes
  beside usernames, never names) is written by the publish.
- **Access on a `workers.dev` path, and how to prove it.** Zero Trust gates one path of a Worker
  with no custom domain; the precedent is QR Command's application, and the verifier to copy is
  `identity()` in `Code\qr-command\src\worker.js`: RS256 against the team's certs with issuer,
  audience and expiry, reading both the header and the cookie (the page's own fetches carry only
  the cookie), never throwing, every fault reading as nobody. A header check is not a gate: prove
  any Access gate with a token whose claims are right and whose signature is another key's.
  Applications, policies and `aud` tags are readable and writable through the Cloudflare API at
  `/accounts/{id}/access/apps`. A team rename moves the issuer: `ACCESS_TEAM` in
  `wrangler.stmt.jsonc` is a config edit, deployed by the push that carries it, and every device signs in again.
- **SIGN-IN LINK, ON EACH ACCOUNT'S CARD** (v710). **LOOKING MAKES NO LINK** (his decision 7 of 11 Oct 2026, replacing
  S9 9.3's making it as the account opened, which filed a live three-day record for every card drawn, and from 1080px
  for the account Needs you opens beside itself on every load). **The first tap makes it, the second shares it,
  everywhere**, as Needs you's Send a sign-in link does: the share sheet is never behind a derivation and a round trip
  (the plan's must-not-ship rule), and a card drawn, a share, a copy or a redraw sends nothing that writes. A link
  made and not shared lapses in three days or is burnt, uncounted, by Sign out everywhere. His
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

## Counter Admin maker routes

The `/all/maker/*` routes are part of the Access-gated Salt Account surface. The Counter Worker
passes the identity object returned by `identity(request, env)` to `handleMaker`; the handler also
requires the verified email to match `maakmal97@icloud.com`, trimmed and case-insensitive. No
client-supplied identity header is read.

Orders (the Maker place until 11 Oct 2026) lists the open site orders by stage, and Orders' Approve the pending Desk rows. Order Accept uses the Desk's
existing preview-and-digest path; later handover, cash and Received actions use the existing
order-stage functions. Ready, Decline, Cancel, a reply, No reply needed and Not found are
`POST /all/maker/orders/<id>/move` (or `/notfound`) with an immutable `rid`: the Counter reads the
order book's `deskseen` first and answers a retry from it, then the Desk's private
`/_internal/maker/orders/<id>/move` runs `moveOrder` (every word through `siteWords`), and the order
book keeps the request under `d:<u>:<id>:rid:<rid>`, so a retry lands once and the same id with other
content is 409. A status move carries `maker: true` into `decideDesk`, which holds Ready to an
acknowledged order and Cancel (his decision of 05 Oct 2026) to one with nothing paid, beside the
Desk's own refusals for goods out or a claim waiting. An acceptance order moves in its fixture alone
(actor `deskorder`, the same `decideDesk`), marked `test` in the review. The Desk's `/order-again`
and `/words` private routes carry the Maker review's offered-again stages and the word check. Desk draft
decisions use `handleDraftDecide`, so double decisions and site-order effects retain the normal
checks. Typed inputs are `inputs/stock-count`, `inputs/sale`, `inputs/purchase`, `inputs/tier-set`, `inputs/tier-accept-all`, `inputs/house-sizes`, `inputs/hush`,
`inputs/loan`, `inputs/repay`, `inputs/gift`, `inputs/redeem`, `inputs/add-id`, `inputs/amend-id`
and `inputs/place`. On the drift book, `inputs/tier-set` accepts the existing `tierset` shape with a
numeric `-1..+1` override rounded to two decimals like the Desk (zero is held) or `null` to restore
automatic record drift; supplier codes
and resale buckets are excluded; level books retain their tier and band shapes, and fixed books
remain refused. The Counter shows held versus automatic drift from the seeded snapshot and offers
no control on fixed books. Add ID is separate: drift books offer Automatic by default, the active
rule's presets and a typed `-1..+1` starting drift; a valid choice travels in the existing `addid`
entry and pair-vault route, while an invalid typed value is refused before vault preparation.
Automatic leaves the drift unset. No pricing is done on either road. These inputs use the existing
Position Engine constructors and drafter checks, go
through the existing queue and wait for review. Loans and repayments retain their loan rows; gifts
use the goodwill sale shape; redemption derives reward balance on the Desk and offsets the oldest
eligible advance through a Correction before creating an in-kind redemption; IDs and placement use
the existing roster/rename/place entries. Request bodies are fixed field lists, never generic
entries or unchecked notes.
Trade refusals distinguish an unknown buyer, supplier, associate, referrer and end buyer, pointing
to Counter Admin > Add ID before selecting the code. An R2 end buyer may instead remain Not named;
an arbitrary code is never accepted. Date and inventory-cost requirements remain unchanged.
Each input button disables its controls while sending and persists the
whole request (including timestamp and ciphertext) before transport. A retained input must be
retried, reviewed or explicitly cancelled; editing the form does not replace that request.
Record count, Send tier for review, Hush tip and Send board sizes for review release their
timestamp/signature cache only on confirmed completion, including the button's direct retained
retry. A subsequent intentional action with the same values gets a fresh timestamp. Automatic
offsets use that same retained sender, not a date-keyed request rebuilt from the form: after a
lost answer, a changed date still retries the original full body. A 200 without `ok: true` is
uncertain, not completion. The offset device record carries only `at`, `code`, `rid` and `date`;
unsupported metadata is refused before transport. The generated device validator includes the
Desk's `TIP_ID` constant, so Hush can validate the tip and reach transport without weakening its
id check. These are device recovery rules, not changes to the Worker, drafter, fold or pricing.
Migration `0013_maker_requests.sql` adds durable request receipts: the
Desk compares a canonical operation/body digest, replays completed requests even after the mirror
moves, and refuses changed content under an old timestamp. An incomplete non-vault receipt
resumes its stored immutable entry to a matching real draft. Legacy KV vault receipts without
their draft still fail closed; they do not claim the input succeeded.
**The mini ledger** (Orders > Ledger, 16 Oct 2026) is three tables of the folded book, in this order: Open orders, Pending orders and the latest 20 orders, every book. `GET /all/maker/ledger`
reaches the Desk's `/_internal/maker/ledger`, which reads the mirror and answers `makerLedgerMini` (`src/maker-inputs.js`): the stage is the engine's `txStat` order word (Open is every word that
begins Open, Pending is Pending), owed is `txOwed` less `txPaid` (nothing on a cancelled or written-off order) with the `txAdvance` beside it, handed over is `txEffDeliv` of the units ordered, and
the order is date then order id, newest first, a row with no date last. The page draws what it is given: a book as its mark, a customer as its code. It reads the folded book only: a site order the
Counter holds but the fold has not yet put on the book is under Placed, not here.

Counter notes are disabled because these specific paths cannot prove arbitrary prose is
free of names and places. `GET inputs` returns the active-book and roster catalog, including open
loans for repayment selection.

On **Amend a ledger row**, Cancellation hides and disables the movement fields and sends no
cash or units. Its After reading comes from the private input catalog: the Desk mirror's
Position Engine `txStat` / `poStat` on the cancelled row, and `refundOnCancel` for a sale's
refund payable. A paid, unmoved sale reads Refund due, Undelivered, Cancelled and names what
was paid; an unpaid pending sale reads Unpaid, Cancelled and names no refund. The browser
renders this reading without deriving a pay state or a refund. An unavailable preview is
explicit. This seeded preview authorizes nothing: sending re-reads the mirror through the
native amendment and drafter checks, so goods moved since that reading still stop Cancellation.

Counter Admin's Record cash holds the tapped amount on its card for ten seconds before any POST.
Undo cancels that hold and sends nothing. Hiding or leaving the page flushes every unsent hold
once with `keepalive`; expiry cannot send it again. The card disables other moves while cash is
held or sending. Once sent, Undo is gone: a lost or refused answer offers Retry cash with the
same immutable amount and `rid`, not another editable cash tap. Only a confirmed answer frees
the next tap to mint a new request **after a fresh review includes that cash**. A confirmed POST
with a failed or not-yet-incorporated review says **Recorded, refresh pending** and offers
Refresh cash, never another payment. Before POST, the exact request bytes, order id and prior
paid amount are retained in this device's local storage (non-vault trade metadata, as with
other retained inputs). Confirmation is retained separately from an uncertain answer. Reload
recovers an uncertain request as Retry cash with its original bytes and id, never Undo; a
confirmed receipt offers only Refresh cash until a read includes the amount. Storage failure
prevents transport, and an unreadable retained record gates new cash explicitly. These are
the Desk's twelve Cash Undo/flush parity behaviors,
not an approved difference; Desk inputs remain until owner acceptance.

The only vault reads are the sealed name envelope (`GET /all/maker/vault`) and sealed places
envelope (`GET /all/maker/vault/addr`), through their exact Desk read routes. Add ID and Amend ID
derive codes and encrypt the name map on the device with the key the one unlock holds (Phase 4b); the bridge receives
only codes, role/parent metadata and `{v,salt,iv,ct}`. Amend ID opens both envelopes with the same
key and re-keys their matching code prefixes, including descendants, preserving exact
points and `_base` only inside a newly sealed `addrVault`. Both envelopes are filed before the
rename is queued. It does not change a filed address when locality text changes.
Map placement decrypts the places envelope
on the device and sends only code-to-point pairs rounded to 0.01 degrees. Addresses and plaintext
names are never sent to Counter or Desk. There is no generic entry writer or arbitrary queue
forwarding on this bridge.

Maker's Reward redemption lists the held balance and native eligible action per holder,
net of durable reservations. Departed balances stay visible without a spend; returning
restores the offer, and a customer's action needs one whole unit. An unpaid advance offers
Offset on its oldest row. Sale cover is an unticked choice on the first or extra book,
read from `POST /all/maker/trade-cover` and sent only as `cover: true`. The Desk rechecks
the shared engine decision against that customer's own card, shelf cost and available
reward; delivery is outside the gap. Covered batches use all-or-none durable admission
before queue transport, not an exception to the ordinary trade-batch resource refusal.
Within a batch, an identical timestamp reserves once; conflicting bytes at that timestamp
refuse the whole batch before insertion. A reseed releases only source ownership acquired
by that transaction, not an identical retry's retained source.
Native approval and fold remain required. No pricing rule, board or floor is changed,
and these controls do not establish owner acceptance or retire the Desk controls.

The Counter's `DESK_MAKER` binding and the Desk's `/_internal/maker/` routes form a dedicated
Counter-to-Desk capability. `COUNTER_MAKER_KEY` must be a high-entropy value of at least 32
characters provisioned as a Wrangler secret on both Workers; it is neither `STMT_DESK_KEY` nor
stored in config. The Desk matches the key in constant time, allowlists each method and path, and
handles the private prefix before asset fallthrough. No arbitrary proxy or direct D1 path is
available.

Operating hours are stored in the Counter KV under `maker:hours`, in Kuala Lumpur time. `/hours`
publishes only the open/closed status and timing; it contains no account data. A closed Counter
still accepts customer orders, while the order form says acknowledgement may be delayed. Manual
overrides expire within 14 days and may be cleared to resume the weekly schedule.

Accounts > Order for them opens that customer's sealed current list on his device under the
existing master wrap. It sends one priced size with the list digest and a request id to
`POST /all/maker/customers/<username>/orders`. The server requires an existing account and the
verified owner, uses `placeOrder` on the site's normal KV/Object road, and records `by: desk` in
the initial history. A retry keeps its id. No passphrase or unchecked Admin note goes with the
placement. A moved list is refused, not silently requoted; reopen the form to read it again.

Customer amendments use the customer's session at `POST /orders/<id>/amend`, not an Admin route.
The replacement is checked against their own open order and carried over the private bridge to the
atomic order book; missing bridge configuration fails closed.

Desk Enter and Network remain available as decision-support surfaces. Counter now has the maker
forms for New order/on-behalf ordering, stock count, sale/purchase, held-tier changes, borrow/lend,
repayment, gift, reward redemption/oldest-advance offset, encrypted Add ID/Amend ID, and encrypted
map placement. Existing customer order amendments use the customer's session at
`POST /orders/<id>/amend`; the route is an atomic cancel-and-replace and refuses a lapsed session,
identity/price fields, an acknowledged or reserved order, a stale sealed-list digest, replay, or a
KV-only order store. Admin order review remains one flow for site orders and Desk drafts. Pricing is
set only for one order at preview/Accept; no board price or `PRICE_SET` is written.
The bridge and matching secrets shipped with #30. Live owner-JWT acceptance is still unverified.
Maker Chat/No reply needed and Notice shipped in #33, v993, with the complete deploy/publish
chain and deployed-tree suite green. Immutable owner reply receipts, encrypted device reload
recovery and isolated serialized example threads are deployed. Remaining action/control parity
and restrictions are listed in [the maker inventory](MAKER_INVENTORY.md); Desk controls remain.
`0013_maker_requests.sql`, `0014_input_admission.sql`, `0015_vault_pair.sql` and
`0016_vault_write_gate.sql` were applied individually on 03 Oct 2026 under explicit release
authorization, with schema readback after each. Neither admission migration rebuilds `draft`
or drops an index. Reviewed #32 deployed v992 with `VAULT_STORE=pair` after paused bootstrap
and matching ciphertext readback. D1 is now names/places authority; the gate reopened explicitly
at 13:13:22 MYT. Applied schema alone was not the storage-cutover proof.

Loan repayments and reward draws use `src/input-admission.js` on Maker, Desk queue, per-entry
order-queue and drafter roads. The server derives each resource and amount from the Position
Engine and current mirror, never a client-supplied resource key. A D1 conditional insertion
atomically records the receipt and claim only against that snapshot and available capacity,
netting accepted claims and legacy uncommitted drafts. Queue ownership references are inserted in
the same D1 batch. Same-id/content retries reuse that claim; changed content is refused.
Withdrawal removes only its road's reference and ends an undrafted claim only when no other road
holds it. Draft rejection ends that claim; a commit keeps consuming capacity on the old snapshot
until reseeding. Terminal receipts remain terminal. The dry run only reads; the fold checks its
accepted batch again. Reward margin and earning units are shared Position Engine helpers, also
read by Desk.

Draft rejection and commit marking update the admission lifecycle in the same D1 batch as the
draft decision. Withdrawal recovers its ownership from D1 even when the queue transport never
saved a KV copy. A mirror change after insertion releases only newly acquired ownership.
Resource-related direct laptop staging refuses rather than bypassing Worker admission; use
Desk or Counter to submit those inputs. Laptop commit marking maintains the same lifecycle.

The ledger editor posts typed inputs to `/all/maker/inputs/ledger-amend`, over the dedicated
Desk bridge. It derives identity, direction and row key from the RID. Correction uses
`checkCorrection` and the existing correctable fields; Fulfilment records cash or units;
Cancellation carries neither and refuses goods already moved or money pending a decision.
Sales and purchases use `rowRoom`, including positive cash corrections already on their way;
the fold's `payFault` remains the final stale-payment check. A named twin uses its own RID's
room, not another row sharing the order key. Every entry waits for review and fold.
Notes, settlement prose, order-code edits and cancelled/defaulted-row editing remain Desk-only.
Linked/Rewarded are explicitly refused on the shared cloud amendment builders; the drafter's
restriction is unchanged. Historical rows and readers are untouched.

The incumbent Desk's main trade/gift, loan/repayment, tier, redemption/automatic-offset,
Add ID, Amend ID and map-placement paths now use shared constructors, preserving their
existing notes and copy. Both legacy Add ID paths, the ledger update/editor and supported
Workbench amendment builders also use those constructors. Purchase Payment and Receipt
retain their incumbent semantics; Counter's ledger editor stays limited to Correction,
Fulfilment and Cancellation.

Counter Add/Amend ID and Network placement now select from official `placePicks` and the
hashed gazetteer. `tools/maker-geosync.mjs` generates `stmt/maker-geo.js` from the incumbent
master functions and data; `geosync` checks parity. Maps/Waze parsing happens on the device.
Only a short Maps link uses the exact owner/capability `geo/expand` bridge to the existing
one-redirect handler. Exact points and addresses remain encrypted; queued placement uses
the official locality point rounded to 0.01 degrees. Ambiguous or unlisted localities are
refused and directed to Desk. Amend ID preserves descendant place keys and `_base`, can file
a new encrypted address, and queues a placement when the code stays the same but its
official point changes.

Add ID alone also accepts a blank locality, matching Desk and the laptop panel: the code
uses the deterministic `TBC` suffix (with the existing name-letter clash handling), and the
encrypted name says `(to be confirmed)`. No locality or approximate point is invented or
sent. An optional valid Maps/Waze point still goes only into the encrypted places envelope.
A supplied locality must still resolve officially; a supplied map link must still parse.
Amend ID and Network placement keep their existing locality requirements. Desk inputs remain.

Legacy KV mode has two non-atomic envelope writes. The pair
mode supplies all-writer CAS and a durable ID/place outbox. Its schema and code shipped in
the v991 preparatory release. Revision-1 bootstrap was read back under paused maintenance on
03 Oct 2026; #32's active production version and public revision discovery proved the pair-flag deployment.
Browser transport requests and encrypted conflict
intent now survive reload, with explicit retained-input recovery and vault unlock before
retry/review. No decrypted identity, address, passphrase or key is persisted. Non-vault
Maker receipts retain immutable server-built intent before admission and resume to a real
matching draft on the same request; changed content refuses and concurrent retries share
one admission/draft. Default-KV legacy vault interruptions still fail closed rather than
pretending two KV envelope writes are transactional.
The `0015_vault_pair.sql`/`src/vault-pair.js` kernel proves conditional names+places
CAS, whole-request receipts, transactional outbox insertion and fixed-id crash recovery
against SQLite. Opt-in Worker pair read/write and Counter owner pair read are now wired,
as are revision-aware seed/pull tools with shared three-way merge, explicit overlap review
and ciphertext transport receipts. Local bootstrap planning, rollback export and bounded
receipt pruning are available. Counter and Desk have explicit device overlap Apply/Cancel
and retained encrypted retries. Maker ID/place routes, Desk Workbench and legacy named ID
creation, rekey, Network placement and base edits now use the pair transaction. Nameless
buckets need no vault. The fixed-id outbox consumer resumes on request replay and cron,
requires a draft before completion, and refuses changed content. Scheduled recovery isolates
failed rows, logs safe IDs, rotates its bounded batch and continues incumbent cron stages.
Old unversioned named ID/rekey/place queue clients refuse with an upgrade state in pair mode, while default KV
behavior is unchanged. The Desk names/places unlock reads one revision; shared rekey moves
descendant exact points and preserves `_base`.

The maintained bootstrap and production readback are complete. Live owner-keyed acceptance
remains unverified, and Desk controls remain available. Never roll back to stale KV after
pair writes: export and reconcile the current pair under reviewed maintenance first. Laptop pull now
uses a recoverable roll-forward journal and exclusive lock across both files and their
baseline; seed/pull startup recovers before reading, and the ledger reader refuses an
unfinished transaction. Ordinary and retained seed completion journal both reconciled local
maps with the confirmed baseline: remote changes are imported and unsent partner edits stay
local until their own seed. Ciphertext retry records carry their original merge baseline;
older retained records lacking it explicitly refuse pending reviewed recovery.
This is not a filesystem multi-file atomic rename. External
editors cannot be forced to honor the lock; storage corruption and stale recovery guards
need explicit local repair. Removing browser storage loses that device's retry record,
not an already-committed server receipt/outbox. A retained immutable input that is no longer
valid against the book refuses explicitly. Counter's ledger
editor retains only typed Correction/Fulfilment/Cancellation; notes, settlement prose,
order-code and cancelled/defaulted editing stay on Desk, and Linked/Rewarded remain refused
by the cloud drafter. Protocol, compatibility and
privileged out-of-band writer requirements are in `docs/DESK.md`.
Desk Enter and Network must remain available. No board repricing is part of this work.
The next source-only coverage stage adds Maker's Chat and Notice through narrowly allowed
`/all/maker/threads`, `/all/maker/threads/<username>` and `/all/maker/bulletin` routes.
They use the existing authenticated Desk-to-Counter handlers and `siteWords`, not a
second message/bulletin writer. Replies and No reply needed retain immutable device
request IDs; the order book refuses changed content and retries never wake twice or
quiet a newer customer line. Typed replies remain in memory across reads/errors;
an attempted reply is saved before transport as ciphertext under the existing owner
master, with account/RID/original timestamp metadata only. Reload requires an explicit
open in the authenticated owner context, followed by retry; the ciphertext is bound to
its original account. Nothing saves the plaintext reply or key. Verified completion
or explicit cancellation alone clears its account/RID record, never another pending
record. Reopening an in-flight Chat keeps submits disabled. A lost confirmation says
the result may already be recorded, not that the reply is known unsent.
Polling runs only for an open, visible Chat.
Test-account conversations are explicitly labelled and excluded from incumbent counts.
With the existing OrderBook binding, all fixture-thread readers and customer/owner
writers share an isolated `fixture_thread` SQLite table, on both object and KV roads.
Initialization is additive in the existing object's constructor; no D1 or Wrangler
class migration is needed. Restarts preserve state. Publication identity uses the
original account-wrap salt, publication time and ciphertext IV; newer publications
reset the fixture, delayed older writes refuse, and repeated reads never reset replies.
It has no real order/thread events, activity/chase marks or write-behind. Receipts
are capped at 400 per fixture and retained until publication reset or account unmaking;
capacity refuses rather than forgetting replay identity. Binding-less legacy customer
fixtures retain their old KV semantics, but new owner fixture writes fail closed.
Notice Set asks before notification and the server requires confirmation; Clear wakes
nobody. An ambiguous Notice result retains its original intended body and requires a
read before another explicit change, never an automatic transport replay. Readback
distinguishes matching content from another notice and keeps the prior notification
outcome explicitly unknown. This source stage has not been deployed or
accepted by the owner.

### Group orders, the pool (his plan of 05 Oct 2026)

He opens a group order for one product and size with a target in units; customers join at their own sealed list price for that
size; he closes it, and each joined order goes on to the acknowledgement as any other. Mechanism, in the order book only (the
KV road refuses it, `POOL_ON_KV`, as it does the account's thread):

- **Store.** `pool (u, oid, at, doc)` in the site's Durable Object, `u` empty, the oid a pool id `^p[0-9]{14}-[a-z0-9]{1,8}$`
  (`isPoolId`; `TABLE()` routes it). Events under the pool's id: `popen`, `pjoin`, `pclose` (`foldPool`). The doc is
  `{id, kind: "pool", at, product, q, target, closesOn?, state, closedAt?, closeLeft?, joins: [{u, oid, at}]}`. **The units in are
  never stored**: `poolUnits` reads them live off the joined orders, a cancelled or declined join leaving at once. Nothing
  writes a pool behind to KV.
- **A join is one step.** `pjoin` runs `decidePoolJoin` (`poolTwice`, `poolClosed`, `poolNone`; the closing day is the card's
  promise alone, only his Close shuts a pool) and then, in one `transactionSync`, appends the placement (under the request id's own event, so a retry lands once) and
  the join. The order is `decidePlace` with the pool set: collect, one order, no sheet, at the customer's own sealed price, the list's
  digest checked as at Place (409 `pricesMoved` answers the sealed list). `decidePlace` without the pool refuses a body that names
  one, `decideReplace` refuses a pooled order (`amendClosed`), and `customerView` carries `pool` and nothing else new.
- **Customer routes** (`handleCustomer`, on a session): `GET /pools` (the open ones, and a closed one they joined in the last 14
  days; `poolView`: no joins, their own standing join as `joined`) and `POST /pools/<id>/join {q, total, unit, digest, rid,
  forFriend}`. An associate's Join asks Me / A friend first, as Place does; a friend's books to the `-R` bucket by the same
  `bookR2` road, since the order is an ordinary placement. A test account's pools are its fixture's (`examplePools`,
  `exampleJoin`, actor `pjoin` in `fixture-account`) and a real pool is never shown to one.
- **The page.** Home's `hPool`, between Needs you and Coming up: one row a pool, its mark and size, `hp.in`, `hp.closes`, and Join
  as the one action while it is open, they are not in, and their list sells the size; a row they are in opens their order; a
  closed one reads `hp.closed`. Join opens the order sheet's check on the pool's own product and size (`poolOpen`), a request id a
  review. **Opening a pool wakes no phone**: it is a card on Home. **Reaching the target closes nothing.**
- **Maker** (`stmt/maker.js`, the verified owner only): `GET|POST /all/maker/pools` (open: `product, q, target, closesOn`, any other
  field 400) and `POST /all/maker/pools/<id>/close` (an empty body). Close closes in the book first (`pclose`; each joiner who
  still stands is woken once, kind `pool-closed`, naming their own order, on a topic and tag of their own), then for each joined
  order at `placed` runs the Desk's own `/_internal/maker/orders/<id>/preview` and `/accept` with the preview's hash, in turn. A
  `differs` or any error is written on the pool as `closeLeft [{id, why}]` and the rest carry on; **Close again retries only
  those**, and clears them as they land. Closing under the target still accepts.
- **Banners at close, in order:** `pool-closed` ("Group order closed", "Your order is in. We confirm it next."), then the
  order's own `confirmed` from the Desk's accept.
- **Fixture** (`tools/testfix.mjs`): one pool open with the account joined, one closed whose order is acknowledged, each with
  invented others (`seedUnits`); sealed with the fixture (`pools`). The account is over the five-order limit in the fixture, so a
  join on it meets `openMax`.

**Remaining cutover inventory:** account claims preview/Received/Not found; slip viewing
and private-key unlock; order messages, reasons and omitted moves; tier proposal
Accept-all/Add-ID; remaining Network actions; safe notes, settlement prose, order-code
and cancelled/defaulted ledger editing. Unsupported amendments stay refused, not
simulated. Genuine owner authentication and keyed-vault acceptance remain release gates;
Desk input/decision controls are retained until replacements pass that acceptance.
Preparatory migration `0016_vault_write_gate.sql` adds a durable, default-open maintenance
gate across normal vault writers and named ID/place ingress. It drains accepted work before
pause; it is not a vault authority switch. A maintenance refusal retains the browser request.
Neither this release nor Access configuration alone proves owner acceptance or authorizes
removing an incumbent Desk control.

### Every Salt Account control has a stable name: `data-act` (11 Oct 2026)

Salt Account is redesigned in phases, and the third rewrites its words. So that no test and no code finds a control by its
label, its class or its place on the page, every control on the owner page carries `data-act="<place>.<thing>"`: lower case,
hyphens inside a part, named by **what the control does and never by what it says**. A label, a class, an id or the layout may
change; its act does not. A button, an input that is not hidden, a select, a textarea, a `summary`, a link and anything with
`role="button"` or `role="tab"` is a control.

- **Where.** The owner's shell (`landingPage`'s owner markup in `stmt/page.js`: the rail and bar, the parts strips, the filters, the
  way back, the ended screen) and everything `stmt/owner.js` draws. Not the customer's own shell (the door, its places, its
  sheets) that View as them reuses: it is the customer's page, and its controls stay as they are. `#lock`, the one control of
  his in that view, is named (`view.back`).
- **A card, and a list.** A control drawn once for each card shares its act with the same control on every other card and is told
  apart by its card. The card carries its key: `data-maker-card` (an order's id, a Desk row's `draft:<id>`; since the five places an order's card is drawn in `#makerReview` with its status line `#makerReviewStatus`, and a Desk row's and a refused entry's in `#makerDrafts` with `#makerDraftStatus`, so a map of the cards reads both roots), `data-u`,
  `data-need`, `data-link`, `data-acct`, or `data-key` (an account claim, `<username>:<claim id>`; a server-held entry; a
  group order; a retained input, by its route; an extra book, `extra<n>`; an offset, by its row; the open thread, by its
  username). A control drawn once for each item of a list (a quick reply, a weekday, a device, a house size, a claim waiting on an
  order) carries the item's own `data-key`. No two controls in one card share an act unless they are the same control drawn
  twice (the rail and the bar draw each place; one of them shows).
- **How it is written.** `actOn(node, act, key)` in `owner.js` sets it. The helpers that make controls (`ghost`,
  `makerButton`, `makerClaimButton`, `makerField`, `addSelect`, and the group order's `field`) take their label as
  `[words, act, key]`, so the words and the act sit side by side and a change of words moves nothing else. A control made by hand
  calls `actOn`; the owner's static markup in `page.js` carries the attribute itself.
- **The retained-input Cancel.** `makerButton` draws a hidden Cancel retained input beside every button, used by the Record
  forms. Its act is its button's act and `.cancel-retained` (`record.loan.send.cancel-retained`). They are not tabulated below.
- **A test finds a control by** `byAct(root, act, key)` in `test/maker-act.mjs`: the control with that act, and with a key,
  inside the card or list item that carries it. Tests written before this still find controls by their words; the redesign's third
  phase moves them to acts.
- **The guard.** The suite's section "Salt Account: every control carries a stable data-act" draws the owner page with the richest
  fixture the maker harness has (orders at every stage, an account claim with a slip, links waiting, an account card open, the hand-over sheet,
  every Record form, a chat, a group order, the notice, the hours, a turn of sending links) and fails on a control with no act, on
  two with one act in one card, and on this table naming an act the page does not draw or leaving out one it does (a window's hour is
  the one pattern: `order.window-<hh>`). A new control gets its act and its row here in the same change.

| Act | Where | What it does |
|---|---|---|
| `acct.back` | Accounts, an open card on a phone | Takes the card back to the list. |
| `acct.device-signout` | Account card, Phones and computers (key: the device id) | Signs that one device out. |
| `acct.filter-all` | Accounts, the filter bar | Shows every account. |
| `acct.filter-locked` | Accounts, the filter bar | Shows accounts with an address refused. |
| `acct.filter-none` | Accounts, the filter bar | Shows IDs with no account yet. |
| `acct.filter-owes` | Accounts, the filter bar | Shows accounts that owe or are owed goods. |
| `acct.filter-unopened` | Accounts, the filter bar | Shows accounts never opened. |
| `acct.filter-unsent` | Accounts, the filter bar | Shows accounts not yet sent a sign-in. |
| `acct.find` | Accounts | Finds an account by a code or a username. |
| `acct.open` | Accounts list, one row each (key: the username) | Opens that account's card. |
| `acct.repay` | Account card, Loans (key: the loan rid) | Opens Record's Repayment form with that loan chosen. |
| `acct.order-for` | Account card | Opens an order for them, at the head of Orders. |
| `acct.password` | Account card | Opens their sealed password straight to the clipboard, never into the page. |
| `acct.sent` | Account card | Ticks the account as sent. |
| `acct.show-code` | Account card | Opens the sheet that shows a code for them in person. |
| `acct.signin-link` | Account card (key: data-acct, the username) | First tap makes their one-time sign-in link, the next shares it. |
| `acct.signout-all` | Account card | Signs them out everywhere, on a second tap within four seconds. |
| `acct.view-as` | Account card | Opens their own page, read only. |
| `ask.close` | The Sheet every other yes or no asks on: a Desk row's Approve or Reject, a held entry's Withdraw, a group order's Close, the notice, a twin, a retained input's Cancel, a chat retry's Cancel and a vault conflict (key: what is asked, as `draft:<id>:approve`, `queue:<id>`, `pool:<id>`, `notice:set`, `twin:<what>`, `retained:<route>`, `chat:<username>:retry`, `vault:conflict`) | Closes it and sends nothing. |
| `ask.go` | Same sheet | Does what it asked, once: sends the request the confirm let through. |
| `ask.keep` | Same sheet | Keeps things as they were and sends nothing. |
| `chat.cancel-retry` | Open thread | Cancels the retry kept on this device. |
| `chat.close` | Open thread | Closes the thread. |
| `chat.no-reply` | Open thread | Records that no reply is needed. |
| `chat.open` | Chat, one per account (key: the username) | Opens that account's thread. |
| `chat.open-retained` | Open thread | Opens the reply kept encrypted on this device. |
| `chat.reply` | Open thread (key: the username) | The reply to send. |
| `chat.send` | Open thread | Sends the reply, or sends the same one again. |
| `claim.ask-close` | The Sheet a claim's Received or Not found asks on (key: the username and claim id) | Closes it and sends nothing. |
| `claim.ask-go` | Same sheet | Sends what it asked: Received, Received on the book already, or Not found. |
| `claim.ask-keep` | Same sheet | Keeps the claim waiting and sends nothing. |
| `claim.details` | The claim's card (key: the username and claim id) | Opens the claim's reference, when it was sent, whether a slip is attached and whether it is a practice account, as a list of names and values. |
| `claim.not-found` | Same card | Asks, on the Sheet, whether to answer the claim Not found. |
| `claim.open` | Account claims, a row for each waiting claim (key: the username and claim id) | Opens the claim's card under its row, which reads its rows; a tap on the row open closes it. |
| `claim.received` | Same card | Asks, on the Sheet, whether to confirm the amount and the rows shown. |
| `claim.received-booked` | Same card | Asks, on the Sheet, whether to confirm it when the money is on the book already. |
| `claim.reread` | Same card, after a read of the rows that failed | Reads the rows again. |
| `claim.slip` | Same card, once the slip is drawn | The thumbnail of the slip, which a tap enlarges in place and the next shrinks. |
| `claim.view-slip` | Same card, while its slip is being opened or could not be | Opens the sealed slip again with the slip key the page holds, on this device only. |
| `code.close` | Code sheet | Closes the sheet. |
| `code.value` | Code sheet | The eight-symbol code, read only. |
| `approve.to-payment` | Desk row card of a customer's claim (key: the draft id) | Opens that claim's payment card on Orders > Payments; sends nothing. The row's own Approve stays shut. |
| `draft.approve` | Desk row card (key: data-maker-card, draft:<id>) | Approves the row, or every row of the trip. |
| `draft.reject` | Same card | Rejects it, or the trip. |
| `ended.sign-in` | Shown when the Access session has ended | Loads /all again, which is the Access login. |
| `hours.day-from` | Same row | The hour it opens. |
| `hours.day-open` | Operating hours, one a weekday (key: the weekday) | Whether that day is open. |
| `hours.day-to` | Same row | The hour it closes. |
| `hours.override-clear` | Operating hours | Clears it. |
| `hours.override-set` | Operating hours | Sets the temporary override. |
| `hours.override-state` | Operating hours (key: `false` for Closed, `true` for Open) | Whether the override holds the shop open or closed. |
| `hours.override-until` | Operating hours | When the override ends, Kuala Lumpur time. |
| `hours.save` | Operating hours | Saves the weekly hours. |
| `link.approve` | Link card of an associate's link | Approves it, which opens it. |
| `link.open` | Link row (key: the link id) | Opens or shuts the row: its address, QR and moves. |
| `link.copy` | Link card (key: data-link, the link id) | Copies the link. |
| `link.decline` | Same card | Declines it, which keeps it shut. |
| `link.introducer` | Links | The customer introducing the guest. |
| `link.label` | Links | Who the link is for. |
| `link.make` | Links | Makes a guest link. |
| `link.restore` | Link card of a withdrawn link | Restores the link. |
| `link.tier` | Same card | Sets the tier it quotes. |
| `link.withdraw` | Link card | Withdraws the link. |
| `look.night` | Shop, This device, Look | Night for Salt Account on this device, at once, kept here. |
| `look.sheet-close` | Look Sheet, on a first open | Closes it with Tide kept and nothing stored. |
| `look.sheet-night` | Same Sheet | Chooses Night, keeps it and closes the Sheet. |
| `look.sheet-tide` | Same Sheet | Chooses Tide, keeps it and closes the Sheet. |
| `look.tide` | Shop, This device, Look | Tide for Salt Account on this device, at once, kept here. |
| `maker.refresh` | Orders, Order review | Reads the orders again. |
| `more.test-accounts` | Shop, Practice | Makes or deletes the two test accounts. |
| `nav.add` | The + orb at the foot of the page, on every place but Record | Opens Record, on Entry, the menu of entries. Reads what Record reads on entering. |
| `nav.customers` | Rail on a desktop, bar on a phone (one act each, drawn twice) | Opens Customers, on its Accounts. |
| `nav.needs` | Rail on a desktop, bar on a phone (one act each, drawn twice) | Opens Needs you. |
| `nav.orders` | Rail on a desktop, bar on a phone (one act each, drawn twice) | Opens Orders, on the first stage with something waiting (Placed when none), reading the orders and the claims again. |
| `nav.record` | Rail on a desktop, bar on a phone (one act each, drawn twice) | Opens Record, on Entry. |
| `nav.shop` | Rail on a desktop, bar on a phone (one act each, drawn twice) | Opens Shop, on Hours. |
| `need.agree` | Needs you card for an order placed | Opens that order's full card in Orders, where the delivery charge and the window are asked. Books nothing. |
| `need.reply` | Needs you card for a message asked | Opens that thread (an order's question, the order's card). Sends nothing. |
| `need.review` | Needs you card for an order with several payments waiting, or a step to send again | Opens that order's card. Books nothing. |
| `need.received` | Needs you card for a payment they say they sent (key: the order, or the user and claim) | Asks once on the card; the Yes (`need.ask-yes`) sends what the full card's Received sends, the same request id. |
| `need.ask-yes` | The ask on a Needs you payment card | Sends the answer once; both buttons are off while it is out. |
| `need.ask-no` | The ask on a Needs you payment card | Cancels the ask and sends nothing. |
| `need.fold.practice` | The folded line at the foot of Needs you | Opens or shuts the practice accounts' cards in place. |
| `need.approve-row` | Needs you card for a Desk row to approve | Approves that row, or the trip it rides, asking first and sending what Orders > Approve's Approve sends. |
| `need.copy-link` | Same card, once the link is shown | Copies that link. |
| `need.kind.accounts` | The chips under Needs you's title | Shows only the cards about accounts and guest links. Reads nothing. |
| `need.kind.all` | The chips under Needs you's title | Shows every card again. Reads nothing. |
| `need.kind.messages` | The chips under Needs you's title | Shows only the messages asked. Reads nothing. |
| `need.kind.orders` | The chips under Needs you's title | Shows only the orders. Reads nothing. |
| `need.kind.payments` | The chips under Needs you's title | Shows only the payments they say they sent. Reads nothing. |
| `need.kind.rows` | The chips under Needs you's title | Shows only the Desk rows, the entries that did not get through and the entries kept unsent on this phone. Reads nothing. |
| `need.link-approve` | Same card | Approves the link, which then opens. |
| `need.owed-hand` | Needs you card for goods paid for and not handed over (key: the row's rid) | Opens that site order's card at its handover, or Record's Correct a row on that row as goods or cash moved. Books nothing. |
| `need.owed-pay` | Needs you card for money owed past term (key: the customer's code) | Opens the oldest such row's site order at Money received, or Record's Correct a row on that row as goods or cash moved. Books nothing. |
| `need.retry` | The banner over Needs you's title when a read failed | Reads every source again, the ones that failed among them; the banner goes once all get through. |
| `need.link-decline` | Same card | Declines the link, which stays shut. |
| `need.link-tier` | Needs you card for a guest link an associate made | Sets the tier that link quotes, or leaves it following the associate. |
| `need.open` | Every Needs you card (key: the card's key) | Goes to the detail of what the card is about: Orders, the order's stage, with that order's card open, that thread in Customers > Messages, that account (beside the list on a desktop, on Accounts on a phone), Customers > Links, Orders > Approve, Record on the part an unsent entry belongs to, Shop. |
| `need.fold.soon` | Needs you, the Soon heading | Opens or folds the Soon cards; folded when drawn, and once opened it stays open across redraws (14 Oct 2026). |
| `need.fold.watch` | Needs you, the Watch heading | Opens or folds the Watch cards, the same way. |
| `need.send-turn` | Needs you card for accounts nobody has been sent | Starts sending them their links one account at a time. |
| `need.show-code` | Same card | Shows a sign-in code for them in person. |
| `need.show-link` | Needs you card for an ID with no account yet | Shows the guest price list (the stranger's standing guest link) and its QR until the account is made. |
| `need.signin-link` | Needs you card for an account with an address refused | Makes their one-time sign-in link, then shares it. |
| `need.turn-done` | Same card, when every turn is over | Closes the card. |
| `need.turn-share` | Same card, mid-turn | Shares the link made for the account whose turn it is, then ticks it sent. |
| `need.turn-skip` | Same card, mid-turn | Leaves that account unticked and moves to the next. |
| `notice.clear` | Notice | Clears it, waking nothing. |
| `notice.read` | Notice | Reads the notice now up. |
| `notice.set` | Notice | Sets the notice and wakes every phone. |
| `notice.text` | Notice | The notice, one line a sentence. |
| `order.accept` | Order card (key: the order id), once its figures are read | Accepts the order at the price read. |
| `order.accept-again` | Same card, once its figures are read | Accepts again at the order's own price. |
| `order.accept-wait` | Order card, placed, until its figures are read | Stands in for Agree and sends nothing: asks for the delivery charge (and opens Change terms), or says the figures are being read. |
| `order.answer` | Order card | Opens or shuts the folded reply, Answer them. |
| `order.terms` | Order card, placed | Opens or shuts the folded Change terms: the goods' price, the delivery charge and the time. |
| `order.again-amend` | Order card (key: the order id), a stage he rejected under Approve | Asks on a sheet, then offers the rejected amendment again. |
| `order.again-cancel` | Order card (key: the order id), a stage he rejected under Approve | Asks on a sheet, then offers the rejected cancellation again. |
| `order.again-cash` | Order card (key: the order id), a stage he rejected under Approve | Asks on a sheet, then offers the rejected cash again. |
| `order.again-drop` | Order card (key: the order id), his pending row rejected and no row on the book | Asks on a sheet, then files every rejected stage on the order as covered, never a payment; nothing is offered or drafted. |
| `order.again-drop-cancel` | Order card (key: the order id), a cancellation he rejected on an order with a row | Asks on a sheet, then files that cancellation as covered; nothing is offered or drafted. |
| `order.again-drop-move` | Order card (key: the order id), a handover he rejected on an order with a row | Asks on a sheet, then files that handover as covered; nothing is offered or drafted. |
| `order.again-drop-amend` | Order card (key: the order id), a amendment he rejected on an order with a row | Asks on a sheet, then files that amendment as covered; nothing is offered or drafted. |
| `order.again-move` | Order card (key: the order id), a stage he rejected under Approve | Asks on a sheet, then offers the rejected handover again. |
| `order.again-pay` | Order card (key: the order id), a stage he rejected under Approve | Asks on a sheet, then offers the rejected payment again. |
| `order.amend` | Order card, acknowledged or ready | Opens the Change the order Sheet: Units, Price (goods) and Delivery. |
| `order.amend-delivery` | The Change the order Sheet (key: the order id) | The amended delivery charge, in RM. |
| `order.amend-total` | Same sheet | The amended goods price, in RM. |
| `order.amend-units` | Same sheet | The amended units. |
| `order.ask-close` | The sheet an order card asks on (key: the order id) | Closes the sheet, sending nothing. |
| `order.ask-go` | Same sheet | Sends what it asked: the Decline, the Cancel, the close, the offer again, a claim's Received or Not found, or the change to the order for approval. |
| `order.ask-keep` | Same sheet | Leaves the order as it was, sending nothing. |
| `order.back` | The head of an open order's card, below 860px | Closes the card and returns to the list, to the row it came from. |
| `order.cancel` | Order card (key: the order id), acknowledged or ready | Asks on a sheet, with a reason, then cancels the order. |
| `order.cash-retry` | Order card (key: the order id), when the answer was lost | Sends the same cash again, or refreshes the card. |
| `order.cash-undo` | Order card (key: the order id), while the cash is held | Undoes it, sending nothing. |
| `order.claim-not-found` | Same card | Asks, on the Sheet, whether to answer that claim Not found. |
| `order.claim-received` | Order card (key: the order id), one for each claim waiting (key: the claim's moment) | Asks, on the Sheet, whether to confirm the money they say they sent. |
| `order.decline` | Order card (key: the order id), placed | Asks on a sheet, with a reason, then declines the order. |
| `order.cancel-rest` | An agreed or ready order with goods out and some left | Asks, then closes the order at what was handed over, as Finish at fewer units does; anything paid above it opens as a refund. |
| `order.details` | Every order card, and the card of cash held for an order not on the read (key: the order id) | Opens the order's reference, when it was placed and how it goes, as a list of names and values. |
| `order.fee-0` | Order card (key: the order id), placed for delivery | Chooses a delivery charge of RM 0. |
| `order.fee-10` | Order card (key: the order id), placed for delivery | Chooses a delivery charge of RM 10. |
| `order.fee-15` | Order card (key: the order id), placed for delivery | Chooses a delivery charge of RM 15. |
| `order.fee-other` | Order card (key: the order id), placed for delivery | Chooses a delivery charge of his own figure. |
| `order.fee-other-amount` | Order card (key: the order id), placed for delivery | His own delivery charge, in RM. |
| `order.handed` | Order card (key: the order id), ready | Records the handover. |
| `order.handed-units` | Order card (key: the order id), ready | The units handed over. |
| `order.handed-rest` | Same card, fewer units typed than ordered (key: more or all) | More to come (a part handover) or That is all (the close at the units typed, asked on a sheet); Handed over says which. |
| `order.no-reply` | Same card | Records that no reply is needed. |
| `order.open` | A row of the list in Orders (key: the order id) | Opens that order's card beside the list from 860px, in its place below it. Reads nothing. |
| `order.pay` | Order card (key: the order id), acknowledged or ready | Records the amount by the road chosen: Bank as the order's received, Cash held ten seconds with its Undo, then recorded; it says the figure and the road once both are there. |
| `order.pay-amount` | Same card | The amount received, in RM, one field for the bank and the cash. |
| `order.pay-by` | Same card (key: bank or cash) | Bank or Cash; Cash is offered on a ready order alone, and none is chosen there until he chooses. |
| `order.quick-keep` | Same card | Keeps the reply as a quick reply on this device, or forgets it. |
| `order.quick-reply` | Same card, one for each kept line (key: its place in the list) | Fills the reply with that line. |
| `order.ready-collect` | Order card (key: the order id), acknowledged | Marks the order ready to collect. |
| `order.ready-deliver` | Order card (key: the order id), acknowledged | Marks the order ready to deliver. |
| `order.reason` | The sheet a Decline or a Cancel asks on (key: the order id) | The reason sent to the customer, in his words. |
| `order.reason-place` | Same sheet, an order to be delivered | Picks the place line as the reason. |
| `order.reason-price` | Same sheet | Picks the price line as the reason. |
| `order.reason-stock` | Same sheet | Picks the stock line as the reason. |
| `order.reply` | Same card | Sends the reply. |
| `order.reply-text` | Same card | The reply to the customer. |
| `order.reread` | Order card (key: the order id), placed or with a rejected pending row, after a read that failed, and on a placed order from the moment its total or charge is edited until the figures are read | Reads the figures again. |
| `order.send-yes` | Order card (key: the order id), once its figures are read, when they raise the price or change the window | Sends it to them for their yes instead. |
| `order.total` | Order card (key: the order id), placed | The order total, in RM; finishing a change reads the figures again. |
| `order.window-<hh>` | Same card, one for each window ahead (named by its starting hour) | Offers that four-hour window. |
| `order.window-day` | Order card (key: the order id), placed for delivery with no time asked | The day of the delivery window he offers. |
| `order.window-own` | Same card | Keeps their window, or as soon as it can. |
| `order.withdraw-offer` | Order card (key: the order id), with an offer out | Withdraws the offer. |
| `orderfor.friend` | Order for a customer, an associate's | Whether it is for a friend. |
| `orderfor.mode` | Order for a customer | Collected or delivered. |
| `orderfor.place` | Order for a customer | The delivery locality. |
| `orderfor.place-order` | Order for a customer | Places it for them. |
| `orderfor.size` | Order for a customer | The size and price from their list. |
| `orderfor.want` | Order for a customer | The day it is wanted by, optional. |
| `part.customers.accounts` | The strip under Customers (tab: Accounts) | Shows the accounts: the list, and the card of the one he opens. |
| `part.customers.messages` | The strip under Customers (tab: Messages) | Shows the account conversations, reading the threads. |
| `part.customers.links` | The strip under Customers (tab: Links) | Shows the guest links, reading them once. |
| `part.customers.associates` | The strip under Customers (tab: Associates) | Shows the associates' report card, reading it once. |
| `part.orders.placed` | The strip under Orders (tab: Received) | Shows the orders placed and not yet agreed, reading them. |
| `part.orders.confirmed` | The strip under Orders (tab: Agreed) | Shows the agreed orders, and every row of the book with nothing paid or handed over in full. |
| `part.orders.ready` | The strip under Orders (tab: Ready) | Shows the orders marked ready. |
| `part.orders.paid` | The strip under Orders (tab: Delivered or paid) | Shows the orders handed over in full or paid in full, not yet both. |
| `part.orders.done` | The strip under Orders (tab: Completed) | Shows the orders handed over and closed. |
| `part.orders.ended` | The strip under Orders (tab: Ended) | Shows the declined and cancelled orders. |
| `part.orders.approve` | The strip under Orders (tab: Approve) | Shows the Desk's rows waiting for him and the entries the server holds, reading them. |
| `part.orders.payments` | The strip under Orders (tab: Payments) | Shows the payments they say they sent. |
| `part.orders.group` | The strip under Orders (tab: Group) | Shows the group orders, reading them. |
| `part.orders.ledger` | The strip under Orders (tab: Ledger) | Shows the mini ledger, reading the folded book: Open orders, Pending orders and the latest 20 orders. |
| `part.record.customers` | The strip under Record (tab: Customers) | Shows the menu of the forms that add, change or place a customer, one form at a time. |
| `part.record.entry` | The strip under Record (tab: Entry) | Shows the menu of the forms for a count, a sale or purchase, a loan, a gift, a repayment, a reward, an offset, a correction and a revival, one form at a time. |
| `part.record.pricing` | The strip under Record (tab: Pricing) | Shows the menu of the forms for a customer's tier or drift, the printed board sizes and the tips, one form at a time. |
| `part.shop.hours` | The strip under Shop (tab: Hours) | Shows the operating hours, reading them. |
| `part.shop.notice` | The strip under Shop (tab: Notice) | Shows the notice, reading it. |
| `part.shop.practice` | The strip under Shop (tab: Practice) | Shows the two practice accounts. |
| `part.shop.device` | The strip under Shop (tab: This device) | Shows this device's Look, Night or Tide for Salt Account, reading nothing. |
| `pool.close` | Group order card (key: the pool id) | Closes it and sends each joined order for acknowledgement, or sends the ones left again. |
| `pool.closes-on` | Group orders | The day it closes, optional. |
| `pool.open` | Group orders | Opens the group order. |
| `pool.product` | Group orders | The product the group order is for. |
| `pool.size` | Group orders | The size each joiner takes, in units. |
| `pool.target` | Group orders | The target, in units. |
| `queue.details` | Server-held entry card (key: the entry id) | Opens the entry's reference, when it was sent and its state, as a list of names and values. |
| `queue.withdraw` | Server-held entry card (key: the entry id) | Withdraws the uploaded entry, or finishes a withdrawal begun. |
| `record.add-id.drift` | Record, Add ID, one for each drift book (key: the book) | The starting drift: automatic, a preset or typed. |
| `record.add-id.drift-value` | Record, Add ID, one for each drift book (key: the book) | The typed starting drift, from -1 to +1. |
| `record.add-id.link` | Record, Add ID | A Maps or Waze link, read on this device. |
| `record.add-id.name` | Record, Add ID | The name, which never leaves this device in the clear. |
| `record.add-id.parent` | Record, Add ID | The parent or associate, for a downstream buyer or a resale account. |
| `record.add-id.place` | Record, Add ID | The locality, from the official list. |
| `record.add-id.role` | Record, Add ID | Customer, supplier, reseller, referral, downstream buyer or resale account. |
| `record.add-id.send` | Record, Add ID | Encrypts on this device and sends the ID for review. |
| `record.add-id.tier` | Record, Add ID, one for each tiered book (key: the book) | The starting tier. |
| `record.amend-id.link` | Record, Amend ID | A Maps or Waze link, read on this device. |
| `record.amend-id.name` | Record, Amend ID | The new name, kept on this device. |
| `record.amend-id.party` | Record, Amend ID | The party to re-key. |
| `record.amend-id.place` | Record, Amend ID | The new locality. |
| `record.amend-id.send` | Record, Amend ID | Encrypts on this device and sends the re-key for review. |
| `record.amend.add-change` | Record, amend a ledger row | Adds that field change to the request. |
| `record.amend.cash` | Record, amend a ledger row | The RM moved. |
| `record.amend.clear-field` | Record, amend a ledger row | Clears an optional field in the request. |
| `record.amend.date` | Record, amend a ledger row | The day recorded. |
| `record.amend.field` | Record, amend a ledger row | The field a Correction changes. |
| `record.amend.kind` | Record, amend a ledger row | Correction, Fulfilment, Cancellation or, on a purchase lot, Payment, Receipt or Default. |
| `record.amend.row` | Record, amend a ledger row | The ledger row. |
| `record.amend.send` | Record, amend a ledger row | Sends the amendment for review. |
| `record.amend.units` | Record, amend a ledger row | The units moved. |
| `record.amend.value` | Record, amend a ledger row | The value it is set to. |
| `record.appoint.customer` | Record, appoint existing customer | The existing customer. |
| `record.appoint.role` | Record, appoint existing customer | The appointment role. |
| `record.appoint.send` | Record, appoint existing customer | Sends the appointment for review. |
| `record.count.book` | Record, stock count | The book counted. |
| `record.count.date` | Record, stock count | The day counted. |
| `record.count.send` | Record, stock count | Records the count. |
| `record.count.units` | Record, stock count | The units counted. |
| `record.drift.book` | Record, customer drift | The book. |
| `record.drift.clear` | Record, customer drift | Clears it, returning the customer to automatic drift. |
| `record.drift.customer` | Record, customer drift | The customer. |
| `record.drift.set` | Record, customer drift | Sets the held drift for review. |
| `record.drift.value` | Record, customer drift | The drift, from -1 to +1. |
| `record.partner.customer` | Record, partner | The customer to make a partner. |
| `record.partner.make` | Record, partner | Queues a name-free partner entry for review, as the Desk's Make partner does; a partner pays cost. Drift books only. |
| `record.form` | Record, the menu of Entry, Customers and Pricing (key: the form's name as a slug) | Opens that form alone, in the pane beside the menu from 860px and in the menu's place below it, with a way back. Reads and sends nothing. |
| `record.form-back` | The head of an open Record form | Closes the form and returns to the menu, to the row it came from. Nothing typed is lost. |
| `record.gift.book` | Record, gift | The book. |
| `record.gift.date` | Record, gift | The date. |
| `record.gift.handover` | Record, gift | Not stated, collected or delivered. |
| `record.gift.party` | Record, gift | The party. |
| `record.gift.send` | Record, gift | Sends the gift for review. |
| `record.gift.units` | Record, gift | The units. |
| `record.house.book` | Record, printed board sizes | The book. |
| `record.house.send` | Record, printed board sizes | Sends the sizes for review. |
| `record.house.size` | Record, printed board sizes (key: the size) | Ticks a size tile the board prints. |
| `record.loan.amount` | Record, borrow or lend | The units or RM. |
| `record.loan.book` | Record, borrow or lend | The book, for an in-kind loan. |
| `record.loan.date` | Record, borrow or lend | The date. |
| `record.loan.direction` | Record, borrow or lend | Borrow or lend. |
| `record.loan.form` | Record, borrow or lend | In kind or cash. |
| `record.loan.party` | Record, borrow or lend | The party. |
| `record.loan.send` | Record, borrow or lend | Sends the loan for review. |
| `record.offset.date` | Record, automatic offsets | The date. |
| `record.offset.send` | Record, automatic offsets, one for each offer (key: the row id) | Sends that offset for review. |
| `record.place.link` | Record, map placement | A new Maps or Waze link. |
| `record.place.locality` | Record, map placement | The locality. |
| `record.place.party` | Record, map placement | The party with a filed point. |
| `record.place.send` | Record, map placement | Queues the placement. |
| `record.queue-toggle` | Orders > Approve, the summary of the server-held queue, which is shut until it is tapped and carries its count | Opens or shuts the queue of entries the server holds. |
| `record.redeem.date` | Record, reward redemption | The date. |
| `record.redeem.read` | Record, reward redemption | Reads the reward offers again. |
| `record.redeem.send` | Record, reward redemption, one for each holder (key: data-reward-holder) | Redeems or offsets that holder's reward for review. |
| `record.repay.amount` | Record, repayment | The amount. |
| `record.repay.date` | Record, repayment | The date. |
| `record.repay.loan` | Record, repayment | The open loan. |
| `record.repay.send` | Record, repayment | Sends the repayment for review. |
| `record.retained.cancel` | Record, retained input | Cancels the retained request on this device. |
| `record.retained.retry` | Record, retained input | Sends the retained request unchanged. |
| `record.retained.review` | Record, retained input | Starts a new request on the vault as it stands. |
| `record.retry` | Record, when the Desk could not be read | Reads the inputs again. |
| `record.revive.date` | Record, revive a cancelled row | The day recorded. |
| `record.revive.row` | Record, revive a cancelled row | The cancelled row. |
| `record.revive.send` | Record, revive a cancelled row | Sends the revival for review. |
| `record.tier.accept-all` | Record, customer tier | Sends every proposal for review. |
| `record.tier.band-big` | Record, customer tier | The level for the big sizes. |
| `record.tier.band-mid` | Record, customer tier | The level for the mid sizes. |
| `record.tier.band-small` | Record, customer tier | The level for the small sizes. |
| `record.tier.book` | Record, customer tier | The book. |
| `record.tier.customer` | Record, customer tier | The customer. |
| `record.tier.level` | Record, customer tier | The held level, or clear it, or the three bands. |
| `record.tier.send` | Record, customer tier | Sends the tier for review. |
| `record.tier.use-offer` | Record, customer tier | Fills the level from the late-payer offer. |
| `record.tier.use-proposal` | Record, customer tier | Fills the level from the proposal. |
| `record.tip.for` | Record, tips | How long: seven or thirty days, or dismiss. |
| `record.tip.send` | Record, tips | Hushes the tip. |
| `record.tip.tip` | Record, tips | The tip to hush. |
| `record.trade.add-book` | Record, sale or purchase | Adds another book to the same trip. |
| `record.trade.associate` | Record, sale or purchase | The associate. |
| `record.trade.book` | Record, sale or purchase | The book. |
| `record.trade.cash` | Record, sale or purchase | The cash recorded, in RM. |
| `record.trade.cover` | Record, sale or purchase | Takes the reward cover offered on this book. |
| `record.trade.cover-retry` | Record, sale or purchase | Reads the cover again after a failed read. |
| `record.trade.date` | Record, sale or purchase | The date. |
| `record.trade.delivery` | Record, sale or purchase | The delivery charge, or the freight on a purchase. |
| `record.trade.direction` | Record, sale or purchase | Sale or purchase. |
| `record.trade.end-customer` | Record, sale or purchase | The end customer on an R2 sale, optional. |
| `record.trade.extra-book` | Record, sale or purchase, an extra book (key: extra<n>) | The extra book. |
| `record.trade.extra-cash` | Record, sale or purchase, an extra book (key: extra<n>) | Its cash recorded, in RM. |
| `record.trade.extra-cover` | Record, sale or purchase, an extra book (key: extra<n>) | Takes the reward cover offered on it. |
| `record.trade.extra-cover-retry` | Record, sale or purchase, an extra book (key: extra<n>) | Reads its cover again. |
| `record.trade.extra-moved` | Record, sale or purchase, an extra book (key: extra<n>) | Its units moved. |
| `record.trade.extra-total` | Record, sale or purchase, an extra book (key: extra<n>) | Its goods total, in RM. |
| `record.trade.extra-units` | Record, sale or purchase, an extra book (key: extra<n>) | Its units. |
| `record.trade.handover` | Record, sale or purchase | Collected or delivered. |
| `record.trade.moved` | Record, sale or purchase | The units moved. |
| `record.trade.party` | Record, sale or purchase | The party. |
| `record.trade.remove-book` | Record, sale or purchase, an extra book (key: extra<n>) | Removes the extra book. |
| `record.trade.send` | Record, sale or purchase | Sends the trade for review. |
| `record.trade.stream` | Record, sale or purchase | No associate, R2 resell or R3 refer. |
| `record.trade.total` | Record, sale or purchase | The goods total, in RM. |
| `record.trade.units` | Record, sale or purchase | The units. |
| `refusal.details` | Under any refusal the Counter or the Desk gave in its own words | Opens the server's own words under the plain sentence. |
| `row.proposed` | Any card showing a row, one for each (key: the row's id, or preview) | Opens the row's reference (a Desk row's) and its figures as a list of names and values, never JSON. |
| `row.details` | A row of the book as an order under Orders (key: row:<rid>) | Opens the row and its day, and the order of several books it rides on. |
| `row.hand-units` | A row of the book as an order (key: the row) | The units to hand over; what is left by default, fewer for a part. |
| `row.handover` | A row of the book as an order (key: the row) | Sends a handover of those units through Record's own input, a Fulfilment for approval. |
| `row.pay-amount` | A row of the book as an order (key: the row) | What they paid, cash or bank, in RM; what is owed by default. |
| `row.pay` | A row of the book as an order (key: the row) | Sends the payment through Record's own input, a Fulfilment for approval. |
| `row.cancel-rest` | A row of the book as an order with goods out and some left (key: the row) | Asks, then sends one Correction closing it at what was handed over, at the Desk's figure for that; anything paid above it opens as a refund. |
| `row.change-units` | A row of the book as an order (key: the row) | The order's units, to change. |
| `row.change-total` | A row of the book as an order (key: the row) | The goods' price, to change. |
| `row.change-delivery` | A row of the book as an order not on a trip (key: the row) | The delivery charge, to change; a trip's is changed by hand. |
| `row.change` | A row of the book as an order (key: the row) | Sends what changed as one Correction for approval. |
| `row.cancel` | A row of the book as an order, nothing handed over (key: the row) | Asks, then sends a Cancellation for approval; anything paid opens as a refund. |
| `ledger.tieout` | Orders > Ledger, under Order and book | Check now: asks the Desk to tie every site order to its row again, and shows what it found. |
| `orders.more` | Under Completed or Ended, past fifty orders (key: the stage) | Shows fifty more. |
| `trip.details` | An order of several books, or a buyer's same-day rows, under Orders (key: trip:<id> or day:<rows>) | Opens the order's id, day and rows. |
| `trip.hand-units` | An order of several books (key: the row) | The units of that line to hand over; full by default, fewer for a part. |
| `trip.handover` | An order of several books (key: the trip) | Sends one handover a line through Record's own input, each line its own request; a line the Desk refuses holds only itself. |
| `trip.join` | A buyer's same-day rows with no trip (key: their rows) | These are one order: one Correction a row setting one trip, the delivery left on its row. |
| `trip.pay` | An order of several books, once the split is read (key: the trip) | Sends the payment with the split he was shown; the Desk refuses it whole if the split moved or a share is past what its row can take. |
| `trip.pay-amount` | An order of several books (key: the trip) | What they paid for the order, cash or bank, in RM. |
| `trip.pay-split` | An order of several books (key: the trip) | Asks the Desk to split the payment oldest first, and shows the split. |
| `undo.history` | An agreed order's card, each line of an order of several books, and Correct a row (key: order:<id>, line:<row> or row:<row>) | Reads the sale's History from the Desk, its booked moves newest first (plan 4). Once read, the newest move carries Undo, when nothing waits on the row: it asks on the page's Sheet, with Now and After, then sends the undo, a Correction naming the step, or a site order's own restate for a change of its terms. |
| `unsent.open` | The banner over every place, while an entry waits unconfirmed on this phone | Goes to Record, on the part of the oldest such entry, where its Unsent entry section stands. |
| `vault.cancel` | The one unlock's Sheet | Closes it and sends nothing; whatever was typed is cleared. |
| `vault.close` | Same Sheet | Closes it, as Not now does. |
| `vault.lock` | Shop, This device, Names and places, once open; a claim card's slip, once drawn (key: the username and claim id) | Locks the one unlock: every key, name, place and slip picture is let go. |
| `vault.open` | The one unlock's Sheet | Opens the names, the places and the slip key together on the password typed. |
| `vault.passphrase` | Same Sheet | The password for names and places, typed on this phone and cleared when read; never kept. |
| `vault.unlock` | Shop, This device, Names and places; Add ID, Amend ID, Place on the map and an unsent name or place while locked; a claim card's slip while locked (key: the username and claim id) | Opens the one unlock's Sheet. |
| `view.back` | Bar over an account viewed as them | Takes him back to Accounts. |


### Salt Account speaks plainly (Phase 3, 12 Oct 2026, the redesign glossary of 11 Oct 2026)

Every word on Salt Account is the glossary's (`System\Code\Artifacts\counter-redesign\review\fable-review.md` section 5.2): the number first, a plain
noun for a heading, no engine word where a person's word exists (a sale, a purchase, a correction; not SELL, BUY, AMEND). The words live in `stmt/owner.js` and the
owner-only strings of `stmt/page.js`; **nothing is added to `stmt/words.js` and the customer's words are untouched**. Three helpers print a day, a size and a
sum, so no card prints one its own way: `fmtWhen` (a day is `10 Oct 2026`, a moment `10 Oct 2026, 17:20`, Kuala Lumpur, 24 hours, never ISO or UTC),
`units` (`1 unit`, `2.5 units`) and `rm` (`RM 1,234.50`); they are the page's own, so a new card calls them and does not format. How they signed in
names a code once, *Code*, with the road it took (typed in, copied across, scanned at the counter) under its date, and an account's chip says *by code*.

**A refusal is a plain sentence, the server's own words one tap away.** The Counter and the Desk refuse a move in their own words (`stmt/maker.js`,
`src/maker-inputs.js`, `stmt/hours.js`, `src/orders.js`). `refs()` raises the plain sentence as the Error's message, the server's words in `.raw` and the
status and answer in `.status` and `.detail` (the code that reads a twin or a 409 reads those, never the message), and `refusal(node, error, lead, tail)`
draws the sentence with a Details control (act `refusal.details`) that opens the words. **The map is `REFUSALS` in `stmt/owner.js`, between its two marker
comments: the server's sentence to a plain one, for the ones a person can act on.** Any other message, and an answer with no reason, is *The Counter could
not do that. Try again.* with the words behind Details: a refusal is never nothing and never only the server's words. To plain a new message, add one line to
the table; the suite (`test/admin-words.mjs`) walks every message of the map's source list. The page's own refusals (a connection that failed, a sign-in that
ended) are its own sentences and carry no Details. **A note the page keeps in state** (a link that could not be made, a share whose tick did not save, a
tier pinned on a link) holds the Error beside its text (`m.err`, `t.whyErr`, `linkSaid.err`) and is drawn through `withDetails`, so it has Details too; the
text is redrawn from state, so the next tap that clears the note clears them with it.

**A book has no name here: its mark stands alone.** His word of 12 Oct 2026 ("and even the name of the product") took back decision 5 of 11 Oct, which had Salt
Account say the Desk's name beside the mark. Where this page shows a book it draws the book's mark, his letter in it, and no word for it: not the Desk's name
(`salt`, `oil`, `candy`, `rice`) and not the shape (Cube, Droplet, Lozenge, Capsule, Ring). **A reader is told the shape**, as on the customer's page, through
a hidden `.sr` or an `aria-label` (`pshape`), never the product. An order's tile is the mark with *2 units* under it (`bookTile`, the customer's `mtile`), a
heading the mark alone (`pmarkHead`, the associates' report card), a row's Product tag the dot and the mark (`bookTag`), a legend or a field about a book ends in the
mark (a fourth label element, `[words, act, key, book]`), a tile of a form is the mark alone (`bookItem`), and a select, which cannot hold a mark, says the book's
letter in brackets (`optionBook`, `[I] `). A sentence the Desk or the Counter wrote that names a book reads *the book* (`noBook`: whole words, *The book* at a sentence
start, the apps' own names *Salt Account*, *Salt Counter*, *Salt Command*, *Salt Desk* left alone), and a Details value that is only a book's name is left out. **The
Desk keeps its book names; this page does not.** `test/admin-words.mjs` draws the whole page and fails on any book of `ledger/book.json` PRODUCTS in a word, an aria
name or a title, and on any drawn shape word.

**One word for one thing, on the Desk and here** (18 Oct 2026, part 5 of `docs/plan-counter-admin-clarity.html`, his yes). Where the two surfaces name
the same thing, this table is the word; a new card takes its word from here, and a word that differs between them is put to him, never changed unasked.

| Thing | Desk | Salt Account |
|---|---|---|
| An order placed, not yet answered | Pending | Received (stage) |
| His yes to an order | Accept | Agree (button), Agreed (stage) |
| Goods ready | Ready to deliver, Ready to collect | Ready |
| Goods out | Handed over | Handed over |
| Money in | Received | Received (button), Delivered or paid (stage) |
| A drafted row his to decide | Approve, under Order book | Approve, under Orders |
| What waits on him | Waiting on you | Needs you |

**Open, his to decide:** *Received* names an order's first stage here and money in on both surfaces, so one card can show the stage *Received* and the
button *Received*; and his yes is *Accept* on the Desk, *Agree* here.

### Unsent entries say so, and every id and row keeps its detail behind Details (Phase 4c, 12 Oct 2026)

**An entry sent from this phone and not confirmed says so on every place.** `makerButton` keeps a retained send whole in the phone's storage
(`saltMakerPending:<route>`) until the Desk confirms it or he discards it; it used to be found only by opening Record. Now one banner (`#unsentBar`, over every
place, the Action recipe at Soon, act `unsent.open`) says how many (*1 unsent entry*, *3 unsent entries*) and opens them, and each is a Soon card on Needs you under
the Rows chip (key `u:<route>`, counted in the line under the title, who by code when the entry names a customer and *This phone* when it names nobody). Both
sentences are the plan's: *A loan you sent on 10 Oct 2026, 16:00 was not confirmed. Open it to send it again, update it or discard it.*, the day in Kuala Lumpur
time; the entry's own section in Record says the same, then *Send it again, or update it first*. **Open goes to Record, on the part the oldest entry belongs to**
(`retainedPart`), where its Unsent entry section stands with Send again, Update and send and Discard, which are Record's alone. **Both only read the phone's
storage and send nothing**; `makerButton`'s send, its caches and completion hooks, `vaultPendingOk` and `makerBusy` are untouched. A record that will not read is
still one entry he can see and discard. The banner repaints when a place is shown and when an entry is cleared (`makerClear`), the cards at each draw of Needs
you. `test/admin-unsent.mjs`.

**An id is for quoting, not for reading: it stands behind Details.** An order's card no longer carries a grey *Reference* line; a claim's card, a Desk row's card and a
held entry's card each have one Details control, shut, that opens a list of names and values (`detailBox`, the system's plain Ledger list, wrapping a long value):
`order.details` (Reference, Placed, Way), `claim.details` (Reference, Sent, whether a slip is attached, Practice), `row.proposed` (the draft's Reference, then the
row) and `queue.details` (Reference, Sent, State). **A row's Details are never JSON** (`rowPairs`): a name through `rowKey` (the page's `FIELDW`, a few of its own, else
the identifier spaced out), a value through `rowValue` (a size in units, a sum in RM, a day as DD Mon YYYY, a yes as Yes or No, a list on one line, a figure inside a
figure as *Price: RM 5.00*), and a claim row's flag that is not a sentence is worded the same way. Opening one reads and sends nothing; no request, body or request
id of any card changed. `test/admin-details.mjs`.

**Change the order is a Sheet.** An agreed or ready order's card has one control, Change the order (`order.amend`), in place of the three fields and the Send the change
button down the card. It opens the page's Sheet (`amendOpen`, through `makerAsk`, so the order is restated at its head by its mark, code, size and figure) with Units,
Price (goods) and Delivery as they stand, its one action Send the change and the other Not now. **The action sends what Send the change sent**: `POST /all/maker/orders/<id>/restate`,
only the figures changed, the goods' price with a new size, under the request id that route minted until it lands; nothing changed says *Change a figure first.* on the card. What was typed is kept
while the change has not landed (`amendMemo`, forgotten once it has), so a lost reply is opened again as he left it and retried as the same request. `test/maker-amend.mjs`.

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
