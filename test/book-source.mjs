/* test/book-source.mjs: S5e OF THE BOOK PLAN, THE COUNTER'S PUBLISH CAN READ THE BOOK (28 Oct 2026). Dormant: the publish still reads git. Each check red under its own mutation
 * (test/book-source.mutations.json):
 *   1  unshape puts a read back into ledger/book.json's shape: every array and document, the derived documents apart, an empty list still a list
 *   2  GET /book/ledger: a CI route behind the Book's key, read only, 503 while the Book holds nothing, the base by default and the view with ?view=1, the revision carried
 *   3  fetchBookSource: the keys it sends, a 4xx final, a 5xx and a lost connection retried, a missing key said
 *   4  compareLive: every account's live statement built from git's file and from the Book's shape, equal on equal books (the Book hands documents back with their keys sorted), and an account
 *      whose book differs is named; a missing file is an error, never an equality; the line the chain says carries counts and codes only
 *   5  the chain runs it after the readcheck, continue-on-error */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { objectState } from "./orderbook-harness.mjs";
import { frozenBook, FROZEN_BOOK } from "./frozen.mjs";
import { Book, canon, unshape } from "../src/book.js";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const V = "v1252", AT_STAMP = "28 Oct 2026, 10:00 KL";
const T = (n) => "2031-01-0" + n;
const IDN = (n) => "2031-01-02T0" + n + ":00:00.000Z";

export async function run({ ok }) {
  const worker = (await import("../src/worker.js")).default;
  const { fetchBookSource, compareLive, compareCheckout, line, gitVersion } = await import("../tools/book-source.mjs");
  const fb = () => { const b = frozenBook(); b.roster.push("ZZ1-AAA", "ZZ2-BBB"); b.STATED_STOCK = 10; return b; };
  const derived = { OPEN: { v: V, at: "2026-10-28T01:00:00.000Z", count: 0, byKey: {} }, TERMS: { creditDays: 7 }, REWARD: { stated: {} }, STOCK: { today: "2026-10-28", books: {} } };
  const pricing = { v: V, floors: { salt: { 1: 60 } }, sizes: [0.5, 1] };
  const mk = async (book = fb()) => {
    const os = objectState(), b = new Book(os, {});
    await b.fetch(new Request("https://book/load", { method: "POST", body: JSON.stringify({ rev: "r", book, pricing, derived, v: V, stamped: AT_STAMP }) }));
    return { os, b, ns: { idFromName: (n) => n, get: () => ({ fetch: (r) => b.fetch(r) }) }, read: async (q = "") => (await b.fetch(new Request("https://book/read" + q))).json() };
  };
  const sale = (id, qty, d) => ({ id, status: "approved", collection: "sales", row: { customer: "ZZ1-AAA", date: d, qty, total: qty * 100, cash: qty * 100, deliveredQty: qty, product: "salt" } });

  /* 1: unshape */
  const B = await mk();
  const base = await B.read("?base=1"), un = unshape(base);
  ok(canon(un.book) === canon(fb()), "unshape of the Book's base is the book that was loaded: every array, every document, every key");
  ok(Object.keys(un.derived).sort().join() === "OPEN,PRICING,REWARD,STOCK,TERMS" && canon(un.derived.TERMS) === canon(derived.TERMS) && un.derived.PRICING.v === V && !("PRICING" in un.book) && !("OPEN" in un.book),
    "the five derived documents and PRICING come back apart from the book, as ledger.json carries them: " + Object.keys(un.derived).sort().join());
  const withEmpty = fb(); withEmpty.partners = [];
  const E = await mk(withEmpty);
  const ue = unshape(await E.read("?base=1"));
  ok(Array.isArray(ue.book.partners) && ue.book.partners.length === 0 && ue.book.roster.length === fb().roster.length, "an empty list is still a list, and a list that is not a collection (the roster) comes back whole");
  const tapped = await B.b.fetch(new Request("https://book/tap", { method: "POST", body: JSON.stringify({ items: [sale(IDN(1), 2, T(2))], day: T(2), v: V }) }));
  const view = unshape(await B.read()), still = unshape(await B.read("?base=1"));
  ok((await tapped.json()).ok && view.book.sales.length === fb().sales.length + 1 && still.book.sales.length === fb().sales.length, "the view carries the tapped sale and the base does not");

  /* 2: the route */
  const env = (ns, extra = {}) => ({ REQUIRE_ACCESS: "0", SALT_BOOK_KEY: "bk", SALT_WRITE_KEY: "wk", BOOK: ns, ...extra });
  const get = async (path, headers, e, method = "GET") => { const r = await worker.fetch(new Request("https://salt.test" + path, { method, headers }), e, { waitUntil() {} }); return { status: r.status, body: await r.json().catch(() => null) }; };
  const ns = B.ns, good = { "X-Book-Key": "bk" };
  const r1 = await get("/book/ledger", good, env(ns));
  ok(r1.status === 200 && r1.body.ok && r1.body.v === V && Number.isInteger(r1.body.rev) && r1.body.view === false && r1.body.booked === 1 && canon(r1.body.book) === canon(fb()) && r1.body.derived.PRICING.v === V,
    "the route answers the Book's base as a book file with the version, the revision and the derived documents: " + JSON.stringify({ status: r1.status, v: r1.body && r1.body.v, rev: r1.body && r1.body.rev }));
  const r2 = await get("/book/ledger?view=1", good, env(ns));
  ok(r2.status === 200 && r2.body.view === true && r2.body.booked === 1 && r2.body.book.sales.length === fb().sales.length + 1, "?view=1 answers the base with the open entries replayed, and says how many");
  const r3 = await get("/book/ledger", good, env(ns));
  ok(r3.status === 200 && r3.body.view === false && r3.body.booked === 1 && r3.body.book.sales.length === fb().sales.length, "the base answer says how many entries are open (one) while carrying none of them");
  ok((await get("/book/ledger", {}, env(ns))).status !== 200 && (await get("/book/ledger", { "X-Book-Key": "wrong" }, env(ns))).status !== 200, "no key, or the wrong one, is refused");
  ok((await get("/book/ledger", good, env(ns), "POST")).status === 405, "it is read only: a POST is 405");
  ok((await get("/book/ledger", good, env(undefined))).status === 503, "no Book bound is 503");
  const empty = new Book(objectState(), {});
  ok((await get("/book/ledger", good, env({ idFromName: (n) => n, get: () => ({ fetch: (r) => empty.fetch(r) }) }))).status === 503, "a Book that holds nothing yet is 503, not an empty book");
  const gated = await get("/book/ledger", good, { REQUIRE_ACCESS: "1", ACCESS_TEAM: "t", ACCESS_AUD: "a", SALT_BOOK_KEY: "bk", BOOK: ns });
  ok(gated.status === 401 && /not authenticated/.test((gated.body && gated.body.error) || ""), "behind Access, with no login, it answers 401 as JSON, not the locked page");
  const wsrc = readFileSync(join(REPO, "src", "worker.js"), "utf8");
  ok(/CI_ROUTES = new Set\([^)]*"GET \/book\/ledger"/.test(wsrc), "it is a CI route (the service token reaches it, behind the Book's key)");

  /* 3: fetchBookSource */
  const keys = { SALT_BOOK_KEY: "bk", CF_ACCESS_CLIENT_ID: "id", CF_ACCESS_CLIENT_SECRET: "sec" };
  const seen = [];
  const answer = (...rs) => async (url, init) => { seen.push({ url, headers: init.headers }); const x = rs[Math.min(seen.length - 1, rs.length - 1)]; if (x instanceof Error) throw x; return { status: x.status, json: async () => x.body }; };
  const f1 = await fetchBookSource("https://x.test/", keys, { fetchImpl: answer({ status: 200, body: { ok: true, v: "v1", rev: 3, book: { sales: [] }, derived: {} } }), wait: 0 });
  ok(f1.v === "v1" && seen.length === 1 && seen[0].url === "https://x.test/book/ledger" && seen[0].headers["X-Book-Key"] === "bk" && seen[0].headers["CF-Access-Client-Id"] === "id" && seen[0].headers["CF-Access-Client-Secret"] === "sec",
    "it sends the Book's key and the service token to /book/ledger: " + JSON.stringify(seen[0]));
  seen.length = 0;
  const f2 = await fetchBookSource("https://x.test", keys, { fetchImpl: answer({ status: 403, body: { error: "no" } }), wait: 0 });
  ok(f2.error && /HTTP 403/.test(f2.error) && seen.length === 1, "a 4xx is final: one call, no retry");
  seen.length = 0;
  const f3 = await fetchBookSource("https://x.test", keys, { fetchImpl: answer({ status: 503, body: { error: "down" } }, { status: 503, body: { error: "down" } }, { status: 200, body: { ok: true, v: "v2", rev: 1, book: { sales: [] } } }), wait: 0 });
  ok(f3.v === "v2" && seen.length === 3, "a 5xx is retried, and the third answer is taken");
  seen.length = 0;
  const f4 = await fetchBookSource("https://x.test", keys, { fetchImpl: answer(new Error("ECONNRESET")), wait: 0 });
  ok(f4.error === "ECONNRESET" && seen.length === 3, "a lost connection is retried three times and then said");
  const f5 = await fetchBookSource("https://x.test", {}, { fetchImpl: answer({ status: 200, body: {} }), wait: 0 });
  ok(/SALT_BOOK_KEY is not set/.test(f5.error), "no key is said, and nothing is asked");
  seen.length = 0;
  await fetchBookSource("https://x.test", keys, { fetchImpl: answer({ status: 200, body: { ok: true, book: {} } }), wait: 0, view: true });
  ok(/book\/ledger\?view=1$/.test(seen[0].url), "the view is asked for with view: true");
  const f6 = await fetchBookSource("https://x.test", keys, { fetchImpl: answer({ status: 200, body: { ok: true } }), wait: 0 });
  ok(!!f6.error, "an answer with no book is an error, not a book");

  /* 4: compareLive */
  const now = new Date("2026-10-28T08:00:00.000Z");
  const git = frozenBook();
  const sorted = JSON.parse(canon(git));   /* the Book's shape: every object's keys in sorted order */
  const some = (git.roster || []).filter((c) => !c.endsWith("-R")).slice(0, 12);
  const eq = await compareLive(FROZEN_BOOK, { v: V, rev: 1, book: sorted }, { now, codes: some });
  ok(eq.ok && eq.same && eq.accounts === some.length && eq.differ.length === 0, "the live statements built from the Book's key-sorted shape equal those built from git's file: " + JSON.stringify(eq));
  const cust = git.sales.filter((s) => s.customer && some.includes(s.customer) && +s.total > 0)[0];
  const changed = JSON.parse(canon(git)); changed.sales.find((s) => s.rid === cust.rid).total = +cust.total + 1;
  const df = await compareLive(FROZEN_BOOK, { v: V, rev: 1, book: changed }, { now, codes: some });
  ok(!df.ok && !df.same && df.differ.includes(cust.customer) && df.differ.length < some.length, "an account whose book differs is named, and only it (not the books in general): " + JSON.stringify(df));
  const dir = mkdtempSync(join(tmpdir(), "salt-bs-test-"));
  try {
    const gone = await compareLive(join(dir, "nope.json"), { book: sorted }, { now, codes: some });
    ok(!gone.ok && !!gone.error && gone.accounts === 0, "a git file that is not there is an error, never an equality");
  } finally { rmSync(dir, { recursive: true, force: true }); }
  const withBucket = await compareLive(FROZEN_BOOK, { v: V, rev: 1, book: sorted }, { now, codes: [...some, "ZZ9-BKT-R"] });
  ok(withBucket.accounts === some.length, "a bucket (a -R code) is never an account of its own: it is left out of the comparison, as the publish leaves it out");
  const behind = await compareLive(FROZEN_BOOK, { v: "v1200", rev: 1, book: sorted }, { now, codes: some, gitV: "v1201" });
  ok(!behind.ok && behind.accounts === 0 && /Book is at v1200 and the checkout at v1201, so nothing was compared/.test(behind.error || "") && behind.differ.length === 0, "a Book one load behind the checkout is not compared, and is not called a difference: " + JSON.stringify(behind));
  const level = await compareLive(FROZEN_BOOK, { v: "v1201", rev: 1, book: sorted }, { now, codes: some, gitV: "v1201" });
  ok(level.ok && level.accounts === some.length, "at the same version it is compared as before");
  /* the version the CLI compares with is the top-level v of ledger.json, as the load sends it: read off the real file's shape, and off a file with PRICING.v alone it is null */
  const dir2 = mkdtempSync(join(tmpdir(), "salt-bs-test-"));
  writeFileSync(join(dir2, "shape.json"), JSON.stringify({ v: "v1303", stamped: "x", source: "y", ledger: { PRICING: { v: "v1299" }, OPEN: { v: "v1299" } } }));
  ok(gitVersion(join(dir2, "shape.json")) === "v1303", "gitVersion reads a ledger.json of the shape tools/ledger.mjs writes, {v, stamped, source, ledger: {PRICING, ...}}: its top-level v");
  try {
    writeFileSync(join(dir2, "a.json"), JSON.stringify({ ledger: { PRICING: { v: "v9" } } }));
    writeFileSync(join(dir2, "b.json"), "not json");
    ok(gitVersion(join(dir2, "a.json")) === null && gitVersion(join(dir2, "b.json")) === null && gitVersion(join(dir2, "none.json")) === null, "a file with no top-level v, a file that is not JSON and a missing file read as null (and nothing is then compared by version)");
    /* what the chain runs: a ledger.json at another version than the Book is not compared, one at the same version is */
    writeFileSync(join(dir2, "l-old.json"), JSON.stringify({ v: "v1200", ledger: {} }));
    writeFileSync(join(dir2, "l-now.json"), JSON.stringify({ v: V, ledger: {} }));
    const byOld = await compareCheckout({ v: V, rev: 1, book: sorted }, { gitFile: FROZEN_BOOK, ledgerFile: join(dir2, "l-old.json"), now, codes: some });
    const byNow = await compareCheckout({ v: V, rev: 1, book: sorted }, { gitFile: FROZEN_BOOK, ledgerFile: join(dir2, "l-now.json"), now, codes: some });
    ok(!byOld.ok && /Book is at v1252 and the checkout at v1200/.test(byOld.error || "") && byNow.ok && byNow.accounts === some.length, "the chain's compare reads the checkout's ledger.json version and compares only at the same one: " + JSON.stringify([byOld.error, byNow.ok]));
  } finally { rmSync(dir2, { recursive: true, force: true }); }
  const same2 = await compareLive(FROZEN_BOOK, { v: V, rev: 1, book: sorted }, { now, codes: [] });
  ok(same2.accounts === 0 && same2.same === true, "with no accounts named only the books are compared");
  const f = { v: "v1304", rev: 6, book: { sales: [1, 2, 3] } };
  const L1 = line(f, { ok: true, same: true, accounts: 41, differ: [] }), L2 = line(f, { ok: false, same: true, accounts: 41, differ: ["A", "B", "C", "D", "E", "F", "G"] }), L3 = line(f, { ok: false, same: false, accounts: 41, differ: [] });
  ok(/Book v1304, rev 6, 3 sales; the live statements of 41 accounts built from the Book equal those built from git/.test(L1) && /DIFFER: 7 of 41 statements \(A, B, C, D, E, \.\.\.\)/.test(L2) && /DIFFER: the two books are not equal; 0 of 41/.test(L3)
    && /NOT READ: boom/.test(line({ error: "boom" })) && /NOT COMPARED: x/.test(line(f, { error: "x" })) && !/\d{3,}\.\d\d/.test(L1 + L2 + L3),
  "the chain's line carries counts, the revision and codes (five at most), and says plainly when it could not read or compare: " + L2);

  /* 5: the chain */
  const yml = readFileSync(join(REPO, ".github", "workflows", "cloud-commit.yml"), "utf8");
  const at = yml.indexOf("- name: Check the readers agree"), bs = yml.indexOf("- name: Check the Book builds the same statements");
  const step = bs > 0 ? yml.slice(bs, yml.indexOf("\n      #", bs + 10) > 0 ? yml.indexOf("\n      #", bs + 10) : bs + 900) : "";
  ok(at > 0 && bs > at && /continue-on-error: true/.test(step) && /if: steps\.plan\.outputs\.deploy == '1'/.test(step) && /run: node tools\/book-source\.mjs --compare/.test(step) && /SALT_BOOK_KEY: \$\{\{ secrets\.SALT_BOOK_KEY \}\}/.test(step),
    "the chain runs the comparison after the readcheck, only on a deploy, continue-on-error, with the Book's key");
}
