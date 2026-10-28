/* test/s5f-export.mjs: S5f-6 OF THE BOOK PLAN, THE EXPORT AND THE DAILY NOTES (29 Oct 2026; his answer to Ask C). Dormant: the chain runs the export only with D1 `book_source` at book. Each check is red under its own mutation
 * (test/s5f-export.mutations.json):
 *   1  the Book's derived verb: it refreshes the documents for a revision without moving the revision, never goes ahead of the book or back, takes only the derived keys, and the Worker's route is keyed and book-only
 *   2  the Book's notes verb: it writes a note into a blank row and never over a written one, takes only a row of sales, purchases or loans by its rid, moves the revision once, and its limits hold
 *   3  the export end to end, through the Worker's own routes: the file written, the notes behind the rows, the documents for the revision the export leaves, the revision named for the publish; the day's run compacts first
 *   4  a failing step fails the run, and names which
 *   5  the chain: the day's export and the publish export are steps with their conditions, the plan decides the day by the net's hour or a dispatch, and the publish is not gated on either */
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { objectState } from "./orderbook-harness.mjs";
import { frozenBook } from "./frozen.mjs";
import { Book } from "../src/book.js";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const V = "v1252", AT_STAMP = "28 Oct 2026, 10:00 KL", T = (n) => "2031-01-0" + n;
const IDN = (n) => "2031-01-02T0" + n + ":00:00.000Z";

export async function run({ ok }) {
  const worker = (await import("../src/worker.js")).default;
  const { exportBook, blankNotes, postBook } = await import("../tools/book-export.mjs");
  const fb = () => { const b = frozenBook(); b.roster.push("ZZ1-AAA", "ZZ2-BBB"); b.STATED_STOCK = 10; return b; };
  const derived = { OPEN: { v: V, at: "2026-10-28T01:00:00.000Z", count: 0, byKey: {} }, TERMS: { creditDays: 7 }, REWARD: { stated: {} }, STOCK: { today: "2026-10-28", books: {} } };
  const pricing = { v: V, floors: { salt: { 1: 60 } }, sizes: [0.5, 1] };
  const sale = (id, qty) => ({ id, status: "approved", collection: "sales", row: { customer: "ZZ1-AAA", date: T(2), qty, total: qty * 100, cash: qty * 100, deliveredQty: qty, product: "salt" } });
  const world = (rows = []) => {
    const db = new DatabaseSync(":memory:");
    for (const f of readdirSync(join(REPO, "migrations")).filter((x) => /^\d+_.*\.sql$/.test(x)).sort()) db.exec(readFileSync(join(REPO, "migrations", f), "utf8"));
    for (const r of rows) db.prepare("INSERT INTO draft (id,status,collection,entry,row,reasoning,drafter,drafted_at,decided_at) VALUES (?,?,'sales','{}','{}','fixture','cloud-drafter','2026-10-28T09:00:00.000Z','2026-10-28T09:00:00.000Z')").run(r, "approved");
    const mkq = (a, sql) => { const st = db.prepare(sql); return { sql, run() { const x = st.run(...a); return { meta: { changes: Number(x.changes || 0) } }; }, first() { const x = st.get(...a); return x === undefined ? null : x; }, all() { return { results: st.all(...a) }; } }; };
    const D1 = { prepare(sql) { const o = mkq([], sql); o.bind = (...a) => mkq(a, sql); return o; }, batch(list) { return list.map((s) => (/^\s*select/i.test(s.sql) ? s.all() : s.run())); } };
    return { db, D1, source: (m) => db.exec("UPDATE book_source SET mode='" + m + "'") };
  };
  const mk = () => {
    const b = new Book(objectState(), {});
    const ns = { idFromName: (n) => n, get: () => ({ fetch: (r) => b.fetch(r) }) };
    const call = async (path, init) => { const r = await b.fetch(new Request("https://book" + path, init)); return { status: r.status, ...(await r.json()) }; };
    const post = (path, body) => call(path, { method: "POST", body: JSON.stringify(body) });
    return { b, ns, call, post, at: () => call("/at"), read: (q = "") => call("/read" + q),
      load: () => b.fetch(new Request("https://book/load", { method: "POST", body: JSON.stringify({ rev: "r", book: fb(), pricing, derived, v: V, stamped: AT_STAMP }) })).then((r) => r.json()),
      tap: (items) => call("/tap", { method: "POST", body: JSON.stringify({ items, day: T(2), v: V }) }) };
  };
  const ridsOf = (r) => (r.rows.sales || []).map((s) => s.rid).filter(Boolean);

  /* 1: derived */
  {
    const B = mk(); await B.load(); await B.tap([sale(IDN(1), 2)]);
    const a0 = await B.at(), docs = { PRICING: { v: "book@" + a0.rev, floors: { salt: { 1: 70 } }, takenAt: "x" }, OPEN: { v: "book@" + a0.rev, at: "now", count: 0, byKey: {} } };
    const r1 = await B.post("/derived", { derived: docs, forRev: a0.rev }), a1 = await B.at(), rd = await B.read();
    ok(r1.ok && r1.changed >= 1 && a1.rev === a0.rev && a1.derivedRev === a0.rev && rd.state.PRICING.floors.salt[1] === 70 && !("takenAt" in rd.state.PRICING), "a refresh sets the documents for the revision and moves no revision, and PRICING keeps no takenAt: " + JSON.stringify([r1.ok, r1.changed, a0.rev, a1.rev, a1.derivedRev]));
    const again = await B.post("/derived", { derived: docs, forRev: a0.rev });
    ok(again.ok && again.changed === 0, "the same documents again change nothing");
    const ahead = await B.post("/derived", { derived: docs, forRev: a0.rev + 1 }), back = await B.post("/derived", { derived: docs, forRev: a0.rev - 1 });
    ok(ahead.status === 409 && /ahead/.test(ahead.error) && back.status === 409 && back.stale === true && (await B.at()).derivedRev === a0.rev, "documents for a revision ahead of the Book are refused, and so are older ones than it already holds: " + JSON.stringify([ahead.error, back.error]));
    const bad = [await B.post("/derived", { derived: { sales: {} }, forRev: a0.rev }), await B.post("/derived", { derived: { PRICING: [] }, forRev: a0.rev }), await B.post("/derived", { derived: docs, forRev: "x" }), await B.post("/derived", {})];
    ok(bad.every((x) => x.status === 400), "only the derived keys, each a document, for a whole revision: " + bad.map((x) => x.status).join());
    const T0 = new Book(objectState(), { BOOK: { idFromName: (n) => n } }); T0.state.id = { equals: (o) => o === "book-pitr-test" };
    ok((await T0.fetch(new Request("https://book/derived", { method: "POST", body: "{}" }))).status === 404 && (await T0.fetch(new Request("https://book/notes", { method: "POST", body: "{}" }))).status === 404, "the recovery test's object answers neither verb");
    /* the Worker's route */
    const W = world(), env = { REQUIRE_ACCESS: "0", SALT_BOOK_KEY: "bk", SALT_WRITE_KEY: "wk", BOOK: B.ns, SALT_LEDGER: W.D1 };
    const hit = async (path, body, key = "bk", method = "POST") => { const r = await worker.fetch(new Request("https://salt.test" + path, { method, headers: key ? { "X-Book-Key": key } : {}, body: method === "POST" ? JSON.stringify(body) : undefined }), env, { waitUntil() { } }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
    const rev = (await B.at()).rev;
    ok((await hit("/book/derived", { derived: docs, forRev: rev })).status === 409 && (await hit("/book/derived", { derived: docs, forRev: rev }, null)).status === 401 && (await hit("/book/derived", {}, "bk", "GET")).status === 405, "the route is keyed, POST only, and refuses with git as the source");
    W.source("book");
    const g = await hit("/book/derived", { derived: docs, forRev: rev }), n = await hit("/book/notes", { notes: { s999: "x" } });
    ok(g.status === 200 && g.body.ok && n.status === 200 && n.body.ok, "and with the Book as the source it reaches both verbs: " + JSON.stringify([g.status, n.status]));
  }

  /* 2: notes */
  {
    const B = mk(); await B.load(); await B.tap([sale(IDN(1), 2)]); await B.post("/compact");   /* a note can be written only into the base: the row an open entry holds is not in it yet */
    const rd = await B.read(), tapped = ridsOf(rd).filter((r) => !(fb().sales.some((s) => s.rid === r)))[0];
    const had = fb().sales.find((s) => s.note && s.rid);
    const rev0 = (await B.at()).rev;
    const w = await B.post("/notes", { notes: { [tapped]: "  Booked by the tool.  ", [had.rid]: "overwritten?", s99999: "no such row" } });
    const after = await B.read(), row = after.rows.sales.find((s) => s.rid === tapped), old = after.rows.sales.find((s) => s.rid === had.rid);
    ok(w.ok && w.written === 1 && w.skipped === 2 && row.note === "Booked by the tool." && old.note === had.note && (await B.at()).rev === rev0 + 1, "a blank row gets its note (trimmed), a row with a written note and a row that is not there are left, and the revision moves once: " + JSON.stringify([w, (await B.at()).rev - rev0]));
    const again = await B.post("/notes", { notes: { [tapped]: "second try" } }), after2 = await B.read();
    ok(again.written === 0 && after2.rows.sales.find((s) => s.rid === tapped).note === "Booked by the tool." && (await B.at()).rev === rev0 + 1, "a note once written is never replaced, and nothing moves");
    const bad = [await B.post("/notes", {}), await B.post("/notes", { notes: {} }), await B.post("/notes", { notes: { x1: "t" } }), await B.post("/notes", { notes: { [tapped]: "" } }), await B.post("/notes", { notes: { [tapped]: "x".repeat(601) } }),
      await B.post("/notes", { notes: Object.fromEntries(Array.from({ length: 201 }, (_, i) => ["s" + String(100 + i).padStart(3, "0"), "t"])) })];
    ok(bad.every((x) => x.status === 400), "a body that is not 1 to 200 notes of a rid and some text is refused: " + bad.map((x) => x.status).join());
    const hold = (await B.read()).rows.purchases.find((p) => p.rid && !p.note);
    const bn = blankNotes({ sales: [{ rid: "s100", note: "" }, { rid: "s101", note: "kept" }, { note: "" }], purchases: [{ rid: "p100" }], loans: [{ rid: "l100", note: "  " }] }, "2031-01-02");
    const only = blankNotes({ sales: [{ rid: "s100" }, { rid: "s101" }] }, "2031-01-02", ["s101"]);
    ok(Object.keys(bn).sort().join() === "l100,p100,s100" && /not a model/.test(bn.s100) && Object.keys(only).join() === "s101", "the tool's notes are for rows with a rid and no written note, and say no model wrote them: " + Object.keys(bn).join());
  }

  /* 3: the export end to end */
  const root = mkdtempSync(join(tmpdir(), "salt-export-"));
  try {
    mkdirSync(join(root, "ledger"), { recursive: true });
    const B = mk(); await B.load(); await B.tap([sale(IDN(1), 2)]); await B.tap([sale(IDN(2), 3)]);
    const W = world([IDN(1), IDN(2)]); W.source("book");
    const env = { REQUIRE_ACCESS: "0", SALT_BOOK_KEY: "bk", SALT_WRITE_KEY: "wk", BOOK: B.ns, SALT_LEDGER: W.D1 };
    const bridge = (extra) => async (url, init) => { const u = new URL(url); if (extra) { const r = extra(u.pathname, init); if (r) return r; } return worker.fetch(new Request(url, init), env, { waitUntil() { } }); };
    const ghEnv = join(root, "github_env.txt");
    const ranTools = [];
    const run = (cmd, args) => { ranTools.push(cmd + " " + args.join(" ")); if (cmd === "ledger.mjs") writeFileSync(join(root, "ledger", "ledger.json"), JSON.stringify({ v: V, ledger: { PRICING: { v: "x", floors: { salt: { 1: 61 } } }, OPEN: { v: "x", at: "n", count: 0, byKey: {} }, TERMS: { creditDays: 9 }, REWARD: { stated: {} }, STOCK: { today: "2026-10-29", books: {} } } })); };
    const E = { SALT_BOOK_KEY: "bk", GITHUB_ENV: ghEnv };
    const rev0 = (await B.at()).rev;
    const r = await exportBook({ base: "https://salt.test", env: E, root, fetchImpl: bridge(), run, now: new Date("2026-10-28T20:00:00.000Z"), tries: 1, wait: 0 });
    const a = await B.at(), file = JSON.parse(readFileSync(join(root, "ledger", "book.json"), "utf8")), rd = await B.read();
    const tapped = ridsOf(rd).filter((x) => !fb().sales.some((s) => s.rid === x));
    ok(r.ok && !r.day && ranTools.join("|") === "booksync.mjs --sync|ledger.mjs " && r.notes === 0 && a.rev === rev0 && r.rev === a.rev && a.derivedRev === a.rev, "a run that is not the day's writes no note, moves no revision, and sends the documents for the revision it exported: " + JSON.stringify([r.ok, r.notes, rev0, a.rev, a.derivedRev, ranTools]));
    ok(file.sales.length === fb().sales.length + 2 && tapped.length === 2 && tapped.every((x) => file.sales.find((s) => s.rid === x)), "ledger/book.json is the Book's view, the tapped rows in it: " + file.sales.length);
    ok(readFileSync(ghEnv, "utf8").trim() === "SALT_BOOK_REV=" + a.rev && rd.state.PRICING.floors.salt[1] === 61 && rd.state.TERMS.creditDays === 9, "the revision is named for the publish (SALT_BOOK_REV), and the Book holds the documents the export computed");
    ok(!(await W.db.prepare("SELECT committed_at FROM draft WHERE id=?").get(IDN(1))).committed_at, "a run that is not the day's compacts nothing and marks no draft");
    const r2 = await exportBook({ base: "https://salt.test", env: E, root, fetchImpl: bridge(), run, now: new Date("2026-10-28T20:00:00.000Z"), tries: 1, wait: 0 });
    ok(r2.ok && r2.notes === 0 && r2.rev === a.rev && (await B.at()).rev === a.rev, "run again it writes no note and moves nothing");
    const d = await exportBook({ base: "https://salt.test", env: E, root, day: true, fetchImpl: bridge(), run, now: new Date("2026-10-28T20:00:00.000Z"), tries: 1, wait: 0 });
    const ad = await B.at();
    ok(d.ok && d.day && /compacted 2/.test(d.steps[0]) && ad.booked.length === 0 && W.db.prepare("SELECT COUNT(*) AS n FROM draft WHERE committed_at IS NOT NULL").get().n === 2 && JSON.parse(readFileSync(join(root, "ledger", "book.json"), "utf8")).sales.length === file.sales.length && d.notes === 2, "the day's run compacts first (two entries closed, their drafts marked committed), writes the notes behind the two tapped rows and no other, and exports the same book: " + JSON.stringify(d.steps));
    const dfile = JSON.parse(readFileSync(join(root, "ledger", "book.json"), "utf8")), blankOld = fb().sales.filter((s) => s.rid && !(s.note || "").trim()).length;
    ok(tapped.every((x) => /not a model/.test(dfile.sales.find((s) => s.rid === x).note)) && dfile.sales.filter((s) => s.rid && !(s.note || "").trim()).length === blankOld, "the two tapped rows carry a note and a row git's fold wrote with none is left as it was: " + blankOld);
    /* 4: failures name their step */
    const fails = async (extra, over = {}) => exportBook({ base: "https://salt.test", env: { SALT_BOOK_KEY: "bk" }, root, fetchImpl: bridge(extra), run, now: new Date(), tries: 1, wait: 0, ...over });
    const f1 = await fails((p) => (p === "/book/compact" ? Response.json({ ok: false, error: "refused" }, { status: 409 }) : null), { day: true });
    const f2 = await fails((p) => (p === "/book/ledger" ? Response.json({ ok: false, error: "down" }, { status: 503 }) : null));
    const f3 = await fails(null, { run: () => { throw new Error("jsdom said no"); } });
    const f4 = await fails((p) => (p === "/book/derived" ? Response.json({ ok: false, error: "no" }, { status: 409 }) : null));
    const f5 = await fails((p) => (p === "/book/notes" ? Response.json({ ok: false, error: "no" }, { status: 400 }) : p === "/book/ledger" ? Response.json({ ok: true, rev: 5, tapped: ["s900"], book: { sales: [{ rid: "s900" }], purchases: [] }, derived: {} }) : p === "/book/compact" ? Response.json({ ok: true, compacted: 0, closed: 0 }) : null), { day: true });
    const f6 = await exportBook({ base: "https://salt.test", env: {}, root, fetchImpl: bridge(), run, tries: 1, wait: 0 });
    ok(!f1.ok && f1.step === "compact" && !f2.ok && f2.step === "fetch" && !f3.ok && f3.step === "derive" && /jsdom said no/.test(f3.error) && !f4.ok && f4.step === "derived" && !f5.ok && f5.step === "notes" && !f6.ok, "each failing step fails the run and names itself: " + [f1.step, f2.step, f3.step, f4.step, f5.step, f6.step].join());
    const p1 = await postBook("https://x.test", { SALT_BOOK_KEY: "k" }, "/book/notes", {}, { fetchImpl: async () => { throw new Error("net"); }, tries: 2, wait: 0 });
    ok(!p1.ok && /net/.test(p1.body.error), "a post that cannot reach the Worker says so");
  } finally { rmSync(root, { recursive: true, force: true }); }

  /* 5: the chain */
  {
    const yml = readFileSync(join(REPO, ".github", "workflows", "cloud-commit.yml"), "utf8").replace(/\r\n/g, "\n");
    const step = (name) => { const i = yml.indexOf("      - name: " + name + "\n"); if (i < 0) return null; const j = yml.indexOf("\n      - ", i + 10); return yml.slice(i, j < 0 ? undefined : j); };
    const day = step("Export the Book to git (the day's record)"), pub = step("Export the Book to the checkout for the publish"), publish = step("Publish the statements, live"), dep = step("Deploy the statements site");
    ok(!!day && /if: steps\.plan\.outputs\.export == '1'/.test(day) && /roster-export\.mjs --apply/.test(day) && /book-export\.mjs --day/.test(day) && /gate\.mjs/.test(day) && /git push origin HEAD:master/.test(day) && /SALT_BOOK_KEY/.test(day), "the day's export is a step: the roster road's files, the export, the build and the gate, then the commit and push as the runner");
    ok(!!pub && /steps\.source\.outputs\.mode == 'book' && steps\.plan\.outputs\.export != '1'/.test(pub) && /roster-export\.mjs --apply/.test(pub) && /book-export\.mjs\n?$/.test(pub.trim().split("\n").slice(-1)[0].replace(/^\s+/, "")), "every other book-mode run brings the checkout level with the Book before the publish");
    ok(yml.indexOf("Export the Book to the checkout for the publish") < yml.indexOf("- name: Deploy the statements site") && yml.indexOf("Export the Book to git (the day's record)") < yml.indexOf("- name: Already serving?") && !/steps\.plan\.outputs\.export/.test(publish || "") && !/mode/.test((publish || "").split("\n").find((l) => /^\s+if:/.test(l)) || ""), "the day's export comes before the deploy is decided, the publish export before the publish, and the publish is not gated on either");
    ok(/export=0/.test(yml) && /\[ "\$\(date -u \+%H\)" = "16" \]/.test(yml) && /inputs\.export/.test(yml) && /\[ "\$export" = "1" \]; then deploy=1; fi/.test(yml) && /echo "export=\$export" >> "\$GITHUB_OUTPUT"/.test(yml) && /^      export:\n        description:/m.test(yml), "the plan decides the day by the net's hour (16 UTC is 00:23 in Kuala Lumpur) or a dispatch, makes it a deploy, and the dispatch declares the input");
    ok(!/SALT_BOOK_REV/.test(yml.replace(/#[^\n]*/g, "")), "and the workflow never sets SALT_BOOK_REV itself: only the export tool does, so with git as the source the stamp is the build id alone");
  }
}
