/* test/fold-replay.mjs: S1 of the Book plan. THE FOLD'S LAW MOVES, THE FOLD'S OUTPUT DOES NOT. Twenty staged batches in git history
   ("Stage N approved row(s) for the fold", master/_to_fold.json at that commit) are run through the fold as it stood before the
   move (tools/fold.mjs at OLD_FOLD, read with git show into a temp dir) and through the working fold, against the book and the
   master as they stood when that batch was folded, with the same synthetic notes and the clock pinned. The plan, the refusals,
   the book text and the master text must be byte-equal. A shallow clone has no history: the section then says so and checks
   nothing, which is why it is run on the laptop (tools/section.mjs "S1: the fold replays").

   FIXED, AND NEITHER FOLD GIVEN THE LIVE EXTRACT (25 Oct 2026, his word "Fix S1"). The window was "the last 20", so every fold slid it onto rows
   the fixed old fold of 14 Oct can never match: the Their % wording of 21 Oct, the re-pricing of a restated row from 20 Oct. It is now the
   20 batches up to WINDOW_END, and only moving that on purpose, after accounting for what changed since, moves it. And a fold reads the
   reward scheme and the PRICING snapshot from the extract beside the book it resolved when tools/book.mjs first loaded in the process: the
   frozen fixture's (no extract) when this ran alone, the live one's (today's prices) after a section that loaded it first. The same batches
   passed alone and failed in the suite, 17 of 20 against 14. Both folds are now told the same extract that does not exist, whatever the
   environment says, and law() reads the one Their % row both folds write, in their own words, as one figure. */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const OLD_FOLD = "43fc5b0a";
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const git = (...a) => execFileSync("git", a, { cwd: REPO, encoding: "utf8", maxBuffer: 1 << 28 });

/* the newest staged batch in the window: the one of 24 Oct 2026 that set CA5-SEN's salt figure (v1250) */
export const WINDOW_END = "8344070c";

/* n staged batches, the newest being the one staged at `end`: [{sha, staged, book, master}] */
export function batches(n = 20, end = WINDOW_END) {
  const stages = git("log", "--format=%H", "-n", String(n), "--grep=approved row(s) for the fold", end, "--", "master/_to_fold.json").trim().split("\n").filter(Boolean);
  return stages.map((sha) => {
    const staged = JSON.parse(git("show", sha + ":master/_to_fold.json"));
    /* the fold that took it is the next commit to move the book; its parent holds the book and master the fold read */
    const next = git("log", "--reverse", "--format=%H", sha + "..HEAD", "--", "ledger/book.json").trim().split("\n")[0];
    const base = next ? next + "^" : sha + "^";
    return { sha, base, staged, book: git("show", base + ":ledger/book.json"), master: git("show", base + ":master/salt_command.html") };
  });
}

/* the old fold, from git, with its relative imports made absolute so it runs from a temp dir */
export function oldFoldText() {
  const at = (p) => pathToFileURL(join(REPO, p)).href;
  return git("show", OLD_FOLD + ":tools/fold.mjs")
    .replace(/from "\.\/([^"]+)"/g, (_, p) => `from "${at("tools/" + p)}"`)
    .replace(/from "\.\.\/([^"]+)"/g, (_, p) => `from "${at(p)}"`);
}

/* the same synthetic notes for both: a version after the master's, a note on every item */
export function notesFor(p, master) {
  const m = /const evolution=\[\{\s*"?v"?\s*:\s*['"]v(\d+)['"]/.exec(master);
  const rows = {};
  for (const it of p.items) rows[it.id] = { note: "synthetic note for " + it.id, what: it.what };
  return { version: "v" + ((m ? +m[1] : 0) + 1), date: "14 Oct 2026", title: "SYNTHETIC", notes: ["<b>synthetic</b>"], rows, stockNote: "synthetic stock note" };
}

/* a Their % row, in the two folds' own words (21 Oct 2026): the fold before the move wrote "TIER CA5-SEN salt drift +0.3" and "set CA5-SEN's salt tier to
   drift +0.3", the working fold writes "THEIR % CA5-SEN salt 30% lift" and "set CA5-SEN's salt figure to 30% lift". Each is read as the one figure, a decimal
   (-0.2 for 20% off, 0.3 for 30% lift) or "not set", so the VALUE still has to agree: 30% lift meets drift +0.3 and nothing else. The rest of the rule is the
   fold before the move's, with plan 4's `was` set aside and the dropped figure's note, as before. */
const figure = (dir, n) => +(((dir === "off" ? -1 : 1) * n) / 100).toFixed(4);
export const law = (s) => s.replace(/,(\\)?"was(\\)?":\{[^{}]*\}/g, "").replace(/,"dropped the old figure:[^"]*"/g, "").replace(/ at salt -?[0-9.]+(?=")/g, "")
  .replace(/, a drift of /g, ", a difference of ").replace(/, drift (-?[0-9.]+)\)/g, ", difference $1)")   /* and the dropped figure's note, and the row's own words for it; and a count's note, which said drift until 0c4ba9e1 (Desk words) and says difference since */
  .replace(/\b(?:TIER|THEIR %) (?=[A-Z][A-Z0-9]*-[A-Z0-9]+ )/g, "TIERSET ")
  .replace(/\b([a-z]+) drift ([+-]?[0-9.]+)/g, (m, p, v) => p + " TIERSET " + +v)
  .replace(/\b([a-z]+) ([0-9.]+)% (off|lift)/g, (m, p, n, d) => p + " TIERSET " + figure(d, +n))
  .replace(/\b([a-z]+) tier to TIERSET/g, "$1 figure to TIERSET");

export async function run({ ok }) {
  /* the two folds' words for a Their % row meet at one reading, and a different figure does not */
  const oldRow = `"what":"TIER CA5-SEN salt drift +0.3","does":["set CA5-SEN's salt tier to drift +0.3"]`;
  const newRow = `"what":"THEIR % CA5-SEN salt 30% lift","does":["set CA5-SEN's salt figure to 30% lift"]`;
  ok(law(oldRow) === law(newRow), "S1: the fold before the move's words for a 30% lift and the working fold's are one reading: " + law(oldRow));
  ok(law(oldRow.replace(/\+0\.3/g, "-0.2")) === law(newRow.replace(/30% lift/g, "20% off")), "S1: and drift -0.2 meets 20% off");
  ok(law(oldRow) !== law(newRow.replace(/30% lift/g, "20% off")) && law(oldRow) !== law(newRow.replace(/30% lift/g, "30% off")) && law(oldRow) !== law(newRow.replace(/30% lift/g, "25% lift")),
    "S1: a different figure, or the other direction, is still a difference");
  ok(law('"what":"TIER CK4-SEN salt not set"') === law('"what":"THEIR % CK4-SEN salt not set"'),
    "S1: a cleared figure reads the same in both folds");
  ok(law("a count of 5 units, a drift of 0.15 against the book") === "a count of 5 units, a difference of 0.15 against the book",
    "S1: the old rule for a count's note stands beside it");
  let bs;
  try { bs = batches(20); } catch (e) { bs = []; }
  if (!bs.length || git("rev-parse", "--is-shallow-repository").trim() === "true") {
    ok(true, "S1: no staged batch in this clone's history (shallow): the replay is run on the laptop");
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), "foldreplay-"));
  const realNow = Date.now;
  try {
    Date.now = () => Date.UTC(2026, 9, 14, 3, 0, 0);   /* pinned: the LAST_UPDATED stamp and the default today */
    const oldFile = join(dir, "fold-old.mjs");
    writeFileSync(oldFile, oldFoldText());
    /* NO EXTRACT FOR EITHER FOLD: each reads its --ledger when it loads, so both are loaded with the same one that is not there */
    const none = join(dir, "no-extract.json"), argv0 = process.argv;
    let OLD, NEW;
    process.argv = [...argv0, "--ledger", none];
    try {
      OLD = await import(pathToFileURL(oldFile).href);
      NEW = await import(pathToFileURL(join(REPO, "tools", "fold.mjs")).href + "?replay");
    } finally { process.argv = argv0; }
    ok(process.argv === argv0 && !existsSync(none) && NEW.planCtx.pricing === null && NEW.planCtx.reward === null,
      "S1: both folds were given an extract that is not there, so neither finds a PRICING snapshot or a reward scheme, and the process's arguments are as they were");
    ok(bs.length === 20 && bs[0].sha.startsWith(WINDOW_END), `S1: the window is the 20 staged batches up to ${WINDOW_END}, however many have been staged since: ${bs.length} from ${bs[0].sha.slice(0, 8)}`);
    const { writeBookFile } = await import("../tools/booksync.mjs");
    const text = (book) => { const f = join(dir, "b.json"); writeBookFile(book, f); return readFileSync(f, "utf8"); };
    /* a refusal is an answer too: a thrown error is compared by its message */
    /* 18 Oct 2026 (the % lift): a salt figure stamped before RULES.liftSince was set in the old unit (-1 to +1) and the working fold DROPS it, with a note,
       and holds none: the customer stays on the Set Price. So the fold before the move is given the batch without those figures, and the working fold the
       batch as staged; every other byte is still compared. */
    const since = Date.parse((await import("../engine/rules.mjs")).default.RULES.liftSince);
    const noOldLift = (staged) => {
      const c = JSON.parse(JSON.stringify(staged));
      for (const it of (c.approved || [])) {
        if (Date.parse((it.entry && it.entry.at) || it.id) >= since) continue;
        const r = it.row || {}, t = it.collection === "roster" ? [r.tiers] : it.collection === "tierset" ? Object.values(r.tiers || {}) : [];
        for (const x of t) if (x && typeof x === "object") delete x.salt;
        if (it.collection === "roster" && r.tiers && !Object.keys(r.tiers).length) delete r.tiers;
      }
      return c;
    };
    const go = (F, b, forOld) => {
      const book = JSON.parse(b.book), staged = forOld ? noOldLift(b.staged) : b.staged;
      try {
        const p = F.plan(JSON.parse(b.book), staged, null);
        const notes = notesFor(p, b.master);
        const res = F.apply(book, staged, notes, b.master);
        return JSON.stringify({ plan: p, ok: res.ok, problems: res.problems, folded: res.folded, newest: res.newest, moves: res.moves, renames: res.renames,
          ignored: res.ignored, master: res.master, book: text(book) });
      } catch (e) { return "threw: " + e.message; }
    };
    let equal = 0, folded = 0;
    /* law() is above: plan 4's `was` set aside, the dropped figure's note, a count's note, and a Their % row's words; every other byte of the plan,
       the book and the master is still the old fold's */
    for (const b of bs) {
      const a = law(go(OLD, b, true)), c = law(go(NEW, b));
      const same = a === c;
      if (same) equal++;
      if (!a.startsWith("threw") && JSON.parse(a).ok) folded++;
      ok(same, `S1: batch ${b.sha.slice(0, 8)} (${b.staged.count} row(s)) folds byte-equal to the fold before the move`);
    }
    /* the engine's applyBatch leaves its argument alone and returns the folded book, equal to what the fold wrote */
    const ENG = await import("../engine/apply.mjs"), { nextRid } = await import("../tools/rid.mjs"), { sortBook } = await import("../tools/sort-ledger.mjs");
    const b0 = bs[0], book0 = JSON.parse(b0.book), frozen = JSON.stringify(book0);
    const p0 = NEW.plan(JSON.parse(b0.book), b0.staged, null), n0 = notesFor(p0, b0.master);
    const out = ENG.applyBatch(book0, b0.staged, n0, Object.assign(Object.create(NEW.planCtx), { nextRid, sortBook }));
    ok(JSON.stringify(book0) === frozen, "S1: applyBatch leaves the book it is given exactly as it was");
    /* nothing aliases the staged batch, and a refused item folds nothing and leaves the book as it was */
    const outText = out.ok && text(out.book);
    const mark = (o, seen = new Set()) => { if (!o || typeof o !== "object" || seen.has(o)) return; seen.add(o); if (Array.isArray(o)) o.push("TOUCHED"); else o.zzTouched = 1; for (const v of Object.values(o)) mark(v, seen); };
    let clean = 0;
    for (const b of bs) {
      const sb = JSON.stringify(b.staged), pb = NEW.plan(JSON.parse(b.book), b.staged, null), r = ENG.applyBatch(JSON.parse(b.book), b.staged, notesFor(pb, b.master), Object.assign(Object.create(NEW.planCtx), { nextRid, sortBook }));
      if (r.ok) mark(r.book);
      if (JSON.stringify(b.staged) === sb) clean++;
    }
    ok(clean === bs.length, "S1: mutating the book applyBatch returns leaves every staged batch unchanged");
    /* a batch the plan refuses folds nothing: the book it just produced, folded again, is all replays */
    let replayed = 0;
    for (const b of bs) {
      const pb = NEW.plan(JSON.parse(b.book), b.staged, null), nb = notesFor(pb, b.master), ctx = Object.assign(Object.create(NEW.planCtx), { nextRid, sortBook });
      const once = ENG.applyBatch(JSON.parse(b.book), b.staged, nb, ctx);
      if (!once.ok) continue;
      const was = JSON.stringify(once.book), again = ENG.applyBatch(once.book, b.staged, nb, ctx);
      if (!again.ok && /replay/.test(again.problems.join(" ")) && JSON.stringify(once.book) === was) replayed++;
    }
    ok(replayed >= 1, `S1: ${replayed} batch(es) folded twice are refused as replays through applyBatch, which returns its problems and leaves the book as it was`);
    /* the clock comes in through ctx: an undated count is dated by ctx.today and by nothing else */
    const cnt = { ok: true, count: 1, approved: [{ id: "zz-count", status: "approved", collection: "count", row: { product: "salt", qty: 5 } }] };
    const pc = ENG.planBatch(JSON.parse(b0.book), cnt, null, Object.assign(Object.create(NEW.planCtx), { today: "2031-02-03" }));
    ok(pc.items.length === 1 && pc.items[0].count && pc.items[0].count.date === "2031-02-03", "S1: planBatch dates an undated count by ctx.today");
    ok(law(outText || "") === law(JSON.parse(go(OLD, b0, true)).book), "S1: and returns the book the fold before the move wrote");
    ok(bs.length >= 1 && equal === bs.length && folded >= 1, `S1: ${equal} of ${bs.length} staged batches replay byte-equal, ${folded} of them folded rather than refused`);
  } finally { Date.now = realNow; rmSync(dir, { recursive: true, force: true }); }
}
