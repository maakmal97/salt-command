/* fold.mjs — THE FOLD AS A DATA WRITE (move 3 of the rebuild, v340).
 *
 * An approved draft becomes a record in ledger/book.json, with its note, and the book is
 * synced into the master. The agent keeps the judgement (the note on every row, the sentence
 * on the roll, the version entry) and loses the syntax: nothing here edits a twelve-thousand
 * line page by hand, and nothing here invents a figure.
 *
 *   node tools/fold.mjs --plan     read master/_to_fold.json against the book; say what each row
 *                                  would do and what it refuses; write master/_fold_notes.json as a
 *                                  skeleton for the agent to fill (never overwrites one that exists)
 *   node tools/fold.mjs --apply    fold everything in the batch with the notes; write book.json,
 *                                  sync the master, set the version and the stamp, prepend the
 *                                  changelog, sort, write master/_folded.json. All or nothing.
 *
 * Paths can be overridden for the tests: --staged, --notes, --book, --master, --folded, --today, and --ledger (the extract
 * whose reward scheme a spend is measured against; the book's own directory by default).
 *
 * WHAT IT APPLIES, exactly as docs/CLOUD_FOLD.md states and as the desk's own overlay would:
 *   a new row         appended to sales or purchases WITH ITS NOTE (a row with no note is refused)
 *   a fulfilment      applied to the row its key names, as ovAmend in the desk applies it: cash
 *                     and units added, the trail extended, a pending lot that stops being pending
 *                     gets receivedQty 0 and inTransit so a deposit cannot walk it into stock
 *   a cancellation    the row marked cancelled, the trail extended
 *   a modification    the row's qty and total REPLACED with the new terms (nothing added, unlike
 *                     a fulfilment), unpriced cleared if the new total is real, the trail
 *                     extended and a plain restated-from-to line appended to the row's mod field
 *   a count           the stated stock set and COUNT_ON moved; the one entry that moves it
 *   a loss            appended to selfUseLog     a lost sale   appended to lostDemand
 *   a registration    the code appended to the roster; the directory is never touched
 *   an appointment    a registration whose kind is reseller or referral: the code also joins
 *                     associates, and is given its <CODE>-R account (v610). The code may
 *                     already be on the roster, since a party is registered when they first buy
 *                     and appointed when he decides
 *   a price edit      PRICE_SET[product] REPLACED with what he set: the form on the desk is the
 *                     whole statement of what the board should be, so a price he cleared is cleared
 *   a rename (v628)   Amend ID: the code re-keyed wherever the book holds it, AFTER every other row
 *                     in the batch, with its -R account; the statement key, a place override and the
 *                     suite's fixtures follow; refused for a code the desk's own logic names
 *   a place (v633)    PLACED[code] set to the point its place was found or tapped at, one party or
 *                     many; a registration and a rename may carry the point too
 *   a tier (v643)     TIER_OF[code][product] set to the level named or cleared, one customer or every
 *                     proposal at once; one for each product since v646
 * then the shelf is ROLLED for what physically moved (a roll, never a count), the watermark
 * moves to the newest id folded, and the book is sorted.
 *
 * WHAT IT REFUSES: a Linked or Rewarded amendment (neither carries a figure the drafter can
 * check, only a judgement about which other row or which award applies); an amendment whose key
 * matches no row or more than one; a new row that would replay one already on the book (same
 * party, date and total); a new row with no note; a version entry with no title or notes. A
 * refusal folds nothing: the batch is applied whole or not at all. */
import { readFileSync, writeFileSync, existsSync, unlinkSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { readBookFile, writeBookFile, syncText, BOOK as BOOK_DEFAULT, MASTER as MASTER_DEFAULT } from "./booksync.mjs";
import { sortBook } from "./sort-ledger.mjs";
import POSITION_ENGINE from "../engine/position.mjs";
import { nextRid } from "./rid.mjs";
import * as ENGINE_APPLY from "../engine/apply.mjs";
const { STATEMENT_KINDS } = ENGINE_APPLY;
import { userFor, usersJson } from "./stmt-crypto.mjs";
import { freeSpares, oneCodeEach } from "./stmt-pool.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const opt = (name, d) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const MASTER = opt("--master", MASTER_DEFAULT);
const BOOK = opt("--book", BOOK_DEFAULT);
const STAGED = opt("--staged", resolve(dirname(MASTER), "_to_fold.json"));
const NOTES = opt("--notes", resolve(dirname(MASTER), "_fold_notes.json"));
const FOLDED = opt("--folded", resolve(dirname(MASTER), "_folded.json"));
/* 06 Oct 2026: the reward scheme is the master's and the book carries none, so a spend is measured against the scheme in the
   extract beside the book (tools/ledger.mjs writes it from the master). Unreadable, there is no scheme and a spend is refused. */
const EXTRACT = opt("--ledger", resolve(dirname(BOOK), "ledger.json"));
function rewardScheme() {
  try { const l = JSON.parse(readFileSync(EXTRACT, "utf8")).ledger || {}, r = l.REWARD; return r && r.stated ? { stated: r.stated, ...(l.TERMS ? { terms: l.TERMS } : {}) } : null; }
  catch { return null; }
}
/* 20 Oct 2026: and the pricing snapshot the drafter read, so a restated row takes their own price again (engine/apply.mjs) */
function pricingSnapshotOf() {
  try { const p = (JSON.parse(readFileSync(EXTRACT, "utf8")).ledger || {}).PRICING; return p && p.byProduct ? p : null; }
  catch { return null; }
}
const USERS = opt("--users", resolve(REPO, "statements", "_users.json"));   // v588
const PLACES = opt("--places", resolve(REPO, "geo", "places.json"));       // v628
const SUITE = opt("--suite", resolve(REPO, "test", "verify.mjs"));         // v628
const STMTS = opt("--statements", resolve(REPO, "statements"));             // 19 Sep 2026: the password files, laptop only
const TODAY = opt("--today", new Date(Date.now() + 8 * 36e5).toISOString().slice(0, 10));   // Kuala Lumpur

const E = POSITION_ENGINE;
const r2 = (v) => +(+v).toFixed(2);
/* the engine's table, not a second copy: which Add ID kind appoints, and for which stream */
/* v588, HIS INSTRUCTION OF 11 SEP 2026: EVERY CUSTOMER HAS A PERMANENT STATEMENT USERNAME FROM THE DAY THEY ARE
   REGISTERED. It used to be minted the month a customer was first issued a statement, so a new customer had
   no address for up to a month: no statement link, and no QR on a printed board. The fold mints it with the
   registration, by the same userFor as the statements run, and never touches one that exists. These are the
   kinds whose rows book to them and so are issued a statement; a supplier, a bucket and an associate's end
   buyer are not, and get none. */
/* D15, HIS ANSWER OF 24 SEP 2026: ACCOUNTS READY ON DAY ONE. `spares` are the free spare accounts the laptop
   minted ahead of need (tools/stmt-pool.mjs), in order: a registration takes the next one, so its username
   already has a sealed record behind it and the publish in this same run opens it. The binding is the one
   line in _users.json, so it lives in the repo, and nothing here needs a key. With none free it mints a bare
   username as before, and the laptop's next update makes the account. */
export function mintUsernames(users, staged, folded, spares) {
  const minted = [];
  const free = (spares || []).slice();
  for (const a of (staged && staged.approved) || []) {
    const r = a.row || {};
    if (a.collection === "roster" && folded.includes(a.id) && STATEMENT_KINDS.includes(r.kind) && !users[r.code]) {
      if (free.length) users[r.code] = free.shift(); else userFor(users, r.code);
      minted.push(r.code);
    }
  }
  return minted;
}
/* The run's half: read the pool off the committed records, bind, and write _users.json in its one format.
   It throws, writing nothing, on a file that gives one username to two codes (oneCodeEach), and the run
   calls it before the book is written, so that refusal folds nothing. */
export function registerAccounts(stmtsDir, usersFile, staged, folded) {
  const users = existsSync(usersFile) ? JSON.parse(readFileSync(usersFile, "utf8")) : {};
  const spares = freeSpares(stmtsDir, users);
  const minted = mintUsernames(users, staged, folded, spares);
  oneCodeEach(users);
  if (minted.length) writeFileSync(usersFile, usersJson(users));
  return { users, minted, bound: minted.filter((c) => spares.includes(users[c])) };
}
const stamp = () => { const d = new Date(Date.now() + 8 * 36e5); const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} KL`; };
const dayOf = (iso) => { const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; const [y, m, d] = iso.split("-"); return `${d} ${MON[+m - 1]} ${y}`; };

/* ---- read the batch ---------------------------------------------------------------------- */
function readStaged() {
  if (!existsSync(STAGED)) return null;
  const j = JSON.parse(readFileSync(STAGED, "utf8"));
  if (!j || !j.ok) throw new Error("the staged file does not report ok");
  return j;
}

/* v628: A CODE WRITTEN INTO THE DESK'S OWN LOGIC cannot be re-keyed by a fold, which writes the book and never the
   master's code: CJ4-OKR is named in DIAMOND and R0_NETWORK. A code quoted anywhere in the master outside the
   generated blocks and the version history is refused, a comment included, because a refusal costs a hand fold
   and a miss costs a desk that names a party the book no longer has. */
let masterLines = null;
/* 05 Oct 2026: the books the master prices by drift, read off its own TIER_RULE (a product whose rule opens with drift), so
   the fold refuses by book as the drafter does: a drift book takes a % from -0.3 to +0.3 (21 Oct 2026), any other book takes no figure of his */
function driftBooks() {
  masterLines = masterLines || readFileSync(MASTER, "utf8").split("\n");
  const a = masterLines.findIndex((l) => l.startsWith("const TIER_RULE={"));
  if (a < 0) return [];
  const out = [];
  for (let i = a + 1; i < masterLines.length && !/^\};/.test(masterLines[i]); i++) {
    const m = /^\s+([a-z0-9_]+):\{(?:drift|pct):/.exec(masterLines[i]);   // 22 Oct 2026: a stated board carrying `pct` takes a % too
    if (m) out.push(m[1]);
  }
  return out;
}
export function pinnedInMaster(code) {
  masterLines = masterLines || readFileSync(MASTER, "utf8").split("\n");
  let generated = false;
  return masterLines.some((l) => {
    if (/^\/\* ==== (BOOK|GEO|ENGINE|DESIGN)\b/.test(l)) { generated = true; return false; }
    if (/^\/\* ==== END (BOOK|GEO|ENGINE|DESIGN)\b/.test(l)) { generated = false; return false; }
    if (generated || /^(const evolution=\[)?\{\s*"?v"?\s*:/.test(l)) return false;
    return l.includes("'" + code + "'") || l.includes('"' + code + '"');
  });
}

/* v628: the files a rename reaches beyond the book. Pure, so the suite folds them on fixtures.
   19 Sep 2026: A FOURTH, because three was never all of them. _passwords.json is filed by CODE and
   nothing moved it, so every Amend ID left that customer's password under the name they had left.
   Four were in that state on the live book and the seal tool had to pair them back by verifier
   proof on every run. Proof is the right SAFETY NET and the wrong mechanism. */
/* the statement account moves to the new code and keeps its username, his rule: the username never changes */
export function renameUsers(users, pairs) {
  for (const [f, t] of pairs) if (users[f] && !users[t]) { users[t] = users[f]; delete users[f]; }
  return users;
}
/* the password goes with the code, so Send can still hand it over after a re-key. LAPTOP ONLY, and
   silently a no-op where the file is absent: _passwords.json is gitignored, so the cloud fold has
   nothing to move and must not pretend otherwise. */
export function renamePasswords(passwords, pairs) {
  let moved = 0;
  for (const [f, t] of pairs) if (passwords[f] !== undefined && passwords[t] === undefined) { passwords[t] = passwords[f]; delete passwords[f]; moved++; }
  return moved;
}
/* a place override follows its code while the code ends in the same place, and goes when the place changed */
export function renameLocs(places, pairs) {
  const L = places.LOCS || {}, tail = (c) => c.slice(c.indexOf("-") + 1);
  let moved = 0;
  for (const [f, t] of pairs) if (f in L) { if (tail(f) === tail(t)) L[t] = L[f]; delete L[f]; moved++; }
  return moved;
}
/* the suite's fixtures name live codes and move with the book, as v603 moved them by hand; whole codes only */
export function renameSuiteText(text, pairs) {
  for (const [f, t] of pairs) text = text.replace(new RegExp("(?<![A-Za-z0-9-])" + f + "(?![A-Za-z0-9-])", "g"), t);
  return text;
}

/* ---- the skeleton the agent fills in ---------------------------------------------------- */
function skeleton(book, staged, p) {
  const cur = book.STATED_STOCK;
  const rows = {};
  for (const it of p.items) rows[it.id] = { what: it.what, note: "" };
  return {
    version: "", date: dayOf(TODAY), title: "", notes: [],
    rows,
    stockNote: "", stockCost: null, stockCostNote: "",
    hint: `Fill note for every row (prose a person auditing it would need; codes only, never a name), the version (the next after the master's), a title in capitals and notes as an array of HTML strings. stockNote is prepended to the roll sentence the tool writes; the salt shelf stands at ${cur}. Leave stockCost null: the inventory's rate is derived from the lots (26 Sep 2026) and a figure here is ignored.`
  };
}

/* ---- apply ------------------------------------------------------------------------------- */
/* ovAmend, as the desk applies it, on a plain row */
/* S1a-i: the row core of the booking law lives in engine/apply.mjs; these keep the names this file has always exported. */
export const applyAmend = ENGINE_APPLY.applyAmend;
/* S1a-ii: the plan is the engine's too; what it reads from disk and the clock comes in here, each read only when the plan asks */
export const planCtx = { today: TODAY, pinnedInMaster,
  get driftBooks() { return driftBooks(); }, get reward() { return rewardScheme(); }, get pricing() { return pricingSnapshotOf(); } };
export function plan(book, staged, notes) { return ENGINE_APPLY.planBatch(book, staged, notes, planCtx); }


export function apply(book, staged, notes, masterText) {
  const p = plan(book, staged, notes);
  const problems = [];
  if (p.refused.length) p.refused.forEach((x) => problems.push(`${x.id}: ${x.why}`));
  if (!notes || !notes.version || !/^v\d+$/.test(notes.version)) problems.push("notes.version is missing (the next version after the master's)");
  /* 08 Sep 2026: AND IT IS THE NEXT ONE. The shape alone was checked, so a notes file left behind
     by an earlier hand fold (a v518 file sat beside a v542 master) was accepted whole and wrote
     its stale version ahead of the current one; the changelog then said "already in". */
  else { const m = /const evolution=\[\{\s*"?v"?\s*:\s*['"]v(\d+)['"]/.exec(masterText || "");
    if (m && +notes.version.slice(1) <= +m[1]) problems.push(`notes.version is ${notes.version} against a master already at v${m[1]}: a stale notes file. Delete ${NOTES} and run --plan again`); }
  if (!notes || !notes.title) problems.push("notes.title is missing");
  if (!notes || !Array.isArray(notes.notes) || !notes.notes.length) problems.push("notes.notes is empty: the version entry needs at least one note");
  for (const it of p.items) {
    const n = notes && notes.rows && notes.rows[it.id];
    if (it.append === "sales" || it.append === "purchases") { if (!n || !String(n.note || "").trim()) problems.push(`${it.id}: a new row needs a note`); }
  }
  if (problems.length) return { ok: false, problems };

  /* the row core (the cost stamp, the rows, the rids, the counts, the renames, the roll) is the engine's, run on the caller's book in
     place as it always was (the suite holds rows by identity); a caller that wants the book left alone uses applyBatch */
  const r = ENGINE_APPLY.applyInto(book, p, staged, notes, { nextRid, sortBook, reward: planCtx.reward, today: TODAY, pricing: planCtx.pricing });
  const { folded, newest, moves, renames } = r;

  /* the master: the book, the version entry and the stamp; the cost basis is derived from the book (26 Sep 2026) */
  let m = syncText(masterText, book);
  const entry = { v: notes.version, d: notes.date || dayOf(TODAY), t: notes.title, n: notes.notes };
  const open = m.indexOf("const evolution=[");
  if (open < 0) return { ok: false, problems: ["the master has no evolution array"] };
  /* v803: THE MASTER HOLDS ONE ENTRY, THE CURRENT VERSION, so the new one REPLACES it; the one it replaces is in
     master/changelog.json already, the gate refusing a master whose version the changelog lacks */
  const close = m.indexOf("}];", open);
  if (close < 0) return { ok: false, problems: ["the master's evolution array is never closed"] };
  m = m.slice(0, open) + "const evolution=[" + JSON.stringify(entry) + "];" + m.slice(close + 3);
  m = m.replace(/const LAST_UPDATED='[^']*';/, `const LAST_UPDATED='${stamp()}';`);
  /* 26 Sep 2026: A stockCost IN THE NOTES IS IGNORED, NEVER REFUSED. It moved the master's STOCK_COST line, which is gone:
     the inventory's rate is derived from the lots, so the lot this batch lands moves it with nothing written. The notes'
     shape keeps the field (tools/foldcall.mjs still asks the model for it), and a figure sent is named in the output. */
  const ignored = notes.stockCost != null
    ? [`notes.stockCost ${notes.stockCost} ignored: the inventory's rate is derived from the lots since 26 Sep 2026, so a fold moves nothing`] : [];
  return { ok: true, folded, newest, moves, master: m, plan: p, renames, ignored };
}

/* ---- the command line ---------------------------------------------------------------------- */
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const mode = argv.find((a) => a === "--plan" || a === "--apply" || a === "--replays" || a === "--held");
  if (!mode) { console.log("usage: node tools/fold.mjs --plan | --apply | --replays | --held   [--staged f] [--notes f] [--book f] [--master f] [--folded f] [--users f] [--ledger f] [--today YYYY-MM-DD]"); process.exit(2); }
  const staged = readStaged();
  if (!staged || !staged.count) { console.log("  nothing to fold: no staged batch, or its count is zero. Stop here; do not bump a version."); process.exit(mode === "--replays" || mode === "--held" ? 1 : 0); }
  const book = readBookFile(BOOK);
  /* v512: IS THE WHOLE BATCH A REPLAY? Exit 0 and print the ids when every staged row is refused
     because the same row is already on the book, and 1 for anything else. The stage job reads
     this to clear a handoff the fold could never take, rather than standing down for ever. */
  if (mode === "--replays") {
    const p = plan(book, staged, null);
    const replay = p.refused.filter((x) => /would be a replay/.test(x.why));
    if (p.items.length === 0 && replay.length === staged.count && replay.length > 0) {
      console.log(replay.map((x) => x.id).join(" ")); process.exit(0);
    }
    console.log("  not a replay batch: " + p.items.length + " row(s) would fold, " + (p.refused.length - replay.length) + " refused for other reasons, " + replay.length + " replay(s)");
    process.exit(1);
  }
  /* 05 Oct 2026, his instruction: IS THE STAGED BATCH HELD? Exit 0 and print each refusal when any row is refused, and 1
     when the batch would fold. The stage reads this so a batch waiting on a person is not folded again, red, on every
     tick and tap: 15 red runs on 30 Sep and 01 Oct 2026, each refusing the same rows. The run that staged it is still
     red and notes the phone; a person's fix to the book or the batch lets the next run fold it. */
  if (mode === "--held") {
    const p = plan(book, staged, null);
    if (p.refused.length) { for (const x of p.refused) console.log(x.id + ": " + x.why); process.exit(0); }
    console.log("  not held: " + p.items.length + " row(s) would fold"); process.exit(1);
  }
  const notes = existsSync(NOTES) ? JSON.parse(readFileSync(NOTES, "utf8")) : null;
  if (mode === "--plan") {
    const p = plan(book, staged, notes);
    console.log(`\nTHE BATCH: ${staged.count} approved row(s) against the book at ${book.QUEUE_COMMITTED}\n`);
    for (const it of p.items) console.log(`  FOLD     ${it.id}  ${it.what}\n           -> ${it.does.join("; ")}`);
    for (const x of p.refused) console.log(`  REFUSE   ${x.id}  ${x.why}`);
    if (p.moves.length) console.log("\n  MOVES    " + p.moves.map((m) => `${m.kg > 0 ? "+" : ""}${m.kg} ${m.product} (${m.who})`).join("; ") + `  from a salt shelf of ${book.STATED_STOCK}`);
    if (!notes) { writeFileSync(NOTES, JSON.stringify(skeleton(book, staged, p), null, 2) + "\n"); console.log(`\n  wrote ${NOTES}: fill in the notes, then run --apply`); }
    else console.log(`\n  ${NOTES} exists; --apply will use it`);
    if (p.refused.length) { console.log("\n  A refusal folds nothing. Resolve it or take the row out of the batch."); process.exit(1); }
  } else {
    if (!notes) { console.log(`  FAIL  no notes at ${NOTES}. Run --plan first and fill in the skeleton.`); process.exit(1); }
    const masterText = readFileSync(MASTER, "utf8");
    const res = apply(book, staged, notes, masterText);
    if (!res.ok) { console.log("  FAIL  nothing folded:"); res.problems.forEach((x) => console.log("         " + x)); process.exit(1); }
    /* v588: a registration that folded is minted its statement username now, not the month of its first statement;
       D15: on the next free spare account where there is one, which opens at this run's publish. Before the book
       is written, so a _users.json giving one username to two codes folds nothing. */
    let reg;
    try { reg = registerAccounts(STMTS, USERS, staged, res.folded); }
    catch (e) { console.log("  FAIL  nothing folded: " + e.message); process.exit(1); }
    const { users, minted, bound } = reg;
    writeBookFile(book, BOOK);
    writeFileSync(MASTER, res.master);
    writeFileSync(FOLDED, JSON.stringify({ ids: res.folded }) + "\n");
    if (minted.length) console.log(`  ok    statement username minted for ${minted.join(", ")}, kept for life`
      + (bound.length ? `; ${bound.join(", ")} on a spare account, which opens at this run's publish` : ""));
    const waiting = minted.filter((c) => !bound.includes(c));
    if (waiting.length) console.log(`  note  no spare account was free for ${waiting.join(", ")}: the account is made at the next laptop update`);
    /* v628: a rename reaches three files beyond the book: the statement key, a place override and the suite */
    const pairs = res.renames.flatMap((x) => x.pairs);
    if (pairs.length) {
      writeFileSync(USERS, usersJson(renameUsers(users, pairs)));
      if (existsSync(SUITE)) writeFileSync(SUITE, renameSuiteText(readFileSync(SUITE, "utf8"), pairs));
      /* the password file, where this laptop has one. The cloud fold has none and skips in silence. */
      for (const dir of readdirSync(STMTS, { withFileTypes: true }).filter((d) => d.isDirectory() && /^\d{4}-\d{2}$/.test(d.name))) {
        const pwFile = resolve(STMTS, dir.name, "_passwords.json");
        if (!existsSync(pwFile)) continue;
        const pw = JSON.parse(readFileSync(pwFile, "utf8").replace(/^\ufeff/, ""));
        const n = renamePasswords(pw, pairs);
        if (n) { writeFileSync(pwFile, JSON.stringify(pw, null, 2) + "\n"); console.log(`  ok    ${n} password(s) moved with the code in ${dir.name}, so Send still finds them`); }
      }
      const places = JSON.parse(readFileSync(PLACES, "utf8"));
      if (renameLocs(places, pairs)) {
        writeFileSync(PLACES, JSON.stringify(places, null, 1) + "\n");
        /* geosync reads the repo's geo/ and nothing else, so only the repo's own file is synced into the master */
        if (PLACES === resolve(REPO, "geo", "places.json")) execFileSync("node", [resolve(REPO, "tools", "geosync.mjs"), "--sync"], { cwd: REPO, encoding: "utf8", env: { ...process.env, SALT_MASTER: MASTER } });
      }
      console.log(`  ok    renamed ${pairs.map((x) => x[0] + " -> " + x[1]).join(", ")} in the book, the statement key, the place overrides and the suite`);
    }
    try { execFileSync("node", [resolve(REPO, "tools", "changelog.mjs")], { cwd: REPO, encoding: "utf8", env: { ...process.env, SALT_MASTER: MASTER } }); }
    catch (e) { console.log("  FAIL  the changelog did not take: " + String((e && e.stdout) || e)); process.exit(1); }
    console.log(`  ok    folded ${res.folded.length} row(s) into ${BOOK} and the master at ${notes.version}`);
    for (const x of res.ignored || []) console.log("  note  " + x);
    /* 08 Sep 2026: the notes are spent. Left behind, --plan refuses to overwrite them and a later
       hand fold takes them whole, stale version and all. */
    try { unlinkSync(NOTES); } catch (e) { /* already gone */ }
    for (const mv of res.moves) console.log(mv.uncounted ? `  note  ${mv.product}: ${mv.out} out, ${mv.inn} in, but this book is uncounted so nothing stated was rolled` : `  ok    ${mv.product} shelf rolled ${mv.from} -> ${mv.to} (${mv.out} out, ${mv.inn} in)`);
    console.log(`  ok    QUEUE_COMMITTED -> ${book.QUEUE_COMMITTED}; ${FOLDED} names ${res.folded.length} id(s)`);
    console.log("  next  npm run build && npm test, then commit and push. The deploy marks the ids committed.");
  }
}
