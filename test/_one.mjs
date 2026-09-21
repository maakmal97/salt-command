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
section("v765: Approve keeps itself current while it is on screen, and neither card polls a pocket");
await (async () => {
  /* HIS INSTRUCTION OF 21 SEP 2026. Site orders has followed the site at the phone's own pace since
     v499; Approve never did, so a row that landed while he was looking at it did not appear until he
     left the part and came back. v762 makes that the likeliest minute of all to be sitting here: a
     tap on Site orders now queues and drafts in about a second. */
  const { openMaster: om65 } = await import("../tools/payload.mjs");
  const { w: w65 } = await om65();
  try {
    w65.SALT_CLOUD = true;
    w65.localStorage.setItem("saltWriteKey", "k-fixture");
    const asked = [];
    w65.fetch = async (path) => { asked.push(String(path));
      return { ok: true, status: 200, json: async () => ({ ok: true, drafts: [], refused: [], clock: null }) }; };
    /* the interval is captured rather than waited for: a test that sleeps thirty seconds proves the
       clock, not the code */
    let tick = null, ms = null, cleared = 0;
    w65.setInterval = (fn, every) => { tick = fn; ms = every; return 77; };
    w65.clearInterval = () => { cleared++; tick = null; };
    const box = w65.document.createElement("div"); box.id = "apBox"; w65.document.body.appendChild(box);

    await w65.eval("apLoad(true)");
    ok(asked.length === 1 && ms === 30000,
      "Approve reads the drafts and then follows them, at the same pace as Site orders: " + JSON.stringify({ asked, ms }));
    ok(typeof tick === "function", "there is a timer at all, which is what was missing");

    await tick();
    ok(asked.length === 2, "a tick reads them again, so a row that lands while he is looking appears: " + asked.length);

    /* NOT OVER A DECISION IN FLIGHT: a redraw would put the buttons back under a thumb mid-tap */
    w65.eval("apBusy['x1']=1;");
    await tick();
    ok(asked.length === 2, "a tick while a decision is in flight reads nothing: " + asked.length);
    w65.eval("delete apBusy['x1'];");

    /* NOT INTO A POCKET */
    Object.defineProperty(w65.document, "hidden", { configurable: true, get: () => true });
    await tick();
    ok(asked.length === 2, "and neither does one while the page is hidden: " + asked.length);
    Object.defineProperty(w65.document, "hidden", { configurable: true, get: () => false });
    await tick();
    ok(asked.length === 3, "with the page back in front of him it reads again: " + asked.length);

    /* AND IT STANDS DOWN WHEN THE PART IS GONE */
    box.remove();
    await tick();
    ok(cleared === 1 && asked.length === 3,
      "when the part leaves the screen the timer clears itself rather than reading a keyed endpoint "
      + "for a card nobody is looking at: " + JSON.stringify({ cleared, asked: asked.length }));

    /* THE ORDERS CARD TAKES THE SAME TWO GUARDS */
    const src65 = readFileSync(join(REPO, "master", "salt_command.html"), "utf8");
    const both = src65.match(/if\(document\.hidden\|\|Object\.keys\((ap|ord)Busy\)\.length\)return;/g) || [];
    ok(both.length === 2 && (src65.match(/},CARD_POLL\);/g) || []).length === 2,
      "both cards that follow something outside the phone read one pace and the same two guards: " + JSON.stringify(both));
  } finally {
    await new Promise((r) => setTimeout(r, 200));
    try { w65.close(); } catch (e) { /* best effort */ }
  }
})();

console.log(`\n${pass} passed, ${fail} failed, across ${sections} sections`);
process.exit(fail ? 1 : 0);
