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
- **Salt is the Set Price and their %** (his decisions of 05, 18 and 21 Oct 2026). `TIER_RULE.salt` carries `drift` (the
  flag that marks a book with a Set Price), `points`, `ceilingX`, `auto`, `suggest` and `presets`. **The Set Price is what a
  stranger is quoted**; since 21 Oct 2026 a customer on a negative % of his pays less, never under the Floor. The multiple of the Floor is 2.5 at half a unit,
  2 at 1, 1.67 at 6.25 and 1.33 at 12.5, sliding in the log of size between points and flat above 12.5. The engine's
  `driftWalk` walks the grid (half a unit to 25 in quarters) smallest first: the rate is the lesser of the last size's and
  `Floor * multiple * (1 + %) / q`, on the exact rate and never compounded; the price is that rate times the size, down
  to RM 5; it is then lifted so the ringgit margin over the Floor never falls below the largest margin of any smaller
  walked size, and held between the Floor (up to RM 5) and the Ceiling. The quoted rate may therefore rise by under RM 5 a
  unit between quarters: the rate law is on the exact rate. `quoteAt` and `quoteGrid` are the one rule at any size, so
  for every % in use and every grid point `quoteGrid(...).p[i]` is `quoteAt(min + i * step, ...)`, and a
  partner's `quoteAt` is the `floorTotal`, the snapshot's `floors[q]` and the drafter's `floorFor(q).floor`.
- **Their % on his curve, on every book** (22 Oct 2026). Salt's `TIER_RULE.ends` are his Floor multiples for -30% (2.00 at 0.5 unit,
  1.20 at 12.5) and +30% (3.00, 1.45); `driftMultiple(q, R, pct)` puts each end on the Set Price's own shape (the share s the Set Price
  sits between its first and last multiples) and a % at t = pct / 0.3 of the way from the Set Price to its end, so each 5% step is equal
  at every size; the walk reads it in place of the multiple times (1 + %), which a rule without `ends` keeps. Oil, candy and rice carry
  `pct` and `shares` (-30% 0.8 of the board at the smallest rung and 0.9 at the largest, +30% 1.2 and 1.09, salt's proportions, his
  answer that day): `shareAt` slides in the log of size, and `fixedWalk(sizes, C, P, d)` takes it off the board, down to the book's step,
  between the Floor and the Ceiling, the rate never rising with size. `pctBook(R)` (drift or pct) is the one gate: the snapshot's `lift`,
  `cardQuote`, `cardAt`'s `quoteOff`, the drafter, the fold's `driftBooks()` (a TIER_RULE line opening `drift:` or `pct:`), the catalog,
  `makerTierSet`, Add ID and the price list (a held non-zero % on a board is their card). The suggestion stays on a Set Price book.
  **Salt Admin shows it live**: the form takes a whole % in steps of 5 and asks `GET /all/maker/drift-preview/<code>/<book>/<whole %>`
  (relayed to the Desk's keyed `/_internal/maker/drift-preview/...`, `makerDriftPreview`, a read that writes nothing) 300 ms after he stops
  typing: now and at the typed % at the board's sizes and their usual size, beside the Floor, every figure `quoteAt` on the snapshot.
- **Their %** (`TIER_OF[code].salt`, -0.3 to +0.3 since his decision of 21 Oct 2026, `LIFT_MIN` and `LIFT_MAX` in the engine,
  held until he changes it; `cardQuote` reads it through `driftOf`). It is the move on the Set Price, a negative one a discount, applied inside the walk and the same at every size, and nought is the Set Price. **Everyone
  starts at 0%** (the held figures were removed in the 18 Oct 2026 version, and the fold drops a `tierset` or an Add ID
  figure stamped before `RULES.liftSince`, which was in the old unit, with a note, and refuses nothing for it). He sets it on the Their % card (Network), Counter
  Admin's Their % form or Add ID (presets -30%, -20%, -15%, -10%, -5%, Set Price, +5%, +10%, +15%, +20% and +30%, or another % from -0.3 to 0.3; the field
  drops the decimal pad so an iPhone shows a minus key); it is queued,
  folded as `tierset`, and a null clears it. Under about 7% a % moves nothing at half a unit to 1 unit, which the card says
  once. **Nothing automatic prices.** `autoDrift` over `driftSignals` fills the card's good and bad only. The card's
  suggestion is `suggestOf` (the engine's `suggestPct`): the median over their last five salt sales of the rate paid
  over the Set Price rate at that size, less one and not under nought, plus a share for a write-off (30%), a long late
  or 14 days overdue (20%) or a late (10%), less, with nothing late, overdue or written off, a good record's discount (`suggest.good`, 0.3, times `autoDrift`'s good
  score `G`; his answer of 21 Oct 2026), to the nearest 5%, held -30% to +30%, and nought under `minSettled` settled rows;
  `suggestWhy` says "good record". The Desk's card says it as "Suggested +10%: paid late"; Salt Admin's Use the suggestion fills the
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
  partner is quoted at 0%, so the IAS 2.9 test can bind; the Ceiling is never the basis, nor a customer's discount (21 Oct 2026).
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
  +5% ... +30%"). No tier, level or drift word is visible on the Desk, Salt Admin or the Counter;
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
  Salt Admin's Add another book carries the same extra-book figures through its dedicated
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
  large, consistent mid, occasional mid) and five flags: `frequent`, `small`, `bigger`, `loyal`, `rare`.
  The thresholds are one constant, `PROFILE_RULE`, cut from the book on 16 Sep 2026: the median
  customer then bought 1.83 times a month, one and three units were the lower and upper quartiles of size,
  and the whole book was under three months old, so loyalty is counted in orders rather than time. Orders a
  month are read over at least 30 days, or every new customer arrives frequent. **Late** is an order paid
  past `RULES.creditDays` (10) or still owed past it; a write-off is not counted, having its own rule (the Credit
  age breach and Today's chase count instead from the handover, past `RULES.holdDays`, as the Counter does). On
  the book that day: small and often CR3-DAM, CA4-DAM, CC5-OKR; loyal eight. CH5-KLC,
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
## The associate reward (his rules of 20 Oct 2026)

- **The walk** (`engine/position.mjs` `rewardWalk`, read by `rewardAccount` for an associate once `REWARD.stated.salt.associate` names `times` and
  `since`): from each associate's stated opening in `REWARD_OPEN` (`{earned, share, upTo, on, pend}`: the old count's units and share, the newest
  rid it read, the day, their rows Pending then), their own and `-R` salt rows count once paid in full (`txDates.fullPaid`, on `pOn`, then rid), each
  its goods less its units at the row's own cost; a gift's cost comes off on its delivery day; a redemption, a reward row and a written-off row count
  nothing; an introduction no longer counts (Ask 1). A unit is earned each time progress reaches `times` x the crossing day's `latestCogs` (the
  lesser of that and the row's `rwdStep`). `given` sums `listRM` less the goods since the last crossing. The Desk's Network card and rule text read it.
- **The openings**: `node tools/reward-open.mjs --since YYYY-MM-DD` writes them once, refusing a book that has them and refusing if anyone's held or
  whole % would move; the frozen fixture carries its own. A party who becomes an associate after the switch is opened by the fold that day.
- **The fold's unit** (`engine/apply.mjs` `rewardFold`, after every entry, needing `ctx.reward` from the extract): due is the walk's crossings less
  every `rewardOf` row of theirs, cancelled included; each due unit is a row `{qty: 1, total: cost, settledRM: cost, rebate, rebateKg: 1, goodwill,
  rewardOf, auto, given}` at the crossing day's rate. The entry that hands salt to them delivers each unit whose order is handed over in full, and
  its unit joins the roll (`unitMoves`). STALE is said, never withdrawn: remove the row in `ledger/book.json`. A reward row is out of the delivery
  share, the mean delivery and the card list's order, so the pricing snapshot does not move.
- **Their price** (`src/drafter.js` `listStamp`): from the switch every salt sale carries `listRM` and `listQty` off PRICING (`PRICING_ENGINE.cardAt`);
  the fold stamps a restated size again off the extract's PRICING.
- **The verdict and his reading** (`engine/stages.mjs` `rewardReading`, `rewardCrossOf`, `rwdOf`): Accept stamps `entry.rwd` "cross" and
  `rwdStep` when the order's margin on the walk's PAID progress reaches today's step; both digests name the word only when set. The return leg
  (`tellSite`) marks "given" once a reward row names the order's row, terminal, and clears a cross another order or an undone payment took away,
  never on a lot. His figures: `GET /all/maker/reward/<ledgerKey>` (the Desk's `/_internal/maker/reward/<key>`, bridge key), a read.
- **Customers** (P8): `rewardAccount` reads `redeemable` false for a non-associate from the switch and `inputResource` refuses every spend; their
  count stands on the rows it read at the switch (`rewardCut`). No basis (the loyalty plan's Ask 4).

## The customer loyalty unit (his rule of 20 Oct 2026, docs/plan-loyalty-unit.html)

- **The walk** (`engine/position.mjs` `loyaltyWalk`, `REWARD.stated.salt.loyal` `{every, since}` in the master): a customer's own salt rows from
  `since`, in `pOn` then rid order, each counting its final qty once paid in full, at or above their price (goods against `listRM` over `listQty`;
  no stamp, nothing), with every handover dated, and not paused that day. Paused is a write-off dated on or before the day (`defaultedOn`, else
  the row's newest Correction from its first handover, else that handover plus the lock) or V5b2c's late rule over the delays as they stood that
  day. A gift, a redemption, a reward or loyal row and a written-off row count nothing; an associate, a partner, a supplier and a bucket do not
  walk. `cadenceOf` is the desk's `custCadence`, moved into the engine.
- **The fold's unit** (`engine/apply.mjs` `loyalFold`, beside the associate's): due is the walk's crossings less their `rewardOf` and `loyal`
  rows, cancelled included; each is `{qty: 1, total: 0, cost, cash: 0, goodwill, deliveredQty: 0, rewardOf, auto, loyal}` at the crossing day's
  `latestCogs` (none with no lot landed). `rewardFollow` hands it over with its order and flags STALE with the walk's reason; one raised before
  they were made an associate is still handed over. A loyal row is out of a customer's reward margin and every spend. The fold reads the
  extract's `TERMS` beside the scheme.
- **Accept and the word** (`engine/stages.mjs` `loyalReading`, `rewardCrossOf`, `rwdOf(book, row, now, today)`): previewAck stamps `rwd` "cross"
  and `rwdLoyal` when this order at or above their card takes their paid units to the next `every`, not while paused today; the drafter puts
  `rwdLoyal` on the Pending row, so both digests name it as part of the row. The site carries the same one word as the associate's.
- **What they see and he reads**: `tools/book.mjs` `customerCard` (over the master's `loyalWalkOf`) seals `{products: [{product: "salt", loyal:
  {next}}]}` for every roster customer at publish; the Desk's Customer rewards card names the rule and a Loyalty column. Salt Admin's This
  customer card reads `GET /all/maker/customer-reading/<ledgerKey>` (the Desk's `makerCustomerReading`, a read behind Access and the bridge key).

## The desk

- **Counter maker bridge**: the owner works in Salt Admin's Orders, Customers, Record and Shop places (one Maker place until 11 Oct 2026). `/all/maker/*` is
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
- **Operating hours**: Salt Admin writes `maker:hours` in the Counter KV. The public `/hours`
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
  (F13, the Counter half): a claim card whose claim carries `slip` draws View slip; `slipView` fetches
  the ciphertext keyed at `GET /slips/<username>/<id>` (the Worker's `slipRelay` over `STMT_SITE`, and `/slips` is on
  `sw.js`'s API list, so never cached), opens it with `slipOpen` and draws a `blob:` URL; locked, it asks for Show
  names and fetches nothing, and `lockVault` revokes every picture drawn. His base point, `_base`, is Amend ID's
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
- **A refund becomes their credit** (his word and answers of 27 Oct 2026, `docs/plan-refund-credit.html`). Every open
  `customerRefunds` row of theirs (no `paidOn`), on their own code or their -R bucket, overpays and cancelled orders alike, is
  credit: the engine's `creditOf`, less what every unfolded Accept carries (`src/credit.js` reads the drafts on their way by the
  book's bound and the orders queue; a rejected draft releases it). His Accept spends it (`previewAck`, `withCredit`): up to goods
  and delivery together, booked on the pending row as `cash` with `credit` beside it, the price, the Floor and their % untouched;
  an order for a friend spends none; paid in advance is judged on what is left. The fold closes what is spent (`setOffCredit`):
  oldest first, a part split keeping its rid, each closed part `paidOn` the row's day and `setOff` its rid, a replay changing
  nothing; credit no open refund covers comes off the row's cash (CREDIT SHORT) and the return leg lowers the order's. The
  Counter order carries `credit` apart from `paid`; `dueOf`, the return leg (`rowPaidFor`), the tie-out and the claims read it.
  **Money received by book is `bookCash`**, the row's cash less every refund on its rid, so s296 reads RM 455 on salt; cash flow
  is the till, raw cash in and refunds in `refPaid` (a set-off named), the s190 and s191 precedent. `refundStale` flags a set-off
  whose row was later paid less. Paid out in cash, the hand road stays: `paidOn` in the book.
- **The delivery fee by distance** (F15, 29 Sep 2026; the Desk's Site orders card left on 18 Oct 2026): a delivery's card, opened,
  and the Workbench's Delivery box on a new sale to a chosen party, opened, offer a fee worked on the
  device: `navigator.geolocation` read once, fresh (kept nowhere), else `_base`; to the
  exact spot the customer shared on that order, opened on the device (`ordPinPoint`, 10 Oct 2026, `docs/STATEMENTS.md`),
  else the party's exact point in `vault-addr` (a `-R` bucket's associate's when it has none), else its
  `PLACED` locality, said as about a kilometre out (`RULES.delivery.localityFallback`, his answer at
  design); `haversineKm` times `roadFactor` at `rmPerKm`, rounded to `roundTo`.
  Only with the vault open on the phone (`feeOpen`), and on the card only once it is on screen
  (opened on the phone, or beside the list at 1080px); `lockVault` drops every offer, so an unlock
  reads again. On the card the figure fills Other on a trip's first order alone, and once that order
  is agreed no later order of the sheet takes one (a V4b sheet is one trip); the box keeps what it
  holds past a lock, and a fresh read replaces only the figure the desk put there. The
  line under the chips names the two points used, never a point. On the Workbench it fills Delivery
  only while that stands at nought, an R2 sale measured to the associate. His figure wins: the preview and Accept send what the box holds. A setting, not a
  price: the goods, the floor and the board never read it. The desk's `Permissions-Policy` carries
  `geolocation=(self)`, nothing wider; `_headers` is outside the build id, so it ships in a version.
- **Codes are derived** (`makerDerivedCode`, on Salt Admin): C or S, the name's first letter,
  the length of the saved name counting spaces, a dash, then the place's initials when it is
  several words or its first three letters when it is one; a blank place is TBC. A downstream
  buyer is `<associate>-<n>-<place>`; an associate's account is `<code>-R`. A clash takes one more
  letter of the name at a time (the same function), a number only when the name is used up; on an
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
| `tools/drain.mjs` | KV to `10_Data\salt_queue_cloud.json`; `--committed <ISO>`, `--status`, `--forget`; `--status` sets each entry against `QUEUE_COMMITTED` and, where D1 answers, its draft or refusal, and lists the folded or decided apart from what is still to reach the ledger, offering `--forget` for the second alone (a device's key keeps a folded entry until that device posts again); `--retire-orders-blob` deletes the old `q:orders` blob only when empty (site stages take `q:orders:<at>`, one key an entry, and the drafter prunes committed ones; run it after seven days of `"legacy":0` on the drafter's log) |
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

`npx wrangler kv namespace create salt_queue`, paste the id into the `kv_namespaces` entry of `wrangler.jsonc`, deploy.
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
- **A light turning wakes the Desk once** (19 Oct 2026, `tools/stmt-publish.mjs` `stockWake`): the publish keeps the lights it sealed in the Counter's KV `stocklights` (`{<book>: light}`, in the same bulk put) and, when a book turns yellow or red from a better colour, posts `{"tag":"stock"}` to the Desk's `/push/send` with CI's `SALT_PUSH_KEY` and the Access headers, after the put. A light that holds or gets better, and a book the last publish did not light (a first run, an unread store), posts nothing; no key posts nothing; a failed post is a line in the log. No book, code or figure travels.
- The Counter draws a 3px coloured border on the book's mark (verdigris, amber, ember; amber is the design system's warning token, since brass is the mark's own colour and the focus colour) with Available, Limited or Out of stock in its name and, since 22 Oct 2026, in words under it (the system's `salt-status` in the light's token, `.supst`), and "More by DD Mon" under it on yellow or red.
- **Made plain** (22 Oct 2026, his word: the outline alone was missed; `docs/plan-restock-light.html`): Counter Home's **Availability** (`homeSupply`, above New order) is a row a lit book, its mark in the border and the light in words, More by under yellow or red, no figure; a row opens Prices at that book. Salt Admin's **Stock by book** (`drawStockBooks`, under Needs you's glance) is every book, the worst light first then the least cover, with its shelf, agreed, free, days of cover and next lot; the light is `STOCK`'s own (`stockSnapshot` asks the engine's `restockLight`, carried by `makerStock` and `stockWithDates`), and the card is read again on each tick of the Needs you poll. The word stock may stand on the Counter (his word of 22 Oct 2026, reversing F4's ban).

## The Book: recovery (S2c, 20 Oct 2026)

The Book (`src/book.js`) is a SQLite Durable Object, and the platform keeps 30 days of its history: a bookmark names a point,
`onNextSessionRestoreBookmark` arms it, and the next start (after `abort`) opens the storage as it stood there. The arm hands back
an undo bookmark, so a restore can itself be undone. Recovery is per object: one object's history cannot be put into another.

- **The proof runs on the TEST object** (`PITR_NAME`, `book-pitr-test`), of the same class and namespace, never on the live Book.
  `.github/workflows/book-pitr.yml` (Book recovery test), dispatched by hand, runs `tools/book-pitr.mjs`: it loads the book at an
  earlier fold (A, the newest whose book differs from the tip's, or `from`) and the tip's (B), restores to A and reads it back
  against git at A, restores forward to B and reads it back, clears the test object whatever happened, then reads the live Book's
  window. The object answers a recovery verb only when its own id is the test name's, and the Worker's `POST /book/pitr` names
  the test object and nothing else. Its line carries short shas and counts, never a bookmark or a row.
- **Every fold's log carries the live Book's restore point**: the chain's Load step ends `restore point <bookmark>`, the bookmark
  taken after the load is synced, so a restore lands on a fold. `getBookmarkForTime` is approximate; use the fold's.
- **Restoring the LIVE Book has no route, by design.** It is a hand step and his yes first (one line: restore the live Book to the
  fold of <date>, reversible by its undo bookmark). Add two one-off owner-only verbs on the live object, called seconds apart: `arm`, which
  arms the chosen restore point and answers the undo bookmark (keep it: it is the way back), then `restart`, which aborts the
  object, so its own answer is lost. An armed restore also lands on the next eviction, so never leave an arm standing without
  its restart. Deploy, call the two, read the Book back with the next `node tools/book-load.mjs`
  (its parity against git at that fold), then remove the verb in the next version. Until S5 git is the source, so the simpler
  repair is the load itself: the next fold, or `tools/book-load.mjs` from a checkout, puts the live Book level with git.

## The Book: read (S3, 25 Oct 2026)

The Desk's readers can read the Book (`src/book.js`) instead of the D1 mirror. D1 stays seeded as the check, and git stays the source until S5.

- **The flag** is one row in D1, `book_read` (`migrations/0018`), `'d1'` or `'book'`, and it ships as `'d1'`. `readBook` (`src/drafter.js`) reads it with each book it
  reads (`src/book-read.js`). The way back is one statement and no deploy, either way:
  `npx wrangler d1 execute salt_ledger --remote --command "UPDATE book_read SET mode='d1' WHERE one=1"` (and `'book'` to turn it on). A store before 0018, an
  unbound Book, a Book with no snapshot, an answer that fails: the mirror is read.
- **A Book that trails the mirror is never read.** The Book is loaded after the mirror is re-seeded, so after a fold there are seconds, and after a failed load
  hours, when the mirror holds a newer version. `readBook` compares the Book's version with the snapshot's and reads the whole book from the mirror when the Book is
  older, so a failed load costs speed of arrival and nothing else. The laptop's `tools/update.mjs` does not load the Book, so a hand fold also leaves it
  behind until the next chain run, and the readers read the mirror meanwhile.
- **"On its way" is the book's own bound** (`src/way.js`). The chain marks a folded draft committed, re-seeds the mirror, then loads the Book. A book read from the Book
  carries `at`, the moment of that Book's latest load, and a draft marked committed after `at` is on its way while one marked at or before it is in the book. The bound
  is taken from the SAME read as the book (rowRoom, the claim flow, the drafter and the tap handlers read the book first), so a tap whose reads straddle a load cannot
  count a payment twice or miss it. A book read from the mirror carries no `at` and every clause is the one it always was (`committed_at IS NULL`, or after
  `snapshot.at`). Only the "on its way to a reader" questions moved. "Awaiting the fold" (the redispatch count, the drafts view, the phone's queue status, a trip's
  siblings under Approve) and the input-admission lifecycle stay on `committed_at`, and `test/book-read.mjs` pins the count of such literals.
- **What the Book holds for it.** `rows.seq` (a row's place in its list, so every list reads back in the book's order), the derived documents `OPEN`, `TERMS`, `REWARD`
  and `STOCK` beside `PRICING`, `__arrays` (the length of every list, so an empty list is still a fact), and one `snap` row (version, stamp, moment of the load). `GET /read`
  and `GET /at` answer on the live Book only (404 on the recovery test's object and the live-socket object), and the Worker has no route for them: only `readBook`
  and the readcheck reach them, through the binding. The answer carries cost, so it is never a CI route.
- **A load of an older version is refused** (409, nothing written, a red step in the chain): readers key "on its way" off the moment of the latest load, so a laptop run
  posting last version's book would otherwise advance it past a payment the Book does not hold. The same version is the idempotent replay.
- **The readcheck** (`GET /book/readcheck`, a CI route behind the Book's key; `tools/book-readcheck.mjs`, the chain's step after the load, continue-on-error) reads the
  mirror's book and the Book's side by side whatever the flag says and answers by NAMES whether they agree: sales and purchases and every state key, in order. STOCK is
  left out (the mirror's seed leaves it out of its own hash), PRICING.takenAt and OPEN.at are ignored. A difference is a red step and never blocks the fold.
- **Turning it on** (his call): read the chain's readcheck line green over a fold or two, then set the flag to `'book'`. Watch the next fold's log: the readcheck still
  green, the Book at the mirror's version. Leave `input-admission` and the site-follow marks (`tellSite`, `tieOut`) on D1: they read the mirror's snapshot version
  and the Book is never ahead of it in practice.
- **Known gaps, said.** A draft marked committed outside a deploy (the stage's replay-clear, `drafts.mjs --committed` by hand) stays on its way until the next load that
  lands, as it stayed on its way until the next seed before; rowRoom may refuse a legitimate payment on it meanwhile (the fail-safe side). The site-follow helpers (`fate`,
  the flight checks) take the bound from a two-second memo of the Book's latest load, not from the read they follow.

## The Desk's live object (L1, Speed Wave 2, 21 Oct 2026)

- **What it is.** A third object of the Book class, named `live` (`LIVE_NAME` in `src/book.js`), holding no book: it accepts the Desk
  page's WebSocket (hibernating, tag `desk`, at most 16, the oldest closed for a seventeenth) and tells every one the KIND of thing that
  moved, `{"k":"orders"}`, `{"k":"drafts"}` or `{"k":"rev"}`, and nothing else: no id, row, name or figure. On it `/load`, `/pitr` and
  `/window` answer 404, and on the Book and the recovery test object `/live`, `/tell` and `/rev` do. A message from a socket only asks:
  the ping is answered by the platform, the third other message closes it 1008, and none reaches a load or a recovery verb.
- **The road.** `GET /live` sits after the Access gate and asks `ownerAccess` itself, whatever `REQUIRE_ACCESS` says (401 otherwise); it is
  not in `CI_ROUTES`, so the service token never reaches it. It wants `Upgrade: websocket` (426) and an `Origin` equal to the Desk's own
  (403, the cross-site check, since a WebSocket skips CORS and rides his Access cookie), and a bound Book (503). CSP stays
  `connect-src 'self'`; a same-host `wss` matches it.
- **The tells**, each through `liveTell` (`ctx.waitUntil` where a ctx exists, errors swallowed, the poll being the net): `drafts` after any
  drafter pass that drafted or decided a row (`draftedTold`) and after an approve or reject; `orders` after a reconcile that queued or
  dropped a stage and after an order tap the Desk relays (a status or a handover; a line on the thread moves nothing); `rev` once a minute
  from the cron with the build id the Worker serves, which the object tells only when it differs from the last it was given.
- **The page** (`tools/build.mjs`, the freshness block, so the build id covers it). With `SALT_CLOUD` it opens `wss://<host>/live`. On hello the
  `/rev` poll falls from 10 s to 60 s and a ping runs every 45 s with a 5 s pong deadline; on close the poll is 10 s again. `rev` reads
  `/rev` at once; `drafts` and `orders` run the existing wake 300 ms later, once a burst. A close is retried after 1, 2 and 4 s, then not
  until the page is shown (`visibilitychange`, `pageshow`), which also pings a socket that is up. A reconnect that reaches hello reads
  `/rev` once. TODAY is a live read: each tick compares the Kuala Lumpur day the page was drawn on with now, and a new day loads an idle
  desk fresh or offers the chip "New day". Proof: `test/live-desk.mjs`, with `test/live-desk.mutations.json`.

## The Book: tap (S4a to S4c dormant in v1285; S4d the tap itself, shipped off, 27 Oct 2026)

A tap will book the row in the Book at once. S4a to S4c are the dormant half: the Book can book an ENTRY, the fold takes what it booked, and the readers count a booked draft once. No road calls the Book's `tap` yet, so nothing reads or books differently until S4d ships the tap, off, and he turns it on. Design: `s4-design.md` (side-session notes), Fable's review of 27 Oct 2026 applied; his answers: two versions with his go before each, the drafter's cost stands for a booked purchase, a Book behind or down at a tap approves as today, the Desk page's own copy of the law (`ovNew`, `ovAmend`) waits for S5.

- **Entries beside an untouched base.** `booked` (`src/book.js`): one row a draft (`draft_id`, the staged `item`, the `rids` it minted in order, the `day` of the tap, `folded_at`, `voided_at`). The base (`rows`, `state`) stays git's book as of the latest load and is written by a load alone, so S2's parity and S3's readcheck keep their meaning. The VIEW is the base with each open entry replayed in booked order through the engine's own `planBatch` and `applyEntry` (`bookEntry`: no rule of the Book's own), each with its minted rids forced, then sorted as the fold sorts. `/read` answers the view while any entry is open (naming them in `booked`, and any it cannot take in `stuck`) and the base byte for byte when none is; `/read?base=1` is always the base (the readcheck's side); `/at` carries `booked` and `stuck` too.
- **The verbs** (`/tap`, `/void`, `/events`; binding only, never a route, never in `CI_ROUTES`, live Book only): `tap` books every item of one tap or none (a trip is one call), idempotent by draft id, one synchronous transaction. Answers: booked (with the rids and the booked order `seq`); `foldOnly` (a roster entry, a rename, a Counter trade naming a party the book lacks, and so any trip holding one: the fold's alone, as today; the username pool lives in git); a 409 `refused` with the plan's own reasons and nothing written; `fallback` when the Book cannot book now (no snapshot, behind the mirror's version, an earlier entry stuck: the caller approves as today). `void` takes an open entry back (a rejection).
- **A load closes the entries the fold took**: by D1's word (`handleBookLoad` names the open entries whose drafts are committed, `?folded=`) or because the new base holds every rid the entry minted. The rest stay open and replay on the new base. An entry the new base can no longer take is left out of the view and of `booked`, so its draft counts as on its way once, and is named `stuck` by the load line, `/at` and the readcheck: red, never silent, never a failed read.
- **The tap check** (the load line's `tap: N closed, M open`): the view before the load against the view after it, for the entries it folded: the rows they minted always, and, when the batch was nothing but entries (`?pure=1`, no other draft committed since the previous load), every list and document but NOTES and QUEUE_COMMITTED (stock, counts, loans). A difference is named and the step goes red, never blocking the fold.
- **The fold** (`engine/apply.mjs`, `tools/drafts.mjs`): a staged row that carries `row.rids` was booked by the tap. The fold copies those rids in the order minted (generated reward and loyalty rows included), refuses a rid already on the book or named twice as `would be a replay` (so the replay check clears the handoff), counts every staged rid as taken when it mints for a row the tap did not book, ignores the model's `n.cost` for a booked row (the drafter's cost stands), leaves `rids` and `booked_seq` off the row, and reads booked rows by `row.booked_seq` before the rest by when they were drafted (`APPROVED_SQL`): the tap order is the event order, so a count tapped before a sale it was drafted after stands.
- **The readers count once** (`src/way.js`, `src/book-read.js`): the view already holds a booked draft's row, so the draft stops being "on its way" to that reader, whatever its status. A book read from the Book carries `booked` (draft ids) from the same read as `at`; `boundOf` is the plain `at` with none open and `{at, booked}` with some, every helper taking either, and `unfolded` and `onItsWay` add `AND id NOT IN (...)` (ids spliced after a shape check). `landedBy` stays on `committed_at`, the fold's own question, so a Counter is told a row landed only when git has it. With no entry open every clause is byte for byte S3's.
- **S4d, the tap (`src/book-tap.js`; flag `book_tap`, migrations/0019, SHIPPED OFF; turning it on is his call).** With the flag on, an approval books the row first and writes second. `decideDraft` (one tap, decide-many's every card, and so Salt Admin's Confirm) and `applyPre` (his pre-approval spent on a row) ask the Book to `tap` the tapped row and its trip's pending rows; the answer's rids and booked order are written into each draft's `row` (`$.rids`, `$.booked_seq`) in the SAME D1 batch as the approvals, so the fold finds them staged. **The D1 flip is the arbiter**: an entry whose draft did not become approved (a batch that threw, a tap that lost a race to a rejection, a trip sibling decided meanwhile) is voided (`voidUnlessApproved`). A refusal by the law (the plan's own reasons: a twin, a payment past what the row owes, a trip with two deliveries) is a 409 `the Book refuses it: <why>` with nothing written and the draft pending (decide-many says it with its fix; `applyPre` marks his yes `differs` and leaves the draft under Approve). What the Book will not book approves **as before**, with no entry: behind the mirror, silent, unbound, holding a stuck entry, an old object, and what is the fold's alone (roster, rename, a party not on the book, any trip holding one).
- **A rejection takes the entry back first** (`voidEntries`, in `decideDraft`, flag on only: with it off a rejection never calls the Book, byte for byte as before). With the flag on, a Book that will not take it back stops the rejection with a 503 and the draft stays pending. The two other writers of `pending -> rejected` (a claim not found, a withdrawn order, `src/orders.js`) do not void; the minute net does (flag on), and the readcheck names an entry whose draft was rejected, or is still pending (a batch and its void both failed), whatever the flag says. A rejection that races an approval can leave a draft approved with rids and its entry voided: the readers still count it once (on its way) and the fold takes the rids it carries.
- **The minute net** (`bookNet`, in the minute cron after the publish dispatch; flag on only): voids the open entries of rejected drafts, and books approved uncommitted drafts that have no booking (they fell back at the tap, or the laptop's `drafts.mjs --approve` approved them) the way a tap would, a trip whole, in the order DRAFTED (the order the fold mints in), at most ten groups a minute. `ridStmts` writes under a row only while it has no booking and no `committed_at` (`fresh`). **A row a chain run has already staged can still be booked under it** in the moment between its read and the mark: the load then closes the entry by D1's word and the tap check names the rid that differs, red and never blocking.
- **Two minters, one rid (Fable's finding 1).** The Book mints from its own base; the fold mints for rows it books without a booking (fold-only rows, fallbacks). A row staged by a chain run and not yet loaded into the Book is unknown to a tap in that window, so the Book can mint the rid the fold is about to mint for it. The fold now treats a booked row's rid as a replay only when the row under it IS that row (party, date, qty, total); under another row the booking is stale, its `rids` and `booked_seq` are dropped and the row is booked afresh (the drafter's cost no longer stands for it: the model's note applies, as before S4). The Book's entry stays stuck (named by the load line and the readcheck) until D1's word closes it, and the tap check names the rid that differs: red, never blocking. Nothing counts twice meanwhile (a stuck entry is on its way). Taps fall back to approving as before while an entry is stuck.
- **Said, not fixed.** A pre-approval a law refusal turns into `differs` shows no reason on its order card (the reason is only on the card's own 409 under Approve, and a later approve of the same row loops while the law refuses it). Decide-many at 50 cards adds about three subrequests a card (the tap, the flag read, the snapshot read), roughly 150: unverified under the 1,000 limit on a live batch. Every tap rebuilds the view and replays the open entries in the Book (no memo for a tap): quadratic in open entries, fine at today's scale.
- **Way back, no deploy:** `npx wrangler d1 execute salt_ledger --remote --command "UPDATE book_tap SET mode='off' WHERE one=1"`. Entries already open stay and are folded normally with their rids; `book_read` is untouched. **Turning it on:** apply `migrations/0019_book_tap.sql` ALONE to the live D1 before the deploy that reads it and read the row back (shipped `off`); then `SET mode='on'`, tap one real row, and read the next chain run's load line (`tap: N closed`), the readcheck and the tap check before leaving it on. Not built, said: `liveTell("booked")` (the live socket's kinds are `orders` and `drafts` and the Desk page has no reader for another until S5); an Admin banner for a Book refusal beyond the card's own reason.
- **Known gaps, said.** `tools/update.mjs` (a hand fold) does not load the Book (the key is CI's), so the Book trails and a tap falls back until the next chain run. A draft marked committed outside a deploy closes its entry only when the load carries its rid or D1 names it. The Worker's `planBatch` has no master text: renames are never booked at the tap, and `driftBooks` is read off `engine/rules.mjs` (`DRIFT_BOOKS`, pinned equal to the fold's by the suite). A cost the plan derives (`latestCogs`) can differ if a lot lands between the tap and the fold; the tap check names it.


## The Book: revision, compaction and export (S5a and S5c, 28 Oct 2026; dormant: nothing reads any of it)

Part 1 of the S5 plan (`docs/plan-book-s5-s6.html`, Fable's review of 28 Oct 2026). It changes nothing a reader sees.

- **The revision** (`snap.rev`, `src/book.js`). A monotonic integer that moves with what a reader could see differently: a load that added, revised, removed or returned a row or a document or closed an entry; a tap that booked an entry; a void that took one back; a compaction. Not an idempotent load, a tap seen again or refused, a void of nothing, or a load refused as older. It is carried by `/at` as `rev` and by a load's answer as `bookRev`, and the chain's readcheck line says `Book rev N`. A Book that held a snapshot before S5a gains the column at 0. The version stays a git version and is judged as before; the revision is what will judge staleness once approvals are not versions (S5f), and no test reads it until then.
- **Compaction** (`compact`, the verb `POST /compact`, binding only, never a Worker route). The Book's own view (the base with every open entry replayed) becomes the new base by the SAME `prepare` and `load` as a git load, with every open entry closed in that transaction. It is STRICT: the load's own tap check must find the view unchanged (the rows the entries minted, and the stock, counts, loans and the two lists), no entry stuck or left open and no row lost, or the whole transaction is thrown away (`Refused`) and the Book is as it was. A stuck entry refuses it before any write. It answers `closed`, the draft ids it closed: **the flip marks exactly those committed in D1 in the same step**, or a reader counts their money twice (the base holds the row, and with the entry closed the draft is no longer excluded from "on its way"). A retry after a failure past the commit answers `compacted: 0`: that is success. The entries are kept, closed: they are the event log. **It is not run live before the flip.** `/compact?dry=1` runs the same load and unwinds it (`DryRun`), and the readcheck asks that dry run on EVERY call, so each fold rehearses the one write that matters at the flip: its line says `compaction would hold over N open entries`, and a compaction the Book would refuse makes the step red (a stuck entry is named once, as stuck).
- **The event log** (`allEvents`, `/events?all=1`, binding only): every entry the Book ever booked, open, folded or voided, in booked order, as staged. The Book never deletes one.
- **The export** (`exportAll`, `/export`; `runBookExport` in `src/backup.js`). Nightly in the backup's own cron (02:30 MYT, after the D1 dump, a failure of one never stops the other), the base as `/read?base=1` answers it, the whole event log, the revision and the last 30 loads are sealed to the backup's public key (same primitives and info string, so the same private key opens it) and filed in R2 as `bookexport/<Kuala Lumpur date>.json`, read back, the newest 30 kept, the night remembered in KV `bookexport:last`; the morning digest says so when it never ran, failed, or is over 36 hours old (`bookExportAlarm`). `node tools/backup-open.mjs <file>` opens either kind (counts, and `--out` for the plaintext). Until S5 the Book is a copy of git's book plus the entries a tap booked; after it, this is the only copy beside the platform's 30 days of point-in-time recovery.
- **A fallback is counted.** An approval the Book would not book (behind, silent, unbound, a stuck entry) is approved as before and now logs `tap fallback <draft>: <why>` (also his pre-approval), so a Book that quietly refuses for a day does not look like a healthy day. The S5f gate is zero of them.
- **Way back:** nothing to undo (nothing reads any of it). Stop the export by unbinding `BACKUP` or removing the cron; the column stays.


## The Book: a booked sale tells its order at once (S6, 28 Oct 2026; flag book_outbox, SHIPPED OFF)

Part of the S5 and S6 plan (`docs/plan-book-s5-s6.html`). It changes nothing while the flag is off, and turning it on is his call.

- **A row is a durable trigger, not a message.** The explorer's map of the order path showed why the plan's outbox of messages with an event id was the wrong shape: the order book already takes the return leg's messages without an id (they are state, raise-only, and a repeat answers `again`), the order book's id format rejects the planned id, and half of what the return leg does has no `orderId` to key on (cash he types on the desk, a claim against the account, a hand fold). So `Book.tap()` writes one row of the Book's `outbox` (`seq`, `draft_id`, `at`, `sent_at`, `tries`, `err`) in the same transaction for each entry it books whose collection is `sales` (a new row or an amendment, with or without an order), and the Desk answers the rows with the return leg it already has.
- **The drain** (`src/outbox.js` `drainOutbox`, flag D1 `book_outbox`, migrations/0020, shipped `off`; a store before it reads `off`). With the flag on it runs right after an approval (`afterApproval`, once after a decide-many, off the request with `ctx.waitUntil`) and in the minute cron before the regular return leg: it reads the pending rows, drops those whose drafts were rejected or are missing, leaves those whose drafts are still pending in D1 (the tap booked, the approval's batch has not landed), and for the live rest runs ONE forced pass, `tellSite(env, undefined, mirror, {force: true})`. A clean pass (no refused order, no throw) marks the live rows sent; a pass with a refusal marks none, counts the try and keeps the reason (200 characters), and the next minute tries again. The verbs (`GET /outbox`, `POST /outbox/done` and `/outbox/fail` with `{seqs}`) are binding only and refuse a body that is not at most 500 integers; marking rows moves no revision, and the export carries every row and whether it was sent.
- **The forced pass** (`tellSite`'s `opts.force`) skips the "already told this version" exit, so it runs on a version the Counter was already told of, and it leaves `orders:told` and `orders:toldFailed` to the regular pass, which owns them: a clean forced pass does not move the mark past a fold it never read and cannot hide the regular pass's fault from the tie-out. The regular pass is unchanged, still runs when a fold changes the version, and stays the net for everything no tap booked (a hand fold, `rwd`, a phone's undo, the fixes).
- **What it does not do, said.** It does not retire any part of the return leg. After the flip (S5f) approvals stop moving the version, and the regular pass is then keyed on the revision instead of the version; the outbox is what keeps orders told in the meantime. A tap booked but not yet approved in D1 tells nothing, and a rejected one is dropped, so an order is never told "paid" for a row that did not book. The old rule that the Counter hears of a row only when git holds it (`src/way.js` `landedBy`) is deliberately not applied to a drain with the flag on: the Book is the ledger from the flip, and before it the message is the same raise-only state a fold would send a minute later.
- **Way back, no deploy:** `npx wrangler d1 execute salt_ledger --remote --command "UPDATE book_outbox SET mode='off' WHERE one=1"`. Rows stay in the Book and are drained, or not, when it is turned on again. **Turning it on:** apply `migrations/0020_book_outbox.sql` ALONE to the live D1 before the deploy that reads it and read the row back (shipped `off`); then `SET mode='on'`, approve one real payment on an order and watch the customer's order show it within a minute; the Worker log says `outbox: {"ok":true,"sent":N}`.


## The Book: the Counter's publish can read it (S5e, 28 Oct 2026; dormant, a comparison only)

Part of the S5 and S6 plan (`docs/plan-book-s5-s6.html`). The publish still reads git; nothing here seals or writes a statement.

- **The route** (`GET /book/ledger`, `handleBookLedger`, a CI route behind the Book's own key, like `/book/load` and the readcheck): the Book's BASE (git's book as of the latest load; `?view=1` the base with the open entries replayed) put back in the shape of `ledger/book.json` by `unshape` (`src/book.js`: every array and every document is a key of the book, the five derived documents and PRICING handed back apart, as `ledger/ledger.json` carries them), with the version, the revision, the load's moment and how many entries are open. Read only. **The body is the whole ledger, cost and margin included**: nothing prints it, and the chain's step says counts and codes only.
- **The comparison** (`tools/book-source.mjs --compare`, the chain's step "Check the Book builds the same statements", after the readcheck, `continue-on-error`): it builds EVERY account's live statement, in plaintext and with nothing sealed or written, with `make_statements.mjs`'s own `liveStatement`, once from git's `ledger/book.json` and once from what the Book answered (two import instances, each reading its own book, a tag of its own per call because modules are cached by specifier), and names the accounts whose document differs. The books are equal at every fold (the load's parity), so what this proves is what parity cannot: that the document builder answers the same on the Book's shape and on git's, key order and all (the Book hands documents back with their keys sorted). A bucket (`-R`) is not an account and is left out. The line says the Book's version and revision, its sales, and either "the live statements of N accounts built from the Book equal those built from git" or how many differ and the first five codes.
- **The flip** points the publish at the Book with `node tools/book-source.mjs --out <file>` (plaintext, never into the repo, refuses to overwrite) and `SALT_BOOK=<file> node tools/stmt-publish.mjs`. What stays for S5f, said: the stamp the Counter gates a live statement on is still the Desk's build id (`stmt/worker.js`, `make_statements.mjs`), and becomes the Book's revision at the flip; the price lists, the restock lights and the associates' cards come from the page's own figures over the master (jsdom), so their equal answer on the Book's shape waits for the Worker's PRICING (S5b) and is not covered here.
- **Way back:** remove the step or the route; nothing depends on either.


## The Book: the engine prices from a book alone (S5b, 28 Oct 2026; dormant, a per-fold proof)

Part of the S5 and S6 plan (`docs/plan-book-s5-s6.html`). Nothing reads the engine's PRICING yet; the page's PRICING (`ledger/ledger.json`) is still what the Worker, the Book and the drafter use.

- **The module** (`engine/book-inputs.mjs`, pure, imports engine files only, no node global, so a Worker can run it). `inputsFromBook(book)` builds, from a book object in `ledger/book.json`'s shape, the context the page builds out of its globals (the master's `snapCtx`): every field is a book key or a one-line sum over one (`loanDrawUnits` is the loans net by the master's own rule, `statedStockBy` is empty because the page fills it only from a queued count, `DEFAULT_PROD` is the master's constant `salt`, which is not a book key and without which every salt row, naming no product, falls out of salt's walk). `pricingFromBook(book, now)` calls the engine's own `pricing()` over it at the page's `TODAY` (`klToday`: the Kuala Lumpur calendar day at midnight UTC) and answers `{sizes, byProduct}`: every book's cost, floors, inputs, sizes, rungs, ladder, every customer's card, and a drift or % book's lift and suggestion. It carries no `obs` (the Whiteboard's advice) and no `profileOf` (how a customer buys), which only the page derives; **the price list and the drafter read `profileOf`**, so a Worker-made PRICING must keep it from the last load until it is lifted too. `pricingDiffer` names the product and figure that differ, with a customer map's count and five codes, never a value.
- **The proof, every fold** (`tools/pricing-parity.mjs`, the chain's step "Check the engine prices as the page did", after the Book source step, `continue-on-error`, no secrets, no network): the engine's `byProduct` and `sizes` from `ledger/book.json` equal the page's in `ledger/ledger.json`. The check is made at the moment `ledger.json`'s `stamped` names (the fold wrote it seconds before the page struck its figures, and lock ages move every day), so a re-run of a failed job days later is equal as it should be; only a ledger with no readable stamp falls back to now with one day's allowance. **It proves the glue, and says so**: the page's own snapshot calls the master's one-line delegations to the same engine, so a bug in `engine/snapshot.mjs`, `position.mjs` or `pricing.mjs` would pass on both sides; what is proved is that the context a Worker builds from a book is the context the page builds, and that nothing else moved. First run: equal on the pinned fixture for all six books, and equal on the live checkout.
- **The cost, and where it must not run.** `engine/snapshot.mjs`'s `ctxFor` now carries a `memo` a caller supplies (the hook its own comment named); the module gives a Map per pricing, so the 1.6 s of the first measurement is about 0.2 s on today's book (47 customers, 300 sales), the same figures. It still grows with customers times rows (roughly 5x each way would be several seconds): it must NOT run inside the Book's own request, where it would hold every tap, load and socket; a Worker request or an alarm. The page does not use `ctxFor`, so the page is unchanged, though the master's inlined engine block moved with it.
- **What stays for S5f, said.** The Worker recomputing PRICING after a tap or a booked lot, and writing it where the drafter reads it (with `profileOf` and `obs` kept from the last load); OPEN is not lifted (the reconcile is re-aimed at the sales rows instead) and STOCK may stay a day stale. A red here is an annotation and a summary line: nothing wakes anyone, as with the readcheck.
- **Way back:** remove the step; nothing depends on it.


## The Book: the roster road (S5, 28 Oct 2026; dormant, flag `book_roster` shipped off)

Part 2 of the S5 and S6 plan (`docs/plan-book-s5-s6.html`). Once the Book is the source and the fold stops, nothing would book an Add ID, an appointment, a partner or a rename, nor move the files git holds beside the book. This part lets the tap book them and records what each did, so the flip's export can do the rest. **Nothing changes while the flag is off**: `foldOnlyWhy` answers before the plan runs, the net's query is byte for byte as before, and an old Book ignores the word.

- **The flag** is D1 `book_roster` (migrations/0021, a new table, applied ALONE to the live D1 before the deploy and read back `off`; shipped `off`; **turning it on is the flip's step, on his typed go**). `rosterMode` (src/book-tap.js) reads it; `bookTap` tells the Book in the tap body (`roster`), and the minute net takes roster and rename drafts only with it on. Way back, no deploy: `UPDATE book_roster SET mode='off' WHERE one=1`. With it on, `foldOnlyWhy` no longer answers for `roster` and `rename`; a Counter trade naming a party the book lacks is still the fold's.
- **A rename is the fold's own** (`engine/apply.mjs` `applyRename`: `renameInBook` and a new place under the new code, run by `applyInto` and by the Book's `bookEntry`). It is refused as the fold refuses: a code written into the desk's own logic is **pinned** (`engine/pinned.mjs`, the master's scan written down; the suite scans the master and fails when a quoted code is missing, and a code is pinned with everything under it, its `-R` bucket and an end buyer's code), a code not on the roster, a bucket, a rename onto a taken code.
- **A code a rename retired is refused** (his fold took such a row in the same batch and re-keyed it; a tap cannot, and re-keying only while the rename is open would make the result depend on when a fold ran, Fable's finding): a sale, purchase or Counter trade naming it answers 409 "ZZ1-AAA is now ZZ3-NEW", the whole trip refused. The entries on file (open or folded, never voided) and the trip's own renames say which codes are retired; a code put back on the roster is the roster's again. `namedCodes` reads customer, party, supplier, associate and end buyer, from the row and from a Counter trade's payload.
- **What an entry did is recorded** in `booked.effects` (a column gained by an ALTER like the others): `{renames: [{from, to, pairs, geo}], roster: [{code, kind, register}]}`, null for any other entry. It rides in `/events?all=1` and the sealed nightly export.
- **A load closes such an entry by its effects too**, since it mints no rid and D1's word would be the only way: the new base holds the code it registered, or has moved the codes it renamed. And `tapDiffer` names, in any load, a folded Add ID whose code the new base lacks, or a folded rename whose codes are not moved (a registration whose code a later folded rename moved on is not named); a pure load also compares the roster, associates, partners, places and starting %s.
- **`GET /book/roster?after=N`** (a CI route behind the Book key, like `/book/ledger`; read only): the entries after booking order N that carried effects, voided ones left out, as `{seq, draft_id, effects, folded}` with codes, kinds and the re-key pairs only (a place stays in the Book), and `max`, the highest booking order, so a quiet run can still move its watermark.
- **`tools/roster-export.mjs`** (dormant, not in the chain) is the git side the fold used to do, by the fold's own functions over what the Book recorded: a registration takes the next free spare account (and it is not free for the next), a rename moves the account to the new code with its username unchanged, the place override (while the code ends in the same place), and the suite's fixtures (whole codes only). `sideFiles` is pure and idempotent (a replay changes nothing, and a code registered then renamed does not mint again); `--init` writes the watermark `statements/_roster_export.json` at the Book's highest booking order and **refuses while an entry is booked and not folded**; `--apply` writes the files, runs `geosync --sync` when the places moved, and moves the watermark; without either it is a dry run. The laptop's `_passwords.json` (gitignored) is not moved: the seal tool re-pairs a re-keyed code by verifier proof, as for every rename.
- **No `username_pool` table** (a departure from the plan's first draft, judged sound by Fable): nothing reads a username before the publish seals the account, the spare pool and `_users.json` already live in git, and the binding is deterministic from them, so a second store written beside the Book would only have to be kept atomic with it.
- **At the flip** (his go): apply migration 0021 alone, `UPDATE book_roster SET mode='on'`, `node tools/roster-export.mjs --init`, and run the export in the chain in the fold's old slot, **before the publish** and under the chain's lock (the publish names an account-less code and says to run `stmt-account.mjs --mint`: a hand mint after a rename would give the new code a fresh username and orphan the old one, so the publish's warning must name the export first). With no spare free a bare username is minted at random, as the fold does, so two exports or an export and a laptop mint would conflict on one line of `_users.json`; the log says "waiting".
- **Said, not built**: an entry voided after it was exported is not reversed (a rejection after an approval cannot happen but in the tap's own race, and the route drops voided entries); a registration whose code was renamed on to an account that already stands under the new code (a retired party's) mints nothing, where the fold would; `PINNED_CODES` may be longer than the scan, never shorter.
- Tests: section "Book S5: the roster road", 61 checks, 52 mutations. The Book's tap, load and compaction sections are re-aimed where they read the moved lines.


## The Book: the page reads it at request time (S5d, 28 Oct 2026; dormant, flag `book_page` shipped off)

Part of the S5 and S6 plan (`docs/plan-book-s5-s6.html`). After the flip git's book stops moving and the book baked into the Desk page goes stale, so the page has to read the Book itself. This is that road, behind a flag, with the baked book as the fallback. **With the flag off nothing is served and nothing changes**: `/rev` is the build manifest alone, `/book/page` answers 404, and the page's poll sees no revision.

- **The flag** is D1 `book_page` (migrations/0022, a new table, applied ALONE to the live D1 before the deploy and read back `off`; shipped `off`; **turning it on is his call, after two days of probing** as the plan says). `pageMode` (src/book-page.js). Way back, no deploy: `UPDATE book_page SET mode='off' WHERE one=1`.
- **`GET /rev`** adds `rev`, the Book's revision, beside the build id with the flag on (`bookRevOf`; a Book that is not bound, does not answer or throws leaves the manifest as it was, and so does a manifest that is not JSON). `/rev` stays no-store.
- **`GET /book/page`** (keyed by X-Salt-Key with the other reads that carry cost, behind Access, read only): the Book's VIEW (the base with every open entry replayed, `/read`) as a book file: `{ok, v, stamped, at, rev, booked, book}`, `booked` the draft ids the view holds, `book` as ledger/book.json holds it less NOTES and the derived documents (the page derives its own PRICING, OPEN and STOCK from the arrays). The revision is read BEFORE the view, so a move between the two reads makes the page fetch again and never miss one. 404 with the flag off, 503 with no Book or one that holds nothing (an empty book is never swapped in). Never cached: public/sw.js's API list gains `book`.
- **The page** (master; `bookApply`, `bookFetch`): the cloud script's `/rev` poll calls `bookFetch(rev)` when `rev` is one this page has not read (`BOOK_REV`), before it judges the build. `bookFetch` needs the write key (a desk without it stays baked), asks `book/page` uncached, and waits a minute after any failure or refusal. `bookApply` takes a WHOLE book or nothing: every list and document present and of its kind, the stock a number, the mark a string, and a served mark not older than the page's own baked one (`BOOK_BAKED`; the version is not the test, since after the flip versions stop moving with folds). It swaps in place, because every list and document is a const the rest of the page holds: the arrays and objects are emptied and refilled, the overlay's own base copies (`BASE_*`) are refilled, `PROD_IDS` is rebuilt, the two primitives are `BOOK_STATED` (the engine's `statedStock` reads it) and `BOOK_MARK`; then `applyOverlay()` and `render()`. The table of lists and documents is the baked book's own keys less NOTES, and the suite fails when a key is added to the book and not to the table.
- **A sale is never counted twice**: a queued entry whose draft the served view already holds (`BOOKED_IDS`) is skipped by `applyOverlay`; the entry stays in the queue.
- **Said, not built** (for the flip, S5f): (1) `QUEUE_COMMITTED` moves only with a fold today and the tap does not move it, so a COMPACTION must set the base's mark to the newest entry it closes, or a queued entry the new base already holds would count twice (the overlay's `BOOKED_IDS` covers only OPEN entries); (2) the first paint is the baked book and the served one lands about a second later (a redraw), and a desk with no write key never leaves the baked one; (3) what the master computed once at load from the book and is not refreshed: the geography and place overrides (`PLACES`, LOCS: a rename's override reaches the page with the next build), `evolution`, `DEFAULT_PROD`; (4) the body is the whole book, about 530 KB (about 90 KB gzipped; measured from the book file on 28 Oct 2026) once per revision change per open desk; (5) the Counter's stamp is still the build id.
- **Turning it on** (two days of probing first): `UPDATE book_page SET mode='on' WHERE one=1`, open the Desk, read `BOOK_REV` in the console (a number once the first poll lands), approve one real row and watch the figure move within about ten seconds (a minute with the live socket up, whose `drafts` kind also wakes the poll); the chain's readcheck and "Book builds the same statements" lines stay the proof the Book equals git.
- Tests: section "Book S5d: the Desk page reads the Book at request time", 28 checks, 40 mutations.
