# Salt Command, on the phone

The Obsidian Salt Desk, ported to a real cloud app so the ledger and the pricing engine
are reachable on the go and a transaction can be added from the phone. It is the same desk
as the laptop master; this repo is a deploy surface, not a second source.

Deployed as a Cloudflare Worker with static assets, gated by Cloudflare Access. New
transactions push to a KV-backed queue; the daily run folds them into the source.

## Hard rules

1. **The master is elsewhere. Never hand-edit `public/index.html`.** The one place the desk
   is edited is the Cow-Crm01 master:
   `C:\Users\maakm\Claude\Projects\Personal\Cow-Crm01_Salt Business\01_Dashboard\salt_command.html`.
   `public/index.html` is a **build output** of it (`npm run build`), committed so the data
   lives in the repo. A hand-edit here is overwritten on the next build and lost. If a change
   to the desk is needed, edit the master, then build.
2. **Plaintext names never reach the cloud; the encrypted vault may.** `/bio` (the plaintext
   directory) is answered but **dropped**, so `salt_bio.json` never ships. `/vault` DOES sync,
   but only the AES-GCM envelope `{v,salt,iv,ct}` (`tools/seed-vault.mjs` puts it there); the
   passphrase never leaves the browser and the Worker refuses anything that is not that
   ciphertext shape. So the phone can show names after a password and code-only otherwise.
   See "Names on the phone" below for what is built and what is still a master change.
3. **This repo is private.** It carries the real trading ledger. It must never be public, and
   no real name may ever be committed.
4. **No third-party loads at runtime.** The desk is self-contained: inline CSS and JS, no CDN,
   no web fonts. The build fails if it finds an external `src`/`url(`/`@import`. The CSP in
   `public/_headers` is `connect-src 'self'` (for the queue) and otherwise self-only.
5. **British English, no em-dashes,** in code, docs and UI copy alike. RM and **unit** only;
   the desk retired the mass symbol at v161.

## The three surfaces, and how they stay coherent

| Surface | Path | Role |
|---|---|---|
| **Master** | Cow-Crm01 `...\01_Dashboard\salt_command.html` | The only editable source. No cloud or PWA code in it. |
| **claude.ai mirror** | `...\Artifacts\salt-command\index.html` | Published from the master by Cowork. Unchanged by this repo. |
| **Cloud deploy** | this repo's `public/index.html` | Built from the master by `tools/build.mjs`, then `wrangler deploy`. |

The master feeds both the mirror (via Cowork `update_artifact`) and this repo (via the build).
The build **only adds**: a PWA head, a service worker, a per-device id, and cloud-mode copy.
It changes no ledger figure. Every patch anchors on one unique line and the build aborts if an
anchor moves, so a master edit that would silently break a patch fails loudly instead.

## The queue loop (how a phone entry reaches the ledger)

```
phone: add transaction ──POST /queue──▶ Worker ──▶ KV  (key q:<deviceId>, this device's queue)
                                                    │
   daily run:  node tools/drain.mjs  ◀─────────────┘   (union all devices, dedupe by 'at')
        │  writes 06_Data\salt_queue_cloud.json  (same shape as salt_queue.json)
        ▼
   salt-daily-price-brief commits it into the master, sets QUEUE_COMMITTED, bumps the version
        │
        ├─ node tools/drain.mjs --committed <QUEUE_COMMITTED>   (prune the file)
        ├─ npm run build                                        (refresh public/index.html)
        └─ npm run deploy   +   git commit/push                 (phone gets the new ledger)
```

The desk needed almost no change because it already speaks this HTTP contract to
`serve_desk.py` on the laptop. The Worker is that server, in the cloud, backed by KV instead
of disk. `/queue/ping` returns `cloud:true`, which tells the built desk to keep names
device-local and skip the laptop-only 3-second heartbeat.

Offline on the phone: an entry is held in `localStorage` and the desk says so; it pushes on the
next open with a connection (the built desk auto-pushes any held queue when the ping succeeds),
and from v279 the ten-second tick retries a held entry rather than waiting for that next open.

## Continuous sync (v279)

The ledger is baked into `public/index.html` at build time, so a phone is only ever as current
as its last load. Three things close that gap, and none of them commits anything:

1. **The phone polls `/rev` every ten seconds** while it is on screen, and compares the returned
   `id` against the `SALT_BUILD_ID` baked into the page it is running. Different means a newer
   build is live: it reloads if the desk is idle, and offers a chip if it is not, because
   reloading over a half-typed entry would throw the entry away. The Worker serves `/rev` from
   `public/rev.json` with `no-store`, and `sw.js` never caches it.
2. **`serve_desk.py` ships the laptop** for as long as it is on. It watches the master, waits
   90 seconds for it to settle, runs `npm test` and deploys ANY change, not only a version bump.
   Separately it drains the phone queue to disk every 60 seconds. `SALT_NO_CLOUD=1` turns the
   leg off; `SALT_DEBOUNCE` and `SALT_DRAIN_SECS` tune it.
3. **`salt_daily.ps1` holds the server open around the daily run**, so phone entries are on disk
   before the run reads a figure and the commit reaches the phone in seconds.

**A deploy is decided by `rev.json.id` against `.deployed.json.id`, never by hashing the build
output before and after.** The old test asked "did my build change anything", which is a
different question from "is the phone behind", and the two part company the moment anything else
builds the repo. It happened on 10 Aug: a session built, a sync pass rebuilt identical bytes ten
seconds later, saw no difference and reported the phone current while a new bundle sat
undeployed. Two recorded facts cannot drift like that, and a failed deploy leaves them unequal
so the next pass retries by itself.

## Names on the phone

The desk shows **codes by default**. Real names are synced only as ciphertext and shown only
after a password.

**What is built and proven (cloud side):**
- The Worker stores and returns the encrypted vault at `/vault` (ciphertext only; a plaintext
  POST is refused). `/bio` is always dropped.
- `tools/seed-vault.mjs` reads the current directory (`salt_bio.json`), encrypts it with your
  passphrase into the exact envelope the desk's `vaultDecrypt` expects, and pushes only that
  ciphertext to KV. Verified end to end: the phone loads the ciphertext and the desk's own
  `vaultDecrypt` returns the names. Run it with the passphrase in the environment, never a file:

  ```
  # PowerShell, from this repo, after deploy:
  $env:SALT_VAULT_PASS="your passphrase"; npm run build; node tools/seed-vault.mjs
  ```

- In cloud mode the built desk fetches the vault (`vaultLoad`) and **auto-hides names when the
  app leaves the foreground** (`visibilitychange` -> `lockVault`).

**What is still a master change (not doable from this repo):** a proper phone-facing
"Show names" control that asks for the passphrase inline and reveals, with the right copy.
The desk's current Names panel treats the vault as a *legacy one-time import into plaintext*
and carries "kept in the clear" copy that is wrong for the phone. And `NAME_VAULT` is a lexical
`let`, so the build cannot re-wire the reveal from injected code. That UI belongs in the
Cow-Crm01 master (a Cowork/master session); once it lands, the sync above already feeds it.

## Files

| Path | What it is |
|---|---|
| `src/worker.js` | The Worker. Cloud stand-in for `serve_desk.py`: `/queue`, `/vault` (ciphertext), `/bio` (dropped), static assets. KV-backed. |
| `tools/seed-vault.mjs` | Encrypt the current names with your passphrase and push the ciphertext to KV. Never writes plaintext anywhere. |
| `public/index.html` | The built desk. **Derived from the master, do not hand-edit.** Committed on purpose. |
| `public/sw.js` | Service worker. Shell network-first; the `/queue` API is never cached. |
| `public/manifest.webmanifest`, `public/icon-*.png` | Home-screen install. Icons from `tools/make_icons.py`. |
| `public/_headers` | CSP and security headers, applied by Cloudflare to the assets. |
| `wrangler.jsonc` | Worker + assets + the `SALT_QUEUE` KV binding. |
| `tools/build.mjs` | Master → `public/index.html`, with fail-loud patch anchors. Also writes `public/rev.json`. |
| `public/rev.json` | `{v,id,built}` for the build on disk. `id` is a hash of the built file. **Written by the build, never by hand.** |
| `.deployed.json` | `{id,v,at}` for the build that last DEPLOYED successfully. Written by `salt_sync.ps1` on a reported success and nowhere else. |
| `tools/drain.mjs` | KV → `06_Data\salt_queue_cloud.json`; `--committed <ISO>` prunes; `--status` inspects. |
| `tools/make_icons.py` | Regenerate the crystal icons. |
| `test/verify.mjs` | Smoke suite: Worker contract, name-drop, access gate, drain helpers, build integrity. |

## Working on it

```
npm install                 # once, for wrangler
npm run build               # master -> public/index.html (run after any master edit)
npm run dev                 # build, then wrangler dev on a local port
npm test                    # the smoke suite, ~2s, no network
```

## Deploying

```
npm run deploy              # builds, then npx wrangler deploy
```

First-time Cloudflare setup, in order:

1. **KV namespace.** `npx wrangler kv namespace create salt_queue`, then paste the printed id
   into `wrangler.jsonc` in place of `PLACEHOLDER_KV_ID`.
2. **Deploy.** `npm run deploy`. Note the `*.workers.dev` URL it prints.
3. **Cloudflare Access** (this is the gate on the data; do it before sharing the URL):
   - Cloudflare dashboard → **Zero Trust** → **Access** → **Applications** → **Add an
     application** → **Self-hosted**.
   - Application domain: the Worker's `*.workers.dev` hostname (or a custom domain if bound).
   - Add a **policy**: Action **Allow**, Include → **Emails** → your Google address
     (`maakmal97@icloud.com` / `maakmal1997@gmail.com`), identity provider Google.
   - Session duration to taste (e.g. 30 days so the phone rarely re-logs-in).
   - Save. Now the site prompts for Google sign-in before it serves anything.
4. **Harden the queue** (after Access is live): set `REQUIRE_ACCESS` to `"1"` in
   `wrangler.jsonc` `vars` and redeploy. The Worker then refuses any write that did not arrive
   through Access. Leave it `"0"` only until Access is configured.

The phone's PWA is same-origin with the Worker, so once you are signed in through Access the
`POST /queue` carries the Access cookie automatically and just works.

## Daily-run integration

`Scheduled\salt-daily-price-brief` gains a cloud leg. After it has committed the queue and set
`QUEUE_COMMITTED`, and before it finishes, it must (from this repo):

```
node tools/drain.mjs                                  # BEFORE committing: pull phone entries
# ... fold salt_queue_cloud.json into the master alongside the laptop queue ...
node tools/drain.mjs --committed <QUEUE_COMMITTED>    # prune what was just committed
npm run build && npm run deploy                       # ship the fresh ledger to the phone
git add -A && git commit -m "..." && git push         # version the data at github
```

`drain` uses the machine's wrangler auth; an unattended run may need `CLOUDFLARE_API_TOKEN`.
It is race-safe: a KV key that changed mid-drain is left for the next run, and everything is
deduped by the entry's own `at`, so nothing is committed twice.

## Tests

`npm test` runs `test/verify.mjs`: 32 assertions with no network or browser. Add one for every
behavioural change to the Worker, the build patches or the drain. The desk's own rendering is
covered by the daily run's jsdom pass against the master, not here.
