/* test/day-export.mjs: THE DAY'S EXPORT, ASKED FOR AND PROVED (14 Nov 2026, the day-export plan, his answers of the same day).
 *
 * A. the one rule (src/day-export.js): the Kuala Lumpur day, the evidence (a chain job's EXPORT_STEP with success on today's date,
 *    any attempt), a run waiting or running, a run named for today's export, the Worker's pace, the reads, and the step's name
 *    pinned to the workflow;
 * B. the chain's reader (tools/day-export.mjs --due) against a stand-in GitHub: due, not due, cannot tell;
 * C. the chain's own plan step ("What this run does"), run in bash as GitHub runs it: a scheduled run exports only when due, an
 *    unreadable GitHub leaves export at 0 with the step green, a dispatch with export never asks, git as the source never exports;
 * D. the Desk Worker's minute cron (src/worker.js exportAsk): from 00:05 Kuala Lumpur one dispatch with export and no second
 *    publish run, paced reads, no dispatch over a busy chain, a try every 30 minutes and four a night, done once landed, nothing
 *    outside the window or with git as the source, and a refused try leaving the day's publish to go;
 * E. the 09:00 digest: no export rings on a device subscribed as the Desk subscribes, with the warning's kind written where the
 *    banner reads it; an unreadable GitHub rings with its own kind; a landed export and git as the source stay quiet.
 * Every check was proved red by its own mutation (test/day-export.mutations.json, run with tools/section.mjs). Ids, times and
 * words are invented. */
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdtempSync } from "node:fs";
import { spawn, execFileSync, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { parseDocument } from "yaml";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

class KV {
  constructor() { this.m = new Map(); }
  async put(k, v) { this.m.set(k, v); }
  async get(k, type) { if (!this.m.has(k)) return null; const raw = this.m.get(k); return type === "json" ? JSON.parse(raw) : raw; }
  async delete(k) { this.m.delete(k); }
  async list({ prefix = "" } = {}) { return { keys: [...this.m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; }
}

function workflowBash() {
  if (process.platform !== "win32") return "bash";
  const execPath = execFileSync("git", ["--exec-path"], { encoding: "utf8" }).trim();
  const root = dirname(dirname(dirname(execPath)));
  const bundled = [join(root, "bin", "bash.exe"), join(root, "usr", "bin", "bash.exe")].find(existsSync);
  if (bundled) return bundled;
  const found = spawnSync("where.exe", ["bash.exe"], { encoding: "utf8" });
  const system = found.status === 0 && found.stdout.split(/\r?\n/).map((p) => p.trim()).find((p) => p && existsSync(p));
  if (system) return system;
  throw new Error("Bash was not found in the Git installation or on PATH");
}
const spawnP = (cmd, args, opts) => new Promise((res) => {
  const c = spawn(cmd, args, opts); let out = "";
  c.stdout.on("data", (d) => { out += d; }); c.stderr.on("data", (d) => { out += d; });
  c.on("close", (code) => res({ code, out }));
});

export async function run({ ok }) {
  const X = await import("../src/day-export.js");
  const J = JSON.stringify;
  const DAY = "2026-11-15";
  const st = (name, conclusion, completed_at, status = "completed") => ({ name, status, conclusion, completed_at });
  const chain = (steps, status = "completed") => ({ name: "chain", status, steps });
  const R = (id, o = {}) => ({ id, event: "workflow_dispatch", status: "completed", display_title: "Cloud commit: publish: approval", created_at: "2026-11-14T20:00:00Z", ...o });
  const by = (map) => (id) => map[id] || [];
  const LANDED = st(X.EXPORT_STEP, "success", "2026-11-14T16:20:00Z");   /* 00:20 on 15 Nov in Kuala Lumpur */
  const SKIPPED = st(X.EXPORT_STEP, "skipped", "2026-11-14T16:20:00Z");

  /* A. THE ONE RULE */
  ok(X.klDay("2026-11-14T15:59:59Z") === "2026-11-14" && X.klDay("2026-11-14T16:00:00Z") === DAY && X.klDayStart(DAY) === Date.parse("2026-11-14T16:00:00Z"),
    "the Kuala Lumpur day turns at 16:00 UTC: " + J([X.klDay("2026-11-14T15:59:59Z"), X.klDay("2026-11-14T16:00:00Z")]));
  const landed = X.exportLanded([R(1)], by({ 1: [chain([LANDED])] }), DAY);
  ok(landed.done && landed.run === 1, "an export step with success on today's date has landed: " + J(landed));
  const notLanded = [
    ["skipped", X.exportLanded([R(1)], by({ 1: [chain([SKIPPED])] }), DAY)],
    ["failed", X.exportLanded([R(1)], by({ 1: [chain([st(X.EXPORT_STEP, "failure", "2026-11-14T16:20:00Z")])] }), DAY)],
    ["yesterday", X.exportLanded([R(1)], by({ 1: [chain([st(X.EXPORT_STEP, "success", "2026-11-14T15:59:00Z")])] }), DAY)],
    ["another step", X.exportLanded([R(1)], by({ 1: [chain([st("Export the Book to the checkout for the publish", "success", "2026-11-14T16:20:00Z")])] }), DAY)],
    ["another job", X.exportLanded([R(1)], by({ 1: [{ name: "suite (1)", steps: [LANDED] }] }), DAY)]];
  ok(notLanded.every(([, v]) => !v.done), "skipped, failed, yesterday's, another step and another job are not today's export: " + J(notLanded.map(([k, v]) => [k, v.done])));
  const reRun = X.exportLanded([R(1)], by({ 1: [chain([LANDED]), chain([st(X.EXPORT_STEP, "failure", "2026-11-14T17:00:00Z")])] }), DAY);
  ok(reRun.done, "an export that landed in one attempt counts though a later attempt of the run failed: " + J(reRun));
  ok(X.chainBusy([R(1, { status: "queued" })], by({}), null) === 1, "a run created and not started is busy before it lists a job");
  ok(X.chainBusy([R(1, { status: "in_progress" })], by({ 1: [chain([], "in_progress")] }), null) === 1, "a run whose chain job runs is busy");
  ok(X.chainBusy([R(1, { status: "in_progress" })], by({ 1: [chain([]), { name: "suite (1)", status: "in_progress", steps: [] }] }), null) === 0,
    "a run whose chain has finished and only its suite runs is not busy: the lock is free");
  ok(X.chainBusy([R(7, { status: "in_progress" })], by({ 7: [chain([], "in_progress")] }), 7) === 0, "the run asking leaves itself out");
  ok(X.exportInHand([R(2, { status: "in_progress", display_title: X.exportTitle(DAY) })], DAY) === 2
    && X.exportInHand([R(2, { display_title: X.exportTitle(DAY) })], DAY) === 0
    && X.exportInHand([R(2, { status: "in_progress", display_title: X.exportTitle("2026-11-14") })], DAY) === 0
    && X.exportTitle(DAY) === "Cloud commit: export: the day " + DAY,
    "a run named for today's export and still open is in hand; a finished one or yesterday's is not");
  const dv = [X.dueVerdict([R(1)], by({ 1: [chain([LANDED])] }), DAY), X.dueVerdict([R(2, { status: "queued", display_title: X.exportTitle(DAY) })], by({}), DAY),
    X.dueVerdict([R(1)], by({ 1: [chain([SKIPPED])] }), DAY)];
  ok(!dv[0].due && !dv[1].due && dv[2].due, "the clock's verdict: not due once landed or in hand, due otherwise: " + J(dv));
  const at = (kl) => Date.parse(DAY + "T" + kl + ":00+08:00");
  const P = (kl, mark) => X.askPace(at(kl), mark).act;
  ok(P("00:04", null) === "rest" && P("00:05", null) === "read" && P("05:59", null) === "read" && P("06:00", null) === "rest",
    "the Worker reads from 00:05 to 05:59 and rests outside it: " + J(["00:04", "00:05", "05:59", "06:00"].map((t) => P(t, null))));
  ok(P("00:30", { day: DAY, done: true }) === "rest" && P("00:30", { day: DAY, read: new Date(at("00:21")).toISOString() }) === "rest"
    && P("00:30", { day: DAY, read: new Date(at("00:20")).toISOString() }) === "read" && X.askPace(at("00:30"), { day: "2026-11-14", tries: 4, done: true }).mark.tries === 0,
    "it rests once done, reads at most every 10 minutes, and a new night starts its count again");
  const V = (mark, l, b, kl = "01:00") => X.askVerdict(at(kl), Object.assign({ day: DAY, tries: 0 }, mark), l || { done: false }, b || 0).act;
  ok(V({}, { done: true }) === "done" && V({}, null, 9) === "busy" && V({ tries: 4 }) === "spent"
    && V({ tries: 1, tried: new Date(at("00:31")).toISOString() }) === "spaced" && V({ tries: 1, tried: new Date(at("00:30")).toISOString() }) === "dispatch" && V({}) === "dispatch",
    "after a read: done, busy, four tries spent, under 30 minutes since the last, or dispatch");
  const paths = [];
  const fakeGet = (pages, jobs) => async (p) => { paths.push(p); if (p.includes("/jobs")) return { jobs: jobs[p.split("/")[2]] || [] };
    const n = Number(/[?&]page=(\d+)/.exec(p)[1]); return { workflow_runs: pages[n - 1] || [] }; };
  const full = Array.from({ length: 2 }, (_, i) => R(100 + i));
  const ev = await X.readRuns(fakeGet([full, [R(200, { event: "push" }), R(201, { event: "push", status: "in_progress" })], [R(202, { event: "schedule" })]], {}), DAY, { perPage: 2 });
  ok(ev.runs.length === 5 && paths.filter((p) => p.includes("/runs?")).length === 3 && paths[0].includes("created=%3E%3D2026-11-14T10%3A00%3A00Z")
    && paths.some((p) => p === "actions/runs/100/jobs?filter=all&per_page=100") && paths.some((p) => p.startsWith("actions/runs/201/jobs"))
    && paths.some((p) => p.startsWith("actions/runs/202/jobs")) && !paths.some((p) => p.startsWith("actions/runs/200/jobs")),
    "the reads page on, start six hours before the day, read every attempt's jobs of dispatched, scheduled and open runs, and skip a finished push run: " + J(paths));
  let threw = false;
  try { await X.readRuns(async () => ({ message: "Bad credentials" }), DAY); } catch (e) { threw = /workflow_runs/.test(String(e.message)); }
  ok(threw, "an answer with no run list throws, so silence is never read as no export");
  const wf = readFileSync(join(ROOT, ".github", "workflows", "cloud-commit.yml"), "utf8"), doc = parseDocument(wf).toJS();
  const exportStep = (doc.jobs.chain.steps || []).find((s) => s.name === X.EXPORT_STEP);
  ok(!!exportStep && /book-export\.mjs --day/.test(exportStep.run || "") && /export == '1'/.test(String(exportStep.if || "")) && X.CHAIN_JOB === "chain",
    "the step the rule reads by name is the chain job's own export step, the one that runs book-export --day: " + J({ found: !!exportStep, if: exportStep && exportStep.if }));
  ok(String(doc["run-name"]).includes("format('Cloud commit: {0}', inputs.reason)"), "the run-name gives a dispatch's reason after 'Cloud commit: ', which exportTitle matches");

  /* A STAND-IN GITHUB for B and C: one scenario at a time, every request counted */
  let scen = { runs: [], jobs: {}, status: 200 }, hits = [];
  const server = createServer((req, res) => {
    hits.push(req.method + " " + req.url);
    if (scen.status !== 200) { res.writeHead(scen.status); return res.end("{}"); }
    const m = /\/actions\/runs\/(\d+)\/jobs/.exec(req.url);
    const body = m ? { jobs: scen.jobs[m[1]] || [] } : /\/actions\/workflows\/cloud-commit\.yml\/runs/.test(req.url) ? { workflow_runs: scen.runs } : null;
    res.writeHead(body ? 200 : 404, { "content-type": "application/json" }); res.end(J(body || {}));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const API = "http://127.0.0.1:" + server.address().port;
  const env0 = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(GITHUB_|GH_TOKEN$|DAY_EXPORT_NOW$)/.test(k)));
  const envFor = (more = {}) => ({ ...env0, GH_TOKEN: "t", GITHUB_REPOSITORY: "o/r", GITHUB_API_URL: API, DAY_EXPORT_NOW: "2026-11-15T01:00:00+08:00", ...more });
  const due = (more) => spawnP(process.execPath, [join(ROOT, "tools", "day-export.mjs"), "--due"], { cwd: ROOT, env: envFor(more) });
  try {
    /* B. THE CHAIN'S READER */
    scen = { runs: [R(1)], jobs: { 1: [chain([SKIPPED])] }, status: 200 }; hits = [];
    const b1 = await due();
    ok(b1.code === 0 && /due: no export has landed on 2026-11-15/.test(b1.out) && hits.some((h) => h.startsWith("GET /repos/o/r/actions/workflows/cloud-commit.yml/runs?")),
      "with no export today the reader says due (exit 0): " + J({ code: b1.code, out: b1.out.trim(), hits }));
    scen = { runs: [R(1)], jobs: { 1: [chain([LANDED])] }, status: 200 };
    const b2 = await due();
    ok(b2.code === 1 && /not due: landed today in run 1/.test(b2.out), "once it has landed, not due (exit 1): " + J({ code: b2.code, out: b2.out.trim() }));
    scen = { runs: [R(2, { status: "in_progress", display_title: X.exportTitle(DAY) })], jobs: { 2: [chain([], "in_progress")] }, status: 200 };
    const b3 = await due();
    ok(b3.code === 1 && /run 2 is exporting today/.test(b3.out), "a run named for today's export still running makes it not due: " + J({ code: b3.code, out: b3.out.trim() }));
    const b3b = await due({ GITHUB_RUN_ID: "2" });
    ok(b3b.code === 0, "but the run asking is never its own reason not to: " + J({ code: b3b.code, out: b3b.out.trim() }));
    scen = { runs: [], jobs: {}, status: 500 };
    const b4 = await due(), b5 = await due({ GH_TOKEN: "" });
    ok(b4.code === 2 && /cannot tell: GitHub answered 500/.test(b4.out) && b5.code === 2 && /no GH_TOKEN/.test(b5.out),
      "a GitHub that will not answer, or no token, is cannot tell (exit 2): " + J([b4.code, b4.out.trim(), b5.code, b5.out.trim()]));

    /* C. THE PLAN STEP, AS GITHUB RUNS IT */
    const planStep = doc.jobs.chain.steps.find((s) => s.name === "What this run does");
    ok(planStep && planStep.env && planStep.env.GH_TOKEN === "${{ github.token }}" && (doc.jobs.chain.permissions || {}).actions === "read",
      "the plan step carries the run's own token, and the job may read its runs: " + J(planStep && planStep.env));
    const bash = workflowBash(), dir = mkdtempSync(join(tmpdir(), "dayexport-"));
    const plan = async (ctx, scenario, more = {}) => {
      scen = scenario; hits = [];
      const out = join(dir, "out-" + Math.random().toString(36).slice(2) + ".txt"); writeFileSync(out, "");
      const base = { "steps.source.outputs.mode": "book", "github.event_name": "schedule", "inputs.export": "", "inputs.stage_only": "", "inputs.probe_key": "",
        "steps.guard.outputs.staged": "", "steps.guard.outputs.folded": "", "steps.guard.outputs.held": "", "steps.commit.outputs.staged": "" };
      const c = Object.assign(base, ctx);
      const script = String(planStep.run).replace(/\$\{\{\s*([^}]*?)\s*\}\}/g, (_, k) => (k in c ? c[k] : ""));
      const r = await spawnP(bash, ["--noprofile", "--norc", "-eo", "pipefail", "-c", script], { cwd: ROOT, env: { ...envFor(more), GITHUB_OUTPUT: out.replace(/\\/g, "/") } });
      const o = {}; for (const l of readFileSync(out, "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0) o[l.slice(0, i)] = l.slice(i + 1).trim(); }
      return { code: r.code, o, out: r.out, hits: hits.length };
    };
    const none = { runs: [R(1)], jobs: { 1: [chain([SKIPPED])] }, status: 200 }, done = { runs: [R(1)], jobs: { 1: [chain([LANDED])] }, status: 200 };
    const c1 = await plan({}, none), c2 = await plan({}, done), c3 = await plan({}, { runs: [], jobs: {}, status: 503 });
    ok(c1.code === 0 && c1.o.export === "1" && c1.o.deploy === "1", "a scheduled run with no export today exports, whatever hour, and so deploys: " + J(c1.o) + " " + c1.out.slice(-200));
    ok(c2.code === 0 && c2.o.export === "0", "a scheduled run once today's export has landed does not export: " + J(c2.o));
    ok(c3.code === 0 && c3.o.export === "0" && /cannot tell/.test(c3.out), "a GitHub that will not answer leaves export at 0 and the step green: " + J({ code: c3.code, o: c3.o }));
    const c4 = await plan({ "github.event_name": "workflow_dispatch", "inputs.export": "true", "inputs.stage_only": "true" }, done);
    ok(c4.code === 0 && c4.o.export === "1" && c4.hits === 0, "a dispatch with export always exports and asks GitHub nothing: " + J({ o: c4.o, hits: c4.hits }));
    const c5 = await plan({ "steps.source.outputs.mode": "d1" }, none), c6 = await plan({ "github.event_name": "push" }, none);
    ok(c5.code === 0 && c5.o.export === "0" && c5.hits === 0 && c6.o.export === "0" && c6.hits === 0,
      "with git as the source, or on a push, nothing exports and GitHub is not asked: " + J({ c5: c5.o, c6: c6.o, hits: [c5.hits, c6.hits] }));
  } finally { server.close(); }

  /* D. THE DESK WORKER'S MINUTE CRON */
  const desk = (await import("../src/worker.js")).default;
  const sig = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const vapid = { VAPID_PUBLIC_KEY: "pub", VAPID_SUBJECT: "mailto:a@b.test", VAPID_PRIVATE_JWK: J(await crypto.subtle.exportKey("jwk", sig.privateKey)) };
  const world = (source = "book") => {
    const db = new DatabaseSync(":memory:"), dir = new URL("../migrations/", import.meta.url);
    for (const f of readdirSync(dir).filter((x) => /^\d+_.*\.sql$/.test(x)).sort()) db.exec(readFileSync(new URL(f, dir), "utf8"));
    db.exec("UPDATE book_source SET mode='" + source + "' WHERE one=1");
    const d1 = { prepare(sql) { const s = db.prepare(sql), bind = (a) => ({ all: () => ({ results: s.all(...a), success: true }), first: () => s.get(...a) ?? null, run: () => ({}) });
        return { ...bind([]), bind: (...a) => bind(a) }; },
      batch(stmts) { db.exec("BEGIN"); try { const out = stmts.map((s) => s.all()); db.exec("COMMIT"); return out; } catch (e) { db.exec("ROLLBACK"); throw e; } } };
    const kv = new KV();
    const env = Object.assign({ SALT_LEDGER: d1, SALT_QUEUE: kv, REQUIRE_ACCESS: "0", SALT_GITHUB_TOKEN: "tok",
      ASSETS: { fetch: async () => new Response("{}", { status: 404 }) } }, vapid);
    return { env, kv };
  };
  const GH = "https://api.github.com/repos/maakmal97/salt-command/";
  const tick = async (env, cron, iso, g) => {
    const waits = [], realL = console.log, logs = [], realF = globalThis.fetch, calls = [];
    console.log = (...x) => logs.push(x.join(" "));
    globalThis.fetch = async (input, init = {}) => {
      const u = String((input && input.url) || input), method = (init && init.method) || "GET";
      calls.push({ u, method, body: init && init.body ? String(init.body) : "" });
      if (u.startsWith("https://push.example/")) return new Response("", { status: 201 });
      if (u.startsWith(GH)) {
        if (g.status && g.status !== 200) return new Response("{}", { status: g.status });
        if (method === "POST" && u.endsWith("/dispatches")) return new Response(null, { status: g.dispatch || 204 });
        const m = /actions\/runs\/(\d+)\/jobs/.exec(u);
        if (m) return new Response(J({ jobs: (g.jobs || {})[m[1]] || [] }), { status: 200 });
        if (/actions\/workflows\/cloud-commit\.yml\/runs/.test(u)) return new Response(J({ workflow_runs: g.runs || [] }), { status: 200 });
      }
      return new Response("", { status: 404 });
    };
    try { await desk.scheduled({ cron, scheduledTime: Date.parse(iso) }, env, { waitUntil: (p) => waits.push(p) }); await Promise.all(waits); }
    finally { console.log = realL; globalThis.fetch = realF; }
    const dispatches = calls.filter((c) => c.method === "POST" && c.u.endsWith("/dispatches")).map((c) => JSON.parse(c.body).inputs);
    return { logs, calls, dispatches, reads: calls.filter((c) => c.u.startsWith(GH + "actions/workflows/cloud-commit.yml/runs?created")).length,
      pushes: calls.filter((c) => c.u.startsWith("https://push.example/")).length };
  };
  const KLT = (kl) => new Date(Date.parse(DAY + "T" + kl + ":00+08:00")).toISOString();
  const quiet = { runs: [R(1)], jobs: { 1: [chain([SKIPPED])] } };

  const w = world();
  const d1 = await tick(w.env, "* * * * *", KLT("00:05"), quiet);
  const night = await w.kv.get("export:night", "json");
  ok(d1.dispatches.length === 1 && d1.dispatches[0].export === "true" && d1.dispatches[0].stage_only === "true" && d1.dispatches[0].reason === "export: the day " + DAY
    && night && night.tries === 1 && d1.logs.some((l) => /^export dispatch: try 1 for 2026-11-15$/.test(l)),
    "at 00:05 with no export today the Desk sends ONE run, with export, and the day's publish sends no second: " + J({ dispatches: d1.dispatches, night }));
  const d2 = await tick(w.env, "* * * * *", KLT("00:06"), quiet);
  ok(d2.reads === 0 && d2.dispatches.length === 0, "a minute later it reads nothing: the rule is read at most every 10 minutes: " + J({ reads: d2.reads }));
  const busy = { runs: [R(5, { status: "in_progress", display_title: X.exportTitle(DAY) })], jobs: { 5: [chain([], "in_progress")] } };
  const d3 = await tick(w.env, "* * * * *", KLT("00:15"), busy);
  ok(d3.reads === 1 && d3.dispatches.length === 0, "while the chain runs it reads and sends nothing: " + J({ reads: d3.reads, dispatches: d3.dispatches }));
  const d4 = await tick(w.env, "* * * * *", KLT("00:25"), quiet);
  ok(d4.dispatches.length === 0, "a run replaced and gone, under 30 minutes since the try, waits: " + J(d4.dispatches));
  const d5 = await tick(w.env, "* * * * *", KLT("00:35"), quiet);
  ok(d5.dispatches.length === 1 && d5.dispatches[0].export === "true" && (await w.kv.get("export:night", "json")).tries === 2, "30 minutes on it tries again: " + J(d5.dispatches));
  const landedNight = { runs: [R(6)], jobs: { 6: [chain([st(X.EXPORT_STEP, "success", KLT("00:41"))])] } };
  const d6 = await tick(w.env, "* * * * *", KLT("00:45"), landedNight), d7 = await tick(w.env, "* * * * *", KLT("01:30"), quiet);
  const land = await w.kv.get("export:landed", "json");
  ok(d6.dispatches.length === 0 && (await w.kv.get("export:night", "json")).done === true && land && land.day === DAY && land.run === 6 && d7.reads === 0 && d7.dispatches.length === 0,
    "once it has landed the night is done: no try, no read for the rest of it, and the day kept: " + J({ land, d7: d7.reads }));
  const s = world(); await s.kv.put("export:night", J({ day: DAY, done: false, tries: 4, tried: KLT("01:00"), read: KLT("01:00") }));
  const d8 = await tick(s.env, "* * * * *", KLT("02:00"), quiet);
  ok(d8.reads === 1 && !d8.dispatches.some((x) => x.export) && d8.logs.some((l) => /four tries spent/.test(l)), "four tries end the night's asking, said in the log: " + J(d8.dispatches));
  const o = world();
  const d9 = await tick(o.env, "* * * * *", KLT("06:00"), quiet), d10 = await tick(o.env, "* * * * *", KLT("00:04"), quiet);
  ok(d9.reads === 0 && d10.reads === 0 && d9.dispatches.length === 0 && d10.dispatches.length === 0, "outside 00:05 to 06:00 it reads and sends nothing");
  const g = world("d1");
  const d11 = await tick(g.env, "* * * * *", KLT("00:05"), quiet);
  ok(d11.reads === 0 && !d11.dispatches.some((x) => x.export), "with git as the source it never asks for the export: " + J(d11.dispatches));
  const f = world();
  const d12 = await tick(f.env, "* * * * *", KLT("00:05"), Object.assign({ dispatch: 422 }, quiet));
  ok(d12.dispatches.length === 2 && d12.dispatches[0].export === "true" && !d12.dispatches[1].export && d12.logs.some((l) => /export dispatch REFUSED/.test(l)),
    "a refused try is said, and leaves the day's publish to send its own run: " + J(d12.dispatches));

  /* E. THE 09:00 DIGEST */
  const digest = async (source, gh) => {
    const x = world(source);
    await x.kv.put("push:aa11", J({ endpoint: "https://push.example/his-phone", topics: ["orders", "approve", "salt"] }));
    await x.kv.put("export:landed", J({ day: "2026-11-13", run: 4 }));
    const r = await tick(x.env, "0 1 * * *", "2026-11-15T01:00:00Z", gh);
    return { ...r, inform: await x.kv.get("inform:last", "json") };
  };
  const e1 = await digest("book", quiet), e2 = await digest("book", landedNight), e3 = await digest("book", { status: 502 }), e4 = await digest("d1", quiet);
  ok(e1.pushes === 1 && e1.inform && e1.inform.k === "export" && e1.logs.some((l) => /^git export alarm: git has no export of the Book on 2026-11-15; the last landed on 2026-11-13$/.test(l)),
    "no export by 09:00 rings a device subscribed as the Desk subscribes, the warning's kind kept for its words: " + J({ pushes: e1.pushes, inform: e1.inform, logs: e1.logs.slice(0, 3) }));
  ok(e2.pushes === 0 && !e2.inform && e2.logs.some((l) => /nothing worth saying/.test(l)), "a landed export leaves the digest quiet: " + J(e2.logs.slice(0, 3)));
  ok(e3.pushes === 1 && e3.inform && e3.inform.k === "export-unchecked" && e3.logs.some((l) => /git export alarm: the day's export could not be checked/.test(l)),
    "a GitHub that will not answer rings too, with its own kind: " + J({ inform: e3.inform }));
  ok(e4.pushes === 0 && !e4.inform, "with git as the source the digest says nothing of it");
  const sw = readFileSync(join(ROOT, "public", "sw.js"), "utf8");
  ok(/\n  export: \["No export of the Book to git today", /.test(sw) && /\n  "export-unchecked": \["The day's export could not be checked", /.test(sw),
    "the phone's worker has words for both kinds, so the banner names them and never says Nothing to tell");
}
