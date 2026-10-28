# Salt Command: current facts

## Worker
- Deployed at `https://salt-command.qyts8mh72kyg.workers.dev`.

## Fold dispatch
- The Worker starts `cloud-commit.yml` on each approval as the GitHub App `salt-desk-dispatch-mk` (App ID 5222854, Actions read and write, installed on this repo only), key in the Worker secret `GH_APP_KEY` (PKCS#8). `SALT_GITHUB_TOKEN` lapsed about 02 Oct 2026 (401, then 400 from 05 Oct); while it failed every fold waited on GitHub's hourly schedule. Proof of health: Worker log `stage dispatch: 204`.

## Access
- `REQUIRE_ACCESS` = `"1"` since 06 Oct 2026, `ACCESS_TEAM` `maakmal`, `ACCESS_AUD` `14a921e2…60fecf`: one owner Access application covers the Desk host and the Counter's `/all`; the CI service token `salt-desk-ci` reaches `/rev`, `/push/send`, `/book/load`, `/book/pitr` and `/book/window` only.
- Since 04 Oct 2026 a hostname Access policy, set outside the repo's config, fronts the Desk Worker: an unauthenticated `/rev` answers 302.
- `ORDER_STORE` is `"object"` since 04 Oct 2026 (#40); the old `q:orders` blob was retired on 04 Oct 2026.
- The maintenance guard exists in both Workers and QR Command (`MAINTENANCE_UNTIL`, an ISO UTC time; empty = off, the current value).

## Migrations
- Newest rebuild of `draft`: `migrations/0010`; of `preapproval`: `migrations/0017`. Newest file: `0020` (a new table, no rebuild).
- `0011` adds `preapproval` (applied alone, the same way as 0010).
- `0012` indexes `draft` on `committed_at` and on `(status, committed_at)`.
- `0017_preapproval_amend.sql` rebuilds `preapproval` with `amend` in its stage CHECK (restateOrder's yes), keeping rows and both indexes. Live D1 carried 0011's narrow CHECK, so every amend tap answered 500; 0017 applied alone on 06 Oct 2026, schema, both indexes and the 71 rows by stage and status read back after.
- `0018_book_read.sql` (25 Oct 2026, a new table, applied alone to the live D1 before the deploy and read back): `book_read`, one row `'d1'` or `'book'`, shipped `'d1'`. The flag for S3 (see "S3: read from the Book").
- `0019_book_tap.sql` (27 Oct 2026, a new table, applied alone to the live D1 before the deploy and read back): `book_tap`, one row `'off'` or `'on'`, shipped `'off'`. The flag for S4d (see "S4: the tap books at once").
- `0020_book_outbox.sql` (28 Oct 2026, a new table, applied alone to the live D1 before the deploy and read back): `book_outbox`, one row `'off'` or `'on'`, shipped `'off'`. The flag for S6 (see "S5 and S6").
- `0013_maker_requests.sql`, `0014_input_admission.sql`, `0015_vault_pair.sql` and `0016_vault_write_gate.sql` applied individually on 03 Oct 2026, with schema readback after each. Both `0012` indexes remain. Pair bootstrap/readback is revision 1; write gate reopened with zero active writers and pending outbox.

## Known red in the suite
- None. The S1 fold replay (`test/fold-replay.mjs`) was red from 21 Oct (17 of 20 alone, 14 to 15 of 20 in the full suite) and was fixed on 25 Oct 2026, his word "Fix S1". A fold reads the PRICING snapshot and the
  reward scheme from a `ledger.json` beside the book it resolved when `tools/book.mjs` first loaded: no file when S1 ran alone on the frozen book, today's when an earlier section had loaded it on the live book. The working
  fold has re-priced a restated row from that snapshot since 20 Oct and the old fold (43fc5b0a) never did, so the same batches passed alone and failed in the suite. Both folds are now loaded with `--ledger` pointing at no file;
  the window is fixed at the batch of 24 Oct 2026 (`WINDOW_END`, 8344070c) instead of sliding onto rows the old fold can never match; and `law()` reads the Their % wording of 21 Oct ("TIER ... drift +0.3" against
  "THEIR % ... 30% lift") as one figure, so a different value still differs. Move `WINDOW_END` only after accounting for what changed since.

## Counter Batch A
- Built on branch `claude/counter-batch-a-build-b9ddad` (19 Oct 2026), P0 salt-ds#13 (1.7.0) merged; collection points live in Counter KV `maker:points` once the version ships; his list is empty until he fills it on Salt Admin, and a collect Ready is refused without one.

## Counter Batch B
- Built on branch `claude/counter-batch-b-build-0dde24` (20 Oct 2026): the way on Prices, Home's start tiles, Order again, the basket. No
  salt-ds part, no Worker change. Live as v1174; accepted 21 Oct 2026.

## Hours past midnight
- Live 20 Oct 2026 (41aada8f, width fix 87719939; Cloud commits 39392733014 and 39393655894: chain, three suite parts and the statements deploy green): a close earlier than the
  open is the next day's, one rule `stmt/hours.js` `openParts`; Salt Admin's Shop hours is a week chart (canvas V63). Accepted 21 Oct 2026.
- Round 2, his eight answers to Fable's design (20 Oct 2026): up to six spans a day, 00:00 to 24:00, overlaps merged, dated days
  (`schedule.dates`, 90 days ahead, 40 at most), the preview read `GET /all/maker/hours?preview=`, Copy to chips, Discard and Undo.

## Salt Admin A to C
- Live 21 Oct 2026 on the statements Worker (P7 d950fbf9 to the render fix a8c5a810; Cloud commits 39497610426, 39513766456, 39516060966 and
  39516640502: chain and three suite parts green), with salt-ds 1.11.0 (#21, the pill track and Jump to): Needs you's glance and sliding kinds,
  Help on Shop hours, the charge slider, the rail's New entry, and from 1080px an open order filling the page in columns (reversing the 11 Oct
  split at that width). Accepted
  21 Oct 2026; the reward card (V37, V52) is not built.

## Stock on Salt Admin's glance
- Live as v1196 (`f1002767`, 21 Oct 2026; Cloud commit `39521537039`: chain and three suite parts green), render fixes `dfe732a5` and `4d7c3bc2`
  (Cloud commit `39523361015` green): Stock cover and Next lot on Needs you (canvas V62), off the state key `STOCK` seeded at each version
  (`docs/plan-admin-glance-stock.html`). Accepted 21 Oct 2026.

## Counter Batch C
- Live as v1182 (`19b226d7`, 20 Oct 2026; Cloud commit `39318980626`: chain and three suite parts green, live /rev `1a05919acb1d3a29`): saved spots, the sealed name and
  unit, the confirm time, Help, labels at 600 and the slider (salt-ds#15, #16, #17: 1.9.0 to 1.9.2; QR Command #12 live). KV `confirm:within`
  is empty until the first hourly cron after the deploy. Accepted 21 Oct 2026.

## Counter test surface
- Live as v1166 (`2e876db5`, 19 Oct 2026): `/all/test` behind `/all`'s two locks; Cloud commit `39195289245` deployed both Workers, proved live `/rev` at `0bd585f1e036adde` and passed all three suite parts. `0000-0002` has no fixture until he taps Make the practice accounts on Salt Admin and a publish runs. Accepted 21 Oct 2026.

## Associate reward
- Live as v1187 (`b9006c59`, 20 Oct 2026; Cloud commit `39395156043`: chain and three suite parts green, live /rev `832779203aef614c`): the switch is `REWARD.stated.salt.associate` `{times: 10, since: "2026-10-20"}`; `REWARD_OPEN` states ten associates at `upTo` s276. No customer basis (his yes to the loyalty plan's Ask 4); the six customers hold about 6.4 units, unspent. The loyalty unit (`docs/plan-loyalty-unit.html`, branch `claude/bold-booth-4df727`) builds next. Accepted 21 Oct 2026.

## Loyalty unit
- Live as v1197 (`9668fe2d`, 21 Oct 2026; Cloud commit `39524393383`: chain and three suite parts green, live /rev `2f68fa9b8b036ef5`), from `docs/plan-loyalty-unit.html` (his yes typed 21 Oct 2026): `REWARD.stated.salt.loyal`
  `{every: 20, since: "2026-10-21"}`; everyone at nought. 0000-0002 is a plain customer (FIX_VERSION 14). Accepted 21 Oct 2026.

## Their % range
- Live as v1198 (`998ae40c`, 21 Oct 2026; Cloud commit `39548705792`: chain and three suite parts green, live /rev `784cea1fdb5fb8b7`): salt's Their % runs -30% to +30%
  (`LIFT_MIN`, `LIFT_MAX`), a negative one a discount held at or over the Floor; Add ID's presets mirror both ways; a good record suggests up to -30%
  (`suggest.good` 0.3 times `autoDrift`'s G, only with B nought). Nobody holds a %; once filled, about 18 of 41 customers would be suggested -30%. Accepted 21 Oct 2026.

## Their % on his curve, every book
- Live as v1206 (`1e765218`, 22 Oct 2026; Cloud commit `39711829680`: chain green, suite parts 2 and 3 green, part 1 red only on the v557 rice
  check that was red on master before): salt `ends` {low:[2,1.2], high:[3,1.45]}; oil, candy and rice `pct` with `shares` {low:[0.8,0.9],
  high:[1.2,1.09]}; Salt Admin's live preview `/all/maker/drift-preview/<code>/<book>/<whole %>`. CS6-BS holds -20% and pays more on the curve.
  Accepted 25 Oct 2026 (his word).

## Desk bar
- Live as v1199 (`61541316`, 21 Oct 2026; Cloud commit `39555095710`: chain and three suite parts green, live /rev `9cea1ad4e24589a6`), with
  salt-ds 1.12.0 (#22): the bar is solid with a hairline, says where you are, and carries Now, Waiting, Alerts and Approve on every view.
  Approve opens `/admin`, a 302 to `ADMIN_URL` (wrangler.jsonc vars) `#orders/approve`; he tapped it live and it opens Salt Admin's Approve; accepted 21 Oct 2026.

- v1201 (21 Oct 2026; Cloud commit `39560565587`: chain and three suite parts green, /rev `1e15f67b09f8bf6a`): his word, the Desk bar back in the
  rail's glass with v1199's features kept (salt-ds 1.12.1, #23; stacks by its own width); Salt Admin's bar says where he is, then Needs you,
  Orders, Customers and Approve (`bar.*` acts); Salt Counter's header is the bar again (`cBar`, reversing Batch A's no bar): To pay now,
  the orders that need them, Messages while unread. Accepted 21 Oct 2026 on phone and laptop.

- v1207 (22 Oct 2026; Cloud commit `39713624270`: chain, suite parts 2 and 3 green, part 1 only the old v557 rice check): salt-ds 1.12.2 (#24), the
  bar's quiet line wraps onto a hidden second line, so the stamp, then the clock, then the date drop whole; his review had "· UP" cut mid-word.

- v1230 (`e66d50fd`, 23 Oct 2026; Cloud commit `39934524935`: chain and three suite parts green), his word: the Desk's bar no longer says where
  you are (`#deskWhere`, `#dwView`, `#dwPage` and `deskWhereDraw` gone; the rail says it), and salt-ds 1.15.0 (#27) drops `__where`, `__view` and
  `__page` from the recipe, synced to the Desk and the Counter; QR Command did not move. Accepted 25 Oct 2026 (his word). In a claude.ai cloud container the
  section "Desk live socket: an open Desk is told the kind of" fails two checks on master too, while CI passes it: the container, not the code.

## Restock light made plain
- Live as v1210 (`dafc0ee0`, 22 Oct 2026; Cloud commit `39717174220`: chain, suite parts 2 and 3 green; part 1 red only on v557's rice concentration check,
  which fails on origin's master before it too), from `docs/plan-restock-light.html`: Counter Home's Availability (Available, Limited, Out of stock, More by),
  the word under the mark on Prices, Salt Admin's Stock by book on Needs you (STOCK carries `light`, re-read each poll tick). The word stock is allowed
  on the Counter (his word). Counter Home accepted 22 Oct 2026; Salt Admin's Stock by book accepted 25 Oct 2026 (his word).

## Multi-tick Approve
- Live as v1213 (`4009e464`, 22 Oct 2026; Cloud commit `39760310831`: chain and three suite parts green), from `docs/plan-approve-many.html`
  and canvas Salt Admin Approve (https://claude.ai/artifact/VdP2V6wGgpZhuLicWTpQwq): a card's Approve and Reject choose; Approve all; the bar's
  Confirm sends one `decide-many` (Desk `/_internal/maker/drafts/decide-many`, Counter `/all/maker/drafts/decide-many`, 1 to 50 drafts); refusals
  stay with why and a fix (`refusalFix`); one dispatch a batch; Needs you lists no row to approve, the glance's To approve tile counts the cards.
  Fable reviewed the Desk route (two low findings applied). Accepted 22 Oct 2026. Unverified: a full batch of 50 is about 500 to 700 subrequests,
  under the Workers Paid limit of 1,000 (plan verified 25 Sep 2026; the figure not re-read).
- v1211 (22 Oct 2026): s282, s283, s284 corrected on his word (CS6-PER's 21 Oct order: 1 salt RM120, 10 oil RM120, 5 rice RM30, collected, paid,
  no delivery). v1212: Salt Admin labels a fold-raised unit Associate reward or Loyalty unit (`makerRows` `reward`).

## Live sockets (Speed Wave 2)
- L2 live as v1200 (`93fb843d`, 21 Oct 2026; Cloud commit `39558436127`: chain and three suite parts green, live /rev `9baa334b7a52fd51`): the Counter's `OrderBook` holds
  hibernating sockets, `/live` (session proved at the handshake as subprotocol `["stmt", session]`) and `/all/live` (Access); kinds and ids only; polls 60 s while up;
  `unlive` on Log out and both sign-outs. Proved on local workerd (101, echo, hello, pong, strikes, logout close).
- L1 live as v1202 (`1f39efcf`, 21 Oct 2026; Cloud commit `39565305778`: chain and three suite parts green, live /rev `0845037c6f0c005f`): the Book class's object
  `live` (D9); Desk `/live` owner only whatever REQUIRE_ACCESS says; tells `drafts`, `orders` and `rev` (the minute cron); /rev poll 60 s while up; a new KL day
  reloads an idle desk.
- Accepted 21 Oct 2026 (his word: a move shows on the other screens within about a second); L1 and L2 both accepted (his word of 25 Oct 2026).

## Notifications
- Live as v1167 (`e35ee35b`, 19 Oct 2026; Cloud commit `39223032636`: chain, three suite parts and CI green): Salt Admin (was Salt Account) has its own worker `/all/sw.js` and `opush:` subscriptions; the Desk rings orders and approvals only while no Salt Admin send goes through (KV `admin:on`). He has not yet re-added Salt Admin to the home screen or turned its bell on (Shop > This device), so the Desk still rings for now. The stock-light banner has its Desk side only: nothing posts `{"tag":"stock"}` yet (it needs `tools/stmt-publish.mjs` to compare lights).

## Gas and PrEP (v1282, 27 Oct 2026)
- Pushed as v1282 (`ebe435ec`; Cloud commit `40480514260` and CI `40480514091` were running at the push), his word: `spare` became `gas` (`product.mjs --rename`, no rows) and `prep` was added. Both are live and empty.
  Gas (named Aroma on 27 Oct 2026 and Gas again on 28 Oct, the id kept; its mark a twelve-point starburst lettered POP, his choice of A over a diffuser flask; `PRODUCT_WORDS` says gas) is RM75 a unit on a cost of RM50, 1 to 20 in ones. PrEP is a heart-shaped pill lettered PrEP, RM60 for 12 and RM125 for 30 pills on a cost of RM100 per 30, orderable as 12N or 30N only (grid
  `multiples`). Costs sit on `PROD_OPENING.costPerKg` (50 and 3.333) until a first lot is entered; their grid tops (gas 20, PrEP 120) were the builder's reading. Also his words: candy 1 to 50, rice 1 to 100, and salt orderable
  only in the halves 0.5 to 5 then 6.25, 12.5, 25, 50, 100 (grid `only`, quarter step kept for the walk). Salt's Set Price at 25, 50 and 100 is the existing curve's, not typed by him. salt-ds 1.20.0 (#32) holds the hues
  and was propagated to the Desk and Counter; QR Command was not run. The frozen test book and `pricing-before-s1c.json` were regenerated for the six books. S1b stays red here and on a clean master (CI passed it).

## Partner
- `partners` in `ledger/book.json` = CM4-TO since v1029 (06 Oct 2026): pays the Floor, the order total up to the next RM 5, on every book (since 18 Oct 2026; it was cost to the sen). The CBDO role stays unheld, his answer. The Their % card's Make partner sets one (09 Oct 2026) and a partner is always an associate with a -R account; CM4-TO was made one by hand in the same version.

## S0b backup (live)
- Live as v1251 (`0f46fefe`, 25 Oct 2026; CI `40137142246` and Cloud commit `40137142222` green; the chain proved the phone serving `454e5dac1b323727`), his word "start on S0b backup", then his yes to the
  bucket, the key and the cron: `src/backup.js`, the backup cron and the morning alarm in `src/worker.js`, `tools/backup-key.mjs` and `tools/backup-open.mjs`, `docs/BACKUP.md`. The deploy log shows
  `BACKUP` on R2 bucket `salt-d1-backup`, `BACKUP_PUBLIC_JWK` and the schedule `30 18 * * *` (02:30 in Kuala Lumpur). The key is `10_Data\salt_backupkey.json`, minted 25 Oct 2026; a copy off that disk is his to keep.
- The first backup was filed by hand through wrangler on 25 Oct 2026 at 06:15 MYT: `backup/2026-10-25.json`, 1,761,163 bytes read back equal (604 drafts, 151 pre-approvals, 118 maker requests, 9 input admissions, the vault pair),
  with `backup:last` ok. The cron's own first night is 02:30 on 26 Oct. Three suite sections (`backup`, `backup-cron`, `backup-tools`; 29, 13 and 16 mutations) hold the restore drill.
  The real object was opened with his key on 25 Oct 2026 (`node tools/backup-open.mjs`, counts only) and the counts matched exactly (his word). Open: a copy of the key off the laptop's disk.

## S3: read from the Book
- Live as v1253 (`7f916991`, 26 Oct 2026; Cloud commit `40213833917`: chain and three suite parts green; the first load at v1253 logged "parity: the Book agrees with git over 474 rows in 13 collections and 23 documents" and the new readcheck step "the Book and the mirror agree over 339 sales and purchases"), his word to start and his answer of 25 Oct 2026 that orders and the book stay TWO objects.
  The readers' flag is the D1 row `book_read` (migrations/0018), **shipped at `'d1'`** and **read as `'book'` from live D1 on 27 Oct 2026** (turned on after v1253; the chain's readcheck line at v1276 reads "readers on book ... agree over 342 sales and purchases"; the hour it was set is unverified), so the readers read the Book now. `'book'` makes `readBook` read the Book (`src/book-read.js`), unless the Book trails the mirror (then the mirror, for the whole read). Way back, no deploy: `npx wrangler d1 execute salt_ledger --remote --command "UPDATE book_read SET mode='d1' WHERE one=1"`. **Turning it on is his call**, after the readcheck is green over a fold or two (`docs/DESK.md`, "The Book: read").
- "On its way" is now the bound of the book a reader read: a book from the Book carries `at` (its latest load) and a draft marked committed after `at` is on its way (`src/way.js`); a book from the mirror carries none and every clause is byte for byte as before. Fable (design review, diff review, re-check): D1 `booked_at` dropped for the Book's own load time, an older load refused (409), input-admission, `tellSite` and `tieOut` stay on the mirror's snapshot.
- `GET /book/readcheck` (CI route, the Book's key) and the chain's "Check the readers agree" step name what differs between the Book and the mirror, never a row. Known: an equal-version replay moves `at` harmlessly; a draft marked committed outside a deploy stays on its way until the next load; `tools/update.mjs` does not load the Book, so a hand fold leaves it behind and the readers fall back to the mirror.

## S4: the tap books at once (version 1 and version 2 live; the tap is shipped OFF)
- Version 1 (S4a to S4c) live as v1285 (`3ef5d128`, 27 Oct 2026; Cloud commit `40485500803`: chain and three suite parts green, CI `40485500918` green; the load line said "the Book agrees with git over 483 rows in 13 collections and 23 documents" and the readcheck "mirror v1285, Book v1285, readers on book ... agree over 344 sales and purchases"). Nothing calls the new `tap` yet: no row is booked, and every reader reads as at v1276. Design and Fable's two reviews (design, then diff and its re-check): `s4-design.md` in the side-session notes; behaviour: `docs/DESK.md`, "The Book: tap". His answers of 27 Oct 2026: two versions with his go before each; the drafter's cost stands for a booked purchase (the fold ignores the model's `n.cost` for a booked row); a Book behind or down at a tap approves as today; the Desk page's own copy of the law (`ovNew`, `ovAmend`) waits for S5.
- **Version 2, S4d, live as v1288** (`c68f538e`, 27 Oct 2026, his go typed the same day; Cloud commit `40530956484`: its first Deploy failed on a Cloudflare asset-upload error (code 10013), the failed job re-run green, chain and three suite parts green, CI `40530957125` green; the load line said "the Book agrees with git over 483 rows in 13 collections and 23 documents", the readcheck "mirror v1288, Book v1288, readers on book ... agree over 344 sales and purchases", live build `418cdc33ab5dd2e6`). The flag is D1 `book_tap` (migrations/0019, applied alone to the live D1 before the deploy and read back as `off`), **shipped `off`; turning it on is his call**. With it on, `decideDraft`, decide-many and `applyPre` book first (`src/book-tap.js` `bookTap`) and write `row.rids` and `row.booked_seq` in the approval's own D1 batch; a law refusal is a 409; a Book behind, silent or stuck approves as before; a rejection voids first (flag on only); the minute `bookNet` books approved drafts with no booking and voids entries of rejected ones; the readcheck names an entry under a rejected or pending draft. Fable reviewed the diff and re-checked (all applied): the fold treats a booked row's rid as a replay only when the row under it is the same row, otherwise it books afresh and keeps `booked_seq` (the drafter's cost stands); an amendment is never judged a replay by a rid. Not built: `liveTell("booked")` (LIVE_KINDS has no reader until S5). Said, not fixed (docs/DESK.md): an `applyPre` refusal shows no reason on its order card; decide-many at 50 adds about 150 subrequests (unverified). Way back, no deploy: `UPDATE book_tap SET mode='off' WHERE one=1`. Turning it on: tap one real row, read the next chain run's `tap: N closed` line, the readcheck and the tap check. Local note: the S1b section stays red on this laptop only.
- Known gaps (docs/DESK.md has them): `tools/update.mjs` does not load the Book, so after a hand fold the Book trails and a tap falls back; a load fails closed (503, nothing loaded) when entries are open and D1 or the Book cannot say which the fold took; the S1b section ("the order-stage entries live in engine/stages") is red in a local run on this laptop (also on pristine master) and green in CI.

## Counter statement in the settings language
- v1297 (28 Oct 2026), his word "apply the skill" and his yes to the plan (salt-ds first, then the page, the month select and This device's rows in one version): salt-ds 1.21.0 (#33)
  adds `salt-lines--list` (the statement's lines on glass, 56px rows, the date in the display face); `tools/make_statements.mjs` carries it on the live document only, with the footer as
  `salt-settings` rows (`trow`: orders, a row of marks, the cancelled note, Delivery, Paid, Balance; an issue keeps its old footer); the month filter is a Month row holding a select
  (`data-mf-select`, All first); Sign out is the first list's last row in ember (`#lock`, its label `#lockT`, "Sign out this phone"), and Sign in another device and Save a passkey are
  rows of a list of their own (`devQuiet`, `devSet`). Gas was named Aroma for a day (v1289) and is Gas again (v1293); its mark is a starburst lettered POP. QR Command took the recipe through propagate
  on its branch `claude/statement-lines` (not shipped by this session).

## S5 and S6: the Book becomes the source (his word "build until completion of Book Ledger DO", 28 Oct 2026)
- Plan: `docs/plan-book-s5-s6.html` (artifact https://claude.ai/artifact/AS4wjtZqP9MB1DSJajT8fn), Fable's design review of 28 Oct 2026 applied; brief and reasoning in the side-session notes (`s5-s6-handoff.md`). His answers: dormant S5 parts first, S6 while the 7 days run, the flip on his typed go on or after 4 Nov 2026 (7 days of parity with the tap, on since 28 Oct); keep the model's notes, written behind; a version is code only after the flip. Open asks A (hand edits after the flip), B (laptop roads refused), C (how soon a note follows its row): recommendations on the page, unanswered.
- **Part 1, S5a and S5c, live as v1301** (`89722156`, 28 Oct 2026; Cloud commit `40594956826`: chain and three suite parts green, CI `40594956842` green, readcheck "mirror v1301, Book v1301, readers on book, Book rev 1; ... compaction would hold over 0 open entries"): `snap.rev` (moves with a load that changed or closed something, a tap that booked, a void that voided, a compaction), `compact(dry)` strict through the load's own path (answers `closed`, the draft ids the flip marks committed in the same step), `/events?all=1`, `/export`, the Book's sealed nightly export in R2 `bookexport/<date>.json` (`runBookExport`, same key, same cron, heard of in the morning digest), `tools/backup-open.mjs` opens it, the readcheck rehearses a dry compaction at every fold, every approval that fell back logs `tap fallback <id>: <why>` (the flip's gate is zero). Fable diff review: no blocker; applied: `closed`, the dry run reuses the view, a dry load cannot fall through, a row-hash idempotency check. Said: the compaction is NOT run live before the flip; a rid-less row edited in place would make it impossible (the dry rehearsal is the alarm).
- **S6, live as v1304** (`39a1e578`, 28 Oct 2026; Cloud commit `40646754815`: chain green, the first run of suite part 1 failed on a minute-rollover race in an unrelated clock check ("14:58" against "14:59") and the re-run was green, CI `40646754715` green; readcheck "mirror v1304, Book v1304, readers on book, Book rev 6; ... compaction would hold over 0 open entries"). Flag D1 `book_outbox` (migrations/0020, applied alone to the live D1 before the deploy and read back `off`), **shipped `off`; turning it on is his call**. Fable's outbox of messages with an eid was replaced (the explorer's map: the order book already takes the return leg's state messages without an id, the planned id fails its format, and half the leg has no `orderId`): the Book writes a row per booked sale or amendment in the tap's transaction, and with the flag on `src/outbox.js` `drainOutbox` (after an approval, once after decide-many, and in the minute cron) answers the pending rows with ONE forced pass of `tellSite(..., {force: true})`, which SENDS no fix and follows no row (Fable: an undo applied twice, a shared group split) and leaves `orders:told` and `orders:toldFailed` to the regular pass. Rejected or folded drafts' rows are dropped, pending ones wait, marks go in lists of 500 with the answer checked, a row stuck ten minutes behind a pending draft is logged, drains in an isolate run one at a time (`outboxAfter`). The regular return leg is unchanged and the net for the rest. Tests `test/book-outbox.mjs` (45 checks, 40 mutations). Said: an amendment that moves the row's key still reaches its order only at the fold. Turning it on: `UPDATE book_outbox SET mode='on' WHERE one=1`, approve one real payment, read `outbox: {"ok":true,"sent":N}` in the Worker log.
- **S5e, live as v1305** (`c62f4cd6`, 28 Oct 2026; Cloud commit `40652838822`: chain and three suite parts green; the new step said "Book source: Book v1305, rev 7, 300 sales; the live statements of 51 accounts built from the Book equal those built from git"): `GET /book/ledger` (a CI route behind the Book's key; the Book's base, or `?view=1` with the open entries, as ledger/book.json's shape via `unshape`, plus the derived documents, version, revision, open count; read only, the body is the whole ledger and nothing prints it), `tools/book-source.mjs` (`fetchBookSource`, `compareLive`, `compareCheckout`, `gitVersion`; `--compare` the chain's step "Check the Book builds the same statements", continue-on-error, builds every account's plaintext `liveStatement` from git's book file and from the Book's and names the accounts that differ; not compared across versions; `--out` and `--view` for the flip). Fable reviewed twice, all applied (a Book one load behind is NOT COMPARED rather than DIFFER; the version read is ledger.json's top-level `v`, what the load sends; the base answer counts open entries from `/at`). Not covered, said: price lists, cards, lights and assoc come from the master's baked book in jsdom until S5b; the Counter's stamp is still the build id until the flip. Section "Book S5e", 32 checks, 27 mutations.
- Next, in this order (each its own version, Fable on money or data): S5b PRICING recompute as a shadow, the roster/rename/username road (new part: a `username_pool` table by migration applied ALONE, the four pinned codes in engine/rules, git side done by the export job), S5d the page reads the Book (flag), then 7 days of parity (from 28 Oct, tap on) and S5f the flip (his typed go, earliest 4 Nov). The gate is on the plan page.

## Disabled automation
- `Salt fold (manual backup)` = `trig_01UrnjQMWA3f6GXN5R6Dzi4S`, disabled.

## Retired surfaces
- The phone app `public/index.html`, `public/data.json`, and the claude.ai mirror.

## Endpoints
- `GET /book/readcheck` (S3: the Book against the mirror, names only; CI token routes: `/rev`, `/push/send`, `/book/load`, `/book/pitr`, `/book/window`, `/book/readcheck`)
- `GET /drafts?status=…`
- `POST /drafts/<id>/approve|reject|committed`
- `GET|POST /vault/addr` (the places envelope, KV `vault-addr`, ciphertext only) and `POST /geo/expand` (a `maps.app.goo.gl` link followed one redirect, nothing kept), both keyed
- `GET /vault/key` (the slip key, KV `vault-key`, sealed; no write route, only `seed-vault.mjs --slip-key` writes it), keyed
- `POST /draft-now?dry=1`
- `POST /orders/<id>/preview` (the row an Accept would make, stored nowhere, never the dry run)
- `/accept|handed|cash|received|notfound|again` (the card's taps)
- `POST /orders/<id>/offer|withdraw` (Negotiate's offer, and since 10 Oct 2026 his Accept sent for their yes; Counter Admin reaches both through `/all/maker/orders/<id>/offer|withdraw`)
- `/claims/<id>/preview|received|notfound`
- `GET /threads` and `POST /threads/<username>` (Step 7: his Chat; `{message}`, checked by siteWords, or `{noReply: true}`)
- `GET /slips/<username>/<id>` (F13: a slip's ciphertext, relayed from the Counter's `slip:` KV, never cached by `sw.js`)
- `GET|POST /hush` (A5: the hushed Whiteboard tips, KV `hush`, `{tip id: day or null}`; `POST {id, until}` or `{id, clear: true}`; Counter Maker writes it through `inputs/hush`), keyed
- `GET /stmt/rev` (Desk build id only; internal Counter service binding, keyed by `X-Stmt-Desk` using the shared `STMT_DESK_KEY`)
- Counter Maker `POST /all/maker/geo/open {url}` (a short Google or Apple Maps link, or an Apple place id, opened for its point; Google and Apple hosts only) and `POST /all/maker/geo/search {q}` (the typed words to Photon, photon.komoot.io, Malaysia and Singapore, five places): v1263, 26 Oct 2026, his choice of Photon and his yes to Apple; nothing kept.
- Counter: `GET /pools` and `POST /pools/<id>/join` (a customer session; the group order); Maker `GET|POST /all/maker/pools` and `POST /all/maker/pools/<id>/close` (verified owner only).
- The endpoints above are keyed via `X-Salt-Key` except `/stmt/rev`, which uses `X-Stmt-Desk`.

## Counter maker
- `/all/maker/*` is Counter Admin behind verified Access identity and the exact owner email; the Desk reaches it through `DESK_MAKER` with `COUNTER_MAKER_KEY`, and its name and place reads return ciphertext only.
- Names and places are the D1 vault pair (`VAULT_STORE=pair`, v992; revision 1 bootstrapped 03 Oct 2026). Old KV is recovery material, not a safe rollback. `0016_vault_write_gate.sql` guards the writes; the gate reopened 03 Oct 2026 with no active writer and an empty outbox.
- A customer amends through `POST /orders/<id>/amend`; Admin inputs stay under `/all/maker/inputs/*`. Maker order moves take an immutable `rid`; Cancel is allowed from Maker only while nothing is paid (05 Oct 2026).
- A confirmed Add ID can be named by a Counter trade (08 Oct 2026, #86); the fold applies the Add ID first and refuses the batch without it.
- Accepted: six Counter Admin controls (10 Oct 2026); #62 complete, the Desk only reads since v1104, accepted on phone and laptop (14 Oct 2026).
- Open, ask him: positive owner-keyed places and service acceptance.

## Salt Admin Customers redesign
- Live as v1255 (`e763a261`, 26 Oct 2026; CI `40224705710` and Cloud commit `40224705732`: chain and three suite parts green, live /rev `1adb9e8f44b96dde`), from
  `docs/plan-admin-customers.html` (his yes to Asks A to J, relayed by the moderator), salt-ds 1.16.0 (#28, `salt-segment--tight`). Accounts are Needs you's cards and
  wide tables; an account leads with where it stands, Mark as sent for the tick; Their % and Make partner moved from Record > Pricing to the account card;
  new reads `/all/maker/customer-of|reward-of/<code>` (Fable reviewed: one low finding stated, one withdrawn). Full suite on the merged tree: 10,638 passed,
  7 red (the S1 fold replay). Not yet opened by him.

## Salt Admin Orders review (v1296, 28 Oct 2026)
- His word: Haiku, Sonnet, Opus and Fable on the Orders page. Salt Admin now reads `order.credit` as paid (`ordDue`/`ordPaidAll` in `stmt/owner.js`, the site's `dueOf`); a claim
  past what is owed (payOnBook) is answered on the card only, never the row's one tap (Fable). Section "28 Oct 2026: Salt Admin's Orders review", 13 mutations. His answer of 28 Oct
  2026: a transfer above what is owed stays Already recorded (books nothing); it is not taken as money with the excess a refund. Do not ask again.

## Salt Admin Orders redesign
- Live as v1256 (`c4d677a6`, 26 Oct 2026; Cloud commit `40228185174`: chain and three suite parts green, CI `40228185236` green, live /rev `bc69bd8338333eba`), from his
  canvas https://claude.ai/artifact/VNtoVjEo111nKYDbBzc487 and `docs/plan-admin-orders.html` (his yes to Asks A to M): the stages Placed, Agreed, Ready, Out or paid, Done,
  Ended as text tabs; the row is Needs you's card, a plain table from 1080px; the row's move asks once and sends the order card's own request (section "a row's move
  asks once"); the band's tag, terms in view; typed tags on Approve, Payments, Group and Ledger; a ticked Reject the danger pill (salt-ds#29, 1.17.0). Kept: Approve's
  card with cost and margin (hard rule), "Change the order" (Ready has two ways), marks on form fields (Record's). Not yet opened by him.

## Salt Admin Shop redesign
- Live as v1254 (`7eb0e296`, 26 Oct 2026; Cloud commit `40214884137`: chain and three suite parts green, live /rev `88e6f50b08fc1cc3`), from his Shop canvas
  https://claude.ai/artifact/TrC768miLDPZb7U5wWciBQ and `docs/plan-admin-shop.html` (his yes to every Ask, Ask H both halves): For now first and folded, the glance tiles,
  the open day with its preview (a pane beside the week from 860px), points as a plain table, Notice as customers read it, Practice with Open the test page
  and Remove asking once, This device rows, Shop's parts as text tabs. Section "Salt Admin's Shop on the Salt system". Accepted 26 Oct 2026.
- v1258 (`4054c52f`, 26 Oct 2026; Cloud commit `40232565847`: chain and three suite parts green, live /rev `028280eedf4fc3ff`), his word: This device is a list of settings on
  salt-ds 1.18.0 (#30, the Switch and Settings recipes): Tide theme and Notifications switches, Names a password in its row with Unlock. Not yet opened by him.
- v1259 (`5e9edaf2`, 26 Oct 2026; Cloud commit `40235334331`: chain and three suite parts green, live /rev `6a58eb110eb5a135`), his yes of 26 Oct 2026: Salt Counter's own
  This device is the same list (Notifications and Tide theme switches; Not here and why on a browser with no notifications; Saved as an app Yes). Not yet opened by him.
- v1260 (`6c258934`, 26 Oct 2026; Cloud commit `40260871795`: chain and three suite parts green, live /rev `f11319e0ef0436e2`), his second look: Salt Admin's Names is a
  Show names switch, on asking for the password in the one Sheet, off locking; every row of This device a name and one switch. Not yet opened by him.
- v1261 (`22abfd74`, 26 Oct 2026; Cloud commit `40264069306`: chain and three suite parts green, live /rev `bff600870ad9d2e3`), his word: Practice and Notice are settings
  lists (a Practice accounts switch; Up now a row a line, Clear the notice in ember; New notice a box and Set the notice), and from 860px Practice, Notice and This device
  stand in one 640px column; salt-ds 1.19.0 (#31, the settings parts). Landed display-only (his yes of 18 Oct 2026). Not yet opened by him.
- v1262 (`5319f9aa`, 26 Oct 2026), his word: Hours is lists of settings too (Now with Hold the shop a Switch, Hold as a Segment, Until, Set it; the week and dates as
  list rows with the bar chart; the open day as switches and rows; points and Help as lists; the glance's tiles gone). CI's suite on v1262 found eight dead CSS rules
  and one points check: fixed in `e88e206f` (Cloud commit `40268331943`: chain and three suite parts green). Not yet opened by him.
- v1263 (`35515bb7`, 26 Oct 2026; chain and three suite parts green, live build `c7dfe5c7a7aea82d`), his word: New point's Place lists OpenStreetMap places as he types
  (Photon, his choice) and reads Google, Waze and Apple links, a short one opened on the Worker (Apple his yes). Section "Salt Admin's place for a point". Not yet opened by him.

## A refund becomes their credit
- Live as v1284 (`37feb80b`, 27 Oct 2026; Cloud commit `40483983570`: chain and three suite parts green, CI `40483983661` green, live build `9504a9b4679327b1`), from
  `docs/plan-refund-credit.html` draft 3 (his answers A to F and his yes of 27 Oct 2026), P1 to P6: `bookCash` (s296 reads RM 455 on salt; cash flow keeps the till),
  `creditOf` and `setOffCredit` (engine), `src/credit.js` (credit on its way), the Accept booking credit as cash with `credit` on the row and the Counter order,
  the Counter's sealed `credit`/`creditRows` (FIX_VERSION 15), Salt Admin's Less RM x credit. Fable reviewed P2 and P3 (two medium, three low applied) and re-checked
  (one more applied: a credit the fold cut short is lowered on the order). CZ4-MK holds RM 25 of credit, spent at his next Accept for them. Not yet opened by him.
  Known: S1b (`test/engine-stages.mjs`) is red locally on Windows on master too (227 of 392, from v1272's cash over), green in CI.
- v1292 (`22769095`, 28 Oct 2026; Cloud commit `40540116210`: chain green, the phone serving it; CI `40540116044` green), his word "I do not owe them salt due to the extra prepayment": `txDeferUnits` stops the units paid for at the units ordered, so s296's RM 25 past its order no longer reads as 0.27 unit owed out and committed on the shelf. Section "28 Oct 2026: money past an order". The Desk wave 1 overlay probe had paid s074 (settled in kind) a second time and leaned on the old reading; it now pays a row that owes.

## Cash past what an order owes
- Live as v1272 (`b266f659`, 27 Oct 2026; CI `40465237223` and Cloud commit `40465237241`: chain and three suite parts green, build `9eaf7b35dbf05643`), his word: the order card's Cash received takes more than goods plus delivery (his choice of that measure and
  of this road alone); the excess is the refund the fold raises (`refundOnOverpay`, unchanged); refused beside a claim, owing nothing, money on its
  way, or the row owing another figure. Section "cash past what an order owes"; Fable reviewed (one medium applied, re-checked clean; one low left:
  a stale open refund on the rid makes the stated refund larger than the fold raises). Only the relevant sections ran (his word); CI's suite is the full check.

- v1277 (`8b386e9e`, 27 Oct 2026; Cloud commit `40469587340`: chain, CI and suite parts 1 and 2 green, part 3 red on one source count in `test/book-read.mjs`, fixed in the next push), his word
  "I can't type in cash paid 600 in the latest CZ4-MK order": an order of several books paid past what it owes is taken (Salt Admin's Money received split, the excess on the last
  line, a refund to them), and his second word: the split pays the other books first and salt last. A row's own payment past what it owes passes in `makerAmendmentRoom` while no money
  and no other move waits on it and it owes something, priced and not a gift (Fable: one finding applied, re-checked clean).

## Salt Admin Needs you redesign
- Live as v1221 (`b8916ca2`, 23 Oct 2026; Cloud commit `39821813897`: chain and three suite parts green, live /rev `1e1013dcc935d44b`), from his canvas
  https://claude.ai/artifact/LG8PTbuT2EGpqSqsUkG6ie and `docs/plan-admin-needs-you.html`, with salt-ds 1.13.0 (#25: bar chips two by two under 820px,
  `salt-table--plain`) and 1.14.0 (#26: `salt-kpi--line`, `salt-action__money--lg`). To do / Pending / FYI, money first; one-shape cards with typed book
  tags (Admin only); the open card beside the list from 860px with the Agree inputs two by two (one Delivery select from Choose, one When). Fable reviewed
  the Agree inputs, the sort and Withdraw (four findings applied, re-checked). Rendered live at 390, 1180 and 1440. Accepted 23 Oct 2026.

## Salt Admin Record redesign
- Live as v1257 (`d3cc7739`, 26 Oct 2026; Cloud commit `40231375606`: chain and three suite parts green, CI `40231375639` green, build id `45f4c179b5a3db7c`), from his canvas
  https://claude.ai/artifact/6gHaEnSUVXzVDVBdwsJX6s and `docs/plan-admin-record.html` (every Ask as recommended, K declined: New customer's Other % stays a fraction).
  Parts a text tab row with unsent counts; form rows with their line and count; unsent entries as Needs you cards (Resend); every form two columns, typed tags,
  mono figures; the sale's reading a ledger; Correct a row's row card; Rewards and Offsets as cards; New customer's code shown as typed. Not yet opened by him.
- v1266 (`6c3058f8`, 27 Oct 2026; Cloud commit `40426316745`: chain and three suite parts green, CI `40426316666` green, build `a72729bfc4fbcfa9`), his yes after the
  shots: Record in the language of Shop's This device. Menus are settings lists; every form's fields are settings rows; two or three short choices a Segment
  (Type, Handover, Loan of, Associate, Hide for); names three words at most; the lead line screen-reader only. Display only, no route or body changed. Open: New
  customer's Role (six tiles) and its Locked / Unlock ghost; Handover and Associate are three-choice Segments against his "three or more, a dropdown", his call.
  The same push fixed Customers P1 and P2's overdue fixture, which read "4 d late" from 16:00 to 01:00 UTC (a UTC date against the page's Kuala Lumpur day).
- v1268 (`dd280fc3`, 27 Oct 2026; Cloud commit `40448833397`: chain and three suite parts green, CI `40448833537` green, build `5e68b2b172e55916`), his word and four answers:
  the sale form in his order (Row, Type, Book, Who, Date, Units, Price, added books, then Handover, Delivery, Handed over, Cash paid, Record the sale); Who typed with a
  datalist; Units and Handed over wheels (`makerWheel`, quarters to 25 then whole to 200); their price filled off the Desk's reading, which answers a sale with no
  total with `card` (the engine's cardAt); every change of a row in the same form (Row, Orders > Ledger's `ledger.open`, owed cards): a Correction of what differs and
  a Fulfilment of what moved since, Cancel this sale, Reopen, History, Other fields to Correct a row; Fixing off the menu. Fable: three findings applied (R2 attribution
  from attributionOf, a two-part change kept whole on retry through makerButton's `action.after`, defaulted rows), re-checked clean. Not yet opened by him.
