/* test/s5f-gate.mjs: S5f-7 OF THE BOOK PLAN, THE GATE AND THE RUNBOOK (29 Oct 2026). Nothing here flips anything: the gate (tools/flip-gate.mjs) reads evidence, and the runbook (tools/flip.mjs) is driven over a stand-in for wrangler, gh and the
 * Book's routes, so every order of operations and every refusal is run and none touches a real store. Each check is red under its own mutation (test/s5f-gate.mutations.json):
 *   1  the log lines: a load, a readcheck, a pricing parity and an export, read off a chain log as the chain writes them
 *   2  the gate: every line is true, false or UNVERIFIED; only all true is TRUE; each line goes false on its own evidence; a line with no evidence is never true
 *   3  the collectors: the drafts the tap booked by kind, the approved-and-unbooked, the fallbacks, the hand approvals; a collector that cannot read answers null
 *   4  the fallback record: an approval that fell back is written on its draft, and the record never throws
 *   5  the runbook: a dry run writes nothing; --go needs his words and every precondition; the way back is written before any flag moves; the steps run in order and stop at the first failure and say where; book_outbox is never touched
 *   6  the way back and the verify */
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function run({ ok }) {
  const G = await import("../tools/flip-gate.mjs");
  const F = await import("../tools/flip.mjs");
  const { noteFallback } = await import("../src/book-tap.js");

  /* 1: the log lines, as the chain writes them */
  const log = [
    "chain\tBook\t2026-10-30T01:00:00.1Z Book loaded: 488 rows and 23 documents; 0 booked, 5 revised, 0 gone, 0 returned, digest d1481693a9f7; parity: the Book agrees with git over 488 rows in 13 collections and 23 documents; tap: 3 closed, 0 open",
    "chain\tBook\t2026-10-30T01:00:01.1Z Book readcheck: mirror v1311, Book v1311, readers on book, Book rev 15; the Book and the mirror agree over 346 sales and purchases; compaction would hold over 0 open entries",
    "chain\tBook\t2026-10-30T01:00:01.5Z Book source: Book v1311, rev 15, 300 sales; the live statements of 51 accounts built from the Book equal those built from git",
    "chain\tBook\t2026-10-30T01:00:02.1Z Pricing parity: ledger v1311, 6 books; the engine's PRICING from the book equals the page's (279 ms)",
    "chain\tBook\t2026-10-30T01:00:03.1Z Book export: rev 16, 349 rows, 2 notes, 5 documents; compacted 3, marked 3",
    "chain\tBook\t2026-10-30T01:00:04.1Z ::error::Book export FAILED at notes: no",
  ].join("\n");
  const p = G.parseLog(log);
  ok(p.loads.length === 1 && p.loads[0].closed === 3 && p.loads[0].open === 0 && p.loads[0].ok && p.loads[0].agrees && !p.loads[0].bad && p.readchecks.length === 1 && p.readchecks[0].ok && p.sources.length === 1 && p.sources[0].ok && p.parity.length === 1 && p.parity[0].ok && p.exports.length === 2 && p.exports[0].ok && !p.exports[1].ok,
    "a load with its tap, a green readcheck, an equal pricing parity and an export (and a failed one) are read off a log: " + JSON.stringify([p.loads.length, p.readchecks.length, p.parity.length, p.exports.map((x) => x.ok)]));
  const bad = G.parseLog([
    "x 2026-10-30T01:00:00.1Z Book loaded: 1 rows; tap: 2 closed, 1 open; parity: the Book agrees with git over 1 rows",
    "x 2026-10-30T01:00:01.1Z Book loaded: 1 rows; tap: 2 closed, 0 open, STUCK: s1; parity: the Book agrees with git over 1 rows",
    "x 2026-10-30T01:00:02.1Z Book loaded: 1 rows; tap: 2 closed, 0 open, FOLD BOOKED DIFFERENTLY: s2; parity: the Book agrees with git over 1 rows",
    "x 2026-10-30T01:00:03.1Z Book NOT loaded: 503",
    "x 2026-10-30T01:00:04.1Z Book loaded: 1 rows; parity FAILED: sales",
    "x 2026-10-30T01:00:05.1Z Book readcheck: mirror v1, Book v1; DIFFER: sales",
    "x 2026-10-30T01:00:05.5Z Book readcheck: mirror v1, Book v1, 12 rows, no word of agreement",
    "x 2026-10-30T01:00:06.1Z Pricing parity: the engine's PRICING differs: floors",
  ].join("\n"));
  ok(bad.loads.every((l) => l.bad || !l.ok || l.open !== 0 || !l.agrees) && bad.loads.length === 5 && !bad.readchecks[0].ok && !bad.readchecks[1].ok && !bad.parity[0].ok, "an open entry, a stuck one, a fold booked differently, a failed load and a failed parity each read as not clean, and a differing readcheck and pricing as not green");

  /* 2: the gate */
  const run1 = { id: 1, at: "2026-10-30T01:00:00Z", log: p }, runs = [run1, { id: 2, at: "2026-10-31T01:00:00Z", log: G.parseLog(log.split("\n").slice(0, 5).join("\n").replace("tap: 3 closed", "tap: 20 closed")) }];
  const green = { runs, now: "2026-11-06T01:00:00.000Z", backupOpened: "2026-11-02", since: "2026-10-28", d1: { kinds: { booked: 30, newIds: 5, trips: 1, purchases: 1, received: 2 }, left: 0, voidedNotRejected: 0, fallbacks: 0, laptopApprovals: 0, foldedUnbooked: 0 },
    pre: { migrations: true, tap: "on", read: "book", source: "d1", exportSteps: true, handoff: false } };
  green.runs = [{ id: 1, at: "x", log: G.parseLog(log.split("\n").slice(0, 5).join("\n").replace("tap: 3 closed", "tap: 23 closed")) }];
  const r0 = G.judge(green);
  ok(r0.ok && r0.lines.length === 10 && r0.lines.every((l) => l.ok === true), "with every line's evidence in, the gate reads true: " + JSON.stringify(r0.lines.map((l) => [l.id, l.ok])));
  const clone = () => JSON.parse(JSON.stringify(green));
  const cases = [
    ["G0", (e) => { e.now = "2026-11-03T23:00:00.000Z"; }],
    ["G1", (e) => { e.runs[0].log.loads[0].open = 1; }],
    ["G1", (e) => { e.runs.forEach((r) => r.log.loads.forEach((l) => { l.closed = null; l.open = null; })); }],
    ["G2", (e) => { e.d1.kinds.newIds = 4; }],
    ["G2", (e) => { e.d1.kinds.trips = 0; }],
    ["G2", (e) => { e.d1.kinds.purchases = 0; }],
    ["G2", (e) => { e.d1.kinds.received = 0; }],
    ["G2", (e) => { e.runs[0].log.loads[0].closed = 19; }],
    ["G3", (e) => { e.runs[0].log.readchecks[0].ok = false; }],
    ["G4", (e) => { e.d1.left = 1; }],
    ["G4", (e) => { e.d1.voidedNotRejected = 2; }],
    ["G4", (e) => { e.d1.voidedNotRejected = null; }],
    ["G5", (e) => { e.now = "2026-11-04T01:00:00.000Z"; }],
    ["G5", (e) => { e.d1.fallbacks = 1; }],
    ["G6", (e) => { e.runs[0].log.parity[0].ok = false; }],
    ["G7", (e) => { e.backupOpened = null; }],
    ["G7", (e) => { e.runs[0].log.exports[0].ok = false; }],
    ["G7", (e) => { e.runs[0].log.sources[0].ok = false; }],
    ["G8", (e) => { e.d1.laptopApprovals = 1; }],
    ["G8", (e) => { e.d1.foldedUnbooked = 1; }],
    ["G9", (e) => { e.pre.source = "book"; }],
    ["G9", (e) => { e.pre.handoff = true; }],
    ["G9", (e) => { e.pre.exportSteps = false; }],
    ["G9", (e) => { e.pre.tap = "off"; }],
  ];
  const wrong = [];
  for (const [id, mut] of cases) { const e = clone(); mut(e); const r = G.judge(e); const l = r.lines.find((x) => x.id === id); if (r.ok || l.ok === true) wrong.push(id + ":" + (l && l.ok)); }
  ok(!wrong.length, "each line goes false on its own evidence and the gate with it: " + (wrong.join(",") || cases.length + " cases"));
  { const e = clone(); e.d1.voidedNotRejected = null; const g4 = G.judge(e).lines.find((x) => x.id === "G4"); ok(g4.ok === null && /UNREAD/.test(g4.detail), "a voided count the readcheck did not answer leaves G4 UNVERIFIED, never true and never merely false"); }
  const none = G.judge({ runs: [], now: "2026-11-05T00:00:00.000Z" });
  ok(!none.ok && none.lines.filter((l) => l.id !== "G0").every((l) => l.ok === null) && /UNVERIFIED/.test(G.say(none)), "with no evidence every line is UNVERIFIED, never true, and the gate is not true");
  const sayG = G.say(r0);
  ok(/The gate reads TRUE/.test(sayG) && !/NOT MET|UNVERIFIED/.test(sayG) && /NOT TRUE/.test(G.say(none)), "and the report says which");

  /* 3: the collectors, over a stand-in for wrangler and gh */
  const sets = (row) => ({ code: 0, out: JSON.stringify([{ results: [row], success: true }]) });
  const seen = [];
  const fakeRun = (cmd, args) => { seen.push([cmd, args.join(" ")]); return sets({ booked: 31, newIds: 6, trips: 2, purchases: 3, received: 4, n: 0, first: null, h: 0, f: 0 }); };
  const cd = G.collectD1("2026-10-28T00:00:00.000Z", fakeRun);
  ok(cd && cd.kinds.booked === 31 && cd.kinds.newIds === 6 && cd.kinds.trips === 2 && cd.kinds.purchases === 3 && cd.kinds.received === 4 && cd.left === 0 && cd.fallbacks === 0 && cd.laptopApprovals === 0 && cd.foldedUnbooked === 0, "the D1 evidence is read as kinds, left, fallbacks and hand approvals: " + JSON.stringify(cd));
  const sqls = seen.map((x) => x[1]).join("\n");
  ok(/collection IN \('sales','purchases','loan'\)/.test(sqls) && /collection NOT IN \('roster','rename'\)/.test(sqls) && /MIN\(decided_at\)/.test(sqls) && /booked_seq/.test(sqls) && /tap_fallback/.test(sqls) && /decided_by LIKE/.test(sqls) && /-10 minutes/.test(sqls) && /2026-10-28T00:00:00\.000Z/.test(sqls), "from the drafts decided in the window, the booking, the fallback record and the ten minutes the net is given");
  ok(G.collectD1("x", () => ({ code: 1, out: "boom" })) === null, "a D1 that will not answer is null, not zero");
  const gh = (cmd, args) => (cmd === "gh" && args[0] === "run" && args[1] === "list" ? { code: 0, out: JSON.stringify([{ databaseId: 5, createdAt: "2026-10-30T00:00:00Z", event: "schedule", status: "completed" }, { databaseId: 4, createdAt: "2026-10-20T00:00:00Z", event: "push", status: "completed" }, { databaseId: 6, createdAt: "2026-10-31T00:00:00Z", event: "push", status: "in_progress" }]) }
    : cmd === "gh" && args[1] === "view" ? { code: 0, out: log } : { code: 1, out: "" });
  const runsGot = G.collectRuns("2026-10-28T00:00:00.000Z", gh);
  ok(runsGot.length === 1 && runsGot[0].id === 5 && runsGot[0].log.loads.length === 1, "the runs in the window that finished are read, an older one and one in progress are not");
  ok(G.collectRuns("x", () => ({ code: 1, out: "no gh" })) === null, "Actions that cannot be read is null");

  /* 3b: the voided count comes from the readcheck, and the roster export has a base of its own (Fable's review) */
  {
    ok(await G.collectVoided(async () => ({ status: 200, body: { voidedUnrejected: 3 } })) === 3 && await G.collectVoided(async () => ({ status: 200, body: {} })) === null && await G.collectVoided(async () => { throw new Error("down"); }) === null && await G.collectVoided(async () => ({ status: 401, body: { voidedUnrejected: 0 } })) === null, "the gate's count of entries voided without a rejection is the readcheck's, and null when it cannot be read");
    const env = { ...process.env }; delete env.SALT_BASE; delete env.SALT_BOOK_KEY;
    const r = spawnSync(process.execPath, [join(REPO, "tools", "roster-export.mjs")], { cwd: REPO, encoding: "utf8", env, timeout: 60000 });
    ok(!/SALT_BASE is not set/.test((r.stdout || "") + (r.stderr || "")) && /SALT_BOOK_KEY is not set/.test((r.stdout || "") + (r.stderr || "")), "the roster export needs no SALT_BASE (the chain sets none): it gets as far as asking for the key: " + ((r.stdout || "") + (r.stderr || "")).slice(0, 120).replace(/s+/g, " "));
  }

  /* 4: the fallback record */
  {
    const db = new DatabaseSync(":memory:");
    for (const f of readdirSync(join(REPO, "migrations")).filter((x) => /^\d+_.*\.sql$/.test(x)).sort()) db.exec(readFileSync(join(REPO, "migrations", f), "utf8"));
    for (const [id, st] of [["2026-10-29T01:00:00.000Z", "pending"], ["2026-10-29T01:00:01.000Z", "approved"], ["2026-10-29T01:00:02.000Z", "rejected"]]) db.prepare("INSERT INTO draft (id,status,collection,entry,row,reasoning,drafter,drafted_at) VALUES (?,?,'sales','{}',?,'r','d','d')").run(id, st, JSON.stringify({ total: 5 }));
    const mkq = (a, sql) => { const st = db.prepare(sql); return { run() { const x = st.run(...a); return { meta: { changes: Number(x.changes || 0) } }; } }; };
    const D1 = { prepare(sql) { const o = mkq([], sql); o.bind = (...a) => mkq(a, sql); return o; } };
    await noteFallback(D1, ["2026-10-29T01:00:00.000Z", "2026-10-29T01:00:01.000Z", "2026-10-29T01:00:02.000Z", "nope"], "the Book is behind " + "x".repeat(300), "2026-10-29T02:00:00.000Z");
    const row = (id) => JSON.parse(db.prepare("SELECT row FROM draft WHERE id=?").get(id).row);
    ok(row("2026-10-29T01:00:00.000Z").tap_fallback.at === "2026-10-29T02:00:00.000Z" && row("2026-10-29T01:00:01.000Z").tap_fallback.why.length === 160 && row("2026-10-29T01:00:00.000Z").total === 5 && !row("2026-10-29T01:00:02.000Z").tap_fallback,
      "an approval that fell back is written on its draft (pending or approved, the row's other fields kept, the reason cut to 160) and a rejected draft is left alone");
    let threw = false; try { await noteFallback({ prepare: () => { throw new Error("D1 down"); } }, ["x"], "y"); } catch (e) { threw = true; }
    ok(!threw, "and the record never throws, so an approval cannot fail over it");
    const cdb = G.collectD1; void cdb;
    ok(db.prepare("SELECT COUNT(*) AS n FROM draft WHERE json_extract(CASE WHEN json_valid(row) THEN row ELSE '{}' END,'$.tap_fallback') IS NOT NULL").get().n === 2, "and the gate's own predicate counts exactly those");
  }

  /* 5: the runbook, over a stand-in */
  const mkIo = (over = {}) => {
    const st = { flags: { book_tap: "on", book_read: "book", book_source: "d1", book_roster: "off", book_outbox: "off", book_page: "on" }, calls: [], files: {}, unbooked: 0, ...over };
    const io = {
      collect: () => ({}), judge: () => ({ ok: st.gate !== false, lines: [{ id: "G1", ok: st.gate !== false, text: "x", detail: "y" }], window: { runs: 1, since: "2026-10-28" } }),
      sh: (cmd, args) => { st.calls.push([cmd, args.join(" ")]); if (cmd === "git" && args[0] === "rev-list") return { code: 0, out: st.behind || "0" }; if (cmd === "git" && args[0] === "push") return { code: st.pushFail ? 1 : 0, out: "" }; if (cmd === "git" && args[0] === "rev-parse") return { code: 0, out: "abc123\n" };
        if (cmd === "gh" && args[0] === "run") return { code: 0, out: JSON.stringify(st.live || []) }; if (cmd === "gh" && args[0] === "workflow") return { code: st.ghFail ? 1 : 0, out: "" };
        if (cmd === "node" && args[0].includes("roster-export")) return { code: st.rosterFail ? 1 : 0, out: "" }; if (cmd === "node" && args[0].includes("d1.mjs")) return { code: st.seedFail ? 1 : 0, out: "" }; return { code: 0, out: "" }; },
      d1: (sql) => { const m = /SELECT mode FROM (\w+)/.exec(sql); if (m) return { rows: [{ mode: st.flags[m[1]] }] }; if (/tap_fallback/.test(sql)) return { rows: [{ n: st.fallbacks || 0 }] }; if (/COUNT\(\*\) AS n FROM draft/.test(sql)) return { rows: [{ n: st.unbooked }] }; return { rows: [] }; },
      d1Write: (sql) => { st.calls.push(["d1Write", sql]); const m = /UPDATE (\w+) SET mode='(\w+)'/.exec(sql); if (m && !st.stuckFlag) st.flags[m[1]] = m[2]; return { code: 0, out: "" }; },
      post: async (path) => { st.calls.push(["post", path]); return st.compactFail ? { status: 409, body: { ok: false, error: "refused" } } : { status: 200, body: { ok: true, compacted: 4, closed: 4 } }; },
      get: async () => ({ status: 200, body: { ok: true, bookRev: 7, source: st.flags.book_source } }),
      writeFile: (f, t) => { st.calls.push(["writeFile", f]); st.files[f] = t; }, now: () => "2026-11-05T00:00:00.000Z", ...over.io,
    };
    return { io, st };
  };
  const writes = (st) => st.calls.filter((c) => ["d1Write", "post", "writeFile"].includes(c[0]) || (c[0] === "gh" && /workflow/.test(c[1])) || (c[0] === "node" && /roster-export/.test(c[1])) || (c[0] === "git" && /^push/.test(c[1])));
  {
    const { io, st } = mkIo();
    const dry = await F.flip(io, {});
    ok(dry.dry && dry.ok && !dry.error && dry.did.length === 0 && dry.plan.length === 7 && writes(st).length === 0 && st.flags.book_source === "d1", "a dry run reads, reports the plan and the checks, and writes nothing: " + JSON.stringify(writes(st)));
    const a = mkIo({ gate: false }), r1 = await F.flip(a.io, {}), r2 = await F.flip(a.io, { go: "his typed go here" });
    ok(!r1.ok && r1.dry && !r2.ok && r2.stoppedAt === "preflight" && writes(a.st).length === 0, "a gate that is not true fails the dry run and refuses --go, with nothing written");
    const w = mkIo(), r3 = await F.flip(w.io, { go: "go" }), r4 = await F.flip(w.io, { go: true });
    ok(!r3.ok && /typed words/.test(r3.error) && !r4.ok && writes(w.st).length === 0, "--go takes his words, not a bare flag");
    for (const [name, over] of [["behind", { behind: "2" }], ["a run in progress", { live: [{ status: "in_progress", name: "x" }] }], ["an unbooked draft", { unbooked: 1 }], ["the flag already book", { flags: { book_tap: "on", book_read: "book", book_source: "book", book_roster: "off", book_outbox: "off", book_page: "on" } }]]) {
      const x = mkIo(over), r = await F.flip(x.io, { go: "his typed go here" });
      ok(!r.ok && r.stoppedAt === "preflight" && writes(x.st).length === 0, "a precondition (" + name + ") refuses the flip with nothing written");
    }
    const g = mkIo(), r = await F.flip(g.io, { go: "his typed go here" }), order = writes(g.st).map((c) => c[0] === "d1Write" ? c[1].replace(/UPDATE (\w+) SET mode='(\w+)'.*/, "$1=$2") : c[0] === "post" ? c[1] : c[0] === "writeFile" ? "way back" : c[0] === "node" ? "roster-export" : c[0] === "git" ? "watermark push" : "gh export");
    ok(r.ok && order.join(" > ") === "way back > book_roster=on > roster-export > watermark push > book_source=book > /book/compact > gh export" && g.st.flags.book_source === "book" && g.st.flags.book_roster === "on", "the steps run in the plan's order, the way back first: " + order.join(" > "));
    const wb = JSON.parse(g.st.files[F.WAY_BACK]);
    ok(wb.sha === "abc123" && wb.flags.book_source === "d1" && wb.flags.book_roster === "off" && wb.bookRev === 7 && wb.his === "his typed go here" && wb.back.length === 2, "the way back holds the flags as they were, the revision, the sha, his words and the commands: " + JSON.stringify(wb).slice(0, 160));
    ok(!g.st.calls.some((c) => /book_outbox|book_page|book_tap|book_read/.test(c[1] || "") && c[0] === "d1Write"), "and the flip never touches book_outbox, book_page, book_tap or book_read");
    const stops = [["stuckFlag", "3"], ["rosterFail", "4"], ["pushFail", "4"], ["compactFail", "6"], ["ghFail", "7"]];
    for (const [key, step] of stops) {
      const x = mkIo({ [key]: true }), rr = await F.flip(x.io, { go: "his typed go here" });
      ok(!rr.ok && rr.stoppedAt === step && rr.wayBack === F.WAY_BACK && Object.keys(x.st.files).length === 1, "a failure at step " + step + " stops the run there, says so, and points at the way back already written: " + rr.stoppedAt);
    }
    const x5 = mkIo(); const orig = x5.io.d1Write; x5.io.d1Write = (sql) => (/book_source/.test(sql) ? { code: 0, out: "" } : orig(sql));
    const r5 = await F.flip(x5.io, { go: "his typed go here" });
    ok(!r5.ok && r5.stoppedAt === "5" && !x5.st.calls.some((c) => c[0] === "post"), "a book_source that does not read book after it is set stops before the compaction");
    const x0 = mkIo(); x0.io.writeFile = () => { throw new Error("disk"); };
    const r0b = await F.flip(x0.io, { go: "his typed go here" });
    ok(!r0b.ok && r0b.stoppedAt === "0" && x0.st.flags.book_roster === "off", "a way back that cannot be written stops the run before any flag moves");
  }

  /* 6: the way back and the verify */
  {
    const { io, st } = mkIo({ flags: { book_tap: "on", book_read: "book", book_source: "book", book_roster: "on", book_outbox: "off", book_page: "on" } });
    const none = await F.back(io, { go: "x" }), ex = await F.back(io, { go: "his typed go here" });
    ok(!none.ok && /typed words/.test(none.error) && ex.exportedFirst && st.flags.book_source === "book" && !st.calls.some((c) => c[0] === "d1Write") && st.calls.some((c) => c[0] === "gh" && /workflow run cloud-commit.yml -f export=true/.test(c[1])), "the way back dispatches the export first and moves no flag until it is told the export ran");
    st.calls.length = 0;
    const back = await F.back(io, { go: "his typed go here", exported: true });
    const ci = (p) => st.calls.findIndex((c) => (c[0] === "git" || c[0] === "node") && p.test(c[1]));
    ok(!st.calls.some((c) => c[0] === "gh" && /workflow/.test(c[1])) && ci(/pull --ff-only/) >= 0 && ci(/pull --ff-only/) < ci(/ledger.mjs/) && ci(/ledger.mjs/) < ci(/d1.mjs/), "the pass that is told the export ran dispatches nothing more, pulls what the chain pushed, makes the extract again and only then seeds the mirror");
    ok(back.ok && st.flags.book_source === "d1" && st.flags.book_roster === "off" && back.did.some((d) => /mirror seeded/.test(d)) && st.calls.findIndex((c) => c[0] === "node" && /d1\.mjs/.test(c[1])) > st.calls.findIndex((c) => c[0] === "d1Write" && /book_source/.test(c[1])), "then book_source goes back to d1, book_roster off, and the mirror is seeded (after the flag, which is what allows it): " + JSON.stringify(back.did));
    const ne = mkIo({ flags: { book_tap: "on", book_read: "book", book_source: "book", book_roster: "on", book_outbox: "off", book_page: "on" } });
    const nr = await F.back(ne.io, { go: "his typed go here", noExport: true });
    ok(nr.ok && ne.st.flags.book_source === "d1" && !ne.st.calls.some((c) => c[0] === "gh") && !ne.st.calls.some((c) => c[0] === "git" && /pull/.test(c[1])), "when nothing was compacted (the flip stopped at step 6) the way back is the flags alone: no export, no pull");
    const f = mkIo({ flags: { book_tap: "on", book_read: "book", book_source: "book", book_roster: "on", book_outbox: "off", book_page: "on" }, seedFail: true });
    const bf = await F.back(f.io, { go: "his typed go here", exported: true });
    ok(!bf.ok && bf.stoppedAt === "seed" && f.st.flags.book_source === "d1", "a seed that fails is said, with the flags already back");
    const v = mkIo({ flags: { book_tap: "on", book_read: "book", book_source: "book", book_roster: "on", book_outbox: "off", book_page: "on" } });
    v.io.get = async () => ({ status: 200, body: { ok: true, bookRev: 9, source: "book" } });
    const vr = await F.verify(v.io);
    ok(vr.ok && vr.checks.length === 5, "verify reads source, roster, a green readcheck naming the Book, nothing unbooked and no fallback: " + JSON.stringify(vr.checks.map((c) => [c.id, c.ok])));
    const v2 = mkIo({ flags: { book_tap: "on", book_read: "book", book_source: "d1", book_roster: "off", book_outbox: "off", book_page: "on" }, unbooked: 2 });
    const vr2 = await F.verify(v2.io);
    ok(!vr2.ok && vr2.checks.filter((c) => !c.ok).map((c) => c.id).join() === "source,roster,readcheck,unbooked", "and it fails on each thing that is wrong: " + vr2.checks.filter((c) => !c.ok).map((c) => c.id).join());
  }
}
