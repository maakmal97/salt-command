> # RETIRED, 12 SEP 2026. DO NOT FOLLOW THIS.
>
> This is the laptop-era Cowork prompt, kept verbatim below for its context and for
> nothing else. **Every path in it is wrong**: the master moved into this repo on
> 20 Aug 2026 and `30_Published`, `deskctl.py`, both servers, the PriceCards folder
> and the artifact mirror are all gone. The desk it describes had fifteen tabs; the
> desk has seven views over sixteen tabs.
>
> The live procedure is `docs/CLOUD_FOLD.md`, and the chain that runs it is
> `.github/workflows/cloud-commit.yml` with `node tools/update.mjs` for the laptop half.
>
> Salt left Cowork on 20 Aug 2026. If a `salt-daily-price-brief` task is still in the
> Cowork registry it fires this text, and **editing this file does not change what
> fires** - the stored prompt has to be deleted from Cowork. The Cowork manifest,
> `Scheduled\README.md`, still lists it.

---
name: salt-daily-price-brief
description: Daily salt-trading run on the fifteen-tab Salt Command desk in 30_Published, inside the server window salt_daily.ps1 opens at 10:00: check the gate, drain phone entries, commit all queued transactions, date deliveries then refresh cost and margin, verify under every product, stamp and deploy to the phone, prune the cloud queue, post a brief and close the gate. Rewritten at v293: the watermark rule now clears cloud entries too (the v287 fault), tools/update.mjs is the cloud leg, both books carry a count since v290, and the Artifacts mirror was retired on 12 Aug 2026 so there is no publish step.
---

---
name: salt-daily-price-brief
description: Daily salt-trading run on the fifteen-tab Salt Command desk in 30_Published, inside the server window salt_daily.ps1 opens at 10:00: check the gate, drain phone entries, commit all queued transactions, date deliveries then refresh cost and margin, verify under every product, stamp and deploy to the phone, prune the cloud queue, post a brief and close the gate. Rewritten at v293: the watermark rule now clears cloud entries too (the v287 fault), tools/update.mjs is the cloud leg, both books carry a count since v290, and the Artifacts mirror was retired on 12 Aug 2026 so there is no publish step.
---

Daily salt-trading run for the "Per-Crm01_Salt Business" project. Concise; British English; no em-dash; RM and **unit** only (the mass symbol was retired at v161: quantities read "98.6 unit", rates read "RM47.47/unit", and the words kilo and kilogram are not used anywhere on screen or in the brief); anonymise every client and supplier using their desk codes (never write real names in the output).

## THE FOLDER IS FILED BY FUNCTION (reorganised 30 Jul 2026)

    30_Published   the desk, deskctl, both servers, the launcher, assets/
    20_Runs     finished reports, audits and hand-off notes
    30_Published/PriceCards  generated price card images
    00_Config        README, instruction notes, and changelog.json
    00_Config/Pricing     price card and ladder generators, and leak_test.js
    10_Data        everything the servers write: salt_queue.json,
                   salt_queue_cloud.json (written by tools/drain.mjs, not by a server),
                   salt_bio.json (the plaintext party directory), salt_vault.json,
                   menu_prices.json, menu_secret.txt, daily_gate.json
    20_Runs/Statements  monthly statements of account, by year-month

Code and generated state are deliberately apart. `serve_desk.py` and `serve_menu.py` both resolve writes through a single `DATA` constant pointing at `10_Data`, so never assume the queue or the directory sits beside the desk.

## ONE MASTER, AND A COMMAND THAT PROVES IT

    MASTER  C:\Users\maakm\Claude\Projects\Personal\Commerce\Per-Crm01_Salt Business\30_Published\salt_command.html

The master is the **only** place the desk is edited, and since 12 Aug 2026 the only copy tracked. Do not look for a working copy in any outputs, uploads, download or sandbox path; copies found there are stale staging and are ignored.

**THE MIRROR WAS RETIRED ON 12 AUG 2026.** `Artifacts\salt-command\` was a published artifact and a third copy of the desk, twelve versions behind and depended on by nothing, since the phone is served by the Cloudflare Worker that `tools/build.mjs` builds from the master direct. **There is no publish step and no `update_artifact` call in this run.** If an Artifacts copy is still on disk, it is dead: never read it, never publish to it, never treat it as a base.

**FIRST ACTION, EVERY RUN, NO EXCEPTIONS:**

    cd "C:\Users\maakm\Claude\Projects\Personal\Commerce\Per-Crm01_Salt Business\30_Published"
    python deskctl.py status

It prints the master's version and hash, a queue line, and exits non-zero when anything is out of step. `DESK.json` states `paths.master` and `paths.queue` explicitly, so no surface has to guess. Read what it says and act on it before touching anything:

- **master changed since stamped** - a session edited without stamping. Establish WHAT changed before adopting it: `DESK.json` holds the last stamped version, hash and byte count, and `30_Published` keeps dated `.bak-` copies to diff against. Run `python deskctl.py stamp` once you have confirmed the content is right.
- **queue: n uncommitted** - entries sit above the watermark and the desk will replay them. Fold them in before any bump.

**RE-READ THE VERSION BEFORE YOU STAMP, NOT ONCE AT THE START.** Another session can move the master while this run is thinking, and a long run makes that likely rather than possible. On 12 Aug a run committed v286 and, by the time it came to stamp, the master was at v293 through seven later versions. Stamping the earlier number would have thrown six versions of work away. Read `evolution[0].v` and `LAST_UPDATED` again immediately before the bump, and if they have moved, STOP: report what landed, do not re-fold anything, and never quote a figure from the stale read.

Edit the master in place with SURGICAL edits anchored on a unique string that fails loudly if it does not match exactly once; a full rewrite truncates it. Everything on screen is derived by `recompute()`, so editing the data constants is enough: `purchases`, `sales`, `roster`, `loans`, `supplierReceivable`, `customerRefunds`, `STATED_STOCK`, `STOCK_COST`, `opening`, `CASH_COUNT`, `cashAdjust`, `LAST_UPDATED`, `QUEUE_COMMITTED`, `evolution`.

## NEVER RUN GIT FROM THIS SESSION

The repo at `C:\Users\maakm\Claude\Code\salt-command` is seen through a mount that **permits writes but denies unlink**. Git cannot delete its own lock files, so every invocation leaves `.git/index.lock`, `.git/HEAD.lock` and a `tmp_obj_*` per object behind, and `git status` alone recreates the lock. Those strays then block the commits `salt_sync.ps1` runs, which report `commit did not take` and carry on while `git push` still exits 0 and logs `pushed off-site`. The log reads healthy while the ledger goes unversioned; it ran that way from 09 to 11 Aug 2026.

**So: no `git add`, `commit`, `push`, `status` or `log`.** Read files, edit files, build, and leave git to the user on Windows. If the run must report repo state, read `.git/HEAD` and `public/rev.json` directly. Where the steps below call for a commit and push, write it into the brief as an instruction to him instead.

## WHAT THE DESK IS, AS AT v293

**Fifteen tabs** in FIVE rail groups:

- Command: **Today**, **Forward**
- Position: Overview, Order book, Inventory, Financials, **Analysis**
- Trading: **Sourcing**, Pricing
- Relationships: Customers, Network, **Map**, Ledger
- Actions: **Transaction**, Whiteboard

There is NO Version control tab and no sixteenth tab. It went at v177, when 176 changelog entries were extracted verbatim to `00_Config\changelog.json`. `evolution` survives as a ONE-ENTRY array holding the current version only, because several places read `evolution[0].v` for the version chip, the menu payload and the downloaded price sheets. **`evolution` is REPLACED, never prepended to**; it is `00_Config\changelog.json` that gets the prepend. Count the rendered tabs and the rail groups before asserting a number; this section has been stale before, in both figures.

**PORTRAIT (v276).** Every table is wrapped at RUNTIME in a `.tscroll` container by `wrapTables()`, called from `render()` after `applyNotes()`. Do not add the wrapper by hand and do not remove the runtime pass.

**NAMES ON THE PHONE (v277).** `10_Data\salt_bio.json` is the plaintext directory and NEVER leaves the machine; the cloud Worker drops `/bio` outright. Only the AES-GCM envelope syncs. `NAME_VAULT` and `vaultDecrypt` are LIVE code. Since v280 the vault re-keys itself: `salt_sync.ps1` hashes the directory each pass and re-runs `seed-vault` on change, provided `SALT_VAULT_PASS` is in the user environment. Names not resolving on the phone: check that variable first.

## WHAT MOVED BETWEEN v280 AND v293

Everything in the pricing section below still holds. These are the changes on top of it, and each one changed how a run behaves:

- **v287, THE WATERMARK.** Rewritten in step 1 below. It is the single most expensive rule on this page to get wrong.
- **v288, THE WRITE GATE.** `POST /queue` and `POST /vault` need `X-Salt-Key` matching the `SALT_WRITE_KEY` secret. Reads stay open. It is DORMANT until the secret exists. `drain.mjs` and `seed-vault.mjs` go through wrangler rather than HTTP, so neither is affected.
- **v290, BOTH SHELVES ARE COUNTED NOW.** Oil was counted for the first time ever, so `PROD_OPENING.oil.stated` is a real figure rather than null and oil's leak stopped reading nil: it never had no leak, nobody had ever looked. **A stated figure that is a roll-forward of an older count is not a count**, and the desk had been calling one that for weeks. When a count is taken, replace the stated figure; when salt merely moves, roll it. Effective cost rises with the leak each book carries, so a count moves every floor on that book.
- **v290 also: prices can sit under their own floor and STAY there.** A count is a fact and a price is a decision, and the second is his. Report a breach; never quietly widen a floor to keep a price legal, and never reprice without instruction.
- **v291, THE PHONE HAS ITS OWN APP.** `public/index.html` is now hand-written SOURCE owned by the repo and reads `data.json`, computing nothing. The BUILT desk moved to `public/desk.html`, served at `/desk`. So "the build writes public/index.html" is no longer true, and `public/index.html` must never be treated as build output.
- **v292 and v293, THE MAP.** Locations were extracted from ledger notes into `PLACES` and the Map became a heatmap. No effect on a commit; relevant only if a new party needs siting.

## THE PRICING SURFACE (set at v280, and it still stands at v293)

**THE PRINTED BOARD IS GONE.** No SS/S/R/M/P cards, no T1/T2/T3 tiers, no walk-away, no retail and wholesale split. A **reference ladder derives from cost on every render**, so it cannot go stale:

    priceLadder(q) -> floor, good, great, ceiling
    at 15%, 33.33%, 66.67% and 100% MARKUP ON COST (not margin on price)
    base = lotCost(q) = effEx * q            (v502: no delivery in it; delivery is typed on the order)

`REF` and `REF_POINTS` hold the markups. `tierBoard()` still returns rows with `cells`, now the four ladder points. **Reference, never policy**: it refuses nothing and moves no figure. `enginePrice(q, tier)` survives for quoting, unchanged.

**ONE FLOOR AT ONE MARKUP ACROSS EVERY SIZE.** `floorTotal(q) = lotCost(q) * 1.15`. The old band split at 6.25 unit made the floor fall as quantity rose; a markup on a lot cost cannot invert. Do not reintroduce `PRICE.floorPct`.

**`boardHeadroom(false)` WALKS LIVE PRICES, NOT CARDS.** Same shape plus `nUnderFloor`, `nUnderCost`, `nUnderReplace`; each hit carries `overPaid`, `overReplace`, `underCost` and `underReplace`. **`firstTier` names a PARTY, not a tier.** Below floor is not below cost: a price agreed when salt was cheaper can fail the floor and still earn money, the ordinary case rather than an alarm; report both. It mutates `pxOver.cost` while walking, so confirm `pxOver.cost` reads null afterwards.

**THE COST IS UNLOCKED AND MOVES LIVE.** `PRICE_LOCK_ON` is `false`. Two freezes held it, not one: the lock's snapshot, and the shrink rate preferring the stored figure. Both now read live. The `PRICE_LOCK` snapshots are kept intact so it can be switched back on without recapturing.

**THE IDENTIFIER IS THE OLD CONVENTION.** `C` or `S`, the first initial, **the number of letters in the first name**, then a hyphen and a location: `CS6-PER`, `CM4-MK`, `SP7-PUD`. `TBC` in the location slot means genuinely unknown. A resell account takes `-R` on the owner's code, ONE bucket per associate (the `-GEN` buckets were absorbed). An end customer with a name AND a location is elevated to a code of his own. The short G01/S07/M14 codes are purged and no translation table is kept. Never write a real name.

**THE REWARD RULE (v616, v618, v623).** `REWARD.stated` holds three figures: a customer earns a whole free unit per RM 500 of margin, an associate per RM 470, and an associate's R3 counts against a hurdle 1.2 times higher (`rewardUnitMargin(prod, who)`, `rewardR3Hurdle`), because each introduced order also counts for its own customer. All over the whole ledger (`rewardMargin`, `rewardUnits`). An associate pools their own code and -R account (R1 and R2) with every priced order of each customer they introduced, one level, from `introductions()` (row stamps and `INTRODUCTIONS` on the book); a customer counts their own orders and sits on the Customers table, an associate on their own card. A redemption and a written-off order earn nothing. No bands, no minimum, no openings; every unit ever taken is netted by `rebateApplied`, a cover included, and a deficit carries forward. Oil has no reward. `AWARDS` is history. `REBATE` survives only so a stray reference fails loudly.

## EACH RUN

**0) CHECK THE DOOR FIRST.** `serve_desk.py` owns the middle pass while on: it watches the master, waits 90 seconds for it to SETTLE, runs the cloud repo's smoke suite, deploys ANY change, and separately pulls the phone queue every 60 seconds. It never commits. `salt_daily.ps1` opens it headless at 10:00 KL and holds the door up to 45 minutes. Read `10_Data\daily_gate.json` before anything else:

- **`state:'open'`, stamped this morning**: normal. Carry on; you MUST close the gate at step 7.
- **`state:'closed'`, or absent**: no window. Say so in one clause and run exactly as described, drain included. Do NOT wait for a window that is not coming.
- **`state:'open'` but stamped hours or days ago**: a previous window never closed and the headless server may still be running with its watchdog off. Report it, and close it at step 7 anyway rather than leaving a false signal standing; a gate left open reads identical to a live window to every later run. It sat open from 11 to 13 Aug across several runs, each of which believed a server was holding the door.

THE SERVER MOVES BYTES; YOU MOVE THE LEDGER. Committing is a judgement and a 90-second loop must never make one.

**1) FOLD ONLY WHAT HE APPROVED. Rewritten at v305, and this is now the ONLY road into the ledger.**

**THE RULE, STATED ONCE: A QUEUED ENTRY IS NOT A COMMIT INSTRUCTION.** Since v302 an entry is turned into a proposed ROW by the cloud drafter, the row waits on his phone, and he approves or rejects it. Fold approved rows and nothing else. Reading a queue file and folding it is the behaviour that was REMOVED, because it walked around the approval step entirely.

   From `C:\Users\maakm\Claude\Code\salt-command`:

          node tools/drafts.mjs --from-queue     # route any LAPTOP entries through the same gate
          node tools/drafts.mjs --approved       # what to fold: approved and not yet committed

   `--from-queue` drafts `10_Data\salt_queue.json` (and anything left in `salt_queue_cloud.json`) into the same `draft` table the phone reads, so the desk's own queue passes the gate too. It commits nothing: the rows come back PENDING and he approves them on the phone like any other.

   `--approved` prints `{approved:[{id,collection,row,reasoning,flags,decidedAt}]}`. **Fold `row` as written.** It already carries the date, the cost, the bucket and the movement fields. If a row looks wrong, do NOT quietly correct it: say so in the brief and leave it, because he approved that row and not your improvement of it.

   **Anything PENDING is not yours to fold.** `node tools/drafts.mjs --list` shows what is still waiting. Name the count in the brief so he knows there is something to tap. Never approve on his behalf.

   **WHAT `--from-queue` REFUSES IS STILL YOURS, AND THIS IS THE PART THE GATE DOES NOT COVER.** It prints a `skip` line with a reason for anything it will not draft: an AMENDMENT (which row does it amend?), an entry carrying associate, stream or link fields (whose bucket?), a movement with no date, a product with no cost on the book. **Those are not drafted, not approved, and not folded by the approved-rows step.** Read them from `10_Data\salt_queue.json` and fold them yourself, exactly as you always did, against the row they amend.

   So state the scope honestly rather than repeating "the only road in": **the approval gate governs NEW ROWS.** An amendment is a judgement about an existing row, read against that row, and it stays the daily run's job. If the count of skipped entries is not zero, say so in the brief and say what you did with each.

   **`node tools/drain.mjs` IS NOT PART OF THIS STEP ANY MORE.** It no longer runs on a timer and its file is no longer a commit source. Use it to inspect (`--status`) or to recover if the cloud drafter is broken; if you do recover entries that way, put them through `--from-queue` so they still pass the gate.

   Still check `queue[]` inside the HTML and the newest `salt_queue*.json` in `C:\Users\maakm\Downloads`. Both are entries that never reached the drafter. Route them through `--from-queue` rather than folding them directly.

   CRITICAL: no queue file does NOT mean "no pending transactions" as fact. Say the folder shows none, note that browser-held entries are invisible from here, and ask. Every queued row is REAL.

   **BEFORE FOLDING, CHECK FOR A REPLAY.** For every entry above the current `QUEUE_COMMITTED`, look for a ledger row with the same date and the same total. A match means the entry was committed and the watermark was not moved, and folding it again double counts it. A date and a total can collide innocently, so read the rows before deciding.

   COMMIT: fold the APPROVED rows, roll `STATED_STOCK` for anything delivered, bump the version ONCE with an `evolution` entry, move `QUEUE_COMMITTED`, and then mark each one committed:

          node tools/drafts.mjs --committed <id> <id> ...

   The id IS the entry's own `at`. Marking is what stops a row being offered to the next run; skip it and tomorrow's run sees the same approved rows again. `--approved` returns only rows that are approved AND unmarked, so the two halves have to stay in step.

   **THE WATERMARK MUST CLEAR EVERYTHING YOU FOLDED AND NOTHING YOU DID NOT. Rewritten at v287, because the rule it replaces caused a double count.** The mark is the ONE thing stopping a committed entry replaying: the phone re-books anything whose `at` still sits above it, on top of the ledger row that already carries it.

   **Since v305 the rule is simpler, because a draft's id is the entry's own `at`.** Take the NEWEST id among the rows you folded, to the millisecond. It necessarily sits at or after every entry you committed, and a still-pending or rejected entry queued later sits above it and survives.

   - It must sit at or after the `at` of every row folded, and before the `at` of anything left pending or rejected. Check both, do not assume.
   - NEVER the clock, and never a queue file's `updated`: those files are no longer what you folded from.

   **The rule this replaces said the laptop file's `updated` "and that file alone", which is wrong the moment a cloud entry is folded.** The reasoning was sound as far as it went: `tools/drain.mjs` stamps the cloud file with wall clock at drain time, so that field is nobody's genuine write. But the laptop mark can sit BEFORE cloud entries that were folded, and then they replay. v286 followed the old rule with four cloud entries and left three of them above the mark: 50 unit out and RM450 of cash counted twice on the phone, and one pending order drawn twice, while the ledger itself was correct throughout. Verify against the live Worker rather than inferring. A missing queue file is not an empty one. The cloud file's own prune is a separate timestamp, in step 5.

   Nothing new: no edit and no bump, but **still evaluate the cloud version gate in step 5**. A session moves the master with no transaction behind it, and the phone still needs the deploy.

**2) DATE WHAT MOVED.** Every delivering order carries a delivery date: prefer a `Fulfilment` step in the `amend` trail; where the date exists only in a note, add `deliveredOn` (and `paidOn` where known). `txDates()` resolves trail, then stated field, then the order date marked assumed.

**A PENDING ORDER CARRIES NO DATE (v280).** A transaction is firm only with a `paidOn` or `deliveredOn`; "agreed on" is an intention, not a movement. A fully pending row has no `date` at all, and an amendment step that moves neither cash nor salt should not exist. The Ledger, the Order book and the Whiteboard all tolerate an undated row; if a new render site does not, fix the site rather than putting the date back. When such an order later settles, it takes the agreement date with its movements stamped on the day they happened, the same shape as an advance.

**3) REFRESH COST, ON FIFO.** **FIFO ALWAYS**, his instruction of 10 Aug. Lots queue in receipt order and are consumed in DELIVERY-DATE order. **The salt shelf reached zero on 28 Jul 2026 and no salt lot has landed since, so everything delivered on or after that date costs RM47/unit**; check the purchase rows before relying on that sentence, because it stops being true the day a new lot lands. Recompute the weighted average over received lots plus opening, and the latest-lot cost in `STOCK_COST`. Defaulted, pending and in-transit lots stay out of the basis. **DATING RUNS BEFORE COSTING**: change any delivery date, redo the cost.

**A SALE THE SHELF CANNOT BEAR IS A MISSING PURCHASE, NOT A REASON TO REFUSE THE SALE.** Book what happened, cost the uncovered units at the last known rate, say so on the row, and flag it. Never invent the lot that would make the arithmetic close, and never suppress the negative walk it produces: that negative is the evidence. It happened on 11 Aug, when 50 unit of oil went out against a 35 unit shelf, and it closed two days later when the purchase was recorded.

**4) VERIFY BEFORE STAMPING.** All of it must pass.

    python deskctl.py check          # extracts the script and runs node --check

Then render headlessly (jsdom, or a browser against a COPY) and confirm, under EVERY product: all fifteen tabs render, no throw, no `undefined`, `NaN` or `Infinity`; no occurrence of the retired mass symbol or of kilo/kilogram; the stock walk foots to the counted figure, and goes below zero only where a purchase is genuinely missing and the row says so; `boardHeadroom(false)` returns a finite figure and `pxOver.cost` reads null afterwards; `parityScan()` returns no rows; revenue, collected, AR and margin as expected. Both books carry a count since v290, so an uncounted book is now the exception and worth a line in the brief when it appears. Charts never draw under jsdom (canvas unimplemented); expected, not a fault. Top-level `const` in a classic script are not `window` properties: reach them with `window.eval('sales')`.

**SCAN THE RENDERED TEXT, NOT THE SOURCE.** `document.body.textContent` includes the contents of any `<script>` inside the body, so a raw scan reports dozens of false hits on `undefined` and `NaN` that are only variable names in the engine. Clone the body, strip `script`, `style` and `template`, then scan. Click through every tab under each product; `render()` only ever draws the active one.

**A COSMETIC CHANGE IS PROVED, NOT ASSERTED.** Capture the engine's outputs before and after and require them identical: `revTotal`, `revCollected`, `cogs`, `grossMargin`, `marginPct`, `currentStock`, `selfUse`, `arGross`, `defKg`, `buyKg`, `soldKg`, `pxCost().eff`, `pxCost().effEx`, `pxCost().shrinkRaw`, `parityScan().rows.length`, `pxOver.cost`. Do not compare every rendered number; repairing stale prose changes one by design.

NEVER run a test server against the real project folder: a POST to `/queue` or `/vault` writes for real. Copy the desk, both servers, `assets/` and a `10_Data` holding BOTH `salt_bio.json` and `salt_vault.json` into a scratch folder, preserving the two-level layout so `DATA` resolves. Never `pkill -f serve_desk.py`; it matches the calling shell.

**5) STAMP.** Every release: bump the version ONCE, set `LAST_UPDATED` to the KL date AND time **read from the clock, never composed**, prepend an entry to `00_Config\changelog.json` (newest first: `v`, `d`, `t`, `n[]`; some older entries carry `v` and `t` only, so match the shape already in the file). Then:

    python deskctl.py stamp

`stamp` REFUSES a bump while the queue is uncommitted; a refusal is a real finding, fold the entries first. There is NO publish step and no `update_artifact`. `deskctl.py published` is a no-op kept for prompts not yet updated; running it records nothing and proves nothing shipped. **Only the cloud leg below puts a change on his phone.**

**Cloud leg. ONE COMMAND DOES ALL OF IT, and it is the one to reach for:**

    cd "C:\Users\maakm\Claude\Code\salt-command"
    node tools/update.mjs

Eight steps: preflight, drain, report what is still pending on BOTH queues with the replay check, build, test, deploy only when the built id differs from the deployed one, version, and then PROVE the master, `rev.json`, the live `/rev` and origin all agree. It exits non-zero if any of that fails, which is the point: two runs in a row had shipped the master but not the cloud, and both failures were silent. `--dry` reports and changes nothing; `--no-push`, `--no-deploy`, `--no-drain` skip a leg; `-m "..."` sets the commit message. **It will not fold a queued entry into the ledger, by design**, and its replay check refuses to ship when an entry above the mark already looks committed. `--force-ship` overrides once you have read the rows. **It runs git, so it is for the Windows session, not for this one** (see NEVER RUN GIT above): write it into the brief as an instruction to him.

By hand, if `update.mjs` cannot be used:

    node tools/drafts.mjs --committed <id> <id> ...   # the ids you folded; the id is the entry's own `at`
    npm run deploy

**MARK THE DRAFTS, DO NOT PRUNE A QUEUE FILE.** Since v305 the thing that stops a row being offered twice is `committed_at` on the draft, not the old `drain.mjs --committed` prune. Pass the ids you ACTUALLY folded and no others. **Folded nothing: mark nothing.** The old prune still exists for the file, but that file is no longer a commit source, so pruning it proves nothing.

`public/rev.json` records what is BUILT and `.deployed.json` what last DEPLOYED; a failed deploy leaves them unequal so the next pass retries. Deciding by comparing those two recorded facts is deliberate: hashing the build output before and after asks "did my build change anything", which is a different question from "is the phone behind", and the two part company the moment anything else builds the repo. `npm run deploy` builds first; the build copies `assets/chart.umd.js` into `public/assets/`, without which every phone chart 404s to "Chart unavailable". A `wrangler.jsonc`-only change does not move `rev.json`'s id and is therefore NEVER shipped by the auto-sync leg; it must be deployed by hand.

**6) BRIEF, 5 to 12 lines,** in the reply: phone entries drained and committed; stock on hand and free to sell; cost per unit and whether it moved; receivables gross and net with debtors by code, plus the supplier recoverable and its ageing; deferred and pending quantity; revenue, collected and margin; `boardHeadroom(false)`, saying how many live prices are under floor, under replacement and under cost, naming the party that gives first; one line of guidance.

Headroom falls when the buying rate rises, the leak worsens or the delivery rate rises; under 10% of the live rate it is the week's most urgent pricing fact and leads the brief. **A price under floor and a price under cost are different findings; report both.** Report reward positions when a party crosses a hurdle or works off a carried deficit.

**7) CLOSE THE GATE.** If step 0 found `state:'open'`, write `10_Data\daily_gate.json` back as the LAST thing you do:

    {"state":"done","at":"<ISO now>","note":"<version committed, or nil-activity>"}

If step 0 found no gate, write nothing.

## ACCOUNTING RULES THAT GOVERN COMMITS

- **Pending counts nowhere.** Nothing paid and nothing delivered is an intention; Order book only. Money via `poCash(p)`, quantity via `poRecvKg(p)`, never `p.total`. `poLive(p)` excludes pending and defaulted lots from any average.
- **Clearing pending needs an explicit receipt.** A lot with no `receivedQty` reads as fully received: when money or salt first moves against an agreed-only lot, set `receivedQty` and `inTransit`.
- **GOODWILL IS AN EXPENSE (v280, his ruling).** A gift is not a sale: no revenue, no cost of goods. Mark the row `goodwill:true`; `pricedSales` excludes it while the row stays in `sales`, so the salt still leaves the shelf. Removing the row would put the salt back.
- **Every entry says which book it is on.** `ovNew` stamps `row.product`; absent still means salt. A stock count is per product. An amendment inherits the product of its order.
- **A loan out before the opening count is already inside it** (`preOpening:true`); never deduct it again.
- **Cash is counted, not derived.** A count reads as at the START of its date. Cash follows `paidOn` where a row carries one, not the order date.
- **A big purchase makes the leak look smaller** (the observed rate is the plug over everything handled); say so whenever it moves after a large receipt.
- **Attributing salt to a party reduces the plug only if booked as a DELIVERY.** A `selfUseLog` entry attributes without reducing, because `selfUse` is the plug itself. Salt gone with no row against it: book the delivery and do NOT roll `STATED_STOCK` (the count already excludes it).
- **Every priced sale carries its own `cost`.** Falling back to `wavgBuy` back-dates cheap salt onto old orders.
- **Shrinkage on a NEW lot is not the observed rate.** `SHRINK.levels` holds observed, expected 7.5% and settled 5%. Never price a purchase off a target.
- **A quote never carries a price already beaten**, and **no floor, price or replacement cost is ever hardcoded into prose**; derive it. A typed figure goes stale when the buying rate moves, and this desk once carried three different replacement costs at once.
- **A later payment clearing an older balance is LATE CASH on the originating order.** `advanceKg` and `advanceIn` are live: `txEffDeliv(s)` reads `txDeliv(s)+(s.advanceKg||0)`. Strip neither.
- **A same-day settlement folds into the opening line, and THE TEST IS THE WHOLE TRAIL.** Fold only where the ENTIRE trail is a single step on the order date. Never strip the first step of a MULTI-step trail that moved something: `replayAmend` accumulates from zero, so that step IS the opening.
- `SALES_POLICY.maxLot` caps the size the desk will sell (null = no cap). `PLACES` sites a party on the Map; a suffix with no entry stays unplaced rather than guessed.

Never invent transactions or figures. A missing file or unverifiable figure is said plainly, not estimated. Flag anything else noticed rather than fixing it quietly.

FINISH by presenting, with present_files, BOTH `30_Published\salt_command.html` AND the launcher `30_Published\Open Salt Command.bat`. Every run, including nil-activity. **Name each file in prose, in card order, before the call**: the cards truncate the path and show only a generic type. The launcher goes every time, because opening the raw HTML starts no server and the queue and the directory both break.