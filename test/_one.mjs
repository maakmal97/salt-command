/* verify.mjs — smoke tests for the new cloud surface.
 *
 * Covers the risky new code: the Worker's queue contract against a KV mock, the build's
 * patch integrity and script validity, and the drain's pure helpers. The desk's own
 * rendering is tested by the daily run's jsdom pass; this suite guards the cloud plumbing.
 * No network, no browser: `npm test` runs it in a couple of seconds.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { DATA_DIR, PROJECT_DIR } from "../tools/book.mjs";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "../src/worker.js";
import stmtWorker, { normUser } from "../stmt/worker.js";
import { unionByAt, pruneCommitted } from "../tools/drain.mjs";
import { NAME_STOPWORDS, NAME_COLLISIONS, areaNameSet, publishedLocalities } from "../tools/book.mjs";
import { opened } from "../tools/payload.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("  FAIL: " + m); } };
/* AN ASSERTION THAT CANNOT RUN ON EVERY MACHINE IS NOT PART OF THE FLOOR (v437). Two blocks read
   files that live outside this repo and can never enter it: the plaintext directory (hard rule 3)
   and serve_desk.py. So the laptop runs ten checks CI cannot, the floor was raised to the laptop's
   count at v434, and CI has failed on that one line ever since -- through v434, v435 and v436, each
   of which was reported as shipped and green. Nothing substantive failed; the instrument did. Both
   halves of that are the round-ten lesson: a floor calibrated on one machine and enforced on
   another is not a floor, and a red run nobody reads is the same as no run.
   okOff counts as a pass or a fail exactly as ok does. It is subtracted from the FLOOR only, so
   the floor measures what every machine reaches and CI and the laptop can agree on it. */
let offMachine = 0;
const okOff = (c, m) => { offMachine++; ok(c, m); };
const skipOff = (m) => { console.log("  SKIP: " + m); };
/* A SKIP IS NOT A PASS (v442). Nine assertions were written as ok(true, "... (skipped)") for a
   state the book happens not to carry. Each was counted as proof, and each is an assertion that
   CANNOT FAIL, which is the fault this whole round is about: a green tick for a check that never
   ran. None of them is firing today, so nothing was actually being covered up, and that is
   exactly why it was worth fixing now rather than after a book change made one fire silently.
   skipData prints and counts NOTHING, so a section that goes quiet takes the assertion floor
   down with it and CI says so. It is deliberately NOT okOff: okOff is for a check this MACHINE
   cannot run, which is a property of where you are, and this is a check the BOOK cannot feed,
   which is a property of the data and can change under you.
   The floor keeps a margin for these, and the margin is not room for a section to fall out. */
const skipData = (m) => { console.log("  SKIP (no data): " + m); };
let sections = 0;
/* EACH SECTION'S BODY IS ITS OWN ASYNC FUNCTION, `await (async () => { ... })();` (17 Sep 2026). A block at
   the top level of this module is never freed: the module body is suspended at every await, and V8 keeps what
   its blocks held for as long as it runs, closed jsdom window or not. So every desk window stayed alive to the
   end, 4,031 MB of them after a forced GC at v682, and the Linux runner died of heap exhaustion in the v678
   sections while the laptop scraped through. One wrapper around the whole suite does not help, since that
   function is suspended just the same; each section has to return. The last section checks the shape.
   AND EVERY WINDOW openMaster OPENED IS CLOSED HERE, WHEN THE NEXT SECTION STARTS. Most sections never closed
   theirs, and a window left open is held by its own pending timers. Those timers do not fire between sections:
   most sections never yield to the event loop, so a timer waits for the next one that does file or crypto work,
   and a close put on a timer would wait with them. So the close is immediate. */
const section = (s) => {
  for (const w of opened) { try { w.close(); } catch (e) { /* closed already */ } }
  opened.clear();
  sections++; console.log("\n" + s);
};

/* ---- KV + env mocks ------------------------------------------------------------- */
class KV {
  constructor() { this.m = new Map(); this.opts = new Map(); }
  /* v688: the options are kept as well as the value. Real KV expires a key by them, and a route
     that means to write something short-lived (a sent tick, a one-time link) is only doing that
     if the expiry is really passed; ignoring them here would pass either way. */
  async put(k, v, o) { this.m.set(k, v); this.opts.set(k, o || null); }
  /* Real KV takes a type argument and "json" parses for you. The statement route uses it, so
     the stand-in has to as well, or a call that works here fails in production. */
  async get(k, type) {
    if (!this.m.has(k)) return null;
    const raw = this.m.get(k);
    return type === "json" ? JSON.parse(raw) : raw;
  }
  async delete(k) { this.m.delete(k); }
  async list({ prefix = "" } = {}) {
    return { keys: [...this.m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true };
  }
}
const assets = {
  async fetch(req) {
    const p = new URL(req.url).pathname;
    if (p === "/missing") return new Response("nope", { status: 404 });
    /* v387: THE FILES THAT ARE GONE 404 HERE TOO, or the harness cannot see the fallback.
       public/index.html and public/data.json are retired with the app, so the asset store
       has neither, and /app is no longer a route: all three land on the SPA fallback. */
    if (p === "/index.html" || p === "/data.json" || p === "/app") return new Response("nope", { status: 404 });
    if (p === "/") return new Response("nope", { status: 404 });
    return new Response("ASSET:" + p, { status: 200 });
  }
};
const mkEnv = (kv, requireAccess = "0") => ({ SALT_QUEUE: kv, ASSETS: assets, REQUIRE_ACCESS: requireAccess });
const req = (path, opts = {}) => new Request("https://salt-command.example" + path, opts);
const postQ = (body, extraHeaders = {}) => req("/queue", {
  method: "POST", headers: { "content-type": "application/json", ...extraHeaders }, body: JSON.stringify(body)
});

/* ---- 1. Worker: the queue contract --------------------------------------------- */
section("v767: an ID added is an account, minted by the laptop's own chain without being asked");
await (async () => {
  /* HIS INSTRUCTION OF 21 SEP 2026: Add ID and Amend ID must carry the username, the account and its
     password. v707 built the mint and left it a command somebody had to think of running, so CZ5-TM,
     registered on 19 September, held an address and nothing behind it for two days: named on every
     publish, in a log nobody reads. AMEND ID WAS ALREADY WHOLE, and it is worth saying why: an account
     is keyed by the USERNAME, a re-key moves the username to the new code (renameUsers) and the
     password with it (renamePasswords), so the record behind it never moves at all. */
  const { accountSweep, whoIsStuck } = await import("../tools/stmt-account.mjs");
  const C67 = await import("../tools/stmt-crypto.mjs");
  const root67 = join(REPO, "test", "tmp", "acct767");
  const dir67 = join(root67, "2026-09");
  rmSync(root67, { recursive: true, force: true });
  mkdirSync(join(dir67, "_kv"), { recursive: true });
  const M67 = "the-master-767", K67 = "the-content-key-767";
  const uHave = "aaaa-bbbb", pwHave = "already-here";
  const ck67 = await C67.contentKey(K67, uHave);
  writeFileSync(join(dir67, "_kv", uHave + ".json"), JSON.stringify({ u: uHave, issued: "2026-09-01",
    verifier: await C67.makeVerifier(pwHave), wrap: await C67.wrapKey(pwHave, ck67),
    wrapMaster: await C67.wrapKey(M67, ck67), env: await C67.encryptWith(ck67, "{}") }), "utf8");
  writeFileSync(join(root67, "_secrets.json"), JSON.stringify({ key: K67 }), "utf8");
  writeFileSync(join(root67, "_users.json"), JSON.stringify({ "CS6-BS": uHave, "CZ5-TM": "27a4-gkgw" }), "utf8");
  writeFileSync(join(dir67, "_passwords.json"), JSON.stringify({ "CS6-BS": pwHave }), "utf8");
  /* a bucket and a supplier are on the roster too: neither is ever somebody who cannot sign in */
  const R67 = ["CS6-BS", "CZ5-TM", "CS6-BS-R", "SA5-BTR"];

  /* ---- WHO IS STUCK IS ANSWERABLE WITHOUT THE MASTER, which is the whole point of asking ---- */
  const was = process.env.STMT_MASTER;
  try {
    delete process.env.STMT_MASTER;
    ok(JSON.stringify(whoIsStuck(root67, { roster: R67 })) === '["CZ5-TM"]',
      "the question 'is anybody stuck?' no longer needs somebody already able to fix it: "
      + JSON.stringify(whoIsStuck(root67, { roster: R67 })));

    /* ---- NOT THE LAPTOP: nothing is attempted, and it is not an error ---- */
    const nowhere = join(REPO, "test", "tmp", "acct767-nokey");
    rmSync(nowhere, { recursive: true, force: true }); mkdirSync(join(nowhere, "2026-09", "_kv"), { recursive: true });
    const away = await accountSweep(nowhere, { roster: R67 });
    ok(away.ran === false && away.why === "not the laptop",
      "off the laptop it does not try: the content key is here and an account cannot be sealed anywhere else: " + JSON.stringify(away));

    /* ---- THE LAPTOP WITH NO MASTER: it names who, and does not pretend to have done anything ---- */
    const told = await accountSweep(root67, { roster: R67 });
    ok(told.ran === false && told.why === "no master" && JSON.stringify(told.stuck) === '["CZ5-TM"]',
      "with no master it names exactly who cannot sign in, which is what the chain then says out loud: " + JSON.stringify(told));
    ok(readdirSync(join(dir67, "_kv")).length === 1, "and writes nothing at all");

    /* ---- THE LAPTOP WITH THE MASTER: the gap closes, and the account it made really opens ---- */
    process.env.STMT_MASTER = M67;
    const did = await accountSweep(root67, { roster: R67 });
    ok(did.ran === true && did.wrote === 1 && /CZ5-TM/.test(did.minted.join(",")),
      "with it, the run that would have left them stuck mints the account instead: " + JSON.stringify(did.minted));
    const made = JSON.parse(readFileSync(join(dir67, "_kv", "27a4-gkgw.json"), "utf8"));
    const pwNew = JSON.parse(readFileSync(join(dir67, "_passwords.json"), "utf8"))["CZ5-TM"];
    ok(!!pwNew && await C67.checkVerifier(pwNew, made.verifier) && !!made.pwMaster,
      "the password it minted answers the verifier it wrote, and is sealed under the master so Send can hand it over");
    ok(JSON.stringify(whoIsStuck(root67, { roster: R67 })) === "[]", "and nobody is stuck any more");

    /* ---- IT IS QUIET WHEN THERE IS NOTHING TO DO, so a run does not report work it did not do ---- */
    const again = await accountSweep(root67, { roster: R67 });
    ok(again.ran === true && again.minted.length === 0 && (again.wrote || 0) === 0,
      "a second run mints nothing and says nothing: " + JSON.stringify({ minted: again.minted.length, wrote: again.wrote }));
  } finally { if (was === undefined) delete process.env.STMT_MASTER; else process.env.STMT_MASTER = was; }

  /* ---- WHAT THE CHAIN SAYS, branch by branch. It is a function and not a run of update.mjs,
     because everything in that file happens on import, so a branch inside it is a branch nothing
     can put a mutation through. ---- */
  const { sweepLines } = await import("../tools/stmt-account.mjs");
  const say = (sw, o) => sweepLines(sw, o || {}).map((l) => l.level + ": " + l.text);
  ok(say(null, { dry: true })[0] === "ok: skipped (dry run)", "a dry run says so and nothing else");
  ok(/^warn: the account sweep could not run: boom/.test(say(null, { error: "boom" })[0]),
    "a sweep that threw is a warning carrying the reason: " + say(null, { error: "boom" })[0]);
  ok(/^ok: skipped: the content key lives on the laptop/.test(say({ ran: false, why: "not the laptop", minted: [], stuck: [] })[0]),
    "off the laptop it is not a fault, and says why");
  const stuckSaid = say({ ran: false, why: "no master", minted: [], stuck: ["CZ5-TM"] })[0];
  ok(/^warn: CZ5-TM cannot sign in/.test(stuckSaid) && /stmt-account\.mjs --mint/.test(stuckSaid),
    "somebody stuck is a WARNING that names them and the one command that fixes it, which is the "
    + "difference between this and a line in a CI log: " + stuckSaid);
  ok(/^ok: every ID/.test(say({ ran: false, why: "no master", minted: [], stuck: [] })[0]),
    "and with nobody stuck, no master is wanted and the run is quiet");
  const mintSaid = say({ ran: true, minted: ["CZ5-TM (27a4-gkgw)"], named: ["CB7-BJ -> wxyz-1234"], failed: [], wrote: 1 });
  ok(mintSaid.length === 2 && /^ok: minted an account for CZ5-TM/.test(mintSaid[0]) && /next publish/.test(mintSaid[0])
    && /^ok: and a username first for CB7-BJ/.test(mintSaid[1]),
    "a mint says who, and that it goes live at the next publish: " + JSON.stringify(mintSaid));
  const failSaid = say({ ran: true, minted: [], named: [], failed: ["CZ5-TM: no"], wrote: 0 });
  ok(failSaid.some((l) => /^warn: and could not mint: CZ5-TM/.test(l)),
    "and one it could not mint is a warning of its own: " + JSON.stringify(failSaid));
  ok(say({ ran: true, minted: [], named: [], failed: [], wrote: 0 }).join() === "ok: every ID that should have an account has one",
    "with nothing to do it says one line and does not report work it did not do");

  /* the chain runs it BEFORE the build, so a record it mints is committed by the same run */
  const up = readFileSync(join(REPO, "tools", "update.mjs"), "utf8");
  const atSweep = up.indexOf("accountSweep("), atBuild = up.indexOf('step(4, "build")'), atCommit = up.indexOf('step(7, "version")');
  ok(atSweep > 0 && atSweep < atBuild && atBuild < atCommit,
    "and the chain calls it before the build and long before the commit: " + JSON.stringify({ atSweep, atBuild, atCommit }));
})();

console.log(`\n${pass} passed, ${fail} failed, across ${sections} sections`);
process.exit(fail ? 1 : 0);
