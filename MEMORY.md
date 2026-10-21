# Salt Command: current facts

## Worker
- Deployed at `https://salt-command.qyts8mh72kyg.workers.dev`.

## Fold dispatch
- The Worker starts `cloud-commit.yml` on each approval as the GitHub App `salt-desk-dispatch-mk` (App ID 5222854, Actions read and write, installed on this repo only), key in the Worker secret `GH_APP_KEY` (PKCS#8). `SALT_GITHUB_TOKEN` lapsed about 02 Oct 2026 (401, then 400 from 05 Oct); while it failed every fold waited on GitHub's hourly schedule. Proof of health: Worker log `stage dispatch: 204`.

## Access
- `REQUIRE_ACCESS` = `"1"` since 06 Oct 2026, `ACCESS_TEAM` `maakmal`, `ACCESS_AUD` `14a921e2…60fecf`: one owner Access application covers the Desk host and the Counter's `/all`; the CI service token `salt-desk-ci` reads `/rev` and rings `/push/send` only.
- Since 04 Oct 2026 a hostname Access policy, set outside the repo's config, fronts the Desk Worker: an unauthenticated `/rev` answers 302.
- `ORDER_STORE` is `"object"` since 04 Oct 2026 (#40); the old `q:orders` blob was retired on 04 Oct 2026.
- The maintenance guard exists in both Workers and QR Command (`MAINTENANCE_UNTIL`, an ISO UTC time; empty = off, the current value).

## Migrations
- Newest rebuild of `draft`: `migrations/0010`; of `preapproval`: `migrations/0017`.
- `0011` adds `preapproval` (applied alone, the same way as 0010).
- `0012` indexes `draft` on `committed_at` and on `(status, committed_at)`.
- `0017_preapproval_amend.sql` rebuilds `preapproval` with `amend` in its stage CHECK (restateOrder's yes), keeping rows and both indexes. Live D1 carried 0011's narrow CHECK, so every amend tap answered 500; 0017 applied alone on 06 Oct 2026, schema, both indexes and the 71 rows by stage and status read back after.
- `0013_maker_requests.sql`, `0014_input_admission.sql`, `0015_vault_pair.sql` and `0016_vault_write_gate.sql` applied individually on 03 Oct 2026, with schema readback after each. Both `0012` indexes remain. Pair bootstrap/readback is revision 1; write gate reopened with zero active writers and pending outbox.

## Counter Batch A
- Built on branch `claude/counter-batch-a-build-b9ddad` (19 Oct 2026), P0 salt-ds#13 (1.7.0) merged; collection points live in Counter KV `maker:points` once the version ships; his list is empty until he fills it on Salt Account, and a collect Ready is refused without one.

## Counter Batch B
- Built on branch `claude/counter-batch-b-build-0dde24` (20 Oct 2026): the way on Prices, Home's start tiles, Order again, the basket. No
  salt-ds part, no Worker change. He accepts it on `/all/test` as 0000-0002 (three orders handed over, two open, room to order).

## Hours past midnight
- Live 20 Oct 2026 (41aada8f, width fix 87719939; Cloud commits 39392733014 and 39393655894: chain, three suite parts and the statements deploy green): a close earlier than the
  open is the next day's, one rule `stmt/hours.js` `openParts`; Salt Admin's Shop hours is a week chart (canvas V63). Owner acceptance not yet given.
- Round 2, his eight answers to Fable's design (20 Oct 2026): up to six spans a day, 00:00 to 24:00, overlaps merged, dated days
  (`schedule.dates`, 90 days ahead, 40 at most), the preview read `GET /all/maker/hours?preview=`, Copy to chips, Discard and Undo.

## Counter Batch C
- Live as v1182 (`19b226d7`, 20 Oct 2026; Cloud commit `39318980626`: chain and three suite parts green, live /rev `1a05919acb1d3a29`): saved spots, the sealed name and
  unit, the confirm time, Help, labels at 600 and the slider (salt-ds#15, #16, #17: 1.9.0 to 1.9.2; QR Command #12 live). KV `confirm:within`
  is empty until the first hourly cron after the deploy. Owner acceptance not yet given.

## Counter test surface
- Live as v1166 (`2e876db5`, 19 Oct 2026): `/all/test` behind `/all`'s two locks; Cloud commit `39195289245` deployed both Workers, proved live `/rev` at `0bd585f1e036adde` and passed all three suite parts. `0000-0002` has no fixture until he taps Make the practice accounts on Salt Account and a publish runs. Owner acceptance not yet given.

## Associate reward
- Live as v1187 (`b9006c59`, 20 Oct 2026; Cloud commit `39395156043`: chain and three suite parts green, live /rev `832779203aef614c`): the switch is `REWARD.stated.salt.associate` `{times: 10, since: "2026-10-20"}`; `REWARD_OPEN` states ten associates at `upTo` s276. No customer basis (his yes to the loyalty plan's Ask 4); the six customers hold about 6.4 units, unspent. The loyalty unit (`docs/plan-loyalty-unit.html`, branch `claude/bold-booth-4df727`) builds next. Owner acceptance not yet given.

## Loyalty unit
- Built 21 Oct 2026 on branch `claude/musing-swanson-67b061` from `docs/plan-loyalty-unit.html` (his yes typed 21 Oct 2026): `REWARD.stated.salt.loyal`
  `{every: 20, since: "2026-10-21"}`; everyone at nought. 0000-0002 is a plain customer (FIX_VERSION 14). Owner acceptance not yet given.

## Notifications
- Live as v1167 (`e35ee35b`, 19 Oct 2026; Cloud commit `39223032636`: chain, three suite parts and CI green): Salt Admin (was Salt Account) has its own worker `/all/sw.js` and `opush:` subscriptions; the Desk rings orders and approvals only while no Salt Admin send goes through (KV `admin:on`). He has not yet re-added Salt Admin to the home screen or turned its bell on (Shop > This device), so the Desk still rings for now. The stock-light banner has its Desk side only: nothing posts `{"tag":"stock"}` yet (it needs `tools/stmt-publish.mjs` to compare lights).

## Partner
- `partners` in `ledger/book.json` = CM4-TO since v1029 (06 Oct 2026): pays the Floor, the order total up to the next RM 5, on every book (since 18 Oct 2026; it was cost to the sen). The CBDO role stays unheld, his answer. The Their % card's Make partner sets one (09 Oct 2026) and a partner is always an associate with a -R account; CM4-TO was made one by hand in the same version.

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
- The count, tier, hush and printed-size forms retain timestamp/signature caches independently of the input button's durable body. Their completion hooks must run on the initial confirmed send and on the button's direct retained retry. Automatic offsets previously bypassed that sender; their device record needs the exact offset shape in `vaultPendingOk`. The generated Hush validator also lacked its `TIP_ID` dependency and threw before transport. Generated-page lifecycle checks and independent implementation mutations cover these prerequisites; this is not owner acceptance or clearance to retire Desk inputs.
- `/all/maker/*` is Counter Admin behind verified Access identity and the exact owner email.
- `POST /orders/<id>/amend` is the customer-session amendment path; Admin inputs stay under `/all/maker/inputs/*`.
- Desk maker operations use the separate `DESK_MAKER` binding and `COUNTER_MAKER_KEY`; name and places vault reads return ciphertext only.
- The bridge bindings and matching capability secrets shipped with #30. The owner's JWT is accepted live, since his Access login of 06 Oct 2026.
- #33 merged at `90dd40af`, v993 (`6d77889849e2584d`), shipping Maker Chat/No reply needed and Notice controls with immutable reply receipts, encrypted device reload recovery and isolated serialized example threads. Cloud commit `37104860822` completed chain and deployed-tree suite green (6,677 assertions); final live revision matched and test notices cleared. Counter version `d61a7379-3014-442b-b59c-3479b83c7562` deployed; 51 real account records were read back after publication. This is deployment proof, not genuine owner acceptance or full maker replacement.
- Preparatory #31 merged at `8dc9852b`, v991 (`c7ff1c2adce46263`). Cloud commit `37096579205` deployed both Workers, proved Desk revision, marked/reseeded D1 and published/read back 51 account records. Its deployed-tree suite passed (6,605 assertions).
- `0013` retains immutable non-vault Maker entries for same-request recovery; `0015` records outbox attempt order for isolated, bounded cron retries. Their dependent source is deployed.
- Pair routes, reload-persistent encrypted device retries/conflict review, Maker/Desk ID/place outbox recovery and journaled local pair-file seed/pull access shipped in the preparatory release. Pair bootstrap completed on 03 Oct 2026 under paused maintenance. Two source snapshots and two independent revision-1 readbacks matched ciphertext digest `a534e4ccfa09e2d0093cade895a6fa9954add956f30df33f5c6a144090e326f5`.
- #32 merged at `cd7580fb`, v992 (`da38cd9bf77de23e`); Cloud commit `37099064791` deployed both Workers and completed chain and suite green. Production's sole 100% traffic version `c57f4db0-ce15-4f14-b6cf-a562b0a22f2b` has `VAULT_STORE=pair`. Public names discovery returned revision 1 and matching ciphertext; full pair readback after deploy/reseed remained identical. D1 is now names/places authority. Positive owner-keyed places/service acceptance remains unverified.
- Pair seed completion reconciles both local maps and its baseline under the journal, including retained-request replay, preserving unsent partner edits. Old retained requests without a merge baseline refuse explicitly.
- `0016_vault_write_gate.sql` and its Worker guards are deployed. Draining began at 12:45 MYT; conditional pause was independently confirmed at 12:49 MYT with no active writers or pending outbox. Two failed shell-command pause attempts were separately read back as still draining. Account phase writes now use SQL-file transport, verified locally by actual CLI/SQLite and on the paused live gate. Explicit reopen at `2026-10-03T05:13:22.622Z` followed matching deployed pair-authority readback; immediate readback was open/active 0/pending 0. Old KV is recovery material only, not a safe rollback after subsequent pair writes. Vault-key was unchanged.
- A2 landed on master (offsets, `makerOffsetOffers`/`makerOffset`). Cloud commit `37393081534` re-seeded `REWARD` into the mirror and read it back byte for byte. The fold had refused every reward spend since `aed7523c` ("no configured reward": `book.json` holds no `REWARD`); `tools/fold.mjs` now reads the scheme from the extract's `ledger.REWARD` (`--ledger`).
- Owner Access is proved: on 06 Oct 2026 the owner signed in through Access at `/desk` and at the Counter's `/all`. This proves only the login. On 10 Oct 2026 he accepted six Counter Admin controls: multi-book trade and trip, resale streams, reward redemption, marked-sale cover, Corrections, and lot amendments. He also confirmed the Counter's iPhone checks; the exact F15 points are still owed. #62 is complete: since v1104 (#167, 14 Oct 2026) the Desk only reads, Counter Admin writes the book, and the Desk keeps only the restock date, pin filing, alerts and the waiting stamp; he accepted it on phone and laptop on 14 Oct 2026.
- Maker order moves (Ready, Decline, Cancel, reply, No reply needed, Not found) take an immutable `rid` kept by the order book; Cancel is allowed from Maker only while nothing is paid (his decision of 05 Oct 2026). On origin/master as `4ba301c` (05 Oct 2026, after v1013), no version bump; live deployment not verified.
- #80 merged to master as `5005bbf4` on 08 Oct 2026; starting drift is now on master.
- #82 merged to origin/master at `b2d57db4` on 08 Oct 2026, preserving the native cancellation projection and disclosure on refresh. The coordinator reports Cloud commit `37744362331` completed the chain and all three deployed-tree suites with no notices; CI run `37744362378` is green. This is deployment/CI evidence, not owner acceptance.
- The accepted Counter Admin stream includes #75–84; #79's multi-book trade and shared-trip approval was at `ba456eb6`, the starting tip for this withdrawal prerequisite. #83 is `a99b06e0`; #84 is `dea7469b` and its Cloud commit, deployed-tree suites and suite notice completed successfully. #62 remains open. Its parent owns the Desk-origin unsent-queue boundary, while this child owns only Counter server-held queue/refusal review and guarded device-owned withdrawal. No owner acceptance is implied.
- Withdrawal runtime source remains `d05554de57773c1d61cda96fe62bfd281b88dccc`; its two-ordering tests and mutation manifest remain intact through refresh. The original source/test proof and CI on `6d17817dc699c17e0bb36cef9aa07cc0c110eaa2` are historical and do not certify the refreshed merge result. The refresh merge-base was `dea7469b849d344819ed90e24a07ea749a18e370`; the incoming `origin/master` delta to `045242d1` was only the seven fold/generated paths (`ledger/book.json`, `ledger/ledger.json`, `ledger/schema.json`, `master/changelog.json`, `master/salt_command.html`, `public/desk.html`, `public/rev.json`), with no `src`, `stmt`, `engine`, `tools` or `test` changes. The ordinary merge retained this branch's source/tests; its only conflicts were `public/desk.html` and `public/rev.json`, regenerated from the merged master. On the merged tree, withdrawal passed 28/0 at 09:16:09.8340835–09:16:11.2325989Z, log `C:\Users\maakm\.copilot\session-state\320c8d6d-3ff4-41c0-a8a1-37aa43670739\files\refresh-withdrawal-28.log`; resource admission passed 11/0 at 09:16:11.2548565–09:16:13.4651309Z, log `C:\Users\maakm\.copilot\session-state\320c8d6d-3ff4-41c0-a8a1-37aa43670739\files\refresh-admission-11.log`. Final build passed 09:16:44.0030046–09:16:44.4809386Z and gate passed 09:16:44.4941246–09:16:48.1925430Z, build id `660475fc427c7b1c`, logs `refresh-final-build.log` and `refresh-final-gate.log`. Exact-head Actions must be checked on the pushed merge result; the earlier run is not proof of it. #85 merged at `a2c0f9fe6dfb670a668a4d011ef8ba76b50fbf4e`; Cloud commit `37761745608` was reported active and remote follow-through is not yet proved. No owner acceptance.
- Confirmed Add ID selectability landed (08 Oct 2026, PR #86): a Counter trade may name a party whose Add ID is verified in the vault pair, pending or approved; the row carries its dependency and the fold applies the Add ID first, refusing the batch without it. Cloud and owner acceptance are not yet proved.
