# The desk: how the rules are built

`CLAUDE.md` carries the rules; this file carries the mechanism behind them, moved out on
16 Sep 2026 under the root token test. Read on demand. The dated record stays
`master/changelog.json`; the reasoning stays `docs/NOTES.md`.

## Pricing (hard rule 5)

- **The window is the last three lots** (rate and freight); **the leak is the drift of the
  last three counts** (`COUNTS` on the book, appended by every fold) over the units sold in
  those cycles, at landed; **the ask is a margin on the floor** (`ladderMargin`, `anchorG`
  per book), all v504. One floor per size since v502; `delivery` and `freight` typed per row
  since v503.
- **The ask IS the ladder's last level since v656** (his decision of 15 Sep 2026), so the line
  above describes the DERIVED figure, which is kept beside it as `priceLadder().derived`.
  `pxPolicy` carries `tierRule`; the override is the one line in `priceLadder`, and row zero of
  `ladderRow` follows it, still coded `T2` and named for the level. A book with no `tierRule`
  keeps the derived ask.
- **Tier 1** (v564) WAS stated at its ends in `LADDER.tier1` (salt 0.5:60, 12.5:875), the rate
  interpolated in the log of size between them, clamped outside; the ends printed verbatim
  because RM875 is off the ten grid, and `tier1.over` (v566) measured the RM by which it
  exceeded the ask. **Retired at v656**: `LADDER.tier1` is null and no book states a second
  level. `tier1Walk`, `tier1Anchors` and `tier1Ask` stay in the engine and still answer a book
  that states one, which is what the suite forces to prove them.
- **Stated prices retired with it.** `PRICE_SET[product].prices` is empty on both books (oil's
  RM130 to RM450 were his of 09 Sep), the engine's `stated` cannot reach the ask, Set the board
  is the hide list alone, and `src/drafter.js` refuses a `priceset` row carrying prices.
- **NRV is Titanium, not the ask** (v656). IAS 2.6 wants the price in the ordinary course, which
  is the levels his customers are actually on, and the prudent end of that range is the lowest
  level any of them is quoted. Off Bronze the IAS 2.9 test could never bind.
- **Ambassador** pays the floor, up to the ten, on his word alone and earning no free units.
- **The five tiers**, Titanium, Platinum, Gold, Silver and Bronze, are columns at multiples
  running evenly from 1.0 to 2.5 (v644: 1.0, 1.375, 1.75, 2.125, 2.5; 0.5 unit of salt starts
  them at RM50 to RM90 and 1 unit reads his RM100, 110, 130, 150 and 160), priced by his
  pricing workbook's formula: COGS to the ringgit times the multiple less a step a rung, up to
  the ten, each level at least a ten over the one below and the rate law walked under that.
  v641 drew the ladder, v642 named it.
- **Why the tiers come before the switch:** a switch alone draws every existing price list up
  toward Bronze (all 36 salt and all 6 oil customers with history, measured 15 Sep 2026).
- **The profile** (v666, his decisions of 16 Sep 2026). `buyerProfile(code,prod)` reads a customer's own
  priced orders and returns a name (one-off, small and often, small and rare, large and regular, rare and
  large, consistent mid, occasional mid) and six flags: `frequent`, `small`, `bigger`, `loyal`, `rare`,
  `lateTwice`. The thresholds are one constant, `PROFILE_RULE`, cut from the book on 16 Sep 2026: the median
  customer then bought 1.83 times a month, one and three units were the lower and upper quartiles of size,
  and the whole book was under three months old, so loyalty is counted in orders rather than time. Orders a
  month are read over at least 30 days, or every new customer arrives frequent. **Late** is an order paid
  past `RULES.creditDays` (10) or still owed past it; a write-off is not counted, having its own rule. On
  the book that day: small and often CR3-DAM, CA4-DAM, CC5-OKR; loyal eight; late twice nobody. CH5-KLC,
  who pays RM180 a unit for half-units, reads small and RARE, so a rule keyed to frequency does not hand
  a premium buyer the preferential rate. **It prices nothing at v666**; the rules that move a level on it
  come after the level can vary by size.
- **A level per band** (v670, his decisions of 16 Sep 2026). A held tier is one level name, or a band set
  `{small, mid, big}`: small is an order up to and including `PROFILE_RULE.smallUpTo` (1 unit), big from
  `bigFrom` (3), mid between, the cuts being the book's own quartiles of size. `PRICING_ENGINE.levelAt(held, q,
  bands)` turns a size into a level for the desk (`cardTierAt`, so every `cardQuote` and the printed board read
  their own size's level), `tools/pricelist.mjs` (each size of the customer's page) and nothing else; a band left
  out takes mid, a missing mid whichever of small and big is there. `levelShapeOk` is the one shape check, used by
  the drafter and the fold, and a refused shape names itself. `cardTier` still answers "is this priced at all" and
  reads the NORMAL level, a mid-sized order's, which is also the mark on the customer's page. On the Tiers card a
  band set is spelled out, its dropdown selects "Keep the bands", and Set leaves it alone: without that, Set read
  the unmatched dropdown as not set and queued a clear. **No band set existed on the book at v670**, so all 50 price
  lists were identical before and after; the rules that propose one come next.
- **The four rules** (v671, his rules of 16 Sep 2026). `ruleProposal(code, prod, boards)` takes the level
  `tierProposal` reads off what they pay and moves it on their profile and the stock, in this order. (1) Rare and
  late twice: one level worse at every size, Bronze staying Bronze, and no promotion reaches them. (2) Frequent and
  small: one level worse from 3 units, their normal level below that, and NO better level on half a unit or a unit,
  his decision that day, because a card is never above their own rate and these customers pay a keen rate on exactly
  those sizes; on the book the three of them were proposed Titanium, where the only better level is Ambassador, his
  word alone. (3) Loyal and buying bigger: one level better from 3 units, never past Platinum (his "not Ambassador or
  Titanium"), and never a level worse for a customer already above it. A customer who is both (2) and (3) takes (2).
  (4) `slowdown(prod)`: a day is under when the three days ending on it sold under half the typical day of the 28
  ending on it; the under days are counted back from today and the count stops at the latest lot received, so a lot
  ends a promotion and only three more quiet days after it start a new one (counting through the lot restarted a
  promotion the day after every restock, caught by a forced check). With three running, every band is offered one
  level better, never past Platinum and never worse. Bands that agree return one level. **A held tier is never
  moved**: `heldLevel` reads `TIER_OF` first. A proposal is what an un-held customer is quoted, so the rules move live
  prices: on 16 Sep 2026 four customers, CM4-MK cheaper from 3 units (12.5 units RM1,060 to RM960) and CR3-DAM,
  CA4-DAM and CC5-OKR dearer from 3 units (RM860 to RM960), 28 prices, net +RM650, with no slowdown on either book.
- **Setting a customer's tiers** (v643; one for each product since v646): on Customers, the
  Tiers card carries a dropdown for each product with Not set, Set queuing only what changed,
  or Accept for every open proposal. Or chosen at Add ID as a new customer's starting tiers
  (v645: Bronze on each product by default, not set leaving one out, for a customer or either
  kind of associate, never an end buyer, a bucket or a supplier), which the fold files with the
  registration. A new customer starts at Bronze.
- **Proposals** (`tierProposal`): a product with none held is proposed the tier nearest what
  they pay for it a unit **at the sizes they buy** (v655, so a size they never take cannot decide
  their level), never Ambassador; one they have never bought is proposed nothing and reads
  not set, and the card lists customers who have bought nothing yet.
- **The price** (v651): the price of their tier for the product at the size, held or
  proposed, lowered by their own rate (**the best of their last four orders** before the week's
  Monday, v655 on his reading that a sale struck is the best price strikeable; it was the median
  until then) rounded DOWN to the ten, and lifted only to clear the floor, so a long-standing low rate
  can sit under Ambassador at the smallest sizes. **v660, his instruction of 16 Sep 2026: down to the
  ten and never up.** It was the NEAREST five, which rounds up as often as down, so 63 of the 432
  priced cells sat RM1 to RM2 over the customer's own rate; rounding down settles it for RM385 across
  the board, and the FLOOR is the only thing that can still put a card over a rate (18 cells today),
  lifting to the first ten above. The grid is the ten the ladder itself rounds to. A product with no tier: their page says price
  coming soon and offers no order for it, and the desk's printed board prints nothing for it.
  `cardPrice` is called by the price list off the snapshot's `ladder` and `tierOf`
  (`tools/book.mjs`), and on the desk by `cardQuote` at any size (the ladder walked through it,
  `fiveTierAt` in the engine), which since v652 every quote to a named customer reads: the
  printed board (`pbPrices`), the approach offer and Today's worth (`nextBest`, no offer with no
  tier), and the reward cover, whose gap is to their card price (his decision of 16 Sep 2026,
  replacing the board's ask of 14 Sep). The v510 draw toward the ask (`adjustedPrice`,
  `pbAdjusted`) and its loyalty test retired with v651.

## The desk

- **The rail** (v622): the destinations with no heading above them, and the open one's pages
  beneath it; a destination with one page lists nothing.
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

## The map (v630, replacing v293's unnamed heat)

- The core districts shaded by revenue for the product in view, a tap opening that district's
  mukim, bandar and pekan with each party a dot, and the whole peninsula a switch away.
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
- The `master` trigger deploys; the other excludes master, uploads a version rather than
  deploying, is off (`previews_enabled: false`), and is still on the ungated `npm run build`.

## Files, beyond the ones `CLAUDE.md` names

| Path | What it is |
|---|---|
| `src/worker.js` | `/queue`, `/vault`, `/bio` dropped, `/drafts`, `/orders` (relay), `/rev`, static assets; dispatches the stage on approval |
| `src/drafter.js` | Queue plus D1 mirror to a proposed row in `draft`; never writes `entry` |
| `tools/fold.mjs` | `--plan` reads `master/_to_fold.json`, refuses what it must, writes the notes skeleton; `--apply` folds all or nothing, syncs, bumps, rolls the shelf, moves the watermark |
| `tools/drafts.mjs` | `--schema`, `--list`, `--draft <file>`, `--approved`, `--committed <id>`, `--from-queue`; via wrangler, no key |
| `tools/drain.mjs` | KV to `06_Data\salt_queue_cloud.json`; `--committed <ISO>`, `--status`, `--forget` |
| `tools/sort-ledger.mjs` | Date order, undated pending last; asserts a permutation |
| `tools/renderdiff.mjs` | `--shoot <label>` every part at 1280 and 375, `--compare <a> <b>`; Playwright from `Code\salt-ds\.ds-sync`; by hand |
| `tools/send-sheet.cmd` | Opens the newest `_send_*.html`; the Desktop shortcut `Send Statement` points here |
| `geo/*.json`, `tools/geofetch.mjs`, `tools/areafetch.mjs`, `tools/gazfetch.mjs` | Basemap (four state outlines, ODbL, unnamed), `places.json` (the code-tail table), since v630 `geo/areas.json`: the 91 districts of Peninsular Malaysia (CC BY 3.0) and the 370 mukim, bandar and pekan of the core states (CC BY 4.0), rings as encoded polylines at 2e-4 degrees, pinned geoBoundaries release `9469f09`; and since v633 `geo/gazetteer.json`, GeoNames' place names in the core states hashed and packed (CC BY 4.0, 55 KB). The three fetch tools alone touch the network, by hand (`gazfetch --from` reads a saved `MY.zip`); geosync inlines all four |
| `public/sw.js`, `public/_headers`, `manifest.webmanifest`, `icon-*.png` | Shell network-first, `/queue` never cached; CSP; icons from `Code\salt-ds` |

## First-time Cloudflare, and local work

`npx wrangler kv namespace create salt_queue`, paste the id over `PLACEHOLDER_KV_ID`, deploy.
The build adds only a PWA head, a service worker, a device id and cloud-mode copy.
`/queue/ping` returns `cloud:true`. The laptop desk is `Open Salt Command.bat` in the project's
`30_Published`: `serve_desk.py` serves this repo's master on port 8766 for Names & IDs and writes
`10_Data`, nothing else. Its sync passes were retired on 16 Sep 2026 (a fourth deployer, rule 8);
`salt_sync.ps1` is dormant. `npm run dev` does the preview half better.
