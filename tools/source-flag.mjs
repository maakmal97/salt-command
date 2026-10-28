#!/usr/bin/env node
/* tools/source-flag.mjs: S5f-3 OF THE BOOK PLAN, THE LAPTOP AND THE CHAIN READ WHICH STORE IS THE SOURCE (28 Oct 2026).
 *
 * The D1 flag `book_source` (migrations/0023, shipped 'd1') says whether git's ledger/book.json ('d1') or the Book ('book') is the source of the ledger. The Worker reads it as sourceMode
 * (src/book-tap.js); this is the one reader for everything that runs outside the Worker, through wrangler like tools/drafts.mjs, and it FAILS CLOSED:
 *   'd1'    the table says d1, or there is no table yet (a store before migrations/0023 is the old world)
 *   'book'  the table says book
 *   null    D1 would not answer. A guard must refuse and the chain must stop: guessing 'd1' lets a laptop approve or a fold write a second ledger over the Book; guessing 'book' only delays.
 *
 *   node tools/source-flag.mjs                  print source=d1|book (exit 0), or the refusal to read it (exit 1)
 *   node tools/source-flag.mjs --github         also write mode=d1|book to $GITHUB_OUTPUT, for the chain's `source` step
 *   node tools/source-flag.mjs --refuse "<what>"  exit 3 with a one-line reason when the Book is the source or the flag cannot be read: what a laptop road runs first
 *   --local                                     the local D1 rather than the remote one
 */
import { againIfLapsed } from "./cloudflare.mjs";
import { d1Result, commandArgs } from "./d1json.mjs";
import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const SOURCE_SQL = "SELECT mode FROM book_source WHERE one=1";

/** wrangler's {code, out} for the flag read, as {mode: 'd1'|'book'|null, error?} */
export function sourceFrom(r) {
  const res = d1Result(r);
  if (res.error) return /no such table/i.test(res.error) ? { mode: "d1", why: "no book_source table yet" } : { mode: null, error: res.error };
  const row = res.sets.flatMap((s) => s.results)[0];
  return { mode: row && row.mode === "book" ? "book" : "d1" };
}

const wrangler = (args) => {
  const r = againIfLapsed(() => spawnSync("npx", ["wrangler", ...args], { cwd: REPO, shell: true, encoding: "utf8" }));
  return { code: r.status === null ? 1 : r.status, out: ((r.stdout || "") + (r.stderr || "")).trim() };
};

/** read the flag from D1 (`run` is wrangler's runner, replaced by the suite) */
export function readSource(where = "--remote", run = wrangler) {
  return sourceFrom(run(["d1", "execute", "salt_ledger", where, "--json", ...commandArgs(SOURCE_SQL)]));
}

/** a laptop road's verdict: {ok: true}, or {ok: false, why} when the Book is the source or the flag cannot be read */
export function guardVerdict(src, what) {
  if (src && src.mode === "d1") return { ok: true };
  if (src && src.mode === "book") return { ok: false, why: what + " is refused: the Book is the source of the ledger (D1 book_source reads book). A second writer would be a second ledger. Approve in Salt Admin, or load a hand edit as an edit entry or an import (docs/DESK.md, \"The flip\")." };
  return { ok: false, why: what + " is refused: D1 would not say which store is the source (" + String((src && src.error) || "no answer").slice(0, 160) + "), and guessing the old world could write a second ledger over the Book." };
}

/** run first by a laptop road that writes the ledger or an approval: exits 3 with the reason, or returns when the old world stands */
export function refuseIfBook(what, where = "--remote", run = wrangler) {
  const v = guardVerdict(readSource(where, run), what);
  if (!v.ok) { console.log("  REFUSED  " + v.why); process.exit(3); }
  return true;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const argv = process.argv.slice(2), where = argv.includes("--local") ? "--local" : "--remote";
  const i = argv.indexOf("--refuse");
  if (i >= 0) { refuseIfBook(argv[i + 1] || "this road", where); console.log("  ok    the old world stands: git is the source"); process.exit(0); }
  const s = readSource(where);
  if (!s.mode) { console.log("::error::" + (s.error || "the source flag could not be read")); process.exit(1); }
  console.log("source=" + s.mode + (s.why ? " (" + s.why + ")" : ""));
  if (argv.includes("--github") && process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, "mode=" + s.mode + "\n");
  process.exit(0);
}
