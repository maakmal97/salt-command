# Salt Command: current facts

## Worker
- Deployed at `https://salt-command.qyts8mh72kyg.workers.dev`.

## Access
- `REQUIRE_ACCESS` = `"0"` (the Cloudflare Access application is removed).

## Migrations
- Newest rebuild: `migrations/0010`.
- `0011` adds `preapproval` (applied alone, the same way as 0010).
- `0012` indexes `draft` on `committed_at` and on `(status, committed_at)`.

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
- All keyed via `X-Salt-Key`.
