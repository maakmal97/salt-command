# Products: what is keyed by product, and what is not

Set 22 Sep 2026, on his instruction to state every product-specific variable, everywhere, and
then every product-agnostic one. Written because the desk has traded two products since v228
and has never added a third: oil did not arrive through a workflow, it pre-dated the repo and
was carried in at v339 when the book left the desk, so there is no precedent commit to copy.

This is the reference. It cites NAMES and files, not line numbers, because the work that
follows it moves every line. Rules live in `CLAUDE.md`; mechanism lives in `DESK.md`; this
file answers one question only, which is what a new product touches.

## 1. The registry

Three things name the set of products, and everything else derives from them.

| Name | Where | What |
|---|---|---|
| `PRODUCTS` | `ledger/book.json`, generated into the master's BOOK block | `{id, name, unit, accent, since, note}` per product. The registry. |
| `PROD_ORDER` | the same | the order they appear in, wherever two are shown apart |
| `PROD_IDS` | the master, derived | `PROD_ORDER.filter(p => PRODUCTS[p])`. **This is what code iterates**, not either of the above. |

`DEFAULT_PROD` is `salt` and `PROD` is the one book in view, set only through `setProdView`
(`CLAUDE.md`, the one surface). `setProd` is the lower-level scoping used by `perProduct` and
`parityScan` to walk the books without touching storage or triggering a render.

## 2. Product-specific: the book

**True `{product: value}` maps.** A new product is a data entry and nothing else:
`PRODUCTS`, `PROD_OPENING`, `COUNT_ON`, `PRICE_SET`, `COST_RULE`, and `TIER_OF`, which is
nested customer to product to level name.

**Rows that carry a `product` field:** `sales`, `purchases`, `loans`, `COUNTS`, `selfUseLog`,
`lostDemand`. The field is optional; see section 6.

**`COST_RULE` is the model the rest should follow.** It is keyed by product, each entry
carrying a `kind` (`stack` for salt, `landed` for oil, `buyPlusPct` retired) and a dated note
saying the two differ deliberately rather than by one of them being absent. The engine reads
the `kind` and never the product's name, so a new rule needs no code.

**The one structural outlier: quotes.** `supplierQuote` (salt, implicitly, carrying no
`product` field) and `oilQuote` are two separate top-level keys NAMED AFTER THEIR PRODUCTS,
where every other per-product thing is a map. `NOTES` inherits the same split. This is the
only place in the book where a third product needs a code change rather than a data entry.

**Legacy, salt-only, and not keyed at all:** `opening` (`{qty, costPerKg}`) and `STATED_STOCK`
(a bare number). Both are superseded by `PROD_OPENING` and neither was removed.

**Not product-keyed, despite sitting beside things that are:** `AWARDS` is keyed by customer
code; `NOTES` is keyed by book-field name; `contacts`, `roster`, `associates`,
`supplierReceivable`, `customerRefunds`, `INTRODUCTIONS`, `PLACED`, `PEOPLE`, `ONE_OFFS`,
`QUEUE_COMMITTED` and `CASH_COUNT_RETIRED` have nothing to do with product.

## 3. Product-specific: the master

Per-product configuration, all driven off `PROD_IDS`:

| Name | What |
|---|---|
| `PROD_STOCK_COST` | the cost basis per product; `null` falls back to the salt roll. **Hand-written in the master, not in the book.** |
| `QUOTES` | product to a function over the two quote globals; see section 8 |
| `LADDER_BY` | per-product overrides merged onto the base `LADDER`, read by `ladderFor` |
| `TIER_RULE` | the five-tier multiples per product. `TIER_NAMES` is NOT per product: one shared list of level names. |
| `RULES.creditUnits` | retail and associate credit caps per product, read by `creditCapFor` |
| `RULES.reorderUnits` | the typed reorder point, now only the fallback for a book with no demand; `reorderFor` reads the measured one from `restockFor` (24 Sep 2026) |
| `PRICE_ENGINE.anchors` | tier anchor prices per product, with a derive-from-default fallback in `anchorsFor` |
| `PRICE_ENGINE.sizesBy` | the size ladder per product, read by `sizesFor` |
| `PRICE_ENGINE.boardBy` | which sizes print per product; empty today |
| `PRICE_ENGINE.markupCurve` | salt only, and **dead**: `tierFloorMarkup` has no callers |
| `PRICE_LOCK` | the frozen cost snapshot per product, read by `priceLockState` |

Helpers: `prodOf(row)` maps a row to a product, `inProd(row, p)` tests one, `perProduct` is
the render-once-per-product wrapper that also draws the switch, and `consoBlock` and
`consoOrderBlock` are the whole-book views that add every product together.

`PROFILE_RULE` and `VIEWS` are **not** per-product: one shared set of buyer-profile
thresholds, and seven destinations that do not vary by book.

**Which pages are per-product.** Wrapped in `perProduct`, so they draw the switch and one
book's detail: Receivables, Financials, Inventory, Sourcing, Pricing, Analysis. Scoped to the
active book with a badge only: Today, Rules, Forward, Coverage. **Genuinely cross-product,
reading the whole book with no filter:** Clients and Associates. **Product-blind:** Journal,
Approve, Site orders, and the Ledger by default, which carries an optional product filter
built from `PROD_IDS`. The Whiteboard walks every book in turn.

**The entry form enumerates the registry.** `#wbProd` is built from `PROD_IDS` every time
rather than typed, so declaring a product is the whole of the work; changing it calls
`setProdView`, so it is the same road as the switch. Its own comment says so, and
`parityScan` rule 4 checks it.

## 4. Product-specific: the Counter

`PSYM` maps a product id to an SVG path, and `PSHAPE` maps it to a shape word used for the
aria-label, both in `stmt/page.js`. **A product with no mark gets the Ring**, deliberately,
because a blank reads as a fault rather than as an omission. Everything else under `stmt/` is
data-driven: the price list, the guest board, the order form's segment, the order history and
the associate's card all loop over whatever the published data carries. There is no
hard-coded list of two anywhere in `stmt/page.js`, `stmt/orders.js`, `stmt/refs.js` or
`stmt/send.js`.

The one hard-coded pair is the CSS: `stmt/statement-css.js` declares exactly two product
hues, and it is generated, so a new hue is added upstream and synced.

## 5. Product-agnostic: what a new product never touches

- **`engine/pricing.mjs` and `engine/position.mjs` contain zero product string literals.**
  Every function takes a cost stack `C`, a policy `P` or a row the caller already resolved for
  one product; the engine never asks which product it is pricing. The single embedded rule is
  `walk()`'s `isSalt` gate, which excludes loans and the supplier receivable, and the caller
  sets it as `PROD === DEFAULT_PROD`, so a new book correctly inherits neither.
- **`engine/qr.mjs`, `stmt/qr.js`, `stmt/refs.js`, `stmt/send.js`**: no product logic at all.
- **`src/worker.js` and `src/orders.js`**: the reconcile, the nudge, `queueSale`, `ledgerKey`
  and `ovKey` (which key on code, date and total, never on product), the order thread and the
  bulletin all pass a product through opaquely. `siteWords` refuses the desk's name, a roster
  code's shape and a level's name, and deliberately does not refuse a product's name.
- **Push topics.** `ALERT_TOPICS` is `orders`, `approve` and `salt`, where that last one names
  the morning round, not the product. No topic is per-product.
- **D1.** `product` is unconstrained `TEXT` on both `entry` and `draft`, and no `CHECK`
  anywhere names a product. **A new product needs no migration.**
- **The roster and the geography.** Parties, places, constituencies and the whole Coverage map
  are party-level. A party is a party on any book.

## 6. The storage convention: an absent product means salt

`row.product` is optional. Absent means salt, because salt is the original book and everything
before v228 is salt whether or not it says so; `PRODUCTS.salt.note` states it and
`migrations/0001_ledger.sql` repeats it in a comment. Today the field is present on 13 of 188
sales and 6 of 26 purchases.

The write side is `if (product !== "salt") row.product = product`, so salt is the omitted
value. The read side is `row.product || "salt"`, which appears 58 times across the master, the
drafter, the fold and the tools.

**This pair is coherent and stays correct at five products.** Salt remains the omitted
default, so every row on a new book always carries its field. It is not a fix list.

What is worth watching is the narrow set of places where that default is applied to INPUT
rather than to stored history, where a missing product means nobody chose rather than this is
salt: `pendingEntry` in `src/orders.js`, where a site order with no product books to salt, and
the asymmetric inserts in `src/drafter.js` and `src/worker.js` where a sale defaults to salt
but a purchase defaults to null.

## 7. Adding a product

**Data, in `ledger/book.json`:**

1. `PRODUCTS.<id>` with `id`, `name`, `unit`, `accent`, `since` and a `note`
2. `PROD_ORDER`, appended. Salt leads, always: `tools/d1.mjs` fails otherwise.
3. `PROD_OPENING.<id>`. Required before the first roll: the fold only rolls a product whose
   `stated` is not null, and otherwise records moves as `uncounted` and updates nothing.
4. `COST_RULE.<id>` with a `kind`. Technically optional, since a product with no rule takes
   the stack, but it is stated deliberately, as salt's and oil's are.
5. `PRICE_SET.<id>` as `{prices: {}, hide: []}`
6. A quote entry
7. `TIER_OF` and `AWARDS` need nothing: both are created per customer on demand.

**The look:**

8. A hue upstream in the design system, then `designsync --pull` and `--sync`, plus its
   `.salt-product--<id>` and `.salt-producttag--<id>` pairs, and the generated
   `stmt/statement-css.js`. Miss that last one and the product's statement rows silently lose
   their accent, because an undefined `var()` with no fallback resolves to nothing.
9. A `PSYM` path and a `PSHAPE` word, or accept the Ring.

**Then** `booksync --sync`, build, and read the Whiteboard: see section 8.

**The fold enforces this.** `fold.mjs` refuses a row whose product is not in `PRODUCTS`, and
its refusal names the steps. Its own comment calls this the third-product bootstrap path, so
the case was anticipated.

## 8. The traps

- **The quote lookup returns null rather than failing.** `tools/foldcall.mjs` reads
  `({salt: book.supplierQuote, oil: book.oilQuote})[prod]`, so an unregistered product yields
  `undefined || null` and the purchase folds with no quote comparison in its dossier. Nothing
  errors; the note is merely worse. The master's `QUOTES` and `tools/book.mjs` carry the same
  two-entry shape.
- **`PROD_ORDER` is stated twice.** `tools/book.mjs` hard-codes its own copy, and
  `tools/d1.mjs` fails if the two disagree. They must be edited together.
- **`parityScan` is the instrument, not the documentation.** Written at v275, its header says
  the point is product three. It walks `PROD_IDS` and reports unscoped reads on the
  Whiteboard. Rule 1 catches two books reporting an identical commitment, which is the
  signature of a whole-book read presented as one product's. **Rule 2, a book with no orders
  reporting commitments or receivables, could not fire while every book had orders**, so from
  v275 to v779 it had never once run in anger. Opening three empty books at v780 armed it, and
  it reported neither rule 1 nor rule 2: every empty book reads zero revenue, zero receivable,
  zero inventory and zero promised out, so **the unfinished product split of v228 is clean**.
  Rules 3 and 5, never counted and declared but empty, fire on a new book and are not faults.

- **The suite held two-product assumptions of its own, and they only showed at three.** Opening
  the books turned thirteen assertions red, none of them a fault in the desk: a board section
  that guessed which product it was walking from `boardSizes[0] === 0.5 ? "salt" : "oil"` and so
  reported three books as salt; a guest-link check that excluded the book NAMED oil rather than
  books with no ladder; a monthly reconciliation whose own `reduce` over a book with no months
  gave NaN while the desk returned clean zeros; and a page check that expected every switch to
  list every book, when Sourcing skips an empty one by design. A fixture wider than production
  hides this class; only a real third book finds it.
- **`--salt-product-salt` is used as a generic pale hue**, not as salt's product colour, by
  about a dozen ordinary selectors in `design/desk.css` (`.mono`, `.sell`, `.breg`, `.apchip`
  and others). Renaming that token to free it up would recolour half the desk. Oil's hue has
  no such leakage. Note also that `--salt-product-oil` and `--salt-brass` are the same value,
  so oil's product colour is already indistinguishable from ordinary furniture, and that
  `--salt-salt` is the brand ink, one character from `--salt-product-salt`.
- **A new book inherits salt's limits, and the desk now says so.** `creditCapFor` falls back to
  `RULES[...][DEFAULT_PROD]` when a product has no entry of its own (`reorderFor` does so only for a
  book with no demand; any book with a priced sale gets its own measured point from `restockFor`), which is what keeps the breach arithmetic working on a book nobody has set a policy for.
  Printed book by book, that borrowed figure stated salt's 1 unit as candy's own the moment
  three books were opened, under a sentence beginning *Credit caps are per book*. Since v780 the
  sentence names the books that HAVE a cap and then says which ones borrow one. `anchorsFor`
  does the same for tier anchors. State the credit cap per product when a book goes live.
- **`Both books` is hard-coded copy** on Financials and Receivables. It states a count, and at
  three products it states a wrong one.
- **The reward is salt-only by string comparison**, in five places in the master and two in
  `src/drafter.js`. That is a real business decision, but as written no new product can ever
  earn without a code edit.
- **`form: "salt"` on a loan row means not cash**, and is not the commodity; the loan's real
  product travels separately in `product`. Every reader only ever tests `=== "cash"`, so it is
  inert, but a reader that tested `=== "salt"` to mean a salt loan would be wrong for every
  oil loan on the book today.
- **A customer's statement no longer blends products** (v782). `tools/make_statements.mjs`
  filtered by party and never by product, the row shape carried none, and the footer summed
  quantities across books: CS6-BS read 117.5 unit over 47.5 of one and 70 of the other. Six
  accounts hold more than one book. Each row now draws its book's mark beside the quantity and
  the footer prints one figure a book, in the book's own order, salt first. The money still
  adds. **An archive gets no mark**, because a back-issue is rebuilt to say what was issued and
  a dated record is not corrected in place; the suite pins that a back-issue carries no `<svg>`
  at all, a rule written for the QR that catches this too.
- **The settlement prose still prints the word salt** regardless of the row's product
  (`make_statements.mjs`, the in-kind settlement lines). Dormant only because no sale on any
  other book has been settled in kind yet, so the first one prints a wrong word to a customer.
- **The Associates page mixes scopes.** Its R1, R2 and R3 totals read the whole book across
  every product, while the reward figures beside them read the one book in view, with nothing
  on screen saying so.
