# Salt Command, on the phone

Root `CLAUDE.md` governs voice, verification and precedence. Mechanism: `docs/DESK.md`; statements
site `docs/STATEMENTS.md`; products `docs/PRODUCTS.md`; design `docs/DESIGN.md`; the fold
`docs/CLOUD_FOLD.md`; landing, the suite and instrument traps `docs/WORKING.md`; superseded
reasoning `docs/NOTES.md`. The dated record is `master/changelog.json`, never here. No flourish, and never the word the suite bans (write "costly" or the figure), in files,
code and copy.
**THE HARD RULE NUMBERS ARE LOAD BEARING.** Rules 1 to 8 are cited by number from code, the suite
and the `update-names-id` skill. Reorganise within a rule; grep `rule [0-9]` before touching the list.

The Salt Command desk as a cloud app: the ledger and the pricing engine on the go, a transaction
addable from the phone. **This repo holds the master**, deployed as a Cloudflare Worker (URL in
MEMORY.md); `/desk` is the one surface, and "the dashboard" means `/desk` at desktop width. Behind
a Cloudflare Access login, his decision of 05 Oct 2026, and the Worker's own check (below).

## Hard rules

1. **The master is `master/salt_command.html`. Never hand-edit `public/desk.html`**, a committed
   build output. Four blocks in the master are GENERATED and CI fails if one differs from its
   source: `ENGINE` (`engine/pricing.mjs`, `position.mjs`, `qr.mjs`; `node tools/engine.mjs
   --sync`), `BOOK` (`ledger/book.json`; `tools/booksync.mjs --sync`), geography (`geo/*.json`;
   `tools/geosync.mjs --sync`), `DESIGN` (`design/salt-ds.css`, `design/desk.css`, fonts;
   `tools/designsync.mjs --sync`). Edit the module, sync, build. **`evolution` holds ONE entry,
   the current version, and a bump replaces it**: `tools/changelog.mjs` copies `evolution[0]` to
   `master/changelog.json` first, and the gate refuses a master whose version the changelog lacks.
   **A fold edits `ledger/book.json`, never rows in the master**; write it with `writeBookFile`
   (one row per line), then `node tools/ledger.mjs`. Nothing outside the master prices anything:
   two engines drift. A view never changes a pricing rule; report it.
2. **Plaintext names never reach the cloud; the encrypted vault may.** `/bio` is answered but
   dropped; `/vault` syncs only the AES-GCM envelope `{v,salt,iv,ct}`. `10_Data\salt_bio.json`,
   `salt_vault.json`, `menu_secret.txt` and the queue files stay in the project folder. The suite
   searches the public desk, comments and version notes included, for every directory name and
   place: illustrate with codes and invented words.
3. **Visibility follows the Actions minutes**: private while Pro's 3,000 a month last, public when they
   run out (his decision of 10 Oct 2026). It carries the real trading ledger; no real name, key or
   password is ever committed, in any form, hashed included.
4. **No third-party loads at runtime.** Inline CSS and JS, no CDN; the build fails on an external
   `src`, `url(` or `@import`. CSP is self-only. Salt Admin and Salt Counter carry no font (Ambient
   draws in each device's own face, since v1528, 17 Nov 2026); the Desk keeps Newsreader and Geist
   Mono, self-hosted from `Code\salt-ds\src\fonts`, until its own move.
5. **Copy and price.** Detail in `docs/DESK.md`.
   - **RM and unit only.** The goods are **inventory** in copy; **Stock** is the rail's
     destination, `Stock cover` and the `Stock count:` line. New identifiers say `Units`, never
     kg. Copy is terse: noun-phrase headings, the number first. Dated records (the Journal,
     sealed issues) are never corrected in place.
   - The price mechanics (COGS, the Floor, the Median Price, Their %, partners, rewards, loyalty unit): `docs/DESK.md`, "Moved from CLAUDE.md, 19 Nov 2026".
6. **The look is the Salt design system applied as a layer.** **THE MOVE TO AMBIENT** (`docs/plan-ambient-move.html`, his answers of 14 Nov
   2026): the surfaces move one at a time onto `Code\ambient-ds`, Salt Admin first, then the Counter, then the Desk. Salt Admin and Salt
   Counter moved together as v1528 (17 Nov 2026) and draw only Ambient's parts and the site layer `design/site.css` (tokens only), light and
   dark following each device; the Desk keeps salt-ds, and the rest of this rule (Night and Tide, the recipes, `design/desk.css`) is the
   Desk's alone until its own version. Ambient is carried in `design/ambient/` by `tools/ambientsync.mjs` (`--pull` from a clean, pushed ambient-ds main;
   `--check` against `tools/ambient.lock.json`, in the gate and CI, and failing on this laptop once ambient-ds main moves on: pull, then
   `node tools/stmt-style.mjs --sync`); a part Ambient lacks is added there, never drawn here. **A design change he gives goes to the system its surface draws on, unasked** (his word of 18 Oct 2026):
   Ambient for Salt Admin and Salt Counter (the move above); until each moves, `Code\salt-ds` first, then the Desk and QR Command in the same
   piece of work: salt-ds's `npm run propagate` and its `CLAUDE.md`; `node tools/designsync.mjs --drift` says whether `design/` is
   still the salt-ds checkout's. Material, type and colour are
   decided in `design/desk.css` over the vendored `design/salt-ds.css`: edit there, `--sync`,
   build, never a hex in the master's older layers. Chart series read the identity's hexes
   directly (`salt-ds/src/tokens.ts`), so a palette change is two places; product hues are
   `PRODUCTS.accent` in `ledger/book.json`. **THE RECIPES ARE USED, NOT RESTATED**: markup carries
   the system's class beside the desk's own, `design/desk.css` holds no rule for a migrated
   recipe, and a colour the layer needs is a token in `Code\salt-ds` first, pulled by
   `designsync --pull`. The remaining geometry (ghosts, fields, tables, tiers, product bands,
   actions) migrates in one version, one commit per group (his word of 09 Oct 2026). **Two themes,
   Night and Tide, chosen per device, and Tide until one is chosen** (his word of 11 Oct 2026): Night
   is the design system's `:root`, Tide its `:root[data-theme="tide"]`, set on `<html>` by a head
   script from localStorage `salt-look` before the first paint, with a choice sheet over a device's
   first open and a switch in the rail. **Tide is off for now** (his word of 19 Oct 2026): every
   surface opens Night whatever the device kept, the Tide button is greyed, no choice sheet opens,
   and the store and Tide's tokens are kept; the Tide checks are parked behind `TIDE_OFF` in
   `test/tide-off.mjs`, and turning it back is those guards and the lines marked 19 Oct 2026. The four times of day, `salt-time.js` and the clock's picker
   stay retired, and the suite fails if any returns. A colour in the desk's own CSS is a token, never
   a literal, with its Tide value in `design/desk.css`, and every text colour holds 4.5:1 on each
   theme's ground and slate, which the suite measures (`docs/DESIGN.md`). QR Command takes salt-ds through its own
   `tools/designsync.mjs`. **A tap target is 44px in both dimensions**, settled by a hit test.
7. **Git: never from a mounted sandbox**: it leaves `.git/*.lock` and `tmp_obj_*` behind and
   silently blocks every later commit. **A native Windows Code session may run git.** After
   committing, verify `git rev-list --count origin/master..HEAD` and that no lock files remain;
   `node tools/update.mjs` does both. Clean-up after a mounted session:
   ```
   Get-ChildItem .git -Recurse -Include *.lock,tmp_obj_* -Force | Remove-Item -Force
   ```
8. **Three deployers, and only the Actions job does the whole job.** `cloud-commit.yml` gates,
   deploys, proves the phone serves the build, marks the folded rows committed, re-seeds the D1
   mirror, publishes the statements and deploys the Counter in job `chain`, which holds the lock;
   then job `suite` runs the suite on the sha chain proved, outside the lock, **unless CI already
   passed it on that tree**: a ci.yml run whose `verify` and three `tests` parts each passed, on a
   commit with that tree holding every parent of it (`tools/suite-proved.mjs`, chain's last step), so
   a merge level with master stands it down and a fold, a merge master moved under, or any doubt runs
   it; the run's summary names the CI run that proved it. **The statements
   publish runs on every run but the `probe_key` dispatch**: the rule names what is excluded,
   never a list of triggers. A run that did not deploy passes `--no-retire`. **A publish follows a
   change, not the clock** (his choice of 10 Oct 2026): a version moves `public/rev.json`, and that push
   publishes; a desk write outside git (`/expected`) marks KV `publish:wanted`, and the desk's minute
   cron sends one `stage_only` dispatch for it, five minutes apart at most, as it does once each Kuala
   Lumpur day between 00:05 and 03:00 MYT; GitHub's schedule, four a day, is the net. A dispatch names
   its `reason`, the run's name and nothing else. `tools/update.mjs` is the laptop
   half and publishes no statements. **Every desk deploy deploys the Counter.** **Cloudflare
   Workers Builds deploys the tip of master and stops**: it never folds, marks or writes D1 or KV,
   and its failure is SILENT. Its build command is `npm ci && node tools/gate.mjs`, then `npx
   wrangler deploy`. Actions runs only on a push touching `public/rev.json` or the statements
   paths. A `src/*.js` or master change moves `rev.json`'s id and the gate refuses it unbuilt, so it
   carries the rebuilt `public/` and runs Actions too; only a push touching neither (docs, tests,
   most tools, `public/_headers`, `wrangler.jsonc`) ships through Workers Builds alone. **Read
   its config back through the Cloudflare API**, never the dashboard or the MCP builds tool
   (`docs/DESK.md`). Never point anything on the laptop at `salt_sync.ps1`: a fourth deployer.

## The one surface

What the desk shows, its destinations, notifications, Add ID, Coverage, refunds, undo, the reorder point and the five books: `docs/DESK.md`, "Moved from CLAUDE.md, 19 Nov 2026". Retired surfaces: MEMORY.md.

## The chain: tap to deploy

The chain from tap to deploy, step by step: `docs/DESK.md`, "Moved from CLAUDE.md, 19 Nov 2026".

- **Every task starts level with GitHub.** Before any task: `git fetch` and fast-forward to
  `origin/master`; wait out any Actions run in progress or queued (`gh run list`) and any approved
  row not yet folded (`node tools/drafts.mjs --approved`); fetch again. Check `ListAgents` (CLI) or `list_sessions` (desktop app) for
  another session on this checkout and work in a worktree (`docs/WORKING.md`). Uncommitted files
  may be his or a peer's: ask, never sweep them; stage explicit paths, never `git add -A`.
- **A version asks about the queue first.** Before any bump: `node tools/drain.mjs --status`,
  `node tools/drafts.mjs --list` and `--approved`, `git fetch` for a staged `_to_fold.json`. Ask
  him one line per pending item; never approve for him; fold anything approved into that version.
  **Take the number last**: suite on the unbumped tree, then fetch, bump off origin's tip,
  changelog, build, gate and push within a minute, because a phone approval folds as the next
  version. Re-landing after origin moved: `docs/WORKING.md`.
- **Every tap that books money checks what its row can still take** (`rowRoom` in `src/orders.js`:
  the mirror's figure less every payment on its way to the row by any road), **and the fold's
  `payFault` is the last check**, refusing a payment measured before other money reached its row.
  A new road for money reads both. Detail: `docs/STATEMENTS.md`.
- **A change to `cloud-commit.yml` never tests itself**: it is not on its own push paths. Dispatch
  a run by hand and read the step list, since a skipped step is green too. After any push read the
  run's annotation: a billing refusal looks like an ordinary red run.
- Endpoints: see MEMORY.md. Nothing writes to `entry`. **The `draft` table's CHECK lists every
  collection by name**: a collection the drafter newly returns needs a migration rebuilding it,
  applied to the live D1 BEFORE the deploy and as that file alone (`wrangler d1 execute salt_ledger
  --remote --file=...`); re-running an older one drops rows, and a rebuild drops the newest
  migration's indexes, which must be created again (migrations to date: MEMORY.md). The drafter
  reads its queue's ids by primary key, never the whole table.

## Sync and proof

- How the phone polls, what `rev.json` is, how a deploy is decided and what `ci.yml` checks: `docs/DESK.md`, "Moved from CLAUDE.md, 19 Nov 2026".
- **"Update" means `node tools/update.mjs`, the whole chain, with no step left for him**: drains (a
  pull only), reports both queues, mints any missing account, builds, tests, deploys on an id
  change, commits, pushes, then proves master, `rev.json`, live `/rev` and origin agree. An idle run
  (one id built and live, a stale record written down, the tree clean and level, nothing queued) prints nothing to ship
  and skips the suite, deploy and commit; `built` moves only with the id, so no stamp is left to commit. **A tree
  behind origin stops it dead** (`aheadVerdict` in `tools/preflight.mjs`); `--no-push` still
  deploys, so only `--dry` touches nothing. Also `--no-deploy`, `--no-drain`, `-m`. It never folds.
  The replay check refuses to ship while an entry above `QUEUE_COMMITTED` matches a ledger row by
  date and total; `--force-ship` after reading the rows. It commits whatever is in its checkout
  and cannot finish from a worktree: run it in the main checkout, quiet and level.
- Never pipe the gate, the suite or `update.mjs` into `tail` or `grep` inside an `&&` chain: the
  exit becomes the pager's. Redirect to a file and check `$?`.

## Names

The vault, names and places, accounts on day one and the Names and ID route: `docs/DESK.md`, "Moved from CLAUDE.md, 19 Nov 2026".

## Access, two locks; the write gate

The two locks, the write key and withdrawing a queued entry: `docs/DESK.md`, "Moved from CLAUDE.md, 19 Nov 2026". `REQUIRE_ACCESS`: MEMORY.md.

## Statements site

`stmt/worker.js` and `stmt/page.js`: a second Worker on its own cryptic address, KV store and order book,
config `wrangler.stmt.jsonc`, every command taking `-c`. Nothing under `stmt/` imports from `src/`,
`tools/` or a node builtin; the suite checks. `statements/_secrets.json` is laptop only and
gitignored; lose its key and every account is re-issued. `stmt/page.js` `CLIENT_JS`, `stmt/owner.js`
and the send sheet in `tools/stmt-send.mjs` ship inside template literals: no lone backslash, use
`[+]` and `[/]`, and no backtick, even in a comment. Mechanism for everything below: `docs/STATEMENTS.md`.

- **A change to the statements Worker covers Salt Counter and Salt Admin together** (his word of 20 Oct 2026): every
  batch maps each item onto `stmt/owner.js` too, its look and his side of the feature, or says why it has none.
- **The site address is never in the public desk.** No address, no QR drawn.
- **No brand on the customer's page, and no product word either.** Nothing under `stmt/` names
  Salt Command. A product is a mark (`PSYM`) carrying a letter of his (`PLET`): every coin of 44 px and
  over carries it inside its shape, cut out in the coin's ground (his word of 22 Nov 2026, Ambient 0.7.34; it retires
  the 44 px coin as the shape alone, his answer of 17 Nov 2026), but every 36 px coin (and three letters at 44 px, none since gas became P on 25 Nov 2026), which
  are the shape alone (Ambient draws no letter under 12 px), and every plain mark of 20 px and over carries it; it names nothing. A control holding only a mark is named by its shape
  (`PSHAPE`), never its product. **The one name on the site is the app's, `Salt Counter`**, twelve
  characters, which is what iOS gives a home screen; the desk's name never appears. **A customer never
  sees a level**, named or marked (D11); no name is used because none exists there (rule 2).
- The order's stages, messages, slips, the pay page, links, test accounts and guest links: `docs/STATEMENTS.md`, "Moved from CLAUDE.md, 19 Nov 2026".

## Files that carry a rule

| Path | Rule |
|---|---|
| `engine/qr.mjs` | The ONE QR encoder (byte mode, level M, versions 1 to 10), inlined into the master; `tools/qr.mjs` re-exports it; `qrRectSvg` draws RECTANGLES, a stroked symbol does not scan |
| `stmt/qr.js` | GENERATED from `engine/qr.mjs` by `tools/qrsync.mjs --sync`; never edit it |
| `stmt/send.js` | The one copy of the words a customer is sent; the sign-in message is English only |
| `stmt/testsurface.js` | The shell; the views are `landingPage`, never a copy |
| `stmt/words.js` | Every word the Counter shows, by key; a customer's refusal is `e.<code>` there, answered `{error, code}` by `refusal()`. English is the only table (`WORDS = { en: EN }`); no language switch, no `LIVE`, no `salt-lang`, no `/lang` Cache entry |
| `stmt/signin.js` | The one-time link; the two limits it cannot promise away are in its header |
| `tools/stmt-seal.mjs` | Laptop only: seals an issue's passwords under the master, proving each; pairs a re-keyed code by proof |
| `tools/stmt-account.mjs` | Laptop only: mints the account for a roster code with a username and no record, never touching an existing one; `--pool` tops up the spare accounts (`tools/stmt-pool.mjs`) |
| `tools/foldnotes.mjs` | The fold's prose with no model: same notes object, same `checkNotes`, no judgement; `scrub` makes the API error safe |
| `tools/preflight.mjs` | `aheadVerdict`: level, warn or STOP; `idleVerdict`: nothing to ship; outside `update.mjs` so the suite can drive it |
| `tools/d1json.mjs` | The one reader of `wrangler d1 execute --json`, failing closed: a refusal, a non-zero exit or a statement with no `results` is an error, never an empty list |
| `tools/rid.mjs` | Stable `rid` per ledger row; `nextRid` is the one minting place |
| `tools/changelog.mjs` | Prepends `evolution[0]` to `master/changelog.json`; never rewrites |
| `test/verify.mjs` | No network or browser; one assertion per behavioural change, **proved red by mutation before its green is trusted**, each on its own |

The rest: `docs/DESK.md`.

## Working on it

```
npm install        # once
npm run build      # master -> public/desk.html, after any master edit
npm run dev        # build, then wrangler dev (live KV)
npm test           # THE DEFAULT full run (his word of 12 Nov 2026): the suite split across the cores less one, fifteen here (tools/suite-split.mjs; his word of 16 Nov 2026, the whole machine), 5.5 minutes (measured 16 Nov 2026); one run at a time; CI runs it too
npm run test:serial  # the same suite in one process, 21 to 27 minutes here (measured 12 Nov 2026); 4 GB heap. Only to rule out a cross-process fault
npm run deploy     # build, then wrangler deploy
node tools/update.mjs
node tools/standing.mjs   # the standing-state table a task closes with, about 11 s (one KV bulk read, 20 Nov 2026)
```

Grep `docs/TRAPS.md` before a tool's first use in this repo.

Each build patch is anchored on one unique line; a moved anchor aborts. First-time Cloudflare and
local tools: `docs/DESK.md`. Close every task with the seven-line standing-state table (shelf, live
credit, written off, pending orders, undated rows, queue and drafts and staged, tree), printed by
`node tools/standing.mjs` from the engine in an `openMaster` window, never by hand (`--offline`
skips Cloudflare and the fetch).

Work here may have moved on in the GitHub Copilot app. Before a task, check
`~\.copilot\session-state\*\workspace.yaml` for a session whose `cwd` is this repo or one of its
worktrees and whose `updated_at` is newer than the latest Claude transcript here; if there is one,
read its `events.jsonl` from the end (the last `user.message` and `assistant.message`) and its
`plan.md` if present, say in one line what Copilot did, and carry on from there. Copilot's
worktrees sit in `.worktrees\`, Claude's in `.claude\worktrees\`.

## Sessions, landing and replies

- **Archiving** (his words of 10 and 25 Oct 2026, "no sessions are archived after a PR request is completed"): when a lane lands
  all it carries, the moderator renames it to start with `999` and says ready to archive; never `archive_session` unless he asks
  for that session. The app's auto-archive on PR close is off.
- **Turn numbers** (28 Sep 2026): a moderator prefixes each session title in its group with its place in the landing queue
  (`0` the moderator, `1` the turn holder, then the queue, then lanes with no landing); rename with `set_session_title` in the
  turn the queue changes.
- **One build at a time** (his words of 12 Oct 2026, "complete one build at a time"; amended 13 Oct 2026: wholly independent
  builds may run at once, each in its own worktree). Fable reviews only changes touching money, payment data, the Worker's
  routes or the Desk master.
- **Re-merge only on overlap** (09 Oct 2026): before merging, compare `git diff --name-only` of base..origin/master with
  base..head; no shared file and no version bump merges as built (`--match-head-commit`), a shared file or a bump re-merges once,
  when the moderator calls it. Phone folds touch only `ledger/*`, `master/*`, `public/desk.html` and `public/rev.json`.
- **Recycling a landed worktree** (his standing yes of 09 Oct 2026): `git status --porcelain` empty and either an empty
  `git diff --stat <branch> origin/master` or `git cherry origin/master <branch>` with no `+` line; unlink the `node_modules`
  junction with `[System.IO.Directory]::Delete(path, $false)`, recycle, `git worktree prune`, `git branch -D`, delete the remote
  branch. Anything with a diff goes to him.
- **CI stays not required** (his decline of 14 Oct 2026): the fold pushes straight to master; do not re-propose. GitHub
  auto-merge cannot work here, so hand him `gh pr merge` as a command; `maakmal97/salt-ds` allows squash only (`--squash`).
- **After handing him a command, read his Terminal panel** with `read_terminal` and `wait_for_output_ms` in the same turn, and
  act on what it shows (his words of 29 Sep 2026, "always read terminal if you ask me to"); polling origin or runs instead does not count.
- **A waiting session card is resent as is** (his word of 19 Oct 2026): dismiss and re-propose it, same brief, as the last call of
  each turn, from the `card-<name>.json` saved beside the work when first proposed; stop once he starts or declines it.
- **Board updates ask nothing** (his word of 30 Oct 2026, "I don't want the task to update board to be requiring attention from
  me"): "update the board" means the Salt progress board and the Book DO board. Run `board_facts.py` (12 to 15 minutes, say so),
  edit DATA in `build_board.py` and the Book board body, run both builders, publish both (a stale refusal: publish again), then
  `wrap_up` as a recap only, no ask, no buttons. A finding that needs him is one plain line. Scripts: `System\Code\Artifacts\salt-progress-board`
  and `landing-salt-command-work-board`; the Book DO board is on Ambient only.
- **Design fixes are tested on every surface and width** (his word of 16 Nov 2026): Desk, Admin, Counter and QR where it shares
  the design, at 390 (touch), 1180, 1440 and 1920 in Chromium; measure the property on each and report the matrix.
- **A display-only push greps `test/`** for every class, id and phrase the change removes, renames or reuses, and runs each
  section that names one (18 Oct 2026: two unlisted sections went red after a rail foot was removed).
- **PRs are named by number and title** (10 Oct 2026): "#64 (Drafter refuses an impossible calendar day)", the title read with
  `gh pr view N --json title`. **A version update is told by what it changed** (his word of 30 Oct 2026): the changelog entry's
  `n` as a short list in the closing message, with what is not yet live.

## How a fold is sized

- **One version, many commits** (his word of 09 Oct 2026). A piece of work ships as one version, one
  commit per part; a commit that cannot be described in one sentence is two.
- **Sweep the class before shipping a fix.** Grep the pattern across the whole file first.
- **A round points at the newest code.** Attack the fix; older code is regression only.
- **An instrument is proved red before its green is trusted**, each mutation on its own. Reading
  source text, or checking inputs computed by the code under test, does not count; a vacuous check
  and a true one are identical in a green run. Before writing an assertion or measuring the desk,
  read `docs/WORKING.md`.
- **Run independent steps in parallel**: the suite in the background; master mutations at once on
  `SALT_MASTER` copies; tool-file mutations one at a time.
- **A display-only change pushes on its touched sections plus the gate** (his yes of 18 Oct 2026): markup and CSS of
  what the desk or the Counter shows, touching nothing that prices, books, folds, routes or holds money. Each new
  check is proved red (`tools/section.mjs --mutations`), the sections it touches pass, the gate is OK, and CI's suite
  on that push is the full check, read after. Anything else runs the full suite, and a green one pushes and
  merges (his words of 09 Oct 2026: "When suite green, ready to merge, automatically merge pull and deploy"; the
  moderator merges, and pauses after every round to report). Both standing yeses are granted in root `CLAUDE.md`
  section 7.
- Write the guard's time as `YYYY-MM-DDTHH:MM:SSZ`, no milliseconds.
- Trap: a code line that a mutation needle names (here `delivery-yes.mutations.json`) breaks "every mutation needle still finds"; grep `test/*.mutations.json` for a changed code line, not only the words.
- Trap, cause unverified: `tools/section.mjs "v453..." --mutations <file in the scratchpad>` ran its UNMUTATED pass against what read as the mutated master and refused; the same mutation proved red by hand with `--master <mutated copy>` against a passing `--master <plain copy>`. Keep a section's mutations file under `test/`, or prove by hand that way.

Current facts are in `MEMORY.md` beside this file, searched rather than loaded whole (his decision of 17 Nov
2026: it is too long to send with every prompt). Before the first action, read it from the top down to `## Known
red in the suite` (the Worker, fold dispatch, Access, migrations and known reds every task leans on), list its
headings (`grep -n '^## ' MEMORY.md`), read each section the task touches, and grep it for any name, id or
version the task mentions. Release records are in `master/HISTORY-from-MEMORY.md`, searched only for what one version did.
