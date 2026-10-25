# Plan: the Book as a Durable Object (draft 8, 14 Oct 2026, Fable's nine findings and its re-check in)

Master d9f60743 (v1109). Replaces draft 5 of 28 Sep (`~/.claude/plans/salt-book-parallel-build.md`, kept as history).
Inputs: two read-only audits of 14 Oct (staleness; stores, writers and readers), both from origin/master.
Progress board: `docs/book-do-board.html` (as of 16 Oct 2026).

## 1. Why, restated on today's figures
- **Every approval is still a release.** In the last 7 days 53 of 69 versions were folds (about 7.6 a day, peak 15),
  each one commit, build, deploy and suite (verified, git log 08 to 14 Oct). The chain takes 1.2 min median, 2.0 at
  most (verified, cloud-commit.yml:11, 119 runs), plus dispatch and the phone's 10 s poll.
- **The suite reads the live book, so a fold can turn it red with no code change.** It happened three times this
  week: CI5-PER's locality (v1097), the latest-lot and Not needed checks (#169), the reward spend (#173).
- **The real ledger sits in a public repo** (rule 3, his decision of 10 Oct). Moving the source out of git would let
  the repo carry code alone; whether it still commits an export is his call (D5).
- His principle stands: inputs are data, the logic is minted once, and only a change to the logic is a version.

## 2. What moved since draft 5 (audit, verified from origin/master)
| Draft 5 assumed | Now |
|---|---|
| The Desk owns approvals, taps and inputs | The Desk only reads (v1104). Counter Admin writes, through `DESK_MAKER` to the Desk's `/_internal/maker/*` |
| `ORDER_STORE` object+kv; copy `rid:` and KV orders | `object` since 04 Oct; KV orders retired. The OrderBook object is the only order store |
| Names and places in KV `vault*` | D1 vault pair is authority (0015, 0016); KV is recovery only. `vault-key` stays in KV |
| Repo private 01 Oct; spending limit; minutes risk | Public since 11 Oct; Actions minutes free while public |
| readBook lacks loans | Fixed (#171) |
| Law lifted into `engine/apply.mjs`, `engine/stages.mjs` (B1) | Not started. `tools/fold.mjs` 1,266 lines, `src/orders.js` 2,549 (+75% since draft 5) |
| Drift pin and a 7-day freeze before the swap | Not workable: `src/orders.js` 42 commits, `src/worker.js` 53, `stmt/orders.js` 34 in 16 days |
| 3 to 5 live versions to the swap, 46 to 66 sessions | 219 versions shipped in 17 days; building beside would chase a moving target |

## 3. Where the book lives today (audit)
- **Source:** `ledger/book.json` in git, written only by `tools/fold.mjs`. Copies: the master's BOOK block, `ledger/ledger.json`
  (plus derived PRICING, OPEN, TERMS, REWARD), D1 `entry`/`state`/`snapshot` (a full replace by `d1.mjs --seed` each fold),
  the sealed statements on the Counter.
- **Authorities outside git:** D1 `draft`, `refused`, `preapproval`, `maker_request`, `input_admission`, the vault pair; Desk KV
  `q:*`, `hush`, marks; Counter KV accounts, `expected`, `bulletin`; the Counter's `OrderBook` object (events, orders, account
  claims, threads, pools).
- **Readers of the derived book on the Worker:** one road, `readBook` in `src/drafter.js` (D1 mirror), used by the drafter,
  `src/orders.js` (cards, previews, rowRoom, claimAlloc), the maker catalogue, and the open `/ledger*` routes.
- **One Durable Object exists:** `OrderBook` on the Counter (tag v1, SQLite, fetch class); the Desk Worker has none.

## 4. The approach: grow it in place, in steps, each with its own way back
Draft 5 built three Workers beside the live app and swapped in one evening. With one writer surface and this rate of change,
draft 6 grows the Book inside the live Workers, one reader or writer at a time, keeping git written until the last step, so
every step before it reverts by a revert.

| Step | What | Live effect | Way back | Sessions (estimate) |
|---|---|---|---|---|
| S0b | **The D1 decisions get a backup now** (F9): a nightly dump of `draft`, `preapproval`, `refused`, `input_admission` and the vault pair (ciphertext), encrypted, to the laptop or R2 (D8) | none | stop it | 1 |
| S0 | **The suite stops reading the live book**: a frozen test book (the book at a sha plus invented rows, clock pinned), every live-data check moved onto it; the gate refuses a test reading `ledger/book.json` | none; ends fold-caused reds | revert | 2 to 3 |
| S1 | **Lift the law, all of it**: `plan()` with every refusal (twin, payFault, tripFault, Add ID dependency) and `apply()` into `engine/apply.mjs applyEntry` (pure; TIER_NAMES and pins as arguments); the stage entries into `engine/stages.mjs`; and `pricingSnapshot` (floors, cards, drift, today computed in jsdom by `tools/book.mjs`) into the engine so a Worker can recompute PRICING (F6). `applyEntry` rolls per entry and the fold applies a batch entry by entry in order (F5). Fold, `src/orders.js` and `tools/book.mjs` import them. Proof: the last 20 batches replayed byte-equal, PRICING equal, except a batch that mixed a count with moves, compared by end state and listed | 2 to 4 versions, no behaviour change | revert | 8 to 12 |
| S2 | **The Book as a shadow**: a SQLite Durable Object `Book` on the Desk Worker (new migration tag), loaded from the book at each fold, every folded row stamped `booked_at` by the load; parity every fold over rows AND STATED_STOCK, PROD_OPENING, COUNTS, NOTES and PRICING (F5, F6), red on any difference, proved by mutation. Point-in-time recovery tested once | none; nothing reads it | delete the class (new tag) | 4 to 6 |
| S3 | **"On its way" redefined, then readers move**: every reader that adds approved-uncommitted drafts on top of the book (`rowRoom`/`paysOnWay`, `heldPays`, `withDraftLots`, `tripCheck`, `withPending`, FATE's `landed`) keys off a `booked_at` the Book sets, not D1 status (F3); then `readBook` reads the Book, D1 `entry`/`state` kept seeded as the check | none visible | flag back to D1 | 3 to 5 |
| S4 | **An approval books at once, beside the fold**: the tap runs the full `applyEntry` law in the Book (refused with 409 before anything is written, F4), mints the rid and any username there and writes them, with the cost, back into D1 `draft.row`, so the fold (which reads D1) takes them and never mints again (F2), and records the approval in the Book's own table keyed by draft id with `booked_at`; D1 `draft.status` follows it idempotently (F1). The fold still folds from D1's approved rows as today (F7), takes the Book's rid and cost verbatim, never re-mints, and its twin guard skips a row whose draft id is its own; parity each fold | figures and PRICING move on the tap | flag off: the fold never depended on the Book | 6 to 9 |
| S5 | **Authority flips** after 7 days of parity: the Book is the source; the fold becomes a daily export that replays the Book's event log in booked order (counts and rolls in event order, F5), notes written behind; a version is code alone; the Worker recomputes PRICING on each booked purchase (F6); the desk page takes the book from the Book at serve time; the Counter publish reads the Book | approvals stop being versions | re-export to git, flags back (60 to 90 min, estimate) | 6 to 9 |
| S6 | **Orders and rows joined** (D3: two objects): an outbox table written in the Book's transaction, drained to `OrderBook` by eid, as `behind` already does (F8) | none visible | drain stops; reconcile as today | 3 to 5 |
| | **Total** | | | **33 to 50**, against draft 5's 46 to 66 |

Each step lands as its own version (or test-only PR), Fable-reviewed where it touches money or data (S1 to S6), one build at a time.
The nightly export covers the Book AND the D1 decision tables (`draft`, `preapproval`, `refused`, `input_admission`, the vault pair), which today are in no export (F9).

## 5. Decisions for him
- **D1 Approach.** Grow in place in steps (recommended: each step reverts, nothing chases the live app) or build beside and
  swap in one evening (draft 5: safer cut-over, about half as much work again, and a freeze the churn makes hard).
- **D2 Start with S0 alone?** The frozen test book is worth having whatever happens to the rest (recommended yes).
- **D3 Orders and rows.** Keep the Book and `OrderBook` as two objects joined by the idempotent ids they already carry,
  through an outbox (recommended, Fable concurs: stage and row are already two stores reconciled by rising marks) or put both in one object so a stage and its row commit
  together (draft 5's design; bigger move, the Counter Worker would host the Book).
- **D4 Where the Book lives.** On the Desk Worker beside the drafter and approvals (recommended) or on the Counter beside
  `OrderBook`. Both Worker names stay (draft 5's Decision 24 holds).
- **D5 Git after S5.** Commit a daily export of the book (an audit trail in git, but the real ledger stays in a public repo) or
  keep the book out of git, with a nightly encrypted export to R2 and the laptop (the repo then carries code alone).
- **D6 Version numbers after S5.** A version means a code change only; the record of approvals is the Book's event log and the
  daily export (recommended).
- **D8 The D1 dump (S0b).** A nightly encrypted dump to R2 (a new bucket and a scheduled job, ask-first) or a laptop pull he runs (recommended: R2, so it does not depend on the laptop being on).
- **D7 The notes.** Keep the model's notes, written behind the row (recommended), or retire them for the plain `foldnotes` text.

## 6. Risks
| Risk | Mitigation |
|---|---|
| The Book and git disagree in S2 to S4 | Parity every fold, red on any difference, proved by mutation; git stays the source until S5 |
| One object fails | Point-in-time recovery (30 days), the daily export, D1 mirror kept until S5 plus 30 days |
| A tap books twice, or a payment counts twice | The Book's approval table keyed by draft id; `booked_at` decides what is on its way (S3); one rid minter (S4) |
| A floor runs behind a new lot | PRICING recomputed by the Worker on each booked purchase (S1, S5), in parity from S2 |
| The fold refuses what the Book booked | The full law runs at the tap first (S4); from S5 the fold replays, never re-plans |
| The D1 decisions are lost | They join the nightly export (F9) |
| The Desk page goes stale once the BOOK block stops baking | S5 serves the book at request time; the `/rev` tick reloads on a change, as today |
| The lifted law drifts from the fold | Both import one law from S1; replay of the last 20 batches byte-equal |
| New migration tags | One new tag per class change, never a rename; `wrangler.jsonc` is deployed by hand (not in rev.json) |
| A test still leans on live data | S0 removes the road; the gate refuses a test reading `ledger/book.json` directly |

## 7. Checks before S1 (his hands or an API read)
- Is the Workers Builds branch trigger (01532fc8 in draft 5) still there? Read back through the Cloudflare API (rule 8).
- Confirm no reader still uses Desk KV `vault`/`vault-addr` outside recovery.

## His answers, 14 Oct 2026
D1 in place, step by step. D2: S0 now; S0b waited until 25 Oct 2026, when he said to start it; it is live as v1251, with the bucket, the key and the cron each on his yes (`docs/BACKUP.md`). D8: when S0b runs, R2, encrypted (bucket and nightly job each still need his yes). D5: a daily export to git after S5.
D3, D4, D6, D7 not yet asked; the recommendations stand until he says otherwise (none affects S0 to S2).

## His answers, 16 Oct 2026 (S1d)
- Count order: EVENT ORDER. A count stands; only moves after it change it (his 02 Sep hand fold, e99b0e6e/1908fd20). Retires "a count and the lots it follows are two folds" once S1d-ii lands (CLAUDE.md line to change then).
- Add ID and renames: BOOKED ORDER. A trade naming a new ID is refused until its Add ID has booked; renames apply when approved.
- Trip: ONE TAP for the trip, booking every row or none (replaces the fold's trip hold).
- Roll note: ONE PER BATCH, summed; past folds stay byte-equal.
S1d split: S1d-i applyEntry beside applyInto, no behaviour change; S1d-ii applyInto = fold(applyEntry) in event order, with the 02 Sep batch giving 10.5.

## Where S1 stands, 16 Oct 2026
S0 done (#176, #177). S1a-i #178, S1a-ii #179, S1b #180 (v1126), S1c-i #181 (v1127), S1c-ii #182 (v1128), S1c-iii #183 (v1129) landed.
S1d-i (applyEntry in `engine/apply.mjs`, beside applyInto) landed as #184 (957eb986). S1d-ii, the fold switched to applyEntry in event order, landed as #191 (ab972554, 18 Oct 2026).
