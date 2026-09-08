# Salt Command, on the phone

Standing facts only. Root `CLAUDE.md` governs voice, structure, verification and
precedence; this file adds what a session here would otherwise rediscover, and
never repeats a root rule. British English, no em-dashes, in files, code and copy.
Correct stale facts in place; the dated record is the project changelog / journal.
Set 6 Sep 2026. Ceiling 15 KB.

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
   `engine/pricing.mjs` and `engine/position.mjs` (`node tools/engine.mjs --sync`),
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
5. **RM and unit only**; the mass symbol was retired at v161. **Inventory, never shelf or
   stock, in copy (v504).** One floor per size, the goods after the leak; no delivery, no
   time in it (v502). A sale carries `delivery` (inside its total) and a lot `freight`
   (beside it), typed per row (v503); `txGoods` strikes every rate on the goods. **The window
   is the last three lots** (rate and freight); **the leak is the drift of the last three
   counts** (`COUNTS` on the book, appended by every fold) over the units sold in those
   cycles, at landed; **the ask is a margin on the floor** (`ladderMargin`, `anchorG` per
   book), all v504.
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

## The one surface

**Retired at v387:** the phone app `public/index.html`, `public/data.json` and the
claude.ai mirror. The built desk is seven views over sixteen tabs
(`VIEWS` in the master): Today, Orders and money, Inventory, Price, Customers, The book,
Enter. Old tab ids remain addresses (`/desk#network`). In cloud mode the Enter view carries
**Add ID** (a code queued as `addid`, drafted into the roster, approved, folded) and
**Approve**; the laptop desk keeps Names & IDs and has no drafts table. Everything the
desk shows, cost and margin included, is served at the public URL.

## The chain: tap to deploy

| Step | Where | When |
|---|---|---|
| Queue an entry | KV `q:<deviceId>`, `POST /queue` from the phone | on tap; held offline, retried every ten seconds |
| Draft the row | Worker `src/drafter.js` | on arrival via `waitUntil`, plus a `*/15` cron as the net |
| Approve or reject | D1 `draft`, `POST /drafts/<id>/approve` | on tap; a decided row returns 409 |
| Stage approved rows | Actions `cloud-commit.yml`, one job `chain` since v520 | dispatched by every approval (Worker holds `SALT_GITHUB_TOKEN`), hourly as the net |
| **Fold, bump, build, test, push** | the `Fold` step: `tools/foldcall.mjs`, one Claude call for the notes (`ANTHROPIC_API_KEY`) over `fold.mjs`, since v521; or any agent asked, per `docs/CLOUD_FOLD.md` | same job when rows were staged; or on demand |
| Gate (`tools/gate.mjs`, CI's mechanical checks in about ten seconds, v522), deploy, prove, mark committed (with the clock, v519), re-seed the D1 mirror, publish statements, then the full suite | the steps that follow in the same job; a push runs them alone, and skips the deploy when the phone already has the build; a suite failure after the phone is live turns the run red and is written where the phone shows refusals, never rolled back | same job; or on push |
| Prove repo and live agree | `ship-check.yml` | 11:00 MYT |
| Monthly statements | `docs/STATEMENTS.md` routine | the 1st, gated in Kuala Lumpur time |

- **The fold is a judgement and stays with a model**: the row NOTE, the `evolution` entry
  and the sentence on the roll come from one Claude call over a dossier the tools compute
  (`tools/foldcall.mjs`, v521); what a row DOES, what is refused and what the inventory rolls
  are `fold.mjs`, never the model. CI holds the API key and the Cloudflare token, nothing else.
- **No clock** since 24 Aug 2026. `Salt fold (manual backup)` (trig_01UrnjQMWA3f6GXN5R6Dzi4S)
  is disabled, no cron: fire it by hand if the Fold step fails. The stage stands down while
  `master/_to_fold.json` is in HEAD, unless `fold.mjs --replays` says the batch is a replay (v512).
- **A version asks about the queue first (02 Sep 2026).** Before any bump: `node
  tools/drain.mjs --status`, `node tools/drafts.mjs --list` and `--approved`, `git fetch`
  for a staged `_to_fold.json`. Ask him one line per pending item; never approve for him;
  fold anything approved into that version.
- **What is approved is the ROW, not the entry.** The phone leads with cost and margin
  read from the draft and computes nothing; the drafter's flags do the measuring, and a
  purchase is never measured with a seller's ruler.
- **What the drafter refuses, the phone does not let you type (v524):** `entryFault` in the
  master answers both entry forms: roster codes only, an R2 row books to its associate, no sale
  of a product with no lot, a date when something moved. The unknown R2 buyer is the reseller's
  `-R` account, never an invented code.
- **The drafter is arithmetic, never a model**, and never prices: it reads the `PRICING`
  state key `tools/book.mjs pricingSnapshot()` derives from the engine. It refuses and
  records in `refused` (on the phone, self-cleaning): Linked and Rewarded amendments,
  `linkTo` or `orderCode`, a movement with no date, a product with no cost. Fulfilment,
  Cancellation, Modification and Correction go through the gate.
- **The laptop's own queue takes the same road:** `node tools/drafts.mjs --from-queue` (broken
  since the reads were gated). A decided draft keeps its id for good; to re-draft a rejected or
  refused entry he later calls real, mint a new `at`, run `draftRow` against `readBook()`, then
  `drafts.mjs --draft`, `--approve --by`, `--approved > master/_to_fold.json` (08 Sep 2026).
  A ledger row edit (right-click on `/desk`, tap on the phone) queues as a Correction.
- Endpoints: `GET /drafts?status=…`, `POST /drafts/<id>/approve|reject|committed`,
  `POST /draft-now?dry=1`, all keyed. Schema `migrations/0002`, `0003`. Nothing writes
  to `entry`.
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
- **`node tools/update.mjs`** drains, reports both queues, builds, tests, deploys only on
  an id change, commits, pushes, then proves master, `rev.json`, live `/rev` and origin
  agree; non-zero on any failure. `--dry`, `--no-push`, `--no-deploy`, `--no-drain`,
  `-m`. It never folds. The replay check refuses to ship while an entry above
  `QUEUE_COMMITTED` matches a ledger row by date and total; `--force-ship` after reading
  the rows.

## Names

Codes by default; names only after a password. `tools/seed-vault.mjs` encrypts
`salt_bio.json` with `$env:SALT_VAULT_PASS` (never a file) into the envelope
`vaultDecrypt` expects and pushes the ciphertext to KV; the desk auto-locks on
`visibilitychange`. **A name and ID is committed every time, like an approved row (05 Sep
2026):** when a new code appears through Add ID or a fold finds a roster code the
directory lacks, ask him for the name and the location before the ID commits, then write
both to `10_Data\salt_bio.json`, seed the vault, and commit the statement username in
`statements/_users.json` (minted once, kept for life; an address, not a secret). The three
`-R` reseller sub-accounts are the one exception. His own route is the `update-names-id`
skill in `.claude/skills`, laptop only.

## Access and the write gate

- **`REQUIRE_ACCESS` is `"0"` on his instruction of 11 Aug 2026 and the Access
  application was removed.** Setting it to `"1"` without recreating the application
  locks him out. To restore: first the Access application (Self-hosted, Workers,
  `salt-command`, policy Allow for his two addresses), then the var, then deploy by hand.
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
statement code, plain node) and `tools/qr.mjs` (byte mode, level M, versions 1 to 10) feed it.

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

## Files

| Path | What it is |
|---|---|
| `src/worker.js` | `/queue`, `/vault`, `/bio` dropped, `/drafts`, `/orders` (relay), `/rev`, static assets; dispatches the stage on approval |
| `src/drafter.js` | Queue plus D1 mirror to a proposed row in `draft`; never writes `entry` |
| `tools/fold.mjs` | `--plan` reads `master/_to_fold.json`, refuses what it must, writes the notes skeleton; `--apply` folds all or nothing, syncs, bumps, rolls the shelf, moves the watermark |
| `tools/rid.mjs` | Stable `rid` per ledger row; `nextRid` is the one minting place (`ovKey` collided on two SA5-BTR lots) |
| `tools/drafts.mjs` | `--schema`, `--list`, `--draft <file>`, `--approved`, `--committed <id>`, `--from-queue`; via wrangler, no key |
| `tools/drain.mjs` | KV to `06_Data\salt_queue_cloud.json`; `--committed <ISO>`, `--status`, `--forget` |
| `tools/sort-ledger.mjs` | Date order, undated pending last; asserts a permutation |
| `tools/changelog.mjs` | Prepends `evolution[0]` to `master/changelog.json`; never rewrites |
| `tools/renderdiff.mjs` | `--shoot <label>` every part at 1280 and 375, `--compare <a> <b>`; Playwright from `Code\salt-ds\.ds-sync`; by hand |
| `tools/send-sheet.cmd` | Opens the newest `_send_*.html`; the Desktop shortcut `Send Statement` points here |
| `geo/*.json`, `tools/geofetch.mjs` | Basemap (geoBoundaries, ODbL) and gazetteer; `geofetch` alone touches the network, by hand; feature names never rendered |
| `public/sw.js`, `public/_headers`, `manifest.webmanifest`, `icon-*.png` | Shell network-first, `/queue` never cached; CSP; icons from `Code\salt-ds` |
| `.deployed.json` | `{id,v,at}` of the last successful deploy |
| `test/verify.mjs` | About 250 assertions, no network or browser; add one per behavioural change to the Worker, build patches or drain |

## Working on it

```
npm install        # once
npm run build      # master -> public/desk.html, after any master edit
npm run dev        # build, then wrangler dev
npm test           # ~2 s
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
