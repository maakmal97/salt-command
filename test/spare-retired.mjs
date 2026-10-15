/* test/spare-retired.mjs: spare, the fifth book, is retired (15 Oct 2026). On the LIVE book: it is flagged and holds no row, the
   Counter's word list names exactly the live books, and the one road that retires a book (tools/product.mjs) changes the book by
   the one line, never re-laying the file. */
import { readFileSync, writeFileSync, mkdtempSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { LIVE_BOOK, LIVE_MASTER } from "./frozen.mjs";

export async function run({ ok }) {
  const O = await import("../src/orders.js");
  const book = JSON.parse(readFileSync(LIVE_BOOK, "utf8"));
  const rows = ["sales", "purchases", "loans", "COUNTS", "selfUseLog", "lostDemand"].reduce((n, k) => n + (book[k] || []).filter((r) => r && r.product === "spare").length, 0);
  ok(book.PRODUCTS.spare && book.PRODUCTS.spare.retired === true && rows === 0, "spare is retired on the live book and holds no row: " + JSON.stringify({ retired: book.PRODUCTS.spare && book.PRODUCTS.spare.retired, rows }));
  const live = Object.values(book.PRODUCTS).filter((p) => !p.retired).map((p) => String(p.name).toLowerCase());
  ok(live.length === 4 && JSON.stringify(O.PRODUCT_WORDS.slice().sort()) === JSON.stringify(live.slice().sort()), "the Counter's product words are exactly the live books, spare not among them: " + JSON.stringify({ live, words: O.PRODUCT_WORDS }));
  /* the one road, on copies: unretiring spare touches the book by one line */
  const dir = mkdtempSync(join(tmpdir(), "spare-")), b = join(dir, "book.json"), m = join(dir, "master.html");
  try {
    copyFileSync(LIVE_BOOK, b); copyFileSync(LIVE_MASTER, m);
    const r = spawnSync(process.execPath, [resolve("tools", "product.mjs"), "--unretire", "spare"], { env: { ...process.env, SALT_BOOK: b, SALT_MASTER: m }, encoding: "utf8" });
    const a0 = readFileSync(LIVE_BOOK, "utf8").split("\n"), a1 = readFileSync(b, "utf8").split("\n");
    const changed = a0.length === a1.length ? a0.filter((l, i) => l !== a1[i]).length : -1;
    ok(r.status === 0 && changed === 1 && /"retired": false/.test(readFileSync(b, "utf8").split('"id": "spare"')[1] || ""), "product.mjs --unretire spare changes one line of the book and leaves its layout alone: " + JSON.stringify({ status: r.status, changed, err: String(r.stderr || "").slice(0, 120) }));
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
