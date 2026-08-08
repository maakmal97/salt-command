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
2. **Names never reach the cloud.** The desk ships codes only. The Worker answers `/vault`
   and `/bio` so the page stays happy but **drops** any name posted to them; the plaintext
   directory (`salt_bio.json`) and the encrypted vault (`salt_vault.json`) live only on the
   laptop and are git-ignored here. On the phone the desk shows codes, which is the point.
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
next open with a connection (the built desk auto-pushes any held queue when the ping succeeds).

## Files

| Path | What it is |
|---|---|
| `src/worker.js` | The Worker. Cloud stand-in for `serve_desk.py`: `/queue`, `/vault`, `/bio`, static assets. KV-backed, names dropped. |
| `public/index.html` | The built desk. **Derived from the master, do not hand-edit.** Committed on purpose. |
| `public/sw.js` | Service worker. Shell network-first; the `/queue` API is never cached. |
| `public/manifest.webmanifest`, `public/icon-*.png` | Home-screen install. Icons from `tools/make_icons.py`. |
| `public/_headers` | CSP and security headers, applied by Cloudflare to the assets. |
| `wrangler.jsonc` | Worker + assets + the `SALT_QUEUE` KV binding. |
| `tools/build.mjs` | Master → `public/index.html`, with fail-loud patch anchors. |
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
