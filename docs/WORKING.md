# Working on the repo: landing, the suite, and instruments that lie

`CLAUDE.md` carries the rules; this file carries the practice behind them. Every item is a trap
that cost real time. Read section 3 before writing an assertion and section 4 before quoting a
measurement of the desk.

## 1. Landing and the shared tree

- **Master has three writers and no lock.** His laptop's sessions push through `tools/update.mjs`;
  the cloud fold pushes as `salt-command fold`; another clone or app of his pushes under a
  different author spelling and skips the sync tools. Branch protection and rulesets return 403 on
  his plan, so a pull-request gate would be a habit, not a lock.
- **A start-of-session `git status` is stale within minutes.** Tells of a peer: an untracked
  `master/_to_fold.json`, a `LAST_UPDATED` newer than HEAD, a file modified that was clean at the
  start (`stat -c '%y' <file>` against the clock). Before any version, `list_sessions` for a
  running session on this checkout; if there is one, `ListAgents`, then `SendMessage` two
  questions only: are these dirty files yours, and will you build, run the suite or push. A
  failure in code that is dirty in `git status` is a peer question first and a bug second.
- **Work in a worktree.** `git worktree add .claude/worktrees/<name> -b <branch> HEAD` (or
  `origin/master`, chosen on purpose: the `fresh` default branches off origin and drops local
  commits), then `New-Item -ItemType Junction -Path <wt>\node_modules -Target <repo>\node_modules`.
  After `ExitWorktree` every edit lands in the shared tree: before going quiet, `git switch -c
  <branch>`, commit explicit paths, `git switch master`. `update.mjs` cannot finish from a worktree
  (a bare `git push`, and it reads `.git` as a folder): copy the source files to the main checkout
  and run it there, or push by hand with `git push origin <branch>:master`.
- **Never `git add -A` in a shared tree, never `git reset --hard` to tidy.** If a peer's unfinished
  commit is on master, revert it forward. Merge `origin/master`, never the shared local master: an
  unpushed commit in a shared `.git` is not private, and its author may still be deciding about it.
- `.claude/launch.json` is tracked: never edit it in a worktree; restore it with `git checkout --`.
- **Removing a worktree:** unlink the junction first (`cmd /c rmdir <wt>\node_modules`), check for
  uncommitted files and for a HEAD not in master (`git log -S` finds a superseded copy under another
  sha), then `git worktree remove`. A lock naming a dead pid is stale: `git worktree unlock`.
- **Old branches:** only master remains since 14 Sep 2026; superseded tips are LOCAL `archive/*`
  tags, never pushed (`git tag -l 'archive/*'`), then `git log -S` on master.
- **Re-landing after origin took the number.** A phone approval folds within a minute as
  `evolution[0].v + 1`, and the fold wins. `drafts.mjs --list` does not show approved rows;
  `--approved` does. Keep patches as scripts of exact-string pairs, each `once()` throwing on a
  missing or doubled needle, and suite sections as files. To land: commit the worktree state to a
  WIP branch; `git checkout -B <branch> origin/master`; take untouched code files whole (`git
  checkout <sha> -- <files>`, after `git diff --stat <base> origin/master -- src stmt tools` shows
  origin did not touch them); re-run the needle scripts on the master; lift the suite sections by
  title; then sync, bump under the next free number, `changelog.mjs`, build, gate, red proofs,
  suite, `git push origin HEAD:master`. Never a textual rebase of the master: its generated blocks,
  `evolution`, `LAST_UPDATED`, `changelog.json`, `ledger/*.json` and `public/` conflict every time
  (take the fold's side and regenerate). Refused at the push: `git reset --hard origin/master` on
  your own branch, `git diff <base> <commit> -- <files> | git apply --3way`, re-bump, gate, push.
  A running cloud job pushes again when it clears `_folded.json`: wait for it first. A run whose
  job `suite` alone is still going pushes nothing more; that job only reads the repository.
- **Another clone's push skips the sync tools.** When origin moves with a commit that is neither the
  laptop's nor the fold's, run the four checks first (`engine.mjs`, `booksync.mjs`, `geosync.mjs`,
  `designsync.mjs`, each without `--sync`) and offer the sync as its own version: until it lands,
  the Fold step's gate refuses every approval. Read the committer with `gh api
  repos/maakmal97/salt-command/commits/<sha>`.
- **A finding expires when its branch moves.** Quote the commit you measured; re-run any
  "uncovered" claim, a peer's or your own, on current HEAD, assertions included. `git log -S
  "<assertion text>" -- test/verify.mjs` names the commit an assertion arrived in.
- **Parallel view passes** (one session per view, each in a worktree off one base, a fold session
  merging): views edit the master only; never `evolution`, `LAST_UPDATED`, `changelog.json` or
  `public/` (`git checkout -- public/` after every test run); never build, deploy or push; own port
  each; no invented version tags; merge master before each commit. Check an agent's commit did not
  sweep its scratch folder. After a fleet-wide kill, relaunch fresh agents rather than resuming
  them: a resumed agent can land in a sibling's worktree. Measure the coordinator's figures before
  acting on them. A figure lives once per VIEW: delete a restatement only when the other statement
  is in the same view, and reverse an edit a standing assertion contradicts.
- **`git stash` against the pristine tree** fails on the pop, because the suite rewrites
  `public/desk.html` and `public/rev.json`: `git checkout -- public/desk.html public/rev.json`,
  then pop. A worktree is better.
- **When Actions is refused** (billing: the run ends in seconds with no steps; `gh run view <id>`
  shows the annotation), Workers Builds still ships the desk, but nothing re-seeds D1, marks rows,
  publishes or runs the suite. By hand from a checkout at the pushed tip: `node tools/ledger.mjs &&
  node tools/d1.mjs --seed`; `STMT_KEY=<the key in statements/_secrets.json, read into the
  environment and never printed> node tools/stmt-publish.mjs --no-retire`; a `stmt/` change also
  needs `npx wrangler deploy -c wrangler.stmt.jsonc`. Once it clears: `drafts.mjs --approved`, then
  `gh workflow run cloud-commit.yml` to stage what the refused dispatches left. Billing is his.
- **`gh run list --commit <short sha>` matches nothing**, and a watcher on it exits 0: filter
  `headSha` with `startswith`, watch by run id, and treat an empty id as the watcher failing.

## 2. The suite

- **Split, the default** (24 Sep 2026, his instruction). `npm test` (`tools/suite-split.mjs`) runs the same sections in shards beside `test/verify.mjs`: the build and the `test/tmp` wipe first and alone, sections sharing a fixed `test/tmp` folder in one shard, the rest packed by last run's timings. A runner has none, so it packs by `test/suite-costs.json`, the laptop's timings by section title, committed: refresh it with `node tools/suite-split.mjs --write-costs` after a full run here; a section it lacks is costed by its length. CI asks for three shards (`--jobs 3`); the tool runs no more than the cores less one. About 1 min 45 s from 6 to 8 processes on this laptop; 12 is slower, the three heaviest sections (about 30 s each alone) stretching past 70 s under load. A section needing top-level state outside its own block would break it: keep every section self-contained.
- **Shape.** `npm run test:serial` is `node --max-old-space-size=4096 test/verify.mjs`, 2 to 7 minutes, the one-process road. Each
  section body is `await (async () => { ... })();`, because a top-level block stays pinned for the
  whole run; `section()` closes every window in `payload.mjs`'s `opened` set synchronously, because
  the suite starves the event loop and a timer-based close never runs. A script using `openMaster`
  outside the suite must `opened.clear()`. A section driving the Workbench waits about 200 ms
  before `w.close()`, or the record's own save answers into a closed document. Probe the heap by
  forcing GC per section, never by reading `heapUsed` raw.
- The suite rewrites `public/desk.html` and `public/rev.json` and drains the live KV: restore
  `public/` from HEAD afterwards.
- **One section on its own**, for red proofs in seconds: a scratch script slices `test/verify.mjs`
  from `section("<title>` to the next `section(`, rewrites `import("../` to the repo's file URL,
  and runs it through `new AsyncFunction(ok, section, skipData, REPO, readFileSync, execFileSync,
  spawnSync, createHash, dirname, join, resolve, block)`. The suite's helpers (`KV`, `assets`,
  `req`, `mkEnv`) come from slicing `class KV {` to the end of the `const req =` line; import the two
  Workers yourself; resolve `jsdom` through `createRequire(REPO + "/package.json")`. Restore an unset
  variable with `delete`, never `= undefined`, which stores the string. A ReferenceError is the
  runner's, not the code's. Run the full suite once before every push regardless.
- **Mutations.** One mutation per run, but runs may overlap. Master mutations go to their own
  copies, run with `SALT_MASTER=<copy>`; a section that reads the master straight off disk will not
  see the copy. Tool-file mutations edit the shared checkout: one at a time, restored byte for byte
  in a `finally`, never while the full suite runs. Check that each mutation actually changed the
  text.
- **Attributing a red suite after a cloud fold:** swap only the book. Run the section on today's
  `ledger/book.json` and on `git show <last green>:ledger/book.json`, same code, same clock.
- **jsdom has no canvas**, so QR, PDF and JPEG output is proved in the Browser pane by reading the
  bytes back: QR modules read at their centres against `qrMatrix`; a PDF's `startxref` landing on
  `xref` and every table offset on its own `<n> 0 obj`; a JPEG's `FFD8` and `FFD9`. A screenshot
  proves nothing. From jsdom 30.1.0 a closed window keeps its document: prove `close()` by the
  timers it stops, with an open window as the control.
- **Declaring things to the extract.** A new top-level object or array const in the master fails
  the extract until it is added to `NOT_LEDGER` (configuration) or `LEDGER_KEYS` (the book) in
  `tools/ledger.mjs`. A date field is drawn with `dateIn(id,val,attrs)`: the suite allows one
  `type="date"` writer. Area paths keep the `<path class="marea` prefix. A suite driver that types a
  place into Add ID or Amend ID sets `WB_GEO` first, or Record refuses; swap the gazetteer with
  `GAZ_INDEX=gazDecode(packed)`. `tools/gazfetch.mjs` overwrites `geo/gazetteer.json` unless given
  `--out`.
- **A tool that gates a deploy asserts its own ok lines when run as a child.** Copy the `isMain`
  line from `tools/fold.mjs` (`pathToFileURL(process.argv[1]).href`): a hand-built `file:///` check
  is false on the Linux runner, and the tool silently does nothing and exits 0.
- **`tools/d1.mjs --verify` cries wolf**: `PRICING.takenAt` and `OPEN.at` are minted per extract.
  Use `--status` (version, record count, seed time) and spot-check a value the fold changed. D1
  reads go by `--command`; `--file` returns a summary with no rows.

## 3. Instruments that lie

Each of these stayed green, or read clean, through a real fault.

- **An assertion that cannot fail.** A double-escaped entity (`&amp;amp;`); a regex built from a
  string across a shell boundary, where `'\b'` is a backspace; a pattern inserted by heredoc; an
  ordering check where `indexOf` returned -1 (anchor on something the same assertion proves present,
  and assert both indices are at least 0); `JSON.stringify(NaN)` crossing as `null` (ask inside the
  window, let only booleans cross, and carry a control). Build patterns from a regexp literal's
  `.source`. Run every new assertion against `git show HEAD:<file>` and the working copy, and see it
  red.
- **The wrong position.** An effect assertion sited before the step that undoes the effect, or after
  a branch that skipped it, stays green: a KV key written, then deleted by the next workflow step
  keyed on a shared prefix; a diff against a base that a depth-1 checkout lacks, failing into
  `2>/dev/null` and answering "no". Site the assertion where the effect must survive; make an
  unreadable input fail safe by defaulting to the idempotent work. Prove workflow bash by running
  the extracted block with stubs.
- **The wrong quantity in the right words.** A census that read only `under` reported "every price
  clears break-even" over a board printing its tiers the wrong way round. Worse than silence: it
  reassures.
- **Coupled to the calendar or the book.** A second calendar-driven red in one block means the
  assertion is over-specified: cut it back to its stated intent, and age a proposed fix forward
  (hold TODAY, move the rows). Force the state you prove inside the test rather than waiting for the
  book to supply it. Over the live book pin the rule, never a day's figures: name the rids a
  one-time restatement touched (read them off `git show <sha>:ledger/book.json`), and express a
  position as a difference (drop the row, recompute, assert what moved). The hourly runs run no
  suite, so such a red stays red until the next fold or push.
- **Fixtures.** Bare `{date, customer, qty, total}` rows read as Pending under `txStat`: a completed
  fixture carries `cash: total, deliveredQty: qty`, and `pricedOrder` or the drafter's filter is
  never loosened to pass one. A fixture wider than production proves nothing: push tests used
  subscriptions with no topics while every real phone named one, and two of three wakes were dropped
  for five days under a green suite. Build a fixture from the shape the live store holds. A mutation
  that will not go red usually means the fixture shares the code's assumption.
- **What the code computed against what it wrote.** Drive real builds and compare bytes: an
  assertion on the printed build id passed while `rev.json` took a fresh timestamp on every build.
- **Counters.** A `/* */` comment inside a returned template literal renders as page text. A
  multiset figure delta hides a figure that left the page: diff the distinct figure sets.
  `innerText` is empty inside a closed `<details>`: use `(e.innerText||e.textContent)`, and re-run
  the probe on the pristine baseline before reporting a regression. `grep -v X | grep -n` numbers
  the filtered stream, not the file. gawk reads `\b` as a backspace. A reader map that skips a line
  range as "generated" is a hole.
- **v466 is a text heuristic**: any `overflow-x:auto` rule above the ledger's `.lcards` rules with
  no `@` between them fails "four-figure minimum width". Put such rules below the 560px phone block.
- **The units scan** fails any new identifier containing kg outside the five persisted keys
  (`settledKg`, `rebateKg`, `refKg`, `costPerKg`, `valueKg`).
- **The leak scan never prints the word it found**: find it by elimination, and measure hit counts
  only.

## 4. Measuring the desk

- **Serve the built desk**, or the master with `public/` as its asset root: Chart.js is vendored at
  `public/assets/chart.umd.js` and loaded lazily, so a bare master collapses every `.chartbox`
  (Today measured 488px low). Prime a charted part and confirm `typeof window.Chart === "function"`
  before quoting a height. Pass `--directory` explicitly to `python -m http.server`.
- **From a worktree the Browser pane serves the MAIN checkout**: `preview_start` runs the main
  `launch.json` with the main repo as its working folder. Add a temporary entry there with an
  absolute `--directory`, then restore the file from `git show HEAD:.claude/launch.json`; or prove
  the change in jsdom (`openMaster()`). A service worker on `localhost:8790` persists across
  sessions: unregister it and clear its caches. Assert that the served build id (`evolution[0].v`,
  `SALT_BUILD_ID`, `/rev.json`) is the one just built. `file:///` cannot open the full desk; a small
  probe under `test/tmp/` opens as a `data:` snapshot, so inline its styles and assert one known
  computed value first. `wrangler dev` fails while the compatibility date is newer than the
  installed binary's.
- **Geometry.** Use `offsetHeight`, `offsetWidth` and `getComputedStyle`: `getBoundingClientRect`
  under-reports in a pane that scales the viewport (a true 44 reads 41.4), so probe once with a known
  44px box. A census models a finger: filter to hittable elements (an `offsetParent`, pointer events,
  visible, opacity above 0), then measure both dimensions; settle a pseudo-extended hit area by
  scanning `elementFromPoint` outward from the centre (calibrated on `.vpill`, which reads 41). Set
  `scrollBehavior='auto'` before a scroll-then-measure probe; `elementFromPoint` reports controls on
  parts not on screen; a `<summary>` is never hidden by its own `<details>`. A full-width control
  inside a table is as wide as the table (`wrapTables`): put it below the card. Widening two adjacent
  inline targets overlaps them: `display:inline-block` plus `min-width`. Padding a control upwards
  does not capture taps.
- **Overflow.** `scrollWidth - clientWidth` misses up to 18px of spill into `.wrap`'s padding.
  Measure elements past `.main`'s right edge, skipping anything inside a scroller, at every width in
  1px steps, a fresh load per width, on a copy of `public/`.
- **Sticky cells** need a background at alpha 1, and a later rule can replace the fill: layer a wash
  as `linear-gradient(<wash>,<wash>), var(--panel)`. Find faults by a computed-style census over
  every sticky cell.
- **An entry animation** with `fill-mode:backwards` holds its from-state wherever the timeline does
  not advance (a hidden pane, capture tools): invisible and undersized, yet passing a hit test. The
  element's own style must be its resting state.
- **Emulated phones.** Playwright's `fullPage` screenshot turns `(pointer:coarse)` off for good:
  grow the viewport and take a plain shot. Browser-pane phone screenshots go black once scrolled:
  measure with script. The design layer stretches selects to 100%: set `width:auto` in a flex row.

## 5. Desk traps

- **Charts fail silently four ways**: an empty inner `catch` inside the `ensureChart` callback; a
  draw scoped too wide (a bare `purchases` in a per-product block plots every book's lots; compare
  the product blocks against each other, since identical non-empty data is not something two books
  produce); an all-null series, which is a legend entry without data; and a canvas outside its own
  `.prodblock` after one unbalanced tag, so `blkEl` returns null and the draw never runs. The census
  is by hand, on every per-product part, before and after any markup move: count canvases and
  `<details>` with no `.closest('.prodblock')`, and expect zero. A probe that sets `DRAW_BLK` itself
  cannot find it: call `PART_DRAW[part]()`. A scoping fault found in one of the ten per-product draw
  functions sweeps the other nine the same hour.
- **Chart.js with no root `type`** takes its scale defaults from the first dataset: a scatter-led
  mixed chart gets a linear x axis and drops every string date without throwing. Read
  `ch.scales.x.type`.
- **`stripMethod`** cuts every `.insight` over 140 characters to its first sentence, folds included,
  and deletes standing `.dsc` blocks beyond one per `.prodblock` (exempt: inside a table, details,
  `.kpi`, `.act`, `.plan`, `.obs` or `.qfield`; holding a control, an id or a figure). Length is the
  template plus today's figures. The cull is a competition: adding or removing a block, or giving
  one a figure, can kill or resurrect a neighbour, so check both ways per part per book. A finding
  that must stand is one sentence in an `.insight`; detail goes in a `.dsc` inside `<details
  class="obsec">`; a fact beside a chart goes on the chart.
- **`perProduct` draws one book** since the one-product rule: a test that uses it as an iterator
  checks only the book in view. Loop `PROD_IDS` with `PROD=p; recompute()`.
- **Inside `render()`, `allActions` and `approachSplit` answer from `RENDER_MEMO`**, made once a
  render (`approachSplit` once a book in view) and dropped in a `finally`. A probe that changes
  state from inside a builder and reads either again gets the first answer; read outside a render.
  Count the work by wrapping `allActionsNow` and `approachSplitNow`, since a memo hit is a call.
- **`evolution` sits in the middle of the master**, not at the end: `slice(0,
  indexOf("const evolution=["))` searches only the first third. Use `slice(0, evAt) +
  slice(stampAt)`.
- **A regex strip of JS comments breaks the master**: most `/*` sequences sit inside strings and
  template literals.
