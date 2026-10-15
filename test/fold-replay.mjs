/* test/fold-replay.mjs: S1 of the Book plan. THE FOLD'S LAW MOVES, THE FOLD'S OUTPUT DOES NOT. The last 20 staged batches in git history
   ("Stage N approved row(s) for the fold", master/_to_fold.json at that commit) are run through the fold as it stood before the
   move (tools/fold.mjs at OLD_FOLD, read with git show into a temp dir) and through the working fold, against the book and the
   master as they stood when that batch was folded, with the same synthetic notes and the clock pinned. The plan, the refusals,
   the book text and the master text must be byte-equal. A shallow clone has no history: the section then says so and checks
   nothing, which is why it is run on the laptop (tools/section.mjs "S1: the fold replays"). */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const OLD_FOLD = "43fc5b0a";
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const git = (...a) => execFileSync("git", a, { cwd: REPO, encoding: "utf8", maxBuffer: 1 << 28 });

/* the last n staged batches: [{sha, staged, book, master}] */
export function batches(n = 20) {
  const stages = git("log", "--format=%H", "-n", String(n), "--grep=approved row(s) for the fold", "--", "master/_to_fold.json").trim().split("\n").filter(Boolean);
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

export async function run({ ok }) {
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
    const OLD = await import(pathToFileURL(oldFile).href);
    const NEW = await import(pathToFileURL(join(REPO, "tools", "fold.mjs")).href + "?replay");
    const { writeBookFile } = await import("../tools/booksync.mjs");
    const text = (book) => { const f = join(dir, "b.json"); writeBookFile(book, f); return readFileSync(f, "utf8"); };
    /* a refusal is an answer too: a thrown error is compared by its message */
    const go = (F, b) => {
      const book = JSON.parse(b.book);
      try {
        const p = F.plan(JSON.parse(b.book), b.staged, null);
        const notes = notesFor(p, b.master);
        const res = F.apply(book, b.staged, notes, b.master);
        return JSON.stringify({ plan: p, ok: res.ok, problems: res.problems, folded: res.folded, newest: res.newest, moves: res.moves, renames: res.renames,
          ignored: res.ignored, master: res.master, book: text(book) });
      } catch (e) { return "threw: " + e.message; }
    };
    let equal = 0, folded = 0;
    for (const b of bs) {
      const a = go(OLD, b), c = go(NEW, b);
      const same = a === c;
      if (same) equal++;
      if (!a.startsWith("threw") && JSON.parse(a).ok) folded++;
      ok(same, `S1: batch ${b.sha.slice(0, 8)} (${b.staged.count} row(s)) folds byte-equal to the fold before the move`);
    }
    /* the engine's applyBatch leaves its argument alone and returns the folded book, equal to what the fold wrote */
    const ENG = await import("../engine/apply.mjs"), { nextRid } = await import("../tools/rid.mjs"), { sortBook } = await import("../tools/sort-ledger.mjs");
    const b0 = bs[0], book0 = JSON.parse(b0.book), frozen = JSON.stringify(book0);
    const p0 = NEW.plan(JSON.parse(b0.book), b0.staged, null), n0 = notesFor(p0, b0.master);
    const out = ENG.applyBatch(book0, b0.staged, n0, { plan: NEW.plan, nextRid, sortBook });
    ok(JSON.stringify(book0) === frozen, "S1: applyBatch leaves the book it is given exactly as it was");
    /* nothing aliases the staged batch, and a refused item folds nothing and leaves the book as it was */
    const outText = out.ok && text(out.book);
    const mark = (o, seen = new Set()) => { if (!o || typeof o !== "object" || seen.has(o)) return; seen.add(o); if (Array.isArray(o)) o.push("TOUCHED"); else o.zzTouched = 1; for (const v of Object.values(o)) mark(v, seen); };
    let clean = 0;
    for (const b of bs) {
      const sb = JSON.stringify(b.staged), pb = NEW.plan(JSON.parse(b.book), b.staged, null), r = ENG.applyBatch(JSON.parse(b.book), b.staged, notesFor(pb, b.master), { plan: NEW.plan, nextRid, sortBook });
      if (r.ok) mark(r.book);
      if (JSON.stringify(b.staged) === sb) clean++;
    }
    ok(clean === bs.length, "S1: mutating the book applyBatch returns leaves every staged batch unchanged");
    const bookText = JSON.stringify(book0), refused = ENG.applyBatch(book0, b0.staged, n0, { plan: () => ({ items: [], refused: [{ id: "zz-refused", why: "refused for the test" }], moves: [] }), nextRid, sortBook });
    ok(refused.ok === false && refused.problems.length === 1 && JSON.stringify(book0) === bookText, "S1: a batch with one refused item through applyBatch returns its problems and leaves the book as it was");
    ok(outText === JSON.parse(go(OLD, b0)).book, "S1: and returns the book the fold before the move wrote");
    ok(bs.length >= 1 && equal === bs.length && folded >= 1, `S1: ${equal} of ${bs.length} staged batches replay byte-equal, ${folded} of them folded rather than refused`);
  } finally { Date.now = realNow; rmSync(dir, { recursive: true, force: true }); }
}
