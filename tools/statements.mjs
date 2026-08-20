/* statements.mjs: put the monthly statements where the phone can reach them.
 *
 * WHAT THIS IS NOT. It does not produce a statement and it must never learn how:
 * the rules live in the desk (stmtRows, stmtRefunds, stmtRecon, stmtDoc) and
 * tools/make_statements.cjs drives them headlessly. A second copy would drift the
 * first time either changed, which is the same rule data.json obeys.
 *
 * WHAT IT DOES. `statements/<YYYY-MM>/` is where the monthly run writes, per
 * docs/STATEMENTS.md, and nothing under it is served: only `public/` is. So this
 * mirrors that folder into `public/statements/` and writes an index of what is
 * there, which is the whole of the phone's knowledge of the set. It reads file
 * NAMES and copies bytes; it adds up nothing, so there is no figure here that
 * could disagree with the statement it points at.
 *
 * THE INDEX CARRIES NO TIMESTAMP, DELIBERATELY. build.mjs folds it into the build
 * id, and the id decides whether update.mjs deploys. A `generated` field would move
 * the id on every build, so every build would deploy and every phone would reload:
 * exactly the "two builds of an identical master differ a second apart" trap that
 * CI already refuses to fall into by comparing ids and never bytes. The per-month
 * `digest` is the honest version of the same signal, and it moves when a statement's
 * CONTENT moves and at no other time.
 *
 * Run directly to mirror without a full build:  node tools/statements.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");

const MONTH_RE = /^\d{4}-\d{2}$/;
const STATEMENT_RE = /^statement_(.+)_(\d{4}-\d{2}-\d{2})\.html$/;
const REVIEW_RE = /^_review_(\d{4}-\d{2}-\d{2})\.html$/;

const dirs = (p) => {
  try { return readdirSync(p, { withFileTypes: true }); } catch (e) { return []; }
};

/* Mirror statements/ into public/statements/ and return the index.
   Returns {months:[...]} with the newest month first, which is the order the phone
   wants: the set he is about to send is the one at the top. */
export function mirrorStatements(repo = REPO) {
  const src = resolve(repo, "statements");
  const dest = resolve(repo, "public", "statements");
  const months = [];
  const keep = new Map();               // month -> Set of filenames that belong there

  for (const d of dirs(src).filter((e) => e.isDirectory() && MONTH_RE.test(e.name)).sort()) {
    const month = d.name;
    const from = join(src, month);
    const files = dirs(from).filter((e) => e.isFile() && e.name.endsWith(".html")).map((e) => e.name).sort();
    if (!files.length) continue;

    const accounts = [];
    let review = null, issued = null;
    const h = createHash("sha256");
    for (const name of files) {
      const body = readFileSync(join(from, name));
      h.update(name).update("\0").update(body).update("\0");
      const s = STATEMENT_RE.exec(name);
      const r = REVIEW_RE.exec(name);
      const date = s ? s[2] : (r ? r[1] : null);
      if (date && (!issued || date > issued)) issued = date;
      if (s) accounts.push({ code: s[1], issued: s[2], file: "statements/" + month + "/" + name });
      /* A month should hold ONE review sheet, because a second issue date in one month is
         the thing docs/STATEMENTS.md tells the run to stop on rather than overwrite. If
         one is there anyway, the latest wins here and the older file still ships, so
         nothing that was issued disappears from the phone. */
      else if (r && (!review || r[1] >= review.issued)) review = { issued: r[1], file: "statements/" + month + "/" + name };
    }
    accounts.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
    months.push({ month, issued, digest: h.digest("hex").slice(0, 16), accounts, review });
    keep.set(month, new Set(files));

    mkdirSync(join(dest, month), { recursive: true });
    for (const name of files) writeFileSync(join(dest, month, name), readFileSync(join(from, name)));
  }

  /* SWEEP WHAT IS NO LONGER THERE. A mirror that only ever adds is not a mirror: a
     statement withdrawn from the source would keep being served, and a customer would
     be reading a document that was pulled. Nothing outside public/statements/ is
     touched, and a month that is still in the source keeps every file it still has. */
  for (const d of dirs(dest).filter((e) => e.isDirectory()).sort()) {
    const wanted = keep.get(d.name);
    if (!wanted) { rmSync(join(dest, d.name), { recursive: true, force: true }); continue; }
    for (const e of dirs(join(dest, d.name))) {
      if (e.isFile() && e.name.endsWith(".html") && !wanted.has(e.name)) rmSync(join(dest, d.name, e.name), { force: true });
    }
  }

  months.reverse();                     // newest first
  mkdirSync(dest, { recursive: true });
  const index = { ok: true, months };
  writeFileSync(join(dest, "index.json"), JSON.stringify(index) + "\n");
  return index;
}

if (import.meta.url === "file://" + process.argv[1]) {
  const index = mirrorStatements();
  if (!index.months.length) console.log("statements: nothing under statements/, so nothing mirrored");
  for (const m of index.months)
    console.log(`statements: ${m.month}  ${m.accounts.length} account${m.accounts.length === 1 ? "" : "s"}` +
      `  issued ${m.issued}  ${m.review ? "with" : "WITHOUT"} a review sheet  digest ${m.digest}`);
  console.log("  -> public/statements/index.json");
}
