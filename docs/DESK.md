# The desk: how the rules are built

`CLAUDE.md` carries the rules; this file carries the mechanism behind them, moved out on
16 Sep 2026 under the root token test. Read on demand. The dated record stays
`master/changelog.json`; the reasoning stays `docs/NOTES.md`.

## Pricing (hard rule 5)

- **COGS off the latest purchase, every book** (his settled rule of 05 Oct 2026, `COST_RULE` kind
  `latestCogs`). `pxInputs` hands the stack the engine's `latestCogs` over the book's lots (the
  latest landed by received date, the later in the list winning a day), and `costStack` prices
  off its quote plus trip freight over its units, no freight typed reading nought: `lot`,
  `freight`, `landed`, `eff` and `effEx` are that. The leak is still measured; `afterLeak` carries
  the stack's after-leak figure, printed beside the Floor on Pricing where the book loses
  `RULES.leakInfoFrom` (a quarter) or more, oil and rice today, and nothing prices off it. `replCost()` reads the same lot.
  A book with no landed lot falls through to the older roads with nothing added for the leak. The fold costs a sale moving
  goods with no cost of its own at `latestCogs` over that book's lots landed by the movement's day, as the drafter's
  `cogsFor` does; a gift or reward keeps the shelf's rate. A lot partly landed is costed over the units
  received (`poRecvUnits`), its whole quote and freight on what is on the shelf; a lot with nothing
  received is not landed and is passed over (review of 05 Oct 2026).
- **The Floor is the order total up to the next RM 5; the Ceiling is 3 times it** (his decisions of 18 Oct 2026).
  `floorTotal` is COGS times the size rounded up to the next RM 5, one per size on every book; `costTotal` is the
  exact cost, for the readers that measure cost and not price (the price band's segment floor `flOf`, `flRate` and
  `f1`, the floor-per-unit chart). `ceilingX` is 3 on every book (oil and candy were 2, rice 2.5). A stated board
  (`fixed`: oil, candy and rice, his typed rungs, unchanged) is held between the Floor and the Ceiling, capped down to the
  book's grid. The price grid's `LADDER.round.to` is 5, so a RM 35 Floor is not re-rounded to RM 40.
- **Salt is the Set Price and their %** (his decisions of 05 and 18 Oct 2026). `TIER_RULE.salt` carries `drift` (the
  flag that marks a book with a Set Price), `points`, `ceilingX`, `auto`, `suggest` and `presets`. **The Set Price is the
  least any customer but a partner pays** and what a stranger is quoted. The multiple of the Floor is 2.5 at half a unit,
  2 at 1, 1.67 at 6.25 and 1.33 at 12.5, sliding in the log of size between points and flat above 12.5. The engine's
  `driftWalk` walks the grid (half a unit to 25 in quarters) smallest first: the rate is the lesser of the last size's and
  `Floor * multiple * (1 + %) / q`, on the exact rate and never compounded; the price is that rate times the size, down
  to RM 5; it is then lifted so the ringgit margin over the Floor never falls below the largest margin of any smaller
  walked size, and held between the Floor (up to RM 5) and the Ceiling. The quoted rate may therefore rise by under RM 5 a
  unit between quarters: the rate law is on the exact rate. `quoteAt` and `quoteGrid` are the one rule at any size, so
  for every % in use and every grid point `quoteGrid(...).p[i]` is `quoteAt(min + i * step, ...)`, and a
  partner's `quoteAt` is the `floorTotal`, the snapshot's `floors[q]` and the drafter's `floorFor(q).floor`.
- **Their %** (`TIER_OF[code].salt`, 0 to 2, held until he changes it; `cardQuote` reads it through `driftOf`). It is the
  lift on the Set Price, applied inside the walk and the same at every size, and nought is the Set Price. **Everyone
  starts at 0%** (the held figures were removed in the 18 Oct 2026 version, and the fold refuses a `tierset` or an Add ID
  figure stamped before `RULES.liftSince`, which was in the old unit). He sets it on the Their % card (Network), Counter
  Admin's Their % form or Add ID (presets Set Price, +5%, +10%, +15%, +20% and +30%, or another %); it is queued,
  folded as `tierset`, and a null clears it. Under about 7% a % moves nothing at half a unit to 1 unit, which the card says
  once. **Nothing automatic prices.** `autoDrift` over `driftSignals` fills the card's good and bad only. The card's
  suggestion is `suggestOf` (the engine's `suggestPct`): the median over their last five salt sales of the rate paid
  over the Set Price rate at that size, less one and not under nought, plus a share for a write-off (30%), a long late
  or 14 days overdue (20%) or a late (10%), to the nearest 5%, and nought under `minSettled` settled rows; good signals
  suggest nothing. The Desk's card says it as "Suggested +10%: paid late"; Counter Admin's Use the suggestion fills the
  box. The snapshot carries each customer's quotes as `cards`, their % as `lift` and the suggestion as `suggest`, which
  the price list reads (`basis: "card"`); an older reader that looks for the former map finds nothing and falls back to the board.
- **A partner pays the Floor** (his decisions of 06 and 18 Oct 2026). Quoted `floorTotal` at every size on every book,
  RM 5 round-up included, through `quoteAt` with `d` of `'partner'`. **Set from the phone** (his decision of 09 Oct
  2026): the Their % card's Make partner queues `partnerEntry` (`mode: 'partner'`, the code alone, not an Add ID so the
  pair vault's gate does not meet it); the drafter returns a `roster` row with `partner: true` and `kind: 'reseller'`;
  the fold files the code in `partners` and appoints an associate with their -R account if they are none, so a partner
  keeps every associate property. The desk shows the standing at once and the card reads waiting under Approve.
  `test/partner-control.mjs`.
- **NRV is the Set Price on a book that has one, the stated price on a board** (IAS 2.6): the least a customer but a
  partner is quoted, so the IAS 2.9 test can bind; the Ceiling is never the basis.
- **There are no price levels** (removed 18 Oct 2026). `TIER_NAMES`, the `fiveTiers` multiples branch, `levelAt`,
  `levelShapeOk`, `tier1Anchors`, `tier1Walk`, `tier1Ask`, the proposals (`tierProposal`, `ruleProposal`) and the
  guest boards per level are gone, and so is the legacy Tier I to III badge. The identifiers `TIER_RULE`, `fiveTiers`,
  `tieredBooks`, `TIER_OF`, the row code `T2` and the `tierset` collection stay; `LEVEL_WORDS` and the private word
  lists stay as the guard that stops a level word reaching a customer. What is not a pricing level stays: a
  supplier's quote tiers (`QUOTES.*.tiers`, `buyTaper`, the restock `tier`), an associate's rank, stars and share, and
  an order rating. The superseded reasoning is in `docs/NOTES.md`.
- **One rule at any size, the engine's `quoteAt`.** `cardQuote` is `quoteAt`: on a book with a Set Price, the Set Price
  lifted by their %, **walked through every grid point beneath the size** (`walkSizes`), so the rate never rises across
  the grid by a step or more; on a stated board the rung's rate times the size, rounded down to the ringgit between rungs,
  his typed rungs exact (`fixedWalk`). `cardPrice` is called by the price list off the snapshot's `cards`, and on the
  desk by `cardQuote`, which every quote to a named customer reads: the printed board (`pbPrices`), the approach offer
  and Today's worth (`nextBest`, no offer with no price), and the reward cover, whose gap is to their card price.
- **Words** (18 Oct 2026): every surface says Floor, Set Price and Ceiling, and his figure is Their % (presets "Set Price,
  +5% ... +30%"). No tier, level or drift word is visible on the Desk, Counter Admin or the Counter;
  `test/pricing-words.mjs` draws every part of every book and reads the source sentences. The stock count's own gap is
  the Difference.
- **One delivery for a trip of several books** (his design of 05 Oct 2026): the rows one trip
  carries to one customer on one day share `trip` (`t<ms>`, minted by the Workbench when a sale
  of more than one book carries a delivery); the delivery stays on the active book's row alone,
  so `txOwed` and every reader of what is owed count it once. The engine's `tripFault` refuses a
  second delivery, customer or date, and a book twice; the drafter (`tripCheck`, against the
  book, the uncommitted drafts and the pass) and the fold's `plan` both ask it. **One tap under
  Approve decides every pending row of the trip** (`tripStmts`, in the tapped row's own batch), never a claim or a site order's
  row. The statement says "plus delivery RM x for one trip of n orders" on the carrier row. A
  lone trip row is no fault: it is the convention the four earlier hand-folded trips used.
  Counter Admin's Add another book carries the same extra-book figures through its dedicated
  sale/purchase inputs. `makerTradeBatch` checks every book before retaining the immutable
  entries; `queueSale` writes the complete fixed trade batch in one queue document, then the
  native drafter makes the rows. A retry resumes all retained entries, not merely the first
  draft. Order review names Approve trip/Reject trip and shows the sibling readings; the native
  decision still uses `tripStmts`. No delivery or a purchase mints no trip, as on the Workbench.
  Stream offers No associate, R2 resell and R3 refer on sales only. R2 hides Party,
  takes the associate as the party and offers an optional End customer; every extra books
  to the associate's `-R` bucket, never to that buyer. R3 keeps Buyer (referred) and credits
  the associate on the first row alone. The associate list reads the same bench sources
  as `associateIds`, minus standing bans; R2 offers only a filed resale bucket.
  The confirmed-success hook releases the trade's timestamp/signature only after the
  whole-batch answer is confirmed. An uncertain send retains its exact original request,
  including every extra, even when the controls have been edited.
- **What the inventory is carried at is DERIVED, and it is not pricing** (his instruction of 26 Sep
  2026). Each book's stock, counted or walked, is allocated newest-first onto its received lots
  (units leave oldest first), and the rate is the units-weighted goods rate of those allocations,
  freight left to the readers that add it, the opening beyond every lot: the engine's `stockBasis`,
  run by the walk as `W.stockCost` and read through `stockCostFor(p)`, which walks the book asked,
  never the book in view. It values Financials' closing inventory, the Inventory value card, the
  pricing snapshot's `stockCost` (the drafter's cost for a sale or gift) and the fold's cost for a
  salt sale with none. No floor or board reads it (`replCost` reaches it only on a book with no lot,
  where it is the opening's rate as before): COGS for pricing is the supplier's quote. Salt's
  `STOCK_COST` and `PROD_STOCK_COST` are gone, and so is the Today note that caught a missed roll.
- **The profile** (v666, his decisions of 16 Sep 2026). `buyerProfile(code,prod)` reads a customer's own
  priced orders and returns a name (one-off, small and often, small and rare, large and regular, rare and
  large, consistent mid, occasional mid) and six flags: `frequent`, `small`, `bigger`, `loyal`, `rare`,
  `lateTwice`. The thresholds are one constant, `PROFILE_RULE`, cut from the book on 16 Sep 2026: the median
  customer then bought 1.83 times a month, one and three units were the lower and upper quartiles of size,
  and the whole book was under three months old, so loyalty is counted in orders rather than time. Orders a
  month are read over at least 30 days, or every new customer arrives frequent. **Late** is an order paid
  past `RULES.creditDays` (10) or still owed past it; a write-off is not counted, having its own rule (the Credit
  age breach and Today's chase count instead from the handover, past `RULES.holdDays`, as the Counter does). On
  the book that day: small and often CR3-DAM, CA4-DAM, CC5-OKR; loyal eight; late twice nobody. CH5-KLC,
  who pays RM180 a unit for half-units, reads small and RARE. **It prices nothing**: it feeds the Their % card's good and bad.
- **The late payer** (V5c, his answers of 29 Sep 2026, in place of `lateTwice` and rare and late twice). The profile
  reads no lateness; `lateOf(code)` does, across every book and the `-R` bucket, through the engine: `payDelays` gives each
  row's delay in days from its handover (a stated paid day less the first handover; a trail stage by stage, the latest
  covered stage's; unpaid, the days since `txUnpaidSince`, listed once past the term; a write-off, the lock; a day only
  assumed or an undated handover counts neither way), and `lateOffer` walks them by the day each was settled. Within
  `RULES.holdDays` is on time, past it and under `lockDays` short, `lockDays` or more long. One long delay, or a second
  short one within `RULES.lateWindowDays` (90) of the one before, turns it on; one payment on time turns it off; a delay
  within the window after that turns it on again, and then it takes `RULES.lateResetRepeat` (3) on time in a row. It
  feeds the Their % card's suggestion (paid late, paid very late, written off), which he takes or not; it prices nothing. The Counter says it in words off the sealed
  `pay.term`, `lock` and `window`: a line under To pay now, the whole rule on the pay sheet. Prepay also reads this walk (V5b2c): any delay in all history puts an order in advance until three payments on time in a row.
## The desk

- **Counter maker bridge**: the owner works in Salt Account's Orders, Customers, Record and Shop places (one Maker place until 11 Oct 2026). `/all/maker/*` is
  dispatched only after the Counter Worker verifies Cloudflare Access identity and the owner
  email; its handler receives that verified identity, not a request-supplied address. The Counter
  uses the `DESK_MAKER` service binding and a dedicated `COUNTER_MAKER_KEY` to call only
  `/_internal/maker/drafts`, `/_internal/maker/queue` and its timestamped withdraw action,
  draft decisions, named order-stage actions, and typed
  `inputs/stock-count`, `inputs/sale`, `inputs/purchase`, `inputs/tier-set`, `inputs/house-sizes`, `inputs/hush`, `inputs/loan`,
  `inputs/repay`, `inputs/gift`, `inputs/redeem`, `inputs/add-id`, `inputs/amend-id` and
  `inputs/place` and `inputs/ledger-amend` operations. `vault` and `vault/addr` are read-only envelope routes; Add/Amend ID
  encrypts names on the device before sending the sealed envelope, and placement opens the encrypted
  places envelope on the device and sends only code-to-coordinate pairs rounded to 0.01 degrees.
  The Desk Worker checks the key and each exact method/path before any asset handling; an unknown
  path under `/_internal/maker/` is refused and never falls through to the desk page. It does not
  proxy arbitrary paths or expose D1. Counts, trades, tiers, loans, repayments, gifts, redemptions,
  IDs, placement and ledger amendments use existing Position Engine constructors, active-book and roster checks, the
  queue and the drafter; they wait for review. The Counter sends fixed fields only, never raw entries
  or unchecked notes. Name and place prose is absent from the queue; the trade and ledger-input note
  fields are disabled on Counter because those routes do not validate free text for name/place leaks.
  Counter retains the complete failed request and disables its controls while sending. Durable
  canonical operation/body receipts (`migrations/0013_maker_requests.sql`)
  reject changed content under an existing timestamp and replay a completed input. Non-vault
  receipts retain the immutable server-built entry before resource admission. A retry after
  admission, queue or drafter interruption resumes that same fixed timestamp through the
  shared admission and drafter; success requires the matching real draft, never just a queue
  write. Concurrent retries share one admission and one primary-keyed draft. If the book no
  longer permits the retained entry, recovery refuses explicitly rather than rebuilding it.
  The Counter's server-held queue review derives the owning device by finding exactly one
  `q:<device>` record; it never accepts a device chosen by the caller. Identified device uploads
  keep an immutable `queue-owner:<at>` receipt in `maker_request`; the same-origin Desk recovery
  route `POST /queue/<at>/withdraw` requires that existing device id and the entry fingerprint.
  The Counter route infers the same owner from the server-held queue. Both roads recheck under the
  per-device lock, bind the timestamp, entry fingerprint and owner in `maker_request`, remove only
  that device's copy, and clear its resource-admission source plus a racing drafter reservation.
  The durable `queue-withdraw:<at>` tombstone also blocks a delayed queue POST, resource admission and the
  drafter's atomic draft insert. Only a saved `withdrawn` receipt, or a matching owner/fingerprint
  readback of an already rejected draft with no remaining server copy, confirms completion;
  retries replay the same result. If the Desk's submitted fingerprint differs, `409 entry-changed`
  includes `serverFingerprint` only while the unique current device queue row agrees with its
  durable owner receipt; that response makes no change and requires a separate confirmation tap.
  No fingerprint is returned when the queue copy or ownership agreement is absent. A pending draft
  remains under native Reject; an approved or committed row cannot be withdrawn. Refusal reason,
  source and seen time come from the Desk
  mirror. The Counter cannot read the phone's unsent local queue: Cancel retained input is
  device-local and is not server withdrawal.
  Reward redemption shows the native held balance per holder, net of durable reservations:
  a departed holder keeps their earnings visible without an action, returning restores the
  offer, and a customer needs one whole unit. An unpaid advance offers Offset, otherwise Redeem.
  Sale cover is an unticked choice on the first or an extra book. The read-only
  `POST /all/maker/trade-cover` bridge reads the party's own snapshot card and the shared
  Position Engine `coverPlan`: goods only, shelf cost, capped to available reward and floored
  to hundredths of a unit. Delivery, the floor and the board are unchanged. The request carries
  only `cover: true`; the Desk builds the native cover fields and checks eligibility again.
  Covered multi-book requests take a dedicated resource road: one conditional D1 insertion
  admits all claims or none, with durable `orders` ownership before queue transport, and the
  exact `queue-withdraw:<at>` fence. Phone queues use the same batch admission with
  `device:<id>` ownership. Ordinary trade batches still refuse resource entries. A reseed
  during admission releases only new ownership; an uncertain transport keeps the original
  whole batch and reservation for retry. No new migration or live acceptance is implied.
  `0014_input_admission.sql` adds atomic resource receipts, claims and per-road ownership for
  loan repayments and reward draws; both migrations were applied individually on 03 Oct 2026,
  with readback preserving the existing draft indexes. The shared admission
  helper runs on queue roads and drafting, and the fold rechecks the accepted batch. The follow-up's exact
  remaining cutover gaps are listed in `docs/STATEMENTS.md`.
- **Versioned vault pair, opt-in protocol**: the approved direction is one D1 singleton
  containing a revision, names envelope and places envelope. One no-store read returns a
  consistent pair; any response containing places remains keyed, while the intended
  names-only ciphertext read can remain public. `0015_vault_pair.sql` and `src/vault-pair.js`
  implement the transaction kernel. `/vault/pair` GET/POST and the Counter's
  exact owner/capability pair GET use it only when `VAULT_STORE=pair`; that setting is absent
  from live configuration. Pair routes require a configured write key, remain behind human
  Access when enabled, and never adopt legacy KV automatically.
  Conditional update, whole-request fingerprint receipt and validated ID/place outbox
  insert share one D1 batch. A stale revision writes none of them. An identical timestamp
  replays its receipt; changed ciphertext or entry under that timestamp refuses. Envelopes
  have canonical base64, 16-byte salt, 12-byte GCM nonce and at least a 16-byte tag.
  Requests are bounded to 1 MiB and 1,000 retained receipts; capacity exhaustion refuses
  explicitly until reviewed maintenance. The fixed-id outbox sender must confirm success
  before completion and survive a crash after queue insertion without duplicating an input.
  Public names-only compatibility and keyed places reads follow the D1 pair under that
  setting; old unversioned POSTs and generic named ID/rekey/place queue writes explicitly
  refuse with an upgrade state. Nameless buckets have no vault entry and keep their queue road.
  Maker ID/place routes commit the server-constructed input with both envelopes. The exact
  keyed Desk `POST /vault/inputs/add-id|amend-id|place` routes do the same. Recovery consumes
  that outbox using its original timestamp, requires an actual draft, then marks completion;
  failure leaves it pending. Identical request replay and the real scheduled Worker resume
  it after commit-before-queue or queue-before-completion interruptions. Changed content
  under that id refuses rather than overwriting or shifting its timestamp.
  Scheduled recovery processes at most 25 pending rows, ordered by last attempted time and
  id. Each attempt is marked before work, so failures rotate behind untouched rows rather
  than starving them. Failures retain pending state and log only safe timestamps. A failed
  row or unreadable recovery batch does not suppress incumbent minute/daily cron stages;
  direct request failures remain explicit.
  Counter forms, Desk Workbench Add/Amend ID, the legacy named Add ID path, Network placement
  and base-point edits now use the versioned pair when discovered; normal seed/rekey and pull
  use the same authority. Shared `vaultRekeyMap` moves names and exact places, descendants
  included, while preserving `_base` and refusing target collisions. Legacy KV behavior stays
  unchanged. ID notes are explicitly refused under pair authority until a cloud-safe note
  check exists, never silently discarded.
  `seed-vault` and `pull-vault` now discover the authority from the names-only read rather
  than trust a laptop flag. Under versioned authority, pull opens names and places from one
  keyed revision, writes both local files and saves ciphertext `salt_vault_pair.json` as the
  local merge baseline. Seed decrypts the baseline and latest pair, merges only local intent
  through shared `vaultMapMerge`, preserves unrelated remote edits and the paired envelope,
  and sends one CAS. It requires `SALT_WRITE_KEY` (and `SALT_ACCESS_JWT` when human Access is
  enabled); neither is filed. Ordinary names/places seeding no longer uses direct Wrangler
  KV writes under versioned authority. Legacy authority keeps its existing paths. Slip-key
  operations are unchanged.
  A conflict keeps the local draft, reads/decrypts the latest pair, reapplies the intended
  edit with collision checks and asks for explicit review on overlap; revised content gets
  a new request id. Neither automatic stale whole-map replacement nor `--force` bypasses CAS.
  Bootstrap requires writer maintenance, two matching legacy KV pair reads/digests,
  revision-1 insertion and readback, followed by an explicitly authorized all-client cutover.
  Old unversioned POSTs must refuse with an upgrade state after cutover. Rollback requires
  a consistent D1 export and readback; stale recovery KV copies cannot become authority.
  Laptop overlap review requires `--review-conflicts` in a terminal and explicit `APPLY`;
  unattended overlap refuses. `--force` cannot bypass it. An encrypted request is saved with
  exclusive creation in `salt_vault_pair_request.json` before sending; a lost response uses
  `--retry` with the identical timestamp/ciphertext. `--rebase` keeps that old request aside
  and reviews current authority under a new timestamp. Dry runs write neither baseline nor
  request. These tools have actual Worker-path concurrency, overlap and replay checks;
  Counter and Desk retain encrypted baseline/intent in device storage before transport, keep the form
  after stale CAS, and require explicit Apply/Cancel for overlapping changes. Cancel writes
  nothing; Apply merges unrelated remote entries and mints a fresh request. An unchanged
  transport retry retains its timestamp and ciphertext. Desk binds retained input to its
  original form, blocks concurrent submissions and updates unlocked names/places together
  after replay; unlock itself rereads one consistent pair. Reload shows retained-input
  recovery: unlock first for a vault retry or conflict review, Retry sends the identical
  timestamp/ciphertext, Review merges intent under a new timestamp, and explicit local
  Cancel removes the device request without withdrawing a server-committed input. The
  records contain only ciphertext and allowlisted cloud-safe fixed metadata, never opened
  names/places, a passphrase or a key. Malformed records refuse and remain for explicit
  cancellation. Storage failure refuses transport. Counter's non-vault typed inputs also
  retain their fixed request metadata across reload.
  Laptop pull uses `tools/vault-local-files.mjs`: an exclusive process lock and fsynced
  roll-forward journal cover names, places and their ciphertext baseline. Every seed/pull
  CLI obtains the lock and recovers the journal before reading local files; the ledger's
  leak-check reader refuses a lock, recovery guard or unfinished journal. Each replacement
  is renamed separately, not a filesystem multi-file atomic rename. After interruption,
  recovery completes every journaled file before a consumer runs. Active processes are
  never displaced; a dead owner can be recovered. A recovery guard abandoned during lock
  acquisition fails closed and needs reviewed `--writers-paused` recovery.
  Seed completion reconciles both plaintext maps with the confirmed cloud pair before
  advancing the baseline, in that same journal transaction. Its retained ciphertext
  request includes the original encrypted merge baseline. Remote additions/amendments
  are imported, while local changes (including unsent edits in the untouched partner)
  remain local intent against the new baseline; a names-only seed never sends those
  place edits. The request is removed only after the local transaction finishes.
  Retried completion follows the identical reconciliation path. Older retained requests
  without a reconciliation baseline refuse with an explicit recovery message rather
  than guessing which absent local entries are deletions.
  Preparatory maintenance uses standalone `0016_vault_write_gate.sql`, not the reseeded
  book state. Its default is open. Draining excludes new names/places writes and named
  ID/rekey/place queue ingress; accepted outbox consumers may finish. Paused is conditional
  on no active writer and no pending outbox. KV, pair, Maker and legacy Desk routes use
  durable per-operation claims, released only by their own completion. The laptop's legacy
  names/places seed now uses those Worker routes with `SALT_WRITE_KEY` in the environment;
  only the unchanged slip-key road uses a direct vault KV put. When Access is enabled the
  laptop also needs its owner `SALT_ACCESS_JWT`. A paused refusal preserves device intent.
  `GET /vault/maintenance` is keyed, no-store and read-only; no phone capability can open
  the gate. Account-operator maintenance is `node tools/vault-maintenance.mjs gate
  --phase draining|paused|open --apply-remote --writers-paused --output <local-report>`,
  with separate `--read-remote` readback. No error automatically opens it. A crashed
  active claim blocks pause until reviewed repair proves its writer cannot still run;
  there is no expiry or force-release shortcut. Direct account API/KV/D1 superusers remain
  out-of-band and must be explicitly paused during the maintenance window. Imports may
  make D1 temporarily unavailable; that is an explicit write/recovery failure, never an
  open-gate fallback.
  `node tools/vault-local-files.mjs --recover --directory <local-data-folder>
  [--writers-paused]` is local-only. Journals and replacement files stay in that private
  data folder; no decrypted data is sent by recovery. Filesystem/power-loss damage, an
  unreadable journal or permissions preventing rename require operator repair; they never
  silently admit mixed revisions. External editors and out-of-repo utilities cannot be
  forced to honor this lock and must be paused while a tool owns it.
  `tools/vault-maintenance.mjs bootstrap --first <pair.json> --second <pair.json> --at <ISO>
  --output <report.json>` creates a reviewed SQL plan from two identical legacy ciphertext
  snapshots and refuses an existing singleton on application. It does not read or mutate
  remote storage. `export --database <local.sqlite> --output <report.json>` reads one
  consistent revisioned rollback pair with a digest. `prune --database <local.sqlite>
  --before <ISO> --output <report.json>` is read-only unless `--apply-local --writers-paused`
  is explicit; it retains at least thirty days, refuses pending recovery, and advances a
  receipt floor so pruned timestamps never become fresh writes. Remote collection,
  bootstrap/export readback and rollback deployment remain an authorized maintenance
  procedure, not an automatically executable cutover. No utility switches live authority.
  Account phase writes use an explicit temporary SQL file, not an escaped multiline shell
  argument; the operator reads the gate back independently after any ambiguous process failure.
  Live flag readback follows the production deployment's traffic-serving version and inspects
  that version's bindings through the Cloudflare API. Generic script settings can already show
  a preview/latest-upload flag while production still serves the prior version. A sole 100%
  active version, or an explicit check of every traffic version during a split rollout, must
  agree with real `/vault` revision/ciphertext discovery before maintenance reopens.
  Normal seed must stop direct names/places KV puts at cutover; privileged Wrangler/API KV
  puts then affect retired recovery copies only. Direct privileged D1 edits remain an
  unavoidable out-of-band bypass, requiring maintenance and revision/receipt repair.
  No remote migration, bootstrap, deployment or authority change is authorized by source
  support. `vault-key` and its separate seed/restore procedure remain unchanged.
- **Bridge secret provisioning**: create one high-entropy value of at least 32 characters and
  provision that same value as `COUNTER_MAKER_KEY` on both Workers, using the appropriate Wrangler
  config for each. Never put the value in either config or source. `STMT_DESK_KEY` is a different
  capability and remains Desk-to-Counter only.
- **Operating hours**: Salt Account writes `maker:hours` in the Counter KV. The public `/hours`
  route returns only the open/closed status and timing; its schedule uses Kuala Lumpur time.
  Customers can still place orders while closed, and the order form tells them confirmation may
  be delayed. A temporary open or closed override expires within 14 days; clearing it returns to
  the weekly schedule.
- **The rail** (v622): the destinations with no heading above them, and the open one's pages
  beneath it; a destination with one page lists nothing.
- **The browser tab icon** is linked directly to the same-origin `icon-192.png`; the Apple
  touch icon and manifest icons remain separate.
- **Analysis correction review**: `unknown` and `differs` claims from `modClaims` are potential
  mismatches, not proof of a bad ledger row. The row link opens its correction history. Delete
  warning hides that finding in this device's review list only; Show removed warnings and Restore
  bring it back. The ledger row and its dated history are never changed by these controls.
- **`PROD`** (v625) is set only through `setProdView`, by the page's product switch, the
  single-book pages' badge and the Enter form's select, and is remembered on the device. A
  per-product page draws that product's detail alone, under a switch whose buttons carry every
  product's headline; the rail carries no switch.
- **Add ID**: a code queued as `addid`, drafted into the roster, approved, folded.
- **Amend ID** (v628, on his rulings of 11 Sep 2026): the new name and place go into the
  vault; a code they derive differently is queued as `rename`, drafted, approved, and folded
  LAST in its batch as a re-key wherever the book holds the code (`renamePairs`/`renameInBook`
  in the engine), the `-R` account with it, plus the statement key (username kept), a place
  override in `geo/places.json` and the suite's fixtures.
- **Places** (F14, 28 Sep 2026): a Maps or Waze link at Add ID or Amend ID is read on the device
  (`mapsLink`: Waze `ll=`, `to=ll.` and `/ul/h<geohash>`; Google's pin `!3d..!4d..` before a point
  in `q=`, `query=`, `destination=` or a `/search/` or `/dir/` segment, then `@lat,lng`, and the
  address from the text shared before the link, else `/place/<name>/`, never words with no letter or
  a point in degrees; an apostrophe belongs to the link, a dropped pin's minutes; Apple's `ll=`). A
  `maps.app.goo.gl` link is opened by the keyed `POST /geo/expand`, which follows one redirect with
  `redirect: "manual"` and answers the `Location`, storing and logging nothing. The point and the
  address go only into the vault's second envelope, KV `vault-addr` (`{<code>: {addr, lat, lng, src,
  at}, _base}`), sealed by `vaultEncrypt` under the names' passphrase and read and written through the
  keyed `/vault/addr`; `PLACED` keeps the locality. `wbVaultFile` reads both envelopes before writing
  either and saves the places first; an envelope the Worker cannot parse answers 500 on `/vault`
  and `/vault/addr` alike, never none, so no save seals one entry over the rest. A re-key copies
  `vault-addr[from]` to `[to]` as the name is copied. `vaultReveal` opens every envelope on the one
  passphrase it is given (names, places and the slip key) and `lockVault` clears them together.
  **The slip key (F13)** is the vault's third envelope, KV `vault-key`: `{updated, vault, pub}`, the
  private half of an ECDH P-256 pair sealed by `vaultEncrypt`, the public half in the clear. Only
  `seed-vault.mjs --slip-key` writes it (it mints, proves a probe round-trips, refuses while a key is
  filed in KV or `10_Data` unless `--force`, pushes the public half to the Counter's KV `slipkey`, and
  copies the envelope to `10_Data\salt_slipkey.json`); the Worker reads it with the key at `GET
  /vault/key` and has no write. The unlock imports it non-extractable for `deriveBits` alone, and the
  desk's `slipOpen` reads a slip `{v, epk, iv, ct}`: ECDH with the ephemeral point, HKDF-SHA-256 (no
  salt, info `salt-slip v1`), AES-GCM-256, the protocol of `slipSeal` in `tools/seed-vault.mjs`. **View slip**
  (F13, the Counter half): a claim card whose claim carries `slip` draws View slip (`slipPart`); `slipView` fetches
  the ciphertext keyed at `GET /slips/<username>/<id>` (the Worker's `slipRelay` over `STMT_SITE`, and `/slips` is on
  `sw.js`'s API list, so never cached), opens it with `slipOpen` and draws a `blob:` URL; locked, it asks for Show
  names and fetches nothing, and `lockVault` revokes every picture drawn (`slipShut`). His base point, `_base`, is Amend ID's
  first choice under Who. On the laptop: `seed-vault.mjs --addr` (refused unless the passphrase
  opens the live names vault, and, short of `--force`, while the live places hold a code the file
  lacks or an entry with a later `at`) and `pull-vault.mjs --addr` over `10_Data\salt_addr.json`.
- **An agreed order is amended after Accept** (his decision of 06 Oct 2026): the units, the goods' price and the
  delivery charge of an acknowledged or ready order, one Correction for approval (`restateOrder` in `src/orders.js`,
  `POST /orders/<id>/restate`, the Counter's `/all/maker/orders/<id>/restate` under a request id). Refused: a
  collection with a delivery charge, a size under what is handed over, a size change on an order closed short, a
  claim waiting, a total under the floor at the size, a figure under what is paid and still on its way to the row
  (`rowRoom`, until it lands), an earlier amendment not yet on the book. A figure under what is paid is taken (06 Oct
  2026): the answer carries `refund`, the card says it, and the fold opens a `customerRefunds` row for the difference as
  the Correction lands (the engine's `refundOnOverpay`, the same rule on every sale amendment, a payment over the row
  included, and on the desk's overlay). The board is never repriced; the order book's `restate`
  event moves the figures, never `closed`, and the customer reads "Amended to ...". No push is sent.
- **The delivery fee by distance** (F15, 29 Sep 2026): a delivery's card under Site orders, opened,
  and the Workbench's Delivery box on a new sale to a chosen party, opened, offer a fee worked on the
  device: `navigator.geolocation` read once, fresh (`hereNow`, kept nowhere), else `_base`; to the
  exact spot the customer shared on that order, opened on the device (`ordPinPoint`, 10 Oct 2026, `docs/STATEMENTS.md`),
  else the party's exact point in `vault-addr` (a `-R` bucket's associate's when it has none), else its
  `PLACED` locality, said as about a kilometre out (`RULES.delivery.localityFallback`, his answer at
  design); `haversineKm` times `roadFactor` at `rmPerKm`, rounded to `roundTo` (`deliveryFeeFor`).
  Only with the vault open on the phone (`feeOpen`), and on the card only once it is on screen
  (opened on the phone, or beside the list at 1080px); `lockVault` drops every offer, so an unlock
  reads again. On the card the figure fills Other on a trip's first order alone, and once that order
  is agreed no later order of the sheet takes one (a V4b sheet is one trip); the box keeps what it
  holds past a lock, and a fresh read replaces only the figure the desk put there (`ORD_PUT`). The
  line under the chips names the two points used, never a point. On the Workbench it fills Delivery
  only while that stands at nought, an R2 sale measured to the associate. His figure wins: the preview and Accept send what the box holds. A setting, not a
  price: the goods, the floor and the board never read it. The desk's `Permissions-Policy` carries
  `geolocation=(self)`, nothing wider; `_headers` is outside the build id, so it ships in a version.
- **Codes are derived** (`deriveCode`, phone and laptop alike): C or S, the name's first letter,
  the length of the saved name counting spaces, a dash, then the place's initials when it is
  several words or its first three letters when it is one; a blank place is TBC. A downstream
  buyer is `<associate>-<n>-<place>`; an associate's account is `<code>-R`. A clash takes one more
  letter of the name at a time (`deriveFreeCode`), a number only when the name is used up; on an
  amendment the party's own code counts as free.
- **The queue on load** (`qKeepOnLoad`): an entry clears only when the fold has passed it, this
  device saw it acknowledged (`qSentThrough`, seeded from the watermark), and the last good read
  of the drafts did not list it refused (`saltRefusedAts`, stored only on `r.ok`). An entry this
  device never saw acknowledged, once the fold has passed it, is flagged `stuck` and never cleared
  by itself; the drafter still drafts it, so he decides it under Approve, then Undoes the copy.
  `q.at > null` is false, so a missing watermark must never drop an entry.
- **The ten-second tick posts only what the cloud has not taken**: an entry newer than
  `qSentThrough`, or `qDirty` (set by `saveQueue`, cleared by a 2xx only when no save landed while
  that post was in flight). An emptied queue is not posted by the tick.
- **A rejection decided on another device leaves this one on its next post**: the Worker names
  each rejected stamp it dropped in `droppedAts`, and `qDropRejected` takes them out of the queue
  and its stored copy and redraws, straight to storage, so `qGen` and `qDirty` stay the answer's.
- **Loans** are rows `{date, party, direction:'in'|'out', valueKg, valueRM, status, settledOn,
  product, note}`. Borrowed in counts (`loanInUnits`) only while open; lent out counts
  (`loanOutUnits`, the Inventory walk) whatever its status, so a repayment road must add that
  filter. The fold's `loan` road only appends and rolls the stated shelf. A hand settle: set
  `status:'settled'` and `settledOn`, roll `STATED_STOCK` with the fold's own roll sentence
  prepended to `NOTES.STATED_STOCK`, write with `writeBookFile`, then `booksync --sync` and `node
  tools/ledger.mjs`. His rulings: interest paid is a finance cost and interest received other
  income, both below gross margin, salt paid as interest valued at cost; a loan is repaid in what
  was lent. A list the overlay pushes into needs a `BASE_*` snapshot and a reset, as `loans` has.
- **Rewards**: a whole free unit per stated margin brought, over the whole ledger
  (`REWARD.stated`; at v623 RM 500 for a customer, RM 470 for an associate, introduced customers'
  margin counted at a 1.2 hurdle). Oil and the other books are absent from it, so they carry no
  reward. `rewardMargin` counts priced rows that are not defaulted, through `ownerOf` (the code
  and its `-R`), plus introduced customers' rows for an associate (`introductions()`, from
  `INTRODUCTIONS` and the rows' `ref` stamps). A rebate row counts only its paid part (his
  decision of 27 Sep 2026): total less `settledRM`, less the units the reward did not take
  (`rebUnits`, which `rebateApplied` nets) at the row's own unit cost, each side floored at
  nothing; a row with neither part left is a redemption and counts nothing. Network's Margin
  brought in is the reward's own intro margin, not first orders' revenue. A departed party cannot
  redeem (`canRedeem`). A sale to a customer holding reward and under their card price offers a
  cover at entry (`coverPlan`: the gap, up to the balance, at cost; the row carries `coverUnits`
  and `coverRM`). A customer holding a whole unit may redeem one; a redemption is a sales row with
  `rebate` and `goodwill` at cost. Balances move with every fold: compute one in code before
  quoting it.

## The map (v630, replacing v293's unnamed heat)

- The core districts shaded by revenue for the product in view, a tap opening that district's
  constituencies (v678, v681) with each party a dot, and the whole peninsula a switch away. The party
  table reads each party's locality, constituency and district (`whereOf`, v680).
- `MAP_METRIC` (v635) shades by revenue, margin, units, customers or credit owed.
  `MAP_FROM`/`MAP_TO` (v636) set a period: a month off the slider, two dates, or all time,
  played month by month; credit owed in a period is what is still owed on the orders placed
  in it.
- `MAP_PICK` (v637): a district opened carries a drill panel, and a tap on one of its areas
  swaps in that area's figure, share and rank at its level, the trend month by month, and its
  parties by code.
- `MAP_NET` (v638, off by default) draws a line from each associate on the bench to each
  customer they brought in, off `introductions()`, in every view, titled by code.
- The two levels come from different surveys, which is why a party counts in the area its
  point lies inside. Six directory places were official area names on 14 Sep 2026.
- **Placing a party** (v633): the place typed at Add ID or Amend ID is looked up whole, then by
  its parts, then by runs of its words (`placeCandidates` in the engine), each wording as an
  official area name and then in `geo/gazetteer.json`: GeoNames' populated places in the core
  states, each name kept as seven hex characters of SHA-256 over its `placeKey` beside a point
  to 0.01 degrees, built by `tools/gazfetch.mjs`. A five-letter word alone counts only as an
  area name. Not found, or a name standing for places over 3 km apart, is tapped on the map
  under the form, and Record waits for the point. The point travels as `geo` on `addid` and
  `rename`, or as the collection `place` (Amend ID keeping the code, or the map's *Place
  parties from their recorded places* with the names open); the fold files it in the book's
  `PLACED`, which `placeOf` reads before a code's tail. On 14 Sep 2026 it found 33 of the
  directory's 42 recorded places.

## Deploying: the Workers Builds config (hard rule 8)

- A build lands in about a minute against the Actions job's checkout and `npm ci`, so it
  usually wins that race; the `Already serving?` guard holds back only Gate and Deploy, so
  winning no longer skips the mirror re-seed and the suite. Its worst case, the wrong build
  in front of the phone, is caught within a day by `ship-check.yml`, which does not care who
  deployed. Its build token is its own credential.
- Gate BEFORE build: `buildMatches()` rebuilds `public/` itself and fails if the committed id
  differs, so a build in front of it makes that check vacuous, and the gate leaves a verified
  `public/` for wrangler to ship.
- **The API, not the dashboard:** `GET /accounts/{account}/builds/workers/{script_tag}` with
  the `.../triggers` beside it, `script_tag` being `e85618c353ad4fd6b009cf57e05f0842`; builds
  at `.../builds/workers/{script_tag}/builds`, logs at `.../builds/builds/{uuid}/logs`, and the
  logs are the only place that shows what the build actually ran. The MCP builds tool reports
  zero where the API reports 280.
- The `master` trigger deploys; the other excludes master and uploads a version rather than
  deploying, still on the ungated `npm run build`. It is live, whatever `previews_enabled` once
  read: the version list on 3 Oct 2026 held uploads aliased to two work branches, and each PR
  shows its non-required `Workers Builds` check. From `preview_urls: false` (3 Oct 2026) such a
  version still uploads but serves no preview address.
- **Watch paths (set 26 Sep 2026, read back through the API):** the `master` trigger
  (`1ea7ed86-00d5-4e4e-8967-8074061264b4`) keeps `path_includes: ["*"]` and has `path_excludes:
  ["master/_to_fold.json", "master/_folded.json", "docs/*", "test/*", "statements/*"]`, so a stage,
  clear, docs, test or statements commit builds nothing; a commit touching any other path still
  builds, and a push of 20 or more commits builds regardless. The Actions job deploys every
  `rev.json` push anyway, and `ship-check.yml` proves live against the repo daily.

## Files, beyond the ones `CLAUDE.md` names

| Path | What it is |
|---|---|
| `src/worker.js` | `/queue`, `/vault`, `/vault/addr` and `/geo/expand` (keyed, F14), `/vault/key` (keyed, read only, F13), `/bio` dropped, `/drafts`, `/orders` (relay), `/rev`, static assets; dispatches the stage on approval, and again on the minute cron's ladder (`redispatchStale`) |
| `src/drafter.js` | Queue plus D1 mirror to a proposed row in `draft`; never writes `entry` |
| `tools/fold.mjs` | `--plan` reads `master/_to_fold.json`, refuses what it must, writes the notes skeleton; `--apply` folds all or nothing, syncs, bumps, rolls the shelf, moves the watermark |
| `tools/drafts.mjs` | `--schema`, `--list`, `--draft <file>`, `--approved`, `--committed <id>`, `--from-queue`; via wrangler, no key |
| `tools/drain.mjs` | KV to `06_Data\salt_queue_cloud.json`; `--committed <ISO>`, `--status`, `--forget`; `--status` sets each entry against `QUEUE_COMMITTED` and, where D1 answers, its draft or refusal, and lists the folded or decided apart from what is still to reach the ledger, offering `--forget` for the second alone (a device's key keeps a folded entry until that device posts again); `--retire-orders-blob` deletes the old `q:orders` blob only when empty (site stages take `q:orders:<at>`, one key an entry, and the drafter prunes committed ones; run it after seven days of `"legacy":0` on the drafter's log) |
| `tools/sort-ledger.mjs` | Date order, undated pending last; asserts a permutation |
| `tools/freenames.mjs` | Every name the page calls is defined (after v925's bare `poStat`): TypeScript's checker (`typescript`, a pinned dev dependency) over the master's inline script, each name it cannot find asked of the loaded page, less `LOADED_LATER` (`Chart`); and each inline handler's call a function. The suite runs it; by hand, `node tools/freenames.mjs [master]` |
| `tools/renderdiff.mjs` | `--shoot <label>` every part at 1280 and 375, `--compare <a> <b>`; Playwright from `Code\salt-ds\.ds-sync`; by hand |
| `tools/send-sheet.cmd` | Opens the newest `_send_*.html`; the Desktop shortcut `Send Statement` points here |
| `geo/*.json`, `tools/geofetch.mjs`, `tools/areafetch.mjs`, `tools/gazfetch.mjs` | Basemap (four state outlines, ODbL, unnamed), `places.json` (the code-tail table), since v630 `geo/areas.json`: the 91 districts of Peninsular Malaysia (CC BY 3.0) and the 41 federal constituencies of the 2018 delimitation in Kuala Lumpur (11, v678), Selangor (22) and Negeri Sembilan (8, v681), from MECo (CC0, pinned `2a720dd`), each filed under the district holding its centre; ADM3's mukim, bandar and pekan retired at v681; rings as encoded polylines at 2e-4 degrees, pinned geoBoundaries release `9469f09`; and since v633 `geo/gazetteer.json`, GeoNames' place names in the core states hashed and packed (CC BY 4.0, 55 KB). Since v682 `geo/placelist.json`: his KL neighbourhoods and Selangor sub-districts at GeoNames' points, built by `tools/placelist.mjs --from <MY.txt>` from a file downloaded by hand and never committed. The three fetch tools alone touch the network, by hand (`gazfetch --from` reads a saved `MY.zip`); geosync inlines all four |
| `public/sw.js`, `public/_headers`, `manifest.webmanifest`, `icon-*.png` | Shell cache first, refreshed behind (05 Oct 2026): an open of `/` draws the cached desk at once; the page's reloads (new build id, the chip, a new worker, a redirected refresh's `{salt:'signin'}`) go through `saltFresh` as `?fresh=1`, which is network first and takes the refresh already on its way; `/queue` never cached; a push shows the banner and posts `{salt:'wake'}` to every desk it controls, which reads the build, the drafts and the orders once a burst under the pollers' guards (the PWA block's `SALT_WAKE_MS`); CSP; icons from `Code\salt-ds` |

His banner (`banners()` in `public/sw.js`, from the keyed `/push/summary`) is one status banner under the tag `salt`, and
each line a customer writes is a banner of its own under `m-<at>`. The summary carries `lines`, the customer's lines newer
than `?since=` (none given, the last ten minutes), at most three, each cut to 200 characters and stored nowhere; the service
worker keeps its mark `since` in its own IndexedDB store beside `writeKey` and moves it once the lines are shown. The status
groups what waits by deadline, one line a group, soonest first: Now (an open refund), Today (products not counted, rows to
approve, refused entries), then the acknowledged orders still waiting on him. Nothing waiting reads All square, which is not
shown at all when a line was.

## First-time Cloudflare, and local work

`npx wrangler kv namespace create salt_queue`, paste the id over `PLACEHOLDER_KV_ID`, deploy.
The build adds only a PWA head, a service worker, a device id and cloud-mode copy.
`/queue/ping` returns `cloud:true`. The laptop desk is `Open Salt Command.bat` in the project's
`30_Published`: `serve_desk.py` serves this repo's master on port 8766 for Names & IDs and writes
`10_Data`, nothing else. Its sync passes were retired on 16 Sep 2026 (a fourth deployer, rule 8);
`salt_sync.ps1` is dormant. `npm run dev` does the preview half better.

## Desk Access boundary

The Desk Worker has a fail-closed Access verifier, ON since 6 Oct 2026 (`REQUIRE_ACCESS` `"1"`,
`ACCESS_TEAM` `maakmal`, `ACCESS_AUD` the owner application's tag, shared with the Counter's `/all`:
one application covers both hosts). The verifier accepts only an RS256 JWT whose
signature matches the configured Access team's published key and whose issuer, audience and expiry
are valid; it reads the Access assertion header or the `CF_Authorization` cookie, then requires the
verified email to match `maakmal97@icloud.com` (case-insensitive). It does not trust a header by
presence or a caller-supplied email. Invalid tokens and missing `ACCESS_TEAM` or `ACCESS_AUD` fail
closed when `REQUIRE_ACCESS` is enabled.

The application covers the Desk Worker's whole host, with an Allow policy for that email only and
the CI service token as its `non_identity` policy. Setting `REQUIRE_ACCESS` back to `"0"`, or
moving the application to a new audience without changing `ACCESS_AUD`, is a Wrangler config
change deployed by hand. The Counter's independent `/all` boundary applies the same verified-email
check; customer routes outside `/all` remain on their existing sign-in paths.

### Who passes the Desk's Access, and with what (drafted 3 Oct 2026; live 6 Oct 2026)

- **CI and `tools/update.mjs`'s `/rev` read**: an Access service token, sent as `CF-Access-Client-Id`
  and `CF-Access-Client-Secret` from `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` (GitHub
  secrets in CI, the laptop's environment, never a file), and only when both are set. The Desk app
  carries it as a `non_identity` policy. The Worker admits that verified token (`common_name` equal
  to `ACCESS_CI_CLIENT_ID`, an empty `sub`, no email) on `GET /rev` and `POST /push/send` only; the
  push still needs its own key. It opens nothing else, the vault included.
- **The vault tools** (`pull-vault.mjs`, `seed-vault.mjs`, through `tools/vault-pair-client.mjs`):
  the owner's own token alone, never the service token, so a leaked CI secret with the write key
  reaches no names or places. Before a run, with `cloudflared` installed:
  ```
  cloudflared access login https://salt-command.qyts8mh72kyg.workers.dev
  $env:SALT_ACCESS_JWT = (cloudflared access token -app=https://salt-command.qyts8mh72kyg.workers.dev)
  node tools/pull-vault.mjs
  Remove-Item Env:SALT_ACCESS_JWT
  ```
  The login opens the browser for his own sign-in; the token is sent as `cf-access-token`, the
  header the edge accepts, and is never filed or printed.
- **Wrangler tools** (`drafts.mjs`, `drain.mjs`, `stmt-publish.mjs`, `seed-vault --slip-key`) and the
  service bindings (`/stmt/rev`, `/_internal/maker/*`) do not pass the edge and are unaffected.
- **`wrangler.jsonc`**: `ACCESS_CI_CLIENT_ID` is the client id of the service token `salt-desk-ci` (set 4 Oct 2026,
  on his go), public by design. `preview_urls` is `false`, because a version's own
  preview address would sit outside the app. Nothing used one (checked 3 Oct 2026: no reference in
  the repo or the workflows; the work-branch uploads Workers Builds makes were never read, and its
  PR check reports the upload, which still succeeds). Both ride the next desk deploy; a change here alone deploys by hand.

## Provisioning a sale (V5a, his answers of 29 Sep 2026)

A sale's provision is its own ladder, counted from the handover of the goods still unpaid (the engine's `saleProvSince`,
`txUnpaidSince` else the row's date): nothing on the handover day, 25% the day after, then 50%, 75%, and 100% from day 4
(`saleLadder`, `SALE_FULL_DAYS`); a declared default 100%. The supplier's recoverable keeps `provRate` and
`RULES.fullProvDays`. Every reader of what a sale is worth goes through `provAge(s)` in the master: the walk's `ar`, each
month's `provAR`, `cashFlow`'s `dueIn`, Receivables and its chart, the phone's ageing, the forecast's cash in (its timing
stays the credit term's, from the order date), the chase and Chase first's claims. The Credit age breach says the
provision; the sale side of Boundaries' aged-receivable rule is gone, since its day 4 falls inside the hold. The desk
charges today's ladder to each order's month, so a change of ladder restates the months that still hold unpaid rows.

## The restock light and the restock date (F4, 05 Oct 2026)

- `engine/position.mjs` `restockLight(shelf, commitUnits)`: red when the shelf is under half a hundredth, yellow the moment the commitments (owed out plus agreed, nothing moved) exceed the shelf, that is free stock below what is agreed (the engine's `coverable` false), else green. `restockSupply` adds the day, kept only while the light is not green and the day is not past.
- Stock's Restock date card (Enter's until 17 Oct 2026) (and the Today row "Restock date: not set", Now on red, This week on yellow) sets one day a book through the keyed `/expected`, relayed to the Counter's KV `expected` (`{<book>: "YYYY-MM-DD"}`). The name is `expected` because `restock` is the engine's reorder plan.
- The publish (`tools/book.mjs` `supplySnapshot`, `tools/pricelist.mjs` `supplyLights`) seals `{light, by}` on each product of every customer's list, outside the digest. A date set shows at the next publish, within the hour.
- The Counter draws a coloured border on the book's mark (verdigris, amber, ember; amber is the design system's warning token, since brass is the mark's own colour and the focus colour) with Available, Limited or Out for now in its name, and "More by DD Mon" under it on yellow or red.
