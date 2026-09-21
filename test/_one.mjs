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
section("v766: what is waiting on the site is on Today, ranked against everything else");
await (async () => {
  /* HIS INSTRUCTION OF 21 SEP 2026: site orders reach the desk comprehensively. An order lived on one
     card under Enter, so Today, which exists to rank everything that needs him by the money at stake,
     ranked everything EXCEPT the one item with a customer standing at the other end of it. */
  const { openMaster: om66 } = await import("../tools/payload.mjs");
  const { w: w66 } = await om66();
  try {
    const rd66 = (x) => JSON.parse(String(w66.eval("JSON.stringify(" + x + ")")));
    const quiet = rd66("actions().filter(function(a){return a.kind==='orders';})");
    ok(quiet.length === 0,
      "with nothing read off the site, Today says nothing about it: the laptop desk and a cold boot "
      + "both land here: " + JSON.stringify(quiet));
    const nowWas = rd66("actions().filter(function(a){return a.sev==='now';}).length");

    w66.eval("ORD_OPEN=[{id:'a1',u:'abcd-efgh',code:'CC5-OKR',product:'salt',qty:2,total:200,delivery:15,status:'placed',mode:'deliver',at:'2026-09-21T02:00:00.000Z',history:[],msgs:[]},"
      + "{id:'a2',u:'wxyz-1234',code:'CE4-CHE',product:'salt',qty:1,total:110,delivery:0,status:'placed',mode:'collect',at:'2026-09-21T02:05:00.000Z',history:[],msgs:[]},"
      + "{id:'a3',u:'wxyz-1234',code:'CE4-CHE',product:'salt',qty:1,total:110,delivery:0,status:'acknowledged',mode:'collect',at:'2026-09-20T02:00:00.000Z',history:[],msgs:[{at:'2026-09-21T03:00:00.000Z',by:'customer',text:'when can I collect'}]}];");
    const row = rd66("actions().filter(function(a){return a.kind==='orders';})")[0];
    ok(row && row.sev === "now" && /2 waiting to be acknowledged/.test(row.title) && row.tab === "orders",
      "two placed orders are ONE row, at Now, opening the card that answers it: " + JSON.stringify(row && { t: row.title, sev: row.sev, tab: row.tab }));
    ok(row && Math.abs(row.rm - 325) < 0.005,
      "ranked by what was ordered, goods and carriage together, which is what the pending row will carry: " + JSON.stringify(row && row.rm));
    ok(row && /waiting on an answer/.test(row.why),
      "and the order waiting on an answer is named in the same row rather than ranked twice: " + (row && row.why));
    ok(rd66("actions().filter(function(a){return a.sev==='now';}).length") === nowWas + 1,
      "the rail's Now count, which is this same list, picks it up: nothing counts it twice");

    /* AN ACKNOWLEDGED ORDER IS A ROW, and the book's own readings carry it from there */
    w66.eval("ORD_OPEN=[{id:'b1',u:'abcd-efgh',code:'CC5-OKR',product:'salt',qty:2,total:200,delivery:0,status:'acknowledged',mode:'collect',at:'2026-09-21T02:00:00.000Z',history:[],msgs:[]}];");
    ok(rd66("actions().filter(function(a){return a.kind==='orders';})").length === 0,
      "an order already agreed says nothing here: it is a row, and saying it again would be the same money twice");

    /* ONE READING for the card and for Today */
    w66.eval("ORD_OPEN=[{id:'c1',u:'a',status:'placed',total:100,delivery:0,msgs:[]},{id:'c2',u:'b',status:'done',total:50,delivery:0,msgs:[{at:'x',by:'desk',text:'sent'}]}];");
    const w = rd66("ordWaiting()");
    ok(w.placed.length === 1 && w.asked.length === 0 && w.rm === 100,
      "the one reading counts a placement and not an order he has already answered: " + JSON.stringify({ p: w.placed.length, a: w.asked.length, rm: w.rm }));
  } finally {
    await new Promise((r) => setTimeout(r, 200));
    try { w66.close(); } catch (e) { /* best effort */ }
  }
})();

console.log(`\n${pass} passed, ${fail} failed, across ${sections} sections`);
process.exit(fail ? 1 : 0);
