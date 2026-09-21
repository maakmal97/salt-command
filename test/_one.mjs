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
section("v762: an acknowledgement, a handover or a withdrawal reaches the ledger on the tap");
await (async () => {
  /* v694 made the every-minute reconcile the ONE road that queues a site order's stages, and it ran
     on the cron alone: he acknowledged an order and then waited up to a minute, with nothing under
     Approve, for the row to exist. It is the same call on the same road, run beside the answer. The
     cron stays as the net, and the marks the reconcile writes onto the order are what stop a stage
     being queued twice, so it does not matter which of the two gets there first. */
  const { placeOrder } = await import("../stmt/orders.js");
  const stmtW2 = (await import("../stmt/worker.js")).default;
  const deskW2 = (await import("../src/worker.js")).default;
  const skv2 = new KV(), dkv2 = new KV();
  const senv2 = { STMT: skv2, STMT_DESK_KEY: "desk-key" };
  const kp2 = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const denv2 = { SALT_QUEUE: dkv2, STMT_DESK_KEY: "desk-key", REQUIRE_ACCESS: "0",
    VAPID_PUBLIC_KEY: "pub", VAPID_SUBJECT: "mailto:a@b.test",
    VAPID_PRIVATE_JWK: JSON.stringify(await crypto.subtle.exportKey("jwk", kp2.privateKey)),
    STMT_SITE: { fetch: (url, init) => stmtW2.fetch(new Request(url, init), senv2) } };
  await dkv2.put("stmt-users", JSON.stringify({ "abcd-efgh": "CC5-OKR" }));
  await dkv2.put("push:his", JSON.stringify({ endpoint: "https://push.example/his-phone", topics: ["orders", "approve", "salt"] }));
  const o2 = (await placeOrder(senv2, "abcd-efgh", { product: "salt", qty: 2, mode: "deliver", unit: 100, total: 200, week: "", place: "Bangsar" })).order;

  const tap = async (body) => {
    const realF = globalThis.fetch, realL = console.log, hit = [], logs = [], waits = [];
    globalThis.fetch = async (u) => { hit.push(String(u)); return new Response("", { status: 201 }); };
    console.log = (...a) => logs.push(a.join(" "));
    let r;
    try {
      r = await deskW2.fetch(new Request("https://salt-command.example/orders/abcd-efgh/" + o2.id, { method: "POST",
        headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), denv2, { waitUntil: (p) => waits.push(p) });
      await Promise.all(waits);
    } finally { globalThis.fetch = realF; console.log = realL; }
    const q = await dkv2.get("q:orders", "json");
    return { ok: (await r.json()).ok, hit, logs, queue: (q && q.queue) || [] };
  };

  const ack = await tap({ status: "acknowledged", mode: "deliver", delivery: 15 });
  ok(ack.ok && ack.queue.length === 1,
    "his acknowledgement queues the pending row inside the same request, with no minute to wait: " + JSON.stringify(ack.queue.map((e) => e.at)));
  const ent2 = ack.queue[0];
  ok(ent2 && ent2.payload && ent2.payload.party === "CC5-OKR" && ent2.payload.total === 200 && ent2.payload.delivery === 15,
    "and it is the row the reconcile has always written, goods and carriage apart: " + JSON.stringify(ent2 && ent2.payload));
  ok(ack.logs.some((l) => /^orders reconcile \(on the tap\)/.test(l)),
    "the road it took is named in the log, so a failure on it is not silent: " + JSON.stringify(ack.logs));
  ok(ack.hit.length === 0,
    "and it does not wake him: this is his own tap, and the desk draws the row while he is looking: " + JSON.stringify(ack.hit));

  const before = ((await dkv2.get("q:orders", "json")) || { queue: [] }).queue.length;
  const mark = await tap({ mark: { paid: 0 } });
  ok(mark.ok && mark.queue.length === before && !mark.logs.some((l) => /on the tap/.test(l)),
    "a mark is the reconcile's own bookkeeping written back, and answering it with another reconcile "
    + "would be the desk talking to itself: " + JSON.stringify({ before, after: mark.queue.length }));
  const said = await tap({ message: "on its way" });
  ok(said.ok && said.queue.length === before && !said.logs.some((l) => /on the tap/.test(l)),
    "and a line on the thread moves no goods and no money, so it queues nothing: " + JSON.stringify(said.queue.length));

  const moved = await tap({ handover: { units: 2, mode: "deliver" } });
  ok(moved.ok && moved.logs.some((l) => /on the tap/.test(l) && /waiting/.test(l)),
    "a handover runs it on the tap as well, and its Correction WAITS for the pending row to be folded "
    + "first, which is v694 rule and not something a tap changes: " + JSON.stringify(moved.logs));
})();

console.log(`\n${pass} passed, ${fail} failed, across ${sections} sections`);
process.exit(fail ? 1 : 0);
