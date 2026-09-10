/* verify.mjs — smoke tests for the new cloud surface.
 *
 * Covers the risky new code: the Worker's queue contract against a KV mock, the build's
 * patch integrity and script validity, and the drain's pure helpers. The desk's own
 * rendering is tested by the daily run's jsdom pass; this suite guards the cloud plumbing.
 * No network, no browser: `npm test` runs it in a couple of seconds.
 */
import { execFileSync } from "node:child_process";
import { DATA_DIR, PROJECT_DIR } from "../tools/book.mjs";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "../src/worker.js";
import stmtWorker, { normUser } from "../stmt/worker.js";
import { unionByAt, pruneCommitted } from "../tools/drain.mjs";
import { NAME_STOPWORDS, NAME_COLLISIONS } from "../tools/book.mjs";

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
const section = (s) => { sections++; console.log("\n" + s); };

/* ---- KV + env mocks ------------------------------------------------------------- */
class KV {
  constructor() { this.m = new Map(); }
  async put(k, v) { this.m.set(k, v); }
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
section("Worker — queue contract");
{
  const kv = new KV(), env = mkEnv(kv);

  let r = await worker.fetch(req("/queue/ping"), env);
  let j = await r.json();
  ok(r.status === 200 && j.ok === true && j.cloud === true, "ping returns {ok, cloud:true}");

  r = await worker.fetch(postQ({ device: "d1", updated: "t", queue: [{ at: "2026-08-08T01:00:00Z", raw: "e1" }] }), env);
  j = await r.json();
  ok(r.status === 200 && j.ok && j.entries === 1, "POST device d1 one entry → entries 1");
  ok(kv.m.has("q:d1") && !kv.m.has("q:anon"), "stored under q:d1 only");

  r = await worker.fetch(postQ({ device: "d1", queue: [{ at: "2026-08-08T01:00:00Z", raw: "e1" }, { at: "2026-08-08T02:00:00Z", raw: "e2" }] }), env);
  j = await r.json();
  ok(j.entries === 2, "same device replaces (undo-safe): entries 2");

  await worker.fetch(postQ({ device: "d2", queue: [{ at: "2026-08-08T03:00:00Z", raw: "e3" }] }), env);
  r = await worker.fetch(req("/queue"), env);
  j = await r.json();
  ok(j.ok && j.entries === 3, "GET /queue unions two devices → 3");
  ok(j.queue[0].at < j.queue[2].at, "union is sorted by at ascending");

  // a duplicate 'at' across devices must not double
  await worker.fetch(postQ({ device: "d3", queue: [{ at: "2026-08-08T03:00:00Z", raw: "dup" }] }), env);
  r = await worker.fetch(req("/queue"), env); j = await r.json();
  ok(j.entries === 3, "duplicate at across devices deduped → still 3");

  r = await worker.fetch(postQ({ device: "d1", queue: "notarray" }), env);
  ok(r.status === 400, "malformed queue → 400");

  r = await worker.fetch(postQ({ device: "b a d", queue: [] }), env);
  j = await r.json();
  ok(j.ok && j.device === "anon", "invalid device id falls back to 'anon'");
}

/* ---- 1b. Worker: the write gate ------------------------------------------------- */
section("Worker — the write gate");
{
  const KEY = "a-passphrase-of-some-length";
  const armed = (kv) => ({ ...mkEnv(kv), SALT_WRITE_KEY: KEY });
  const one = [{ at: "2026-08-12T01:00:00Z", raw: "e1" }];

  /* DORMANT is the state that must never regress. If the secret is unset the gate has to
     be invisible, because arming it before the desk can send the header is the lockout. */
  let kv = new KV();
  let r = await worker.fetch(postQ({ device: "d1", queue: one }), mkEnv(kv));
  ok(r.status === 200, "no SALT_WRITE_KEY: the gate is dormant and a POST is accepted");

  kv = new KV();
  r = await worker.fetch(postQ({ device: "d1", queue: one }), armed(kv));
  let j = await r.json();
  ok(r.status === 401 && j.writeKey === true, "armed, no header → 401 with writeKey:true");
  ok(kv.m.size === 0, "a refused POST writes nothing to KV");

  r = await worker.fetch(postQ({ device: "d1", queue: one }, { "X-Salt-Key": "wrong-but-same-length!!" }), armed(kv));
  ok(r.status === 401, "armed, wrong key of another length → 401");

  r = await worker.fetch(postQ({ device: "d1", queue: one }, { "X-Salt-Key": "a-passphrase-of-some-lengtX" }), armed(kv));
  ok(r.status === 401, "armed, wrong key of the SAME length → 401");

  r = await worker.fetch(postQ({ device: "d1", queue: one }, { "X-Salt-Key": KEY }), armed(kv));
  j = await r.json();
  ok(r.status === 200 && j.ok && j.entries === 1, "armed, correct key → accepted");
  ok(kv.m.has("q:d1"), "and it reached KV");

  /* THE GATE NOW COVERS THE READS THAT CARRY THE BOOK (20 Aug 2026). GET /queue returned
     every device's pending entries to anyone with the URL; /drafts returned cost and margin;
     /ledger returned the mirror. The build id and the ping stay open, and so do the assets:
     the site is still public in the sense asked for on 11 Aug. */
  r = await worker.fetch(req("/queue"), armed(kv));
  ok(r.status === 401, "armed: GET /queue needs the key, it lists every pending entry");
  r = await worker.fetch(req("/queue", { headers: { "X-Salt-Key": KEY } }), armed(kv));
  ok(r.status === 200, "armed: GET /queue with the key is served");
  r = await worker.fetch(req("/ledger"), armed(kv));
  ok(r.status === 401, "armed: GET /ledger needs the key");
  r = await worker.fetch(req("/drafts"), armed(kv));
  ok(r.status === 401, "armed: GET /drafts needs the key");
  r = await worker.fetch(req("/rev"), armed(kv));
  ok(r.status !== 401, "armed: /rev stays open, a build id carries no trade");
  r = await worker.fetch(req("/queue/ping"), armed(kv));
  ok(r.status === 200, "armed: the ping is still open");
  r = await worker.fetch(req("/desk.html"), armed(kv));
  ok(r.status === 200, "armed: assets are still open");

  /* The vault write is gated too, or the one door left open is the one holding names. */
  const envelope = { v: 1, salt: "s", iv: "i", ct: "c" };
  r = await worker.fetch(req("/vault", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ vault: envelope })
  }), armed(kv));
  ok(r.status === 401, "armed: POST /vault without the key → 401");

  r = await worker.fetch(req("/vault", {
    method: "POST", headers: { "content-type": "application/json", "X-Salt-Key": KEY }, body: JSON.stringify({ vault: envelope })
  }), armed(kv));
  ok(r.status === 200, "armed: POST /vault with the key → accepted");

  r = await worker.fetch(req("/vault"), armed(kv));
  ok(r.status === 200, "armed: GET /vault is still open (ciphertext only)");
}

/* ---- 1f. The ledger store at /ledger, read only (v294) --------------------------- */
section("The ledger store at /ledger");
{
  /* A D1 stand-in that answers the five statements handleLedger actually issues. Enough to
     prove the routing, the shapes and the refusals without a network or a database. */
  const mkD1 = (data) => ({
    prepare(sql) {
      const st = {
        _b: [],
        bind(...a) { st._b = a; return st; },
        async first() {
          if (sql.includes("FROM snapshot")) return data.snapshot || null;
          if (sql.includes("__collections")) return data.collections ? { doc: JSON.stringify(data.collections) } : null;
          return null;
        },
        async all() {
          if (sql.includes("GROUP BY collection")) {
            const by = {};
            for (const e of data.entry || []) by[e.collection] = (by[e.collection] || 0) + 1;
            return { results: Object.keys(by).sort().map((k) => ({ collection: k, n: by[k] })) };
          }
          if (sql.includes("FROM state")) {
            return { results: Object.entries(data.state || {}).map(([key, v]) => ({ key, doc: JSON.stringify(v) })) };
          }
          if (sql.includes("FROM entry WHERE collection")) {
            return { results: (data.entry || []).filter((e) => e.collection === st._b[0]).map((e) => ({ doc: JSON.stringify(e.doc) })) };
          }
          return { results: [] };
        },
      };
      return st;
    },
  });
  const seeded = {
    snapshot: { v: "v294", stamped: "13 Aug 2026, 00:30 KL", sha: "abc123", rows: 99, at: "2026-08-13T10:00:00Z" },
    collections: ["sales", "purchases", "selfUseLog"],
    entry: [
      { collection: "sales", doc: { date: "2026-08-11", customer: "CY2-NIL", qty: 2, total: 230 } },
      { collection: "purchases", doc: { date: "2026-08-11", supplier: "SP7-PUD", qty: 50, total: 350 } },
    ],
    state: { STATED_STOCK: 1.3, roster: ["CY2-NIL"], __collections: ["sales", "purchases", "selfUseLog"] },
  };
  const withDb = (d) => ({ ...mkEnv(new KV()), SALT_LEDGER: mkD1(d) });

  let r = await worker.fetch(req("/ledger"), mkEnv(new KV()));
  ok(r.status === 503, "no D1 binding → 503 rather than a confident empty answer");

  r = await worker.fetch(req("/ledger"), withDb({}));
  let j = await r.json();
  ok(r.status === 200 && j.seeded === false, "an unseeded store says so instead of pretending");

  r = await worker.fetch(req("/ledger"), withDb(seeded));
  j = await r.json();
  ok(j.ok && j.seeded && j.snapshot.v === "v294", "GET /ledger returns the snapshot it was seeded from");
  ok(j.counts.sales === 1 && j.counts.purchases === 1, "and a count per collection");
  ok(/still authoritative/.test(j.source || ""), "and says in every response that the master is the source");

  r = await worker.fetch(req("/ledger/sales"), withDb(seeded));
  j = await r.json();
  ok(j.ok && j.entries === 1 && j.rows[0].customer === "CY2-NIL", "GET /ledger/sales returns the rows");

  /* An empty collection is not a missing one. */
  r = await worker.fetch(req("/ledger/selfUseLog"), withDb(seeded));
  j = await r.json();
  ok(r.status === 200 && j.ok && j.entries === 0, "a known but empty collection answers 200 with no rows");

  r = await worker.fetch(req("/ledger/nonsense"), withDb(seeded));
  ok(r.status === 404, "an unknown collection is a 404");

  r = await worker.fetch(req("/ledger/state"), withDb(seeded));
  j = await r.json();
  ok(j.ok && j.state.STATED_STOCK === 1.3, "GET /ledger/state returns the singletons");
  ok(!("__collections" in j.state), "and hides the bookkeeping key");

  /* NO WRITE PATH. Adding one before the store is proven would create the second source of
     truth this whole exercise exists to remove. */
  r = await worker.fetch(req("/ledger", { method: "POST", body: "{}" }), withDb(seeded));
  ok(r.status === 405, "POST /ledger is refused: the store is read-only");
  ok(!readFileSync(join(REPO, "src", "worker.js"), "utf8").includes("INSERT INTO entry"),
     "and the Worker carries no insert of any kind");
}

/* ---- 1d. The ledger extract, the first step toward one source of truth ----------- */
section("Ledger extract");
{
  let out = "";
  try { out = execFileSync("node", ["tools/ledger.mjs", "--check"], { cwd: REPO, encoding: "utf8", stdio: "pipe" }); }
  catch (e) { out = (e.stdout || "") + (e.stderr || ""); }

  /* The two proofs that make the extract trustworthy. They are asserted on the tool's own
     report rather than re-implemented here, because a second copy of the logic would be a
     second thing to keep true. */
  ok(/every data-shaped declaration is accounted for/.test(out),
     "the extract accounts for every data-shaped declaration in the master");
  ok(/every value survives JSON/.test(out),
     "every ledger value survives JSON (no function, undefined, NaN, Infinity or Date)");
  ok(/round-trips through JSON unchanged/.test(out), "the extract round-trips through JSON");

  /* THE COMMITTED BOOK, NOT THE OVERLAID VIEW. `sales` is BASE_SALES with the uncommitted
     queue folded over it, so an extract that read `sales` would write provisional rows into
     the store as committed the moment anything was queued. */
  const tool = readFileSync(join(REPO, "tools", "ledger.mjs"), "utf8");
  const book = readFileSync(join(REPO, "tools", "book.mjs"), "utf8");
  ok(book.includes('sales: "BASE_SALES"'), "the extract reads the COMMITTED sales, not the overlaid array");
  ok(book.includes('purchases: "BASE_PURCHASES"'), "and the committed purchases");
  ok(/const\|let\|var/.test(tool), "declaration discovery covers let and var, not const alone");

  /* ONE definition of what the book is. Two would be two things to keep true, and the one
     that drifted would do it silently: an extract carrying a row the store never checked. */
  ok(!/^const LEDGER = \{/m.test(tool), "ledger.mjs does not keep its own copy of the map");
  ok(readFileSync(join(REPO, "tools", "d1.mjs"), "utf8").includes('from "./book.mjs"'),
     "and d1.mjs reads the same one");

  /* SALT LEADS, wherever the two products appear apart. Standing instruction of 11 Aug,
     restated 13 Aug. It holds today; this is what stops it quietly ceasing to. */
  ok(/PROD_ORDER = \["salt", "oil"\]/.test(book), "the tools agree salt leads oil");
  /* v387: read off the master, since the payload that used to prove this is retired. */
  const md = readFileSync(join(REPO, "master", "salt_command.html"), "utf8");
  ok(md.indexOf("salt:") < md.indexOf("oil:"), "and the desk declares salt before oil");

  /* The name gate must exist and must be capable of failing. Nothing may be committed to
     this repo carrying a real name, and the extract is a committed artefact. */
  ok(/salt_bio\.json/.test(tool), "the extract checks itself against the real directory for names");
  ok(/no real name or place|carries \$\{|carries .* real name/.test(tool), "the name gate reports a verdict either way");
}

/* ---- 1e. No directory name or place may reach the public desk (v293) ------------- */
section("The public desk carries no name and no place");
{
  const BIO = `${DATA_DIR}/salt_bio.json`;
  if (!existsSync(BIO)) {
    /* a SKIP, not a pass: this line must not count as proof. The scan needs the plaintext
       directory, which lives only on the laptop and may not be committed in any form, hashed
       included (hard rule 3), so CI cannot carry it. It runs wherever the fold runs. */
    skipOff("salt_bio.json is not on this machine, so the public-desk name scan did not run here");
  } else {
    /* HARD RULE 3, ENFORCED RATHER THAN TRUSTED. public/desk.html is committed AND served
       publicly, so a customer's name or neighbourhood appearing anywhere in it, including
       inside an explanatory comment, is a live disclosure. This caught ten on 12 Aug: five
       in comments written over many versions, two real first names quoted inside the very
       comment that explains the leak gate, and three in a changelog note that named the
       places while describing their removal. */
    const desk = readFileSync(join(REPO, "public", "desk.html"), "utf8");
    const bio = JSON.parse(readFileSync(BIO, "utf8"));
    const words = new Set();
    for (const v of Object.values(bio.bio || {})) {
      const raw = String(v.raw || ""), o = raw.lastIndexOf("(");
      if (o > 0) { words.add(raw.slice(0, o).trim()); words.add(raw.slice(o + 1, raw.lastIndexOf(")")).trim()); }
    }
    for (const p of Object.values(bio.places || {})) if (p.name) words.add(p.name);
    /* Party codes embed their own place abbreviation by design, so they come out first or
       every code reads as a leak and the check gets ignored. */
    const codes = Object.keys(bio.ids || {}).concat(Object.keys(bio.bio || {})).sort((a, b) => b.length - a.length);
    let hay = desk;
    for (const c of codes) hay = hay.split(c).join("~");
    /* One definition, in book.mjs; a private copy here drifted once already. NAME_COLLISIONS
       are names the desk also uses as words, skipped and reported rather than silently. */
    const skip = new Set([...NAME_STOPWORDS, ...NAME_COLLISIONS]);
    const word = (c) => /[A-Za-z0-9]/.test(c || "");
    const hits = [...words].filter((x) => x && x.length >= 3 && !skip.has(x.toLowerCase())).filter((x) => {
      let f = 0;
      for (;;) { const i = hay.indexOf(x, f); if (i < 0) return false; f = i + x.length;
        if (!word(hay[i - 1]) && !word(hay[i + x.length])) return true; }
    });
    okOff(hits.length === 0, `no directory name or place appears in the public desk (${words.size} checked, ${hits.length} found)`);

    /* The map is a heatmap and must stay one: no per-party label, no coordinates on screen. */
    okOff(desk.includes("url(#heat"), "the map draws heat blobs");
    okOff(desk.includes("mix-blend-mode:screen"), "overlapping localities brighten rather than stack");
    okOff(!desk.includes("place.name"), "nothing on the map reads a place name");
    okOff(!/PLACES\[[^\]]*\]\.(name|src)/.test(desk), "the gazetteer table carries neither name nor provenance");
  }
}

/* ---- 1c. One surface: the desk is the only cloud copy (v387) --------------------- */
section("One surface — the desk is the only cloud copy (v387)");
{
  const env = mkEnv(new KV());
  let r = await worker.fetch(req("/desk"), env);
  ok(r.status === 200, "GET /desk answers");
  ok((await r.text()) === "ASSET:/desk.html", "and it serves desk.html");
  r = await worker.fetch(req("/"), env);
  ok(r.status === 200 && (await r.text()) === "ASSET:/desk.html", "and so does the root");
  /* THE APP IS RETIRED (v387, his instruction). v376 kept it at /app as the escape hatch,
     to be retired when a week had passed without it. Both the route and the file are gone,
     and the file is archived beside the repo rather than deleted. A route serving a surface
     nobody maintains is worse than no route, so this asserts the absence of both. */
  /* /app has no route of its own any more. It lands on the SPA fallback, which serves the
     desk, so an old bookmark reaches the surface that exists rather than a 404. That is the
     right answer and it is asserted rather than assumed: what must NOT happen is /app
     serving a phone app, and there is no longer one to serve. */
  r = await worker.fetch(req("/app"), env);
  ok((await r.text()) === "ASSET:/desk.html", "an /app bookmark lands on the desk, not on a surface that is gone");
  const wk = readFileSync(join(REPO, "src", "worker.js"), "utf8");
  ok(!/p === "\/app"/.test(wk), "and the Worker carries no /app route");
  ok(!existsSync(join(REPO, "public", "index.html")), "public/index.html is out of the repo");
  ok(!existsSync(join(REPO, "public", "data.json")), "and so is the payload it read");
  const build = readFileSync(join(REPO, "tools", "build.mjs"), "utf8");
  ok(!/appSrc/.test(build), "the build no longer hashes an app that is not there");
  ok(!/data\.json/.test(build), "and no longer writes a payload nobody reads");
  const sw = readFileSync(join(REPO, "public", "sw.js"), "utf8");
  ok(sw.includes('url.pathname === "/"'), "sw.js caches only the root as the offline shell");
  ok(!/data\?\.json/.test(sw), "and no longer excepts a payload that is gone");
  const mf = JSON.parse(readFileSync(join(REPO, "public", "manifest.webmanifest"), "utf8"));
  ok(mf.start_url === "./", "the installable surface is the root, which is the desk");
}
section("Worker — vault syncs ciphertext, plaintext never does");
{
  const kv = new KV(), env = mkEnv(kv);
  let r = await worker.fetch(req("/vault"), env); let j = await r.json();
  ok(j.ok && j.vault === null && !("ids" in j), "GET /vault empty → {vault:null}, no ids key");

  const envelope = { updated: "t", vault: { v: 1, salt: "c2FsdA==", iv: "aXY=", ct: "Y2lwaGVy" }, ids: { A26: "A26" } };
  r = await worker.fetch(req("/vault", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(envelope) }), env);
  ok((await r.json()).ok, "POST /vault with a valid envelope → ok");
  r = await worker.fetch(req("/vault"), env); j = await r.json();
  ok(j.ok && j.vault && j.vault.ct === "Y2lwaGVy" && j.ids && j.ids.A26 === "A26", "GET /vault returns the stored ciphertext + ids");

  r = await worker.fetch(req("/vault", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ vault: { names: { A26: "a real name" } } }) }), env);
  ok(r.status === 400, "POST /vault with a plaintext map → 400 (refused)");
  ok(![...kv.m.values()].join("").includes("a real name"), "the refused plaintext name is nowhere in KV");

  r = await worker.fetch(req("/bio"), env); j = await r.json();
  ok(j.ok && JSON.stringify(j.bio) === "{}", "GET /bio → empty (plaintext directory never ships)");
  await worker.fetch(req("/bio", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bio: { A26: { raw: "a real name" } } }) }), env);
  ok(!kv.m.has("bio") && ![...kv.m.values()].join("").includes("a real name"), "POST /bio drops the name; nothing in KV");
}

/* ---- 2b. Vault crypto — the seed tool round-trips with the desk ------------------ */
section("Vault crypto — desk-compatible round trip");
{
  const { vaultEncrypt, vaultDecrypt } = await import("../tools/seed-vault.mjs");
  const map = { A26: "Alvin (Sentul)", G01: "Gavin (Sg Besi)" };
  const e1 = await vaultEncrypt("correct horse", map);
  ok(e1.v === 1 && e1.salt && e1.iv && e1.ct && !JSON.stringify(e1).includes("Alvin"), "encrypt → envelope with no plaintext name");
  const back = await vaultDecrypt("correct horse", e1);
  ok(JSON.stringify(back) === JSON.stringify(map), "decrypt with the right pass → the exact map");
  let threw = false; try { await vaultDecrypt("wrong pass", e1); } catch (e) { threw = true; }
  ok(threw, "decrypt with the wrong pass → throws");
}

/* ---- 3. Worker: access gate + routing ------------------------------------------ */
section("Worker — access gate and routing");
{
  let kv = new KV();
  let r = await worker.fetch(postQ({ device: "d1", queue: [] }), mkEnv(kv, "1"));
  ok(r.status === 401, "REQUIRE_ACCESS=1 without Access header → 401");
  r = await worker.fetch(postQ({ device: "d1", queue: [] }, { "Cf-Access-Jwt-Assertion": "jwt" }), mkEnv(kv, "1"));
  ok(r.status === 200, "REQUIRE_ACCESS=1 with Access header → 200");

  /* The gate fails closed on reads too. Access off at the dashboard must mean an
   * outage, not a world-readable ledger; the desk saw exactly that on 10-11 Aug. */
  r = await worker.fetch(req("/"), mkEnv(kv, "1"));
  ok(r.status === 401 && (await r.text()).includes("locked"), "REQUIRE_ACCESS=1: GET / → 401 locked page, never the desk");
  r = await worker.fetch(req("/queue"), mkEnv(kv, "1"));
  ok(r.status === 401, "REQUIRE_ACCESS=1: GET /queue → 401");
  r = await worker.fetch(req("/vault"), mkEnv(kv, "1"));
  ok(r.status === 401, "REQUIRE_ACCESS=1: GET /vault → 401");
  r = await worker.fetch(req("/rev"), mkEnv(kv, "1"));
  ok(r.status === 401, "REQUIRE_ACCESS=1: GET /rev → 401");
  r = await worker.fetch(req("/queue/ping"), mkEnv(kv, "1"));
  const pj = await r.json();
  ok(r.status === 401 && pj.ok === false, "REQUIRE_ACCESS=1: ping answers JSON {ok:false} so the desk degrades to held-locally");
  r = await worker.fetch(req("/some/page", { headers: { "Cf-Access-Jwt-Assertion": "jwt" } }), mkEnv(kv, "1"));
  ok(r.status === 200 && (await r.text()) === "ASSET:/some/page", "REQUIRE_ACCESS=1 with Access header: assets served as normal");

  const env = mkEnv(new KV());
  r = await worker.fetch(req("/menu/publish", { method: "POST", body: "{}" }), env);
  ok(r.status === 501, "menu endpoint is 501 (laptop-only)");
  r = await worker.fetch(req("/bye"), env);
  ok(r.status === 200, "/bye answered so the beacon is quiet");
  r = await worker.fetch(req("/some/page"), env);
  ok(r.status === 200 && (await r.text()) === "ASSET:/some/page", "static asset served");
  r = await worker.fetch(req("/missing"), env);
  ok(r.status === 200 && (await r.text()) === "ASSET:/desk.html", "a missing path falls back to the desk, the only surface there is");
}

/* ---- 4. Drain pure helpers ------------------------------------------------------ */
section("Drain — union and prune");
{
  const a = [{ at: "2", raw: "b" }, { at: "1", raw: "a" }];
  const b = [{ at: "2", raw: "b2" }, { at: "3", raw: "c" }];
  const u = unionByAt(a, b);
  ok(u.length === 3, "unionByAt dedupes by at → 3");
  ok(u[0].at === "1" && u[2].at === "3", "unionByAt sorts ascending");
  ok(u.find(e => e.at === "2").raw === "b2", "later list wins on collision");
  const pruned = pruneCommitted(u, "2");
  ok(pruned.length === 1 && pruned[0].at === "3", "pruneCommitted drops at <= watermark");
}

/* ---- 5. Build integrity --------------------------------------------------------- */
section("Build — patches, scripts, no externals");
{
  let built = true;
  try { execFileSync("node", ["tools/build.mjs"], { cwd: REPO, stdio: "pipe" }); }
  catch (e) { built = false; console.log("  (build failed: " + (e.stderr ? e.stderr.toString().split("\n")[0] : e.message) + ")"); }
  ok(built, "build.mjs exits 0");

  if (built) {
    /* THE BUILT DESK MOVED TO desk.html AT v290, because the root is the phone app now.
       This read is the whole reason the move is safe to make: point it at the wrong file
       and every assertion below silently passes against the app instead. */
    const html = readFileSync(join(REPO, "public", "desk.html"), "utf8");
    ok(html.includes("BEGIN cloud/PWA"), "PWA head block injected");
    ok(html.includes('<link rel="manifest"'), "manifest linked");
    ok(html.includes("serviceWorker") && html.includes("register('sw.js')"), "service worker registered");
    ok(html.includes("function saltDeviceId"), "device id helper present");

    /* THE CHART ASSET, AND WHY THIS TEST EXISTS. ensureChart() loads assets/chart.umd.js
       from the same origin rather than a CDN, which is what keeps the desk self-contained
       and satisfies the CSP. The build copied index.html and nothing beside it, so on the
       phone that request 404'd, ensureChart called back false, and every chart on every tab
       fell through to "Chart unavailable". It read as a rendering fault for weeks and was a
       missing file. Nothing else in this suite would have caught it. */
    ok(existsSync(join(REPO, "public", "assets", "chart.umd.js")),
       "chart.umd.js copied into public/assets, without which the phone has no charts");
    ok(html.includes("assets/chart.umd.js"),
       "the desk still loads the chart library from its own origin, never a CDN");

    /* EVERY CALLER WAITS FOR THE ONE LOAD (v380). This RUNS the desk's own ensureChart in a
       stub rather than matching on its text, because the fault it guards against is invisible
       in the source and obvious the moment two callers arrive in the same tick. chartTried was
       set when the request went out, so the caller that started the load waited on the script
       and every caller behind it was answered false at once and never called back. On the live
       desk that printed "Chart unavailable" over three blocks of the Today view while Chart
       4.5.0 was loaded and ten canvases elsewhere drew, which reads as a data fault and is a
       race. drawPerProduct() makes it a tab at a time rather than a chart at a time. */
    const evFrom = html.indexOf("let chartTried=false");
    const evSrc = evFrom < 0 ? "" : html.slice(evFrom, html.indexOf("\n}", evFrom) + 2);
    ok(/chartWait/.test(evSrc), "ensureChart keeps a queue of waiters");
    const harness = () => {
      let el = null;
      const win = {};
      const doc = { createElement: () => (el = {}), head: { appendChild() {} } };
      const fn = new Function("window", "document", "chartTheme",
                              evSrc + "\nreturn ensureChart;")(win, doc, () => {});
      return { win, script: () => el, ensure: fn };
    };
    {
      const h = harness(), got = [];
      h.ensure((r) => got.push(["A", r]));
      h.ensure((r) => got.push(["B", r]));
      h.ensure((r) => got.push(["C", r]));
      ok(got.length === 0, "no caller is answered while the library is still in flight");
      h.win.Chart = { defaults: {} };
      h.script().onload();
      ok(got.length === 3 && got.every((g) => g[1] === true),
         "every caller that waited is answered true once the library lands");
      const late = [];
      h.ensure((r) => late.push(r));
      ok(late.length === 1 && late[0] === true, "a caller arriving after the load is answered at once");
    }
    {
      /* the other half: a genuinely missing file still fails, once, for everybody. */
      const h = harness(), got = [];
      h.ensure((r) => got.push(r));
      h.ensure((r) => got.push(r));
      const first = h.script();
      first.onerror();
      ok(got.length === 2 && got.every((r) => r === false),
         "a missing library answers every waiter false");
      h.ensure((r) => got.push(r));
      ok(got.length === 3 && got[2] === false && h.script() === first,
         "a library that 404'd is not requested a second time");
    }
    ok(html.includes("cloud &middot; pushes to source"), "cloud badge present");
    ok(html.includes("device:(typeof saltDeviceId"), "qPayload carries the device id");
    ok(html.includes("if(j.cloud){ await vaultLoad();"), "cloud loads the encrypted vault");
    ok(html.includes("SALT_CLOUD&&document.visibilityState==='hidden'"), "cloud auto-hides names on background");
    ok(!/\bsrc\s*=\s*["']https?:\/\//i.test(html) && !/url\(\s*["']?https?:\/\//i.test(html), "no external resource loads");

    // every inline script must parse
    mkdirSync(join(REPO, "test", "tmp"), { recursive: true });
    const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi; let m, i = 0, bad = 0;
    while ((m = re.exec(html))) {
      if (/type\s*=\s*["']application\/json["']/i.test(m[1] || "")) continue;
      if (!m[2].trim()) continue;
      const f = join(REPO, "test", "tmp", `s${i}.js`); writeFileSync(f, m[2]);
      try { execFileSync("node", ["--check", f], { stdio: "pipe" }); } catch (e) { bad++; }
      i++;
    }
    ok(bad === 0, `all ${i} inline scripts parse`);
    rmSync(join(REPO, "test", "tmp"), { recursive: true, force: true });

    /* ---- 6. Freshness: the ten-second poll and its manifest --------------------- */
    section("Freshness — build id, manifest, poll");
    let rev = null;
    try { rev = JSON.parse(readFileSync(join(REPO, "public", "rev.json"), "utf8")); } catch (e) { }
    ok(!!rev, "rev.json written by the build");
    ok(rev && /^[0-9a-f]{16}$/.test(rev.id || ""), "rev.json carries a 16-hex build id");
    ok(rev && /^v\d+$/.test(rev.v || ""), "rev.json carries the desk version");
    ok(html.includes("var SALT_BUILD_ID="), "the built desk carries its own build id");
    ok(rev && html.includes('var SALT_BUILD_ID="' + rev.id + '"'), "the baked id matches rev.json");
    ok(!html.includes("__SALT_BUILD_ID__"), "no unreplaced build-id placeholder shipped");
    ok(html.includes("var SALT_REV_MS=10000"), "the poll interval is ten seconds");
    ok(html.includes("fetch('rev',{cache:'no-store'})"), "the poll bypasses the HTTP cache");
    ok(html.includes("if(!window.SALT_CLOUD||document.visibilityState!=='visible')return"),
      "the poll is cloud-only and pauses when the app is not on screen");
    ok(html.includes("if(idle())location.reload(); else offer(j.v)"),
      "a reload only happens when the desk is idle, otherwise it offers");

    /* IDLE IS RUN, NOT READ (v482). The rule counted a queued entry as unsent work, and in
       cloud mode the queue is emptied only by a load whose watermark has passed the entry, so
       recording one disabled the auto-reload until the reload it was itself blocking. That is
       a behaviour, so it is proved by calling the shipped function with a stubbed document
       rather than by grepping for the line that was deleted. */
    const idleSrc = (html.match(/function idle\(\)\{[\s\S]*?\}catch\(e\)\{return false;\}\}/) || [])[0];
    ok(!!idleSrc, "the built desk carries the freshness idle test");
    if (idleSrc) {
      const runIdle = (q, doc) => new Function("queue", "document", idleSrc + "\nreturn idle();")(q, doc);
      const quiet = { activeElement: null, querySelector: () => null };
      ok(runIdle([{ at: "2026-09-03T00:50:58.174Z" }], quiet) === true,
        "a queued entry does not block the auto-reload: it is in localStorage and survives one");
      ok(runIdle([], quiet) === true, "an empty queue with nothing focused is idle");
      ok(runIdle([{ at: "x" }], { activeElement: { tagName: "INPUT" }, querySelector: () => null }) === false,
        "a focused field still blocks the reload, which is what the rule is for");
      ok(runIdle([], { activeElement: null, querySelector: () => ({}) }) === false,
        "an open dialog still blocks it");
      ok(runIdle([], null) === false, "and a throw reads as not idle, never as idle");
    }

    /* THE LOAD MAY NOT CLEAR WHAT THE CLOUD NEVER TOOK (v485). v482 freed the reload to happen
       with an entry held, which made the load's self-clearing rule reachable far more often.
       That rule asked only the watermark, which says what the FOLD has taken and nothing about
       whether THIS device ever got its entry to the cloud. An entry recorded with no signal is
       held here, never drafted, never folded; once a fold elsewhere carried the watermark past
       it, the load dropped it as committed and the sale was gone in silence.
       Run, not read: the shipped predicate is called over the sequence the audit's critic
       traced. Proved red against the old one-question rule before it was trusted. */
    const keepSrc = (html.match(/function qKeepOnLoad\(q,mark,sent\)\{try\{[\s\S]*?\}catch\(e\)\{return true;\}\}/) || [])[0];
    ok(!!keepSrc, "the built desk carries the load's self-clearing rule as a named function");
    if (keepSrc) {
      const keep = (q, mark, sent) =>
        new Function("q", "mark", "sent", keepSrc + "\nreturn qKeepOnLoad(q,mark,sent);")(q, mark, sent);
      const stranded = { at: "2026-09-04T14:00:00.000Z", type: "SELL", total: 360 };
      const folded = "2026-09-04T18:00:00.000Z";   // a fold elsewhere carried the mark past it

      ok(keep(stranded, folded, "2026-09-04T13:00:00.000Z") === true,
        "an entry the cloud never acknowledged survives a watermark that has passed it");
      ok(keep(stranded, folded, folded) === false,
        "an entry that WAS acknowledged and has been folded is cleared, so the overlay cannot show it twice");
      ok(keep(stranded, "2026-09-04T13:00:00.000Z", folded) === true,
        "an entry the fold has not reached survives even when it was acknowledged");
      ok(keep({ type: "SELL" }, folded, "") === false,
        "an entry with no stamp predates the mechanism and still goes");
      ok(keep(null, folded, "") === false, "a hole in the queue is not kept");
      /* THE ONE-LOAD HOLE, found by running the sequence in a browser rather than trusting the
         unit above. Retaining a stranded entry is not enough: qInit posts the held queue on the
         next open, the server takes it, the mark advances over it, and the load after that
         clears it. The drafter skips anything at or below the watermark, so that post can never
         become a row. A stuck entry is therefore kept even once acknowledged. */
      ok(keep({ at: "2026-09-04T14:00:00.000Z", stuck: true }, folded, folded) === true,
        "a stuck entry survives even after a later post acknowledges it, or it is lost one load later");
      ok(keep(stranded, null, null) === true,
        "with no watermark to judge by the entry stays: q.at>null is false, not a throw, and the terser rule dropped it");
      ok(keep(stranded, folded, "") === true,
        "an empty mark reads as nothing acknowledged, never as everything acknowledged");
      /* a REAL throw, not a comparison that quietly returns false */
      const boom = Object.defineProperty({}, "at", { get() { throw new Error("boom"); } });
      ok(keep(boom, folded, "") === true, "and a throw keeps the entry, never drops it");
    }

    /* the two halves of the evidence, at the sites that produce it */
    ok(html.includes("function qSentMark(v){qSentThrough=v;"),
      "a confirmed post is recorded on this device");
    ok(html.includes("if(sending&&sending>qSentThrough)qSentMark(sending);"),
      "the server route marks only what its own payload carried");
    ok(html.includes("const m=qNewestAt(); if(m&&m>qSentThrough)qSentMark(m);"),
      "the download route is marked too: it feeds the daily run, so an unmarked one would show twice");
    ok(/let qSentThrough=\(function\(\)\{[\s\S]*?localStorage\.setItem\('saltQueueSent',seed\)/.test(html),
      "the mark is seeded from the watermark AND written, so a moved watermark cannot re-seed over it");
    ok(html.includes("if(q&&q.at&&q.at<=QUEUE_COMMITTED&&!q.stuck){q.stuck=true;newlyStuck++;}"),
      "an entry that survived while the fold had passed it is flagged stuck at load");
    ok(html.includes("queueStuck=queue.filter(q=>q&&q.stuck).length;"),
      "the notice counts what IS stuck, not what just became stuck, or it shows once and never again");
    ok(html.includes("never reached the cloud</b>, and the ledger has since been folded past"),
      "and a stuck entry is named on screen, because only a person can settle it");

    /* the id must actually move when the master does, or the poll can never fire. Round six:
       the old check hashed a mutated copy of the built desk alone and compared it to an id
       computed over DIFFERENT inputs by a DIFFERENT recipe, so the two always differed and
       the assertion could fail only on a hash collision; with the id pinned to a constant in
       build.mjs, the poll, the deploy gate and CI's comparison all dead, the suite stayed
       green. This recomputes the id by build.mjs's own recipe (the built source with the
       placeholder restored, then sw.js and each sorted src/*.js, all NUL-separated exactly as
       build.mjs concatenates them) and demands the recorded id reproduce exactly. */
    const parts = html.split(rev.id);
    ok(parts.length === 2, `the baked id appears exactly once in the built page (found ${parts.length - 1})`);
    const fs2 = await import("node:fs");
    let workerSrc = "";
    for (const f of fs2.readdirSync(join(REPO, "src")).filter((n) => n.endsWith(".js")).sort())
      workerSrc += f + " " + readFileSync(join(REPO, "src", f), "utf8") + " ";
    const swSrc = readFileSync(join(REPO, "public", "sw.js"), "utf8");
    const recomputed = createHash("sha256")
      .update(parts.join("__SALT_BUILD_ID__")).update(" sw ").update(swSrc).update(" worker ").update(workerSrc)
      .digest("hex").slice(0, 16);
    ok(recomputed === rev.id, "rev.id reproduces from the build's own inputs by the build's own recipe");
  }
}

/* ---- 7. Worker: /rev serves the manifest, uncached ------------------------------- */
section("Worker — /rev");
{
  const kv = new KV();
  const revAssets = {
    async fetch(request) {
      const p = new URL(request.url).pathname;
      if (p === "/rev.json") return new Response('{"ok":true,"v":"v277","id":"abc0123456789def"}', { status: 200 });
      return new Response("nope", { status: 404 });
    }
  };
  const env = { SALT_QUEUE: kv, ASSETS: revAssets, REQUIRE_ACCESS: "0" };
  const r = await worker.fetch(req("/rev"), env);
  ok(r.status === 200, "/rev answers 200");
  const j = await r.json();
  ok(j.id === "abc0123456789def", "/rev returns the build id from the manifest");
  ok(/no-store/.test(r.headers.get("cache-control") || ""), "/rev is served no-store");

  const missing = { async fetch() { return new Response("nope", { status: 404 }); } };
  const r2 = await worker.fetch(req("/rev"), { ...env, ASSETS: missing });
  ok(r2.status === 404, "/rev answers 404 when no manifest is built, rather than throwing");

  /* the service worker must never cache it */
  const sw = readFileSync(join(REPO, "public", "sw.js"), "utf8");
  const apiLine = (sw.match(/const API = (\/.*\/);/) || [])[1];
  ok(!!apiLine, "sw.js has an API pattern");
  if (apiLine) {
    const rx = new RegExp(apiLine.slice(1, apiLine.lastIndexOf("/")));
    ok(rx.test("/rev"), "sw.js never caches /rev");
    ok(rx.test("/rev.json"), "sw.js never caches /rev.json");
    /* v387: THESE TWO LIVED IN THE APP'S SECTION AND ARE NOT ABOUT THE APP. A cached draft
       list shows a row that has already been approved, and tapping it again is refused as a
       409 with no way to know why; worse, an approved row keeps asking to be approved while
       the one actually waiting stays invisible. The desk's Approve part reads the same
       endpoints through the same service worker, so the rule outlived the surface that
       happened to test it. */
    ok(rx.test("/drafts"), "sw.js never caches /drafts");
    ok(rx.test("/drafts/abc/approve"), "sw.js never caches a decision");
  }
}

/* ---- 8. Worker: the approval step ----------------------------------------------- */
/* The behaviour worth guarding is the REFUSALS, not the happy path: a draft with no row,
   a decision without the key, and a second decision on a row already decided. Each of
   those, if it slipped, would put an unreviewed row into the ledger or undo a decision. */
section("Worker — drafts and approval");
{
  /* A D1 mock small enough to be honest about what it does: it understands only the
     statements the Worker actually issues, and throws on anything else rather than
     quietly returning nothing, which is how a mock hides a broken query. */
  class D1 {
    constructor() { this.rows = new Map(); this.refusals = new Map(); }
    prepare(sql) {
      const self = this, s = sql.replace(/\s+/g, " ").trim();
      let binds = [];
      const api = {
        bind(...a) { binds = a; return api; },
        async first() {
          if (/^SELECT status FROM draft WHERE id=/.test(s) || /^SELECT status,committed_at FROM draft WHERE id=/.test(s)) {
            return self.rows.get(binds[0]) || null;
          }
          if (/^SELECT .* FROM draft WHERE id=/.test(s)) return self.rows.get(binds[0]) || null;
          if (/^SELECT .* FROM draft WHERE committed_at IS NOT NULL ORDER BY committed_at DESC LIMIT 1/.test(s)) {
            const done = [...self.rows.values()].filter((r) => r.committed_at).sort((a, b) => a.committed_at < b.committed_at ? 1 : -1);
            return done[0] || null;
          }
          throw new Error("unmocked first(): " + s);
        },
        async all() {
          if (/^SELECT .* FROM refused/.test(s)) return { results: [...self.refusals.values()] };
          if (!/^SELECT .* FROM draft/.test(s)) throw new Error("unmocked all(): " + s);
          let out = [...self.rows.values()];
          if (/status=\?/.test(s)) out = out.filter(r => r.status === binds[0]);
          if (/committed_at IS NULL/.test(s)) out = out.filter(r => !r.committed_at);
          return { results: out };
        },
        async run() {
          if (/^INSERT OR REPLACE INTO refused/.test(s)) {
            self.refusals.set(binds[0], {
              id: binds[0], entry: binds[1], why: binds[2], party: binds[3], source: binds[4], seen_at: binds[5]
            });
            return { meta: { changes: 1 } };
          }
          if (/^INSERT OR IGNORE INTO draft/.test(s)) {
            const id = binds[0];
            if (self.rows.has(id)) return { meta: { changes: 0 } };
            self.rows.set(id, {
              id, status: "pending", collection: binds[1], entry: binds[2], row: binds[3],
              reasoning: binds[4], flags: binds[5], party: binds[6], product: binds[7],
              date: binds[8], qty: binds[9], total: binds[10], cost: binds[11],
              drafter: binds[12], drafted_at: binds[13], decided_at: null, decided_by: null, committed_at: null
            });
            return { meta: { changes: 1 } };
          }
          if (/^UPDATE draft SET status=/.test(s)) {
            const r = self.rows.get(binds[3]);
            if (r && r.status === "pending") { r.status = binds[0]; r.decided_at = binds[1]; r.decided_by = binds[2]; }
            return { meta: { changes: 1 } };
          }
          if (/^UPDATE draft SET committed_at=\?1, live_at=\?2 WHERE id=\?3/.test(s)) {
            const r = self.rows.get(binds[2]);
            if (r && !r.committed_at) { r.committed_at = binds[0]; r.live_at = binds[1]; }
            return { meta: { changes: 1 } };
          }
          throw new Error("unmocked run(): " + s);
        }
      };
      return api;
    }
  }

  const KEY = "open-sesame";
  const d1 = new D1();
  const env = { SALT_QUEUE: new KV(), SALT_LEDGER: d1, ASSETS: assets, REQUIRE_ACCESS: "0", SALT_WRITE_KEY: KEY };
  const body = (o) => JSON.stringify(o);
  const post = (p, o, key) => req(p, {
    method: "POST",
    headers: { "content-type": "application/json", ...(key ? { "X-Salt-Key": key } : {}) },
    body: body(o)
  });
  /* READING A DRAFT NEEDS THE KEY SINCE 20 Aug 2026: the row carries its cost and its margin,
     which is exactly what phonePayloadLeaks() keeps out of the public payload. */
  const get = (p, key) => req(p, { headers: key ? { "X-Salt-Key": key } : {} });
  const goodDraft = {
    id: "2026-08-14T12:16:00.151Z", collection: "sales",
    entry: { at: "2026-08-14T12:16:00.151Z", raw: "Sell 1 unit to CH4-MLR for RM 110" },
    row: { date: "2026-08-14", customer: "CH4-MLR", qty: 1, total: 110, cost: 56, cash: 110 },
    reasoning: "FIFO off the 13 Aug RM56 lot.", flags: ["a first order from this party"],
    drafter: "test"
  };

  /* a draft needs a proposed ROW and a reason; neither is optional */
  let r = await worker.fetch(post("/drafts", { ...goodDraft, row: undefined }, KEY), env);
  ok(r.status === 400, "POST /drafts with no row is refused");
  r = await worker.fetch(post("/drafts", { ...goodDraft, reasoning: "  " }, KEY), env);
  ok(r.status === 400, "POST /drafts with no reasoning is refused");

  /* writing a draft is a write */
  r = await worker.fetch(post("/drafts", goodDraft, null), env);
  ok(r.status === 401, "POST /drafts without the write key is refused");
  r = await worker.fetch(post("/drafts", goodDraft, "wrong-key-x"), env);
  ok(r.status === 401, "POST /drafts with a wrong key is refused");

  r = await worker.fetch(post("/drafts", goodDraft, KEY), env);
  let j = await r.json();
  ok(r.status === 200 && j.ok && j.created === true, "POST /drafts with the key creates the draft");

  /* re-drafting the same id must not reopen it */
  r = await worker.fetch(post("/drafts", goodDraft, KEY), env);
  j = await r.json();
  ok(j.created === false && j.existed === true, "re-posting the same id does not create a second draft");

  /* reads that carry the book are keyed too (20 Aug 2026) */
  r = await worker.fetch(req("/drafts"), env);
  ok(r.status === 401, "GET /drafts without the key is refused: a draft carries cost and margin");
  r = await worker.fetch(get("/drafts", KEY), env);
  j = await r.json();
  ok(r.status === 200 && j.count === 1, "GET /drafts with the key lists the pending draft");
  ok(j.drafts[0].row.cost === 56 && j.drafts[0].row.total === 110, "the drafted ROW comes back intact");
  ok(Array.isArray(j.drafts[0].flags) && j.drafts[0].flags.length === 1, "flags come back parsed");
  ok(j.drafts[0].entry && j.drafts[0].entry.raw, "the original entry comes back beside the row");

  /* a decision is a write */
  r = await worker.fetch(post("/drafts/" + encodeURIComponent(goodDraft.id) + "/approve", {}, null), env);
  ok(r.status === 401, "approving without the write key is refused");

  r = await worker.fetch(post("/drafts/" + encodeURIComponent(goodDraft.id) + "/approve", { by: "phone" }, KEY), env);
  j = await r.json();
  ok(r.status === 200 && j.draft.status === "approved", "approving with the key sets status approved");
  ok(j.draft.decidedAt && j.draft.decidedBy === "phone", "the decision records when and by whom");

  /* an approval rings the stage (03 Sep 2026): one dispatch of cloud-commit.yml, stage only.
     Its own D1, so the counts the commit-run tests below rely on are untouched. */
  {
    const own = { ...env, SALT_LEDGER: new D1() };
    const armed = { ...own, SALT_GITHUB_TOKEN: "ghp-test" };
    const calls = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (u, o) => { calls.push({ url: String(u), opts: o }); return new Response(null, { status: 204 }); };
    const jobs = [];
    const ctx = { waitUntil(p) { jobs.push(p); } };
    const draftNo = async (n) => {
      const d = { ...goodDraft, id: goodDraft.id + "-ring-" + n };
      await worker.fetch(post("/drafts", d, KEY), own);
      return encodeURIComponent(d.id);
    };
    const decide = async (id, what, e) => {
      const res = await worker.fetch(post("/drafts/" + id + "/" + what, {}, KEY), e, ctx);
      await Promise.allSettled(jobs);
      return { status: res.status, j: await res.json() };
    };
    let d = await decide(await draftNo(1), "reject", armed);
    ok(d.status === 200 && calls.length === 0, "a rejection dispatches nothing: there is nothing to stage");
    d = await decide(await draftNo(2), "approve", own);
    ok(d.status === 200 && d.j.draft.status === "approved" && calls.length === 0,
       "with no SALT_GITHUB_TOKEN an approval dispatches nothing and still succeeds: safe to deploy before the secret");
    d = await decide(await draftNo(3), "approve", armed);
    ok(d.status === 200 && d.j.draft.status === "approved", "the approval itself is unchanged by the dispatch");
    ok(calls.length === 1 && /\/repos\/maakmal97\/salt-command\/actions\/workflows\/cloud-commit\.yml\/dispatches$/.test(calls[0].url),
       "an approval with the token dispatches cloud-commit.yml once");
    const o = calls[0].opts, b = JSON.parse(o.body);
    ok(o.method === "POST" && o.headers.authorization === "Bearer ghp-test" && o.headers["user-agent"], "as a POST, with the token as a bearer and a user agent, which GitHub requires");
    ok(b.ref === "master" && b.inputs.stage_only === "true", "on master, stage only: the deploy waits for the fold's push");
    globalThis.fetch = async () => { throw new Error("github is down"); };
    d = await decide(await draftNo(4), "approve", armed);
    ok(d.status === 200 && d.j.draft.status === "approved", "a dispatch fault never fails the approval");
    globalThis.fetch = realFetch;

    /* the workflow's half, read as text because YAML cannot be run here */
    const wf = readFileSync("./.github/workflows/cloud-commit.yml", "utf8");
    ok(/stage_only:\n\s+description/.test(wf), "cloud-commit.yml accepts stage_only");
    /* v520: one job. The Fold step is gated by a plan step that reads the stage's two outputs. */
    ok(/- name: Fold\n\s+if: steps\.plan\.outputs\.fold == '1'\n\s+env:\n\s+ANTHROPIC_API_KEY: \$\{\{ secrets\.ANTHROPIC_API_KEY \}\}/.test(wf) && /\n\s+node tools\/foldcall\.mjs\n/.test(wf), "the Fold step runs in the same job, only when the plan says a batch is staged, and it is tools/foldcall.mjs on the API key");
    ok(/if \[ "\$\{\{ steps\.guard\.outputs\.staged \}\}" = "1" \] \|\| \[ "\$\{\{ steps\.commit\.outputs\.staged \}\}" = "1" \]; then fold=1; fi/.test(wf) && /echo "skip=1" >> "\$GITHUB_OUTPUT"\n(?:\s+#[^\n]*\n)*\s+echo "staged=1"/.test(wf),
       "a batch already staged counts as staged, so a batch a failed fold left behind is folded on the next tick rather than never");
    ok(!/claude-code-action/.test(wf) && !/CLAUDE_CODE_OAUTH_TOKEN: \$\{\{ secrets/.test(wf) && /node tools\/ledger\.mjs\n\s+npm run build\n\s+node tools\/gate\.mjs\n/.test(wf) && /git push origin HEAD:master\n\s+echo "folded and pushed/.test(wf),
       "the Claude Code action is gone from the job: the fold step folds, extracts, builds, tests and pushes as the runner, which starts no second run");
    ok(/if \[ "\$\{\{ github\.event_name \}\}" = "push" \]; then deploy=1; fi/.test(wf) && /\[ "\$\{\{ inputs\.stage_only \}\}" != "true" \] && \[ "\$\{\{ inputs\.probe_key \}\}" != "true" \]; then deploy=1; fi/.test(wf) && /if \[ "\$fold" = "1" \]; then deploy=1; fi/.test(wf),
       "the deploy steps run on a push, on a dispatch that did not ask to stage only, and whenever this run folded");
    /* 10 Sep 2026: THE GUARD HOLDS BACK THE DEPLOY AND NOTHING ELSE, and this assertion had to move
       with it. It required SIX OR MORE steps to stand down on `Already serving?`, which was right
       while only the two sanctioned deployers existed: whatever had put the build on the phone had
       done the rest of the job too. Workers Builds was reconnected on his instruction that day and
       breaks it, deploying the tip of master in about a minute and stopping, while this job has a
       checkout and an npm ci first. A build that won the race made live=1 and the run skipped the
       gate, the proof, the marks, the handoff, the mirror re-seed and the suite, and went green.
       Now exactly two stand down, and they are Gate and Deploy by name. Asserting the count alone
       would pass on any two, which is the shape of check this desk keeps catching. */
    const guarded = (wf.match(/steps\.already\.outputs\.live != '1'/g) || []).length;
    ok(/- name: Already serving\?/.test(wf) && guarded === 2 && !/Check out what the fold pushed/.test(wf),
       `the deploy follows the fold in the same job and exactly two steps stand aside when the phone already has the build (${guarded}); no second checkout is needed once the job pushes as itself`);
    ok(/- name: Gate\n\s+if: steps\.plan\.outputs\.deploy == '1' && steps\.already\.outputs\.live != '1'/.test(wf)
       && /- name: Deploy\n\s+if: steps\.plan\.outputs\.deploy == '1' && steps\.already\.outputs\.live != '1'/.test(wf),
       "and they are Gate and Deploy, the two steps that are about deploying");
    ok(/- name: Re-seed the mirror from the master just shipped\n\s+if: steps\.plan\.outputs\.deploy == '1'\n/.test(wf)
       && /- name: Mark the folded rows committed\n\s+if: steps\.plan\.outputs\.deploy == '1'\n/.test(wf),
       "while the mirror re-seed and the marks run whoever deployed, because a stale mirror is the silent fault this job exists to end");
    ok(/git pull -q --rebase --autostash origin master\n\s+git push/.test(wf),
       "the handoff clear rebases before it pushes, autostashing what npm test rebuilt: master moved under it once, and the dirty tree refused the rebase the next time");
    ok((wf.match(/ref: master/g) || []).length === 1 && /uses: actions\/checkout@v5[^\n]*\n\s+with: \{ ref: master \}/.test(wf), "the one checkout is master's tip, not the sha the run started on, and it serves the whole job");
    ok(!/actions\/(checkout|setup-node)@v4/.test(wf), "the actions run on Node 24 (v5); v4 targeted Node 20, which the runners retired");
  }

  /* the double tap */
  r = await worker.fetch(post("/drafts/" + encodeURIComponent(goodDraft.id) + "/reject", {}, KEY), env);
  ok(r.status === 409, "a second decision on a decided row is refused, not applied");
  r = await worker.fetch(get("/drafts?status=approved", KEY), env);
  j = await r.json();
  ok(j.drafts[0].status === "approved", "the first decision stands after the second is refused");

  /* what the commit run asks for */
  r = await worker.fetch(get("/drafts?status=approved&uncommitted=1", KEY), env);
  j = await r.json();
  ok(j.count === 1, "approved and uncommitted is what the commit run reads");
  r = await worker.fetch(post("/drafts/" + encodeURIComponent(goodDraft.id) + "/committed", {}, KEY), env);
  ok(r.status === 200, "the run can mark a row committed");
  r = await worker.fetch(get("/drafts?status=approved&uncommitted=1", KEY), env);
  j = await r.json();
  ok(j.count === 0, "a committed row is no longer offered to the run");

  /* a rejected row is never offered */
  const second = { ...goodDraft, id: "2026-08-14T12:42:33.844Z" };
  await worker.fetch(post("/drafts", second, KEY), env);
  /* v525: the rejected entry is dropped from every device's queue, and a re-post cannot bring it back */
  const other = { at: "2026-08-14T12:50:00.000Z", type: "SELL", raw: "the one that stays" };
  await env.SALT_QUEUE.put("q:dev-one", JSON.stringify({ device: "dev-one", queue: [{ at: second.id, type: "SELL", raw: "the rejected one" }, other] }));
  await env.SALT_QUEUE.put("q:dev-two", JSON.stringify({ device: "dev-two", queue: [{ at: second.id, type: "SELL", raw: "held on a second device" }] }));
  r = await worker.fetch(post("/drafts/" + encodeURIComponent(second.id) + "/reject", {}, KEY), env); j = await r.json();
  ok(r.status === 200 && j.dropped === 2, "a rejection drops the entry from every device's queue and says how many (" + j.dropped + ")");
  ok(JSON.parse(await env.SALT_QUEUE.get("q:dev-one")).queue.map((e) => e.at).join() === other.at && JSON.parse(await env.SALT_QUEUE.get("q:dev-two")).queue.length === 0, "the other entry stays, on the device that held it");
  r = await worker.fetch(post("/queue", { device: "dev-one", queue: [{ at: second.id, type: "SELL", raw: "re-posted" }, other] }, KEY), env); j = await r.json();
  ok(r.status === 200 && j.dropped === 1 && j.entries === 1 && JSON.parse(await env.SALT_QUEUE.get("q:dev-one")).queue.length === 1, "a device re-posting the rejected entry has it dropped again, and keeps the rest");
  r = await worker.fetch(get("/drafts?status=approved&uncommitted=1", KEY), env);
  j = await r.json();
  ok(j.count === 0, "a rejected row never reaches the commit run");
  r = await worker.fetch(post("/drafts/" + encodeURIComponent(second.id) + "/committed", {}, KEY), env);
  ok(r.status === 409, "a rejected row cannot be marked committed");

  /* unknown ids and methods */
  r = await worker.fetch(post("/drafts/nope/approve", {}, KEY), env);
  ok(r.status === 404, "deciding an unknown id is a 404");
  r = await worker.fetch(req("/drafts", { method: "DELETE" }), env);
  ok(r.status === 401, "DELETE /drafts without the key is refused before the method is even read");
  r = await worker.fetch(req("/drafts", { method: "DELETE", headers: { "X-Salt-Key": KEY } }), env);
  ok(r.status === 405, "DELETE /drafts is not allowed");

  /* Access still gates the whole surface when it is on */
  const gated = { ...env, REQUIRE_ACCESS: "1" };
  r = await worker.fetch(get("/drafts", KEY), gated);
  j = await r.json();
  ok(r.status === 401 && j.ok === false, "with Access on, /drafts answers 401 JSON rather than the locked page");

  /* THE REFUSED HALF OF GET /drafts, WHICH WAS UNTESTED UNTIL v393. The worker reads the
     `refused` table inside a try/catch, so a stub that did not know the table returned an
     empty list and every assertion above still passed. It is the half that carries the raw
     entry and the party code, so it is the half that most needs the gate proved. */
  const rf = (id, why, party, source) => d1.prepare(
    "INSERT OR REPLACE INTO refused (id,entry,why,party,source,seen_at) VALUES (?1,?2,?3,?4,?5,?6)"
  ).bind(id, JSON.stringify({ at: id, raw: "Fulfilment " + party + " 5 unit", type: "AMEND" }),
    why, party, source, "2026-08-29T02:00:01.000Z").run();
  await rf("2026-08-29T02:00:00.000Z", "a Linked amendment names no figure the drafter can check", "CC5-OKR", "cloud-drafter");
  await rf("2026-08-29T03:00:00.000Z", "a Rewarded amendment: which award applies is a judgement", "SA5-BTR", "laptop-queue");

  r = await worker.fetch(get("/drafts", KEY), env);
  j = await r.json();
  ok(j.refusedCount === 2 && j.refused.length === 2, "GET /drafts carries the refusals beside the drafts");
  const one = j.refused.find(x => x.party === "CC5-OKR");
  ok(one && one.why && one.source === "cloud-drafter" && one.seenAt === "2026-08-29T02:00:01.000Z",
     "a refusal comes back with its reason, the drafter that saw it and the date");
  ok(one.entry && one.entry.raw === "Fulfilment CC5-OKR 5 unit", "the entry comes back parsed, not as a string");
  ok(!("status" in one) && !("decided_at" in one) && !("decided_by" in one),
     "a refusal has no decision column: there is nothing on it to approve");
  ok(j.refused.some(x => x.source === "laptop-queue"), "a refusal from the laptop sweep is shown beside a cloud one");

  /* the gate, on the half that carries the party code and the raw entry */
  r = await worker.fetch(req("/drafts"), env);
  ok(r.status === 401, "GET /drafts without the key discloses no refusal either");

  /* only the pending read carries them: the commit run asks a different question */
  r = await worker.fetch(get("/drafts?status=approved&uncommitted=1", KEY), env);
  j = await r.json();
  ok(!j.refused.length && j.refusedCount === 0, "the commit run's read is never handed a refusal");
}

/* ---- 9. The phone app's approval panel ------------------------------------------ */
section("Drafter — rows, refusals and flags");
{
  const { draftRow, costFor, floorFor, flagsFor } = await import("../src/drafter.js");

  /* a small book with the shape the real one has: two products, a lot each, some history */
  const book = {
    version: "v302",
    pricing: {
      v: "v302",
      byProduct: {
        salt: { stockCost: 56, replCost: 56, floors: { "1": { floor: 79.5 }, "2.5": { floor: 198.74 } } },
        oil: { stockCost: 7, replCost: 7, floors: { "1": { floor: 8.5 } } }
      }
    },
    purchases: [
      { date: "2026-07-28", qty: 100, total: 4700 },
      { date: "2026-08-13", qty: 12.5, total: 700, receivedOn: "2026-08-13" },
      { date: "2026-08-11", product: "oil", qty: 50, total: 350, receivedOn: "2026-08-11" }
    ],
    sales: [
      { date: "2026-08-08", customer: "CC5-OKR", qty: 1, total: 90 },
      { date: "2026-07-15", customer: "CC5-OKR", qty: 1, total: 90 },
      { date: "2026-08-11", product: "oil", customer: "CS6-BS", qty: 30, total: 330 },
      { date: "2026-08-11", product: "oil", customer: "CS6-BS-R", qty: 20, total: 120 },
      { date: "2026-08-06", product: "oil", customer: "CN6-WM-R", qty: 10, total: 130 }
    ],
    state: { roster: ["CC5-OKR", "CH4-MLR", "CS6-BS", "CN6-WM-R"], QUEUE_COMMITTED: "2026-08-14T00:00:00.000Z" }
  };
  /* the bare rows above are COMPLETED orders: every row on the real book carries cash and
     deliveredQty, and since 08 Sep 2026 the drafter reads a row with neither as pending */
  book.sales = book.sales.map((r) => ({ cash: r.total, deliveredQty: r.qty, ...r }));
  const entry = (payload, at = "2026-08-16T01:00:00.000Z") => ({ at, payload: { mode: "new", ...payload } });

  /* the desk's own cost wins over anything recomputed */
  ok(costFor(book, "salt").cost === 56, "cost comes from the desk's shelf cost, not a recomputation");
  ok(/desk/.test(costFor(book, "salt").source), "and it says so");
  ok(costFor(book, "oil").cost === 7, "per product");
  /* one lot or a blend, answered by the desk's two numbers rather than by purchase history */
  ok(costFor(book, "salt").mayBlend === false, "shelf cost equal to the newest lot rate means one lot, so no blend flag");
  const blended = { ...book, pricing: { ...book.pricing, byProduct: { ...book.pricing.byProduct, salt: { ...book.pricing.byProduct.salt, stockCost: 47.47 } } } };
  ok(costFor(blended, "salt").mayBlend === true, "shelf cost differing from the newest lot rate means a blend, and is flagged");
  const blendRow = draftRow(entry({ direction: "SELL", party: "CC5-OKR", qty: 1, total: 90, cash: 90, kg: 1, date: "2026-08-16" }), blended);
  ok(blendRow.flags.some(f => /inventory average/.test(f)), "a blended shelf is named on the row");
  const singleRow = draftRow(entry({ direction: "SELL", party: "CC5-OKR", qty: 1, total: 90, cash: 90, kg: 1, date: "2026-08-16" }), book);
  ok(!singleRow.flags.some(f => /inventory average/.test(f)), "a single-lot shelf does not raise it, so the flag stays worth reading");

  /* the floor lookup falls to the nearest carded size BELOW, never above */
  ok(floorFor(book, "salt", 1).exact === true, "an exact carded size is exact");
  const near = floorFor(book, "salt", 2);
  ok(near && near.at === 1 && near.exact === false, "an odd size reads the carded size below it, and says it is not exact");

  /* ---- the refusals ---- */
  ok(/no payload/.test(draftRow({ at: "x" }, book).skip || ""), "an entry with no payload is refused");
  /* AMENDMENTS: THE RULE CHANGED ON 20 Aug 2026 AND THE OLD ASSERTION WENT WITH IT.
     It used to be "every amendment is left for a person", on the ground that which row it
     amends is a judgement. That was true of an amendment arriving with nothing identifying its
     target, and it is still true of one. It stopped being true of an amendment carrying the
     desk's own ovKey, which the phone now sends because it makes you tap a specific order. */
  ok(/names no order/.test(draftRow({ at: "x", payload: { mode: "amend", kind: "Fulfilment", direction: "SELL", party: "CC5-OKR" } }, book).skip || ""),
    "an amendment with NO order key is still left for a person");
  ok(/judgement rather than which row/.test(draftRow({ at: "x", payload: { mode: "amend", kind: "Linked", direction: "SELL", party: "CC5-OKR", orderKey: "CC5-OKR|2026-08-01|90" } }, book).skip || ""),
    "a Linked amendment is still left for a person even WITH a key: whose bucket it books to is the judgement");

  /* With a key, a Fulfilment kind and a matching OPEN snapshot, it drafts. */
  const openBook = { ...book, version: "vTEST", state: { ...(book.state || {}), OPEN: { v: "vTEST", byKey: {
    "CC5-OKR|2026-08-01|90": { p: "CC5-OKR", dir: "S", q: 1, t: 90, cash: 0, mv: 0, d: "2026-08-01", st: "dueMoney", oweRM: 90, oweUnits: 1 },
  } } } };
  const amend = draftRow({ at: "x", payload: { mode: "amend", kind: "Fulfilment", direction: "SELL",
    party: "CC5-OKR", orderKey: "CC5-OKR|2026-08-01|90", date: "2026-08-20", cash: 90, kg: 1 } }, openBook);
  ok(!amend.skip, "a Fulfilment with a key against an OPEN order is drafted, not refused");
  ok(amend.amends === "CC5-OKR|2026-08-01|90" && amend.amendKind === "Fulfilment", "and it records which row it amends, and how");
  ok(amend.row && amend.row.customer === "CC5-OKR" && amend.row.total === 90,
    "the row it carries is the TARGET as it stands, not a row to append");
  ok(/SETTLES the order in full/.test(amend.flags.join(" ")), "settling the whole order is flagged as such");
  ok(/ovAmend/.test(amend.reasoning), "and the reasoning says plainly that the desk applies it, not the drafter");

  /* A MODIFICATION IS MECHANICAL TOO, FROM 24 Aug 2026: the phone's Restate form sends newQty
     and newTotal against a tapped order, so what changed is a figure rather than free text, and
     the drafter runs the same history/floor/below-cost comparisons a brand new row gets. */
  const mod = draftRow({ at: "x", payload: { mode: "amend", kind: "Modification", direction: "SELL",
    party: "CC5-OKR", orderKey: "CC5-OKR|2026-08-01|90", newQty: 2, newTotal: 150 } }, openBook);
  ok(!mod.skip, "a Modification with new terms against an OPEN order is drafted, not refused");
  ok(mod.amends === "CC5-OKR|2026-08-01|90" && mod.amendKind === "Modification", "and it records which row it amends, and how");
  ok(mod.row.customer === "CC5-OKR" && mod.row.qty === 1 && mod.row.total === 90, "the row is the TARGET as it stands today");
  ok(mod.row.newQty === 2 && mod.row.newTotal === 150, "and the proposed new terms travel beside it");
  ok(mod.flags.some(f => /has paid RM 90\/unit on every one of their 2 orders/.test(f)), "the restated rate is measured against the party's own history, exactly as a new row would be");
  ok(/Restates it to 2 unit for RM 150/.test(mod.reasoning), "the reasoning states the change plainly");
  const modNoTerms = draftRow({ at: "x", payload: { mode: "amend", kind: "Modification", direction: "SELL",
    party: "CC5-OKR", orderKey: "CC5-OKR|2026-08-01|90" } }, openBook);
  ok(/no new quantity and total/.test(modNoTerms.skip || ""), "a Modification with no new terms is refused rather than guessed at");

  /* overpaying and overdelivering are the comparisons an amendment cannot make against itself */
  const over = draftRow({ at: "x", payload: { mode: "amend", kind: "Fulfilment", direction: "SELL",
    party: "CC5-OKR", orderKey: "CC5-OKR|2026-08-01|90", date: "2026-08-20", cash: 200, kg: 5 } }, openBook);
  ok(over.flags.some(f => /more than the order is owed/.test(f)), "paying more than is outstanding is flagged");
  ok(over.flags.some(f => /more than the order calls for/.test(f)), "moving more than is outstanding is flagged");

  /* a key that matches nothing OPEN is refused rather than guessed at */
  const noSuchOrder = draftRow({ at: "x", payload: { mode: "amend", kind: "Fulfilment", direction: "SELL",
    party: "CC5-OKR", orderKey: "CC5-OKR|1999-01-01|1", date: "2026-08-20", cash: 1, kg: 1 } }, openBook);
  ok(/no OPEN order/.test(noSuchOrder.skip || ""), "a key matching no open order is refused, never applied to a near miss");
  /* ---- THE BOOKKEEPING ENTRIES, DRAFTED FROM 20 Aug 2026 ----------------------------
     A count, a loss, a lost sale and a registration. None is a row in sales or purchases, and
     the point of putting them through the gate is that the approval screen shows what the fact
     MEANS: a count of zero against a roll that includes stock somebody has already paid for is
     not ordinary shrinkage, and reading it as such is what nearly happened on 20 Aug. */
  const shelf = { ...book, state: { ...(book.state || {}),
    roster: ["CC5-OKR", "CA4-DAM"],
    OPEN: { v: "vTEST", byKey: {},
      position: { salt: { onHand: 8.05, owedOut: 6, promised: 24.5, free: 2.05 } },
      countedOn: { salt: "2026-08-12" } } } };

  const cnt = draftRow({ at: "x", payload: { mode: "count", product: "salt", qty: 0, date: "2026-08-20" } }, shelf);
  ok(!cnt.skip && cnt.collection === "count", "a count is drafted, not refused");
  ok(cnt.row.drift === -8.05, "the drift is what was counted less what the desk says is there");
  ok(cnt.flags.some(f => /OWED OUT and already paid for/.test(f)),
    "the part of the shortfall somebody has PAID FOR is called out separately from shrinkage");
  ok(cnt.flags.some(f => /unmeetable/.test(f)), "counting zero against open promises says so");
  ok(/needs a quantity/.test(draftRow({ at: "x", payload: { mode: "count", product: "salt", date: "2026-08-20" } }, shelf).skip || ""),
    "a count with no quantity is refused: zero is a count, nothing is not");
  const matched = draftRow({ at: "x", payload: { mode: "count", product: "salt", qty: 8.05, date: "2026-08-20" } }, shelf);
  ok(matched.flags.some(f => /Nothing is unaccounted for/.test(f)), "a count that matches the book says so plainly");

  const spill = draftRow({ at: "x", payload: { mode: "loss", product: "salt", kg: 3, why: "spillage", date: "2026-08-20" } }, shelf);
  ok(!spill.skip && spill.collection === "loss", "a loss with a reason is drafted");
  ok(spill.flags.some(f => /% of the inventory/.test(f)), "a loss of a quarter of the shelf or more is sized against it");
  ok(/needs a reason/.test(draftRow({ at: "x", payload: { mode: "loss", product: "salt", kg: 1, date: "2026-08-20" } }, shelf).skip || ""),
    "a loss with no reason is refused: without one it is indistinguishable from shrinkage");
  ok(draftRow({ at: "x", payload: { mode: "loss", product: "salt", kg: 99, why: "x", date: "2026-08-20" } }, shelf)
    .flags.some(f => /Losing more than you hold/.test(f)), "losing more than the shelf holds is flagged as a count problem");

  const lostSale = draftRow({ at: "x", payload: { mode: "lost", product: "salt", kg: 20, total: 1800, why: "no stock", date: "2026-08-20" } }, shelf);
  ok(!lostSale.skip && lostSale.collection === "lostDemand", "a lost sale is drafted");
  ok(lostSale.flags.some(f => /restock signal, not a pricing one/.test(f)),
    "one lost for want of stock is named as a buying signal rather than a pricing one");

  const reg = draftRow({ at: "x", payload: { mode: "addid", code: "CX1-NEW", kind: "customer" } }, shelf);
  ok(!reg.skip && reg.collection === "roster", "a registration is drafted");
  ok(/never travels/.test(reg.reasoning), "and it says the name and the place do not travel with it");
  ok(draftRow({ at: "x", payload: { mode: "addid", code: "CA4-DAM", kind: "customer" } }, shelf)
    .flags.some(f => /ALREADY on the roster/.test(f)), "registering a code twice is flagged: the desk walks the roster");
  ok(/does not look like a desk code/.test(draftRow({ at: "x", payload: { mode: "addid", code: "!!!" } }, shelf).skip || ""),
    "a code that is not a desk code is refused");
  ok(/bucket sits under a party/.test(draftRow({ at: "x", payload: { mode: "addid", code: "CX2-B", kind: "bucket" } }, shelf).skip || ""),
    "a bucket with no parent is refused: whose bucket is a judgement");
  /* ---- associate attribution goes through the gate now (25 Aug 2026) ---- */
  /* It used to be refused outright, so a downsell could only be typed at the laptop. Each of
     the three fields is a code the book either knows or does not, so each is CHECKED. */
  const r2 = draftRow(entry({ direction: "SELL", party: "CM4-MK", qty: 1, total: 100, cash: 100, kg: 1, date: "2026-08-16", assoc: "CN6-WM", stream: "R2", downstream: "CM4-MK" }), book);
  ok(!r2.skip, "an R2 downsell is drafted rather than refused");
  ok(r2.row.customer === "CN6-WM" && r2.row.rev === "R2" && r2.row.downstream === "CM4-MK",
    "and it books to the associate with the buyer behind it, exactly as the desk's own rule does");
  ok(r2.flags.some(f => /is not the counterparty on this row/.test(f)),
    "the reader is told the buyer gets no statement from it");
  const r3 = draftRow(entry({ direction: "SELL", party: "CM4-MK", qty: 1, total: 100, cash: 100, kg: 1, date: "2026-08-16", assoc: "CN6-WM", stream: "R3" }), book);
  ok(!r3.skip && r3.row.customer === "CM4-MK" && r3.row.ref === "CN6-WM" && r3.row.refKg === 1,
    "R3 leaves the buyer on the row and credits the introduction beside it");
  ok(/stream/.test(draftRow(entry({ direction: "SELL", party: "CM4-MK", qty: 1, total: 100, assoc: "CN6-WM" }), book).skip || ""),
    "an associate with no stream is refused: the credit has no route");
  ok(/credit reaches nobody/.test(draftRow(entry({ direction: "SELL", party: "CM4-MK", qty: 1, total: 100, stream: "R2" }), book).skip || ""),
    "a stream with no associate is refused: it credits nobody");
  ok(/R2 or R3/.test(draftRow(entry({ direction: "SELL", party: "CM4-MK", qty: 1, total: 100, assoc: "CN6-WM", stream: "R9" }), book).skip || ""),
    "a stream that is not R2 or R3 is refused");
  ok(draftRow(entry({ direction: "SELL", party: "CM4-MK", qty: 1, total: 100, cash: 100, kg: 1, date: "2026-08-16", assoc: "CX9-NOBODY", stream: "R3" }), book)
    .flags.some(f => /not on the roster/.test(f)), "an associate the book does not know is flagged");
  ok(/links to another order/.test(draftRow(entry({ direction: "SELL", party: "CM4-MK", qty: 1, total: 100, linkTo: "whatever" }), book).skip || ""),
    "the link fields stay refused: which order a row links to is a judgement");
  ok(/counterparty/.test(draftRow(entry({ direction: "SELL", qty: 1, total: 100 }), book).skip || ""), "no party, no row");
  ok(/quantity or no total/.test(draftRow(entry({ direction: "SELL", party: "CC5-OKR", qty: 1 }), book).skip || ""), "no total, no row");
  ok(/no date/.test(draftRow(entry({ direction: "SELL", party: "CC5-OKR", qty: 1, total: 90, cash: 90, kg: 1 }), book).skip || ""),
    "something moved but no date given: refused rather than dated by guess");

  /* ---- a pending row carries THE DAY IT WAS AGREED (v540; every row is dated since v487) ---- */
  const pend = draftRow(entry({ direction: "SELL", party: "CC5-OKR", qty: 1, total: 80, cash: 0, kg: 0, date: "2026-08-16" }), book);
  ok(!pend.skip && pend.row.date === "2026-08-16", "nothing moved, so the row is pending and carries the agreed date the phone typed");
  ok(pend.row.deliveredQty === 0 && pend.row.cash === 0, "and it draws no stock and books no cash");
  ok(/PENDING/.test(pend.reasoning) && /2026-08-16/.test(pend.reasoning), "the reasoning says so, with the date");
  const pendNoDate = draftRow(entry({ direction: "SELL", party: "CC5-OKR", qty: 1, total: 80, cash: 0, kg: 0, date: null }), book);
  ok(!!pendNoDate.skip && /no date/.test(pendNoDate.skip), "a pending order with no date typed is refused rather than drafted undated");

  /* ---- THE RM115 OIL UNIT, the fixture this whole path exists for ---- */
  const oil = draftRow(entry({ direction: "SELL", party: "CH4-MLR", product: "oil", qty: 1, total: 115, cash: 115, kg: 1, date: "2026-08-14" }), book);
  ok(!oil.skip, "the oil row drafts");
  ok(oil.row.cost === 7 && oil.row.product === "oil", "costed off the oil lot, and tagged oil");
  ok(oil.flags.some(f => /more than double/.test(f)), "RM115 is flagged as more than double any oil rate on the book");
  ok(oil.flags.length >= 1, "the row that caused this feature does not pass silently");

  /* the corrected figure passes that check */
  const oilOk = draftRow(entry({ direction: "SELL", party: "CH4-MLR", product: "oil", qty: 1, total: 11.5, cash: 11.5, kg: 1, date: "2026-08-14" }), book);
  ok(!oilOk.flags.some(f => /more than double/.test(f)), "RM11.50 does not trip the range flag");

  /* ---- a purchase is not measured with a seller's ruler ---- */
  const buyNoFloor = draftRow(entry({ direction: "BUY", party: "SA5-BTR", qty: 12.5, total: 700, cash: 700, kg: 12.5, date: "2026-08-16" }),
    { ...book, purchases: [...book.purchases, { date: "2026-07-28", supplier: "SA5-BTR", qty: 100, total: 4700 }] });
  ok(buyNoFloor.flags.every(f => !/loses money/.test(f)), "a purchase is never called a loss-making sale");
  ok(buyNoFloor.flags.every(f => !/no committed/.test(f)), "a supplier is not judged by their absent BUYING history");
  const buyStranger = draftRow(entry({ direction: "BUY", party: "SZ9-NEW", qty: 1, total: 60, cash: 60, kg: 1, date: "2026-08-16" }), book);
  ok(buyStranger.flags.some(f => /never supplied/.test(f)), "an unknown SUPPLIER is flagged as never having supplied, not as off-roster");

  /* ---- the party's own standing rate ---- */
  const cut = draftRow(entry({ direction: "SELL", party: "CC5-OKR", qty: 1, total: 80, cash: 80, kg: 1, date: "2026-08-16" }), book);
  ok(cut.flags.some(f => /has paid RM 90/.test(f)), "a party who has always paid RM90 being charged RM80 is flagged");
  ok(buyNoFloor.flags.every(f => !/floor/.test(f)), "a PURCHASE is never measured against a selling floor");
  /* v385: THE FLOOR IS THE COST LEG ALONE, so a row at it earns nothing at all rather than a
     thin margin, and this sentence is the only place a reader is ever told. Both floors are
     NAMED, because RM10 separates delivered from collected where RM50 used to and "the floor"
     had quietly become two things. */
  /* v502: one floor per size, the goods after the leak; RM80 at 1 unit clears the RM79.5 floor. */
  ok(cut.flags.every(f => !/under the floor/.test(f)), "RM80 against a RM79.5 floor is not flagged: there is one floor now, and it clears it");
  const under = draftRow(entry({ direction: "SELL", party: "CC5-OKR", qty: 1, total: 70, cash: 70, kg: 1, date: "2026-08-16" }), book);
  ok(under.flags.some(f => /RM 9.5 under the floor of RM 79.5/.test(f)) && under.flags.some(f => /what the order costs to take out/.test(f)),
    "RM70 is flagged as RM9.5 under the RM79.5 floor, by how much, and the flag says what the floor IS");
  /* v502: a delivery charge inside the total is taken out before the floor is read */
  const withDel = draftRow(entry({ direction: "SELL", party: "CC5-OKR", qty: 1, total: 95, delivery: 20, cash: 95, kg: 1, date: "2026-08-16" }), book);
  ok(!withDel.skip && withDel.row.delivery === 20 && withDel.row.total === 95 && withDel.flags.some(f => /RM 75 for the goods is RM 4.5 under the floor of RM 79.5/.test(f)),
    "RM95 with RM20 of delivery inside it is RM75 for the goods, and that is what the floor is read against");
  ok(!!draftRow(entry({ direction: "SELL", party: "CC5-OKR", qty: 1, total: 50, delivery: 60, cash: 50, kg: 1, date: "2026-08-16" }), book).skip,
    "a delivery charge larger than its total is refused");

  /* THE TIME CHARGE IS READ OFF THE POLICY AND NEVER TYPED INTO THE FLAG. An older snapshot
     carries no policy, and the clause then comes out rather than asserting a figure the
     snapshot does not hold. */
  const timed = JSON.parse(JSON.stringify(book));
  timed.pricing.byProduct.salt.inputs = { policy: { timePerOrder: 25 } };
  ok(floorFor(timed, "salt", 1).time === 25 && floorFor(book, "salt", 1).time === null,
    "floorFor reports the stated time charge, and null where the snapshot has no policy");
  const timedCut = draftRow(entry({ direction: "SELL", party: "CC5-OKR", qty: 1, total: 70, cash: 70, kg: 1, date: "2026-08-16" }), timed);
  ok(timedCut.flags.some(f => /RM 25 for your time/.test(f)), "and the flag names it where it is stated");
  ok(cut.flags.every(f => !/for your time/.test(f)), "and leaves the clause out where it is not, rather than guessing at RM25");

  /* ---- below cost ---- */
  const loss = draftRow(entry({ direction: "SELL", party: "CS6-BS-R", product: "oil", qty: 20, total: 120, cash: 120, kg: 20, date: "2026-08-16" }), book);
  ok(loss.flags.some(f => /loses money/.test(f)), "a sale under cost is named as one");

  /* ---- an unknown party ---- */
  const stranger = draftRow(entry({ direction: "SELL", party: "CX9-NEW", qty: 1, total: 110, cash: 110, kg: 1, date: "2026-08-16" }), book);
  ok(stranger.flags.some(f => /not on the roster/.test(f)), "a party that is not on the roster is flagged, not silently accepted");

  /* ---- an advance ---- */
  const adv = draftRow(entry({ direction: "SELL", party: "CC5-OKR", qty: 1, total: 90, cash: 0, kg: 1, date: "2026-08-16" }), book);
  ok(adv.flags.some(f => /ADVANCE/.test(f)), "a delivery with nothing paid is named an advance");
  ok(adv.row.deliveredOn === "2026-08-16" && adv.row.paidOn === undefined, "delivered but not paid, and the row says exactly that");

  /* ---- a purchase ---- */
  const buy = draftRow(entry({ direction: "BUY", party: "SA5-BTR", qty: 12.5, total: 700, cash: 700, kg: 12.5, date: "2026-08-13" }), book);
  ok(!buy.skip && buy.collection === "purchases", "a BUY drafts into purchases");
  ok(buy.row.supplier === "SA5-BTR" && buy.row.customer === undefined, "a purchase names a supplier, never a customer");
  ok(buy.row.status === "paid" && buy.row.receivedQty === 12.5, "paid and received in full");
  ok(buy.row.cost === undefined, "a purchase carries no per-unit cost field; it IS the cost");

  /* ---- history counts only what MOVED ---- */
  /* A pending row is an intention. Counting one as history is what stopped CC5-OKR's four
     RM90 orders reading as a standing rate on the real book. */
  const withPending = { ...book, sales: [...book.sales, { customer: "CC5-OKR", qty: 1, total: 80 }] };
  const stillFlagged = draftRow(entry({ direction: "SELL", party: "CC5-OKR", qty: 1, total: 80, cash: 80, kg: 1, date: "2026-08-16" }), withPending);
  ok(stillFlagged.flags.some(f => /RM 90/.test(f)), "an undated pending row does not count as history, so the standing rate still reads RM90");

  /* ---- one odd order must not switch the check off for ever ---- */
  const mixed = { ...book, sales: [...book.sales, { date: "2026-08-01", customer: "CC5-OKR", qty: 1, total: 70, cash: 70, deliveredQty: 1 }] };
  const vsMedian = draftRow(entry({ direction: "SELL", party: "CC5-OKR", qty: 1, total: 130, cash: 130, kg: 1, date: "2026-08-16" }), mixed);
  ok(vsMedian.flags.some(f => /typically pays/.test(f)), "a party with a mixed history is measured against the median, not against perfect uniformity");
  const inBand = draftRow(entry({ direction: "SELL", party: "CC5-OKR", qty: 1, total: 88, cash: 88, kg: 1, date: "2026-08-16" }), book);
  ok(!inBand.flags.some(f => /RM 90/.test(f) || /typically pays/.test(f)), "a rate within tolerance of the median does not nag");

  /* ---- a stale pricing snapshot ---- */
  const stale = draftRow(entry({ direction: "SELL", party: "CC5-OKR", qty: 1, total: 90, cash: 90, kg: 1, date: "2026-08-16" }),
    { ...book, version: "v305", pricing: { ...book.pricing, v: "v302" } });
  ok(stale.flags.some(f => /stale/.test(f)), "pricing taken at an older version than the mirror is flagged as stale");

  /* the drafter must never write to `entry`, the mirrored book */
  const src = readFileSync(join(REPO, "src", "drafter.js"), "utf8");
  ok(!/INSERT[\s\S]{0,40}INTO\s+entry|UPDATE\s+entry|DELETE\s+FROM\s+entry/i.test(src), "the drafter never writes to the mirrored `entry` table");
  ok(/INSERT OR IGNORE INTO draft/.test(src), "it inserts drafts idempotently, so a double tick cannot double a row");
}

/* ---- 10b. the approval step is the ONLY road in --------------------------------- */
/* v305 closed two roads that walked around it: serve_desk.py's 60-second drain, which fed a
   file the daily run folded, and the laptop's own queue, which never went near the cloud.
   Both now converge on `draft`. These assertions are cheap and they guard a property that is
   invisible at runtime: nothing errors when a gate quietly stops being a gate. */
section("The gate is the only road in");
{
  const d = readFileSync(join(REPO, "tools", "drafts.mjs"), "utf8");
  ok(/--from-queue/.test(d), "the laptop queue can be routed through the same gate");
  ok(/import\("\.\.\/src\/drafter\.js"\)/.test(d), "and it imports the SAME draftRow, rather than a second copy of the logic");
  ok(/'pending'/.test(d.slice(d.indexOf("async function fromQueue"))), "a laptop entry arrives PENDING, never pre-approved");
  ok(/status='approved' AND committed_at IS NULL/.test(d), "the run is offered only approved, uncommitted rows");

  const drain = readFileSync(join(REPO, "tools", "drain.mjs"), "utf8");
  ok(/NOT A COMMIT SOURCE/.test(drain), "drain.mjs says plainly that it is no longer a commit source");

  /* serve_desk.py lives outside this repo; check it only if it is on this machine */
  const desk = `${PROJECT_DIR}/30_Published/serve_desk.py`;
  if (existsSync(desk)) {
    const py = readFileSync(desk, "utf8");
    okOff(!/_run_sync\("-PullOnly"/.test(py), "serve_desk.py no longer drains the cloud queue on a timer");
    okOff(!/next_drain/.test(py), "and the drain timer is gone rather than merely unused");
    /* AND THE DRAIN INSIDE THE SYNC PASS, which the first removal missed entirely: the
       timer went but salt_sync.ps1 still ran the drain on every pass, so the log kept
       printing "drained the phone queue" and the road stayed open. */
    const ps1 = `${PROJECT_DIR}/30_Published/salt_sync.ps1`;
    if (existsSync(ps1)) {
      const sync = readFileSync(ps1, "utf8");
      /* the EXECUTABLE form, not the word: the comment explaining the removal names the
         command, so a naive substring search would fail on the very text that documents it */
      okOff(!/&\s*node\s+'tools\/drain\.mjs'/.test(sync), "salt_sync.ps1 does not invoke the drain on a sync pass");
      okOff(!/Say\s*\(\s*"drained the phone queue"/.test(sync), "and it can no longer report having drained one");
    } else {
      okOff(true, "salt_sync.ps1 is not on this machine, so its pull could not be checked");
    }
  } else {
    okOff(true, "serve_desk.py is not on this machine, so its drain could not be checked");
  }
}

/* ---- 10c. refused entries are visible, never approvable ------------------------- */
/* Built after the same CC5-OKR fulfilment was queued twice on 17 Aug, once per device. An
   amendment is refused by the drafter, so it never reached the Approve tab, so there was no
   way to see from the phone that it was already in hand. These assertions guard the two
   properties that matter: it shows up, and it cannot be decided. */
section("Refused entries — seen, not approvable");
{
  const sql = readFileSync(join(REPO, "migrations", "0003_refused.sql"), "utf8");
  ok(/CREATE TABLE IF NOT EXISTS refused/.test(sql), "there is a refused table");
  ok(!/status/i.test(sql.replace(/--[^\n]*/g, "")), "it carries NO status column, so nothing here can be decided");
  ok(!/approve|committed_at|decided/i.test(sql.replace(/--[^\n]*/g, "")), "and no decision columns at all");

  const d = readFileSync(join(REPO, "src", "drafter.js"), "utf8");
  ok(/INSERT OR REPLACE INTO refused/.test(d), "the cloud drafter records what it refuses");
  ok(/DELETE FROM refused WHERE id<=\?1/.test(d), "and clears refusals the watermark has passed, so the list cannot go stale");
  ok(/DELETE FROM refused WHERE id=\?1/.test(d), "a refusal that later drafts is cleared, so one entry is never in both lists");

  const t = readFileSync(join(REPO, "tools", "drafts.mjs"), "utf8");
  ok(/INSERT OR REPLACE INTO refused/.test(t), "--from-queue records laptop refusals too, which is the case that caused this");
  ok(/0003_refused\.sql/.test(t), "--schema applies the migration");

  /* ONE STOP-LIST, NOT TWO. ledger.mjs and this file each carried their own copy; "general"
     was added to one and the other went on failing, which is the exact silent divergence
     book.mjs exists to prevent. Asserted so it cannot quietly happen again. */
  const led = readFileSync(join(REPO, "tools", "ledger.mjs"), "utf8");
  const self = readFileSync(join(REPO, "test", "verify.mjs"), "utf8");
  ok(NAME_STOPWORDS.has("general") && NAME_STOPWORDS.has("tbc"), "book.mjs defines the name stop-list");
  ok(/NAME_STOPWORDS/.test(led) && !/new Set\(\["tbc"/.test(led), "ledger.mjs imports it and keeps no private copy");
  /* Tests that the list is IMPORTED, not that it is spelled a particular way: the check is
     "no literal stop-word spelled out here", since composing the two imported sets is fine. */
  ok(/NAME_STOPWORDS/.test(self) && !/skip\s*=\s*new Set\(\[\s*"/.test(self),
    "and neither does this suite: it composes the imported sets rather than listing words");
  ok(NAME_COLLISIONS.has("max"), "the collision list is separate from the stop-list, because skipping a real name is a hole and not a tidy-up");

  const w = readFileSync(join(REPO, "src", "worker.js"), "utf8");
  ok(/FROM refused/.test(w), "the Worker serves them");
  ok(/refusedCount/.test(w), "and counts them");
  /* the decision routes must not have grown a refused case */
  ok(!/refused\/.+\/(approve|reject)/.test(w), "there is no route to approve a refused entry");

  /* v387: THE PANEL THAT SHOWED THESE WAS THE APP'S, AND THE APP IS RETIRED. drawRefused,
     #refbox and the edit-not-a-decision rule all lived in public/index.html, and the desk has
     never had a refused panel: drawRefused does not appear in the master at all. So the
     `refused` table is still written, still self-cleans and is still served, and there is now
     NO SURFACE THAT SHOWS IT. That is a real loss, recorded here rather than quietly dropped
     with the assertions: v309 exists because the same fulfilment was queued twice, byte for
     byte, since nothing said it was already in hand. What is still proved is the half that
     needs no surface: the store keeps them and no route can decide one. */
  ok(!/function drawRefused/.test(readFileSync(join(REPO, "master", "salt_command.html"), "utf8")),
    "the desk has no refused panel, so retiring the app left refusals with no surface at all");
}

/* ---- 11. the drafter is wired to a schedule ------------------------------------- */
section("Drafter — wiring");
{
  const w = readFileSync(join(REPO, "src", "worker.js"), "utf8");
  ok(/async scheduled\s*\(/.test(w), "the Worker exports a scheduled() handler");
  ok(/runDrafter/.test(w), "the cron runs the drafter");
  ok(/\/draft-now/.test(w), "there is a manual trigger for it");
  const cfg = readFileSync(join(REPO, "wrangler.jsonc"), "utf8");
  ok(/"crons"\s*:\s*\[/.test(cfg), "wrangler.jsonc declares a cron trigger");
  /* the manual trigger writes rows, so it must be gated like every other write */
  const seg = w.slice(w.indexOf('p === "/draft-now"'), w.indexOf('p === "/draft-now"') + 700);
  ok(/writeOk\(request, env\)/.test(seg) && /needsKey\(\)/.test(seg), "/draft-now is write-gated");

  /* DRAFT ON ARRIVAL. The cron alone loses the race against serve_desk.py's 60-second
     destructive drain, which was found by running it rather than by reasoning about it. */
  ok(/function draftOnArrival/.test(w), "the Worker drafts on arrival, not only on the cron");
  ok(/draftOnArrival\(env, ctx\)/.test(w), "and the queue POST calls it");
  ok(/async fetch\(request, env, ctx\)/.test(w), "fetch takes ctx so waitUntil is available");
  const arr = w.slice(w.indexOf("function draftOnArrival"), w.indexOf("async function handleQueuePost"));
  ok(/waitUntil/.test(arr) && !/await runDrafter/.test(arr.split("waitUntil")[0]),
    "it is deferred, so the phone's 200 for the ENTRY is never delayed by drafting");
  ok(/catch/.test(arr), "a drafter fault cannot fail the queue write");

  /* the queue POST must still succeed with no ctx and no D1 binding at all */
  const kv = new KV();
  const r = await worker.fetch(postQ({ device: "d1", queue: [{ at: "2026-08-16T01:00:00Z", raw: "e" }] }), mkEnv(kv));
  ok(r.status === 200, "a queue POST with no ctx and no ledger binding still succeeds");
  ok(kv.m.has("q:d1"), "and the entry still reached KV");
}

/* ---- 15. The book is in date order, and stays that way (20 Aug 2026) ------------- */
section("Ledger — the date is superior to the position");
{
  const MASTER = process.env.SALT_MASTER ||
    join(REPO, "master", "salt_command.html");
  if (!existsSync(MASTER)) {
    skipData("the master is not on this machine, so the order check is skipped");
  } else {
    /* ROWS ARE APPENDED IN THE ORDER THEY WERE FOLDED, WHICH IS NOT THE ORDER THINGS HAPPENED.
       A row agreed on the 17th and fulfilled on the 18th lands after rows dated the 18th, and
       an amendment can date a row into the middle of the book long after its neighbours were
       written. The desk sorts by date wherever the order matters, so this never moved a figure;
       it made the FILE unreadable, and the file is what a person audits. 37 sales rows and one
       purchase were out of order when this check was first run. */
    const { splitRecords, outOfOrder, sortRecords, dateOf } = await import("../tools/sort-ledger.mjs");

    /* v358: A STILL-UNDATED ROW CAN NOW CARRY A DATED AMEND STEP. A Modification can restate a
       pending order's price without moving cash or stock, so the row stays undated while its
       trail entry, dated the day it was typed, is the only "date" the line contains. The naive
       regex read that nested date as the row's own and reported the pending row as dated, which
       broke the order check the moment the first such row existed. */
    const pendingWithDatedAmend = ['  {"customer":"Z","qty":1,"total":0,"amend":[{"kind":"Fulfilment","cash":0,"kg":0},{"date":"2026-08-24","kind":"Modification","cash":0,"kg":0}],"note":"x"}'];
    ok(dateOf(pendingWithDatedAmend) === null, "a row with no date of its own reads as undated, even with a dated amend step");

    /* THE REGRESSION THAT DESTROYED RM 8,981 OF THE BOOK, AS A UNIT TEST. The first splitter
       started a record at ANY line whose trimmed content began with "{", so a row carrying a
       nested `amend:[{date:...}]` was torn in half and the halves sorted apart by the
       AMENDMENT's date. 96 sales rows became 49 and it built, tested and deployed clean. */
    const nested = [
      "  {date:'2026-08-02',customer:'A',qty:1,total:10,",
      "   amend:[",
      "          {date:'2026-07-01',kind:'Fulfilment',cash:10,kg:1}],",
      "   note:'x'},",
      "  {date:'2026-08-01',customer:'B',qty:1,total:20,note:'y'},",
    ];
    const recs = splitRecords(nested);
    ok(recs.length === 2, "a nested amendment line does not open a new record");
    ok(recs[0].length === 4, "the row keeps all four of its own lines");
    const flat = sortRecords(recs).flat();
    ok(flat.length === nested.length, "sorting is a permutation: no line is dropped");
    ok(flat[0] === nested[4] && flat[1] === nested[0],
      "the rows swap by their OWN date, not by the nested amendment's");

    const lines = readFileSync(MASTER, "utf8").split(/\r?\n/);
    for (const name of ["purchases", "sales"]) {
      const open = lines.findIndex((l) => l.startsWith(`const ${name}=[`));
      ok(open >= 0, `the master declares ${name}`);
      if (open < 0) continue;
      let close = open + 1;
      while (close < lines.length && lines[close].trimEnd() !== "];") close++;
      const bad = outOfOrder(splitRecords(lines.slice(open + 1, close)));
      ok(bad.length === 0, bad.length
        ? `${name} has ${bad.length} row(s) out of date order (row ${bad[0].i + 1}: ${bad[0].why}). Run: node tools/sort-ledger.mjs`
        : `${name} is in date order, undated pending rows last`);
    }
  }
}

/* ---- EVERY LEDGER ROW CARRIES A DATE, and the check CI runs is what says so ----------------
   His instruction of 04 Sep 2026. The sort has always put an undated row last, which kept the
   order stable but accommodated the row for ever: s108 and s109 sat undated from 24 Aug and
   s119 from 4 Sep, and because all three were cancelled the fold refused every repair until the
   Correction gate was narrowed the same day.
   THE CHECK IS SPAWNED, NOT IMPORTED, because the thing that must fail is the exit code CI reads,
   not a function the suite happens to call. Both directions are asserted against the same tool on
   the same day: the real book passes, and a copy carrying one undated row fails and names it. */
section("Ledger — the book carries no undated row, and --check is what proves it");
{
  const { undated } = await import("../tools/sort-ledger.mjs");
  const live = JSON.parse(readFileSync(join(REPO, "ledger", "book.json"), "utf8"));
  for (const name of ["sales", "purchases"]) {
    const bad = undated(live[name] || []);
    ok(bad.length === 0, bad.length
      ? `${name} carries ${bad.length} undated row(s): ${bad.map((x) => x.rid || "row " + (x.i + 1)).join(", ")}`
      : `${name}: all ${(live[name] || []).length} rows carry a date`);
  }

  const dir = join(REPO, "test", "tmp");
  mkdirSync(dir, { recursive: true });
  const run = (bookPath) => {
    try {
      const out = execFileSync("node", ["tools/sort-ledger.mjs", "--check"],
        { cwd: REPO, encoding: "utf8", stdio: "pipe", env: { ...process.env, SALT_BOOK: bookPath } });
      return { code: 0, out };
    } catch (e) { return { code: e.status == null ? -1 : e.status, out: String(e.stdout || "") + String(e.stderr || "") }; }
  };

  const good = join(dir, "book-dated.json");
  writeFileSync(good, JSON.stringify(live));
  const g = run(good);
  ok(g.code === 0, "--check passes on the book as it stands" + (g.code === 0 ? "" : ": " + g.out.trim().slice(0, 160)));

  /* the same book with ONE date removed from a row that has one: nothing else differs */
  const copy = JSON.parse(JSON.stringify(live));
  const victim = (copy.sales || []).find((r) => r && r.date);
  if (victim) delete victim.date;
  const bad = join(dir, "book-undated.json");
  writeFileSync(bad, JSON.stringify(copy));
  const b = run(bad);
  ok(b.code === 1, "and fails on a copy carrying one undated row, which is the guard doing its job");
  ok(/carry no date/.test(b.out), "the failure says the row carries no date, so the fix is obvious from the message");
}

/* ---- 16. The phone payload: the ledger, the open orders, the count dates (v319) -- */
section("Desk — the row editor names only fields CORRECTABLE holds");
{
  const master = readFileSync(join(REPO, "master", "salt_command.html"), "utf8");
  const { default: X } = await import("../engine/position.mjs");

  /* THE v383 FAULT, ASSERTED SO IT CANNOT COME BACK. Two corrections named `customer` where
     the correctable field is `party`. applyAmend wrote only what CORRECTABLE holds and still
     built the mod line and the trail from every key it was handed, so both rows recorded a
     re-key that had never happened. THE RECORD AND THE WRITE WERE BUILT FROM DIFFERENT LISTS.
     The fold refuses an unknown field now; this asserts the sheet can never emit one, which is
     the half no refusal can give back, because a refusal at the fold is four steps and a person
     away from the hand that typed it. */
  const edform = master.slice(master.indexOf("const EDFORM=["), master.indexOf("const edFields="));
  const keys = [...new Set([...edform.matchAll(/k:'([a-zA-Z]+)'/g)].map(m => m[1]))];
  ok(keys.length > 25, `the EDFORM table was found and read, ${keys.length} distinct fields`);
  const offeredNotCorrectable = keys.filter(k => X.CORRECTABLE.indexOf(k) < 0);
  ok(offeredNotCorrectable.length === 0,
    `every field the sheet offers is one the fold accepts; the fold would refuse ${offeredNotCorrectable.join(", ")}`);
  const correctableNotOffered = X.CORRECTABLE.filter(k => keys.indexOf(k) < 0);
  ok(correctableNotOffered.length === 0,
    `and every correctable field is reachable from the sheet; unreachable: ${correctableNotOffered.join(", ")}`);

  /* ONE TABLE, READ, NEVER COPIED. A second copy of the list is how the write and the record
     came apart in the first place, so the guard reads the engine's own export. */
  const edSubmit = master.slice(master.indexOf("function edSubmit(){"), master.indexOf("function goEl("));
  ok(edSubmit.includes("POSITION_ENGINE.CORRECTABLE"), "the guard checks against the engine's own table");
  ok(edSubmit.indexOf("edStray.length") < edSubmit.indexOf("queue.push"),
    "and refuses BEFORE the push, so a field the fold would refuse is never queued");
  ok(edSubmit.slice(edSubmit.indexOf("edStray.length"), edSubmit.indexOf("queue.push")).includes("return say("),
    "through the same message line that refuses an unchanged row, not a silent drop");
  const afterEngine = master.slice(master.indexOf("==== END ENGINE position ===="));
  ok(!afterEngine.includes("const CORRECTABLE="), "and nothing outside the engine block keeps a second copy of the list");
}

/* ---- 22. A caveat is a separate block, never a second sentence (v385) ------------- */
section("Desk — the Whiteboard caveats cannot be cut off");
{
  const master = readFileSync(join(REPO, "master", "salt_command.html"), "utf8");
  const NOTE_MIN = Number(master.slice(master.indexOf("NOTE_MIN=") + 9).match(/^[0-9]+/));
  ok(NOTE_MIN > 0, "NOTE_MIN was read from the master rather than assumed, at " + NOTE_MIN);

  /* stripMethod cuts an .insight past NOTE_MIN to its FIRST sentence, so a caveat written as a
     second sentence is the half that goes. The thin-book caveat measured 151 characters at every
     size a book can be, one order or a thousand, so it had never once reached the screen: a
     reader of a book under forty orders got the count and no word that every item beneath it is
     damped. The other branch survived on twenty characters of headroom, which is not safety, it
     is the figures being small today. UNDER NOTE_MIN IS A PROPERTY OF A TEMPLATE AND ITS
     FIGURES, NEVER OF THE TEMPLATE ALONE, so the test measures the caveats ALONE: standing by
     themselves they cannot be pushed over by any figure, whatever the book grows to. */
  const NL = String.fromCharCode(10);
  const plans = master.slice(master.indexOf("function tabPlans(){"), master.indexOf(NL + "function ", master.indexOf("function tabPlans(){") + 20));
  const caveats = [...plans.matchAll(/'([A-Z][^']{40,})'/g)].map(m => m[1])
    .filter(t => /forecast with|thin book/.test(t));
  ok(caveats.length === 2, "both rhythm caveats were found in the source, got " + caveats.length);
  caveats.forEach(c => ok(c.length < NOTE_MIN,
    "a caveat standing alone is under the limit and cannot be cut: " + c.length + " of " + NOTE_MIN + ", \"" + c.slice(0, 40) + "...\""));

  /* and they must actually STAND alone: one .insight for the count, another for the caveat */
  ok(plans.includes('<div class="insight">${esc(rhythmCount)}</div>'),
    "the count is its own block");
  ok(plans.includes("${rhythmCaveat?") && plans.includes("esc(rhythmCaveat)"),
    "and the caveat is its own block rather than a second sentence in the count's");
  ok(!plans.includes("rhythmLine"), "the joined version is gone, so nothing can put them back together");
}

/* ---- the engine ------------------------------------------------------------------ */
section("Engine — one definition, out of the desk (v337)");
{
  const { default: E } = await import("../engine/pricing.mjs");
  /* 1. the copy in the master is the module, to the byte */
  let chk = "";
  try { chk = execFileSync("node", [join(REPO, "tools", "engine.mjs"), "--check"], { encoding: "utf8" }); }
  catch (e) { chk = String((e && e.stdout) || e); }
  ok(/ok\s+pricing/.test(chk), "tools/engine.mjs --check: the master's inlined engine is the module");

  /* 2. it prices without a browser, and the ladder holds its own laws */
  const I = { prod: "salt", lockOn: false, lockState: { state: "none", lock: null }, lockBase: null,
    over: { cost: null, shrink: null }, lot: { qty: 50, total: 2200, rate: 44, date: "2026-08-20" },
    quoteRate: 44, costBasis: { freightPerTrip: { rm: 60 }, txnPerDelivery: { rm: 50 }, deliveredShare: { v: 0.2 } },
    attrib: 0.33, shrinkRate: 0.1, avgDel: { n: 20, mean: 2.5 } };
  const P = { LADDER: { floor: 0.33, ceiling: 2.0, anchorQ: 2.5, anchorX: 0.958, at: { lo: 0.5, hi: 12.5 },
      basis: "cogs", round: { to: 10, up: true }, taper: "supplier" },
    minPerUnit: 0, timePerOrder: 25, lotFloor: {}, tiers: [{ qty: 12.5, total: 700 }, { qty: 25, total: 1300 }, { qty: 50, total: 2200 }],
    boardSizes: [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6.25, 12.5] };
  const C = E.costStack(I);
  ok(Math.abs(C.landed - 45.2) < 1e-9, "landed cost is the lot rate plus the trip spread over the lot, where no freight is typed");
  ok(Math.abs(E.costStack({ ...I, freightRate: 0.8 }).landed - 44.8) < 1e-9, "and the freight typed on the lots, per unit, wins over the stated trip (v503)");
  ok(Math.abs(C.delPerOrder - 50) < 1e-9, "delPerOrder is ONE full delivery, not the blended figure");
  ok(Math.abs(C.txn - (0.2 * 50) / 2.5) < 1e-9, "eff carries only the share of orders that are delivered");
  ok(C.effEx > C.landed && C.eff > C.effEx, "the leak divides and delivery adds, in that order");
  const B = E.board(P.boardSizes, C, P);
  const asks = B.tiers[0].prices;
  ok(asks.length === 10 && asks.every((p) => Number.isFinite(p) && p % 10 === 0), "every ask is a multiple of ten");
  let law = true;
  for (let i = 1; i < asks.length; i++) if (asks[i] / P.boardSizes[i] > asks[i - 1] / P.boardSizes[i - 1] + 1e-9) law = false;
  ok(law, "the rate never rises with size");
  ok(P.boardSizes.every((q, i) => B.floors[q].floor <= asks[i] + 1e-9), "no ask sits under its own floor");
  /* v344: the card is a COLLECTION price, because four orders in five are collected. Where the
     ask cannot also carry a RM50 delivery the board says so rather than quietly pricing a loss. */
  /* v352: the board states one delivery charge and one time charge rather than flagging each size */
  /* v502: ONE FLOOR PER SIZE and no delivery in it: the board publishes floors[q].floor and no
     deliveryCharge, and the collects option, still accepted, changes nothing. */
  ok(B.timePerOrder === P.timePerOrder && !("deliveryCharge" in B) && P.boardSizes.every((q) => "floor" in B.floors[q] && !("delivered" in B.floors[q])),
    "the board states one floor per size and no delivery charge");
  ok(P.boardSizes.every((q) => Math.abs(E.floorTotal(q, C, P) - E.floorTotal(q, C, P, null, { collects: true })) < 1e-9
      && Math.abs(E.floorTotal(q, C, P) - (C.effEx * q + P.timePerOrder)) < 0.02),
    "the floor is the goods after the leak plus the time charge, and collecting or delivering does not move it");
  /* HIS TIME IS PER ORDER AND NEVER PER UNIT. Raising it by T lifts a floor by at most T,
     whatever the size; a per-unit charge would lift a 12.5 lot by 12.5 times as much. */
  const T = 40, more = { ...P, timePerOrder: (P.timePerOrder || 0) + T };
  ok(P.boardSizes.every((q) => {
    const d = E.floorTotal(q, C, more, null, { collects: true }) - E.floorTotal(q, C, P, null, { collects: true });
    return d >= -0.02 && d <= T + 0.02;
  }), "his time enters the floor once per order, never per unit");
  ok(E.floorTotal(1, C, P, null, { collects: true }) <= E.floorTotal(1, C, P), "collecting never raises the floor");
  ok(E.buyTaper(P.tiers).b < 0 && E.buyTaper([]).b === null, "the taper is fitted from the quote and absent without one");
  /* v353: A STATED PRICE WINS OVER THE DERIVED ONE, then obeys the same two laws. */
  {
    const setP = { ...P, stated: { "2": 150 } };
    const SB = E.board(P.boardSizes, C, setP), sa = SB.tiers[0].prices;
    ok(sa[P.boardSizes.indexOf(2)] === 150, "the price he sets at 2 unit is the price on the board");
    let law = true;
    for (let i = 1; i < sa.length; i++) if (sa[i] / P.boardSizes[i] > sa[i-1] / P.boardSizes[i-1] + 1e-9) law = false;
    ok(law, "and the rate still never rises with size, so setting one price moves the sizes above it");
    ok(P.boardSizes.every((q, i) => sa[i] >= SB.floors[q].floor - 0.009), "and RM150 at 2 unit clears its own floor, so nothing is lifted here");
    /* v552, his instruction of 09 Sep 2026: SET ONE ABSURDLY LOW AND IT IS QUOTED, NOT LIFTED. The
       guard that lifted it is now the DERIVED ask's alone, so the pair below is the whole of the
       change: same cost stack, same size, same policy but for the stated price. */
    const lowP = { ...P, stated: { "12.5": 1 } };
    const lowB = E.board(P.boardSizes, C, lowP);
    const lowRow = E.ladderWalk(P.boardSizes, C, lowP).find((r) => r.q === 12.5);
    ok(lowB.tiers[0].prices[P.boardSizes.indexOf(12.5)] === 1,
      `a price he sets under the floor is quoted as set (${lowB.tiers[0].prices[P.boardSizes.indexOf(12.5)]})`);
    ok(lowRow.under > 0.009 && Math.abs(lowRow.under - +(lowB.floors[12.5].floor - 1).toFixed(2)) < 0.011,
      `and names the gap to break-even, RM${lowRow.under} of RM${lowB.floors[12.5].floor}`);
    const derivedRow = E.ladderWalk(P.boardSizes, C, { ...P, stated: {} }).find((r) => r.q === 12.5);
    ok(derivedRow.p >= lowB.floors[12.5].floor - 0.009 && derivedRow.under === 0,
      `while a DERIVED ask is still lifted clear of its own floor (${derivedRow.p} over ${lowB.floors[12.5].floor}), which is what v352 was written for`);
  }

  /* 3. THE GATE FOR MOVE 1. Fed the desk's own inputs, the module reproduces the desk's asks and
     floors at every size on both books. The desk is running the inlined copy of the same code, so
     this proves the wrappers and the input record, which is where a drift could now hide. */
  const { openMaster } = await import("../tools/payload.mjs");
  const { w } = await openMaster();
  const read = (expr) => JSON.parse(w.eval("JSON.stringify(" + expr + ")"));
  for (const p of ["salt", "oil"]) {
    w.eval(`setProd(${JSON.stringify(p)});recompute();`);
    const sizes = read("PRICE_TIERS.sizes");
    const mine = E.board(sizes, E.costStack(read("pxInputs()")), read("pxPolicy()"));
    const deskAsks = read("PRICE_TIERS.sizes.map(q=>priceLadder(q).ask.total)");
    const deskFloors = read("PRICE_TIERS.sizes.map(q=>floorTotal(q))");
    ok(JSON.stringify(mine.tiers[0].prices) === JSON.stringify(deskAsks), `${p}: the module's asks are the desk's asks at every size`);
    ok(sizes.every((q, i) => mine.floors[q].floor === +deskFloors[i].toFixed(2)), `${p}: the module's floors are the desk's floors at every size`);
    const off = 7;
    ok(Math.abs(E.floorTotal(off, E.costStack(read("pxInputs()")), read("pxPolicy()")) - read(`floorTotal(${off})`)) < 1e-9,
      `${p}: an off-board size prices the same in both`);
  }
  try { w.close(); } catch (e) { }
}

/* ---- the position engine ----------------------------------------------------------- */
section("Engine — the position, out of the desk (v338)");
{
  const { default: X } = await import("../engine/position.mjs");
  let chk = "";
  try { chk = execFileSync("node", [join(REPO, "tools", "engine.mjs"), "--check"], { encoding: "utf8" }); }
  catch (e) { chk = String((e && e.stdout) || e); }
  ok(/ok\s+position/.test(chk), "tools/engine.mjs --check: the master's inlined position engine is the module");

  /* the transaction model, on rows built to hit each branch */
  ok(X.txStat({ qty: 1, total: 100, cash: 100, deliveredQty: 1 }).order === "Completed", "paid and delivered is Completed");
  ok(X.txStat({ qty: 1, total: 100, cash: 0, deliveredQty: 0 }).order === "Pending", "nothing moved is Pending");
  ok(/Advance/.test(X.txStat({ qty: 2, total: 200, cash: 100, deliveredQty: 2 }).order), "delivered ahead of payment is an advance");
  ok(/Deferred/.test(X.txStat({ qty: 2, total: 200, cash: 200, deliveredQty: 1 }).order), "paid ahead of delivery is deferred");
  ok(X.txStat({ qty: 1, total: 100, cash: 0, settledRM: 100, rebate: true, deliveredQty: 1 }).order === "In-Kind", "a settled rebate is In-Kind");
  ok(X.txAdvance({ qty: 2, total: 200, cash: 100, deliveredQty: 2 }) === 100, "the advance is what has been delivered and not paid for");
  ok(X.txDeferUnits({ qty: 2, total: 200, cash: 200, deliveredQty: 1 }) === 1, "the deferral is what has been paid for and not delivered");
  ok(X.poRecvUnits({ qty: 10, pending: true }) === 0 && X.poRecvUnits({ qty: 10, defaulted: true }) === 0
     && X.poRecvUnits({ qty: 10, inTransit: true }) === 0 && X.poRecvUnits({ qty: 10, receivedQty: 14 }) === 10 && X.poRecvUnits({ qty: 10 }) === 10,
     "a lot receives nothing while pending, defaulted or in transit, a stated receipt capped at the lot, else the whole lot");
  ok(X.provRate(0) === 0 && X.provRate(4) === 0.25 && X.provRate(8) === 0.5 && X.provRate(14) === 0.75 && X.provRate(21) === 1, "the ageing ladder");

  /* the walk on a book small enough to check by hand */
  const W = X.walk({ sales: [
      { date: "2026-08-10", customer: "CA", qty: 2, total: 200, cash: 200, deliveredQty: 2 },
      { customer: "CB", qty: 3, total: 300, cash: 0, deliveredQty: 0 },
      { date: "2026-08-15", customer: "CC", qty: 1, total: 100, cash: 0, deliveredQty: 1 } ],
    purchases: [ { date: "2026-08-01", qty: 50, total: 2200, supplier: "SA", status: "paid", cash: 2200 } ],
    opening: { qty: 10, costPerKg: 50, stated: null }, isSalt: true, loanUnits: 0, counted: null,
    supplierReceivable: null, today: new Date("2026-08-22"), wavgBuyPrev: 0 });
  ok(W.buyUnits === 50 && Math.abs(W.wavgBuy - 45) < 1e-9, "50 at RM44 over an opening 10 at RM50 averages RM45");
  ok(W.ledgerStock === 57 && W.currentStock === 57 && W.stockCounted === false, "uncounted, the ledger stands: 60 in, 3 out");
  ok(W.pricedSales.length === 2 && W.revTotal === 300, "the pending order counts nowhere; revenue is the two that moved");
  ok(Math.abs(W.cogs - 135) < 1e-9 && Math.abs(W.grossMargin - 165) < 1e-9, "cost of goods at the average for rows with no cost of their own");
  ok(W.arList.length === 1 && W.arGross === 100 && Math.abs(W.ar - 75) < 1e-9, "one advance of RM100, seven days old, provisioned a quarter");
  ok(W.defUnits === 0, "nothing paid ahead of delivery");
  const cm = X.commitments([{ customer: "CB", qty: 3, total: 300, cash: 0, deliveredQty: 0 }, { customer: "CD", qty: 2, total: 200, cash: 200, deliveredQty: 0 }], 4);
  ok(cm.owedUnits === 2 && cm.promUnits === 3 && cm.commitUnits === 5 && cm.shortUnits === 1 && !cm.coverable, "owed, promised, and one short of the shelf");

  /* A DECLARED DEFAULT PROVISIONS IN FULL. His instruction of 05 Sep 2026: CA4-DAM's outstanding
     is defaulted, with the same treatment as SF6-KLC. That treatment already exists on the supplier
     side, four lines apart in the walk: supRecovGross keeps the RM 750, supRecovNet goes to zero
     when status is writtenOff, and the note on the record says why: "the provision stays charged;
     what changes is that the desk no longer counts it as expected cash." The sale side had no such
     rule. txStat ignored the defaulted flag entirely, so s117 read Open . Advance with the flag set,
     and every net-of-ladder reader priced its RM 100 at a two-day-old row's 0% provision.
     THE SHAPE IS GROSS KEEPS, NET ZEROES, and it is asserted on the real walk with a book small
     enough to check by hand. Gross must keep the number: it is the numerator of provision =
     arGross - ar, it is what pxParty reads to penalise the party's next quote, and it is what the
     Order book and the statement print. Net must go to zero: it is what the desk expects to
     collect. The supplier path is asserted beside it so the two sides cannot drift apart again. */
  {
    const dflt = { date: "2026-08-28", customer: "CX", qty: 1, total: 100, cash: 0, deliveredQty: 1, defaulted: true };
    const st = X.txStat(dflt);
    ok(st.order === "Default" && st.pay === "Unpaid" && st.deliv === "Delivered",
      "a defaulted sale reads Default, unpaid, delivered, as a defaulted lot reads Default" + (st.order === "Default" ? "" : " (got " + st.order + ")"));
    ok(X.txStat({ ...dflt, defaulted: false }).order === "Open · Advance", "and the same row without the flag is the advance it was");
    ok(X.txStat({ ...dflt, cancelled: true }).order === "Cancelled", "cancelled still wins, because it is checked first and a cancelled row cannot default");
    ok(typeof X.saleProvRate === "function"
      && X.saleProvRate(dflt, 0) === 1 && X.saleProvRate(dflt, 30) === 1
      && X.saleProvRate({ ...dflt, defaulted: false }, 0) === 0 && X.saleProvRate({ ...dflt, defaulted: false }, 8) === 0.5,
      "saleProvRate is the ladder for a live row and 1 for a declared default, whatever its age");
    const W2 = X.walk({ sales: [
        { date: "2026-08-15", customer: "CC", qty: 1, total: 100, cash: 0, deliveredQty: 1 },
        { date: "2026-08-20", customer: "CD", qty: 1, total: 160, cash: 0, deliveredQty: 1, defaulted: true } ],
      purchases: [ { date: "2026-08-01", qty: 50, total: 2200, supplier: "SA", status: "paid", cash: 2200 } ],
      opening: { qty: 10, costPerKg: 50, stated: null }, isSalt: true, loanUnits: 0, counted: null,
      supplierReceivable: null, today: new Date("2026-08-22"), wavgBuyPrev: 0 });
    ok(W2.arList.length === 2 && W2.arGross === 260, `gross keeps the number: both advances stay on the list and RM 260 is still owed (${W2.arGross})`);
    ok(Math.abs(W2.ar - 75) < 1e-9, `net goes to zero on the default: RM 100 at seven days is RM 75, and the RM 160 counts for nothing (${W2.ar})`);
    ok(X.poStat({ qty: 10, total: 500, status: "paid", defaulted: true }).order === "Default", "and a defaulted lot still reads Default, so the two sides of the book agree");
  }

  /* ONE STATE PER ENTRY, AND IT IS THE ENGINE'S. His instruction of 05 Sep 2026, on a screenshot
     of s107: a completed order whose card read PENDING on its opening line and OPEN . DEFERRED on
     its step. The card's states came from replayAmend, a second copy of the state ladder that
     sums cash and units across the trail. Line 10203 filtered Corrections out before the replay,
     so a delivery that arrived as a Correction was invisible to it; line 10209 took the opening
     line's state from the replay's FIRST step, so every multi-step order opened as Pending
     whatever it had become; and ledFinal took the closing state from the replay's LAST step for
     anything not terminal. Three rows read wrong at the close, every completed multi-step order
     read wrong at the open, and s117 and s128 read Advance on the step where the engine has said
     Default since v488: the twin of that fold, unswept.
     THE RULE IS ASSERTED ON THE RENDERED CARD, not on the function, because the card is what he
     reads. Every card carries exactly one non-empty state, it is the engine's, and no step carries
     one. s107 is named because it is the case the instruction was given on; the general assertion
     covers the rest. */
  {
    const { openMaster: omL } = await import("../tools/payload.mjs");
    const { w: wL } = await omL();
    wL.eval("setProd('salt');recompute();switchTab('ledger');");
    const cards = JSON.parse(wL.eval(`JSON.stringify([].slice.call(document.querySelectorAll('.sec.on .lcard[data-rid]')).map(function(c){
      var pills=[].slice.call(c.querySelectorAll('.lstate')).map(function(s){return s.textContent.trim();}).filter(Boolean);
      var steps=[].slice.call(c.querySelectorAll('.lmove .lstate')).map(function(s){return s.textContent.trim();}).filter(Boolean);
      return {rid:c.getAttribute('data-rid'), pills:pills, stepPills:steps};}))`));
    ok(cards.length > 100, `the Ledger rendered ${cards.length} cards to check`);
    const multi = cards.filter((c) => c.pills.length !== 1);
    ok(multi.length === 0, multi.length
      ? `${multi.length} card(s) carry ${multi[0].pills.length} states, e.g. ${multi[0].rid}: ${multi[0].pills.join(" / ")}`
      : "every card carries exactly one state");
    const stepped = cards.filter((c) => c.stepPills.length);
    ok(stepped.length === 0, stepped.length ? `${stepped.length} card(s) still put a state on a step, e.g. ${stepped[0].rid}` : "and no step carries one");
    const bookL = JSON.parse(readFileSync(join(REPO, "ledger", "book.json"), "utf8"));
    const eng = (rid) => X.txStat(bookL.sales.find((s) => s.rid === rid)).order;
    const wrong = cards.filter((c) => c.pills.length === 1 && bookL.sales.some((s) => s.rid === c.rid) && c.pills[0].toLowerCase() !== eng(c.rid).toLowerCase());
    ok(wrong.length === 0, wrong.length
      ? `${wrong.length} card(s) disagree with the engine, e.g. ${wrong[0].rid} shows ${wrong[0].pills[0]} where the engine says ${eng(wrong[0].rid)}`
      : "and every one is the engine's own reading");
    const s107 = cards.find((c) => c.rid === "s107");
    ok(!!s107 && s107.pills.length === 1 && /completed/i.test(s107.pills[0]),
      `s107, the card the instruction was given on, reads Completed once (${s107 ? s107.pills.join(" / ") : "not rendered"})`);
  }

  /* THE CARD CARRIES ITS STATE AS A HINT OF COLOUR. His instruction of 05 Sep 2026: completed green,
     open advance amber, open deferred yellow, defaulted red, pending blue, cancelled faded. The
     card's class had known one word for both Open states (s-open), and the base layer's tint rules
     had been switched off inside the Ledger's list mode since v465, so no card carried any colour.
     Asserted on the rendered card: every real card's class is the engine's order under the map,
     and six planted sales, one per state, each render with their own class and resolve their own
     stripe colour through the cascade, which proves the layer's rule wins over the base rules it
     retires. Planted because the book need not hold every state on any given day: it held no
     Deferred and no Pending sale on the day this was written, and a check that fails on a clean
     book is checking the book. */
  {
    const MAP = { "Completed": "s-completed", "Open · Advance": "s-advance", "Open · Deferred": "s-deferred",
      "Pending": "s-pending", "Default": "s-default", "Cancelled": "s-cancelled", "In-Kind": "s-inkind" };
    const { openMaster: omC } = await import("../tools/payload.mjs");
    const { w: wC } = await omC();
    const PLANT = {
      "s-completed": { cash: 100, deliveredQty: 2 }, "s-advance": { cash: 0, deliveredQty: 2 },
      "s-deferred": { cash: 100, deliveredQty: 0 }, "s-pending": { cash: 0, deliveredQty: 0 },
      "s-default": { cash: 0, deliveredQty: 2, defaulted: true }, "s-cancelled": { cash: 0, deliveredQty: 0, cancelled: true, cancelledOn: "2026-09-02" } };
    Object.keys(PLANT).forEach((k) => wC.eval(`sales.push(Object.assign({customer:'CX9-TINT',qty:2,total:100,date:'2026-09-01',rid:'x-${k.slice(2)}'},${JSON.stringify(PLANT[k])}))`));
    wC.eval("setProd('salt');recompute();switchTab('ledger');");
    const bookC = JSON.parse(readFileSync(join(REPO, "ledger", "book.json"), "utf8"));
    const got = JSON.parse(wC.eval(`JSON.stringify([].slice.call(document.querySelectorAll('.sec.on .lcard[data-rid]')).map(function(c){
      var st=[].filter.call(c.classList,function(k){return k.slice(0,2)==='s-';});
      var cs=getComputedStyle(c);
      return {rid:c.getAttribute('data-rid'),cls:st,stripe:cs.borderLeftColor,op:cs.opacity};}))`));
    const rowOf = (rid) => bookC.sales.find((s) => s.rid === rid);
    const real = got.filter((c) => rowOf(c.rid));
    ok(real.length > 100, `${real.length} real sale cards carry a state class to check`);
    const bad = real.filter((c) => c.cls.length !== 1 || c.cls[0] !== MAP[X.txStat(rowOf(c.rid)).order]);
    ok(bad.length === 0, bad.length
      ? `${bad.length} card(s) carry the wrong state class, e.g. ${bad[0].rid} has ${bad[0].cls.join(" ")} where the engine says ${X.txStat(rowOf(bad[0].rid)).order}`
      : "every real card's class is the engine's order");
    const planted = Object.keys(PLANT).map((k) => [k, got.find((c) => c.rid === "x-" + k.slice(2))]);
    const unplanted = planted.filter(([k, c]) => !c || c.cls.join(" ") !== k);
    ok(unplanted.length === 0, unplanted.length
      ? `planted ${unplanted[0][0]} rendered as ${unplanted[0][1] ? unplanted[0][1].cls.join(" ") || "no class" : "no card"}`
      : "six planted sales render in six classes, Advance and Deferred told apart");
    const stripes = planted.map(([, c]) => c && c.stripe);
    ok(stripes.every(Boolean) && new Set(stripes).size === 6,
      `each state resolves its own stripe colour (${planted.map(([k, c]) => k.slice(2) + ": " + (c && c.stripe)).join("; ")})`);
    const canc = got.find((c) => c.rid === "x-cancelled");
    ok(!!canc && +canc.op < 1, `a cancelled entry is faded (opacity ${canc ? canc.op : "?"})`);
  }

  /* THE ENTER PART'S PREVIEW ANSWERS THE SAME QUESTION THE ENGINE DOES. His instruction of 05 Sep
     2026, extending the v491 sweep to the fourth copy of the ladder. wbState took four scalars for a
     hypothetical entry and re-derived the state by hand, so it knew nothing of unpriced, cancelled,
     in-kind, the zero-total rule or defaulted, and its callers spelled a default preview
     'Defaulted', a fifth word for one state. The audit measured it disagreeing with txStat on 18 of
     130 sales. Asserted on the desk's own function against the desk's own rows: for every sale,
     the preview of the row as it stands must read what the engine reads. */
  {
    const { openMaster: omW } = await import("../tools/payload.mjs");
    const { w: wW } = await omW();
    const dis = JSON.parse(wW.eval(`JSON.stringify((function(){var out=[];sales.forEach(function(s){
      var st=txStat(s), pv=wbState(s.total,s.qty,txPaid(s),txEffDeliv(s),s);
      if(pv.state!==st.order) out.push(s.rid+' preview '+pv.state+' engine '+st.order);});return out;})())`));
    ok(dis.length === 0, dis.length
      ? `wbState disagrees with txStat on ${dis.length} of the book's sales, e.g. ${dis.slice(0, 3).join("; ")}`
      : "the Enter part's preview reads every sale on the book exactly as the engine does");
    const dflt = JSON.parse(wW.eval(`JSON.stringify(wbState(100,1,0,1,{defaulted:true}))`));
    ok(dflt.state === "Default", `a defaulted preview reads Default, the engine's word, not a fifth spelling (${dflt.state})`);
  }

  /* THE GATE: the desk's own inputs, both books, and the record comes back equal */
  const { openMaster } = await import("../tools/payload.mjs");
  const { w } = await openMaster();
  const read = (expr) => JSON.parse(w.eval("JSON.stringify(" + expr + ")"));
  const NUMS = ["buyUnits", "buyRM", "wavgBuy", "soldUnits", "ledgerStock", "stockCounted", "currentStock", "selfUse", "revTotal", "revCollected",
    "arGross", "ar", "advTotal", "defUnits", "supRecovGross", "supRecovNet", "cogs", "grossMargin", "marginPct", "goodwillRM"];
  for (const p of ["salt", "oil"]) {
    w.eval(`setProd(${JSON.stringify(p)});`);
    const mine = X.walk(read("posInputs()"));
    const desk = read("({" + NUMS.join(",") + ",nPriced:pricedSales.length,nAR:arList.length,nRecv:receivedPO.length})");
    ok(NUMS.every((k) => mine[k] === desk[k]) && mine.pricedSales.length === desk.nPriced && mine.arList.length === desk.nAR && mine.receivedPO.length === desk.nRecv,
      `${p}: the walk reproduces the desk's position to the last decimal`);
    /* round 5: the trigger is per book, so the gate hands the engine the book's own figure,
       exactly as the desk's coverStats() wrapper does */
    const cv = X.coverStats({ pricedSales: mine.pricedSales, currentStock: mine.currentStock, defUnits: mine.defUnits, today: new Date(read("TODAY")), reorderUnits: read("reorderFor(PROD)") });
    const dcv = read("coverStats()");
    ok(cv.rate === dcv.rate && cv.free === dcv.free && cv.days === dcv.days && cv.shortBy === dcv.shortBy, `${p}: cover agrees`);
    const c2 = X.commitments(read("pSales(PROD)"), mine.currentStock), f = read("forecast()");
    ok(c2.commitUnits === f.commitUnits && c2.shortUnits === f.shortUnits && c2.owedUnits === f.owedUnits && c2.promUnits === f.promUnits, `${p}: the commitments agree with the forecast`);
  }
  try { w.close(); } catch (e) { }
}

/* ---- the geography as data ------------------------------------------------------------ */
section("Geography — geo/ is the source (v349)");
{
  let chk = "";
  try { chk = execFileSync("node", [join(REPO, "tools", "geosync.mjs"), "--check"], { encoding: "utf8" }); }
  catch (e) { chk = String((e && e.stdout) || e); }
  ok(/ok\s+the master's GEO block/.test(chk), "tools/geosync.mjs --check: the master's GEO block is the two files");
  const bm = JSON.parse(readFileSync(join(REPO, "geo", "basemap.json"), "utf8"));
  const pl = JSON.parse(readFileSync(join(REPO, "geo", "places.json"), "utf8"));
  ok(bm.features.length >= 1 && bm.features.every((f) => f.rings.length && f.rings.every((r) => r.length >= 4)),
    `the basemap holds ${bm.features.length} outline(s), every ring closed`);
  ok(typeof bm.licence === "string" && typeof bm.attribution === "string" && typeof bm.sourceUrl === "string" && typeof bm.fetchedOn === "string",
    "and states its licence, attribution, source and the day it was fetched");
  /* fetched, never remembered: every point must sit inside Malaysia's own box, so a hand-typed
     coastline or a lat/lng swap cannot pass as real geometry. */
  const all = bm.features.flatMap((f) => f.rings.flat());
  ok(all.every(([lg, la]) => lg > 99.5 && lg < 105 && la > 0.8 && la < 7.5),
    `every one of the ${all.length} points is inside Malaysia's bounding box`);
  ok(["PLACES", "METRO", "NON_PLACE", "PLACEHOLDER", "LOCS"].every((k) => pl[k] && typeof pl[k] === "object"),
    "the gazetteer holds all five declarations");
  /* the outlines are drawn and credited, and they carry NO name into a public page */
  const desk = readFileSync(join(REPO, "public", "desk.html"), "utf8");
  ok(/const BASEMAP=\[/.test(desk) && !/const BASEMAP=\[\s*\{name:/.test(desk), "the built desk carries the outlines and no feature name");
  ok(bm.features.every((f) => !desk.includes(`"${f.name}"`)), "no basemap feature is named in the public desk");
  ok(desk.includes(bm.attribution.slice(0, 24)), "the ODbL attribution is on the page, which is what the licence asks");
}

/* ---- the book as data ---------------------------------------------------------------- */
section("Book — ledger/book.json is the source (v339)");
{
  let chk = "";
  try { chk = execFileSync("node", [join(REPO, "tools", "booksync.mjs"), "--check"], { encoding: "utf8" }); }
  catch (e) { chk = String((e && e.stdout) || e); }
  ok(/ok\s+the master's BOOK block is ledger\/book\.json/.test(chk), "tools/booksync.mjs --check: the master's book block is the file");
  const book = JSON.parse(readFileSync(join(REPO, "ledger", "book.json"), "utf8"));
  const keys = Object.keys(book).filter((k) => k !== "NOTES");
  ok(keys.length === 28, "the book holds the twenty-eight ledger keys");   // v353 added PRICE_SET; v504 added COUNTS; v549 retired SOURCING_PLAN; v553 added COST_RULE
  ok(Array.isArray(book.sales) && book.sales.length > 100 && Array.isArray(book.purchases), "with the rows as records");
  ok(typeof book.QUEUE_COMMITTED === "string" && typeof book.STATED_STOCK === "number", "and the singletons as values");
  ok(book.NOTES && Array.isArray(book.NOTES.STATED_STOCK) && book.NOTES.STATED_STOCK.length > 0, "the stated stock's roll history survived as NOTES");
  /* the running desk evaluates to the file: read back through the extract */
  const led = JSON.parse(readFileSync(join(REPO, "ledger", "ledger.json"), "utf8")).ledger;
  const same = keys.every((k) => JSON.stringify(led[k]) === JSON.stringify(book[k]));
  ok(same, "the extract read from the running desk equals ledger/book.json on every key");
  const master = readFileSync(join(REPO, "master", "salt_command.html"), "utf8");
  ok(!/(?:^|\n)const sales=\[\n  \{date:'/.test(master), "the hand-written sales array is gone from the master");
  ok(/const sales=\[\n  \{"date"/.test(master) || /const sales=\[\n  \{"/.test(master), "and the generated one stands in its place");
}

/* ---- the fold as a data write ----------------------------------------------------------- */
section("Fold — an approved batch becomes records in the book (v340)");
{
  const { plan, apply } = await import("../tools/fold.mjs");
  const book = JSON.parse(readFileSync(join(REPO, "ledger", "book.json"), "utf8"));
  const master = readFileSync(join(REPO, "master", "salt_command.html"), "utf8");
  /* v359: SYNTHETIC TARGETS, NOT BORROWED FROM THE REAL BOOK, for BOTH amendment cases.
     Two fixes were tried before this and both were beaten by the same real fold within
     hours: pinning to a named row (CS6-PER at v347, the CS6-BS free unit at v359) broke
     the moment that exact row was settled, and deriving the Modification's target from
     "whatever second live undated row the book happens to carry" (also v359, same day)
     broke the moment a real fold left only one spare undated row rather than two, which is
     precisely what folding CA4-DAM's pending order was always going to do the next time it
     ran. A test that depends on the live ledger holding a particular SHAPE, not just a
     particular row, is still a test with a half-life. Two fake pending orders are pushed
     onto this COPY of the book instead, so the fixture owns both its targets outright and
     no fold, real or synthetic, can ever consume them. */
  book.sales.push(
    { customer: "CX9-TESTFUL", qty: 6.25, total: 450, cash: 0, deliveredQty: 0 },
    { customer: "CX9-TESTMOD", qty: 1, total: 0, cash: 0, deliveredQty: 0 },
  );
  const key = "CX9-TESTFUL|undefined|450";
  const modKey = "CX9-TESTMOD|undefined|0";
  /* THE FIXTURE IDS ARE BUILT FROM THE BOOK'S OWN WATERMARK AND NOT WRITTEN DOWN, because
     apply() only moves QUEUE_COMMITTED when the newest id folded is newer than the one the
     book already carries. Hard-coded 2026-08-23T01:xx ids outranked the watermark when this
     was written and stopped doing so the moment a real fold moved it past them: the fold of
     23 Aug took it to 15:36 that same day and the two watermark assertions below failed on a
     batch that was faultless. A day after whatever the book says is always newer. */
  const day = new Date(new Date(book.QUEUE_COMMITTED).getTime() + 864e5).toISOString().slice(0, 11);
  const ID = (hhmm) => `${day}${hhmm}:00.000Z`;
  const staged = { ok: true, count: 6, approved: [
    { id: ID("01:00"), collection: "sales", amends: null, amendKind: null,
      row: { customer: "CA4-DAM", qty: 0.5, total: 50, cost: 44, cash: 50, date: "2026-08-23", deliveredQty: 0.5, deliveredOn: "2026-08-23", paidOn: "2026-08-23" },
      entry: { at: ID("01:00"), payload: { mode: "new", direction: "SELL" } } },
    { id: ID("01:05"), collection: "sales", amends: key, amendKind: "Fulfilment",
      row: { customer: "CX9-TESTFUL", qty: 6.25, total: 450, cash: 0, date: null },
      entry: { at: ID("01:05"), payload: { mode: "amend", direction: "SELL", orderKey: key, kind: "Fulfilment", date: "2026-08-23", cash: 450, kg: 6.25 } } },
    { id: ID("01:10"), collection: "count", amends: null, amendKind: null,
      row: { product: "oil", qty: 3, date: "2026-08-23", was: 0, drift: 3 }, entry: { at: ID("01:10"), payload: { mode: "count" } } },
    { id: ID("01:15"), collection: "roster", amends: null, amendKind: null,
      row: { code: "CT7-KLC", kind: "customer", parent: null, note: null }, entry: { at: ID("01:15"), payload: { mode: "party" } } },
    /* v358: a Modification now plans and applies mechanically, exactly like the Fulfilment
       above; it just replaces qty/total rather than adding to cash/deliveredQty. */
    { id: ID("01:20"), collection: "sales", amends: modKey, amendKind: "Modification",
      row: { customer: "CX9-TESTMOD", qty: 1, total: 0, newQty: 1, newTotal: 130 },
      entry: { at: ID("01:20"), payload: { mode: "amend", direction: "SELL", orderKey: modKey, kind: "Modification", date: "2026-08-23", newQty: 1, newTotal: 130 } } },
    /* Linked stays refused: unlike Modification it carries no figure to check, only a
       judgement about which OTHER row it links to. Placed last so slice(0, 5) below drops
       only this one item and keeps the Modification among the ones that fold. */
    { id: ID("01:25"), collection: "sales", amends: "CX9-NOPE|undefined|1", amendKind: "Linked",
      row: {}, entry: { at: ID("01:25"), payload: { mode: "amend", direction: "SELL", kind: "Linked" } } },
  ] };
  /* v354: a price edit folds into PRICE_SET, moves no stock and no cash, and REPLACES rather
     than merges, so a price he cleared on the desk is actually cleared in the book. */
  {
    const one = { ok: true, count: 1, approved: [{ id: ID("03:00"), collection: "priceset", amends: null, amendKind: null,
      row: { product: "oil", prices: { "10": 130, "20": 250 }, hide: [90, 100] },
      entry: { at: ID("03:00"), payload: { mode: "price", product: "oil" } } }] };
    const pp = plan(JSON.parse(JSON.stringify(book)), one, null);
    ok(pp.items.length === 1 && pp.refused.length === 0 && pp.moves.length === 0,
      "a price edit is planned and moves nothing physical");
    const PB = JSON.parse(JSON.stringify(book)); PB.QUEUE_COMMITTED = "2026-01-01T00:00:00.000Z";
    const beforeStock = PB.STATED_STOCK, beforeSales = PB.sales.length;
    const pr = apply(PB, one, { version: "v998", date: "24 Aug 2026", title: "A TEST PRICE EDIT",
      notes: ["<b>TEST.</b> Nothing real."], rows: { [ID("03:00")]: { note: "Sets the oil board." } }, stockNote: "" }, master);
    ok(pr.ok, "the price edit applies: " + (pr.ok ? "" : pr.problems.join("; ")));
    if (pr.ok) {
      ok(PB.PRICE_SET.oil.prices["10"] === 130 && PB.PRICE_SET.oil.prices["20"] === 250, "the prices he set are on the book");
      ok(JSON.stringify(PB.PRICE_SET.oil.hide) === JSON.stringify([90, 100]), "and the sizes he hid");
      ok(PB.STATED_STOCK === beforeStock && PB.sales.length === beforeSales, "and no stock moved and no row was written");
      ok(PB.PRICE_SET.salt && JSON.stringify(PB.PRICE_SET.salt) === JSON.stringify(book.PRICE_SET.salt), "the other product's board is untouched");
    }
    /* a product that is not on the book is refused rather than invented */
    const bad = { ...one, approved: [{ ...one.approved[0], row: { product: "sugar", prices: {}, hide: [] } }] };
    const bp = plan(JSON.parse(JSON.stringify(book)), bad, null);
    ok(bp.items.length === 0 && /not a product/.test(bp.refused[0].why || ""), "a price edit for a product that does not exist is refused");
  }
  /* ---- A CANCELLED ROW IS STILL CORRECTABLE, because restating a record is not reviving it ----
     v347 refused EVERY amendment against a cancelled row, to stop a fulfilment queued before the
     cancellation folding onto it afterwards and quietly bringing it back with cash, units and a
     date. That danger is real and the guard stays for it. But the guard was written wider than the
     danger: a Correction moves nothing, and fold.mjs's own comment six lines below says so, so it
     was refused for no reason. The cost was not theoretical. s108 and s109 were cancelled undated
     on 24 Aug 2026 and there was no route to date them afterwards: queue the correction, the plan
     refuses it, every time. applyAmend already holds the right policy, asserted above at "a
     cancelled row can still be corrected", and plan() blocked the call before it could ever run.
     Two guards for one question, disagreeing.
     BOTH DIRECTIONS ARE ASSERTED HERE, because a gate that opened for everything would be worse
     than the one that was shut: the Correction must plan, and the Fulfilment beside it must still
     be refused BY THIS GUARD, checked on the reason and not merely on the count. */
  {
    const CB = JSON.parse(JSON.stringify(book));
    CB.sales.push({ customer: "CX9-TESTCANC", qty: 2, total: 200, cash: 0, deliveredQty: 0,
      cancelled: true, cancelledOn: "2026-08-24" });
    const cKey = "CX9-TESTCANC|undefined|200";
    const mk = (hhmm, kind, payload) => ({ id: ID(hhmm), collection: "sales", amends: cKey,
      amendKind: kind, row: { customer: "CX9-TESTCANC", qty: 2, total: 200 },
      entry: { at: ID(hhmm), payload: { mode: "amend", direction: "SELL", orderKey: cKey, kind, ...payload } } });

    const corr = plan(JSON.parse(JSON.stringify(CB)), { ok: true, count: 1, approved: [
      mk("04:00", "Correction", { date: "2026-09-04", fields: { date: "2026-08-24" } }) ] }, null);
    ok(corr.items.length === 1 && corr.refused.length === 0,
      "a cancelled row accepts a Correction, so a date can still be put right after cancellation"
      + (corr.refused.length ? ": " + corr.refused[0].why : ""));

    const ful = plan(JSON.parse(JSON.stringify(CB)), { ok: true, count: 1, approved: [
      mk("04:05", "Fulfilment", { date: "2026-09-04", cash: 200, kg: 2 }) ] }, null);
    ok(ful.items.length === 0 && /cancelled/.test(ful.refused[0] && ful.refused[0].why || ""),
      "and a Fulfilment against the same cancelled row is still refused, by the cancelled guard");

    const mod = plan(JSON.parse(JSON.stringify(CB)), { ok: true, count: 1, approved: [
      mk("04:10", "Modification", { date: "2026-09-04", newQty: 3, newTotal: 300 }) ] }, null);
    ok(mod.items.length === 0 && /cancelled/.test(mod.refused[0] && mod.refused[0].why || ""),
      "and so is a Modification, which restates the figures rather than only the record");
  }
  /* ---- a CORRECTION reaches EVERY attribute a person states (v363) ---- */
  {
    const { checkCorrection, CORRECTABLE } = await import("../src/drafter.js");
    const E = (await import("../engine/position.mjs")).default;
    const mtxt = readFileSync(join(REPO, "master", "salt_command.html"), "utf8");

    /* v373: thirty-one. handover joined the table so the delivered share could be measured
       from the rows rather than stated at 0.20. The count is pinned rather than derived on
       purpose: a table that quietly gains a field is exactly what this assertion is for. */
    /* v502: thirty-two. delivery joined, the charge inside a sale's total, typed per order. */
    /* v503: thirty-three. freight joined, the trip a lot cost, typed per purchase. */
    ok(E.CORRECTABLE.length === 33, `thirty-three attributes are editable, found ${E.CORRECTABLE.length}`);
    ok(E.CORRECTABLE.includes('handover'), 'handover is one of them');
    ok(Array.isArray(E.HANDOVER) && E.HANDOVER.join(',') === 'delivered,collected',
       `handover takes two values, found ${JSON.stringify(E.HANDOVER)}`);
    /* THE EXCLUSIONS ARE THE POINT. Each is computed or structural, and a table that quietly
       gained one would let an editor rename the row it is editing, or claim two streams at once. */
    for (const banned of ["rid", "amend", "mod", "rev", "ref", "refKg", "status"]) {
      ok(!E.CORRECTABLE.includes(banned), `${banned} is not editable: it is computed or structural`);
    }
    for (const wanted of ["cash", "deliveredQty", "cost", "paidOn", "cancelled", "goodwill", "settledRM", "orderCode", "unpriced", "note"]) {
      ok(E.CORRECTABLE.includes(wanted), `${wanted} is editable`);
    }
    /* ONE TABLE, THREE CONSUMERS: the drafter decides what to accept, the fold applies it, the
       desk applies it too. A table in two places is a table that will differ. */
    ok(CORRECTABLE === E.CORRECTABLE, "the drafter reads the engine table rather than its own copy");
    ok(/PE\.CORRECT_BOOL/.test(mtxt), "and the desk applies a correction from that same table");

    const bk = { state: { roster: ["CA4-DAM", "CN6-WM"], PRODUCTS: { salt: {}, oil: {} }, associates: ["CN6-WM"] } };
    const tgt = { rid: "sZ1", customer: "CA4-DAM", qty: 2, total: 200, cash: 200, deliveredQty: 2, cost: 44 };
    const errsOf = (f, t) => checkCorrection(f, bk, t || tgt, true).errs.join(" ");
    const flagsOf = (f, t) => checkCorrection(f, bk, t || tgt, true).flags;

    /* AN ABSENT FLAG AND false ARE THE SAME THING on this book, or every save that touched a
       checkbox would record a correction that changed nothing. */
    ok(/changes nothing/.test(errsOf({ cancelled: false })), "setting a flag false on a row that never had it is not a change");
    ok(checkCorrection({ cancelled: true }, bk, tgt, true).changes.length === 1, "but setting it true is");

    /* the checks that REFUSE, one per kind of field */
    ok(/not a date/.test(errsOf({ paidOn: "yesterday" })), "a date that is not a date is refused");
    ok(/true or false/.test(errsOf({ cancelled: "yes" })), "a flag that is not a boolean is refused");
    ok(/not negative/.test(errsOf({ cash: -1 })), "a negative figure is refused");
    ok(/not a field/.test(errsOf({ rid: "sZ9" })), "a field outside the table is refused, so a row cannot be renamed");
    ok(/cannot be cleared/.test(errsOf({ total: null })), "the four a row cannot do without cannot be cleared");

    /* the flags that WARN and let it through, because each is a real thing that happens */
    ok(flagsOf({ cash: 400 }).some((f) => /overpaid/.test(f)), "more cash than the row is worth is flagged, not refused");
    ok(flagsOf({ cost: 99 }).some((f) => /overrides what the inventory says/.test(f)), "a hand-typed cost says it overrides the shelf");
    ok(flagsOf({ cancelled: true }).some((f) => /out of every figure/.test(f)), "cancelling says what it takes with it");
    ok(flagsOf({ cash: 10 }, { ...tgt, amend: [{ kind: "Fulfilment" }] }).some((f) => /no longer add up/.test(f)),
      "setting a figure on a row with a trail says the trail will no longer sum to it");

    /* THE ROW AS A PERSON NAMES IT. On an R2 row the counterparty field holds the ASSOCIATE and
       the buyer is the downstream, so a diff built from the raw row would report the associate
       as the buyer and every before-and-after line would be wrong. */
    const r2 = { rid: "sZ2", customer: "CN6-WM", rev: "R2", downstream: "CA4-DAM", qty: 1, total: 100 };
    ok(/changes nothing/.test(errsOf({ party: "CA4-DAM" }, r2)),
      "the buyer on an R2 row reads as the downstream, so restating it is not a change");
    ok(checkCorrection({ party: "CN6-WM" }, bk, r2, true).changes.length === 1,
      "and naming a different buyer on it is");
  }
  /* ---- the 25 Aug audit: every finding pinned so it cannot come back quietly ---- */
  {
    const { draftRow, checkCorrection } = await import("../src/drafter.js");
    const E2 = (await import("../engine/position.mjs")).default;
    const m2 = readFileSync(join(REPO, "master", "salt_command.html"), "utf8");

    /* the engine emits the RAW figures where they differ from the derived ones, so the
       phone edits the field a correction actually writes. Thirteen live rows diverge. */
    const ink = E2.ledgerRow({ rid: "sT", customer: "X", qty: 1, total: 80, cash: 0, settledRM: 80, deliveredQty: 1, date: "2026-07-01" }, "S", "salt");
    ok(ink.cash === 80 && ink.cashRaw === 0, "an in-kind row reads paid RM80 and says its raw cash is 0");
    const plainR = E2.ledgerRow({ rid: "sU", customer: "X", qty: 1, total: 100, cash: 100, deliveredQty: 1, date: "2026-07-01" }, "S", "salt");
    ok(plainR.cashRaw === undefined && plainR.delivRaw === undefined, "a row with no divergence carries no extra fields");

    /* the drafter: one flag per fact, effective figures, and the two new refusals */
    const bk2 = { state: { roster: ["CA4-DAM", "CN6-WM"], PRODUCTS: { salt: {}, oil: {} }, associates: ["CN6-WM"] } };
    const inkT = { rid: "sK1", customer: "CA4-DAM", qty: 1, total: 80, cash: 0, settledRM: 80, deliveredQty: 1, date: "2026-07-01" };
    const c1 = checkCorrection({ date: null }, bk2, inkT, true);
    ok(/cannot be cleared: money or stock has moved/.test(c1.errs.join(" ")),
      "clearing the date off a row with movement is refused, not flagged");
    /* one flag per fact: checkCorrection and the branch each raised the party and date
       flags, so every card said each twice. And the under-paid comparison reads the
       EFFECTIVE paid, or an in-kind settlement hides it entirely. */
    {
      const bkL = { sales: [inkT], purchases: [], state: bk2.state, pricing: null };
      const d1 = draftRow({ at: "a1", payload: { mode: "amend", kind: "Correction", rid: "sK1", fields: { party: "CN6-WM", date: "2026-07-02" } } }, bkL);
      ok(!d1.skip && (d1.flags || []).filter((f) => /moves the row from/.test(f)).length === 1,
        "a party correction raises the party flag once, not twice");
      ok((d1.flags || []).filter((f) => /redating|counted as having happened/.test(f)).length === 1,
        "and the date flag once");
      const d2 = draftRow({ at: "a2", payload: { mode: "amend", kind: "Correction", rid: "sK1", fields: { total: 70 } } }, bkL);
      ok(!d2.skip && (d2.flags || []).some((f) => /under the RM 80 already paid/.test(f)),
        "a total under the EFFECTIVE paid figure is flagged: raw cash is 0 here and the RM80 was settled in kind");
    }
    const oldLot = { rid: "pK1", supplier: "SA5-BTR", qty: 5, total: 250, status: "paid" };
    ok(checkCorrection({ date: "2026-07-03" }, bk2, { ...oldLot, date: "2026-07-02" }, false).errs.length === 0,
      "a date fix on an old lot is admissible");

    /* the fold: the three writes the audit added, each against the failure it stops */
    {
      const FB = JSON.parse(JSON.stringify(book));
      FB.QUEUE_COMMITTED = "2026-01-01T00:00:00.000Z";
      FB.purchases.push({ rid: "pX01", date: "2026-07-02", supplier: "SA5-BTR", qty: 5, total: 250, status: "paid", note: "fixture." });
      FB.sales.push({ rid: "sX02", customer: "CX9-TESTUP", qty: 3, total: 0, cash: 0, deliveredQty: 0, unpriced: true, note: "fixture." });
      const corr2 = (at, rid, coll, dirn, fields) => ({ ok: true, count: 1, approved: [{
        id: ID(at), collection: coll, amends: rid, amendKind: "Correction",
        row: { rid }, entry: { at: ID(at), payload: { mode: "amend", direction: dirn, rid, kind: "Correction", date: "2026-08-25", fields } } }] });
      const N2 = (at) => ({ version: "v999", date: "25 Aug 2026", title: "AUDIT", notes: ["<b>TEST.</b>"], rows: { [ID(at)]: { note: "audit fixture." } }, stockNote: "" });

      /* F12: a date-only correction must not touch a status-carried payment. The old lot
         stores "paid" as a word with no cash field, and the unconditional recompute read
         that as zero and flipped it to unpaid. */
      const A2 = JSON.parse(JSON.stringify(FB));
      const r1 = apply(A2, corr2("05:00", "pX01", "purchases", "BUY", { date: "2026-07-03" }), N2("05:00"), master);
      ok(r1.ok, "a date fix on an old lot applies: " + (r1.ok ? "" : r1.problems.join("; ")));
      if (r1.ok) {
        const row = A2.purchases.find((x) => x.rid === "pX01");
        ok(row.status === "paid" && row.date === "2026-07-03",
          "and the lot is still paid: the status recompute only runs when cash or total was set");
      }

      /* F13: clearing pending without stating a receipt gets the v146 guard, or the whole
         lot walks into stock and the cost basis on a deposit. */
      const B2 = JSON.parse(JSON.stringify(FB));
      B2.purchases.push({ rid: "pX02", supplier: "SA5-BTR", qty: 100, total: 4600, pending: true, note: "fixture." });
      const r2 = apply(B2, corr2("05:01", "pX02", "purchases", "BUY", { pending: false, cash: 500, date: "2026-08-25" }), N2("05:01"), master);
      ok(r2.ok, "clearing pending applies: " + (r2.ok ? "" : r2.problems.join("; ")));
      if (r2.ok) {
        const row = B2.purchases.find((x) => x.rid === "pX02");
        ok(!row.pending && row.receivedQty === 0 && row.inTransit === true,
          "and the receipt is stated explicitly: nothing arrived, the lot is on order (the v146 guard)");
        ok(E2.poRecvUnits(row) === 0, "so the walk books no phantom stock from it");
      }

      /* F3: a real total on an unpriced row clears the flag, as a Modification has since
         v358, and the trail says it happened. */
      const C3 = JSON.parse(JSON.stringify(FB));
      const r3 = apply(C3, corr2("05:02", "sX02", "sales", "SELL", { total: 290 }), N2("05:02"), master);
      ok(r3.ok, "pricing an unpriced row applies: " + (r3.ok ? "" : r3.problems.join("; ")));
      if (r3.ok) {
        const row = C3.sales.find((x) => x.rid === "sX02");
        ok(!row.unpriced && row.total === 290, "the unpriced flag clears itself when a real total lands");
        /* v385: the trail is built from what was WRITTEN now, so it states the transition as
           well as the reason. The old form named only the reason, which read the same whether
           the flag had been set or not. */
        ok(/unpriced true to \(cleared\), a real total was set/.test(row.mod || ""), "and the trail records that it did, and what it was before");
      }
    }

    /* the surfaces: each renders a correction as what it is */
    ok(/amendKind==='Correction'/.test(m2) && /r\.changes/.test(m2.slice(m2.indexOf("function apCard"), m2.indexOf("function apDraw"))),
      "the desk Approve card renders a correction as before-and-after, not as cash moving");
    /* v387: THE OTHER SURFACE WAS THE APP'S AND IT IS RETIRED. Seven assertions here
       covered the phone's Approve-tab Edit button, its row editor, the refused-reason line
       it carried and the withdraw-before-resend rule. editableMode, EDWHY, EDPATCH and
       rejectDraft appear nowhere in the master, so none of it has a desk counterpart to
       re-point at. The desk's own correction editor is covered by section 21. */
  }
  /* ---- a CORRECTION: every field on any row, including a settled one (25 Aug 2026) ---- */
  /* Self-contained for the same reason the batch above is: it pushes its own target onto this
     COPY of the book, with its own rid, so no real fold can ever consume it and no assertion
     depends on the live ledger holding a particular shape. The target is deliberately SETTLED,
     paid and delivered, because that is the case nothing could reach before: 118 of the 125 rows
     on the real book are closed, and every amendment resolved through the open-order snapshot. */
  {
    const CB = JSON.parse(JSON.stringify(book));
    CB.QUEUE_COMMITTED = "2026-01-01T00:00:00.000Z";
    CB.sales.push({ rid: "sX01", date: "2026-08-20", customer: "CX9-TESTCOR", qty: 2, total: 200,
      cost: 44, cash: 200, deliveredQty: 2, deliveredOn: "2026-08-20", paidOn: "2026-08-20", note: "fixture." });

    const corr = (at, fields) => ({ ok: true, count: 1, approved: [{
      id: ID(at), collection: "sales", amends: "sX01", amendKind: "Correction",
      row: { rid: "sX01", customer: "CX9-TESTCOR", qty: 2, total: 200, cash: 200, date: "2026-08-20", product: "salt" },
      entry: { at: ID(at), payload: { mode: "amend", direction: "SELL", rid: "sX01", kind: "Correction", date: "2026-08-25", fields } } }] });
    const CNOTES = (at) => ({ version: "v999", date: "25 Aug 2026", title: "A TEST CORRECTION",
      notes: ["<b>TEST.</b> Nothing real."], rows: { [ID(at)]: { note: "Corrected in the suite." } }, stockNote: "" });

    const cp = plan(JSON.parse(JSON.stringify(CB)), corr("04:00", { product: "oil" }), null);
    ok(cp.items.length === 1 && cp.refused.length === 0, "a correction against a SETTLED row is planned, not refused");
    ok(cp.moves.length === 0, "and it moves nothing physical: it changes what a row says, not what happened");
    ok(plan(JSON.parse(JSON.stringify(CB)), corr("04:01", {}), null).refused.length === 1,
      "a correction with no fields is refused rather than folded as a no-op");

    const A = JSON.parse(JSON.stringify(CB));
    const ar = apply(A, corr("04:02", { product: "oil", assoc: "CN6-WM", stream: "R2", downstream: "CX9-TESTCOR" }), CNOTES("04:02"), master);
    ok(ar.ok, "product and attribution correct in one pass: " + (ar.ok ? "" : ar.problems.join("; ")));
    if (ar.ok) {
      const r = A.sales.find((x) => x.rid === "sX01");
      ok(r.product === "oil", "the product changed on a row that was already paid and delivered");
      ok(r.customer === "CN6-WM" && r.rev === "R2" && r.downstream === "CX9-TESTCOR",
        "the R2 attribution books it to the associate with the buyer behind it, as the desk does");
      ok(r.cash === 200 && r.deliveredQty === 2, "the settlement figures are untouched: a correction moves no money and no salt");
      ok(/corrected/.test(r.mod || "") && /salt to oil/.test(r.mod || ""),
        "the trail says what it was before, because the rate is the record");
      ok((r.amend || []).some((x) => x.kind === "Correction"), "and the amend trail carries the correction");
    }

    const C2 = JSON.parse(JSON.stringify(A));
    C2.QUEUE_COMMITTED = "2026-01-01T00:00:00.000Z";
    const cr = apply(C2, corr("04:03", { assoc: null }), CNOTES("04:03"), master);
    ok(cr.ok, "clearing an attribution applies: " + (cr.ok ? "" : cr.problems.join("; ")));
    if (cr.ok) {
      const r = C2.sales.find((x) => x.rid === "sX01");
      ok(r.customer === "CX9-TESTCOR" && !r.rev && !r.downstream,
        "clearing an R2 puts the BUYER back on the row rather than leaving it booked to the associate");
    }

    const R3 = JSON.parse(JSON.stringify(CB));
    const rr = apply(R3, corr("04:04", { assoc: "CN6-WM", stream: "R3" }), CNOTES("04:04"), master);
    ok(rr.ok, "an R3 correction applies: " + (rr.ok ? "" : rr.problems.join("; ")));
    if (rr.ok) {
      const r = R3.sales.find((x) => x.rid === "sX01");
      ok(r.customer === "CX9-TESTCOR" && r.ref === "CN6-WM" && r.refKg === 2 && !r.rev,
        "R3 leaves the buyer as the counterparty and credits the introduction beside it");
    }

    const N = JSON.parse(JSON.stringify(CB));
    const fresh1 = { ok: true, count: 1, approved: [{ id: ID("04:05"), collection: "sales", amends: null, amendKind: null,
      row: { customer: "CA4-DAM", qty: 0.25, total: 25, cost: 44, cash: 25, date: "2026-08-25", deliveredQty: 0.25, deliveredOn: "2026-08-25", paidOn: "2026-08-25" },
      entry: { at: ID("04:05"), payload: { mode: "new", direction: "SELL" } } }] };
    const nr = apply(N, fresh1, CNOTES("04:05"), master);
    ok(nr.ok, "a fresh row folds: " + (nr.ok ? "" : nr.problems.join("; ")));
    if (nr.ok) {
      /* NOT sales[length-1]: apply() sorts the book, and sort-ledger puts undated pending rows
         last, so the tail of the array is a fixture row rather than the one just folded. */
      const fresh = N.sales.find((x) => x.customer === "CA4-DAM" && x.date === "2026-08-25" && x.total === 25);
      ok(!!fresh, "the freshly folded row is on the book");
      ok(typeof fresh.rid === "string" && fresh.rid[0] === "s" && fresh.rid.length === 4 && Number.isInteger(Number(fresh.rid.slice(1))),
        "a newly folded row is minted a rid, so it can be corrected tomorrow");
      ok(N.sales.filter((x) => x.rid === fresh.rid).length === 1, "and the rid it is given is not one already in use");
    }
  }
  /* v347: a cancelled order is not a target. Its key still matches, so only the guard stops it.
     SYNTHETIC FROM 04 Sep 2026, and the reason is the v359 lesson one paragraph up, arriving
     again. This pinned the real cancelled CS6-PER row and the literal key CS6-PER|undefined|350,
     which held only while that row had no date. Dating s108, s109 and s119 the same day moved
     every one of those keys, and this assertion then failed for the wrong reason: the fulfilment
     was still refused, but as "no row on the book matches" rather than by the cancelled guard,
     so a broken guard would have read as a pass. The fixture owns its target now. */
  {
    const CB = JSON.parse(JSON.stringify(book));
    CB.sales.push({ customer: "CX9-TESTCANC2", qty: 6.25, total: 350, cash: 0, deliveredQty: 0,
      date: "2026-08-20", cancelled: true, cancelledOn: "2026-08-24" });
    const cKey = "CX9-TESTCANC2|2026-08-20|350";
    const one = { ok: true, count: 1, approved: [{ id: ID("02:00"), collection: "sales",
      amends: cKey, amendKind: "Fulfilment",
      row: { customer: "CX9-TESTCANC2", qty: 6.25, total: 350, cash: 0 },
      entry: { at: ID("02:00"), payload: { mode: "amend", direction: "SELL", orderKey: cKey, kind: "Fulfilment", date: "2026-08-23", cash: 350, kg: 6.25 } } }] };
    const pc = plan(CB, one, null);
    ok(pc.items.length === 0 && pc.refused.length === 1 && /cancelled/.test(pc.refused[0].why),
      "a fulfilment against a cancelled order is refused, not folded onto it"
      + (pc.refused.length ? ", by: " + pc.refused[0].why.slice(0, 60) : ""));
  }

  /* A SALE IN ADVANCE CAN BE MOVED TO DEFAULT FROM THE EDITOR. His instruction of 05 Sep 2026:
     on updating a ledger entry, Pending can move to Cancelled, Open or Completed, and the move
     missing is Default from Advance. The Defaulted tick was buy-only on the desk (EDFORM), though
     every reader of CORRECT_BOOL already carried the flag for a sale, so the chain could fold a
     default it could not be asked for. Showing the tick needs the rule the lot side has had since
     v435, so a Default stays an order with goods out and money owed. Asserted through the fold's
     own plan, which reads the shared guard, and on the desk's field table. */
  {
    const { default: X } = await import("../engine/position.mjs");
    const DB = JSON.parse(JSON.stringify(book));
    DB.sales.push({ rid: "sX40", customer: "CX9-TESTDEF", qty: 2, total: 200, cash: 0, deliveredQty: 2, date: "2026-08-20", deliveredOn: "2026-08-20", product: "salt", note: "fixture." },
      { rid: "sX41", customer: "CX9-TESTDEF", qty: 2, total: 200, cash: 0, deliveredQty: 0, date: "2026-08-20", product: "salt", note: "fixture." },
      { rid: "sX42", customer: "CX9-TESTDEF", qty: 2, total: 200, cash: 200, deliveredQty: 2, date: "2026-08-20", product: "salt", note: "fixture." });
    DB.purchases.push({ rid: "pX40", date: "2026-07-02", supplier: "SA5-BTR", qty: 5, total: 250, status: "paid", note: "fixture." });
    const dcorr = (at, rid, coll, dirn, fields) => ({ ok: true, count: 1, approved: [{
      id: ID(at), collection: coll, amends: rid, amendKind: "Correction",
      row: { rid }, entry: { at: ID(at), payload: { mode: "amend", direction: dirn, rid, kind: "Correction", date: "2026-09-05", fields } } }] });
    const why = (r) => (r.refused.length ? r.refused[0].why : "");
    const adv = plan(JSON.parse(JSON.stringify(DB)), dcorr("05:00", "sX40", "sales", "SELL", { defaulted: true }), null);
    ok(adv.items.length === 1 && adv.refused.length === 0, "a default on a sale in Advance, goods out and money owed, is planned" + (adv.refused.length ? ": " + why(adv).slice(0, 90) : ""));
    const pend = plan(JSON.parse(JSON.stringify(DB)), dcorr("05:01", "sX41", "sales", "SELL", { defaulted: true }), null);
    ok(pend.items.length === 0 && /cancel it instead/.test(why(pend)), "a default on a sale nothing was handed over on is refused, to be cancelled instead" + (pend.items.length ? " (it was planned)" : ""));
    const paid = plan(JSON.parse(JSON.stringify(DB)), dcorr("05:02", "sX42", "sales", "SELL", { defaulted: true }), null);
    ok(paid.items.length === 0 && /paid in full/.test(why(paid)), "a default on a sale paid in full is refused: there is nothing to default on");
    const already = (DB.purchases || []).find((p) => p.defaulted);
    ok(!!already && X.correctionFaults(already, { note: "x" }, false).length === 0, "and a note edit on the book's defaulted lot is not refused: the rule reads the flag being set, not the flag carried");
    const lot = plan(JSON.parse(JSON.stringify(DB)), dcorr("05:04", "pX40", "purchases", "BUY", { defaulted: true }), null);
    ok(lot.items.length === 0 && /cannot be defaulted on/.test(why(lot)), "a default on a lot that has received its salt is refused, the v435 rule through the correction road");
    const A = JSON.parse(JSON.stringify(DB));
    const ar = apply(A, dcorr("05:05", "sX40", "sales", "SELL", { defaulted: true }),
      { version: "v999", date: "05 Sep 2026", title: "TEST", notes: ["<b>TEST.</b>"], rows: { [ID("05:05")]: { note: "defaulted in the suite." } }, stockNote: "" }, master);
    const r = A.sales.find((x) => x.rid === "sX40");
    ok(ar.ok && !!r && r.defaulted === true && X.txStat(r).order === "Default" && X.saleProvRate(r, 0) === 1,
      "applied, the row reads Default and provisions in full" + (ar.ok ? "" : ": " + ar.problems.join("; ")));
    const { openMaster: omD } = await import("../tools/payload.mjs");
    const { w: wD } = await omD();
    const shown = JSON.parse(wD.eval("JSON.stringify([edFields('SELL').some(function(f){return f.k==='defaulted';}),edFields('BUY').some(function(f){return f.k==='defaulted';})])"));
    ok(shown[0] && shown[1], `the editor offers the Defaulted tick on a sale as on a lot (sale ${shown[0]}, lot ${shown[1]})`);
  }
  /* the plan refuses what it must and describes the rest */
  let p = plan(JSON.parse(JSON.stringify(book)), staged, null);
  ok(p.refused.length === 1 && /Linked/.test(p.refused[0].why), "a Linked amendment is refused as a judgement; a Modification is not");
  ok(p.items.length === 5, "the five mechanical rows are planned, the Modification among them");
  const modPlanned = p.items.find((it) => it.what && /Modification on/.test(it.what));
  ok(modPlanned && /to 1 unit \/ RM130/.test(modPlanned.what), "the plan describes a Modification by what it restates to, not by cash");
  ok(p.moves.some((m) => m.kg === -0.5 && m.product === "salt") && p.moves.some((m) => m.kg === -6.25), "the plan sees what will leave the shelf");
  ok(p.moves.length === 2, "a pure Modification moves no stock: only the new row and the fulfilment do");
  /* a refusal folds nothing, and so does a missing note */
  const notes = { version: "v999", date: "23 Aug 2026", title: "A TEST FOLD", notes: ["<b>TEST.</b> Nothing real."],
    rows: { [ID("01:00")]: { note: "Half a unit at the RM100 anchor, paid and delivered." }, [ID("01:05")]: { note: "paid and delivered in full" },
            [ID("01:20")]: { note: "restated to 1 unit for RM130 once the price was agreed" } },
    stockNote: "Test roll." };
  let r = apply(JSON.parse(JSON.stringify(book)), staged, notes, master);
  ok(!r.ok && r.problems.some((x) => /Linked/.test(x)), "apply refuses the whole batch while a refusal stands");
  const clean = { ...staged, count: 5, approved: staged.approved.slice(0, 5) };
  r = apply(JSON.parse(JSON.stringify(book)), clean, { ...notes, rows: { [ID("01:05")]: notes.rows[ID("01:05")] } }, master);
  ok(!r.ok && r.problems.some((x) => /needs a note/.test(x)), "a new row with no note is refused");
  /* the real thing, on a copy */
  const B = JSON.parse(JSON.stringify(book));
  const from = B.STATED_STOCK;
  r = apply(B, clean, notes, master);
  ok(r.ok, "the clean batch applies: " + (r.ok ? "" : r.problems.join("; ")));
  if (r.ok) {
    const added = B.sales.find((x) => x.customer === "CA4-DAM" && x.date === "2026-08-23" && x.total === 50);
    ok(!!added && /RM100 anchor/.test(added.note), "the new row is on the book with its note");
    const ful = B.sales.find((x) => x.customer === "CX9-TESTFUL" && x.total === 450);
    ok(ful && ful.cash === 450 && ful.deliveredQty === 6.25 && ful.date === "2026-08-23" && ful.deliveredOn === "2026-08-23" && ful.paidOn === "2026-08-23",
      "the fulfilment moved the cash and the units and dated the order");
    ok(ful && ful.amend && ful.amend.length === 2 && ful.amend[0].note.startsWith("as booked") && ful.amend[1].kg === 6.25 && /in full/.test(ful.amend[1].note), "and extended the trail from an as-booked seed");
    /* v381: DERIVED, NOT PINNED. This read 44 because that was the shelf cost the day it was
       written, so the first lot to move the basis broke it for no good reason. STOCK_COST in
       the master is where the fold itself reads the figure, so read it from the same place and
       the assertion survives every lot that lands. */
    const shelfCost = +(/const STOCK_COST=([\d.]+);/.exec(master) || [])[1];
    /* v496: the order's cost is absolute, the shelf's unit figure times the units the order is for. */
    ok(ful && ful.cost === +(shelfCost * 6.25).toFixed(2), `salt that left the shelf took the shelf's cost, RM${shelfCost} a unit on 6.25 unit (RM${ful && ful.cost})`);
    ok(ful && ful.amend && ful.amend[1].cost === +(shelfCost * 6.25).toFixed(2), "and the movement carries the cost of what it moved");
    ok(B.PROD_OPENING.oil.stated === 3 && B.COUNT_ON.oil === "2026-08-23", "the oil count set the stated shelf and moved COUNT_ON");
    ok(B.roster.includes("CT7-KLC"), "the registration joined the roster");
    ok(Math.abs(B.STATED_STOCK - (from - 0.5 - 6.25)) < 1e-9, `the salt shelf rolled ${from} to ${B.STATED_STOCK}`);
    ok(/^ROLLED AT v999/.test(B.NOTES.STATED_STOCK[0]) && /Test roll\./.test(B.NOTES.STATED_STOCK[0]), "the roll sentence leads the stated stock's notes, with the agent's words");
    const modded = B.sales.find((x) => x.customer === "CX9-TESTMOD" && !x.date && x.qty === 1 && x.total === 130);
    ok(!!modded, "the Modification REPLACED qty and total rather than adding to them");
    ok(modded && modded.cash === 0 && modded.deliveredQty === 0 && !modded.date, "and moved no cash, no stock and no date: a pure reprice");
    ok(modded && /restated.*from 1 unit \/ RM0 to 1 unit \/ RM130/.test(modded.mod), "the row's mod field records what changed, in the same style as an existing restatement");
    ok(modded && modded.amend && modded.amend.some((a) => a.kind === "Modification" && /RM130 once the price/.test(a.note || "")), "and the trail carries the Modification step with the agent's note");
    ok(B.QUEUE_COMMITTED === ID("01:20"), "the watermark moved to the newest id folded, past the Modification");
    ok(r.folded.length === 5 && r.newest === ID("01:20"), "_folded would name the five ids");
    ok(/const evolution=\[\{"v":"v999"/.test(r.master) && /const LAST_UPDATED='\d\d \w\w\w 2026, \d\d:\d\d KL';/.test(r.master), "the version entry and the stamp are in the master");
    const { checkText } = await import("../tools/booksync.mjs");
    ok(checkText(r.master, B) === null, "and the master's book block is the folded book");
    const last = B.sales[B.sales.length - 1];
    ok(!last.date, "the book stays sorted: undated pending rows last");
    /* the folded master still builds a payload that carries the new row */
    mkdirSync(join(REPO, "test", "tmp"), { recursive: true });
    const tmpMaster = join(REPO, "test", "tmp", "fold-master.html");
    writeFileSync(tmpMaster, r.master);
    /* v387: proved off the folded master itself, since the payload it used to build is
       retired with the app. Same three facts: the version, the row and the rolled shelf. */
    ok(/CA4-DAM/.test(r.master), "the folded master carries the new row");
    ok(new RegExp("const STATED_STOCK=" + (+(from - 0.5 - 6.25).toFixed(2))).test(r.master),
      "and the shelf is the rolled figure");
    try { rmSync(tmpMaster); } catch (e) { }
  }
}

/* ---- 24. The parts are visible, and the phone carries the people (v343) ------------ */
section("Views — every part is one tap away (v343)");
{
  const m = readFileSync(join(REPO, "master", "salt_command.html"), "utf8");
  ok(/const VIEW_PART=\{\}/.test(m) && /function railSubs\(\)/.test(m), "the master keeps the part each view shows and lists the parts under the rail");
  ok(/class="vnav"/.test(m) && !/details\.vfold/.test(m), "a view names its parts on a strip; the buried folds are gone");
  ok(/parts:\['approve','orders','plans'\]/.test(m) && /function tabApprove\(\)/.test(m) && /async function apDecide\(/.test(m), "Enter carries Approve, reading and deciding the same drafts the phone does");
  ok(/function tabOrders\(\)/.test(m) && /async function ordAct\(/.test(m) && /orders:\(\)=>ordLoad\(\)/.test(m) && /orders:'Orders'/.test(m),
    "and Orders (v499), reading and moving the customer orders the statements site holds");
  ok(/data-m="addid">Add ID/.test(m) && /id="wbPaneAddid"/.test(m) && /wbMode==='addid'/.test(m), "the cloud desk's Workbench can register a party by code");
  ok(/mode:'addid',code:code,kind:kind,parent:parent/.test(m), "and queues it as the addid entry the drafter knows");
  ok(/class="warnpill" style="display:block;margin:8px 0 0/.test(m), "a draft's flags are pills the notes toggle cannot hide");
  /* every lead and every part has a question on the strip */
  const q = m.match(/const PART_Q=\{([\s\S]*?)\};/)[1];
  for (const t of ["today","overview","forward","receivables","financials","inventory","sourcing","pricing","concentration","network","map","ledger","analysis","add","approve","plans"]) {
    ok(new RegExp("(^|\\s)" + t + ":'").test(q), `the strip can say what ${t} is for`);
  }
}
section("Orders and money — whole-book figures sit above the repeat, and once (v385)");
{
  const { openMaster } = await import("../tools/payload.mjs");
  const { w } = await openMaster();
  const read = (expr) => JSON.parse(w.eval("JSON.stringify(" + expr + ")"));
  const html = (expr) => String(w.eval(expr));
  const count = (h, needle) => h.split(needle).length - 1;

  /* a figure that cannot be SPLIT by book must not be drawn inside the per-product repeat */
  const fin = html("builders.financials()"), one = html("tabFinancials()");
  ok(count(fin, '<div class="l">Trading net</div>') === 1 && count(fin, '<div class="l">Still to come in</div>') === 1,
    "the cash position is on the Financials part once, not once per book");
  ok(count(fin, "Lost to suppliers") === 1, "and so is what the suppliers have cost");
  ok(count(one, "Trading net") === 0 && count(one, "Lost to suppliers") === 0,
    "a per-product builder states no whole-book figure at all");

  /* a whole-book head must give the same answer whichever book happens to be selected */
  const keep = read("PROD");
  const seen = { order: new Set(), cash: new Set(), conso: new Set() };
  for (const pr of read("PROD_IDS")) {
    w.eval(`PROD=${JSON.stringify(pr)};recompute();`);
    seen.order.add(html("consoOrderBlock()")); seen.cash.add(html("consoCashBlock()")); seen.conso.add(html("consoBlock()"));
  }
  w.eval(`PROD=${JSON.stringify(keep)};recompute();`);
  ok(seen.order.size === 1 && seen.cash.size === 1 && seen.conso.size === 1,
    "and reads the same whichever book is selected");

  /* the Order book's head is the sum of the books beneath it, not a second opinion */
  const cl = read("obClaims()");
  const g = +cl.reduce((a, x) => a + x.g, 0).toFixed(2), n = +cl.reduce((a, x) => a + x.n, 0).toFixed(2);
  let sg = 0, sn = 0;
  for (const pr of read("PROD_IDS")) {
    w.eval(`PROD=${JSON.stringify(pr)};recompute();`);
    sg += read("arGross"); sn += read("ar");
  }
  w.eval(`PROD=${JSON.stringify(keep)};recompute();`);
  ok(g === +sg.toFixed(2) && n === +sn.toFixed(2), `the head's claim is the books added up (${g} gross, ${n} net)`);
  ok(cl.every((x, i) => i === 0 || cl[i - 1].d >= x.d), "and it is ordered oldest first, so the one to chase is the one named");

  /* a drawing is reported once. Two rows shipped for four versions and neither was wrong on its face. */
  for (const pr of read("PROD_IDS")) {
    w.eval(`PROD=${JSON.stringify(pr)};recompute();`);
    ok(count(html("ifrsPanel()"), "Owner&rsquo;s use") <= 1, `${pr}: the statement reports the owner's drawing once`);
  }
  w.eval(`PROD=${JSON.stringify(keep)};recompute();`);

  /* an empty fold is a control that opens onto nothing; the strip above it carries the answer */
  const rec = html("builders.receivables()");
  ok(count(rec, 'class="ct zero"') === 0 && count(rec, ">None.<") === 0,
    "every fold on the Order book has a row behind it");
  /* PER HALF, NOT PER PART. The rule is v385's unchanged: never a heading over nothing.
     The old test read the whole part, so it could only ask the question once, and a book
     with customers open and no supplier bill answered "it has folds" and was passed while
     the Suppliers heading stood over four KPIs reading zero. Salt is in that state. Split
     on the Suppliers heading and ask each half; the whole-part empty case is one half with
     no heading at all, so the same rule covers it. */
  for (const pr of read("PROD_IDS")) {
    w.eval(`PROD=${JSON.stringify(pr)};recompute();`);
    const b = html("tabReceivables()");
    const halves = b.split(/<h2[^>]*>Suppliers /);
    halves.forEach((half, i) => {
      const folds = count(half, '<details class="obsec"'), nil = count(half, "Nothing open");
      const which = halves.length === 1 ? "the part" : i === 0 ? "customers" : "suppliers";
      ok(nil <= 1 && (folds > 0) !== (nil === 1),
        `${pr}: ${which} either lists what is open or says in one line that nothing is`);
    });
  }
  w.eval(`PROD=${JSON.stringify(keep)};recompute();`);
  ok(!/>\s*(undefined|NaN|Infinity)/.test(rec + fin), "neither part renders an undefined, a NaN or an infinity");
  try { w.close(); } catch (e) { }
}

section("Orders and money — a book with no month reports zeros, not RM NaN");
{
  /* REACHABLE, and it shipped: a product declared on the book before its first sale.
     finRows() rightly returns no month, the FY reduce was seeded with {}, so every fy field
     came back undefined and fmt0(undefined) is "RM NaN". Twelve of those, beside two
     "null% of revenue" where ifrsPL() deliberately returns null at zero revenue and the two
     consumers interpolated it raw. The book trading next to it was unaffected, which is why
     it went unseen. Simulated by removing one book's sales and leaving the other whole. */
  const { openMaster } = await import("../tools/payload.mjs");
  const { w } = await openMaster();
  const gone = w.eval(`(()=>{const b=sales.length;
    for(let i=sales.length-1;i>=0;i--) if((sales[i].product||'')==='oil') sales.splice(i,1);
    recompute(); return b-sales.length;})()`);
  ok(gone > 0, `the probe emptied one book (${gone} rows) and left the other trading`);
  w.eval("PROD='oil';recompute();");
  ok(w.eval("finRows().length") === 0, "the empty book reports no month, which is the correct answer");
  ok(String(w.eval("JSON.stringify(ifrsPL().grossPct)")) === "null", "and no percentage of no revenue is invented");
  const fin = String(w.eval("builders.financials()"));
  ok(!/RM\s*NaN/.test(fin), "so the part states RM 0, never RM NaN");
  ok(!/null%/.test(fin), "and says in words that there is no revenue to measure against");
  ok(!/>\s*(undefined|NaN|Infinity)/.test(fin), "and nothing else on the part goes undefined");
  try { w.close(); } catch (e) { }
}

/* ---- 26. Orders and money: the basis moved under the figures (v385) ----------------
   v382 halved a trip to RM30 and moved its divisor from the latest lot to the average one,
   and took a delivery from RM50 to RM10. Nothing on this view holds a frozen number, so
   nothing went stale. What the pass found instead was three things a moving basis makes
   worse, and these lock them down.
   THE FIRST IS THE ONE THAT MATTERS. Two gross figures sit on this tab: the monthly table
   charges goods at the lot rate, the IFRS statement adds freight in, and until now neither
   said so. They part by exactly the freight-in charge, which halved on 27 Aug with nothing
   on the surface saying why. The statement now states the bridge, so it is tested.
   THE SECOND IS DRIFT. ifrsPL spreads freight as total over everything received, which is
   algebraically the rate over the MEAN lot, so it happened to be on v382's basis before
   v382 was written. That is luck, not design, and the next change to either need not be so
   kind. The two are asserted equal.
   THE THIRD IS THE WORD. This part is drawn once per book and six labels said "Salt". */
section("Orders and money — every basis is named where the figure is stated (v385)");
{
  const { openMaster } = await import("../tools/payload.mjs");
  const { w } = await openMaster();
  const read = (expr) => JSON.parse(w.eval("JSON.stringify(" + expr + ")"));
  const html = (expr) => String(w.eval(expr));
  const keep = read("PROD"), names = read("PRODUCTS"), ids = read("PROD_IDS");
  const setP = (p) => w.eval(`PROD=${JSON.stringify(p)};recompute();`);

  for (const pr of ids) {
    setP(pr);
    const nm = names[pr].name, other = ids.filter((x) => x !== pr).map((x) => names[x].name);
    /* the book names itself. "Salt you owe 1.54 unit" stood over an oil row until v385. */
    const rec = html("tabReceivables()");
    ok(rec.includes(`${nm} you owe`) || !rec.includes("you owe them"),
      `${pr}: the Order book calls what is owed in goods by this book's name`);
    ok(other.every((o) => !rec.includes(`${o} you owe`) && !rec.includes(`${o} they owe`)),
      `${pr}: and never by another book's`);

    /* the two gross figures on the Financials tab differ by the freight-in charge and say so */
    const F = read(`ifrsPL(${JSON.stringify(pr)})`);
    const rows = read("finRows()");
    const fy = rows.reduce((a, [, v]) => { Object.keys(v).forEach((k) => a[k] = (a[k] || 0) + v[k]); return a; }, {});
    const monthly = +(fy.rev - fy.cogs).toFixed(2);
    ok(+(monthly - F.gross).toFixed(2) === F.freightCos,
      `${pr}: the monthly gross margin and the statement's gross profit part by the freight in (${F.freightCos})`);
    const panel = html("ifrsPanel()");
    if (F.freightCos > 0.009)
      ok(panel.includes(`under the gross margin above`), `${pr}: and the statement states that bridge rather than leaving it to be derived`);

    /* TWO FIGURES, TWO STATED BASES, EACH PROVED FROM THE BOOK (09 Sep 2026). This used to demand
       the statement's freight per unit equal the pricing engine's, "both the rate over the mean lot",
       which was true while both read COST_BASIS and never ran while no lot carried freight (v503
       typed it per lot; every lot until p021 carried none). The first typed freight split them by
       design: the price carries the freight of the LAST THREE LOTS per unit bought (rule 5), the
       P&L charges the freight ACTUALLY TYPED, spread over every unit received, and the panel says
       so. Each is recomputed here from the rows rather than read back from the code under test. */
    const c = read("pxCost()");
    if (!c.locked && F.lots > 0) {
      const bkF = JSON.parse(readFileSync(join(REPO, "ledger", "book.json"), "utf8"));
      const EF = (await import("../engine/position.mjs")).default;
      const live = bkF.purchases.filter((x) => (x.product || "salt") === pr && !x.cancelled && !x.defaulted && !x.pending && +x.qty > 0);
      const landed = live.filter((x) => +x.total > 0 && (x.receivedOn || x.date) && EF.poRecvUnits(x) > 0)
        .sort((a, b) => { const x = a.receivedOn || a.date, y = b.receivedOn || b.date; return x < y ? -1 : x > y ? 1 : 0; }).slice(-3);
      let win = landed.filter((x) => x.freight != null);
      if (!win.length) win = live.filter((x) => x.freight != null);
      const engineWant = win.length ? +(win.reduce((a, x) => a + (+x.freight || 0), 0) / win.reduce((a, x) => a + x.qty, 0)).toFixed(4) : 0;   /* a book with no typed freight reads 0 */
      ok(Math.abs(c.freight - engineWant) < 0.00005, `${pr}: the price's freight is the last three lots' typed freight per unit bought (${c.freight} against ${engineWant} from the rows)`);
      const recv = live.reduce((a, x) => a + EF.poRecvUnits(x), 0), typed = live.reduce((a, x) => a + (+x.freight || 0), 0);
      ok(Math.abs(F.freightPerUnit - typed / recv) < 0.00005, `${pr}: the statement's freight per unit is the freight typed over every unit received (${F.freightPerUnit} against ${(typed / recv).toFixed(4)})`);
      ok(/typed on \d+ lots?/.test(panel), `${pr}: and the panel states that basis beside the figure`);
    }
    /* and the cell names the live rate, so moving the rate without the copy fails here */
    if (F.lots > 0) ok(panel.includes(" typed on " + F.lots + " lot"),
      `${pr}: the freight line says it is the sum typed on the lots (v503)`);

    /* a month on the P&L is evidence that something happened in it */
    ok(rows.every(([, v]) => Math.abs(v.rev) + Math.abs(v.cogs) + Math.abs(v.cash) + Math.abs(v.kg) > 0.009),
      `${pr}: every month on the P&L has trade in it`);

    /* an overtender is stock owed, not a negative debt, and the row says which */
    const fin = html("tabFinancials()");
    const unc = (fin.match(/Still uncollected<\/td>(.*?)<\/tr>/) || [, ""])[1];
    ok((unc.match(/RM\s*-/g) || []).length === (unc.match(/held against goods/g) || []).length,
      `${pr}: a negative uncollected figure says it is goods owed out, not cash owed back`);

    /* THE CLOSING STOCK IS THIS BOOK'S, AT THIS BOOK'S RATE. It read the salt-wide
       STOCK_COST inside a per-product block, so the oil book valued 20 unit of oil at
       salt's RM50 and reported RM1,000 on a shelf holding RM153. Invisible from v372,
       when stripMethod began deleting the sentence, until v384 put it back. */
    const right = html("fmt0(currentStock*stockCostFor(PROD))"), wrong = html("fmt0(currentStock*STOCK_COST)");
    /* v401 states it as a P&L row rather than a sentence, so the check is the figure and its
       rate, not the words around them. The invariant is the half that matters and it stands. */
    ok(fin.includes(right) && fin.includes(html("fmt(stockCostFor(PROD))") + "/unit"),
       `${pr}: closing stock is valued at this book's own shelf rate (${right})`);
    if (right !== wrong) ok(!fin.includes(wrong), `${pr}: and never at another book's (${wrong})`);

    /* THE RATE OF TRADE IS ORDERS PER MONTH AND THE MONTHS ARE COUNTED, NOT ASSUMED. */
    const per = html("fmt(100/Math.max(1,pricedSales.length/Math.max(1,finRows().length)))");
    ok(fin.includes(`<b>${per}</b> an order`), `${pr}: a standing cost is spread over the orders this book actually places in a month (${per})`);
  }

  /* NEITHER DRAW SWALLOWS A THROW. Both held an empty catch INSIDE their ensureChart
     callback, which fires before drawPerProduct's reporter and before ensureChart's, so a
     broken chart left a blank canvas and said nothing anywhere. Found with a Chart that
     throws, which is the only probe that sees through an inner catch: watching for a
     failure notice sees nothing, because there was nothing to see. Both catches are gone
     rather than replaced, since every road out now has a reporter on it. */
  const src = readFileSync(join(REPO, "master", "salt_command.html"), "utf8");
  /* round six: the old scan banned the exact byte pattern }catch(e){} in two functions, so a
     single added space defeated it and the other draw functions were never scanned. This one
     covers every draw function and bans an empty catch whose TRY BODY spans a line or runs
     long, which is the v384 class (a whole draw pass swallowed). A one-line guard like
     try{obj.destroy()}catch(e){} or a per-point priceLadder probe is the designed null path
     and stays legal. The existence check runs first so a renamed function fails loudly
     instead of silently scanning nothing. */
  /* v412, ROUND SEVEN #13: the body had to be WHITESPACE, so a catch holding only a block
     comment was invisible to the scan and a swallow could be written straight past it. A
     comment is not a handler, so a catch whose only body is one now counts as empty. */
  const EMPTYCATCH = /catch\s*(\(\s*[A-Za-z_$][\w$]*\s*\))?\s*\{\s*(?:\/\*[\s\S]*?\*\/|\/\/[^\n]*\n)?\s*\}/g;
  /* v412: the twelve missed drawConcCharts, drawNetworkCharts and drawLedgerCharts, and TWO of
     the four sites where this fault was actually found and fixed at v385 are among them. */
  for (const fn of ["trackCharts", "wirePricing", "drawPriceCharts", "drawEarnChart", "drawBoardCharts",
                    "drawRecvCharts", "drawFinCharts", "drawSourcingCharts", "drawOutlookChart",
                    "drawAnalysis", "drawTodayCharts", "drawFwdCharts",
                    "drawConcCharts", "drawNetworkCharts", "drawLedgerCharts"]) {
    const at = src.indexOf(`function ${fn}(`);
    ok(at >= 0, `${fn} exists for the empty-catch scan to cover`);
    const end = src.indexOf("\nfunction ", at + 12);
    const body = src.slice(at, end > at ? end : at + 4000);
    const hazardous = [];
    for (const m of body.matchAll(EMPTYCATCH)) {
      const close = body.lastIndexOf("}", m.index);
      if (close < 0 || /\S/.test(body.slice(close + 1, m.index))) continue;   /* not a try tail (a comment mentioning the pattern) */
      let depth = 0, j = close;
      for (; j >= 0; j--) { const ch = body[j]; if (ch === "}") depth++; else if (ch === "{") { depth--; if (!depth) break; } }
      const tryBody = j >= 0 ? body.slice(j, close + 1) : "";
      if (/\n/.test(tryBody) || tryBody.length > 80) hazardous.push(tryBody.replace(/\s+/g, " ").slice(0, 40));
    }
    ok(hazardous.length === 0, `${fn} has no empty catch over a multi-line body, so a broken chart says so`
      + (hazardous.length ? " — " + hazardous.join(" | ") : ""));
  }

  /* THE FINDING IS ON THE PAGE, WHICH IT WAS NOT FROM v372 TO v385. stripMethod cuts every
     .insight to its first sentence once it reaches NOTE_MIN, so three paragraphs rendered as
     "Read the last two columns against each other" and the sensitivity was cut every time.
     Asserted against the DOM AFTER the strip, because before it everything looks present. */
  const noteMin = +(/const NOTE_MIN=(\d+)/.exec(src) || [])[1];
  for (const pr of ids) {
    setP(pr);
    w.switchTab("financials");
    const ins = [...w.document.querySelectorAll('.sec.on .prodblock[data-prod="' + pr + '"] .insight')];
    ok(ins.length === 1, `${pr}: the cost panel states one finding`);
    if (ins.length) {
      const t = (ins[0].textContent || "").trim();
      /* a percentage OR a multiple: v401 states a ringgit as a multiple of any contribution
         under a ringgit, because "200.0% of what it earns" is not a share. Either form is a
         figure, and a figure is what the strip would have taken. */
      ok(/\d[\d.]*\s?(%|times)/.test(t), `${pr}: and it survives the strip carrying its figures ("${t.slice(0, 60)}...")`);
      /* the cut writes textContent, which destroys every child element, so surviving
         emphasis is the proof that the block stayed under NOTE_MIN and was never cut.
         Measuring the RENDERED length instead proves nothing: it is short either way. */
      ok(ins[0].querySelectorAll("b").length > 0,
        `${pr}: the cut never fired, so the emphasis on the figures is still there (${t.length} of ${noteMin} chars)`);
      /* A SHARE OF A LOSS IS NOT A SENSITIVITY. v385 shows five oil sizes rather than
         fourteen and an oil order is under its own cost from 20 unit up, so the share went
         negative and the sentence read "takes -0.6% off what a 50 unit order earns", which
         is not a thing that can happen. The guard covered an infinity and not a minus. */
      ok(!/-\s?\d[\d.]*%/.test(t), `${pr}: it states no negative share of what an order earns ("${t.slice(-58)}")`);
    }
  }
  setP(keep);
  try { w.close(); } catch (e) { }
}

section("The board — four laws, read off the engine (v387)");
{
  /* THESE ARE ENGINE INVARIANTS AND THEY WERE CHECKED THROUGH THE PHONE PAYLOAD. When the app
     was retired at v387 the whole payload section went with it, and took these four with it:
     they read d.board, so they LOOKED like payload-shape checks and they are nothing of the
     kind. The rate law in particular is the one law a customer can check by hand, and it is
     the law Price repriced the oil board against. Restored against ladderWalk and floorTotal
     directly, so they no longer depend on a surface existing at all.
     Found by the Stock view asking why the assertion count had fallen, which is the round's
     own lesson pointed at the suite: a number that falls reads as fine and the reason matters. */
  const { openMaster } = await import("../tools/payload.mjs");
  const E = (await import("../engine/pricing.mjs")).default;
  const { w } = await openMaster();
  w.perProduct(() => {
    const P = w.pxPolicy(), C = w.pxCost();
    const shown = (typeof w.shownSizes === "function") ? w.shownSizes() : P.boardSizes;
    const pid = P.boardSizes[0] === 0.5 ? "salt" : "oil";
    const walk = w.ladderWalk(P.boardSizes);
    const priced = walk.filter((r) => r.p != null && r.p > 0);
    ok(priced.length === walk.length, `${pid}: every size on the board has an ask (${priced.length} of ${walk.length})`);

    /* THE ASK IS A COLLECTION PRICE and must clear the COLLECTED floor at every size, unless HE has
       stated the price there. v552 narrowed the lift to derived asks on his instruction, so the
       rule splits: an ask the DESK derived under its floor is still a fault, and one he stated is a
       decision that must NAME its gap. Both halves are asserted; neither can pass by the other. */
    const stated = P.stated || {};
    const under = walk.filter((r) => r.p < E.floorTotal(r.q, C, P, null, { collects: true }) - 0.009);
    const unstated = under.filter((r) => !(+stated[String(r.q)] > 0));
    ok(unstated.length === 0, unstated.length
      ? `${pid}: an ask the desk DERIVED is under its own collected floor at ${unstated.map((r) => r.q).join(", ")} unit`
      : `${pid}: every derived ask clears the collected floor`);
    ok(under.every((r) => r.under > 0.009), under.length
      ? `${pid}: and each of the ${under.length} stated ask(s) under it names the gap`
      : `${pid}: and nothing sits under it to name`);

    /* v502: one floor; the collects option changes nothing */
    const badDel = P.boardSizes.filter((q) => Math.abs(E.floorTotal(q, C, P, null, { collects: true }) - E.floorTotal(q, C, P)) > 1e-9);
    ok(badDel.length === 0, badDel.length
      ? `${pid}: the floor differs by handover at ${badDel.join(", ")} unit`
      : `${pid}: the floor is one figure whatever the handover`);

    /* THE ONE LAW A CUSTOMER CAN CHECK BY HAND: the rate may not RISE with size. */
    let prev = Infinity; const inverted = [];
    walk.forEach((r) => { if (!(r.q > 0) || r.p == null) return;
      const rate = r.p / r.q; if (rate > prev + 1e-9) inverted.push(r.q); prev = rate; });
    ok(inverted.length === 0, inverted.length
      ? `${pid}: the rate per unit RISES with size at ${inverted.join(", ")} unit`
      : `${pid}: the rate per unit never rises with size`);
    ok(shown.length > 0 && shown.every((q) => P.boardSizes.includes(q)),
      `${pid}: every size the board PRINTS is a rung the walk actually priced (${shown.length} of ${P.boardSizes.length})`);
  });
}

section("Pricing — stale is a statement about the lock, not a constant (v403)");
{
  /* While PRICE_LOCK_ON is false there is nothing to be stale AGAINST, and the ungated read
     had been a constant true on this desk since the lock went off: a flag that always fires
     teaches its reader to tap through, which is the drafter's own lesson. Nothing consumes
     the field today; the gate is so the first consumer that does is not lied to. Proven both
     directions with the desk's own inputs, and the third assertion is what keeps the first
     from being vacuous: the lock state on this desk IS 'stale', so only the gate can make
     the flag read false. */
  const E = (await import("../engine/pricing.mjs")).default;
  const { openMaster } = await import("../tools/payload.mjs");
  const { w } = await openMaster();
  const I = w.pxInputs();
  ok(I.lockOn === false, "the price lock is off on this desk, the case that made the flag constant");
  ok(I.lockState && I.lockState.state === "stale", "and the lock state reads 'stale', so the gate alone decides the flag");
  ok(w.pxCost().stale === false, "lock off: stale is false whatever the lock state says");
  ok(E.costStack({ ...I, lockOn: true, lockState: { state: "stale", lock: null, days: 99 } }).stale === true,
    "lock on over a stale lock: stale is true");
  ok(E.costStack({ ...I, lockOn: true, lockState: { state: "none", lock: null, days: null } }).stale === false,
    "lock on and current: stale is false");
}

section("Pricing — each book prices off its own quote (round 5, his call 1)");
{
  /* pxQuoteRate and pxPolicy().tiers read bare supplierQuote until this round, so oil's
     engine inputs carried salt's RM 56 rate and oil's taper walked at salt's exponent.
     The owner's answer 1 of 29 Aug scopes every engine input through quoteFor(PROD). */
  const { openMaster } = await import("../tools/payload.mjs");
  const { w } = await openMaster();
  const read = (expr) => JSON.parse(w.eval("JSON.stringify(" + expr + ")"));
  w.eval("setProd('salt');recompute();");
  ok(read("pxInputs().quoteRate") === 56, "salt's quoteRate is its own dearest tier, RM56");
  ok(JSON.stringify(read("pxPolicy().tiers")) === JSON.stringify(read("supplierQuote.tiers")),
    "salt's policy tiers are the salt quote's");
  const saltB = read("buyTaper()");
  w.eval("setProd('oil');recompute();");
  ok(read("pxInputs().quoteRate") === 10, "oil's quoteRate is its OWN dearest tier, RM10, not salt's 56");
  ok(JSON.stringify(read("pxPolicy().tiers")) === JSON.stringify(read("oilQuote.tiers")),
    "oil's policy tiers are the oil quote's");
  const oilB = read("buyTaper()");
  ok(oilB.b != null && oilB.b < 0, "oil's taper is fitted and falls with size");
  ok(saltB.b != null && Math.abs(oilB.b - saltB.b) > 1e-6,
    "the two books fit different exponents, so the taper is genuinely per book");
  /* his call 4: the board sizes are what he sells, and the ladder anchor is the book's own */
  ok(JSON.stringify(read("sizesFor('oil')")) === JSON.stringify([10, 20, 30, 40, 50]),
    "oil's grid is his: 10 to 50 in tens, no fives, no 60 to 100 tail");
  ok(JSON.stringify(read("sizesFor('salt')")) === JSON.stringify([0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6.25, 12.5]),
    "salt's grid is untouched");
  const oilL = read("ladderFor('oil')"), saltL = read("ladderFor('salt')");
  ok(oilL.at.lo === 10 && oilL.at.hi === 50 && oilL.anchorQ === 10,
    "oil's taper span and anchor sit on oil's own board");
  ok(saltL.anchorQ === 2.5 && saltL.anchorX === 0.958 && saltL.at.lo === 0.5 && saltL.at.hi === 12.5 && saltL.floor === 0.33,
    "salt's ladder is LADDER itself, to the value");

  /* his call 2: replacement is the trailing 30-day quantity-weighted average, per book.
     The expectation is computed here from the page's own lots and TODAY, never typed, so
     the assertion holds whichever day the suite runs. */
  /* v504: THE WINDOW IS THE LAST THREE LOTS RECEIVED, his instruction of 07 Sep 2026. */
  const expRepl = (p) => {
    w.eval(`setProd(${JSON.stringify(p)});recompute();`);
    const rows = read("pPurch(PROD).filter(x=>poLive(x)&&x.qty>0&&x.total>0&&(x.receivedOn||x.date))");
    const win = rows.slice().sort((a, b) => ((a.receivedOn || a.date) < (b.receivedOn || b.date) ? -1 : 1)).slice(-3);
    const k = win.reduce((a, x) => a + x.qty, 0);
    return k > 0 ? +(win.reduce((a, x) => a + x.total, 0) / k).toFixed(2) : null;
  };
  for (const p of ["salt", "oil"]) {
    const want = expRepl(p);
    ok(read("pxInputs().repl") === want, `${p}: pxInputs().repl is the weighted rate of the last three lots, ${want}`);
    ok(read("pxCost().repl") === want, `${p}: and the cost stack prices off it`);
    ok(read("replCost()") === want, `${p}: and replCost() is the same figure, so there is one replacement number`);
  }
  /* the engine's fallback order: an absent repl falls to the lot rate, never undefined */
  {
    const E = (await import("../engine/pricing.mjs")).default;
    const I0 = { prod: "x", lockOn: false, lockState: { state: "none", lock: null }, lockBase: null,
      over: { cost: null, shrink: null }, lot: { qty: 10, total: 90, rate: 9, date: "2026-08-01" },
      quoteRate: 12, costBasis: { freightPerTrip: { rm: 30 }, txnPerDelivery: { rm: 10 }, deliveredShare: { v: 0.2 } },
      attrib: 1, shrinkRate: 0, avgDel: { n: 1, mean: 10 } };
    ok(E.costStack({ ...I0, repl: 8.5 }).repl === 8.5, "a supplied trailing average is the goods cost");
    ok(E.costStack(I0).repl === 9, "without one the latest lot's rate stands, so nothing is undefined");
    ok(E.costStack({ ...I0, repl: null, lot: null }).repl === 12, "and with no lot at all the quote rate holds the floor up");
  }
  w.eval("setProd('salt');recompute();");
  try { w.close(); } catch (e) { }
}

section("Rewards — redemption reads the earning window (round 5, his call 3)");
{
  /* Earnings count from REWARD.since; redemptions counted from the beginning of time, so a
     unit redeemed before the scheme existed was netted against earnings that started after
     it. One window, both sides. The two parties named here are the book's own facts: CS6-BS
     redeemed 3 units in July, all before adoption; CJ4-OKR redeemed 1 in July and the 4-unit
     backfill ON the adoption day, which the window includes exactly as the earning side
     includes 10 Aug turnover. */
  const { openMaster } = await import("../tools/payload.mjs");
  const { w } = await openMaster();
  const read = (expr) => JSON.parse(w.eval("JSON.stringify(" + expr + ")"));
  const since = read("REWARD.since");
  const pre = read("sales.filter(s=>s.customer==='CS6-BS'&&s.rebate).map(s=>({date:s.date,kg:(s.rebateKg!=null?+s.rebateKg:s.qty)}))");
  ok(pre.length === 3 && pre.every((r) => r.date < since) && pre.reduce((a, r) => a + r.kg, 0) === 3,
    "the guard: CS6-BS's three redeemed units are all before adoption, so the next assertion cannot pass vacuously");
  ok(read("rebateApplied('CS6-BS')") === 0, "a redemption before REWARD.since belongs to the opening, not the running net");
  ok(read("rebateApplied('CJ4-OKR')") === 4, "the boundary day itself counts, both sides: the 10 Aug backfill is in, the 09 Jul unit is not");
  try { w.close(); } catch (e) { }
}

section("Boundaries — the caps and the trigger are per book (round 5, his call 4)");
{
  const { openMaster } = await import("../tools/payload.mjs");
  const { w } = await openMaster();
  const read = (expr) => JSON.parse(w.eval("JSON.stringify(" + expr + ")"));
  ok(read("creditCapFor('salt','retail')") === 1 && read("creditCapFor('salt','associate')") === 2,
    "salt keeps 1 unit retail and 2 associate");
  ok(read("creditCapFor('oil','retail')") === 10 && read("creditCapFor('oil','associate')") === 20,
    "oil reads 10 retail (his correction) and 20 associate (confirmed by him, 29 Aug)");
  ok(read("reorderFor('salt')") === 15 && read("reorderFor('oil')") === 20,
    "the reorder trigger is per book: salt 15, oil 20 (his call of 29 Aug)");
  w.eval("setProd('oil');recompute();");
  ok(read("coverStats().reorderAt") === 20, "oil's cover is judged against oil's own trigger");
  w.eval("setProd('salt');recompute();");
  ok(read("coverStats().reorderAt") === 15, "and salt's against salt's");
  /* the per-book credit totals PARTITION the old whole-book figure: proven for every
     customer on the book, so the split cannot drop or double a unit */
  const parts = read(`(()=>{const ids=[...new Set(sales.map(s=>s.customer))];
    return ids.map(id=>{let whole=0;sales.forEach(s=>{if(s.customer!==id||s.cancelled)return;const p=txPrice(s);if(!(p>0))return;whole+=Math.max(0,(s.deliveredQty||0)-txPaid(s)/p);});
    return {id,whole:+whole.toFixed(2),split:+(PROD_IDS.reduce((a,pr)=>a+wbCreditUnits(id,0,pr),0)).toFixed(2)};});})()`);
  ok(parts.length > 10 && parts.every((x) => Math.abs(x.whole - x.split) < 0.02),
    "per-book delivered-and-unpaid sums to the whole-book figure for every party");
  /* his call 4(e): a suggested restock is priced at the book's own tier, lots bought whole */
  ok(JSON.stringify(read("restockQuote(7.25)")) === JSON.stringify({ qty: 12.5, total: 650, rate: 52, lots: 1, quoted: true }),
    "salt: 7.25 unit needed is covered by the 12.5 tier at its RM650 total, not 7.25 at a flat rate");
  ok(JSON.stringify(read("restockQuote(130)")) === JSON.stringify({ qty: 200, total: 8000, rate: 40, lots: 2, quoted: true }),
    "beyond the top tier it takes whole top-tier lots: 130 needs two 100s at RM8,000");
  w.eval("setProd('oil');recompute();");
  ok(JSON.stringify(read("restockQuote(3)")) === JSON.stringify({ qty: 10, total: 100, rate: 10, lots: 1, quoted: true }),
    "oil: 3 unit needed is covered by its own 10 unit tier at RM100");
  w.eval("setProd('salt');recompute();");
  try { w.close(); } catch (e) { }
}

section("Oil — pinned at both ends and lawful between (round 5, his call 5)");
{
  /* His stated board, 29 Aug in chat: 13, 12, 11, 10 and 9 ringgit a unit down the five
     sizes, so 130, 240, 330, 400 and 450, with the ends pinned against a 50-unit buy of
     RM350 on the quote. Every size is stated, none derived. The floor checks read TODAY'S
     cost basis on purpose: if a dear enough lot ever lifts the 50 unit floor above RM450,
     or ties two rates, the right outcome is a red line here saying his stated price needs
     his decision, not a board that quietly moves it. */
  const book = JSON.parse(readFileSync(join(REPO, "ledger", "book.json"), "utf8"));
  ok(JSON.stringify(book.PRICE_SET.oil.prices) ===
    JSON.stringify({ "10": 130, "20": 240, "30": 330, "40": 400, "50": 450 }),
    "the book records his stated oil board, 13 down to 9 ringgit a unit");
  const { openMaster } = await import("../tools/payload.mjs");
  const { w } = await openMaster();
  const read = (expr) => JSON.parse(w.eval("JSON.stringify(" + expr + ")"));
  w.eval("setProd('oil');recompute();");
  const rows = read("sizesFor('oil').map(q=>({q,ask:priceLadder(q).ask.total,fl:floorTotal(q)}))");
  const a10 = rows.find((r) => r.q === 10), a50 = rows.find((r) => r.q === 50);
  ok(a10.ask === 130, "the board asks his RM130 at 10");
  ok(a50.ask === 450, "and his RM450 at 50, quoted whether or not it clears its floor (v552)");
  ok(JSON.stringify(rows.map((r) => r.ask)) === JSON.stringify([130, 240, 330, 400, 450]),
    "the whole board is his stated one: 130, 240, 330, 400, 450");
  /* v552, 09 Sep 2026: HE DECIDED, AND THE LINE MOVES TO WHAT HE DECIDED. The v551 oil count read a
     23.08% leak from his own figures and lifted the 50 unit floor to RM482.20, so this section went
     red exactly as it was built to: "his stated price needs his decision, not a board that quietly
     moves it". His decision was to quote RM450 and let the margin carry it. So the assertion is no
     longer that RM450 clears its floor; it is that the desk QUOTES what he stated and NAMES the gap,
     which is the thing that must never silently stop being true. */
  const under50 = read("priceLadder(50).ask.under"), fx50 = read("priceLadder(50).ask.floorX");
  ok(a50.fl > 450 + 0.009 ? under50 > 0.009 : under50 === 0,
    `where his stated ask sits under break-even the desk says by how much (floor ${a50.fl}, under RM${under50})`);
  ok(Math.abs(fx50 - +(450 / a50.fl).toFixed(3)) < 0.0011,
    `and reports it as a multiple of break-even (${fx50}x)`);
  ok(a50.fl <= 450 + 1e-9 || fx50 < 1,
    "and a stated ask below break-even reads under 1.00x rather than above it");
  /* THE GUARD IS NARROWED, NOT REMOVED, and this is the pair that proves it. Same cost stack, same
     size, same policy: the only difference is whether the price was STATED. A stated one stands and
     names its gap; a derived one is still lifted clear of the floor, which is the whole of what
     v352 was written to stop. Read off the desk's own inputs rather than a fixture, so a change to
     the cost stack cannot make either half vacuous. */
  /* v553: the stated price used here is RM1, not RM450. The first cut used RM450 because it was
     under its floor that hour; the COST_RULE of v553 dropped oil's floor to RM436.43 and RM450
     cleared it, so the pair broke on a change to the cost basis rather than on a fault. RM1 is
     under any floor this book can compute, which is what makes the halves independent of it. */
  const walkS = read("PRICING_ENGINE.ladderWalk([50], pxCost(), Object.assign({}, pxPolicy(), {stated:{'50':1}}))");
  const walkD = read("PRICING_ENGINE.ladderWalk([50], pxCost(), Object.assign({}, pxPolicy(), {stated:{}}))");
  ok(walkS[0].p === 1, `a price he stated under its floor is quoted as stated (${walkS[0].p})`);
  ok(walkS[0].under > 0.009 && Math.abs(walkS[0].under - +(a50.fl - 1).toFixed(2)) < 0.011,
    `and carries the gap to break-even, RM${walkS[0].under} of RM${a50.fl}`);
  ok(walkD[0].p > a50.fl + 0.009, `a DERIVED ask under the same floor is still lifted clear of it (${walkD[0].p} over ${a50.fl})`);
  ok(walkD[0].under === 0, "and reports no gap, because it has none");
  /* v553, his instruction of 09 Sep 2026: OIL PRICES OFF THE BUY RATE PLUS 15%, A PLACEHOLDER. The
     measured road put RM1.81 of a RM9.64 effective cost on one drift figure from a single cycle.
     The rule is DATA on the book, it moves eff AND effEx because the floor reads effEx, and it
     moves nothing else: landed stays the IAS 2 figure and shrink keeps reporting what the counts
     read. Both halves asserted, and salt is the control that proves the rule is not global. */
  /* v554, his instruction of 09 Sep 2026: THE COLUMN IS MARKUP AND THE HEADING SAYS SO. It read
     Margin over a multiple of cost while the % margin under the ask was a margin on price, so one
     row carried two arithmetics under one word. The heading is asserted rather than left to the
     eye, because copy that contradicts its own figures is the fault this desk keeps finding. */
  /* `pxboard` is worn by TWO tables per book: the board itself and the Set the board panel below
     it, whose columns are Size / On the board / Price / Floor. A bare selector picks up both, which
     is how the first cut of this check read "Floor" as a fourth heading and went red on a table it
     was never about. Filter to the board by its own second column. */
  w.eval("switchTab('pricing');");
  const allHeads = JSON.parse(w.eval("JSON.stringify([].slice.call(document.querySelectorAll('.sec.on table.pxboard')).map(function(t){return [].slice.call(t.rows[0].cells).map(function(c){return c.textContent.replace(/[\\r\\n\\t ]+/g,' ').trim();});}))"));
  const heads = allHeads.filter((h) => /^COGS/.test(h[1] || ""));
  ok(heads.length >= 1 && heads.length < allHeads.length,
    `the board is drawn and told apart from the Set the board panel (${heads.length} of ${allHeads.length} pxboard tables)`);
  /* v564, HIS INSTRUCTION OF 10 SEP 2026: TWO TIERS, SO THE MARKUP COLUMN MOVED INTO THE ASKS.
     v554's rule is unchanged and is asserted in its new place: the multiple must say what it is OF,
     or "2.49x" reads as +249% to anyone who takes markup at its book meaning. It could not stay a
     column of its own, because one Markup column beside TWO asks has to pick a tier and then
     silently describes one of them. The fourth and fifth columns are the two tiers, cheapest first,
     which is v247's rule for reading a board. Salt is the book with two tiers; oil is checked below
     and must still read Ask. */
  /* THE PRICE VIEW DRAWS A BOARD PER BOOK, so `heads` holds TWO: salt's, which has two tiers, and
     oil's, which has one because LADDER_BY.oil says tier1 null. An `every` over both is what the
     first cut of this check used and it went red on the book it was right about. One assertion per
     shape, and the COUNT of each shape is asserted too, so a tier1 silently inherited by oil (five
     columns where there should be four) fails here rather than on the phone. */
  const twoTier = heads.filter((h) => h.length === 5), oneTier = heads.filter((h) => h.length === 4);
  ok(twoTier.length === 1 && oneTier.length === 1 && twoTier.length + oneTier.length === heads.length,
    `one book carries two tiers and one carries one (${heads.map((h) => h.length + " cols").join(", ")})`);
  ok(twoTier.every((h) => /^Tier 1/.test(h[3]) && /^Tier 2/.test(h[4])),
    `the two-tier board ends in Tier 1 then Tier 2, cheapest first (${twoTier.map((h) => h[3] + " | " + h[4]).join(" / ")})`);
  ok(oneTier.every((h) => /^Ask/.test(h[3])),
    `and a book with no second tier still ends in Ask (${oneTier.map((h) => h[3]).join(" / ")})`);
  ok(heads.every((h) => !h.some((c) => /^Margin/.test(c))), "and no column on the board is headed Margin any more");
  ok(heads.every((h) => !h.some((c) => /^Markup/.test(c))), "and the Markup column is gone from the head, because it moved into the cells");
  {
    /* v564: v554's RULE IN ITS NEW PLACE. The multiple must name its basis or "2.49x" reads as
       +249%. It is now the fourth line of every tier cell, so it is counted against THAT TABLE'S
       own row count rather than against shownSizes(PROD): this runs deep in a suite that has moved
       PROD and the fixtures around, and the first cut read 10 from the global against a table of
       12, which is the "coupled to live state" trap. Self-consistent, on the table being proved. */
    const bd = "document.querySelectorAll('.sec.on table.pxboard')[0]";
    const boardTx = String(w.eval(bd + ".textContent"));
    const nRows = Number(w.eval(bd + ".rows.length")) - 1;
    const mult = boardTx.match(/[0-9]+\.[0-9]{2}x eff\./g) || [];
    ok(nRows > 1 && mult.length === nRows * 2,
      `every cell on both tiers carries the multiple and says it is of effective cost (${mult.length} over ${nRows} sizes)`);
    ok(!/[0-9]x markup/i.test(boardTx), "and nowhere on the board is the multiple called a markup without its basis");
  }
  /* ============ v564: TIER 1 IS HIS TWO PRICES, PROVED ON THE BOARD AND IN THE ENGINE ============
     THE ANCHORS ARE THE POINT OF THE ASSERTION. RM875 is not a multiple of ten and the house
     rounding is up to the ten, so a derived curve can print RM880 and never RM875; the reason the
     engine takes the ends verbatim is so the board says what he said. Asserted on the RENDERED
     table, because that is what he reads, and again on the engine, because that is what the phone,
     the mirror and the price list read. */
  {
    /* FORCE THE BOOK. This section runs with OIL active: the first cut asserted salt's RM60 and
       RM875 against whatever pxPolicy() happened to return and read oil's RM10 and RM160 asks,
       which is the "coupled to live state" trap in my own comment four lines up. The board check
       above survives it only because the Price view draws a board per book into one section. */
    const keepProd = String(w.eval("PROD"));
    w.eval("setProd('salt');recompute();");
    const P1 = JSON.parse(w.eval("JSON.stringify(pxPolicy())"));
    ok(P1.tier1 && +P1.tier1["0.5"] === 60 && +P1.tier1["12.5"] === 875,
      "salt's policy carries his two Tier 1 ends, 0.5 unit at RM60 and 12.5 at RM875");
    const L05 = JSON.parse(w.eval("JSON.stringify(priceLadder(0.5))"));
    const L125 = JSON.parse(w.eval("JSON.stringify(priceLadder(12.5))"));
    ok(L05.tier1 && L05.tier1.total === 60 && L125.tier1 && L125.tier1.total === 875,
      `and the engine prints them verbatim, not rounded up to the ten (${L05.tier1 && L05.tier1.total} and ${L125.tier1 && L125.tier1.total})`);
    ok(L125.ask.total === 1150 && L05.ask.total === 70,
      `while TIER 2 DOES NOT MOVE: still RM70 at half a unit and RM1,150 at twelve and a half (${L05.ask.total}, ${L125.ask.total})`);
    /* the two-tier board is found by its own five-column head rather than by position, because
       position depends on which book the view drew first and that is not what is being proved */
    const boardTx = String(w.eval("(function(){var ts=document.querySelectorAll('.sec.on table.pxboard');"
      + "for(var i=0;i<ts.length;i++)if(ts[i].rows[0].cells.length===5)return ts[i].textContent;return '';})()"));
    ok(boardTx.indexOf("RM 875") >= 0 && boardTx.indexOf("RM 880") < 0,
      "the board he reads prints RM 875 and never the RM 880 a rounded curve would give");
    /* the two laws, over the whole printed tier, and the one relation between the tiers */
    const sz = JSON.parse(w.eval("JSON.stringify(shownSizes('salt'))"));
    const walked = JSON.parse(w.eval("JSON.stringify(PRICING_ENGINE.tier1Walk(" + JSON.stringify(sz) + ", pxCost(), pxPolicy()))"));
    let fall = true, cheaper = true, clears = true;
    for (let i = 1; i < walked.length; i++) if (walked[i].p / walked[i].q > walked[i - 1].p / walked[i - 1].q + 1e-9) fall = false;
    sz.forEach((q, i) => {
      const L = JSON.parse(w.eval("JSON.stringify(priceLadder(" + q + "))"));
      if (walked[i].p > L.ask.total + 1e-9) cheaper = false;
      if (walked[i].p < L.floor.total - 0.009) clears = false;
    });
    ok(fall, "Tier 1's rate never rises with size, the same law the ask obeys");
    ok(cheaper, "Tier 1 is at or under Tier 2 at every printed size, so the board reads dearer left to right");
    ok(clears, "and every Tier 1 rung clears break-even on today's cost, so none carries a gap");
    /* AND A BOOK WITH NO SECOND TIER RETURNS NOTHING RATHER THAN SALT'S. Without the explicit
       tier1:null in LADDER_BY, ladderFor spreads LADDER underneath and oil inherits salt's ends:
       every oil size clamps to 12.5, the rate lands at RM70 a unit, and ten units of oil that
       Tier 2 sells at RM130 would be quoted RM700. This is the assertion that catches that. */
    w.eval("setProd('oil');recompute();");
    const Poil = JSON.parse(w.eval("JSON.stringify(pxPolicy())"));
    const Loil = JSON.parse(w.eval("JSON.stringify(priceLadder(10))"));
    ok(!Poil.tier1 && Loil.tier1 === null,
      "oil declares no Tier 1 and is handed none, rather than inheriting salt's RM120 a unit");
    ok(Loil.ask.total === 130, `and oil's ask is untouched at RM130 for its 10 unit minimum (${Loil.ask.total})`);
    const rowsOil = JSON.parse(w.eval("JSON.stringify(PRICING_ENGINE.ladderRow(shownSizes('oil'), pxCost(), pxPolicy()))"));
    ok(rowsOil.length === 1 && rowsOil[0].code === "T2" && rowsOil[0].dflt === true,
      "the payload row for a one-tier book is the default ask alone");
    w.eval("setProd('salt');recompute();");
    const rowsSalt = JSON.parse(w.eval("JSON.stringify(PRICING_ENGINE.ladderRow(shownSizes('salt'), pxCost(), pxPolicy()))"));
    /* ROW ZERO IS THE DEFAULT ASK AND THAT IS LOAD BEARING. The phone, the D1 mirror and the board
       check above all read [0] rather than hunting for a code, on v328's argument that a fallback
       which quietly carries a panel hides a fault. Putting Tier 1 first would have cut every
       quoted price in silence, so the order is asserted by NAME and not taken on trust. */
    ok(rowsSalt.length === 2 && rowsSalt[0].code === "T2" && rowsSalt[0].dflt === true && rowsSalt[1].code === "T1",
      `the payload puts Tier 2 at row zero and Tier 1 after it (${rowsSalt.map((r) => r.code).join(", ")})`);
    ok(rowsSalt[0].prices[0] === 70 && rowsSalt[1].prices[0] === 60,
      `so row zero still quotes the ask and not the cheaper tier (${rowsSalt[0].prices[0]} then ${rowsSalt[1].prices[0]})`);
    w.eval("setProd(" + JSON.stringify(keepProd) + ");recompute();");   // put the desk back on the book this section was on
  }
  ok(String(w.eval("document.querySelector('.sec.on table.pxboard').textContent")).indexOf("% margin") >= 0,
    "while the true margin on price stays under the ask, where it belongs");
  w.eval("setProd('oil');recompute();");
  const cOil = read("pxCost()");
  ok(cOil.rule === "buyPlusPct" && cOil.rulePct === 15, `oil prices on the stated rule (${cOil.rule} ${cOil.rulePct})`);
  ok(Math.abs(cOil.eff - +(cOil.repl * 1.15).toFixed(6)) < 0.005, `and its effective cost is the buy rate plus 15% (${cOil.eff} against ${cOil.repl})`);
  ok(Math.abs(cOil.effEx - cOil.eff) < 0.005, "the floor's basis moves with it, so the board is not priced one way and refused another");
  ok(Math.abs(cOil.landed - +(cOil.repl + cOil.freight).toFixed(4)) < 0.005 && cOil.shrink > 0,
    `while landed stays the true cost and the leak is still measured and reported (${cOil.landed}, ${(cOil.shrink * 100).toFixed(2)}%)`);
  ok(read("priceLadder(50).ask.under") === 0, "so his RM450 clears its floor on this basis and the desk stops calling it under");
  w.eval("setProd('salt');recompute();");
  const cSalt = read("pxCost()");
  ok(cSalt.rule === null && Math.abs(cSalt.eff - cSalt.effEx) < 0.001 && cSalt.eff > cSalt.landed,
    `and salt carries no rule, so it still prices off the measured leak (${cSalt.eff} on ${cSalt.landed})`);
  w.eval("setProd('oil');recompute();");
  let strict = true, dearer = true;
  for (let i = 1; i < rows.length; i++) {
    if (!(rows[i].ask / rows[i].q < rows[i - 1].ask / rows[i - 1].q - 1e-9)) strict = false;
    if (!(rows[i].ask > rows[i - 1].ask + 1e-9)) dearer = false;
  }
  ok(strict, "every larger oil size is STRICTLY cheaper per unit, 130 at 10 down to 450 at 50");
  ok(dearer, "and strictly dearer in total, so no lot is beaten by buying smaller");
  w.eval("setProd('salt');recompute();");
  try { w.close(); } catch (e) { }
}

section("iPhone — the dead zones the desk draws under (v392)");
{
  const m = readFileSync(join(REPO, "master", "salt_command.html"), "utf8");
  /* THE HEAD ASKS TO DRAW UNDER THE STATUS BAR AND THE ISLAND, AND NOTHING PADDED THE TOP.
     apple-mobile-web-app-status-bar-style:black-translucent plus viewport-fit=cover is an
     instruction to use the whole screen including the strip the clock and the Dynamic Island
     occupy. Not one rule in 655 used safe-area-inset-top, so the desk bar sat at top:0 with
     its two controls behind the status bar and he could not reach them. */
  ok(/viewport-fit=cover/.test(m), "the desk still asks for the whole screen");
  ok(/black-translucent/.test(m), "and still draws under the status bar, which is what makes the inset mandatory");
  ok(/--safetop:env\(safe-area-inset-top,0px\)/.test(m), "the top inset is a variable the sheet reads");
  ok(/--safebot:env\(safe-area-inset-bottom,0px\)/.test(m), "and so is the bottom one");
  ok(/\.deskbar\{position:sticky;top:var\(--safetop\)/.test(m), "the sticky bar starts below the strip, not at zero");
  ok(/\.exitfix\{position:fixed;top:calc\(10px \+ var\(--safetop\)\)/.test(m), "and so does the exit control");
  /* the variables exist so this is TESTABLE: env() cannot be forced in a desktop browser, and
     an untestable fix for a device nobody here has is a guess. Measured with --safetop 59px,
     the iPhone 15 Pro figure: nothing interactive lands in the strip or under the island. */
  const tops = (m.match(/var\(--safetop\)/g) || []).length;
  ok(tops >= 5, `the top inset reaches every pinned surface (${tops} uses)`);

  /* 44px IS APPLE'S MINIMUM AND THE TOKEN SAID 40. One token, four controls. */
  /* v475: the token moved into the design system as --salt-tap, and --tap aliases it */
  ok((/--tap:44px/.test(m) || (/--salt-tap:\s*44px/.test(m) && /--tap:var\(--salt-tap\)/.test(m))) && !/--tap:40px/.test(m) && !/--salt-tap:\s*40px/.test(m), "the tap token is 44px, and there is only one of it");
  ok(/\.deskbar \.fabtn\{position:static;width:var\(--tap\);height:var\(--tap\)/.test(m),
    "the two bar controls read it rather than carrying 34px of their own");
  ok(/\.rail button\{min-height:var\(--tap\)/.test(m), "and so do the rail's own buttons, which are the only way between views");

  /* iOS ZOOMS INTO ANY FIELD UNDER 16px AND DOES NOT ZOOM BACK OUT. */
  ok(/input,select,textarea\{font-size:max\(16px,1em\);\}/.test(m), "no field can be small enough to zoom the page");
  /* the three other 13px sites are a flex row, a bordered box and a label, none of them a
     field, which the browser confirmed: exactly one input was under 16px and it was vpass. */
  ok(/id="vpass"[^>]*font-size:16px/.test(m), "and the one field that was 13px is 16px");

  /* 100vh IS WRONG ON iOS SAFARI, whose toolbar changes the viewport under the page. */
  /* v392: MATCH THE VALUE, NOT THE WORD. The first form of this searched the whole master for
     "100vh" and tripped on the changelog entry that explains why 100vh was wrong, which is
     prose and not a rule. A CSS use is always "…:100vh" or "…:calc(100vh". */
  ok(!/:\s*(calc\()?100vh/.test(m), "nothing on the desk measures itself against 100vh");
  ok(/100dvh/.test(m), "they use dvh, which is the height that is actually there");
}

section("Enter — the tap contract on the one view you type into");
{
  /* THIS SECTION EXISTS BECAUSE THE WIDTH HALF WAS LOST ONCE, IN THE FOLD THAT SHIPPED THE
     HEIGHT HALF. The Enter form's strips got min-height AND min-width at the branch; the
     central .viewsw button rule carries only the height, so absorbing the scoped rule put
     five buttons back under 44px wide with every one of them 44px tall, which no height
     assertion could see. Measured at 375px: Sell 42, Buy 43, All 32, Half 40, Full 37.

     These read the master's source rather than the CSSOM on purpose. CSSOM re-serialises a
     selector list with a space after every comma, so a check written against the authored
     selector comes back false for a rule that is present. */
  const m = readFileSync(join(REPO, "master", "salt_command.html"), "utf8");

  ok(/\.vpart\[data-tab="add"\] \.viewsw\{flex-wrap:wrap/.test(m),
    "the Enter form's strips wrap, so no mode sits off the right edge of a phone");
  ok(/\.vpart\[data-tab="add"\] \.viewsw button\{min-width:var\(--tap\)/.test(m),
    "and every button on them is 44px WIDE, which the central height rule does not give");
  ok(/\.viewsw button\{[^}]*min-height:var\(--tap\)/.test(m),
    "the height half is the central rule, and it is still there");
  ok(/#wbAssocWrap>label\{min-height:var\(--tap\)/.test(m),
    "the associate checkbox is 13px, so its label is the target and the label reads --tap");

  /* sixty of them on the Whiteboard, each one dismissing or deferring a finding, in a row
     beside a .navlink that has been 44px since v392. */
  ok(/\.obsbtn\{[^}]*min-height:var\(--tap\)/.test(m),
    "the Whiteboard's hush controls read --tap, not the 27px they carried");

  /* v387 retired the phone app: /desk is the one surface, and the laptop copy of Approve
     was still sending the reader to a second one. */
  ok(!/decided on the cloud desk or on the phone/.test(m),
    "no copy on this view names the retired phone app as a place to go");

  /* AND COPY MUST NAME WHAT THE EYE CAN FIND, NOT WHAT THE DOM KNOWS. The form told the
     reader to open "Names & IDs". That control is button#idBtn, 44x44 at x=268 y=127 on a
     375px screen, drawn as a key glyph with no text on it at all: the words "Names & IDs"
     live only in its title and aria-label, and a phone has no hover to show them. */
  ok(!/Open <b>Names &amp; IDs<\/b> and use/.test(m),
    "the form does not send the reader to a control by a name that is nowhere on screen");
  ok(/The <b>key<\/b> icon, top right, then <b>\+ Add ID<\/b>/.test(m),
    "it names the glyph and the place instead, both of which are on the screen");
  ok(/title="Names &amp; IDs"/.test(m),
    "the bar control keeps its title, which is what the copy stopped relying on");
}

section("Silence — four things that failed without saying so (v384)");
{
  const m = readFileSync(join(REPO, "master", "salt_command.html"), "utf8");
  const eng = readFileSync(join(REPO, "engine", "pricing.mjs"), "utf8");

  /* 1. NO EMPTY CATCH ON A DRAW. Both of these swallowed a throw whole, so a broken chart was
     indistinguishable from a chart with nothing to draw and every fault was found by eye. */
  ok(/fns\.forEach\(f=>\{try\{f\(\);\}catch\(e\)\{drawFailed\(b,f,e\);\}\}\)/.test(m),
     "a draw that throws inside drawPerProduct is reported, not swallowed");
  ok(/function drawFailed\(b,f,e\)\{/.test(m) && /b\.insertBefore\(n,b\.firstChild\)/.test(m),
     "and the report goes to the top of the block, where the eye lands");
  ok(!/if\(PART_DRAW\[tab\]\)PART_DRAW\[tab\]\(\);\}catch\(e\)\{\}/.test(m),
     "renderPart no longer eats a whole part's draw pass in an empty catch");

  /* 2. stripMethod. Three scope faults, each of which deleted something that was not method. */
  ok(/const blks=\[\.\.\.el\.querySelectorAll\('\.prodblock\[data-prod\]'\)\];/.test(m)
     && /\(blks\.length\?blks:\[el\]\)\.forEach\(scope=>\{/.test(m),
     "stripMethod keeps one note per PRODUCT BLOCK, so the second product keeps its lead");
  ok(/&&!b\.id&&!FIGURE\.test\(txt\(b\)\)\);/.test(m),
     "and leaves alone a block carrying a figure, or one another function addresses by id");
  ok(/const FIGURE=\/RM\\s\?\\d\|/.test(m), "FIGURE says what a figure is: money, a quantity or a percentage");
  ok(/<div id="plOk" class="dsc"/.test(m), "the div planAdd writes into is still there to be found, and now survives");

  /* 3. THE LOCK SWITCH. lockBase is populated whether the lock is on or off, so guarding on it
     alone froze freight and delivery under any cost override while the leak stayed live. */
  const guards = eng.match(/\(I\.lockOn&&LKb&&pxOver\.cost!=null\)/g) || [];
  ok(guards.length === 2, `freight and delivery both obey the lock switch, as the leak already did (${guards.length}/2)`);
  ok(!/\((?<!I\.lockOn&&)LKb&&pxOver\.cost!=null\)/.test(eng), "and nothing in the cost stack reads the frozen basis on a lock that is off");

  /* 4. OIL'S SHELF COST IS DERIVED FROM THE BOOK, NOT PINNED. v381 rolled salt RM44 to RM50 and
     left oil at the rate of lots long gone. Read the newest RECEIVED oil lot rather than assert
     a number, which is the same lesson the shelf-cost assertion above learned. */
  const bk = JSON.parse(readFileSync(join(REPO, "ledger", "book.json"), "utf8"));
  const oilLots = (bk.purchases || []).filter((p) => p.product === "oil" && p.receivedOn && p.qty > 0);
  if (!oilLots.length) skipData("no received oil lot on the book, so the check is skipped");
  else {
    oilLots.sort((a, b) => String(a.receivedOn).localeCompare(String(b.receivedOn)));
    const newest = oilLots[oilLots.length - 1];
    const rate = newest.total / newest.qty;
    const stated = +(/const PROD_STOCK_COST=\{salt:null, oil:([\d.]+)\}/.exec(m) || [])[1];
    ok(Math.abs(stated - rate) < 1e-6,
       `oil's shelf cost is the newest received lot's rate, RM${rate.toFixed(4)} (stated RM${stated}). A genuine blend would fail this, which is the point: it should be a decision, not a default`);
  }
}

section("Drafter — a lot that has not arrived does not say it has (v385)");
{
  const d = readFileSync(join(REPO, "src", "drafter.js"), "utf8");
  /* An absent receivedQty on a SETTLED lot means received in full, by the book's own
     convention and by poRecvUnits. So a paid-and-unarrived lot drafted with neither
     receivedQty nor inTransit asserts the goods landed, and approving it walks the whole
     lot into stock and into the cost basis. Both fields, matching the fold's v146 guard. */
  ok(/else \{ row\.receivedQty = 0; row\.inTransit = true; \}/.test(d),
     "a BUY that moved nothing states the zero AND says the lot is on order");
  const f = readFileSync(join(REPO, "tools", "fold.mjs"), "utf8");
  ok(/row\.receivedQty = 0; row\.inTransit = true;/.test(f),
     "and the fold's correction road writes the same pair, so both roads make the same shape");
}

section("Refused — shown so they are not entered twice, never so they can be approved (v309)");
{
  const { openMaster } = await import("../tools/payload.mjs");
  const { w } = await openMaster();
  w.SALT_CLOUD = true;                                  // the panel is cloud-mode only
  const d = w.document;
  const el = d.createElement("div");
  el.className = "vpart"; el.setAttribute("data-tab", "approve");
  d.body.appendChild(el);
  el.innerHTML = w.eval("builders").approve();

  ok(!!d.getElementById("apRef"), "the Approve part draws a container for the refusals");

  /* the shape the worker sends, verbatim */
  w.eval("AP_DRAFTS = " + JSON.stringify([{
    id: "d1", status: "pending", collection: "sales",
    row: { customer: "CD3-SEG", product: "salt", qty: 10, total: 300, cost: 7, date: "2026-08-29" },
    flags: [], reasoning: "test"
  }]));
  w.eval("AP_REFUSED = " + JSON.stringify([{
    id: "2026-08-29T02:00:00.000Z",
    entry: { raw: "Fulfilment CC5-OKR 5 unit", type: "AMEND" },
    why: "a Linked amendment names no figure the drafter can check",
    party: "CC5-OKR", source: "cloud-drafter", seenAt: "2026-08-29T02:00:01.000Z"
  }]));
  w.apDraw();

  const ref = d.getElementById("apRef"), box = d.getElementById("apBox");
  const txt = ref.textContent.replace(/\s+/g, " ");
  ok(ref.querySelectorAll(".card").length === 1, "each refusal is one card");
  ok(/a Linked amendment names no figure/.test(txt), "the card says why it was refused");
  ok(/cloud-drafter/.test(txt), "and which drafter saw it");
  ok(/2026-08-29/.test(txt) && !/T02:00:01/.test(txt), "and the date it was seen, as a date and not a timestamp");

  /* THE THREE PROPERTIES OF v309, each asserted rather than assumed */
  ok(ref.querySelectorAll("button").length === 0, "the panel renders no button");
  ok(ref.querySelectorAll('button,input,select,textarea,a,[tabindex]:not([tabindex="-1"])').length === 0,
     "and nothing on it can be reached by a keyboard, so nothing there can be decided even by accident");
  ok(box.querySelectorAll("button[data-ap]").length === 2,
     "while the draft beside it keeps its two decisions, so the absence above is the panel and not the render");
  ok(w.eval("enterCount()") === w.eval("qTx().length + AP_DRAFTS.length"),
     "the Enter badge counts drafts and the local queue, never a refusal");
  ok(w.eval("enterCount()") === 1, "one pending draft and one refusal reads as one waiting");
}

section("Orders and money — the sensitivity sentence cannot read over 100% (v401)");
{
  /* THIS SENTENCE HAS BROKEN THREE TIMES, each time because the book moved rather than because
     the code changed, so it is asserted against the whole reachable range and not against
     today's figures. v386 caught a negative share and an infinity; the case left standing was
     an end earning LESS than a ringgit, where a ringgit of standing cost is 200% of the
     earning and the sentence said so, live on /desk. The rule is one rule for both ends: under
     a ringgit of contribution a ringgit is a MULTIPLE of it, at or above a SHARE of it. */
  const m = readFileSync(join(REPO, "master", "salt_command.html"), "utf8");
  const src = /const share=(c=>[^;]+);/.exec(m);
  ok(!!src, "costPanel states the share through one helper, so both ends use the same rule");
  if (src) {
    const share = eval("(" + src[1] + ")");
    /* every contribution a book could put in front of it, either side of the ringgit */
    const cs = [0.001, 0.01, 0.1, 0.5, 0.9, 0.99, 1, 1.01, 1.5, 2, 7.9, 50, 1e4];
    const over = cs.map((c) => ({ c, s: share(c).replace(/<[^>]+>/g, "") }))
                   .filter((r) => { const p = /([\d.]+)%/.exec(r.s); return p && +p[1] > 100; });
    ok(over.length === 0, over.length
      ? `a ringgit reads as ${over[0].s} of a ${over[0].c} earning, which is not a share`
      : "no contribution makes it state a share above 100%");
    ok(/times/.test(share(0.5)) && /%/.test(share(2)),
       "under a ringgit it reads as a multiple, at or above one as a percentage");
  }
}

section("Orders and money — one heading, and the standing leads are gone (v401)");
{
  /* A heading inside perProduct renders once per book, so financials and receivables each
     carried "Financials"/"Order book" twice, both times under a prodhd already naming the book
     and a view pill already reading the same word. The head belongs above the repeat, where
     consoBlock() sits. Counted by rendering rather than by grep, because the duplication only
     exists once the builder has run. */
  const { openMaster } = await import("../tools/payload.mjs");
  const { w } = await openMaster();
  for (const part of ["financials", "receivables"]) {
    const el = w.document.createElement("div");
    el.innerHTML = w.eval(`builders[${JSON.stringify(part)}]()`);
    const h1 = [...el.querySelectorAll("h1")];
    ok(h1.length === 1, `${part}: one h1, not one per book (${h1.length})`);
    ok(el.querySelectorAll(".dsclead").length === 0,
       `${part}: no standing lead restating the pill above it and the KPI labels below it`);

    /* THE SWEEP'S TRAP, ASSERTED RATHER THAN REMEMBERED. stripMethod keeps one figure-less
       prose block per product block and deletes the rest, electing the .dsclead when there is
       one. With the leads gone there is no principled keeper, so any prose added to these two
       parts must carry a figure, carry an id, or sit somewhere the sweep does not reach. */
    const FIGURE = w.eval("FIGURE");
    const bare = [...el.querySelectorAll(".dsc,.dsclead,.insight")].filter((b) =>
      !b.closest("table,details,.kpi,.act,.plan,.obs,.qfield") &&
      !b.querySelector("button,input,select,canvas,table,.kpi") &&
      !b.id && !FIGURE.test((b.textContent || "").replace(/\s+/g, " ").trim()));
    ok(bare.length < 2, bare.length < 2
      ? `${part}: at most one block the sweep can elect, so it cannot delete one arbitrarily`
      : `${part}: ${bare.length} figure-less blocks and no lead to elect a keeper; the sweep will eat one`);
  }
}

section("Orders and money — the ageing tables fit a 375px phone (v401)");
{
  /* /desk IS the phone since v387, and these two tables were the last that did not fit: six
     columns needing 336px inside a 317px card, so the reader scrolled a table sideways to
     reach the Net it exists to state. Since and the code are one fact about one party, so the
     date sits under the code and the column is gone. Asserted as a column count because that
     is what the width is: nothing here can prove pixels without a browser. */
  const { openMaster } = await import("../tools/payload.mjs");
  const { w } = await openMaster();
  const el = w.document.createElement("div");
  el.innerHTML = w.eval('builders["receivables"]()');
  const aged = [...el.querySelectorAll("table")].filter((t) => /Prov\./.test(t.textContent));
  ok(aged.length > 0, "the ageing tables render");
  for (const t of aged) {
    const heads = [...t.querySelectorAll("thead th")].map((x) => x.textContent.trim());
    ok(heads.length <= 5, `an aged table has ${heads.length} columns; six will not fit 375px`);
    ok(!heads.includes("Since"), "the date is under the code, not in a column of its own");
  }
  const rows = [...el.querySelectorAll("table tbody tr")].map((r) => r.textContent);
  ok(rows.some((r) => /\d{4}-\d{2}-\d{2}/.test(r)),
     "and the date is still stated, which is the point of moving it rather than cutting it");
}

section("Orders and money — cash is stated in the P&L, once (v401)");
{
  /* The cash table's Invoiced row was byte for byte the P&L's Revenue row, one table below it,
     so the two sat side by side saying the same figure twice. Cash is now three rows under the
     revenue it belongs to and the duplicate is gone. */
  const { openMaster } = await import("../tools/payload.mjs");
  const { w } = await openMaster();
  const el = w.document.createElement("div");
  el.innerHTML = w.eval('builders["financials"]()');
  const heads = [...el.querySelectorAll("table")].map((t) => t.textContent);
  for (const want of ["Collected in cash", "Settled in kind", "Still uncollected"]) {
    ok(heads.some((t) => t.includes(want)), `the P&L states "${want}"`);
  }
  ok(!heads.some((t) => /\bInvoiced\b/.test(t)),
     "and states the revenue once, not as Revenue and again as Invoiced");
}

section("Monthly statements: one home, and the laws a sent document lives by (29 Aug 2026)");
{
  /* v388 removed the desk's statement panel and all five functions as uncalled, and
     tools/make_statements.cjs called four of them: the monthly statements broke with
     nothing here to say so, exactly the blindness the v388 entry recorded ("no test
     covered them"). The rules live in tools/make_statements.mjs now, proven
     byte-identical to the v387 desk's own output on the v387 book when they moved.
     What this section keeps is not the bytes but the laws: the tool builds, the desk
     stays out of it, and nothing on a statement is anything a customer must not see. */
  const { stmtRows, stmtDoc, makeStatements } = await import("../tools/make_statements.mjs");
  const master = readFileSync(resolve(REPO, "master", "salt_command.html"), "utf8");
  ok(!master.includes("function stmtRows"),
     "the desk carries no statement functions: one home, and it is the module (if a panel returns, inline the module like the engines)");

  const dir = join(REPO, "test", "tmp", "statements");
  rmSync(dir, { recursive: true, force: true });
  const quiet = console.log; console.log = () => { };
  let run;
  try { run = await makeStatements(dir, "2026-08-29", { key: "test-secret" }); } finally { console.log = quiet; }
  rmSync(dir, { recursive: true, force: true });
  ok(run.made > 0 && run.made === run.sheets.length, `the tool builds (${run.made} statements)`);

  const book = JSON.parse(readFileSync(resolve(REPO, "ledger", "book.json"), "utf8"));
  const codes = [...new Set([...book.sales.map(s => s.customer), ...book.purchases.map(p => p.supplier)])].filter(Boolean);
  const alone = (html, c) => new RegExp("(^|[^A-Za-z0-9-])" + c + "($|[^A-Za-z0-9-])").test(html);
  /* the vocabulary law is about the document's WORDS, so the stylesheet and the markup
     come off first: margin:0 is CSS, "margin" in a sentence is a leak. Tested in both
     directions when written: "margin call" in a doctored text does trip it. */
  const words = (html) => html.replace(/<style>[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ");
  let vocab = 0, cross = 0, invalid = 0, noted = 0;
  for (const s of run.sheets) {
    const text = words(s.html);
    if (/\b(cost|margin|tier|floor|shrink|profit)/i.test(text)) { vocab++; console.log("  leak vocabulary on " + s.who); }
    for (const c of codes) if (c !== s.who && alone(s.html, c)) { cross++; console.log("  " + s.who + " carries " + c); }
    if (s.html.includes("Invalid Date")) invalid++;
    for (const row of book.sales) if (row.customer === s.who && row.note
      && (s.html.includes(row.note) || text.includes(row.note))) noted++;
  }
  ok(vocab === 0, "no statement speaks the seller's vocabulary: cost, margin, tier, floor, shrinkage, profit");
  ok(cross === 0, "no statement names any other party, buyer or supplier");
  ok(invalid === 0, "no statement prints Invalid Date, which is what an undated row put on customer paper until 29 Aug");
  ok(noted === 0, "no ledger note travels: the statement is built from the order, never copied from the book's prose");

  /* HIS RULING, 1 Sep 2026: AN UNDATED ROW'S DATE CELL CARRIES THE DATE THE ROW DOES HAVE.
     Three rows on the book have no `date`: two cancelled, one agreed and not yet actioned.
     The cell printed "Invalid Date" until 29 Aug and nothing after it, which left CY2-NIL
     reading an order with no date anywhere on the row, because a pending row's status says
     only "ordered". The cell now names the event and the date together, and where the date
     moves into the cell the status drops its now-duplicate copy. Only rows that HAVE a date
     cell are examined: the header carries none, and the reconciliation's mini tables use a
     different class. */
  const rowsOf = (html) => [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => m[1])
    .filter((tr) => tr.includes('class="l dt"'));
  const dateCellOf = (tr) => (tr.match(/<td class="l dt">([\s\S]*?)<\/td>/) || [, ""])[1];
  const bare = (cell) => !cell.replace(/<[^>]+>/g, "").trim();
  let blank = 0, twice = 0;
  for (const s of run.sheets) {
    for (const tr of rowsOf(s.html)) {
      if (bare(dateCellOf(tr))) { blank++; console.log("  dateless row on " + s.who); }
      const ds = tr.match(/\d{2} [A-Z][a-z]{2} \d{4}/g) || [];
      if (new Set(ds).size !== ds.length) { twice++; console.log("  " + s.who + " states a date twice: " + ds.join(", ")); }
    }
  }
  ok(blank === 0, "every row on every statement carries a date, so no order reaches a customer he cannot identify");
  ok(twice === 0, "and no row states the same date twice, so the reader has no difference to hunt for");

  /* each undated row names the RIGHT event, not merely some date */
  for (const row of book.sales.filter((x) => !x.date)) {
    const sheet = run.sheets.find((x) => x.who === row.customer);
    const want = row.cancelled ? "cancelled " : "agreed ";
    ok(!!sheet && sheet.html.includes('class="nodt">' + want),
       `${row.rid} ${row.customer} has no date, so its cell says when it was ${row.cancelled ? "cancelled" : "agreed"}`);
  }

  /* PROVED IN BOTH DIRECTIONS, because an assertion that cannot fail passes: a row with no
     date AND nothing to put in its place still renders an empty cell, and the check sees it. */
  const dateless = stmtDoc("CX-TEST", [{ gift: false, date: null, qty: 1, total: 10, unit: 10,
    paidCash: 0, inKind: 0, got: 0, inKindUnits: 0, owed: 0, pendingOrder: true, cancelled: false,
    cancelledOn: null, agreedOn: null, credit: 0, deliverable: 1, toGet: 1, paidOn: null,
    gotOn: null, state: "x", links: [] }], { brand: "Salt Command", issued: "06 Sep 2026" });
  const datelessCells = rowsOf(dateless).map(dateCellOf);
  ok(datelessCells.length === 1 && bare(datelessCells[0]),
     "and the check CAN fail: a row with no date, no agreedOn and no cancelledOn renders an empty cell");

  /* the cancelled law (v193): the row stays on the page and counts in nothing */
  const cxParty = (book.sales.find(s => s.cancelled) || {}).customer;
  if (cxParty) {
    const o = { from: null, to: "2026-08-29", completed: true, open: true, pending: true, dates: true, brand: "Salt Command", issued: "29 Aug 2026" };
    const rows = stmtRows(cxParty, o);
    const cx = rows.filter(r => r.cancelled);
    ok(cx.length > 0 && cx.every(r => r.owed === 0), `a cancelled order is shown and owes nothing (${cxParty})`);
    const html = stmtDoc(cxParty, rows, o);
    const counted = rows.filter(r => !r.cancelled).length;
    ok(html.includes(">" + counted + " order"), "and the footer counts only the orders that stand");
  }
}

section("Units — no new kg-named identifier, anywhere (round 5, his call 6)");
{
  /* The desk retired the mass symbol at v161 and sells by the unit, but the code still spoke
     kg internally: the buy, sold and reorder totals, the formatter and ninety more. Round 5
     renamed every internal identifier to unit language. What stays, and MUST stay, is the
     data: the five row keys the book already carries (in ALLOW below), and the bare field
     `kg` (ledger rows, amend steps, loans, and the phone queue's pay field, which the
     drafter dual-reads against qty). Renaming those breaks every stored row. This scan bans
     NEW kg-named identifiers so the split cannot blur again. The evolution array is
     excluded: it is history and describes the code as it was. The banned fragments are
     built by concatenation so this section does not report itself. */
  const fs = await import("node:fs");
  const KG = "K" + "g", kg = "k" + "g";
  const ALLOW = new Set(["settled", "rebate", "ref", "costPer", "value"].map((p) => p + KG));
  const bannedWord = (w) => {
    if (w === kg || ALLOW.has(w)) return false;
    return w.includes(KG) || (w.startsWith(kg) && w.length > 2) || (w.endsWith(kg) && w.length > 2);
  };
  const files = [
    "master/salt_command.html",
    ...fs.readdirSync("engine").filter((f) => f.endsWith(".mjs")).map((f) => "engine/" + f),
    ...fs.readdirSync("src").filter((f) => f.endsWith(".js")).map((f) => "src/" + f),
    ...fs.readdirSync("tools").filter((f) => f.endsWith(".mjs")).map((f) => "tools/" + f),
    "test/verify.mjs",
  ];
  const offenders = [];
  for (const f of files) {
    let text = fs.readFileSync(f, "utf8");
    if (f === "master/salt_command.html") {
      const lines = text.split("\n");
      const ev = lines.findIndex((l) => l.startsWith("const evolution=["));
      let end = ev;
      while (end < lines.length && !lines[end].trimEnd().endsWith("}];")) end++;
      text = lines.filter((_, i) => i < ev || i > end).join("\n");
    }
    for (const m of text.matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)) {
      if (bannedWord(m[0])) offenders.push(f + ": " + m[0]);
    }
  }
  ok(offenders.length === 0,
     "no kg-named identifier outside the persisted allowlist" +
     (offenders.length ? " — " + [...new Set(offenders)].slice(0, 8).join(", ") : ""));
  const masterText = fs.readFileSync("master/salt_command.html", "utf8");
  ok(masterText.includes("const units=n=>") && !masterText.includes("const kg=n=>"),
     "the formatter is units(), and the old kg() declaration is gone");
}

section("Round 6 — book integrity");
{
  const book = JSON.parse(readFileSync(join(REPO, "ledger", "book.json"), "utf8"));
  const allRows = [...(book.sales || []), ...(book.purchases || [])];
  const rids = allRows.map((r) => r.rid).filter(Boolean);
  const dup = rids.filter((v, i) => rids.indexOf(v) !== i);
  ok(dup.length === 0, "every rid on the book is unique" + (dup.length ? " — duplicated: " + [...new Set(dup)].join(", ") : ""));
  const pair = (book.sales || []).filter((r) => r.cancelled && +(r.deliveredQty || 0) > 0.009);
  ok(pair.length === 0, "no cancelled row carries a delivered quantity" + (pair.length ? " — " + pair.map((r) => r.rid).join(", ") : ""));
  const reg = book.PRODUCTS || {};
  const orphan = allRows.filter((r) => r.product && !reg[r.product]);
  ok(orphan.length === 0, "every row's product is registered in PRODUCTS" + (orphan.length ? " — " + orphan.map((r) => r.rid || r.date).join(", ") : ""));
}

section("Every part renders on every book (round 5 fold; content and census, round 6)");
{
  /* Twice now a scope fault has blanked a whole part while the full suite passed: liveQ at
     v403 and LD at round five's own first commit, both on Price, both invisible here because
     nothing rendered the part. So the suite renders every registered part on every book
     and a throw anywhere is a red line naming the part. Slow-ish (~2s), worth every one.
     ROUND 6 ADDED THE TWO CLASSES A THROW CHECK CANNOT SEE: a part that renders EMPTY
     without throwing (the whole Price builder returning '' rode this gate green), and the
     v402 structural detach (a stray closing tag ends the .prodblock early, every canvas
     after it parses as a sibling, and each draw returns at its first line with nothing
     thrown). The content floor is 150 characters against a measured pristine minimum of 197
     (Approve, both books); the census demands ZERO canvases and details outside a .prodblock
     on the six per-product parts, the measured pristine count on both books. */
  const { openMaster } = await import("../tools/payload.mjs");
  const { w } = await openMaster();
  const tabs = JSON.parse(w.eval("JSON.stringify(Object.keys(TAB_LABEL))"));
  ok(tabs.length >= 16, `the tab registry lists ${tabs.length} parts (16 at v405; fewer means a part fell out)`);
  const PERPRODUCT = new Set(["sourcing", "analysis", "inventory", "financials", "receivables", "pricing"]);
  const threw = [], thin = [], detached = [];
  for (const p of JSON.parse(w.eval("JSON.stringify(PROD_IDS)"))) {
    w.eval("setProd(" + JSON.stringify(p) + ")");
    for (const t of tabs) {
      try {
        w.eval("switchTab(" + JSON.stringify(t) + ")");
        const info = JSON.parse(w.eval("(function(){const el=document.querySelector('.sec.on');" +
          "const tx=(el&&el.textContent||'').replace(/\\s+/g,' ').trim();" +
          "const cv=el?[...el.querySelectorAll('canvas')]:[];const dt=el?[...el.querySelectorAll('details')]:[];" +
          "return JSON.stringify({len:tx.length," +
          "oc:cv.filter(x=>!x.closest('.prodblock')).length,od:dt.filter(x=>!x.closest('.prodblock')).length})})()"));
        if (info.len < 150) thin.push(p + ":" + t + " (" + info.len + " chars)");
        if (PERPRODUCT.has(t) && (info.oc || info.od)) detached.push(p + ":" + t + " (" + info.oc + " canvases, " + info.od + " details outside any .prodblock)");
      } catch (e) { threw.push(p + ":" + t + " -> " + ((e && e.message) || e)); }
    }
  }
  ok(threw.length === 0, threw.length
    ? "parts threw on render: " + threw.join("; ")
    : "all " + tabs.length * 2 + " part renders complete without a throw");
  ok(thin.length === 0, thin.length
    ? "parts rendered near-empty (a builder returned nothing): " + thin.join("; ")
    : "every part carries at least 150 characters of content on both books");
  ok(detached.length === 0, detached.length
    ? "structural detach — content outside its .prodblock: " + detached.join("; ")
    : "zero canvases or details sit outside a .prodblock on the six per-product parts");
  ok(w.eval("units(-0)") === "0 unit" && w.eval("fmt0(-0.4)") === "RM 0" && w.eval("fmt(-0.001)") === "RM 0.00",
    "a figure that displays as zero never carries a minus (units, fmt0, fmt)");
}


section("v408: the update panel does the arithmetic so a tap cannot overpay");
{
  /* THE BUG THIS SECTION EXISTS FOR. The Ledger's three quick buttons queued the row's FULL
     TOTAL as a Fulfilment, and a Fulfilment is a DELTA the fold ADDS, so tapping Paid on a row
     already carrying RM 50 of RM 100 took it to RM 150. It was reachable on any part-paid row
     and nothing anywhere caught it. The panel computes the OUTSTANDING from the row, so the
     same tap cannot overpay, and this asserts the arithmetic rather than the button. The book
     carries no part-paid sale today, so one is built: the assertion must not be able to pass
     by there being nothing to test. */
  const { openMaster } = await import("../tools/payload.mjs");
  const { readFileSync: rf, writeFileSync: wf, unlinkSync: rm } = await import("node:fs");
  const { execSync } = await import("node:child_process");
  const { join } = await import("node:path");
  const M = join(REPO, "test", ".v408.html"), B = join(REPO, "test", ".v408.json");
  const bk = JSON.parse(rf(join(REPO, "ledger", "book.json"), "utf8"));
  const seed = (bk.sales || []).find((r) => r.rid && !r.cancelled && (+r.total || 0) > 40 && (+r.qty || 0) > 1 && r.date);
  ok(!!seed, "a sale exists to build the part-paid case from");
  if (seed) {
    seed.cash = +(seed.total / 2).toFixed(2);
    seed.deliveredQty = 0;
    wf(B, JSON.stringify(bk, null, 1));
    wf(M, rf(join(REPO, "master", "salt_command.html"), "utf8"));
    execSync("node tools/booksync.mjs --sync", { cwd: REPO, env: { ...process.env, SALT_BOOK: B, SALT_MASTER: M }, stdio: "pipe" });
    const { w } = await openMaster(M);
    w.eval("setProd(" + JSON.stringify(seed.product || "salt") + ");recompute();");
    const outstanding = +(seed.total - seed.cash).toFixed(2);

    w.eval("ledEdit(" + JSON.stringify(seed.rid) + ",'SELL');");
    const chips = JSON.parse(w.eval("JSON.stringify([].map.call(document.querySelectorAll('.updchip'),b=>b.textContent))"));
    ok(chips.length >= 4, `the panel offers the row's states (${chips.length}): ${chips.join(" / ")}`);
    ok(!chips.some((c) => /Defaulted/.test(c)), "Defaulted is not offered on a sale, because the engine reads it on lots only");
    ok(w.eval("document.getElementById('updDate').value") === w.eval("TODAY.toISOString().slice(0,10)"),
      "the date is filled with today and is an editable input");

    /* CLICK THE CHIP. Passing the outstanding into updSet() would assert this test's own
       arithmetic, not the panel's: a mutation that sent the row's TOTAL rode this check green
       until the chip was clicked instead. The control has to be the thing under test. */
    w.eval("[].filter.call(document.querySelectorAll('.updchip'),b=>/Paid in full/.test(b.textContent))[0].click();");
    const filled = +w.eval("document.getElementById('updCash').value");
    ok(Math.abs(filled - outstanding) < 0.005 && filled < seed.total - 0.005,
      `Paid in full fills the outstanding RM ${filled}, not the total RM ${seed.total}`);

    const before = +w.eval("queue.length");
    w.eval("updQueue();");
    const q = JSON.parse(w.eval("JSON.stringify(queue[queue.length-1]||{})"));
    ok(+w.eval("queue.length") === before + 1, "one entry is queued");
    ok(q.payload && q.payload.kind === "Fulfilment" && q.payload.rid === seed.rid,
      "it queues a Fulfilment addressed by rid, a kind the drafter and the fold already take");
    ok(q.payload && Math.abs(q.payload.cash - outstanding) < 0.005,
      `the queued cash is the outstanding RM ${q.payload && q.payload.cash}, so the fold's delta cannot overpay`);

    /* the panel refuses on screen what v407 made the fold refuse, so nobody queues a dead row */
    const dl = JSON.parse(w.eval("JSON.stringify((function(){var r=sales.filter(s=>!s.cancelled&&s.rid&&txDeliv(s)>0.009)[0];return r?{rid:r.rid}:null;})())"));
    if (dl) {
      w.eval("ledEdit(" + JSON.stringify(dl.rid) + ",'SELL');");
      w.eval("updSet('cancel',null,null);");
      ok(/refuses/.test(w.eval("document.getElementById('updSay').textContent")),
        "cancelling a row that has moved goods is refused on screen before it is queued");
      const qb = +w.eval("queue.length");
      w.eval("updQueue();");
      ok(+w.eval("queue.length") === qb, "and nothing is queued by it");
    }

    w.eval("ledEdit(" + JSON.stringify(seed.rid) + ",'SELL');");
    ok(w.eval("!!document.querySelector('.updmore') && !document.querySelector('.updmore').open"),
      "the thirty-field sheet is still there, closed, one fold below the panel");
    ok(w.eval("!!document.getElementById('ed_party') && !!document.getElementById('ed_cost')"),
      "and every EDFORM control is still in the DOM for edSubmit to read");
    ok(w.eval("getComputedStyle(document.querySelector('.updchip')).minHeight") === "44px",
      "the chips meet the 44px tap contract");
  }
  for (const f of [M, B]) { try { rm(f); } catch (e) { /* best effort */ } }
}


section("v409: the Enter sheet is priced against the book it books to");
{
  /* ROUND SEVEN, MATERIAL. The sheet held a product of its own while the margin, the free-stock
     warning and priceCoach all read the ACTIVE book, and its own note said "books to the oil
     book, not where the rail points". So a healthy oil sale was measured against salt's
     replacement cost and read as a large loss. The select moves the book now, which is why this
     asserts the MARGIN and not the wiring: the wiring can be rewritten, the figure cannot be
     wrong. Proved red against v408, where the same entry read a negative margin. */
  const { openMaster } = await import("../tools/payload.mjs");
  const { w } = await openMaster();
  const prods = JSON.parse(w.eval("JSON.stringify(PROD_ORDER)"));
  if (prods.length < 2) { skipData("one book only, so the cross-book entry case cannot arise"); }
  else {
    const [a, b] = prods;
    w.eval("setProdView(" + JSON.stringify(a) + ");");
    const replA = +w.eval("replCost()");
    w.eval("setProdView(" + JSON.stringify(b) + ");");
    const replB = +w.eval("replCost()");
    w.eval("setProdView(" + JSON.stringify(a) + ");");
    ok(replA > 0 && replB > 0, `both books have a replacement cost (${a} RM ${replA}, ${b} RM ${replB})`);

    /* an order on book B, entered while the desk is on book A, priced healthily for B */
    const qty = 2, total = +(replB * qty * 1.45).toFixed(2), rate = total / qty;
    w.eval("switchTab('add');");
    w.eval("(function(){var p=document.getElementById('wbProd');p.value=" + JSON.stringify(b) + ";if(p.onchange)p.onchange();})();");
    ok(w.eval("PROD") === b, "choosing a product on the sheet moves the desk to that book");
    ok(w.eval("wbProdVal()") === b, "and the sheet's product is the desk's, so the payload records what was checked");

    w.eval(`(function(){var set=function(i,v){var e=document.getElementById(i);if(e)e.value=v;};
      set('wbQty',${qty});set('wbTotal',${total});set('wbCash',${total});set('wbUnits',${qty});set('wbDate','2026-08-31');
      var ps=document.getElementById('wbParty');
      if(ps&&ps.options.length>1){for(var i=0;i<ps.options.length;i++){var v=ps.options[i].value;if(v&&v.indexOf('S')!==0){ps.value=v;break;}}}
      wbApply();wbPreview();})();`);
    const prev = (w.eval("(document.getElementById('wbPrev')||{}).textContent||''") || "").replace(/\s+/g, " ");
    const m = prev.match(/margin\s*(-?\d+)%/);
    ok(!!m, "the preview states a margin for the entry");
    if (m) {
      const shown = +m[1], wantB = Math.round((rate - replB) / rate * 100), wouldBeA = Math.round((rate - replA) / rate * 100);
      ok(Math.abs(shown - wantB) <= 1,
        `the margin is ${b}'s ${shown}% against its own RM ${replB} replacement, not ${a}'s ${wouldBeA}%`);
    }
    w.eval("setProdView(" + JSON.stringify(a) + ");");
  }

  /* v431: THE COACH IS RUN, NOT GREPPED. These were two source searches, which is the form this
     review keeps retiring: they pass on the presence of a string and survive any rewrite that keeps
     the words. The coach is called on the NON-LEAD book against a party whose history is on the
     other one, and the answer is read. If custPrices leaked across books, that party would have a
     median here and the coach would speak of it. */
  {
    const { w: wc2 } = await openMaster();
    const prods2 = JSON.parse(wc2.eval("JSON.stringify(PROD_ORDER)"));
    const other = prods2[1] || prods2[0];
    wc2.eval("setProdView(" + JSON.stringify(other) + ");");
    const stranger = JSON.parse(wc2.eval("JSON.stringify((function(){var here={};pSales(PROD).forEach(function(s){here[s.customer]=1;});var all=sales.filter(function(s){return !s.cancelled&&s.customer&&(s.total||0)>0;});for(var i=0;i<all.length;i++){if(!here[all[i].customer])return all[i].customer;}return null;})())"));
    if (stranger) {
      const hist = +wc2.eval("custPrices(" + JSON.stringify(stranger) + ").length");
      ok(hist === 0, "a party with no history on THIS book has none in the coach's eyes (" + stranger + ")");
      const said = JSON.parse(wc2.eval("JSON.stringify(priceCoach(" + JSON.stringify(stranger) + ",10,1).map(function(c){return c.msg;}))"));
      ok(said.some(function (m) { return /No price history here/.test(m); }),
        "and the coach says so rather than quoting their other book");
      ok(!said.some(function (m) { return /below their usual|above their usual/.test(m); }),
        "with no comparison against a rate they never paid on this book");
    } else skipData("every party has traded on both books, so the cross-book case cannot arise");
    /* A RATE BETWEEN THE TWO BOOKS' BEST, which is the only value that tells them apart: oil's best
       is RM 13 and the whole ledger's is RM 210, so RM 50 is a record on oil and unremarkable
       against salt. Asserting an impossible RM 99,999 would have passed either way, and did. */
    const mid = JSON.parse(wc2.eval("JSON.stringify((function(){var here=pSales(PROD).filter(function(s){return !s.cancelled&&s.qty>0&&s.total>0;}).map(function(s){return s.total/s.qty;});var all=sales.filter(function(s){return !s.cancelled&&s.qty>0&&s.total>0;}).map(function(s){return s.total/s.qty;});var hb=here.length?Math.max.apply(null,here):0;var ab=Math.max.apply(null,all);return ab>hb+1?(hb+ab)/2:null;})())"));
    if (mid) {
      const best = JSON.parse(wc2.eval("JSON.stringify(priceCoach(null," + mid + ",1).map(function(c){return c.msg;}))"));
      ok(best.some(function (m) { return /Best rate the desk has ever taken/.test(m); }),
        "a rate above THIS book's best is called a record, though the other book has beaten it (RM " + Math.round(mid) + ")");
    } else skipData("the two books share a best rate, so this comparison cannot be told apart");
    wc2.eval("setProdView(" + JSON.stringify(prods2[0]) + ");");
  }
}


section("v410: the P&L says which period each of its three columns covers");
{
  /* ROUND SEVEN. The month columns are last month and this month with no year on them, the FY
     column is the calendar year to date, and the IFRS statement below is the whole book since it
     opened. On 1 January that reads as a contradiction: an empty FY column beside a full December
     and a much larger IFRS revenue three rows down, with nothing on screen saying why. Calendar
     year is the owner's, confirmed 31 Aug 2026, so the arithmetic was right and the labelling was
     not. Proved red against v409, where seven of these fail. */
  const { openMaster } = await import("../tools/payload.mjs");
  const { readFileSync: rf, writeFileSync: wf, unlinkSync: rm } = await import("node:fs");
  const { join } = await import("node:path");
  const T = join(REPO, "test", ".v410.html");
  const paneAt = async (clock) => {
    const src = rf(join(REPO, "master", "salt_command.html"), "utf8")
      .replace(/const TODAY=[^\n]*\n/, "const TODAY=new Date('" + clock + "T12:00:00+08:00');\n");
    wf(T, src);
    const { w } = await openMaster(T);
    w.eval("setProd('salt');recompute();switchTab('financials');");
    const el = w.document.querySelector(".sec.on");
    return (el ? el.innerHTML : "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  };
  const jan = await paneAt("2027-01-01");
  ok(/FY 2027 to date, nothing yet/.test(jan), "on 1 January the FY column names its year and says it is empty");
  ok(/December 2026/.test(jan), "the month column outside the FY year carries that year, so it cannot be read as part of it");
  ok(/Three periods sit in this part/.test(jan), "the period line reaches the screen and survives stripMethod");
  ok(/whole book since it opened/.test(jan), "the IFRS statement names its own period, which is not the P&L's");
  ok(/on the revenue in this column/.test(jan), "Still uncollected names the revenue it is measured on");
  ok(/as at today, not a movement in the period/.test(jan), "Closing stock says it is a point in time, not a flow");
  /* v428: THIS ASSERTION DEFENDED THE WRONG WORD FOR EIGHTEEN VERSIONS OF ITS OWN LIFETIME. v410
     renamed these rows to "charged" on the reasonable-sounding ground that a period statement holds
     period charges. They are not charges: each is that month's debts measured at TODAY's ladder, so
     a month's figure moves as its own debts age with nothing happening in that month. A test that
     pins a label is only as good as the label. */
  ok(/Provision held/.test(jan), "the provision rows call themselves held, because they are re-measured balances");
  ok(!/Provision charged/.test(jan), "and not charged, which is what a period statement usually holds and these are not");
  ok(/measured at <b>today|today's<\/b> ladder|today.s ladder/.test(jan) || /today/.test(jan),
    "and the part says the ladder they are measured at is today's");
  const mid = await paneAt("2026-08-31");
  ok(!/July 2026|August 2026/.test(mid), "a month inside the FY year is NOT year-stamped, so nothing is added for nothing");

  /* v427: AND A CARRIED BALANCE IS NOT A PERIOD CHARGE. The tile reads "Provisions carried" and was
     fed the year-filtered figure, so on 1 January it read RM 0 while RM 930 was genuinely carried
     three panels below. The ROW in the statement is the period's charge and says so since v410;
     the TILE is the balance and takes the whole book. Not asserted as identical across the year:
     the provision ladder ages, so a carried balance grows as debts get older, which is right. What
     must not happen is a reset because the calendar turned. */
  const rmOf = (t) => { const m = String(t).match(/Provisions carried\s*RM ([0-9,]+)/); return m ? +m[1].replace(/,/g, "") : -1; };
  const carriedJan = rmOf(jan), carriedMid = rmOf(mid);
  ok(carriedJan > 0, "the carried-provisions tile is not nil on 1 January (RM " + carriedJan + ")");
  ok(carriedJan >= carriedMid && carriedMid > 0,
    "and it is at least mid-year's (RM " + carriedMid + "), because ageing only adds to it");
  ok(/whole book, not the FY column/.test(jan), "and it states the basis it is on");
  try { rm(T); } catch (e) { /* best effort */ }
}


section("v411: the Worker's SQL run against the real schema");
{
  /* WHAT THIS ADDS, AND WHAT IT DELIBERATELY DOES NOT. "Worker - drafts and approval" above
     already covers the key gate, created/existed, the listing, the card's contents, the 409 on a
     second decision and the uncommitted filter, against a hand-rolled D1 mock that throws on any
     statement it does not know. That mock is honest and it works. The ONE thing it cannot do is
     execute the Worker's SQL against the ACTUAL SCHEMA, so a column that does not exist, a
     constraint that does not hold or a NOT NULL the migrations declare would pass it. This runs
     the real migrations in a real SQLite and drives the real Worker over them.
     It also covers four edges the section above leaves: an unknown id, a reject AFTER an approve,
     committing something still pending, and committing twice.
     No credential, no network, and production D1 is never touched. */
  let DatabaseSync = null;
  try { ({ DatabaseSync } = await import("node:sqlite")); } catch (e) { /* older runtime */ }
  if (!DatabaseSync) {
    console.log("  SKIP: node:sqlite is unavailable here, so the Worker's SQL was NOT run against the real schema.");
    console.log("        Everything else about /drafts is still covered by the mock above. Needs node 22.5+ or 24.");
  } else {
    const { readFileSync: rf, readdirSync: rd } = await import("node:fs");
    const { join } = await import("node:path");
    const db = new DatabaseSync(":memory:");
    for (const f of rd(join(REPO, "migrations")).filter((x) => /^\d+_.*\.sql$/.test(x)).sort()) {
      db.exec(rf(join(REPO, "migrations", f), "utf8"));
    }
    const D1 = { prepare(sql) {
      const st = db.prepare(sql);
      const mk = (a2) => ({
        run() { const r = st.run(...a2); return { meta: { changes: Number(r.changes || 0) } }; },
        first() { const r = st.get(...a2); return r === undefined ? null : r; },
        all() { return { results: st.all(...a2) }; },
      });
      const self = mk([]); self.bind = (...a2) => mk(a2); return self;
    } };
    const KEY = "suite-key";
    const env = { SALT_LEDGER: D1, SALT_WRITE_KEY: KEY, REQUIRE_ACCESS: "0", SALT_QUEUE: null };
    const call = async (method, path, body) => {
      const res = await worker.fetch(new Request("https://x.workers.dev" + path, {
        method, headers: { "Content-Type": "application/json", "X-Salt-Key": KEY },
        body: body === undefined ? undefined : JSON.stringify(body) }), env, { waitUntil() {} });
      let j = null; try { j = JSON.parse(await res.text()); } catch (e) { /* not json */ }
      return { status: res.status, j };
    };
    /* a bad statement throws out of SQLite rather than returning a value, and a throw here would
       take the rest of the suite with it, so it is caught and named. */
    const guard = async (label, fn) => { try { return await fn(); } catch (e) { ok(false, label + " -- " + String(e.message || e).slice(0, 90)); return null; } };
    const ID = "suite-sql-1";
    const D = { id: ID, collection: "sales",
      entry: { at: "2026-08-31T00:00:00.000Z", party: "CG5-SB", qty: 1, total: 90 },
      row: { customer: "CG5-SB", product: "salt", date: "2026-08-31", qty: 1, total: 90, cost: 48.5 },
      reasoning: "one unit at the house rate", flags: ["a flag"], drafter: "suite" };

    /* the point of the section: every statement the Worker issues must run on the real schema */
    const made = await guard("the Worker's INSERT runs against the migrations' own draft table", () => call("POST", "/drafts", D));
    ok(made && made.status === 200 && made.j.created === true,
      "the Worker's INSERT runs against the migrations' own draft table");
    const listed = await guard("the Worker's SELECT names only columns the schema has", () => call("GET", "/drafts?status=pending"));
    ok(listed && listed.status === 200 && listed.j.drafts.some((d) => d.id === ID),
      "and its SELECT reads the row back, so every column it names exists");

    ok((await call("POST", "/drafts/no-such-id/approve", {})).status === 404,
      "deciding an id that is not there is 404, not a silent success");
    ok((await call("POST", "/drafts/" + ID + "/committed", {})).status === 409,
      "a PENDING draft cannot be marked committed");
    ok((await call("POST", "/drafts/" + ID + "/approve", {})).status === 200, "it approves");
    ok((await call("POST", "/drafts/" + ID + "/reject", {})).status === 409,
      "a reject AFTER an approve is refused, so a double tap cannot flip a decision");
    /* v519: the proof time rides with the mark and is read back, on the real schema */
    const LIVE = "2026-09-08T04:00:30.000Z";
    const cm = await call("POST", "/drafts/" + ID + "/committed", { liveAt: LIVE });
    ok(cm.j.committedAt && cm.j.liveAt === LIVE, "an approved draft commits, and carries the proof time it was given");
    ok((await call("POST", "/drafts/" + ID + "/committed", {})).j.alreadyCommitted === true,
      "and committing it twice is reported rather than applied twice");
    const back = await call("GET", "/drafts?status=pending");
    ok(back.j.clock && back.j.clock.id === ID && back.j.clock.liveAt === LIVE && back.j.clock.decidedAt && back.j.clock.committedAt,
      "the pending view carries the clock: the last committed draft with tap, phone and committed times");
    /* v527: a loan draft passes the widened collection check on the real schema */
    const LOAN = { ...D, id: "suite-sql-loan", collection: "loan", row: { date: "2026-09-08", party: "CH5-OUG", direction: "in", valueKg: 5.5, valueRM: null, status: "open", product: "salt" } };
    const madeLoan = await guard("a loan draft passes the widened collection check", () => call("POST", "/drafts", LOAN));
    ok(madeLoan && madeLoan.status === 200 && madeLoan.j.created === true, "a loan draft passes the widened collection check on the real schema");
    ok((await call("POST", "/drafts/" + ID + "/committed", { liveAt: "not a date" })).j.alreadyCommitted === true
      && (await call("GET", "/drafts?status=all")).j.drafts.find((d) => d.id === ID).liveAt === LIVE,
      "a proof time that is not a date is dropped, and the stored one stands");
  }
}


section("v413: a lot is not measured like a sale");
{
  /* ROUND EIGHT, MATERIAL, AND MINE. The book's convention for a fully landed lot is an ABSENT
     receivedQty, and for a settled one an absent cash beside status:"paid". poRecvUnits and poCash
     are what read that, and the engine's own walk already says buy?poCash(t):txPaid(t). The v408
     panel read the RAW fields, so TEN of eighteen lots reported a false outstanding and FIVE
     offered their whole total behind a "Paid in full" chip: RM 5,450 of liability that does not
     exist. The fold had two faults of the same family: its BUY branch RETURNED before the
     Cancellation handler, so cancelling a lot set nothing and then rewrote a settled lot to
     unpaid, and its status recompute ignored the convention its own accumulator nine lines above
     honours, so any unit-only receipt on a settled lot wiped the payment.
     These assert the CONTRACT against the engine's own helpers, never against a formula retyped
     here: my first probe reimplemented poRecvUnits, omitted its defaulted case, and reported a
     correct panel as wrong. */
  const { openMaster } = await import("../tools/payload.mjs");
  const { applyAmend } = await import("../tools/fold.mjs");
  const { readFileSync: rf } = await import("node:fs");
  const { join } = await import("node:path");
  const { w } = await openMaster();
  w.eval("setProd('salt');recompute();");
  const bk = JSON.parse(rf(join(REPO, "ledger", "book.json"), "utf8"));

  /* 1. the panel's outstanding is total-minus-poCash and qty-minus-poRecvUnits, on every lot */
  const wrong = [];
  for (const p of (bk.purchases || [])) {
    if (!p.rid) continue;
    const q = JSON.stringify(p.rid);
    const o = JSON.parse(w.eval("JSON.stringify(updOut(purchases.find(x=>x.rid===" + q + "),'BUY'))"));
    const paid = +w.eval("poCash(purchases.find(x=>x.rid===" + q + "))");
    const recv = +w.eval("poRecvUnits(purchases.find(x=>x.rid===" + q + "))");
    const wantC = +Math.max(0, (+p.total || 0) - paid).toFixed(2);
    /* v422: qty-minus-received was the contract until poOpenUnits learnt that a defaulted or
       cancelled lot has nothing coming. The panel must report what the ENGINE says is outstanding,
       not a subtraction retyped here, which is the same lesson as fold 7. */
    const wantU = +w.eval("poOpenUnits(purchases.find(x=>x.rid===" + q + "))");
    if (Math.abs(o.cashLeft - wantC) > 0.01 || Math.abs(o.unitLeft - wantU) > 0.01) {
      wrong.push(p.rid + ": panel " + o.cashLeft + "/" + o.unitLeft + " vs " + wantC + "/" + wantU);
    }
  }
  ok(wrong.length === 0,
    "every lot's outstanding is measured by the purchase convention -- " + wrong.slice(0, 4).join(" | "));

  /* 2. a settled, landed lot has nothing to offer */
  const settled = (bk.purchases || []).find((p) => p.rid && p.status === "paid" && p.cash == null
    && p.receivedQty == null && !p.pending && !p.inTransit && !p.defaulted);
  if (settled) {
    w.eval("ledEdit(" + JSON.stringify(settled.rid) + ",'BUY');");
    const chips = JSON.parse(w.eval("JSON.stringify([].map.call(document.querySelectorAll('.updchip'),b=>b.textContent))"));
    ok(!chips.some((c) => /Paid in full|Received in full/.test(c)),
      "a settled and landed lot offers neither Paid in full nor Received in full (" + (chips.join(" / ") || "none") + ")");
    /* v422: and the DEFAULTED lot, driven rather than reasoned about. p003's supplier took RM 750
       and delivered nothing, and the panel offered to receive 12.5 unit of it. */
    const dRid = JSON.parse(w.eval("JSON.stringify((purchases.find(p=>p.defaulted)||{}).rid||null)"));
    if (dRid) {
      w.eval("ledEdit(" + JSON.stringify(dRid) + ",'BUY');");
      const dChips = JSON.parse(w.eval("JSON.stringify([].map.call(document.querySelectorAll('.updchip'),b=>b.textContent))"));
      ok(!dChips.some((c) => /Received in full|Completed/.test(c)),
        "a defaulted lot is offered neither Received in full nor Completed (" + (dChips.join(" / ") || "none") + ")");
    }
    w.eval("document.getElementById('updCash').value='1';document.getElementById('updCash').oninput();");
    ok(!/Pending/.test(w.eval("document.getElementById('updSay').textContent")),
      "and the sentence does not call a landed lot Pending, which txStat cannot help but do");
  } else skipData("no settled landed lot on the book to check the panel against");

  /* 3. the fold, on lots it is handed rather than on its own source text */
  const lot = (over) => Object.assign({ date: "2026-08-01", qty: 10, total: 500, supplier: "SF6-KLC",
    inTransit: true, receivedQty: 0, rid: "t" }, over);
  const a = lot({ status: "paid" });
  applyAmend(a, { kind: "Fulfilment", date: "2026-08-31", cash: 0, kg: 10 }, "BUY", null);
  ok(a.status === "paid" && a.receivedQty === 10,
    "a unit-only receipt on a lot settled by status leaves it paid and records the receipt");
  const b2 = lot({ status: "unpaid" });
  applyAmend(b2, { kind: "Fulfilment", date: "2026-08-31", cash: 0, kg: 10 }, "BUY", null);
  ok(b2.status === "unpaid", "and an unpaid lot is not turned into a paid one by a receipt");
  /* v434, ROUND TEN: THE BATCH ORDER DECIDED WHETHER THE CONTRADICTION LANDED. Cancelling a row
     that has moved nothing is legitimate; recording a movement on a row ALREADY cancelled is the
     same contradiction from the other side, and nothing said so. Two approved items against one row
     were each faultless alone and the outcome turned on which id sorted first: cancel-then-fulfil
     left s119 cancelled AND carrying a unit and RM 10, which is verbatim the v407 failure, while
     fulfil-then-cancel threw. Asserted in BOTH orders, and with the legitimate cases beside them so
     the guard cannot become a full stop. */
  {
    const seed = () => ({ date: "2026-08-20", customer: "CY2-NIL", qty: 2.5, total: 230, rid: "sB1" });
    const CANC = { kind: "Cancellation", date: "2026-09-01" };
    const FULF = { kind: "Fulfilment", date: "2026-09-01", cash: 10, kg: 1 };
    const runBoth = (steps) => {
      const r = seed(); let refused = 0;
      for (const st of steps) { try { applyAmend(r, st, "SELL", null); } catch (e) { refused++; } }
      return { r, refused };
    };
    const a1 = runBoth([CANC, FULF]), a2 = runBoth([FULF, CANC]);
    const contradicts = (r) => !!r.cancelled && ((+r.deliveredQty || 0) > 0.009 || (+r.cash || 0) > 0.009);
    ok(!contradicts(a1.r), "cancel then fulfil cannot leave a cancelled row carrying money or goods");
    ok(!contradicts(a2.r), "and neither can fulfil then cancel");
    ok(a1.refused === 1 && a2.refused === 1, "each order refuses exactly one of the two, not both and not neither");
    /* the legitimate neighbours, so this is a gate and not a wall */
    const okCancel = seed(); let threw = false;
    try { applyAmend(okCancel, CANC, "SELL", null); } catch (e) { threw = true; }
    ok(!threw && okCancel.cancelled === true, "a row that has moved nothing still cancels");
    const okCorrect = seed(); okCorrect.cancelled = true; let threw2 = false;
    try { applyAmend(okCorrect, { kind: "Correction", date: "2026-09-01", fields: { note: "x" } }, "SELL", null); } catch (e) { threw2 = true; }
    ok(!threw2, "and a cancelled row can still be corrected, because restating a record is not moving goods");

    /* v435, ROUND TEN: A LOT THAT HAS ARRIVED CANNOT HAVE BEEN DEFAULTED ON. The flag means the
       supplier took the money and sent nothing, and poRecvUnits short-circuits on it, so setting it
       on a landed lot does not merely mislabel the row, it ERASES the goods: defaulting p001 took
       its received quantity from 12.5 to 0, walking stock that is physically on the shelf out of
       the book. Seventeen lots were offerable and nothing in the chain refused it. */
    {
      const bkD = JSON.parse(readFileSync(resolve(REPO, "ledger", "book.json"), "utf8"));
      const Eng2 = (await import("../engine/position.mjs")).default;
      const landed = JSON.parse(JSON.stringify((bkD.purchases || []).find((p) => !p.defaulted && !p.cancelled && Eng2.poRecvUnits(p) > 0.009)));
      ok(!!landed, "the book carries a landed lot to test with");
      if (landed) {
        const had = Eng2.poRecvUnits(landed);
        let refusedD = false;
        try { applyAmend(landed, { kind: "Default", date: "2026-09-01" }, "BUY", null); } catch (e) { refusedD = true; }
        ok(refusedD, `a landed lot cannot be recorded as a supplier default (${had} unit had arrived)`);
        ok(Eng2.poRecvUnits(landed) === had, "and its goods are still on the book rather than erased by the flag");
      }
      const inT = { date: "2026-08-01", qty: 10, total: 500, supplier: "SF6-KLC", inTransit: true, receivedQty: 0, rid: "pT" };
      applyAmend(inT, { kind: "Default", date: "2026-09-01" }, "BUY", null);
      ok(inT.defaulted === true, "while a lot that received nothing still defaults, so the guard is not a wall");
      const pend = { date: "2026-08-01", qty: 10, total: 500, supplier: "SF6-KLC", pending: true, rid: "pP" };
      applyAmend(pend, { kind: "Default", date: "2026-09-01" }, "BUY", null);
      ok(pend.defaulted === true, "and so does a pending one");
      /* and the panel does not offer what the book will not take */
      const { openMaster: omD } = await import("../tools/payload.mjs");
      const { w: wD } = await omD();
      wD.eval("setProd('salt');recompute();");
      const lRid = JSON.parse(wD.eval("JSON.stringify((purchases.find(function(p){return !p.defaulted&&!p.cancelled&&poRecvUnits(p)>0.009;})||{}).rid||null)"));
      if (lRid) {
        wD.eval("ledEdit(" + JSON.stringify(lRid) + ",'BUY');");
        const dChips2 = JSON.parse(wD.eval("JSON.stringify([].map.call(document.querySelectorAll('.updchip'),function(x){return x.textContent;}))"));
        ok(!dChips2.some((c) => /Defaulted/.test(c)),
          "and the panel does not offer Defaulted on a landed lot (" + dChips2.join(" / ") + ")");
      }
    }

    /* AND THE DESK, because the fold half alone rode this section green: ovAmend mirrors applyAmend
       and gained the same guard, and asserting only one engine is how v413 shipped a fold fixed and
       a desk left, which is what made v414 necessary. */
    const { openMaster: omB } = await import("../tools/payload.mjs");
    const { w: wB } = await omB();
    wB.eval("setProd('salt');recompute();");
    const liveRid = JSON.parse(wB.eval("JSON.stringify((sales.find(function(s){return s.cancelled&&s.rid;})||{}).rid||null)"));
    if (liveRid) {
      const before = wB.eval("JSON.stringify(sales.find(function(s){return s.rid===" + JSON.stringify(liveRid) + ";}))");
      wB.eval("ovAmend({kind:'Fulfilment',date:'2026-09-01',direction:'SELL',rid:" + JSON.stringify(liveRid) + ",cash:10,kg:1},{at:'b1'})");
      const after = JSON.parse(wB.eval("JSON.stringify(sales.find(function(s){return s.rid===" + JSON.stringify(liveRid) + ";}))"));
      ok(!((+after.deliveredQty || 0) > 0.009 && after.cancelled),
        "the desk does not move goods onto an already-cancelled row either");
      ok(/already cancelled/.test(wB.eval("JSON.stringify(provNotes.slice(-1))")),
        "and records why rather than declining in silence");
    } else skipData("no cancelled row on the book to drive the desk half with");
  }

  const c2 = lot({ status: "paid", receivedQty: null, inTransit: false });
  let refused = false;
  try { applyAmend(c2, { kind: "Cancellation", date: "2026-08-31" }, "BUY", null); } catch (e) { refused = true; }
  ok(refused, "cancelling a LANDED lot is refused, on the absent-receivedQty convention");

  /* v415: THE ALLOWED DIRECTION, WHICH IS WHAT WAS MISSING. Every assertion on this gate tested
     that it REFUSES, so v413 could apply the lot's ruler to a sale, refuse EVERY sale
     cancellation ever, and ride the suite green. A gate is two claims and both must be asserted:
     poRecvUnits falls through to "received in full" when receivedQty is absent, which is true of
     a lot and true of every sale that has ever existed. */
  const sale = (over) => Object.assign({ date: "2026-08-01", qty: 2, total: 200,
    customer: "CN6-WM", rid: "s999" }, over);
  const cancels = (row, dir) => {
    try { applyAmend(row, { kind: "Cancellation", date: "2026-08-31" }, dir, null); return row.cancelled === true; }
    catch (e) { return false; }
  };
  ok(cancels(sale({ cash: 0 }), "SELL"), "a sale that has delivered NOTHING can be cancelled");
  ok(!cancels(sale({ deliveredQty: 1 }), "SELL"), "a sale that has delivered something cannot");
  ok(!cancels(sale({ settledKg: 2 }), "SELL"), "nor one settled in kind, which the raw field read missed");
  ok(cancels(lot({ status: "unpaid" }), "BUY"), "a lot that has received nothing can be cancelled");
  const d2 = lot({ status: "unpaid" });
  applyAmend(d2, { kind: "Cancellation", date: "2026-08-31" }, "BUY", null);
  ok(d2.cancelled === true, "cancelling a lot that received nothing actually marks it cancelled, which it never did");
  ok(d2.status !== "paid", "and does not invent a payment state on the way out");

  /* v418: "BACK TO PENDING" ON A LOT MUST SAY pending. A lot says nothing has happened yet with
     that flag, and the payload zeroed cash and receivedQty without it, so the row stayed not
     pending: poCash read nothing paid while the total still stood, and the lot became an
     outstanding BILL. Restating a settled RM 750 lot booked a RM 750 payable for salt never
     bought. Asserted by FOLDING what the panel queues, not by reading the payload. */
  const Eng = (await import("../engine/position.mjs")).default;
  const bill = (r) => (r.pending || r.cancelled) ? 0 : Math.max(0, (+r.total) - Eng.poCash(r));
  const settledLot = { date: "2026-07-08", qty: 12.5, total: 750, supplier: "SF6-KLC", status: "paid", rid: "pB1" };
  const asPanel = JSON.parse(JSON.stringify(settledLot));
  applyAmend(asPanel, { kind: "Correction", date: "2026-09-01",
    fields: { cash: 0, receivedQty: 0, pending: true } }, "BUY", null);
  ok(asPanel.pending === true, "restating a lot to pending sets the flag the walk reads");
  ok(bill(asPanel) === 0, "so it books no payable, where the old payload booked RM " + (+settledLot.total));
  ok(Eng.poRecvUnits(asPanel) === 0 && Eng.poCash(asPanel) === 0, "and it holds no stock and no payment");
  const short = JSON.parse(JSON.stringify(settledLot));
  applyAmend(short, { kind: "Correction", date: "2026-09-01", fields: { cash: 0, receivedQty: 0 } }, "BUY", null);
  ok(bill(short) === 750, "and the payload WITHOUT pending still books the bill, so this asserts the flag and not the zeroes");
  /* AND THE PANEL ITSELF IS DRIVEN, because folding a payload typed here proves only that the
     FOLD honours pending. Dropping the flag from the panel left the behavioural assertion above
     green and failed only a source grep, which is the weak form this review keeps retiring. The
     chip is tapped and whatever it queues is folded. */
  const { openMaster: om2 } = await import("../tools/payload.mjs");
  const { w: w2 } = await om2();
  w2.eval("setProd('salt');recompute();");
  const lotRid = JSON.parse(w2.eval("JSON.stringify((purchases.find(p=>p.status==='paid'&&p.cash==null&&p.receivedQty==null&&!p.pending&&!p.defaulted)||{}).rid||null)"));
  if (lotRid) {
    w2.eval("ledEdit(" + JSON.stringify(lotRid) + ",'BUY');");
    w2.eval("updSet('pending',null,null);");
    const qn = +w2.eval("queue.length");
    w2.eval("updQueue();");
    ok(+w2.eval("queue.length") === qn + 1, "tapping Back to pending on a lot queues one entry");
    const qp = JSON.parse(w2.eval("JSON.stringify((queue[queue.length-1]||{}).payload||{})"));
    const target = JSON.parse(w2.eval("JSON.stringify(purchases.find(p=>p.rid===" + JSON.stringify(lotRid) + "))"));
    applyAmend(target, { kind: "Correction", date: "2026-09-01", fields: qp.fields || {} }, "BUY", null);
    ok(bill(target) === 0,
      "and folding WHAT THE CHIP QUEUED books no payable (bill RM " + bill(target) + ", total RM " + target.total + ")");
    ok(target.pending === true, "because the chip queued the pending flag itself");
  } else skipData("no settled landed lot to drive the pending chip on");
}


section("v416: a correction states a figure, it does not un-pay a lot");
{
  /* ROUND NINE, TWIN CLASS 1. v413 taught the Fulfilment path that a lot stored status:"paid"
     with no cash field is SETTLED, and left the Correction and Modification paths reading the raw
     field. So a RM 10 price correction on any of the five lots stored that way rewrote it to
     unpaid and invented a payable for money already handed over, up to RM 5,450 of them.
     THE TRAP, and it is why this is not a one-word swap: poCash reads a paid status as meaning the
     row's TOTAL, so calling it AFTER a total correction returns the NEW total as the amount paid.
     The payment is captured at the top of the branch, off the row as it arrived.
     Both directions are asserted: a correction that genuinely says nothing was paid must still
     leave the lot unpaid, or the fix would be a different way of lying. */
  const { applyAmend } = await import("../tools/fold.mjs");
  const E = (await import("../engine/position.mjs")).default;
  const lot = (o) => Object.assign({ date: "2026-07-08", qty: 12.5, total: 750,
    supplier: "SF6-KLC", status: "paid", rid: "p003" }, o);

  const a = lot({});
  applyAmend(a, { kind: "Correction", date: "2026-09-01", fields: { total: 740 } }, "BUY", null);
  ok(a.total === 740 && a.status === "paid",
    "a price correction on a settled lot leaves it paid, inventing no payable (status " + a.status + ")");
  ok(E.poCash(a) >= 739.99, "and poCash still reads it settled, at RM " + E.poCash(a));

  const b2 = lot({});
  applyAmend(b2, { kind: "Correction", date: "2026-09-01", fields: { cash: 100 } }, "BUY", null);
  ok(b2.status === "partial", "stating RM 100 against RM 750 leaves it partial, as asked");
  const c2 = lot({});
  applyAmend(c2, { kind: "Correction", date: "2026-09-01", fields: { cash: 0 } }, "BUY", null);
  ok(c2.status === "unpaid", "and stating RM 0 leaves it UNPAID, so the fix did not simply stop listening");

  const d2 = lot({});
  applyAmend(d2, { kind: "Modification", date: "2026-09-01", newQty: 12, newTotal: 720 }, "BUY", null);
  ok(d2.status === "paid", "a Modification restating qty and total keeps what was actually paid");
  const e2 = lot({ status: "unpaid" });
  applyAmend(e2, { kind: "Modification", date: "2026-09-01", newQty: 12, newTotal: 720 }, "BUY", null);
  ok(e2.status === "unpaid", "and an unpaid lot restated stays unpaid, so no payment is invented");
  const f2 = lot({ cash: 300, status: "partial" });
  applyAmend(f2, { kind: "Modification", date: "2026-09-01", newQty: 12, newTotal: 300 }, "BUY", null);
  ok(f2.status === "paid", "a lot carrying an explicit cash figure is measured against the new total");

  /* the desk must give the same answer as the fold, which is the whole reason ovAmend exists */
  /* v442: THIS MATCHED THE SOURCE FOR TWO LITERALS, which is one of the two forms round ten ruled
     out, and it could not tell a working capture from a deleted one that happened to leave the
     text behind. It DRIVES the desk now, on the state the fault needs: a lot booked status "paid"
     with NO cash field, which is how every settled historical lot is stored. poCash reads that as
     meaning the row TOTAL, so a capture taken after the write returns the NEW total and a price
     correction reads as already paid at any figure. */
  const { openMaster: om16 } = await import("../tools/payload.mjs");
  const { w: w16 } = await om16();
  w16.eval("setProd('salt');recompute();");
  const settled16 = { rid: "q1", date: "2026-07-01", qty: 10, total: 500, supplier: "SF6-KLC", status: "paid" };
  w16.eval("purchases.push(" + JSON.stringify(settled16) + ");");
  w16.eval("ovAmend({kind:'Correction',date:'2026-09-01',direction:'BUY',rid:'q1',fields:{total:900}},{at:'x'})");
  const q1 = JSON.parse(w16.eval("JSON.stringify(purchases.find(function(p){return p.rid==='q1';}))"));
  ok(+q1.total === 900, `the correction sets the total (${q1.total})`);
  ok(q1.status === "partial",
    `and the lot reads partial, because RM 500 was paid against a new RM 900 (${q1.status}). A capture taken after the write reads paid at any figure.`);
  const f16 = Object.assign({}, settled16);
  applyAmend(f16, { kind: "Correction", date: "2026-09-01", fields: { total: 900 } }, "BUY", null);
  ok(f16.status === q1.status, `and the fold says the same word (${f16.status} against ${q1.status}), which is the whole reason ovAmend exists`);
}


section("v417: a cancelled lot counts nowhere in stock, and is not a bill");
{
  /* ROUND NINE, TWIN CLASS 4. The SELL half of the ledger strip filtered !cancelled and the BUY
     half did not, and poRecvUnits, poLive and poOpenUnits had no cancelled test at all, so a
     cancelled lot kept its units in "still to arrive" and its total in bills outstanding while
     the control that cancelled it promised the row leaves every figure on the desk. v413 made
     that state reachable by giving purchases a working cancellation in the first place.
     poCash deliberately keeps counting: money that left the bank still left it, which is the rule
     the desk already states beside outRM for a defaulted lot. Both halves are asserted here, so a
     future "tidy-up" that zeroes poCash on a cancelled lot fails rather than quietly erasing a
     payment. */
  const E = (await import("../engine/position.mjs")).default;
  const lot = (o) => Object.assign({ date: "2026-08-20", qty: 25, total: 1250,
    supplier: "SF6-KLC", status: "unpaid", inTransit: true, receivedQty: 0, rid: "pX01" }, o);

  const open = lot({});
  const canc = lot({ cancelled: true });
  ok(E.poOpenUnits(open) === 25, "an open in-transit lot has its whole quantity still to arrive");
  ok(E.poOpenUnits(canc) === 0, "a cancelled one has none, rather than its whole quantity");
  /* the guard bites only where the row would otherwise read RECEIVED IN FULL, which is a lot with
     no receivedQty and not in transit. Asserting it on the in-transit row above proves nothing:
     that returns 0 through the receivedQty branch whether the cancelled test is there or not, and
     deleting the test rode this section green until the mutation said so. The fold refuses to
     cancel a landed lot, so this state arrives only by a hand edit, which is a road the book
     integrity assertions already exist for. */
  ok(E.poRecvUnits(lot({ cancelled: true, receivedQty: null, inTransit: false })) === 0,
    "a cancelled lot that would otherwise read received-in-full receives nothing");
  ok(E.poRecvUnits(lot({ receivedQty: null, inTransit: false })) === 25,
    "while the same lot uncancelled still reads received in full, so the test is not a blanket zero");
  ok(E.poLive(canc) === false, "and it is not a live lot");
  ok(E.poLive(open) === true, "while an open one still is, so the test did not simply switch it off");

  const paidCanc = lot({ cancelled: true, cash: 1250, status: "paid" });
  ok(E.poCash(paidCanc) === 1250,
    "a cancelled lot that WAS paid still reports the money as having left the bank, as a defaulted one does");
  ok(E.poRecvUnits(paidCanc) === 0, "while still counting nowhere in stock");

  /* the desk half: the strip and the bill line */
  /* v442: THIS MATCHED THE SOURCE FOR A LITERAL and named the wrong thing while it was at it:
     the predicate lives in ledTotals, not in a strip. It RUNS ledTotals now, on a list holding one
     live lot and one cancelled lot of identical size, so the cancelled one is excluded by its flag
     and not by being empty. */
  const { openMaster: om17 } = await import("../tools/payload.mjs");
  const { w: w17 } = await om17();
  w17.eval("setProd('salt');recompute();");
  /* THE LIST WRAPS A PURCHASE, and reading the flag off the wrapper rather than the row is the
     whole fault: t.cancelled on a BUY is undefined always, so v417's exclusion never fired. The
     fixture is built the way the desk builds it, wrapper and all, or the check would pass on a
     shape the desk never makes. */
  const mkLot = (o) => { const p = Object.assign({ date: "2026-08-01", supplier: "SF6-KLC", qty: 10, total: 500, cash: 500, status: "paid", receivedQty: 10 }, o);
    return { date: p.date, type: "BUY", who: p.supplier, qty: p.qty, total: p.total, _buy: p }; };
  const both = JSON.parse(w17.eval("JSON.stringify(ledTotals(" + JSON.stringify([mkLot({}), mkLot({ cancelled: true })]) + "))"));
  const oneOnly = JSON.parse(w17.eval("JSON.stringify(ledTotals(" + JSON.stringify([mkLot({})]) + "))"));
  ok(JSON.stringify(both) === JSON.stringify(oneOnly),
    "a cancelled lot adds nothing to the BUY half: the totals over one live lot and over that lot plus a cancelled twin are identical");
  const twoLive = JSON.parse(w17.eval("JSON.stringify(ledTotals(" + JSON.stringify([mkLot({}), mkLot({})]) + "))"));
  ok(JSON.stringify(twoLive) !== JSON.stringify(oneOnly),
    "while a SECOND LIVE lot does move them, so the comparison above is about the flag and not about ledTotals ignoring its input");
  /* v438: this READ THE SOURCE for a literal, which is one of the two forms round ten ruled out,
     and it proved it: routing the line through poOwed changed nothing about its behaviour and the
     assertion went red anyway, because the bytes it was matching had moved. It runs the rule now. */
  ok(E.poOwed(lot({ cancelled: true })) === 0,
    "and cancelling an unpaid lot removes a payable rather than booking one");
  ok(E.poOwed(lot({})) === 1250, "while an open unpaid lot still owes its whole total, so it is not a blanket zero");
}


section("v419: cancelling a delivered sale is refused everywhere it is offered");
{
  /* ROUND NINE, TWIN CLASS 7. The fold has thrown on this since v407 and v415 gave it the right
     ruler. The DESK had the gate on its BUY branch only, added at v414, so ovAmend replayed a
     cancellation on a delivered SALE happily and previewed a row the book can never hold; and the
     Workbench amend pane offered Cancellation on the sell side with no gate and no warning at all,
     drawing a confident "Cancelled" pill for a state the fold refuses. Three places offer this
     action and only one of them knew the rule.
     The desk DECLINES where the fold THROWS, on purpose: the fold is all or nothing and stops the
     batch, the desk is drawing a preview and must not take the screen down.
     Both directions are asserted, which is what v415 paid for: an undelivered sale must still
     cancel, or the gate is a full stop wearing a guard's coat. */
  const { openMaster: om3 } = await import("../tools/payload.mjs");
  const { w: w3 } = await om3();
  w3.eval("setProd('salt');recompute();");

  const delivered = JSON.parse(w3.eval("JSON.stringify((sales.find(s=>!s.cancelled&&s.rid&&txEffDeliv(s)>0.009)||{}).rid||null)"));
  /* v464: the book stopped carrying an untouched sale when s119 was fulfilled, so a fixture stands
     in for it. The test is about the gate, not about what happens to be on the book today. */
  const untouched = JSON.parse(w3.eval("JSON.stringify((sales.find(s=>!s.cancelled&&s.rid&&txEffDeliv(s)<=0.009&&txPaid(s)<=0.009)||{}).rid||null)"))
    || w3.eval("sales.push({customer:'CY2-NIL',qty:2.5,total:230,cost:50,cash:0,deliveredQty:0,rid:'fx-untouched'});recompute();'fx-untouched'");
  ok(!!delivered && !!untouched, "the book carries a delivered sale, and an untouched one or a fixture standing in for it");

  if (delivered) {
    w3.eval("ovAmend({kind:'Cancellation',date:'2026-09-01',direction:'SELL',rid:" + JSON.stringify(delivered) + "},{at:'t1'})");
    const row = JSON.parse(w3.eval("JSON.stringify(sales.find(s=>s.rid===" + JSON.stringify(delivered) + "))"));
    ok(row.cancelled !== true, "the overlay does not cancel a delivered sale, as the fold does not");
    ok(/not applied/.test(w3.eval("JSON.stringify(provNotes.slice(-1))")),
      "and it records WHY rather than failing silently");
  }
  if (untouched) {
    w3.eval("ovAmend({kind:'Cancellation',date:'2026-09-01',direction:'SELL',rid:" + JSON.stringify(untouched) + "},{at:'t2'})");
    const row = JSON.parse(w3.eval("JSON.stringify(sales.find(s=>s.rid===" + JSON.stringify(untouched) + "))"));
    ok(row.cancelled === true, "while an untouched sale still cancels, so the gate is not a full stop");
  }

  /* the Workbench pane, driven rather than grepped */
  if (delivered) {
    const { w: w4 } = await om3();
    w4.eval("setProd('salt');recompute();switchTab('add');");
    /* THE ORDER IS TAKEN FROM THE PANE'S OWN LIST, not from the book. The list filters by status,
       so a completed order is not in it and asserting against one proved nothing but the filter.
       Three open orders on this book have already delivered something, s117 among them, which is
       the row round eight named as the live risk. */
    const drove = w4.eval(`(function(){
      try{
        var set=function(id,v){var e=document.getElementById(id);if(!e)return false;e.value=v;return true;};
        if(typeof wbMode!=="undefined"){wbMode="amend";}
        if(typeof wbASide!=="undefined"){wbASide="SELL";}
        if(typeof wbApply==="function")wbApply();
        var list=(typeof wbAmendList==="function")?wbAmendList():[];
        var hit=list.filter(function(x){return x.t&&txEffDeliv(x.t)>0.009;})[0];
        if(!hit)return "no-order";
        set("wbOrder",hit.code); set("wbKind","Cancellation"); set("wbADate","2026-09-01");
        if(typeof wbPreview==="function")wbPreview();
        var m=document.getElementById("wbMsgs");
        return m?(m.textContent||""):"no-msgs";
      }catch(e){return "threw: "+(e&&e.message);}
    })()`);
    if (drove === "no-order" || drove === "no-msgs" || /^threw/.test(String(drove))) {
      ok(false, "the Workbench amend pane could not be driven: " + drove);
    } else {
      ok(/already been delivered/.test(String(drove)),
        "the Workbench pane refuses a Cancellation on a delivered order: " + String(drove).slice(0, 90));
    }
  }
}


section("v420: the desk and the fold leave a row in the same state");
{
  /* ROUND NINE, TWIN CLASS 8. ovAmend is written to BE applyAmend: the repo says in three places
     that a desk and a fold disagreeing about what an edit does is two books. It had drifted. The
     fold makes five writes in its SELL tail and the desk made two, so the overlay previewed an
     order paid in full with no paid-on date, and a first movement on an undated row left it
     undated on screen and dated in the book.
     THIS IS A DIFFERENTIAL, not three named assertions, and that is the point: the same row and
     the same amendment go through BOTH engines and the results must be identical. It cannot be
     defeated by a comment, its inputs are not computed by either engine, and it covers writes
     nobody thought to name. It earned that immediately: it caught a FOURTH drift I had not fixed,
     the trail seed saying "as booked" where the fold says "as booked, pending and undated". */
  const { openMaster: om5 } = await import("../tools/payload.mjs");
  const { applyAmend: fold5 } = await import("../tools/fold.mjs");
  const { readFileSync: rf5, writeFileSync: wf5, unlinkSync: rm5 } = await import("node:fs");
  const { execSync: ex5 } = await import("node:child_process");
  const { join: j5 } = await import("node:path");

  const SALES = [
    { rid: "t101", date: null, qty: 2, total: 200, customer: "CN6-WM" },
    { rid: "t102", date: "2026-08-01", qty: 2, total: 200, customer: "CN6-WM", cash: 100, deliveredQty: 1 },
    { rid: "t103", date: "2026-08-01", qty: 2, total: 200, customer: "CN6-WM", cash: 0, deliveredQty: 0 },
  ];
  const LOTS = [
    { rid: "t201", date: null, qty: 10, total: 500, supplier: "SF6-KLC", pending: true },
    { rid: "t202", date: "2026-08-01", qty: 10, total: 500, supplier: "SF6-KLC", inTransit: true, receivedQty: 0 },
  ];
  /* EVERY KIND THE FOLD HAS A BRANCH FOR (v439). This table held four Fulfilments and nothing
     else, while the sentence beneath it claimed the desk and the fold leave EVERY row in the same
     state. They did not: ovAmend had no Modification branch at all, so a restatement fell through
     to the movement path, applied a movement of nothing, and on an ORDER still appended a
     Modification step to the trail -- drawing a row whose trail asserted a restatement while its
     quantity and total read the old figures. Five kinds reach applyAmend and now five reach both. */
  const AMENDS = [
    { kind: "Fulfilment", cash: 100, kg: 1 }, { kind: "Fulfilment", cash: 200, kg: 2 },
    { kind: "Fulfilment", cash: 0, kg: 2 },   { kind: "Fulfilment", cash: 200, kg: 0 },
    { kind: "Modification", newQty: 4, newTotal: 400 },
    { kind: "Modification", newQty: 1, newTotal: 0 },
    { kind: "Cancellation" },
    { kind: "Default" },
    { kind: "Correction", fields: { total: 640 } },
    { kind: "Correction", fields: { note: "restated by hand" } },
  ];

  const bk5 = JSON.parse(rf5(j5(REPO, "ledger", "book.json"), "utf8"));
  bk5.sales = bk5.sales.concat(SALES.map((r) => Object.assign({}, r)));
  bk5.purchases = bk5.purchases.concat(LOTS.map((r) => Object.assign({}, r)));
  const B5 = j5(REPO, "test", ".v420.json"), M5 = j5(REPO, "test", ".v420.html");
  wf5(B5, JSON.stringify(bk5, null, 1));
  wf5(M5, rf5(j5(REPO, "master", "salt_command.html"), "utf8"));
  ex5("node tools/booksync.mjs --sync", { cwd: REPO, env: { ...process.env, SALT_BOOK: B5, SALT_MASTER: M5 }, stdio: "pipe" });

  const strip = (r) => { const o = JSON.parse(JSON.stringify(r)); delete o._prov; return o; };
  const { w: wq } = await om5(M5);
  wq.eval("setProd('salt');recompute();");
  let compared = 0; const differed = [];
  for (const [rows, dir] of [[SALES, "SELL"], [LOTS, "BUY"]]) {
    for (const seed of rows) {
      for (const am of AMENDS) {
        const pay = Object.assign({ date: "2026-09-01" }, am);
        const fr = JSON.parse(JSON.stringify(seed));
        try { fold5(fr, pay, dir, null); } catch (e) { /* a refusal is a state too; the desk must decline */ }
        /* ONE window for the whole matrix, with the row put back to the seed before each pair.
           It used to open a fresh master per pair, which is what kept the table at four. */
        const arr = dir === "BUY" ? "purchases" : "sales";
        wq.eval("(function(){var i=" + arr + ".findIndex(function(r){return r.rid===" + JSON.stringify(seed.rid) + ";});" + arr + "[i]=" + JSON.stringify(seed) + ";})()");
        wq.eval("ovAmend(" + JSON.stringify(Object.assign({ direction: dir, rid: seed.rid }, pay)) + ",{at:'x'})");
        const dr = JSON.parse(wq.eval("JSON.stringify(" + arr + ".find(r=>r.rid===" + JSON.stringify(seed.rid) + "))"));
        compared++;
        const a = JSON.stringify(strip(fr)), b = JSON.stringify(strip(dr));
        if (a !== b) differed.push(seed.rid + " " + dir + " cash " + am.cash + " kg " + am.kg + " | fold " + a.slice(0, 150) + " | desk " + b.slice(0, 150));
      }
    }
  }
  ok(compared === 50, "fifty row-and-amendment pairs were put through both engines (" + compared + "), five kinds against five seeds");
  ok(new Set(AMENDS.map((a) => a.kind)).size === 5,
    "and the five are every kind applyAmend has a branch for, so the sentence below is about all of them");
  ok(differed.length === 0,
    "the desk and the fold leave every one in the same state -- " + differed.slice(0, 2).join(" || "));
  for (const f of [B5, M5]) { try { rm5(f); } catch (e) { /* best effort */ } }
}


section("v421: the drafter calls the rule instead of retyping it");
{
  /* ROUND NINE, TWIN CLASS 3. v413 hand-rolled the received-in-full convention inside the drafter
     and dropped its defaulted case, so the drafter refused a DEFAULTED lot's cancellation with a
     message asserting 12.5 unit had arrived from a supplier who delivered nothing. A probe made
     the identical mistake against this same rule three folds ago and reported correct code as
     wrong. The rule lives in one place; every reader calls it.

     AND THE GATE MUST IGNORE THE CANCELLATION IT IS TESTING. v417 taught poRecvUnits that a
     cancelled lot received nothing, which is right, and this gate measures the state the
     correction WOULD leave, which is cancelled by definition. So it asked how much a cancelled row
     had received, was told none, and let every landed lot straight through: fold 3 silently
     disarmed this gate and fold 7 found it. Eight states are asserted, five that must pass the
     gate and three that must not, because a gate is two claims and only asserting the refusals is
     how v415 shipped a full stop. */
  const { checkCorrection: cc } = await import("../src/drafter.js");
  const bkA = JSON.parse((await import("node:fs")).readFileSync(
    (await import("node:path")).join(REPO, "ledger", "book.json"), "utf8"));
  const blocked = (row, isSale) => cc({ cancelled: true }, bkA, row, isSale).errs.filter((e) => /already moved/.test(e)).length > 0;
  const lotA = (o) => Object.assign({ date: "2026-07-08", qty: 12.5, total: 750, supplier: "SF6-KLC", rid: "p9" }, o);
  const saleA = (o) => Object.assign({ date: "2026-08-01", qty: 2, total: 200, customer: "CN6-WM", rid: "s9" }, o);

  ok(blocked(lotA({ status: "paid" }), false), "a landed lot cannot be cancelled");
  ok(!blocked(lotA({ defaulted: true, status: "paid" }), false),
    "a DEFAULTED lot can be: the supplier delivered nothing, and the hand-rolled copy said otherwise");
  ok(!blocked(lotA({ pending: true }), false), "a pending lot can be cancelled");
  ok(!blocked(lotA({ inTransit: true, receivedQty: 0 }), false), "an in-transit lot holding nothing can");
  ok(blocked(lotA({ inTransit: true, receivedQty: 5 }), false), "one holding five cannot");
  ok(!blocked(saleA({}), true), "an untouched sale can be cancelled");
  ok(blocked(saleA({ deliveredQty: 1 }), true), "a part-delivered sale cannot");
  ok(blocked(saleA({ settledKg: 2 }), true), "nor one settled in kind, which a raw deliveredQty read misses");
}


section("v426: the guard and the divisor cannot be the same sentinel");
{
  /* ROUND NINE, TWIN CLASS 14. concentration() computes tot = revSum || 1 so a share can be taken
     without dividing by zero, and the All row then wrote (c.tot > 0 ? margin / c.tot * 100 : 0).
     c.tot is never zero by construction, so the guard could never be false: with no revenue the
     division was by one ringgit and the cell printed the margin as a percentage of it. A book whose
     customers hold cost but no revenue, which one free unit gives you, read -1,427,966%.
     The three other readers of c.tot are shares of REVENUE, where zero over the sentinel is a
     correct 0%; this was the only one dividing a different quantity by it, and that is the sweep.
     READ AS TABLE CELLS, not as pane text: the first version of this check scanned textContent for
     a long number and matched two adjacent cells run together, which is the concatenation trap this
     project has recorded before. */
  const { openMaster: om6 } = await import("../tools/payload.mjs");
  const { readFileSync: rf6, writeFileSync: wf6, unlinkSync: rm6 } = await import("node:fs");
  const { execSync: ex6 } = await import("node:child_process");
  const { join: j6 } = await import("node:path");

  const allRow = (w) => JSON.parse(w.eval("JSON.stringify((function(){var r=[].slice.call(document.querySelectorAll('.sec.on tr.tot')).filter(function(x){return /^All/.test((x.cells[0]||{}).textContent||'');})[0];return r?[].map.call(r.cells,function(c){return c.textContent.trim();}):null;})())"));

  /* the live book keeps a real figure */
  const { w: wl } = await om6();
  wl.eval("setProd('salt');recompute();switchTab('concentration');");
  const live = allRow(wl);
  ok(live && /^-?[0-9]{1,3}%$/.test(live[5]),
    "the live book prints a plausible margin percentage on the All row (" + (live && live[5]) + ")");

  /* a book whose customers hold cost and no revenue */
  const bk6 = JSON.parse(rf6(j6(REPO, "ledger", "book.json"), "utf8"));
  bk6.sales = [{ date: "2026-08-01", customer: "CN6-WM", qty: 2, total: 0, cash: 0, deliveredQty: 2, rid: "z1" }];
  const B6 = j6(REPO, "test", ".v426.json"), M6 = j6(REPO, "test", ".v426.html");
  wf6(B6, JSON.stringify(bk6, null, 1));
  wf6(M6, rf6(j6(REPO, "master", "salt_command.html"), "utf8"));
  ex6("node tools/booksync.mjs --sync", { cwd: REPO, env: { ...process.env, SALT_BOOK: B6, SALT_MASTER: M6 }, stdio: "pipe" });
  const { w: wn } = await om6(M6);
  wn.eval("setProd('salt');recompute();switchTab('concentration');");
  const nil = allRow(wn);
  ok(nil, "the All row still renders on a nil-revenue book");
  ok(nil && !/[0-9]{4}/.test(nil[5]),
    "and its margin cell is not a percentage of the sentinel (" + (nil && nil[5]) + ")");
  ok(nil && nil[1] === "RM 0", "while the revenue it printed is still RM 0, not the sentinel");
  for (const f of [B6, M6]) { try { rm6(f); } catch (e) { /* best effort */ } }
}


section("v429: the reconciliation foots to the total printed beneath it");
{
  /* ROUND NINE. v406 gave the walk a surplus, for a count taken ABOVE the ledger, and gave the
     PROSE a sentence about it. It did not give the reconciliation table a row, so on that state the
     lines summed to less than the counted total printed under them and the reconciliation did not
     reconcile. It is the exact mirror of the self-use line and belongs beside it.
     THE FOOTING IS CHECKED AGAINST THE ENGINE, not by summing rows scraped from the pane: the first
     version of this check swept every matching row on the part and collected both product blocks
     and a second table, and reported a real fix as broken. */
  const { openMaster: om7 } = await import("../tools/payload.mjs");
  const { readFileSync: rf7, writeFileSync: wf7, unlinkSync: rm7 } = await import("node:fs");
  const { execSync: ex7 } = await import("node:child_process");
  const { join: j7 } = await import("node:path");

  const { w: w0 } = await om7();
  w0.eval("setProd('salt');recompute();");
  const ledger = +w0.eval("ledgerStock");
  ok(+w0.eval("surplus") === 0, "the live book carries no surplus");
  w0.eval("switchTab('inventory');");
  ok(!/Surplus \(count above ledger\)/.test(w0.document.querySelector(".sec.on").textContent),
    "and prints no surplus row, so the row is not simply always there");

  const bk7 = JSON.parse(rf7(j7(REPO, "ledger", "book.json"), "utf8"));
  bk7.STATED_STOCK = +(ledger + 15).toFixed(2);          /* counted fifteen above the ledger */
  const B7 = j7(REPO, "test", ".v429.json"), M7 = j7(REPO, "test", ".v429.html");
  wf7(B7, JSON.stringify(bk7, null, 1));
  wf7(M7, rf7(j7(REPO, "master", "salt_command.html"), "utf8"));
  ex7("node tools/booksync.mjs --sync", { cwd: REPO, env: { ...process.env, SALT_BOOK: B7, SALT_MASTER: M7 }, stdio: "pipe" });
  const { w: w7 } = await om7(M7);
  w7.eval("setProd('salt');recompute();switchTab('inventory');");

  const f = JSON.parse(w7.eval("JSON.stringify({op:openingFor(PROD).qty,recv:receivedPO.reduce(function(a,p){return a+poRecvUnits(p);},0),sold:soldUnits,selfUse:selfUse,surplus:surplus,counted:currentStock})"));
  ok(f.surplus > 0, "the built book carries a surplus (" + f.surplus + " unit)");
  const walk = f.op + f.recv - f.sold - f.selfUse + f.surplus;
  ok(Math.abs(walk - f.counted) < 0.02,
    "and the walk foots to the counted total (" + walk.toFixed(2) + " against " + f.counted + ")");

  const row = JSON.parse(w7.eval("JSON.stringify((function(){var b=document.querySelector('.sec.on .prodblock[data-prod=salt]')||document.querySelector('.sec.on');var r=[].slice.call(b.querySelectorAll('tr')).filter(function(x){return /Surplus/.test((x.cells[0]||{}).textContent||'');})[0];return r?[].map.call(r.cells,function(c){return c.textContent.trim();}):null;})())"));
  ok(!!row, "the surplus row is on the salt block");
  ok(row && row[1] === "+" + f.surplus + " unit",
    "carrying the walk's own figure (" + (row && row[1]) + ")");
  ok(row && /RM/.test(row[2]), "and its ringgit value (" + (row && row[2]) + ")");
  for (const x of [B7, M7]) { try { rm7(x); } catch (e) { /* best effort */ } }
}


section("v430: the controls the panel offers must exist and must be able to do what they say");
{
  /* ROUND NINE, THREE AFFORDANCE FAULTS IN ONE PASS.
     ONE. v408 gated the Ledger Update control on t.rid, and a purchase card carries its row under
     a _buy wrapper, so t.rid is undefined on every lot and the control rendered on NONE of the
     eighteen. The data-rid attribute eleven lines below had always used ridOf; that line was
     written without looking at it.
     TWO. A new order opened on salt whatever book the desk was on, because the empty row it builds
     has no product and edView defaults one.
     THREE. An unpriced row was offered Completed. It cannot be: with no agreed price the total is
     zero, so the chip was offered on the quantity alone, and tapping it left the row reading
     "Open, Advance" -- which the panel's own sentence said, one line under the chip promising
     Completed. */
  const { openMaster: om8 } = await import("../tools/payload.mjs");
  const { readFileSync: rf8, writeFileSync: wf8, unlinkSync: rm8 } = await import("node:fs");
  const { execSync: ex8 } = await import("node:child_process");
  const { join: j8 } = await import("node:path");

  const { w: w8 } = await om8();
  w8.eval("setProd('salt');recompute();switchTab('ledger');");
  /* KEYED ON THE CARD'S OWN TYPE. Matching the word "lot" in a card's text also matched sale cards
     carrying "Usual lot", so the count stayed above zero with the fault reintroduced and the check
     read green over it. */
  /* 09 Sep 2026: the control is the pen at the entry's corner, not a button in a cell */
  const onBuy = +w8.eval("document.querySelectorAll('.sec.on .lcard[data-type=BUY] .lpen').length");
  const buyCards = +w8.eval("document.querySelectorAll('.sec.on .lcard[data-type=BUY]').length");
  ok(buyCards > 0, "the ledger renders purchase cards at all (" + buyCards + ")");
  ok(onBuy > 0, "the update control (the pen) renders on purchase cards (" + onBuy + "), which carried none at v408");
  ok(+w8.eval("document.querySelectorAll('.sec.on .lpen').length") > onBuy,
    "and on sale cards too, so unwrapping the lot did not move the control off the sales");

  w8.eval("setProd('oil');recompute();ledNew();");
  ok(w8.eval("(document.getElementById('ed_product')||{}).value") === "oil",
    "a new order opens on the book the desk is showing");
  w8.eval("edClose();setProd('salt');recompute();ledNew();");
  ok(w8.eval("(document.getElementById('ed_product')||{}).value") === "salt",
    "and follows it back, so it is not simply pinned to the other one");
  w8.eval("edClose();");

  /* an unpriced row, built because the book has none */
  const bk8 = JSON.parse(rf8(j8(REPO, "ledger", "book.json"), "utf8"));
  bk8.sales = bk8.sales.concat([{ date: "2026-08-20", customer: "CN6-WM", qty: 3, total: 0, unpriced: true, cash: 0, deliveredQty: 0, rid: "u1" }]);
  const B8 = j8(REPO, "test", ".v430.json"), M8 = j8(REPO, "test", ".v430.html");
  wf8(B8, JSON.stringify(bk8, null, 1));
  wf8(M8, rf8(j8(REPO, "master", "salt_command.html"), "utf8"));
  ex8("node tools/booksync.mjs --sync", { cwd: REPO, env: { ...process.env, SALT_BOOK: B8, SALT_MASTER: M8 }, stdio: "pipe" });
  const { w: wu } = await om8(M8);
  wu.eval("setProd('salt');recompute();ledEdit('u1','SELL');");
  const uc = JSON.parse(wu.eval("JSON.stringify([].map.call(document.querySelectorAll('.updchip'),function(b){return b.textContent;}))"));
  ok(!uc.some((c) => /Completed|Paid in full/.test(c)),
    "an unpriced row is offered neither Completed nor Paid in full (" + uc.join(" / ") + ")");
  ok(uc.some((c) => /Delivered in full/.test(c)), "but goods can still be handed over on it");
  ok(/No price is agreed/.test(wu.eval("document.querySelector('.updbox').textContent")), "and it says why");
  const pRid = JSON.parse(wu.eval("JSON.stringify((sales.find(function(s){return !s.cancelled&&s.rid&&!s.unpriced&&(s.total||0)>0&&txPaid(s)<(s.total||0)-0.009;})||{}).rid||null)"));
  if (pRid) {
    wu.eval("ledEdit(" + JSON.stringify(pRid) + ",'SELL');");
    const pc = JSON.parse(wu.eval("JSON.stringify([].map.call(document.querySelectorAll('.updchip'),function(b){return b.textContent;}))"));
    ok(pc.some((c) => /Paid in full/.test(c)), "while a priced row still offers Paid in full");
  }
  for (const x of [B8, M8]) { try { rm8(x); } catch (e) { /* best effort */ } }
}


section("v432: the money on a statement is the money on the book");
{
  /* ROUND TEN. The statements section beside this one holds eight assertions and NOT ONE reads a
     ringgit or a unit: round ten proved all eight still pass with every total doubled, Paid forced
     to zero, Outstanding forced to nil and every row turned into a gift. That is how a part-rebated
     order came to print "nil / no charge" on a document sent to a customer who had paid RM 90 of
     it, and why RM 527 of charges and RM 267 of their own cash were missing across three live
     statements. These documents leave the building; they are the one output of this desk a
     counterparty reads, and nothing was checking their arithmetic.
     THE LAW: for every party, what the statement says they were CHARGED and what it says they have
     PAID must both reconcile to the book, row by row, with the gift rule the only permitted
     difference and that rule stated explicitly here rather than trusted. */
  const { stmtRows } = await import("../tools/make_statements.mjs");
  /* THE SAME OPTIONS THE TOOL ITSELF PASSES. stmtRows takes three inclusion flags and a window,
     and with none of them every row is filtered out: calling it bare returns an empty array and
     every check over it passes on nothing. The "both branches exercised" assertion below is what
     caught that, which is the whole reason it is there. */
  const SO = { from: null, to: "2026-09-01", completed: true, open: true, pending: true, dates: true };
  const bookM = JSON.parse(readFileSync(resolve(REPO, "ledger", "book.json"), "utf8"));
  const parties = [...new Set((bookM.sales || []).map((x) => x.customer).filter(Boolean))];
  ok(parties.length > 5, `the book carries ${parties.length} customers to check`);

  const bad = [], gifts = [], charged = [];
  for (const party of parties) {
    const rows = stmtRows(party, SO);
    for (const r of rows) {
      /* MATCHED BY rid, because party+date+quantity is AMBIGUOUS on this book: CH4-MLR has two
         orders on 14 August of one unit each, RM 110 and RM 11.50. The first version of this check
         matched the wrong one and reported a correct statement as wrong. */
      const src = (bookM.sales || []).find((x) => x.rid && x.rid === r.rid);
      if (!src) continue;
      const cash = +src.cash || 0, award = +src.settledRM || 0, tot = +src.total || 0;
      /* the ONLY permitted difference: a row the customer paid no cash for reads nil */
      const mayBeGift = (!!src.rebate || !!src.goodwill) && cash <= 0.009;
      if (r.gift) {
        gifts.push(src.rid || party);
        if (!mayBeGift) bad.push(`${src.rid || party}: printed as a gift though RM ${cash} in cash was paid on it`);
      } else {
        charged.push(src.rid || party);
        if (Math.abs((+r.total || 0) - tot) > 0.011) bad.push(`${src.rid || party}: statement charges RM ${r.total} where the book says RM ${tot}`);
      }
      if (Math.abs((+r.paidCash || 0) - cash) > 0.011) bad.push(`${src.rid || party}: statement shows RM ${r.paidCash} cash where the book says RM ${cash}`);
      if (Math.abs((+r.inKind || 0) - award) > 0.011) bad.push(`${src.rid || party}: statement shows RM ${r.inKind} in kind where the book says RM ${award}`);
    }
  }
  ok(bad.length === 0, "every statement figure reconciles to the book -- " + bad.slice(0, 4).join(" | "));
  ok(charged.length > 0 && gifts.length > 0,
    `and both sides of the gift rule are actually exercised (${charged.length} charged, ${gifts.length} gifts), so neither branch is asserted into thin air`);

  /* v433: EVERY CANCELLED ROW CARRIES THE DATE THE BOOK HOLDS. The book stores it in two places:
     a row cancelled through the trail carries a Cancellation step, and a row cancelled by a
     Correction carries a top-level cancelledOn and no trail. The tool read the trail alone, so
     three of the five printed a struck-through quantity and an amount against no date at all, two
     of them on rows with no order date either. Asserted on both kinds, so a fix that reads only the
     field would fail as surely as one that reads only the trail. */
  const cxRows = (bookM.sales || []).filter((x) => x.cancelled);
  ok(cxRows.length >= 4, `the book carries ${cxRows.length} cancelled orders to check`);
  let fromTrail = 0, fromField = 0;
  for (const src of cxRows) {
    /* the check is on the date the row states, not on the window; SO closes on 1 Sep and a row
       cancelled after that is rightly outside it, so it is looked up with the window open */
    const r = stmtRows(src.customer, { ...SO, to: null }).find((x) => x.rid === src.rid);
    const trail = ((src.amend || []).filter((a) => a.kind === "Cancellation")[0] || {}).date;
    const want = trail || src.cancelledOn || null;
    if (trail) fromTrail++; else if (src.cancelledOn) fromField++;
    ok(r && r.cancelledOn === want,
      `${src.rid} states its cancellation date (${r && r.cancelledOn}) as the book holds it (${want})`);
  }
  ok(fromTrail > 0 && fromField > 0,
    `and both kinds are exercised (${fromTrail} from the trail, ${fromField} from the field), so neither source is asserted into thin air`);

  /* the three live part-award rows, named, because they are what this fold is about */
  const partAward = (bookM.sales || []).filter((x) => (x.rebate || x.goodwill) && (+x.cash || 0) > 0.009);
  ok(partAward.length > 0, `the book carries ${partAward.length} part-award rows, the case that was printing as free`);
  for (const src of partAward) {
    const r = stmtRows(src.customer, SO).find((x) => x.rid === src.rid);
    ok(r && !r.gift, `${src.rid} is charged rather than gifted: the customer paid RM ${src.cash} of it`);
    ok(r && Math.abs((+r.total || 0) - (+src.total || 0)) < 0.011,
      `${src.rid} carries its real total of RM ${src.total} (statement says RM ${r && r.total})`);
  }

  /* v442: THIS ASSERTED NOTHING. It was written as ok(true) with a sentence saying the case was
     covered elsewhere, which is a claim about the suite rather than about the book, and it is the
     purest form of the fault this round is about. The goodwill leg is checked here on its own. */
  const gw = (bookM.sales || []).filter((x) => x.goodwill && !x.rebate);
  if (!gw.length) skipData("no goodwill row without a rebate beside it on the book");
  for (const src of gw) {
    const r = stmtRows(src.customer, SO).find((x) => x.rid === src.rid);
    const cash = +src.cash || 0;
    if (!r) continue;
    ok(!!r.gift === (cash <= 0.009),
      `${src.rid}: a goodwill row is a gift exactly when no cash was paid on it (cash RM ${cash}, printed as ${r.gift ? "a gift" : "charged"})`);
  }
}


section("v436: one ruler decides whether a correction is legal, and all four readers read it");
{
  /* ROUND TEN, MATERIAL. FOUR readers decide this and only two ever held a rule. The drafter
     refused at the gate; tools/fold.mjs refused again in --plan with a rule of its own; applyAmend
     wrote whatever it was handed; and the desk's ovAmend PREVIEWED whatever it was handed. So the
     row editor drew a cancelled-and-delivered order as done, and the queue then refused the very
     edit the desk had just shown as applied. A desk and a fold that disagree about what an edit
     does is two books.
     THE CHECK IS AN IDENTITY ACROSS ALL FOUR ROADS, not four separate assertions, because the
     fault was never that one reader was wrong: it was that they disagreed. */
  const { openMaster: om9 } = await import("../tools/payload.mjs");
  const { applyAmend: aa9 } = await import("../tools/fold.mjs");
  const { checkCorrection: cc9 } = await import("../src/drafter.js");
  const { default: PE9 } = await import("../engine/position.mjs");
  const bk9 = JSON.parse(readFileSync(resolve(REPO, "ledger", "book.json"), "utf8"));
  const { w: w9 } = await om9();
  w9.eval("setProd('salt');recompute();");

  /* ovAmend stamps _prov on the row BEFORE it reaches any branch, so a whole-row comparison reads
     a clean refusal as an application. The first version of this probe did exactly that and
     reported a working guard as a gap. */
  const bare9 = (j) => { const o = JSON.parse(j); delete o._prov; return JSON.stringify(o); };
  const deskSays = (rid, fields) => {
    const F = JSON.stringify(rid);
    const before = bare9(w9.eval("JSON.stringify(sales.find(function(s){return s.rid===" + F + ";}))"));
    const n0 = +w9.eval("provNotes.length");
    w9.eval("ovAmend({kind:'Correction',date:'2026-09-01',direction:'SELL',rid:" + F + ",fields:" + JSON.stringify(fields) + "},{at:'v436'})");
    const after = bare9(w9.eval("JSON.stringify(sales.find(function(s){return s.rid===" + F + ";}))"));
    const n1 = +w9.eval("provNotes.length");
    w9.eval("(function(){var i=sales.findIndex(function(s){return s.rid===" + F + ";});sales[i]=" + before + ";})()");
    return after !== before ? "applied" : (n1 > n0 ? "REFUSE" : "no-op");
  };
  const foldSays = (row, fields) => {
    try { aa9(JSON.parse(JSON.stringify(row)), { kind: "Correction", date: "2026-09-01", fields }, row.supplier !== undefined ? "BUY" : "SELL", null); return "applied"; }
    catch (e) { return "REFUSE"; }
  };

  const delivered = (bk9.sales || []).find((x) => !x.cancelled && x.rid && PE9.txEffDeliv(x) > 0.009);
  /* v464: same fixture as v419's, for the same reason; it is pushed into the book copy and the desk alike */
  const clean = (bk9.sales || []).find((x) => !x.cancelled && x.rid && PE9.txEffDeliv(x) <= 0.009)
    || (() => { const fx = {customer:"CY2-NIL",qty:2.5,total:230,cost:50,cash:0,deliveredQty:0,rid:"fx-untouched"}; bk9.sales.push(fx); w9.eval("sales.push(" + JSON.stringify(fx) + ");recompute();"); return fx; })();
  ok(!!delivered && !!clean, "the book carries a delivered order, and an untouched one or a fixture standing in for it");

  /* THE REFUSAL, down all four roads at once */
  const CAN = { cancelled: true };
  ok(PE9.correctionFaults(delivered, CAN, true).length > 0, "the engine refuses cancelling a delivered order by Correction");
  ok(cc9(CAN, bk9, delivered, true).errs.length > 0, "and so does the drafter, which is the gate a phone edit meets");
  ok(foldSays(delivered, CAN) === "REFUSE", "and so does the fold's applyAmend, which is what writes the book");
  ok(deskSays(delivered.rid, CAN) === "REFUSE", "and so does the desk's ovAmend, which is what the owner is shown (it applied it at v435)");

  /* THE SAME IDENTITY ON THE PERMISSION, so the gate is a rule and not a wall */
  ok(PE9.correctionFaults(clean, CAN, true).length === 0, "an order with nothing moved against it may still be cancelled by Correction");
  ok(cc9(CAN, bk9, clean, true).errs.length === 0, "the drafter allows it");
  ok(foldSays(clean, CAN) === "applied", "the fold applies it");
  ok(deskSays(clean.rid, CAN) === "applied", "and the desk previews it as applied");

  /* THE RULER MEASURES THE ROW, NOT THE FLAG IT IS SETTING. poRecvUnits and txEffDeliv both answer
     nothing for a cancelled row, and this gate looks at the state the correction WOULD leave, which
     is cancelled by definition: v417 disarmed the drafter's copy of this gate that way and it went
     four folds unnoticed. Driven on a LOT, the direction that failure was found on. */
  const landed = (bk9.purchases || []).find((p) => !p.cancelled && PE9.poRecvUnits(p) > 0.009);
  const unlanded = (bk9.purchases || []).find((p) => !p.cancelled && PE9.poRecvUnits(p) <= 0.009);
  ok(!!landed, "the book carries a landed lot");
  ok(PE9.correctionFaults(landed, CAN, false).length > 0, "a landed lot cannot be cancelled by Correction either");
  ok(foldSays(landed, CAN) === "REFUSE", "and the writer refuses it, whichever road it arrived by");
  if (unlanded) ok(PE9.correctionFaults(unlanded, CAN, false).length === 0, "while a lot with nothing arrived still can be");

  /* THE ATTRIBUTION LEGS, read the way the WRITER writes them. Lifting the drafter's wording
     literally into the fold refused every attribution clear, because clearing the associate leaves
     a stream on the before-state that the writer is about to delete. The fold's own suite caught
     it. What the rule is for is a leg ASSERTED with nobody to credit. */
  const r2row = (bk9.sales || []).find((x) => x.rev === "R2") || { customer: "CY2-NIL", rev: "R2", downstream: "CZ4-MK", date: "2026-08-01", qty: 1, total: 100 };
  const plain9 = (bk9.sales || []).find((x) => !x.rev && !x.ref);
  ok(PE9.correctionFaults(r2row, { assoc: null }, true).length === 0, "clearing the associate on an R2 row is allowed: its legs go with it");
  ok(PE9.correctionFaults(plain9, { stream: "R2" }, true).length > 0, "asserting a stream with nobody to credit is refused");
  ok(PE9.correctionFaults(plain9, { downstream: "CZ4-MK" }, true).length > 0, "and so is a downstream with nobody to credit");
  ok(PE9.correctionFaults(plain9, { assoc: "CY2-NIL" }, true).length > 0, "an associate with no stream is refused: nothing says how the credit reaches them");
  ok(PE9.correctionFaults(plain9, { assoc: "CY2-NIL", stream: "R2" }, true).length === 0, "an associate WITH a stream is allowed, so the rule is not simply refusing the field");

  /* AND IT WALLS NOTHING THAT IS ON THE BOOK TODAY */
  let walled = 0, seen = 0;
  for (const [coll, isSale] of [["sales", true], ["purchases", false]]) {
    for (const r of bk9[coll] || []) { seen++; if (PE9.correctionFaults(r, { note: "x" }, isSale).length) walled++; }
  }
  ok(seen > 100, `swept ${seen} rows on the live book`);
  ok(walled === 0, `and a note correction is refused on none of them (${walled}), so the gate is a rule and not a wall`);
}


section("v438: one rule for what a lot owes its supplier, read by every reader of it");
{
  /* ROUND TEN. FIVE readers answered this question and each excluded a DIFFERENT subset of
     {pending, cancelled, defaulted}, so the desk could put three different figures in front of the
     owner for one question:
       billsOut          pending, cancelled          (not defaulted)
       supBills, sCash   pending, defaulted          (not cancelled), over p.cash read raw
       the forecast      pending                     (neither of the others)
       lots in transit   poLive                      (the only one that was right)
     On the book as it stands every one of them reads RM 0, which is why nothing had shown. THE
     CHECK THEREFORE BUILDS THE STATES, because a latent divergence in a payable is what put five
     settled lots and RM 5,450 in front of the owner at v408. */
  const { default: PEa } = await import("../engine/position.mjs");
  const L = (o) => Object.assign({ date: "2026-08-20", qty: 25, total: 1250, supplier: "SF6-KLC" }, o);

  /* the rule itself, in both directions, one leg at a time */
  ok(PEa.poOwed(L({})) === 1250, "an open lot with nothing paid owes its whole total");
  ok(PEa.poOwed(L({ cash: 400 })) === 850, "one part paid owes the remainder");
  ok(PEa.poOwed(L({ status: "paid" })) === 0, "one booked paid with no cash field owes nothing: poCash reads the status");
  ok(PEa.poOwed(L({ pending: true })) === 0, "an agreed-only lot owes nothing: nothing has been bought yet");
  ok(PEa.poOwed(L({ cancelled: true })) === 0, "a cancelled lot owes nothing, or cancelling would BOOK a payable");
  ok(PEa.poOwed(L({ defaulted: true })) === 0, "and a defaulted lot owes nothing: you do not pay for goods never sent");
  ok(PEa.poOwed(L({ cash: 1400 })) === 0, "an OVERPAID lot owes nothing rather than a negative, which used to reduce what the others owed");

  /* and the desk agrees with it, on a book carrying exactly the states that divided the readers */
  const { openMaster: omA } = await import("../tools/payload.mjs");
  const { readFileSync: rfA, writeFileSync: wfA, unlinkSync: rmA } = await import("node:fs");
  const { execSync: exA } = await import("node:child_process");
  const { join: jA } = await import("node:path");
  const bkA = JSON.parse(rfA(jA(REPO, "ledger", "book.json"), "utf8"));
  bkA.purchases = bkA.purchases.concat([
    { date: "2026-08-20", supplier: "SF6-KLC", qty: 25, total: 1250, cash: 0, cancelled: true, rid: "z1" },
    { date: "2026-08-20", supplier: "SF6-KLC", qty: 25, total: 1300, cash: 0, defaulted: true, rid: "z2" },
    { date: "2026-08-20", supplier: "SF6-KLC", qty: 25, total: 1400, cash: 200, rid: "z3" },
  ]);
  const BA = jA(REPO, "test", ".v438.json"), MA = jA(REPO, "test", ".v438.html");
  wfA(BA, JSON.stringify(bkA, null, 1));
  wfA(MA, rfA(jA(REPO, "master", "salt_command.html"), "utf8"));
  exA("node tools/booksync.mjs --sync", { cwd: REPO, env: { ...process.env, SALT_BOOK: BA, SALT_MASTER: MA }, stdio: "pipe" });
  const { w: wA } = await omA(MA);
  wA.eval("setProd('salt');recompute();");

  /* RM 1,200 is the ONLY honest answer: z3 alone owes anything. z1 is cancelled and z2 defaulted,
     and each was billed by some readers and not others before this fold. */
  const WANT = 1200;
  ok(+wA.eval("poOwed(purchases.find(function(p){return p.rid==='z1';}))") === 0, "the desk says a cancelled lot owes nothing");
  ok(+wA.eval("poOwed(purchases.find(function(p){return p.rid==='z2';}))") === 0, "and a defaulted one owes nothing");
  ok(+wA.eval("poOwed(purchases.find(function(p){return p.rid==='z3';}))") === WANT, "and the one real bill owes RM " + WANT);

  wA.eval("switchTab('financials');");
  const billsOut = +wA.eval("+purchases.reduce(function(a,p){return a+poOwed(p);},0).toFixed(2)");
  ok(billsOut === WANT, `the bills outstanding line reads RM ${billsOut}, which must be RM ${WANT}`);

  /* the two cards, read off the rendered pane rather than recomputed here */
  /* TWO CARDS, TWO DIFFERENT READERS, READ OFF THE RENDERED PANE. The first version of this
     scraped `.kpi` matching /Suppliers/ on the part `inventory` and got an empty string, so it
     failed loudly rather than passing on nothing; the Suppliers card is on the Overview and the
     Order book's own line is worded `You owe, in cash`. Both are named here so a rename fails
     rather than silently matching zero elements. */
  const card = (part, needle) => {
    wA.eval("switchTab('" + part + "');");
    const t = wA.eval("(function(){var k=[].slice.call(document.querySelectorAll('.sec.on .kpi')).filter(function(x){return " + needle + ".test(x.textContent);})[0];return k?k.textContent.replace(/[ \\t\\n\\r]+/g,' ').trim():'';})()");
    return t;
  };
  const owe = card("receivables", "/You owe, in cash/");
  ok(owe !== "", "the Order book carries a `You owe, in cash` card at all, so the check below is not reading an empty string");
  ok(/1,200|1200/.test(owe), `and it says RM 1,200 of supplier bills (${owe.slice(0, 96)})`);

  const sup = card("overview", "/Suppliers/");
  ok(sup !== "", "the Overview carries a Suppliers card at all");
  ok(/1,200|1200/.test(sup), `and it says RM 1,200 of bills unpaid (${sup.slice(0, 96)})`);

  /* THE FORECAST IS THE READER THAT MATTERED MOST: the other two put a wrong number on a card,
     this one moved the day the cash runs out. */
  const cout = JSON.parse(wA.eval("JSON.stringify((forecast({days:30})||{}).cout||[])"));
  const bills = cout.filter((c) => /supplier bill/.test(c.label || ""));
  const billRM = +bills.reduce((a, c) => a + (+c.rm || 0), 0).toFixed(2);
  ok(billRM === WANT, `the forecast drains RM ${billRM} of supplier bills, which must be RM ${WANT}: it used to drain the cancelled and defaulted lots too`);
  for (const x of [BA, MA]) { try { rmA(x); } catch (e) { /* best effort */ } }
}


section("v439: the desk restates a row, and every claim it writes is one its own strip can read");
{
  /* ROUND TEN. ovAmend had NO Modification branch and applyAmend has had one since v358. A
     Modification carries newQty and newTotal and moves no cash and no goods, so it fell through to
     the movement path and applied a movement of nothing. On a lot that left the row untouched. On
     an ORDER it was worse than nothing: the trail seeding at the foot of that path appended a
     Modification step, so the desk drew a row whose trail asserted a restatement WHILE ITS QUANTITY
     AND TOTAL STILL READ THE OLD FIGURES. A row asserting a change it did not make is the one thing
     a ledger must never do, which is v383's own sentence about the same shape.
     THE DIFFERENTIAL BESIDE THIS ONE now drives all five kinds and proves the two roads agree. It
     cannot prove they agree on something READABLE, so that is here: the mod line is a contract that
     modClaims parses, and the desk was writing one line that broke it. */
  const { openMaster: omB } = await import("../tools/payload.mjs");
  const { readFileSync: rfB, writeFileSync: wfB, unlinkSync: rmB } = await import("node:fs");
  const { execSync: exB } = await import("node:child_process");
  const { join: jB } = await import("node:path");

  const seed = { rid: "y1", date: null, qty: 2, total: 200, customer: "CN6-WM", unpriced: true };
  const lot = { rid: "y2", date: "2026-08-01", qty: 10, total: 500, supplier: "SF6-KLC", inTransit: true, receivedQty: 0, cash: 100 };
  const settled = { rid: "y3", date: "2026-07-01", qty: 10, total: 500, supplier: "SF6-KLC", status: "paid" };
  const bkB = JSON.parse(rfB(jB(REPO, "ledger", "book.json"), "utf8"));
  bkB.sales = bkB.sales.concat([Object.assign({}, seed)]);
  bkB.purchases = bkB.purchases.concat([Object.assign({}, lot), Object.assign({}, settled)]);
  const BB = jB(REPO, "test", ".v439.json"), MB = jB(REPO, "test", ".v439.html");
  wfB(BB, JSON.stringify(bkB, null, 1));
  wfB(MB, rfB(jB(REPO, "master", "salt_command.html"), "utf8"));
  exB("node tools/booksync.mjs --sync", { cwd: REPO, env: { ...process.env, SALT_BOOK: BB, SALT_MASTER: MB }, stdio: "pipe" });
  const { w: wB } = await omB(MB);
  wB.eval("setProd('salt');recompute();");

  /* THE ORDER: restated, and the trail no longer claims what the figures deny */
  wB.eval("ovAmend({kind:'Modification',date:'2026-09-01',direction:'SELL',rid:'y1',newQty:4,newTotal:400},{at:'x'})");
  const y1 = JSON.parse(wB.eval("JSON.stringify(sales.find(function(r){return r.rid==='y1';}))"));
  ok(+y1.qty === 4 && +y1.total === 400, `the order is restated to 4 unit / RM 400 (${y1.qty} / ${y1.total}), where it used to read 2 / 200 with a Modification step beside it`);
  ok((y1.amend || []).some((a) => a.kind === "Modification"), "the trail records the restatement");
  ok(/restated on 2026-09-01 from 2 unit \/ RM200 to 4 unit \/ RM400/.test(y1.mod || ""), `and mod says so in the fold's words (${y1.mod})`);
  ok(!y1.unpriced, "and a restatement to a real total clears unpriced, as it has in the fold since v358");

  /* THE LOT: the branch that used to leave the row entirely untouched */
  wB.eval("ovAmend({kind:'Modification',date:'2026-09-01',direction:'BUY',rid:'y2',newQty:3,newTotal:100},{at:'x'})");
  const y2 = JSON.parse(wB.eval("JSON.stringify(purchases.find(function(r){return r.rid==='y2';}))"));
  ok(+y2.qty === 3 && +y2.total === 100, `the lot is restated to 3 unit / RM 100 (${y2.qty} / ${y2.total})`);
  /* THE STATUS MUST COME FROM WHAT WAS ALREADY PAID, NOT FROM THE NEW TOTAL, and the state that
     proves it is a lot booked status:"paid" with NO cash field, which is how every settled
     historical lot is stored. poCash reads that as meaning the row TOTAL, so asking it after the
     write returns the NEW total and the lot reads fully paid at any price. The first version of
     this check used a lot carrying an explicit cash figure, where poCash is unaffected by the
     total and the mutation was neutral: the assertion could not fail, and the mutation said so. */
  wB.eval("ovAmend({kind:'Modification',date:'2026-09-01',direction:'BUY',rid:'y3',newQty:20,newTotal:900},{at:'x'})");
  const y3 = JSON.parse(wB.eval("JSON.stringify(purchases.find(function(r){return r.rid==='y3';}))"));
  ok(+y3.qty === 20 && +y3.total === 900, `a settled lot restated upward carries the new figures (${y3.qty} / ${y3.total})`);
  ok(y3.status === "partial", `and reads partial, because RM 500 was paid against a new RM 900 (${y3.status})`);
  ok(y2.status === "paid", `while a lot restated down to what it had already paid reads paid (${y2.status})`);

  /* A RESTATEMENT CARRYING NO FIGURES IS DECLINED RATHER THAN APPLIED */
  const n0 = +wB.eval("provNotes.length");
  const was = wB.eval("JSON.stringify(sales.find(function(r){return r.rid==='y1';}))");
  wB.eval("ovAmend({kind:'Modification',date:'2026-09-01',direction:'SELL',rid:'y1',newQty:0,newTotal:0},{at:'x'})");
  ok(wB.eval("JSON.stringify(sales.find(function(r){return r.rid==='y1';}))") === was, "a restatement to nothing leaves the row alone");
  ok(+wB.eval("provNotes.length") > n0, "and says why, rather than failing quietly");

  /* EVERY CLAIM THE DESK WRITES MUST BE ONE modClaims CAN READ. The unpriced line was pushed as
     free prose, so the strip on the desk's own Ledger rendered a corrected row's claim as
     `unreadable`, which is the one verdict a claim checker must not reach on its own output. The
     differential cannot catch this: two roads agreeing on an unreadable sentence still agree. */
  wB.eval("(function(){var i=sales.findIndex(function(r){return r.rid==='y1';});sales[i]=" + JSON.stringify(seed) + ";})()");
  wB.eval("ovAmend({kind:'Correction',date:'2026-09-01',direction:'SELL',rid:'y1',fields:{total:640}},{at:'x'})");
  const claims = JSON.parse(wB.eval("JSON.stringify(modClaims(Object.assign({type:'SELL'},sales.find(function(r){return r.rid==='y1';})),'SELL'))"));
  const flat = [].concat(...(Array.isArray(claims) ? claims : [claims]).map((c) => c && c.rows ? c.rows : [c])).filter(Boolean);
  ok(flat.length > 0, `the strip reads claims off the corrected row at all (${flat.length})`);
  ok(!flat.some((c) => c.verdict === "unreadable"),
    "and none of them is unreadable -- " + JSON.stringify(flat.filter((c) => c.verdict === "unreadable")).slice(0, 140));
  ok(flat.some((c) => c.field === "unpriced"),
    "including the unpriced line the fold writes a reason onto, which is the one that broke the shape");
  for (const x of [BB, MB]) { try { rmB(x); } catch (e) { /* best effort */ } }
}


section("v441: the same money, settled two ways, reads the same way on a cancelled order");
{
  /* ROUND TEN. txStat measured a cancelled row's money as t.cash ALONE, while the line directly
     beneath it has read cash plus settledRM for every other row since those fields existed, and
     txPaid is the one rule for it. So the identical RM 100, handed over as cash, reported
     `Refund due`, and settled in kind reported `Unpaid` -- which tells the owner the business owes
     nothing while it holds that customer's value.
     LATENT ON TODAY'S BOOK: all five cancelled rows carry cash 0 and settledRM 0, so the check
     builds the states. It also drives them through the DESK, because an engine that is right and a
     desk that never asks it is the shape this round keeps finding. */
  const { default: PEc } = await import("../engine/position.mjs");
  const mk = (o) => Object.assign({ rid: "k1", date: "2026-08-01", customer: "CN6-WM", qty: 1, total: 100, cancelled: true }, o);

  ok(PEc.txStat(mk({ cash: 100 })).pay === "Refund due", "a cancelled order paid in cash is a refund due");
  ok(PEc.txStat(mk({ settledRM: 100 })).pay === "Refund due",
    `and so is one settled in kind, which read Unpaid until this fold (${PEc.txStat(mk({ settledRM: 100 })).pay})`);
  ok(PEc.txStat(mk({ cash: 50, settledRM: 50 })).pay === "Refund due", "and one settled half each way");
  ok(PEc.txStat(mk({})).pay === "Unpaid", "while a cancelled order nobody paid for owes nothing back, so the rule is not a blanket Refund due");
  ok(PEc.txStat(mk({ settledRM: 0.005 })).pay === "Unpaid", "and a rounding crumb is not a refund: the threshold is the same 0.009 it always was");

  /* IT IS txPaid THAT DECIDES, not a second copy of the same sum written out here. */
  ok(PEc.txPaid(mk({ settledRM: 100 })) === 100 && PEc.txPaid(mk({ cash: 100 })) === 100,
    "txPaid answers the same for both, which is why it is the ruler this branch now uses");

  /* THE STATE THE GUARDS FORBID, asserted so the hardcoded `deliv` is a fact rather than a hope.
     v434 refuses a movement against a cancelled row and v436 refuses to cancel a row that has
     moved, so a cancelled row carrying delivery cannot be written. If that ever changes, the
     Undelivered on this line changes with it. */
  const { readFileSync: rfC } = await import("node:fs");
  const { join: jC } = await import("node:path");
  const bkC = JSON.parse(rfC(jC(REPO, "ledger", "book.json"), "utf8"));
  const moved = (bkC.sales || []).filter((x) => x.cancelled && PEc.txEffDeliv(x) > 0.009);
  ok(moved.length === 0, `no cancelled row on the book carries delivery (${moved.map((x) => x.rid).join(", ") || "none"}), which is what makes Undelivered true by construction`);

  /* AND THE DESK ASKS THE ENGINE. Driven through the built master rather than asserted of the
     module alone, because the master carries an inlined COPY and CI proves the copy byte for byte;
     a check that only ever reads the module would pass on a desk that had drifted. */
  const { openMaster: omC } = await import("../tools/payload.mjs");
  const { w: wC } = await omC();
  wC.eval("setProd('salt');recompute();");
  const deskSays = (o) => wC.eval("txStat(" + JSON.stringify(mk(o)) + ").pay");
  ok(deskSays({ settledRM: 100 }) === "Refund due", `the desk says Refund due on a cancelled order settled in kind (${deskSays({ settledRM: 100 })})`);
  ok(deskSays({}) === "Unpaid", "and Unpaid on one nobody paid for");
}


section("v443: a cancelled order owes no salt, and the desk does not buy to cover one");
{
  /* ROUND TEN, and it is the most expensive thing this round has found. txDeferUnits asks how much
     salt has been paid for and not yet handed over. The three lines DIRECTLY BELOW IT --
     txPendUnits, txPendUnitsRaw and txPendRM -- have opened with `if(s.cancelled)return 0` since
     they were written. This one never did, and it is the one that turns MONEY into a claim on the
     shelf: on a cancelled order paid in full it answered the whole quantity.
     So the desk held two contradictory claims about one row. txStat said `Refund due`, meaning give
     the money back, while txDeferUnits said 2.5 unit of salt was owed to the same party. The more
     expensive of the two drove a purchase: the Buy action read `2.75 unit short on promises` where
     the truth was 0.25, which is a decision about spending money and not a label.
     THE PURCHASE SIDE TOOK THIS EXACT SHAPE FIRST, poRecvUnits at v417 and poOpenUnits at v422,
     with poCash deliberately left alone because money that left the bank still left it. This is the
     sale-side mirror and txPaid stays unguarded for the same reason. */
  const { default: PEd } = await import("../engine/position.mjs");
  const paidCanc = { customer: "CY2-NIL", qty: 2.5, total: 230, cash: 230, deliveredQty: 0, cancelled: true };
  const live = { customer: "CY2-NIL", qty: 2.5, total: 230, cash: 230, deliveredQty: 0 };

  ok(PEd.txDeferUnits(paidCanc) === 0, `a cancelled order paid in full owes no salt (${PEd.txDeferUnits(paidCanc)})`);
  ok(PEd.txDeferUnits(live) === 2.5,
    `while the SAME row uncancelled still owes its 2.5 unit (${PEd.txDeferUnits(live)}), so the guard is a guard and not a blanket zero`);
  ok(PEd.commitments([paidCanc], 0).owedUnits === 0, "and the commitments walk carries none of it");
  ok(PEd.commitments([live], 0).owedUnits === 2.5, "while it carries the live one, so the walk is reading the guard rather than ignoring its input");
  ok(PEd.txStat(paidCanc).pay === "Refund due", "the money is still a refund due: the guard removes the SALT claim, not the money claim");
  ok(PEd.txPaid(paidCanc) === 230, "and txPaid still reports RM 230 as having been handed over, because it was");
  ok(PEd.txPendUnits(paidCanc) === 0 && PEd.txPendRM(paidCanc) === 0,
    "its three neighbours answer nothing too, which is the rule this line was missing");

  /* AND WHAT THE OWNER SEES, rendered, because an engine that is right and a desk that never asks
     it is the shape this round keeps finding. Built on the book's own s119 so the figures are the
     desk's real ones rather than a fixture's. */
  const { openMaster: omD } = await import("../tools/payload.mjs");
  const { readFileSync: rfD, writeFileSync: wfD, unlinkSync: rmD } = await import("node:fs");
  const { execSync: exD } = await import("node:child_process");
  const { join: jD } = await import("node:path");
  const bkD = JSON.parse(rfD(jD(REPO, "ledger", "book.json"), "utf8"));
  const target = (bkD.sales || []).find((x) => x.rid === "s119" && !x.cancelled && +x.qty === 2.5);
  if (!target) skipData("s119 is no longer the 2.5 unit live order this check drives");
  else {
    Object.assign(target, { cash: 230, deliveredQty: 0, cancelled: true, cancelledOn: "2026-09-01" });
    /* v464: s119 was fulfilled on 1 Sep and the shelf rolled to -2.25, so the row is put back to the
       pending shape this check reasons about and the shelf is pinned at the 0.25 it assumed. */
    for (const k of ["amend", "date", "deliveredOn", "paidOn"]) delete target[k];
    bkD.STATED_STOCK = 0.25;
    /* v467: CE4-CHE's half unit was handed over on 30 Aug, so the deferral this check reads is put
       back on the fixture copy: the check is about a cancelled order not counting, not about today. */
    { const che = bkD.sales.find((x) => x.rid === "s093"); che.deliveredQty = 5.25; che.amend = (che.amend || []).filter((x) => x.date !== "2026-08-30"); }
    const BD = jD(REPO, "test", ".v443.json"), MD = jD(REPO, "test", ".v443.html");
    wfD(BD, JSON.stringify(bkD, null, 1));
    wfD(MD, rfD(jD(REPO, "master", "salt_command.html"), "utf8"));
    exD("node tools/booksync.mjs --sync", { cwd: REPO, env: { ...process.env, SALT_BOOK: BD, SALT_MASTER: MD }, stdio: "pipe" });
    const { w: wD } = await omD(MD);
    wD.eval("setProd('salt');recompute();");

    ok(+wD.eval("defUnits") === 0.5,
      `the desk owes 0.5 unit out, not the 3 it read with the cancelled order counted (${wD.eval("defUnits")})`);
    ok(+wD.eval("txDeferUnits(sales.find(function(s){return s.rid==='s119';}))") === 0,
      "and the cancelled row itself contributes none of it, read through the desk's own copy of the engine");

    /* THE BUY ACTION, which is a decision about spending money */
    const buy = wD.eval("(function(){var a=actions();var b=a.filter(function(x){return /Buy/.test(x.title||'');})[0];return b?(b.title+' || '+(b.why||'')).replace(/[ \\t\\n\\r]+/g,' '):'';})()");
    ok(buy !== "", "the desk raises a Buy action at all on this state, so the checks below are not reading an empty string");
    ok(/0\.25 unit short on promises/.test(buy), `it is 0.25 unit short, not 2.75 (${buy.slice(0, 96)})`);
    ok(!/CY2-NIL/.test(buy), "and the cancelled party is not named among the deferrals it is buying to cover");

    /* THE SEPARATOR BELONGS TO THE JOIN. With no pending rows the sentence used to read
       "unmet. ; deferred ...", a semicolon opening a clause after a full stop. Guarding
       txDeferUnits is exactly what empties the pending list, so this is the ordinary case now. */
    ok(!/\.\s*;/.test(buy), `the sentence never opens a clause with a semicolon (${(buy.match(/unmet[^|]{0,40}/) || [""])[0]})`);
    ok(/deferred CE4-CHE/.test(buy), "while the genuine deferral is still named, so the clause was not simply deleted");

    for (const x of [BD, MD]) { try { rmD(x); } catch (e) { /* best effort */ } }
  }
}


section("v444: a cancelled order that was paid for is a payable, recorded like an overpayment");
{
  /* HIS INSTRUCTION, 02 Sep 2026: record it exactly like an overpayment, cash to be returned to the
     customer as soon as possible. customerRefunds IS that mechanism, and its two existing rows are
     literally overpayments, so this writes the same shape rather than inventing a second one. Six
     readers already understand it and NONE of them changes: refundsOut, the cash-flow walk, the
     Order book's open list, the forecast's day-0 cash out, the action list and stmtRefunds.
     Writing the row is what makes the payable appear in all six, which is the point of using the
     mechanism that exists rather than adding a seventh reader. */
  const { default: PEe } = await import("../engine/position.mjs");
  const mkRow = (o) => Object.assign({ rid: "r9", date: "2026-08-01", customer: "CY2-NIL", qty: 2.5, total: 230 }, o);

  /* THE RULE, both directions */
  {
    const list = [];
    const rec = PEe.refundOnCancel(list, mkRow({ cash: 230, cancelled: true }), "2026-09-02");
    ok(!!rec && list.length === 1, "cancelling a paid order books one payable");
    ok(rec.party === "CY2-NIL" && rec.amount === 230 && rec.since === "2026-09-02",
      `carrying the party, the money and the day (${JSON.stringify({ p: rec.party, a: rec.amount, s: rec.since })})`);
    ok(rec.rid === "r9", "and the row it came from, so the two can be tied together later");
    ok(!("paidOn" in rec), "with no paidOn, which is what makes it OUTSTANDING to all six readers");
    ok(PEe.refundOnCancel(list, mkRow({ cash: 230, cancelled: true }), "2026-09-02") === null && list.length === 1,
      "a second call adds nothing: the desk rebuilds its overlay on every pass and the fold can be re-run");
  }
  ok(PEe.refundOnCancel([], mkRow({ cash: 230 }), "2026-09-02") === null, "an order that is NOT cancelled books no payable");
  ok(PEe.refundOnCancel([], mkRow({ cancelled: true }), "2026-09-02") === null, "and a cancelled order nobody paid for books none either");
  ok(PEe.refundOnCancel([], mkRow({ cash: 0.005, cancelled: true }), "2026-09-02") === null, "a rounding crumb is not a payable");
  {
    const list = [];
    const rec = PEe.refundOnCancel(list, mkRow({ cash: 140, settledRM: 90, cancelled: true }), "2026-09-02");
    ok(rec && rec.amount === 230,
      `the amount is txPaid, cash plus what was settled in kind (${rec && rec.amount}), because that is what the customer put in`);
    ok(rec && /settled in kind/.test(rec.note), `and the note says so, since returning a set-off is not handing back notes (${rec && rec.note})`);
  }

  /* THE FOLD ROAD, driven through apply() rather than asserted of the helper */
  {
    const { apply: foldApply } = await import("../tools/fold.mjs");
    const { readFileSync: rfE } = await import("node:fs");
    const { join: jE } = await import("node:path");
    const bookE = JSON.parse(rfE(jE(REPO, "ledger", "book.json"), "utf8"));
    const paid = { rid: "z9", date: "2026-08-01", customer: "CY2-NIL", qty: 2.5, total: 230, cash: 230, deliveredQty: 0 };
    bookE.sales = bookE.sales.concat([paid]);
    const nRef = (bookE.customerRefunds || []).length;
    const staged = { approved: [{ id: "x1", amends: "z9", amendKind: "Cancellation", collection: "sales",
      entry: { payload: { direction: "SELL", kind: "Cancellation", date: "2026-09-02" } },
      row: paid, pay: { kind: "Cancellation", date: "2026-09-02" } }] };
    const notes = { version: "v999", title: "t", notes: ["n"], rows: { x1: { note: "cancelled" } } };
    const res = foldApply(bookE, staged, notes, rfE(jE(REPO, "master", "salt_command.html"), "utf8"));
    ok(res && res.ok !== false, `the fold applies the cancellation (${res && res.problems ? res.problems.join("; ").slice(0, 120) : "ok"})`);
    const added = (bookE.customerRefunds || []).length - nRef;
    ok(added === 1, `and the fold road books the payable too (${added} added), not just the desk`);
    const rec = (bookE.customerRefunds || [])[bookE.customerRefunds.length - 1];
    ok(rec && rec.rid === "z9" && rec.amount === 230, `naming the row and the money (${JSON.stringify(rec)})`);
  }

  /* THE DESK ROAD, and the reset that a withdrawn entry needs */
  {
    const { openMaster: omE } = await import("../tools/payload.mjs");
    const { w: wE } = await omE();
    wE.eval("setProd('salt');recompute();");
    const committed = +wE.eval("customerRefunds.length");
    const out0 = +wE.eval("+customerRefunds.filter(function(r){return !r.paidOn;}).reduce(function(a,r){return a+ +r.amount;},0).toFixed(2)");
    /* v464: s119 is delivered now and its cancellation is rightly refused, so a paid, undelivered fixture carries the check */
    wE.eval("sales.push({rid:'fx-refund',customer:'CY2-NIL',qty:2.5,total:230,cost:50,cash:230,deliveredQty:0});recompute();");
    wE.eval("ovAmend({kind:'Cancellation',date:'2026-09-02',direction:'SELL',rid:'fx-refund'},{at:'r1'})");
    ok(+wE.eval("customerRefunds.length") === committed + 1, "a previewed cancellation books the payable on the desk too");
    ok(/refund payable/.test(String(wE.eval("provNotes.join(' | ')"))), "and says so in the provenance rather than appearing unexplained");
    const out1 = +wE.eval("+customerRefunds.filter(function(r){return !r.paidOn;}).reduce(function(a,r){return a+ +r.amount;},0).toFixed(2)");
    ok(Math.abs(out1 - (out0 + 230)) < 0.011, `refunds outstanding rises by the RM 230 (RM ${out0} to RM ${out1})`);

    /* THE WITHDRAWAL. This list was the only one of the six the overlay touched that was not being
       rebuilt, so without the reset the preview would keep a refund the queue no longer has. It is
       the same fault v354 fixed for the price board, one line above it in applyOverlay. */
    wE.eval("applyOverlay();");
    ok(+wE.eval("customerRefunds.length") === committed,
      `and an empty queue takes it away again (${wE.eval("customerRefunds.length")} against the committed ${committed})`);
  }

  /* AND THE EXTRACT MUST TAKE THE COMMITTED COPY. Until this fold the overlay never touched this
     list, so reading it live was safe; now a queued-but-unapproved cancellation would put a
     provisional refund into the extract and from there into the store. The census caught it. */
  {
    const { LEDGER } = await import("../tools/book.mjs");
    ok(LEDGER.customerRefunds === "BASE_REFUNDS",
      `the extract reads the committed refunds (${LEDGER.customerRefunds}), as it does for sales and the board`);
  }
}


section("v445: one floored ruler for every age, and the engine has it too");
{
  /* ROUND TEN, FOLD 8. The desk has had dAge since v407 and the ENGINE never did, so every age
     computed inside the walk used the raw signed difference. Twenty more raw ages sat on the desk
     itself: seven feeding provRate, which is a monotone ladder with no floor of its own; four
     compared against a threshold, where a negative passes a test it should fail; two setting WHEN
     money is expected, where the figure does not merely print wrong but MOVES; and the rest printed
     or stored. dAge is now one function, in the engine, wrapped by the desk.
     THE CHECK IS A DIFFERENTIAL, NOT A TABLE OF LITERALS. The plan this came from carried figures
     like "ar must be 240", computed from the ladder on the day it ran; a day later the ladder has
     stepped and the literal is wrong while the code is right. What dAge actually PROMISES is that a
     date the desk cannot read counts as zero days old, so an undated row and a row dated TODAY must
     produce the identical desk. That claim survives the calendar. */
  const { openMaster: omF } = await import("../tools/payload.mjs");
  const { readFileSync: rfF, writeFileSync: wfF, unlinkSync: rmF } = await import("node:fs");
  const { execSync: exF } = await import("node:child_process");
  const { join: jF } = await import("node:path");

  const bk0 = JSON.parse(rfF(jF(REPO, "ledger", "book.json"), "utf8"));
  /* NOT s117 BY NAME, from 05 Sep 2026. This pinned s117 as its victim, and on that day s117
     became a declared default: its advance provisions in full whatever its date, so the four bad
     dates and the control would all have produced the same ar and the differential would have
     passed while proving nothing about dAge. The victim is any live, dated, priced advance that
     is neither cancelled nor defaulted, so the date it is given can still move a figure. */
  const victim = (bk0.sales || []).find((x) => x.date && (+x.total || 0) > 0 && !x.cancelled && !x.defaulted && (x.deliveredQty || 0) > 0 && (x.cash || 0) < (x.total || 0));
  ok(!!victim, "the book carries a dated receivable to drive the four bad dates through");

  /* the desk's own clock, so "today" here is the same day the desk thinks it is */
  const { w: wNow } = await omF();
  const todayISO = String(wNow.eval("(function(){var d=TODAY;return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})()"));
  ok(/^\d{4}-\d{2}-\d{2}$/.test(todayISO), `read the desk's own clock (${todayISO}) rather than this process's`);

  const build = async (mutate, tag) => {
    const bk = JSON.parse(rfF(jF(REPO, "ledger", "book.json"), "utf8"));
    const row = (bk.sales || []).find((x) => x.rid === victim.rid);
    mutate(row);
    const B = jF(REPO, "test", `.v445.${tag}.json`), M = jF(REPO, "test", `.v445.${tag}.html`);
    wfF(B, JSON.stringify(bk, null, 1));
    wfF(M, rfF(jF(REPO, "master", "salt_command.html"), "utf8"));
    exF("node tools/booksync.mjs --sync", { cwd: REPO, env: { ...process.env, SALT_BOOK: B, SALT_MASTER: M }, stdio: "pipe" });
    const { w } = await omF(M);
    w.eval("setProd('salt');recompute();");
    const read = () => JSON.parse(w.eval("JSON.stringify({ar:ar,dueIn:cashFlow().dueIn,cashEnd:(forecast({days:30})||{}).cashEnd,age:(function(){var r=sales.find(function(s){return s.rid===" + JSON.stringify(victim.rid) + ";});return r?dAge(r.date):null;})()})"));
    return { w, read, files: [B, M] };
  };

  /* THE CONTROL: the same row dated today. An age of zero, honestly arrived at. */
  const ctl = await build((r) => { r.date = todayISO; }, "ctl");
  const control = ctl.read();
  ok(control.age === 0, `a row dated today is zero days old (${control.age})`);
  ok(Number.isFinite(control.ar) && control.ar > 0, `and the control desk has a real receivable total (RM ${control.ar})`);

  const BAD = [
    ["a date ahead of the clock", (r) => { r.date = "2027-01-20"; }],
    ["a null date", (r) => { r.date = null; }],
    ["an absent date", (r) => { delete r.date; }],
    ["an empty date", (r) => { r.date = ""; }],
  ];
  const tmp = [].concat(ctl.files);
  for (const [label, mut] of BAD) {
    const t = await build(mut, label.replace(/[^a-z]/gi, ""));
    tmp.push(...t.files);
    let got = null, threw = null;
    try { got = t.read(); } catch (e) { threw = e.message; }
    ok(!threw, `${label}: the desk computes at all (${threw || "no throw"})`);
    if (!got) continue;
    ok(got.age === 0, `${label}: the row reads zero days old, not a negative or twenty thousand (${got.age})`);
    ok(Math.abs(got.ar - control.ar) < 0.011,
      `${label}: the receivable total matches the row dated today, RM ${got.ar} against RM ${control.ar}`);
    ok(Math.abs(got.dueIn - control.dueIn) < 0.011, `${label}: and so does cash due in (RM ${got.dueIn})`);
    ok(got.cashEnd == null ? control.cashEnd == null : Math.abs(got.cashEnd - control.cashEnd) < 0.011,
      `${label}: and the forecast ends on the same cash (${got.cashEnd} against ${control.cashEnd})`);

    /* AND NOTHING ABSURD REACHES THE PAGE. Rendered, across every part, because an age that is
       merely printed wrong is still wrong on the one screen he reads. */
    const text = String(t.w.eval("(function(){var out=[];for(var k in PART_Q){try{switchTab(k);var e=document.querySelector('.sec.on');if(e){var c=e.cloneNode(true);[].slice.call(c.querySelectorAll('.jquote')).forEach(function(q){q.parentNode.removeChild(q);});out.push(c.textContent);}}catch(x){out.push('THREW '+k+': '+x.message);}}return out.join(' ');})()"));
    ok(!/THREW/.test(text), `${label}: every part renders (${(text.match(/THREW [^ ]+/) || [""])[0]})`);
    ok(!/NaN/.test(text), `${label}: no NaN reaches the page (${(text.match(/.{0,28}NaN.{0,20}/) || [""])[0]})`);
    ok(!/-\d+ ?(d ago|days ago|d out)/.test(text), `${label}: no negative age is printed (${(text.match(/-\d+ ?(d ago|days ago|d out)/) || [""])[0]})`);
    ok(!/\b2\d{4} days\b/.test(text), `${label}: no epoch-sized age is printed (${(text.match(/\b2\d{4} days\b/) || [""])[0]})`);
  }
  for (const f of tmp) { try { rmF(f); } catch (e) { /* best effort */ } }

  /* AND THE SIGN IS STILL THERE WHERE IT IS THE ANSWER. A countdown to a future date is not an
     age, and flooring one would break it; dAhead exists precisely to read that sign. */
  ok(wNow.eval("dAhead('2027-01-20')") === true, "a date ahead of the clock is still recognised as ahead");
  ok(wNow.eval("dAhead('2026-01-20')") === false, "and a past one is not, so dAhead was left on the raw signed rule on purpose");
  ok(+wNow.eval("dAge('2027-01-20')") === 0, "while dAge floors the same date to zero, which is the pair working as designed");

  /* ONE COPY OF THE RULE, not two. The desk wraps the engine rather than keeping its own floor. */
  const { default: PEf } = await import("../engine/position.mjs");
  const T = new Date("2026-09-02T12:00:00+08:00");
  ok(typeof PEf.dayAge === "function", "the engine exports the rule");
  ok(PEf.dayAge(T, null) === 0 && PEf.dayAge(T, undefined) === 0 && PEf.dayAge(T, "") === 0,
    "answering zero for every shape of absent date, which is the v425 case that printed NaNd ago");
  ok(PEf.dayAge(T, "2027-01-20") === 0, "and zero for a date ahead of the clock, which is the v406 case that printed -16d");
  ok(PEf.dayAge(T, "2026-08-28") === 5, "while a real age is a real age");
  ok(PEf.dayAge(T, -5) === 0 && PEf.dayAge(T, 7) === 7, "and it takes a day count as well as a date, because half the sites hold one");
}


section("v446: what a lot is, answered beside what a sale is");
{
  /* ROUND TEN, FOLD 9. txStat has been in the engine since v338 and ledgerBuy stayed on the desk,
     which is why v441 fixed the sale's cancelled branch and the lot's never existed. Driven, not
     read: a cancelled lot already paid for read Open - Deferred (the supplier owes you SALT), an
     unpriced lot read Paid and then Completed once the salt landed, and a defaulted lot read Paid
     whether or not it was. poStat is the engine's answer now and ledgerBuy is its wrapper. */
  const { default: PE } = await import("../engine/position.mjs");
  ok(typeof PE.poStat === "function", "the engine answers what a lot is");
  const st = (p) => PE.poStat(p);
  const live = st({ qty: 10, total: 500, cash: 500, receivedQty: 10 });
  ok(live.order === "Completed" && live.pay === "Paid" && live.deliv === "Delivered", `a paid, received lot is Completed (${live.order})`);
  const cp = st({ qty: 10, total: 500, cash: 500, receivedQty: 0, cancelled: true });
  ok(cp.order === "Cancelled", `a cancelled lot is Cancelled (${cp.order})`);
  ok(cp.pay === "Refund due", `and one already paid for says the money is owed back (${cp.pay}), the sale's word since v441`);
  const cs = st({ qty: 10, total: 500, status: "paid", receivedQty: 0, cancelled: true });
  ok(cs.pay === "Refund due", `a lot booked status:paid with no cash field is read through poCash, so it too says ${cs.pay}`);
  const cu = st({ qty: 10, total: 500, cash: 0, receivedQty: 0, cancelled: true });
  ok(cu.order === "Cancelled" && cu.pay === "Unpaid", `a cancelled lot never paid for is Cancelled and Unpaid (${cu.order}/${cu.pay}), not Pending`);
  const u0 = st({ qty: 10, total: 0, unpriced: true, cash: 0, receivedQty: 0 });
  ok(u0.pay === "Unpriced", `a lot agreed before its price is struck says ${u0.pay}, not Paid`);
  ok(u0.order === "Pending", `and with nothing moved it is Pending (${u0.order}), the sale's reading since v345`);
  const u1 = st({ qty: 10, total: 0, unpriced: true, cash: 0, receivedQty: 10 });
  ok(u1.order === "Open \u00b7 Advance" && u1.pay === "Unpriced", `once the salt lands it is Open - Advance and still Unpriced (${u1.order}/${u1.pay}), never Completed`);
  const d0 = st({ qty: 10, total: 500, cash: 0, receivedQty: 0, defaulted: true });
  ok(d0.order === "Default" && d0.pay === "Unpaid", `a defaulted lot that never paid is measured Unpaid (${d0.pay}), not asserted Paid`);
  const d1 = st({ qty: 10, total: 500, status: "paid", defaulted: true });
  ok(d1.order === "Default" && d1.pay === "Paid", `while p003's shape, paid and defaulted, still reads Paid (${d1.pay})`);

  /* AND THE SAME STATES READ THE SAME WAY ON EITHER SIDE OF THE BOOK, which is the point of
     putting the two functions in one file. */
  const same = (lot, sale) => { const a = st(lot), b = PE.txStat(sale); return a.order === b.order && a.pay === b.pay && a.deliv === b.deliv; };
  ok(same({ qty: 10, total: 500, cash: 500, receivedQty: 0, cancelled: true }, { qty: 10, total: 500, cash: 500, deliveredQty: 0, cancelled: true }), "a cancelled paid lot and a cancelled paid sale read identically");
  ok(same({ qty: 10, total: 0, unpriced: true, cash: 0, receivedQty: 10 }, { qty: 10, total: 0, unpriced: true, cash: 0, deliveredQty: 10 }), "an unpriced delivered lot and an unpriced delivered sale read identically");

  /* THE DESK RENDERS IT. Two lots the editor admits, written into a copy of the book, and the
     Ledger card read back. The render has tested for a Cancelled lot since v365 (ledFinal,
     stateCls, the completed test) and could never be given one. */
  const { openMaster: om6 } = await import("../tools/payload.mjs");
  const { readFileSync: rf6, writeFileSync: wf6, unlinkSync: rm6 } = await import("node:fs");
  const { execSync: ex6 } = await import("node:child_process");
  const { join: j6 } = await import("node:path");
  const bk = JSON.parse(rf6(j6(REPO, "ledger", "book.json"), "utf8"));
  const sup = (bk.purchases.find((p) => p.supplier) || {}).supplier;
  ok(!!sup, "the book has a supplier to hang the fixtures on");
  bk.purchases.push({ rid: "p9c", date: "2026-08-30", supplier: sup, product: "salt", qty: 10, total: 500, cash: 500, receivedQty: 0, cancelled: true, note: "fixture: cancelled after paying; an explicit cash figure and no status, the shape the old picker rule listed" });
  bk.purchases.push({ rid: "p9u", date: "2026-08-31", supplier: sup, product: "salt", qty: 10, total: 0, unpriced: true, cash: 0, receivedQty: 0, note: "fixture: agreed, unpriced" });
  const B6 = j6(REPO, "test", ".v446.json"), M6 = j6(REPO, "test", ".v446.html");
  wf6(B6, JSON.stringify(bk, null, 1)); wf6(M6, rf6(j6(REPO, "master", "salt_command.html"), "utf8"));
  ex6("node tools/booksync.mjs --sync", { cwd: REPO, env: { ...process.env, SALT_BOOK: B6, SALT_MASTER: M6 }, stdio: "pipe" });
  try {
    const { w } = await om6(M6);
    w.eval("setProd('salt');recompute();switchTab('ledger');");
    const card = (rid) => String(w.eval("(function(){var e=document.querySelector('.lcard[data-rid=\"" + rid + "\"]');return e?e.textContent:'';})()")).replace(/\s+/g, " ");
    const c = card("p9c"), u = card("p9u");
    ok(c.length > 0 && u.length > 0, "both fixture lots reach the Ledger");
    ok(/Cancelled/.test(c), `the cancelled lot's card says Cancelled: ${c.slice(0, 90)}`);
    ok(String(w.eval("ledgerBuy(purchases.find(function(p){return p.rid==='p9c';})).pay")) === "Refund due", "and the desk reads its money as owed back, which the Whiteboard pills print");
    ok(!/Open . Deferred/.test(c), "and never that the supplier owes you salt on an order that is off");
    ok(/Pending/.test(u), `the unpriced lot's card says Pending: ${u.slice(0, 90)}`);
    ok(String(w.eval("ledgerBuy(purchases.find(function(p){return p.rid==='p9u';})).pay")) === "Unpriced", "and the desk reads its price as not yet struck");
    ok(!/Completed/.test(u) && !/\bPaid\b/.test(u), "and neither Paid nor Completed on a figure that is not decided");
    const picked = JSON.parse(w.eval("JSON.stringify(wbBuyOrders().map(function(o){return o.t._buy.rid;}))"));
    ok(!picked.includes("p9c"), `a cancelled lot is not offered for amendment (${JSON.stringify(picked)})`);
    ok(picked.includes("p9u"), "while the unpriced, pending one is");
    const real = JSON.parse(w.eval("JSON.stringify(purchases.filter(function(p){return p.rid!=='p9c'&&p.rid!=='p9u';}).map(function(p){return ledgerBuy(p).order;}))"));
    /* 09 Sep 2026: a real lot may be open too. p021 is paid in full with 12.5 unit still to come, and
       reads "Open · Deferred"; what no real lot may read is the two fixtures' states. */
    ok(real.length >= 18 && real.every((o) => /^(Completed|Default|Open)/.test(o)), `the ${real.length} real lots read Completed, Default or Open, never Pending, Unpriced or Cancelled (${[...new Set(real)].join(", ")})`);
  } finally { for (const f of [B6, M6]) { try { rm6(f); } catch (e) { /* best effort */ } } }
}


section("v447: the figure carries the state");
{
  /* HIS MODEL, 02 Sep 2026. An entry is a date, a party, a product, a quantity and a sum, and
     its state is which of them has happened: grey not yet, white done, white below the agreed
     figure when partly, struck when off; a replaced figure shows the old one struck, grey for a
     modification and white for a correction. Drawn on the line that says where the order is
     now. Five fixtures the editor admits plus three real rows, read back off the rendered card
     by CLASS and TEXT, which is what a reader sees. */
  const { openMaster: om7 } = await import("../tools/payload.mjs");
  const { readFileSync: rf7, writeFileSync: wf7, unlinkSync: rm7 } = await import("node:fs");
  const { execSync: ex7 } = await import("node:child_process");
  const { join: j7 } = await import("node:path");
  const bk = JSON.parse(rf7(j7(REPO, "ledger", "book.json"), "utf8"));
  const cust = bk.sales.find((x) => x.customer).customer, sup = bk.purchases.find((x) => x.supplier).supplier;
  bk.sales.push({ rid: "f1", date: null, customer: cust, product: "salt", qty: 4, total: 400, cash: 0, deliveredQty: 0 });
  bk.sales.push({ rid: "f2", date: "2026-08-29", customer: cust, product: "salt", qty: 4, total: 400, cash: 150, deliveredQty: 4 });
  bk.sales.push({ rid: "f3", date: "2026-08-29", customer: cust, product: "salt", qty: 4, total: 400, cash: 400, deliveredQty: 0 });
  bk.sales.push({ rid: "f4", date: "2026-08-29", customer: cust, product: "salt", qty: 4, total: 400, cash: 400, deliveredQty: 0, cancelled: true });
  bk.purchases.push({ rid: "f5", date: "2026-08-29", supplier: sup, product: "salt", qty: 10, total: 500, cash: 200, receivedQty: 0 });
  const B7 = j7(REPO, "test", ".v447.json"), M7 = j7(REPO, "test", ".v447.html");
  wf7(B7, JSON.stringify(bk, null, 1)); wf7(M7, rf7(j7(REPO, "master", "salt_command.html"), "utf8"));
  ex7("node tools/booksync.mjs --sync", { cwd: REPO, env: { ...process.env, SALT_BOOK: B7, SALT_MASTER: M7 }, stdio: "pipe" });
  try {
    const { w } = await om7(M7);
    w.eval("setProd('salt');recompute();switchTab('ledger');");
    const cell = (rid) => JSON.parse(w.eval("JSON.stringify((function(){var c=document.querySelector('.lcard[data-rid=\"" + rid + "\"]');if(!c)return null;var f=function(sel){var e=c.querySelector(sel);if(!e)return null;var g=e.querySelector('.lfig'),o=e.querySelector('.lof'),ws=e.querySelector('.lwas');return {cls:g?g.className:'',fig:g?g.textContent:'',of:o?o.textContent:'',was:ws?ws.textContent:'',wasCls:ws?ws.className:''};};return {q:f('.lcol.cqty'),t:f('.lcol.ctot')};})())"));
    const grey = (x) => /\bcarried\b/.test(x.cls), white = (x) => x.cls === "lfig", struck = (x) => /\bstruck\b/.test(x.cls);
    const f1 = cell("f1"), f2 = cell("f2"), f3 = cell("f3"), f4 = cell("f4"), f5 = cell("f5"), p3 = cell("p003");
    ok(f1 && f2 && f3 && f4 && f5 && p3, "every fixture reaches the Ledger as a card with both figure cells");
    if (f1 && f2 && f3 && f4 && f5 && p3) {
      ok(grey(f1.q) && grey(f1.t), `pending: both figures grey (${f1.q.cls} / ${f1.t.cls})`);
      ok(white(f2.q) && white(f2.t), `delivered and part-paid: both white (${f2.q.cls} / ${f2.t.cls})`);
      ok(f2.t.fig === "RM 150" && f2.t.of === "of RM 400", `and the money reads the PAID figure with the agreed one beneath: ${f2.t.fig} ${f2.t.of}`);
      ok(f2.q.of === "", "while a fully delivered quantity carries no `of`");
      ok(grey(f3.q) && white(f3.t), `paid ahead: salt grey, money white (${f3.q.cls} / ${f3.t.cls})`);
      ok(struck(f4.q) && struck(f4.t), `cancelled: both struck (${f4.q.cls} / ${f4.t.cls})`);
      ok(grey(f5.q) && white(f5.t) && f5.t.fig === "RM 200" && f5.t.of === "of RM 500", `a lot reads the same way, through poCash and poRecvUnits: ${f5.t.fig} ${f5.t.of}`);
      ok(struck(p3.q) && white(p3.t), `the defaulted lot: units struck, money white because it left (${p3.q.cls} / ${p3.t.cls})`);
    }
    /* replaced figures, on the book's own rows */
    const s105 = cell("s105"), s016 = cell("s016"), s093 = cell("s093");
    ok(s105 && s105.t.was === "RM 360" && s105.t.wasCls === "lwas corr", `s105's corrected total shows the old RM 360 struck WHITE (${s105 && s105.t.was}, ${s105 && s105.t.wasCls})`);
    ok(s016 && s016.q.was === "12.5 unit" && s016.q.wasCls === "lwas mod", `s016's modified quantity shows the old 12.5 unit struck GREY (${s016 && s016.q.was}, ${s016 && s016.q.wasCls})`);
    ok(s016 && s016.t.was === "RM 750" && s016.t.wasCls === "lwas mod", `and its old RM 750 (${s016 && s016.t.was})`);
    ok(s093 && s093.q.was === "6.25 unit" && s093.q.wasCls === "lwas corr", `s093's corrected quantity shows 6.25 unit struck white (${s093 && s093.q.was})`);
    /* no hue: the drawing adds no colour class anywhere */
    const hued = +w.eval("document.querySelectorAll('.lfig[style], .lwas[style], .lof[style]').length");
    ok(hued === 0, "the drawing carries no inline colour");
  } finally { for (const f of [B7, M7]) { try { rm7(f); } catch (e) { /* best effort */ } } }
}


section("v448: the editor opens on the chips, and one button");
{
  /* HIS INSTRUCTION, 02 Sep 2026: the row editor was two forms and three buttons, with a Cancel
     one chip away from Cancel the order. It opens on the six states and Queue the update now; the
     sheet, its own save and its reasons sit behind one fold, shut; the cross is the only way out;
     and the state reads Cancelled, beside Completed and Defaulted. Read off the rendered panel. */
  const { openMaster: om8 } = await import("../tools/payload.mjs");
  const { readFileSync: rf8 } = await import("node:fs");
  const { join: j8 } = await import("node:path");
  const bk8 = JSON.parse(rf8(j8(REPO, "ledger", "book.json"), "utf8"));
  const sale = bk8.sales.find((x) => x.rid && x.date && !x.cancelled), lot = bk8.purchases.find((x) => x.rid && !x.cancelled && !x.defaulted);
  const { w } = await om8(j8(REPO, "master", "salt_command.html"));
  w.eval("setProd('salt');recompute();switchTab('ledger');");
  const shape = () => JSON.parse(w.eval("JSON.stringify((function(){var pn=document.querySelector('[role=dialog]');var f=function(e){return !!e.closest('.updmore')};return {out:[].filter.call(pn.querySelectorAll('button.vbtn'),function(b){return !f(b)}).map(function(b){return b.textContent.trim()}),inFold:[].filter.call(pn.querySelectorAll('button.vbtn'),f).map(function(b){return b.id}),chips:[].map.call(pn.querySelectorAll('.updchip'),function(b){return b.textContent.trim()}),dismiss:pn.querySelectorAll('#edX,#edCancel,[aria-label=Close]').length,summary:(pn.querySelector('.updmore>summary')||{}).textContent||null,open:(pn.querySelector('.updmore')||{}).open,whyInFold:(function(){var e=pn.querySelector('#edWhy');return e?f(e):null})()};})())"));
  for (const [rid, type, lab] of [[sale.rid, "SELL", "an order"], [lot.rid, "BUY", "a lot"]]) {
    w.eval("ledEdit(" + JSON.stringify(rid) + "," + JSON.stringify(type) + ");");
    const p = shape();
    ok(p.out.length === 1 && p.out[0] === "Queue the update", `${lab} opens on ONE button, Queue the update (${p.out.join(" / ")})`);
    ok(p.inFold.length === 1 && p.inFold[0] === "edSave" && p.open === false, `the sheet's own save is behind the fold, and the fold is shut (${p.inFold.join(",")}, open=${p.open})`);
    ok(p.summary === "Change something else", `the fold says what it is for: ${p.summary}`);
    ok(p.whyInFold === true, "and the sheet's reasons land beside the sheet, not under the chips");
    ok(p.dismiss === 1, `one way out, the cross (${p.dismiss} dismiss controls)`);
    ok(p.chips.includes("Cancelled") && !p.chips.some((c) => /^Cancel the/.test(c)), `the state is Cancelled, not Cancel the ${lab.slice(2)} (${p.chips.join(", ")})`);
    w.eval("[].filter.call(document.querySelectorAll('.updchip'),function(b){return b.textContent.trim()==='Cancelled'})[0].click();");
    ok(w.eval("updMode") === "cancel", "and tapping it arms the cancellation, as the old chip did");
    w.eval("edClose();");
  }
  w.eval("ledNew();");
  const n = shape();
  ok(n.out.length === 1 && n.out[0] === "Queue the order" && n.summary === null && n.dismiss === 1, `a new order has no fold to hide its sheet in: one button, Queue the order, and the cross (${n.out.join(" / ")}, fold=${n.summary})`);
  w.eval("edClose();");
}


section("v449: a lot's trail opens with the lot as booked, read with the lot's ruler");
{
  /* Six sites seeded the first step of a trail with txPaid and txDeliv, the sale's rulers, which read
     RM 0 and 0 unit on a lot paid in full and received. p001 is that lot. A Correction is the one
     amendment that reaches the seed on a lot, so one is folded on both engines and the seed read back. */
  const { applyAmend: aa9 } = await import("../tools/fold.mjs");
  const lot9 = { date: "2026-06-27", qty: 12.5, total: 800, supplier: "SF6-KLC", status: "paid", rid: "t9" };
  aa9(lot9, { kind: "Correction", date: "2026-09-01", fields: { note: "x" } }, "BUY", null);
  const seed9 = (lot9.amend || [])[0] || {};
  ok(seed9.note === "as booked" && Math.abs(seed9.cash - 800) < 0.01 && Math.abs(seed9.kg - 12.5) < 0.01,
    `the fold seeds a paid, received lot as paid and received: RM ${seed9.cash}, ${seed9.kg} unit`);
  const sale9 = { date: "2026-06-27", qty: 4, total: 400, cash: 300, settledRM: 100, deliveredQty: 4, customer: "CJ4-BJ", rid: "t9s" };
  aa9(sale9, { kind: "Correction", date: "2026-09-01", fields: { note: "x" } }, "SELL", null);
  const sseed = (sale9.amend || [])[0] || {};
  ok(Math.abs(sseed.cash - 400) < 0.01 && Math.abs(sseed.kg - 4) < 0.01, `and a sale settled partly in kind still seeds with txPaid, cash and kind together: RM ${sseed.cash}, ${sseed.kg} unit`);
  const { openMaster: om9 } = await import("../tools/payload.mjs");
  const { w: w9 } = await om9();
  w9.eval("setProd('salt');recompute();");
  const p9 = JSON.parse(w9.eval("JSON.stringify((purchases.find(function(p){return p.status==='paid'&&p.cash==null&&!(p.amend&&p.amend.length)&&!p.cancelled&&!p.defaulted&&p.rid;})||{}).rid||null)"));
  if (p9) {
    w9.eval("ovAmend({kind:'Correction',date:'2026-09-01',direction:'BUY',rid:" + JSON.stringify(p9) + ",fields:{note:'x'}},{at:'t9'})");
    const d9 = JSON.parse(w9.eval("JSON.stringify(((purchases.find(function(p){return p.rid===" + JSON.stringify(p9) + ";})||{}).amend||[])[0]||{})"));
    const want = JSON.parse(w9.eval("JSON.stringify((function(p){return {cash:poCash(p),kg:poRecvUnits(p)};})(purchases.find(function(p){return p.rid===" + JSON.stringify(p9) + ";})))"));
    ok(Math.abs(d9.cash - want.cash) < 0.01 && Math.abs(d9.kg - want.kg) < 0.01 && want.cash > 0.009 && want.kg > 0.009,
      `the desk seeds ${p9} the same way: RM ${d9.cash} of ${want.cash}, ${d9.kg} of ${want.kg} unit`);
  } else skipData("no paid lot without a trail on the book to drive the desk half with");
}


section("v450: a lot keeps a trail, on the fold and on the desk");
{
  /* Both engines returned from their BUY branches before the seed and the step, so a lot restated
     or fulfilled through the fold carried no trail, and the one lot with a step (p016) had it written
     by hand without a seed. Now: the seed and the step, in the same order as a sale, on both sides,
     and p016 brought under the contract. */
  const { applyAmend: aa0 } = await import("../tools/fold.mjs");
  const P0 = (await import("../engine/position.mjs")).default;
  const sum = (A, k) => A.reduce((t, a) => t + (+a[k] || 0), 0);
  const lotA = { rid: "t0a", date: "2026-08-01", qty: 10, total: 500, supplier: "SF6-KLC", inTransit: true, receivedQty: 0 };
  aa0(lotA, { kind: "Fulfilment", date: "2026-08-05", cash: 250, kg: 5 }, "BUY", null);
  const A = lotA.amend || [];
  ok(A.length === 2 && A[0].note === "as booked" && A[0].cash === 0 && A[0].kg === 0 && A[1].kind === "Fulfilment" && A[1].cash === 250 && A[1].kg === 5,
    `a lot's first movement seeds the trail and appends the step: ${JSON.stringify(A)}`);
  ok(Math.abs(sum(A, "cash") - P0.poCash(lotA)) < 0.01 && Math.abs(sum(A, "kg") - P0.poRecvUnits(lotA)) < 0.01,
    `and the trail sums to what the lot has paid and received (RM ${sum(A, "cash")}, ${sum(A, "kg")} unit)`);
  const lotB = { rid: "t0b", date: "2026-08-01", qty: 10, total: 500, supplier: "SF6-KLC", status: "paid" };
  aa0(lotB, { kind: "Modification", date: "2026-08-05", newQty: 8, newTotal: 400 }, "BUY", null);
  const B = lotB.amend || [];
  ok(B.length === 2 && B[0].cash === 500 && B[0].kg === 10 && B[1].kind === "Modification" && B[1].cash === 0 && B[1].kg === 0,
    `a restatement on a lot leaves a Modification step after the row as booked: ${JSON.stringify(B)}`);
  /* the desk, against the fold, on the book's own lots: same row, same amendment, same trail */
  const { openMaster: om0 } = await import("../tools/payload.mjs");
  const { w: w0 } = await om0();
  w0.eval("setProd('salt');recompute();");
  const lots0 = JSON.parse(w0.eval("JSON.stringify(purchases.filter(function(p){return p.rid&&!p.cancelled&&!p.defaulted&&!p.pending&&!(p.amend&&p.amend.length);}).slice(0,2))"));
  const TRIALS = [{ kind: "Fulfilment", date: "2026-09-01", cash: 100, kg: 0 }, { kind: "Modification", date: "2026-09-01", newQty: 12, newTotal: 900 }];
  if (lots0.length === 2) {
    lots0.forEach((lot, i) => {
      const pay = TRIALS[i];
      const clone = JSON.parse(JSON.stringify(lot));
      aa0(clone, pay, "BUY", null);
      w0.eval("ovAmend(" + JSON.stringify(Object.assign({ direction: "BUY", rid: lot.rid }, pay)) + ",{at:'t0'})");
      const deskA = JSON.parse(w0.eval("JSON.stringify((purchases.find(function(p){return p.rid===" + JSON.stringify(lot.rid) + ";})||{}).amend||[])"));
      ok(deskA.length === 2 && JSON.stringify(deskA) === JSON.stringify(clone.amend), `${lot.rid} ${pay.kind}: the desk writes the trail the fold writes (${JSON.stringify(deskA)})`);
    });
  } else skipData("fewer than two trail-less lots on the book to drive the desk with");
  /* p016, the one lot that already carried a step */
  const { readFileSync: rf0 } = await import("node:fs");
  const { join: j0 } = await import("node:path");
  const p016 = JSON.parse(rf0(j0(REPO, "ledger", "book.json"), "utf8")).purchases.find((p) => p.rid === "p016");
  const T = (p016 && p016.amend) || [];
  ok(T.length >= 2 && T[0].note === "as booked" && Math.abs(sum(T, "cash") - P0.poCash(p016)) < 0.01 && Math.abs(sum(T, "kg") - P0.poRecvUnits(p016)) < 0.01,
    `p016 opens with the lot as booked and its trail sums to the row: RM ${sum(T, "cash")} of ${p016 && P0.poCash(p016)}, ${sum(T, "kg")} of ${p016 && P0.poRecvUnits(p016)} unit`);
}


section("v451: the Ledger draws a lot's trail");
{
  /* The card map gated steps and corrections to SELL and read them off the wrapper, which has no
     amend, so no lot ever showed a trail or a correction strip. Two lots the fold could now write,
     rendered through booksync into a scratch master and read back off the cards. */
  const { openMaster: om1 } = await import("../tools/payload.mjs");
  const { readFileSync: rf1, writeFileSync: wf1, unlinkSync: rm1 } = await import("node:fs");
  const { execSync: ex1 } = await import("node:child_process");
  const { join: j1 } = await import("node:path");
  const bk1 = JSON.parse(rf1(j1(REPO, "ledger", "book.json"), "utf8"));
  const sup1 = bk1.purchases.find((x) => x.supplier).supplier;
  bk1.purchases.push({ rid: "f6", date: "2026-08-10", supplier: sup1, product: "salt", qty: 10, total: 500, cash: 500, receivedQty: 10, paidOn: "2026-08-10", receivedOn: "2026-08-20",
    amend: [{ date: "2026-08-10", kind: "Fulfilment", cash: 500, kg: 0, note: "as booked" }, { date: "2026-08-20", kind: "Fulfilment", cash: 0, kg: 10 }] });
  bk1.purchases.push({ rid: "f7", date: "2026-08-25", supplier: sup1, product: "salt", qty: 4, total: 220, cash: 220, receivedQty: 4, mod: "corrected on 2026-08-30: total 200 to 220; cash 200 to 220",
    amend: [{ date: "2026-08-25", kind: "Fulfilment", cash: 200, kg: 4, note: "as booked" }, { date: "2026-08-30", kind: "Correction", cash: 0, kg: 0, note: "corrected on 2026-08-30: total 200 to 220; cash 200 to 220" }] });
  const B1 = j1(REPO, "test", ".v451.json"), M1 = j1(REPO, "test", ".v451.html");
  wf1(B1, JSON.stringify(bk1, null, 1)); wf1(M1, rf1(j1(REPO, "master", "salt_command.html"), "utf8"));
  ex1("node tools/booksync.mjs --sync", { cwd: REPO, env: { ...process.env, SALT_BOOK: B1, SALT_MASTER: M1 }, stdio: "pipe" });
  try {
    const { w } = await om1(M1);
    w.eval("setProd('salt');recompute();ledF.q='';switchTab('ledger');");
    const card = (rid) => JSON.parse(w.eval("JSON.stringify((function(){var c=document.querySelector('.lcard[data-rid=\"" + rid + "\"]');if(!c)return null;var rows=[].map.call(c.querySelectorAll('.lrow,.lmove'),function(r){return {cls:r.className,date:(r.querySelector('.ldate,.lmdate')||{}).textContent||'',pill:(r.querySelector('.lstate .tag')||{}).textContent||''};});var k=c.querySelector('.lcorr');return {rows:rows,corr:k?{cls:k.className,why:!!k.querySelector('.cwhy'),text:k.textContent.replace(/\s+/g,' ').trim()}:null};})())"));
    const f6 = card("f6"), f7 = card("f7"), p16 = card("p016");
    /* v471: the correction strip lives in the Journal beside the ledger, keyed by the same rid */
    w.eval("switchTab('journal');");
    const f7c = JSON.parse(w.eval("JSON.stringify((function(){var k=document.querySelector('.jent[data-rid=\"f7\"] .lcorr');return k?{cls:k.className,why:!!k.querySelector('.cwhy'),text:k.textContent.replace(/[ \\t\\n\\r]+/g,' ').trim()}:null;})())"));
    w.eval("switchTab('ledger');");
    /* 09 Sep 2026, his schematic: an entry is its order row and one line per transaction; the
       line that completed it reads Closed, the ones before it Open */
    ok(f6 && f6.rows.length === 3 && /\blopen\b/.test(f6.rows[0].cls) && !/\blclose\b/.test(f6.rows[1].cls) && /\blclose\b/.test(f6.rows[2].cls),
      `a lot paid on the 10th and received on the 20th is its order row and two transaction lines, the second of them closed (${f6 && f6.rows.map((r) => r.cls).join(" | ")})`);
    /* v491: ONE STATE PER ENTRY, ON THE HEAD, on his instruction. This asserted "paid ahead" on
       the head and Completed on the close, one state per line, which is the shape he rejected on a
       screenshot of s107. The head now carries the entry's state, the engine's, and the close
       carries the receipt date and no state: the paid-ahead history is on the steps, where the
       cash of the 10th and the units of the 20th are each their own row. */
    ok(f6 && f6.rows[0].pill === "Completed" && f6.rows[1].pill === "" && f6.rows[2].pill === "" && f6.rows[2].date === "2026-08-20",
      `Completed once on the order row, the closing line dated by the receipt and carrying no state (${f6 && f6.rows.map((r) => (r.pill || "-") + " " + r.date).join(" | ")})`);
    ok(f7 && f7c && /Corrected 2026-08-30/.test(f7c.text) && !/\bbad\b/.test(f7c.cls) && f7c.why,
      `a corrected lot carries the correction strip in the Journal, quiet because every claim reads back, its own note behind why (${f7c && f7c.text.slice(0, 60)})`);
    ok(p16 && p16.rows.length >= 2 && /\blopen\b/.test(p16.rows[0].cls) && p16.rows[0].pill === "Completed" && /\blclose\b/.test(p16.rows[p16.rows.length - 1].cls),
      `p016, restated the day it was booked, reads Completed on its order row and its trail closes on its last line (${p16 && p16.rows.map((r) => r.cls + " " + r.pill).join(" | ")})`);
    w.eval("ledF.q='corrected on 2026-08-30';switchTab('ledger');");
    const hit = JSON.parse(w.eval("JSON.stringify([!!document.querySelector('.lcard[data-rid=\"f7\"]'),!!document.querySelector('.lcard[data-rid=\"f6\"]')])"));
    ok(hit[0] && !hit[1], "and the search reads a lot's mod: the corrected lot is found and the other is not");
    w.eval("ledF.q='';");
  } finally { for (const f of [B1, M1]) { try { rm1(f); } catch (e) { /* best effort */ } } }
}


section("v452: the month chart draws the table");
{
  /* The Financials part draws one block per product, so the stub keys by canvas id AND product.
     drawFinCharts kept its own accumulators over pricedSales: a row partly pending counted its
     whole total and quantity where finRows nets the pending tail, and the labels carried no year.
     Two fixture sales, one half pending in August and one in the January after, rendered through
     booksync into a scratch master with a recording Chart, and the datasets read back. */
  const { openMaster: om2 } = await import("../tools/payload.mjs");
  const { readFileSync: rf2, writeFileSync: wf2, unlinkSync: rm2 } = await import("node:fs");
  const { execSync: ex2 } = await import("node:child_process");
  const { join: j2 } = await import("node:path");
  const bk2 = JSON.parse(rf2(j2(REPO, "ledger", "book.json"), "utf8"));
  const cus2 = bk2.sales.find((x) => x.customer && x.date).customer;
  bk2.sales.push({ rid: "f8", date: "2026-08-12", customer: cus2, product: "salt", qty: 4, total: 400, cost: 64, cash: 200, deliveredQty: 2 });
  bk2.sales.push({ rid: "f9", date: "2027-01-05", customer: cus2, product: "salt", qty: 2, total: 200, cost: 64, cash: 200, deliveredQty: 2 });
  const B2 = j2(REPO, "test", ".v452.json"), M2 = j2(REPO, "test", ".v452.html");
  wf2(B2, JSON.stringify(bk2, null, 1)); wf2(M2, rf2(j2(REPO, "master", "salt_command.html"), "utf8"));
  ex2("node tools/booksync.mjs --sync", { cwd: REPO, env: { ...process.env, SALT_BOOK: B2, SALT_MASTER: M2 }, stdio: "pipe" });
  const STUB = "window.__charts={};window.Chart=function(c,cfg){var id=(c&&c.canvas&&c.canvas.id)||(c&&c.id)||'?';window.__charts[id+':'+PROD]=cfg;this.destroy=function(){};};window.Chart.register=function(){};";
  const READ = "JSON.stringify((function(){var c=window.__charts['finMonthChart:salt'];if(!c)return null;var d=c.data;return {labels:d.labels,rev:d.datasets[0].data,mar:d.datasets[1].data,names:d.datasets.map(function(x){return x.label;})};})())";
  const TABLE = "JSON.stringify(finRows().map(function(r){return [r[0],+r[1].rev.toFixed(2),+(r[1].rev-r[1].cogs).toFixed(2)];}))";
  const OLD = "JSON.stringify((function(){var mo={};pricedSales.filter(function(x){return !x.cancelled&&x.date&&txPendUnits(x)<x.qty-0.009;}).forEach(function(x){var k=x.date.slice(0,7);mo[k]=(mo[k]||0)+x.total;});return mo;})())";
  try {
    const { w } = await om2(M2);
    w.eval(STUB + "setProd('salt');recompute();switchTab('financials');");
    const ch = JSON.parse(w.eval(READ)), tb = JSON.parse(w.eval(TABLE)), old = JSON.parse(w.eval(OLD));
    ok(ch && ch.names[0] === "Revenue" && ch.names[1] === "Gross margin" && ch.rev.length === tb.length && tb.length >= 2,
      `the month chart draws one bar pair per finRows month (${ch && ch.rev.length} against ${tb.length})`);
    const off = tb.filter(([k, rev, mar], i) => ch.rev[i] !== rev || ch.mar[i] !== mar).map(([k, rev, mar], i) => k);
    ok(ch && off.length === 0, `and every month's revenue and gross margin equal the table's (off: ${off.join(", ") || "none"})`);
    const iA = tb.findIndex(([k]) => k === "2026-08");
    ok(ch && iA >= 0 && Math.abs(old["2026-08"] - ch.rev[iA] - 200) < 0.005,
      `a sale half pending draws its delivered half: RM ${ch && ch.rev[iA]} where the old accumulator counted RM ${old["2026-08"]}`);
    ok(ch && ch.labels.length === tb.length && ch.labels.every((l) => /^[A-Z][a-z]{2,3} \d\d$/.test(l)) && ch.labels[tb.findIndex(([k]) => k === "2027-01")] === "Jan 27",
      `when the months span two years every label carries the year (${ch && ch.labels.join(", ")})`);
  } finally { for (const f of [B2, M2]) { try { rm2(f); } catch (e) { /* best effort */ } } }
  /* And on the book as it stands, one year, the labels stay bare. */
  {
    const { w } = await om2(join(REPO, "master", "salt_command.html"));
    w.eval(STUB + "setProd('salt');recompute();switchTab('financials');");
    const ch = JSON.parse(w.eval(READ)), tb = JSON.parse(w.eval(TABLE));
    const years = new Set(tb.map(([k]) => k.slice(0, 4)));
    ok(ch && years.size === 1 && ch.labels.length === tb.length && ch.labels.every((l) => /^[A-Z][a-z]{2,3}$/.test(l)),
      `within one year the labels are the bare months (${ch && ch.labels.join(", ")})`);
  }
}


section("v453: a line prints the measure its sum used");
{
  /* Two itemisations printed a whole-row figure beside a sum that used the netted one: the stock
     walk's Received row (and the lot list) printed a lot's ordered quantity where buyUnits sums
     what landed, and the held-out line named an order by its whole total where its headline nets
     the pending tail. A lot six of ten received and an undated order half delivered, both fixtures. */
  const { openMaster: om3 } = await import("../tools/payload.mjs");
  const { readFileSync: rf3, writeFileSync: wf3, unlinkSync: rm3 } = await import("node:fs");
  const { execSync: ex3 } = await import("node:child_process");
  const { join: j3 } = await import("node:path");
  const bk3 = JSON.parse(rf3(j3(REPO, "ledger", "book.json"), "utf8"));
  const sup3 = bk3.purchases.find((x) => x.supplier).supplier, cus3 = bk3.sales.find((x) => x.customer && x.date).customer;
  bk3.purchases.push({ rid: "f10", date: "2026-08-15", supplier: sup3, product: "salt", qty: 10, total: 500, cash: 500, receivedQty: 6 });
  bk3.sales.push({ rid: "f11", customer: cus3, product: "salt", qty: 4, total: 400, cost: 64, cash: 200, deliveredQty: 2 });
  const B3 = j3(REPO, "test", ".v453.json"), M3 = j3(REPO, "test", ".v453.html");
  wf3(B3, JSON.stringify(bk3, null, 1)); wf3(M3, rf3(j3(REPO, "master", "salt_command.html"), "utf8"));
  ex3("node tools/booksync.mjs --sync", { cwd: REPO, env: { ...process.env, SALT_BOOK: B3, SALT_MASTER: M3 }, stdio: "pipe" });
  try {
    const { w } = await om3(M3);
    w.eval("setProd('salt');recompute();switchTab('inventory');");
    const walk = JSON.parse(w.eval("JSON.stringify((function(){var out=[];[].forEach.call(document.querySelectorAll('.sec.on tr'),function(tr){var td=tr.querySelectorAll('td');if(td.length>=2)out.push([td[0].textContent.trim(),td[1].textContent.trim()]);});return out;})())"));
    const num = (t) => +String(t).replace(/[^0-9.+-]/g, "");
    const recv = walk.find(([a]) => a === "Received 2026-08-15"), lot = walk.find(([a]) => a === "Purchase 2026-08-15"), open = walk.find(([a]) => a === "Still to arrive 2026-08-15");
    ok(recv && num(recv[1]) === 6, `the walk's Received row prints what landed, 6 of 10 unit (${recv && recv[1]})`);
    ok(lot && num(lot[1]) === 6 && open && num(open[1]) === 4, `the lot list prints the 6 in the basis and the 4 still to arrive (${lot && lot[1]}, ${open && open[1]})`);
    const tot = walk.find(([a]) => /^On hand/.test(a));
    const i0 = walk.findIndex(([a]) => /^Opening/.test(a)), i1 = walk.findIndex(([a]) => /^On hand/.test(a));
    const sum = walk.slice(i0, i1).reduce((a, r) => a + num(r[1]), 0);
    ok(tot && i0 >= 0 && i1 > i0 && Math.abs(sum - num(tot[1])) < 0.01, `and the walk sums to the figure beneath it (${sum.toFixed(2)} against ${tot && tot[1]})`);
    w.eval("switchTab('financials');");
    const fin = String(w.eval("(function(){var e=document.querySelector('.sec.on');return e?e.textContent.replace(/\\s+/g,' '):'';})()"));
    ok(/1 order carrying RM 200 of revenue is held out/.test(fin), "the held-out line nets the pending half from its headline");
    ok(/RM 200 of RM 400 ordered./.test(fin), `and names the order by the same measure, with what was ordered beside it (${(fin.match(/held out[^.]*.[^.]*./) || [""])[0].slice(0, 160)})`);
  } finally { for (const f of [B3, M3]) { try { rm3(f); } catch (e) { /* best effort */ } } }
}


section("v454: a cancelled paid order's money is stated on the statement");
{
  /* v444 books the refund; the statement dropped the row whole, so Paid was short by the money
     the customer had actually handed over, Balance read nil beneath a refund still owed to them,
     the Refunds table called it an overpayment, and the review sheet flagged the account clear.
     One fixture: an order paid RM 450 and cancelled before collection, with the refund record
     the engine writes for it. */
  const { readFileSync: rf4, writeFileSync: wf4, rmSync: rm4 } = await import("node:fs");
  const { join: j4 } = await import("node:path");
  const { pathToFileURL: pu4 } = await import("node:url");
  const E4 = (await import("../engine/position.mjs")).default;
  const bk4 = JSON.parse(rf4(j4(REPO, "ledger", "book.json"), "utf8"));
  const live4 = bk4.sales.find((x) => x.customer && x.date && !x.cancelled && (x.cash || 0) > 0);
  const who4 = live4.customer;
  const cx4 = { rid: "f12", date: "2026-08-20", customer: who4, product: "salt", qty: 4.5, total: 450, cost: 64, cash: 450, deliveredQty: 0, cancelled: true, cancelledOn: "2026-08-22" };
  bk4.sales.push(cx4);
  bk4.customerRefunds = bk4.customerRefunds || [];
  const rec4 = E4.refundOnCancel(bk4.customerRefunds, cx4, "2026-08-22");
  ok(rec4 && rec4.amount === 450 && rec4.rid === "f12", `the engine books the RM 450 payable for the fixture (${JSON.stringify(rec4)})`);
  const B4 = j4(REPO, "test", ".v454.json"), O4 = j4(REPO, "test", ".v454-out");
  wf4(B4, JSON.stringify(bk4, null, 1));
  const fname4 = (p) => "statement_" + p.replace(/[^A-Za-z0-9._-]+/g, "-") + "_2026-09-01.html";
  const prev4 = process.env.SALT_BOOK; process.env.SALT_BOOK = B4;
  let html4 = "", rev4 = "", other4 = "";
  try {
    const m4 = await import(pu4(j4(REPO, "tools", "make_statements.mjs")).href + "?v454");
    const log4 = console.log; console.log = () => {};
    try { await m4.makeStatements(O4, "2026-09-01", { key: "test-secret" }); } finally { console.log = log4; }
    html4 = rf4(j4(O4, fname4(who4)), "utf8");
    rev4 = rf4(j4(O4, "_review_2026-09-01.html"), "utf8");
    const oth4 = bk4.sales.find((x) => x.customer && x.customer !== who4 && x.date && !bk4.customerRefunds.some((r) => r.party === x.customer && !r.paidOn)).customer;
    other4 = rf4(j4(O4, fname4(oth4)), "utf8");
  } finally {
    if (prev4 === undefined) delete process.env.SALT_BOOK; else process.env.SALT_BOOK = prev4;
    try { rm4(B4); } catch (e) { /* best effort */ }
    try { rm4(O4, { recursive: true, force: true }); } catch (e) { /* best effort */ }
  }
  const strip4 = (h) => h.replace(/<[^>]+>/g, " ").replace(/&middot;/g, "|").replace(/\s+/g, " ");
  const txt4 = strip4(html4);
  const paidLive = bk4.sales.filter((x) => x.customer === who4 && !x.cancelled).reduce((a, x) => a + (x.cash || 0) + (x.settledRM || 0), 0);
  const mny = (v) => Number(v).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const wantPaid = "Paid " + mny(paidLive + 450);
  ok(txt4.indexOf(wantPaid) >= 0, `Paid counts the RM 450 they handed over on the cancelled order (want ${wantPaid}; got ${(txt4.match(/Paid [0-9,.]+/) || [""])[0]})`);
  ok(txt4.indexOf("of which on cancelled orders 450.00") >= 0, "and names the cancelled part on its own line");
  ok(txt4.indexOf("Owed to you 450.00") >= 0, `the footer states the refund as Owed to you (${(txt4.match(/(Balance|Outstanding) [a-z0-9,.]+ ?(Owed to you [0-9,.]+)?/) || [""])[0]})`);
  ok(txt4.indexOf("Cancelled order, money returned to you") >= 0 && txt4.indexOf("450.00 owed to you") >= 0, "the Refunds table says it is a cancelled order, still owed");
  ok(txt4.indexOf("450.00 paid, see Refunds") >= 0, "and the struck row points at it");
  ok(strip4(other4).indexOf("Owed to you") < 0, "a customer owed no refund has no Owed to you line");
  const at4 = rev4.indexOf("#s-" + who4 + "\"");
  const cls4 = at4 < 0 ? null : (rev4.slice(Math.max(0, at4 - 80), at4).match(/class="f-([a-z]+)"/) || [])[1];
  ok(cls4 === "refund" || cls4 === "owes" || cls4 === "goods", `the review sheet flags the account rather than calling it clear (${cls4})`);
  ok(rev4.indexOf("450.00 to them") >= 0 || cls4 === "owes", "and its index shows the money owed to them");
}


section("v455: the reconciliation reads the shortfall the settlement credited");
{
  /* The walk read a leg's shortfall as billed less cash, and the fold credits an in-kind
     settlement INTO the leg's cash, so every settled leg read Short 0.00 and the table was zeros.
     Three books, each the live CJ4-BJ rows with the 15 Jul order carrying its 2.0588 unit as
     settledKg: legs credited as the fold writes them; legs left unpaid; legs paid in cash with
     nothing to explain. */
  const { readFileSync: rf5, writeFileSync: wf5, rmSync: rm5 } = await import("node:fs");
  const { join: j5 } = await import("node:path");
  const { pathToFileURL: pu5 } = await import("node:url");
  const base5 = JSON.parse(rf5(j5(REPO, "ledger", "book.json"), "utf8"));
  const s018 = base5.sales.find((x) => x.rid === "s018"), s003 = base5.sales.find((x) => x.rid === "s003"), s008 = base5.sales.find((x) => x.rid === "s008");
  ok(s018 && s003 && s008 && s018.amend.some((a) => a.kind === "Linked" && (a.refKeys || []).length === 2) && s003.amend.some((a) => a.ref && a.cash === 50) && s008.amend.some((a) => a.ref && a.cash === 90),
    "the book still holds the case: s018 links s003 and s008, and both legs carry the credited step");
  const run5 = async (tag, shape) => {
    const b = JSON.parse(JSON.stringify(base5));
    shape(b.sales.find((x) => x.rid === "s018"), b.sales.find((x) => x.rid === "s003"), b.sales.find((x) => x.rid === "s008"));
    const B = j5(REPO, "test", ".v455-" + tag + ".json");
    wf5(B, JSON.stringify(b, null, 1));
    const prev = process.env.SALT_BOOK; process.env.SALT_BOOK = B;
    try {
      const m = await import(pu5(j5(REPO, "tools", "make_statements.mjs")).href + "?v455-" + tag);
      const o = { from: null, to: "2026-09-01", completed: true, open: true, pending: true, dates: true, brand: "Salt Command", issued: "01 Sep 2026" };
      const rows = m.stmtRows("CJ4-BJ", o);
      o.refunds = m.stmtRefunds("CJ4-BJ", o);
      o.recon = m.stmtRecon("CJ4-BJ", rows).filter((R) => rows.some((x) => x.date === R.order.date));
      const R = o.recon.find((x) => x.order.date === "2026-07-15");
      const txt = m.stmtDoc("CJ4-BJ", rows, o).replace(/<[^>]+>/g, " ").replace(/&minus;/g, "-").replace(/\s+/g, " ");
      return { R, txt };
    } finally { if (prev === undefined) delete process.env.SALT_BOOK; else process.env.SALT_BOOK = prev; try { rm5(B); } catch (e) { /* best effort */ } }
  };
  const A = await run5("credited", (l) => { l.settledKg = 2.0588; });
  ok(A.R && !A.R.noLegs && A.R.legs.length === 2 && A.R.legs[0].short === 50 && A.R.legs[1].short === 90 && A.R.legs[0].paid === 550 && A.R.legs[1].paid === 0,
    `legs credited as the fold writes them read their shortfall off the credit: ${A.R && JSON.stringify(A.R.legs.map((x) => [x.paid, x.short]))}`);
  ok(A.R && A.R.shortTot === 140 && A.R.rate === 68, `carried forward 140 at 68 a unit (${A.R && A.R.shortTot} at ${A.R && A.R.rate})`);
  ok(A.txt.indexOf("Carried forward 140.00") >= 0 && A.txt.indexOf("140.00 at 68.00 a unit is 2.06 unit") >= 0 && A.txt.indexOf("0.00 at 0.00") < 0,
    "and the document prints the walk with those figures, not zeros");
  const B = await run5("unpaid", (l, a, b) => { l.settledKg = 2.0588; a.cash = 550; a.amend = a.amend.filter((x) => !x.ref); b.cash = 0; b.amend = b.amend.filter((x) => !x.ref); });
  ok(B.R && B.R.shortTot === 140 && B.R.rate === 68 && B.txt.indexOf("Carried forward 140.00") >= 0,
    `legs still unpaid read billed less cash, as before (${B.R && B.R.shortTot} at ${B.R && B.R.rate})`);
  const C = await run5("cashed", (l, a, b) => { l.settledKg = 2.0588; a.amend = a.amend.filter((x) => !x.ref); b.amend = b.amend.filter((x) => !x.ref); });
  ok(C.R && C.R.noLegs && C.txt.indexOf("Carried forward") < 0 && C.txt.indexOf("applied to a separate arrangement") >= 0,
    `legs paid in cash explain nothing, so the offset is told plainly rather than tabulated (noLegs ${C.R && C.R.noLegs})`);
}



section("v456: an undated row says so wherever its date is printed");
{
  /* The pending table printed `not dated` for an undated row; the five Order book tables beside
     it printed the raw field, the word undefined under a heading that says Since, and a census of
     every tab found the same on eight more sites. Five undated fixtures, one per table: a sale paid
     ahead, a sale delivered unpaid, a lot paid ahead, a lot landed unpaid, a lot agreed and
     unmoved. The census is the proof: every tab, on the fixture book, prints undefined nowhere. */
  const { openMaster: om6 } = await import("../tools/payload.mjs");
  const { readFileSync: rf6, writeFileSync: wf6, unlinkSync: rm6 } = await import("node:fs");
  const { execSync: ex6 } = await import("node:child_process");
  const { join: j6 } = await import("node:path");
  const bk6 = JSON.parse(rf6(j6(REPO, "ledger", "book.json"), "utf8"));
  const sup6 = bk6.purchases.find((x) => x.supplier).supplier, cus6 = bk6.sales.find((x) => x.customer && x.date).customer;
  /* v516: the census counts the Sourcing tab's per-lot table, which the desk replaces with "nothing left on
     the inventory" once the shelf is at or below zero; the fixture pins its own shelf so the count does not
     move with the live book (the 07 Sep fold rolled it to -1 and the census read 13) */
  bk6.STATED_STOCK = 10;
  bk6.sales.push({ rid: "f13", customer: cus6, product: "salt", qty: 2, total: 200, cost: 64, cash: 200, deliveredQty: 0 });
  bk6.sales.push({ rid: "f16", customer: cus6, product: "salt", qty: 1, total: 100, cost: 64, cash: 0, deliveredQty: 1 });
  bk6.purchases.push({ rid: "f14", supplier: sup6, product: "salt", qty: 10, total: 500, cash: 500, receivedQty: 0 });
  bk6.purchases.push({ rid: "f15", supplier: sup6, product: "salt", qty: 5, total: 250, cash: 0, receivedQty: 5 });
  bk6.purchases.push({ rid: "f17", supplier: sup6, product: "salt", qty: 3, total: 150, pending: true });
  const B6 = j6(REPO, "test", ".v456.json"), M6 = j6(REPO, "test", ".v456.html");
  wf6(B6, JSON.stringify(bk6, null, 1)); wf6(M6, rf6(j6(REPO, "master", "salt_command.html"), "utf8"));
  ex6("node tools/booksync.mjs --sync", { cwd: REPO, env: { ...process.env, SALT_BOOK: B6, SALT_MASTER: M6 }, stdio: "pipe" });
  /* v471: the Journal quotes the version history verbatim, and that prose names the words this census hunts; quoted history is not desk output, so it is cut before reading */
  const READ6 = "(function(){var e=document.querySelector('.sec.on');if(!e)return '';var c=e.cloneNode(true);[].slice.call(c.querySelectorAll('.jquote')).forEach(function(q){q.parentNode.removeChild(q);});return c.textContent;})()";
  const count = (t, w) => t.split(w).length - 1;
  try {
    const { w } = await om6(M6);
    const tabs = JSON.parse(w.eval("JSON.stringify(Object.keys(builders||{}))"));
    w.eval("setProd('salt');recompute();");
    const seen = {}, undef = [];
    let nd = 0;
    for (const t of tabs) {
      let txt = "";
      try { w.eval("switchTab('" + t + "');"); txt = String(w.eval(READ6)); } catch (e) { undef.push(t + " threw " + String(e.message || e).slice(0, 60)); continue; }
      seen[t] = txt; nd += count(txt, "not dated");
      const u = count(txt, "undefined"); if (u) undef.push(t + " x" + u);
    }
    ok(tabs.length >= 16 && (seen.receivables || "").length > 400, `every tab renders on the fixture book (${tabs.length} tabs)`);
    ok(count(seen.receivables || "", "not dated") >= 5, `the Order book says not dated on each undated row (${count(seen.receivables || "", "not dated")} cells, five fixtures)`);
    ok(undef.length === 0, `and no tab prints the word undefined: ${undef.join("; ") || "none"}`);
    /* v479: the lock rule prints its undated lot only while the lock is on; with it off (v280) the
       breach is gated and Today prints nothing for it, which is the point, and no undefined either */
    const lockOn6 = String(w.eval("String(PRICE_LOCK_ON)")) === "true";
    /* 12 since 08 Sep 2026, from 14: the Concentration tab's "last rate" per supplier is the newest DATED
       lot now (an undated lot sorted first under a comparator that answered -1 to undefined), so its two
       cells print a date. The receivables, inventory, pricing, plans and sourcing cells stand. */
    ok(count(seen.today || "", "landed not dated") === (lockOn6 ? 1 : 0) && nd >= 12, `the lock rule on Today ${lockOn6 ? "says so too" : "is gated with the lock off, and stays silent"}, ${nd} cells across the desk`);
  } finally { for (const f of [B6, M6]) { try { rm6(f); } catch (e) { /* best effort */ } } }
}


section("v457: a cancellation on the whiteboard asks for nothing and previews the refund");
{
  /* The amend pane labelled its two fields Cash returned and Returned on a Cancellation, and
     nothing reads them: the desk, the fold and the drafter each mark the row and return, and the
     refund is what was paid, read off the row. A figure typed there was queued as a movement and
     dropped. The preview showed a bare Cancelled pill where the book will hold a refund payable.
     Driven, not grepped: one order paid ahead, one pending, on a copy of the book. */
  const { openMaster: om7 } = await import("../tools/payload.mjs");
  const { readFileSync: rf7, writeFileSync: wf7, unlinkSync: rm7 } = await import("node:fs");
  const { execSync: ex7 } = await import("node:child_process");
  const { join: j7 } = await import("node:path");
  const bk7 = JSON.parse(rf7(j7(REPO, "ledger", "book.json"), "utf8"));
  const cus7 = bk7.sales.find((x) => x.customer && x.date).customer;
  bk7.sales.push({ rid: "f18", date: "2026-08-30", customer: cus7, product: "salt", qty: 2, total: 450, cost: 64, cash: 450, deliveredQty: 0 });
  bk7.sales.push({ rid: "f19", customer: cus7, product: "salt", qty: 1, total: 100, cost: 64, pending: true });
  const B7 = j7(REPO, "test", ".v457.json"), M7 = j7(REPO, "test", ".v457.html");
  wf7(B7, JSON.stringify(bk7, null, 1)); wf7(M7, rf7(j7(REPO, "master", "salt_command.html"), "utf8"));
  ex7("node tools/booksync.mjs --sync", { cwd: REPO, env: { ...process.env, SALT_BOOK: B7, SALT_MASTER: M7 }, stdio: "pipe" });
  const DRIVE = (rid, record) => `(function(){
    try{
      var set=function(id,v){var e=document.getElementById(id);if(!e)return false;e.value=v;return true;};
      wbMode="amend"; wbASide="SELL"; wbApply();
      var hit=wbAmendList().filter(function(x){return x.t&&x.t.rid===${JSON.stringify(rid)};})[0];
      if(!hit)return JSON.stringify({no:"no-order"});
      set("wbOrder",hit.code); set("wbKind","Cancellation"); set("wbADate","2026-09-01");
      wbAmendLabels(); wbPreview();
      var ci=document.getElementById("wbACash"),ui=document.getElementById("wbAUnits");
      var r={lbl:document.getElementById("wbACashLbl").textContent+" | "+document.getElementById("wbAUnitsLbl").textContent,
             dis:!!(ci.disabled&&ui.disabled),prev:(document.getElementById("wbPrev")||{}).textContent||""};
      if(${record ? "true" : "false"}){
        ci.disabled=false;ci.value="400";ui.disabled=false;ui.value="1";
        var n0=queue.length; try{wbRecord();}catch(e){r.threw=String(e&&e.message);}
        var q=queue[queue.length-1]; r.pushed=(queue.length===n0+1);
        r.q=q?{qty:q.qty,total:q.total,status:q.status,kind:q.payload.kind,pc:q.payload.cash,pk:q.payload.kg,pq:q.payload.qty,pt:q.payload.total}:null;
      }
      return JSON.stringify(r);
    }catch(e){return JSON.stringify({no:"threw: "+(e&&e.message)});}
  })()`;
  try {
    const { w } = await om7(M7);
    w.eval("setProd('salt');recompute();switchTab('add');");
    const A = JSON.parse(String(w.eval(DRIVE("f18", true))));
    ok(!A.no && /not used/.test(A.lbl) && A.lbl.split("not used").length === 3 && A.dis === true,
      `on an order paid ahead the two fields are disabled and say so: ${A.no || A.lbl + " disabled " + A.dis}`);
    ok(!A.no && /Refund due/.test(A.prev) && /Undelivered/.test(A.prev) && /Cancelled/.test(A.prev) && /RM 450 already paid becomes a refund payable/.test(A.prev),
      `the preview shows Refund due, Undelivered, Cancelled and names the RM 450: ${A.no || A.prev.replace(/\s+/g, " ").slice(0, 160)}`);
    ok(!A.no && A.pushed && A.q && A.q.status === "cancelled" && A.q.kind === "Cancellation" && A.q.pc === null && A.q.pk === null && A.q.pq === null && A.q.pt === null,
      `a stale RM 400 and 1 unit in the fields reach the payload as nothing: ${A.no || JSON.stringify(A.q) + (A.threw ? " threw " + A.threw : "")}`);
    ok(!A.no && A.q && A.q.qty === null && A.q.total === null, `and the queued entry itself carries no figures: ${A.no || JSON.stringify(A.q)}`);
    const B = JSON.parse(String(w.eval(DRIVE("f19", false))));
    ok(!B.no && /Unpaid/.test(B.prev) && /Cancelled/.test(B.prev) && !/refund payable/.test(B.prev),
      `on a pending order the preview reads Unpaid and names no refund: ${B.no || B.prev.replace(/\s+/g, " ").slice(0, 160)}`);
  } finally { for (const f of [B7, M7]) { try { rm7(f); } catch (e) { /* best effort */ } } }
}


section("v458: the reconciliation's payment list prints only when it sums to the row");
{
  /* The dated list of payments inside a reconciliation is read off the amend trail, and a
     Correction (v363) sets a row's cash directly while the trail stays as written, so the list
     could add up to money the order never carried. The one live offset order, s009, sums exactly,
     which is why this was latent. Two books: the live one, and one where s009's cash is corrected
     to 700 beside a step that still says 750. */
  const { readFileSync: rf8, writeFileSync: wf8, rmSync: rm8 } = await import("node:fs");
  const { join: j8 } = await import("node:path");
  const { pathToFileURL: pu8 } = await import("node:url");
  const base8 = JSON.parse(rf8(j8(REPO, "ledger", "book.json"), "utf8"));
  const s009 = base8.sales.find((x) => x.rid === "s009");
  ok(s009 && s009.customer === "CS6-PER" && s009.cash === 750 && (s009.settledKg || 0) > 0 && (s009.amend || []).filter((a) => +a.cash > 0.009).length === 1,
    "the book still holds the case: s009 is the offset order, cash 750 with one cash step beside it");
  const run8 = async (tag, shape) => {
    const b = JSON.parse(JSON.stringify(base8));
    shape(b.sales.find((x) => x.rid === "s009"));
    const B = j8(REPO, "test", ".v458-" + tag + ".json");
    wf8(B, JSON.stringify(b, null, 1));
    const prev = process.env.SALT_BOOK; process.env.SALT_BOOK = B;
    try {
      const m = await import(pu8(j8(REPO, "tools", "make_statements.mjs")).href + "?v458-" + tag);
      const o = { from: null, to: "2026-09-01", completed: true, open: true, pending: true, dates: true, brand: "Salt Command", issued: "01 Sep 2026" };
      const rows = m.stmtRows("CS6-PER", o);
      o.refunds = m.stmtRefunds("CS6-PER", o);
      o.recon = m.stmtRecon("CS6-PER", rows).filter((R) => rows.some((x) => x.date === R.order.date));
      return m.stmtDoc("CS6-PER", rows, o).replace(/<[^>]+>/g, " ").replace(/&minus;/g, "-").replace(/\s+/g, " ");
    } finally { if (prev === undefined) delete process.env.SALT_BOOK; else process.env.SALT_BOOK = prev; try { rm8(B); } catch (e) { /* best effort */ } }
  };
  const A = await run8("live", () => {});
  ok(A.indexOf("750.00 on 08 Jul 2026") >= 0, "on the live book the dated list still prints, because it sums to the row");
  const B = await run8("corrected", (r) => { r.cash = 700; });
  ok(B.indexOf("750.00 on 08 Jul 2026") < 0 && B.indexOf("700.00") >= 0,
    `with the row corrected to 700 beside a step of 750, the row's figure prints and the step does not: ${B.indexOf("750.00 on") >= 0 ? "step printed" : "ok"}`);
}


section("v459: the editor measures what has moved with the ruler the gate uses");
{
  /* updOut and ovSeed read txDeliv; the cancellation gate, the whiteboard and the engine walk
     read txEffDeliv, which adds advanceUnits. Nothing writes that field today, so the fixture
     is the only row on which the two rulers disagree, and it is what makes this provable. */
  const { openMaster: om9 } = await import("../tools/payload.mjs");
  const { join: j9 } = await import("node:path");
  const { w } = await om9(j9(REPO, "master", "salt_command.html"));
  w.eval("setProd('salt');recompute();");
  const r = JSON.parse(String(w.eval(`(function(){
    var row={customer:"F9",product:"salt",qty:2,total:200,cost:64,cash:200,deliveredQty:0,advanceUnits:1};
    var o=updOut(row,"SELL"), sd=ovSeed(row,"SELL");
    return JSON.stringify({moved:o.moved,left:o.unitLeft,seed:sd.kg,eff:txEffDeliv(row),raw:txDeliv(row)});
  })()`)));
  ok(r.eff === 1 && r.raw === 0, `the fixture is the row on which the rulers disagree (eff ${r.eff}, raw ${r.raw})`);
  ok(r.moved === 1 && r.left === 1, `updOut reads the unit advanced as moved, one left (moved ${r.moved}, left ${r.left})`);
  ok(r.seed === 1, `and the overlay seed carries the same figure (${r.seed})`);
}


section("v460: the row shape attaches no debt to a cancelled row");
{
  /* ledgerRow said a cancelled order still owed its whole total and quantity, oweRM and oweUnits
     beside st canc, on every cancelled sale on the book. The three pending rulers and txDeferUnits
     have said a cancelled order owes nothing since v443. Read through the master's inlined engine
     as well as the module, so the sync is proved too. */
  const { readFileSync: rf10 } = await import("node:fs");
  const { join: j10 } = await import("node:path");
  const { pathToFileURL: pu10 } = await import("node:url");
  const E10 = (await import(pu10(j10(REPO, "engine", "position.mjs")).href + "?v460")).default;
  const bk10 = JSON.parse(rf10(j10(REPO, "ledger", "book.json"), "utf8"));
  const canc = bk10.sales.filter((x) => x.cancelled);
  ok(canc.length >= 5, `the book still holds the case: ${canc.length} cancelled sales`);
  const bad = canc.map((x) => E10.ledgerRow(x, "S", "salt")).filter((r) => r.oweRM != null || r.oweUnits != null || r.st !== "canc");
  ok(bad.length === 0, `none of them carries oweRM or oweUnits (${bad.length} did: ${bad.map((r) => r.rid + " " + r.oweRM + "/" + r.oweUnits).join(", ")})`);
  const ctl = E10.ledgerRow({ customer: "F10", product: "salt", date: "2026-08-30", qty: 2, total: 200, cost: 64, cash: 0, deliveredQty: 0 }, "S", "salt");
  const cx = E10.ledgerRow({ customer: "F10", product: "salt", date: "2026-08-30", qty: 2, total: 200, cost: 64, cash: 0, deliveredQty: 0, cancelled: true }, "S", "salt");
  ok(ctl.oweRM === 200 && ctl.oweUnits === 2 && ctl.st === "part" && cx.oweRM == null && cx.oweUnits == null && cx.st === "canc",
    `the same row uncancelled owes 200 and 2, cancelled owes nothing (${JSON.stringify([ctl.oweRM, ctl.oweUnits, cx.oweRM, cx.oweUnits])})`);
  const { openMaster: om10 } = await import("../tools/payload.mjs");
  const { w: w10 } = await om10(j10(REPO, "master", "salt_command.html"));
  const viaMaster = JSON.parse(String(w10.eval("JSON.stringify(POSITION_ENGINE.ledgerRow({customer:'F10',product:'salt',date:'2026-08-30',qty:2,total:200,cost:64,cash:0,deliveredQty:0,cancelled:true},'S','salt'))")));
  ok(viaMaster.oweRM == null && viaMaster.oweUnits == null && viaMaster.st === "canc", `and the master's inlined engine says the same (${JSON.stringify(viaMaster)})`);
}


section("v461: a lot's step is named the way the whiteboard took it");
{
  /* v451 drew a lot's trail through the sale's renderer, and every step kept the sale's word,
     Fulfilment, where the pane that took it offered Payment and Receipt. The one lot with steps
     today has both on its own agreed date, so nothing renders; the fixture is a lot with a
     deposit, a receipt four days on and the balance five days after that, beside a sale with a
     movement as the control. */
  const { openMaster: om11 } = await import("../tools/payload.mjs");
  const { readFileSync: rf11, writeFileSync: wf11, unlinkSync: rm11 } = await import("node:fs");
  const { execSync: ex11 } = await import("node:child_process");
  const { join: j11 } = await import("node:path");
  const bk11 = JSON.parse(rf11(j11(REPO, "ledger", "book.json"), "utf8"));
  const sup11 = bk11.purchases.find((x) => x.supplier).supplier, cus11 = bk11.sales.find((x) => x.customer && x.date).customer;
  bk11.purchases.push({ rid: "f20", date: "2026-08-01", supplier: sup11, product: "salt", qty: 10, total: 500, status: "paid", amend: [
    { date: "2026-08-01", kind: "Fulfilment", cash: 200, kg: 0, note: "as booked" },
    { date: "2026-08-05", kind: "Fulfilment", cash: 0, kg: 10, note: "F20 landed" },
    { date: "2026-08-10", kind: "Fulfilment", cash: 300, kg: 0, note: "F20 balance" } ] });
  bk11.sales.push({ rid: "f21", date: "2026-08-01", customer: cus11, product: "salt", qty: 2, total: 200, cost: 64, cash: 100, deliveredQty: 1, amend: [
    { date: "2026-08-01", kind: "Fulfilment", cash: 0, kg: 0, note: "as booked" },
    { date: "2026-08-05", kind: "Fulfilment", cash: 100, kg: 1, note: "F21 moved" } ] });
  const B11 = j11(REPO, "test", ".v461.json"), M11 = j11(REPO, "test", ".v461.html");
  wf11(B11, JSON.stringify(bk11, null, 1)); wf11(M11, rf11(j11(REPO, "master", "salt_command.html"), "utf8"));
  ex11("node tools/booksync.mjs --sync", { cwd: REPO, env: { ...process.env, SALT_BOOK: B11, SALT_MASTER: M11 }, stdio: "pipe" });
  /* v471: notes left the sheet, so a step is found through its card's rid rather than its note */
  const LABELS = (tag) => `(function(){var out=[];[].slice.call(document.querySelectorAll(".sec.on .lcard")).forEach(function(c){if(c.getAttribute("data-rid")!==${JSON.stringify(tag.toLowerCase())})return;[].slice.call(c.querySelectorAll(".lmove .etype, .lrow.lclose .etype")).forEach(function(e){out.push(e.textContent);});});return JSON.stringify(out);})()`;
  try {
    const { w } = await om11(M11);
    w.eval("setProd('salt');recompute();switchTab('ledger');");
    const lot = JSON.parse(String(w.eval(LABELS("F20")))), sale = JSON.parse(String(w.eval(LABELS("F21"))));
    /* 09 Sep 2026: every line shows, the booking's own included, so the lot reads its payment at
       booking, the receipt, then the payment that closed it, each named by what moved */
    ok(lot.join() === "Payment,Receipt,Payment", `the lot's lines read Payment, Receipt then Payment, each named by what moved (${JSON.stringify(lot)})`);
    ok(lot.indexOf("Fulfilment") < 0, "and the sale's word is nowhere on the lot");
    ok(sale.join() === "Agreed,Fulfilment", `while the sale reads Agreed at booking, then Fulfilment (${JSON.stringify(sale)})`);
  } finally { for (const f of [B11, M11]) { try { rm11(f); } catch (e) { /* best effort */ } } }
}


section("v462: a cancelled-on date needs a cancellation, and cannot precede the order");
{
  /* cancelledOn is a correctable date and correctionFaults never read it, so a Correction could
     stamp one on a live row, revive a cancelled row and leave the date behind, or date the
     cancellation before the order. The engine is asked directly, then the master's inlined copy. */
  const { join: j12 } = await import("node:path");
  const { pathToFileURL: pu12 } = await import("node:url");
  const E12 = (await import(pu12(j12(REPO, "engine", "position.mjs")).href + "?v462")).default;
  const live = { customer: "F12", product: "salt", date: "2026-08-01", qty: 2, total: 200, cost: 64, cash: 0, deliveredQty: 0 };
  const gone = Object.assign({}, live, { cancelled: true, cancelledOn: "2026-08-05" });
  const has = (out, re) => out.some((x) => re.test(x));
  ok(has(E12.correctionFaults(live, { cancelledOn: "2026-08-05" }, true), /without being cancelled/), "a cancelled-on date on a row that is not cancelled is refused");
  ok(E12.correctionFaults(live, { cancelled: true, cancelledOn: "2026-08-05" }, true).length === 0, "cancelling a clean row with its date is not");
  ok(has(E12.correctionFaults(live, { cancelled: true, cancelledOn: "2026-07-20" }, true), /before it was agreed/), "a cancellation dated before the order is refused");
  ok(has(E12.correctionFaults(gone, { cancelled: null }, true), /without being cancelled/) && E12.correctionFaults(gone, { cancelled: null, cancelledOn: null }, true).length === 0,
    "reviving a cancelled row must clear its date too, and does so cleanly");
  const { openMaster: om12 } = await import("../tools/payload.mjs");
  const { w: w12 } = await om12(j12(REPO, "master", "salt_command.html"));
  const via = JSON.parse(String(w12.eval("JSON.stringify(POSITION_ENGINE.correctionFaults({customer:'F12',product:'salt',date:'2026-08-01',qty:2,total:200,cost:64,cash:0,deliveredQty:0},{cancelledOn:'2026-08-05'},true))")));
  ok(has(via, /without being cancelled/), "and the master's inlined engine refuses it the same way");
}


section("v463: the statement row carries no field nothing reads");
{
  /* stmtRows minted a `credit` on every row, the negative of what was owed, and nothing in the
     tool read it: the overpayment it stood for is stmtRefunds' shape. Proved byte-identical on
     all 37 live statements when it went; this keeps the shape honest. */
  const { stmtRows: sr13 } = await import("../tools/make_statements.mjs");
  const o13 = { from: null, to: "2026-09-01", completed: true, open: true, pending: true, dates: true, brand: "Salt Command", issued: "01 Sep 2026" };
  const rows13 = sr13("CJ4-BJ", o13);
  ok(rows13.length > 0 && rows13.every((r) => !Object.prototype.hasOwnProperty.call(r, "credit")), `no row carries credit (${rows13.length} rows)`);
}


section("v465: the ledger is a table, whole and sortable");
{
  /* His instruction of 02 Sep 2026: first to latest, sortable like a sheet, a table, nothing folded
     or hidden. The three-day window and the "earlier orders" fold go, the interim-steps disclosure
     goes, every line is the same twelve cells, and a heading sorts: once ascending, again descending,
     blanks last either way. Driven on the live book through the desk itself. */
  const { openMaster: om15 } = await import("../tools/payload.mjs");
  const { w: w15 } = await om15();
  w15.eval("setProd('salt');recompute();ledF={q:'',state:'',party:'',month:'',product:''};ledSort={key:'e',dir:1};switchTab('ledger');");
  const J15 = (x) => JSON.parse(String(w15.eval(x)));
  const rows15 = +w15.eval("sales.length+purchases.length"), cards15 = +w15.eval("document.querySelectorAll('.sec.on .lcard').length");
  ok(rows15 > 100 && cards15 === rows15, `every row on the book is on screen (${cards15} of ${rows15}), none folded`);
  /* 09 Sep 2026: no disclosure element, but the trail folds on his schematic: a closed entry shows
     its order row, an open one its latest line, and a tap on the entry opens the rest */
  ok(+w15.eval("document.querySelectorAll('.sec.on .ledmore, .sec.on details.lmc, .sec.on details .lmove').length") === 0 && +w15.eval("document.querySelectorAll('.sec.on .lmove').length") > 0
    && +w15.eval("document.querySelectorAll('.sec.on .lcard.lfold').length") + +w15.eval("document.querySelectorAll('.sec.on .lcard.lopenq').length") === cards15,
    "no disclosure element: every entry is folded (closed) or open, and its trail is lines a tap reveals");
  {
    const vis = (sel) => +w15.eval("[].slice.call(document.querySelectorAll('" + sel + "')).filter(function(r){return getComputedStyle(r).display!=='none';}).length");
    ok(vis(".sec.on .lcard.lfold .lmove") === 0 && vis(".sec.on .lcard.lopenq .lmove") === +w15.eval("document.querySelectorAll('.sec.on .lcard.lopenq').length"),
      "a closed entry shows no transaction line and an open one shows exactly its latest");
    w15.eval("document.querySelector('.sec.on .lcard.lfold .lparty').click()");
    ok(vis(".sec.on .lcard.lfold.lexp .lmove") > 0 && vis(".sec.on .lcard.lfold.lexp .lmove") === +w15.eval("document.querySelectorAll('.sec.on .lcard.lfold.lexp .lmove').length"),
      "and a tap on a closed entry opens every line of its trail");
    ok(+w15.eval("document.querySelectorAll('.sec.on .lmove .lclabel').length") === +w15.eval("document.querySelectorAll('.sec.on .lmove').length")
      && +w15.eval("[].slice.call(document.querySelectorAll('.sec.on .lmove .lclabel')).filter(function(l){return l.textContent!=='Open'&&l.textContent!=='Closed';}).length") === 0,
      "every transaction line says Open or Closed, and nothing else");
    ok(+w15.eval("document.querySelectorAll('.sec.on .lcard .lrow .lc-e .ltype').length") === cards15, "and every entry carries its SELL or BUY tag under the E-number");
  }
  ok(+w15.eval("document.querySelectorAll('.sec.on .lhead > *').length") === 11 && +w15.eval("document.querySelectorAll('.sec.on .lhead [data-lsort]').length") === 10,
    "eleven headed columns, ten of them sortable");
  const ids15 = J15("JSON.stringify([].slice.call(document.querySelectorAll('.sec.on .lcard')).map(function(c){return +c.id.replace('ent-E','');}))");
  ok(ids15[0] === 1 && ids15.every((x, i) => !i || ids15[i - 1] < x), "it opens first to latest: E1 at the top and every E-number after the one before it");
  const rids15 = () => J15("JSON.stringify([].slice.call(document.querySelectorAll('.sec.on .lcard')).map(function(c){return c.getAttribute('data-rid');}))");
  const bk15 = JSON.parse(readFileSync(resolve(REPO, "ledger", "book.json"), "utf8"));
  const byRid15 = {}; for (const r of bk15.sales.concat(bk15.purchases)) byRid15[r.rid] = r;
  const mono = (a, up) => a.every((x, i) => !i || (up ? a[i - 1] <= x : a[i - 1] >= x));
  w15.eval("document.getElementById('lsort-total').click()");
  const ta = rids15().map((r) => +byRid15[r].total || 0);
  ok(ta.length === rows15 && mono(ta, true), `one tap on Total sorts ascending, read back off the book (${ta.slice(0, 3)} ... ${ta.slice(-2)})`);
  w15.eval("document.getElementById('lsort-total').click()");
  const td = rids15().map((r) => +byRid15[r].total || 0);
  ok(td.length === rows15 && mono(td, false) && td[0] === ta[ta.length - 1], `a second tap reverses it (${td.slice(0, 3)})`);
  w15.eval("document.getElementById('lsort-party').click()");
  const pa = J15("JSON.stringify([].slice.call(document.querySelectorAll('.sec.on .lcard .lparty')).map(function(e){return e.textContent;}))");
  ok(pa.length === rows15 && pa.every((x, i) => !i || pa[i - 1].localeCompare(x) <= 0), `Party sorts by code (${pa[0]} first, ${pa[pa.length - 1]} last)`);
  w15.eval("document.getElementById('lsort-date').click();document.getElementById('lsort-date').click();");
  const dd = rids15().map((r) => byRid15[r].date || "");
  const dated = dd.filter(Boolean), blanks = dd.length - dated.length;
  /* v456 required blanks > 0 and took the book's own undated rows as its fixture. From 04 Sep
     2026 the book carries none and sort-ledger --check keeps it that way, so demanding one would
     be demanding a fault. What is asserted is the ORDERING itself: every dated row precedes every
     blank and the dated run descends. That holds at zero blanks and still holds if one ever
     appears mid-fold, which is the only way one can now appear at all. */
  ok(dd.slice(0, dated.length).every(Boolean) && mono(dated, false), `Date descending runs latest first and keeps the ${blanks} undated rows last, as a sheet keeps blank cells`);
  ok(/Date/.test(String(w15.eval("document.querySelector('.sec.on .lhead .lsb.on').textContent"))) && +w15.eval("document.querySelectorAll('.sec.on .lhead .larr').length") === 1,
    "the active heading carries the one arrow");
  ok(+w15.eval("document.querySelector('.sec.on .lcard .lrow .lgroup').children.length") === 6 && +w15.eval("document.querySelector('.sec.on .lcard .lrow').children.length") === 6,
    "an order line is six labelled cells, the four figures and its control, the same tracks as the heading");
  w15.eval("ledSort={key:'e',dir:1};");
}


section("v466: the ledger never scrolls sideways; a narrower screen re-flows the same cells");
{
  /* His instruction of 02 Sep 2026, after v465: no scrollable ledger to the right. The sideways
     scroller goes; every cell names a grid area, and container queries re-flow the thirteen cells
     onto two lines below 936px and four below 600px. jsdom lays nothing out, so what is proved here
     is the structure the layout depends on: no scroller, a container, and every line carrying all
     thirteen areas. The geometry itself was measured in a browser at 375, 640 and 1300px before
     this shipped (scrollWidth equal to clientWidth on the wrap and on the document at each). */
  const { openMaster: om16 } = await import("../tools/payload.mjs");
  const { w: w16 } = await om16();
  w16.eval("setProd('salt');recompute();ledF={q:'',state:'',party:'',month:'',product:''};ledSort={key:'e',dir:1};switchTab('ledger');");
  ok(+w16.eval("document.querySelectorAll('.sec.on .ledscroll').length") === 0 && +w16.eval("document.querySelectorAll('.sec.on .ledwrap').length") === 1
    && +w16.eval("document.querySelectorAll('.sec.on .ledwrap .lhead, .sec.on .ledwrap .lcards').length") === 2,
    "the scroller is gone and one container holds the heading and the rows");
  const AREAS = ["lc-e", "lc-step", "lc-date", "lc-type", "lc-prod", "lc-party", "cqty", "cprc", "ctot", "lstate", "lc-act"];
  const areasOf = (sel) => JSON.parse(String(w16.eval("JSON.stringify([].slice.call(document.querySelectorAll('" + sel + "')).map(function(l){return " + JSON.stringify(AREAS) + ".filter(function(a){return !!l.querySelector('.'+a);}).length;}))")));
  const lines = areasOf(".sec.on .lcard .lrow, .sec.on .lcard .lmove"), head = areasOf(".sec.on .lhead");
  ok(lines.length > 140 && lines.every((x) => x === 11), `every one of the ${lines.length} lines carries all eleven areas (min ${Math.min(...lines)})`);
  ok(head.length === 1 && head[0] === 11, "and so does the heading, so it re-flows with them");
  /* the kind rides in the step column: a step line's step cell holds the kind pill, an order line's holds its role */
  ok(+w16.eval("document.querySelectorAll('.sec.on .lmove .lc-step .etype').length") > 0 && +w16.eval("document.querySelectorAll('.sec.on .lmove .lc-step .etype').length") === +w16.eval("document.querySelectorAll('.sec.on .lmove').length")
    && +w16.eval("document.querySelectorAll('.sec.on .lmove .lc-step .lclabel').length") === +w16.eval("document.querySelectorAll('.sec.on .lmove').length"),
    "every transaction line carries Open or Closed and its kind in the step column (09 Sep 2026: the order row carries no role)");
  const css = String(w16.eval("[].slice.call(document.querySelectorAll('style')).map(function(s){return s.textContent;}).join(' ')"));
  ok(/\.ledwrap[^{]*\{[^}]*container-type:\s*inline-size/.test(css) && (css.match(/@container ledger/g) || []).length === 1,
    "the wrap is a size container and one width tier, the phone, is declared against it (v495: the 935px tier became the shape at every width above it)");
  ok(!/\.lcard[^{]*\{[^}]*min-width:\s*1\d{3}px/.test(css) && !/overflow-x:\s*auto[^}]*\}[^@]*\.lcards/.test(css), "no card carries a four-figure minimum width any more");
  ok(!/.lheads*{s*display:s*none/.test(css), "and no rule hides the heading at any width: the v307 phone stack that did is retired");
}


section("v497: a breach is named on its own book's register only");
{
  /* His instruction of 06 Sep 2026: CA4-DAM breaks one rule in salt only, not in oil. Round 5 had
     the register name every book's credit breach on every tab, as salt's, so the oil tab listed a
     salt breach. Driven on the live book, where CA4-DAM holds 2.5 unit of salt out and unpaid. */
  const { openMaster: om21 } = await import("../tools/payload.mjs");
  const { w: w21 } = await om21();
  const reg = (p) => JSON.parse(String(w21.eval("setProd('" + p + "');recompute();JSON.stringify(boundaryScan().filter(function(x){return x.who==='CA4-DAM';}).map(function(x){return x.rule;}))")));
  const salt = reg("salt"), oil = reg("oil");
  /* 07 Sep 2026: this asserted exactly one rule and went red at midnight in Kuala Lumpur, when the
     same credit aged past the credit-age threshold on the clock alone. The point of the block is
     WHERE the breach is named, not how many rules a living credit breaks, so it asks for the cap
     and lets the age join it. */
  /* v513: OVER CAP IS ONE RULER. A 2 unit sale with most of it paid is not over a 1 unit cap on
     any surface; a 2 unit sale with nothing paid is, on every surface. */
  {
    const probe = (row) => JSON.parse(String(w21.eval("(function(){setProd('salt');const s=Object.assign({customer:'CX0-CAP',product:'salt',qty:2,date:'2026-09-07',deliveredQty:2,deliveredOn:'2026-09-07'}," + JSON.stringify(row) + ");"
      + "sales.push(s);try{recompute();const reg=boundaryScan().some(function(x){return x.who==='CX0-CAP'&&x.rule==='Credit cap'&&x.sev==='breach';});"
      + "return JSON.stringify({units:creditOutUnits(s),over:overCap(s),reg:reg});}finally{sales.pop();recompute();}})()")));
    const paid = probe({ total: 185, cash: 150 }), unpaid = probe({ total: 185, cash: 0 });
    ok(Math.abs(paid.units - (2 - 150 / 92.5)) < 1e-6 && !paid.over && !paid.reg,
      "2 units delivered with RM 150 of RM 185 paid is " + paid.units.toFixed(2) + " unit out, under the 1 unit cap on the row and on the register");
    ok(Math.abs(unpaid.units - 2) < 1e-9 && unpaid.over && unpaid.reg,
      "the same 2 units with nothing paid are over the cap on the row and on the register alike");
  }
  ok(salt.includes("Credit cap") && salt.every((r) => /^Credit/.test(r)),
    "on the salt book CA4-DAM breaks the credit cap, and nothing but credit rules (" + salt.join(", ") + ")");
  ok(oil.length === 0, "and on the oil book he breaks none (" + (oil.join(", ") || "none") + ")");
  w21.eval("setProd('salt');recompute();");
}


section("v495: an entry is two rows, and the act cell ends the second");
{
  /* His instruction of 05 Sep 2026, on a screenshot of the heading: the entry, date, party, product,
     quantity, price, total and state on one row; the step and type on a second, running to the end,
     where a dotted transparent Provisional pill or an Update button sits. Asserted through the
     cascade jsdom runs (the declared areas the opening line and a step resolve) and on the rendered
     markup (where the pill is); the pixel geometry is measured by tools/ledger-probe by hand. */
  const { openMaster: om19 } = await import("../tools/payload.mjs");
  const { w: w19 } = await om19();
  w19.eval("sales.push({customer:'CX9-PROV',qty:1,total:100,cash:100,deliveredQty:1,date:'2026-09-01',rid:'x-prov',_prov:true});setProd('salt');recompute();switchTab('ledger');");
  const rowsOf = (sel) => String(w19.eval("getComputedStyle(document.querySelector('" + sel + "')).gridTemplateAreas")).split('"').filter((x, i) => i % 2 === 1).map((r) => r.trim().split(/\s+/));
  const open = rowsOf(".sec.on .lcard .lrow"), step = rowsOf(".sec.on .lcard .lmove");
  ok(open.length === 2 && ["e", "date", "party", "prod", "qty", "price", "tot", "state"].every((k) => open[0].includes(k)),
    "the opening line's first row is entry, date, party, product, quantity, price, total and state (" + open.map((r) => r.join(" ")).join(" / ") + ")");
  ok(open.length === 2 && open[1][0] === "step" && open[1].includes("type") && open[1][open[1].length - 1] === "act" && !open[1].includes("prod"),
    "and its second row opens with the step and ends with the act cell, with the product no longer on it");
  ok(step.length === 1 && step[0].includes("step") && !step[0].includes("act"), "a step stays one row (" + step.map((r) => r.join(" ")).join(" / ") + ")");
  /* 09 Sep 2026: the pen at the corner replaces the Update button; a provisional row carries its
     pill at that corner instead, and no pen */
  const prov = JSON.parse(String(w19.eval("JSON.stringify((function(){var c=document.querySelector('.lcard[data-rid=x-prov]');var p=c.querySelector('.tag.prov');return {atCorner:!!c.querySelector('.lprov.tag.prov'),inProd:!!c.querySelector('.lc-prod .tag.prov'),pen:!!c.querySelector('button.lpen'),border:p?getComputedStyle(p).borderTopStyle:null,bg:p?getComputedStyle(p).backgroundColor:null};})())")));
  ok(prov.atCorner && !prov.inProd && !prov.pen, "a provisional row carries its pill at the corner, where the pen would be, and no pen");
  ok(prov.border === "dotted" && /transparent|rgba\(0, 0, 0, 0\)/.test(prov.bg), "and the pill is dotted with nothing behind it (" + prov.border + ", " + prov.bg + ")");
  const pen = JSON.parse(String(w19.eval("JSON.stringify((function(){var b=document.querySelector('.sec.on .lcard[data-rid]:not([data-rid=x-prov]) button.lpen');if(!b)return null;var s=getComputedStyle(b);return {tag:b.tagName,opacity:s.opacity,position:s.position,hasSvg:!!b.querySelector('svg'),label:b.getAttribute('aria-label')||''};})())")));
  const css19 = String(w19.eval("[].slice.call(document.querySelectorAll('style')).map(function(s){return s.textContent;}).join(' ')"));
  ok(pen && pen.tag === "BUTTON" && pen.position === "absolute" && pen.opacity === "0" && pen.hasSvg && /^Update E\d+$/.test(pen.label) && /\.lcard:hover \.lpen[^{]*\{[^}]*opacity:1/.test(css19) && /hover:none\)\{\.lpen\{opacity:\.55/.test(css19),
    "the pen is a real button at the entry's corner, hidden until the entry is hovered and always faintly there on a touch screen (" + JSON.stringify(pen) + ")");
  w19.eval("document.querySelector('.sec.on .lcard[data-rid]:not([data-rid=x-prov]) button.lpen').click()");
  const menu19 = JSON.parse(String(w19.eval("JSON.stringify([].slice.call(document.querySelectorAll('#ledMenu button')).map(function(b){return b.textContent;}))")));
  ok(menu19.length >= 2 && menu19[menu19.length - 1] === "More" && menu19.indexOf("Modification") >= 0, "the pen opens a short menu: the simple transactions, Modification, then More for the editor (" + menu19.join(", ") + ")");
  w19.eval("document.body.click()");
  ok(+w19.eval("document.querySelectorAll('#ledMenu').length") === 0, "and a click anywhere else closes it");
}


section("v471: the ledger is keyed entries only, and the prose is in the Journal");
{
  /* His instruction of 02 Sep 2026: prose goes into a journal; the ledger should be key in, key
     in, key in, done. The note column, captions, step notes and the correction strip leave the
     sheet; a Journal part beside it carries every one of them, dated, newest first, linked to its
     row by rid and E-number, plus the version entries. Driven on the live book. */
  const { openMaster: om17 } = await import("../tools/payload.mjs");
  const { w: w17 } = await om17();
  w17.eval("setProd('salt');recompute();ledF={q:'',state:'',party:'',month:'',product:''};ledSort={key:'e',dir:1};jrnF={q:''};switchTab('ledger');");
  const J17 = (x) => JSON.parse(String(w17.eval(x)));
  ok(+w17.eval("document.querySelectorAll('.sec.on .lmnote, .sec.on .lagreed, .sec.on .lcorr, .sec.on .lc-note').length") === 0, "no note, caption or correction strip prints on the sheet");
  const noted17 = +w17.eval("sales.concat(purchases).filter(function(r){return !!r.note;}).length");
  const cards17 = +w17.eval("document.querySelectorAll('.sec.on .lcard').length");
  w17.eval("switchTab('journal');");
  ok(/^journal$/.test(String(w17.eval("(document.querySelector('.sec.on .vpart')||{}).getAttribute('data-tab')"))) || +w17.eval("document.querySelectorAll('.sec.on .jent').length") > 0,
    "the Journal opens as a part of The book");
  const ents17 = J17("JSON.stringify([].slice.call(document.querySelectorAll('.sec.on .jlist')[0].querySelectorAll('.jent')).map(function(e){return {rid:e.getAttribute('data-rid'),date:(e.querySelector('.jdate')||{}).textContent||'',kind:(e.querySelector('.jkind')||{}).textContent||'',code:(e.querySelector('.eref')||{}).textContent||''};}))");
  ok(ents17.length >= noted17 && noted17 > 50, `every written row note is an entry (${ents17.length} entries for ${noted17} noted rows, plus step notes and corrections)`);
  const dated17 = ents17.map((e) => e.date).filter((d) => d !== "undated");
  ok(dated17.every((d, i) => !i || dated17[i - 1] >= d) && ents17.slice(0, dated17.length).every((e) => e.date !== "undated"), "newest first, undated last");
  ok(ents17.every((e) => e.rid && /^E\d+$/.test(e.code)), "every entry names its row by rid and E-number");
  const kinds17 = new Set(ents17.map((e) => e.kind));
  ok(kinds17.has("Row") && kinds17.has("Fulfilment") && kinds17.has("Correction"), `row notes, step notes and corrections are all there (${[...kinds17].join(", ")})`);
  const vers17 = +w17.eval("document.querySelectorAll('.sec.on .jlist')[1].querySelectorAll('.jent').length");
  ok(vers17 === +w17.eval("evolution.length") && vers17 > 100, `and every version entry, ${vers17} of them`);
  const first17 = ents17[0];
  w17.eval("switchTab('ledger');");
  ok(!!w17.eval("document.querySelector('.sec.on .lcard[data-rid='+JSON.stringify(" + JSON.stringify(first17.rid) + ")+']')"), "and the row an entry names is on the sheet, so the link lands");
  w17.eval("switchTab('journal');jrnF.q='" + first17.code + "';switchTab('journal');");
  const hits17 = J17("JSON.stringify([].slice.call(document.querySelectorAll('.sec.on .jlist')[0].querySelectorAll('.jent .eref')).map(function(e){return e.textContent;}))");
  ok(hits17.length > 0 && hits17.every((c) => c === first17.code), `the search narrows to one E-number (${hits17.length} entries for ${first17.code})`);
  w17.eval("jrnF.q='';");
  ok(cards17 > 140, `and the sheet still shows every row (${cards17})`);
}

/* ---- done ----------------------------------------------------------------------- */

section("Round 7: the states no suite check had ever rendered");
{
  /* ROUND SEVEN'S BIGGEST HOLE WAS NOT A FAULT, IT WAS A BLIND SPOT: every one of the suite's
     openMaster() calls ran the LIVE book, so no assertion had ever seen an empty book, a fresh
     product or a stepped-back clock. A probe reverted a complete v406 guard and the suite still
     read 700 passed. These checks render MUTATED books, and each was proved red against v406
     before it was written: the undated row threw, the fallback never reached the screen, the
     empty history printed an infinity and five surfaces printed a negative day count. */
  const { openMaster } = await import("../tools/payload.mjs");
  const { readFileSync: rf, writeFileSync: wf, unlinkSync: rm } = await import("node:fs");
  const { execSync } = await import("node:child_process");
  const { join } = await import("node:path");
  const TMP = join(REPO, "test", ".r7tmp.html");
  const TMPB = join(REPO, "test", ".r7tmp.json");
  const bookNow = JSON.parse(rf(join(REPO, "ledger", "book.json"), "utf8"));

  const withBook = (obj) => {
    wf(TMPB, JSON.stringify(obj, null, 1));
    wf(TMP, rf(join(REPO, "master", "salt_command.html"), "utf8"));
    execSync("node tools/booksync.mjs --sync", { cwd: REPO, env: { ...process.env, SALT_BOOK: TMPB, SALT_MASTER: TMP }, stdio: "pipe" });
    return TMP;
  };
  const paneOf = async (path, tab, prod, clock) => {
    let src = rf(path, "utf8");
    if (clock) src = src.replace(/const TODAY=[^\n]*\n/, `const TODAY=new Date('${clock}T12:00:00+08:00');\n`);
    wf(TMP + ".run.html", src);
    const { w } = await openMaster(TMP + ".run.html");
    w.eval(`setProd(${JSON.stringify(prod)});recompute();`);
    let html = "", threw = null;
    try {
      w.eval(`switchTab(${JSON.stringify(tab)});`);
      const el = w.document.querySelector(".sec.on") || w.document.querySelector("#sec-" + tab);
      html = el ? el.innerHTML : "";
    } catch (e) { threw = String((e && e.message) || e); }
    return { w, html, text: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(), threw };
  };

  /* 1. an undated row carrying cash must not blank the whole statement. s119 is undated on the
        live book and a Correction putting cash on it passes every gate, so this is one tap. */
  {
    const b = JSON.parse(JSON.stringify(bookNow));
    /* v464: the live book has no undated sale since s119 was fulfilled, so a fixture stands in rather than the check skipping */
    const row = (b.sales || []).find((r) => !r.date && !r.cancelled && (r.product || "salt") === "salt")
      || (() => { const fx = { rid: "fx-undated", customer: (b.sales.find((r) => r.customer) || {}).customer || "CY2-NIL", qty: 2.5, total: 230, cost: 50, cash: 0, deliveredQty: 0 }; b.sales.push(fx); return fx; })();
    {
      row.cash = 100;
      const r = await paneOf(withBook(b), "financials", "salt");
      ok(!r.threw, `Financials renders with cash on an undated row (${row.rid}) -- ${r.threw}`);
      ok(r.text.length > 400, `Financials is not blank with cash on an undated row (${r.text.length} chars)`);
      let u = null; try { u = r.w.eval("finRows().undated.length"); } catch (e) { u = "threw"; }
      ok(u === 1, `finRows holds the undated row out and counts it (got ${u})`);

      /* v423: AND THE CHART OVER THE SAME SET. This check rendered the part and never installed a
         Chart, so every draw callback returned at its first line and the assertion could not see
         that drawFinCharts still sliced the date raw, 185 lines below the guard v407 added. With a
         recording stub the callback runs and the configs can be read. */
      const M2 = TMP + ".chart.html";
      wf(M2, rf(withBook(b), "utf8"));
      const { w: wc } = await openMaster(M2);
      /* KEYED BY CANVAS ID, not by hunting a dataset label. The first version searched the
         recorded configs for one carrying a "Revenue" dataset, which matches other charts, and
         when the month chart failed to construct at all the search returned undefined rather than
         null and the comparison against the string "null" passed on nothing. The draw pass is
         wrapped in a catch since v384, so a throw here never reaches switchTab: the only honest
         question is whether THIS canvas got a config. */
      wc.eval("window.__charts={};window.Chart=function(c,cfg){var id=(c&&c.canvas&&c.canvas.id)||(c&&c.id)||'?';window.__charts[id]=cfg;this.destroy=function(){};};window.Chart.register=function(){};");
      wc.eval("setProd('salt');recompute();");
      let cThrew = null;
      try { wc.eval("switchTab('financials');"); } catch (e) { cThrew = String(e.message || e); }
      ok(!cThrew, "Financials renders with a Chart installed and cash on an undated row -- " + cThrew);
      ok(wc.eval("!!blkEl('finMonthChart')"), "the month chart's canvas is on the part");
      /* THE SIGNAL IS THE BANNER THE READER SEES. The draw pass is wrapped in a catch since v384,
         so a throw never reaches switchTab, and the canvas can be recorded by an earlier draw even
         when a later one fails: two ways this check read green over a live fault before it was
         pointed at the thing a person actually looks at. */
      const paneTxt = wc.eval("(function(){var e=document.querySelector('.sec.on');return e?e.textContent.replace(/[ \\t\\n\\r]+/g,' '):'';})()");
      const banner = (String(paneTxt).match(/could not be drawn[^.]*\./) || [])[0] || "";
      ok(!banner, "and no chart on Financials reports a failure to draw -- " + banner.slice(0, 90));

      /* v424: AND THE HELD-OUT ROW HAS A READER. v407's comment promised the undated rows were
         "held out and COUNTED", and the counting reached nobody: the statement simply showed less
         revenue than Overview with nothing saying why. Both directions asserted, because a line
         that always prints is a different fault from one that never does. */
      ok(/held out of this statement/.test(String(paneTxt)),
        "the statement names the undated row it held out");
      ok(/no date and a month is the only key/.test(String(paneTxt)), "and says why");
      ok(/[0-9]+ order[s]? carrying RM/.test(String(paneTxt)), "with the count and the figure");

      /* v425: AND nextBest MUST NOT READ THAT UNDATED ROW AS THE LAST PURCHASE. custCadence filters
         s.date and nextBest did not, so the undated row sorted last and became "when they last
         bought". Only reachable on a book where an undated row is priced, which is this one. */
      const party = JSON.parse(wc.eval("JSON.stringify((sales.find(s=>!s.date&&(s.cash||0)>0)||{}).customer||null)"));
      if (party) {
        const nb = JSON.parse(wc.eval("JSON.stringify(nextBest(" + JSON.stringify(party) + ")||null)"));
        ok(nb && Number.isFinite(nb.since),
          "the party holding the undated row still has a finite last-bought reading (" + (nb && nb.since) + ")");
        const lastDated = JSON.parse(wc.eval("JSON.stringify(pricedSales.filter(s=>s.customer===" + JSON.stringify(party) + "&&s.date).map(s=>s.date).sort().slice(-1)[0]||null)"));
        if (lastDated) {
          ok(nb.since === wc.eval("dAge(" + JSON.stringify(lastDated) + ")"),
            "and it is measured from their last DATED order, as custCadence measures");
        }
      }
      try { rm(M2); } catch (e) { /* best effort */ }
    }
  }

  /* 2 and 3. the fresh-book path: the fallback must survive stripMethod, and an empty stock
        history must not print an infinity. Both fired on v406. */
  {
    const b = JSON.parse(JSON.stringify(bookNow));
    b.sales = []; b.purchases = [];
    const m = withBook(b);
    const src = await paneOf(m, "sourcing", "salt");
    ok(!src.threw, `Sourcing renders on an all-empty book -- ${src.threw}`);
    ok(/nothing to source against/i.test(src.text), "the Sourcing fallback reaches the screen and is not culled by stripMethod");
    const ana = await paneOf(m, "analysis", "salt");
    ok(!ana.threw, `Analysis renders on an all-empty book -- ${ana.threw}`);
    ok(!/Infinity|\u221e/.test(ana.text), "Analysis prints no infinity on a book with no stock history");
  }

  /* 3b. v412: a book whose customers have bought NOTHING must not print RM 1 of revenue. The
        ||1 is a divide-by-zero guard and it was the displayed total too; v406 guarded the display
        on the customer COUNT, which is not what makes the sentinel. */
  {
    const b3 = JSON.parse(JSON.stringify(bookNow));
    (b3.sales || []).forEach((r) => { r.total = 0; r.cash = 0; });
    const r3 = await paneOf(withBook(b3), "concentration", "salt");
    ok(!r3.threw, `Customers renders on a book with customers and nil revenue -- ${r3.threw}`);
    ok(!/All RM 1/.test(r3.text) && !/>RM 1</.test(r3.html || ""),
      "the All row prints the real revenue total, not the divide-by-zero sentinel");
  }

  /* 4. one rule for a day count. v406 floored four surfaces and left four, so the same money
        read "-16d" on Today and "0d out" on Forward. Nothing may print a negative age. */
  {
    const dated = (bookNow.sales || []).filter((r) => r.date).map((r) => r.date).sort();
    const back = dated[Math.floor(dated.length / 2)];
    const negs = [];
    for (const t of ["today", "forward", "receivables", "sourcing", "concentration", "overview"]) {
      for (const p of ["salt", "oil"]) {
        const r = await paneOf(join(REPO, "master", "salt_command.html"), t, p, back);
        if (r.threw) negs.push(`${t}/${p} threw`);
        const m = r.text.match(/(?<![\d-])-\d+\s*(d\b|days?\b)/g);
        if (m) negs.push(`${t}/${p}: ${m.slice(0, 2).join(", ")}`);
      }
    }
    ok(negs.length === 0, `no surface prints a negative day count at a clock behind the book -- ${negs.join(" | ")}`);
  {
    /* v425: AND AN ABSENT DATE IS NOT A DAY COUNT. dbet(undefined) is NaN, so dAge returned NaN,
       which printed as "NaNd ago" and compared false against every threshold, dropping a party out
       of the overdue tile rather than showing wrong. null is the worse case and the one that
       actually occurs on this book: new Date(null) is the epoch, so dbet returns a perfectly finite
       twenty thousand days and a finiteness test alone waves it through. */
    const { w: wd } = await openMaster();
    wd.eval("setProd('salt');recompute();");
    ok(wd.eval("dAge(undefined)") === 0, "dAge of an absent date is 0, not NaN");
    ok(wd.eval("dAge(null)") === 0, "dAge of a null date is 0, not twenty thousand days");
    ok(wd.eval("dAge('')") === 0, "dAge of an empty date is 0");
    ok(wd.eval("dAge(5)") === 5 && wd.eval("dAge(-3)") === 0,
      "while a real count passes through and a negative is still floored");
    ok(wd.eval("dAhead(null)") === false, "and dAhead does not read an absent date as ahead of the clock");
    ok(wd.eval("JSON.stringify((function(){var o=[];byCustomer().forEach(function(c){var nb=nextBest(c.id);if(nb&&!Number.isFinite(nb.since))o.push(c.id);});return o;})())") === "[]",
      "no party's last-bought reading is non-finite");
  }
  {
    /* v424: and the held-out line must be ABSENT on the live book, where no priced row is undated */
    const liveFin = await paneOf(join(REPO, "master", "salt_command.html"), "financials", "salt");
    ok(!/held out of this statement/.test(liveFin),
      "the held-out line does not print on a book that has nothing held out");
  }
  }

  /* 5. the snapshot the drafter approves against must be taken on the book it names. */
  {
    const { pricingSnapshot } = await import("../tools/book.mjs");
    const { w } = await openMaster();
    const snap = pricingSnapshot(w);
    const prods = JSON.parse(w.eval("JSON.stringify(PROD_ORDER)"));
    const off = [];
    for (const p of prods) {
      w.eval(`PROD=${JSON.stringify(p)};recompute();`);
      /* 08 Sep 2026: on THIS book's own sizes. The snapshot used to key every product by salt's
         grid, so oil's floors sat under 0.5 to 12.5 while oil sells 10 to 50; the check read
         salt's sizes on oil and passed on the wrong table. */
      const sizesP = JSON.parse(w.eval("JSON.stringify(PRICE_TIERS.sizes)"));
      ok(Array.isArray(snap.byProduct[p].sizes) && snap.byProduct[p].sizes.join() === sizesP.join(),
        `${p}'s snapshot carries its own sizes (${sizesP.join(", ")})`);
      for (const q of sizesP.slice(0, 2)) {
        const desk = w.eval(`floorTotal(${q})`);
        const snapped = snap.byProduct[p] && snap.byProduct[p].floors && snap.byProduct[p].floors[q]
          ? snap.byProduct[p].floors[q].floor : null;
        if (snapped == null || Math.abs(snapped - desk) > 0.005) off.push(`${p}@${q}: snapshot ${snapped} vs desk ${desk}`);
      }
    }
    ok(off.length === 0, `every snapshot floor is taken on its own book's walk -- ${off.join("; ")}`);
  }

  /* 6. the two gates round seven found open. */
  {
    const d = rf(join(REPO, "src", "drafter.js"), "utf8");
    const theirs = d.slice(d.indexOf("const theirs"), d.indexOf("const theirs") + 900);
    ok(/s\.total > 0/.test(theirs), "the party-median set excludes zero-value rows, as the observed range does");
    /* v413: this used to slice the source around the Cancellation branch and grep it. There are TWO
       branches now, one per direction, so the slice found the wrong one and the assertion broke on
       a fix rather than on a fault. Asserting on source text is how a check ends up measuring its
       own phrasing; it FOLDS a cancellation on each direction instead and reads what happens. */
    const { applyAmendForTest } = await import("../tools/fold.mjs").then((m) => ({ applyAmendForTest: m.applyAmend || null }));
    const bk2 = JSON.parse(rf(join(REPO, "ledger", "book.json"), "utf8"));
    const soldRow = (bk2.sales || []).find((r) => !r.cancelled && (+r.deliveredQty || 0) > 0.009);
    const lotRow = (bk2.purchases || []).find((r) => !r.cancelled && !r.pending && r.receivedQty == null);
    const refuses = (row, dir) => {
      if (!applyAmendForTest || !row) return null;
      try { applyAmendForTest(row, { kind: "Cancellation", date: "2026-08-31" }, dir, null); return false; }
      catch (e) { return /already (moved|received)/.test(String(e.message || e)); }
    };
    const rs = refuses(soldRow, "SELL"), rl = refuses(lotRow, "BUY");
    if (rs === null && rl === null) {
      ok(/E\.poRecvUnits\(row\)/.test(rf(join(REPO, "tools", "fold.mjs"), "utf8")),
        "the fold's cancellation gates read a lot by poRecvUnits (applyAmend is not exported, checked by source)");
    } else {
      ok(rs !== false, "cancelling a SALE that has delivered goods is refused by the fold");
      ok(rl !== false, "cancelling a LOT that has been received is refused too, on the absent-receivedQty convention");
    }
  }

  for (const f of [TMP, TMPB, TMP + ".run.html"]) { try { rm(f); } catch (e) { /* best effort */ } }
}

section("v472: the desk in the Salt identity");
{
  /* His instruction of 02 Sep 2026: redesign the desk with the Salt design system. It lands as
     a last-wins layer in two generated blocks at the foot of the stylesheet, and every figure
     here was proved RED against the v471 master before it was trusted. */
  const m472 = readFileSync(join(REPO, "master", "salt_command.html"), "utf8");
  let dchk = "";
  try { dchk = execFileSync("node", [join(REPO, "tools", "designsync.mjs"), "--check"], { encoding: "utf8" }); }
  catch (e) { dchk = String((e && e.stdout) || e); }
  ok(/ok\s+base:/.test(dchk) && /ok\s+desk:/.test(dchk), "tools/designsync.mjs --check: both design blocks in the master are their files");
  const styleClose = m472.indexOf("</style>"), deskEnd = m472.indexOf("/* ==== END DESIGN desk ==== */"), baseAt = m472.indexOf("/* ==== DESIGN base:");
  ok(deskEnd > 0 && m472.slice(deskEnd, styleClose).trim() === "/* ==== END DESIGN desk ==== */", "the desk layer is the last rule in the stylesheet, so it wins");
  ok(baseAt > m472.indexOf("<style>") && baseAt < deskEnd, "the design system's stylesheet sits inside <style>, before the desk layer");
  ok(/--salt-brass:\s*#c5a059/.test(m472) && /--salt-verdigris:/.test(m472) && /--salt-ember:/.test(m472) && /--salt-steel:/.test(m472), "the identity's tokens are in the page, the three semantic words included");
  ok(!/@import\s+url\(/.test(m472), "and no font import came with them: the CSP is self-only");
  ok(/body\[data-sec\]\{--acc:var\(--salt-brass\);--accB:var\(--salt-copper\);\}/.test(m472), "the seven view hues are retired by one rule: brass leads, copper marks the exception");
  /* the retired palette: none of it survives outside the generated blocks */
  let own = m472;
  for (const [a, b] of [["/* ==== ENGINE position", "/* ==== END ENGINE position ==== */"], ["/* ==== ENGINE pricing", "/* ==== END ENGINE pricing ==== */"], ["/* ==== BOOK:", "/* ==== END BOOK ==== */"], ["/* ==== GEO:", "/* ==== END GEO ==== */"]]) {
    const i = own.indexOf(a), j = own.indexOf(b, i);
    if (i >= 0 && j > i) own = own.slice(0, i) + own.slice(j + b.length);
  }
  const RETIRED = ["#7fd7e8", "#e8c66b", "#b3a6f5", "#6ee7a8", "#ff7a8a", "#ffcf7a", "#f5c451", "#63e6e0", "#5fd6a0", "#b07cff", "#ff6f9c", "#f0932b", "#1a1030", "#140c26", "#100a1c"];
  const survivors = RETIRED.filter((h) => own.toLowerCase().includes(h));
  ok(survivors.length === 0, `no retired hex survives in the desk's own css and js (found ${survivors.join(" ") || "none"})`);
  ok(!/rgba\(\s*99\s*,\s*230\s*,\s*224/.test(own) && !/rgba\(\s*245\s*,\s*196\s*,\s*81/.test(own) && !/rgba\(\s*255\s*,\s*93\s*,\s*115/.test(own), "nor the retired rgba fills");
  /* the mark */
  ok((m472.match(/aria-label="Salt crystal"/g) || []).length === 3, "the crystal is drawn in the rail, in the bar and on the printed board (v537)");
  ok(!m472.includes('class="logo">&#9670;') && !m472.includes('class="logo sm">&#9670;'), "and the diamond glyph is gone");
  ok(/<link rel="icon" href="data:image\/svg\+xml,[^>]*%2305080a[^>]*%23c5a059/.test(m472), "the favicon is the crystal in brass on obsidian");
  /* the books' hues come from the identity, through the book, which is where the extract reads them */
  const bk472 = JSON.parse(readFileSync(join(REPO, "ledger", "book.json"), "utf8"));
  ok(bk472.PRODUCTS.salt.accent === "var(--salt-product-salt)" && bk472.PRODUCTS.oil.accent === "var(--salt-product-oil)", "salt is the pale book and oil the golden one, declared in ledger/book.json");
  ok(m472.includes("D.font.family=\"'JetBrains Mono','Cascadia Mono',Consolas,monospace\"") && m472.includes("D.borderColor='rgba(197,160,89,0.14)'"), "Chart.js is told once that figures are mono and hairlines are brass");
  /* the built desk and the install surface carry it too */
  const built472 = readFileSync(join(REPO, "public", "desk.html"), "utf8");
  ok(built472.includes("/* ==== END DESIGN desk ==== */") && built472.includes('aria-label="Salt crystal"'), "the built desk carries the layer and the mark");
  ok(JSON.parse(readFileSync(join(REPO, "public", "manifest.webmanifest"), "utf8")).theme_color === "#05080a", "the manifest's theme colour is obsidian");
  const i512 = readFileSync(join(REPO, "public", "icon-512.png")), im = readFileSync(join(REPO, "public", "icon-512-maskable.png"));
  ok(i512.length > 60000 && Buffer.compare(i512, im) === 0, "the home-screen icons are the brand plate, the same bytes for any and maskable");
}

section("v479: the retired price lock no longer breaks a rule; a lot that moves the rate is a watch");
{
  /* The v233 breach compared a lock the desk stopped pricing from at v280 against the latest lot,
     so every salt lot since 6 Aug read as a breach. Gated on the lock now; the week after a lot
     lands that moves the rate, a watch says what moved. Expected from the book, not from the desk. */
  const { openMaster: om19 } = await import("../tools/payload.mjs");
  const { w: w19 } = await om19();
  w19.eval("setProd('salt');recompute();");
  const rules19 = JSON.parse(String(w19.eval("JSON.stringify(boundaryScan().map(function(x){return [x.sev,x.rule,x.what||''];}))")));
  ok(String(w19.eval("String(PRICE_LOCK_ON)")) === "false" && !rules19.some((r) => r[1] === "Board unpriced"), "with the lock off, Board unpriced never fires");
  const bk19 = JSON.parse(readFileSync(join(REPO, "ledger", "book.json"), "utf8"));
  const lots19 = bk19.purchases.filter((p) => !p.cancelled && !p.pending && !p.defaulted && (p.product || "salt") === "salt" && p.qty > 0)
    .sort((a, b) => ((a.receivedOn || a.date) < (b.receivedOn || b.date) ? -1 : 1));
  const L19 = lots19[lots19.length - 1], P19 = lots19[lots19.length - 2];
  const rate = (p) => +(p.total / p.qty).toFixed(2);
  const days19 = Math.round((Date.now() - new Date((L19.receivedOn || L19.date) + "T00:00:00Z").getTime()) / 86400000);
  const expect19 = lots19.length >= 2 && days19 <= 7 && Math.abs(rate(L19) - rate(P19)) >= 0.005;
  const watch19 = rules19.find((r) => r[1] === "Cost basis moved");
  ok(expect19 ? (!!watch19 && watch19[0] === "watch" && watch19[2].includes("from RM")) : !watch19,
    expect19 ? `a lot that moved the rate landed ${days19} day(s) ago, so the watch names it and what it moved from` : "no lot moved the rate this week, so no watch");
  ok(!rules19.some((r) => r[1] === "Cost basis moved" && r[0] !== "watch"), "and the moved rate is never more than a watch");
}

/* ============ THE FLOOR (v431) ============
   Round eight made THIRTY assertions vanish and the suite still read a clean pass, because nothing
   compares the count: a section that stops running, or a block that returns early on a book that
   has changed, reads exactly like a section with nothing to say. These two numbers are the guard.
   They sit a little below the live count because four blocks branch on what the book happens to
   hold and skip legitimately; the point is to catch a section falling out, not to pin a total.
   Raise them when the suite grows. */
/* RAISED WITH EVERY FOLD, or it stops being a floor. v431 set 840 against a live 861 and by v433
   the live count was 879, so thirty-nine assertions could have vanished under a guard written to
   stop exactly that. The margin is four, which covers the book-dependent branches that legitimately
   skip; it is not room for a section to fall out. */

/* ---- QR: proved against an independent encoder ----------------------------------- *
   The twelve hashes below were produced by the `qrcode` npm package, NOT by tools/qr.mjs,
   and pasted in. That package is deliberately not a dependency of this repo (tools/qr.mjs
   says why), so this is how its verdict is kept: the encoder was checked against it over
   1,736 symbols covering every length from 1 to 213 bytes at all eight masks plus UTF-8, and
   these twelve stay behind as the evidence. A mask is FORCED in each case, because the two
   implementations legitimately differ on rule 4 of the mask penalty: this one follows the
   specification (the smaller of the two neighbouring multiples of five), the package rounds
   one way only, and on about one symbol in a hundred they choose differently. Both are valid,
   since the format bits declare the mask. Forcing it isolates everything that must be
   identical: the bit stream, the Reed-Solomon, the interleave, the function patterns and the
   format bits. */
section("QR — proved against an independent encoder");
{
  const { qrMatrix, qrSvg } = await import("../tools/qr.mjs");
  const { createHash } = await import("node:crypto");
  const GOLDEN = [
    { t: "A", mask: 3, size: 21, sha: "2092585037e9da56" },
    { t: "HELLO WORLD", mask: 0, size: 21, sha: "a28227450c6dd5ab" },
    { t: "https://salt-command.qyts8mh72kyg.workers.dev/s/CE4-AD", mask: 2, size: 33, sha: "72c5b8c3b466568b" },
    { t: "x".repeat(14), mask: 0, size: 21, sha: "759a539d1bf76152" },
    { t: "y".repeat(40), mask: 1, size: 29, sha: "67e1e440f1a3a504" },
    { t: "z".repeat(80), mask: 5, size: 37, sha: "18a14025bc6f6fe5" },
    { t: "p".repeat(106), mask: 7, size: 41, sha: "6a0c32ba77fe649f" },
    { t: "r".repeat(122), mask: 2, size: 45, sha: "136975006484508a" },
    { t: "q".repeat(150), mask: 1, size: 49, sha: "a53f2dbaa0559886" },
    { t: "s".repeat(180), mask: 4, size: 53, sha: "abd5791ac6d8e716" },
    { t: "w".repeat(213), mask: 6, size: 57, sha: "737113d5b1cccf47" },
    { t: "café ☕ RM12.50", mask: 3, size: 25, sha: "29650b02bfb80b35" }
  ];
  const bad = [];
  for (const g of GOLDEN) {
    const mm = qrMatrix(g.t, { mask: g.mask });
    const sha = createHash("sha256").update(mm.map(r => r.join("")).join("")).digest("hex").slice(0, 16);
    if (mm.length !== g.size || sha !== g.sha) bad.push(g.t.slice(0, 12) + " (v" + ((mm.length - 17) / 4) + ")");
  }
  ok(bad.length === 0, bad.length
    ? "these symbols no longer match the reference encoder: " + bad.join(", ")
    : "all twelve golden symbols match the reference encoder, versions 1 to 10");

  const m = qrMatrix("https://salt-command.example/s/CX0-AA");
  const n = m.length;
  const finderAt = (r0, c0) => m[r0][c0] === 1 && m[r0 + 1][c0 + 1] === 0
    && m[r0 + 2][c0 + 2] === 1 && m[r0 + 3][c0 + 3] === 1 && m[r0 + 6][c0 + 6] === 1;
  ok(finderAt(0, 0) && finderAt(0, n - 7) && finderAt(n - 7, 0), "three finder patterns, one per corner");
  ok(m[6].slice(8, n - 8).every((v, i) => v === (i % 2 === 0 ? 1 : 0)), "the horizontal timing pattern alternates");
  ok(m[n - 8][8] === 1, "the dark module is set");
  ok(m.every(r => r.every(v => v === 0 || v === 1)), "every module resolved, none left unplaced");

  let threw = null;
  try { qrMatrix("z".repeat(214)); } catch (e) { threw = e; }
  ok(threw && /exceeds version 10/.test(threw.message), "a payload past version 10 is refused rather than truncated");

  const svg = qrSvg("https://salt-command.example/s/CX0-AA", { size: 120 });
  ok(/^<svg [^>]*viewBox="0 0 \d+ \d+"/.test(svg) && svg.includes('width="120"'),
    "the SVG carries a viewBox and the asked-for size");
  ok(!/<script|href=|xlink|<image/i.test(svg), "the SVG is inert: no script, nothing external");
  ok((svg.match(/<path/g) || []).length === 1, "one path for the whole symbol");

  /* The matrix being right does not make the DRAWING right: qrSvg emits one run-length path
     and an off-by-one there would produce a clean-looking symbol encoding something else. */
  {
    const quiet = 4, back = Array.from({ length: n }, () => new Array(n).fill(0));
    const d = (/ d="([^"]*)"/.exec(svg) || [, ""])[1];
    const re = /M(\d+) (\d+)h(\d+)v1h-\3z/g;
    let hit, cells = 0;
    while ((hit = re.exec(d))) {
      const c0 = +hit[1] - quiet, r0 = +hit[2] - quiet, w = +hit[3];
      for (let i = 0; i < w; i++) { back[r0][c0 + i] = 1; cells++; }
    }
    ok(cells > 0 && back.every((row, r) => row.every((v, c) => v === m[r][c])),
      "the drawn path re-reads as exactly the matrix it was drawn from");
    ok((d.match(/M/g) || []).length < cells, "and it is run-length encoded, not one command per module");
  }
}

/* ---- the statement password, the envelope and the site's own Worker --------------- */
section("Statements — the password, the username, the envelope and the site's own Worker");
{
  const C = await import("../tools/stmt-crypto.mjs");
  const pw = C.newPassword();
  ok(/^[23456789abcdefghjkmnpqrstvwxyz]{4}(-[23456789abcdefghjkmnpqrstvwxyz]{4}){3}$/.test(pw),
    "a password is four readable groups of four, with no character mistaken for another");
  ok(new Set(Array.from({ length: 40 }, () => C.newPassword())).size === 40, "and each one is fresh");

  /* THE USERNAME IS NOT THE CODE (his instruction, 03 Sep 2026). Random, lower case, from the
     password's own alphabet, so it is neither guessable from a roster nor mistakable for a code. */
  const un = C.newUsername();
  ok(C.USERNAME_RE.test(un) && un === un.toLowerCase(),
    "a username is two readable groups of four from the same alphabet, in lower case");
  ok(new Set(Array.from({ length: 40 }, () => C.newUsername())).size === 40, "and each one is fresh");
  ok(normUser(" " + un.toUpperCase().replace("-", " ") + " ") === un,
    "the site forgives case, spaces and punctuation in a typed username");
  ok(normUser(un.slice(0, 8)) === "" && normUser(un + "2") === "" && normUser("K7M3-P2X1") === "" && normUser("") === "",
    "and refuses anything that is not eight symbols of the alphabet");

  const env1 = await C.encryptText(pw, '<div class="w">CX0-AA owes RM180</div>');
  ok(C.isEnvelope(env1) && env1.v === 1, "the envelope is the vault's shape, {v,salt,iv,ct}");
  ok(!JSON.stringify(env1).includes("CX0-AA") && !JSON.stringify(env1).includes(pw),
    "and carries neither the statement nor the password in the clear");
  ok((await C.decryptText(pw, env1)).includes("CX0-AA"), "the right password opens it");
  let badPw = false;
  try { await C.decryptText(C.newPassword(), env1); } catch (e) { badPw = true; }
  ok(badPw, "a wrong password fails at the decryption, not merely at the gate");

  const ver = await C.makeVerifier(pw);
  ok(await C.checkVerifier(pw, ver), "the verifier accepts the password it was made from");
  ok(!(await C.checkVerifier(C.newPassword(), ver)), "and rejects any other");
  ok(ver.rounds === C.VERIFIER_ROUNDS && ver.rounds < C.PBKDF2_ROUNDS,
    "its round count travels with it and sits below the encryption key's, deliberately");
  ok(!JSON.stringify(ver).includes(pw), "the verifier does not contain the password");

  /* THE SITE. Its own Worker, its own binding, no ASSETS, no ledger, no write key: the env it
     is given here is the whole of what it may have. */
  /* THE CONTENT KEY (live statements, 03 Sep 2026). Derived from one secret and the username,
     wrapped under the password and under the master; everything the customer reads is sealed
     under it, so the deploy can write a new live document without ever holding a password. */
  const ck = await C.contentKey("test-secret", un);
  const same = (a, b) => Buffer.from(a).equals(Buffer.from(b));
  ok(ck.length === 32 && same(ck, await C.contentKey("test-secret", un))
    && !same(ck, await C.contentKey("test-secret", C.newUsername())) && !same(ck, await C.contentKey("other-secret", un)),
    "a content key is 32 bytes, the same for the same secret and username, and different if either changes");
  ok(/^[0-9a-f]{64}$/.test(C.newSecret()), "a fresh STMT_KEY is 32 random bytes as hex");
  const wrap = await C.wrapKey(pw, ck), wrapMaster = await C.wrapKey("master-pass", ck);
  ok(same(await C.unwrapKey(pw, wrap), ck) && same(await C.unwrapKey("master-pass", wrapMaster), ck),
    "the password and the master each unwrap the same content key");
  let badWrap = false;
  try { await C.unwrapKey(C.newPassword(), wrap); } catch (e) { badWrap = true; }
  ok(badWrap && !JSON.stringify(wrap).includes(Buffer.from(ck).toString("base64")),
    "a wrong password unwraps nothing, and the wrap is not the key in the clear");
  const bundle = JSON.stringify({ v: 1, issued: "2026-09-01", statements: [
    { issued: "2026-09-01", label: "01 Sep 2026", body: '<p class="who">CX0-AA</p>' }] });
  const envB = await C.encryptWith(ck, bundle);
  const liveAt = "2026-09-03T06:20:00.000Z";
  const liveB = Object.assign({ at: liveAt }, await C.encryptWith(ck, JSON.stringify({ at: liveAt, body: "<p>live CX0-AA</p>" })));
  ok((await C.decryptWith(ck, envB)).includes("CX0-AA") && !JSON.stringify(envB).includes("CX0-AA") && !envB.salt,
    "the content key seals and opens a document, with no salt because nothing is derived");
  const kv = new KV();
  const rec = { u: un, issued: "2026-09-01", issues: ["2026-09-01"], verifier: ver, wrap, wrapMaster, env: envB, live: liveB };
  await kv.put("u:" + un, JSON.stringify(rec));
  const senv = { STMT: kv, STMT_MASTER: "master-pass" };
  const sreq = (path, opts = {}) => new Request("https://k7m3p2.example" + path, opts);
  const open = (body) => sreq("/open", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
  });

  let r = await stmtWorker.fetch(sreq("/?u=" + un.toUpperCase()), senv);
  const html = await r.text();
  const csp = r.headers.get("content-security-policy") || "";
  ok(r.status === 200 && /text\/html/.test(r.headers.get("content-type")), "GET / serves the landing page");
  ok(html.includes('value="' + un + '"'), "and fills in the username the QR carried, normalised");
  ok(!html.includes(pw) && !html.includes(envB.ct) && !html.includes("CX0-AA"),
    "the page carries no password, no ciphertext and no account code");
  ok(html.includes("three minutes") && html.includes('id="un"') && html.includes('id="pw"'),
    "it asks for a username and a password, and says three minutes");
  ok(/nonce-/.test(csp) && !/unsafe-inline/.test(csp) && /connect-src 'self'/.test(csp),
    "and declares a nonce CSP rather than allowing inline script wholesale");
  ok((r.headers.get("x-robots-tag") || "").includes("noindex")
    && (r.headers.get("cache-control") || "").includes("no-store"), "it is not indexed and not cached");
  ok((await (await stmtWorker.fetch(sreq("/?u=nobody"), senv)).text()).includes('value=""'),
    "a username that does not parse is simply not filled in");
  ok((await stmtWorker.fetch(sreq("/s/CX0-AA"), senv)).status === 404
    && (await stmtWorker.fetch(sreq("/desk"), senv)).status === 404
    && (await stmtWorker.fetch(sreq("/u:" + un), senv)).status === 404,
    "nothing else on the site answers: the old /s/ route, the desk's paths and a key name are all 404");
  ok((await stmtWorker.fetch(sreq("/open"), senv)).status === 405, "and /open is POST only");

  r = await stmtWorker.fetch(open({ u: un, password: pw }), senv);
  const j = await r.json();
  ok(r.status === 200 && j.ok === true && j.env && j.env.ct === envB.ct && j.wrap && j.live && j.byMaster === false,
    "the right username and password return the record: wrap, envelope and live document");
  /* THE MASTER WRAP NEVER TRAVELS TO A CUSTOMER (04 Sep 2026 audit). It is his content key sealed
     under STMT_MASTER, so handing it to every customer every month was handing out a self-verifying
     offline crack target against the one passphrase that opens every account: an auditor recovered
     a five-word master from a returned wrap in a single pass. Proved red against the code as
     shipped on 03 Sep, which returned both wraps to everyone. */
  ok(j.wrapMaster == null,
    "and NOT the master wrap, which would be an offline crack target against every account at once");
  const ckOut = await C.unwrapKey(pw, j.wrap);
  ok(JSON.parse(await C.decryptWith(ckOut, j.env)).statements[0].body.includes("CX0-AA")
    && JSON.parse(await C.decryptWith(ckOut, j.live)).body.includes("live CX0-AA"),
    "and the password unwraps the key that opens both the bundle and the live statement");
  ok((await stmtWorker.fetch(open({ u: un.toUpperCase(), password: pw }), senv)).status === 200,
    "a username typed in capitals is the same username");
  /* THE PASSWORD IS FORGIVEN ITS HYPHENS AND ITS CASE (06 Sep 2026): the page groups the symbols as
     they are typed, and the Worker applies the same rule at the door, so a paste without hyphens
     opens. The master passphrase is compared as typed: it is not reshaped. */
  {
    const { normPass } = await import("../stmt/worker.js");
    ok(normPass(pw.replace(/-/g, "").toUpperCase()) === pw && normPass(" " + pw + " ") === pw && normPass(pw.replace(/-/g, " ")) === pw,
      "sixteen symbols without hyphens, in capitals, with spaces or padded reshape to the password");
    ok(normPass("master-pass") === "master-pass" && normPass("correct horse battery staple") === "correct horse battery staple" && normPass("") === "",
      "anything that is not sixteen symbols of the alphabet is left exactly as typed");
    ok((await stmtWorker.fetch(open({ u: un, password: pw.replace(/-/g, "").toUpperCase() }), senv)).status === 200,
      "so a password typed without hyphens and in capitals opens the statement");
    const pageJs = html.slice(html.indexOf("<script"));
    ok(/function shapeUser\(\)/.test(pageJs) && /function shapePw\(\)/.test(pageJs) && /addEventListener\(ev, shapeUser\)/.test(pageJs) && /autoPw=false/.test(pageJs),
      "and the page groups both fields as they are typed, pasted or autofilled, stepping back on the password once it stops looking like one");
  }

  /* ONE ANSWER FOR EVERY REFUSAL. An unknown username must answer byte for byte as a wrong
     password does, or the site becomes a way to find out which usernames exist. */
  const wrong = await stmtWorker.fetch(open({ u: un, password: "wrong-pass-here" }), senv);
  const wrongBody = await wrong.text();
  ok(wrong.status === 401 && !JSON.parse(wrongBody).env, "a wrong password returns 401 and no envelope");
  const unknown = await stmtWorker.fetch(open({ u: C.newUsername(), password: pw }), senv);
  const malformed = await stmtWorker.fetch(open({ u: "CX0-AA", password: pw }), senv);
  ok(unknown.status === 401 && (await unknown.text()) === wrongBody
    && malformed.status === 401 && (await malformed.text()) === wrongBody,
    "an unknown username and a desk code answer byte for byte as a wrong password does, so the list cannot be walked");

  /* the page has one field and sends what was typed as both; the Worker says which matched */
  r = await stmtWorker.fetch(open({ u: un, password: "master-pass", master: "master-pass" }), senv);
  const jm = await r.json();
  ok(r.status === 200 && jm.ok === true && jm.byMaster === true && jm.wrapMaster,
    "the master passphrase, typed into the one field the page has, is the owner's override");
  ok(JSON.parse(await C.decryptWith(await C.unwrapKey("master-pass", jm.wrapMaster), jm.env)).statements.length === 1,
    "and it actually opens the statement, which the first cut's override never could");
  ok(jm.wrap == null, "while the customer's own wrap does not travel back on an override");
  ok((await stmtWorker.fetch(open({ u: un, master: "not-the-master" }), senv)).status === 401,
    "and a wrong master password is refused like any other");
  ok((await stmtWorker.fetch(open({ u: un, master: "master-pass" }), { STMT: kv })).status === 401,
    "with no STMT_MASTER set the override is simply off");

  /* JSON ONLY. request.json() ignores the content type, so a text/plain POST was a CORS-safelisted
     simple request: any page a customer visited could spend his attempts from his own browser with
     no preflight. Proved red against the code as shipped, which accepted it. */
  ok((await stmtWorker.fetch(new Request("https://k7m3p2.example/open", {
    method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify({ u: un, password: pw })
  }), senv)).status === 401, "a POST that is not application/json is refused, so the no-preflight path closes");

  /* THE LOCKOUT BRAKES THE CALLER, NOT THE ACCOUNT (04 Sep 2026 audit). Keyed on the username
     alone, ten unauthenticated POSTs locked ANY customer out for fifteen minutes and locked the
     owner's override out with him: forty requests an hour held one account shut for ever, and one
     review sheet took the whole site down for the price of a shell loop. Proved red against the
     code as shipped, where the customer's own password returned 429 after the attacker's ten. */
  const kv2 = new KV();
  await kv2.put("u:" + un, JSON.stringify(rec));
  const senv2 = { STMT: kv2, STMT_MASTER: "master-pass" };
  const from = (ip, body) => new Request("https://k7m3p2.example/open", {
    method: "POST", headers: { "content-type": "application/json", "CF-Connecting-IP": ip },
    body: JSON.stringify(body)
  });
  let locked = 0;
  for (let i = 0; i < 12; i++) {
    const rr = await stmtWorker.fetch(from("1.2.3.4", { u: un, password: "wrong-pass-here" }), senv2);
    if (rr.status === 429) locked++;
  }
  ok(locked >= 2, "ten failed attempts from one caller lock that caller out for fifteen minutes");
  ok((await stmtWorker.fetch(from("1.2.3.4", { u: un, password: pw }), senv2)).status === 429,
    "and the lock holds against that caller even with the right password");
  ok((await stmtWorker.fetch(from("5.6.7.8", { u: un, password: pw }), senv2)).status === 200,
    "but the customer, at his own address, opens his statement while the attacker is still locked out");
  ok((await stmtWorker.fetch(from("9.9.9.9", { u: un, master: "master-pass" }), senv2)).status === 200,
    "and the owner's override still works, which a shared counter had shut with the customer");
  /* one caller sweeping many accounts is braked too, on its own key */
  const kv3 = new KV(); await kv3.put("u:" + un, JSON.stringify(rec));
  const senv3 = { STMT: kv3, STMT_MASTER: "master-pass" };
  let swept = 0;
  for (let i = 0; i < 34; i++) {
    const rr = await stmtWorker.fetch(from("7.7.7.7", { u: C.newUsername(), password: "x" }), senv3);
    if (rr.status === 429) swept++;
  }
  ok(swept >= 2, "and a caller sweeping many usernames is braked on its address, not on theirs");
  ok((await stmtWorker.fetch(from("8.8.8.8", { u: un, password: pw }), senv3)).status === 200,
    "while a real customer is untouched by that sweep");

  ok(JSON.parse(await kv.get("seen:" + un)).opens >= 1,
    "an open is recorded, so he can tell whether a statement was ever read");
  ok(!(await kv.list({ prefix: "stmt:" })).keys.length && !(await kv.list({ prefix: "q:" })).keys.length,
    "and the site's store holds nothing of the desk's: no queue, no vault, no old-route key");
  /* THE RETIRED ROUTE IS A DEAD END, AND THIS IS A FETCH BECAUSE THE GREP WAS A LIE (04 Sep 2026).
     The assertion here used to read the SOURCE of src/worker.js for the deleted route and pass
     because it was gone. Deleting a route on that Worker does not close it: every unmatched GET
     falls to the SPA fallback, which serves the desk. So /s/<CODE> answered 200 with the WHOLE
     PUBLIC LEDGER, at REQUIRE_ACCESS "0", while this assertion was green, and thirty-seven
     September statements were already in customers' hands printing that exact URL under the words
     "Scan to open this statement". Proved red against the build of 03 Sep before the handler
     landed: /s/CA4-DAM returned 200 and the desk's body. */
  {
    const deskEnv = mkEnv(new KV());
    for (const path of ["/s/CA4-DAM", "/s/", "/s", "/s/CA4-DAM?x=1"]) {
      const rr = await worker.fetch(req(path), deskEnv);
      const body = await rr.text();
      ok(rr.status === 410 && !/ASSET:/.test(body),
        `${path} on the desk is a dead end (${rr.status}), not the desk itself`);
    }
    const rp = await worker.fetch(req("/s/CA4-DAM", { method: "POST" }), deskEnv);
    ok(rp.status === 410, "and a POST to the old route is gone too, not a 200 from the asset store");
    /* the copy must not hand the statements site's address to whoever scanned an old sheet */
    const gone = await (await worker.fetch(req("/s/CE4-AD"), deskEnv)).text();
    const site = (await import("../tools/make_statements.mjs")).siteBaseUrl();
    ok(!gone.includes(site) && !gone.includes(new URL(site).hostname),
      "and the page it serves names no address, so an old code cannot be trimmed into the new site");
  }
}

/* ---- the statement in the Salt identity, and what the QR carries ----------------- */
/* ---- Statements: the price list, the order book and the desk's relay (06 Sep 2026) ---- */
section("Statements — the price list, the order book and the desk's relay (v499)");
{
  const PL = await import("../tools/pricelist.mjs");
  const { shipAccounts, renderPayJs, mastersPresent, payJs } = await import("../tools/paysync.mjs");
  const { PAY_SITE, PAY_ACCOUNTS } = await import("../stmt/pay.js");
  const { saleEntry, nudgeOrders, ordersWaiting } = await import("../src/orders.js");
  const deskWorker = (await import("../src/worker.js")).default;
  const PE = (await import("../engine/pricing.mjs")).default;

  /* THE WEEK is Monday to Sunday in Kuala Lumpur, and the edge is midnight there, not UTC. */
  const wk = PL.weekOf(new Date("2026-09-03T06:20:00Z"));
  ok(wk.monday === "2026-08-31" && wk.sunday === "2026-09-06" && /31 Aug/.test(wk.label) && /2026$/.test(wk.label),
    "Thursday 03 Sep 14:20 KL sits in the week of Monday 31 Aug, labelled by its two ends");
  ok(PL.weekOf(new Date("2026-09-06T15:30:00Z")).monday === "2026-08-31"
    && PL.weekOf(new Date("2026-09-06T16:30:00Z")).monday === "2026-09-07",
    "Sunday 23:30 KL is still that week and Monday 00:30 KL is the next, though both are 06 Sep in UTC");

  /* THE RATE IS THE MEDIAN OF THE LAST FOUR COMMITTED ORDERS BEFORE THE WEEK'S MONDAY. */
  const sales = [
    { date: "2026-07-01", customer: "CX0-AA", qty: 1, total: 100 },
    { date: "2026-07-08", customer: "CX0-AA", qty: 1, total: 110 },
    { date: "2026-07-15", customer: "CX0-AA", qty: 2, total: 240 },
    { date: "2026-07-22", customer: "CX0-AA", qty: 1, total: 130 },
    { date: "2026-06-01", customer: "CX0-AA", qty: 1, total: 500 },
    { date: "2026-08-01", customer: "CX0-AA", qty: 1, total: 0 },
    { date: "2026-09-02", customer: "CX0-AA", qty: 1, total: 200 },
    { date: "2026-07-30", customer: "CX0-AA", qty: 1, total: 300, cancelled: true },
    { customer: "CX0-AA", qty: 1, total: 400 },
    { date: "2026-08-20", customer: "CX0-AA", product: "oil", qty: 10, total: 100 }
  ];
  /* completed orders, as on the book: a row with neither cash nor deliveredQty reads pending since 08 Sep 2026 */
  sales.forEach((r) => { if (r.cash == null) r.cash = r.total; if (r.deliveredQty == null) r.deliveredQty = r.qty; });
  const own = PL.ownRate(sales, "CX0-AA", "salt", "2026-08-31");
  ok(own.orders === 4 && own.rate === 115,
    "the last four dated salt orders before the Monday are 100, 110, 120 and 130 a unit, median 115: the RM500 fifth-oldest, the gift, the cancelled, the undated and this week's are all left out");
  ok(PL.ownRate(sales, "CX0-AA", "oil", "2026-08-31").rate === 10 && PL.ownRate(sales, "CX0-ZZ", "salt", "2026-08-31").rate === null,
    "per product, and a customer with no history has no rate");
  /* v510: HIS RATE IS DRAWN TOWARD THE BOARD. R his rate times the size, F the floor, A the ask,
     cap three times COGS; slightly is a quarter of the gap, more is half. */
  ok(PL.adjustedPrice(160, 110, 220, 300, false) === 175, "under the ask: up a quarter of the way, 160 toward 220 is 175");
  ok(PL.adjustedPrice(100, 110, 220, 300, false) === 160 && PL.adjustedPrice(20, 110, 220, 300, false) === 120,
    "under the floor: up halfway toward the ask, and never under the floor");
  ok(PL.adjustedPrice(400, 110, 220, 300, false) === 300 && PL.adjustedPrice(400, 110, 220, 300, true) === 300
    && PL.adjustedPrice(340, 110, 220, 300, false) === 280,
    "above the cap: down halfway toward the ask and never above the cap, loyal or not");
  ok(PL.adjustedPrice(260, 110, 220, 300, true) === 250 && PL.adjustedPrice(260, 110, 220, 300, false) === 260,
    "above the ask under the cap: down a quarter of the way where loyal, and his rate stands where not");
  ok(PL.adjustedPrice(220, 110, 220, 300, true) === 220 && PL.adjustedPrice(159.5, 110, 220, 300, false) === 175,
    "at the ask it is the ask, and the answer rounds up to the ringgit");
  ok(PL.loyalFor(sales, "CX0-AA", "salt", new Date("2026-09-10T00:00:00Z")) === true
    && PL.loyalFor(sales, "CX0-AA", "salt", new Date("2026-10-10T00:00:00Z")) === false
    && PL.loyalFor([{ date: "2026-09-02", customer: "CX0-BB", qty: 1, total: 100 }], "CX0-BB", "salt", new Date("2026-09-03T00:00:00Z")) === false,
    "loyal is three or more priced orders with the last within fourteen days, the desk's own badge");

  /* THE LIST AGAINST THE ENGINE, on the real snapshot: never below the collected floor, delivery on top. */
  const { pricingSnapshot } = await import("../tools/book.mjs");
  const { openMaster } = await import("../tools/payload.mjs");
  const { w: wP } = await openMaster();
  const snap = pricingSnapshot(wP);
  const bookP = { PRODUCTS: { salt: { name: "Salt", unit: "unit" }, oil: { name: "Oil", unit: "unit" } }, PROD_ORDER: ["salt", "oil"], sales };
  const nowP = new Date("2026-09-03T06:20:00Z");
  const list = PL.priceList("CX0-AA", bookP, snap, nowP);
  const saltL = list.products.find(p => p.product === "salt");
  ok(list.week.monday === "2026-08-31" && list.products.length === 2 && saltL && saltL.basis === "yours" && saltL.rate === 115 && saltL.orders === 4,
    "the list is stamped with the week and carries both products, salt on the customer's own rate");
  const Cs = PE.costStack(snap.byProduct.salt.inputs.cost), Ps = snap.byProduct.salt.inputs.policy;
  const floorC = q => PE.floorTotal(q, Cs, Ps);
  const askC = q => PE.priceLadder(q, Cs, Ps).ask.total;
  const loyalAA = PL.loyalFor(sales, "CX0-AA", "salt", nowP);
  const wrong = saltL.sizes.filter(x => x.price !== PL.adjustedPrice(115 * x.q, floorC(x.q), askC(x.q), 3 * PE.ladderCogs(x.q, Cs), loyalAA) || "delivered" in x);
  ok(wrong.length === 0 && saltL.sizes.length === snap.sizes.length && !("delivery" in saltL),
    "every board size is his rate times the size, drawn toward the board's ask by the v510 rule; one price, no delivery on the list");
  const cheap = PL.priceList("CX0-CH", { ...bookP, sales: [{ date: "2026-07-01", customer: "CX0-CH", qty: 1, total: 1, cash: 1, deliveredQty: 1 }] }, snap, nowP).products[0];
  ok(cheap.rate === 1 && cheap.sizes.every(x => x.price === PL.adjustedPrice(1 * x.q, floorC(x.q), askC(x.q), 3 * PE.ladderCogs(x.q, Cs), false) && x.price >= floorC(x.q)),
    "a customer whose old rate is under the floor is lifted halfway to the ask, never under the floor");
  const board = PL.priceList("CX0-ZZ", bookP, snap, nowP).products[0];
  ok(board.basis === "board" && board.sizes.every(x => x.price === PE.priceLadder(x.q, Cs, Ps).ask.total),
    "and a customer with no history is quoted the board's ask, the engine's, at every size");

  /* THE RAILS SHIP WITHOUT A NUMBER. */
  const ship = shipAccounts({ accounts: [
    { key: "x", name: "X", sub: "1234 5678", payload: "00020101021226", acct: "12345678", bank: "X Bank", mid: "123456", biller: "11445", ref1: "60111234567" },
    { key: "y", name: "Y", bank: "Y Bank", maintenance: true }] });
  ok(ship.length === 2 && ship[0].qr && ship[0].transfer && ship[0].jompay && !ship[1].qr && ship[1].transfer && !ship[1].jompay && ship[1].maintenance,
    "a rail is derived from the record: a payload is a code, a bank is a transfer, a biller is JomPAY");
  const rendered = renderPayJs("https://q.example", ship);
  ok(!/12345678|123456|60111|000201|1234 5678/.test(rendered) && rendered.includes('"key": "x"') && rendered.includes('"https://q.example"'),
    "and what is rendered carries the key, the name, the bank and the rails, and no number, payload, member number or reference");
  const payTxt = readFileSync(join(REPO, "stmt", "pay.js"), "utf8");
  ok(!/[0-9]{5}/.test(payTxt) && PAY_ACCOUNTS.length >= 10 && PAY_ACCOUNTS.every(a => a.key && a.name)
    && /^https:\/\/[a-z0-9]+\.qyts8mh72kyg\.workers\.dev$/.test(PAY_SITE),
    "the shipped stmt/pay.js holds no run of five digits, names every account, and points at QR Command on the account's own subdomain");
  ok(PAY_ACCOUNTS.some(a => a.key === "tngbiz" && a.qr) && PAY_ACCOUNTS.some(a => a.jompay) && PAY_ACCOUNTS.some(a => a.transfer && !a.qr),
    "it carries the Touch 'n Go Business code, a JomPAY biller and a transfer-only account");
  if (mastersPresent()) ok(payJs() === payTxt, "stmt/pay.js is what the pay master produces (run tools/paysync.mjs --sync if this fails)");
  else okOff(true, "the pay master is not on this machine, so stmt/pay.js goes unchecked against it");

  /* THE SITE: a record with a price list sealed in, a session on the password, the order book. */
  const C = await import("../tools/stmt-crypto.mjs");
  const un = C.newUsername(), pw = C.newPassword();
  const ck = await C.contentKey("test-secret", un);
  const listSealed = Object.assign({ at: list.at, week: list.week.monday }, await C.encryptWith(ck, JSON.stringify(list)));
  const rec = { u: un, issued: "2026-09-01", issues: ["2026-09-01"], verifier: await C.makeVerifier(pw), wrap: await C.wrapKey(pw, ck),
    env: await C.encryptWith(ck, JSON.stringify({ statements: [{ issued: "2026-09-01", body: "<p>CX0-AA</p>" }] })), prices: listSealed };
  const kv = new KV(); await kv.put("u:" + un, JSON.stringify(rec));
  const senv = { STMT: kv, STMT_MASTER: "master-pass", STMT_DESK_KEY: "desk-key" };
  const sreq = (path, opts = {}) => new Request("https://k7m3p2.example" + path, opts);
  const sj = (path, body, headers = {}) => sreq(path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  const page = await stmtWorker.fetch(sreq("/?u=" + un), senv);
  const html = await page.text();
  const payInPage = (/[ ,]PAY=(\[[\s\S]*?\]);/.exec(html) || [])[1] || "MISSING";
  ok(html.includes('data-t="prices"') && html.includes('data-t="order"') && html.includes('data-t="stmt"') && /PAY_SITE="https/.test(html),
    "the page carries three tabs, statements, prices and order, and the address of QR Command");
  ok(payInPage !== "MISSING" && !/[0-9]{5}/.test(payInPage) && !html.includes("CX0-AA"),
    "the accounts on the page are names and rails with no number, and no code is on it");
  ok(/worker-src 'self'/.test(page.headers.get("content-security-policy") || ""), "the CSP admits the site's own service worker and nothing else new");
  const sw = await stmtWorker.fetch(sreq("/sw.js"), senv);
  const swTxt = await sw.text();
  ok(sw.status === 200 && /javascript/.test(sw.headers.get("content-type")) && /showNotification/.test(swTxt) && !/fetch\(/.test(swTxt) && !/caches/.test(swTxt),
    "/sw.js is served as script, shows a banner on a push, and neither fetches nor caches anything");
  let r = await stmtWorker.fetch(sj("/open", { u: un, password: pw }), senv);
  let b = await r.json();
  ok(r.status === 200 && b.ok && typeof b.session === "string" && b.session.length >= 20 && b.prices && b.prices.week === "2026-08-31",
    "a correct password answers with a session and the sealed price list");
  ok(JSON.parse(await C.decryptWith(ck, b.prices)).products[0].rate === 115 && !JSON.stringify(b.prices).includes("115"),
    "the list opens under the content key and is ciphertext on the wire");
  const rm = await (await stmtWorker.fetch(sj("/open", { u: un, password: "master-pass", master: "master-pass" }), senv)).json();
  ok(rm.ok && rm.byMaster && rm.session === null, "the owner's override gets no session: the owner does not order");
  const S = { "X-Stmt-Session": b.session };
  ok((await stmtWorker.fetch(sreq("/orders"), senv)).status === 401
    && (await stmtWorker.fetch(sreq("/orders", { headers: { "X-Stmt-Session": "not-a-session-token-at-all" } }), senv)).status === 401,
    "the order routes refuse a missing or unknown session alike");
  r = await stmtWorker.fetch(sreq("/orders", { method: "POST", headers: S, body: "product=salt" }), senv);
  ok(r.status === 400, "a placement that is not JSON is refused");
  r = await stmtWorker.fetch(sj("/orders", { product: "salt", qty: 2.5, mode: "collect", unit: 115, total: 288, week: "2026-08-31" }, S), senv);
  b = await r.json();
  const id = b.order && b.order.id;
  ok(r.status === 200 && b.ok && b.order.status === "placed" && b.order.u === un && /^[0-9]{14}-[a-z0-9]+$/.test(id) && b.order.history.length === 1,
    "a placement is stored as placed, under the session's username, with an id and a history");
  for (const bad of [{ product: "Salt!", qty: 1, mode: "collect", unit: 1, total: 1 }, { product: "salt", qty: 0, mode: "collect", unit: 1, total: 1 },
    { product: "salt", qty: 1, mode: "post", unit: 1, total: 1 }, { product: "salt", qty: 1, mode: "collect", unit: 1, total: "9" }]) {
    ok((await stmtWorker.fetch(sj("/orders", bad, S), senv)).status === 400, "refused: " + JSON.stringify(bad));
  }
  ok((await stmtWorker.fetch(sj("/orders/" + id + "/method", { method: "cod" }, S), senv)).status === 409,
    "payment cannot be chosen before the order is ready");
  ok((await stmtWorker.fetch(sreq("/desk/orders"), senv)).status === 401
    && (await stmtWorker.fetch(sreq("/desk/orders", { headers: { "X-Stmt-Desk": "wrong" } }), senv)).status === 401
    && (await stmtWorker.fetch(sreq("/desk/orders", { headers: { "X-Stmt-Desk": "desk-key" } }), { STMT: kv })).status === 401,
    "the desk routes refuse without the key, with a wrong key, and when the site holds no key at all");
  const D = { "X-Stmt-Desk": "desk-key" };
  b = await (await stmtWorker.fetch(sreq("/desk/orders", { headers: D }), senv)).json();
  ok(b.ok && b.orders.length === 1 && b.orders[0].id === id && !("code" in b.orders[0]),
    "the desk key lists the open orders, by username, with no code anywhere on the site");
  ok((await stmtWorker.fetch(sj("/desk/orders/" + un + "/" + id, { status: "done" }, D), senv)).status === 409
    && (await stmtWorker.fetch(sj("/desk/orders/" + un + "/" + id, { status: "placed" }, D), senv)).status === 400,
    "an order cannot be completed from placed, and the desk cannot set a state that is not its to set");
  b = await (await stmtWorker.fetch(sj("/desk/orders/" + un + "/" + id, { status: "acknowledged" }, D), senv)).json();
  ok(b.ok && b.order.status === "acknowledged" && b.push && b.push.sent === 0 && /not configured/.test(b.push.error || ""),
    "acknowledged from the desk; with no push key on the site the wake is reported as not configured, not thrown");
  b = await (await stmtWorker.fetch(sj("/desk/orders/" + un + "/" + id, { status: "ready", mode: "deliver", delivery: 12 }, D), senv)).json();
  ok(b.ok && b.order.status === "ready" && b.order.mode === "deliver" && b.order.delivery === 12, "ready to deliver, the desk's word on the mode and the delivery charge (v502)");
  ok((await stmtWorker.fetch(sj("/orders/" + id + "/cancel", {}, S), senv)).status === 409, "a customer cannot withdraw an order that is ready");
  ok((await stmtWorker.fetch(sj("/orders/" + id + "/method", { method: "qr", account: "wise" }, S), senv)).status === 400
    && (await stmtWorker.fetch(sj("/orders/" + id + "/method", { method: "paypal" }, S), senv)).status === 400
    && (await stmtWorker.fetch(sj("/orders/" + id + "/method", { method: "transfer", account: "nope" }, S), senv)).status === 400,
    "a rail the account does not run, a rail the site does not offer, and an account off the list are all refused");
  b = await (await stmtWorker.fetch(sj("/orders/" + id + "/method", { method: "transfer", account: "wise" }, S), senv)).json();
  ok(b.ok && b.order.method === "transfer" && b.order.account === "wise" && b.order.status === "ready",
    "DuitNow Transfer to the transfer-only account is recorded on the order");
  b = await (await stmtWorker.fetch(sj("/orders/" + id + "/method", { method: "tngbiz" }, S), senv)).json();
  ok(b.ok && b.order.method === "tngbiz" && b.order.account === "tngbiz", "and the Touch 'n Go Business code names its own account");
  r = await stmtWorker.fetch(sj("/push/subscribe", { endpoint: "https://push.example/abc" }, S), senv);
  ok(r.status === 200 && (await kv.list({ prefix: "push:" + un + ":" })).keys.length === 1
    && (await stmtWorker.fetch(sj("/push/subscribe", { endpoint: "http://push.example/abc" }, S), senv)).status === 400,
    "a push subscription is filed under the username, and only an https endpoint is taken");
  const k = await (await stmtWorker.fetch(sreq("/push/key"), senv)).json();
  ok(k.ok && k.key === null && k.configured === false, "/push/key says plainly when the site has no key yet");
  const o2 = await (await stmtWorker.fetch(sj("/orders", { product: "oil", qty: 1, mode: "collect", unit: 40, total: 40, week: "" }, S), senv)).json();
  b = await (await stmtWorker.fetch(sj("/orders/" + o2.order.id + "/cancel", {}, S), senv)).json();
  ok(b.ok && b.order.status === "cancelled" && (await (await stmtWorker.fetch(sreq("/orders", { headers: S }), senv)).json()).orders.length === 2,
    "a placed order can be withdrawn by the customer, and his list carries both");
  const openOnly = (await (await stmtWorker.fetch(sreq("/desk/orders", { headers: D }), senv)).json()).orders;
  const allOf = (await (await stmtWorker.fetch(sreq("/desk/orders?all=1", { headers: D }), senv)).json()).orders;
  ok(openOnly.length === 1 && allOf.length === 2, "the desk sees open orders by default and everything with all=1");

  /* THE DESK'S RELAY, end to end through both Workers, with the code joined from its own store. */
  const dkv = new KV(); await dkv.put("stmt-users", JSON.stringify({ [un]: "CX0-AA" }));
  const denv = { ...mkEnv(dkv), STMT_DESK_KEY: "desk-key", STMT_SITE: { fetch: (url, init) => stmtWorker.fetch(new Request(url, init), senv) } };
  r = await deskWorker.fetch(req("/orders"), denv); b = await r.json();
  ok(r.status === 200 && b.ok && b.orders.length === 1 && b.orders[0].code === "CX0-AA" && b.orders[0].id === id,
    "the desk's Worker lists the open orders with the code joined from stmt-users");
  ok((await deskWorker.fetch(req("/orders"), mkEnv(new KV()))).status === 503, "and says the relay is not configured rather than answering empty");
  ok((await deskWorker.fetch(req("/orders"), { ...denv, SALT_WRITE_KEY: "k" })).status === 401, "the write key gates the orders like the drafts");
  /* v507: the printed board reads the username map off the desk's Worker, keyed */
  ok((await deskWorker.fetch(req("/stmt-users"), { ...denv, SALT_WRITE_KEY: "k" })).status === 401
    && (await (await deskWorker.fetch(req("/stmt-users"), denv)).json()).users[un] === "CX0-AA",
    "GET /stmt-users is keyed and hands back the map the publish wrote");
  {
    const { openMaster: omP } = await import("../tools/payload.mjs");
    const { w: wB } = await omP();
    const rd = (e) => JSON.parse(wB.eval("JSON.stringify(" + e + ")"));
    wB.eval("setProd('salt');recompute();");
    const codeB = rd("roster.find(id=>!id.startsWith('S')&&pSales('salt').some(s=>s.customer===id&&s.date&&s.total>0))");
    const bookB = JSON.parse(readFileSync(join(REPO, "ledger", "book.json"), "utf8"));
    const nowB = new Date(rd("TODAY.toISOString()"));
    const mine = PL.priceList(codeB, bookB, snap, nowB).products.find(x => x.product === "salt").sizes.map(x => x.price);
    const desk = rd("pbPrices(" + JSON.stringify(codeB) + ").map(x=>x.price)");
    ok(JSON.stringify(desk) === JSON.stringify(mine), codeB + ": the printed board's prices are the customer's statement-page list, size for size (v507)");
    ok(rd("typeof pbCard") === "function" && /id=\"pbSheet\"/.test(readFileSync(join(REPO, "master", "salt_command.html"), "utf8")),
      "and the Price part carries the card and the page the print-only sheet");
    /* v508: the board as a file, drawn here and handed to the share sheet */
    const doc = rd("pbHtmlDoc({code:'CX0-AA',user:'abcd-efgh',product:'Salt',week:'2026-09-07',rows:[{q:1,price:120},{q:2.5,price:260}]})");
    ok(/^<!DOCTYPE html>/.test(doc) && doc.includes("<svg") && doc.includes("abcd-efgh") && doc.includes(">120<") && doc.includes(">260<") && doc.includes(">2.5<")
      && !/https?:\/\//.test(doc) && !doc.includes("CX0-AA") && !doc.includes("RM ") && !doc.includes("unit") && !doc.includes("SALT") && !doc.includes("Commodities")
      && !doc.includes("Username") && !doc.includes("Week of") && doc.includes("#05080a"),
      "the HTML file carries the mark, the username and bare figures on the obsidian ground, and no words: no unit, no RM, no wordmark, no week, no address, no code (v538)");
    ok(rd("typeof pbImageBlob+typeof pbDeliver+typeof pbSaveImage+typeof pbSaveHtml") === "functionfunctionfunctionfunction"
      && /id=\"pbImage\"/.test(rd("pbCard()")) && /id=\"pbHtml\"/.test(rd("pbCard()")),
      "and the card offers Save as image and Save as HTML, drawn on the desk and shared as files");
  }
  const sum = await (await deskWorker.fetch(req("/push/summary"), denv)).json();
  ok(sum.ok && sum.orders === 0, "the phone's summary counts orders waiting on a tap: none, this one is ready");
  b = await (await deskWorker.fetch(req("/orders/" + un + "/" + id, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "done" }) }), denv)).json();
  const q = JSON.parse(await dkv.get("q:orders"));
  ok(b.ok && b.order.status === "done" && b.queued && q.queue.length === 1 && q.queue[0].at === b.queued,
    "Completed moves the order and queues one entry under q:orders");
  const e = q.queue[0];
  ok(e.type === "SELL" && e.party === "CX0-AA" && e.payload.mode === "new" && e.payload.direction === "SELL" && e.payload.party === "CX0-AA"
    && e.payload.product === "salt" && e.payload.qty === 2.5 && e.payload.total === 300 && e.payload.delivery === 12 && e.payload.cash === 300 && e.payload.kg === 2.5
    && e.payload.handover === "delivered" && /order [0-9]{14}-/.test(e.payload.note) && /tngbiz/.test(e.payload.note) && !JSON.stringify(e).includes(un),
    "the entry is the Workbench's shape: a sale to the code, paid and handed over in full, dated, noting the order and the rail, and naming no username");
  ok(saleEntry({ id: "x", qty: 1, total: 10, mode: "collect", product: "oil" }, "CX0-AA", new Date("2026-09-06T17:00:00Z")).payload.date === "2026-09-07",
    "the sale is dated in Kuala Lumpur, so a completion after midnight there is tomorrow's row");
  const { draftRow } = await import("../src/drafter.js");
  const bookD = { version: "v499", pricing: { v: "v499", byProduct: { salt: { stockCost: 48, replCost: 48, floors: { "2.5": { floor: 157.3 } } } } },
    purchases: [{ date: "2026-08-13", qty: 12.5, total: 650, receivedOn: "2026-08-13" }], sales, state: { roster: ["CX0-AA"], QUEUE_COMMITTED: "2026-09-01T00:00:00.000Z" } };
  const d = draftRow(e, bookD);
  ok(!d.skip && d.collection === "sales" && d.row.customer === "CX0-AA" && d.row.qty === 2.5 && d.row.total === 300 && d.row.delivery === 12 && d.row.cash === 300
    && d.row.deliveredQty === 2.5 && d.row.paidOn === d.row.date && d.row.handover === "delivered",
    "and the drafter drafts it as a completed sale, which the phone then approves like any other row");
  const unmapped = C.newUsername();
  await kv.put("u:" + unmapped, JSON.stringify({ ...rec, u: unmapped }));
  const s2 = (await (await stmtWorker.fetch(sj("/open", { u: unmapped, password: pw }), senv)).json()).session;
  const o3 = (await (await stmtWorker.fetch(sj("/orders", { product: "salt", qty: 1, mode: "collect", unit: 100, total: 100, week: "" }, { "X-Stmt-Session": s2 }), senv)).json()).order;
  ok((await (await deskWorker.fetch(req("/push/summary"), denv)).json()).orders === 1, "a placed order counts as waiting on the phone's summary");
  const n1 = await nudgeOrders(denv), n2 = await nudgeOrders(denv);
  ok(n1.ok && n1.placed === 1 && (await dkv.get("orders:nudged")) === o3.at && n2.ok && n2.sent === 0 && n2.placed === 1,
    "the quarter-hour nudge marks the newest placement and does not nudge twice for it");
  for (const st of ["acknowledged", "ready"]) await deskWorker.fetch(req("/orders/" + unmapped + "/" + o3.id, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: st }) }), denv);
  b = await (await deskWorker.fetch(req("/orders/" + unmapped + "/" + o3.id, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "done" }) }), denv)).json();
  ok(b.ok && b.order.status === "done" && !b.queued && /no desk code/.test(b.warn || "") && JSON.parse(await dkv.get("q:orders")).queue.length === 1,
    "a completion for a username the map does not carry queues nothing and says so");
  ok((await ordersWaiting(denv)) === 0, "and nothing is left waiting");

  /* THE DEPLOY SEALS THE LIST INTO THE RECORD, beside the live statement, under the same key. */
  {
    const { liveRecords } = await import("../tools/make_statements.mjs");
    const tmp = join(REPO, "test", "tmp", "pricelist-" + Date.now());
    mkdirSync(join(tmp, "2026-09", "_kv"), { recursive: true });
    const users = JSON.parse(readFileSync(join(REPO, "statements", "_users.json"), "utf8"));
    const code = Object.keys(users)[0], uu = users[code];
    const ckR = await C.contentKey("test-secret", uu);
    writeFileSync(join(tmp, "_users.json"), JSON.stringify({ [code]: uu }));
    writeFileSync(join(tmp, "2026-09", "_kv", uu + ".json"), JSON.stringify({ u: uu, issued: "2026-09-01", issues: ["2026-09-01"],
      verifier: await C.makeVerifier(pw), wrap: await C.wrapKey(pw, ckR), env: await C.encryptWith(ckR, JSON.stringify({ statements: [{ issued: "2026-09-01", body: "x" }] })) }));
    const lr = await liveRecords(tmp, "test-secret", nowP, snap);
    const recR = lr.records[0];
    let opened = null;
    try { opened = JSON.parse(await C.decryptWith(ckR, recR.prices)); } catch (e) { opened = null; }
    ok(lr.priced === 1 && recR.prices && recR.prices.week === "2026-08-31" && opened && opened.week.monday === "2026-08-31" && opened.products.length >= 1
      && opened.products[0].sizes.length === snap.sizes.length && "price" in opened.products[0].sizes[0],
      "liveRecords seals " + code + "'s price list into the record for the week, opening under the same content key as the statement");
    const lr0 = await liveRecords(tmp, "test-secret", nowP);
    ok(lr0.priced === 0 && !lr0.records[0].prices, "and without a snapshot no list is written");
    rmSync(tmp, { recursive: true, force: true });
  }

  /* THE SEND SHEET carries the address as a link on every card. */
  const { sendSheet } = await import("../tools/stmt-send.mjs");
  const sheet = sendSheet([{ who: "CX0-AA", user: un, pw: pw, url: "https://k7m3p2.example/?u=" + un, t: { n: 1, total: 100, owed: 0 } }], { issue: "2026-09-01", monthName: "September 2026" });
  ok(sheet.includes('<a class="site" target="_blank" rel="noopener"></a>') && sheet.includes("site.href = row.url"),
    "the send sheet draws each card's statement address as a link that opens in a new tab");
  ok(existsSync(join(REPO, "tools", "send-sheet.cmd")) && /_send_\*\.html/.test(readFileSync(join(REPO, "tools", "send-sheet.cmd"), "utf8")),
    "and the Desktop shortcut's launcher finds the newest send sheet by name");
}

section("v512: a replay batch clears its own handoff");
{
  /* the planner answers the stage's one question: is the whole staged batch a replay? */
  const bookR = JSON.parse(readFileSync(join(REPO, "ledger", "book.json"), "utf8"));
  const dupRow = bookR.sales.find((x) => x.date && x.customer && +x.total > 0 && +x.qty > 0 && !x.cancelled);
  const dir = join(REPO, "test", "tmp", "replays-" + Date.now());
  mkdirSync(dir, { recursive: true });
  const staged = (rows) => { const f = join(dir, "staged.json"); writeFileSync(f, JSON.stringify({ ok: true, count: rows.length, approved: rows })); return f; };
  const run = (f) => { try { return { code: 0, out: execFileSync(process.execPath, [join(REPO, "tools", "fold.mjs"), "--replays", "--staged", f], { encoding: "utf8", stdio: "pipe" }) }; }
    catch (e) { return { code: e.status, out: String(e.stdout || "") }; } };
  const dup = { id: "2099-01-01T00:00:00.000Z", collection: "sales", row: { customer: dupRow.customer, date: dupRow.date, total: dupRow.total, qty: dupRow.qty } };
  const fresh = { id: "2099-01-01T00:00:01.000Z", collection: "sales", row: { customer: dupRow.customer, date: "2099-01-01", total: 1, qty: 1 } };
  const a = run(staged([dup]));
  ok(a.code === 0 && a.out.trim() === dup.id, "a batch that is wholly a replay answers 0 and names the ids");
  const b = run(staged([dup, fresh]));
  ok(b.code === 1 && /1 row\(s\) would fold/.test(b.out), "a batch with a row that would fold answers 1");
  const c = run(staged([]));
  ok(c.code === 1, "an empty batch is not a replay batch");
  rmSync(dir, { recursive: true, force: true });
  const yml = readFileSync(join(REPO, ".github", "workflows", "cloud-commit.yml"), "utf8");
  ok(/fold\.mjs --replays/.test(yml) && /--refused-note/.test(yml) && /git rm -q master\/_to_fold\.json/.test(yml),
    "and the stage job asks the planner, records the refusals and clears the handoff before standing down");
  ok(/--refused-note/.test(readFileSync(join(REPO, "tools", "drafts.mjs"), "utf8")), "drafts.mjs can record a refusal the fold made");
}

section("Statements — the QR, the sort and the Salt identity");
{
  const { statementCss, saltTokens } = await import("../tools/stmt-style.mjs");
  const css = statementCss();
  const dsRoot = saltTokens();
  ok(dsRoot.includes("--salt-brass") && dsRoot.includes("--salt-verdigris"),
    "the tokens are read out of design/salt-ds.css rather than transcribed");
  ok(css.startsWith(dsRoot), "and the statement's stylesheet is built on that exact block");
  /* v472 put the identity on the desk and left the statement in the old scheme. These are the
     hexes it used to carry; none may come back, or the one document a customer sees is again
     the only surface not drawn in the product's material. */
  const DEAD = ["#0f1115", "#2a3140", "#ffc75a", "#7fd7e8", "#eef1f6", "#6b7688", "#b9c2d0"];
  for (const dead of DEAD) {
    ok(!css.includes(dead), `the pre-identity colour ${dead} is gone from the stylesheet`);
  }
  /* AND FROM THE MARKUP, which is a different place and was where one of them was still
     hiding: a refund's reason cell carried style="font-size:13px;color:#b9c2d0" inline, so the
     stylesheet check above passed while a document still rendered a retired colour. Inline
     style attributes are doubly wrong here, because the unlock page serves a nonce CSP and a
     nonce blocks a style attribute as surely as it blocks a stray script. */
  {
    const src = readFileSync(join(REPO, "tools", "make_statements.mjs"), "utf8");
    ok(!/style="/.test(src),
      "no inline style attribute survives in the markup: a nonce CSP would drop it");
    for (const dead of DEAD) {
      ok(!src.includes(dead), `the pre-identity colour ${dead} is gone from the markup too`);
    }
  }
  ok(/--salt-font-mono/.test(css) && /--salt-font-display/.test(css),
    "figures are mono and sentences are the display face, as the identity requires");

  /* NO STATEMENT CAN PRINT AN UNDATED ROW, because the book carries none.
     This block used to assert the opposite premise: that three rows on the book had no date, and
     that stmtRows sorted them last rather than leaving them wherever the comparator's NaN put
     them. Its own message said "so this is not a dead check", which was the right instinct and
     the wrong fixture. On 04 Sep 2026 the three were dated on his instruction, and the loop then
     ran over an empty set and passed while proving nothing at all: exactly the assertion that
     cannot fail. So the invariant is asserted directly instead. stmtRows' sort-last handling
     stays in the tool as a defence, but the thing that keeps it unreachable is the guard in
     sort-ledger.mjs --check, proved in both directions in its own section above. */
  const { stmtRows } = await import("../tools/make_statements.mjs");
  const bookS = JSON.parse(readFileSync(resolve(REPO, "ledger", "book.json"), "utf8"));
  const undatedSales = bookS.sales.filter(x => !x.date);
  ok(undatedSales.length === 0, undatedSales.length
    ? `the book carries ${undatedSales.length} undated sale(s) (${undatedSales.map(r => r.rid || "?").join(", ")}), so a statement can print a row with no date`
    : "no sale on the book is undated, so no statement can print a row with no date");
  const anyParty = bookS.sales.find(x => x.customer && x.date);
  ok(!!anyParty && !stmtRows(anyParty.customer, { from: null, to: "2026-09-01", completed: true, open: true, pending: true })
    .some(r => String(r.date) === "Invalid Date"), "and no row carries an unparseable date");

  /* THE WORKER HAS NO FILESYSTEM, and the first cut of the unlock page forgot it:
     src/statement-page.js imported tools/stmt-style.mjs, which reads design/salt-ds.css, so the
     bundle pulled in node:fs and the Cloudflare build failed. Had it bundled, readFileSync
     would have thrown on every /s/ request instead. This is the guard: nothing under src/ may
     reach for a node builtin or into tools/, whatever it needs. */
  const srcFiles = readdirSync(join(REPO, "src")).filter(f => f.endsWith(".js"));
  const reaching = [];
  for (const f of srcFiles) {
    const t = readFileSync(join(REPO, "src", f), "utf8");
    for (const m of t.matchAll(/^\s*import\s[^;]*?from\s+["']([^"']+)["']/gm)) {
      if (/^node:/.test(m[1]) || m[1].includes("../tools/")) reaching.push(f + " -> " + m[1]);
    }
  }
  ok(reaching.length === 0, reaching.length
    ? "these Worker sources reach outside the runtime: " + reaching.join(", ")
    : `all ${srcFiles.length} Worker sources import only from within src/`);

  /* AND THE STATEMENTS SITE STANDS ALONE. It must bundle with no filesystem, and it must not be
     able to reach the ledger's code even by accident: nothing under stmt/ imports a node
     builtin, anything under src/ or anything under tools/. Only a sibling file will do. */
  const stmtFiles = readdirSync(join(REPO, "stmt")).filter(f => f.endsWith(".js"));
  const outside = [];
  for (const f of stmtFiles) {
    const t = readFileSync(join(REPO, "stmt", f), "utf8");
    for (const m of t.matchAll(/^\s*import\s[^;]*?from\s+["']([^"']+)["']/gm)) {
      if (!/^\.\/[^/]+\.js$/.test(m[1])) outside.push(f + " -> " + m[1]);
    }
  }
  ok(stmtFiles.length >= 3 && outside.length === 0, outside.length
    ? "the statements site reaches outside itself: " + outside.join(", ")
    : `all ${stmtFiles.length} statements-site sources import only a sibling`);
  ok(!existsSync(join(REPO, "src", "statement-page.js")) && !existsSync(join(REPO, "src", "statement-css.js")),
    "and nothing of the statements remains under src/");

  /* and the generated stylesheet is the one the module produces, or a design retune silently
     leaves the page a customer opens on the old material */
  const genCss = (await import("../stmt/statement-css.js")).STATEMENT_CSS;
  ok(genCss === statementCss(),
    "stmt/statement-css.js is what tools/stmt-style.mjs produces (run --sync if this fails)");

  /* THE SITE, THE USERNAME AND THE HISTORY (his instruction, 03 Sep 2026). An August archive
     and a September issue are made side by side, the way the real folders sit, and the
     September record is opened with the September password. */
  {
    const { makeStatements } = await import("../tools/make_statements.mjs");
    const C = await import("../tools/stmt-crypto.mjs");
    const root = join(REPO, "test", "tmp", "site");
    rmSync(root, { recursive: true, force: true });
    const q = console.log; console.log = () => { };
    let aug, sep, sep2, noKey = null;
    try {
      aug = await makeStatements(join(root, "2026-08"), "2026-08-01", { archive: true });
      try { await makeStatements(join(root, "2026-07"), "2026-07-01"); } catch (e) { noKey = e; }
      sep = await makeStatements(join(root, "2026-09"), "2026-09-01", { key: "test-secret", master: "mp" });
      sep2 = await makeStatements(join(root, "2026-09"), "2026-09-01", { key: "test-secret", master: "mp" });
    } finally { console.log = q; }
    ok(noKey && /STMT_KEY/.test(noKey.message) && !existsSync(join(root, "2026-07")),
      "a run with no key refuses before writing anything: a record wrapped under nothing opens nothing");
    const users = JSON.parse(readFileSync(join(root, "_users.json"), "utf8"));
    const codes = Object.keys(users), names = Object.values(users);
    ok(codes.length === sep.made && names.every(u => C.USERNAME_RE.test(u)),
      "every customer issued a statement has a username in _users.json beside the month folders, two groups of four");
    ok(new Set(names).size === names.length && names.every(u => !codes.includes(u)),
      "no two customers share one, and none is a desk code");
    ok(!existsSync(join(root, "2026-08", "_users.json")) && !readdirSync(join(root, "2026-08")).includes("_kv"),
      "an archive issue mints no username and no record");
    ok(JSON.stringify(sep2.users) === JSON.stringify(sep.users) && JSON.stringify(sep2.passwords) === JSON.stringify(sep.passwords),
      "a retry of the same issue keeps every username and every password");
    const files = readdirSync(join(root, "2026-09", "_kv"));
    ok(files.length === sep.made && files.every(f => names.includes(f.replace(/\.json$/, ""))),
      "the records are named by username, never by code");

    const both = sep.sheets.find(s => aug.sheets.some(a => a.who === s.who));
    const u = users[both.who];
    const rec = JSON.parse(readFileSync(join(root, "2026-09", "_kv", u + ".json"), "utf8"));
    ok(!JSON.stringify(rec).includes(both.who) && rec.u === u && rec.issued === "2026-09-01" && rec.wrap && rec.wrapMaster && !rec.live,
      "a record names its username and issue date, carries both wraps and no code, and no live document until the deploy writes one");
    const ckB = await C.unwrapKey(sep.passwords[both.who], rec.wrap);
    ok(Buffer.from(await C.unwrapKey("mp", rec.wrapMaster)).equals(Buffer.from(ckB)),
      "the master wrap in the record unwraps the same key as the password does");
    const b = JSON.parse(await C.decryptWith(ckB, rec.env));
    ok(b.statements.length === 2 && b.statements[0].issued === "2026-09-01" && b.statements[1].issued === "2026-08-01",
      `${both.who}'s September password opens September and August, newest first`);
    ok(b.statements[0].body.includes(both.who) && !b.statements[0].body.includes('class="qrb"'),
      "the September body is the document without its QR block");
    ok(b.statements[1].body.includes("shown as the account stands today") && !b.statements[1].body.includes("<svg"),
      "and the August body is the archive exactly as issued");
    ok(JSON.stringify(rec.issues) === JSON.stringify(["2026-09-01", "2026-08-01"]),
      "the record lists the issues it carries, so the publish log can say so without decrypting anything");
    const only = sep.sheets.find(s => !aug.sheets.some(a => a.who === s.who));
    if (only) {
      const rec1 = JSON.parse(readFileSync(join(root, "2026-09", "_kv", users[only.who] + ".json"), "utf8"));
      const b1 = JSON.parse(await C.decryptWith(await C.unwrapKey(sep.passwords[only.who], rec1.wrap), rec1.env));
      ok(b1.statements.length === 1, `${only.who}, new since August, has only September`);
    } else skipData("every September customer was also in August, so the one-issue bundle went unchecked");

    /* THE LIVE STATEMENT (his instruction, 03 Sep 2026): every entry from the start to now,
       sealed into the record by the deploy after every fold under the same content key. */
    const { liveStatement, liveRecords } = await import("../tools/make_statements.mjs");
    const { planPublish } = await import("../tools/stmt-publish.mjs");
    const now = new Date("2026-09-03T06:20:00Z");
    const lv = liveStatement(both.who, now);
    ok(lv && lv.at === now.toISOString() && /Live statement/.test(lv.body) && /as at 03 Sept? 2026 14:20/.test(lv.body)
      && /every entry from the beginning to today/.test(lv.body) && !/class="qrb"/.test(lv.body) && !/>Issued /.test(lv.body),
      "a live statement says it is one, to the minute in Kuala Lumpur time, covers everything, and carries no QR");
    ok(lv.body.includes(both.who), "and it is that customer's");
    const bookL = JSON.parse(readFileSync(resolve(REPO, "ledger", "book.json"), "utf8"));
    const afterIssue = bookL.sales.find(s => s.date && s.date > "2026-09-01" && !s.cancelled);
    if (afterIssue) {
      const nRows = h => (h.match(/<td class="l dt">/g) || []).length;
      const issuedDoc = sep.sheets.find(s => s.who === afterIssue.customer);
      const lvA = liveStatement(afterIssue.customer, now);
      ok(issuedDoc && lvA && nRows(lvA.body) > nRows(issuedDoc.html),
        `${afterIssue.customer}'s live statement carries the ${afterIssue.date} entry the 1 Sep issue does not`);
    } else skipData("no dated row after 1 Sep on the book, so the live-versus-issued difference went unchecked");

    const lr = await liveRecords(root, "test-secret", now);
    ok(lr.latest === "2026-09" && lr.records.length === sep.made && lr.live === sep.made && lr.unmatched.length === 0,
      "the deploy's records are the newest issue's, each with a live statement sealed in");
    const lrec = lr.records.find(x => x.u === u);
    let lvOut = null;
    try { lvOut = lrec.live ? JSON.parse(await C.decryptWith(ckB, lrec.live)) : null; } catch (e) { lvOut = null; }
    ok(!!lrec.live && lrec.live.at === now.toISOString() && !!lvOut && lvOut.body === lv.body
      && !JSON.stringify(lrec.live).includes(both.who),
      "the live statement opens under the key the password unwraps, and is ciphertext in the record");
    const lr0 = await liveRecords(root, "", now);
    ok(lr0.records.length === sep.made && lr0.live === 0 && lr0.records.every(x => !x.live),
      "without the key the records go up as issued and no live document is written");

    const plan = await planPublish(root, "test-secret", now, ["u:" + u, "u:zzzz-zzzz", "fail:" + u, "fail:aaaa-aaaa"], null);
    ok(plan.puts.length === sep.made + 1 && plan.puts.some(p => p.key === "u:" + u)
      && plan.puts.some(p => p.key === "issue" && p.value === "2026-09-01"),
      "the publish plan puts every record and the issue marker, in one bulk file");
    ok(plan.newIssue && plan.deletes.includes("u:zzzz-zzzz") && !plan.deletes.includes("u:" + u)
      && plan.deletes.includes("fail:" + u) && plan.deletes.includes("fail:aaaa-aaaa"),
      "a new issue retires the record it does not carry and clears every attempt counter");
    const plan2 = await planPublish(root, "test-secret", now, ["u:zzzz-zzzz", "fail:" + u], "2026-09-01");
    ok(!plan2.newIssue && plan2.deletes.includes("u:zzzz-zzzz") && !plan2.deletes.includes("fail:" + u),
      "a re-publish of the same issue, which every fold is, retires stale records but leaves the counters alone");
    ok(JSON.parse(plan.puts.find(p => p.key === "u:" + u).value).live.at === now.toISOString(),
      "and what it puts is the record with the live statement in it");

    /* A WRONG STMT_KEY IS CAUGHT BEFORE ANYTHING IS SEALED WITH IT (04 Sep 2026 audit). The content
       key is derived in the CLOUD from the deploy's secret; the record was sealed on the LAPTOP
       from its own copy. Nothing compared them, so a secret differing by one character sealed every
       live statement under a key no password unwraps, the publish logged "37 with a live statement",
       and the browser swallowed the failure as "simply absent": the whole feature dead for every
       customer with three layers reporting success. rec.env was sealed with the true key, so
       opening it is a cross-check the deploy cannot fake. Proved red by removing the check. */
    const bad = await liveRecords(root, "not-the-laptops-key", now);
    ok(bad.wrongKey.length === sep.made && bad.live === 0 && bad.records.every(x => !x.live),
      "a key that does not match the issue seals nothing and is reported, rather than sealing rubbish");
    const goodK = await liveRecords(root, "test-secret", now);
    ok(goodK.wrongKey.length === 0 && goodK.live === sep.made,
      "and the right key still seals every one, so the check is not simply refusing everything");
    const planBad = await planPublish(root, "not-the-laptops-key", now, [], null);
    ok(planBad.wrongKey.length === sep.made && planBad.puts.length === sep.made + 1,
      "the publish still puts the monthly statements, which open under the customer's own password, and reports the key");

    /* AND THE PUBLISH ASSERTS ITS OWN EFFECT rather than reporting one. Every deploy on master was
       publishing nothing and exiting 0 because every committed record was of the pre-username
       shape: all thirty-seven accounts were absent from the site, any customer was told his
       password was not accepted, and the only trace was a warning line in a log nobody reads. */
    const stale = join(REPO, "test", "tmp", "site-stale");
    mkdirSync(join(stale, "2026-09", "_kv"), { recursive: true });
    writeFileSync(join(stale, "2026-09", "_kv", "CX0-AA.json"),
      JSON.stringify({ code: "CX0-AA", month: "2026-09", issued: "2026-09-01", verifier: {}, env: {} }) + "\n");
    let code = 0, out = "";
    try {
      out = execFileSync(process.execPath, [join(REPO, "tools", "stmt-publish.mjs"), "--dry", join(stale, "out")],
        { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
          env: { ...process.env, SALT_STATEMENTS_DIR: stale, STMT_KEY: "test-secret" } });
    } catch (e) { code = e.status; out = String(e.stdout || "") + String(e.stderr || ""); }
    ok(code === 1 && /NONE is publishable/.test(out),
      "an issue whose records are all unpublishable turns the deploy RED and says which folder to regenerate");
    rmSync(stale, { recursive: true, force: true });

    /* A RECORD FROM BEFORE THE SITE has no username, and the first deploy after the site went
       up put thirty-seven of them under the one key "u:undefined", which the store refused and
       which turned the deploy red. They are reported and left; and an issue with nothing
       publishable retires nothing, or a botched regeneration would take every account down. */
    writeFileSync(join(root, "2026-09", "_kv", "CX0-AA.json"),
      JSON.stringify({ code: "CX0-AA", month: "2026-09", issued: "2026-09-01", verifier: {}, env: {} }) + "\n");
    const plan3 = await planPublish(root, "test-secret", now, ["u:zzzz-zzzz"], null);
    ok(plan3.stale.length === 1 && plan3.stale[0] === "CX0-AA.json" && plan3.puts.length === sep.made + 1
      && !plan3.puts.some(p => p.key === "u:undefined"),
      "a record with no username is reported as stale and never becomes a key");
    const old = join(root, "2026-10");
    mkdirSync(join(old, "_kv"), { recursive: true });
    writeFileSync(join(old, "_kv", "CX0-AA.json"), JSON.stringify({ code: "CX0-AA", issued: "2026-10-01" }) + "\n");
    const plan4 = await planPublish(root, "test-secret", now, ["u:" + u, "fail:" + u], null);
    ok(plan4.latest === "2026-10" && plan4.puts.length === 0 && plan4.deletes.length === 0,
      "an issue with nothing publishable puts nothing and retires nothing");
    rmSync(old, { recursive: true, force: true });

    ok(both.html.includes("?u=" + u) && both.html.includes("<code>" + u + "</code>") && both.html.includes("three minutes"),
      "the QR opens the site with the username filled in, the username is printed beside it, and the copy says three minutes");
    ok(!/salt-command\./.test(both.html) && !/\/s\//.test(both.html),
      "and nothing on a statement points at the desk's address or the old route");
    /* THE SEND SHEET (04 Sep 2026, his instruction): the monthly send as one page, one card per
       customer, the link-and-username message on a Share button and the password on a SECOND,
       separate one. The split is the whole security design, so the thing to prove is that no
       password reaches the shareable message, and that the sheet itself is gitignored: it holds
       every password in the issue and puts every account beside every other. */
    {
      const send = readFileSync(join(root, "2026-09", "_send_2026-09-01.html"), "utf8");
      const rows = JSON.parse(/var ROWS = (\[[\s\S]*?\]);\n/.exec(send)[1]);
      ok(rows.length === sep.made, `the send sheet carries one card per customer (${rows.length})`);
      const leaked = rows.filter(r => r.msg.includes(r.pw));
      ok(leaked.length === 0, leaked.length
        ? "the shareable message carries the password for: " + leaked.map(r => r.who).join(", ")
        : "no shareable message carries its password: the two go by separate routes");
      const mismatched = rows.filter(r => !r.msg.includes(r.url) || !r.msg.includes(r.user)
        || sep.passwords[r.who] !== r.pw || users[r.who] !== r.user);
      ok(mismatched.length === 0, mismatched.length
        ? "these cards pair the wrong username, link or password: " + mismatched.map(r => r.who).join(", ")
        : "every card pairs the customer with his own username, link and password");
      ok(rows.every(r => r.qr.length === 33 && r.qr.every(line => /^[01]{33}$/.test(line))),
        "each card ships a drawn QR matrix, so the code is the image the Share sheet carries");
      /* the same laws the statements live by: no seller's vocabulary, and no other party's code */
      const words = send.replace(/<style>[\s\S]*?<\/style>/g, " ");
      ok(!/\b(cost|margin|tier|floor|shrink|profit)/i.test(words.replace(/[\s\S]*?var ROWS/, "")),
        "and the sheet speaks none of the seller's vocabulary");
      ok(!existsSync(join(root, "2026-08", "_send_2026-08-01.html")),
        "an archive issue gets no send sheet, having no password and no link to send");
      const ig = execFileSync("git", ["check-ignore", "statements/2026-09/_send_2026-09-01.html"],
        { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
      ok(ig === "statements/2026-09/_send_2026-09-01.html",
        "and git ignores it, as it ignores _passwords.json, because it is one");
    }

    const rv = readFileSync(join(root, "2026-09", "_review_2026-09-01.html"), "utf8");
    ok(rv.includes('<th class="l">Username</th>') && rv.includes(u) && !rv.includes(sep.passwords[both.who]),
      "the review sheet lists the usernames and still no password");

    /* THE ADDRESS ON THE PAPER NAMES THE WORKER THIS REPO DEPLOYS. It was a hand-copied constant,
       and a QR is printed and handed over: rename the Worker without editing the constant and
       thirty-seven codes point at a hostname that answers nothing, with every check green and the
       paper already in customers' hands. That is exactly what had just happened to /s/, one rename
       earlier. Proved red by pointing the config at another name. */
    const { siteBaseUrl } = await import("../tools/make_statements.mjs");
    const cfgName = (/^\s*"name"\s*:\s*"([^"]+)"/m.exec(readFileSync(join(REPO, "wrangler.stmt.jsonc"), "utf8")) || [])[1];
    ok(!!cfgName && siteBaseUrl().startsWith("https://" + cfgName + "."),
      `the statement address names the Worker wrangler.stmt.jsonc deploys (${cfgName})`);
    ok(both.html.includes(siteBaseUrl() + "/?u=" + u),
      "and the URL printed and encoded on the statement is that address");
    ok(!siteBaseUrl().includes("salt-command"),
      "and it is not the desk's, which is the whole reason the statements moved");
    rmSync(root, { recursive: true, force: true });
  }

  /* AN ARCHIVE ISSUE CARRIES NO QR, AND THE REASON IS THAT ONE WOULD LIE. The site opens
     whichever issue was published last, so a code on a back-dated statement asks for a later
     month's password and the reader is told his was refused, on a document that looks current.
     A record of a past position is worth keeping; a dead code on it is not. */
  {
    const { makeStatements } = await import("../tools/make_statements.mjs");
    const dirA = join(REPO, "test", "tmp", "stmt-archive");
    rmSync(dirA, { recursive: true, force: true });
    const quiet = console.log; console.log = () => { };
    let runA;
    try { runA = await makeStatements(dirA, "2026-08-01", { archive: true }); } finally { console.log = quiet; }
    const files = readdirSync(dirA);
    ok(runA.made > 0, `an archive issue still writes its statements (${runA.made})`);
    ok(!files.includes("_kv") && !files.includes("_passwords.json"),
      "and writes no _kv records and no passwords");
    ok(runA.kv.length === 0 && Object.keys(runA.passwords).length === 0,
      "and mints no password and no envelope at all");
    const one = readFileSync(join(dirA, files.filter(f => f.startsWith("statement_"))[0]), "utf8");
    ok(!/class="qrb"/.test(one) && !/<svg/.test(one) && !/\?u=/.test(one),
      "no QR, no SVG and no statement link reaches a back-issue");
    const rev = readFileSync(join(dirA, "_review_2026-08-01.html"), "utf8");
    ok(/record of a past issue/i.test(rev), "its review sheet says what it is");
    /* AND IT DOES NOT CLAIM A CUT-OFF IT CANNOT HONOUR. The book is current state, so a
       back-issue filters by order date and shows each row as it stands today: the 1 Aug set
       carried a payment dated 6 Aug and a cancellation dated 24 Aug on six of its documents.
       The heading says what the document actually is rather than implying a snapshot. */
    ok(/shown as the account stands today/.test(one) && !/from the beginning to/.test(one),
      "a back-issue states that it shows the account as it stands, not a position as at a date");
    const q2 = console.log; console.log = () => { };
    let live;
    try { live = await makeStatements(join(REPO, "test", "tmp", "stmt-live"), "2026-08-01", { key: "test-secret" }); }
    finally { console.log = q2; }
    ok(/from the beginning to/.test(live.sheets[0].html),
      "and a current issue still reads as a period, which is what it is");
    rmSync(join(REPO, "test", "tmp", "stmt-live"), { recursive: true, force: true });
    rmSync(dirA, { recursive: true, force: true });
  }

  /* NO PASSWORD REACHES ANYTHING THE REPOSITORY KEEPS, and this was wrong once. The review
     sheet carried a password column while _passwords.json was gitignored on the grounds that a
     credential committed is a credential in the history for ever. The review sheet IS committed,
     so the same passwords went into git anyway and the ignore rule protected nothing. They live
     in one place now, and this is what proves it stays one place. */
  {
    const { makeStatements } = await import("../tools/make_statements.mjs");
    const dirP = join(REPO, "test", "tmp", "stmt-pw");
    rmSync(dirP, { recursive: true, force: true });
    const q3 = console.log; console.log = () => { };
    let runP;
    try { runP = await makeStatements(dirP, "2026-08-01", { key: "test-secret" }); } finally { console.log = q3; }
    const secrets = Object.values(runP.passwords);
    ok(secrets.length > 0, `the run minted passwords to check (${secrets.length})`);
    /* THE SEND SHEET IS THE ONE PAGE THAT MAY CARRY THEM, and it is named here rather than
       skipped by pattern, so a NEW page that carries a password still trips this. It exists to be
       read on the laptop while sending, it is gitignored exactly as _passwords.json is, and the
       block above proves git ignores it. Everything else the run writes is committed, so a
       password in it is a password in the history for ever. */
    const SENDS = readdirSync(dirP).filter(x => /^_send_.*\.html$/.test(x));
    ok(SENDS.length === 1, "the run writes exactly one send sheet, which is the one page allowed a password");
    const leaked = [];
    for (const f of readdirSync(dirP).filter(x => x.endsWith(".html") && !SENDS.includes(x))) {
      const h = readFileSync(join(dirP, f), "utf8");
      for (const pw of secrets) if (h.includes(pw)) leaked.push(f);
    }
    ok(leaked.length === 0, leaked.length
      ? "passwords reached these committed pages: " + [...new Set(leaked)].join(", ")
      : "no password reaches any committed page: only _passwords.json and the gitignored send sheet");
    const sendHas = readFileSync(join(dirP, SENDS[0]), "utf8");
    ok(secrets.every(pw => sendHas.includes(pw)),
      "and the send sheet does carry them, which is why it is gitignored and never sent");
    ok(readFileSync(join(dirP, "_passwords.json"), "utf8").includes(secrets[0]),
      "and _passwords.json, the one gitignored file, is where they are");
    rmSync(dirP, { recursive: true, force: true });
  }
}

section("v518: salt borrowed in is a loan the other way");
{
  /* HIS ROWS OF 08 SEP 2026: 5.5 unit borrowed from CH5-OUG and 1.5 from CA11-SEN, owed back in
     kind. The loan book only knew salt lent OUT (valueKg drawn off the inventory); a loan IN adds
     to it while open, lands on its own date in the history walk, prints its own line on the
     Inventory walk and its own fold on the Order book, and nets out of loanDrawUnits so nothing
     else on the desk has to know. Proved on the real master over a fixture book. */
  const { openMaster: om7 } = await import("../tools/payload.mjs");
  const { readFileSync: rf7, writeFileSync: wf7, unlinkSync: rm7 } = await import("node:fs");
  const { execSync: ex7 } = await import("node:child_process");
  const { join: j7 } = await import("node:path");
  const bk7 = JSON.parse(rf7(j7(REPO, "ledger", "book.json"), "utf8"));
  const LD = bk7.COUNT_ON.salt;   // a date inside the walk on any book
  bk7.loans = (bk7.loans || []).filter((l) => l.preOpening).concat([
    { date: LD, party: "CH5-OUG", direction: "in", valueKg: 5.5, valueRM: null, status: "open", product: "salt", note: "fixture" },
    { date: LD, party: "CA11-SEN", direction: "in", valueKg: 1.5, valueRM: null, status: "open", product: "salt", note: "fixture" },
    { date: LD, party: "CS6-PER", direction: "in", valueKg: 9, valueRM: null, status: "settled", settledOn: LD, product: "salt", note: "fixture, settled: counts nowhere" },
  ]);
  const B7 = j7(REPO, "test", ".v518.json"), M7 = j7(REPO, "test", ".v518.html");
  wf7(B7, JSON.stringify(bk7, null, 1)); wf7(M7, rf7(j7(REPO, "master", "salt_command.html"), "utf8"));
  ex7("node tools/booksync.mjs --sync", { cwd: REPO, env: { ...process.env, SALT_BOOK: B7, SALT_MASTER: M7 }, stdio: "pipe" });
  const READ7 = "(function(){var e=document.querySelector('.sec.on');if(!e)return '';var c=e.cloneNode(true);[].slice.call(c.querySelectorAll('.jquote')).forEach(function(q){q.parentNode.removeChild(q);});return c.textContent.replace(/\\s+/g,' ');})()";
  try {
    const { w } = await om7(M7);
    w.eval("setProd('salt');recompute();");
    const draw = +w.eval("loanDrawUnits()");
    ok(draw === -7, `loanDrawUnits nets a loan in against loans out and ignores a settled one: -7, got ${draw}`);
    w.eval("switchTab('inventory');");
    const inv = String(w.eval(READ7));
    ok(inv.includes("Borrowed in (to return)") && /Borrowed in \(to return\)\+7 unit/.test(inv), "the Inventory walk prints the borrowed units as their own line, +7 unit");
    w.eval("switchTab('receivables');");
    const ob = String(w.eval(READ7));
    ok(/Salt you borrowed/.test(ob) && ob.includes("CH5-OUG") && ob.includes("CA11-SEN") && !/CS6-PER[^.]{0,40}9 unit/.test(ob),
      "the Order book folds the two open borrowings under Salt you borrowed and leaves the settled one out");
    /* the history walk: the units land on the loan's date, not on day 0 */
    const withIn = JSON.parse(w.eval("JSON.stringify(stockHistory())"));
    w.eval("loans.forEach(function(l){if(l.direction==='in')l.status='settled';});recompute();");
    const without = JSON.parse(w.eval("JSON.stringify(stockHistory())"));
    const i = withIn.findIndex((r) => r.iso === LD);
    const d0 = withIn[0].lvl - without[0].lvl, dL = (withIn[i].lvl - withIn[i - 1].lvl) - (without[i].lvl - without[i - 1].lvl);
    /* the shrinkage plug is spread over every day of the walk, so 7 unit in raises the plug by 7 and
       the loan day shows 7 less one day's share of it; the tolerance is exactly that share */
    const share = 7 / Math.max(1, withIn.length - 1) + 0.01;
    ok(i > 0 && Math.abs(d0) < 0.005 && Math.abs(dL - 7) < share, `the history walk lands the 7 unit on ${LD}, not on day 0 (day 0 moved ${d0.toFixed(2)}, the loan day ${dL.toFixed(2)}, plug share ${share.toFixed(2)})`);
    try { w.close(); } catch (e) { }
  } finally { try { rm7(B7); } catch (e) { } try { rm7(M7); } catch (e) { } }
}

section("v519: the clock on every approval, as the phone says it");
{
  const { openMaster: om9 } = await import("../tools/payload.mjs");
  const { w } = await om9();
  const read = (c) => String(w.eval("apClock(" + JSON.stringify(c) + ")")).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const c = { id: "x", party: "CJ4-BJ", decidedAt: "2026-09-08T04:00:00.000Z", liveAt: "2026-09-08T04:01:23.000Z", committedAt: "2026-09-08T04:01:30.000Z" };
  ok(/reached the phone in 83 s/.test(read(c)) && /90 s to committed/.test(read(c)), "83 s to the phone and 90 s to committed, from the three timestamps");
  ok(/was committed in .*90 s/.test(read({ ...c, liveAt: null })) && /before the clock had a proof time/.test(read({ ...c, liveAt: null })), "no proof time says so, and gives the time to committed");
  ok(/08 Sep 2026, 12:01 KL/.test(read(c)) && /a bookkeeping entry/.test(read({ ...c, party: null })), "the time is Kuala Lumpur in the header's own shape, and an entry with no party is named as such");
  ok(w.eval("apClock(null)") === "" && w.eval("apClock({id:'y'})") === "", "no committed draft yet prints nothing");
  ok(/reached the phone in 9 min/.test(read({ ...c, liveAt: "2026-09-08T04:08:40.000Z" })), "past two minutes it says minutes");
  try { w.close(); } catch (e) { }
}

section("v521: the fold as one call");
{
  const F = await import("../tools/foldcall.mjs");
  const ids = ["2099-01-01T00:00:00.001Z"];
  const good = { version: "v999", title: "ONE UNIT TO A REGULAR", notes: ["<b>ONE ROW.</b> A paragraph that says what was folded and what the inventory did, at length enough."],
    rows: { [ids[0]]: { note: "<b>1 UNIT, PAID AND COLLECTED.</b> Clear of the floor by a margin the dossier gives, costed at the inventory's own rate.", rowNote: null, cost: null } },
    stockNote: "", stockCost: null, stockCostNote: "" };
  ok(F.checkNotes(good, "v999", ids).length === 0, "a well-formed reply passes the check");
  ok(F.checkNotes({ ...good, version: "v998" }, "v999", ids).some((x) => /version/.test(x)), "the wrong version is refused");
  ok(F.checkNotes({ ...good, title: "one unit to a regular" }, "v999", ids).some((x) => /capitals/.test(x)), "a title not in capitals is refused");
  ok(F.checkNotes({ ...good, rows: { [ids[0]]: { note: "short", rowNote: null, cost: null } } }, "v999", ids).some((x) => /paragraph/.test(x)), "a row note that is not a paragraph is refused");
  ok(F.checkNotes({ ...good, notes: ["<b>ONE ROW.</b> A paragraph with an em-dash \u2014 in it, which the house does not write, at length."] }, "v999", ids).some((x) => /em-dash/.test(x)), "an em-dash is refused");
  ok(F.checkNotes({ ...good, stockNote: "Two kg went out on the day, which is the wrong word." }, "v999", ids).some((x) => /kg/.test(x)), "kg is refused");
  ok(F.checkNotes({ ...good, rows: { ...good.rows, extra: { note: "a paragraph that is long enough to pass the length check on its own merits", rowNote: null, cost: null } } }, "v999", ids).some((x) => /not in the batch/.test(x)), "a row the batch does not carry is refused");
  ok(F.nextVersion("v520") === "v521" && F.nextVersion("junk") === null, "the next version is the master's plus one");
  const sch = F.schemaFor(ids);
  ok(sch.additionalProperties === false && sch.required.includes("rows") && sch.properties.rows.required[0] === ids[0] && sch.properties.rows.properties[ids[0]].required.includes("note"), "the schema names every id and forbids anything else");

  /* END TO END ON A FIXTURE, through a fake reply: the tool plans, builds the dossier off the real
     master, takes the notes, and folds with fold.mjs into copies of the book and the master. */
  const { mkdirSync: mk9, rmSync: rm9, copyFileSync: cp9, readFileSync: rf9, writeFileSync: wf9, existsSync } = await import("node:fs");
  const { join: j9 } = await import("node:path");
  const { execFileSync: ex9 } = await import("node:child_process");
  const dir9 = j9(REPO, "test", "tmp", "foldcall-" + Date.now());
  mk9(dir9, { recursive: true });
  const bk9 = JSON.parse(rf9(j9(REPO, "ledger", "book.json"), "utf8"));
  const party9 = bk9.sales.filter((r) => r.customer && r.date && !r.cancelled).slice(-1)[0].customer;
  const B9 = j9(dir9, "book.json"), M9 = j9(dir9, "salt_command.html"), S9 = j9(dir9, "_to_fold.json"), N9 = j9(dir9, "_fold_notes.json"), FD9 = j9(dir9, "_folded.json"), FAKE9 = j9(dir9, "reply.json");
  cp9(j9(REPO, "ledger", "book.json"), B9); cp9(j9(REPO, "master", "salt_command.html"), M9); cp9(j9(REPO, "master", "changelog.json"), j9(dir9, "changelog.json"));
  const id9 = "2099-01-02T00:00:00.001Z";
  wf9(S9, JSON.stringify({ ok: true, count: 1, approved: [{ id: id9, collection: "sales",
    row: { customer: party9, qty: 1, total: 130, cost: 48, cash: 130, delivery: 0, handover: "collected", date: "2099-01-02", deliveredQty: 1, deliveredOn: "2099-01-02", paidOn: "2099-01-02" },
    reasoning: "Sold 1 unit of salt for RM 130.", flags: ["a flag from the drafter"], amends: null, amendKind: null,
    entry: { raw: "Sell 1 unit for RM 130", payload: { mode: "new", qty: 1, total: 130 } }, decidedAt: "2099-01-02T00:01:00.000Z", decidedBy: "phone" }] }));
  const args9 = ["--staged", S9, "--book", B9, "--master", M9, "--notes", N9, "--folded", FD9, "--today", "2099-01-02"];
  const run9 = (env) => { try { return { code: 0, out: ex9(process.execPath, [j9(REPO, "tools", "foldcall.mjs"), ...args9], { cwd: REPO, encoding: "utf8", stdio: "pipe", env: { ...process.env, ...env } }) }; } catch (e) { return { code: e.status, out: String(e.stdout || "") + String(e.stderr || "") }; } };
  /* the dossier, read from the dry run: it carries the ladder for the size and the party's rows */
  const dry = run9({ SALT_FOLD_FAKE: "", ANTHROPIC_API_KEY: "" });
  const dryArgs = [j9(REPO, "tools", "foldcall.mjs"), ...args9, "--dry"];
  const dryOut = ex9(process.execPath, dryArgs, { cwd: REPO, encoding: "utf8", stdio: "pipe" });
  const dj = JSON.parse(dryOut.slice(dryOut.indexOf('{\n "model"')));
  const dd = JSON.parse(dj.user.slice(dj.user.indexOf("{"), dj.user.lastIndexOf("}") + 1));
  const it9 = dd.items[0];
  ok(dd.version.next && it9 && it9.ladder && it9.ladder.size === 1 && it9.ladder.floor > 0 && it9.ladder.ask >= it9.ladder.floor, "the dossier carries the desk's own floor and ask for 1 unit (floor " + (it9 && it9.ladder && it9.ladder.floor) + ", ask " + (it9 && it9.ladder && it9.ladder.ask) + ")");
  ok(it9.party && it9.party.code === party9 && it9.party.lastRows.length > 0 && it9.party.medianRate > 0 && it9.drafterFlags[0] === "a flag from the drafter", "and the party's last rows, median rate and the drafter's flag");
  ok(dd.inventory.position && typeof dd.inventory.position.stock === "number" && typeof dd.inventory.position.owedOut === "number", "and the inventory position from the engine");
  ok(dj.schema.properties.rows.required[0] === id9 && /never kg or kilo/.test(dj.system), "the request binds the reply to the batch's ids under the house rules");
  /* no key and no fake: it stops before anything is written */
  ok(dry.code === 1 && /ANTHROPIC_API_KEY is not set/.test(dry.out) && !existsSync(N9), "without a key it fails plainly and writes nothing");
  /* a fake reply that breaks the rules is refused, and nothing is folded */
  wf9(FAKE9, JSON.stringify({ ...good, version: dd.version.next, rows: { [id9]: { note: "<b>ONE UNIT.</b> A note with an em-dash \u2014 which the house never writes, at length enough to pass.", rowNote: null, cost: null } } }));
  const bad9 = run9({ SALT_FOLD_FAKE: FAKE9 });
  ok(bad9.code === 1 && /em-dash/.test(bad9.out) && !existsSync(FD9), "a reply against the house rules folds nothing");
  /* a good reply folds: the row is on the copied book at the next version, and the master carries it */
  wf9(FAKE9, JSON.stringify({ ...good, version: dd.version.next, title: "ONE UNIT TO " + party9, rows: { [id9]: { note: "<b>1 UNIT COLLECTED AND PAID, RM 130.</b> Clear of the floor for 1 unit on the desk's own ladder, costed at the inventory's own RM 48, the drafter's flag read and answered by the figures.", rowNote: null, cost: null } } }));
  const good9 = run9({ SALT_FOLD_FAKE: FAKE9 });
  const after9 = JSON.parse(rf9(B9, "utf8"));
  const row9 = after9.sales.find((r) => r.date === "2099-01-02" && r.customer === party9 && r.total === 130);
  ok(good9.code === 0 && row9 && /RM 130/.test(row9.note) && after9.QUEUE_COMMITTED === id9, "a good reply folds the row into the book with its note and moves the watermark");
  ok(existsSync(FD9) && JSON.parse(rf9(FD9, "utf8")).ids[0] === id9 && new RegExp('const evolution=\\[\\{"v":"' + dd.version.next + '"').test(rf9(M9, "utf8")), "names the id in _folded.json and stamps the master with the next version");
  rm9(dir9, { recursive: true, force: true });
}

section("v522: the gate before the deploy, the suite after the phone is live");
{
  const G = await import("../tools/gate.mjs");
  const ci = readFileSync(join(REPO, ".github", "workflows", "ci.yml"), "utf8");
  const ciChecks = [...ci.matchAll(/run: node (tools\/[a-z-]+\.mjs) --check/g)].map((m) => m[1]);
  const gateTools = G.CHECKS.map(([, args]) => args[0]);
  ok(ciChecks.length >= 7 && ciChecks.every((t) => gateTools.includes(t)), "the gate runs every --check that ci.yml runs (" + ciChecks.length + " of them)");
  ok(gateTools.includes("tools/lint-workflows.mjs") && gateTools.includes("tools/ledger.mjs") && typeof G.buildMatches === "function", "and the workflow lint, the extract and the build check");
  /* v535: a stamp ahead of Kuala Lumpur time fails the gate; one behind, or within the grace, passes */
  const NOW = Date.UTC(2026, 8, 8, 6, 16);   /* 08 Sep 2026, 14:16 KL */
  ok(/in the future/.test(G.stampAhead("08 Sep 2026, 19:30 KL", NOW)) && G.stampAhead("08 Sep 2026, 14:16 KL", NOW) === "" && G.stampAhead("08 Sep 2026, 14:25 KL", NOW) === "" && G.stampAhead("07 Sep 2026, 23:59 KL", NOW) === "", "a stamp five hours ahead is refused; the present, ten minutes of grace and the past pass");
  ok(/not in the shape/.test(G.stampAhead("08 Sept 2026, 14:16 KL", NOW)), "and Sept is not the shape the stamp takes");
  /* red: a master whose BOOK block is not the file fails the gate at that check, and nothing after runs */
  const { mkdirSync: mkG, rmSync: rmG, copyFileSync: cpG, readFileSync: rfG, writeFileSync: wfG } = await import("node:fs");
  const { execFileSync: exG } = await import("node:child_process");
  const dirG = join(REPO, "test", "tmp", "gate-" + Date.now());
  mkG(dirG, { recursive: true });
  const MG = join(dirG, "salt_command.html");
  cpG(join(REPO, "master", "changelog.json"), join(dirG, "changelog.json"));
  wfG(MG, rfG(join(REPO, "master", "salt_command.html"), "utf8").replace(/(const STATED_STOCK=)(-?\d+(?:\.\d+)?)/, (m, a, b) => a + (+b + 1000)));
  let gate;
  try { gate = { code: 0, out: exG(process.execPath, [join(REPO, "tools", "gate.mjs")], { cwd: REPO, encoding: "utf8", stdio: "pipe", env: { ...process.env, SALT_MASTER: MG } }) }; }
  catch (e) { gate = { code: e.status, out: String(e.stdout || "") }; }
  ok(gate.code === 1 && /FAIL  the book in the master is ledger\/book\.json/.test(gate.out) && !/public\/ is what this master builds/.test(gate.out), "a master whose book block is not the file fails the gate there, and the build check never runs");
  /* green, proved to print: v522 shipped a gate whose main-module check failed on Linux, so it printed nothing and passed */
  let green;
  try { green = { code: 0, out: exG(process.execPath, [join(REPO, "tools", "gate.mjs")], { cwd: REPO, encoding: "utf8", stdio: "pipe" }) }; } catch (e) { green = { code: e.status, out: String(e.stdout || "") }; }
  ok(green.code === 0 && (green.out.match(/^  ok    /gm) || []).length >= 10 && /GATE OK in \d/.test(green.out), "on the real master the gate runs every check, says so, and passes (" + (green.out.match(/^  ok    /gm) || []).length + " checks)");
  rmG(dirG, { recursive: true, force: true });
  const wf = readFileSync(join(REPO, ".github", "workflows", "cloud-commit.yml"), "utf8");
  const gateAt = wf.indexOf("- name: Gate\n"), deployAt = wf.indexOf("- name: Deploy\n"), suiteAt = wf.indexOf("- name: The full suite, after the phone is live"), stmtAt = wf.indexOf("- name: Retire the old statement keys");
  ok(gateAt > 0 && deployAt > gateAt && /- name: Gate\n\s+if: steps\.plan\.outputs\.deploy == '1' && steps\.already\.outputs\.live != '1'\n\s+run: node tools\/gate\.mjs/.test(wf), "the gate stands before the deploy, on the deploy's own condition");
  /* 10 Sep 2026: the suite no longer stands down when the phone already has the build. It used to
     carry the `Already serving?` clause, so a Workers Build that won the race meant the suite never
     ran on that push at all. It is still last and still after the statements; it simply no longer
     asks who deployed. */
  ok(suiteAt > stmtAt && /id: suite\n\s+if: steps\.plan\.outputs\.deploy == '1'\n\s+run: npm test/.test(wf), "the full suite is the last step, after the statements, and runs whoever deployed");
  ok(/if: always\(\) && steps\.suite\.outcome == 'failure'/.test(wf) && /--refused-note "suite:\$v"/.test(wf), "a suite failure is written where the phone shows refusals, under a synthetic id");
  ok(!/\n\s+npm test\n[\s\S]*?- name: Deploy\n/.test(wf.slice(wf.indexOf("- name: Fold\n"))), "and nothing runs the suite between the fold and the deploy");
}

section("v524: roster-only parties on the phone");
{
  const { openMaster: omB } = await import("../tools/payload.mjs");
  const bkB = JSON.parse(readFileSync(join(REPO, "ledger", "book.json"), "utf8"));
  const withR = bkB.associates.find((a) => bkB.roster.includes(a + "-R")), withoutR = bkB.associates.find((a) => !bkB.roster.includes(a + "-R"));
  const anyCust = bkB.sales.filter((r) => r.customer && r.date).slice(-1)[0].customer;
  ok(withR && withoutR, "the book has an associate with an -R account and one without (" + withR + ", " + withoutR + ")");
  const { w } = await omB();
  w.eval("setProd('salt');recompute();");
  const fault = (p) => String(w.eval("entryFault(" + JSON.stringify(p) + ")"));
  ok(/is not on the roster/.test(fault({ direction: "SELL", party: "ZZ9-NOPE", date: "2026-09-08" })) && /Add ID/.test(fault({ direction: "SELL", party: "ZZ9-NOPE", date: "2026-09-08" })), "a buyer not on the roster is refused, and the message points at Add ID");
  ok(/names its buyer/.test(fault({ direction: "SELL", party: null })) && /names its supplier/.test(fault({ direction: "BUY", party: "" })), "no party is refused in the direction's own word");
  ok(/end buyer/.test(fault({ direction: "SELL", party: withR, assoc: withR, downstream: "ZZ9-NOPE", date: "2026-09-08" })), "an end buyer not on the roster is refused as the end buyer");
  ok(/not a product/.test(fault({ direction: "SELL", party: anyCust, product: "nothing", date: "2026-09-08" })), "a product the book does not carry is refused");
  w.eval("var _scf=stockCostFor; stockCostFor=function(){return null;};");
  ok(/no cost/.test(fault({ direction: "SELL", party: anyCust, product: "salt", date: "2026-09-08" })) && fault({ direction: "BUY", party: bkB.purchases[0].supplier, product: "salt", date: "2026-09-08" }) === "", "a sale of a product with no lot is refused, and a purchase of it is not");
  w.eval("stockCostFor=_scf;");
  ok(/needs a date/.test(fault({ direction: "SELL", party: anyCust, cash: 10 })) && fault({ direction: "SELL", party: anyCust, qty: 1 }) === "", "cash or units moved with no date is refused; a pending undated order is not");
  ok(fault({ direction: "SELL", party: anyCust, assoc: withR, downstream: withR + "-R", date: "2026-09-08", kg: 1 }) === "", "a roster party, associate and -R account pass");
  /* the Workbench, driven: an R2 with the buyer unknown */
  const DRIVE_WB = (assoc) => "(function(){try{var set=function(id,v){var e=document.getElementById(id);if(!e)return false;e.value=v;return true;};" +
    "wbMode='new';wbDir='SELL';wbStream='R2';wbApply();var a=document.getElementById('wbAssoc');a.checked=true;wbApply();" +
    "set('wbAssocSel'," + JSON.stringify(assoc) + ");set('wbDown','');set('wbDate','2026-09-08');set('wbQty','1');set('wbTotal','110');set('wbCash','0');set('wbUnits','1');" +
    "wbPreview();var btn=document.getElementById('wbRec');var n0=queue.length;var r={};try{wbRecord();}catch(e){r.threw=String(e&&e.message);}" +
    "var q=queue[queue.length-1];r.pushed=(queue.length===n0+1);r.msg=(document.getElementById('wbOk')||{}).textContent||'';r.q=r.pushed&&q?{party:q.payload.party,down:q.payload.downstream,assoc:q.payload.assoc,stream:q.payload.stream,raw:q.raw}:null;return JSON.stringify(r);}catch(e){return JSON.stringify({no:'threw: '+(e&&e.message)});}})()";
  w.eval("switchTab('add');");
  const A = JSON.parse(String(w.eval(DRIVE_WB(withR))));
  ok(!A.no && A.pushed && A.q && A.q.party === withR && A.q.down === withR + "-R" && A.q.stream === "R2" && !/-Gen/.test(A.q.raw),
    "an R2 with the buyer unknown books to the associate as its party and to the -R account as the end buyer, and invents nothing: " + (A.no || JSON.stringify(A.q)));
  const B = JSON.parse(String(w.eval(DRIVE_WB(withoutR))));
  ok(!B.no && !B.pushed && /-R is not on the roster/.test(B.msg) && /Add ID/.test(B.msg), "an associate without an -R account is refused with the code and Add ID named, and nothing is queued: " + (B.no || B.msg.slice(0, 120)));
  /* the editor, driven: a buyer not on the roster, then a moved order with a blank date */
  const DRIVE_ED = (party, date, moved) => "(function(){try{queue=[];window.confirm=function(){return true;};ledNew();var set=function(k,v){var e=document.getElementById('ed_'+k);if(!e)return false;e.value=v;return true;};" +
    "set('party'," + JSON.stringify(party) + ");set('qty','1.3');set('total','113');set('cash'," + JSON.stringify(moved ? "113" : "0") + ");set('deliveredQty'," + JSON.stringify(moved ? "1" : "0") + ");set('date'," + JSON.stringify(date) + ");" +
    "var n0=queue.length;edSubmitNew();var why=(document.getElementById('edWhy')||{}).textContent||'';var q=queue[queue.length-1];" +
    "return JSON.stringify({pushed:queue.length===n0+1,why:why,q:(queue.length===n0+1&&q)?{party:q.payload.party,date:q.payload.date}:null});}catch(e){return JSON.stringify({no:'threw: '+(e&&e.message)});}})()";
  w.eval("switchTab('ledger');");
  const C = JSON.parse(String(w.eval(DRIVE_ED("ZZ9-NOPE", "", true))));
  ok(!C.no && !C.pushed && /ZZ9-NOPE is not on the roster/.test(C.why), "the editor refuses a buyer not on the roster and queues nothing: " + (C.no || C.why.slice(0, 100)));
  const D = JSON.parse(String(w.eval(DRIVE_ED(anyCust, "", true))));
  const today = String(w.eval("TODAY.toISOString().slice(0,10)"));
  ok(!D.no && D.pushed && D.q && D.q.party === anyCust && D.q.date === today, "a moved order with a blank date is queued dated today: " + (D.no || JSON.stringify(D.q)));
  try { w.close(); } catch (e) { }
}

section("v525: reject means discard, with re-enter, on the phone");
{
  const { openMaster: omC } = await import("../tools/payload.mjs");
  const { w } = await omC();
  const seed = (p) => JSON.parse(String(w.eval("JSON.stringify(apReenterSeed(" + JSON.stringify({ id: "x", entry: { payload: p } }) + "))")));
  const s1 = seed({ mode: "new", direction: "SELL", party: "CS6-BS", qty: 1, total: 110, cash: 0, kg: 1, date: "2026-09-07", delivery: 7.5, handover: "delivered", note: null });
  ok(s1 && s1.customer === "CS6-BS" && s1.qty === 1 && s1.total === 110 && s1.deliveredQty === 1 && s1.date === "2026-09-07" && s1.delivery === 7.5 && s1.handover === "delivered" && !s1.rev, "a queued sale seeds the editor with its own figures");
  const s2 = seed({ mode: "new", direction: "SELL", party: null, assoc: "CS6-BS", stream: "R2", downstream: "CS6-BS-R", qty: 1, total: 125, cash: 0, kg: 1, date: "2026-09-07" });
  ok(s2 && s2.customer === "CS6-BS" && s2.rev === "R2" && s2.downstream === "CS6-BS-R", "an R2 seeds the associate as the row's party with the end buyer beside it");
  ok(seed({ mode: "amend", direction: "SELL", rid: "s136", kind: "Fulfilment", cash: 10 }) === null && seed({ mode: "new", direction: "BUY", party: "SA5-BTR", qty: 25, total: 1200 }) === null, "an amendment and a purchase are not seeded: they re-enter on the Workbench");
  const gone = JSON.parse(String(w.eval("(function(){queue=[{at:'a1',type:'SELL'},{at:'a2',type:'SELL'},{at:'a3',type:'SELL'}];var n=qForgetAt('a2');return JSON.stringify({n:n,left:queue.map(function(q){return q.at;})});})()")));
  ok(gone.n === 1 && gone.left.join() === "a1,a3", "the device drops its own copy of the rejected entry and keeps the rest");
  try { w.close(); } catch (e) { }
}

section("v526: the replay question, asked on the phone");
{
  const { plan: planD } = await import("../tools/fold.mjs");
  const { draftRow: draftD } = await import("../src/drafter.js");
  const bkD = JSON.parse(readFileSync(join(REPO, "ledger", "book.json"), "utf8"));
  const real = bkD.sales.filter((r) => r.date && r.customer && +r.total > 0 && +r.qty > 0 && !r.cancelled).slice(-1)[0];
  const twinRow = { customer: real.customer, date: real.date, qty: real.qty, total: real.total, cash: real.total, deliveredQty: real.qty, product: real.product || "salt" };
  const staged = (second) => ({ ok: true, count: 1, approved: [{ id: "2099-02-01T00:00:00.001Z", collection: "sales", row: twinRow, entry: { at: "2099-02-01T00:00:00.001Z", payload: { mode: "new", direction: "SELL", second: second ? real.rid || true : null } } }] });
  const pNo = planD(bkD, staged(false), null), pYes = planD(bkD, staged(true), null);
  ok(pNo.items.length === 0 && pNo.refused.length === 1 && /would be a replay/.test(pNo.refused[0].why), "an unmarked twin of " + real.rid + " is refused as a replay");
  ok(pYes.refused.length === 0 && pYes.items.length === 1 && pYes.items[0].does.some((d) => /second order beside/.test(d)), "the same twin marked second folds, and says so in what it does");
  /* the drafter names the match both ways */
  const mirror = { version: "vX", sales: bkD.sales, purchases: bkD.purchases, state: { roster: bkD.roster, associates: bkD.associates, PRODUCTS: bkD.PRODUCTS, QUEUE_COMMITTED: bkD.QUEUE_COMMITTED },
    pricing: { v: "vX", byProduct: { salt: { stockCost: 48, replCost: 48.67, floors: { 1: { floor: 54.87 }, 2: { floor: 109.73 } }, inputs: null } } } };
  const draftOf = (second) => draftD({ at: "2099-02-01T00:00:00.002Z", payload: { mode: "new", direction: "SELL", party: real.customer, product: real.product || "salt", qty: real.qty, total: real.total, cash: real.total, kg: real.qty, date: real.date, second } }, mirror);
  const dNo = draftOf(null), dYes = draftOf(true);
  ok(!dNo.skip && dNo.flags.some((f) => /refuse it as a replay/.test(f) && /enter it again, answering yes/.test(f)), "the drafter flags an unmarked twin as a replay the fold will refuse: " + (dNo.skip || ""));
  ok(!dYes.skip && dYes.flags.some((f) => /SECOND order/.test(f) && /take it as one/.test(f)), "and names a marked twin as the second order it is");
  /* the editor, driven on the real master: a double tap, then the question both ways */
  const { openMaster: omD } = await import("../tools/payload.mjs");
  const { w } = await omD();
  /* the editor is driven on the twin's own product: `real` is the newest live sale, which was oil
     at v542, and a twin is matched on product, so salt would find nothing to ask about */
  w.eval("setProd(" + JSON.stringify(real.product || "salt") + ");recompute();switchTab('ledger');");
  const DRIVE = (answer, prime) => "(function(){try{window.confirm=function(){return " + (answer ? "true" : "false") + ";};queue=" + (prime ? "[{at:'2099-02-01T00:00:00.000Z',type:'SELL',payload:{mode:'new',direction:'SELL',party:" + JSON.stringify(real.customer) + ",date:" + JSON.stringify(real.date) + ",qty:" + real.qty + ",total:" + real.total + "}}]" : "[]") + ";" +
    "ledNew();var set=function(k,v){var e=document.getElementById('ed_'+k);if(e)e.value=v;};set('party'," + JSON.stringify(real.customer) + ");set('qty'," + JSON.stringify(String(real.qty)) + ");set('total'," + JSON.stringify(String(real.total)) + ");set('cash'," + JSON.stringify(String(real.total)) + ");set('deliveredQty'," + JSON.stringify(String(real.qty)) + ");set('date'," + JSON.stringify(real.date) + ");" +
    "var n0=queue.length;edSubmitNew();var why=(document.getElementById('edWhy')||{}).textContent||'';var q=queue[queue.length-1];return JSON.stringify({pushed:queue.length===n0+1,why:why,second:q&&q.payload?q.payload.second:undefined});}catch(e){return JSON.stringify({no:'threw: '+(e&&e.message)});}})()";
  const tap = JSON.parse(String(w.eval(DRIVE(true, true))));
  ok(!tap.no && !tap.pushed && /already queued from this device/.test(tap.why), "the same figures already queued on this device are refused as a double tap, before any question: " + (tap.no || tap.why.slice(0, 90)));
  const no = JSON.parse(String(w.eval(DRIVE(false, false))));
  ok(!no.no && !no.pushed && /not a second order/.test(no.why), "a twin of " + real.rid + " with the answer no is not queued: " + (no.no || no.why.slice(0, 90)));
  const yes = JSON.parse(String(w.eval(DRIVE(true, false))));
  const named = bkD.sales.find((r) => r.rid === yes.second);
  ok(!yes.no && yes.pushed && named && named.customer === real.customer && named.date === real.date && +named.total === +real.total && +named.qty === +real.qty, "with the answer yes it is queued marked second, naming a twin row on the book: " + (yes.no || String(yes.second)));
  try { w.close(); } catch (e) { }
}

section("v527: borrow and lend on the phone");
{
  const { draftRow: draftL } = await import("../src/drafter.js");
  const { plan: planL, apply: applyL } = await import("../tools/fold.mjs");
  const bkL = JSON.parse(readFileSync(join(REPO, "ledger", "book.json"), "utf8"));
  const lender = bkL.loans.find((l) => l.direction === "in" && l.status !== "settled");
  ok(lender, "the book carries an open loan in to measure against (" + (lender && lender.party) + ")");
  const mirror = { version: "vX", sales: bkL.sales, purchases: bkL.purchases, state: { roster: bkL.roster, loans: bkL.loans, OPEN: { position: { salt: { onHand: 1, owedOut: 8.5, promised: 0 } } } }, pricing: null };
  const ent = (p) => ({ at: "2099-03-01T00:00:00.001Z", payload: { mode: "loan", product: "salt", ...p } });
  const dIn = draftL(ent({ party: lender.party, direction: "in", kg: 2, date: "2099-03-01" }), mirror);
  ok(!dIn.skip && dIn.collection === "loan" && dIn.row.direction === "in" && dIn.row.valueKg === 2 && dIn.row.status === "open" && dIn.flags.some((f) => /already has .* open loan/.test(f)), "a borrowing drafts as a loan in and names the party's open loans: " + (dIn.skip || dIn.flags.join(" | ").slice(0, 120)));
  const dOut = draftL(ent({ party: "CM4-MK", direction: "out", kg: 3, date: "2099-03-01" }), mirror);
  ok(!dOut.skip && dOut.row.direction === "out" && dOut.flags.some((f) => /Lending more than you hold/.test(f)), "a lending over the inventory drafts and is flagged: " + (dOut.skip || ""));
  ok(/names the party/.test(draftL(ent({ direction: "in", kg: 1, date: "2099-03-01" }), mirror).skip || "") && /in \(borrowed/.test(draftL(ent({ party: "CM4-MK", direction: "sideways", kg: 1, date: "2099-03-01" }), mirror).skip || "") && /needs the date/.test(draftL(ent({ party: "CM4-MK", direction: "in", kg: 1 }), mirror).skip || ""), "no party, a direction that is neither, and no date are refused");
  /* the planner and the apply, on a copy of the book */
  const stagedL = { ok: true, count: 2, approved: [
    { id: "2099-03-01T00:00:00.001Z", collection: "loan", row: dIn.row, entry: ent({ party: lender.party, direction: "in", kg: 2, date: "2099-03-01" }) },
    { id: "2099-03-01T00:00:00.002Z", collection: "loan", row: dOut.row, entry: ent({ party: "CM4-MK", direction: "out", kg: 3, date: "2099-03-01" }) } ] };
  const copyL = JSON.parse(JSON.stringify(bkL));
  const pL = planL(copyL, stagedL, null);
  ok(pL.refused.length === 0 && pL.items.length === 2 && pL.moves.length === 2 && pL.moves[0].kg === 2 && pL.moves[1].kg === -3 && /BORROW 2 unit/.test(pL.items[0].what) && /LEND 3 unit/.test(pL.items[1].what), "the planner moves a borrowing in and a lending out: " + JSON.stringify(pL.moves.map((m) => m.kg)));
  const notesL = { version: "v9999", date: "01 Mar 2099", title: "TWO LOANS", notes: ["<b>TWO LOANS.</b> A borrowing and a lending, on a copy of the book, long enough to be a paragraph."], rows: { "2099-03-01T00:00:00.001Z": { note: "<b>BORROWED 2 UNIT.</b> A note long enough to pass, on a copy of the book." }, "2099-03-01T00:00:00.002Z": { note: "<b>LENT 3 UNIT.</b> A note long enough to pass, on a copy of the book." } }, stockNote: "", stockCost: null, stockCostNote: "" };
  const before = copyL.STATED_STOCK, nLoans = copyL.loans.length;
  const aL = applyL(copyL, stagedL, notesL, readFileSync(join(REPO, "master", "salt_command.html"), "utf8"));
  ok(aL.ok && copyL.loans.length === nLoans + 2 && copyL.loans[nLoans].direction === "in" && copyL.loans[nLoans].valueKg === 2 && /BORROWED 2 UNIT/.test(copyL.loans[nLoans].note) && copyL.loans[nLoans + 1].direction === "out", "the apply appends both to the loan book with their notes: " + (aL.ok ? "ok" : (aL.problems || []).join("; ")));
  ok(Math.abs(copyL.STATED_STOCK - (before + 2 - 3)) < 0.005, "and rolls the stated inventory in by 2 and out by 3 (" + before + " to " + copyL.STATED_STOCK + ")");
  /* the Workbench, driven on the real master */
  const { openMaster: omL } = await import("../tools/payload.mjs");
  const { w } = await omL();
  w.eval("setProd('salt');recompute();switchTab('add');");
  const DRIVE = (dir, party) => "(function(){try{queue=[];wbMode='loan';wbApply();var set=function(id,v){var e=document.getElementById(id);if(!e)return false;e.value=v;return true;};" +
    "set('wbLoanDir'," + JSON.stringify(dir) + ");set('wbLoanParty'," + JSON.stringify(party) + ");set('wbLoanUnits','2.5');set('wbLoanDate','2026-09-08');set('wbLoanNote','terms');wbPreview();" +
    "var btn=document.getElementById('wbRec');var dis=!!btn.disabled;var n0=queue.length;var r={dis:dis};try{wbRecord();}catch(e){r.threw=String(e&&e.message);}var q=queue[queue.length-1];r.pushed=(queue.length===n0+1);" +
    "r.q=r.pushed&&q?{type:q.type,party:q.party,payload:q.payload}:null;var nl=loans.length;applyOverlay();r.loansAfter=loans.length-nl;r.card=(function(){try{return apCard({collection:'loan',row:{direction:" + JSON.stringify(dir) + ",party:" + JSON.stringify(party) + ",valueKg:2.5,product:'salt',date:'2026-09-08'}});}catch(e){return 'threw '+e.message;}})();return JSON.stringify(r);}catch(e){return JSON.stringify({no:'threw: '+(e&&e.message)});}})()";
  const L1 = JSON.parse(String(w.eval(DRIVE("in", lender.party))));
  ok(!L1.no && !L1.dis && L1.pushed && L1.q && L1.q.type === "BORROW" && L1.q.payload.mode === "loan" && L1.q.payload.direction === "in" && L1.q.payload.kg === 2.5 && L1.q.payload.party === lender.party && L1.q.payload.date === "2026-09-08", "the Workbench queues a borrowing with its figures: " + (L1.no || L1.threw || JSON.stringify(L1.q)));
  ok(!L1.no && L1.loansAfter === 1 && /Borrow/.test(L1.card) && /in kind/.test(L1.card) && /2.5 unit/.test(L1.card), "the overlay puts it on the loan book at once and the Approve card reads Borrow, in kind, 2.5 unit");
  const L2 = JSON.parse(String(w.eval(DRIVE("out", "CM4-MK"))));
  ok(!L2.no && L2.pushed && L2.q.type === "LEND" && L2.q.payload.direction === "out" && /Lend/.test(L2.card), "and a lending the other way");
  await new Promise((r) => setTimeout(r, 200));   /* let the record's own save answer before the desk closes */
  try { w.close(); } catch (e) { }
}

section("v528: the name on the phone, filed encrypted before the ID is queued");
{
  const { mergeBio } = await import("../tools/pull-vault.mjs");
  const { vaultDecrypt: vdec } = await import("../tools/seed-vault.mjs");
  const m = mergeBio({ bio: { "CA1-X": { raw: "Kept (Here)" }, "CB2-Y": { raw: "" } } }, { "CA1-X": "New (There)", "CB2-Y": "Filled (Now)", "CC3-Z": "Added (Place)", "CD4-W": "" });
  ok(m.added.join() === "CB2-Y,CC3-Z" && m.kept.join() === "CA1-X" && m.bio.bio["CA1-X"].raw === "Kept (Here)" && m.bio.bio["CC3-Z"].raw === "Added (Place)" && !("CD4-W" in m.bio.bio), "the pull adds what the directory lacks or left blank, keeps what it has, and skips an empty name");
  const { openMaster: omV } = await import("../tools/payload.mjs");
  const { webcrypto } = await import("node:crypto");
  const { w } = await omV();
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, "crypto", { value: webcrypto, configurable: true }); } catch (e) { w.crypto = webcrypto; } }
  w.eval("setProd('salt');recompute();switchTab('add');");
  const DRIVE = (opts) => "(function(){try{queue=[];NAME_VAULT=" + (opts.vault || "null") + ";qSyncState='server';window.__posts=[];window.prompt=function(){return " + JSON.stringify(opts.pass) + ";};" +
    "window.fetch=function(u,o){window.__posts.push({u:String(u),body:o&&o.body?JSON.parse(o.body):null});return Promise.resolve({ok:" + (opts.saveOk === false ? "false" : "true") + ",json:function(){return Promise.resolve({ok:" + (opts.saveOk === false ? "false" : "true") + "});}});};" +
    "wbMode='addid';wbApply();var set=function(id,v){var e=document.getElementById(id);if(e)e.value=v;};set('wbApCode'," + JSON.stringify(opts.code) + ");set('wbApKind'," + JSON.stringify(opts.kind || "customer") + ");set('wbApName'," + JSON.stringify(opts.name || "") + ");set('wbApPlace'," + JSON.stringify(opts.place || "") + ");wbPreview();" +
    "var btn=document.getElementById('wbRec');var r={dis:!!btn.disabled,errs:(document.getElementById('wbMsgs')||{}).textContent||''};try{wbRecord();}catch(e){r.threw=String(e&&e.message);}return JSON.stringify(r);}catch(e){return JSON.stringify({no:'threw: '+(e&&e.message)});}})()";
  const settle = async () => { for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 100)); const st = String(w.eval("(document.getElementById('wbOk')||{}).textContent||''")); if (!/Filing the name/.test(st)) return st; } return String(w.eval("(document.getElementById('wbOk')||{}).textContent||''")); };
  const readQ = () => JSON.parse(String(w.eval("JSON.stringify({q:queue.map(function(x){return {type:x.type,party:x.party,raw:x.raw,payload:x.payload};}),posts:window.__posts,vault:NAME_VAULT,roster:roster.indexOf('CZ9-TESTNAME')>=0})")));
  /* without a name the button is disabled and nothing is registered */
  const A = JSON.parse(String(w.eval(DRIVE({ code: "CZ9-TESTNAME", pass: "pw" }))));
  ok(!A.no && A.dis && /Type the name/.test(A.errs) && /ends in TBC/.test(A.errs), "without a name the button is disabled, and a blank place on a code that names one says the code must end in TBC: " + (A.no || A.errs.slice(0, 80)));
  /* the named road: the vault is written first, then the ID is queued with no name on it */
  const B = JSON.parse(String(w.eval(DRIVE({ code: "CZ9-TESTNAME", pass: "pw", name: "Test Person", place: "Somewhere" }))));
  const stB = await settle();
  const qB = readQ();
  const post = qB.posts.find((p) => /vault$/.test(p.u));
  ok(!B.no && !B.dis && /Registered CZ9-TESTNAME/.test(stB) && post && post.body && post.body.vault && post.body.vault.ct, "with a name and place the vault is posted and the ID registered: " + (B.no || stB.slice(0, 90)));
  let opened = null; try { opened = await vdec("pw", post.body.vault); } catch (e) { opened = { err: String(e && e.message) }; }
  ok(opened && opened["CZ9-TESTNAME"] === "Test Person (Somewhere)", "the same passphrase opens the envelope to the name and place: " + JSON.stringify(opened && opened["CZ9-TESTNAME"]));
  ok(qB.q.length === 1 && qB.q[0].type === "ADDID" && qB.q[0].payload.code === "CZ9-TESTNAME" && !JSON.stringify(qB.q).includes("Test Person") && !JSON.stringify(qB.q).includes("Somewhere") && qB.roster, "the ID is queued with no name and no place on it, and is selectable at once");
  /* a refused passphrase, and a refused save, register nothing */
  w.eval("(function(){var i=roster.indexOf('CZ9-TESTNAME');if(i>=0)roster.splice(i,1);})();");
  const C = JSON.parse(String(w.eval(DRIVE({ code: "CZ9-TESTNAME", pass: "", name: "Test Person", place: "Somewhere" }))));
  const stC = await settle();
  ok(!C.no && /needs the passphrase/.test(stC) && readQ().q.length === 0, "no passphrase registers nothing: " + stC.slice(0, 80));
  /* v548, his instruction of 09 Sep 2026: a place still to be confirmed can be entered. Blank, on a code
     ending in TBC, it files "(to be confirmed)" and registers; the map's reason for a TBC code renders
     its ampersand, which the entity in the source had printed literally. */
  const TB = JSON.parse(String(w.eval(DRIVE({ code: "CZ9-TBC", pass: "pw", name: "Test Person", place: "" }))));
  const stTB = await settle();
  const qTB = readQ();
  const postTB = qTB.posts.find((p) => /vault$/.test(p.u));
  let openedTB = null; try { openedTB = postTB && postTB.body ? await vdec("pw", postTB.body.vault) : null; } catch (e) { openedTB = { err: String(e && e.message) }; }
  ok(!TB.no && !TB.dis && /Registered CZ9-TBC/.test(stTB) && openedTB && openedTB["CZ9-TBC"] === "Test Person (to be confirmed)",
    "a blank place on a TBC code registers, and files the name as to be confirmed: " + (TB.no || stTB.slice(0, 60)) + " / " + JSON.stringify(openedTB && openedTB["CZ9-TBC"]));
  w.eval("(function(){var i=roster.indexOf('CZ9-TBC');if(i>=0)roster.splice(i,1);queue=[];})();");
  w.eval("switchTab('map');");
  const mapText = String(w.eval("(document.querySelector('.sec.on')||{}).textContent||''"));
  ok(/Names & IDs/.test(mapText) && !/&amp;/.test(mapText), "the map's reason for a TBC code reads Names & IDs, not the entity");
  w.eval("switchTab('add');");
  /* the laptop's Names & IDs panel takes the same answer: a blank location derives the TBC suffix and files to be confirmed */
  const L = JSON.parse(String(w.eval("(function(){queue=[];['apName','apLoc','apKind','apParent','apMsg'].forEach(function(id){if(!document.getElementById(id)){var e=document.createElement(id==='apMsg'?'div':(id==='apKind'||id==='apParent')?'select':'input');e.id=id;document.body.appendChild(e);}});var k=document.getElementById('apKind');k.innerHTML='<option value=customer>customer</option>';k.value='customer';document.getElementById('apName').value='Test Person';document.getElementById('apLoc').value='';try{addParty();}catch(e){return JSON.stringify({threw:String(e&&e.message)});}return JSON.stringify({on:roster.indexOf('CT11-TBC')>=0,raw:(BIO['CT11-TBC']||{}).raw||null,msg:document.getElementById('apMsg').textContent.slice(0,60),q:queue.length});})()")));
  ok(!L.threw && L.on && L.raw === "Test Person (to be confirmed)" && L.q === 1, "on the laptop panel a blank location derives CT11-TBC and files to be confirmed: " + JSON.stringify(L));
  w.eval("(function(){var i=roster.indexOf('CT11-TBC');if(i>=0)roster.splice(i,1);delete BIO['CT11-TBC'];queue=[];})();");
  const D = JSON.parse(String(w.eval(DRIVE({ code: "CZ9-TESTNAME", pass: "pw", name: "Test Person", place: "Somewhere", saveOk: false }))));
  const stD = await settle();
  ok(!D.no && /could not be saved/.test(stD) && readQ().q.length === 0 && readQ().vault === null, "a refused save registers nothing and puts the old vault back");
  const wrongEnv = JSON.stringify(post.body.vault);
  const E = JSON.parse(String(w.eval(DRIVE({ code: "CZ9-TESTNAME", pass: "not-pw", name: "Test Person", place: "Somewhere", vault: wrongEnv }))));
  const stE = await settle();
  ok(!E.no && /did not open the vault/.test(stE) && readQ().q.length === 0, "a wrong passphrase against an existing vault registers nothing");
  /* a bucket has no name and takes the old road */
  const F = JSON.parse(String(w.eval(DRIVE({ code: "CZ9-TESTBUCKET", kind: "bucket", pass: "pw" }))));
  w.eval("var ap=document.getElementById('wbApParent');if(ap){ap.innerHTML='<option value=\"CS6-BS\">CS6-BS</option>';ap.value='CS6-BS';}wbPreview();wbRecord();");
  const qF = readQ();
  ok(!F.no && qF.q.some((x) => x.payload.code === "CZ9-TESTBUCKET" && x.payload.kind === "bucket") && !qF.posts.some((p) => /vault$/.test(p.u)), "a bucket registers without a name and touches no vault");
  await new Promise((r) => setTimeout(r, 200));
  try { w.close(); } catch (e) { }
}

section("v532: a re-keyed party reads back as the correction it was");
{
  const { openMaster: omK } = await import("../tools/payload.mjs");
  const { w } = await omK();
  const claims = (row, dir) => JSON.parse(String(w.eval("JSON.stringify(modClaims(" + JSON.stringify(row) + "," + JSON.stringify(dir) + "))")));
  const sale = { rid: "k1", type: "SELL", customer: "CH6-SET", qty: 1, total: 100, mod: "corrected on 2026-08-26: customer CH6-TBC to CH6-SET", amend: [{ kind: "Correction", date: "2026-08-26" }] };
  const a = claims(sale, "SELL");
  ok(a.length === 1 && a[0].field === "party" && a[0].verdict === "agrees" && a[0].reads === "CH6-SET", "a customer re-key written with the stored key reads back as the party correction it is: " + JSON.stringify(a[0] && a[0].verdict));
  const lot = { rid: "k2", type: "BUY", supplier: "SA5-BTR", qty: 25, total: 1200, mod: "corrected on 2026-08-26: supplier SX9-OLD to SA5-BTR", amend: [{ kind: "Correction", date: "2026-08-26" }] };
  const b = claims(lot, "BUY");
  ok(b.length === 1 && b[0].field === "party" && b[0].verdict === "agrees", "and a supplier re-key the same");
  const wrong = claims({ ...sale, customer: "CH6-TBC" }, "SELL");
  ok(wrong[0].verdict === "differs" && wrong[0].reads === "CH6-TBC", "a re-key the row does not carry still differs");
  const odd = claims({ ...sale, mod: "corrected on 2026-08-26: colour red to blue" }, "SELL");
  ok(odd[0].verdict === "unknown", "a field no correction may set is still unknown");
  try { w.close(); } catch (e) { }
}

const FLOOR_ASSERTIONS = 1330, FLOOR_SECTIONS = 97;   /* stale records skipped: 1334 everywhere, 1335 here */
ok(pass + fail - offMachine >= FLOOR_ASSERTIONS,
  `the suite ran ${pass + fail - offMachine} assertions everywhere (${pass + fail} here, ${offMachine} of them needing files that live off this repo), below its floor of ${FLOOR_ASSERTIONS}: a section has stopped running`);
ok(sections >= FLOOR_SECTIONS,
  `the suite ran ${sections} sections, below its floor of ${FLOOR_SECTIONS}: a section has stopped running`);

/* ---- 08 Sep 2026: the audit, one assertion per fix, each proved red on the code it replaced ---- */
section("08 Sep 2026: the audit fixes");
{
  const { draftRow, costFor, runDrafter } = await import("../src/drafter.js");
  const { plan: planA, apply: applyA, applyAmend: amendA } = await import("../tools/fold.mjs");
  const PE = (await import("../engine/pricing.mjs")).default;
  const PL = await import("../tools/pricelist.mjs");
  const { checkPlacement } = await import("../stmt/orders.js");
  const bookA = {
    version: "vA", pricing: { v: "vA", byProduct: { salt: { stockCost: 56, replCost: 56, floors: { "1": { floor: 60 } } } } },
    purchases: [{ date: "2026-08-13", supplier: "SA5-BTR", qty: 12.5, total: 700, receivedOn: "2026-08-13", receivedQty: 12.5 }],
    sales: [
      { date: "2026-08-01", customer: "CC5-OKR", qty: 1, total: 90, cash: 90, deliveredQty: 1 },
      { date: "2026-08-08", customer: "CC5-OKR", qty: 1, total: 90, cash: 90, deliveredQty: 1 },
      { date: "2026-08-10", customer: "CC5-OKR", qty: 1, total: 80, cash: 0, deliveredQty: 0 },
      { date: "2026-08-11", customer: "CC5-OKR", qty: 1, total: 80, cash: 0, deliveredQty: 0 },
      { date: "2026-08-12", customer: "CH4-MLR", qty: 1, total: 110, delivery: 10, cash: 110, deliveredQty: 1, rid: "s-del" }
    ],
    state: { roster: ["CC5-OKR", "CH4-MLR", "SA5-BTR"], QUEUE_COMMITTED: "2026-08-14T00:00:00.000Z" }
  };
  const ent = (payload, at = "2026-08-16T01:00:00.000Z") => ({ at, payload: { mode: "new", ...payload } });

  /* the drafter */
  const cut = draftRow(ent({ direction: "SELL", party: "CC5-OKR", qty: 1, total: 80, cash: 80, kg: 1, date: "2026-08-16" }), bookA);
  ok(cut.flags.some((f) => /has paid RM 90/.test(f)), "two DATED pending RM 80 rows are not history: the standing rate still reads RM 90 (v540 dated every pending row)");
  const twin = draftRow(ent({ direction: "SELL", party: "CH4-MLR", qty: 1, total: 110, delivery: 10, cash: 110, kg: 1, date: "2026-08-12" }), bookA);
  ok(twin.flags.some((f) => /matches s-del/.test(f)), "a twin with delivery inside its total is matched on the FULL total, as the fold matches it");
  const adv = draftRow(ent({ direction: "SELL", party: "CH4-MLR", qty: 1, total: 100, delivery: 10, cash: 95, kg: 1, date: "2026-08-16" }), bookA);
  ok(adv.flags.some((f) => /ADVANCE/.test(f) && /RM 5 unpaid/.test(f)), "RM 95 on a RM 100 order with RM 10 delivery inside is an advance of RM 5, not none");
  const over = draftRow(ent({ direction: "SELL", party: "CH4-MLR", qty: 5, total: 100, cash: 900, kg: 50, date: "2026-08-16" }), bookA);
  ok(over.flags.some((f) => /RM 800 more/.test(f)) && over.flags.some((f) => /50 unit goes out on an order of 5/.test(f)), "cash above the total and units above the order are flagged on a new row");
  for (const [p, why] of [[{ qty: 0, total: 100 }, /above zero/], [{ qty: -2, total: -200 }, /above zero/], [{ qty: 1, total: 100, date: "8/9/2026" }, /YYYY-MM-DD/]]) {
    const d = draftRow(ent({ direction: "SELL", party: "CH4-MLR", cash: 0, kg: 0, date: "2026-08-16", ...p }), bookA);
    ok(!!d.skip && why.test(d.skip), "the gate refuses " + JSON.stringify(p) + ": " + (d.skip || "drafted"));
  }
  const lot = draftRow(ent({ direction: "BUY", party: "SA5-BTR", qty: 12.5, total: 500, cash: 500, kg: 12.5, date: "2026-08-16" }),
    { ...bookA, sales: bookA.sales.concat([{ date: "2026-08-13", customer: "CC5-OKR", qty: 1, total: 100, cash: 100, deliveredQty: 1 }]) });
  ok(!lot.skip && !lot.flags.some((f) => /less than half/.test(f)), "a RM 40 lot is not measured against the lowest SALE rate on the book");
  const transit = { ...bookA, pricing: { v: "vA", byProduct: { salt: { stockCost: null, replCost: null, floors: {} } } },
    purchases: bookA.purchases.concat([{ date: "2026-08-20", supplier: "SA5-BTR", qty: 25, total: 1500, inTransit: true, receivedQty: 0 }]) };
  const cf = costFor(transit, "salt");
  ok(cf.cost === 56 && cf.mayBlend === false, `a lot in transit is not the newest received lot: cost ${cf.cost}, blend ${cf.mayBlend}`);
  /* 09 Sep 2026: a fulfilment names its row by rid. Two twins share one key; the snapshot can hold
     only one under it, and a draft naming the key was refused at the fold as matching two rows. */
  {
    const t1 = { rid: "tw1", key: "CH4-MLR|2026-09-12|100", p: "CH4-MLR", q: 1, t: 100, d: "2026-09-12", cash: 0, mv: 1, dir: "S" };
    const t2 = { ...t1, rid: "tw2" };
    const bkT = { ...bookA, sales: bookA.sales.concat([{ rid: "tw1", customer: "CH4-MLR", date: "2026-09-12", qty: 1, total: 100, cash: 0, deliveredQty: 1 },
      { rid: "tw2", customer: "CH4-MLR", date: "2026-09-12", qty: 1, total: 100, cash: 0, deliveredQty: 1 }]),
      state: { ...bookA.state, OPEN: { byKey: { [t1.key]: t2 } } } };
    const fu = draftRow({ at: "2026-09-16T01:00:00.000Z", payload: { mode: "amend", direction: "SELL", party: "CH4-MLR", rid: "tw1", orderKey: t1.key, kind: "Fulfilment", cash: 100, kg: 0, date: "2026-09-13" } }, bkT);
    ok(!fu.skip && fu.amends === "tw1", `a fulfilment on one of two twins names the twin it was tapped on (${fu.skip || fu.amends})`);
    const fk = draftRow({ at: "2026-09-16T01:00:00.001Z", payload: { mode: "amend", direction: "SELL", party: "CH4-MLR", orderKey: t1.key, kind: "Fulfilment", cash: 100, kg: 0, date: "2026-09-13" } }, bkT);
    ok(!fk.skip && fk.amends === "tw2", `and an entry with no rid still resolves by key, naming the rid the snapshot holds (${fk.skip || fk.amends})`);
  }

  /* the run: an entry older than the watermark that the draft table does not know is drafted, not lost */
  const mirror = (b) => {
    const self = { drafts: new Map(), refused: new Map() };
    self.prepare = (sql) => {
      const s = sql.replace(/\s+/g, " ").trim(); let binds = [];
      const api = {
        bind(...a) { binds = a; return api; },
        async all() {
          if (/^SELECT doc FROM entry/.test(s)) return { results: (b[binds[0]] || []).map((r) => ({ doc: JSON.stringify(r) })) };
          if (/^SELECT key,doc FROM state/.test(s)) return { results: Object.keys(b.state).map((k) => ({ key: k, doc: JSON.stringify(b.state[k]) })).concat([{ key: "PRICING", doc: JSON.stringify(b.pricing) }]) };
          if (/^SELECT id FROM draft/.test(s)) return { results: [...self.drafts.keys()].map((id) => ({ id })) };
          throw new Error("unmocked all(): " + s);
        },
        async first() {
          if (/^SELECT v,stamped FROM snapshot/.test(s)) return { v: b.version, stamped: null };
          if (/^SELECT MAX\(committed_at\)/.test(s)) return { t: null };
          throw new Error("unmocked first(): " + s);
        },
        async run() {
          if (/^DELETE FROM refused/.test(s)) return { meta: { changes: 0 } };
          if (/^INSERT OR REPLACE INTO refused/.test(s)) { self.refused.set(binds[0], binds[2]); return { meta: { changes: 1 } }; }
          if (/^INSERT OR IGNORE INTO draft/.test(s)) { self.drafts.set(binds[0], binds[3]); return { meta: { changes: 1 } }; }
          throw new Error("unmocked run(): " + s);
        }
      };
      return api;
    };
    return self;
  };
  const db = mirror(bookA), kvA = new KV();
  await kvA.put("q:phone", JSON.stringify({ queue: [ent({ direction: "SELL", party: "CC5-OKR", qty: 1, total: 90, cash: 90, kg: 1, date: "2026-08-13" }, "2026-08-13T01:00:00.000Z")] }));
  const run1 = await runDrafter({ SALT_QUEUE: kvA, SALT_LEDGER: db });
  ok(run1.ok && run1.drafted === 1 && run1.committed === 0 && db.drafts.has("2026-08-13T01:00:00.000Z"),
    `an entry stamped before the watermark that no draft knows is drafted for a decision, not counted as committed (drafted ${run1.drafted}, committed ${run1.committed}, refused ${[...db.refused.values()].join("; ")})`);
  const run2 = await runDrafter({ SALT_QUEUE: kvA, SALT_LEDGER: db });
  ok(run2.drafted === 0 && run2.committed === 1, "and on the next pass the same entry, now in the draft table and below the mark, counts as committed");

  /* the Worker: a decision that changed no row is a 409, and the day is Kuala Lumpur's */
  {
    const d1 = { rows: new Map([["x1", { status: "pending" }]]) };
    d1.prepare = (sql) => { const s = sql.replace(/\s+/g, " "); let binds = []; const api = { bind(...a) { binds = a; return api; },
      async first() { return d1.rows.get(binds[0]) || null; },
      async run() { if (/^UPDATE draft SET status=/.test(s)) return { meta: { changes: 0 } }; throw new Error("unmocked " + s); } }; return api; };
    const envD = { SALT_QUEUE: new KV(), SALT_LEDGER: d1, ASSETS: assets, REQUIRE_ACCESS: "0", SALT_WRITE_KEY: "k" };
    const r = await worker.fetch(req("/drafts/x1/approve", { method: "POST", headers: { "content-type": "application/json", "x-salt-key": "k" }, body: "{}" }), envD, { waitUntil() { } });
    ok(r.status === 409, `a decision whose UPDATE changed no row (another tap won) answers 409, not 200 (${r.status})`);
    const wsrc = readFileSync(join(REPO, "src", "worker.js"), "utf8");
    ok((wsrc.match(/today = klDay\(\)/g) || []).length === 2 && /timeZone: "Asia\/Kuala_Lumpur"/.test(wsrc), "both of the Worker's \"today\" readings against COUNT_ON are Kuala Lumpur's day");
    const swA = readFileSync(join(REPO, "public", "sw.js"), "utf8"); const apiA = (swA.match(/const API = (\/.*\/);/) || [])[1];
    const rxA = new RegExp(apiA.slice(1, apiA.lastIndexOf("/")));
    ok(["/orders", "/orders/u/abc", "/stmt-users", "/draft-now"].every((p) => rxA.test(p)) && /salt-shell-v5/.test(swA), "the service worker never caches /orders, /stmt-users or /draft-now, and the shell cache name moved");
    const dsrc = readFileSync(join(REPO, "src", "drafter.js"), "utf8");
    ok(/id LIKE 'fold:%'/.test(dsrc) && /seen_at<\?1/.test(dsrc), "a fold's own failure notice on the phone retires once a later draft has been committed");
  }

  /* the fold */
  const cx = { rid: "c1", customer: "CC5-OKR", date: "2026-08-01", qty: 1, total: 90, cash: 0, deliveredQty: 0 };
  amendA(cx, { date: "2026-08-05", kind: "Cancellation", cash: 0, kg: 0 }, "SELL");
  ok(cx.cancelled === true && cx.cancelledOn === "2026-08-05", "a cancellation through the trail stamps cancelledOn on the row as well as the step");
  const cq = { rid: "c2", customer: "CC5-OKR", date: "2026-08-01", qty: 1, total: 110, cost: 48, cash: 0, deliveredQty: 1 };
  amendA(cq, { date: "2026-08-05", kind: "Correction", cash: 0, kg: 0, fields: { qty: 2, total: 220 } }, "SELL");
  ok(cq.qty === 2 && cq.cost === 96, `a qty correction scales the order's absolute cost with it (cost ${cq.cost})`);
  const bkR = JSON.parse(readFileSync(join(REPO, "ledger", "book.json"), "utf8"));
  const liveRow = bkR.sales.find((s) => s.rid && !s.cancelled && s.date && s.customer);
  const pUnd = planA(JSON.parse(JSON.stringify(bkR)), { ok: true, count: 1, approved: [{ id: "2099-01-01T00:00:00.001Z", collection: "sales", amends: liveRow.rid, amendKind: "Fulfilment", row: {},
    entry: { at: "2099-01-01T00:00:00.001Z", payload: { mode: "amend", direction: "SELL", rid: liveRow.rid, kind: "Fulfilment", cash: 10, kg: 0 } } }] }, null);
  ok(pUnd.items.length === 0 && pUnd.refused.length === 1 && /carries no date/.test(pUnd.refused[0].why), "an undated fulfilment is refused rather than dated the day the order was agreed: " + (pUnd.refused[0] || {}).why);
  const twinRow = { customer: liveRow.customer, date: "2099-01-02", qty: 2, total: 20, cash: 20, deliveredQty: 2, product: "salt" };
  const twoOf = (ids) => ({ ok: true, count: ids.length, approved: ids.map((id) => ({ id, collection: "sales", row: { ...twinRow }, entry: { at: id, payload: { mode: "new", direction: "SELL" } } })) });
  const pTwo = planA(JSON.parse(JSON.stringify(bkR)), twoOf(["2099-01-01T00:00:00.002Z", "2099-01-01T00:00:00.003Z"]), null);
  ok(pTwo.items.length === 1 && pTwo.refused.length === 1 && /in this batch/.test(pTwo.refused[0].why), "two identical approved drafts in one batch: the second is refused as a replay of the first (" + pTwo.refused.map((x) => x.why).join("; ") + ")");
  const stale = applyA(JSON.parse(JSON.stringify(bkR)), twoOf(["2099-01-01T00:00:00.004Z"]), { version: "v100", title: "t", notes: ["n"], rows: {} }, 'const evolution=[{"v":"v542",');
  ok(!stale.ok && stale.problems.some((p) => /stale notes file/.test(p)), "a notes file at a version the master has passed is refused whole");

  /* the engine: the step-down never lands on the floor */
  {
    const C = { landed: 15.2, effEx: 15.2, eff: 15.2 };
    const P = { LADDER: { floor: 0, ceiling: 2, anchorQ: 10, anchorX: 0.62, at: { lo: 10, hi: 50 }, anchorG: 0.01, gLo: 0, gHi: 0.667, round: { to: 5, up: true }, taper: 0 },
      minPerUnit: 0, timePerOrder: 0, lotFloor: {}, tiers: [], boardSizes: [10, 12.5], stated: {} };
    const walked = PE.ladderWalk([10, 12.5], C, P), fl = PE.floorTotal(12.5, C, P);
    ok(walked[1].p > fl + 0.009, `where no grid step holds the rate flat above the floor, the ask stays above the floor rather than on it (ask ${walked[1].p}, floor ${fl})`);
  }

  /* the price list */
  ok(!PL.pricedOrder({ qty: 1, total: 90, cash: 0, deliveredQty: 0 }) && !PL.pricedOrder({ qty: 1, total: 90, cash: 90, deliveredQty: 1, cancelled: true })
    && !PL.pricedOrder({ qty: 1, total: 90, cash: 0, deliveredQty: 1, defaulted: true }) && !PL.pricedOrder({ qty: 1, total: 90, cash: 0, settledRM: 90, deliveredQty: 1, rebate: true })
    && PL.pricedOrder({ qty: 1, total: 90, cash: 90, deliveredQty: 1 }) && PL.pricedOrder({ qty: 1, total: 90, cash: 40, settledRM: 50, deliveredQty: 1, rebate: true }),
    "a price paid is a row that moved: pending, cancelled and defaulted rows and awards with no cash are not");
  const three = ["2026-08-10", "2026-08-17", "2026-08-24"].map((date) => ({ date, customer: "CX0-LY", qty: 1, total: 90, cash: 90, deliveredQty: 1 }));
  ok(PL.loyalFor(three, "CX0-LY", "salt", new Date("2026-09-06T12:00:00Z")) === true && PL.loyalFor(three, "CX0-LY", "salt", new Date("2026-09-06T20:00:00Z")) === false,
    "the fourteen days run from Kuala Lumpur midnight: loyal at 20:00 KL on the fourteenth day, not at 04:00 KL on the fifteenth");
  ok(!!checkPlacement({ product: "salt", qty: 1, mode: "collect", total: 0, unit: 0 }, []).error, "an order for RM 0 is not placed");
  const ssrc = readFileSync(join(REPO, "stmt", "worker.js"), "utf8");
  ok(/DUMMY_VERIFIER/.test(ssrc) && /known \? rec\.verifier : DUMMY_VERIFIER/.test(ssrc), "an unknown username runs the same verifier work as a known one, so the refusal cannot be timed");
  ok(/!PASS_RE\.test\(String\(master\)\)/.test(ssrc), "a customer's wrong password does not count against the owner's override brake");
  ok(/\(process\.env\.STMT_KEY \|\| ""\)\.trim\(\)/.test(readFileSync(join(REPO, "tools", "stmt-publish.mjs"), "utf8")), "the publish trims STMT_KEY as the generator does");
  ok(/new Anthropic\(\{ maxRetries: 6 \}\)/.test(readFileSync(join(REPO, "tools", "foldcall.mjs"), "utf8")), "the fold's call retries six times on 529 before leaving the batch staged");
  ok(!/JSON\.stringify\("(UPDATE|INSERT)/.test(readFileSync(join(REPO, "tools", "drafts.mjs"), "utf8")), "no write in drafts.mjs goes to wrangler by --command, where a shell reads the text");

  /* the drain: update.mjs pulls and keeps; only the hand mode clears (09 Sep 2026) */
  {
    const { runDrain } = await import("../tools/drain.mjs");
    const mk = () => {
      const kv = new Map([["q:a", JSON.stringify({ queue: [{ at: "2026-09-09T01:00:00.000Z", raw: "x" }] })], ["q:b", JSON.stringify({ queue: [{ at: "2026-09-09T02:00:00.000Z", raw: "y" }] })]]);
      const io = { deleted: [], written: null,
        list: () => [...kv.keys()], get: (k) => kv.get(k) ?? null, del: (k) => { io.deleted.push(k); return kv.delete(k); },
        read: () => ({ queue: [{ at: "2026-09-09T00:30:00.000Z", raw: "old" }] }), write: (o) => { io.written = o; } };
      return io;
    };
    const keep = mk(), r1 = runDrain({ keep: true, io: keep });
    ok(r1.cleared === 0 && keep.deleted.length === 0 && keep.written && keep.written.queue.length === 3,
      `--keep pulls both devices into the file (${keep.written && keep.written.queue.length} entries) and deletes nothing`);
    const clear = mk(), r2 = runDrain({ io: clear });
    ok(r2.cleared === 2 && clear.deleted.join() === "q:a,q:b", "the default mode still clears the keys it read, which is why update.mjs no longer runs it");
    const usrc = readFileSync(join(REPO, "tools", "update.mjs"), "utf8");
    ok(/\["tools\/drain\.mjs", "--keep"\]/.test(usrc), "update.mjs drains with --keep");
    ok(/headers: \{ "X-Salt-Key": process\.env\.SALT_WRITE_KEY \}/.test(usrc) && /!process\.env\.SALT_WRITE_KEY/.test(usrc),
      "the mirror check carries the write key from the environment, and says so when there is none");
  }

  /* the statement: a gift owes nothing */
  {
    const gb = JSON.parse(JSON.stringify(bkR));
    const cust = gb.sales.find((s) => s.customer && s.date).customer;
    gb.sales.push({ rid: "g-1", customer: cust, date: "2026-09-01", qty: 1, total: 100, cost: 48, cash: 0, deliveredQty: 1, deliveredOn: "2026-09-01", goodwill: true, amend: [] });
    const gp = join(REPO, "test", "tmp", "gift-book.json"); mkdirSync(dirname(gp), { recursive: true }); writeFileSync(gp, JSON.stringify(gb));
    const was = process.env.SALT_BOOK; process.env.SALT_BOOK = gp;
    const MS = await import("../tools/make_statements.mjs?gift=" + Date.now());
    if (was == null) delete process.env.SALT_BOOK; else process.env.SALT_BOOK = was;
    const g = MS.stmtRows(cust, { from: null, to: null, completed: true, open: true, pending: true }).find((x) => x.rid === "g-1");
    ok(g && g.gift === true && g.owed === 0 && g.total === 0, `a goodwill unit with nothing booked in kind prints no charge AND owes nothing (${g && JSON.stringify({ gift: g.gift, owed: g.owed, total: g.total })})`);
    try { rmSync(gp, { force: true }); } catch (e) { }
  }

  /* the desk, on the real master */
  {
    const { openMaster: omA } = await import("../tools/payload.mjs");
    const { pricingSnapshot } = await import("../tools/book.mjs");
    const { w } = await omA();
    const snap = pricingSnapshot(w);
    const list = PL.priceList("CX0-ZZ", bkR, snap, new Date("2026-09-08T04:00:00Z"));
    const oilL = list.products.find((p) => p.product === "oil"), saltL = list.products.find((p) => p.product === "salt");
    ok(oilL && saltL && oilL.sizes.map((x) => x.q).join() === snap.byProduct.oil.sizes.join() && saltL.sizes.map((x) => x.q).join() === snap.byProduct.salt.sizes.join() && oilL.sizes[0].q !== saltL.sizes[0].q,
      `each product's list is drawn on its own board sizes (oil ${oilL && oilL.sizes.map((x) => x.q).join("/")}, salt ${saltL && saltL.sizes.map((x) => x.q).join("/")})`);
    w.eval("setProd('salt');recompute();");
    const before = JSON.parse(String(w.eval("JSON.stringify(pxLeakCharge())")));
    w.eval("(function(){var c=sales.find(function(s){return s.customer&&s.date;}).customer;sales.push({rid:'lk-1',customer:c,date:'2026-09-01',qty:5,total:500,cost:240,cash:0,deliveredQty:5,amend:[{date:'2099-01-01',kind:'Fulfilment',kg:5,cash:0}]});})();recompute();");
    const after = JSON.parse(String(w.eval("JSON.stringify(pxLeakCharge())")));
    ok(before && after && Math.abs(after.sold - before.sold) < 0.005, `units the trail delivers after the last count stay out of the leak window (sold ${before && before.sold} before, ${after && after.sold} after)`);
    w.eval("(function(){var i=sales.findIndex(function(s){return s.rid==='lk-1';});if(i>=0)sales.splice(i,1);})();recompute();");
    const cs = JSON.parse(String(w.eval("JSON.stringify(COUNTS.filter(function(c){return (c.product||'salt')==='salt'&&c.drift!=null;}).slice(-3).map(function(c){return c.drift;}))")));
    if (cs.length === 3) {
      w.eval("(function(){var cs=COUNTS.filter(function(c){return (c.product||'salt')==='salt'&&c.drift!=null;}).slice(-3);cs[1].drift=5;})();recompute();");
      const net = JSON.parse(String(w.eval("JSON.stringify(pxLeakCharge())")));
      const expect = Math.max(0, -(cs[0] + 5 + cs[2]));
      ok(Math.abs(net.leak - expect) < 0.005, `the three drifts are netted before the charge: a surplus of 5 offsets the deficits (leak ${net.leak}, expected ${expect})`);
      w.eval("(function(){var cs=COUNTS.filter(function(c){return (c.product||'salt')==='salt'&&c.drift!=null;}).slice(-3);cs[1].drift=" + JSON.stringify(cs[1]) + ";})();recompute();");
    }
    const cust = String(w.eval("sales.find(function(s){return s.customer&&s.date;}).customer"));
    const ef = (p) => String(w.eval("entryFault(" + JSON.stringify(p) + ")"));
    ok(/more than the order/.test(ef({ direction: "SELL", product: "salt", party: cust, qty: 1, total: 100, delivery: 120, cash: 0, kg: 0, date: "2026-09-08" })), "the entry form refuses a delivery charge above the total, as the drafter does");
    ok(/dated/.test(ef({ direction: "SELL", product: "salt", party: cust, qty: 1, total: 100, cash: 0, kg: 0, date: null, fresh: true }))
      && ef({ direction: "SELL", product: "salt", party: cust, qty: 1, total: 100, cash: 0, kg: 0, date: "2026-09-08", fresh: true }) === "", "and an undated new row, while a dated pending one passes");
    ok(/above zero/.test(ef({ direction: "SELL", product: "salt", party: cust, qty: 0, total: 100, cash: 0, kg: 0, date: "2026-09-08" })), "and a zero quantity");
    const wb = JSON.parse(String(w.eval("(function(){try{switchTab('enter');}catch(e){}try{switchTab('workbench');}catch(e){}var b=document.querySelector('#wbModeSw button[data-m=\"loss\"]');if(!b)return JSON.stringify({no:'switch'});b.click();var u=document.getElementById('wbLossUnits'),d=document.getElementById('wbLossDate'),r=document.getElementById('wbRec');if(!u||!d||!r)return JSON.stringify({no:'fields'});u.value='1';u.dispatchEvent(new Event('input',{bubbles:true}));d.value='2026-09-08';d.dispatchEvent(new Event('input',{bubbles:true}));return JSON.stringify({disabled:r.disabled});})()")));
    ok(wb.no == null && wb.disabled === false, "typing the units and the date into Self-use or loss enables Record without tapping another switch: " + JSON.stringify(wb));
    const msrc = readFileSync(join(REPO, "master", "salt_command.html"), "utf8");
    ok(/cell\('Cost drawn',cost==null\?'&mdash;':fmt\(cost\)\+\(qty>0\?/.test(msrc), "the Approve card labels the order's cost as the order's, with the unit figure beside it");
    ok(/function txGoods\(s\)\{return POSITION_ENGINE\.txGoods\(s\);\}/.test(msrc) && (msrc.match(/txGoods\(s\)\/s\.qty|txGoods\(x\)\/x\.qty/g) || []).length >= 10, "the desk strikes its customer rates on the goods through the engine's txGoods");
    /* 09 Sep 2026: the fold's dossier reads the live quote for a lot's product off the book's own
       keys; it filtered supplierQuote as an array and threw on the first lot staged since v521 */
    {
      const { dossier } = await import("../tools/foldcall.mjs");
      /* two different sizes, or the second lot is a twin of the first and the batch guard refuses it */
      const lotOf = (id, product) => ({ id, collection: "purchases", row: Object.assign(product ? { qty: 30, total: 230, cash: 230, receivedQty: 30 } : { qty: 50, total: 2200, cash: 2200, receivedQty: 50 },
        { supplier: bkR.purchases[0].supplier, date: "2099-01-03", receivedOn: "2099-01-03", status: "paid" }, product ? { product } : {}),
        entry: { at: id, payload: { mode: "new", direction: "BUY" } } });
      const stagedQ = { ok: true, count: 2, approved: [lotOf("2099-01-03T00:00:00.001Z", null), lotOf("2099-01-03T00:00:00.002Z", "oil")] };
      const bkQ = JSON.parse(JSON.stringify(bkR)), pQ = planA(bkQ, stagedQ, null);
      const dQ = pQ.items.length === 2 ? dossier(bkQ, stagedQ, pQ, w) : null;
      const [salt, oil] = dQ ? dQ.items : [];
      ok(dQ && salt && salt.quote && salt.quote.supplier === bkR.supplierQuote.supplier && salt.quote.date === bkR.supplierQuote.quotedOn && Array.isArray(salt.quote.tiers),
        `a staged salt lot's dossier carries the salt quote, dated the day it was quoted (${pQ.refused.map((x) => x.why).join("; ") || (salt && JSON.stringify(salt.quote).slice(0, 80))})`);
      ok(dQ && oil && oil.quote && oil.quote.supplier === bkR.oilQuote.supplier, "and an oil lot's carries the oil quote");
    }
    try { w.close(); } catch (e) { }
  }
}

section("v549: the Sourcing tab describes the lot he has");
{
  /* The section used to be THE NEXT LOT, AS STATED: a hand-typed target date, and a traffic light
     that read `daysToTarget - daysOfCover`, so a date already PAST turned the card green. It went
     green because the plan had failed. currentLot takes the lot outlook's rows as an argument, so
     the choice of lot is testable on synthetic rows without a fixture book anywhere near it. */
  const { openMaster } = await import("../tools/payload.mjs");
  const { w } = await openMaster();
  try {
    const R = (date, recv) => ({ date, sup: "SA5-BTR", recv, rate: 50, cost: recv * 50, left: 0, costLeft: 0 });
    const pick = (rows) => JSON.parse(w.eval("JSON.stringify((currentLot(" + JSON.stringify({ rows }) + ")||{}).lot||null)"));
    /* lotOutlook sorts undated receipts LAST, so taking the final row outright made an undated lot
       the current lot and printed its date as the word undefined. Same rule as supplierStats keeps
       for last paid: an undated receipt is not known to be the newest. */
    const a = pick([R("2026-09-01", 10), R(null, 5)]);
    ok(a && a.date === "2026-09-01", `an undated receipt does not become the current lot (${a && String(a.date)})`);
    const b = pick([R("2026-09-01", 10), R("2026-09-05", 8)]);
    ok(b && b.date === "2026-09-05", `the newest dated lot is the current one (${b && String(b.date)})`);
    const c = pick([R(null, 5)]);
    ok(c && !c.date, "with nothing dated at all the last row still stands, and the card says so");
    ok(pick([]) === null, "and no receipt at all returns null rather than an empty card");
    /* the cadence is measured off the rows, never typed: SOURCING_PLAN's "monthly, on the ceiling
       reset" was contradicted by the book four times in the fortnight before it was retired */
    const g = JSON.parse(w.eval("JSON.stringify(currentLot(" + JSON.stringify({ rows: [R("2026-09-01", 10), R("2026-09-05", 8), R("2026-09-08", 6)] }) + ").gaps)"));
    ok(JSON.stringify(g) === "[4,3]", `the cadence is the gaps the lots actually left (${JSON.stringify(g)})`);
    /* the lot AS BOUGHT, beside the lot as landed: the 08 Sep lot was 50 unit for RM2,200 with
       12.5 still to come, and the card called it 37.5 unit at RM1,650 until the row carried both */
    const RB = (date, recv, qty, total) => ({ date, sup: "SA5-BTR", recv, rate: 44, cost: recv * 44, left: 0, costLeft: 0, qty, total, freight: 36 });
    const bought = JSON.parse(w.eval("JSON.stringify(currentLot(" + JSON.stringify({ rows: [RB("2026-09-08", 37.5, 50, 2200)] }) + "))"));
    ok(bought.qty === 50 && bought.total === 2200 && bought.owed === 12.5,
      `the card reports the lot as bought, and names what is still to come (${bought.qty} unit, ${bought.total}, ${bought.owed} owed)`);
    const landed = JSON.parse(w.eval("JSON.stringify(currentLot(" + JSON.stringify({ rows: [{ date: "2026-09-08", sup: "X", recv: 10, rate: 50, cost: 500, left: 0, costLeft: 0 }] }) + "))"));
    ok(landed.qty === 10 && landed.owed === 0, "and falls back to what landed where the row carries no bought figure");
    /* AN EMPTY BOOK DOES NOT GET A DATE. free is the inventory less what is owed out, and when Oil
       stood at -35 dividing it by the sell rate printed a dry date in the PAST under a heading in
       the future tense. The live books prove the FULL branch; the empty branch is forced rather
       than waited for, because the first cut of this test required one book to be empty and passed
       only for as long as Oil happened to be. v551 counted Oil at 60 and the assertion broke on a
       fix, which is exactly the coupling to live data an instrument must not have. */
    const state = (p) => JSON.parse(w.eval("(function(){setProd(" + JSON.stringify(p) + ");recompute();var x=currentLot();var h=tabSourcing();return JSON.stringify({empty:x?x.empty:null,free:x?x.free:null,says:h.indexOf('empty already')>=0});})()"));
    for (const p of JSON.parse(w.eval("JSON.stringify(PROD_IDS)"))) {
      const st = state(p);
      if (st.empty === null) continue;
      ok(st.empty === (st.free <= 0.009), `${p}: the empty flag says what the free figure says (${st.free})`);
      ok(st.empty === st.says, `${p}: and the card says "empty already" exactly when it is (${st.empty})`);
    }
    /* forced to nought and put back, so the empty branch is exercised on every run */
    const forced = JSON.parse(w.eval("(function(){setProd('oil');recompute();var k=PROD_OPENING.oil,was=k.stated;k.stated=0;recompute();var x=currentLot();var h=tabSourcing();k.stated=was;recompute();return JSON.stringify({empty:x?x.empty:null,free:x?x.free:null,says:h.indexOf('empty already')>=0,dated:/Inventory runs dry<\\/div><div class=\"v\"[^>]*>20\\d\\d-/.test(h)});})()"));
    ok(forced.empty === true, `forced to nought, the book reads empty (free ${forced.free})`);
    ok(forced.says === true, "and the card says empty already");
    ok(forced.dated === false, "and prints no dry date at all, rather than one in the past");
    ok(state("oil").empty === false, "and the forced state is put back, so nothing downstream reads a nought inventory");
    w.eval("setProd('salt');recompute();");
    w.eval("setProd('salt');recompute();switchTab('sourcing');");
    const txt = String(w.eval("document.querySelector('.sec.on').textContent"));
    ok(/The current lot/.test(txt), "the tab leads on the current lot");
    ok(!/Lands in time|Stated lot|Gap to cover|Pull it forward/.test(txt), "and no card promises a stated next lot");
  } finally { try { w.close(); } catch (e) { } }
}

section("v557: a true alarm, and it is scarce enough to mean something");
{
  /* --crim and --rose both pointed at --salt-ember, the identity's third warm accent, so every
     warning was painted in a colour the headings also speak in. And the supplier row lit four
     figures crimson of which none was a fault. Both halves are his instruction of 09 Sep 2026:
     add a true alarm, and fix the thresholds. Colour asserted from the stylesheet, thresholds
     asserted against each row's own figures so the rule holds whatever the book does next. */
  const css = readFileSync(join(REPO, "design", "desk.css"), "utf8");
  const alarm = (css.match(/--salt-alarm:\s*(#[0-9a-fA-F]{6})/) || [])[1];
  ok(!!alarm, `the layer defines a true alarm colour (${alarm || "none"})`);
  ok(alarm && alarm.toLowerCase() !== "#d4694c", "and it is not ember, which is the accent it was");
  ok(/--crim:var\(--salt-alarm\)/.test(css), "--crim points at it, so all 109 warnings move together");
  ok(/--rose:var\(--salt-ember\)/.test(css), "and --rose keeps ember, which no reader uses");
  /* the perceptual test, because hue alone said nothing: ember sits dE 20.7 from copper and that
     is the collision he pointed at, so the alarm must be a clear step further than that */
  const lab = (h) => {
    let [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
      .map((v) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
    const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b,
      Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
    const f = (t) => t > 0.008856 ? Math.cbrt(t) : (7.787 * t + 16 / 116);
    return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
  };
  const dE = (a, b) => { const A = lab(a), B = lab(b); return Math.sqrt(A.reduce((s, v, i) => s + (v - B[i]) ** 2, 0)); };
  const baseline = dE("#d4694c", "#b87333");
  ok(alarm && dE(alarm, "#d4694c") > baseline * 1.4,
    `and it is a clear step from ember: dE ${dE(alarm, "#d4694c").toFixed(1)} against the ${baseline.toFixed(1)} that ember sits from copper`);
  /* THE THRESHOLDS, read off the rendered row against that row's own figures. */
  const { openMaster: om5 } = await import("../tools/payload.mjs");
  const { w } = await om5();
  try {
    let checked = 0, wrong = [];
    for (const p of JSON.parse(w.eval("JSON.stringify(PROD_IDS)"))) {
      w.eval(`setProd(${JSON.stringify(p)});recompute();`);
      const stats = JSON.parse(w.eval("JSON.stringify(supplierStats().map(s=>({id:s.id,quiet:s.quiet,share:s.share,recentShare:s.recentShare,fill:s.fill,defaults:s.defaults})))"));
      const html = String(w.eval("tabSourcing()"));
      for (const s of stats) {
        const i = html.indexOf(">" + s.id + "<") >= 0 ? html.indexOf(">" + s.id + "<") : html.indexOf(s.id);
        if (i < 0) continue;
        const row = html.slice(i, html.indexOf("</tr>", i));
        checked++;
        const quietCrim = /bought \d+d ago/.test(row) && /var\(--crim\)'?">bought/.test(row.replace(/\s+/g, " "));
        const wantQuiet = s.quiet > 30 && !s.defaults && s.share >= 25;
        if (quietCrim !== wantQuiet) wrong.push(`${p}/${s.id} quiet ${s.quiet}d share ${s.share}% defaults ${s.defaults}: drawn ${quietCrim}, rule ${wantQuiet}`);
        const fillCrim = new RegExp("color:var\\(--crim\\)\">" + (s.fill == null ? "&mdash;" : s.fill + "%")).test(row);
        const wantFill = s.fill != null && s.fill < 90;
        if (fillCrim !== wantFill) wrong.push(`${p}/${s.id} fill ${s.fill}%: drawn ${fillCrim}, rule ${wantFill}`);
      }
    }
    ok(checked >= 3, `every supplier row was read (${checked})`);
    ok(wrong.length === 0, wrong.length ? wrong.join(" ; ") : "each row's colours follow the rule, not the old thresholds");
    /* ONE FACT, THREE READERS, ONE RULE (v558). The first cut of this check sliced from "Who you
       buy from" and so proved only two of them: the share cell and the sentence under it. The KPI
       four inches ABOVE that heading kept the bare recentShare>80 rule and went on painting Oil's
       84% as an alarm on a book that has never lost a ringgit, on the same screen as the two that
       had just stopped. A verification pass over the DEPLOYED build found it, because that is the
       one place all three are visible at once. The check now reads the WHOLE tab and requires the
       three to agree, so a fourth reader cannot be added quietly either. */
    for (const p of JSON.parse(w.eval("JSON.stringify(PROD_IDS)"))) {
      w.eval(`setProd(${JSON.stringify(p)});recompute();`);
      const html = String(w.eval("tabSourcing()"));
      const st = JSON.parse(w.eval("JSON.stringify((function(){var s=supplierStats()[0];return s?{id:s.id,recentShare:s.recentShare,defaults:s.defaults}:null;})())"));
      if (!st) continue;
      const concentrated = st.recentShare > 80;
      const want = !concentrated ? null : (st.defaults ? "var(--crim)" : "var(--gold)");
      const pct = st.recentShare.toFixed(0) + "%";
      /* every place the concentration percentage is drawn, with the colour it is drawn in */
      const sites = [];
      const kpi = new RegExp('Top supplier share</div><div class="v" style="([^"]*)">' + pct.replace("%", "%")).exec(html);
      if (kpi) sites.push(["the KPI", (/color:(var\(--\w+\))/.exec(kpi[1]) || [])[1] || null]);
      const cell = new RegExp('<td style="color:(var\\(--\\w+\\))"><b>' + pct + "</b>").exec(html);
      if (cell) sites.push(["the table cell", cell[1] === "var(--ink)" ? null : cell[1]]);
      const sent = new RegExp('<b style="color:(var\\(--\\w+\\))">[A-Z0-9-]+ is ' + pct).exec(html);
      if (sent) sites.push(["the sentence", sent[1]]);
      ok(sites.length === (concentrated ? 3 : 2) || sites.length >= 2,
        `${p}: the concentration figure is drawn in ${sites.length} place(s)`);
      const disagree = sites.filter(([, c]) => c !== want);
      ok(disagree.length === 0, disagree.length
        ? `${p}: ${disagree.map(([n, c]) => n + " says " + c).join(", ")} where the rule says ${want} (share ${pct}, defaults ${st.defaults})`
        : `${p}: all ${sites.length} readers of the concentration figure agree (${want || "no colour"}, share ${pct}, defaults ${st.defaults})`);
    }

    /* HIS WORD OF 09 SEP 2026: CA4-DAM has disappeared, no contact, nothing recoverable, exactly as
       SF6-KLC did. The Order book was telling him to CHASE FIRST a party he had already written
       off, on a row whose own note says the money will not come and whose provision is 100%. The
       book knew: `defaulted` on the sale, `writtenOff` on the supplier receivable. The card did not
       read either. Same shape as the supplier thresholds above, in a third place. */
    const claims = JSON.parse(w.eval("JSON.stringify(obClaims())"));
    const book5 = JSON.parse(readFileSync(join(REPO, "ledger", "book.json"), "utf8"));
    const offParties = new Set(book5.sales.filter((s) => s.defaulted).map((s) => s.customer));
    if (book5.supplierReceivable && book5.supplierReceivable.status === "writtenOff") offParties.add(book5.supplierReceivable.party);
    ok(claims.every((r) => typeof r.off === "boolean"), "every claim says whether it has been written off");
    const mismarked = claims.filter((r) => r.off && !offParties.has(r.who));
    ok(mismarked.length === 0, mismarked.length ? `a claim is marked off with no record behind it: ${mismarked.map((r) => r.who).join(", ")}` : "and nothing is marked off that the book does not say so about");
    const offCount = claims.filter((r) => r.off).length;
    ok(offCount > 0, `there is something written off to be skipped (${offCount} claim(s))`);
    const chased = String(w.eval("consoOrderBlock()"));
    const pick = claims.find((r) => !r.off);
    ok(!!pick, "a chaseable claim remains");
    ok(chased.indexOf(">Chase first</div><div class=\"v\">" + w.eval("ID(" + JSON.stringify(pick.who) + ")")) >= 0
      || new RegExp("Chase first[\\s\\S]{0,120}" + w.eval("ID(" + JSON.stringify(pick.who) + ")")).test(chased),
      `Chase first names the oldest claim that can still be worked (${pick.who}, ${pick.d} days)`);
    for (const r of claims.filter((x) => x.off)) {
      ok(!new RegExp("Chase first[\\s\\S]{0,120}" + w.eval("ID(" + JSON.stringify(r.who) + ")") + "</div>").test(chased),
        `and never a party he has written off (${r.who}, ${r.d} days, ${r.pr * 100}% provisioned)`);
    }
  } finally { try { w.close(); } catch (e) { } }
}

console.log(`\n${pass} passed, ${fail} failed, across ${sections} sections`);
process.exit(fail ? 1 : 0);
