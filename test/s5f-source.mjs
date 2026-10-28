/* test/s5f-source.mjs: S5f-1 OF THE BOOK PLAN, THE SOURCE FLAG (28 Oct 2026). Dormant: the D1 flag book_source ships 'd1'. Each check red under its own mutation (test/s5f-source.mutations.json):
 *   1  sourceMode reads 'book' only when D1 says exactly 'book'; a missing table, an empty row, an unreadable store or any other word reads 'd1' (the old world)
 *   2  migration 0023 creates the one-row flag, ships it 'd1', allows only 'd1' and 'book', and touches nothing else */
import { readFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function run({ ok }) {
  const { sourceMode } = await import("../src/book-tap.js");
  const fake = (row) => ({ prepare: () => ({ first: async () => row }) });
  ok(await sourceMode(fake({ mode: "book" })) === "book" && await sourceMode(fake({ mode: "d1" })) === "d1", "the flag reads book only when D1 says book, and d1 when it says d1");
  ok(await sourceMode(fake(null)) === "d1" && await sourceMode(fake({})) === "d1" && await sourceMode(fake({ mode: "on" })) === "d1" && await sourceMode(fake({ mode: "BOOK" })) === "d1",
    "an empty row, a row with no mode, and any word but the exact one read d1: the old world is the default");
  ok(await sourceMode({ prepare: () => { throw new Error("no such table: book_source"); } }) === "d1" && await sourceMode({ prepare: () => ({ first: async () => { throw new Error("D1 down"); } }) }) === "d1",
    "a store before the migration, and a store that will not answer, read d1");
  const asked = [];
  await sourceMode({ prepare: (s) => { asked.push(s); return { first: async () => null }; } });
  ok(asked.length === 1 && /FROM book_source WHERE one=1/.test(asked[0]), "it reads the one row of book_source: " + asked.join("|"));
  const mig = readFileSync(join(REPO, "migrations", "0023_book_source.sql"), "utf8"), code = mig.replace(/--[^\n]*/g, "");
  ok(/CREATE TABLE IF NOT EXISTS book_source/.test(code) && /VALUES \(1, 'd1'\)/.test(code) && /CHECK \(mode IN \('d1','book'\)\)/.test(code) && !/DROP|DELETE|ALTER|UPDATE/i.test(code),
    "migration 0023 creates the one-row flag shipped d1, allows d1 and book alone, and touches nothing else");
}
