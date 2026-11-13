/* test/s5f-board.mjs: S5f-8, THE FLIP GATE BOARD (29 Oct 2026). tools/flip-board.mjs reads the gate (tools/flip-gate.mjs) and draws it with the
 * runbook (tools/flip.mjs) as one page. Nothing here reads live or flips anything: the evidence is invented, the page is drawn in jsdom. Each check is
 * red under its own mutation (test/s5f-board.mutations.json):
 *   1  the verdict: TRUE only when the judge says so; a line not met and a line unverified never draw as met, and the flip's steps lock
 *   2  the progress: the numbers are the evidence's (G2's taps closed, G5's recorded days), and the earliest day the gate can read true
 *   3  the history: capped, a corrupt or missing file is empty, a snapshot carries statuses and counts only, the trend draws it
 *   4  the page: no network (no src, no url( but data:, no @import), the faces inlined, nothing shaped like a secret, Tide first
 *   5  the checklist: ticks kept under one key, a locked step ignores a kept tick, it works with storage refused, Reset asks
 *   6  the runbook: flip.mjs's PLAN in order, the did lines flip.mjs prints, the way back's three forms */
import { JSDOM, VirtualConsole } from "jsdom";
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function run({ ok }) {
  const G = await import("../tools/flip-gate.mjs");
  const F = await import("../tools/flip.mjs");
  const B = await import("../tools/flip-board.mjs");
  const bare = { css: "", fonts: "" };

  const log = [
    "c\tB\t2026-10-30T01:00:00.1Z Book loaded: 488 rows; parity: the Book agrees with git over 488 rows; tap: 23 closed, 0 open",
    "c\tB\t2026-10-30T01:00:01.1Z Book readcheck: mirror v1311, Book v1311; the Book and the mirror agree over 346 sales and purchases; compaction would hold over 0 open entries",
    "c\tB\t2026-10-30T01:00:01.5Z Book source: Book v1311; the live statements of 51 accounts built from the Book equal those built from git",
    "c\tB\t2026-10-30T01:00:02.1Z Pricing parity: ledger v1311, 6 books; the engine's PRICING from the book equals the page's (279 ms)",
  ].join("\n");
  const green = () => ({ runs: [{ id: 1, at: "x", log: G.parseLog(log) }], now: "2026-11-06T01:00:00.000Z", backupOpened: "2026-11-02", since: "2026-10-28T00:00:00.000Z",
    d1: { kinds: { booked: 30, newIds: 5, trips: 1, purchases: 1, received: 2 }, left: 0, voidedNotRejected: 0, fallbacks: 0, laptopApprovals: 0, foldedUnbooked: 0 },
    pre: { migrations: true, tap: "on", read: "book", source: "d1", exportSteps: true, markBeforeLoad: true, handoff: false } });
  const page = (ev, hist) => { const j = G.judge(ev); return B.renderPage(B.viewOf(ev, j, hist || [B.snapshotOf(ev, j)]), B.RUNBOOK, bare); };
  const doc = (html) => new JSDOM(html).window.document;
  const dn0 = (d) => d.querySelector("[data-verdict] h2").textContent;

  /* 1: the verdict */
  {
    const ev = green(), d = doc(page(ev));
    ok(G.judge(ev).ok && dn0(d) === "The gate reads TRUE" && d.querySelector("[data-verdict]").getAttribute("data-verdict") === "true" && !d.querySelector("li[data-locked]") && d.querySelectorAll('[data-gate][data-state="m"]').length === 10,
      "with every line met the page says the gate reads TRUE, every card Met, and no step locked");
    ok(d.querySelector('#G9 [data-p="Marked before the load"] [data-n]') && /yes/.test(d.querySelector('#G9 [data-p="Marked before the load"] [data-n]').textContent), "G9 shows master's precondition that the chain marks before it loads");
    const nv = green(); nv.d1.voidedNotRejected = null;
    const dn = doc(page(nv)), g4 = dn.querySelector("#G4");
    ok(g4.getAttribute("data-state") === "u" && /Unverified/.test(g4.querySelector(".salt-status").textContent) && g4.querySelector(".salt-status").classList.contains("salt-status--dashed") && !/\bMet\b/.test(g4.querySelector(".salt-status").textContent),
      "an UNVERIFIED line draws as Unverified, dashed, never as Met: " + g4.querySelector(".salt-status").textContent);
    ok(/The gate reads NOT TRUE/.test(dn.querySelector("[data-verdict] h2").textContent) && dn.querySelector("[data-verdict]").getAttribute("data-verdict") === "false" && dn.querySelector('[data-count="unv"]').textContent === "1",
      "and one line unverified is enough for the page to say NOT TRUE, counted as unverified");
    const nf = green(); nf.d1.left = 2;
    const df = doc(page(nf)), g = df.querySelector("#G4");
    ok(g.getAttribute("data-state") === "n" && /Not met/.test(g.querySelector(".salt-status").textContent) && g.querySelector(".salt-status").classList.contains("salt-status--ember"), "a line NOT MET draws as Not met, never as Met");
    const locked = [...df.querySelectorAll("li[data-locked]")].map((li) => li.getAttribute("data-step"));
    ok(locked.join() === "GO,S0,S3,S4,S5,S6,S7,S8" && [...df.querySelectorAll("li[data-locked] [data-tick]")].every((b) => b.disabled) && [...df.querySelectorAll("li[data-locked] [data-copy]")].every((b) => b.disabled) && df.querySelectorAll("li [data-lock]").length === 8 && !df.querySelector('[data-step="P1"]').hasAttribute("data-locked"),
      "with the gate not true the flip's steps stay on the page, locked, their ticks and Copy disabled, saying why; the preconditions stay open: " + locked.join());
  }

  /* 2: the progress */
  {
    const ev = green(), j = G.judge(ev), v = B.viewOf(ev, j, []);
    const p = (id, label) => v.gates.find((x) => x.id === id).progress.find((x) => x.label === label);
    ok(p("G2", "Taps closed").n === 23 && /^23 closed by loads/.test(j.lines.find((l) => l.id === "G2").detail) && p("G2", "New rows").n === 5 && p("G2", "Trips").n === 1 && p("G2", "Received").n === 2,
      "G2's taps closed is the loads' own sum, the figure the judge reads, and its kinds are D1's: " + JSON.stringify(v.gates[2].progress.map((x) => [x.label, x.n])));
    const days = Math.floor((Date.parse(ev.now) - Date.parse(G.GATE.fallbackFrom)) / 864e5);
    ok(p("G5", "Days recorded").n === days && days === 7 && p("G5", "Days recorded").of === 7 && /7 of 7/.test(j.lines.find((l) => l.id === "G5").detail), "G5's days recorded are whole days since the version that records fallbacks: " + p("G5", "Days recorded").n);
    const d = doc(B.renderPage(v, B.RUNBOOK, bare));
    ok(d.querySelector('#G2 [data-p="Taps closed"] [data-n]').textContent === "23 of 20" && d.querySelector('#G5 [data-p="Days recorded"] [data-n]').textContent === "7 of 7", "and the page draws those figures");
    const e = B.earliestFlipDay();
    ok(e.at === "2026-11-05T12:00:00.000Z" && e.by === "G5" && e.myt === "05 Nov 2026, 20:00 MYT", "the earliest the gate can read true is G5's seventh recorded day, 05 Nov 2026 20:00 MYT, not 04 Nov: " + JSON.stringify(e));
    const un = green(); un.d1 = null; const vu = B.viewOf(un, G.judge(un), []);
    ok(vu.gates.find((x) => x.id === "G2").progress.find((x) => x.label === "New rows").n === null && /unread/.test(B.renderPage(vu, B.RUNBOOK, bare)), "a store that was not read shows unread, never 0");
    const ce = { since: "2026-10-28T00:00:00.000Z", now: "2026-10-30T00:00:00.000Z", runs: [], d1: null, pre: null, collectError: "wrangler failed, key=abc123" };
    const dc = doc(page(ce));
    ok(/Collect failed/.test(dc.body.textContent) && !/abc123/.test(dc.body.textContent) && dc.querySelectorAll('[data-gate][data-state="m"]').length === 0, "a collector that failed is said, its reason scrubbed, and nothing it would have read is met");
  }

  /* 3: the history */
  {
    const many = Array.from({ length: 70 }, (_, i) => ({ at: "x" + i, gates: {} }));
    const h = B.appendHistory(many, { at: "new", gates: {} });
    ok(h.length === B.CAP && B.CAP === 60 && h[59].at === "new" && h[0].at === "x11", "the history keeps the newest 60 snapshots: " + h.length);
    const dir = mkdtempSync(join(tmpdir(), "flip-board-"));
    try {
      writeFileSync(join(dir, "bad.json"), "{not json"); writeFileSync(join(dir, "obj.json"), '{"a":1}');
      const len = (f) => { try { return B.readHistory(join(dir, f)).length; } catch (e) { return "threw"; } };
      ok(len("bad.json") === 0 && len("obj.json") === 0 && len("none.json") === 0, "a corrupt, wrong-shaped or missing history reads as empty: " + [len("bad.json"), len("obj.json"), len("none.json")].join());
      const evf = join(dir, "ev.json"), out = join(dir, "b.html"), hf = join(dir, "bad.json");
      writeFileSync(evf, JSON.stringify(green()));
      const r = spawnSync(process.execPath, [join(REPO, "tools", "flip-board.mjs"), "--offline", evf, "--out", out, "--history", hf], { cwd: REPO, encoding: "utf8", timeout: 60000 });
      const kept = JSON.parse(readFileSync(hf, "utf8"));
      ok(r.status === 0 && existsSync(out) && Array.isArray(kept) && kept.length === 1 && /file:\/\/\//.test(r.stdout), "and the tool runs over it, writes the page and starts the history again: " + (r.stdout + r.stderr).slice(0, 160).replace(/\s+/g, " "));
    } finally { rmSync(dir, { recursive: true, force: true }); }
    const s = B.snapshotOf(green(), G.judge(green()));
    ok(Object.keys(s).join() === "at,ok,gates,n" && Object.values(s.gates).every((x) => ["m", "n", "u"].includes(x)) && Object.values(s.n).every((x) => x === null || typeof x === "number"), "a snapshot holds the statuses and counts alone: " + JSON.stringify(s).slice(0, 160));
    const hist = [{ at: "2026-10-30T00:00:00.000Z", gates: { G4: "u" } }, ...Array.from({ length: 9 }, (_, i) => ({ at: "2026-10-31T0" + i + ":00:00.000Z", gates: { G4: i % 2 ? "m" : "n" } }))];
    const d = doc(page(green(), hist)), marks = d.querySelectorAll("#G4 .fb-trend li");
    ok(marks.length === 8 && /Met|Not met/.test(marks[7].textContent) && d.querySelector("#G4 .fb-trend").getAttribute("aria-label") === "G4 over the last 8 reads", "the trend draws a gate's last 8 reads, each with its word for a reader: " + marks.length);
    const d2 = doc(page(green(), hist.slice(0, 3)));
    ok(d2.querySelector("#G4 .fb-trend li .salt-status--dashed") && /Unverified/.test(d2.querySelector("#G4 .fb-trend li").textContent), "and an unverified read draws dashed, with its word");
  }

  /* 4: the page itself */
  {
    const ev = green();
    ev.runs[0].log.readchecks[0].ok = false;
    ev.runs[0].log.readchecks[0].line = "Book readcheck: DIFFER at https://x.example/book?token=s3cr3t Bearer abc.def key=K9x eyJhbGciOi.eyJzdWIi.sig " + "Q".repeat(40);
    const html = B.renderPage(B.viewOf(ev, G.judge(ev), []), B.RUNBOOK);
    const urls = html.match(/url\(\s*["']?([^"')]{0,12})/g) || [];
    ok(urls.length > 0 && urls.every((u) => /url\(\s*["']?data:/.test(u)) && !/@import/.test(html) && !/<(script|img|link|iframe)[^>]*\bsrc=/i.test(html) && !/<link\b/i.test(html), "the page loads nothing: every url( is data:, no @import, no src, no link: " + urls.length + " urls");
    ok((html.match(/url\(data:font\/woff2;base64,/g) || []).length === 2 && /font-family: 'Newsreader'/.test(html) && /font-family: 'Geist Mono'/.test(html), "the two faces are inlined as data");
    const text = html.replace(/url\(data:[^)]*\)/g, "").replace(/url\("data:[^"]*"\)/g, "");
    ok(!/https?:\/\//.test(text) && !/s3cr3t|K9x|abc\.def|eyJhbGciOi|Q{32}/.test(text) && /\[link\]/.test(text) && /\[hidden\]/.test(text), "a log line's link, bearer token, key, JWT and long opaque string never reach the page");
    ok(B.scrub("password: hunter22 x") === "password: [hidden] x" && B.scrub("digest d1481693a9f7, 5 closed") === "digest d1481693a9f7, 5 closed", "a short code or digest is kept; a named secret is not");
    ok(/<html lang="en-GB" data-theme="tide">/.test(html) && /default-src 'none'/.test(html), "the page opens in Tide, under a policy that loads nothing");
  }

  /* 5: the checklist in a browser of sorts */
  {
    const notTrue = green(); notTrue.d1.left = 1;
    const html = page(notTrue);
    const open = (store, onError) => {
      const vc = new VirtualConsole(); vc.on("jsdomError", (e) => onError(e));
      return new JSDOM(html, { url: "https://board.test/", runScripts: "dangerously", virtualConsole: vc, beforeParse(w) {
        if (store === "throw") Object.defineProperty(w, "localStorage", { get() { throw new Error("storage refused"); } });
        else if (store) for (const [k, v] of Object.entries(store)) w.localStorage.setItem(k, v);
        w.confirm = () => true;
      } }).window;
    };
    const errs = [], w = open("throw", (e) => errs.push(e.message));
    const box = w.document.querySelector('[data-tick="P1"]'); box.click();
    ok(box.checked && w.document.querySelector('[data-step="P1"] [data-word]').textContent === "Ticked" && !errs.length, "with storage refused a tick still works on the page: " + errs.join(" | "));
    const e2 = [], w2 = open(null, (e) => e2.push(e.message));
    w2.document.querySelector('[data-tick="P3"]').click();
    const kept = w2.localStorage.getItem("salt-flip-board");
    ok(kept && JSON.parse(kept).ticks.P3 === 1 && Object.keys(w2.localStorage).length === 1 && !e2.length, "a tick is kept under the one key: " + kept);
    const w3 = open({ "salt-flip-board": JSON.stringify({ ticks: { P3: 1, GO: 1, S3: 1 }, look: "night" }) }, () => {});
    const d3 = w3.document;
    ok(d3.querySelector('[data-tick="P3"]').checked && !d3.querySelector('[data-tick="GO"]').checked && !d3.querySelector('[data-tick="S3"]').checked && d3.documentElement.getAttribute("data-theme") === "night",
      "a kept tick comes back, never on a locked step, and a kept theme too");
    d3.querySelector("[data-reset]").click();
    ok(!d3.querySelector('[data-tick="P3"]').checked && JSON.stringify(JSON.parse(w3.localStorage.getItem("salt-flip-board")).ticks) === "{}", "Reset, once confirmed, clears every tick");
  }

  /* 6: the runbook is flip.mjs's, read off flip.mjs run over a stand-in (never off its source text) */
  const stub = (flags) => {
    const st = { flags: { book_tap: "on", book_read: "book", book_source: "d1", book_roster: "off", book_outbox: "off", book_page: "on", ...flags }, calls: [] };
    const io = { collect: () => ({}), judge: () => ({ ok: true, lines: [], window: { runs: 1, since: "2026-10-28" } }),
      sh: (cmd, args) => { st.calls.push(cmd + " " + args.join(" ")); return { code: 0, out: cmd === "gh" && args[0] === "run" ? "[]" : cmd === "git" && args[0] === "rev-list" ? "0" : "" }; },
      d1: (sql) => { const m = /SELECT mode FROM (\w+)/.exec(sql); return m ? { rows: [{ mode: st.flags[m[1]] }] } : /SELECT id/.test(sql) ? { rows: [] } : { rows: [{ n: 0 }] }; },
      d1Write: (sql) => { st.calls.push("d1Write " + sql); const m = /UPDATE (\w+) SET mode='(\w+)'/.exec(sql); if (m) st.flags[m[1]] = m[2]; return { code: 0, out: "" }; },
      post: async (p) => { st.calls.push("post " + p); return { status: 200, body: { ok: true, compacted: 4, closed: 4 } }; },
      get: async () => ({ status: 200, body: { ok: true, bookRev: 7, source: st.flags.book_source } }),
      writeFile: (p) => st.calls.push("writeFile " + p), now: () => "2026-11-05T00:00:00.000Z" };
    return { io, st };
  };
  {
    const html = page(green()), d = doc(html);
    const titles = F.PLAN.map(([n]) => d.querySelector(`[data-step="S${n}"] [data-title]`)?.textContent);
    ok(titles.join("|") === F.PLAN.map(([, t]) => t).join("|"), "the flip's steps are flip.mjs's PLAN, word for word and in its order");
    const ran = await F.flip(stub().io, { go: "his own typed go" }), said = ran.did.map((t) => t.replace(/(compacted|marked) \d+/g, "$1 N"));
    const miss = [0, 3, 4, 5, 6, 7].filter((n) => !said.some((t) => t.startsWith(B.RUNBOOK.did[n])));
    ok(ran.ok && said.length === 6 && !miss.length, "each step's read-after is the line flip.mjs prints when the step ran, read off a run over a stand-in: " + (miss.join() || said.join(" | ")));
    const cmds = [...d.querySelectorAll("[data-back] [data-cmd]")].map((c) => c.textContent);
    ok(cmds.length === 3 && /--back "/.test(cmds[0]) && / --exported$/.test(cmds[1]) && / --no-export$/.test(cmds[2]) && d.querySelector('[data-step="GO"] [data-cmd]').textContent === 'node tools/flip.mjs --go "<your typed words>"' && d.querySelector('[data-step="S8"] [data-cmd]').textContent === "node tools/flip.mjs --verify",
      "the go, the verify and the three way-back forms are flip.mjs's own flags: " + cmds.join(" | "));
    const flipped = { book_source: "book", book_roster: "on" }, b2 = stub(flipped), b3 = stub(flipped);
    await F.back(b2.io, { go: "his own typed go", exported: true }); await F.back(b3.io, { go: "his own typed go", noExport: true });
    const seeds = (st) => st.calls.some((c) => /tools\/d1\.mjs --seed/.test(c)), pulls = (st) => st.calls.some((c) => /pull --ff-only/.test(c));
    ok(seeds(b2.st) && pulls(b2.st) && seeds(b3.st) && !pulls(b3.st) && /mirror seeded from the export/.test(B.RUNBOOK.back[1].when) && /still seeds the mirror/.test(B.RUNBOOK.back[2].when) && /pulled and level/.test(B.RUNBOOK.back[2].when),
      "the way back's words follow what flip.mjs does: --exported pulls then seeds; --no-export skips the pull and still seeds the mirror from this checkout, so the page says so");
    ok(d.querySelectorAll('[data-step="GO"] .salt-status--copper').length === 1 && d.querySelectorAll("[data-back] .salt-status--copper").length === 3 && !d.querySelector('[data-step="P5"] .salt-status--copper'), "the flip and the way back are marked as needing his typed go; the dry run is not");
  }

  /* 7: Fable's review of 29 Oct 2026: the way back offered only once there is one, the day as G0 reads it, the attestation checked */
  {
    const backs = (d) => ({ locked: d.querySelectorAll("[data-back][data-locked]").length, copy: d.querySelectorAll("[data-back] [data-copy]").length, cmds: d.querySelectorAll("[data-back] [data-cmd]").length, why: d.querySelectorAll("[data-back] [data-lock]").length });
    const ev = green(), j = G.judge(ev);
    const before = backs(doc(B.renderPage(B.viewOf(ev, j, []), B.RUNBOOK, bare))), wrote = backs(doc(B.renderPage(B.viewOf(ev, j, [], { wayBack: true }), B.RUNBOOK, bare)));
    const evb = green(); evb.pre.source = "book"; const onBook = backs(doc(B.renderPage(B.viewOf(evb, G.judge(evb), []), B.RUNBOOK, bare)));
    ok(before.locked === 3 && before.copy === 0 && before.cmds === 3 && before.why === 3 && /re-seed the mirror from this checkout/.test(B.BACK_LOCKED)
      && wrote.locked === 0 && wrote.copy === 3 && onBook.locked === 0 && onBook.copy === 3,
      "the way back is text only, locked with its reason, until flip.mjs's way-back file exists or book_source reads book: " + JSON.stringify([before, wrote, onBook]));
    const day = (now) => { const e = green(); e.now = now; const jj = G.judge(e), v = B.viewOf(e, jj, []); return { g0: jj.lines[0].ok, days: v.daysTo, come: /the earliest day has come/.test(B.renderPage(v, B.RUNBOOK, bare)) }; };
    const eve = day("2026-11-03T20:00:00.000Z"), morn = day("2026-11-04T00:30:00.000Z");
    ok(eve.g0 === false && eve.days === 1 && !eve.come && morn.g0 === true && morn.days === 0 && morn.come,
      "the days to 04 Nov and whether it has come are read as G0 reads them (the UTC date), so 04:00 MYT on 04 Nov is not yet the day: " + JSON.stringify([eve, morn]));
    const att = (when) => { const e = green(); e.backupOpened = when; const v = B.viewOf(e, G.judge(e), []), d = doc(B.renderPage(v, B.RUNBOOK, bare));
      return { row: d.querySelector('#G7 [data-p="Backup opened with your key"] [data-n]').textContent, why: (d.querySelector("[data-backup-why]") || {}).textContent || "", refresh: d.querySelector("header [data-cmd]").textContent, g7: d.querySelector("#G7").getAttribute("data-state") }; };
    const bad = att("2026-13-01"), later = att("2026-12-01"), good = att("2026-11-02");
    ok(/not attested/.test(bad.row) && /not a real/.test(bad.why) && !/--backup-opened/.test(bad.refresh) && bad.g7 === "u" && /not attested/.test(later.row) && /after today/.test(later.why) && /02 Nov 2026/.test(good.row) && !good.why && / --backup-opened 2026-11-02$/.test(good.refresh) && good.g7 === "m",
      "an attestation that is not a real date, or is after today, is not taken: the board says why and leaves it out of the refresh: " + JSON.stringify([bad, later].map((x) => x.why)));
  }

  /* 8: after the flip (14 Nov 2026, his word "Flipped record + health"): the flipped shape on evidence alone, Healthy only when every reading is true, the gate never judged again */
  {
    const H = (over = {}) => ({ ok: true, checks: [["source", "book"], ["roster", "on"], ["tap", "on"], ["read", "book"]].map(([id, got]) => ({ id, ok: true, text: id, got }))
      .concat([{ id: "readcheck", ok: true, text: "rc", got: { source: "book", rev: 412, sick: 0, frozenMirror: 3 } }, { id: "unbooked", ok: true, text: "u", got: 0 }, { id: "fallbacks", ok: true, text: "f", got: 0 }])
      .map((c) => (c.id in over ? { ...c, ok: over[c.id] } : c)) });
    const EX = { at: "2026-11-13T16:30:00.000Z", conclusion: "success", unread: 0 }, WAY = { writtenAt: "2026-11-09T18:57:10.132Z", bookRev: 368, sha: "fd55a2b9", flags: { book_source: "d1" } };
    const fev = (o = {}) => ({ ...green(), now: "2026-11-14T02:00:00.000Z", pre: { ...green().pre, source: "book" }, health: H(), export: EX, wayBack: WAY, ...o });
    const fdoc = (ev, hist = [], opts = {}) => doc(B.renderFlipped(B.flippedView(ev, hist, opts), B.RUNBOOK, bare));
    const hs = (ev) => fdoc(ev).querySelector("[data-verdict]").getAttribute("data-health");

    /* 8a: the shape follows book_source as read, through the tool itself: never flipped on d1 or unread, whatever the way-back file */
    const dir = mkdtempSync(join(tmpdir(), "flip-board-8-"));
    try {
      const cli = (ev, name) => { const f = join(dir, name + ".json"), out = join(dir, name + ".html"), hf = join(dir, name + "-hist.json"); writeFileSync(f, JSON.stringify(ev)); writeFileSync(hf, JSON.stringify([{ at: "2026-10-29T00:00:00.000Z", ok: false, gates: { G0: "n" } }]));
        const r = spawnSync(process.execPath, [join(REPO, "tools", "flip-board.mjs"), "--offline", f, "--out", out, "--history", hf], { cwd: REPO, encoding: "utf8", timeout: 60000 });
        const html = existsSync(out) ? readFileSync(out, "utf8") : ""; return { status: r.status, flipped: /data-verdict="flipped"/.test(html) && /Flipped \d/.test(html), hist: JSON.parse(readFileSync(hf, "utf8")).length, err: (r.stdout + r.stderr).slice(0, 120) }; };
      const d1Way = cli({ ...green(), wayBack: WAY }, "d1way"), unread = cli({ ...green(), pre: { ...green().pre, source: null }, wayBack: WAY }, "unread"), unreadNone = cli({ ...green(), pre: null, wayBack: null }, "none"), book = cli(fev(), "book");
      ok(d1Way.status === 0 && !d1Way.flipped && !unread.flipped && unread.status === 0 && !unreadNone.flipped && book.status === 0 && book.flipped && B.flippedOf({ source: "book" }) && !B.flippedOf({ source: "d1" }) && !B.flippedOf({}) && !B.flippedOf(null),
        "the board is Flipped only when book_source reads book: on d1 or unread it keeps the gate's shape, way-back file or not: " + JSON.stringify([d1Way, unread, unreadNone, book].map((x) => [x.status, x.flipped, x.err])));
      ok(book.hist === 1 && d1Way.hist === 2, "once flipped the gate's history is read and never written; before, each read is appended: " + [book.hist, d1Way.hist].join());
    } finally { rmSync(dir, { recursive: true, force: true }); }

    /* 8b: Healthy only when every reading is true; one false is Not healthy, one unread Unverified, never Healthy */
    {
      const d = fdoc(fev());
      ok(hs(fev()) === "m" && /^Flipped 10 Nov 2026$/.test(d.querySelector("[data-verdict] h2").textContent) && /Healthy/.test(d.querySelector("[data-verdict] .salt-status").textContent) && d.querySelector('[data-count="ok"]').textContent === "8",
        "with every reading true the page says Flipped 10 Nov 2026 and Healthy, eight of eight");
      const ids = ["source", "roster", "tap", "read", "readcheck", "unbooked", "fallbacks"];
      const falses = ids.map((id) => hs(fev({ health: H({ [id]: false }) }))), nulls = ids.map((id) => hs(fev({ health: H({ [id]: null }) }))), odd = hs(fev({ health: H({ unbooked: "yes" }) }));
      ok(falses.every((s) => s === "n") && nulls.every((s) => s === "u") && odd === "u", "any reading false is Not healthy and any unread is Unverified, never Healthy: " + JSON.stringify({ falses, nulls, odd }));
      const ex = [hs(fev({ export: { ...EX, conclusion: "failure" } })), hs(fev({ export: null })), hs(fev({ export: { at: null, unread: 0 } })), hs(fev({ export: { at: null, unread: 1 } })), hs(fev({ health: null }))];
      ok(ex.join() === "n,u,n,u,u" && fdoc(fev({ health: null })).querySelectorAll('[data-item][data-state="u"]').length === 7,
        "the day's export: failed or none in 30 hours is Not healthy, Actions unread or a run unread Unverified; health that could not run leaves every reading Unverified: " + ex.join());
      const du = fdoc(fev({ health: H({ readcheck: null }) })).querySelector('[data-item="readcheck"]');
      ok(du.getAttribute("data-state") === "u" && /Unverified/.test(du.querySelector(".salt-status").textContent) && du.querySelector(".salt-status--dashed") && !/\bMet\b|Healthy/.test(du.textContent), "an unread reading draws Unverified and dashed, never Met");
    }

    /* 8c: the gate is the pre-flip record, never judged again; a mark only from a snapshot the history kept in the day before the way back */
    {
      const d = fdoc(fev()), rows = [...d.querySelectorAll("[data-gate]")];
      ok(G.judge(fev()).lines.filter((l) => l.ok === true).length >= 9 && rows.length === 10 && rows.every((r) => r.getAttribute("data-state") === "none" && !r.querySelector(".salt-status")) && /pre-flip record, not live/.test(d.querySelector("#h-gate").textContent) && /No pre-flip snapshot kept/.test(d.querySelector("[data-pre-flip]").textContent),
        "flipped, the gate's lines are drawn as text with no mark, even over evidence the judge would call met, and say no snapshot was kept");
      const snap = (at, g4) => ({ at, ok: false, gates: { ...Object.fromEntries(["G0", "G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8", "G9"].map((k) => [k, "m"])), G4: g4 } });
      const kept = fdoc(fev(), [snap("2026-10-29T00:00:00.000Z", "u"), snap("2026-11-09T16:00:00.000Z", "n"), snap("2026-11-09T19:30:00.000Z", "u")]);
      const st = (dd) => [...dd.querySelectorAll("[data-gate]")].map((r) => r.getAttribute("data-state")).join("");
      ok(st(kept) === "mmmmnmmmmm" && /last snapshot kept before it, 10 Nov 2026, 00:00 MYT/.test(kept.querySelector("[data-pre-flip]").textContent) && st(fdoc(fev(), [snap("2026-11-08T12:00:00.000Z", "n")])) === "none".repeat(10) && st(fdoc(fev(), [snap("2026-11-09T19:00:00.000Z", "n")])) === "none".repeat(10),
        "the marks are the newest snapshot kept in the day before the way back was written; one older, or after it, gives none: " + st(kept));
      ok(/so it read true when the way back was written, 10 Nov 2026, 02:57:10 MYT/.test(d.querySelector("[data-pre-flip]").textContent), "and the page says the gate read true when flip.mjs wrote the way back, at its second");
    }

    /* 8d: the record, the way back and the runbook as run */
    {
      const d = fdoc(fev()), nf = fdoc(fev({ wayBack: null }));
      const backs = (dd) => ({ copy: dd.querySelectorAll("[data-back] [data-copy]").length, locked: dd.querySelectorAll("[data-back][data-locked]").length, cmds: dd.querySelectorAll("[data-back] [data-cmd]").length });
      ok(JSON.stringify(backs(d)) === '{"copy":3,"locked":0,"cmds":3}' && JSON.stringify(backs(nf)) === '{"copy":0,"locked":3,"cmds":3}' && nf.querySelectorAll("[data-back] [data-lock]").length === 3 && /not on this laptop/.test(B.BACK_NO_FILE) && /seeds D1's mirror/.test(d.querySelector("#h-back").parentNode.textContent),
        "flipped, the way back can be copied once the way-back file is read, and is text only, saying why, without it; the re-seed warning stays: " + JSON.stringify([backs(d), backs(nf)]));
      ok(/10 Nov 2026, 02:57:10 MYT$/.test(d.querySelector('[data-rec="way"]').textContent) && !/the record/.test(d.querySelector('[data-rec="way"]').textContent) && /\(the record\)/.test(nf.querySelector('[data-rec="way"]').textContent) && /Flipped 10 Nov 2026/.test(nf.querySelector("[data-verdict] h2").textContent),
        "the way back's time is the file's when it is read and the record's, said so, when it is not");
      const steps = [...d.querySelectorAll("[data-step]")].map((li) => li.getAttribute("data-step"));
      ok(steps.join() === "P1,P2,P3,P4,P5,GO,S0,S3,S4,S5,S6,S7,S8" && [...d.querySelectorAll("[data-step]")].every((li) => /Done/.test(li.querySelector(".salt-status").textContent)) && !d.querySelector("[data-tick]") && !d.querySelector("[data-reset]"),
        "the runbook is drawn as run, every step Done and nothing to tick: " + steps.join());
      const errs = [], vc = new VirtualConsole(); vc.on("jsdomError", (e) => errs.push(e.message));
      const w = new JSDOM(B.renderFlipped(B.flippedView(fev(), []), B.RUNBOOK, bare), { url: "https://board.test/", runScripts: "dangerously", virtualConsole: vc }).window;
      w.document.querySelector('[data-look="night"]').click();
      ok(!errs.length && w.document.documentElement.getAttribute("data-theme") === "night", "the page's script runs with no ticks and no Reset on it: " + errs.join(" | "));
      const on = (v) => { const dd = fdoc(fev(), [], { flippedOn: v }); return [dd.querySelector("[data-verdict] h2").textContent, (dd.querySelector("[data-flipped-why]") || {}).textContent || ""]; };
      const [o1, o2] = [on("2026-11-11"), on("2026-02-30")];
      ok(o1[0] === "Flipped 11 Nov 2026" && !o1[1] && o2[0] === "Flipped 10 Nov 2026" && /not a real/.test(o2[1]), "--flipped-on sets the date shown only when it is a real date not after today; otherwise it is said and the way-back file's day stands: " + JSON.stringify([o1, o2]));
    }

    /* 8e: privacy and escapes: his typed words are never read from the way-back file; what is read is escaped */
    {
      const tmp = mkdtempSync(join(tmpdir(), "flip-way-"));
      try {
        const f = join(tmp, "w.json"); writeFileSync(f, JSON.stringify({ writtenAt: "2026-11-09T18:57:10.132Z", his: "My secret go here", sha: "<img src=x>", bookRev: 368, flags: { book_source: "d1", "<b>": "x", book_tap: "<i>" } }));
        const w = B.readWayBack(f), html = B.renderFlipped(B.flippedView(fev({ wayBack: w }), []), B.RUNBOOK, bare);
        ok(w && !("his" in w) && w.sha === null && JSON.stringify(w.flags) === '{"book_source":"d1"}' && !/My secret go/.test(html) && B.readWayBack(join(tmp, "none.json")) === null, "the way-back file is read for its time, revision, sha and flags alone, never his words, and a malformed field is dropped: " + JSON.stringify(w));
      } finally { rmSync(tmp, { recursive: true, force: true }); }
      const bad = H(); bad.checks.find((c) => c.id === "readcheck").got.source = "<script>alert(1)</script>"; bad.checks.find((c) => c.id === "source").got = "<img src=x onerror=1>";
      const html = B.renderFlipped(B.flippedView(fev({ health: bad }), []), B.RUNBOOK, bare);
      ok(!/<script>alert|<img src=x/.test(html) && /&lt;script&gt;alert/.test(html) && /&lt;img src=x/.test(html), "a reading's words are escaped on the page");
    }

    /* 8f: the readings are flip.mjs's own (health, the same checks --verify runs), each unread one null, which --verify still reads as not ok */
    {
      const dead = { d1: () => ({ error: "unread" }), get: async () => ({ status: 0, body: {} }) };
      const hd = await F.health(dead, { steady: true }), vd = await F.verify(dead);
      ok(hd.checks.map((c) => c.id).join() === "source,roster,tap,read,readcheck,unbooked,fallbacks" && hd.checks.every((c) => c.ok === null) && hd.ok === false,
        "with nothing readable every health reading is null (Unverified), the steady flags read beside --verify's: " + JSON.stringify(hd.checks.map((c) => [c.id, c.ok])));
      ok(!vd.ok && vd.checks.length === 5 && vd.checks.every((c) => c.ok === false) && vd.checks.map((c) => c.id).join() === "source,roster,readcheck,unbooked,fallbacks" && vd.checks.every((c) => Object.keys(c).join() === "id,ok,text"),
        "and --verify over the same reads each as not ok, its five checks and its shape unchanged: " + JSON.stringify(vd.checks.map((c) => [c.id, c.ok])));
      const live = stub({ book_source: "book", book_roster: "on" }); live.io.get = async () => ({ status: 200, body: { ok: false, source: "book", bookRev: 412, differ: ["state.PRICING"] } });
      const hl = await F.health(live.io, { steady: true }), hv = B.healthOf(hl, EX);
      ok(hl.ok && hv.ok === true && hv.rev === 412 && hv.items.find((i) => i.id === "readcheck").detail === "rev 412, 0 stuck, 1 frozen", "over a healthy stand-in every reading is true and the readcheck says its revision and the frozen mirror: " + hv.items.find((i) => i.id === "readcheck").detail);
      const io = B.boardIo(async () => { throw new TypeError("fetch failed"); }, () => null);
      let g; try { g = await io.get("/book/readcheck"); } catch (e) { g = { threw: e.message }; }
      const r = io.d1("SELECT 1");
      ok(g.status === 0 && r.error && !r.rows, "the board's io answers a Book call that throws as no answer and a D1 read that failed as unread, so neither is taken as healthy: " + JSON.stringify(g));
      const page = B.boardIo(async () => ({ status: 200, body: {} }), () => [{ n: 0, mode: "on" }]), real = B.boardIo(async () => ({ status: 200, body: { ok: false, source: "book" } }), () => [{ n: 0 }]);
      const lp = await F.health(page, { steady: true });
      ok((await page.get("/book/readcheck")).status === 0 && (await real.get("/book/readcheck")).status === 200 && lp.checks.find((c) => c.id === "readcheck").ok === null,
        "a 200 that is not the readcheck's own answer (Access's login page, no key or login set) is no answer, so the readcheck reads Unverified, never Not healthy");
    }

    /* 8g: the day's export off the chain's step list, over a stand-in for gh and git */
    {
      const now = "2026-11-14T02:00:00.000Z", step = (c) => JSON.stringify({ jobs: [{ steps: [{ name: B.DAY_STEP, conclusion: c }] }] });
      const gh = (runs, views, last = "") => (cmd, args) => cmd === "git" ? { code: 0, out: last } : args[1] === "list" ? { code: 0, out: JSON.stringify(runs) } : views[args[2]] === undefined ? { code: 1, out: "no" } : { code: 0, out: views[args[2]] };
      const runs = [{ databaseId: 3, createdAt: "2026-11-14T01:00:00Z", status: "completed" }, { databaseId: 2, createdAt: "2026-11-13T20:00:00Z", status: "completed" }, { databaseId: 1, createdAt: "2026-11-10T20:00:00Z", status: "completed" }];
      const found = B.collectExport(now, gh(runs, { 3: step("skipped"), 2: step("success"), 1: step("success") }));
      const none = B.collectExport(now, gh(runs, { 3: step("skipped"), 2: step("skipped"), 1: step("success") }, "2026-11-11T09:53:44Z\n"));
      const blind = B.collectExport(now, gh(runs, { 3: step("skipped") })), dark = B.collectExport(now, () => ({ code: 1, out: "gh: not logged in" }));
      ok(found.at === "2026-11-13T20:00:00Z" && found.conclusion === "success" && none.at === null && none.unread === 0 && none.lastCommit === "2026-11-11T09:53:44.000Z" && blind.at === null && blind.unread === 1 && dark === null,
        "the newest run of the last 30 hours whose day's export step ran is the reading, a skipped step passed over, an older run never counted, a run unread counted, Actions unread null: " + JSON.stringify([found, none, blind]));
      ok(B.exportCheck(found).ok === true && B.exportCheck(none).ok === false && /11 Nov 2026, 17:53 MYT/.test(B.exportCheck(none).last) && B.exportCheck(blind).ok === null && B.exportCheck(dark).ok === null && B.exportCheck({ ...found, conclusion: "failure" }).ok === false,
        "and it is judged: ran and succeeded true; none in the window false, saying the last in git; anything unread null: " + B.exportCheck(none).detail + " / " + B.exportCheck(none).last);
      const tileNote = fdoc(fev({ export: none })).querySelectorAll(".salt-glance__item")[2].textContent;
      ok(/not in 30 hours/.test(tileNote) && /the last in git 11 Nov 2026, 17:53 MYT/.test(tileNote), "and the page's export tile says when git last took one: " + tileNote);
    }
  }
}
