/* test/s5f-edit.mjs: S5f-5 OF THE BOOK PLAN, THE `edit` ENTRY (his answer to Ask A, 28 Oct 2026): a refund the book still owes marked paid, or a stale refund taken off, as an entry he approves in Salt Admin and the tap books.
 * Dormant: nothing drafts one until Salt Admin's refund card sends it, and the draft table takes the collection only after migration 0024 (applied alone). Each check is red under its own mutation (test/s5f-edit.mutations.json):
 *   1  migration 0024: the rebuilt draft table keeps every row and every collection, takes `edit`, refuses a collection it does not name, and has all four indexes the live table carries
 *   2  the engine: a refund is named by party, since and amount and must be the ONE open refund those pick out; paid sets the day, remove takes it off; nothing else moves; a re-run does nothing; each refusal says why
 *   3  the drafter: the row, the reasoning and the flags; a refund the Book's read does not hold is skipped, and a read without the refunds says it was not checked
 *   4  the maker route: its own fields, kinds and days; a twin waiting is refused; the catalogue lists the open refunds and the edits waiting
 *   5  the Book: a tapped edit is in the view, replays, and compacts to the same base; a refused edit books nothing
 *   6  Salt Admin: the refund card sits on the account card, asks once, and sends the edit to the route */
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { objectState } from "./orderbook-harness.mjs";
import { frozenBook } from "./frozen.mjs";
import { Book, canon } from "../src/book.js";
import POSITION_ENGINE from "../engine/position.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const V = "v1252", AT_STAMP = "28 Oct 2026, 10:00 KL", T = (n) => "2031-01-0" + n;
const IDN = (n) => "2031-01-02T0" + n + ":00:00.000Z";

export async function run({ ok }) {
  const { draftRow } = await import("../src/drafter.js");
  const { makerEdit, makerInputCatalog } = await import("../src/maker-inputs.js");
  const R = await import("../src/book-read.js");
  const fb = () => {
    const b = frozenBook(); b.roster.push("ZZ1-AAA", "ZZ2-BBB"); b.STATED_STOCK = 10;
    b.customerRefunds = (b.customerRefunds || []).concat([
      { party: "ZZ1-AAA", amount: 40, since: T(1), note: "over-tender" },
      { party: "ZZ2-BBB", amount: 15, since: T(1), note: "twin one" }, { party: "ZZ2-BBB", amount: 15, since: T(1), note: "twin two" },
      { party: "ZZ1-AAA", amount: 9, since: T(1), paidOn: T(2), note: "already paid" }]);
    return b;
  };
  const derived = { OPEN: { v: V, at: "2026-10-28T01:00:00.000Z", count: 0, byKey: {} }, TERMS: { creditDays: 7 }, REWARD: { stated: {} }, STOCK: { today: "2026-10-28", books: {} } };
  const pricing = { v: V, floors: { salt: { 1: 60 } }, sizes: [0.5, 1] };

  /* 1: the migration */
  {
    const files = readdirSync(join(REPO, "migrations")).filter((x) => /^\d+_.*\.sql$/.test(x)).sort();
    const db = new DatabaseSync(":memory:");
    for (const f of files.filter((x) => x < "0024")) db.exec(readFileSync(join(REPO, "migrations", f), "utf8"));
    const cols = ["sales", "purchases", "count", "loss", "lostDemand", "roster", "priceset", "loan", "repayment", "rename", "place", "tierset", "label"];
    cols.forEach((c, i) => db.prepare("INSERT INTO draft (id,status,collection,entry,row,reasoning,drafter,drafted_at,committed_at) VALUES (?,?,?,?,?,?,?,?,?)").run("2026-10-28T00:00:0" + (i % 10) + "." + String(i).padStart(3, "0") + "Z", i % 2 ? "approved" : "pending", c, "{}", "{}", "r", "d", "2026-10-28T00:00:00.000Z", i % 3 ? null : "2026-10-28T01:00:00.000Z"));
    const before = db.prepare("SELECT COUNT(*) AS n FROM draft").get().n, sum = JSON.stringify(db.prepare("SELECT id,status,collection,committed_at FROM draft ORDER BY id").all());
    let refused = null; try { db.prepare("INSERT INTO draft (id,status,collection,entry,row,reasoning,drafter,drafted_at) VALUES ('x','pending','edit','{}','{}','r','d','d')").run(); } catch (e) { refused = e.message; }
    ok(/CHECK/.test(refused || ""), "before the migration the table refuses the collection edit: " + refused);
    db.exec(readFileSync(join(REPO, "migrations", "0024_draft_edit.sql"), "utf8"));
    const after = db.prepare("SELECT COUNT(*) AS n FROM draft").get().n;
    ok(before === cols.length && after === before && JSON.stringify(db.prepare("SELECT id,status,collection,committed_at FROM draft ORDER BY id").all()) === sum, "the rebuild keeps every row, with its status, collection and committed moment: " + before + " to " + after);
    db.prepare("INSERT INTO draft (id,status,collection,entry,row,reasoning,drafter,drafted_at) VALUES ('2026-10-28T09:00:00.000Z','pending','edit','{}','{}','r','d','d')").run();
    let bad = null; try { db.prepare("INSERT INTO draft (id,status,collection,entry,row,reasoning,drafter,drafted_at) VALUES ('y','pending','bogus','{}','{}','r','d','d')").run(); } catch (e) { bad = e.message; }
    ok(/CHECK/.test(bad || ""), "the new table takes edit and still refuses a collection it does not name");
    const idx = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='draft' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((r) => r.name).join();
    ok(idx === "draft_amends,draft_committed,draft_status,draft_status_committed", "all four indexes the live table carries are made again (a rebuild drops them): " + idx);
    const mig = readFileSync(join(REPO, "migrations", "0024_draft_edit.sql"), "utf8").replace(/--[^\n]*/g, "");
    ok(/'tierset','label','edit'\)/.test(mig) && (mig.match(/CREATE INDEX IF NOT EXISTS/g) || []).length === 4, "and the file names the collection and the four indexes");
  }

  /* 2: the engine, through the Book's own plan and apply */
  const bookOf = async (b = fb()) => {
    const B = new Book(objectState(), {}); let t = 0;
    B.clock = () => "2026-10-28T10:00:" + String(10 + (t++ % 50)).padStart(2, "0") + ".000Z";
    const call = async (path, init) => { const r = await B.fetch(new Request("https://book" + path, init)); return { status: r.status, ...(await r.json()) }; };
    await B.fetch(new Request("https://book/load", { method: "POST", body: JSON.stringify({ rev: "r", book: b, pricing, derived, v: V, stamped: AT_STAMP }) }));
    return { B, call, tap: (items) => call("/tap", { method: "POST", body: JSON.stringify({ items, day: T(2), v: V }) }), read: (q = "") => call("/read" + q) };
  };
  const item = (id, row) => ({ id, status: "approved", collection: "edit", row });
  const paid = (extra = {}) => ({ kind: "refundPaid", party: "ZZ1-AAA", since: T(1), amount: 40, paidOn: T(3), ...extra });
  const rm = (extra = {}) => ({ kind: "refundRemove", party: "ZZ1-AAA", since: T(1), amount: 40, ...extra });
  const refundsOf = (r) => (r.rows.customerRefunds || []);
  const A = await bookOf();
  const t1 = await A.tap([item(IDN(1), paid())]);
  const v1 = refundsOf(await A.read()).find((r) => r.party === "ZZ1-AAA" && r.amount === 40);
  ok(t1.ok && t1.booked.length === 1 && v1 && v1.paidOn === T(3) && v1.note === "over-tender", "a refund marked paid takes the day and keeps its note: " + JSON.stringify([t1.ok, v1]));
  const t1b = await A.tap([item(IDN(1), paid())]);
  ok(t1b.ok && t1b.booked[0].again === true && refundsOf(await A.read()).filter((r) => r.paidOn === T(3)).length === 1, "tapped again it is the same booking and changes nothing more");
  const t2 = await A.tap([item(IDN(2), paid({ paidOn: T(4) }))]);
  ok(t2.status === 409 && /no open refund of RM 40 to ZZ1-AAA/.test(JSON.stringify(t2.refused)), "a second edit of the same refund finds it already paid and is refused, saying why: " + JSON.stringify(t2.refused));
  const B2 = await bookOf();
  const r1 = await B2.tap([item(IDN(3), rm())]);
  ok(r1.ok && !refundsOf(await B2.read()).some((r) => r.party === "ZZ1-AAA" && r.amount === 40 && !r.paidOn) && refundsOf(await B2.read()).some((r) => r.paidOn === T(2) && r.amount === 9), "a removal takes that open refund off and leaves a paid one of the same party alone");
  const before = refundsOf(await B2.read()).length;
  const amb = await B2.tap([item(IDN(4), { kind: "refundRemove", party: "ZZ2-BBB", since: T(1), amount: 15 })]);
  ok(amb.status === 409 && /2 open refunds/.test(JSON.stringify(amb.refused)) && refundsOf(await B2.read()).length === before, "two refunds the three names do not tell apart refuse the edit and move nothing: " + JSON.stringify(amb.refused));
  const noDay = await B2.tap([item(IDN(5), paid({ party: "ZZ2-BBB", amount: 15, paidOn: "yesterday" }))]);
  const odd = await B2.tap([item(IDN(6), { ...rm(), kind: "refundEverything" })]);
  ok(noDay.status === 409 && odd.status === 409 && /day it went back|2 open/.test(JSON.stringify(noDay.refused)) && /not an edit/.test(JSON.stringify(odd.refused)), "a paid edit needs a real day and a kind the fold does not know is refused: " + JSON.stringify([noDay.refused, odd.refused]));
  const c = await B2.call("/compact", { method: "POST" }), base = refundsOf(await B2.read("?base=1"));
  ok(c.ok && c.compacted === 1 && !base.some((r) => r.party === "ZZ1-AAA" && r.amount === 40 && !r.paidOn), "a compaction writes the edit into the base, which holds the same refunds the view did: " + JSON.stringify([c.ok, c.compacted]));
  const pl = POSITION_ENGINE.editRefunds(fb().customerRefunds, { party: "ZZ1-AAA", since: T(1), amount: 40 });
  ok(pl.length === 1 && POSITION_ENGINE.editRefunds(fb().customerRefunds, { party: "ZZ1-AAA", since: T(1), amount: 9 }).length === 0 && POSITION_ENGINE.editRefunds(fb().customerRefunds, { party: "ZZ2-BBB", since: T(1), amount: 15 }).length === 2, "the engine's match is the open refunds those three name: one, none for a paid one, two for the twins");
  const en = POSITION_ENGINE.editEntry({ at: IDN(7), kind: "refundPaid", party: "ZZ1-AAA", since: T(1), amount: 40, paidOn: T(3) });
  ok(en.payload.mode === "edit" && en.payload.paidOn === T(3) && /Mark paid/.test(en.raw) && POSITION_ENGINE.editEntry({ at: IDN(7), kind: "refundRemove", party: "ZZ1-AAA", since: T(1), amount: 40 }).payload.paidOn === undefined, "the entry carries its payload, and a removal carries no paid day");

  /* 3: the drafter, on the Book's read and on a read with no refunds */
  {
    const mk = (payload) => POSITION_ENGINE.editEntry({ at: IDN(8), ...payload });
    const readOf = async () => R.bookOf({ ...(await (await bookOf()).read()), source: "book", rev: 1, derivedRev: 1 });
    const ok1 = draftRow(mk({ kind: "refundRemove", party: "ZZ2-BBB", since: T(1), amount: 15 }), await readOf());
    ok(ok1 && ok1.skip && /2 open refunds/.test(ok1.skip), "the drafter skips an edit the refunds do not single out, with the reason: " + JSON.stringify(ok1 && ok1.skip));
    const fresh = await readOf();
    const d = draftRow(mk({ kind: "refundPaid", party: "ZZ1-AAA", since: T(1), amount: 40, paidOn: T(3) }), fresh);
    ok(d.collection === "edit" && d.row.kind === "refundPaid" && d.row.paidOn === T(3) && d.row.amount === 40 && d.flags.length === 0 && /Marks the RM 40 refund to ZZ1-AAA/.test(d.reasoning), "a good edit drafts as the collection edit, its row and its reasoning, with no flag: " + JSON.stringify(d.row));
    const gone = draftRow(mk({ kind: "refundRemove", party: "ZZ1-AAA", since: T(1), amount: 41 }), fresh);
    ok(gone.skip && /no open refund of RM 41/.test(gone.skip), "a refund the book does not hold is skipped: " + gone.skip);
    const mirror = { ...fresh, customerRefunds: undefined };
    const m = draftRow(mk({ kind: "refundRemove", party: "ZZ1-AAA", since: T(1), amount: 40 }), mirror);
    ok(m.collection === "edit" && m.flags.some((f) => /not read here/.test(f)), "with a read that carries no refunds it drafts and says it was not checked: " + JSON.stringify(m.flags));
    const bad = draftRow(mk({ kind: "refundPaid", party: "ZZ1-AAA", since: T(1), amount: 40 }), fresh);
    ok(bad.skip && /went back/.test(bad.skip), "a paid edit without the day is skipped");
  }

  /* 4: the maker route's builder and the catalogue */
  {
    const fresh = R.bookOf({ ...(await (await bookOf()).read()), source: "book", rev: 1, derivedRev: 1 });
    const body = { at: IDN(9), kind: "refundPaid", party: "ZZ1-AAA", since: T(1), amount: 40, paidOn: T(3) };
    const good = makerEdit(body, fresh);
    ok(good.entry && good.entry.payload.mode === "edit" && good.draft.collection === "edit", "a good body builds the entry and its draft");
    const errs = [["extra field", { ...body, x: 1 }], ["no timestamp", { ...body, at: "no" }], ["kind", { ...body, kind: "delete" }], ["party", { ...body, party: "NOPE-1" }], ["day", { ...body, since: "31 Oct" }],
      ["amount", { ...body, amount: 0 }], ["paid day", { ...body, paidOn: undefined }], ["removal with a paid day", { ...body, kind: "refundRemove" }], ["long note", { ...body, note: "x".repeat(301) }]]
      .map(([n, b]) => [n, !!makerEdit(b, fresh).error]);
    ok(errs.every(([, e]) => e), "each malformed body is refused: " + JSON.stringify(errs.filter(([, e]) => !e)));
    const twin = makerEdit(body, fresh, [{ at: IDN(1), payload: { mode: "edit", party: "ZZ1-AAA", since: T(1), amount: 40 } }]);
    const own = makerEdit(body, fresh, [{ at: body.at, payload: { mode: "edit", party: "ZZ1-AAA", since: T(1), amount: 40 } }]);
    ok(twin.twin === true && !own.error, "an edit of the same refund already waiting is a twin, and a retry of the same request is not");
    const cat = makerInputCatalog({ ...fresh, customerRefunds: fresh.customerRefunds || [] }, {}, [{ at: IDN(1), payload: { mode: "edit", party: "ZZ1-AAA", since: T(1), amount: 40 } }], []);
    ok(Array.isArray(cat.openRefunds) && cat.openRefunds.some((r) => r.party === "ZZ1-AAA" && r.amount === 40 && r.since === T(1)) && !cat.openRefunds.some((r) => r.amount === 9) && cat.editWaiting.length === 1 && cat.editWaiting[0].party === "ZZ1-AAA",
      "the catalogue lists the open refunds (not a paid one) and the edits waiting: " + JSON.stringify(cat.openRefunds && cat.openRefunds.length));
  }

  /* 6: Salt Admin and the routes */
  {
    const owner = readFileSync(join(REPO, "stmt", "owner.js"), "utf8"), mk = readFileSync(join(REPO, "stmt", "maker.js"), "utf8"), wk = readFileSync(join(REPO, "src", "worker.js"), "utf8");
    ok(/function refundSection\(a, cat\)/.test(owner) && /rs=refundSection\(a, cat\)/.test(owner) && /send\('\/all\/maker\/inputs\/edit',body\)/.test(owner) && /Tap again to send it to Approve/.test(owner.slice(owner.indexOf("function refundSection"))) && !/[`]/.test(owner.slice(owner.indexOf("function refundSection"), owner.indexOf("function refundSection") + 2500)),
      "the refund card is on the account card, asks once, and sends the edit to its route (no backtick in the page's template)");
    ok((mk.match(/partner\|edit\|house-sizes/g) || []).length === 2 && (wk.match(/partner\|edit\|house-sizes/g) || []).length === 2, "the Counter and the Desk both let the route through");
    ok(/operation === "edit" \? makerEdit\(body, book, resourcePending\)/.test(wk), "and the Desk builds it with makerEdit over the entries waiting");
  }
}
