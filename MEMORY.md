# Salt Command: current facts

## Worker
- Deployed at `https://salt-command.qyts8mh72kyg.workers.dev`.

## Access
- `REQUIRE_ACCESS` = `"0"` (the Cloudflare Access application is removed).

## Migrations
- Newest rebuild: `migrations/0010`.
- `0011` adds `preapproval` (applied alone, the same way as 0010).
- `0012` indexes `draft` on `committed_at` and on `(status, committed_at)`.
- `0013_maker_requests.sql`, `0014_input_admission.sql`, `0015_vault_pair.sql` and `0016_vault_write_gate.sql` applied individually on 03 Oct 2026, with schema readback after each. Both `0012` indexes remain. Pair authority has no row; write gate is open, zero active writers at readback.

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
- `0013` retains immutable non-vault Maker entries for same-request recovery; `0015` records outbox attempt order for isolated, bounded cron retries. The migrations are applied; dependent follow-up source is not yet deployed.
- Opt-in pair routes, reload-persistent encrypted device retries/conflict review, Maker/Desk ID/place outbox recovery, journaled local pair-file seed/pull access and maintenance tools await the preparatory source release. `VAULT_STORE=pair` is not configured. Live names/places authority remains KV; no bootstrap or authority switch has occurred.
- Pair seed completion reconciles both local maps and its baseline under the journal, including retained-request replay, preserving unsent partner edits. Old retained requests without a merge baseline refuse explicitly; this fix remains source-only.
- Preparatory `0016_vault_write_gate.sql` is applied: standalone default-open maintenance with active-writer drain, accepted outbox completion and keyed readback. Its Worker guards await source deployment; no maintenance pause or authority change has occurred.
- Access provisioning/readback remains blocked by current account OAuth permissions; owner authentication has not been proved. Keep Desk Access and Desk input equivalents unchanged until those release gates pass.
