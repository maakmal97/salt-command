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
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "../src/worker.js";
import { unionByAt, pruneCommitted } from "../tools/drain.mjs";
import { NAME_STOPWORDS, NAME_COLLISIONS } from "../tools/book.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("  FAIL: " + m); } };
const section = (s) => console.log("\n" + s);

/* ---- KV + env mocks ------------------------------------------------------------- */
class KV {
  constructor() { this.m = new Map(); }
  async put(k, v) { this.m.set(k, v); }
  async get(k) { return this.m.has(k) ? this.m.get(k) : null; }
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
    console.log("  SKIP: salt_bio.json is not on this machine, so the public-desk name scan did not run here");
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
    ok(hits.length === 0, `no directory name or place appears in the public desk (${words.size} checked, ${hits.length} found)`);

    /* The map is a heatmap and must stay one: no per-party label, no coordinates on screen. */
    ok(desk.includes("url(#heat"), "the map draws heat blobs");
    ok(desk.includes("mix-blend-mode:screen"), "overlapping localities brighten rather than stack");
    ok(!desk.includes("place.name"), "nothing on the map reads a place name");
    ok(!/PLACES\[[^\]]*\]\.(name|src)/.test(desk), "the gazetteer table carries neither name nor provenance");
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
          if (/^UPDATE draft SET committed_at=/.test(s)) {
            const r = self.rows.get(binds[1]);
            if (r && !r.committed_at) r.committed_at = binds[0];
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
  await worker.fetch(post("/drafts/" + encodeURIComponent(second.id) + "/reject", {}, KEY), env);
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
        salt: { stockCost: 56, replCost: 56, floors: { "1": { delivered: 85.75, collected: 79.5 }, "2.5": { delivered: 204.99, collected: 198.74 } } },
        oil: { stockCost: 7, replCost: 7, floors: { "1": { delivered: 14.75, collected: 8.5 } } }
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
  ok(blendRow.flags.some(f => /shelf average/.test(f)), "a blended shelf is named on the row");
  const singleRow = draftRow(entry({ direction: "SELL", party: "CC5-OKR", qty: 1, total: 90, cash: 90, kg: 1, date: "2026-08-16" }), book);
  ok(!singleRow.flags.some(f => /shelf average/.test(f)), "a single-lot shelf does not raise it, so the flag stays worth reading");

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
  ok(spill.flags.some(f => /% of the shelf/.test(f)), "a loss of a quarter of the shelf or more is sized against it");
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

  /* ---- a pending row carries NO DATE ---- */
  const pend = draftRow(entry({ direction: "SELL", party: "CC5-OKR", qty: 1, total: 80, cash: 0, kg: 0, date: "2026-08-16" }), book);
  ok(!pend.skip && pend.row.date === undefined, "nothing moved, so the row is pending and carries NO date even though one was given");
  ok(pend.row.deliveredQty === 0, "and it draws no stock");
  ok(/PENDING/.test(pend.reasoning), "the reasoning says so");

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
  ok(cut.flags.some(f => /RM 5.75 under the DELIVERED floor of RM 85.75/.test(f)), "RM80 is flagged as RM5.75 under the RM85.75 delivered floor, by how much and not only that it is");
  ok(cut.flags.some(f => /clears the COLLECTED floor of RM 79.5/.test(f)), "the collected floor is named and reported, because it does clear that");
  ok(cut.flags.some(f => /what the order costs to take out/.test(f)), "and the flag says what the floor IS, so a row at it is not read as thin margin");
  const under = draftRow(entry({ direction: "SELL", party: "CC5-OKR", qty: 1, total: 70, cash: 70, kg: 1, date: "2026-08-16" }), book);
  ok(under.flags.some(f => /under the COLLECTED floor of RM 79.5 as well/.test(f) && /neither way/.test(f)),
    "a price under both floors says so, and says it covers itself neither way");

  /* THE TIME CHARGE IS READ OFF THE POLICY AND NEVER TYPED INTO THE FLAG. An older snapshot
     carries no policy, and the clause then comes out rather than asserting a figure the
     snapshot does not hold. */
  const timed = JSON.parse(JSON.stringify(book));
  timed.pricing.byProduct.salt.inputs = { policy: { timePerOrder: 25 } };
  ok(floorFor(timed, "salt", 1).time === 25 && floorFor(book, "salt", 1).time === null,
    "floorFor reports the stated time charge, and null where the snapshot has no policy");
  const timedCut = draftRow(entry({ direction: "SELL", party: "CC5-OKR", qty: 1, total: 80, cash: 80, kg: 1, date: "2026-08-16" }), timed);
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
  const mixed = { ...book, sales: [...book.sales, { date: "2026-08-01", customer: "CC5-OKR", qty: 1, total: 70 }] };
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
    ok(!/_run_sync\("-PullOnly"/.test(py), "serve_desk.py no longer drains the cloud queue on a timer");
    ok(!/next_drain/.test(py), "and the drain timer is gone rather than merely unused");
    /* AND THE DRAIN INSIDE THE SYNC PASS, which the first removal missed entirely: the
       timer went but salt_sync.ps1 still ran the drain on every pass, so the log kept
       printing "drained the phone queue" and the road stayed open. */
    const ps1 = `${PROJECT_DIR}/30_Published/salt_sync.ps1`;
    if (existsSync(ps1)) {
      const sync = readFileSync(ps1, "utf8");
      /* the EXECUTABLE form, not the word: the comment explaining the removal names the
         command, so a naive substring search would fail on the very text that documents it */
      ok(!/&\s*node\s+'tools\/drain\.mjs'/.test(sync), "salt_sync.ps1 does not invoke the drain on a sync pass");
      ok(!/Say\s*\(\s*"drained the phone queue"/.test(sync), "and it can no longer report having drained one");
    } else {
      ok(true, "salt_sync.ps1 is not on this machine, so its pull could not be checked");
    }
  } else {
    ok(true, "serve_desk.py is not on this machine, so its drain could not be checked");
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
    ok(true, "the master is not on this machine, so the order check is skipped");
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
  ok(Math.abs(C.landed - 45.2) < 1e-9, "landed cost is the lot rate plus the trip spread over the lot");
  ok(Math.abs(C.delPerOrder - 50) < 1e-9, "delPerOrder is ONE full delivery, not the blended figure");
  ok(Math.abs(C.txn - (0.2 * 50) / 2.5) < 1e-9, "eff carries only the share of orders that are delivered");
  ok(C.effEx > C.landed && C.eff > C.effEx, "the leak divides and delivery adds, in that order");
  const B = E.board(P.boardSizes, C, P);
  const asks = B.tiers[0].prices;
  ok(asks.length === 10 && asks.every((p) => Number.isFinite(p) && p % 10 === 0), "every ask is a multiple of ten");
  let law = true;
  for (let i = 1; i < asks.length; i++) if (asks[i] / P.boardSizes[i] > asks[i - 1] / P.boardSizes[i - 1] + 1e-9) law = false;
  ok(law, "the rate never rises with size");
  ok(P.boardSizes.every((q, i) => B.floors[q].collected <= asks[i] + 1e-9), "no ask sits under its own collected floor");
  /* v344: the card is a COLLECTION price, because four orders in five are collected. Where the
     ask cannot also carry a RM50 delivery the board says so rather than quietly pricing a loss. */
  /* v352: the board states one delivery charge and one time charge rather than flagging each size */
  ok(B.deliveryCharge === C.delPerOrder && B.timePerOrder === P.timePerOrder,
    "the board states the delivery charge and the time charge once");
  ok(P.boardSizes.every((q) => B.floors[q].delivered >= B.floors[q].collected - 0.02
      && B.floors[q].delivered <= B.floors[q].collected + B.deliveryCharge + 0.02),
    "a delivered floor is the collected floor plus at most one delivery");
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
    ok(P.boardSizes.every((q, i) => sa[i] >= SB.floors[q].collected - 0.009), "and no stated price sits under its own floor");
    /* set one absurdly low and the floor guard must lift it rather than honour it */
    const lowB = E.board(P.boardSizes, C, { ...P, stated: { "12.5": 1 } });
    ok(lowB.tiers[0].prices[P.boardSizes.indexOf(12.5)] >= lowB.floors[12.5].collected - 0.009,
      "a price set under the floor is lifted, never honoured");
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
    const deskFloors = read("PRICE_TIERS.sizes.map(q=>[floorTotal(q),floorTotal(q,null,{collects:true})])");
    ok(JSON.stringify(mine.tiers[0].prices) === JSON.stringify(deskAsks), `${p}: the module's asks are the desk's asks at every size`);
    ok(sizes.every((q, i) => mine.floors[q].delivered === +deskFloors[i][0].toFixed(2)
      && mine.floors[q].collected === +deskFloors[i][1].toFixed(2)), `${p}: the module's floors are the desk's floors at every size`);
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
  ok(keys.length === 27, "the book holds the twenty-seven ledger keys");   // v353 added PRICE_SET
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
  /* ---- a CORRECTION reaches EVERY attribute a person states (v363) ---- */
  {
    const { checkCorrection, CORRECTABLE } = await import("../src/drafter.js");
    const E = (await import("../engine/position.mjs")).default;
    const mtxt = readFileSync(join(REPO, "master", "salt_command.html"), "utf8");

    /* v373: thirty-one. handover joined the table so the delivered share could be measured
       from the rows rather than stated at 0.20. The count is pinned rather than derived on
       purpose: a table that quietly gains a field is exactly what this assertion is for. */
    ok(E.CORRECTABLE.length === 31, `thirty-one attributes are editable, found ${E.CORRECTABLE.length}`);
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
    ok(flagsOf({ cost: 99 }).some((f) => /overrides what the shelf says/.test(f)), "a hand-typed cost says it overrides the shelf");
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
  /* v347: a cancelled order is not a target. Its key still matches, so only the guard stops it. */
  {
    const canc = book.sales.find((r) => r.cancelled && r.customer === "CS6-PER" && r.total === 350);
    ok(!!canc, "the book carries the cancelled CS6-PER order");
    const one = { ok: true, count: 1, approved: [{ id: ID("02:00"), collection: "sales",
      amends: `CS6-PER|undefined|350`, amendKind: "Fulfilment",
      row: { customer: "CS6-PER", qty: 6.25, total: 350, cash: 0, date: null },
      entry: { at: ID("02:00"), payload: { mode: "amend", direction: "SELL", kind: "Fulfilment", date: "2026-08-23", cash: 350, kg: 6.25 } } }] };
    const pc = plan(JSON.parse(JSON.stringify(book)), one, null);
    ok(pc.items.length === 0 && pc.refused.length === 1 && /cancelled/.test(pc.refused[0].why),
      "a fulfilment against a cancelled order is refused, not folded onto it");
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
    ok(ful && ful.cost === shelfCost, `salt that left the shelf took the shelf's cost (RM${shelfCost})`);
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
  ok(/parts:\['approve','plans'\]/.test(m) && /function tabApprove\(\)/.test(m) && /async function apDecide\(/.test(m), "Enter carries Approve, reading and deciding the same drafts the phone does");
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

    /* one engine, on whatever basis it is set to. Both are the rate over the mean lot today;
       a price lock legitimately freezes the desk's copy, so that is the one exemption. */
    const c = read("pxCost()");
    if (!c.locked && F.lots > 0)
      ok(F.freightPerUnit === c.freight,
        `${pr}: the statement's freight per unit is the pricing engine's (${F.freightPerUnit})`);
    /* and the cell names the live rate, so moving the rate without the copy fails here */
    if (F.lots > 0) ok(panel.includes(html("fmt0(COST_BASIS.freightPerTrip.rm)") + " a trip"),
      `${pr}: the freight line names the rate it was struck at`);

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
  const EMPTYCATCH = /catch\s*(\(\s*[A-Za-z_$][\w$]*\s*\))?\s*\{\s*\}/g;
  for (const fn of ["trackCharts", "wirePricing", "drawPriceCharts", "drawEarnChart", "drawBoardCharts",
                    "drawRecvCharts", "drawFinCharts", "drawSourcingCharts", "drawOutlookChart",
                    "drawAnalysis", "drawTodayCharts", "drawFwdCharts"]) {
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

    /* THE ASK IS A COLLECTION PRICE and must clear the COLLECTED floor at every size. */
    const under = walk.filter((r) => r.p < E.floorTotal(r.q, C, P, null, { collects: true }) - 0.009);
    ok(under.length === 0, under.length
      ? `${pid}: the ask is under its own collected floor at ${under.map((r) => r.q).join(", ")} unit`
      : `${pid}: every ask clears the collected floor`);

    /* delivered is collected plus exactly one delivery, and never less than collected. */
    const badDel = P.boardSizes.filter((q) => {
      const col = E.floorTotal(q, C, P, null, { collects: true });
      const del = E.floorTotal(q, C, P, null, {});
      return del < col - 0.02 || del > col + C.delPerOrder + 0.02;
    });
    ok(badDel.length === 0, badDel.length
      ? `${pid}: the delivered floor is not within one delivery of the collected one at ${badDel.join(", ")} unit`
      : `${pid}: every delivered floor is the collected floor plus at most one delivery`);

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
  const expRepl = (p) => {
    w.eval(`setProd(${JSON.stringify(p)});recompute();`);
    const rows = read("pPurch(PROD).filter(x=>poLive(x)&&x.qty>0)");
    const from = read("TODAY.getTime()") - 30 * 86400000;
    const win = rows.filter((x) => new Date(x.receivedOn || x.date).getTime() >= from);
    const k = win.reduce((a, x) => a + x.qty, 0);
    if (k > 0) return +(win.reduce((a, x) => a + x.total, 0) / k).toFixed(2);
    const last = rows.slice().sort((a, b) => ((a.receivedOn || a.date) < (b.receivedOn || b.date) ? -1 : 1)).pop();
    return last ? +(last.total / last.qty).toFixed(2) : null;
  };
  for (const p of ["salt", "oil"]) {
    const want = expRepl(p);
    ok(read("pxInputs().repl") === want, `${p}: pxInputs().repl is the book's own trailing average, ${want}`);
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
  ok(JSON.stringify(read("restockQuote(130)")) === JSON.stringify({ qty: 200, total: 8600, rate: 43, lots: 2, quoted: true }),
    "beyond the top tier it takes whole top-tier lots: 130 needs two 100s at RM8,600");
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
  const rows = read("sizesFor('oil').map(q=>({q,ask:priceLadder(q).ask.total,fd:floorTotal(q),fc:floorTotal(q,null,{collects:true})}))");
  const a10 = rows.find((r) => r.q === 10), a50 = rows.find((r) => r.q === 50);
  ok(a10.ask === 130, "the board asks his RM130 at 10");
  ok(a50.ask === 450, "and his RM450 at 50; if this reads higher, the floor has overtaken his price and he must decide");
  ok(JSON.stringify(rows.map((r) => r.ask)) === JSON.stringify([130, 240, 330, 400, 450]),
    "the whole board is his stated one: 130, 240, 330, 400, 450");
  ok(a50.fd <= 450 + 1e-9 && a50.fc <= 450 + 1e-9,
    `RM450 clears both 50 unit floors (delivered ${a50.fd}, collected ${a50.fc}); red here means the tension of v404 is back`);
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
  ok(/--tap:44px/.test(m) && !/--tap:40px/.test(m), "the tap token is 44px, and there is only one of it");
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
  if (!oilLots.length) ok(true, "no received oil lot on the book, so the check is skipped");
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

    w.eval("updSet(null," + outstanding + ",0);");
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
    const row = (b.sales || []).find((r) => !r.date && !r.cancelled && (r.product || "salt") === "salt");
    if (!row) { ok(true, "no live undated sale to test the finRows guard with (skipped)"); }
    else {
      row.cash = 100;
      const r = await paneOf(withBook(b), "financials", "salt");
      ok(!r.threw, `Financials renders with cash on an undated row (${row.rid}) -- ${r.threw}`);
      ok(r.text.length > 400, `Financials is not blank with cash on an undated row (${r.text.length} chars)`);
      let u = null; try { u = r.w.eval("finRows().undated.length"); } catch (e) { u = "threw"; }
      ok(u === 1, `finRows holds the undated row out and counts it (got ${u})`);
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
      for (const q of [1, 2.5]) {
        const desk = w.eval(`floorTotal(${q})`);
        const snapped = snap.byProduct[p] && snap.byProduct[p].floors && snap.byProduct[p].floors[q]
          ? snap.byProduct[p].floors[q].delivered : null;
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
    const f = rf(join(REPO, "tools", "fold.mjs"), "utf8");
    const canc = f.slice(f.indexOf('pay.kind === "Cancellation"') - 100, f.indexOf('pay.kind === "Cancellation"') + 600);
    ok(/receivedQty/.test(canc) && /already moved/.test(canc),
      "the fold's Cancellation branch refuses a row that has already moved goods");
  }

  for (const f of [TMP, TMPB, TMP + ".run.html"]) { try { rm(f); } catch (e) { /* best effort */ } }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
