/* frozen.mjs: the suite reads a frozen copy of the book, never the live one (S0 of the Book plan).
 *
 * Import this FIRST in any entry that runs sections: it sets SALT_BOOK to test/fixtures/book-frozen.json (ledger/book.json
 * as it stood at the sha in book-frozen.sha) and, unless a run already names a master, SALT_MASTER to a temp copy of the
 * CURRENT master with only its BOOK block rendered from that fixture. The master is rebuilt on every run, never stored, so
 * a desk code change is still tested and a phone fold (which only moves ledger/book.json and the BOOK block) cannot turn a
 * check red. Every tool and test that honours SALT_BOOK / SALT_MASTER follows without an edit; a check that is about the
 * LIVE book (order, master-matches-book) reads LIVE_BOOK, LIVE_MASTER or runs a child with liveEnv(). */
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { syncText } from "../tools/booksync.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const LIVE_BOOK = join(REPO, "ledger", "book.json");
export const LIVE_MASTER = join(REPO, "master", "salt_command.html");
export const FROZEN_BOOK = join(REPO, "test", "fixtures", "book-frozen.json");

/* the environment a child needs to see the live files: neither override */
export function liveEnv(extra = {}) {
  const e = { ...process.env, ...extra };
  for (const k of ["SALT_BOOK", "SALT_MASTER"]) if (!(k in extra)) delete e[k];
  return e;
}
export const frozenBook = () => JSON.parse(readFileSync(FROZEN_BOOK, "utf8"));
export const liveBook = () => JSON.parse(readFileSync(LIVE_BOOK, "utf8"));

if (!process.env.SALT_BOOK) process.env.SALT_BOOK = FROZEN_BOOK;
if (!process.env.SALT_MASTER) {
  const dir = mkdtempSync(join(tmpdir(), "salt-frozen-"));
  const file = join(dir, "salt_command.html");
  writeFileSync(file, syncText(readFileSync(LIVE_MASTER, "utf8"), JSON.parse(readFileSync(process.env.SALT_BOOK, "utf8"))));
  process.env.SALT_MASTER = file;
  process.on("exit", () => { try { rmSync(dir, { recursive: true, force: true }); } catch (e) { /* a peer's cleanup */ } });
}
export const FROZEN_MASTER = process.env.SALT_MASTER;
