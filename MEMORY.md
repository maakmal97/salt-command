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
- Newest rebuild of `draft`: `migrations/0010`; of `preapproval`: `migrations/0017`.
- `0011` adds `preapproval` (applied alone, the same way as 0010).
- `0012` indexes `draft` on `committed_at` and on `(status, committed_at)`.
- `0017_preapproval_amend.sql` rebuilds `preapproval` with `amend` in its stage CHECK (restateOrder's yes), keeping rows and both indexes. Live D1 carried 0011's narrow CHECK, so every amend tap answered 500; 0017 applied alone on 06 Oct 2026, schema, both indexes and the 71 rows by stage and status read back after.
- `0013_maker_requests.sql`, `0014_input_admission.sql`, `0015_vault_pair.sql` and `0016_vault_write_gate.sql` applied individually on 03 Oct 2026, with schema readback after each. Both `0012` indexes remain. Pair bootstrap/readback is revision 1; write gate reopened with zero active writers and pending outbox.

## Known red in the suite
- S1 fold replay (`test/fold-replay.mjs`), re-run 25 Oct 2026 on master 1d3b7c27: run alone, 18 of 20 staged batches replay byte-equal and 7de3edad and 580680a7 do not;
  in the full suite, with the same tree, it is 15 of 20 (also 9716cfe9, 61c21a89, 1867d416), six failed checks on master and on a branch with 57 more passes, so the section depends on what ran before it. Both of the first two carry a Their % row (`tierset`).
  The old fold (43fc5b0a) words it "TIER ... drift -0.2", the working fold "THEIR % ... 20% off": that wording is the whole difference in 580680a7. 7de3edad also differs in a Correction's
  `listRM` (315 old, 280 now; estimate: the 22 Oct curve). Not a booking-law regression: the test's moving 20-batch window has reached rows the fixed old fold cannot match. It stays
  red until the test normalises the wording and leaves out repriced batches.

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

## Partner
- `partners` in `ledger/book.json` = CM4-TO since v1029 (06 Oct 2026): pays the Floor, the order total up to the next RM 5, on every book (since 18 Oct 2026; it was cost to the sen). The CBDO role stays unheld, his answer. The Their % card's Make partner sets one (09 Oct 2026) and a partner is always an associate with a -R account; CM4-TO was made one by hand in the same version.

## S0b backup (live)
- Live as v1251 (`0f46fefe`, 25 Oct 2026; CI `40137142246` and Cloud commit `40137142222` green; the chain proved the phone serving `454e5dac1b323727`), his word "start on S0b backup", then his yes to the
  bucket, the key and the cron: `src/backup.js`, the backup cron and the morning alarm in `src/worker.js`, `tools/backup-key.mjs` and `tools/backup-open.mjs`, `docs/BACKUP.md`. The deploy log shows
  `BACKUP` on R2 bucket `salt-d1-backup`, `BACKUP_PUBLIC_JWK` and the schedule `30 18 * * *` (02:30 in Kuala Lumpur). The key is `10_Data\salt_backupkey.json`, minted 25 Oct 2026; a copy off that disk is his to keep.
- The first backup was filed by hand through wrangler on 25 Oct 2026 at 06:15 MYT: `backup/2026-10-25.json`, 1,761,163 bytes read back equal (604 drafts, 151 pre-approvals, 118 maker requests, 9 input admissions, the vault pair),
  with `backup:last` ok. The cron's own first night is 02:30 on 26 Oct. Three suite sections (`backup`, `backup-cron`, `backup-tools`; 29, 13 and 16 mutations) hold the restore drill.
  The real object was opened with his key on 25 Oct 2026 (`node tools/backup-open.mjs`, counts only) and the counts matched exactly (his word). Open: a copy of the key off the laptop's disk.

## Disabled automation
- `Salt fold (manual backup)` = `trig_01UrnjQMWA3f6GXN5R6Dzi4S`, disabled.

## Retired surfaces
- The phone app `public/index.html`, `public/data.json`, and the claude.ai mirror.

## Endpoints
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
- Built 26 Oct 2026 on branch `claude/peaceful-mclean-ddc05c` (P0 salt-ds#28 1.16.0 merged; P1 to P8), not landed: the moderator holds the landing turn
  (order Shop, Orders, Customers, Record). Their % and Make partner moved from Record > Pricing to the account card; new reads
  `/all/maker/customer-of|reward-of/<code>` (Fable reviewed, two low findings: one stated, one withdrawn).

## Salt Admin Needs you redesign
- Live as v1221 (`b8916ca2`, 23 Oct 2026; Cloud commit `39821813897`: chain and three suite parts green, live /rev `1e1013dcc935d44b`), from his canvas
  https://claude.ai/artifact/LG8PTbuT2EGpqSqsUkG6ie and `docs/plan-admin-needs-you.html`, with salt-ds 1.13.0 (#25: bar chips two by two under 820px,
  `salt-table--plain`) and 1.14.0 (#26: `salt-kpi--line`, `salt-action__money--lg`). To do / Pending / FYI, money first; one-shape cards with typed book
  tags (Admin only); the open card beside the list from 860px with the Agree inputs two by two (one Delivery select from Choose, one When). Fable reviewed
  the Agree inputs, the sort and Withdraw (four findings applied, re-checked). Rendered live at 390, 1180 and 1440. Accepted 23 Oct 2026.
