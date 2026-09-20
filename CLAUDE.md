# Salt Command, on the phone

Standing facts only. Root `CLAUDE.md` governs voice, structure, verification and
precedence; this file adds what a session here would otherwise rediscover, and
never repeats a root rule. British English, no em-dashes, in files, code and copy.
Correct stale facts in place; the dated record is `master/changelog.json`, never here.
Set 6 Sep 2026. **No size ceiling** (his standing order, 10 Sep 2026); held to the root token
test instead: every fact once, in the section that owns it. Mechanism detail is
`docs/DESK.md`; reasoning and superseded passages `docs/NOTES.md`.
**THE HARD RULE NUMBERS ARE LOAD BEARING AND MAY NOT BE RENUMBERED.** Rules 1 to 6 are cited by
number from code, the suite and the `update-names-id` skill. Reorganise WITHIN a rule freely;
grep `rule [0-9]` before touching the list.

The Salt Command desk as a cloud app: the ledger and the pricing engine on the go, a
transaction addable from the phone. **This repo holds the master** (since 20 Aug 2026),
deployed as a Cloudflare Worker with static assets at
`https://salt-command.qyts8mh72kyg.workers.dev`, `/desk` being the one surface. Public by his
decision of 11 Aug 2026, no sign-in. The fold routine is `docs/CLOUD_FOLD.md`; statements
`docs/STATEMENTS.md`; design `docs/DESIGN.md`.

## Hard rules

1. **The master is `master/salt_command.html`. Never hand-edit `public/desk.html`**, a
   build output committed so the data lives in the repo. Inside the master four blocks
   are GENERATED and CI fails if any differs from its file: `ENGINE` from
   `engine/pricing.mjs`, `engine/position.mjs` and `engine/qr.mjs` (`node tools/engine.mjs --sync`),
   `BOOK` from `ledger/book.json` (`tools/booksync.mjs --sync`), geography from
   `geo/*.json` (`tools/geosync.mjs --sync`), `DESIGN` from `design/salt-ds.css` and
   `design/desk.css` (`tools/designsync.mjs --sync`). Edit the module, sync, build.
   `evolution` and `LAST_UPDATED` stay in the master. **A BUMP PREPENDS TO `evolution`, which is
   NOT a one-entry array** (its own comment and `tools/changelog.mjs` both said so until 16 Sep
   2026, and a session replaced it): it carries the Journal's window from v324, `master/changelog.json`
   carries every entry, and `tools/changelog.mjs` copies `evolution[0]` across. **A fold edits
   `ledger/book.json`, never rows in the master.** Nothing outside the master may price anything: two
   engines drift.
2. **Plaintext names never reach the cloud; the encrypted vault may.** `/bio` is
   answered but dropped; `/vault` syncs only the AES-GCM envelope `{v,salt,iv,ct}`.
   `10_Data\salt_bio.json`, `salt_vault.json`, `menu_secret.txt` and the queue files stay
   in the project folder and never move here.
3. **This repo is private.** It carries the real trading ledger; no real name is ever
   committed.
4. **No third-party loads at runtime.** Inline CSS and JS, no CDN, no web fonts; the
   build fails on an external `src`, `url(` or `@import`. CSP in `public/_headers` is
   `connect-src 'self'` and otherwise self-only, so Georgia and Consolas stand in for
   Fraunces and JetBrains Mono.
5. **Copy and price.** Detail in `docs/DESK.md`.
   - **RM and unit only.** The goods are **inventory** in copy, never shelf; the rail's
     destination is **Stock** (his instruction, 11 Sep 2026). The last three headings using the
     rail's word for the goods read Inventory since v672. What still says Stock is the destination
     (the tab and its `VIEWS` row), `Stock cover`, the measure's own name, and the `Stock count:`
     line a queued count carries, which is entry data. **The Journal is exempt and stays so**: a
     dated record is not corrected in place.
   - **COGS, purchase plus freight, is the line no price goes under; the floor is COGS plus
     leakage**, one floor per size, the goods after the leak, with no delivery and no time in
     it. A sale carries `delivery` (inside its total) and a lot `freight` (beside it), typed
     per row; `txGoods` strikes every rate on the goods.
   - **THE BOARD IS THE LADDER** (v656, his decision of 15 Sep 2026). A stranger is quoted the LAST
     level, Bronze, the one a new customer starts at: `pxPolicy` carries `tierRule`, `priceLadder`
     takes the ask from it and keeps the old derived figure beside it as `derived`, and every reader
     downstream follows from that one line. **Row zero of `ladderRow` is still the ask and is still
     load bearing**: phone, mirror and suite read `[0]`, so the code stays `T2` while the NAME is the
     level's. **Retired with it:** Tier 1's stated ends (`LADDER.tier1` is null; the mechanism stays
     in the engine for a book with no ladder), and the typing of prices in Set the board, which is
     now the hide list alone. `PRICE_SET` prices are cleared and the drafter refuses a new one.
   - **Ambassador and five tiers** (Titanium, Platinum, Gold, Silver, Bronze), his decisions of 14 and
     15 Sep 2026 off his pricing workbook: `TIER_RULE` and `TIER_NAMES` in the master, `fiveTiers` in
     the engine. **NRV is Titanium**, the lowest level any customer is quoted, never the ask (v656):
     reading it off Bronze would value the shelf at what a stranger pays and the IAS 2.9 test could
     never bind. A guest link is a level too: the cheaper one is Titanium, the other Bronze.
   - **Each customer has a PROFILE on each product** (v666, his decisions of 16 Sep 2026): `buyerProfile`
     reads their own priced orders against `PROFILE_RULE` in the master (frequent 2 a month, small half a
     unit or one, loyal 6 orders with the last inside 30 days, buying bigger 4 in 10 at 3 units or more,
     rare under 1 a month or nothing for 60 days, late twice past the credit term). Shown on the Tiers card,
     carried in the snapshot as `profileOf`. **It prices only through the four rules below**, never directly.
   - **A tier may differ by the size of the order** (v670, his decisions of 16 Sep 2026): `TIER_OF[code][product]` is one
     level name, or a BAND SET `{small, mid, big}` cut at 1 and 3 units (`PROFILE_RULE.smallUpTo`, `bigFrom`). **The engine's
     `levelAt` is the one place a size becomes a level**, read by the desk's `cardQuote`, the customer's price list and the
     fold; `levelShapeOk` is the one shape check, read by the drafter and the fold. A band left out takes mid. Their NORMAL level
     is a mid-sized order's, which is also the mark their page draws.
   - **The proposal moves on four rules** (v671, his rules of 16 Sep 2026), in `ruleProposal` over `tierProposal`:
     rare and late twice, down a level everywhere; frequent and small, down a level from 3 units, **nothing better below
     it (their own rate covers that) and no monthly cap** (the five-unit month, dropped on his word); loyal and buying bigger, up a level from 3 units, never past Platinum; sales held under
     half the typical for three days running (`slowdown`), every band up a level, never past Platinum, until the next lot,
     which resets the count. **A HELD tier is never moved by a rule**, only offered one; a proposal is what an un-held
     customer is quoted, so these rules move live prices.
   - **Each customer holds a tier for each product** (his instruction, 15 Sep 2026): `TIER_OF`
     on the book, code to product to level name, folded as `tierset`, a null clearing a product.
     **A customer's price is their tier, never above what they pay** (his decisions of 15 Sep
     2026), **rounded DOWN to the ten and never up** (v660, his instruction of 16 Sep 2026: the nearest
     five rounded up as often as down, so 63 of 432 cards sat RM1 to RM2 over the rate). Only the FLOOR
     can now put a card over a rate, and it lifts to the first ten above. **A product with no tier,
     held or proposed, is not priced**. One rule, the
     engine's `cardPrice`: the customer's price list, and on the desk `cardQuote`, which every
     quote to a named customer reads since v652, the reward cover's gap included.
6. **The look is the Salt design system applied as a layer.** Material, type and colour
   are decided in `design/desk.css` over the vendored `design/salt-ds.css`; a colour or
   type change is an edit there, then `--sync`, then build, never a hex in the master's
   older layers. Chart series read the identity's hexes directly (`salt-ds/src/tokens.ts`
   shadows the stylesheet), so a palette change is two places. Product hues are
   `PRODUCTS.accent` in `ledger/book.json`.
7. **Git: never from a mounted sandbox** (Cowork, agents on a mount that denies unlink): it
   leaves `.git/*.lock` and `tmp_obj_*` behind and silently blocks every later commit, and
   `git status` alone recreates `index.lock`. **A native Windows Code session may run git.**
   After committing, verify `git rev-list --count origin/master..HEAD` and that no lock files
   remain; `node tools/update.mjs` does both. Clean-up after a mounted session:
   ```
   Get-ChildItem .git -Recurse -Include *.lock,tmp_obj_* -Force | Remove-Item -Force
   ```
8. **Three deployers, and only the Actions job does the whole job.** `cloud-commit.yml` gates,
   deploys, proves the phone is serving the build, marks the folded rows committed, re-seeds the
   D1 mirror, publishes the statements, then runs the suite. **THE STATEMENTS PUBLISH RUNS ON EVERY RUN
   BUT THE KEY PROBE** (v701, his question of 18 Sep 2026: can the publish be on any trigger?). It
   can: it needs nothing this job produces, reading `ledger/book.json` and the master out of the
   checkout and never `public/`, and the checkout, setup-node and `npm ci` are unconditional. So the
   `plan` step's third output `publish` is 1 unless the run is a `probe_key` dispatch, whose whole
   purpose is one cheap call and then stop. **The rule states what is EXCLUDED**, because a list of
   events it is ON for goes stale the moment a trigger is added: it was `deploy` alone until v699,
   so a quiet day never refreshed a price at all, and naming `schedule` beside it would have left
   the same shape of bug for the next trigger nobody thought of. **The hourly run passes `--no-retire`**:
   writing is hourly, retiring an account whose record the newest issue does not carry is a judgement
   about a deploy he made, not about a clock. `tools/update.mjs` does the laptop
   half and never touches the statements. **Cloudflare Workers Builds deploys the tip of master
   and stops** (reconnected on his instruction, 10 Sep 2026): it never folds, never marks a
   draft committed and never writes D1 or KV, and its failure is SILENT. **Its build command is
   `npm ci && node tools/gate.mjs`, then `npx wrangler deploy`** (10 Sep 2026), gate before
   build. Actions runs only on a push touching `public/rev.json` or the statements paths, so a
   push touching `src/` or the master alone is one only Workers Builds ships. **Read the config
   back through the API rather than trusting this line**, never the dashboard or the MCP builds
   tool: `docs/DESK.md`.

## The one surface

**Retired at v387:** the phone app `public/index.html`, `public/data.json` and the
claude.ai mirror. The built desk is seven destinations over eighteen pages (`VIEWS` in the
master): Today, Order book, Stock, Pricing, Network, The book, Enter. **The rail is two
levels at most** (his instruction, 14 Sep 2026). **One product in view for the whole desk**
(his rule, 14 Sep 2026): `PROD`, set only through `setProdView`. Old tab ids remain addresses
(`/desk#network`). In cloud mode the Enter view carries **Add ID**, **Amend ID** and
**Approve**; the laptop desk keeps Names & IDs and has no drafts table. **Amend ID** (his
instruction, 14 Sep 2026) re-keys a changed code wherever the book holds it; prose and history
keep the old code. The fold refuses a code the master's own logic quotes (CJ4-OKR, SA5-BTR,
SP7-PUD, and CM6-HCM in a comment): those are hand folds. Everything the desk shows, cost and
margin included, is served at the public URL.

**Coverage**, the map (his decisions of 14 Sep 2026; named Coverage 17 Sep): districts shaded by a metric over a period, drilled
to their federal constituencies (MECo, CC0: Kuala Lumpur's 11 at v678, Selangor's 22 and Negeri Sembilan's 8 at
v681, each filed under the district holding its centre), parties as dots. **Area names show; a party's name never does**,
even unlocked. A party is counted in its own district's area that holds its point, else in any area
that does, whichever district that is filed under (a seat can cross a district line). The leak checks exempt a directory place only when it IS an official area
name (`areaNameSet` in `tools/book.mjs`) or a locality filed in `PLACED` (`publishedLocalities`, v680).
**Each party's location shows in words, for everyone** (his decision, 17 Sep 2026, v680): `whereOf` reads
locality, constituency and district, each once, in the Where column of Coverage's party table. **A party's place reaches the map on its own** (his
decision of 14 Sep 2026) through `geo/gazetteer.json`, built from GeoNames alone and never from
the directory; an unresolved place is tapped on the map and Record waits for the point.
**A place is its locality, then where that is** (his instruction, 17 Sep 2026, v679): the code is made
from the words before the first comma (`placeLocality`), so "Bangsar, KL" keeps BAN; the locality rides
as the third element of the point (`geoWhere`, checked by the drafter's `geoOf`) and is public by his
decision, the name never; a comma part naming a district or a state (KL, a lone SG) confines the lookup.
**The place is chosen from a list at Add ID and Amend ID** (his instruction, 17 Sep 2026, v682): `placePicks` reads his
KL map's neighbourhoods and Selangor sub-districts (`geo/placelist.json`, placed from GeoNames' MY.txt by
`tools/placelist.mjs --from`, the file never committed), every filed locality and every constituency, each as `whereOf`
reads a party; a choice carries its own point, and typing a place not listed still looks it up.

**MONEY HE IS HOLDING THAT IS SOMEBODY ELSE'S IS NOW** (v708, his instruction of 18 Sep 2026: "if
paid, I will need to refund immediately"). An open `customerRefunds` row is severity `now` in
`actions()` from the day it is raised, not an ageing, because he did not ask for one: it sat at
`soon` with no age rule, so it could never reach Now however old it got, and the Today badge counts
only the Now rows. `navCounts` counts it beside the supplier default it already counted, which is
its mirror; the Order book's table carries an AGE, which was the one open figure on the page without
one; and the daily nudge wakes him on it (`src/worker.js`, reading `entry` where the COLLECTION
lives, never `state`, and keying on the row's own `paidOn` because a refund carries `since` and the
seed leaves `entry.date` null). **NOTHING CLOSES A REFUND FROM THE PHONE**: no drafter branch, no
fold branch and no Correction reaches a `customerRefunds` row (`findRow` searches sales and
purchases alone), so it is closed by adding `paidOn` in `ledger/book.json`, then `booksync --sync`
and a build. A phone tap would need a migration for the `draft` CHECK.

**A defaulted sale is written off** (his instruction, 14 Sep 2026): `txAdvance` reads nothing
owed on it, as `poOwed` reads nothing on a defaulted lot, so it leaves every reading of what is
owed, the credit rules and the chase; `txWrittenOff` carries the figure to every reading of what
was lost (the P&L impairment line, the month's charge, the bad-debt rate in the price stack, the
receivables signal, a party's quote), so no loss and no price moves with it. A party with a
write-off is not approached, offered or messaged (`approachable`). The customer's statement is
untouched.

## The chain: tap to deploy

| Step | Where | When |
|---|---|---|
| Queue an entry | KV `q:<deviceId>`, `POST /queue` from the phone | on tap; held offline, retried every ten seconds |
| Draft the row | Worker `src/drafter.js` | on arrival via `waitUntil`, plus the quarter-hour of an every-minute cron as the net (the other minutes nudge on a customer order, `docs/STATEMENTS.md`) |
| Approve or reject | D1 `draft`, `POST /drafts/<id>/approve` | on tap; a decided row returns 409; a rejection drops the entry from every queue and the phone offers it back to re-enter |
| Stage approved rows | Actions `cloud-commit.yml`, one job `chain` | dispatched by every approval (Worker holds `SALT_GITHUB_TOKEN`), hourly as the net |
| **Fold, bump, build, test, push** | the `Fold` step: `tools/foldcall.mjs`, one Claude call for the notes (`ANTHROPIC_API_KEY`) over `fold.mjs`; or any agent asked, per `docs/CLOUD_FOLD.md` | same job when rows were staged; or on demand |
| Gate (`tools/gate.mjs`), deploy, prove, mark committed (with the clock), re-seed the D1 mirror, publish statements, then the full suite | the steps that follow in the same job; a push runs them alone, and skips the deploy when the phone already has the build; a suite failure after the phone is live turns the run red and is written where the phone shows refusals, never rolled back | same job; or on push |
| Prove repo and live agree | `ship-check.yml` | 11:00 MYT |
| Deploy the statements site | the same job, on its own paths. **The checkout is depth 1, so the base commit must be FETCHED before it is diffed**, or a statements-only push deploys nothing while the run goes green. Fails safe: no base, deploy anyway | on push |
| Monthly statements | `docs/STATEMENTS.md` routine | the 1st, gated in Kuala Lumpur time |

- **A CHANGE TO `cloud-commit.yml` NEVER TESTS ITSELF ON THE WAY IN** (10 Sep 2026): it is not
  in its own `push.paths`. Dispatch a run by hand, or push it with a file on one of those paths,
  and then READ THE STEP LIST: most steps are conditional, so a skipped step is green too.
- **The fold is a judgement and stays with a model**: the row NOTE, the `evolution` entry and
  the sentence on the roll come from one Claude call over a dossier the tools compute; what a
  row DOES, what is refused and what the inventory rolls are `fold.mjs`, never the model. CI
  holds the API key and the Cloudflare token, nothing else.
- **No clock** since 24 Aug 2026. `Salt fold (manual backup)` (trig_01UrnjQMWA3f6GXN5R6Dzi4S)
  is disabled, no cron: fire it by hand if the Fold step fails. The stage stands down while
  `master/_to_fold.json` is in HEAD, unless `fold.mjs --replays` says the batch is a replay.
- **Every task starts level with GitHub, never over a push in flight** (his instruction, 14 Sep
  2026). Changes reach `master` from his laptop edits, GitHub Desktop, Claude Code and the
  phone's cloud job. Before any task: `git fetch` and fast-forward to `origin/master`; wait out
  any Actions run in progress or queued (`gh run list`) and any row approved but not yet folded
  (`node tools/drafts.mjs --approved`), then fetch again. Uncommitted files in the checkout may
  be his edits: ask before moving past them.
- **A version asks about the queue first** (02 Sep 2026). Before any bump: `node
  tools/drain.mjs --status`, `node tools/drafts.mjs --list` and `--approved`, `git fetch` for a
  staged `_to_fold.json`. Ask him one line per pending item; never approve for him; fold
  anything approved into that version.
- **What is approved is the ROW, not the entry.** The phone leads with cost and margin read
  from the draft and computes nothing; the drafter's flags do the measuring, and a purchase is
  never measured with a seller's ruler.
- **What the drafter refuses, the phone does not let you type:** `entryFault` in the master
  answers both entry forms: roster codes only, no sale of a product with no lot, a date when
  something moved. **An R2 row books to the associate's `-R` bucket whether or not the end buyer
  is named** (his ruling of 13 Sep 2026) through the engine's `bookR2`, which the drafter, the
  fold's correction and the desk's queue branch and preview all call; a named buyer is noted as
  `downstream` and credited nothing, and the bucket has to be on the roster. A twin of a row on
  the book is put to him at entry and travels as `second`; a twin already queued on the device
  is refused as a double tap. A loan either way, in salt or in cash, is a Workbench mode,
  drafted and folded into `loans`; settling one is still a fold on his word.
- **The drafter is arithmetic, never a model**, and never prices: it reads the `PRICING` state
  key `tools/book.mjs pricingSnapshot()` derives from the engine. It refuses and records in
  `refused` (on the phone, self-cleaning): Linked and Rewarded amendments, `linkTo` or
  `orderCode`, a movement with no date, a product with no cost, a zero or negative figure, a
  date not in YYYY-MM-DD. Fulfilment, Cancellation, Modification and Correction go through the
  gate. **An entry stamped before the watermark that the draft table does not know is drafted,
  never dropped** (08 Sep 2026): `at` is minted on the phone.
- **The laptop's own queue takes the same road:** `node tools/drafts.mjs --from-queue`, which
  reads the book off the D1 mirror through wrangler since 16 Sep 2026, so no shell needs the write
  key (it took the keyed `/ledger` reads and 401ed from 16 Aug until then). A decided draft keeps
  its id for good; to re-draft a rejected or
  refused entry he later calls real, mint a new `at`, run `draftRow` against `readBook()`, then
  `drafts.mjs --draft`, `--approve --by`, `--approved > master/_to_fold.json`. A ledger row edit
  (right-click on `/desk`, tap on the phone) queues as a Correction.
- Endpoints: `GET /drafts?status=…`, `POST /drafts/<id>/approve|reject|committed`,
  `POST /draft-now?dry=1`, all keyed. Nothing writes to `entry`. **The `draft` table's CHECK
  lists every collection by name**, so a collection the drafter newly returns needs a migration
  rebuilding it, applied to the live D1 BEFORE the deploy and as that file alone (`wrangler d1
  execute salt_ledger --remote --file=...`): re-running an older one copies the rows through its
  narrower CHECK and INSERT OR IGNORE drops them. The suite checks the newest CHECK against the
  drafter. Newest: `migrations/0010`, `tierset` and `label`.
- **Cowork:** Salt left Cowork on 20 Aug 2026; root section 6 still lists
  `salt-daily-price-brief`. Settle it from Cowork.

## Sync and proof

- The phone polls `/rev` every ten seconds against its baked `SALT_BUILD_ID`; a newer build
  reloads an idle desk or offers a chip. `/rev` is `no-store` and never cached by `sw.js`.
- **`public/rev.json` id** = sha256 over the patched master, NUL, `sw`, NUL, `public/sw.js`,
  NUL, `worker`, NUL, every `src/*.js` sorted and NUL-joined. Written by the build only. It
  omits `public/_headers`, `manifest.webmanifest`, `chart.umd.js` and `wrangler.jsonc`: a change
  to those does not move the id, so `update.mjs` skips the deploy and reports the phone current.
  **Deploy `wrangler.jsonc` changes by hand.**
- A deploy is decided by `rev.json.id` against `.deployed.json.id` (`{id,v,at}` of the last
  successful deploy), never by hashing output before and after.
- `ci.yml` on push: book in date order, master version in the changelog, tests pass, `public/`
  matches the master by id. `ship-check.yml` daily: repo id against live `/rev`.
- **`node tools/update.mjs`** drains (a pull only, `drain.mjs --keep`, so a laptop update never
  races the cloud drafter), reports both queues, builds, tests, deploys only on an id change,
  commits, pushes, then proves master, `rev.json`, live `/rev` and origin agree; non-zero on any
  failure. `--dry`, `--no-push`, `--no-deploy`, `--no-drain`, `-m`. It never folds. Its mirror
  check reads the D1 snapshot through wrangler's own login, so no key is needed. The replay
  check refuses to ship while an entry above `QUEUE_COMMITTED` matches a ledger row by date and
  total; `--force-ship` after reading the rows.

## Names

Codes by default; names only after a password. `tools/seed-vault.mjs` encrypts `salt_bio.json`
with `$env:SALT_VAULT_PASS` (never a file) into the envelope `vaultDecrypt` expects and pushes
the ciphertext to KV; the desk auto-locks on `visibilitychange`. **AN ID THAT HAS A USERNAME BUT NO ACCOUNT CANNOT SIGN IN** (v707, his instruction of 18 Sep 2026):
the fold mints a USERNAME at registration and stops, and the record behind it is made on the laptop
at an issue, so anybody added between issues had an address and nothing behind it. `node
tools/stmt-account.mjs --mint` mints the record; it refuses without a master that unwraps an
existing record, never touches an account that exists, and the publish names who is stuck on every
run. **A name and ID is committed
every time, like an approved row** (05 Sep 2026): Add ID on the phone files the name and the
place into the vault, encrypted on the device, before the ID is queued; the laptop pulls them
down with `node tools/pull-vault.mjs` before any seed, and the vault's spelling wins where it
differs, the directory's old one kept as `was`. When a fold finds a roster code the directory
lacks, ask him for the name and the location before the ID commits, then write both to
`10_Data\salt_bio.json`, seed the vault, and commit the statement username in
`statements/_users.json` (minted by the fold at registration, kept for life; an address, not a
secret). The `-R` buckets, minted with every associate's appointment, are the one exception.
His own route is the `update-names-id` skill in `.claude/skills`, laptop only.

## Access and the write gate

- **`REQUIRE_ACCESS` is `"0"` on his instruction of 11 Aug 2026 and the Access application was
  removed.** Setting it to `"1"` without recreating the application locks him out. To restore:
  first the Access application (Self-hosted, Workers, `salt-command`, policy Allow for his two
  addresses), then the var, then deploy by hand. **This is the DESK. It is not the statements
  site's Access, which is live** and gates only `/all` there (set 10 Sep 2026).
- **Writes need `X-Salt-Key` = `SALT_WRITE_KEY` (armed 16 Aug 2026), and so do the reads that
  carry cost or trade: `/queue`, `/ledger`, `/drafts`, `/orders`, `/stmt-users`. The desk, `/rev`
  and `/queue/ping` stay open.** Unkeyed `POST /queue` or `/vault` returns 401. Change it with
  `npx wrangler secret put SALT_WRITE_KEY`, then clear `saltWriteKey` from the phone's storage.
  `drain.mjs` and `seed-vault.mjs` go through wrangler, unaffected.
- Withdraw a queued entry: `node tools/drain.mjs --status`, then `--forget <at>`.

## Statements site

`stmt/worker.js` and `stmt/page.js`: a second Worker on its own cryptic address, own KV store,
no access to the desk's; config `wrangler.stmt.jsonc`, and every command takes `-c`. Nothing
under `stmt/` imports from `src/`, `tools/` or a node builtin; the suite checks.
`statements/_secrets.json` is laptop only and gitignored; lose its key and every account is
re-issued. **Behind the password: statements, the price list and the order.** Everything else,
including the secrets, the price list and the order relay: `docs/STATEMENTS.md`.

- **The site address is never in the public desk.** No address, no QR drawn.
- **AN ORDER REACHES THE BOOK IN STAGES, AND SITE ORDERS WRITES NOTHING** (v694, his instruction of
  18 Sep 2026). Site orders moves the ORDER, Approve lands the ROW. The desk's every-minute
  `reconcileOrders` is the ONE road that queues: the acknowledgement makes a **Pending** row with the
  delivery charge beside its total (v727: the goods are the total and what is owed is the two together), a payment a **Fulfilment** of the increment, a handover a
  **Correction** stating the running total, a withdrawal a **Cancellation**. The row is named by
  `ledgerKey`, **the engine's `ovKey` to the character**, written onto the order at the
  acknowledgement, because a `rid` is minted at fold time and there is no route back from desk to
  site. An amendment WAITS until `OPEN.byKey` carries that key. Money and goods are two tracks, the
  customer types what they paid, he types what he handed over, and `done` is neither side's tap.
  **Cash on handover is withheld while that customer holds an unpaid advance**, and either side may
  cancel until the goods move. A delivery's general location stays on the site and never reaches a
  ledger note. **AN ENTRY IS STAMPED WITH ITS STAGE'S OWN MOMENT** (v731, 20 Sep 2026): `stageAt` in
  `src/orders.js` reads the acknowledgement event, the last payment, `movedAt` or the withdrawal, so
  two stages are two draft ids (one pass's clock collapsed three acks to one draft on 18 Sep), a
  re-queue after a failed mark lands on the same id, and the pending row is dated the day he agreed
  it. `queueSale` starts a `q:orders` it cannot parse afresh and logs the head of what it held (a
  hand-written key with its quotes stripped stalled every site order for a day); `tools/drain.mjs`
  writes KV through `--path` and names a key it cannot read. **The reconcile writes `sync`
  `{state, why, at}` onto the order** through the mark road, on change only, and the Site orders
  card reads it: queued, waiting for its row, or failed and why.
- **THE BULLETIN** (v732, his instruction of 20 Sep 2026): one clear key `bulletin` `{lines, mode, at}`
  in the site's store, no prefix, so the publish never touches it. Set from the Bulletin card at the
  top of Site orders through the desk's keyed `/bulletin`, relayed to the site's `/desk/bulletin` on
  the desk key; public `GET /bulletin` feeds the page's every-sixth poll. The band is the first thing in
  the body, door and inside; `run` scrolls, `change` rotates every four seconds. **The words are
  checked on the desk** (`siteWords` in `src/orders.js`, `siteSafe` on the phone): the desk's name, a
  roster code's shape and a level's name are refused, a product's name warns. An empty set clears it.
- **THE CUSTOMER'S LABEL IS A MARK, NOT A NAME** (v659, his instruction of 16 Sep 2026): a symbol and
  a colour for each level beside each product on their price list, and **the level is never named in
  the page**. They are greeted for the hour off their own device and told the month of their first
  priced order. **No name is used because none exists here** (rule 2); sealing one into a customer's
  own ciphertext is his decision, not a drift.
- **NO BRAND ON THE CUSTOMER'S PAGE, AND NO PRODUCT WORD EITHER** (his instructions of 10 and
  18 Sep 2026). Nothing under `stmt/` names Salt Command: not the door, not an order line, not the
  push banner, and since v695 **not the statement's letterhead** (`brand` is null in
  `tools/make_statements.mjs`; issues already sealed keep the letterhead they were issued with,
  because a dated record is not corrected in place). The landing lead is two sentences and stays
  two. **A PRODUCT IS A MARK, NOT A WORD** (v695): a golden cube outline for salt, a golden droplet
  outline for oil, `PSYM` in `stmt/page.js`, drawn and never loaded; anything else gets the ring, so
  an omission does not read as a fault. The product select became a segment of marks, because an
  option carries text and no drawing. A control holding only a mark is named by its **shape**
  (`PSHAPE`: Cube, Droplet, Ring), never by its product: an aria-label naming it would put the word
  back for exactly the readers who cannot see it was taken away. **The one name on the site is the
  app's**: **`Salt Counter`** (v704, his instruction of 18 Sep 2026; it went `Order Salt`, then
  `The Counter`, then his own name for it), in the manifest, the title, the iPhone app title and the
  tutorial. It is the app's name, the ONE place on this site where something has to be called
  something, and **the product word is his to spend there**: inside the page a product is still a
  mark and never a word. What never appears anywhere is the DESK's name. Twelve characters exactly,
  which is what iOS gives a home screen.
- **AN ASSOCIATE TICKS AN ORDER AS ON BEHALF OF A FRIEND** (v703, his instruction of 18 Sep 2026:
  their own orders and the ones they place for someone else can no longer be told apart by what they
  buy). A ticked order books to their `<CODE>-R` bucket exactly as a phone-entered downsell does:
  the entry carries `stream: "R2"` and `assoc`, the shape the drafter already takes, and the
  **engine's own `bookR2` does the booking** so the book never holds two kinds of downsell. **The
  `orderKey` is built on the BUCKET**, because that is the party the fold writes; built on the
  associate's own code, every later amendment would miss its row. Who is an associate is the report
  card's own list (`assoc.products[].rows[].id`), so the two readings cannot disagree; the publish
  marks that account's record `assoc: true`, **in the clear beside `issued`**, because the tick must
  be drawn before a password has opened anything and what it says is that this account MAY order for
  somebody else. The site checks nothing: it holds no roster, so it records the claim and the desk
  decides, exactly as with the quoted total.
- **A BUCKET IS NOT ITS OWN PERSON** (his ruling of 13 Sep 2026). An associate's `<CODE>-R`
  account is theirs: their statement (live and issued), price list, printed board and the order
  card's usual rate read the code and the bucket together, bucket lines marked *on behalf of a
  friend* (v687, his instruction of 18 Sep 2026; it read *for resale* until then),
  through `ownsCode` in `engine/position.mjs`. A bucket has no statement and no published
  username; its old `_users.json` line is kept but mapped to nothing, and it is never listed as
  an account of its own on the master account either.
- **`/all` IS THE MASTER ACCOUNT** (v687, his instruction of 18 Sep 2026), **behind Cloudflare
  Access, with two locks, neither trusted alone:** the Access application covers `/all` and
  everything under it, and `stmt/access.js` verifies the JWT again, RS256 against the team's keys
  with issuer, audience and expiry, because a header check passes a token signed by any key at
  all. With `ACCESS_TEAM` or `ACCESS_AUD` empty the route is 401, so deleting the application
  closes `/all` rather than opening it. **One check at the door of the whole prefix**: `/all`
  answers in plain words, every `/all/*` the same JSON 401 whatever the path, and an unknown path
  past it the site's usual 404. It opens on its items, never on a list. **THE OWNER'S SCRIPT IS
  `stmt/owner.js` AND TRAVELS ONLY THERE**: it lived in the page every customer opened until v687.
  Review reads `sheet`, the publish's account list, merged with the `seen:` opens.
- **SEND STATEMENT HANDS OVER THE PASSWORD FROM HIS PHONE** (v688, his decision of 18 Sep 2026).
  The issue seals each password under `STMT_MASTER` as `pwMaster` beside the record, and
  `tools/stmt-seal.mjs` did September's from `_passwords.json` on the laptop; the publish strips it
  from the customer's own record and carries it in `sheet`, behind Access. His page decrypts it in
  the browser and writes it straight to the clipboard, never into the page. The trade he took: an
  Access session now also signs in as a customer. **The plain password is still laptop-only**, in
  `_passwords.json`, and no message ever carries it; a tick lives at `sent:<issue>:<username>`, so
  both his devices agree on what has gone out.
- **THE SHARED LINK SIGNS THEM IN, ONCE** (v710, his instruction of 18 Sep 2026: when sharing the
  link, QR to the user, the site pre-fills their username and password). The username it fills in;
  the password it never can, two channels being a standing rule and a password in a message being a
  password in a chat log for good. **So the password is not put in the link, the LINK is made to
  sign them in.** His page has the content key open already, wraps it under a token it mints, and
  hands the Worker the wrap and the token's SHA-256: `ot:<hash>` names the record, so a dump of the
  store opens nothing, and the token is written nowhere. Opening posts it back, the record is read
  and deleted in that order, and from there it is an ordinary session, `assoc` and `card` included.
  **Two limits, stated rather than promised away**: a link inside its window IS a bearer credential,
  as a guest link's id is, and what it buys is that it expires and it burns, not that it cannot be
  forwarded; and **single use is best effort**, KV being eventually consistent, so the copy says
  once and `stmt/signin.js` is where the mechanism admits it cannot swear to it. **The `/s/` route
  is gated on the token's SHAPE, not the token**: a spent link and an invented one serve the same
  door to the character, so the door is not a probe, while anything that could never have been a
  link is still the site's 404, the old `/s/<CODE>` address included. The page rewrites its own
  address the moment the link is spent, and a link is tried before a remembered device.
- **KEPT AS AN APP** (v693, his instruction of 18 Sep 2026): the Worker serves
  `/manifest.webmanifest` and `/icon.png` (bytes from `stmt/icons.js`, written by
  `tools/stmt-icon.mjs --sync`, checked by `--check`), the CSP admits `manifest-src 'self'`, and the
  door carries a three-step tutorial that hides once the page runs standalone. **The icon and the
  name carry no brand**: a neutral ring, "Statement of account". **Every login asks about
  notifications** once, and only where the answer is still open; the ask now comes before the
  service worker is registered.
- **THE DOOR: LOG IN, REMEMBER ME, LOG OUT** (v692, his instruction of 18 Sep 2026). The
  three-minute lock is gone. **Remember me is split in two and neither half opens anything alone**:
  the browser keeps a random device key, the site keeps the content key wrapped under it at
  `rem:<token>` for 30 days, and the password is kept nowhere. The token is minted on a session,
  which only a correct password mints; **Log out drops the session and that wrap**, and a token
  only ever forgets its own account. An unknown token is refused in the door's one refusal.
- **THE HOURLY CHASE** (v700, his instruction of 18 Sep 2026: "the customer will be notified every
  hour to pay if it is an advanced order"). **This site's FIRST clock**: `wrangler.stmt.jsonc`
  carries `"triggers": {"crons": ["0 * * * *"]}` and `stmt/worker.js` exports `scheduled()`. An
  advance is the book's own word, goods out with money owed (`isAdvance`), so an order he has not
  touched is never chased. **One wake an hour per CUSTOMER, not per order**, capped by
  `chased:<username>` holding the HOUR BUCKET it was last woken in, expiring after two hours so a
  customer who settles up leaves nothing behind; his test account is skipped. Day and night, until
  it is paid, and it stops of its own accord. **A CRON HERE NEEDS A HAND DEPLOY**: `rev.json`'s id
  does not cover `wrangler.stmt.jsonc`, so `update.mjs` reports the phone current and ships nothing
  (`npx wrangler deploy -c wrangler.stmt.jsonc`).
- **AN ASSOCIATE SEES THEIR OWN CARD, BY MONTH, FROM THE START** (v706, his instruction of 18 Sep
  2026). A FOURTH SEALED DOCUMENT on their own record, `rec.card`, beside the statement and the price
  list and under the same content key, built by `associateCard` in `tools/book.mjs` off the SAME
  jsdom window as the prices. It is a different document from `/all/assoc`, which is his view of
  every associate and stays behind Access. **WHAT IS LEFT OFF IS THE POINT**: `share` is a ratio
  against the whole book's revenue, so an associate holding their own RM and their own share can
  solve for his total; `stars` are bands of that same share; `rank` is a position among other
  people. None travels. The reward is UNITS with the distance to the next as a SHARE of one, drawn
  as a bar, because the unit is a margin figure. **EVERY FIGURE ADDS UP TO THE LIST UNDER IT**: the
  lines are struck off `pricedSales`, the same basis as the summary, and `onward` counts the lines
  rather than `dsResell`, which read 14 above a list of 10. The fourth tab appears only where the
  record that opened actually carries a card.
- **THE ASSOCIATES REPORT CARD** (v691, his decisions of 18 Sep 2026): one card an associate a
  book on the master page, from `associateSnapshot` in `tools/book.mjs`, published as KV `assoc`
  and served only at `/all/assoc`. **What they did** (bought, sold for him, brought in, onward
  sales, introductions, share, stars) **and the reward in UNITS**, with the part-unit as a bar.
  **NO MARGIN CROSSES**: `ASSOC_FIELDS` is the whitelist, the distance to the next unit is a
  margin figure and travels only as a share of one, and a departure is a yes or no, never his note.
- **NOTHING A CUSTOMER SEES IS BOUND TO A MONTH** (v690, his instruction of 18 Sep 2026): the
  statement carries every order from the start and the page filters it. Each dated row carries its
  month, the strip is built from the months that account has, the newest opens, and All is one tap.
  The account's position does not move with the filter, and the line under the strip says so.
- **THE TEST ACCOUNT** (v689, his instruction of 18 Sep 2026): username `0000-0000`, password
  `0000-0000-0000-0000`, made and unmade from the master page with one tap. Zeros are not in the
  username alphabet, so it can collide with nothing; the Worker mints it with its own key, so no
  statement, price list or laptop secret is behind it. **It counts nowhere**: marked `test` on his
  list and out of every count, never written or retired by the publish, and no desk code maps to
  it, so an order it places books nothing. Deleting it takes its orders, opens, ticks and phones.
- **Guest links `/g/<id>`**: one board and nothing else, `script-src 'none'`. **The id
  IS the credential** (rejection sampling, never `byte % 30`) and the boards are NOT sealed,
  both deliberate. Unknown, malformed and withdrawn ids answer the same 404. **A row named
  "Tier 1" may carry no prices** (the engine gates it on bare `if(P.tier1)`), so take the first
  row with finite prices; oil is a genuine one-tier book and says so.
- **THE GUEST LINKS ARE FIVE, ONE FOR EACH TIER** (v696, his instruction of 18 Sep 2026). Titanium,
  Platinum, Gold, Silver, Bronze; **Ambassador is the floor and never a guest's**. They are ENSURED
  on the first open of the Links panel, not made on a tap, so the answer is always exactly five;
  minted once and kept for good, because an id handed to a stranger must never change what it opens.
  The level names reach the Worker through the KV key `tiers`, written by the publish, and with no
  names it makes none rather than inventing five. **A STANDING LINK READS ITS LEVEL'S BOARD**
  (v699), `tboard:<1..5>`, written by every publish from `tierBoard(level, ...)`, which is
  `boardList` with the level pinned. Nothing is written per standing link: v696 wrote one under each
  link's id, and since the five are minted the first time he opens the panel, any minted since the
  last publish had no board and fell back to `board:2`, the LAST level, so four of the five would
  have quoted Bronze until the next deploy. `tboard:` and not `board:`, because `board:2` already
  means the last level and not the second.
- **AN ASSOCIATE MAY MINT THEIR OWN, AND HE APPROVES IT** (v709, his instruction of 18 Sep 2026).
  `POST /my/refs` on a SESSION, never under `/all`, and refused with the site's 404 for anybody whose
  own record does not carry the associate mark. **PENDING MEANS SHUT FROM THE MOMENT IT EXISTS**,
  because the id IS the credential: `approved: false` is written at mint and the guest door refuses
  it exactly as it refuses a withdrawn one. **The test is `approved === false`, NEVER `!approved`**:
  no link already in the store carries the field, so the loose test would shut every link he has
  handed out, and shut it silently. He approves, declines or pins a tier from the Links panel; a tier
  he does not pin leaves it on the v658 rule, which is what "if need be" means. **Ambassador is
  refused** as a tier, being the floor. `standing` stays FALSE on an associate's link, or
  `ensureStanding` would adopt it as one of the five; `levelKey` keys on the LEVEL alone. An
  associate is handed where their link points and nothing of his: no label, no introducer, no level,
  no minter, and **no label is ever taken from them**, because a note here would be the first
  plaintext anybody but him has put in this store. Capped at `MAX_PER_ASSOC`, the shape of the
  open-order cap. Their panel lives in `CLIENT_JS` gated on `assoc`, because `stmt/owner.js` is his
  alone and the door is served before anybody signs in.
- **A LINK MAY INSTEAD NAME ITS INTRODUCER AND FOLLOW THEM** (v658, his rule): minting takes a
  customer's username, and the guest is quoted **two levels above theirs where there is room, else
  one, capped at the last**, per product. The level is never stored on the link; every publish
  recomputes it and writes `gboard:<id>`, so moving a customer up moves every link they gave out. A
  link minted since the last publish falls back to `board:2`. Detail: `docs/STATEMENTS.md`.

## Files that carry a rule

| Path | Rule |
|---|---|
| `engine/qr.mjs` | The ONE QR encoder and the only place its facts are stated: byte mode, level M, versions 1 to 10; inlined into the master like the pricing engine; `tools/qr.mjs` re-exports it and never copies it; `qrRectSvg` draws RECTANGLES, a stroked symbol does not scan |
| `stmt/qr.js` | GENERATED from `engine/qr.mjs` by `tools/qrsync.mjs --sync`; gate and CI fail on drift. Never edit it; `stmt/` may import only a sibling |
| `stmt/owner.js` | The master account's script, spliced into the page on `/all` alone; never in a customer's |
| `stmt/send.js` | The one copy of the words a customer is sent; `tools/stmt-send.mjs` imports them |
| `stmt/signin.js` | The one-time link: the token is hashed at rest and the wrap is opened only by the token; the two limits it cannot promise away are stated in its header |
| `tools/stmt-seal.mjs` | Laptop only: seals an issue's passwords under the master, proving each against its own verifier; where a code was re-keyed after the issue it pairs by PROOF, trying only passwords whose code has left the roster (v705) |
| `tools/stmt-account.mjs` | Laptop only: mints a full account for a roster code that has a username and no record, which the fold never did (v707). Refuses without a master that unwraps an existing record, never touches an account that exists, and skips a bucket and a supplier. The publish names who is stuck on every run |
| `tools/rid.mjs` | Stable `rid` per ledger row; `nextRid` is the one minting place |
| `tools/changelog.mjs` | Prepends `evolution[0]` to `master/changelog.json`; never rewrites |
| `test/verify.mjs` | ~2,880 assertions over 209 sections, no network or browser; add one per behavioural change, and **prove it red by mutation before trusting its green** |

The rest: `docs/DESK.md`.

## Working on it

```
npm install        # once
npm run build      # master -> public/desk.html, after any master edit
npm run dev        # build, then wrangler dev
npm test           # 2 to 7 minutes, not seconds; runs with a 4 GB heap
npm run deploy     # build, then wrangler deploy
node tools/update.mjs
```

Each build patch is anchored on one unique line; a moved anchor aborts. First-time Cloudflare
and local tools: `docs/DESK.md`.

## How a fold is sized (his instruction, 31 Aug 2026)

- **Smaller folds.** One thing, shipped; a fold that cannot be described in one sentence is two.
- **Sweep the class before shipping a fix.** Grep the pattern across the whole file first.
- **A round points at the newest code.** Probe the diff since the last round, attack the fix;
  older code is regression only.
- **An instrument is proved red before its green is trusted.** Reading source text, or checking
  inputs computed by the code under test, does not count.
