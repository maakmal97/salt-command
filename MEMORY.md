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

## Partner
- `partners` in `ledger/book.json` = CM4-TO since v1029 (06 Oct 2026): pays the floor to the sen on every book. The CBDO role stays unheld, his answer. No Add ID or Drift card control sets a partner; a new one is a hand fold of the book.

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
- Owner Access is proved: on 06 Oct 2026 the owner signed in through Access at `/desk` and at the Counter's `/all`. This proves only the login. Each Counter Admin control still needs his own acceptance, and Desk input controls stay until then.
- Maker order moves (Ready, Decline, Cancel, reply, No reply needed, Not found) take an immutable `rid` kept by the order book; Cancel is allowed from Maker only while nothing is paid (his decision of 05 Oct 2026). On origin/master as `4ba301c` (05 Oct 2026, after v1013), no version bump; live deployment not verified.
- #80 merged to master as `5005bbf4` on 08 Oct 2026; starting drift is now on master.
- #82 merged to origin/master at `b2d57db4` on 08 Oct 2026, preserving the native cancellation projection and disclosure on refresh. The coordinator reports Cloud commit `37744362331` completed the chain and all three deployed-tree suites with no notices; CI run `37744362378` is green. This is deployment/CI evidence, not owner acceptance.
- The accepted Counter Admin stream includes #75–84; #79's multi-book trade and shared-trip approval was at `ba456eb6`, the starting tip for this withdrawal prerequisite. #83 is `a99b06e0`; #84 is `dea7469b` and its Cloud commit, deployed-tree suites and suite notice completed successfully. #62 remains open. Its parent owns the Desk-origin unsent-queue boundary, while this child owns only Counter server-held queue/refusal review and guarded device-owned withdrawal. No owner acceptance is implied.
- Withdrawal runtime source remains `d05554de57773c1d61cda96fe62bfd281b88dccc`; its two-ordering tests and mutation manifest remain intact through refresh. The original source/test proof and CI on `6d17817dc699c17e0bb36cef9aa07cc0c110eaa2` are historical and do not certify the refreshed merge result. The refresh merge-base was `dea7469b849d344819ed90e24a07ea749a18e370`; the incoming `origin/master` delta to `045242d1` was only the seven fold/generated paths (`ledger/book.json`, `ledger/ledger.json`, `ledger/schema.json`, `master/changelog.json`, `master/salt_command.html`, `public/desk.html`, `public/rev.json`), with no `src`, `stmt`, `engine`, `tools` or `test` changes. The ordinary merge retained this branch's source/tests; its only conflicts were `public/desk.html` and `public/rev.json`, regenerated from the merged master. On the merged tree, withdrawal passed 28/0 at 09:16:09.8340835–09:16:11.2325989Z, log `C:\Users\maakm\.copilot\session-state\320c8d6d-3ff4-41c0-a8a1-37aa43670739\files\refresh-withdrawal-28.log`; resource admission passed 11/0 at 09:16:11.2548565–09:16:13.4651309Z, log `C:\Users\maakm\.copilot\session-state\320c8d6d-3ff4-41c0-a8a1-37aa43670739\files\refresh-admission-11.log`. Final build passed 09:16:44.0030046–09:16:44.4809386Z and gate passed 09:16:44.4941246–09:16:48.1925430Z, build id `660475fc427c7b1c`, logs `refresh-final-build.log` and `refresh-final-gate.log`. Exact-head Actions must be checked on the pushed merge result; the earlier run is not proof of it. #85 merged at `a2c0f9fe6dfb670a668a4d011ef8ba76b50fbf4e`; Cloud commit `37761745608` was reported active and remote follow-through is not yet proved. No owner acceptance.

Confirmed Add ID pre-fold selectability is a separate worktree change integrated with accepted #85 at `a2c0f9fe`. It admits only unique server-verified pair registrations, stamps their dependency on each trade row, and requires the successful native Add ID plan before a dependent trade can fold. Coordinator reviewed the expanded BUY, R3-party, bucket, and multi-book cases and granted the proof slot.

On 08 Oct 2026, registration/fold routes passed 31/0; the resource/reward section passed 21/0 with a pending reservation; each of the 22 registration mutations and the resource/registration argument mutation turned targeted checks red. The browser geometry probe passed desktop 1280px and phone 390px: 48px selector height, 5/5 center/±21px hits at each width, and the independent 20x20 mutation failed at the four offsets. The first combined full suite finished 7,703/1 across 722 sections because a source assertion still expected an unqualified SQL predicate; its log is in the session files. After qualification, the approval selection test extracts the actual `approved()` command from `tools/drafts.mjs` and runs it against migrated SQLite with approved, pending and committed rows. It passed 1/0; the pending-row SQL mutation failed the behavioral check normally (0/1). The coordinator reviewed the extraction and authorized one retry, which passed 7,705/0 across 723 sections at 10:54:17.0826620–10:57:11.5675703Z. Final build and gate passed last at 10:57:18.4672690–10:57:23.6725081Z, build id `74fe86cb28f2317b`.

Release is held: after verification, `origin/master` advanced from `a2c0f9fe` to `b9d6b5de` (28 commits ahead of this worktree), including the #85 fold/handoff and v1035 purchase. No commit or push was made. Cloud commit run `37766151363` on `a2c0f9fe` completed and deployed its chain but failed CI shard 1 at `Engine — the position, out of the desk (v338): oil: cover agrees` (2,528 passed, 1 failed in that shard); shards 2 and 3 succeeded. Exact-head CI, integration with current origin, deployment, live approval and owner acceptance are unverified.

Source-only refresh classification on 08 Oct 2026: the Git graph merge base is `b2d57db4`, so its full delta to `b9d6b5de` includes 30 paths, including already accepted #83–#85 source/test changes. From the accepted #85 source baseline `a2c0f9fe`, origin changes exactly seven fold/generated paths (`ledger/book.json`, `ledger/ledger.json`, `ledger/schema.json`, `master/changelog.json`, `master/salt_command.html`, `public/desk.html`, `public/rev.json`); no `src/`, `stmt/`, `engine/`, `tools/` or `test/` path changed. Those seven committed origin files were adopted without source replacement or generation. Effective working-tree delta against `b9d6b5de` is fingerprinted as SHA-256 `D40C7DF1618564FE876350159CFF1F0A30DF09C8604A5F56C189291E85816506` in the session's `files/reconciled-origin-worktree.patch`; it contains the ID source/test diff and no generated-path delta. The v338 CI failure is a position-engine/desk cover parity assertion for oil at `test/verify.mjs:2822`, not an Add ID assertion; log does not identify which compared value differs. The coordinator owns that classification/fix. No additional suite, build, gate, commit or push ran after refresh. All scoped processes ended and `.git` has no lock/temp objects; the heavy slot was explicitly released.
