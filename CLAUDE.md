# Salt Command, on the phone

Standing facts only; root `CLAUDE.md` governs voice, verification and precedence. A line stays
only if a session goes wrong without it. Mechanism: `docs/DESK.md`; statements site
`docs/STATEMENTS.md`; products `docs/PRODUCTS.md`; design `docs/DESIGN.md`; the fold
`docs/CLOUD_FOLD.md`; landing, the suite and instrument traps `docs/WORKING.md`; superseded
reasoning `docs/NOTES.md`. The dated record is `master/changelog.json`, never here; correct stale
facts in place. British English, no em dashes, no flourish, and never the word the suite bans
(write "costly" or the figure), in files, code and copy.
**THE HARD RULE NUMBERS ARE LOAD BEARING.** Rules 1 to 8 are cited by number from code, the suite
and the `update-names-id` skill. Reorganise within a rule; grep `rule [0-9]` before touching the list.

The Salt Command desk as a cloud app: the ledger and the pricing engine on the go, a transaction
addable from the phone. **This repo holds the master**, deployed as a Cloudflare Worker at
`https://salt-command.qyts8mh72kyg.workers.dev`; `/desk` is the one surface, and "the dashboard"
means `/desk` at desktop width. Public by his decision, no sign-in.

## Hard rules

1. **The master is `master/salt_command.html`. Never hand-edit `public/desk.html`**, a committed
   build output. Four blocks in the master are GENERATED and CI fails if one differs from its
   source: `ENGINE` (`engine/pricing.mjs`, `position.mjs`, `qr.mjs`; `node tools/engine.mjs
   --sync`), `BOOK` (`ledger/book.json`; `tools/booksync.mjs --sync`), geography (`geo/*.json`;
   `tools/geosync.mjs --sync`), `DESIGN` (`design/salt-ds.css`, `design/desk.css`, fonts;
   `tools/designsync.mjs --sync`). Edit the module, sync, build. **`evolution` holds ONE entry,
   the current version, and a bump replaces it**: `tools/changelog.mjs` copies `evolution[0]` to
   `master/changelog.json` first, and the gate refuses a master whose version the changelog lacks.
   **A fold edits `ledger/book.json`, never rows in the master**; write it with `writeBookFile`
   (one row per line), then `node tools/ledger.mjs`. Nothing outside the master prices anything:
   two engines drift. A view never changes a pricing rule; report it.
2. **Plaintext names never reach the cloud; the encrypted vault may.** `/bio` is answered but
   dropped; `/vault` syncs only the AES-GCM envelope `{v,salt,iv,ct}`. `10_Data\salt_bio.json`,
   `salt_vault.json`, `menu_secret.txt` and the queue files stay in the project folder. The suite
   searches the public desk, comments and version notes included, for every directory name and
   place: illustrate with codes and invented words.
3. **This repo is private.** It carries the real trading ledger; no real name is ever committed,
   in any form, hashed included.
4. **No third-party loads at runtime.** Inline CSS and JS, no CDN; the build fails on an external
   `src`, `url(` or `@import`. CSP is self-only, so Fraunces and JetBrains Mono are self-hosted
   files from `Code\salt-ds\fonts`, carried by each surface's own sync.
5. **Copy and price.** Detail in `docs/DESK.md`.
   - **RM and unit only.** The goods are **inventory** in copy; **Stock** is the rail's
     destination, `Stock cover` and the `Stock count:` line. New identifiers say `Units`, never
     kg. Copy is terse: noun-phrase headings, the number first. Dated records (the Journal,
     sealed issues) are never corrected in place.
   - **COGS, purchase plus freight, is the line no price goes under; the floor is COGS plus
     leakage**, one per size, with no delivery and no time in it. A sale carries `delivery` and a
     lot `freight`, typed per row; `txGoods` strikes every rate on the goods. **What the customer
     owes is goods plus delivery, the engine's `txOwed`**; nothing reads the total less the cash.
   - **THE BOARD IS THE LADDER.** A stranger is quoted the LAST level, Silver: `pxPolicy.tierRule`
     feeds `priceLadder`, which keeps the old figure as `derived`. **Row zero of `ladderRow` is the
     ask and is load bearing** (phone, mirror and suite read `[0]`; the code stays `T2`, the name is
     the level's); choose a row by code, never by index. Tier 1's stated ends and typed prices are
     retired; `PRICE_SET` is cleared and the drafter refuses a new one.
   - **Salt is Ambassador and four tiers** (Titanium, Platinum, Gold, Silver) from his
     `salt-command pricing_v2.xlsx` (OneDrive, read-only; copy first): `TIER_RULE` and `TIER_NAMES`
     in the master, `fiveTiers` in the engine. COGS is the supplier's QUOTE, not the landed cost.
     **The engine's two guards stay over the sheet.** **A tier is salt's alone**: oil, candy and
     rice are `fixed` boards, one price for everybody, and `tieredBooks` keeps the Tiers card,
     Accept all and Add ID off them. **NRV is Titanium**, never the ask. A cheap book put on a
     derived ladder inverts under the ten-rounding: check the rate law first.
   - **Each customer holds a tier per product** (`TIER_OF`, folded as `tierset`, a null clearing
     one), or a band set `{small, mid, big}` cut at 1 and 3 units. **The engine's `levelAt` is the
     one place a size becomes a level**; `levelShapeOk` is the one shape check; a band left out
     takes mid.
   - **The profile prices only through the proposal's four rules** (`buyerProfile` against
     `PROFILE_RULE`, then `ruleProposal` over `tierProposal`): rare and late twice, down a level;
     frequent and small, down from 3 units with nothing better below; loyal and buying bigger, up
     from 3 units, never past Platinum; `slowdown`, every band up, never past Platinum, until the
     next lot. **A HELD tier is never moved by a rule**, only offered one.
   - **A customer's price is their tier, never above what they pay, rounded DOWN to the ten.**
     Only the floor lifts a card over a rate, to the first ten above. **A product with no tier,
     held or proposed, is not priced.** One rule, the engine's `cardPrice`: the price list, and the
     desk's `cardQuote`, which every quote to a named customer reads.
6. **The look is the Salt design system applied as a layer.** Material, type and colour are
   decided in `design/desk.css` over the vendored `design/salt-ds.css`: edit there, `--sync`,
   build, never a hex in the master's older layers. Chart series read the identity's hexes
   directly (`salt-ds/src/tokens.ts`), so a palette change is two places; product hues are
   `PRODUCTS.accent` in `ledger/book.json`. **THE RECIPES ARE USED, NOT RESTATED**: markup carries
   the system's class beside the desk's own, `design/desk.css` holds no rule for a migrated
   recipe, and a colour the layer needs is a token in `Code\salt-ds` first, pulled by
   `designsync --pull`. The remaining geometry (ghosts, fields, tables, tiers, product bands,
   actions) migrates one group per version, on his word. The Counter takes the tokens and five
   recipes through `tools/stmt-style.mjs` (`SITE_RECIPES`); QR Command through its own
   `tools/designsync.mjs`. **A tap target is 44px in both dimensions**, settled by a hit test.
7. **Git: never from a mounted sandbox**: it leaves `.git/*.lock` and `tmp_obj_*` behind and
   silently blocks every later commit. **A native Windows Code session may run git.** After
   committing, verify `git rev-list --count origin/master..HEAD` and that no lock files remain;
   `node tools/update.mjs` does both. Clean-up after a mounted session:
   ```
   Get-ChildItem .git -Recurse -Include *.lock,tmp_obj_* -Force | Remove-Item -Force
   ```
8. **Three deployers, and only the Actions job does the whole job.** `cloud-commit.yml` gates,
   deploys, proves the phone serves the build, marks the folded rows committed, re-seeds the D1
   mirror, publishes the statements, deploys the Counter, then runs the suite. **The statements
   publish runs on every run but the `probe_key` dispatch**: the rule names what is excluded,
   never a list of triggers. The hourly run passes `--no-retire`. `tools/update.mjs` is the laptop
   half and publishes no statements. **Every desk deploy deploys the Counter.** **Cloudflare
   Workers Builds deploys the tip of master and stops**: it never folds, marks or writes D1 or KV,
   and its failure is SILENT. Its build command is `npm ci && node tools/gate.mjs`, then `npx
   wrangler deploy`. Actions runs only on a push touching `public/rev.json` or the statements
   paths, so a push touching `src/` or the master alone ships through Workers Builds only. **Read
   its config back through the Cloudflare API**, never the dashboard or the MCP builds tool
   (`docs/DESK.md`). Never point anything on the laptop at `salt_sync.ps1`: a fourth deployer.

## The one surface

**Retired:** the phone app `public/index.html`, `public/data.json` and the claude.ai mirror. The
built desk is seven destinations (`VIEWS`): Today, Order book, Stock, Pricing, Network, Record,
Enter. Old ids remain addresses (`/desk#book`, `/desk#network`). **The rail is two levels at
most.** **One product in view for the whole desk**: `PROD`, set only through `setProdView`. A
feature folded out of sight reads to him as missing: name every part where the eye lands.
Everything the desk shows, cost and margin included, is served at the public URL.

In cloud mode Enter carries **Add ID**, **Amend ID** and **Approve**. A code is derived from the
name and place (`deriveCode`), never typed or picked, and changes only when they change; Amend ID
re-keys it wherever the book holds it, prose and history keeping the old. The fold refuses a code
the master's own logic quotes (CJ4-OKR, SA5-BTR, SP7-PUD, CM6-HCM): those are hand folds.

**Coverage**, the map: districts shaded by a metric over a period, drilled to federal
constituencies, parties as dots. **Area names show; a party's name never does**, even unlocked.
Each party's place shows in words (`whereOf`). A place is its locality, then where that is
(`placeLocality`, `geoWhere`); it is chosen from `placePicks` at Add ID and Amend ID, and an
unlisted place is looked up in `geo/gazetteer.json`, built from GeoNames alone, never from the
directory. The leak checks exempt a directory place only when it IS an official area name
(`areaNameSet`) or a filed locality (`publishedLocalities`). Detail: `docs/DESK.md`.

**Money he is holding that is somebody else's is Now**: an open `customerRefunds` row is severity
`now` in `actions()` from the day it is raised. **Nothing closes a refund from the phone**: add
`paidOn` in `ledger/book.json`, `booksync --sync`, build.

**A defaulted sale is written off**: `txAdvance` reads nothing owed on it and `txWrittenOff`
carries it to every reading of what was lost, so no price moves. A new reader of what is owed uses
`txAdvance`; a new reader of losses must add `txWrittenOff`. A party with a write-off is not
approached (`approachable`).

**THE REORDER POINT IS DERIVED, NEVER UNDER 4 DAYS OF COVER AND NEVER OVER 14**: the engine's
`restockPlan`, read through `restockFor(prod)` and `reorderFor`, from measured demand only;
`RULES.reorderUnits` is the fallback for a book with no demand. Never type a mark back in.

**Five books** (salt, oil, candy, rice, spare). `node tools/product.mjs` is the one road that
opens, re-keys, retires or restores one; it refuses to retire a book with rows or to re-key salt,
a row naming no product being salt. What is keyed by product: `docs/PRODUCTS.md`.

## The chain: tap to deploy

| Step | Where | When |
|---|---|---|
| Queue an entry | KV `q:<deviceId>`, `POST /queue` | on tap; held offline, retried every ten seconds |
| Draft the row | Worker `src/drafter.js` | on arrival, plus the quarter-hour cron as the net |
| Approve or reject | D1 `draft`, `POST /drafts/<id>/approve` | on tap; a decided row returns 409 |
| Stage approved rows | Actions `cloud-commit.yml`, job `chain` | dispatched by every approval; hourly as the net |
| **Fold, bump, build, push** | `tools/foldcall.mjs` (one Claude call for the notes) over `fold.mjs`, else `tools/foldnotes.mjs`; or any agent per `docs/CLOUD_FOLD.md` | same job; or on demand |
| Gate, deploy, prove, mark, re-seed D1, publish, Counter, suite | same job; a suite failure after the phone is live is red and written to the phone's refusals, never rolled back | same job; or on push |
| Prove repo and live agree | `ship-check.yml` | 11:00 MYT |

- **Every task starts level with GitHub.** Before any task: `git fetch` and fast-forward to
  `origin/master`; wait out any Actions run in progress or queued (`gh run list`) and any approved
  row not yet folded (`node tools/drafts.mjs --approved`); fetch again. Check `list_sessions` for
  another session on this checkout and work in a worktree (`docs/WORKING.md`). Uncommitted files
  may be his or a peer's: ask, never sweep them; stage explicit paths, never `git add -A`.
- **A version asks about the queue first.** Before any bump: `node tools/drain.mjs --status`,
  `node tools/drafts.mjs --list` and `--approved`, `git fetch` for a staged `_to_fold.json`. Ask
  him one line per pending item; never approve for him; fold anything approved into that version.
  **Take the number last**: suite on the unbumped tree, then fetch, bump off origin's tip,
  changelog, build, gate and push within a minute, because a phone approval folds as the next
  version. Re-landing after origin moved: `docs/WORKING.md`.
- **What is approved is the ROW, not the entry.** The phone leads with cost and margin read from
  the draft and computes nothing; the drafter's flags do the measuring, and a purchase is never
  measured with a seller's ruler. A card's flags freeze at drafting. **One tap a stage on a site order
  (his decision D6)**: the order card's yes is recorded in `preapproval` and spent by the drafter only
  if the draft equals what he was shown, every field, flag and (for Accept) pricing version; else it
  waits under Approve, marked. Accept moves the order only once its row is approved; a later stage
  tapped before the first row lands is booked when it lands, and the answer says so. A close under what they paid
  is never approved on a tap: nothing books the difference as a refund yet.
- **What the drafter refuses, the phone does not let you type**: `entryFault` answers both entry
  forms. **An R2 row books to the associate's `-R` bucket whether or not the end buyer is named**,
  through the engine's `bookR2`, which every road calls; a named buyer is `downstream` and credited
  nothing. A twin of a booked row is put to him at entry; a twin already queued is refused. A loan
  is a Workbench mode folded into `loans`; settling one is a hand fold.
- **The drafter is arithmetic, never a model**, and never prices: it reads the `PRICING` state key
  that `tools/book.mjs pricingSnapshot()` derives. It refuses into `refused`: Linked and Rewarded
  amendments, `linkTo` or `orderCode`, a movement with no date, a product with no cost, a zero or
  negative figure, a date not in YYYY-MM-DD. **An entry stamped before the watermark that the draft
  table does not know is drafted, never dropped.**
- **The fold's judgement is a model's; the fold never WAITS for one.** What a row does, what is
  refused and what rolls is `fold.mjs`; the model writes only the notes. No key, a call that will
  not go through, or a reply twice against the house rules all land on `tools/foldnotes.mjs`,
  which records no judgement and says so in every note. A refusal by `fold.mjs` leaves the batch
  staged. CI holds the API key and the Cloudflare token, nothing else. **A count and the lots it
  follows are two folds**: the fold counts, then rolls.
- **A change to `cloud-commit.yml` never tests itself**: it is not on its own push paths. Dispatch
  a run by hand and read the step list, since a skipped step is green too. After any push read the
  run's annotation: a billing refusal looks like an ordinary red run.
- **No clock.** `Salt fold (manual backup)` (trig_01UrnjQMWA3f6GXN5R6Dzi4S) is disabled: fire it
  by hand if the Fold step fails. The stage stands down while `master/_to_fold.json` is in HEAD,
  unless `fold.mjs --replays` says the batch is a replay.
- **The laptop's queue takes the same road**: `node tools/drafts.mjs --from-queue`. A decided
  draft keeps its id for good; re-drafting an entry he later calls real, and folding from the
  laptop (approve last), are in `docs/CLOUD_FOLD.md`. A ledger row edit queues as a Correction.
- Endpoints: `GET /drafts?status=…`, `POST /drafts/<id>/approve|reject|committed`, `POST
  /draft-now?dry=1`, `POST /orders/<id>/preview` (the row an Accept would make, stored nowhere, never
  the dry run) and `/accept|handed|cash|received|again` (the card's taps), all keyed. Nothing writes
  to `entry`. **The `draft` table's CHECK lists every collection by name**: a collection the drafter
  newly returns needs a migration rebuilding it, applied to the live D1 BEFORE the deploy and as that
  file alone (`wrangler d1 execute salt_ledger --remote --file=...`); re-running an older one drops
  rows. Newest rebuild: `migrations/0010`; `0011` adds `preapproval`, applied alone the same way.
- **Cowork:** Salt left Cowork on 20 Aug 2026. `salt-daily-price-brief` and
  `salt-monthly-statements` may still fire from Cowork's registry (`Scheduled\README.md`), which
  Code cannot see: retiring them is his.

## Sync and proof

- The phone polls `/rev` every ten seconds against its baked `SALT_BUILD_ID`; `/rev` is `no-store`
  and never cached by `sw.js`.
- **`public/rev.json` id** = sha256 over the patched master, `public/sw.js` and every `src/*.js`,
  NUL-joined; written by the build only. It omits `public/_headers`, `manifest.webmanifest`,
  `chart.umd.js` and both wrangler configs, so **deploy a `wrangler.jsonc` change by hand**.
- A deploy is decided by `rev.json.id` against `.deployed.json.id`, never by hashing output.
- `ci.yml` on push: book in date order, master version in the changelog, tests pass, `public/`
  matches the master. `ship-check.yml` daily: repo id against live `/rev`.
- **"Update" means `node tools/update.mjs`, the whole chain, with no step left for him**: drains (a
  pull only), reports both queues, mints any missing account, builds, tests, deploys on an id
  change, commits, pushes, then proves master, `rev.json`, live `/rev` and origin agree. **A tree
  behind origin stops it dead** (`aheadVerdict` in `tools/preflight.mjs`); `--no-push` still
  deploys, so only `--dry` touches nothing. Also `--no-deploy`, `--no-drain`, `-m`. It never folds.
  The replay check refuses to ship while an entry above `QUEUE_COMMITTED` matches a ledger row by
  date and total; `--force-ship` after reading the rows. It commits whatever is in its checkout
  and cannot finish from a worktree: run it in the main checkout, quiet and level.
- Never pipe the gate, the suite or `update.mjs` into `tail` or `grep` inside an `&&` chain: the
  exit becomes the pager's. Redirect to a file and check `$?`.

## Names

Codes by default; names only after a password. `tools/seed-vault.mjs` encrypts `salt_bio.json`
with `$env:SALT_VAULT_PASS` (never a file) and pushes the ciphertext to KV; the desk auto-locks on
`visibilitychange`. **A name and ID is committed every time, like an approved row**: Add ID on the
phone files the name and place into the vault, encrypted on the device, before the ID is queued.
**On the laptop run `node tools/pull-vault.mjs` before any seed**; the vault's spelling wins, and
after a re-key take out the retired codes it brings back. When a fold finds a roster code the
directory lacks, ask him for the name and the location before the ID commits, then write both to
`10_Data\salt_bio.json`, seed the vault, and commit the statement username in
`statements/_users.json` (minted at registration, kept for life). The `-R` buckets are the
exception. **An account is ready on day one** (D15): the laptop mints a pool of spare accounts
(`tools/stmt-account.mjs --pool`), the fold binds the next free one at Add ID in `_users.json`, and
that run's publish opens it; a spare is marked in the clear, listed nowhere and opened by nobody
until bound. **With none free, the ID has a username but no account and cannot sign in** until
`tools/update.mjs` mints it (`--mint`, needing `STMT_MASTER`; without it the run names who is stuck
and carries on). Minting cannot run in CI, by design. Amend ID needs nothing. His own route is the
`update-names-id` skill, laptop only.

## Access, and why it is off; the write gate

- **`REQUIRE_ACCESS` is `"0"` on his instruction and the Access application was removed.** Setting
  it to `"1"` without recreating the application locks him out. To restore: first the Access
  application (Self-hosted, Workers, `salt-command`, policy Allow for his two addresses), then the
  var, then deploy by hand. **This is the DESK; the statements site's Access is live** and gates
  only `/all` there.
- **Writes need `X-Salt-Key` = `SALT_WRITE_KEY`, and so do the reads that carry cost or trade:
  `/queue`, `/ledger`, `/drafts`, `/orders`, `/stmt-users`.** The desk, `/rev`, `/queue/ping` and
  the vault's ciphertext stay open. Rotate with `npx wrangler secret put SALT_WRITE_KEY` from the
  repo, then clear `saltWriteKey` from the phone's storage. `drain.mjs` and `seed-vault.mjs` go
  through wrangler, unaffected. **`wrangler dev` binds the LIVE KV.**
- Withdraw a queued entry: `node tools/drain.mjs --status`, then `--forget <at>`.

## Statements site

`stmt/worker.js` and `stmt/page.js`: a second Worker on its own cryptic address, KV store and order book,
config `wrangler.stmt.jsonc`, every command taking `-c`. Nothing under `stmt/` imports from `src/`,
`tools/` or a node builtin; the suite checks. `statements/_secrets.json` is laptop only and
gitignored; lose its key and every account is re-issued. `stmt/page.js` `CLIENT_JS`, `stmt/owner.js`
and the send sheet in `tools/stmt-send.mjs` ship inside template literals: no lone backslash, use
`[+]` and `[/]`. Mechanism for everything below: `docs/STATEMENTS.md`.

- **The site address is never in the public desk.** No address, no QR drawn.
- **No brand on the customer's page, and no product word either.** Nothing under `stmt/` names
  Salt Command. A product is a mark (`PSYM`), and a control holding only a mark is named by its shape
  (`PSHAPE`), never its product. **The one name on the site is the app's, `Salt Counter`**, twelve
  characters, which is what iOS gives a home screen; the desk's name never appears. **A customer's
  level is a mark, never named**; no name is used because none exists there (rule 2).
- **AN ORDER REACHES THE BOOK IN STAGES.** The desk's every-minute
  `reconcileOrders` is the one road that queues what the site makes (Accept and Cash received queue
  their own): the acknowledgement a **Pending** row (delivery beside its total), a payment a **Fulfilment**, a
  handover a **Correction** stating the running total (rolling the shelf by the difference), a close at
  what was handed over a **Correction** restating size and total, a withdrawal a **Cancellation** (theirs,
  nothing paid, while the pending row is unapproved: the row dropped instead; an approved row never). The
  row is named by `ledgerKey`, **the engine's `ovKey` to the character**, which a close moves (a rejected close gives it back); an amendment
  waits until `OPEN.byKey` carries that key. Each entry is stamped with its stage's own moment (`stageAt`). A move of his
  runs the reconcile at once; the return leg carries what he records on the desk back to the order
  and only ever raises. Cash on handover is withheld while that customer holds an unpaid advance. A
  delivery's location never reaches a ledger note. The customer reads a whitelisted view of an order,
  never `ledgerKey`, `queued` or `sync`. **Every move is an event in the site's one Durable Object**
  (`stmt/orderbook.js`) under a device-minted id, so a retry lands once and no writer erases another's;
  `ORDER_STORE` is the switch (`object+kv` the week of reading both, `kv` the way back, `object` after a
  clean week of KV `orderbook:check`). **Coming back from `kv`, raise `ORDER_MOVE_IN`**; forgotten, the `kv`
  road's mark (`orderbook:road`) moves the book in again on its first request.
  Rejecting a draft a site order made is asked first and written onto that order, and its move is
  offered again under a fresh entry (the stage's own tap, or `/again`; `again` on `GET /orders`).
- **A customer writes on an order, and he answers**: one `msgs[]` thread per order, on any order at
  any stage; theirs capped, his uncapped. **It never rides into a ledger note.** His answer is
  checked by `siteWords` on the desk; every line is escaped on both surfaces. `siteWords` reads
  English and Malay off the lists in `src/orders.js` and the desk's `siteSafe` mirrors them by hand;
  the suite pins the lists to the book's names and `TIER_NAMES` and drives every word through both:
  a new book or level goes on both, its Malay word by hand.
- **Over RM 100 owed (`HOLD_RM`) the account opens as a payment page**: the page's gate, not the
  Worker's. Beside `owed` the live document seals `pay` (`payDue`): to pay now (`txAdvance`),
  overdue and coming up (`txPendRM`), each part due at its order date plus the desk's
  `RULES.creditDays`, read from the master, and overdue only after that day. **The bulletin** is KV
  `bulletin`, set through the desk's keyed `/bulletin` and checked by `siteWords`.
- **An associate may tick an order as on behalf of a friend**: it books to their `-R` bucket
  through the engine's `bookR2`, and the `orderKey` is built on the bucket. **A bucket is not its
  own person**: `ownsCode` reads the code and the bucket together; a bucket has no statement and no
  published username.
- **`/all` IS THE MASTER ACCOUNT, behind Access with two locks, neither trusted alone**: the Access
  application and `stmt/access.js` verifying the JWT again (RS256, issuer, audience, expiry). Empty
  `ACCESS_TEAM` or `ACCESS_AUD` closes `/all`. **`stmt/owner.js` travels only there.**
- **An account's card on Salt Admin hands over the password from his phone** (`pwMaster` under `STMT_MASTER`, in
  `sheet` behind Access, decrypted to the clipboard). The plain password stays laptop-only in
  `_passwords.json`, and no message ever carries it.
- **The shared link signs them in, once, and keeps the phone signed in** (his D1: the door's split key,
  three days to use, the message naming the username): the password is never in it. A link
  inside its window is a bearer credential, and single use is best effort (KV). The `/s/` route is
  gated on the token's SHAPE, so a spent link and an invented one serve the same door. **It is spent
  only on Continue** (asking which account spends nothing), and a spent record answers the page that
  spent it, by its nonce, for two minutes; an app's own browser is sent to Safari or Chrome first.
- **The hand-over** (his decision D2): a signed-in page, or Salt Admin's Show a code, hands the sign-in to
  another app or phone as a key and an eight-symbol code, one use in fifteen minutes, filed under a hash keyed by
  `STMT_HANDOVER_KEY` with the wrap sealed, the code braked per address and site-wide; unset, `/handover` answers 503.
- **The door** (his D3): one username field and one password field a password manager fills, Show, a
  paste that keeps only the password, an alphabet check on the device, the help line, and the site's
  one refusal; only his page sends a master, so it cannot be typed at a customer's door. Keep me signed
  in (a device key in the browser, the wrapped content key at `rem:<sha256(token)>`, neither opening anything
  alone, thirty days from the last open), log out, which also drops that wrap, this phone's
  notifications and every hand-over the page minted. Salt Admin's **Sign out everywhere** (`POST /all/signout`) ends
  every device, unused link and code, and alert on an account, never its `u:` record: the answer to a forwarded link or a
  lost phone. An account's phones and computers are named from the browser (`deviceOf`), never an address. Nothing says phone on a computer. **A lapsed session reopens itself from the remembered
  phone and repeats the request once** (his D1), **only when the phone remembers the account on screen**;
  otherwise a Sheet says so over the page, carrying the door and keeping the draft. The page re-reads on every return (`GET /account` on its session, never a
  wrap), and a remembered phone draws "Opening your account", never the door. Kept as an app:
  manifest and icon served by the Worker, no brand; every login asks about notifications once. How to
  keep it is a card once signed in, never on the door: an Install button wherever the browser offers one,
  Samsung Internet's steps, a computer's address-bar mark or another Android browser's menu mark drawn elsewhere; on an iPhone its Sheet mints the hand-over as it
  opens and copies the key in a tap of its own, rewriting the address to `/app#<key>` (his D2), and never
  says a link signs the saved app in. **The saved app starts at `/app`** (the manifest's `start_url`): with
  nothing remembered, an iPhone opens on One step to finish, the key by Paste or the eight symbols typed
  (`POST /handover/open`), and the app is remembered. A key in the address (`/app#<key>`) is spent by the saved app
  alone; a browser tab spends only Salt Admin's QR (`/app#qr.<key>`), as `{token, tab: true}`, which the Worker
  opens only for a key his `/all/handover` minted; an app's own browser spends nothing.
  Salt Admin links its own manifest with credentials, is titled Salt Admin, has its own icon (the ring
  with a keyhole, `/icon-key.png`) and turns into Sign in again when Access lapses.
- **A customer's banner names the kind of news, never an amount, a product, an order or a name**:
  `{k, o}` sealed for the one phone (`sealFor`, RFC 8291) under the keys its subscription filed, the
  words `NEWS` in `stmt/sw.js`; a record with no keys gets the payload-free wake and the old words. A
  tap opens that order (`#o=<id>`), and a page already open re-reads first.
- **The chase, twice a day** (his decision D5): the site's hourly cron (`wrangler.stmt.jsonc`) wakes a
  customer holding goods unpaid (`isAdvance`) only at 10:00 and 18:00 Kuala Lumpur (`chaseSlot`), from
  the day after the handover (`graceOver`), paused while a claim waits (`claimWaits`, where stage 6's
  claim plugs in), in its own words (`due`); one wake a slot per customer, capped by the chase
  mark (`markChased`: in the order book, `chased:<username>` on the `kv` road); the test account is
  skipped. The config ships with the job's push paths; an unpushed laptop change needs `npx wrangler
  deploy -c wrangler.stmt.jsonc`.
- **An associate's own card** (`rec.card`): `share`, `stars` and `rank` never travel, and every
  figure adds up to the list under it. **The associates report card** (`/all/assoc`, whitelist
  `ASSOC_FIELDS`): no margin crosses.
- **One live document, no monthly statement**: every order from the start, the page filtering by
  month and opening on the whole account. `make_statements` refuses to seal a new issue without
  `--new-issue`; sealed issues are untouched. A question goes on an order. The account line shows
  the customer's username, never the roster code.
- **The test account** `0000-0000`, password `0000-0000-0000-0000`, counts nowhere.
- **Guest links `/g/<id>`**: one board, `script-src 'none'`. **The id IS the credential**
  (rejection sampling, never `byte % 30`) and boards are NOT sealed. Every shut id (unknown,
  malformed, withdrawn, declined, waiting), and any longer path under `/g/`, answers ONE styled 404
  page, `shutPage`, the same words for all; a board ends with how to order. **One standing link per tier**, ensured on Salt Admin's first
  read of its links and kept for good; Ambassador is never a guest's; Bronze's old link opens the
  stranger's board. A standing link reads `tboard:<n>`, never `board:`. **An associate may mint
  their own, shut until he approves: the test is `approved === false`, NEVER `!approved`.** Decline
  is its own state, `declined`: shut like a withdrawn link, and Not approved to the associate. A link
  may instead name its introducer and follow them, recomputed every publish as `gboard:<id>`.
- **What a customer sees is as fresh as the last publish**: price lists are sealed at publish time.

## Files that carry a rule

| Path | Rule |
|---|---|
| `engine/qr.mjs` | The ONE QR encoder (byte mode, level M, versions 1 to 10), inlined into the master; `tools/qr.mjs` re-exports it; `qrRectSvg` draws RECTANGLES, a stroked symbol does not scan |
| `stmt/qr.js` | GENERATED from `engine/qr.mjs` by `tools/qrsync.mjs --sync`; never edit it |
| `stmt/send.js` | The one copy of the words a customer is sent |
| `stmt/signin.js` | The one-time link; the two limits it cannot promise away are in its header |
| `tools/stmt-seal.mjs` | Laptop only: seals an issue's passwords under the master, proving each; pairs a re-keyed code by proof |
| `tools/stmt-account.mjs` | Laptop only: mints the account for a roster code with a username and no record, never touching an existing one; `--pool` tops up the spare accounts (`tools/stmt-pool.mjs`) |
| `tools/foldnotes.mjs` | The fold's prose with no model: same notes object, same `checkNotes`, no judgement; `scrub` makes the API error safe |
| `tools/preflight.mjs` | `aheadVerdict`: level, warn or STOP; outside `update.mjs` so the suite can drive it |
| `tools/rid.mjs` | Stable `rid` per ledger row; `nextRid` is the one minting place |
| `tools/changelog.mjs` | Prepends `evolution[0]` to `master/changelog.json`; never rewrites |
| `test/verify.mjs` | No network or browser; one assertion per behavioural change, **proved red by mutation before its green is trusted**, each on its own |

The rest: `docs/DESK.md`.

## Working on it

```
npm install        # once
npm run build      # master -> public/desk.html, after any master edit
npm run dev        # build, then wrangler dev (live KV)
npm test           # the suite split across processes (tools/suite-split.mjs), about 2 minutes here; CI runs it too
npm run test:serial  # the same suite in one process, 3 to 7 minutes; 4 GB heap
npm run deploy     # build, then wrangler deploy
node tools/update.mjs
```

Each build patch is anchored on one unique line; a moved anchor aborts. First-time Cloudflare and
local tools: `docs/DESK.md`. Close every task with the seven-line standing-state table (shelf, live
credit, written off, pending orders, undated rows, queue and drafts and staged, tree), computed
from the engine in an `openMaster` window, never by hand.

## How a fold is sized

- **Smaller folds.** One thing, shipped; a fold that cannot be described in one sentence is two.
- **Sweep the class before shipping a fix.** Grep the pattern across the whole file first.
- **A round points at the newest code.** Attack the fix; older code is regression only.
- **An instrument is proved red before its green is trusted**, each mutation on its own. Reading
  source text, or checking inputs computed by the code under test, does not count; a vacuous check
  and a true one are identical in a green run. Before writing an assertion or measuring the desk,
  read `docs/WORKING.md`.
- **Run independent steps in parallel**: the suite in the background; master mutations at once on
  `SALT_MASTER` copies; tool-file mutations one at a time.
