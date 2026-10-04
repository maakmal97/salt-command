# Salt Command: current facts

## Worker
- Deployed at `https://salt-command.qyts8mh72kyg.workers.dev`.

## Access
- `REQUIRE_ACCESS` = `"0"` and `ACCESS_TEAM`, `ACCESS_AUD` are empty in `wrangler.jsonc` (the Worker does not verify a JWT yet).
- Since 04 Oct 2026 a hostname Access policy, set outside the repo's config, fronts the Desk Worker: an unauthenticated `/rev` answers 302.
- `ORDER_STORE` is `"object"` since 04 Oct 2026 (#40); the old `q:orders` blob was retired on 04 Oct 2026.
- The maintenance guard exists in both Workers and QR Command (`MAINTENANCE_UNTIL`, an ISO UTC time; empty = off, the current value).

## Migrations
- Newest rebuild: `migrations/0010`.
- `0011` adds `preapproval` (applied alone, the same way as 0010).
- `0012` indexes `draft` on `committed_at` and on `(status, committed_at)`.
- `0013_maker_requests.sql`, `0014_input_admission.sql`, `0015_vault_pair.sql` and `0016_vault_write_gate.sql` applied individually on 03 Oct 2026, with schema readback after each. Both `0012` indexes remain. Pair bootstrap/readback is revision 1; write gate reopened with zero active writers and pending outbox.

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
- `GET /stmt/rev` (Desk build id only; internal Counter service binding, keyed by `X-Stmt-Desk` using the shared `STMT_DESK_KEY`)
- The endpoints above are keyed via `X-Salt-Key` except `/stmt/rev`, which uses `X-Stmt-Desk`.

## Counter maker
- `/all/maker/*` is Counter Admin behind verified Access identity and the exact owner email.
- `POST /orders/<id>/amend` is the customer-session amendment path; Admin inputs stay under `/all/maker/inputs/*`.
- Desk maker operations use the separate `DESK_MAKER` binding and `COUNTER_MAKER_KEY`; name and places vault reads return ciphertext only.
- The bridge bindings and matching capability secrets shipped with #30; live owner-JWT acceptance remains unverified.
- #33 merged at `90dd40af`, v993 (`6d77889849e2584d`), shipping Maker Chat/No reply needed and Notice controls with immutable reply receipts, encrypted device reload recovery and isolated serialized example threads. Cloud commit `37104860822` completed chain and deployed-tree suite green (6,677 assertions); final live revision matched and test notices cleared. Counter version `d61a7379-3014-442b-b59c-3479b83c7562` deployed; 51 real account records were read back after publication. This is deployment proof, not genuine owner acceptance or full maker replacement.
- Preparatory #31 merged at `8dc9852b`, v991 (`c7ff1c2adce46263`). Cloud commit `37096579205` deployed both Workers, proved Desk revision, marked/reseeded D1 and published/read back 51 account records. Its deployed-tree suite passed (6,605 assertions).
- `0013` retains immutable non-vault Maker entries for same-request recovery; `0015` records outbox attempt order for isolated, bounded cron retries. Their dependent source is deployed.
- Pair routes, reload-persistent encrypted device retries/conflict review, Maker/Desk ID/place outbox recovery and journaled local pair-file seed/pull access shipped in the preparatory release. Pair bootstrap completed on 03 Oct 2026 under paused maintenance. Two source snapshots and two independent revision-1 readbacks matched ciphertext digest `a534e4ccfa09e2d0093cade895a6fa9954add956f30df33f5c6a144090e326f5`.
- #32 merged at `cd7580fb`, v992 (`da38cd9bf77de23e`); Cloud commit `37099064791` deployed both Workers and completed chain and suite green. Production's sole 100% traffic version `c57f4db0-ce15-4f14-b6cf-a562b0a22f2b` has `VAULT_STORE=pair`. Public names discovery returned revision 1 and matching ciphertext; full pair readback after deploy/reseed remained identical. D1 is now names/places authority. Positive owner-keyed places/service acceptance remains unverified.
- Pair seed completion reconciles both local maps and its baseline under the journal, including retained-request replay, preserving unsent partner edits. Old retained requests without a merge baseline refuse explicitly.
- `0016_vault_write_gate.sql` and its Worker guards are deployed. Draining began at 12:45 MYT; conditional pause was independently confirmed at 12:49 MYT with no active writers or pending outbox. Two failed shell-command pause attempts were separately read back as still draining. Account phase writes now use SQL-file transport, verified locally by actual CLI/SQLite and on the paused live gate. Explicit reopen at `2026-10-03T05:13:22.622Z` followed matching deployed pair-authority readback; immediate readback was open/active 0/pending 0. Old KV is recovery material only, not a safe rollback after subsequent pair writes. Vault-key was unchanged.
- Access provisioning/readback remains blocked by current account OAuth permissions; owner authentication has not been proved. Keep Desk Access and Desk input equivalents unchanged until those release gates pass.
- Maker order moves (Ready, Decline, Cancel, reply, No reply needed, Not found) take an immutable `rid` kept by the order book; Cancel is allowed from Maker only while nothing is paid (his decision of 05 Oct 2026). Landed on branch `claude/maker-order-actions` off v1010, not bumped, pushed or deployed.
