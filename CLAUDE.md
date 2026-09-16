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
5. **Copy and price.** Detail in `docs/DESK.md`.
   - **RM and unit only.** The goods are **inventory** in copy, never shelf; the rail's
     destination is **Stock** (his instruction, 11 Sep 2026). **Unfinished:** `Spent on stock`
     and `Stock behind it` on Financials, and `Stock reconciliation` on On hand, still say it
     (measured 11 Sep 2026). **The Journal is exempt and stays so**: a dated record is not
     corrected in place.
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
     never bind. A guest link is a level too: the cheaper one is Titanium, the dearer Bronze.
   - **Each customer holds a tier for each product** (his instruction, 15 Sep 2026): `TIER_OF`
     on the book, code to product to level name, folded as `tierset`, a null clearing a product.
     **A customer's price is their tier, never above what they pay** (his decisions of 15 Sep
     2026), and **a product with no tier, held or proposed, is not priced**. One rule, the
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
   D1 mirror, publishes the statements, then runs the suite. `tools/update.mjs` does the laptop
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
master): Today, Order book, Stock, Pricing, Customers, The book, Enter. **The rail is two
levels at most** (his instruction, 14 Sep 2026). **One product in view for the whole desk**
(his rule, 14 Sep 2026): `PROD`, set only through `setProdView`. Old tab ids remain addresses
(`/desk#network`). In cloud mode the Enter view carries **Add ID**, **Amend ID** and
**Approve**; the laptop desk keeps Names & IDs and has no drafts table. **Amend ID** (his
instruction, 14 Sep 2026) re-keys a changed code wherever the book holds it; prose and history
keep the old code. The fold refuses a code the master's own logic quotes (CJ4-OKR, SA5-BTR,
SP7-PUD, and CM6-HCM in a comment): those are hand folds. Everything the desk shows, cost and
margin included, is served at the public URL.

**The map** (his decisions of 14 Sep 2026): districts shaded by a metric over a period, drilled
to mukim, bandar and pekan, parties as dots. **Area names show; a party's name never does**,
even unlocked. A party is counted in the area its point lies inside, whichever district that
area is filed under. The leak checks exempt a directory place only when it IS an official area
name (`areaNameSet` in `tools/book.mjs`). **A party's place reaches the map on its own** (his
decision of 14 Sep 2026) through `geo/gazetteer.json`, built from GeoNames alone and never from
the directory; an unresolved place is tapped on the map and Record waits for the point.

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
| Draft the row | Worker `src/drafter.js` | on arrival via `waitUntil`, plus a `*/15` cron as the net |
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
- **The laptop's own queue takes the same road:** `node tools/drafts.mjs --from-queue` (broken
  since the reads were gated). A decided draft keeps its id for good; to re-draft a rejected or
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
the ciphertext to KV; the desk auto-locks on `visibilitychange`. **A name and ID is committed
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
- **THE CUSTOMER'S LABEL IS A MARK, NOT A NAME** (v659, his instruction of 16 Sep 2026): a symbol and
  a colour for each level beside each product on their price list, and **the level is never named in
  the page**. They are greeted for the hour off their own device and told the month of their first
  priced order. **No name is used because none exists here** (rule 2); sealing one into a customer's
  own ciphertext is his decision, not a drift.
- **NO BRAND ON THE CUSTOMER'S PAGE** (his instruction, 10 Sep 2026). Nothing under `stmt/`
  names Salt Command: not the door, not an order line, not the push banner. The landing lead is
  two sentences and stays two. The statement DOCUMENTS keep it as a letterhead (`brand:` in
  `tools/make_statements.mjs`), deliberately: changing that rewrites every archive.
- **A BUCKET IS NOT ITS OWN PERSON** (his ruling of 13 Sep 2026). An associate's `<CODE>-R`
  account is theirs: their statement (live and issued), price list, printed board and the order
  card's usual rate read the code and the bucket together, bucket lines marked *for resale*,
  through `ownsCode` in `engine/position.mjs`. A bucket has no statement and no published
  username; its old `_users.json` line is kept but mapped to nothing.
- **`/all` IS THE OWNER'S LIST, behind Cloudflare Access, with two locks, neither trusted
  alone:** the Access application covers `/all` and everything under it, and `stmt/access.js`
  verifies the JWT again, RS256 against the team's keys with issuer, audience and expiry,
  because a header check passes a token signed by any key at all. With `ACCESS_TEAM` or
  `ACCESS_AUD` empty the route is 401, so deleting the application closes `/all` rather than
  opening it.
- **Guest links `/g/<id>`**: one board and nothing else, `script-src 'none'`. **The id
  IS the credential** (rejection sampling, never `byte % 30`) and the boards are NOT sealed,
  both deliberate. Unknown, malformed and withdrawn ids answer the same 404. **A row named
  "Tier 1" may carry no prices** (the engine gates it on bare `if(P.tier1)`), so take the first
  row with finite prices; oil is a genuine one-tier book and says so.
- **A LINK NAMES ITS INTRODUCER AND FOLLOWS THEM** (v658, his rule): minting takes a customer's
  username, and the guest is quoted **two levels above theirs where there is room, else one, capped
  at the last**, per product. The level is never stored on the link; every publish recomputes it and
  writes `gboard:<id>`, so moving a customer up moves every link they gave out. A link minted since
  the last publish falls back to `board:2`. Detail: `docs/STATEMENTS.md`.

## Files that carry a rule

| Path | Rule |
|---|---|
| `engine/qr.mjs` | The ONE QR encoder and the only place its facts are stated: byte mode, level M, versions 1 to 10; inlined into the master like the pricing engine; `tools/qr.mjs` re-exports it and never copies it; `qrRectSvg` draws RECTANGLES, a stroked symbol does not scan |
| `stmt/qr.js` | GENERATED from `engine/qr.mjs` by `tools/qrsync.mjs --sync`; gate and CI fail on drift. Never edit it; `stmt/` may import only a sibling |
| `tools/rid.mjs` | Stable `rid` per ledger row; `nextRid` is the one minting place |
| `tools/changelog.mjs` | Prepends `evolution[0]` to `master/changelog.json`; never rewrites |
| `test/verify.mjs` | ~2,130 assertions over 138 sections, no network or browser; add one per behavioural change, and **prove it red by mutation before trusting its green** |

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
