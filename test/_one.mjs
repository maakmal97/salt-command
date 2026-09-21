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
section("v763: a closed order can be opened on the card, read and answered");
await (async () => {
  /* HIS INSTRUCTION OF 21 SEP 2026. The card has shown the OPEN orders since v499 and, since v752,
     any whose last line is the customer's. So a question about an order he finished last week was
     answerable only for as long as they happened to be the last to speak, and an order that went
     through without a word could never be looked at again. The relay has taken ?all=1 since v694
     and nothing on the phone ever asked for it. */
  const { openMaster: om63 } = await import("../tools/payload.mjs");
  const { w: w63 } = await om63();
  try {
    w63.SALT_CLOUD = true;
    const card = String(w63.eval("tabOrders()"));
    ok(card.includes('id="ordAllBtn"') && /Show the closed ones/.test(card) && /Open orders, and any waiting on an answer/.test(card),
      "the card offers the switch, and says what it is showing: " + /(<button[^>]*ordAllBtn[^>]*>[^<]*<\/button>)/.exec(card)[1]);

    const asked = [];
    w63.fetch = async (path) => { asked.push(String(path));
      return { ok: true, status: 200, json: async () => ({ ok: true, orders: [] }) }; };
    w63.document.body.innerHTML = card;
    await w63.eval("ordLoad(true)");
    ok(asked.length === 1 && asked[0] === "orders", "it opens on the open ones, as it always has: " + JSON.stringify(asked));
    const empty1 = w63.document.getElementById("ordBox").textContent;
    ok(/No open orders/.test(empty1), "and with none, it says so: " + empty1);

    const btn = w63.document.getElementById("ordAllBtn");
    btn.click();
    await new Promise((r) => setTimeout(r, 30));
    ok(asked.length === 2 && asked[1] === "orders?all=1",
      "one tap asks the relay for every order it has ever taken: " + JSON.stringify(asked));
    ok(/Hide the closed ones/.test(btn.textContent) && /This site has taken no orders at all yet/.test(w63.document.getElementById("ordBox").textContent),
      "the switch and the empty line both say which list is on screen: " + btn.textContent);
    btn.click();
    await new Promise((r) => setTimeout(r, 30));
    ok(asked.length === 3 && asked[2] === "orders" && /Show the closed ones/.test(btn.textContent),
      "and a second tap puts it back: " + JSON.stringify(asked));

    /* ---- A CLOSED ORDER'S CARD: everything but a move ---- */
    w63.eval("ORD_OPEN=[{id:'zz1',u:'abcd-efgh',code:'CC5-OKR',product:'salt',qty:2,total:200,delivery:0,paid:200,moved:2,"
      + "status:'done',mode:'collect',at:'2026-09-10T02:00:00.000Z',history:[{at:'2026-09-10T02:00:00.000Z',status:'done',by:'desk'}],"
      + "msgs:[{at:'2026-09-12T02:00:00.000Z',by:'customer',text:'was that the same batch as last time'}],queued:{ack:'x',paid:200,moved:2}}];ordDraw();");
    const shut = w63.document.getElementById("ordBox").innerHTML;
    ok(/was that the same batch as last time/.test(shut) && /data-say="zz1"/.test(shut) && /data-ord="say"/.test(shut),
      "a finished order carries its thread and a box to answer in");
    ok(!/data-ord="acknowledged"/.test(shut) && !/data-ord="cancelled"/.test(shut) && !/data-ord="handover"/.test(shut),
      "and offers no move, because there is none left to make");
    ok(/Completed/.test(shut), "the ledger's own word for it is on the card: it reads Completed");
  } finally {
    try { w63.eval("if(typeof ordTimer!=='undefined'&&ordTimer){clearInterval(ordTimer);ordTimer=null;}"); } catch (e) { /* best effort */ }
    await new Promise((r) => setTimeout(r, 200));
    try { w63.close(); } catch (e) { /* best effort */ }
  }
})();

console.log(`\n${pass} passed, ${fail} failed, across ${sections} sections`);
process.exit(fail ? 1 : 0);
