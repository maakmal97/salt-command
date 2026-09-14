# Salt Command, on the phone

Standing facts only. Root `CLAUDE.md` governs voice, structure, verification and
precedence; this file adds what a session here would otherwise rediscover, and
never repeats a root rule. British English, no em-dashes, in files, code and copy.
Correct stale facts in place; the dated record is the project changelog / journal.
Set 6 Sep 2026. **No size ceiling here** (his standing order, 10 Sep 2026): this file is not
cut to a byte count, and the root's 15 KB does not bind it. What it IS held to is
organisation. Every fact once, in the section that owns it; the dated record in
`master/changelog.json`, never here. This file is read whole at the start of every session in
this repo, so a fact stated twice is paid for twice, and a paragraph of history is paid for
every time it is not needed.
**THE HARD RULE NUMBERS ARE LOAD BEARING AND MAY NOT BE RENUMBERED.** Rules 1 to 6 are cited by
number from `engine/qr.mjs`, `stmt/qr.js`, `tools/qrsync.mjs`, `tools/ledger.mjs`,
`.claude/skills/update-names-id/SKILL.md` and twice in `test/verify.mjs`. Reorganise WITHIN a
rule freely; dissolving one into a topic section, or renumbering, silently strands every one of
those citations. Grep `rule [0-9]` before touching the list.

The Salt Command desk as a cloud app: the ledger and the pricing engine reachable on the
go, a transaction addable from the phone. **This repo holds the master** (since 20 Aug
2026) and is deployed as a Cloudflare Worker with static assets at
`https://salt-command.qyts8mh72kyg.workers.dev`, `/desk` being the one surface. Public by
the owner's decision of 11 Aug 2026, no sign-in. The reasoning, the version history and
the superseded passages are in `docs/NOTES.md`, the former body of this file, verbatim.
The fold routine is `docs/CLOUD_FOLD.md`; statements `docs/STATEMENTS.md`; design
`docs/DESIGN.md`.

## Hard rules

1. **The master is `master/salt_command.html`. Never hand-edit `public/desk.html`**, a
   build output committed so the data lives in the repo. Inside the master four blocks
   are GENERATED and CI fails if any differs from its file: `ENGINE` from
   `engine/pricing.mjs`, `engine/position.mjs` and `engine/qr.mjs` (`node tools/engine.mjs --sync`),
   `BOOK` from `ledger/book.json` (`tools/booksync.mjs --sync`), geography from
   `geo/*.json` (`tools/geosync.mjs --sync`), `DESIGN` from `design/salt-ds.css` and
   `design/desk.css` (`tools/designsync.mjs --sync`). Edit the module, sync, build.
   `evolution` and `LAST_UPDATED` stay in the master. **A fold edits `ledger/book.json`,
   never rows in the master.** Nothing outside the master may price anything: two
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
5. **RM and unit only**; the mass symbol was retired at v161. **The goods are inventory in
   copy and never shelf (v504); the rail's destination is Stock** (his instruction, 11 Sep
   2026, v571), which was always the view's id. **v504 did not finish**: `Spent on stock` and
   `Stock behind it` on Financials, and `Stock reconciliation` on On hand, still say it,
   measured on the rendered desk 11 Sep 2026. **The Journal is exempt and stays so**: its
   passages say shelf wherever a fold wrote it on the day, and a dated record is not corrected
   in place. One floor per size, the goods after the leak; no delivery, no
   time in it (v502). A sale carries `delivery` (inside its total) and a lot `freight`
   (beside it), typed per row (v503); `txGoods` strikes every rate on the goods. **The window
   is the last three lots** (rate and freight); **the leak is the drift of the last three
   counts** (`COUNTS` on the book, appended by every fold) over the units sold in those
   cycles, at landed; **the ask is a margin on the floor** (`ladderMargin`, `anchorG` per
   book), all v504. **Two tiers since v564.** Tier 2 is that derived ask, unchanged, and is
   **row zero of `ladderRow`, which is load bearing**: phone, mirror and suite read `[0]`.
   Tier 1 is STATED at its ends in `LADDER.tier1` (salt 0.5:60, 12.5:875), the rate
   interpolated in the log of size between them, clamped outside; the ends print verbatim
   because RM875 is off the ten grid. A one-tier book needs `tier1:null` in `LADDER_BY` **as
   an entry, not an omission**, or `ladderFor` hands it salt's. Board prints cheapest first;
   the payload does not. **Nothing clamps the two together and nothing should**: `tier1.over` (v566)
   measures the RM by which Tier 1 exceeds the ask, beside `under`, and the board tags the row and
   refuses its all-clear; a stated price is quoted anyway. **The customer's suggested price rounds
   to the nearest five**, never under its floor: `adjustedPrice` and `pbAdjusted`, held together by
   a 416-point grid in the suite (v566).
6. **The look is the Salt design system applied as a layer.** Material, type and colour
   are decided in `design/desk.css` over the vendored `design/salt-ds.css`; a colour or
   type change is an edit there, then `--sync`, then build, never a hex in the master's
   older layers. Chart series read the identity's hexes directly (`salt-ds/src/tokens.ts`
   shadows the stylesheet), so a palette change is two places. Product hues are
   `PRODUCTS.accent` in `ledger/book.json`.
7. **Git: never from a mounted sandbox** (Cowork, agents on a mount that denies unlink),
   which leaves `.git/*.lock` and `tmp_obj_*` behind and silently blocks every later
   commit; `git status` alone recreates `index.lock`. **A native Windows Code session may
   run git.** After committing, verify: `git rev-list --count origin/master..HEAD` and no
   lock files remain; `node tools/update.mjs` does both. Clean-up after a mounted session:
   ```
   Get-ChildItem .git -Recurse -Include *.lock,tmp_obj_* -Force | Remove-Item -Force
   ```
8. **Three deployers, and only the Actions job does the whole job.** `cloud-commit.yml` gates,
   deploys, proves the phone is serving the build, marks the folded rows committed, re-seeds the
   D1 mirror, publishes the statements, then runs the suite. `tools/update.mjs` does the laptop
   half of that and never touches the statements. **Cloudflare Workers Builds deploys the tip of
   master and stops** (reconnected on his instruction, 10 Sep 2026). The Actions job is the
   authority; this is a convenience, and it cannot touch the ledger because it never folds, never
   marks a draft committed and never writes D1 or KV. Its worst case is the wrong build in front
   of the phone, caught within a day by `ship-check.yml`, which does not care who deployed. Its
   build token is its own credential and its failure is SILENT. A build lands in about a minute
   against the Actions job's checkout and `npm ci`, so it usually wins that race; the
   `Already serving?` guard holds back only Gate and Deploy, so winning no longer skips the
   mirror re-seed and the suite.
   **Its build command is `npm ci && node tools/gate.mjs`, then `npx wrangler deploy`** (10 Sep
   2026). Gate BEFORE build: `buildMatches()` rebuilds `public/` itself and fails if the committed
   id differs, so a build in front of it makes that check vacuous, and the gate leaves a verified
   `public/` for wrangler to ship. It matters because Actions runs only on a push touching
   `public/rev.json` or the statements paths, so a push touching `src/` or the master alone is one
   only Workers Builds ships.
   **Read the config back rather than trusting this line**, and not from the dashboard:
   `GET /accounts/{account}/builds/workers/{script_tag}` with the `.../triggers` beside it,
   `script_tag` being `e85618c353ad4fd6b009cf57e05f0842`; builds at
   `.../builds/workers/{script_tag}/builds`, logs at
   `.../builds/builds/{uuid}/logs`, and the logs are the only place that shows what the build
   actually ran. The MCP builds tool reports zero where the API reports 280. The `master` trigger
   deploys; the other excludes master, uploads a version rather than deploying, is off
   (`previews_enabled: false`), and is still on the ungated `npm run build`.

## The one surface

**Retired at v387:** the phone app `public/index.html`, `public/data.json` and the
claude.ai mirror. The built desk is seven destinations over eighteen pages
(`VIEWS` in the master): Today, Order book, Stock, Pricing, Customers, The book, Enter.
**The rail is two levels at most** (his instruction, 14 Sep 2026, v622): the destinations with no
heading above them, and the open one's pages beneath it; a destination with one page lists
nothing. **One product in view for the whole desk** (his rule, 14 Sep 2026, v625): `PROD`, set only
through `setProdView` by the page's product switch, the single-book pages' badge and the Enter form's
select, and remembered on the device. A per-product page draws that product's detail alone, under a
switch whose buttons carry every product's headline; the rail carries no switch.
Old tab ids remain addresses (`/desk#network`). In cloud mode the Enter view carries
**Add ID** (a code queued as `addid`, drafted into the roster, approved, folded), **Amend ID**
and **Approve**; the laptop desk keeps Names & IDs and has no drafts table. **Amend ID** (his
instruction, 14 Sep 2026, v628, on his rulings of 11 Sep): the new name and place go into the vault;
a code they derive differently is queued as `rename`, drafted, approved, and folded LAST in its
batch as a re-key wherever the book holds the code (`renamePairs`/`renameInBook` in the engine), the
`-R` account with it, plus the statement key (username kept), a place override in `geo/places.json`
and the suite's fixtures. Prose and history keep the old code. The fold refuses a code the master's
own logic quotes (CJ4-OKR, SA5-BTR, SP7-PUD, and CM6-HCM in a comment): those are hand folds. Everything the
desk shows, cost and margin included, is served at the public URL.
**The map** (his decisions of 14 Sep 2026, v630, replacing v293's unnamed heat): the core districts shaded
by revenue for the product in view, a tap opening that district's mukim, bandar and pekan with each party a
dot, and the whole peninsula a switch away; since v635 a second switch (`MAP_METRIC`) shades by revenue, margin, units,
customers or credit owed, and since v636 over a period (`MAP_FROM`/`MAP_TO`: a month off the slider, two dates, or all time),
played month by month; credit owed in a period is what is still owed on the orders placed in it. Since v637 a district
opened carries a drill panel (`MAP_PICK`), and a tap on one of its areas swaps in that area's: figure, share and rank at its
level, the trend month by month, and its parties by code. **Area names show; a party's name never does**, even unlocked.
A party is counted in the area its point lies inside, whichever district that area is filed under, because
the two levels come from different surveys. The leak checks exempt a directory place only when it IS an
official area name (`areaNameSet` in `tools/book.mjs`); six places on the directory were, on 14 Sep 2026.
**A party's place reaches the map on its own** (his decision of 14 Sep 2026, v633). The place typed at Add ID or Amend
ID is looked up whole, then by its parts, then by runs of its words (`placeCandidates` in the engine), each wording as an
official area name and then in `geo/gazetteer.json`: GeoNames' populated places in the core states, each name kept as
seven hex characters of SHA-256 over its `placeKey` beside a point to 0.01 degrees, built by `tools/gazfetch.mjs` from
GeoNames alone and never from the directory. A five-letter word alone counts only as an area name. Not found, or a name
standing for places over 3 km apart, is tapped on the map under the form, and Record waits for the point. The point
travels as `geo` on `addid` and `rename`, or as the collection `place` (Amend ID keeping the code, or the map's *Place
parties from their recorded places* with the names open); the fold files it in the book's `PLACED`, which `placeOf`
reads before a code's tail. On 14 Sep 2026 it found 33 of the directory's 42 recorded places.
**A defaulted sale is written off** (his instruction, 14 Sep 2026, v634): `txAdvance` reads nothing owed on it, as
`poOwed` reads nothing on a defaulted lot, so it leaves every reading of what is owed, the credit rules and the chase;
`txWrittenOff` carries the figure to every reading of what was lost (the P&L impairment line, the month's charge, the
bad-debt rate in the price stack, the receivables signal, a party's quote), so no loss and no price moves with it. A party
with a write-off is not approached, offered or messaged (`approachable`). The customer's statement is untouched.

## The chain: tap to deploy

| Step | Where | When |
|---|---|---|
| Queue an entry | KV `q:<deviceId>`, `POST /queue` from the phone | on tap; held offline, retried every ten seconds |
| Draft the row | Worker `src/drafter.js` | on arrival via `waitUntil`, plus a `*/15` cron as the net |
| Approve or reject | D1 `draft`, `POST /drafts/<id>/approve` | on tap; a decided row returns 409; a rejection drops the entry from every queue and the phone offers it back to re-enter (v525) |
| Stage approved rows | Actions `cloud-commit.yml`, one job `chain` since v520 | dispatched by every approval (Worker holds `SALT_GITHUB_TOKEN`), hourly as the net |
| **Fold, bump, build, test, push** | the `Fold` step: `tools/foldcall.mjs`, one Claude call for the notes (`ANTHROPIC_API_KEY`) over `fold.mjs`, since v521; or any agent asked, per `docs/CLOUD_FOLD.md` | same job when rows were staged; or on demand |
| Gate (`tools/gate.mjs`, CI's mechanical checks in about ten seconds, v522), deploy, prove, mark committed (with the clock, v519), re-seed the D1 mirror, publish statements, then the full suite | the steps that follow in the same job; a push runs them alone, and skips the deploy when the phone already has the build; a suite failure after the phone is live turns the run red and is written where the phone shows refusals, never rolled back | same job; or on push |
| Prove repo and live agree | `ship-check.yml` | 11:00 MYT |
| Deploy the statements site | the same job, on its own paths. **The checkout is depth 1, so the base commit must be FETCHED before it is diffed** (fixed 10 Sep 2026), or `git diff` fails into `2>/dev/null` and a statements-only push deploys nothing while the run goes green. It bit only when the desk's build id had not moved, which is what a statements-only change does. Fails safe: no base, deploy anyway | on push |
| Monthly statements | `docs/STATEMENTS.md` routine | the 1st, gated in Kuala Lumpur time |

- **A CHANGE TO `cloud-commit.yml` NEVER TESTS ITSELF ON THE WAY IN** (10 Sep 2026). That file is
  not in its own `push.paths`, so pushing it triggers nothing and proves nothing. Dispatch a run
  by hand, or push it with a file on one of those paths, and then READ THE STEP LIST: most steps
  are conditional, so a skipped step is green too. Two faults hid behind exactly this in one day.
- **The fold is a judgement and stays with a model**: the row NOTE, the `evolution` entry
  and the sentence on the roll come from one Claude call over a dossier the tools compute
  (`tools/foldcall.mjs`, v521); what a row DOES, what is refused and what the inventory rolls
  are `fold.mjs`, never the model. CI holds the API key and the Cloudflare token, nothing else.
- **No clock** since 24 Aug 2026. `Salt fold (manual backup)` (trig_01UrnjQMWA3f6GXN5R6Dzi4S)
  is disabled, no cron: fire it by hand if the Fold step fails. The stage stands down while
  `master/_to_fold.json` is in HEAD, unless `fold.mjs --replays` says the batch is a replay (v512).
- **Every task starts level with GitHub, never over a push in flight (his instruction, 14 Sep
  2026).** Changes reach `master` from his own edits on the laptop, GitHub Desktop, Claude Code
  and the phone, whose cloud job pushes for itself; GitHub online only rarely. Before any task:
  `git fetch` and fast-forward the checkout to `origin/master`; wait out any Actions run in
  progress or queued (`gh run list`) and any row approved but not yet folded (`node
  tools/drafts.mjs --approved`), then fetch again. Uncommitted files in the checkout may be his
  edits: ask before moving past them.
- **A version asks about the queue first (02 Sep 2026).** Before any bump: `node
  tools/drain.mjs --status`, `node tools/drafts.mjs --list` and `--approved`, `git fetch`
  for a staged `_to_fold.json`. Ask him one line per pending item; never approve for him;
  fold anything approved into that version.
- **What is approved is the ROW, not the entry.** The phone leads with cost and margin
  read from the draft and computes nothing; the drafter's flags do the measuring, and a
  purchase is never measured with a seller's ruler.
- **What the drafter refuses, the phone does not let you type (v524):** `entryFault` in the
  master answers both entry forms: roster codes only, no sale of a product with no lot, a date when
  something moved. **An R2 row books to the associate's `-R` bucket whether or not the end buyer is
  named** (v611, his ruling of 13 Sep 2026) through the engine's `bookR2`, which the drafter, the
  fold's correction and the desk's queue branch and preview all call; a named buyer is noted as
  `downstream` and credited nothing, and the bucket has to be on the roster. A twin of a row on the book is put to him at entry and
  travels as `second` (v526); a twin already queued on the device is refused as a double tap.
  A loan either way, in salt or in cash (v589), is a Workbench mode, drafted and folded into `loans` (v527); settling one is
  still a fold on his word.
- **The drafter is arithmetic, never a model**, and never prices: it reads the `PRICING`
  state key `tools/book.mjs pricingSnapshot()` derives from the engine. It refuses and
  records in `refused` (on the phone, self-cleaning): Linked and Rewarded amendments,
  `linkTo` or `orderCode`, a movement with no date, a product with no cost, a zero or negative
  figure, a date not in YYYY-MM-DD (08 Sep 2026). Fulfilment, Cancellation, Modification and
  Correction go through the gate. **An entry stamped before the watermark that the draft table
  does not know is drafted, never dropped** (08 Sep 2026): `at` is minted on the phone, and an
  offline tap that lands after a later fold used to be counted as committed and lost.
- **The laptop's own queue takes the same road:** `node tools/drafts.mjs --from-queue` (broken
  since the reads were gated). A decided draft keeps its id for good; to re-draft a rejected or
  refused entry he later calls real, mint a new `at`, run `draftRow` against `readBook()`, then
  `drafts.mjs --draft`, `--approve --by`, `--approved > master/_to_fold.json` (08 Sep 2026).
  A ledger row edit (right-click on `/desk`, tap on the phone) queues as a Correction.
- Endpoints: `GET /drafts?status=…`, `POST /drafts/<id>/approve|reject|committed`,
  `POST /draft-now?dry=1`, all keyed. Schema `migrations/0002`, `0003`. Nothing writes
  to `entry`. **The `draft` table's CHECK lists every collection by name**, so a collection the
  drafter newly returns needs a migration rebuilding it, applied to the live D1 BEFORE the deploy and
  as that file alone (`wrangler d1 execute salt_ledger --remote --file=...`): re-running an older one
  copies the rows through its narrower CHECK and INSERT OR IGNORE drops them. Missed twice: `priceset`
  (0007) and `repayment` (0008); the suite now checks the newest CHECK against the drafter. Newest: 0009, `place` (v633).
- **Cowork:** Salt left Cowork on 20 Aug 2026; root section 6 still lists
  `salt-daily-price-brief`. Settle it from Cowork.

## Sync and proof

- The phone polls `/rev` every ten seconds against its baked `SALT_BUILD_ID`; a newer
  build reloads an idle desk or offers a chip. `/rev` is `no-store` and never cached by
  `sw.js`.
- **`public/rev.json` id** = sha256 over the patched master, NUL, `sw`, NUL, `public/sw.js`,
  NUL, `worker`, NUL, every `src/*.js` sorted and NUL-joined. Written by the build only.
  It omits `public/_headers`, `manifest.webmanifest`, `chart.umd.js` and
  `wrangler.jsonc`: a change to those does not move the id, so `update.mjs` skips the
  deploy and reports the phone current. **Deploy `wrangler.jsonc` changes by hand.**
- A deploy is decided by `rev.json.id` against `.deployed.json.id`, never by hashing
  output before and after (10 Aug: identical rebuild, undeployed bundle, silent).
- `ci.yml` on push: book in date order, master version in the changelog, tests pass,
  `public/` matches the master by id. `ship-check.yml` daily: repo id against live `/rev`.
- **`node tools/update.mjs`** drains (a pull only since 09 Sep 2026: `drain.mjs --keep`, the
  phone's KV keys are kept, so a laptop update never races the cloud drafter), reports both
  queues, builds, tests, deploys only on an id change, commits, pushes, then proves master,
  `rev.json`, live `/rev` and origin agree; non-zero on any failure. `--dry`, `--no-push`,
  `--no-deploy`, `--no-drain`, `-m`. It never folds. Its mirror check reads the D1 snapshot
  through wrangler's own login (`readSnapshot` in `tools/d1.mjs`), so no key is needed (14 Sep 2026). The replay check refuses to ship while an entry above
  `QUEUE_COMMITTED` matches a ledger row by date and total; `--force-ship` after reading
  the rows.

## Names

Codes by default; names only after a password. `tools/seed-vault.mjs` encrypts
`salt_bio.json` with `$env:SALT_VAULT_PASS` (never a file) into the envelope
`vaultDecrypt` expects and pushes the ciphertext to KV; the desk auto-locks on
`visibilitychange`. **A name and ID is committed every time, like an approved row (05 Sep
2026):** since v528 Add ID on the phone asks for the name and the place and files them into
the vault, encrypted on the device, before the ID is queued; the laptop pulls them down with
`node tools/pull-vault.mjs` before any seed, and since v628 the vault's spelling wins where it
differs (Amend ID writes there), the directory's old one kept as `was`. When a fold finds a roster code the directory
lacks, ask him for the name and the location before the ID commits, then write both to
`10_Data\salt_bio.json`, seed the vault, and commit the statement username in
`statements/_users.json` (minted by the fold at registration since v588, kept for life; an address, not a secret). The `-R`
buckets, one minted with every associate's appointment since v610, are the one exception. His own route is the `update-names-id`
skill in `.claude/skills`, laptop only.

## Access and the write gate

- **`REQUIRE_ACCESS` is `"0"` on his instruction of 11 Aug 2026 and the Access
  application was removed.** Setting it to `"1"` without recreating the application
  locks him out. To restore: first the Access application (Self-hosted, Workers,
  `salt-command`, policy Allow for his two addresses), then the var, then deploy by hand.
  **This is the DESK. It is not the statements site's Access, which is live** and gates
  only `/all` there (set 10 Sep 2026); the two share nothing but a team name.
- **Writes need `X-Salt-Key` = `SALT_WRITE_KEY`, armed 16 Aug 2026, and so do the reads that
  carry cost or trade: `/queue`, `/ledger`, `/drafts`, `/orders`, `/stmt-users`. The desk, `/rev`
  and `/queue/ping` stay open (corrected 08 Sep 2026).**
  Unkeyed `POST /queue` or `/vault` returns 401. Change it with
  `npx wrangler secret put SALT_WRITE_KEY`, then clear `saltWriteKey` from the phone's
  storage. `drain.mjs` and `seed-vault.mjs` go through wrangler, unaffected.
- Withdraw a queued entry: `node tools/drain.mjs --status`, then `--forget <at>`.

## Statements site

`stmt/worker.js` and `stmt/page.js`: a second Worker on its own cryptic address, own KV
store, no access to the desk's. Username plus password, decrypted in the reader's
browser, locked after three minutes. Nothing under `stmt/` imports from `src/`, `tools/`
or a node builtin; the suite checks. Config `wrangler.stmt.jsonc` (every command takes
`-c`). `tools/stmt-publish.mjs` runs on every deploy, sealing each customer's statement
under a content key derived from `STMT_KEY`. `statements/_secrets.json` is laptop only,
gitignored: `{"key","master"}`; the key is the same string as the Actions secret, and
losing it re-issues every account. `tools/make_statements.mjs` (the v387 desk's
statement code, plain node) and `tools/qr.mjs` feed it.

**Behind the password since v499 (06 Sep 2026): statements, prices, order.** The price
list (`tools/pricelist.mjs`: median of the last four orders before the week's Monday, drawn
toward the board's ask by `adjustedPrice` (v510), never below the floor; no history means
the ask) is sealed in by the
publish, which opens the master in jsdom for the PRICING inputs. Orders live in the site's
KV (`stmt/orders.js`) on a session `/open` mints; payment at `ready` only, one QR Command
link per rail, accounts from `stmt/pay.js` (`tools/paysync.mjs`, no number ships). The desk
reads and moves them over the `STMT_SITE` service binding with `STMT_DESK_KEY` on both
Workers (`src/orders.js`; the site has no road back); `done` queues the sale under
`q:orders`; the publish writes `stmt-users` to the desk's KV. `node tools/stmt-setup.mjs`
sets the desk key and the site's push pair. Detail: `docs/STATEMENTS.md`.
**Print a board (v564)** saves HTML, PDF or JPG: crystal, sizes, username, then a QR to
`<site>/?u=<username>`. **The site address is never in the public desk**: the publish writes
KV `stmt-site` and keyed `GET /stmt-users` returns it, so the laptop has no username and no
QR. No address, no QR drawn.

**NO BRAND ON THE CUSTOMER'S PAGE** (his instruction, 10 Sep 2026). Nothing under `stmt/` names
Salt Command: not the door, not an order line, not the push banner. Nothing a customer holds may
point at the ledger, and an eyebrow carrying the name undid that. The landing lead is two
sentences and stays two. The statement DOCUMENTS keep it as a letterhead (`brand:` in
`tools/make_statements.mjs`), deliberately: changing that rewrites every archive.

**A BUCKET IS NOT ITS OWN PERSON** (v609, his ruling of 13 Sep 2026). An associate's `<CODE>-R`
account is theirs: their statement (live and issued), price list, printed board and the order
card's usual rate read the code and the bucket together, bucket lines marked *for resale*, through
`ownsCode` in `engine/position.mjs`. A bucket has no statement and no published username; its old
`_users.json` line is kept but mapped to nothing.

**`/all` IS THE OWNER'S LIST, behind Cloudflare Access** (v566). It serves the customer's own
page with the roster where the gate is; a tap fills the username and `STMT_MASTER` into that
form and submits it, so everything past the door is the customer's own code. His decision: the
gated route hands the master to the page, so nothing is typed, and the trade is that an Access
session there reads every account. **Two locks, neither trusted alone:** the Access application
("Salt statements owner", `67280e0b-…`, one-time PIN, his address, 24h) covers `/all` and
everything under it, and `stmt/access.js` verifies the JWT again, RS256 against the team's keys
with issuer, audience and expiry, because a header check passes a token signed by any key at
all. With `ACCESS_TEAM` or `ACCESS_AUD` empty the route is 401: it deploys before the
application exists, and deleting the application closes `/all` rather than opening it. `roster`
(codes beside usernames, never names) is written by the publish.

**GUEST REFERRAL LINKS: `/g/<id>`** (v566), minted inside `/all`, pinned to Tier 1 or Tier 2 and
labelled. One tier's board and nothing else, no script at all, `script-src 'none'`. **The id IS
the credential** and the boards are NOT sealed, both deliberate: a board is what he prints and
hands to strangers, and the link exists to say WHICH stranger. Unknown, malformed and withdrawn
ids answer the same 404. `stmt/refs.js`; `board:1`/`board:2` written by the publish from
`boardList`, which takes one row off the engine's `ladderRow` and prices nothing itself.
**A row named "Tier 1" may carry no prices** (the engine gates it on bare `if(P.tier1)`), so take
the first row with finite prices; oil is a genuine one-tier book and says so.

## Files

| Path | What it is |
|---|---|
| `src/worker.js` | `/queue`, `/vault`, `/bio` dropped, `/drafts`, `/orders` (relay), `/rev`, static assets; dispatches the stage on approval |
| `src/drafter.js` | Queue plus D1 mirror to a proposed row in `draft`; never writes `entry` |
| `tools/fold.mjs` | `--plan` reads `master/_to_fold.json`, refuses what it must, writes the notes skeleton; `--apply` folds all or nothing, syncs, bumps, rolls the shelf, moves the watermark |
| `engine/qr.mjs` | The ONE QR encoder and the only place its facts are stated: byte mode, level M, versions 1 to 10; inlined into the master like the pricing engine (v564); `tools/qr.mjs` re-exports it and never copies it; `qrRectSvg` draws RECTANGLES, a stroked symbol does not scan |
| `stmt/access.js` | Who passed Cloudflare Access, VERIFIED not assumed; header or `CF_Authorization` cookie; fails closed on an unset var |
| `stmt/refs.js` | Guest referral links: mint, list, revoke, count opens. The id is the credential; rejection sampling, never `byte % 30` |
| `stmt/qr.js` | GENERATED from `engine/qr.mjs` by `tools/qrsync.mjs --sync`; gate and CI fail on drift. Never edit it; `stmt/` may import only a sibling |
| `tools/rid.mjs` | Stable `rid` per ledger row; `nextRid` is the one minting place (`ovKey` collided on two SA5-BTR lots) |
| `tools/drafts.mjs` | `--schema`, `--list`, `--draft <file>`, `--approved`, `--committed <id>`, `--from-queue`; via wrangler, no key |
| `tools/drain.mjs` | KV to `06_Data\salt_queue_cloud.json`; `--committed <ISO>`, `--status`, `--forget` |
| `tools/sort-ledger.mjs` | Date order, undated pending last; asserts a permutation |
| `tools/changelog.mjs` | Prepends `evolution[0]` to `master/changelog.json`; never rewrites |
| `tools/renderdiff.mjs` | `--shoot <label>` every part at 1280 and 375, `--compare <a> <b>`; Playwright from `Code\salt-ds\.ds-sync`; by hand |
| `tools/send-sheet.cmd` | Opens the newest `_send_*.html`; the Desktop shortcut `Send Statement` points here |
| `geo/*.json`, `tools/geofetch.mjs`, `tools/areafetch.mjs`, `tools/gazfetch.mjs` | Basemap (four state outlines, ODbL, unnamed), `places.json` (the code-tail table), since v630 `geo/areas.json`: the 91 districts of Peninsular Malaysia (CC BY 3.0) and the 370 mukim, bandar and pekan of the core states (CC BY 4.0), rings as encoded polylines at 2e-4 degrees, pinned geoBoundaries release `9469f09`; and since v633 `geo/gazetteer.json`, GeoNames' place names in the core states hashed and packed (CC BY 4.0, 55 KB). The three fetch tools alone touch the network, by hand (`gazfetch --from` reads a saved `MY.zip`); geosync inlines all four |
| `public/sw.js`, `public/_headers`, `manifest.webmanifest`, `icon-*.png` | Shell network-first, `/queue` never cached; CSP; icons from `Code\salt-ds` |
| `.deployed.json` | `{id,v,at}` of the last successful deploy |
| `test/verify.mjs` | ~2,130 assertions over 138 sections, no network or browser; add one per behavioural change, and **prove it red by mutation before trusting its green** |

## Working on it

```
npm install        # once
npm run build      # master -> public/desk.html, after any master edit
npm run dev        # build, then wrangler dev
npm test           # 2 to 7 minutes, not seconds; runs with a 4 GB heap
npm run deploy     # build, then wrangler deploy
node tools/update.mjs
```

First-time Cloudflare: `npx wrangler kv namespace create salt_queue`, paste the id over
`PLACEHOLDER_KV_ID`, deploy. The build only adds a PWA head, a service worker, a device
id and cloud-mode copy, each patch anchored on one unique line; a moved anchor aborts.
`/queue/ping` returns `cloud:true`. `serve_desk.py` and `salt_sync.ps1` still exist for
local work; `npm run dev` does the preview half better.

## How a fold is sized (his instruction, 31 Aug 2026)

- **Smaller folds.** One thing, shipped; a fold that cannot be described in one sentence
  is two.
- **Sweep the class before shipping a fix.** Every partial in round eight was a twin a few
  lines from the fix. Grep the pattern across the whole file first.
- **A round points at the newest code.** Probe the diff since the last round, attack the
  fix; older code is regression only.
- **An instrument is proved red before its green is trusted.** Reading source text, or
  checking inputs computed by the code under test, does not count.
