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
}
