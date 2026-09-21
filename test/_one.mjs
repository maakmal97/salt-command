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
section("v761: a notice reaches every phone that asked, and the banner it draws is the notice's own words");
await (async () => {
  /* HIS INSTRUCTION OF 21 SEP 2026, beside the three wakes on his own phone: the bulletin for the
     customer side as well. It was written to the store and drawn on the door and by an open page's
     poll, so somebody who had shut the page learned of it whenever they next opened one. */
  const stmtW1 = (await import("../stmt/worker.js")).default;
  const { wakeCustomer, wakeEveryone } = await import("../stmt/push.js");
  const { SW_JS } = await import("../stmt/sw.js");
  const kpS = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const skv1 = new KV();
  const senv1 = { STMT: skv1, STMT_DESK_KEY: "desk-key", STMT_VAPID_PUBLIC_KEY: "pub", STMT_VAPID_SUBJECT: "mailto:a@b.test",
    STMT_VAPID_PRIVATE_JWK: JSON.stringify(await crypto.subtle.exportKey("jwk", kpS.privateKey)) };
  await skv1.put("push:abcd-efgh:one", JSON.stringify({ endpoint: "https://push.example/her-phone" }));
  await skv1.put("push:abcd-efgh:two", JSON.stringify({ endpoint: "https://push.example/her-tablet" }));
  await skv1.put("push:wxyz-1234:one", JSON.stringify({ endpoint: "https://push.example/his-friend" }));
  await skv1.put("push:wxyz-1234:gone", JSON.stringify({ endpoint: "https://push.example/a-dead-one" }));

  const fired = async (fn) => {
    const realF = globalThis.fetch, hit = [];
    globalThis.fetch = async (u, init) => { hit.push({ u: String(u), topic: init && init.headers && init.headers.Topic });
      return new Response("", { status: String(u).endsWith("a-dead-one") ? 410 : 201 }); };
    let r; try { r = await fn(); } finally { globalThis.fetch = realF; }
    return { r, hit };
  };
  const one = await fired(() => wakeCustomer(senv1, "abcd-efgh"));
  ok(one.r.sent === 2 && one.hit.every((h) => h.topic === "salt-order")
    && one.hit.map((h) => h.u.split("/").pop()).sort().join() === "her-phone,her-tablet",
    "one customer's own wake still reaches their phones and nobody else's: " + JSON.stringify(one.hit.map((h) => h.u)));

  const all = await fired(() => wakeEveryone(senv1));
  ok(all.r.sent === 3 && all.r.gone === 1,
    "a notice reaches every phone on the site, and one the service has given up on is cleared: " + JSON.stringify(all.r));
  ok(all.hit.every((h) => h.topic === "salt-notice"),
    "under its own collapsing topic, so a notice does not replace an order's banner or the other way about: "
    + JSON.stringify(all.hit.map((h) => h.topic)));
  ok((await skv1.get("push:wxyz-1234:gone")) === null && (await skv1.get("push:wxyz-1234:one")) !== null,
    "and the dead subscription is the only one dropped");

  /* ---- SETTING ONE WAKES THEM; CLEARING ONE DOES NOT ---- */
  const D1 = { "X-Stmt-Desk": "desk-key" };
  const post1 = (body) => stmtW1.fetch(new Request("https://site.test/desk/bulletin", { method: "POST",
    headers: Object.assign({ "content-type": "application/json" }, D1), body: JSON.stringify(body) }), senv1);
  const set1 = await fired(() => post1({ lines: ["Closed Friday", "Back Monday"], mode: "change" }));
  const setJ = await set1.r.json();
  ok(setJ.ok && setJ.push && setJ.push.sent === 3 && set1.hit.length === 3,
    "setting a notice wakes every phone, and says how many it reached: " + JSON.stringify(setJ.push));
  const clear1 = await fired(() => post1({ lines: [] }));
  const clrJ = await clear1.r.json();
  ok(clrJ.cleared && clear1.hit.length === 0,
    "and clearing one wakes nobody, because there is nothing to read: " + JSON.stringify(clear1.hit));

  /* ---- THE BANNER THE CUSTOMER'S SERVICE WORKER DRAWS, from the script as it ships ---- */
  const vm1 = await import("node:vm");
  const runSw1 = (bulletin, status) => {
    const L = {}, shown = [], asked = [];
    const ctx = { URL, Date, console,
      fetch: async (u) => { asked.push(String(u)); return { ok: status !== 404, json: async () => bulletin }; },
      self: { addEventListener: (t, f) => { L[t] = f; }, location: { href: "https://site.test/sw.js?u=abcd-efgh" },
        registration: { scope: "https://site.test/", showNotification: async (t, opt) => { shown.push({ t, opt }); } } },
      clients: { matchAll: async () => [], openWindow: async () => {} } };
    vm1.createContext(ctx); vm1.runInContext(SW_JS, ctx);
    return { L, shown, asked };
  };
  const wake1 = async (bulletin, status) => {
    const sw = runSw1(bulletin, status), waits = [];
    sw.L.push({ waitUntil: (pr) => waits.push(pr) });
    await Promise.all(waits);
    return { shown: sw.shown[0], asked: sw.asked };
  };
  const fresh1 = await wake1({ ok: true, lines: ["Closed Friday", "Back Monday"], mode: "change", at: new Date().toISOString() });
  ok(fresh1.shown && fresh1.shown.t === "Closed Friday" && fresh1.shown.opt.body === "Back Monday"
    && fresh1.shown.opt.data.url === "./?u=abcd-efgh",
    "a notice set a moment ago is what the wake says, in its own words, and a tap still opens their page: " + JSON.stringify(fresh1.shown));
  const oneLine = await wake1({ ok: true, lines: ["Closed Friday"], mode: "run", at: new Date().toISOString() });
  ok(oneLine.shown && oneLine.shown.t === "Closed Friday" && /Open the page/.test(oneLine.shown.opt.body),
    "a notice of one line says so and stops: " + JSON.stringify(oneLine.shown));
  const stale1 = await wake1({ ok: true, lines: ["Closed Friday"], mode: "run", at: "2026-09-01T00:00:00.000Z" });
  const none1 = await wake1({ ok: true, lines: [], mode: "run", at: null });
  const down1 = await wake1(null, 404);
  ok(stale1.shown.t === "Your order" && none1.shown.t === "Your order" && down1.shown.t === "Your order",
    "an old notice, no notice and a site that will not answer all leave the order's own banner as it was: "
    + JSON.stringify([stale1.shown.t, none1.shown.t, down1.shown.t]));
  ok(fresh1.asked.length === 1 && /bulletin/.test(fresh1.asked[0]),
    "and the one thing the service worker reads is the notice, which is public: " + JSON.stringify(fresh1.asked));
  ok(!/\\\\/.test(SW_JS) && SW_JS.indexOf("`") < 0,
    "the script still carries no lone backslash and no backtick, being shipped inside a template literal");
})();

console.log(`\n${pass} passed, ${fail} failed, across ${sections} sections`);
process.exit(fail ? 1 : 0);
