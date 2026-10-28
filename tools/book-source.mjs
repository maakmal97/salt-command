#!/usr/bin/env node
/* tools/book-source.mjs: S5e OF THE BOOK PLAN, THE COUNTER'S PUBLISH CAN READ THE BOOK (28 Oct 2026; plan: docs/plan-book-s5-s6.html). Dormant: the publish still reads git.
 *
 * After S5 the Book, not git, is the source of the ledger, and the statements the Counter serves are built from it. This is the road and its proof, run now:
 *   fetchBookSource   asks the Desk Worker's GET /book/ledger (the Book's base as a book file, with the derived documents, the version and the revision) behind the same two keys as the readcheck
 *   compareLive       builds EVERY account's live statement twice, once from git's ledger/book.json and once from what the Book answered, with tools/make_statements.mjs's own liveStatement (plaintext,
 *                     nothing sealed, nothing written), and names any account whose document differs. The books are equal at every fold (the load's parity), so what this proves is the part parity
 *                     cannot: that the document builder gives the same answer on the Book's shape and on git's, key order and all (the Book hands documents back with their keys sorted).
 *   --out <file>      writes the fetched book (plaintext, the whole ledger) for \`SALT_BOOK=<file> node tools/stmt-publish.mjs\`, which is how the flip points the publish at the Book. Never into the repo.
 *   --out and --view: --out <file> writes the fetched book (plaintext, the whole ledger; never into the repo, refuses to overwrite) for SALT_BOOK=<file> node tools/stmt-publish.mjs, which is how the flip
 *   points the publish at the Book. By default it is the Book's BASE (git's book as of the latest load); --view is the base with every open entry replayed, which is what a publish after the flip must read,
 *   or every sale tapped since the last load is missing from it. NOTE: that repoints the statements' own rows only. The price lists, cards, restock lights and associates' figures are the page's own figures
 *   over the MASTER's baked book (tools/book.mjs readBook), so they still come from git until the Worker's PRICING (S5b) and the flip.
 * The chain runs \`--compare\` after the readcheck, continue-on-error: a difference is a red step and never blocks a fold. The log carries counts and codes only, never a figure or a row (the log is public).
 *
 *   node tools/book-source.mjs --compare            SALT_BASE, SALT_BOOK_KEY, CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET in the environment
 *   node tools/book-source.mjs --out <file>         (refuses to overwrite) */
import "./cloudflare.mjs";
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { appendFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { canon } from "../src/book.js";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** The Book's base as a book file: {v, rev, at, book, derived}, or {error}. Retries a 5xx or a network failure; a 4xx is final. */
export async function fetchBookSource(base, env, { tries = 3, wait = 2000, fetchImpl = fetch, view = false } = {}) {
  const key = String(env.SALT_BOOK_KEY || "");
  if (!key) return { error: "SALT_BOOK_KEY is not set, so the Book was not read" };
  const headers = { "X-Book-Key": key };
  if (env.CF_ACCESS_CLIENT_ID && env.CF_ACCESS_CLIENT_SECRET) {
    headers["CF-Access-Client-Id"] = env.CF_ACCESS_CLIENT_ID;
    headers["CF-Access-Client-Secret"] = env.CF_ACCESS_CLIENT_SECRET;
  }
  let last = "";
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetchImpl(base.replace(/\/+$/, "") + "/book/ledger" + (view ? "?view=1" : ""), { headers });
      const j = await r.json().catch(() => ({}));
      if (r.status === 200 && j && j.ok && j.book && typeof j.book === "object") return j;
      last = "HTTP " + r.status + " " + String((j && j.error) || "").slice(0, 200);
      if (r.status < 500) return { error: last };
    } catch (e) { last = String((e && e.message) || e); }
    if (i < tries) await new Promise((res) => setTimeout(res, wait));
  }
  return { error: last };
}

/* make_statements reads its book once, at import, from SALT_BOOK; a query on the specifier gives a module of its own, so two books can be read in one process. Modules are cached by specifier,
   so every call takes a tag of its own: a second comparison in one process must not read the first one's book. */
let calls = 0;
async function statementsOver(file, tag) {
  const was = process.env.SALT_BOOK;
  process.env.SALT_BOOK = file;
  try { return await import(pathToFileURL(join(REPO, "tools", "make_statements.mjs")).href + "?book-source=" + tag + "-" + (++calls)); }
  finally { if (was === undefined) delete process.env.SALT_BOOK; else process.env.SALT_BOOK = was; }
}

/** The version the checkout's ledger/ledger.json is for: its TOP-LEVEL `v`, which is exactly what tools/book-load.mjs sends the Book (`ledger.json` is {v, stamped, source, ledger: {PRICING, ...}}), or null. */
export function gitVersion(file) {
  try { const j = JSON.parse(readFileSync(file, "utf8")); return typeof j.v === "string" && j.v ? j.v : null; } catch (e) { return null; }
}

/** What the chain runs: the fetched Book against the checkout (book file and ledger.json), compared only when both are at the same version. */
export function compareCheckout(f, { gitFile = join(REPO, "ledger", "book.json"), ledgerFile = join(REPO, "ledger", "ledger.json"), now = new Date(), codes = null } = {}) {
  return compareLive(gitFile, f, { now, codes, gitV: gitVersion(ledgerFile) });
}

/** Every account's live statement from git's book file and from the fetched book: { ok, accounts, differ: [codes], same: bool (the two books equal), error? }. \`now\` is one moment for both. */
export async function compareLive(gitFile, fetched, { now = new Date(), codes = null, gitV = null } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "salt-book-source-"));
  try {
    /* a Book one load behind the checkout (the load failed closed, or was refused) is not a difference in the builder: say so, and do not compare (Fable, 28 Oct 2026) */
    if (gitV && fetched.v !== gitV) return { ok: false, accounts: 0, differ: [], same: false, error: "the Book is at " + fetched.v + " and the checkout at " + gitV + ", so nothing was compared" };
    const gitBook = JSON.parse(readFileSync(gitFile, "utf8"));
    const bookFile = join(dir, "book.json");
    writeFileSync(bookFile, JSON.stringify(fetched.book));
    const a = await statementsOver(resolve(gitFile), "git"), b = await statementsOver(bookFile, "book");
    const roster = (codes || gitBook.roster || []).filter((c) => typeof c === "string" && !c.endsWith("-R"));
    const differ = [];
    for (const code of roster) {
      let x, y;
      try { x = canon(a.liveStatement(code, now, null)); } catch (e) { x = "threw: " + String((e && e.message) || e).slice(0, 80); }
      try { y = canon(b.liveStatement(code, now, null)); } catch (e) { y = "threw: " + String((e && e.message) || e).slice(0, 80); }
      if (x !== y) differ.push(code);
    }
    return { ok: !differ.length, accounts: roster.length, differ, same: canon(gitBook) === canon(fetched.book) };
  } catch (e) { return { ok: false, accounts: 0, differ: [], same: false, error: String((e && e.message) || e).slice(0, 200) }; }
  finally { rmSync(dir, { recursive: true, force: true }); }
}

/** the one line the step says: counts, the revision and codes (first five), never a figure */
export function line(f, r) {
  if (!f || f.error) return "Book source NOT READ: " + ((f && f.error) || "no answer");
  const head = "Book source: Book " + f.v + ", rev " + f.rev + ", " + ((f.book.sales || []).length) + " sales";
  if (r && r.error) return head + "; NOT COMPARED: " + r.error;
  if (!r) return head;
  return r.ok && r.same ? head + "; the live statements of " + r.accounts + " accounts built from the Book equal those built from git"
    : head + "; DIFFER: " + (r.same ? "" : "the two books are not equal; ") + r.differ.length + " of " + r.accounts + " statements" + (r.differ.length ? " (" + r.differ.slice(0, 5).join(", ") + (r.differ.length > 5 ? ", ..." : "") + ")" : "");
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const argv = process.argv.slice(2), base = process.env.SALT_BASE || "https://salt-command.qyts8mh72kyg.workers.dev";
  const outAt = argv.indexOf("--out"), out = outAt >= 0 ? argv[outAt + 1] : null;
  if (out && existsSync(out)) { console.error("REFUSED: " + out + " exists; this tool never overwrites."); process.exit(1); }
  const f = await fetchBookSource(base, process.env, { view: argv.includes("--view") });
  if (f.error) { console.log("::error::" + line(f)); process.exit(1); }
  if (out) { writeFileSync(out, JSON.stringify(f.book), { flag: "wx" }); console.log("WROTE (plaintext, the whole ledger): " + out); }
  if (!argv.includes("--compare")) { console.log(line(f)); process.exit(0); }
  const r = await compareCheckout(f);
  const said = line(f, r), good = !!(r.ok && r.same && !r.error);
  console.log(good ? said : "::error::" + said);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, "\n### Book (second publish)\n" + said + "\n");
  process.exit(good ? 0 : 1);
}
