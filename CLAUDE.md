# Salt Command, on the phone

Root `CLAUDE.md` governs voice, verification and precedence. Mechanism: `docs/DESK.md`; statements
site `docs/STATEMENTS.md`; products `docs/PRODUCTS.md`; design `docs/DESIGN.md`; the fold
`docs/CLOUD_FOLD.md`; landing, the suite and instrument traps `docs/WORKING.md`; superseded
reasoning `docs/NOTES.md`. The dated record is `master/changelog.json`, never here. No flourish, and never the word the suite bans (write "costly" or the figure), in files,
code and copy.
**THE HARD RULE NUMBERS ARE LOAD BEARING.** Rules 1 to 8 are cited by number from code, the suite
and the `update-names-id` skill. Reorganise within a rule; grep `rule [0-9]` before touching the list.

The Salt Command desk as a cloud app: the ledger and the pricing engine on the go, a transaction
addable from the phone. **This repo holds the master**, deployed as a Cloudflare Worker (URL in
MEMORY.md); `/desk` is the one surface, and "the dashboard" means `/desk` at desktop width. Behind
a Cloudflare Access login, his decision of 05 Oct 2026, and the Worker's own check (below).

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
3. **Visibility follows the Actions minutes**: private while Pro's 3,000 a month last, public when they
   run out (his decision of 10 Oct 2026). It carries the real trading ledger; no real name, key or
   password is ever committed, in any form, hashed included.
4. **No third-party loads at runtime.** Inline CSS and JS, no CDN; the build fails on an external
   `src`, `url(` or `@import`. CSP is self-only, so Newsreader and Geist Mono are self-hosted
   files from `Code\salt-ds\fonts`, carried by each surface's own sync.
5. **Copy and price.** Detail in `docs/DESK.md`.
   - **RM and unit only.** The goods are **inventory** in copy; **Stock** is the rail's
     destination, `Stock cover` and the `Stock count:` line. New identifiers say `Units`, never
     kg. Copy is terse: noun-phrase headings, the number first. Dated records (the Journal,
     sealed issues) are never corrected in place.
   - **COGS is the latest purchase: its quote plus its trip freight, over its units** (the
     engine's `latestCogs`, `COST_RULE` kind `latestCogs` on every book, his rule of 05 Oct 2026).
     **The Floor is COGS times the size, the ORDER TOTAL rounded up to the next RM 5** (the engine's
     `floorTotal`, his decision of 18 Oct 2026), one per size and nothing else: no leak, no delivery, no
     time. `costTotal` is the exact cost, for the readers that measure cost and not price (the price
     band's segment floor, the floor-per-unit chart); COGS of goods sold, stock value, `afterLeak` and
     `refundOnOverpay` do not read the Floor. The leak is measured and printed beside the Floor as
     information only (`afterLeak`, on a book losing `RULES.leakInfoFrom` or more). **The Ceiling is 3
     times the Floor on every book** (`ceilingX`). A sale carries `delivery`, typed per
     row or offered from distance at `RULES.delivery`, his figure winning, and a lot `freight`,
     typed; `txGoods` strikes every rate on the goods. **What the customer owes is goods plus
     delivery, the engine's `txOwed`**; nothing reads the total less the cash. **Everything on an agreed order is
     amendable after Accept** (his decision of 06 Oct 2026): the units, the goods' price and the delivery charge,
     each a Correction for approval (`restateOrder`, stage `amend`, status `Amendment`) from Salt Admin and from
     the Desk; a completed order too, which opens again at Ready when the change leaves it owing (his answer of 17 Oct
     2026); the Floor holds, the board is never repriced, `rowRoom` and `payFault` apply, the site order and the
     ack digest follow the amended row, and a retry carries an immutable rid. **A trip of several
     books shares `trip` and its one delivery sits on ONE row** (`tripFault`; one tap approves the trip).
   - **SALT'S PRICE IS THE SET PRICE AND THEIR %** (his decisions of 05, 18 and 21 Oct 2026). **The Set Price is what a
     stranger is quoted**, and a customer pays less only on a negative % of his: per size the Floor times a
     multiple (2.5 at half a unit, 2 at 1, 1.67 at 6.25, 1.33 at 12.5, sliding in the log of size, flat
     above 12.5; `TIER_RULE.salt.points`). The grid runs half a unit to 25 in quarters and is walked smallest
     first (the engine's `driftWalk`, read through `driftAt`, `quoteAt` and `quoteGrid`): the rate is the
     lesser of the last and this size's multiple on the EXACT rate, never compounded, so the quoted rate may rise
     by under RM 5 a unit between quarters; the price goes down to RM 5; it is lifted so the ringgit margin over
     the Floor never falls below the largest margin of a smaller size; and it is held between the Floor and the
     Ceiling. **Row zero of `ladderRow` is the Set Price and is load bearing** (phone, mirror and suite read
     `[0]`; the code stays `T2`); choose a row by code, never by index. `PRICE_SET` is cleared and the drafter
     refuses a new one; the one figure he sets at Accept, on one order, is that row's total, which `PRICE_SET`
     never records.
   - **THEIR % is his and nothing else's, ON EVERY BOOK** (`TIER_OF[code][book]`, a number from -0.3 to +0.3, -30% to +30%,
     the engine's `LIFT_MIN` and `LIFT_MAX` read by `driftOk`, his decisions of 21 and 22 Oct 2026; 0 is the Set Price or
     the board). **It runs on his curve** (22 Oct 2026, the engine's `driftMultiple`): salt's `ends` are the Floor multiples
     at -30% (2.00 at 0.5 unit, 1.20 at 12.5) and +30% (3.00, 1.45), each end the Set Price's own shape, and a % is that
     share of the way from the Set Price, so every 5% step is equal at every size, inside the walk, held between the Floor
     and the Ceiling. **Everyone starts at 0%**. He types it on Salt Admin as a whole % in steps of 5, its prices shown
     live off the Desk before it goes to Approve (`makerDriftPreview`), or picks at Add ID
     from the presets -30%, -20%, -15%, -10%, -5%, Set Price, +5%, +10%, +15%, +20% and +30%; it is queued, folded as `tierset`, and a null clears it. **Nothing automatic prices**: the
     engine's `autoDrift` over `driftSignals` fills the card's good and bad only, and `suggestOf` (the engine's
     `suggestPct`) SUGGESTS a % he may take with Use the suggestion: what they paid over the Set Price on their
     last five salt sales plus a share for a write-off (30%), a long late or 14 days overdue (20%) or a late
     (10%), LESS a good record's discount (`suggest.good`, 30%, times `autoDrift`'s good score, only with nothing late,
     overdue or written off; his answer of 21 Oct 2026), to the nearest 5%, held -30% to +30%, and nought under
     `minSettled` settled rows. The fold refuses a `tierset` or Add ID
     figure stamped before `RULES.liftSince`, which was in the old drift unit.
   - **Oil, candy and rice are `fixed` boards**, his typed rungs held between the Floor and the Ceiling, the price for
     everybody at 0%; each carries `pct`, so it takes Their % (`pctBook`): `shares` are what -30% (80% of the board at
     the smallest rung, 90% at the largest) and +30% (120%, 109%) make of it, sliding in the log of size (the engine's
     `shareAt`, salt's proportions until he sets others). The suggestion, the reward and the loyalty unit stay salt's,
     and `tieredBooks` still names salt alone. **There are no price levels** (removed 18 Oct 2026): no `TIER_NAMES`,
     `levelAt` or proposal, and no standing guest link per level. `TIER_RULE`, `fiveTiers`, `TIER_OF`, the
     `tierset` collection and the `T2` row code stay as identifiers. **NRV on a book with a Set Price is the Set
     Price**, what a stranger is quoted, never the Ceiling nor a customer's discount. A cheap book put on a derived
     ladder inverts under the RM 5 rounding: check the rate law first.
   - **A customer's price is the Set Price moved by their %, or the price he sets on one order when he acknowledges
     it, never under the Floor; the board is never repriced by it** (`total` on the preview and Accept, the
     site keeping `asked`). What they paid before never lowers it (the cap retired on his decision of
     27 Sep 2026). **A product with neither a Set Price nor a board is not priced.** One rule, the engine's
     `cardPrice`: the desk's `cardQuote`, which every quote to a named customer reads, and the price list, which
     reads the snapshot's `cards`, and `lift` for a grid point off the board.
   - **A partner pays the Floor** (his decisions of 06 and 18 Oct 2026): a party in the book's `partners` is quoted the
     Floor itself, the RM 5 round-up included, at every size on every book, through the engine's `quoteAt` and
     `quoteGrid` with `d` of `'partner'`; the drafter's `floorFor(q).floor` and the snapshot's `floors[q]` are the same
     figure. A partner has no % to set: the Their % card names them and sets nothing, and a test that
     walks every customer leaves them out. A partner is an associate: set from the card's Make partner (a name-free `partner` entry, drafted as a `roster` row with `partner`, so no migration), which the fold files in `partners` and, if they are none yet, appoints on R2 with their -R account; `docs/DESK.md`.
   - **AN ASSOCIATE'S REWARD STEPS WITH LANDED COST** (his rules of 20 Oct 2026, salt only): one unit per `times` (10) units' COGS of
     margin on their own buying and resale, counted once an order is PAID IN FULL (the engine's `rewardWalk`), over the stated openings of the
     switch (`REWARD_OPEN` in the book, written once by `tools/reward-open.mjs`; `REWARD.stated.salt.associate.since`), so nothing they held moved;
     the step is the crossing day's, or the lesser promised at Accept (`rwdStep`). **The fold raises the unit** as its own row at that day's landed
     cost (goodwill and rebate, `rewardOf` the order that crossed, counted cancelled or not), handed over with that order or their next salt
     handover, its unit in the roll; a payment undone flags it STALE, never withdrawn. A customer reads one word on an order (`rwd`: "cross",
     "given"), never a figure; the ringgit, net of what he gave under their price (`listRM`, the drafter's stamp), is his alone on Salt Admin
     (`rewardReading`). **From the switch a customer redeems nothing** (`inputResource`, the one refusal) and what they hold stands; no basis is
     built (his answer to the loyalty plan's Ask 4, reversing Ask 7's basis). Nothing prices from any of it. Detail: `docs/DESK.md`.
   - **A CUSTOMER'S LOYALTY UNIT COUNTS UNITS AT THEIR PRICE** (his rule of 20 Oct 2026, salt only): one unit at cost per `every` (20) salt units
     bought at or above their own price (`listRM` over `listQty`), counted once PAID IN FULL, from `REWARD.stated.salt.loyal.since`, everyone at nought
     (the engine's `loyaltyWalk`). **A late payment pauses it** until three payments on time in a row, **a write-off for good** (dated by its own
     Correction), progress kept. The fold raises the unit as a GIFT row (`loyal`, goodwill, total 0, `rewardOf` the order that reached it) at that
     day's landed cost, handed over with that order or their next salt handover; Accept says `cross` and marks the row `rwdLoyal`. A customer sees
     the share of one alone (`card.products[].loyal.next`, `customerCard`); Salt Admin's This customer card pairs it with the suggested %, which
     stays his tap (Use it sends tier-set for Approve). An associate, a partner, a supplier and a bucket do not walk. Nothing prices from it.
6. **The look is the Salt design system applied as a layer.** **A design change he gives goes to `Code\salt-ds` first, then to the Desk, the
   Counter and QR Command in the same piece of work, unasked** (his word of 18 Oct 2026): salt-ds's
   `npm run propagate` and its `CLAUDE.md`; `node tools/designsync.mjs --drift` says whether `design/` is
   still the salt-ds checkout's. Material, type and colour are
   decided in `design/desk.css` over the vendored `design/salt-ds.css`: edit there, `--sync`,
   build, never a hex in the master's older layers. Chart series read the identity's hexes
   directly (`salt-ds/src/tokens.ts`), so a palette change is two places; product hues are
   `PRODUCTS.accent` in `ledger/book.json`. **THE RECIPES ARE USED, NOT RESTATED**: markup carries
   the system's class beside the desk's own, `design/desk.css` holds no rule for a migrated
   recipe, and a colour the layer needs is a token in `Code\salt-ds` first, pulled by
   `designsync --pull`. The remaining geometry (ghosts, fields, tables, tiers, product bands,
   actions) migrates in one version, one commit per group (his word of 09 Oct 2026). **Two themes,
   Night and Tide, chosen per device, and Tide until one is chosen** (his word of 11 Oct 2026): Night
   is the design system's `:root`, Tide its `:root[data-theme="tide"]`, set on `<html>` by a head
   script from localStorage `salt-look` before the first paint, with a choice sheet over a device's
   first open and a switch in the rail. **Tide is off for now** (his word of 19 Oct 2026): every
   surface opens Night whatever the device kept, the Tide button is greyed, no choice sheet opens,
   and the store and Tide's tokens are kept; the Tide checks are parked behind `TIDE_OFF` in
   `test/tide-off.mjs`, and turning it back is those guards and the lines marked 19 Oct 2026. The four times of day, `salt-time.js` and the clock's picker
   stay retired, and the suite fails if any returns. A colour in the desk's own CSS is a token, never
   a literal, with its Tide value in `design/desk.css`, and every text colour holds 4.5:1 on each
   theme's ground and slate, which the suite measures (`docs/DESIGN.md`). The Counter takes the tokens and five
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
   mirror, publishes the statements and deploys the Counter in job `chain`, which holds the lock;
   then job `suite` runs the suite on the sha chain proved, outside the lock, **unless CI already
   passed it on that tree**: a ci.yml run whose `verify` and three `tests` parts each passed, on a
   commit with that tree holding every parent of it (`tools/suite-proved.mjs`, chain's last step), so
   a merge level with master stands it down and a fold, a merge master moved under, or any doubt runs
   it; the run's summary names the CI run that proved it. **The statements
   publish runs on every run but the `probe_key` dispatch**: the rule names what is excluded,
   never a list of triggers. A run that did not deploy passes `--no-retire`. **A publish follows a
   change, not the clock** (his choice of 10 Oct 2026): a version moves `public/rev.json`, and that push
   publishes; a desk write outside git (`/expected`) marks KV `publish:wanted`, and the desk's minute
   cron sends one `stage_only` dispatch for it, five minutes apart at most, as it does once each Kuala
   Lumpur day between 00:05 and 03:00 MYT; GitHub's schedule, four a day, is the net. A dispatch names
   its `reason`, the run's name and nothing else. `tools/update.mjs` is the laptop
   half and publishes no statements. **Every desk deploy deploys the Counter.** **Cloudflare
   Workers Builds deploys the tip of master and stops**: it never folds, marks or writes D1 or KV,
   and its failure is SILENT. Its build command is `npm ci && node tools/gate.mjs`, then `npx
   wrangler deploy`. Actions runs only on a push touching `public/rev.json` or the statements
   paths. A `src/*.js` or master change moves `rev.json`'s id and the gate refuses it unbuilt, so it
   carries the rebuilt `public/` and runs Actions too; only a push touching neither (docs, tests,
   most tools, `public/_headers`, `wrangler.jsonc`) ships through Workers Builds alone. **Read
   its config back through the Cloudflare API**, never the dashboard or the MCP builds tool
   (`docs/DESK.md`). Never point anything on the laptop at `salt_sync.ps1`: a fourth deployer.

## The one surface

**Retired surfaces:** see MEMORY.md. The
built desk is six destinations (`VIEWS`), thirteen pages: Today (To do, with the Whiteboard folded under it as
Noticed), Money (Receivables, Financials), Stock (On hand, Next 30 days, Sourcing), Pricing (Pricing, Rules), Network
(Clients, Associates, Coverage) and Record (Ledger, Analysis). Approve, Site orders and Entries left on 18 Oct 2026 (his
word): Salt Admin decides them, and the desk still reads the orders and drafts for To do's Waiting on you row, the
waiting stamp (`ordTell`) and Spots to file on Coverage; this device's alerts sit in the rail beside the theme. Old
ids remain addresses through `VIEW_ALIAS` (`/desk#enter`, `#orders`, `#approve` land on Money, `#add` and
`#plans` on Today). **The rail is two levels at
most.** **One product in view for the whole desk**: `PROD`, set only through `setProdView`. A
feature folded out of sight reads to him as missing: name every part where the eye lands.
Everything the desk shows, cost and margin included, is served at the desk's URL, behind the Access login. **It installs as
Salt Desk** (the build's `apple-mobile-web-app-title`, the manifest's `name` and `short_name`); its
`<title>` stays Salt Command, the build's anchor.

**Notifications: one event, one surface** (his answers of 19 Oct 2026, `docs/plan-notifications.html`). Salt Admin
wakes him for what waits on his decision (a new order, a customer's line, a claim, a cancellation, their answer to an
offer, rows to approve), through its own worker `/all/sw.js` and `opush:` subscriptions on the Counter, rung by the
Desk's `wakeAdmin` over `/desk/owner-wake`. Salt Desk only informs (folded and live, a fold refused, the suite red,
a refund held, the morning digest); it rings an order banner itself only while no Salt Admin device answers
(KV `admin:on`). Salt Counter's customer wakes are unchanged. A new event goes to one of the three, never two.

**Add ID**, **Amend ID** and **Approve** are Salt Admin's; the Desk reads them. A code is derived from the
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
`paidOn` in `ledger/book.json`, `booksync --sync`, build. **A refund the book no longer owes is flagged, never withdrawn**
(the engine's `refundStale`, a fold move and a provenance note): he removes the row in `ledger/book.json`.

**A defaulted sale is written off**: `txAdvance` reads nothing owed on it and `txWrittenOff`
carries it to every reading of what was lost, so no price moves. A new reader of what is owed uses
`txAdvance`; a new reader of losses must add `txWrittenOff`. A party with a write-off is not
approached (`approachable`).

**An undo takes back the newest move on a sale and nothing older** (plan 4, his answers of 16 Oct 2026):
the engine's `undoOf`, read by Salt Admin's History, the drafter and the fold, from a payment or handover
(a Fulfilment) or a Correction's own `was`; nothing is undone while money is on its way or a move waits on
the row. The fold marks the step `undone` and the undo's own step `undoes` it: **a new reader of the trail
passes an `undone` step over**. A site order follows by the order book's undo fix and is told by a banner;
a change of its terms is undone through `restateOrder`. A refund it strands is said, never closed.

**THE REORDER POINT IS DERIVED, NEVER UNDER 4 DAYS OF COVER AND NEVER OVER 14**: the engine's
`restockPlan`, read through `restockFor(prod)` and `reorderFor`, from measured demand only;
`RULES.reorderUnits` is the fallback for a book with no demand. Never type a mark back in.

**Four books** (salt, oil, candy, rice; spare was retired on 15 Oct 2026). `node tools/product.mjs` is the one road that
opens, re-keys, retires or restores one; it refuses to retire a book with rows or to re-key salt,
a row naming no product being salt. What is keyed by product: `docs/PRODUCTS.md`.

## The chain: tap to deploy

| Step | Where | When |
|---|---|---|
| Queue an entry | KV `q:<deviceId>`, `POST /queue` | on tap; held offline, retried every ten seconds |
| Draft the row | Worker `src/drafter.js` | on arrival, plus the quarter-hour cron as the net |
| Approve or reject | D1 `draft`, `POST /drafts/<id>/approve`; Salt Admin's Confirm sends every card ticked in one `decide-many` (his word of 22 Oct 2026), refusals answered with a fix and one dispatch for the batch | on tap; a decided row returns 409 |
| Stage approved rows | Actions `cloud-commit.yml`, job `chain` | dispatched by every approval; again by the desk's minute cron 15, 30 and 60 minutes after the newest approval while one waits uncommitted (`redispatchStale`); at 00:23, 06:23, 12:23 and 18:23 MYT as the last net |
| **Fold, bump, build, push** | `tools/foldcall.mjs` (one Claude call for the notes) over `fold.mjs`, else `tools/foldnotes.mjs`; or any agent per `docs/CLOUD_FOLD.md` | same job; or on demand |
| Gate, deploy, prove, mark, re-seed D1, publish, Counter | same job | same job; or on push |
| Publish with nothing to fold | a `stage_only` run of the same job | the desk's minute cron, after a write outside git marks `publish:wanted` (`publishWanted`), and once each Kuala Lumpur day from 00:05 MYT |
| Suite, on the sha chain proved | job `suite`, outside the lock; a failure is red and written to the phone's refusals while the phone serves that build, never rolled back | once chain has deployed, unless a full green CI run already proved that tree (rule 8) |
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
  tapped before the first row lands is booked when it lands, and the answer says so. A claim against the account (S6) is
  drawn as the engine's `claimAlloc` (goods out oldest first, then the orders at Ready, each owing all that is left, V2), each row less the money already on its way to it, and its one Received approves exactly those rows. **A row paid past what it
  comes to is a refund the fold raises** (06 Oct 2026, the engine's `refundOnOverpay` beside `refundOnCancel`, read off the row as
  every sale amendment folds and on the desk's overlay): a close at what was handed over or an amendment under what they paid is
  one tap like any other, and the difference opens as a `customerRefunds` row, Now until `paidOn`.
- **Every tap that books money checks what its row can still take** (`rowRoom` in `src/orders.js`:
  the mirror's figure less every payment on its way to the row by any road), **and the fold's
  `payFault` is the last check**, refusing a payment measured before other money reached its row.
  A new road for money reads both. Detail: `docs/STATEMENTS.md`.
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
  staged. CI holds the API key and the Cloudflare token, nothing else. **A batch books in EVENT ORDER**
  (`applyInto` is `applyEntry` over the entries, his answers of 16 Oct 2026): a count stands and only the moves after it change
  it, a rename applies where it stands, an Add ID books before the trade naming it, a trip books whole or not at all, and the
  roll note is one a product for the batch.
- **A change to `cloud-commit.yml` never tests itself**: it is not on its own push paths. Dispatch
  a run by hand and read the step list, since a skipped step is green too. After any push read the
  run's annotation: a billing refusal looks like an ordinary red run.
- **No clock.** `Salt fold (manual backup)` is disabled (id in MEMORY.md): fire it
  by hand if the Fold step fails. The stage stands down while `master/_to_fold.json` is in HEAD,
  unless `fold.mjs --replays` says the batch is a replay.
- **The laptop's queue takes the same road**: `node tools/drafts.mjs --from-queue`. A decided
  draft keeps its id for good; re-drafting an entry he later calls real, and folding from the
  laptop (approve last), are in `docs/CLOUD_FOLD.md`. A ledger row edit queues as a Correction.
- Endpoints: see MEMORY.md. Nothing writes to `entry`. **The `draft` table's CHECK lists every
  collection by name**: a collection the drafter newly returns needs a migration rebuilding it,
  applied to the live D1 BEFORE the deploy and as that file alone (`wrangler d1 execute salt_ledger
  --remote --file=...`); re-running an older one drops rows, and a rebuild drops the newest
  migration's indexes, which must be created again (migrations to date: MEMORY.md). The drafter
  reads its queue's ids by primary key, never the whole table.

## Sync and proof

- The phone polls `/rev` every ten seconds against its baked `SALT_BUILD_ID`, every sixty while the Desk's live socket is up
  (the object `live` inside the Book class tells `rev`, `orders` and `drafts` as kinds only, owner only; `docs/DESK.md`); `/rev` is `no-store`
  and never cached by `sw.js`.
- **`public/rev.json` id** = sha256 over the patched master, `public/sw.js` and every `src/*.js`,
  NUL-joined; written by the build only. It omits `public/_headers`, `manifest.webmanifest`,
  `chart.umd.js` and both wrangler configs, so **deploy a `wrangler.jsonc` change by hand**. **`sw.js`
  serves the manifest and the icons cache first**: a change to either bumps its `CACHE` in the same
  version, or an installed desk never reads it.
- A deploy is decided by ids, never by hashing output (`deployVerdict`): none when live `/rev`
  serves `rev.json.id`, which is then written to `.deployed.json`, else `rev.json.id` against
  `.deployed.json.id`. The record is untracked, this checkout's own, and never written unseen.
- `ci.yml` on push: book in date order, master version in the changelog, tests pass unless
  cloud-commit tests the same push, `public/` matches the master. `ship-check.yml` daily: repo id
  against live `/rev`.
- **"Update" means `node tools/update.mjs`, the whole chain, with no step left for him**: drains (a
  pull only), reports both queues, mints any missing account, builds, tests, deploys on an id
  change, commits, pushes, then proves master, `rev.json`, live `/rev` and origin agree. An idle run
  (one id built and live, a stale record written down, the tree clean and level, nothing queued) prints nothing to ship
  and skips the suite, deploy and commit; `built` moves only with the id, so no stamp is left to commit. **A tree
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
`visibilitychange`. **The vault is three envelopes under one passphrase; an address or an exact point
lives only in the second**: names in KV `vault`, places in `vault-addr` (`{<code>: {addr, lat, lng,
src, at}, _base}`), filed at Add ID and Amend ID from a Maps or Waze link read on the device, while
`PLACED` keeps the locality to 0.01 degrees; and the slip key in `vault-key`, the private half of an
ECDH P-256 pair every slip is sealed to, its public half in the clear beside it and on the Counter's
KV `slipkey`. **One unlock opens all three**, the slip key imported non-extractable, and the
auto-lock clears all three. The laptop's copies are `10_Data\salt_addr.json`, through
`seed-vault.mjs --addr` and `pull-vault.mjs --addr`, and `10_Data\salt_slipkey.json` (ciphertext),
through `seed-vault.mjs --slip-key` and `pull-vault.mjs --slip-key`. **No route and no other tool
writes `vault-key`, and `--slip-key` never over a filed key unasked**: a new key loses every slip
sealed to the old; a lost one is put back by hand from the copy. **A name and ID is committed every time, like an approved row**: Add ID on the
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

## Access, two locks; the write gate

- **`REQUIRE_ACCESS` (current value in MEMORY.md).** One owner Access application gates the Desk's
  host and the Counter's `/all`, set outside the repo's config; the Worker's own JWT check is the
  second lock, its team and audience in `wrangler.jsonc`, a change deployed by hand. The Worker verifies the
  JWT signature, issuer, audience, expiry and exact email from the Access header or cookie; a header
  alone is not identity. The CI service token passes only `GET /rev`, `POST /push/send` and `POST /book/load` (S2a: the shadow Book's load, which also needs its own key `SALT_BOOK_KEY` or the write key, takes only the book, and answers counts and digests, never a row; S2b: its read-back, which `tools/book-load.mjs` compares with git, the step red on any difference and never blocking the fold), and S2c's `POST /book/pitr` and `GET /book/window` (the recovery test, `tools/book-pitr.mjs` by hand dispatch: the TEST object alone, never the live Book, and a read of the live Book's window; same key); the vault tools send his own token. The Counter's `/all` applies the same verified-email rule, while customer
  sign-in routes outside `/all` remain unchanged.
- **Writes need `X-Salt-Key` = `SALT_WRITE_KEY`, and so do the reads that carry cost or trade:
  `/queue`, `/ledger`, `/drafts`, `/orders`, `/stmt-users`, and the places' `/vault/addr` and
  `/geo/expand`.** This is the separate write key; when enabled, the Desk's Access gate also covers
  its assets, `/rev` and `/queue/ping`. The names vault's ciphertext stays encrypted. Rotate with
  `npx wrangler secret put SALT_WRITE_KEY` from the
  repo, then clear `saltWriteKey` from the phone's storage. `drain.mjs` and `seed-vault.mjs` go
  through wrangler, unaffected. **`wrangler dev` binds the LIVE KV.**
- Withdraw a queued entry: `node tools/drain.mjs --status`, then `--forget <at>`; a drafted one is rejected under Approve instead.

## Statements site

`stmt/worker.js` and `stmt/page.js`: a second Worker on its own cryptic address, KV store and order book,
config `wrangler.stmt.jsonc`, every command taking `-c`. Nothing under `stmt/` imports from `src/`,
`tools/` or a node builtin; the suite checks. `statements/_secrets.json` is laptop only and
gitignored; lose its key and every account is re-issued. `stmt/page.js` `CLIENT_JS`, `stmt/owner.js`
and the send sheet in `tools/stmt-send.mjs` ship inside template literals: no lone backslash, use
`[+]` and `[/]`, and no backtick, even in a comment. Mechanism for everything below: `docs/STATEMENTS.md`.

- **A change to the statements Worker covers Salt Counter and Salt Admin together** (his word of 20 Oct 2026): every
  batch maps each item onto `stmt/owner.js` too, its look and his side of the feature, or says why it has none.
- **From 1080px an open order on Salt Admin fills the page** (his answer of 20 Oct 2026, canvas V39), reversing his split of 11 Oct 2026 at that
  width: it takes the list's place and the rail's Orders closes it; two columns at 1180, three at 1440. From 860 to 1080px the list stands beside it.
- **Live sockets are a hint, never the record** (Speed Wave 2 L2, 21 Oct 2026): `/live` and `/all/live` upgrade to the order book's WebSocket, proof at the handshake (the subprotocol carries the session; the book is given the username and reads no KV), kinds and ids only (no figure, name or word), a socket message never moves the book, and the polls stay as the net at a minute. Log out, device sign out and Sign out everywhere close the account's sockets (`unlive`). Mechanism: `docs/STATEMENTS.md`.
- **On Salt Admin a book is its typed Product tag**, its name in its hue (his answer of 22 Oct 2026, reversing his word of 12 Oct for Salt Admin alone);
  the Counter keeps its marks and no product word. Needs you groups are **To do, Pending and FYI**, money first; a card is one shape with one pill, its
  why and second choice in the open card beside the list from 860px; **no text wraps on Salt Admin's Needs you** (an ellipsis at most).
- **The site address is never in the public desk.** No address, no QR drawn.
- **No brand on the customer's page, and no product word either.** Nothing under `stmt/` names
  Salt Command. A product is a mark (`PSYM`) carrying a letter of his (`PLET`) in every mark, 20 px and
  over; it names nothing. A control holding only a mark is named by its shape
  (`PSHAPE`), never its product. **The one name on the site is the app's, `Salt Counter`**, twelve
  characters, which is what iOS gives a home screen; the desk's name never appears. **A customer never
  sees a level**, named or marked (D11); no name is used because none exists there (rule 2).
- **AN ORDER REACHES THE BOOK IN STAGES.** The desk's every-minute
  `reconcileOrders` is the one road that queues what the site makes (Accept and Cash received queue
  their own): the acknowledgement a **Pending** row (delivery beside its total), each claim of theirs ("I have sent it",
  never paid until his Received, S6; one against the account, for desk rows, is its own record, never an order,
  `acl` in the book and `aclaim:` on KV) a **Fulfilment** that Approve cannot decide, a
  handover a **Correction** stating the running total (rolling the shelf by the difference), a close at
  what was handed over a **Correction** restating size and total, a withdrawal a **Cancellation** (theirs,
  nothing paid, while the pending row is unapproved: the row dropped instead; an approved row never). The
  row is named by `ledgerKey`, **the engine's `ovKey` to the character**, which a close moves (a rejected close gives it back); an amendment
  waits until `OPEN.byKey` carries that key. Each entry is stamped with its stage's own moment (`stageAt`). A move of his
  runs the reconcile at once; the return leg carries what he records on the desk back to the order
  and only ever raises. Cash on handover is withheld while that customer holds an unpaid advance, and on an
  order paid in advance (`prepay`: decided at Accept by the desk Worker, `advanceOf` in `src/orders.js`, when what the
  customer owes at once across every book with this order, the engine's `partyOwedRM` plus their agreed site orders not
  on the book, is over `RULES.creditCeilingRM` read from `TERMS`; the verdict rides on the entry and in the ack digest; V5b2c: a customer who ever paid late is in advance too, until three payments on time in a row;
  Place stamps nothing, V3's unit cap retired in V5b2b, and the page only forecasts it off the ceiling sealed with
  its list, outside the stamp). A
  delivery's location never reaches a ledger note. The customer reads a whitelisted view of an order,
  never `ledgerKey`, `queued` or `sync`. **Every move is an event in the site's one Durable Object**
  (`stmt/orderbook.js`) under a device-minted id, so a retry lands once and no writer erases another's;
  `ORDER_STORE` is the switch (`object+kv` the week of reading both, `kv` the way back, `object` after a
  clean week of KV `orderbook:check`). **Coming back from `kv`, raise `ORDER_MOVE_IN`**; forgotten, the `kv`
  road's mark (`orderbook:road`) moves the book in again on its first request. **After `tools/orders-kv.mjs --delete`
  the `kv` road is a way back only through `--restore <backup>`, and the restored KV is the store as it stood at the
  flip to `object`, so a return to `kv` loses the moves since. `ORDER_MOVE_IN` is raised on the return to `object`,
  not on the flip to `kv`.**
  Rejecting a draft a site order made is asked first and written onto that order, and its move is
  offered again under a fresh entry (the stage's own tap, or `/again`; `again` on `GET /orders`).
- **A customer writes on an order, and he answers**: one `msgs[]` thread per order, on any order at
  any stage; theirs capped, his uncapped. **It never rides into a ledger note.** His answer is
  checked by `siteWords` on the desk; every line is escaped on both surfaces. `siteWords` reads
  English off the lists in `src/orders.js`; the Desk sends no line and keeps no word check;
  the suite pins the lists to the book's names and drives every word through it:
  a new book goes on the lists, and `LEVEL_WORDS` stays as a guard against a level word ever reaching a customer. **Malay is removed everywhere** (his decision of 05 Oct 2026): no table, switch or
  Malay list; the suite asserts none returns.
- **And one thread an account** (Step 7, his Q5): Home's card and a row on Account open it in a Sheet; theirs 20 a
  Kuala Lumpur day, his uncapped, the last 200 kept. **In the order book only** (`thr`, oid `thread`, written behind to
  `thr:<username>`): the KV road refuses a line rather than keep a second copy. Read every 2 seconds only while open and
  showing; his line wakes them as `message`, a tap opening `#thread`. The same rules as an order's: never a ledger note,
  his words through `siteWords`, every line escaped; a test account's lives in its fixture. **His Chat** is Salt Admin's:
  a thread whose last line is theirs counts in the desk's Waiting on you row, read with the orders.
- **How was your order, asked once** (F10, his Q9b): at the first chase slot two days after the last handover of an
  order all handed over, and under two weeks after it, the ask written on the order first (`rateask`, one of the book's
  writes) so a tick firing twice asks once; one wake a customer a slot, and Home's card for a phone with no push. One
  rating an order, one to five stars, never changed; his nudge and his card read it. **It prices nothing**: no entry,
  row or note reads it.
- **A slip rides on a claim, sealed on their phone** (F13): Did you send offers Attach a slip once the Counter's KV
  `slipkey` holds his public half (`GET /slip/key`); the page draws the picture at 1,600 px JPEG and seals it to that key
  before it leaves, and the Worker files the ciphertext at `slip:<username>:<id>` for 30 days (`stmt/slip.js`, the id the
  first 16 bytes of its SHA-256), once the claim is recorded and names it, and any other `slip` refused. **Only the desk opens one**: View slip on
  the claim card, through the keyed `GET /slips/<username>/<id>` and the slip key the one unlock holds, drawn as a
  `blob:` URL and let go on the lock. Pictures only; their page says Slip sent and can never open it again.
- **With any amount past its term (`pay.overdue`, or a part late on the phone's own day; his D9, amended 28 Sep 2026),
  Home leads with the overdue amount and Orders is the payment page**: the page's gate, not the Worker's. It shows each part's due date, and a
  claim waiting on him reopens ordering, his acknowledgement still the check. **Then it closes in stages (V5, his answers of 29 Sep
  2026)**, from the handover of the oldest part overdue: prices hidden from `pay.hide` (`RULES.hideDays`, 3) and from `pay.lock`
  (`RULES.lockDays`, 4) only To pay now live, the rest of Home and Rewards seen but greyed out (`grey`), each said before it comes, the handover day 0; the same waiting claim lifts every stage; what he received since the statement was
  written comes off the overdue figure. Beside `owed` the live document seals `pay` (`payDue`): to pay now
  (`txAdvance`), overdue and coming up (`txPendRM`), each part overdue from the day its goods were collected or
  delivered (the engine's `txUnpaidSince`) and past its term `RULES.holdDays` (1) day later, read from the master;
  the pricing profile keeps `RULES.creditDays`. To pay now heads Home, with one filled
  Pay; every Pay opens one sheet (D8: no account chosen for them, the username the reference, QR
  Command through `payHref`, never named), and on return it asks once, Did you send it: a claim reads "sent, waiting for
  us to confirm" until his answer (D7). **The bulletin** is KV `bulletin`, set through the desk's keyed `/bulletin` and
  checked by `siteWords`: in Home's Today card, one line at a time, the next every six seconds with Pause, every line standing
  under reduced motion and never a live region (Counter Batch A, his decision of 18 Oct 2026, reversing D14's still card), and a
  Set asks before it wakes every phone.
- **An associate is asked who an order is for, first (Me / A friend)**: a friend's books to their `-R` bucket
  through the engine's `bookR2`, and the `orderKey` is built on the bucket. **A bucket is not its
  own person**: `ownsCode` reads the code and the bucket together; a bucket has no statement and no
  published username.
- **`/all` IS THE MASTER ACCOUNT, behind Access with two locks, neither trusted alone**: the Access
  application and `stmt/access.js` verifying the JWT (RS256, issuer, audience, expiry), followed by
  an exact `maakmal97@icloud.com` email check in the Worker. Empty `ACCESS_TEAM` or `ACCESS_AUD`,
  an invalid token or any other email closes `/all`. Customer sign-in routes outside `/all` are not
  Admin routes. **`stmt/owner.js` travels only there.**
- **An account's card on Salt Admin hands over the password from his phone** (`pwMaster` under `STMT_MASTER`, in
  `sheet` behind Access, decrypted to the clipboard). The plain password stays laptop-only in
  `_passwords.json`, and no message ever carries it.
- **A passkey opens the account** (Step 6, his decisions of 29 Sep 2026): saved on This device, any store; the Worker
  checks its signature and hands back only its share of the key (`stmt/passkey.js`), the other half the device's own bytes
  or the passkey's PRF secret, so the password is typed once on a new device and the Worker still opens nothing. A year
  from its last use; Log out keeps it; Remove, Sign out everywhere and his own Sign out end it. Detail: `docs/STATEMENTS.md`.
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
  manifest and icon served by the Worker, no brand; notifications are asked only from a tap. **The account works in a
  browser or the saved app**: installation is optional. A signed-in browser opens the account normally; Account > This
  device keeps the optional install steps and, on an iPhone, a hand-over code for a separately stored Home Screen app.
  The link and the door sign in on either. **A bell asks for notifications on every view of the saved app until they are on**, its call beside it; refused, its tap
  opens that phone's Settings steps. **The saved app starts at `/app`** (the manifest's `start_url`): with
  nothing remembered, an iPhone opens on One step to finish, the key by Paste or the eight symbols typed
  (`POST /handover/open`), and the app is remembered. A key in the address (`/app#<key>`) is spent by the saved app
  alone; a browser tab spends only Salt Admin's QR (`/app#qr.<key>`), as `{token, tab: true}`, which the Worker
  opens only for a key his `/all/handover` minted; an app's own browser spends nothing.
  Salt Admin links its own manifest with credentials, is titled Salt Admin (ten characters, within the twelve iOS shows;
  his word of 19 Oct 2026, one name for the owner's app everywhere; it was Salt Account from 28 Sep 2026), has its own icon
  (the ring with a keyhole, `/icon-key.png`) and turns into Sign in again when Access lapses.
- **A customer's banner is a plain sentence of its kind, in his words** (Step 1b, `news.*` in `stmt/words.js`), never an
  amount, a product or a name: `{k, o}` sealed for the one phone (`sealFor`, RFC 8291) under the keys its subscription
  filed, with the case its body is chosen by (`v`, `payCase` in `stmt/orders.js`: owed, waiting on his Received, or paid) and, where the kind carries it, his own text
  (`t`): his line on an order in quotation marks, under a tag and push `Topic` of its own so none is replaced unseen, and his
  reason at Decline or Cancel as the body, both checked by `siteWords` before they leave the desk. The acknowledgement is
  pay-now on an order paid in advance (`prepay`), else on credit. A record with no keys gets the payload-free wake
  and the fixed words. A tap opens that order (`#o=<id>`), and a page already open re-reads first.
- **A delivery's window and exact spot** (his decisions of 10 Oct 2026): ASAP (his word of 20 Oct 2026) or one of six four-hour windows,
  one rule on page and Worker (`stmt/window.js`) over Salt Admin's weekly Hours (a close earlier than the open is the next day's, up to six spans a day, 00:00 to 24:00 all day, overlaps merged and dated days standing in for their weekday, one rule wherever the hours are read, `stmt/hours.js` `openParts`; his word and answers of 20 Oct 2026), its span the part inside; his Accept may
  answer an as-soon-as delivery with a window, and reminds them to pay now in words only. **A raise or another window than
  theirs is never his Accept's alone** (`needsYes`): it goes to them as an offer of the whole order, their Yes the take, their
  No thanks a cancellation, a lapse or his Withdraw leaving it placed; never on a sheet (`docs/STATEMENTS.md`). The spot is
  sealed on their phone to the slip key under `salt-pin v1` (`stmt/pin.js`), ciphertext alone on the Counter for 30 days,
  opened on the Desk with the one unlock, the fee's point ahead of `vault-addr`, **and on Salt Admin too** (his answer of 20 Oct 2026,
  reversing the Desk's alone of 10 Oct): `GET /all/maker/pins/<u>/<id>` off the Counter's store, read with `keep` false so looking never
  keeps it past its 30 days, opened in his browser behind the one unlock, nothing stored; filing it as their place stays on the Desk. **Saved spots stay on the phone** (Counter Batch C, his
  answers of 20 Oct 2026): three an account in localStorage, none picked when the sheet opens, kept through Log out; the seal carries the spot's
  name and floor or unit beside the point, or a unit alone (`src: 'unit'`), which the Desk shows and never files or measures. The point is filed as their place only on his tap: the card's, or File all for every customer with no point (his choice of 13 Oct 2026),
  one passphrase for the batch; never filed without one.
- **The confirm time is measured, never promised** (Counter Batch C, his answer of 20 Oct 2026): the median of his last 30 Accepts made in
  Counter hours, the time counted in open minutes only (his answer of 20 Oct 2026, `openMinutes`), up to the quarter hour (`stmt/confirm.js`, KV `confirm:within` filed hourly), said on a placed order only while open and
  with 10 or more measured; closed, when it opens.
- **A collection point** (Counter Batch A, his decisions of 18 Oct 2026): his points are Counter KV `maker:points`
  (`{v:1, list:[{code, lat, lng}]}`, a code one capital and one or two digits, so never a roster code's shape), kept on Salt
  Account under Shop > Hours. **A collect Ready names one and is refused without**; the order keeps the point as a snapshot
  (`pointAt`), so editing the list moves no order, and Change point moves one on purpose (a `point` event, its wake
  `point-moved`). The customer reads `pointAt` only while the order waits ready to collect with goods still owed
  (`customerView`); `deskOrderView` strips it on every Desk road. Their pin opens Apple Maps, the phone's `geo:` or Google Maps.
- **The basket is page memory and one sheet** (Counter Batch B, his answers of 18 Oct 2026): taps on one mark SUM into one line at the
  summed amount's own list figure (`priceAt`), the bar adds list figures for the goods alone, and Review places through the existing sheet,
  one order a line under one sheet id, counted once against the five; at five open every + greys and nothing is refused at Place. Nothing is
  kept on the device. **Order again** stands only on an order handed over in full whose size is still listed (`oAgainOk`), never a
  withdrawn, declined or group order. **Sent forgets every size placed** on every road, reversing V4b's keep.
- **The restock light** (F4, his decision of 05 Oct 2026): per book, the engine's `restockLight` over the shelf and `commitments().commitUnits`: green while free stock covers what is agreed, yellow the moment the commitments exceed the shelf (free stock below what is agreed, the engine's `coverable` false), red when the shelf is out. Sealed in each customer's price list (`supply`, outside the stamp) at publish and drawn as a coloured border on the mark with its words, Available, Limited or Out of stock, and on Home as Availability, a row a book, never a figure (the word stock allowed, his word of 22 Oct 2026); Salt Admin's Stock by book on Needs you carries the same light from `STOCK` with the units (`docs/DESK.md`); yellow or red carry "More by DD Mon" from the desk's `expected` date (KV `expected`, set on Stock through `/expected`, never named restock). Ordering is never refused.
- **The chase, tapered** (his decision D5, hours amended by V5 on 29 Sep 2026): the site's hourly cron (`wrangler.stmt.jsonc`) wakes a
  customer holding goods unpaid (`isAdvance`) every hour from 08:00 to 22:00 Kuala Lumpur (`chaseSlot`) for three days from
  their oldest unpaid handover, then at 10:00, 14:00 and 18:00 (`chaseDue`), from
  the day after the handover (`graceOver`), paused while a claim of theirs waits (`claimWaits`), in its own words (`due`); one wake a slot per customer, capped by the chase
  mark (`markChased`: in the order book, `chased:<username>` on the `kv` road); the test accounts are
  skipped. The config ships with the job's push paths; an unpushed laptop change needs `npx wrangler
  deploy -c wrangler.stmt.jsonc`.
- **A group order (the pool) is collect only and the Maker's tap closes it**: one product and size, a target in units,
  in the order book only (the KV road refuses it). A join is one atomic step, an ordinary placement at the customer's own
  sealed price plus the join (`pjoin`); the units in are read live off the joined orders, never stored. Opening wakes no
  phone, a card on Home only; reaching the target closes nothing. Close (`/all/maker/pools/<id>/close`) wakes each joiner
  once (`pool-closed`) and runs the Desk's own preview and accept on each order, a failure kept as `closeLeft`. The page
  says "group order", never a level. Detail: `docs/STATEMENTS.md`.
- **An associate's own card** (`rec.card`), every book's sales progress; the reward on the tiered books
  only: `share`, `stars` and `rank` never travel, and every figure adds up to the list under it. **The
  associates report card** (`/all/assoc`, whitelist `ASSOC_FIELDS`), every book's sales progress; the
  reward on the tiered books only: no margin crosses.
- **One live document, no monthly statement**: every order from the start, the page filtering by
  month and opening on the whole account. The publish stamps the encrypted document with the Desk
  build id, and the Counter serves it only after its authenticated Desk revision read matches;
  stale or unverifiable statements are withheld with an explicit state. The publisher reads every
  intended real account record back after its bulk write. `make_statements` refuses to seal a new issue without
  `--new-issue`; sealed issues are untouched. A question goes on an order, or on the account's thread. The account line shows
  the customer's username, never the roster code.
- **The test accounts** `0000-0000` (open), `0000-0001` (locked) and `0000-0002` (fresh, room to order),
  password `0000-0000-0000-0000` for all, count nowhere, and are made and unmade together. **Every
  move of theirs, a Place included, lands in their fixture alone** (`fixture_account`), never the
  order book, `order:`, `aclaim:` or `g:`; one list, `stmt/testusers.js`. **Between them they show every
  feature a customer sees**: the publish seals an invented account for each (`tools/testfix.mjs`, a case of each) at
  KV `testfix:<username>`, and the Worker lays it over that account alone (`stmt/testfix.js` `accountRecord`, the one
  read of a `u:` record on a customer road), never under `order:`, `aclaim:` or `g:`, so no count reads it. **They are
  for his acceptance tests, so every tap answers as it would a customer's**: a move on an example order, a claim, a
  link made or withdrawn, each by the order book's own rules, a retry once, written into the fixture alone; with no
  fixture yet nothing real is made. Held and prices hidden are the suite's alone. **A feature a customer sees lands with
  its case**: a line in `FEATURES` and the case in `build()`, or the suite is red; states, ways, rails and claim answers
  are asked for off the code itself.
- **`/all/test` is his test surface**: inside `/all`'s gate, so both locks hold it. It shows one
  `landingPage` as both views under a base (`__BASE__`, `__TEST__`), and Salt Admin moves example
  orders by composing the Desk's bodies into `decideDesk` with no Desk state. One stateless read,
  `fixture-check` (words, `needsYes`, `closeGoods`), and the claim preview stay on the Desk, and
  nothing is copied out of it. Reset deletes the account's fixture rows, and the next read reseeds
  them from the publication.
- **Guest links `/g/<id>`**: one board, `script-src 'none'`. **The id IS the credential**
  (rejection sampling, never `byte % 30`) and boards are NOT sealed. Every shut id (unknown,
  malformed, withdrawn, declined, waiting), and any longer path under `/g/`, answers ONE styled 404
  page, `shutPage`, the same words for all; a board ends with how to order. **Every link reads the one `guestboard`, the Set Price**
  (the levels are gone, 18 Oct 2026); an old record's `tier` or `level` is ignored. **One standing link, for strangers**, ensured on Salt Admin's first
  read of its links and kept for good. **Between a deploy and the next publish `guestboard` can be missing, and the page then says "Prices are being updated" and draws no list.** **An associate may mint
  their own, shut until he approves: the test is `approved === false`, NEVER `!approved`.** Decline
  is its own state, `declined`: shut like a withdrawn link, and Not approved to the associate. A link
  may name its introducer, as his note only.
- **What a customer sees is as fresh as the last publish**: price lists are sealed at publish time. A new input
  to a sealed document that lives outside git calls `wantPublish` at its write road, or the lists go stale.

## Files that carry a rule

| Path | Rule |
|---|---|
| `engine/qr.mjs` | The ONE QR encoder (byte mode, level M, versions 1 to 10), inlined into the master; `tools/qr.mjs` re-exports it; `qrRectSvg` draws RECTANGLES, a stroked symbol does not scan |
| `stmt/qr.js` | GENERATED from `engine/qr.mjs` by `tools/qrsync.mjs --sync`; never edit it |
| `stmt/send.js` | The one copy of the words a customer is sent; the sign-in message is English only |
| `stmt/testsurface.js` | The shell; the views are `landingPage`, never a copy |
| `stmt/words.js` | Every word the Counter shows, by key; a customer's refusal is `e.<code>` there, answered `{error, code}` by `refusal()`. English is the only table (`WORDS = { en: EN }`); no language switch, no `LIVE`, no `salt-lang`, no `/lang` Cache entry |
| `stmt/signin.js` | The one-time link; the two limits it cannot promise away are in its header |
| `tools/stmt-seal.mjs` | Laptop only: seals an issue's passwords under the master, proving each; pairs a re-keyed code by proof |
| `tools/stmt-account.mjs` | Laptop only: mints the account for a roster code with a username and no record, never touching an existing one; `--pool` tops up the spare accounts (`tools/stmt-pool.mjs`) |
| `tools/foldnotes.mjs` | The fold's prose with no model: same notes object, same `checkNotes`, no judgement; `scrub` makes the API error safe |
| `tools/preflight.mjs` | `aheadVerdict`: level, warn or STOP; `idleVerdict`: nothing to ship; outside `update.mjs` so the suite can drive it |
| `tools/d1json.mjs` | The one reader of `wrangler d1 execute --json`, failing closed: a refusal, a non-zero exit or a statement with no `results` is an error, never an empty list |
| `tools/rid.mjs` | Stable `rid` per ledger row; `nextRid` is the one minting place |
| `tools/changelog.mjs` | Prepends `evolution[0]` to `master/changelog.json`; never rewrites |
| `test/verify.mjs` | No network or browser; one assertion per behavioural change, **proved red by mutation before its green is trusted**, each on its own |

The rest: `docs/DESK.md`.

## Working on it

```
npm install        # once
npm run build      # master -> public/desk.html, after any master edit
npm run dev        # build, then wrangler dev (live KV)
npm test           # the suite split across processes (tools/suite-split.mjs), 5 to 12 minutes here; CI runs it too
npm run test:serial  # the same suite in one process, 3 to 7 minutes; 4 GB heap
npm run deploy     # build, then wrangler deploy
node tools/update.mjs
node tools/standing.mjs   # the standing-state table a task closes with, about a minute
```

Each build patch is anchored on one unique line; a moved anchor aborts. First-time Cloudflare and
local tools: `docs/DESK.md`. Close every task with the seven-line standing-state table (shelf, live
credit, written off, pending orders, undated rows, queue and drafts and staged, tree), printed by
`node tools/standing.mjs` from the engine in an `openMaster` window, never by hand (`--offline`
skips Cloudflare and the fetch).

## How a fold is sized

- **One version, many commits** (his word of 09 Oct 2026). A piece of work ships as one version, one
  commit per part; a commit that cannot be described in one sentence is two.
- **Sweep the class before shipping a fix.** Grep the pattern across the whole file first.
- **A round points at the newest code.** Attack the fix; older code is regression only.
- **An instrument is proved red before its green is trusted**, each mutation on its own. Reading
  source text, or checking inputs computed by the code under test, does not count; a vacuous check
  and a true one are identical in a green run. Before writing an assertion or measuring the desk,
  read `docs/WORKING.md`.
- **Run independent steps in parallel**: the suite in the background; master mutations at once on
  `SALT_MASTER` copies; tool-file mutations one at a time.
- **A display-only change pushes on its touched sections plus the gate** (his yes of 18 Oct 2026): markup and CSS of
  what the desk or the Counter shows, touching nothing that prices, books, folds, routes or holds money. Each new
  check is proved red (`tools/section.mjs --mutations`), the sections it touches pass, the gate is OK, and CI's suite
  on that push is the full check, read after. Anything else runs the full suite before it pushes.

Read @MEMORY.md beside this file (current facts) before the first action; correct it in place.
History: git log; master/changelog.json is written only by tools/changelog.mjs on a bump.
