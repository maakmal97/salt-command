# Salt Command, on the phone

The Obsidian Salt Desk, ported to a real cloud app so the ledger and the pricing engine
are reachable on the go and a transaction can be added from the phone. **Since 20 Aug 2026 this
repo also HOLDS the master**, so it is the source as well as the deploy surface.

Deployed as a Cloudflare Worker with static assets. **It is PUBLIC by the owner's decision of
11 Aug 2026, with no sign-in of any kind**, though the reads that carry the book are keyed (see
"Access, and why it is off" and "The write gate" below). New transactions push to a KV-backed
queue, are drafted into a proposed ledger row in the cloud, and reach the source only after the
row is approved on the phone.

## Hard rules

1. **The master is `master/salt_command.html`, in this repo. Never hand-edit
   `public/desk.html`.** It is the one place the desk is edited, and `public/desk.html` is a
   **build output** of it (`npm run build`), committed so the data lives in the repo. A
   hand-edit there is overwritten on the next build and lost. If a change to the desk is
   needed, edit the master, then build.

   **IT MOVED HERE ON 20 Aug 2026, from `Cow-Crm01\30_Published\`, and the reason is the whole
   point.** The daily commit needed the laptop, because the fold writes to the master and
   nothing in the cloud can write a file on that machine. Every other step was already
   cloud-reachable: the queue is in KV, the drafter runs on a Worker cron, approvals are in D1,
   the deploy is wrangler and the repo is on GitHub. Moving the one file that was not reachable
   puts the whole chain in the cloud and takes the laptop off the critical path. The old copy is
   retired beside `WHERE_THE_MASTER_WENT.md` in `30_Published`, renamed rather than deleted so
   the move is reversible and cannot be read as the master by accident.

   **From v337 the blocks between the `ENGINE` markers inside the master are GENERATED** from
   `engine/pricing.mjs` and, from v338, `engine/position.mjs`, by `node tools/engine.mjs --sync`,
   and CI fails if either differs. Edit the module, sync, build. The desk's `floorTotal`,
   `priceLadder`, `pxCost`, `recompute`, `txPaid` and the rest are one-line wrappers over them;
   `pxInputs()`, `pxPolicy()` and `posInputs()` are what the desk contributes.

   **From v339 THE BOOK IS `ledger/book.json`.** The twenty-six ledger declarations (sales,
   purchases, the opening, STATED_STOCK, COUNT_ON, the roster, the quotes, QUEUE_COMMITTED and
   the rest) are rendered into the master between the `BOOK` markers by
   `node tools/booksync.mjs --sync`, and CI fails if the block is not the file. **A fold edits
   `ledger/book.json`, never the rows in the master.** The prose that sat in comments beside the
   data is `NOTES` in the same file and comes back as comments. `evolution` and `LAST_UPDATED`
   stay in the master: they describe the version, not the book.

   **`master/changelog.json` moved with it**, because `tools/changelog.mjs` writes it on every
   version bump and a cloud fold has to be able to.

   **What did NOT move, and must never:** `10_Data\salt_bio.json` (the plaintext directory),
   `salt_vault.json`, `menu_secret.txt` and the queue files. They stay in the project folder.

   **`public/index.html` is the opposite: it is SOURCE.** Since v291 the root is the phone app,
   hand-written and owned by this repo, and the built desk moved to `public/desk.html` (served
   at `/desk`). Edit the app here freely. It reads every figure from `data.json` and computes
   nothing, and that is not a style preference: the moment it prices anything itself there are
   two engines and they drift, which is the fault v205 and v284 exist to prevent.
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

## NEVER RUN GIT AGAINST THIS REPO FROM A MOUNTED SANDBOX

A Cowork or agent session sees this repo through a mount that **permits writes but denies
unlink**. Git needs to delete its own lock files, so every invocation leaves them behind:
`.git/index.lock`, `.git/HEAD.lock`, `.git/objects/maintenance.lock` and a `tmp_obj_*` for
every object written. `git status` alone recreates `index.lock`.

The lock then blocks every later `git add` and `git commit`, including the ones
`salt_sync.ps1` runs on the way out, which report `commit did not take` and carry on. That
failure is silent: `git push` still exits 0 with nothing to push and logs `pushed off-site`,
so the log reads healthy while the ledger goes unversioned. It ran that way from 09 to 11 Aug.

**So: no `git add`, `commit`, `push`, `status` or `log` FROM A MOUNTED SANDBOX. Read files,
edit files, build, and leave git to a session running natively on Windows.** If a mounted
session must report repo state, read `.git/HEAD` and `public/rev.json` directly.

**A native Claude Code session on Windows is NOT a mounted sandbox, and it may run git.**
Narrowed 12 Aug 2026, because the old blanket wording forbade the auto-push the owner has
since asked for. Tested on 11 and 12 Aug: `status`, `log`, `diff`, `add -A`, a full
multi-line `commit` and `push` each left **zero** lock files. The hazard is the mount that
denies unlink, not the fact that an agent is driving. Two conditions come with the licence,
because the failure above is silent and an exit code will not show it:

- **Verify, never trust the exit code.** After committing, check
  `git rev-list --count origin/master..HEAD` and confirm no `*.lock` or `tmp_obj_*` remain.
  `node tools/update.mjs` does both at the end of every run.
- **Still no git from Cowork**, which is where the mount lives.

Clearing up after one that did, in PowerShell:

```
cd C:\Users\maakm\Claude\Code\salt-command
Get-ChildItem .git -Recurse -Include *.lock,tmp_obj_* -Force | Remove-Item -Force
git status
git push
```

## The surfaces, and how they stay coherent

| Surface | Path | Role |
|---|---|---|
| **Master** | `master/salt_command.html` | The only editable source. No cloud or PWA code in it. |
| **Built desk** | `public/desk.html`, served at `/desk` | Built from the master by `tools/build.mjs`. Never a source. |
| **Phone app** | `public/index.html` | Hand-written SOURCE. Reads `data.json`, computes nothing. |
| **Payload** | `public/data.json` | The master's own `phonePayload()`, run in jsdom by `tools/payload.mjs`. |

The build **only adds**: a PWA head, a service worker, a per-device id, and cloud-mode copy.
It changes no ledger figure. Every patch anchors on one unique line and the build aborts if an
anchor moves, so a master edit that would silently break a patch fails loudly instead.

**The claude.ai mirror is retired.** It was published from the master by Cowork
(`update_artifact`) into `Artifacts\salt-command\index.html`, and it went when the master moved
here on 20 Aug 2026, because Cowork is being retired for this project. `/desk` serves the same
desk and is the only mirror now.

## Retiring Cowork, and what runs the commit instead

**The decision of 20 Aug 2026: Salt leaves Cowork entirely.** The daily fold used to be a
Cowork scheduled task because the master lived on the laptop. With the master here, the whole
chain is cloud-reachable and the laptop is off the critical path.

| Step | Where | When |
|---|---|---|
| Queue an entry | KV, from the phone | on tap |
| Draft the row | Worker | on arrival, 15-min cron as the net |
| Approve | D1, from the phone | on tap |
| Stage the approved rows | Actions, `cloud-commit.yml` | hourly, cron `5 * * * *` (GitHub drifts it) |
| **Fold, bump, build, test, push** | **cloud routine, `docs/CLOUD_FOLD.md`** | every six hours: 08:52, 14:52, 20:52, 02:52 MYT |
| Deploy, prove, mark committed, **re-seed the D1 mirror** | Actions, `cloud-commit.yml` | on push |
| Prove repo and live agree | Actions, `ship-check.yml` | 11:00 MYT |
| Monthly statements | cloud routine, `docs/STATEMENTS.md` | Sundays, gated to the first |

**THE FOLD RUNS FOUR TIMES A DAY, BY HIS INSTRUCTION OF 20 AUG.** The routine `Salt daily fold`
(trig_01UrnjQMWA3f6GXN5R6Dzi4S) fires on `52 */6 * * *` UTC. The routine API rejects any cron under
an hour in any case. The stage runs hourly so a batch is always ready when the fold comes round,
and it is the stage, not the fold, that tells you whether anything is waiting: a run that prints
`approved and uncommitted: 0` means nothing was approved, which on 21 and 22 Aug meant the
drafter had refused everything against a stale mirror (see the re-seed step in `cloud-commit.yml`).
Corrected 22 Aug 2026; this paragraph used to say hourly.

**THE STAGE STANDS DOWN RATHER THAN TRAMPLING AN UNFOLDED BATCH,** and the clock is not what
makes that safe. The stage was first offset to clear the fold, and the routine API then jittered
the fold's minute of its own accord. A schedule whose safety depends on another scheduler
keeping the minute you asked for is not safe, so the guard lives in the job: if
`master/_to_fold.json` is still in HEAD, the last batch is unfolded and this tick stands down.

**The fold stays a judgement and therefore stays with an agent.** Folding an approved row is
mechanical, but rolling `STATED_STOCK`, writing the row's NOTE, writing the `evolution` entry
and deciding what an amendment amends are not, and the notes are most of what makes this book
worth auditing. A deterministic job that folded rows and dropped the prose would be a worse
ledger, so CI deliberately does not fold.

**What CI does instead is prove the mechanical facts afterwards, and it holds NO secrets.**
A workflow that can deploy is a workflow that can deploy by accident, and the deploy already
has an owner.

- `ci.yml`, on push: the book is in date order, the master's version is in the changelog, the
  tests pass, and `public/` is what this master builds. That last check compares the build
  **id**, never the bytes: `rev.json` carries `built` and `data.json` carries `generated`, so
  two builds of an identical master differ a second apart. Same lesson the deploy side learned
  on 10 Aug.
- `ship-check.yml`, daily at 11:00 MYT: the id in `public/rev.json` against the id the live
  Worker serves at `/rev`. This is the check that was missing when a build was committed and
  never deployed on 10 Aug, and when the master shipped but the cloud did not on 19 Aug. Both
  failures were silent and every exit code was zero.

**Still on the laptop, and not Cowork's:** `secretary-desk` sweeps `Core\`, which has not
moved, so it cannot go to the cloud yet. `serve_desk.py` and `salt_sync.ps1` still exist for
local work; `npm run dev` does the preview half better.

## The queue loop (how a phone entry reaches the ledger)

```
phone: add transaction ──POST /queue──▶ Worker ──▶ KV  (key q:<deviceId>, this device's queue)
                                                    │
   drafter (on arrival, + a cron net) ◀───────────┘   writes a proposed ROW into D1 `draft`
        │
        ▼   phone: Approve tab, a tap            ** THIS STEP IS NOT OPTIONAL, v305 **
        │
   the cloud fold (tools/fold.mjs --apply, docs/CLOUD_FOLD.md) writes the approved rows into
   ledger/book.json with their notes, rolls the shelf, sets QUEUE_COMMITTED, bumps the version
        │
        ├─ node tools/drafts.mjs --committed <id>...            (mark them folded)
        ├─ npm run build                                        (refresh public/desk.html)
        └─ npm run deploy   +   git commit/push                 (phone gets the new ledger)

   The laptop's own queue joins the same road:  node tools/drafts.mjs --from-queue
```

The desk needed almost no change because it already speaks this HTTP contract to
`serve_desk.py` on the laptop. The Worker is that server, in the cloud, backed by KV instead
of disk. `/queue/ping` returns `cloud:true`, which tells the built desk to keep names
device-local and skip the laptop-only 3-second heartbeat.

Offline on the phone: an entry is held in `localStorage` and the desk says so; it pushes on the
next open with a connection (the built desk auto-pushes any held queue when the ping succeeds),
and from v279 the ten-second tick retries a held entry rather than waiting for that next open.

## The approval step (v302), and what is actually approved

**A queued entry no longer becomes a ledger row unattended.** Something drafts the proposed
ROW, it is stored pending, the phone shows it, and a tap approves or rejects. Only approved
rows are offered to the commit run.

```
phone: add transaction ──POST /queue──▶ KV
                                         │
   drafter (the v303 cloud cron, every 15 min) reads the entry and WRITES A ROW
                                         │  POST /drafts   (write-gated)
                                         ▼
                              D1 `draft`, status pending
                                         │
   phone: Approve tab ──POST /drafts/<id>/approve──▶ status approved
                                         │
   commit run: node tools/drafts.mjs --approved   → folds them into the master
               node tools/drafts.mjs --committed <id>...
```

**What is approved is the ROW, not the entry, and that distinction is the whole point.** On
14 Aug an oil unit was queued at RM115. As an entry it was faultless: a product, a party, a
quantity, a price, nothing in it that could be checked against anything. As a row, sitting
next to RM7 of cost and a 93.9% margin, it was obviously wrong; the real figure was RM11.50
and the book carried RM103.50 of revenue that never existed until it was corrected. An
approval screen showing the entry back would have caught nothing, so the phone leads with
cost and margin and puts the price beside them.

**The app computes neither.** Cost, margin and flags are read from the draft exactly as the
drafter wrote them, for the same reason `data.json` exists: a second opinion computed on the
phone would be a second pricing engine, and two engines drift.

**Reads open, decisions write-gated**, matching the rest of the Worker. An approval reaches
the master, so it is a write in the fullest sense. A row already decided cannot be decided
again (409), because a double tap on a phone is the normal case, not the odd one.

Endpoints: `GET /drafts?status=pending|approved|rejected|all[&uncommitted=1]`,
`POST /drafts`, `POST /drafts/<id>/approve|reject|committed`. Schema in
`migrations/0002_draft.sql`, which explains at length why `row` and `reasoning` are NOT NULL.

**`draft` is the first table in the store the cloud OWNS.** `entry` and `state` mirror the
master and it stays authoritative for them; a draft has no counterpart there. Writing here
therefore does not flip the direction `0001` reserves, and nothing in this path may write to
`entry`.

## The cloud drafter (v303)

**The laptop is out of the loop for drafting.** `src/drafter.js` reads the queue from KV, reads
the book from the D1 mirror, writes the proposed row into `draft`, and stops. It runs in TWO
places and the first is the one that matters:

1. **On arrival**, from `POST /queue`, via `waitUntil`. The row is written within a second of
   the entry landing.
2. **On a cron** (`*/15 * * * *`, declared in `wrangler.jsonc`), as the safety net for anything
   posted while D1 was unreachable.

**The cron alone LOSES A RACE and this was found by running it, not by reasoning.**
`serve_desk.py` drains the cloud queue to disk every 60 seconds while the laptop is on, and
`drain.mjs` is a DESTRUCTIVE read: it unions KV into `salt_queue_cloud.json` and clears the
keys. An entry posted at 14:41 on 16 Aug was on disk and gone from KV by 14:52, with nothing
left for the cron to draft. Drafting on arrival closes it.

**CLOSED AT v305: THE APPROVAL STEP IS NOW THE ONLY ROAD IN.** Two went round it and both are
shut. `serve_desk.py`&#39;s timed drain is REMOVED (it fed a file the daily run folded, so a phone
entry reached the ledger unread), and the laptop&#39;s own queue now goes through
`node tools/drafts.mjs --from-queue`, which drafts it PENDING using the same `draftRow` rather
than a second copy. The `salt-daily-price-brief` SKILL is rewritten to fold `--approved` rows
only and mark each id committed after.

**THE SKILL EDIT IS ON DISK BUT NOT PUSHED.** Editing `SKILL.md` changes the file, not what
fires: the stored prompt needs `update_scheduled_task` from Cowork. Until that is done the
running task still holds the old fold-every-queue-file instruction.

**WHAT THE GATE ACTUALLY COVERS, stated narrowly because the first wording overclaimed.** It
governs NEW ROWS from queued transactions, the ones typed in a hurry at the point of sale.
It does NOT cover:

- **Amendments.** The drafter refuses them (which row does it amend?), so they are never drafted
  and never approved. `--from-queue` prints a `skip` line for each, and the daily run reads them
  from the queue file and folds them against the row they amend, exactly as before. Found by
  running it: two of the three entries queued on 17 Aug were amendments.
- **Entries carrying associate, stream or link fields**, a movement with no date, or a product
  with no cost on the book. Same road: refused, listed, left for a person.
- **Editing the master by hand.** That is the desk itself and needs no tap.

**REFUSED ENTRIES ARE VISIBLE ON THE PHONE (v309), which is not the same as approvable.**
Everything the drafter declines is recorded in the `refused` table and shown in its own panel
under the Approve tab, with the reason and which drafter saw it. It has **no decision column**,
the panel renders **no buttons**, and the tab badge counts only drafts, so nothing there can be
approved even by accident. It self-cleans: the drafter deletes anything the watermark has
passed. It exists because on 17 Aug the same CC5-OKR fulfilment was queued from the laptop and
then from the phone, byte for byte, since nothing on the phone said it was already in hand.
Only the watermark stopped the double count.

Run the drafter by hand with a write key:

```bash
curl -X POST -H "X-Salt-Key: <key>" "https://salt-command.maakmal97.workers.dev/draft-now?dry=1"
```

`?dry=1` reports what it would draft and stores nothing, which is how to prove it against the
real book without putting a row in front of anyone.

**It is arithmetic, not a language model, and that is a decision rather than a limit.**
Everything an approval screen is read for is a number. A model on that path would put
nondeterminism on precisely the figures that must be right. What a model could usefully write
is the row NOTE, which is prose and which nobody approves; that is deliberately off this path.

**It never prices anything itself.** `tools/book.mjs` `pricingSnapshot()` runs the desk's own
`floorTotal`, `replCost` and `stockCostFor` during the extract and stores the answers as the
`PRICING` state key. The drafter reads those. This is the same rule as `data.json` and it is
the reason both exist: two engines drift. `PRICING` is **derived, not declared**, which is why
it is not in `LEDGER_KEYS`; nothing in the master is named `PRICING`.

**What it refuses to draft** matters as much as what it drafts: an amendment (which row?), an
entry carrying associate, stream or link fields (whose bucket?), a movement with no date, a
product with no cost on the book. Each is recorded with a reason and left for a person.

**The flags are the product.** They are the comparisons an entry cannot make against itself:
the rate against the product's whole observed range (this catches the RM115 oil unit), against
that party's own median, against the live floor delivered and collected, below cost, a blended
shelf, an unknown party, an advance, and a stale pricing snapshot.

Three faults in them were found by pointing it at the real book, all the same shape: a
purchase was being measured with a seller's ruler (floor, below-cost, buying history), and a
party's own pending row was counted as evidence of what they pay. **A flag that fires when
nothing is wrong is worse than no flag**, because it teaches the reader to tap through.

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
| `public/index.html` | **The phone app (v291). SOURCE, hand-written, edit it here.** 28 KB. Reads `data.json`, computes nothing, writes queue entries. Liquid Glass, Ledger tuning. |
| `public/desk.html` | The built desk, served at `/desk`. **Derived from the master, do not hand-edit.** Committed on purpose. |
| `public/data.json` | The phone payload: position, actions, party lists, the queue watermark and the build id. Written by the build via `payload.mjs`, which runs the master in jsdom. |
| `public/sw.js` | Service worker. Shell network-first; the `/queue` API is never cached. |
| `public/manifest.webmanifest`, `public/icon-*.png` | Home-screen install. Icons from `tools/make_icons.py`. |
| `public/_headers` | CSP and security headers, applied by Cloudflare to the assets. |
| `wrangler.jsonc` | Worker + assets + the `SALT_QUEUE` KV binding. |
| `tools/build.mjs` | Master → `public/index.html`, with fail-loud patch anchors. Also writes `public/rev.json`. |
| `public/rev.json` | `{v,id,built}` for the build on disk. `id` hashes the master, `public/index.html`, `public/sw.js` AND every `src/*.js`, NUL-separated. **Written by the build, never by hand.** Anything that ships and changes behaviour must be in that hash: a change outside it does not move the id, so `update.mjs` compares equal, skips the deploy and reports the phone current while the old file is still served. That is exactly what happened to the v302 sw.js fix before sw.js was added. It is still true of `wrangler.jsonc`, which must be deployed by hand. |
| `.deployed.json` | `{id,v,at}` for the build that last DEPLOYED successfully. Written by `salt_sync.ps1` on a reported success and nowhere else. |
| `tools/drain.mjs` | KV → `06_Data\salt_queue_cloud.json`; `--committed <ISO>` prunes; `--status` inspects. |
| `src/drafter.js` | The cloud drafter: queue + mirror -> a proposed row in `draft`. Runs on the cron and at `POST /draft-now`. Never writes to `entry`. |
| `tools/drafts.mjs` | The approval step from the laptop: `--schema`, `--list`, `--draft <file>`, `--approved`, `--committed <id>`. Goes through wrangler, so no write key needed. |
| `migrations/0002_draft.sql` | The `draft` table. The first thing in the store the cloud owns rather than mirrors. |
| `migrations/0003_refused.sql` | The `refused` table: entries the drafter declined, kept so they can be SEEN. No decision column, by design. |
| `master/salt_command.html` | **THE MASTER.** The only editable source. Moved here 20 Aug 2026 so the fold can run in the cloud. |
| `master/changelog.json` | Every `evolution` entry ever written. `tools/changelog.mjs` keeps it in step with the master's one-entry array. |
| `tools/fold.mjs` | **THE FOLD** (v340, move 3): `--plan` reads `master/_to_fold.json` against the book, says what each row would do, refuses what it must and writes the notes skeleton; `--apply` folds the batch with the agent's notes into `ledger/book.json`, syncs the master, sets the version and the changelog, rolls the shelf, moves the watermark, writes `_folded.json`. All or nothing. |
| `tools/sort-ledger.mjs` | Puts `sales` and `purchases` back in date order, undated pending rows last. Asserts its output is a permutation of its input. |
| `ledger/book.json` | **THE BOOK** (v339, move 2): the twenty-six ledger keys as data, plus `NOTES`. Edited by the fold; rendered into the master by `tools/booksync.mjs --sync`; CI proves the copy. |
| `tools/booksync.mjs` | `--sync` renders the book into the master between its markers; `--check` fails if the block is not the file; `--normalise` rewrites the JSON one record per line. |
| `engine/pricing.mjs` | **THE PRICING ENGINE** (v337, move 1 of the rebuild): the cost stack, the taper, the ladder, the floors and the board as pure functions of explicit inputs. The desk, the payload build and the drafter all price from it. Inlined into the master by `tools/engine.mjs --sync`; CI proves the copy is the file. |
| `engine/position.mjs` | **THE POSITION ENGINE** (v338): the transaction model (what a row has paid, delivered, deferred, pending; its state and dates; what a lot received and paid; the ageing ladder), the ledger walk that was `recompute()`, cover, the commitments and the phone's row shape. Same rules as the pricing engine. |
| `tools/engine.mjs` | `--sync` writes `engine/*.mjs` into the master between its markers; `--check` fails if the block is not the module. |
| `tools/changelog.mjs` | Prepends the master's current `evolution[0]` to `master/changelog.json`. Never rewrites an entry that exists. |
| `.github/workflows/` | CI with no secrets: date order, changelog, tests, build-matches-master, and a daily check that the live Worker serves what the repo committed. |
| `tools/update.mjs` | **The whole "update" chain in one command**, ending in proof that every surface is level. See below. |
| `tools/make_icons.py` | Regenerate the crystal icons. |
| `test/verify.mjs` | Smoke suite: Worker contract, name-drop, access gate, drain helpers, build integrity. |

## Working on it

```
npm install                 # once, for wrangler
npm run build               # master -> public/index.html (run after any master edit)
npm run dev                 # build, then wrangler dev on a local port
npm test                    # the smoke suite, ~2s, no network
```

## "Update" is one command

```bash
node tools/update.mjs
```

Drain the phone queue, report what is still pending on **both** queues, build, test, deploy
only when the built id differs from the deployed one, commit, push, and then **prove** the
master, `rev.json`, the live `/rev` and origin all agree. It exits non-zero if any of that
fails, which is the point: two runs in a row had shipped the master but not the cloud, and
both failures were silent.

`--dry` reports and changes nothing. `--no-push`, `--no-deploy`, `--no-drain` skip a leg.
`-m "..."` sets the commit message.

**It will not fold a queued entry into the ledger, by design.** Writing a transaction row is
a judgement (which product, whose bucket, what cost, what the note says) and a script that
guessed would be worse than one that refuses. Step 3 reports what is pending and leaves it
for the daily run.

**The replay check** is the guard for the v287 fault. For every entry still above
`QUEUE_COMMITTED` it looks for a ledger row with the same date and total, and refuses to ship
if it finds one, because that means the entry was committed and the watermark was not moved,
which puts a double count on the phone. A date and a total can collide innocently, so
`--force-ship` overrides once you have read the rows.

## Deploying

```
npm run deploy              # builds, then npx wrangler deploy
```

First-time Cloudflare setup, in order:

1. **KV namespace.** `npx wrangler kv namespace create salt_queue`, then paste the printed id
   into `wrangler.jsonc` in place of `PLACEHOLDER_KV_ID`.
2. **Deploy.** `npm run deploy`. Note the `*.workers.dev` URL it prints.
3. **Access, and why it is off.** See the section below. There is no step 3 to perform for
   the current posture; the site is deliberately open.

## Access, and why it is off

**DO NOT "FIX" `REQUIRE_ACCESS` BACK TO `"1"`.** Finding it at `"0"` is not the 10-11 Aug
accident recurring. It is the owner's explicit instruction of 11 Aug 2026, "I want no zero
trust requirements right now", and the Access application was removed to match. Re-enabling
the var without also recreating the Access application locks the owner out completely: the
Worker would refuse every request for want of a `Cf-Access-Jwt-Assertion` header that nothing
is issuing any more, and the locked page would tell him to re-enable an application that does
not exist.

**What that means, stated plainly.** Anyone with the URL reads the whole ledger. `GET /queue`
likewise returns every device's queue to any caller. **The exposure is READ ONLY, as at 16 Aug
2026.** It used to be write as well, because `POST /queue` accepted an unauthenticated body
that `tools/drain.mjs` unions into `salt_queue_cloud.json` and the daily run folds into the
master as real rows with no review step between. The write gate below is armed, so that half
is closed; an unkeyed `POST /queue` is refused 401 `write key required`.

**Real names are still not exposed**, but not because nothing is synced. The KV vault is
populated: `GET /vault` returns a real AES-GCM envelope `{v,salt,iv,ct}`, verified 16 Aug 2026.
It is ciphertext and nothing else. The passphrase never leaves the browser, so a stranger with
the URL gets an undecryptable blob, and the built desk ships codes only in any case.

## The write gate (v288), and it is ARMED

**IT IS LIVE AS AT 16 AUG 2026. The arming step is done, not pending.** The
`SALT_WRITE_KEY` secret exists (`npx wrangler secret list` returns it, type `secret_text`), so
`POST /queue` and `POST /vault` require `X-Salt-Key` matching it. Verified against the live
Worker on 16 Aug 2026: an unkeyed POST returns 401 `{"ok":false,"error":"write key
required","writeKey":true}`. Nothing below needs doing to turn it on.

**Reads stay open. Writes need the key.** That closes the half of the old exposure that was
easy to miss: a stranger with the URL writing rows into the ledger. It is not Zero Trust, it
is not protection from anyone holding the key, and it does not touch reads.

**Why the secret came second, kept as history.** The gate is dormant while `SALT_WRITE_KEY` is
unset, and that was deliberate. The desk that can send the header had to be live on the phone
BEFORE the gate demanded it, or the owner locks himself out of his own queue exactly as the
policy-less Access application did on 11 Aug. v288 shipped the desk half first, then the secret
was set. The ordering matters again only if the secret is ever cleared and reinstated.

**To change the key** (not to enable it, which is already done):

```bash
npx wrangler secret put SALT_WRITE_KEY
```

Paste a passphrase you can type on a phone, then clear `saltWriteKey` from the phone's storage
so it asks again. The phone asks once on the next entry and keeps the key in `localStorage`; a
wrong key is refused, asked again, and retried once. `drain.mjs` and `seed-vault.mjs` go
through wrangler rather than HTTP, so neither is affected.

**Withdrawing a queued entry**, still worth running before each commit:

```
node tools/drain.mjs --status          # list every pending entry, read-only
node tools/drain.mjs --forget <at>     # withdraw one entry, from the file and from KV
```

**To restore protection** (both halves, in this order, or you lock yourself out):

1. Recreate the Access application FIRST. Zero Trust → Access controls → Applications → Add an
   application → Self-hosted. Destination: **Workers**, scope `salt-command`, Type "a Worker's
   production and preview URLs" (the preview URLs are the bypass a hostname-only rule misses).
   Attach a policy: Action **Allow**, Include → **Emails** → `maakmal97@icloud.com` and
   `maakmal1997@gmail.com`. **The application MUST have a policy attached.** Access is
   default-deny and account ownership grants nothing; an application saved with no policy
   denies everyone including the owner, which is exactly what happened on 11 Aug.
2. Then set `REQUIRE_ACCESS` to `"1"` and `npm run deploy`.

Note that a var-only edit does not change `public/rev.json`'s id, and `salt_sync.ps1` decides
whether to deploy by comparing that id against `.deployed.json`. So a `wrangler.jsonc`-only
change is NEVER shipped by the auto-sync leg. It must be deployed by hand.

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

`npm test` runs `test/verify.mjs`: 250 assertions with no network or browser. Add one for every
behavioural change to the Worker, the build patches or the drain. The desk's own rendering is
covered by the daily run's jsdom pass against the master, not here.
