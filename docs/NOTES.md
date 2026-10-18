# Salt Command: the reasoning behind the rules

The former body of `CLAUDE.md`, moved here verbatim on 6 Sep 2026 when that file was cut to a fact sheet. Every version number, decision and its date is kept, including passages the sheet marks as superseded (the phone app and the timed drain). Nothing here has been edited since; correct facts in `CLAUDE.md`, not here.

The Salt Command desk, ported to a real cloud app so the ledger and the pricing engine
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

   **IT MOVED HERE ON 20 Aug 2026, from `Per-Crm01\30_Published\`, and the reason is the whole
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

   **THE PHONE APP IS RETIRED (v387) AND SO IS `public/data.json`.** This file described both as
   live for twenty-five versions after they were deleted, which round eight found and which is
   why it is corrected here rather than trimmed: a rules file that names a file nobody can open
   teaches an agent to look for it. There is ONE surface now, the built desk at
   `public/desk.html`, served at `/desk` and read on the phone at the same URL. The reason the
   app existed still stands and still governs the desk: nothing outside the master may price
   anything, because the moment a second surface prices it there are two engines and they
   drift, which is the fault v205 and v284 exist to prevent.
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
5. **RM and unit only**; the desk retired the mass symbol at v161.
6. **The desk's look is the Salt design system, applied as a layer (v472, 02 Sep 2026).** Material,
   type and colour are decided in `design/desk.css` over the vendored `design/salt-ds.css`, both
   rendered into the master between `DESIGN` markers by `tools/designsync.mjs` and proved by CI.
   One accent (brass; copper for the exception), three semantic words (verdigris owed to you or
   settled, ember owed by you or breached, steel pending), figures in mono, sentences in the
   display face, glass once. **A colour or type change is an edit to `design/desk.css`, then
   `--sync`, then build; never a hex in the master's older layers.** From v474 to v476 the older
   material layers are retired: the page-level colour system, the v108 frost, the v213 material and
   the v281 colour rules are gone, each fold proved the same on every shot by `tools/renderdiff.mjs`.
   What the base layer still declares inside component rules (a tag's fill, a tier's glow) is
   overridden by the layer and listed for a later fold, not taken. v477 is the legibility pass:
   sizes and tracking live in the layer alone. The two books' hues are
   `PRODUCTS.accent` in `ledger/book.json`, because that block is generated. Chart series read
   the identity's hexes directly (`salt-ds/src/tokens.ts` is the shadow of the stylesheet), so a
   palette change is a change in both places. No web font: the CSP is self-only, so Georgia and
   Consolas answer for Fraunces and JetBrains Mono.

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
| ~~Phone app~~ | ~~`public/index.html`~~ | **Retired at v387**, with `public/data.json`. The desk is the only surface. |

The build **only adds**: a PWA head, a service worker, a per-device id, and cloud-mode copy.
It changes no ledger figure. Every patch anchors on one unique line and the build aborts if an
anchor moves, so a master edit that would silently break a patch fails loudly instead.

### What each surface carries (v343, 23 Aug 2026)

**The desk is seven views over sixteen tabs, and every tab is one tap away.** `VIEWS` in the
master: Today (Today, Overview, Forward), Orders and money (Order book, Financials), Stock
(Inventory, Sourcing), Price, Customers (Customers, Network, Map), The book (Ledger, Analysis),
Enter (Transaction, Approve, Whiteboard). A view opens on its lead and names its other parts on
a **strip of pills at the top**; on a wide screen the rail also lists the active view's parts
beneath it. One part shows at a time. The old tab ids are still addresses: `/desk#network` opens
Customers on the Network. v341 had folded the parts at the FOOT of the lead, which on a 7,000px
lead is the same as losing them, and the Network was reported missing; v343 is the correction.

**The cloud desk can register a party and approve a row.** Names & IDs mints a code from a name
and a place on the laptop only, so `/desk` had no Add ID at all while its own form said to use
it. The Enter view now carries **Add ID** (a code typed by hand, queued as `addid`, drafted into
the roster, approved, folded; the name is typed into the directory at the laptop, later) and
**Approve** (the same `/drafts` endpoints and decisions as the phone). Both are cloud-mode only;
the laptop desk keeps Names & IDs and has no drafts table.

**The phone has six tabs.** Today (the count when due, what needs doing, the position, **the next
thirty days** per product off the desk's own forecast, alerts), Book (who owes what, with the age
of each debt and what the ladder expects; the ledger folded, and **from v362 a tap on any row
opens the editor**), **People** (who is due on his own
habit, every customer with the desk's tier and a statement on tap, the network, the customer
rewards, the demand turned away, the map's heat), Price, Record (Trade, Amend, Stock, **Add ID**),
Approve. It reads `people` and `forward` from `data.json` and computes nothing; the leak test
reads those sections as it reads the rest. **What stays off the phone by policy:** cost, margin,
profit, the P&L, sourcing and the reseller menu. Note that `/desk` serves every one of those at
the same public URL, so the rule protects nothing while `/desk` is open; lifting it was one line
in the leak gate, `phonePayloadLeaks()`, which went with the app and was deleted from the master
as dead code on 26 Sep 2026.

**The claude.ai mirror is retired.** It was published from the master by Cowork
(`update_artifact`) into `Artifacts\salt-command\index.html`, and it went when the master moved
here on 20 Aug 2026. `/desk` serves the same
desk and is the only mirror now.

## What runs the commit

With the master here, the whole
chain is cloud-reachable and the laptop is off the critical path.

| Step | Where | When |
|---|---|---|
| Queue an entry | KV, from the phone | on tap |
| Draft the row | Worker | on arrival, 15-min cron as the net |
| Approve | D1, from the phone | on tap |
| Stage the approved rows | Actions, `cloud-commit.yml` | **on every approval** (the Worker dispatches it), and every two hours as the net |
| **Fold, bump, build, test, push** | **the `fold` job in `cloud-commit.yml`: the Claude Code action, following `docs/CLOUD_FOLD.md`**; or an agent asked to | **in the same run, whenever the stage staged rows**; or on demand |
| Deploy, prove, mark committed, **re-seed the D1 mirror** | Actions, `cloud-commit.yml` | on push |
| Prove repo and live agree | Actions, `ship-check.yml` | 11:00 MYT |
| Monthly statements | cloud routine, `docs/STATEMENTS.md` | the 1st, gated in Kuala Lumpur time |

**THE FOLD STOPPED RUNNING ON A CLOCK, ON HIS INSTRUCTION OF 24 AUG 2026.** From 20 to 24 Aug
the routine `Salt daily fold` (trig_01UrnjQMWA3f6GXN5R6Dzi4S) fired on `52 */6 * * *` UTC,
four times a day. It is now DISABLED, not deleted (the routine API has no delete, only
enable/disable), because on 24 Aug it and a session working the same staged batch by hand
folded it independently within minutes of each other: no git conflict, since the session's
commit was still local when the routine's landed, but two different versions briefly existed
for the same rows before the session reconciled them. **The actual reason to retire it is
simpler than the collision that exposed it:** a fold reachable on request lands inside a
minute of being asked for, which is faster than the six-hourly slot ever was, so the clock was
adding a race without adding speed. **Folding is on demand now: ask an agent, in a Code session
or otherwise, to read `docs/CLOUD_FOLD.md` and follow it.** The stage still runs hourly and
still matters: it is what keeps `master/_to_fold.json` current so a fold, whenever asked for,
does not have to reach D1 itself first, and it is still the thing that tells you whether
anything is waiting (`approved and uncommitted: 0` means nothing was approved, which on 21 and
22 Aug meant the drafter had refused everything against a stale mirror; see the re-seed step in
`cloud-commit.yml`). To re-arm the routine: `RemoteTrigger` (or the `schedule` skill) with
`action: "update"`, `{"enabled": true}`, on trig_01UrnjQMWA3f6GXN5R6Dzi4S.

**AN APPROVAL NOW RUNS THE WHOLE CHAIN (his instruction, 03 Sep 2026: approve, stage, fold,
commit, push and deploy together, or within minutes).** The clock is not back; the trigger is
the tap. `POST /drafts/<id>/approve` dispatches `cloud-commit.yml` with `stage_only` (the
Worker holds a fine-grained GitHub token, `SALT_GITHUB_TOKEN`, scoped to this repo's Actions
and nothing else; unset, the tap changes nothing and the hourly stage remains). The run is
three jobs in a row: **stage** writes `master/_to_fold.json` to master as before; **fold**, new,
checks out master's tip and runs the Claude Code action on the subscription token
(`CLAUDE_CODE_OAUTH_TOKEN`, a repo secret) with the fold routine's prompt, so the judgement
still sits with an agent following `docs/CLOUD_FOLD.md`, and it commits and pushes as the
Claude GitHub App; that push starts the **deploy** run as any push does, which deploys, marks
the rows committed and clears the handoff. Proved end to end on v480, 03 Sep 2026. The routine
`Salt fold (manual backup)` (trig_01UrnjQMWA3f6GXN5R6Dzi4S) is DISABLED with no cron and is
what to fire by hand if the fold job fails; a fold from a Code session still works too. The
hourly stage folds as well, in the same way, so nothing approved waits longer than an hour
even if the Worker's dispatch is lost. Why inside the workflow and not a routine webhook: the
routine API fires on pull request and release events only, never a push, and the chain is
one run in one place this way, serialised by the concurrency group it already had. Since 26 Sep
2026 that group is job `chain`'s alone, and the post-live suite runs as job `suite` outside it, on
the sha chain proved: inside the locked run it held the lock for its two to five minutes, and 20
of the 22 folding runs that queued from 19 to 24 Sep were waiting behind a suite.

**THE STAGE STANDS DOWN RATHER THAN TRAMPLING AN UNFOLDED BATCH,** and the clock is not what
makes that safe. The stage was first offset to clear the fold, and the routine API then jittered
the fold's minute of its own accord. A schedule whose safety depends on another scheduler
keeping the minute you asked for is not safe, so the guard lives in the job: if
`master/_to_fold.json` is still in HEAD, the last batch is unfolded and this tick stands down.

**A VERSION ASKS ABOUT THE QUEUE FIRST (his instruction, 02 Sep 2026).** Before any version
bump, a design or retirement fold included, check what is waiting: `node tools/drain.mjs --status`
(the phone queue above the watermark), `node tools/drafts.mjs --list` and `--approved` (pending, and
approved but uncommitted), and `git fetch` for a staged `master/_to_fold.json`. Ask him, one line per
item, whether he wants to approve anything pending; never approve for him. Rows already approved,
or approved on his answer, are folded into that version, so a version never ships with an approved
row left behind.

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

**Still on the laptop:** `secretary-desk` sweeps `Core\`, which has not
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
   A row edit joins it too:  right-click a ledger row on /desk (v361) or TAP one on the
   phone's Book tab (v362), edit ANY of the thirty attributes a person states (v363),
   and it queues as a Correction that is drafted, flagged and approved exactly like a
   transaction. The phone edits twenty-eight of them: the COST and the row NOTE are desk-only,
   because both quote lot costs and the payload keeps those off a public app, so the phone
   will not offer to replace a value it is not allowed to show you.
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
than a second copy.

**WHAT THE GATE ACTUALLY COVERS, stated narrowly because the first wording overclaimed.** It
governs NEW ROWS from queued transactions, the ones typed in a hurry at the point of sale.
It does NOT cover:

- **Linked and Rewarded amendments.** Neither carries a figure the drafter can check, only a
  judgement about which OTHER row or which award applies, so both are refused, listed and left
  for a person. Fulfilment and Cancellation have gone through the gate since v322, Modification
  since v358, and **Correction since v361**.
- **Entries carrying `linkTo` or `orderCode`**, a movement with no date, or a product with no
  cost on the book. Same road: refused, listed, left for a person. **Associate, stream and
  downstream stopped being on this list at v361**: each is a code the book either knows or does
  not, so each is checked rather than refused, and a downsell can be entered from the phone.
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
curl -X POST -H "X-Salt-Key: <key>" "https://salt-command.qyts8mh72kyg.workers.dev/draft-now?dry=1"
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

**What it refuses to draft** matters as much as what it drafts: a Linked or Rewarded amendment
(which other row? which award?), an entry carrying `linkTo` or `orderCode`, a movement with no
date, a product with no cost on the book. Each is recorded with a reason and left for a person.

**The flags are the product.** They are the comparisons an entry cannot make against itself:
the rate against the product's whole observed range (this catches the RM115 oil unit), against
that party's own median, against the live floor delivered and collected, below cost, a blended
shelf, an unknown party, an advance, and a stale pricing snapshot.

Three faults in them were found by pointing it at the real book, all the same shape: a
purchase was being measured with a seller's ruler (floor, below-cost, buying history), and a
party's own pending row was counted as evidence of what they pay. **A flag that fires when
nothing is wrong is worse than no flag**, because it teaches the reader to tap through.

## Continuous sync (v279)

The ledger is baked into `public/desk.html` at build time, so a phone is only ever as current
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

**A NAME AND ID IS COMMITTED EVERY TIME, LIKE AN APPROVED ROW (his instruction, 05 Sep 2026).**
A code that reaches the roster with no name behind it is half a record, and the half that is
missing is the half only he can supply. So when a new code appears through Add ID, or a fold
finds a roster code the directory does not carry, ask him for the **name and the location**
before the ID commits, and then, in this order: write both to `10_Data\salt_bio.json` on the
laptop (rule 2: plaintext never reaches the cloud, and this file never leaves the project
folder), seed the vault so the phone can show the name after a password, and commit the
statement username in `statements/_users.json`, which is an address and not a secret. The
username is minted once and kept for life, so a username on the laptop alone is one
regeneration from being minted twice: CF5-WM's sat uncommitted for three days after the
October run minted it, and that is the case this rule was written on. The three `-R` reseller
sub-accounts are aliases of named parties and are the one exception.

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
Per-Crm01 master (a Cowork/master session); once it lands, the sync above already feeds it.

## Files

| Path | What it is |
|---|---|
| `src/worker.js` | The Worker. Cloud stand-in for `serve_desk.py`: `/queue`, `/vault` (ciphertext), `/bio` (dropped), static assets. KV-backed. From 03 Sep 2026 an approval also dispatches the stage (`stageOnApproval`, needs the `SALT_GITHUB_TOKEN` secret). |
| `tools/seed-vault.mjs` | Encrypt the current names with your passphrase and push the ciphertext to KV. Never writes plaintext anywhere. |
| ~~`public/index.html`~~ | **Retired at v387** along with `public/data.json`. Neither file exists; do not go looking. |
| `public/desk.html` | The built desk, served at `/desk`. **Derived from the master, do not hand-edit.** Committed on purpose. |
| `public/data.json` | The phone payload: position, actions, party lists, the queue watermark and the build id. Written by the build via `payload.mjs`, which runs the master in jsdom. |
| `public/sw.js` | Service worker. Shell network-first; the `/queue` API is never cached. |
| `public/manifest.webmanifest`, `public/icon-*.png` | Home-screen install. Icons from `tools/make_icons.py`. |
| `public/_headers` | CSP and security headers, applied by Cloudflare to the assets. |
| `wrangler.jsonc` | Worker + assets + the `SALT_QUEUE` KV binding. |
| `tools/build.mjs` | Master → `public/desk.html`, with fail-loud patch anchors. Also writes `public/rev.json`. |
| `public/rev.json` | `{v,id,built}` for the build on disk. `id` is `sha256` over the PATCHED MASTER (the bytes that become `public/desk.html`, with the id token still in place), then a literal NUL, `sw`, a NUL and `public/sw.js`, then a NUL, `worker`, a NUL and every `src/*.js` sorted and NUL-joined. **The separators are real NUL bytes**, written as the `\0` escape in build.mjs and the suite since 26 Sep 2026: as raw bytes they printed invisibly, which cost a session before and led a review to read them as spaces. It does NOT hash the master separately, and round eight recorded that it omits `public/_headers`, `manifest.webmanifest` and the vendored `chart.umd.js`. **Written by the build, never by hand.** Anything that ships and changes behaviour must be in that hash: a change outside it does not move the id, so `update.mjs` compares equal, skips the deploy and reports the phone current while the old file is still served. That is exactly what happened to the v302 sw.js fix before sw.js was added. It is still true of `wrangler.jsonc`, which must be deployed by hand. |
| `.deployed.json` | `{id,v,at}` for the build that last DEPLOYED successfully. Written by `salt_sync.ps1` on a reported success and nowhere else. |
| `tools/drain.mjs` | KV → `06_Data\salt_queue_cloud.json`; `--committed <ISO>` prunes; `--status` inspects. |
| `src/drafter.js` | The cloud drafter: queue + mirror -> a proposed row in `draft`. Runs on the cron and at `POST /draft-now`. Never writes to `entry`. |
| `tools/drafts.mjs` | The approval step from the laptop: `--schema`, `--list`, `--draft <file>`, `--approved`, `--committed <id>`. Goes through wrangler, so no write key needed. |
| `migrations/0002_draft.sql` | The `draft` table. The first thing in the store the cloud owns rather than mirrors. |
| `migrations/0003_refused.sql` | The `refused` table: entries the drafter declined, kept so they can be SEEN. No decision column, by design. |
| `master/salt_command.html` | **THE MASTER.** The only editable source. Moved here 20 Aug 2026 so the fold can run in the cloud. |
| `master/changelog.json` | Every `evolution` entry ever written. `tools/changelog.mjs` keeps it in step with the master's one-entry array. |
| `tools/fold.mjs` | **THE FOLD** (v340, move 3): `--plan` reads `master/_to_fold.json` against the book, says what each row would do, refuses what it must and writes the notes skeleton; `--apply` folds the batch with the agent's notes into `ledger/book.json`, syncs the master, sets the version and the changelog, rolls the shelf, moves the watermark, writes `_folded.json`. All or nothing. |
| `tools/rid.mjs` | **THE ROW ID** (v361): gives every ledger row a stable `rid` and mints one for each new row the fold appends. `ovKey` is party, date and total joined, so it names a row only until one of those three is edited, and it already collided on two SA5-BTR lots. `nextRid` is the one place an id is minted, so the tool and the fold cannot disagree. |
| `tools/sort-ledger.mjs` | Puts `sales` and `purchases` back in date order, undated pending rows last. Asserts its output is a permutation of its input. |
| `ledger/book.json` | **THE BOOK** (v339, move 2): the twenty-six ledger keys as data, plus `NOTES`. Edited by the fold; rendered into the master by `tools/booksync.mjs --sync`; CI proves the copy. |
| `tools/booksync.mjs` | `--sync` renders the book into the master between its markers; `--check` fails if the block is not the file; `--normalise` rewrites the JSON one record per line. |
| `engine/pricing.mjs` | **THE PRICING ENGINE** (v337, move 1 of the rebuild): the cost stack, the taper, the ladder, the floors and the board as pure functions of explicit inputs. The desk, the payload build and the drafter all price from it. Inlined into the master by `tools/engine.mjs --sync`; CI proves the copy is the file. |
| `engine/position.mjs` | **THE POSITION ENGINE** (v338): the correctable-field table (v363: which of a row's attributes an editor may set, and which are excluded as computed or structural, read by the drafter, the fold and the desk alike), the attribution rule (`attributionOf`, v362: who the associate is, read back out of a row, since R2 and R3 store it differently and the desk, the fold and the payload all need the same answer), the transaction model (what a row has paid, delivered, deferred, pending; its state and dates; what a lot received and paid; the ageing ladder), the ledger walk that was `recompute()`, cover, the commitments and the phone's row shape. Same rules as the pricing engine. |
| `tools/engine.mjs` | `--sync` writes `engine/*.mjs` into the master between its markers; `--check` fails if the block is not the module. |
| `geo/basemap.json` | **THE BASEMAP** (v349): the drawn administrative outlines, with source, licence, the day fetched and the simplification stated. OpenStreetMap via geoBoundaries, ODbL 1.0, so the credit is printed under the map. Fetched ONCE by `tools/geofetch.mjs` and committed; nothing loads at runtime. |
| `geo/places.json` | **THE GAZETTEER** (v349): `PLACES`, `METRO`, `NON_PLACE`, `PLACEHOLDER`, `LOCS` and `NOTES`, out of the master and into data. |
| `tools/geofetch.mjs` | Re-fetch and re-simplify the basemap from source. Run BY HAND. Never run by CI or by the build, and the only thing here that touches the network. |
| `tools/geosync.mjs` | `--sync` renders `geo/*.json` into the master between its markers; `--check` fails if the block is not the files. Same rule as the engine and the book. **Feature names are NOT rendered**: the desk is public and draws no label. |
| `tools/changelog.mjs` | Prepends the master's current `evolution[0]` to `master/changelog.json`. Never rewrites an entry that exists. |
| `design/salt-ds.css` | **THE DESIGN SYSTEM'S STYLESHEET** (v472, 02 Sep 2026), vendored from `Code\salt-ds\src\styles.css` by `node tools/designsync.mjs --pull`. Tokens and the `salt-` recipes; no font import, because the CSP is self-only and the pull refuses one. |
| `design/desk.css` | **THE DESK'S DESIGN LAYER** (v472): a last-wins layer, as v213 and v281 were, binding the desk's own class vocabulary to the design system's tokens. Edit this for any change of material, type or colour; never the rules above it in the master. The ethos is `salt-ds/DESIGN.md`, the concept `docs/DESIGN.md`. |
| `tools/renderdiff.mjs` | **THE RENDER DIFF** (v474): `--shoot <label>` renders every part at 1280 and 375 with motion off, the stamp, the version chip, the entry counts and the journal's version entries masked; `--compare <a> <b>` counts the pixels that move by more than two units per channel, shot for shot, and reads the same up to 16 of them. A fold that claims to change nothing visible ships when every shot reads the same. Playwright from `Code\salt-ds\.ds-sync`, PIL for the compare; by hand, never CI. Proved red on a one-line colour change before it was trusted. |
| `tools/ledger-probe.mjs` | **THE SHEET'S GEOMETRY** (v495): measures the Ledger's opening line, step line and heading in a real browser at 1280 and 375, because jsdom lays out no grid. Same rig as the render diff; by hand, never CI. Exits non-zero on a failed claim. Proved red on the v494 build before its green was trusted. |
| `tools/designsync.mjs` | `--pull` vendors the design system's stylesheet; `--sync` renders both design files into the master between the `DESIGN` markers at the foot of its `<style>`; `--check` fails if either block is not its file. Same rule as the engine, the book and the geography, and CI runs it. |
| `.github/workflows/` | CI with no secrets: date order, changelog, tests, build-matches-master, and a daily check that the live Worker serves what the repo committed. |
| `tools/update.mjs` | **The whole "update" chain in one command**, ending in proof that every surface is level. See below. |
| `tools/make_statements.mjs` | **THE MONTHLY STATEMENTS** (29 Aug 2026): one statement of account per customer, plus the review sheet. The v387 desk's own `stmtRows`/`stmtRecon`/`stmtRefunds`/`stmtDoc`, lifted verbatim when v388 removed them from the master, proven byte-identical against the desk's own output on the v387 book. Figures come from `ledger/book.json` and `engine/position.mjs`, the book and engine the desk itself runs, so they cannot drift from it; what lives here alone is the statement's own law. Plain node, no jsdom, and the master is not an input. `docs/STATEMENTS.md` is the routine that runs it. |
| `tools/qr.mjs` | **THE QR ENCODER** (02 Sep 2026), written out rather than installed: this repo runs `npm ci` unattended over the real ledger, and two devDependencies is a surface worth keeping. Byte mode, level M, versions 1 to 10, inline SVG out. Proved against an independent encoder over 1,736 symbols at all eight masks; twelve golden vectors from it stay in the suite. |
| `tools/stmt-crypto.mjs` | The statement password, its PBKDF2 verifier and the AES-GCM envelope, matching the name vault byte for byte. Two round counts on purpose: 150,000 for the key the browser derives once, far fewer for the verifier the Worker recomputes on every attempt. |
| `tools/stmt-style.mjs` | The statement in the Salt identity: the `:root` block read out of `design/salt-ds.css` rather than transcribed, plus the document's own layer. One stylesheet for the statement, the review sheet and the site's page; `--sync` bakes it into `stmt/statement-css.js`, which CI proves. |
| `stmt/worker.js`, `stmt/page.js` | **THE STATEMENTS SITE** (03 Sep 2026, his instruction): a second Worker on its own cryptic address, its own KV store, and no access to anything of the desk's. One landing page for every account: username plus password, decrypted in the reader's browser, this month and every earlier one, locked after three minutes. Nothing under `stmt/` may import from `src/`, `tools/` or a node builtin; the suite checks. |
| `wrangler.stmt.jsonc` | The statements site's config: its name (which is its address, and which the QR carries), its `STMT` store and its `STMT_MASTER` secret. Every wrangler command for the site takes `-c wrangler.stmt.jsonc`. |
| `statements/_users.json` | Desk code to username, minted once per customer and kept for life. Committed: an address, not a secret. |
| `tools/stmt-publish.mjs` | **THE LIVE STATEMENT** (03 Sep 2026, his instruction): run by the deploy after every fold. Seals a statement of every entry from the start to this minute into each customer's record under a content key derived from the `STMT_KEY` secret, puts the newest issue's records in one bulk call, retires what the issue does not carry, clears the attempt counters on a new issue only. `--dry <dir>` writes the bulk files and touches nothing. |
| `statements/_secrets.json` | **Laptop only, gitignored.** `{"key": <STMT_KEY>, "master": <STMT_MASTER>}`. The key derives every customer's content key and is the same string as the GitHub Actions secret; the master lets an issue carry a second wrap so the override actually opens a page. Lose the key and every account is re-issued. |
| `tools/make_icons.py` | The OLD icon generator, superseded at v472: the home-screen icons are the brand's own plates, copied from `Code\salt-dsrandssets` (`salt-icon-512.png` for both 512s, `salt-icon-192.png`, and the 180 scaled from the 512). Regenerate there, then copy. |
| `test/verify.mjs` | Smoke suite: Worker contract, name-drop, access gate, drain helpers, build integrity. |

## How a fold is sized, and where a round points (his instruction, 31 Aug 2026)

Eight adversarial rounds produced a stable pattern, and these two rules are the answer to it.
Round eight measured it plainly: the desk itself is sound and getting sounder, and nearly every
material finding now comes from **code written in the last two versions**, or from a fix that
landed on the one line it was given and left its twin a few lines away. The review had stopped
finding old faults and was mostly finding the ones the review itself created.

**SMALLER FOLDS.** A fold changes one thing and ships. The v406 batch carried twenty-two master
edits, four new instruments and six guards in one version, and three of its own fixes were
faults; the v408 panel shipped a whole new control and carried an unmeasured purchase side that
told the owner five settled lots owed RM 5,450. A fold that cannot be described in one sentence
is two folds. Ship the first, prove it, then start the second.

**AND WHEN A FIX LANDS, SWEEP ITS CLASS BEFORE SHIPPING IT.** Every partial in round eight was a
twin: the printed sentinel fixed and the divisor beside it left, the observed range filtered and
the party median not, the fold's cancellation gate fixed and the desk's identical `ovAmend` left
for the next version. Grep the pattern across the whole file before committing the one site the
finding named. This is cheaper than a round.

**A ROUND POINTS AT THE NEWEST CODE.** A sweep of the whole desk costs a fortune and returns
findings about code that has been stable for months. The next round probes the diff since the
last round, fold by fold, and every probe attacks the FIX rather than the desk it sits in.
Anything older is regression only: rebuild the last round's materials, and leave the rest listed.

**AN INSTRUMENT IS PROVED RED BEFORE ITS GREEN IS TRUSTED.** Standing since round six and now
without exception, because it has caught a real fault in a new check in each of the last four
folds. Two forms that do not count: an assertion that reads source text rather than running the
code, and one whose inputs are computed by the code it is checking.

## Working on it

```
npm install                 # once, for wrangler
npm run build               # master -> public/desk.html (run after any master edit)
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

(Superseded on 6 Oct 2026: the owner's Access application covers the Desk and `REQUIRE_ACCESS` is `"1"`;
current state in MEMORY.md. What follows is the August reasoning.)

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

## Tests

`npm test` runs `test/verify.mjs`: 250 assertions with no network or browser. Add one for every
behavioural change to the Worker, the build patches or the drain. The desk's own rendering is
covered by the daily run's jsdom pass against the master, not here.

## Superseded: the Malay slice and the live languages (D12, F7), removed 05 Oct 2026

Moved from `docs/STATEMENTS.md`. The owner removed Malay everywhere on 05 Oct 2026; this is the reasoning as it stood.

**The first Malay slice** (his D12, the plan's 13.4), as it reads while Malay is live (it is off: `LIVE` below): the `MS` table words the welcome, the door and its refusals,
saving the app (the keep card and Sheets, One step to finish), Home, paying (To pay now, the pay Sheet, Did you send,
a claim), an order's money and its messages, and This device. The page follows the phone (`navigator.languages`, the
first of `ms`, `ms-MY`, `ms-BN`, `zsm` or `en`, else English); a switch, English or Bahasa Melayu, on the door, the
welcome, One step to finish and This device overrides it and is kept on the phone as `salt-lang`, the page drawing the
same without storage. Outside the slice (Prices, the statement, Rewards, the order sheet, the Orders list, and an
order's head, steps, history and cancel) is drawn in English whatever is chosen (`inEn`) and says `lang="en"`
(`enLang`, the slice inside it `rdLang`), a state, size or date the
slice shares included, and so is a note a tap leaves there (`wErrE`), so an order's screen is mixed until its slice comes. The page leaves its language in the
origin's Cache as `/lang` on every open and switch, and `stmt/sw.js` reads it to word a banner, English where there is
none. Salt Account is English on any phone, with no switch. The sign-in message is English then Bahasa Melayu in one,
since it goes before the phone's language is known. The suite reads the Malay table and a page drawn with Malay live
(`{langs: ["en", "ms"]}`) for a product or level word.

**Live languages are `LIVE`** (F7, `stmt/words.js`): Malay is kept and off since 28 Sep 2026, his instruction,
superseding D12's slice and the two-language message while it is off. With `LIVE = ["en"]` the page draws no switch
(the door, the welcome, One step to finish and This device's row all go), a Malay phone and a phone that kept `ms` open
in English (`langOk` requires `LIVE`, so `langOfPhone` and `salt-lang` pass Malay over), `/lang` is written English,
the banner reads English for a language not live (`swScript(LIVE)`), and the sign-in message is its English half
alone. `MS` stays whole: turning Malay on again is `LIVE = ["en", "ms"]`, and the suite renders the slice's sections
with `{langs: ["en", "ms"]}` (`landingPage`, `signInMessage`, `swScript`), so the kept table stays proved.

## 13 Oct 2026: B5 of #62, the assertions the Desk retired

The Desk draws and reads; Counter Admin carries every write. Each Desk assertion that drove a removed control is listed here with the Counter test that covers the same behaviour (a named twin) or a one-line reason it is retired. A twin is named by the section's subject; the file was not re-audited line by line. Removed with a section means the whole section went because every assertion in it drove a removed control.

### Sections pruned or removed

- `Desk: the row editor names only fields CORRECTABLE holds` (5 of 7 assertions): drove the row editor's field table (EDFORM). Retired: the editor is gone; test/maker-amend.mjs, test/maker-ledger-fields.mjs hold the correctable fields on Counter Admin.
- `Engine: the position, out of the desk (v338)` (2 of 42 assertions): drove the Workbench preview words (wbState). Retired: the Workbench preview is gone; the engine's txStat reading stays pinned in the rest of the section.
- `Fold: an approved batch becomes records in the book (v340)` (1 of 109 assertions): drove the editor's Defaulted tick (edFields). Twin: test/maker-amend.mjs, test/maker-ledger-fields.mjs.
- `Views: every part is one tap away (v343)` (3 of 8 assertions): drove source pins on the Desk's Add ID pane, apDecide, ordAct and the parts list. Retired: pins to code that is removed; the new parts list is pinned in test/desk-dashboard.mjs.
- `Boundaries: the caps and the trigger are per book (round 5, his call 4)` (1 of 9 assertions): drove wbCreditUnits partition check. Retired: a Workbench helper; creditCapFor and the reorder trigger stay pinned in the rest of the section.
- `Oil: the ladder at every size, lawful between (round 5 his call 5, restated at v656)` (1 of 52 assertions): drove the "Set the board" panel head. Twin: test/maker-house-sizes.mjs, test/admin-sizes-hours.mjs.
- `iPhone: the dead zones the desk draws under (v392)` (1 of 14 assertions): drove the Add ID box's password field size. Retired: the box is gone.
- `Enter: the tap contract on the one view you type into` (1 of 8 assertions): drove the Whiteboard's hush controls as ghosts. Twin: test/maker-hush.mjs.
- `Refused: shown so they are not entered twice, never so they can be approved (v309)` (1 of 10 assertions): drove Withdraw beside a refused entry. Twin: test/admin-unsent.mjs, test/maker-queue-withdrawal.mjs.
- `Every part renders on every book (round 5 fold; content and census, round 6)` (1 of 5 assertions): drove the Enter part census (add, now a short reading panel). Retired: the part no longer builds a form.
- `v408: the update panel does the arithmetic so a tap cannot overpay` (10 of 13 assertions): drove the ledger row editor (pen, Save, Update) update panel. Twin: test/maker-amend.mjs, test/maker-ledger-fields.mjs (Counter Admin Corrections).
- `v409: the Enter sheet is priced against the book it books to` (7 of 9 assertions): drove the Enter form (Workbench Record, wbApply) and its fields pricing sheet. Twin: test/maker-trades.mjs, test/maker-inputs.mjs (Counter Admin forms).
- `v413: a lot is not measured like a sale` (3 of 33 assertions): drove ledEdit, updOut and the update chips on a lot. Twin: test/maker-amend.mjs, test/maker-ledger-fields.mjs.
- `v419: cancelling a delivered sale is refused everywhere it is offered` (1 of 6 assertions): drove the Workbench amend pane. Twin: test/maker-amend.mjs, test/maker-ledger-fields.mjs (Counter Admin Corrections).
- `v430: the controls the panel offers must exist and must be able to do what they say` (7 of 9 assertions): drove the ledger row editor (pen, Save, Update) controls. Twin: test/maker-amend.mjs, test/maker-ledger-fields.mjs (Counter Admin Corrections).
- `v446: what a lot is, answered beside what a sale is` (2 of 24 assertions): drove the Enter form (Workbench Record, wbApply) and its fields: lot and sale answers. Twin: test/maker-trades.mjs, test/maker-inputs.mjs (Counter Admin forms).
- **Removed** `v448: the editor opens on the chips, and one button` (8 of 8 assertions): drove the ledger row editor (pen, Save, Update) chips. Twin: test/maker-amend.mjs, test/maker-ledger-fields.mjs (Counter Admin Corrections).
- **Removed** `v457: a cancellation on the whiteboard asks for nothing and previews the refund` (5 of 5 assertions): drove the Enter form (Workbench Record, wbApply) and its fields: cancellation preview. Twin: test/maker-cancellation.mjs, test/maker-paid-cancel.mjs.
- **Removed** `v459: the editor measures what has moved with the ruler the gate uses` (3 of 3 assertions): drove the ledger row editor (pen, Save, Update) measure. Twin: test/maker-amend.mjs, test/maker-ledger-fields.mjs (Counter Admin Corrections).
- `v495: an entry is two rows, and the act cell ends the second` (7 of 14 assertions): drove the pen on a queued entry. Retired: .
- `Fields: the system's .salt-fields recipe owns the material of every input, select and textarea` (2 of 6 assertions): drove field padding on the drift box and the editor. Retired: the boxes are gone.
- `Ghosts: the system's .salt-ghost recipe owns the material of every quiet button` (3 of 11 assertions): drove ghost class pins and chips on removed controls. Retired: the controls are gone; the recipe is pinned on the rest.
- `two themes: Night and Tide, chosen per device (11 Oct 2026)` (4 of 59 assertions): drove the typed quantity on Enter, Save ink, a Hide token and a gradient pin. Retired: the controls are gone.
- `v524: roster-only parties on the phone` (11 of 12 assertions): drove the Enter form (Workbench Record, wbApply) and its fields: roster-only parties. Twin: test/maker-registration.mjs, test/maker-addid-tiers.mjs, test/maker-addid-drift.mjs, test/maker-geography.mjs.
- **Removed** `v525: reject means discard, with re-enter, on the phone` (4 of 4 assertions): drove reject with re-enter (Approve). Twin: test/admin-approve-queue.mjs, test/admin-unsent.mjs.
- `v526: the replay question, asked on the phone` (3 of 7 assertions): drove the Enter form (Workbench Record, wbApply) and its fields: replay question. Twin: test/maker-trades.mjs, test/maker-inputs.mjs (Counter Admin forms).
- `v527: borrow and lend on the phone` (3 of 10 assertions): drove the Enter form (Workbench Record, wbApply) and its fields: borrow and lend. Twin: test/maker-loan-twin.mjs.
- `v528: the name on the phone, filed encrypted before the ID is queued` (12 of 15 assertions): drove the Enter form (Workbench Record, wbApply) and its fields: name filed before the ID is queued. Twin: test/maker-registration.mjs, test/maker-addid-tiers.mjs, test/maker-addid-drift.mjs, test/maker-geography.mjs.
- `08 Sep 2026: the audit fixes` (4 of 52 assertions): drove entryFault on the entry form (carriage, collected delivery, undated row, zero quantity). Retired: the Desk mirror is removed; the drafter's own refusals are pinned in their sections and in test/maker-inputs.mjs.
- `v570: an associate is appointed from the Enter tab, and the Kind means what it says` (12 of 40 assertions): drove the Enter form (Workbench Record, wbApply) and its fields: appointing an associate. Twin: test/maker-registration.mjs, test/maker-existing-appointment.mjs.
- `11 Sep 2026: Self-use or loss, Turned away and Follow-up leave the Enter form` (2 of 7 assertions): drove the Enter form (Workbench Record, wbApply) and its fields: mode switch. Twin: test/maker-trades.mjs, test/maker-inputs.mjs (Counter Admin forms).
- `11 Sep 2026: a redemption and a rebate offset reach Approve, and Redeem is one tap` (6 of 21 assertions): drove Redeem and Offset buttons. Twin: test/maker-reward-spend.mjs, test/maker-offsets.mjs, test/maker-reward-parity.mjs.
- `11 Sep 2026: an associate's reward is offset against their advance automatically, up to 1 unit` (6 of 13 assertions): drove autoOffsets. Twin: test/maker-offsets.mjs.
- `11 Sep 2026: a refused entry is kept, and can be withdrawn` (4 of 26 assertions): drove Withdraw on a refused entry. Twin: test/maker-queue-withdrawal.mjs.
- **Removed** `11 Sep 2026: Add ID derives the code, and a clash takes more of the name` (15 of 15 assertions): drove deriveCode at Add ID. Twin: test/maker-registration.mjs, test/maker-addid-tiers.mjs, test/maker-addid-drift.mjs, test/maker-geography.mjs.
- `11 Sep 2026: a loan can be cash as well as salt` (5 of 15 assertions): drove the Enter form (Workbench Record, wbApply) and its fields: loans in cash. Twin: test/maker-loan-twin.mjs.
- `12 Sep 2026: a queued loan counts once, however often the desk redraws` (1 of 3 assertions): drove the Enter form (Workbench Record, wbApply) and its fields: queued loan. Twin: test/maker-loan-twin.mjs.
- `12 Sep 2026: a reward offset is priced on the goods, and settles no more than is owed` (2 of 7 assertions): drove autoOffsets pricing. Twin: test/maker-offsets.mjs.
- `12 Sep 2026: a loan is repaid, in part or in full, in what was lent` (7 of 22 assertions): drove the Enter form (Workbench Record, wbApply) and its fields: Repaid. Twin: test/maker-loan-twin.mjs.
- `12 Sep 2026: the Enter form's messages are a list, and an empty form carries no status` (6 of 9 assertions): drove the Enter form (Workbench Record, wbApply) and its fields: message list. Retired: .
- `v611: an R2 sale books to the associate's bucket, at entry and on correction` (1 of 15 assertions): drove the Enter form (Workbench Record, wbApply) and its fields: R2 sale. Twin: test/maker-trades.mjs, test/maker-inputs.mjs (Counter Admin forms).
- `v616: an associate earns a whole unit per RM 500 of margin brought, pooled over the whole ledger` (1 of 10 assertions): drove redeemRebate. Twin: test/maker-reward-spend.mjs, test/maker-offsets.mjs, test/maker-reward-parity.mjs.
- `v617: a departed associate keeps earning, but nothing is redeemed until they return` (2 of 9 assertions): drove redeemRebate for a departed associate. Twin: test/maker-reward-spend.mjs, test/maker-offsets.mjs, test/maker-reward-parity.mjs.
- `v620: a customer's reward covers a lower margin on a sale he marks, at the salt's cost` (3 of 12 assertions): drove the Enter form (Workbench Record, wbApply) and its fields: the cover tick. Twin: test/maker-claim-covered.mjs, test/maker-trades.mjs.
- `v621: a customer holding a whole unit can redeem one, on his word` (4 of 6 assertions): drove Redeem and Offset cards. Twin: test/maker-reward-spend.mjs, test/maker-offsets.mjs, test/maker-reward-parity.mjs.
- `v628: Amend ID re-keys a party through Approve, and the name moves in the vault` (8 of 24 assertions): drove Amend ID through wbApply. Twin: test/maker-registration.mjs, test/maker-addid-tiers.mjs, test/maker-addid-drift.mjs, test/maker-geography.mjs.
- `v633: a party's place reaches the map on its own, from what is typed at Add ID and Amend ID, or from a tap` (16 of 39 assertions): drove place to the map from Add ID and Amend ID. Twin: test/maker-geography.mjs, test/admin-places.mjs.
- `v643: each customer holds a tier for each product, set on the phone and folded, proposed from what they pay and quoted nowhere yet` (3 of 11 assertions): drove the tier select on the Customers page. Twin: test/maker-tier-accept.mjs, test/maker-tier-bands.mjs, test/maker-drift.mjs.
- `v645: Add ID starts a new customer at the tiers chosen, and the fold files them` (3 of 7 assertions): drove Add ID tiers. Twin: test/maker-registration.mjs, test/maker-addid-tiers.mjs, test/maker-addid-drift.mjs, test/maker-geography.mjs.
- `v646: a tier for each product, and a product a customer has never bought is proposed nothing until he sets one` (4 of 8 assertions): drove the Tiers card. Twin: test/maker-tier-accept.mjs, test/maker-tier-bands.mjs, test/maker-drift.mjs.
- `v670: a customer's level can differ by the size of the order, read band by band in one place` (1 of 7 assertions): drove the Tiers card bands. Twin: test/maker-tier-accept.mjs, test/maker-tier-bands.mjs, test/maker-drift.mjs.
- `V5c (29 Sep 2026): a late payer is read from the handover across every book, and offered a level down, never priced one` (1 of 9 assertions): drove the Tiers card level-down offer. Twin: test/maker-tier-accept.mjs, test/maker-tier-bands.mjs, test/maker-drift.mjs.
- `v679: a place is its locality then where that is: the code from the locality, the locality with the point` (3 of 8 assertions): drove deriveCode from the locality. Twin: test/maker-registration.mjs, test/maker-addid-tiers.mjs, test/maker-addid-drift.mjs, test/maker-geography.mjs.
- `v682: at Add ID and Amend ID the location is chosen from a list, and a location chosen carries its own point` (3 of 7 assertions): drove place lists at Add ID and Amend ID. Twin: test/maker-registration.mjs, test/maker-addid-tiers.mjs, test/maker-addid-drift.mjs, test/maker-geography.mjs.
- `v684: on a desktop the rail stands at every width; only a touch screen at 860px or below folds it into the menu` (1 of 9 assertions): drove placePicker in the map layout. Twin: test/admin-places.mjs, test/maker-geography.mjs.
- `S13 13.2: the word checks know the level and product words, English only, and ordinary lines still pass` (5 of 13 assertions): drove siteSafe mirror and the Desk answer box. Twin: test/admin-words.mjs, test/counter-state-words.mjs.
- **Removed** `S13 13.2: his answer on an order asks before sending a line the desk warns on, as the bulletin does` (5 of 5 assertions): drove ordAct warning on a line. Twin: test/admin-words.mjs.
- `v732: a bulletin is set from Enter, stands on Salt Counter (a still card on Home since S7 7.5), and never names the desk, a code or a level` (8 of 29 assertions): drove the Bulletin editor on Site orders. Twin: test/admin-words.mjs, test/admin-orders.mjs.
- `v728: the handover is one word, it decides whether there is a carriage, and the form types the two figures the ledger stores` (20 of 26 assertions): drove the Enter form (Workbench Record, wbApply) and its fields: the handover word. Twin: test/maker-trades.mjs, test/maker-inputs.mjs (Counter Admin forms).
- `v733: a free unit is a tap, and the reward shrinks with the gift` (7 of 29 assertions): drove the Enter form (Workbench Record, wbApply) and its fields: free unit. Twin: test/maker-gift-twin.mjs.
- `v738: what a customer owes is the goods and the delivery together, wherever it is read` (1 of 19 assertions): drove a source pin on the Workbench's outstanding line. Retired: the line is gone; txOwed stays pinned in the rest of the section.
- `v741: the engine's status and dates, the customer's statement and the row editor read what is owed as the goods and the delivery` (3 of 12 assertions): drove the ledger row editor (pen, Save, Update) reads status. Twin: test/maker-amend.mjs, test/maker-ledger-fields.mjs (Counter Admin Corrections).
- `v753: he answers on the order, and the words are checked on the desk before they leave it` (3 of 13 assertions): drove the answer box on the card. Twin: test/admin-orders.mjs, test/admin-order-card.mjs, test/maker-order-controls.mjs.
- `v763: a closed order can be opened on the card, read and answered` (1 of 9 assertions): drove the answer box on a closed order. Twin: test/admin-orders.mjs, test/admin-order-card.mjs, test/maker-order-controls.mjs.
- `Step 2.1 (29 Sep 2026): the price he sets at Accept drafts that one order's row at it, never under the floor, his yes covering it, and moves nothing else` (2 of 10 assertions): drove Price field at Accept. Twin: test/admin-orders.mjs, test/admin-order-card.mjs, test/maker-order-controls.mjs.
- `S6 11.14: Received and Not found on his card reach the customer with their kind, and Not found files the claim's row and lowers the site's figure in one event` (3 of 14 assertions): drove Received and Not found on a claim card. Twin: test/admin-claim-card.mjs, test/maker-claims.mjs.
- `S6 11.15: a claim against the account is drawn as the engine's oldest-first allocation, row by row, and one tap approves exactly those rows` (3 of 10 assertions): drove claim against the account: Received. Twin: test/admin-claim-card.mjs, test/maker-claims.mjs.
- `S6 fix: Not found is refused on a claim against the account whose rows his Received has booked, and the card offers only Received` (1 of 3 assertions): drove Not found on an account claim. Twin: test/admin-claim-card.mjs, test/maker-claims.mjs.
- `S6 fix: an order is not cancelled, by them or by him, while a claim of theirs on it waits` (1 of 4 assertions): drove Cancel while a claim waits. Twin: test/admin-claim-card.mjs, test/maker-claims.mjs.
- `S6 fix: a claim that money he recorded another way already covers is answered Received, on the book already, never Not found` (1 of 4 assertions): drove a claim covered by recorded money. Twin: test/maker-claim-covered.mjs.
- `S1 1.11: Site orders keeps a typed charge, handover figure and answer across its poll and a refusal` (6 of 7 assertions): drove typed charge and answer across a poll. Twin: test/admin-orders.mjs, test/admin-order-card.mjs, test/maker-order-controls.mjs.
- `S1 1.12: a cold desk reads site orders and drafts once it knows it is the cloud, and Today counts them` (1 of 5 assertions): drove a cold open draws the card with the order. Twin: test/admin-orders.mjs, test/admin-order-card.mjs, test/maker-order-controls.mjs.
- `S1 1.14: Approve asks before rejecting a row a site order made, and the rejection is told to the order` (3 of 10 assertions): drove apDecide asks before rejecting a site-order row. Twin: test/admin-approve-queue.mjs, test/admin-unsent.mjs.
- `S1 1.48: Acknowledge, Approve and the notice's buttons wear the system's recipes, with no colour of their own` (5 of 6 assertions): drove Acknowledge, Decline, Cancel recipes. Twin: test/admin-orders.mjs, test/admin-order-card.mjs, test/maker-order-controls.mjs.
- `S11 11.4: Site orders opens on Waiting on you, one row a customer act, oldest first, counted the same on Today and the Enter badge` (1 of 8 assertions): drove the notice editor fold. Twin: test/admin-orders.mjs.
- `S11 11.2: a new order's card draws the row the preview drafted before the yes: their card against the quote, margin, floor, usual and flags` (2 of 7 assertions): drove the preview card yes. Twin: test/admin-orders.mjs, test/admin-order-card.mjs, test/maker-order-controls.mjs.
- **Removed** `S11 11.3: a delivery's charge is chosen from RM 0, 10, 15 or Other with none chosen, and Accept, RM <total> sends it with the row's hash from a footer in reach` (7 of 7 assertions): drove delivery charge chips. Twin: test/admin-orders.mjs, test/admin-order-card.mjs, test/maker-order-controls.mjs.
- `S11 11.6: his saved quick replies fill the answer box, and No reply needed lets a line stand without a word to them` (5 of 9 assertions): drove quick replies. Twin: test/admin-orders.mjs, test/admin-order-card.mjs, test/maker-order-controls.mjs.
- `S11 11.7: Decline and Cancel take a reason, checked on the desk, which the customer reads as Not taken or Cancelled by us` (3 of 9 assertions): drove Decline and Cancel reasons. Twin: test/admin-orders.mjs, test/admin-order-card.mjs, test/maker-order-controls.mjs.
- `S11 11.8: a handover with nothing paid is a Cash to record row, and Cash received marks the order paid in cash at once, so the chase stops` (2 of 9 assertions): drove Cash to record row. Twin: test/maker-cash-undo.mjs.
- `S11 11.9: Delivered part steps to a part of the handover, and Close at what was handed over restates a short order as a Correction` (5 of 14 assertions): drove Delivered part and Close. Twin: test/admin-orders.mjs, test/admin-order-card.mjs, test/maker-order-controls.mjs.
- **Removed** `S11 fix: while a reason is chosen, the footer speaks of the decline alone` (1 of 1 assertions): drove decline footer. Twin: test/admin-orders.mjs, test/admin-order-card.mjs, test/maker-order-controls.mjs.
- `S11 merge: the card drives the real desk Worker, drawing the preview it answers and saying what each yes did` (3 of 4 assertions): drove the card drives the Worker preview. Twin: test/admin-orders.mjs, test/admin-order-card.mjs, test/maker-order-controls.mjs.
- `S11 merge: a move whose row he rejected is offered again from its own card, under a fresh entry booked only if equal` (2 of 4 assertions): drove a rejected move offered again. Twin: test/maker-accept-again.mjs.
- **Removed** `S11 merge: a tap that closes its order keeps its answer, said at the head of the list once the card has left it` (1 of 1 assertions): drove a close keeps its answer. Twin: test/admin-orders.mjs, test/admin-order-card.mjs, test/maker-order-controls.mjs.
- `06 Oct 2026: a close under what they paid is one tap, its yes spent on its row, the answer and the card naming the refund` (1 of 2 assertions): drove a close under what they paid. Twin: test/admin-orders.mjs, test/admin-order-card.mjs, test/maker-order-controls.mjs.
- **Removed** `S11 fix: Accept tapped while a poll drafts the row again sends the digest of the row it drew` (1 of 1 assertions): drove Accept while a poll drafts again. Twin: test/admin-orders.mjs, test/admin-order-card.mjs, test/maker-order-controls.mjs.
- `S11 fix: an order whose Accept is given and waiting reads as that, never as a new order to accept again` (1 of 2 assertions): drove an Accept given and waiting. Twin: test/admin-orders.mjs, test/admin-order-card.mjs, test/maker-order-controls.mjs.
- **Removed** `S11 fix: a part typed into Delivered part is said as it is typed, and the box's change never redraws the card under a tap` (1 of 1 assertions): drove Delivered part typing. Twin: test/admin-orders.mjs, test/admin-order-card.mjs, test/maker-order-controls.mjs.
- **Removed** `S11 fix: a tap in flight shuts its card's buttons and says it is sending` (1 of 1 assertions): drove a tap in flight. Twin: test/admin-orders.mjs, test/admin-order-card.mjs, test/maker-order-controls.mjs.
- **Removed** `S11 fix: the quick-reply button says Forget over a line already kept, and Keep over a new one` (1 of 1 assertions): drove Forget over a kept quick reply. Twin: test/admin-orders.mjs, test/admin-order-card.mjs, test/maker-order-controls.mjs.
- `S11 fix: his wake opens the card of the newest act, which is the one that woke him` (1 of 2 assertions): drove his wake opens the newest card (button path). Twin: test/admin-orders.mjs, test/admin-order-card.mjs, test/maker-order-controls.mjs.
- `S7 7.5: a Set on the desk asks before it wakes every phone, and the notice is Home's still card` (4 of 5 assertions): drove a bulletin Set asks before waking. Twin: test/admin-words.mjs.
- `V4b (29 Sep 2026): his card names the other orders open on its sheet, each a tap to its card, and a delivery to agree says the trip is one` (1 of 3 assertions): drove the sheet names other open orders on a card. Twin: test/admin-orders.mjs, test/admin-order-card.mjs, test/maker-order-controls.mjs.
- `V4b.2 (29 Sep 2026): a sheet is agreed with one Accept on its first order's card, the charge there and RM 0 on the rest, each row drafted; made ready and handed over together; a refusal stops the rest` (14 of 19 assertions): drove one Accept for a sheet. Twin: test/admin-orders.mjs, test/admin-order-card.mjs, test/maker-order-controls.mjs.
- `22 Sep 2026: the desk draws its light, tiles, findings, pills and parts strip from the system's recipes` (1 of 17 assertions): drove the count of filled pills on the page. Retired: the page carries fewer buttons by design.
- **Removed** `v789: a second book on the Enter form is a second transaction for the same party` (11 of 11 assertions): drove the Enter form (Workbench Record, wbApply) and its fields: a second book. Twin: test/maker-trades.mjs, test/maker-inputs.mjs (Counter Admin forms).
- `05 Oct 2026: one delivery for a trip of several books, held once and decided in one tap` (5 of 25 assertions): drove the Enter form (Workbench Record, wbApply) and its fields: one delivery for a trip. Twin: test/maker-trades.mjs, test/maker-inputs.mjs (Counter Admin forms).
- `22 Sep 2026: the rail, the bar and the tags draw from the system's recipes` (1 of 8 assertions): drove the bar recipe pin on removed controls. Retired: the controls are gone.
- `Fold 4.1: one render reads allActions once and approachSplit once a book, and nothing it keeps outlives it` (1 of 5 assertions): drove pxScope in the one-render fold check. Retired: a removed helper; the allActions single read is pinned in the rest of the section.
- **Removed** `28 Sep 2026: Cash received takes a custom amount, whole or part, and the pill and field survive a redraw` (9 of 9 assertions): drove Cash received custom amount (card). Twin: test/maker-cash-undo.mjs, test/maker-cash-purchase.mjs.
- `28 Sep 2026: the row editor's R2 move with the Buyer cleared queues what the drafter takes, and the sheet queues nothing the drafter refuses` (8 of 9 assertions): drove the ledger row editor (pen, Save, Update): R2 move. Twin: test/maker-amend.mjs, test/maker-ledger-fields.mjs (Counter Admin Corrections).
- `V4a 4: the desk keys another book's row with its product: the open orders it seeds keep a salt order and its oil twin apart, and the Workbench names each by the engine's key` (2 of 3 assertions): drove the Workbench's oil amend keys and replayAnswer. Twin: test/maker-amend.mjs, test/maker-ledger-fields.mjs.
- **Removed** `F14: Add ID and Amend ID file a link's place on the one passphrase, a re-key carries it, his base point files alone, and no link, point or address reaches the queue` (13 of 13 assertions): drove Add ID and Amend ID file a link place (Desk form). Twin: test/admin-place-drafts.mjs, test/admin-places.mjs.
- **Removed** `28 Sep 2026: a lot's Payment on the Workbench previews, renders and queues its AMEND, the lot read through the engine's poStat and not a bare name that threw` (3 of 3 assertions): drove the Enter form (Workbench Record, wbApply) and its fields: a lot payment. Twin: test/maker-amend.mjs, test/maker-ledger-fields.mjs (Counter Admin Corrections).
- **Removed** `29 Sep 2026: Decline and Cancel reasons are sentences, a typed one is given its full stop, and Ready shows again while units are owed` (3 of 3 assertions): drove Decline and Cancel reason sentences. Twin: test/admin-orders.mjs, test/admin-order-card.mjs, test/maker-order-controls.mjs.
- `F15 (29 Sep 2026): the delivery fee by distance: RM 1.50 a km by road at 1.3, one way, rounded to RM 0.50, worked from where he is, else his base point, to the party's point, else its locality` (10 of 11 assertions): drove the delivery fee on a card (deliveryFeeFor). Retired: the fee rule itself is the engine rule is pinned in its own sections; the card button is gone.
- `F15: a delivery's card offers the fee in Other on the trip's first order, the preview drafts what the box holds, and Accept sends his figure` (8 of 9 assertions): drove the delivery fee on the card. Twin: test/admin-orders.mjs, test/admin-order-card.mjs, test/maker-order-controls.mjs.
- **Removed** `F15: the Workbench's Delivery box, opened on a sale to a chosen party, takes the fee while it stands at nought, and keeps a figure he typed` (8 of 8 assertions): drove the Enter form (Workbench Record, wbApply) and its fields: delivery box. Twin: test/maker-trades.mjs, test/maker-inputs.mjs (Counter Admin forms).
- **Removed** `29 Sep 2026: Cash received waits ten seconds on its card with Undo, and an Undo inside them sends nothing` (8 of 8 assertions): drove Cash received held ten seconds with Undo (card). Twin: test/maker-cash-undo.mjs.
- `Counter maker: verified owner, narrow Desk bridge and hours` (5 of 133 assertions): drove the Desk's Add ID, Amend ID, place filing and Add party in the Counter bridge test. Retired: the same section's Counter assertions, test/maker-registration.mjs, test/maker-geography.mjs.
- `05 Oct 2026: salt is the Set Price moved by each customer's drift, read off their record unless he sets one` (2 of 25 assertions): drove drift Set price (queue). Twin: test/maker-drift.mjs.

Totals: 112 sections touched, 20 removed whole, 471 assertions removed (413 with a named twin, 58 retired with a reason).

### Test files the sections run

- `test/maker-trades.mjs` (1 assertions removed): drove the Workbench's multi-book form (wbApply, tile taps). Twin: the Counter's own assertions in the same file.
- `test/partner-control.mjs` (4 assertions removed): drove the Drift card's Make partner (partnerMake). Twin: test/maker-partner.mjs.
- `test/delivery-pin-desk.mjs` (2 assertions removed): drove the card's fee read to an exact spot (deliveryOffer, feeLine, ordFeeRead). Twin: the same file's vault and filing assertions, which the Desk keeps.
- `test/delivery-yes.mjs` (4 assertions removed): drove the card's Send for their yes and Accept all (ordAct, ordSheetAct). Twin: the same file's Worker assertions and test/admin-orders.mjs.
- `test/delivery-accept-window.mjs` (8 assertions removed): drove the card's window offers and Accept all (ordWinDays, ordWinOn, ordAct). Twin: the same file's Worker assertions and test/admin-sizes-hours.mjs.
- `test/maker-partner.mjs` (0 assertions removed): drove partnerMake, the Desk half. Twin: the same file's Counter assertions.
- `test/partner.mjs` (1 assertions removed): drove the Drift card naming a partner. Twin: the same file's floor and quote assertions.
- `test/counter-state-words.mjs` (2 assertions removed): drove siteSafe, the Desk mirror of the word lists. Twin: the same file's siteWords assertions on the Worker side.
- `test/maker-trade-reading.mjs` (1 assertions removed): drove the Workbench's reading, the parity half. Twin: the same file's Counter reading assertions.
- `test/maker-reward-spend.mjs` (1 assertions removed): drove the Desk's redeemRebate, the parity half. Twin: the same file's Counter spend assertions.
- `test/maker-reward-parity.mjs` (1 assertions removed): drove the Desk's redeemRebate, the parity half. Twin: the same file's generated-offer assertions.
- `test/desk-maker-constructors.mjs` (3 assertions removed): drove the Desk's own entry constructors (addParty and the Workbench forms). Twin: the same file's Counter constructors.
- `test/maker-tier-accept.mjs` (1 assertions removed): drove tierAcceptAll, the Desk half. Twin: the same file's Counter assertions.
- `test/maker-offsets.mjs` (9 assertions removed): drove autoOffsets, the Desk half. Twin: the same file's Counter assertions.
- `test/maker-house-sizes.mjs` (6 assertions removed): drove shSizes and shQueueHouse, the Desk half. Twin: the same file's Counter assertions.
- `test/maker-addid-tiers.mjs` (1 assertions removed): drove wbTiersChosen, the Desk's Add ID. Twin: the same file's Counter assertions.
- `test/maker-hush.mjs` (1 assertions removed): drove obsAct and hushPost, the Desk half. Twin: the same file's Counter assertions.

External files: 46 assertions removed, each with the same file's Counter-side assertions as its twin.

### Mutation needles

Twenty-six manifest entries named text the Desk no longer carries (test/mutation-needles.mjs would fail on them) and were removed with their assertion:

- `test/counter-state-words.mutations.json` (1): the Desk's lock refuses a new state word.
- `test/delivery-accept-window.mutations.json` (11): the card offers no window as theirs; the card times an order with a day; the card times a placed collection; Accept sends no window; Accept retimes their window; the card's Accept times a collection; a sheet's line ignores the window handed it; Accept all hands no window; an ended window is sent; the desk offers a window begun; the desk's week is three days.
- `test/delivery-pin-desk.mutations.json` (5): the fee ignores the spot; the fee line does not name the spot; the card's fee read passes no spot; the lock keeps the spots; the strip is not drawn.
- `test/delivery-yes.mutations.json` (5): the card accepts a raise; the card sends a window on an as-soon-as order; the card's offer drops the window; the card's offer sends Accept's digest; Accept all sends a sheet that needs their yes.
- `test/two-themes.mutations.json` (4): the scrim is a literal again; Record is Night's verdigris as a literal again; the Cancelled pill's text is white as a literal again; the Cancelled pill takes the ink at Night.

### New checks

`test/desk-dashboard.mjs` presses every control on every part of every view with a fixture of everything that used to carry one, and fails on any post to /drafts, /orders/*, /claims/*, /threads, /bulletin, /hush, /bio, /queue (except the recovery panel's Send) or /inputs; it proves the restock date, the waiting stamp and the preview still post, the recovery panel's Send still reaches /queue, and `OVERLAY_UNSENT` is false. Its mutations are in `test/desk-dashboard.mutations.json`, each run on its own with `node tools/section.mjs "13 Oct 2026: B5" --mutations test/desk-dashboard.mutations.json`.

## Superseded: the five price levels, the drift and the proposals, removed 18 Oct 2026

On 18 Oct 2026 (his decisions, built as four parts on one branch) the Floor became the order total rounded up to the next RM 5, the Ceiling 3 times it on every book, and salt's Set Price the least any customer but a partner pays, with his own % per customer lifting it inside the walk and the engine only suggesting one. What that retired, and why it was kept until then: the five levels (Titanium to Bronze, v641 to v644, columns at multiples of the Floor from 1.0 to 2.5, with Ambassador paying the Floor by his word alone) and the legacy Tier I to III badge (the cost ladder's markup curves of v245 to v249 stay inside the engine as data, never shown); the stated Tier 1 of v564 to v656; the level per band (v670) and the four rules (v671) and the proposals that moved an unheld customer on their profile and the stock, with NRV read at the lowest level (v656); the Tiers card, Accept every suggestion, and a standing guest link and board per level; and Model B's drift, a number from -1 to +1 read off the record (`autoDrift`) so that a late payer was priced up, with presets Better, Standard and Higher. The reason each went is the same: a figure that moved a price without his word, and a word (a level, a drift) a customer or he had to learn. The code, the tests and the older wording are in git before 70a009ef; the profile (v666) and the late payer (V5c) stay, and now feed the suggestion and the card's good and bad only.
