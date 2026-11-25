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
- **A small lot no longer sets the Floor** (his answers of 24 and 25 Nov 2026, `docs/plan-small-lot.html`). `COST_MIN` in
  `engine/rules.mjs`, carried in `PRICING_RULES`, is the fewest units a book's cost is read over, his figures typed per book: salt 12.5,
  oil 10, candy 10, rice 100, gas 1; a book it does not name has nought, the latest lot alone. `latestCogs` reads it itself, by the
  newest lot's book, so no caller can forget it (the import is exactly `import PRICING_RULES from "./rules.mjs";`, the form
  `tools/engine.mjs --sync` drops; in the master the rules block's global answers it). When the newest landed lot reaches the minimum,
  the answer is that lot alone, byte for byte as before. Under it, the lots it may read (live, something received, landed on or
  before the day) are taken newest first, each at its own quote and freight over its units received, the last only for the units
  still needed; lots that together fall short are all taken whole. `p`, `rid` and `date` stay the newest lot's; `quote`, `freight`
  and `units` are the shares counted and `rate` their sum over the units; `lots` (`[{rid, date, units, rate, draft}]`, newest first)
  is present only when a blend is in force, and the snapshot's `latest` and the stack's carry it. Every reader follows: the Floor and
  the Ceiling on a board, the replacement rate, the fold's and the tap's sale cost, the reward step and the loyalty unit, the
  drafter and the Workbench; the non-revenue anchor and an order's fault date read the newest lot's date, unmoved. The words say
  "the newest 10 units" and name each lot ("1 of p057 at RM 94 and 9 of p031 at RM 42"): Pricing's seven places, the drafter's
  note, flag 4, the Floor's refusal and the drafted-lot flag (raised by a drafted lot anywhere in the blend), and Salt Admin's
  Workbench. A new book from `tools/product.mjs` prices off its latest lot alone until a version names it in `COST_MIN`, and the
  tool says so. Checks: `test/floor-small-lot.mjs` (v1572).
- **The Floor is the order total up to the next RM 5; the Ceiling is 3 times it** (his decisions of 18 Oct 2026).
  `floorTotal` is COGS times the size rounded up to the next RM 5, one per size on every book; `costTotal` is the
  exact cost, for the readers that measure cost and not price (the price band's segment floor `flOf`, `flRate` and
  `f1`, the floor-per-unit chart). `ceilingX` is 3 on every book (oil and candy were 2, rice 2.5); salt's own Ceiling left it for the band's curve on 10 Nov 2026 (below). A stated board
  (`fixed`: oil, candy and rice, his typed rungs, unchanged) is held between the Floor and the Ceiling, capped down to the
  book's grid. The price grid's `LADDER.round.to` is 5, so a RM 35 Floor is not re-rounded to RM 40.
- **Salt is the Median Price and their %** (his decisions of 05, 18 and 21 Oct 2026; named the Set Price until 10 Nov 2026, his word: every
  word he reads says Median Price, and the identifiers stay). `TIER_RULE.salt` carries `drift` (the
  flag that marks a book with a Median Price), `points`, `ceilingX`, `band`, `auto`, `suggest` and `presets`. **The Median Price is what a
  stranger is quoted**; since 21 Oct 2026 a customer on a negative % of his pays less, never under the Floor. The multiple of the Floor is 3 at half a unit,
  2.4 at 1, 2.004 at 6.25 and 1.596 at 12.5 (since 10 Nov 2026, his word: 1.2 times the old 2.5, 2, 1.67, 1.33, RM 120 at 1 unit; the price band's version 1 moved none of it), sliding in the log of size between points and flat above 12.5. The engine's
  `driftWalk` walks the grid (half a unit to 25 in quarters) smallest first: the rate is the lesser of the last size's and
  `Floor * multiple * (1 + %) / q`, on the exact rate and never compounded; the price is that rate times the size, down
  to RM 5; it is then lifted so the ringgit margin over the Floor never falls below the largest margin of any smaller
  walked size, and held between the Floor (up to RM 5) and the Ceiling. The quoted rate may therefore rise by under RM 5 a
  unit between quarters: the rate law is on the exact rate. `quoteAt` and `quoteGrid` are the one rule at any size, so
  for every % in use and every grid point `quoteGrid(...).p[i]` is `quoteAt(min + i * step, ...)`, and a
  partner's `quoteAt` is the `floorTotal`, the snapshot's `floors[q]` and the drafter's `floorFor(q).floor`.
- **Their % on his curve, on every book** (22 Oct 2026). **Salt left this curve for the band on 10 Nov 2026 (the next entry), so no rule carries `ends` now and `driftMultiple` is kept for one that does.** A rule's `ends` are Floor multiples (salt's stood at these) for -30% (2.40 at 0.5 unit,
  1.44 at 12.5) and +30% (3.60, 1.74; 1.2 times the old 2.00, 1.20 and 3.00, 1.45 since 10 Nov 2026); `driftMultiple(q, R, pct)` puts each end on the Median Price's own shape (the share s the Median Price
  sits between its first and last multiples) and a % at t = pct / 0.3 of the way from the Median Price to its end, so each 5% step is equal
  at every size; the walk reads it in place of the multiple times (1 + %), which a rule without `ends` keeps. Oil, candy and rice carry
  `pct` and `shares` (-30% 0.8 of the board at the smallest rung and 0.9 at the largest, +30% 1.2 and 1.09, salt's proportions, his
  answer that day): `shareAt` slides in the log of size, and `fixedWalk(sizes, C, P, d)` takes it off the board, down to the book's step,
  between the Floor and the Ceiling, the rate never rising with size. `pctBook(R)` (drift or pct) is the one gate: the snapshot's `lift`,
  `cardQuote`, `cardAt`'s `quoteOff`, the drafter, the fold's `driftBooks()` (a TIER_RULE line opening `drift:` or `pct:`), the catalog,
  `makerTierSet`, Add ID and the price list (a held non-zero % on a board is their card). The suggestion stays on a Median Price book.
  **Salt Admin shows it live**: the form takes a whole % in steps of 5, between the ends the catalog gives for the book (`driftMin`, `driftMax`), and asks `GET /all/maker/drift-preview/<code>/<book>/<whole %>`
  (relayed to the Desk's keyed `/_internal/maker/drift-preview/...`, `makerDriftPreview`, a read that writes nothing) 300 ms after he stops
  typing: now and at the typed % at the board's sizes and their usual size, beside the Floor, every figure `quoteAt` on the snapshot.
- **The price band, version 1** (his decisions of 10 Nov 2026, `docs/plan-salt-price-band.html`; `TIER_RULE.salt.band`). Three posts at every size: the
  Floor (`floorTotal`, the share in), the Median Price (the walk's `set`, unchanged) and the Ceiling, `bandCeiling(q, R)`: `band.ceiling.rates` (RM a unit
  at `per`: 200 at half a unit, 100 at 12.5, 83.93 at 100, linear in the log of size, flat beyond) times the typed `supplier.total / supplier.units` over
  `per`, times the size; the walk takes the total DOWN to RM 5 and never under the Floor (`hi`), and reports it as `ceiling`. A rule with no band keeps
  `ceilingX` times the COGS Floor. **Their % is a place between the posts**: `bandTop(M, lo, hi, k)` is M times (hi/M) to the k above nought and M times
  (lo/M) to the |k| below, struck on the Median as quoted (`s.p`) and stepped through the walk's own rate and margin laws, then held: a lift never under the
  Median (the % path's running rate can sit a hair under the Median's where the Ceiling holds the Median) and -100% the Floor itself, with no margin lift,
  so it is what a partner pays on any cost. `bandPct` reads a price back to its place. `liftRange(R)` is -1 to +1 on a rule with `band` and `LIFT_MIN` to
  `LIFT_MAX` otherwise; `driftOk(v, R)` judges on it (with no rule, the widest) and `rangeSay(R)` words a refusal. **A band figure travels as unit
  `band`** (`unitOf`, `unitOk`): Salt Admin's forms send the catalog's `driftUnit`, `makerTierSet` and Add ID refuse `pct` naming salt in the old-unit
  words, the drafter flags it and the fold's `oldWhy` drops it as set "on the old scale"; the page's saved-entry whitelist (`vaultPendingOk`'s
  `enumWords`) names `band`. **The carry-over of the switch** is booked and gone: from v1500 the rule held `band.carry`, `{code: {from, to}}`, the list he approved
  (`docs/plan-salt-price-band-carry.html`), read by `heldPct` and guarded by `carryClash`; his Approve of 11 Nov 2026 booked one `tierset` (unit `band`)
  of the 15 `to` figures at seq 187, the day's export put them in git's book, and the next version took the table, both functions and the five gates
  (a tierset back to `from` at `makerTierSet`, in the drafter and in the fold, a rename of a carried code, an Add ID at that figure) out. A held figure is read as it stands. **The suggestion on
  the band** starts from the median place (`bandPct` at each sale's own size, never under nought) of their last five sales, handed to `suggestPct` as
  `O.places` with `liftRange`; the words keep the ratio paid over. **What to know**: the Ceiling moves only with the typed supplier's price, so on RM 56 a
  COGS past about RM 52.60 a unit lets the Ceiling hold the Median at the largest sizes, and past RM 62.65 at 12.5 units; a salt discount moves with the
  Floor's live share; +100% reads RM 5 under the Ceiling at some sizes over 12.5, where the rate law holds it; a held figure of the old drift unit
  (past -0.3 or +0.3) would now read as a %, and the book held none at the switch (checked on the export of 10 Nov 2026). Checks: `test/price-band.mjs`
  (the laws on eight costs), `test/lift-pct.mjs`, `test/floor-nrs.mjs`.
- **A typed figure outside the band is asked once, then stands marked** (his answer D of 10 Nov 2026; `engine/oneoff.mjs`, pure, in no generated
  block and imported by nothing under `stmt/`; every book under its Floor by his word of 17 Nov 2026, "I want to be able to put a price lower than
  floor", a book with no band having no Ceiling to ask about). The roads where he types a goods total on one order, Accept and its preview
  (`previewAck`), both offer roads and an amendment of an agreed order (`restateTap`), read `outsideBand(total, floorFor, bandFor)`: under the
  Floor at the size or over the Ceiling there (`bandFor` in `src/drafter.js` reads the walk's `ceiling`, null on a book with no band). With no
  reason the answer is `bandRefusal`, 409 with `outside: {side, by, floor, ceiling}` (and `underFloor` on that side): "RM 45 under the Floor of
  RM 65 at 1 unit: a loss of RM 45 on this order. Give a reason and it stands as a one-off." or "RM 20 over the Ceiling of RM 175 at 1 unit. ...".
  The loss is measured against the Floor, the share and the RM 5 in, as his plan words it. Sent again with `oneOff` (his reason, `reasonOf`: one
  line of 3 to 120 characters, no `<` or `>`; 400 otherwise) the entry carries `markOf`, `{why, side, by}`; the drafter copies it onto the new
  row or beside a Correction's fields (never among them; `markOk` or the row is not drafted), flags it ("One-off: RM 45 under the Floor, his reason:
  ...") and `stageDigest` holds it, so his yes answers it; `applyAmend` sets it on the row, deletes it on `null` (an amendment back inside the
  band, flagged "No longer outside its price ...") and keeps what it replaced as the step's `oneOffWas`, which an undo through `restateTap` puts
  back. An offer keeps the reason on the row his yes was shown (`preapproval.shown.row`), so their take drafts with it and is never asked
  (`unasked`); an offer made before the version drafts unmarked. A row offered again keeps the reason its rejected draft carried. **Left out of
  the evidence**: `aPriceSomeonePaid` (the product's range, their own rates, the card's usual, Salt Admin's readings of both), the snapshot's
  `suggestOf`, and the Desk's price readers beside `ONE_OFFS` (which stays the list of customers set aside whole, and is not written by this).
  **Salt Admin**: the placed card and Change the order show the Desk's sentence, one Reason line and Let it stand, which sends the same figures
  with the reason (acts `order.one-off-reason`, `order.one-off`, `order.amend-reason`, drawn only after the refusal; both allow-lists,
  `src/maker.js` and `stmt/maker.js`, take `oneOff`, and the bridge relays `outside`). **The placed card's pill says what it waits for**
  (12 Nov 2026, `waitDraw`): Choose the delivery charge, Give a reason (its tap puts him on the Reason line) or Read the figures again (its
  tap reads them), grey only while a read is on its way; it was the greyed Figures not read for an asked reason too. **Salt Counter**: nothing; the reason goes to the Desk
  and the ledger row, never to the site, and no customer view names it. `payFault`, `rowRoom`, COGS, refunds and stock read nothing of it.
  **Not built, said**: no surface types a Median point, so that half of the plan's paragraph has nothing to check; Pricing's 30-day tally of
  one-offs; Salt Admin's Correct a row (`ledger-amend`) still refuses under the Floor on every book in its old words and knows no Ceiling; an undo is never asked, so on any book it may put back figures under today's Floor, marked only if the step kept `oneOffWas`; an undo off
  the site road does not restore a mark; the Desk shows the mark once the Book holds the row (its own overlay, `ovAmend`, went on 21 Nov 2026); the reason is
  free text on a public repo's ledger and nothing scans it for a name. Checks: `test/price-band-oneoff.mjs`.
- **The price band, version 2: the market** (his answer B of 10 Nov 2026 and his answers of 11 Nov 2026; `TIER_RULE.salt.market`, the snapshot
  engine's market section). **The move**: `marketWalk(C, p, day, from)` walks from the rule's `since` (the day the version shipped) a day at a time, each
  day read off the book as it stood when the day began (rows dated before it): `shelfAt` rebuilds the shelf from the last count before it (its
  `qty`, the count taken as the day's end), else the opening, plus every live lot received since, less every handover (the trail read as
  `heldBefore` reads it) and recorded loss since; `marketCover` is `restockPlan`'s `coverDays` over the demand before the day and that shelf,
  with no rhythm, dues or holidays (his answer: one plain cover every day, so today, the walk and the replay agree; it can differ from the
  restock light's cover by about a day). Supply's points are `supply` ([[3, +15], [7, +5], [14, 0]], `long` -10 past it, nought with no demand);
  the pace (last 14 days against the last 56, ±5 at ±25%) is said and never priced while `pace.acts` is false. The target is held to `min` and
  `max` (-15, +20), the move goes `step` (5 points) a day at most towards it, and a stand-down (`fellRunning`: margin a day, goods less the
  row's own cost over seven days, under the week before it `stand.weeks` times running while the move is up) caps the target at nought for
  `stand.hold` days. `marketOf` is the day's entry (memoised), `marketK` its number, `marketWhy` the one place the words are made ("Median +5: 4.2 days
  of cover, moving 5 a day towards +15."). **In the walk** (`driftWalk`, `P.market`, band rules only) the Median goes to `bandTop(plain, Floor,
  Ceiling, k)` on a path of its own (the rate and margin laws, a rise never under the plain Median, a fall never over it); a customer's % is a
  place between the Floor, the MOVED Median and the Ceiling (his answer: it rides), so -100% is the Floor and +100% the Ceiling whatever the
  move, and a partner is quoted the Floor apart from the walk. A row carries `set` (today's Median), and `plain` and `market` when moved.
  `policy(C, p)` carries `market` and `tierRule: ruleFor(C, p)`; `policy(C, p, true)` is the plain policy the evidence reads (`suggestOf`, the
  90-day reading, the replay's posts), so the day's move never moves what past sales say. The PRICING snapshot carries `byProduct.salt.market`
  `{day, k, on, why}`; the cards, the price lists, the drafter and `quoteOff` follow the policy. **His switch and his points** are the book's
  `MARKET` document (`{salt: {switch: [{on, from, at}], anchors: [{q, x, price, from, at, outside?}]}}`; the page reads `MARKET_BOOK`, `{}` while the
  book has none, and the extract reads it as `MARKET`), written only by an `edit` he approves: Salt Admin's `POST /all/maker/inputs/edit` with kind
  `marketOff`, `marketOn` or `anchor` (`makerMarket`: a switch carries nothing else, a point is a price in steps of RM 5 at an ordered size, outside
  the band on the plain policy it answers 400 with `outside` and stands with his `why`, a second market edit while one waits is a twin); the
  drafter's `marketEditRow` strikes a point's multiple `x` on the COGS Floor at the size (`floorBase`) and flags what the Median becomes there;
  the fold and the tap (`engine/apply.mjs`, `it.market`) file it once by the entry's moment, from the KL day it was asked (`klDayOf`); the tap
  check compares `MARKET` (`EDIT_PURE`). `switchOn(C, p, day)` reads the newest switch dated on or before the day, on with none: off is nought
  that day and after, on climbs from nought. `ruleFor` merges his points (`withPoints`, the newest at a size winning, each from its day). **The
  readings** (the Desk's Pricing): `priceReading` (90 days, per size: sales, declined, usual, profit-best, plain Median; the profit-best is the
  price paid that earns most per buyer seen, price less exact cost times those who paid it or more and those who cancelled at a higher price;
  a re-anchor SUGGESTED at 10 sales or more and RM 5 or more off, his tap through the Act road `anchor/<q>/<price>`), `marketScore` (the week
  against the eight before: margin a day, orders, new buyers, regulars won back, what the move added, an estimate) and `marketReplay` (the walk
  from the book's first sale on today's cost and posts, beside what was paid). **A stranger at +30%** (his word of 11 Nov 2026): `TIER_RULE.salt.start`
  is where a new customer or associate who names no figure starts (the fold's `fresh` start; a figure he picks, nought included, stands; a partner,
  a bucket and a supplier hold none), and the guest board quotes salt there (`guestBoard`). **The suite's frozen book holds the switch off**
  (`test/fixtures/book-frozen.json` `MARKET`), so no check's salt price moves with the calendar; the market's own checks turn it on in their own
  book. Said, not modelled: a loan in kind, a row dated earlier and entered later (a past day can read anew, so the walk is a reading, not a record,
  and a count, Correction or lot dated back can move today by more than 5 points between two publishes; Fable, said, 13 Nov 2026). **Live as v1514
  (13 Nov 2026)**, with Fable's review applied: a lot lands on each day a part landed (`landingsOf`, the Desk's `lotLandings`); a served book's `MARKET`
  reaches an open Desk through `bookApply`'s document loop; their price at Accept is the lower of the card and the total their list quoted at Place
  (`entry.payload.listed`, `listStamp`), and an amendment at the same size keeps the lower of the card and the stamp it had; a point is set at 12.5
  units or under (`makerMarket` and `marketEditRow`); the +30% start is the fold's only for an Add ID stamped from `TIER_RULE.salt.startFrom`
  (the push), and the Approve card says it (`startLine`); `pricingSnapshot` opens one render memo a book (3.7 s to 1.8 s). Said, not changed: the
  move between midnight and the daily publish is yesterday's on Accept, Salt Admin and the Counter; a switch's `from` is the day asked, not approved;
  a strict compaction lets one row go per market edit as per any edit; a point's multiple is struck at drafting. **Quotes**: `stmt/quotes.js` files
  KV `quote:<KL day>:<username>` (30 a day, 10 lines, 120 days), the counts on the key's metadata, so the Desk's `GET /quotes` (relayed to the
  Counter's `/desk/quotes`) lists keys and reads at most 200 that carry none (`partial`). Checks: `test/price-band-market.mjs`, `test/desk-market.mjs`,
  `test/admin-market.mjs`, `test/counter-quotes.mjs`, `test/band-v2-fixes.mjs`.
- **The price band, version 3: the customers, the engine** (live as v1515, 13 Nov 2026; his answers E, F and G of 10 Nov and of 11 and 13 Nov 2026;
  `TIER_RULE.salt.habit` and `.test`, the snapshot engine's V3 section). `habitOf` reads a party's salt order days in 180 (`pbPriced`, no goodwill or reward, an
  -R bucket with its owner): a regular at 4, the gap and the usual the medians, early, due past one gap, late past 1.5, lapsed past 3 gaps or 21 days, `margin30`,
  `owes`, and `writeOff` (a party with a write-off is not approached); a partner has none. `habits` lists the regulars by need then margin; `sizeWarn` says what a
  lot of three times their usual and 10 points off would cost a month at their units; `winBack` (and the Worker's `winBackOf` on Accept's preview, under the lower of
  the card and their list, never an -R bucket) is 10 points under their place for a lapsed regular, never under -80%. `newBuyers` counts first orders by week,
  introduced, came back (distinct order days) and thin; `calendarLift` measures his marks against the 28 days before and suggests after two passes. **The price test**
  (`testOf`, `P.test` {q, rm}): RM 5 up at 1 unit in even weeks and RM 5 down in odd from `from` (16 Nov 2026) for `weeks` (8), nought with the switch off; `driftWalk`
  moves that size alone and keeps its running state untested; the plain policy carries none; `suggestOf` leaves the test's sales out; `testReading` compares the
  weeks. The snapshot carries `habits` (with `warn`), `buyers` and `test`. Said: from 00:00 Monday to the daily publish the Worker and the sealed lists hold last
  week's test (the customer is not hurt: their price is the lower of the card and their list); `testReading` sorts by row date. Checks:
  `test/price-band-customers.mjs`; the Counter's reminder is `test/counter-remind.mjs` (docs/STATEMENTS.md).
- **The price band, version 3: the customers, on the Desk** (13 Nov 2026; the engine is `testOf`, `testReading`, `calendarLift`, `newBuyers` and
  `habits` in the snapshot engine). Readings only, each drawn for the book whose rule carries it (`test`, `habit`), never by its name. **Pricing**, after
  the market panels: the Price test card (this week's test, "RM 5 up at 1 unit, week 1 of 8", or No test today, and orders a day and margin a day at that
  size in the up weeks against the down weeks, marked estimate while either side has fewer than 7 days) and the Calendar card (`calendarPanel`: his marks
  with their lift in units a day against the 28 days before, and for a coming mark measured twice the suggestion to hold N units and a +5 move, information
  only). His marks are the Counter's KV `calendar`, read once through the keyed `GET /calendar` (`ckCalLoad`, cloud mode only); nothing of the calendar is
  drawn until it answers ok, and adding or removing a mark is Salt Admin's (`adminLink('shop/calendar')`). **Clients**, under Their %: `clientsHabits`
  draws the eight weeks of new buyers (new, through an associate, came back, Thin when the engine says two weeks run under half the mean) and the regulars
  due, late or lapsed (twelve at most, the engine's order), each linked to its account on Salt Admin. Checks: `test/desk-customers.mjs`.
- **The price band, version 3: Salt Admin's customers** (13 Nov 2026, the engine's habits, win-back, new buyers and calendar of commits 5350401d and f7acfb3a). The
  catalogue (`makerInputCatalog`, `customersCatalog`) carries `habits` (due, late and lapsed only, lapsed then late then due, the larger `margin30` first),
  `buyers` (the newest week's count, introduced, back and `thin`) and `test` (the price test on the days it runs); `makerCustomerReadingOf` carries the
  snapshot's `habit`. Needs you reads the catalogue once and on a Retry (never on the poll's tick): one card for the regulars, **To do while one has lapsed**
  (a win-back is his tap) and FYI while they are only due or late, its tap and Open going to the first one's account (`acctFor`), the rest in its why; and one FYI
  line for the week's buyers. This customer says their habit and the size warning in words. At Accept the preview's `winBack` is one line with Use, which fills
  Goods with its price and reads the figures again, sends nothing, and says the order then reads under their price (no loyalty unit, given on an associate's reward).
  Shop > Market says the price test under the day's move. **Shop > Calendar**: his marks `{id, name, from, to}`, Counter KV `calendar` (`stmt/calendar.js`, 60
  at most, a name of 2 to 30 characters, real days within a year of today, the last on or after the first), through `GET|POST /all/maker/calendar` (`{add}` or
  `{remove}`), standing at once with no Approve since a mark prices nothing; the Desk reads it by the Counter's `/desk/calendar` (`X-Stmt-Desk`), `calendarRelay`
  and the keyed `GET /calendar`; the Act road takes `shop/calendar`.
 **Their %** (`TIER_OF[code][book]`: -1 to +1 on salt's band since 10 Nov 2026, -0.3 to +0.3 on a stated board since his decision of 21 Oct 2026,
  `liftRange`, held until he changes it; `cardQuote` reads it through `driftOf`). It is the move on the Median Price, a negative one a discount, applied inside the walk, and nought is the Median Price. **Everyone
  starts at 0%** (the held figures were removed in the 18 Oct 2026 version, and the fold drops a `tierset` or an Add ID
  figure stamped before `RULES.liftSince`, which was in the old unit, with a note, and refuses nothing for it). He sets it on the Their % card (Network), Counter
  Admin's Their % form or Add ID (salt's presets -50%, -30%, -20%, -10%, Median Price, +10%, +20%, +30% and +50%, a board's -30% to +30% as before, or another % inside the book's range; the field
  drops the decimal pad so an iPhone shows a minus key); it is queued,
  folded as `tierset`, and a null clears it. Under about 7% a % moves nothing at half a unit to 1 unit, which the card says
  once. **Nothing automatic prices.** `autoDrift` over `driftSignals` fills the card's good and bad only. The card's
  suggestion is `suggestOf` (the engine's `suggestPct`): the median over their last five salt sales of the rate paid
  over the Median Price rate at that size, less one and not under nought (on salt's band the median place of those sales instead, above), plus a share for a write-off (30%), a long late
  or 14 days overdue (20%) or a late (10%), less, with nothing late, overdue or written off, a good record's discount (`suggest.good`, 0.3, times `autoDrift`'s good
  score `G`; his answer of 21 Oct 2026), to the nearest 5%, held to the book's range, and nought under `minSettled` settled rows;
  `suggestWhy` says "good record". The Desk's card says it as "Suggested +10%: paid late"; Salt Admin's Use the suggestion fills the
  box. The snapshot carries each customer's quotes as `cards`, their % as `lift` and the suggestion as `suggest`, which
  the price list reads (`basis: "card"`); an older reader that looks for the former map finds nothing and falls back to the board.
- **Salt's Floor carries the non-revenue salt** (his decision of 10 Nov 2026). `RULES.nrsFloor` names the book and the categories; the snapshot engine's `nrsShare` reads the share from the walk and the rows as they stood at the last measure (his answer H, built 11 Nov 2026): `nrsAnchor` is the latest day, today at the latest, of a count (`COUNTS`), a recorded loss (`selfUseLog`, which rolls the shelf and so moves the shortfall) or a landed lot (`latestCogs`); a count still queued on the page (the overlay's `statedStockBy`) reads as a count of today, so the page previews what the fold will make. Each row is read as it stood when that day began (`heldBefore`): units handed over on or after it, a gift among them, wait for the next measure, units taken back or a handover undone on or after it are still in, and a write-off dated on or after it is still a sale. A write-off with no `defaultedOn` is dated by `writeOffDay` asked `exact` (the loyalty walk reads the newest Correction): the newest Correction whose own `was` names `defaulted`, which the fold, the tap and the page's overlay all write on the step that sets the flag, else the oldest Correction that moved no units and is not an undo (the two rows written off before `was` was kept), else the first handover plus the lock. No road stamps a sale's `defaultedOn`; by the newest Correction a later note on a written-off row would take it out of the share and bring it back, and by the oldest a site order, whose handover is itself a Correction, would be written off on its handover day. So trading moves no Floor, no partner's price and no salt discount; a book with none of the three reads live. It counts the count shortfall (`selfUse`, the promotion's sample inside it), gifts and rewards with reward cover, and written off, over the units handed over less those (a unit settled in kind is paid for). `inputs().nrs` carries it with its day and what measured it (`at`, `by`), `costStack` returns `nrs`, `nrsAt`, `nrsBy` and `floorEx` (COGS times 1 plus the share), `floorTotal` reads `floorEx`, and the Desk's `nrsWhen` says the day beside the share on Pricing. `floorBase` is the COGS Floor: `driftWalk` strikes the Median Price's multiples and the margin lift on it (and the Ceiling, on a rule with no band) and holds the price over `floorTotal`, so a stranger's price does not move; since the band (10 Nov 2026) a salt discount is a place between the Median and this Floor, so it moves with the share. `costTotal`, `effEx`, COGS of goods sold, stock value and the reward step stay on COGS. The page's `snapCtx().W` must hand the engine `soldUnits`, or the share reads nothing. Open, his calls: whether the Median Price follows (the Ceiling left COGS for the supplier's price on 10 Nov 2026); none on the share since answer H. Still live, said: a loan in kind (the walk's `soldUnits` carries it undated) and one settled with units left, reward cover put on an older row, a row, a count or a loss dated before the measure and entered or corrected after it (the words then name the older measure), a lot's units restated under what landed, a Correction that sets the flag with no date (read as an older note or the lock), a row written off before the measure, revived and written off again after it (out until the next), a trail stating more units than the row holds with a step on or after the day, and a queued count typed for an earlier day previewing as today's; a handover on the measure's own day waits for the next. A fixture that pushes rows with no `recompute()` hands the share a walk from before them, and sets the share aside. Follow-up: stamp `defaultedOn` on a sale at the fold and the tap, so a write-off's day is exact. A redeemed reward unit (`rebate`) is paid for, his answer of 10 Nov 2026. Checks: `test/floor-nrs.mjs`, `test/floor-nrs-anchor.mjs`.
- **A partner pays the Floor** (his decisions of 06 and 18 Oct 2026). Quoted `floorTotal` at every size on every book,
  RM 5 round-up included, through `quoteAt` with `d` of `'partner'`. **Set from the phone** (his decision of 09 Oct
  2026): the Their % card's Make partner queues `partnerEntry` (`mode: 'partner'`, the code alone, not an Add ID so the
  pair vault's gate does not meet it); the drafter returns a `roster` row with `partner: true` and `kind: 'reseller'`;
  the fold files the code in `partners` and appoints an associate with their -R account if they are none, so a partner
  keeps every associate property. The desk shows the standing at once and the card reads waiting under Approve.
  `test/partner-control.mjs`.
- **NRV is the Median Price on a book that has one, the stated price on a board** (IAS 2.6): the least a customer but a
  partner is quoted at 0%, so the IAS 2.9 test can bind; the Ceiling is never the basis, nor a customer's discount (21 Oct 2026).
- **There are no price levels** (removed 18 Oct 2026). `TIER_NAMES`, the `fiveTiers` multiples branch, `levelAt`,
  `levelShapeOk`, `tier1Anchors`, `tier1Walk`, `tier1Ask`, the proposals (`tierProposal`, `ruleProposal`) and the
  guest boards per level are gone, and so is the legacy Tier I to III badge. The identifiers `TIER_RULE`, `fiveTiers`,
  `tieredBooks`, `TIER_OF`, the row code `T2` and the `tierset` collection stay; `LEVEL_WORDS` and the private word
  lists stay as the guard that stops a level word reaching a customer. What is not a pricing level stays: a
  supplier's quote tiers (`QUOTES.*.tiers`, `buyTaper`, the restock `tier`), an associate's rank, stars and share, and
  an order rating. The superseded reasoning is in `docs/NOTES.md`.
- **One rule at any size, the engine's `quoteAt`.** `cardQuote` is `quoteAt`: on a book with a Median Price, the Median Price
  moved by their %, **walked through every grid point beneath the size** (`walkSizes`), so the rate never rises across
  the grid by a step or more; on a stated board the rung's rate times the size, rounded down to the ringgit between rungs,
  his typed rungs exact (`fixedWalk`). `cardPrice` is called by the price list off the snapshot's `cards`, and on the
  desk by `cardQuote`, which every quote to a named customer reads: the printed board (`pbPrices`), the approach offer
  and Today's worth (`nextBest`, no offer with no price), and the reward cover, whose gap is to their card price.
- **Words** (18 Oct 2026; Median Price since 10 Nov 2026): every surface says Floor, Median Price and Ceiling, and his figure is Their % (presets
  "-50% ... Median Price ... +50%" on salt). No tier, level or drift word is visible on the Desk, Salt Admin or the Counter;
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
- **R3, a referee's first week** (plan version 6, his answers R3 and E3 of 02 Nov 2026): an Add ID naming its `introducer` (Salt Admin's join card sends the
  associate's code; `src/maker-inputs.js` takes it for a customer and an associate with an opening only) files `INTRODUCTIONS` `{by, customer, since, days: 7}`,
  `since` the fold's (or the tap's) day, once a customer and never a second (the plan says why it filed none; the registration always stands). The engine's
  `r3Link`, `r3In` and `r3Of` read it: a referee's row dated in the week counts in the introducer's `rewardWalk` as their own buying does, paid in full,
  priced rows only, with no stamp of the referee's (`listRM`, `rwdStep`, `rwdRate` ignored, so `given` is nought); an own row in someone's live week counts
  there, once. The old count reads only entries with no `since`. The fold runs the introducer's walk on a referee's touch in the week and on a touch of a row
  another's live unit names (STALE at once on a redate, an undo or a cancel); the unit goes with the associate's next salt handover once the referee's order is
  handed over in full. `rwdOf` and `rewardReading`'s unit read only the row owner's units, so a referee is never told of it. His reading carries `r3` (each
  week, its last day, the orders counted) and a referee's order `r3For`; the associate's Counter card `reward.r3`, a count. The referee's own loyalty walk still
  counts the same rows (two people's schemes; said, not his decision yet). With `book_roster` on (after the flip) the tap files `since` at its own day and
  the fold at its TODAY, so an approval before midnight folded after it would differ under `ROSTER_PURE`: take the tap's day at the flip. The associate's
  Counter card's "brought" ringgit (`summary.introduced`) reads the referee's sales, as a referral's always has.

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
  `/_internal/maker/nudge` (18 Nov 2026: the order book's POST after a customer's move, answered 202, which runs the
  minute's order pass at once through `ordersOnce`, one pass per isolate at a time; from 19 Nov 2026 its body names the
  orders moved and that pass reconciles those; `docs/STATEMENTS.md` "The desk nudge" and "The ring at the move"),
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
- **One place field** (his yes of 17 Nov 2026 to `docs/plan-place-field.html`, all five recommended answers). `mapsLink` also reads two figures
  apart by a space, a point in degrees, minutes and seconds in either order (`dmsPoint`) and a plus code (`plusPoint`: a full one, or a short
  one read from Kuala Lumpur, so within about 50 km of the city), each as `src: 'pin'`; `tools/maker-geosync.mjs` carries both to the Counter
  and Salt Admin. **The locality is worked out from the point** (`localityFor`, beside `placePicks`): the district the point stands in, the
  nearest listed locality of that district within 3 km, else the listed area holding the point, else the district's nearest; null outside every
  district. On Add ID, Amend ID and Place on the map, Where stands first and fills Locality (`makerLocalityFrom`), a locality he typed standing;
  words no reader takes are filed as the address alone (`src: 'addr'`). On the Counter nothing is refused for its form: the spot's name comes
  as Home and a link no reader takes is kept whole as the address (`ADDR_MAX`, 1,000). Salt Admin's order card places such an address once
  (Place it, Use this point: the point held in page memory for that order's distance) and files any point as their place (`makerFileSpot`,
  the same `/all/maker/inputs/place` as Place on the map, for his Approve). Not built: opening Google `cid=` links and Waze venue links on the
  Worker, which waits on a real link of each kind.
- **An agreed order is amended after Accept** (his decision of 06 Oct 2026): the units, the goods' price and the
  delivery charge of an acknowledged or ready order, one Correction for approval (`restateOrder` in `src/orders.js`,
  `POST /orders/<id>/restate`, the Counter's `/all/maker/orders/<id>/restate` under a request id). Refused: a
  collection with a delivery charge, a size under what is handed over, a size change on an order closed short, a
  claim waiting, a total under the floor at the size, a figure under what is paid and still on its way to the row
  (`rowRoom`, until it lands), an earlier amendment not yet on the book. A figure under what is paid is taken (06 Oct
  2026): the answer carries `refund`, the card says it, and the fold opens a `customerRefunds` row for the difference as
  the Correction lands (the engine's `refundOnOverpay`, the same rule on every sale amendment, a payment over the row
  included). The board is never repriced; the order book's `restate`
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
  **Salt Admin's account list reads each credit live** (20 Nov 2026, his yes): `liveAcct` in `stmt/owner.js` lays the Desk's
  `openRefunds` (by the exact code, as `stmtRefunds` counts) over the sealed sheet's `t.refund` and chooses the flag again in
  `reviewFlag`'s order, so a refund paid or removed leaves the card at the Desk's next read, not the next publish; the sealed
  figures stand alone while the Desk names no refunds. **And what they owe, the goods owed them and what is agreed** (20 Nov 2026,
  `docs/plan-admin-live-owed.html`): the catalog's `standing`, the engine's `accountStanding` by the statement's own row rule,
  pinned to `make_statements`' `partyTotals` on the live, frozen and practice books by `test/standing-parity.mjs`; a party it leaves
  out is nought once the list arrived. Their page and the Counter's hold on ordering still read the sealed figures, so where owed or
  the word differ the card says what their page shows and from when (`differsLine`).
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

- `engine/position.mjs` `restockLight(shelf, commitUnits, demand)`, four steps since 04 Nov 2026 (his rule): free is the shelf less what is owed out (paid ahead), and after is free less what is agreed with nothing moved (`demand.agreed`, `commitments().promUnits`); red, Out of stock, under half a hundredth free, so an agreed order never makes a book red (his word of 04 Nov 2026: it would deter people from ordering); amber, Low on stock, after under half a hundredth or below one usual order (`demand.usual`, `restockPlan`'s `buy.median`), or `demand.coverDays` (`restockPlan`'s, the days free lasts at the forecast) at `LIGHT_DAYS.low` (3) or fewer; yellow, Selling fast, cover at `LIGHT_DAYS.fast` (7) or fewer; else green, and green with no demand measured. Until 04 Nov yellow was promised past the shelf (now red) and nothing read demand. The basis, a replay of every book's days from 26 Jun to 04 Nov 2026 with the engine's forecast: 7 days caught 88% of the times the shelf fell under one usual order within a week (62% of those lit came true); 3 days caught 65% within three days (71% came true). `restockSupply` adds the day, kept only while the light is not green and the day is not past. The Desk asks for its demand through `lightDemand(p)`; the publish through `supplySnapshot`'s `coverDays` and `usual`.
- Stock's Restock date card (Enter's until 17 Oct 2026) (and the Today row "Restock date: not set", Now on red, This week on amber, none on yellow, `expAsks`) sets one day a book through the keyed `/expected`, relayed to the Counter's KV `expected` (`{<book>: "YYYY-MM-DD"}`). The name is `expected` because `restock` is the engine's reorder plan.
- The publish (`tools/book.mjs` `supplySnapshot`, `tools/pricelist.mjs` `supplyLights`) seals `{light, by}` on each product of every customer's list, outside the digest. A date set shows at the next publish, within the hour.
- **A light turning wakes the Desk once** (19 Oct 2026, `tools/stmt-publish.mjs` `stockWake`): the publish keeps the lights it sealed in the Counter's KV `stocklights` (`{<book>: light}`, in the same bulk put) and, when a book turns amber or red from a better colour (yellow, Selling fast, wakes nothing since 04 Nov 2026), posts `{"tag":"stock"}` to the Desk's `/push/send` with CI's `SALT_PUSH_KEY` and the Access headers, after the put. A light that holds or gets better, and a book the last publish did not light (a first run, an unread store), posts nothing; no key posts nothing; a failed post is a line in the log. No book, code or figure travels.
- The Counter draws the light as a dot and its word beside the coin (`salt-light`, plan version 10; the border retired): verdigris Available, amber Selling fast, orange Low on stock (`--salt-orange`, salt-ds 1.26.0), ember Out of stock, the word in the mark's name, and "More by DD Mon" under any but green. Salt Admin's Stock by book chips the same four (`salt-status--verdigris`, `--amber`, `--orange`, `--ember`).
- **Made plain** (22 Oct 2026, his word: the outline alone was missed; `docs/plan-restock-light.html`): Counter Home's **Availability** (`homeSupply`, above New order) is a row a lit book, its mark in the border and the light in words, More by under any but green, no figure; a row opens Prices at that book. Salt Admin's **Stock by book** (`drawStockBooks`, under Needs you's glance) is every book, the worst light first then the least cover, with its shelf, agreed, free, days of cover and next lot; the light is `STOCK`'s own (`stockSnapshot` asks the engine's `restockLight`, carried by `makerStock` and `stockWithDates`), and the card is read again on each tick of the Needs you poll. The word stock may stand on the Counter (his word of 22 Oct 2026, reversing F4's ban).

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
- **The forced pass** (`tellSite`'s `opts.force`) skips the "already told this version" exit, so it runs on a version the Counter was already told of, and it leaves `orders:told` and `orders:toldFailed` to the regular pass, which owns them: a clean forced pass does not move the mark past a fold it never read and cannot hide the regular pass's fault from the tie-out. **It follows single orders to their rows** (17 Nov 2026, his "Can it be instant?"; `followRows` with `solo`): with the Book the source his Approve books an amendment at once and the Correction names its row by rid, so the order's `ledgerKey` moves within seconds of his tap instead of on the next minute (a row found without a rid, or behind a close or re-date not yet compacted, still waits for `landed`); a group of orders sharing one row is still weighed only by the regular pass, its members never moved alone by the forced one (Fable, 28 Oct and 17 Nov 2026), and a key the site will not take is left to the regular pass to try again and report, never a fault of the outbox's rows. The regular pass is unchanged, still runs when a fold changes the version, and stays the net for everything no tap booked (a hand fold, `rwd`, a phone's undo, the fixes).
- **It tells only the orders its rows name** (21 Nov 2026, item 4 of `docs/plan-ledger-simplify.html`). The drain reads each live draft's entry, its `row.rids` (the Book's, written beside the approval) and its `amends`, and passes `only` to the forced pass; `orders.js` `onlyOrders` resolves it on the book read: the order the entry names (an order's own stage, a claim of theirs), the orders whose `rid` or `ledgerKeyOf` is a named row's rid or `ovKey`, the orders an amendment's row carries, and every order but the cancelled and declined of each named row's owner code (credit only lowers, an account claim pays several rows, and a finished order an amendment or undo reopens takes its row's states). The shared groups are weighed over every order before the filter, so a member is still held out of the singles, and `followFree` still weighs a key against every order. A draft that names nothing, or a set that resolves to nobody, runs the whole forced pass. The regular pass is unchanged and is the net: every tap moves the Book's revision, so it runs within the minute and tells whatever the narrowed pass left out.
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

## The flip (S5f): the dormant parts (28 Oct 2026; every one dormant while D1 `book_source` reads `d1`)
The flip makes the Book the source of the ledger: an approval is booked by the tap and is not a version, git's `ledger/book.json` becomes a daily export, and the fold stops. Plan: `docs/plan-book-s5-s6.html`. The flip itself runs only on his typed go, on or after 4 Nov 2026, and only when `tools/flip-gate.mjs` reads every line true. What follows is the code the flip needs, built and live before it, each part its own version.

### S5f-1: the source flag (v1310)
- D1 `book_source` (migrations/0023, applied alone to the live D1 before the deploy, read back `d1`), one row, `'d1'` or `'book'`, **shipped `d1`**. `sourceMode(db)` in `src/book-tap.js` reads it like `rosterMode`: anything but an exact `'book'` (a missing table, an empty row, a store that will not answer) reads `d1`, the old world. Every guard below keys off this one read.
- Turning it is `tools/flip.mjs` alone (S5f-7), never a bare statement: the bare `UPDATE book_source SET mode='d1'` is not a way back (see S5f-7).
- Tests: section "Book S5f-1", 5 checks, 7 mutations.

### S5f-2: a compaction moves the base's watermark (v1311)
- `QUEUE_COMMITTED` is the newest queue entry the base holds (a draft's id is its queue entry's `at`). The fold moves it to the newest id it folds; a replay never does. So a compaction that closed entries and left it behind would have the S5d page count a phone's queued entry twice: the new base holds the sale, the entry is no longer open (so the served `booked` ids do not name it) and it is not under the old mark. `compact()` now sets the base's `QUEUE_COMMITTED` to the newest draft id it closes, before the plan is prepared, so the load that writes the base writes the mark with it; never lowered.
- Proved on the recovery-test style object (a Book over node:sqlite), never the live Book: dry moves nothing, a refused compaction (a stuck entry) leaves the mark, the view's money is unchanged by it, the revision moves once, and the page's `bookTrimQueue` drops a queued entry at or under the served mark.
- Tests: section "Book S5f-2", 12 checks, 5 mutations.

### S5f-3: the guards, his answer to Ask B (v1313; every guard keys off `book_source`, so none moves while it reads `d1`)
- **A load is an import.** `POST /book/load` with `book_source` = `book` answers 409 (`source: "book"`) unless the request carries `?import=1`: a load replaces the base with git's book, which after the flip is only the last daily export, so the chain's load, a replayed fold or a stray run would write yesterday over today's taps. `node tools/book-load.mjs --import` is the laptop's way to send one on purpose (a hand edit made in the checkout, Ask A's rare case); the key is still needed. The chain does not load in that world.
- **`POST /book/compact`** (`src/book-compact.js`, a CI route on the Book's key; `?dry=1` rehearses in either world, a real run needs `book` and says so in a 409 otherwise). Order matters, because a booked draft is on its way to a reader (`src/way.js`) until the reader's book holds its row, and a draft committed AFTER the base's `at` still is: (1) every open entry's draft is marked committed in one batch while the entry is still open (the view holds the row and the draft is committed: counted once); (2) the Book compacts (S5f-2 moves the watermark with it); (3) any draft the compaction closed that is still unmarked (a tap that landed between 1 and 2) is marked AT the compaction's own moment; (4) a read-back counts none left. An open entry whose draft is not approved refuses the whole thing with nothing marked. A retry after the Book compacted and D1 was not marked finds nothing open and marks from the Book's own event log (`/events?all=1`), at the Book's latest moment. Counts only in the answer.
- **The fold stops dispatching.** `redispatchStale` (the 15, 30 and 60 minute ladder) returns at once with `book`; an approval's own dispatch still goes (the chain publishes after it) but is named `publish: approval`, since the chain stages nothing. `/book/readcheck` also answers `source`.
- **The laptop.** `tools/source-flag.mjs` reads the flag through wrangler and FAILS CLOSED: a missing table is `d1`, a refusal is unknown, and unknown stops the road, since guessing `d1` could write a second ledger over the Book. `drafts.mjs --approve` and `update.mjs` (not `--dry`) exit 3 with the reason; `drafts.mjs --approved` hands the chain nothing (`count: 0`, `held` says how many approved rows wait) and stops on an unreadable flag.
- **The chain** (`cloud-commit.yml`): one step first, `Which store is the source of the ledger`, writes `mode`; the stage's guard (which gates reading, committing and folding), the mirror's re-seed, the shadow load, the readcheck and the statements comparison stand down on `mode == book`. The deploy, the gate, the publish and the pricing parity still run. Reading it fails the run when D1 will not answer.
- **Not yet** (the next parts): the staleness tests are still on the git version (S5f-4), the export job that gives the publish a current book file (S5f-6), the edit entry (S5f-5), and the runbook (S5f-7). Until then nothing may turn the flag.
- Tests: section "Book S5f-3", 32 checks, 37 mutations (the chain's are run on an LF checkout).

### S5f-4: the staleness tests move from git's version to the Book's revision (every change keys off `book_source`; with `d1` each answer is what it was)
Why: with the Book as the source an approval is not a version, so everything that asked "is this the book I read?" by comparing git's version (the D1 snapshot's `v`) would stop moving, and a frozen mirror would answer for the Book. Found by grep, one by one:
- **The Book carries two revisions.** `rev` (S5a) moves with money. New `derived_rev` is the revision the derived documents (PRICING, OPEN, TERMS, REWARD, STOCK) were computed at: a load sets it to the revision it leaves (it brings the documents), a tap, a void and a compaction leave it (`keepDerived`), so `rev - derived_rev` is how far the documents trail the book. `/at`, `/revno`, `/read` and the export carry both; the memoised view's key carries them too (redundant today, since every revision move also moves the open entries or the loads, and kept so a future move that does not cannot serve a stale answer). A Book before this gains the column at 0. Part 6 adds the verb that refreshes the documents between loads.
- **The readers** (`src/book-read.js`). `sourceMode` moved here (re-exported by `book-tap.js`). With the Book as the source `readMode` is `book` whatever the readers' flag says (that flag is the way back while git is the source), `fromBook` skips the "Book trails the mirror" test (the mirror is frozen then) and marks its answer `source: "book"`, and a Book that is not bound, answers 503, throws or answers no revision THROWS `BookDown`: the drafter, the way bound and the readers never fall to the frozen mirror, since pricing and booking off yesterday is the fault the flip exists to avoid. With git as the source `fromBook` is byte for byte what it was.
- **`versionToken(db)`**: the one place that says what "the book's version" is for a staleness test: the snapshot's `v` with git as the source, `book@<rev>` with the Book as the source (its cheap `/revno`), a throw when it will not say. `bookOf` gives the Book as the source `version = book@<rev>` and stamps PRICING and OPEN with `v = book@<derivedRev>`, so the drafter's own flags (`flagsFor`: "The pricing snapshot was taken at X but the mirror is at Y", and the two open-order ones) fire exactly when the documents trail the book, and the preapproval digest's `{v, digest}` carries the document revision.
- **The told mark and the tie-out** (`src/orders.js`): `tellSite` stands down only on a mark equal to the token, read BEFORE the book (a tap in between makes the next pass run again, never skip); `tieOut` times a stall from the first pass that saw the revision (KV `orders:seen`, since the frozen mirror's moment says nothing) and names the revision, not a git version.
- **A live order follows its row past a cancelled order's key, and the tie-out speaks plainly** (20 Nov 2026, `followFree`, `tieWho`, `oneAnOrder` in `src/orders.js`; his word on the Ledger check's three differences). An order takes its row's new key only when no other LIVE order names or is moving to it; a cancelled or declined order naming that key is no claim on it, provided the book reads the key as one row with a cancelled row kept apart (`rowIndex`'s `rows` and `ended`: the ended order's row cancelled, this one the live site row), else the order waits for the cancellation to land; the drafter's `findRow` reads a key the same way, so the handover of an order that followed is drafted on its live row. Counted as a claim, a cancelled order of the same customer, day and figure held a live order on the key from before its amendment for good: its cash and handover waited for a row that had landed, and the book showed it unpaid and undelivered. An ended order's own move is weighed against every order, as before. The tie-out returns ONE item an order (`who`: code, book, size, total, day ordered; `what`: its sentences) and the count is of orders; a sentence never carries an order id, a key, or the words row, key or yes (checked on every kind of difference, `test/ledger-plain.mjs`); a tap whose order has no sale on the book is said as held, not lost, and never "tap it again"; a cancelled order whose sale is still live stays a difference whoever else names its key (Fable's review); the orders-behind item keeps `what: "return leg"` and `why` for the logs and adds `say` for the page. Salt Admin draws `who`, the sale's number and the sentences (`tieLine`), the book as its revision number (`tieBook`), and an order id only for a check filed before `who` existed. A pass runs only when the book's version moves or his tap forces one, so a fix here shows after the next approval and the next check.
- **The amend preview** no longer compares the data's version with the build's while the Book is the source (a code-only version moves no data, and would have answered "the Desk mirror is updating" to every amendment for ever).
- **Input admission** (`src/input-admission.js`): a reservation is held against the version the reader read; with the Book as the source that is the revision, spliced into the one-statement SQL as a literal after a shape check (`currentSql`), the check after the insert reading the same token. A committed admission stops counting once the revision moves, as one made at an older git version did.
- **The Counter's stamp**: `/stmt/rev` answers `<build id>.<Book revision>` with the Book as the source (503 if the Book will not say), the Counter takes `<16 hex>` with an optional `.<digits>`, and `tools/stmt-publish.mjs` seals `<id>.<SALT_BOOK_REV>` when the chain names the revision it published from (part 6). A statement sealed at an older revision is withheld as updating until the next publish lands, as one sealed at an older build was.
- **Kept on git's version, and why**: `book.js`'s older-load refusal (a load is an import now, its version is the code's, a revision never decreases); `book-tap.js`'s `v` for "Book behind the mirror" (equal while frozen); `book-read.js`'s `compareReads` (the readcheck compares the Book with the mirror, which the chain does not run with the Book as the source); `maker-inputs.js`'s `room.version` (two reads of the same `readBook`, so with the Book as the source it compares two revisions: a tap between them asks the maker to read the row again, as a fold did, and a Book that will not answer makes `rowRoom` read nothing, which refuses the move).
- Tests: section "Book S5f-4", 45 checks, 33 mutations (four of the needles are single-line so they run on a CRLF checkout too).

### Fable's review of S5f-3 and S5f-4 (29 Oct 2026), and what each finding became
- **Blocker, fixed.** An input admission (a reward unit or a loan repayment held against its balance) leaves `accepted` only when its draft is committed, and the fold's mark does it in the same batch; the compaction's marks did not, so a spent unit would have stayed reserved for ever. Both mark batches now release the admissions of the same drafts (`ADMIT`).
- **Should-fix, fixed.** A compaction the Book refuses takes back the marks that run made (the drafts and their admissions, only those it marked, by its own moment). A Worker clock ahead of the Book's is clamped to the base's moment for every closed draft (`CLAMP`). The Book is told which entries the caller checked approved (`/compact` body `{expect}`) and refuses one opened since, so a tap between the check and the compaction is never sealed into the base. A money tap's room check (`rowRoom`) throws `BookDown` instead of reading an empty book. The tie-out's due test compares the token the pass itself uses, so it is not due every minute with the Book as the source. The minute net asks for a publish when it books or voids (a revision moved, and a statement sealed before it is withheld). `d1.mjs --seed` is refused with the Book as the source.
- **Held for part 6 and the gate, not fixed here.** The publish still reads git's book file and `SALT_BOOK_REV` is set by nothing until the export step exists (part 6); `tools/flip-gate.mjs` therefore proves that step is in the chain rather than trusting the runbook. The `source` step runs on a push too, so with git as the source a wrangler failure fails a code push's deploy (Workers Builds still deploys). The flip's gate requires no `_to_fold.json` or `_folded.json` in HEAD. A revision that lags `derived_rev` flags every draft until part 6's refresh verb. A concurrent tap can withdraw an input admission ("the book changed during admission"): correct, retried by the maker.

### S5f-5: the `edit` entry, his answer to Ask A (migration 0024 applied alone before the deploy)
- **What it is.** Two common hand edits as an entry he approves in Salt Admin and the tap books like any row: `refundPaid` (a refund the book still owes marked paid, with the day it went back) and `refundRemove` (a stale refund taken off). A refund has no id, so it is named by party, since and amount and must be the ONE open refund those pick out (`editRefunds`, the engine's); twins that cannot be told apart are refused with the reason. The rare edits stay the laptop's: `node tools/book-load.mjs --import`.
- **Layers.** `migrations/0024_draft_edit.sql` rebuilds `draft` with `edit` in the CHECK and makes the four indexes again (a rebuild drops them; apply it ALONE, read the row count and the four indexes back); `engine/position.mjs` `editEntry` and `editRefunds`; `engine/apply.mjs` plans (refuses: unknown kind, no day, no or several matching refunds) and applies (`customerRefunds` changed in place; a re-run finds it paid or gone and does nothing); `src/drafter.js` drafts it (checked against the Book's read when it carries the refunds, flagged "not read here" when it does not); `src/maker-inputs.js` `makerEdit` and the catalogue's `openRefunds` and `editWaiting`; the route `/_internal/maker/inputs/edit` and `/all/maker/inputs/edit` on both Workers; Salt Admin's account card gains a Refunds section (`refundSection`, each of Mark paid today and Remove as stale asks once and goes to Approve).
- **A compaction and a refund that has no rid.** A refund is keyed by its content, so marking one paid reads as one row gone and one added, and removing one as one gone: the strict load used to refuse that for good (the S5a caveat). It now allows exactly as many rows to go as the edit entries it folds (`tap.edits`), and compares `customerRefunds` when one was folded (`EDIT_PURE`), so any other row lost still refuses the whole compaction.
- Tests: section "Book S5f-5", 26 checks, 29 mutations.

### S5f-6: the export, the derived documents and the daily notes (his answer to Ask C; dormant, the chain runs it only with `book_source` at book)
- **Two new Book verbs**, both CI routes on the Book's key and both refused (409) with git as the source, since git's load is then the only writer of what the Book holds. `POST /book/derived {derived, forRev}` refreshes the derived documents (PRICING, OPEN, TERMS, REWARD, STOCK) for the revision they were computed over: it moves no `rev` (a statement's stamp must not change because a document did), sets `derived_rev` to `forRev`, and refuses a revision ahead of the Book or older than the one it holds (S5f-4's flags read `rev - derived_rev`). `POST /book/notes {notes: {rid: text}}` writes a note into a row of sales, purchases or loans whose note is blank, only into the BASE (a row an open entry holds is not in it yet, so notes are written after a compaction), never over a written note, at most 200 a call and 600 characters each, moving the revision once.
- **`tools/book-export.mjs`**, the step the chain runs. Every book-mode run: the Book's view (the base with every open entry) is fetched (`GET /book/ledger?view=1`, which now also names `tapped`, the rids the tap booked), written as `ledger/book.json`, the master's baked block brought level (`booksync --sync`), the derived documents computed over it by the page's own jsdom (`ledger.mjs`) and sent back for the revision exported, and `SALT_BOOK_REV` written to `$GITHUB_ENV` so the publish seals `<build id>.<revision>`, as `/stmt/rev` answers (S5f-4). The DAY's run (a dispatch with `export`, which the Desk Worker sends from 00:05 Kuala Lumpur, or a scheduled run the rule finds due; see "The day's export, asked for" below) also compacts first (S5f-3) and writes the notes behind the rows the tap booked (never behind a row git's fold wrote with none).
- **The chain** (`cloud-commit.yml`): `Export the Book to git (the day's record)` (plan `export=1`, a deploy): `roster-export --apply` (usernames, places), `book-export --day`, build, gate, then commit and push as the runner, no version (a version is code only after the flip), before the deploy is decided; `Export the Book to the checkout for the publish` (every other book-mode run, uncommitted), before the publish. A failure stops the run before the publish, so a statement is never sealed from a half export. The dispatch gains an `export` input. Both steps run only with the Book as the source, and stand down with git as the source (`SALT_BOOK_REV` is set by nothing then, so the stamp is the build id alone).
- **Not built, said**: the model's own note (his D7): what is written is the tool's deterministic line saying no model wrote it, as `tools/foldnotes.mjs` does for a fold with no model; a follow-up replaces it where the model key lives. The replay check of the export against git at every fold has no fold to run at; with the Book as the source the export is compared by the checks that remain (the load's parity is not run: `book-source.mjs --compare` and the readcheck compare git's file with the Book, which the day's commit makes equal).
- Tests: section "Book S5f-6", 25 checks, 25 mutations.

### The day's export, asked for (14 Nov 2026, his answers to the day-export plan)
- **Why.** The plan step exported a scheduled run only if it started before 06:00 Kuala Lumpur, and GitHub creates scheduled runs two to six hours late (median 235 minutes for the 00:23 slot over 30 days to 14 Nov 2026), so 12, 13 and 14 Nov 2026 had no export. The Claude Console (a Managed Agents scheduled deployment) was planned and set aside on his answer: the export reads the Book through the Desk in any case, and the Worker's GitHub App does not lapse as a token does.
- **The one rule** (`src/day-export.js`): today's export has landed when the `chain` job's step named exactly `EXPORT_STEP` ("Export the Book to git (the day's record)") has conclusion success and its `completed_at` on today's Kuala Lumpur date, in any attempt (jobs read `filter=all`), from runs created since six hours before the day began, every page; jobs are read for dispatched, scheduled and still open runs only. GitHub gives a step no id, so the suite pins the name to the workflow. A reader that cannot list runs throws, so silence never reads as no export. No count is kept elsewhere.
- **First road, the Desk Worker** (`exportAsk` in the minute cron, before `publishWanted`): with D1 `book_source` at book, from 00:05 to 06:00 Kuala Lumpur, the rule is read at most every 10 minutes; while it has not landed and no chain job is waiting or running (`chainBusy`), it dispatches `cloud-commit.yml` with `{stage_only, export, reason: "export: the day <date>"}`, a try at most every 30 minutes and four a night, the try counted before it is sent. A dispatch that goes writes the publish mark (`publish:dispatched`), since the export run publishes, so 00:05 still sends one run; a refused one leaves the day's publish to send its own. KV `export:night` {day, done, tries, tried, read, asked} keeps the pace only; `export:landed` {day, run, at} the last day it saw land. An approval that replaces the waiting export run costs one try.
- **Second road, GitHub's clock**: the plan step, on a scheduled run, calls `node tools/day-export.mjs --due` inside its `if`, with `GH_TOKEN` from `github.token`: exit 0 due (nothing landed today, the export step has not failed today, and no run titled "Cloud commit: export: the day <today>" is waiting or running, the asking run left out), 1 not due, 2 cannot tell; only 0 exports, and no answer turns the step red. A dispatch with `export` always exports; nothing exports while git is the source.
- **The warning**: the 09:00 digest (`exportAlarm`) reads the rule; no export today writes `inform:last` {k: `export`} and a GitHub that will not answer {k: `export-unchecked`}, then the digest sends its own `salt` wake, which a Desk device hears (it subscribes to `orders`, `approve`, `salt`; `sendPush` drops any other tag for it). `public/sw.js` `INFORM` holds the words of both. A Desk Worker that is down cannot ring; the export stops with it and the clock tries again.
- **A run GitHub never started covers nothing** (20 Nov 2026, the publish's own rule of 17 Nov carried here, `neverStarted`): a run still `queued` with no chain job listed more than 10 minutes after it was made is neither busy for the Worker's try nor in hand for the clock, so an export dispatch GitHub sat on does not hold the night; one whose chain job waits on the lock still does. If the first run starts late as well, the day has two exports, which costs minutes and nothing else.
- **A broken export never takes the publish with it** (Fable's review of 20 Nov 2026). Every scheduled run now exports while none has landed, and a failed export step stops its run before the publish, so: once the export step has FAILED today (`exportFailed`: conclusion failure, completed today, any run) the clock is not due and its runs publish alone; and a Worker try whose run ended with no export, which covered the day's publish with its own mark, is followed at the next read by a publish want of its own ("the export try did not land"), once a try, none after a refused try (it wrote no mark). The Worker's four tries are the retry for a passing failure; after them the 09:00 warning stands and the export is dispatched by hand.
- **The read, kept small and bounded** (the same review): the night's mark is written before the read and each GitHub call is timed at 8 s, so a read that outlives its minute is not begun again; a finished run is asked for its jobs only if GitHub touched it today (`updated_at`), which leaves the 00:05 read a handful of calls; a run list longer than five pages of 100 is refused as cannot tell, never read as the whole day; a re-run is judged by its current attempt's chain job alone; and just before the dispatch the Worker asks `cloudCommitWaiting` once more, standing down for a run that turned pending while the jobs were read. `--due` prints exit 2 as a `::warning::` on the run. The warning's moment in `inform:last` is the real clock's, as `/push/send`'s is, and it rings while a run is still exporting too: a ring a minute early is the lesser fault. `INFORM_TAGS` is unchanged: nothing posts these kinds to `/push/send`.
- Said, not fixed (Fable's re-check, both low): the publish is asked for again only at a read, and reads stop at 06:00, so a try made in the last minutes of the window whose run fails leaves the publish to the next want or the clock's run; and the publish's own `runStuck` ages a re-run from its first attempt (`created_at`), where the export's `neverStarted` reads `run_started_at`.
- Not proved until it runs: the `--due` branch is reached only on a scheduled run, so a dispatch by hand cannot show it; read the plan step of the first scheduled run after the version.
- Tests: section "14 Nov 2026: the day's export of the Book to git", 58 checks, 68 mutations (`test/day-export.mjs`): the rule, the reader against a stand-in GitHub, the plan step run in bash, the minute cron, the digest, and the phone's own worker run on the summary the Desk serves.

### S5f-7: the gate and the runbook (never run by this build)
- **`tools/flip-gate.mjs`** reads the plan's gate off the evidence and prints each line TRUE, NOT MET or UNVERIFIED with what it read; it exits 0 only when every line is true. Evidence: the chain's logs over the window (`gh run view --log`: "Book loaded ... tap: N closed, M open", "Book readcheck", "Pricing parity", "Book export"), D1 (the drafts the tap booked by kind, approved-and-unbooked past ten minutes, fallbacks, hand approvals, the flags and migrations), and his word for the backup opened with his key (`--backup-opened YYYY-MM-DD`). Lines: **G0** 4 Nov 2026 has come; **G1** every load `tap: N closed, 0 open`, no difference, stuck, clash or parity failure (an entry open at a load is clean when D1 shows exactly that many tap-booked drafts approved after its run began and before the load, each folded by a later run, his word of 04 Nov 2026; or approved before a run whose guard EMITTED "nothing new is staged on this run" (`##[notice]`, the last fold's deploy unfinished, so the run staged nothing by design), his word of 09 Nov 2026 after run 42198651019 of 06 Nov; it rests on the chain marking what it folded before it loads, which G9 reads); **G2** at least 20 taps closed, 5 new rows with a minted ID, a trip, a purchase lot, a Received; **G3** the readcheck green at every load; **G4** the net's left at 0; **G5** zero approvals that fell back (a fallback reading "the Book is at vN, behind vM" counts only from `GATE.behindFrom`, v1393's run, when the chain began loading the Book before it re-seeds the mirror; every other fallback counts, his word of 04 Nov 2026); **G6** PRICING equal to the page's at every load; **G7** the Book builds git's own statements at every fold (the S5e comparison), any export that ran is clean, and a Book backup was opened with his key; **G8** no `drafts.mjs --approve` and no row the fold took with no tap booking; **G9** the preconditions (migrations 0023 and 0024, `book_tap` on, `book_read` book, `book_source` d1, the export steps on master, the chain's Mark the folded rows committed before its Book load, no fold handoff in HEAD). Evidence that cannot be read is UNVERIFIED, never true.
- **Fallbacks are now recorded where they can be counted**: an approval that fell back is written on its draft (`row.tap_fallback {why, at}`, best effort, never throwing; `noteFallback`), because the log line alone cannot be read back. A fallback before this version is unrecorded, so G5 counts from the version that records them: read its detail line.
- **`tools/flip.mjs`** is the runbook. DRY RUN BY DEFAULT: it checks and prints the plan and writes nothing. `--go "<his typed words>"` needs every precondition (the gate true; level with origin; no run in progress; no approved draft unbooked; `book_source` at d1) and then: 0 the WAY BACK IS WRITTEN FIRST (`10_Data/flip-way-back.json`: flags, revision, sha, his words, commands); 3 `book_roster` on; 4 `roster-export --init`; 5 `book_source` to book (the guards of S5f-3 stand from here); 6 `POST /book/compact`; 7 dispatch the day's export and read it green; 8 approve one real row, then `--verify`. A failure stops the run where it is, says where, and points at the way back. It never touches `book_outbox`, `book_page`, `book_tap` or `book_read`. `--back "<his words>"` is the way back: it dispatches the export FIRST and moves nothing until told it ran (`--exported`), then `book_source` to d1, `book_roster` off, the mirror seeded from the export, and lists what was tapped since for a hand fold. `--verify` reads the flags, the readcheck, nothing unbooked, no fallback in the day. The readcheck line fails only on what says the Book is unwell (an entry stuck or under a draft not approved, a compaction refused, a side silent, an error, a source other than book) and counts the rest as the frozen mirror (10 Nov 2026): once the Book is the source nothing re-seeds D1's mirror, so PRICING and OPEN (stamped `book@<rev>`) differ from it at once and the sales after the first tap.
- **The flip ran on 10 Nov 2026** (his typed go, his window): way back written 02:57:10 MYT, the watermark `seq` 177 pushed (2033e25d), `book_source` book, compacted 0 and marked 177, the first export (its Cloud commit run, id in MEMORY.md: `source=book`, the Book at revision 368, 400 rows, pushed as ef61381; deploy, publish and suite parts 2 and 3 green), `--verify` ok at 03:29. The export writes `ledger/book.json` with each object's keys in alphabetical order (the same data, a 10,600-line reorder once); a needle written for the old order went red and was re-aimed (1e60e1f3). Three runbook faults met on the night, each fixed with its check: a Book call after minutes of `spawnSync` dropped (`bookFetch` retries, e55f735f); the roster export sent no owner login (bc6c34ec); a shell spawn split the commit message (`shellFor`, fd55a2b9).
- **From the laptop** (04 Nov 2026) the gate and the runbook reach the Book's routes with `SALT_BOOK_KEY` and his own Access login, `SALT_ACCESS_JWT` from `cloudflared access token` (`bookHeaders` in `tools/flip-gate.mjs`, the vault tools' `deskAccess`), so no copy of CI's service token is needed; the Worker lets the owner through to every `/book` route. Both live only in the window that runs the flip; a Book key made afresh is set on the Worker and in GitHub from the same value.
- **What the gate reads on the day.** Nothing flips before 4 Nov 2026 and every line must read TRUE. Read it with `node tools/flip-gate.mjs --backup-opened <date>`. The lines this build cannot make true by itself: G2 (needs the 7 days of real taps, with new IDs, a trip, a lot and a Received among them), G5 (counted only from the version that records fallbacks), G7 (his attestation of a Book backup opened with his key, which no tool can infer) and G9's export steps (live only after this version). The first read of the gate before the flip therefore will not be fully true; that is the gate working.
- Tests: section "Book S5f-7", 35 checks, 27 mutations.

### Fable's review of S5f-5 to S5f-7 (29 Oct 2026), and what each finding became
- **Blockers, fixed.** `tools/roster-export.mjs` refused without `SALT_BASE`, which the chain never sets, so every book-mode run would have failed at its first export step and the publish would never have run: it defaults the base as every sibling tool does. The gate could never read true: G2 counted new rows with a minted ID only among roster drafts (which the tap does not book while `book_roster` is off) and G8 counted those same drafts as folded without a booking. G2 now counts new sales, purchases and loans (rows that mint their own rid), and G8 leaves out roster and rename drafts and starts from the first approval the tap booked.
- **Should-fix, fixed.** `tap_fallback` is the tap's bookkeeping and is stripped from the ledger row beside `rids` and `booked_seq` (the fold and the Book's replay). The strict compaction's row budget is the refunds' alone: a row lost from any other collection, or a key of the state, refuses even with an edit folded (`goneOther`). G4's voided-without-rejection clause is now measured (the readcheck answers `voidedUnrejected`, counts only) and UNVERIFIED when it cannot be read; G5 needs seven days that were recorded (`GATE.fallbackFrom`, the version that records fallbacks), so the earliest the gate can read true is seven days after that version went live. The day's export is the first scheduled run that starts between 00:00 and 05:59 in Kuala Lumpur, however late GitHub starts it. The way back pulls what the chain pushed and makes the extract again before it seeds the mirror, dispatches no second export on its second pass, and has `--no-export` for a flip that stopped before anything was compacted; step 4 commits and pushes the roster watermark (the chain reads it from origin). A note is written only over the row version it read (`h` guard). Salt Admin's refund card says that removing a refund raises the money received by it.
- **Left as notes.** An edit draft has no `party` column on Approve's card and filters (the drafter reads it from `row.customer`). A refund with a null `since` is never listed (laptop only). A double tap before its draft exists passes the twin check (one refusal).

## The road a sale came by (4 Nov 2026, his answer A to `docs/plan-ledger-conventions.html`)

Every sale row carries `road`, the way it reached the book, and nothing prices, books or owes from it. `site` is a site order (the
one stream since 03 Nov 2026, Order for them included), `admin` a Salt Admin entry, `desk` the Desk's old form or the laptop queue,
`hand` a hand fold with no draft, `fold` a unit the fold raised. The engine names them (`ROADS`, `roadOf`); `applyEntry` stamps a new
sale from its entry for the fold and the Book's tap alike, and the reward and loyalty units carry `fold`. The 329 rows booked before
were stamped once from their D1 drafts (a best fit on rows corrected since: a handful may sit on a neighbouring road). A Correction
cannot set it (`CORRECTABLE`). Salt Admin shows it on a book row's card and a trip's details; the Desk shows it on the ledger card,
and typing a road's word in the ledger's search keeps that road alone. A hand fold made now writes `road: "hand"` itself.

**The queue takes no new sale** (4 Nov 2026, his yes): a new sale is a site order, placed by the customer or by him with Order for them. The
drafter's pass, its dry run and `tools/drafts.mjs --from-queue` refuse a new sale stamped from 04 Nov 2026 that carries neither an `orderId` nor a
`makerRequest` (`queueSaleFault`, `QUEUE_SALE_SINCE`), filed under `refused` with "a new sale is a site order now: place it with Order for them on
Salt Admin". An older entry still drafts (the watermark's rule); a purchase, a gift, a redemption and a change to a booked row go on as before;
`draftRow`, the law, is unchanged. The road `desk` stays on the rows it already holds.

### Every road that mints a sale, and its order (21 Nov 2026, item 2 of `docs/plan-ledger-simplify.html`, step 0)

A sale row is minted where the fold or the Book's tap appends to `sales` (`engine/apply.mjs` `bookItem`'s `row.rid = nextRid(...)`, and the reward
and loyalty units' own `nextRid` calls); everything else changes a row already booked. Each road, and how its row is named by an order:

| Road | Mints a sale? | Its order |
|---|---|---|
| Accept of a site order (the customer's Place, or his Order for them) | yes, `road: "site"`, the entry's `orderId` | **order**: the order names the row by its key (`ledgerKey`), followed as `rowIndex` reads a key |
| The older-sales import (`deskImport`, `tools/orders-import.mjs`) | no: it makes the ORDER for a row already booked | **order**: the imported order names the row by `rid` |
| Salt Admin's `sale` (`makerTradeBatch` for `sale`, with or without a cover) | yes, `road: "admin"`, a `makerRequest` and no `orderId` | **orderless**: refused from 21 Nov 2026 ("Order for them") unless `recovery: true` and D1 `sale_recovery` is on; such a row carries the drafter's `noOrder` flag and is listed until it is imported. The recovery road has NO control on Salt Admin: with the switch on it is a keyed call to the Desk's `/_internal/maker/inputs/sale` only, and an unsent sale Salt Admin kept is cleared on the refusal |
| Salt Admin's `gift` and `redeem` | yes, `goodwill: true` | **excluded**: a gift or a redemption is no customer's order (importOf's "a reward or loyalty unit the fold raised") |
| Salt Admin's `partner` and `edit` | no: a roster row and a market `edit` row | none needed |
| A trip's split (`trip-pay`) and join (`trip-join`), the rebate offset, `ledger-amend`, an undo | no: Corrections on booked rows | the row's own order, as before; a Correction that revives a cancelled row makes it live again, and it is listed if no live order names it |
| The reward unit and the loyalty unit the fold raises (`rewardOf`, `loyal`, `road: "fold"`) | yes, `goodwill: true` | **excluded** |
| A hand fold (`road: "hand"`) | yes, by hand | **orderless** unless an order names it or it is on the known list; settled, it is imported |
| The Desk's or the laptop's raw queue (`/queue`, `tools/drafts.mjs --from-queue`) | no new sale from 04 Nov 2026 (`queueSaleFault`); an older stamped entry still drafts | an older entry drafts with `noOrder` and is listed |
| A cancelled or written-off sale | (any road) | **excluded**: nothing more is owed or moved on it |

The reading is the engine's `orderlessSales` (`engine/stages.mjs`): a live customer row is named when a live order (not cancelled or declined,
not a test account's) carries its `rid`, or names its key and the row is that key's row as `rowIndex` reads it (the one live site row at a key
whose twins are cancelled, s395's shape; several orders naming one row is a shared group, whose sums the tie-out checks). A row importOf refuses
for a reason in `ORDER_NOT_NEEDED` needs no order. `ORDERLESS_KNOWN` names the rows known to have none yet, each with its reason: s182, s235 and
s236 (CN3-WM, still owing), s234 (a line of a trip whose other line an order names), and s053 and s208 (two live sales of one key, which no order
can tell apart). A rid leaves the list in a version once it is imported. The tie-out returns the rest as `orderless`, its own list outside `faults`,
`waiting` and `clean`, so `deskImport`'s clean gate still passes and a settled orderless row can be imported; Salt Admin's Ledger check draws it
under "Sales no order names".

### Every order follows its row by rid, version A (21 Nov 2026, item 3 of `docs/plan-ledger-simplify.html`)

Additive: the key stays the road for an order with no rid, and nothing is removed until version B, a week of no counted fallbacks later.
- **One reader**, the engine's `rowFor(o, idx, tally, reader)` (`engine/stages.mjs`): the row the order's `rid` names while it is live and of the
  order's own book, its key the row's key as it stands (so a Correction that moved the key moves no order off its row); else the row its key names,
  as `rowIndex` reads it. A rid naming a cancelled row falls back to the key. Every reader goes through it: the follow (`followRows`, where a live
  rid is followed as an older sale's order is), the return leg, `namedKeys`, the tie-out, `yesHeld`, `undoFixes`, the reconcile's open-row checks,
  money on its way, the Accept preview, a trip's first line, Not needed's own rows, `claimOrderFlight`, the taps' `orderRow`, and Salt Admin's two
  order-to-row lookups. `rowRoom` reads a row found by rid with what is on its way to its own key. The suite holds no `byKey.get(ledgerKeyOf(`.
- **The fallback is counted** for accepted live orders whose row is on the book, test accounts left out: the tie-out's `ridFallback` (count and
  the first 20 orders, kept with the check at KV `orders:tieout`), the return leg's `ridFallback` in its result. Version B waits for it to be nought.
- **The gate record** (21 Nov 2026, the rid-gate version): that count is one pass's snapshot and includes what the pass is about to stamp, so KV `orders:ridgate`
  (`RIDGATE_KEY`) keeps the run. Each kept tie-out that is ok writes `{v, at, since, count, repeat, stale, clean, last, why?}`: `last` the full fallback ids (at most 500),
  `repeat` those also in the prior `last` (a pass did not heal them), `stale` the `staleRid` length. A pass is healthy when it is clean with no repeat and no stale:
  `since` then stays, else it moves to `at` and `why` says which (one console line, `orders rid gate reset`). A tie-out that could not read the site or the book writes
  nothing, and a record not refreshed for 6.5 hours is stale. A failed read or write of the record never breaks the check or its stamps. **Version 3B is due when
  `ridGateDue(rec, now)` (`src/orders.js`) says so: `at` under 6.5 hours old and `at - since` 7 days or more**; the run on 30 Nov 2026 reads the record and mirrors that helper.
- **Every stage entry carries the order's `rid`** (`payload.rid`), so the drafter's `findRow` and a Fulfilment's target find the row by rid first.
  A Correction naming a rid whose row was cancelled, and no revival, is drafted against the row its key names, as before (Fable's M2), and a
  Fulfilment's target falls back the same way; such orders are still listed by the backfill and the tie-out (`staleRid`). A rid's row must be
  the order's own party (`ridLive`), `rowRoom` and Received's double-pay guard keep the key's reading for a stale rid, and `keyClash` passes over
  the order's own row.
- **The stamp** (Opus's M1): the minute's tie-out, when clean, offers each order it tied out by key with that row's rid (`stamp`), only for a live
  row of the order's own code, one row at its key, once the order's Accept row has landed (approved and committed), at most 40 a pass, and
  only with nothing waiting (`tieOutKept`, which keeps the check at KV `orders:tieout` with no `stamp` and sends each as a mark through `stampRids`).
  A dry backfill runs the check read only: it lets go of no stale yes. Orders sharing one row each take its one rid (his answer F). Never from
  the Accept draft, never onto a cancelled row, never while the check has a fault.
- **The Counter takes a rid once** (`decideDesk`'s mark, `ROW_RID_RE`, a letter and its number): a second rid only by a mark naming the first as
  `ridWas`, refused 409 otherwise; a replay over a moved order changes nothing. `rid` is never in `CUSTOMER_FIELDS`.
- **The backfill**, his to run (his answer E): `node tools/orders-rid.mjs` is dry and lists every order the clean tie-out would stamp (no cap) and
  every order naming a row no longer live; `--run` stamps them through the Desk's keyed `POST /orders/rid` (`deskRidStamp`) and reads each back.
  Refused whole unless the tie-out is clean with nothing waiting, and while an Actions run or an unfolded approval waits. No undo is needed: an
  order stamped reads its row as it did.

## Every conclusion's path: Show, then act (9 Nov 2026, his word and his answer "Show, then act")

Every conclusion on the Desk (a To do row, a Noticed card) and every ledger row has one shape. **Show** opens exactly what it names, on the Desk:
the rows a finding names alone (`goRows`, the Ledger's filter by rid, `ledF.rids`, said in `#ledRids`, Clear the way back), a party's statement
(`goParty`, the Ledger's own party filter), or, for a finding about the book as a whole, its page. **Act** opens the one Salt Admin place where it
is decided, through the Desk's `GET /admin?to=<address>` (`adminTo`, `adminLink`; a new tab, as the bar's Approve), which passes only the
addresses `ADMIN_TO` in `src/worker.js` lists and lands anything else on Approve; Salt Admin's address stays in the Worker's config.

| Conclusion | Show | Act on Salt Admin |
|---|---|---|
| A ledger row (tap opens its trail) | the trail | Change on Salt Admin, `row/<rid>`: the row in Record's sale form (`amendFor`, as Ledger check's tap) |
| Buy or reorder | On hand | Enter the lot, `record/entry` |
| Restock date | On hand, where the date is set | none: set on the Desk |
| N waiting on you | none | Needs you, `needs` |
| Chase | Their rows | Record it, `row/<oldest unpaid rid>` |
| Refund | Their rows | Mark it paid, `acct/<code>`: their account card, whose Refunds card files the edit entry |
| Rule breaks, past their habit, reward | Rules, Clients, Associates | none |
| Twins, no cost, undated, stale pending, same-day trail, under the floor | The N rows (`rows` on the observation) | each row's own Change |
| Any other Noticed card | its page | none |
| Every Noticed card | | Hide on Salt Admin, `tip/<id>`: Desk reminders with it chosen (`applyTip`) |

Salt Admin reads `row/`, `acct/` and `tip/` in `addrOf` as a want (`WANTS`, `wantGo`), each key checked, its own address replaced first so Back
leaves it; a want opens a form or a card and sends nothing. Codes and rids only ever reach an address, never a name (rule 2). Section "9 Nov 2026:
every Desk conclusion leads to the correct path" (`test/desk-paths.mjs`, 30 mutations red). A refund on a `-R` bucket opens its associate's account.

## The Desk cleanup and the what-if planners (10 Nov 2026, his word; plan `docs/plan-desk-cleanup.html`)

His word: fix the bugs, keep only what is worth showing, and make the Desk more interactive for planning. His answers: remove the
repeats outright; build the Restock planner and Month ahead (Cash on hand not built); plan inputs on this device.

- **One card a debt.** A credit rule a chase past its term already answers rides on that Chase card as chips; a Rule
  card is drawn only for a breach no such chase covers (`actions()`, step 5).
- **A partner at the Floor keeps rule 5**: `boundaryScan` raises no Margin floor row for a partner's sale at or over the Floor;
  under the Floor it still does.
- **Noticed draws three or more repeat-order notes as one card.** Each pair is still its own observation (its id, its hush, the
  snapshot's `obs`); only the drawing groups them (`tabPlans`, `dupOf`). A headroom under nought raises no card: the integrity
  note on sales under the floor names them.
- **Gone, his word**: Rules' Desk digest, Position at a glance and Latest ledger; Today's Money at stake chart; Financials' per-order
  and monthly cost tables (five lines of six read "not measured"); Sourcing's three loss tiles are one, The gap; an associate's
  stream with nothing in it is not drawn. Kept, against draft 1: "Pays your time to" (`COST_BOOK.hourRM` is set) and the
  Associates fold "What counts, and why" (the one place the reward scheme is written).
- **Round two (11 Nov 2026), his answers "off the Desk" and "one line".** Clients' Their % card (a row a customer a book, 260
  rows, 80% of the page, 218 saying nothing) is gone with `driftSay`, `suggestSay`, `tierQueued`, `atSizes`, `partnerQueued` and
  `partnerNote`; he sets a % on Salt Admin's account card. Clients keeps the heading and `pctLine()`, one line for the book in view
  (who holds a % he set, read as the card read it, and who the engine suggests another) and the link `admin?to=customers/accounts`.
  Associates says a departure and a vacancy in one line under the tree (`#nwStand`); the tree still marks the departed founder.
- **Round three (11 Nov 2026), Today's Noticed, his three answers (one customer card a book; rhythm only where it changes buying;
  repeat orders off Noticed).** Drawing only: `noticedDraw(live, hushed)` decides what Noticed draws from `observations()`, so every
  observation keeps its id, its hush and its place in the snapshot's `obs`. A book's habit card (`cust:cadence:<book>`) carries its
  message card (`promo:revive:<book>`) under the habit card's id, watch and figure, and a message card whose habit card is hushed goes
  with it; the weekday card (`rhythm:dow`) carries the weekend; the pay window, a holiday and the fortnight draw only at watch; no
  `dup:` pair and no `cust:oneanddone` is drawn. **At stake is what an Act or a Watch names, each once** (it added every figure,
  RM 5,299 against RM 2,420 on 11 Nov 2026). The tag legend line went; the v1498 repeat-order grouping (`dupOf`, `dupCard`) with it.
- **Round four (12 Nov 2026), Financials' two P&Ls, his answer "one P&L".** The monthly table (`tabFinancials`) carries what the IFRS
  statement carried, at `ifrsPL`'s own rates, so its year column is the operating profit (measured equal on all five books on 12 Nov
  2026): Freight in (a month's units sold times `freightPerUnit`, its basis on the row), Non-revenue (`nrsMonths`), Selling and
  distribution only when not nought (a month's share of the units sold), then the two provisions and **Operating profit** (was Result
  after provisions). `ifrsPanel` is gone; its value test is the row Lower of cost and net realisable value under Inventory.
  **`nrsMonths(p, X)` dates non-revenue by the count that found it** (Fable's option A): at each counted day up to today the shortfall
  is the opening plus units landed (`receivedOn||date`) less units handed over (the engine's `heldBefore`, now exported) less the count;
  a lot or handover on the count's own day is read either side of it, whichever moves the shortfall least from the count before (28 Oct
  2026's count came before that day's 25-unit lot); losses logged before the first count with a figure stand in their own months; the
  latest month takes the gap to `selfUse` (`pin`, said on the row); a month is never floored, so one under nought is stock a count found
  again. No count with a figure: the year carries it alone, said on the row. Said, not built: a surplus (`selfUse` is floored at nought,
  so the pin then cancels a recovery), and a book with no count once it trades across two calendar years (the year would carry the
  whole book). `X` is the suite's own sources (`test/desk-cleanup.mjs` L6). Fable's re-check: the nearest-candidate rule can hide a real loss on a count day up to that
  day's same-day movement, in a month only when that count is its last; the next count puts it back, and the year is never touched.
- **Round five (12 Nov 2026), Stock's On hand, his answers "totals, lots once" and "cut the repeat, keep the method".** Every
  non-revenue figure on the page is valued at `ifrsPL`'s `unitCost` (`nrRate`, the average cost plus a unit's freight in), so the
  tile, the shrinkage card and the reconciliation say what the P&L charges (the tile read RM 5,812 against RM 5,882). The Inventory
  reconciliation is totals: one "Received, N lots" line summing what landed; Lots and sourcing lists the lots once. The fold "Why each
  loss is booked where it is", which repeated the shrinkage card entry for entry, is gone; "How it is measured" stays.
- **The data faults (12 Nov 2026), his "Yes, data faults".** Three of the Desk's integrity readings misjudged the book:
  - **`lotLandings(lot)`**: a lot lands on each day its Fulfilment steps say (p026: 18.75 unit on 19 Sep, 18.75 on 20 Sep), the rest on
    `receivedOn||date`; one step for the whole lot dated before a stated `receivedOn` is the order as booked and lands on `receivedOn`
    (p019); steps past what was received land the lot whole on its day. `nrsDays` and the reconstructed inventory read it.
  - **The reconstructed inventory (`stockHistory`) takes shrink on the count that found it** (`nrsDays`, the per-day walk `nrsMonths`
    now adds up) instead of spreading `selfUse` evenly, which a book with no count with a figure still does; its first day reaches every
    landing and shrink day. Salt dipped on 6 days to -21.35, oil on 13: salt now on 6 days at most 2.6 unit each, all the book's own
    dating (sales dated before the lot that served them landed), oil, candy, rice and gas on none; every book ends on its count.
  - **The under-floor card** leaves out goodwill rows (reward units at cost) and a partner's own orders (they pay the Floor of the day by
    rule), keeping their -R resale and a typed one-off; it named 3 rows, none a real breach. **The no-cost card** leaves out a sale with
    nothing handed over (its cost is stamped at the handover). The three rows it names, s212, s221 and s230, are his to correct (cost
    RM 3.40, RM 80, RM 34 on the latest lot at their handover).
  - Said, not fixed (Fable): the partner exclusion goes by who is a partner today, so a row from before they were one is left out too;
    a sale handed over before the walk's first day would be dropped (none today); loans are undated in the shrink walk and land in its pin.
  - The three Corrections of `cost` were approved and booked on 12 Nov 2026 (Book seq 209 to 211, no fallback).
- **Associates' What counts, and why (12 Nov 2026), his word "the stale Associates fold".** It still stated v623's scheme (RM 470 of
  margin a unit, R3 against a hurdle 1.2 times higher, the whole ledger) three weeks after the walk replaced it. `rewardSchemeWords(prod)`
  reads the scheme in force: from the switch the unit chip is the walk's step (`times` units' landed cost, today's figure), the window
  "paid in full, from" the switch's day, and R3 counts a new customer's orders in their first `R3_DAYS` days at full margin, none after;
  a book read before the switch keeps the old words; a book with no reward says so. R3's branch says what R3 feeds (the stars, which
  read R2 and R3 over revenue, and the reward), never the rank, which orders by Made you. The fold and the chart say associate and they.
- **Analysis** holds only the last correction of a field against its row and never a note's prose; its empty-inventory tile counts
  a level within 0.05 of nought, never one rebuilt under it. **The Ledger trail** draws one Correction line a day.
- **The planners read and never write.** `planGet`/`planSet` keep `{dem, cost, run, lots}` in localStorage `salt-plan-v1`, clamped
  on every read (demand -50% to +50% in tens, buying cost -30% to +30% in fives, at most 12 lots inside 60 days). Nothing is
  queued, priced or booked, and the buying cost moves no Floor (rule 1).
  - **Restock planner**, Stock > Next 30 days (`whatIfCard`): a lot reaches the forecast only through `fwdOpts().whatIf`, so no
    other reader of `forecast()` sees it; it lands and is paid for on its day; the book table says what each book read without
    it (`per[p].base`). One tap adds a book's next lot as `restockFor` sizes it.
  - **Month ahead**, Money > Financials (`planMonth`, `monthAhead`): each live book's measured daily rate for 30 days at its last
    60 days' realised price a unit and today's replacement cost. Demand and buying cost move the second column only; running
    costs come off both. An estimate: no season, no price change, no lot timing.
- A prose block added to Financials or Receivables carries an id, or the render sweep (`stripMethod`) may delete it.

## Moved from CLAUDE.md, 19 Nov 2026: Hard rules, 5. Copy and price

   - **COGS is the latest purchase: its quote plus its trip freight, over its units** (the
     engine's `latestCogs`, `COST_RULE` kind `latestCogs` on every book, his rule of 05 Oct 2026).
     **A lot under its book's minimum is blended**: `COST_MIN` in the rules (salt 12.5, oil 10, candy 10, rice 100, gas 1), the newest
     lots newest first, each at its own rate, the last only for the units still needed, so cost is what the newest N units cost (his
     answers of 24 and 25 Nov 2026; the mechanism under "Pricing" at the head of this file).
     **The Floor is COGS times the size, the ORDER TOTAL rounded up to the next RM 5** (the engine's
     `floorTotal`, his decision of 18 Oct 2026), one per size and nothing else: no leak, no delivery, no
     time. **Salt's Floor also carries the non-revenue salt, re-measured only at a count, a recorded loss or a landed lot** (his decision of
     10 Nov 2026 and his answer H, built 11 Nov; `RULES.nrsFloor`, the snapshot engine's `nrsShare` over `nrsAnchor`: what was handed
     over, given or written off on or after that day waits for the next, so trading moves no Floor): COGS times 1 plus the share, the count shortfall, gifts and rewards with reward cover, and
     written off, over the units paid for, a unit settled in kind being paid for. **The Median Price stays struck on
     the COGS Floor** (`floorBase`, his answer "Floor first, Set and Ceiling to be determined"), so the Floor and the partner's
     price move with the share, and with them a salt discount, which is a place between the Median and that Floor; all three stand still between two measures. `costTotal` is the exact cost, for the readers that measure cost and not price (the price
     band's segment floor, the floor-per-unit chart); COGS of goods sold, stock value, `afterLeak` and
     `refundOnOverpay` do not read the Floor. The leak is measured and printed beside the Floor as
     information only (`afterLeak`, on a book losing `RULES.leakInfoFrom` or more). **The Ceiling is 3
     times the COGS Floor on every book but salt** (`ceilingX`). **Salt's Ceiling is a curve on the supplier's price for a 12.5-unit
     lot, never COGS** (his decision of 10 Nov 2026, `TIER_RULE.salt.band.ceiling`, the engine's `bandCeiling`): the typed anchor
     (`supplier`, RM 700 for 12.5 units, RM 56 a unit) over `per` scales `rates`, RM 200 a unit at half a unit sliding in the log of
     size to RM 100 at 12.5 and RM 83.93 at 100, flat beyond; the order total goes DOWN to RM 5 and is never under the Floor. **It moves
     only when he retypes the supplier's price**: a COGS near or past it leaves the Ceiling holding the Median (on RM 56, from about
     RM 52.60 a unit at the largest sizes and RM 62.65 at 12.5 units). A sale carries `delivery`, typed per
     row or offered from distance at `RULES.delivery`, his figure winning, and a lot `freight`,
     typed; `txGoods` strikes every rate on the goods. **What the customer owes is goods plus
     delivery, the engine's `txOwed`**; nothing reads the total less the cash. **Everything on an agreed order is
     amendable after Accept** (his decision of 06 Oct 2026): the units, the goods' price and the delivery charge,
     each a Correction for approval (`restateOrder`, stage `amend`, status `Amendment`) from Salt Admin and from
     the Desk; a completed order too, which opens again at Ready when the change leaves it owing (his answer of 17 Oct
     2026); the Floor holds, the board is never repriced, `rowRoom` and `payFault` apply, the site order and the
     ack digest follow the amended row, and a retry carries an immutable rid. **A trip of several
     books shares `trip` and its one delivery sits on ONE row** (`tripFault`; one tap approves the trip). **Every sale has its
     order** (21 Nov 2026, docs/DESK.md "Every road that mints a sale"): a new sale is a site order; Salt Admin's `sale` is recovery only,
     with D1 `sale_recovery` on, its card marked `noOrder`; the tie-out lists a row no order names as `orderless`, never a fault.
   - **SALT'S PRICE IS THE MEDIAN PRICE AND THEIR %** (his decisions of 05, 18 and 21 Oct 2026). **It was named the Set Price until
     10 Nov 2026 (his word): every word he reads says Median Price, a customer reads neither, and the identifiers stay** (`T2`,
     `ladderRow`, `TIER_RULE`, `PRICE_SET`, `drift`). **A stranger is quoted +30% on salt's band** (his word of 11 Nov 2026, "Always start a
     stranger at +30%": the guest board, `tools/pricelist.mjs` `guestBoard`, and a new ID that names no figure, `TIER_RULE.salt.start`), and a customer pays less only on a negative % of his: per size the Floor times a
     multiple (3 at half a unit, 2.4 at 1, 2.004 at 6.25, 1.596 at 12.5, sliding in the log of size, flat
     above 12.5; `TIER_RULE.salt.points`; 1.2 times the old 2.5, 2, 1.67, 1.33 by his word of 10 Nov 2026, RM 120 at 1 unit; the
     price band's version 1 moved none of it). The grid runs half a unit to 25 in quarters and is walked smallest
     first (the engine's `driftWalk`, read through `driftAt`, `quoteAt` and `quoteGrid`): the rate is the
     lesser of the last and this size's multiple on the EXACT rate, never compounded, so the quoted rate may rise
     by under RM 5 a unit between quarters; the price goes down to RM 5; it is lifted so the ringgit margin over
     the Floor never falls below the largest margin of a smaller size; and it is held between the Floor and the
     Ceiling. **THE MEDIAN MOVES WITH THE MARKET, BOUNDED, SAID AND SWITCHED BY HIM** (the price band's version 2, his answer B and his answers of
     11 Nov 2026; `TIER_RULE.salt.market`, the snapshot engine's `marketWalk` and `marketOf`, read by `driftWalk` as `P.market`): each day the
     Median goes to a place on the band, from supply alone (one plain cover at the start of the day: +15 at 3 days or fewer, +5 to 7, 0 to
     14, -10 past it), held -15 to +20, 5 points a day at most towards it, a stand-down for 7 days when margin a day falls two weeks running
     while it is up; the pace is said and NEVER priced (`acts` false: no measured basis); each day read off the book as it stood when the
     day began, so trading moves no price until tomorrow; nought before `since`, the day it shipped (13 Nov 2026, v1514). **Their % rides on the moved Median**
     (his answer): -100% stays the Floor, +100% the Ceiling, a partner the Floor. **His switch and his Median points are the book's `MARKET`
     document, written only by an `edit` he approves** (Salt Admin, `makerMarket`, the drafter's `marketEditRow`, the fold and the tap):
     off is the plain Median from that day, on climbs from nought, a point is a multiple of the COGS Floor at a size (`withPoints`, `ruleFor`),
     one outside the band asked once and marked. **THE PRICE TEST** (the price band's version 3, his answer G and his answer of 13 Nov 2026; `TIER_RULE.salt.test`, the snapshot engine's `testOf`, read by `driftWalk` as `P.test`): from Monday 16 Nov 2026 for eight weeks, 1 unit ALONE moves RM 5 up in its even weeks and RM 5 down in its odd, riding on the day's Median, every other size and the walk's state untouched, held between the Floor and the Ceiling, a partner the Floor, nought with his switch off; said on the Desk and Salt Admin, and the evidence leaves its sales out. The win-back at his Accept (`winBack`, `winBackOf`: a lapsed regular, 10 points under their place, never under -80%, never a write-off) is a suggestion his Use fills. The 90-day reading SUGGESTS a point (10 sales or more, RM 5 or more off); nothing
     re-anchors by itself. The evidence (the suggestion, the reading) reads the plain Median (`policy(C, p, true)`). The suite's frozen book
     holds the switch off. **Row zero of `ladderRow` is the Median Price and is load bearing** (phone, mirror and suite read
     `[0]`; the code stays `T2`); choose a row by code, never by index. `PRICE_SET` is cleared and the drafter
     refuses a new one; the one figure he sets at Accept, on one order, is that row's total, which `PRICE_SET`
     never records.
   - **THEIR % is his and nothing else's, ON EVERY BOOK** (`TIER_OF[code][book]`; 0 is the Median Price or the board; his decisions
     of 21 and 22 Oct and 10 Nov 2026). **The range is the book's own, read off its rule** (the engine's `liftRange`, `driftOk(v, rule)`,
     `rangeSay`): **salt's runs -1 to +1 on the band, a stated board's -0.3 to +0.3** (`LIFT_MIN`, `LIFT_MAX`). **ON SALT A % IS A
     PLACE BETWEEN THREE POSTS** (the price band, version 1, 10 Nov 2026; the engine's `bandTop`, read back by `bandPct`): -100% is
     the Floor, what a partner pays, 0% the Median Price and +100% the Ceiling, in even percentage steps, the Median as quoted times
     (Ceiling over Median) to the % above nought and (Floor over Median) to it below, inside the walk, down to RM 5, a lift never
     under the Median, held between the Floor and the Ceiling. **A salt figure travels as unit `band`; `pct` naming salt is the form
     before the band** (`unitOf`, `unitOk`): refused at Salt Admin's inputs, flagged by the drafter and dropped by the fold with a
     note, never read as a %. **The switch's carry-over is booked and gone** (the list he approved, `docs/plan-salt-price-band-carry.html`; his Approve of 11 Nov 2026 booked the
     15 places): the book holds each carried customer's place on the band, read as it stands, and no table or reader of one is in the rule or the engine. The old curve (`driftMultiple` over a rule's `ends`) stays in the engine
     for a rule that carries `ends`; none does. **Everyone held 0% at the band's switch; a new ID that names no figure starts at +30%**
     (his word of 11 Nov 2026, the fold's `fresh` start in `engine/apply.mjs`, only for an Add ID stamped from `TIER_RULE.salt.startFrom`, the moment v1514 shipped; a figure he picks, nought included, stands). He sets it on the customer's own card under Salt Admin's
     Customers (moved from Record, his yes of 25 Oct 2026), a whole % by a slider in steps of 5 between the ends the catalog gives
     (`driftMin`, `driftMax`, sent with `driftUnit`; Ambient's `amb-slider`, his word of 18 Nov 2026), its prices shown live off the Desk before it goes to Approve
     (`makerDriftPreview`, any whole %), or sets at Add ID on the same slider, a switch off for Not set, a preset's name said where it rests on one
     (Median Price at 0; a board's run -30% to +30%); it is queued, folded as `tierset`, and a null clears it. **Nothing automatic
     prices a customer but the bounded market move above**: the engine's `autoDrift` over `driftSignals` fills the card's good and bad only, and `suggestOf` (the engine's
     `suggestPct`) SUGGESTS a % he may take with Use the suggestion: on salt the median PLACE on the band of their
     last five salt sales (`bandPct` at each sale's own size, never under nought) plus a share for a write-off (30%), a long late
     or 14 days overdue (20%) or a late (10%), LESS a good record's discount (`suggest.good`, 30%, times `autoDrift`'s good score,
     only with nothing late, overdue or written off; his answer of 21 Oct 2026), to the nearest 5%, held to the book's range, and
     nought under `minSettled` settled rows. The fold refuses a `tierset` or Add ID
     figure stamped before `RULES.liftSince`, which was in the old drift unit.
   - **Oil, candy and rice are `fixed` boards**, his typed rungs held between the Floor and the Ceiling, the price for
     everybody at 0%; each carries `pct`, so it takes Their % (`pctBook`): `shares` are what -30% (80% of the board at
     the smallest rung, 90% at the largest) and +30% (120%, 109%) make of it, sliding in the log of size (the engine's
     `shareAt`, salt's proportions until he sets others). The suggestion, the reward and the loyalty unit stay salt's,
     and `tieredBooks` still names salt alone. **There are no price levels** (removed 18 Oct 2026): no `TIER_NAMES`,
     `levelAt` or proposal, and no standing guest link per level. `TIER_RULE`, `fiveTiers`, `TIER_OF`, the
     `tierset` collection and the `T2` row code stay as identifiers. **NRV on a book with a Median Price is the Median
     Price**, what a stranger is quoted, never the Ceiling nor a customer's discount. A cheap book put on a derived
     ladder inverts under the RM 5 rounding: check the rate law first.
   - **A customer's price is the Median Price moved by their %, or the price he sets on one order when he acknowledges
     it, never under the Floor; the board is never repriced by it** (`total` on the preview and Accept, the
     site keeping `asked`). **A figure he types under the Floor, on any book, or over salt's Ceiling, is asked once, then stands as a marked one-off** (his
     answer D of 10 Nov 2026, `engine/oneoff.mjs`; every book under its Floor by his word of 17 Nov 2026): a goods total under the Floor or over the Ceiling at its size, at Accept, in an
     offer or in an amendment of an agreed order, is refused 409 with `outside`, saying by how much and the ringgit it gives away;
     sent again with his reason (`oneOff`, one line of 3 to 120 characters) it goes through as any Accept or amendment does and the
     ROW carries `oneOff: {why, side, by}`, which the evidence leaves out (the drafter's `aPriceSomeonePaid`, the snapshot's
     `suggestOf`, the Desk's price readers); an amendment back inside the band takes the mark off, and an undo puts back the one it
     replaced. **The reason is his alone and reaches the ledger row, so it names nobody**; no customer reads it. A book with no band
     has no Ceiling to ask about; Correct a row still refuses under the Floor on every book. What they paid before never lowers it (the cap retired on his decision of
     27 Sep 2026). **A product with neither a Median Price nor a board is not priced.** One rule, the engine's
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

## Moved from CLAUDE.md, 19 Nov 2026: The one surface

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
Salt Desk** (the build's `apple-mobile-web-app-title`, the manifest's `name` and `short_name`), and its
`<title>` is Salt Desk too (his word of 24 Oct 2026; it was Salt Command), the build's anchor. The Counter's tab is
Salt Counter, Salt Admin's is Salt Admin and QR Command's is QR.

**Notifications: one event, one surface** (his answers of 19 Oct 2026, `docs/plan-notifications.html`). Salt Admin
wakes him for what waits on his decision (a new order, a customer's line, a claim, a cancellation, their answer to an
offer, rows to approve), through its own worker `/all/sw.js` and `opush:` subscriptions on the Counter: a customer's
move rung by the Counter's order book at the move (his answer of 19 Nov 2026, `docs/plan-ring.html`, with guards so the
Desk never rings it again), everything else and every ring the Counter could not make by the Desk's `wakeAdmin` over
`/desk/owner-wake`. Salt Desk only informs (folded and live, a fold refused, the suite red,
a refund held, the morning digest); it rings an order banner itself only while no Salt Admin device answers
(KV `admin:on`). Salt Counter's customer wakes are unchanged. A new event goes to one of the three, never two.

**Add ID**, **Amend ID** and **Approve** are Salt Admin's; the Desk reads them. A code is derived from the
name and place (`makerDerivedCode`), never typed or picked, and changes only when they change; Amend ID
re-keys it wherever the book holds it, prose and history keeping the old. The fold refuses a code
the master's own logic quotes (CJ4-OKR, SA5-BTR, SP7-PUD, CM6-HCM): those are hand folds.

**Coverage**, the map: districts shaded by a metric over a period, drilled to federal
constituencies, parties as dots. **Area names show; a party's name never does**, even unlocked.
Each party's place shows in words (`whereOf`). A place is its locality, then where that is
(`placeLocality`, `geoWhere`); it is chosen from `placePicks` at Add ID and Amend ID, or worked out from the point
in their Where field (`localityFor`: its district, then the nearest listed locality within 3 km; his D5 of 17 Nov 2026), and an
unlisted place is looked up in `geo/gazetteer.json`, built from GeoNames alone, never from the
directory. The leak checks exempt a directory place only when it IS an official area name
(`areaNameSet`) or a filed locality (`publishedLocalities`). Detail: `docs/DESK.md`.

**Money he is holding that is somebody else's is Now**: an open `customerRefunds` row is severity
`now` in `actions()` from the day it is raised. **Nothing closes a refund from the phone, except an Accept spending it as
credit, closed by the fold** (his word of 27 Oct 2026, `docs/DESK.md` "A refund becomes their credit"): paid out in cash, add
`paidOn` in `ledger/book.json`, `booksync --sync`, build. **A refund is never the book's money**: money received by book reads
`bookCash`, the row's cash less its refunds; cash flow keeps the till. **A refund the book no longer owes is flagged, never withdrawn**
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

**Five books** (salt, oil, candy, rice and gas; gas, opened 27 Oct 2026, took the place of the retired spare; prep, opened the same day, was removed
entirely on his word of 10 Nov 2026). `node tools/product.mjs` is the one road that opens, re-keys, retires, restores or removes one; it refuses
to retire a book with rows, to remove one with money on it, or to re-key salt,
a row naming no product being salt. What is keyed by product: `docs/PRODUCTS.md`.

## Moved from CLAUDE.md, 19 Nov 2026: The chain: tap to deploy

| Step | Where | When |
|---|---|---|
| Queue an entry | KV `q:<deviceId>`, `POST /queue` | on tap; held offline, retried every ten seconds |
| A customer's move tells the Desk | the order book rings Salt Admin, then POSTs the orders moved to `/_internal/maker/nudge`; the Desk runs the order pass on those (`ordersOnce`) | at once on their write; the minute's cron is the net (`docs/STATEMENTS.md` "The desk nudge", "The ring at the move") |
| Draft the row | Worker `src/drafter.js` | on arrival, plus the quarter-hour cron as the net |
| Approve or reject | D1 `draft`, `POST /drafts/<id>/approve`; Salt Admin's Confirm sends every card ticked in one `decide-many` (his word of 22 Oct 2026), refusals answered with a fix and one dispatch for the batch | on tap; a decided row returns 409 |
| Stage approved rows | Actions `cloud-commit.yml`, job `chain` | dispatched by every approval; again by the desk's minute cron 15, 30 and 60 minutes after the newest approval while one waits uncommitted (`redispatchStale`); at 00:23, 06:23, 12:23 and 18:23 MYT as the last net |
| **Fold, bump, build, push** | `tools/foldcall.mjs` (one Claude call for the notes) over `fold.mjs`, else `tools/foldnotes.mjs`; or any agent per `docs/CLOUD_FOLD.md` | same job; or on demand |
| Gate, deploy, prove, mark, re-seed D1, publish, Counter | same job | same job; or on push |
| Publish with nothing to fold | a `stage_only` run of the same job | the desk's minute cron, after a write outside git marks `publish:wanted` (`publishWanted`), and once each Kuala Lumpur day from 00:05 MYT |
| Suite, on the sha chain proved | job `suite`, outside the lock; a failure is red and written to the phone's refusals while the phone serves that build, never rolled back | once chain has deployed, unless a full green CI run already proved that tree (rule 8) |
| Prove repo and live agree | `ship-check.yml` | 11:00 MYT |

- **What is approved is the ROW, not the entry.** The phone leads with cost and margin read from
  the draft and computes nothing; the drafter's flags do the measuring, and a purchase is never
  measured with a seller's ruler. A card's flags freeze at drafting. **One tap a stage on a site order
  (his decision D6)**: the order card's yes is recorded in `preapproval` and spent by the drafter only
  if the draft equals what he was shown, every field, flag and (for Accept) pricing version, a later stage leaving
  out the flags that say only how old a snapshot was (`rowFlags`); else it waits under Approve, marked, a claim's row too. Accept moves the order only once its row is approved; a later stage
  tapped before the first row lands is booked when it lands, and the answer says so. A claim against the account (S6) is
  drawn as the engine's `claimAlloc` (goods out oldest first, then the orders at Ready, each owing all that is left, V2), each row less the money already on its way to it, and its one Received approves exactly those rows. **A row paid past what it
  comes to is a refund the fold raises** (06 Oct 2026, the engine's `refundOnOverpay` beside `refundOnCancel`, read off the row as
  every sale amendment folds and on the desk's overlay): a close at what was handed over or an amendment under what they paid is
  one tap like any other, and the difference opens as a `customerRefunds` row, Now until `paidOn`. **Cash received past what an order owes
  is taken** (his word of 27 Oct 2026; goods plus delivery the measure, `cashTap` carrying the excess as `refund`), refused only beside a claim
  of theirs, on an order owing nothing, with other money on its way to the row, or where the row owes another figure than the order.

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

- **No clock.** `Salt fold (manual backup)` is disabled (id in MEMORY.md): fire it
  by hand if the Fold step fails. The stage stands down while `master/_to_fold.json` is in HEAD,
  unless `fold.mjs --replays` says the batch is a replay.
- **The laptop's queue takes the same road**: `node tools/drafts.mjs --from-queue`. A decided
  draft keeps its id for good; re-drafting an entry he later calls real, and folding from the
  laptop (approve last), are in `docs/CLOUD_FOLD.md`. A ledger row edit queues as a Correction.

## Moved from CLAUDE.md, 19 Nov 2026: Sync and proof

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

## Moved from CLAUDE.md, 19 Nov 2026: Names

Codes by default; names only after a password. `tools/seed-vault.mjs` encrypts `salt_bio.json`
with `$env:SALT_VAULT_PASS` (never a file) and pushes the ciphertext to the versioned vault pair in D1 (KV only while the Worker's authority is not the pair); the desk auto-locks on
`visibilitychange`. **The vault is three envelopes under one passphrase; an address or an exact point
lives only in the second**: names and places, both in the D1 vault pair (KV `vault` and `vault-addr` are recovery material only; a place is `{<code>: {addr, lat, lng,
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

## Moved from CLAUDE.md, 19 Nov 2026: Access, two locks; the write gate

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
